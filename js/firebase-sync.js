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

    // 8️⃣ Log de Movimientos de Pagos - lotes de 20
    const logEntries = (typeof getPaymentLog === 'function' ? getPaymentLog() : []).filter(e => e.id);
    const logCount = await processInChunks(logEntries, 20, async (entry) => {
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/paymentMovementLog`, entry.id),
        entry
      );
      return true;
    });
    console.log(`✅ ${logCount} entradas del log de movimientos subidas`);
    syncedItems.push(`${logCount} mov. de pagos`);

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

    // 3️⃣ Pagos — filtro 12 meses para evitar lecturas masivas
    const _dlCutoff = new Date();
    _dlCutoff.setFullYear(_dlCutoff.getFullYear() - 1);
    const _dlCutoffStr = _dlCutoff.toISOString().split('T')[0];
    const paymentsSnapshot = await window.firebase.getDocs(
      window.firebase.query(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`),
        window.firebase.where('dueDate', '>=', _dlCutoffStr)
      )
    );
    const payments = [];
    paymentsSnapshot.forEach(doc => payments.push({ id: doc.id, ...doc.data() }));
    // ✅ Resetear flag de historial completo al descargar
    localStorage.removeItem('paymentsFullHistory');
    localStorage.setItem('payments', JSON.stringify(payments));
    console.log(`✅ ${payments.length} pagos descargados (últimos 12 meses desde ${_dlCutoffStr})`);

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

    // 8️⃣ Log de Movimientos de Pagos
    const logSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/paymentMovementLog`)
    );
    const logEntries = [];
    logSnapshot.forEach(doc => logEntries.push(doc.data()));
    logEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    localStorage.setItem('paymentMovementLog', JSON.stringify(logEntries.slice(0, 500)));
    console.log(`✅ ${logEntries.length} entradas del log de movimientos descargadas`);

    // ✅ 9️⃣ Tras descarga completa, forzar una reconciliación del contador
    // para evitar desfases entre dispositivos sin perder la optimización diaria
    if (typeof syncInvoiceCounter === 'function') {
      await syncInvoiceCounter({ force: true });
    }

    showToast(`✅ Datos descargados: ${players.length} jugadores, ${payments.length} pagos, ${events.length} eventos, ${users.length} usuarios, ${expenses.length} egresos`);

    // Preguntar antes de recargar para no perder datos en formularios abiertos
    if (typeof showAppConfirm === 'function') {
      const ok = await showAppConfirm(
        'Datos sincronizados correctamente.\n¿Recargar la app ahora para aplicar los cambios?',
        { confirmText: 'Recargar ahora', cancelText: 'Después', type: 'success' }
      );
      if (ok) location.reload();
    } else {
      setTimeout(() => location.reload(), 1500);
    }
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
 * ✅ Guardar jugador individual (Firebase o Supabase según MODO_SUPABASE)
 */
async function savePlayerToFirebase(player) {
  const clubId = getClubId();
  if (!clubId || !player?.id) { console.error('❌ Club ID o player ID faltante'); return false; }

  if (window.MODO_SUPABASE) {
    return _supaUpsertOne('players', {
      id: player.id, club_id: clubId,
      name: player.name || '', status: player.status || 'Activo',
      category: player.category || null, birth_date: player.birthDate || null,
      jersey_number: player.jerseyNumber || null, document_type: player.documentType || null,
      document_number: player.documentNumber || null, phone: player.phone || null,
      email: player.email || null, address: player.address || null,
      emergency_contact: player.emergencyContact || null, position: player.position || null,
      enrollment_date: player.enrollmentDate || null, medical_info: player.medicalInfo || null,
      documents: player.documents || null,
      portal_access_revokes_at: player.portalAccessRevokesAt || null,
      last_inactivated_at: player.lastInactivatedAt || null,
      deleted: player.deleted || false, updated_at: new Date().toISOString(),
    });
  }

  if (!checkFirebaseReady()) return false;
  try {
    const preparedPlayer = await preparePlayerForFirebase(player);
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, preparedPlayer.id),
      { ...preparedPlayer, updatedAt: new Date().toISOString() }
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
async function saveSchoolSettingsToFirebase(settings) {
  if (!checkFirebaseReady()) return false;

  const clubId = getClubId();
  if (!clubId || !settings) return false;

  try {
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, 'main'),
      { ...settings, lastUpdated: new Date().toISOString() }
    );
    // Sincronizar coachCode/adminCode por separado para la App de Asistencia
    if (settings.coachCode !== undefined) {
      const attendanceCode = settings.coachCode || '';
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, 'attendance'),
        {
          coachCode: attendanceCode,
          adminCode: attendanceCode,
          updatedAt: new Date().toISOString()
        }
      );
    }
    console.log('✅ Configuración del club guardada en Firebase');
    return true;
  } catch (error) {
    console.warn('⚠️ No se pudo sincronizar configuración:', error);
    return false;
  }
}
window.saveSchoolSettingsToFirebase = saveSchoolSettingsToFirebase;

async function savePaymentToFirebase(payment) {
  const clubId = getClubId();
  if (!clubId || !payment?.id) { console.error('❌ Club ID o payment ID faltante'); return false; }

  if (window.MODO_SUPABASE) {
    return _supaUpsertOne('payments', {
      id: payment.id, club_id: clubId, player_id: payment.playerId || null,
      concept: payment.concept || null, type: payment.type || null,
      status: payment.status || 'Pendiente', amount: payment.amount || 0,
      due_date: payment.dueDate || null, paid_date: payment.paidDate || null,
      method: payment.method || null, invoice_number: payment.invoiceNumber || null,
      notes: payment.notes || null, deleted: payment.deleted || false,
      updated_at: new Date().toISOString(),
    });
  }

  if (!checkFirebaseReady()) return false;
  try {
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/payments`, payment.id),
      { ...payment, updatedAt: new Date().toISOString() }
    );
    console.log('✅ Pago guardado en Firebase:', payment.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar pago:', error);
    return false;
  }
}

