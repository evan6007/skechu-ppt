/* A user-opened localhost companion writes Office's native clipboard format.
 * No cross-origin HTTP, public upload, clipboard format spoofing or silent PNG fallback. */
let webPptSession = null, webPptPending = null;
const WEB_PPT_ORIGIN = 'http://127.0.0.1:8766';
function finishWebPptRequest(error, result) {
  const pending=webPptPending;if(!pending)return;
  webPptPending=null;clearTimeout(pending.timer);clearInterval(pending.poll);
  if(error)pending.reject(error);else pending.resolve(result);
}
function sendWebPptCopy() {
  if(!webPptPending||!webPptSession?.approved||webPptPending.sent)return;
  webPptPending.sent=true;clearTimeout(webPptPending.timer);
  webPptPending.timer=setTimeout(()=>finishWebPptRequest(new Error('PowerPoint 建立物件逾時；請查看本機連接視窗，勿重複貼上舊內容')),180000);
  webPptSession.popup.postMessage({kind:'skechu-ppt',type:'copy',channel:webPptSession.channel,id:webPptPending.id,body:webPptPending.body},WEB_PPT_ORIGIN);
}
function handleWebPptMessage(event) {
  const session=webPptSession,data=event.data;
  if(!session||event.origin!==WEB_PPT_ORIGIN||event.source!==session.popup||data?.kind!=='skechu-ppt'||data.channel!==session.channel)return;
  if(data.type==='ready') {
    session.ready=true;
    if(webPptPending){clearTimeout(webPptPending.timer);webPptPending.timer=setTimeout(()=>finishWebPptRequest(new Error('尚未允許本機連接；請在連接視窗按「允許連接」後重試')),120000);webPptPending.progress({stage:'請在本機連接視窗按「允許連接」',percent:0});}
  } else if(data.type==='approved'){session.approved=true;sendWebPptCopy();}
  else if(data.type==='revoked'){session.approved=false;finishWebPptRequest(new Error('本機連接已中斷，請重新連接'));}
  else if(webPptPending&&data.id===webPptPending.id){
    if(data.type==='progress')webPptPending.progress(data.event);
    if(data.type==='result')finishWebPptRequest(data.result?.ok&&data.result.count>0?null:new Error(data.result?.error||'尚未確認原生複製成功'),data.result);
  }
}
function requestWebPptCopy(body, progress) {
  if(webPptPending)return Promise.reject(new Error('另一個複製作業尚未完成'));
  if(!['https:','http:'].includes(location.protocol))return Promise.reject(new Error('請從 Open Web 或本機服務開啟，不能直接用 file:// 連接'));
  if(!webPptSession||webPptSession.popup.closed){
    const channel=crypto.randomUUID(),hash=new URLSearchParams({origin:location.origin,channel});
    const popup=window.open(WEB_PPT_ORIGIN+'/web-ppt.html#'+hash,'skechu-ppt-companion','popup,width=500,height=510');
    if(!popup)return Promise.reject(new Error('瀏覽器封鎖了連接視窗；請允許此網站的彈出式視窗後再按一次'));
    webPptSession={popup,channel,ready:false,approved:false};
  } else if(!webPptSession.approved) webPptSession.popup.focus();
  return new Promise((resolve,reject)=>{
    const pending=webPptPending={id:crypto.randomUUID(),body,progress,resolve,reject,sent:false};
    pending.timer=webPptSession.ready
      ?setTimeout(()=>finishWebPptRequest(new Error('請在本機連接視窗按「允許連接」後重試')),120000)
      :setTimeout(()=>{webPptSession=null;finishWebPptRequest(new Error('找不到新版本機連接頁面。請啟動新版 Skechu-PPT Windows 本機服務（8766），再重試；舊版需更新'))},10000);
    pending.poll=setInterval(()=>{if(webPptSession?.popup.closed){webPptSession=null;finishWebPptRequest(new Error('本機連接視窗已關閉；請再按一次複製重新連接'))}},500);
    sendWebPptCopy();
  });
}
function initializeWebPptClient() { window.addEventListener('message',handleWebPptMessage); }
