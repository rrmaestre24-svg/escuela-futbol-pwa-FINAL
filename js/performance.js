// ========================================
// PERFORMANCE — Control de calidad visual
// Aplica el nivel elegido por el usuario al iniciar la app
// ========================================

// Niveles disponibles: 'high', 'medium', 'low'
const QUALITY_KEY = 'myclub_quality_level';
const QUALITY_LEVELS = new Set(['high', 'medium', 'low']);

function normalizeQualityLevel(level) {
    return QUALITY_LEVELS.has(level) ? level : 'high';
}

// Lee el nivel guardado (por defecto: alto)
function getQualityLevel() {
    return normalizeQualityLevel(localStorage.getItem(QUALITY_KEY) || 'high');
}

// Aplica las clases CSS al body según el nivel
function applyQualityLevel(level) {
    const safeLevel = normalizeQualityLevel(level);
    document.body.classList.remove('perf-high', 'perf-medium', 'perf-low');
    document.body.classList.add('perf-' + safeLevel);

    // Flag para que otros módulos JS puedan reducir efectos en modo bajo
    document.body.dataset.qualityLevel = safeLevel;
}

// Guarda el nivel y lo aplica de inmediato
function setQualityLevel(level) {
    const safeLevel = normalizeQualityLevel(level);
    localStorage.setItem(QUALITY_KEY, safeLevel);
    applyQualityLevel(safeLevel);

    // Actualizar botones del selector para reflejar la selección activa
    updateQualityButtons(safeLevel);
}

// Marca el botón activo en la UI
function updateQualityButtons(level) {
    const safeLevel = normalizeQualityLevel(level);
    const buttons = document.querySelectorAll('[data-quality-btn]');
    buttons.forEach(btn => {
        const isActive = btn.dataset.qualityBtn === safeLevel;
        // Estilos del botón activo
        btn.classList.toggle('bg-teal-600', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('shadow-md', isActive);
        btn.classList.toggle('shadow-teal-500/40', isActive);
        btn.classList.toggle('border-teal-500', isActive);
        btn.classList.toggle('ring-2', isActive);
        btn.classList.toggle('ring-teal-400', isActive);
        btn.classList.toggle('dark:ring-teal-500', isActive);
        btn.classList.toggle('ring-offset-1', isActive);
        btn.classList.toggle('dark:ring-offset-gray-800', isActive);
        // Estilos del botón inactivo
        btn.classList.toggle('bg-gray-100', !isActive);
        btn.classList.toggle('dark:bg-gray-700', !isActive);
        btn.classList.toggle('text-gray-700', !isActive);
        btn.classList.toggle('dark:text-gray-300', !isActive);

        // Mejorar contraste del contenido interno
        const spans = btn.querySelectorAll('span');
        spans.forEach((span, idx) => {
            span.classList.toggle('text-white', isActive);
            if (isActive) {
                span.classList.remove('text-gray-500', 'dark:text-gray-400', 'text-gray-700', 'dark:text-gray-300');
            } else if (idx === 2) {
                span.classList.add('text-gray-500', 'dark:text-gray-400');
            } else {
                span.classList.add('text-gray-700', 'dark:text-gray-300');
            }
        });
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

window.getQualityLevel = getQualityLevel;
window.setQualityLevel = setQualityLevel;
