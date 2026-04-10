// ========================================
// GESTIÓN DE PAGOS UNIFICADA (INGRESOS + EGRESOS)
// ========================================

let currentPaymentTab = 'monthly';
let currentPaymentMode = 'ingreso'; // 'ingreso' o 'egreso'
// Variables para el buscador de jugadores
let selectedPlayerId = null;
let filteredPlayers = [];
// Variables para el filtro de fechas del historial
let historyDateFrom = null;
let historyDateTo = null;


// ========================================
// MODAL SELECTOR DE TIPO
// ========================================

// Mostrar modal selector
function showUnifiedPaymentModal() {
  document.getElementById('paymentTypeSelectorModal').classList.remove('hidden');
  lucide.createIcons();
}

// Cerrar modal selector
function closePaymentTypeSelectorModal() {
  document.getElementById('paymentTypeSelectorModal').classList.add('hidden');
}

function selectPaymentType(type) {
  currentPaymentMode = type;
  closePaymentTypeSelectorModal();
  
  if (type === 'ingreso') {
    showAddPaymentModal();
  } else if (type === 'egreso') {
    showAddExpenseModal();
  } else if (type === 'otroIngreso') {
    showAddThirdPartyIncomeModal();
  }
}

// ========================================
// TABS
// ========================================

// Mostrar tab de pagos
function showPaymentTab(tab) {
  currentPaymentTab = tab;
  
  // Actualizar botones
  ['monthly', 'extras', 'expenses', 'thirdParty', 'history'].forEach(t => {
    const btn = document.getElementById(`${t}Tab`);
    if (btn) {
      if (t === tab) {
        btn.classList.add('bg-teal-600', 'text-white');
        btn.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
      } else {
        btn.classList.remove('bg-teal-600', 'text-white');
        btn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
      }
    }
  });
  
  document.getElementById('monthlyPaymentsContent').classList.add('hidden');
  document.getElementById('extrasPaymentsContent').classList.add('hidden');
  document.getElementById('expensesPaymentsContent').classList.add('hidden');
  document.getElementById('thirdPartyIncomesContent')?.classList.add('hidden');
  document.getElementById('historyPaymentsContent').classList.add('hidden');

  // Mostrar el tab activo
  const contentMap = { monthly: 'monthlyPaymentsContent', extras: 'extrasPaymentsContent',
    expenses: 'expensesPaymentsContent', thirdParty: 'thirdPartyIncomesContent', history: 'historyPaymentsContent' };
  const activeContent = document.getElementById(contentMap[tab]);
  if (activeContent) activeContent.classList.remove('hidden');

  // Ocultar el banner de "Ver historial completo" si ya se cargó todo
  if (tab === 'history') {
    const banner = document.getElementById('loadHistoryBanner');
    if (banner && localStorage.getItem('paymentsFullHistory') === 'true') {
      banner.classList.add('hidden');
    }
  }

  renderPayments();
}

// ========================================
// MODAL DE PAGO (INGRESO) - VERSIÓN CORREGIDA
// ========================================

// Mostrar modal agregar pago - VERSIÓN CORREGIDA
function showAddPaymentModal() {
  console.log('🔵 Abriendo modal de pagos con buscador');
  
  try {
    // Resetear formulario
    const form = document.getElementById('paymentForm');
    if (form) form.reset();

    // Fecha de vencimiento = fin del mes actual (pago mensual), editable
    const dueDateInput = document.getElementById('paymentDueDate');
    if (dueDateInput) dueDateInput.value = getEndOfMonth();

    // Auto-concepto según tipo seleccionado
    autoFillNewConcept();
    
    const paymentId = document.getElementById('paymentId');
    if (paymentId) paymentId.value = '';
    
    // Mostrar campos de pago y auto-rellenar fecha de pago con hoy (siempre al abrir)
    const paidContainer = document.getElementById('paidDateContainer');
    const methodContainer = document.getElementById('paymentMethodContainer');
    if (paidContainer) paidContainer.classList.remove('hidden');
    if (methodContainer) methodContainer.classList.remove('hidden');
    const paidDateInput = document.getElementById('paymentPaidDate');
    if (paidDateInput) paidDateInput.value = getCurrentDate();
    
    // Resetear buscador
    selectedPlayerId = null;
    
    const searchInput = document.getElementById('playerSearchInput');
    if (searchInput) {
      searchInput.value = '';
    } else {
      console.warn('⚠️ playerSearchInput no encontrado');
    }
    
    const selectedName = document.getElementById('selectedPlayerName');
    if (selectedName) {
      selectedName.textContent = '';
    } else {
      console.warn('⚠️ selectedPlayerName no encontrado');
    }
    
    const selectedDisplay = document.getElementById('selectedPlayerDisplay');
    if (selectedDisplay) {
      selectedDisplay.classList.add('hidden');
    } else {
      console.warn('⚠️ selectedPlayerDisplay no encontrado');
    }
    
    // Cargar jugadores
    const allPlayers = getActivePlayers();
    console.log(`📋 Cargando ${allPlayers.length} jugadores`);
    renderPlayerSearchResults(allPlayers);
    
    // Mostrar modal
    const modal = document.getElementById('paymentModal');
    if (modal) {
      modal.classList.remove('hidden');
      console.log('✅ Modal de pagos mostrado');
    } else {
      console.error('❌ Modal paymentModal no encontrado en el DOM');
      return;
    }
    
    // Auto-focus en el input de búsqueda
    setTimeout(() => {
      const searchInput = document.getElementById('playerSearchInput');
      if (searchInput) {
        searchInput.focus();
      }
    }, 100);
    
    // Recrear iconos
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
    
  } catch (error) {
    console.error('❌ Error al abrir modal de pagos:', error);
    showToast('❌ Error al abrir el formulario');
  }
}

// Cerrar modal pago
function closePaymentModal() {
  console.log('🔴 Cerrando modal de pagos');
  const modal = document.getElementById('paymentModal');
  if (modal) {
    modal.classList.add('hidden');
    console.log('✅ Modal cerrado');
  } else {
    console.error('❌ Modal paymentModal no encontrado');
  }
}

// Hacer funciones globales
window.showAddPaymentModal = showAddPaymentModal;
window.closePaymentModal = closePaymentModal;

console.log('✅ Funciones de modal de pagos cargadas');
// Mostrar/ocultar campos según estado
document.getElementById('paymentStatus')?.addEventListener('change', function() {
  const status = this.value;

  // La fecha de pago siempre se muestra y mantiene su valor
  // Solo el método de pago se oculta si el estado es Pendiente
  if (status === 'Pagado') {
    document.getElementById('paymentMethodContainer').classList.remove('hidden');
  } else {
    document.getElementById('paymentMethodContainer').classList.add('hidden');
  }
});


// ========================================
// RENDERIZADO
// ========================================

// Renderizar pagos
// Renderizar pagos
function renderPayments() {
  const payments = getPayments();
  const expenses = getExpenses();
  const thirdPartyIncomes = getThirdPartyIncomes();
  
  // Ocultar TODOS los contenedores primero
  document.getElementById('monthlyPaymentsContent').classList.add('hidden');
  document.getElementById('extrasPaymentsContent').classList.add('hidden');
  document.getElementById('expensesPaymentsContent').classList.add('hidden');
  document.getElementById('thirdPartyIncomesContent')?.classList.add('hidden');
  document.getElementById('historyPaymentsContent').classList.add('hidden');
  
  // Mostrar el contenedor correcto y renderizar
  if (currentPaymentTab === 'monthly') {
    document.getElementById('monthlyPaymentsContent').classList.remove('hidden');
    renderMonthlyPayments(payments.filter(p => p.type === 'Mensualidad'));
  } else if (currentPaymentTab === 'extras') {
    document.getElementById('extrasPaymentsContent').classList.remove('hidden');
    renderExtraPayments(payments.filter(p => p.type !== 'Mensualidad'));
  } else if (currentPaymentTab === 'expenses') {
    document.getElementById('expensesPaymentsContent').classList.remove('hidden');
    renderExpensesInPayments(expenses);
  } else if (currentPaymentTab === 'thirdParty') {
    document.getElementById('thirdPartyIncomesContent')?.classList.remove('hidden');
    renderThirdPartyIncomes(thirdPartyIncomes);
  } else if (currentPaymentTab === 'history') {
    document.getElementById('historyPaymentsContent').classList.remove('hidden');
    renderPaymentsHistory(payments, expenses);
    renderPaymentMovementLog();
  }
}
// Renderizar mensualidades
function renderMonthlyPayments(payments) {
  const container = document.getElementById('monthlyPaymentsContent');
  
  if (payments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💰</div>
        <p class="text-gray-500 dark:text-gray-400">No hay mensualidades registradas</p>
      </div>
    `;
    return;
  }
  
  // Ordenar por fecha de creación descendente (más reciente primero)
  const sorted = [...payments].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  container.innerHTML = sorted.map(payment => {
    const player = getPlayerById(payment.playerId);
    if (!player) return '';

    return renderPaymentCard(payment, player);
  }).join('');

  lucide.createIcons();
}

// Renderizar pagos extras
function renderExtraPayments(payments) {
  const container = document.getElementById('extrasPaymentsContent');

  if (payments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎽</div>
        <p class="text-gray-500 dark:text-gray-400">No hay pagos extras registrados</p>
      </div>
    `;
    return;
  }

  // Ordenar por fecha de creación descendente (más reciente primero)
  const sorted = [...payments].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  
  container.innerHTML = sorted.map(payment => {
    const player = getPlayerById(payment.playerId);
    if (!player) return '';
    
    return renderPaymentCard(payment, player);
  }).join('');
  
  lucide.createIcons();
}

