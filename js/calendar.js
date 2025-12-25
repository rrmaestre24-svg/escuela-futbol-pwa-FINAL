// ========================================
// GESTIÓN DE CALENDARIO
// ========================================

let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();

// Mostrar modal agregar evento
function showAddEventModal() {
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value = '';
  document.getElementById('eventModal').classList.remove('hidden');
}

// Cerrar modal evento
function closeEventModal() {
  document.getElementById('eventModal').classList.add('hidden');
}

// Guardar evento
document.getElementById('eventForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  
  const eventId = document.getElementById('eventId').value;
  
  const eventData = {
    type: document.getElementById('eventType').value,
    title: document.getElementById('eventTitle').value,
    description: document.getElementById('eventDescription').value,
    date: document.getElementById('eventDate').value,
    time: document.getElementById('eventTime').value,
    location: document.getElementById('eventLocation').value
  };
  
  if (eventId) {
    updateEvent(eventId, eventData);
    showToast('✅ Evento actualizado');
  } else {
    const newEvent = {
      id: generateId(),
      ...eventData,
      createdAt: getCurrentDate()
    };
    saveEvent(newEvent);
    showToast('✅ Evento agregado');
  }
  
  closeEventModal();
  renderCalendar();
  updateDashboard();
});

// Mes anterior
function previousMonth() {
  currentCalendarMonth--;
  if (currentCalendarMonth < 0) {
    currentCalendarMonth = 11;
    currentCalendarYear--;
  }
  renderCalendar();
}

// Mes siguiente
function nextMonth() {
  currentCalendarMonth++;
  if (currentCalendarMonth > 11) {
    currentCalendarMonth = 0;
    currentCalendarYear++;
  }
  renderCalendar();
}

// Renderizar calendario
function renderCalendar() {
  // Actualizar título
  document.getElementById('calendarMonthYear').textContent = 
    `${getMonthName(currentCalendarMonth)} ${currentCalendarYear}`;
  
  // Renderizar grid
  renderCalendarGrid();
  
  // Renderizar próximos eventos
  renderUpcomingEvents();
}

// Renderizar grid del calendario
function renderCalendarGrid() {
  const grid = document.getElementById('calendarGrid');
  const daysInMonth = getDaysInMonth(currentCalendarYear, currentCalendarMonth);
  const firstDay = getFirstDayOfMonth(currentCalendarYear, currentCalendarMonth);
  
  let html = '';
  
  // Días vacíos antes del primer día
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day opacity-50"></div>';
  }
  
  // Días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = getEventsByDate(dateStr);
    const isCurrentDay = isToday(dateStr);
    
    let classes = 'calendar-day';
    if (isCurrentDay) classes += ' today';
    if (events.length > 0) classes += ' has-event';
    
    // Color del día según tipo de evento
    let dayColor = '';
    if (events.length > 0) {
      const eventType = events[0].type;
      const colors = {
        'Partido': 'bg-blue-100 dark:bg-blue-900',
        'Entrenamiento': 'bg-green-100 dark:bg-green-900',
        'Torneo': 'bg-yellow-100 dark:bg-yellow-900',
        'Otro': 'bg-purple-100 dark:bg-purple-900'
      };
      dayColor = colors[eventType] || '';
    }
    
    html += `
      <div class="${classes} ${dayColor}" onclick="showDayEvents('${dateStr}')">
        ${day}
      </div>
    `;
  }
  
  grid.innerHTML = html;
}

// Mostrar eventos del día
function showDayEvents(date) {
  const events = getEventsByDate(date);
  
  if (events.length === 0) {
    showToast('No hay eventos en esta fecha');
    return;
  }
  
  const eventsList = events.map(event => {
    const icons = {
      'Partido': '⚽',
      'Entrenamiento': '🏃',
      'Torneo': '🏆',
      'Otro': '📅'
    };
    
    return `
      <div class="mb-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div class="flex items-start justify-between">
          <div>
            <p class="font-medium text-gray-800 dark:text-white">${icons[event.type]} ${event.title}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">${event.time} - ${event.location || 'Sin ubicación'}</p>
            ${event.description ? `<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${event.description}</p>` : ''}
          </div>
          <button onclick="deleteEventConfirm('${event.id}')" class="text-red-600 hover:text-red-700">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  const message = `
    <div>
      <h3 class="font-bold text-lg mb-3">Eventos del ${formatDate(date)}</h3>
      ${eventsList}
    </div>
  `;
  
  // Mostrar en un modal simple (puedes crear un modal específico si prefieres)
  alert(message.replace(/<[^>]*>/g, '')); // Versión simple con alert
  renderCalendar(); // Re-renderizar para aplicar cambios
  lucide.createIcons();
}

// Renderizar próximos eventos
function renderUpcomingEvents() {
  const events = getUpcomingEvents(10);
  const container = document.getElementById('upcomingEventsList');
  
  if (events.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">No hay eventos próximos</p>
      </div>
    `;
    return;
  }
  
  const icons = {
    'Partido': { icon: 'trophy', color: 'text-blue-600' },
    'Entrenamiento': { icon: 'activity', color: 'text-green-600' },
    'Torneo': { icon: 'award', color: 'text-yellow-600' },
    'Otro': { icon: 'calendar', color: 'text-purple-600' }
  };
  
  container.innerHTML = events.map(event => {
    const iconData = icons[event.type] || icons['Otro'];
    const daysUntil = daysBetween(new Date(), new Date(event.date));
    
    return `
      <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div class="p-2 rounded-lg bg-white dark:bg-gray-600">
          <i data-lucide="${iconData.icon}" class="w-5 h-5 ${iconData.color}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-gray-800 dark:text-white">${event.title}</h4>
          <p class="text-sm text-gray-500 dark:text-gray-400">${formatDate(event.date)} • ${event.time}</p>
          ${event.location ? `<p class="text-xs text-gray-400 dark:text-gray-500">${event.location}</p>` : ''}
          ${daysUntil === 0 ? '<span class="text-xs font-medium text-teal-600">¡Hoy!</span>' : 
            daysUntil === 1 ? '<span class="text-xs font-medium text-blue-600">Mañana</span>' :
            `<span class="text-xs text-gray-500">En ${daysUntil} días</span>`}
        </div>
        <button onclick="deleteEventConfirm('${event.id}')" class="text-red-600 hover:text-red-700">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

// Eliminar evento
function deleteEventConfirm(eventId) {
  if (confirmAction('¿Estás seguro de eliminar este evento?')) {
    deleteEvent(eventId);
    showToast('✅ Evento eliminado');
    renderCalendar();
    updateDashboard();
  }
}

console.log('✅ calendar.js cargado');