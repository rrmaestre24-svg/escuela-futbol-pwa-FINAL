// ========================================
// GESTIÓN DE LOCALSTORAGE - CON SINCRONIZACIÓN AUTOMÁTICA
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
  if (!localStorage.getItem('expenses')) {
    localStorage.setItem('expenses', JSON.stringify([]));
  }
  // 🆕 NUEVO: Inicializar thirdPartyIncomes
  if (!localStorage.getItem('thirdPartyIncomes')) {
    localStorage.setItem('thirdPartyIncomes', JSON.stringify([]));
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
      monthlyDueDay: 10,
      monthlyGraceDays: 5,
      monthlyReminderTemplate: '',
      autoWhatsAppEnabled: false,
      coachCode: '',
      currency: 'COP',
      primaryColor: '#0d9488'
    }));
  }
  if (!localStorage.getItem('darkMode')) {
    localStorage.setItem('darkMode', 'false');
  }
  if (!localStorage.getItem('schoolUsers')) {
    localStorage.setItem('schoolUsers', JSON.stringify([]));
  }
}

// USUARIOS
function getUsers() {
  try {
    const users = localStorage.getItem('users');
    const schoolUsers = localStorage.getItem('schoolUsers');
    
    const parsedUsers = users ? JSON.parse(users) : [];
    const parsedSchoolUsers = schoolUsers ? JSON.parse(schoolUsers) : [];
    
    // Combinar usuarios principales y de escuela
    const allUsers = [...parsedUsers, ...parsedSchoolUsers];
    
    // Incluir al admin actual
    const currentUser = getCurrentUser();
    if (currentUser) {
      const withCurrentUser = [currentUser, ...allUsers];
      // Eliminar duplicados por email
      return withCurrentUser.filter((user, index, self) => 
        index === self.findIndex(u => u.email === user.email)
      );
    }
    
    return allUsers;
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return [];
  }
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
  try {
    // Intentar localStorage primero
    const userStr = localStorage.getItem('currentUser');
    if (userStr) return JSON.parse(userStr);
    // Fallback a sessionStorage (por si localStorage falla entre pestañas)
    const sessionUser = sessionStorage.getItem('currentUser');
    if (sessionUser) {
      localStorage.setItem('currentUser', sessionUser); // Restaurar a localStorage
      return JSON.parse(sessionUser);
    }
    return null;
  } catch (e) {
    console.warn('⚠️ currentUser corrupto en localStorage, limpiando...');
    localStorage.removeItem('currentUser');
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function clearCurrentUser() {
  localStorage.removeItem('currentUser');
}

// ========================================
// JUGADORES - CON SINCRONIZACIÓN AUTOMÁTICA
// ========================================

function getPlayers() {
  try {
    return JSON.parse(localStorage.getItem('players') || '[]');
  } catch (e) {
    console.warn('⚠️ players corrupto en localStorage, limpiando...');
    localStorage.removeItem('players');
    return [];
  }
}

function getPlayerById(id) {
  const players = getPlayers();
  return players.find(p => p.id === id);
}

function savePlayer(player) {
  const players = getPlayers();
  players.push(player);
  localStorage.setItem('players', JSON.stringify(players));
  
  // ⭐ SINCRONIZACIÓN AUTOMÁTICA
  if (typeof savePlayerToFirebase === 'function') {
    savePlayerToFirebase(player).catch(err => 
      console.warn('⚠️ No se pudo sincronizar jugador con Firebase:', err)
    );
  }
}

function updatePlayer(playerId, playerData) {
  const players = getPlayers();
  const index = players.findIndex(p => p.id === playerId);
  if (index !== -1) {
    players[index] = { ...players[index], ...playerData };
    localStorage.setItem('players', JSON.stringify(players));
    
    // ⭐ SINCRONIZACIÓN AUTOMÁTICA
    if (typeof savePlayerToFirebase === 'function') {
      savePlayerToFirebase(players[index]).catch(err => 
        console.warn('⚠️ No se pudo sincronizar jugador con Firebase:', err)
      );
    }
  }
}

function deletePlayer(playerId) {
  let players = getPlayers();
  players = players.filter(p => p.id !== playerId);
  localStorage.setItem('players', JSON.stringify(players));

  // Eliminar pagos del jugador de localStorage Y de Firebase
  let payments = getPayments();
  const orphanPayments = payments.filter(p => p.playerId === playerId);
  payments = payments.filter(p => p.playerId !== playerId);
  localStorage.setItem('payments', JSON.stringify(payments));

  // Borrar jugador de Firebase
  if (typeof deletePlayerFromFirebase === 'function') {
    deletePlayerFromFirebase(playerId).catch(err =>
      console.warn('⚠️ No se pudo eliminar jugador de Firebase:', err)
    );
  }

  // Borrar también sus pagos de Firebase para evitar pagos huérfanos
  if (typeof deletePaymentFromFirebase === 'function') {
    orphanPayments.forEach(payment => {
      deletePaymentFromFirebase(payment.id).catch(err =>
        console.warn('⚠️ No se pudo eliminar pago huérfano de Firebase:', err)
      );
    });
  }
}

function getActivePlayers() {
  return getPlayers().filter(p => {
    // ✅ COMPATIBILIDAD: jugadores sin status (datos antiguos) se tratan como Activo
    if (!p.status) return true;
    // ✅ COMPATIBILIDAD: acepta todas las variantes posibles del status
    const s = p.status.toLowerCase().trim();
    return s === 'activo' || s === 'active';
  });
}

// ✅ UTILIDAD: Normalizar status a formato estándar
function normalizePlayerStatus(status) {
  if (!status) return 'Activo';
  const s = status.toLowerCase().trim();
  if (s === 'activo' || s === 'active') return 'Activo';
  if (s === 'inactivo' || s === 'inactive') return 'Inactivo';
  return status; // Conservar valor original si es desconocido
}

// ========================================
// PAGOS - CON SINCRONIZACIÓN AUTOMÁTICA
// ========================================

function getPayments() {
  try {
    return JSON.parse(localStorage.getItem('payments') || '[]');
  } catch (e) {
    console.warn('⚠️ payments corrupto en localStorage, limpiando...');
    localStorage.removeItem('payments');
    return [];
  }
}

function getPaymentById(id) {
  const payments = getPayments();
  return payments.find(p => p.id === id);
}

function savePayment(payment) {
  const payments = getPayments();
  payments.push(payment);
  localStorage.setItem('payments', JSON.stringify(payments));

  // Registrar en el log de movimientos
  const player = getPlayerById(payment.playerId);
  addPaymentLogEntry({
    action: 'Creado',
    invoiceNumber: payment.invoiceNumber || '-',
    playerName: player ? player.name : 'Desconocido',
    concept: payment.concept || payment.type || '-',
    amount: payment.amount || 0,
    adminName: (typeof getCurrentUser === 'function' && getCurrentUser()?.name) || 'Sistema',
    reason: ''
  });

  // ⭐ SINCRONIZACIÓN AUTOMÁTICA
  if (typeof savePaymentToFirebase === 'function') {
    savePaymentToFirebase(payment).catch(err =>
      console.warn('⚠️ No se pudo sincronizar pago con Firebase:', err)
    );
  }
}

function updatePayment(paymentId, paymentData) {
  const payments = getPayments();
  const index = payments.findIndex(p => p.id === paymentId);
  if (index !== -1) {
    payments[index] = { ...payments[index], ...paymentData };
    localStorage.setItem('payments', JSON.stringify(payments));
    
    // ⭐ SINCRONIZACIÓN AUTOMÁTICA
    if (typeof savePaymentToFirebase === 'function') {
      savePaymentToFirebase(payments[index]).catch(err => 
        console.warn('⚠️ No se pudo sincronizar pago con Firebase:', err)
      );
    }
  }
}

function deletePayment(paymentId) {
  let payments = getPayments();
  payments = payments.filter(p => p.id !== paymentId);
  localStorage.setItem('payments', JSON.stringify(payments));
  
  // ⭐ SINCRONIZACIÓN AUTOMÁTICA
  if (typeof deletePaymentFromFirebase === 'function') {
    deletePaymentFromFirebase(paymentId).catch(err => 
      console.warn('⚠️ No se pudo eliminar pago de Firebase:', err)
    );
  }
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

// ========================================
// EGRESOS - CON SINCRONIZACIÓN AUTOMÁTICA
// ========================================

function getExpenses() {
  try {
    const expenses = localStorage.getItem('expenses');
    return expenses ? JSON.parse(expenses) : [];
  } catch (error) {
    console.error('Error al obtener egresos:', error);
    return [];
  }
}

function getExpenseById(expenseId) {
  const expenses = getExpenses();
  return expenses.find(e => e.id === expenseId);
}

function saveExpense(expense) {
  const expenses = getExpenses();
  expenses.push(expense);
  localStorage.setItem('expenses', JSON.stringify(expenses));
  
  // ⭐ SINCRONIZACIÓN AUTOMÁTICA
  if (typeof saveExpenseToFirebase === 'function') {
    saveExpenseToFirebase(expense).catch(err => 
      console.warn('⚠️ No se pudo sincronizar egreso con Firebase:', err)
    );
  }
}

function updateExpense(expenseId, expenseData) {
  const expenses = getExpenses();
  const index = expenses.findIndex(e => e.id === expenseId);
  if (index !== -1) {
    expenses[index] = { ...expenses[index], ...expenseData };
    localStorage.setItem('expenses', JSON.stringify(expenses));
    
    // ⭐ SINCRONIZACIÓN AUTOMÁTICA
    if (typeof saveExpenseToFirebase === 'function') {
      saveExpenseToFirebase(expenses[index]).catch(err => 
        console.warn('⚠️ No se pudo sincronizar egreso con Firebase:', err)
      );
    }
  }
}

function deleteExpense(expenseId) {
  let expenses = getExpenses();
  expenses = expenses.filter(e => e.id !== expenseId);
  localStorage.setItem('expenses', JSON.stringify(expenses));
  
  // ⭐ SINCRONIZACIÓN AUTOMÁTICA
  if (typeof deleteExpenseFromFirebase === 'function') {
    deleteExpenseFromFirebase(expenseId).catch(err => 
      console.warn('⚠️ No se pudo eliminar egreso de Firebase:', err)
    );
  }
}

// ========================================
// 🆕 INGRESOS DE TERCEROS (OTROS INGRESOS)
// CON SINCRONIZACIÓN AUTOMÁTICA
// ========================================

function getThirdPartyIncomes() {
  try {
    const incomes = localStorage.getItem('thirdPartyIncomes');
    return incomes ? JSON.parse(incomes) : [];
  } catch (error) {
    console.error('Error al obtener ingresos de terceros:', error);
    return [];
  }
}

function getThirdPartyIncomeById(incomeId) {
  const incomes = getThirdPartyIncomes();
  return incomes.find(i => i.id === incomeId);
}

function saveThirdPartyIncome(income) {
  const incomes = getThirdPartyIncomes();
  incomes.push(income);
  localStorage.setItem('thirdPartyIncomes', JSON.stringify(incomes));
  
  // ⭐ SINCRONIZACIÓN AUTOMÁTICA
  if (typeof saveThirdPartyIncomeToFirebase === 'function') {
    saveThirdPartyIncomeToFirebase(income).catch(err => 
      console.warn('⚠️ No se pudo sincronizar ingreso con Firebase:', err)
    );
  }
}

function updateThirdPartyIncome(incomeId, incomeData) {
  const incomes = getThirdPartyIncomes();
  const index = incomes.findIndex(i => i.id === incomeId);
  if (index !== -1) {
    incomes[index] = { ...incomes[index], ...incomeData };
    localStorage.setItem('thirdPartyIncomes', JSON.stringify(incomes));
    
    // ⭐ SINCRONIZACIÓN AUTOMÁTICA
    if (typeof saveThirdPartyIncomeToFirebase === 'function') {
      saveThirdPartyIncomeToFirebase(incomes[index]).catch(err => 
        console.warn('⚠️ No se pudo sincronizar ingreso con Firebase:', err)
      );
    }
  }
}

function deleteThirdPartyIncome(incomeId) {
  let incomes = getThirdPartyIncomes();
  incomes = incomes.filter(i => i.id !== incomeId);
  localStorage.setItem('thirdPartyIncomes', JSON.stringify(incomes));
  
  // ⭐ SINCRONIZACIÓN AUTOMÁTICA
  if (typeof deleteThirdPartyIncomeFromFirebase === 'function') {
    deleteThirdPartyIncomeFromFirebase(incomeId).catch(err => 
      console.warn('⚠️ No se pudo eliminar ingreso de Firebase:', err)
    );
  }
}

// ========================================
// EVENTOS DEL CALENDARIO
// ========================================

function getCalendarEvents() {
  try {
    return JSON.parse(localStorage.getItem('calendarEvents') || '[]');
  } catch (e) {
    console.warn('⚠️ calendarEvents corrupto en localStorage, limpiando...');
    localStorage.removeItem('calendarEvents');
    return [];
  }
}

function getEventById(eventId) {
  const events = getCalendarEvents();
  return events.find(e => e.id === eventId);
}

function saveEvent(event) {
  const events = getCalendarEvents();
  events.push(event);
  localStorage.setItem('calendarEvents', JSON.stringify(events));
  
  // ⭐ SINCRONIZACIÓN AUTOMÁTICA
  if (typeof saveEventToFirebase === 'function') {
    saveEventToFirebase(event).catch(err => 
      console.warn('⚠️ No se pudo sincronizar evento con Firebase:', err)
    );
  }
}

function updateEvent(eventId, eventData) {
  const events = getCalendarEvents();
  const index = events.findIndex(e => e.id === eventId);
  if (index !== -1) {
    events[index] = { ...events[index], ...eventData };
    localStorage.setItem('calendarEvents', JSON.stringify(events));
    
    // ⭐ SINCRONIZACIÓN AUTOMÁTICA
    if (typeof saveEventToFirebase === 'function') {
      saveEventToFirebase(events[index]).catch(err => 
        console.warn('⚠️ No se pudo sincronizar evento con Firebase:', err)
      );
    }
  }
}

function deleteEvent(eventId) {
  let events = getCalendarEvents();
  events = events.filter(e => e.id !== eventId);
  localStorage.setItem('calendarEvents', JSON.stringify(events));
  
  // ⭐ SINCRONIZACIÓN AUTOMÁTICA
  if (typeof deleteEventFromFirebase === 'function') {
    deleteEventFromFirebase(eventId).catch(err => 
      console.warn('⚠️ No se pudo eliminar evento de Firebase:', err)
    );
  }
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

// ========================================
// CONFIGURACIÓN DEL CLUB
// ========================================

function getSchoolSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
    return {
      monthlyDueDay: 10,
      monthlyGraceDays: 5,
      monthlyReminderTemplate: '',
      autoWhatsAppEnabled: false,
      ...settings
    };
  } catch (e) {
    console.warn('⚠️ schoolSettings corrupto en localStorage, limpiando...');
    localStorage.removeItem('schoolSettings');
    return {};
  }
}

function updateSchoolSettings(settings) {
  const current = getSchoolSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem('schoolSettings', JSON.stringify(updated));
  
  // ⭐ SINCRONIZACIÓN AUTOMÁTICA
  if (typeof syncAllToFirebase === 'function' && window.APP_STATE?.firebaseReady) {
    const clubId = localStorage.getItem('clubId');
    if (clubId && window.firebase?.db) {
      window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, "main"),
        { ...updated, lastUpdated: new Date().toISOString() }
      ).catch(err => console.warn('⚠️ No se pudo sincronizar configuración:', err));

      // 🆕 Sincronizar coachCode por separado para la App de Asistencia
      if (settings.coachCode !== undefined) {
        window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, "attendance"),
          { coachCode: settings.coachCode, updatedAt: new Date().toISOString() }
        ).catch(err => console.warn('⚠️ No se pudo sincronizar código de asistencia:', err));
      }
    }
  }
}

