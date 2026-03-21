/**
 * PARENT PORTAL AUTOMATION - BATCH PROCESSING
 * Handles generation and distribution of access codes.
 */

let parentAccessData = {
    players: [],
    codes: {},
    isProcessing: false
};

/**
 * Show the Parent Access Management Modal
 */
async function showParentAccessAutomation() {
    const clubId = localStorage.getItem('clubId');
    if (!clubId) return showToast('❌ Error: No se encontró ID del club');

    // Show modal quickly
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
}

/**
 * Load current players and their access codes from Firebase
 */
async function loadParentAccessStatus() {
    const clubId = localStorage.getItem('clubId');
    if (!window.firebase?.db) return;

    // 1. Get Players from localStorage
    const players = JSON.parse(localStorage.getItem('players') || '[]');
    
    // 2. Get Codes from Firebase to be sure we have the latest
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

    // Update counts
    const withAccess = players.filter(p => codesByPlayer[p.id]).length;
    const withoutAccess = players.length - withAccess;

    const withAccessElem = document.getElementById('parentsWithAccessCount');
    const withoutAccessElem = document.getElementById('parentsWithoutAccessCount');
    
    if (withAccessElem) withAccessElem.textContent = withAccess;
    if (withoutAccessElem) withoutAccessElem.textContent = withoutAccess;
}

/**
 * Render the list of players pending access or notification
 */
function renderParentAccessList() {
    const list = document.getElementById('parentAccessPendingList');
    if (!list) return;

    const players = parentAccessData.players;
    const codes = parentAccessData.codes;

    if (players.length === 0) {
        list.innerHTML = '<div class="text-center py-8 text-gray-500">No hay jugadores registrados</div>';
        return;
    }

    // Sort: No code first, then alphabetical
    const sortedPlayers = [...players].sort((a, b) => {
        const hasA = codes[a.id] ? 1 : 0;
        const hasB = codes[b.id] ? 1 : 0;
        if (hasA !== hasB) return hasA - hasB;
        return a.name.localeCompare(b.name);
    });

    list.innerHTML = sortedPlayers.map(player => {
        const access = codes[player.id];
        const statusClass = access ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-gray-50 dark:bg-gray-700/30';
        const phone = player.phone || 'Sin teléfono';
        
        return `
            <div class="flex items-center justify-between p-3 rounded-xl ${statusClass} border border-transparent hover:border-teal-500/30 transition-all">
                <div class="flex items-center gap-3">
                    <img src="${player.avatar || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'50\' fill=\'%23e5e7eb\'/%3E%3C/svg%3E'}" 
                         class="w-10 h-10 rounded-full object-cover shadow-sm">
                    <div class="max-w-[150px] sm:max-w-xs overflow-hidden">
                        <p class="font-bold text-gray-800 dark:text-white text-sm truncate">${player.name}</p>
                        <p class="text-[10px] text-gray-500 truncate">${phone}</p>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    ${access ? 
                        `<div class="flex flex-col items-end gap-1">
                            <span class="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full uppercase">Código: ${access.code}</span>
                            ${access.sentAt ? `<span class="text-[9px] text-emerald-500 flex items-center gap-0.5"><i data-lucide="check" class="w-3 h-3"></i> Enviado</span>` : ''}
                        </div>` : 
                        `<span class="text-[10px] font-bold text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full uppercase">Pendiente</span>`
                    }
                </div>
            </div>
        `;
    }).join('');
    
    // Re-run Lucide icons
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Process access codes and open WhatsApp for each
 */
async function processBatchParentAccess() {
    if (parentAccessData.isProcessing) return;
    
    const clubId = localStorage.getItem('clubId');
    if (!clubId) return showToast('❌ No se encontró ID del club');

    const settings = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
    const clubName = settings.name || 'Mi Escuela de Fútbol';
    
    // Filter players: not notified (either no code or never sent)
    const playersToNotify = parentAccessData.players.filter(p => {
        const access = parentAccessData.codes[p.id];
        return !access || !access.sentAt;
    });

    if (playersToNotify.length === 0) {
        return showToast('✅ Todos los padres ya tienen acceso notificado');
    }

    if (!confirm(`Se enviarán ${playersToNotify.length} mensajes. ¿Deseas empezar?`)) return;

    parentAccessData.isProcessing = true;
    const btn = document.getElementById('btnProcessBatchAccess');
    const originalText = btn.innerHTML;
    btn.disabled = true;

    try {
        for (let i = 0; i < playersToNotify.length; i++) {
            const player = playersToNotify[i];
            btn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Enviando (${i + 1}/${playersToNotify.length})...`;
            
            let access = parentAccessData.codes[player.id];
            
            // 1. Generate code if it doesn't exist (using storage.js utility)
            if (!access) {
                console.log(`🆕 Generando código para ${player.name}`);
                const newCode = window.generateParentAccessCode ? window.generateParentAccessCode() : Math.random().toString(36).substring(2, 8).toUpperCase();
                
                // saveParentCode handles localStorage and Firebase sync
                if (window.saveParentCode) {
                    window.saveParentCode(player.id, newCode);
                }
                
                access = {
                    playerId: player.id,
                    code: newCode,
                    createdAt: new Date().toISOString()
                };
                parentAccessData.codes[player.id] = access;
            }

            // 2. Prepare WhatsApp Message
            const phone = player.phone || '';
            if (phone && phone.length > 5) {
                const message = `⚽ *Acceso al Portal de Padres - ${clubName}* ⚽\n\nHola! Te compartimos el acceso oficial para consultar el progreso de *${player.name}*, ver su carnet digital, reportar pagos y recibir notificaciones.\n\n🔗 *Ingresa aquí:* https://myclub-pwa.vercel.app\n\n📍 *Club ID:* ${clubId}\n🔑 *Código de Acceso:* ${access.code}\n\n¡Te esperamos en la plataforma!`;
                
                const waUrl = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
                
                // Mark as sent in Firebase
                const updateRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/parentCodes`, player.id);
                const sentAt = new Date().toISOString();
                await window.firebase.updateDoc(updateRef, { sentAt });
                
                // Update local status
                parentAccessData.codes[player.id].sentAt = sentAt;

                // Open window
                window.open(waUrl, '_blank');
                
                // Wait for UI to catch up
                renderParentAccessList();

                // Wait for user to send and come back
                if (i < playersToNotify.length - 1) {
                    const proceed = await new Promise(resolve => {
                        const confirmBox = confirm(`Mensaje para ${player.name} abierto en WhatsApp.\n\n¿Continuar con el siguiente (${i + 2}/${playersToNotify.length})?`);
                        resolve(confirmBox);
                    });
                    if (!proceed) break;
                }
            } else {
                console.warn(`⚠️ Jugador ${player.name} no tiene teléfono válido`);
            }
        }
        
        showToast('✅ Proceso completado');
        await loadParentAccessStatus();
        renderParentAccessList();
        
    } catch (error) {
        console.error('Error in batch processing:', error);
        showToast('❌ Error en el proceso');
    } finally {
        parentAccessData.isProcessing = false;
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Global exposure
window.showParentAccessAutomation = showParentAccessAutomation;
window.closeParentAccessModal = closeParentAccessModal;
window.processBatchParentAccess = processBatchParentAccess;
