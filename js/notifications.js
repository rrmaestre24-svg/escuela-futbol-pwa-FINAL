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

// Obtener notificaciones de pagos (REALES + VIRTUALES)
function getPaymentNotifications() {
  const payments = getPendingPayments();
  const today = new Date();
  const notifications = [];
  
  // 1. Notificaciones de facturas Reales (Pendientes)
  payments.forEach(payment => {
    const dueDate = new Date(payment.dueDate);
    const daysDiff = daysBetween(today, dueDate);
    
    let type = '';
    let priority = '';
    let message = '';
    
    if (daysDiff > 0 && daysDiff <= 10) {
      type = 'warning';
      priority = 'media';
      message = `Pago próximo a vencer en ${daysDiff} día${daysDiff > 1 ? 's' : ''}`;
    }
    else if (daysDiff >= -40 && daysDiff <= 0) {
      type = 'info';
      priority = 'media';
      message = `Pago en período de gracia (${Math.abs(daysDiff)} día${Math.abs(daysDiff) > 1 ? 's' : ''} de retraso)`;
    }
    else if (daysDiff < -40) {
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

// 🆕 Calcular notificaciones virtuales basadas en meses faltantes
function getVirtualNotifications() {
  const players = getActivePlayers();
  const allPayments = getPayments();
  const today = new Date();
  const virtualNotifs = [];

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
      dueDate: new Date(d.getFullYear(), d.getMonth(), 10) // Día 10 por defecto
    });
  }

  console.log('🔍 Meses a verificar:', targets.map(t => `${t.name} ${t.year}`));

  players.forEach(player => {
    const playerPayments = allPayments.filter(p => p.playerId === player.id);
    
    // Buscar para cada mes objetivo si está cubierto
    for (const target of targets) {
      const isPaid = playerPayments.some(p => {
        const pDate = parseLocalDate(p.dueDate || p.paidDate);
        const pConcept = (p.concept || '').toLowerCase();
        
        // Cubierto si:
        // 1. Es mensualidad y la fecha coincide con el mes/año
        // 2. O el concepto menciona el nombre del mes
        const isMonthly = p.type === 'Mensualidad' || pConcept.includes('mensua');
        const sameMonth = pDate.getMonth() === target.month && pDate.getFullYear() === target.year;
        const mentionsMonth = pConcept.includes(target.name);
        
        return isMonthly && (sameMonth || mentionsMonth) && (p.status === 'Pagado' || p.status === 'Pendiente');
      });

      if (!isPaid) {
        // Generar alerta para el primer mes no pagado
        const targetDateStr = `${target.year}-${String(target.month + 1).padStart(2, '0')}-10`;
        const daysDiff = daysBetween(getCurrentDate(), targetDateStr);
        
        let type = '';
        let priority = '';
        let message = '';

        if (daysDiff > 0 && daysDiff <= 25) { // Un margen más amplio para próximos
          type = 'warning';
          priority = 'media';
          message = `Mensualidad de ${target.name.toUpperCase()} pronto a vencer`;
        } else if (daysDiff <= 0) {
          type = daysDiff < -15 ? 'danger' : 'warning';
          priority = 'alta';
          const label = daysDiff === 0 ? 'vence hoy' : `vencido por ${Math.abs(daysDiff)} días`;
          message = `Falta pago de ${target.name.toUpperCase()} (${label})`;
        }

        if (type) {
           console.log(`✅ Alerta creada para ${player.name}: ${message}`);
           virtualNotifs.push({
            id: `virtual_${player.id}_${target.month}_${target.year}`,
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
  // Ocultar todas las vistas
  document.querySelectorAll('#appContainer > main > div').forEach(div => {
    div.classList.add('hidden');
  });
  
  // Mostrar vista de notificaciones
  document.getElementById('notificationsView').classList.remove('hidden');
  document.getElementById('headerViewName').textContent = 'Notificaciones';
  
  // Actualizar navegación
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  renderNotifications();
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