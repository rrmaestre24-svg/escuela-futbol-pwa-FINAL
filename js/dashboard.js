// ========================================
// DASHBOARD - 🆕 INCLUYE OTROS INGRESOS
// ========================================

// Actualizar dashboard
function updateDashboard() {
  updateDashboardStats();
  updateDashboardBirthdays();
  updateDashboardEvents();
  updateDashboardNotifications();
}

// Actualizar estadísticas
function updateDashboardStats() {
  const players = getActivePlayers();
  const pending = getPendingPayments();
  const payments = getPayments();
  const events = getCalendarEvents();
  
  // 🆕 Obtener otros ingresos
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [];
  
  // Calcular ingresos del mes (pagos de jugadores)
  const thisMonthPayments = payments.filter(p => 
    p.status === 'Pagado' && p.paidDate && isThisMonth(p.paidDate)
  );
  const monthPaymentsIncome = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);
  
  // 🆕 Calcular otros ingresos del mes
  const thisMonthThirdParty = thirdPartyIncomes.filter(i => isThisMonth(i.date));
  const monthThirdPartyIncome = thisMonthThirdParty.reduce((sum, i) => sum + i.amount, 0);
  
  // 🆕 Total ingresos del mes = pagos + otros ingresos
  const monthIncome = monthPaymentsIncome + monthThirdPartyIncome;
  
  // Calcular próximos eventos (próximos 30 días)
  const today = getCurrentDate();
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const upcomingEvents = events.filter(e => {
    const eventDate = new Date(e.date);
    return eventDate >= new Date(today) && eventDate <= in30Days;
  });
  
  document.getElementById('statPlayers').textContent = players.length;
  document.getElementById('statPending').textContent = pending.length;
  document.getElementById('statIncome').textContent = formatCurrency(monthIncome);
  document.getElementById('statEvents').textContent = upcomingEvents.length;
  
  // 🆕 Log para debug
  console.log('📊 Dashboard Stats:');
  console.log('  - Pagos del mes:', formatCurrency(monthPaymentsIncome));
  console.log('  - Otros ingresos del mes:', formatCurrency(monthThirdPartyIncome));
  console.log('  - Total mes:', formatCurrency(monthIncome));
}

