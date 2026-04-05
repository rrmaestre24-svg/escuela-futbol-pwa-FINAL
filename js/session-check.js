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

    console.log('[INDEX] No hay sesion local, esperando Firebase...');

    // 2. Esperar a que Firebase Auth verifique (hasta 10 segundos)
    let attempts = 0;
    const maxAttempts = 20;

    const checkFirebase = setInterval(async () => {
        attempts++;

        // Verificar si localStorage fue restaurado
        const restored = getCurrentUser();
        if (restored && restored.email) {
            clearInterval(checkFirebase);
            console.log('[INDEX] Sesion restaurada:', restored.email);
            hideLoader();
            document.getElementById('appContainer').classList.remove('hidden');
            if (typeof initApp === 'function') {
                initApp();
            }
            return;
        }

        // Verificar Firebase Auth directamente
        if (window.firebase && window.firebase.auth && window.firebase.auth.currentUser) {
            clearInterval(checkFirebase);
            console.log('[INDEX] Firebase tiene usuario, restaurando...');

            const user = window.firebase.auth.currentUser;
            let clubId = localStorage.getItem('clubId');

            // Buscar clubId en Firebase si no esta local
            if (!clubId && window.firebase.db) {
                try {
                    const mappingRef = window.firebase.doc(window.firebase.db, 'userClubMapping', user.email);
                    const mappingSnap = await window.firebase.getDoc(mappingRef);
                    if (mappingSnap.exists()) {
                        clubId = mappingSnap.data().clubId;
                        localStorage.setItem('clubId', clubId);
                    }
                } catch (e) {
                    console.warn('[INDEX] Error buscando clubId:', e);
                }
            }

            if (clubId) {
                try {
                    const userRef = window.firebase.doc(window.firebase.db, 'clubs/' + clubId + '/users', user.uid);
                    const userSnap = await window.firebase.getDoc(userRef);

                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        const sessionData = {
                            id: user.uid,
                            email: user.email,
                            name: userData.name || user.email.split('@')[0],
                            schoolId: clubId,
                            isMainAdmin: userData.isMainAdmin || false,
                            role: userData.role || 'admin',
                            avatar: userData.avatar || '',
                            phone: userData.phone || ''
                        };

                        // Guardar sesion
                        localStorage.setItem('currentUser', JSON.stringify(sessionData));
                        sessionStorage.setItem('currentUser', JSON.stringify(sessionData));

                        console.log('[INDEX] Sesion restaurada desde Firebase');
                        hideLoader();
                        document.getElementById('appContainer').classList.remove('hidden');
                        if (typeof initApp === 'function') {
                            initApp();
                        }
                        return;
                    }
                } catch (e) {
                    console.warn('[INDEX] Error restaurando:', e);
                }
            }

            // Usuario en Firebase pero no pudimos restaurar — cerrar sesion para evitar bucle infinito
            try {
                if (window.firebase?.auth) {
                    await window.firebase.signOut(window.firebase.auth);
                }
            } catch (e) { }
            localStorage.removeItem('currentUser');
            localStorage.removeItem('clubId');
            sessionStorage.clear();
            hideLoader();
            window.location.href = 'login.html';
            return;
        }

        // Firebase confirmo que no hay sesion
        if (window.APP_STATE && window.APP_STATE.authRestored && !(window.firebase && window.firebase.auth && window.firebase.auth.currentUser)) {
            clearInterval(checkFirebase);
            console.log('[INDEX] No hay sesion en Firebase');
            hideLoader();
            window.location.href = 'login.html';
            return;
        }

        // Timeout
        if (attempts >= maxAttempts) {
            clearInterval(checkFirebase);
            console.log('[INDEX] Timeout, redirigiendo a login');
            hideLoader();
            window.location.href = 'login.html';
        }
    }, 500);
});

console.log('✅ session-check.js cargado');
