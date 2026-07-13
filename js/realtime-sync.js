// ========================================
// 🔄 SINCRONIZACIÓN EN TIEMPO REAL - FIREBASE
// CON CARGA INICIAL INTELIGENTE
// ========================================

// Almacenar referencias a los listeners para poder desconectarlos
window.realtimeListeners = {
  players: null,
  payments: null,
  events: null,
  expenses: null,
  settings: null,
  logo: null,
  paymentMovementLog: null
};

// Estado de sincronización
window.realtimeSyncState = {
  isActive: false,
  clubId: null,
  lastSync: null,
  initialLoadComplete: false
};

const AUX_SYNC_TTL_MS = 30 * 60 * 1000; // 30 minutos
const PAYMENT_LOG_FETCH_TTL_MS = 5 * 60 * 1000; // 5 minutos
const FULL_SYNC_TTL_MS = Infinity; // full sync solo en primera apertura o "Actualizar" manual

function shouldRunAuxSync(clubId, { force = false } = {}) {
  if (force) return true;
  const key = `auxLastSync_${clubId}`;
  const last = Number(localStorage.getItem(key) || '0');
  if (!last) return true;
  return (Date.now() - last) > AUX_SYNC_TTL_MS;
}

function markAuxSyncRun(clubId) {
  localStorage.setItem(`auxLastSync_${clubId}`, String(Date.now()));
}

function getLocalFirstCollectionCount(scope) {
  try {
    switch (scope) {
      case 'settings':
        return localStorage.getItem('schoolSettings') ? 1 : 0;
      case 'players':
        return typeof getAllPlayers === 'function'
          ? getAllPlayers().length
          : JSON.parse(localStorage.getItem('players') || '[]').length;
      case 'payments':
        return typeof getPayments === 'function'
          ? getPayments().length
          : JSON.parse(localStorage.getItem('payments') || '[]').length;
      case 'events':
        return typeof getCalendarEvents === 'function'
          ? getCalendarEvents().length
          : JSON.parse(localStorage.getItem('calendarEvents') || '[]').length;
      case 'expenses':
        return typeof getExpenses === 'function'
          ? getExpenses().length
          : JSON.parse(localStorage.getItem('expenses') || '[]').length;
      case 'users':
        return typeof getUsers === 'function'
          ? getUsers().length
          : JSON.parse(localStorage.getItem('users') || '[]').length;
      case 'thirdPartyIncomes':
        return typeof getThirdPartyIncomes === 'function'
          ? getThirdPartyIncomes().length
          : JSON.parse(localStorage.getItem('thirdPartyIncomes') || '[]').length;
      case 'parentCodes':
        return typeof getParentCodes === 'function'
          ? getParentCodes().length
          : JSON.parse(localStorage.getItem('parentCodes') || '[]').length;
      case 'config':
        return Object.keys(localStorage).some(key => key.startsWith('config_')) ? 1 : 0;
      case 'paymentMovementLog':
        return typeof getPaymentLog === 'function'
          ? getPaymentLog().length
          : JSON.parse(localStorage.getItem('paymentMovementLog') || '[]').length;
      default:
        return 0;
    }
  } catch (error) {
    return 0;
  }
}

function shouldUseLocalFirstCollection(clubId, scope, ttlMs) {
  return typeof shouldReuseLocalSnapshot === 'function'
    ? shouldReuseLocalSnapshot(clubId, scope, { ttlMs })
    : false;
}

function markLocalFirstCollection(clubId, scope) {
  if (typeof markLocalSnapshotSynced === 'function') {
    markLocalSnapshotSynced(clubId, scope, { source: 'firebase' });
  }
}

