// ========================================
// GESTIÓN DE LOCALSTORAGE - CON SINCRONIZACIÓN AUTOMÁTICA
// ========================================

// Guarda en localStorage tolerando QuotaExceededError.
// Si el cache local se llenó, registra el error y dispara un evento
// para que el monitor avise al usuario. La sincronización a la nube
// que viene después se ejecuta igual aunque esto falle.
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    const isQuota = err && (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 || err.code === 1014
    );
    if (isQuota) {
      console.error(`⚠️ Cuota localStorage agotada al guardar "${key}"`);
      window.dispatchEvent(new CustomEvent('storage-quota-exceeded', {
        detail: { key, size: value ? value.length : 0 }
      }));
    } else {
      console.error(`Error al guardar "${key}" en localStorage:`, err);
    }
    return false;
  }
}
window.safeSetItem = safeSetItem;

// Se declara ACÁ ARRIBA, antes de cualquier llamada de nivel superior, y no
// más abajo junto al resto: `const` tiene zona muerta temporal. Si algo entre
// medio llegara a lanzar, el navegador igual publica limpiarDatosDelClub() en
// window (así trata las funciones declaradas), pero la lista quedaría sin
// inicializar. El guard `typeof limpiarDatosDelClub === "function"` de auth.js
// y firebase-sync.js daría true, el respaldo NO entraría, y la limpieza
// fallaría con un error confuso dejando datos del club anterior en el equipo.
// Detectado probando de verdad, no en revisión.
// ════════════════════════════════════════════════════════════════════════════
// DATOS QUE PERTENECEN A UN CLUB Y NO PUEDEN SOBREVIVIR A UN CAMBIO DE CLUB
// ════════════════════════════════════════════════════════════════════════════
// Una SOLA lista, usada por los dos caminos que la necesitan:
//
//   · cerrar sesión                     → js/auth.js, logout()
//   · cambio de club SIN cerrar sesión  → js/firebase-sync.js, ensureClubIsolation
//     (pasa cuando vence la sesión, o cuando otro admin entra en el mismo equipo)
//
// Antes eran dos listas separadas y se desincronizaron: el logout limpiaba 18
// claves y el cambio de club solo 8. Lo que quedaba colgado del club anterior:
//
//   · dismissedNotifications → lo PEOR. Los descartes se sincronizan a la nube,
//     así que el club nuevo heredaba los ids del anterior y, al descartar
//     cualquier aviso, escribía ids de jugadores AJENOS en su propio registro.
//   · termsAcceptedVersion   → el club nuevo se salteaba los Términos y no
//     quedaba registrado su consentimiento.
//   · licenseModulos y las 4 de licencia → heredaba módulos de PAGO del anterior
//     hasta que la licencia se refrescaba sola.
//   · schoolSettings         → se reconstruye mezclando con lo anterior, así que
//     un club sin logo mostraría el del club previo.
//
// `clubId` NO va en esta lista a propósito: al cambiar de club hay que
// conservarlo (ya apunta al club nuevo). El logout lo borra por su cuenta.
const CLAVES_DEL_CLUB = [
  // listas de datos
  'players', 'payments', 'paymentsFullHistory', 'calendarEvents',
  'users', 'expenses', 'thirdPartyIncomes', 'parentCodes',
  // Personal/staff del club (getUsers() lo combina con 'users'). Hoy suele quedar
  // en [], pero es la clave compañera de 'users' y puede tener dato de un flujo
  // viejo; se limpia por higiene junto con el resto del personal.
  'schoolUsers',
  // Registro de movimientos de pagos. Guarda NOMBRE DE JUGADOR y MONTO sin marca
  // de club, getPaymentLog() lo lee sin filtrar, y no lo borraba nadie: en un
  // equipo compartido el club entrante veía —y exportaba en PDF— los movimientos
  // del club anterior. De forma permanente, no por unos segundos.
  'paymentMovementLog',
  // Profes: nombre, teléfono y código de acceso. El espejo en localStorage no se
  // limpiaba nunca, y coach-automation.js lo pinta en pantalla si la cache RAM
  // todavía no hidrató, antes de corregirse con el dato del servidor.
  'coaches',
  // configuración y marcas de descarga del club
  'schoolSettings', '_lastFullDownload', 'paymentsLoadedFrom',
  // Conteo de jugadores cacheado para el límite de licencia (license-system.js):
  // es del club actual; sin limpiarlo, el club entrante ve el conteo del anterior
  // hasta recalcular.
  '_cachedPlayerCount',
  // licencia y módulos de pago
  'licenseModulos', 'licenseStatus', 'licensePlan', 'licenseEndDate', 'licenseGraceDays',
  // consentimiento y avisos (son POR CLUB)
  'termsAcceptedVersion', 'dismissedNotifications',
];

/**
 * Borra del equipo todo lo que pertenece al club que se está dejando.
 * Nunca lanza: una clave que falle no debe impedir que se limpien las demás.
 */
