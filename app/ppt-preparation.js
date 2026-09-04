/* Idle, latest-only native preparation. Never writes the system clipboard. */
function stablePptCacheSession() {
  const key='skechu-ppt-cache-session-v1';
  try {
    const saved=sessionStorage.getItem(key);
    if(saved)return saved;
    const created=crypto.randomUUID();sessionStorage.setItem(key,created);return created;
  } catch(_) {return crypto.randomUUID()}
}
const pptCacheSession = stablePptCacheSession();
let pptPreparePromise = null, pptPrepareRetryAt = 0, pptPreparingBody = null;
let pptPrepareCancelPromise = null, pptPrepareProgressTimer = null, pptPrepareProgressEvent = null;
const PPT_PREPARE_IDLE_MS = 1800;
const PPT_PROGRESS_REVEAL_MS = 450;
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
function paintPptPrepareProgress(event={}) {
  if(pptCopyRunning)return;
  const bar=document.getElementById('ppt-progress');if(!bar)return;
  const percent=Math.max(0,Math.min(100,Number(event.percent)||0));
  const count=event.total?` ${event.current||0}/${event.total}`:'';
  const stage=event.stage||'準備 PowerPoint 快取';
  bar.hidden=false;bar.value=percent;
  bar.title=`${stage}${count}（${percent}%）`;
  bar.setAttribute('aria-label',`PowerPoint 背景快取：${stage}${count}，${percent}%`);
  pptCacheLabel(percent>=100?'快取就緒':`準備 ${percent}%`);
}
function showPptPrepareProgress(event={}) {
  if(pptCopyRunning)return;
  pptPrepareProgressEvent=event;
  const bar=document.getElementById('ppt-progress');if(!bar)return;
  // Incremental updates normally finish in well under this delay.  Keeping
  // them silent prevents the toolbar from flashing "preparing" after every
  // tiny edit while still showing progress for a genuinely long cold build.
  if(!bar.hidden){paintPptPrepareProgress(event);return}
  if(pptPrepareProgressTimer)return;
  pptPrepareProgressTimer=setTimeout(()=>{
    pptPrepareProgressTimer=null;
    if(pptPrepareProgressEvent)paintPptPrepareProgress(pptPrepareProgressEvent);
  },PPT_PROGRESS_REVEAL_MS);
}
function finishPptPrepareProgress(ready) {
  if(pptCopyRunning)return;
  clearTimeout(pptPrepareProgressTimer);pptPrepareProgressTimer=null;pptPrepareProgressEvent=null;
  const bar=document.getElementById('ppt-progress');if(!bar)return;
  if(ready){bar.value=100;pptCacheLabel('快取就緒');}
  bar.hidden=true;
}
function cancelSupersededNativePrepare(nextBody) {
  if(!HAS_NATIVE_PPT_BRIDGE||!pptPrepareRunning||!pptPreparingBody||nextBody===pptPreparingBody||pptPrepareCancelPromise)return;
  pptPrepareCancelPromise=fetch('/cancel-prepare',{method:'POST'})
    .catch(()=>null)
    .finally(()=>{pptPrepareCancelPromise=null});
}
function queueNativePrepare() {
  clearTimeout(pptPrepareTimer);
  if(!workspaceReady||!canPreparePpt()||pptCopyRunning||Date.now()<pptPrepareRetryAt)return;
  // If a cold build is already working on an older scene, stop it now.  The
  // newest state will be submitted only after the user has actually paused.
  if(pptPrepareRunning)cancelSupersededNativePrepare(nativeRequestBody(items));
  // Serialize curves only after editing pauses, not on every pointermove/render.
  pptPrepareTimer=setTimeout(()=>{
    if(pptCopyRunning||drag||traceDraft||!canPreparePpt()||!exportableItems(items).length)return;
    const body=nativeRequestBody(items);
    pptPrepareWanted=body===pptPreparedBody&&!pptPrepareRunning?null:body;
    runNativePrepare();
  },PPT_PREPARE_IDLE_MS);
}
function runNativePrepare() {
  if(pptPreparePromise)return pptPreparePromise;
  pptPreparePromise=(async()=>{
    pptPrepareRunning=true;let lastResult=null;
    try {
      while(pptPrepareWanted&&!pptCopyRunning&&canPreparePpt()){
        const body=pptPrepareWanted;pptPrepareWanted=null;
        if(body===pptPreparedBody)continue;
        pptPreparingBody=body;
        showPptPrepareProgress({percent:1,stage:'啟動背景準備'});
        try {
          const progress=event=>showPptPrepareProgress(event);
          const result=HAS_NATIVE_PPT_BRIDGE
            ?await readNativeStream(await fetch('/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body}),progress)
            :await requestWebPptPrepare(body,progress);
          if(!result.prepared||!(result.count>0))throw new Error('Native preparation not confirmed');
          lastResult=result;pptPreparedBody=body;pptPrepareRetryAt=0;
          finishPptPrepareProgress(true);
        } catch(error) {
          const yielded=String(error?.message||error).includes('背景準備已讓位');
          if(!yielded){pptPreparedBody=null;pptPrepareWanted=null;pptPrepareRetryAt=Date.now()+15000}
          else pptPrepareRetryAt=0;
          finishPptPrepareProgress(false);if(!pptCopyRunning)pptCacheLabel(yielded?'待更新':'按下時準備');
          // The idle timer may already have supplied a newer body while the
          // obsolete request was cancelling.  Continue straight to that one;
          // otherwise exit and let the still-pending idle timer restart us.
          if(yielded&&pptPrepareWanted&&!pptCopyRunning)continue;
          break;
        } finally {if(pptPreparingBody===body)pptPreparingBody=null}
      }
      return lastResult;
    } finally {pptPrepareRunning=false;pptPreparingBody=null;}
  })().finally(()=>{pptPreparePromise=null;});
  return pptPreparePromise;
}
function noteNativeCopy(body,result) {
  pptPrepareRetryAt=0;
  // A subset lives in its own backend cache; it must not replace the full-scene fingerprint.
  if(body===nativeRequestBody(items))pptPreparedBody=body;
  pptCacheLabel(result.cached?'快取複製':result.incremental?'增量更新':'可編輯物件');
}
