/* Editable linear gradients shared by SVG, project files and native PPT stops.
 * Angle uses Office's clockwise, shape-relative convention: 0=right, 90=down. */
const GradientFill=(()=>{
 const MAX_STOPS=10;
 const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():null;
 function normalize(value){
  if(!value||value.type!=='linear'||typeof value.angle!=='number'||!Number.isFinite(value.angle)||!Array.isArray(value.stops)||value.stops.length<2||value.stops.length>MAX_STOPS)return null;
  const stops=[];
  for(const stop of value.stops){
   if(!stop||!color(stop.color)||typeof stop.position!=='number'||!Number.isFinite(stop.position)||stop.position<0||stop.position>1||typeof stop.opacity!=='number'||!Number.isFinite(stop.opacity)||stop.opacity<0||stop.opacity>1)return null;
   stops.push({color:color(stop.color),position:stop.position,opacity:stop.opacity});
  }
  return{type:'linear',angle:((value.angle%360)+360)%360,stops:stops.sort((a,b)=>a.position-b.position)};
 }
 function endpoints(angle){
  const a=angle*Math.PI/180,x=Math.cos(a),y=Math.sin(a),extent=(Math.abs(x)+Math.abs(y))/2;
  return{x1:.5-x*extent,y1:.5-y*extent,x2:.5+x*extent,y2:.5+y*extent};
 }
 function svg(value,id){
  const gradient=normalize(value);if(!gradient)return null;
  const safe='gradient-'+Array.from(String(id)).map(c=>c.charCodeAt(0).toString(16)).join('-'),p=endpoints(gradient.angle);
  return{fill:`url(#${safe})`,defs:`<defs><linearGradient id="${safe}" gradientUnits="objectBoundingBox" x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" color-interpolation="sRGB">${gradient.stops.map(stop=>`<stop offset="${stop.position}" stop-color="${stop.color}" stop-opacity="${stop.opacity}"/>`).join('')}</linearGradient></defs>`};
 }
 function sample(value,position){
  const gradient=normalize(value);if(!gradient)return{color:'#000000',opacity:1};
  const stops=gradient.stops,first=stops[0],last=stops.at(-1);
  if(position<=first.position)return{...first};if(position>=last.position)return{...last};
  const end=stops.findIndex(s=>s.position>position),a=stops[end-1],b=stops[end],t=(position-a.position)/(b.position-a.position),opacity=a.opacity+(b.opacity-a.opacity)*t;
  const channels=[1,3,5].map(i=>{const x=parseInt(a.color.slice(i,i+2),16),y=parseInt(b.color.slice(i,i+2),16);return Math.round(opacity?((1-t)*x*a.opacity+t*y*b.opacity)/opacity:x)});
  return{color:'#'+channels.map(x=>x.toString(16).padStart(2,'0')).join(''),opacity};
 }
 function initial(base){
  base=color(base)||'#38bdf8';const shade=(target,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(base.slice(i,i+2),16)*(1-t)+target*t).toString(16).padStart(2,'0')).join('');
  return{type:'linear',angle:0,stops:[{position:0,color:shade(0,.55),opacity:1},{position:.5,color:base,opacity:1},{position:1,color:shade(255,.75),opacity:1}]};
 }
 return{MAX_STOPS,color,normalize,endpoints,svg,sample,initial};
})();

