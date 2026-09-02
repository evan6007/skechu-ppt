/* Persistent bucket, unobstructed reference sampling, and non-destructive image sizing. */
let paintTool = null, referenceDrag = null, colorSample = null, colorSampleSource = null;
let colorPickerSerial = 0, colorPickerReturn = null;

function resetPaintTools() {
  paintTool = null; colorPickerSerial++; colorSample = null; colorSampleSource = null;
  if (referenceDrag) finishReferenceDrag(true);
  for (const [id, cls] of [['paint-bucket', 'paint-bucket'], ['palette-eyedropper', 'color-picker'], ['resize-reference', 'reference-edit']]) {
    const button = document.getElementById(id);
    button?.classList.remove('active'); button?.setAttribute('aria-pressed', 'false');
    document.getElementById('stage')?.classList.remove(cls);
  }
  for (const id of ['color-loupe', 'color-sample-cross']) { const el = document.getElementById(id); if (el) el.hidden = true; }
  if (typeof setFillHover === 'function') setFillHover(null);
}

function paintStatus(message) { document.getElementById('status').textContent = message; }
function syncPaintColor() {
  const chip = document.getElementById('paint-current-color');
  if (!chip) return;
  chip.style.setProperty('--active-paint', activePaletteColor);
  chip.querySelector('span').textContent = activePaletteColor.toUpperCase();
  document.getElementById('palette-custom-color').value = activePaletteColor;
}
function setPaintTool(mode) {
  setTracePen(false); // Ends a draft and resets all mutually exclusive modes.
  paintTool = mode;
  if (mode) {
    const id = {bucket: 'paint-bucket', picker: 'palette-eyedropper', reference: 'resize-reference'}[mode];
    document.getElementById(id).classList.add('active');
    document.getElementById(id).setAttribute('aria-pressed', 'true');
    document.getElementById('select-tool').classList.remove('active');
    document.getElementById('select-tool').setAttribute('aria-pressed', 'false');
    svg.classList.add({bucket: 'paint-bucket', picker: 'color-picker', reference: 'reference-edit'}[mode]);
  }
  renderSelection();
}
function activatePaintBucket() {
  if (paintTool === 'bucket') { activateSelectTool(); return; }
  setPaintTool('bucket'); syncPaintColor();
  paintStatus('油漆桶：選好色票後可連續點封閉區域（含 T 型接線）；Esc 或「選取」退出');
}
function activateReferenceResize() {
  if (paintTool === 'reference') { activateSelectTool(); return; }
  const current = byId(selected), ref = current?.referenceOnly ? current : items.find(it => it.type === 'image' && it.referenceOnly);
  if (!ref) { paintStatus('請先匯入描圖底圖'); return; }
  setPaintTool('reference'); setOnlySelected(ref.id); render();
  paintStatus('調整底圖：拖四角等比例縮放，拖中央移動；Shift 可自由縮放。只改底圖，Esc 完成');
}
function referenceEditMarkup(it) {
  const corners = [['tl', it.x, it.y], ['tr', it.x + it.w, it.y], ['bl', it.x, it.y + it.h], ['br', it.x + it.w, it.y + it.h]];
  return `<g transform="rotate(${it.r || 0} ${it.x + it.w / 2} ${it.y + it.h / 2})"><rect class="reference-move" data-reference-corner="move" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}"/>${corners.map(([key, x, y]) => `<circle class="reference-resize-hit" data-reference-corner="${key}" cx="${x}" cy="${y}" r="18"/><circle class="reference-resize-dot" cx="${x}" cy="${y}" r="7"/>`).join('')}</g>`;
}
function finishReferenceDrag(cancel = false) {
  const gesture = referenceDrag; if (!gesture) return;
  referenceDrag = null;
  if (cancel && gesture.committed) {
    const ref = byId(gesture.id); if (ref) Object.assign(ref, gesture.base);
    history.pop(); future = gesture.future;
  }
  if (svg.hasPointerCapture(gesture.pointerId)) svg.releasePointerCapture(gesture.pointerId);
  render();
}

