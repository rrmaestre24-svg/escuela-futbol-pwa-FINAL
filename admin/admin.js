// ========================================
// PANEL SUPER ADMIN - MY CLUB
// Gestión de licencias y escuelas
// ========================================

console.log('🛡️ Cargando Panel Super Admin...');

// ========================================
// VARIABLES GLOBALES
// ========================================
let currentSchools = [];
let currentCodes = [];
let currentSchoolData = null;

// ========================================
// UTILIDADES
// ========================================
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code += '-';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function daysUntil(dateString) {
    const endDate = new Date(dateString);
    const now = new Date();
    const diffTime = endDate - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ========================================
// AUTENTICACIÓN CON FIRESTORE
// ========================================

// Verificar si el usuario es Super Admin en Firestore
async function verifySuperAdmin(uid) {
    try {
        const { db, doc, getDoc } = window.firebaseAdmin;
        const superAdminDoc = await getDoc(doc(db, 'super_admins', uid));
        
        if (!superAdminDoc.exists()) {
            console.log('❌ Usuario no encontrado en super_admins');
            return { isValid: false, data: null };
        }
        
        const data = superAdminDoc.data();
        
        if (data.role !== 'super_admin') {
            console.log('❌ El usuario no tiene rol super_admin');
            return { isValid: false, data: null };
        }
        
        if (data.active !== true) {
            console.log('❌ La cuenta de super admin está desactivada');
            return { isValid: false, data: null };
        }
        
        console.log('✅ Super Admin verificado:', data.displayName || data.email);
        return { isValid: true, data: data };
        
    } catch (error) {
        console.error('Error verificando super admin:', error);
        return { isValid: false, data: null };
    }
}

// Actualizar último login
async function updateLastLogin(uid) {
    try {
        const { db, doc, updateDoc } = window.firebaseAdmin;
        await updateDoc(doc(db, 'super_admins', uid), {
            lastLogin: new Date().toISOString()
        });
    } catch (error) {
        console.warn('No se pudo actualizar lastLogin:', error);
    }
}

// Variable global para almacenar datos del admin actual
let currentAdminData = null;
let dataLoaded = false; // Flag para evitar doble carga

document.getElementById('adminLoginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    
    try {
        showToast('⏳ Verificando credenciales...');
        
        const { signInWithEmailAndPassword, auth } = window.firebaseAdmin;
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Verificar si es Super Admin en Firestore
        showToast('⏳ Verificando permisos...');
        const verification = await verifySuperAdmin(user.uid);
        
        if (!verification.isValid) {
            // No es super admin, cerrar sesión
            const { signOut } = window.firebaseAdmin;
            await signOut(auth);
            showToast('❌ No tienes permisos de administrador');
            return;
        }
        
        // Guardar datos del admin
        currentAdminData = verification.data;
        
        // Actualizar último login
        await updateLastLogin(user.uid);
        
        showToast('✅ Bienvenido, ' + (currentAdminData.displayName || 'Super Admin'));
        showAdminPanel();
        
    } catch (error) {
        console.error('Error de login:', error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            showToast('❌ Contraseña incorrecta');
        } else if (error.code === 'auth/user-not-found') {
            showToast('❌ Usuario no encontrado');
        } else {
            showToast('❌ Error: ' + error.message);
        }
    }
});

function showAdminPanel() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    
    // Mostrar nombre o email del admin
    const displayText = currentAdminData?.displayName || currentAdminData?.email || 'Super Admin';
    document.getElementById('adminUserEmail').textContent = displayText;
    
    // Cargar datos solo si no se han cargado ya
    if (!dataLoaded) {
        dataLoaded = true;
        loadAllData();
    }
}

async function adminLogout() {
    if (confirm('¿Cerrar sesión?')) {
        try {
            const { signOut, auth } = window.firebaseAdmin;
            await signOut(auth);
            
            document.getElementById('adminPanel').classList.add('hidden');
            document.getElementById('loginScreen').classList.remove('hidden');
            
            // Resetear flags
            dataLoaded = false;
            currentAdminData = null;
            
            showToast('👋 Sesión cerrada');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }
}

// Verificar sesión al cargar
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
        if (window.firebaseAdmin?.auth) {
            const { onAuthStateChanged, auth } = window.firebaseAdmin;
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    // Verificar si es Super Admin en Firestore
                    const verification = await verifySuperAdmin(user.uid);
                    
                    if (verification.isValid) {
                        currentAdminData = verification.data;
                        showAdminPanel();
                    }
                }
            });
        }
    }, 1000);
});

