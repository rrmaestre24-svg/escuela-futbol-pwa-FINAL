// ========================================
// 💡 SISTEMA DE SUGERENCIAS - SUPER ADMIN
// VERSIÓN MEJORADA
// ========================================

console.log('💡 Cargando sistema de sugerencias...');

let allSuggestions = [];
let suggestionFilter = 'all';
let currentSuggestionId = null;

// ========================================
// CARGAR SUGERENCIAS
// ========================================
async function loadSuggestions() {
  try {
    const { db, collection, getDocs, orderBy, query } = window.firebaseAdmin;
    const q = query(collection(db, 'suggestions'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    allSuggestions = [];
    snapshot.forEach(doc => allSuggestions.push({ id: doc.id, ...doc.data() }));
    
    console.log('✅ Sugerencias cargadas:', allSuggestions.length);
    updateSuggestionBadge();
    updateSuggestionStats();
    renderSuggestions();
    
  } catch (error) {
    console.error('Error al cargar sugerencias:', error);
    const container = document.getElementById('suggestionsList');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-16 text-red-400">
          <div class="text-6xl mb-4">❌</div>
          <p class="text-lg font-medium">Error al cargar sugerencias</p>
          <p class="text-sm text-gray-500 mt-2">${error.message}</p>
          <button onclick="loadSuggestions()" class="mt-6 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-xl transition-colors">
            Reintentar
          </button>
        </div>
      `;
    }
  }
}

// ========================================
// BADGE Y ESTADÍSTICAS
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

function updateSuggestionStats() {
  const total = allSuggestions.length;
  const pending = allSuggestions.filter(s => s.status === 'pending').length;
  const responded = allSuggestions.filter(s => s.status === 'responded').length;
  const fromParents = allSuggestions.filter(s => s.senderType === 'parent').length;
  
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('statTotalSuggestions', total);
  set('statPendingSuggestions', pending);
  set('statRespondedSuggestions', responded);
  set('statParentSuggestions', fromParents);
}

// ========================================
// RENDERIZAR SUGERENCIAS — DISEÑO MEJORADO
// ========================================
function renderSuggestions() {
  const container = document.getElementById('suggestionsList');
  if (!container) return;
  
  let filtered = allSuggestions;
  if (suggestionFilter === 'pending') filtered = allSuggestions.filter(s => s.status === 'pending');
  else if (suggestionFilter === 'responded') filtered = allSuggestions.filter(s => s.status === 'responded');
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 text-gray-500">
        <div class="text-7xl mb-4">📭</div>
        <p class="text-xl font-medium text-gray-400">Sin sugerencias ${suggestionFilter === 'pending' ? 'pendientes' : suggestionFilter === 'responded' ? 'respondidas' : ''}</p>
        <p class="text-sm text-gray-600 mt-2">Cuando lleguen nuevos mensajes aparecerán aquí</p>
      </div>
    `;
    return;
  }
  
  const typeConfig = {
    'sugerencia':   { icon: '💡', label: 'Sugerencia',   bg: 'from-amber-500/20 to-amber-600/10',  border: 'border-amber-500', badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/50' },
    'pregunta':     { icon: '❓', label: 'Pregunta',     bg: 'from-blue-500/20 to-blue-600/10',    border: 'border-blue-500',  badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/50' },
    'queja':        { icon: '😤', label: 'Queja',        bg: 'from-red-500/20 to-red-600/10',      border: 'border-red-500',   badge: 'bg-red-500/20 text-red-300 border border-red-500/50' },
    'felicitacion': { icon: '🎉', label: 'Felicitación', bg: 'from-green-500/20 to-green-600/10',  border: 'border-green-500', badge: 'bg-green-500/20 text-green-300 border border-green-500/50' },
    'bug':          { icon: '🐛', label: 'Bug',          bg: 'from-purple-500/20 to-purple-600/10',border: 'border-purple-500',badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/50' },
  };

  container.innerHTML = filtered.map(s => {
    const date = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || Date.now());
    const isPending = s.status === 'pending';
    const cfg = typeConfig[s.type] || { icon: '💬', label: s.type || 'Mensaje', bg: 'from-gray-500/20 to-gray-600/10', border: 'border-gray-500', badge: 'bg-gray-500/20 text-gray-300 border border-gray-500/50' };

    return `
      <div class="rounded-2xl overflow-hidden border-l-4 ${cfg.border} bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-200">
        
        <!-- Header de la card -->
        <div class="bg-gradient-to-r ${cfg.bg} px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-2xl flex-shrink-0 border border-gray-600">
              ${cfg.icon}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-bold text-white text-lg">${s.senderName || 'Sin nombre'}</p>
                <span class="text-xs px-2 py-0.5 rounded-full ${cfg.badge}">${cfg.label}</span>
                ${isPending 
                  ? '<span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse">⏳ Pendiente</span>'
                  : '<span class="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/50">✅ Respondida</span>'
                }
              </div>
              <p class="text-sm text-gray-400 mt-0.5">
                ${s.senderType === 'parent' ? '👨‍👩‍👧 Padre/Madre' : '🏫 Administrador'} 
                ${s.playerName ? `• Jugador: <span class="text-gray-300">${s.playerName}</span>` : ''} 
                • <span class="text-gray-300">${s.clubName || 'Club desconocido'}</span>
              </p>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="text-xs text-gray-400">${date.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}</p>
            <p class="text-xs text-gray-500">${date.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })} a. m.</p>
          </div>
        </div>

        <!-- Cuerpo del mensaje -->
        <div class="px-5 py-4">
          <p class="text-gray-200 leading-relaxed text-base">${s.message}</p>
          
          <!-- Contacto -->
          <div class="flex flex-wrap gap-2 mt-4">
            ${s.senderPhone ? `
              <a href="https://wa.me/${s.senderPhone.replace(/[^0-9+]/g, '')}" target="_blank"
                 class="inline-flex items-center gap-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 text-xs px-3 py-1.5 rounded-full border border-green-600/30 transition-colors">
                📱 ${s.senderPhone}
              </a>
            ` : ''}
            ${s.senderEmail ? `
              <span class="inline-flex items-center gap-1.5 bg-blue-600/20 text-blue-400 text-xs px-3 py-1.5 rounded-full border border-blue-600/30">
                📧 ${s.senderEmail}
              </span>
            ` : ''}
          </div>

          <!-- Respuesta existente -->
          ${s.response ? `
            <div class="mt-4 rounded-xl overflow-hidden border border-green-700/40">
              <div class="bg-green-900/30 px-4 py-2 flex items-center gap-2">
                <span class="text-green-400 text-sm font-medium">✅ Tu respuesta</span>
                <span class="text-xs text-gray-500 ml-auto">${s.responseAt ? formatResponseDate(s.responseAt) : ''}</span>
                <span class="text-xs ${s.responseRead ? 'text-green-400' : 'text-amber-400'}">
                  ${s.responseRead ? '👁️ Leída' : '⏳ Aún no leída'}
                </span>
              </div>
              <div class="bg-green-900/10 px-4 py-3">
                <p class="text-gray-200 text-sm leading-relaxed">${s.response}</p>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Acciones -->
        <div class="px-5 pb-4 flex flex-wrap gap-2">
          ${isPending ? `
            <button onclick="openResponseModal('${s.id}')"
                    class="flex-1 min-w-[120px] bg-teal-600 hover:bg-teal-700 text-white py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium text-sm">
              <i data-lucide="message-circle" class="w-4 h-4"></i>
              Responder
            </button>
          ` : `
            <button onclick="openResponseModal('${s.id}')"
                    class="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium text-sm">
              <i data-lucide="edit" class="w-4 h-4"></i>
              Editar Respuesta
            </button>
          `}
          ${s.senderPhone ? `
            <a href="https://wa.me/${s.senderPhone.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent('Hola ' + (s.senderName || '') + ', respondo a tu mensaje sobre: ' + s.message.substring(0, 50) + '...')}"
               target="_blank"
               class="bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm">
              <i data-lucide="phone" class="w-4 h-4"></i>
              WhatsApp
            </a>
          ` : ''}
          <button onclick="deleteSuggestion('${s.id}')"
                  class="bg-red-700/80 hover:bg-red-700 text-white py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function formatResponseDate(dateValue) {
  try {
    const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
    return date.toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  } catch { return ''; }
}

// ========================================
// FILTRAR
// ========================================
function filterSuggestions(filter) {
  suggestionFilter = filter;
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
  
  const typeConfig = {
    'sugerencia': '💡', 'pregunta': '❓', 'queja': '😤', 'felicitacion': '🎉', 'bug': '🐛'
  };
  
  const senderInfo = document.getElementById('responseSenderInfo');
  if (senderInfo) {
    senderInfo.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-3xl">${typeConfig[suggestion.type] || '💬'}</span>
        <div>
          <p class="font-bold text-white">${suggestion.senderName || 'Sin nombre'}</p>
          <p class="text-sm text-gray-400">
            ${suggestion.senderType === 'parent' ? '👨‍👩‍👧 Padre' : '🏫 Admin'} • ${suggestion.clubName || 'Sin club'}
            ${suggestion.playerName ? ' • Jugador: ' + suggestion.playerName : ''}
          </p>
        </div>
      </div>
    `;
  }
  
  const originalMessage = document.getElementById('responseOriginalMessage');
  if (originalMessage) originalMessage.textContent = suggestion.message;
  
  const responseText = document.getElementById('responseText');
  if (responseText) responseText.value = suggestion.response || '';
  
  document.getElementById('responseModal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeResponseModal() {
  document.getElementById('responseModal').classList.add('hidden');
  currentSuggestionId = null;
}

async function submitResponse() {
  if (!currentSuggestionId) return;
  const responseText = document.getElementById('responseText').value.trim();
  if (!responseText) { showToast('❌ Por favor escribe una respuesta'); return; }
  
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
  if (!confirm('¿Eliminar esta sugerencia?\n\nEsta acción no se puede deshacer.')) return;
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
// showTab EXTENDIDO CON SUGERENCIAS
// ========================================
const originalShowTab = window.showTab;
window.showTab = function(tab) {
  const sections = ['schoolsSection','codesSection','alertsSection','billingSection','suggestionsSection'];
  const tabs = ['tabSchools','tabCodes','tabAlerts','tabBilling','tabSuggestions'];
  
  sections.forEach(id => document.getElementById(id)?.classList.add('hidden'));
  tabs.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('bg-teal-600','text-white'); el.classList.add('bg-gray-700','text-gray-300'); }
  });
  
  const sectionMap = { schools:'schoolsSection', codes:'codesSection', alerts:'alertsSection', billing:'billingSection', suggestions:'suggestionsSection' };
  const tabMap = { schools:'tabSchools', codes:'tabCodes', alerts:'tabAlerts', billing:'tabBilling', suggestions:'tabSuggestions' };
  
  document.getElementById(sectionMap[tab])?.classList.remove('hidden');
  const activeTab = document.getElementById(tabMap[tab]);
  if (activeTab) { activeTab.classList.add('bg-teal-600','text-white'); activeTab.classList.remove('bg-gray-700','text-gray-300'); }
  
  if (tab === 'suggestions') loadSuggestions();
};

// Auto-cargar al inicio
setTimeout(() => { if (window.firebaseAdmin?.db) loadSuggestions(); }, 2000);

console.log('✅ Sistema de sugerencias cargado correctamente');

// ========================================
// FUNCIONES PARA ENVÍO DESDE ADMINS
// ========================================
console.log('💡 Cargando funciones de envío para admins...');

function openAdminSuggestionModal() {
  let modal = document.getElementById('adminSuggestionModal');
  if (!modal) { modal = createAdminSuggestionModal(); document.body.appendChild(modal); }
  const typeSelect = document.getElementById('adminSuggestionType');
  const messageTextarea = document.getElementById('adminSuggestionMessage');
  if (typeSelect) typeSelect.value = 'sugerencia';
  if (messageTextarea) messageTextarea.value = '';
  modal.classList.remove('hidden');
  setTimeout(() => { if (messageTextarea) messageTextarea.focus(); }, 100);
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function closeAdminSuggestionModal() {
  document.getElementById('adminSuggestionModal')?.classList.add('hidden');
}

function createAdminSuggestionModal() {
  const modal = document.createElement('div');
  modal.id = 'adminSuggestionModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 hidden';
  modal.innerHTML = `
    <div class="bg-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-fade-in">
      <div class="bg-gradient-to-r from-amber-500 to-orange-500 p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-4xl">💡</span>
            <div>
              <h2 class="text-2xl font-bold text-white">Enviar Sugerencia</h2>
              <p class="text-amber-100 text-sm">Ayúdanos a mejorar MY CLUB</p>
            </div>
          </div>
          <button onclick="closeAdminSuggestionModal()" class="text-white hover:bg-white/20 rounded-lg p-2 transition-colors">
            <i data-lucide="x" class="w-6 h-6"></i>
          </button>
        </div>
      </div>
      <div class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Tipo de mensaje *</label>
          <select id="adminSuggestionType" class="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:outline-none">
            <option value="sugerencia">💡 Sugerencia</option>
            <option value="pregunta">❓ Pregunta</option>
            <option value="queja">😤 Queja</option>
            <option value="felicitacion">🎉 Felicitación</option>
            <option value="bug">🐛 Bug</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Tu mensaje *</label>
          <textarea id="adminSuggestionMessage" rows="6" placeholder="Cuéntanos..." class="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"></textarea>
        </div>
      </div>
      <div class="p-6 pt-0 flex gap-3">
        <button onclick="closeAdminSuggestionModal()" class="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium">Cancelar</button>
        <button onclick="submitAdminSuggestion()" class="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-medium">Enviar</button>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) closeAdminSuggestionModal(); });
  return modal;
}

async function submitAdminSuggestion() {
  const type = document.getElementById('adminSuggestionType')?.value;
  const message = document.getElementById('adminSuggestionMessage')?.value?.trim();
  if (!message || message.length < 10) { showToast('❌ El mensaje debe tener al menos 10 caracteres'); return; }
  const firebaseInstance = window.firebase || window.firebaseAdmin;
  if (!firebaseInstance?.db) { showToast('❌ Error: base de datos no disponible'); return; }
  try {
    showToast('⏳ Enviando sugerencia...');
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const settings = typeof getSchoolSettings === 'function' ? getSchoolSettings() : {};
    const { db, collection, addDoc } = firebaseInstance;
    await addDoc(collection(db, 'suggestions'), {
      type, message, status: 'pending', responseRead: false,
      createdAt: new Date().toISOString(),
      senderName: currentUser?.name || 'Admin',
      senderEmail: currentUser?.email || '',
      senderPhone: currentUser?.phone || '',
      senderType: 'admin',
      clubId: localStorage.getItem('clubId') || '',
      clubName: settings?.name || 'Club sin nombre',
      playerName: null, playerId: null
    });
    closeAdminSuggestionModal();
    showToast('✅ ¡Sugerencia enviada!');
  } catch (error) {
    console.error('Error al enviar sugerencia:', error);
    showToast('❌ Error al enviar: ' + error.message);
  }
}

async function submitMainSuggestionForm() {
  const name    = (document.getElementById('suggestionName')?.value || '').trim();
  const type    = (document.getElementById('suggestionType')?.value || '').trim();
  const message = (document.getElementById('suggestionMessage')?.value || '').trim();
  const phone   = (document.getElementById('suggestionPhone')?.value || '').trim();
  if (!name) { showToast('❌ Por favor escribe tu nombre'); return; }
  if (!type) { showToast('❌ Selecciona el tipo'); return; }
  if (!message || message.length < 10) { showToast('❌ Mensaje muy corto'); return; }
  const firebaseInstance = window.firebase || window.firebaseAdmin;
  if (!firebaseInstance?.db) { showToast('❌ Error: base de datos no disponible'); return; }
  const btn = document.querySelector('#suggestionForm button[type="button"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Enviando...'; }
  try {
    showToast('⏳ Enviando...');
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const settings = typeof getSchoolSettings === 'function' ? getSchoolSettings() : {};
    const { db, collection, addDoc } = firebaseInstance;
    await addDoc(collection(db, 'suggestions'), {
      type, message, status: 'pending', responseRead: false,
      createdAt: new Date().toISOString(),
      senderName: name, senderPhone: phone || null,
      senderEmail: currentUser?.email || null, senderType: 'admin',
      clubId: localStorage.getItem('clubId') || '',
      clubName: settings?.name || 'Club sin nombre',
      playerName: null, playerId: null
    });
    document.getElementById('suggestionForm')?.reset();
    document.getElementById('adminSuggestionModal')?.classList.add('hidden');
    showToast('✅ ¡Sugerencia enviada!');
  } catch (error) {
    console.error('Error:', error);
    showToast('❌ Error: ' + error.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = 'Enviar al Desarrollador'; }
  }
}

console.log('✅ Funciones de envío de sugerencias para admins cargadas correctamente');