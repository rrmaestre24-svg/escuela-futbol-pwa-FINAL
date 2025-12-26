// ========================================
// SINCRONIZACIÓN CON FIREBASE
// ========================================

let isSyncing = false;

// Guardar datos en Firebase
async function saveToFirebase(collectionName, documentId, data) {
  if (!window.firebase || !window.firebase.db) {
    console.warn('⚠️ Firebase no está inicializado');
    return false;
  }
  
  try {
    const { db, collection, doc, setDoc } = window.firebase;
    const currentUser = getCurrentUser();
    
    if (!currentUser || !currentUser.schoolId) {
      console.error('❌ No hay usuario con schoolId');
      return false;
    }
    
    // Agregar schoolId y timestamp a los datos
    const dataToSave = {
      ...data,
      schoolId: currentUser.schoolId,
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(doc(collection(db, collectionName), documentId), dataToSave);
    console.log(`✅ Guardado en Firebase: ${collectionName}/${documentId}`);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar en Firebase:', error);
    return false;
  }
}

// Obtener datos de Firebase
async function getFromFirebase(collectionName, documentId) {
  if (!window.firebase || !window.firebase.db) {
    console.warn('⚠️ Firebase no está inicializado');
    return null;
  }
  
  try {
    const { db, collection, doc, getDoc } = window.firebase;
    const docRef = doc(collection(db, collectionName), documentId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log(`ℹ️ Documento no existe: ${collectionName}/${documentId}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error al leer de Firebase:', error);
    return null;
  }
}

// Obtener todos los documentos de una colección
async function getAllFromFirebase(collectionName) {
  if (!window.firebase || !window.firebase.db) {
    console.warn('⚠️ Firebase no está inicializado');
    return [];
  }
  
  try {
    const { db, collection, getDocs, query, where } = window.firebase;
    const currentUser = getCurrentUser();
    
    if (!currentUser || !currentUser.schoolId) {
      console.error('❌ No hay usuario con schoolId');
      return [];
    }
    
    const q = query(
      collection(db, collectionName),
      where('schoolId', '==', currentUser.schoolId)
    );
    
    const querySnapshot = await getDocs(q);
    const data = [];
    
    querySnapshot.forEach((doc) => {
      data.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Obtenidos ${data.length} documentos de ${collectionName}`);
    return data;
  } catch (error) {
    console.error('❌ Error al obtener datos de Firebase:', error);
    return [];
  }
}

// Eliminar de Firebase
async function deleteFromFirebase(collectionName, documentId) {
  if (!window.firebase || !window.firebase.db) {
    console.warn('⚠️ Firebase no está inicializado');
    return false;
  }
  
  try {
    const { db, collection, doc, deleteDoc } = window.firebase;
    await deleteDoc(doc(collection(db, collectionName), documentId));
    console.log(`✅ Eliminado de Firebase: ${collectionName}/${documentId}`);
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar de Firebase:', error);
    return false;
  }
}

// Sincronizar todos los datos locales a Firebase
async function syncAllToFirebase() {
  if (isSyncing) {
    console.log('⏳ Ya hay una sincronización en proceso');
    return;
  }
  
  if (!window.firebase || !window.firebase.db) {
    showToast('❌ Firebase no está conectado');
    return;
  }
  
  isSyncing = true;
  showToast('🔄 Sincronizando con Firebase...');
  
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.schoolId) {
      showToast('❌ No hay usuario activo');
      isSyncing = false;
      return;
    }
    
    let count = 0;
    
    // Sincronizar jugadores
    const players = getPlayers();
    for (const player of players) {
      await saveToFirebase('players', player.id, player);
      count++;
    }
    
    // Sincronizar pagos
    const payments = getPayments();
    for (const payment of payments) {
      await saveToFirebase('payments', payment.id, payment);
      count++;
    }
    
    // Sincronizar eventos
    const events = getCalendarEvents();
    for (const event of events) {
      await saveToFirebase('events', event.id, event);
      count++;
    }
    
    // Sincronizar configuración de la escuela
    const settings = getSchoolSettings();
    await saveToFirebase('schools', currentUser.schoolId, settings);
    count++;
    
    showToast(`✅ ${count} elementos sincronizados`);
    console.log(`✅ ${count} elementos sincronizados con Firebase`);
  } catch (error) {
    console.error('❌ Error en sincronización:', error);
    showToast('❌ Error al sincronizar');
  } finally {
    isSyncing = false;
  }
}

// Descargar todos los datos de Firebase
async function syncAllFromFirebase() {
  if (isSyncing) {
    console.log('⏳ Ya hay una sincronización en proceso');
    return;
  }
  
  if (!window.firebase || !window.firebase.db) {
    showToast('❌ Firebase no está conectado');
    return;
  }
  
  isSyncing = true;
  showToast('📥 Descargando datos de Firebase...');
  
  try {
    let count = 0;
    
    // Obtener jugadores
    const players = await getAllFromFirebase('players');
    if (players.length > 0) {
      localStorage.setItem('players', JSON.stringify(players));
      count += players.length;
    }
    
    // Obtener pagos
    const payments = await getAllFromFirebase('payments');
    if (payments.length > 0) {
      localStorage.setItem('payments', JSON.stringify(payments));
      count += payments.length;
    }
    
    // Obtener eventos
    const events = await getAllFromFirebase('events');
    if (events.length > 0) {
      localStorage.setItem('calendarEvents', JSON.stringify(events));
      count += events.length;
    }
    
    showToast(`✅ ${count} elementos descargados`);
    console.log(`✅ ${count} elementos descargados de Firebase`);
    
    // Recargar la página para actualizar todo
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error) {
    console.error('❌ Error al descargar datos:', error);
    showToast('❌ Error al descargar datos');
  } finally {
    isSyncing = false;
  }
}

console.log('✅ firebase-sync.js cargado');