// ========================================
// 🔧 MIGRACIÓN AUTOMÁTICA: agregar updatedAt a docs sin él
// Corre una sola vez por club (controlado por localStorage)
// ========================================
async function runUpdatedAtMigration(clubId) {
  const migKey = `updatedAtMigration_${clubId}`;
  if (localStorage.getItem(migKey)) return; // ya migrado

  const collections = ['players', 'payments', 'events', 'expenses'];
  const now = new Date().toISOString();
  let totalMigrated = 0;

  try {
    for (const col of collections) {
      const snap = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/${col}`)
      );
      const batch = [];
      snap.forEach(doc => {
        if (!doc.data().updatedAt) {
          batch.push(
            window.firebase.setDoc(
              window.firebase.doc(window.firebase.db, `clubs/${clubId}/${col}`, doc.id),
              { updatedAt: now },
              { merge: true }
            )
          );
        }
      });
      if (batch.length > 0) {
        await Promise.all(batch);
        totalMigrated += batch.length;
        console.log(`🔧 Migración updatedAt: ${batch.length} docs en ${col}`);
      }
    }

    localStorage.setItem(migKey, now);
    if (totalMigrated > 0) {
      console.log(`✅ Migración completada: ${totalMigrated} documentos actualizados`);
    } else {
      console.log('✅ Migración: todos los documentos ya tenían updatedAt');
    }
  } catch (err) {
    console.warn('⚠️ Error en migración updatedAt (no crítico):', err);
  }
}

// ========================================
// 🎯 INICIAR SINCRONIZACIÓN EN TIEMPO REAL
// ========================================
async function startRealtimeSync(clubId) {
  if (!clubId) {
    console.error('❌ clubId es requerido para sincronización en tiempo real');
    return false;
  }

  // En Supabase no hay listeners — los datos ya fueron descargados por auth.js.
  // Solo refrescamos si el caché no está fresco y actualizamos la UI.
  if (window.MODO_SUPABASE) {
    if (window.realtimeSyncState.isActive && window.realtimeSyncState.clubId === clubId) {
      console.log('ℹ️ [Supabase] Sincronización ya activa para este club');
      return true;
    }
    window.realtimeSyncState.isActive = true;
    window.realtimeSyncState.clubId = clubId;
    window.realtimeSyncState.lastSync = new Date().toISOString();
    window.realtimeSyncState.initialLoadComplete = true;

    const _lastDL = JSON.parse(localStorage.getItem('_lastFullDownload') || 'null');
    const dataFresh = _lastDL?.clubId === clubId && (Date.now() - _lastDL.ts) < 10 * 60 * 1000;
    if (!dataFresh && typeof downloadAllClubDataFromSupabase === 'function') {
      await downloadAllClubDataFromSupabase(clubId, { force: false });
    }

    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof renderPlayersList === 'function') renderPlayersList();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderAccounting === 'function') renderAccounting();
    if (typeof renderSchoolUsers === 'function') renderSchoolUsers();

    showSyncIndicator(true);
    console.log('✅ [Supabase] Sincronización local activa (sin listeners)');
    return true;
  }

  // Si ya está activo con el mismo club, no hacer nada
  if (window.realtimeSyncState.isActive && window.realtimeSyncState.clubId === clubId) {
    console.log('ℹ️ Sincronización ya activa para este club');
    return true;
  }
  
  // Detener listeners anteriores si existen
  stopRealtimeSync();
  
  console.log('🔄 ========================================');
  console.log('🔄 INICIANDO SINCRONIZACIÓN EN TIEMPO REAL');
  console.log('🔄 ========================================');
  console.log('📍 Club ID:', clubId);
  
  try {
    // Si auth.js acaba de descargar datos, no repetir descarga auxiliar
    const _lastDL = JSON.parse(localStorage.getItem('_lastFullDownload') || 'null');
    const _skipDownloadFromAuth = _lastDL?.clubId === clubId && (Date.now() - _lastDL.ts) < 10 * 60 * 1000;

    // 🎯 PASO 1: ACTIVAR LISTENERS PRINCIPALES
    // 1️⃣ Listener de Jugadores
    startPlayersListener(clubId);
    
    // 2️⃣ Listener de Pagos
    startPaymentsListener(clubId);
    
    // 3️⃣ Listener de Eventos
    startEventsListener(clubId);
    
    // 4️⃣ Listener de Egresos
    startExpensesListener(clubId);
    
    // 5️⃣ Listener de Configuración
    startSettingsListener(clubId);

    // 6️⃣ Listener del logo (documento separado)
    startLogoListener(clubId);
    
    // Actualizar estado
    window.realtimeSyncState.isActive = true;
    window.realtimeSyncState.clubId = clubId;
    window.realtimeSyncState.lastSync = new Date().toISOString();
    
    // Mostrar indicador de sincronización activa
    showSyncIndicator(true);
    
    console.log('✅ Sincronización en tiempo real activada');
    console.log('========================================');
    showToast('🔄 Sincronización en tiempo real activa');

    // 🔧 MIGRACIÓN updatedAt en segundo plano (una sola vez por club)
    setTimeout(() => runUpdatedAtMigration(clubId), 5000);

    // 🎯 PASO 2: DESCARGA AUXILIAR (solo colecciones sin listener en tiempo real)
    if (_skipDownloadFromAuth) {
      const minAgo = Math.round((Date.now() - _lastDL.ts) / 60000);
      console.log(`⚡ Descarga auxiliar omitida: datos recientes de auth (${minAgo} min)`);
    } else if (shouldRunAuxSync(clubId)) {
      const synced = await downloadAuxiliaryDataInitially(clubId);
      if (synced) {
        markAuxSyncRun(clubId);
      }
    } else {
      console.log('⚡ Descarga auxiliar omitida por TTL (30 min)');
    }

    return true;
    
  } catch (error) {
    console.error('❌ Error al iniciar sincronización:', error);
    return false;
  }
}

// ========================================
// 📥 DESCARGA AUXILIAR INICIAL (anti-duplicado)
// Solo colecciones sin listener en tiempo real.
// ========================================
async function downloadAuxiliaryDataInitially(clubId) {
  // En Supabase, downloadAllClubDataFromSupabase ya cubre todas las colecciones auxiliares
  if (window.MODO_SUPABASE) {
    console.log('⚡ [Supabase] Descarga auxiliar omitida — cubierta por downloadAllClubDataFromSupabase');
    return false;
  }

  console.log('📥 ========================================');
  console.log('📥 DESCARGA AUXILIAR (SIN DUPLICAR LISTENERS)');
  console.log('📥 ========================================');

  let stats = {
    users: 0,
    thirdPartyIncomes: 0,
    parentCodes: 0,
    config: 0
  };
  let syncedCollections = 0;

  // 1️⃣ USUARIOS
  try {
    console.log('📥 1/4 - Usuarios...');
    if (shouldUseLocalFirstCollection(clubId, 'users', AUX_SYNC_TTL_MS)) {
      stats.users = getLocalFirstCollectionCount('users');
      console.log(`⚡ Usuarios reutilizados desde local (${stats.users})`);
    } else {
      const usersSnapshot = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/users`)
      );

      const users = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (!userData.deleted) {
          users.push({ id: doc.id, ...userData, schoolId: clubId });
        }
      });

      localStorage.setItem('users', JSON.stringify(users));
      markLocalFirstCollection(clubId, 'users');
      stats.users = users.length;
      syncedCollections++;
      console.log(`✅ ${users.length} usuarios`);
    }
  } catch (error) {
    console.error('⚠️ Error usuarios:', error);
  }

  // 2️⃣ INGRESOS DE TERCEROS
  try {
    console.log('📥 2/4 - Ingresos de terceros...');
    if (shouldUseLocalFirstCollection(clubId, 'thirdPartyIncomes', AUX_SYNC_TTL_MS)) {
      stats.thirdPartyIncomes = getLocalFirstCollectionCount('thirdPartyIncomes');
      console.log(`⚡ Ingresos externos reutilizados desde local (${stats.thirdPartyIncomes})`);
    } else {
      const incomesSnapshot = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/thirdPartyIncomes`)
      );

      const incomes = [];
      incomesSnapshot.forEach(doc => {
        incomes.push({ id: doc.id, ...doc.data() });
      });

      localStorage.setItem('thirdPartyIncomes', JSON.stringify(incomes));
      if (window.idb && window.idb.syncStore) {
        window.idb.syncStore('thirdPartyIncomes', incomes).catch(e => console.warn('[idb] sync thirdPartyIncomes (firstBoot) falló:', e));
      }
      markLocalFirstCollection(clubId, 'thirdPartyIncomes');
      stats.thirdPartyIncomes = incomes.length;
      syncedCollections++;
      console.log(`✅ ${incomes.length} ingresos externos`);
    }
  } catch (error) {
    console.error('⚠️ Error ingresos:', error);
  }

  // 3️⃣ CÓDIGOS DE PADRES
  try {
    console.log('📥 3/4 - Códigos de padres...');
    if (shouldUseLocalFirstCollection(clubId, 'parentCodes', AUX_SYNC_TTL_MS)) {
      stats.parentCodes = getLocalFirstCollectionCount('parentCodes');
      console.log(`⚡ Códigos de padres reutilizados desde local (${stats.parentCodes})`);
    } else {
      const codesSnapshot = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/parentCodes`)
      );

      const codes = [];
      codesSnapshot.forEach(doc => {
        codes.push({ id: doc.id, ...doc.data() });
      });

      localStorage.setItem('parentCodes', JSON.stringify(codes));
      markLocalFirstCollection(clubId, 'parentCodes');
      stats.parentCodes = codes.length;
      syncedCollections++;
      console.log(`✅ ${codes.length} códigos`);
    }
  } catch (error) {
    console.error('⚠️ Error códigos:', error);
  }

  // 4️⃣ CONFIGURACIONES ADICIONALES
  try {
    console.log('📥 4/4 - Config adicional...');
    if (shouldUseLocalFirstCollection(clubId, 'config', AUX_SYNC_TTL_MS)) {
      stats.config = getLocalFirstCollectionCount('config');
      console.log(`⚡ Configuración adicional reutilizada desde local (${stats.config})`);
    } else {
      const configSnapshot = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/config`)
      );

      configSnapshot.forEach(doc => {
        localStorage.setItem(`config_${doc.id}`, JSON.stringify(doc.data()));
        stats.config++;
      });
      markLocalFirstCollection(clubId, 'config');
      syncedCollections++;

      console.log(`✅ ${stats.config} configuraciones`);
    }
  } catch (error) {
    console.error('⚠️ Error config:', error);
  }

  if (typeof renderAccounting === 'function') renderAccounting();
  if (typeof renderSchoolUsers === 'function') renderSchoolUsers();
  if (typeof updateDashboard === 'function') updateDashboard();

  console.log('📥 ========================================');
  console.log('📥 DESCARGA AUXILIAR COMPLETADA');
  console.log('📊 RESUMEN AUX:', stats);
  return syncedCollections > 0;
}

// ========================================
// 📥 DESCARGA INICIAL COMPLETA
// ========================================

async function downloadAllDataInitially(clubId) {
  if (window.MODO_SUPABASE) {
    console.log('☁️ [Supabase] Redirigiendo descarga inicial a downloadAllClubDataFromSupabase...');
    if (typeof downloadAllClubDataFromSupabase === 'function') {
      const ok = await downloadAllClubDataFromSupabase(clubId, { force: true });
      if (ok) {
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderPlayersList === 'function') renderPlayersList();
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderAccounting === 'function') renderAccounting();
        if (typeof renderSchoolUsers === 'function') renderSchoolUsers();
        if (typeof markLocalSnapshotSynced === 'function') {
          ['players', 'payments', 'events', 'expenses', 'users', 'thirdPartyIncomes', 'parentCodes'].forEach(
            scope => markLocalSnapshotSynced(clubId, scope, { source: 'supabase' })
          );
        }
      }
    }
    return;
  }

  console.log('📥 ========================================');
  console.log('📥 DESCARGA INICIAL DE TODOS LOS DATOS');
  console.log('📥 ========================================');

  // ⚡ LOCAL-FIRST GUARD: omitir descarga si los datos clave ya están frescos
  if (typeof shouldReuseLocalSnapshot === 'function') {
    const criticos = ['settings', 'players', 'payments'];
    const todosFrescos = criticos.every(scope =>
      shouldReuseLocalSnapshot(clubId, scope, { ttlMs: 15 * 60 * 1000 })
    );
    if (todosFrescos) {
      console.log('⚡ [LOCAL-FIRST] Datos críticos frescos — omitiendo descarga inicial de Firebase');
      // Igual actualizar vistas con datos locales
      if (typeof updateDashboard === 'function') updateDashboard();
      if (typeof renderPlayersList === 'function') renderPlayersList();
      if (typeof renderCalendar === 'function') renderCalendar();
      if (typeof renderAccounting === 'function') renderAccounting();
      return;
    }
  }

  let stats = {
    settings: false,
    players: 0,
    payments: 0,
    events: 0,
    expenses: 0,
    users: 0,
    thirdPartyIncomes: 0,
    parentCodes: 0,
    config: 0,
    paymentMovementLog: 0
  };
  
// 1️⃣ CONFIGURACIÓN — ⚡ TTL 60 min
  try {
    const _settTTL = 60 * 60 * 1000;
    const _settKey = `settingsLastFetch_${clubId}`;
    const _settOk  = localStorage.getItem('schoolSettings') &&
                     (Date.now() - Number(localStorage.getItem(_settKey) || 0)) < _settTTL;
    if (_settOk) {
      console.log('⚡ [LOCAL-FIRST] Configuración desde caché — sin lecturas Firestore');
      stats.settings = true;
    } else {
      console.log('📥 1/9 - Configuración del club...');
      const settingsDoc = await window.firebase.getDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, 'main')
      );
      if (settingsDoc.exists()) {
        const settingsData = settingsDoc.data();
        if (typeof saveSchoolSettings === 'function') {
          saveSchoolSettings(settingsData);
        } else {
          localStorage.setItem('schoolSettings', JSON.stringify(settingsData));
        }
        localStorage.setItem(_settKey, String(Date.now()));
        stats.settings = true;
        console.log('✅ Configuración descargada');
      }
    }
  } catch (error) {
    console.error('⚠️ Error configuración:', error);
  }

  // 1️⃣B - LOGO DEL CLUB — ⚡ TTL 60 min (solo descarga si settings recién se refrescó)
  try {
    const _logoKey = `logoLastFetch_${clubId}`;
    const _logoOk  = (Date.now() - Number(localStorage.getItem(_logoKey) || 0)) < 60 * 60 * 1000;
    if (!_logoOk) {
      const logoDoc = await window.firebase.getDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/assets`, 'logo')
      );
      if (logoDoc.exists()) {
        const logoData = logoDoc.data();
        if (logoData.logo) {
          const currentSettings = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
          currentSettings.logo = logoData.logo;
          localStorage.setItem('schoolSettings', JSON.stringify(currentSettings));
          localStorage.setItem(_logoKey, String(Date.now()));
          console.log('✅ Logo cargado desde documento separado');
        }
      }
    }
  } catch (error) {
    console.error('⚠️ Error cargando logo:', error);
  }
  
  // 2️⃣ JUGADORES — ⚡ TTL 15 min (más corto porque cambia frecuente)
  try {
    const _playTTL = 15 * 60 * 1000;
    const _playKey = `playersLastFetch_${clubId}`;
    const _existingPlayers = JSON.parse(localStorage.getItem('players') || '[]');
    const _playOk = _existingPlayers.length > 0 &&
                    (Date.now() - Number(localStorage.getItem(_playKey) || 0)) < _playTTL;
    if (_playOk) {
      console.log(`⚡ [LOCAL-FIRST] Jugadores desde caché (${_existingPlayers.length}) — sin lecturas Firestore`);
      stats.players = _existingPlayers.length;
    } else {
    console.log('📥 2/9 - Jugadores...');

    // ✅ PASO 1: Siempre intentar la fuente principal primero
    const normalizeStatus = (status) => {
      if (!status) return 'Activo'; // Sin status = Activo (compatibilidad datos viejos)
      const s = status.toLowerCase().trim();
      if (s === 'activo' || s === 'active') return 'Activo';
      if (s === 'inactivo' || s === 'inactive') return 'Inactivo';
      return status;
    };

    let finalPlayers = [];
    let usedSource = clubId;

    const primarySnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/players`)
    );
    primarySnapshot.forEach(doc => {
      const d = doc.data();
      if (!d.deleted) finalPlayers.push({ id: doc.id, ...d });
    });
    console.log(`   📊 Fuente principal (${clubId}): ${finalPlayers.length} jugadores`);

    // ✅ PASO 2: Solo si la fuente principal devuelve 0 jugadores, buscar en fuentes alternativas
    // Esto evita mezclar o sobreescribir datos de escuelas diferentes
    if (finalPlayers.length === 0) {
      console.log('⚠️ Fuente principal vacía — buscando en fuentes alternativas...');

      const fallbackIds = [];
      try {
        const currentUser = typeof getCurrentUser === 'function'
          ? getCurrentUser()
          : JSON.parse(localStorage.getItem('currentUser') || 'null');
        const settings = JSON.parse(localStorage.getItem('schoolSettings') || '{}');

        // Solo usar IDs explícitos guardados — nunca derivar el ID del nombre del club
        // (derivar del nombre puede cargar jugadores del club equivocado)
        if (currentUser?.schoolId && currentUser.schoolId !== clubId)
          fallbackIds.push(currentUser.schoolId);
        if (settings?.clubId && settings.clubId !== clubId && !fallbackIds.includes(settings.clubId))
          fallbackIds.push(settings.clubId);
      } catch (e) {
        console.warn('⚠️ Error construyendo fuentes alternativas:', e);
      }

      for (const fallbackId of fallbackIds) {
        try {
          const snap = await window.firebase.getDocs(
            window.firebase.collection(window.firebase.db, `clubs/${fallbackId}/players`)
          );
          const players = [];
          snap.forEach(doc => { const d = doc.data(); if (!d.deleted) players.push({ id: doc.id, ...d }); });
          console.log(`   📊 Alternativa (${fallbackId}): ${players.length} jugadores`);

          if (players.length > 0) {
            finalPlayers = players;
            usedSource = fallbackId;
            console.log(`✅ Usando fuente alternativa: ${fallbackId}`);
            break; // ✅ Usar la primera alternativa que tenga datos, sin mezclar
          }
        } catch (e) {
          console.warn(`   ⚠️ Error leyendo ${fallbackId}:`, e.message);
        }
      }
    }

    // ✅ PASO 3: Normalizar status antes de guardar
    finalPlayers = finalPlayers.map(p => ({
      ...p,
      status: normalizeStatus(p.status)
    }));

    if (typeof saveAllPlayers === 'function') {
      saveAllPlayers(finalPlayers);
    } else {
      localStorage.setItem('players', JSON.stringify(finalPlayers));
      if (window.idb && window.idb.syncStore) {
        window.idb.syncStore('players', finalPlayers).catch(e => console.warn('[idb] sync players (firstBoot fallback) falló:', e));
      }
    }
    localStorage.setItem(_playKey, String(Date.now()));
    stats.players = finalPlayers.length;
    console.log(`✅ ${finalPlayers.length} jugadores cargados desde: ${usedSource}`);
    } // fin else cache jugadores
  } catch (error) {
    console.error('⚠️ Error jugadores:', error);
  }
  
  // 3️⃣ PAGOS — ⚡ LOCAL-FIRST con TTL de 30 minutos
  //   Si los pagos están en caché y tienen menos de 30 min → 0 lecturas a Firestore.
  //   El onSnapshot que se inicia después actualiza en tiempo real durante la sesión.
  //   Si el caché expiró → merge de dos queries para no perder morosos que pagaron tarde:
  //     A) dueDate >= hace 24 meses  → cubre mensualidades vencidas recientes
  //     B) paidDate >= hace 12 meses → cubre pagos cobrados este año aunque dueDate sea antiguo
  try {
    const PAYMENTS_TTL_MS = 30 * 60 * 1000; // 30 minutos
    const cacheKey    = `paymentsLastFetch_${clubId}`;
    const lastFetch   = Number(localStorage.getItem(cacheKey) || '0');
    const cachedPayments = JSON.parse(localStorage.getItem('payments') || '[]');
    const cacheValid  = cachedPayments.length > 0 && (Date.now() - lastFetch) < PAYMENTS_TTL_MS;

    if (cacheValid) {
      console.log(`⚡ [LOCAL-FIRST] Pagos desde caché (${cachedPayments.length} docs, hace ${Math.round((Date.now() - lastFetch) / 60000)} min) — sin lecturas a Firestore`);
      stats.payments = cachedPayments.length;
    } else {
      console.log('📥 3/9 - Pagos (dueDate últimos 24m + paidDate últimos 12m)...');

      const now = new Date();

      const cutoffDue = new Date(now);
      cutoffDue.setFullYear(cutoffDue.getFullYear() - 2);
      const cutoffDueStr = cutoffDue.toISOString().split('T')[0];

      const cutoffPaid = new Date(now);
      cutoffPaid.setFullYear(cutoffPaid.getFullYear() - 1);
      const cutoffPaidStr = cutoffPaid.toISOString().split('T')[0];

      const [snapDue, snapPaid] = await Promise.all([
        window.firebase.getDocs(
          window.firebase.query(
            window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`),
            window.firebase.where('dueDate', '>=', cutoffDueStr)
          )
        ),
        window.firebase.getDocs(
          window.firebase.query(
            window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`),
            window.firebase.where('paidDate', '>=', cutoffPaidStr)
          )
        )
      ]);

      const paymentsMap = {};
      snapDue.forEach(doc  => { paymentsMap[doc.id] = { id: doc.id, ...doc.data() }; });
      snapPaid.forEach(doc => { paymentsMap[doc.id] = { id: doc.id, ...doc.data() }; });
      const payments = Object.values(paymentsMap);

      localStorage.setItem('payments', JSON.stringify(payments));
      if (window.idb && window.idb.syncPaymentsToIDB) {
        window.idb.syncPaymentsToIDB(payments).catch(e => console.warn('[idb] sync (firstBoot Firebase) falló:', e));
      }
      localStorage.setItem(cacheKey, String(Date.now()));
      localStorage.removeItem('paymentsFullHistory');
      stats.payments = payments.length;
      console.log(`✅ ${payments.length} pagos (dueDate desde ${cutoffDueStr}, paidDate desde ${cutoffPaidStr})`);
    }
  } catch (error) {
    console.error('⚠️ Error pagos:', error);
  }

  
  // 4️⃣ EVENTOS
  try {
    const _evTTL = 30 * 60 * 1000;
    const _evKey = `eventsLastFetch_${clubId}`;
    const _evLastFetch = Number(localStorage.getItem(_evKey) || 0);
    if (_evLastFetch > 0 && (Date.now() - _evLastFetch) < _evTTL) {
      const _evCache = JSON.parse(localStorage.getItem('calendarEvents') || '[]');
      console.log(`⚡ [LOCAL-FIRST] Eventos desde caché (${_evCache.length}) — sin lecturas Firestore`);
      stats.events = _evCache.length;
    } else {
      console.log('📥 4/9 - Eventos...');
      const eventsSnapshot = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/events`)
      );
      const events = [];
      eventsSnapshot.forEach(doc => { events.push({ id: doc.id, ...doc.data() }); });
      localStorage.setItem('calendarEvents', JSON.stringify(events));
      if (window.idb && window.idb.syncStore) {
        window.idb.syncStore('events', events).catch(e => console.warn('[idb] sync events (firstBoot) falló:', e));
      }
      localStorage.setItem(_evKey, String(Date.now()));
      stats.events = events.length;
      console.log(`✅ ${events.length} eventos`);
    }
  } catch (error) {
    console.error('⚠️ Error eventos:', error);
  }
  
  // 5️⃣ EGRESOS — ⚡ TTL 30 min
  try {
    const _expKey = `expensesLastFetch_${clubId}`;
    const _expLastFetch = Number(localStorage.getItem(_expKey) || 0);
    if (_expLastFetch > 0 && (Date.now() - _expLastFetch) < 30 * 60 * 1000) {
      const _expCache = JSON.parse(localStorage.getItem('expenses') || '[]');
      console.log(`⚡ [LOCAL-FIRST] Egresos desde caché (${_expCache.length}) — sin lecturas Firestore`);
      stats.expenses = _expCache.length;
    } else {
      console.log('📥 5/9 - Egresos...');
      const expensesSnapshot = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/expenses`)
      );
      const expenses = [];
      expensesSnapshot.forEach(doc => { expenses.push({ id: doc.id, ...doc.data() }); });
      localStorage.setItem('expenses', JSON.stringify(expenses));
      if (window.idb && window.idb.syncStore) {
        window.idb.syncStore('expenses', expenses).catch(e => console.warn('[idb] sync expenses (firstBoot) falló:', e));
      }
      localStorage.setItem(_expKey, String(Date.now()));
      stats.expenses = expenses.length;
      console.log(`✅ ${expenses.length} egresos`);
    }
  } catch (error) {
    console.error('⚠️ Error egresos:', error);
  }
  
  // 6️⃣ USUARIOS — ⚡ TTL 60 min (rara vez cambia)
  try {
    const _usrKey = `usersLastFetch_${clubId}`;
    const _usrLastFetch = Number(localStorage.getItem(_usrKey) || 0);
    if (_usrLastFetch > 0 && (Date.now() - _usrLastFetch) < 60 * 60 * 1000) {
      const _usrCache = JSON.parse(localStorage.getItem('users') || '[]');
      console.log(`⚡ [LOCAL-FIRST] Usuarios desde caché (${_usrCache.length}) — sin lecturas Firestore`);
      stats.users = _usrCache.length;
    } else {
      console.log('📥 6/9 - Usuarios...');
      const usersSnapshot = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/users`)
      );
      const users = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (!userData.deleted) users.push({ id: doc.id, ...userData, schoolId: clubId });
      });
      localStorage.setItem('users', JSON.stringify(users));
      localStorage.setItem(_usrKey, String(Date.now()));
      stats.users = users.length;
      console.log(`✅ ${users.length} usuarios`);
    }
  } catch (error) {
    console.error('⚠️ Error usuarios:', error);
  }
  
  // 7️⃣ INGRESOS DE TERCEROS — ⚡ TTL 30 min
  try {
    const _incKey = `incomesLastFetch_${clubId}`;
    const _incLastFetch = Number(localStorage.getItem(_incKey) || 0);
    if (_incLastFetch > 0 && (Date.now() - _incLastFetch) < 30 * 60 * 1000) {
      const _incCache = JSON.parse(localStorage.getItem('thirdPartyIncomes') || '[]');
      console.log(`⚡ [LOCAL-FIRST] Ingresos externos desde caché (${_incCache.length}) — sin lecturas Firestore`);
      stats.thirdPartyIncomes = _incCache.length;
    } else {
      console.log('📥 7/9 - Ingresos de terceros...');
      const incomesSnapshot = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/thirdPartyIncomes`)
      );
      const incomes = [];
      incomesSnapshot.forEach(doc => { incomes.push({ id: doc.id, ...doc.data() }); });
      localStorage.setItem('thirdPartyIncomes', JSON.stringify(incomes));
      if (window.idb && window.idb.syncStore) {
        window.idb.syncStore('thirdPartyIncomes', incomes).catch(e => console.warn('[idb] sync thirdPartyIncomes (firstBoot Firebase) falló:', e));
      }
      localStorage.setItem(_incKey, String(Date.now()));
      stats.thirdPartyIncomes = incomes.length;
      console.log(`✅ ${incomes.length} ingresos externos`);
    }
  } catch (error) {
    console.error('⚠️ Error ingresos:', error);
  }
  
  // 8️⃣ CÓDIGOS DE PADRES — ⚡ TTL 60 min (casi no cambian)
  try {
    const _codeKey = `parentCodesLastFetch_${clubId}`;
    const _codeLastFetch = Number(localStorage.getItem(_codeKey) || 0);
    if (_codeLastFetch > 0 && (Date.now() - _codeLastFetch) < 60 * 60 * 1000) {
      const _codeCache = JSON.parse(localStorage.getItem('parentCodes') || '[]');
      console.log(`⚡ [LOCAL-FIRST] Códigos padres desde caché (${_codeCache.length}) — sin lecturas Firestore`);
      stats.parentCodes = _codeCache.length;
    } else {
      console.log('📥 8/9 - Códigos de padres...');
      const codesSnapshot = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/parentCodes`)
      );
      const codes = [];
      codesSnapshot.forEach(doc => { codes.push({ id: doc.id, ...doc.data() }); });
      localStorage.setItem('parentCodes', JSON.stringify(codes));
      localStorage.setItem(_codeKey, String(Date.now()));
      stats.parentCodes = codes.length;
      console.log(`✅ ${codes.length} códigos`);
    }
  } catch (error) {
    console.error('⚠️ Error códigos:', error);
  }

  // 9️⃣ CONFIGURACIONES ADICIONALES — ⚡ TTL 60 min
  try {
    const _cfgKey = `configLastFetch_${clubId}`;
    if ((Date.now() - Number(localStorage.getItem(_cfgKey) || 0)) < 60 * 60 * 1000 &&
        localStorage.getItem('config_main') !== null) {
      console.log('⚡ [LOCAL-FIRST] Config adicional desde caché — sin lecturas Firestore');
    } else {
      console.log('📥 9/9 - Config adicional...');
      const configSnapshot = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/config`)
      );
      configSnapshot.forEach(doc => {
        localStorage.setItem(`config_${doc.id}`, JSON.stringify(doc.data()));
        stats.config++;
      });
      localStorage.setItem(_cfgKey, String(Date.now()));
      console.log(`✅ ${stats.config} configuraciones`);
    }
  } catch (error) {
    console.error('⚠️ Error config:', error);
  }

  // 🔟 LOG DE MOVIMIENTOS DE PAGOS — limitado a últimos 200 para reducir lecturas
  try {
    console.log('📥 10/10 - Log de movimientos de pagos (últimos 200)...');
    const logSnapshot = await window.firebase.getDocs(
      window.firebase.query(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/paymentMovementLog`),
        window.firebase.orderBy('timestamp', 'desc'),
        window.firebase.limit(200)
      )
    );
    const logEntries = [];
    logSnapshot.forEach(doc => logEntries.push(doc.data()));
    // Ya llegan ordenados desc por el query
    localStorage.setItem('paymentMovementLog', JSON.stringify(logEntries));
    stats.paymentMovementLog = logEntries.length;
    console.log(`✅ ${logEntries.length} entradas del log de movimientos cargadas`);
  } catch (error) {
    console.error('⚠️ Error log de movimientos:', error);
  }

  // 🔄 ACTUALIZAR VISTAS
  console.log('🔄 Actualizando todas las vistas...');
  if (typeof updateDashboard === 'function') updateDashboard();
  if (typeof renderPlayersList === 'function') renderPlayersList();
  if (typeof renderCalendar === 'function') renderCalendar();
  if (typeof renderAccounting === 'function') renderAccounting();
  if (typeof renderSchoolUsers === 'function') renderSchoolUsers();
  
  console.log('📥 ========================================');
  console.log('📥 DESCARGA INICIAL COMPLETADA');
  console.log('📥 ========================================');
  console.log('📊 RESUMEN:');
  console.log(`   ✅ Configuración: ${stats.settings ? 'Sí' : 'No'}`);
  console.log(`   ✅ Jugadores: ${stats.players}`);
  console.log(`   ✅ Pagos: ${stats.payments}`);
  console.log(`   ✅ Eventos: ${stats.events}`);
  console.log(`   ✅ Egresos: ${stats.expenses}`);
  console.log(`   ✅ Usuarios: ${stats.users}`);
  console.log(`   ✅ Ingresos externos: ${stats.thirdPartyIncomes}`);
  console.log(`   ✅ Códigos padres: ${stats.parentCodes}`);
  console.log(`   ✅ Config adicional: ${stats.config}`);
  console.log(`   ✅ Log de movimientos: ${stats.paymentMovementLog}`);
  console.log('========================================');
  
  const total = stats.players + stats.payments + stats.events + stats.expenses;
  showToast(`✅ Datos sincronizados: ${total} registros descargados`);

  // ⚡ LOCAL-FIRST: marcar colecciones como sincronizadas para el próximo arranque
  if (typeof markLocalSnapshotSynced === 'function') {
    ['settings', 'players', 'payments', 'events', 'expenses', 'users', 'thirdPartyIncomes', 'parentCodes', 'config'].forEach(
      scope => markLocalSnapshotSynced(clubId, scope, { source: 'firebase' })
    );
    console.log('⚡ [LOCAL-FIRST] Caché de colecciones actualizado tras descarga completa');
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
        window.realtimeListeners[key]();
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
// 👥 POLLING DE JUGADORES (cada 5 min)
// ========================================
const POLL_PLAYERS_TTL_MS = 5 * 60 * 1000;

function _normalizePlayerStatus(data) {
  const status = data.status;
  if (!status) return 'Activo';
  const s = status.toLowerCase().trim();
  if (s === 'activo' || s === 'active') return 'Activo';
  if (s === 'inactivo' || s === 'inactive') return 'Inactivo';
  return status;
}

async function _fetchPlayers(clubId) {
  try {
    const lastSync = localStorage.getItem(`playersDeltaSync_${clubId}`);
    const lastSyncAge = lastSync ? (Date.now() - new Date(lastSync).getTime()) : Infinity;
    const needFullSync = !lastSync || lastSyncAge >= FULL_SYNC_TTL_MS;

    if (!needFullSync) {
      // Delta: solo los modificados desde la última sincronización
      const snap = await window.firebase.getDocs(
        window.firebase.query(
          window.firebase.collection(window.firebase.db, `clubs/${clubId}/players`),
          window.firebase.where('updatedAt', '>', lastSync)
        )
      );

      if (snap.size > 0) {
        const existing = JSON.parse(localStorage.getItem('players') || '[]');
        const existingMap = {};
        existing.forEach(p => { existingMap[p.id] = p; });
        snap.forEach(doc => {
          const data = doc.data();
          if (data.deleted) delete existingMap[doc.id];
          else existingMap[doc.id] = { id: doc.id, ...data, status: _normalizePlayerStatus(data) };
        });
        const merged = Object.values(existingMap);
        if (typeof saveAllPlayers === 'function') saveAllPlayers(merged);
        else localStorage.setItem('players', JSON.stringify(merged));
        if (window.idb && window.idb.syncStore) {
          window.idb.syncStore('players', merged).catch(e => console.warn('[idb] sync players (delta) falló:', e));
        }
        console.log(`👥 Delta jugadores: ${snap.size} cambios aplicados`);
      } else {
        console.log('👥 Delta jugadores: sin cambios');
      }
    } else {
      // Full sync: primera bajada o pasaron 24h
      const snap = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/players`)
      );
      const players = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (!data.deleted) players.push({ id: doc.id, ...data, status: _normalizePlayerStatus(data) });
      });
      if (typeof saveAllPlayers === 'function') saveAllPlayers(players);
      else localStorage.setItem('players', JSON.stringify(players));
      if (window.idb && window.idb.syncStore) {
        window.idb.syncStore('players', players).catch(e => console.warn('[idb] sync players (full) falló:', e));
      }
      console.log(`👥 Full sync jugadores: ${players.length}`);
    }

    localStorage.setItem(`playersDeltaSync_${clubId}`, new Date().toISOString());
    localStorage.setItem(`playersLastFetch_${clubId}`, String(Date.now()));
    window.realtimeSyncState.lastSync = new Date().toISOString();
  } catch (error) {
    console.error('❌ Error al obtener jugadores:', error);
  }
}

function startPlayersListener(clubId) {
  // Carga inmediata si el caché venció o no existe
  const lastFetch = Number(localStorage.getItem(`playersLastFetch_${clubId}`) || '0');
  if (!lastFetch || (Date.now() - lastFetch) >= POLL_PLAYERS_TTL_MS) {
    _fetchPlayers(clubId);
  } else {
    console.log('⚡ Jugadores en caché local, omitiendo descarga');
  }

  // Polling cada 5 min
  const intervalId = setInterval(async () => {
    if (window.realtimeSyncState.clubId !== clubId) return;
    await _fetchPlayers(clubId);
    if (window.realtimeSyncState.initialLoadComplete) {
      refreshPlayersUI();
    }
  }, POLL_PLAYERS_TTL_MS);

  window.realtimeListeners.players = () => clearInterval(intervalId);
  console.log('👥 Polling de jugadores iniciado (5 min)');
}

// ========================================
// 💰 POLLING DE PAGOS (cada 5 min)
// ========================================
const POLL_PAYMENTS_TTL_MS = 5 * 60 * 1000;

async function _fetchPayments(clubId) {
  try {
    const lastSync = localStorage.getItem(`paymentsDeltaSync_${clubId}`);
    const lastSyncAge = lastSync ? (Date.now() - new Date(lastSync).getTime()) : Infinity;
    const needFullSync = !lastSync || lastSyncAge >= FULL_SYNC_TTL_MS;
    const paymentsFullHistory = localStorage.getItem('paymentsFullHistory') === 'true';

    if (!needFullSync) {
      // Delta: solo los modificados desde la última sincronización
      const snap = await window.firebase.getDocs(
        window.firebase.query(
          window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`),
          window.firebase.where('updatedAt', '>', lastSync)
        )
      );

      if (snap.size > 0) {
        const existing = JSON.parse(localStorage.getItem('payments') || '[]');
        const existingMap = {};
        existing.forEach(p => { existingMap[p.id] = p; });
        snap.forEach(doc => {
          const data = doc.data();
          if (data.deleted) delete existingMap[doc.id];
          else existingMap[doc.id] = { id: doc.id, ...data };
        });
        const _mergedDelta = Object.values(existingMap);
        localStorage.setItem('payments', JSON.stringify(_mergedDelta));
        if (window.idb && window.idb.syncPaymentsToIDB) {
          window.idb.syncPaymentsToIDB(_mergedDelta).catch(e => console.warn('[idb] sync (delta) falló:', e));
        }
        console.log(`💰 Delta pagos: ${snap.size} cambios aplicados`);
      } else {
        console.log('💰 Delta pagos: sin cambios');
      }
    } else {
      // Full sync: primera bajada o pasaron 24h — respeta filtro 12 meses
      let queryRef;
      if (paymentsFullHistory) {
        queryRef = window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`);
      } else {
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        queryRef = window.firebase.query(
          window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`),
          window.firebase.where('dueDate', '>=', cutoffStr)
        );
      }

      const snap = await window.firebase.getDocs(queryRef);
      const payments = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (!data.deleted) payments.push({ id: doc.id, ...data });
      });

      let _finalPayments;
      if (paymentsFullHistory) {
        const existing = JSON.parse(localStorage.getItem('payments') || '[]');
        const incomingMap = {};
        payments.forEach(p => { incomingMap[p.id] = p; });
        const merged = existing.map(p => incomingMap[p.id] ? incomingMap[p.id] : p);
        const existingIds = new Set(existing.map(p => p.id));
        payments.forEach(p => { if (!existingIds.has(p.id)) merged.push(p); });
        localStorage.setItem('payments', JSON.stringify(merged));
        _finalPayments = merged;
      } else {
        localStorage.setItem('payments', JSON.stringify(payments));
        _finalPayments = payments;
      }
      if (window.idb && window.idb.syncPaymentsToIDB) {
        window.idb.syncPaymentsToIDB(_finalPayments).catch(e => console.warn('[idb] sync (full) falló:', e));
      }
      console.log(`💰 Full sync pagos: ${payments.length}`);
    }

    localStorage.setItem(`paymentsDeltaSync_${clubId}`, new Date().toISOString());
    localStorage.setItem(`paymentsLastFetch_${clubId}`, String(Date.now()));
    window.realtimeSyncState.lastSync = new Date().toISOString();
  } catch (error) {
    console.error('❌ Error al obtener pagos:', error);
  }
}

