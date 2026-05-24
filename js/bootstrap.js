// ========================================
// BOOTSTRAP — Inicialización de la app
// Se ejecuta después de que todos los scripts estén cargados
// ========================================

// Inicializar Firebase
if (typeof initFirebase === 'function') {
    initFirebase();
}

// Inicializar Lucide Icons
try {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    } else {
        console.warn('⚠️ Lucide Icons no disponible — iconos no renderizados');
    }
} catch (e) {
    console.warn('⚠️ Error al inicializar Lucide Icons:', e);
}

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(registration => {
        // Detectar nueva versión disponible
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Usar modal personalizado en lugar de confirm() nativo
                    if (typeof showUpdateModal === 'function') {
                        showUpdateModal(() => {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                            window.location.reload();
                        });
                    } else {
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                        window.location.reload();
                    }
                }
            });
        });
    }).catch(err => console.log('❌ Error al registrar SW', err));
}
