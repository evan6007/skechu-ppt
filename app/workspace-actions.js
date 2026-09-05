/* Page actions and native paste events. No clipboard polling or remote image fetches. */
let pageClipboard = null, pageMenuTarget = null;
let internalCopyInFocus = false, imagePasteQueue = Promise.resolve();
let pagePointerDrag = null, suppressPageClick = false;
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
    const created = makePage(action === 'new' ? '空白圖頁' : `${source.name} 複本`, action === 'new' ? [] : clonePageItems(source.items || []), {width:source.canvasWidth,height:source.canvasHeight,color:source.canvasColor,opacity:source.canvasOpacity});
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
function movePageByPointer(sourceId,targetId,position) {
  const project=activeProject();if(!project||sourceId===targetId)return false;
  const source=project.pages.find(page=>page.id===sourceId),target=project.pages.find(page=>page.id===targetId);if(!source||!target)return false;
  syncActivePage();project.pages.splice(project.pages.indexOf(source),1);
  const targetIndex=project.pages.indexOf(target)+(position==='after'?1:0);project.pages.splice(targetIndex,0,source);
  renderProjectNav();renderWorkspacePages();queueAutosave();document.getElementById('status').textContent=`已將「${source.name}」移到新位置`;return true;
}
function pageCardForId(host,id){return[...host.querySelectorAll('[data-page-id]')].find(card=>card.dataset.pageId===id)||null}
function beginPageDragVisual(gesture,event){
  const host=document.getElementById('workspace-pages'),card=gesture.card||pageCardForId(host,gesture.source);if(!card)return;
  const rect=card.getBoundingClientRect(),ghost=card.cloneNode(true);gesture.card=card;gesture.offsetX=gesture.x-rect.left;gesture.offsetY=gesture.y-rect.top;gesture.sourceHeight=rect.height;
  gesture.layout=[...host.querySelectorAll('[data-page-id]')].map(card=>{const box=card.getBoundingClientRect();return{card,id:card.dataset.pageId,top:box.top+host.scrollTop,height:box.height}});
  card.dataset.dragSource='true';ghost.classList.add('workspace-page-ghost');ghost.removeAttribute('data-page-id');ghost.tabIndex=-1;ghost.setAttribute('aria-hidden','true');
  Object.assign(ghost.style,{width:rect.width+'px',left:rect.left+'px',top:rect.top+'px'});document.body.appendChild(ghost);gesture.ghost=ghost;
}
function pageDropAt(gesture,event){
  const host=document.getElementById('workspace-pages'),layout=gesture.layout||[],candidates=layout.filter(entry=>entry.id!==gesture.source),sourceIndex=layout.findIndex(entry=>entry.id===gesture.source);if(!candidates.length||sourceIndex<0)return null;
  const center=entry=>entry.top+entry.height/2,dragCenter=event.clientY-gesture.offsetY+(gesture.sourceHeight||80)/2+host.scrollTop,sourceCenter=center(layout[sourceIndex]);let insertIndex=sourceIndex;
  if(dragCenter>sourceCenter)for(let index=sourceIndex+1;index<layout.length;index++){const boundary=(center(layout[index-1])+center(layout[index]))/2;if(dragCenter>=boundary)insertIndex=index}
  else if(dragCenter<sourceCenter)for(let index=sourceIndex-1;index>=0;index--){const boundary=(center(layout[index])+center(layout[index+1]))/2;if(dragCenter<=boundary)insertIndex=index}
  if(insertIndex===sourceIndex)return null;
  const before=candidates[insertIndex],entry=before||candidates.at(-1);return{target:entry.id,position:before?'before':'after',card:entry.card,insertIndex};
}
function previewPageOrder(gesture){
  const host=document.getElementById('workspace-pages'),cards=[...host.querySelectorAll('[data-page-id]')],source=cards.findIndex(card=>card.dataset.pageId===gesture.source),target=gesture.insertIndex;
  const signature=String(target??'');if(gesture.previewSignature===signature)return;gesture.previewSignature=signature;
  cards.forEach(card=>card.style.transform='');if(source<0||target==null||target===source)return;const gap=10,height=(gesture.sourceHeight||80)+gap;
  if(target>source)cards.slice(source+1,target+1).forEach(card=>card.style.transform=`translateY(${-height}px)`);else if(target<source)cards.slice(target,source).forEach(card=>card.style.transform=`translateY(${height}px)`);
}
function updatePageDragVisual(gesture,event){
  if(!gesture.ghost)beginPageDragVisual(gesture,event);
  if(gesture.ghost){gesture.ghost.style.left=event.clientX-gesture.offsetX+'px';gesture.ghost.style.top=event.clientY-gesture.offsetY+'px'}previewPageOrder(gesture);
}
function clearPageDragVisual(gesture,settle=false){
  const host=document.getElementById('workspace-pages');host.querySelectorAll('[data-page-id]').forEach(card=>{card.style.transform='';delete card.dataset.dragSource});const ghost=gesture?.ghost;if(!ghost)return;
  if(settle){ghost.classList.add('settling');ghost.style.opacity='0';setTimeout(()=>ghost.remove(),110)}else ghost.remove();
}
function finishPagePointer(event,cancel=false) {
  const gesture=pagePointerDrag;if(!gesture||event&&event.pointerId!==gesture.pointerId)return;
  pagePointerDrag=null;const pages=document.getElementById('workspace-pages');pages.querySelectorAll('[data-drop]').forEach(card=>card.removeAttribute('data-drop'));
  const captureOwner=gesture.card;if(captureOwner?.hasPointerCapture?.(gesture.pointerId))captureOwner.releasePointerCapture(gesture.pointerId);
  suppressPageClick=!cancel&&gesture.moved;
  const moved=!cancel&&gesture.moved&&gesture.target&&movePageByPointer(gesture.source,gesture.target,gesture.position);clearPageDragVisual(gesture,!!moved);
}
function pasteIsEditingText(target) {return ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName) || !!target?.isContentEditable;}
function canvasPasteBlocked() {return !!document.getElementById('auto-trace-dialog')?.open || document.getElementById('page-context-menu')?.hidden === false || !!traceDraft || !!drag || !activePage();}
function noteInternalCopy() {internalCopyInFocus = true;}
function clipboardImageFiles(data) {
  const supported = file => file && (/^image\/(png|jpeg|webp|gif|bmp|svg\+xml)$/i.test(file.type) || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name || ''));
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
async function insertClipboardImages(files, destination, placement = null, action = '貼上') {
  try {
    const decoded = await Promise.all(files.slice(0,8).map(readClipboardImage));
    if (activeProjectId !== destination.projectId || activePageId !== destination.pageId || canvasPasteBlocked()) {
      document.getElementById('status').textContent = '畫布已切換或正在編輯，未貼入圖片；請在目標圖頁再按 Ctrl+V'; return;
    }
    const size = canvasSize(), created = decoded.map((im,index) => {
      const scale = Math.min(1,size.width*.8/im.width,size.height*.8/im.height), w = im.width*scale, h = im.height*scale;
      const x = placement ? clamp(placement.x-w/2+index*16,0,Math.max(0,size.width-w)) : Math.min(size.width-w,(size.width-w)/2+index*16);
      const y = placement ? clamp(placement.y-h/2+index*16,0,Math.max(0,size.height-h)) : Math.min(size.height-h,(size.height-h)/2+index*16);
      return {id:id(),type:'image',name:files[index]?.name || `${action}的圖片`,src:im.src,x,y,w,h,r:0,opacity:1,locked:false,referenceOnly:false,preserveFull:true};
    });
    if (!created.length) return;
    activateSelectTool(); commit(); items.push(...created);
    selectedIds = new Set(created.map(it => it.id)); selected = created.at(-1).id;
    selectedPoint = selectedSegment = null; selectedPoints.clear(); editPoints = false;
    render(); document.getElementById('status').textContent = `已${action} ${created.length} 張圖片為新圖層；可拖曳、縮放或復原`;
  } catch (error) {document.getElementById('status').textContent = `圖片未${action}：${error.message || error}`;}
}
function projectFile(file) {return file && (/\.(?:skc|sktc|sketchou(?:\.json)?|json)$/i.test(file.name || '') || file.type === 'application/json');}
function readDroppedProject(file) {
  return new Promise((resolve,reject) => {
    if (file.size > 32*1024*1024) {reject(new Error('專案檔超過 32 MB')); return;}
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`無法讀取 ${file.name}`));
    reader.onload = () => {
      try {
        const raw=JSON.parse(reader.result),incoming=raw?.project?[raw.project]:Array.isArray(raw?.projects)?raw.projects:[raw];
        const base=(file.name || '匯入專案').replace(/\.(?:skc|sktc|sketchou(?:\.json)?|json)$/i,'');
        resolve(incoming.map((project,index)=>normalizeProject(project,`${base} ${index+1}`)));
      } catch (error) {reject(new Error(`${file.name} 不是有效的 Skechu 專案`));}
    };
    reader.readAsText(file);
  });
}
async function importProjectFiles(files) {
  const batches=await Promise.all(files.map(readDroppedProject)),imported=batches.flat();
  if(!imported.length)return;
  syncActivePage();projects.push(...imported);repairItemSequence();openProject(imported[0].id);
  setAutosaveStatus(`已匯入 ${imported.length} 個專案`);
}
function droppedFiles(event) {return Array.from(event.dataTransfer?.files || []);}
function acceptedDropFiles(files) {return files.filter(file=>projectFile(file)||clipboardImageFiles({files:[file]}).length);}
function handleWorkspaceDragOver(event) {
  if(!acceptedDropFiles(droppedFiles(event)).length)return;
  event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';
  stageWrap.classList.add('file-drop-ready');
}
function handleWorkspaceDrop(event) {
  const files=acceptedDropFiles(droppedFiles(event));stageWrap.classList.remove('file-drop-ready');
  if(!files.length)return;
  event.preventDefault();event.stopPropagation?.();
  const projectsToLoad=files.filter(projectFile),images=clipboardImageFiles({files});
  const destination={projectId:activeProjectId,pageId:activePageId};
  let placement=null;try{if(event.clientX!==undefined&&event.clientY!==undefined)placement=svgPt(event)}catch(_){placement=null}
  document.getElementById('status').textContent='正在匯入拖入的檔案…';
  imagePasteQueue=imagePasteQueue.then(async()=>{
    if(projectsToLoad.length)await importProjectFiles(projectsToLoad);
    if(images.length){
      const target=projectsToLoad.length?{projectId:activeProjectId,pageId:activePageId}:destination;
      await insertClipboardImages(images,target,projectsToLoad.length?null:placement,'匯入');
    }
  }).catch(error=>{document.getElementById('status').textContent=`檔案未匯入：${error.message||error}`});
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
  pages.addEventListener('click',event=>{if(!suppressPageClick)return;suppressPageClick=false;event.preventDefault();event.stopImmediatePropagation()},true);
  pages.addEventListener('pointerdown',event=>{const card=event.target.closest('[data-page-id]');if(event.button!==0||!card||pagePointerDrag)return;
    if(event.pointerType==='touch'&&!event.target.closest('.workspace-page-number'))return;
    pagePointerDrag={pointerId:event.pointerId,source:card.dataset.pageId,x:event.clientX,y:event.clientY,moved:false,target:null,card};card.setPointerCapture?.(event.pointerId)});
  pages.addEventListener('pointermove',event=>{const gesture=pagePointerDrag;if(!gesture||gesture.pointerId!==event.pointerId)return;
    if(!gesture.moved&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<8)return;
    event.preventDefault();gesture.moved=true;if(!gesture.ghost)beginPageDragVisual(gesture,event);const bounds=pages.getBoundingClientRect();if(event.clientY<bounds.top+30)pages.scrollTop-=18;else if(event.clientY>bounds.bottom-30)pages.scrollTop+=18;
    const drop=pageDropAt(gesture,event);gesture.target=drop?.target||null;gesture.position=drop?.position||null;gesture.insertIndex=drop?.insertIndex??null;
    const dropSignature=drop?`${drop.target}:${drop.position}`:'';if(gesture.dropSignature!==dropSignature){pages.querySelectorAll('[data-drop]').forEach(card=>card.removeAttribute('data-drop'));if(drop?.card)drop.card.dataset.drop=drop.position;gesture.dropSignature=dropSignature}updatePageDragVisual(gesture,event)});
  pages.addEventListener('pointerup',event=>finishPagePointer(event));
  pages.addEventListener('pointercancel',event=>finishPagePointer(event,true));
  pages.addEventListener('lostpointercapture',event=>finishPagePointer(event,true));
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
  window.addEventListener('blur',() => {internalCopyInFocus=false;closePageMenu();finishPagePointer(null,true);});
  document.addEventListener('visibilitychange',() => {if(document.hidden)internalCopyInFocus=false;});
  window.addEventListener('paste',handleCanvasPaste);
  window.addEventListener('dragover',handleWorkspaceDragOver);
  window.addEventListener('drop',handleWorkspaceDrop);
  window.addEventListener('dragleave',event=>{if(!event.relatedTarget)stageWrap.classList.remove('file-drop-ready')});
  // Let the browser deliver real clipboard files; the older shortcut must not
  // prevent the paste event. Same-focus Skechu copies stay fully editable.
  window.addEventListener('keydown',e => {
    if(pagePointerDrag&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finishPagePointer(null,true);return;}
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'v' || pasteIsEditingText(e.target) || document.getElementById('auto-trace-dialog')?.open) return;
    e.stopImmediatePropagation();
    if (e.repeat || canvasPasteBlocked()) {e.preventDefault();return;}
    if (internalCopyInFocus && internalClipboard.length) {e.preventDefault();pasteInternalSelection();}
  },true);
  document.getElementById('duplicate-page').onclick = () => runPageAction('duplicate',{projectId:activeProjectId,pageId:activePageId});
}
