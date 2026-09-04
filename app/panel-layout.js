/* Resizable editor panes. Geometry stays in CSS variables so resizing never
 * touches the document model, undo history, or PowerPoint preparation cache. */
const PANEL_LAYOUT_STORAGE = 'skechu-panel-layout-v1';
let panelResizeGesture = null;

function panelClamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function panelLayoutElements() {
  return {workspace:document.querySelector('.workspace'), sidebar:document.querySelector('.sidebar'),
    inspector:document.querySelector('.inspector')};
}
function readPanelLayout() {
  try { return JSON.parse(localStorage.getItem(PANEL_LAYOUT_STORAGE) || '{}'); } catch (_) { return {}; }
}
function savePanelLayout() {
  const {workspace,sidebar,inspector}=panelLayoutElements(); if(!workspace)return;
  const state={left:sidebar?.getBoundingClientRect().width||236,right:inspector?.getBoundingClientRect().width||282,
    sidebarSplit:Number(workspace.dataset.sidebarSplit)||.5,inspectorSplit:Number(workspace.dataset.inspectorSplit)||.5};
  try { localStorage.setItem(PANEL_LAYOUT_STORAGE,JSON.stringify(state)); } catch (_) {}
}
function applyPanelLayout(state={}) {
  const {workspace}=panelLayoutElements(); if(!workspace)return;
  if(Number.isFinite(state.left))workspace.style.setProperty('--left-panel-width',panelClamp(state.left,180,480)+'px');
  if(Number.isFinite(state.right))workspace.style.setProperty('--right-panel-width',panelClamp(state.right,220,520)+'px');
  for(const [key,variable] of [['sidebarSplit','--sidebar-top'],['inspectorSplit','--inspector-top']]){
    const ratio=panelClamp(Number(state[key])||.5,.2,.8);workspace.dataset[key]=String(ratio);
    workspace.style.setProperty(variable,`calc(${ratio*100}% - 3px)`);
  }
}
function resizePanelAt(kind,clientX,clientY) {
  const {workspace,sidebar,inspector}=panelLayoutElements(),rect=workspace?.getBoundingClientRect();if(!rect)return;
  if(kind==='left'||kind==='right'){
    const other=kind==='left'?(inspector?.getBoundingClientRect().width||282):(sidebar?.getBoundingClientRect().width||236);
    const desired=kind==='left'?clientX-rect.left:rect.right-clientX;
    const min=kind==='left'?180:220,max=Math.max(min,Math.min(kind==='left'?480:520,rect.width-other-332));
    workspace.style.setProperty(kind==='left'?'--left-panel-width':'--right-panel-width',panelClamp(desired,min,max)+'px');
    return;
  }
  const pane=kind==='sidebar-split'?sidebar:inspector,paneRect=pane?.getBoundingClientRect();if(!paneRect)return;
  const ratio=panelClamp((clientY-paneRect.top)/Math.max(1,paneRect.height),.2,.8),key=kind==='sidebar-split'?'sidebarSplit':'inspectorSplit';
  workspace.dataset[key]=String(ratio);workspace.style.setProperty(kind==='sidebar-split'?'--sidebar-top':'--inspector-top',`calc(${ratio*100}% - 3px)`);
}
function finishPanelResize(event) {
  const gesture=panelResizeGesture;if(!gesture||event&&event.pointerId!==gesture.pointerId)return;
  panelResizeGesture=null;gesture.handle.classList.remove('dragging');
  if(gesture.handle.hasPointerCapture(gesture.pointerId))gesture.handle.releasePointerCapture(gesture.pointerId);
  savePanelLayout();
}
function initializePanelLayout() {
  applyPanelLayout(readPanelLayout());
  document.querySelectorAll('[data-panel-resize]').forEach(handle=>{
    handle.addEventListener('pointerdown',event=>{if(event.button!==0||panelResizeGesture)return;event.preventDefault();
      panelResizeGesture={kind:handle.dataset.panelResize,pointerId:event.pointerId,handle};handle.classList.add('dragging');handle.setPointerCapture(event.pointerId)});
    handle.addEventListener('pointermove',event=>{if(panelResizeGesture?.pointerId!==event.pointerId)return;event.preventDefault();resizePanelAt(panelResizeGesture.kind,event.clientX,event.clientY)});
    handle.addEventListener('pointerup',finishPanelResize);handle.addEventListener('pointercancel',finishPanelResize);handle.addEventListener('lostpointercapture',finishPanelResize);
    handle.addEventListener('dblclick',()=>{const state=readPanelLayout();if(handle.dataset.panelResize==='left')state.left=236;else if(handle.dataset.panelResize==='right')state.right=282;
      else state[handle.dataset.panelResize==='sidebar-split'?'sidebarSplit':'inspectorSplit']=.5;applyPanelLayout(state);savePanelLayout()});
    handle.addEventListener('keydown',event=>{const kind=handle.dataset.panelResize,horizontal=kind.includes('split');
      if(horizontal&&!['ArrowUp','ArrowDown'].includes(event.key)||!horizontal&&!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();const box=handle.getBoundingClientRect(),step=event.shiftKey?40:12;
      resizePanelAt(kind,box.left+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),box.top+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0));savePanelLayout()});
  });
  window.addEventListener('blur',()=>finishPanelResize());
}
