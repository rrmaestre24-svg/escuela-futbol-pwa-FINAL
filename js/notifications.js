// ========================================
// SISTEMA DE NOTIFICACIONES
// ========================================

// Actualizar notificaciones
function updateNotifications() {
  const notifications = getPaymentNotifications();
  const badge = document.getElementById('notificationBadge');
  
  if (notifications.length > 0) {
    badge.textContent = notifications.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// Obtener notificaciones de pagos
function getPaymentNotifications() {
  const payments = getPendingPayments();
  const today = new Date();
  const notifications = [];
  
  payments.forEach(payment => {
    const dueDate = new Date(payment.dueDate);
    const daysDiff = daysBetween(today, dueDate);
    
    let type = '';
    let priority = '';
    let message = '';
    
    // 10 días ANTES del vencimiento
    if (daysDiff > 0 && daysDiff <= 10) {
      type = 'warning';
      priority = 'media';
      message = `Pago próximo a vencer en ${daysDiff} día${daysDiff > 1 ? 's' : ''}`;
    }
    // Día 0 a 40 días DESPUÉS (período de gracia)
    else if (daysDiff >= -40 && daysDiff <= 0) {
      type = 'info';
      priority = 'media';
      message = `Pago en período de gracia (${Math.abs(daysDiff)} día${Math.abs(daysDiff) > 1 ? 's' : ''} de retraso)`;
    }
    // Más de 40 días VENCIDO
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
        payment
      });
    }
  });
  
  // Ordenar por prioridad: alta > media
  return notifications.sort((a, b) => {
    if (a.priority === 'alta' && b.priority !== 'alta') return -1;
    if (a.priority !== 'alta' && b.priority === 'alta') return 1;
    return a.daysDiff - b.daysDiff;
  });
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
    const player = getPlayerById(notif.payment.playerId);
    if (!player) return '';
    
    const colors = {
      'danger': { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-l-4 border-red-500', icon: 'text-red-600', badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
      'warning': { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-l-4 border-yellow-500', icon: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
      'info': { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-l-4 border-blue-500', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' }
    };
    
    const color = colors[notif.type];
    
    return `
      <div class="${color.bg} ${color.border} rounded-lg p-4 animate-slide-in">
        <div class="flex items-start gap-3 mb-3">
          <i data-lucide="alert-circle" class="w-6 h-6 ${color.icon} flex-shrink-0 mt-1"></i>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div>
                <h4 class="font-bold text-gray-800 dark:text-white">${player.name}</h4>
                <p class="text-sm text-gray-600 dark:text-gray-300">${player.category}</p>
              </div>
              <span class="badge ${color.badge} text-xs">${notif.priority.toUpperCase()}</span>
            </div>
            <p class="text-sm font-medium text-gray-800 dark:text-white mb-1">${notif.message}</p>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              <p><strong>Concepto:</strong> ${notif.payment.concept}</p>
              <p><strong>Monto:</strong> ${formatCurrency(notif.payment.amount)}</p>
              <p><strong>Vencimiento:</strong> ${formatDate(notif.payment.dueDate)}</p>
            </div>
          </div>
        </div>
        
        <div class="flex gap-2">
          <button onclick="generatePaymentNotificationPDF('${notif.paymentId}')" class="flex-1 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
            <i data-lucide="download" class="w-4 h-4"></i>
            Descargar PDF
          </button>
          <button onclick="sendPaymentNotificationWhatsApp('${notif.paymentId}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
            <i data-lucide="message-circle" class="w-4 h-4"></i>
            Enviar WhatsApp
          </button>
          <button onclick="markAsPaid('${notif.paymentId}'); renderNotifications();" class="bg-teal-600 hover:bg-teal-700 text-white text-sm py-2 px-3 rounded-lg">
            <i data-lucide="check" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

console.log('✅ notifications.js cargado');