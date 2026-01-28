// ========================================
// GESTIÓN DE JUGADORES - MEJORADO CON ESTADO ACTIVO/INACTIVO
// ✅ CON NORMALIZACIÓN DE TELÉFONOS
// 🆕 CON DOCUMENTO DE IDENTIDAD (TI/CC/CE)
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
  
  // 🆕 CARGAR DOCUMENTO DE IDENTIDAD
  document.getElementById('playerDocumentType').value = player.documentType || '';
  document.getElementById('playerDocumentNumber').value = player.documentNumber || '';
  
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

// Guardar jugador - MEJORADO CON NORMALIZACIÓN DE TELÉFONOS Y DOCUMENTO
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
    phone: normalizePhone(document.getElementById('playerPhone').value),
    address: document.getElementById('playerAddress').value,
    emergencyContact: normalizePhone(document.getElementById('playerEmergencyContact').value),
    // 🆕 DOCUMENTO DE IDENTIDAD
    documentType: document.getElementById('playerDocumentType').value,
    documentNumber: document.getElementById('playerDocumentNumber').value.trim(),
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

// 🆕 Función para formatear documento de identidad
function formatDocument(type, number) {
  if (!type || !number) return 'No registrado';
  return `${type} ${number}`;
}

// 🆕 Función para obtener el nombre completo del tipo de documento
function getDocumentTypeName(type) {
  const types = {
    'TI': 'Tarjeta de Identidad',
    'CC': 'Cédula de Ciudadanía',
    'CE': 'Cédula de Extranjería',
    'RC': 'Registro Civil',
    'PA': 'Pasaporte',
    'NUIP': 'NUIP'
  };
  return types[type] || type || 'No especificado';
}