function limpiarDatosDelClub() {
  CLAVES_DEL_CLUB.forEach(k => {
    try { localStorage.removeItem(k); } catch (e) { /* seguir con las demás */ }
  });
  // Los códigos de padres viven en memoria, no en disco: se vacían aparte.
  //
  // Va en su propio try aunque el `typeof` diga que existe: las funciones
  // declaradas se publican en window apenas se instancia el script, pero las
  // variables que usan por dentro (`let _parentCodesRam`) recién existen cuando
  // la ejecución llega a su línea. Si algo más arriba de este archivo lanzara,
  // el typeof daría true y la llamada explotaría — abortando la limpieza a mitad
  // y dejando datos del club anterior. Verificado probando, no en revisión.
  try {
    if (typeof clearParentCodes === 'function') clearParentCodes();
  } catch (e) {
    console.warn('[club] No se pudo vaciar la memoria de códigos de padres:', e?.message || e);
  }
}


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
      pdfFooterMessage: '',
      autoWhatsAppEnabled: false,
      coachCode: '',
      currency: 'COP',
      primaryColor: '#0d9488'
    }));
  }
  // Un club que recién abre arranca en OSCURO. Es el tema en el que se diseñó la
  // app y con el que se ve mejor; el claro queda como elección explícita.
  // Solo aplica la primera vez: si la persona ya eligió, se respeta lo suyo.
  if (!localStorage.getItem('darkMode')) {
    localStorage.setItem('darkMode', 'true');
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
  // 🚀 FASE 3 — Si la cache RAM está hidratada, leer de ahí (incluye todo el set, sin cap de LS).
  if (window._cache && Array.isArray(window._cache.players)) {
    return window._cache.players;
  }
  // Fallback: localStorage (mientras la cache se hidrata, o si IDB falla)
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
  safeSetItem('players', JSON.stringify(players));

  // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
  if (typeof savePlayerToFirebase === 'function') {
    savePlayerToFirebase(player).catch(err =>
      console.warn('⚠️ No se pudo sincronizar jugador con Firebase:', err)
    );
  }

  // 🆕 ESPEJO A INDEXEDDB
  if (window.idb && window.idb.put) {
    window.idb.put('players', player).catch(err =>
      console.warn('[idb] No se pudo guardar jugador en IndexedDB:', err)
    );
  }
}

function updatePlayer(playerId, playerData) {
  const players = getPlayers();
  const index = players.findIndex(p => p.id === playerId);
  if (index !== -1) {
    players[index] = { ...players[index], ...playerData };
    safeSetItem('players', JSON.stringify(players));

    // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
    if (typeof savePlayerToFirebase === 'function') {
      savePlayerToFirebase(players[index]).catch(err =>
        console.warn('⚠️ No se pudo sincronizar jugador con Firebase:', err)
      );
    }

    // 🆕 ESPEJO A INDEXEDDB
    if (window.idb && window.idb.put) {
      window.idb.put('players', players[index]).catch(err =>
        console.warn('[idb] No se pudo actualizar jugador en IndexedDB:', err)
      );
    }
  }
}

function deletePlayer(playerId) {
  let players = getPlayers();
  players = players.filter(p => p.id !== playerId);
  safeSetItem('players', JSON.stringify(players));
  if (window.idb && window.idb.delete) {
    window.idb.delete('players', playerId).catch(err =>
      console.warn('[idb] No se pudo eliminar jugador en IndexedDB:', err)
    );
  }

  // Eliminar pagos del jugador de localStorage Y de Firebase
  let payments = getPayments();
  const orphanPayments = payments.filter(p => p.playerId === playerId);
  payments = payments.filter(p => p.playerId !== playerId);
  safeSetItem('payments', JSON.stringify(payments));
  if (window.idb && window.idb.syncPaymentsToIDB) {
    window.idb.syncPaymentsToIDB(payments).catch(e => console.warn('[idb] sync (cascade deletePlayer) falló:', e));
  }

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
  // 🚀 FASE 3 — Cache RAM si está hidratada (sin cap de localStorage).
  if (window._cache && Array.isArray(window._cache.payments)) {
    return window._cache.payments;
  }
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
  safeSetItem('payments', JSON.stringify(payments));

  // Registrar en el log de movimientos
  const player = getPlayerById(payment.playerId);
  addPaymentLogEntry({
    action: 'Creado',
    invoiceNumber: payment.invoiceNumber || '-',
    playerName: player ? player.name : 'Desconocido',
    concept: payment.concept || payment.type || '-',
    amount: payment.amount || 0,
    adminName: (typeof getCurrentUser === 'function' && getCurrentUser()?.name) || 'Sistema',
    reason: 'Registro inicial'
  });

  // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
  if (typeof savePaymentToFirebase === 'function') {
    savePaymentToFirebase(payment).catch(err =>
      console.warn('⚠️ No se pudo sincronizar pago con Firebase:', err)
    );
  }

  // 🆕 ESPEJO A INDEXEDDB (piloto)
  if (window.idb && window.idb.put) {
    window.idb.put('payments', payment).catch(err =>
      console.warn('[idb] No se pudo guardar pago en IndexedDB:', err)
    );
  }
}