async function activateColorPicker() {
  if (paintTool === 'picker') { activateSelectTool(); return; }
  const refs = items.filter(it => it.type === 'image' && it.referenceOnly);
  if (!refs.length) { paintStatus('請先匯入底圖，再使用「底圖取色」；一般顏色仍可從色框選擇'); return; }
  const returnMode = paintTool === 'bucket' ? 'bucket' : null;
  setPaintTool('picker'); colorPickerReturn = returnMode;
  const serial = ++colorPickerSerial;
  paintStatus('正在準備底圖原色…');
  try {
    const sources = await Promise.all(refs.map(async ref => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => { im.onload = resolve; im.onerror = reject; im.src = ref.src; });
      const canvas = document.createElement('canvas'); canvas.width = im.naturalWidth; canvas.height = im.naturalHeight;
      const context = canvas.getContext('2d', {willReadFrequently: true});
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(im, 0, 0);
      context.getImageData(0, 0, 1, 1); // Check origin access before the first pointer event.
      return {id: ref.id, canvas, context};
    }));
    if (serial !== colorPickerSerial || paintTool !== 'picker') return;
    colorSampleSource = sources;
    paintStatus('底圖取色：點一下取原始顏色，不受底圖透明度影響；放大鏡在旁邊，Esc 取消');
  } catch (error) {
    if (serial !== colorPickerSerial) return;
    activateSelectTool(); paintStatus('無法讀取底圖顏色，請重新匯入本機圖片');
    console.warn('Reference color sampling unavailable', error);
  }
}
function updateColorSample(event) {
  colorSample = null;
  const loupe = document.getElementById('color-loupe'), cross = document.getElementById('color-sample-cross');
  loupe.hidden = cross.hidden = true;
  if (!colorSampleSource) return;
  const point = svgPt(event);
  for (const source of [...colorSampleSource].reverse()) {
    const ref = byId(source.id); if (!ref) continue;
    const p = unrotatePoint(point, ref);
    const u = (p.x - ref.x) / ref.w, v = (p.y - ref.y) / ref.h;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
    const x = Math.floor(u * source.canvas.width), y = Math.floor(v * source.canvas.height);
    const pixel = source.context.getImageData(x, y, 1, 1).data;
    colorSample = '#' + [...pixel].slice(0, 3).map(c => c.toString(16).padStart(2, '0')).join('');
    const preview = loupe.querySelector('canvas'), ctx = preview.getContext('2d');
    ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 96, 96);
    ctx.drawImage(source.canvas, x - 7, y - 7, 15, 15, 0, 0, 96, 96);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(44, 44, 8, 8);
    ctx.strokeStyle = '#172033'; ctx.lineWidth = 1; ctx.strokeRect(44, 44, 8, 8);
    loupe.querySelector('output').textContent = colorSample.toUpperCase();
    const position = colorLoupePosition(event.clientX, event.clientY, innerWidth, innerHeight);
    loupe.style.left = position.x + 'px'; loupe.style.top = position.y + 'px';
    cross.style.left = event.clientX + 'px'; cross.style.top = event.clientY + 'px';
    loupe.hidden = cross.hidden = false; return;
  }
}
function acceptColorSample(event) {
  updateColorSample(event);
  if (!colorSample) { paintStatus('請點在底圖內取色'); return; }
  const color = colorSample, returnMode = colorPickerReturn;
  rememberPaletteColor(color); syncPaintColor(); setPaintTool(returnMode);
  paintStatus(`已取底圖原色 ${color.toUpperCase()}${returnMode === 'bucket' ? '；油漆桶可繼續連續填色' : '；可拖色票，或開啟油漆桶填色'}`);
}

