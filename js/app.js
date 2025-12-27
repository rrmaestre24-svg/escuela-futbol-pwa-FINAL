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
  // Ocultar todas las vistas
  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('playersView').classList.add('hidden');
  document.getElementById('paymentsView').classList.add('hidden');
  document.getElementById('calendarView').classList.add('hidden');
  document.getElementById('settingsView').classList.add('hidden');
  document.getElementById('birthdaysView').classList.add('hidden');
  document.getElementById('notificationsView').classList.add('hidden');
  document.getElementById('accountingView').classList.add('hidden');
  
  // Mostrar vista seleccionada
  const viewElement = document.getElementById(`${view}View`);
  if (viewElement) {
    viewElement.classList.remove('hidden');
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
  
  document.getElementById('headerViewName').textContent = titles[view] || 'MY CLUB';
// Cargar datos específicos de cada vista
if (view === 'dashboard') {
  updateDashboard();
} else if (view === 'players') {
  renderPlayersList();
} else if (view === 'payments') {
  showPaymentTab('monthly');
} else if (view === 'calendar') {
  renderCalendar();
} else if (view === 'settings') {
  loadSettings();
} else if (view === 'birthdays') {
  renderBirthdays();
} else if (view === 'notifications') {
  renderNotifications();
} else if (view === 'accounting') {
  renderAccounting();
}
  
  // Scroll al inicio
  window.scrollTo(0, 0);
}

// Toggle modo oscuro - VERSIÓN DEFINITIVA
function toggleDarkMode() {
  const html = document.documentElement;
  const body = document.body;
  const isDark = html.classList.contains('dark');
  
  console.log('🌓 Cambiando modo - Estado actual:', isDark ? 'OSCURO' : 'CLARO');
  
  if (isDark) {
    // ACTIVAR MODO CLARO
    html.classList.remove('dark');
    body.classList.remove('dark');
    localStorage.setItem('darkMode', 'false');
    console.log('☀️ MODO CLARO ACTIVADO');
    showToast('☀️ Modo claro activado');
  } else {
    // ACTIVAR MODO OSCURO
    html.classList.add('dark');
    body.classList.add('dark');
    localStorage.setItem('darkMode', 'true');
    console.log('🌙 MODO OSCURO ACTIVADO');
    showToast('🌙 Modo oscuro activado');
  }
  
  // Actualizar iconos
  updateDarkModeIcons();
  
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
    }
  }
  // Aplicar modo oscuro PRIMERO
  applyDarkMode();
  
  // Cargar datos del club en el header
  const settings = getSchoolSettings();
  const currentUser = getCurrentUser();
  
  document.getElementById('headerLogo').src = settings.logo || getDefaultLogo();
  document.getElementById('headerClubName').textContent = settings.name || 'MY CLUB';
  
  // Aplicar color primario del club
  if (typeof applyPrimaryColor === 'function') {
    applyPrimaryColor();
  }
  
  // Actualizar notificaciones
  updateNotifications();
  
  // Cargar dashboard por defecto
  navigateTo('dashboard');
  
  // Inicializar Lucide icons
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
  
  console.log('✅ MY CLUB inicializado correctamente');
  console.log('👤 Usuario:', currentUser?.name);
  console.log('⚽ Club:', settings.name);
}

// Cerrar modales al hacer click fuera
window.addEventListener('click', function(e) {
  if (e.target.id === 'playerModal') {
    closePlayerModal();
  }
  if (e.target.id === 'playerDetailsModal') {
    closePlayerDetailsModal();
  }
  if (e.target.id === 'paymentModal') {
    closePaymentModal();
  }
  if (e.target.id === 'eventModal') {
    closeEventModal();
  }
});

// Prevenir zoom en iOS
document.addEventListener('gesturestart', function(e) {
  e.preventDefault();
});

// Manejo de errores global
window.addEventListener('error', function(e) {
  console.error('Error:', e.message);
});

console.log('✅ app.js cargado');