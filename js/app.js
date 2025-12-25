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
  document.getElementById(`${view}View`).classList.remove('hidden');
  
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
    'settings': 'Configuración'
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
  }
  
  // Scroll al inicio
  window.scrollTo(0, 0);
}

// Inicializar aplicación
function initApp() {
  console.log('🚀 Inicializando MY CLUB...');
  
  // Aplicar modo oscuro
  applyDarkMode();
  
  // Cargar datos del club en el header
  const settings = getSchoolSettings();
  const currentUser = getCurrentUser();
  
  document.getElementById('headerLogo').src = settings.logo || getDefaultLogo();
  document.getElementById('headerClubName').textContent = settings.name || 'MY CLUB';
  
  // Actualizar notificaciones
  updateNotifications();
  
  // Cargar dashboard por defecto
  navigateTo('dashboard');
  
  // Inicializar Lucide icons
  lucide.createIcons();
  
  console.log('✅ MY CLUB inicializado correctamente');
  console.log('👤 Usuario:', currentUser?.name);
  console.log('⚽ Club:', settings.name);
}

// Cerrar modales al hacer click fuera
window.addEventListener('click', function(e) {
  // Modal de jugador
  if (e.target.id === 'playerModal') {
    closePlayerModal();
  }
  // Modal de detalles de jugador
  if (e.target.id === 'playerDetailsModal') {
    closePlayerDetailsModal();
  }
  // Modal de pago
  if (e.target.id === 'paymentModal') {
    closePaymentModal();
  }
  // Modal de evento
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

// Logs de carga
console.log('✅ app.js cargado');
console.log('🎯 MY CLUB PWA v1.0');
console.log('⚽ Sistema de gestión de escuelas de fútbol');