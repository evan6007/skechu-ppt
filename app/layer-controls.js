/* Layer folders are metadata on the original editable items, never flattened paths.
 * Keeping metadata in items preserves the existing project and Undo format. */
let layerPointerDrag = null, suppressLayerClick = false;
let layerMenuTarget = null, layerLongPress = null;
function layerRowForKey(host,key){return [...host.querySelectorAll('[data-layer-key]')].find(row=>row.dataset.layerKey===key)||null}
function beginLayerDragVisual(gesture,event){
  const host=document.getElementById('layers'),row=gesture.row||layerRowForKey(host,gesture.key);if(!row)return;
  const rect=row.getBoundingClientRect(),ghost=row.cloneNode(true);gesture.row=row;gesture.offsetX=gesture.x-rect.left;gesture.offsetY=gesture.y-rect.top;gesture.sourceHeight=rect.height;
  gesture.layout=[...host.querySelectorAll('[data-layer-key]')].map(row=>{const box=row.getBoundingClientRect();return{row,key:row.dataset.layerKey,top:box.top+host.scrollTop,left:box.left,height:box.height,width:box.width}});
  row.dataset.dragSource='true';ghost.classList.add('layer-drag-ghost');ghost.removeAttribute('data-layer-key');ghost.querySelectorAll('button').forEach(button=>button.tabIndex=-1);
  Object.assign(ghost.style,{width:rect.width+'px',left:rect.left+'px',top:rect.top+'px'});document.body.appendChild(ghost);gesture.ghost=ghost;
}
function layerDropAt(gesture,event){
  const host=document.getElementById('layers'),layout=gesture.layout||[],y=event.clientY+host.scrollTop,candidates=layout.filter(entry=>entry.key!==gesture.key),sourceIndex=layout.findIndex(entry=>entry.key===gesture.key);if(!candidates.length||sourceIndex<0)return null;
  const direct=candidates.find(entry=>y>=entry.top&&y<=entry.top+entry.height);
  if(direct?.key.startsWith('group:')&&!gesture.key.startsWith('group:')&&!layerMembers(gesture.key).some(it=>it.referenceOnly)){const fraction=(y-direct.top)/direct.height;if(fraction>.28&&fraction<.72)return{target:direct.key,position:'inside',row:direct.row,insertIndex:null}}
  const center=entry=>entry.top+entry.height/2,dragCenter=event.clientY-gesture.offsetY+(gesture.sourceHeight||36)/2+host.scrollTop,sourceCenter=center(layout[sourceIndex]);let insertIndex=sourceIndex;
  if(dragCenter>sourceCenter)for(let index=sourceIndex+1;index<layout.length;index++){const boundary=(center(layout[index-1])+center(layout[index]))/2;if(dragCenter>=boundary)insertIndex=index}
  else if(dragCenter<sourceCenter)for(let index=sourceIndex-1;index>=0;index--){const boundary=(center(layout[index])+center(layout[index+1]))/2;if(dragCenter<=boundary)insertIndex=index}
  if(insertIndex===sourceIndex)return null;
  const before=candidates[insertIndex],entry=before||candidates.at(-1);return{target:entry.key,position:before?'above':'below',row:entry.row,insertIndex};
}
function previewLayerOrder(gesture){
  const host=document.getElementById('layers'),rows=[...host.querySelectorAll('[data-layer-key]')],source=rows.findIndex(row=>row.dataset.layerKey===gesture.key),target=gesture.insertIndex;
  const signature=`${gesture.position||''}:${target??''}`;if(gesture.previewSignature===signature)return;gesture.previewSignature=signature;
  rows.forEach(row=>row.style.transform='');if(source<0||target==null||target===source||gesture.position==='inside')return;
  const height=(gesture.sourceHeight||36)+4;
  if(target>source)rows.slice(source+1,target+1).forEach(row=>row.style.transform=`translateY(${-height}px)`);
  else if(target<source)rows.slice(target,source).forEach(row=>row.style.transform=`translateY(${height}px)`);
}
function updateLayerDragVisual(gesture,event){
  if(!gesture.ghost)beginLayerDragVisual(gesture,event);
  if(gesture.ghost){gesture.ghost.style.left=event.clientX-gesture.offsetX+'px';gesture.ghost.style.top=event.clientY-gesture.offsetY+'px'}
  previewLayerOrder(gesture);
}
function clearLayerDragVisual(gesture,settle=false){
  const host=document.getElementById('layers');host.querySelectorAll('[data-layer-key]').forEach(row=>{row.style.transform='';delete row.dataset.dragSource});
  const ghost=gesture?.ghost;if(!ghost)return;
  if(settle){ghost.classList.add('settling');ghost.style.opacity='0';setTimeout(()=>ghost.remove(),110)}
  else ghost.remove();
}
function layerGroupOf(it) {
  if (Object.prototype.hasOwnProperty.call(it, 'layerGroup')) return it.layerGroup;
  // Existing projects gain a collapsed folder without rewriting their geometry.
  return it.autoTraceBatch ? {id: 'trace-' + it.autoTraceBatch, name: '自動描圖', collapsed: true} : null;
}
function layerEntries(source = items) {
  const entries = [], groups = new Map();
  const ordered = layerStackItems(source).reverse();
  for (const it of ordered) {
    const group = layerGroupOf(it);
    if (!group) { entries.push({key: 'item:' + it.id, members: [it]}); continue; }
    // References are root entries, never silently absorbed by legacy folders.
    if (it.referenceOnly) { entries.push({key: 'item:' + it.id, members: [it]}); continue; }
    let entry = groups.get(group.id);
    if (!entry) { entry = {key: 'group:' + group.id, group, members: []}; groups.set(group.id, entry); entries.push(entry); }
    entry.members.push(it);
  }
  return entries;
}
function layerMembers(key) {
  if (!key) return [];
  return key.startsWith('group:') ? items.filter(it => !it.referenceOnly && layerGroupOf(it)?.id === key.slice(6)) : items.filter(it => it.id === key.slice(5));
}
function layerIcon(kind) {
  const paths = {lock:'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5z M12 14v3',unlock:'M7 10V7a5 5 0 0 1 9-3 M5 10h14v11H5z M12 14v3',folder:'M3 6h7l2 3h9v11H3z',grip:'M8 5h1 M15 5h1 M8 12h1 M15 12h1 M8 19h1 M15 19h1'};
  paths.eye='M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0';
  paths.eyeOff='M3 3l18 18 M9 5.4A11 11 0 0 1 12 5c6 0 10 7 10 7a22 22 0 0 1-4 4 M6 6.5A23 23 0 0 0 2 12s4 7 10 7a12 12 0 0 0 4-.7 M10 10a3 3 0 0 0 4 4';
  Object.assign(paths,{more:'M5 12h.01 M12 12h.01 M19 12h.01',copy:'M8 8h12v13H8z M16 8V3H3v13h5',paste:'M9 5H5v16h14V5h-4 M9 3h6v4H9z',duplicate:'M3 3h12v12H3z M9 18v3h12V9h-3 M6 9h6 M9 6v6',rename:'m4 16-1 5 5-1L20 8l-4-4z M13 7l4 4',up:'m5 12 7-7 7 7 M12 5v15',down:'m5 12 7 7 7-7 M12 19V4',delete:'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',ungroup:'M3 3h7v7H3z M14 14h7v7h-7z M16 3h5v5 M3 16v5h5'});
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[kind]}"/></svg>`;
}
function layerRowMarkup(key, members, group = null, child = false) {
  const name = group?.name || members[0].name, all = members.every(it => selectedIds.has(it.id)), some = members.some(it => selectedIds.has(it.id));
  const locked = members.every(it => it.locked), mixed = !locked && members.some(it => it.locked);
  const hidden = members.every(it=>it.hidden), partialHidden = !hidden && members.some(it=>it.hidden);
  const safeKey = esc(key), safeName = esc(name);
  return `<div class="layer-entry ${child?'layer-child':''} ${all?'active':some?'partial':''} ${locked?'is-locked':''} ${hidden?'is-hidden':''}" data-layer-key="${safeKey}">
    <button type="button" class="layer-grip" data-layer-drag="${safeKey}" aria-label="拖曳排序：${safeName}" title="拖曳上下排序；放到群組中央可加入" ${members.some(it=>it.locked)?'disabled':''}>${layerIcon('grip')}</button>
    ${group?`<button type="button" class="layer-fold" data-layer-fold="${safeKey}" aria-label="${group.collapsed?'展開':'收合'}：${safeName}" aria-expanded="${!group.collapsed}">${group.collapsed?'▸':'▾'}</button>`:'<span class="layer-fold-space"></span>'}
    <button type="button" class="layer-name" data-layer-drag="${safeKey}" ${group?`data-layer-group="${safeKey}"`:`data-layer="${esc(members[0].id)}"`} title="點一下選取；直接拖曳上下排序：${safeName}" aria-pressed="${all}">${group?layerIcon('folder'):`<i class="dot ${esc(members[0].type)}"></i>`}<span>${safeName}</span>${group?`<small>${members.length}</small>`:''}</button>
    <button type="button" class="layer-eye ${hidden?'eye-off':partialHidden?'mixed':''}" data-layer-visibility="${safeKey}" aria-label="${hidden?'顯示':'隱藏'}：${safeName}" aria-pressed="${!hidden}" title="${partialHidden?'部分隱藏；點一下隱藏整組':hidden?'顯示圖層':'隱藏圖層（匯出時也排除）'}">${layerIcon(hidden?'eyeOff':'eye')}</button>
    <button type="button" class="layer-lock ${locked?'locked':mixed?'mixed':''}" data-layer-lock="${safeKey}" aria-label="${locked?'解除鎖定':'鎖定'}：${safeName}" aria-pressed="${locked}" title="${mixed?'部分鎖定；點一下鎖定整組':locked?'點一下解除鎖定':'點一下鎖定'}">${layerIcon(locked?'lock':'unlock')}</button>
    <button type="button" class="layer-more" data-layer-menu="${safeKey}" aria-label="更多操作：${safeName}" aria-haspopup="menu" title="右鍵或長按也可開啟">${layerIcon('more')}</button>
  </div>`;
}
function renderLayerTree() {
  const host = document.getElementById('layers'), scroll = host.scrollTop;
  host.innerHTML = layerEntries().map(entry => entry.group ? `<div class="layer-folder">${layerRowMarkup(entry.key, entry.members, entry.group)}${entry.group.collapsed?'':entry.members.map(it=>layerRowMarkup('item:'+it.id,[it],null,true)).join('')}</div>` : layerRowMarkup(entry.key,entry.members)).join('');
  host.scrollTop = scroll;
  const chosen = items.filter(it => selectedIds.has(it.id));
  document.getElementById('group-layers').disabled = chosen.filter(it=>!it.referenceOnly&&!it.locked).length < 2;
  document.getElementById('ungroup-layers').disabled = !chosen.some(it=>layerGroupOf(it)&&!it.locked);
}
function selectLayerGroup(key, additive = false) {
  activateSelectTool(); const members = layerMembers(key); if (!members.length) return;
  const all = members.every(it=>selectedIds.has(it.id));
  if (!additive) selectedIds = new Set();
  for (const it of members) { if (additive && all) selectedIds.delete(it.id); else selectedIds.add(it.id); }
  selected = [...selectedIds].at(-1) || null; selectedPoint = selectedSegment = null; selectedPoints.clear(); editPoints = false;
  refreshSelectionUI(); paintStatus(`已選取 ${selectedIds.size} 個圖層；展開群組可選單一線段`);
}
function toggleLayerFolder(key) {
  const members = layerMembers(key), group = members.length && layerGroupOf(members[0]); if (!group) return;
  members.forEach(it=>it.layerGroup={...group,collapsed:!group.collapsed});
  renderLayerTree(); queueAutosave(); // Disclosure is UI state, not a geometric edit.
}
function groupSelectedLayers() {
  activateSelectTool(); const chosen = items.filter(it=>selectedIds.has(it.id)&&!it.locked&&!it.referenceOnly);
  if (chosen.length < 2) { paintStatus('Shift 選取至少兩個未鎖定圖層，再建立群組'); return; }
  commit(); const group = {id:uid('layers'),name:'群組 '+(layerEntries().filter(e=>e.group).length+1),collapsed:true};
  chosen.forEach(it=>it.layerGroup={...group}); render(); paintStatus(`已把 ${chosen.length} 個圖層收進「${group.name}」；原曲線與填色未改動`);
}
function ungroupSelectedLayers() {
  const chosen = items.filter(it=>selectedIds.has(it.id)&&!it.locked&&layerGroupOf(it)); if (!chosen.length) return;
  activateSelectTool(); commit(); chosen.forEach(it=>it.layerGroup=null); render(); paintStatus(`已將 ${chosen.length} 個圖層移出群組，曲線不變`);
}
function toggleLayerLock(key) {
  const members = layerMembers(key); if (!members.length) return;
  activateSelectTool(); commit(); const locked = !members.every(it=>it.locked);
  members.forEach(it=>it.locked=locked); selectedPoint=selectedSegment=null;selectedPoints.clear();
  render(); paintStatus(`已${locked?'鎖定':'解鎖'} ${members.length} 個圖層${locked?'；再次點鎖頭即可解除':'；可在畫布直接拖曳'}`);
}
function toggleLayerVisibility(key) {
  const members=layerMembers(key);if(!members.length)return;
  activateSelectTool();commit();const hidden=!members.every(it=>it.hidden);
  members.forEach(it=>it.hidden=hidden);
  selectedIds=new Set([...selectedIds].filter(id=>!byId(id)?.hidden));
  if(byId(selected)?.hidden)selected=[...selectedIds].at(-1)||null;
  selectedPoint=selectedSegment=null;selectedPoints.clear();
  snapLines=[];snapAnchors=[];hotAnchor=traceSnapTarget=null;
  render();paintStatus(`已${hidden?'隱藏':'顯示'} ${members.length} 個圖層；資料仍保留，隱藏圖層不會匯出`);
}
function moveLayerEntry(sourceKey, targetKey, position) {
  if(!['above','below','inside'].includes(position))return false;
  const moving = layerMembers(sourceKey), targets = layerMembers(targetKey);
  if (!moving.length || !targets.length || moving.some(it=>it.locked) || moving.some(it=>targets.includes(it))) return false;
  const ordered=layerStackItems(items);
  const ids = new Set(moving.map(it=>it.id)), movingInOrder = ordered.filter(it=>ids.has(it.id)), rest = ordered.filter(it=>!ids.has(it.id));
  const intoGroup = targetKey.startsWith('group:') && position === 'inside';
  if(moving.some(it=>it.referenceOnly)&&(intoGroup||targets.some(it=>layerGroupOf(it))&&!targetKey.startsWith('group:'))){paintStatus('底圖可移到群組上方或下方；請拖到群組標題排序');return false;}
  const group = intoGroup || !targetKey.startsWith('group:') ? layerGroupOf(targets[0]) : null;
  if (intoGroup && sourceKey.startsWith('group:')) return false; // One level of folders, no accidental nesting.
  if (group && targets.some(it=>it.locked)) { paintStatus('請先解鎖目標群組，再加入圖層'); return false; }
  const indices = targets.map(it=>rest.indexOf(it));
  const index = position==='below' ? Math.min(...indices) : Math.max(...indices)+1;
  const next = rest.slice(); next.splice(index,0,...movingInOrder);
  const changesFolder = sourceKey.startsWith('item:') && moving.some(it=>layerGroupOf(it)?.id !== group?.id);
  if (!changesFolder && next.every((it,i)=>it===items[i])) return false;
  commit();
  [...moving,...targets].filter(it=>it.referenceOnly).forEach(it=>it.referenceStacked=true);
  if (sourceKey.startsWith('item:')) moving.forEach(it=>it.layerGroup=group?{...group}:null);
  // Preserve all unrelated fill ranks; explicit reordering takes precedence over paint recency.
  const fillStack = items.filter(renderedFillIsVisible).sort((a,b)=>fillOrderValue(a)-fillOrderValue(b));
  const movingFills = fillStack.filter(it=>ids.has(it.id)), targetFills = targets.filter(renderedFillIsVisible);
  if (movingFills.length && targetFills.length) {
    const remaining = fillStack.filter(it=>!ids.has(it.id)), slots = targetFills.map(it=>remaining.indexOf(it));
    remaining.splice(position==='below'?Math.min(...slots):Math.max(...slots)+1,0,...movingFills);
    remaining.forEach((it,i)=>it.fillOrder=i+1);
  }
  items = next; render(); paintStatus(intoGroup?'已加入群組；可展開精修':'已調整圖層順序；底圖依手動位置顯示'); return true;
}
function cloneLayerGroups(clones) {
  const groups = new Map();
  for (const it of clones) { const group=layerGroupOf(it); if (!group) continue; if(!groups.has(group.id))groups.set(group.id,uid('layers')); it.layerGroup={...group,id:groups.get(group.id),name:group.name+' 複本'}; }
}
function nudgeSelectedLayers(position) {
  const it=byId(selected);if(!it)return;
  const group=layerGroupOf(it),members=group?layerMembers('group:'+group.id):[];
  const key=members.length&&members.every(it=>selectedIds.has(it.id))?'group:'+group.id:'item:'+it.id;
  const entries=key.startsWith('group:')||!group?layerEntries():members.slice().reverse().map(it=>({key:'item:'+it.id}));
  const index=entries.findIndex(entry=>entry.key===key),target=entries[index+(position==='above'?-1:1)];
  if(target)moveLayerEntry(key,target.key,position);
}
function restoreLayerInspectorFields() {
  document.querySelectorAll('#controls [data-layer-disabled]').forEach(el=>{el.disabled=el.dataset.layerDisabled==='true';delete el.dataset.layerDisabled;});
}
function lockLayerInspectorFields() {
  if (!byId(selected)?.locked) return;
  document.querySelectorAll('#controls input,#controls select,#controls textarea,#controls button').forEach(el=>{
    if (el.id==='image-locked') return;
    el.dataset.layerDisabled=String(el.disabled);el.disabled=true;
  });
}
function finishLayerPointer(cancel = false) {
  const gesture=layerPointerDrag; if(!gesture)return; layerPointerDrag=null;
  const host=document.getElementById('layers');
  host.querySelectorAll('[data-drop]').forEach(el=>el.removeAttribute('data-drop'));
  if(host.hasPointerCapture(gesture.pointerId))host.releasePointerCapture(gesture.pointerId);
  suppressLayerClick=gesture.moved;
  const moved=!cancel&&gesture.moved&&gesture.target&&moveLayerEntry(gesture.key,gesture.target,gesture.position);
  clearLayerDragVisual(gesture,!!moved);
}
function cancelLayerLongPress(){if(layerLongPress)clearTimeout(layerLongPress.timer);layerLongPress=null;}
function closeLayerMenu(restoreFocus=false){
  const key=layerMenuTarget?.key;document.getElementById('layer-context-menu').hidden=true;layerMenuTarget=null;
  if(restoreFocus&&key)layerRowForKey(document.getElementById('layers'),key)?.querySelector('.layer-more')?.focus();
}
function layerMenuMembers(target=layerMenuTarget){
  if(!target||target.projectId!==activeProject()?.id||target.pageId!==activePageId)return[];
  const members=layerMembers(target.key);
  return members.length===target.ids.length&&members.every(it=>target.ids.includes(it.id))?members:[];
}
function layerMenuDisabled(action,members,key){
  if(!members.length||traceDraft||drag||document.getElementById('auto-trace-dialog')?.open)return true;
  if(action==='paste')return !internalClipboard.length;
  if(['delete','rename','up','down','ungroup'].includes(action)&&members.some(it=>it.locked))return true;
  if(['up','down'].includes(action)){
    const group=!key.startsWith('group:')&&layerGroupOf(members[0]);
    const entries=group?layerMembers('group:'+group.id).slice().reverse().map(it=>({key:'item:'+it.id})):layerEntries();
    const index=entries.findIndex(e=>e.key===key);return index<0||(action==='up'?index===0:index===entries.length-1);
  }
  return false;
}
function showLayerMenu(event,key){
  key=key||event.target.closest('[data-layer-key]')?.dataset.layerKey;
  const members=layerMembers(key);if(!members.length)return;
  event.preventDefault();event.stopPropagation();cancelLayerLongPress();finishLayerPointer(true);
  const anchor=event.type==='keydown'?event.target.getBoundingClientRect():{left:event.clientX,top:event.clientY};
  if(!traceDraft&&!drag&&!document.getElementById('auto-trace-dialog')?.open){
    activateSelectTool();selectedIds=new Set(members.map(it=>it.id));selected=members.at(-1).id;
    selectedPoint=selectedSegment=null;selectedPoints.clear();editPoints=false;refreshSelectionUI();
  }
  for(const id of ['context-menu','page-context-menu']){const other=document.getElementById(id);if(other)other.hidden=true;}
  const group=key.startsWith('group:'),name=group?layerGroupOf(members[0]).name:members[0].name;
  layerMenuTarget={projectId:activeProject()?.id,pageId:activePageId,key,ids:members.map(it=>it.id)};
  const actions=[['copy',group?'複製群組':'複製'],['paste','貼上'],['delete',group?`刪除整個群組（${members.length}）`:'刪除'],['duplicate','建立副本'],['rename','重新命名'],['up','上移一層'],['down','下移一層']];
  if(group||layerGroupOf(members[0]))actions.push(['ungroup',group?'解散群組（保留物件）':'移出群組']);
  actions.push(['visibility',members.every(it=>it.hidden)?'顯示':'隱藏'],['lock',members.every(it=>it.locked)?'解除鎖定':'鎖定']);
  const menu=document.getElementById('layer-context-menu');
  menu.innerHTML=`<div class="layer-menu-heading">${esc(name)}${members.some(it=>it.locked)?'<small>含鎖定物件，刪除前請先解鎖</small>':''}</div>`+actions.map(([action,label])=>`<button type="button" role="menuitem" data-layer-action="${action}" ${layerMenuDisabled(action,members,key)?'disabled':''} ${action==='delete'?'class="danger"':''}>${layerIcon(action==='visibility'?'eye':action)}<span>${label}</span></button>`).join('');
  menu.hidden=false;menu.scrollTop=0;
  const viewport=window.visualViewport,margin=8,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,w=viewport?.width||window.innerWidth,h=viewport?.height||window.innerHeight;
  menu.style.maxHeight=Math.max(100,Math.min(380,h*.48,h-16))+'px';
  const rect=menu.getBoundingClientRect();
  menu.style.left=Math.max(left+margin,Math.min(anchor.left,left+w-rect.width-margin))+'px';
  menu.style.top=Math.max(top+margin,Math.min(anchor.top,top+h-rect.height-margin))+'px';
  menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}
