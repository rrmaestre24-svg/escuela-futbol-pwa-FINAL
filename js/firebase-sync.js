// ========================================
// SINCRONIZACIÓN CON FIREBASE - CORREGIDO CON CLUB ID
// ========================================

/**
 * ✅ Verificar si Firebase está listo y autenticado
 */
function checkFirebaseReady() {
  if (!window.APP_STATE?.firebaseReady) {
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
 * Sube todos los datos locales a Firebase - CORREGIDO CON CLUB ID
 */
async function syncAllToFirebase() {
  if (!checkFirebaseReady()) return;

  try {
    console.log('📤 Sincronizando todos los datos a Firebase...');
    showToast('📤 Subiendo datos...');

    const settings = getSchoolSettings();
    const clubId = settings.clubId || 'default_club';
    
    // 1️⃣ Configuración del club
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, "main"),
      { ...settings, lastUpdated: new Date().toISOString() }
    );

    // 2️⃣ Jugadores
    const players = getAllPlayers() || [];
    for (const player of players) {
      if (player.id) {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, player.id),
          player
        );
      }
    }

    // 3️⃣ Pagos
    const payments = getPayments() || [];
    for (const payment of payments) {
      if (payment.id) {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/payments`, payment.id),
          payment
        );
      }
    }

    // 4️⃣ Eventos
    const events = getCalendarEvents() || [];
    for (const event of events) {
      if (event.id) {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/events`, event.id),
          event
        );
      }
    }

    // 5️⃣ Usuarios
    const users = getUsers() || [];
    for (const user of users) {
      if (user.id) {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, user.id),
          {
            id: user.id,
            email: user.email,
            name: user.name,
            isMainAdmin: user.isMainAdmin || false,
            role: 'admin',
            avatar: user.avatar || '',
            phone: user.phone || '',
            birthDate: user.birthDate || '',
            createdAt: user.createdAt || new Date().toISOString()
          }
        );
      }
    }

    console.log('✅ Sincronización completada');
    showToast('✅ Datos subidos a Firebase');
  } catch (error) {
    console.error('❌ Error al sincronizar:', error);
    showToast('⚠️ Error al subir datos');
  }
}

/**
 * Descarga todos los datos desde Firebase - CORREGIDO CON CLUB ID
 */
async function downloadFromFirebase() {
  if (!checkFirebaseReady()) return;

  try {
    console.log('📥 Descargando datos desde Firebase...');
    showToast('📥 Descargando datos...');

    const settings = getSchoolSettings();
    const clubId = settings.clubId || 'default_club';

    // 1️⃣ Configuración
    const settingsSnap = await window.firebase.getDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, "main")
    );
    if (settingsSnap.exists()) {
      saveSchoolSettings(settingsSnap.data());
    }

    // 2️⃣ Jugadores
    const playersSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/players`)
    );
    const players = [];
    playersSnapshot.forEach(doc => players.push(doc.data()));
    localStorage.setItem('players', JSON.stringify(players));

    // 3️⃣ Pagos
    const paymentsSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`)
    );
    const payments = [];
    paymentsSnapshot.forEach(doc => payments.push(doc.data()));
    localStorage.setItem('payments', JSON.stringify(payments));

    // 4️⃣ Eventos
    const eventsSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/events`)
    );
    const events = [];
    eventsSnapshot.forEach(doc => events.push(doc.data()));
    localStorage.setItem('events', JSON.stringify(events));

    // 5️⃣ Usuarios
    const usersSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/users`)
    );
    const users = [];
    usersSnapshot.forEach(doc => users.push(doc.data()));
    localStorage.setItem('users', JSON.stringify(users));

    showToast('✅ Datos descargados y actualizados');
    location.reload();
  } catch (error) {
    console.error('❌ Error al descargar:', error);
    showToast('⚠️ Error al descargar datos');
  }
}

/**
 * Verifica si hay actualizaciones en Firebase
 */
async function checkForUpdates() {
  if (!checkFirebaseReady()) return;

  try {
    console.log('🔍 Buscando actualizaciones...');
    showToast('🔍 Buscando actualizaciones...');

    const settings = getSchoolSettings();
    const clubId = settings.clubId || 'default_club';
    
    const settingsRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, "main");
    const docSnap = await window.firebase.getDoc(settingsRef);
    if (docSnap.exists()) {
      const lastUpdate = docSnap.data().lastUpdated || 'desconocida';
      showToast(`✅ Última actualización: ${lastUpdate}`);
    } else {
      showToast('ℹ️ No hay datos en Firebase');
    }
  } catch (error) {
    console.error('❌ Error al buscar actualizaciones:', error);
    showToast('⚠️ Error al verificar actualizaciones');
  }
}

/**
 * Guardar usuario en el club en Firebase
 */
async function saveUserToClubInFirebase(user) {
  if (!checkFirebaseReady()) return false;

  try {
    const settings = getSchoolSettings();
    const clubId = settings.clubId || 'default_club';
    
    if (!clubId || !user?.id) {
      console.error('❌ Club ID o user ID faltante');
      return false;
    }
    
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
 * Guardar usuario en el club en Firebase (con clubId explícito)
 */
async function saveUserToClubInFirebaseWithClubId(user, clubId) {
  if (!checkFirebaseReady()) return;
  
  if (!clubId || !user?.id) {
    console.error('❌ Club ID o user ID faltante');
    return;
  }
  
  try {
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
      role: 'admin',
      joinedAt: new Date().toISOString()
    });
    
    console.log('✅ Usuario guardado en club:', clubId, user.id);
  } catch (error) {
    console.error('❌ Error al guardar usuario en club:', error);
    throw error;
  }
}

console.log('✅ firebase-sync.js cargado (CORREGIDO CON CLUB ID)');