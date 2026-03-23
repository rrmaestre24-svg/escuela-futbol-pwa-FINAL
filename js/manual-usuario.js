// ========================================
// MANUAL DE USUARIO — MY CLUB
// Modal integrado en la app, igual que
// la Política de Privacidad
// ========================================

function showUserManual() {
  const modal = document.getElementById('userManualModal');
  if (modal) {
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function closeUserManual() {
  document.getElementById('userManualModal')?.classList.add('hidden');
}

window.showUserManual  = showUserManual;
window.closeUserManual = closeUserManual;

console.log('✅ manual-usuario.js cargado');