// MODO OSCURO
function getDarkMode() {
  return localStorage.getItem('darkMode') === 'true';
}

function setDarkMode(enabled) {
  localStorage.setItem('darkMode', enabled.toString());
}


// ========================================
// 🆕 NÚMERO DE FACTURA - DESDE FIREBASE
// ========================================
async function getNextInvoiceNumber() {
  // Intentar obtener desde Firebase primero
  if (typeof getNextInvoiceNumberFromFirebase === 'function') {
    try {
      return await getNextInvoiceNumberFromFirebase();
    } catch (error) {
      console.warn('⚠️ Error Firebase, usando local:', error);
    }
  }
  
  // Fallback: consecutivo local
  const payments = getPayments();
  const expenses = getExpenses();
  const thirdPartyIncomes = getThirdPartyIncomes();
  
  const allInvoices = [...payments, ...expenses, ...thirdPartyIncomes];
  const maxSequence = allInvoices.reduce((max, item) => {
    if (!item || typeof item.invoiceNumber !== 'string') return max;
    const match = item.invoiceNumber.match(/^INV-\d{4}-(\d+)$/);
    if (!match) return max;
    const sequence = parseInt(match[1], 10);
    if (!Number.isFinite(sequence)) return max;
    return Math.max(max, sequence);
  }, 0);

  const nextNumber = maxSequence + 1;
  const year = new Date().getFullYear();
  return `INV-${year}-${String(nextNumber).padStart(4, '0')}`;
}
// ========================================
// EXPORTAR DATOS JSON (respaldo completo — mantiene compatibilidad con importar)
// ========================================
function exportAllData() {
  const data = {
    users: getUsers(),
    players: getPlayers(),
    payments: getPayments(),
    expenses: getExpenses(),
    thirdPartyIncomes: getThirdPartyIncomes(),
    calendarEvents: getCalendarEvents(),
    schoolSettings: getSchoolSettings(),
    exportDate: new Date().toISOString()
  };
  downloadJSON(data, `my-club-backup-${getCurrentDate()}.json`);
  showToast('✅ Datos exportados correctamente');
}

