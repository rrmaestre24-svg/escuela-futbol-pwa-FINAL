// ========================================
// GESTIÓN DE JUGADORES - MEJORADO CON ESTADO ACTIVO/INACTIVO
// ✅ CON NORMALIZACIÓN DE TELÉFONOS
// ========================================

let currentEditingPlayerId = null;
let currentStatusFilter = 'todos'; // 'todos', 'activo', 'inactivo'

// Mostrar modal agregar jugador
function showAddPlayerModal() {
  currentEditingPlayerId = null;
  document.getElementById('playerModalTitle').textContent = 'Agregar Jugador';
  document.getElementById('playerForm').reset();
  document.getElementById('playerId').value = '';
  document.getElementById('playerAvatarPreview').src = getDefaultAvatar();
  document.getElementById('playerModal').classList.remove('hidden');
}

// Mostrar modal editar jugador
function showEditPlayerModal(playerId) {
  currentEditingPlayerId = playerId;
  const player = getPlayerById(playerId);
  
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }
  
  document.getElementById('playerModalTitle').textContent = 'Editar Jugador';
  document.getElementById('playerId').value = player.id;
  document.getElementById('playerName').value = player.name;
  document.getElementById('playerBirthDate').value = player.birthDate;
  document.getElementById('playerCategory').value = player.category;
  document.getElementById('playerPosition').value = player.position || '';
  document.getElementById('playerJerseyNumber').value = player.jerseyNumber || '';
  document.getElementById('playerUniformSize').value = player.uniformSize || '';
  document.getElementById('playerEmail').value = player.email || '';
  document.getElementById('playerPhone').value = player.phone;
  document.getElementById('playerAddress').value = player.address || '';
  document.getElementById('playerBloodType').value = player.medicalInfo?.bloodType || '';
  document.getElementById('playerAllergies').value = player.medicalInfo?.allergies || '';
  document.getElementById('playerMedications').value = player.medicalInfo?.medications || '';
  document.getElementById('playerConditions').value = player.medicalInfo?.conditions || '';
  document.getElementById('playerEmergencyContact').value = player.emergencyContact || '';
  document.getElementById('playerAvatarPreview').src = player.avatar || getDefaultAvatar();
  
  document.getElementById('playerModal').classList.remove('hidden');
}

// Cerrar modal jugador
function closePlayerModal() {
  document.getElementById('playerModal').classList.add('hidden');
  currentEditingPlayerId = null;
}

// Preview de avatar jugador - MEJORADO
document.getElementById('playerAvatar')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      showToast('❌ Por favor selecciona una imagen válida');
      return;
    }
    
    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('❌ La imagen es muy grande. Máximo 2MB');
      return;
    }
    
    imageToBase64(file, function(base64) {
      document.getElementById('playerAvatarPreview').src = base64;
      showToast('✅ Imagen cargada');
    });
  }
});

// Guardar jugador - MEJORADO CON NORMALIZACIÓN DE TELÉFONOS
document.getElementById('playerForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  
  const playerId = document.getElementById('playerId').value;
  const avatarFile = document.getElementById('playerAvatar').files[0];
  const currentAvatar = document.getElementById('playerAvatarPreview').src;
  
  const playerData = {
    name: document.getElementById('playerName').value,
    birthDate: document.getElementById('playerBirthDate').value,
    category: document.getElementById('playerCategory').value,
    position: document.getElementById('playerPosition').value,
    jerseyNumber: document.getElementById('playerJerseyNumber').value,
    uniformSize: document.getElementById('playerUniformSize').value,
    email: document.getElementById('playerEmail').value,
    phone: normalizePhone(document.getElementById('playerPhone').value), // ⭐ NORMALIZAR AQUÍ
    address: document.getElementById('playerAddress').value,
    emergencyContact: normalizePhone(document.getElementById('playerEmergencyContact').value), // ⭐ NORMALIZAR AQUÍ
    medicalInfo: {
      bloodType: document.getElementById('playerBloodType').value,
      allergies: document.getElementById('playerAllergies').value,
      medications: document.getElementById('playerMedications').value,
      conditions: document.getElementById('playerConditions').value
    }
  };
  
  const savePlayerData = (avatar) => {
    playerData.avatar = avatar;
    
    if (playerId) {
      // Editar
      updatePlayer(playerId, playerData);
      showToast('✅ Jugador actualizado');
    } else {
      // Crear nuevo
      const newPlayer = {
        id: generateId(),
        ...playerData,
        status: 'Activo',
        enrollmentDate: getCurrentDate()
      };
      savePlayer(newPlayer);
      showToast('✅ Jugador agregado');
    }
    
    closePlayerModal();
    renderPlayersList();
    updateDashboard();
  };
  
  if (avatarFile) {
    imageToBase64(avatarFile, savePlayerData);
  } else {
    savePlayerData(currentAvatar);
  }
});

