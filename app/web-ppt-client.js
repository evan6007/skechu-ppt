/* Copy connects directly to the installed loopback service.
 * Browser local-network permission stays browser-controlled. No popup or iframe. */
const WEB_PPT_ORIGIN = 'http://127.0.0.1:8766';
let webPptSession = null, webPptConnecting = null;
let webPptPending = false, webPptPreparation = false;
function webPptError(message, code) {
  const error = new Error(message); error.code = code; return error;
}
function canWebPptPrepare() {return !!webPptSession?.capabilities.includes('prepare');}
function webPptConnectionError() {
  return webPptError('請先啟動 Windows 版 Skechu-PPT，再按一次複製。若瀏覽器詢問本機網路存取，請允許；服務已啟動仍無法連線時，請更新 Windows 版', 'WEB_PPT_CONNECT');
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
    } catch (_) {throw webPptConnectionError();}
    if(!response.ok)throw webPptError('請更新並重新啟動 Windows 版 Skechu-PPT，即可在此頁直接複製','WEB_PPT_UPDATE');
    const info=await response.json().catch(()=>null);
    if(!info?.ok||info.protocol!==1||!Array.isArray(info.capabilities)||!info.capabilities.includes('inline-copy')){
      throw webPptError('本機服務版本較舊，請更新 Windows 版 Skechu-PPT','WEB_PPT_UPDATE');
    }
    webPptSession={capabilities:info.capabilities};return webPptSession;
  })();
  try {return await webPptConnecting;}
  finally {clearTimeout(timer);webPptConnecting=null;}
}
async function runWebPptOperation(kind,body,progress) {
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
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try {
    await fetch(WEB_PPT_ORIGIN+'/web-ppt/cancel-prepare',{
      method:'POST',mode:'cors',credentials:'omit',headers:{'Content-Type':'application/json'},body:'{}',signal:controller.signal,
    });
  } catch (_) {/* The next copy still has server-side priority. */}
  finally {clearTimeout(timer);}
}
function initializeWebPptClient() {/* No request or permission prompt until Copy. */}