// ========================================
// EXPORTAR EXCEL — Solo admin principal
// Genera un archivo .xlsx con hojas separadas por tema
// ========================================
async function exportDataExcel() {
  // Solo el admin principal puede exportar
  const user = getCurrentUser();
  if (!user || !user.isMainAdmin) {
    showToast('❌ Solo el administrador principal puede exportar datos');
    return;
  }

  // Cargar XLSX solo cuando se necesita (lazy load para no bloquear la carga inicial)
  if (typeof XLSX === 'undefined') {
    loadXLSX(() => exportDataExcel());
    return;
  }

  showToast('⏳ Generando Excel...');

  try {
    const wb = XLSX.utils.book_new();
    const today = getCurrentDate();

    // ── Hoja 1: Jugadores ──────────────────────────────────────────
    const players = getPlayers().map(p => ({
      'Nombre':         p.name || '',
      'Categoría':      p.category || '',
      'Estado':         p.status || 'Activo',
      'Posición':       p.position || '',
      'Camiseta':       p.jerseyNumber || '',
      'Teléfono':       p.phone || '',
      'Email':          p.email || '',
      'Fecha Registro': p.createdAt ? p.createdAt.split('T')[0] : ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(players), 'Jugadores');

    // ── Hoja 2: Pagos ──────────────────────────────────────────────
    const allPlayers = getPlayers();
    const payments = getPayments().map(p => {
      const jugador = allPlayers.find(j => j.id === p.playerId);
      return {
        'Jugador':          jugador ? jugador.name : (p.playerName || ''),
        'Categoría':        jugador ? jugador.category : '',
        'Concepto':         p.concept || p.description || '',
        'Monto':            p.amount || 0,
        'Estado':           p.status || '',
        'Fecha Pago':       p.paidDate || p.date || '',
        'Fecha Vencimiento':p.dueDate || '',
        'Método Pago':      p.paymentMethod || ''
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payments), 'Pagos');

    // ── Hoja 3: Egresos ────────────────────────────────────────────
    const expenses = getExpenses().map(e => ({
      'Descripción': e.description || e.concept || '',
      'Categoría':   e.category || '',
      'Monto':       e.amount || 0,
      'Fecha':       e.date || '',
      'Notas':       e.notes || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses), 'Egresos');

    // ── Hoja 4: Eventos del calendario ────────────────────────────
    const events = getCalendarEvents().map(e => ({
      'Título':    e.title || '',
      'Tipo':      e.type || '',
      'Fecha':     e.date || '',
      'Hora':      e.time || '',
      'Lugar':     e.location || '',
      'Categoría': e.category || 'Todas'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(events), 'Eventos');

    // ── Hoja 5: Asistencias (últimos 90 días desde Firestore) ──────
    const attendanceRows = await _fetchAttendanceForExport(user.schoolId);
    if (attendanceRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attendanceRows), 'Asistencias');
    }

    // Descargar el archivo
    XLSX.writeFile(wb, `myclub-backup-${today}.xlsx`);
    showToast('✅ Excel descargado correctamente');

  } catch (err) {
    console.error('[EXPORT] Error al generar Excel:', err);
    showToast('❌ Error al generar el archivo');
  }
}

// Lee asistencias de los últimos 90 días desde Firestore
async function _fetchAttendanceForExport(clubId) {
  if (!clubId || !window.firebase?.db) return [];

  try {
    const { collection, query, where, getDocs, orderBy } = window.firebase;
    const db = window.firebase.db;

    // Fecha límite: hace 90 días
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const attendanceRef = collection(db, `clubs/${clubId}/attendance`);
    const q = query(attendanceRef, where('date', '>=', cutoffStr), orderBy('date', 'desc'));
    const snap = await getDocs(q);

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data();
      // Cada documento tiene records{} con un entry por jugador
      const records = d.records || {};
      Object.entries(records).forEach(([playerName, status]) => {
        rows.push({
          'Fecha':       d.date || '',
          'Categoría':   d.category || '',
          'Turno':       d.turn || '',
          'Entrenador':  d.coachName || d.coachId || '',
          'Jugador':     playerName,
          'Estado':      typeof status === 'object' ? (status.status || '') : status,
          'Motivo Excusa': typeof status === 'object' ? (status.excuseReason || '') : ''
        });
      });
    });

    return rows;
  } catch (err) {
    console.warn('[EXPORT] No se pudieron cargar asistencias:', err);
    return [];
  }
}

// ========================================
// 🆕 IMPORTAR DATOS - INCLUYE OTROS INGRESOS
// ========================================
function importData(jsonData) {
  try {
    const data = JSON.parse(jsonData);
    
    if (data.users) localStorage.setItem('users', JSON.stringify(data.users));
    if (data.players) localStorage.setItem('players', JSON.stringify(data.players));
    if (data.payments) localStorage.setItem('payments', JSON.stringify(data.payments));
    if (data.expenses) localStorage.setItem('expenses', JSON.stringify(data.expenses));
    if (data.thirdPartyIncomes) localStorage.setItem('thirdPartyIncomes', JSON.stringify(data.thirdPartyIncomes)); // 🆕
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

// ========================================
// SISTEMA MULTI-USUARIO POR ESCUELA
// ========================================

function saveUserToSchool(user, schoolId) {
  const users = getUsers();
  user.schoolId = schoolId;
  user.role = user.role || 'admin';
  users.push(user);
  localStorage.setItem('users', JSON.stringify(users));
}

function getSchoolUsers(schoolId) {
  const users = getUsers();
  return users.filter(u => u.schoolId === schoolId);
}

function canAddMoreUsers(schoolId) {
  const schoolUsers = getSchoolUsers(schoolId);
  return schoolUsers.length < 6;
}

function getCurrentSchoolId() {
  const currentUser = getCurrentUser();
  return currentUser ? currentUser.schoolId : null;
}

// Alias para compatibilidad con Firebase
function getAllPlayers() {
  return getPlayers();
}

function saveAllPlayers(players) {
  localStorage.setItem('players', JSON.stringify(players));
}

function saveSchoolSettings(settings) {
  updateSchoolSettings(settings);
}

// ========================================
// 🆕 IMPORTAR DESDE JSON - INCLUYE OTROS INGRESOS
// ========================================
function importDataFromJSON(file) {
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const jsonData = e.target.result;
      const data = JSON.parse(jsonData);
      
      if (!data.users && !data.players && !data.payments) {
        showToast('❌ Archivo JSON inválido');
        return;
      }
      
      if (!confirm('⚠️ ADVERTENCIA: Esto reemplazará TODOS los datos actuales.\n\n¿Estás seguro de continuar?')) {
        return;
      }
      
      if (data.users) localStorage.setItem('users', JSON.stringify(data.users));
      if (data.players) localStorage.setItem('players', JSON.stringify(data.players));
      if (data.payments) localStorage.setItem('payments', JSON.stringify(data.payments));
      if (data.expenses) localStorage.setItem('expenses', JSON.stringify(data.expenses));
      if (data.thirdPartyIncomes) localStorage.setItem('thirdPartyIncomes', JSON.stringify(data.thirdPartyIncomes)); // 🆕
      if (data.calendarEvents) localStorage.setItem('calendarEvents', JSON.stringify(data.calendarEvents));
      if (data.schoolSettings) localStorage.setItem('schoolSettings', JSON.stringify(data.schoolSettings));
      
      showToast('✅ Datos importados correctamente. Recargando...');
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('Error al importar datos:', error);
      showToast('❌ Error al leer el archivo JSON');
    }
  };
  
  reader.readAsText(file);
}

function openImportDialog() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
      importDataFromJSON(file);
    }
  };
  
  input.click();
}

