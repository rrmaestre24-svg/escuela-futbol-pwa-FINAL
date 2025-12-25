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

Gracias por tu pago puntual.

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

Le solicitamos ponerse al día lo antes posible.

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

Es urgente regularizar su situación. Por favor, comuníquese con nosotros.

_${settings.name}_
${settings.phone}
    `.trim();
  }
  
  openWhatsApp(player.phone, message);
  showToast('✅ Abriendo WhatsApp...');
}

// Felicitar cumpleaños por WhatsApp
function sendBirthdayWhatsApp(personId, isStaff = false) {
  let person, phone, name;
  
  if (isStaff) {
    person = getUsers().find(u => u.id === personId);
    if (!person) {
      showToast('❌ Usuario no encontrado');
      return;
    }
    phone = person.phone;
    name = person.name;
  } else {
    person = getPlayerById(personId);
    if (!person) {
      showToast('❌ Jugador no encontrado');
      return;
    }
    phone = person.phone;
    name = person.name;
  }
  
  const settings = getSchoolSettings();
  const age = calculateAge(person.birthDate);
  
  const message = `
🎉🎂 *¡FELIZ CUMPLEAÑOS!* 🎂🎉

Querido(a) *${name}*,

Desde *${settings.name}* queremos desearte un feliz cumpleaños #${age}.

Que este nuevo año de vida esté lleno de:
⚽ Goles
🏆 Triunfos
😊 Alegrías
💪 Salud

¡Que lo disfrutes al máximo!

_${settings.name}_
  `.trim();
  
  openWhatsApp(phone, message);
  showToast('✅ Abriendo WhatsApp...');
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