// Renderizar lista de jugadores - MEJORADO CON TELÉFONOS FORMATEADOS Y DOCUMENTO
function renderPlayersList() {
  const players = getPlayers();
  const searchTerm = document.getElementById('playerSearch')?.value || '';
  
  // Filtrar por búsqueda (ahora incluye documento)
  let filtered = filterBySearch(players, searchTerm, ['name', 'category', 'phone', 'email', 'position', 'jerseyNumber', 'documentNumber']);
  
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
              ${player.documentNumber ? `
                <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <i data-lucide="id-card" class="w-4 h-4"></i>
                  ${player.documentType || 'Doc'}: ${player.documentNumber}
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

// Mostrar detalles del jugador - MEJORADO CON DOCUMENTO
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
          <!-- 🆕 DOCUMENTO DE IDENTIDAD -->
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">Documento:</span>
            <span class="text-gray-800 dark:text-white font-medium">
              ${player.documentType && player.documentNumber 
                ? `${getDocumentTypeName(player.documentType)}: ${player.documentNumber}` 
                : 'No registrado'}
            </span>
          </div>
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
        <div class="space-y-2">
          <!-- Fila 1: PDF y WhatsApp -->
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
          
          <!-- Fila 2: Acceso para Padres -->
          <button onclick="generateParentCode('${player.id}')" class="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg">
            <i data-lucide="users" class="w-5 h-5"></i>
            👨‍👩‍👧 Generar Acceso para Padres
          </button>
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

// Hacer funciones globales
window.formatDocument = formatDocument;
window.getDocumentTypeName = getDocumentTypeName;

console.log('✅ players.js cargado (CON DOCUMENTO DE IDENTIDAD)');

// ========================================
// 🆕 PORTAL DE PADRES - GENERAR CÓDIGO
// ========================================
// 📍 AGREGAR ESTE CÓDIGO AL FINAL DE players.js
// 📍 ANTES de: console.log('✅ players.js cargado...');
// ========================================

// Generar y mostrar código de acceso para padres
function generateParentCode(playerId) {
  const player = getPlayerById(playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }
  
  // Verificar si ya tiene código
  const existingCode = getParentCodeByPlayer(playerId);
  
  if (existingCode) {
    // Mostrar código existente con opción de regenerar
    showParentCodeModal(player, existingCode.code, true);
  } else {
    // Generar nuevo código
    const newCode = generateParentAccessCode();
    saveParentCode(playerId, newCode);
    showParentCodeModal(player, newCode, false);
  }
}

// Regenerar código de acceso
function regenerateParentCode(playerId) {
  const player = getPlayerById(playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }
  
  if (!confirmAction('¿Regenerar código? El código anterior dejará de funcionar.')) {
    return;
  }
  
  const newCode = generateParentAccessCode();
  saveParentCode(playerId, newCode);
  showToast('✅ Nuevo código generado');
  
  // Actualizar modal
  document.getElementById('parentAccessCode').textContent = newCode;
}

// Mostrar modal con código de acceso
function showParentCodeModal(player, code, isExisting) {
  const settings = getSchoolSettings();
  const clubId = localStorage.getItem('clubId') || settings.clubId || 'mi-club';
  
  // Construir URL del portal
  const portalURL = `${window.location.origin}/portal-padre.html`;
  
  const modal = document.createElement('div');
  modal.id = 'parentCodeModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
      <!-- Header -->
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          👨‍👩‍👧 Acceso para Padres
        </h3>
        <button onclick="closeParentCodeModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <!-- Info del jugador -->
      <div class="flex items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
        <img src="${player.avatar || getDefaultAvatar()}" alt="${player.name}" class="w-12 h-12 rounded-full object-cover border-2 border-teal-500">
        <div>
          <p class="font-semibold text-gray-800 dark:text-white">${player.name}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">${player.category}</p>
        </div>
      </div>
      
      <!-- Código de acceso -->
      <div class="bg-gradient-to-r from-teal-500 to-blue-500 rounded-xl p-4 text-white text-center mb-4">
        <p class="text-sm opacity-90 mb-1">Código de Acceso</p>
        <p id="parentAccessCode" class="text-3xl font-mono font-bold tracking-widest">${code}</p>
      </div>
      
      <!-- Club ID -->
      <div class="bg-gray-100 dark:bg-gray-700 rounded-xl p-3 mb-4">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Club ID</p>
        <p class="font-mono text-gray-800 dark:text-white">${clubId}</p>
      </div>
      
      <!-- Instrucciones -->
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-4">
        <p class="font-semibold text-blue-800 dark:text-blue-300 mb-2">📱 Instrucciones para el padre:</p>
        <ol class="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
          <li>Abrir: <span class="font-mono">${portalURL}</span></li>
          <li>Ingresar Club ID: <strong>${clubId}</strong></li>
          <li>Ingresar Código: <strong>${code}</strong></li>
          <li>¡Listo! Puede instalar la app en su celular</li>
        </ol>
      </div>
      
      <!-- Botones de acción -->
      <div class="grid grid-cols-2 gap-3 mb-3">
        <button onclick="copyParentCode('${code}')" class="flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white py-2 rounded-lg transition-colors">
          <i data-lucide="copy" class="w-4 h-4"></i>
          Copiar Código
        </button>
        <button onclick="shareParentCodeWhatsApp('${player.name}', '${clubId}', '${code}', '${player.phone}')" class="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg transition-colors">
          <i data-lucide="message-circle" class="w-4 h-4"></i>
          WhatsApp
        </button>
      </div>
      
      <!-- Regenerar código -->
      <button onclick="regenerateParentCode('${player.id}')" class="w-full flex items-center justify-center gap-2 border border-orange-500 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 py-2 rounded-lg transition-colors">
        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
        Regenerar Código
      </button>
      
      ${isExisting ? `
        <p class="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
          ⚠️ Este jugador ya tenía un código asignado
        </p>
      ` : ''}
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Agregar estilos de animación si no existen
  if (!document.getElementById('parentCodeModalStyles')) {
    const style = document.createElement('style');
    style.id = 'parentCodeModalStyles';
    style.textContent = `
      @keyframes fade-in {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      .animate-fade-in { animation: fade-in 0.3s ease-out; }
    `;
    document.head.appendChild(style);
  }
  
  // Recrear iconos
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// Cerrar modal de código
function closeParentCodeModal() {
  const modal = document.getElementById('parentCodeModal');
  if (modal) {
    modal.remove();
  }
}

// Copiar código al portapapeles
function copyParentCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast('✅ Código copiado');
  }).catch(() => {
    showToast('⚠️ No se pudo copiar');
  });
}

// Compartir por WhatsApp
function shareParentCodeWhatsApp(playerName, clubId, code, phone) {
  const settings = getSchoolSettings();
  const portalURL = `${window.location.origin}/portal-padre.html`;
  
  const message = `🎉 *Acceso al Portal de Padres*

Hola! Te comparto el acceso para ver la información de *${playerName}* en ${settings.name || 'nuestra escuela de fútbol'}.

📱 *Pasos para acceder:*
1. Abre este link: ${portalURL}
2. Club ID: *${clubId}*
3. Código: *${code}*

💡 Puedes instalar la app en tu celular para acceder más rápido.

⚽ ¡Gracias por confiar en nosotros!`;

  const encodedMessage = encodeURIComponent(message);
  
  // Si tiene teléfono, enviar directo
  if (phone) {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
  } else {
    // Abrir WhatsApp sin número
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  }
}

// Exportar funciones globalmente
window.generateParentCode = generateParentCode;
window.regenerateParentCode = regenerateParentCode;
window.showParentCodeModal = showParentCodeModal;
window.closeParentCodeModal = closeParentCodeModal;
window.copyParentCode = copyParentCode;
window.shareParentCodeWhatsApp = shareParentCodeWhatsApp;

console.log('✅ Sistema de código de padres en players.js cargado');