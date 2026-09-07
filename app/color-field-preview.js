/* Isolated experiment UI. Never creates editor items or a native PPT payload. */
const ColorFieldPreview=(()=>{
 const $=id=>document.getElementById(id),svg=$('auto-trace-svg');
 let sourceKey=null,sourceSize=null,region=null,drag=null,selecting=false;
 const enabled=()=>autoTracePurpose==='fill'&&$('auto-trace-mode').value==='field2d-preview';
 const notice='僅供二維填色預覽；尚未自動辨識物件輪廓、套用到畫布或匯出 PPT。原圖與作品不會改動。';
 $('auto-trace-mode-hint').insertAdjacentHTML('afterend',`<section id="auto-field-controls" hidden aria-label="二維填色實驗預覽">
  <p class="auto-field-notice">一個指定範圍使用一份二維色場。這是填色核心測試，不是已完成的自動分區或 PPT 匯出功能。</p>
  <div class="auto-field-toolbar">
   <button id="auto-field-select" type="button" aria-pressed="false">框選局部</button>
   <button id="auto-field-overview" type="button">查看全圖</button>
   <button id="auto-field-reset" type="button">重設範圍</button>
   <label>品質 <select id="auto-field-quality"><option value="balanced">快速預覽</option><option value="detail" selected>細節優先</option></select></label>
   <label><input id="auto-field-original" type="checkbox"> 對照原圖</label>
  </div>
  <details class="auto-field-numeric"><summary>指定範圍（原圖像素，也可用鍵盤輸入）</summary>
   <div>${[['x','X'],['y','Y'],['w','寬'],['h','高']].map(([id,name])=>`<label>${name}<input id="auto-field-${id}" aria-label="二維範圍${name}" type="number" min="${id==='x'||id==='y'?0:4}" step="1"></label>`).join('')}<button id="auto-field-region-apply" type="button">預覽此範圍</button></div>
  </details>
 </section>`);

 function info(){if(enabled())$('auto-trace-anchor-info').textContent=notice}
 function sync(){
  const on=enabled();autoTraceDialog.toggleAttribute('data-field-preview',on);
  $('auto-field-controls').hidden=!on;$('auto-trace-advanced').hidden=on;
  if(on){
   $('auto-trace-description').textContent='二維填色實驗：在指定範圍內連續擬合多方向光影，先比較原圖與預覽。';
   $('auto-trace-mode-hint').textContent='選「框選局部」後在圖上拖曳，例如圈住眼睛。完成後會放大預覽；用「查看全圖」選其他位置。尚未支援套用與 PPT。';
   $('auto-trace-apply').textContent='實驗預覽 · 尚不能套用';$('auto-trace-apply').disabled=true;
   $('auto-trace-legend').textContent='二維色場預覽';info();
  }else{
   selecting=false;drag=null;svg.classList.remove('auto-field-selecting');
   $('auto-field-select').setAttribute('aria-pressed','false');
   $('auto-trace-lines').style.display='';
   $('auto-trace-image').style.display=$('auto-trace-show-image').checked?'':'none';
   if(autoTracePurpose==='fill')$('auto-trace-description').textContent='從底圖取色，只建立無邊框的封閉色塊，放進「自動填色」群組。已有線稿不變；色塊可各自編輯。';
  }
 }
 function invalidate(){
  if(enabled()){
   $('auto-trace-lines').innerHTML='';$('auto-trace-issues').innerHTML='';
   delete $('auto-field-controls').dataset.ready;delete $('auto-field-controls').dataset.stats;
  }
 }
 function cancel(){
  drag=null;selecting=false;sourceSize=null;sourceKey=null;region=null;
  $('auto-field-select').setAttribute('aria-pressed','false');svg.classList.remove('auto-field-selecting');
  delete $('auto-field-controls').dataset.ready;
 }
 function fillInputs(){
  if(!sourceSize)return;const r=region||{x:0,y:0,w:sourceSize.w,h:sourceSize.h};
  for(const key of ['x','y','w','h'])$('auto-field-'+key).value=r[key];
 }
 function viewRegion(){
  if(!sourceSize)return;const r=region||{x:0,y:0,w:sourceSize.w,h:sourceSize.h};
  clipSource(r);
  svg.setAttribute('viewBox',`${r.x} ${r.y} ${r.w} ${r.h}`);
 }
 function clipSource(r){const clip=$('auto-field-image-clip');if(clip)for(const key of ['x','y','w','h'])clip.setAttribute(key==='w'?'width':key==='h'?'height':key,r[key])}
 function overview(){if(sourceSize){clipSource({x:0,y:0,w:sourceSize.w,h:sourceSize.h});svg.setAttribute('viewBox',`0 0 ${sourceSize.w} ${sourceSize.h}`)}}
 function compare(){if(enabled())$('auto-trace-lines').style.display=$('auto-field-original').checked?'none':''}
 function createWorker(){
  if(typeof URL.createObjectURL!=='function'&&location.protocol!=='file:')return new Worker('color-field-worker.js?v=85-field-preview');
  const url=URL.createObjectURL(new Blob([SkechuColorField.workerSource()],{type:'text/javascript'}));
  try{const job=new Worker(url),stop=job.terminate.bind(job);job.terminate=()=>{stop();URL.revokeObjectURL(url)};return job}
  catch(error){URL.revokeObjectURL(url);throw error}
 }
 async function generate(serial){
  const current=()=>serial===autoTraceSerial&&enabled()&&autoTraceDialog.open&&autoTraceSource;
  const ref=autoTraceSource.ref,im=new Image();im.src=ref.src;await im.decode();if(!current())return;
  const key=ref.id+'|'+ref.src;
  if(key!==sourceKey){sourceKey=key;region=null;sourceSize={w:im.naturalWidth,h:im.naturalHeight}}
  if(sourceSize.w<4||sourceSize.h<4)throw Error('二維實驗預覽需要至少 4 × 4 像素的底圖');
  autoTraceSource.width=sourceSize.w;autoTraceSource.height=sourceSize.h;
  $('auto-trace-image').innerHTML=`<defs><clipPath id="auto-field-source-clip" clipPathUnits="userSpaceOnUse"><rect id="auto-field-image-clip" width="${sourceSize.w}" height="${sourceSize.h}"/></clipPath></defs><image href="${esc(ref.src)}" width="${sourceSize.w}" height="${sourceSize.h}" opacity="1" clip-path="url(#auto-field-source-clip)"/>`;
  $('auto-trace-image').style.display='';$('auto-trace-anchors').innerHTML='';$('auto-trace-issues').innerHTML='';
  fillInputs();viewRegion();compare();
  const r=region||{x:0,y:0,w:sourceSize.w,h:sourceSize.h};
  // Work on at most 90,000 samples. The crop is explicit user input, not an
  // automatic semantic detector. A small selected region retains its source
  // resolution; large regions are clearly labelled as downsampled previews.
  const scale=Math.min(1,300/Math.max(r.w,r.h)),w=Math.max(2,Math.round(r.w*scale)),h=Math.max(2,Math.round(r.h*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(im,r.x,r.y,r.w,r.h,0,0,w,h);
  const data=context.getImageData(0,0,w,h).data;
  const summary=$('auto-trace-summary');summary.textContent='正在擬合二維色場…';
  const job=createWorker();autoTraceJob=job;
  const failed=message=>{if(!current())return;job.terminate();if(autoTraceJob===job)autoTraceJob=null;setAutoTraceBusy(false);info();invalidate();summary.textContent=message};
  job.onerror=event=>failed('二維預覽無法啟動：'+(event.message||'請重新整理再試'));
  job.onmessage=event=>{
   if(!current())return;const message=event.data;
   if(message.type==='progress'){summary.textContent=`${message.stage}（${message.percent}%）`;return}
   if(message.type==='error'){failed(message.message);return}
   try{
    job.terminate();if(autoTraceJob===job)autoTraceJob=null;setAutoTraceBusy(false);info();
    const output=document.createElement('canvas');output.width=message.width;output.height=message.height;
    output.getContext('2d').putImageData(new ImageData(message.rgba,message.width,message.height),0,0);
    $('auto-trace-lines').innerHTML=`<image data-color-field-result="true" href="${output.toDataURL('image/png')}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="none"/>`;
    compare();
    const stats=message.stats;
    summary.textContent=`1 份二維色場 · ${stats.controls.toLocaleString()} 個內部色彩控制點 · ${w} × ${h} 取樣${scale<1?'（縮圖；框選局部可保留細節）':''}${stats.reason==='control-budget'?' · 已達預覽運算上限':''}`;
    $('auto-field-controls').dataset.ready='true';$('auto-field-controls').dataset.stats=JSON.stringify({...stats,region:{...r},downsampled:scale<1});
    $('auto-trace-apply').disabled=true;
   }catch(error){failed('二維預覽未完成：'+error.message)}
  };
  job.postMessage({width:w,height:h,data,quality:$('auto-field-quality').value},[data.buffer]);
 }

 function setRegion(r){
  if(!sourceSize||![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.x<0||r.y<0||r.w<4||r.h<4||r.x+r.w>sourceSize.w||r.y+r.h>sourceSize.h){
   $('auto-trace-summary').textContent='範圍需在原圖內，且寬、高至少 4 像素';return false;
  }
  region=r;selecting=false;svg.classList.remove('auto-field-selecting');$('auto-field-select').setAttribute('aria-pressed','false');
  $('auto-field-original').checked=false;fillInputs();invalidateAutoTrace();return true;
 }
 function point(event){
  const matrix=svg.getScreenCTM();if(!matrix||!sourceSize)return null;
  const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
  return {x:Math.max(0,Math.min(sourceSize.w,p.x)),y:Math.max(0,Math.min(sourceSize.h,p.y))};
 }
 function rect(a,b){const x=Math.floor(Math.min(a.x,b.x)),y=Math.floor(Math.min(a.y,b.y));return {x,y,w:Math.ceil(Math.max(a.x,b.x))-x,h:Math.ceil(Math.max(a.y,b.y))-y}}
 svg.addEventListener('pointerdown',event=>{
  if(!enabled()||!selecting||drag||event.button!==0||!sourceSize)return;
  const p=point(event);if(!p)return;event.preventDefault();event.stopPropagation();drag={...p,id:event.pointerId};svg.setPointerCapture(event.pointerId);
 });
 svg.addEventListener('pointermove',event=>{
  if(!drag||drag.id!==event.pointerId)return;event.preventDefault();const p=point(event);if(!p)return;const r=rect(drag,p);
  $('auto-trace-issues').innerHTML=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#7c3aed22" stroke="#7c3aed" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
 });
 svg.addEventListener('pointerup',event=>{
  if(!drag||drag.id!==event.pointerId)return;event.preventDefault();const a=drag,p=point(event);drag=null;
  if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);
  $('auto-trace-issues').innerHTML='';if(p)setRegion(rect(a,p));
 });
 const abortDrag=()=>{drag=null;$('auto-trace-issues').innerHTML=''};
 svg.addEventListener('pointercancel',abortDrag);svg.addEventListener('lostpointercapture',()=>{if(drag)abortDrag()});
 $('auto-field-select').onclick=()=>{selecting=!selecting;drag=null;svg.classList.toggle('auto-field-selecting',selecting);$('auto-field-select').setAttribute('aria-pressed',String(selecting));if(selecting){overview();$('auto-trace-summary').textContent='在圖上拖曳框選範圍；放開後會放大並計算二維填色。'}};
 $('auto-field-overview').onclick=overview;
 $('auto-field-reset').onclick=()=>{region=null;fillInputs();$('auto-field-original').checked=false;invalidateAutoTrace()};
 $('auto-field-quality').onchange=invalidateAutoTrace;
 $('auto-field-original').onchange=compare;
 $('auto-field-region-apply').onclick=()=>{if(['x','y','w','h'].some(k=>$('auto-field-'+k).value.trim()==='')){$('auto-trace-summary').textContent='請填入完整的原圖範圍';return}setRegion(Object.fromEntries(['x','y','w','h'].map(k=>[k,Math.round(Number($('auto-field-'+k).value))])))};
 sync();return {enabled,sync,info,invalidate,cancel,generate};
})();
