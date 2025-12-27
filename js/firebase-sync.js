// ========================================
// SINCRONIZACIÓN CON FIREBASE - CORREGIDO
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
 * Sube todos los datos locales a Firebase
 */
async function syncAllToFirebase() {
  if (!checkFirebaseReady()) return;

  try {
    console.log('📤 Sincronizando todos los datos a Firebase...');
    showToast('📤 Subiendo datos...');

    // Obtener configuración del club
    const settings = getSchoolSettings();
    const clubId = settings.clubId || 'default_club';

    // 1️⃣ Subir configuración del club
    try {
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, "settings", "club"),
        {
          ...settings,
          lastUpdated: new Date().toISOString(),
          updatedBy: window.firebase.auth.currentUser.uid
        }
      );
      console.log('✅ Configuración subida');
    } catch (error) {
      console.error('❌ Error al subir configuración:', error);
    }

    // 2️⃣ Subir jugadores
    const players = getAllPlayers() || [];
    let uploadedPlayers = 0;
    
    for (const player of players) {
      if (player.id) {
        try {
          await window.firebase.setDoc(
            window.firebase.doc(window.firebase.db, "players", player.id),
            {
              ...player,
              clubId: clubId,
              lastUpdated: new Date().toISOString()
            }
          );
          uploadedPlayers++;
        } catch (error) {
          console.error(`❌ Error al subir jugador ${player.id}:`, error);
        }
      }
    }
    console.log(`✅ ${uploadedPlayers}/${players.length} jugadores subidos`);

    console.log('✅ Sincronización completada');
    showToast('✅ Datos subidos a Firebase');
  } catch (error) {
    console.error('❌ Error al sincronizar:', error);
    showToast('⚠️ Error al subir datos');
  }
}

/**
 * Descarga todos los datos desde Firebase
 */
async function downloadFromFirebase() {
  if (!checkFirebaseReady()) return;

  try {
    console.log('📥 Descargando datos desde Firebase...');
    showToast('📥 Descargando datos...');

    // Descargar configuración
    const settingsRef = window.firebase.doc(window.firebase.db, "settings", "club");
    const settingsSnap = await window.firebase.getDoc(settingsRef);
    if (settingsSnap.exists()) {
      saveSchoolSettings(settingsSnap.data());
      console.log('✅ Configuración descargada');
    }

    // Descargar jugadores
    const playersSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, "players")
    );
    const players = [];
    playersSnapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    
    if (players.length > 0) {
      localStorage.setItem('players', JSON.stringify(players));
      console.log(`✅ ${players.length} jugadores descargados`);
    }

    showToast('✅ Datos descargados y actualizados');
    location.reload(); // Opcional: recargar para ver cambios
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

    // Aquí podrías comparar timestamps, versiones, etc.
    // Ejemplo simple: mostrar última actualización
    const settingsRef = window.firebase.doc(window.firebase.db, "settings", "club");
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
 * 💾 Guardar un usuario específico en Firebase
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

// Guardar usuario en el club en Firebase (con clubId explícito)
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

console.log('✅ firebase-sync.js cargado');