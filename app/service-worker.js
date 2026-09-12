const CACHE_NAME = 'skechu-ppt-v97-hd-compare';
const APP_SHELL = [
  './',
  './index.html',
  './about.html',
  './automation/core.js?v=70-automation',
  './automation/editor.js?v=87-native-fill',
  './automation/panel.css?v=70-automation',
  './automation/commands.json',
  './mobile-controls.js?v=69-copy-paste',
  './mobile-controls.css?v=90-mobile-brand',
  './touch-gestures.js?v=68-touch-gestures',
  './starter-brain.png',
  './theme-controls.js?v=46-canvas-shapes',
  './theme-controls.css?v=55-canvas-color-menu',
  './github-star.js?v=64-instant-star',
  './github-star.css?v=63-instant-star',
  './local-smoothing.js',
  './region-fill.js',
  './trace-boundary.js?v=76-paper-edge',
  './path-cut.js',
  './cut-tools.js',
  './cut-tools.css',
  './gradient-fill.js?v=96-live-color',
  './gradient-fill.css?v=81-gradient-fill',
  './compound-fill.js?v=78-contour-outlines',
  './paint-layers.js?v=79-layer-actions',
  './editor-render.js?v=96-live-color',
  './paint-tools.js?v=41-liquid-paper',
  './pan-tool.js',
  './selection-controls.js?v=84-gradient-fields',
  './workspace-actions.js?v=89-file-save',
  './project-file-store.js?v=89-file-save',
  './project-files.js?v=89-file-save',
  './project-files.css?v=89-file-save',
  './layer-controls.js?v=96-live-color',
  './panel-layout.js?v=1-resizable',
  './layer-controls.css?v=79-layer-actions',
  './clipboard-controls.js?v=95-copy-recovery',
  './clipboard-images.js?v=95-copy-recovery',
  './portable-pptx.js?v=95-copy-recovery',
  './portable-ppt-controls.js?v=95-copy-recovery',
  './portable-ppt-worker.js?v=95-copy-recovery',
  './web-ppt-client.js?v=95-copy-recovery',
  './web-ppt-helper.js?v=95-copy-recovery',
  './ppt-preparation.js?v=95-copy-recovery',
  './web-ppt.html',
  './clipboard-controls.css?v=95-copy-recovery',
  './paint-tools.css?v=38-responsive-shell',
  './illustration-trace.js?v=84-gradient-fields',
  './illustration-trace.js',
  './source-gradient.js?v=88-detail-fill',
  './source-gradient.js',
  './gradient-regions.js?v=88-detail-fill',
  './gradient-regions.js',
  './vendor/vtracer.js?v=1.0.0-alpha.4',
  './vendor/vtracer.wasm?v=1.0.0-alpha.4',
  './auto-trace.js?v=88-detail-fill',
  './auto-trace.js',
  './auto-trace-ui.js?v=88-detail-fill',
  './color-field.js?v=87-native-fill',
  './color-field.js',
  './color-field-preview.js?v=85-field-preview',
  './color-field-worker.js?v=85-field-preview',
  './color-field-worker.js',
  './image-upscale-ui.js?v=97-hd-compare',
  './image-upscale-core.js?v=86-browser-hd',
  './image-upscale-worker.js?v=86-browser-hd',
  './image-upscale.css?v=97-hd-compare',
  // Super-resolution engine and weights are cached only after explicit use.
  './auto-trace-worker.js',
  './auto-trace-worker.js?v=88-detail-fill',
  './auto-trace.css?v=85-field-preview',
  './manifest.webmanifest',
  './skechu-mark.svg',
  './skechu-icon.png',
  './vendor/katex/katex.min.css?v=01611-local',
  './vendor/katex/katex.min.js?v=01611-local'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // OAuth codes and deployment config must never enter the offline cache.
  const path = new URL(event.request.url).pathname;
  if (path.endsWith('/github-star-config.json') || path.endsWith('/github-callback.html') || path.endsWith('/github-callback.js')) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
