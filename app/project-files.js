/* File handles stay in origin-local IndexedDB, never in exported SKC JSON. */
let projectFileController=null,projectFileDb=null,projectFilePickerBusy=false;
const projectFileNames=new Map();
function openProjectFileDb(){
 if(!projectFileDb)projectFileDb=new Promise((resolve,reject)=>{const request=indexedDB.open(WORKSPACE_DB_NAME+'-file-links',1);request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});return projectFileDb;
}
async function persistProjectFile(record){const db=await openProjectFileDb();await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
function refreshProjectFileStatus(){
 const r=projectFileController?.records.get(activeProjectId),node=document.getElementById('file-save-status'),toggle=document.getElementById('file-auto-save');if(!node)return;
 node.textContent=r?`${r.message} · ${r.name}`:'未連結原檔 · Ctrl+S 儲存';node.title=r?`${r.name}\n${r.message}${r.persistenceError?'\n此瀏覽器未能記住檔案連結，下次需重新選檔。':''}`:'瀏覽器暫存不會更新磁碟 SKC。按 Ctrl+S 選擇儲存位置，之後可直接回存。';node.dataset.error=String(!!r?.error);
 if(toggle){toggle.disabled=!r;toggle.checked=r?.auto??true}
 const button=document.getElementById('save-project-file'),detail=document.getElementById('file-save-detail');
 if(button){button.title=node.title;button.setAttribute('aria-label','儲存原 SKC 檔案 · '+node.textContent);button.dataset.error=node.dataset.error}if(detail)detail.textContent=node.textContent;
}
function observeProjectFiles(payload){projectFileController?.observe(payload.projects);refreshProjectFileStatus()}
function projectFileSnapshot(id=activeProjectId){syncActivePage();return projects.find(p=>p.id===id)}
function projectFileMessage(message){document.getElementById('status').textContent=message}
function projectFileEditPending(){return !!drag||!!traceDraft}
async function restoreProjectFiles(){
 try{const db=await openProjectFileDb(),records=await new Promise((resolve,reject)=>{const q=db.transaction('files','readonly').objectStore('files').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
  for(const record of records){const project=projectFileSnapshot(record.id);if(project&&record.handle)try{
   const r=await projectFileController.attach(project,record.handle,record);
   // Browser recovery and disk writes cannot commit in one transaction. Never
   // silently push an older recovered browser snapshot over a newer disk file.
   if(r.wantedText!==r.lastSavedText){r.blocked=true;r.error=true;r.message='復原副本尚未回存 · 請確認內容後按 Ctrl+S'}
  }catch(error){console.warn('SKC handle unavailable:',error.name)}}
 }catch(error){console.warn('SKC links unavailable:',error.name)}refreshProjectFileStatus();
}
async function openLinkedProject(){
 if(projectFilePickerBusy)return;
 if(!window.showOpenFilePicker){document.getElementById('load-json').click();return}
 projectFilePickerBusy=true;
 try{
  const [handle]=await window.showOpenFilePicker({id:'skechu-project',multiple:false,types:[{description:'Skechu 專案',accept:{'application/json':['.skc','.sktc','.sketchou','.json']}}]});
  // Do permission work while still in the explicit picker gesture. A refused
  // write request still permits opening; it must never be retried in the timer.
  let permission=await handle.queryPermission({mode:'readwrite'});if(permission!=='granted')try{permission=await handle.requestPermission({mode:'readwrite'})}catch{}
  const existing=await projectFileController.find(handle);if(existing&&projects.some(p=>p.id===existing.id)){openProject(existing.id);refreshProjectFileStatus();projectFileMessage('此檔案已開啟，已切回現有專案；沒有覆蓋尚未回存的修改');return}
  const file=await handle.getFile(),diskHash=await ProjectFileStore.hash(await file.arrayBuffer()),imported=await importProjectFiles([file]);
  if(imported.length===1){const project=projectFileSnapshot(imported[0].id);await projectFileController.attach(project,handle,{diskHash});projectFileMessage(permission==='granted'?'已連結原 SKC；修改後自動回存，Ctrl+S 可立即儲存':'已開啟；按 Ctrl+S 授權後即可回存原檔')}
  else projectFileMessage('這份檔案包含多個專案，沒有自動覆蓋來源；請將各專案另存為 SKC');
 }catch(error){if(error.name!=='AbortError')projectFileMessage('檔案未開啟：'+(error.message||error.name))}
 finally{projectFilePickerBusy=false;refreshProjectFileStatus()}
}
async function saveLinkedProject(saveAs=false){
 if(projectFilePickerBusy)return;
 if(projectFileEditPending()){projectFileMessage('請先完成目前描線或放開拖曳，再回存原檔');return}
 const projectId=activeProjectId,project=projectFileSnapshot(projectId);if(!project)return;
 const current=projectFileController.records.get(projectId);
 if(current&&!saveAs){const ok=await projectFileController.save(project,{manual:true});projectFileMessage(ok?`已回存 ${current.name}`:current.message);return}
 if(!window.showSaveFilePicker){downloadProjectCopy();projectFileMessage('此瀏覽器不支援直接回存；已下載 SKC，請保留下載檔取代原檔');return}
 projectFilePickerBusy=true;
 try{
  const name=current?.name||projectFileNames.get(projectId)||`${project.name||'skechu-project'}.skc`,safe=name.replace(/[\\/:*?"<>|]/g,'-');
  // Call the picker BEFORE waiting for database/hash work (user activation).
  const handle=await window.showSaveFilePicker({id:'skechu-project',suggestedName:safe,types:[{description:'Skechu 專案',accept:{'application/json':['.skc']}}]});
  const other=await projectFileController.find(handle);if(other&&other.id!==projectId&&projects.some(p=>p.id===other.id))throw Error('此檔案已連結另一個開啟的專案，請選擇不同檔名');
  const snapshot=projectFileSnapshot(projectId);if(!snapshot)throw Error('原專案已關閉，未寫入選取的檔案');
  if(other?.id===projectId){const ok=await projectFileController.save(snapshot,{manual:true});projectFileMessage(ok?`已回存 ${other.name}`:other.message);return}
  const diskHash=await ProjectFileStore.fingerprint(handle);
  await projectFileController.attach(snapshot,handle,{diskHash,savedHash:'new-file',auto:true});
  const ok=await projectFileController.save(projectFileSnapshot(projectId),{manual:true}),r=projectFileController.records.get(projectId);projectFileMessage(ok?`已儲存 ${r.name}；之後會自動回存`:r.message);
 }catch(error){if(error.name!=='AbortError')projectFileMessage('儲存未完成：'+(error.message||error.name))}
 finally{projectFilePickerBusy=false;refreshProjectFileStatus()}
}
function downloadProjectCopy(){const project=projectFileSnapshot();if(!project)return;const safe=(project.name||'skechu-project').replace(/[\\/:*?"<>|]/g,'-');download(new Blob([ProjectFileStore.serialize(deepCopy(project))],{type:'application/json'}),`${safe}.skc`)}
function initializeProjectFiles(){
 projectFileController=ProjectFileStore.create({persist:persistProjectFile,notify:refreshProjectFileStatus,lock:(name,job)=>navigator.locks?navigator.locks.request(name,job):job()});
 document.getElementById('save-json').textContent='儲存原檔 · Ctrl+S';document.getElementById('save-json').onclick=()=>saveLinkedProject();
 document.getElementById('load-button').textContent='開啟 SKC';document.getElementById('load-button').onclick=openLinkedProject;
 document.getElementById('save-json').insertAdjacentHTML('afterend','<button id="save-project-as" type="button">另存新檔 · Ctrl+Shift+S</button><button id="download-project-copy" type="button">下載專案副本</button><label class="file-auto-option"><input id="file-auto-save" type="checkbox" checked disabled>修改後自動回存原檔</label>');
 document.getElementById('file-auto-save').parentElement.insertAdjacentHTML('afterend','<div id="file-save-detail" class="file-save-detail" role="status" aria-live="polite"></div>');
 document.getElementById('autosave-status').insertAdjacentHTML('afterend','<button id="file-save-status" class="file-save-status" type="button" aria-label="原檔儲存狀態">未連結原檔 · Ctrl+S 儲存</button><button id="save-project-file" class="compact" type="button" aria-label="儲存原 SKC 檔案" title="儲存原檔（Ctrl+S）"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 3h13l4 4v14H3V3Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/><path d="M14 4v3"/></svg></button>');
 for(const id of ['save-project-file','file-save-status'])document.getElementById(id).onclick=()=>saveLinkedProject();
 document.getElementById('save-project-as').onclick=()=>saveLinkedProject(true);document.getElementById('download-project-copy').onclick=downloadProjectCopy;
 document.getElementById('file-auto-save').onchange=async event=>{const project=projectFileSnapshot(),enabled=event.target.checked;if(!project)return;const remembered=projectFileController.setAuto(project.id,enabled);if(enabled)await projectFileController.save(project,{manual:true});await remembered;refreshProjectFileStatus()};
 window.addEventListener('keydown',event=>{if(!(event.ctrlKey||event.metaKey)||event.altKey||event.key.toLowerCase()!=='s')return;event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)saveLinkedProject(event.shiftKey)},true);
 window.addEventListener('beforeunload',event=>{syncActivePage();if(projectFileController.hasPending(projects)){event.preventDefault();event.returnValue=''}});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&!projectFileEditPending()){syncActivePage();for(const p of projects){const r=projectFileController.records.get(p.id);if(r?.auto&&!r.blocked)projectFileController.save(p,{manual:false})}}});
 refreshProjectFileStatus();
}
