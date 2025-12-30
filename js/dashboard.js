// ========================================
// DASHBOARD
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
  
  // Calcular ingresos del mes
  const thisMonth = payments.filter(p => 
    p.status === 'Pagado' && p.paidDate && isThisMonth(p.paidDate)
  );
  const monthIncome = thisMonth.reduce((sum, p) => sum + p.amount, 0);
  
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

// Actualizar notificaciones recientes
function updateDashboardNotifications() {
  const notifications = getPaymentNotifications().slice(0, 3);
  const container = document.getElementById('dashboardNotificationsList');
  
  if (notifications.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">No hay notificaciones</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = notifications.map(notif => {
    const player = getPlayerById(notif.payment.playerId);
    if (!player) return '';
    
    const colors = {
      'danger': 'text-red-600',
      'warning': 'text-yellow-600',
      'info': 'text-blue-600'
    };
    
    return `
      <div class="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
        <i data-lucide="alert-circle" class="w-5 h-5 ${colors[notif.type]} flex-shrink-0 mt-0.5"></i>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800 dark:text-white">${player.name}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">${notif.message}</p>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

console.log('✅ dashboard.js cargado');