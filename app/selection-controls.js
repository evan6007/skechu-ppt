/* Selection gestures are separate from edits: clicking never consumes Undo. */
const SELECTION_DRAG_PX = 4;
let suppressSelectionContextMenu = false;
function refreshSelectionUI() {
  renderSelection(); renderLayers(); syncControls(); syncSplitHandleLengthControls();
}
function selectionSnapshot() {
  return {selected, ids: [...selectedIds], points: [...selectedPoints], selectedPoint, selectedSegment, editPoints};
}
function restoreSelectionSnapshot(snapshot) {
  selected = snapshot.selected; selectedIds = new Set(snapshot.ids);
  selectedPoints = new Set(snapshot.points); selectedPoint = snapshot.selectedPoint;
  selectedSegment = snapshot.selectedSegment; editPoints = snapshot.editPoints;
}
function clearSelectionState(refresh = true) {
  selected = selectedPoint = selectedSegment = null;
  selectedIds.clear(); selectedPoints.clear(); editPoints = false;
  snapLines = []; snapAnchors = []; hotAnchor = traceSnapTarget = null;
  document.getElementById('context-menu').hidden = true;
  if (refresh) { refreshSelectionUI(); document.getElementById('status').textContent = '已取消全部選取'; }
}
function selectableOnCanvas(it) { return !!it && !it.locked && !it.referenceOnly; }
function ownsSelectionPointer(event) { return !drag || drag.pointerId === event.pointerId; }
function registerSelectionGesture(event, before, capture = svg) {
  Object.assign(drag, {pointerId: event.pointerId, startClient: {x: event.clientX, y: event.clientY},
    selectionBefore: before, capture, moved: false});
  capture.setPointerCapture(event.pointerId);
}
function beginBackgroundSelection(event, capture = svg) {
  if (drag || tracePenOn || paintTool) return;
  if (event.button === 2) { beginRightSelection(event, capture); return; }
  if (event.button !== 0) return;
  const before = selectionSnapshot();
  event.preventDefault();
  if (!event.shiftKey) clearSelectionState(false);
  drag = {kind: 'blank'};
  marqueeRect = null; registerSelectionGesture(event, before, capture); refreshSelectionUI();
  if (!event.shiftKey) document.getElementById('status').textContent = '已取消全部選取；按住右鍵拖曳可框選';
}
function selectionContextTarget(event) {
  return event.target.closest('[data-id]')?.dataset.id ||
    (event.target.closest('[data-handle],[data-segment],[data-action]') ? selected : null);
}
function showSelectionContextMenu(id, x, y) {
  if (!selectableOnCanvas(byId(id))) { document.getElementById('context-menu').hidden = true; return; }
  if (!selectedIds.has(id)) select(id);
  showLineContextMenu(x, y);
}
function beginRightSelection(event, capture = svg) {
  if (event.button !== 2 || drag || tracePenOn || paintTool) return;
  event.preventDefault(); suppressSelectionContextMenu = true;
  const before = selectionSnapshot();
  drag = {kind: 'marquee', start: svgPt(event), additive: event.shiftKey,
    pointOwner: before.ids.length === 1 && byId(before.selected)?.points ? before.selected : null,
    contextTarget: selectionContextTarget(event)};
  document.getElementById('context-menu').hidden = true;
  marqueeRect = null; registerSelectionGesture(event, before, capture);
}
function handleSelectionContextMenu(event) {
  event.preventDefault();
  if (suppressSelectionContextMenu && event.button === 2 || drag?.kind === 'marquee') return;
  showSelectionContextMenu(selectionContextTarget(event), event.clientX, event.clientY);
}
function beginSelectionPointerDown(event, {action, h, g, before}) {
  if (![0, 1].includes(event.button)) return;
  event.preventDefault();
  if (event.button === 1) {
    drag = {kind: 'pan', left: stageWrap.scrollLeft, top: stageWrap.scrollTop};
    stageWrap.classList.add('panning');
  } else if (action) {
    const a = action.dataset.action;
    if (a === 'add-arrow-point') addNodeToSelected(false);
    else if (a === 'remove-arrow-point') removeNodeFromSelected(2);
    else if (a === 'add-poly-point') addNodeToSelected(true);
    else if (a === 'remove-poly-point') removeNodeFromSelected(3);
    return;
  } else if (h) {
    const it = byId(selected); if (!selectableOnCanvas(it)) return;
    selectedSegment = null;
    const hasPoint = h.dataset.point != null, index = hasPoint ? Number(h.dataset.point) : null;
    const anchor = ['arrow-point', 'poly-point'].includes(h.dataset.handle);
    const already = hasPoint && selectedPoints.has(index);
    const pendingPointToggle = anchor && event.shiftKey && already;
    const pendingPointSingle = anchor && !event.shiftKey && already && selectedPoints.size > 1;
    if (hasPoint) {
      if (event.shiftKey && anchor) selectedPoints.add(index);
      else if (!already) selectedPoints = new Set([index]);
      selectedPoint = index;
    } else { selectedPoint = null; selectedPoints.clear(); }
    drag = {kind: h.dataset.handle, id: selected, point: index, start: svgPt(event), base: deepCopy(it),
      pendingPointToggle, pendingPointSingle, reachOffset: Number(h.dataset.reachOffset) || 0,
      handleCenter: {x: Number(h.getAttribute('cx')), y: Number(h.getAttribute('cy'))}};
  } else if (g && selectableOnCanvas(byId(g.dataset.id))) {
    const id = g.dataset.id, already = selectedIds.has(id), changed = selected !== id;
    const pendingShiftToggle = event.shiftKey && already;
    const pendingSingle = !event.shiftKey && already && selectedIds.size > 1;
    if (event.shiftKey) selectedIds.add(id);
    else if (!already) selectedIds = new Set([id]);
    // A locked layer may be inspected in the layer list, but not moved with a group.
    selectedIds = new Set([...selectedIds].filter(key => selectableOnCanvas(byId(key))));
    selected = id;
    if (changed) { selectedPoint = selectedSegment = null; selectedPoints.clear(); }
    editPoints = byId(id).type === 'polygon';
    const bases = Object.fromEntries([...selectedIds].map(key => [key, deepCopy(byId(key))]));
    drag = {kind: selectedIds.size > 1 ? 'move-group' : 'move', id, start: svgPt(event),
      base: deepCopy(byId(id)), bases, pendingShiftToggle, pendingSingle};
  } else { beginBackgroundSelection(event); return; }
  registerSelectionGesture(event, before); refreshSelectionUI();
  if (drag.id) document.getElementById('status').textContent = drag.point == null ? `已選取：${byId(drag.id).name}` : `已選取錨點 ${drag.point + 1}；Shift 可增選或取消`;
}
function advanceSelectionGesture(event) {
  if (!drag || !ownsSelectionPointer(event)) return false;
  if (!drag.moved) {
    if (Math.hypot(event.clientX - drag.startClient.x, event.clientY - drag.startClient.y) < SELECTION_DRAG_PX) return false;
    drag.moved = true;
    if (drag.kind === 'marquee' && !drag.additive) { clearSelectionState(false); refreshSelectionUI(); }
    if (!['pan', 'marquee', 'blank'].includes(drag.kind)) {
      drag.stateBefore = state(); drag.historyBefore = history.slice(); drag.futureBefore = future.slice();
      commit();
    }
  }
  return true;
}
function beginSegmentSelection(event, segment, before) {
  const id = selected;
  if (!selectableOnCanvas(byId(id))) return;
  beginSelectionPointerDown(event, {g: {dataset: {id}}, before});
  if (!drag) return;
  drag.pendingSegment = Number(segment.dataset.segment);
  selectedSegment = drag.pendingSegment; selectedPoint = null; selectedPoints.clear();
  refreshSelectionUI();
  document.getElementById('status').textContent = `已選取第 ${selectedSegment + 1} 段；按 ＋ 插入錨點，按住拖曳可移動物件`;
}
function finishSelectionMarquee(rect, gesture) {
  const inside = p => p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
  const owner = byId(gesture.pointOwner);
  const hits = selectableOnCanvas(owner) ? owner.points.map((p, i) => inside(p) ? i : -1).filter(i => i >= 0) : [];
  if (hits.length) {
    selected = owner.id; selectedIds = new Set([selected]);
    selectedPoints = new Set([...(gesture.additive ? gesture.selectionBefore.points : []), ...hits]);
    selectedPoint = hits.at(-1); selectedSegment = null; editPoints = true;
    document.getElementById('status').textContent = `已框選 ${selectedPoints.size} 個頂點`;
  } else {
    const ids = items.filter(it => {
      if (!selectableOnCanvas(it)) return false;
      const b = itemBounds(it); return inside({x: b.x, y: b.y}) && inside({x: b.x + b.w, y: b.y + b.h});
    }).map(it => it.id);
    selectedIds = new Set([...(gesture.additive ? gesture.selectionBefore.ids.filter(id => selectableOnCanvas(byId(id))) : []), ...ids]);
    selected = [...selectedIds].at(-1) || null;
    selectedPoint = selectedSegment = null; selectedPoints.clear(); editPoints = byId(selected)?.type === 'polygon';
    document.getElementById('status').textContent = `已框選 ${selectedIds.size} 個物件`;
  }
}
function finishSelectionGesture(event, cancel = false) {
  const gesture = drag;
  if (!gesture || event && !ownsSelectionPointer(event)) return;
  drag = null;
  if (cancel) {
    if (gesture.stateBefore != null) {
      items = JSON.parse(gesture.stateBefore); history = gesture.historyBefore; future = gesture.futureBefore;
      autoJunctionPositions.clear();
    }
    restoreSelectionSnapshot(gesture.selectionBefore);
  } else {
    if (gesture.kind === 'marquee' && gesture.moved && marqueeRect) finishSelectionMarquee(marqueeRect, gesture);
    if (!gesture.moved) {
      if (gesture.pendingShiftToggle) {
        selectedIds.delete(gesture.id); selected = [...selectedIds].at(-1) || null;
        selectedPoint = selectedSegment = null; selectedPoints.clear();
      } else if (gesture.pendingSingle) { selectedIds = new Set([gesture.id]); selected = gesture.id; }
      if (gesture.pendingPointToggle) {
        selectedPoints.delete(gesture.point); selectedPoint = [...selectedPoints].at(-1) ?? null;
      } else if (gesture.pendingPointSingle) { selectedPoints = new Set([gesture.point]); selectedPoint = gesture.point; }
    }
    if (Number.isInteger(gesture.pendingSegment)) selectedSegment = !gesture.moved && selected === gesture.id ? gesture.pendingSegment : null;
    if (gesture.stateBefore != null && state() === gesture.stateBefore) {
      history = gesture.historyBefore; future = gesture.futureBefore;
    }
  }
  marqueeRect = null; snapLines = []; snapAnchors = []; hotAnchor = traceSnapTarget = null;
  stageWrap.classList.remove('panning');
  if (gesture.capture.hasPointerCapture(gesture.pointerId)) gesture.capture.releasePointerCapture(gesture.pointerId);
  if (gesture.stateBefore != null) render(); else refreshSelectionUI();
  if (!cancel && gesture.kind === 'marquee' && !gesture.moved) showSelectionContextMenu(gesture.contextTarget, event.clientX, event.clientY);
  if (cancel) document.getElementById('status').textContent = '已取消拖曳，物件保持原位';
}
function selectLayerFromEvent(event, id) {
  activateSelectTool();
  if (!event.shiftKey) { select(id); return; }
  if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
  selected = selectedIds.has(id) ? id : [...selectedIds].at(-1) || null;
  selectedPoint = selectedSegment = null; selectedPoints.clear(); editPoints = byId(selected)?.type === 'polygon';
  refreshSelectionUI(); document.getElementById('status').textContent = `已選取 ${selectedIds.size} 個物件`;
}
function initializeSelectionControls() {
  stageWrap.addEventListener('pointerdown', () => { suppressSelectionContextMenu = false; }, true);
  stageWrap.addEventListener('contextmenu', event => {
    if (!event.target.closest('#stage')) handleSelectionContextMenu(event);
  });
  stageWrap.addEventListener('pointerdown', event => {
    if (event.target.closest('#stage')) return;
    const rect = stageWrap.getBoundingClientRect();
    if (event.clientX >= rect.left + stageWrap.clientWidth || event.clientY >= rect.top + stageWrap.clientHeight) return;
    beginBackgroundSelection(event, stageWrap);
  });
  stageWrap.addEventListener('pointermove', event => { if (drag?.capture === stageWrap) handleCanvasPointerMove(event); });
  stageWrap.addEventListener('pointerup', event => { if (drag?.capture === stageWrap) finishSelectionGesture(event); });
  for (const target of [svg, stageWrap]) for (const type of ['pointercancel', 'lostpointercapture']) {
    target.addEventListener(type, event => { if (drag?.capture === target) finishSelectionGesture(event, true); });
  }
  window.addEventListener('blur', () => finishSelectionGesture(null, true));
  window.addEventListener('keydown', event => {
    if (!drag || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable) return;
    event.preventDefault(); event.stopImmediatePropagation(); finishSelectionGesture(null, true);
  }, true);
}