function startPaymentsListener(clubId) {
  const lastFetch = Number(localStorage.getItem(`paymentsLastFetch_${clubId}`) || '0');
  if (!lastFetch || (Date.now() - lastFetch) >= POLL_PAYMENTS_TTL_MS) {
    _fetchPayments(clubId);
  } else {
    console.log('⚡ Pagos en caché local, omitiendo descarga');
  }

  const intervalId = setInterval(async () => {
    if (window.realtimeSyncState.clubId !== clubId) return;
    await _fetchPayments(clubId);
    if (window.realtimeSyncState.initialLoadComplete) {
      refreshPaymentsUI();
    }
  }, POLL_PAYMENTS_TTL_MS);

  window.realtimeListeners.payments = () => clearInterval(intervalId);
  console.log('💰 Polling de pagos iniciado (5 min)');
}

// ========================================
// 📂 CARGAR HISTORIAL COMPLETO DE PAGOS
// Descarga todos los pagos sin filtro de fecha.
// Se llama desde el botón "Ver historial completo".
// ========================================
async function loadAllPaymentsHistory() {
  const clubId = window.realtimeSyncState.clubId;
  if (!clubId) {
    showToast('❌ No hay sesión activa');
    return;
  }
  if (localStorage.getItem('paymentsFullHistory') === 'true') {
    if (typeof window.fixMissingPaymentLogEntries === 'function') {
      let existingPayments = [];
      try {
        existingPayments = JSON.parse(localStorage.getItem('payments') || '[]');
      } catch (e) {
        existingPayments = [];
      }
      window.fixMissingPaymentLogEntries({ force: true, payments: existingPayments });
      if (typeof refreshPaymentsUI === 'function') refreshPaymentsUI();
    }
    showToast('ℹ️ El historial completo ya está cargado');
    return;
  }

  showToast('⏳ Cargando historial completo...');
  try {
    const snap = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`)
    );
    const payments = [];
    snap.forEach(doc => payments.push({ id: doc.id, ...doc.data() }));

    localStorage.setItem('payments', JSON.stringify(payments));
    if (window.idb && window.idb.syncPaymentsToIDB) {
      window.idb.syncPaymentsToIDB(payments).catch(e => console.warn('[idb] sync (historial completo) falló:', e));
    }
    localStorage.setItem('paymentsFullHistory', 'true');

    if (typeof window.fixMissingPaymentLogEntries === 'function') {
      window.fixMissingPaymentLogEntries({ force: true, payments });
    }

    showToast(`✅ ${payments.length} pagos cargados`);
    if (typeof refreshPaymentsUI === 'function') refreshPaymentsUI();
  } catch (err) {
    console.error('❌ Error cargando historial:', err);
    showToast('❌ No se pudo cargar el historial');
  }
}

// ========================================
// 📅 POLLING DE EVENTOS (cada 5 min)
// ========================================
const POLL_EVENTS_TTL_MS = 5 * 60 * 1000;

async function _fetchEvents(clubId) {
  try {
    const lastSync = localStorage.getItem(`eventsDeltaSync_${clubId}`);
    const lastSyncAge = lastSync ? (Date.now() - new Date(lastSync).getTime()) : Infinity;
    const needFullSync = !lastSync || lastSyncAge >= FULL_SYNC_TTL_MS;

    if (!needFullSync) {
      const snap = await window.firebase.getDocs(
        window.firebase.query(
          window.firebase.collection(window.firebase.db, `clubs/${clubId}/events`),
          window.firebase.where('updatedAt', '>', lastSync)
        )
      );

      if (snap.size > 0) {
        const existing = JSON.parse(localStorage.getItem('calendarEvents') || '[]');
        const existingMap = {};
        existing.forEach(e => { existingMap[e.id] = e; });
        snap.forEach(doc => {
          const data = doc.data();
          if (data.deleted) delete existingMap[doc.id];
          else existingMap[doc.id] = { id: doc.id, ...data };
        });
        const _mergedEvents = Object.values(existingMap);
        localStorage.setItem('calendarEvents', JSON.stringify(_mergedEvents));
        if (window.idb && window.idb.syncStore) {
          window.idb.syncStore('events', _mergedEvents).catch(e => console.warn('[idb] sync events (delta) falló:', e));
        }
        console.log(`📅 Delta eventos: ${snap.size} cambios aplicados`);
      } else {
        console.log('📅 Delta eventos: sin cambios');
      }
    } else {
      const snap = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/events`)
      );
      const events = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (!data.deleted) events.push({ id: doc.id, ...data });
      });
      localStorage.setItem('calendarEvents', JSON.stringify(events));
      if (window.idb && window.idb.syncStore) {
        window.idb.syncStore('events', events).catch(e => console.warn('[idb] sync events (full) falló:', e));
      }
      console.log(`📅 Full sync eventos: ${events.length}`);
    }

    localStorage.setItem(`eventsDeltaSync_${clubId}`, new Date().toISOString());
    localStorage.setItem(`eventsLastFetch_${clubId}`, String(Date.now()));
    window.realtimeSyncState.lastSync = new Date().toISOString();
  } catch (error) {
    console.error('❌ Error al obtener eventos:', error);
  }
}

