
const CACHE_NAME = 'bluetag-v38-offline';

const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/logo.png',
  '/images/logo2.png'
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
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Handle API calls - Network Only (do not cache API responses in SW)
  // They should fail gracefully and use local data when offline
  if (request.url.includes('/.netlify/functions/')) {
    return;
  }

  // Skip Chrome extensions and other non-http(s) requests
  if (!request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Try network first, but return cached version immediately if available
        const fetchPromise = fetch(request)
          .then(networkResponse => {
            // Only cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              // Don't cache if it's a stream (Response.bodyUsed)
              const responseToCache = networkResponse.clone();
              
              // Only cache same-origin requests or specific allowed resources
              const url = new URL(request.url);
              const isSameOrigin = url.origin === self.location.origin;
              
              if (isSameOrigin && networkResponse.type === 'basic') {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, responseToCache).catch(err => {
                    console.error('Cache put failed:', err);
                  });
                });
              }
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed, return cached version if available
            return cachedResponse || null;
          });

        // Return cached version immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      })
      .then(response => {
        // If we have a response, return it
        if (response) return response;
        
        // If navigation request and nothing cached, return index.html
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        
        // Return a basic offline response for other requests
        return new Response('Offline', {
          status: 408,
          statusText: 'Request Timeout',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});
