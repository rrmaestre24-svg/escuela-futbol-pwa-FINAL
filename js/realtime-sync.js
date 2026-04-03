// ========================================
// 🔄 SINCRONIZACIÓN EN TIEMPO REAL - FIREBASE
// CON DESCARGA INICIAL COMPLETA
// ========================================

// Almacenar referencias a los listeners para poder desconectarlos
window.realtimeListeners = {
  players: null,
  payments: null,
  events: null,
  expenses: null,
  settings: null
};

// Estado de sincronización
window.realtimeSyncState = {
  isActive: false,
  clubId: null,
  lastSync: null,
  initialLoadComplete: false
};

// ========================================
// 🎯 INICIAR SINCRONIZACIÓN EN TIEMPO REAL
// ========================================
async function startRealtimeSync(clubId) {
  if (!clubId) {
    console.error('❌ clubId es requerido para sincronización en tiempo real');
    return false;
  }
  
  if (!window.firebase?.db || !window.firebase?.onSnapshot) {
    console.error('❌ Firebase no está inicializado o falta onSnapshot');
    return false;
  }
  
  // Si ya está activo con el mismo club, no hacer nada
  if (window.realtimeSyncState.isActive && window.realtimeSyncState.clubId === clubId) {
    console.log('ℹ️ Sincronización ya activa para este club');
    return true;
  }
  
  // Detener listeners anteriores si existen
  stopRealtimeSync();
  
  console.log('🔄 ========================================');
  console.log('🔄 INICIANDO SINCRONIZACIÓN EN TIEMPO REAL');
  console.log('🔄 ========================================');
  console.log('📍 Club ID:', clubId);
  
  try {
    // 🎯 PASO 1: DESCARGA INICIAL COMPLETA
    await downloadAllDataInitially(clubId);
    
    // 🎯 PASO 2: ACTIVAR LISTENERS
    // 1️⃣ Listener de Jugadores
    startPlayersListener(clubId);
    
    // 2️⃣ Listener de Pagos
    startPaymentsListener(clubId);
    
    // 3️⃣ Listener de Eventos
    startEventsListener(clubId);
    
    // 4️⃣ Listener de Egresos
    startExpensesListener(clubId);
    
    // 5️⃣ Listener de Configuración
    startSettingsListener(clubId);
    
    // Actualizar estado
    window.realtimeSyncState.isActive = true;
    window.realtimeSyncState.clubId = clubId;
    window.realtimeSyncState.lastSync = new Date().toISOString();
    
    // Mostrar indicador de sincronización activa
    showSyncIndicator(true);
    
    console.log('✅ Sincronización en tiempo real activada');
    console.log('========================================');
    showToast('🔄 Sincronización en tiempo real activa');
    return true;
    
  } catch (error) {
    console.error('❌ Error al iniciar sincronización:', error);
    return false;
  }
}

// ========================================
// 📥 DESCARGA INICIAL COMPLETA
// ========================================

