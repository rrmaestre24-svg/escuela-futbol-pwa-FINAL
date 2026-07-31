// ========================================
// VERIFICACIÓN DE SESIÓN - MEJORADA PARA MÓVILES
// ========================================

// Este archivo es el ÚNICO que decide si se muestra la app en index.html
// (js/auth.js se abstiene ahí a propósito). Por eso el arranque va envuelto:
// si algo acá lanzara una excepción, sin red de contención nadie destaparía la
// pantalla ni llamaría initApp(), y el usuario quedaría mirando el preloader.
// La red de seguridad de 18 s de index.html lo destaparía igual, pero SIN
// initApp() — o sea, un dashboard cáscara. Acá se resuelve al instante.
window.addEventListener('DOMContentLoaded', function () {
    _verificarSesionAlArrancar().catch(function (e) {
        console.error('[INDEX] ❌ El arranque falló:', e);
        try {
            localStorage.setItem('_diag_arranque_fallo', JSON.stringify({
                ts: Date.now(), iso: new Date().toISOString(),
                msg: String(e && e.message || e)
            }));
        } catch (_) {}
        // Sacar el preloader pase lo que pase.
        try { document.querySelectorAll('#sessionLoader').forEach(l => l.remove()); } catch (_) {}
        // Con sesión en el dispositivo: entrar igual. Un dashboard funcionando a
        // medias es recuperable; una pantalla trabada, no. Sin sesión: al login,
        // que es donde corresponde y no expone datos de nadie.
        let _haySesion = false;
        try { _haySesion = !!localStorage.getItem('currentUser'); } catch (_) {}
        if (!_haySesion) { window.location.href = 'login.html'; return; }
        try {
            const cont = document.getElementById('appContainer');
            if (cont) cont.classList.remove('hidden');
            if (typeof initApp === 'function') initApp();
        } catch (e2) { console.error('[INDEX] ❌ Falló también el arranque de emergencia:', e2); }
    });
});

async function _verificarSesionAlArrancar() {
    console.log('[INDEX] Verificando sesion...');

    // Mostrar loading mientras verificamos
    document.body.insertAdjacentHTML('afterbegin',
        '<div id="sessionLoader" class="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-[100]">' +
        '<div class="text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>' +
        '<p class="text-gray-600 dark:text-gray-400">Cargando...</p></div></div>'
    );

    // OJO: hay DOS elementos con id 'sessionLoader' — el preloader estático de
    // index.html (fondo opaco, z-index 99999) y el que inserta este archivo.
    // getElementById devuelve solo el primero del documento, así que la versión
    // vieja ocultaba uno y dejaba el otro tapando la pantalla para siempre si
    // initApp() no llegaba a showAdminWelcomeSplash() (que borra el que queda).
    // querySelectorAll los saca a los dos, sin depender de quién corra después.
    function hideLoader() {
        document.querySelectorAll('#sessionLoader').forEach(loader => {
            loader.style.transition = 'opacity 0.3s ease';
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
        });
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
                // 🔁 CORTA EL BUCLE DE REDIRECCIONES — no borrar esta línea.
                // login.html carga auth.js, cuyo arranque hace `if (currentUser)
                // → location.href = 'index.html'`. Si dejamos currentUser puesto,
                // login.html rebota a index.html, index.html vuelve a no encontrar
                // JWT y rebota al login: ciclo infinito, y el usuario NUNCA llega a
                // ver el formulario para escribir su contraseña. Pasó en producción.
                // Acá la sesión ya está confirmada como inválida (hay red y el
                // servidor no la validó), así que este marcador es basura: se va.
                // OJO: solo en esta rama. En la rama offline NO se toca, porque ahí
                // no sabemos si la sesión sirve y la app debe seguir andando local.
                try {
                    if (typeof clearCurrentUser === 'function') clearCurrentUser();
                    else localStorage.removeItem('currentUser');
                    sessionStorage.removeItem('currentUser');
                } catch (_) {}
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
}

console.log('✅ session-check.js cargado');
