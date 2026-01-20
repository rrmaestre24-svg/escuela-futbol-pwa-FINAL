// ========================================
// CONTABILIDAD COMPLETA - CON EGRESOS Y OTROS INGRESOS
// 🆕 CSV MEJORADO: Factura, Fecha, Otros Ingresos
// 🆕 INCLUYE DOCUMENTO DE IDENTIDAD
// ========================================

console.log('📄 Cargando accounting.js con egresos, otros ingresos y documento de identidad...');

let accountingCharts = {};

// FUNCIÓN PRINCIPAL - Mostrar vista de contabilidad
function showAccountingView() {
  console.log('📊 Botón de contabilidad presionado');
  
  try {
    // Ocultar todas las vistas
    const allViews = document.querySelectorAll('#appContainer > main > div');
    allViews.forEach(view => {
      view.classList.add('hidden');
    });
    
    // Mostrar vista de contabilidad
    const accountingView = document.getElementById('accountingView');
    
    if (!accountingView) {
      console.error('❌ ERROR: accountingView no existe en el HTML');
      alert('Error: Vista de contabilidad no encontrada');
      return;
    }
    
    accountingView.classList.remove('hidden');
    console.log('✅ Vista de contabilidad mostrada');
    
    // Actualizar header
    document.getElementById('headerViewName').textContent = 'Contabilidad';
    
    // Desactivar navegación
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Renderizar contenido
    renderAccounting();
    
    // Scroll arriba
    window.scrollTo(0, 0);
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    alert('Error: ' + error.message);
  }
}

// Renderizar todo
function renderAccounting() {
  console.log('📊 Renderizando contabilidad...');
  renderAccountingSummary();
  renderAccountingCharts();
  renderAccountingPlayersTable();
}

// 🆕 RESUMEN MEJORADO - CON EGRESOS Y OTROS INGRESOS
function renderAccountingSummary() {
  const payments = getPayments();
  const expenses = getExpenses();
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [];
  
  const paid = payments.filter(p => p.status === 'Pagado');
  const pending = payments.filter(p => p.status === 'Pendiente');
  
  // 💰 INGRESOS (Pagos de jugadores + Otros ingresos)
  const totalThirdParty = thirdPartyIncomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalPaymentsIncome = paid.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalIncome = totalPaymentsIncome + totalThirdParty;
  const totalPending = pending.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const thisMonth = paid.filter(p => p.paidDate && isThisMonth(p.paidDate));
  const thisMonthThirdParty = thirdPartyIncomes.filter(i => i.date && isThisMonth(i.date));
  const monthThirdParty = thisMonthThirdParty.reduce((sum, i) => sum + (i.amount || 0), 0);
  const monthPaymentsIncome = thisMonth.reduce((sum, p) => sum + (p.amount || 0), 0);
  const monthIncome = monthPaymentsIncome + monthThirdParty;
  
  // 💸 EGRESOS
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const thisMonthExpenses = expenses.filter(e => e.date && isThisMonth(e.date));
  const monthExpenses = thisMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  // 📊 UTILIDAD NETA
  const netProfit = totalIncome - totalExpenses;
  const monthNetProfit = monthIncome - monthExpenses;
  
  // Actualizar UI
  const accTotalIncome = document.getElementById('accTotalIncome');
  if (accTotalIncome) accTotalIncome.textContent = formatCurrency(totalIncome);
  
  const accMonthIncome = document.getElementById('accMonthIncome');
  if (accMonthIncome) accMonthIncome.textContent = formatCurrency(monthIncome);
  
  const accPending = document.getElementById('accPending');
  if (accPending) accPending.textContent = formatCurrency(totalPending);
  
  const accPaidCount = document.getElementById('accPaidCount');
  if (accPaidCount) accPaidCount.textContent = paid.length;
  
  // 🆕 Actualizar nuevos campos (si existen en el HTML)
  const totalExpensesEl = document.getElementById('accTotalExpenses');
  if (totalExpensesEl) {
    totalExpensesEl.textContent = formatCurrency(totalExpenses);
  }
  
  const monthExpensesEl = document.getElementById('accMonthExpenses');
  if (monthExpensesEl) {
    monthExpensesEl.textContent = formatCurrency(monthExpenses);
  }
  
  const netProfitEl = document.getElementById('accNetProfit');
  if (netProfitEl) {
    netProfitEl.textContent = formatCurrency(netProfit);
    
    // Cambiar color según sea positivo o negativo
    if (netProfit >= 0) {
      netProfitEl.classList.add('text-green-600');
      netProfitEl.classList.remove('text-red-600');
    } else {
      netProfitEl.classList.add('text-red-600');
      netProfitEl.classList.remove('text-green-600');
    }
  }
  
  const monthNetProfitEl = document.getElementById('accMonthNetProfit');
  if (monthNetProfitEl) {
    monthNetProfitEl.textContent = formatCurrency(monthNetProfit);
    
    if (monthNetProfit >= 0) {
      monthNetProfitEl.classList.add('text-green-600');
      monthNetProfitEl.classList.remove('text-red-600');
    } else {
      monthNetProfitEl.classList.add('text-red-600');
      monthNetProfitEl.classList.remove('text-green-600');
    }
  }
  
  console.log('📊 Resumen calculado:');
  console.log('  💰 Pagos jugadores:', formatCurrency(totalPaymentsIncome));
  console.log('  💜 Otros ingresos:', formatCurrency(totalThirdParty));
  console.log('  💰 Ingresos totales:', formatCurrency(totalIncome));
  console.log('  💸 Egresos totales:', formatCurrency(totalExpenses));
  console.log('  📊 Utilidad neta:', formatCurrency(netProfit));
  console.log('  📅 Este mes (neto):', formatCurrency(monthNetProfit));
}

