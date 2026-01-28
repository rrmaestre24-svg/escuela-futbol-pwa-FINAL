// ========================================
// 💬 SISTEMA DE CHAT DE SUGERENCIAS - ADMIN (ESTILO PORTAL PADRES)
// ========================================
// 📍 Este archivo maneja el modal con tabs: "Nuevo" y "Mis sugerencias"
// ========================================

console.log('💬 Cargando sistema de chat de sugerencias estilo portal padres...');

// Variables globales
let adminSuggestions = [];
let checkInterval = null;
let currentTab = 'nuevo'; // 'nuevo' o 'mis-sugerencias'

// ========================================
// ABRIR MODAL DE SUGERENCIAS (DESDE BOTÓN FLOTANTE)
// ========================================

function openAdminSuggestionModal() {
  console.log('💡 Abriendo modal de sugerencias...');
  
  let modal = document.getElementById('adminSuggestionChatModal');
  
  // Si no existe el modal, crearlo
  if (!modal) {
    modal = createAdminSuggestionChatModal();
    document.body.appendChild(modal);
  }
  
  // Mostrar modal
  modal.classList.remove('hidden');
  
  // Cargar sugerencias
  loadAdminSuggestionsForModal();
  
  // Iniciar verificación de nuevas respuestas
  startSuggestionCheck();
  
  // Mostrar tab de "Nuevo" por defecto
  switchTab('nuevo');
  
  // Reinicializar iconos
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ========================================
// CERRAR MODAL
// ========================================

function closeAdminSuggestionChatModal() {
  const modal = document.getElementById('adminSuggestionChatModal');
  if (modal) {
    modal.classList.add('hidden');
    
    // Detener verificación
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }
}

// ========================================
// CREAR MODAL CON TABS
// ========================================

function createAdminSuggestionChatModal() {
  const modal = document.createElement('div');
  modal.id = 'adminSuggestionChatModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 hidden';
  
  modal.innerHTML = `
    <div class="bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl overflow-hidden animate-scale-in">
      <!-- Header -->
      <div class="bg-gradient-to-r from-amber-500 to-orange-500 p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-4xl">💡</span>
            <div>
              <h2 class="text-2xl font-bold text-white">Mejoras de la App</h2>
              <p class="text-amber-100 text-sm">Ayúdanos a mejorar MY CLUB</p>
            </div>
          </div>
          <button onclick="closeAdminSuggestionChatModal()" 
                  class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors">
            <i data-lucide="x" class="w-6 h-6"></i>
          </button>
        </div>
      </div>
      
      <!-- Tabs -->
      <div class="bg-gray-750 border-b border-gray-700 flex" style="background: rgba(31, 41, 55, 0.5);">
        <button onclick="switchTab('nuevo')" 
                data-tab="nuevo"
                class="tab-button flex-1 px-6 py-4 font-medium transition-colors border-b-2 border-transparent text-gray-400 hover:text-white hover:bg-gray-700/50">
          <div class="flex items-center justify-center gap-2">
            <i data-lucide="edit-3" class="w-5 h-5"></i>
            <span>Nuevo</span>
          </div>
        </button>
        <button onclick="switchTab('mis-sugerencias')" 
                data-tab="mis-sugerencias"
                class="tab-button flex-1 px-6 py-4 font-medium transition-colors border-b-2 border-transparent text-gray-400 hover:text-white hover:bg-gray-700/50 relative">
          <div class="flex items-center justify-center gap-2">
            <i data-lucide="clipboard-list" class="w-5 h-5"></i>
            <span>Mis sugerencias</span>
            <span id="unreadBadgeTab" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">0</span>
          </div>
        </button>
      </div>
      
      <!-- Contenido con scroll -->
      <div class="overflow-y-auto max-h-[60vh]">
        <!-- Tab: Nuevo -->
        <div id="tabNuevo" class="p-6 space-y-4 hidden">
          <div class="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mb-4">
            <div class="flex gap-3">
              <i data-lucide="info" class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"></i>
              <div class="text-sm text-blue-200">
                <p class="font-medium mb-1">📧 ¿Tienes ideas para mejorar esta aplicación?</p>
                <p class="text-blue-300/80">
                  Tu mensaje será enviado al <strong>desarrollador de MY CLUB</strong>, no a la escuela de tu hijo.
                </p>
              </div>
            </div>
          </div>
          
          <!-- Formulario -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Tu nombre
            </label>
            <input type="text" id="adminSenderName" 
                   placeholder="Ej: María García"
                   class="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Tipo de mensaje
            </label>
            <select id="adminSuggestionType" 
                    class="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors">
              <option value="sugerencia">💡 Sugerencia - Idea para mejorar</option>
              <option value="pregunta">❓ Pregunta - Duda sobre la app</option>
              <option value="queja">😤 Queja - Algo no funciona bien</option>
              <option value="felicitacion">🎉 Felicitación - Me encanta algo</option>
              <option value="bug">🐛 Bug - Error técnico</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Tu mensaje *
            </label>
            <textarea id="adminSuggestionMessage" 
                      rows="6"
                      placeholder="Ej: Me gustaría que la aplicación tuviera... / Encontré un error cuando..."
                      class="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors resize-none"></textarea>
            <p class="text-xs text-gray-400 mt-1">
              Mínimo 10 caracteres
            </p>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Teléfono (opcional)
            </label>
            <input type="tel" id="adminSenderPhone" 
                   placeholder="Ej: +57 300 123 4567"
                   class="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors">
          </div>
          
          <button onclick="submitAdminSuggestionFromModal()" 
                  class="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg transition-colors font-medium shadow-lg flex items-center justify-center gap-2">
            <i data-lucide="send" class="w-5 h-5"></i>
            Enviar al Desarrollador
          </button>
        </div>
        
        <!-- Tab: Mis Sugerencias -->
        <div id="tabMisSugerencias" class="p-6 hidden">
          <div id="adminSuggestionsListModal" class="space-y-4">
            <!-- Aquí se cargan las sugerencias -->
            <div class="text-center py-8">
              <div class="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-gray-400">Cargando tus sugerencias...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Cerrar al hacer clic fuera del modal
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeAdminSuggestionChatModal();
    }
  });
  
  return modal;
}

// ========================================
// CAMBIAR DE TAB
// ========================================

function switchTab(tabName) {
  currentTab = tabName;
  
  // Ocultar todos los contenidos
  document.getElementById('tabNuevo').classList.add('hidden');
  document.getElementById('tabMisSugerencias').classList.add('hidden');
  
  // Remover clase activa de todos los botones
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('border-amber-500', 'text-white', 'bg-gray-700/50');
    btn.classList.add('border-transparent', 'text-gray-400');
  });
  
  // Activar tab seleccionado
  const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeButton) {
    activeButton.classList.add('border-amber-500', 'text-white', 'bg-gray-700/50');
    activeButton.classList.remove('border-transparent', 'text-gray-400');
  }
  
  // Mostrar contenido correspondiente
  if (tabName === 'nuevo') {
    document.getElementById('tabNuevo').classList.remove('hidden');
  } else {
    document.getElementById('tabMisSugerencias').classList.remove('hidden');
    loadAdminSuggestionsForModal();
  }
  
  // Reinicializar iconos
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ========================================
// CARGAR SUGERENCIAS PARA EL MODAL
// ========================================

async function loadAdminSuggestionsForModal() {
  const container = document.getElementById('adminSuggestionsListModal');
  if (!container) return;
  
  try {
    // Obtener Firebase instance
    const firebaseInstance = window.firebase || window.firebaseAdmin;
    if (!firebaseInstance?.db) {
      throw new Error('Firebase no está inicializado');
    }

    const { db, collection, query, where, orderBy, getDocs } = firebaseInstance;
    
    // Obtener clubId del usuario actual
    const clubId = localStorage.getItem('clubId');
    const currentUser = getCurrentUser();
    
    if (!clubId || !currentUser) {
      throw new Error('No se pudo obtener la información del club');
    }

    // Consultar sugerencias de este club que NO sean de padres
    const suggestionsRef = collection(db, 'suggestions');
    const q = query(
      suggestionsRef,
      where('clubId', '==', clubId),
      where('senderType', '==', 'admin'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    
    adminSuggestions = [];
    snapshot.forEach(doc => {
      adminSuggestions.push({ id: doc.id, ...doc.data() });
    });

    console.log('✅ Sugerencias cargadas:', adminSuggestions.length);
    
    // Renderizar
    renderAdminSuggestionsInModal();
    updateUnreadBadge();
    
  } catch (error) {
    console.error('❌ Error al cargar sugerencias:', error);
    container.innerHTML = `
      <div class="text-center py-8">
        <span class="text-6xl">❌</span>
        <p class="text-red-400 mt-4 font-medium">Error al cargar sugerencias</p>
        <p class="text-gray-500 text-sm mt-2">${error.message}</p>
        <button onclick="loadAdminSuggestionsForModal()" 
                class="mt-4 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors">
          Reintentar
        </button>
      </div>
    `;
  }
}

// ========================================
// RENDERIZAR SUGERENCIAS EN EL MODAL
// ========================================

function renderAdminSuggestionsInModal() {
  const container = document.getElementById('adminSuggestionsListModal');
  if (!container) return;

  if (adminSuggestions.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12">
        <span class="text-8xl mb-4 block">💡</span>
        <p class="text-xl font-medium text-gray-300 mb-2">No has enviado sugerencias aún</p>
        <p class="text-gray-500 mb-6">¿Tienes una idea para mejorar MY CLUB?</p>
        <button onclick="switchTab('nuevo')" 
                class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg">
          💡 Enviar mi primera sugerencia
        </button>
      </div>
    `;
    return;
  }

  const typeIcons = {
    'sugerencia': '💡',
    'pregunta': '❓',
    'queja': '😤',
    'felicitacion': '🎉',
    'bug': '🐛'
  };

  container.innerHTML = adminSuggestions.map(s => {
    const date = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || Date.now());
    const hasResponse = !!s.response;
    const isUnread = hasResponse && !s.responseRead;
    
    return `
      <div class="bg-gray-700 rounded-xl p-4 ${isUnread ? 'ring-2 ring-teal-500 animate-pulse-slow' : ''}">
        <!-- Header -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-2xl">${typeIcons[s.type] || '💬'}</span>
            <div>
              <p class="font-medium text-white capitalize">${s.type || 'Mensaje'}</p>
              <p class="text-xs text-gray-400">
                ${date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
          </div>
          ${isUnread ? `
            <span class="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce">
              NUEVA
            </span>
          ` : ''}
        </div>
        
        <!-- Tu mensaje -->
        <div class="mb-3">
          <p class="text-sm text-gray-300 bg-gray-800 rounded-lg p-3">${s.message}</p>
        </div>
        
        <!-- Respuesta -->
        ${hasResponse ? `
          <div class="bg-green-900/30 border-l-4 border-green-500 rounded-lg p-3 mt-3">
            <div class="flex items-center gap-2 mb-2">
              <i data-lucide="check-circle" class="w-4 h-4 text-green-400"></i>
              <p class="text-xs font-medium text-green-400">Respuesta del administrador:</p>
            </div>
            <p class="text-sm text-gray-200">${s.response}</p>
            ${s.responseAt ? `
              <p class="text-xs text-gray-400 mt-2">
                ${formatResponseDate(s.responseAt)}
              </p>
            ` : ''}
            ${isUnread ? `
              <button onclick="markAsReadFromModal('${s.id}')" 
                      class="mt-2 text-xs text-teal-400 hover:text-teal-300 transition-colors">
                ✓ Marcar como leída
              </button>
            ` : ''}
          </div>
        ` : `
          <div class="bg-amber-900/30 border-l-4 border-amber-500 rounded-lg p-3 mt-3">
            <p class="text-xs text-amber-400">
              ⏳ Tu mensaje está siendo revisado por el equipo de MY CLUB
            </p>
          </div>
        `}
      </div>
    `;
  }).join('');

  // Reinicializar iconos
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ========================================
// ENVIAR SUGERENCIA DESDE EL MODAL
// ========================================

