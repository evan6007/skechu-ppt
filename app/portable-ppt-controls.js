/* Adapt the editor's actual cubic geometry; never re-trace or simplify it. */
function portableGeometryBounds(contours) {
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  const include=p=>{x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y)};
  for(const c of contours)for(const s of c.segments){
    include(s.p0);include(s.p3);
    for(const axis of ['x','y']){
      const [p,q,r,z]=[s.p0,s.c1,s.c2,s.p3].map(p=>p[axis]);
      const a=-p+3*q-3*r+z,b=2*(p-2*q+r),d=q-p,roots=[];
      if(Math.abs(a)<1e-12){if(Math.abs(b)>1e-12)roots.push(-d/b)}
      else{const discriminant=b*b-4*a*d;if(discriminant>=0)roots.push((-b+Math.sqrt(discriminant))/(2*a),(-b-Math.sqrt(discriminant))/(2*a))}
      for(const t of roots)if(t>0&&t<1){const u=1-t;include({x:u**3*s.p0.x+3*u*u*t*s.c1.x+3*u*t*t*s.c2.x+t**3*s.p3.x,y:u**3*s.p0.y+3*u*u*t*s.c1.y+3*u*t*t*s.c2.y+t**3*s.p3.y})}
    }
  }
  return{x,y,w:Math.max(.001,right-x),h:Math.max(.001,bottom-y)};
}
function portableTextSnapshot(it) {
  if(it.latex)throw Error('跨平台原生 PPTX 尚未支援 LaTeX 公式。請將公式取消選取後再匯出；不會把公式變成圖片或刪掉。');
  // Browser font metrics determine the box, while the saved content stays text.
  let x=it.x,y=it.y,w=it.w,h=it.h;
  if(!it.box){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.style.cssText='position:fixed;left:-100000px;top:0;overflow:visible;visibility:hidden';
    const text=document.createElementNS('http://www.w3.org/2000/svg','text');
    text.textContent=String(it.text||'');
    for(const [name,value] of Object.entries({x:it.x,y:it.y,'font-size':it.size,'font-family':it.fontFamily||'Arial','font-weight':it.bold?'700':'400','font-style':it.italic?'italic':'normal'}))text.setAttribute(name,String(value));
    svg.append(text);document.body.append(svg);
    let b;try{b=svg.firstElementChild.getBBox()}finally{svg.remove()}
    x=b.x;y=b.y;w=Math.max(1,b.width+2);h=Math.max(it.size*1.25,b.height);
    // Non-boxed SVG rotates about the baseline, not the measured box center.
    const angle=(it.r||0)*Math.PI/180,cx=x+w/2,cy=y+h/2,dx=cx-it.x,dy=cy-it.y;
    x+=it.x+dx*Math.cos(angle)-dy*Math.sin(angle)-cx;
    y+=it.y+dx*Math.sin(angle)+dy*Math.cos(angle)-cy;
  }
  return{kind:'text',x,y,w,h,rotation:it.r||0,text:String(it.text||''),font:it.fontFamily||'Arial',size:it.size,color:it.color||'#24313a',
    bold:!!it.bold,italic:!!it.italic,align:it.box?it.align:'left',valign:it.box?it.valign:'top',lineHeight:it.lineHeight||1.05,
    margins:[it.marginLeft??0,it.marginTop??0,it.marginRight??0,it.marginBottom??0]};
}
function portableArrowHead(it,boundary,atStart) {
  const s=atStart?boundary.segments[0]:boundary.segments.at(-1),tip=atStart?s.p0:s.p3;
  const candidates=atStart?[s.c1,s.c2,s.p3]:[s.c2,s.c1,s.p0];
  const other=candidates.find(p=>Math.hypot(p.x-tip.x,p.y-tip.y)>1e-8);
  if(!other)return null;
  const angle=Math.atan2(tip.y-other.y,tip.x-other.x),scale=(it.head||10)/10;
  const transform=p=>{const x=(p.x-9)*scale,y=(p.y-5)*scale;return{x:tip.x+x*Math.cos(angle)-y*Math.sin(angle),y:tip.y+x*Math.sin(angle)+y*Math.cos(angle)}};
  let segments;
  if(it.headShape==='circle')segments=RegionFill.arc(5,5,4.2,4.2,0,Math.PI*2);
  else{const pts=(it.headShape==='diamond'?[[0,5],[5,0],[10,5],[5,10]]:it.headShape==='stealth'?[[0,0],[10,5],[0,10],[3.3,5]]:[[0,0],[10,5],[0,10]]).map(([x,y])=>({x,y}));segments=pts.map((p,i)=>RegionFill.line(p,pts[(i+1)%pts.length]))}
  const contours=[{closed:true,segments:segments.map(s=>Object.fromEntries(['p0','c1','c2','p3'].map(k=>[k,transform(s[k])])))}];
  return{kind:'path',...portableGeometryBounds(contours),contours,fill:{type:'solid',color:it.color,opacity:1},stroke:null};
}
function portableSelectionSnapshot(source=clipboardSelection()) {
  if(!source.length||source.length>5000)throw Error('請選取 1–5,000 個物件後分批匯出');
  let points=0;
  for(const it of source){
    points+=it.points?.length||0;
    if(points>50000)throw Error('目前選取超過 50,000 個錨點，請分批匯出');
    if(!['image','text','box','ellipse','polygon','arrow'].includes(it.type))throw Error(`跨平台原生 PPTX 尚未支援 ${it.type} 物件；請取消選取後重試，不會省略或轉成圖片。`);
    if(it.latex)throw Error('跨平台原生 PPTX 尚未支援 LaTeX 公式，請取消選取公式後重試。');
  }
  const shapes=[];
  for(const it of paintSceneItems(source)){
    if(it.type==='image'){shapes.push({kind:'image',x:it.x,y:it.y,w:it.w,h:it.h,rotation:it.r||0,src:it.src});continue}
    if(it.type==='text'){shapes.push(portableTextSnapshot(it));continue}
    const arrow=it.type==='arrow',rotate=!arrow&&it.type!=='polygon'?(it.r||0):0;
    const boundaries=it.compoundContours?it.compoundContours.map(c=>fillBoundaryPath({...c,hidden:false,referenceOnly:false})): [fillBoundaryPath({...it,r:0})];
    if(boundaries.some(b=>!b?.segments.length))throw Error('物件沒有可用曲線，請完成描圖後再匯出');
    const contours=boundaries.map(b=>({closed:b.closed,segments:b.segments}));
    const b=portableGeometryBounds(contours),opacity=arrow?(it.closed?(it.fillOpacity??.25):0):(it.opacity??1);
    const visible=opacity>0&&!['none','transparent',''].includes(it.fill);
    const gradient=visible?GradientFill.normalize(it.fillGradient):null;
    if(visible&&it.fillGradient&&!gradient)throw Error('這個物件的漸層格式不支援原生 PPTX，請先檢查色標。');
    const fill=visible?(gradient?{...gradient,opacity}:{type:'solid',color:it.fill,opacity}):null;
    const width=arrow?(it.width??3):(it.strokeWidth??2),strokeColor=arrow?it.color:it.stroke;
    const stroke=width>0&&!['none','transparent','',undefined].includes(strokeColor)?{color:strokeColor,width,dash:it.style==='dash'}:null;
    shapes.push({kind:'path',...b,rotation:rotate,contours,fill,stroke});
    if(arrow&&!it.compoundContours){
      for(const atStart of [true,false])if(atStart?it.startHead:it.endHead!==false){const head=portableArrowHead(it,boundaries[0],atStart);if(head)shapes.push(head)}
    }
    if(it.type==='polygon'&&it.label){
      const c=centroid(it.points),size=it.fontSize||20;
      shapes.push(portableTextSnapshot({type:'text',box:true,x:(it.labelX??c.x)-b.w/2,y:(it.labelY??c.y+7)-size,w:b.w,h:size*1.5,size,text:it.label,color:it.labelColor||'#24313a',align:'center'}));
    }
  }
  // Geometry helpers may share source points; detach before the first await.
  return structuredClone({version:1,shapes});
}
function portableCopyGuidance() {
  const platform=detectPptPlatform(),keys=platform.id==='mac'?'Cmd+A、Cmd+C':'Ctrl+A、Ctrl+C';
  const steps=['ios','android'].includes(platform.id)?'匯出選取物件後，用 PowerPoint 開啟檔案；手機版的編輯與貼上能力取決於 Office 版本。':`匯出後用 PowerPoint 開啟檔案，點圖頁內的物件，按 ${keys} 再貼到你的簡報。`;
  clipboardFeedback(`${platform.name}：先匯出可編輯 PPTX`, `${steps}目前這個跨平台方式不會寫入原生系統剪貼簿。`, 'info');
  document.getElementById('clipboard-portable-actions').hidden=false;
}
async function downloadPortableSelection() {
  if(pptCopyRunning||!validateClipboardSelection())return;
  setClipboardBusy(true);
  clipboardFeedback('正在建立原生 PPTX','在這部裝置處理選取物件，不會上傳圖稿。');
  try{
    // Snapshot before yielding: a later selection/edit never changes this export.
    const chosen=clipboardSelection();
    const source=chosen.some(it=>it.type==='image')?await clipboardImageSnapshot(chosen):chosen;
    const snapshot=portableSelectionSnapshot(source);
    await new Promise(resolve=>setTimeout(resolve,0));
    const bytes=await encodePortablePptx(snapshot);
    download(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}),'skechu-selection.pptx');
    clipboardFeedback('已產生可編輯 PPTX','開啟下載的 PPTX，點圖頁內物件，再全選、複製到你的簡報。曲線、填色與漸層仍是原生物件；字型與排版依接收端而異。這次沒有寫入剪貼簿。','success');
    document.getElementById('clipboard-portable-actions').hidden=false;
  }catch(error){clipboardFeedback('尚未匯出 PPTX',error.message||String(error),'error')}
  finally{setClipboardBusy(false)}
}
function encodePortablePptx(snapshot){
  return new Promise((resolve,reject)=>{
    // Use a worker so a large native package cannot block selection/deletion.
    // file:// cannot create this worker; keep an explicit small-selection fallback.
    if(location.protocol==='file:'){
      if(snapshot.shapes.length>100)return reject(Error('直接開啟 HTML 僅支援小批匯出；請用正式網頁處理大量物件。'));
      try{resolve(PortablePptx.encode(snapshot))}catch(error){reject(error)}return;
    }
    let worker,timer;
    const finish=(error,bytes)=>{clearTimeout(timer);worker?.terminate();error?reject(error):resolve(bytes)};
    try{
      worker=new Worker('portable-ppt-worker.js?v=95-copy-recovery');
      timer=setTimeout(()=>finish(Error('PPTX 產生逾時，請分批選取後重試。')),30000);
      worker.onmessage=event=>event.data?.error?finish(Error(event.data.error)):event.data?.bytes instanceof Uint8Array?finish(null,event.data.bytes):finish(Error('PPTX 產生結果不完整'));
      worker.onerror=()=>finish(Error('PPTX 工作程式未能啟動，請重新整理網頁後再試。'));
      worker.postMessage(snapshot);
    }catch(error){finish(error)}
  });
}
function initializePortablePptControls(){
  for(const id of ['export-pptx','clipboard-download-pptx'])document.getElementById(id).onclick=downloadPortableSelection;
}
