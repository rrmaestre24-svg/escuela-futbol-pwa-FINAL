// ========================================
// SINCRONIZACIÓN CON FIREBASE
// ========================================

// --- FUNCIONES AUXILIARES (obtienen datos de tu app) ---

function getSchoolSettings() {
  const settings = localStorage.getItem('schoolSettings');
  return settings ? JSON.parse(settings) : {
    name: 'MY CLUB',
    logo: '',
    primaryColor: '#ff0000',
    foundedYear: 2013,
    monthlyFee: 3232
  };
}

function getAllPlayers() {
  const players = localStorage.getItem('players');
  return players ? JSON.parse(players) : [];
}

function saveSchoolSettings(settings) {
  localStorage.setItem('schoolSettings', JSON.stringify(settings));
}

function saveAllPlayers(players) {
  localStorage.setItem('players', JSON.stringify(players));
}

// --- SUBIR DATOS A FIREBASE ---

async function syncAllToFirebase() {
  if (!window.APP_STATE?.firebaseReady) {
    showToast('⚠️ Firebase no está listo. Espera unos segundos.');
    return;
  }

  try {
    console.log('📤 Subiendo todos los datos a Firebase...');
    showToast('📤 Subiendo datos a Firebase...');

    // Subir configuración del club
    const settings = getSchoolSettings();
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, "settings", "club"),
      { ...settings, lastUpdated: new Date().toISOString() }
    );

    // Subir jugadores
    const players = getAllPlayers();
    for (const player of players) {
      if (player.id) {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, "players", player.id),
          player
        );
      }
    }

    console.log('✅ Datos subidos correctamente a Firebase');
    showToast('✅ ¡Datos sincronizados con Firebase!');
  } catch (error) {
    console.error('❌ Error al subir datos:', error);
    showToast('⚠️ Error al subir datos a Firebase');
  }
}

// --- DESCARGAR DATOS DE FIREBASE ---

async function downloadFromFirebase() {
  if (!window.APP_STATE?.firebaseReady) {
    showToast('⚠️ Firebase no está listo.');
    return;
  }

  try {
    console.log('📥 Descargando datos desde Firebase...');
    showToast('📥 Descargando datos...');

    // Descargar configuración
    const settingsRef = window.firebase.doc(window.firebase.db, "settings", "club");
    const settingsSnap = await window.firebase.getDoc(settingsRef);
    if (settingsSnap.exists()) {
      saveSchoolSettings(settingsSnap.data());
    }

    // Descargar jugadores
    const playersSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, "players")
    );
    const players = [];
    playersSnapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    saveAllPlayers(players);

    console.log('✅ Datos descargados y guardados localmente');
    showToast('✅ Datos actualizados desde Firebase');
    location.reload(); // Opcional: recargar para ver cambios
  } catch (error) {
    console.error('❌ Error al descargar datos:', error);
    showToast('⚠️ Error al descargar de Firebase');
  }
}

// --- VERIFICAR ACTUALIZACIONES ---

async function checkForUpdates() {
  if (!window.APP_STATE?.firebaseReady) {
    showToast('⚠️ Firebase no está listo.');
    return;
  }

  try {
    console.log('🔍 Buscando actualizaciones...');
    showToast('🔍 Buscando actualizaciones...');

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

console.log('✅ firebase-sync.js cargado');