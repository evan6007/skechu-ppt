/* Scissors share selection history and native curve data with the editor. */
let cutMode='point',cutGesture=null,cutOverlay=null,freeCutSeparates=true;
let anchorCutContext=null,anchorHold=null,anchorHoldPointer=null,anchorHoldSuppressUntil=0;
function cutPointerPoint(event){const p=svgPt(event);return {x:p.x,y:p.y};}
function constrainedCutEnd(start,end,ctrlKey){
  if(!ctrlKey)return {...end};
  return Math.abs(end.x-start.x)>=Math.abs(end.y-start.y)?{x:end.x,y:start.y}:{x:start.x,y:end.y};
}
function updateStraightCut(gesture,point,ctrlKey){
  gesture.rawPoint=point;
  gesture.points=[gesture.points[0],constrainedCutEnd(gesture.points[0],point,ctrlKey)];
}
function cancelCutGesture() {
  const gesture=cutGesture;cutGesture=null;
  if(gesture&&svg.hasPointerCapture(gesture.pointerId))svg.releasePointerCapture(gesture.pointerId);
  if(cutOverlay)cutOverlay.innerHTML='';
}
function resetCutTool() {
  cancelAnchorHold();resetAnchorCutMenu();
  cancelCutGesture();document.getElementById('cut-options')?.setAttribute('hidden','');
  document.getElementById('cut-tool')?.classList.remove('active');
  document.getElementById('cut-tool')?.setAttribute('aria-pressed','false');
  document.getElementById('stage')?.classList.remove('cut-tool');
}
function cancelAnchorHold(){if(anchorHold)clearTimeout(anchorHold.timer);anchorHold=null;}
function resetAnchorCutMenu(){
  anchorCutContext=null;
  const menu=document.getElementById('context-menu');
  if(menu?.dataset.anchorCut){menu.hidden=true;delete menu.dataset.anchorCut;}
  const button=document.getElementById('cut-anchor');if(button)button.hidden=true;
}
function anchorCutPlan(anchor){
  const entry=cutCandidates().find(entry=>entry.it.id===anchor?.owner),index=anchor?.index;
  if(!entry||!Number.isInteger(index)||!entry.it.points?.[index])return null;
  const {it,boundary}=entry;
  let at;
  if(it.type==='arrow'&&!it.explicitBezier&&boundary.segments.length===it.points.length-(it.closed?0:1))at=index;
  else if(it.type==='arrow'&&it.explicitBezier&&!it.closed&&index%3===0)at=index/3;
  else at=PathCut.closest(boundary,it.points[index])?.at;
  if(!Number.isFinite(at))return null;
  const end=index===0?'start':index===it.points.length-1?'end':null;
  if(!PathCut.ranges(boundary,[at]).length&&!it.pointJunctions?.[index]&&!(end&&it.attachments?.[end]))return null;
  return {...entry,locations:[at]};
}
function showAnchorCutMenu(anchor,x,y){
  const it=byId(anchor?.owner);
  if(!selectableOnCanvas(it)||!['arrow','polygon'].includes(it.type)||!it.points?.[anchor.index])return false;
  selected=it.id;selectedIds=new Set([it.id]);selectedPoint=anchor.index;selectedPoints=new Set([anchor.index]);selectedSegment=null;editPoints=true;
  refreshSelectionUI();
  const menu=document.getElementById('context-menu'),button=document.getElementById('cut-anchor'),plan=anchorCutPlan(anchor);
  anchorCutContext={...anchor,page:activePageId,document:state()};
  button.hidden=false;button.disabled=!plan;button.title=plan?'在此錨點剪開；共用端點會解除接合':'這個端點已分離，或線條目前不可剪開';
  menu.dataset.anchorCut='true';menu.hidden=false;
  const rect=menu.getBoundingClientRect();
  menu.style.left=Math.max(8,Math.min(x,innerWidth-rect.width-8))+'px';
  menu.style.top=Math.max(8,Math.min(y+8,innerHeight-rect.height-8))+'px';
  return true;
}
function cutContextAnchor(){
  const context=anchorCutContext;resetAnchorCutMenu();
  if(!context||context.page!==activePageId||context.document!==state()){paintStatus('錨點已改動，請重新開啟點剪選單');return false;}
  const plan=anchorCutPlan(context);return plan?applyCuts([plan]):false;
}
function initializeAnchorCutMenu(icon){
  document.getElementById('context-menu').insertAdjacentHTML('afterbegin',`<button type="button" id="cut-anchor" hidden>${icon}<span>點剪</span></button>`);
  document.getElementById('cut-anchor').onclick=cutContextAnchor;
  const stop=event=>{if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();};
  window.addEventListener('pointerdown',event=>{
    if(anchorHold&&event.pointerId!==anchorHold.pointerId)cancelAnchorHold();
    if(anchorHoldPointer!==null&&event.pointerId!==anchorHoldPointer){anchorHoldPointer=null;resetAnchorCutMenu();}
  },true);
  svg.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'||event.button!==0||paintTool||tracePenOn||canvasTouchNavigation)return;
    const anchor=selectionContextAnchor(event);if(!anchor||!selectableOnCanvas(byId(anchor.owner)))return;
    cancelAnchorHold();
    const hold={anchor,pointerId:event.pointerId,x:event.clientX,y:event.clientY,page:activePageId,document:state()};
    hold.timer=setTimeout(()=>{
      if(anchorHold!==hold)return;anchorHold=null;
      if(paintTool||tracePenOn||canvasTouchNavigation||hold.page!==activePageId||hold.document!==state())return;
      anchorHoldPointer=hold.pointerId;anchorHoldSuppressUntil=performance.now()+1000;
      finishSelectionGesture(null,true);
      try{svg.setPointerCapture(hold.pointerId);}catch{}
      showAnchorCutMenu(hold.anchor,hold.x,hold.y);
    },500);
    anchorHold=hold;
  },true);
  window.addEventListener('pointermove',event=>{
    if(anchorHold&&event.pointerId===anchorHold.pointerId&&Math.hypot(event.clientX-anchorHold.x,event.clientY-anchorHold.y)>6)cancelAnchorHold();
  },true);
  for(const type of ['pointerup','pointercancel']){
    window.addEventListener(type,event=>{if(anchorHold?.pointerId===event.pointerId)cancelAnchorHold();},true);
    svg.addEventListener(type,event=>{
      if(anchorHoldPointer!==event.pointerId)return;
      stop(event);anchorHoldPointer=null;anchorHoldSuppressUntil=performance.now()+700;
      if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);
      if(type==='pointercancel')resetAnchorCutMenu();
    },true);
  }
  for(const type of ['click','contextmenu'])svg.addEventListener(type,event=>{
    if(anchorHoldPointer!==null||performance.now()<anchorHoldSuppressUntil)stop(event);
  },true);
  window.addEventListener('keydown',event=>{
    if(event.key==='Escape'){cancelAnchorHold();if(anchorCutContext){stop(event);resetAnchorCutMenu();}}
  },true);
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('#context-menu'))resetAnchorCutMenu();});
  for(const type of ['blur','resize','pagehide'])window.addEventListener(type,()=>{cancelAnchorHold();resetAnchorCutMenu();anchorHoldPointer=null;});
}
function activateCutTool(mode=cutMode) {
  setPaintTool('cut');cutMode=mode;
  document.getElementById('cut-options').hidden=false;
  document.querySelectorAll('[data-cut-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.cutMode===mode)));
  syncFreeCutOption();
  paintStatus(mode==='point'?'點剪：點線條剪開；點 T 型共用端點可解除接合。Esc 退出':mode==='line'?'直線切：拖一刀；按住 Ctrl 鎖定水平／垂直。放開滑鼠即顯示錨點，Esc 取消':freeCutSeparates?'自由切：劃過後切成獨立線段；放開滑鼠即顯示錨點，Esc 取消':'自由點：只在劃過處新增錨點，線條保持相連；放開滑鼠即顯示錨點，Esc 取消');
}
function syncFreeCutOption(){
  const row=document.getElementById('cut-free-option'),box=document.getElementById('cut-separate'),label=document.getElementById('cut-free-label');
  row.hidden=cutMode!=='free';box.checked=freeCutSeparates;label.textContent=freeCutSeparates?'自由切':'自由點';
  document.getElementById('cut-options').dataset.freeMode=String(cutMode==='free');
}
function cutCandidates() {
  return items.filter(it=>!it.locked&&!it.hidden&&!it.referenceOnly&&!it.regionFill&&
    (it.type==='arrow'?(it.width??3)>0:['box','ellipse','polygon'].includes(it.type)&&(it.strokeWidth??2)>0)&&
    // Do not indirectly modify a locked line attached to a cut source.
    !items.some(other=>other.locked&&Object.values(other.attachments||{}).some(link=>link.owner===it.id)))
    .map(it=>({it,boundary:fillBoundaryPath(it)})).filter(entry=>entry.boundary?.segments.length)
    .map(entry=>({...entry,boundary:PathCut.prepare(entry.boundary)}));
}
function nearestCutTarget(point,candidates,tolerance) {
  let best=null;
  // Equal-distance hits prefer the selected line, then the topmost line.
  for(const entry of [...candidates].reverse()){
    const hit=PathCut.closest(entry.boundary,point);
    if(hit&&hit.distance<=tolerance&&(!best||hit.distance<best.hit.distance-1e-7||Math.abs(hit.distance-best.hit.distance)<1e-7&&entry.it.id===selected))best={...entry,hit};
  }
  if(best){
    const s=best.boundary.segments[best.hit.index],ends=[{t:0,p:s.p0},{t:1,p:s.p3}].map(end=>({...end,d:Math.hypot(end.p.x-point.x,end.p.y-point.y)})).sort((a,b)=>a.d-b.d);
    // Touch/mouse taps near an existing anchor release that anchor; do not
    // accidentally create a microscopic extra segment next to the junction.
    if(ends[0].d<=tolerance*.5)Object.assign(best.hit,{t:ends[0].t,at:best.hit.index+ends[0].t,point:{...ends[0].p}});
  }
  return best;
}
function cutPreview(points,candidates,pointMode=false,tolerance=0) {
  const hits=pointMode?[nearestCutTarget(points[0],candidates,tolerance)].filter(Boolean).map(entry=>entry.hit):candidates.flatMap(entry=>PathCut.intersections(entry.boundary,points));
  const u=overlayUnit(),color=cutMode==='free'&&!freeCutSeparates?'#25858a':'#f97316';
  cutOverlay.innerHTML=(pointMode?'':`<polyline points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`)+hits.map(hit=>`<circle cx="${hit.point.x}" cy="${hit.point.y}" r="${4*u}" fill="#fff" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('');
}
function capturedCutAttachments(replacements){
  const links=[];
  for(const it of items)for(const [end,link] of Object.entries(it.attachments||{}))if(replacements.has(link.owner))links.push({id:it.id,end,point:{...it.points[end==='start'?0:it.points.length-1]},owner:link.owner});
  return links;
}
function remapCutAttachments(replacements,links){
  for(const link of links){
    const branches=replacements.get(link.id)||[byId(link.id)];
    for(const branch of branches){
      if(!branch?.attachments?.[link.end]||branch.regionFill)continue;
      let best=null;
      for(const part of replacements.get(link.owner).filter(p=>!p.regionFill)){
        const near=nearestPointOnArrow(link.point,part);if(near&&(!best||near.distance<best.near.distance))best={part,near};
      }
      if(best)branch.attachments[link.end]={owner:best.part.id,slot:'path',pathT:best.near.pathT};
      else delete branch.attachments[link.end];
    }
  }
}
function applyFreePoints(plans){
  const replacements=new Map(),added=new Map();
  for(const {it,boundary,locations} of plans){
    const change=PathCut.insertAnchors(it,boundary,locations);
    if(change){replacements.set(it.id,[change.item]);added.set(it.id,change.addedIndices);}
  }
  if(!replacements.size){paintStatus('沒有新增錨點；請劃過線段中間，既有錨點不會重複新增');return false;}
  const links=capturedCutAttachments(replacements);commit();items=items.flatMap(it=>replacements.get(it.id)||[it]);remapCutAttachments(replacements,links);
  autoJunctionPositions.clear();selectedIds=new Set(replacements.keys());selected=[...selectedIds][0];selectedPoints=new Set(added.get(selected));selectedPoint=[...selectedPoints][0]??null;selectedSegment=null;editPoints=true;
  activateSelectTool();render();paintStatus(`已新增 ${[...added.values()].reduce((sum,indices)=>sum+indices.length,0)} 個錨點；線條保持相連，沒有切斷。Ctrl+Z 可復原`);return true;
}
function applyCuts(plans) {
  const replacements=new Map(),newIds=[];
  for(const {it,boundary,locations} of plans){
    const pieces=PathCut.pieces(boundary,locations);
    if(pieces.length){
      const result=pieces.map((piece,i)=>PathCut.toItem(it,boundary,piece,i?id():it.id));
      // Retain an existing color area as its own editable layer when its outline opens.
      if(renderedFillIsVisible(it)){
        const fill=RegionFill.toItem({segments:boundary.segments,key:'cut-fill:'+it.id,owners:[]},id(),it.fill);
        Object.assign(fill,{fillOpacity:it.type==='arrow'?(it.fillOpacity??.25):(it.opacity??1),fillOrder:it.fillOrder,layerGroup:it.layerGroup,name:(it.name||'形狀')+'・保留填色'});
        fill.regionFill.geometry=regionGeometryKey(fill);result.push(fill);
      }
      replacements.set(it.id,result);newIds.push(...result.filter(p=>!p.regionFill).map(p=>p.id));
    }else{
      // An open end cannot split again, but its shared node / attachment can be released.
      const next=deepCopy(it);let changed=false;
      for(const at of locations){
        const index=at<1e-6?0:Math.abs(at-boundary.segments.length)<1e-6?it.points?.length-1:null;
        if(index===null)continue;
        const end=index===0?'start':'end';
        if(next.pointJunctions?.[index]||next.attachments?.[end]){delete next.pointJunctions?.[index];delete next.attachments?.[end];changed=true;}
      }
      if(changed){replacements.set(it.id,[next]);newIds.push(next.id);}
    }
  }
  if(!replacements.size){paintStatus('這一刀沒有切到可編輯的線；已鎖定物件、底圖和純色塊不會被剪開');return false;}
  commit();
  // Remap surviving attached branches to the actual resulting piece, not always piece one.
  const links=capturedCutAttachments(replacements);
  items=items.flatMap(it=>replacements.get(it.id)||[it]);
  remapCutAttachments(replacements,links);
  autoJunctionPositions.clear();selectedIds=new Set(newIds);selected=newIds[0];selectedPoints.clear();selectedPoint=null;selectedSegment=null;editPoints=true;
  activateSelectTool();
  render();paintStatus(`已剪開 ${replacements.size} 條線／接點，得到 ${newIds.length} 段；切口兩端在同一位置，可拖開獨立錨點，Ctrl+Z 可復原`);return true;
}
function initializeCutTools() {
  const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.2 8.2 12 12M8.2 15.8 20 4M12 12l2 2"/></svg>';
  initializeAnchorCutMenu(icon);
  document.getElementById('magnetic-trace').insertAdjacentHTML('afterend',`<button type="button" id="cut-tool" class="tool-button" aria-pressed="false" title="剪刀：點剪、直線切、自由切"><span class="tool-icon">${icon}</span><span class="tool-text">剪刀</span></button>`);
  workspace.insertAdjacentHTML('beforeend',`<div id="cut-options" class="cut-options" role="group" aria-label="剪刀模式" hidden><button type="button" data-cut-mode="point" aria-pressed="true">${icon}點剪</button><button type="button" data-cut-mode="line" aria-pressed="false" title="拖曳剪線；按住 Ctrl 鎖定水平或垂直"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 20 4M3 10h18M3 15h18"/></svg>直線切</button><button type="button" data-cut-mode="free" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20C19 19 2 5 20 4M3 10h18M3 15h18"/></svg>自由切</button></div>`);
  const button=document.getElementById('cut-tool');
  button.onclick=()=>paintTool==='cut'?activateSelectTool():activateCutTool();
  document.querySelectorAll('[data-cut-mode]').forEach(option=>option.onclick=()=>activateCutTool(option.dataset.cutMode));
  const freeButton=document.querySelector('[data-cut-mode="free"]');
  freeButton.innerHTML=freeButton.innerHTML.replace('自由切','<span id="cut-free-label">自由切</span>');
  document.getElementById('cut-options').insertAdjacentHTML('beforeend','<label id="cut-free-option" class="cut-free-option" hidden><input type="checkbox" id="cut-separate" checked><span>畫完直接切斷</span></label>');
  document.getElementById('cut-separate').onchange=event=>{freeCutSeparates=event.target.checked;activateCutTool('free');};
  cutOverlay=document.createElementNS('http://www.w3.org/2000/svg','g');cutOverlay.id='cut-preview';cutOverlay.setAttribute('pointer-events','none');svg.append(cutOverlay);
  const stop=event=>{event.preventDefault();event.stopImmediatePropagation();};
  svg.addEventListener('pointerdown',event=>{
    if(paintTool!=='cut'||event.button!==0)return;stop(event);cancelCutGesture();
    const p=cutPointerPoint(event),candidates=cutCandidates();
    cutGesture={pointerId:event.pointerId,points:[p],rawPoint:p,candidates,tolerance:(event.pointerType==='touch'?20:10)*overlayUnit(),page:activePageId,document:state()};
    svg.setPointerCapture(event.pointerId);cutPreview([p],candidates,true,cutGesture.tolerance);
  },true);
  svg.addEventListener('pointermove',event=>{
    if(paintTool!=='cut')return;stop(event);
    const p=cutPointerPoint(event),g=cutGesture;
    if(!g){cutPreview([p],cutCandidates(),true,10*overlayUnit());return;}
    if(g.pointerId!==event.pointerId)return;
    if(cutMode==='free'){if(Math.hypot(p.x-g.points.at(-1).x,p.y-g.points.at(-1).y)>2*overlayUnit())g.points.push(p);}
    else if(cutMode==='line')updateStraightCut(g,p,event.ctrlKey);
    else g.points=[p];
    cutPreview(g.points,g.candidates,cutMode==='point',g.tolerance);
  },true);
  svg.addEventListener('pointerup',event=>{
    const g=cutGesture;if(!g||g.pointerId!==event.pointerId)return;stop(event);
    const p=cutPointerPoint(event);if(cutMode==='line')updateStraightCut(g,p,event.ctrlKey);else if(cutMode==='free')g.points.push(p);else g.points=[p];
    cancelCutGesture();if(g.page!==activePageId)return;
    if(g.document!==state()){paintStatus('線條在剪線途中已改動，這一刀已取消；請重新剪線');return;}
    if(cutMode==='point'){
      const target=nearestCutTarget(p,g.candidates,g.tolerance);
      applyCuts(target?[{...target,locations:[target.hit.at]}]:[]);
    }else{
      const plans=g.candidates.map(entry=>({...entry,locations:PathCut.intersections(entry.boundary,g.points).map(hit=>hit.at)})).filter(plan=>plan.locations.length);
      if(cutMode==='free'&&!freeCutSeparates)applyFreePoints(plans);else applyCuts(plans);
    }
  },true);
  for(const type of ['pointercancel','lostpointercapture'])svg.addEventListener(type,event=>{if(cutGesture?.pointerId===event.pointerId)cancelCutGesture();},true);
  svg.addEventListener('dblclick',event=>{if(paintTool==='cut')stop(event);},true);
  window.addEventListener('keydown',event=>{
    if(paintTool==='cut'&&event.key==='Escape'){stop(event);if(cutGesture)cancelCutGesture();else activateSelectTool();}
    if(cutGesture&&(event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase()))cancelCutGesture();
  },true);
  for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{
    if(event.key!=='Control'||!cutGesture||cutMode!=='line')return;
    stop(event);updateStraightCut(cutGesture,cutGesture.rawPoint,type==='keydown');
    cutPreview(cutGesture.points,cutGesture.candidates);
  },true);
  window.addEventListener('blur',cancelCutGesture);
}
