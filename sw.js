// ========================================
// SERVICE WORKER — escuela-futbol-pwa-FINAL v2
// Estrategia: Cache First con actualización en segundo plano
// ========================================

const CACHE_NAME = 'my-club-v2.0.0';

const LOCAL_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/offline.html',
  '/manifest.json',
  '/css/tailwind.min.css',
  '/css/styles.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/firebase-config.js',
  '/js/storage.js',
  '/js/utils.js',
  '/js/install.js',
  '/js/cache.js',
  '/js/pwa-icons.js',
  '/js/license-system.js',
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
  '/js/pwa-native.js',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png'
];

// CDNs externos — se pre-cachean para funcionar sin internet
const CDN_ASSETS = [
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js'
];

// ── INSTALACIÓN ──────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando my-club-v2.0.0...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        [...LOCAL_ASSETS, ...CDN_ASSETS].map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] No cacheado:', url, err.message)
          )
        )
      )
    ).then(() => {
      console.log('[SW] Instalación completa');
      self.skipWaiting();
    })
  );
});

// ── ACTIVACIÓN ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Eliminando caché vieja:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (event.request.method !== 'GET') return;

  // Datos de Firestore/Auth van siempre a la red — Firestore maneja su propio offline
  if (
    url.includes('firebaseio.com') ||
    url.includes('identitytoolkit') ||
    url.includes('securetoken.google.com')
  ) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Servir desde caché y actualizar en segundo plano
        fetch(event.request).then(fresh => {
          if (fresh && fresh.status === 200) {
            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, fresh)
            );
          }
        }).catch(() => {});
        return cached;
      }

      // No está en caché — ir a la red y guardar
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, clone)
          );
        }
        return response;
      }).catch(() => {
        // Sin internet y sin caché
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html').then(r => r || caches.match('/offline.html'));
        }
      });
    })
  );
});

// ── MENSAJES ─────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_ALL_CACHE') {
    event.waitUntil(
      caches.keys().then(names =>
        Promise.all(names.map(n => caches.delete(n)))
      )
    );
  }
});

console.log('[SW] my-club v2.0.0 listo');
