const CACHE_NAME = 'my-club-v1.0.10';
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
  './js/expenses.js', 
  './js/third-party-income.js', 
  './js/firebase-sync.js', 
  './js/modals.js', 
  './js/notifications.js',
  './js/calendar.js',
  './js/birthdays.js',
  './js/accounting.js',
  './js/dashboard.js',
  './js/settings.js',
  './js/club-settings-protection.js',
  './js/pdf.js',
  './js/whatsapp.js',
  './js/utils.js',
  './js/install.js',
  './js/cache.js',
  './js/pwa-icons.js',          
  './js/license-system.js'
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
  // 🆕 FORZAR ACTIVACIÓN INMEDIATA
  self.skipWaiting();
});

// Activación del Service Worker - 🆕 LIMPIEZA AGRESIVA
self.addEventListener('activate', event => {
  console.log('⚽ Service Worker: Activando v' + CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 🆕 ELIMINAR TODAS LAS CACHÉS ANTERIORES (no solo las diferentes)
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Cachés antiguas eliminadas');
      // 🆕 FORZAR CONTROL DE TODOS LOS CLIENTES INMEDIATAMENTE
      return self.clients.claim();
    })
  );
});

// Escuchar mensajes
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⭐ Saltando espera - Activando nueva versión');
    self.skipWaiting();
  }
  
  // 🆕 MENSAJE PARA LIMPIAR CACHE MANUALMENTE
  if (event.data && event.data.type === 'CLEAR_ALL_CACHE') {
    console.log('🧹 Limpiando TODA la caché...');
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('🗑️ Eliminando:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        console.log('✅ Toda la caché eliminada');
        // Recargar página para obtener archivos frescos
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'CACHE_CLEARED' });
          });
        });
      })
    );
  }
  
  if (event.data && event.data.type === 'UPDATE_ICONS') {
    console.log('🎨 Mensaje recibido: Actualizar iconos PWA');
    const icons = event.data.icons || [];
    
    caches.open(CACHE_NAME).then(cache => {
      console.log('💾 Cacheando nuevos iconos:', icons.length, 'iconos');
      
      icons.forEach((icon, index) => {
        if (icon.src && icon.src.startsWith('data:image/')) {
          console.log(`✅ Icono ${index + 1} registrado (base64)`);
        }
      });
      
      console.log('✅ Iconos PWA actualizados en Service Worker');
    });
  }
  
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

// 🆕 ESTRATEGIA MEJORADA: Network First con timeout corto
self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http')) {
    return;
  }

  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.url.includes('blob:') && event.request.destination === 'manifest') {
    console.log('📄 Manifest dinámico solicitado');
    event.respondWith(fetch(event.request));
    return;
  }

  // 🆕 Para archivos JS y CSS, SIEMPRE intentar red primero con timeout corto
  const isJsOrCss = event.request.url.endsWith('.js') || event.request.url.endsWith('.css');
  
  if (isJsOrCss) {
    event.respondWith(
      // Timeout de 3 segundos para archivos JS/CSS
      Promise.race([
        fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
              console.log('📦 Actualizado en cache:', event.request.url);
            });
          }
          return response;
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 3000)
        )
      ]).catch(() => {
        // Si falla la red, usar cache
        return caches.match(event.request).then(response => {
          if (response) {
            console.log('📂 Sirviendo desde cache:', event.request.url);
            return response;
          }
          return new Response('Archivo no disponible', { status: 503 });
        });
      })
    );
    return;
  }

  // Para otros archivos, estrategia normal
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(response => {
          if (response) {
            return response;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./offline.html');
          }
        });
      })
  );
});

console.log('✅ Service Worker cargado - v' + CACHE_NAME);
console.log('🔄 Modo: Network First con limpieza agresiva');