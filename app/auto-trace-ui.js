/* Editor integration: preview is isolated; only Apply adds items to history. */
let autoTraceJob=null,autoTraceResult=null,autoTraceSource=null,autoTraceSerial=0,autoTraceTimer=null;
let autoTraceReviewCursor=0,autoTracePreviewSelection=null;
const autoJunctionPositions=new Map();
function createAutoTraceJob() {
 // The worker contains the already-loaded engine, with no file:// fetch or importScripts.
 // This also keeps the preview worker and editable-anchor engine on the same version.
 const url=URL.createObjectURL(new Blob([AutoTrace.workerSource()],{type:'text/javascript'}));
 try {
  const worker=new Worker(url),terminate=worker.terminate.bind(worker);
  worker.terminate=()=>{terminate();URL.revokeObjectURL(url)};
  return worker;
 } catch(error) {URL.revokeObjectURL(url);throw new Error(`自動描圖背景運算無法啟動：${error.message||error}`);}
}
document.getElementById('import-reference').insertAdjacentHTML('beforebegin','<button id="auto-trace" class="tool-button" title="把線稿、Logo 或照片角色轉成可編輯曲線"><span class="tool-icon" aria-hidden="true">✧</span><span class="tool-text">自動描圖</span></button>');
document.body.insertAdjacentHTML('beforeend',`
<dialog id="auto-trace-dialog" aria-labelledby="auto-trace-title">
 <div class="auto-trace-heading"><div><h2 id="auto-trace-title">自動描圖</h2><p>直接預測並畫出描圖筆曲線；調整設定會自動更新。套用後可刪點、拉切線精修。</p></div><button id="auto-trace-cancel" type="button" aria-label="取消自動描圖">✕</button></div>
 <div class="auto-trace-mode-row"><label for="auto-trace-mode">描圖方式</label><select id="auto-trace-mode"><option value="auto">自動判斷（推薦）</option><option value="line">細線稿 · 沿線中心描</option><option value="contour">Logo 輪廓 · 沿色塊邊緣描</option><option value="photo">照片角色 · 排除背景與雜訊</option></select><button id="auto-trace-reset" type="button">恢復推薦設定</button></div>
 <p id="auto-trace-mode-hint" class="auto-trace-mode-hint">不用先猜參數：細線稿保留分岔，實心 Logo 描出外框與內部留白。</p>
 <div class="auto-trace-options">
  <label><span class="auto-trace-option-title"><span id="auto-trace-threshold-title">深淺辨識</span> <output id="auto-trace-threshold-value" for="auto-trace-threshold"></output></span><input id="auto-trace-threshold" aria-label="深淺辨識" type="range" min="40" max="220" step="5" value="150"><span class="auto-trace-range-ends"><span id="auto-trace-threshold-low">只抓深色</span><span id="auto-trace-threshold-high">包含淺色</span></span><small id="auto-trace-threshold-help">漏線往右；抓到多餘的底色往左。</small></label>
  <label><span class="auto-trace-option-title">曲線柔順 <output id="auto-trace-accuracy-value" for="auto-trace-accuracy"></output></span><input id="auto-trace-accuracy" aria-label="曲線柔順" type="range" min="0.3" max="6" step="0.1" value="2.5"><span class="auto-trace-range-ends"><span>更貼原圖</span><span>更圓滑</span></span><small>往右容許小幅偏離，減少細碎彎折。</small></label>
  <label><span class="auto-trace-option-title">錨點精簡 <output id="auto-trace-simplify-value" for="auto-trace-simplify"></output></span><input id="auto-trace-simplify" aria-label="錨點精簡" type="range" min="0" max="100" step="5" value="90"><span class="auto-trace-range-ends"><span>更多控制點</span><span>更少控制點</span></span><small>往右以較長的弧線描圖，方便精修。</small></label>
  <label><span class="auto-trace-option-title">細節清理 <output id="auto-trace-min-length-value" for="auto-trace-min-length"></output></span><input id="auto-trace-min-length" aria-label="細節清理" type="range" min="0" max="30" step="1" value="3"><span class="auto-trace-range-ends"><span>保留小細節</span><span>去掉小碎片</span></span><small>小圖示先靠左；往右會移除短線或小輪廓。</small></label>
 </div>
 <div class="auto-trace-actions"><span class="auto-trace-legend">藍線＝描線</span><label><input id="auto-trace-show-image" type="checkbox" checked> 顯示底圖</label><label><input id="auto-trace-show-anchors" type="checkbox" checked> 實際錨點（青色）</label><label><input id="auto-trace-show-issues" type="checkbox" checked> 待確認（紅圈，非錨點）</label><span id="auto-trace-summary" role="status" aria-live="polite"></span></div>
 <div class="auto-trace-canvas"><svg id="auto-trace-svg" xmlns="http://www.w3.org/2000/svg" aria-label="預測描圖筆線條"><g id="auto-trace-image"></g><g id="auto-trace-lines"></g><g id="auto-trace-anchors" pointer-events="none"></g><g id="auto-trace-issues" pointer-events="none"></g></svg></div>
 <div class="auto-trace-footer"><span id="auto-trace-anchor-info">青色點才是套用後的實際錨點；紅圈只是待確認。點一段藍線可看它的點數。</span><button id="auto-trace-apply" class="primary" type="button" disabled>套用線圖</button></div>
</dialog>`);
const autoTraceDialog=document.getElementById('auto-trace-dialog');
function cancelAutoTrace(){clearTimeout(autoTraceTimer);autoTraceTimer=null;autoTraceSerial++;autoTraceJob?.terminate();autoTraceJob=null;autoTraceResult=null;autoTraceSource=null;setAutoTraceBusy(false);autoTraceDialog.close()}
function setAutoTraceBusy(busy){document.getElementById('auto-trace-svg').setAttribute('aria-busy',String(busy));document.getElementById('auto-trace-anchors').innerHTML='';autoTracePreviewSelection=null;document.getElementById('auto-trace-anchor-info').textContent='青色點才是套用後的實際錨點；紅圈只是待確認。點一段藍線可看它的點數。'}
function invalidateAutoTrace(){
 updateAutoTraceSettings();
 clearTimeout(autoTraceTimer);autoTraceTimer=null;autoTraceSerial++;autoTraceJob?.terminate();autoTraceJob=null;autoTraceResult=null;document.getElementById('auto-trace-apply').disabled=true;
 if(!autoTraceDialog.open||!autoTraceSource)return;
 if(!validAutoTraceOptions()){setAutoTraceBusy(false);document.getElementById('auto-trace-lines').innerHTML='';document.getElementById('auto-trace-issues').innerHTML='';document.getElementById('auto-trace-summary').textContent='請輸入範圍內的數值，填好後會自動預測';return}
 setAutoTraceBusy(true);document.getElementById('auto-trace-summary').textContent='正在更新預測描線…';
 // Coalesce slider/input changes, and ignore any replies from superseded workers.
 autoTraceTimer=setTimeout(()=>{autoTraceTimer=null;generateAutoTracePreview()},220);
}
function validAutoTraceOptions(){return ['auto-trace-threshold','auto-trace-accuracy','auto-trace-simplify','auto-trace-min-length'].every(id=>{const input=document.getElementById(id);return input.value.trim()!==''&&input.checkValidity()})}
function autoTraceSignature(ref){return JSON.stringify([activeProjectId,activePageId,ref.id,ref.src,ref.x,ref.y,ref.w,ref.h,ref.r])}
function autoTraceOptions(){return{mode:document.getElementById('auto-trace-mode').value||'auto',threshold:Number(document.getElementById('auto-trace-threshold').value),accuracy:Number(document.getElementById('auto-trace-accuracy').value),simplify:Number(document.getElementById('auto-trace-simplify').value),minLength:Number(document.getElementById('auto-trace-min-length').value)}}
function updateAutoTraceSettings(){
 for(const [name,min,max] of [['threshold',40,220],['accuracy',.3,6],['simplify',0,100],['min-length',0,30]]){
  const input=document.getElementById('auto-trace-'+name),percent=Math.round((Number(input.value)-min)/(max-min)*100);
  document.getElementById('auto-trace-'+name+'-value').textContent=`${percent}%`;
  input.setAttribute('aria-valuetext',`${percent}%`);
 }
 const mode=autoTraceOptions().mode;
 const photo=mode==='photo';
 document.getElementById('auto-trace-threshold-title').textContent=photo?'照片細節':'深淺辨識';
 document.getElementById('auto-trace-threshold-low').textContent=photo?'只留主要特徵':'只抓深色';
 document.getElementById('auto-trace-threshold-high').textContent=photo?'保留更多細節':'包含淺色';
 document.getElementById('auto-trace-threshold-help').textContent=photo?'草地與照片雜訊會先排除；往右增加五官與斑紋細節。':'漏線往右；抓到多餘的底色往左。';
 document.getElementById('auto-trace-mode-hint').textContent=photo?'照片角色：估計並排除背景，只描角色外框與較明確的五官、斑紋；低解析圖片仍需套用後精修。':mode==='contour'?'Logo 輪廓：描出色塊外框與內部留白，不把實心區域縮成骨架。':mode==='line'?'細線稿：沿筆畫中心描圖，保留 T 型分岔；適合大腦線稿。':'不用先猜參數：細線稿保留分岔，實心 Logo 描出外框與內部留白。';
}
function resetAutoTraceSettings(){
 document.getElementById('auto-trace-mode').value='auto';
 for(const [name,value] of [['threshold',150],['accuracy',2.5],['simplify',90],['min-length',3]])document.getElementById('auto-trace-'+name).value=String(value);
 invalidateAutoTrace();
}
function autoTraceCurvePath(it){let d=`M${it.points[0].x} ${it.points[0].y}`;for(let i=0;i<(it.closed?it.points.length:it.points.length-1);i++){const j=(i+1)%it.points.length,p=it.points[i],q=it.points[j],a=it.pointHandleAngles[i],b=it.pointHandleAngles[j];d+=` C${p.x+Math.cos(a.out*Math.PI/180)*a.outLength} ${p.y+Math.sin(a.out*Math.PI/180)*a.outLength} ${q.x+Math.cos(b.in*Math.PI/180)*b.inLength} ${q.y+Math.sin(b.in*Math.PI/180)*b.inLength} ${q.x} ${q.y}`}return d+(it.closed?' Z':'')}
function renderAutoTracePreview(){
 const result=autoTraceResult;if(!result)return;
 const pen=tracePenStrokeStyle();
 document.getElementById('auto-trace-lines').innerHTML=result.items.map((it,i)=>`<path class="auto-trace-predicted-line" data-auto-curve="${i}" tabindex="0" role="button" aria-label="描線 ${i+1}：${it.points.length} 個錨點" d="${autoTraceCurvePath(it)}" fill="none" stroke="${autoTracePreviewSelection===i?'#7c3aed':pen.color}" stroke-width="${autoTracePreviewSelection===i?3.5:pen.width}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`).join('');
 document.getElementById('auto-trace-anchors').innerHTML=result.items.flatMap((it,i)=>it.points.map(p=>`<circle data-preview-anchor="${i}" cx="${p.x}" cy="${p.y}" r="${autoTracePreviewSelection===i?7:3.5}" fill="white" stroke="#0891b2" stroke-width="${autoTracePreviewSelection===i?2:1}" vector-effect="non-scaling-stroke"/>`)).join('');
 document.getElementById('auto-trace-issues').innerHTML=result.issues.map(it=>`<circle cx="${it.x}" cy="${it.y}" r="7" fill="none" stroke="#ff2438" stroke-width="2" vector-effect="non-scaling-stroke"><title>${esc(it.message)}</title></circle>`).join('');
 const s=result.stats,mode=s.mode==='photo'?'照片角色':s.mode==='contour'?'Logo 輪廓':'細線稿';
 document.getElementById('auto-trace-summary').textContent=s.paths?`${mode} · ${s.paths} 條曲線 · ${s.anchors} 個錨點${s.mode==='photo'?` · 外框 ${s.outlinePaths} 條／特徵 ${s.detailPaths} 條`:s.mode==='contour'?'':` · ${s.junctions} 個分岔 · ${s.reviewCount} 處待確認`}`:`沒有找到線條；把「${s.mode==='photo'?'照片細節':'深淺辨識'}」往右拉試試`;
 if(autoTraceOptions().mode==='auto')document.getElementById('auto-trace-mode-hint').textContent=`自動選用「${mode}」${s.mode==='contour'?'：沿色塊邊緣描，不會再擋掉大面積黑色。':'：沿筆畫中心描，保留 T 型分岔。'}不符合預期可手動切換。`;
 document.getElementById('auto-trace-apply').disabled=!result.items.length;
}
function inspectAutoTraceCurve(event){const path=event.target.closest('[data-auto-curve]');if(!path||!autoTraceResult)return;autoTracePreviewSelection=Number(path.getAttribute('data-auto-curve'));const it=autoTraceResult.items[autoTracePreviewSelection];renderAutoTracePreview();document.getElementById('auto-trace-anchor-info').textContent=`這段描線：${it.points.length} 個實際錨點。套用後點數相同；紅圈不代表錨點。`}
async function openAutoTrace(){
 const selectedItem=byId(selected),ref=selectedItem?.type==='image'?selectedItem:items.find(it=>it.type==='image'&&it.referenceOnly);
 if(!ref){document.getElementById('status').textContent='請先匯入底圖，再按「自動描圖」';return}
 if(ref.preserveFull!==true){document.getElementById('status').textContent='請透過「底圖」匯入圖片，以保留原圖座標再自動描圖';return}
 if(traceDraft){document.getElementById('status').textContent='請先按 Enter 完成目前描線，再使用自動描圖';return}
 autoTraceSource={ref:deepCopy(ref),signature:autoTraceSignature(ref)};autoTraceResult=null;autoTraceDialog.showModal();
 document.getElementById('auto-trace-lines').innerHTML='';document.getElementById('auto-trace-issues').innerHTML='';
 invalidateAutoTrace();clearTimeout(autoTraceTimer);autoTraceTimer=null;if(validAutoTraceOptions())await generateAutoTracePreview();
}
async function generateAutoTracePreview(){
 if(!autoTraceSource||!autoTraceDialog.open||!validAutoTraceOptions())return;
 clearTimeout(autoTraceTimer);autoTraceTimer=null;autoTraceJob?.terminate();const serial=++autoTraceSerial;autoTraceResult=null;
 const apply=document.getElementById('auto-trace-apply'),summary=document.getElementById('auto-trace-summary');apply.disabled=true;setAutoTraceBusy(true);summary.textContent='正在預測描線…';
 try{
  const ref=autoTraceSource.ref,im=new Image;im.src=ref.src;await im.decode();if(serial!==autoTraceSerial)return;
  const scale=Math.min(1,2048/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(3,Math.round(im.naturalWidth*scale)),h=Math.max(3,Math.round(im.naturalHeight*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(im,0,0,w,h);const pixels=context.getImageData(0,0,w,h).data;
  autoTraceSource.width=w;autoTraceSource.height=h;
  document.getElementById('auto-trace-svg').setAttribute('viewBox',`0 0 ${w} ${h}`);
  document.getElementById('auto-trace-image').innerHTML=`<image href="${esc(ref.src)}" width="${w}" height="${h}" opacity=".25" preserveAspectRatio="none"/>`;
  autoTraceJob=createAutoTraceJob();
  autoTraceJob.onmessage=event=>{
   if(serial!==autoTraceSerial)return;const message=event.data;
   if(message.type==='progress'){summary.textContent=`${message.stage}（${message.percent}%）`;return}
   autoTraceJob.terminate();autoTraceJob=null;setAutoTraceBusy(false);
   if(message.type==='error'){document.getElementById('auto-trace-lines').innerHTML='';document.getElementById('auto-trace-issues').innerHTML='';summary.textContent=message.message;return}
   autoTraceResult=message.result;renderAutoTracePreview();
  };
  autoTraceJob.onerror=event=>{if(serial!==autoTraceSerial)return;autoTraceJob?.terminate();autoTraceJob=null;setAutoTraceBusy(false);document.getElementById('auto-trace-lines').innerHTML='';document.getElementById('auto-trace-issues').innerHTML='';summary.textContent='自動描圖未能啟動；請重新整理頁面後重試。';console.error('Auto trace worker failed:',event.message)};
  const options=autoTraceOptions();options.accuracy=Math.max(.3,options.accuracy*scale);options.minLength*=scale;
  autoTraceJob.postMessage({width:w,height:h,data:pixels,options},[pixels.buffer]);
 }catch(error){if(serial!==autoTraceSerial)return;autoTraceJob?.terminate();autoTraceJob=null;setAutoTraceBusy(false);document.getElementById('auto-trace-lines').innerHTML='';document.getElementById('auto-trace-issues').innerHTML='';summary.textContent=`自動描圖未完成：${error.message||error}`}
}
function transformAutoTraceItems(result,ref,w,h,batch,makeId){
 const sx=ref.w/w,sy=ref.h/h,angle=(ref.r||0)*Math.PI/180,cx=ref.x+ref.w/2,cy=ref.y+ref.h/2;
 const transform=p=>{const x=ref.x+p.x*sx-cx,y=ref.y+p.y*sy-cy;return{x:cx+x*Math.cos(angle)-y*Math.sin(angle),y:cy+x*Math.sin(angle)+y*Math.cos(angle)}};
 const created=result.items.map((source,index)=>{
  const it=deepCopy(source);it.id=makeId();it.name=`自動描圖 ${index+1}`;it.autoTraceBatch=batch;it.layerGroup={id:'trace-'+batch,name:'自動描圖',collapsed:true};Object.assign(it,tracePenStrokeStyle());
  for(const [key,handle] of Object.entries(it.pointHandleAngles)){const p=source.points[key],anchor=transform(p);for(const side of ['in','out']){const a=handle[side]*Math.PI/180,c=transform({x:p.x+Math.cos(a)*handle[side+'Length'],y:p.y+Math.sin(a)*handle[side+'Length']}),dx=c.x-anchor.x,dy=c.y-anchor.y;handle[side]=Math.atan2(dy,dx)*180/Math.PI;handle[side+'Length']=Math.hypot(dx,dy)}}
  it.points=source.points.map(transform);it.pointJunctions=Object.fromEntries(Object.entries(it.pointJunctions).map(([i,key])=>[i,`${batch}-${key}`]));return it;
 });
 for(const issue of result.issues||[]){const p=transform(issue);let best=null;for(const it of created)it.points.forEach((q,index)=>{const d=Math.hypot(q.x-p.x,q.y-p.y);if(!best||d<best.distance)best={it,index,distance:d}});if(best){best.it.autoTraceReview=best.it.autoTraceReview||{};best.it.autoTraceReview[best.index]=issue.message}}
 return created;
}
function applyAutoTrace(){
 const ref=autoTraceSource&&byId(autoTraceSource.ref.id);
 if(!autoTraceResult?.items.length||!ref||autoTraceSignature(ref)!==autoTraceSource.signature){document.getElementById('auto-trace-summary').textContent='底圖或工作區域已變更，請關閉後再開啟「自動描圖」';document.getElementById('auto-trace-apply').disabled=true;return}
 const batch=`auto-${id()}`,created=transformAutoTraceItems(autoTraceResult,ref,autoTraceSource.width,autoTraceSource.height,batch,id),stats=autoTraceResult.stats;
 commit();items.push(...created);setTracePen(false);setOnlySelected(created[0]?.id||null);selectedPoint=null;editPoints=true;cancelAutoTrace();render();
 autoTraceReviewCursor=0;document.getElementById('status').textContent=`已新增 ${stats.paths} 條可編輯曲線、${stats.junctions} 個共用分岔；原圖保留，可復原。${stats.reviewCount?'按右側「下一個待確認」檢查紅色接點。':''}`;
}
function autoJunctionMembers(sourceItems=items){const groups=new Map();for(const it of sourceItems)for(const [key,group] of Object.entries(it.pointJunctions||{})){const index=Number(key);if(!it.points?.[index])continue;if(!groups.has(group))groups.set(group,[]);groups.get(group).push({it,index,p:it.points[index]})}return groups}
function mergeAutoTraceProperties(a,b,merged,offset){
 if(!a.autoTrace&&!b.autoTrace&&!Object.keys(a.pointJunctions||{}).length&&!Object.keys(b.pointJunctions||{}).length)return;
 for(const key of ['pointSmoothness','pointAngles','pointHandleAngles','pointJunctions','autoTraceReview']){const values={...(a[key]||{})};for(const [i,value] of Object.entries(b[key]||{}))values[offset+Number(i)]=deepCopy(value);merged[key]=values}
 const before=arrowSegmentControls(a,a.points.length-2),after=arrowSegmentControls(b,0),p=merged.points[offset],incoming={x:before.c2.x-p.x,y:before.c2.y-p.y},outgoing={x:after.c1.x-p.x,y:after.c1.y-p.y};
 merged.pointHandleAngles[offset]={in:Math.atan2(incoming.y,incoming.x)*180/Math.PI,out:Math.atan2(outgoing.y,outgoing.x)*180/Math.PI,inLength:Math.hypot(incoming.x,incoming.y),outLength:Math.hypot(outgoing.x,outgoing.y)};
 const first=a.pointJunctions?.[offset],second=b.pointJunctions?.[0];if(first||second)merged.pointJunctions[offset]=first||second;
 if(first&&second&&first!==second)for(const it of items.concat(merged))for(const i of Object.keys(it.pointJunctions||{}))if(it.pointJunctions[i]===second)it.pointJunctions[i]=first;
 merged.autoTrace=true;
}
function syncAutoJunctions(){
 const groups=autoJunctionMembers();for(const key of autoJunctionPositions.keys())if(!groups.has(key))autoJunctionPositions.delete(key);
 for(const [key,members] of groups){
  const prior=autoJunctionPositions.get(key),changed=prior?members.filter(m=>Math.hypot(m.p.x-prior.x,m.p.y-prior.y)>.001):[],chosen=members.find(m=>m.it.locked)||changed.find(m=>m.it.id===selected)||changed[0]||members[0],p={...chosen.p};
  for(const member of members)member.it.points[member.index]={...p};autoJunctionPositions.set(key,p);
 }
}
function autoJunctionOverlay(){
 const it=byId(selected);if(!it?.pointJunctions)return'';
 const junctions=Object.keys(it.pointJunctions).map(Number).filter(i=>it.points[i]).map(i=>`<circle class="auto-junction-marker" cx="${it.points[i].x}" cy="${it.points[i].y}" r="11" fill="none" stroke="#f97316" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"><title>共用分岔接點：移動時支線一起接合</title></circle>`).join('');
 return junctions+Object.entries(it.autoTraceReview||{}).filter(([i])=>it.points[i]).map(([i,message])=>`<circle class="auto-review-marker" cx="${it.points[i].x}" cy="${it.points[i].y}" r="14" fill="none" stroke="#ff2438" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"><title>${esc(message)}</title></circle>`).join('');
}
function autoTraceReviews(){return items.flatMap(it=>Object.keys(it.autoTraceReview||{}).map(Number).filter(i=>it.points?.[i]).map(index=>({it,index})))}
function syncAutoJunctionControls(){const it=byId(selected),button=document.getElementById('detach-auto-junction'),reviews=autoTraceReviews();button.hidden=!it?.pointJunctions?.[selectedPoint];document.getElementById('confirm-auto-junction').hidden=!it?.autoTraceReview?.[selectedPoint];const next=document.getElementById('next-auto-review');next.hidden=!reviews.length;next.textContent=`下一個待確認（${reviews.length}）`;document.getElementById('simplify-curve-count').textContent=it?.type==='arrow'?`目前 ${it.points.length} 個錨點`:'';document.getElementById('simplify-curve').disabled=it?.type!=='arrow'||it.points.length<4||!!it.explicitBezier||!!traceDraft||selectedIds.size>1||!!it.regionFill}
function simplifySelectedCurve(){
 const it=byId(selected),input=document.getElementById('simplify-curve-error');if(it?.type!=='arrow'||it.points.length<4||it.explicitBezier||traceDraft||selectedIds.size>1||it.regionFill)return;
 if(!input.value.trim()||!input.checkValidity()){document.getElementById('status').textContent='精簡誤差請輸入 0.1～6';return}
 try{const before=it.points.length,curves=fillBoundaryPath(it)?.segments||[],result=AutoTrace.simplifyItem(it,curves,Number(input.value));if(!result){document.getElementById('status').textContent=`目前 ${before} 點已在這個誤差內足夠精簡；沒有修改線條`;return}
 commit();Object.assign(it,result);selectedPoint=null;selectedSegment=null;selectedPoints.clear();localSmoothSession=null;editPoints=true;render();document.getElementById('status').textContent=`錨點已精簡：${before} → ${it.points.length} 點；端點、分岔和尖角保留，可按復原`;
 }catch(error){document.getElementById('status').textContent=`未修改線條：${error.message||error}`}
}
function nextAutoTraceReview(){const reviews=autoTraceReviews();if(!reviews.length)return;const {it,index}=reviews[autoTraceReviewCursor++%reviews.length];setOnlySelected(it.id);selectedPoint=index;selectedPoints.add(index);render();const p=it.points[index],m=svg.getScreenCTM(),rect=stageWrap.getBoundingClientRect();stageWrap.scrollLeft+=m.a*p.x+m.c*p.y+m.e-rect.left-stageWrap.clientWidth/2;stageWrap.scrollTop+=m.b*p.x+m.d*p.y+m.f-rect.top-stageWrap.clientHeight/2;document.getElementById('status').textContent=it.autoTraceReview[index]+'；確認後可按「這個接點已確認」'}
function confirmAutoTraceReview(){const it=byId(selected);if(!it?.autoTraceReview?.[selectedPoint])return;commit();delete it.autoTraceReview[selectedPoint];render();document.getElementById('status').textContent='已移除此處待確認標記；線條與接合關係沒有改動'}
function detachAutoJunction(){const it=byId(selected);if(!it?.pointJunctions?.[selectedPoint])return;commit();delete it.pointJunctions[selectedPoint];render();document.getElementById('status').textContent='已解除這個分岔端點；現在可以獨立移動或刪點，其餘支線保持連接'}
document.getElementById('arrow-controls').insertAdjacentHTML('afterbegin','<section class="sparse-curve-controls" aria-label="精簡錨點"><strong id="simplify-curve-count"></strong><label for="simplify-curve-error">精簡誤差（畫布單位）</label><input id="simplify-curve-error" type="number" min="0.1" max="6" step="0.1" value="1.5"><button id="simplify-curve" type="button">精簡這條線的錨點</button><small>合併多餘短段成長弧；保留端點、分岔與尖角，不強迫每條線都變 3 點。可復原。</small></section>');
document.getElementById('simplify-curve').onclick=simplifySelectedCurve;
document.getElementById('point-style-controls').insertAdjacentHTML('afterbegin','<button id="detach-auto-junction" type="button" hidden>解除這個分岔接點</button><button id="confirm-auto-junction" type="button" hidden>這個接點已確認</button>');
document.getElementById('empty').insertAdjacentHTML('beforebegin','<button id="next-auto-review" type="button" hidden>下一個待確認</button>');
document.getElementById('next-auto-review').onclick=nextAutoTraceReview;
document.getElementById('confirm-auto-junction').onclick=confirmAutoTraceReview;
document.getElementById('detach-auto-junction').onclick=detachAutoJunction;
document.getElementById('auto-trace').onclick=openAutoTrace;
document.getElementById('auto-trace-apply').onclick=applyAutoTrace;
document.getElementById('auto-trace-cancel').onclick=cancelAutoTrace;
autoTraceDialog.addEventListener('cancel',e=>{e.preventDefault();cancelAutoTrace()});
for(const id of ['auto-trace-threshold','auto-trace-accuracy','auto-trace-simplify','auto-trace-min-length'])document.getElementById(id).addEventListener('input',invalidateAutoTrace);
document.getElementById('auto-trace-mode').addEventListener('change',invalidateAutoTrace);
document.getElementById('auto-trace-reset').onclick=resetAutoTraceSettings;
updateAutoTraceSettings();
document.getElementById('auto-trace-show-image').onchange=e=>{document.getElementById('auto-trace-image').style.display=e.target.checked?'':'none'};
document.getElementById('auto-trace-show-anchors').onchange=e=>{document.getElementById('auto-trace-anchors').style.display=e.target.checked?'':'none'};
document.getElementById('auto-trace-lines').onclick=inspectAutoTraceCurve;
document.getElementById('auto-trace-lines').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspectAutoTraceCurve(e)}};
document.getElementById('auto-trace-show-issues').onchange=e=>{document.getElementById('auto-trace-issues').style.display=e.target.checked?'':'none'};
