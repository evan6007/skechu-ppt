/* Layer folders are metadata on the original editable items, never flattened paths.
 * Keeping metadata in items preserves the existing project and Undo format. */
let layerPointerDrag = null, suppressLayerClick = false;
function layerGroupOf(it) {
  if (Object.prototype.hasOwnProperty.call(it, 'layerGroup')) return it.layerGroup;
  // Existing projects gain a collapsed folder without rewriting their geometry.
  return it.autoTraceBatch ? {id: 'trace-' + it.autoTraceBatch, name: '自動描圖', collapsed: true} : null;
}
function layerEntries(source = items) {
  const entries = [], groups = new Map();
  const ordered = [...source.filter(it => it.referenceOnly), ...source.filter(it => !it.referenceOnly)].reverse();
  for (const it of ordered) {
    const group = layerGroupOf(it);
    if (!group) { entries.push({key: 'item:' + it.id, members: [it]}); continue; }
    // References stay beneath vector artwork even if imported with invalid folder metadata.
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
    <button type="button" class="layer-name" ${group?`data-layer-group="${safeKey}"`:`data-layer="${esc(members[0].id)}"`} title="${safeName}" aria-pressed="${all}">${group?layerIcon('folder'):`<i class="dot ${esc(members[0].type)}"></i>`}<span>${safeName}</span>${group?`<small>${members.length}</small>`:''}</button>
    <button type="button" class="layer-eye ${hidden?'eye-off':partialHidden?'mixed':''}" data-layer-visibility="${safeKey}" aria-label="${hidden?'顯示':'隱藏'}：${safeName}" aria-pressed="${!hidden}" title="${partialHidden?'部分隱藏；點一下隱藏整組':hidden?'顯示圖層':'隱藏圖層（匯出時也排除）'}">${layerIcon(hidden?'eyeOff':'eye')}</button>
    <button type="button" class="layer-lock ${locked?'locked':mixed?'mixed':''}" data-layer-lock="${safeKey}" aria-label="${locked?'解除鎖定':'鎖定'}：${safeName}" aria-pressed="${locked}" title="${mixed?'部分鎖定；點一下鎖定整組':locked?'點一下解除鎖定':'點一下鎖定'}">${layerIcon(locked?'lock':'unlock')}</button>
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
  const moving = layerMembers(sourceKey), targets = layerMembers(targetKey);
  if (!moving.length || !targets.length || moving.some(it=>it.locked) || moving.some(it=>targets.includes(it))) return false;
  if (moving.some(it=>it.referenceOnly) !== targets.some(it=>it.referenceOnly)) { paintStatus('底圖固定在線圖下方；只能在同類圖層之間排序'); return false; }
  const ids = new Set(moving.map(it=>it.id)), movingInOrder = items.filter(it=>ids.has(it.id)), rest = items.filter(it=>!ids.has(it.id));
  const intoGroup = targetKey.startsWith('group:') && position === 'inside';
  const group = intoGroup || !targetKey.startsWith('group:') ? layerGroupOf(targets[0]) : null;
  if (intoGroup && sourceKey.startsWith('group:')) return false; // One level of folders, no accidental nesting.
  if (group && targets.some(it=>it.locked)) { paintStatus('請先解鎖目標群組，再加入圖層'); return false; }
  const indices = targets.map(it=>rest.indexOf(it));
  const index = position==='below' ? Math.min(...indices) : Math.max(...indices)+1;
  const next = rest.slice(); next.splice(index,0,...movingInOrder);
  const changesFolder = sourceKey.startsWith('item:') && moving.some(it=>layerGroupOf(it)?.id !== group?.id);
  if (!changesFolder && next.every((it,i)=>it===items[i])) return false;
  commit();
  if (sourceKey.startsWith('item:')) moving.forEach(it=>it.layerGroup=group?{...group}:null);
  // Preserve all unrelated fill ranks; explicit reordering takes precedence over paint recency.
  const fillStack = items.filter(renderedFillIsVisible).sort((a,b)=>fillOrderValue(a)-fillOrderValue(b));
  const movingFills = fillStack.filter(it=>ids.has(it.id)), targetFills = targets.filter(renderedFillIsVisible);
  if (movingFills.length && targetFills.length) {
    const remaining = fillStack.filter(it=>!ids.has(it.id)), slots = targetFills.map(it=>remaining.indexOf(it));
    remaining.splice(position==='below'?Math.min(...slots):Math.max(...slots)+1,0,...movingFills);
    remaining.forEach((it,i)=>it.fillOrder=i+1);
  }
  items = next; render(); paintStatus(intoGroup?'已加入群組；可展開精修':'已調整圖層順序；線條仍在線色塊上方'); return true;
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
  if(!cancel&&gesture.moved&&gesture.target)moveLayerEntry(gesture.key,gesture.target,gesture.position);
}
function initializeLayerControls() {
  const host=document.getElementById('layers');
  document.getElementById('group-layers').onclick=groupSelectedLayers;
  document.getElementById('ungroup-layers').onclick=ungroupSelectedLayers;
  host.onclick=event=>{
    if(suppressLayerClick){suppressLayerClick=false;return;}
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.layerVisibility)toggleLayerVisibility(button.dataset.layerVisibility);
    else if(button.dataset.layerLock)toggleLayerLock(button.dataset.layerLock);
    else if(button.dataset.layerFold)toggleLayerFolder(button.dataset.layerFold);
    else if(button.dataset.layerGroup)selectLayerGroup(button.dataset.layerGroup,event.shiftKey);
    else if(button.dataset.layer)selectLayerFromEvent(event,button.dataset.layer);
  };
  host.addEventListener('pointerdown',event=>{
    suppressLayerClick=false;
    const grip=event.target.closest('[data-layer-drag]');if(event.button!==0||!grip||grip.disabled)return;
    event.preventDefault();layerPointerDrag={key:grip.dataset.layerDrag,pointerId:event.pointerId,x:event.clientX,y:event.clientY,moved:false};host.setPointerCapture(event.pointerId);
  });
  host.addEventListener('pointermove',event=>{
    const gesture=layerPointerDrag;if(!gesture||gesture.pointerId!==event.pointerId)return;
    if(!gesture.moved&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<4)return;
    gesture.moved=true;const bounds=host.getBoundingClientRect();
    if(event.clientY<bounds.top+28)host.scrollTop-=18;else if(event.clientY>bounds.bottom-28)host.scrollTop+=18;
    host.querySelectorAll('[data-drop]').forEach(el=>el.removeAttribute('data-drop'));
    const row=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-layer-key]');
    gesture.target=null;if(!row||!host.contains(row))return;
    const rect=row.getBoundingClientRect(),fraction=(event.clientY-rect.top)/rect.height;
    gesture.position=row.dataset.layerKey.startsWith('group:')&&!gesture.key.startsWith('group:')&&fraction>.28&&fraction<.72?'inside':fraction<.5?'above':'below';
    gesture.target=row.dataset.layerKey;row.dataset.drop=gesture.position;
  });
  host.addEventListener('pointerup',event=>{if(layerPointerDrag?.pointerId===event.pointerId)finishLayerPointer();});
  for(const event of ['pointercancel','lostpointercapture'])host.addEventListener(event,()=>finishLayerPointer(true));
  window.addEventListener('blur',()=>finishLayerPointer(true));
  window.addEventListener('keydown',event=>{
    if(layerPointerDrag&&(event.key==='Escape'||((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'))){event.preventDefault();event.stopImmediatePropagation();finishLayerPointer(true);}
  },true);
}
