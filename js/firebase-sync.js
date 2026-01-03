// ========================================
// SINCRONIZACIÓN CON FIREBASE - MULTI-CLUB CORREGIDO
// ========================================

/**
 * ✅ Verificar si Firebase está listo y autenticado
 */
function checkFirebaseReady() {
  if (!window.APP_STATE?.firebaseReady) {
    console.warn('⚠️ Firebase no está inicializado');
    showToast('⚠️ Firebase no está listo. Espera unos segundos.');
    return false;
  }
  
  if (!window.firebase?.auth?.currentUser) {
    console.warn('⚠️ No hay usuario autenticado en Firebase');
    showToast('⚠️ Debes estar autenticado para sincronizar');
    return false;
  }
  
  return true;
}

/**
 * ✅ Obtener clubId desde localStorage
 */
function getClubId() {
  const clubId = localStorage.getItem('clubId');
  
  if (!clubId) {
    // Intentar obtenerlo desde settings
    const settings = getSchoolSettings();
    if (settings.clubId) {
      localStorage.setItem('clubId', settings.clubId);
      return settings.clubId;
    }
    
    console.error('❌ No se encontró clubId');
    showToast('❌ Error: No se encontró el ID del club');
    return null;
  }
  
  return clubId;
}

/**
 * ✅ Sube todos los datos locales a Firebase - CORREGIDO PARA USUARIOS SECUNDARIOS
 */
