// ========================================
// PANEL SUPER ADMIN - MY CLUB
// Gestión de licencias, escuelas y FACTURACIÓN
// ========================================

console.log('🛡️ Cargando Panel Super Admin con Sistema de Facturación...');

// ========================================
// VARIABLES GLOBALES
// ========================================
let currentSchools = [];
let currentCodes = [];
let currentBilling = []; // 💰 NUEVO: Facturación
let currentSchoolData = null;
let currentInvoiceData = null; // 💰 NUEVO: Factura actual

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

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
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

function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `FAC-${year}-${random}`;
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
let dataLoaded = false;

document.getElementById('adminLoginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    
    try {
        showToast('⏳ Verificando credenciales...');
        
        const { signInWithEmailAndPassword, auth } = window.firebaseAdmin;
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        showToast('⏳ Verificando permisos...');
        const verification = await verifySuperAdmin(user.uid);
        
        if (!verification.isValid) {
            const { signOut } = window.firebaseAdmin;
            await signOut(auth);
            showToast('❌ No tienes permisos de administrador');
            return;
        }
        
        currentAdminData = verification.data;
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
    
    const displayText = currentAdminData?.displayName || currentAdminData?.email || 'Super Admin';
    document.getElementById('adminUserEmail').textContent = displayText;
    
    if (!dataLoaded) {
        dataLoaded = true;
        loadAllData();
    }
}

// ✅ NUEVO: Eliminar código de activación
async function deleteCode(codeId) {
    if (!confirm(`¿Eliminar el código "${codeId}"?\n\nEsta acción no se puede deshacer.`)) return;

    try {
        showToast('🗑️ Eliminando código...');
        const { db, doc, deleteDoc } = window.firebaseAdmin;
        await deleteDoc(doc(db, 'activation_codes', codeId));
        await loadCodes();
        updateStats();
        showToast('✅ Código eliminado');
    } catch (error) {
        console.error('Error al eliminar código:', error);
        showToast('❌ Error al eliminar código');
    }
}

// ✅ NUEVO: Eliminar factura
async function deleteInvoice(paymentId) {
    if (!confirm('¿Eliminar esta factura permanentemente?\n\nEsta acción no se puede deshacer.')) return;

    try {
        showToast('🗑️ Eliminando factura...');
        const { db, doc, deleteDoc } = window.firebaseAdmin;
        await deleteDoc(doc(db, 'billing', paymentId));
        await loadBilling();
        updateStats();
        showToast('✅ Factura eliminada');
    } catch (error) {
        console.error('Error al eliminar factura:', error);
        showToast('❌ Error al eliminar factura');
    }
}

// ✅ NUEVO: Filtrar escuelas al hacer clic en una card
let activeCardFilter = null;

function filterByCard(filterType) {
    // Si ya está activo ese filtro, desactivar (mostrar todos)
    if (activeCardFilter === filterType) {
        activeCardFilter = null;
        resetCardStyles();
        renderSchoolsTable();
        showToast('📋 Mostrando todas las escuelas');
        return;
    }

    activeCardFilter = filterType;
    resetCardStyles();

    // Resaltar card activa
    const card = document.getElementById(`card_${filterType}`);
    if (card) {
        card.classList.add('ring-4', 'ring-white', 'ring-opacity-70', 'scale-105');
        card.style.transform = 'translateY(-4px)';
    }

    // Filtrar escuelas según el tipo
    let filtered = [];
    let label = '';

    switch (filterType) {
        case 'active':
            filtered = currentSchools.filter(s => s.status === 'activo');
            label = 'Escuelas activas';
            break;
        case 'inactive':
            filtered = currentSchools.filter(s => s.status === 'inactivo' || s.status === 'gracia');
            label = 'Escuelas inactivas';
            break;
        case 'expiring':
            filtered = currentSchools.filter(s => {
                const days = daysUntil(s.endDate);
                return days > 0 && days <= 7;
            });
            label = 'Próximas a vencer';
            break;
        case 'players':
            // Ordenar por más jugadores
            filtered = [...currentSchools].sort((a, b) => (b.totalPlayers || 0) - (a.totalPlayers || 0));
            label = 'Ordenadas por jugadores';
            break;
        case 'codes':
            // No filtra escuelas, va a tab de códigos
            activeCardFilter = null;
            resetCardStyles();
            showTab('codes');
            return;
    }

    // Navegar a tab de escuelas y mostrar filtradas
    showTab('schools');

    const original = currentSchools;
    currentSchools = filtered;
    renderSchoolsTable();
    currentSchools = original;

    showToast(`🔍 ${label}: ${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`);
}

function resetCardStyles() {
    ['card_active', 'card_inactive', 'card_expiring', 'card_players', 'card_codes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('ring-4', 'ring-white', 'ring-opacity-70', 'scale-105');
            el.style.transform = '';
        }
    });
}