// Renderizar egresos dentro de pagos
function renderExpensesInPayments(expenses) {
  const container = document.getElementById('expensesPaymentsContent');
  
  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💸</div>
        <p class="text-gray-500 dark:text-gray-400">No hay egresos registrados</p>
      </div>
    `;
    return;
  }
  
  const sorted = sortBy(expenses, 'date', 'desc');
  
  container.innerHTML = sorted.map(expense => renderExpenseCard(expense)).join('');
  
  lucide.createIcons();
}

// Renderizar card de pago (INGRESO)
function renderPaymentCard(payment, player) {
  const statusColor = payment.status === 'Pagado' 
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  
  const typeColors = {
    'Mensualidad': 'text-blue-600',
    'Uniforme': 'text-purple-600',
    'Torneo': 'text-yellow-600',
    'Equipamiento': 'text-green-600',
    'Otro': 'text-gray-600'
  };
  
  // 🆕 Información de auditoría
  const createdInfo = payment.createdBy ? formatAuditInfo(payment.createdBy) : '';
  const editedInfo = payment.editedBy ? formatAuditInfo(payment.editedBy) : '';
  
  return `
    <div class="glass-card rounded-xl p-4 shadow-sm animate-slide-in">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <img src="${player.avatar || getDefaultAvatar()}" alt="${player.name}" class="w-12 h-12 rounded-full object-cover">
          <div>
            <h3 class="font-bold text-gray-800 dark:text-white">${player.name}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">${player.category}</p>
          </div>
        </div>
        <span class="badge ${statusColor}">${payment.invoiceNumber ? payment.invoiceNumber : payment.status}</span>
      </div>
      
      <div class="space-y-2 mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="tag" class="w-4 h-4 ${typeColors[payment.type] || 'text-gray-600'}"></i>
          <span class="text-sm font-medium text-gray-800 dark:text-white">${payment.concept}</span>
        </div>
        <div class="flex items-center gap-2">
          <i data-lucide="dollar-sign" class="w-4 h-4 text-green-600"></i>
          <span class="text-lg font-bold text-gray-800 dark:text-white">${formatCurrency(payment.amount)}</span>
        </div>
        <div class="flex items-center gap-2">
          <i data-lucide="calendar" class="w-4 h-4 text-gray-600"></i>
          <span class="text-sm text-gray-600 dark:text-gray-400">
            ${payment.status === 'Pagado' ? 'Pagado:' : 'Vence:'} ${formatDate(payment.paidDate || payment.dueDate)}
          </span>
        </div>
        ${payment.invoiceNumber ? `
          <div class="flex items-center gap-2">
            <i data-lucide="file-text" class="w-4 h-4 text-teal-600"></i>
            <span class="text-sm font-medium text-teal-600 dark:text-teal-400">${payment.invoiceNumber}</span>
          </div>
        ` : ''}
        ${createdInfo ? `
          <div class="flex items-center gap-2">
            <i data-lucide="user-plus" class="w-4 h-4 text-blue-600"></i>
            <span class="text-xs text-gray-500 dark:text-gray-400">Creado: ${createdInfo}</span>
          </div>
        ` : ''}
        ${editedInfo ? `
          <div class="flex items-center gap-2">
            <i data-lucide="user-check" class="w-4 h-4 text-purple-600"></i>
            <span class="text-xs text-gray-500 dark:text-gray-400">Editado: ${editedInfo}</span>
          </div>
        ` : ''}
      </div>
      
      <div class="flex gap-2">
        ${payment.status === 'Pagado' ? `
          <button onclick="generateInvoicePDFWithWhatsApp('${payment.id}')" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
            <i data-lucide="file-text" class="w-4 h-4"></i>
            📄 Factura+WA
          </button>
        ` : `
          <button onclick="markAsPaid('${payment.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
            <i data-lucide="check" class="w-4 h-4"></i>
            Marcar Pagado
          </button>
        `}
        ${getCurrentUser()?.isMainAdmin ? `
        <button onclick="deletePaymentConfirm('${payment.id}')" class="bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded-lg">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
        ` : ''}
      </div>
    </div>
  `;
}


// ========================================
// 🆕 MODIFICAR EN payments.js: renderExpenseCard (línea ~360)
// Reemplazar toda la función
// ========================================

function renderExpenseCard(expense) {
  const categoryColors = {
    'Salarios': 'text-purple-600',
    'Servicios': 'text-blue-600',
    'Materiales': 'text-green-600',
    'Mantenimiento': 'text-yellow-600',
    'Impuestos': 'text-red-600',
    'Otro': 'text-gray-600'
  };
  
  // 🆕 Información de auditoría
  const createdInfo = expense.createdBy ? formatAuditInfo(expense.createdBy) : '';
  const editedInfo = expense.editedBy ? formatAuditInfo(expense.editedBy) : '';
  
  return `
    <div class="glass-card rounded-xl p-4 shadow-sm animate-slide-in border-l-4 border-red-500">
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="font-bold text-gray-800 dark:text-white">${expense.beneficiaryName}</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            ${expense.beneficiaryType === 'internal' ? '👤 Usuario interno' : '📦 Proveedor externo'}
          </p>
        </div>
        <span class="badge bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Egreso</span>
      </div>
      
      <div class="space-y-2 mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="tag" class="w-4 h-4 ${categoryColors[expense.category] || 'text-gray-600'}"></i>
          <span class="text-sm font-medium text-gray-800 dark:text-white">${expense.concept}</span>
        </div>
        <div class="flex items-center gap-2">
          <i data-lucide="dollar-sign" class="w-4 h-4 text-red-600"></i>
          <span class="text-lg font-bold text-red-600">${formatCurrency(expense.amount)}</span>
        </div>
        <div class="flex items-center gap-2">
          <i data-lucide="calendar" class="w-4 h-4 text-gray-600"></i>
          <span class="text-sm text-gray-600 dark:text-gray-400">Pagado: ${formatDate(expense.date)}</span>
        </div>
        <div class="flex items-center gap-2">
          <i data-lucide="file-text" class="w-4 h-4 text-teal-600"></i>
          <span class="text-sm font-medium text-teal-600 dark:text-teal-400">${expense.invoiceNumber}</span>
        </div>
        ${expense.beneficiaryPhone ? `
          <div class="flex items-center gap-2">
            <i data-lucide="phone" class="w-4 h-4 text-blue-600"></i>
            <span class="text-sm text-blue-600">${formatPhoneDisplay(expense.beneficiaryPhone)}</span>
          </div>
        ` : ''}
        ${createdInfo ? `
          <div class="flex items-center gap-2">
            <i data-lucide="user-plus" class="w-4 h-4 text-blue-600"></i>
            <span class="text-xs text-gray-500 dark:text-gray-400">Creado: ${createdInfo}</span>
          </div>
        ` : ''}
        ${editedInfo ? `
          <div class="flex items-center gap-2">
            <i data-lucide="user-check" class="w-4 h-4 text-purple-600"></i>
            <span class="text-xs text-gray-500 dark:text-gray-400">Editado: ${editedInfo}</span>
          </div>
        ` : ''}
      </div>
      
      <div class="flex gap-2">
        <button onclick="generateExpenseInvoicePDFWithWhatsApp('${expense.id}')" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
          <i data-lucide="file-text" class="w-4 h-4"></i>
          📄 Factura+WA
        </button>
        <button onclick="deleteExpenseConfirm('${expense.id}')" class="bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded-lg">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
}
// Marcar pago como pagado
async function markAsPaid(paymentId) {
  const payment = getPaymentById(paymentId);
  if (!payment) return;
  
  const invoiceNumber = await getNextInvoiceNumberFromFirebase();
  
  updatePayment(paymentId, {
    status: 'Pagado',
    paidDate: getCurrentDate(),
    invoiceNumber: invoiceNumber,
    method: 'Efectivo',
    editedBy: getAuditInfo() // 🆕 AUDITORÍA
  });
  
  showToast('✅ Pago marcado como pagado');

  // Mostrar modal de opción WhatsApp/PDF
  setTimeout(() => mostrarOpcionWAPayment(paymentId), 500);
  
  renderPayments();
  updateDashboard();
  updateNotifications();
}