/**
 * ✅ Guardar evento individual (Firebase o Supabase según MODO_SUPABASE)
 */
async function saveEventToFirebase(event) {
  const clubId = getClubId();
  if (!clubId || !event?.id) { console.error('❌ Club ID o event ID faltante'); return false; }

  if (window.MODO_SUPABASE) {
    return _supaUpsertOne('events', {
      id: event.id, club_id: clubId, title: event.title || '',
      date: event.date || null, time: event.time || null,
      description: event.description || null, location: event.location || null,
      deleted: event.deleted || false, updated_at: new Date().toISOString(),
    });
  }

  if (!checkFirebaseReady()) return false;
  try {
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/events`, event.id),
      { ...event, updatedAt: new Date().toISOString() }
    );
    console.log('✅ Evento guardado en Firebase:', event.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar evento:', error);
    return false;
  }
}

/**
 * ✅ Guardar usuario en el club (Firebase o Supabase según MODO_SUPABASE)
 */
async function saveUserToClubInFirebase(user) {
  const clubId = getClubId();
  if (!clubId || !user?.id) { console.error('❌ Club ID o user ID faltante'); return false; }

  if (window.MODO_SUPABASE) {
    return _supaUpsertOne('users', {
      id: user.id, club_id: clubId, email: user.email || '', name: user.name || '',
      is_main_admin: user.isMainAdmin || false, phone: user.phone || null,
      birth_date: user.birthDate || null,
      deleted: user.deleted || false, updated_at: new Date().toISOString(),
    });
  }

  if (!checkFirebaseReady()) return false;
  try {
    const userRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, user.id);
    await window.firebase.setDoc(userRef, {
      id: user.id, email: user.email, name: user.name,
      isMainAdmin: user.isMainAdmin || false, role: user.role || 'admin',
      avatar: user.avatar || '', phone: user.phone || '',
      birthDate: user.birthDate || '', joinedAt: user.createdAt || new Date().toISOString()
    });
    console.log('✅ Usuario guardado en Firebase:', user.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar usuario en Firebase:', error);
    return false;
  }
}

/**
 * ✅ Guardar usuario en el club con clubId explícito (Firebase o Supabase según MODO_SUPABASE)
 */
async function saveUserToClubInFirebaseWithClubId(user, explicitClubId) {
  const clubId = explicitClubId || getClubId();
  if (!clubId || !user?.id) { console.error('❌ Club ID o user ID faltante'); return false; }

  if (window.MODO_SUPABASE) {
    return _supaUpsertOne('users', {
      id: user.id, club_id: clubId, email: user.email || '', name: user.name || '',
      is_main_admin: user.isMainAdmin || false, phone: user.phone || null,
      birth_date: user.birthDate || null,
      deleted: user.deleted || false, updated_at: new Date().toISOString(),
    });
  }

  if (!checkFirebaseReady()) return false;
  try {
    const userRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, user.id);
    await window.firebase.setDoc(userRef, {
      id: user.id, email: user.email, name: user.name,
      isMainAdmin: user.isMainAdmin || false, role: user.role || 'admin',
      avatar: user.avatar || '', phone: user.phone || '',
      birthDate: user.birthDate || '', joinedAt: new Date().toISOString()
    });
    console.log('✅ Usuario guardado en club:', clubId, user.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar usuario en club:', error);
    return false;
  }
}

/**
 * ✅ Eliminar jugador — soft delete (Firebase o Supabase según MODO_SUPABASE)
 */
async function deletePlayerFromFirebase(playerId) {
  const clubId = getClubId();
  if (!clubId || !playerId) { console.error('❌ Club ID o player ID faltante'); return false; }

  if (window.MODO_SUPABASE) {
    return _supaPatch('players', playerId, clubId, { deleted: true });
  }

  if (!checkFirebaseReady()) return false;
  try {
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, playerId),
      { deleted: true, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    console.log('✅ Jugador eliminado (soft) de Firebase:', playerId);
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar jugador:', error);
    return false;
  }
}

/**
 * ✅ Eliminar pago — soft delete (Firebase o Supabase según MODO_SUPABASE)
 */
async function deletePaymentFromFirebase(paymentId) {
  const clubId = getClubId();
  if (!clubId || !paymentId) { console.error('❌ Club ID o payment ID faltante'); return false; }

  if (window.MODO_SUPABASE) {
    return _supaPatch('payments', paymentId, clubId, { deleted: true });
  }

  if (!checkFirebaseReady()) return false;
  try {
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/payments`, paymentId),
      { deleted: true, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    console.log('✅ Pago eliminado (soft) de Firebase:', paymentId);
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar pago:', error);
    return false;
  }
}

