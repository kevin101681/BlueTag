
const CACHE_NAME = 'bluetag-v33-standard';

// Aggressive cleanup worker
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('Nuking cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', event => {
  // Pass through everything to network to bypass broken cache
  event.respondWith(fetch(event.request));
});