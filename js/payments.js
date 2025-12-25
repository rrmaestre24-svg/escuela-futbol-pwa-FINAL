// ========================================
// GESTIÓN DE PAGOS
// ========================================

let currentPaymentTab = 'monthly';

// Mostrar tab de pagos
function showPaymentTab(tab) {
  currentPaymentTab = tab;
  
  // Actualizar botones
  document.getElementById('monthlyTab').classList.remove('bg-teal-600', 'text-white');
  document.getElementById('monthlyTab').classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  document.getElementById('extrasTab').classList.remove('bg-teal-600', 'text-white');
  document.getElementById('extrasTab').classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  document.getElementById('historyTab').classList.remove('bg-teal-600', 'text-white');
  document.getElementById('historyTab').classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  
  document.getElementById(`${tab}Tab`).classList.add('bg-teal-600', 'text-white');
  document.getElementById(`${tab}Tab`).classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  
  // Mostrar contenido
  document.getElementById('monthlyPaymentsContent').classList.add('hidden');
  document.getElementById('extrasPaymentsContent').classList.add('hidden');
  document.getElementById('historyPaymentsContent').classList.add('hidden');
  
  document.getElementById(`${tab}PaymentsContent`).classList.remove('hidden');
  
  renderPayments();
}

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

// Guardar pago
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
    
    // Si está pagado, generar PDF automáticamente
    if (status === 'Pagado') {
      setTimeout(() => {
        generateInvoicePDF(newPayment.id);
      }, 500);
    }
  }
  
  closePaymentModal();
  renderPayments();
  updateDashboard();
  updateNotifications();
});

// Renderizar pagos
function renderPayments() {
  const payments = getPayments();
  
  if (currentPaymentTab === 'monthly') {
    renderMonthlyPayments(payments.filter(p => p.type === 'Mensualidad'));
  } else if (currentPaymentTab === 'extras') {
    renderExtraPayments(payments.filter(p => p.type !== 'Mensualidad'));
  } else if (currentPaymentTab === 'history') {
    renderPaymentsHistory(payments);
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

// Renderizar card de pago
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
          <button onclick="generateInvoicePDF('${payment.id}')" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
            <i data-lucide="download" class="w-4 h-4"></i>
            PDF
          </button>
          <button onclick="sendInvoiceWhatsApp('${payment.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
            <i data-lucide="message-circle" class="w-4 h-4"></i>
            WhatsApp
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
  
  // Generar PDF automáticamente
  setTimeout(() => {
    generateInvoicePDF(paymentId);
  }, 500);
  
  renderPayments();
  updateDashboard();
  updateNotifications();
}

// Renderizar historial de pagos
function renderPaymentsHistory(payments) {
  const tbody = document.getElementById('paymentsHistoryTable');
  
  if (payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-8 text-gray-500 dark:text-gray-400">No hay pagos registrados</td>
      </tr>
    `;
    return;
  }
  
  const sorted = sortBy(payments, 'createdAt', 'desc');
  
  tbody.innerHTML = sorted.map(payment => {
    const player = getPlayerById(payment.playerId);
    if (!player) return '';
    
    const statusColor = payment.status === 'Pagado' ? 'text-green-600' : 'text-red-600';
    
    return `
      <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
        <td class="py-3 text-gray-800 dark:text-white">${formatDate(payment.paidDate || payment.dueDate)}</td>
        <td class="py-3 text-gray-800 dark:text-white">${player.name}</td>
        <td class="py-3 text-gray-800 dark:text-white">${payment.concept}</td>
        <td class="py-3 text-right text-gray-800 dark:text-white font-medium">${formatCurrency(payment.amount)}</td>
        <td class="py-3 text-center">
          <span class="text-sm font-medium ${statusColor}">${payment.status}</span>
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

console.log('✅ payments.js cargado');