// ========================================
// CARGAR DATOS
// ========================================
async function loadAllData() {
    showToast('⏳ Cargando datos...');
    
    await Promise.all([
        loadSchools(),
        loadCodes()
    ]);
    
    updateStats();
    showToast('✅ Datos cargados');
}

async function refreshData() {
    dataLoaded = false; // Permitir recarga manual
    await loadAllData();
    dataLoaded = true;
}

async function loadSchools() {
    try {
        const { db, getDocs, collection } = window.firebaseAdmin;
        const licensesSnapshot = await getDocs(collection(db, 'licenses'));
        
        currentSchools = [];
        
        for (const docSnap of licensesSnapshot.docs) {
            const licenseData = { id: docSnap.id, ...docSnap.data() };
            
            // ✅ Contar jugadores reales de cada club
            try {
                console.log(`📊 Contando jugadores de: ${licenseData.clubName}`);
                
                const playersRef = collection(db, `clubs/${licenseData.clubId}/players`);
                const playersSnapshot = await getDocs(playersRef);
                const playerCount = playersSnapshot.size;
                
                licenseData.totalPlayers = playerCount;
                console.log(`✅ ${licenseData.clubName}: ${playerCount} jugadores`);
                
                // ✅ ACTUALIZAR el contador en la licencia
                const { doc, updateDoc } = window.firebaseAdmin;
                await updateDoc(doc(db, 'licenses', licenseData.clubId), {
                    totalPlayers: playerCount,
                    lastUpdated: new Date().toISOString()
                });
                
            } catch (e) {
                console.warn(`⚠️ Error al contar jugadores de: ${licenseData.clubId}`, e);
                licenseData.totalPlayers = licenseData.totalPlayers || 0;
            }
            
            currentSchools.push(licenseData);
        }
        
        console.log('📋 Escuelas cargadas:', currentSchools.length);
        renderSchoolsTable();
        renderAlerts();
        
    } catch (error) {
        console.error('❌ Error al cargar escuelas:', error);
        showToast('❌ Error al cargar escuelas');
    }
}

