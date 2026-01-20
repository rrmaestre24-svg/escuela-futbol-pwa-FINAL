// ========================================
// GENERACIÓN DE PDFs con jsPDF + FIRMAS AUTOMÁTICAS
// ✅ CORREGIDO: Zona horaria en todas las fechas
// 🆕 INCLUYE DOCUMENTO DE IDENTIDAD EN FACTURAS
// ========================================


// ========================================
// FUNCIÓN: NORMALIZAR TEXTO PARA PDF
// Convierte caracteres especiales a ASCII simple
// ========================================
function normalizeForPDF(text) {
  if (!text) return '';
  text = String(text);
  const map = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
    'ñ': 'n', 'Ñ': 'N', 'ü': 'u', 'Ü': 'U'
  };
  return text.replace(/[áéíóúÁÉÍÓÚñÑüÜ]/g, match => map[match] || match);
}


// ========================================
// 🆕 FUNCIÓN UNIVERSAL: AGREGAR FIRMA AUTOMÁTICA
// ========================================
function addSignatureToDocument(doc, yPosition = 245) {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    console.warn('⚠️ No hay usuario actual para firma');
    return yPosition;
  }
  
  const primaryColor = [13, 148, 136];
  const textColor = [31, 41, 55];
  const lightGray = [156, 163, 175];
  
  // Línea separadora superior
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.3);
  doc.line(15, yPosition, 195, yPosition);
  
  yPosition += 8;
  
  // Título
  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  doc.setFont(undefined, 'italic');
  doc.text('Documento Generado por:', 15, yPosition);
  
  yPosition += 8;
  
  // Cuadro de firma
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.rect(15, yPosition, 180, 20);
  
  // Avatar (si existe)
  let avatarX = 20;
  let textX = 25;
  
  try {
    if (currentUser.avatar && currentUser.avatar.startsWith('data:image')) {
      doc.addImage(currentUser.avatar, 'PNG', avatarX, yPosition + 3, 14, 14);
      textX = avatarX + 18;
    }
  } catch (e) {
    console.log('Avatar no disponible para firma');
    textX = 20;
  }
  
  // Nombre del usuario
  doc.setFontSize(11);
  doc.setTextColor(...textColor);
  doc.setFont(undefined, 'bold');
  doc.text(normalizeForPDF(currentUser.name), textX, yPosition + 8);
  
  // Cargo
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.setFont(undefined, 'normal');
  const role = currentUser.isMainAdmin ? 'Administrador Principal' : 'Administrador';
  doc.text(role, textX, yPosition + 13);
  
  // Fecha y hora de generación
  const now = new Date();
  const dateStr = formatDate(getCurrentDate());
  const timeStr = now.toLocaleTimeString('es-CO', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  doc.setFontSize(8);
  doc.setTextColor(...lightGray);
  doc.text(`${dateStr} a las ${timeStr}`, textX, yPosition + 17);
  
  return yPosition + 22;
}

// ========================================
// 🆕 FUNCIÓN PARA FORMATEAR DOCUMENTO
// ========================================
function formatDocumentForPDF(type, number) {
  if (!type || !number) return null;
  
  const types = {
    'TI': 'T.I.',
    'CC': 'C.C.',
    'CE': 'C.E.',
    'RC': 'R.C.',
    'PA': 'Pasaporte',
    'NUIP': 'NUIP'
  };
  
  return `${types[type] || type} ${number}`;
}

