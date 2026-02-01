// ========================================
// 🔄 SINCRONIZACIÓN EN TIEMPO REAL - FIREBASE
// Escucha cambios automáticamente cuando los padres
// actualizan datos desde el Portal de Padres
// ========================================

// Almacenar referencias a los listeners para poder desconectarlos
window.realtimeListeners = {
  players: null,
  payments: null,
  events: null,
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
function startRealtimeSync(clubId) {
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
  
  console.log('🔄 Iniciando sincronización en tiempo real para:', clubId);
  
  try {
    // 1️⃣ Listener de Jugadores
    startPlayersListener(clubId);
    
    // 2️⃣ Listener de Pagos
    startPaymentsListener(clubId);
    
    // 3️⃣ Listener de Eventos
    startEventsListener(clubId);
    
    // 4️⃣ Listener de Configuración
    startSettingsListener(clubId);
    
    // Actualizar estado
    window.realtimeSyncState.isActive = true;
    window.realtimeSyncState.clubId = clubId;
    window.realtimeSyncState.lastSync = new Date().toISOString();
    
    // Mostrar indicador de sincronización activa
    showSyncIndicator(true);
    
    console.log('✅ Sincronización en tiempo real activada');
    showToast('🔄 Sincronización en tiempo real activa');
    return true;
    
  } catch (error) {
    console.error('❌ Error al iniciar sincronización:', error);
    return false;
  }
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
        window.realtimeListeners[key](); // Llamar la función unsubscribe
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
        players.push({ id: doc.id, ...doc.data() });
      });
      
      // Guardar en localStorage
      if (typeof saveAllPlayers === 'function') {
        saveAllPlayers(players);
      } else {
        localStorage.setItem('players', JSON.stringify(players));
      }
      
      // Detectar cambios solo después de la carga inicial
      if (window.realtimeSyncState.initialLoadComplete) {
        snapshot.docChanges().forEach(change => {
          const player = { id: change.doc.id, ...change.doc.data() };
          
          if (change.type === 'modified') {
            console.log('🔄 Jugador actualizado:', player.name);
            showSyncNotification(`🔄 ${player.name} actualizado`);
          } else if (change.type === 'added') {
            console.log('➕ Nuevo jugador:', player.name);
          } else if (change.type === 'removed') {
            console.log('➖ Jugador eliminado:', player.name);
          }
        });
        
        // Actualizar la UI si estamos en la vista de jugadores
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
      
      // Guardar en localStorage
      localStorage.setItem('payments', JSON.stringify(payments));
      
      // Detectar cambios solo después de la carga inicial
      if (window.realtimeSyncState.initialLoadComplete) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'modified') {
            const payment = change.doc.data();
            console.log('🔄 Pago actualizado:', payment.concept || payment.playerId);
          }
        });
        
        // Actualizar UI de pagos
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
      
      // Guardar en localStorage
      localStorage.setItem('calendarEvents', JSON.stringify(events));
      
      // Actualizar calendario si está visible y es después de carga inicial
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
    (doc) => {
      if (doc.exists()) {
        const settings = doc.data();
        
        if (typeof saveSchoolSettings === 'function') {
          saveSchoolSettings(settings);
        } else {
          localStorage.setItem('schoolSettings', JSON.stringify(settings));
        }
        
        // Actualizar header si existe
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
  
  // Marcar carga inicial como completa después de un pequeño delay
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
    // Intentar actualizar lista de jugadores
    if (typeof renderPlayersList === 'function') {
      renderPlayersList();
    }
    
    // Actualizar dashboard
    if (typeof updateDashboard === 'function') {
      updateDashboard();
    } else if (typeof updateDashboardStats === 'function') {
      updateDashboardStats();
    }
    
    console.log('✅ UI de jugadores actualizada');
  } catch (error) {
    console.warn('⚠️ Error al actualizar UI de jugadores:', error);
  }
}

function refreshPaymentsUI() {
  try {
    // Intentar actualizar lista de pagos
    if (typeof renderPayments === 'function') {
      renderPayments();
    }
    
    // Actualizar dashboard
    if (typeof updateDashboard === 'function') {
      updateDashboard();
    }
    
    console.log('✅ UI de pagos actualizada');
  } catch (error) {
    console.warn('⚠️ Error al actualizar UI de pagos:', error);
  }
}