// Inicializar al cargar
initStorage();

console.log('✅ storage.js cargado (CON EGRESOS, OTROS INGRESOS Y SINCRONIZACIÓN)');

// ========================================
// 🆕 PORTAL DE PADRES - CÓDIGOS DE ACCESO
// ========================================
// 📍 AGREGAR ESTE CÓDIGO AL FINAL DE storage.js
// 📍 ANTES de: console.log('✅ storage.js cargado...');
// ========================================

// Generar código único para padre
function generateParentAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin caracteres confusos (0,O,1,I,L)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Guardar código de acceso para un jugador
function saveParentCode(playerId, code) {
  const parentCodes = getParentCodes();
  
  // Eliminar código anterior si existe
  const existingIndex = parentCodes.findIndex(pc => pc.playerId === playerId);
  if (existingIndex !== -1) {
    parentCodes.splice(existingIndex, 1);
  }
  
  // Agregar nuevo código
  parentCodes.push({
    playerId: playerId,
    code: code,
    createdAt: new Date().toISOString(),
    lastAccess: null
  });
  
  localStorage.setItem('parentCodes', JSON.stringify(parentCodes));
  
  // Sincronizar con Firebase si está disponible
  syncParentCodeToFirebase(playerId, code);
  
  return code;
}

// Obtener todos los códigos de padres
function getParentCodes() {
  try {
    const codes = localStorage.getItem('parentCodes');
    return codes ? JSON.parse(codes) : [];
  } catch (error) {
    console.error('Error al obtener códigos de padres:', error);
    return [];
  }
}

