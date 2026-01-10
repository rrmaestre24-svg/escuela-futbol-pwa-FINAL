// ========================================
// GENERACIÓN DE PDFs con jsPDF + FIRMAS AUTOMÁTICAS
// ✅ CORREGIDO: Zona horaria en todas las fechas
// ========================================

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
  doc.text(currentUser.name, textX, yPosition + 8);
  
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
// FACTURAS DE INGRESOS (CON FIRMA)
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
    doc.text(settings.name || 'MI CLUB', 50, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    if (settings.email) doc.text(settings.email, 50, 32);
    if (settings.phone) doc.text(settings.phone, 50, 37);
    if (settings.address) doc.text(settings.address, 50, 42);
    
    // Título FACTURA
    doc.setFontSize(24);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('FACTURA', 150, 25);
    
    // Número de factura
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.text(payment.invoiceNumber || 'N/A', 150, 35);
    
    // ✅ CORREGIDO: Fecha usa formatDate que ya maneja zona horaria
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Fecha: ${formatDate(payment.paidDate || payment.dueDate)}`, 150, 42);
    
    // Línea separadora
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(15, 50, 195, 50);
    
    // Datos del jugador
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('DATOS DEL CLIENTE', 15, 60);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...textColor);
    doc.text(`Nombre: ${player.name}`, 15, 68);
    doc.text(`Categoria: ${player.category}`, 15, 75);
    doc.text(`Telefono: ${player.phone}`, 15, 82);
    if (player.email) {
      doc.text(`Email: ${player.email}`, 15, 89);
    }
    
    // Tabla de conceptos
    const tableTop = 105;
    
    doc.setFillColor(...primaryColor);
    doc.rect(15, tableTop, 180, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text('CONCEPTO', 20, tableTop + 7);
    doc.text('CANT', 100, tableTop + 7);
    doc.text('PRECIO', 130, tableTop + 7);
    doc.text('TOTAL', 165, tableTop + 7);
    
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    const rowTop = tableTop + 15;
    
    doc.text(payment.concept, 20, rowTop);
    doc.text('1', 105, rowTop);
    doc.text(formatCurrency(payment.amount), 130, rowTop);
    doc.text(formatCurrency(payment.amount), 165, rowTop);
    
    // Totales
    const totalsTop = rowTop + 20;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', 130, totalsTop);
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.text(formatCurrency(payment.amount), 165, totalsTop);
    
    // Método de pago
    if (payment.method) {
      doc.setTextColor(...textColor);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Metodo de pago: ${payment.method}`, 15, totalsTop + 10);
    }
    
    // Estado
    doc.setFont(undefined, 'bold');
    if (payment.status === 'Pagado') {
      doc.setTextColor(22, 163, 74);
      doc.text('PAGADO', 15, totalsTop + 20);
    } else {
      doc.setTextColor(220, 38, 38);
      doc.text('PENDIENTE', 15, totalsTop + 20);
    }
    
    // Pie de página
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.text('Gracias por tu preferencia', 105, 220, { align: 'center' });
    doc.text(settings.name || 'MI CLUB', 105, 225, { align: 'center' });
    
    // 🆕 AGREGAR FIRMA AUTOMÁTICA
    addSignatureToDocument(doc, 235);
    
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
// NOTIFICACIÓN DE PAGO (CON FIRMA)
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
    doc.text(settings.name || 'MI CLUB', 50, 25);
    
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
    doc.text(`Estimado(a) acudiente de: ${player.name}`, 15, 85);
    doc.text(`Categoria: ${player.category}`, 15, 92);
    
    // Detalle del pago
    doc.setFont(undefined, 'bold');
    doc.text('Detalle del Pago:', 15, 110);
    
    doc.setFont(undefined, 'normal');
    doc.text(`Concepto: ${payment.concept}`, 15, 120);
    doc.text(`Monto: ${formatCurrency(payment.amount)}`, 15, 127);
    doc.text(`Fecha de vencimiento: ${formatDate(payment.dueDate)}`, 15, 134);
    
    if (daysDiff < 0) {
      doc.setTextColor(...redColor);
      doc.setFont(undefined, 'bold');
      doc.text(`Dias de retraso: ${Math.abs(daysDiff)} dias`, 15, 141);
    } else if (daysDiff <= 10) {
      doc.setTextColor(...yellowColor);
      doc.setFont(undefined, 'bold');
      doc.text(`Dias para vencimiento: ${daysDiff} dias`, 15, 141);
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
    doc.text(lines, 15, 160);
    
    // Información de contacto
    doc.setFont(undefined, 'bold');
    doc.text('Para mas informacion, contactenos:', 15, 190);
    doc.setFont(undefined, 'normal');
    if (settings.phone) doc.text(`Telefono: ${settings.phone}`, 15, 197);
    if (settings.email) doc.text(`Email: ${settings.email}`, 15, 204);
    
    // 🆕 AGREGAR FIRMA AUTOMÁTICA
    addSignatureToDocument(doc, 220);
    
    doc.save(`Notificacion-${player.name}-${getCurrentDate()}.pdf`);
    showToast('✅ Notificación descargada');
    
  } catch (error) {
    console.error('Error al generar notificación PDF:', error);
    showToast('❌ Error al generar PDF: ' + error.message);
  }
}