// Renderizar historial completo (INGRESOS + EGRESOS)
function renderPaymentsHistory(payments, expenses) {
  const tbody = document.getElementById('paymentsHistoryTable');

  // Combinar pagos y egresos en una sola lista
  const allTransactions = [];

  payments.forEach(p => {
    const player = getPlayerById(p.playerId);
    if (player) {
      allTransactions.push({
        date: p.paidDate || p.dueDate,
        type: 'ingreso',
        name: player.name,
        concept: p.concept,
        amount: p.amount,
        status: p.status,
        method: p.method || '—'
      });
    }
  });

  expenses.forEach(e => {
    allTransactions.push({
      date: e.date,
      type: 'egreso',
      name: e.beneficiaryName,
      concept: e.concept,
      amount: -e.amount,
      status: 'Pagado',
      method: e.method || '—'
    });
  });

  // Ordenar por fecha descendente
  allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Aplicar filtro de fechas si está activo
  const filtered = allTransactions.filter(t => {
    if (historyDateFrom && t.date < historyDateFrom) return false;
    if (historyDateTo   && t.date > historyDateTo)   return false;
    return true;
  });

  // Mostrar resumen del período
  const summaryEl = document.getElementById('historyFilterSummary');
  if (summaryEl) {
    const totalIngresos = filtered.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount, 0);
    const totalEgresos  = filtered.filter(t => t.amount <  0).reduce((s, t) => s + Math.abs(t.amount), 0);
    summaryEl.textContent = filtered.length > 0
      ? `${filtered.length} registros — Ingresos: ${formatCurrency(totalIngresos)} | Egresos: ${formatCurrency(totalEgresos)}`
      : '';
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-gray-500 dark:text-gray-400">No hay registros para el período seleccionado</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const statusColor = t.type === 'ingreso'
      ? (t.status === 'Pagado' ? 'text-green-600' : 'text-red-600')
      : 'text-red-600';
    const amountColor = t.amount >= 0 ? 'text-green-600' : 'text-red-600';

    // Icono de método de pago
    const methodIcons = { 'Efectivo': '💵', 'Transferencia': '🏦', 'Tarjeta': '💳', 'Cheque': '📝' };
    const methodIcon = methodIcons[t.method] || '';

    return `
      <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
        <td class="py-3 text-gray-800 dark:text-white whitespace-nowrap">${formatDate(t.date)}</td>
        <td class="py-3 text-gray-800 dark:text-white">${t.name}</td>
        <td class="py-3 text-gray-800 dark:text-white">${t.concept}</td>
        <td class="py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">${methodIcon} ${t.method}</td>
        <td class="py-3 text-right font-medium ${amountColor}">${formatCurrency(Math.abs(t.amount))}</td>
        <td class="py-3 text-center">
          <span class="text-sm font-medium ${statusColor}">
            ${t.type === 'ingreso' ? '💰 ' + t.status : '💸 Egreso'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// Aplica un filtro rápido (hoy / esta semana / este mes / todo)
function setHistoryFilter(preset) {
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  // Resaltar botón activo
  document.querySelectorAll('.history-filter-btn').forEach(btn => {
    btn.classList.remove('bg-teal-600', 'text-white');
    btn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  });
  event.target.classList.add('bg-teal-600', 'text-white');
  event.target.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');

  if (preset === 'today') {
    historyDateFrom = fmt(today);
    historyDateTo   = fmt(today);
  } else if (preset === 'week') {
    const mon = new Date(today);
    mon.setDate(today.getDate() - today.getDay() + 1);
    historyDateFrom = fmt(mon);
    historyDateTo   = fmt(today);
  } else if (preset === 'month') {
    historyDateFrom = `${today.getFullYear()}-${pad(today.getMonth()+1)}-01`;
    historyDateTo   = fmt(today);
  } else {
    historyDateFrom = null;
    historyDateTo   = null;
  }

  // Sincronizar inputs de fecha
  const fromInput = document.getElementById('historyDateFrom');
  const toInput   = document.getElementById('historyDateTo');
  if (fromInput) fromInput.value = historyDateFrom || '';
  if (toInput)   toInput.value   = historyDateTo   || '';

  // Volver a renderizar con el filtro aplicado
  const payments = JSON.parse(localStorage.getItem('payments') || '[]');
  const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  renderPaymentsHistory(payments, expenses);
}

// Se llama cuando el usuario cambia los inputs de fecha manualmente
function applyHistoryDateFilter() {
  historyDateFrom = document.getElementById('historyDateFrom').value || null;
  historyDateTo   = document.getElementById('historyDateTo').value   || null;
  const payments = JSON.parse(localStorage.getItem('payments') || '[]');
  const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  renderPaymentsHistory(payments, expenses);
}

// Exportar los registros filtrados a PDF
function exportHistoryPDF() {
  if (typeof window.jspdf === 'undefined') {
    loadJsPDF(() => exportHistoryPDF());
    return;
  }

  const payments = JSON.parse(localStorage.getItem('payments') || '[]');
  const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
  const settings = getSchoolSettings();

  // Armar filas filtradas
  const rows = [];

  payments.forEach(p => {
    const player = getPlayerById(p.playerId);
    if (!player) return;
    const date = p.paidDate || p.dueDate;
    if (historyDateFrom && date < historyDateFrom) return;
    if (historyDateTo   && date > historyDateTo)   return;
    rows.push({ date, name: player.name, concept: p.concept, method: p.method || '—', amount: p.amount, tipo: 'Ingreso', status: p.status });
  });

  expenses.forEach(e => {
    if (historyDateFrom && e.date < historyDateFrom) return;
    if (historyDateTo   && e.date > historyDateTo)   return;
    rows.push({ date: e.date, name: e.beneficiaryName, concept: e.concept, method: e.method || '—', amount: e.amount, tipo: 'Egreso', status: 'Pagado' });
  });

  if (rows.length === 0) {
    showToast('No hay registros para exportar');
    return;
  }

  rows.sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalIngresos = rows.filter(r => r.tipo === 'Ingreso').reduce((s, r) => s + r.amount, 0);
  const totalEgresos  = rows.filter(r => r.tipo === 'Egreso').reduce((s, r) => s + r.amount, 0);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PRIMARY  = [13, 148, 136];
  const DARK     = [31, 41, 55];
  const GRAY     = [107, 114, 128];
  const LIGHT    = [243, 244, 246];
  const RED      = [220, 38, 38];
  const GREEN    = [22, 163, 74];

  // ── Encabezado ──
  try {
    if (settings.logo && settings.logo.startsWith('data:image')) {
      doc.addImage(settings.logo, 'PNG', 15, 12, 22, 22);
    }
  } catch (e) { /* sin logo */ }

  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY);
  doc.setFont(undefined, 'bold');
  doc.text(normalizeForPDF(settings.name || 'MI CLUB'), 42, 20);

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont(undefined, 'normal');
  doc.text('REPORTE DE HISTORIAL DE PAGOS', 42, 26);

  const periodoText = historyDateFrom || historyDateTo
    ? `Periodo: ${historyDateFrom || 'inicio'} → ${historyDateTo || 'hoy'}`
    : 'Periodo: completo';
  doc.text(periodoText, 42, 31);

  // Fecha de generación
  const now = new Date();
  const fechaGen = now.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.text(`Generado: ${fechaGen}`, 195, 20, { align: 'right' });

  // Línea separadora
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(15, 38, 195, 38);

  // ── Resumen ──
  let y = 46;
  doc.setFillColor(...LIGHT);
  doc.roundedRect(15, y, 180, 14, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...DARK);
  doc.text(`Total registros: ${rows.length}`, 20, y + 5.5);

  doc.setTextColor(...GREEN);
  doc.text(`Ingresos: ${formatCurrency(totalIngresos)}`, 80, y + 5.5);

  doc.setTextColor(...RED);
  doc.text(`Egresos: ${formatCurrency(totalEgresos)}`, 140, y + 5.5);

  doc.setTextColor(...DARK);
  doc.text(`Neto: ${formatCurrency(totalIngresos - totalEgresos)}`, 155, y + 10.5);

  // ── Tabla ──
  y += 20;

  // Cabecera de tabla
  const cols = [
    { label: 'Fecha',    x: 15,  w: 22 },
    { label: 'Jugador',  x: 37,  w: 45 },
    { label: 'Concepto', x: 82,  w: 48 },
    { label: 'Metodo',   x: 130, w: 25 },
    { label: 'Monto',    x: 155, w: 25 },
    { label: 'Tipo',     x: 180, w: 15 }
  ];

  doc.setFillColor(...PRIMARY);
  doc.rect(15, y, 180, 7, 'F');
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  cols.forEach(c => doc.text(c.label, c.x + 1, y + 5));

  y += 7;

  // Filas
  rows.forEach((r, i) => {
    // Salto de página si es necesario
    if (y > 270) {
      doc.addPage();
      y = 20;
      doc.setFillColor(...PRIMARY);
      doc.rect(15, y, 180, 7, 'F');
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      cols.forEach(c => doc.text(c.label, c.x + 1, y + 5));
      y += 7;
    }

    const rowH = 6.5;
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT);
      doc.rect(15, y, 180, rowH, 'F');
    }

    doc.setFont(undefined, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK);

    doc.text(r.date || '—',                            cols[0].x + 1, y + 4.5);
    doc.text(normalizeForPDF(r.name || '').substring(0, 22),  cols[1].x + 1, y + 4.5);
    doc.text(normalizeForPDF(r.concept || '').substring(0, 26), cols[2].x + 1, y + 4.5);
    doc.text(normalizeForPDF(r.method || '—'),          cols[3].x + 1, y + 4.5);

    // Monto con color
    doc.setTextColor(...(r.tipo === 'Ingreso' ? GREEN : RED));
    const signo = r.tipo === 'Egreso' ? '-' : '+';
    doc.text(`${signo} ${formatCurrency(r.amount)}`, cols[4].x + cols[4].w - 1, y + 4.5, { align: 'right' });

    doc.setTextColor(...(r.tipo === 'Ingreso' ? GREEN : RED));
    doc.text(r.tipo, cols[5].x + 1, y + 4.5);

    y += rowH;
  });

  // Firma automática
  if (typeof addSignatureToDocument === 'function') {
    addSignatureToDocument(doc, Math.min(y + 8, 270));
  }

  // Descargar
  const from = historyDateFrom || 'inicio';
  const to   = historyDateTo   || 'hoy';
  doc.save(`historial-pagos_${from}_${to}.pdf`);
  showToast('✅ PDF generado correctamente');
}

// Renderizar tabla de log de movimientos en el Historial
function renderPaymentMovementLog() {
  const tbody = document.getElementById('paymentMovementLogTable');
  if (!tbody) return;

  const log = typeof getPaymentLog === 'function' ? getPaymentLog() : [];

  if (log.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-gray-500 dark:text-gray-400">
          No hay movimientos registrados aún
        </td>
      </tr>`;
    return;
  }

  // Colores y emojis según la acción
  const actionStyle = {
    'Creado':     { color: 'text-green-600 dark:text-green-400',  emoji: '✅' },
    'Modificado': { color: 'text-blue-600 dark:text-blue-400',    emoji: '✏️' },
    'Anulado':    { color: 'text-red-600 dark:text-red-400',      emoji: '🚫' }
  };

  tbody.innerHTML = log.map((entry, i) => {
    const style = actionStyle[entry.action] || { color: 'text-gray-600', emoji: '•' };
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
    const timeStr = date.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
    const rowBg = i % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-700/30';

    return `
      <tr class="border-b border-gray-100 dark:border-gray-700 ${rowBg}">
        <td class="py-2 px-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">${dateStr} ${timeStr}</td>
        <td class="py-2 px-3 text-gray-700 dark:text-gray-300 font-mono text-xs">${entry.invoiceNumber}</td>
        <td class="py-2 px-3 text-gray-800 dark:text-white">${entry.playerName}</td>
        <td class="py-2 px-3 font-medium ${style.color}">${style.emoji} ${entry.action}</td>
        <td class="py-2 px-3 text-gray-600 dark:text-gray-400 text-xs">${entry.reason || '-'}</td>
        <td class="py-2 px-3 text-right font-medium text-gray-700 dark:text-gray-300">${formatCurrency(entry.amount)}</td>
        <td class="py-2 px-3 text-gray-500 dark:text-gray-400 text-xs">${entry.adminName}</td>
      </tr>`;
  }).join('');
}

