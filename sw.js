const CACHE_NAME = 'my-club-v1.10.4';

const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/terminos.html',
  '/offline.html',
  '/rescate.html',   // salida de emergencia: se cachea sólo como red de seguridad
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
  '/css/tailwind.out.css',

  // LIBRERÍAS LOCALES
  '/js/lucide.min.js',

  // JS CORE
  '/js/app.js',
  '/js/auth.js',
  '/js/supabase-config.js',
  '/js/supabase-auth.js',
  '/js/supabase-auth-v2.js',
  '/js/storage.js',
  '/js/firebase-sync.js',
  '/js/db-indexed.js',
  '/js/sync-queue.js',
  '/js/utils.js',
  '/js/phone-utils.js',
  '/js/theme.js',
  '/js/performance.js',
  '/js/install.js',
  '/js/cache.js',
  '/js/pwa-icons.js',
  '/js/pwa-native.js',
  '/js/license-system.js',

  // JS SINCRONIZACIÓN
  '/js/realtime-sync.js',

  // JS FEATURES
  '/js/storage-service.js',
  '/js/players.js',
  '/js/payments.js',
  '/js/multi-invoice.js',
  '/js/expenses.js',
  '/js/third-party-income.js',
  '/js/accounting.js',
  '/js/modals.js',
  '/js/notifications.js',
  '/js/weather.js',
  '/js/calendar.js',
  '/js/birthdays.js',
  '/js/dashboard.js',
  '/js/settings.js',
  '/js/club-settings-protection.js',
  '/js/pdf.js',
  '/js/whatsapp.js',
  '/js/import-players.js',
  '/js/documents-center.js',
  '/js/terms.js',
  '/js/coach-automation.js',
  '/js/parent-automation.js',
  '/js/manual-usuario.js',
  '/js/session-check.js',
  '/js/vibration.js',
  '/js/tailwind-config.js',
  '/js/bootstrap.js',
  '/js/sms-utils.js',
  '/js/sms-history.js',

  // PORTAL PADRES
  '/js/parent-portal.js',

  // CDN — cacheados para disponibilidad offline
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
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
   RED CON TOPE DE ESPERA
============================== */
/* Antes, HTML y JS eran "network first" sin límite: sólo se usaba la copia guardada
   si el fetch FALLABA. Con una conexión lenta pero no caída (wifi de sede, datos
   flojos) el fetch no falla — se queda esperando — y la app quedaba cargando para
   siempre aunque tuviera todos los archivos guardados. Caso real en producción.

   Ahora se sirve la copia guardada si la red no contestó en NETWORK_TIMEOUT_MS.
   La petición NO se cancela: sigue en segundo plano y refresca la caché, así la
   próxima apertura ya trae la versión nueva. Con red normal el comportamiento no
   cambia (la red gana la carrera muy por debajo del tope). */
const NETWORK_TIMEOUT_MS = 3000;

/* 🍎 Safari rechaza que un Service Worker responda una NAVEGACIÓN con una
   respuesta que arrastre redirecciones, con el error:
       "Response served by service worker has redirections"
   y la página no abre. Es una restricción de WebKit; Chrome no la aplica, por eso
   solo se veía en iPhone.

   Acá pasa porque Vercel tiene `cleanUrls: true`: `/index.html` redirige a `/` y
   `/login.html` a `/login`. Como el manifiesto arranca la PWA en `index.html`,
   CADA apertura desde el ícono caía en esto.

   La solución estándar (la misma de Workbox) es reconstruir la respuesta: mismo
   cuerpo, mismo estado, mismas cabeceras, pero sin la marca de redirección. */
