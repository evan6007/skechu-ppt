/* Page actions and native paste events. No clipboard polling or remote image fetches. */
let pageClipboard = null, pageMenuTarget = null;
let internalCopyInFocus = false, imagePasteQueue = Promise.resolve();
const PAGE_ACTIONS = [
  ['copy','複製圖頁'], ['duplicate','直接建立副本'], ['paste','貼上圖頁'],
  ['rename','重新命名'], ['new','在下方新增空白圖頁'],
  ['up','上移一頁'], ['down','下移一頁'], ['first','移到最前'], ['last','移到最後'], ['delete','刪除圖頁']
];
function clonePageItems(source) {
  const clones = deepCopy(source), ids = new Map(), junctions = new Map(), networks = new Map();
  clones.forEach(it => {const old = it.id; it.id = id(); ids.set(old, it.id)});
  clones.forEach(it => {
    if (it.attachments) for (const side of Object.keys(it.attachments)) {
      const link = it.attachments[side];
      if (ids.has(link.owner)) link.owner = ids.get(link.owner); else delete it.attachments[side];
    }
    if (it.regionFill) it.regionFill.sources = (it.regionFill.sources || []).filter(key => ids.has(key)).map(key => ids.get(key));
    if (it.pointJunctions) it.pointJunctions = Object.fromEntries(Object.entries(it.pointJunctions).map(([index,key]) => {
      if (!junctions.has(key)) junctions.set(key, uid('junction')); return [index,junctions.get(key)];
    }));
    if (it.networkId) {if (!networks.has(it.networkId)) networks.set(it.networkId, uid('network')); it.networkId = networks.get(it.networkId)}
  });
  cloneLayerGroups(clones);
  return clones;
}
function pageActionDisabled(action, project, page) {
  const index = project?.pages.indexOf(page) ?? -1;
  return !page || action === 'paste' && !pageClipboard || action === 'delete' && project.pages.length <= 1 ||
    ['up','first'].includes(action) && index === 0 || ['down','last'].includes(action) && index === project.pages.length - 1;
}
function closePageMenu() {document.getElementById('page-context-menu').hidden = true; pageMenuTarget = null;}
function showPageMenu(event) {
  const card = event.target.closest('[data-page-id]'), project = activeProject(), page = project?.pages.find(p => p.id === card?.dataset.pageId);
  if (!page) return;
  event.preventDefault(); event.stopPropagation();
  document.getElementById('context-menu').hidden = true;
  pageMenuTarget = {projectId:project.id,pageId:page.id};
  const menu = document.getElementById('page-context-menu');
  menu.innerHTML = `<div class="context-hint">${esc(page.name)}</div>` + PAGE_ACTIONS.map(([action,label]) => `<button type="button" role="menuitem" data-page-action="${action}" ${pageActionDisabled(action,project,page)?'disabled':''} ${action==='delete'?'class="danger"':''}>${label}</button>`).join('');
  menu.hidden = false;
  const rect = menu.getBoundingClientRect();
  const position = event.type === 'keydown' ? card.getBoundingClientRect() : {left:event.clientX,top:event.clientY};
  menu.style.left = Math.max(8,Math.min(position.left,window.innerWidth-rect.width-8))+'px';
  menu.style.top = Math.max(8,Math.min(position.top,window.innerHeight-rect.height-8))+'px';
  menu.querySelector('button:not(:disabled)')?.focus();
}
function runPageAction(action, target = pageMenuTarget) {
  closePageMenu();
  const project = activeProject(), page = project?.pages.find(p => p.id === target?.pageId);
  if (project?.id !== target?.projectId || pageActionDisabled(action,project,page)) return;
  if (traceDraft || drag) {document.getElementById('status').textContent = '請先完成目前描線或拖曳，再操作圖頁'; return;}
  syncActivePage();
  const index = project.pages.indexOf(page);
  if (action === 'copy') {
    pageClipboard = deepCopy(page);
    document.getElementById('status').textContent = `已複製圖頁「${page.name}」；在圖頁縮圖按右鍵可貼上`;
    return;
  }
  if (['paste','duplicate','new'].includes(action)) {
    const source = action === 'paste' ? pageClipboard : page;
    const created = makePage(action === 'new' ? '空白圖頁' : `${source.name} 複本`, action === 'new' ? [] : clonePageItems(source.items || []), {width:source.canvasWidth,height:source.canvasHeight});
    project.pages.splice(index+1,0,created); openPage(created.id);
    document.getElementById('status').textContent = action === 'new' ? '已在下方新增空白圖頁' : '已建立獨立圖頁副本，原圖頁不會被修改';
    return;
  }
  if (action === 'rename') {
    const name = prompt('圖頁名稱',page.name);
    if (name == null || !name.trim()) return;
    page.name = name.trim().slice(0,200);
  } else if (action === 'delete') {
    if (!confirm(`確定刪除圖頁「${page.name}」？此操作無法用畫布復原；需要保留時請先複製或下載專案。`)) return;
    project.pages.splice(index,1);
    if (page.id === activePageId) {openPage(project.pages[Math.max(0,index-1)].id); return;}
  } else if (['up','down','first','last'].includes(action)) {
    const next = action === 'up' ? index-1 : action === 'down' ? index+1 : action === 'first' ? 0 : project.pages.length-1;
    project.pages.splice(index,1); project.pages.splice(next,0,page);
  } else return;
  renderProjectNav(); renderWorkspacePages(); queueAutosave();
  document.getElementById('status').textContent = action === 'delete' ? '已刪除圖頁' : action === 'rename' ? '圖頁已重新命名' : '圖頁順序已更新';
}
function pasteIsEditingText(target) {return ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName) || !!target?.isContentEditable;}
function canvasPasteBlocked() {return !!document.getElementById('auto-trace-dialog')?.open || document.getElementById('page-context-menu')?.hidden === false || !!traceDraft || !!drag || !activePage();}
function noteInternalCopy() {internalCopyInFocus = true;}
function clipboardImageFiles(data) {
  const supported = file => file && /^image\/(png|jpeg|webp|gif|bmp)$/i.test(file.type);
  const fromItems = Array.from(data?.items || []).filter(it => it.kind === 'file').map(it => it.getAsFile()).filter(supported);
  return fromItems.length ? fromItems : Array.from(data?.files || []).filter(supported);
}
function readClipboardImage(file) {
  return new Promise((resolve,reject) => {
    if (file.size > 32*1024*1024) {reject(new Error('圖片超過 32 MB，請先縮小')); return;}
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('無法讀取剪貼簿圖片'));
    reader.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('剪貼簿圖片格式無法解碼'));
      im.onload = () => {
        if (!im.naturalWidth || !im.naturalHeight || im.naturalWidth*im.naturalHeight > 40000000) {reject(new Error('圖片尺寸過大，請先縮小')); return;}
        resolve({src:reader.result,width:im.naturalWidth,height:im.naturalHeight});
      };
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
async function insertClipboardImages(files, destination) {
  try {
    const decoded = await Promise.all(files.slice(0,8).map(readClipboardImage));
    if (activeProjectId !== destination.projectId || activePageId !== destination.pageId || canvasPasteBlocked()) {
      document.getElementById('status').textContent = '畫布已切換或正在編輯，未貼入圖片；請在目標圖頁再按 Ctrl+V'; return;
    }
    const size = canvasSize(), created = decoded.map((im,index) => {
      const scale = Math.min(1,size.width*.8/im.width,size.height*.8/im.height), w = im.width*scale, h = im.height*scale;
      return {id:id(),type:'image',name:files[index]?.name || '貼上的圖片',src:im.src,x:Math.min(size.width-w,(size.width-w)/2+index*16),y:Math.min(size.height-h,(size.height-h)/2+index*16),w,h,r:0,opacity:1,locked:false,referenceOnly:false,preserveFull:true};
    });
    if (!created.length) return;
    activateSelectTool(); commit(); items.push(...created);
    selectedIds = new Set(created.map(it => it.id)); selected = created.at(-1).id;
    selectedPoint = selectedSegment = null; selectedPoints.clear(); editPoints = false;
    render(); document.getElementById('status').textContent = `已貼上 ${created.length} 張圖片為新圖層；可拖曳、縮放或復原`;
  } catch (error) {document.getElementById('status').textContent = `圖片未貼上：${error.message || error}`;}
}
function handleCanvasPaste(event) {
  if (pasteIsEditingText(event.target) || document.getElementById('auto-trace-dialog')?.open) return;
  if (canvasPasteBlocked()) {event.preventDefault();document.getElementById('status').textContent = '請先完成目前描線或拖曳，再貼上圖片';return;}
  const files = clipboardImageFiles(event.clipboardData);
  // A just-copied Skechu object may also have an Office PNG representation.
  // Leaving this window clears that preference so a newly copied web image wins.
  if (internalCopyInFocus && internalClipboard.length) {event.preventDefault();pasteInternalSelection();return;}
  if (files.length) {
    event.preventDefault();
    const destination = {projectId:activeProjectId,pageId:activePageId};
    document.getElementById('status').textContent = '正在讀取剪貼簿圖片…';
    imagePasteQueue = imagePasteQueue.then(() => insertClipboardImages(files,destination));
  } else if (!event.clipboardData?.types?.length && internalClipboard.length) {event.preventDefault();pasteInternalSelection();}
  else {event.preventDefault();document.getElementById('status').textContent = '沒有可貼上的圖片；請在網頁圖片上按右鍵「複製圖片」，不是複製圖片網址';}
}
function initializeWorkspaceActions() {
  document.body.insertAdjacentHTML('beforeend','<div id="page-context-menu" class="context-menu" role="menu" aria-label="圖頁操作" style="width:220px;max-height:calc(100vh - 16px);overflow:auto" hidden></div>');
  const menu = document.getElementById('page-context-menu'), pages = document.getElementById('workspace-pages');
  pages.addEventListener('contextmenu',showPageMenu);
  pages.addEventListener('keydown',e => {if (e.key === 'ContextMenu' || e.shiftKey && e.key === 'F10') showPageMenu(e);});
  menu.onclick = e => {const action = e.target.closest('[data-page-action]'); if (action && !action.disabled) runPageAction(action.dataset.pageAction);};
  menu.addEventListener('keydown',e => {
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Tab') {closePageMenu();if(e.key==='Escape')e.preventDefault();return;}
    if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
      e.preventDefault();const buttons = [...menu.querySelectorAll('button:not(:disabled)')], index = buttons.indexOf(document.activeElement);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length-1 : (index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();
    }
  });
  document.addEventListener('pointerdown',e => {if (!menu.hidden && !menu.contains(e.target)) closePageMenu();});
  window.addEventListener('blur',() => {internalCopyInFocus=false;closePageMenu();});
  document.addEventListener('visibilitychange',() => {if(document.hidden)internalCopyInFocus=false;});
  window.addEventListener('paste',handleCanvasPaste);
  // Let the browser deliver real clipboard files; the older shortcut must not
  // prevent the paste event. Same-focus Skechu copies stay fully editable.
  window.addEventListener('keydown',e => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'v' || pasteIsEditingText(e.target) || document.getElementById('auto-trace-dialog')?.open) return;
    e.stopImmediatePropagation();
    if (e.repeat || canvasPasteBlocked()) {e.preventDefault();return;}
    if (internalCopyInFocus && internalClipboard.length) {e.preventDefault();pasteInternalSelection();}
  },true);
  document.getElementById('duplicate-page').onclick = () => runPageAction('duplicate',{projectId:activeProjectId,pageId:activePageId});
}
