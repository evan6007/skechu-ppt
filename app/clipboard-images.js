/* Pictures stay pictures; never flatten a mixed vector/picture selection. */
async function clipboardImageSnapshot(source) {
  const frozen = structuredClone(source);
  let bytes = 0;
  for (const it of frozen) {
    if (it.type !== 'image') continue;
    const im = new Image();
    im.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { im.src = ''; reject(Error('底圖讀取逾時，請重新載入圖片後重試。')); }, 15000);
      im.onload = () => { clearTimeout(timer); resolve(); };
      im.onerror = () => { clearTimeout(timer); reject(Error('底圖無法讀取，或圖片來源不允許匯出。')); };
      im.src = it.src;
    });
    const meta = !it.preserveFull && typeof assetMeta !== 'undefined' ? assetMeta.get(it.src) : null;
    const sx = meta?.ax || 0, sy = meta?.ay || 0;
    const sw = meta?.aw || im.naturalWidth, sh = meta?.ah || im.naturalHeight;
    // Keep source resolution. Do not quietly downsample a high-resolution image.
    if (!(sw > 0 && sh > 0) || sw * sh > 16000000 || sw > 8192 || sh > 8192) throw Error('單張底圖超過 1,600 萬像素或 8,192 px，請縮小圖片後再複製。');
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(sw); canvas.height = Math.ceil(sh);
    const ctx = canvas.getContext('2d');
    ctx.globalAlpha = Math.max(0, Math.min(1, it.opacity ?? 1));
    ctx.drawImage(im, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');
    if ((bytes += png.length) > 12000000) throw Error('選取圖片超過 9 MB，請分批複製。');
    // The full-image display uses contain; cropping mode stretches its crop.
    if (!meta) {
      const fit = Math.min(it.w / sw, it.h / sh), w = sw * fit, h = sh * fit;
      it.x += (it.w - w) / 2; it.y += (it.h - h) / 2; it.w = w; it.h = h;
    }
    it.src = png; it.opacity = 1; it.preserveFull = true;
  }
  return frozen;
}