// ========================================
// FACTURAS DE INGRESOS (CON FIRMA, EMOJIS Y DOCUMENTO)
// 🆕 ACTUALIZADO: Incluye documento de identidad
// ========================================
function generateInvoicePDF(paymentId, autoDownload = true) {
  const payment = getPaymentById(paymentId);
  if (!payment) {
    showToast('❌ Pago no encontrado');
    return null;
  }
  
  const player = getPlayerById(payment.playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return null;
  }
  
  const settings = getSchoolSettings();
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const primaryColor = [13, 148, 136];
    const textColor = [31, 41, 55];
    
    // Logo
    try {
      if (settings.logo && settings.logo.startsWith('data:image')) {
        doc.addImage(settings.logo, 'PNG', 15, 15, 30, 30);
      }
    } catch (e) {
      console.log('Logo no disponible');
    }
    
    // Encabezado del club
    doc.setFontSize(20);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text(normalizeForPDF(settings.name || 'MI CLUB'), 50, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    if (settings.email) doc.text(settings.email, 50, 32);
    if (settings.phone) doc.text(settings.phone, 50, 37);
    if (settings.address) doc.text(normalizeForPDF(settings.address), 50, 42);
    
    // Título FACTURA DE PAGO
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('FACTURA DE PAGO', 150, 25);
    
    // Línea separadora
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(15, 50, 195, 50);
    
    let yPos = 60;
    
    // 📄 Factura
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('Factura:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(payment.invoiceNumber || 'N/A', 50, yPos);
    yPos += 8;
    
    // 👤 Jugador
    doc.setFont(undefined, 'bold');
    doc.text('Jugador:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(normalizeForPDF(player.name), 50, yPos);
    yPos += 8;
    
    // 🆕 🪪 Documento de Identidad
    const documentText = formatDocumentForPDF(player.documentType, player.documentNumber);
    if (documentText) {
      doc.setFont(undefined, 'bold');
      doc.text('Documento:', 15, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(documentText, 50, yPos);
      yPos += 8;
    }
    
    // 📁 Categoría
    doc.setFont(undefined, 'bold');
    doc.text('Categoria:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(normalizeForPDF(player.category), 50, yPos);
    yPos += 8;
    
    // 💰 Concepto
    doc.setFont(undefined, 'bold');
    doc.text('Concepto:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(normalizeForPDF(payment.concept), 50, yPos);
    yPos += 8;
    
    // 💵 Monto
    doc.setFont(undefined, 'bold');
    doc.text('Monto:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...primaryColor);
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text(formatCurrency(payment.amount), 50, yPos);
    yPos += 8;
    
    // 📅 Fecha
    doc.setFontSize(11);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'bold');
    doc.text('Fecha:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(formatDate(payment.paidDate || payment.dueDate), 50, yPos);
    yPos += 8;
    
    // 💳 Método
    if (payment.method) {
      doc.setFont(undefined, 'bold');
      doc.text('Metodo:', 15, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(normalizeForPDF(payment.method), 50, yPos);
      yPos += 10;
    }
    
    // ✅ Estado
    doc.setFont(undefined, 'bold');
    if (payment.status === 'Pagado') {
      doc.setTextColor(22, 163, 74);
      doc.setFontSize(13);
      doc.text('Estado: PAGADO', 15, yPos);
    } else {
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(13);
      doc.text('Estado: PENDIENTE', 15, yPos);
    }
    yPos += 20;
    
    // Mensaje de agradecimiento
    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.setFont(undefined, 'italic');
    doc.text('Gracias por tu pago.', 105, yPos, { align: 'center' });
    yPos += 10;
    
    // Línea separadora inferior
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.3);
    doc.line(15, yPos, 195, yPos);
    yPos += 10;
    
    // Pie de página
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(normalizeForPDF(settings.name || 'MI CLUB'), 105, yPos, { align: 'center' });
    if (settings.phone) {
      yPos += 5;
      doc.text(settings.phone, 105, yPos, { align: 'center' });
    }
    
    // 🆕 AGREGAR FIRMA AUTOMÁTICA
    addSignatureToDocument(doc, yPos + 15);
    
    if (autoDownload) {
      doc.save(`Factura-${payment.invoiceNumber || 'SN'}.pdf`);
      showToast('✅ Factura descargada');
    }
    
    return doc;
    
  } catch (error) {
    console.error('Error al generar PDF:', error);
    showToast('❌ Error al generar PDF: ' + error.message);
    return null;
  }
}

// ========================================
// NOTIFICACIÓN DE PAGO (CON FIRMA Y DOCUMENTO)
// ========================================
function generatePaymentNotificationPDF(paymentId) {
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
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const primaryColor = [13, 148, 136];
    const textColor = [31, 41, 55];
    const redColor = [220, 38, 38];
    const yellowColor = [245, 158, 11];
    
    // Logo
    try {
      if (settings.logo && settings.logo.startsWith('data:image')) {
        doc.addImage(settings.logo, 'PNG', 15, 15, 30, 30);
      }
    } catch (e) {
      console.log('Logo no disponible');
    }
    
    // Encabezado
    doc.setFontSize(20);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text(normalizeForPDF(settings.name || 'MI CLUB'), 50, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    if (settings.email) doc.text(settings.email, 50, 32);
    if (settings.phone) doc.text(settings.phone, 50, 37);
    
    // ✅ CORREGIDO: Usar parseLocalDate y normalizar fechas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = parseLocalDate(payment.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
    
    let title = '';
    let statusColor = primaryColor;
    
    if (daysDiff > 0 && daysDiff <= 10) {
      title = 'RECORDATORIO DE PAGO';
      statusColor = yellowColor;
    } else if (daysDiff >= -40 && daysDiff <= 0) {
      title = 'PAGO EN PERIODO DE GRACIA';
      statusColor = yellowColor;
    } else {
      title = 'PAGO VENCIDO';
      statusColor = redColor;
    }
    
    doc.setFontSize(18);
    doc.setTextColor(...statusColor);
    doc.setFont(undefined, 'bold');
    doc.text(title, 105, 60, { align: 'center' });
    
    doc.setDrawColor(...statusColor);
    doc.setLineWidth(0.5);
    doc.line(15, 70, 195, 70);
    
    // Datos del jugador
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    doc.text(`Estimado(a) acudiente de: ${normalizeForPDF(player.name)}`, 15, 85);
    doc.text(`Categoria: ${normalizeForPDF(player.category)}`, 15, 92);
    
    // 🆕 Documento de identidad
    const documentText = formatDocumentForPDF(player.documentType, player.documentNumber);
    if (documentText) {
      doc.text(`Documento: ${documentText}`, 15, 99);
    }
    
    // Detalle del pago
    doc.setFont(undefined, 'bold');
    doc.text('Detalle del Pago:', 15, 115);
    
    doc.setFont(undefined, 'normal');
    doc.text(`Concepto: ${normalizeForPDF(payment.concept)}`, 15, 125);
    doc.text(`Monto: ${formatCurrency(payment.amount)}`, 15, 132);
    doc.text(`Fecha de vencimiento: ${formatDate(payment.dueDate)}`, 15, 139);
    
    if (daysDiff < 0) {
      doc.setTextColor(...redColor);
      doc.setFont(undefined, 'bold');
      doc.text(`Dias de retraso: ${Math.abs(daysDiff)} dias`, 15, 146);
    } else if (daysDiff <= 10) {
      doc.setTextColor(...yellowColor);
      doc.setFont(undefined, 'bold');
      doc.text(`Dias para vencimiento: ${daysDiff} dias`, 15, 146);
    }
    
    // Mensaje
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    
    let message = '';
    if (daysDiff < -40) {
      message = 'Su pago se encuentra VENCIDO. Le solicitamos regularizar su situacion a la brevedad posible.';
    } else if (daysDiff <= 0) {
      message = 'Su pago se encuentra en periodo de gracia. Le agradecemos ponerse al dia lo antes posible.';
    } else {
      message = 'Le recordamos que tiene un pago proximo a vencer. Por favor, realice el pago antes de la fecha limite.';
    }
    
    const lines = doc.splitTextToSize(message, 180);
    doc.text(lines, 15, 165);
    
    // Información de contacto
    doc.setFont(undefined, 'bold');
    doc.text('Para mas informacion, contactenos:', 15, 195);
    doc.setFont(undefined, 'normal');
    if (settings.phone) doc.text(`Telefono: ${settings.phone}`, 15, 202);
    if (settings.email) doc.text(`Email: ${settings.email}`, 15, 209);
    
    // 🆕 AGREGAR FIRMA AUTOMÁTICA
    addSignatureToDocument(doc, 225);
    
    doc.save(`Notificacion-${player.name}-${getCurrentDate()}.pdf`);
    showToast('✅ Notificación descargada');
    
  } catch (error) {
    console.error('Error al generar notificación PDF:', error);
    showToast('❌ Error al generar PDF: ' + error.message);
  }
}

// ========================================
// ESTADO DE CUENTA (CON FIRMA Y DOCUMENTO)
// ========================================
function generatePlayerAccountStatementPDF(playerId) {
  const player = getPlayerById(playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }
  
  const payments = getPaymentsByPlayer(playerId);
  const settings = getSchoolSettings();
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const primaryColor = [13, 148, 136];
    const textColor = [31, 41, 55];
    
    // Logo
    try {
      if (settings.logo && settings.logo.startsWith('data:image')) {
        doc.addImage(settings.logo, 'PNG', 15, 15, 30, 30);
      }
    } catch (e) {
      console.log('Logo no disponible');
    }
    
    // Encabezado
    doc.setFontSize(20);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text(normalizeForPDF(settings.name || 'MI CLUB'), 50, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    if (settings.phone) doc.text(settings.phone, 50, 32);
    
    // Título
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('ESTADO DE CUENTA', 105, 50, { align: 'center' });
    
    // Datos del jugador
    doc.setFontSize(11);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    doc.text(`Jugador: ${normalizeForPDF(player.name)}`, 15, 65);
    doc.text(`Categoria: ${normalizeForPDF(player.category)}`, 15, 72);
    
    // 🆕 Documento de identidad
    const documentText = formatDocumentForPDF(player.documentType, player.documentNumber);
    if (documentText) {
      doc.text(`Documento: ${documentText}`, 15, 79);
      doc.text(`Fecha: ${formatDate(getCurrentDate())}`, 15, 86);
    } else {
      doc.text(`Fecha: ${formatDate(getCurrentDate())}`, 15, 79);
    }
    
    const lineY = documentText ? 92 : 85;
    doc.setDrawColor(...primaryColor);
    doc.line(15, lineY, 195, lineY);
    
    // Calcular totales
    const paid = payments.filter(p => p.status === 'Pagado');
    const pending = payments.filter(p => p.status === 'Pendiente');
    const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
    
    // Resumen
    let yPos = lineY + 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('RESUMEN', 15, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Total Pagado: ${formatCurrency(totalPaid)}`, 15, yPos);
    yPos += 7;
    doc.text(`Total Pendiente: ${formatCurrency(totalPending)}`, 15, yPos);
    yPos += 7;
    doc.text(`Total Pagos: ${payments.length}`, 15, yPos);
    
    // Tabla de pagos
    yPos += 15;
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('HISTORIAL DE PAGOS', 15, yPos);
    
    yPos += 10;
    
    doc.setFontSize(9);
    doc.setFillColor(...primaryColor);
    doc.rect(15, yPos, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Fecha', 20, yPos + 5);
    doc.text('Concepto', 50, yPos + 5);
    doc.text('Monto', 120, yPos + 5);
    doc.text('Estado', 155, yPos + 5);
    
    yPos += 8;
    
    doc.setTextColor(...textColor);
    payments.forEach((p, index) => {
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }
      
      const bgColor = index % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
      doc.setFillColor(...bgColor);
      doc.rect(15, yPos, 180, 8, 'F');
      
      // ✅ CORREGIDO: Usa formatDate que ya maneja zona horaria
      doc.text(formatDate(p.paidDate || p.dueDate), 20, yPos + 5);
      
      const conceptoText = p.concept.substring(0, 25);
      doc.text(conceptoText, 50, yPos + 5);
      doc.text(formatCurrency(p.amount), 120, yPos + 5);
      
      if (p.status === 'Pagado') {
        doc.setTextColor(22, 163, 74);
        doc.text('Pagado', 155, yPos + 5);
      } else {
        doc.setTextColor(220, 38, 38);
        doc.text('Pendiente', 155, yPos + 5);
      }
      
      doc.setTextColor(...textColor);
      yPos += 8;
    });
    
    // 🆕 AGREGAR FIRMA AUTOMÁTICA
    if (yPos > 235) {
      doc.addPage();
      yPos = 20;
    }
    addSignatureToDocument(doc, yPos + 10);
    
    doc.save(`Estado-Cuenta-${player.name}.pdf`);
    showToast('✅ Estado de cuenta descargado');
    
  } catch (error) {
    console.error('Error al generar estado de cuenta:', error);
    showToast('❌ Error al generar PDF: ' + error.message);
  }
}

// ========================================
// 🆕 REPORTE CONTABLE COMPLETO - CON DOCUMENTO
// ========================================
function generateFullAccountingReportPDF() {
  const settings = getSchoolSettings();
  const players = getPlayers();
  const payments = getPayments();
  const expenses = getExpenses();
  
  // 🆕 Obtener otros ingresos
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [];
  
  if (payments.length === 0 && expenses.length === 0 && thirdPartyIncomes.length === 0) {
    showToast('⚠️ No hay datos suficientes para generar el reporte');
    return;
  }
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const primaryColor = [13, 148, 136];
    const textColor = [31, 41, 55];
    const purpleColor = [139, 92, 246];
    
    // PÁGINA 1: PORTADA
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 297, 'F');
    
    try {
      if (settings.logo && settings.logo.startsWith('data:image')) {
        doc.addImage(settings.logo, 'PNG', 80, 80, 50, 50);
      }
    } catch (e) {}
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont(undefined, 'bold');
    doc.text(normalizeForPDF(settings.name || 'MI CLUB'), 105, 150, { align: 'center' });
    
    doc.setFontSize(24);
    doc.text('REPORTE CONTABLE', 105, 165, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'normal');
    doc.text(formatDateText(getCurrentDate()), 105, 180, { align: 'center' });
    
    // PÁGINA 2: RESUMEN
    doc.addPage();
    doc.setTextColor(...textColor);
    
    try {
      if (settings.logo && settings.logo.startsWith('data:image')) {
        doc.addImage(settings.logo, 'PNG', 15, 15, 25, 25);
      }
    } catch (e) {}
    
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('RESUMEN GENERAL', 15, 50);
    
    // Calcular totales de pagos
    const paid = payments.filter(p => p.status === 'Pagado');
    const pending = payments.filter(p => p.status === 'Pendiente');
    const totalPaymentsIncome = paid.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
    
    // 🆕 Calcular totales de otros ingresos
    const totalThirdPartyIncome = thirdPartyIncomes.reduce((sum, i) => sum + i.amount, 0);
    
    // 🆕 Total ingresos = pagos + otros ingresos
    const totalIncome = totalPaymentsIncome + totalThirdPartyIncome;
    
    // Calcular ingresos del mes
    const thisMonthPayments = payments.filter(p => p.paidDate && isThisMonth(p.paidDate));
    const monthPaymentsIncome = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // 🆕 Otros ingresos del mes
    const thisMonthThirdParty = thirdPartyIncomes.filter(i => isThisMonth(i.date));
    const monthThirdPartyIncome = thisMonthThirdParty.reduce((sum, i) => sum + i.amount, 0);
    
    // 🆕 Total mes = pagos mes + otros ingresos mes
    const monthIncome = monthPaymentsIncome + monthThirdPartyIncome;
    
    // Egresos
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const thisMonthExpenses = expenses.filter(e => isThisMonth(e.date));
    const monthExpenses = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    // Utilidad
    const netProfit = totalIncome - totalExpenses;
    const monthNetProfit = monthIncome - monthExpenses;
    
    doc.setFontSize(11);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    
    let yPos = 65;
    doc.text(`Total Jugadores: ${players.length}`, 15, yPos);
    yPos += 8;
    doc.text(`Jugadores Activos: ${players.filter(p => p.status === 'Activo').length}`, 15, yPos);
    yPos += 8;
    doc.text(`Total Pagos Registrados: ${payments.length}`, 15, yPos);
    yPos += 8;
    doc.text(`Pagos Realizados: ${paid.length}`, 15, yPos);
    yPos += 8;
    doc.text(`Pagos Pendientes: ${pending.length}`, 15, yPos);
    yPos += 8;
    // 🆕 Mostrar cantidad de otros ingresos
    doc.text(`Otros Ingresos Registrados: ${thirdPartyIncomes.length}`, 15, yPos);
    yPos += 15;
    
    // INGRESOS
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(22, 163, 74); // Verde
    doc.text('INGRESOS', 15, yPos);
    yPos += 10;
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...textColor);
    doc.text(`Pagos de Jugadores: ${formatCurrency(totalPaymentsIncome)}`, 15, yPos);
    yPos += 8;
    // 🆕 Mostrar otros ingresos separado
    doc.text(`Otros Ingresos: ${formatCurrency(totalThirdPartyIncome)}`, 15, yPos);
    yPos += 8;
    doc.setFont(undefined, 'bold');
    doc.text(`Total Ingresos: ${formatCurrency(totalIncome)}`, 15, yPos);
    doc.setFont(undefined, 'normal');
    yPos += 8;
    doc.text(`Ingresos Este Mes: ${formatCurrency(monthIncome)}`, 15, yPos);
    yPos += 8;
    doc.text(`Por Cobrar: ${formatCurrency(totalPending)}`, 15, yPos);
    yPos += 15;
    
    // EGRESOS
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38);
    doc.text('EGRESOS', 15, yPos);
    yPos += 10;
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...textColor);
    doc.text(`Total Egresos: ${formatCurrency(totalExpenses)}`, 15, yPos);
    yPos += 8;
    doc.text(`Egresos Este Mes: ${formatCurrency(monthExpenses)}`, 15, yPos);
    yPos += 8;
    doc.text(`Cantidad de Egresos: ${expenses.length}`, 15, yPos);
    yPos += 15;
    
    // UTILIDAD NETA
    doc.setFont(undefined, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text('UTILIDAD NETA', 15, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    const profitColor = netProfit >= 0 ? [22, 163, 74] : [220, 38, 38];
    doc.setTextColor(...profitColor);
    doc.text(`Total: ${formatCurrency(netProfit)}`, 15, yPos);
    yPos += 8;
    
    const monthProfitColor = monthNetProfit >= 0 ? [22, 163, 74] : [220, 38, 38];
    doc.setTextColor(...monthProfitColor);
    doc.text(`Este Mes: ${formatCurrency(monthNetProfit)}`, 15, yPos);
    
    addSignatureToDocument(doc, 240);
    
    // PÁGINA 3: DETALLE DE PAGOS (con factura, fecha y documento)
    doc.addPage();
    
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('DETALLE DE PAGOS POR JUGADOR', 15, 30);
    
    yPos = 45;
    doc.setFontSize(7);
    
    // 🆕 Encabezado con Factura, Fecha y Documento
    doc.setFillColor(...primaryColor);
    doc.rect(15, yPos, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Jugador', 17, yPos + 5);
    doc.text('Documento', 50, yPos + 5);
    doc.text('Factura', 85, yPos + 5);
    doc.text('Fecha', 110, yPos + 5);
    doc.text('Pagado', 145, yPos + 5);
    doc.text('Pendiente', 170, yPos + 5);
    
    yPos += 8;
    
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    
    // Mostrar pagos individuales con factura, fecha y documento
    const allPaymentsSorted = [...payments].sort((a, b) => new Date(b.paidDate || b.dueDate) - new Date(a.paidDate || a.dueDate));
    
    allPaymentsSorted.forEach((payment, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
        
        // Repetir encabezado
        doc.setFillColor(...primaryColor);
        doc.rect(15, yPos, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.text('Jugador', 17, yPos + 5);
        doc.text('Documento', 50, yPos + 5);
        doc.text('Factura', 85, yPos + 5);
        doc.text('Fecha', 110, yPos + 5);
        doc.text('Pagado', 145, yPos + 5);
        doc.text('Pendiente', 170, yPos + 5);
        yPos += 8;
        doc.setFont(undefined, 'normal');
      }
      
      const player = getPlayerById(payment.playerId);
      if (!player) return;
      
      const bgColor = index % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
      doc.setFillColor(...bgColor);
      doc.rect(15, yPos, 180, 7, 'F');
      
      doc.setTextColor(...textColor);
      doc.text(normalizeForPDF(player.name.substring(0, 18)), 17, yPos + 5);
      
      // 🆕 Documento
      const docText = player.documentType && player.documentNumber 
        ? `${player.documentType}: ${player.documentNumber.substring(0, 10)}` 
        : '-';
      doc.text(docText, 50, yPos + 5);
      
      doc.text(payment.invoiceNumber || '-', 85, yPos + 5);
      doc.text(formatDate(payment.paidDate || payment.dueDate), 110, yPos + 5);
      
      if (payment.status === 'Pagado') {
        doc.setTextColor(22, 163, 74);
        doc.text(formatCurrency(payment.amount), 145, yPos + 5);
        doc.setTextColor(...textColor);
        doc.text('-', 175, yPos + 5);
      } else {
        doc.text('-', 150, yPos + 5);
        doc.setTextColor(220, 38, 38);
        doc.text(formatCurrency(payment.amount), 170, yPos + 5);
      }
      
      doc.setTextColor(...textColor);
      yPos += 7;
    });
    
    // Pie de página con números
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Pagina ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }
    
    doc.save(`Reporte-Contable-${getCurrentDate()}.pdf`);
    showToast('✅ Reporte completo descargado');
    
    console.log('📊 Reporte generado con:');
    console.log('  - Pagos:', payments.length);
    console.log('  - Otros Ingresos:', thirdPartyIncomes.length);
    console.log('  - Egresos:', expenses.length);
    console.log('  - Total Ingresos:', formatCurrency(totalIncome));
    
  } catch (error) {
    console.error('Error al generar reporte:', error);
    showToast('❌ Error al generar reporte: ' + error.message);
  }
}

/// ========================================
// COMPROBANTE DE EGRESO (CON FIRMA Y EMOJIS)
// ========================================
function generateExpenseInvoicePDF(expenseId, autoDownload = true) {
  const expense = getExpenseById(expenseId);
  if (!expense) {
    showToast('❌ Egreso no encontrado');
    return null;
  }
  
  const settings = getSchoolSettings();
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const primaryColor = [13, 148, 136];
    const textColor = [31, 41, 55];
    const redColor = [220, 38, 38];
    
    // Logo
    try {
      if (settings.logo && settings.logo.startsWith('data:image')) {
        doc.addImage(settings.logo, 'PNG', 15, 15, 30, 30);
      }
    } catch (e) {}
    
    // Encabezado
    doc.setFontSize(20);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text(normalizeForPDF(settings.name || 'MI CLUB'), 50, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    if (settings.email) doc.text(settings.email, 50, 32);
    if (settings.phone) doc.text(settings.phone, 50, 37);
    if (settings.address) doc.text(normalizeForPDF(settings.address), 50, 42);
    
    // Título
    doc.setFontSize(18);
    doc.setTextColor(...redColor);
    doc.setFont(undefined, 'bold');
    doc.text('COMPROBANTE DE EGRESO', 140, 25);
    
    // Línea separadora
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(15, 50, 195, 50);
    
    // 📄 Factura
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...textColor);
    doc.text('Factura:', 15, 60);
    doc.setFont(undefined, 'normal');
    doc.text(expense.invoiceNumber || 'N/A', 50, 60);
    
    // 👤 Beneficiario
    doc.setFont(undefined, 'bold');
    doc.text('Beneficiario:', 15, 68);
    doc.setFont(undefined, 'normal');
    doc.text(normalizeForPDF(expense.beneficiaryName), 50, 68);
    
    // 🪪 Documento del beneficiario (si existe)
    let yPos = 76;
    if (expense.beneficiaryDocument) {
      doc.setFont(undefined, 'bold');
      doc.text('Documento:', 15, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(expense.beneficiaryDocument, 50, yPos);
      yPos += 8;
    }
    
    // 💰 Concepto
    doc.setFont(undefined, 'bold');
    doc.text('Concepto:', 15, yPos);
    doc.setFont(undefined, 'normal');
    const conceptLines = doc.splitTextToSize(normalizeForPDF(expense.concept), 140);
    doc.text(conceptLines, 50, yPos);
    
    // Calcular Y position después del concepto
    const conceptHeight = conceptLines.length * 5;
    yPos = yPos + conceptHeight + 2;
    
    // 💵 Monto
    doc.setFont(undefined, 'bold');
    doc.text('Monto:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...redColor);
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text(formatCurrency(expense.amount), 50, yPos);
    
    yPos += 8;
    
    // 📅 Fecha
    doc.setFontSize(11);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'bold');
    doc.text('Fecha:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(formatDate(expense.date), 50, yPos);
    
    yPos += 8;
    
    // 💳 Método
    if (expense.method) {
      doc.setFont(undefined, 'bold');
      doc.text('Metodo:', 15, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(normalizeForPDF(expense.method), 50, yPos);
      yPos += 8;
    }
    
    // ✅ Estado
    doc.setFont(undefined, 'bold');
    doc.setTextColor(22, 163, 74);
    doc.setFontSize(13);
    doc.text('Estado: PAGADO', 15, yPos);
    
    yPos += 15;
    
    // Mensaje
    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.setFont(undefined, 'italic');
    doc.text('Comprobante de pago realizado.', 105, yPos, { align: 'center' });
    
    yPos += 10;
    
    // Línea separadora inferior
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.3);
    doc.line(15, yPos, 195, yPos);
    
    yPos += 10;
    
    // Pie de página
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(normalizeForPDF(settings.name || 'MI CLUB'), 105, yPos, { align: 'center' });
    if (settings.phone) {
      yPos += 5;
      doc.text(settings.phone, 105, yPos, { align: 'center' });
    }
    
    // 🆕 AGREGAR FIRMA AUTOMÁTICA
    addSignatureToDocument(doc, yPos + 20);
    
    if (autoDownload) {
      doc.save(`Egreso-${expense.invoiceNumber || 'SN'}.pdf`);
      showToast('✅ Comprobante descargado');
    }
    
    return doc;
    
  } catch (error) {
    console.error('Error al generar comprobante:', error);
    showToast('❌ Error al generar PDF: ' + error.message);
    return null;
  }
}

// Hacer funciones globales
window.generateExpenseInvoicePDF = generateExpenseInvoicePDF;
window.generateInvoicePDF = generateInvoicePDF;
window.generatePaymentNotificationPDF = generatePaymentNotificationPDF;
window.generatePlayerAccountStatementPDF = generatePlayerAccountStatementPDF;
window.generateFullAccountingReportPDF = generateFullAccountingReportPDF;
window.formatDocumentForPDF = formatDocumentForPDF;

console.log('✅ pdf.js cargado con DOCUMENTO DE IDENTIDAD + FIRMAS AUTOMÁTICAS');