function refreshCalendarUI() {
  try {
    // Intentar actualizar calendario
    if (typeof renderCalendar === 'function') {
      renderCalendar();
    }
    
    // Actualizar eventos del dashboard
    if (typeof updateDashboardEvents === 'function') {
      updateDashboardEvents();
    }
    
    console.log('✅ UI de calendario actualizada');
  } catch (error) {
    console.warn('⚠️ Error al actualizar UI de calendario:', error);
  }
}

// ========================================
// 🔔 MOSTRAR NOTIFICACIÓN DE SINCRONIZACIÓN
// ========================================
function showSyncNotification(message) {
  // Usar el sistema de toast existente
  if (typeof showToast === 'function') {
    showToast(message);
  }
  
  // También hacer parpadear el indicador de sync
  const indicator = document.getElementById('syncIndicator');
  if (indicator) {
    indicator.classList.add('animate-pulse');
    const dot = indicator.querySelector('.sync-dot');
    if (dot) {
      dot.style.backgroundColor = '#fbbf24'; // Amarillo al recibir cambio
      setTimeout(() => {
        dot.style.backgroundColor = '#22c55e'; // Volver a verde
      }, 1000);
    }
    setTimeout(() => {
      indicator.classList.remove('animate-pulse');
    }, 2000);
  }
}

// ========================================
// 🟢 INDICADOR VISUAL DE SINCRONIZACIÓN
// ========================================
function showSyncIndicator(isActive) {
  let indicator = document.getElementById('syncIndicator');
  
  if (!indicator) {
    // Crear el indicador si no existe
    indicator = document.createElement('div');
    indicator.id = 'syncIndicator';
    indicator.className = 'fixed bottom-4 right-4 flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 cursor-pointer';
    indicator.title = 'Sincronización en tiempo real activa';
    indicator.innerHTML = `
      <span class="relative flex h-3 w-3">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span class="sync-dot relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
      </span>
      <span class="text-xs font-medium text-gray-600 dark:text-gray-300">Sync</span>
    `;
    
    // Clic para mostrar estado
    indicator.onclick = function() {
      const state = window.realtimeSyncState;
      const lastSync = state.lastSync ? new Date(state.lastSync).toLocaleTimeString() : 'N/A';
      showToast(`🔄 Última sync: ${lastSync}`);
    };
    
    document.body.appendChild(indicator);
  }
  
  if (isActive) {
    indicator.classList.remove('hidden', 'opacity-0');
    indicator.classList.add('opacity-100');
  } else {
    indicator.classList.add('opacity-0');
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
    
    // Actualizar logo si existe
    const logoElements = document.querySelectorAll('#clubLogo, [data-club-logo]');
    logoElements.forEach(el => {
      if (settings.logo && el.tagName === 'IMG') {
        el.src = settings.logo;
      }
    });
    
    // Actualizar nombre si existe
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
  
  // Esperar a que Firebase esté listo
  let attempts = 0;
  const maxAttempts = 30;
  
  const checkFirebase = setInterval(() => {
    attempts++;
    
    if (window.APP_STATE?.firebaseReady && window.firebase?.db && window.firebase?.onSnapshot) {
      clearInterval(checkFirebase);
      
      // Verificar si hay una sesión activa
      const currentUser = typeof getCurrentUser === 'function' 
        ? getCurrentUser() 
        : JSON.parse(localStorage.getItem('currentUser') || 'null');
      
      if (currentUser?.schoolId) {
        console.log('🔄 Sesión detectada, iniciando sincronización en tiempo real...');
        
        // Pequeño delay para asegurar que todo esté cargado
        setTimeout(() => {
          startRealtimeSync(currentUser.schoolId);
        }, 1500);
      } else {
        console.log('ℹ️ No hay sesión activa, sincronización en espera');
      }
    }
    
    if (attempts >= maxAttempts) {
      clearInterval(checkFirebase);
      console.warn('⚠️ Timeout esperando Firebase para sincronización en tiempo real');
    }
  }, 500);
});

// ========================================
// 🧹 LIMPIAR AL CERRAR SESIÓN
// ========================================
// Interceptar la función de logout para detener la sincronización
if (typeof window.logout === 'function') {
  const originalLogout = window.logout;
  window.logout = function() {
    stopRealtimeSync();
    if (typeof originalLogout === 'function') {
      originalLogout.apply(this, arguments);
    }
  };
}

// También limpiar al cerrar la ventana
window.addEventListener('beforeunload', function() {
  stopRealtimeSync();
});

// Exponer funciones globalmente
window.startRealtimeSync = startRealtimeSync;
window.stopRealtimeSync = stopRealtimeSync;

console.log('✅ Módulo de sincronización en tiempo real listo');