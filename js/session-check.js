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

    // 1. Verificar sesion local primero
    const currentUser = getCurrentUser();

    if (currentUser && currentUser.email) {
        console.log('[INDEX] Sesion local encontrada:', currentUser.email);
        hideLoader();
        document.getElementById('appContainer').classList.remove('hidden');
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
