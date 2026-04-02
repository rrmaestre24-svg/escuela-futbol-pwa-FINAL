// ============================================================
// pwa-native.js — Experiencia nativa para PWA MY CLUB
// Bloques: orientación, swipe entre tabs, transiciones, vibración
// No modifica lógica existente — solo agrega capas encima
// ============================================================

(function () {
  'use strict';


  // ─── BLOQUE 2: TRANSICIONES SUAVES ──────────────────────────────────────────
  // Inyecta CSS de animación sin tocar el HTML existente

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes pwa-fade-in {
      from { opacity: 0; transform: translateY(5px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .pwa-enter {
      animation: pwa-fade-in 0.18s ease-out forwards;
    }
  `;
  document.head.appendChild(styleEl);

  // Envuelve navigateTo para agregar animación al cambiar de vista
  // Se ejecuta después de DOMContentLoaded para que navigateTo ya esté definida
  window.addEventListener('load', function () {
    if (typeof window.navigateTo === 'function') {
      const _orig = window.navigateTo;
      window.navigateTo = function (view) {
        _orig(view);
        window._pwaCurrentView = view;
        // Buscar la vista recién mostrada y animarla
        const viewEl = document.getElementById(view + 'View') ||
                       document.getElementById(view);
        if (viewEl && !viewEl.classList.contains('hidden')) {
          viewEl.classList.remove('pwa-enter');
          void viewEl.offsetWidth; // forzar reflow para reiniciar animación
          viewEl.classList.add('pwa-enter');
        }
      };
    }
  });

  // ─── BLOQUE 3: SWIPE ENTRE TABS ─────────────────────────────────────────────
  // Deslizar izquierda/derecha cambia de tab
  // Respeta scroll vertical — no interfiere con listas

  var _touchStartX = 0;
  var _touchStartY = 0;
  var _touchStartTime = 0;

  function _getNavTabs() {
    return Array.from(document.querySelectorAll('[data-nav]'));
  }

  function _getCurrentTabIndex(tabs) {
    // Buscar el tab activo por clase 'active' o por la vista actual
    var activeIdx = tabs.findIndex(function (t) {
      return t.classList.contains('active');
    });
    if (activeIdx !== -1) return activeIdx;
    if (window._pwaCurrentView) {
      return tabs.findIndex(function (t) {
        return t.getAttribute('data-nav') === window._pwaCurrentView;
      });
    }
    return 0;
  }

  function _isScrollableParent(el) {
    // Comprueba si el elemento tocado está dentro de un contenedor con scroll horizontal
    var node = el;
    while (node && node !== document.body) {
      var style = window.getComputedStyle(node);
      var overflowX = style.overflowX;
      if ((overflowX === 'auto' || overflowX === 'scroll') &&
          node.scrollWidth > node.clientWidth) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function _isAnyModalOpen() {
    // Detectar si hay algún modal/overlay visible para no interferir
    var selectors = [
      '.modal-overlay.open',
      '.fixed.inset-0:not(.hidden)',
      '[id$="Modal"]:not(.hidden)',
      '[id$="Overlay"]:not(.hidden)'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var els = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < els.length; j++) {
        if (window.getComputedStyle(els[j]).display !== 'none') return true;
      }
    }
    return false;
  }

  document.addEventListener('touchstart', function (e) {
    _touchStartX = e.touches[0].clientX;
    _touchStartY = e.touches[0].clientY;
    _touchStartTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    var deltaX = e.changedTouches[0].clientX - _touchStartX;
    var deltaY = e.changedTouches[0].clientY - _touchStartY;
    var elapsed = Date.now() - _touchStartTime;

    // Filtros para que solo actúe en swipes reales
    if (Math.abs(deltaX) < 65) return;                        // muy corto
    if (Math.abs(deltaY) > Math.abs(deltaX) * 0.65) return;  // más vertical que horizontal
    if (elapsed > 420) return;                                 // muy lento
    if (_isAnyModalOpen()) return;                             // modal abierto
    if (_isScrollableParent(e.target)) return;                 // dentro de scroll horizontal

    var tabs = _getNavTabs();
    if (tabs.length < 2) return;

    var currentIdx = _getCurrentTabIndex(tabs);
    if (currentIdx === -1) return;

    if (deltaX < 0 && currentIdx < tabs.length - 1) {
      // Swipe izquierda → siguiente tab
      tabs[currentIdx + 1].click();
    } else if (deltaX > 0 && currentIdx > 0) {
      // Swipe derecha → tab anterior
      tabs[currentIdx - 1].click();
    }
  }, { passive: true });

  // ─── BLOQUE 4: SWIPE PARA CERRAR MODALES ────────────────────────────────────
  // En modales con clase .modal-swipeable, arrastrar hacia abajo los cierra

  var _modalDragEl = null;
  var _modalDragStartY = 0;

  document.addEventListener('touchstart', function (e) {
    var modal = e.target.closest('.modal-swipeable');
    if (!modal) return;
    _modalDragEl = modal;
    _modalDragStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!_modalDragEl) return;
    var delta = e.touches[0].clientY - _modalDragStartY;
    if (delta > 0) {
      _modalDragEl.style.transform = 'translateY(' + delta + 'px)';
      _modalDragEl.style.transition = 'none';
    }
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!_modalDragEl) return;
    var delta = e.changedTouches[0].clientY - _modalDragStartY;
    var modal = _modalDragEl;
    _modalDragEl = null;

    if (delta > 110) {
      // Cerrar con animación
      modal.style.transform = 'translateY(100%)';
      modal.style.transition = 'transform 0.22s ease';
      setTimeout(function () {
        modal.style.transform = '';
        modal.style.transition = '';
        // Buscar y pulsar el botón de cierre del modal
        var closeBtn = modal.querySelector(
          '[onclick*="close"],[onclick*="Close"],[onclick*="cancel"],[onclick*="Cancel"],[onclick*="cerrar"],[onclick*="Cerrar"]'
        );
        if (closeBtn) closeBtn.click();
      }, 220);
    } else {
      // Volver a posición
      modal.style.transition = 'transform 0.18s ease';
      modal.style.transform = '';
      setTimeout(function () { modal.style.transition = ''; }, 180);
    }
  }, { passive: true });

  // ─── BLOQUE 5: VIBRACIÓN (para módulos sin sistema propio) ──────────────────
  // Solo se activa si el módulo no tiene ya una función vibrate definida

  if (typeof window.vibrate !== 'function') {
    window.vibrate = function (duration) {
      duration = duration || 10;
      var enabled = localStorage.getItem('vibrateEnabled') !== 'false';
      if (!enabled || !('vibrate' in navigator)) return;
      try { navigator.vibrate(duration); } catch (e) {}
    };

    // Vibración suave al tocar botones
    document.addEventListener('touchstart', function (e) {
      if (e.target.closest('button, [role="button"]')) {
        window.vibrate(8);
      }
    }, { passive: true });

    // Vibración al enviar formularios
    document.addEventListener('submit', function () {
      window.vibrate([15, 40, 15]);
    }, { passive: true });
  }

  // ─── INIT ────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    // Aplicar bloqueo de orientación si está activado
    applyOrientationLock();

    // Sincronizar estado del toggle si existe en esta página
    var toggle = document.getElementById('orientationLockToggle');
    if (toggle) {
      toggle.checked = localStorage.getItem('orientationLock') === 'true';
    }
  });

  console.log('✅ pwa-native.js cargado');

})();