function updatePayment(paymentId, paymentData) {
  const payments = getPayments();
  const index = payments.findIndex(p => p.id === paymentId);
  if (index !== -1) {
    payments[index] = { ...payments[index], ...paymentData };
    safeSetItem('payments', JSON.stringify(payments));

    // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
    if (typeof savePaymentToFirebase === 'function') {
      savePaymentToFirebase(payments[index]).catch(err =>
        console.warn('⚠️ No se pudo sincronizar pago con Firebase:', err)
      );
    }

    // 🆕 ESPEJO A INDEXEDDB (piloto)
    if (window.idb && window.idb.put) {
      window.idb.put('payments', payments[index]).catch(err =>
        console.warn('[idb] No se pudo actualizar pago en IndexedDB:', err)
      );
    }
  }
}

function deletePayment(paymentId) {
  // Mutar la caché RAM in-place (getPayments devuelve ESA referencia) para que el
  // borrado/anulado se refleje YA en Contabilidad/Dashboard, sin esperar la
  // escritura asíncrona a IndexedDB.
  if (window._cache && Array.isArray(window._cache.payments)) {
    const _i = window._cache.payments.findIndex(p => p.id === paymentId);
    if (_i !== -1) window._cache.payments.splice(_i, 1);
  }
  let payments = getPayments();
  payments = payments.filter(p => p.id !== paymentId);
  safeSetItem('payments', JSON.stringify(payments));

  // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
  if (typeof deletePaymentFromFirebase === 'function') {
    deletePaymentFromFirebase(paymentId).catch(err =>
      console.warn('⚠️ No se pudo eliminar pago de Firebase:', err)
    );
  }

  // 🆕 ESPEJO A INDEXEDDB (piloto)
  if (window.idb && window.idb.delete) {
    window.idb.delete('payments', paymentId).catch(err =>
      console.warn('[idb] No se pudo eliminar pago en IndexedDB:', err)
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
  // 🚀 FASE 3 — Cache RAM si está hidratada.
  if (window._cache && Array.isArray(window._cache.expenses)) {
    return window._cache.expenses;
  }
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
  safeSetItem('expenses', JSON.stringify(expenses));

  // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
  if (typeof saveExpenseToFirebase === 'function') {
    saveExpenseToFirebase(expense).catch(err =>
      console.warn('⚠️ No se pudo sincronizar egreso con Firebase:', err)
    );
  }

  // 🆕 ESPEJO A INDEXEDDB
  if (window.idb && window.idb.put) {
    window.idb.put('expenses', expense).catch(err =>
      console.warn('[idb] No se pudo guardar egreso en IndexedDB:', err)
    );
  }
}

function updateExpense(expenseId, expenseData) {
  const expenses = getExpenses();
  const index = expenses.findIndex(e => e.id === expenseId);
  if (index !== -1) {
    expenses[index] = { ...expenses[index], ...expenseData };
    safeSetItem('expenses', JSON.stringify(expenses));

    // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
    if (typeof saveExpenseToFirebase === 'function') {
      saveExpenseToFirebase(expenses[index]).catch(err =>
        console.warn('⚠️ No se pudo sincronizar egreso con Firebase:', err)
      );
    }

    // 🆕 ESPEJO A INDEXEDDB
    if (window.idb && window.idb.put) {
      window.idb.put('expenses', expenses[index]).catch(err =>
        console.warn('[idb] No se pudo actualizar egreso en IndexedDB:', err)
      );
    }
  }
}

function deleteExpense(expenseId) {
  // Mutar la caché RAM in-place (ver deletePayment) para reflejar el borrado YA.
  if (window._cache && Array.isArray(window._cache.expenses)) {
    const _i = window._cache.expenses.findIndex(e => e.id === expenseId);
    if (_i !== -1) window._cache.expenses.splice(_i, 1);
  }
  let expenses = getExpenses();
  expenses = expenses.filter(e => e.id !== expenseId);
  safeSetItem('expenses', JSON.stringify(expenses));

  // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
  if (typeof deleteExpenseFromFirebase === 'function') {
    deleteExpenseFromFirebase(expenseId).catch(err =>
      console.warn('⚠️ No se pudo eliminar egreso de Firebase:', err)
    );
  }

  // 🆕 ESPEJO A INDEXEDDB
  if (window.idb && window.idb.delete) {
    window.idb.delete('expenses', expenseId).catch(err =>
      console.warn('[idb] No se pudo eliminar egreso en IndexedDB:', err)
    );
  }
}

// ========================================
// 🆕 INGRESOS DE TERCEROS (OTROS INGRESOS)
// CON SINCRONIZACIÓN AUTOMÁTICA
// ========================================

function getThirdPartyIncomes() {
  // 🚀 FASE 3 — Cache RAM si está hidratada.
  if (window._cache && Array.isArray(window._cache.thirdPartyIncomes)) {
    return window._cache.thirdPartyIncomes;
  }
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
  safeSetItem('thirdPartyIncomes', JSON.stringify(incomes));

  // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
  if (typeof saveThirdPartyIncomeToFirebase === 'function') {
    saveThirdPartyIncomeToFirebase(income).catch(err =>
      console.warn('⚠️ No se pudo sincronizar ingreso con Firebase:', err)
    );
  }

  // 🆕 ESPEJO A INDEXEDDB
  if (window.idb && window.idb.put) {
    window.idb.put('thirdPartyIncomes', income).catch(err =>
      console.warn('[idb] No se pudo guardar ingreso en IndexedDB:', err)
    );
  }
}

function updateThirdPartyIncome(incomeId, incomeData) {
  const incomes = getThirdPartyIncomes();
  const index = incomes.findIndex(i => i.id === incomeId);
  if (index !== -1) {
    incomes[index] = { ...incomes[index], ...incomeData };
    safeSetItem('thirdPartyIncomes', JSON.stringify(incomes));

    // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
    if (typeof saveThirdPartyIncomeToFirebase === 'function') {
      saveThirdPartyIncomeToFirebase(incomes[index]).catch(err =>
        console.warn('⚠️ No se pudo sincronizar ingreso con Firebase:', err)
      );
    }

    // 🆕 ESPEJO A INDEXEDDB
    if (window.idb && window.idb.put) {
      window.idb.put('thirdPartyIncomes', incomes[index]).catch(err =>
        console.warn('[idb] No se pudo actualizar ingreso en IndexedDB:', err)
      );
    }
  }
}

function deleteThirdPartyIncome(incomeId) {
  // Mutar la caché RAM in-place (ver deletePayment) para reflejar el borrado YA.
  if (window._cache && Array.isArray(window._cache.thirdPartyIncomes)) {
    const _i = window._cache.thirdPartyIncomes.findIndex(i => i.id === incomeId);
    if (_i !== -1) window._cache.thirdPartyIncomes.splice(_i, 1);
  }
  let incomes = getThirdPartyIncomes();
  incomes = incomes.filter(i => i.id !== incomeId);
  safeSetItem('thirdPartyIncomes', JSON.stringify(incomes));

  // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
  if (typeof deleteThirdPartyIncomeFromFirebase === 'function') {
    deleteThirdPartyIncomeFromFirebase(incomeId).catch(err =>
      console.warn('⚠️ No se pudo eliminar ingreso de Firebase:', err)
    );
  }

  // 🆕 ESPEJO A INDEXEDDB
  if (window.idb && window.idb.delete) {
    window.idb.delete('thirdPartyIncomes', incomeId).catch(err =>
      console.warn('[idb] No se pudo eliminar ingreso en IndexedDB:', err)
    );
  }
}

// ========================================
// EVENTOS DEL CALENDARIO
// ========================================

function getCalendarEvents() {
  // 🚀 FASE 3 — Cache RAM (store 'events') si está hidratada.
  if (window._cache && Array.isArray(window._cache.events)) {
    return window._cache.events;
  }
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
  safeSetItem('calendarEvents', JSON.stringify(events));

  // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
  if (typeof saveEventToFirebase === 'function') {
    saveEventToFirebase(event).catch(err =>
      console.warn('⚠️ No se pudo sincronizar evento con Firebase:', err)
    );
  }

  // 🆕 ESPEJO A INDEXEDDB (store: events)
  if (window.idb && window.idb.put) {
    window.idb.put('events', event).catch(err =>
      console.warn('[idb] No se pudo guardar evento en IndexedDB:', err)
    );
  }
}

function updateEvent(eventId, eventData) {
  const events = getCalendarEvents();
  const index = events.findIndex(e => e.id === eventId);
  if (index !== -1) {
    events[index] = { ...events[index], ...eventData };
    safeSetItem('calendarEvents', JSON.stringify(events));

    // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
    if (typeof saveEventToFirebase === 'function') {
      saveEventToFirebase(events[index]).catch(err =>
        console.warn('⚠️ No se pudo sincronizar evento con Firebase:', err)
      );
    }

    // 🆕 ESPEJO A INDEXEDDB (store: events)
    if (window.idb && window.idb.put) {
      window.idb.put('events', events[index]).catch(err =>
        console.warn('[idb] No se pudo actualizar evento en IndexedDB:', err)
      );
    }
  }
}

function deleteEvent(eventId) {
  let events = getCalendarEvents();
  events = events.filter(e => e.id !== eventId);
  safeSetItem('calendarEvents', JSON.stringify(events));

  // ⭐ SINCRONIZACIÓN AUTOMÁTICA (Supabase)
  if (typeof deleteEventFromFirebase === 'function') {
    deleteEventFromFirebase(eventId).catch(err =>
      console.warn('⚠️ No se pudo eliminar evento de Firebase:', err)
    );
  }

  // 🆕 ESPEJO A INDEXEDDB (store: events)
  if (window.idb && window.idb.delete) {
    window.idb.delete('events', eventId).catch(err =>
      console.warn('[idb] No se pudo eliminar evento en IndexedDB:', err)
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
  
  // ⭐ SINCRONIZACIÓN AUTOMÁTICA — delega a firebase-sync.js para consistencia
  if (typeof saveSchoolSettingsToFirebase === 'function') {
    saveSchoolSettingsToFirebase(updated).catch(err =>
      console.warn('⚠️ No se pudo sincronizar configuración:', err)
    );
  }
}

const LOCAL_FIRST_SYNC_TTL_MS = 15 * 60 * 1000;
const LOCAL_FIRST_SYNC_KEY_PREFIX = 'localFirstSync_';

function getLocalFirstSyncState(clubId) {
  if (!clubId) return {};

  try {
    return JSON.parse(localStorage.getItem(`${LOCAL_FIRST_SYNC_KEY_PREFIX}${clubId}`) || '{}');
  } catch (error) {
    console.warn('⚠️ localFirstSync corrupto en localStorage, limpiando...');
    localStorage.removeItem(`${LOCAL_FIRST_SYNC_KEY_PREFIX}${clubId}`);
    return {};
  }
}

function setLocalFirstSyncState(clubId, state) {
  if (!clubId) return;

  const current = getLocalFirstSyncState(clubId);
  const updated = { ...current, ...(state || {}) };
  localStorage.setItem(`${LOCAL_FIRST_SYNC_KEY_PREFIX}${clubId}`, JSON.stringify(updated));
}

function getLocalSnapshotSize(scope) {
  try {
    switch (scope) {
      case 'settings': {
        const settings = localStorage.getItem('schoolSettings');
        return settings ? 1 : 0;
      }
      case 'players':
        return getAllPlayers().length;
      case 'payments':
        return getPayments().length;
      case 'events':
        return getCalendarEvents().length;
      case 'expenses':
        return getExpenses().length;
      case 'users':
        return getUsers().length;
      case 'thirdPartyIncomes':
        return getThirdPartyIncomes().length;
      case 'parentCodes':
        return getParentCodes().length;
      case 'config':
        return Object.keys(localStorage).some(key => key.startsWith('config_')) ? 1 : 0;
      case 'paymentMovementLog':
        return getPaymentLog().length;
      default:
        return 0;
    }
  } catch (error) {
    return 0;
  }
}

function shouldReuseLocalSnapshot(clubId, scope, { ttlMs = LOCAL_FIRST_SYNC_TTL_MS, force = false } = {}) {
  if (!clubId || force) return false;

  const state = getLocalFirstSyncState(clubId);
  const lastSync = Number(state?.[scope] || 0);
  if (!lastSync) return false;

  const hasLocalData = getLocalSnapshotSize(scope) > 0;
  if (!hasLocalData) return false;

  return (Date.now() - lastSync) < ttlMs;
}

function markLocalSnapshotSynced(clubId, scope, meta = {}) {
  if (!clubId || !scope) return;

  const current = getLocalFirstSyncState(clubId);
  setLocalFirstSyncState(clubId, {
    ...current,
    [scope]: Date.now(),
    lastScope: scope,
    lastSource: meta.source || 'firebase',
    lastUpdated: new Date().toISOString()
  });
}

function clearLocalFirstSyncState(clubId) {
  if (!clubId) return;
  localStorage.removeItem(`${LOCAL_FIRST_SYNC_KEY_PREFIX}${clubId}`);
}

window.getLocalFirstSyncState = getLocalFirstSyncState;
window.setLocalFirstSyncState = setLocalFirstSyncState;
window.shouldReuseLocalSnapshot = shouldReuseLocalSnapshot;
window.markLocalSnapshotSynced = markLocalSnapshotSynced;
window.clearLocalFirstSyncState = clearLocalFirstSyncState;

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
  // En Supabase, la asistencia es gestionada por la app separada (no disponible aquí)
  if (!clubId || window.MODO_SUPABASE) return [];
  return [];
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
async function clearAllData() {
  if (await confirmAction('⚠️ ¿Estás seguro de eliminar TODOS los datos? Esta acción no se puede deshacer.', {
    type: 'danger',
    title: 'Eliminar todos los datos',
    confirmText: 'Sí, eliminar todo'
  })) {
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
  safeSetItem('players', JSON.stringify(players));
  if (window.idb && window.idb.syncStore) {
    window.idb.syncStore('players', players).catch(e => console.warn('[idb] sync players (saveAllPlayers) falló:', e));
  }
}

function saveSchoolSettings(settings) {
  updateSchoolSettings(settings);
}

// ========================================
// 🆕 IMPORTAR DESDE JSON - INCLUYE OTROS INGRESOS
// ========================================
function importDataFromJSON(file) {
  const reader = new FileReader();
  
  reader.onload = async function(e) {
    try {
      const jsonData = e.target.result;
      const data = JSON.parse(jsonData);
      
      if (!data.users && !data.players && !data.payments) {
        showToast('❌ Archivo JSON inválido');
        return;
      }
      
      const confirmed = await showAppConfirm('⚠️ ADVERTENCIA: Esto reemplazará TODOS los datos actuales.\n\n¿Estás seguro de continuar?', {
        type: 'danger',
        title: 'Importar datos desde JSON',
        confirmText: 'Sí, reemplazar datos'
      });
      if (!confirmed) {
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

// ════════════════════════════════════════════════════════════════════════════
// CÓDIGOS DE ACCESO DE PADRES — SOLO EN MEMORIA, NUNCA EN EL DISPOSITIVO
// ════════════════════════════════════════════════════════════════════════════
// Cada código, junto al id del jugador, DA ACCESO AL PERFIL DEL NIÑO: es
// exactamente lo que el SMS le advierte al padre que no comparta. Guardar el
// padrón completo del club en localStorage dejaba cientos de credenciales en
// texto plano en cualquier equipo donde alguien hubiera entrado alguna vez
// (en el club más grande son ~474; en total había 1.626 activos).
//
// Por eso viven solo en memoria: se piden a Supabase cuando hacen falta y
// desaparecen al cerrar la pestaña.
//
// Cifrarlos en el navegador NO sería una solución: la llave tendría que estar
// en el mismo JavaScript que los descifra, así que quien puede leer los datos
// puede leer la llave. Lo que protege de verdad es no guardarlos.
//
// Como beneficio adicional, deja de bajarse esa lista en cada inicio de sesión.
let _parentCodesRam = [];        // lo que hay en memoria ahora
let _parentCodesCargados = false; // ¿ya se trajo la lista completa del club?
let _parentCodesPromesa = null;   // pedido en curso: evita descargas duplicadas
// La bandera va aparte del array a propósito: si alguien genera o borra un código
// ANTES de que la lista se haya traído, la memoria se modifica pero NO queda
// marcada como completa, así que la próxima ensureParentCodes() igual la trae.
// Sin esa separación, un solo código creado temprano haría creer que ese es todo
// el padrón del club y la pantalla de envíos mostraría uno solo.

// Limpieza para equipos que ya tenían la lista guardada de la versión anterior.
try { localStorage.removeItem('parentCodes'); } catch (e) {}

/**
 * Carga los códigos del club en memoria si todavía no están.
 * Hay que llamarla (con await) antes de cualquier pantalla que los muestre.
 * Nunca lanza: ante un fallo deja la memoria vacía y devuelve la lista actual,
 * para que la UI no se caiga.
 *
 * @param {{force?: boolean}} opciones  force: vuelve a pedirlos aunque ya estén.
 */
async function ensureParentCodes({ force = false } = {}) {
  if (_parentCodesCargados && !force) return _parentCodesRam;
  if (_parentCodesPromesa) return _parentCodesPromesa;

  const clubId = localStorage.getItem('clubId');
  if (!clubId || !window.MODO_SUPABASE || !window.SUPA_URL) return _parentCodesRam;

  // ⛔ GUARD: sin JWT no se consulta.
  //    Con el rol anónimo cerrado, RLS no devuelve error: devuelve 200 con lista
  //    VACÍA. Si marcáramos "cargado" con esa lista, la pantalla de envíos creería
  //    que el club no tiene ningún código y al generar nuevos INVALIDARÍA el
  //    código que ya tienen todos los padres. Preferimos no cargar y reintentar.
  const _jwt = (window.SupaAuthV2 && typeof window.SupaAuthV2.getToken === 'function' && window.SupaAuthV2.getToken())
            || (window.SupaAuth   && typeof window.SupaAuth.getToken   === 'function' && window.SupaAuth.getToken());
  if (!_jwt) {
    console.warn('[códigos padres] Sin sesión — no se consultan (evita creer que el club no tiene ninguno).');
    return _parentCodesRam;
  }

  _parentCodesPromesa = (async () => {
    try {
      const res = await fetch(
        `${window.SUPA_URL}/rest/v1/parent_codes` +
        `?club_id=eq.${encodeURIComponent(clubId)}&active=eq.true&select=*`,
        { headers: { apikey: window.SUPA_ANON, Authorization: `Bearer ${window.SUPA_ANON}` } }
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const filas = await res.json();
      if (!Array.isArray(filas)) throw new Error('respuesta inesperada');

      // ⛔ SEGUNDA VERIFICACIÓN, después de la respuesta.
      //    El guard de arriba mira la sesión ANTES de salir, pero la petición
      //    lleva la clave anónima y depende de que el interceptor le ponga el
      //    JWT al vuelo. Si la sesión muere justo durante la llamada (el refresh
      //    falla porque otra pestaña ya usó el refresh_token), el interceptor no
      //    toca los headers, la consulta sale como anónima y RLS responde
      //    200 con lista VACÍA en lugar de un error.
      //    Marcar "cargado" con esa lista vacía haría que un envío masivo le
      //    regenerara el código a TODO el club. Una lista vacía solo se acepta
      //    si la sesión sigue viva; si no, se trata como fallo y se reintenta.
      if (filas.length === 0) {
        const _sigueVivo = (window.SupaAuthV2 && typeof window.SupaAuthV2.getToken === 'function' && window.SupaAuthV2.getToken())
                        || (window.SupaAuth   && typeof window.SupaAuth.getToken   === 'function' && window.SupaAuth.getToken());
        if (!_sigueVivo) throw new Error('la sesión se perdió durante la consulta');
      }

      _parentCodesRam = filas.map(pc => ({
        playerId:   pc.player_id,
        code:       pc.code,
        createdAt:  pc.created_at,
        lastAccess: pc.last_access || null,
        sentAt:     pc.sent_at || null,
      }));
      _parentCodesCargados = true;
    } catch (e) {
      // No se marca como cargada: se reintenta la próxima vez que haga falta.
      console.warn('[códigos padres] No se pudieron cargar:', e?.message || e);
    } finally {
      _parentCodesPromesa = null;
    }
    return _parentCodesRam;
  })();

  return _parentCodesPromesa;
}

/**
 * ¿La lista completa del club está efectivamente en memoria?
 *
 * Es OBLIGATORIO consultarlo antes de cualquier pantalla o acción que trate la
 * ausencia de un código como "este jugador no tiene". Si la carga falló (sin red,
 * sin sesión), la memoria queda vacía y esa ausencia es MENTIRA: los envíos
 * masivos generan un código nuevo cuando no encuentran uno, así que actuar sobre
 * una lista vacía le invalidaría a TODOS los padres el código que ya tienen.
 */
function parentCodesListos() {
  return _parentCodesCargados;
}

/** Vacía la memoria. Se llama al cerrar sesión y al cambiar de club. */
function clearParentCodes() {
  _parentCodesRam = [];
  _parentCodesCargados = false;
  _parentCodesPromesa = null;
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

  _parentCodesRam = parentCodes;

  // Sincronizar con Firebase si está disponible
  syncParentCodeToFirebase(playerId, code);

  return code;
}

/**
 * Códigos que hay en memoria AHORA. Es sincrónica porque la llaman bucles de
 * render; si todavía no se cargaron devuelve [] — usá ensureParentCodes() antes.
 */
function getParentCodes() {
  return Array.isArray(_parentCodesRam) ? _parentCodesRam : [];
}

// Obtener código de un jugador específico
function getParentCodeByPlayer(playerId) {
  const codes = getParentCodes();
  return codes.find(pc => pc.playerId === playerId);
}

/**
 * Marca en memoria que a un jugador ya se le envió su código, para que la
 * pantalla de envíos lo muestre al instante. La persistencia real va a
 * Supabase (parent_codes.sent_at), que es la fuente compartida entre equipos.
 * Si el código todavía no estaba en memoria, lo agrega.
 *
 * @param {string} playerId
 * @param {string} code
 * @param {string} [sentAt]  ISO; por defecto, ahora.
 */
function marcarCodigoPadreEnviado(playerId, code, sentAt = new Date().toISOString()) {
  if (!playerId) return;
  const codes = getParentCodes();
  const i = codes.findIndex(pc => pc.playerId === playerId);
  if (i !== -1) {
    codes[i].sentAt = sentAt;
    if (code) codes[i].code = code;
  } else {
    codes.push({ playerId, code, sentAt });
  }
  _parentCodesRam = codes;
}

/** Borra la marca de "enviado" de todos los códigos en memoria. */
function limpiarEnviosCodigosPadre() {
  getParentCodes().forEach(pc => { delete pc.sentAt; });
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
  }
}

// Eliminar código de acceso
function deleteParentCode(playerId) {
  _parentCodesRam = getParentCodes().filter(pc => pc.playerId !== playerId);

  // Intentar revocar también en Firebase para cortar acceso real en portal
  revokeParentCodeFromFirebase(playerId);
}

// Eliminar código de acceso en Firebase
async function revokeParentCodeFromFirebase(playerId) {
  const clubId = localStorage.getItem('clubId');
  if (!clubId || !playerId) return;

  if (window.MODO_SUPABASE) {
    try {
      // En Supabase: PATCH active=false (el Edge Function valida active=true)
      await fetch(
        `${window.SUPA_URL}/rest/v1/parent_codes?player_id=eq.${encodeURIComponent(playerId)}&club_id=eq.${encodeURIComponent(clubId)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: window.SUPA_ANON,
            Authorization: `Bearer ${window.SUPA_ANON}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ active: false }),
        }
      );
      console.log('✅ Código de padre revocado en Supabase');
    } catch (error) {
      console.warn('⚠️ No se pudo revocar código de padre en Supabase:', error);
    }
    return;
  }

  // Firebase removed — only Supabase path active
}

// Sincronizar código de padre con Firebase o Supabase
async function syncParentCodeToFirebase(playerId, code) {
  const clubId = localStorage.getItem('clubId');
  if (!clubId || !playerId || !code) return;

  if (window.MODO_SUPABASE) {
    try {
      await fetch(`${window.SUPA_URL}/rest/v1/parent_codes`, {
        method: 'POST',
        headers: {
          apikey: window.SUPA_ANON,
          Authorization: `Bearer ${window.SUPA_ANON}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          id: playerId, club_id: clubId, player_id: playerId,
          code: code, active: true,
          created_at: new Date().toISOString(),
        }),
      });
      console.log('✅ Código de padre sincronizado con Supabase');
    } catch (error) {
      console.warn('⚠️ No se pudo sincronizar código de padre con Supabase:', error);
    }
    return;
  }

  // Firebase removed — only Supabase path active
}

// Exportar funciones globalmente
window.generateParentAccessCode = generateParentAccessCode;
window.saveParentCode = saveParentCode;
window.getParentCodes = getParentCodes;
window.getParentCodeByPlayer = getParentCodeByPlayer;
window.validateParentCode = validateParentCode;
window.deleteParentCode = deleteParentCode;
window.limpiarDatosDelClub = limpiarDatosDelClub;
window.CLAVES_DEL_CLUB = CLAVES_DEL_CLUB;
window.ensureParentCodes = ensureParentCodes;
window.parentCodesListos = parentCodesListos;
window.clearParentCodes = clearParentCodes;
window.marcarCodigoPadreEnviado = marcarCodigoPadreEnviado;
window.limpiarEnviosCodigosPadre = limpiarEnviosCodigosPadre;

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
  const parsedTs = entry.timestamp ? new Date(entry.timestamp) : null;
  const newEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    timestamp: (parsedTs && !isNaN(parsedTs)) ? parsedTs.toISOString() : new Date().toISOString(),
    action: entry.action || 'Acción',
    invoiceNumber: entry.invoiceNumber || '-',
    playerName: entry.playerName || 'Desconocido',
    concept: entry.concept || '-',
    amount: entry.amount || 0,
    adminName: entry.adminName || 'Sistema',
    reason: entry.reason || ''
  };
  log.unshift(newEntry);
  // Máximo 500 entradas para no saturar el localStorage
  if (log.length > 500) log.splice(500);
  try {
    localStorage.setItem('paymentMovementLog', JSON.stringify(log));
  } catch (_) {
    try { localStorage.setItem('paymentMovementLog', JSON.stringify(log.slice(0, 100))); } catch (_) {}
  }
  // Sincronizar a la nube vía la función centralizada (que el sync-queue
  // envuelve para encolar reintentos si falla por red). NO hacer fetch directo
  // acá porque bypasaría la cola de reintentos.
  if (typeof window.savePaymentLogEntryToFirebase === 'function') {
    window.savePaymentLogEntryToFirebase(newEntry).catch(err =>
      console.warn('⚠️ No se pudo sincronizar movimiento:', err?.message || err)
    );
  }
}

window.getPaymentLog = getPaymentLog;
window.addPaymentLogEntry = addPaymentLogEntry;

/**
 * 🛠️ MIGRACIÓN: Recuperar facturas antiguas que no están en el Log de Movimientos
 * Se ejecuta una sola vez para poblar el historial con datos previos a la actualización.
 */
function fixMissingPaymentLogEntries(options = {}) {
  try {
    const force = options.force === true;
    const providedPayments = Array.isArray(options.payments) ? options.payments : null;
    const log = getPaymentLog();
    const payments = providedPayments || getPayments();
    
    // Si ya hay muchos registros o ya se hizo, no procesar (optimización)
    if (!force && localStorage.getItem('paymentLogBackfill_v1') === 'true') return;

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
      try {
        localStorage.setItem('paymentMovementLog', JSON.stringify(finalLog.slice(0, 500)));
      } catch (_) {
        try { localStorage.setItem('paymentMovementLog', JSON.stringify(finalLog.slice(0, 100))); } catch (_) {}
      }
    }

    localStorage.setItem('paymentLogBackfill_v1', 'true');
  } catch (error) {
    console.warn('⚠️ Error en migración de historial:', error);
  }
}

window.fixMissingPaymentLogEntries = fixMissingPaymentLogEntries;

// Ejecutar migración al cargar el script
setTimeout(fixMissingPaymentLogEntries, 2000);