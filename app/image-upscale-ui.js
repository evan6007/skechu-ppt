/* Standalone, opt-in browser super-resolution. Original pages stay intact. */
const ImageUpscaleUI=(()=>{
 const $=id=>document.getElementById(id);
 $('import-reference').insertAdjacentHTML('afterend',`<button id="image-upscale" class="tool-button" title="圖片高清：瀏覽器內 2×／4× 放大，不上傳圖片"><span class="tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 16l8-8M10 8h6v6"/></svg></span><span class="tool-text">圖片高清</span></button>`);
 document.body.insertAdjacentHTML('beforeend',`<dialog id="image-upscale-dialog" aria-labelledby="image-upscale-title">
  <header><div><h2 id="image-upscale-title">圖片高清</h2><p>在瀏覽器內放大圖片，保留原圖；圖片不離開裝置</p></div><button id="image-upscale-close" type="button" aria-label="關閉圖片高清">×</button></header>
  <div class="upscale-body">
  <div class="upscale-settings">
   <button id="image-upscale-upload" type="button">選擇圖片</button><input id="image-upscale-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>
   <label>方式<select id="image-upscale-method"><option value="anime">動漫 AI 高清（推薦）</option><option value="resize">一般放大（較快，非 AI）</option></select></label>
   <label>倍率<select id="image-upscale-factor"><option value="2">2×</option><option value="4">4×</option></select></label>
  </div>
  <p id="image-upscale-notice">第一次使用 AI 才下載約 4 MB 引擎與模型。分塊運算降低暫存需求；手機速度依 GPU 而異。AI 推估細節，不保證還原原作。</p>
  <p id="image-upscale-details" class="upscale-details"></p>
  <p id="image-upscale-status" role="status" aria-live="polite">選擇底圖，或按「選擇圖片」。</p><progress id="image-upscale-progress" max="100" value="0" hidden aria-label="高清進度"></progress>
  <div class="upscale-view-controls"><div class="upscale-modes" role="group" aria-label="預覽顯示方式"><button type="button" data-upscale-mode="before" aria-pressed="true">原圖</button><button type="button" data-upscale-mode="split" aria-pressed="false" disabled>對照</button><button type="button" data-upscale-mode="after" aria-pressed="false" disabled>高清</button></div><div class="upscale-zoom-controls"><button id="image-upscale-minus" type="button" aria-label="縮小預覽">−</button><button id="image-upscale-plus" type="button" aria-label="放大預覽">＋</button><button id="image-upscale-fit" type="button" title="回到完整圖片">全圖</button><output id="image-upscale-zoom">100%</output></div></div>
  <div id="image-upscale-preview" class="upscale-preview" data-mode="before">
  <svg id="image-upscale-svg" xmlns="http://www.w3.org/2000/svg" aria-label="高清預覽；拖曳中線比較，拖圖片平移，滾輪或雙指縮放" aria-describedby="image-upscale-help" tabindex="0"><defs><clipPath id="image-upscale-before-clip" clipPathUnits="userSpaceOnUse"><rect id="image-upscale-before-rect"/></clipPath><clipPath id="image-upscale-clip" clipPathUnits="userSpaceOnUse"><rect id="image-upscale-clip-rect"/></clipPath><clipPath id="image-upscale-view-clip" clipPathUnits="userSpaceOnUse"><rect id="image-upscale-view-rect"/></clipPath></defs><g clip-path="url(#image-upscale-view-clip)"><g id="image-upscale-before" clip-path="url(#image-upscale-before-clip)"></g><g id="image-upscale-after" clip-path="url(#image-upscale-clip)"></g><line id="image-upscale-divider" stroke="#ffffff" stroke-width="2" vector-effect="non-scaling-stroke"/><line id="image-upscale-divider-hit" stroke="transparent" stroke-width="36" vector-effect="non-scaling-stroke" pointer-events="stroke"/></g><g id="image-upscale-handle" role="slider" tabindex="0" aria-label="拖曳比較原圖與高清" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" hidden><title>左右拖曳比較，雙擊回到中間；方向鍵也能調整</title><rect class="upscale-handle-hit" x="-24" y="-28" width="48" height="56" rx="24" fill="transparent"/><rect class="upscale-handle-face" x="-23" y="-21" width="46" height="42" rx="21"/><path d="m-7-6-6 6 6 6M7-6l6 6-6 6M0-8v16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>
  <span class="upscale-preview-label upscale-label-before">原圖</span><span class="upscale-preview-label upscale-label-after">高清 · 整張已處理</span>
  <div id="image-upscale-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 16l4-5 3 3 3-4 3 6"/><circle cx="8" cy="8" r="1"/></svg><strong>選一張圖片開始</strong><span>可使用畫布底圖，或拖入 PNG、JPG、WebP</span><button id="image-upscale-empty-upload" type="button">選擇圖片</button></div>
  </div>
  <div class="upscale-compare-controls"><label for="image-upscale-compare">分隔位置</label><input id="image-upscale-compare" type="range" min="0" max="100" value="50" aria-label="原圖與高清分隔位置" disabled><button id="image-upscale-center" type="button" disabled title="分隔線回到中央">置中</button></div>
  <p id="image-upscale-help">開始高清後可對照整張圖片。圖片可拖曳移動，滾輪或雙指可縮放。</p>
  </div>
  <footer><p id="image-upscale-footer-hint">選好方式與倍率，按右下角「開始高清」。原圖不會被覆蓋。</p><div class="upscale-footer-actions"><button id="image-upscale-stop" type="button" hidden>取消運算</button><button id="image-upscale-download" type="button" disabled hidden>下載 PNG</button><button id="image-upscale-start" type="button" class="primary" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg><span>開始高清</span></button><button id="image-upscale-apply" type="button" class="primary" disabled hidden>建立高清圖頁</button></div></footer>
 </dialog>`);
 const dialog=$('image-upscale-dialog'),svg=$('image-upscale-svg');
 let source=null,result=null,job=null,serial=0,busy=false,view=null,mode='split',resizeFrame=0,dropDepth=0;
 const pointers=new Map();let gesture=null;
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function contextOK(s=source){return s&&activeProjectId===s.projectId&&activePageId===s.pageId&&(!s.refId||byId(s.refId)?.src===s.src)}
 function outputPlan(){if(!source)return null;const factor=Number($('image-upscale-factor').value),w=source.w*factor,h=source.h*factor,lowMemory=(navigator.deviceMemory||8)<=4||matchMedia('(max-width:700px)').matches,maxPixels=lowMemory?8000000:16000000;return{w,h,lowMemory,valid:w<=8192&&h<=8192&&w*h<=maxPixels,limit:`${lowMemory?'800':'1600'} 萬像素、單邊 8192`}}
 function state(working){
  busy=working;const plan=outputPlan();$('image-upscale-start').disabled=working||!source||!plan?.valid;
  $('image-upscale-start').querySelector('span').textContent=working?'高清處理中…':result?'重新高清':'開始高清';$('image-upscale-start').classList.toggle('primary',!result);
  $('image-upscale-upload').disabled=working;$('image-upscale-method').disabled=working;$('image-upscale-factor').disabled=working;
  $('image-upscale-stop').hidden=!working;$('image-upscale-progress').hidden=!working;
  $('image-upscale-download').disabled=working||!result;$('image-upscale-apply').disabled=working||!result;
  $('image-upscale-download').hidden=!result;$('image-upscale-apply').hidden=!result;
  $('image-upscale-details').textContent=plan?`${source.w} × ${source.h} → ${plan.w} × ${plan.h}${plan.valid?'':` · 超過此裝置上限（${plan.limit}），請改選較低倍率或較小圖片。`}`:'';
  $('image-upscale-details').classList.toggle('invalid',!!plan&&!plan.valid);
  $('image-upscale-footer-hint').textContent=working?'正在處理整張圖片，可以取消運算；原圖不會改動。':result?'整張高清已完成。可下載 PNG，或建立新圖頁接著描圖／填色；新底圖透明度 50%、不鎖定。':'選好方式與倍率，按右下角「開始高清」。原圖不會被覆蓋。';
  updatePreviewControls();
  svg.setAttribute('aria-busy',String(working));
 }
 function updatePreviewControls(){
  const active=result?mode:'before';$('image-upscale-preview').dataset.mode=active;$('image-upscale-empty').hidden=!!source;
  dialog.querySelectorAll('[data-upscale-mode]').forEach(button=>{button.disabled=button.dataset.upscaleMode==='before'?!source:!result;button.setAttribute('aria-pressed',String(button.dataset.upscaleMode===active))});
  for(const id of ['image-upscale-compare','image-upscale-center'])$(id).disabled=!result||mode!=='split';
  for(const id of ['image-upscale-plus','image-upscale-minus','image-upscale-fit'])$(id).disabled=!source;
  $('image-upscale-help').textContent=result?'整張圖片都已高清，中線只切換對照顯示。拖曳雙箭頭或中線比較；拖圖片平移，滾輪／雙指縮放。':'開始高清後可對照整張圖片。圖片可拖曳移動，滾輪或雙指可縮放。';
 }
 function clearResult(){if(result)URL.revokeObjectURL(result.url);result=null;$('image-upscale-after').innerHTML='';delete dialog.dataset.ready;delete dialog.dataset.stats;updatePreviewControls();updateView()}
 function cancel(){serial++;job?.terminate();job=null;state(false);if(source)$('image-upscale-status').textContent='已取消運算；原圖未改動。'}
 function close(){cancel();clearResult();source=null;view=null;pointers.clear();gesture=null;dropDepth=0;delete dialog.dataset.dragover;cancelAnimationFrame(resizeFrame);$('image-upscale-before').innerHTML='';dialog.close()}
 function updateView(){
  if(!source||!view)return;
  const {w,h}=source;view.w=Math.min(w,Math.max(w/8,view.w));view.h=view.w*h/w;view.x=Math.max(0,Math.min(w-view.w,view.x));view.y=Math.max(0,Math.min(h-view.h,view.y));
  svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
  for(const [k,v] of Object.entries({x:view.x,y:view.y,width:view.w,height:view.h}))$('image-upscale-view-rect').setAttribute(k,v);
  const split=!!result&&mode==='split',ratio=mode==='after'?0:mode==='before'?100:Number($('image-upscale-compare').value),x=view.x+view.w*ratio/100,clip=$('image-upscale-clip-rect');
  clip.setAttribute('x',x);clip.setAttribute('y',0);clip.setAttribute('width',Math.max(0,w-x));clip.setAttribute('height',h);
  for(const [k,v] of Object.entries({x:0,y:0,width:result?x:w,height:h}))$('image-upscale-before-rect').setAttribute(k,v);
  for(const id of ['image-upscale-divider','image-upscale-divider-hit']){for(const [k,v] of Object.entries({x1:x,x2:x,y1:0,y2:h}))$(id).setAttribute(k,v);$(id).style.display=split?'':'none'}
  const handle=$('image-upscale-handle');handle.toggleAttribute('hidden',!split);handle.setAttribute('tabindex',split?'0':'-1');
  if(split){const m=svg.getScreenCTM(),unit=m?1/(Math.hypot(m.a,m.b)||1):1;handle.setAttribute('transform',`translate(${x} ${view.y+view.h/2}) scale(${unit})`);handle.setAttribute('aria-valuenow',$('image-upscale-compare').value);handle.setAttribute('aria-valuetext',`原圖 ${$('image-upscale-compare').value}%，其餘顯示高清`)}
  $('image-upscale-zoom').textContent=Math.round(w/view.w*100)+'%';
 }
 function setMode(next){if(!['before','split','after'].includes(next)||(!result&&next!=='before'))return;mode=next;pointers.clear();gesture=null;updatePreviewControls();updateView()}
 function setCompare(value){$('image-upscale-compare').value=String(Math.max(0,Math.min(100,Math.round(value))));updateView()}
 function fit(){if(source){view={x:0,y:0,w:source.w,h:source.h};updateView()}}
 function zoom(factor,center){if(!view)return;const p=center||{x:view.x+view.w/2,y:view.y+view.h/2},nw=Math.min(source.w,Math.max(source.w/8,view.w/factor)),ratio=nw/view.w;view={x:p.x-(p.x-view.x)*ratio,y:p.y-(p.y-view.y)*ratio,w:nw,h:view.h*ratio};updateView()}
 async function load(src,name,refId=null){
  cancel();clearResult();const token=++serial;source=null;state(false);$('image-upscale-before').innerHTML='';$('image-upscale-status').textContent='正在讀取圖片…';
  const projectId=activeProjectId,pageId=activePageId;
  try{
   const im=new Image();im.src=src;await im.decode();if(token!==serial||!dialog.open)return;
   if(im.naturalWidth<2||im.naturalHeight<2||im.naturalWidth>4096||im.naturalHeight>4096||im.naturalWidth*im.naturalHeight>2100000)throw Error('請使用 2 × 2 至 210 萬像素、單邊不超過 4096 的底圖，避免高清時佔用過多記憶體');
   source={src,name,refId,projectId,pageId,w:im.naturalWidth,h:im.naturalHeight,im};
   $('image-upscale-before').innerHTML=`<image href="${escape(src)}" width="${source.w}" height="${source.h}"/>`;
   $('image-upscale-status').textContent=`${name} · 已載入原圖`;
   mode='split';$('image-upscale-compare').value='50';fit();state(false);
  }catch(error){if(token===serial)$('image-upscale-status').textContent=error.message||String(error)}
 }
 async function open(){
  if(document.querySelector('dialog[open]'))return;
  dialog.showModal();
  const selectedItem=byId(selected),linked=byId(selectedItem?.autoTraceSourceId),ref=selectedItem?.type==='image'?selectedItem:linked?.type==='image'?linked:items.find(it=>it.type==='image'&&it.referenceOnly&&!it.hidden);
  if(ref)await load(ref.src,ref.name||'底圖',ref.id);else{source=null;state(false);$('image-upscale-status').textContent='請按「選擇圖片」開始。'}
 }
 async function start(){
  if(!source||busy)return;const plan=outputPlan();if(!plan.valid){state(false);$('image-upscale-status').textContent='輸出尺寸超過上限，請先調整倍率或圖片。';return}clearResult();const token=++serial,snapshot=source,scale=Number($('image-upscale-factor').value),method=$('image-upscale-method').value;
  state(true);$('image-upscale-progress').value=0;$('image-upscale-status').textContent='正在準備圖片…';
  const current=()=>token===serial&&dialog.open&&source===snapshot;
  const failed=message=>{if(!current())return;job?.terminate();job=null;state(false);$('image-upscale-status').textContent=message};
  try{
   const canvas=document.createElement('canvas');canvas.width=snapshot.w;canvas.height=snapshot.h;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(snapshot.im,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   job=new Worker('image-upscale-worker.js?v=86-browser-hd');
   job.onerror=e=>failed('高清運算無法啟動：'+(e.message||'請重新整理重試'));
   job.onmessage=async event=>{
    if(!current())return;const message=event.data;
    if(message.type==='progress'){$('image-upscale-status').textContent=message.stage;$('image-upscale-progress').value=message.percent;return}
    if(message.type==='error'){failed(message.message);return}
    job.terminate();job=null;
    try{
     const output=document.createElement('canvas');output.width=message.width;output.height=message.height;output.getContext('2d').putImageData(new ImageData(message.data,message.width,message.height),0,0);
     const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(!current())return;if(!blob)throw Error('無法建立高清 PNG');
     result={blob,url:URL.createObjectURL(blob),w:message.width,h:message.height,scale,method,stats:message.stats};
     $('image-upscale-after').innerHTML=`<image href="${result.url}" width="${snapshot.w}" height="${snapshot.h}"/>`;
     $('image-upscale-status').textContent=`高清完成 · ${method==='anime'?'動漫 AI 超解析':'Lanczos 一般放大（非 AI）'} · ${(message.stats.ms/1000).toFixed(1)} 秒`;
     mode='split';$('image-upscale-compare').value='50';dialog.dataset.ready='true';dialog.dataset.stats=JSON.stringify(message.stats);state(false);updateView();
    }catch(error){failed(error.message||String(error))}
   };
   job.postMessage({width:snapshot.w,height:snapshot.h,data,scale,method,lowMemory:plan.lowMemory},[data.buffer]);
  }catch(error){failed(error.message||String(error))}
 }
 async function apply(){
  if(!result||busy)return;if(!contextOK()){$('image-upscale-status').textContent='圖頁或底圖已變更，請關閉後重新開啟，避免加入錯誤圖頁。';return}
  const saved=result,snapshot=source,token=serial;state(true);
  try{
   const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('無法讀取高清結果'));reader.readAsDataURL(saved.blob)});
   if(token!==serial||!contextOK(snapshot)){if(dialog.open&&token===serial)state(false);return}
   const project=activeProject();syncActivePage();const s=Math.min(1,1600/Math.max(saved.w,saved.h)),w=Math.round(saved.w*s),h=Math.round(saved.h*s);
   const name=`${snapshot.name}（高清 ${saved.scale}×）`,ref={id:id(),type:'image',name,src,x:0,y:0,w,h,r:0,opacity:.5,locked:false,referenceOnly:true,preserveFull:true,
    imageEnhancement:{method:saved.method,scale:saved.scale,model:saved.stats.model||null,sourceName:snapshot.name}};
   const page=makePage(name,[ref],{width:w,height:h,...canvasAppearance(activePage())});project.pages.push(page);
   close();openPage(page.id);setOnlySelected(ref.id);render();requestAnimationFrame(fitView);
   $('status').textContent='已建立高清圖頁，原圖頁保留。可接著按「自動描圖」或「自動填色」。';
  }catch(error){if(token===serial){state(false);$('image-upscale-status').textContent=error.message}}
 }
 function changed(){if(busy)return;clearResult();state(false);if(source)$('image-upscale-status').textContent='設定已變更，按右下角「開始高清」運算。';
  $('image-upscale-notice').textContent=$('image-upscale-method').value==='anime'?'第一次使用 AI 才下載約 4 MB 引擎與模型。分塊運算降低暫存需求；手機速度依 GPU 而異。AI 推估細節，不保證還原原作。':'Lanczos 一般放大不下載模型，速度較快、可保留透明度；它是補間放大，不會生成新細節。';
 }
 function point(event){const m=svg.getScreenCTM();return m?new DOMPoint(event.clientX,event.clientY).matrixTransform(m.inverse()):null}
 function gestureStart(){const points=[...pointers.values()],m=svg.getScreenCTM();if(!view||!points.length||!m){gesture=null;return}const a=points[0],b=points[1],center=b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:a;gesture={view:{...view},scale:m.a,origin:{x:m.e+m.a*view.x,y:m.f+m.d*view.y},anchor:new DOMPoint(center.x,center.y).matrixTransform(m.inverse()),distance:b?Math.hypot(a.x-b.x,a.y-b.y):null}}
 function onDivider(e){if(!result||mode!=='split')return false;if(e.target.closest('#image-upscale-handle,#image-upscale-divider-hit,#image-upscale-divider'))return true;const p=point(e),m=svg.getScreenCTM(),x=view.x+view.w*Number($('image-upscale-compare').value)/100;return p&&m&&p.y>=view.y&&p.y<=view.y+view.h&&Math.abs(p.x-x)*Math.hypot(m.a,m.b)<=18}
 svg.addEventListener('pointerdown',e=>{if(!view||e.button!==0)return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});svg.setPointerCapture(e.pointerId);if(pointers.size===1&&onDivider(e)){gesture={kind:'compare'};$('image-upscale-handle').focus({preventScroll:true});svg.dataset.dragging='compare'}else{gestureStart();svg.dataset.dragging='view'}});
 svg.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||!gesture)return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(gesture.kind==='compare'&&pointers.size===1){const p=point(e);if(p)setCompare((p.x-view.x)/view.w*100);return}const points=[...pointers.values()],a=points[0],b=points[1],center=b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:a,factor=b&&gesture.distance?Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,gesture.distance):1,nw=Math.min(source.w,Math.max(source.w/8,gesture.view.w/factor)),scale=gesture.scale*gesture.view.w/nw;view={x:gesture.anchor.x-(center.x-gesture.origin.x)/scale,y:gesture.anchor.y-(center.y-gesture.origin.y)/scale,w:nw,h:nw*source.h/source.w};updateView()});
 const end=e=>{pointers.delete(e.pointerId);if(pointers.size){gestureStart();svg.dataset.dragging='view'}else{gesture=null;delete svg.dataset.dragging}};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('lostpointercapture',end);
 svg.addEventListener('dblclick',e=>{if(onDivider(e)){e.preventDefault();setCompare(50)}});
 svg.addEventListener('wheel',e=>{if(!source)return;e.preventDefault();zoom(Math.exp(-e.deltaY*.0015),point(e))},{passive:false});
 $('image-upscale').onclick=open;$('image-upscale-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 // Modal shortcuts must never delete, copy, or undo the underlying artwork.
 document.addEventListener('keydown',e=>{if(!dialog.open)return;if(e.target.closest?.('#image-upscale-handle')&&result&&mode==='split'){const value=Number($('image-upscale-compare').value),step=e.shiftKey?10:1,next={ArrowLeft:value-step,ArrowRight:value+step,ArrowDown:value-step,ArrowUp:value+step,Home:0,End:100,PageDown:value-10,PageUp:value+10}[e.key];if(next!=null){e.preventDefault();setCompare(next)}}e.stopPropagation()},true);
 document.addEventListener('keyup',e=>{if(dialog.open)e.stopPropagation()},true);
 $('image-upscale-start').onclick=start;$('image-upscale-stop').onclick=cancel;
 $('image-upscale-upload').onclick=()=>$('image-upscale-file').click();
 function loadFile(file){if(!file||busy)return;if(!/image\/(png|jpeg|webp)/i.test(file.type)&&!(/\.(png|jpe?g|webp)$/i.test(file.name)&&!file.type)){$('image-upscale-status').textContent='請選擇 PNG、JPG 或 WebP 圖片。';return}if(file.size>20000000){$('image-upscale-status').textContent='圖片檔案超過 20 MB，請先選較小的圖片';return}const token=++serial,reader=new FileReader();reader.onload=()=>{if(token===serial&&dialog.open)load(reader.result,file.name)};reader.onerror=()=>{if(token===serial&&dialog.open)$('image-upscale-status').textContent='無法讀取圖片'};reader.readAsDataURL(file)}
 $('image-upscale-file').onchange=e=>{const file=e.target.files?.[0];e.target.value='';loadFile(file)};
 $('image-upscale-empty-upload').onclick=()=>$('image-upscale-file').click();
 const hasFile=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
 dialog.addEventListener('dragenter',e=>{if(!hasFile(e))return;e.preventDefault();e.stopPropagation();if(!busy){dropDepth++;dialog.dataset.dragover='true'}});
 dialog.addEventListener('dragover',e=>{if(!hasFile(e))return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect=busy?'none':'copy'});
 dialog.addEventListener('dragleave',e=>{if(!hasFile(e))return;e.stopPropagation();if(--dropDepth<=0){dropDepth=0;delete dialog.dataset.dragover}});
 dialog.addEventListener('drop',e=>{if(!hasFile(e))return;e.preventDefault();e.stopPropagation();dropDepth=0;delete dialog.dataset.dragover;if(busy)return;if(e.dataTransfer.files.length!==1){$('image-upscale-status').textContent='一次選擇一張圖片，完成後再換下一張。';return}loadFile(e.dataTransfer.files[0])});
 $('image-upscale-method').onchange=changed;$('image-upscale-factor').onchange=changed;
 $('image-upscale-compare').oninput=updateView;$('image-upscale-plus').onclick=()=>zoom(1.5);$('image-upscale-minus').onclick=()=>zoom(1/1.5);$('image-upscale-fit').onclick=fit;
 $('image-upscale-center').onclick=()=>setCompare(50);dialog.querySelectorAll('[data-upscale-mode]').forEach(button=>button.onclick=()=>setMode(button.dataset.upscaleMode));
 new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);if(dialog.open)resizeFrame=requestAnimationFrame(updateView)}).observe(svg);
 window.addEventListener('resize',()=>{if(dialog.open){state(busy);updateView()}});
 $('image-upscale-download').onclick=()=>{if(result&&!busy)download(result.blob,(source.name||'image').replace(/\.[^.]+$/,'')+`-hd-${result.scale}x.png`)};
 $('image-upscale-apply').onclick=apply;
 return {open,close};
})();
