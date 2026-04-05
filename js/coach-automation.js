/**
 * COACH PORTAL AUTOMATION
 * Handles generation, distribution, and management of coach access codes directly from PWA.
 */

let coachAccessData = {
    coaches: [],
    categories: [
        "Jardín (3-4 años)", "Transición (5-6 años)", "Iniciación (7-8 años)", 
        "Formación (9-10 años)", "Pre-infantil (11-12 años)", "Infantil (13-14 años)", 
        "Pre-juvenil (15-16 años)", "Juvenil (17-18 años)", "Libre (Mayores)", "Femenino"
    ]
};

/**
 * Show the Coach Access Management Modal
 */
async function showCoachAccessAutomation() {
    const clubId = localStorage.getItem('clubId');
    if (!clubId) return showToast('❌ Error: No se encontró ID del club');

    const modal = document.getElementById('coachAccessModal');
    if (modal) modal.classList.remove('hidden');

    try {
        await loadCoachAccessStatus();
        renderCoachAccessList();
    } catch (error) {
        console.error('Error opening coach automation:', error);
        showToast('❌ Error al cargar datos de profesores');
    }
}

function closeCoachAccessModal() {
    document.getElementById('coachAccessModal')?.classList.add('hidden');
}

/**
 * Load current coaches and their access codes from Firebase
 */
async function loadCoachAccessStatus() {
    const clubId = localStorage.getItem('clubId');
    if (!window.firebase?.db) return;
    
    const coachesRef = window.firebase.collection(window.firebase.db, `clubs/${clubId}/coaches`);
    const coachesSnapshot = await window.firebase.getDocs(coachesRef);
    
    let loadedCoaches = [];
    coachesSnapshot.forEach(doc => {
        loadedCoaches.push({
            id: doc.id,
            ...doc.data()
        });
    });

    coachAccessData.coaches = loadedCoaches;

    const total = loadedCoaches.length;
    const totalElem = document.getElementById('totalCoachesCount');
    if (totalElem) totalElem.textContent = total;
}

/**
 * Render the list of coaches
 */