async function submitAdminSuggestionFromModal() {
  const name = document.getElementById('adminSenderName')?.value?.trim();
  const type = document.getElementById('adminSuggestionType')?.value;
  const message = document.getElementById('adminSuggestionMessage')?.value?.trim();
  const phone = document.getElementById('adminSenderPhone')?.value?.trim();
  
  // Validaciones
  if (!message) {
    if (typeof showToast === 'function') {
      showToast('❌ Por favor escribe tu mensaje');
    } else {
      alert('❌ Por favor escribe tu mensaje');
    }
    return;
  }
  
  if (message.length < 10) {
    if (typeof showToast === 'function') {
      showToast('❌ El mensaje debe tener al menos 10 caracteres');
    } else {
      alert('❌ El mensaje debe tener al menos 10 caracteres');
    }
    return;
  }
  
  // Verificar Firebase
  const firebaseInstance = window.firebase || window.firebaseAdmin;
  if (!firebaseInstance?.db) {
    console.error('Firebase no está inicializado');
    if (typeof showToast === 'function') {
      showToast('❌ Error: Sistema de base de datos no disponible');
    } else {
      alert('❌ Error: Sistema de base de datos no disponible');
    }
    return;
  }
  
  try {
    // Mostrar estado de carga
    if (typeof showToast === 'function') {
      showToast('⏳ Enviando sugerencia...');
    }
    
    // Obtener información del usuario actual
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const settings = typeof getSchoolSettings === 'function' ? getSchoolSettings() : {};
    const clubId = localStorage.getItem('clubId') || '';
    
    if (!currentUser) {
      if (typeof showToast === 'function') {
        showToast('❌ Error: No se pudo obtener tu información');
      } else {
        alert('❌ Error: No se pudo obtener tu información');
      }
      return;
    }
    
    // Preparar datos de la sugerencia
    const suggestionData = {
      type: type,
      message: message,
      status: 'pending',
      responseRead: false,
      createdAt: new Date().toISOString(),
      
      // Información del remitente (ADMIN)
      senderName: name || currentUser.name || 'Admin sin nombre',
      senderEmail: currentUser.email || '',
      senderPhone: phone || currentUser.phone || '',
      senderType: 'admin', // Identificar que es un admin
      
      // Información del club
      clubId: clubId,
      clubName: settings.name || 'Club sin nombre',
      
      // Para admins no hay jugador asociado
      playerName: null,
      playerId: null
    };
    
    console.log('📤 Enviando sugerencia desde modal:', suggestionData);
    
    const { db, collection, addDoc } = firebaseInstance;
    const suggestionsRef = collection(db, 'suggestions');
    
    await addDoc(suggestionsRef, suggestionData);
    
    // Limpiar formulario
    document.getElementById('adminSenderName').value = '';
    document.getElementById('adminSuggestionMessage').value = '';
    document.getElementById('adminSenderPhone').value = '';
    document.getElementById('adminSuggestionType').selectedIndex = 0;
    
    // Cambiar a tab de "Mis sugerencias"
    switchTab('mis-sugerencias');
    
    // Recargar lista
    await loadAdminSuggestionsForModal();
    
    // Mostrar éxito
    if (typeof showToast === 'function') {
      showToast('✅ ¡Sugerencia enviada! Te responderemos pronto');
    } else {
      alert('✅ ¡Sugerencia enviada! Te responderemos pronto');
    }
    
    console.log('✅ Sugerencia enviada correctamente');
    
  } catch (error) {
    console.error('❌ Error al enviar sugerencia:', error);
    if (typeof showToast === 'function') {
      showToast('❌ Error al enviar: ' + error.message);
    } else {
      alert('❌ Error al enviar: ' + error.message);
    }
  }
}

