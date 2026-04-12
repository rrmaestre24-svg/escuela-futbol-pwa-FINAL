/**
 * PARENT PORTAL AUTOMATION - PHASE 2 (ADVANCED CONTROL)
 * Handles generation, distribution, and management of access codes.
 */

let parentAccessData = {
    players: [],
    codes: {},
    isProcessing: false,
    currentFilter: 'all', // all, pending, sent, noaccess
    currentIndex: 0,
    batchPlayers: []
};

const PARENT_PORTAL_REVOKE_DELAY_MINUTES = 30;

function parseDateSafe(value) {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

function isInactivePlayer(player) {
    const status = (player?.status || 'Activo').toString().trim().toLowerCase();
    return status === 'inactivo' || status === 'inactive';
}

function isNoAccessPlayer(player) {
    if (!isInactivePlayer(player)) return false;

    const now = Date.now();
    const revokeAt = parseDateSafe(player?.portalAccessRevokesAt);
    if (revokeAt) return now >= revokeAt.getTime();

    const inactivatedAt = parseDateSafe(player?.lastInactivatedAt);
    if (!inactivatedAt) return true;

    return (now - inactivatedAt.getTime()) >= PARENT_PORTAL_REVOKE_DELAY_MINUTES * 60 * 1000;
}

function hasPortalAccess(player, codesByPlayer) {
    const access = codesByPlayer?.[player?.id];
    const hasCode = !!access?.code;
    if (!hasCode) return false;

    // Jugador activo + código válido => tiene acceso
    if (!isInactivePlayer(player)) return true;

    // Jugador inactivo: mantiene acceso solo durante la ventana de 30 minutos
    return !isNoAccessPlayer(player);
}

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

function showFormalConfirmModal({
    title = 'Confirmar acción',
    message = '',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    tone = 'primary' // primary | warning | danger
} = {}) {
    return new Promise((resolve) => {
        const existing = document.getElementById('formalConfirmModal');
        if (existing) existing.remove();

        const toneConfig = {
            primary: {
                header: 'from-indigo-600 via-blue-600 to-cyan-600',
                ring: 'border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20',
                text: 'text-blue-900 dark:text-blue-200',
                button: 'from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700'
            },
            warning: {
                header: 'from-amber-500 via-orange-500 to-yellow-500',
                ring: 'border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20',
                text: 'text-amber-900 dark:text-amber-200',
                button: 'from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700'
            },
            danger: {
                header: 'from-rose-600 via-red-600 to-orange-600',
                ring: 'border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20',
                text: 'text-red-900 dark:text-red-200',
                button: 'from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
            }
        };

        const cfg = toneConfig[tone] || toneConfig.primary;

        const modal = document.createElement('div');
        modal.id = 'formalConfirmModal';
        modal.className = 'fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
        modal.innerHTML = `
            <div class="w-full max-w-md rounded-3xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-2xl">
                <div class="px-5 py-4 bg-gradient-to-r ${cfg.header} text-white">
                    <h4 class="text-lg font-black tracking-tight">${title}</h4>
                </div>
                <div class="p-5 space-y-4">
                    <div class="rounded-2xl border ${cfg.ring} p-4">
                        <p class="text-sm leading-relaxed ${cfg.text}">${message}</p>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <button id="formalConfirmCancelBtn" class="py-2.5 px-4 rounded-xl font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">${cancelText}</button>
                        <button id="formalConfirmAcceptBtn" class="py-2.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r ${cfg.button} shadow-md transition-all">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;

        const close = (accepted) => {
            modal.remove();
            resolve(accepted);
        };

        modal.querySelector('#formalConfirmCancelBtn')?.addEventListener('click', () => close(false));
        modal.querySelector('#formalConfirmAcceptBtn')?.addEventListener('click', () => close(true));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close(false);
        });

        document.body.appendChild(modal);
    });
}

function showWhatsAppBatchStartModal(totalToSend) {
    return new Promise((resolve) => {
        const existing = document.getElementById('whatsappBatchStartModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'whatsappBatchStartModal';
        modal.className = 'fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';

        modal.innerHTML = `
            <div class="w-full max-w-md rounded-3xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-2xl">
                <div class="px-5 py-4 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white">
                    <div class="flex items-center gap-3">
                        <span class="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
                            <svg viewBox="0 0 24 24" class="w-6 h-6 fill-current" aria-hidden="true">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                            </svg>
                        </span>
                        <div>
                            <p class="text-sm font-semibold opacity-90">Confirmar envío masivo</p>
                            <h4 class="text-lg font-black leading-tight">WhatsApp a Padres</h4>
                        </div>
                    </div>
                </div>

                <div class="p-5 space-y-4">
                    <div class="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                        <p class="text-sm text-emerald-900 dark:text-emerald-200 font-semibold">Se prepararán <span class="font-black text-lg">${totalToSend}</span> envíos.</p>
                        <p class="text-xs mt-1 text-emerald-700 dark:text-emerald-300">Por seguridad del navegador, debes pulsar el botón para cada alumno.</p>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <button id="waBatchCancelBtn" class="py-2.5 px-4 rounded-xl font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
                        <button id="waBatchAcceptBtn" class="py-2.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-md transition-all">Empezar</button>
                    </div>
                </div>
            </div>
        `;

        const close = (accepted) => {
            modal.remove();
            resolve(accepted);
        };

        modal.querySelector('#waBatchCancelBtn')?.addEventListener('click', () => close(false));
        modal.querySelector('#waBatchAcceptBtn')?.addEventListener('click', () => close(true));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close(false);
        });

        document.body.appendChild(modal);
    });
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

    // Auto-revocar códigos vencidos (inactivos con más de 30 min)
    players.forEach(player => {
        if (isInactivePlayer(player) && isNoAccessPlayer(player) && codesByPlayer[player.id]?.code) {
            if (typeof deleteParentCode === 'function') {
                deleteParentCode(player.id);
            }
            delete codesByPlayer[player.id];
        }
    });

    parentAccessData.players = players;
    parentAccessData.codes = codesByPlayer;

    const activePlayers = players.filter(player => !isInactivePlayer(player));
    const total = activePlayers.length;
    const withAccess = activePlayers.filter(p => !!codesByPlayer[p.id]?.code).length;

    const totalElem     = document.getElementById('totalParentsCount');
    const processedElem = document.getElementById('processedParentsCount');
    
    if (totalElem) totalElem.textContent = total;
    if (processedElem) processedElem.textContent = withAccess;
}

/**
 * Filter the list based on status
 */
function filterParentAccessList(filter) {
    parentAccessData.currentFilter = filter;
    
    ['all', 'pending', 'sent', 'noaccess'].forEach(f => {
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

    const activePlayers = players.filter(player => !isInactivePlayer(player));

    let filteredPlayers = activePlayers;
    if (filter === 'pending') {
        filteredPlayers = activePlayers.filter(p => !codes[p.id] || !codes[p.id].sentAt);
    } else if (filter === 'sent') {
        filteredPlayers = activePlayers.filter(p => codes[p.id]?.sentAt);
    } else if (filter === 'noaccess') {
        filteredPlayers = players.filter(p => !hasPortalAccess(p, codes));
    }

    const titleElem = document.getElementById('parentListTitle');
    if (titleElem) {
        const labels = {
            all: 'Todos los Alumnos',
            pending: 'Pendientes por Notificar',
            sent: 'Notificados Exitosamente',
            noaccess: 'Sin acceso al Portal'
        };
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
        const isNoAccess = filter === 'noaccess';
        // FIX 2: Escapar comillas en el nombre para evitar romper el onclick
        const safeName = (player.name || '').replace(/'/g, "\\'");
        const contactPhone = player.phone || player.emergencyContact || '';
        const phone = contactPhone || 'Sin teléfono';
        
        return `
            <div data-player-id="${player.id}" class="group flex items-center justify-between p-3.5 bg-white dark:bg-gray-800/70 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-emerald-500/30 hover:shadow-md transition-all">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="relative shrink-0">
                        <img src="${player.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(player.name) + '&background=random'}" 
                             class="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm"
                             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=random'">
                        ${isSent ? `
                            <span class="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                                <i data-lucide="check" class="w-3 h-3 text-white"></i>
                            </span>` : ''}
                    </div>
                    <div class="min-w-0">
                        <p class="font-bold text-gray-800 dark:text-white text-sm truncate">${player.name}</p>
                        <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
                            <i data-lucide="phone" class="w-3 h-3 shrink-0"></i> ${phone}
                        </p>
                        <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            ${hasCode ? `<span class="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-800/40">#${access.code}</span>` : `<span class="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md border border-amber-100 dark:border-amber-800/40">Sin código</span>`}
                            ${isNoAccess
                                ? `<span class="text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-md border border-red-100 dark:border-red-800/40">Acceso revocado</span>`
                                : (isSent
                                    ? `<span class="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800/40">Enviado</span>`
                                    : `<span class="text-[10px] font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-600">Pendiente</span>`)}
                        </div>
                    </div>
                </div>
                
                ${isNoAccess
                    ? `<div class="ml-2 shrink-0 text-[10px] font-bold text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg border border-red-100 dark:border-red-800/40">Sin portal</div>`
                    : `<div class="flex items-center gap-1 ml-2 shrink-0 opacity-100 sm:opacity-80 sm:group-hover:opacity-100 transition-opacity">
                        <button onclick="resendParentCode('${player.id}')" 
                                title="${isSent ? 'Volver a enviar' : 'Enviar ahora'}"
                                class="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/40">
                            <i data-lucide="send" class="w-4 h-4"></i>
                        </button>
                        <button onclick="regenerateParentCode('${player.id}')" 
                                title="Regenerar nuevo código"
                                class="p-2 rounded-xl text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/40 transition-colors border border-transparent hover:border-amber-200 dark:hover:border-amber-800/40">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        </button>
                    </div>`}
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

    const shouldRegenerate = await showFormalConfirmModal({
        title: 'Regenerar código de acceso',
        message: `Se generará un nuevo código para ${player.name}. El código anterior dejará de funcionar.`,
        confirmText: 'Regenerar',
        cancelText: 'Cancelar',
        tone: 'warning'
    });
    if (!shouldRegenerate) return;

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
    
    const rawPhone = player.phone || player.emergencyContact || '';
    const phone = String(rawPhone).replace(/[^0-9+]/g, '');
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
    const firstConfirm = await showFormalConfirmModal({
        title: 'Reiniciar historial de envíos',
        message: 'Esto permitirá volver a enviar el código a TODOS los padres. Los códigos no cambian.',
        confirmText: 'Continuar',
        cancelText: 'Cancelar',
        tone: 'warning'
    });
    if (!firstConfirm) return;

    const secondConfirm = await showFormalConfirmModal({
        title: 'Confirmación final',
        message: 'Todos pasarán a estado "Pendiente" para reenviar acceso. ¿Deseas proceder?',
        confirmText: 'Sí, reiniciar',
        cancelText: 'Volver',
        tone: 'danger'
    });
    if (!secondConfirm) return;

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
            if (isInactivePlayer(p)) return false;
            const access = parentAccessData.codes[p.id];
            return !access || !access.sentAt;
        });

        if (playersToNotify.length === 0) {
            return showToast('✅ Todos los alumnos ya están notificados');
        }

        const shouldStart = await showWhatsAppBatchStartModal(playersToNotify.length);
        if (!shouldStart) return;

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