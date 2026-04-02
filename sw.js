const CACHE_NAME = 'my-club-v1.0.42';

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
  '/js/parent-portal.js',

  // SDK de Firebase — necesarios para el arranque sin internet
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js'
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

  // Ignorar solo las llamadas de datos — estas siempre van a la red
  // Los archivos SDK de Firebase (gstatic.com/firebasejs) SÍ se cachean
  if (
    event.request.url.includes('firebaseio.com') ||
    event.request.url.includes('googleapis.com') ||
    event.request.url.includes('identitytoolkit') ||
    event.request.url.includes('securetoken.google.com') ||
    event.request.url.includes('unpkg.com') ||
    event.request.url.includes('cdn.jsdelivr.net') ||
    event.request.url.includes('cdnjs.cloudflare.com')
  ) {
    return;
  }

  /* 🔴 Solo GET */
  if (event.request.method !== 'GET') return;

  /* 🟢 CACHE FIRST — igual que inventario (que sí funciona offline)
     Sirve desde caché inmediatamente, actualiza en segundo plano cuando hay internet */
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      if (cached) {
        // Actualizar en segundo plano sin bloquear
        fetch(event.request).then(fresh => {
          if (fresh && fresh.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, fresh));
          }
        }).catch(() => {});
        return cached;
      }

      // No está en caché — ir a la red y guardar
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Sin internet y sin caché — fallback para navegación
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html') || caches.match('/offline.html');
        }
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