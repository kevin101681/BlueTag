
const CACHE_NAME = 'bluetag-v37-pwa-fix';

const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .catch(err => console.error('Cache add failed', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Handle API calls - Network Only (do not cache API responses in SW)
  if (event.request.url.includes('/.netlify/functions/')) {
    return;
  }

  // Network First, Fallback to Cache Strategy
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // If valid response, clone and cache it
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
            });
        }
        return networkResponse;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                
                // Fallback for navigation (HTML) to index.html if completely offline
                // This ensures the PWA loads even if the specific sub-route wasn't cached
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
                
                return null;
            });
      })
  );
});
