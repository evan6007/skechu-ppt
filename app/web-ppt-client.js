/* Copy connects directly to the installed loopback service.
 * Browser local-network permission stays browser-controlled. No popup. */
const WEB_PPT_ORIGIN = 'http://127.0.0.1:8766';
let webPptSession = null, webPptConnecting = null;
let webPptPending = false, webPptPreparation = false;
const webPptFrameJobs=new Map();
function webPptError(message, code) {
  const error = new Error(message); error.code = code; return error;
}
function canWebPptPrepare() {return !!webPptSession?.capabilities.includes('prepare');}
function webPptConnectionError() {
  return webPptError('Ctrl+C 尚未寫入 PPT 剪貼簿：本機連接服務無法使用。請確認 Windows 版已啟動，並允許瀏覽器連接此裝置', 'WEB_PPT_CONNECT');
}
function connectWebPptFrame() {
  // Compatibility with a running bridge whose static helper is newer than its
  // HTTP routes. Negotiate first; never send drawing data or retry a copy here.
  if(typeof document==='undefined'||!document.createElement) return Promise.reject(webPptConnectionError());
  return new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe'),channel=crypto.randomUUID();
    frame.hidden=true;frame.tabIndex=-1;frame.title='PowerPoint 背景連接';
    frame.setAttribute('aria-hidden','true');
    frame.setAttribute('sandbox','allow-scripts allow-same-origin');
    frame.setAttribute('allow','local-network-access; local-network; loopback-network');
    const session={transport:'frame',frame,channel,capabilities:[]};
    let connected=false;
    const dispose=(error=webPptConnectionError())=>{frame.remove();window.removeEventListener('message',message);if(webPptSession===session)webPptSession=null;for(const job of webPptFrameJobs.values())if(job.session===session)job.finish(error);};
    session.dispose=dispose;
    const timer=setTimeout(()=>{dispose();reject(webPptConnectionError());},6000);
    const message=event=>{
      const data=event.data;
      if(event.origin!==WEB_PPT_ORIGIN||event.source!==frame.contentWindow||data?.kind!=='skechu-ppt'||data.channel!==channel)return;
      if(data.type==='ready'&&!connected){
        if(!data.capabilities?.includes('inline-copy')){clearTimeout(timer);dispose();reject(webPptError('本機連接元件較舊，請更新 Windows 版','WEB_PPT_UPDATE'));return;}
        frame.contentWindow.postMessage({kind:'skechu-ppt',type:'connect',channel},WEB_PPT_ORIGIN);
      } else if(data.type==='approved'&&!connected){
        if(!data.capabilities?.includes('inline-copy'))return;
        connected=true;clearTimeout(timer);session.capabilities=data.capabilities;webPptSession=session;resolve(session);
      } else if(data.type==='revoked'){
        dispose();
      } else if(connected){
        const job=webPptFrameJobs.get(data.id);if(!job||job.session!==session)return;
        if(data.type==='progress')job.progress(data.event);
        else if(data.type===job.resultType){
          const result=data.result,ok=result?.ok&&result.count>0&&(job.kind!=='prepare'||result.prepared);
          job.finish(ok?null:new Error(result?.error||'尚未確認 PowerPoint 作業完成'),result);
        }
      }
    };
    window.addEventListener('message',message);
    const args=new URLSearchParams({origin:location.origin,channel});
    frame.src=WEB_PPT_ORIGIN+'/web-ppt.html?v=60-keyboard-copy&session='+channel+'#'+args;
    document.body.appendChild(frame);
  });
}
function runWebPptFrameOperation(kind,body,progress) {
  const session=webPptSession;
  if(!session?.frame?.isConnected)return Promise.reject(webPptConnectionError());
  return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const timer=setTimeout(()=>session.dispose(webPptError('PowerPoint 作業逾時，尚未確認複製完成','WEB_PPT_INTERRUPTED')),180000);
    const finish=(error,result)=>{clearTimeout(timer);webPptFrameJobs.delete(id);if(error)reject(error);else resolve(result);};
    webPptFrameJobs.set(id,{session,kind,resultType:kind==='prepare'?'prepare-result':'result',progress,finish});
    try{session.frame.contentWindow.postMessage({kind:'skechu-ppt',type:kind,channel:session.channel,id,body},WEB_PPT_ORIGIN);}
    catch(error){finish(error);}
  });
}
async function connectWebPpt(progress) {
  if(webPptSession)return webPptSession;
  if(webPptConnecting)return webPptConnecting;
  if(!['https:','http:'].includes(location.protocol))throw webPptError('請從 Skechu 網頁或本機服務開啟，不能直接從 HTML 檔連接', 'WEB_PPT_CONNECT');
  progress({stage:'正在連接 PowerPoint；首次使用若出現本機網路提示，請允許',percent:0});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  webPptConnecting=(async()=>{
    let response;
    try {
      response=await fetch(WEB_PPT_ORIGIN+'/web-ppt/status',{
        mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal,
      });
    } catch (_) {return connectWebPptFrame();}
    if(!response.ok)return connectWebPptFrame();
    const info=await response.json().catch(()=>null);
    if(!info?.ok||info.protocol!==1||!Array.isArray(info.capabilities)||!info.capabilities.includes('inline-copy')){
      return connectWebPptFrame();
    }
    webPptSession={capabilities:info.capabilities};return webPptSession;
  })();
  try {return await webPptConnecting;}
  finally {clearTimeout(timer);webPptConnecting=null;}
}
async function runWebPptOperation(kind,body,progress) {
  if(webPptSession?.transport==='frame')return runWebPptFrameOperation(kind,body,progress);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);
  try {
    let response;
    try {
      response=await fetch(WEB_PPT_ORIGIN+'/web-ppt/'+kind,{
        method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
        headers:{'Content-Type':'application/json'},body,signal:controller.signal,
      });
    } catch (_) {
      webPptSession=null;
      throw webPptError(kind==='copy'
        ?'連線中斷，尚未確認複製完成。請確認 Windows 版仍在執行，再自行重試'
        :'背景準備連線中斷','WEB_PPT_INTERRUPTED');
    }
    let result;
    try {result=await readNativeStream(response,progress);}
    catch(error) {
      if(controller.signal.aborted||error?.name==='TypeError')webPptSession=null;
      if(controller.signal.aborted)throw webPptError('PowerPoint 作業逾時，尚未確認完成；請確認本機服務後再重試','WEB_PPT_INTERRUPTED');
      throw error;
    }
    if(!(result?.count>0)||kind==='prepare'&&!result.prepared)throw new Error('尚未確認 PowerPoint 作業完成');
    return result;
  } finally {clearTimeout(timer);}
}
async function requestWebPptCopy(body,progress=()=>{}) {
  if(webPptPending)throw new Error('另一個複製作業尚未完成');
  webPptPending=true;
  try {
    await connectWebPpt(progress);
    progress({stage:webPptPreparation?'正在優先複製選取物件':'正在建立可編輯物件',percent:1});
    // Never retry a POST automatically: a lost response may follow a completed write.
    return await runWebPptOperation('copy',body,progress);
  } finally {webPptPending=false;}
}
async function requestWebPptPrepare(body,progress=()=>{}) {
  if(!canWebPptPrepare()||webPptPending||webPptPreparation)throw new Error('背景連接尚未就緒');
  webPptPreparation=true;
  try {return await runWebPptOperation('prepare',body,progress);}
  finally {webPptPreparation=false;}
}
async function cancelWebPptPrepare() {
  if(!webPptPreparation||!webPptSession?.capabilities.includes('cancel-prepare'))return;
  if(webPptSession.transport==='frame'){
    webPptSession.frame.contentWindow.postMessage({kind:'skechu-ppt',type:'cancel-prepare',channel:webPptSession.channel},WEB_PPT_ORIGIN);return;
  }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try {
    await fetch(WEB_PPT_ORIGIN+'/web-ppt/cancel-prepare',{
      method:'POST',mode:'cors',credentials:'omit',headers:{'Content-Type':'application/json'},body:'{}',signal:controller.signal,
    });
  } catch (_) {/* The next copy still has server-side priority. */}
  finally {clearTimeout(timer);}
}
function initializeWebPptClient() {/* No request or permission prompt until Copy. */}
