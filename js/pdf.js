// ========================================
// GENERACIÓN DE PDFs con jsPDF - CORREGIDO
// ========================================

// Generar factura PDF - CORREGIDO
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
    
    // Colores
    const primaryColor = [13, 148, 136];
    const textColor = [31, 41, 55];
    
    // Logo
    let logoY = 15;
    try {
      if (settings.logo && settings.logo.startsWith('data:image')) {
        doc.addImage(settings.logo, 'PNG', 15, logoY, 30, 30);
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
    
    // Fecha
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
    
    // Encabezados de tabla
    doc.setFillColor(...primaryColor);
    doc.rect(15, tableTop, 180, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text('CONCEPTO', 20, tableTop + 7);
    doc.text('CANT', 100, tableTop + 7);
    doc.text('PRECIO', 130, tableTop + 7);
    doc.text('TOTAL', 165, tableTop + 7);
    
    // Fila de datos
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
    doc.text('Gracias por tu preferencia', 105, 270, { align: 'center' });
    
    doc.setFontSize(8);
    doc.text(settings.name || 'MI CLUB', 105, 275, { align: 'center' });
    doc.text(`Generado el ${formatDate(getCurrentDate())}`, 105, 280, { align: 'center' });
    
    // Guardar
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

// Generar notificación de pago PDF - CORREGIDO
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
    
    // Determinar estado
    const today = new Date();
    const dueDate = new Date(payment.dueDate);
    const daysDiff = daysBetween(today, dueDate);
    
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
    
    // Línea
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
    
    // Pie de página
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(`Documento generado el ${formatDate(getCurrentDate())}`, 105, 270, { align: 'center' });
    
    doc.save(`Notificacion-${player.name}-${getCurrentDate()}.pdf`);
    showToast('✅ Notificación descargada');
    
  } catch (error) {
    console.error('Error al generar notificación PDF:', error);
    showToast('❌ Error al generar PDF: ' + error.message);
  }
}

// Generar estado de cuenta por jugador PDF - CORREGIDO
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
    
    // Línea
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
    
    // Encabezados
    doc.setFontSize(9);
    doc.setFillColor(...primaryColor);
    doc.rect(15, yPos, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Fecha', 20, yPos + 5);
    doc.text('Concepto', 50, yPos + 5);
    doc.text('Monto', 120, yPos + 5);
    doc.text('Estado', 155, yPos + 5);
    
    yPos += 8;
    
    // Filas
    doc.setTextColor(...textColor);
    payments.forEach((p, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      const bgColor = index % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
      doc.setFillColor(...bgColor);
      doc.rect(15, yPos, 180, 8, 'F');
      
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
    
    // Pie de página
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado el ${formatDate(getCurrentDate())}`, 105, 285, { align: 'center' });
    
    doc.save(`Estado-Cuenta-${player.name}.pdf`);
    showToast('✅ Estado de cuenta descargado');
    
  } catch (error) {
    console.error('Error al generar estado de cuenta:', error);
    showToast('❌ Error al generar PDF: ' + error.message);
  }
}

// Generar reporte contable completo PDF - CORREGIDO
function generateFullAccountingReportPDF() {
  const settings = getSchoolSettings();
  const players = getPlayers();
  const payments = getPayments();
  
  if (payments.length === 0) {
    showToast('⚠️ No hay datos suficientes para generar el reporte');
    return;
  }
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const primaryColor = [13, 148, 136];
    const textColor = [31, 41, 55];
    
    // ===== PÁGINA 1: PORTADA =====
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 297, 'F');
    
    // Logo
    try {
      if (settings.logo && settings.logo.startsWith('data:image')) {
        doc.addImage(settings.logo, 'PNG', 80, 80, 50, 50);
      }
    } catch (e) {
      console.log('Logo no disponible');
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont(undefined, 'bold');
    doc.text(settings.name || 'MI CLUB', 105, 150, { align: 'center' });
    
    doc.setFontSize(24);
    doc.text('REPORTE CONTABLE', 105, 165, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'normal');
    doc.text(formatDateText(getCurrentDate()), 105, 180, { align: 'center' });
    
    // ===== PÁGINA 2: RESUMEN GENERAL =====
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
    
    // Calcular estadísticas
    const paid = payments.filter(p => p.status === 'Pagado');
    const pending = payments.filter(p => p.status === 'Pendiente');
    const totalIncome = paid.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
    
    const thisMonth = payments.filter(p => p.paidDate && isThisMonth(p.paidDate));
    const monthIncome = thisMonth.reduce((sum, p) => sum + p.amount, 0);
    
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
    yPos += 15;
    
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('INGRESOS', 15, yPos);
    yPos += 10;
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    doc.text(`Total Ingresos: ${formatCurrency(totalIncome)}`, 15, yPos);
    yPos += 8;
    doc.text(`Ingresos Este Mes: ${formatCurrency(monthIncome)}`, 15, yPos);
    yPos += 8;
    doc.text(`Por Cobrar: ${formatCurrency(totalPending)}`, 15, yPos);
    
    // ===== PÁGINA 3: DETALLE POR JUGADOR =====
    doc.addPage();
    
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('DETALLE POR JUGADOR', 15, 30);
    
    yPos = 45;
    doc.setFontSize(9);
    
    // Encabezados
    doc.setFillColor(...primaryColor);
    doc.rect(15, yPos, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Jugador', 20, yPos + 5);
    doc.text('Categoria', 80, yPos + 5);
    doc.text('Pagado', 120, yPos + 5);
    doc.text('Pendiente', 155, yPos + 5);
    
    yPos += 8;
    
    doc.setTextColor(...textColor);
    players.forEach((player, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      const playerPayments = getPaymentsByPlayer(player.id);
      const playerPaid = playerPayments.filter(p => p.status === 'Pagado').reduce((sum, p) => sum + p.amount, 0);
      const playerPending = playerPayments.filter(p => p.status === 'Pendiente').reduce((sum, p) => sum + p.amount, 0);
      
      const bgColor = index % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
      doc.setFillColor(...bgColor);
      doc.rect(15, yPos, 180, 8, 'F');
      
      doc.text(player.name.substring(0, 25), 20, yPos + 5);
      doc.text(player.category, 80, yPos + 5);
      doc.text(formatCurrency(playerPaid), 120, yPos + 5);
      doc.text(formatCurrency(playerPending), 155, yPos + 5);
      
      yPos += 8;
    });
    
    // Pie de página en todas las páginas
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Pagina ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }
    
    doc.save(`Reporte-Contable-${getCurrentDate()}.pdf`);
    showToast('✅ Reporte completo descargado');
    
  } catch (error) {
    console.error('Error al generar reporte:', error);
    showToast('❌ Error al generar reporte: ' + error.message);
  }
}

console.log('✅ pdf.js cargado (CORREGIDO)');

// ========================================
// GENERAR FACTURA DE EGRESO (COMPROBANTE DE PAGO)
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
    
    // Colores
    const primaryColor = [13, 148, 136];
    const textColor = [31, 41, 55];
    const redColor = [220, 38, 38];
    
    // Logo
    let logoY = 15;
    try {
      if (settings.logo && settings.logo.startsWith('data:image')) {
        doc.addImage(settings.logo, 'PNG', 15, logoY, 30, 30);
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
    
    // Título COMPROBANTE DE PAGO
    doc.setFontSize(22);
    doc.setTextColor(...redColor);
    doc.setFont(undefined, 'bold');
    doc.text('COMPROBANTE DE PAGO', 150, 25);
    
    // Número de comprobante
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.text(expense.invoiceNumber || 'N/A', 150, 35);
    
    // Fecha
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Fecha: ${formatDate(expense.date)}`, 150, 42);
    
    // Línea separadora
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(15, 50, 195, 50);
    
    // Datos del beneficiario
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
    
    if (expense.beneficiaryEmail) {
      const yPos = expense.beneficiaryPhone ? (expense.beneficiaryDocument ? 96 : 89) : 82;
      doc.text(`Email: ${expense.beneficiaryEmail}`, 15, yPos);
    }
    
    // Tabla de conceptos
    const tableTop = 110;
    
    // Encabezados de tabla
    doc.setFillColor(...redColor);
    doc.rect(15, tableTop, 180, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text('CATEGORIA', 20, tableTop + 7);
    doc.text('CONCEPTO', 70, tableTop + 7);
    doc.text('MONTO', 165, tableTop + 7);
    
    // Fila de datos
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    const rowTop = tableTop + 15;
    
    doc.text(expense.category, 20, rowTop);
    
    // Concepto puede ser largo, dividirlo
    const conceptLines = doc.splitTextToSize(expense.concept, 90);
    doc.text(conceptLines, 70, rowTop);
    
    doc.text(formatCurrency(expense.amount), 165, rowTop);
    
    // Método de pago
    const methodTop = rowTop + (conceptLines.length * 5) + 10;
    
    if (expense.method) {
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      doc.text(`Metodo de pago: ${expense.method}`, 15, methodTop);
    }
    
    // Notas
    if (expense.notes && expense.notes.trim() !== '') {
      doc.setFont(undefined, 'bold');
      doc.text('Notas:', 15, methodTop + 10);
      doc.setFont(undefined, 'normal');
      const notesLines = doc.splitTextToSize(expense.notes, 180);
      doc.text(notesLines, 15, methodTop + 17);
    }
    
    // Total
    const totalsTop = methodTop + 35;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL PAGADO:', 110, totalsTop);
    doc.setTextColor(...redColor);
    doc.setFontSize(16);
    doc.text(formatCurrency(expense.amount), 165, totalsTop);
    
    // Estado PAGADO
    doc.setTextColor(22, 163, 74);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('✓ PAGADO', 15, totalsTop);
    
    // Línea de firma
    doc.setTextColor(...textColor);
    doc.setDrawColor(...textColor);
    doc.line(15, 220, 90, 220);
    doc.line(120, 220, 195, 220);
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Firma del Beneficiario', 15, 227);
    doc.text('Firma del Autorizador', 120, 227);
    
    // Pie de página
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.text('Este documento certifica el pago realizado', 105, 260, { align: 'center' });
    
    doc.setFontSize(8);
    doc.text(settings.name || 'MI CLUB', 105, 267, { align: 'center' });
    doc.text(`Generado el ${formatDate(getCurrentDate())}`, 105, 273, { align: 'center' });
    
    // Guardar
    if (autoDownload) {
      doc.save(`Comprobante-Pago-${expense.invoiceNumber || 'SN'}.pdf`);
      showToast('✅ Comprobante descargado');
    }
    
    return doc;
    
  } catch (error) {
    console.error('Error al generar comprobante de pago:', error);
    showToast('❌ Error al generar PDF: ' + error.message);
    return null;
  }
}

// Hacer la función global
window.generateExpenseInvoicePDF = generateExpenseInvoicePDF;