async function syncAllToFirebase() {
  if (!checkFirebaseReady()) return;

  const clubId = getClubId();
  if (!clubId) {
    showToast('❌ No se puede sincronizar sin clubId');
    return;
  }

  const currentUser = getCurrentUser();
  if (!currentUser) {
    showToast('❌ No hay usuario en sesión');
    return;
  }

  try {
    console.log('📤 Sincronizando todos los datos a Firebase...');
    console.log('📤 Club ID:', clubId);
    console.log('👤 Usuario:', currentUser.email);
    console.log('👑 Es admin principal:', currentUser.isMainAdmin);
    showToast('📤 Subiendo datos...');

    let syncedItems = [];

    // 1️⃣ Configuración del club - ⚠️ SOLO ADMIN PRINCIPAL
    if (currentUser.isMainAdmin) {
      const settings = getSchoolSettings();
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, "main"),
        { ...settings, lastUpdated: new Date().toISOString() }
      );
      console.log('✅ Configuración subida');
      syncedItems.push('configuración');
    } else {
      console.log('⏭️ Configuración omitida (solo admin principal)');
    }

    // 2️⃣ Jugadores - ✅ TODOS LOS ADMINS
    const players = getAllPlayers() || [];
    let playersCount = 0;
    for (const player of players) {
      if (player.id) {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, player.id),
          player
        );
        playersCount++;
      }
    }
    console.log(`✅ ${playersCount} jugadores subidos`);
    syncedItems.push(`${playersCount} jugadores`);

    // 3️⃣ Pagos - ✅ TODOS LOS ADMINS
    const payments = getPayments() || [];
    let paymentsCount = 0;
    for (const payment of payments) {
      if (payment.id) {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/payments`, payment.id),
          payment
        );
        paymentsCount++;
      }
    }
    console.log(`✅ ${paymentsCount} pagos subidos`);
    syncedItems.push(`${paymentsCount} pagos`);

    // 4️⃣ Eventos - ✅ TODOS LOS ADMINS
    const events = getCalendarEvents() || [];
    let eventsCount = 0;
    for (const event of events) {
      if (event.id) {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/events`, event.id),
          event
        );
        eventsCount++;
      }
    }
    console.log(`✅ ${eventsCount} eventos subidos`);
    syncedItems.push(`${eventsCount} eventos`);

    // 5️⃣ Usuarios - ⚠️ SOLO ADMIN PRINCIPAL
    if (currentUser.isMainAdmin) {
      const users = getUsers() || [];
      let usersCount = 0;
      for (const user of users) {
        if (user.id) {
          await window.firebase.setDoc(
            window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, user.id),
            {
              id: user.id,
              email: user.email,
              name: user.name,
              isMainAdmin: user.isMainAdmin || false,
              role: user.role || 'admin',
              avatar: user.avatar || '',
              phone: user.phone || '',
              birthDate: user.birthDate || '',
              createdAt: user.createdAt || new Date().toISOString()
            }
          );
          usersCount++;
        }
      }
      console.log(`✅ ${usersCount} usuarios subidos`);
      syncedItems.push(`${usersCount} usuarios`);
    } else {
      console.log('⏭️ Usuarios omitidos (solo admin principal)');
    }
    
    // 6️⃣ Egresos - ✅ TODOS LOS ADMINS
    const expenses = getExpenses() || [];
    let expensesCount = 0;
    for (const expense of expenses) {
      if (expense.id) {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/expenses`, expense.id),
          expense
        );
        expensesCount++;
      }
    }
    console.log(`✅ ${expensesCount} egresos subidos`);
    syncedItems.push(`${expensesCount} egresos`);

    console.log('✅ Sincronización completada');
    showToast(`✅ Datos subidos: ${syncedItems.join(', ')}`);
  } catch (error) {
    console.error('❌ Error al sincronizar:', error);
    showToast('⚠️ Error al subir datos: ' + error.message);
  }
}

/**
 * ✅ Descarga todos los datos desde Firebase - CORREGIDO
 */
async function downloadFromFirebase() {
  if (!checkFirebaseReady()) return;

  const clubId = getClubId();
  if (!clubId) {
    showToast('❌ No se puede descargar sin clubId');
    return;
  }

  try {
    console.log('🔥 Descargando datos desde Firebase...');
    console.log('🔥 Club ID:', clubId);
    showToast('🔥 Descargando datos...');

    // 1️⃣ Configuración - ✅ RUTA CORREGIDA
    const settingsSnap = await window.firebase.getDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, "main")
    );
    if (settingsSnap.exists()) {
      saveSchoolSettings(settingsSnap.data());
      console.log('✅ Configuración descargada');
    }

    // 2️⃣ Jugadores - ✅ RUTA CORREGIDA
    const playersSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/players`)
    );
    const players = [];
    playersSnapshot.forEach(doc => players.push(doc.data()));
    localStorage.setItem('players', JSON.stringify(players));
    console.log(`✅ ${players.length} jugadores descargados`);

    // 3️⃣ Pagos - ✅ RUTA CORREGIDA
    const paymentsSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`)
    );
    const payments = [];
    paymentsSnapshot.forEach(doc => payments.push(doc.data()));
    localStorage.setItem('payments', JSON.stringify(payments));
    console.log(`✅ ${payments.length} pagos descargados`);

    // 4️⃣ Eventos - ✅ RUTA CORREGIDA
    const eventsSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/events`)
    );
    const events = [];
    eventsSnapshot.forEach(doc => events.push(doc.data()));
    localStorage.setItem('calendarEvents', JSON.stringify(events));
    console.log(`✅ ${events.length} eventos descargados`);

    // 5️⃣ Usuarios - ✅ RUTA CORREGIDA
    const usersSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/users`)
    );
    const users = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      users.push({
        id: userData.id || doc.id,
        schoolId: clubId,
        email: userData.email || '',
        name: userData.name || '',
        isMainAdmin: userData.isMainAdmin === true, // ✅ PRESERVAR BOOLEAN
        role: userData.role || 'admin',
        avatar: userData.avatar || '',
        phone: userData.phone || '',
        birthDate: userData.birthDate || '',
        password: 'encrypted',
        createdAt: userData.createdAt || userData.joinedAt || new Date().toISOString()
      });
    });
    localStorage.setItem('users', JSON.stringify(users));
    console.log(`✅ ${users.length} usuarios descargados`);
    
    // ✅ VERIFICAR ADMIN PRINCIPAL
    const mainAdmin = users.find(u => u.isMainAdmin === true);
    if (mainAdmin) {
      console.log('👑 Admin principal:', mainAdmin.email);
    } else {
      console.warn('⚠️ NO hay admin principal');
    }

    // 6️⃣ Egresos - ✅ RUTA CORREGIDA
    const expensesSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/expenses`)
    );
    const expenses = [];
    expensesSnapshot.forEach(doc => expenses.push(doc.data()));
    localStorage.setItem('expenses', JSON.stringify(expenses));
    console.log(`✅ ${expenses.length} egresos descargados`);

    showToast(`✅ Datos descargados: ${players.length} jugadores, ${payments.length} pagos, ${events.length} eventos, ${users.length} usuarios, ${expenses.length} egresos`);
    
    // Recargar para aplicar cambios
    setTimeout(() => {
      location.reload();
    }, 1500);
  } catch (error) {
    console.error('❌ Error al descargar:', error);
    showToast('⚠️ Error al descargar datos: ' + error.message);
  }
}

