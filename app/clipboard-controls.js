/* Never confuse the in-app clipboard, a bitmap, and editable Office shapes. */
function clipboardFeedback(title, message, kind = 'info', webActions = false) {
  const panel = document.getElementById('clipboard-feedback');
  panel.hidden = false; panel.dataset.kind = kind;
  document.getElementById('clipboard-title').textContent = title;
  document.getElementById('clipboard-message').textContent = message;
  document.getElementById('clipboard-web-actions').hidden = !webActions;
  document.getElementById('status').textContent = message;
}
function clipboardSelection() {
  const ids = selectedIds.size ? [...selectedIds] : selected ? [selected] : [];
  return exportableItems(items.filter(item => ids.includes(item.id)));
}
function validateClipboardSelection() {
  if (traceDraft) {
    clipboardFeedback('請先完成這一筆', '按 Enter 完成描圖，再複製到 PowerPoint。', 'warning'); return false;
  }
  if (!clipboardSelection().length) {
    clipboardFeedback('還沒有選到可複製物件', '請選取線條或形狀，或按「全選並複製」。參考底圖不會輸出。', 'warning'); return false;
  }
  return true;
}
function setClipboardBusy(busy) {
  pptCopyRunning = busy;
  for (const id of ['copy-ppt', 'copy-all-ppt', 'clipboard-copy-image', 'clipboard-download-image', 'clipboard-download-svg']) document.getElementById(id).disabled = busy;
  document.getElementById('copy-ppt').setAttribute('aria-busy', String(busy));
}
async function copySelectionToClipboard() {
  if (pptCopyRunning) return;
  if (!validateClipboardSelection()) return;
  if (!HAS_NATIVE_PPT_BRIDGE) {
    const fromFile = location.protocol === 'file:';
    clipboardFeedback(fromFile ? '目前直接開啟 HTML，尚未連接 PPT 服務' : '網頁版：請選擇貼上方式', fromFile
      ? '目前尚未寫入系統剪貼簿。請先「另存專案給本機版」，雙擊專案資料夾的「啟動Skechu-PPT.cmd」，再載入 .skc 複製可編輯物件。也可選擇複製圖片，但不是可編輯錨點。'
      : 'Skechu 內部副本不能直接貼到 PPT，目前尚未寫入系統剪貼簿。可按「複製圖片到 PPT」貼成圖片；可逐點編輯的 PPT 物件需用 Windows 本機版。', 'warning', true);
    return;
  }
  const bar = document.getElementById('ppt-progress');
  setClipboardBusy(true); clearTimeout(pptPrepareTimer); pptPrepareWanted = null;
  bar.hidden = false; bar.value = 0;
  clipboardFeedback('正在複製到 PowerPoint', '正在建立可編輯物件，請等到「複製成功」再切到 PPT 貼上。');
  try {
    const body = nativeBody(clipboardSelection());
    const response = await fetch('/copy', {method:'POST', headers:{'Content-Type':'application/json'}, body});
    const result = await readNativeStream(response, event => {
      bar.value = event.percent || 0;
      const count = event.total ? ` ${event.current}/${event.total}` : '';
      clipboardFeedback('正在複製到 PowerPoint', `${event.stage}${count}（${event.percent || 0}%）；完成後再按 Ctrl+V。`);
    });
    if (!(result.count > 0)) throw new Error('PowerPoint 未回傳可複製物件');
    pptPreparedBody = body; bar.value = 100;
    clipboardFeedback('複製成功：可編輯 PPT 物件', `已寫入系統剪貼簿，共 ${result.count} 個物件。切到 PowerPoint 投影片，按 Ctrl+V；取消群組後可分別編輯。`, 'success');
  } catch (error) {
    clipboardFeedback('沒有確認複製成功', `${error.message || error}。請確認 Windows 本機版與桌面 PowerPoint 正常執行，並關閉 PowerPoint 的對話框後重試。此時剪貼簿可能仍是舊內容。`, 'error');
    // Do not erase the user's existing clipboard when Office reports an error.
  } finally {
    bar.hidden = true; bar.value = 0; setClipboardBusy(false);
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
  copy.title = HAS_NATIVE_PPT_BRIDGE ? '複製選取的可編輯物件到 PowerPoint（Ctrl+C）' : '選擇圖片複製／向量下載；原生 PPT 物件需 Windows 本機版';
  document.getElementById('copy-ppt-mode').textContent = HAS_NATIVE_PPT_BRIDGE ? '可編輯物件' : location.protocol === 'file:' ? '尚未連接服務' : '網頁版選項';
  document.getElementById('file-entry-notice').hidden = location.protocol !== 'file:';
  copy.onclick = copySelectedObjects;
  document.getElementById('copy-all-ppt').onclick = () => {
    if (pptCopyRunning) return;
    document.getElementById('select-all').click(); copySelectedObjects();
  };
  document.getElementById('clipboard-dismiss').onclick = () => { document.getElementById('clipboard-feedback').hidden = true; };
  document.getElementById('clipboard-copy-image').onclick = copySelectionPicture;
  document.getElementById('clipboard-download-image').onclick = () => downloadClipboardSelection(true);
  document.getElementById('clipboard-download-svg').onclick = () => downloadClipboardSelection(false);
  document.getElementById('clipboard-save-project').onclick = () => document.getElementById('save-json').click();
}
