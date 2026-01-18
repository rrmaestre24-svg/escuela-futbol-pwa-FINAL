// ========================================
// SINCRONIZACIÓN CON FIREBASE - MULTI-CLUB CORREGIDO
// ========================================

/**
 * ✅ Comprimir imagen base64 para Firebase (máximo 800KB)
 */
function compressImageForFirebase(base64, maxWidth = 400, quality = 0.6) {
  return new Promise((resolve) => {
    // Si no es una imagen base64, devolver vacío
    if (!base64 || !base64.startsWith('data:image')) {
      resolve('');
      return;
    }
    
    // Si ya es pequeña (menos de 500KB), no comprimir
    if (base64.length < 500000) {
      resolve(base64);
      return;
    }
    
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // Redimensionar si es muy grande
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Comprimir a JPEG con calidad reducida
      const compressed = canvas.toDataURL('image/jpeg', quality);
      console.log(`🗜️ Imagen comprimida: ${Math.round(base64.length/1024)}KB → ${Math.round(compressed.length/1024)}KB`);
      resolve(compressed);
    };
    
    img.onerror = function() {
      console.warn('⚠️ Error al comprimir imagen, usando original');
      resolve(base64);
    };
    
    img.src = base64;
  });
}

/**
 * ✅ Preparar jugador para Firebase (comprimir avatar)
 */
