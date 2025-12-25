// ========================================
// GESTIÓN DE CACHÉ Y ACTUALIZACIONES
// ========================================

// Limpiar caché y recargar la aplicación
async function clearAppCache() {
  if (!confirm('⚠️ Esto limpiará el caché de la aplicación y recargará la página.\n\n¿Deseas continuar?')) {
    return;
  }
  
  console.log('🧹 Iniciando limpieza de caché...');
  showToast('🧹 Limpiando caché...');
  
  try {
    // 1. Desregistrar todos los Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`📋 Encontrados ${registrations.length} service workers`);
      
      for (let registration of registrations) {
        await registration.unregister();
        console.log('✅ Service Worker desregistrado');
      }
    }
    
    // 2. Limpiar todos los cachés
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log(`📋 Encontrados ${cacheNames.length} cachés`);
      
      for (let cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log(`🗑️ Caché eliminado: ${cacheName}`);
      }
    }
    
    // 3. Limpiar sessionStorage (mantener localStorage con datos del usuario)
    sessionStorage.clear();
    console.log('✅ SessionStorage limpiado');
    
    showToast('✅ Caché limpiado. Recargando...');
    
    // 4. Esperar 1 segundo y recargar
    setTimeout(() => {
      // Forzar recarga desde el servidor (no desde caché)
      window.location.reload(true);
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error al limpiar caché:', error);
    showToast('❌ Error al limpiar caché');
  }
}

// Buscar actualizaciones manualmente
async function checkForUpdates() {
  console.log('🔍 Buscando actualizaciones...');
  showToast('🔍 Buscando actualizaciones...');
  
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        // Forzar actualización del Service Worker
        await registration.update();
        console.log('✅ Actualización verificada');
        
        // Verificar si hay una versión en espera
        if (registration.waiting) {
          showToast('✨ Nueva versión disponible. Limpia el caché para actualizar.');
          
          if (confirm('✨ Hay una nueva versión disponible.\n\n¿Deseas actualizar ahora?')) {
            // Activar el nuevo Service Worker
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            
            // Recargar cuando el nuevo SW tome control
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              window.location.reload();
            });
          }
        } else if (registration.installing) {
          showToast('⏳ Descargando actualización...');
        } else {
          showToast('✅ Ya tienes la última versión');
        }
      } else {
        showToast('⚠️ Service Worker no registrado');
        // Intentar registrar
        navigator.serviceWorker.register('sw.js')
          .then(() => {
            showToast('✅ Service Worker registrado. Recarga la página.');
          })
          .catch(err => {
            console.error('Error al registrar SW:', err);
            showToast('❌ Error al registrar Service Worker');
          });
      }
    } else {
      showToast('❌ Tu navegador no soporta Service Workers');
    }
  } catch (error) {
    console.error('❌ Error al buscar actualizaciones:', error);
    showToast('❌ Error al buscar actualizaciones');
  }
}

// Obtener información del caché
async function getCacheInfo() {
  if (!('caches' in window)) {
    return { caches: 0, size: 0 };
  }
  
  try {
    const cacheNames = await caches.keys();
    let totalSize = 0;
    
    for (let cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      
      for (let request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }
    
    return {
      caches: cacheNames.length,
      size: totalSize,
      sizeFormatted: formatBytes(totalSize)
    };
  } catch (error) {
    console.error('Error al obtener info del caché:', error);
    return { caches: 0, size: 0 };
  }
}

// Formatear bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Mostrar información del caché (opcional - para debug)
async function showCacheInfo() {
  const info = await getCacheInfo();
  console.log('📊 Información del caché:');
  console.log(`   - Número de cachés: ${info.caches}`);
  console.log(`   - Tamaño total: ${info.sizeFormatted}`);
  
  if (info.caches > 0) {
    showToast(`📊 Cachés: ${info.caches} | Tamaño: ${info.sizeFormatted}`);
  } else {
    showToast('📊 No hay cachés almacenados');
  }
}

// Actualización automática en segundo plano
if ('serviceWorker' in navigator) {
  // Verificar actualizaciones cada hora
  setInterval(async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        registration.update();
        console.log('🔄 Verificación automática de actualizaciones');
      }
    } catch (error) {
      console.error('Error en verificación automática:', error);
    }
  }, 60 * 60 * 1000); // 1 hora
}

console.log('✅ cache.js cargado');