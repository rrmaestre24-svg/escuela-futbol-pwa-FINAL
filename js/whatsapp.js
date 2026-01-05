// ========================================
// INTEGRACIÓN WHATSAPP
// ========================================

// Abrir WhatsApp con número y mensaje
function openWhatsApp(phone, message = '') {
  const cleanedPhone = cleanPhone(phone);
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
  window.open(url, '_blank');
}

// Enviar factura por WhatsApp
function sendInvoiceWhatsApp(paymentId) {
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
  
  const settings = getSchoolSettings();
  
  const message = `
🏆 *${settings.name}*
⚽ FACTURA DE PAGO

📋 *Factura:* ${payment.invoiceNumber}
👤 *Jugador:* ${player.name}
💰 *Concepto:* ${payment.concept}
💵 *Monto:* ${formatCurrency(payment.amount)}
📅 *Fecha:* ${formatDate(payment.paidDate)}
💳 *Método:* ${payment.method || 'No especificado'}

✅ *Estado:* PAGADO

Gracias por tu pago.

_${settings.name}_
${settings.phone}
  `.trim();
  
  openWhatsApp(player.phone, message);
  showToast('✅ Abriendo WhatsApp...');
}

// Enviar notificación de vencimiento por WhatsApp
function sendPaymentNotificationWhatsApp(paymentId) {
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
  
  const settings = getSchoolSettings();
  const today = new Date();
  const dueDate = new Date(payment.dueDate);
  const daysDiff = daysBetween(today, dueDate);
  
  let message = '';
  
  if (daysDiff > 0 && daysDiff <= 10) {
    // Próximo a vencer
    message = `
🏆 *${settings.name}*
⚽ RECORDATORIO DE PAGO

Estimado(a) acudiente de *${player.name}*,

Le recordamos que tiene un pago próximo a vencer:

💰 *Concepto:* ${payment.concept}
💵 *Monto:* ${formatCurrency(payment.amount)}
📅 *Vence:* ${formatDate(payment.dueDate)} (en ${daysDiff} días)

Por favor, realizar el pago antes de la fecha de vencimiento.

_${settings.name}_
${settings.phone}
    `.trim();
  } else if (daysDiff >= -40 && daysDiff <= 0) {
    // En período de gracia
    message = `
🏆 *${settings.name}*
⚽ RECORDATORIO DE PAGO

Estimado(a) acudiente de *${player.name}*,

Su pago se encuentra en período de gracia:

💰 *Concepto:* ${payment.concept}
💵 *Monto:* ${formatCurrency(payment.amount)}
📅 *Venció:* ${formatDate(payment.dueDate)} (hace ${Math.abs(daysDiff)} días)

Le recordamos ponerse al día.

_${settings.name}_
${settings.phone}
    `.trim();
  } else {
    // Vencido
    message = `
🏆 *${settings.name}*
⚠️ PAGO VENCIDO

Estimado(a) acudiente de *${player.name}*,

Su pago se encuentra VENCIDO:

💰 *Concepto:* ${payment.concept}
💵 *Monto:* ${formatCurrency(payment.amount)}
📅 *Venció:* ${formatDate(payment.dueDate)} (hace ${Math.abs(daysDiff)} días)

Por favor, comuníquese con nosotros.

_${settings.name}_
${settings.phone}
    `.trim();
  }
  
  openWhatsApp(player.phone, message);
  showToast('✅ Abriendo WhatsApp...');
}

// Felicitar cumpleaños por WhatsApp - VERSIÓN CON UNICODE
function sendBirthdayWhatsApp(personId, isStaff = false) {
  let person, phone, name;
  
  if (isStaff) {
    person = getUsers().find(u => u.id === personId);
    if (!person) {
      showToast('\u274C Usuario no encontrado');
      return;
    }
    phone = person.phone;
    name = person.name;
  } else {
    person = getPlayerById(personId);
    if (!person) {
      showToast('\u274C Jugador no encontrado');
      return;
    }
    phone = person.phone;
    name = person.name;
  }
  
  const settings = getSchoolSettings();
  const age = calculateAge(person.birthDate);
  
    // Emojis en formato Unicode para máxima compatibilidad
    const message = `
  \u{1F389}\u{1F382} *\u00A1FELIZ CUMPLEA\u00D1OS!* \u{1F382}\u{1F389}

  Querido(a) *${name}*,

  Desde *${settings.name}* queremos desearte un feliz cumplea\u00F1os #${age}.

  Que este nuevo a\u00F1o de vida est\u00E9 lleno de:
  \u26BD Goles
  \u{1F3C6} Triunfos
  \u{1F60A} Alegr\u00EDas
  \u{1F4AA} Salud

  \u00A1Que lo disfrutes al m\u00E1ximo!

  _${settings.name}_
    `.trim();
    
    openWhatsApp(phone, message);
    showToast('\u2705 Abriendo WhatsApp...');
  }

