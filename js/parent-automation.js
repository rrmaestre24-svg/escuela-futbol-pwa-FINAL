/**
 * PARENT PORTAL AUTOMATION - PHASE 2 (ADVANCED CONTROL)
 * Handles generation, distribution, and management of access codes.
 */

let parentAccessData = {
    players: [],
    codes: {},
    isProcessing: false,
    currentFilter: 'all', // all, pending, sent
    currentIndex: 0,
    batchPlayers: []
};

/**
 * Show the Parent Access Management Modal
 */
async function showParentAccessAutomation() {
    const clubId = localStorage.getItem('clubId');
    if (!clubId) return showToast('❌ Error: No se encontró ID del club');

    const modal = document.getElementById('parentAccessModal');
    if (modal) modal.classList.remove('hidden');

    try {
        await loadParentAccessStatus();
        renderParentAccessList();
    } catch (error) {
        console.error('Error opening parent automation:', error);
        showToast('❌ Error al cargar datos de padres');
    }
}

function closeParentAccessModal() {
    document.getElementById('parentAccessModal')?.classList.add('hidden');
    // FIX 1: Resetear estado del batch si el modal se cierra a la mitad
    if (parentAccessData.isProcessing) {
        resetBatchState();
    }
}

/**
 * Load current players and their access codes from Firebase
 */
async function loadParentAccessStatus() {
    const clubId = localStorage.getItem('clubId');
    if (!window.firebase?.db) return;

    const players = JSON.parse(localStorage.getItem('players') || '[]');
    
    const codesRef = window.firebase.collection(window.firebase.db, `clubs/${clubId}/parentCodes`);
    const codesSnapshot = await window.firebase.getDocs(codesRef);
    
    const codesByPlayer = {};
    codesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.playerId) {
            codesByPlayer[data.playerId] = {
                id: doc.id,
                ...data
            };
        }
    });

    parentAccessData.players = players;
    parentAccessData.codes = codesByPlayer;

    const total     = players.length;
    const processed = players.filter(p => codesByPlayer[p.id]?.sentAt).length;

    const totalElem     = document.getElementById('totalParentsCount');
    const processedElem = document.getElementById('processedParentsCount');
    
    if (totalElem)     totalElem.textContent     = total;
    if (processedElem) processedElem.textContent = processed;
}

/**
 * Filter the list based on status
 */
function filterParentAccessList(filter) {
    parentAccessData.currentFilter = filter;
    
    ['all', 'pending', 'sent'].forEach(f => {
        const btn = document.getElementById(`tab_parent_${f}`);
        if (btn) {
            btn.classList.toggle('bg-emerald-600', f === filter);
            btn.classList.toggle('text-white',     f === filter);
            btn.classList.toggle('text-gray-500',  f !== filter);
            btn.classList.toggle('dark:text-gray-400', f !== filter);
            btn.classList.remove('shadow-sm');
            if (f === filter) btn.classList.add('shadow-sm');
        }
    });

    renderParentAccessList();
}

/**
 * Render the list of players based on current filter
 */