// ⭐ NUEVA FUNCIÓN: Cambiar estado del jugador
async function togglePlayerStatus(playerId) {
  const player = getPlayerById(playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }
  
  // Cambiar estado
  const newStatus = player.status === 'Activo' ? 'Inactivo' : 'Activo';
  
  // Actualizar localmente
  updatePlayer(playerId, { status: newStatus });
  
  // Sincronizar con Firebase si está disponible
  if (window.APP_STATE?.firebaseReady && window.firebase?.db) {
    try {
      const settings = getSchoolSettings();
      const clubId = settings.clubId || localStorage.getItem('clubId');
      
      if (clubId) {
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, playerId),
          { status: newStatus },
          { merge: true }
        );
        console.log('✅ Estado sincronizado con Firebase');
      }
    } catch (error) {
      console.error('⚠️ Error al sincronizar estado:', error);
    }
  }
  
  // Mensaje y re-renderizar
  const statusIcon = newStatus === 'Activo' ? '✅' : '⚠️';
  showToast(`${statusIcon} ${player.name} marcado como ${newStatus}`);
  renderPlayersList();
  updateDashboard();
}

// ⭐ NUEVA FUNCIÓN: Filtrar por estado
function filterByStatus(status) {
  currentStatusFilter = status;
  renderPlayersList();
  
  // Actualizar botones de filtro
  const buttons = document.querySelectorAll('[data-status-filter]');
  buttons.forEach(btn => {
    if (btn.dataset.statusFilter === status) {
      btn.classList.add('bg-teal-600', 'text-white');
      btn.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
    } else {
      btn.classList.remove('bg-teal-600', 'text-white');
      btn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
    }
  });
}

