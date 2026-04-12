// ========================================
// SINCRONIZACIÓN CON FIREBASE - MULTI-CLUB CORREGIDO
// ========================================

/**
 * Comprimir imagen base64 — garantiza máximo 200KB de salida.
 * Usa un loop progresivo: baja calidad en pasos hasta lograrlo.
 * base64.length < 270000 ≈ 200KB (el encoding base64 añade ~33% overhead)
 */
function compressImageForFirebase(base64, maxWidth = 300, quality = 0.7) {
  return new Promise((resolve) => {
    if (!base64 || !base64.startsWith('data:image')) {
      resolve('');
      return;
    }

    // Si ya está bajo el límite no hace falta tocarla
    const TARGET = 270000; // ≈ 200KB
    if (base64.length <= TARGET) {
      resolve(base64);
      return;
    }

    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Redimensionar si supera el ancho máximo
      if (width > maxWidth) {
        height = Math.round(height * maxWidth / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Loop progresivo: baja calidad de 0.7 hasta 0.2 en pasos de 0.1
      let result = base64;
      let q = quality;
      while (q >= 0.2) {
        result = canvas.toDataURL('image/jpeg', q);
        if (result.length <= TARGET) break;
        q = Math.round((q - 0.1) * 10) / 10;
      }

      // Si aún supera el límite, reducir dimensiones y comprimir al mínimo
      if (result.length > TARGET) {
        const reducedWidth = Math.round(width * 0.6);
        const reducedHeight = Math.round(height * 0.6);
        canvas.width = reducedWidth;
        canvas.height = reducedHeight;
        ctx.drawImage(img, 0, 0, reducedWidth, reducedHeight);
        result = canvas.toDataURL('image/jpeg', 0.2);
      }

      console.log(`[IMG] ${Math.round(base64.length / 1024)}KB → ${Math.round(result.length / 1024)}KB`);
      resolve(result);
    };

    img.onerror = function() {
      console.warn('[IMG] Error al comprimir, usando original');
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
    // Solo mostrar toast si la app lleva más de 8 segundos cargada
    // (en móviles lentos Firebase tarda más en iniciar)
    if (!window._appStartTime || (Date.now() - window._appStartTime) > 8000) {
      showToast('⚠️ Firebase no está listo. Espera unos segundos.');
    }
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
 * Procesa un array de items en lotes paralelos.
 * chunkSize controla cuántos se suben a la vez para no saturar Firebase ni el CPU.
 * Usa Promise.allSettled para que un error en un item no detenga los demás.
 * Devuelve la cantidad de items procesados exitosamente.
 */
async function processInChunks(items, chunkSize, processor) {
  let successCount = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const results = await Promise.allSettled(chunk.map(processor));
    successCount += results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  }
  return successCount;
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

    // 2️⃣ Jugadores - lotes de 5 (tienen compresión de imagen, pesado para el CPU)
    const players = (getAllPlayers() || []).filter(p => p.id);
    const playersCount = await processInChunks(players, 5, async (player) => {
      const preparedPlayer = await preparePlayerForFirebase(player);
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, preparedPlayer.id),
        preparedPlayer
      );
      return true;
    });
    console.log(`✅ ${playersCount} jugadores subidos`);
    syncedItems.push(`${playersCount} jugadores`);

    // 3️⃣ Pagos - lotes de 20 (sin compresión, más rápido)
    const payments = (getPayments() || []).filter(p => p.id);
    const paymentsCount = await processInChunks(payments, 20, async (payment) => {
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/payments`, payment.id),
        payment
      );
      return true;
    });
    console.log(`✅ ${paymentsCount} pagos subidos`);
    syncedItems.push(`${paymentsCount} pagos`);

    // 4️⃣ Eventos - lotes de 20
    const events = (getCalendarEvents() || []).filter(e => e.id);
    const eventsCount = await processInChunks(events, 20, async (event) => {
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/events`, event.id),
        event
      );
      return true;
    });
    console.log(`✅ ${eventsCount} eventos subidos`);
    syncedItems.push(`${eventsCount} eventos`);

    // 5️⃣ Usuarios - ⚠️ SOLO ADMIN PRINCIPAL — lotes de 5 (tienen compresión de imagen)
    if (currentUser.isMainAdmin) {
      const users = (getUsers() || []).filter(u => u.id);
      const usersCount = await processInChunks(users, 5, async (user) => {
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
        return true;
      });
      console.log(`✅ ${usersCount} usuarios subidos`);
      syncedItems.push(`${usersCount} usuarios`);
    } else {
      console.log('⏭️ Gestión de usuarios omitida (solo admin principal puede agregar/eliminar usuarios)');
    }

    // 6️⃣ Egresos - lotes de 20
    const expenses = (getExpenses() || []).filter(e => e.id);
    const expensesCount = await processInChunks(expenses, 20, async (expense) => {
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/expenses`, expense.id),
        expense
      );
      return true;
    });
    console.log(`✅ ${expensesCount} egresos subidos`);
    syncedItems.push(`${expensesCount} egresos`);

    // 7️⃣ Ingresos de Terceros - lotes de 20
    const thirdPartyIncomes = (getThirdPartyIncomes() || []).filter(i => i.id);
    const thirdPartyCount = await processInChunks(thirdPartyIncomes, 20, async (income) => {
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/thirdPartyIncomes`, income.id),
        income
      );
      return true;
    });
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
    playersSnapshot.forEach(doc => players.push({ id: doc.id, ...doc.data() }));
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

