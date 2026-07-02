// ========================================
// SMS HISTORY — Visor de historial de mensajes
// ========================================

let _smsHistoryCache = [];

// Escape local para render con innerHTML (nombres/teléfonos vienen de la BD)
function _smsEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadSmsHistory() {
  const clubId = typeof getClubId === 'function' ? getClubId() : localStorage.getItem('clubId');
  if (!clubId) return;

  const container = document.getElementById('smsHistoryList');
  if (!container) return;

  try {
    container.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Cargando historial...</p>';

    const res = await fetch(
      `${window.SUPA_URL}/rest/v1/message_log?club_id=eq.${encodeURIComponent(clubId)}&order=created_at.desc&limit=30`,
      {
        headers: {
          'apikey': window.SUPA_ANON,
          'Authorization': `Bearer ${window.SUPA_ANON}`,
        },
      }
    );

    if (!res.ok) {
      container.innerHTML = '<p class="text-sm text-red-400 text-center py-4">Error al cargar historial</p>';
      return;
    }

    const logs = await res.json();
    if (!Array.isArray(logs) || logs.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Sin mensajes aún</p>';
      return;
    }

    _smsHistoryCache = logs;

    const players = typeof getPlayers === 'function' ? getPlayers() : [];

    function getPlayerName(playerId) {
      const p = players.find(p2 => p2.id === playerId);
      return p ? p.name : '—';
    }

    function getPlayerPhone(log) {
      if (log.phone) return log.phone;
      const p = players.find(p2 => p2.id === log.player_id);
      return p ? p.phone : '—';
    }

    const moduloLabels = {
      recordatorios_pago: 'Recordatorio Pago',
      vencidos: 'Vencidos',
      cumpleaños: 'Cumpleaños',
      eventos: 'Eventos',
      codigo_padres: 'Código Padres',
    };

    container.innerHTML = logs.map(log => {
      const fecha = log.created_at ? new Date(log.created_at).toLocaleString('es-CO', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      }) : '—';

      const estado = log.status;
      let badgeClass = 'bg-gray-500';
      let badgeText = estado;
      if (estado === 'sent') { badgeClass = 'bg-green-500'; badgeText = 'Enviado'; }
      else if (estado === 'dry_run') { badgeClass = 'bg-green-500'; badgeText = 'Simulado'; }
      else if (estado === 'failed' || estado === 'error') { badgeClass = 'bg-red-500'; badgeText = 'Error'; }

      const errorTooltip = (estado === 'failed' || estado === 'error') && log.error
        ? ` title="${_smsEscape(log.error)}"`
        : '';

      return `<tr class="border-b border-gray-700/50 text-xs">
        <td class="py-2 px-1 text-gray-300 whitespace-nowrap">${fecha}</td>
        <td class="py-2 px-1 text-white font-medium">${_smsEscape(getPlayerName(log.player_id))}</td>
        <td class="py-2 px-1 text-gray-400">${_smsEscape(getPlayerPhone(log))}</td>
        <td class="py-2 px-1 text-gray-400">${_smsEscape(moduloLabels[log.modulo] || log.modulo)}</td>
        <td class="py-2 px-1">
          <span class="inline-block px-2 py-0.5 rounded-full text-white text-[10px] font-semibold ${badgeClass}"${errorTooltip}>${badgeText}</span>
        </td>
      </tr>`;
    }).join('');

  } catch (err) {
    console.error('[SMS History]', err);
    container.innerHTML = '<p class="text-sm text-red-400 text-center py-4">Error de conexión</p>';
  }
}

window.loadSmsHistory = loadSmsHistory;
