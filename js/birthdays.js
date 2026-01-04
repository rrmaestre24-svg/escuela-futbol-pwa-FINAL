// ========================================
// GESTIÓN DE CUMPLEAÑOS - CORREGIDO
// ========================================

// Mostrar vista de cumpleaños
function showBirthdaysView() {
  // Ocultar todas las vistas
  document.querySelectorAll('#appContainer > main > div').forEach(div => {
    div.classList.add('hidden');
  });
  
  // Mostrar vista de cumpleaños
  document.getElementById('birthdaysView').classList.remove('hidden');
  document.getElementById('headerViewName').textContent = 'Cumpleaños';
  
  // Actualizar navegación
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  renderBirthdays();
}

// Obtener todos los cumpleaños (jugadores + staff)
function getAllBirthdays() {
  const birthdays = [];
  
  // Jugadores
  const players = getPlayers();
  players.forEach(player => {
    if (player.birthDate) {
      // ✅ CORREGIDO: Usar parseLocalDate en lugar de new Date
      const date = parseLocalDate(player.birthDate);
      birthdays.push({
        id: player.id,
        name: player.name,
        birthDate: player.birthDate,
        month: date.getMonth(),
        day: date.getDate(),
        avatar: player.avatar,
        phone: player.phone,
        type: 'player',
        category: player.category
      });
    }
  });
  
  // Staff (usuarios)
  const users = getUsers();
  users.forEach(user => {
    if (user.birthDate) {
      // ✅ CORREGIDO: Usar parseLocalDate en lugar de new Date
      const date = parseLocalDate(user.birthDate);
      birthdays.push({
        id: user.id,
        name: user.name,
        birthDate: user.birthDate,
        month: date.getMonth(),
        day: date.getDate(),
        avatar: user.avatar,
        phone: user.phone,
        type: 'staff',
        role: user.role
      });
    }
  });
  
  return birthdays;
}

// Obtener cumpleaños próximos (próximos 7 días)
function getUpcomingBirthdays() {
  const birthdays = getAllBirthdays();
  const today = new Date();
  today.setHours(0, 0, 0, 0); // ✅ Normalizar a medianoche
  const upcoming = [];
  
  birthdays.forEach(birthday => {
    const thisYear = today.getFullYear();
    const birthdayThisYear = new Date(thisYear, birthday.month, birthday.day);
    birthdayThisYear.setHours(0, 0, 0, 0); // ✅ Normalizar a medianoche
    
    const daysUntil = Math.floor((birthdayThisYear - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntil >= 0 && daysUntil <= 7) {
      birthday.daysUntil = daysUntil;
      upcoming.push(birthday);
    }
  });
  
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

// Renderizar cumpleaños completos
function renderBirthdays() {
  const birthdays = getAllBirthdays();
  const container = document.getElementById('birthdaysByMonth');
  
  if (birthdays.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎂</div>
        <p class="text-gray-500 dark:text-gray-400">No hay cumpleaños registrados</p>
      </div>
    `;
    return;
  }
  
  // Agrupar por mes
  const byMonth = {};
  for (let i = 0; i < 12; i++) {
    byMonth[i] = [];
  }
  
  birthdays.forEach(birthday => {
    byMonth[birthday.month].push(birthday);
  });
  
  // Ordenar dentro de cada mes por día
  Object.keys(byMonth).forEach(month => {
    byMonth[month].sort((a, b) => a.day - b.day);
  });
  
  // Renderizar por mes
  const today = new Date();
  const currentMonth = today.getMonth();
  
  let html = '';
  
  // Empezar por el mes actual
  for (let i = 0; i < 12; i++) {
    const monthIndex = (currentMonth + i) % 12;
    const monthBirthdays = byMonth[monthIndex];
    
    if (monthBirthdays.length === 0) continue;
    
    html += `
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm animate-slide-in">
        <h3 class="font-bold text-lg text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <i data-lucide="calendar-days" class="w-5 h-5 text-teal-600"></i>
          ${getMonthName(monthIndex)}
        </h3>
        <div class="space-y-3">
          ${monthBirthdays.map(birthday => renderBirthdayCard(birthday)).join('')}
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  lucide.createIcons();
}

// Renderizar card de cumpleaños
function renderBirthdayCard(birthday) {
  const age = calculateAge(birthday.birthDate);
  const isTodayBirthday = isToday(getCurrentYearBirthday(birthday));
  const daysUntil = getDaysUntilBirthday(birthday);
  
  let daysText = '';
  if (isTodayBirthday) {
    daysText = '<span class="text-xs font-bold text-teal-600 animate-pulse">¡HOY ES SU CUMPLEAÑOS! 🎉</span>';
  } else if (daysUntil === 1) {
    daysText = '<span class="text-xs font-medium text-blue-600">Mañana</span>';
  } else if (daysUntil > 1 && daysUntil <= 7) {
    daysText = `<span class="text-xs font-medium text-blue-600">En ${daysUntil} días</span>`;
  }
  
  const cardClass = isTodayBirthday ? 'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 animate-pulse' : 'bg-gray-50 dark:bg-gray-700';
  
  return `
    <div class="${cardClass} rounded-lg p-3">
      <div class="flex items-center gap-3">
        <img src="${birthday.avatar || getDefaultAvatar()}" alt="${birthday.name}" class="w-14 h-14 rounded-full object-cover border-2 ${isTodayBirthday ? 'border-teal-500' : 'border-gray-300'}">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h4 class="font-bold text-gray-800 dark:text-white">${birthday.name}</h4>
            ${birthday.type === 'staff' ? '<span class="badge bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300 text-xs">Staff</span>' : ''}
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            🎂 ${birthday.day} de ${getMonthName(birthday.month)} • ${age} años
          </p>
          ${birthday.type === 'player' ? `<p class="text-xs text-gray-500 dark:text-gray-400">${birthday.category}</p>` : ''}
          ${daysText}
        </div>
        <button onclick="sendBirthdayWhatsApp('${birthday.id}', ${birthday.type === 'staff'})" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-1 text-sm">
          <i data-lucide="message-circle" class="w-4 h-4"></i>
          Felicitar
        </button>
      </div>
    </div>
  `;
}

// Obtener fecha de cumpleaños del año actual
function getCurrentYearBirthday(birthday) {
  const year = new Date().getFullYear();
  return `${year}-${String(birthday.month + 1).padStart(2, '0')}-${String(birthday.day).padStart(2, '0')}`;
}

// ✅ CORREGIDO: Obtener días hasta el cumpleaños
function getDaysUntilBirthday(birthday) {
  // Normalizar fecha actual a medianoche
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const thisYear = today.getFullYear();
  const birthdayThisYear = new Date(thisYear, birthday.month, birthday.day);
  birthdayThisYear.setHours(0, 0, 0, 0);
  
  // Calcular días directamente
  let daysUntil = Math.floor((birthdayThisYear - today) / (1000 * 60 * 60 * 24));
  
  // Si ya pasó este año, calcular para el próximo
  if (daysUntil < 0) {
    const birthdayNextYear = new Date(thisYear + 1, birthday.month, birthday.day);
    birthdayNextYear.setHours(0, 0, 0, 0);
    daysUntil = Math.floor((birthdayNextYear - today) / (1000 * 60 * 60 * 24));
  }
  
  return daysUntil;
}

console.log('✅ birthdays.js cargado - VERSIÓN CORREGIDA');