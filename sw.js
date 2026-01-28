const CACHE_NAME = 'my-club-v1.0.12';

const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/parent-manifest.json',

  // CSS
  '/css/styles.css',

  // JS CORE
  '/js/app.js',
  '/js/auth.js',
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

  // PORTAL PADRES (JS, NO HTML)
  '/js/parent-portal.js'
];

/* ==============================
   INSTALL
============================== */
self.addEventListener('install', event => {
  console.log('⚽ SW instalando:', CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
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
   FETCH (RUTAS CORREGIDAS)
============================== */
self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http')) return;

  /* 🔁 NAVEGACIÓN SPA / PWA */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => response)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  /* ❌ NO GET */
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
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

  /* 🟢 OTROS ARCHIVOS */
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
