// Estado global de la app
window.APP_STATE = {
  firebaseReady: false,
  currentUser: null,
  authRestored: false
};

// ========================================
// APLICACIÓN PRINCIPAL
// ========================================

// Navegación entre vistas
function navigateTo(view) {
  console.log('🔄 Navegando a:', view);
  
  // Ocultar todas las vistas
  const allViews = [
    'dashboardView',
    'playersView',
    'paymentsView',
    'calendarView',
    'settingsView',
    'birthdaysView',
    'notificationsView',
    'accountingView'
  ];
  
  allViews.forEach(viewId => {
    const element = document.getElementById(viewId);
    if (element) {
      element.classList.add('hidden');
    }
  });
  
  // Mostrar vista seleccionada
  const viewElement = document.getElementById(`${view}View`);
  if (viewElement) {
    viewElement.classList.remove('hidden');
  } else {
    console.error('❌ Vista no encontrada:', `${view}View`);
  }
  
  // Actualizar navegación activa
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const navItem = document.querySelector(`[data-nav="${view}"]`);
  if (navItem) {
    navItem.classList.add('active');
  }
  
  // Actualizar título del header
  const titles = {
    'dashboard': 'Dashboard',
    'players': 'Jugadores',
    'payments': 'Pagos',
    'calendar': 'Calendario',
    'settings': 'Configuración',
    'accounting': 'Contabilidad',
    'birthdays': 'Cumpleaños',
    'notifications': 'Notificaciones'
  };
  
  const headerViewName = document.getElementById('headerViewName');
  if (headerViewName) {
    headerViewName.textContent = titles[view] || 'MY CLUB';
  }
  
  // Cargar datos específicos de cada vista
  switch(view) {
    case 'dashboard':
      if (typeof updateDashboard === 'function') {
        updateDashboard();
      }
      break;
      
    case 'players':
      if (typeof renderPlayersList === 'function') {
        renderPlayersList();
      }
      break;
      
    case 'payments':
      // Mostrar tab de mensualidades por defecto
      if (typeof showPaymentTab === 'function') {
        showPaymentTab('monthly');
      }
      break;
      
    case 'calendar':
      if (typeof renderCalendar === 'function') {
        renderCalendar();
      }
      break;
      
    case 'settings':
      if (typeof loadSettings === 'function') {
        loadSettings();
      }
      break;
      
    case 'birthdays':
      if (typeof renderBirthdays === 'function') {
        renderBirthdays();
      }
      break;
      
    case 'notifications':
      if (typeof renderNotifications === 'function') {
        renderNotifications();
      }
      break;
      
    case 'accounting':
      if (typeof renderAccounting === 'function') {
        renderAccounting();
      }
      break;
  }
  
  // Scroll al inicio
  window.scrollTo(0, 0);
  
  // Recrear iconos de Lucide
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

// Toggle modo oscuro - VERSIÓN DEFINITIVA
function toggleDarkMode() {
  const html = document.documentElement;
  const body = document.body;
  const toggle = document.getElementById('darkModeToggle');
  const isDark = html.classList.contains('dark');
  
  console.log('🌓 Cambiando modo - Estado actual:', isDark ? 'OSCURO' : 'CLARO');
  
  if (isDark) {
    // ACTIVAR MODO CLARO
    html.classList.remove('dark');
    body.classList.remove('dark');
    localStorage.setItem('darkMode', 'false');
    if (toggle) toggle.checked = false;
    console.log('☀️ MODO CLARO ACTIVADO');
    showToast('☀️ Modo claro activado');
  } else {
    // ACTIVAR MODO OSCURO
    html.classList.add('dark');
    body.classList.add('dark');
    localStorage.setItem('darkMode', 'true');
    if (toggle) toggle.checked = true;
    console.log('🌙 MODO OSCURO ACTIVADO');
    showToast('🌙 Modo oscuro activado');
  }
  
  // Forzar repaint
  html.style.display = 'none';
  html.offsetHeight;
  html.style.display = '';
}

// Actualizar iconos de modo oscuro
function updateDarkModeIcons() {
  const isDark = document.documentElement.classList.contains('dark');
  const allButtons = document.querySelectorAll('button');
  
  allButtons.forEach(button => {
    const buttonText = button.textContent || button.innerHTML;
    if (buttonText.includes('toggleDarkMode') || button.getAttribute('onclick') === 'toggleDarkMode()') {
      const icon = button.querySelector('[data-lucide]');
      if (icon) {
        if (isDark) {
          icon.setAttribute('data-lucide', 'sun');
        } else {
          icon.setAttribute('data-lucide', 'moon');
        }
      }
    }
  });
  
  // Recrear iconos
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    setTimeout(() => {
      lucide.createIcons();
    }, 100);
  }
}

