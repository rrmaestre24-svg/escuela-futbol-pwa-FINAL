// ========================================
// VERIFICACIÓN DE SESIÓN - MEJORADA PARA MÓVILES
// ========================================

window.addEventListener('DOMContentLoaded', async function () {
    console.log('[INDEX] Verificando sesion...');

    // Mostrar loading mientras verificamos
    document.body.insertAdjacentHTML('afterbegin',
        '<div id="sessionLoader" class="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-[100]">' +
        '<div class="text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>' +
        '<p class="text-gray-600 dark:text-gray-400">Cargando...</p></div></div>'
    );

    function hideLoader() {
        const loader = document.getElementById('sessionLoader');
        if (loader) {
            loader.style.transition = 'opacity 0.3s ease';
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
        }
    }

    // 🩹 Evita la RACE entre el primer render (initApp → loadDashboard) y la
    // hidratación de window._cache desde IndexedDB (db-indexed.js → boot() →
    // hydrateCache(), disparada por este mismo evento DOMContentLoaded pero en
    // un listener registrado antes que este). Sin esto, en dispositivos lentos
    // el dashboard podía alcanzar a leer _cache todavía vacía (arrays === null)
    // y mostrar 0 hasta el próximo re-render. hydrateCache() es idempotente y
    // barata (lectura local a IndexedDB) — si ya terminó, esta espera es
    // prácticamente instantánea.
    async function ensureCacheHydrated() {
        if (window._cache && window._cache.hydrated) return;
        // hydrateCacheWithTimeout (db-indexed.js) dedupe las corridas concurrentes
        // y trae su propio techo de tiempo: si IndexedDB se cuelga, initApp() se
        // llama igual. Arrancar con la caché a medias es recuperable —la
        // revalidación la completa—; no arrancar, no.
        if (window.idb && typeof window.idb.hydrateCacheWithTimeout === 'function') {
            try { await window.idb.hydrateCacheWithTimeout(); }
            catch (e) { console.warn('[INDEX] hydrateCache previo a initApp falló:', e?.message || e); }
        }
    }

    // 1. Verificar sesion local primero
    const currentUser = getCurrentUser();

    if (currentUser && currentUser.email) {
        console.log('[INDEX] Sesion local encontrada:', maskEmail(currentUser.email));
        hideLoader();
        document.getElementById('appContainer').classList.remove('hidden');
        await ensureCacheHydrated();
        if (typeof initApp === 'function') {
            initApp();
        }
        return;
    }

    // 2. Verificar sesión en Supabase Auth
    if (window.SupaAuthV2 && window.SupaAuthV2.isLogged()) {
        console.log('[INDEX] Supabase tiene sesión activa');
        hideLoader();
        document.getElementById('appContainer').classList.remove('hidden');
        await ensureCacheHydrated();
        if (typeof initApp === 'function') {
            initApp();
        }
        return;
    }

    // 3. No hay sesión
    console.log('[INDEX] No hay sesion activa, redirigiendo a login');
    hideLoader();
    window.location.href = 'login.html';
});

console.log('✅ session-check.js cargado');