// ========================================
// ESTADO DE CUENTA (CON FIRMA)
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
    doc.text(settings.name || 'MI CLUB', 50, 25);
    
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
    doc.text(`Jugador: ${player.name}`, 15, 65);
    doc.text(`Categoria: ${player.category}`, 15, 72);
    doc.text(`Fecha: ${formatDate(getCurrentDate())}`, 15, 79);
    
    doc.setDrawColor(...primaryColor);
    doc.line(15, 85, 195, 85);
    
    // Calcular totales
    const paid = payments.filter(p => p.status === 'Pagado');
    const pending = payments.filter(p => p.status === 'Pendiente');
    const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
    
    // Resumen
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('RESUMEN', 15, 95);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Total Pagado: ${formatCurrency(totalPaid)}`, 15, 103);
    doc.text(`Total Pendiente: ${formatCurrency(totalPending)}`, 15, 110);
    doc.text(`Total Pagos: ${payments.length}`, 15, 117);
    
    // Tabla de pagos
    let yPos = 130;
    
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
// 🆕 REPORTE CONTABLE COMPLETO - CORREGIDO
// INCLUYE: Otros Ingresos + Factura/Fecha en tablas
// ========================================
// 
// INSTRUCCIONES:
// 1. Abre tu archivo pdf.js
// 2. Busca la función "function generateFullAccountingReportPDF()"
// 3. Borra toda la función (desde "function generateFullAccountingReportPDF()" hasta su llave de cierre "}")
// 4. Pega esta función en su lugar
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
    doc.text(settings.name || 'MI CLUB', 105, 150, { align: 'center' });
    
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
    
    // PÁGINA 3: DETALLE DE PAGOS (con factura y fecha)
    doc.addPage();
    
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('DETALLE DE PAGOS POR JUGADOR', 15, 30);
    
    yPos = 45;
    doc.setFontSize(8);
    
    // 🆕 Encabezado con Factura y Fecha
    doc.setFillColor(...primaryColor);
    doc.rect(15, yPos, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Jugador', 17, yPos + 5);
    doc.text('Categoría', 55, yPos + 5);
    doc.text('Factura', 90, yPos + 5);
    doc.text('Fecha', 115, yPos + 5);
    doc.text('Pagado', 145, yPos + 5);
    doc.text('Pendiente', 170, yPos + 5);
    
    yPos += 8;
    
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    
    // Mostrar pagos individuales con factura y fecha
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
        doc.text('Categoría', 55, yPos + 5);
        doc.text('Factura', 90, yPos + 5);
        doc.text('Fecha', 115, yPos + 5);
        doc.text('Pagado', 145, yPos + 5);
        doc.text('Pendiente', 170, yPos + 5);
        yPos += 8;
        doc.setFont(undefined, 'normal');
      }
      
      const player = getPlayerById(payment.playerId);
      const playerName = player ? player.name.substring(0, 18) : 'Desconocido';
      const playerCategory = player ? player.category.substring(0, 12) : 'N/A';
      
      const bgColor = index % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
      doc.setFillColor(...bgColor);
      doc.rect(15, yPos, 180, 7, 'F');
      
      doc.setTextColor(...textColor);
      doc.text(playerName, 17, yPos + 5);
      doc.text(playerCategory, 55, yPos + 5);
      doc.text(payment.invoiceNumber || 'N/A', 90, yPos + 5);
      doc.text(formatDate(payment.paidDate || payment.dueDate), 115, yPos + 5);
      
      if (payment.status === 'Pagado') {
        doc.setTextColor(22, 163, 74);
        doc.text(formatCurrency(payment.amount), 145, yPos + 5);
        doc.setTextColor(...textColor);
        doc.text('$0', 170, yPos + 5);
      } else {
        doc.text('$0', 145, yPos + 5);
        doc.setTextColor(220, 38, 38);
        doc.text(formatCurrency(payment.amount), 170, yPos + 5);
      }
      
      doc.setTextColor(...textColor);
      yPos += 7;
    });
    
    // 🆕 PÁGINA: DETALLE DE OTROS INGRESOS
    if (thirdPartyIncomes.length > 0) {
      doc.addPage();
      
      doc.setFontSize(18);
      doc.setTextColor(...purpleColor);
      doc.setFont(undefined, 'bold');
      doc.text('DETALLE DE OTROS INGRESOS', 15, 30);
      
      yPos = 45;
      doc.setFontSize(8);
      
      doc.setFillColor(...purpleColor);
      doc.rect(15, yPos, 180, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('Factura', 17, yPos + 5);
      doc.text('Fecha', 40, yPos + 5);
      doc.text('Aportante', 65, yPos + 5);
      doc.text('Categoría', 110, yPos + 5);
      doc.text('Concepto', 140, yPos + 5);
      doc.text('Monto', 175, yPos + 5);
      
      yPos += 8;
      
      doc.setTextColor(...textColor);
      doc.setFont(undefined, 'normal');
      
      thirdPartyIncomes.forEach((income, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
          
          // Repetir encabezado
          doc.setFillColor(...purpleColor);
          doc.rect(15, yPos, 180, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont(undefined, 'bold');
          doc.text('Factura', 17, yPos + 5);
          doc.text('Fecha', 40, yPos + 5);
          doc.text('Aportante', 65, yPos + 5);
          doc.text('Categoría', 110, yPos + 5);
          doc.text('Concepto', 140, yPos + 5);
          doc.text('Monto', 175, yPos + 5);
          yPos += 8;
          doc.setFont(undefined, 'normal');
        }
        
        const bgColor = index % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
        doc.setFillColor(...bgColor);
        doc.rect(15, yPos, 180, 7, 'F');
        
        doc.setTextColor(...textColor);
        doc.text(income.invoiceNumber || 'N/A', 17, yPos + 5);
        doc.text(formatDate(income.date), 40, yPos + 5);
        doc.text((income.contributorName || 'N/A').substring(0, 18), 65, yPos + 5);
        doc.text((income.category || 'N/A').substring(0, 12), 110, yPos + 5);
        doc.text((income.concept || 'N/A').substring(0, 15), 140, yPos + 5);
        doc.setTextColor(...purpleColor);
        doc.text(formatCurrency(income.amount), 175, yPos + 5);
        doc.setTextColor(...textColor);
        
        yPos += 7;
      });
      
      // Total otros ingresos
      yPos += 5;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text('TOTAL OTROS INGRESOS:', 110, yPos);
      doc.setTextColor(...purpleColor);
      doc.setFontSize(13);
      doc.text(formatCurrency(totalThirdPartyIncome), 175, yPos);
    }
    
    // PÁGINA: DETALLE DE EGRESOS
    if (expenses.length > 0) {
      doc.addPage();
      
      doc.setFontSize(18);
      doc.setTextColor(220, 38, 38);
      doc.setFont(undefined, 'bold');
      doc.text('DETALLE DE EGRESOS', 15, 30);
      
      yPos = 45;
      doc.setFontSize(8);
      
      doc.setFillColor(220, 38, 38);
      doc.rect(15, yPos, 180, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('Factura', 17, yPos + 5);
      doc.text('Fecha', 40, yPos + 5);
      doc.text('Beneficiario', 65, yPos + 5);
      doc.text('Categoría', 115, yPos + 5);
      doc.text('Monto', 170, yPos + 5);
      
      yPos += 8;
      
      doc.setTextColor(...textColor);
      doc.setFont(undefined, 'normal');
      
      expenses.forEach((expense, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
          
          // Repetir encabezado
          doc.setFillColor(220, 38, 38);
          doc.rect(15, yPos, 180, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont(undefined, 'bold');
          doc.text('Factura', 17, yPos + 5);
          doc.text('Fecha', 40, yPos + 5);
          doc.text('Beneficiario', 65, yPos + 5);
          doc.text('Categoría', 115, yPos + 5);
          doc.text('Monto', 170, yPos + 5);
          yPos += 8;
          doc.setFont(undefined, 'normal');
        }
        
        const bgColor = index % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
        doc.setFillColor(...bgColor);
        doc.rect(15, yPos, 180, 7, 'F');
        
        doc.setTextColor(...textColor);
        doc.text(expense.invoiceNumber || 'N/A', 17, yPos + 5);
        doc.text(formatDate(expense.date), 40, yPos + 5);
        doc.text(expense.beneficiaryName.substring(0, 22), 65, yPos + 5);
        doc.text(expense.category, 115, yPos + 5);
        doc.setTextColor(220, 38, 38);
        doc.text(formatCurrency(expense.amount), 170, yPos + 5);
        doc.setTextColor(...textColor);
        
        yPos += 7;
      });
      
      yPos += 5;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text('TOTAL EGRESOS:', 115, yPos);
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(13);
      doc.text(formatCurrency(totalExpenses), 170, yPos);
    }
    
    // Pie de página con números
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
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

// ========================================
// COMPROBANTE DE EGRESO (CON FIRMA)
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
    doc.text(settings.name || 'MI CLUB', 50, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    if (settings.email) doc.text(settings.email, 50, 32);
    if (settings.phone) doc.text(settings.phone, 50, 37);
    if (settings.address) doc.text(settings.address, 50, 42);
    
    // Título
    doc.setFontSize(22);
    doc.setTextColor(...redColor);
    doc.setFont(undefined, 'bold');
    doc.text('COMPROBANTE DE PAGO', 150, 25);
    
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.text(expense.invoiceNumber || 'N/A', 150, 35);
    
    // ✅ CORREGIDO: Usa formatDate que ya maneja zona horaria
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Fecha: ${formatDate(expense.date)}`, 150, 42);
    
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(15, 50, 195, 50);
    
    // Beneficiario
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('BENEFICIARIO', 15, 60);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...textColor);
    doc.text(`Nombre: ${expense.beneficiaryName}`, 15, 68);
    
    if (expense.beneficiaryType === 'internal') {
      doc.text('Tipo: Usuario/Staff Interno', 15, 75);
    } else {
      doc.text('Tipo: Proveedor Externo', 15, 75);
      if (expense.beneficiaryDocument) {
        doc.text(`Documento: ${expense.beneficiaryDocument}`, 15, 82);
      }
    }
    
    if (expense.beneficiaryPhone) {
      const yPos = expense.beneficiaryDocument ? 89 : 82;
      doc.text(`Telefono: ${formatPhoneDisplay(expense.beneficiaryPhone)}`, 15, yPos);
    }
    
    // Tabla
    const tableTop = 105;
    
    doc.setFillColor(...redColor);
    doc.rect(15, tableTop, 180, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text('CATEGORIA', 20, tableTop + 7);
    doc.text('CONCEPTO', 70, tableTop + 7);
    doc.text('MONTO', 165, tableTop + 7);
    
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    const rowTop = tableTop + 15;
    
    doc.text(expense.category, 20, rowTop);
    
    const conceptLines = doc.splitTextToSize(expense.concept, 90);
    doc.text(conceptLines, 70, rowTop);
    
    doc.text(formatCurrency(expense.amount), 165, rowTop);
    
    // Total
    const totalsTop = rowTop + 25;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL PAGADO:', 110, totalsTop);
    doc.setTextColor(...redColor);
    doc.setFontSize(16);
    doc.text(formatCurrency(expense.amount), 165, totalsTop);
    
    doc.setTextColor(22, 163, 74);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('✓ PAGADO', 15, totalsTop);
    
    // Mensaje
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.text('Este documento certifica el pago realizado', 105, 190, { align: 'center' });
    doc.text(settings.name || 'MI CLUB', 105, 197, { align: 'center' });
    
    // 🆕 AGREGAR FIRMA AUTOMÁTICA
    addSignatureToDocument(doc, 210);
    
    if (autoDownload) {
      doc.save(`Comprobante-Pago-${expense.invoiceNumber || 'SN'}.pdf`);
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

console.log('✅ pdf.js cargado con ZONA HORARIA CORREGIDA + FIRMAS AUTOMÁTICAS');