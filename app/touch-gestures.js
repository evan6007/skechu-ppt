/* Two fingers navigate the viewport, never the document. Capture on window so
 * this takes priority over selection, hand, tracing and paint handlers. */
let canvasTouchNavigation = false;
function touchPairGeometry(points) {
  const [a,b] = [...points.values()];
  return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))};
}
function captureTouchEdit() {
  return {project:activeProjectId,page:activePageId,items:state(),history:history.slice(),future:future.slice(),
    selection:selectionSnapshot(),draft:deepCopy(traceDraft),paintTool,tracePenOn,color:activePaletteColor,
    routeValid:traceRouteValid,joinMode:traceJoinMode,
    svgClass:svg.getAttribute('class'),wrapClass:stageWrap.className,
    buttons:['paint-bucket','palette-eyedropper','resize-reference','pan-tool'].map(id=>{
      const el=document.getElementById(id);return {el,className:el.className,pressed:el.getAttribute('aria-pressed')};
    })};
}
function restoreTouchEdit(saved) {
  // A page switch while a finger was down must not restore a different page.
  if (!saved || saved.project!==activeProjectId || saved.page!==activePageId) return;
  finishSelectionGesture(null,true); finishReferenceDrag(true); finishHandDrag();
  items=JSON.parse(saved.items);history=saved.history;future=saved.future;
  restoreSelectionSnapshot(saved.selection);traceDraft=saved.draft;
  paintTool=saved.paintTool;tracePenOn=saved.tracePenOn;activePaletteColor=saved.color;
  traceRouteValid=saved.routeValid;traceJoinMode=saved.joinMode;traceSnapTarget=null;
  svg.setAttribute('class',saved.svgClass);stageWrap.className=saved.wrapClass;
  for(const {el,className,pressed} of saved.buttons){el.className=className;el.setAttribute('aria-pressed',pressed);}
  autoJunctionPositions.clear();setFillHover(null);syncPaintColor();render();
}
function touchViewportAnchor(pair) {
  const rect=svg.getBoundingClientRect();
  return {zoom,distance:pair.distance,x:(pair.x-rect.left)/Math.max(1,rect.width),y:(pair.y-rect.top)/Math.max(1,rect.height)};
}
function applyTouchViewport(anchor,pair) {
  zoom=clamp(anchor.zoom*pair.distance/anchor.distance,.35,5);
  stageShell.style.width=(baseStageWidth*zoom)+'px';
  // Measure the actual SVG after layout. This includes the centered auto margin,
  // page border, container padding and current scroll offset at every zoom.
  const rect=svg.getBoundingClientRect();
  setCanvasPan(canvasPan.x+pair.x-(rect.left+anchor.x*rect.width),
    canvasPan.y+pair.y-(rect.top+anchor.y*rect.height));
  document.getElementById('zoom-label').textContent=Math.round(zoom*100)+'%';
  syncCheckerGrid(); // ResizeObserver refreshes the screen-sized handles.
}
function initializeTouchGestures() {
  const points=new Map();let saved=null,anchor=null,frame=0,suppressTouchClick=false;
  const stop=event=>{if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();};
  const flush=()=>{
    if(frame)cancelAnimationFrame(frame);frame=0;
    if(canvasTouchNavigation&&points.size>=2&&anchor)applyTouchViewport(anchor,touchPairGeometry(points));
  };
  const release=id=>{if(stageWrap.hasPointerCapture(id))stageWrap.releasePointerCapture(id);};
  const clear=()=>{
    if(frame)cancelAnimationFrame(frame);frame=0;
    const ids=[...points.keys()];points.clear();saved=null;anchor=null;canvasTouchNavigation=false;
    ids.forEach(release);stageWrap.classList.remove('touch-navigating');
  };
  window.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'&&!points.size)suppressTouchClick=false;
    if(event.pointerType!=='touch'||baseStageWidth<=0||!stageWrap.contains(event.target)||document.getElementById('auto-trace-dialog')?.open)return;
    if(!points.size){suppressTouchClick=false;saved=captureTouchEdit();}
    points.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(points.size<2&&!canvasTouchNavigation)return; // Single finger stays native to the selected tool.
    stop(event);
    if(!canvasTouchNavigation){
      canvasTouchNavigation=true;suppressTouchClick=true;restoreTouchEdit(saved);closeMobilePanels();
      if(wheelFrame)cancelAnimationFrame(wheelFrame);wheelFrame=0;wheelFactor=1;
      stageWrap.classList.add('touch-navigating');
      for(const id of points.keys())try{stageWrap.setPointerCapture(id);}catch{}
      anchor=touchViewportAnchor(touchPairGeometry(points));
    }else{
      try{stageWrap.setPointerCapture(event.pointerId);}catch{}
      if(points.size===2)anchor=touchViewportAnchor(touchPairGeometry(points));
    }
  },{capture:true,passive:false});
  window.addEventListener('pointermove',event=>{
    if(!points.has(event.pointerId))return;
    points.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(!canvasTouchNavigation)return;
    stop(event);
    if(points.size>=2&&!frame)frame=requestAnimationFrame(flush);
  },{capture:true,passive:false});
  const end=(event,cancel=false)=>{
    if(!points.has(event.pointerId))return;
    if(!cancel)points.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(canvasTouchNavigation){
      stop(event);flush();points.delete(event.pointerId);release(event.pointerId);
      anchor=points.size>=2?touchViewportAnchor(touchPairGeometry(points)):null;
      // Do not turn the last remaining finger into an object drag or paint tap.
      if(!points.size){clear();renderSelection();syncMobileControls();}
    }else{
      if(cancel)restoreTouchEdit(saved);
      points.delete(event.pointerId);saved=null;
    }
  };
  window.addEventListener('pointerup',event=>end(event),{capture:true,passive:false});
  window.addEventListener('pointercancel',event=>end(event,true),{capture:true,passive:false});
  for(const type of ['click','dblclick','contextmenu'])window.addEventListener(type,event=>{
    if(suppressTouchClick&&stageWrap.contains(event.target))stop(event);
  },{capture:true,passive:false});
  for(const type of ['blur','pagehide'])window.addEventListener(type,()=>{
    if(points.size&&!canvasTouchNavigation)restoreTouchEdit(saved);
    flush();clear();
  });
  window.addEventListener('resize',()=>{
    if(!points.size)return;
    if(!canvasTouchNavigation)restoreTouchEdit(saved);
    clear(); // A rotation/viewport resize establishes a new fit/anchor.
  });
  // Prevent Safari's page-level magnification only over the drawing viewport;
  // browser zoom and scrolling elsewhere in the interface remain available.
  for(const type of ['gesturestart','gesturechange','gestureend'])stageWrap.addEventListener(type,event=>{
    if(event.cancelable)event.preventDefault();
  },{passive:false});
}
