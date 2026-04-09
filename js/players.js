// ========================================
// GESTIÓN DE JUGADORES - MEJORADO CON ESTADO ACTIVO/INACTIVO
// ✅ CON NORMALIZACIÓN DE TELÉFONOS
// 🆕 CON DOCUMENTO DE IDENTIDAD (TI/CC/CE)
// ========================================

let currentEditingPlayerId = null;
let currentStatusFilter = 'activo'; // 'todos', 'activo', 'inactivo' — por defecto solo activos
let currentCategoryFilter = 'todas'; // 'todas' o nombre de categoría

// Mostrar modal agregar jugador
function showAddPlayerModal() {
  currentEditingPlayerId = null;
  document.getElementById('playerModalTitle').textContent = 'Agregar Jugador';
  document.getElementById('playerForm').reset();
  document.getElementById('playerId').value = '';
  document.getElementById('playerAvatarPreview').src = getDefaultAvatar();
  document.getElementById('playerModal').classList.remove('hidden');

  // Restaurar datos si Android reinició la app al volver de la cámara
  const backup = sessionStorage.getItem('_cameraFormBackup');
  if (backup) {
    try {
      const saved = JSON.parse(backup);
      Object.entries(saved).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      });
    } catch(e) {}
    sessionStorage.removeItem('_cameraFormBackup');
  }
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
  document.getElementById('playerEps').value = player.medicalInfo?.eps || '';        // NUEVO
  document.getElementById('playerSisben').value = player.medicalInfo?.sisben || '';  // NUEVO
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
      conditions: document.getElementById('playerConditions').value,
      eps: document.getElementById('playerEps').value.trim(),        // NUEVO
      sisben: document.getElementById('playerSisben').value.trim()   // NUEVO
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
// ⭐ FUNCIÓN: Filtrar por categoría
function filterByCategory(category) {
  currentCategoryFilter = category;
  renderPlayersList();
}

// ⭐ FUNCIÓN: Cargar categorías en el selector
function loadCategoryFilter() {
  const players = getPlayers();
  const categories = [...new Set(players.map(p => p.category).filter(c => c))].sort();
  
  const select = document.getElementById('categoryFilter');
  if (!select) return;
  
  // Mantener la opción "Todas"
  select.innerHTML = '<option value="todas">Todas las categorías</option>';
  
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    if (cat === currentCategoryFilter) option.selected = true;
    select.appendChild(option);
  });
}
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
  
  // Filtrar por categoría
  if (currentCategoryFilter !== 'todas') {
    filtered = filtered.filter(p => p.category === currentCategoryFilter);
  }
  
  // Actualizar selector de categorías
  loadCategoryFilter();
  
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
      <div class="glass-card rounded-xl p-4 shadow-sm card-hover animate-slide-in ${!isActive ? 'opacity-75' : ''}">
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

