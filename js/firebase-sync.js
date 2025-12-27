// ========================================
// SINCRONIZACIÓN CON FIREBASE
// ========================================

/**
 * Sube todos los datos locales a Firebase
 */
async function syncAllToFirebase() {
  if (!window.APP_STATE?.firebaseReady) {
    showToast('⚠️ Firebase no está listo. Espera unos segundos.');
    return;
  }

  try {
    console.log('📤 Sincronizando todos los datos a Firebase...');
    showToast('📤 Subiendo datos...');

    // Ejemplo: subir configuración del club
    const settings = getSchoolSettings();
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, "settings", "club"),
      settings
    );

    // Ejemplo: subir jugadores
    const players = getAllPlayers() || [];
    for (const player of players) {
      if (player.id) {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, "players", player.id),
          player
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
 * Descarga todos los datos desde Firebase
 */
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
    saveAllPlayers(players); // Debes implementar esta función

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
  if (!window.APP_STATE?.firebaseReady) {
    showToast('⚠️ Firebase no está listo.');
    return;
  }

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

console.log('✅ firebase-sync.js cargado');