// ✅ NUEVO: Eliminar club completo con doble confirmación
async function deleteClub() {
    if (!currentSchoolData) return;

    const school = currentSchoolData;
    const clubName = school.clubName || school.clubId;
    const clubId = school.clubId;

    // Primera confirmación
    const first = confirm(`⚠️ ¿Estás seguro de que deseas ELIMINAR el club "${clubName}"?\n\nSe eliminará TODO:\n• Jugadores\n• Pagos\n• Eventos\n• Egresos\n• Usuarios\n• Configuración\n• Facturas\n• Licencia`);
    if (!first) { showToast('✅ Operación cancelada'); return; }

    // Segunda confirmación
    const second = confirm(`🔴 SEGUNDA CONFIRMACIÓN\n\n¿Confirmas eliminar PERMANENTEMENTE "${clubName}"?\n\nEsta acción NO se puede deshacer.\nSe borrarán TODOS los datos del club.`);
    if (!second) { showToast('✅ Operación cancelada'); return; }

    try {
        showToast('🗑️ Eliminando club completo...');

        const { db, doc, deleteDoc, getDocs, collection } = window.firebaseAdmin;

        // Función auxiliar para eliminar toda una subcolección
        const deleteSubcollection = async (path) => {
            try {
                const snapshot = await getDocs(collection(db, path));
                for (const d of snapshot.docs) {
                    await deleteDoc(d.ref);
                }
                console.log(`✅ ${path}: ${snapshot.size} documentos eliminados`);
            } catch (e) {
                console.warn(`⚠️ Error eliminando ${path}:`, e.message);
            }
        };

        // 1️⃣ Eliminar mapeos de usuarios (bloquear login primero)
        try {
            const usersSnapshot = await getDocs(collection(db, `clubs/${clubId}/users`));
            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                if (userData.email) {
                    try {
                        await deleteDoc(doc(db, 'userClubMapping', userData.email));
                    } catch (e) {
                        console.warn('No se pudo eliminar mapeo de:', userData.email);
                    }
                }
            }
            console.log('✅ Mapeos de usuarios eliminados');
        } catch (e) {
            console.warn('⚠️ Error eliminando mapeos:', e);
        }

        // 2️⃣ Eliminar todas las subcolecciones del club
        await deleteSubcollection(`clubs/${clubId}/players`);
        await deleteSubcollection(`clubs/${clubId}/payments`);
        await deleteSubcollection(`clubs/${clubId}/events`);
        await deleteSubcollection(`clubs/${clubId}/expenses`);
        await deleteSubcollection(`clubs/${clubId}/users`);
        await deleteSubcollection(`clubs/${clubId}/settings`);
        await deleteSubcollection(`clubs/${clubId}/config`);
        await deleteSubcollection(`clubs/${clubId}/parentCodes`);
        await deleteSubcollection(`clubs/${clubId}/thirdPartyIncomes`);
        await deleteSubcollection(`clubs/${clubId}/assets`);

        // 3️⃣ Eliminar documento principal del club
        try {
            await deleteDoc(doc(db, 'clubs', clubId));
            console.log('✅ Documento principal del club eliminado');
        } catch (e) {
            console.warn('⚠️ Error eliminando documento principal:', e.message);
        }

        // 4️⃣ Eliminar licencia
        try {
            await deleteDoc(doc(db, 'licenses', clubId));
            console.log('✅ Licencia eliminada');
        } catch (e) {
            console.warn('⚠️ Error eliminando licencia:', e.message);
        }

        // 5️⃣ Eliminar facturas del club
        try {
            const billingToDelete = currentBilling.filter(b => b.clubId === clubId);
            for (const bill of billingToDelete) {
                await deleteDoc(doc(db, 'billing', bill.id));
            }
            console.log(`✅ ${billingToDelete.length} facturas eliminadas`);
        } catch (e) {
            console.warn('⚠️ Error eliminando facturas:', e.message);
        }

        closeSchoolActionsModal();
        await loadAllData();

        showToast(`✅ Club "${clubName}" eliminado completamente`);
        console.log(`🗑️ Club ${clubId} eliminado completamente`);

    } catch (error) {
        console.error('❌ Error al eliminar club:', error);
        showToast('❌ Error al eliminar: ' + error.message);
    }
}

async function adminLogout() {
    if (confirm('¿Cerrar sesión?')) {
        try {
            const { signOut, auth } = window.firebaseAdmin;
            await signOut(auth);
            
            document.getElementById('adminPanel').classList.add('hidden');
            document.getElementById('loginScreen').classList.remove('hidden');
            
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
        loadCodes(),
        loadBilling() // 💰 NUEVO
    ]);
    
    updateStats();
    initBillingFilters(); // 💰 NUEVO
    
    showToast('✅ Datos cargados');
}