// Eliminar pago — abre modal para pedir motivo de anulación (solo admin principal)
function deletePaymentConfirm(paymentId) {
  // Solo el admin principal puede anular facturas
  if (!getCurrentUser()?.isMainAdmin) {
    showToast('❌ Solo el administrador principal puede anular facturas');
    return;
  }
  const payment = getPayments().find(p => p.id === paymentId);
  if (!payment) return;

  const player = getPlayerById(payment.playerId);
  const playerName = player ? player.name : 'Jugador desconocido';

  // Guardar el ID para usarlo al confirmar
  window._pendingVoidPaymentId = paymentId;

  // Mostrar info del pago en el modal
  const info = document.getElementById('voidPaymentInfo');
  if (info) {
    info.textContent = `${payment.invoiceNumber || 'Sin factura'} · ${playerName} · ${formatCurrency(payment.amount || 0)}`;
  }

  // Resetear selects
  const select = document.getElementById('voidReasonSelect');
  const other = document.getElementById('voidReasonOther');
  if (select) select.value = '';
  if (other) { other.value = ''; other.classList.add('hidden'); }

  document.getElementById('voidPaymentModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function toggleVoidOtherReason() {
  const select = document.getElementById('voidReasonSelect');
  const other = document.getElementById('voidReasonOther');
  if (!select || !other) return;
  if (select.value === 'Otro') {
    other.classList.remove('hidden');
    other.focus();
  } else {
    other.classList.add('hidden');
  }
}

function closeVoidPaymentModal() {
  document.getElementById('voidPaymentModal').classList.add('hidden');
  window._pendingVoidPaymentId = null;
}

async function confirmVoidPayment() {
  const paymentId = window._pendingVoidPaymentId;
  if (!paymentId) return;

  const select = document.getElementById('voidReasonSelect');
  const other = document.getElementById('voidReasonOther');
  const reason = select?.value === 'Otro' ? (other?.value?.trim() || '') : (select?.value || '');

  if (!reason) {
    showToast('❌ Selecciona o escribe el motivo de anulación');
    return;
  }

  closeVoidPaymentModal();

  // Guardar en Firebase como factura anulada antes de eliminar
  const payment = getPayments().find(p => p.id === paymentId);
  if (payment && typeof saveVoidedPaymentToFirebase === 'function') {
    const player = getPlayerById(payment.playerId);
    await saveVoidedPaymentToFirebase({
      originalPaymentId: paymentId,
      invoiceNumber: payment.invoiceNumber || 'N/A',
      amount: payment.amount || 0,
      concept: payment.concept || payment.type || 'N/A',
      playerId: payment.playerId || '',
      playerName: player ? player.name : 'Desconocido',
      playerCategory: player ? player.category : 'N/A',
      voidedAt: new Date().toISOString(),
      voidedBy: (typeof getCurrentUser === 'function' ? getCurrentUser()?.name : null) || 'Admin',
      reason: reason
    });
  }

  // Registrar en el log de movimientos antes de eliminar
  if (payment) {
    const player = getPlayerById(payment.playerId);
    if (typeof addPaymentLogEntry === 'function') {
      addPaymentLogEntry({
        action: 'Anulado',
        invoiceNumber: payment.invoiceNumber || '-',
        playerName: player ? player.name : 'Desconocido',
        concept: payment.concept || payment.type || '-',
        amount: payment.amount || 0,
        adminName: (typeof getCurrentUser === 'function' && getCurrentUser()?.name) || 'Admin',
        reason: reason
      });
    }
  }

  deletePayment(paymentId);
  showToast('✅ Factura anulada y registrada');
  renderPayments();
  updateDashboard();
  updateNotifications();
}

// ========================================
// 🚀 AUTO-REDIRECT: PDF + WHATSAPP
// ========================================

// Generar factura con flujo automático (PDF + WhatsApp)
function generateInvoicePDFWithWhatsApp(paymentId) {
  // Si jsPDF no está cargado, generateInvoicePDF retorna null y lo descarga en paralelo.
  // En ese caso usamos loadJsPDF directamente para saber cuándo está listo y abrir WA.
  if (typeof window.jspdf === 'undefined') {
    showToast('⏳ Preparando PDF...');
    loadJsPDF(() => generateInvoicePDFWithWhatsApp(paymentId));
    return;
  }

  // jsPDF ya está cargado → generar PDF normalmente
  const pdfGenerated = generateInvoicePDF(paymentId, true);
  if (!pdfGenerated) return;

  const payment = getPaymentById(paymentId);
  if (!payment) return;

  const player = getPlayerById(payment.playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }

  // Verificar si tiene WhatsApp
  if (player.phone && player.phone.trim() !== '') {
    // Tiene WhatsApp → abrir directamente
    sendInvoiceWhatsApp(paymentId);
  } else {
    // NO tiene WhatsApp → pedir número manual
    showManualWhatsAppModal(paymentId, 'payment');
  }
}

// ========================================
// MODAL DE OPCIÓN WHATSAPP (igual al de inventario)
// ========================================

function mostrarOpcionWAPayment(paymentId) {
  const payment = getPaymentById(paymentId);
  if (!payment) return;

  const player    = getPlayerById(payment.playerId);
  const tieneWA   = !!(player?.phone && player.phone.trim() !== '');
  const nombre    = player?.name || 'Cliente';
  const telefono  = player?.phone || '';

  // Color del club configurado por el admin (fallback teal si no hay)
  const clubColor = getSchoolSettings()?.primaryColor || '#0d9488';

  // Eliminar overlay anterior si existe
  document.getElementById('waOverlayPayment')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'waOverlayPayment';
  overlay.className = 'fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4';

  overlay.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden">

      <!-- Header con color del club -->
      <div style="background: ${clubColor}" class="px-5 py-4 text-white">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div>
            <p class="font-bold text-sm">¡Pago registrado!</p>
            <p class="text-xs text-white/70">${payment.invoiceNumber || ''}</p>
          </div>
        </div>
      </div>

      <!-- Resumen -->
      <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Resumen</p>
        <div class="flex justify-between text-xs mb-1">
          <span class="text-gray-700 dark:text-gray-300">${nombre}</span>
          <span class="font-semibold text-gray-800 dark:text-white">${formatCurrency(payment.amount)}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">${payment.concept || ''}</div>
        <div class="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <span class="text-xs text-gray-400">${payment.method || ''}</span>
          <span class="font-bold text-sm" style="color:${clubColor}">${formatCurrency(payment.amount)}</span>
        </div>
      </div>

      <!-- Pregunta WhatsApp -->
      ${tieneWA ? `
      <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <p class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">¿Enviar recibo por WhatsApp?</p>
        <p class="text-xs text-gray-400">${nombre} · ${telefono}</p>
        <p class="text-xs text-gray-400 mt-0.5">El PDF se descargará automáticamente</p>
      </div>` : ''}

      <!-- Botones -->
      <div class="p-4 space-y-2">
        ${tieneWA ? `
        <button onclick="enviarWADesdeOverlayPayment('${paymentId}')"
          class="w-full bg-green-500 hover:bg-green-600 active:scale-95 text-white py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          Sí, enviar por WhatsApp
        </button>` : ''}

        <button onclick="soloDescargarPDFPayment('${paymentId}')"
          style="background:${clubColor}"
          class="w-full active:scale-95 text-white py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Solo descargar PDF
        </button>

        <button onclick="document.getElementById('waOverlayPayment').remove()"
          class="w-full text-gray-500 dark:text-gray-400 py-2 text-sm hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          Cerrar sin descargar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

function soloDescargarPDFPayment(paymentId) {
  document.getElementById('waOverlayPayment')?.remove();
  generateInvoicePDF(paymentId, true);
}

function enviarWADesdeOverlayPayment(paymentId) {
  document.getElementById('waOverlayPayment')?.remove();
  // Genera el PDF y luego abre WhatsApp
  generateInvoicePDF(paymentId, true);
  setTimeout(() => sendInvoiceWhatsApp(paymentId), 400);
}

console.log('✅ payments.js cargado (UNIFICADO CON AUTO-REDIRECT)');

// ========================================
// SISTEMA DE EDICIÓN COMPLETA DE FACTURAS
// Agregar este código a payments.js
// ========================================

// Mostrar modal de edición de pago
function showEditPaymentModal(paymentId) {
  const payment = getPaymentById(paymentId);
  if (!payment) {
    showToast('❌ Pago no encontrado');
    return;
  }
  
  const player = getPlayerById(payment.playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }
  
  // Crear modal dinámicamente si no existe
  let modal = document.getElementById('editPaymentModal');
  if (!modal) {
    modal = createEditPaymentModal();
    document.body.appendChild(modal);
  }
  
  // Llenar select de jugadores
  const players = getActivePlayers();
  const playerSelect = document.getElementById('editPaymentPlayer');
  playerSelect.innerHTML = '<option value="">Seleccionar jugador...</option>' + 
    players.map(p => `<option value="${p.id}" ${p.id === payment.playerId ? 'selected' : ''}>${p.name} - ${p.category}</option>`).join('');
  
  // Llenar formulario con datos actuales
  document.getElementById('editPaymentId').value = payment.id;
  document.getElementById('editPaymentType').value = payment.type;
  document.getElementById('editPaymentConcept').value = payment.concept;
  document.getElementById('editPaymentAmount').value = payment.amount;
  document.getElementById('editPaymentDueDate').value = payment.dueDate;
  document.getElementById('editPaymentStatus').value = payment.status;
  
  // Si está pagado, mostrar campos adicionales
  if (payment.status === 'Pagado') {
    document.getElementById('editPaidDateContainer').classList.remove('hidden');
    document.getElementById('editPaymentMethodContainer').classList.remove('hidden');
    document.getElementById('editPaymentPaidDate').value = payment.paidDate || getCurrentDate();
    document.getElementById('editPaymentMethod').value = payment.method || 'Efectivo';
  } else {
    document.getElementById('editPaidDateContainer').classList.add('hidden');
    document.getElementById('editPaymentMethodContainer').classList.add('hidden');
  }
  
  modal.classList.remove('hidden');
  
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// Crear modal de edición
function createEditPaymentModal() {
  const modal = document.createElement('div');
  modal.id = 'editPaymentModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
  
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <i data-lucide="edit-3" class="w-6 h-6 text-teal-600"></i>
          Editar Factura
        </h2>
        <button onclick="closeEditPaymentModal()" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <i data-lucide="x" class="w-6 h-6"></i>
        </button>
      </div>
      
      <form id="editPaymentForm" class="space-y-4">
        <input type="hidden" id="editPaymentId">
        
        <!-- Jugador (AHORA EDITABLE) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <i data-lucide="user" class="w-4 h-4 inline"></i>
            Jugador *
          </label>
          <select id="editPaymentPlayer" required
            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
            <option value="">Seleccionar jugador...</option>
          </select>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            ⚠️ Al cambiar el jugador, se reasignará esta factura
          </p>
        </div>
        
        <!-- Tipo de pago (EDITABLE) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <i data-lucide="tag" class="w-4 h-4 inline"></i>
            Tipo de Pago *
          </label>
          <select id="editPaymentType" required onchange="autoFillEditConcept()"
            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
            <option value="Mensualidad">💰 Mensualidad</option>
            <option value="Uniforme">👕 Uniforme</option>
            <option value="Torneo">🏆 Torneo</option>
            <option value="Equipamiento">⚽ Equipamiento</option>
            <option value="Otro">📋 Otro</option>
          </select>
        </div>
        
        <!-- Concepto -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <i data-lucide="file-text" class="w-4 h-4 inline"></i>
            Concepto *
          </label>
          <input type="text" id="editPaymentConcept" required
            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
            placeholder="Ej: Mensualidad Enero 2026">
        </div>
        
        <!-- Monto -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <i data-lucide="dollar-sign" class="w-4 h-4 inline"></i>
            Monto *
          </label>
          <input type="number" id="editPaymentAmount" required min="0" step="0.01"
            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
            placeholder="0.00">
        </div>
        
        <!-- Fecha de vencimiento -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <i data-lucide="calendar" class="w-4 h-4 inline"></i>
            Fecha de Vencimiento *
          </label>
          <input type="date" id="editPaymentDueDate" required
            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
        </div>
        
        <!-- Estado -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <i data-lucide="check-circle" class="w-4 h-4 inline"></i>
            Estado *
          </label>
          <select id="editPaymentStatus" required onchange="toggleEditPaidFields()"
            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
            <option value="Pendiente">⏳ Pendiente</option>
            <option value="Pagado">✅ Pagado</option>
          </select>
        </div>
        
        <!-- Fecha de pago (solo si está pagado) -->
        <div id="editPaidDateContainer" class="hidden">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <i data-lucide="calendar-check" class="w-4 h-4 inline"></i>
            Fecha de Pago *
          </label>
          <input type="date" id="editPaymentPaidDate"
            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
        </div>
        
        <!-- Método de pago (solo si está pagado) -->
        <div id="editPaymentMethodContainer" class="hidden">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <i data-lucide="credit-card" class="w-4 h-4 inline"></i>
            Método de Pago *
          </label>
          <select id="editPaymentMethod"
            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
            <option value="Efectivo">💵 Efectivo</option>
            <option value="Transferencia">🏦 Transferencia</option>
            <option value="Tarjeta">💳 Tarjeta</option>
            <option value="Cheque">📝 Cheque</option>
            <option value="Otro">📋 Otro</option>
          </select>
        </div>
        
        <!-- Alerta de cambios importantes -->
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <div class="flex items-start gap-2">
            <i data-lucide="alert-triangle" class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"></i>
            <div class="text-sm text-yellow-800 dark:text-yellow-200">
              <p class="font-medium mb-1">Nota importante:</p>
              <p>Los cambios quedarán registrados en el historial de auditoría.</p>
            </div>
          </div>
        </div>
        
        <!-- Botones -->
        <div class="flex gap-3 pt-4">
          <button type="button" onclick="closeEditPaymentModal()"
            class="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white py-3 rounded-lg font-medium">
            Cancelar
          </button>
          <button type="submit"
            class="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2">
            <i data-lucide="check" class="w-5 h-5"></i>
            Guardar y Continuar
          </button>
        </div>
      </form>
    </div>
  `;
  
  return modal;
}

// Devuelve el concepto sugerido según el tipo de pago
function getConceptoSugerido(type) {
  const mes = getMonthName(new Date().getMonth());
  const año = new Date().getFullYear();
  if (type === 'Mensualidad')  return `Mensualidad ${mes} ${año}`;
  if (type === 'Uniforme')     return 'Uniforme completo';
  if (type === 'Torneo')       return 'Inscripción torneo';
  if (type === 'Equipamiento') return 'Equipamiento deportivo';
  return '';
}

// Auto-completar concepto en formulario NUEVO (solo si está vacío)
function autoFillNewConcept() {
  const type    = document.getElementById('paymentType')?.value;
  const input   = document.getElementById('paymentConcept');
  if (!input || input.value.trim() !== '') return;
  input.value = getConceptoSugerido(type);
}

// Auto-completar concepto en formulario EDITAR (solo si está vacío)
function autoFillEditConcept() {
  const type  = document.getElementById('editPaymentType')?.value;
  const input = document.getElementById('editPaymentConcept');
  if (!input || input.value.trim() !== '') return;
  input.value = getConceptoSugerido(type);
}

// Toggle campos de pago según estado
function toggleEditPaidFields() {
  const status = document.getElementById('editPaymentStatus').value;
  
  if (status === 'Pagado') {
    document.getElementById('editPaidDateContainer').classList.remove('hidden');
    document.getElementById('editPaymentMethodContainer').classList.remove('hidden');
    
    // Auto-completar fecha actual si está vacía
    const paidDateInput = document.getElementById('editPaymentPaidDate');
    if (!paidDateInput.value) {
      paidDateInput.value = getCurrentDate();
    }
  } else {
    document.getElementById('editPaidDateContainer').classList.add('hidden');
    document.getElementById('editPaymentMethodContainer').classList.add('hidden');
  }
}

// Cerrar modal de edición
function closeEditPaymentModal() {
  const modal = document.getElementById('editPaymentModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Guardar cambios de edición
document.addEventListener('DOMContentLoaded', function() {
  // Usar delegación de eventos para el formulario dinámico
  document.body.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'editPaymentForm') {
      e.preventDefault();
      saveEditedPayment();
    }
  });
});

// Manejar submit del formulario de edición
async function saveEditedPayment() {
  const paymentId = document.getElementById('editPaymentId').value;
  const playerId = document.getElementById('editPaymentPlayer').value;
  const type = document.getElementById('editPaymentType').value;
  const concept = document.getElementById('editPaymentConcept').value;
  const amount = parseFloat(document.getElementById('editPaymentAmount').value);
  const dueDate = document.getElementById('editPaymentDueDate').value;
  const status = document.getElementById('editPaymentStatus').value;
  const paidDate = document.getElementById('editPaymentPaidDate').value;
  const method = document.getElementById('editPaymentMethod').value;
  
  // Validar jugador
  if (!playerId) {
    showToast('⚠️ Selecciona un jugador');
    return;
  }
  
  // Obtener pago original
  const originalPayment = getPaymentById(paymentId);
  if (!originalPayment) {
    showToast('❌ Error al obtener pago');
    return;
  }
  
  // Construir objeto de actualización
  const updateData = {
    playerId, // ✅ AHORA SE PUEDE CAMBIAR
    type,     // ✅ AHORA SE PUEDE CAMBIAR
    concept,
    amount,
    dueDate,
    status,
    paidDate: status === 'Pagado' ? paidDate : null,
    method: status === 'Pagado' ? method : null,
    editedBy: getAuditInfo()
  };
  
  // Si cambió a "Pagado" y no tenía número de factura, generar uno
  if (status === 'Pagado' && !originalPayment.invoiceNumber) {
    updateData.invoiceNumber = await getNextInvoiceNumberFromFirebase();
  }
  
  // Actualizar en base de datos
  updatePayment(paymentId, updateData);

  // Registrar modificación en el log de movimientos
  if (typeof addPaymentLogEntry === 'function') {
    const player = getPlayerById(playerId);
    addPaymentLogEntry({
      action: 'Modificado',
      invoiceNumber: originalPayment.invoiceNumber || updateData.invoiceNumber || '-',
      playerName: player ? player.name : 'Desconocido',
      concept: concept || '-',
      amount: amount || 0,
      adminName: (typeof getCurrentUser === 'function' && getCurrentUser()?.name) || 'Admin',
      reason: ''
    });
  }

  showToast('✅ Factura actualizada correctamente');
  closeEditPaymentModal();
  renderPayments();
  updateDashboard();
  updateNotifications();
  
  // Si está pagado, ofrecer generar PDF + WhatsApp
  if (status === 'Pagado') {
    setTimeout(() => {
      if (confirm('¿Deseas generar la factura PDF y enviarla por WhatsApp?')) {
        generateInvoicePDFWithWhatsApp(paymentId);
      }
    }, 500);
  }
}

// ========================================
// ACTUALIZACIÓN DE renderPaymentCard
// Reemplaza la función existente en payments.js
// ========================================

function renderPaymentCard(payment, player) {
  const statusColor = payment.status === 'Pagado' 
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  
  const typeColors = {
    'Mensualidad': 'text-blue-600',
    'Uniforme': 'text-purple-600',
    'Torneo': 'text-yellow-600',
    'Equipamiento': 'text-green-600',
    'Otro': 'text-gray-600'
  };
  
  const createdInfo = payment.createdBy ? formatAuditInfo(payment.createdBy) : '';
  const editedInfo = payment.editedBy ? formatAuditInfo(payment.editedBy) : '';
  
  return `
    <div class="glass-card rounded-xl p-4 shadow-sm animate-slide-in">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <img src="${player.avatar || getDefaultAvatar()}" alt="${player.name}" class="w-12 h-12 rounded-full object-cover">
          <div>
            <h3 class="font-bold text-gray-800 dark:text-white">${player.name}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">${player.category}</p>
          </div>
        </div>
        <span class="badge ${statusColor}">${payment.invoiceNumber ? payment.invoiceNumber : payment.status}</span>
      </div>
      
      <div class="space-y-2 mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="tag" class="w-4 h-4 ${typeColors[payment.type] || 'text-gray-600'}"></i>
          <span class="text-sm font-medium text-gray-800 dark:text-white">${payment.concept}</span>
        </div>
        <div class="flex items-center gap-2">
          <i data-lucide="dollar-sign" class="w-4 h-4 text-green-600"></i>
          <span class="text-lg font-bold text-gray-800 dark:text-white">${formatCurrency(payment.amount)}</span>
        </div>
        <div class="flex items-center gap-2">
          <i data-lucide="calendar" class="w-4 h-4 text-gray-600"></i>
          <span class="text-sm text-gray-600 dark:text-gray-400">
            ${payment.status === 'Pagado' ? 'Pagado:' : 'Vence:'} ${formatDate(payment.paidDate || payment.dueDate)}
          </span>
        </div>
        ${payment.invoiceNumber ? `
          <div class="flex items-center gap-2">
            <i data-lucide="file-text" class="w-4 h-4 text-teal-600"></i>
            <span class="text-sm font-medium text-teal-600 dark:text-teal-400">${payment.invoiceNumber}</span>
          </div>
        ` : ''}
        ${createdInfo ? `
          <div class="flex items-center gap-2">
            <i data-lucide="user-plus" class="w-4 h-4 text-blue-600"></i>
            <span class="text-xs text-gray-500 dark:text-gray-400">Creado: ${createdInfo}</span>
          </div>
        ` : ''}
        ${editedInfo ? `
          <div class="flex items-center gap-2">
            <i data-lucide="user-check" class="w-4 h-4 text-purple-600"></i>
            <span class="text-xs text-gray-500 dark:text-gray-400">Editado: ${editedInfo}</span>
          </div>
        ` : ''}
      </div>
      
      <div class="flex gap-2">
        ${payment.status === 'Pagado' ? `
          <button onclick="showEditPaymentModal('${payment.id}')" 
            class="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded-lg flex items-center gap-1"
            title="Editar factura">
            <i data-lucide="edit-3" class="w-4 h-4"></i>
          </button>
          <button onclick="generateInvoicePDFWithWhatsApp('${payment.id}')" 
            class="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
            <i data-lucide="file-text" class="w-4 h-4"></i>
            📄 Factura+WA
          </button>
        ` : `
          <button onclick="showEditPaymentModal('${payment.id}')" 
            class="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded-lg flex items-center gap-1"
            title="Editar pago">
            <i data-lucide="edit-3" class="w-4 h-4"></i>
          </button>
          <button onclick="markAsPaid('${payment.id}')" 
            class="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
            <i data-lucide="check" class="w-4 h-4"></i>
            Marcar Pagado
          </button>
        `}
        ${getCurrentUser()?.isMainAdmin ? `
        <button onclick="deletePaymentConfirm('${payment.id}')"
          class="bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded-lg"
          title="Eliminar pago">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
        ` : ''}
      </div>
    </div>
  `;
}

// Hacer funciones globales
window.showEditPaymentModal = showEditPaymentModal;
window.closeEditPaymentModal = closeEditPaymentModal;
window.toggleEditPaidFields = toggleEditPaidFields;
window.saveEditedPayment = saveEditedPayment;
window.autoFillEditConcept = autoFillEditConcept;

console.log('✅ Sistema de edición COMPLETA de facturas cargado');

// ========================================
// BUSCADOR DE FACTURAS - CÓDIGO COMPLETO
// ========================================

let currentSearchTerm = '';

function togglePaymentSearch() {
  const searchContainer = document.getElementById('paymentSearchContainer');
  if (searchContainer) {
    searchContainer.classList.toggle('hidden');
    if (!searchContainer.classList.contains('hidden')) {
      setTimeout(() => {
        const input = document.getElementById('paymentSearchInput');
        if (input) {
          input.focus();
          input.click();
        }
      }, 100);
    } else {
      clearPaymentSearch();
    }
  }
  
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function searchPayments() {
  const searchInput = document.getElementById('paymentSearchInput');
  if (!searchInput) return;
  
  currentSearchTerm = searchInput.value.toLowerCase().trim();
  
  if (currentSearchTerm === '') {
    renderPayments();
    return;
  }
  
  const payments = getPayments();
  const expenses = getExpenses();
  let filteredData = [];
  
  if (currentPaymentTab === 'monthly') {
    filteredData = payments
      .filter(p => p.type === 'Mensualidad')
      .filter(p => matchesSearch(p, 'payment'));
    renderFilteredMonthlyPayments(filteredData);
    
  } else if (currentPaymentTab === 'extras') {
    filteredData = payments
      .filter(p => p.type !== 'Mensualidad')
      .filter(p => matchesSearch(p, 'payment'));
    renderFilteredExtraPayments(filteredData);
    
  } else if (currentPaymentTab === 'expenses') {
    filteredData = expenses.filter(e => matchesSearch(e, 'expense'));
    renderFilteredExpenses(filteredData);
    
  } else if (currentPaymentTab === 'history') {
    const filteredPayments = payments.filter(p => matchesSearch(p, 'payment'));
    const filteredExpenses = expenses.filter(e => matchesSearch(e, 'expense'));
    renderPaymentsHistory(filteredPayments, filteredExpenses);
  }
  
  showSearchResultsCount(filteredData.length);
}

function matchesSearch(item, type) {
  if (!currentSearchTerm) return true;
  
  const term = currentSearchTerm;
  
  if (type === 'payment') {
    const player = getPlayerById(item.playerId);
    const playerName = player ? player.name.toLowerCase() : '';
    const playerCategory = player ? player.category.toLowerCase() : '';
    const concept = (item.concept || '').toLowerCase();
    const invoiceNumber = (item.invoiceNumber || '').toLowerCase();
    const amount = item.amount.toString();
    const paymentType = (item.type || '').toLowerCase();
    
    return playerName.includes(term) ||
           playerCategory.includes(term) ||
           concept.includes(term) ||
           invoiceNumber.includes(term) ||
           amount.includes(term) ||
           paymentType.includes(term);
           
  } else if (type === 'expense') {
    const beneficiaryName = (item.beneficiaryName || '').toLowerCase();
    const concept = (item.concept || '').toLowerCase();
    const category = (item.category || '').toLowerCase();
    const invoiceNumber = (item.invoiceNumber || '').toLowerCase();
    const amount = item.amount.toString();
    
    return beneficiaryName.includes(term) ||
           concept.includes(term) ||
           category.includes(term) ||
           invoiceNumber.includes(term) ||
           amount.includes(term);
  }
  
  return false;
}

function renderFilteredMonthlyPayments(payments) {
  const container = document.getElementById('monthlyPaymentsContent');
  
  if (payments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p class="text-gray-500 dark:text-gray-400">No se encontraron resultados para "${currentSearchTerm}"</p>
        <button onclick="clearPaymentSearch()" class="mt-3 text-sm text-teal-600 dark:text-teal-400 underline">
          Limpiar búsqueda
        </button>
      </div>
    `;
    return;
  }
  
  const sorted = sortBy(payments, 'dueDate', 'desc');
  
  container.innerHTML = sorted.map(payment => {
    const player = getPlayerById(payment.playerId);
    if (!player) return '';
    return renderPaymentCard(payment, player);
  }).join('');
  
  lucide.createIcons();
}

function renderFilteredExtraPayments(payments) {
  const container = document.getElementById('extrasPaymentsContent');
  
  if (payments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p class="text-gray-500 dark:text-gray-400">No se encontraron resultados para "${currentSearchTerm}"</p>
        <button onclick="clearPaymentSearch()" class="mt-3 text-sm text-teal-600 dark:text-teal-400 underline">
          Limpiar búsqueda
        </button>
      </div>
    `;
    return;
  }
  
  const sorted = sortBy(payments, 'dueDate', 'desc');
  
  container.innerHTML = sorted.map(payment => {
    const player = getPlayerById(payment.playerId);
    if (!player) return '';
    return renderPaymentCard(payment, player);
  }).join('');
  
  lucide.createIcons();
}

function renderFilteredExpenses(expenses) {
  const container = document.getElementById('expensesPaymentsContent');
  
  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p class="text-gray-500 dark:text-gray-400">No se encontraron resultados para "${currentSearchTerm}"</p>
        <button onclick="clearPaymentSearch()" class="mt-3 text-sm text-teal-600 dark:text-teal-400 underline">
          Limpiar búsqueda
        </button>
      </div>
    `;
    return;
  }
  
  const sorted = sortBy(expenses, 'date', 'desc');
  
  container.innerHTML = sorted.map(expense => renderExpenseCard(expense)).join('');
  
  lucide.createIcons();
}

function clearPaymentSearch() {
  const searchInput = document.getElementById('paymentSearchInput');
  if (searchInput) {
    searchInput.value = '';
  }
  currentSearchTerm = '';
  renderPayments();
  
  const searchContainer = document.getElementById('paymentSearchContainer');
  if (searchContainer) {
    searchContainer.classList.add('hidden');
  }
}

function showSearchResultsCount(count) {
  const searchInput = document.getElementById('paymentSearchInput');
  if (!searchInput) return;
  
  if (count === 0) {
    searchInput.placeholder = '❌ Sin resultados...';
  } else if (count === 1) {
    searchInput.placeholder = `✅ 1 resultado encontrado`;
  } else {
    searchInput.placeholder = `✅ ${count} resultados encontrados`;
  }
}

window.searchPayments = searchPayments;
window.clearPaymentSearch = clearPaymentSearch;
window.togglePaymentSearch = togglePaymentSearch;

console.log('✅ Sistema de búsqueda de pagos completo cargado')

// ========================================
// 🔍 BUSCADOR DE JUGADORES - FUNCIONES
// ========================================

// Buscar jugadores en tiempo real
function searchPlayers() {
  const searchInput = document.getElementById('playerSearchInput');
  if (!searchInput) return;
  
  const searchTerm = searchInput.value.toLowerCase().trim();
  const allPlayers = getActivePlayers();
  
  if (searchTerm === '') {
    filteredPlayers = allPlayers;
  } else {
    filteredPlayers = allPlayers.filter(player => {
      const name = (player.name || '').toLowerCase();
      const category = (player.category || '').toLowerCase();
      return name.includes(searchTerm) || category.includes(searchTerm);
    });
  }
  
  renderPlayerSearchResults(filteredPlayers);
}

// Renderizar resultados de búsqueda
function renderPlayerSearchResults(players) {
  const container = document.getElementById('playerSearchResults');
  
  if (!container) {
    console.error('❌ No se encontró el contenedor playerSearchResults');
    return;
  }
  
  // 🔥 LIMPIAR completamente antes de renderizar
  container.innerHTML = '';
  
  if (!players || players.length === 0) {
    container.innerHTML = `
      <div class="p-4 text-center text-gray-500 dark:text-gray-400">
        <i data-lucide="user-x" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
        <p class="text-sm">No se encontraron jugadores</p>
      </div>
    `;
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
    return;
  }
  
  // Construir HTML de jugadores
  const playersHTML = players.map(player => {
    const isSelected = selectedPlayerId === player.id;
    const avatar = player.avatar || getDefaultAvatar();
    
    return `
      <div 
        onclick="selectPlayer('${player.id}')" 
        class="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg transition-colors ${isSelected ? 'bg-teal-50 dark:bg-teal-900 border-2 border-teal-500' : 'border border-transparent'}"
      >
        <img 
          src="${avatar}" 
          alt="${player.name}" 
          class="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
        >
        <div class="flex-1">
          <p class="font-semibold text-gray-800 dark:text-white">${player.name}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">${player.category}</p>
        </div>
        ${isSelected ? '<i data-lucide="check-circle" class="w-5 h-5 text-teal-600"></i>' : ''}
      </div>
    `;
  }).join('');
  
  container.innerHTML = playersHTML;
  
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// Seleccionar un jugador
function selectPlayer(playerId) {
  selectedPlayerId = playerId;
  const player = getPlayerById(playerId);
  
  if (!player) {
    console.error('❌ Jugador no encontrado:', playerId);
    return;
  }
  
  const selectedName = document.getElementById('selectedPlayerName');
  const selectedDisplay = document.getElementById('selectedPlayerDisplay');
  
  if (selectedName) {
    selectedName.textContent = `${player.name} - ${player.category}`;
  }
  
  if (selectedDisplay) {
    selectedDisplay.classList.remove('hidden');
  }
  
  // Re-renderizar con el jugador seleccionado
  const currentPlayers = filteredPlayers.length > 0 ? filteredPlayers : getActivePlayers();
  renderPlayerSearchResults(currentPlayers);
  
  // Limpiar input
  const searchInput = document.getElementById('playerSearchInput');
  if (searchInput) {
    searchInput.value = '';
  }
  
  filteredPlayers = [];
  
  // Mostrar último pago para evitar doble cobro
  const allPayments = getPaymentsByPlayer(playerId)
    .filter(p => p.status === 'Pagado')
    .sort((a, b) => (b.paidDate || b.dueDate || '').localeCompare(a.paidDate || a.dueDate || ''));

  const lastPaymentInfo = document.getElementById('lastPaymentInfo');
  const lastPaymentText = document.getElementById('lastPaymentText');
  if (lastPaymentInfo && lastPaymentText) {
    if (allPayments.length > 0) {
      const lp = allPayments[0];
      const fecha = lp.paidDate || lp.dueDate || '—';
      lastPaymentText.textContent = `${lp.concept || lp.type} — ${formatCurrency(lp.amount || 0)} — Pagado el ${fecha}`;
    } else {
      lastPaymentText.textContent = 'Sin pagos registrados aún.';
    }
    lastPaymentInfo.classList.remove('hidden');
  }

  showToast(`✅ ${player.name} seleccionado`);

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// Deseleccionar jugador
function clearPlayerSelection() {
  selectedPlayerId = null;
  
  const selectedDisplay = document.getElementById('selectedPlayerDisplay');
  const searchInput = document.getElementById('playerSearchInput');
  
  if (selectedDisplay) {
    selectedDisplay.classList.add('hidden');
  }
  
  if (searchInput) {
    searchInput.value = '';
  }
  
  const allPlayers = getActivePlayers();
  renderPlayerSearchResults(allPlayers);

  // Ocultar panel de último pago
  const lastPaymentInfo = document.getElementById('lastPaymentInfo');
  if (lastPaymentInfo) lastPaymentInfo.classList.add('hidden');

  showToast('ℹ️ Selección eliminada');
}

// Hacer funciones globales
window.searchPlayers = searchPlayers;
window.selectPlayer = selectPlayer;
window.clearPlayerSelection = clearPlayerSelection;

console.log('✅ Buscador de jugadores cargado correctamente');


// ========================================
// HACER FUNCIONES GLOBALES
// ========================================
window.showAddPaymentModal = showAddPaymentModal;
window.closePaymentModal = closePaymentModal;
window.searchPlayers = searchPlayers;
window.selectPlayer = selectPlayer;
window.clearPlayerSelection = clearPlayerSelection;
window.showEditPaymentModal = showEditPaymentModal;
window.closeEditPaymentModal = closeEditPaymentModal;

console.log('✅ Todas las funciones de payments.js exportadas globalmente');

// ========================================
// DELEGACIÓN DE EVENTOS - PREVENIR DUPLICACIÓN
// ========================================

// Bandera para evitar que el formulario se envíe más de una vez al mismo tiempo
let _paymentFormSubmitting = false;

// Función para manejar el submit del formulario de pagos
async function handlePaymentFormSubmit(e) {
  // Si ya hay un envío en proceso, ignorar este clic
  if (_paymentFormSubmitting) return;
  _paymentFormSubmitting = true;

  // Deshabilitar el botón de guardar para feedback visual
  const submitBtn = e.target ? e.target.querySelector('button[type="submit"]') : null;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
  }

  try {
    const paymentId = document.getElementById('paymentId').value;

    // Validar que haya un jugador seleccionado
    if (!selectedPlayerId) {
      showToast('❌ Selecciona un jugador');
      document.getElementById('playerSearchInput').focus();
      return;
    }

    const playerId = selectedPlayerId;
    const type = document.getElementById('paymentType').value;
    const concept = document.getElementById('paymentConcept').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const dueDate = document.getElementById('paymentDueDate').value;
    const status = document.getElementById('paymentStatus').value;
    const paidDate = document.getElementById('paymentPaidDate').value;
    const method = document.getElementById('paymentMethod').value;

    const paymentData = {
      playerId,
      type,
      concept,
      amount,
      dueDate,
      status,
      paidDate: status === 'Pagado' ? paidDate : null,
      method: status === 'Pagado' ? method : null
    };

    if (paymentId) {
      // EDITAR: Agregar editedBy
      updatePayment(paymentId, {
        ...paymentData,
        editedBy: getAuditInfo()
      });
      showToast('✅ Pago actualizado');
    } else {
      // CREAR: Agregar createdBy
      const invoiceNumber = status === 'Pagado' ? await getNextInvoiceNumberFromFirebase() : null;
      const newPayment = {
        id: generateId(),
        ...paymentData,
        invoiceNumber,
        createdAt: getCurrentDate(),
        createdBy: getAuditInfo()
      };

      savePayment(newPayment);
      showToast('✅ Pago registrado');

      // Mostrar modal de opción WhatsApp/PDF si está pagado
      if (status === 'Pagado') {
        setTimeout(() => mostrarOpcionWAPayment(newPayment.id), 500);
      }
    }

    closePaymentModal();
    renderPayments();
    updateDashboard();
    updateNotifications();

  } finally {
    // Siempre liberar el bloqueo al terminar, aunque haya error
    _paymentFormSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar';
    }
  }
}

// Registrar el listener con delegación de eventos (SOLO UNA VEZ)
document.addEventListener('DOMContentLoaded', function() {
  document.body.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'paymentForm') {
      e.preventDefault();
      handlePaymentFormSubmit(e);
    }
  });
}, { once: true }); // ← ESTO ASEGURA QUE SOLO SE REGISTRE UNA VEZ

window.renderPaymentMovementLog = renderPaymentMovementLog;
console.log('✅ Sistema anti-duplicación de pagos activado');