function startEventsListener(clubId) {
  const lastFetch = Number(localStorage.getItem(`eventsLastFetch_${clubId}`) || '0');
  if (!lastFetch || (Date.now() - lastFetch) >= POLL_EVENTS_TTL_MS) {
    _fetchEvents(clubId);
  } else {
    console.log('⚡ Eventos en caché local, omitiendo descarga');
  }

  const intervalId = setInterval(async () => {
    if (window.realtimeSyncState.clubId !== clubId) return;
    await _fetchEvents(clubId);
    if (window.realtimeSyncState.initialLoadComplete) {
      refreshCalendarUI();
    }
  }, POLL_EVENTS_TTL_MS);

  window.realtimeListeners.events = () => clearInterval(intervalId);
  console.log('📅 Polling de eventos iniciado (5 min)');
}

// ========================================
// 💸 POLLING DE EGRESOS (cada 5 min)
// ========================================
const POLL_EXPENSES_TTL_MS = 5 * 60 * 1000;

async function _fetchExpenses(clubId) {
  try {
    const lastSync = localStorage.getItem(`expensesDeltaSync_${clubId}`);
    const lastSyncAge = lastSync ? (Date.now() - new Date(lastSync).getTime()) : Infinity;
    const needFullSync = !lastSync || lastSyncAge >= FULL_SYNC_TTL_MS;

    if (!needFullSync) {
      const snap = await window.firebase.getDocs(
        window.firebase.query(
          window.firebase.collection(window.firebase.db, `clubs/${clubId}/expenses`),
          window.firebase.where('updatedAt', '>', lastSync)
        )
      );

      if (snap.size > 0) {
        const existing = JSON.parse(localStorage.getItem('expenses') || '[]');
        const existingMap = {};
        existing.forEach(e => { existingMap[e.id] = e; });
        snap.forEach(doc => {
          const data = doc.data();
          if (data.deleted) delete existingMap[doc.id];
          else existingMap[doc.id] = { id: doc.id, ...data };
        });
        const _mergedExpenses = Object.values(existingMap);
        localStorage.setItem('expenses', JSON.stringify(_mergedExpenses));
        if (window.idb && window.idb.syncStore) {
          window.idb.syncStore('expenses', _mergedExpenses).catch(e => console.warn('[idb] sync expenses (delta) falló:', e));
        }
        console.log(`💸 Delta egresos: ${snap.size} cambios aplicados`);
      } else {
        console.log('💸 Delta egresos: sin cambios');
      }
    } else {
      const snap = await window.firebase.getDocs(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/expenses`)
      );
      const expenses = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (!data.deleted) expenses.push({ id: doc.id, ...data });
      });
      localStorage.setItem('expenses', JSON.stringify(expenses));
      if (window.idb && window.idb.syncStore) {
        window.idb.syncStore('expenses', expenses).catch(e => console.warn('[idb] sync expenses (full) falló:', e));
      }
      console.log(`💸 Full sync egresos: ${expenses.length}`);
    }

    localStorage.setItem(`expensesDeltaSync_${clubId}`, new Date().toISOString());
    localStorage.setItem(`expensesLastFetch_${clubId}`, String(Date.now()));
    window.realtimeSyncState.lastSync = new Date().toISOString();
  } catch (error) {
    console.error('❌ Error al obtener egresos:', error);
  }
}

function startExpensesListener(clubId) {
  const lastFetch = Number(localStorage.getItem(`expensesLastFetch_${clubId}`) || '0');
  if (!lastFetch || (Date.now() - lastFetch) >= POLL_EXPENSES_TTL_MS) {
    _fetchExpenses(clubId);
  } else {
    console.log('⚡ Egresos en caché local, omitiendo descarga');
  }

  const intervalId = setInterval(async () => {
    if (window.realtimeSyncState.clubId !== clubId) return;
    await _fetchExpenses(clubId);
    if (window.realtimeSyncState.initialLoadComplete) {
      if (typeof renderAccounting === 'function') renderAccounting();
    }
  }, POLL_EXPENSES_TTL_MS);

  window.realtimeListeners.expenses = () => clearInterval(intervalId);
  console.log('💸 Polling de egresos iniciado (5 min)');
}

// ========================================
// ⚙️ POLLING DE CONFIGURACIÓN (cada 60 min)
// ========================================
const POLL_SETTINGS_TTL_MS = 60 * 60 * 1000;

async function _fetchSettings(clubId) {
  try {
    const docSnap = await window.firebase.getDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, 'main')
    );
    if (docSnap.exists()) {
      const settings = docSnap.data();
      // El logo lo maneja _fetchLogo() por separado; preservar el logo local
      const local = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
      if (!settings.logo && local.logo) settings.logo = local.logo;
      if (typeof saveSchoolSettings === 'function') {
        saveSchoolSettings(settings);
      } else {
        localStorage.setItem('schoolSettings', JSON.stringify(settings));
      }
      localStorage.setItem(`settingsLastFetch_${clubId}`, String(Date.now()));
      window.realtimeSyncState.lastSync = new Date().toISOString();
      console.log('⚙️ Configuración actualizada');
    }
  } catch (error) {
    console.error('❌ Error al obtener configuración:', error);
  }
}

function startSettingsListener(clubId) {
  const lastFetch = Number(localStorage.getItem(`settingsLastFetch_${clubId}`) || '0');
  if (!lastFetch || (Date.now() - lastFetch) >= POLL_SETTINGS_TTL_MS) {
    _fetchSettings(clubId);
  } else {
    console.log('⚡ Configuración en caché local, omitiendo descarga');
  }

  const intervalId = setInterval(async () => {
    if (window.realtimeSyncState.clubId !== clubId) return;
    await _fetchSettings(clubId);
    if (window.realtimeSyncState.initialLoadComplete) {
      updateHeaderInfo();
    }
  }, POLL_SETTINGS_TTL_MS);

  window.realtimeListeners.settings = () => clearInterval(intervalId);
  console.log('⚙️ Polling de configuración iniciado (60 min)');

  // Marcar carga inicial como completa — CRÍTICO: la UI espera este flag
  setTimeout(() => {
    window.realtimeSyncState.initialLoadComplete = true;
    console.log('✅ Carga inicial completa, monitoreando cambios...');
    updateHeaderInfo();
    refreshPlayersUI();
    refreshPaymentsUI();
    refreshCalendarUI();
    if (typeof renderAccounting === 'function') renderAccounting();
  }, 2000);
}

// ========================================
// 🖼️ POLLING DE LOGO DEL CLUB (cada 60 min)
// ========================================
const POLL_LOGO_TTL_MS = 60 * 60 * 1000;

async function _fetchLogo(clubId) {
  try {
    const docSnap = await window.firebase.getDoc(
      window.firebase.doc(window.firebase.db, `clubs/${clubId}/assets`, 'logo')
    );
    if (!docSnap.exists()) return;
    const logo = docSnap.data()?.logo;
    if (!logo) return;
    const currentSettings = typeof getSchoolSettings === 'function'
      ? (getSchoolSettings() || {})
      : JSON.parse(localStorage.getItem('schoolSettings') || '{}');
    localStorage.setItem('schoolSettings', JSON.stringify({ ...currentSettings, logo }));
    localStorage.setItem(`logoLastFetch_${clubId}`, String(Date.now()));
    window.realtimeSyncState.lastSync = new Date().toISOString();
    console.log('🖼️ Logo actualizado');
  } catch (error) {
    console.error('❌ Error al obtener logo:', error);
  }
}

function startLogoListener(clubId) {
  const lastFetch = Number(localStorage.getItem(`logoLastFetch_${clubId}`) || '0');
  if (!lastFetch || (Date.now() - lastFetch) >= POLL_LOGO_TTL_MS) {
    _fetchLogo(clubId);
  } else {
    console.log('⚡ Logo en caché local, omitiendo descarga');
  }

  const intervalId = setInterval(async () => {
    if (window.realtimeSyncState.clubId !== clubId) return;
    await _fetchLogo(clubId);
    if (window.realtimeSyncState.initialLoadComplete) {
      updateHeaderInfo();
    }
  }, POLL_LOGO_TTL_MS);

  window.realtimeListeners.logo = () => clearInterval(intervalId);
  console.log('🖼️ Polling de logo iniciado (60 min)');
}

// ========================================
// 📋 LOG DE MOVIMIENTOS BAJO DEMANDA (sin listener permanente)
// ========================================
async function refreshPaymentMovementLogOnDemand(options = {}) {
  const force = options.force === true;
  const clubId = window.realtimeSyncState.clubId || localStorage.getItem('clubId');
  if (!clubId) return false;

  const cacheKey = `paymentLogLastFetch_${clubId}`;
  const lastFetch = Number(localStorage.getItem(cacheKey) || '0');
  if (!force && lastFetch && (Date.now() - lastFetch) < PAYMENT_LOG_FETCH_TTL_MS) {
    return false;
  }

  if (window.MODO_SUPABASE) {
    try {
      const res = await fetch(
        `${window.SUPA_URL}/rest/v1/payment_audit_log?club_id=eq.${encodeURIComponent(clubId)}&order=created_at.desc&limit=120`,
        { headers: { apikey: window.SUPA_ANON, Authorization: `Bearer ${window.SUPA_ANON}` } }
      );
      if (!res.ok) return false;
      const rows = await res.json();
      // Mapear con los MISMOS nombres de campo que usa renderPaymentMovementLog
      // (adminName, reason, playerName, invoiceNumber) — antes usaba userName/notes
      // y se veían vacíos en la tabla.
      const remote = rows.map(r => ({
        id:            r.id,
        action:        r.action,
        playerName:    r.player_name,
        amount:        r.amount,
        invoiceNumber: r.invoice_number,
        adminName:     r.admin_name,
        reason:        r.reason,
        timestamp:     r.created_at,
      }));
      // Merge en vez de sobrescribir: conservar entradas locales que aún no estén
      // en Supabase (recién creadas con el POST en vuelo, o creadas sin conexión),
      // para no borrar un movimiento que el usuario acaba de registrar.
      let local = [];
      try { local = JSON.parse(localStorage.getItem('paymentMovementLog') || '[]'); } catch (_) {}
      const remoteIds = new Set(remote.map(e => e.id).filter(Boolean));
      const localOnly = local.filter(e => e.id && !remoteIds.has(e.id));
      const merged = [...remote, ...localOnly]
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .slice(0, 200);
      localStorage.setItem('paymentMovementLog', JSON.stringify(merged));
      localStorage.setItem(cacheKey, String(Date.now()));
      console.log(`📋 [Supabase] Log de movimientos: ${remote.length} remotas + ${localOnly.length} locales`);
      return true;
    } catch (error) {
      console.warn('⚠️ Error actualizando log desde Supabase:', error);
      return false;
    }
  }

  try {
    const logSnapshot = await window.firebase.getDocs(
      window.firebase.query(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/paymentMovementLog`),
        window.firebase.orderBy('timestamp', 'desc'),
        window.firebase.limit(120)
      )
    );

    const entries = [];
    logSnapshot.forEach(doc => entries.push(doc.data()));
    localStorage.setItem('paymentMovementLog', JSON.stringify(entries));
    localStorage.setItem(cacheKey, String(Date.now()));
    console.log(`📋 Log de movimientos actualizado bajo demanda: ${entries.length} entradas`);
    return true;
  } catch (error) {
    console.warn('⚠️ Error actualizando log de movimientos bajo demanda:', error);
    return false;
  }
}