// Obtener código de un jugador específico
function getParentCodeByPlayer(playerId) {
  const codes = getParentCodes();
  return codes.find(pc => pc.playerId === playerId);
}

// Validar código de acceso (devuelve el jugador si es válido)
function validateParentCode(clubId, accessCode) {
  const codes = getParentCodes();
  const codeData = codes.find(pc => pc.code === accessCode.toUpperCase());
  
  if (!codeData) {
    return null;
  }
  
  const player = getPlayerById(codeData.playerId);
  
  if (!player) {
    return null;
  }
  
  // Actualizar último acceso
  updateParentCodeAccess(codeData.playerId);
  
  return player;
}

// Actualizar último acceso del código
function updateParentCodeAccess(playerId) {
  const parentCodes = getParentCodes();
  const index = parentCodes.findIndex(pc => pc.playerId === playerId);
  
  if (index !== -1) {
    parentCodes[index].lastAccess = new Date().toISOString();
    localStorage.setItem('parentCodes', JSON.stringify(parentCodes));
  }
}

// Eliminar código de acceso
function deleteParentCode(playerId) {
  let parentCodes = getParentCodes();
  parentCodes = parentCodes.filter(pc => pc.playerId !== playerId);
  localStorage.setItem('parentCodes', JSON.stringify(parentCodes));
}