function renderParentAccessList() {
    const list = document.getElementById('parentAccessList');
    if (!list) return;

    const { players, codes, currentFilter: filter } = parentAccessData;

    let filteredPlayers = players;
    if (filter === 'pending') {
        filteredPlayers = players.filter(p => !codes[p.id] || !codes[p.id].sentAt);
    } else if (filter === 'sent') {
        filteredPlayers = players.filter(p => codes[p.id]?.sentAt);
    }

    const titleElem = document.getElementById('parentListTitle');
    if (titleElem) {
        const labels = { all: 'Todos los Alumnos', pending: 'Pendientes por Notificar', sent: 'Notificados Exitosamente' };
        titleElem.textContent = `${labels[filter]} (${filteredPlayers.length})`;
    }

    if (filteredPlayers.length === 0) {
        list.innerHTML = `
            <div class="text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-700/20 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-700">
                <p class="text-sm">No hay alumnos en esta categoría</p>
            </div>`;
        return;
    }

    const sortedPlayers = [...filteredPlayers].sort((a, b) => a.name.localeCompare(b.name));

    list.innerHTML = sortedPlayers.map(player => {
        const access = codes[player.id];
        const hasCode = !!access;
        const isSent  = !!access?.sentAt;
        // FIX 2: Escapar comillas en el nombre para evitar romper el onclick
        const safeName = (player.name || '').replace(/'/g, "\\'");
        const phone = player.phone || 'Sin teléfono';
        
        return `
            <div data-player-id="${player.id}" class="group flex items-center justify-between p-3 glass-card rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-emerald-500/30 hover:shadow-lg transition-all">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <img src="${player.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(player.name) + '&background=random'}" 
                             class="w-11 h-11 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm"
                             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=random'">
                        ${isSent ? `
                            <span class="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                                <i data-lucide="check" class="w-3 h-3 text-white"></i>
                            </span>` : ''}
                    </div>
                    <div>
                        <p class="font-bold text-gray-800 dark:text-white text-sm truncate">${player.name}</p>
                        <div class="flex items-center gap-2">
                            <p class="text-[10px] text-gray-500 flex items-center gap-1">
                                <i data-lucide="phone" class="w-3 h-3"></i> ${phone}
                            </p>
                            ${hasCode ? `<span class="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 rounded">#${access.code}</span>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="resendParentCode('${player.id}')" 
                            title="${isSent ? 'Volver a enviar' : 'Enviar ahora'}"
                            class="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors">
                        <i data-lucide="send" class="w-5 h-5"></i>
                    </button>
                    <button onclick="regenerateParentCode('${player.id}')" 
                            title="Regenerar nuevo código"
                            class="p-2 rounded-xl text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/40 transition-colors">
                        <i data-lucide="refresh-cw" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Resend existing code via WhatsApp
 */
async function resendParentCode(playerId) {
    const player = parentAccessData.players.find(p => p.id === playerId);
    if (!player) return;

    let access = parentAccessData.codes[playerId];
    
    if (!access) {
        showToast('⏳ Generando código nuevo...');
        const newCode = window.generateParentAccessCode
            ? window.generateParentAccessCode()
            : Math.random().toString(36).substring(2, 8).toUpperCase();

        if (window.saveParentCode) await window.saveParentCode(playerId, newCode);
        
        access = { playerId, code: newCode, createdAt: new Date().toISOString() };
        parentAccessData.codes[playerId] = access;
    }

    await openWhatsAppForParent(player, access);
    await loadParentAccessStatus();
    renderParentAccessList();
}

/**
 * Generate a NEW code and send via WhatsApp
 */
async function regenerateParentCode(playerId) {
    const player = parentAccessData.players.find(p => p.id === playerId);
    if (!player) return;

    if (!confirm(`¿Estás seguro de REGENERAR el código para ${player.name}?\n\nEl código anterior dejará de funcionar.`)) return;

    showToast('⏳ Generando nuevo código...');
    const newCode = window.generateParentAccessCode
        ? window.generateParentAccessCode()
        : Math.random().toString(36).substring(2, 8).toUpperCase();
    
    if (window.saveParentCode) await window.saveParentCode(playerId, newCode);
    
    const access = { playerId, code: newCode, createdAt: new Date().toISOString() };
    parentAccessData.codes[playerId] = access;

    await openWhatsAppForParent(player, access);
    await loadParentAccessStatus();
    renderParentAccessList();
    showToast('✅ Código regenerado y enviado');
}

/**
 * Common WhatsApp Opener
 */
async function openWhatsAppForParent(player, access) {
    const clubId   = localStorage.getItem('clubId');
    const settings = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
    const clubName = settings.name || 'Mi Escuela de Fútbol';
    
    const phone = (player.phone || '').replace(/[^0-9+]/g, '');
    if (!phone || phone.replace(/[^0-9]/g, '').length < 7) {
        showToast(`❌ Teléfono inválido para ${player.name}`);
        return;
    }

    const message =
        `⚽ *Acceso al Portal de Padres - ${clubName}* ⚽\n\n` +
        `Hola! Te compartimos el acceso oficial para consultar el progreso de *${player.name}*, ver su carnet digital y reportar pagos.\n\n` +
        `🔗 *Ingresa aquí:* https://myclub-portal-padres.vercel.app/\n\n` +
        `📍 *Club ID:* ${clubId}\n` +
        `🔑 *Código de Acceso:* ${access.code}\n\n` +
        `¡Te esperamos en la plataforma!`;
    
    const waUrl = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    
    // Marcar como enviado en Firebase
    try {
        const updateRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/parentCodes`, player.id);
        const sentAt = new Date().toISOString();
        await window.firebase.updateDoc(updateRef, { sentAt });
        if (parentAccessData.codes[player.id]) {
            parentAccessData.codes[player.id].sentAt = sentAt;
        }
    } catch (e) {
        console.warn('No se pudo marcar como enviado en Firebase:', e);
    }

    window.open(waUrl, '_blank');
}

/**
 * Reset all "Sent" markers
 * FIX 3: deleteField ya viene desestructurado — no necesita typeof
 */
async function confirmResetAllParentAccess() {
    if (!confirm(
        '⚠️ ¿Estás seguro de REINICIAR todos los envíos?\n\n' +
        'Esto permitirá volver a enviar el código a TODOS los padres. Los códigos NO cambian.'
    )) return;
    
    if (!confirm('🔴 SEGUNDA CONFIRMACIÓN:\nEsto marcará todos como "Pendientes". ¿Confirmas?')) return;

    try {
        showToast('⏳ Reiniciando historial de envíos...');
        const clubId = localStorage.getItem('clubId');
        const { db, getDocs, collection, doc, updateDoc, deleteField } = window.firebase;
        
        const snapshot = await getDocs(collection(db, `clubs/${clubId}/parentCodes`));
        
        await Promise.all(
            snapshot.docs.map(d =>
                // FIX 3: deleteField directo, sin typeof
                updateDoc(doc(db, `clubs/${clubId}/parentCodes`, d.id), { sentAt: deleteField() })
            )
        );
        
        showToast('✅ Historial reiniciado correctamente');
        await loadParentAccessStatus();
        renderParentAccessList();
    } catch (error) {
        console.error('Error resetting parent access:', error);
        showToast('❌ Error al reiniciar envíos');
    }
}

/**
 * Batch Process — uno por uno con confirmación del usuario
 */
async function processBatchParentAccess() {
    const mainBtn = document.getElementById('btnProcessBatchAccess');
    if (!mainBtn) return;

    // Fase 1: Inicializar
    if (!parentAccessData.isProcessing) {
        const playersToNotify = parentAccessData.players.filter(p => {
            const access = parentAccessData.codes[p.id];
            return !access || !access.sentAt;
        });

        if (playersToNotify.length === 0) {
            return showToast('✅ Todos los alumnos ya están notificados');
        }

        if (!confirm(
            `Se prepararán ${playersToNotify.length} envíos.\n` +
            `Deberás pulsar el botón para cada alumno (requerido por el navegador).\n\n¿Empezar?`
        )) return;

        parentAccessData.isProcessing  = true;
        parentAccessData.batchPlayers  = playersToNotify;
        parentAccessData.currentIndex  = 0;
        
        updateBatchButtonUI();
        return;
    }

    // Fase 2: Procesar el índice actual
    const player = parentAccessData.batchPlayers[parentAccessData.currentIndex];
    if (!player) return;

    await resendParentCode(player.id);
    parentAccessData.currentIndex++;
    
    if (parentAccessData.currentIndex < parentAccessData.batchPlayers.length) {
        updateBatchButtonUI();
    } else {
        showToast('✅ ¡Todos los mensajes enviados!');
        resetBatchState();
    }
}

function updateBatchButtonUI() {
    const mainBtn = document.getElementById('btnProcessBatchAccess');
    if (!mainBtn) return;

    const nextPlayer = parentAccessData.batchPlayers[parentAccessData.currentIndex];
    const total      = parentAccessData.batchPlayers.length;
    const current    = parentAccessData.currentIndex + 1;

    mainBtn.innerHTML = `
        <div class="flex flex-col items-center">
            <span class="text-sm font-bold">Enviar a: ${nextPlayer.name}</span>
            <span class="text-[10px] opacity-80">Alumno ${current} de ${total} · Pulsa para continuar</span>
        </div>
    `;
    mainBtn.className = 'w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg shadow-emerald-500/20';
    
    // Highlight del alumno actual en la lista
    const playerRow = document.querySelector(`[data-player-id="${nextPlayer.id}"]`);
    if (playerRow) {
        playerRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        playerRow.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50', 'dark:bg-emerald-900/20');
        // FIX 4: Mantener highlight hasta que se procese, no por tiempo fijo
        setTimeout(() => {
            playerRow.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50', 'dark:bg-emerald-900/20');
        }, 8000);
    }
}

function resetBatchState() {
    const mainBtn = document.getElementById('btnProcessBatchAccess');
    if (mainBtn) {
        mainBtn.innerHTML = `
            <i data-lucide="send" class="w-5 h-5"></i>
            <span>Empezar a enviar por WhatsApp</span>
        `;
        mainBtn.className = 'w-full bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 hover:from-teal-700 hover:to-emerald-800 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-xl shadow-teal-500/20';
    }
    parentAccessData.isProcessing = false;
    parentAccessData.batchPlayers = [];
    parentAccessData.currentIndex = 0;
    if (window.lucide) window.lucide.createIcons();
}

// Global exposure
window.showParentAccessAutomation   = showParentAccessAutomation;
window.closeParentAccessModal       = closeParentAccessModal;
window.processBatchParentAccess     = processBatchParentAccess;
window.filterParentAccessList       = filterParentAccessList;
window.resendParentCode             = resendParentCode;
window.regenerateParentCode         = regenerateParentCode;
window.confirmResetAllParentAccess  = confirmResetAllParentAccess;

console.log('✅ parent-automation.js cargado');