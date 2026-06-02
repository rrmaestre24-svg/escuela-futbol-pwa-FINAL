// ========================================
// COLA DE REINTENTOS A SUPABASE (outbox pattern)
// ========================================
// Cuando una escritura a Supabase falla (red caída, server down, etc.),
// la operación se encola en IndexedDB store `pendingSyncQueue`. Cuando vuelve
// internet o periódicamente, se reintenta cada operación pendiente.
//
// Estructura de cada item en la cola:
//   {
//     id: 'uuid',
//     table: 'payments' | 'players' | 'expenses' | 'events' | 'thirdPartyIncomes' |
//            'paymentMovementLog' | 'voidedPayments' | 'schoolSettings',
//     operation: 'upsert' | 'delete',
//     payload: { ... },        // datos a subir (para upsert) o { id } (para delete)
//     clubId: '...',
//     attempts: 0,
//     lastAttempt: null,       // timestamp ISO
//     createdAt: 'ISO timestamp'
//   }
//
// Triggers de processQueue:
//   - window 'online' event (al volver internet)
//   - polling cada 2 min (red flap, fallbacks)
//   - boot (entries pendientes de sesiones anteriores)
//   - manual desde consola: window.syncQueue.processQueue()

(function () {
  const STORE = 'pendingSyncQueue';
  const POLL_MS = 2 * 60 * 1000; // 2 min
  const MAX_ATTEMPTS = 10;       // tras 10 reintentos, descartar con error log

  let _pollIntervalId = null;
  let _processing = false; // mutex para no lanzar varios processQueue concurrentes

  function _uuid() {
    return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  // Encola una operación que falló. Llamado desde firebase-sync.js cuando una
  // escritura a Supabase tira excepción.
  async function enqueue(table, operation, payload, clubId) {
    if (!table || !operation) return { error: 'table y operation requeridos' };
    if (!window.idb || !window.idb.put) {
      console.warn('[syncQueue] IDB no disponible; no se puede encolar.');
      return { error: 'IDB no disponible' };
    }
    const item = {
      id: _uuid(),
      table,
      operation,
      payload,
      clubId: clubId || (typeof getClubId === 'function' ? getClubId() : null),
      attempts: 0,
      lastAttempt: null,
      createdAt: new Date().toISOString(),
    };
    try {
      await window.idb.put(STORE, item);
      console.log(`[syncQueue] 📤 Encolado: ${table}/${operation} (id=${item.id}). Total pendiente: ${await getQueueSize()}`);
      _notifyQueueChange();
      return { enqueued: true, id: item.id };
    } catch (err) {
      console.error('[syncQueue] Error al encolar:', err);
      return { error: err.message };
    }
  }

  async function getQueueSize() {
    if (!window.idb || !window.idb.count) return 0;
    try { return await window.idb.count(STORE); }
    catch (_) { return 0; }
  }

  async function getQueueItems() {
    if (!window.idb || !window.idb.getAll) return [];
    try { return await window.idb.getAll(STORE); }
    catch (_) { return []; }
  }

  // 🆕 Protege items locales aún en cola contra syncStore que clear+bulkPut.
  // Recibe la lista descargada de Supabase y la mergea con los items pendientes:
  //   - Excluye IDs con delete pendiente (el usuario los borró localmente).
  //   - Agrega/sobrescribe con upserts pendientes (el usuario los modificó localmente).
  // Si la cola está vacía o falla cualquier paso, devuelve remoteItems sin cambios.
  // Llamado desde firebase-sync.js antes de cada syncStore en downloadAllClubDataFromSupabase.
  async function mergeWithPending(table, remoteItems) {
    if (!Array.isArray(remoteItems)) return remoteItems;
    let items;
    try {
      items = await getQueueItems();
    } catch (e) {
      console.warn('[syncQueue] mergeWithPending getQueueItems falló:', e);
      return remoteItems;
    }
    if (!items || items.length === 0) return remoteItems;

    const pendingUpsertsById = {};
    const pendingDeleteIds = new Set();
    items.forEach(item => {
      if (!item || item.table !== table) return;
      if (item.operation === 'upsert' && item.payload && item.payload.id) {
        pendingUpsertsById[item.payload.id] = item.payload;
      } else if (item.operation === 'delete') {
        // payload puede ser string (id directo) o { id }
        const id = typeof item.payload === 'string' ? item.payload : item.payload && item.payload.id;
        if (id) pendingDeleteIds.add(id);
      }
    });

    if (Object.keys(pendingUpsertsById).length === 0 && pendingDeleteIds.size === 0) {
      return remoteItems;
    }

    const byId = {};
    remoteItems.forEach(r => {
      if (!r || !r.id) return;
      if (pendingDeleteIds.has(r.id)) return; // excluido por delete pendiente
      byId[r.id] = r;
    });
    // El delete tiene precedencia sobre upsert si por error coincide el id
    Object.entries(pendingUpsertsById).forEach(([id, payload]) => {
      if (!pendingDeleteIds.has(id)) byId[id] = payload;
    });

    const merged = Object.values(byId);
    if (merged.length !== remoteItems.length) {
      console.log(`[syncQueue] mergeWithPending(${table}): remotos=${remoteItems.length}, upserts pendientes=${Object.keys(pendingUpsertsById).length}, deletes pendientes=${pendingDeleteIds.size}, final=${merged.length}`);
    }
    return merged;
  }

  // Procesa la cola: para cada item, intenta volver a hacer la operación
  // contra Supabase. Si tiene éxito, borra de la cola. Si falla, incrementa
  // attempts y lo deja para el próximo ciclo.
  async function processQueue() {
    if (_processing) {
      console.log('[syncQueue] Ya se está procesando, salteando.');
      return { skipped: true };
    }
    if (!navigator.onLine) {
      console.log('[syncQueue] Sin internet, salteando.');
      return { skipped: true, reason: 'offline' };
    }
    _processing = true;
    let ok = 0, failed = 0, dropped = 0;
    try {
      const items = await getQueueItems();
      if (!items.length) return { ok: 0, failed: 0 };
      console.log(`[syncQueue] 🔄 Procesando ${items.length} operaciones pendientes...`);
      for (const item of items) {
        if (item.attempts >= MAX_ATTEMPTS) {
          console.error(`[syncQueue] ❌ Descartando tras ${MAX_ATTEMPTS} intentos:`, item);
          await window.idb.delete(STORE, item.id);
          dropped++;
          continue;
        }
        try {
          await _retryOperation(item);
          await window.idb.delete(STORE, item.id);
          ok++;
        } catch (err) {
          // Falla — incrementar attempts y actualizar
          item.attempts++;
          item.lastAttempt = new Date().toISOString();
          await window.idb.put(STORE, item);
          failed++;
          console.warn(`[syncQueue] ⚠️ Reintento ${item.attempts}/${MAX_ATTEMPTS} falló para ${item.table}/${item.operation}:`, err.message || err);
        }
      }
      if (ok > 0 || failed > 0 || dropped > 0) {
        console.log(`[syncQueue] ✅ ${ok} OK · ${failed} fallaron · ${dropped} descartadas. Pendientes restantes: ${await getQueueSize()}`);
      }
      _notifyQueueChange();
      return { ok, failed, dropped };
    } finally {
      _processing = false;
    }
  }

  // Despacha la operación al saveXToFirebase / deleteXFromFirebase
  // correspondiente. Esas funciones ya saben hablar con Supabase.
  // Si vuelve a fallar acá, throw → el item queda en cola con attempts++.
  async function _retryOperation(item) {
    const { table, operation, payload } = item;
    const fnMap = {
      'payments':              { upsert: 'savePaymentToFirebase',           delete: 'deletePaymentFromFirebase' },
      'players':               { upsert: 'savePlayerToFirebase',            delete: 'deletePlayerFromFirebase' },
      'expenses':              { upsert: 'saveExpenseToFirebase',           delete: 'deleteExpenseFromFirebase' },
      'events':                { upsert: 'saveEventToFirebase',             delete: 'deleteEventFromFirebase' },
      'thirdPartyIncomes':     { upsert: 'saveThirdPartyIncomeToFirebase',  delete: 'deleteThirdPartyIncomeFromFirebase' },
      'paymentMovementLog':    { upsert: 'savePaymentLogEntryToFirebase' },
      'voidedPayments':        { upsert: 'saveVoidedPaymentToFirebase' },
      'schoolSettings':        { upsert: 'saveSchoolSettingsToFirebase' },
    };
    const fnName = fnMap[table] && fnMap[table][operation];
    if (!fnName || typeof window[fnName] !== 'function') {
      throw new Error(`No hay función registrada para ${table}/${operation}`);
    }
    // Para evitar recursión infinita, marcamos que esta llamada NO debe encolar
    // si vuelve a fallar — el processQueue se encarga de manejar el error.
    window.__syncQueueProcessing = true;
    try {
      const result = await window[fnName](payload);
      // Algunas funciones devuelven false en error en vez de throw
      if (result === false) throw new Error(`${fnName} devolvió false`);
      return result;
    } finally {
      window.__syncQueueProcessing = false;
    }
  }

  function _notifyQueueChange() {
    window.dispatchEvent(new CustomEvent('sync-queue-changed'));
  }

  // Triggers automáticos:
  // 1. Cuando vuelve internet (`online` event).
  // 2. Polling cada 2 minutos (por si el evento online no disparó).
  // 3. Al boot, cuando IDB ya está lista.
  function setupListeners() {
    // 1. online event
    window.addEventListener('online', () => {
      console.log('[syncQueue] 🌐 Internet volvió — procesando cola...');
      processQueue();
    });
    // 2. Polling
    if (_pollIntervalId) clearInterval(_pollIntervalId);
    _pollIntervalId = setInterval(() => {
      if (navigator.onLine) processQueue();
    }, POLL_MS);
    console.log('[syncQueue] 🔁 Listeners activos (online + polling cada 2 min)');
  }

  // Envuelve una función save/delete*ToFirebase para que si falla,
  // encole automáticamente la operación para reintento.
  // Se llama desde boot() después de que firebase-sync.js cargó.
  function _wrapWithRetry(fnName, table, operation) {
    const original = window[fnName];
    if (typeof original !== 'function') {
      console.warn(`[syncQueue] No se encontró ${fnName} — no se envuelve.`);
      return;
    }
    window[fnName] = async function (arg) {
      // Detección temprana: si ya estamos offline, encolar sin intentar.
      if (!navigator.onLine && !window.__syncQueueProcessing) {
        try { await enqueue(table, operation, arg); }
        catch (e) { console.warn('[syncQueue] enqueue falló:', e); }
        return false;
      }
      let result;
      let succeeded = false;
      try {
        result = await original.call(this, arg);
        // Éxito = result === true. Cualquier otra cosa (false/undefined/null/0) se considera fallo.
        succeeded = (result === true);
      } catch (err) {
        console.warn(`[syncQueue] ${fnName} tiró excepción:`, err.message || err);
        succeeded = false;
      }
      if (!succeeded && !window.__syncQueueProcessing) {
        try { await enqueue(table, operation, arg); }
        catch (e) { console.warn('[syncQueue] enqueue falló:', e); }
      }
      return result === undefined ? false : result;
    };
  }

  // Mapa de qué función envolver y con qué tabla/operación.
  // Los nombres deben matchear el _retryOperation de arriba.
  const _WRAP_MAP = [
    ['savePaymentToFirebase',               'payments',              'upsert'],
    ['deletePaymentFromFirebase',           'payments',              'delete'],
    ['savePlayerToFirebase',                'players',               'upsert'],
    ['deletePlayerFromFirebase',            'players',               'delete'],
    ['saveExpenseToFirebase',               'expenses',              'upsert'],
    ['deleteExpenseFromFirebase',           'expenses',              'delete'],
    ['saveEventToFirebase',                 'events',                'upsert'],
    ['deleteEventFromFirebase',             'events',                'delete'],
    ['saveThirdPartyIncomeToFirebase',      'thirdPartyIncomes',     'upsert'],
    ['deleteThirdPartyIncomeFromFirebase',  'thirdPartyIncomes',     'delete'],
    ['savePaymentLogEntryToFirebase',       'paymentMovementLog',    'upsert'],
    ['saveVoidedPaymentToFirebase',         'voidedPayments',        'upsert'],
    ['saveSchoolSettingsToFirebase',        'schoolSettings',        'upsert'],
  ];

  function wrapAllSupabaseFunctions() {
    let wrapped = 0;
    _WRAP_MAP.forEach(([fnName, table, op]) => {
      if (typeof window[fnName] === 'function') {
        _wrapWithRetry(fnName, table, op);
        wrapped++;
      }
    });
    console.log(`[syncQueue] 🎁 ${wrapped}/${_WRAP_MAP.length} funciones envueltas para reintento automático.`);
  }

  async function boot() {
    // Esperar a que IDB esté lista (db-indexed.js boot ya pasó)
    if (!window.idb) {
      // Reintentar en 500ms
      setTimeout(boot, 500);
      return;
    }
    // Envolver funciones de Supabase para que encolen al fallar.
    // En este punto firebase-sync.js ya cargó (estamos en DOMContentLoaded).
    wrapAllSupabaseFunctions();

    const size = await getQueueSize();
    if (size > 0) {
      console.log(`[syncQueue] 📦 ${size} operaciones pendientes en la cola al iniciar.`);
      if (navigator.onLine) {
        processQueue();
      }
    } else {
      console.log('[syncQueue] ✅ Cola vacía al iniciar.');
    }
    setupListeners();
  }

  // API pública
  window.syncQueue = {
    enqueue, processQueue, getQueueSize, getQueueItems, setupListeners,
    mergeWithPending,
  };

  // Auto-boot cuando el documento está listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
