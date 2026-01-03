// ========================================
// MODALES AUXILIARES
// ========================================

// Modal de progreso de factura
function showInvoiceProgressModal(invoiceNumber) {
  const modal = document.getElementById('invoiceProgressModal');
  const invoiceText = document.getElementById('invoiceNumberText');
  
  if (!modal) {
    console.warn('⚠️ Modal invoiceProgressModal no encontrado');
    return;
  }
  
  if (invoiceText && invoiceNumber) {
    invoiceText.textContent = `Factura: ${invoiceNumber}`;
  }
  
  modal.classList.remove('hidden');
}

function closeInvoiceProgressModal() {
  const modal = document.getElementById('invoiceProgressModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Modal de WhatsApp manual (cuando el contacto no tiene teléfono)
function showManualWhatsAppModal(itemId, itemType) {
  // itemType puede ser 'payment' o 'expense'
  const modal = document.getElementById('manualWhatsAppModal');
  
  if (!modal) {
    // Si no existe el modal, usar un prompt simple
    const phone = prompt('El contacto no tiene teléfono registrado.\n\nIngresa el número de WhatsApp (con código de país):');
    
    if (phone && phone.trim() !== '') {
      const normalizedPhone = normalizePhone(phone);
      
      if (itemType === 'payment') {
        sendInvoiceWhatsAppManual(itemId, normalizedPhone);
      } else if (itemType === 'expense') {
        sendExpenseInvoiceWhatsAppManual(itemId, normalizedPhone);
      }
    }
    return;
  }
  
  // Si existe el modal, usarlo
  modal.classList.remove('hidden');
  
  // Guardar datos en el modal
  document.getElementById('manualWhatsAppItemId').value = itemId;
  document.getElementById('manualWhatsAppItemType').value = itemType;
  
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function closeManualWhatsAppModal() {
  const modal = document.getElementById('manualWhatsAppModal');
  if (modal) {
    modal.classList.add('hidden');
    
    // Limpiar campos
    const phoneInput = document.getElementById('manualWhatsAppPhone');
    if (phoneInput) phoneInput.value = '';
  }
}

// Enviar factura por WhatsApp con número manual
function sendManualWhatsApp() {
  const itemId = document.getElementById('manualWhatsAppItemId').value;
  const itemType = document.getElementById('manualWhatsAppItemType').value;
  const phone = document.getElementById('manualWhatsAppPhone').value;
  
  if (!phone || phone.trim() === '') {
    showToast('⚠️ Ingresa un número de teléfono');
    return;
  }
  
  const normalizedPhone = normalizePhone(phone);
  
  if (itemType === 'payment') {
    sendInvoiceWhatsAppManual(itemId, normalizedPhone);
  } else if (itemType === 'expense') {
    sendExpenseInvoiceWhatsAppManual(itemId, normalizedPhone);
  }
  
  closeManualWhatsAppModal();
}

// Funciones auxiliares para enviar con número manual
function sendInvoiceWhatsAppManual(paymentId, phone) {
  const payment = getPaymentById(paymentId);
  if (!payment) return;
  
  const settings = getSchoolSettings();
  const player = getPlayerById(payment.playerId);
  if (!player) return;
  
  const message = `¡Hola! 👋\n\n` +
    `Te enviamos la factura de *${settings.name || 'MI CLUB'}*\n\n` +
    `📄 Factura: ${payment.invoiceNumber}\n` +
    `👤 Jugador: ${player.name}\n` +
    `💵 Monto: ${formatCurrency(payment.amount)}\n` +
    `✅ Estado: ${payment.status}\n\n` +
    `¡Gracias por tu preferencia! ⚽`;
  
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  
  showToast('✅ Abriendo WhatsApp...');
}

function sendExpenseInvoiceWhatsAppManual(expenseId, phone) {
  const expense = getExpenseById(expenseId);
  if (!expense) return;
  
  const settings = getSchoolSettings();
  
  const message = `¡Hola ${expense.beneficiaryName}! 👋\n\n` +
    `Te enviamos el comprobante de pago de *${settings.name || 'MI CLUB'}*\n\n` +
    `📄 Factura: ${expense.invoiceNumber}\n` +
    `💵 Monto: ${formatCurrency(expense.amount)}\n` +
    `📋 Concepto: ${expense.concept}\n` +
    `📅 Fecha: ${formatDate(expense.date)}\n\n` +
    `¡Gracias! ⚽`;
  
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  
  showToast('✅ Abriendo WhatsApp...');
}

// Hacer funciones globales
window.showInvoiceProgressModal = showInvoiceProgressModal;
window.closeInvoiceProgressModal = closeInvoiceProgressModal;
window.showManualWhatsAppModal = showManualWhatsAppModal;
window.closeManualWhatsAppModal = closeManualWhatsAppModal;
window.sendManualWhatsApp = sendManualWhatsApp;

console.log('✅ modals.js cargado correctamente');