// Enviar mensaje personalizado
function sendCustomWhatsApp(phone, message) {
  openWhatsApp(phone, message);
  showToast('✅ Abriendo WhatsApp...');
}

// Enviar estado de cuenta por WhatsApp
function sendAccountStatementWhatsApp(playerId) {
  const player = getPlayerById(playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }
  
  const payments = getPaymentsByPlayer(playerId);
  const settings = getSchoolSettings();
  
  const paid = payments.filter(p => p.status === 'Pagado');
  const pending = payments.filter(p => p.status === 'Pendiente');
  
  const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
  const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
  
  let message = `
🏆 *${settings.name}*
📊 ESTADO DE CUENTA

👤 *Jugador:* ${player.name}
📅 *Fecha:* ${formatDate(getCurrentDate())}

💰 *Resumen:*
✅ Total Pagado: ${formatCurrency(totalPaid)}
⏳ Total Pendiente: ${formatCurrency(totalPending)}

📋 *Pagos Pendientes:*
`;

  if (pending.length === 0) {
    message += '\n✅ No hay pagos pendientes';
  } else {
    pending.forEach(p => {
      message += `\n• ${p.concept}: ${formatCurrency(p.amount)} (Vence: ${formatDate(p.dueDate)})`;
    });
  }
  
  message += `

_${settings.name}_
${settings.phone}
  `.trim();
  
  openWhatsApp(player.phone, message);
  showToast('✅ Abriendo WhatsApp...');
}

console.log('✅ whatsapp.js cargado');
// ========================================
// WHATSAPP - FUNCIONES PARA EGRESOS
// ========================================

// Enviar comprobante de egreso por WhatsApp
function sendExpenseInvoiceWhatsApp(expenseId) {
  const expense = getExpenseById(expenseId);
  if (!expense) {
    showToast('❌ Egreso no encontrado');
    return;
  }
  
  const settings = getSchoolSettings();
  
  // Construir mensaje
  const message = `¡Hola ${expense.beneficiaryName}! 👋\n\n` +
    `Te enviamos el comprobante de pago de *${settings.name || 'MI CLUB'}*\n\n` +
    `📄 Comprobante: ${expense.invoiceNumber}\n` +
    `💵 Monto: ${formatCurrency(expense.amount)}\n` +
    `📋 Concepto: ${expense.concept}\n` +
    `🏷️ Categoría: ${expense.category}\n` +
    `📅 Fecha de pago: ${formatDate(expense.date)}\n` +
    `💳 Método: ${expense.method}\n\n` +
    `Gracias por tus servicios ⚽`;
  
  // Normalizar teléfono
  const phone = normalizePhone(expense.beneficiaryPhone);
  
  // Abrir WhatsApp
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  
  showToast('✅ Abriendo WhatsApp...');
}

// Enviar por WhatsApp con número manual (para egresos)
function sendExpenseInvoiceWhatsAppManual(expenseId, phone) {
  const expense = getExpenseById(expenseId);
  if (!expense) {
    showToast('❌ Egreso no encontrado');
    return;
  }
  
  const settings = getSchoolSettings();
  
  const message = `¡Hola ${expense.beneficiaryName}! 👋\n\n` +
    `Te enviamos el comprobante de pago de *${settings.name || 'MI CLUB'}*\n\n` +
    `📄 Comprobante: ${expense.invoiceNumber}\n` +
    `💵 Monto: ${formatCurrency(expense.amount)}\n` +
    `📋 Concepto: ${expense.concept}\n` +
    `📅 Fecha: ${formatDate(expense.date)}\n\n` +
    `Gracias por tus servicios ⚽`;
  
  const normalizedPhone = normalizePhone(phone);
  const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  
  showToast('✅ Abriendo WhatsApp...');
}

// Hacer funciones globales
window.sendExpenseInvoiceWhatsApp = sendExpenseInvoiceWhatsApp;
window.sendExpenseInvoiceWhatsAppManual = sendExpenseInvoiceWhatsAppManual;

console.log('✅ Funciones de WhatsApp para egresos cargadas');