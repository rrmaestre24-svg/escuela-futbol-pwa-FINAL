// ========================================
// 📳 SISTEMA DE VIBRACIÓN - FEEDBACK HÁPTICO (SEGURO)
// ========================================

function vibrate(duration = 10) {
    // Verificar si el usuario tiene vibración activada (por defecto: true)
    const vibrateEnabled = localStorage.getItem('vibrateEnabled') !== 'false';
    if (!vibrateEnabled) return;

    if (!('vibrate' in navigator)) return;

    try {
        navigator.vibrate(duration);
    } catch (error) {
        // Ignorar errores silenciosamente
    }
}

// Vibración al tocar botones
document.addEventListener('click', function (e) {
    const target = e.target;
    if (target.matches('button, [onclick], .cursor-pointer, [role="button"], .nav-item') ||
        target.closest('button, [onclick], .cursor-pointer, [role="button"], .nav-item')) {
        vibrate(8);
    }
});

// Vibración suave al escribir en inputs
document.addEventListener('input', function (e) {
    if (e.target.matches('input, textarea')) {
        vibrate(3);
    }
});

// Vibración al cambiar checkboxes o selects
document.addEventListener('change', function (e) {
    if (e.target.matches('input[type="checkbox"], input[type="radio"], select')) {
        vibrate(12);
    }
});

// Vibración al enviar formularios
document.addEventListener('submit', function (e) {
    vibrate([20, 50, 20]); // Patrón de vibración
});

console.log('📳 Sistema de vibración activado');