// Sincronizar código con Firebase
async function syncParentCodeToFirebase(playerId, code) {
  if (!window.APP_STATE?.firebaseReady || !window.firebase?.db) {
    console.log('⚠️ Firebase no disponible para sincronizar código de padre');
    return;
  }
  
  try {
    const clubId = localStorage.getItem('clubId');
    if (!clubId) return;
    
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/parentCodes`, playerId),
      {
        playerId: playerId,
        code: code,
        createdAt: new Date().toISOString()
      }
    );
    
    console.log('✅ Código de padre sincronizado con Firebase');
  } catch (error) {
    console.warn('⚠️ No se pudo sincronizar código de padre:', error);
  }
}

// Exportar funciones globalmente
window.generateParentAccessCode = generateParentAccessCode;
window.saveParentCode = saveParentCode;
window.getParentCodes = getParentCodes;
window.getParentCodeByPlayer = getParentCodeByPlayer;
window.validateParentCode = validateParentCode;
window.deleteParentCode = deleteParentCode;

console.log('✅ Sistema de códigos de padres cargado');

// ========================================
// REGISTRO DE MOVIMIENTOS DE PAGOS
// Guarda cada acción sobre facturas en localStorage.
// Persiste aunque el pago se elimine.
// ========================================

function getPaymentLog() {
  const raw = localStorage.getItem('paymentMovementLog');
  return raw ? JSON.parse(raw) : [];
}

// Agrega una entrada nueva al log
function addPaymentLogEntry(entry) {
  const log = getPaymentLog();
  log.unshift({
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    action: entry.action || 'Acción',
    invoiceNumber: entry.invoiceNumber || '-',
    playerName: entry.playerName || 'Desconocido',
    concept: entry.concept || '-',
    amount: entry.amount || 0,
    adminName: entry.adminName || 'Sistema',
    reason: entry.reason || ''
  });
  // Máximo 500 entradas para no saturar el localStorage
  if (log.length > 500) log.splice(500);
  localStorage.setItem('paymentMovementLog', JSON.stringify(log));
}

window.getPaymentLog = getPaymentLog;
window.addPaymentLogEntry = addPaymentLogEntry;

/**
 * 🛠️ MIGRACIÓN: Recuperar facturas antiguas que no están en el Log de Movimientos
 * Se ejecuta una sola vez para poblar el historial con datos previos a la actualización.
 */
function fixMissingPaymentLogEntries() {
  try {
    const log = getPaymentLog();
    const payments = getPayments();
    
    // Si ya hay muchos registros o ya se hizo, no procesar (optimización)
    if (localStorage.getItem('paymentLogBackfill_v1') === 'true') return;

    const existingInvoicesInLog = new Set(log.map(e => e.invoiceNumber));
    let newEntries = [];

    payments.forEach(p => {
      // Solo facturas pagadas que no estén ya en el log
      if (p.status === 'Pagado' && p.invoiceNumber && !existingInvoicesInLog.has(p.invoiceNumber)) {
        const player = getPlayerById(p.playerId);
        
        // Determinar quién lo creó
        let adminName = 'Sistema';
        if (p.createdBy) {
          adminName = typeof p.createdBy === 'object' ? (p.createdBy.name || 'Admin') : p.createdBy;
        }

        newEntries.push({
          id: 'log_bf_' + p.id + '_' + Math.random().toString(36).substr(2, 4),
          timestamp: p.createdAt || p.paidDate || new Date().toISOString(),
          action: 'Creado',
          invoiceNumber: p.invoiceNumber,
          playerName: player ? player.name : (p.playerName || 'Desconocido'),
          concept: p.concept || p.type || 'Pago antiguo',
          amount: p.amount || 0,
          adminName: adminName,
          reason: 'Recuperado de historial'
        });
      }
    });

    if (newEntries.length > 0) {
      console.log(`📦 Recuperando ${newEntries.length} facturas antiguas para el historial...`);
      const finalLog = [...log, ...newEntries];
      // Ordenar por fecha descendente
      finalLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      localStorage.setItem('paymentMovementLog', JSON.stringify(finalLog.slice(0, 500)));
    }

    localStorage.setItem('paymentLogBackfill_v1', 'true');
  } catch (error) {
    console.warn('⚠️ Error en migración de historial:', error);
  }
}

// Ejecutar migración al cargar el script
setTimeout(fixMissingPaymentLogEntries, 2000);