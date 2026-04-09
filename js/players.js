// ========================================
// GESTIÓN DE JUGADORES - MEJORADO CON ESTADO ACTIVO/INACTIVO
// ✅ CON NORMALIZACIÓN DE TELÉFONOS
// 🆕 CON DOCUMENTO DE IDENTIDAD (TI/CC/CE)
// ========================================

let currentEditingPlayerId = null;
let currentStatusFilter = 'activo'; // 'todos', 'activo', 'inactivo' — por defecto solo activos
let currentCategoryFilter = 'todas'; // 'todas' o nombre de categoría
let _pendingDuplicateConfirm = null; // Guarda el callback del modal de duplicados

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
      closePlayerModal();
      renderPlayersList();
      updateDashboard();
    } else {
      // Crear nuevo — verificar duplicados primero
      const existing = getPlayers();
      const duplicate = findPotentialDuplicate(playerData, existing);

      if (duplicate) {
        // Mostrar advertencia con opción de guardar igual
        showDuplicateWarning(playerData, duplicate, () => {
          const newPlayer = {
            id: generateId(),
            ...playerData,
            status: 'Activo',
            enrollmentDate: getCurrentDate()
          };
          savePlayer(newPlayer);
          showToast('✅ Jugador agregado');
          closePlayerModal();
          renderPlayersList();
          updateDashboard();
        });
      } else {
        const newPlayer = {
          id: generateId(),
          ...playerData,
          status: 'Activo',
          enrollmentDate: getCurrentDate()
        };
        savePlayer(newPlayer);
        showToast('✅ Jugador agregado');
        closePlayerModal();
        renderPlayersList();
        updateDashboard();
      }
    }
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
  // Actualizar badge del botón Duplicados automáticamente
  const allPlayers = getPlayers();
  const dupCount = findAllDuplicates(allPlayers).length;
  const dupBtn = document.getElementById('duplicatesBtn');
  if (dupBtn) {
    // Quitar badge anterior si existe
    const oldBadge = dupBtn.querySelector('.dup-badge');
    if (oldBadge) oldBadge.remove();
    if (dupCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'dup-badge absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center';
      badge.textContent = dupCount;
      dupBtn.style.position = 'relative';
      dupBtn.appendChild(badge);
    }
  }

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
               class="px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 hover:opacity-80 text-xs font-semibold">
              Ver
            </button>
            <button onclick="deletePlayerDocument('${player.id}', '${doc.id}')"
                    class="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 hover:opacity-80 text-xs font-semibold">
              Borrar
            </button>
          </div>
        </div>
      `).join('');

  // Formulario de carga con paso a paso (solo si hay espacio)
  const uploadForm = docs.length < MAX_DOCS ? `
    <div class="space-y-2 mt-3">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        <strong class="text-blue-600 dark:text-blue-400">Paso 1:</strong> Escribí el nombre del documento
      </p>
      <input type="text" id="docName_${player.id}"
             placeholder="Ej: Registro Civil, Foto carnet..."
             class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        <strong class="text-blue-600 dark:text-blue-400">Paso 2:</strong> Buscá y seleccioná el archivo
      </p>
      <label class="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-2.5 rounded-lg cursor-pointer text-sm font-medium transition-all">
        <i data-lucide="upload" class="w-4 h-4"></i>
        Seleccionar archivo (PDF, imagen o Word)
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
      uploadedAt: new Date().toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
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

// ========================================
// DETECCIÓN DE DUPLICADOS
// ========================================