async function refreshData() {
    dataLoaded = false;
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
            
            try {
                console.log(`📊 Contando jugadores de: ${licenseData.clubName}`);
                
                const playersRef = collection(db, `clubs/${licenseData.clubId}/players`);
                const playersSnapshot = await getDocs(playersRef);
                const playerCount = playersSnapshot.size;
                
                licenseData.totalPlayers = playerCount;
                console.log(`✅ ${licenseData.clubName}: ${playerCount} jugadores`);
                
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

// 💰 NUEVO: Cargar facturación
async function loadBilling() {
    try {
        const { db, getDocs, collection, orderBy, query } = window.firebaseAdmin;
        const billingSnapshot = await getDocs(
            query(collection(db, 'billing'), orderBy('createdAt', 'desc'))
        );
        
        currentBilling = [];
        billingSnapshot.forEach(doc => {
            currentBilling.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('💰 Facturas cargadas:', currentBilling.length);
        renderBillingTable();
        
    } catch (error) {
        console.error('Error al cargar facturación:', error);
        // Si la colección no existe, iniciar vacía
        currentBilling = [];
        renderBillingTable();
    }
}

// ========================================
// ESTADÍSTICAS
// ========================================
function updateStats() {
    // Stats de escuelas
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
    
    // ✅ Total jugadores de todas las escuelas
    const totalPlayers = currentSchools.reduce((sum, s) => sum + (s.totalPlayers || 0), 0);
    const statTotalPlayers = document.getElementById('statTotalPlayers');
    if (statTotalPlayers) statTotalPlayers.textContent = totalPlayers;
    
    // 💰 Stats de facturación
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Ingresos del mes (solo pagados)
    const monthlyIncome = currentBilling
        .filter(b => {
            const date = new Date(b.paymentDate || b.createdAt);
            return date.getMonth() === currentMonth && 
                   date.getFullYear() === currentYear && 
                   b.status === 'pagado';
        })
        .reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
    
    // Ingresos del año (solo pagados)
    const yearlyIncome = currentBilling
        .filter(b => {
            const date = new Date(b.paymentDate || b.createdAt);
            return date.getFullYear() === currentYear && b.status === 'pagado';
        })
        .reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
    
    // Pagos pendientes
    const pendingPayments = currentBilling.filter(b => b.status === 'pendiente').length;
    
    // Total facturas
    const totalInvoices = currentBilling.length;
    
    document.getElementById('statMonthlyIncome').textContent = formatCurrency(monthlyIncome);
    document.getElementById('statYearlyIncome').textContent = formatCurrency(yearlyIncome);
    document.getElementById('statPendingPayments').textContent = pendingPayments;
    document.getElementById('statTotalInvoices').textContent = totalInvoices;
}

// ========================================
// TABS
// ========================================
function showTab(tab) {
    // Ocultar todas las secciones
    document.getElementById('schoolsSection').classList.add('hidden');
    document.getElementById('codesSection').classList.add('hidden');
    document.getElementById('alertsSection').classList.add('hidden');
    document.getElementById('billingSection').classList.add('hidden'); // 💰 NUEVO
    
    // Resetear tabs
    const tabs = ['tabSchools', 'tabCodes', 'tabAlerts', 'tabBilling'];
    tabs.forEach(tabId => {
        const el = document.getElementById(tabId);
        if (el) {
            el.classList.remove('bg-teal-600', 'text-white');
            el.classList.add('bg-gray-700', 'text-gray-300');
        }
    });
    
    // Mostrar sección seleccionada
    const sectionMap = {
        'schools': 'schoolsSection',
        'codes': 'codesSection',
        'alerts': 'alertsSection',
        'billing': 'billingSection'
    };
    
    const tabMap = {
        'schools': 'tabSchools',
        'codes': 'tabCodes',
        'alerts': 'tabAlerts',
        'billing': 'tabBilling'
    };
    
    document.getElementById(sectionMap[tab]).classList.remove('hidden');
    const activeTab = document.getElementById(tabMap[tab]);
    activeTab.classList.add('bg-teal-600', 'text-white');
    activeTab.classList.remove('bg-gray-700', 'text-gray-300');
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
                    <div>
                        <p class="text-white">${formatDate(school.endDate)}</p>
                        <p class="text-xs text-gray-400">${days > 0 ? days + ' días' : 'Vencido'}</p>
                    </div>
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
                    <div class="flex gap-2">
                    ${!code.used && !isExpired ? `
                        <button onclick="copyCode('${code.id}')" 
                                class="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded text-sm">
                            Copiar
                        </button>
                    ` : ''}
                    <button onclick="deleteCode('${code.id}')" 
                            class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderAlerts() {
    const alertsList = document.getElementById('alertsList');
    const noMessage = document.getElementById('noAlertsMessage');
    
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

// 💰 NUEVO: Renderizar tabla de facturación
function renderBillingTable(filteredBilling = null) {
    const tbody = document.getElementById('billingTableBody');
    const noMessage = document.getElementById('noBillingMessage');
    
    const billingToRender = filteredBilling || currentBilling;
    
    if (billingToRender.length === 0) {
        tbody.innerHTML = '';
        noMessage.classList.remove('hidden');
        return;
    }
    
    noMessage.classList.add('hidden');
    
    tbody.innerHTML = billingToRender.map(bill => {
        let statusBadge, statusColor;
        
        if (bill.status === 'pagado') {
            statusBadge = '✅ Pagado';
            statusColor = 'bg-green-900 text-green-300';
        } else if (bill.status === 'pendiente') {
            statusBadge = '⏳ Pendiente';
            statusColor = 'bg-yellow-900 text-yellow-300';
        } else {
            statusBadge = '❌ Vencido';
            statusColor = 'bg-red-900 text-red-300';
        }
        
        const methodLabels = {
            'transferencia': '🏦 Transferencia',
            'efectivo': '💵 Efectivo',
            'nequi': '📱 Nequi',
            'daviplata': '📱 Daviplata',
            'pse': '🔗 PSE',
            'tarjeta': '💳 Tarjeta',
            'otro': '📝 Otro'
        };
        
        const conceptLabels = {
            'licencia_anual': 'Licencia Anual',
            'licencia_mensual': 'Licencia Mensual',
            'renovacion_anual': 'Renovación Anual',
            'renovacion_mensual': 'Renovación Mensual',
            'otro': bill.customConcept || 'Otro'
        };
        
        return `
            <tr class="border-b border-gray-700 hover:bg-gray-750">
                <td class="py-4">
                    <code class="bg-gray-900 text-teal-400 px-2 py-1 rounded font-mono text-sm">${bill.invoiceNumber}</code>
                </td>
                <td class="py-4">
                    <div>
                        <p class="text-white font-medium">${bill.clubName || '-'}</p>
                        <p class="text-xs text-gray-400">${bill.clubId || ''}</p>
                    </div>
                </td>
                <td class="py-4 text-gray-300">${conceptLabels[bill.concept] || bill.concept}</td>
                <td class="py-4">
                    <span class="text-green-400 font-bold">${formatCurrency(bill.amount)}</span>
                </td>
                <td class="py-4 text-gray-300">${formatDate(bill.paymentDate || bill.createdAt)}</td>
                <td class="py-4 text-gray-300">${methodLabels[bill.method] || bill.method}</td>
                <td class="py-4">
                    <span class="${statusColor} px-3 py-1 rounded-full text-xs font-medium">
                        ${statusBadge}
                    </span>
                </td>
                <td class="py-4">
                    <div class="flex gap-2">
                        <button onclick="viewInvoice('${bill.id}')" 
                                class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                            <i data-lucide="eye" class="w-3 h-3"></i>
                            Ver
                        </button>
                        ${bill.status === 'pendiente' ? `
                            <button onclick="markAsPaid('${bill.id}')" 
                                    class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs">
                                Pagado
                            </button>
                        ` : ''}
                        <button onclick="deleteInvoice('${bill.id}')" 
                                class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                            <i data-lucide="trash-2" class="w-3 h-3"></i>
                        </button>
                    </div>
                </td>
            </tr>
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
    
    const original = currentSchools;
    currentSchools = filtered;
    renderSchoolsTable();
    currentSchools = original;
}

// 💰 NUEVO: Filtros de facturación
function initBillingFilters() {
    // Llenar selector de años
    const yearSelect = document.getElementById('billingFilterYear');
    const currentYear = new Date().getFullYear();
    
    yearSelect.innerHTML = `<option value="all">Todos los años</option>`;
    for (let year = currentYear; year >= currentYear - 5; year--) {
        yearSelect.innerHTML += `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`;
    }
}

function filterBilling() {
    const month = document.getElementById('billingFilterMonth').value;
    const year = document.getElementById('billingFilterYear').value;
    const status = document.getElementById('billingFilterStatus').value;
    const search = document.getElementById('billingSearch').value.toLowerCase();
    
    const filtered = currentBilling.filter(bill => {
        const date = new Date(bill.paymentDate || bill.createdAt);
        
        const matchMonth = month === 'all' || date.getMonth() === parseInt(month);
        const matchYear = year === 'all' || date.getFullYear() === parseInt(year);
        const matchStatus = status === 'all' || bill.status === status;
        const matchSearch = !search || 
            (bill.clubName || '').toLowerCase().includes(search) ||
            (bill.invoiceNumber || '').toLowerCase().includes(search);
        
        return matchMonth && matchYear && matchStatus && matchSearch;
    });
    
    renderBillingTable(filtered);
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
        
        document.getElementById('generatedCodeDisplay').textContent = code;
        document.getElementById('codeGeneratedModal').classList.remove('hidden');
        
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
    
    // Historial de pagos - combinar paymentHistory de licencia + billing
    const historyList = document.getElementById('paymentHistoryList');
    const clubBilling = currentBilling.filter(b => b.clubId === clubId);
    
    if (clubBilling.length > 0 || (school.paymentHistory && school.paymentHistory.length > 0)) {
        let historyHtml = '';
        
        // Pagos de billing
        clubBilling.forEach(payment => {
            historyHtml += `
                <div class="bg-gray-600 rounded-lg p-3 text-sm">
                    <div class="flex justify-between">
                        <span class="text-green-400 font-medium">${formatCurrency(payment.amount)}</span>
                        <span class="text-white">${formatDate(payment.paymentDate || payment.createdAt)}</span>
                    </div>
                    <p class="text-gray-400 text-xs mt-1">${payment.concept} - ${payment.status}</p>
                </div>
            `;
        });
        
        // Historial antiguo de licencia
        if (school.paymentHistory) {
            school.paymentHistory.forEach(payment => {
                historyHtml += `
                    <div class="bg-gray-600 rounded-lg p-3 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-300">${payment.action === 'activation' ? '🎟️ Activación' : '🔄 Renovación'}</span>
                            <span class="text-white">${formatDate(payment.date)}</span>
                        </div>
                        <p class="text-gray-400 text-xs mt-1">${payment.plan}</p>
                    </div>
                `;
            });
        }
        
        historyList.innerHTML = historyHtml;
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
    lucide.createIcons();
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
        
        const currentEndDate = new Date(currentSchoolData.endDate);
        const now = new Date();
        const baseDate = currentEndDate > now ? currentEndDate : now;
        
        const newEndDate = new Date(baseDate);
        if (plan === 'anual') {
            newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        } else {
            newEndDate.setMonth(newEndDate.getMonth() + 1);
        }
        
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

// ✅ NUEVO: Mostrar modal de fecha personalizada
function showCustomDateModal() {
    if (!currentSchoolData) return;
    
    // Establecer fecha mínima como hoy
    const today = new Date().toISOString().split('T')[0];
    const customDateInput = document.getElementById('customRenewalDate');
    if (customDateInput) {
        customDateInput.min = today;
        // Prellenar con la fecha actual de vencimiento + 1 año como sugerencia
        const suggested = new Date(currentSchoolData.endDate || new Date());
        suggested.setFullYear(suggested.getFullYear() + 1);
        customDateInput.value = suggested.toISOString().split('T')[0];
    }
    
    document.getElementById('customDateModal').classList.remove('hidden');
}

function closeCustomDateModal() {
    document.getElementById('customDateModal').classList.add('hidden');
}

async function extendToCustomDate() {
    if (!currentSchoolData) return;
    
    const dateInput = document.getElementById('customRenewalDate');
    const customDate = dateInput?.value;
    
    if (!customDate) {
        showToast('❌ Selecciona una fecha válida');
        return;
    }
    
    const newEndDate = new Date(customDate);
    const now = new Date();
    
    if (newEndDate <= now) {
        showToast('❌ La fecha debe ser futura');
        return;
    }
    
    const clubId = currentSchoolData.clubId;
    
    try {
        showToast('⏳ Actualizando fecha...');
        
        const paymentHistory = currentSchoolData.paymentHistory || [];
        paymentHistory.push({
            date: new Date().toISOString(),
            plan: 'personalizado',
            action: 'custom_extension',
            newEndDate: newEndDate.toISOString(),
            extendedBy: currentAdminData?.email || 'Super Admin'
        });
        
        const { db, doc, updateDoc } = window.firebaseAdmin;
        
        await updateDoc(doc(db, 'licenses', clubId), {
            endDate: newEndDate.toISOString(),
            status: 'activo',
            paymentHistory: paymentHistory,
            lastUpdated: new Date().toISOString()
        });
        
        closeCustomDateModal();
        closeSchoolActionsModal();
        await loadSchools();
        updateStats();
        
        showToast(`✅ Licencia extendida hasta ${formatDate(newEndDate)}`);
        
    } catch (error) {
        console.error('Error al extender con fecha personalizada:', error);
        showToast('❌ Error al actualizar la fecha');
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
// 💰 SISTEMA DE FACTURACIÓN - NUEVO
// ========================================

// Mostrar modal de nuevo pago
function showNewPaymentModal() {
    const form = document.getElementById('newPaymentForm');
    form.reset();
    
    // Llenar selector de clubs
    const clubSelect = document.getElementById('paymentClubId');
    clubSelect.innerHTML = '<option value="">Seleccionar club...</option>';
    currentSchools.forEach(school => {
        clubSelect.innerHTML += `<option value="${school.clubId}" data-name="${school.clubName}">${school.clubName || school.clubId}</option>`;
    });
    
    // Establecer fecha de hoy
    document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
    
    // Manejar cambio de concepto
    document.getElementById('paymentConcept').addEventListener('change', function() {
        const customDiv = document.getElementById('customConceptDiv');
        if (this.value === 'otro') {
            customDiv.classList.remove('hidden');
        } else {
            customDiv.classList.add('hidden');
        }
    });
    
    document.getElementById('newPaymentModal').classList.remove('hidden');
    lucide.createIcons();
}

// Mostrar modal de nuevo pago desde escuela específica
function showNewPaymentModalForSchool() {
    if (!currentSchoolData) return;
    
    showNewPaymentModal();
    
    // Pre-seleccionar la escuela
    setTimeout(() => {
        document.getElementById('paymentClubId').value = currentSchoolData.clubId;
    }, 100);
    
    closeSchoolActionsModal();
}

function closeNewPaymentModal() {
    document.getElementById('newPaymentModal').classList.add('hidden');
}

// Guardar nuevo pago
document.getElementById('newPaymentForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const clubId = document.getElementById('paymentClubId').value;
    const concept = document.getElementById('paymentConcept').value;
    const customConcept = document.getElementById('paymentCustomConcept').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const paymentDate = document.getElementById('paymentDate').value;
    const method = document.getElementById('paymentMethod').value;
    const status = document.getElementById('paymentStatus').value;
    const autoRenew = document.getElementById('autoRenewLicense').checked;
    const notes = document.getElementById('paymentNotes').value;
    
    if (!clubId) {
        showToast('❌ Selecciona un club');
        return;
    }
    
    if (!amount || amount <= 0) {
        showToast('❌ Ingresa un monto válido');
        return;
    }
    
    // Obtener datos del club
    const club = currentSchools.find(s => s.clubId === clubId);
    
    try {
        showToast('⏳ Guardando pago...');
        
        const { db, doc, setDoc, updateDoc, collection } = window.firebaseAdmin;
        
        const invoiceNumber = generateInvoiceNumber();
        const paymentId = `payment_${Date.now()}`;
        
        const paymentData = {
            invoiceNumber: invoiceNumber,
            clubId: clubId,
            clubName: club?.clubName || clubId,
            clubPhone: club?.clubPhone || '',
            concept: concept,
            customConcept: customConcept,
            amount: amount,
            paymentDate: paymentDate,
            method: method,
            status: status,
            notes: notes,
            autoRenew: autoRenew,
            createdAt: new Date().toISOString(),
            createdBy: currentAdminData?.email || 'Super Admin'
        };
        
        // Guardar en colección billing
        await setDoc(doc(db, 'billing', paymentId), paymentData);
        
        // Si está marcado como pagado y autoRenew está activo, extender licencia
        if (status === 'pagado' && autoRenew && club) {
            const currentEndDate = new Date(club.endDate);
            const now = new Date();
            const baseDate = currentEndDate > now ? currentEndDate : now;
            
            const newEndDate = new Date(baseDate);
            
            // Determinar extensión según concepto
            if (concept.includes('anual')) {
                newEndDate.setFullYear(newEndDate.getFullYear() + 1);
            } else if (concept.includes('mensual')) {
                newEndDate.setMonth(newEndDate.getMonth() + 1);
            }
            
            // Actualizar licencia
            const paymentHistory = club.paymentHistory || [];
            paymentHistory.push({
                date: new Date().toISOString(),
                plan: concept.includes('anual') ? 'anual' : 'mensual',
                action: 'payment',
                amount: amount,
                invoiceNumber: invoiceNumber,
                extendedBy: currentAdminData?.email || 'Super Admin'
            });
            
            await updateDoc(doc(db, 'licenses', clubId), {
                endDate: newEndDate.toISOString(),
                status: 'activo',
                plan: concept.includes('anual') ? 'anual' : 'mensual',
                paymentHistory: paymentHistory,
                lastUpdated: new Date().toISOString()
            });
            
            showToast(`✅ Pago registrado y licencia extendida hasta ${formatDate(newEndDate)}`);
        } else {
            showToast('✅ Pago registrado correctamente');
        }
        
        closeNewPaymentModal();
        
        // Recargar datos
        await Promise.all([loadBilling(), loadSchools()]);
        updateStats();
        
    } catch (error) {
        console.error('Error al guardar pago:', error);
        showToast('❌ Error al guardar pago');
    }
});

// Ver factura
function viewInvoice(paymentId) {
    const bill = currentBilling.find(b => b.id === paymentId);
    if (!bill) {
        showToast('❌ Factura no encontrada');
        return;
    }
    
    currentInvoiceData = bill;
    
    const conceptLabels = {
        'licencia_anual': 'Licencia Anual MY CLUB',
        'licencia_mensual': 'Licencia Mensual MY CLUB',
        'renovacion_anual': 'Renovación Anual MY CLUB',
        'renovacion_mensual': 'Renovación Mensual MY CLUB',
        'otro': bill.customConcept || 'Otro concepto'
    };
    
    const methodLabels = {
        'transferencia': 'Transferencia Bancaria',
        'efectivo': 'Efectivo',
        'nequi': 'Nequi',
        'daviplata': 'Daviplata',
        'pse': 'PSE',
        'tarjeta': 'Tarjeta Crédito/Débito',
        'otro': 'Otro'
    };
    
    const invoiceContent = document.getElementById('invoiceContent');
    invoiceContent.innerHTML = `
        <div class="max-w-xl mx-auto">
            <!-- Header -->
            <div class="text-center mb-8 border-b pb-6">
                <h1 class="text-3xl font-bold text-gray-800">⚽ MY CLUB</h1>
                <p class="text-gray-500">Sistema de Gestión de Escuelas de Fútbol</p>
            </div>
            
            <!-- Info Factura -->
            <div class="flex justify-between mb-8">
                <div>
                    <p class="text-sm text-gray-500">Factura Nº</p>
                    <p class="font-bold text-lg text-teal-600">${bill.invoiceNumber}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-500">Fecha</p>
                    <p class="font-medium">${formatDate(bill.paymentDate || bill.createdAt)}</p>
                </div>
            </div>
            
            <!-- Cliente -->
            <div class="bg-gray-100 rounded-lg p-4 mb-6">
                <p class="text-sm text-gray-500 mb-1">Cliente</p>
                <p class="font-bold text-lg">${bill.clubName}</p>
                <p class="text-gray-600">${bill.clubPhone || 'Sin teléfono'}</p>
            </div>
            
            <!-- Detalle -->
            <table class="w-full mb-6">
                <thead>
                    <tr class="border-b-2 border-gray-300">
                        <th class="text-left py-2 text-gray-600">Concepto</th>
                        <th class="text-right py-2 text-gray-600">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="border-b border-gray-200">
                        <td class="py-4">${conceptLabels[bill.concept] || bill.concept}</td>
                        <td class="py-4 text-right font-medium">${formatCurrency(bill.amount)}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr class="border-t-2 border-gray-300">
                        <td class="py-4 font-bold text-lg">TOTAL</td>
                        <td class="py-4 text-right font-bold text-lg text-teal-600">${formatCurrency(bill.amount)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <!-- Método de pago y estado -->
            <div class="flex justify-between mb-6 text-sm">
                <div>
                    <span class="text-gray-500">Método de pago:</span>
                    <span class="font-medium ml-2">${methodLabels[bill.method] || bill.method}</span>
                </div>
                <div>
                    <span class="text-gray-500">Estado:</span>
                    <span class="font-medium ml-2 ${bill.status === 'pagado' ? 'text-green-600' : 'text-yellow-600'}">
                        ${bill.status === 'pagado' ? '✅ PAGADO' : '⏳ PENDIENTE'}
                    </span>
                </div>
            </div>
            
            ${bill.notes ? `
                <div class="bg-yellow-50 rounded-lg p-4 mb-6">
                    <p class="text-sm text-gray-500 mb-1">Notas</p>
                    <p class="text-gray-700">${bill.notes}</p>
                </div>
            ` : ''}
            
            <!-- Footer -->
            <div class="text-center text-gray-400 text-sm mt-8 pt-6 border-t">
                <p>Gracias por confiar en MY CLUB</p>
                <p>Este documento es un comprobante de pago</p>
            </div>
        </div>
    `;
    
    document.getElementById('viewInvoiceModal').classList.remove('hidden');
}

function closeViewInvoiceModal() {
    document.getElementById('viewInvoiceModal').classList.add('hidden');
    currentInvoiceData = null;
}

// Descargar factura como PDF
function downloadInvoicePDF() {
    if (!currentInvoiceData) return;
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const bill = currentInvoiceData;
    
    const conceptLabels = {
        'licencia_anual': 'Licencia Anual MY CLUB',
        'licencia_mensual': 'Licencia Mensual MY CLUB',
        'renovacion_anual': 'Renovación Anual MY CLUB',
        'renovacion_mensual': 'Renovación Mensual MY CLUB',
        'otro': bill.customConcept || 'Otro concepto'
    };
    
    const methodLabels = {
        'transferencia': 'Transferencia Bancaria',
        'efectivo': 'Efectivo',
        'nequi': 'Nequi',
        'daviplata': 'Daviplata',
        'pse': 'PSE',
        'tarjeta': 'Tarjeta Credito/Debito',
        'otro': 'Otro'
    };
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(13, 148, 136); // Teal
    doc.text('MY CLUB', 105, 30, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Sistema de Gestion de Escuelas de Futbol', 105, 38, { align: 'center' });
    
    // Línea separadora
    doc.setDrawColor(200);
    doc.line(20, 45, 190, 45);
    
    // Info Factura
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Factura No:', 20, 55);
    doc.setTextColor(13, 148, 136);
    doc.setFontSize(14);
    doc.text(bill.invoiceNumber, 50, 55);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text('Fecha:', 140, 55);
    doc.setTextColor(0);
    doc.text(formatDate(bill.paymentDate || bill.createdAt), 160, 55);
    
    // Cliente
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 65, 170, 25, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Cliente:', 25, 73);
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(bill.clubName || 'Sin nombre', 25, 82);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(bill.clubPhone || 'Sin telefono', 25, 88);
    
    // Tabla de detalle
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Concepto', 20, 105);
    doc.text('Valor', 170, 105, { align: 'right' });
    
    doc.setDrawColor(200);
    doc.line(20, 108, 190, 108);
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(conceptLabels[bill.concept] || bill.concept, 20, 118);
    doc.text(formatCurrency(bill.amount), 170, 118, { align: 'right' });
    
    doc.line(20, 125, 190, 125);
    
    // Total
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL:', 20, 135);
    doc.setTextColor(13, 148, 136);
    doc.text(formatCurrency(bill.amount), 170, 135, { align: 'right' });
    
    // Método y estado
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Metodo de pago: ${methodLabels[bill.method] || bill.method}`, 20, 150);
    doc.text(`Estado: ${bill.status === 'pagado' ? 'PAGADO' : 'PENDIENTE'}`, 20, 158);
    
    // Notas
    if (bill.notes) {
        doc.setFillColor(255, 250, 230);
        doc.rect(20, 165, 170, 20, 'F');
        doc.setTextColor(100);
        doc.text('Notas:', 25, 173);
        doc.setTextColor(0);
        doc.text(bill.notes.substring(0, 80), 25, 180);
    }
    
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Gracias por confiar en MY CLUB', 105, 270, { align: 'center' });
    doc.text('Este documento es un comprobante de pago', 105, 277, { align: 'center' });
    
    // Descargar
    doc.save(`Factura_${bill.invoiceNumber}.pdf`);
    showToast('✅ PDF descargado');
}

// Compartir factura por WhatsApp
function shareInvoiceWhatsApp() {
    if (!currentInvoiceData) return;
    
    const bill = currentInvoiceData;
    
    const conceptLabels = {
        'licencia_anual': 'Licencia Anual MY CLUB',
        'licencia_mensual': 'Licencia Mensual MY CLUB',
        'renovacion_anual': 'Renovación Anual MY CLUB',
        'renovacion_mensual': 'Renovación Mensual MY CLUB',
        'otro': bill.customConcept || 'Otro concepto'
    };
    
    const message = `📄 *COMPROBANTE DE PAGO - MY CLUB*\n\n` +
        `🔢 Factura: *${bill.invoiceNumber}*\n` +
        `📅 Fecha: ${formatDate(bill.paymentDate || bill.createdAt)}\n\n` +
        `👤 Cliente: *${bill.clubName}*\n\n` +
        `📋 Concepto: ${conceptLabels[bill.concept] || bill.concept}\n` +
        `💰 Total: *${formatCurrency(bill.amount)}*\n\n` +
        `✅ Estado: ${bill.status === 'pagado' ? 'PAGADO' : 'PENDIENTE'}\n\n` +
        `¡Gracias por confiar en MY CLUB! ⚽`;
    
    const phone = bill.clubPhone ? bill.clubPhone.replace(/[^0-9]/g, '') : '';
    const url = phone 
        ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
    showToast('✅ Abriendo WhatsApp...');
}

// Marcar como pagado
async function markAsPaid(paymentId) {
    if (!confirm('¿Marcar este pago como PAGADO?')) return;
    
    const bill = currentBilling.find(b => b.id === paymentId);
    if (!bill) return;
    
    try {
        showToast('⏳ Actualizando...');
        
        const { db, doc, updateDoc } = window.firebaseAdmin;
        
        await updateDoc(doc(db, 'billing', paymentId), {
            status: 'pagado',
            paidAt: new Date().toISOString(),
            updatedBy: currentAdminData?.email || 'Super Admin'
        });
        
        // Si autoRenew estaba activo, extender licencia
        if (bill.autoRenew) {
            const club = currentSchools.find(s => s.clubId === bill.clubId);
            if (club) {
                const currentEndDate = new Date(club.endDate);
                const now = new Date();
                const baseDate = currentEndDate > now ? currentEndDate : now;
                
                const newEndDate = new Date(baseDate);
                
                if (bill.concept.includes('anual')) {
                    newEndDate.setFullYear(newEndDate.getFullYear() + 1);
                } else if (bill.concept.includes('mensual')) {
                    newEndDate.setMonth(newEndDate.getMonth() + 1);
                }
                
                await updateDoc(doc(db, 'licenses', bill.clubId), {
                    endDate: newEndDate.toISOString(),
                    status: 'activo',
                    lastUpdated: new Date().toISOString()
                });
                
                showToast(`✅ Pago marcado y licencia extendida hasta ${formatDate(newEndDate)}`);
            } else {
                showToast('✅ Pago marcado como pagado');
            }
        } else {
            showToast('✅ Pago marcado como pagado');
        }
        
        await Promise.all([loadBilling(), loadSchools()]);
        updateStats();
        
    } catch (error) {
        console.error('Error al actualizar pago:', error);
        showToast('❌ Error al actualizar');
    }
}

// Exportar reporte de facturación
function exportBillingReport() {
    if (currentBilling.length === 0) {
        showToast('❌ No hay datos para exportar');
        return;
    }
    
    const headers = ['Factura', 'Club', 'Concepto', 'Monto', 'Fecha', 'Método', 'Estado'];
    
    const conceptLabels = {
        'licencia_anual': 'Licencia Anual',
        'licencia_mensual': 'Licencia Mensual',
        'renovacion_anual': 'Renovación Anual',
        'renovacion_mensual': 'Renovación Mensual',
        'otro': 'Otro'
    };
    
    const rows = currentBilling.map(bill => [
        bill.invoiceNumber,
        bill.clubName,
        conceptLabels[bill.concept] || bill.concept,
        bill.amount,
        formatDate(bill.paymentDate || bill.createdAt),
        bill.method,
        bill.status
    ]);
    
    // Crear CSV
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });
    
    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Facturacion_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast('✅ Reporte exportado');
}

// ========================================
// INICIALIZACIÓN
// ========================================

console.log('✅ admin.js cargado correctamente con Sistema de Facturación 💰');