async function downloadAllDataInitially(clubId) {
  console.log('📥 ========================================');
  console.log('📥 DESCARGA INICIAL DE TODOS LOS DATOS');
  console.log('📥 ========================================');
  
  let stats = {
    settings: false,
    players: 0,
    payments: 0,
    events: 0,
    expenses: 0,
    users: 0,
    thirdPartyIncomes: 0,
    parentCodes: 0,
    config: 0
  };
  
// 1️⃣ CONFIGURACIÓN
  try {
    console.log('📥 1/9 - Configuración del club...');
    const settingsDoc = await window.firebase.getDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, 'main')
    );
    if (settingsDoc.exists()) {
      const settingsData = settingsDoc.data();
      if (typeof updateSchoolSettings === 'function') {
        updateSchoolSettings(settingsData);
      } else {
        localStorage.setItem('schoolSettings', JSON.stringify(settingsData));
      }
      stats.settings = true;
      console.log('✅ Configuración descargada');
    }
  } catch (error) {
    console.error('⚠️ Error configuración:', error);
  }

  // 1️⃣B - LOGO DEL CLUB (documento separado)
  try {
    const logoDoc = await window.firebase.getDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/assets`, 'logo')
    );
    if (logoDoc.exists()) {
      const logoData = logoDoc.data();
      if (logoData.logo) {
        const currentSettings = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
        currentSettings.logo = logoData.logo;
        localStorage.setItem('schoolSettings', JSON.stringify(currentSettings));
        console.log('✅ Logo cargado desde documento separado');
      }
    }
  } catch (error) {
    console.error('⚠️ Error cargando logo:', error);
  }
  
  // 2️⃣ JUGADORES - CON FALLBACK SEGURO Y NORMALIZACIÓN DE STATUS
  try {
    console.log('📥 2/9 - Jugadores...');

    // ✅ PASO 1: Siempre intentar la fuente principal primero
    const normalizeStatus = (status) => {
      if (!status) return 'Activo'; // Sin status = Activo (compatibilidad datos viejos)
      const s = status.toLowerCase().trim();
      if (s === 'activo' || s === 'active') return 'Activo';
      if (s === 'inactivo' || s === 'inactive') return 'Inactivo';
      return status;
    };

    let finalPlayers = [];
    let usedSource = clubId;

    const primarySnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/players`)
    );
    primarySnapshot.forEach(doc => finalPlayers.push({ id: doc.id, ...doc.data() }));
    console.log(`   📊 Fuente principal (${clubId}): ${finalPlayers.length} jugadores`);

    // ✅ PASO 2: Solo si la fuente principal devuelve 0 jugadores, buscar en fuentes alternativas
    // Esto evita mezclar o sobreescribir datos de escuelas diferentes
    if (finalPlayers.length === 0) {
      console.log('⚠️ Fuente principal vacía — buscando en fuentes alternativas...');

      const fallbackIds = [];
      try {
        const currentUser = typeof getCurrentUser === 'function'
          ? getCurrentUser()
          : JSON.parse(localStorage.getItem('currentUser') || 'null');
        const settings = JSON.parse(localStorage.getItem('schoolSettings') || '{}');

        // Solo usar IDs explícitos guardados — nunca derivar el ID del nombre del club
        // (derivar del nombre puede cargar jugadores del club equivocado)
        if (currentUser?.schoolId && currentUser.schoolId !== clubId)
          fallbackIds.push(currentUser.schoolId);
        if (settings?.clubId && settings.clubId !== clubId && !fallbackIds.includes(settings.clubId))
          fallbackIds.push(settings.clubId);
      } catch (e) {
        console.warn('⚠️ Error construyendo fuentes alternativas:', e);
      }

      for (const fallbackId of fallbackIds) {
        try {
          const snap = await window.firebase.getDocs(
            window.firebase.collection(window.firebase.db, `clubs/${fallbackId}/players`)
          );
          const players = [];
          snap.forEach(doc => players.push({ id: doc.id, ...doc.data() }));
          console.log(`   📊 Alternativa (${fallbackId}): ${players.length} jugadores`);

          if (players.length > 0) {
            finalPlayers = players;
            usedSource = fallbackId;
            console.log(`✅ Usando fuente alternativa: ${fallbackId}`);
            break; // ✅ Usar la primera alternativa que tenga datos, sin mezclar
          }
        } catch (e) {
          console.warn(`   ⚠️ Error leyendo ${fallbackId}:`, e.message);
        }
      }
    }

    // ✅ PASO 3: Normalizar status antes de guardar
    finalPlayers = finalPlayers.map(p => ({
      ...p,
      status: normalizeStatus(p.status)
    }));

    if (typeof saveAllPlayers === 'function') {
      saveAllPlayers(finalPlayers);
    } else {
      localStorage.setItem('players', JSON.stringify(finalPlayers));
    }

    stats.players = finalPlayers.length;
    console.log(`✅ ${finalPlayers.length} jugadores cargados desde: ${usedSource}`);
  } catch (error) {
    console.error('⚠️ Error jugadores:', error);
  }
  
  // 3️⃣ PAGOS
  try {
    console.log('📥 3/9 - Pagos...');
    const paymentsSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`)
    );
    
    const payments = [];
    paymentsSnapshot.forEach(doc => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    
    localStorage.setItem('payments', JSON.stringify(payments));
    stats.payments = payments.length;
    console.log(`✅ ${payments.length} pagos`);
  } catch (error) {
    console.error('⚠️ Error pagos:', error);
  }
  
  // 4️⃣ EVENTOS
  try {
    console.log('📥 4/9 - Eventos...');
    const eventsSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/events`)
    );
    
    const events = [];
    eventsSnapshot.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() });
    });
    
    localStorage.setItem('calendarEvents', JSON.stringify(events));
    stats.events = events.length;
    console.log(`✅ ${events.length} eventos`);
  } catch (error) {
    console.error('⚠️ Error eventos:', error);
  }
  
  // 5️⃣ EGRESOS
  try {
    console.log('📥 5/9 - Egresos...');
    const expensesSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/expenses`)
    );
    
    const expenses = [];
    expensesSnapshot.forEach(doc => {
      expenses.push({ id: doc.id, ...doc.data() });
    });
    
    localStorage.setItem('expenses', JSON.stringify(expenses));
    stats.expenses = expenses.length;
    console.log(`✅ ${expenses.length} egresos`);
  } catch (error) {
    console.error('⚠️ Error egresos:', error);
  }
  
  // 6️⃣ USUARIOS
  try {
    console.log('📥 6/9 - Usuarios...');
    const usersSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/users`)
    );
    
    const users = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (!userData.deleted) {
        users.push({ id: doc.id, ...userData, schoolId: clubId });
      }
    });
    
    localStorage.setItem('users', JSON.stringify(users));
    stats.users = users.length;
    console.log(`✅ ${users.length} usuarios`);
  } catch (error) {
    console.error('⚠️ Error usuarios:', error);
  }
  
  // 7️⃣ INGRESOS DE TERCEROS
  try {
    console.log('📥 7/9 - Ingresos de terceros...');
    const incomesSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/thirdPartyIncomes`)
    );
    
    const incomes = [];
    incomesSnapshot.forEach(doc => {
      incomes.push({ id: doc.id, ...doc.data() });
    });
    
    localStorage.setItem('thirdPartyIncomes', JSON.stringify(incomes));
    stats.thirdPartyIncomes = incomes.length;
    console.log(`✅ ${incomes.length} ingresos externos`);
  } catch (error) {
    console.error('⚠️ Error ingresos:', error);
  }
  
  // 8️⃣ CÓDIGOS DE PADRES
  try {
    console.log('📥 8/9 - Códigos de padres...');
    const codesSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/parentCodes`)
    );
    
    const codes = [];
    codesSnapshot.forEach(doc => {
      codes.push({ id: doc.id, ...doc.data() });
    });
    
    localStorage.setItem('parentCodes', JSON.stringify(codes));
    stats.parentCodes = codes.length;
    console.log(`✅ ${codes.length} códigos`);
  } catch (error) {
    console.error('⚠️ Error códigos:', error);
  }
  
  // 9️⃣ CONFIGURACIONES ADICIONALES
  try {
    console.log('📥 9/9 - Config adicional...');
    const configSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/config`)
    );
    
    configSnapshot.forEach(doc => {
      localStorage.setItem(`config_${doc.id}`, JSON.stringify(doc.data()));
      stats.config++;
    });
    
    console.log(`✅ ${stats.config} configuraciones`);
  } catch (error) {
    console.error('⚠️ Error config:', error);
  }
  
  // 🔄 ACTUALIZAR VISTAS
  console.log('🔄 Actualizando todas las vistas...');
  if (typeof updateDashboard === 'function') updateDashboard();
  if (typeof renderPlayersList === 'function') renderPlayersList();
  if (typeof renderCalendar === 'function') renderCalendar();
  if (typeof renderAccounting === 'function') renderAccounting();
  if (typeof renderSchoolUsers === 'function') renderSchoolUsers();
  
  console.log('📥 ========================================');
  console.log('📥 DESCARGA INICIAL COMPLETADA');
  console.log('📥 ========================================');
  console.log('📊 RESUMEN:');
  console.log(`   ✅ Configuración: ${stats.settings ? 'Sí' : 'No'}`);
  console.log(`   ✅ Jugadores: ${stats.players}`);
  console.log(`   ✅ Pagos: ${stats.payments}`);
  console.log(`   ✅ Eventos: ${stats.events}`);
  console.log(`   ✅ Egresos: ${stats.expenses}`);
  console.log(`   ✅ Usuarios: ${stats.users}`);
  console.log(`   ✅ Ingresos externos: ${stats.thirdPartyIncomes}`);
  console.log(`   ✅ Códigos padres: ${stats.parentCodes}`);
  console.log(`   ✅ Config adicional: ${stats.config}`);
  console.log('========================================');
  
  const total = stats.players + stats.payments + stats.events + stats.expenses;
  showToast(`✅ Datos sincronizados: ${total} registros descargados`);
}

// ========================================
// 🛑 DETENER SINCRONIZACIÓN EN TIEMPO REAL
// ========================================
function stopRealtimeSync() {
  console.log('🛑 Deteniendo sincronización en tiempo real...');
  
  // Desconectar todos los listeners
  Object.keys(window.realtimeListeners).forEach(key => {
    if (window.realtimeListeners[key]) {
      try {
        window.realtimeListeners[key]();
      } catch (e) {
        console.warn('Error al desconectar listener:', key, e);
      }
      window.realtimeListeners[key] = null;
    }
  });
  
  // Actualizar estado
  window.realtimeSyncState.isActive = false;
  window.realtimeSyncState.clubId = null;
  window.realtimeSyncState.initialLoadComplete = false;
  
  // Ocultar indicador
  showSyncIndicator(false);
  
  console.log('✅ Sincronización detenida');
}

// ========================================
// 👥 LISTENER DE JUGADORES
// ========================================
function startPlayersListener(clubId) {
  const playersRef = window.firebase.collection(
    window.firebase.db,
    `clubs/${clubId}/players`
  );
  
  window.realtimeListeners.players = window.firebase.onSnapshot(
    playersRef,
    (snapshot) => {
      const players = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // ✅ Normalizar status al recibir desde Firebase (compatibilidad datos antiguos)
        const status = data.status;
        let normalizedStatus;
        if (!status) normalizedStatus = 'Activo';
        else {
          const s = status.toLowerCase().trim();
          if (s === 'activo' || s === 'active') normalizedStatus = 'Activo';
          else if (s === 'inactivo' || s === 'inactive') normalizedStatus = 'Inactivo';
          else normalizedStatus = status;
        }
        players.push({ id: doc.id, ...data, status: normalizedStatus });
      });
      
      if (typeof saveAllPlayers === 'function') {
        saveAllPlayers(players);
      } else {
        localStorage.setItem('players', JSON.stringify(players));
      }
      
      if (window.realtimeSyncState.initialLoadComplete) {
        snapshot.docChanges().forEach(change => {
          const player = { id: change.doc.id, ...change.doc.data() };
          
          if (change.type === 'modified') {
            console.log('🔄 Jugador actualizado:', player.name);
            showSyncNotification(`🔄 ${player.name} actualizado`);
          }
        });
        
        refreshPlayersUI();
      }
      
      window.realtimeSyncState.lastSync = new Date().toISOString();
    },
    (error) => {
      console.error('❌ Error en listener de jugadores:', error);
    }
  );
  
  console.log('👥 Listener de jugadores iniciado');
}

// ========================================
// 💰 LISTENER DE PAGOS
// ========================================
function startPaymentsListener(clubId) {
  const paymentsRef = window.firebase.collection(
    window.firebase.db,
    `clubs/${clubId}/payments`
  );
  
  window.realtimeListeners.payments = window.firebase.onSnapshot(
    paymentsRef,
    (snapshot) => {
      const payments = [];
      snapshot.forEach(doc => {
        payments.push({ id: doc.id, ...doc.data() });
      });
      
      localStorage.setItem('payments', JSON.stringify(payments));
      
      if (window.realtimeSyncState.initialLoadComplete) {
        refreshPaymentsUI();
      }
    },
    (error) => {
      console.error('❌ Error en listener de pagos:', error);
    }
  );
  
  console.log('💰 Listener de pagos iniciado');
}

// ========================================
// 📅 LISTENER DE EVENTOS
// ========================================
function startEventsListener(clubId) {
  const eventsRef = window.firebase.collection(
    window.firebase.db,
    `clubs/${clubId}/events`
  );
  
  window.realtimeListeners.events = window.firebase.onSnapshot(
    eventsRef,
    (snapshot) => {
      const events = [];
      snapshot.forEach(doc => {
        events.push({ id: doc.id, ...doc.data() });
      });
      
      localStorage.setItem('calendarEvents', JSON.stringify(events));
      
      if (window.realtimeSyncState.initialLoadComplete) {
        refreshCalendarUI();
      }
    },
    (error) => {
      console.error('❌ Error en listener de eventos:', error);
    }
  );
  
  console.log('📅 Listener de eventos iniciado');
}

// ========================================
// 💸 LISTENER DE EGRESOS
// ========================================
function startExpensesListener(clubId) {
  const expensesRef = window.firebase.collection(
    window.firebase.db,
    `clubs/${clubId}/expenses`
  );
  
  window.realtimeListeners.expenses = window.firebase.onSnapshot(
    expensesRef,
    (snapshot) => {
      const expenses = [];
      snapshot.forEach(doc => {
        expenses.push({ id: doc.id, ...doc.data() });
      });
      
      localStorage.setItem('expenses', JSON.stringify(expenses));
      
      if (window.realtimeSyncState.initialLoadComplete) {
        if (typeof renderAccounting === 'function') {
          renderAccounting();
        }
      }
    },
    (error) => {
      console.error('❌ Error en listener de egresos:', error);
    }
  );
  
  console.log('💸 Listener de egresos iniciado');
}

// ========================================
// ⚙️ LISTENER DE CONFIGURACIÓN
// ========================================
function startSettingsListener(clubId) {
  const settingsRef = window.firebase.doc(
    window.firebase.db,
    `clubs/${clubId}/settings`,
    'main'
  );
  
  window.realtimeListeners.settings = window.firebase.onSnapshot(
    settingsRef,
    async (doc) => {
      if (doc.exists()) {
        const settings = doc.data();

        // ✅ Recuperar logo del documento separado
        try {
          const clubId = window.realtimeSyncState.clubId;
          if (clubId) {
            const logoDoc = await window.firebase.getDoc(
              window.firebase.doc(window.firebase.db, `clubs/${clubId}/assets`, 'logo')
            );
            if (logoDoc.exists() && logoDoc.data().logo) {
              settings.logo = logoDoc.data().logo;
            } else {
              const local = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
              if (local.logo) settings.logo = local.logo;
            }
          }
        } catch (e) {
          const local = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
          if (local.logo) settings.logo = local.logo;
        }

        if (typeof saveSchoolSettings === 'function') {
          saveSchoolSettings(settings);
        } else {
          localStorage.setItem('schoolSettings', JSON.stringify(settings));
        }
        
        if (window.realtimeSyncState.initialLoadComplete) {
          updateHeaderInfo();
        }
      }
    },
    (error) => {
      console.error('❌ Error en listener de configuración:', error);
    }
  );
  
  console.log('⚙️ Listener de configuración iniciado');
  
  // Marcar carga inicial como completa
  setTimeout(() => {
    window.realtimeSyncState.initialLoadComplete = true;
    console.log('✅ Carga inicial completa, monitoreando cambios...');
  }, 2000);
}

// ========================================
// 🔄 FUNCIONES DE ACTUALIZACIÓN DE UI
// ========================================

function refreshPlayersUI() {
  try {
    if (typeof renderPlayersList === 'function') renderPlayersList();
    if (typeof updateDashboard === 'function') updateDashboard();
    console.log('✅ UI de jugadores actualizada');
  } catch (error) {
    console.warn('⚠️ Error al actualizar UI de jugadores:', error);
  }
}

function refreshPaymentsUI() {
  try {
    if (typeof renderPayments === 'function') renderPayments();
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof renderAccounting === 'function') renderAccounting();
    console.log('✅ UI de pagos actualizada');
  } catch (error) {
    console.warn('⚠️ Error al actualizar UI de pagos:', error);
  }
}

function refreshCalendarUI() {
  try {
    if (typeof renderCalendar === 'function') renderCalendar();
    console.log('✅ UI de calendario actualizada');
  } catch (error) {
    console.warn('⚠️ Error al actualizar UI de calendario:', error);
  }
}

// ========================================
// 🔔 MOSTRAR NOTIFICACIÓN DE SINCRONIZACIÓN
// ========================================
function showSyncNotification(message) {
  if (typeof showToast === 'function') {
    showToast(message);
  }
  
  const indicator = document.getElementById('syncIndicator');
  if (indicator) {
    indicator.classList.add('animate-pulse');
    const dot = indicator.querySelector('.sync-dot');
    if (dot) {
      dot.style.backgroundColor = '#fbbf24';
      setTimeout(() => {
        dot.style.backgroundColor = '#22c55e';
      }, 1000);
    }
    setTimeout(() => {
      indicator.classList.remove('animate-pulse');
    }, 2000);
  }
}

// ========================================
// 🟢 FUNCIONES DEL INDICADOR (ORDEN CORRECTO)
// ========================================

// ✅ PRIMERO: Expandir indicador
function expandIndicator() {
  const indicator = document.getElementById('syncIndicator');
  const textEl = document.getElementById('syncText');
  
  if (!indicator || !textEl) return;
  
  indicator.style.paddingLeft = '12px';
  indicator.style.paddingRight = '12px';
  textEl.style.maxWidth = '250px';
  textEl.style.opacity = '1';
  textEl.style.marginLeft = '8px';
}

// ✅ SEGUNDO: Contraer indicador
function contractIndicator() {
  const indicator = document.getElementById('syncIndicator');
  const textEl = document.getElementById('syncText');
  
  if (!indicator || !textEl) return;
  
  textEl.style.maxWidth = '0px';
  textEl.style.opacity = '0';
  textEl.style.marginLeft = '0px';
  
  setTimeout(() => {
    indicator.style.paddingLeft = '8px';
    indicator.style.paddingRight = '8px';
  }, 300);
}

// ========================================
// 🟢 INDICADOR VISUAL DE SINCRONIZACIÓN
// ========================================
function showSyncIndicator(isActive) {
  let indicator = document.getElementById('syncIndicator');
  
  if (!indicator) {
    // Crear indicador
    indicator = document.createElement('div');
    indicator.id = 'syncIndicator';
    indicator.className = 'fixed bottom-20 right-4 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 z-50 cursor-pointer flex items-center gap-2 px-3 py-2';
    indicator.style.transition = 'all 0.3s ease';
    indicator.title = 'Sincronización en tiempo real activa';
    
    indicator.innerHTML = `
  <span class="relative flex h-3 w-3" style="flex-shrink: 0;">
    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
    <span class="sync-dot relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
  </span>
`;

    
    // Click para mostrar/ocultar
indicator.onclick = function() {
  const state = window.realtimeSyncState;
  const lastSync = state.lastSync ? new Date(state.lastSync).toLocaleTimeString() : 'N/A';
  if (typeof showToast === 'function') {
    showToast(`🔄 Última sync: ${lastSync}`);
  }
};
    
    document.body.appendChild(indicator);
  }
  
  if (isActive) {
    // Mostrar indicador
    indicator.classList.remove('hidden');
    indicator.style.opacity = '1';
    

    
  } else {
    // Ocultar indicador completamente
    indicator.style.opacity = '0';
    setTimeout(() => {
      indicator.classList.add('hidden');
    }, 300);
  }
}

// ========================================
// 🔄 ACTUALIZAR INFORMACIÓN DEL HEADER
// ========================================
function updateHeaderInfo() {
  try {
    const settings = typeof getSchoolSettings === 'function' 
      ? getSchoolSettings() 
      : JSON.parse(localStorage.getItem('schoolSettings') || '{}');
    
    if (!settings) return;
    
    const logoElements = document.querySelectorAll('#clubLogo, [data-club-logo]');
    logoElements.forEach(el => {
      if (settings.logo && el.tagName === 'IMG') {
        el.src = settings.logo;
      }
    });
    
    const nameElements = document.querySelectorAll('#clubName, [data-club-name]');
    nameElements.forEach(el => {
      if (settings.name) {
        el.textContent = settings.name;
      }
    });
    
    console.log('✅ Header actualizado');
  } catch (error) {
    console.warn('⚠️ Error al actualizar header:', error);
  }
}

// ========================================
// 🚀 AUTO-INICIAR AL CARGAR (si hay sesión)
// ========================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔄 Módulo de sincronización en tiempo real cargado');
  
  let attempts = 0;
  const maxAttempts = 30;
  
  const checkFirebase = setInterval(() => {
    attempts++;
    
    if (window.APP_STATE?.firebaseReady && window.firebase?.db && window.firebase?.onSnapshot) {
      clearInterval(checkFirebase);
      
      const currentUser = typeof getCurrentUser === 'function' 
        ? getCurrentUser() 
        : JSON.parse(localStorage.getItem('currentUser') || 'null');
      
      if (currentUser?.schoolId) {
        console.log('🔄 Sesión detectada, iniciando sincronización...');
        
        setTimeout(() => {
          startRealtimeSync(currentUser.schoolId);
        }, 1500);
      } else {
        console.log('ℹ️ No hay sesión activa');
      }
    }
    
    if (attempts >= maxAttempts) {
      clearInterval(checkFirebase);
      console.warn('⚠️ Timeout esperando Firebase');
    }
  }, 500);
});

// ========================================
// 🧹 LIMPIAR AL CERRAR SESIÓN
// ========================================
if (typeof window.logout === 'function') {
  const originalLogout = window.logout;
  window.logout = function() {
    stopRealtimeSync();
    if (typeof originalLogout === 'function') {
      originalLogout.apply(this, arguments);
    }
  };
}

window.addEventListener('beforeunload', function() {
  stopRealtimeSync();
});

// Exponer funciones globalmente
window.startRealtimeSync = startRealtimeSync;
window.stopRealtimeSync = stopRealtimeSync;

console.log('✅ Módulo de sincronización en tiempo real listo');