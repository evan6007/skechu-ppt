/* Thin adapter: automation and UI share document/history/rendering primitives. */
function createAutomationHost() {
  return {
    read:()=>({projectId:activeProjectId,pageId:activePageId,name:activePage()?.name,
      canvas:{...canvasSize(),...canvasAppearance()},items,selection:[...selectedIds]}),
    bounds:it=>itemBounds(it),uid:()=>id(),
    busy:()=>!workspaceReady || !!drag || !!traceDraft || canvasTouchNavigation || !!document.querySelector('dialog[open]'),
    select(ids){clearSelectionState(false);selectedIds=new Set(ids);selected=ids.at(-1)||null;refreshSelectionUI();},
    apply(next,ids){
      const before=state(),oldHistory=history.slice(),oldFuture=future.slice(),selectionBefore=selectionSnapshot();
      try{commit();items=next;autoJunctionPositions.clear();this.select(ids);render();}
      catch(error){items=JSON.parse(before);history=oldHistory;future=oldFuture;restoreSelectionSnapshot(selectionBefore);render();throw error;}
    },
    history(action){document.getElementById(action).click();},
    exportSvg(){const clone=svg.cloneNode(true);clone.querySelector('#selection')?.remove();clone.querySelector('#grid-layer')?.remove();clone.querySelectorAll('.arrow-hit,[data-reference-only="true"],[data-region-preview]').forEach(n=>n.remove());return new XMLSerializer().serializeToString(clone);},
    confirmDelete:count=>Promise.resolve(window.confirm(`AI／程式要求刪除 ${count} 個物件。確定刪除？（可復原）`)),
    trace:runAutomationTrace,
    notify:message=>document.dispatchEvent(new CustomEvent('skechu-automation-status',{detail:message}))
  };
}
async function runAutomationTrace(ref, options, signal, progress) {
  const image=new Image();image.src=ref.src;await image.decode();
  if(signal.aborted)throw Error('Tracing cancelled.');
  const scale=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(3,Math.round(image.naturalWidth*scale));canvas.height=Math.max(3,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,canvas.width,canvas.height);
  const data=context.getImageData(0,0,canvas.width,canvas.height).data;
  const result=await new Promise((resolve,reject)=>{
    const worker=createAutoTraceJob();
    const finish=(error,result)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);worker.terminate();error?reject(error):resolve(result);};
    const abort=()=>finish(Error('Tracing cancelled.'));
    const timer=setTimeout(()=>finish(Error('Tracing exceeded 45 seconds.')),45000);
    signal.addEventListener('abort',abort,{once:true});
    worker.onerror=event=>finish(Error(event.message||'Tracing failed.'));
    worker.onmessage=event=>{const m=event.data;if(m.type==='progress')progress(m.percent);else if(m.type==='error')finish(Error(m.message));else finish(null,m.result);};
    worker.postMessage({width:canvas.width,height:canvas.height,data,options:{...options,accuracy:Math.max(.3,options.accuracy*scale),minLength:options.minLength*scale}},[data.buffer]);
  });
  if(signal.aborted)throw Error('Tracing cancelled.');
  return {items:transformAutoTraceItems(result,ref,canvas.width,canvas.height,uid('api-trace'),id),stats:result.stats};
}
function initializeAutomationControls() {
  const button=document.createElement('button');button.type='button';button.id='automation-tools';button.textContent='程式／AI 工具';
  document.querySelector('.export-menu .action-menu-popover').append(button);
  const indicator=document.createElement('button');indicator.type='button';indicator.className='automation-indicator';indicator.hidden=true;
  indicator.textContent='AI';indicator.title='AI 指令已啟用，點擊管理';indicator.setAttribute('aria-label','AI 指令已啟用，點擊管理');
  document.querySelector('.export-actions').prepend(indicator);
  const panel=document.createElement('section');panel.className='automation-panel';panel.hidden=true;panel.setAttribute('aria-label','程式與 AI 工具');
  panel.innerHTML=`<header><strong>程式／AI 工具</strong><button type="button" data-close aria-label="關閉 AI 工具">×</button></header>
    <p>開啟後，程式或已連接的 AI 可讀取及編輯目前圖頁。換頁、重新整理或停用即斷開；刪除另外確認。</p>
    <p class="automation-status" role="status">尚未開啟</p>
    <div class="automation-actions"><button type="button" data-enable>開啟指令介面</button><button type="button" data-disable disabled>停用</button><button type="button" data-cancel hidden>取消描圖</button></div>
    <p class="automation-mcp-help">MCP：在 AI 用戶端啟動本機連接器，開啟它提供的編輯器連結，再於此授權。此網頁不會自動探測你的電腦。</p>
    <details><summary>指令測試</summary><label>指令<select aria-label="自動化指令"></select></label><label>JSON 參數<textarea aria-label="指令參數" spellcheck="false">{}</textarea></label><button type="button" data-run disabled>執行指令</button><pre aria-label="指令結果" tabindex="0"></pre></details>`;
  workspace.append(panel);
  const status=panel.querySelector('.automation-status'),enable=panel.querySelector('[data-enable]'),disable=panel.querySelector('[data-disable]'),cancel=panel.querySelector('[data-cancel]'),run=panel.querySelector('[data-run]');
  let api=null,loadPromise=null,grant=null,controller=null,token=null,connection=null;
  // A local connector URL carries a short-lived capability in its fragment,
  // never a query string, log entry, persistent storage value or referrer.
  const fragment=new URLSearchParams(location.hash.slice(1));
  if(location.hostname==='127.0.0.1' && /^[A-Za-z0-9_-]{40,100}$/.test(fragment.get('automation')||'')) {
    token=fragment.get('automation');historyReplaceFragment();
    panel.querySelector('.automation-mcp-help').textContent='本機 MCP 已就緒。按「開啟指令介面」才會允許 AI 操作目前圖頁。';
    enable.textContent='允許 MCP 操作此圖頁';panel.hidden=false;
  }
  function historyReplaceFragment(){window.history.replaceState(null,'',location.pathname+location.search);}
  async function load() {
    if(!loadPromise)loadPromise=fetch('automation/commands.json').then(r=>{if(!r.ok)throw Error('指令清單載入失敗');return r.json()}).then(definitions=>{
      api=SkechuAutomationCore.create(createAutomationHost(),definitions);
      const select=panel.querySelector('select');
      for(const definition of definitions){const option=document.createElement('option');option.value=definition.name;option.textContent=definition.name;select.append(option);}
      return api;
    }).catch(error=>{loadPromise=null;throw error;});
    return loadPromise;
  }
  function paintStatus(message) {
    const enabled=api?.status().enabled;enable.disabled=!!enabled;disable.disabled=!enabled;run.disabled=!enabled;
    cancel.hidden=!api?.status().task;status.textContent=message || (enabled?'已開啟 · 僅目前圖頁':'已停用');
    button.textContent=enabled?'程式／AI 工具 · 已開啟':'程式／AI 工具';
    indicator.hidden=!enabled;
  }
  async function post(path,body,signal) {
    const response=await fetch('/automation/'+path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(body),signal,cache:'no-store'});
    if(!response.ok)throw Error(`MCP 連線中止（${response.status}）`);
    return response.json();
  }
  async function disconnect(message='已停用') {
    const previous=connection;connection=null;controller?.abort();controller=null;grant=null;api?.revoke();
    if(previous)post('disconnect',{sessionId:previous}).catch(()=>{});
    paintStatus(message);
  }
  async function poll(signal,sessionId) {
    try {
      while(!signal.aborted && connection===sessionId) {
        const command=await post('poll',{sessionId},signal);
        if(!command.id)continue;
        let result;
        try {result={ok:true,result:await api.execute(command.name,command.arguments)};}
        catch(error){result={ok:false,error:{code:error.code||'COMMAND_FAILED',message:error.message}};}
        // No write retry: an interrupted response may already have edited the page.
        await post('result',{sessionId,id:command.id,...result},signal);
        paintStatus(result.ok?'AI 指令已完成':result.error.message);
      }
    } catch(error){if(!signal.aborted)disconnect('MCP 連線已中斷，操作權限已停用。');}
  }
  enable.onclick=async()=>{
    enable.disabled=true;
    try {
      await load();grant=api.grant();
      if(token){connection=crypto.randomUUID();await post('connect',{sessionId:connection});controller=new AbortController();void poll(controller.signal,connection);}
      paintStatus(token?'MCP 已連接 · 僅目前圖頁':'指令介面已開啟 · 僅目前圖頁');
    }catch(error){await disconnect(error.message);}
  };
  disable.onclick=()=>disconnect();
  cancel.onclick=async()=>{const task=api?.status().task;if(task)await api.execute('cancel_task',{taskId:task.taskId});paintStatus('已取消描圖');};
  button.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden)load().catch(error=>paintStatus(error.message));};
  indicator.onclick=()=>{panel.hidden=!panel.hidden;};
  panel.querySelector('[data-close]').onclick=()=>{panel.hidden=true;};
  run.onclick=async()=>{
    const out=panel.querySelector('pre');
    try{run.disabled=true;const result=await api.execute(panel.querySelector('select').value,JSON.parse(panel.querySelector('textarea').value));out.textContent=JSON.stringify(result,null,2);}
    catch(error){out.textContent=JSON.stringify({error:error.code||'INVALID_REQUEST',message:error.message},null,2);}
    finally{paintStatus();}
  };
  window.skechu=Object.freeze({version:'1.0.0',listCommands:async()=>(await load()).list(),
    execute:async(name,args)=>(await load()).execute(name,args),status:()=>api?.status()||{enabled:false}});
  document.addEventListener('skechu-automation-status',event=>paintStatus(event.detail==='trace-ready'?'描圖完成 · 等待套用':undefined));
  // Checking two IDs is cheap; do not serialize the drawing on every frame/poll.
  window.automationPageChanged=()=>{if(grant&&(grant.projectId!==activeProjectId||grant.pageId!==activePageId))void disconnect('已換頁，請重新開啟指令介面');};
  window.addEventListener('pagehide',()=>{void disconnect();});
}
