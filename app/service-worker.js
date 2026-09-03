const CACHE_NAME = 'skechu-ppt-v22-visibility-web-native';
const APP_SHELL = [
  './',
  './index.html',
  './local-smoothing.js',
  './region-fill.js',
  './paint-layers.js?v=22-visibility-web-native',
  './paint-tools.js?v=22-visibility-web-native',
  './pan-tool.js',
  './selection-controls.js?v=22-visibility-web-native',
  './layer-controls.js?v=22-visibility-web-native',
  './layer-controls.css?v=22-visibility-web-native',
  './clipboard-controls.js?v=22-visibility-web-native',
  './web-ppt-client.js?v=22-web-native',
  './web-ppt-helper.js?v=22-web-native',
  './web-ppt.html',
  './clipboard-controls.css?v=17-file-worker-r2',
  './paint-tools.css?v=22-visibility-web-native',
  './auto-trace.js?v=17-file-worker',
  './auto-trace-ui.js?v=20-layer-groups',
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