// Buscar jugadores en tiempo real — con debounce para no reconstruir
// la lista en cada letra que se escribe (mejora rendimiento en móvil)
let _searchDebounceTimer = null;
document.getElementById('playerSearch')?.addEventListener('input', function() {
  clearTimeout(_searchDebounceTimer);
  _searchDebounceTimer = setTimeout(renderPlayersList, 300);
});

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
            <span class="text-gray-500 dark:text-gray-400">👨 Tel. Padre / Acudiente:</span>
            <a href="${getWhatsAppLink(player.phone)}" target="_blank" class="text-teal-600 dark:text-teal-400 font-medium hover:underline">${formatPhoneDisplay(player.phone)}</a>
          </div>
          ${player.emergencyContact ? `
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">👩 Tel. Madre:</span>
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
          ${player.medicalInfo?.eps ? `
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">EPS:</span>
              <span class="text-gray-800 dark:text-white font-medium">${player.medicalInfo.eps}</span>
            </div>
          ` : ''}
          ${player.medicalInfo?.sisben ? `
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Sisbén:</span>
              <span class="text-gray-800 dark:text-white font-medium">${player.medicalInfo.sisben}</span>
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
      
  <!-- Documentos del jugador -->
      ${renderDocumentsSection(player)}

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

// ── DOCUMENTOS DEL JUGADOR ───────────────────────────────────

// Genera el HTML de la sección de documentos dentro del perfil
function renderDocumentsSection(player) {
  const docs = player.documents || [];
  const MAX_DOCS = 5;

  // Lista de documentos ya subidos
  const docItems = docs.length === 0
    ? '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-3">No hay documentos cargados</p>'
    : docs.map(doc => `
        <div class="flex items-center justify-between bg-white dark:bg-gray-600 rounded-lg px-3 py-2 gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xl flex-shrink-0">${doc.fileType === 'pdf' ? '📄' : doc.fileType === 'word' ? '📝' : '🖼️'}</span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-800 dark:text-white truncate">${doc.name}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">${doc.uploadedAt || ''}</p>
            </div>
          </div>
          <div class="flex gap-1 flex-shrink-0">
            <button onclick="downloadDocument('${doc.url}')"
               class="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 hover:opacity-80"
               title="Descargar">
              <i data-lucide="download" class="w-4 h-4"></i>
            </button>
            <button onclick="deletePlayerDocument('${player.id}', '${doc.id}')"
                    class="p-1.5 rounded-lg bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 hover:opacity-80"
                    title="Eliminar">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `).join('');

  // Formulario de carga (solo si hay espacio)
  const uploadForm = docs.length < MAX_DOCS ? `
    <div class="space-y-2 mt-2">
      <input type="text" id="docName_${player.id}"
             placeholder="Nombre del documento (ej: Registro Civil)"
             class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
      <label class="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-2.5 rounded-lg cursor-pointer text-sm font-medium transition-all">
        <i data-lucide="upload" class="w-4 h-4"></i>
        Subir documento (PDF, imagen o Word)
        <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
               onchange="uploadPlayerDocument('${player.id}', this)">
      </label>
    </div>
  ` : '<p class="text-xs text-center text-gray-500 mt-2">Límite de 5 documentos alcanzado</p>';

  return `
    <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
      <h3 class="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
        <i data-lucide="folder-open" class="w-5 h-5 text-blue-600"></i>
        Documentos
        <span class="text-xs font-normal text-gray-500 dark:text-gray-400">${docs.length}/${MAX_DOCS}</span>
      </h3>
      <div class="space-y-2">
        ${docItems}
      </div>
      ${uploadForm}
    </div>
  `;
}

// Sube un documento al perfil del jugador
async function uploadPlayerDocument(playerId, input) {
  const file = input.files[0];
  if (!file) return;

  // Verificar que se escribió el nombre
  const nameInput = document.getElementById(`docName_${playerId}`);
  const docName = nameInput?.value.trim();
  if (!docName) {
    showToast('⚠️ Escribe el nombre del documento primero');
    input.value = '';
    return;
  }

  const player = getPlayerById(playerId);
  if (!player) return;

  const docs = player.documents || [];
  if (docs.length >= 5) {
    showToast('⚠️ Límite de 5 documentos alcanzado');
    return;
  }

  // Deshabilitar botón mientras sube
  const label = input.closest('label');
  if (label) {
    label.style.opacity = '0.6';
    label.style.pointerEvents = 'none';
  }
  showToast('⏳ Subiendo documento...');

  try {
    // Subir a Cloudinary a través de la capa de abstracción
    const result = await uploadDocument(file, playerId);

    const newDoc = {
      id:         generateId(),
      name:       docName,
      url:        result.url,
      publicId:   result.publicId,
      fileType:   result.fileType,
      uploadedAt: getCurrentDate()
    };

    // Guardar en el jugador (localStorage + Firebase si está disponible)
    updatePlayer(playerId, { documents: [...docs, newDoc] });

    showToast('✅ Documento subido correctamente');
    showPlayerDetails(playerId); // Refrescar la vista

  } catch (error) {
    showToast('❌ ' + error.message);
    input.value = '';
    if (label) {
      label.style.opacity = '';
      label.style.pointerEvents = '';
    }
  }
}

// Elimina un documento del perfil del jugador
function deletePlayerDocument(playerId, docId) {
  if (!confirm('¿Eliminar este documento? El registro se borrará del perfil.')) return;

  const player = getPlayerById(playerId);
  if (!player) return;

  const docs = (player.documents || []).filter(d => d.id !== docId);
  const docToDelete = (player.documents || []).find(d => d.id === docId);

  // Eliminar referencia en almacenamiento (Cloudinary soft-delete)
  if (docToDelete?.publicId) {
    deleteDocumentFromStorage(docToDelete.publicId);
  }

  updatePlayer(playerId, { documents: docs });
  showToast('🗑️ Documento eliminado');
  showPlayerDetails(playerId); // Refrescar la vista
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
  
  // URL del portal de padres - PRODUCCIÓN
  const portalURL = 'https://myclub-portal-padres.vercel.app';
  
  const modal = document.createElement('div');
  modal.id = 'parentCodeModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 animate-fade-in font-sans">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <i data-lucide="shield-check" class="w-6 h-6 text-emerald-600"></i> Acceso Parental
        </h3>
        <button onclick="closeParentCodeModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      
      <!-- Info del jugador -->
      <div class="flex items-center gap-4 mb-6">
        <div class="p-1 rounded-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700">
          <img src="${player.avatar || getDefaultAvatar()}" alt="${player.name}" class="w-14 h-14 rounded-full object-cover">
        </div>
        <div>
          <p class="font-semibold text-lg text-slate-800 dark:text-white">${player.name}</p>
          <p class="text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md inline-block mt-0.5">${player.category}</p>
        </div>
      </div>
      
      <!-- Código de acceso -->
      <div class="relative bg-slate-900 dark:bg-slate-950 rounded-xl p-6 text-white text-center mb-5 overflow-hidden">
        <div class="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg width=\\'60\\' height=\\'60\\' viewBox=\\'0 0 60 60\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cg fill=\\'none\\' fill-rule=\\'evenodd\\'%3E%3Cg fill=\\'%23ffffff\\' fill-opacity=\\'1\\'%3E%3Cpath d=\\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"></div>
        <p class="text-xs text-slate-400 font-medium uppercase tracking-widest mb-1 relative z-10">Código de Vinculación</p>
        <p id="parentAccessCode" class="text-3xl font-mono font-bold tracking-[0.2em] relative z-10">${code}</p>
      </div>
      
      <!-- Club ID y Copiar en grid -->
      <div class="grid grid-cols-2 gap-3 mb-5">
        <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-1">Club ID</p>
          <p class="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">${clubId}</p>
        </div>
        <button onclick="copyParentCode('${code}')" class="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors group">
          <i data-lucide="copy" class="w-4 h-4 text-emerald-600 mb-1 group-hover:scale-110 transition-transform"></i>
          <span class="text-xs font-medium">Copiar Datos</span>
        </button>
      </div>
      
      <!-- Instrucciones (Más limpias) -->
      <div class="bg-blue-50/50 dark:bg-slate-800/50 border-l-4 border-blue-500 rounded-r-lg p-4 mb-6">
        <p class="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
           Instrucciones de acceso:
        </p>
        <ul class="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-disc list-inside">
          <li>Ir a <a href="${portalURL}" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">Portal de Padres</a></li>
          <li>Ingresar el Club ID <span class="font-mono text-xs bg-slate-200 dark:bg-slate-700 px-1 rounded">${clubId}</span></li>
          <li>Ingresar el Código generado</li>
        </ul>
      </div>
      
      <!-- Botones de acción principales -->
      <div class="space-y-3">
        <button onclick="shareParentCodeWhatsApp('${player.name}', '${clubId}', '${code}', '${player.phone}')" class="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white py-3 rounded-xl font-medium transition-colors shadow-sm">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Enviar Vía WhatsApp
        </button>
        
        <button onclick="regenerateParentCode('${player.id}')" class="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 py-3 rounded-xl font-medium transition-colors">
          <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          Regenerar Nuevo Código
        </button>
      </div>
      
      ${isExisting ? `
        <div class="mt-4 py-2 px-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs text-center flex items-center justify-center gap-1.5 border border-amber-100 dark:border-amber-800/30">
          <i data-lucide="info" class="w-3.5 h-3.5"></i> Jugador con código previamente asignado
        </div>
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
  // URL del portal de padres - PRODUCCIÓN
  const portalURL = 'https://myclub-portal-padres.vercel.app';
  
  const message = `\u{1F389} *Acceso al Portal de Padres*

Hola! Te comparto el acceso para ver la información de *${playerName}* en ${settings.name || 'nuestra escuela de fútbol'}.

\u{1F4F1} *Pasos para acceder:*
1. Abre este link: ${portalURL}
2. Club ID: *${clubId}*
3. Código: *${code}*

\u{1F4A1} Puedes instalar la app en tu celular para acceder más rápido.

\u{26BD} ¡Gracias por confiar en nosotros!`;

  const encodedMessage = encodeURIComponent(message).replace(/%20/g, '+');
  
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