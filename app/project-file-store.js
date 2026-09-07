/* Disk-backed SKC document state. Browser workspace recovery is independent.
 * No guessed paths, HTTP file writer, background permission prompt or writes
 * before a user-selected FileSystemFileHandle has been authorized. */
const ProjectFileStore=(()=>{
 const encode=text=>new TextEncoder().encode(text);
 const serialize=project=>JSON.stringify({version:2,project},null,2);
 async function hash(bytes){const digest=await crypto.subtle.digest('SHA-256',typeof bytes==='string'?encode(bytes):bytes);return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')}
 async function fingerprint(handle){return hash(await(await handle.getFile()).arrayBuffer())}
 function create({persist=async()=>{},notify=()=>{},lock=(_name,job)=>job(),delay=1200}={}){
  const records=new Map();
  const report=(r,message,error=false)=>{r.message=message;r.error=error;notify(r)};
  const remember=r=>persist({id:r.id,handle:r.handle,name:r.name,diskHash:r.diskHash,savedHash:r.savedHash,auto:r.auto}).catch(error=>{r.persistenceError=true;console.warn('Cannot remember SKC handle:',error.name);notify(r)});
  async function attach(project,handle,{diskHash,savedHash,auto=true}={}){
   const old=records.get(project.id);if(old){clearTimeout(old.timer);if(old.running)await old.running}
   const text=serialize(project),r={id:project.id,handle,name:handle.name,auto,diskHash:diskHash??await fingerprint(handle),savedHash:savedHash??await hash(text),lastSavedText:savedHash?null:text,wantedText:text,timer:null,running:null,blocked:false};records.set(r.id,r);
   if(await hash(text)===r.savedHash)r.lastSavedText=text;
   try{r.permission=await handle.queryPermission({mode:'readwrite'})}catch{r.permission='prompt'}
   report(r,r.permission==='granted'?(r.lastSavedText===text?'原檔已連結':'有尚未回存的修改'):'按 Ctrl+S 授權回存原檔');await remember(r);return r;
  }
  async function authorize(r,manual){
   try{
   let permission=await r.handle.queryPermission({mode:'readwrite'});
   if(permission!=='granted'&&manual)permission=await r.handle.requestPermission({mode:'readwrite'});
   r.permission=permission;
   if(permission!=='granted'){report(r,'尚未回存原檔 · 按 Ctrl+S 授權',true);return false}return true;
   }catch(error){report(r,'未取得寫入授權：'+(error.message||error.name),true);return false}
  }
  async function write(r,text){
   const bytes=encode(text);if(bytes.length>32*1024*1024)throw Error('專案超過 32 MB，請拆分專案；原檔未覆蓋');
   const targetHash=await hash(bytes);
   if(targetHash===r.savedHash){r.lastSavedText=text;return}
   await lock('skechu-skc:'+r.name,async()=>{
    // Fingerprints, not just timestamps, catch OneDrive/other-tab changes.
    if(await fingerprint(r.handle)!==r.diskHash)throw Error('原檔已被其他程式或視窗修改，已停止回存；請另存新檔');
    let stream;try{
     stream=await r.handle.createWritable({mode:'exclusive'});await stream.write(bytes);
     if(await fingerprint(r.handle)!==r.diskHash)throw Error('寫入期間原檔已變更，已停止覆蓋；請另存新檔');
     await stream.close();stream=null;
    }catch(error){if(stream)try{await stream.abort()}catch{}throw error}
    // Advance the disk baseline only after the atomic close succeeded.
    r.diskHash=targetHash;r.savedHash=targetHash;r.lastSavedText=text;await remember(r);
   });
  }
  function pump(r){
   if(r.running)return r.running;
   r.running=Promise.resolve().then(async()=>{try{
    while(r.wantedText!==r.lastSavedText){
     if(!r.auto&&!r.manualFlush){report(r,'有尚未回存的修改');return false}r.manualFlush=false;
     if(!await authorize(r,false))return false;
     const text=r.wantedText;report(r,'正在回存原檔…');await write(r,text);
    }
    r.blocked=false;report(r,'已回存原檔');return true;
   }catch(error){r.blocked=true;report(r,'回存失敗：'+(error.message||error.name),true);return false}
   }).finally(()=>{r.running=null;notify(r)});return r.running;
  }
  function observe(projects){
   for(const project of projects){const r=records.get(project.id);if(!r)continue;r.wantedText=serialize(project);
    clearTimeout(r.timer);r.timer=null;
    if(r.wantedText===r.lastSavedText){if(!r.running&&!r.error)report(r,r.auto?'已回存原檔':'原檔已儲存 · 自動回存關閉');continue}
    if(r.blocked){notify(r);continue}report(r,r.auto?'修改待回存…':'有尚未回存的修改');
    if(r.auto&&!r.running)r.timer=setTimeout(()=>{r.timer=null;pump(r)},delay);
   }
  }
  async function save(project,{manual=true}={}){
   const r=records.get(project.id);if(!r)return false;r.wantedText=serialize(project);clearTimeout(r.timer);r.timer=null;
   if(!await authorize(r,manual))return false;
   if(manual&&!r.running&&r.wantedText===r.lastSavedText)try{
    if(await fingerprint(r.handle)!==r.diskHash)throw Error('原檔已被其他程式或視窗修改，請另存新檔或重新載入');
   }catch(error){r.blocked=true;report(r,'回存未完成：'+(error.message||error.name),true);return false}
   r.blocked=false;r.manualFlush=manual;return pump(r);
  }
  function hasPending(projects){return projects.some(p=>{const r=records.get(p.id);return r&&(!!r.running||serialize(p)!==r.lastSavedText)})}
  async function setAuto(id,value){const r=records.get(id);if(!r)return;r.auto=!!value;clearTimeout(r.timer);r.timer=null;await remember(r);notify(r)}
  async function find(handle){for(const r of records.values())if(await r.handle.isSameEntry(handle))return r;return null}
  return{records,attach,observe,save,hasPending,setAuto,find};
 }
 return{create,hash,fingerprint,serialize};
})();