// Renderizar gráficos
function renderAccountingCharts() {
  // Destruir gráficos anteriores
  Object.values(accountingCharts).forEach(chart => {
    if (chart) chart.destroy();
  });
  
  if (typeof Chart === 'undefined') {
    console.warn('⚠️ Chart.js no disponible');
    return;
  }
  
  renderIncomeVsExpensesChart();
  renderIncomeByCategoryChart();
  renderIncomeByTypeChart();
}

// 🆕 GRÁFICO DUAL: Ingresos vs Egresos (INCLUYE OTROS INGRESOS)
function renderIncomeVsExpensesChart() {
  const ctx = document.getElementById('incomeByMonthChart');
  if (!ctx) return;
  
  const payments = getPayments().filter(p => p.status === 'Pagado' && p.paidDate);
  const expenses = getExpenses();
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [];
  
  const today = new Date();
  const labels = [];
  const incomeData = [];
  const expenseData = [];
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthName = getMonthName(date.getMonth());
    labels.push(monthName.substring(0, 3));
    
    // Ingresos del mes (pagos + otros ingresos)
    const monthPayments = payments.filter(p => {
      const paymentDate = new Date(p.paidDate);
      return paymentDate.getMonth() === date.getMonth() && 
             paymentDate.getFullYear() === date.getFullYear();
    });
    const paymentsTotal = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // 🆕 Otros ingresos del mes
    const monthThirdParty = thirdPartyIncomes.filter(i => {
      if (!i.date) return false;
      const incomeDate = new Date(i.date);
      return incomeDate.getMonth() === date.getMonth() && 
             incomeDate.getFullYear() === date.getFullYear();
    });
    const thirdPartyTotal = monthThirdParty.reduce((sum, i) => sum + (i.amount || 0), 0);
    
    incomeData.push(paymentsTotal + thirdPartyTotal);
    
    // Egresos del mes
    const monthExpenses = expenses.filter(e => {
      if (!e.date) return false;
      const expenseDate = new Date(e.date);
      return expenseDate.getMonth() === date.getMonth() && 
             expenseDate.getFullYear() === date.getFullYear();
    });
    expenseData.push(monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0));
  }
  
  accountingCharts.byMonth = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ingresos',
          data: incomeData,
          backgroundColor: 'rgba(13, 148, 136, 0.8)',
          borderColor: 'rgba(13, 148, 136, 1)',
          borderWidth: 1
        },
        {
          label: 'Egresos',
          data: expenseData,
          backgroundColor: 'rgba(220, 38, 38, 0.8)',
          borderColor: 'rgba(220, 38, 38, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: { 
        legend: { 
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatCurrency(value);
            }
          }
        }
      }
    }
  });
  
  console.log('✅ Gráfico dual Ingresos vs Egresos creado');
}

// Gráfico: Ingresos por categoría
function renderIncomeByCategoryChart() {
  const ctx = document.getElementById('incomeByCategoryChart');
  if (!ctx) return;
  
  const players = getPlayers();
  const payments = getPayments().filter(p => p.status === 'Pagado');
  
  // Obtener categorías únicas de los jugadores
  const uniqueCategories = [...new Set(players.map(p => p.category))];
  const data = [];
  
  uniqueCategories.forEach(category => {
    const categoryPlayers = players.filter(p => p.category === category);
    const playerIds = categoryPlayers.map(p => p.id);
    const categoryPayments = payments.filter(p => playerIds.includes(p.playerId));
    data.push(categoryPayments.reduce((sum, p) => sum + (p.amount || 0), 0));
  });
  
  const colors = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)',
    'rgba(13, 148, 136, 0.8)',
    'rgba(251, 146, 60, 0.8)'
  ];
  
  accountingCharts.byCategory = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: uniqueCategories,
      datasets: [{
        data: data,
        backgroundColor: colors.slice(0, uniqueCategories.length)
      }]
    },
    options: {
      responsive: true,
      plugins: { 
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + formatCurrency(context.parsed);
            }
          }
        }
      }
    }
  });
}

