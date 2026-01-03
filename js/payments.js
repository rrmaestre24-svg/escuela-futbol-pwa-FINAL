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
    // Editar pago existente
    updatePayment(paymentId, paymentData);
    showToast('✅ Pago actualizado');
  } else {
    // Crear nuevo pago
    const invoiceNumber = status === 'Pagado' ? getNextInvoiceNumber() : null;
    const newPayment = {
      id: generateId(),
      ...paymentData,
      invoiceNumber,
      createdAt: getCurrentDate()
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

// Renderizar card de egreso
function renderExpenseCard(expense) {
  const categoryColors = {
    'Salarios': 'text-purple-600',
    'Servicios': 'text-blue-600',
    'Materiales': 'text-green-600',
    'Mantenimiento': 'text-yellow-600',
    'Impuestos': 'text-red-600',
    'Otro': 'text-gray-600'
  };
  
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
    method: 'Efectivo' // Por defecto
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