function runLayerAction(action,target=layerMenuTarget){
  const members=layerMenuMembers(target);closeLayerMenu();
  if(layerMenuDisabled(action,members,target?.key))return;
  const key=target.key;
  const selectMembers=()=>{activateSelectTool();selectedIds=new Set(members.map(it=>it.id));selected=members.at(-1).id;selectedPoint=selectedSegment=null;selectedPoints.clear();editPoints=false;};
  if(action==='copy'||action==='duplicate'){
    selectMembers();if(copyInternalSelection()&&action==='duplicate')pasteInternalSelection();else refreshSelectionUI();
    if(action==='copy')paintStatus(`已複製 ${members.length} 個圖層到編輯器；按「貼上」或 Ctrl+V 新增`);
  }else if(action==='paste'){activateSelectTool();pasteInternalSelection();}
  else if(action==='delete'){selectMembers();deleteSelectedObjects();paintStatus(`已刪除 ${members.length} 個圖層；可按復原或 Ctrl+Z 還原`);}
  else if(action==='lock')toggleLayerLock(key);
  else if(action==='visibility')toggleLayerVisibility(key);
  else if(action==='ungroup'){selectMembers();ungroupSelectedLayers();}
  else if(action==='up'||action==='down'){selectMembers();nudgeSelectedLayers(action==='up'?'above':'below');}
  else if(action==='rename'){
    const group=key.startsWith('group:')?layerGroupOf(members[0]):null;
    const name=prompt(group?'群組名稱':'圖層名稱',group?.name||members[0].name)?.trim().slice(0,200);
    if(!name||name===(group?.name||members[0].name))return;
    commit();members.forEach(it=>{if(group)it.layerGroup={...group,name};else it.name=name;});render();
  }
}
function initializeLayerControls() {
  const host=document.getElementById('layers');
  document.getElementById('group-layers').onclick=groupSelectedLayers;
  document.getElementById('ungroup-layers').onclick=ungroupSelectedLayers;
  host.onclick=event=>{
    if(suppressLayerClick){suppressLayerClick=false;return;}
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.layerMenu)showLayerMenu(event,button.dataset.layerMenu);
    else if(button.dataset.layerVisibility)toggleLayerVisibility(button.dataset.layerVisibility);
    else if(button.dataset.layerLock)toggleLayerLock(button.dataset.layerLock);
    else if(button.dataset.layerFold)toggleLayerFolder(button.dataset.layerFold);
    else if(button.dataset.layerGroup)selectLayerGroup(button.dataset.layerGroup,event.shiftKey);
    else if(button.dataset.layer)selectLayerFromEvent(event,button.dataset.layer);
  };
  host.addEventListener('pointerdown',event=>{
    cancelLayerLongPress();
    suppressLayerClick=false;
    if(event.pointerType==='touch'&&event.isPrimary!==false&&event.target.closest('.layer-name')){
      const key=event.target.closest('[data-layer-key]')?.dataset.layerKey;
      if(key){const hold={key,pointerId:event.pointerId,x:event.clientX,y:event.clientY};layerLongPress=hold;
        hold.timer=setTimeout(()=>{if(layerLongPress!==hold)return;showLayerMenu(event,key);suppressLayerClick=true;},500);}
    }
    const dragTarget=event.target.closest('[data-layer-drag]');if(event.button!==0||!dragTarget||dragTarget.disabled)return;
    // Touching a row scrolls/selects; only its grip starts reordering.
    if(event.pointerType==='touch'&&!event.target.closest('.layer-grip'))return;
    const key=dragTarget.dataset.layerDrag;if(layerMembers(key).some(it=>it.locked))return;
    // Capture only once a drag starts; stationary clicks must reach the name.
    const row=event.target.closest('[data-layer-key]');layerPointerDrag={key,pointerId:event.pointerId,x:event.clientX,y:event.clientY,moved:false,row:row?.dataset?.layerKey===key?row:null};
  });
  host.addEventListener('pointermove',event=>{
    if(layerLongPress?.pointerId===event.pointerId&&Math.hypot(event.clientX-layerLongPress.x,event.clientY-layerLongPress.y)>8)cancelLayerLongPress();
    const gesture=layerPointerDrag;if(!gesture||gesture.pointerId!==event.pointerId)return;
    if(!gesture.moved&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<8)return;
    event.preventDefault();if(!gesture.moved)host.setPointerCapture(event.pointerId);gesture.moved=true;if(!gesture.ghost)beginLayerDragVisual(gesture,event);const bounds=host.getBoundingClientRect();
    if(event.clientY<bounds.top+28)host.scrollTop-=18;else if(event.clientY>bounds.bottom-28)host.scrollTop+=18;
    const drop=layerDropAt(gesture,event);gesture.target=drop?.target||null;gesture.position=drop?.position||null;gesture.insertIndex=drop?.insertIndex??null;
    const dropSignature=drop?`${drop.target}:${drop.position}`:'';if(gesture.dropSignature!==dropSignature){host.querySelectorAll('[data-drop]').forEach(el=>el.removeAttribute('data-drop'));if(drop?.row)drop.row.dataset.drop=drop.position;gesture.dropSignature=dropSignature}updateLayerDragVisual(gesture,event);
  });
  host.addEventListener('pointerup',event=>{if(layerPointerDrag?.pointerId===event.pointerId)finishLayerPointer();});
  window.addEventListener('pointerup',event=>{if(layerLongPress?.pointerId===event.pointerId)cancelLayerLongPress();if(layerPointerDrag?.pointerId===event.pointerId)finishLayerPointer();});
  for(const event of ['pointercancel','lostpointercapture'])host.addEventListener(event,()=>{cancelLayerLongPress();finishLayerPointer(true);});
  host.addEventListener('scroll',()=>{cancelLayerLongPress();closeLayerMenu();},{passive:true});
  host.addEventListener('contextmenu',event=>{if(event.target.closest('[data-layer-key]'))showLayerMenu(event);});
  host.addEventListener('keydown',event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10')showLayerMenu(event);});
  const menu=document.getElementById('layer-context-menu');
  menu.addEventListener('click',event=>{const action=event.target.closest('[data-layer-action]');if(action&&!action.disabled)runLayerAction(action.dataset.layerAction);});
  menu.addEventListener('keydown',event=>{
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();
    const buttons=[...menu.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
    buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
  });
  window.addEventListener('pointerdown',event=>{
    if(layerLongPress&&layerLongPress.pointerId!==event.pointerId)cancelLayerLongPress();
    if(!menu.hidden&&!menu.contains(event.target))closeLayerMenu();
  },true);
  window.addEventListener('resize',()=>{cancelLayerLongPress();closeLayerMenu();});
  window.addEventListener('blur',()=>{cancelLayerLongPress();closeLayerMenu();finishLayerPointer(true);});
  window.addEventListener('keydown',event=>{
    if(!menu.hidden&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeLayerMenu(true);return;}
    if(!menu.hidden){
      const action=(event.ctrlKey||event.metaKey)?({c:'copy',v:'paste'}[event.key.toLowerCase()]):(['Delete','Backspace'].includes(event.key)?'delete':null);
      if(action){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)runLayerAction(action);return;}
      if(event.key==='Tab'||(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z')closeLayerMenu();
    }
    if(layerPointerDrag&&(event.key==='Escape'||((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'))){event.preventDefault();event.stopImmediatePropagation();finishLayerPointer(true);}
  },true);
}