// Gráfico: Ingresos por tipo
function renderIncomeByTypeChart() {
  const ctx = document.getElementById('incomeByTypeChart');
  if (!ctx) return;
  
  const payments = getPayments().filter(p => p.status === 'Pagado');
  const types = ['Mensualidad', 'Uniforme', 'Torneo', 'Equipamiento', 'Otro'];
  const data = [];
  
  types.forEach(type => {
    const typePayments = payments.filter(p => p.type === type);
    data.push(typePayments.reduce((sum, p) => sum + (p.amount || 0), 0));
  });
  
  accountingCharts.byType = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: types,
      datasets: [{
        data: data,
        backgroundColor: [
          'rgba(13, 148, 136, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(156, 163, 175, 0.8)'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: { 
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + formatCurrency(context.parsed.r);
            }
          }
        }
      }
    }
  });
}

// Tabla de jugadores - 🆕 CON DOCUMENTO DE IDENTIDAD
function renderAccountingPlayersTable() {
  const tbody = document.getElementById('accountingPlayersTable');
  if (!tbody) return;
  
  const players = getPlayers();
  
  if (players.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500 dark:text-gray-400">No hay jugadores</td></tr>';
    return;
  }
  
  tbody.innerHTML = players.map(player => {
    const payments = getPaymentsByPlayer(player.id);
    const paid = payments.filter(p => p.status === 'Pagado');
    const pending = payments.filter(p => p.status === 'Pendiente');
    
    const totalPaid = paid.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPending = pending.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalExpected = totalPaid + totalPending;
    const compliance = totalExpected > 0 ? (totalPaid / totalExpected * 100) : 0;
    
    const color = compliance >= 80 ? 'bg-green-500' : compliance >= 50 ? 'bg-yellow-500' : 'bg-red-500';
    
    // 🆕 Formatear documento
    const documentInfo = player.documentType && player.documentNumber 
      ? `${player.documentType}: ${player.documentNumber}` 
      : '-';
    
    return `
      <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
        <td class="py-3 text-gray-800 dark:text-white">
          <div class="flex items-center gap-2">
            <img src="${player.avatar || getDefaultAvatar()}" alt="${player.name}" class="w-8 h-8 rounded-full">
            <div>
              <span class="font-medium">${player.name}</span>
              <p class="text-xs text-gray-500 dark:text-gray-400">${documentInfo}</p>
            </div>
          </div>
        </td>
        <td class="py-3 text-gray-800 dark:text-white">${player.category}</td>
        <td class="py-3 text-right text-green-600">${formatCurrency(totalPaid)}</td>
        <td class="py-3 text-right text-red-600">${formatCurrency(totalPending)}</td>
        <td class="py-3">
          <div class="flex items-center gap-2">
            <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div class="${color} h-full rounded-full transition-all" style="width: ${compliance}%"></div>
            </div>
            <span class="text-sm text-gray-600 dark:text-gray-400">${Math.round(compliance)}%</span>
          </div>
        </td>
        <td class="py-3 text-center">
          <button onclick="generatePlayerAccountStatementPDF('${player.id}')" class="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded text-sm">
            Estado PDF
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Generar reporte PDF
function generateFullReport() {
  if (typeof generateFullAccountingReportPDF === 'function') {
    generateFullAccountingReportPDF();
  } else {
    showToast('❌ Función PDF no disponible');
  }
}

// ========================================
// 🆕 EXPORTAR CSV COMPLETO - CON DOCUMENTO DE IDENTIDAD
// ========================================

function exportCSV() {
  const payments = getPayments();
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [];
  
  if (payments.length === 0 && thirdPartyIncomes.length === 0) {
    showToast('⚠️ No hay datos para exportar');
    return;
  }
  
  // 🆕 Exportar pagos individuales con factura, fecha y DOCUMENTO
  const csvData = [];
  
  // Agregar pagos de jugadores
  payments.forEach(payment => {
    const player = getPlayerById(payment.playerId);
    csvData.push({
      'Tipo': 'Pago Jugador',
      'Factura': payment.invoiceNumber || 'N/A',
      'Fecha': payment.paidDate ? formatDate(payment.paidDate) : formatDate(payment.dueDate),
      'Jugador/Aportante': player ? player.name : 'Desconocido',
      'Tipo Documento': player ? (player.documentType || 'N/A') : 'N/A', // 🆕
      'Número Documento': player ? (player.documentNumber || 'N/A') : 'N/A', // 🆕
      'Categoría': player ? player.category : 'N/A',
      'Concepto': payment.concept || payment.type || 'N/A',
      'Monto': payment.amount || 0,
      'Estado': payment.status || 'N/A',
      'Método': payment.method || 'N/A',
      'Teléfono': player ? (player.phone || '') : '',
      'Email': player ? (player.email || '') : ''
    });
  });
  
  // 🆕 Agregar otros ingresos
  thirdPartyIncomes.forEach(income => {
    csvData.push({
      'Tipo': 'Otro Ingreso',
      'Factura': income.invoiceNumber || 'N/A',
      'Fecha': income.date ? formatDate(income.date) : 'N/A',
      'Jugador/Aportante': income.contributorName || 'N/A',
      'Tipo Documento': 'N/A',
      'Número Documento': 'N/A',
      'Categoría': income.category || 'N/A',
      'Concepto': income.concept || 'N/A',
      'Monto': income.amount || 0,
      'Estado': 'Pagado',
      'Método': income.method || 'N/A',
      'Teléfono': income.contributorPhone || '',
      'Email': income.contributorEmail || ''
    });
  });
  
  // Ordenar por fecha (más reciente primero)
  csvData.sort((a, b) => {
    const dateA = a['Fecha'] !== 'N/A' ? new Date(a['Fecha'].split('/').reverse().join('-')) : new Date(0);
    const dateB = b['Fecha'] !== 'N/A' ? new Date(b['Fecha'].split('/').reverse().join('-')) : new Date(0);
    return dateB - dateA;
  });
  
  if (csvData.length === 0) {
    showToast('⚠️ No hay datos para exportar');
    return;
  }
  
  downloadCSV(csvData, `Contabilidad-Ingresos-${getCurrentDate()}.csv`);
  showToast('✅ CSV de ingresos exportado');
  
  console.log('📊 CSV exportado con', csvData.length, 'registros');
}

// 🆕 Exportar resumen por jugador (función adicional) - CON DOCUMENTO
function exportPlayersSummaryCSV() {
  const players = getPlayers();
  if (players.length === 0) {
    showToast('⚠️ No hay jugadores para exportar');
    return;
  }
  
  const csvData = players.map(player => {
    const payments = getPaymentsByPlayer(player.id);
    const paid = payments.filter(p => p.status === 'Pagado');
    const pending = payments.filter(p => p.status === 'Pendiente');
    
    // Obtener última factura
    const lastPayment = paid.sort((a, b) => new Date(b.paidDate || 0) - new Date(a.paidDate || 0))[0];
    
    return {
      'Jugador': player.name || 'N/A',
      'Tipo Documento': player.documentType || 'N/A', // 🆕
      'Número Documento': player.documentNumber || 'N/A', // 🆕
      'Categoría': player.category || 'N/A',
      'Total Pagado': paid.reduce((sum, p) => sum + (p.amount || 0), 0),
      'Total Pendiente': pending.reduce((sum, p) => sum + (p.amount || 0), 0),
      'Cantidad Pagos': paid.length,
      'Última Factura': lastPayment ? (lastPayment.invoiceNumber || 'N/A') : 'N/A',
      'Último Pago': lastPayment ? formatDate(lastPayment.paidDate) : 'N/A',
      'Estado': player.status || 'N/A',
      'Teléfono': player.phone || '',
      'Email': player.email || ''
    };
  });
  
  downloadCSV(csvData, `Resumen-Jugadores-${getCurrentDate()}.csv`);
  showToast('✅ Resumen de jugadores exportado');
}

// 🆕 Exportar reporte completo de egresos
function exportExpensesCSV() {
  const expenses = getExpenses();
  if (expenses.length === 0) {
    showToast('⚠️ No hay egresos para exportar');
    return;
  }
  
  const csvData = expenses.map(expense => {
    return {
      'Factura': expense.invoiceNumber || 'N/A',
      'Fecha': expense.date ? formatDate(expense.date) : 'N/A',
      'Beneficiario': expense.beneficiaryName || 'N/A',
      'Tipo': expense.beneficiaryType === 'internal' ? 'Usuario interno' : 'Proveedor externo',
      'Categoría': expense.category || 'N/A',
      'Concepto': expense.concept || 'N/A',
      'Monto': expense.amount || 0,
      'Método': expense.method || 'N/A',
      'Teléfono': expense.beneficiaryPhone || '',
      'Documento': expense.beneficiaryDocument || '',
      'Notas': expense.notes || ''
    };
  });
  
  downloadCSV(csvData, `Egresos-${getCurrentDate()}.csv`);
  showToast('✅ Egresos exportados');
}

// 🆕 Exportar reporte completo (todo junto) - CON DOCUMENTO
function exportFullReportCSV() {
  const payments = getPayments();
  const expenses = getExpenses();
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [];
  
  if (payments.length === 0 && expenses.length === 0 && thirdPartyIncomes.length === 0) {
    showToast('⚠️ No hay datos para exportar');
    return;
  }
  
  const csvData = [];
  
  // Pagos de jugadores
  payments.forEach(payment => {
    const player = getPlayerById(payment.playerId);
    csvData.push({
      'Tipo Registro': 'INGRESO - Pago Jugador',
      'Factura': payment.invoiceNumber || 'N/A',
      'Fecha': payment.paidDate ? formatDate(payment.paidDate) : formatDate(payment.dueDate),
      'Nombre': player ? player.name : 'Desconocido',
      'Tipo Documento': player ? (player.documentType || 'N/A') : 'N/A', // 🆕
      'Número Documento': player ? (player.documentNumber || 'N/A') : 'N/A', // 🆕
      'Categoría': player ? player.category : 'N/A',
      'Concepto': payment.concept || payment.type || 'N/A',
      'Ingreso': payment.status === 'Pagado' ? (payment.amount || 0) : 0,
      'Egreso': 0,
      'Estado': payment.status || 'N/A',
      'Método': payment.method || 'N/A'
    });
  });
  
  // Otros ingresos
  thirdPartyIncomes.forEach(income => {
    csvData.push({
      'Tipo Registro': 'INGRESO - Otro',
      'Factura': income.invoiceNumber || 'N/A',
      'Fecha': income.date ? formatDate(income.date) : 'N/A',
      'Nombre': income.contributorName || 'N/A',
      'Tipo Documento': 'N/A',
      'Número Documento': 'N/A',
      'Categoría': income.category || 'N/A',
      'Concepto': income.concept || 'N/A',
      'Ingreso': income.amount || 0,
      'Egreso': 0,
      'Estado': 'Pagado',
      'Método': income.method || 'N/A'
    });
  });
  
  // Egresos
  expenses.forEach(expense => {
    csvData.push({
      'Tipo Registro': 'EGRESO',
      'Factura': expense.invoiceNumber || 'N/A',
      'Fecha': expense.date ? formatDate(expense.date) : 'N/A',
      'Nombre': expense.beneficiaryName || 'N/A',
      'Tipo Documento': 'N/A',
      'Número Documento': expense.beneficiaryDocument || 'N/A',
      'Categoría': expense.category || 'N/A',
      'Concepto': expense.concept || 'N/A',
      'Ingreso': 0,
      'Egreso': expense.amount || 0,
      'Estado': 'Pagado',
      'Método': expense.method || 'N/A'
    });
  });
  
  // Ordenar por fecha
  csvData.sort((a, b) => {
    const dateA = a['Fecha'] !== 'N/A' ? new Date(a['Fecha'].split('/').reverse().join('-')) : new Date(0);
    const dateB = b['Fecha'] !== 'N/A' ? new Date(b['Fecha'].split('/').reverse().join('-')) : new Date(0);
    return dateB - dateA;
  });
  
  downloadCSV(csvData, `Reporte-Completo-${getCurrentDate()}.csv`);
  showToast('✅ Reporte completo exportado');
  
  // Mostrar resumen
  const totalIngresos = csvData.reduce((sum, r) => sum + (r['Ingreso'] || 0), 0);
  const totalEgresos = csvData.reduce((sum, r) => sum + (r['Egreso'] || 0), 0);
  console.log('📊 Reporte exportado:');
  console.log('  - Total registros:', csvData.length);
  console.log('  - Total ingresos:', formatCurrency(totalIngresos));
  console.log('  - Total egresos:', formatCurrency(totalEgresos));
  console.log('  - Utilidad:', formatCurrency(totalIngresos - totalEgresos));
}

// Hacer funciones globales
window.exportCSV = exportCSV;
window.exportExpensesCSV = exportExpensesCSV;
window.exportPlayersSummaryCSV = exportPlayersSummaryCSV;
window.exportFullReportCSV = exportFullReportCSV;

console.log('✅ accounting.js cargado correctamente CON DOCUMENTO DE IDENTIDAD');