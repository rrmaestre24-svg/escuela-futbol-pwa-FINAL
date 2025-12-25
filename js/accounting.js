// ========================================
// CONTABILIDAD COMPLETA
// ========================================

let accountingCharts = {};

// Mostrar vista de contabilidad
function showAccountingView() {
  // Ocultar todas las vistas
  document.querySelectorAll('#appContainer > main > div').forEach(div => {
    div.classList.add('hidden');
  });
  
  // Mostrar vista de contabilidad
  document.getElementById('accountingView').classList.remove('hidden');
  document.getElementById('headerViewName').textContent = 'Contabilidad';
  
  // Actualizar navegación
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  renderAccounting();
}

// Renderizar contabilidad completa
function renderAccounting() {
  renderAccountingSummary();
  renderAccountingCharts();
  renderAccountingPlayersTable();
}

// Renderizar resumen
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
  
  renderIncomeByMonthChart();
  renderIncomeByCategoryChart();
  renderIncomeByTypeChart();
}

// Gráfico: Ingresos por mes (últimos 12 meses)
function renderIncomeByMonthChart() {
  const payments = getPayments().filter(p => p.status === 'Pagado' && p.paidDate);
  const today = new Date();
  const labels = [];
  const data = [];
  
  // Últimos 12 meses
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthName = getMonthName(date.getMonth());
    const year = date.getFullYear();
    
    labels.push(`${monthName.substring(0, 3)} ${year}`);
    
    // Calcular ingresos del mes
    const monthPayments = payments.filter(p => {
      const paymentDate = new Date(p.paidDate);
      return paymentDate.getMonth() === date.getMonth() && 
             paymentDate.getFullYear() === date.getFullYear();
    });
    
    const monthTotal = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    data.push(monthTotal);
  }
  
  const ctx = document.getElementById('incomeByMonthChart');
  if (!ctx) return;
  
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
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
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
}

// Gráfico: Ingresos por categoría
function renderIncomeByCategoryChart() {
  const players = getPlayers();
  const payments = getPayments().filter(p => p.status === 'Pagado');
  
  const categories = ['Sub-8', 'Sub-10', 'Sub-12', 'Sub-14', 'Sub-16'];
  const data = [];
  
  categories.forEach(category => {
    const categoryPlayers = players.filter(p => p.category === category);
    const playerIds = categoryPlayers.map(p => p.id);
    const categoryPayments = payments.filter(p => playerIds.includes(p.playerId));
    const total = categoryPayments.reduce((sum, p) => sum + p.amount, 0);
    data.push(total);
  });
  
  const ctx = document.getElementById('incomeByCategoryChart');
  if (!ctx) return;
  
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
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

// Gráfico: Ingresos por tipo de pago
function renderIncomeByTypeChart() {
  const payments = getPayments().filter(p => p.status === 'Pagado');
  
  const types = ['Mensualidad', 'Uniforme', 'Torneo', 'Equipamiento', 'Otro'];
  const data = [];
  
  types.forEach(type => {
    const typePayments = payments.filter(p => p.type === type);
    const total = typePayments.reduce((sum, p) => sum + p.amount, 0);
    data.push(total);
  });
  
  const ctx = document.getElementById('incomeByTypeChart');
  if (!ctx) return;
  
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
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

// Renderizar tabla de jugadores
function renderAccountingPlayersTable() {
  const players = getPlayers();
  const tbody = document.getElementById('accountingPlayersTable');
  
  if (players.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-gray-500 dark:text-gray-400">No hay jugadores registrados</td>
      </tr>
    `;
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
    
    let complianceColor = '';
    if (compliance >= 80) complianceColor = 'bg-green-500';
    else if (compliance >= 50) complianceColor = 'bg-yellow-500';
    else complianceColor = 'bg-red-500';
    
    return `
      <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
        <td class="py-3">
          <div class="flex items-center gap-2">
            <img src="${player.avatar || getDefaultAvatar()}" alt="${player.name}" class="w-8 h-8 rounded-full object-cover">
            <span class="text-gray-800 dark:text-white font-medium">${player.name}</span>
          </div>
        </td>
        <td class="py-3 text-gray-800 dark:text-white">${player.category}</td>
        <td class="py-3 text-right text-green-600 font-medium">${formatCurrency(totalPaid)}</td>
        <td class="py-3 text-right text-red-600 font-medium">${formatCurrency(totalPending)}</td>
        <td class="py-3">
          <div class="flex items-center gap-2">
            <div class="flex-1 progress-bar">
              <div class="progress-bar-fill ${complianceColor}" style="width: ${compliance}%"></div>
            </div>
            <span class="text-sm font-medium text-gray-800 dark:text-white">${Math.round(compliance)}%</span>
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

// Exportar CSV
function exportCSV() {
  const players = getPlayers();
  const csvData = [];
  
  players.forEach(player => {
    const payments = getPaymentsByPlayer(player.id);
    const paid = payments.filter(p => p.status === 'Pagado');
    const pending = payments.filter(p => p.status === 'Pendiente');
    
    const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
    
    csvData.push({
      'Jugador': player.name,
      'Categoría': player.category,
      'Total Pagado': totalPaid,
      'Total Pendiente': totalPending,
      'Estado': player.status,
      'Teléfono': player.phone,
      'Email': player.email || ''
    });
  });
  
  downloadCSV(csvData, `Contabilidad-${getCurrentDate()}.csv`);
}

console.log('✅ accounting.js cargado');