/**
 * ✅ Eliminar evento — soft delete (Firebase o Supabase según MODO_SUPABASE)
 */
async function deleteEventFromFirebase(eventId) {
  const clubId = getClubId();
  if (!clubId || !eventId) { console.error('❌ Club ID o event ID faltante'); return false; }

  if (window.MODO_SUPABASE) {
    return _supaPatch('events', eventId, clubId, { deleted: true });
  }

  if (!checkFirebaseReady()) return false;
  try {
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/events`, eventId),
      { deleted: true, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    console.log('✅ Evento eliminado (soft) de Firebase:', eventId);
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar evento:', error);
    return false;
  }
}

/**
 * ✅ Guardar egreso individual (Firebase o Supabase según MODO_SUPABASE)
 */
async function saveExpenseToFirebase(expense) {
  const clubId = getClubId();
  if (!clubId || !expense?.id) { console.error('❌ Club ID o expense ID faltante'); return false; }

  if (window.MODO_SUPABASE) {
    return _supaUpsertOne('expenses', {
      id: expense.id, club_id: clubId, concept: expense.concept || '',
      amount: expense.amount || 0, date: expense.date || null,
      category: expense.category || null, description: expense.description || null,
      invoice_number: expense.invoiceNumber || null,
      deleted: expense.deleted || false, updated_at: new Date().toISOString(),
    });
  }

  if (!checkFirebaseReady()) return false;
  try {
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/expenses`, expense.id),
      { ...expense, updatedAt: new Date().toISOString() }
    );
    console.log('✅ Egreso guardado en Firebase:', expense.id);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar egreso:', error);
    return false;
  }
}

/**
 * ✅ Eliminar egreso — soft delete (Firebase o Supabase según MODO_SUPABASE)
 */
async function deleteExpenseFromFirebase(expenseId) {
  const clubId = getClubId();
  if (!clubId || !expenseId) { console.error('❌ Club ID o expense ID faltante'); return false; }

  if (window.MODO_SUPABASE) {
    return _supaPatch('expenses', expenseId, clubId, { deleted: true });
  }

  if (!checkFirebaseReady()) return false;
  try {
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/expenses`, expenseId),
      { deleted: true, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    console.log('✅ Egreso eliminado (soft) de Firebase:', expenseId);
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

// ========================================
// 📋 LOG DE MOVIMIENTOS DE PAGOS — FIREBASE
// ========================================

/**
 * Guarda una sola entrada del log en Firebase (llamado en tiempo real al crear cada entrada)
 */
async function savePaymentLogEntryToFirebase(entry) {
  if (!window.APP_STATE?.firebaseReady || !window.firebase?.auth?.currentUser) return false;
  const clubId = getClubId();
  if (!clubId || !entry?.id) return false;
  try {
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/paymentMovementLog`, entry.id),
      entry
    );
    return true;
  } catch (error) {
    console.warn('⚠️ Error al guardar entrada de log en Firebase:', error);
    return false;
  }
}