// Quita tildes, convierte a minúsculas y normaliza espacios
// Así "García" y "garcia" se tratan igual
function normalizeName(str) {
  if (!str) return '';
  return str.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// Calcula cuántos campos coinciden entre dos jugadores (sistema de puntaje)
// Retorna { score, reasons[] }
// Puntaje mínimo para marcar como duplicado: 3
function scoreDuplicate(a, b) {
  let score = 0;
  const reasons = [];

  const aDoc = a.documentNumber?.trim();
  const bDoc = b.documentNumber?.trim();

  // Documentos iguales → duplicado confirmado (3 puntos)
  if (aDoc && bDoc && aDoc === bDoc) {
    score += 3;
    reasons.push('Mismo número de documento');
  }

  // Documentos distintos → posible error de digitación, se advierte pero no descarta
  // El resto de campos sigue evaluándose normalmente
  if (aDoc && bDoc && aDoc !== bDoc) {
    reasons.push('Documentos distintos (posible error)');
  }

  // Nombre normalizado: vale 1 punto
  const aName = normalizeName(a.name);
  const bName = normalizeName(b.name);
  if (aName && bName && aName === bName) {
    score += 1;
    reasons.push('Mismo nombre');
  }

  // Fecha de nacimiento: vale 1 punto
  if (a.birthDate && b.birthDate && a.birthDate === b.birthDate) {
    score += 1;
    reasons.push('Misma fecha de nacimiento');
  }

  // Teléfono: vale 1 punto
  const aPhone = a.phone?.trim();
  const bPhone = b.phone?.trim();
  if (aPhone && bPhone && aPhone === bPhone) {
    score += 1;
    reasons.push('Mismo teléfono');
  }

  // Email: vale 1 punto
  const aEmail = a.email?.trim().toLowerCase();
  const bEmail = b.email?.trim().toLowerCase();
  if (aEmail && bEmail && aEmail === bEmail) {
    score += 1;
    reasons.push('Mismo email');
  }

  // Categoría: vale 1 punto (complementario, no alcanza solo)
  if (a.category && b.category && a.category === b.category) {
    score += 1;
    reasons.push('Misma categoría');
  }

  return { score, reasons };
}

// Compara un jugador nuevo contra la lista y devuelve el primero con score ≥ 3
function findPotentialDuplicate(newData, existingPlayers) {
  for (const p of existingPlayers) {
    const { score, reasons } = scoreDuplicate(newData, p);
    if (score >= 3) {
      return { player: p, reason: reasons.join(' · ') };
    }
  }
  return null;
}

// Escanea todos los jugadores y devuelve pares con score ≥ 3
function findAllDuplicates(players) {
  const pairs = [];
  const seen  = new Set();

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      const key = [a.id, b.id].sort().join('|');
      if (seen.has(key)) continue;

      const { score, reasons } = scoreDuplicate(a, b);
      if (score >= 3) {
        pairs.push({ a, b, reason: reasons.join(' · '), score });
        seen.add(key);
      }
    }
  }

  // Ordenar por puntaje descendente (los más sospechosos primero)
  return pairs.sort((a, b) => b.score - a.score);
}