/**
 * ✅ Verifica si hay actualizaciones en Firebase
 */
async function checkForUpdates() {
  if (!checkFirebaseReady()) return;

  const clubId = getClubId();
  if (!clubId) {
    showToast('❌ No se puede verificar sin clubId');
    return;
  }

  try {
    console.log('🔍 Buscando actualizaciones...');
    console.log('🔍 Club ID:', clubId);
    showToast('🔍 Buscando actualizaciones...');
    
    // ✅ RUTA CORREGIDA
    const settingsRef = window.firebase.doc(
      window.firebase.db, 
      `clubs/${clubId}/settings`, 
      "main"
    );
    const docSnap = await window.firebase.getDoc(settingsRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const lastUpdate = data.lastUpdated || 'desconocida';
      const clubName = data.name || 'Sin nombre';
      showToast(`✅ Club: ${clubName}\n📅 Última actualización: ${lastUpdate}`);
      console.log('✅ Datos encontrados:', data);
    } else {
      showToast('ℹ️ No hay datos en Firebase para este club');
      console.log('⚠️ No se encontraron datos');
    }
  } catch (error) {
    console.error('❌ Error al buscar actualizaciones:', error);
    showToast('⚠️ Error al verificar actualizaciones: ' + error.message);
  }
}

/**
 * ✅ Guardar jugador individual en Firebase
 */
async function savePlayerToFirebase(player) {
  if (!checkFirebaseReady()) return false;

  const clubId = getClubId();
  if (!clubId || !player?.id) {
    console.error('❌ Club ID o player ID faltante');
    return false;
  }

  try {
    // ✅ RUTA CORREGIDA
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, player.id),
      player
    );
    console.log('✅ Jugador guardado en Firebase:', player.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar jugador:', error);
    return false;
  }
}

/**
 * ✅ Guardar pago individual en Firebase
 */
async function savePaymentToFirebase(payment) {
  if (!checkFirebaseReady()) return false;

  const clubId = getClubId();
  if (!clubId || !payment?.id) {
    console.error('❌ Club ID o payment ID faltante');
    return false;
  }

  try {
    // ✅ RUTA CORREGIDA
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/payments`, payment.id),
      payment
    );
    console.log('✅ Pago guardado en Firebase:', payment.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar pago:', error);
    return false;
  }
}

/**
 * ✅ Guardar evento individual en Firebase
 */
async function saveEventToFirebase(event) {
  if (!checkFirebaseReady()) return false;

  const clubId = getClubId();
  if (!clubId || !event?.id) {
    console.error('❌ Club ID o event ID faltante');
    return false;
  }

  try {
    // ✅ RUTA CORREGIDA
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/events`, event.id),
      event
    );
    console.log('✅ Evento guardado en Firebase:', event.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar evento:', error);
    return false;
  }
}

/**
 * ✅ Guardar usuario en el club en Firebase
 */
