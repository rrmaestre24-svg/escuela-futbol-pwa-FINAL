// ========================================
// 💡 SISTEMA DE SUGERENCIAS - SUPER ADMIN
// ========================================
// 📍 Este archivo debe estar en: js/super-admin-sugerencias.js
// 📍 Ya está incluido en tu index.html (línea 836)
// ========================================

console.log('💡 Cargando sistema de sugerencias...');

// Variables globales
let allSuggestions = [];
let suggestionFilter = 'all';
let currentSuggestionId = null;

// ========================================
// CARGAR SUGERENCIAS
// ========================================

async function loadSuggestions() {
  try {
    const { db, collection, getDocs, orderBy, query } = window.firebaseAdmin;
    
    const suggestionsRef = collection(db, 'suggestions');
    const q = query(suggestionsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    allSuggestions = [];
    snapshot.forEach(doc => {
      allSuggestions.push({ id: doc.id, ...doc.data() });
    });
    
    console.log('✅ Sugerencias cargadas:', allSuggestions.length);
    
    updateSuggestionBadge();
    updateSuggestionStats();
    renderSuggestions();
    
  } catch (error) {
    console.error('Error al cargar sugerencias:', error);
    
    const container = document.getElementById('suggestionsList');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-12 text-red-400">
          <span class="text-4xl">❌</span>
          <p class="mt-4">Error al cargar sugerencias</p>
          <p class="text-sm text-gray-500 mt-2">${error.message}</p>
          <button onclick="loadSuggestions()" class="mt-4 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg">
            Reintentar
          </button>
        </div>
      `;
    }
  }
}

// ========================================
// ACTUALIZAR BADGE DE NOTIFICACIÓN
// ========================================

function updateSuggestionBadge() {
  const pendingCount = allSuggestions.filter(s => s.status === 'pending').length;
  const badge = document.getElementById('suggestionBadge');
  
  if (badge) {
    if (pendingCount > 0) {
      badge.textContent = pendingCount > 99 ? '99+' : pendingCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

// ========================================
// ACTUALIZAR ESTADÍSTICAS
// ========================================

function updateSuggestionStats() {
  const total = allSuggestions.length;
  const pending = allSuggestions.filter(s => s.status === 'pending').length;
  const responded = allSuggestions.filter(s => s.status === 'responded').length;
  const fromParents = allSuggestions.filter(s => s.senderType === 'parent').length;
  
  const statTotal = document.getElementById('statTotalSuggestions');
  const statPending = document.getElementById('statPendingSuggestions');
  const statResponded = document.getElementById('statRespondedSuggestions');
  const statParents = document.getElementById('statParentSuggestions');
  
  if (statTotal) statTotal.textContent = total;
  if (statPending) statPending.textContent = pending;
  if (statResponded) statResponded.textContent = responded;
  if (statParents) statParents.textContent = fromParents;
}

// ========================================
// RENDERIZAR LISTA DE SUGERENCIAS
// ========================================

function renderSuggestions() {
  const container = document.getElementById('suggestionsList');
  if (!container) return;
  
  let filtered = allSuggestions;
  
  if (suggestionFilter === 'pending') {
    filtered = allSuggestions.filter(s => s.status === 'pending');
  } else if (suggestionFilter === 'responded') {
    filtered = allSuggestions.filter(s => s.status === 'responded');
  }
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <span class="text-6xl">📭</span>
        <p class="mt-4 text-lg">No hay sugerencias ${suggestionFilter === 'pending' ? 'pendientes' : suggestionFilter === 'responded' ? 'respondidas' : ''}</p>
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
  
  const typeColors = {
    'sugerencia': 'bg-amber-500/20 text-amber-300 border-amber-500',
    'pregunta': 'bg-blue-500/20 text-blue-300 border-blue-500',
    'queja': 'bg-red-500/20 text-red-300 border-red-500',
    'felicitacion': 'bg-green-500/20 text-green-300 border-green-500',
    'bug': 'bg-purple-500/20 text-purple-300 border-purple-500'
  };
  
  container.innerHTML = filtered.map(s => {
    const date = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || Date.now());
    const isPending = s.status === 'pending';
    
    return `
      <div class="bg-gray-700 rounded-xl overflow-hidden ${isPending ? 'border-l-4 border-amber-500' : 'border-l-4 border-green-500'}">
        <!-- Header -->
        <div class="p-4 bg-gray-750 flex flex-col md:flex-row md:items-center justify-between gap-3" style="background: rgba(55, 65, 81, 0.5);">
          <div class="flex items-center gap-3">
            <span class="text-3xl">${typeIcons[s.type] || '💬'}</span>
            <div>
              <p class="font-bold text-white">${s.senderName || 'Sin nombre'}</p>
              <p class="text-xs text-gray-400">
                ${s.senderType === 'parent' ? '👨‍👩‍👧 Padre' : '🏫 Admin'} 
                ${s.playerName ? ' de ' + s.playerName : ''} 
                • ${s.clubName || 'Sin club'}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-block px-3 py-1 text-xs rounded-full border ${typeColors[s.type] || 'bg-gray-600 text-gray-300 border-gray-500'}">
              ${s.type || 'Mensaje'}
            </span>
            <span class="text-xs text-gray-400">
              ${date.toLocaleDateString('es-CO')} ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        
        <!-- Contenido -->
        <div class="p-4">
          <p class="text-gray-200 mb-4">${s.message}</p>
          
          <!-- Info adicional -->
          <div class="flex flex-wrap gap-2 text-xs mb-4">
            ${s.senderPhone ? `
              <a href="https://wa.me/${s.senderPhone.replace(/[^0-9+]/g, '')}" target="_blank" 
                 class="bg-green-600/20 text-green-400 px-3 py-1 rounded-full hover:bg-green-600/40 transition-colors flex items-center gap-1">
                📱 ${s.senderPhone}
              </a>
            ` : ''}
            ${s.senderEmail ? `
              <span class="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full">
                📧 ${s.senderEmail}
              </span>
            ` : ''}
          </div>
          
          ${s.response ? `
            <!-- Respuesta existente -->
            <div class="mt-4 p-4 bg-green-900/30 rounded-xl border-l-4 border-green-500">
              <p class="text-xs text-green-400 font-medium mb-2">✅ Tu respuesta:</p>
              <p class="text-gray-200">${s.response}</p>
              <div class="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span>${s.responseAt ? formatResponseDate(s.responseAt) : ''}</span>
                <span>${s.responseRead ? '👁️ Leída por el usuario' : '⏳ Aún no leída'}</span>
              </div>
            </div>
          ` : ''}
        </div>
        
        <!-- Acciones -->
        <div class="p-4 bg-gray-800 flex flex-wrap gap-2">
          ${isPending ? `
            <button onclick="openResponseModal('${s.id}')" 
                    class="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
              <i data-lucide="message-circle" class="w-4 h-4"></i>
              Responder
            </button>
          ` : `
            <button onclick="openResponseModal('${s.id}')" 
                    class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
              <i data-lucide="edit" class="w-4 h-4"></i>
              Editar Respuesta
            </button>
          `}
          ${s.senderPhone ? `
            <a href="https://wa.me/${s.senderPhone.replace(/[^0-9+]/g, '')}?text=Hola ${s.senderName}, respondo a tu mensaje sobre: ${encodeURIComponent(s.message.substring(0, 50))}..." 
               target="_blank"
               class="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
              <i data-lucide="phone" class="w-4 h-4"></i>
              WhatsApp
            </a>
          ` : ''}
          <button onclick="deleteSuggestion('${s.id}')" 
                  class="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // Refrescar iconos de Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function formatResponseDate(dateValue) {
  try {
    const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

// ========================================
// FILTRAR SUGERENCIAS
// ========================================

function filterSuggestions(filter) {
  suggestionFilter = filter;
  
  // Actualizar botones de filtro
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.classList.remove('bg-teal-600', 'text-white');
    btn.classList.add('bg-gray-700', 'text-gray-300');
  });
  
  const activeBtn = document.querySelector(`[data-filter="${filter}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-gray-700', 'text-gray-300');
    activeBtn.classList.add('bg-teal-600', 'text-white');
  }
  
  renderSuggestions();
}

// ========================================
// MODAL DE RESPUESTA
// ========================================

function openResponseModal(suggestionId) {
  const suggestion = allSuggestions.find(s => s.id === suggestionId);
  if (!suggestion) return;
  
  currentSuggestionId = suggestionId;
  
  // Llenar info del remitente
  const senderInfo = document.getElementById('responseSenderInfo');
  if (senderInfo) {
    const typeIcons = {
      'sugerencia': '💡',
      'pregunta': '❓',
      'queja': '😤',
      'felicitacion': '🎉',
      'bug': '🐛'
    };
    
    senderInfo.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-3xl">${typeIcons[suggestion.type] || '💬'}</span>
        <div>
          <p class="font-bold text-white">${suggestion.senderName || 'Sin nombre'}</p>
          <p class="text-sm text-gray-400">
            ${suggestion.senderType === 'parent' ? '👨‍👩‍👧 Padre' : '🏫 Admin'} 
            • ${suggestion.clubName || 'Sin club'}
            ${suggestion.playerName ? ' • Jugador: ' + suggestion.playerName : ''}
          </p>
        </div>
      </div>
    `;
  }
  
  // Llenar mensaje original
  const originalMessage = document.getElementById('responseOriginalMessage');
  if (originalMessage) {
    originalMessage.textContent = suggestion.message;
  }
  
  // Llenar respuesta existente (si hay)
  const responseText = document.getElementById('responseText');
  if (responseText) {
    responseText.value = suggestion.response || '';
  }
  
  // Mostrar modal
  document.getElementById('responseModal').classList.remove('hidden');
  
  // Refrescar iconos
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function closeResponseModal() {
  document.getElementById('responseModal').classList.add('hidden');
  currentSuggestionId = null;
}

async function submitResponse() {
  if (!currentSuggestionId) return;
  
  const responseText = document.getElementById('responseText').value.trim();
  
  if (!responseText) {
    showToast('❌ Por favor escribe una respuesta');
    return;
  }
  
  try {
    showToast('⏳ Enviando respuesta...');
    
    const { db, doc, updateDoc } = window.firebaseAdmin;
    
    await updateDoc(doc(db, 'suggestions', currentSuggestionId), {
      response: responseText,
      responseAt: new Date().toISOString(),
      responseRead: false,
      status: 'responded',
      respondedBy: currentAdminData?.email || 'Super Admin'
    });
    
    closeResponseModal();
    await loadSuggestions();
    
    showToast('✅ Respuesta enviada correctamente');
    
  } catch (error) {
    console.error('Error al enviar respuesta:', error);
    showToast('❌ Error al enviar respuesta');
  }
}

// ========================================
// ELIMINAR SUGERENCIA
// ========================================

async function deleteSuggestion(suggestionId) {
  if (!confirm('¿Estás seguro de eliminar esta sugerencia? Esta acción no se puede deshacer.')) {
    return;
  }
  
  try {
    showToast('⏳ Eliminando...');
    
    const { db, doc, deleteDoc } = window.firebaseAdmin;
    
    await deleteDoc(doc(db, 'suggestions', suggestionId));
    await loadSuggestions();
    
    showToast('✅ Sugerencia eliminada');
    
  } catch (error) {
    console.error('Error al eliminar:', error);
    showToast('❌ Error al eliminar');
  }
}

// ========================================
// MODIFICAR LA FUNCIÓN showTab EXISTENTE
// ========================================

// Guardar la función original
const originalShowTab = window.showTab;

// Sobrescribir con la nueva que incluye sugerencias
window.showTab = function(tab) {
  // Ocultar todas las secciones
  document.getElementById('schoolsSection')?.classList.add('hidden');
  document.getElementById('codesSection')?.classList.add('hidden');
  document.getElementById('alertsSection')?.classList.add('hidden');
  document.getElementById('billingSection')?.classList.add('hidden');
  document.getElementById('suggestionsSection')?.classList.add('hidden');
  
  // Resetear todos los tabs
  document.getElementById('tabSchools')?.classList.remove('bg-teal-600', 'text-white');
  document.getElementById('tabSchools')?.classList.add('bg-gray-700', 'text-gray-300');
  document.getElementById('tabCodes')?.classList.remove('bg-teal-600', 'text-white');
  document.getElementById('tabCodes')?.classList.add('bg-gray-700', 'text-gray-300');
  document.getElementById('tabAlerts')?.classList.remove('bg-teal-600', 'text-white');
  document.getElementById('tabAlerts')?.classList.add('bg-gray-700', 'text-gray-300');
  document.getElementById('tabBilling')?.classList.remove('bg-teal-600', 'text-white');
  document.getElementById('tabBilling')?.classList.add('bg-gray-700', 'text-gray-300');
  document.getElementById('tabSuggestions')?.classList.remove('bg-teal-600', 'text-white');
  document.getElementById('tabSuggestions')?.classList.add('bg-gray-700', 'text-gray-300');
  
  // Mostrar la sección seleccionada
  if (tab === 'schools') {
    document.getElementById('schoolsSection')?.classList.remove('hidden');
    document.getElementById('tabSchools')?.classList.add('bg-teal-600', 'text-white');
    document.getElementById('tabSchools')?.classList.remove('bg-gray-700', 'text-gray-300');
  } else if (tab === 'codes') {
    document.getElementById('codesSection')?.classList.remove('hidden');
    document.getElementById('tabCodes')?.classList.add('bg-teal-600', 'text-white');
    document.getElementById('tabCodes')?.classList.remove('bg-gray-700', 'text-gray-300');
  } else if (tab === 'alerts') {
    document.getElementById('alertsSection')?.classList.remove('hidden');
    document.getElementById('tabAlerts')?.classList.add('bg-teal-600', 'text-white');
    document.getElementById('tabAlerts')?.classList.remove('bg-gray-700', 'text-gray-300');
  } else if (tab === 'billing') {
    document.getElementById('billingSection')?.classList.remove('hidden');
    document.getElementById('tabBilling')?.classList.add('bg-teal-600', 'text-white');
    document.getElementById('tabBilling')?.classList.remove('bg-gray-700', 'text-gray-300');
  } else if (tab === 'suggestions') {
    document.getElementById('suggestionsSection')?.classList.remove('hidden');
    document.getElementById('tabSuggestions')?.classList.add('bg-teal-600', 'text-white');
    document.getElementById('tabSuggestions')?.classList.remove('bg-gray-700', 'text-gray-300');
    // Cargar sugerencias al entrar a la pestaña
    loadSuggestions();
  }
};

// ========================================
// CARGAR SUGERENCIAS AL INICIO
// ========================================

// Esperar a que Firebase esté listo y cargar sugerencias
setTimeout(() => {
  if (window.firebaseAdmin?.db) {
    loadSuggestions();
  }
}, 2000);

console.log('✅ Sistema de sugerencias cargado correctamente');

// ========================================
// 💡 FUNCIONES PARA ADMINS - ENVIAR SUGERENCIAS
// ========================================
// Estas funciones permiten a los ADMINS enviar sugerencias al Super Admin
// INSTRUCCIONES: Copia todo este código y pégalo AL FINAL de tu archivo super-admin-sugerencias.js
// ========================================

console.log('💡 Cargando funciones de envío para admins...');

// ========================================
// ABRIR MODAL DE SUGERENCIAS (PARA ADMINS)
// ========================================

function openAdminSuggestionModal() {
  console.log('💡 Abriendo modal de sugerencias para admin...');
  
  // Verificar si el modal ya existe
  let modal = document.getElementById('adminSuggestionModal');
  
  if (!modal) {
    // Crear el modal dinámicamente
    modal = createAdminSuggestionModal();
    document.body.appendChild(modal);
  }
  
  // Limpiar formulario
  const typeSelect = document.getElementById('adminSuggestionType');
  const messageTextarea = document.getElementById('adminSuggestionMessage');
  
  if (typeSelect) typeSelect.value = 'sugerencia';
  if (messageTextarea) messageTextarea.value = '';
  
  // Mostrar modal
  modal.classList.remove('hidden');
  
  // Focus en el textarea después de un pequeño delay
  setTimeout(() => {
    if (messageTextarea) messageTextarea.focus();
  }, 100);
  
  // Recrear iconos de Lucide
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// ========================================
// CERRAR MODAL
// ========================================

function closeAdminSuggestionModal() {
  const modal = document.getElementById('adminSuggestionModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// ========================================
// CREAR MODAL DINÁMICAMENTE
// ========================================

function createAdminSuggestionModal() {
  const modal = document.createElement('div');
  modal.id = 'adminSuggestionModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 hidden';
  
  modal.innerHTML = `
    <div class="bg-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-fade-in-up">
      <!-- Header -->
      <div class="bg-gradient-to-r from-amber-500 to-orange-500 p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-4xl">💡</span>
            <div>
              <h2 class="text-2xl font-bold text-white">Enviar Sugerencia</h2>
              <p class="text-amber-100 text-sm">Ayúdanos a mejorar MY CLUB</p>
            </div>
          </div>
          <button onclick="closeAdminSuggestionModal()" 
                  class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors">
            <i data-lucide="x" class="w-6 h-6"></i>
          </button>
        </div>
      </div>
      
      <!-- Contenido -->
      <div class="p-6 space-y-4">
        <!-- Tipo de sugerencia -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Tipo de mensaje *
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
        
        <!-- Mensaje -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Tu mensaje *
          </label>
          <textarea id="adminSuggestionMessage" 
                    rows="6"
                    placeholder="Cuéntanos tu sugerencia, pregunta, queja o felicitación... Mientras más detalles, mejor podremos ayudarte 😊"
                    class="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors resize-none"></textarea>
          <p class="text-xs text-gray-400 mt-1">
            Mínimo 10 caracteres
          </p>
        </div>
        
        <!-- Info sobre privacidad -->
        <div class="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
          <div class="flex gap-3">
            <i data-lucide="shield-check" class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"></i>
            <div class="text-sm text-blue-200">
              <p class="font-medium mb-1">Tu información es privada</p>
              <p class="text-blue-300/80">
                Enviaremos tu nombre, email y nombre del club junto con tu mensaje para poder responder adecuadamente.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="bg-gray-750 p-6 flex gap-3" style="background: rgba(55, 65, 81, 0.5);">
        <button onclick="closeAdminSuggestionModal()" 
                class="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium">
          Cancelar
        </button>
        <button onclick="submitAdminSuggestion()" 
                class="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg transition-colors font-medium shadow-lg">
          Enviar Sugerencia
        </button>
      </div>
    </div>
  `;
  
  // Cerrar al hacer clic fuera del modal
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeAdminSuggestionModal();
    }
  });
  
  return modal;
}

// ========================================
// ENVIAR SUGERENCIA (DESDE ADMIN)
// ========================================

async function submitAdminSuggestion() {
  const type = document.getElementById('adminSuggestionType')?.value;
  const message = document.getElementById('adminSuggestionMessage')?.value?.trim();
  
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
  
  // Verificar Firebase (usar el mismo que usa el Super Admin)
  if (!window.firebase?.db && !window.firebaseAdmin?.db) {
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
      senderName: currentUser.name || 'Admin sin nombre',
      senderEmail: currentUser.email || '',
      senderPhone: currentUser.phone || '',
      senderType: 'admin', // Identificar que es un admin
      
      // Información del club
      clubId: clubId,
      clubName: settings.name || 'Club sin nombre',
      
      // Para admins no hay jugador asociado
      playerName: null,
      playerId: null
    };
    
    console.log('📤 Enviando sugerencia desde admin:', suggestionData);
    
    // Usar window.firebase si está disponible, sino usar window.firebaseAdmin
    const firebaseInstance = window.firebase || window.firebaseAdmin;
    const { db, collection, addDoc } = firebaseInstance;
    const suggestionsRef = collection(db, 'suggestions');
    
    await addDoc(suggestionsRef, suggestionData);
    
    // Cerrar modal
    closeAdminSuggestionModal();
    
    // Mostrar éxito
    if (typeof showToast === 'function') {
      showToast('✅ ¡Sugerencia enviada! Te responderemos pronto');
    } else {
      alert('✅ ¡Sugerencia enviada! Te responderemos pronto');
    }
    
    console.log('✅ Sugerencia enviada correctamente desde admin');
    
  } catch (error) {
    console.error('❌ Error al enviar sugerencia:', error);
    if (typeof showToast === 'function') {
      showToast('❌ Error al enviar: ' + error.message);
    } else {
      alert('❌ Error al enviar: ' + error.message);
    }
  }
}

console.log('✅ Funciones de envío de sugerencias para admins cargadas correctamente');