/* Exact origin/source/channel messaging for the editor's click-initiated session. */
function validWebPptPayload(body) {
  if(typeof body!=='string'||body.length>16000000)throw new Error('圖形資料過大或格式不正確');
  const payload=JSON.parse(body);
  if(payload.cacheId!==undefined&&(typeof payload.cacheId!=='string'||payload.cacheId.length>200))throw new Error('快取識別不正確');
  if(!Array.isArray(payload.items)||!payload.items.length||payload.items.length>10000)throw new Error('沒有可複製物件，或物件超過一萬個');
  for(const item of payload.items){
    if(!item||!['box','ellipse','polygon','arrow','text','image'].includes(item.type))throw new Error('不支援的物件格式');
    if(item.type==='image'&&!(typeof item.src==='string'&&item.src.startsWith('assets/')&&!/[\\:\x00]/.test(item.src)&&!item.src.split('/').includes('..')))throw new Error('網頁原生複製不接受本機檔案路徑；請改用線條或形狀');
    if(item.points&&(!Array.isArray(item.points)||item.points.length>100000||item.points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))))throw new Error('曲線座標不正確');
  }
  return payload;
}
function initializeWebPptHelper() {
  const args=new URLSearchParams(location.hash.slice(1)),origin=args.get('origin'),channel=args.get('channel');
  const allowed=new Set(['https://evan6007.github.io',location.origin]);
  const status=document.getElementById('status'),allow=document.getElementById('allow'),disconnect=document.getElementById('disconnect'),bar=document.getElementById('progress');
  const embedded=window.parent&&window.parent!==window,opener=embedded?window.parent:window.opener;
  let approved=false,copying=false,preparingNow=false;
  const reply=(type,extra={})=>opener.postMessage({kind:'skechu-ppt',type,channel,...extra},origin);
  if(location.protocol!=='http:'||!['127.0.0.1','localhost'].includes(location.hostname)||!opener||!allowed.has(origin)||!channel){status.textContent='請從正式 Skechu Open Web 的「複製到 PPT」開啟此頁。';return;}
  document.getElementById('site').textContent=origin;allow.disabled=false;status.textContent='尚未連接。按「允許連接」後，才會接收這個網頁視窗的複製要求。';
  const capabilities=['prepare','cache-contexts','cancel-prepare',...(embedded?['inline-copy']:[])];
  allow.onclick=()=>{approved=true;allow.hidden=true;disconnect.hidden=false;status.textContent='已連接。改動後會背景準備，不會寫入剪貼簿；按複製才會寫入。請保留此視窗。';reply('approved',{capabilities});};
  disconnect.onclick=()=>{approved=false;allow.hidden=false;disconnect.hidden=true;status.textContent='已中斷。已送入 PowerPoint 的作業可能仍會完成；新要求已停止。';reply('revoked');};
  window.addEventListener('message',async event=>{
    const data=event.data;
    if(event.source!==opener||event.origin!==origin||data?.kind!=='skechu-ppt'||data.channel!==channel)return;
    if(data.type==='connect'&&embedded){allow.onclick();return;}
    if(data.type==='cancel-prepare'&&approved){try{await fetch('/cancel-prepare',{method:'POST'});}catch{}return;}
    if(!['copy','prepare'].includes(data.type))return;
    const preparing=data.type==='prepare',resultType=preparing?'prepare-result':'result';
    const busy=copying||(preparing&&preparingNow);
    if(!approved||busy){reply(resultType,{id:data.id,result:{ok:false,error:busy?'本機 PowerPoint 忙碌中':'請先允許連接'}});return;}
    if(preparing)preparingNow=true;else copying=true;bar.hidden=false;bar.value=0;
    try{
      const payload=validWebPptPayload(data.body);
      status.textContent=preparing?'背景準備改動（不寫入剪貼簿）…':'正在建立原生物件…';
      const response=await fetch(preparing?'/prepare':'/copy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!response.ok||!response.body)throw new Error('本機 PowerPoint 服務無法處理要求');
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result=null;
      const accept=line=>{if(!line.trim())return;const event=JSON.parse(line);if(event.type==='progress'){bar.value=event.percent||0;status.textContent=(preparing?'背景準備：':'')+event.stage+'（'+(event.percent||0)+'%）';reply('progress',{id:data.id,event});}else if(event.type==='result')result=event;};
      while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});const lines=buffer.split('\n');buffer=lines.pop();lines.forEach(accept);if(done)break;}if(buffer.trim())accept(buffer);
      if(!result?.ok||!(result.count>0))throw new Error(result?.error||'沒有確認原生複製成功');
      if(preparing&&!result.prepared)throw new Error('服務尚未支援背景準備');
      status.textContent=preparing?'快取就緒（'+result.seconds+' 秒）。剪貼簿未變動；回網頁按複製即可。':'已複製 '+result.count+' 個可編輯物件。切到 PowerPoint 按 Ctrl+V；需要時取消群組即可逐一編輯。';reply(resultType,{id:data.id,result});
    }catch(error){status.textContent='未確認成功：'+(error.message||error);reply(resultType,{id:data.id,result:{ok:false,error:String(error.message||error)}});}
    finally{if(preparing)preparingNow=false;else copying=false;bar.hidden=!copying&&!preparingNow;}
  });
  reply('ready',{capabilities});
}
initializeWebPptHelper();