// Actualizar cumpleaños próximos
function updateDashboardBirthdays() {
  const upcoming = getUpcomingBirthdays();
  const card = document.getElementById('upcomingBirthdaysCard');
  const list = document.getElementById('upcomingBirthdaysList');
  
  // ✅ VERIFICAR QUE LOS ELEMENTOS EXISTAN
  if (!card || !list) {
    console.warn('⚠️ Elementos de cumpleaños no encontrados en el DOM');
    return;
  }
  
  if (upcoming.length === 0) {
    card.classList.add('hidden');
    return;
  }
  
  card.classList.remove('hidden');
  list.innerHTML = upcoming.map(birthday => {
    const age = calculateAge(birthday.birthDate);
    const isTodayBirthday = birthday.daysUntil === 0;
    
    return `
      <div class="flex items-center gap-3 bg-white bg-opacity-20 rounded-lg p-2">
        <img src="${birthday.avatar || getDefaultAvatar()}" alt="${birthday.name}" class="w-12 h-12 rounded-full object-cover border-2 border-white">
        <div class="flex-1 min-w-0">
          <p class="font-medium text-white truncate">${birthday.name} ${birthday.type === 'staff' ? '⭐' : ''}</p>
          <p class="text-sm text-white text-opacity-90">
            ${isTodayBirthday ? '🎉 ¡HOY!' : `En ${birthday.daysUntil} día${birthday.daysUntil > 1 ? 's' : ''}`} • ${age} años
          </p>
        </div>
        <button onclick="sendBirthdayWhatsApp('${birthday.id}', ${birthday.type === 'staff'})" class="bg-white text-purple-600 px-3 py-1 rounded-lg text-sm font-medium hover:bg-opacity-90">
          Felicitar
        </button>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

// Actualizar próximos eventos
function updateDashboardEvents() {
  const events = getUpcomingEvents(3);
  const container = document.getElementById('dashboardEventsList');
  
  if (events.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">No hay eventos próximos</p>
      </div>
    `;
    return;
  }
  
  const icons = {
    'Partido': { icon: 'trophy', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' },
    'Entrenamiento': { icon: 'activity', color: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' },
    'Torneo': { icon: 'award', color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400' },
    'Otro': { icon: 'calendar', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400' }
  };
  
  container.innerHTML = events.map(event => {
    const iconData = icons[event.type] || icons['Otro'];
    const daysUntil = daysBetween(new Date(), new Date(event.date));
    
    return `
      <div class="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
        <div class="p-2 rounded-lg ${iconData.color}">
          <i data-lucide="${iconData.icon}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800 dark:text-white truncate">${event.title}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">${formatDate(event.date)} • ${event.time}</p>
        </div>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          ${daysUntil === 0 ? 'Hoy' : daysUntil === 1 ? 'Mañana' : `${daysUntil}d`}
        </span>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

// Variable de estado para expansión
let allNotificationsExpanded = false;

// 🆕 Alternar expansión de notificaciones
window.toggleNotificationsExpansion = function(forceShow = false) {
  if (forceShow === true) {
    allNotificationsExpanded = true;
  } else {
    allNotificationsExpanded = !allNotificationsExpanded;
  }
  updateDashboardNotifications();
  
  // Si se expandió, hacer scroll suave hasta la sección
  if (allNotificationsExpanded) {
    const section = document.getElementById('dashboardNotificationsSection');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
};

// Actualizar notificaciones recientes
function updateDashboardNotifications() {
  const allNotifs = getPaymentNotifications();
  // Mostrar todas si está expandido, de lo contrario solo 3
  const notifications = allNotificationsExpanded ? allNotifs : allNotifs.slice(0, 3);
  const container = document.getElementById('dashboardNotificationsList');
  
  // Actualizar el texto del botón "Ver todas"
  const viewAllBtn = document.getElementById('viewAllNotificationsBtn');
  if (viewAllBtn) {
    viewAllBtn.textContent = allNotificationsExpanded ? 'Ver menos' : 'Ver todas';
  }
  
  if (notifications.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">No hay notificaciones</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = notifications.map(notif => {
    const player = notif.player || getPlayerById(notif.payment?.playerId || notif.playerId);
    if (!player) return '';
    
    const colors = {
      'danger': 'text-red-600',
      'warning': 'text-yellow-600',
      'info': 'text-blue-600'
    };
    
    const actionOnClick = notif.isVirtual 
      ? `sendVirtualReminderWhatsApp('${notif.playerId}', '${notif.nextDueDate}')`
      : `sendPaymentNotificationWhatsApp('${notif.paymentId}')`;
    
    return `
      <div class="notif-card flex items-start gap-4 p-3 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-200 border-b border-gray-100 dark:border-gray-700 last:border-0"
           onmousedown="this.classList.add('is-expanded')" 
           onmouseup="this.classList.remove('is-expanded')"
           onmouseleave="this.classList.remove('is-expanded')"
           ontouchstart="this.classList.add('is-expanded')" 
           ontouchend="this.classList.remove('is-expanded')">
        <div class="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <i data-lucide="${notif.isVirtual ? 'calendar-clock' : 'alert-circle'}" class="w-5 h-5 ${colors[notif.type]} flex-shrink-0"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm font-bold text-gray-800 dark:text-white truncate">${player.name}</p>
            <span class="text-[10px] text-gray-500 font-medium bg-gray-100 dark:bg-gray-700 px-1 rounded">Cat. ${player.category || 'N/A'}</span>
            ${notif.isVirtual ? '<span class="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold rounded uppercase tracking-wider">Auto</span>' : ''}
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">${notif.message}</p>
        </div>
        
        <div class="flex items-center gap-2">
          <!-- Botón Omitir (Discreto) -->
          <button 
            onclick="dismissNotification('${notif.id}')"
            title="Omitir esta notificación"
            class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-all duration-200"
          >
            <i data-lucide="eye-off" class="w-4 h-4"></i>
          </button>

          ${!notif.isVirtual ? `
            <button onclick="downloadPaymentPDF('${notif.paymentId}')" class="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200" title="PDF">
              <i data-lucide="file-text" class="w-4 h-4"></i>
            </button>
            <button onclick="markAsPaid('${notif.paymentId}')" class="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/20 rounded-lg transition-all duration-200" title="Marcar pagado">
              <i data-lucide="check-circle" class="w-4 h-4"></i>
            </button>
          ` : ''}
          <!-- Botón WhatsApp -->
          <button 
            onclick="${notif.isVirtual ? `sendVirtualReminderWhatsApp('${notif.playerId}', '${notif.nextDueDate}')` : `sendPaymentNotificationWhatsApp('${notif.paymentId}')`}"
            class="p-1.5 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all duration-200"
          >
            <i data-lucide="message-circle" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ========================================
// 🆕 ABRIR INVENTARIO
// Detecta si la PWA de inventario está instalada
// Si sí → intenta abrirla como app nativa
// Si no → abre la URL web normal
// ========================================
function abrirInventario() {
  const INVENTARIO_URL = 'https://myclub-inventario.vercel.app';

  // Obtener el clubId del usuario actual para pasarlo como parámetro
  const clubId = localStorage.getItem('clubId') || '';
  const urlConClub = clubId
    ? `${INVENTARIO_URL}/login.html?clubId=${clubId}`
    : `${INVENTARIO_URL}/login.html`;

  // Intentar abrir como PWA instalada primero
  // El navegador la abrirá en modo standalone si está instalada
  const ventana = window.open(urlConClub, '_blank');

  // Si el navegador bloqueó el popup (ej: iOS Safari sin interacción)
  if (!ventana || ventana.closed || typeof ventana.closed === 'undefined') {
    // Fallback: redirigir en la misma pestaña
    window.location.href = urlConClub;
  }
}

// Exportar para uso global
window.abrirInventario = abrirInventario;

console.log('✅ dashboard.js cargado (CON OTROS INGRESOS + INVENTARIO)');