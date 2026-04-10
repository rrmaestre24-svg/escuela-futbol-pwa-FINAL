// ========================================
// PERFORMANCE — Control de calidad visual
// Aplica el nivel elegido por el usuario al iniciar la app
// ========================================

// Niveles disponibles: 'high', 'medium', 'low'
const QUALITY_KEY = 'myclub_quality_level';

// Lee el nivel guardado (por defecto: alto)
function getQualityLevel() {
    return localStorage.getItem(QUALITY_KEY) || 'high';
}

// Aplica las clases CSS al body según el nivel
function applyQualityLevel(level) {
    document.body.classList.remove('perf-high', 'perf-medium', 'perf-low');
    document.body.classList.add('perf-' + level);
}

// Guarda el nivel y lo aplica de inmediato
function setQualityLevel(level) {
    localStorage.setItem(QUALITY_KEY, level);
    applyQualityLevel(level);

    // Actualizar botones del selector para reflejar la selección activa
    updateQualityButtons(level);
}

// Marca el botón activo en la UI
function updateQualityButtons(level) {
    const buttons = document.querySelectorAll('[data-quality-btn]');
    buttons.forEach(btn => {
        const isActive = btn.dataset.qualityBtn === level;
        // Estilos del botón activo
        btn.classList.toggle('bg-teal-600', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('shadow-md', isActive);
        // Estilos del botón inactivo
        btn.classList.toggle('bg-gray-100', !isActive);
        btn.classList.toggle('dark:bg-gray-700', !isActive);
        btn.classList.toggle('text-gray-700', !isActive);
        btn.classList.toggle('dark:text-gray-300', !isActive);
    });
}

// Ejecutar al cargar la página para aplicar la preferencia guardada
(function init() {
    const saved = getQualityLevel();
    applyQualityLevel(saved);

    // Cuando el DOM esté listo, actualizar los botones
    document.addEventListener('DOMContentLoaded', () => {
        updateQualityButtons(saved);
    });
})();