async function loadCodes() {
    try {
        const { db, getDocs, collection, orderBy, query } = window.firebaseAdmin;
        const codesSnapshot = await getDocs(
            query(collection(db, 'activation_codes'), orderBy('createdAt', 'desc'))
        );
        
        currentCodes = [];
        codesSnapshot.forEach(doc => {
            currentCodes.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('🎟️ Códigos cargados:', currentCodes.length);
        renderCodesTable();
        
    } catch (error) {
        console.error('Error al cargar códigos:', error);
        showToast('❌ Error al cargar códigos');
    }
}

// ========================================
// ESTADÍSTICAS
// ========================================
function updateStats() {
    const active = currentSchools.filter(s => s.status === 'activo').length;
    const inactive = currentSchools.filter(s => s.status === 'inactivo').length;
    const expiring = currentSchools.filter(s => {
        const days = daysUntil(s.endDate);
        return days > 0 && days <= 7;
    }).length;
    const pendingCodes = currentCodes.filter(c => !c.used).length;
    
    document.getElementById('statActiveSchools').textContent = active;
    document.getElementById('statInactiveSchools').textContent = inactive;
    document.getElementById('statExpiringSoon').textContent = expiring;
    document.getElementById('statPendingCodes').textContent = pendingCodes;
}

// ========================================
// TABS
// ========================================
function showTab(tab) {
    // Ocultar todas las secciones
    document.getElementById('schoolsSection').classList.add('hidden');
    document.getElementById('codesSection').classList.add('hidden');
    document.getElementById('alertsSection').classList.add('hidden');
    
    // Resetear tabs
    document.getElementById('tabSchools').classList.remove('bg-teal-600', 'text-white');
    document.getElementById('tabSchools').classList.add('bg-gray-700', 'text-gray-300');
    document.getElementById('tabCodes').classList.remove('bg-teal-600', 'text-white');
    document.getElementById('tabCodes').classList.add('bg-gray-700', 'text-gray-300');
    document.getElementById('tabAlerts').classList.remove('bg-teal-600', 'text-white');
    document.getElementById('tabAlerts').classList.add('bg-gray-700', 'text-gray-300');
    
    // Mostrar sección seleccionada
    if (tab === 'schools') {
        document.getElementById('schoolsSection').classList.remove('hidden');
        document.getElementById('tabSchools').classList.add('bg-teal-600', 'text-white');
        document.getElementById('tabSchools').classList.remove('bg-gray-700', 'text-gray-300');
    } else if (tab === 'codes') {
        document.getElementById('codesSection').classList.remove('hidden');
        document.getElementById('tabCodes').classList.add('bg-teal-600', 'text-white');
        document.getElementById('tabCodes').classList.remove('bg-gray-700', 'text-gray-300');
    } else if (tab === 'alerts') {
        document.getElementById('alertsSection').classList.remove('hidden');
        document.getElementById('tabAlerts').classList.add('bg-teal-600', 'text-white');
        document.getElementById('tabAlerts').classList.remove('bg-gray-700', 'text-gray-300');
    }
}

function showCodesTab() {
    showTab('codes');
}

// ========================================
// RENDERIZAR TABLAS
// ========================================
function renderSchoolsTable() {
    const tbody = document.getElementById('schoolsTableBody');
    const noMessage = document.getElementById('noSchoolsMessage');
    
    if (currentSchools.length === 0) {
        tbody.innerHTML = '';
        noMessage.classList.remove('hidden');
        return;
    }
    
    noMessage.classList.add('hidden');
    
    tbody.innerHTML = currentSchools.map(school => {
        const days = daysUntil(school.endDate);
        let statusBadge, statusColor;
        
        if (school.status === 'activo' && days > 7) {
            statusBadge = '🟢 Activo';
            statusColor = 'bg-green-900 text-green-300';
        } else if (school.status === 'activo' && days > 0) {
            statusBadge = '🟡 Por vencer';
            statusColor = 'bg-yellow-900 text-yellow-300';
        } else if (school.status === 'gracia') {
            statusBadge = '🟠 En gracia';
            statusColor = 'bg-orange-900 text-orange-300';
        } else {
            statusBadge = '🔴 Inactivo';
            statusColor = 'bg-red-900 text-red-300';
        }
        
        const planBadge = school.plan === 'anual' 
            ? '<span class="bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs">Anual</span>'
            : '<span class="bg-purple-900 text-purple-300 px-2 py-1 rounded text-xs">Mensual</span>';
        
        // Calcular crecimiento (jugadores)
        const growth = school.totalPlayers || 0;
        
        return `
            <tr class="border-b border-gray-700 hover:bg-gray-750">
                <td class="py-4">
                    <div class="flex items-center gap-3">
                        <div class="text-2xl">🏫</div>
                        <div>
                            <p class="font-medium text-white">${school.clubName || school.clubId}</p>
                            <p class="text-xs text-gray-400">${school.clubId}</p>
                        </div>
                    </div>
                </td>
                <td class="py-4">
                    <a href="https://wa.me/${(school.clubPhone || '').replace(/[^0-9]/g, '')}" target="_blank" 
                       class="text-green-400 hover:text-green-300 flex items-center gap-1">
                        <i data-lucide="phone" class="w-3 h-3"></i>
                        ${school.clubPhone || '-'}
                    </a>
                </td>
                <td class="py-4">${planBadge}</td>
                <td class="py-4">
                    <p class="text-white">${formatDate(school.endDate)}</p>
                    <p class="text-xs ${days <= 7 ? 'text-yellow-400' : 'text-gray-400'}">
                        ${days > 0 ? `${days} días` : days === 0 ? 'Hoy' : `Vencido hace ${Math.abs(days)} días`}
                    </p>
                </td>
                <td class="py-4">
                    <div class="flex items-center gap-2">
                        <span class="text-white font-medium">${growth}</span>
                        <span class="text-gray-400 text-xs">jugadores</span>
                    </div>
                </td>
                <td class="py-4">
                    <span class="${statusColor} px-3 py-1 rounded-full text-xs font-medium">
                        ${statusBadge}
                    </span>
                </td>
                <td class="py-4">
                    <button onclick="openSchoolActions('${school.clubId}')" 
                            class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1">
                        <i data-lucide="settings" class="w-4 h-4"></i>
                        Gestionar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    lucide.createIcons();
}

function renderCodesTable() {
    const tbody = document.getElementById('codesTableBody');
    const noMessage = document.getElementById('noCodesMessage');
    
    if (currentCodes.length === 0) {
        tbody.innerHTML = '';
        noMessage.classList.remove('hidden');
        return;
    }
    
    noMessage.classList.add('hidden');
    
    tbody.innerHTML = currentCodes.map(code => {
        const createdAt = code.createdAt?.toDate ? code.createdAt.toDate() : new Date(code.createdAt);
        const expiresAt = new Date(createdAt);
        expiresAt.setDate(expiresAt.getDate() + 7);
        const isExpired = new Date() > expiresAt;
        
        let statusBadge;
        if (code.used) {
            statusBadge = '<span class="bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs">✅ Usado</span>';
        } else if (isExpired) {
            statusBadge = '<span class="bg-red-900 text-red-300 px-2 py-1 rounded text-xs">⏰ Expirado</span>';
        } else {
            statusBadge = '<span class="bg-green-900 text-green-300 px-2 py-1 rounded text-xs">🟢 Disponible</span>';
        }
        
        const planBadge = code.plan === 'anual' 
            ? '<span class="bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs">Anual</span>'
            : '<span class="bg-purple-900 text-purple-300 px-2 py-1 rounded text-xs">Mensual</span>';
        
        return `
            <tr class="border-b border-gray-700 hover:bg-gray-750">
                <td class="py-4">
                    <code class="bg-gray-900 text-teal-400 px-3 py-1 rounded font-mono text-lg">${code.id}</code>
                </td>
                <td class="py-4">${planBadge}</td>
                <td class="py-4 text-gray-300">${formatDateTime(code.createdAt)}</td>
                <td class="py-4 text-gray-300">${formatDate(expiresAt)}</td>
                <td class="py-4">${statusBadge}</td>
                <td class="py-4 text-gray-400">${code.usedBy || '-'}</td>
                <td class="py-4">
                    ${!code.used && !isExpired ? `
                        <button onclick="copyCode('${code.id}')" 
                                class="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded text-sm">
                            Copiar
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

function renderAlerts() {
    const alertsList = document.getElementById('alertsList');
    const noMessage = document.getElementById('noAlertsMessage');
    
    // Filtrar escuelas con alertas
    const alerts = currentSchools.filter(s => {
        const days = daysUntil(s.endDate);
        return days <= 7 || s.status === 'gracia' || s.status === 'inactivo';
    }).sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate));
    
    if (alerts.length === 0) {
        alertsList.innerHTML = '';
        noMessage.classList.remove('hidden');
        return;
    }
    
    noMessage.classList.add('hidden');
    
    alertsList.innerHTML = alerts.map(school => {
        const days = daysUntil(school.endDate);
        let bgColor, icon, message;
        
        if (days < 0) {
            bgColor = 'bg-red-900 border-red-700';
            icon = '🔴';
            message = `Vencido hace ${Math.abs(days)} días`;
        } else if (days === 0) {
            bgColor = 'bg-orange-900 border-orange-700';
            icon = '⚠️';
            message = 'Vence HOY';
        } else if (days <= 3) {
            bgColor = 'bg-orange-900 border-orange-700';
            icon = '⏰';
            message = `Vence en ${days} día${days > 1 ? 's' : ''}`;
        } else {
            bgColor = 'bg-yellow-900 border-yellow-700';
            icon = '📅';
            message = `Vence en ${days} días`;
        }
        
        return `
            <div class="${bgColor} border rounded-xl p-4 mb-4 animate-fade-in">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">${icon}</span>
                        <div>
                            <h4 class="font-bold text-white">${school.clubName || school.clubId}</h4>
                            <p class="text-sm text-gray-300">${message}</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="sendReminderWhatsAppDirect('${school.clubPhone}', '${school.clubName}')" 
                                class="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1">
                            <i data-lucide="message-circle" class="w-4 h-4"></i>
                            WhatsApp
                        </button>
                        <button onclick="openSchoolActions('${school.clubId}')" 
                                class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm">
                            Gestionar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

// ========================================
// FILTROS
// ========================================
function filterSchools() {
    const search = document.getElementById('searchSchools').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;
    
    const filtered = currentSchools.filter(school => {
        const matchSearch = (school.clubName || '').toLowerCase().includes(search) ||
                           (school.clubId || '').toLowerCase().includes(search);
        const matchStatus = status === 'all' || school.status === status;
        
        return matchSearch && matchStatus;
    });
    
    // Temporalmente reemplazar y renderizar
    const original = currentSchools;
    currentSchools = filtered;
    renderSchoolsTable();
    currentSchools = original;
}

// ========================================
// GENERAR CÓDIGO
// ========================================
function showGenerateCodeModal() {
    document.getElementById('generateCodeModal').classList.remove('hidden');
    document.getElementById('generateCodeForm').reset();
}

function closeGenerateCodeModal() {
    document.getElementById('generateCodeModal').classList.add('hidden');
}

document.getElementById('generateCodeForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const plan = document.getElementById('codePlan').value;
    const price = document.getElementById('codePrice').value;
    const notes = document.getElementById('codeNotes').value;
    
    const code = generateCode();
    
    try {
        showToast('⏳ Generando código...');
        
        const { db, doc, setDoc } = window.firebaseAdmin;
        
        await setDoc(doc(db, 'activation_codes', code), {
            plan: plan,
            price: price,
            notes: notes,
            used: false,
            usedBy: null,
            createdAt: new Date().toISOString(),
            createdBy: currentAdminData?.email || 'Super Admin'
        });
        
        closeGenerateCodeModal();
        
        // Mostrar código generado
        document.getElementById('generatedCodeDisplay').textContent = code;
        document.getElementById('codeGeneratedModal').classList.remove('hidden');
        
        // Recargar códigos
        await loadCodes();
        updateStats();
        
        showToast('✅ Código generado correctamente');
        
    } catch (error) {
        console.error('Error al generar código:', error);
        showToast('❌ Error al generar código');
    }
});

function closeCodeGeneratedModal() {
    document.getElementById('codeGeneratedModal').classList.add('hidden');
}

function copyGeneratedCode() {
    const code = document.getElementById('generatedCodeDisplay').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast('✅ Código copiado');
    });
}

function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast('✅ Código copiado: ' + code);
    });
}