function limpiarRedirecciones(response) {
  if (!response || !response.redirected) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function networkFirstConTope(request, { esNavegacion = false } = {}) {
  return new Promise(resolve => {
    let yaRespondio = false;
    const responder = res => {
      if (yaRespondio) return;
      yaRespondio = true;
      // Solo se limpia en navegaciones: es donde Safari lo exige, y reconstruir
      // la respuesta de un JS/CSS sin necesidad sería trabajo de más.
      resolve(esNavegacion ? limpiarRedirecciones(res) : res);
    };

    const temporizador = setTimeout(() => {
      caches.match(request, { ignoreSearch: true }).then(cacheada => {
        if (cacheada) {
          console.log('⏱️ Red lenta — sirviendo copia guardada:', request.url);
          responder(cacheada);
        }
        // Si no hay copia guardada no se responde acá: se sigue esperando a la red,
        // que es la única fuente posible.
      });
    }, NETWORK_TIMEOUT_MS);

    fetch(esNavegacion ? new Request(request, { cache: 'reload' }) : request)
      .then(response => {
        clearTimeout(temporizador);
        if (response && response.status === 200) {
          // Se guarda ya limpia: si se cacheara una respuesta con redirecciones,
          // al servirla más tarde desde la caché volvería a romper en Safari.
          const copia = limpiarRedirecciones(response.clone());
          caches.open(CACHE_NAME).then(cache => cache.put(request, copia));
        }
        responder(response);
      })
      .catch(() => {
        clearTimeout(temporizador);
        caches.match(request, { ignoreSearch: true }).then(cacheada => {
          if (cacheada) return responder(cacheada);
          if (!esNavegacion) return responder(Response.error());
          return caches.match('/index.html').then(idx => {
            if (idx) return responder(idx);
            return caches.match('/offline.html').then(off => responder(off || Response.error()));
          });
        });
      });
  });
}

/* ==============================
   FETCH
============================== */
self.addEventListener('fetch', event => {
  // Ignorar peticiones que no son HTTP/HTTPS
  if (!event.request.url.startsWith('http')) return;

  // Página de rescate: SIEMPRE la versión de la red, primero. Es la salida de
  // emergencia cuando la app quedó rota, así que no puede servirse una copia
  // vieja. Igual está precacheada (ver urlsToCache) y se usa como último recurso
  // si justo no hay red en el momento en que se la necesita.
  // limpiarRedirecciones: `cleanUrls` de Vercel redirige `/rescate.html` a
  // `/rescate`, y Safari no acepta una navegación con redirecciones servida por
  // el SW. Justo acá no puede fallar: es la salida de emergencia.
  if (event.request.url.indexOf('/rescate.html') !== -1) {
    event.respondWith(
      fetch(event.request)
        .then(limpiarRedirecciones)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Reset-password SIEMPRE a la red (nunca versión cacheadas).
  if (event.request.url.indexOf('/reset-password.html') !== -1) {
    event.respondWith(fetch(event.request).then(limpiarRedirecciones));
    return;
  }

  // Ignorar peticiones a Firebase, APIs externas, etc.
  // 🆕 Supabase REST/AUTH/FUNCTIONS NO se cachean (datos en tiempo real).
  // Supabase Storage (avatars/logos) SÍ se cachea más abajo con Cache First.
  if (
    event.request.url.includes('googleapis.com') ||
    event.request.url.includes('gstatic.com') ||
    event.request.url.includes('cloudinary.com') ||
    event.request.url.includes('unpkg.com') ||
    event.request.url.includes('cdn.tailwindcss.com') ||
    event.request.url.includes('cdn.jsdelivr.net') ||
    event.request.url.includes('cdnjs.cloudflare.com') ||
    event.request.url.includes('ui-avatars.com') ||
    event.request.url.includes('open-meteo.com') ||
    event.request.url.includes('.supabase.co/rest/') ||
    event.request.url.includes('.supabase.co/auth/') ||
    event.request.url.includes('.supabase.co/functions/')
  ) {
    return;
  }

  /* 🔴 NO cachear métodos que no son GET */
  if (event.request.method !== 'GET') {
    return;
  }

  /* 🟢 NAVEGACIÓN (HTML) → Red primero, con tope de espera */
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstConTope(event.request, { esNavegacion: true }));
    return;
  }

  /* 🟡 JS / CSS → Red primero, con tope de espera */
  if (
    event.request.url.endsWith('.js') ||
    event.request.url.endsWith('.css')
  ) {
    event.respondWith(networkFirstConTope(event.request));
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
