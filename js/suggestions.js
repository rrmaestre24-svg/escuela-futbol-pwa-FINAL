// ========================================
// SISTEMA DE SUGERENCIAS DEL ADMIN
// ========================================

function openAdminSuggestionModal() {
    document.getElementById('adminSuggestionModal').classList.remove('hidden');
    switchSuggestionTab('new');
    lucide.createIcons();
}

function closeAdminSuggestionModal() {
    document.getElementById('adminSuggestionModal').classList.add('hidden');
}

function switchSuggestionTab(tab) {
    const newTab = document.getElementById('newSuggestionTab');
    const myTab = document.getElementById('mySuggestionsTab');
    const tabNew = document.getElementById('tabNew');
    const tabMy = document.getElementById('tabMy');

    if (tab === 'new') {
        newTab.classList.remove('hidden');
        myTab.classList.add('hidden');
        tabNew.classList.add('border-orange-500', 'text-orange-600');
        tabMy.classList.remove('border-orange-500', 'text-orange-600');
    } else {
        myTab.classList.remove('hidden');
        newTab.classList.add('hidden');
        tabMy.classList.add('border-orange-500', 'text-orange-600');
        tabNew.classList.remove('border-orange-500', 'text-orange-600');
        // Cargar sugerencias al abrir el tab
        loadMySuggestions();
    }
}

