// Estado global de la app
window.APP_STATE = {
  firebaseReady: false,
  currentUser: null
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

// Inicializar aplicación
async function initApp() {
  console.log('🚀 Inicializando MY CLUB...');
  
  // Inicializar Firebase PRIMERO
  if (typeof initFirebase === 'function') {
    try {
      const firebaseReady = await initFirebase();
      if (firebaseReady) {
        console.log('✅ Firebase listo para usar');
        window.APP_STATE.firebaseReady = true;
      }
    } catch (error) {
      console.log('⚠️ Firebase no disponible:', error);
      if (typeof displayClubIdInDashboard === 'function') {
        displayClubIdInDashboard();
      }
    }
  }
  
  // Aplicar modo oscuro PRIMERO
  applyDarkMode();
  
  // Cargar datos del club en el header
  const settings = getSchoolSettings();
  const currentUser = getCurrentUser();
  
  const headerLogo = document.getElementById('headerLogo');
  const headerClubName = document.getElementById('headerClubName');
  
  if (headerLogo) {
    headerLogo.src = settings.logo || getDefaultLogo();
  }
  
  if (headerClubName) {
    headerClubName.textContent = settings.name || 'MY CLUB';
  }
  
  // Aplicar color primario del club
  if (typeof applyPrimaryColor === 'function') {
    applyPrimaryColor();
  }
  
  // Actualizar notificaciones
  if (typeof updateNotifications === 'function') {
    updateNotifications();
  }
  
  // Cargar dashboard por defecto
  navigateTo('dashboard');
  
  // Inicializar Lucide icons
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
  
// ⭐ ACTIVAR LISTENER DE ELIMINACIÓN DE USUARIO
  if (typeof setupUserDeletionListener === 'function') {
    setupUserDeletionListener();
  }
  
  // 🔐 VERIFICAR LICENCIA
  if (typeof initLicenseSystem === 'function') {
    initLicenseSystem();
  }
  
  console.log('✅ MY CLUB inicializado correctamente');
  console.log('👤 Usuario:', currentUser?.name);
  console.log('⚽ Club:', settings.name);
}

// Cerrar modales al hacer click fuera
window.addEventListener('click', function(e) {
  if (e.target.id === 'playerModal') {
    if (typeof closePlayerModal === 'function') {
      closePlayerModal();
    }
  }
  if (e.target.id === 'playerDetailsModal') {
    if (typeof closePlayerDetailsModal === 'function') {
      closePlayerDetailsModal();
    }
  }
  if (e.target.id === 'paymentModal') {
    if (typeof closePaymentModal === 'function') {
      closePaymentModal();
    }
  }
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