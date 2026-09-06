const CACHE_NAME = 'skechu-ppt-v79-layer-actions';
const APP_SHELL = [
  './',
  './index.html',
  './about.html',
  './automation/core.js?v=70-automation',
  './automation/editor.js?v=70-automation',
  './automation/panel.css?v=70-automation',
  './automation/commands.json',
  './mobile-controls.js?v=69-copy-paste',
  './mobile-controls.css?v=69-copy-paste',
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
  './compound-fill.js?v=78-contour-outlines',
  './paint-layers.js?v=79-layer-actions',
  './paint-tools.js?v=41-liquid-paper',
  './pan-tool.js',
  './selection-controls.js?v=67-touch-shell',
  './workspace-actions.js?v=67-touch-shell',
  './layer-controls.js?v=79-layer-actions',
  './panel-layout.js?v=1-resizable',
  './layer-controls.css?v=79-layer-actions',
  './clipboard-controls.js?v=60-keyboard-copy',
  './web-ppt-client.js?v=60-keyboard-copy',
  './web-ppt-helper.js?v=60-keyboard-copy',
  './ppt-preparation.js?v=59-inline-ppt',
  './web-ppt.html',
  './clipboard-controls.css?v=59-inline-ppt',
  './paint-tools.css?v=38-responsive-shell',
  './illustration-trace.js?v=77-shared-boundaries',
  './illustration-trace.js',
  './vendor/vtracer.js?v=1.0.0-alpha.4',
  './vendor/vtracer.wasm?v=1.0.0-alpha.4',
  './auto-trace.js?v=75-closed-regions',
  './auto-trace.js',
  './auto-trace-ui.js?v=77-shared-boundaries',
  './auto-trace-worker.js',
  './auto-trace-worker.js?v=77-shared-boundaries',
  './auto-trace.css?v=75-closed-regions',
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