async function loadMySuggestions() {
    const listEl = document.getElementById('suggestionsList');
    const emptyEl = document.getElementById('emptySuggestions');
    if (!listEl || !emptyEl) return;

    listEl.innerHTML = '<div class="text-center py-8 text-gray-500">⏳ Cargando...</div>';
    listEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');

    try {
        const clubId = localStorage.getItem('clubId') || '';
        if (!window.firebase?.db || !clubId) {
            listEl.innerHTML = '<p class="text-center text-gray-500 py-8">No se pudo cargar</p>';
            return;
        }

        const { db, collection, getDocs, query, where, doc, updateDoc, deleteDoc } = window.firebase;
        const q = query(
            collection(db, 'suggestions'),
            where('clubId', '==', clubId)
        );
        const snapshot = await getDocs(q);

        const docs = [];
        snapshot.forEach(docSnap => docs.push({ id: docSnap.id, ...docSnap.data() }));
        docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (docs.length === 0) {
            listEl.classList.add('hidden');
            emptyEl.classList.remove('hidden');
            return;
        }

        const typeLabels = {
            'suggestion': '💡 Sugerencia', 'bug': '🐛 Error',
            'question': '❓ Pregunta', 'feature': '✨ Nueva función',
            'other': '💬 Otro', 'sugerencia': '💡 Sugerencia',
            'pregunta': '❓ Pregunta', 'queja': '😤 Queja',
            'felicitacion': '🎉 Felicitación'
        };

        listEl.innerHTML = '';
        docs.forEach(s => {
            const date = new Date(s.createdAt);
            const hasResponse = s.response && s.response.trim() !== '';
            const isUnread = hasResponse && !s.responseRead;

            if (isUnread) {
                updateDoc(doc(db, 'suggestions', s.id), { responseRead: true }).catch(() => { });
            }

            const safeMessage = s.message.substring(0, 60).replace(/'/g, '').replace(/`/g, '').replace(/"/g, '');

            listEl.innerHTML += `
  <div class="rounded-xl overflow-hidden border ${hasResponse ? 'border-green-500' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-700 shadow-sm">
    <div class="p-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
          ${typeLabels[s.type] || s.type || 'Mensaje'}
        </span>
        <div class="flex items-center gap-2">
          ${isUnread ? '<span class="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">🔔 Nueva respuesta</span>' : ''}
          <span class="text-xs text-gray-400">${date.toLocaleDateString('es-CO')}</span>
          <button onclick="deleteClubSuggestion('${s.id}')"
                  class="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded transition-colors"
                  title="Eliminar sugerencia">
            🗑️
          </button>
        </div>
      </div>
      <p class="text-gray-800 dark:text-white text-sm">${s.message}</p>
    </div>
    ${hasResponse ? `
      <div class="border-t border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
        <p class="text-xs font-bold text-green-700 dark:text-green-400 mb-1">✅ Respuesta del desarrollador:</p>
        <p class="text-sm text-gray-800 dark:text-white">${s.response}</p>
        <p class="text-xs text-gray-400 mt-2">${s.responseAt ? new Date(s.responseAt).toLocaleString('es-CO') : ''}</p>
        <button onclick="replyToSuggestion('${safeMessage}')"
                class="mt-3 w-full text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1">
          💬 Continuar conversación
        </button>
      </div>
    ` : `
      <div class="border-t border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-2">
        <p class="text-xs text-amber-600 dark:text-amber-400">⏳ Pendiente de respuesta</p>
      </div>
    `}
  </div>
`;
        });

        listEl.classList.remove('hidden');
        emptyEl.classList.add('hidden');

    } catch (error) {
        console.error('Error cargando sugerencias:', error);
        listEl.innerHTML = '<p class="text-center text-red-400 py-8">❌ Error al cargar</p>';
    }
}

function replyToSuggestion(originalMessage) {
    switchSuggestionTab('new');
    setTimeout(() => {
        const msgField = document.getElementById('suggestionMessage');
        if (msgField) {
            msgField.value = '[Continuando: "' + originalMessage + '"]\n\n';
            msgField.focus();
            msgField.setSelectionRange(msgField.value.length, msgField.value.length);
        }
    }, 150);
}

async function deleteClubSuggestion(suggestionId) {
    if (!confirm('¿Eliminar esta sugerencia? Esta acción no se puede deshacer.')) return;

    try {
        showToast('⏳ Eliminando...');
        const { db, doc, deleteDoc } = window.firebase;
        await deleteDoc(doc(db, 'suggestions', suggestionId));
        showToast('✅ Sugerencia eliminada');
        loadMySuggestions();
    } catch (error) {
        console.error('Error al eliminar:', error);
        showToast('❌ Error al eliminar');
    }
}

async function submitMainSuggestionForm() {
    const name = document.getElementById('suggestionName').value.trim();
    const type = document.getElementById('suggestionType').value;
    const message = document.getElementById('suggestionMessage').value.trim();
    const phone = document.getElementById('suggestionPhone').value.trim();

    if (!name || !type || !message) {
        showToast('❌ Completa todos los campos requeridos');
        return;
    }

    if (message.length < 10) {
        showToast('❌ El mensaje debe tener al menos 10 caracteres');
        return;
    }

    const btn = document.querySelector('#suggestionForm button[type="button"][onclick]') ||
        document.querySelector('#suggestionForm button[onclick="submitMainSuggestionForm()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Enviando...'; }

    try {
        const settings = typeof getSchoolSettings === 'function' ? getSchoolSettings() : {};

        const suggestionData = {
            senderName: name,
            senderPhone: phone || null,
            senderType: 'admin',
            clubId: localStorage.getItem('clubId') || '',
            clubName: settings?.name || '',
            playerId: null,
            playerName: null,
            type: type,
            message: message,
            status: 'pending',
            response: null,
            responseAt: null,
            responseRead: false,
            createdAt: new Date().toISOString()
        };

        if (window.firebase?.db) {
            const { collection, addDoc } = window.firebase;
            await addDoc(collection(window.firebase.db, 'suggestions'), suggestionData);
        }

        showToast('✅ Sugerencia enviada');
        document.getElementById('suggestionForm').reset();

        // Ir a mis sugerencias para ver la enviada
        switchSuggestionTab('my');

    } catch (error) {
        console.error('Error al enviar sugerencia:', error);
        showToast('❌ Error al enviar. Intenta de nuevo.');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="send" class="w-5 h-5"></i> Enviar al Desarrollador'; }
    }
}

console.log('✅ suggestions.js cargado');