async function saveUserToClubInFirebase(user) {
  if (!checkFirebaseReady()) return false;

  const clubId = getClubId();
  if (!clubId || !user?.id) {
    console.error('❌ Club ID o user ID faltante');
    return false;
  }
  
  try {
    // ✅ RUTA CORREGIDA
    const userRef = window.firebase.doc(
      window.firebase.db,
      `clubs/${clubId}/users`,
      user.id
    );
    
    await window.firebase.setDoc(userRef, {
      id: user.id,
      email: user.email,
      name: user.name,
      isMainAdmin: user.isMainAdmin || false,
      role: user.role || 'admin',
      avatar: user.avatar || '',
      phone: user.phone || '',
      birthDate: user.birthDate || '',
      joinedAt: user.createdAt || new Date().toISOString()
    });
    
    console.log('✅ Usuario guardado en Firebase:', user.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar usuario en Firebase:', error);
    return false;
  }
}

/**
 * ✅ Guardar usuario en el club en Firebase (con clubId explícito)
 */
async function saveUserToClubInFirebaseWithClubId(user, explicitClubId) {
  if (!checkFirebaseReady()) return false;
  
  const clubId = explicitClubId || getClubId();
  if (!clubId || !user?.id) {
    console.error('❌ Club ID o user ID faltante');
    return false;
  }
  
  try {
    // ✅ RUTA CORREGIDA
    const userRef = window.firebase.doc(
      window.firebase.db,
      `clubs/${clubId}/users`,
      user.id
    );
    
    await window.firebase.setDoc(userRef, {
      id: user.id,
      email: user.email,
      name: user.name,
      isMainAdmin: user.isMainAdmin || false,
      role: user.role || 'admin',
      avatar: user.avatar || '',
      phone: user.phone || '',
      birthDate: user.birthDate || '',
      joinedAt: new Date().toISOString()
    });
    
    console.log('✅ Usuario guardado en club:', clubId, user.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar usuario en club:', error);
    return false;
  }
}

/**
 * ✅ Eliminar jugador de Firebase
 */
async function deletePlayerFromFirebase(playerId) {
  if (!checkFirebaseReady()) return false;

  const clubId = getClubId();
  if (!clubId || !playerId) {
    console.error('❌ Club ID o player ID faltante');
    return false;
  }

  try {
    // ✅ RUTA CORREGIDA
    await window.firebase.deleteDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, playerId)
    );
    console.log('✅ Jugador eliminado de Firebase:', playerId);
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar jugador:', error);
    return false;
  }
}

/**
 * ✅ Eliminar pago de Firebase
 */
async function deletePaymentFromFirebase(paymentId) {
  if (!checkFirebaseReady()) return false;

  const clubId = getClubId();
  if (!clubId || !paymentId) {
    console.error('❌ Club ID o payment ID faltante');
    return false;
  }

  try {
    // ✅ RUTA CORREGIDA
    await window.firebase.deleteDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/payments`, paymentId)
    );
    console.log('✅ Pago eliminado de Firebase:', paymentId);
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar pago:', error);
    return false;
  }
}

/**
 * ✅ Eliminar evento de Firebase
 */
async function deleteEventFromFirebase(eventId) {
  if (!checkFirebaseReady()) return false;

  const clubId = getClubId();
  if (!clubId || !eventId) {
    console.error('❌ Club ID o event ID faltante');
    return false;
  }

  try {
    // ✅ RUTA CORREGIDA
    await window.firebase.deleteDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/events`, eventId)
    );
    console.log('✅ Evento eliminado de Firebase:', eventId);
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar evento:', error);
    return false;
  }
}

/**
 * ✅ Guardar egreso individual en Firebase
 */
async function saveExpenseToFirebase(expense) {
  if (!checkFirebaseReady()) return false;

  const clubId = getClubId();
  if (!clubId || !expense?.id) {
    console.error('❌ Club ID o expense ID faltante');
    return false;
  }

  try {
    // ✅ RUTA: clubs/{clubId}/expenses/{expenseId}
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/expenses`, expense.id),
      expense
    );
    console.log('✅ Egreso guardado en Firebase:', expense.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar egreso:', error);
    return false;
  }
}

/**
 * ✅ Eliminar egreso de Firebase
 */
async function deleteExpenseFromFirebase(expenseId) {
  if (!checkFirebaseReady()) return false;

  const clubId = getClubId();
  if (!clubId || !expenseId) {
    console.error('❌ Club ID o expense ID faltante');
    return false;
  }

  try {
    // ✅ RUTA: clubs/{clubId}/expenses/{expenseId}
    await window.firebase.deleteDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/expenses`, expenseId)
    );
    console.log('✅ Egreso eliminado de Firebase:', expenseId);
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar egreso:', error);
    return false;
  }
}

console.log('✅ firebase-sync.js cargado (MULTI-CLUB CON PERMISOS POR ROL)');