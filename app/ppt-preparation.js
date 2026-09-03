/* Idle, latest-only native preparation. Never writes the system clipboard. */
const pptCacheSession = crypto.randomUUID();
let pptPreparePromise = null, pptPrepareRetryAt = 0;
function pptKey(value) {
  let hash=2166136261;for(const char of value)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return (hash>>>0).toString(36);
}
function nativeRequestBody(sourceItems=items) {
  const payload=JSON.parse(nativeBody(sourceItems));
  payload.items=payload.items.map(({locked,layerGroup,name,autoTraceBatch,...item})=>item);
  const all=exportableItems(items),selected=exportableItems(sourceItems);
  const scope=selected.length===all.length&&selected.every((it,i)=>it.id===all[i].id)
    ?'all':'selection-'+pptKey(JSON.stringify(selected.map(it=>it.id)));
  payload.cacheId=pptCacheSession+':'+pptKey(String(activeProjectId)+':'+String(activePageId))+':'+scope;
  return JSON.stringify(payload);
}
function canPreparePpt() {
  return HAS_NATIVE_PPT_BRIDGE || (typeof canWebPptPrepare==='function' && canWebPptPrepare());
}
function pptCacheLabel(text) {const label=document.getElementById('copy-ppt-mode');if(label)label.textContent=text;}
function queueNativePrepare() {
  clearTimeout(pptPrepareTimer);
  if(!workspaceReady||!canPreparePpt()||pptCopyRunning||Date.now()<pptPrepareRetryAt)return;
  // Serialize curves only after editing pauses, not on every pointermove/render.
  pptPrepareTimer=setTimeout(()=>{
    if(pptCopyRunning||drag||traceDraft||!canPreparePpt()||!exportableItems(items).length)return;
    const body=nativeRequestBody(items);
    pptPrepareWanted=body===pptPreparedBody&&!pptPrepareRunning?null:body;
    runNativePrepare();
  },650);
}
function runNativePrepare() {
  if(pptPreparePromise)return pptPreparePromise;
  pptPreparePromise=(async()=>{
    pptPrepareRunning=true;
    try {
      while(pptPrepareWanted&&!pptCopyRunning&&canPreparePpt()){
        const body=pptPrepareWanted;pptPrepareWanted=null;
        if(body===pptPreparedBody)continue;
        pptCacheLabel('背景準備…');
        try {
          const result=HAS_NATIVE_PPT_BRIDGE
            ?await readNativeStream(await fetch('/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body}),()=>{})
            :await requestWebPptPrepare(body);
          if(!result.prepared||!(result.count>0))throw new Error('Native preparation not confirmed');
          pptPreparedBody=body;pptPrepareRetryAt=0;
          if(!pptCopyRunning)pptCacheLabel('快取就緒');
        } catch(error) {
          pptPreparedBody=null;pptPrepareWanted=null;pptPrepareRetryAt=Date.now()+15000;
          if(!pptCopyRunning)pptCacheLabel('按下時準備');
          break;
        }
      }
    } finally {pptPrepareRunning=false;}
  })().finally(()=>{pptPreparePromise=null;});
  return pptPreparePromise;
}
function noteNativeCopy(body,result) {
  pptPrepareRetryAt=0;
  // A subset lives in its own backend cache; it must not replace the full-scene fingerprint.
  if(body===nativeRequestBody(items))pptPreparedBody=body;
  pptCacheLabel(result.cached?'快取複製':result.incremental?'增量更新':'可編輯物件');
}