// ========================================
// MARCAR COMO LEÍDA DESDE EL MODAL
// ========================================

async function markAsReadFromModal(suggestionId) {
  try {
    const firebaseInstance = window.firebase || window.firebaseAdmin;
    if (!firebaseInstance?.db) {
      throw new Error('Firebase no está inicializado');
    }

    const { db, doc, updateDoc } = firebaseInstance;
    const suggestionRef = doc(db, 'suggestions', suggestionId);
    
    await updateDoc(suggestionRef, {
      responseRead: true,
      readAt: new Date().toISOString()
    });

    console.log('✅ Sugerencia marcada como leída');
    
    if (typeof showToast === 'function') {
      showToast('✓ Marcada como leída');
    }

    // Recargar sugerencias
    await loadAdminSuggestionsForModal();
    
  } catch (error) {
    console.error('❌ Error al marcar como leída:', error);
    if (typeof showToast === 'function') {
      showToast('❌ Error al actualizar');
    }
  }
}

// ========================================
// ACTUALIZAR BADGE DE NO LEÍDAS
// ========================================

function updateUnreadBadge() {
  const unreadCount = adminSuggestions.filter(s => 
    s.response && !s.responseRead
  ).length;

  const badge = document.getElementById('unreadBadgeTab');
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

// ========================================
// VERIFICACIÓN PERIÓDICA DE NUEVAS RESPUESTAS
// ========================================

function startSuggestionCheck() {
  // Limpiar interval anterior si existe
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  // Verificar cada 30 segundos
  checkInterval = setInterval(async () => {
    const previousCount = adminSuggestions.length;
    const previousUnread = adminSuggestions.filter(s => s.response && !s.responseRead).length;
    
    await loadAdminSuggestionsForModal();
    
    const currentUnread = adminSuggestions.filter(s => s.response && !s.responseRead).length;
    
    // Si hay nuevas respuestas no leídas
    if (currentUnread > previousUnread) {
      if (typeof showToast === 'function') {
        showToast(`💬 Tienes ${currentUnread} respuesta(s) nueva(s) del equipo de MY CLUB`);
      }
    }
  }, 30000);
}

// ========================================
// FORMATEAR FECHA DE RESPUESTA
// ========================================

function formatResponseDate(responseAt) {
  let date;
  
  if (responseAt?.toDate) {
    date = responseAt.toDate();
  } else if (responseAt?.seconds) {
    date = new Date(responseAt.seconds * 1000);
  } else if (typeof responseAt === 'string') {
    date = new Date(responseAt);
  } else {
    return 'Fecha desconocida';
  }

  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  if (hours < 24) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
  if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`;
  
  return date.toLocaleDateString('es-CO', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
}

// ========================================
// LIMPIAR AL CERRAR
// ========================================

window.addEventListener('beforeunload', () => {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
});

console.log('✅ Sistema de chat de sugerencias estilo portal padres cargado correctamente');