# Browser-local image HD

Choose **圖片高清** beside **新增底圖**. The selected reference (or a new PNG/JPEG/WebP upload/drop) can be enhanced independently of automatic tracing/filling. Press **開始高清** in the fixed bottom-right action area. When processing finishes, that area's primary action becomes **建立高清圖頁**, with PNG download and reprocessing beside it. The original page stays intact. New reference images are unlocked and have the usual 50% opacity; the PNG itself retains its full colors.

## Comparing the whole image

- **原圖 / 對照 / 高清** selects the original, split view, or the entire enhanced result. The whole image is processed; the divider only controls what the preview displays.
- Drag the central **double-arrow handle or divider line** left/right with a mouse or one finger. It remains touch-sized when zoomed. Double-click the divider or press **置中** to return to 50%.
- Drag elsewhere on the image to pan. Use the wheel, zoom buttons, or two fingers to zoom; **全圖** returns to the full image. Changing comparison mode preserves the view.
- Keyboard users can focus the divider and use arrow keys (1%), Shift+arrows (10%), Home/End, or the range input below the image.
- Before a result exists, comparison controls are disabled rather than implying half the image is already enhanced. Output dimensions and device-dependent limits are shown before processing, and oversize requests cannot start.
- The action footer stays visible on small screens while settings and preview scroll independently. Uploaded/dropped files remain in the HD dialog until the user explicitly creates a new page.

## Static-site operation

- **動漫 AI 高清**: Real-ESRGAN AnimeVideo-v3, TensorFlow.js WebGL, in a dedicated Worker. No Python, account, paid API or inference server. Model + manifest + runtime are about **3.96 MB** (uncompressed), fetched only when starting AI processing, not when opening the site/dialog. Available on static HTTPS sites such as GitHub Pages; cached on use when service workers are supported.
- **一般放大（非 AI）**: worker-based Lanczos-3 interpolation. No model download; works without Worker WebGL and preserves alpha. It does not synthesize detail and is never silently presented as AI output.
- **2×** uses the native 4× model followed by a 2×2 box reduction. **4×** retains its native output. Lower output size does not mean the neural network itself costs four times less computation.
- AI uses 128-pixel tile cores on desktop, 64 on smaller/low-memory devices, each with a 20-pixel context halo. The 18-convolution model's receptive radius is 18 pixels. Only valid cores are retained, so internal tiles do not acquire artificial zero-padded borders. A Worker keeps the editor's main thread available; cancellation terminates the Worker and its GPU context.
- Tensor intermediates are disposed each layer; unused GPU textures are deleted instead of accumulating a shape-dependent pool. The model download size is **not** the inference memory budget. Source/output buffers, GPU features and PNG encoding still require additional memory. Physical phone speed and compatibility vary.
- Maximum source: **2.1 million pixels**, longest side 4096. Maximum output: **16 million pixels** (8 million on smaller/low-memory devices), longest side 8192. Extreme aspect ratios are also bounded so interpolation tables cannot grow without limit. Oversize requests fail explicitly instead of silently shrinking the source. AI currently accepts opaque images only; transparent inputs can use the non-AI option.

## Limits and fidelity

Super-resolution estimates missing detail; it cannot guarantee the original artist's eye shape, shading or line intent. Inspect the before/after view. Source images are not uploaded, added to this repository, or used to train a model.

This feature creates an enhanced **raster reference**, not editable vector detail. It does not bypass the existing automatic-fill sampling limits: the experimental full-image 2D color-field preview still samples at a 300-pixel longest side. Upscaling alone cannot repair that separate bottleneck, and the 2D preview still has no editable PPT apply operation.

Model provenance, sizes, licenses and conversion details: [vendor notice](../app/vendor/super-resolution/NOTICE.md). The application code is MIT; the model and runtime retain BSD-3-Clause and Apache-2.0 respectively. Included in the v91 web release; no separate installer is needed for browser image enhancement.

## Local verification (2026-09-07)

- Official PyTorch model vs browser Worker, deterministic 23×19 RGB fixture: maximum difference **0.501 / 255** including 8-bit output rounding; RGB RMSE **0.276 / 255**.
- 145×137 synthetic image, whole-image WebGL vs **64- and 128-pixel** tile cores: exact 8-bit equality, including seams; zero remaining tensors after model disposal. This checks tiling fidelity, not semantic reconstruction of every image.
- Private 640×360 anime reference, 2× output: about **16.1 seconds**, 15 tiles, local headless Chrome on this Windows computer. This is not a phone benchmark or speed guarantee. Source and results are excluded from the repository.
- Browser tests exercise lazy downloads, actual AI Workers, cancellation, PNG dimensions, untouched original pages, new unlocked references, stale-context rejection, modal keyboard isolation, mobile layout and Chromium touch pinch events. Physical iOS/Android GPU testing is still pending.

Run `node tests/check_image_upscale.mjs`. With Playwright/Chrome available, serve `app` via `node tests/serve_app.mjs`, then run `node tests/check_image_upscale_browser.mjs` and `node tests/check_image_upscale_model_browser.mjs`. Set `SKECHU_HD_SOURCE` to a private 640×360 test file to include the optional full-image visual test; generated files stay in ignored `.codex-tmp/`.

The v97 interaction update (2026-09-12) also adds `node tests/check_image_upscale_ux_browser.mjs`: bottom-right actions at desktop, 390px and short-phone heights; mouse/touch divider dragging; keyboard and full-result modes; separate pan/pinch; upload/drop isolation and device-size preflight. `check_image_upscale_cache_browser.mjs` verifies that UI/offline installation still does not download AI weights until explicit use. These browser checks do not substitute for physical phone GPU testing.
