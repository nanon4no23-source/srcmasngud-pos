// Service Worker for KASIR SRC MASNGUD
const CACHE_NAME = 'src-masngud-v20';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/default_logo.jpg',
  '/default_logo.jpg?v=20',
  '/default_logo.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Network-First for critical files, Cache-First for other assets)
self.addEventListener('fetch', (event) => {
  // Hanya tangani request GET dengan protokol http/https agar tidak mengganggu request sistem/extension/websocket
  if (!event.request || event.request.method !== 'GET') return;
  
  let url;
  try {
    url = new URL(event.request.url);
    if (!url.protocol.startsWith('http')) return;
  } catch (err) {
    return;
  }

  const isCriticalFile = 
    url.pathname === '/' || 
    url.pathname.includes('index.html') || 
    url.pathname.includes('manifest.json') || 
    url.pathname.includes('icon.png');

  if (isCriticalFile) {
    // Network-First Strategy: Ambil yang terbaru dari internet, jika offline baru gunakan cache
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Simpan salinan terbaru ke dalam cache jika respon valid
          if (response && response.status === 200) {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseCopy);
            });
          }
          return response;
        })
        .catch(() => {
          // Jika offline, ambil dari cache
          return caches.match(event.request);
        })
    );
  } else {
    // Cache-First Strategy untuk aset statis lainnya
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseCopy);
            });
          }
          return response;
        });
      })
    );
  }
});