function renderCoachAccessList() {
    const list = document.getElementById('coachAccessList');
    if (!list) return;

    const coaches = coachAccessData.coaches;

    if (coaches.length === 0) {
        list.innerHTML = `
            <div class="text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-700/20 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-700">
                <p class="text-sm">No hay profesores registrados</p>
            </div>`;
        return;
    }

    const sortedCoaches = [...coaches].sort((a, b) => (a.name||'').localeCompare(b.name||''));

    list.innerHTML = sortedCoaches.map(coach => {
        const safeName = (coach.name || '').replace(/'/g, "\\'");
        const categoriesLabel = (coach.categories && coach.categories.length > 0) 
            ? coach.categories.join(', ')
            : 'Sin categorías';
            
        return `
            <div data-coach-id="${coach.id}" class="group flex items-center justify-between p-3 glass-card rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-500/30 hover:shadow-lg transition-all">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border-2 border-white dark:border-gray-700 shadow-sm">
                        ${(coach.name || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p class="font-bold text-gray-800 dark:text-white text-sm truncate">${coach.name}</p>
                        <div class="flex items-center gap-2 mt-0.5">
                            <p class="text-[10px] text-gray-500 max-w-[120px] truncate" title="${categoriesLabel}">
                                <i data-lucide="tag" class="w-3 h-3 inline"></i> ${categoriesLabel}
                            </p>
                            <span class="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 rounded">#${coach.code}</span>
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center gap-1">
                    <button onclick="editCoachPWA('${coach.id}')" 
                            title="Modificar Profesor"
                            class="p-2 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button onclick="copyCoachCredentials('${coach.id}')" 
                            title="Copiar Acceso"
                            class="p-2 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 transition-colors">
                        <i data-lucide="copy" class="w-5 h-5"></i>
                    </button>
                    <button onclick="sendCoachWhatsApp('${coach.id}')" 
                            title="Enviar Acceso por WhatsApp"
                            class="p-2 rounded-xl text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 transition-colors">
                        <i data-lucide="message-circle" class="w-5 h-5"></i>
                    </button>
                    <button onclick="deleteCoachPWA('${coach.id}')" 
                            title="Eliminar Profesor"
                            class="p-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    if (window.lucide) window.lucide.createIcons();
}

/**
 * Open Modal to Add/Edit Coach
 */
function openAddCoachPWA() {
    document.getElementById('coachFormModalTitle').textContent = 'Nuevo Profesor';
    document.getElementById('coachFormId').value = '';
    document.getElementById('coachNameInput').value = '';
    
    const checkboxesHtml = coachAccessData.categories.map(cat => `
        <label class="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <input type="checkbox" value="${cat}" class="coach-cat-check w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500">
            <span class="text-xs text-gray-700 dark:text-gray-300">${cat}</span>
        </label>
    `).join('');
    
    document.getElementById('coachCategoriesGrid').innerHTML = checkboxesHtml;
    
    document.getElementById('coachFormModal').classList.remove('hidden');
}

function editCoachPWA(coachId) {
    const coach = coachAccessData.coaches.find(c => c.id === coachId);
    if (!coach) return;
    
    document.getElementById('coachFormModalTitle').textContent = 'Editar Profesor';
    document.getElementById('coachFormId').value = coach.id;
    document.getElementById('coachNameInput').value = coach.name || '';
    
    const checkboxesHtml = coachAccessData.categories.map(cat => {
        const isChecked = (coach.categories || []).includes(cat) ? 'checked' : '';
        return `
            <label class="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <input type="checkbox" value="${cat}" ${isChecked} class="coach-cat-check w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500">
                <span class="text-xs text-gray-700 dark:text-gray-300">${cat}</span>
            </label>
        `;
    }).join('');
    
    document.getElementById('coachCategoriesGrid').innerHTML = checkboxesHtml;
    document.getElementById('coachFormModal').classList.remove('hidden');
}

function closeCoachFormModal() {
    document.getElementById('coachFormModal').classList.add('hidden');
}

/**
 * Save Coach
 */
async function saveCoachPWA() {
    const clubId = localStorage.getItem('clubId');
    const id = document.getElementById('coachFormId').value;
    const name = document.getElementById('coachNameInput').value.trim();
    
    if (!name) {
        showToast('❌ Escribe el nombre del profesor');
        return;
    }

    const categories = Array.from(document.querySelectorAll('.coach-cat-check:checked')).map(c => c.value);

    const btn = document.getElementById('saveCoachBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="lucide-loader w-5 h-5 animate-spin"></i> Guardando...';
    btn.disabled = true;

    try {
        const { db, collection, doc, addDoc, updateDoc } = window.firebase;
        
        if (id) {
            // Update
            const coachRef = doc(db, `clubs/${clubId}/coaches`, id);
            await updateDoc(coachRef, {
                name,
                categories,
                updatedAt: new Date().toISOString()
            });
            showToast('✅ Profesor actualizado');
        } else {
            // Generate 6 digit uppercase alphanum code
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            // Create
            await addDoc(collection(db, `clubs/${clubId}/coaches`), {
                name,
                categories,
                code,
                active: true,
                createdAt: new Date().toISOString()
            });
            showToast(`✅ Profesor creado con código: ${code}`);
        }
        
        closeCoachFormModal();
        await loadCoachAccessStatus();
        renderCoachAccessList();
    } catch (err) {
        console.error(err);
        showToast('❌ Error al guardar el profesor');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

/**
 * Delete Coach
 */
async function deleteCoachPWA(coachId) {
    if (!confirm('¿Estás seguro de eliminar a este profesor? No perderás los registros de asistencia previos elaborados por él.')) return;
    
    try {
        const clubId = localStorage.getItem('clubId');
        const { db, doc, deleteDoc } = window.firebase;
        
        await deleteDoc(doc(db, `clubs/${clubId}/coaches`, coachId));
        showToast('🗑️ Profesor eliminado');
        
        await loadCoachAccessStatus();
        renderCoachAccessList();
    } catch (e) {
        console.error(e);
        showToast('❌ Error al eliminar');
    }
}

/**
 * Send WhatsApp with Coach Credentials
 */
function getCoachMessage(coachId) {
    const clubId   = localStorage.getItem('clubId');
    const settings = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
    const clubName = settings.name || 'Nuestra Escuela de Fútbol';
    
    const coach = coachAccessData.coaches.find(c => c.id === coachId);
    if (!coach) return null;

    const assignedCats = (coach.categories && coach.categories.length > 0) 
        ? coach.categories.join(', ')
        : 'Ninguna categoría todavía';

    return `📋 *Acceso a Asistencias - ${clubName}* 📋\n\n` +
           `Hola *${coach.name}*! Te compartimos tu acceso oficial para tomar la asistencia de tus grupos asignados: ${assignedCats}.\n\n` +
           `🔗 *Ingresa aquí:* https://myclub-asistencia.vercel.app/\n\n` +
           `🏟 *Club ID:* ${clubId}\n` +
           `🔑 *Código de Entrenador:* ${coach.code}\n\n` +
           `¡Gracias por tu labor formativa! ⚽`;
}

/**
 * Send WhatsApp with Coach Credentials
 */
async function sendCoachWhatsApp(coachId) {
    const message = getCoachMessage(coachId);
    if (!message) return;
    
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
}

/**
 * Copy Coach Credentials to Clipboard
 */
async function copyCoachCredentials(coachId) {
    const message = getCoachMessage(coachId);
    if (!message) return;
    
    try {
        await navigator.clipboard.writeText(message);
        showToast('✅ Credenciales copiadas al portapapeles');
    } catch (err) {
        showToast('❌ Error al copiar al portapapeles');
    }
}

/**
 * Redirect to Admin Panel of Attendance App
 */
async function goToAttendanceAdminPanel() {
    const clubId = localStorage.getItem('clubId');
    if (!clubId) return showToast('Error: No se encontró ID de club activo');
    
    let autoLoginQuery = '';
    try {
        if (window.firebase?.db) {
            const { db, doc, getDoc } = window.firebase;
            const settingsDoc = await getDoc(doc(db, `clubs/${clubId}/settings`, 'attendance'));
            if (settingsDoc.exists() && settingsDoc.data().adminCode) {
                autoLoginQuery = `&autoLogin=${settingsDoc.data().adminCode}`;
            } else {
                autoLoginQuery = `&autoLogin=admin123`;
            }
        }
    } catch (e) {
        console.error('Error fetching admin code config:', e);
    }

    const targetUrl = `https://myclub-asistencia.vercel.app/admin.html?clubId=${clubId}${autoLoginQuery}`;
    window.open(targetUrl, '_blank');
}

// Global exposure
window.showCoachAccessAutomation = showCoachAccessAutomation;
window.closeCoachAccessModal     = closeCoachAccessModal;
window.openAddCoachPWA           = openAddCoachPWA;
window.editCoachPWA              = editCoachPWA;
window.closeCoachFormModal       = closeCoachFormModal;
window.saveCoachPWA              = saveCoachPWA;
window.deleteCoachPWA            = deleteCoachPWA;
window.sendCoachWhatsApp         = sendCoachWhatsApp;
window.copyCoachCredentials      = copyCoachCredentials;
window.goToAttendanceAdminPanel  = goToAttendanceAdminPanel;

console.log('✅ coach-automation.js cargado');
