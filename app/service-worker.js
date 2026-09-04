const CACHE_NAME = 'skechu-ppt-v47-page-grid';
const APP_SHELL = [
  './',
  './index.html',
  './theme-controls.js?v=46-canvas-shapes',
  './theme-controls.css?v=47-grid-sync',
  './local-smoothing.js',
  './region-fill.js',
  './paint-layers.js?v=22-visibility-web-native',
  './paint-tools.js?v=41-liquid-paper',
  './pan-tool.js',
  './selection-controls.js?v=26-left-marquee',
  './workspace-actions.js?v=36-page-click',
  './layer-controls.js?v=35-stable-motion',
  './panel-layout.js?v=1-resizable',
  './layer-controls.css?v=35-stable-motion',
  './clipboard-controls.js?v=30-copy-priority',
  './web-ppt-client.js?v=30-copy-priority',
  './web-ppt-helper.js?v=28-ppt-progress',
  './ppt-preparation.js?v=31-latest-idle',
  './web-ppt.html',
  './clipboard-controls.css?v=28-ppt-progress',
  './paint-tools.css?v=38-responsive-shell',
  './auto-trace.js?v=26-photo-trace',
  './auto-trace-ui.js?v=44-toolbar-groups',
  './auto-trace-worker.js',
  './auto-trace.css?v=26-photo-trace',
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