function shareViaWhatsApp() {
    const code = document.getElementById('generatedCodeDisplay').textContent;
    const message = `🎟️ *Código de Activación MY CLUB*\n\n` +
                   `Tu código es: *${code}*\n\n` +
                   `📋 Instrucciones:\n` +
                   `1. Abre la app MY CLUB\n` +
                   `2. Ve a "Registrarse"\n` +
                   `3. Ingresa el código de activación\n` +
                   `4. Completa el formulario de tu club\n\n` +
                   `⏰ Este código es válido por 7 días.\n\n` +
                   `¿Necesitas ayuda? Escríbenos.`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// ========================================
// ACCIONES DE ESCUELA
// ========================================
function openSchoolActions(clubId) {
    const school = currentSchools.find(s => s.clubId === clubId);
    if (!school) {
        showToast('❌ Escuela no encontrada');
        return;
    }
    
    currentSchoolData = school;
    
    document.getElementById('actionSchoolId').value = clubId;
    document.getElementById('actionSchoolName').textContent = school.clubName || school.clubId;
    document.getElementById('actionSchoolPhone').textContent = school.clubPhone || 'Sin teléfono';
    document.getElementById('schoolActionTitle').textContent = school.clubName || school.clubId;
    
    // Historial de pagos
    const historyList = document.getElementById('paymentHistoryList');
    if (school.paymentHistory && school.paymentHistory.length > 0) {
        historyList.innerHTML = school.paymentHistory.map(payment => `
            <div class="bg-gray-600 rounded-lg p-3 text-sm">
                <div class="flex justify-between">
                    <span class="text-gray-300">${payment.action === 'activation' ? '🎟️ Activación' : '🔄 Renovación'}</span>
                    <span class="text-white">${formatDate(payment.date)}</span>
                </div>
                <p class="text-gray-400 text-xs mt-1">${payment.plan}</p>
            </div>
        `).join('');
    } else {
        historyList.innerHTML = '<p class="text-gray-500 text-sm">Sin historial</p>';
    }
    
    // Actualizar botón de estado
    const toggleBtn = document.getElementById('toggleStatusText');
    if (school.status === 'activo') {
        toggleBtn.textContent = 'Desactivar';
        document.getElementById('toggleStatusBtn').classList.remove('bg-green-600', 'hover:bg-green-700');
        document.getElementById('toggleStatusBtn').classList.add('bg-yellow-600', 'hover:bg-yellow-700');
    } else {
        toggleBtn.textContent = 'Activar';
        document.getElementById('toggleStatusBtn').classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
        document.getElementById('toggleStatusBtn').classList.add('bg-green-600', 'hover:bg-green-700');
    }
    
    document.getElementById('schoolActionsModal').classList.remove('hidden');
}

function closeSchoolActionsModal() {
    document.getElementById('schoolActionsModal').classList.add('hidden');
    currentSchoolData = null;
}

async function extendSubscription(plan) {
    if (!currentSchoolData) return;
    
    const clubId = currentSchoolData.clubId;
    
    try {
        showToast('⏳ Extendiendo suscripción...');
        
        // Calcular nueva fecha
        const currentEndDate = new Date(currentSchoolData.endDate);
        const now = new Date();
        const baseDate = currentEndDate > now ? currentEndDate : now;
        
        const newEndDate = new Date(baseDate);
        if (plan === 'anual') {
            newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        } else {
            newEndDate.setMonth(newEndDate.getMonth() + 1);
        }
        
        // Actualizar historial
        const paymentHistory = currentSchoolData.paymentHistory || [];
        paymentHistory.push({
            date: new Date().toISOString(),
            plan: plan,
            action: 'extension',
            extendedBy: currentAdminData?.email || 'Super Admin'
        });
        
        const { db, doc, updateDoc } = window.firebaseAdmin;
        
        await updateDoc(doc(db, 'licenses', clubId), {
            endDate: newEndDate.toISOString(),
            status: 'activo',
            plan: plan,
            paymentHistory: paymentHistory,
            lastUpdated: new Date().toISOString()
        });
        
        closeSchoolActionsModal();
        await loadSchools();
        updateStats();
        
        showToast(`✅ Suscripción extendida hasta ${formatDate(newEndDate)}`);
        
    } catch (error) {
        console.error('Error al extender suscripción:', error);
        showToast('❌ Error al extender suscripción');
    }
}

async function toggleSchoolStatus() {
    if (!currentSchoolData) return;
    
    const clubId = currentSchoolData.clubId;
    const newStatus = currentSchoolData.status === 'activo' ? 'inactivo' : 'activo';
    
    if (!confirm(`¿${newStatus === 'activo' ? 'Activar' : 'Desactivar'} esta escuela?`)) return;
    
    try {
        showToast('⏳ Actualizando estado...');
        
        const { db, doc, updateDoc } = window.firebaseAdmin;
        
        await updateDoc(doc(db, 'licenses', clubId), {
            status: newStatus,
            lastUpdated: new Date().toISOString()
        });
        
        closeSchoolActionsModal();
        await loadSchools();
        updateStats();
        
        showToast(`✅ Escuela ${newStatus === 'activo' ? 'activada' : 'desactivada'}`);
        
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        showToast('❌ Error al cambiar estado');
    }
}

function sendReminderWhatsApp() {
    if (!currentSchoolData) return;
    sendReminderWhatsAppDirect(currentSchoolData.clubPhone, currentSchoolData.clubName);
}

function sendReminderWhatsAppDirect(phone, clubName) {
    if (!phone) {
        showToast('❌ Esta escuela no tiene teléfono registrado');
        return;
    }
    
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const message = `Hola ${clubName}! 👋\n\n` +
                   `Te recordamos que tu suscripción de *MY CLUB* está próxima a vencer.\n\n` +
                   `Para renovar tu licencia y seguir usando todas las funciones de la app, contáctanos.\n\n` +
                   `¡Gracias por confiar en MY CLUB! ⚽`;
    
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    
    showToast('✅ Abriendo WhatsApp...');
}

// ========================================
// INICIALIZACIÓN
// ========================================


console.log('✅ admin.js cargado correctamente');