// ========================================
// CONTABILIDAD COMPLETA
// ========================================

console.log('🔄 Cargando accounting.js...');

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

// Resumen (4 tarjetas)
function renderAccountingSummary() {
  const payments = getPayments();
  const paid = payments.filter(p => p.status === 'Pagado');
  const pending = payments.filter(p => p.status === 'Pendiente');
  
  const totalIncome = paid.reduce((sum, p) => sum + p.amount, 0);
  const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
  
  const thisMonth = paid.filter(p => p.paidDate && isThisMonth(p.paidDate));
  const monthIncome = thisMonth.reduce((sum, p) => sum + p.amount, 0);
  
  document.getElementById('accTotalIncome').textContent = formatCurrency(totalIncome);
  document.getElementById('accMonthIncome').textContent = formatCurrency(monthIncome);
  document.getElementById('accPending').textContent = formatCurrency(totalPending);
  document.getElementById('accPaidCount').textContent = paid.length;
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
  
  renderIncomeByMonthChart();
  renderIncomeByCategoryChart();
  renderIncomeByTypeChart();
}

// Gráfico: Ingresos por mes
function renderIncomeByMonthChart() {
  const ctx = document.getElementById('incomeByMonthChart');
  if (!ctx) return;
  
  const payments = getPayments().filter(p => p.status === 'Pagado' && p.paidDate);
  const today = new Date();
  const labels = [];
  const data = [];
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthName = getMonthName(date.getMonth());
    labels.push(monthName.substring(0, 3));
    
    const monthPayments = payments.filter(p => {
      const paymentDate = new Date(p.paidDate);
      return paymentDate.getMonth() === date.getMonth() && 
             paymentDate.getFullYear() === date.getFullYear();
    });
    
    data.push(monthPayments.reduce((sum, p) => sum + p.amount, 0));
  }
  
  accountingCharts.byMonth = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ingresos',
        data: data,
        backgroundColor: 'rgba(13, 148, 136, 0.8)',
        borderColor: 'rgba(13, 148, 136, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
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
}

// Gráfico: Ingresos por categoría
function renderIncomeByCategoryChart() {
  const ctx = document.getElementById('incomeByCategoryChart');
  if (!ctx) return;
  
  const players = getPlayers();
  const payments = getPayments().filter(p => p.status === 'Pagado');
  const categories = ['Sub-8', 'Sub-10', 'Sub-12', 'Sub-14', 'Sub-16'];
  const data = [];
  
  categories.forEach(category => {
    const categoryPlayers = players.filter(p => p.category === category);
    const playerIds = categoryPlayers.map(p => p.id);
    const categoryPayments = payments.filter(p => playerIds.includes(p.playerId));
    data.push(categoryPayments.reduce((sum, p) => sum + p.amount, 0));
  });
  
  accountingCharts.byCategory = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: data,
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
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
    data.push(typePayments.reduce((sum, p) => sum + p.amount, 0));
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
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

// Tabla de jugadores
function renderAccountingPlayersTable() {
  const tbody = document.getElementById('accountingPlayersTable');
  if (!tbody) return;
  
  const players = getPlayers();
  
  if (players.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">No hay jugadores</td></tr>';
    return;
  }
  
  tbody.innerHTML = players.map(player => {
    const payments = getPaymentsByPlayer(player.id);
    const paid = payments.filter(p => p.status === 'Pagado');
    const pending = payments.filter(p => p.status === 'Pendiente');
    
    const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
    const totalExpected = totalPaid + totalPending;
    const compliance = totalExpected > 0 ? (totalPaid / totalExpected * 100) : 0;
    
    const color = compliance >= 80 ? 'bg-green-500' : compliance >= 50 ? 'bg-yellow-500' : 'bg-red-500';
    
    return `
      <tr class="border-b hover:bg-gray-50">
        <td class="py-3">
          <div class="flex items-center gap-2">
            <img src="${player.avatar || getDefaultAvatar()}" alt="${player.name}" class="w-8 h-8 rounded-full">
            <span>${player.name}</span>
          </div>
        </td>
        <td class="py-3">${player.category}</td>
        <td class="py-3 text-right text-green-600">${formatCurrency(totalPaid)}</td>
        <td class="py-3 text-right text-red-600">${formatCurrency(totalPending)}</td>
        <td class="py-3">
          <div class="flex items-center gap-2">
            <div class="flex-1 progress-bar">
              <div class="progress-bar-fill ${color}" style="width: ${compliance}%"></div>
            </div>
            <span class="text-sm">${Math.round(compliance)}%</span>
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

// Exportar CSV
function exportCSV() {
  const players = getPlayers();
  if (players.length === 0) {
    showToast('⚠️ No hay datos para exportar');
    return;
  }
  
  const csvData = players.map(player => {
    const payments = getPaymentsByPlayer(player.id);
    const paid = payments.filter(p => p.status === 'Pagado');
    const pending = payments.filter(p => p.status === 'Pendiente');
    
    return {
      'Jugador': player.name,
      'Categoría': player.category,
      'Total Pagado': paid.reduce((sum, p) => sum + p.amount, 0),
      'Total Pendiente': pending.reduce((sum, p) => sum + p.amount, 0),
      'Estado': player.status,
      'Teléfono': player.phone,
      'Email': player.email || ''
    };
  });
  
  downloadCSV(csvData, `Contabilidad-${getCurrentDate()}.csv`);
  showToast('✅ CSV exportado');
}

console.log('✅ accounting.js cargado correctamente');