// ========================================
// 🔄 FUNCIONES DE ACTUALIZACIÓN DE UI
// ========================================

function refreshPlayersUI() {
  try {
    if (typeof renderPlayersList === 'function') renderPlayersList();
    if (typeof updateDashboard === 'function') updateDashboard();
    console.log('✅ UI de jugadores actualizada');
  } catch (error) {
    console.warn('⚠️ Error al actualizar UI de jugadores:', error);
  }
}

function refreshPaymentsUI() {
  try {
    if (typeof renderPayments === 'function') renderPayments();
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof renderAccounting === 'function') renderAccounting();
    console.log('✅ UI de pagos actualizada');
  } catch (error) {
    console.warn('⚠️ Error al actualizar UI de pagos:', error);
  }
}

function refreshCalendarUI() {
  try {
    if (typeof renderCalendar === 'function') renderCalendar();
    console.log('✅ UI de calendario actualizada');
  } catch (error) {
    console.warn('⚠️ Error al actualizar UI de calendario:', error);
  }
}

// ========================================
// 🔔 MOSTRAR NOTIFICACIÓN DE SINCRONIZACIÓN
// ========================================
function showSyncNotification(message) {
  if (typeof showToast === 'function') {
    showToast(message);
  }
  
  const indicator = document.getElementById('syncIndicator');
  if (indicator) {
    const lowQuality = (typeof getQualityLevel === 'function' && getQualityLevel() === 'low');
    if (!lowQuality) {
      indicator.classList.add('animate-pulse');
    }
    const dot = indicator.querySelector('.sync-dot');
    if (dot) {
      dot.style.backgroundColor = '#fbbf24';
      setTimeout(() => {
        dot.style.backgroundColor = '#22c55e';
      }, 1000);
    }
    setTimeout(() => {
      indicator.classList.remove('animate-pulse');
    }, 2000);
  }
}