let gradientEditorTarget=null,gradientStopIndex=0,gradientEditSession=null,gradientStopDrag=null;
function gradientFillTarget(){
 const ids=selectedIds.size?[...selectedIds]:selected?[selected]:[],it=ids.length===1?byId(ids[0]):null;
 return it&&!it.hidden&&!it.locked&&(['box','ellipse','polygon'].includes(it.type)||it.type==='arrow'&&it.closed)?it:null;
}
function closeGradientEditor(){
 const panel=document.getElementById('gradient-editor');if(panel)panel.hidden=true;
 document.getElementById('gradient-fill')?.setAttribute('aria-expanded','false');gradientEditorTarget=null;gradientEditSession=null;gradientStopDrag=null;
}
function activeGradientEditorItem(){
 const it=gradientFillTarget();return it&&gradientEditorTarget&&it.id===gradientEditorTarget.id&&activeProjectId===gradientEditorTarget.project&&activePageId===gradientEditorTarget.page?it:null;
}
function positionGradientEditor(){
 const panel=document.getElementById('gradient-editor'),button=document.getElementById('gradient-fill');if(!panel||panel.hidden)return;
 if(innerWidth<=700){panel.style.left='';panel.style.top='';return}
 const box=button.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,box.right-panel.offsetWidth))+'px';panel.style.top=Math.max(8,Math.min(innerHeight-panel.offsetHeight-8,box.bottom+8))+'px';
}
function changeGradient(mutator,session=null){
 const it=activeGradientEditorItem();if(!it||!GradientFill.normalize(it.fillGradient)){closeGradientEditor();return false}
 const next=deepCopy(it.fillGradient);mutator(next);
 if(!GradientFill.normalize(next)||JSON.stringify(next)===JSON.stringify(it.fillGradient))return false;
 if(!session||gradientEditSession!==session){commit();gradientEditSession=session}
 it.fillGradient=next;render();return true;
}
function syncGradientFillControls(){
 const panel=document.getElementById('gradient-editor');if(!panel||panel.hidden)return;
 const it=activeGradientEditorItem(),g=it&&GradientFill.normalize(it.fillGradient);if(!g){closeGradientEditor();return}
 gradientStopIndex=Math.min(gradientStopIndex,it.fillGradient.stops.length-1);const stop=it.fillGradient.stops[gradientStopIndex];
 document.getElementById('gradient-object-name').textContent=it.name||'封閉色塊';
 const preview=GradientFill.svg(g,'editor-preview');document.getElementById('gradient-preview').innerHTML=preview.defs+`<rect width="100%" height="100%" fill="${preview.fill}"/>`;
 const strip=GradientFill.svg({...g,angle:0},'editor-stops');document.getElementById('gradient-strip-svg').innerHTML=strip.defs+`<rect width="100%" height="100%" fill="${strip.fill}"/>`;
 // Stable original indices allow a stop to pass its neighbours without jumping selection.
 const host=document.getElementById('gradient-stops');
 if(!gradientStopDrag)host.innerHTML=it.fillGradient.stops.map((s,i)=>`<button type="button" class="gradient-stop" data-stop="${i}" aria-label="色標 ${i+1}，位置 ${Math.round(s.position*100)}%" aria-pressed="${i===gradientStopIndex}" style="left:${s.position*100}%;--stop-color:${s.color}" title="拖動調整位置"><span></span></button>`).join('');
 else host.querySelectorAll('[data-stop]').forEach(node=>{const i=Number(node.dataset.stop),s=it.fillGradient.stops[i];node.style.left=s.position*100+'%';node.setAttribute('aria-pressed',String(i===gradientStopIndex));node.setAttribute('aria-label',`色標 ${i+1}，位置 ${Math.round(s.position*100)}%`)});
 const values={'gradient-color':stop.color,'gradient-position':Math.round(stop.position*1000)/10,'gradient-opacity':Math.round((1-stop.opacity)*100),'gradient-angle':g.angle};
 for(const [id,value] of Object.entries(values)){const input=document.getElementById(id);if(document.activeElement!==input)input.value=String(value)}
 document.getElementById('gradient-stop-title').textContent=`色標 ${gradientStopIndex+1} / ${g.stops.length}`;
 const chooser=document.getElementById('gradient-active-stop');chooser.innerHTML=it.fillGradient.stops.map((s,i)=>`<option value="${i}">色標 ${i+1} · ${Math.round(s.position*100)}%</option>`).join('');chooser.value=String(gradientStopIndex);
 document.getElementById('gradient-opacity-value').textContent=Math.round((1-stop.opacity)*100)+'%';
 document.getElementById('gradient-add-stop').disabled=g.stops.length>=GradientFill.MAX_STOPS;document.getElementById('gradient-delete-stop').disabled=g.stops.length<=2;
 positionGradientEditor();
}
function openGradientEditor(){
 const it=gradientFillTarget();if(traceDraft||drag||!it){document.getElementById('status').textContent='請先選取一個未鎖定的封閉色塊，再使用漸層填色';return}
 if(!document.getElementById('gradient-editor').hidden&&activeGradientEditorItem()===it){closeGradientEditor();return}
 activateSelectTool();
 if(!GradientFill.normalize(it.fillGradient)){commit();it.fillGradient=GradientFill.initial(it.fill);if(it.type==='arrow'&&it.fillOpacity===0)it.fillOpacity=1;else if(it.type!=='arrow'&&it.opacity===0)it.opacity=1;it.fill=GradientFill.color(it.fill)||'#38bdf8';raiseFilledItem(it)}
 gradientEditorTarget={id:it.id,project:activeProjectId,page:activePageId};gradientStopIndex=0;gradientEditSession=null;
 document.getElementById('gradient-editor').hidden=false;document.getElementById('gradient-fill').setAttribute('aria-expanded','true');render();
 document.getElementById('status').textContent='漸層已套用：可拖動色標、增加顏色並調整透明度；每次調整都可復原';
}
function initializeGradientFillControls(){
 document.getElementById('auto-fill').insertAdjacentHTML('afterend','<button id="gradient-fill" class="tool-button" aria-label="漸層填色" aria-expanded="false" aria-controls="gradient-editor" title="選取封閉色塊，設定多色漸層"><span class="tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 7v10M10 7v10M13 7v10M16 7v10M19 7v10" opacity=".6"/><path d="M15 4v16M18 4v16"/></svg></span><span class="tool-text">漸層</span></button>');
 document.body.insertAdjacentHTML('beforeend',`<section id="gradient-editor" role="dialog" aria-modal="false" aria-labelledby="gradient-editor-title" hidden>
  <header><div><strong id="gradient-editor-title">漸層填色</strong><small id="gradient-object-name"></small></div><button id="gradient-close" type="button" aria-label="關閉漸層設定">×</button></header>
  <svg id="gradient-preview" viewBox="0 0 280 56" preserveAspectRatio="none" aria-label="漸層預覽"></svg>
  <div class="gradient-direction"><label for="gradient-angle">線性方向</label><input id="gradient-angle" type="number" min="0" max="359" step="1" value="0" aria-label="漸層角度"><span>°</span><button id="gradient-reverse" type="button">反轉</button></div>
  <div id="gradient-strip"><svg id="gradient-strip-svg" aria-hidden="true"></svg><div id="gradient-stops" aria-label="漸層色標"></div></div>
  <div class="gradient-stop-actions"><strong id="gradient-stop-title" class="sr-only"></strong><select id="gradient-active-stop" aria-label="選擇色標"></select><button id="gradient-add-stop" type="button">＋ 色標</button><button id="gradient-delete-stop" type="button">刪除色標</button></div>
  <div class="gradient-fields"><label>顏色<input id="gradient-color" type="color" aria-label="色標顏色"></label><label>位置 %<input id="gradient-position" type="number" min="0" max="100" step="0.1" aria-label="色標位置"></label></div>
  <label class="gradient-opacity-label" for="gradient-opacity">色標透明度 <output id="gradient-opacity-value">0%</output></label><input id="gradient-opacity" type="range" min="0" max="100" value="0" aria-label="色標透明度">
  <footer><small>即時套用，可復原。最多 10 個色標。</small><button id="gradient-solid" type="button">改回純色</button></footer>
 </section>`);
 document.getElementById('gradient-fill').onclick=openGradientEditor;document.getElementById('gradient-close').onclick=closeGradientEditor;
 document.getElementById('gradient-active-stop').onchange=e=>{gradientStopIndex=Number(e.target.value);gradientEditSession=null;syncGradientFillControls()};
 document.getElementById('gradient-editor').addEventListener('keydown',e=>{
  if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(['Delete','Backspace'].includes(e.key)){e.preventDefault();e.stopPropagation();document.getElementById('gradient-delete-stop').click();return}
  if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){
   e.preventDefault();e.stopPropagation();const target=gradientEditorTarget&&{...gradientEditorTarget};
   document.getElementById(e.key.toLowerCase()==='y'||e.shiftKey?'redo':'undo').click();
   const it=target&&byId(target.id);
   if(it&&!it.locked&&!it.hidden&&target.project===activeProjectId&&target.page===activePageId&&GradientFill.normalize(it.fillGradient)){
    setOnlySelected(it.id);gradientEditorTarget=target;document.getElementById('gradient-editor').hidden=false;document.getElementById('gradient-fill').setAttribute('aria-expanded','true');render();document.querySelector(`#gradient-stops [data-stop="${gradientStopIndex}"]`)?.focus();
   }
  }
 });
 for(const [id,property,convert] of [['gradient-color','color',String],['gradient-position','position',v=>Number(v)/100],['gradient-opacity','opacity',v=>1-Number(v)/100],['gradient-angle','angle',Number]]){
  const input=document.getElementById(id);input.addEventListener('input',()=>{if(!input.value.trim()||!input.checkValidity())return;const token=id+':'+gradientStopIndex;changeGradient(g=>{if(property==='angle')g.angle=convert(input.value);else g.stops[gradientStopIndex][property]=convert(input.value)},token)});
  for(const event of ['change','blur'])input.addEventListener(event,()=>{gradientEditSession=null;syncGradientFillControls()});
 }
 document.getElementById('gradient-add-stop').onclick=()=>{const it=activeGradientEditorItem();if(!it||it.fillGradient.stops.length>=GradientFill.MAX_STOPS)return;const sorted=GradientFill.normalize(it.fillGradient).stops,bounds=[0,...sorted.map(s=>s.position),1];let position=.5,gap=-1;for(let i=1;i<bounds.length;i++)if(bounds[i]-bounds[i-1]>gap){gap=bounds[i]-bounds[i-1];position=(bounds[i]+bounds[i-1])/2}const sampled=GradientFill.sample(it.fillGradient,position);changeGradient(g=>{gradientStopIndex=g.stops.length;g.stops.push({position,color:sampled.color,opacity:sampled.opacity})})};
 document.getElementById('gradient-delete-stop').onclick=()=>{if((activeGradientEditorItem()?.fillGradient.stops.length||0)<=2)return;changeGradient(g=>{g.stops.splice(gradientStopIndex,1);gradientStopIndex=Math.min(gradientStopIndex,g.stops.length-1)})};
 document.getElementById('gradient-reverse').onclick=()=>changeGradient(g=>g.stops.forEach(stop=>stop.position=1-stop.position));
 document.getElementById('gradient-solid').onclick=()=>{const it=activeGradientEditorItem();if(!it)return;commit();it.fill=it.fillGradient.stops[gradientStopIndex].color;delete it.fillGradient;closeGradientEditor();render()};
 const stops=document.getElementById('gradient-stops');
 stops.addEventListener('pointerdown',e=>{const button=e.target.closest('[data-stop]');if(!button||e.button!==0)return;e.preventDefault();gradientStopIndex=Number(button.dataset.stop);gradientEditSession=null;gradientStopDrag={pointer:e.pointerId,button,startX:e.clientX,moved:false};button.setPointerCapture(e.pointerId);syncGradientFillControls()});
 stops.addEventListener('pointermove',e=>{const current=gradientStopDrag;if(!current||e.pointerId!==current.pointer)return;if(!current.moved&&Math.abs(e.clientX-current.startX)<3)return;current.moved=true;const box=stops.getBoundingClientRect(),position=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width));changeGradient(g=>{g.stops[gradientStopIndex].position=Math.round(position*1000)/1000},'drag-stop')});
 const end=e=>{if(!gradientStopDrag||e.pointerId!==gradientStopDrag.pointer)return;gradientStopDrag=null;gradientEditSession=null;syncGradientFillControls();stops.querySelector(`[data-stop="${gradientStopIndex}"]`)?.focus({preventScroll:true})};
 stops.addEventListener('pointerup',end);stops.addEventListener('pointercancel',end);stops.addEventListener('lostpointercapture',end);
 stops.addEventListener('keydown',e=>{const button=e.target.closest('[data-stop]');if(!button)return;gradientStopIndex=Number(button.dataset.stop);if(e.key==='Enter'||e.key===' '){e.preventDefault();syncGradientFillControls()}else if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const amount=(e.key==='ArrowRight'?1:-1)*(e.shiftKey?.1:.01);changeGradient(g=>g.stops[gradientStopIndex].position=Math.max(0,Math.min(1,g.stops[gradientStopIndex].position+amount)));stops.querySelector(`[data-stop="${gradientStopIndex}"]`)?.focus()}});
 document.addEventListener('pointerdown',e=>{if(!document.getElementById('gradient-editor').hidden&&!e.target.closest('#gradient-editor,#gradient-fill'))closeGradientEditor()},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('gradient-editor').hidden){e.preventDefault();e.stopImmediatePropagation();closeGradientEditor();document.getElementById('gradient-fill').focus()}},true);
 window.addEventListener('resize',positionGradientEditor);
}
