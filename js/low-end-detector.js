// ========================================
// LOW-END DEVICE DETECTOR
// Detecta dispositivos de gama baja y aplica optimizaciones automáticas
// ========================================

function detectLowEndDevice() {
  const indicators = {
    isLowRAM: false,
    isSlowCPU: false,
    isLowEndOS: false,
    totalScore: 0
  };

  // 1️⃣ Memoria: deviceMemory API (Chrome 63+)
  if (navigator.deviceMemory) {
    indicators.isLowRAM = navigator.deviceMemory <= 2;
    indicators.totalScore += indicators.isLowRAM ? 2 : 0;
  }

  // 2️⃣ CPU: hardwareConcurrency API
  if (navigator.hardwareConcurrency) {
    const cores = navigator.hardwareConcurrency;
    indicators.isSlowCPU = cores <= 2;
    indicators.totalScore += indicators.isSlowCPU ? 2 : 0;
  }

  // 3️⃣ Conexión: Network Information API
  if (navigator.connection?.effectiveType) {
    const connType = navigator.connection.effectiveType;
    const isSlowNetwork = ['slow-2g', '2g', '3g'].includes(connType);
    indicators.totalScore += isSlowNetwork ? 1 : 0;
  }

  // 4️⃣ Sistema operativo móvil de bajo rendimiento
  const userAgent = navigator.userAgent.toLowerCase();
  indicators.isLowEndOS = /android 4\.|android 5\.|windows phone/.test(userAgent);
  indicators.totalScore += indicators.isLowEndOS ? 1 : 0;

  return indicators;
}

function applyLowEndOptimizations(indicators) {
  const savedLevel = localStorage.getItem('myclub_quality_level');
  
  // Si el usuario ya eligió un nivel, respetarlo
  if (savedLevel) {
    console.log('✅ Usuario ya configuró nivel de calidad:', savedLevel);
    return;
  }

  // Score >= 3 = device gama baja
  if (indicators.totalScore >= 3) {
    console.log('📱 Detectado device de gama baja (score:', indicators.totalScore + ')');
    localStorage.setItem('myclub_quality_level', 'low');
    
    // Aplicar inmediatamente sin esperar a que cargue performance.js
    document.body.classList.remove('perf-high', 'perf-medium', 'perf-low');
    document.body.classList.add('perf-low');
    document.body.dataset.qualityLevel = 'low';
    
    console.log('⚡ Modo bajo aplicado automáticamente (menos animaciones, más velocidad)');
  } else if (indicators.totalScore >= 1) {
    console.log('⚙️ Detectado device de gama media (score:', indicators.totalScore + ')');
    localStorage.setItem('myclub_quality_level', 'medium');
    
    document.body.classList.remove('perf-high', 'perf-medium', 'perf-low');
    document.body.classList.add('perf-medium');
    document.body.dataset.qualityLevel = 'medium';
  } else {
    console.log('✨ Detectado device de gama alta (score:', indicators.totalScore + ')');
    localStorage.setItem('myclub_quality_level', 'high');
  }
}

// Ejecutar detección al cargar
(function initLowEndDetection() {
  const indicators = detectLowEndDevice();
  console.log('📊 Device metrics:', {
    RAM: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'desconocida',
    CPU_cores: navigator.hardwareConcurrency || 'desconocidos',
    Network: navigator.connection?.effectiveType || 'desconocida',
    Score: indicators.totalScore
  });
  
  applyLowEndOptimizations(indicators);
})();

console.log('✅ low-end-detector.js cargado');