async function preparePlayerForFirebase(player) {
  if (!player) return player;
  
  const prepared = { ...player };
  
  // Comprimir avatar si existe y es muy grande
  if (prepared.avatar && prepared.avatar.length > 500000) {
    console.log(`🗜️ Comprimiendo avatar de jugador: ${prepared.name || prepared.id}`);
    prepared.avatar = await compressImageForFirebase(prepared.avatar, 300, 0.5);
  }
  
  // Comprimir foto si existe
  if (prepared.photo && prepared.photo.length > 500000) {
    prepared.photo = await compressImageForFirebase(prepared.photo, 300, 0.5);
  }
  
  return prepared;
}

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

    // 1️⃣ Configuración del club - ⚠️ SOLO ADMIN PRINCIPAL puede editar settings
    if (currentUser.isMainAdmin) {
      const settings = getSchoolSettings();
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, "main"),
        { ...settings, lastUpdated: new Date().toISOString() }
      );
      console.log('✅ Configuración del club subida');
      syncedItems.push('configuración');
    } else {
      console.log('⏭️ Configuración del club omitida (solo admin principal puede editarla)');
    }

    // 2️⃣ Jugadores - ✅ TODOS LOS ADMINS (con compresión de avatar)
    const players = getAllPlayers() || [];
    let playersCount = 0;
    for (const player of players) {
      if (player.id) {
        // ✅ Comprimir avatar antes de subir
        const preparedPlayer = await preparePlayerForFirebase(player);
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, preparedPlayer.id),
          preparedPlayer
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

    // 5️⃣ Usuarios - ⚠️ SOLO ADMIN PRINCIPAL puede sincronizar usuarios
    if (currentUser.isMainAdmin) {
      const users = getUsers() || [];
      let usersCount = 0;
      for (const user of users) {
        if (user.id) {
          // ✅ Comprimir avatar de usuario si es muy grande
          let compressedAvatar = user.avatar || '';
          if (compressedAvatar && compressedAvatar.length > 500000) {
            compressedAvatar = await compressImageForFirebase(compressedAvatar, 300, 0.5);
          }
          
          await window.firebase.setDoc(
            window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, user.id),
            {
              id: user.id,
              email: user.email,
              name: user.name,
              isMainAdmin: user.isMainAdmin || false,
              role: user.role || 'admin',
              avatar: compressedAvatar,
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
      console.log('⏭️ Gestión de usuarios omitida (solo admin principal puede agregar/eliminar usuarios)');
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

    // 7️⃣ Ingresos de Terceros
    const thirdPartyIncomes = getThirdPartyIncomes() || [];
    let thirdPartyCount = 0;
    for (const income of thirdPartyIncomes) {
      if (income.id) {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/thirdPartyIncomes`, income.id),
          income
        );
        thirdPartyCount++;
      }
    }
    console.log(`✅ ${thirdPartyCount} otros ingresos subidos`);
    syncedItems.push(`${thirdPartyCount} otros ingresos`);

    console.log('✅ Sincronización completada');
    showToast(`✅ Datos subidos: ${syncedItems.join(', ')}`);
  } catch (error) {
    console.error('❌ Error al sincronizar:', error);
    showToast('⚠️ Error al subir datos: ' + error.message);
  }
}

/**
 * ✅ Descarga todos los datos desde Firebase - CORREGIDO CON RE-SYNC DE CONTADOR
 */
async function downloadFromFirebase() {
  if (!checkFirebaseReady()) return;

  const clubId = getClubId();
  if (!clubId) {
    showToast('❌ No se puede descargar sin clubId');
    return;
  }

  try {
    console.log('📥 Descargando datos desde Firebase...');
    console.log('📥 Club ID:', clubId);
    showToast('📥 Descargando datos...');

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

   // 7️⃣ Ingresos de Terceros
    const thirdPartySnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/thirdPartyIncomes`)
    );
    const thirdPartyIncomes = [];
    thirdPartySnapshot.forEach(doc => thirdPartyIncomes.push(doc.data()));
    localStorage.setItem('thirdPartyIncomes', JSON.stringify(thirdPartyIncomes));
    console.log(`✅ ${thirdPartyIncomes.length} otros ingresos descargados`);

    // ✅ 8️⃣ IMPORTANTE: Limpiar marca de sincronización y re-sincronizar contador
    const syncKey = `counterSynced_${clubId}`;
    localStorage.removeItem(syncKey);
    console.log('🔄 Forzando re-sincronización del contador de facturas...');
    
    // Re-sincronizar el contador con la cantidad real de facturas de pagos
    if (typeof syncInvoiceCounter === 'function') {
      await syncInvoiceCounter();
    }

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
    // ✅ Comprimir avatar antes de guardar
    const preparedPlayer = await preparePlayerForFirebase(player);
    
    // ✅ RUTA CORREGIDA
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, preparedPlayer.id),
      preparedPlayer
    );
    console.log('✅ Jugador guardado en Firebase:', preparedPlayer.id);
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

async function saveThirdPartyIncomeToFirebase(income) {
  if (!checkFirebaseReady()) return false;
  const clubId = getClubId();
  if (!clubId || !income?.id) return false;

  try {
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/thirdPartyIncomes`, income.id),
      income
    );
    console.log('✅ Otro ingreso guardado en Firebase:', income.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar otro ingreso:', error);
    return false;
  }
}

async function deleteThirdPartyIncomeFromFirebase(incomeId) {
  if (!checkFirebaseReady()) return false;
  const clubId = getClubId();
  if (!clubId || !incomeId) return false;

  try {
    await window.firebase.deleteDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/thirdPartyIncomes`, incomeId)
    );
    console.log('✅ Otro ingreso eliminado de Firebase:', incomeId);
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar otro ingreso:', error);
    return false;
  }
}

console.log('✅ firebase-sync.js cargado (MULTI-CLUB CON PERMISOS POR ROL)');

// ========================================
// 🆕 CONSECUTIVO DE FACTURA EN FIREBASE
// ========================================

/**
 * Obtener el siguiente número de factura desde Firebase (único para todos los dispositivos)
 */
async function getNextInvoiceNumberFromFirebase() {
  if (!checkFirebaseReady()) {
    console.warn('⚠️ Firebase no listo, usando consecutivo local');
    return getNextInvoiceNumberLocal();
  }

  const clubId = getClubId();
  if (!clubId) {
    console.warn('⚠️ No hay clubId, usando consecutivo local');
    return getNextInvoiceNumberLocal();
  }

  try {
    const counterRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/config`, 'invoiceCounter');
    
    // Usar transacción para evitar duplicados
    const newNumber = await window.firebase.runTransaction(window.firebase.db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let currentNumber = 0;
      if (counterDoc.exists()) {
        currentNumber = counterDoc.data().lastNumber || 0;
      }
      
      const nextNumber = currentNumber + 1;
      
      transaction.set(counterRef, {
        lastNumber: nextNumber,
        lastUpdated: new Date().toISOString()
      });
      
      return nextNumber;
    });

    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(newNumber).padStart(4, '0')}`;
    
    console.log('✅ Consecutivo desde Firebase:', invoiceNumber);
    return invoiceNumber;

  } catch (error) {
    console.error('❌ Error al obtener consecutivo de Firebase:', error);
    return getNextInvoiceNumberLocal();
  }
}

/**
 * ✅ Consecutivo local (fallback) - SOLO CUENTA PAYMENTS
 */
function getNextInvoiceNumberLocal() {
  const year = new Date().getFullYear();
  const payments = getPayments() || []; // ✅ Solo pagos de jugadores
  
  // ✅ Contar solo facturas de pagos de este año
  const invoicesThisYear = payments.filter(item => 
    item.invoiceNumber && item.invoiceNumber.includes(year.toString())
  );
  
  const nextNumber = invoicesThisYear.length + 1;
  const invoiceNumber = `INV-${year}-${String(nextNumber).padStart(4, '0')}`;
  
  console.log('📋 Consecutivo local (payments):', invoiceNumber);
  return invoiceNumber;
}

/**
 * ✅ Sincronizar contador con la cantidad real de facturas - SOLO PAYMENTS
 */
async function syncInvoiceCounter() {
  if (!checkFirebaseReady()) return;

  const clubId = getClubId();
  if (!clubId) return;

  try {
    // ✅ Contar SOLO las facturas de payments (pagos de jugadores)
    const paymentsSnap = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`)
    );

    const totalInvoices = paymentsSnap.size; // ✅ Solo facturas de pagos

    console.log(`📊 Facturas de pagos en Firebase: ${totalInvoices}`);

    // Actualizar contador
    const counterRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/config`, 'invoiceCounter');
    await window.firebase.setDoc(counterRef, {
      lastNumber: totalInvoices,
      lastUpdated: new Date().toISOString(),
      syncedAt: new Date().toISOString()
    });

    console.log(`✅ Contador sincronizado: ${totalInvoices} facturas de pago`);
    showToast(`✅ Contador sincronizado: ${totalInvoices} facturas de pago`);

  } catch (error) {
    console.error('❌ Error al sincronizar contador:', error);
  }
}

