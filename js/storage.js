// ========================================
// GESTIÓN DE LOCALSTORAGE - MEJORADO
// ========================================

// Inicializar estructura de datos
function initStorage() {
  if (!localStorage.getItem('users')) {
    localStorage.setItem('users', JSON.stringify([]));
  }
  if (!localStorage.getItem('players')) {
    localStorage.setItem('players', JSON.stringify([]));
  }
  if (!localStorage.getItem('payments')) {
    localStorage.setItem('payments', JSON.stringify([]));
  }
  if (!localStorage.getItem('calendarEvents')) {
    localStorage.setItem('calendarEvents', JSON.stringify([]));
  }
  if (!localStorage.getItem('schoolSettings')) {
    localStorage.setItem('schoolSettings', JSON.stringify({
      name: 'MI CLUB',
      logo: getDefaultLogo(),
      email: '',
      phone: '',
      address: '',
      city: '',
      country: 'Colombia',
      website: '',
      socialMedia: '',
      foundedYear: '',
      monthlyFee: 0,
      currency: 'COP',
      primaryColor: '#0d9488'
    }));
  }
  if (!localStorage.getItem('darkMode')) {
    localStorage.setItem('darkMode', 'false');
  }
}

// USUARIOS
function getUsers() {
  return JSON.parse(localStorage.getItem('users') || '[]');
}

function saveUser(user) {
  const users = getUsers();
  users.push(user);
  localStorage.setItem('users', JSON.stringify(users));
}

function updateUser(userId, userData) {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index !== -1) {
    users[index] = { ...users[index], ...userData };
    localStorage.setItem('users', JSON.stringify(users));
    
    // Actualizar sesión actual si es el mismo usuario
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      setCurrentUser({ ...currentUser, ...userData });
    }
  }
}

function getCurrentUser() {
  const user = localStorage.getItem('currentUser');
  return user ? JSON.parse(user) : null;
}

function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function clearCurrentUser() {
  localStorage.removeItem('currentUser');
}

// JUGADORES
function getPlayers() {
  return JSON.parse(localStorage.getItem('players') || '[]');
}

function getPlayerById(id) {
  const players = getPlayers();
  return players.find(p => p.id === id);
}

function savePlayer(player) {
  const players = getPlayers();
  players.push(player);
  localStorage.setItem('players', JSON.stringify(players));
}

function updatePlayer(playerId, playerData) {
  const players = getPlayers();
  const index = players.findIndex(p => p.id === playerId);
  if (index !== -1) {
    players[index] = { ...players[index], ...playerData };
    localStorage.setItem('players', JSON.stringify(players));
  }
}

function deletePlayer(playerId) {
  let players = getPlayers();
  players = players.filter(p => p.id !== playerId);
  localStorage.setItem('players', JSON.stringify(players));
  
  // También eliminar pagos asociados
  let payments = getPayments();
  payments = payments.filter(p => p.playerId !== playerId);
  localStorage.setItem('payments', JSON.stringify(payments));
}

function getActivePlayers() {
  return getPlayers().filter(p => p.status === 'Activo');
}

// PAGOS
function getPayments() {
  return JSON.parse(localStorage.getItem('payments') || '[]');
}

function getPaymentById(id) {
  const payments = getPayments();
  return payments.find(p => p.id === id);
}

function savePayment(payment) {
  const payments = getPayments();
  payments.push(payment);
  localStorage.setItem('payments', JSON.stringify(payments));
}

function updatePayment(paymentId, paymentData) {
  const payments = getPayments();
  const index = payments.findIndex(p => p.id === paymentId);
  if (index !== -1) {
    payments[index] = { ...payments[index], ...paymentData };
    localStorage.setItem('payments', JSON.stringify(payments));
  }
}

function deletePayment(paymentId) {
  let payments = getPayments();
  payments = payments.filter(p => p.id !== paymentId);
  localStorage.setItem('payments', JSON.stringify(payments));
}

function getPaymentsByPlayer(playerId) {
  return getPayments().filter(p => p.playerId === playerId);
}

