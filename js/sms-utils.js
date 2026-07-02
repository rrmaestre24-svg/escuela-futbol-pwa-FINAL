// ========================================
// SMS UTILS — callSendSms helper
// Dependencias: window.SUPA_URL, window.SUPA_ANON
// ========================================

/**
 * Normaliza un teléfono colombiano a formato E.164 (+57xxxxxxxxx)
 */
function normalizePhoneToE164(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  if (cleaned.startsWith('0')) cleaned = '57' + cleaned.slice(1);
  if (!cleaned.startsWith('57') && cleaned.length === 10) cleaned = '57' + cleaned;
  return '+' + cleaned;
}

/**
 * Llama a la Edge Function send-sms para enviar un SMS.
 * Respeta la config del club (dry_run, módulos habilitados, límites).
 *
 * @param {object} opts
 * @param {string} opts.club_id
 * @param {'recordatorios_pago'|'vencidos'|'cumpleaños'|'eventos'|'codigo_padres'} opts.modulo
 * @param {string} [opts.player_id]
 * @param {string} opts.phone        - Teléfono del destinatario
 * @param {string} opts.message      - Contenido del SMS
 * @param {boolean} [opts.force]     - Saltar validación de módulo habilitado
 * @returns {Promise<object|null>}
 */
async function callSendSms({ club_id, modulo, player_id, phone, message, force }) {
  const tel = normalizePhoneToE164(phone);
  if (!tel || tel.length < 12) {
    console.warn(`[SMS] Teléfono inválido para módulo ${modulo}: ${phone}`);
    return null;
  }

  const url = `${window.SUPA_URL}/functions/v1/send-sms`;
  const anon = window.SUPA_ANON;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anon,
        'Authorization': `Bearer ${anon}`,
      },
      body: JSON.stringify({
        club_id,
        modulo,
        player_id: player_id || null,
        phone: tel,
        message,
        force: !!force,
      }),
    });
    const data = await resp.json();
    console.log(`[SMS] ${modulo} → ${tel}: ${data.status}${data.log_id ? ' (log: '+data.log_id+')' : ''}`, data.error ? ` Error: ${data.error}` : '');
    return data;
  } catch (err) {
    console.error(`[SMS] Error en llamada a send-sms (${modulo}):`, err);
    return null;
  }
}

// Exponer globalmente
window.callSendSms = callSendSms;
window.normalizePhoneToE164 = normalizePhoneToE164;
