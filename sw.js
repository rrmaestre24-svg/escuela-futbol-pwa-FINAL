const CACHE_NAME = 'my-club-v1.0.4';
const urlsToCache = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/auth.js',
  './js/storage.js',
  './js/players.js',
  './js/payments.js',
  './js/notifications.js',
  './js/calendar.js',
  './js/birthdays.js',
  './js/accounting.js',
  './js/dashboard.js',
  './js/settings.js',
  './js/pdf.js',
  './js/whatsapp.js',
  './js/utils.js',
  './js/install.js',
  './js/cache.js',
  './js/pwa-icons.js' // ⭐ AGREGADO
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('⚽ Service Worker: Instalando v' + CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache abierto');
        return cache.addAll(urlsToCache).catch(err => {
          console.error('❌ Error al cachear archivos:', err);
          // Intentar cachear uno por uno
          return Promise.all(
            urlsToCache.map(url => {
              return cache.add(url).catch(err => {
                console.warn('No se pudo cachear:', url);
              });
            })
          );
        });
      })
  );
  // Forzar activación inmediata
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('⚽ Service Worker: Activando v' + CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Tomar control inmediato de todas las páginas
  return self.clients.claim();
});

// Escuchar mensajes
self.addEventListener('message', event => {
  // SKIP_WAITING para actualización inmediata
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏭️ Saltando espera - Activando nueva versión');
    self.skipWaiting();
  }
  
  // ⭐ NUEVO: Actualizar iconos PWA dinámicamente
  if (event.data && event.data.type === 'UPDATE_ICONS') {
    console.log('🎨 Mensaje recibido: Actualizar iconos PWA');
    const icons = event.data.icons || [];
    
    caches.open(CACHE_NAME).then(cache => {
      console.log('💾 Cacheando nuevos iconos:', icons.length, 'iconos');
      
      icons.forEach((icon, index) => {
        if (icon.src && icon.src.startsWith('data:image/')) {
          console.log(`✅ Icono ${index + 1} registrado (base64)`);
          // Los iconos en base64 están en el manifest, no requieren cache adicional
        }
      });
      
      console.log('✅ Iconos PWA actualizados en Service Worker');
    });
  }
  
  // ⭐ NUEVO: Limpiar cache de iconos antiguos
  if (event.data && event.data.type === 'CLEAR_ICON_CACHE') {
    console.log('🧹 Limpiando cache de iconos antiguos...');
    caches.open(CACHE_NAME).then(cache => {
      cache.keys().then(keys => {
        keys.forEach(request => {
          if (request.url.includes('pwa_icon') || request.url.includes('icon.png')) {
            cache.delete(request);
            console.log('🗑️ Icono antiguo eliminado:', request.url);
          }
        });
      });
    });
  }
});

// Estrategia: Network First, fallback a Cache (solo para GET)
self.addEventListener('fetch', event => {
  // Ignorar chrome-extension y otras URLs no HTTP
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Solo cachear solicitudes GET
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // ⭐ MANEJO ESPECIAL PARA MANIFEST DINÁMICO
  if (event.request.url.includes('blob:') && event.request.destination === 'manifest') {
    console.log('📄 Manifest dinámico solicitado');
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, cachearla
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, buscar en cache
        return caches.match(event.request).then(response => {
          if (response) {
            return response;
          }
          // Si no está en cache, mostrar página offline
          if (event.request.mode === 'navigate') {
            return caches.match('./offline.html');
          }
        });
      })
  );
});

console.log('✅ Service Worker cargado - v' + CACHE_NAME);