/**
 * Migración única: sube todas las entradas locales existentes a Firebase.
 * Solo corre una vez por dispositivo/club (flag paymentLogFirebaseMigration_v1).
 */
async function migrateLocalPaymentLogToFirebase() {
  const clubId = getClubId();
  if (!clubId) return;
  const FLAG = `paymentLogFirebaseMigration_v1_${clubId}`;
  if (localStorage.getItem(FLAG) === 'true') return;
  if (!window.APP_STATE?.firebaseReady || !window.firebase?.auth?.currentUser) return;
  try {
    const entries = (typeof getPaymentLog === 'function' ? getPaymentLog() : []).filter(e => e.id);
    if (entries.length === 0) { localStorage.setItem(FLAG, 'true'); return; }
    console.log(`📤 Migrando ${entries.length} entradas del log de pagos a Firebase...`);
    await processInChunks(entries, 20, async (entry) => {
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/paymentMovementLog`, entry.id),
        entry
      );
      return true;
    });
    localStorage.setItem(FLAG, 'true');
    console.log(`✅ Migración del log completada: ${entries.length} entradas subidas`);
  } catch (error) {
    console.warn('⚠️ Error en migración del log de pagos:', error);
  }
}

/**
 * Limpieza única: elimina entradas 'Recuperado' con timestamps incorrectos,
 * las regenera con la fecha real del pago y sincroniza con Firebase.
 */
async function fixRecoveredPaymentLogEntries() {
  const clubId = getClubId();
  if (!clubId) return;
  const FLAG = `paymentLogRecoveredFix_v1_${clubId}`;
  if (localStorage.getItem(FLAG) === 'true') return;

  try {
    const log = typeof getPaymentLog === 'function' ? getPaymentLog() : [];
    const recovered = log.filter(e => e.action === 'Recuperado');
    if (recovered.length === 0) { localStorage.setItem(FLAG, 'true'); return; }

    console.log(`🧹 Corrigiendo ${recovered.length} entradas 'Recuperado' con fechas incorrectas...`);

    // Quitar todas las entradas 'Recuperado' del log local
    const cleaned = log.filter(e => e.action !== 'Recuperado');
    localStorage.setItem('paymentMovementLog', JSON.stringify(cleaned));

    // Re-generar con fechas correctas via fixMissingPaymentLogEntries (usa createdAt/paidDate del pago)
    localStorage.removeItem('paymentLogBackfill_v1');
    if (typeof window.fixMissingPaymentLogEntries === 'function') {
      window.fixMissingPaymentLogEntries({ force: true });
    }

    // Limpiar en Firebase: borrar los 'Recuperado' y subir el log corregido
    if (window.APP_STATE?.firebaseReady && window.firebase?.auth?.currentUser) {
      const snap = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/paymentMovementLog`)
      );
      const deleteOps = [];
      snap.forEach(doc => {
        if (doc.data().action === 'Recuperado') {
          deleteOps.push(window.firebase.deleteDoc(doc.ref));
        }
      });
      await Promise.allSettled(deleteOps);
      console.log(`🗑️ ${deleteOps.length} entradas 'Recuperado' eliminadas de Firebase`);

      // Subir el log corregido
      const correctLog = (typeof getPaymentLog === 'function' ? getPaymentLog() : []).filter(e => e.id);
      await processInChunks(correctLog, 20, async (entry) => {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/paymentMovementLog`, entry.id),
          entry
        );
        return true;
      });
      // Resetear flag de migración para que se vuelva a hacer con datos correctos
      localStorage.removeItem(`paymentLogFirebaseMigration_v1_${clubId}`);
      console.log(`✅ Log corregido subido a Firebase: ${correctLog.length} entradas`);
    }

    localStorage.setItem(FLAG, 'true');
    console.log('✅ Limpieza de entradas Recuperado completada');
  } catch (error) {
    console.warn('⚠️ Error en limpieza de log:', error);
  }
}

window.savePaymentLogEntryToFirebase = savePaymentLogEntryToFirebase;
window.migrateLocalPaymentLogToFirebase = migrateLocalPaymentLogToFirebase;
window.fixRecoveredPaymentLogEntries = fixRecoveredPaymentLogEntries;

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

function shouldRunCounterSync(clubId, { force = false } = {}) {
  if (force) return true;
  const key = `counterLastHeavySync_${clubId}`;
  const ttlMs = 24 * 60 * 60 * 1000; // 24 horas
  const last = Number(localStorage.getItem(key) || '0');
  if (!last) return true;
  return (Date.now() - last) > ttlMs;
}

function markCounterSyncRun(clubId) {
  localStorage.setItem(`counterLastHeavySync_${clubId}`, String(Date.now()));
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
    const invoiceNumber = await Promise.race([
      // Lógica principal con Firebase
      (async () => {
        const counterRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/config`, 'invoiceCounter');
        let bootstrapBase = 0;

        // Bootstrap defensivo: reconciliar con el mayor folio real SOLO cuando hace falta.
        const counterSnap = await window.firebase.getDoc(counterRef);
        const counterValue = counterSnap.exists() ? (counterSnap.data().lastNumber || 0) : 0;
        const bootstrapKey = `invoiceBootstrapDone_${clubId}`;
        const hasBootstrap = localStorage.getItem(bootstrapKey) === 'true';
        const needsBootstrap = !hasBootstrap || !counterSnap.exists() || !Number.isFinite(counterValue);

        if (needsBootstrap) {
          const maxRealSequence = await getMaxInvoiceSequenceFromFirebase(clubId);
          bootstrapBase = Math.max(Number.isFinite(counterValue) ? counterValue : 0, maxRealSequence);
        } else {
          bootstrapBase = Number.isFinite(counterValue) ? counterValue : 0;
        }

        // Transacción atómica para evitar duplicados entre dispositivos
        const newNumber = await window.firebase.runTransaction(window.firebase.db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          let currentNumber = counterDoc.exists() ? (counterDoc.data().lastNumber || 0) : 0;
          currentNumber = Math.max(currentNumber, bootstrapBase);
          const nextNumber = currentNumber + 1;
          transaction.set(counterRef, { lastNumber: nextNumber, lastUpdated: new Date().toISOString() });
          return nextNumber;
        });

        if (needsBootstrap) {
          localStorage.setItem(bootstrapKey, 'true');
        }

        const year = new Date().getFullYear();
        return `INV-${year}-${String(newNumber).padStart(4, '0')}`;
      })(),
      // Timeout de seguridad: si Firebase no responde en 10s, usar fallback local
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firebase timeout')), 10000)
      )
    ]);

    console.log('✅ Consecutivo desde Firebase:', invoiceNumber);
    return invoiceNumber;

  } catch (error) {
    console.warn('⚠️ Consecutivo Firebase falló, usando local:', error.message);
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
async function syncInvoiceCounter(options = {}) {
  if (!checkFirebaseReady()) return;

  const clubId = getClubId();
  if (!clubId) return;

  if (!shouldRunCounterSync(clubId, options)) {
    console.log('ℹ️ Sincronización pesada del contador omitida (ya ejecutada recientemente)');
    return;
  }

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

    markCounterSyncRun(clubId);

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
// ============================================================
// ☁️ SUPABASE — HELPERS + SYNC COMPLETO
// Todas estas funciones sólo se activan cuando window.MODO_SUPABASE = true.
// Con MODO_SUPABASE = false el código de Firebase se ejecuta sin cambios.
// ============================================================

/** Headers comunes para llamadas Supabase REST */
function _supaHeaders(extra = {}) {
  return {
    apikey: window.SUPA_ANON,
    Authorization: `Bearer ${window.SUPA_ANON}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/**
 * PATCH a un registro individual en Supabase.
 * data = campos a actualizar (en snake_case).
 * Siempre agrega updated_at.
 */
async function _supaPatch(table, id, clubId, data) {
  try {
    const res = await fetch(
      `${window.SUPA_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&club_id=eq.${encodeURIComponent(clubId)}`,
      {
        method: 'PATCH',
        headers: _supaHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
      }
    );
    if (!res.ok) console.warn(`⚠️ Supabase PATCH ${table}/${id}:`, await res.text());
    return res.ok;
  } catch (e) {
    console.warn(`⚠️ Supabase PATCH ${table}/${id}:`, e.message);
    return false;
  }
}

/**
 * Upsert un solo registro en Supabase (insert or update por PK).
 */
async function _supaUpsertOne(table, row) {
  try {
    const res = await fetch(`${window.SUPA_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: _supaHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(row),
    });
    if (!res.ok) console.warn(`⚠️ Supabase upsert ${table}:`, await res.text());
    return res.ok;
  } catch (e) {
    console.warn(`⚠️ Supabase upsert ${table}:`, e.message);
    return false;
  }
}

/**
 * Upsert en lotes de 50. Devuelve número de filas enviadas exitosamente.
 */
async function _supaUpsert(table, rows) {
  if (!rows || rows.length === 0) return 0;
  const BATCH = 50;
  let ok = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      const res = await fetch(`${window.SUPA_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: _supaHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(batch),
      });
      if (res.ok) ok += batch.length;
      else console.warn(`⚠️ Supabase upsert ${table}[${i}]:`, await res.text());
    } catch (e) {
      console.warn(`⚠️ Supabase upsert ${table} error:`, e.message);
    }
  }
  return ok;
}

/**
 * ✅ Sube todos los datos locales a Supabase (equivalente a syncAllToFirebase).
 * Llamar en el día del cutover después de desactivar todos los clubs.
 */
async function syncAllToSupabase() {
  const clubId = getClubId();
  if (!clubId) { showToast('❌ No se puede sincronizar sin clubId'); return; }

  const currentUser = getCurrentUser();
  if (!currentUser) { showToast('❌ No hay usuario en sesión'); return; }

  showToast('📤 Subiendo a Supabase...');
  console.log('📤 syncAllToSupabase — club:', clubId);
  const syncedItems = [];

  // 1️⃣ Jugadores (avatar_url se gestiona aparte via Storage — aquí va null o URL existente)
  const players = (getAllPlayers() || []).filter(p => p.id);
  const playerRows = players.map(p => ({
    id: p.id, club_id: clubId,
    name: p.name || '', status: p.status || 'Activo',
    category: p.category || null, birth_date: p.birthDate || null,
    jersey_number: p.jerseyNumber || null, document_type: p.documentType || null,
    document_number: p.documentNumber || null, phone: p.phone || null,
    email: p.email || null, address: p.address || null,
    emergency_contact: p.emergencyContact || null, position: p.position || null,
    enrollment_date: p.enrollmentDate || null, medical_info: p.medicalInfo || null,
    documents: p.documents || null, portal_access_revokes_at: p.portalAccessRevokesAt || null,
    last_inactivated_at: p.lastInactivatedAt || null,
    deleted: p.deleted || false, updated_at: new Date().toISOString(),
  }));
  syncedItems.push(`${await _supaUpsert('players', playerRows)} jugadores`);

  // 2️⃣ Pagos
  const payments = (getPayments() || []).filter(p => p.id);
  const paymentRows = payments.map(p => ({
    id: p.id, club_id: clubId, player_id: p.playerId || null,
    concept: p.concept || null, type: p.type || null,
    status: p.status || 'Pendiente', amount: p.amount || 0,
    due_date: p.dueDate || null, paid_date: p.paidDate || null,
    method: p.method || null, invoice_number: p.invoiceNumber || null,
    notes: p.notes || null, deleted: p.deleted || false,
    updated_at: new Date().toISOString(),
  }));
  syncedItems.push(`${await _supaUpsert('payments', paymentRows)} pagos`);

  // 3️⃣ Egresos
  const expenses = (getExpenses() || []).filter(e => e.id);
  const expenseRows = expenses.map(e => ({
    id: e.id, club_id: clubId, concept: e.concept || '',
    amount: e.amount || 0, date: e.date || null,
    category: e.category || null, description: e.description || null,
    invoice_number: e.invoiceNumber || null,
    deleted: e.deleted || false, updated_at: new Date().toISOString(),
  }));
  syncedItems.push(`${await _supaUpsert('expenses', expenseRows)} egresos`);

  // 4️⃣ Eventos
  const events = (getCalendarEvents() || []).filter(ev => ev.id);
  const eventRows = events.map(ev => ({
    id: ev.id, club_id: clubId, title: ev.title || '',
    date: ev.date || null, time: ev.time || null,
    description: ev.description || null, location: ev.location || null,
    deleted: ev.deleted || false, updated_at: new Date().toISOString(),
  }));
  syncedItems.push(`${await _supaUpsert('events', eventRows)} eventos`);

  // 5️⃣ Usuarios (solo admin principal)
  if (currentUser.isMainAdmin) {
    const users = (getUsers() || []).filter(u => u.id);
    const userRows = users.map(u => ({
      id: u.id, club_id: clubId, email: u.email || '', name: u.name || '',
      is_main_admin: u.isMainAdmin || false, phone: u.phone || null,
      birth_date: u.birthDate || null,
      deleted: u.deleted || false, updated_at: new Date().toISOString(),
    }));
    syncedItems.push(`${await _supaUpsert('users', userRows)} usuarios`);
  }

  // 6️⃣ Códigos de padres
  const parentCodes = (typeof getParentCodes === 'function' ? getParentCodes() : []).filter(pc => pc.playerId && pc.code);
  const pcRows = parentCodes.map(pc => ({
    id: pc.playerId, club_id: clubId, player_id: pc.playerId,
    code: pc.code, active: true,
    created_at: pc.createdAt || new Date().toISOString(),
  }));
  syncedItems.push(`${await _supaUpsert('parent_codes', pcRows)} códigos padres`);

  showToast(`✅ Supabase: ${syncedItems.join(', ')}`);
  console.log('✅ syncAllToSupabase completado:', syncedItems.join(', '));
}

/**
 * ✅ Descarga todos los datos del club desde Supabase al localStorage.
 * Equivalente a downloadAllClubData() pero usando Supabase REST.
 * Llamada automáticamente cuando MODO_SUPABASE = true.
 */
async function downloadAllClubDataFromSupabase(clubId, { force = false } = {}) {
  if (!clubId) {
    console.error('❌ clubId es requerido');
    showToast('❌ Error: No se encontró el ID del club');
    return false;
  }

  // LOCAL-FIRST GUARD: reutilizar caché si está fresca (mismo comportamiento que Firebase)
  // Nota: _FULL_DOWNLOAD_TTL_MS es const en auth.js (no global), usamos el mismo valor literal.
  const _SUPA_TTL_MS = 15 * 60 * 1000; // 15 minutos
  if (!force) {
    const canReuseLocal = typeof shouldReuseLocalSnapshot === 'function'
      ? shouldReuseLocalSnapshot(clubId, 'players',  { ttlMs: _SUPA_TTL_MS }) &&
        shouldReuseLocalSnapshot(clubId, 'payments', { ttlMs: _SUPA_TTL_MS }) &&
        shouldReuseLocalSnapshot(clubId, 'settings', { ttlMs: _SUPA_TTL_MS })
      : false;
    if (canReuseLocal) {
      console.log('⚡ [LOCAL-FIRST] Datos frescos en caché — omitiendo descarga de Supabase');
      showToast('⚡ Datos cargados desde caché local');
      return true;
    }
  }

  try {
    console.log('☁️ Descargando datos desde Supabase — club:', clubId);
    showToast('☁️ Sincronizando desde Supabase...');
    const h = { apikey: window.SUPA_ANON, Authorization: `Bearer ${window.SUPA_ANON}` };
    const base = `${window.SUPA_URL}/rest/v1`;
    const enc = encodeURIComponent;

    // 1️⃣ Jugadores
    const pRes = await fetch(`${base}/players?club_id=eq.${enc(clubId)}&deleted=eq.false&select=*`, { headers: h });
    if (!pRes.ok) throw new Error('Error al leer jugadores de Supabase: ' + await pRes.text());
    const pRows = await pRes.json();
    const players = pRows.map(p => ({
      id: p.id, name: p.name, status: p.status, category: p.category,
      birthDate: p.birth_date, jerseyNumber: p.jersey_number,
      documentType: p.document_type, documentNumber: p.document_number,
      phone: p.phone, email: p.email, address: p.address,
      emergencyContact: p.emergency_contact, position: p.position,
      enrollmentDate: p.enrollment_date, medicalInfo: p.medical_info,
      documents: p.documents, avatar: p.avatar_url || '',
      portalAccessRevokesAt: p.portal_access_revokes_at,
      lastInactivatedAt: p.last_inactivated_at,
      deleted: p.deleted, schoolId: clubId,
    }));
    localStorage.setItem('players', JSON.stringify(players));
    console.log(`✅ ${players.length} jugadores descargados desde Supabase`);

    // 2️⃣ Pagos (últimos 12 meses — mismo criterio que Firebase)
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const pmRes = await fetch(
      `${base}/payments?club_id=eq.${enc(clubId)}&deleted=eq.false&due_date=gte.${cutoffStr}&select=*`,
      { headers: h }
    );
    if (!pmRes.ok) throw new Error('Error al leer pagos de Supabase: ' + await pmRes.text());
    const pmRows = await pmRes.json();
    const payments = pmRows.map(p => ({
      id: p.id, playerId: p.player_id, concept: p.concept, type: p.type,
      status: p.status, amount: p.amount, dueDate: p.due_date, paidDate: p.paid_date,
      method: p.method, invoiceNumber: p.invoice_number, notes: p.notes,
      deleted: p.deleted, clubId: clubId,
    }));
    localStorage.removeItem('paymentsFullHistory');
    localStorage.setItem('payments', JSON.stringify(payments));
    console.log(`✅ ${payments.length} pagos descargados desde Supabase`);

    // 3️⃣ Eventos
    const evRes = await fetch(`${base}/events?club_id=eq.${enc(clubId)}&deleted=eq.false&select=*`, { headers: h });
    if (!evRes.ok) throw new Error('Error al leer eventos de Supabase: ' + await evRes.text());
    const evRows = await evRes.json();
    const events = evRows.map(ev => ({
      id: ev.id, title: ev.title, date: ev.date, time: ev.time,
      description: ev.description, location: ev.location,
      deleted: ev.deleted, clubId: clubId,
    }));
    localStorage.setItem('calendarEvents', JSON.stringify(events));
    console.log(`✅ ${events.length} eventos descargados desde Supabase`);

    // 4️⃣ Usuarios
    const uRes = await fetch(`${base}/users?club_id=eq.${enc(clubId)}&deleted=eq.false&select=*`, { headers: h });
    if (!uRes.ok) throw new Error('Error al leer usuarios de Supabase: ' + await uRes.text());
    const uRows = await uRes.json();
    const clubUsers = uRows.map(u => ({
      id: u.id, schoolId: clubId, email: u.email, name: u.name,
      isMainAdmin: u.is_main_admin === true,
      role: u.role || 'admin', avatar: '', phone: u.phone || '',
      birthDate: u.birth_date || '', password: 'encrypted',
      createdAt: u.created_at || new Date().toISOString(),
    }));
    localStorage.setItem('users', JSON.stringify(clubUsers));
    console.log(`✅ ${clubUsers.length} usuarios descargados desde Supabase`);

    // 5️⃣ Egresos
    const exRes = await fetch(`${base}/expenses?club_id=eq.${enc(clubId)}&deleted=eq.false&select=*`, { headers: h });
    if (!exRes.ok) throw new Error('Error al leer egresos de Supabase: ' + await exRes.text());
    const exRows = await exRes.json();
    const expenses = exRows.map(e => ({
      id: e.id, concept: e.concept, amount: e.amount, date: e.date,
      category: e.category, description: e.description,
      invoiceNumber: e.invoice_number, deleted: e.deleted, clubId: clubId,
    }));
    localStorage.setItem('expenses', JSON.stringify(expenses));
    console.log(`✅ ${expenses.length} egresos descargados desde Supabase`);

    // 6️⃣ Códigos de padres
    const pcRes = await fetch(`${base}/parent_codes?club_id=eq.${enc(clubId)}&active=eq.true&select=*`, { headers: h });
    if (pcRes.ok) {
      const pcRows = await pcRes.json();
      const parentCodes = pcRows.map(pc => ({
        playerId: pc.player_id, code: pc.code,
        createdAt: pc.created_at, lastAccess: pc.last_access || null,
      }));
      localStorage.setItem('parentCodes', JSON.stringify(parentCodes));
      console.log(`✅ ${parentCodes.length} códigos de padres descargados desde Supabase`);
    }

    // Marcas de caché LOCAL-FIRST (mismo patrón que Firebase)
    localStorage.setItem('_lastFullDownload', JSON.stringify({ clubId, ts: Date.now() }));
    if (typeof markLocalSnapshotSynced === 'function') {
      ['players', 'payments', 'events', 'expenses', 'users'].forEach(scope =>
        markLocalSnapshotSynced(clubId, scope, { source: 'supabase' })
      );
    }

    showToast('✅ Datos sincronizados desde Supabase');
    return true;
  } catch (error) {
    console.error('❌ Error al descargar desde Supabase:', error);
    showToast('⚠️ Error al descargar desde Supabase: ' + error.message);
    return false;
  }
}

window.syncAllToSupabase           = syncAllToSupabase;
window.downloadAllClubDataFromSupabase = downloadAllClubDataFromSupabase;

// ============================================================
// FIN SUPABASE BLOCK
// ============================================================

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

  // Limpiar entradas 'Recuperado' con fechas incorrectas (una sola vez)
  if (typeof window.fixRecoveredPaymentLogEntries === 'function') {
    await window.fixRecoveredPaymentLogEntries();
  }

  // Migrar log de movimientos a Firebase (una sola vez, no bloquea el contador)
  if (typeof window.migrateLocalPaymentLogToFirebase === 'function') {
    window.migrateLocalPaymentLogToFirebase();
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
