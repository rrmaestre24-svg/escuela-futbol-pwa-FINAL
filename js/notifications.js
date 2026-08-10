// ========================================
// SISTEMA DE NOTIFICACIONES
// ========================================

// Actualizar notificaciones
function updateNotifications() {
  const notifications = getPaymentNotifications();
  const badge = document.getElementById('notificationBadge');
  
  if (!badge) {
    console.warn('⚠️ Elemento #notificationBadge no encontrado. Saltando actualización.');
    return;
  }

  if (notifications.length > 0) {
    badge.textContent = notifications.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}
// 🆕 Gestión de notificaciones omitidas (persistencia)
function normalizeNotifId(notifId) {
  return String(notifId || '').trim();
}

function uniqueNotifIds(list = []) {
  return Array.from(new Set(
    (Array.isArray(list) ? list : [])
      .map(normalizeNotifId)
      .filter(Boolean)
  ));
}

/* ══════════════════════════════════════════════════════════════════════════
   DESCARTES EN LA NUBE (tabla notificaciones_descartadas)

   Antes vivían SOLO en localStorage. Dos problemas reales:
     · Se descartaba una alerta en el celular y seguía saliendo en la PC.
     · El cron de SMS no podía verlos → le mandaba un cobro a una familia que
       el club ya había marcado como resuelta.

   Ahora la base es la fuente durable y localStorage queda como caché y como
   respaldo sin internet. Con eso NO se pierde nada de lo que ya andaba: si la
   nube no contesta, todo sigue funcionando exactamente como antes.

   Se mantiene TODO sincrónico a propósito. `isDismissed()` se llama dentro de
   bucles de render; volverlo async obligaría a tocar el dashboard, la campana y
   la vista de notificaciones. En vez de eso se hidrata una lista en memoria una
   sola vez y se refrescan las vistas cuando llega.
   ══════════════════════════════════════════════════════════════════════════ */

let _descartesNube = [];        // ids traídos de la base
let _descartesHidratados = false;

function _descartesHeaders() {
  return { apikey: window.SUPA_ANON, Authorization: 'Bearer ' + window.SUPA_ANON };
}

/** Desarma `virtual_<playerId>_<mes0>_<año>` → { playerId, periodo:'YYYY-MM' }.
 *  El mes viene en base 0 (getMonth()), por eso el +1. Ver getVirtualNotifications(). */
function _partesDelDescarte(notifId) {
  const m = /^virtual_(.+)_(\d{1,2})_(\d{4})$/.exec(String(notifId || ''));
  if (!m) return { playerId: null, periodo: null };
  const mes = Number(m[2]) + 1;
  if (!(mes >= 1 && mes <= 12)) return { playerId: null, periodo: null };
  return { playerId: m[1], periodo: `${m[3]}-${String(mes).padStart(2, '0')}` };
}

/** ¿El descarte corresponde a alguien de ESTE club? Se comprueba contra la caché
 *  local, que ya está filtrada por club. Ante la duda (no se puede verificar),
 *  NO se sube: es preferible perder un descarte viejo antes que ensuciar la tabla
 *  de un club con datos de otro. */
function _esDeEsteClub(notifId) {
  const { playerId } = _partesDelDescarte(notifId);
  if (playerId) {
    if (typeof getPlayerById !== 'function') return false;
    // El try/catch no es de más: esta función corre dentro del .filter() de la
    // migración. Si lanzara, se perdería la migración ENTERA de esa sesión en vez
    // de saltear solo el id problemático.
    try { return !!getPlayerById(playerId); } catch (_) { return false; }
  }
  // Sin prefijo `virtual_` el id es el de un pago concreto.
  if (typeof getPendingPayments !== 'function') return false;
  try {
    return (getPendingPayments() || []).some(p => String(p.id) === String(notifId));
  } catch (_) {
    return false;
  }
}

/** Trae los descartes del club UNA vez y refresca las vistas si aparecieron nuevos. */
async function hidratarDescartesDesdeLaNube() {
  if (_descartesHidratados) return;
  _descartesHidratados = true;                 // aunque falle: no reintentar en bucle
  try {
    const clubId = localStorage.getItem('clubId');
    if (!clubId || !window.SUPA_URL || !window.SUPA_ANON) return;

    const res = await fetch(
      `${window.SUPA_URL}/rest/v1/notificaciones_descartadas`
      + `?club_id=eq.${encodeURIComponent(clubId)}&select=notif_id`,
      { headers: _descartesHeaders() }
    );
    if (!res.ok) return;                        // sin sesión o sin red: sigue el local
    const filas = await res.json();
    if (!Array.isArray(filas)) return;

    const deLaNube = filas.map(f => normalizeNotifId(f.notif_id)).filter(Boolean);
    const locales = getDismissedNotifications();

    // 1) Lo de la nube que no está local → sumarlo (esto es lo que arregla el
    //    "lo descarté en el celular y sigue en la PC").
    const nuevos = deLaNube.filter(id => !locales.includes(id));
    if (nuevos.length) {
      _descartesNube = deLaNube;
      persistDismissedNotifications([...locales, ...nuevos]);
      if (typeof updateNotifications === 'function') updateNotifications();
      if (typeof updateDashboardNotifications === 'function') updateDashboardNotifications();
    } else {
      _descartesNube = deLaNube;
    }

    // 2) Lo local que nunca llegó a la nube → subirlo. Es la migración de los
    //    descartes viejos, que solo existen en el navegador de cada persona.
    //
    //    🔒 Se filtra por jugador del club actual antes de subir. La lista local
    //    NO guarda a qué club pertenece cada descarte: si este navegador tuvo
    //    otro club antes, arrastraría ids de jugadores ajenos y los grabaría en
    //    la tabla de ESTE club. La limpieza al cerrar sesión (js/auth.js) ataca
    //    la raíz; esto es la segunda barrera para los navegadores que ya vienen
    //    contaminados de antes.
    const faltanArriba = locales.filter(id => !deLaNube.includes(id) && _esDeEsteClub(id));
    if (faltanArriba.length) await _subirDescartes(faltanArriba);
  } catch (e) {
    console.warn('[descartes] no se pudieron sincronizar:', e && e.message);
  }
}

/** Sube una lista de descartes en UNA sola petición.
 *  Nunca lanza: si falla, los descartes locales ya quedaron aplicados. */
async function _subirDescartes(notifIds, { silencioso = false } = {}) {
  try {
    const clubId = localStorage.getItem('clubId');
    if (!clubId || !window.SUPA_URL || !window.SUPA_ANON) return false;

    const usuario = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    const filas = (Array.isArray(notifIds) ? notifIds : [notifIds])
      .map(normalizeNotifId)
      .filter(Boolean)
      .map(id => {
        const { playerId, periodo } = _partesDelDescarte(id);
        return {
          club_id: clubId,
          notif_id: id,
          player_id: playerId,
          periodo,
          descartado_por: (usuario && (usuario.email || usuario.name)) || null,
        };
      });
    if (!filas.length) return true;

    const res = await fetch(
      // `on_conflict` NO es opcional: sin él, PostgREST resuelve el conflicto
      // contra la clave primaria (`id`), que siempre es nueva → el ON CONFLICT
      // nunca dispara y un reintento choca de verdad contra la restricción única.
      // Con esto, reintentar o descartar lo mismo desde dos dispositivos no falla.
      `${window.SUPA_URL}/rest/v1/notificaciones_descartadas?on_conflict=club_id,notif_id`,
      {
        method: 'POST',
        headers: {
          ..._descartesHeaders(),
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(filas),
      }
    );
    if (!res.ok && !silencioso) {
      console.warn('[descartes] no se pudo guardar en la nube:', res.status);
    }
    return res.ok;
  } catch (e) {
    if (!silencioso) console.warn('[descartes] error al guardar:', e && e.message);
    return false;
  }
}

function getDismissedNotifications() {
  let localDismissed = [];
  try {
    const dismissed = localStorage.getItem('dismissedNotifications');
    localDismissed = dismissed ? JSON.parse(dismissed) : [];
  } catch (e) {
    localDismissed = [];
  }

  const settings = typeof getSchoolSettings === 'function' ? getSchoolSettings() : {};
  const settingsDismissed = Array.isArray(settings?.dismissedNotifications)
    ? settings.dismissedNotifications
    : [];

  const merged = uniqueNotifIds([...localDismissed, ...settingsDismissed, ..._descartesNube]);

  try {
    localStorage.setItem('dismissedNotifications', JSON.stringify(merged));
  } catch (e) {}

  // Primera consulta de la sesión: se dispara la sincronización con la nube en
  // segundo plano. No se espera (esta función es sincrónica y la llaman bucles
  // de render); cuando termine refresca las vistas por su cuenta.
  if (!_descartesHidratados) hidratarDescartesDesdeLaNube();

  return merged;
}

function persistDismissedNotifications(list) {
  const safeList = uniqueNotifIds(list);

  try {
    localStorage.setItem('dismissedNotifications', JSON.stringify(safeList));
  } catch (e) {}

  if (typeof updateSchoolSettings === 'function') {
    const currentSettings = typeof getSchoolSettings === 'function' ? getSchoolSettings() : {};
    const currentDismissed = uniqueNotifIds(currentSettings?.dismissedNotifications || []);

    if (JSON.stringify(currentDismissed) !== JSON.stringify(safeList)) {
      updateSchoolSettings({ dismissedNotifications: safeList });
    }
  }
}

window.dismissNotification = function(notifId) {
  const safeId = normalizeNotifId(notifId);
  if (!safeId) return;

  const dismissed = getDismissedNotifications();
  if (!dismissed.includes(safeId)) {
    dismissed.push(safeId);
    persistDismissedNotifications(dismissed);
    // Se guarda también en la nube, sin esperar: la alerta se oculta ya mismo
    // igual que antes. Si la subida falla, el descarte local sigue valiendo y se
    // reintenta en la próxima sincronización.
    _subirDescartes([safeId]);
    showToast('🗑️ Notificación eliminada permanentemente');
    // Refrescar vistas
    if (typeof updateNotifications === 'function') updateNotifications();
    if (typeof updateDashboardNotifications === 'function') updateDashboardNotifications();
    if (typeof renderNotifications === 'function') renderNotifications();
  }
};

function isDismissed(notifId) {
  return getDismissedNotifications().includes(normalizeNotifId(notifId));
}

function getMonthlyAutomationSettings() {
  const settings = typeof getSchoolSettings === 'function' ? getSchoolSettings() : {};
  const dueDayNum = Number(settings.monthlyDueDay);
  const graceDaysNum = Number(settings.monthlyGraceDays);
  const monthlyDueDay = Number.isFinite(dueDayNum) ? Math.max(1, Math.min(28, dueDayNum)) : 10;
  const monthlyGraceDays = Number.isFinite(graceDaysNum) ? Math.max(0, Math.min(60, graceDaysNum)) : 5;
  return { monthlyDueDay, monthlyGraceDays };
}

// Obtener notificaciones de pagos (REALES + VIRTUALES)
function getPaymentNotifications() {
  const payments = getPendingPayments();
  const today = new Date();
  const notifications = [];
  const { monthlyGraceDays } = getMonthlyAutomationSettings();
  
  // 1. Notificaciones de facturas Reales (Pendientes)
  payments.forEach(payment => {
    if (isDismissed(payment.id)) return; // 🆕 Filtrar si fue omitida
    
    const dueDate = new Date(payment.dueDate);
    const daysDiff = daysBetween(today, dueDate);
    
    let type = '';
    let priority = '';
    let message = '';
    
    if (daysDiff === 4 || daysDiff === 3) {
      type = 'warning';
      priority = 'media';
      message = `Pago próximo a vencer en ${daysDiff} día${daysDiff > 1 ? 's' : ''}`;
    }
    else if (daysDiff >= (monthlyGraceDays * -1) && daysDiff <= 0) {
      type = 'info';
      priority = 'media';
      message = `Pago en período de gracia (${Math.abs(daysDiff)} día${Math.abs(daysDiff) > 1 ? 's' : ''} de retraso)`;
    }
    else if (daysDiff < (monthlyGraceDays * -1)) {
      type = 'danger';
      priority = 'alta';
      message = `Pago VENCIDO (${Math.abs(daysDiff)} día${Math.abs(daysDiff) > 1 ? 's' : ''} de retraso)`;
    }
    
    if (type) {
      notifications.push({
        id: payment.id,
        paymentId: payment.id,
        type,
        priority,
        message,
        daysDiff,
        payment,
        isVirtual: false
      });
    }
  });

  // 2. Notificaciones Virtuales (Por Historial)
  const virtualNotifications = getVirtualNotifications();
  notifications.push(...virtualNotifications);
  
  // Ordenar por prioridad: alta > media
  return notifications.sort((a, b) => {
    if (a.priority === 'alta' && b.priority !== 'alta') return -1;
    if (a.priority !== 'alta' && b.priority === 'alta') return 1;
    return a.daysDiff - b.daysDiff;
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   DEUDA CALCULADA EN EL SERVIDOR (fn_deuda_jugadores)

   Hasta ahora cada módulo calculaba por su cuenta quién debe, con reglas
   distintas: el dashboard escondía a los jugadores SIN NINGÚN pago registrado
   (144 en la plataforma, justamente los peores), Contabilidad los contaba, y el
   badge "Moroso" de asistencias no encendía nunca.

   Ahora manda una sola función en la base, que replica la regla de Contabilidad
   —la que no esconde a nadie— y está validada jugador por jugador contra ella.

   Si la nube no contesta, se usa el cálculo local de siempre. Nunca se queda
   sin notificaciones por un problema de red.
   ══════════════════════════════════════════════════════════════════════════ */

let _deudaNube = null;          // null = todavía no llegó; [] = llegó y no hay deuda
let _deudaHidratada = false;

/**
 * Tira la deuda cacheada para que la próxima consulta la vuelva a pedir.
 *
 * ⚠️ HAY QUE LLAMARLA DESPUÉS DE TODA ESCRITURA DE PAGOS. Sin esto la campana y
 * el dashboard siguen mostrando la alerta de un pago que se acaba de cobrar hasta
 * que se recargue la página — y el botón "Enviar Recordatorio" queda activo sobre
 * esa alerta vieja, listo para mandarle un cobro por WhatsApp a una familia que ya
 * pagó. Antes no hacía falta porque el cálculo era local y se rehacía en cada
 * render; ahora el dato viene del servidor y queda en memoria.
 */
let _deudaTimer = null;

function invalidarDeudaNube() {
  _deudaNube = null;
  _deudaHidratada = true;   // ⚠️ true a propósito: frena la consulta inmediata

  // Por qué se espera y no se consulta al toque. Dos motivos:
  //
  //  1. `updatePayment()` guarda en Supabase SIN await (js/storage.js). Si
  //     preguntamos enseguida, el servidor puede contestar que el jugador sigue
  //     debiendo —porque el guardado todavía no llegó— y esa respuesta pisa el
  //     cálculo local, que sí era correcto. El admin ve reaparecer una alerta que
  //     acaba de resolver.
  //  2. Un admin que carga 30 mensualidades seguidas dispararía 30 consultas.
  //
  // Mientras tanto no se pierde nada: con `_deudaNube` en null, getVirtualNotifications()
  // cae al cálculo LOCAL, que lee los pagos en vivo y ya refleja el cobro al instante.
  if (_deudaTimer) clearTimeout(_deudaTimer);
  _deudaTimer = setTimeout(() => {
    _deudaTimer = null;
    _deudaHidratada = false;          // recién ahora se permite volver a preguntar
    hidratarDeudaDesdeLaNube();
  }, 3000);
}
window.invalidarDeudaNube = invalidarDeudaNube;

async function hidratarDeudaDesdeLaNube() {
  if (_deudaHidratada) return;
  _deudaHidratada = true;                      // aunque falle: no reintentar en bucle
  try {
    const clubId = localStorage.getItem('clubId');
    if (!clubId || !window.SUPA_URL || !window.SUPA_ANON) return;

    const res = await fetch(`${window.SUPA_URL}/rest/v1/rpc/fn_deuda_jugadores`, {
      method: 'POST',
      headers: { ..._descartesHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_club_id: clubId }),
    });
    if (!res.ok) return;                        // sin sesión o sin red: sigue el local
    const filas = await res.json();
    if (!Array.isArray(filas)) return;

    _deudaNube = filas;
    if (typeof updateNotifications === 'function') updateNotifications();
    if (typeof updateDashboardNotifications === 'function') updateDashboardNotifications();
    // También la vista expandida: si está abierta cuando llega el dato, sin esto
    // se queda con el cálculo local hasta la próxima interacción.
    if (typeof renderNotifications === 'function'
        && document.getElementById('notificationsList')) renderNotifications();
  } catch (e) {
    console.warn('[deuda] no se pudo consultar al servidor:', e && e.message);
  }
}

/** Arma las alertas a partir de la deuda que calculó el servidor.
 *  Una alerta por jugador —la del mes más viejo—, igual que antes: mostrar los
 *  1.196 conceptos volvería la campana inusable. */
function _alertasDesdeLaNube() {
  const today = new Date();
  const { monthlyGraceDays } = getMonthlyAutomationSettings();
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const out = [];

  for (const fila of _deudaNube) {
    if (!fila || !fila.primer_mes || !fila.vencimiento) continue;

    const [anio, mes] = String(fila.primer_mes).split('-').map(Number);
    if (!(mes >= 1 && mes <= 12)) continue;

    // Mismo id de siempre (mes en base 0) para no invalidar los descartes ya hechos.
    const notifId = `virtual_${fila.player_id}_${mes - 1}_${anio}`;
    if (isDismissed(notifId)) continue;

    // El vencimiento viene del servidor con el día de pago del club ya aplicado.
    // daysDiff se calcula acá con el mismo helper de siempre → los textos no cambian.
    const daysDiff = daysBetween(today, String(fila.vencimiento).slice(0, 10));

    let type = '', priority = '', message = '';
    const nombreMes = (monthNames[mes - 1] || '').toUpperCase();

    if (daysDiff === 4 || daysDiff === 3) {
      type = 'warning';
      priority = 'media';
      message = `Mensualidad de ${nombreMes} pronto a vencer en ${daysDiff} día${daysDiff > 1 ? 's' : ''}`;
    } else if (daysDiff <= 0) {
      type = daysDiff < (monthlyGraceDays * -1) ? 'danger' : 'warning';
      priority = 'alta';
      const label = daysDiff === 0
        ? 'vence hoy'
        : (daysDiff < (monthlyGraceDays * -1)
          ? `vencido por ${Math.abs(daysDiff)} días`
          : `en gracia (${Math.abs(daysDiff)} día${Math.abs(daysDiff) > 1 ? 's' : ''})`);
      message = `Falta pago de ${nombreMes} (${label})`;
    }
    if (!type) continue;

    // El objeto `player` lo espera el render (foto, nombre, categoría). Se toma de
    // la caché local; si no está, se arma uno mínimo con lo que trajo el servidor.
    const player = (typeof getPlayerById === 'function' ? getPlayerById(fila.player_id) : null)
      || { id: fila.player_id, name: fila.nombre, category: fila.categoria, phone: fila.telefono };

    out.push({
      id: notifId,
      playerId: fila.player_id,
      type, priority, message, daysDiff,
      nextDueDate: String(fila.vencimiento).slice(0, 10),
      mesesAdeudados: fila.cantidad_meses,
      montoEstimado: fila.monto_estimado,
      isVirtual: true,
      player,
    });
  }

  // El servidor solo devuelve meses YA vencidos: el mes en curso queda afuera a
  // propósito. Sin esto se perdería el aviso anticipado ("vence en 3 días"), que
  // es justamente el que sirve para que el club genere las mensualidades a tiempo.
  return out.concat(_alertasProximasAVencer(new Set(out.map(a => a.playerId))));
}

/**
 * Aviso ANTICIPADO del mes en curso: "Mensualidad de AGOSTO pronto a vencer en 3 días".
 *
 * Se calcula local porque `fn_deuda_jugadores` no devuelve el mes actual (todavía
 * no venció). No se pisa con las alertas del servidor: aplica solo a los jugadores
 * que NO tienen deuda vieja — el resto ya tiene una alerta más urgente, y el
 * dashboard muestra una por jugador.
 */
function _alertasProximasAVencer(idsConDeuda) {
  const out = [];
  try {
    if (typeof getActivePlayers !== 'function' || typeof getPayments !== 'function') return out;

    const { monthlyDueDay } = getMonthlyAutomationSettings();
    const hoy = new Date();

    // Se evalúan el mes en curso Y el siguiente, igual que hacía el código viejo
    // (que miraba anterior/actual/siguiente). Con esto no se pierde el aviso en
    // clubes con día de pago bajo: si cobran el 1, el "faltan 3 días" cae el 28 o
    // 29 del mes ANTERIOR. Hoy son dos clubes reales (Furia y MY CLUB, día 1).
    let anio = 0, mes0 = -1, vence = '', daysDiff = 0;
    for (const salto of [0, 1]) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() + salto, 1);
      const cand = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(monthlyDueDay).padStart(2, '0')}`;
      const dias = daysBetween(hoy, cand);
      if (dias === 3 || dias === 4) {
        anio = d.getFullYear(); mes0 = d.getMonth(); vence = cand; daysDiff = dias;
        break;
      }
    }
    // Ningún mes vence en 3 o 4 días: no hay nada que avisar y nos ahorramos
    // recorrer todos los jugadores (pasa ~29 de cada 31 días).
    if (mes0 < 0) return out;

    const nombreMes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                       'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][mes0];
    const mesISO = `${anio}-${String(mes0 + 1).padStart(2, '0')}`;
    const pagos = getPayments();

    for (const player of getActivePlayers()) {
      if (idsConDeuda.has(player.id)) continue;         // ya tiene una alerta más urgente

      const notifId = `virtual_${player.id}_${mes0}_${anio}`;
      if (isDismissed(notifId)) continue;

      // No reclamar meses anteriores al ingreso (o al reingreso) del jugador.
      // Se parsea con parseLocalDate y NO se recorta el string: en la base
      // conviven fechas 'YYYY-MM-DD' y 'DD/MM/YYYY', y un slice(0,7) sobre la
      // segunda da "15/03/2", que comparado como texto deja pasar al jugador.
      // Si están las dos fechas se toma la MÁS RECIENTE, igual que el cálculo
      // viejo: un chico que reingresó no debe recibir avisos por meses previos
      // a su reingreso, aunque su inscripción original sea vieja.
      const _fechas = [player.notificationsStartDate, player.enrollmentDate]
        .filter(Boolean)
        .map(f => parseLocalDate(f))
        .filter(d => !isNaN(d.getTime()));
      if (_fechas.length) {
        const d = new Date(Math.max(..._fechas.map(x => x.getTime())));
        const desdeISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (desdeISO > mesISO) continue;
      }

      // Regla vieja que se mantiene: a un jugador sin NINGÚN pago registrado no se
      // le generan alertas virtuales. Su deuda ya la reporta el servidor por el
      // otro camino; acá evita avisarle a alguien recién cargado.
      const suyos = pagos.filter(p => p.playerId === player.id);
      if (suyos.length === 0) continue;

      // ¿Ya tiene la mensualidad de este mes? Cuenta igual si está en 'Pendiente':
      // la factura existe, que es lo que este aviso viene a recordar.
      const yaFacturado = suyos.some(p => {
        const concepto = (p.concept || '').toLowerCase();
        const esMensual = p.type === 'Mensualidad' || concepto.includes('mensua');
        if (!esMensual) return false;
        if (p.status !== 'Pagado' && p.status !== 'Pendiente') return false;
        const f = parseLocalDate(p.paidDate || p.dueDate);
        const mismoMes = !isNaN(f.getTime()) && f.getMonth() === mes0 && f.getFullYear() === anio;
        return mismoMes || concepto.includes(nombreMes);
      });
      if (yaFacturado) continue;

      out.push({
        id: notifId,
        playerId: player.id,
        type: 'warning',
        priority: 'media',
        message: `Mensualidad de ${nombreMes.toUpperCase()} pronto a vencer en ${daysDiff} día${daysDiff > 1 ? 's' : ''}`,
        daysDiff,
        nextDueDate: vence,
        isVirtual: true,
        player,
      });
    }
  } catch (e) {
    console.warn('[deuda] aviso anticipado omitido:', e && e.message);
  }
  return out;
}

// 🆕 Calcular notificaciones virtuales basadas en meses faltantes
function getVirtualNotifications() {
  // Preferimos la cuenta del servidor. El cálculo local de abajo queda como
  // respaldo para cuando todavía no llegó, o no hay red.
  if (!_deudaHidratada) hidratarDeudaDesdeLaNube();
  if (Array.isArray(_deudaNube)) return _alertasDesdeLaNube();

  const players = getActivePlayers();
  const allPayments = getPayments();
  const today = new Date();
  const virtualNotifs = [];
  const { monthlyDueDay, monthlyGraceDays } = getMonthlyAutomationSettings();

  // Definir meses a verificar (Pasado, Actual, Próximo)
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  const targets = [];
  for (let i = -1; i <= 1; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    targets.push({
      month: d.getMonth(),
      year: d.getFullYear(),
      name: monthNames[d.getMonth()],
      dueDate: new Date(d.getFullYear(), d.getMonth(), monthlyDueDay)
    });
  }

  console.log('🔍 Meses a verificar:', targets.map(t => `${t.name} ${t.year}`));

  players.forEach(player => {
    const playerPayments = allPayments.filter(p => p.playerId === player.id);

    // Mantener comportamiento original: sin pagos registrados no se generan virtuales.
    if (playerPayments.length === 0) return;

    // Regla de negocio: nunca notificar meses anteriores al inicio válido.
    // Prioridad de inicio:
    // 1) notificationsStartDate (cuando se reactiva)
    // 2) enrollmentDate (inscripción)
    // 3) primera mensualidad histórica válida (datos antiguos)
    let notifyFromMonth = null;
    const startCandidates = [];
    const notificationsStart = player.notificationsStartDate ? parseLocalDate(player.notificationsStartDate) : null;
    const enrollment = player.enrollmentDate ? parseLocalDate(player.enrollmentDate) : null;

    if (notificationsStart && !isNaN(notificationsStart.getTime())) {
      startCandidates.push(new Date(notificationsStart.getFullYear(), notificationsStart.getMonth(), 1).getTime());
    }
    if (enrollment && !isNaN(enrollment.getTime())) {
      startCandidates.push(new Date(enrollment.getFullYear(), enrollment.getMonth(), 1).getTime());
    }

    if (startCandidates.length > 0) {
      // Tomar la más reciente para evitar reclamar meses anteriores al reingreso.
      notifyFromMonth = Math.max(...startCandidates);
    } else {
      const monthlyDates = playerPayments
        .filter(p => {
          const concept = (p.concept || '').toLowerCase();
          return p.type === 'Mensualidad' || concept.includes('mensua');
        })
        .map(p => parseLocalDate(p.paidDate || p.dueDate))
        .filter(d => !isNaN(d.getTime()))
        .map(d => new Date(d.getFullYear(), d.getMonth(), 1).getTime());

      if (monthlyDates.length === 0) return;
      notifyFromMonth = Math.min(...monthlyDates);
    }

    // Buscar para cada mes objetivo si está cubierto
    for (const target of targets) {
      const notifId = `virtual_${player.id}_${target.month}_${target.year}`;

      // 1. Ignorar si está omitida manualmente
      if (isDismissed(notifId)) continue;

      // 2. Ignorar meses anteriores o iguales al mes de la primera factura
      const targetMonthStart = new Date(target.year, target.month, 1).getTime();
      if (targetMonthStart < notifyFromMonth) continue;

      const pConcept = target.name.toLowerCase();
      const isPaid = playerPayments.some(p => {
        const pDate = parseLocalDate(p.paidDate || p.dueDate);
        const pConceptStr = (p.concept || '').toLowerCase();

        // Cubierto si:
        // 1. Es mensualidad y la fecha coincide con el mes/año
        // 2. O el concepto menciona el nombre del mes
        const isMonthly = p.type === 'Mensualidad' || pConceptStr.includes('mensua');
        const sameMonth = pDate.getMonth() === target.month && pDate.getFullYear() === target.year;
        const mentionsMonth = pConceptStr.includes(pConcept);

        return isMonthly && (sameMonth || mentionsMonth) && (p.status === 'Pagado' || p.status === 'Pendiente');
      });

      if (!isPaid) {
        // Generar alerta para el primer mes no pagado
        const targetDateStr = `${target.year}-${String(target.month + 1).padStart(2, '0')}-${String(monthlyDueDay).padStart(2, '0')}`;
        const daysDiff = daysBetween(today, targetDateStr);
        
        let type = '';
        let priority = '';
        let message = '';

        if (daysDiff === 4 || daysDiff === 3) {
          type = 'warning';
          priority = 'media';
          message = `Mensualidad de ${target.name.toUpperCase()} pronto a vencer en ${daysDiff} día${daysDiff > 1 ? 's' : ''}`;
        } else if (daysDiff <= 0) {
          type = daysDiff < (monthlyGraceDays * -1) ? 'danger' : 'warning';
          priority = 'alta';
          const label = daysDiff === 0
            ? 'vence hoy'
            : (daysDiff < (monthlyGraceDays * -1)
              ? `vencido por ${Math.abs(daysDiff)} días`
              : `en gracia (${Math.abs(daysDiff)} día${Math.abs(daysDiff) > 1 ? 's' : ''})`);
          message = `Falta pago de ${target.name.toUpperCase()} (${label})`;
        }

        if (type) {
           console.log(`✅ Alerta creada para ${player.name}: ${message}`);
           virtualNotifs.push({
            id: notifId,
            playerId: player.id,
            type,
            priority,
            message,
            daysDiff,
            nextDueDate: targetDateStr,
            isVirtual: true,
            player
          });
          break; // Solo mostrar el más antiguo pendiente
        }
      }
    }
  });

  return virtualNotifs;
}

// Mostrar vista de notificaciones
function showNotificationsView() {
  // 🆕 Ahora en lugar de cambiar de vista, redirigimos al Dashboard y expandimos
  if (typeof navigateTo === 'function') {
    navigateTo('dashboard');
    
    // Esperar a que el dashboard cargue y aplicar la expansión
    setTimeout(() => {
      if (typeof toggleNotificationsExpansion === 'function') {
        toggleNotificationsExpansion(true);
      }
    }, 150);
  } else {
    // Fallback por si acaso
    renderNotifications();
  }
}

// Renderizar notificaciones
function renderNotifications() {
  const notifications = getPaymentNotifications();
  const container = document.getElementById('notificationsList');
  
  if (notifications.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔔</div>
        <p class="text-gray-500 dark:text-gray-400">No hay notificaciones</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">Todos los pagos están al día</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = notifications.map(notif => {
    const player = notif.player || getPlayerById(notif.payment?.playerId || notif.playerId);
    if (!player) return '';
    
    const colors = {
      'danger': { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-l-4 border-red-500', icon: 'text-red-600', badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
      'warning': { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-l-4 border-yellow-500', icon: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
      'info': { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-l-4 border-blue-500', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' }
    };
    
    const color = colors[notif.type];
    
    return `
      <div class="${color.bg} ${color.border} rounded-lg p-4 animate-slide-in">
        <div class="flex items-start gap-3 ${notif.isVirtual ? 'mb-2' : 'mb-3'}">
          <i data-lucide="${notif.isVirtual ? 'calendar-clock' : 'alert-circle'}" class="w-6 h-6 ${color.icon} flex-shrink-0 mt-1"></i>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div>
                <h4 class="font-bold text-gray-800 dark:text-white">${player.name}</h4>
                <p class="text-sm text-gray-600 dark:text-gray-300">${player.category}</p>
              </div>
              <span class="badge ${color.badge} text-xs">${notif.priority.toUpperCase()}${notif.isVirtual ? ' • AUTO' : ''}</span>
            </div>
            <p class="text-sm font-medium text-gray-800 dark:text-white mb-1">${notif.message}</p>
            ${!notif.isVirtual ? `
              <div class="text-sm text-gray-600 dark:text-gray-400">
                <p><strong>Concepto:</strong> ${notif.payment.concept}</p>
                <p><strong>Monto:</strong> ${formatCurrency(notif.payment.amount)}</p>
                <p><strong>Vencimiento:</strong> ${formatDate(notif.payment.dueDate)}</p>
              </div>
            ` : `
               <div class="text-sm text-blue-600 dark:text-blue-400 italic">
                Cálculo automático basado en último pago registrado.
              </div>
            `}
          </div>
        </div>
        
        <div class="flex gap-2">
          ${!notif.isVirtual ? `
            <button onclick="generatePaymentNotificationPDF('${notif.paymentId}')" class="flex-1 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
              <i data-lucide="download" class="w-4 h-4"></i>
              PDF
            </button>
            <button onclick="sendPaymentNotificationWhatsApp('${notif.paymentId}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
              <i data-lucide="message-circle" class="w-4 h-4"></i>
              WhatsApp
            </button>
            <button onclick="markAsPaid('${notif.paymentId}'); renderNotifications();" class="bg-teal-600 hover:bg-teal-700 text-white text-sm py-2 px-3 rounded-lg" title="Marcar como pagado">
              <i data-lucide="check" class="w-4 h-4"></i>
            </button>
          ` : `
            <button onclick="sendVirtualReminderWhatsApp('${notif.playerId}', '${notif.nextDueDate}')" class="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 font-medium">
              <i data-lucide="message-circle" class="w-4 h-4"></i>
              Enviar Recordatorio por Historial
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

console.log('✅ notifications.js cargado');