// Hacer funciones globales
window.getNextInvoiceNumberFromFirebase = getNextInvoiceNumberFromFirebase;
window.getNextInvoiceNumberLocal = getNextInvoiceNumberLocal;
window.syncInvoiceCounter = syncInvoiceCounter;

// ========================================
// 🔄 SINCRONIZACIÓN AUTOMÁTICA DEL CONTADOR
// (Solo se ejecuta la primera vez por dispositivo)
// ========================================
window.addEventListener('load', async () => {
  // Esperar 2 segundos para que Firebase esté completamente listo
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Verificar que Firebase esté listo
  if (!checkFirebaseReady()) {
    console.log('⏳ Firebase aún no está listo, saltando sincronización');
    return;
  }

  const clubId = getClubId();
  if (!clubId) {
    console.log('⏳ No hay clubId aún, saltando sincronización');
    return;
  }

  // Verificar si ya se sincronizó antes en este dispositivo
  const syncKey = `counterSynced_${clubId}`;
  if (localStorage.getItem(syncKey)) {
    console.log('✅ Contador ya sincronizado anteriormente en este dispositivo');
    return;
  }

  console.log('🔄 Sincronizando contador automáticamente por primera vez...');
  
  try {
    // Verificar que la función exista antes de llamarla
    if (typeof window.syncInvoiceCounter !== 'function') {
      console.error('❌ syncInvoiceCounter no está disponible aún');
      return;
    }
    
    await window.syncInvoiceCounter();
    
    // Marcar como sincronizado para este dispositivo
    localStorage.setItem(syncKey, new Date().toISOString());
    
    console.log('✅ Sincronización automática completada');
    
  } catch (error) {
    console.error('❌ Error en sincronización automática:', error);
    // No marcamos como sincronizado, para que lo intente de nuevo
  }
});