// Aplicar modo oscuro al cargar
function applyDarkMode() {
  const darkMode = localStorage.getItem('darkMode') === 'true';
  const html = document.documentElement;
  const body = document.body;
  
  console.log('🎨 Aplicando modo guardado:', darkMode ? 'OSCURO' : 'CLARO');
  
  if (darkMode) {
    html.classList.add('dark');
    body.classList.add('dark');
  } else {
    html.classList.remove('dark');
    body.classList.remove('dark');
  }
  
  updateDarkModeIcons();
}
// ========================================
// ANIMACIÓN DE BIENVENIDA - PWA PRINCIPAL
// ========================================

function showAdminWelcomeSplash(callback) {
  // Evitar que se muestre dos veces
  if (document.getElementById('adminWelcomeSplash')) {
    if (callback) callback();
    return;
  }

  const settings = getSchoolSettings();
  const currentUser = getCurrentUser();

  // Eliminar loader previo si existe
  const loader = document.getElementById('sessionLoader');
  if (loader) loader.remove();

  const splash = document.createElement('div');
  splash.id = 'adminWelcomeSplash';
  splash.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:linear-gradient(160deg,#0f766e 0%,#1d4ed8 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:16px;padding:32px;
  `;

 splash.innerHTML = `
    <div style="position:absolute;top:-80px;left:-80px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,0.05);"></div>
    <div style="position:absolute;bottom:-60px;right:-60px;width:250px;height:250px;border-radius:50%;background:rgba(255,255,255,0.04);"></div>

    <!-- TÍTULO BIENVENIDA ARRIBA -->
    <div id="adminSplashWelcome" style="opacity:0;transform:translateY(-20px);transition:all 0.5s ease 0.1s;text-align:center;">
      <p style="font-size:13px;color:rgba(255,255,255,0.6);margin:0;letter-spacing:0.15em;text-transform:uppercase;">Bienvenido </p>
      <h1 style="font-size:32px;font-weight:900;color:white;margin:4px 0 0;line-height:1.1;">${settings.name || 'MY CLUB'}</h1>
    </div>

    <div id="adminSplashDivider" style="opacity:0;transition:opacity 0.4s ease 0.3s;width:60px;height:2px;background:rgba(255,255,255,0.3);border-radius:2px;"></div>

    <!-- LOGO DEL CLUB -->
    <div id="adminSplashLogo" style="opacity:0;transform:scale(0.5);transition:all 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.4s;">
      <img src="${settings.logo || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%230d9488%22/%3E%3Ctext x=%2250%22 y=%2265%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22%3E⚽%3C/text%3E%3C/svg%3E'}"
           style="width:90px;height:90px;border-radius:22px;object-fit:cover;border:3px solid rgba(255,255,255,0.3);box-shadow:0 8px 32px rgba(0,0,0,0.3);">
    </div>

    <!-- ADMIN -->
    <div id="adminSplashUser" style="opacity:0;transform:translateY(20px);transition:all 0.5s ease 0.6s;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;">
      <img src="${currentUser?.avatar || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%236b7280%22/%3E%3Ctext x=%2250%22 y=%2265%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22%3E👤%3C/text%3E%3C/svg%3E'}"
           style="width:75px;height:75px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.9);box-shadow:0 4px 24px rgba(0,0,0,0.35);">
      <p style="font-size:18px;font-weight:800;color:white;margin:0;">${currentUser?.name || 'Administrador'}</p>
      <span style="font-size:11px;color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);padding:3px 14px;border-radius:20px;letter-spacing:0.08em;text-transform:uppercase;">Administrador</span>
    </div>

    <div id="adminSplashBar" style="opacity:0;transition:opacity 0.3s ease 0.9s;width:100%;max-width:220px;margin-top:4px;">
      <div style="width:100%;height:3px;background:rgba(255,255,255,0.2);border-radius:4px;overflow:hidden;">
        <div id="adminSplashProgress" style="height:100%;width:0%;background:white;border-radius:4px;transition:width 1.8s ease 1s;"></div>
      </div>
      <p style="font-size:11px;color:rgba(255,255,255,0.5);text-align:center;margin-top:8px;">Cargando panel...</p>
    </div>
  `;
  document.body.appendChild(splash);

  requestAnimationFrame(() => {
    setTimeout(() => { document.getElementById('adminSplashWelcome').style.opacity = '1'; document.getElementById('adminSplashWelcome').style.transform = 'translateY(0)'; }, 100);
    setTimeout(() => { document.getElementById('adminSplashDivider').style.opacity = '1'; }, 300);
    setTimeout(() => { document.getElementById('adminSplashLogo').style.opacity = '1'; document.getElementById('adminSplashLogo').style.transform = 'scale(1)'; }, 400);
    setTimeout(() => { document.getElementById('adminSplashUser').style.opacity = '1'; document.getElementById('adminSplashUser').style.transform = 'translateY(0)'; }, 600);
    setTimeout(() => { document.getElementById('adminSplashBar').style.opacity = '1'; }, 900);
    setTimeout(() => { document.getElementById('adminSplashProgress').style.width = '100%'; }, 950);
  });

  setTimeout(() => {
    splash.style.transition = 'opacity 0.5s ease';
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.remove();
      if (callback) callback();
    }, 500);
  }, 3000);
}
// Inicializar aplicación
async function initApp() {
  console.log('🚀 Inicializando MY CLUB...');

  // Aplicar modo oscuro PRIMERO
  applyDarkMode();

  // Cargar datos del localStorage inmediatamente
  const settings = getSchoolSettings();
  const currentUser = getCurrentUser();

  // Mostrar splash con datos del localStorage mientras Firebase carga en paralelo
  showAdminWelcomeSplash(async () => {

    // Cargar datos del club en el header
    const freshSettings = getSchoolSettings();
    const headerLogo = document.getElementById('headerLogo');
    const headerClubName = document.getElementById('headerClubName');

    if (headerLogo) headerLogo.src = freshSettings.logo || getDefaultLogo();
    if (headerClubName) headerClubName.textContent = freshSettings.name || 'MY CLUB';

    // ⭐ Logo como marca de agua
    if (freshSettings.logo) {
      document.documentElement.style.setProperty('--club-logo-url', `url("${freshSettings.logo}")`);
      document.body.classList.add('has-watermark');
    }

    // Aplicar color primario del club
    if (typeof applyPrimaryColor === 'function') applyPrimaryColor();

    // Actualizar notificaciones
    if (typeof updateNotifications === 'function') updateNotifications();

    // Cargar dashboard por defecto
    navigateTo('dashboard');

    // Inicializar Lucide icons
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

    // ⭐ ACTIVAR LISTENER DE ELIMINACIÓN DE USUARIO
    if (typeof setupUserDeletionListener === 'function') setupUserDeletionListener();

    // 🔐 VERIFICAR LICENCIA
    if (typeof initLicenseSystem === 'function') initLicenseSystem();

    console.log('✅ MY CLUB inicializado correctamente');
    console.log('👤 Usuario:', currentUser?.name);
    console.log('⚽ Club:', settings.name);

  }); // cierra showAdminWelcomeSplash

  // Firebase carga EN PARALELO mientras se muestra el splash
  if (typeof initFirebase === 'function') {
    try {
      const firebaseReady = await initFirebase();
      if (firebaseReady) {
        console.log('✅ Firebase listo para usar');
        window.APP_STATE.firebaseReady = true;
      }
    } catch (error) {
      console.log('⚠️ Firebase no disponible:', error);
      if (typeof displayClubIdInDashboard === 'function') displayClubIdInDashboard();
    }
  }
}

// Cerrar modales al hacer click fuera
window.addEventListener('click', function(e) {
  // playerModal no se cierra al tocar el fondo — solo con X o Cancelar
  if (e.target.id === 'playerDetailsModal') {
    if (typeof closePlayerDetailsModal === 'function') {
      closePlayerDetailsModal();
    }
  }
  // paymentModal no se cierra al tocar el fondo — solo con X o Guardar
  if (e.target.id === 'eventModal') {
    if (typeof closeEventModal === 'function') {
      closeEventModal();
    }
  }
  if (e.target.id === 'expenseModal') {
    if (typeof closeExpenseModal === 'function') {
      closeExpenseModal();
    }
  }
  if (e.target.id === 'paymentTypeSelectorModal') {
    if (typeof closePaymentTypeSelectorModal === 'function') {
      closePaymentTypeSelectorModal();
    }
  }
});

// Prevenir zoom en iOS
document.addEventListener('gesturestart', function(e) {
  e.preventDefault();
});

// Manejo de errores global
window.addEventListener('error', function(e) {
  console.error('❌ Error global:', e.message);
});

// Verificar que todas las funciones críticas estén cargadas
window.addEventListener('DOMContentLoaded', function() {
  console.log('🔍 Verificando funciones...');
  
  const criticalFunctions = [
    'navigateTo',
    'getPlayers',
    'getPayments',
    'getExpenses',
    'showUnifiedPaymentModal',
    'showAddExpenseModal'
  ];
  
  criticalFunctions.forEach(funcName => {
    if (typeof window[funcName] === 'undefined') {
      console.warn(`⚠️ Función ${funcName} no está definida`);
    } else {
      console.log(`✅ ${funcName} OK`);
    }
  });
});

console.log('✅ app.js cargado (ACTUALIZADO)');

// ========================================
// LISTENER: Detectar eliminación de usuario en tiempo real
// ========================================
function setupUserDeletionListener() {
  const currentUser = getCurrentUser();
  
  if (!currentUser || !window.firebase?.db) {
    console.log('⚠️ No se puede activar listener: usuario o Firebase no disponible');
    return;
  }
  
  const clubId = localStorage.getItem('clubId');
  
  if (!clubId || !currentUser.id) {
    console.log('⚠️ No se puede activar listener: falta clubId o userId');
    return;
  }
  
  console.log('👁️ Activando listener de eliminación para:', currentUser.email);
  
  // ✅ RUTA CORRECTA
  const userDocRef = window.firebase.doc(
    window.firebase.db,
    `clubs/${clubId}/users/${currentUser.id}`  // ✅ Ruta completa
  );
  
  // Escuchar cambios con manejo de errores
  const unsubscribe = window.firebase.onSnapshot(
    userDocRef,
    (docSnapshot) => {
      // Verificar si el documento fue eliminado
      if (!docSnapshot.exists()) {
        console.log('🚨 Usuario ELIMINADO de Firebase - Cerrando sesión...');
        handleUserDeleted();
        return;
      }
      
      // Verificar si fue marcado como eliminado
      const userData = docSnapshot.data();
      if (userData?.deleted === true) {
        console.log('🚨 Usuario MARCADO como eliminado - Cerrando sesión...');
        handleUserDeleted();
        return;
      }
      
      console.log('✅ Usuario activo - Listener funcionando');
    },
    (error) => {
      // Manejo de errores de permisos
      if (error.code === 'permission-denied') {
        console.warn('⚠️ Sin permisos para escuchar usuario (puede haber sido eliminado)');
        // Si hay error de permisos, probablemente el usuario fue eliminado
        handleUserDeleted();
      } else {
        console.error('❌ Error en listener de usuario:', error);
      }
    }
  );
  
  // Guardar unsubscribe para poder limpiarlo después
  window.userDeletionUnsubscribe = unsubscribe;
}

// Función para manejar usuario eliminado
function handleUserDeleted() {
  console.log('🚪 Procesando eliminación de usuario...');

  // Cancelar el listener ANTES de redirigir para no dejar conexiones huérfanas
  if (typeof window.userDeletionUnsubscribe === 'function') {
    window.userDeletionUnsubscribe();
    window.userDeletionUnsubscribe = null;
  }

  showToast('⚠️ Tu acceso ha sido revocado por el administrador', 'error');

  setTimeout(async () => {
    try {
      // Cerrar sesión de Firebase
      if (window.firebase?.auth) {
        await window.firebase.signOut(window.firebase.auth);
      }

      // Limpiar todo el almacenamiento local
      clearCurrentUser();
      localStorage.clear();
      sessionStorage.clear();

      // Redirigir al login
      window.location.href = 'login.html';

    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Forzar redirección de todas formas
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = 'login.html';
    }
  }, 2000); // 2 segundos para que el usuario lea el mensaje
}

console.log('✅ Sistema de detección de eliminación cargado');

// ========================================
// POLÍTICA DE PRIVACIDAD
// ========================================

// Mostrar política de privacidad
function showPrivacyPolicy() {
    const modal = document.getElementById('privacyPolicyModal');
    if (modal) {
        modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }
}

// Cerrar política de privacidad
function closePrivacyPolicy() {
    const modal = document.getElementById('privacyPolicyModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Exportar funciones
window.showPrivacyPolicy = showPrivacyPolicy;
window.closePrivacyPolicy = closePrivacyPolicy;

console.log('✅ Sistema de Política de Privacidad cargado');