// Muestra advertencia al crear un jugador que parece duplicado
function showDuplicateWarning(newData, duplicate, onConfirm) {
  const p = duplicate.player;
  const content    = document.getElementById('duplicatesContent');
  const countBadge = document.getElementById('duplicatesCount');
  if (!content) return;

  // Calcular campos coincidentes para resaltarlos
  const { reasons, score } = scoreDuplicate(newData, p);
  const hi  = 'text-xs font-semibold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 rounded px-1.5 py-0.5 inline-block';
  const nor = 'text-xs text-gray-500 dark:text-gray-400';

  const matchName     = reasons.includes('Mismo nombre');
  const matchDate     = reasons.includes('Misma fecha de nacimiento');
  const matchDoc      = reasons.includes('Mismo número de documento');
  const docsDiffer    = reasons.includes('Documentos distintos (posible error)');
  const matchPhone    = reasons.includes('Mismo teléfono');
  const matchEmail    = reasons.includes('Mismo email');
  const matchCategory = reasons.includes('Misma categoría');

  // Clases para doc con error de digitación (naranja)
  const warn = 'text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 rounded px-1.5 py-0.5 inline-block';

  const isStrong = score >= 4;

  countBadge.textContent = '⚠️ Posible duplicado';
  countBadge.className   = `${isStrong ? 'bg-red-500' : 'bg-yellow-500'} text-white text-xs font-bold px-2 py-0.5 rounded-full`;

  // Genera tarjeta de un jugador con campos resaltados
  const card = (data, label) => `
    <div class="bg-white dark:bg-gray-700 rounded-xl p-3 space-y-1.5">
      <p class="text-xs font-bold uppercase tracking-wide mb-2 ${label === 'Ya registrado' ? 'text-red-500' : 'text-blue-500'}">
        ${label === 'Ya registrado' ? '🔴' : '🆕'} ${label}
      </p>
      <p class="text-sm font-bold ${matchName ? 'text-green-700 dark:text-green-300' : 'text-gray-800 dark:text-white'}">${data.name || '—'}</p>
      <p class="${matchCategory ? hi : nor}">📂 ${data.category || '—'}</p>
      <p class="${matchDate     ? hi : nor}">🎂 ${data.birthDate || '—'}</p>
      ${data.documentNumber ? `<p class="${matchDoc ? hi : docsDiffer ? warn : nor}">🪪 ${data.documentNumber}${docsDiffer ? ' ⚠️' : ''}</p>` : ''}
      ${data.phone  ? `<p class="${matchPhone ? hi : nor}">📱 ${data.phone}</p>`  : ''}
      ${data.email  ? `<p class="${matchEmail ? hi : nor}">✉️ ${data.email}</p>`  : ''}
    </div>
  `;

  // Separar razones: coincidencias en verde, advertencias en naranja
  const matchReasons = reasons.filter(r => !r.includes('distintos'));
  const warnReasons  = reasons.filter(r =>  r.includes('distintos'));

  content.innerHTML = `
    <div class="space-y-4">
      <!-- Alerta principal -->
      <div class="${isStrong ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'} border rounded-xl p-4">
        <p class="text-sm font-bold ${isStrong ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'} mb-1">
          ${isStrong ? '🔴 Este jugador ya está registrado' : '⚠️ Ya existe un jugador con datos similares'}
        </p>
        <p class="text-xs ${isStrong ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'} mb-3">
          Verde = datos que coinciden · Naranja = posible error de digitación
        </p>
        <div class="flex flex-wrap gap-1 mb-3">
          ${matchReasons.map(r => `<span class="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-semibold px-2 py-0.5 rounded-full">${r}</span>`).join('')}
          ${warnReasons.map(r  => `<span class="text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-semibold px-2 py-0.5 rounded-full">⚠️ ${r}</span>`).join('')}
        </div>
        ${docsDiffer ? `<p class="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2 mb-3">
          💡 Los documentos son distintos pero los otros datos coinciden. Puede ser un error al escribir el número — revisá cuál es el correcto antes de guardar.
        </p>` : ''}
        <!-- Comparación lado a lado -->
        <div class="grid grid-cols-2 gap-2">
          ${card(p, 'Ya registrado')}
          ${card(newData, 'Jugador nuevo')}
        </div>
      </div>

      <!-- Acciones -->
      <div class="flex gap-2">
        <button onclick="closeDuplicatesModal()"
          class="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-bold hover:opacity-80">
          ← Volver a editar
        </button>
        <button onclick="confirmDuplicateSave()"
          class="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold">
          Guardar de todas formas
        </button>
      </div>
    </div>
  `;

  // Guardar callback en variable global DESPUÉS de construir el HTML
  _pendingDuplicateConfirm = onConfirm;

  document.getElementById('duplicatesModal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Ejecuta el callback pendiente al confirmar desde el modal de advertencia
function confirmDuplicateSave() {
  closeDuplicatesModal();
  if (typeof _pendingDuplicateConfirm === 'function') {
    _pendingDuplicateConfirm();
    _pendingDuplicateConfirm = null;
  }
}

// Genera el HTML de un par de duplicados con campos coincidentes resaltados en verde
function renderDuplicatePairHTML(pair, idx) {
  const { reasons } = scoreDuplicate(pair.a, pair.b);

  // Mapeo de razones a campos del jugador
  const matchName     = reasons.includes('Mismo nombre');
  const matchDate     = reasons.includes('Misma fecha de nacimiento');
  const matchDoc      = reasons.includes('Mismo número de documento');
  const docsDiffer    = reasons.includes('Documentos distintos (posible error)');
  const matchPhone    = reasons.includes('Mismo teléfono');
  const matchEmail    = reasons.includes('Mismo email');
  const matchCategory = reasons.includes('Misma categoría');

  // Clases CSS: verde = coincide, naranja = posible error, gris = sin coincidencia
  const hi   = 'text-xs font-semibold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 rounded px-1.5 py-0.5 inline-block';
  const warn = 'text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 rounded px-1.5 py-0.5 inline-block';
  const nor  = 'text-xs text-gray-500 dark:text-gray-400';

  // Determinar cuál es más reciente por enrollmentDate (formato YYYY-MM-DD)
  // Si no hay fecha, usar el ID como desempate (contiene timestamp)
  const dateA = pair.a.enrollmentDate || '';
  const dateB = pair.b.enrollmentDate || '';
  const aIsNewer = dateA > dateB || (dateA === dateB && pair.a.id > pair.b.id);

  const playerCard = (p, isNewer) => `
    <div class="p-3 space-y-1.5 relative">
      ${isNewer ? `
        <div class="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          🆕 Más reciente
        </div>` : `
        <div class="absolute top-2 right-2 bg-gray-400 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          📅 Más antiguo
        </div>`}
      <div class="flex items-center gap-2 mb-2 pr-24">
        <img src="${p.avatar || ''}" onerror="this.style.display='none'"
          class="w-8 h-8 rounded-full object-cover flex-shrink-0">
        <p class="text-sm font-bold leading-tight ${matchName ? 'text-green-700 dark:text-green-300' : 'text-gray-800 dark:text-white'}">${p.name}</p>
      </div>
      <p class="${matchCategory ? hi : nor}">📂 ${p.category || '—'}</p>
      <p class="${matchDate ? hi : nor}">🎂 Nac: ${p.birthDate || '—'}</p>
      ${p.documentNumber ? `<p class="${matchDoc ? hi : docsDiffer ? warn : nor}">🪪 Doc: ${p.documentNumber}${docsDiffer ? ' ⚠️' : ''}</p>` : ''}
      ${p.phone          ? `<p class="${matchPhone ? hi : nor}">📱 Tel: ${p.phone}</p>`         : ''}
      ${p.email          ? `<p class="${matchEmail ? hi : nor}">✉️ ${p.email}</p>`               : ''}
      <p class="${nor}">Estado: ${p.status || 'Activo'}</p>
      ${p.enrollmentDate ? `<p class="text-xs text-gray-400 dark:text-gray-500">Creado: ${p.enrollmentDate}</p>` : ''}
      <div class="flex gap-1 pt-2">
        <button onclick="closeDuplicatesModal(); showPlayerDetails('${p.id}')"
          class="flex-1 py-1.5 text-xs rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold hover:opacity-80">
          Ver
        </button>
        <button onclick="deleteDuplicatePlayer('${p.id}', ${idx})"
          class="flex-1 py-1.5 text-xs rounded-lg bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 font-semibold hover:opacity-80">
          Eliminar
        </button>
      </div>
    </div>
  `;

  return `
    <div class="border border-orange-200 dark:border-orange-800 rounded-xl overflow-hidden">
      <div class="bg-orange-50 dark:bg-orange-900/30 px-4 py-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          <i data-lucide="alert-triangle" class="w-4 h-4 text-orange-500 flex-shrink-0"></i>
          ${reasons.filter(r => !r.includes('distintos')).map(r => `<span class="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-semibold px-2 py-0.5 rounded-full">${r}</span>`).join('')}
          ${docsDiffer ? `<span class="text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-semibold px-2 py-0.5 rounded-full">⚠️ Docs distintos</span>` : ''}
        </div>
        <span class="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${pair.score >= 4 ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'}">
          ${pair.score >= 4 ? '🔴 Muy probable' : '🟡 Probable'}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-0 divide-x divide-gray-200 dark:divide-gray-700">
        ${playerCard(pair.a, aIsNewer)}
        ${playerCard(pair.b, !aIsNewer)}
      </div>
    </div>
  `;
}

// Abre el modal con todos los duplicados encontrados
function showDuplicatesModal() {
  // Asegurar que la pestaña activa sea "smart" al abrir
  const tabSmart = document.getElementById('tabSmartDup');
  const tabNames = document.getElementById('tabNameDup');
  if (tabSmart && tabNames) {
    tabSmart.className = 'px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
    tabNames.className = 'px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200';
  }

  const players = getPlayers();
  const pairs   = findAllDuplicates(players);

  const content    = document.getElementById('duplicatesContent');
  const countBadge = document.getElementById('duplicatesCount');
  if (!content) return;

  countBadge.className = 'bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full';
  countBadge.textContent = pairs.length > 0 ? pairs.length : '0';

  if (pairs.length === 0) {
    content.innerHTML = `
      <div class="flex flex-col items-center py-10 gap-3 text-center">
        <span class="text-5xl">✅</span>
        <p class="font-semibold text-gray-700 dark:text-gray-200">No se encontraron duplicados</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">Todos los jugadores tienen datos únicos.</p>
      </div>
    `;
  } else {
    content.innerHTML = `
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
        Se encontraron <strong>${pairs.length}</strong> posible${pairs.length > 1 ? 's' : ''} duplicado${pairs.length > 1 ? 's' : ''}.
        Revisá cada par y eliminá el que corresponda.
      </p>
      ${pairs.map((pair, idx) => renderDuplicatePairHTML(pair, idx)).join('')}
    `;
  }

  document.getElementById('duplicatesModal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Elimina un jugador desde el modal de duplicados y refresca la lista
function deleteDuplicatePlayer(playerId) {
  deletePlayer(playerId);
  showToast('🗑️ Jugador eliminado');
  renderPlayersList();
  updateDashboard();
  // Refrescar el modal con la lista actualizada
  showDuplicatesModal();
}

// Cierra el modal de duplicados
function closeDuplicatesModal() {
  document.getElementById('duplicatesModal').classList.add('hidden');
  _pendingDuplicateConfirm = null;
}

// ========================================
// LIMPIEZA DE NOMBRES DUPLICADOS
// ========================================

// Cambia entre las dos pestañas del modal
function switchDuplicatesTab(tab) {
  const tabSmart = document.getElementById('tabSmartDup');
  const tabNames = document.getElementById('tabNameDup');
  const active   = 'px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
  const inactive = 'px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200';

  if (tab === 'smart') {
    tabSmart.className = active;
    tabNames.className = inactive;
    showDuplicatesModal();
  } else {
    tabSmart.className = inactive;
    tabNames.className = active;
    showNameDuplicatesTab();
  }
}

// Quita palabras consecutivas repetidas de un nombre
// "Roberth Roberth García" → "Roberth García"
function fixRepeatedName(name) {
  const words = name.trim().split(/\s+/);
  const result = [words[0]];
  for (let i = 1; i < words.length; i++) {
    if (normalizeName(words[i]) !== normalizeName(words[i - 1])) {
      result.push(words[i]);
    }
  }
  return result.join(' ');
}

// Devuelve jugadores cuyo nombre tiene al menos una palabra repetida consecutiva
function findRepeatedNamePlayers(players) {
  return players.filter(p => {
    if (!p.name) return false;
    return fixRepeatedName(p.name) !== p.name;
  });
}

// Agrupa jugadores que tienen exactamente el mismo nombre (normalizado)
function findNameDuplicates(players) {
  const groups = {};

  players.forEach(p => {
    const key = normalizeName(p.name);
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  // Solo grupos con más de un jugador
  return Object.values(groups)
    .filter(g => g.length > 1)
    .sort((a, b) => b.length - a.length); // más duplicados primero
}

// Muestra la pestaña de limpieza por nombre
function showNameDuplicatesTab() {
  const players  = getPlayers();
  const repeated = findRepeatedNamePlayers(players);
  const groups   = findNameDuplicates(players);
  const content  = document.getElementById('duplicatesContent');
  const badge    = document.getElementById('duplicatesCount');

  const totalIssues = repeated.length + groups.reduce((sum, g) => sum + g.length - 1, 0);
  badge.textContent = totalIssues > 0 ? `${totalIssues} a revisar` : '0';
  badge.className   = 'bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full';

  // Sección 1: nombres con palabra repetida
  const repeatedSection = repeated.length === 0 ? '' : `
    <div class="border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
      <div class="bg-blue-50 dark:bg-blue-900/30 px-4 py-2 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-blue-700 dark:text-blue-300">✏️ Nombres con palabra repetida</span>
          <span class="text-xs bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">${repeated.length}</span>
        </div>
        <button onclick="fixAllRepeatedNames()"
          class="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg">
          Corregir todos
        </button>
      </div>
      <div class="p-3 space-y-2">
        ${repeated.map(p => `
          <div class="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-400 dark:text-gray-500 line-through">${p.name}</p>
              <p class="text-sm font-semibold text-blue-700 dark:text-blue-300">→ ${fixRepeatedName(p.name)}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">${p.category || '—'}</p>
            </div>
            <button onclick="fixOneRepeatedName('${p.id}')"
              class="px-3 py-1.5 text-xs rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold hover:opacity-80 whitespace-nowrap flex-shrink-0">
              Corregir
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Sección 2: jugadores con el mismo nombre (registros duplicados)
  const namesSection = groups.length === 0 ? '' : `
    <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
      <strong>${groups.length}</strong> nombre${groups.length > 1 ? 's' : ''} registrado${groups.length > 1 ? 's' : ''} más de una vez — elegí cuál conservar:
    </p>
    ${groups.map(group => renderNameDuplicateGroup(group)).join('')}
  `;

  if (repeated.length === 0 && groups.length === 0) {
    content.innerHTML = `
      <div class="flex flex-col items-center py-10 gap-3 text-center">
        <span class="text-5xl">✅</span>
        <p class="font-semibold text-gray-700 dark:text-gray-200">Todo limpio</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">No hay nombres repetidos ni mal escritos.</p>
      </div>`;
    return;
  }

  content.innerHTML = repeatedSection + namesSection;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Corrige el nombre de un jugador eliminando la palabra repetida
function fixOneRepeatedName(playerId) {
  const player = getPlayerById(playerId);
  if (!player) return;
  const fixed = fixRepeatedName(player.name);
  updatePlayer(playerId, { name: fixed });
  showToast(`✅ "${player.name}" → "${fixed}"`);
  renderPlayersList();
  showNameDuplicatesTab();
}

// Corrige todos los jugadores con nombre repetido de una vez
function fixAllRepeatedNames() {
  const players  = getPlayers();
  const repeated = findRepeatedNamePlayers(players);
  repeated.forEach(p => updatePlayer(p.id, { name: fixRepeatedName(p.name) }));
  showToast(`✅ ${repeated.length} nombre${repeated.length > 1 ? 's' : ''} corregido${repeated.length > 1 ? 's' : ''}`);
  renderPlayersList();
  showNameDuplicatesTab();
}

// Genera el HTML de un grupo de jugadores con el mismo nombre
function renderNameDuplicateGroup(group) {
  // Ordenar: el más antiguo primero (por enrollmentDate o id)
  const sorted = [...group].sort((a, b) => {
    const da = a.enrollmentDate || '';
    const db = b.enrollmentDate || '';
    return da < db ? -1 : da > db ? 1 : a.id < b.id ? -1 : 1;
  });

  const rows = sorted.map((p, idx) => `
    <div class="flex items-center gap-3 p-3 rounded-xl border ${idx === 0 ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'}">
      <img src="${p.avatar || ''}" onerror="this.style.display='none'"
        class="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-gray-200 dark:bg-gray-600">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-gray-800 dark:text-white truncate">${p.name}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">${p.category || '—'} · Nac: ${p.birthDate || '—'}</p>
        ${p.documentNumber ? `<p class="text-xs text-gray-400 dark:text-gray-500">🪪 ${p.documentNumber}</p>` : ''}
        <p class="text-xs text-gray-400 dark:text-gray-500">
          ${idx === 0 ? '📅 Más antiguo' : '🆕 Más reciente'}
          ${p.enrollmentDate ? ` · Creado: ${p.enrollmentDate}` : ''}
        </p>
      </div>
      <div class="flex flex-col gap-1 flex-shrink-0">
        <button onclick="keepThisPlayerDeleteRest('${p.id}', ${JSON.stringify(group.map(x => x.id)).replace(/"/g, '&quot;')})"
          class="px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold whitespace-nowrap">
          ✓ Conservar este
        </button>
      </div>
    </div>
  `).join('');

  return `
    <div class="border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden">
      <div class="bg-purple-50 dark:bg-purple-900/30 px-4 py-2 flex items-center justify-between">
        <span class="text-sm font-bold text-purple-700 dark:text-purple-300">"${group[0].name}"</span>
        <span class="text-xs text-purple-500 dark:text-purple-400">${group.length} registros</span>
      </div>
      <div class="p-3 space-y-2">${rows}</div>
    </div>
  `;
}

// Conserva un jugador y elimina todos los demás del grupo
function keepThisPlayerDeleteRest(keepId, allIds) {
  const toDelete = allIds.filter(id => id !== keepId);
  toDelete.forEach(id => deletePlayer(id));

  const count = toDelete.length;
  showToast(`✅ ${count} registro${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''}`);
  renderPlayersList();
  updateDashboard();

  // Refrescar la pestaña actual
  showNameDuplicatesTab();
}

// ========================================
// EXPORTAR JUGADORES — EXCEL Y PDF
// ========================================

// Exporta todos los jugadores a un archivo Excel con todos sus datos
function exportPlayersExcel() {
  const players = getPlayers();
  if (players.length === 0) { showToast('No hay jugadores para exportar'); return; }

  if (!confirm(`¿Descargar el listado de ${players.length} jugadores en Excel?\n\nIncluye todos los datos: categoría, documento, teléfono, datos médicos, etc.`)) return;

  loadXLSX(function() {
    if (typeof XLSX === 'undefined') { showToast('❌ No se pudo cargar la librería Excel'); return; }

    // Encabezados de columnas
    const headers = [
      'Nombre', 'Categoría', 'Posición', 'Dorsal', 'Talla Uniforme',
      'Fecha Nacimiento', 'Tipo Doc.', 'Nro. Documento',
      'Teléfono', 'Email', 'Dirección', 'Contacto Emergencia',
      'Estado', 'Fecha Inscripción',
      'Tipo Sangre', 'EPS', 'SISBEN', 'Alergias', 'Medicamentos', 'Condiciones Médicas'
    ];

    // Una fila por jugador
    const rows = players.map(p => [
      p.name || '',
      p.category || '',
      p.position || '',
      p.jerseyNumber || '',
      p.uniformSize || '',
      p.birthDate || '',
      p.documentType || '',
      p.documentNumber || '',
      p.phone || '',
      p.email || '',
      p.address || '',
      p.emergencyContact || '',
      p.status || 'Activo',
      p.enrollmentDate || '',
      p.medicalInfo?.bloodType || '',
      p.medicalInfo?.eps || '',
      p.medicalInfo?.sisben || '',
      p.medicalInfo?.allergies || '',
      p.medicalInfo?.medications || '',
      p.medicalInfo?.conditions || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Ancho automático de columnas
    ws['!cols'] = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] || '').length));
      return { wch: Math.min(maxLen + 2, 40) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jugadores');

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `jugadores_${fecha}.xlsx`);
    showToast('✅ Excel descargado');
  });
}

// Exporta todos los jugadores a PDF (hoja apaisada, campos principales)
function exportPlayersPDF() {
  const players = getPlayers();
  if (players.length === 0) { showToast('No hay jugadores para exportar'); return; }

  if (!confirm(`¿Descargar el listado de ${players.length} jugadores en PDF?\n\nIncluye: nombre, categoría, documento, teléfono, email y estado.`)) return;

  if (typeof window.jspdf === 'undefined') {
    loadJsPDF(() => exportPlayersPDF());
    return;
  }

  const settings = getSchoolSettings();
  const { jsPDF } = window.jspdf;
  // Apaisado para que entren más columnas
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const PRIMARY = [13, 148, 136];
  const DARK    = [31, 41, 55];
  const GRAY    = [107, 114, 128];
  const LIGHT   = [243, 244, 246];
  const GREEN   = [22, 163, 74];
  const RED     = [220, 38, 38];

  // ── Encabezado ──
  try {
    if (settings.logo && settings.logo.startsWith('data:image')) {
      doc.addImage(settings.logo, 'PNG', 15, 8, 18, 18);
    }
  } catch (e) { /* sin logo */ }

  doc.setFontSize(14);
  doc.setTextColor(...PRIMARY);
  doc.setFont(undefined, 'bold');
  doc.text(normalizeForPDF(settings.name || 'MI CLUB'), 37, 16);

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont(undefined, 'normal');
  doc.text('LISTADO DE JUGADORES REGISTRADOS', 37, 22);

  const fechaGen = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.text(`Generado: ${fechaGen}  ·  Total: ${players.length} jugadores`, 37, 27);

  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(15, 32, 282, 32);

  // ── Definición de columnas (apaisado A4: 297mm ancho, márgenes 15+15=30, usable 267mm) ──
  const cols = [
    { label: 'Nombre',        x: 15,  w: 58 },
    { label: 'Categoria',     x: 73,  w: 28 },
    { label: 'Fecha Nac.',    x: 101, w: 24 },
    { label: 'Documento',     x: 125, w: 32 },
    { label: 'Telefono',      x: 157, w: 30 },
    { label: 'Email',         x: 187, w: 48 },
    { label: 'Estado',        x: 235, w: 20 },
    { label: 'Inscripcion',   x: 255, w: 27 }
  ];

  let y = 38;

  // Cabecera de tabla
  doc.setFillColor(...PRIMARY);
  doc.rect(15, y, 267, 7, 'F');
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  cols.forEach(c => doc.text(c.label, c.x + 1, y + 5));
  y += 7;

  // Filas
  players.forEach((p, i) => {
    // Salto de página si es necesario
    if (y > 188) {
      doc.addPage();
      y = 15;
      doc.setFillColor(...PRIMARY);
      doc.rect(15, y, 267, 7, 'F');
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      cols.forEach(c => doc.text(c.label, c.x + 1, y + 5));
      y += 7;
    }

    const rowH = 6;
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT);
      doc.rect(15, y, 267, rowH, 'F');
    }

    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...DARK);

    const docStr = p.documentNumber ? `${p.documentType || ''} ${p.documentNumber}`.trim() : '—';
    const estado = p.status || 'Activo';

    doc.text(normalizeForPDF(p.name || '').substring(0, 32),         cols[0].x + 1, y + 4);
    doc.text(normalizeForPDF(p.category || '—').substring(0, 15),    cols[1].x + 1, y + 4);
    doc.text(p.birthDate || '—',                                      cols[2].x + 1, y + 4);
    doc.text(normalizeForPDF(docStr).substring(0, 18),                cols[3].x + 1, y + 4);
    doc.text((p.phone || '—').substring(0, 16),                       cols[4].x + 1, y + 4);
    doc.text(normalizeForPDF(p.email || '—').substring(0, 26),        cols[5].x + 1, y + 4);

    // Estado con color
    doc.setTextColor(...(estado === 'Activo' ? GREEN : estado === 'Inactivo' ? RED : GRAY));
    doc.text(normalizeForPDF(estado),                                  cols[6].x + 1, y + 4);

    doc.setTextColor(...DARK);
    // Tomar solo los primeros 10 caracteres para mostrar YYYY-MM-DD sin el timestamp
    doc.text((p.enrollmentDate || '—').substring(0, 10),               cols[7].x + 1, y + 4);

    y += rowH;
  });

  const fecha = new Date().toISOString().slice(0, 10);
  doc.save(`jugadores_${fecha}.pdf`);
  showToast('✅ PDF descargado');
}

window.exportPlayersExcel = exportPlayersExcel;
window.exportPlayersPDF   = exportPlayersPDF;