function getPendingPayments() {
  return getPayments().filter(p => p.status === 'Pendiente');
}

function getPaidPayments() {
  return getPayments().filter(p => p.status === 'Pagado');
}

// EVENTOS DEL CALENDARIO
function getCalendarEvents() {
  return JSON.parse(localStorage.getItem('calendarEvents') || '[]');
}

function getEventById(id) {
  const events = getCalendarEvents();
  return events.find(e => e.id === id);
}

function saveEvent(event) {
  const events = getCalendarEvents();
  events.push(event);
  localStorage.setItem('calendarEvents', JSON.stringify(events));
}

function updateEvent(eventId, eventData) {
  const events = getCalendarEvents();
  const index = events.findIndex(e => e.id === eventId);
  if (index !== -1) {
    events[index] = { ...events[index], ...eventData };
    localStorage.setItem('calendarEvents', JSON.stringify(events));
  }
}

function deleteEvent(eventId) {
  let events = getCalendarEvents();
  events = events.filter(e => e.id !== eventId);
  localStorage.setItem('calendarEvents', JSON.stringify(events));
}

function getEventsByDate(date) {
  const events = getCalendarEvents();
  return events.filter(e => e.date === date);
}

function getUpcomingEvents(limit = 10) {
  const today = getCurrentDate();
  const events = getCalendarEvents();
  return events
    .filter(e => e.date >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, limit);
}

// CONFIGURACIÓN DEL CLUB
function getSchoolSettings() {
  return JSON.parse(localStorage.getItem('schoolSettings') || '{}');
}

function updateSchoolSettings(settings) {
  const current = getSchoolSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem('schoolSettings', JSON.stringify(updated));
}

// MODO OSCURO
function getDarkMode() {
  return localStorage.getItem('darkMode') === 'true';
}

function setDarkMode(enabled) {
  localStorage.setItem('darkMode', enabled.toString());
}

// NÚMERO DE FACTURA
function getNextInvoiceNumber() {
  const year = new Date().getFullYear();
  const payments = getPayments();
  const invoicesThisYear = payments.filter(p => 
    p.invoiceNumber && p.invoiceNumber.includes(year.toString())
  );
  
  const nextNumber = invoicesThisYear.length + 1;
  return `INV-${year}-${String(nextNumber).padStart(4, '0')}`;
}

// EXPORTAR TODOS LOS DATOS
function exportAllData() {
  const data = {
    users: getUsers(),
    players: getPlayers(),
    payments: getPayments(),
    calendarEvents: getCalendarEvents(),
    schoolSettings: getSchoolSettings(),
    exportDate: new Date().toISOString()
  };
  
  downloadJSON(data, `my-club-backup-${getCurrentDate()}.json`);
  showToast('✅ Datos exportados correctamente');
}

// IMPORTAR DATOS
function importData(jsonData) {
  try {
    const data = JSON.parse(jsonData);
    
    if (data.users) localStorage.setItem('users', JSON.stringify(data.users));
    if (data.players) localStorage.setItem('players', JSON.stringify(data.players));
    if (data.payments) localStorage.setItem('payments', JSON.stringify(data.payments));
    if (data.calendarEvents) localStorage.setItem('calendarEvents', JSON.stringify(data.calendarEvents));
    if (data.schoolSettings) localStorage.setItem('schoolSettings', JSON.stringify(data.schoolSettings));
    
    showToast('✅ Datos importados correctamente');
    return true;
  } catch (error) {
    console.error('Error al importar datos:', error);
    showToast('❌ Error al importar datos');
    return false;
  }
}

// LIMPIAR TODOS LOS DATOS
function clearAllData() {
  if (confirmAction('⚠️ ¿Estás seguro de eliminar TODOS los datos? Esta acción no se puede deshacer.')) {
    localStorage.clear();
    initStorage();
    showToast('✅ Todos los datos han sido eliminados');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }
}

// Inicializar al cargar
initStorage();

console.log('✅ storage.js cargado (MEJORADO)');