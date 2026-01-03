// ========================================
// GESTIÓN DE PAGOS UNIFICADA (INGRESOS + EGRESOS)
// ========================================

let currentPaymentTab = 'monthly';
let currentPaymentMode = 'ingreso'; // 'ingreso' o 'egreso'

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

// Seleccionar tipo de pago
function selectPaymentType(type) {
  currentPaymentMode = type;
  closePaymentTypeSelectorModal();
  
  if (type === 'ingreso') {
    showAddPaymentModal();
  } else {
    showAddExpenseModal();
  }
}

// ========================================
// TABS
// ========================================

// Mostrar tab de pagos
function showPaymentTab(tab) {
  currentPaymentTab = tab;
  
  // Actualizar botones
  ['monthly', 'extras', 'expenses', 'history'].forEach(t => {
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
  
  // Mostrar contenido
  document.getElementById('monthlyPaymentsContent').classList.add('hidden');
  document.getElementById('extrasPaymentsContent').classList.add('hidden');
  document.getElementById('expensesPaymentsContent').classList.add('hidden');
  document.getElementById('historyPaymentsContent').classList.add('hidden');
  
  document.getElementById(`${tab}PaymentsContent`).classList.remove('hidden');
  
  renderPayments();
}

// ========================================
// MODAL DE PAGO (INGRESO)
// ========================================

// Mostrar modal agregar pago
function showAddPaymentModal() {
  document.getElementById('paymentForm').reset();
  document.getElementById('paymentId').value = '';
  document.getElementById('paidDateContainer').classList.add('hidden');
  document.getElementById('paymentMethodContainer').classList.add('hidden');
  
  // Llenar select de jugadores
  const players = getActivePlayers();
  const select = document.getElementById('paymentPlayer');
  select.innerHTML = '<option value="">Seleccionar jugador...</option>' + 
    players.map(p => `<option value="${p.id}">${p.name} - ${p.category}</option>`).join('');
  
  document.getElementById('paymentModal').classList.remove('hidden');
}

// Cerrar modal pago
function closePaymentModal() {
  document.getElementById('paymentModal').classList.add('hidden');
}

// Auto-completar al cambiar tipo de pago
document.getElementById('paymentType')?.addEventListener('change', function() {
  const type = this.value;
  const settings = getSchoolSettings();
  const conceptInput = document.getElementById('paymentConcept');
  const amountInput = document.getElementById('paymentAmount');
  
  if (type === 'Mensualidad') {
    const currentMonth = getMonthName(new Date().getMonth());
    conceptInput.value = `Mensualidad ${currentMonth}`;
    amountInput.value = settings.monthlyFee || '';
  } else if (type === 'Uniforme') {
    conceptInput.value = 'Uniforme completo';
    amountInput.value = '';
  } else if (type === 'Torneo') {
    conceptInput.value = 'Inscripción torneo';
    amountInput.value = '';
  } else if (type === 'Equipamiento') {
    conceptInput.value = 'Equipamiento deportivo';
    amountInput.value = '';
  } else {
    conceptInput.value = '';
    amountInput.value = '';
  }
});

// Mostrar/ocultar campos según estado
document.getElementById('paymentStatus')?.addEventListener('change', function() {
  const status = this.value;
  
  if (status === 'Pagado') {
    document.getElementById('paidDateContainer').classList.remove('hidden');
    document.getElementById('paymentMethodContainer').classList.remove('hidden');
    document.getElementById('paymentPaidDate').value = getCurrentDate();
  } else {
    document.getElementById('paidDateContainer').classList.add('hidden');
    document.getElementById('paymentMethodContainer').classList.add('hidden');
  }
});

// Guardar pago (INGRESO)
document.getElementById('paymentForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  
  const paymentId = document.getElementById('paymentId').value;
  const playerId = document.getElementById('paymentPlayer').value;
  const type = document.getElementById('paymentType').value;
  const concept = document.getElementById('paymentConcept').value;
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const dueDate = document.getElementById('paymentDueDate').value;
  const status = document.getElementById('paymentStatus').value;
  const paidDate = document.getElementById('paymentPaidDate').value;
  const method = document.getElementById('paymentMethod').value;
  
  if (!playerId) {
    showToast('❌ Selecciona un jugador');
    return;
  }
  
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
    // 🆕 EDITAR: Agregar editedBy
    updatePayment(paymentId, {
      ...paymentData,
      editedBy: getAuditInfo() // 🆕 AUDITORÍA
    });
    showToast('✅ Pago actualizado');
  } else {
    // 🆕 CREAR: Agregar createdBy
    const invoiceNumber = status === 'Pagado' ? getNextInvoiceNumber() : null;
    const newPayment = {
      id: generateId(),
      ...paymentData,
      invoiceNumber,
      createdAt: getCurrentDate(),
      createdBy: getAuditInfo() // 🆕 AUDITORÍA
    };
    
    savePayment(newPayment);
    showToast('✅ Pago registrado');
    
    // 🚀 AUTO-REDIRECT: Si está pagado, generar PDF + WhatsApp
    if (status === 'Pagado') {
      setTimeout(() => {
        generateInvoicePDFWithWhatsApp(newPayment.id);
      }, 500);
    }
  }
  
  closePaymentModal();
  renderPayments();
  updateDashboard();
  updateNotifications();
});

