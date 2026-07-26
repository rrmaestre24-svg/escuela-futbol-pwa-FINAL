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

    // Helper: verificar que haya JWT de Supabase válido (no solo localStorage.currentUser).
    // Si no hay pero existe refresh_token, intenta refrescar una vez.
    async function _hasValidSession() {
        if (window.SupaAuthV2 && typeof window.SupaAuthV2.getToken === 'function' && window.SupaAuthV2.getToken()) {
            return true;
        }
        if (window.SupaAuth && typeof window.SupaAuth.getToken === 'function' && window.SupaAuth.getToken()) {
            return true;
        }
        // Intentar refrescar — el refresh_token puede ser de Supabase v2
        if (window.SupaAuthV2 && typeof window.SupaAuthV2.refreshToken === 'function') {
            try {
                await window.SupaAuthV2.refreshToken();
                if (window.SupaAuthV2.getToken()) return true;
            } catch (_) {}
        }
        return false;
    }

    // Muestra un banner no bloqueante de "sin conexión" en vez de bloquear la app
    function _showOfflineBanner() {
        try {
            if (document.getElementById('offlineSessionBanner')) return;
            const b = document.createElement('div');
            b.id = 'offlineSessionBanner';
            b.className = 'fixed top-0 left-0 right-0 z-[5000] bg-amber-500 text-white text-center py-2 px-4 text-xs font-semibold shadow-lg';
            b.textContent = '📡 Sin conexión — algunos datos pueden no estar actualizados';
            document.body.prepend(b);
        } catch (_) {}
    }

    // 1. Verificar sesion local primero + JWT válido
    const currentUser = getCurrentUser();

    if (currentUser && currentUser.email) {
        const tieneJwt = await _hasValidSession();
        if (!tieneJwt) {
            const _offline = typeof navigator !== 'undefined' && navigator.onLine === false;
            if (_offline) {
                // Sin internet: dejar entrar con datos locales, mostrar aviso no bloqueante
                console.warn('[INDEX] ⚠️ Sin conexión — no se pudo verificar la sesión. Se usan datos locales.');
                _showOfflineBanner();
            } else {
                // Hay red y el servidor no validó la sesión → redirect al login
                console.warn('[INDEX] ⛔ localStorage.currentUser existe pero no hay JWT de Supabase — sesión expirada. Redirigiendo al login.');
                hideLoader();
                try { localStorage.setItem('_session_expired_msg', 'Tu sesión expiró. Iniciá sesión de nuevo para continuar.'); } catch (_) {}
                window.location.href = 'login.html';
                return;
            }
        }
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
