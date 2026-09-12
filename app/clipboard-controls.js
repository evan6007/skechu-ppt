/* Never confuse the in-app clipboard, a bitmap, and editable Office shapes. */
function clipboardFeedback(title, message, kind = 'info', webActions = false) {
  const panel = document.getElementById('clipboard-feedback');
  panel.hidden = false; panel.dataset.kind = kind;
  document.getElementById('clipboard-title').textContent = title;
  document.getElementById('clipboard-message').textContent = message;
  document.getElementById('clipboard-web-actions').hidden = !webActions;
  document.getElementById('clipboard-setup').hidden = true;
  document.getElementById('clipboard-portable-actions').hidden = true;
  document.getElementById('clipboard-recovery').hidden = kind !== 'error';
  document.getElementById('status').textContent = message;
}
// Low-entropy local hints only. OS detection selects guidance, not proof that
// Office/the connector is installed. Unknown platforms never get auto-probed.
let pptTransferMode = 'auto';
function detectPptPlatform(nav=navigator) {
  const hint=String(nav.userAgentData?.platform||'').toLowerCase(),legacy=String(nav.platform||'').toLowerCase(),ua=String(nav.userAgent||'').toLowerCase();
  if(/windows phone/.test(ua))return{id:'other',name:'行動裝置'};
  if(/ipad|iphone|ipod/.test(hint+' '+legacy+' '+ua)||((hint==='macos'||hint==='mac os'||legacy.startsWith('mac'))&&Number(nav.maxTouchPoints)>1))return{id:'ios',name:/iphone|ipod/.test(ua+' '+legacy)?'iPhone':'iPad'};
  const parse=value=>/^win|windows/.test(value)?{id:'windows',name:'Windows'}:/android/.test(value)?{id:'android',name:'Android'}:/chrome ?os|cros/.test(value)?{id:'chromeos',name:'ChromeOS'}:/mac|darwin/.test(value)?{id:'mac',name:'Mac'}:/linux|ubuntu/.test(value)?{id:'linux',name:/ubuntu/.test(value)?'Ubuntu':'Linux／Ubuntu'}:null;
  // UA-CH is preferred when available. Without it, mobile/ChromeOS UA tokens
  // take priority over their generic Linux platform string.
  return parse(hint)||(/android|cros/.test(ua)?parse(ua):null)||parse(legacy)||parse(ua)||{id:'unknown',name:'未辨識系統'};
}
function clipboardNeedsWindows() {
  return pptTransferMode==='portable'||(pptTransferMode!=='windows'&&detectPptPlatform().id!=='windows');
}
function syncClipboardPlatform() {
  const platform=detectPptPlatform(),portable=clipboardNeedsWindows(),mode=portable?'可編輯 PPTX 匯出':'Windows 直接複製（需連接元件）';
  document.getElementById('ppt-platform-note').textContent=`${pptTransferMode==='auto'?'自動辨識':'手動模式'}：${platform.name} · ${mode}`;
  const copy=document.getElementById('copy-ppt');
  copy.title=portable?`${platform.name}：PPTX 匯出與貼上說明`:'複製選取的可編輯物件到 PowerPoint（Ctrl+C）';
  copy.setAttribute('aria-label',copy.title);copy.dataset.pptRoute=portable?'portable':'windows';
  document.getElementById('copy-ppt-mode').textContent=portable?'可編輯 PPTX':location.protocol==='file:'?'尚未連接服務':'可編輯物件';
  document.getElementById('file-entry-notice').hidden=location.protocol!=='file:'||portable;
  document.getElementById('ppt-transfer-mode').value=pptTransferMode;
}
function clipboardSetupFeedback(error) {
  if (clipboardNeedsWindows()) {
    portableCopyGuidance();
    return;
  }
  const update=error.code==='WEB_PPT_UPDATE';
  clipboardFeedback(update?'請更新 Windows 連接元件':'先安裝 Windows 連接元件，即可複製到 PPT', update
    ? error.message
    : '尚未連上本機服務。第一次使用請下載下方整合安裝包；若已安裝，請先啟動 Skechu-PPT。圖稿留在這裡，不必重新開啟。', 'warning');
  document.getElementById('clipboard-setup').hidden = false;
  if(update)document.getElementById('clipboard-portable-actions').hidden=false;
  document.getElementById('clipboard-install-label').textContent = update?'下載更新安裝包':'下載 Windows 必要連接元件';
}
function clipboardSelection() {
  const ids = selectedIds.size ? [...selectedIds] : selected ? [selected] : [];
  return items.filter(item => ids.includes(item.id) && !item.hidden);
}
function validateClipboardSelection() {
  if (traceDraft) {
    clipboardFeedback('請先完成這一筆', '按 Enter 完成描圖，再複製到 PowerPoint。', 'warning'); return false;
  }
  if (!clipboardSelection().length) {
    clipboardFeedback('還沒有選到可複製物件', '請選取線條、形狀或底圖，再按複製。隱藏的物件不會輸出。', 'warning'); return false;
  }
  return true;
}
function setClipboardBusy(busy) {
  pptCopyRunning = busy;
  for (const id of ['copy-ppt', 'copy-all-ppt', 'clipboard-retry', 'clipboard-retry-operation', 'clipboard-copy-image', 'clipboard-download-image', 'clipboard-download-svg', 'export-pptx', 'clipboard-download-pptx', 'ppt-transfer-mode']) document.getElementById(id).disabled = busy;
  document.getElementById('copy-ppt').setAttribute('aria-busy', String(busy));
}
async function copySelectionToClipboard() {
  if (pptCopyRunning) return;
  if (!validateClipboardSelection()) return;
  // A single picture does not require Office or a local-network permission.
  if (clipboardSelection().length === 1 && clipboardSelection()[0].type === 'image') return copySelectionPicture();
  if (clipboardNeedsWindows()) {
    clipboardSetupFeedback({code:'WEB_PPT_CONNECT'}); return;
  }
  if (!HAS_NATIVE_PPT_BRIDGE && location.protocol === 'file:') {
    const fromFile = location.protocol === 'file:';
    clipboardFeedback(fromFile ? '目前直接開啟 HTML，尚未連接 PPT 服務' : '網頁版：請選擇貼上方式', fromFile
      ? '目前尚未寫入系統剪貼簿。請先「另存專案給本機版」，雙擊專案資料夾的「啟動Skechu-PPT.cmd」，再載入 .skc 複製可編輯物件。也可選擇複製圖片，但不是可編輯錨點。'
      : 'Skechu 內部副本不能直接貼到 PPT，目前尚未寫入系統剪貼簿。可按「複製圖片到 PPT」貼成圖片；可逐點編輯的 PPT 物件需用 Windows 本機版。', 'warning', true);
    return;
  }
  const bar = document.getElementById('ppt-progress');
  const clickedAt=performance.now();
  setClipboardBusy(true); clearTimeout(pptPrepareTimer); pptPrepareWanted = null;
  bar.hidden = false; bar.value = 0;
  clipboardFeedback('正在複製到 PowerPoint', '正在建立可編輯物件，請等到「複製成功」再切到 PPT 貼上。');
  try {
    const chosen = clipboardSelection();
    const source = chosen.some(it=>it.type==='image') ? await clipboardImageSnapshot(chosen) : chosen;
    const body = nativeRequestBody(source, true);
    if(HAS_NATIVE_PPT_BRIDGE&&typeof requireLocalGradientCapability==='function')await requireLocalGradientCapability(body);
    const progress = event => {
      bar.value = event.percent || 0;
      const count = event.total ? ` ${event.current}/${event.total}` : '';
      clipboardFeedback('正在複製到 PowerPoint', `${event.stage}${count}（${event.percent || 0}%）；完成後再按 Ctrl+V。`);
    };
    // Send the foreground copy immediately. The bridge cancels any in-flight
    // idle preparation so a click never waits for an unrelated full-page cache.
    if(HAS_NATIVE_PPT_BRIDGE&&pptPreparePromise){
      clipboardFeedback('正在複製到 PowerPoint', pptPreparingBody===body?'正在接手背景快取並優先複製。':'正在中止背景準備，優先複製目前選取物件。');
    }
    const result = HAS_NATIVE_PPT_BRIDGE
      ? await runLocalPptOperation('copy', body, progress)
      : await requestWebPptCopy(body, progress);
    if (!(result.count > 0)) throw new Error('PowerPoint 未回傳可複製物件');
    noteNativeCopy(body,result); bar.value = 100;
    const speed=result.cached?'快取':result.incremental?`更新 ${result.changed} 個改動`:'首次建立';
    const totalSeconds=(performance.now()-clickedAt)/1000;
    const timing=Number.isFinite(result.seconds)?`（${speed} ${result.seconds} 秒${totalSeconds>result.seconds+.35?`；按下後共 ${totalSeconds.toFixed(2)} 秒`:''}）`:'';
    clipboardFeedback('已複製，前往 PPT 貼上', `${result.count} 個可編輯物件${source.some(it=>it.type==='image')?'（底圖保留為獨立圖片）':''}。到 PowerPoint 按 Ctrl+V；取消群組後可分別編輯。`, 'success');
    document.getElementById('copy-ppt').title=`複製完成${timing}`;
  } catch (error) {
    const setup=error.code==='WEB_PPT_CONNECT'||error.code==='WEB_PPT_UPDATE';
    if (setup) clipboardSetupFeedback(error);
    else clipboardFeedback('尚未確認複製成功', `${error.message || error}。請先關閉 PowerPoint 的對話框，確認它能正常操作，再按「重試複製」。連線中斷不代表剪貼簿一定沒更新；請核對貼上內容。`, 'error');
    pptPrepareRetryAt = Date.now() + 15000;
    // Do not erase the user's existing clipboard when Office reports an error.
  } finally {
    bar.hidden = true; bar.value = 0; setClipboardBusy(false); queueNativePrepare();
  }
}
async function copySelectionPicture() {
  if (pptCopyRunning || !validateClipboardSelection()) return;
  setClipboardBusy(true);
  clipboardFeedback('正在複製圖片', '這個方式貼到 PPT 後是圖片，不是可逐點編輯的物件。', 'info', true);
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('瀏覽器不支援圖片剪貼簿');
    // Start the write in the click gesture; let ClipboardItem await rasterization.
    const png = svgToPng(selectionSvgBlob()); png.catch(() => {});
    await navigator.clipboard.write([new ClipboardItem({'image/png': png})]);
    clipboardFeedback('複製成功：PNG 圖片', '現在可切到 PowerPoint 按 Ctrl+V。貼上的是透明背景圖片，不是可編輯錨點。', 'success', true);
  } catch (error) {
    clipboardFeedback('圖片未複製成功', `${error.message || error}。請允許剪貼簿權限後重試，或按「下載 PNG」再插入 PPT。`, 'error', true);
  } finally { setClipboardBusy(false); }
}
async function downloadClipboardSelection(asPng) {
  if (pptCopyRunning || !validateClipboardSelection()) return;
  setClipboardBusy(true);
  try {
    const output = selectionSvgBlob();
    const blob = asPng ? await svgToPng(output) : (await output).blob;
    download(blob, `skechu-selection.${asPng ? 'png' : 'svg'}`);
    clipboardFeedback('已開始下載', asPng ? '將下載的 PNG 插入 PowerPoint；這是圖片，不是可編輯錨點。' : '將下載的 SVG 插入 PowerPoint，可保留向量外觀。Skechu 錨點編輯資料請另存 .skc。', 'success', true);
  } catch (error) { clipboardFeedback('下載失敗', String(error.message || error), 'error', true); }
  finally { setClipboardBusy(false); }
}
function initializeClipboardControls() {
  const copy = document.getElementById('copy-ppt');
  copy.hidden = false; copy.removeAttribute('aria-hidden');
  try{const saved=localStorage.getItem('skechu-ppt-transfer-mode-v1');if(['auto','windows','portable'].includes(saved))pptTransferMode=saved}catch(_){}
  syncClipboardPlatform();
  document.getElementById('ppt-transfer-mode').onchange=event=>{
    pptTransferMode=['auto','windows','portable'].includes(event.target.value)?event.target.value:'auto';
    try{localStorage.setItem('skechu-ppt-transfer-mode-v1',pptTransferMode)}catch(_){}
    clearTimeout(pptPrepareTimer);pptPrepareWanted=null;
    syncClipboardPlatform();
    document.getElementById('clipboard-feedback').hidden=true;
    // Changing guidance alone never connects, copies, installs or downloads.
  };
  copy.onclick = copySelectedObjects;
  document.getElementById('copy-all-ppt').onclick = () => {
    if (pptCopyRunning) return;
    document.getElementById('select-all').click(); copySelectedObjects();
  };
  document.getElementById('clipboard-dismiss').onclick = () => { document.getElementById('clipboard-feedback').hidden = true; };
  // Explicit retry uses the current selection; never copy automatically after
  // installing, returning to the tab, or an uncertain clipboard response.
  document.getElementById('clipboard-retry').onclick = copySelectionToClipboard;
  document.getElementById('clipboard-retry-operation').onclick = copySelectionToClipboard;
  document.getElementById('clipboard-copy-image').onclick = copySelectionPicture;
  document.getElementById('clipboard-download-image').onclick = () => downloadClipboardSelection(true);
  document.getElementById('clipboard-download-svg').onclick = () => downloadClipboardSelection(false);
  document.getElementById('clipboard-save-project').onclick = () => document.getElementById('save-json').click();
}