function initializePaintTools() {
  const bucketIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 8-8 8 8-8 8Z M8 2l5 5 M4 12h16 M21 15s-2 2-2 4a2 2 0 0 0 4 0c0-2-2-4-2-4Z"/></svg>';
  const pickerIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5 M4 16l10-10 4 4L8 20H4Z M14 6l3-3a2 2 0 0 1 3 3l-3 3"/></svg>';
  document.getElementById('palette-grid').insertAdjacentHTML('afterend', `<div class="palette-current" id="paint-current-color"><i></i>目前顏色 <span></span></div><div class="palette-tools"><button id="paint-bucket" type="button" aria-pressed="false" title="連續點封閉區域填色（B）；Esc 退出">${bucketIcon}油漆桶</button><button id="palette-eyedropper" type="button" aria-pressed="false" title="從底圖取原色；放大鏡在游標旁邊（I）">${pickerIcon}底圖取色</button></div>`);
  document.querySelector('.workspace-actions').insertAdjacentHTML('afterend', '<div class="reference-tools"><button id="resize-reference" type="button" aria-pressed="false" title="拖四角等比例縮放底圖；只改底圖，不改線圖"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5 M5 5l5 5 M19 19l-5-5"/></svg>調整底圖大小</button></div>');
  document.querySelector('.palette-tip').innerHTML = '色塊固定在線條下方。<strong>油漆桶</strong>可連續點填；也能拖曳色票。<strong>底圖取色</strong>不遮住游標，Esc 退出工具。';
  document.body.insertAdjacentHTML('beforeend', '<div class="color-loupe" id="color-loupe" hidden><canvas width="96" height="96"></canvas><output></output></div><div class="color-sample-cross" id="color-sample-cross" hidden></div>');
  document.getElementById('paint-bucket').onclick = activatePaintBucket;
  document.getElementById('palette-eyedropper').onclick = activateColorPicker;
  document.getElementById('resize-reference').onclick = activateReferenceResize;
  syncPaintColor();
  svg.addEventListener('pointerdown', event => {
    if (!paintTool || event.button !== 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (paintTool === 'bucket') {
      if (completePaletteDrop(activePaletteColor, event.clientX, event.clientY, event.target)) paintStatus('已填色，線條保留在上方；可繼續點下一個區域，Esc 退出');
    } else if (paintTool === 'picker') acceptColorSample(event);
    else {
      const handle = event.target.closest('[data-reference-corner]'), ref = byId(selected);
      if (!handle || !ref?.referenceOnly) return;
      referenceDrag = {id: ref.id, corner: handle.dataset.referenceCorner, start: svgPt(event), base: deepCopy(ref), pointerId: event.pointerId, committed: false};
      svg.setPointerCapture(event.pointerId);
    }
  }, true);
  svg.addEventListener('pointermove', event => {
    if (!paintTool || drag?.kind === 'pan' || palettePointerDrag) return;
    event.stopImmediatePropagation();
    if (paintTool === 'picker') updateColorSample(event);
    else if (paintTool === 'bucket') setFillHover(fillTargetAt(svgPt(event), event.target)?.id);
    else if (referenceDrag && referenceDrag.pointerId === event.pointerId) {
      const p = svgPt(event), dx = p.x - referenceDrag.start.x, dy = p.y - referenceDrag.start.y;
      if (!referenceDrag.committed && Math.hypot(dx, dy) < .5 * overlayUnit()) return;
      if (!referenceDrag.committed) { referenceDrag.future = future.slice(); commit(); referenceDrag.committed = true; }
      const ref = byId(referenceDrag.id), base = referenceDrag.base;
      if (!ref) { finishReferenceDrag(true); return; }
      Object.assign(ref, referenceDrag.corner === 'move' ? {x: base.x + dx, y: base.y + dy} : resizedReference(base, referenceDrag.corner, dx, dy, event.shiftKey));
      render(); paintStatus(`底圖 ${Math.round(ref.w)} × ${Math.round(ref.h)}；原線圖未變動，Esc 完成`);
    }
  }, true);
  svg.addEventListener('pointerup', event => { if (referenceDrag?.pointerId === event.pointerId) { event.stopImmediatePropagation(); finishReferenceDrag(); } }, true);
  svg.addEventListener('pointercancel', () => finishReferenceDrag(true));
  svg.addEventListener('pointerleave', () => { if (paintTool === 'bucket') setFillHover(null); if (paintTool === 'picker') { colorSample = null; document.getElementById('color-loupe').hidden = document.getElementById('color-sample-cross').hidden = true; } });
  for (const event of ['dblclick', 'contextmenu']) svg.addEventListener(event, e => { if (paintTool) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  window.addEventListener('keydown', event => {
    if (document.getElementById('auto-trace-dialog')?.open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable) return;
    if (event.key === 'Escape' && paintTool) { event.preventDefault(); event.stopImmediatePropagation(); activateSelectTool(); renderSelection(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.key.toLowerCase() === 'b') { event.preventDefault(); activatePaintBucket(); }
    if (event.key.toLowerCase() === 'i') { event.preventDefault(); activateColorPicker(); }
    if (event.key.toLowerCase() === 'v') { event.preventDefault(); activateSelectTool(); renderSelection(); }
  }, true);
}