async function saveCashRegisterToFirebase(cashRegister) {
  if (!checkFirebaseReady()) return false;
  const clubId = getClubId();
  if (!clubId || !cashRegister?.id) return false;

  try {
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/cash_registers`, cashRegister.id),
      cashRegister
    );
    console.log('✅ Arqueo de caja guardado en Firebase:', cashRegister.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar arqueo de caja:', error);
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

function extractInvoiceSequence(invoiceNumber) {
  if (typeof invoiceNumber !== 'string') return 0;
  const match = invoiceNumber.match(/^INV-\d{4}-(\d+)$/);
  if (!match) return 0;
  const sequence = parseInt(match[1], 10);
  return Number.isFinite(sequence) ? sequence : 0;
}

async function getMaxInvoiceSequenceFromFirebase(clubId) {
  try {
    const [paymentsSnap, voidedSnap, expensesSnap, thirdPartySnap] = await Promise.all([
      window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`)
      ),
      window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/voided_payments`)
      ),
      window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/expenses`)
      ),
      window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/thirdPartyIncomes`)
      )
    ]);

    let maxSequence = 0;
    paymentsSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const sequence = extractInvoiceSequence(data.invoiceNumber);
      if (sequence > maxSequence) maxSequence = sequence;
    });

    voidedSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const sequence = extractInvoiceSequence(data.invoiceNumber);
      if (sequence > maxSequence) maxSequence = sequence;
    });

    expensesSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const sequence = extractInvoiceSequence(data.invoiceNumber);
      if (sequence > maxSequence) maxSequence = sequence;
    });

    thirdPartySnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const sequence = extractInvoiceSequence(data.invoiceNumber);
      if (sequence > maxSequence) maxSequence = sequence;
    });

    return maxSequence;
  } catch (error) {
    console.warn('⚠️ No se pudo calcular máximo de facturas en Firebase:', error);
    return 0;
  }
}

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
    let bootstrapBase = 0;

    // Bootstrap defensivo: incluso si el contador existe, reconciliar con el mayor folio real.
    // Esto evita una ventana en primer arranque de dispositivo si el auto-sync aún no terminó.
    const counterSnap = await window.firebase.getDoc(counterRef);
    const counterValue = counterSnap.exists() ? (counterSnap.data().lastNumber || 0) : 0;
    const maxRealSequence = await getMaxInvoiceSequenceFromFirebase(clubId);
    bootstrapBase = Math.max(Number.isFinite(counterValue) ? counterValue : 0, maxRealSequence);
    
    // Usar transacción para evitar duplicados
    const newNumber = await window.firebase.runTransaction(window.firebase.db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let currentNumber = 0;
      if (counterDoc.exists()) {
        currentNumber = counterDoc.data().lastNumber || 0;
      }

      currentNumber = Math.max(currentNumber, bootstrapBase);
      
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
 * ✅ Consecutivo local (fallback) - cuenta todos los módulos con factura
 */
function getNextInvoiceNumberLocal() {
  const payments = typeof getPayments === 'function' ? (getPayments() || []) : [];
  const expenses = typeof getExpenses === 'function' ? (getExpenses() || []) : [];
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? (getThirdPartyIncomes() || []) : [];
  const allInvoices = [...payments, ...expenses, ...thirdPartyIncomes];

  const maxSequence = allInvoices.reduce((max, item) => {
    const sequence = extractInvoiceSequence(item.invoiceNumber);
    return Math.max(max, sequence);
  }, 0);

  const nextNumber = maxSequence + 1;
  const year = new Date().getFullYear();
  const invoiceNumber = `INV-${year}-${String(nextNumber).padStart(4, '0')}`;
  
  console.log('📋 Consecutivo local (global):', invoiceNumber);
  return invoiceNumber;
}

/**
 * ✅ Sincronizar contador con facturas reales en todos los módulos
 */
async function syncInvoiceCounter() {
  if (!checkFirebaseReady()) return;

  const clubId = getClubId();
  if (!clubId) return;

  try {
    const counterRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/config`, 'invoiceCounter');

    // Contar facturas actuales en Firebase
    const [paymentsSnap, voidedSnap, expensesSnap, thirdPartySnap] = await Promise.all([
      window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`)
      ),
      window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/voided_payments`)
      ),
      window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/expenses`)
      ),
      window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/thirdPartyIncomes`)
      )
    ]);
    const totalPayments = paymentsSnap.size;
    const totalVoided = voidedSnap.size;
    const totalExpenses = expensesSnap.size;
    const totalThirdParty = thirdPartySnap.size;
    let maxInvoiceSequence = 0;
    paymentsSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const sequence = extractInvoiceSequence(data.invoiceNumber);
      if (sequence > maxInvoiceSequence) maxInvoiceSequence = sequence;
    });
    voidedSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const sequence = extractInvoiceSequence(data.invoiceNumber);
      if (sequence > maxInvoiceSequence) maxInvoiceSequence = sequence;
    });
    expensesSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const sequence = extractInvoiceSequence(data.invoiceNumber);
      if (sequence > maxInvoiceSequence) maxInvoiceSequence = sequence;
    });
    thirdPartySnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const sequence = extractInvoiceSequence(data.invoiceNumber);
      if (sequence > maxInvoiceSequence) maxInvoiceSequence = sequence;
    });

    // Leer el contador actual en Firebase
    const counterSnap = await window.firebase.getDoc(counterRef);
    const currentCounter = counterSnap.exists() ? (counterSnap.data().lastNumber || 0) : 0;

    // El contador NUNCA retrocede — se alinea por el folio más alto existente.
    // Esto evita retrocesos cuando hay huecos por anulaciones/eliminaciones.
    const safeNumber = Math.max(currentCounter, maxInvoiceSequence);

    await window.firebase.setDoc(counterRef, {
      lastNumber: safeNumber,
      lastUpdated: new Date().toISOString(),
      syncedAt: new Date().toISOString()
    });

    console.log(`✅ Contador sincronizado: ${safeNumber} (pagos: ${totalPayments}, egresos: ${totalExpenses}, otrosIngresos: ${totalThirdParty}, anuladas: ${totalVoided}, maxFolio: ${maxInvoiceSequence}, anterior: ${currentCounter})`);
    showToast(`✅ Contador sincronizado: ${safeNumber} facturas`);

  } catch (error) {
    console.error('❌ Error al sincronizar contador:', error);
  }
}

/**
 * Guardar factura anulada en Firebase — registro permanente de auditoría
 */
async function saveVoidedPaymentToFirebase(voidedData) {
  if (!checkFirebaseReady()) return false;
  const clubId = getClubId();
  if (!clubId) return false;

  try {
    await window.firebase.addDoc(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/voided_payments`),
      voidedData
    );
    return true;
  } catch (error) {
    console.error('❌ Error guardando factura anulada:', error);
    return false;
  }
}

// Hacer funciones globales
window.getNextInvoiceNumberFromFirebase = getNextInvoiceNumberFromFirebase;
window.getNextInvoiceNumberLocal = getNextInvoiceNumberLocal;
window.syncInvoiceCounter = syncInvoiceCounter;
window.saveVoidedPaymentToFirebase = saveVoidedPaymentToFirebase;

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