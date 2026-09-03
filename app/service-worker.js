const CACHE_NAME = 'skechu-ppt-v18-fill-order';
const APP_SHELL = [
  './',
  './index.html',
  './local-smoothing.js',
  './region-fill.js',
  './paint-layers.js?v=18-fill-order',
  './paint-tools.js?v=14-selection',
  './pan-tool.js',
  './selection-controls.js?v=15-right-marquee',
  './clipboard-controls.js?v=17-file-worker',
  './clipboard-controls.css?v=17-file-worker-r2',
  './paint-tools.css?v=14-selection',
  './auto-trace.js?v=17-file-worker',
  './auto-trace-ui.js?v=17-file-worker',
  './auto-trace-worker.js',
  './auto-trace.css',
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
