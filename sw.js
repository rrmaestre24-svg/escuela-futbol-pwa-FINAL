const CACHE_NAME = 'my-club-v1.0.14';

const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/offline.html',
  '/manifest.json',
  '/parent-manifest.json',

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
  '/js/sugerencias-admin.js',

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
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('⚠️ Algunos archivos no se pudieron cachear:', err);
        // Continuar aunque algunos archivos fallen
        return Promise.resolve();
      });
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
          // Si falla, intentar desde cache
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            // Si no hay cache, mostrar offline.html
            return caches.match('/offline.html');
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