// ========================================
// RENDERIZADO
// ========================================

// Renderizar pagos
function renderPayments() {
  const payments = getPayments();
  const expenses = getExpenses();
  
  if (currentPaymentTab === 'monthly') {
    renderMonthlyPayments(payments.filter(p => p.type === 'Mensualidad'));
  } else if (currentPaymentTab === 'extras') {
    renderExtraPayments(payments.filter(p => p.type !== 'Mensualidad'));
  } else if (currentPaymentTab === 'expenses') {
    renderExpensesInPayments(expenses);
  } else if (currentPaymentTab === 'history') {
    renderPaymentsHistory(payments, expenses);
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
  
  const sorted = sortBy(payments, 'dueDate', 'desc');
  
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
  
  const sorted = sortBy(payments, 'dueDate', 'desc');
  
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
    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm animate-slide-in">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <img src="${player.avatar || getDefaultAvatar()}" alt="${player.name}" class="w-12 h-12 rounded-full object-cover">
          <div>
            <h3 class="font-bold text-gray-800 dark:text-white">${player.name}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">${player.category}</p>
          </div>
        </div>
        <span class="badge ${statusColor}">${payment.status}</span>
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
        <button onclick="deletePaymentConfirm('${payment.id}')" class="bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded-lg">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
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
    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm animate-slide-in border-l-4 border-red-500">
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
function markAsPaid(paymentId) {
  const payment = getPaymentById(paymentId);
  if (!payment) return;
  
  const invoiceNumber = getNextInvoiceNumber();
  
  updatePayment(paymentId, {
    status: 'Pagado',
    paidDate: getCurrentDate(),
    invoiceNumber: invoiceNumber,
    method: 'Efectivo',
    editedBy: getAuditInfo() // 🆕 AUDITORÍA
  });
  
  showToast('✅ Pago marcado como pagado');
  
  // 🚀 AUTO-REDIRECT: Generar PDF + WhatsApp
  setTimeout(() => {
    generateInvoicePDFWithWhatsApp(paymentId);
  }, 500);
  
  renderPayments();
  updateDashboard();
  updateNotifications();
}

// Renderizar historial completo (INGRESOS + EGRESOS)
function renderPaymentsHistory(payments, expenses) {
  const tbody = document.getElementById('paymentsHistoryTable');
  
  if (payments.length === 0 && expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-8 text-gray-500 dark:text-gray-400">No hay registros</td>
      </tr>
    `;
    return;
  }
  
  // Combinar pagos y egresos
  const allTransactions = [];
  
  // Agregar pagos
  payments.forEach(p => {
    const player = getPlayerById(p.playerId);
    if (player) {
      allTransactions.push({
        date: p.paidDate || p.dueDate,
        type: 'ingreso',
        name: player.name,
        concept: p.concept,
        amount: p.amount,
        status: p.status
      });
    }
  });
  
  // Agregar egresos
  expenses.forEach(e => {
    allTransactions.push({
      date: e.date,
      type: 'egreso',
      name: e.beneficiaryName,
      concept: e.concept,
      amount: -e.amount,
      status: 'Pagado'
    });
  });
  
  // Ordenar por fecha
  const sorted = allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  tbody.innerHTML = sorted.map(t => {
    const statusColor = t.type === 'ingreso' 
      ? (t.status === 'Pagado' ? 'text-green-600' : 'text-red-600')
      : 'text-red-600';
    
    const amountColor = t.amount >= 0 ? 'text-green-600' : 'text-red-600';
    
    return `
      <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
        <td class="py-3 text-gray-800 dark:text-white">${formatDate(t.date)}</td>
        <td class="py-3 text-gray-800 dark:text-white">${t.name}</td>
        <td class="py-3 text-gray-800 dark:text-white">${t.concept}</td>
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

// Eliminar pago
function deletePaymentConfirm(paymentId) {
  if (confirmAction('¿Estás seguro de eliminar este pago?')) {
    deletePayment(paymentId);
    showToast('✅ Pago eliminado');
    renderPayments();
    updateDashboard();
    updateNotifications();
  }
}

// ========================================
// 🚀 AUTO-REDIRECT: PDF + WHATSAPP
// ========================================

// Generar factura con flujo automático (PDF + WhatsApp)
function generateInvoicePDFWithWhatsApp(paymentId) {
  // Primero generar el PDF
  const pdfGenerated = generateInvoicePDF(paymentId, true);
  
  if (!pdfGenerated) {
    return;
  }
  
  const payment = getPaymentById(paymentId);
  if (!payment) return;
  
  // Mostrar modal informativo
  showInvoiceProgressModal(payment.invoiceNumber);
  
  // Esperar 1.5 segundos y luego verificar WhatsApp
  setTimeout(() => {
    closeInvoiceProgressModal();
    
    const player = getPlayerById(payment.playerId);
    if (!player) {
      showToast('❌ Jugador no encontrado');
      return;
    }
    
    // Verificar si tiene WhatsApp
    if (player.phone && player.phone.trim() !== '') {
      // Tiene WhatsApp → Abrir automáticamente
      sendInvoiceWhatsApp(paymentId);
    } else {
      // NO tiene WhatsApp → Pedir número manual
      showManualWhatsAppModal(paymentId, 'payment');
    }
  }, 1500);
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

// Auto-completar concepto al cambiar tipo (modo edición)
function autoFillEditConcept() {
  const type = document.getElementById('editPaymentType').value;
  const conceptInput = document.getElementById('editPaymentConcept');
  const settings = getSchoolSettings();
  
  // Solo auto-completar si el campo está vacío
  if (conceptInput.value.trim() !== '') {
    // Preguntar si quiere reemplazar
    if (!confirm('¿Deseas actualizar el concepto según el tipo seleccionado?')) {
      return;
    }
  }
  
  if (type === 'Mensualidad') {
    const currentMonth = getMonthName(new Date().getMonth());
    conceptInput.value = `Mensualidad ${currentMonth}`;
  } else if (type === 'Uniforme') {
    conceptInput.value = 'Uniforme completo';
  } else if (type === 'Torneo') {
    conceptInput.value = 'Inscripción torneo';
  } else if (type === 'Equipamiento') {
    conceptInput.value = 'Equipamiento deportivo';
  }
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
function saveEditedPayment() {
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
    updateData.invoiceNumber = getNextInvoiceNumber();
  }
  
  // Actualizar en base de datos
  updatePayment(paymentId, updateData);
  
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
    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm animate-slide-in">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <img src="${player.avatar || getDefaultAvatar()}" alt="${player.name}" class="w-12 h-12 rounded-full object-cover">
          <div>
            <h3 class="font-bold text-gray-800 dark:text-white">${player.name}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">${player.category}</p>
          </div>
        </div>
        <span class="badge ${statusColor}">${payment.status}</span>
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
        <button onclick="deletePaymentConfirm('${payment.id}')" 
          class="bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded-lg"
          title="Eliminar pago">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
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

console.log('✅ Sistema de búsqueda de pagos completo cargado');