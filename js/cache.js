// ========================================
// GESTIÓN DE CACHÉ Y ACTUALIZACIONES
// ========================================

// Limpiar caché y recargar la aplicación
async function clearAppCache() {
  const confirmed = await showAppConfirm('⚠️ Esto limpiará el caché de la aplicación y recargará la página.\n\n¿Deseas continuar?', {
    type: 'warning',
    title: 'Limpiar caché de la app',
    confirmText: 'Sí, limpiar'
  });
  if (!confirmed) {
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

// Mostrar modal de actualización con logo y nombre de la app
function showUpdateModal(onAccept) {
  // Evitar duplicados
  if (document.getElementById('updateModal')) return;

  const settings = typeof getSchoolSettings === 'function' ? getSchoolSettings() : {};
  const logoSrc = settings.logo || 'assets/icons/icon-192x192.png';

  const modal = document.createElement('div');
  modal.id = 'updateModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';

  modal.innerHTML = `
    <div style="background:#1f2937;border-radius:1.25rem;padding:2rem;max-width:320px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.5);animation:scaleIn .2s ease">
      <!-- Logo del club -->
      <div style="width:80px;height:80px;border-radius:50%;overflow:hidden;margin:0 auto 0.75rem;border:3px solid #0d9488;background:#111827">
        <img src="${logoSrc}" alt="Logo" style="width:100%;height:100%;object-fit:cover"
          onerror="this.src='assets/icons/icon-192x192.png'">
      </div>

      <!-- Nombre app -->
      <p style="font-size:1.25rem;font-weight:800;color:#0d9488;letter-spacing:.1em;margin-bottom:0.25rem">MY CLUB</p>
      <p style="font-size:0.7rem;color:#6b7280;margin-bottom:1.5rem;letter-spacing:.05em">GESTIÓN ESCUELAS DE FÚTBOL</p>

      <!-- Mensaje -->
      <div style="background:#111827;border-radius:.75rem;padding:1rem;margin-bottom:1.5rem">
        <p style="font-size:1.5rem;margin-bottom:.5rem">✨</p>
        <p style="color:#f9fafb;font-weight:600;font-size:.95rem;margin-bottom:.25rem">Nueva versión disponible</p>
        <p style="color:#9ca3af;font-size:.8rem">La app se recargará para aplicar la actualización.</p>
      </div>

      <!-- Botones -->
      <div style="display:flex;gap:.75rem">
        <button id="updateModalCancel"
          style="flex:1;padding:.75rem;border-radius:.75rem;background:#374151;color:#d1d5db;font-weight:600;font-size:.9rem;border:none;cursor:pointer">
          Ahora no
        </button>
        <button id="updateModalAccept"
          style="flex:1;padding:.75rem;border-radius:.75rem;background:linear-gradient(135deg,#0d9488,#0891b2);color:#fff;font-weight:700;font-size:.9rem;border:none;cursor:pointer">
          Actualizar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('updateModalCancel').onclick = () => modal.remove();
  document.getElementById('updateModalAccept').onclick = () => {
    modal.remove();
    onAccept();
  };
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
          showUpdateModal(() => {
            // Activar el nuevo Service Worker
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            // Recargar cuando el nuevo SW tome control
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              window.location.reload();
            });
          });
        } else if (registration.installing) {
          showToast('⏳ Descargando actualización...');
        } else {
          showToast('✅ Ya tienes la última versión');
        }
      } else {
        showToast('⚠️ Service Worker no registrado');
        navigator.serviceWorker.register('sw.js')
          .then(() => showToast('✅ Service Worker registrado. Recarga la página.'))
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