// ========================================
// 🟢 FUNCIONES DEL INDICADOR (ORDEN CORRECTO)
// ========================================

// ✅ PRIMERO: Expandir indicador
function expandIndicator() {
  const indicator = document.getElementById('syncIndicator');
  const textEl = document.getElementById('syncText');
  
  if (!indicator || !textEl) return;
  
  indicator.style.paddingLeft = '12px';
  indicator.style.paddingRight = '12px';
  textEl.style.maxWidth = '250px';
  textEl.style.opacity = '1';
  textEl.style.marginLeft = '8px';
}

// ✅ SEGUNDO: Contraer indicador
function contractIndicator() {
  const indicator = document.getElementById('syncIndicator');
  const textEl = document.getElementById('syncText');
  
  if (!indicator || !textEl) return;
  
  textEl.style.maxWidth = '0px';
  textEl.style.opacity = '0';
  textEl.style.marginLeft = '0px';
  
  setTimeout(() => {
    indicator.style.paddingLeft = '8px';
    indicator.style.paddingRight = '8px';
  }, 300);
}

// ========================================
// 🟢 INDICADOR VISUAL DE SINCRONIZACIÓN
// ========================================
function showSyncIndicator(isActive) {
  let indicator = document.getElementById('syncIndicator');
  const lowQuality = (typeof getQualityLevel === 'function' && getQualityLevel() === 'low');
  
  if (!indicator) {
    // Crear indicador
    indicator = document.createElement('div');
    indicator.id = 'syncIndicator';
    indicator.className = 'fixed bottom-20 right-4 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 z-50 cursor-pointer flex items-center gap-2 px-3 py-2';
    indicator.style.transition = 'all 0.3s ease';
    indicator.title = 'Sincronización en tiempo real activa';
    
    indicator.innerHTML = `
  <span class="relative flex h-3 w-3" style="flex-shrink: 0;">
    ${lowQuality ? '' : '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>'}
    <span class="sync-dot relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
  </span>
`;

    
    // Click para mostrar/ocultar
indicator.onclick = function() {
  const state = window.realtimeSyncState;
  const lastSync = state.lastSync ? new Date(state.lastSync).toLocaleTimeString() : 'N/A';
  if (typeof showToast === 'function') {
    showToast(`🔄 Última sync: ${lastSync}`);
  }
};
    
    document.body.appendChild(indicator);
  }
  
  if (isActive) {
    // Mostrar indicador
    indicator.classList.remove('hidden');
    indicator.style.opacity = '1';
    

    
  } else {
    // Ocultar indicador completamente
    indicator.style.opacity = '0';
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
    
    const logoElements = document.querySelectorAll('#clubLogo, #headerLogo, [data-club-logo]');
    logoElements.forEach(el => {
      if (settings.logo && el.tagName === 'IMG') {
        el.src = settings.logo;
      }
    });
    
    const nameElements = document.querySelectorAll('#clubName, #headerClubName, [data-club-name]');
    nameElements.forEach(el => {
      if (settings.name) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.value = settings.name;
        } else {
          el.textContent = settings.name;
        }
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
  // ✅ FIX 1: Limpiar flag de historial completo en cada inicio
  // Evita que un clic previo en "Ver historial completo" deje el listener
  // de pagos sin límite de fecha de forma permanente.
  if (localStorage.getItem('paymentsFullHistory') === 'true') {
    localStorage.removeItem('paymentsFullHistory');
    console.log('🧹 Flag paymentsFullHistory limpiado al iniciar');
  }
  
  // ✅ MODO_SUPABASE: iniciar la sincronización directo, sin esperar a Firebase
  // (initFirebase fue eliminado, firebaseReady nunca se setea). Sin esto, al abrir
  // la app con sesión persistida no se descargan datos frescos de Supabase.
  if (window.MODO_SUPABASE) {
    const _cu = typeof getCurrentUser === 'function'
      ? getCurrentUser()
      : JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (_cu?.schoolId && typeof startRealtimeSync === 'function') {
      console.log('🔄 [Supabase] Sesión detectada, iniciando sincronización...');
      setTimeout(() => { try { startRealtimeSync(_cu.schoolId); } catch (e) { console.warn('startRealtimeSync:', e); } }, 1000);
    }
    return; // no arrancar el poller de Firebase (dead-code)
  }

  let attempts = 0;
  const maxAttempts = 30;

  const checkFirebase = setInterval(() => {
    attempts++;
    
    if (window.APP_STATE?.firebaseReady && window.firebase?.db && window.firebase?.onSnapshot) {
      clearInterval(checkFirebase);
      
      const currentUser = typeof getCurrentUser === 'function' 
        ? getCurrentUser() 
        : JSON.parse(localStorage.getItem('currentUser') || 'null');
      
      if (currentUser?.schoolId) {
        console.log('🔄 Sesión detectada, iniciando sincronización...');
        
        setTimeout(() => {
          startRealtimeSync(currentUser.schoolId);
        }, 1500);
      } else {
        console.log('ℹ️ No hay sesión activa');
      }
    }
    
    if (attempts >= maxAttempts) {
      clearInterval(checkFirebase);
      console.warn('⚠️ Timeout esperando Firebase');
    }
  }, 500);
});

// ========================================
// 🧹 LIMPIAR AL CERRAR SESIÓN
// ========================================
if (typeof window.logout === 'function') {
  const originalLogout = window.logout;
  window.logout = function() {
    stopRealtimeSync();
    if (typeof originalLogout === 'function') {
      originalLogout.apply(this, arguments);
    }
  };
}

window.addEventListener('beforeunload', function() {
  stopRealtimeSync();
});

// Exponer funciones globalmente
window.startRealtimeSync = startRealtimeSync;
window.stopRealtimeSync = stopRealtimeSync;
window.refreshPaymentMovementLogOnDemand = refreshPaymentMovementLogOnDemand;

console.log('✅ Módulo de sincronización en tiempo real listo');
