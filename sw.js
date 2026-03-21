const CACHE_NAME = 'my-club-v1.0.25';

const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/offline.html',
  '/manifest.json',

  // ICONOS PWA
  '/assets/icons/icon-72x72.png',
  '/assets/icons/icon-96x96.png',
  '/assets/icons/icon-128x128.png',
  '/assets/icons/icon-144x144.png',
  '/assets/icons/icon-152x152.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-384x384.png',
  '/assets/icons/icon-512x512.png',

  // CSS
  '/css/styles.css',

  // JS CORE
  '/js/app.js',
  '/js/auth.js',
  '/js/firebase-config.js',
  '/js/storage.js',
  '/js/utils.js',
  '/js/install.js',
  '/js/cache.js',
  '/js/pwa-icons.js',
  '/js/license-system.js',

  // JS FEATURES
  '/js/players.js',
  '/js/payments.js',
  '/js/expenses.js',
  '/js/third-party-income.js',
  '/js/firebase-sync.js',
  '/js/modals.js',
  '/js/notifications.js',
  '/js/calendar.js',
  '/js/birthdays.js',
  '/js/dashboard.js',
  '/js/settings.js',
  '/js/club-settings-protection.js',
  '/js/pdf.js',
  '/js/whatsapp.js',

  // PORTAL PADRES
  '/js/parent-portal.js'
];
/* ==============================
   INSTALL
============================== */
self.addEventListener('install', event => {
  console.log('⚽ SW instalando:', CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        urlsToCache.map(url =>
          cache.add(url).catch(err => {
            console.warn('⚠️ No se pudo cachear:', url, err.message);
          })
        )
      );
    })
  );

  self.skipWaiting();
});

/* ==============================
   ACTIVATE
============================== */
self.addEventListener('activate', event => {
  console.log('⚽ SW activando:', CACHE_NAME);

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/* ==============================
   FETCH
============================== */
self.addEventListener('fetch', event => {
  // Ignorar peticiones que no son HTTP/HTTPS
  if (!event.request.url.startsWith('http')) return;

  // Ignorar peticiones a Firebase, APIs externas, etc.
  if (
    event.request.url.includes('firebaseio.com') ||
    event.request.url.includes('googleapis.com') ||
    event.request.url.includes('gstatic.com') ||
    event.request.url.includes('firebase') ||
    event.request.url.includes('unpkg.com') ||
    event.request.url.includes('cdn.tailwindcss.com') ||
    event.request.url.includes('cdn.jsdelivr.net') ||
    event.request.url.includes('cdnjs.cloudflare.com')
  ) {
    return;
  }

  /* 🔴 NO cachear métodos que no son GET */
  if (event.request.method !== 'GET') {
    return;
  }

  /* 🟢 NAVEGACIÓN (HTML) */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cachear la respuesta
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // 1. Intentar archivo exacto ignorando parámetros (?homescreen=1 etc)
          return caches.match(event.request, { ignoreSearch: true }).then(cached => {
            if (cached) return cached;
            // 2. Si es navegación y falló, intentar forzar el index.html
            return caches.match('/index.html').then(idxCached => {
              if (idxCached) return idxCached;
              // 3. Fallback final al offline.html
              return caches.match('/offline.html');
            });
          });
        })
    );
    return;
  }

  /* 🟡 JS / CSS → Network First */
  if (
    event.request.url.endsWith('.js') ||
    event.request.url.endsWith('.css')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  /* 🔵 OTROS ARCHIVOS (imágenes, JSON, etc.) → Cache First */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});

/* ==============================
   MENSAJES
============================== */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CLEAR_ALL_CACHE') {
    event.waitUntil(
      caches.keys().then(names => {
        return Promise.all(names.map(n => caches.delete(n)));
      })
    );
  }
});

console.log('✅ Service Worker listo:', CACHE_NAME);