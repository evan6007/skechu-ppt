/* Shared vector icons and a touch-sized shell. Document edits still use the
 * editor's existing commands, history, locking, and autosave paths. */
const EDITOR_ICONS = {
  select: '<path d="m5 3 14 9-7 1-3 7Z"/>',
  pen: '<path d="m15 4 5 5-11 11-6 1 1-6Z M13 6l5 5 M4 15l5 5"/>',
  trace: '<path d="M5 18C5 5 19 19 19 6"/><rect x="3" y="16" width="4" height="4" rx="1"/><rect x="17" y="4" width="4" height="4" rx="1"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  text: '<path d="M5 6V4h14v2 M12 4v16 M8 20h8"/>',
  shape: '<rect x="3" y="3" width="11" height="11" rx="1"/><circle cx="16" cy="16" r="5"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="7" y="7" width="10" height="10" rx="1"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h10a6 6 0 0 1 0 12"/>',
  redo: '<path d="m16 4 5 5-5 5m5-5h-10a6 6 0 0 0 0 12"/>',
  all: '<rect x="5" y="5" width="14" height="14" rx="1"/><path d="M3 7V3h4m10 0h4v4M3 17v4h4m10 0h4v-4"/>',
  pages: '<rect x="7" y="3" width="14" height="15" rx="2"/><path d="M17 21H5a2 2 0 0 1-2-2V7"/>',
  layers: '<path d="m3 8 9-5 9 5-9 5Z M3 12l9 5 9-5 M3 16l9 5 9-5"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.7 1.7 0 0 1 1-3.1h2A4 4 0 0 0 21 10c0-4-4-7-9-7Z"/><circle cx="7" cy="11" r=".8"/><circle cx="10" cy="7" r=".8"/><circle cx="15" cy="7" r=".8"/>',
  properties: '<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  delete: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  done: '<path d="m5 12 4 4L19 6"/>',
};
let mobileEditorUi = null;
function editorIcon(name) {
  return `<svg class="editor-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${EDITOR_ICONS[name] || ''}</svg>`;
}
function mobileSheetFor(name) {
  return ['pages', 'palette'].includes(name) ? 'assets' : ['layers', 'properties'].includes(name) ? 'inspector' : null;
}
function toggleMobileSheet(name) {
  if (!mobileEditorUi?.media.matches || !mobileSheetFor(name)) return;
  const open = workspace.dataset.mobileSheet !== name;
  closeMobilePanels();
  if (open) {
    workspace.dataset.mobileSheet = name;
    workspace.classList.add(`show-${mobileSheetFor(name)}`);
  }
  syncMobilePanels();
}
function syncMobilePanels() {
  if (!mobileEditorUi) return;
  const mobile = mobileEditorUi.media.matches;
  if (!workspace.classList.contains('show-assets') && !workspace.classList.contains('show-inspector')) delete workspace.dataset.mobileSheet;
  const mode = workspace.dataset.mobileSheet;
  for (const [name, button] of Object.entries(mobileEditorUi.tabs)) {
    const active = mobile && mode === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-expanded', String(active));
  }
  mobileEditorUi.sidebar.inert = mobile && mobileSheetFor(mode) !== 'assets';
  mobileEditorUi.inspector.inert = mobile && mobileSheetFor(mode) !== 'inspector';
  mobileEditorUi.sidebar.querySelector('.mobile-sheet-title').textContent = mode === 'palette' ? '顏色' : '圖頁';
  mobileEditorUi.inspector.querySelector('.mobile-sheet-title').textContent = mode === 'properties' ? '物件設定' : '圖層';
}
function syncMobileControls() {
  if (!mobileEditorUi) return;
  const chosen = items.filter(it => selectedIds.has(it.id));
  const editable = chosen.filter(it => !it.locked);
  mobileEditorUi.actions.hidden = !chosen.length && !traceDraft;
  mobileEditorUi.count.textContent = traceDraft ? '描圖中' : `${chosen.length} 個物件${editable.length ? '' : '・已鎖定'}`;
  mobileEditorUi.remove.disabled = !editable.length || !!traceDraft;
  mobileEditorUi.duplicate.disabled = !editable.length || !!traceDraft;
  mobileEditorUi.remove.hidden = mobileEditorUi.duplicate.hidden = !!traceDraft;
  mobileEditorUi.finish.hidden = !traceDraft;
  mobileEditorUi.tabs.properties.disabled = !chosen.length;
  mobileEditorUi.undo.disabled = !history.length;
  mobileEditorUi.redo.disabled = !future.length;
}
function initializeMobileControls() {
  // These replace OS-dependent text glyphs on every platform, without changing
  // the desktop layout or the commands behind its buttons.
  const icons = {'select-tool':'select','trace-pen':'pen','auto-trace':'trace','add-arrow':'arrow',
    'add-text':'text','add-shape':'shape','toggle-grid':'grid','fit-view':'fit',
    undo:'undo',redo:'redo','select-all':'all'};
  for (const [id, name] of Object.entries(icons)) {
    const host = document.querySelector(`#${id} .tool-icon`);
    if (host) host.innerHTML = editorIcon(name);
  }
  for (const button of document.querySelectorAll('.topbar .tool-button')) {
    const label = button.querySelector('.tool-text')?.textContent.trim();
    if (label && !button.hasAttribute('aria-label')) button.setAttribute('aria-label', label);
  }
  const makeButton = (id, icon, label) => {
    const button = document.createElement('button');
    button.type = 'button'; button.id = id; button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = `${editorIcon(icon)}<span>${label}</span>`;
    return button;
  };
  const dock = document.createElement('nav');
  dock.className = 'mobile-editor-dock'; dock.setAttribute('aria-label', '手機編輯工具');
  const tabs = {};
  const undoButton = makeButton('mobile-undo', 'undo', '復原');
  const redoButton = makeButton('mobile-redo', 'redo', '重做');
  undoButton.onclick = () => { document.getElementById('undo').click(); syncMobileControls(); };
  redoButton.onclick = () => { document.getElementById('redo').click(); syncMobileControls(); };
  dock.append(undoButton);
  for (const [name, id, icon, label] of [
    ['pages','show-assets','pages','圖頁'], ['palette','mobile-palette','palette','顏色'],
    ['layers','show-inspector','layers','圖層'], ['properties','mobile-properties','properties','屬性'],
  ]) {
    const button = document.getElementById(id) || makeButton(id, icon, label);
    button.innerHTML = `${editorIcon(icon)}<span>${label}</span>`;
    button.className = 'mobile-dock-tab'; button.title = label;
    button.setAttribute('aria-label', label); button.setAttribute('aria-controls', `mobile-${mobileSheetFor(name)}-panel`);
    button.onclick = () => toggleMobileSheet(name);
    tabs[name] = button; dock.append(button);
  }
  dock.append(redoButton); document.querySelector('.app').append(dock);
  const sidebar = document.querySelector('.sidebar'), inspector = document.querySelector('.inspector');
  for (const [panel, name] of [[sidebar,'assets'],[inspector,'inspector']]) {
    panel.id = `mobile-${name}-panel`;
    const heading = document.createElement('div'); heading.className = 'mobile-sheet-heading';
    const title = document.createElement('strong'); title.className = 'mobile-sheet-title';
    const close = makeButton(`mobile-close-${name}`, 'close', '關閉面板');
    close.onclick = () => {
      const tab = tabs[workspace.dataset.mobileSheet]; closeMobilePanels(); tab?.focus();
    };
    heading.append(title, close); panel.prepend(heading);
  }
  const actions = document.createElement('div'); actions.className = 'mobile-selection-actions';
  actions.setAttribute('role','group'); actions.setAttribute('aria-label','選取物件操作');
  const count = document.createElement('span'); count.className = 'mobile-selection-count';
  const duplicate = makeButton('mobile-duplicate','copy','複製');
  const remove = makeButton('mobile-delete','delete','刪除'); remove.className = 'danger';
  const finish = makeButton('mobile-finish-trace','done','完成');
  const clear = makeButton('mobile-clear-selection','close','取消');
  duplicate.onclick = () => { document.getElementById('duplicate').click(); syncMobileControls(); };
  remove.onclick = () => { deleteSelectedObjects(); syncMobileControls(); };
  finish.onclick = () => { finishTraceDraft(); syncMobileControls(); };
  clear.onclick = () => { if (traceDraft) cancelTraceDraft(); else clearSelectionState(); syncMobileControls(); };
  actions.append(count, duplicate, remove, finish, clear); workspace.append(actions);
  const zoomTools = document.createElement('div'); zoomTools.className = 'mobile-zoom-controls';
  zoomTools.setAttribute('role','group'); zoomTools.setAttribute('aria-label','畫布縮放');
  for (const [id, icon, label, action] of [
    ['mobile-zoom-out','minus','縮小',() => applyZoom(zoom / 1.25)],
    ['mobile-fit','fit','適合',() => fitView()],
    ['mobile-zoom-in','plus','放大',() => applyZoom(zoom * 1.25)],
  ]) { const button = makeButton(id,icon,label); button.onclick = action; zoomTools.append(button); }
  workspace.append(zoomTools);
  const media = window.matchMedia('(max-width: 900px)');
  mobileEditorUi = {media, sidebar, inspector, tabs, actions, count, duplicate, remove, finish, undo:undoButton, redo:redoButton};
  media.addEventListener('change', () => { closeMobilePanels(); syncMobileControls(); });
  let viewportWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === viewportWidth) return; // Ignore the software keyboard opening.
    viewportWidth = window.innerWidth;
    if (media.matches && workspaceReady) fitView();
  });
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && media.matches) closeMobilePanels(); });
  // Draft strokes render directly for speed, without a full inspector refresh.
  stageWrap.addEventListener('pointerup', syncMobileControls);
  syncMobilePanels(); syncMobileControls();
}
