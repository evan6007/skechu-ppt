/* View-only hand tool: never edits objects, selection, or undo history. */
let canvasPan = {x: 0, y: 0}, handDrag = null;
function setCanvasPan(x, y) {
  canvasPan = {x, y};
  stageShell.style.transform = x || y ? `translate(${x}px, ${y}px)` : '';
}
function resetCanvasPan() { finishHandDrag(); setCanvasPan(0, 0); }
function finishHandDrag() {
  const gesture = handDrag; handDrag = null;
  stageWrap.classList.remove('hand-dragging');
  if (gesture && stageWrap.hasPointerCapture(gesture.pointerId)) stageWrap.releasePointerCapture(gesture.pointerId);
}
function activateHandTool() {
  if (paintTool === 'pan') { activateSelectTool(); return; }
  setPaintTool('pan');
  paintStatus('拖移工具：按住滑鼠左鍵移動畫布，不會改到物件或錨點；H 切換，V／Esc 回到選取，「適合」置中');
}
function initializeHandTool() {
  document.getElementById('pan-tool').onclick = activateHandTool;
  stageWrap.addEventListener('pointerdown', event => {
    if (paintTool !== 'pan' || event.button !== 0 || handDrag) return;
    event.preventDefault(); event.stopImmediatePropagation();
    handDrag = {pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      pan: {...canvasPan}, left: stageWrap.scrollLeft, top: stageWrap.scrollTop};
    stageWrap.classList.add('hand-dragging'); stageWrap.setPointerCapture(event.pointerId);
  }, true);
  stageWrap.addEventListener('pointermove', event => {
    if (paintTool !== 'pan' || drag?.kind === 'pan') return;
    event.stopImmediatePropagation();
    if (!handDrag || event.pointerId !== handDrag.pointerId) return;
    event.preventDefault();
    setCanvasPan(handDrag.pan.x + event.clientX - handDrag.x + stageWrap.scrollLeft - handDrag.left,
      handDrag.pan.y + event.clientY - handDrag.y + stageWrap.scrollTop - handDrag.top);
  }, true);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stageWrap.addEventListener(type, event => {
      if (event.pointerId !== handDrag?.pointerId) return;
      event.stopImmediatePropagation(); finishHandDrag();
    }, true);
  }
  window.addEventListener('blur', finishHandDrag);
}