// Renderizar lista de jugadores - MEJORADO CON TELÉFONOS FORMATEADOS
function renderPlayersList() {
  const players = getPlayers();
  const searchTerm = document.getElementById('playerSearch')?.value || '';
  
  // Filtrar por búsqueda
  let filtered = filterBySearch(players, searchTerm, ['name', 'category', 'phone', 'email', 'position', 'jerseyNumber']);
  
  // Filtrar por estado
  if (currentStatusFilter === 'activo') {
    filtered = filtered.filter(p => p.status === 'Activo');
  } else if (currentStatusFilter === 'inactivo') {
    filtered = filtered.filter(p => p.status === 'Inactivo' || !p.status);
  }
  
  const sorted = sortBy(filtered, 'name', 'asc');
  
  const container = document.getElementById('playersList');
  
  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👤</div>
        <p class="text-gray-500 dark:text-gray-400">
          ${currentStatusFilter === 'todos' 
            ? 'No hay jugadores registrados' 
            : `No hay jugadores ${currentStatusFilter === 'activo' ? 'activos' : 'inactivos'}`}
        </p>
        ${currentStatusFilter !== 'todos' ? `
          <button onclick="filterByStatus('todos')" class="mt-2 text-sm text-teal-600 dark:text-teal-400 underline">
            Ver todos los jugadores
          </button>
        ` : ''}
      </div>
    `;
    return;
  }
  
  container.innerHTML = sorted.map(player => {
    const age = calculateAge(player.birthDate);
    const isActive = player.status === 'Activo';
    const statusColor = isActive 
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800' 
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800';
    const statusIcon = isActive ? '✓' : '✗';
    
    return `
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm card-hover animate-slide-in ${!isActive ? 'opacity-75' : ''}">
        <div class="flex items-start gap-3">
          <img src="${player.avatar || getDefaultAvatar()}" alt="${player.name}" class="w-16 h-16 rounded-full object-cover border-2 ${isActive ? 'border-teal-500' : 'border-gray-400'}">
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-gray-800 dark:text-white truncate ${!isActive ? 'line-through opacity-60' : ''}">${player.name}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">${player.category} • ${age} años</p>
                ${player.position || player.jerseyNumber ? `
                  <p class="text-xs text-teal-600 dark:text-teal-400">
                    ${player.position ? player.position : ''} ${player.jerseyNumber ? '#' + player.jerseyNumber : ''}
                  </p>
                ` : ''}
              </div>
              <button 
                onclick="togglePlayerStatus('${player.id}')" 
                class="badge ${statusColor} text-xs cursor-pointer transition-all transform hover:scale-105 active:scale-95 flex items-center gap-1"
                title="Click para cambiar estado"
              >
                <span>${statusIcon}</span>
                <span>${player.status || 'Activo'}</span>
              </button>
            </div>
            <div class="mt-2 flex flex-wrap gap-2">
              <a href="${getWhatsAppLink(player.phone)}" target="_blank" class="text-sm text-teal-600 dark:text-teal-400 flex items-center gap-1 hover:underline">
                <i data-lucide="phone" class="w-4 h-4"></i>
                ${formatPhoneDisplay(player.phone)}
              </a>
              ${player.email ? `
                <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <i data-lucide="mail" class="w-4 h-4"></i>
                  ${player.email}
                </span>
              ` : ''}
            </div>
            <div class="mt-3 flex gap-2">
              <button onclick="showPlayerDetails('${player.id}')" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm py-2 px-3 rounded-lg flex items-center justify-center gap-1">
                <i data-lucide="eye" class="w-4 h-4"></i>
                Ver
              </button>
              <button onclick="showEditPlayerModal('${player.id}')" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded-lg flex items-center justify-center gap-1">
                <i data-lucide="edit" class="w-4 h-4"></i>
                Editar
              </button>
              <button onclick="deletePlayerConfirm('${player.id}')" class="bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded-lg">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

// Buscar jugadores en tiempo real
document.getElementById('playerSearch')?.addEventListener('input', renderPlayersList);

// Mostrar detalles del jugador - MEJORADO CON TELÉFONOS FORMATEADOS
function showPlayerDetails(playerId) {
  const player = getPlayerById(playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }
  
  const age = calculateAge(player.birthDate);
  const payments = getPaymentsByPlayer(playerId);
  const paid = payments.filter(p => p.status === 'Pagado');
  const pending = payments.filter(p => p.status === 'Pendiente');
  const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
  const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
  
  const isActive = player.status === 'Activo';
  const statusClass = isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  
  const content = `
    <div class="space-y-4">
      <!-- Avatar y datos básicos -->
      <div class="text-center">
        <img src="${player.avatar || getDefaultAvatar()}" alt="${player.name}" class="w-32 h-32 rounded-full object-cover border-4 border-teal-500 mx-auto mb-4">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">${player.name}</h2>
        <p class="text-gray-500 dark:text-gray-400">${player.category} • ${age} años</p>
        ${player.position || player.jerseyNumber ? `
          <p class="text-teal-600 dark:text-teal-400 font-medium mt-1">
            ${player.position ? player.position : ''} ${player.jerseyNumber ? '• Dorsal #' + player.jerseyNumber : ''}
          </p>
        ` : ''}
        <button 
          onclick="togglePlayerStatus('${player.id}'); showPlayerDetails('${player.id}')" 
          class="inline-block mt-2 px-4 py-1 rounded-full text-sm font-medium ${statusClass} cursor-pointer hover:opacity-80 transition-opacity"
        >
          ${player.status || 'Activo'}
        </button>
      </div>
      
      <!-- Información personal -->
      <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
        <h3 class="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
          <i data-lucide="user" class="w-5 h-5 text-teal-600"></i>
          Información Personal
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Fecha de nacimiento:</span>
            <span class="text-gray-800 dark:text-white font-medium">${formatDate(player.birthDate)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Teléfono:</span>
            <a href="${getWhatsAppLink(player.phone)}" target="_blank" class="text-teal-600 dark:text-teal-400 font-medium hover:underline">${formatPhoneDisplay(player.phone)}</a>
          </div>
          ${player.emergencyContact ? `
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Contacto emergencia:</span>
              <a href="${getWhatsAppLink(player.emergencyContact)}" target="_blank" class="text-teal-600 dark:text-teal-400 font-medium hover:underline">${formatPhoneDisplay(player.emergencyContact)}</a>
            </div>
          ` : ''}
          ${player.email ? `
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Email:</span>
              <span class="text-gray-800 dark:text-white font-medium">${player.email}</span>
            </div>
          ` : ''}
          ${player.address ? `
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Dirección:</span>
              <span class="text-gray-800 dark:text-white font-medium">${player.address}</span>
            </div>
          ` : ''}
          ${player.uniformSize ? `
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Talla uniforme:</span>
              <span class="text-gray-800 dark:text-white font-medium">${player.uniformSize}</span>
            </div>
          ` : ''}
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Fecha de inscripción:</span>
            <span class="text-gray-800 dark:text-white font-medium">${formatDate(player.enrollmentDate)}</span>
          </div>
        </div>
      </div>
      
      <!-- Información médica -->
      <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
        <h3 class="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
          <i data-lucide="heart-pulse" class="w-5 h-5 text-red-600"></i>
          Información Médica
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Tipo de sangre:</span>
            <span class="text-gray-800 dark:text-white font-medium">${player.medicalInfo?.bloodType || 'No especificado'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Alergias:</span>
            <span class="text-gray-800 dark:text-white font-medium">${player.medicalInfo?.allergies || 'Ninguna'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Medicamentos:</span>
            <span class="text-gray-800 dark:text-white font-medium">${player.medicalInfo?.medications || 'Ninguno'}</span>
          </div>
          ${player.medicalInfo?.conditions ? `
            <div>
              <span class="text-gray-500 dark:text-gray-400">Condiciones especiales:</span>
              <p class="text-gray-800 dark:text-white font-medium mt-1">${player.medicalInfo.conditions}</p>
            </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Historial de pagos -->
      <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
        <h3 class="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
          <i data-lucide="dollar-sign" class="w-5 h-5 text-green-600"></i>
          Historial de Pagos
        </h3>
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400">Total Pagado</p>
            <p class="text-lg font-bold text-green-600">${formatCurrency(totalPaid)}</p>
          </div>
          <div class="text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400">Total Pendiente</p>
            <p class="text-lg font-bold text-red-600">${formatCurrency(totalPending)}</p>
          </div>
        </div>
        
        ${payments.length > 0 ? `
          <div class="space-y-2 max-h-48 overflow-y-auto">
            ${payments.map(p => `
              <div class="flex items-center justify-between text-sm border-b border-gray-200 dark:border-gray-600 pb-2">
                <div>
                  <p class="font-medium text-gray-800 dark:text-white">${p.concept}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">${formatDate(p.paidDate || p.dueDate)}</p>
                </div>
                <div class="text-right">
                  <p class="font-bold text-gray-800 dark:text-white">${formatCurrency(p.amount)}</p>
                  <span class="text-xs ${p.status === 'Pagado' ? 'text-green-600' : 'text-red-600'}">${p.status}</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No hay pagos registrados</p>
        `}
      </div>
      
      <!-- Botones de acción -->
      <div class="flex gap-2">
        <button onclick="generatePlayerAccountStatementPDF('${player.id}')" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-lg flex items-center justify-center gap-2">
          <i data-lucide="file-text" class="w-5 h-5"></i>
          Estado de Cuenta PDF
        </button>
        <button onclick="sendAccountStatementWhatsApp('${player.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg flex items-center justify-center gap-2">
          <i data-lucide="message-circle" class="w-5 h-5"></i>
          Enviar WhatsApp
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('playerDetailsContent').innerHTML = content;
  document.getElementById('playerDetailsModal').classList.remove('hidden');
  lucide.createIcons();
}

// Cerrar modal detalles
function closePlayerDetailsModal() {
  document.getElementById('playerDetailsModal').classList.add('hidden');
}

// Eliminar jugador
function deletePlayerConfirm(playerId) {
  const player = getPlayerById(playerId);
  if (!player) return;
  
  if (confirmAction(`¿Estás seguro de eliminar a ${player.name}? Esta acción eliminará también todos sus pagos.`)) {
    deletePlayer(playerId);
    showToast('✅ Jugador eliminado');
    renderPlayersList();
    updateDashboard();
  }
}

console.log('✅ players.js cargado (CON NORMALIZACIÓN DE TELÉFONOS)');