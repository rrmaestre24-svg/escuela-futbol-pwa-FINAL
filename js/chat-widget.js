// ========================================
// CHAT WIDGET — Asistente MY CLUB (ayuda de uso)
// Botón flotante + panel de chat. Llama al Chatbot Capacitador RAG (Edge Function
// `ask` en el proyecto aislado del chatbot): pregunta -> busca en el manual ->
// responde. Es PÚBLICO (no necesita login). Ante un fallo degrada con un mensaje
// amable. Modo DEMO (respuestas de ejemplo) para previsualizar sin backend.
//
// Cómo se muestra:
//   - En la app real: SOLO si al cargar está window.MACW_ENABLED = true.
//     (queda cableado pero invisible hasta prenderlo).
//   - PREVIEW LOCAL sin tocar prod: abrir la app con ?macw=1 en la URL.
//   - A mano en cualquier momento:
//       ChatAsistente.mostrar({ demo: true })   → con respuestas de ejemplo
//       ChatAsistente.mostrar()                  → tal cual irá (llama al bot RAG)
//
// Estilo: usa --primary-color del club y respeta el modo oscuro (.dark).
// Autónomo: inyecta su propio CSS y DOM, no depende de Tailwind.
// ========================================

(function () {
  'use strict';

  // Endpoint del bot RAG (proyecto Supabase aislado del chatbot). Público.
  const RAG_URL = window.MACW_RAG_URL || 'https://ipghbkengvweubgvczhk.supabase.co/functions/v1/ask';
  // Logo del encabezado: por defecto el de la app (MY CLUB). Se puede cambiar por el
  // del club con window.MACW_LOGO = '<url>' antes de que cargue el widget.
  const LOGO = window.MACW_LOGO || 'assets/icons/icon-192x192.png';
  const SUGERENCIAS = [
    '¿Cómo cambio el tema a oscuro?',
    '¿Dónde veo los morosos?',
    '¿Cómo registro un pago?',
  ];
  const BIENVENIDA = '¡Hola! 👋 Soy el Asistente de MY CLUB. Te ayudo a usar la app: decime qué querés hacer y te digo dónde está y cómo, paso a paso. ⚽';

  // Monta el widget UNA sola vez. `opts.demo` fuerza el modo demo.
  function montar(opts) {
    opts = opts || {};
    if (window.__macwMontado) return;
    window.__macwMontado = true;
    const DEMO = !!(opts.demo || window.MACW_DEMO);

    // --- Estilos ---
    const css = `
    .macw-root{--macw-bg:#ffffff;--macw-fg:#1f2937;--macw-muted:#6b7280;--macw-line:#e5e7eb;
      --macw-botbg:#f3f4f6;--macw-botfg:#1f2937;--macw-pri:var(--primary-color,#16a34a);
      --macw-prifg:#ffffff;--macw-shadow:0 12px 40px rgba(0,0,0,.18);font-family:inherit}
    .dark .macw-root{--macw-bg:#1f2937;--macw-fg:#f3f4f6;--macw-muted:#9ca3af;--macw-line:#374151;
      --macw-botbg:#374151;--macw-botfg:#f3f4f6;--macw-shadow:0 12px 40px rgba(0,0,0,.5)}
    .macw-fab{position:fixed;right:16px;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:2147483000;
      width:58px !important;height:58px !important;border-radius:50%;border:none;cursor:pointer;background:var(--macw-pri);
      color:var(--macw-prifg);box-shadow:0 6px 18px rgba(0,0,0,.28);display:flex;align-items:center;
      justify-content:center;padding:0;transition:transform .15s ease}
    .macw-fab:hover{transform:scale(1.06)}
    .macw-fab:active{transform:scale(.96)}
    .macw-fab svg{width:28px !important;height:28px !important}
    .macw-fab .macw-dot{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;
      background:#ef4444;border:2px solid var(--macw-pri)}
    .macw-panel{position:fixed;right:16px;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:2147483001;
      width:min(370px,calc(100vw - 32px));height:min(560px,calc(100vh - 180px));background:var(--macw-bg);
      color:var(--macw-fg);border-radius:18px;box-shadow:var(--macw-shadow);display:none;flex-direction:column;
      overflow:hidden;transform:translateY(12px) scale(.98);opacity:0;transition:transform .18s ease, opacity .18s ease}
    .macw-panel.macw-open{display:flex;transform:none;opacity:1}
    .macw-head{background:var(--macw-pri);color:var(--macw-prifg);padding:14px 16px;display:flex;
      align-items:center;gap:10px}
    .macw-ava{width:36px;height:36px;border-radius:50%;background:#fff;display:flex;
      align-items:center;justify-content:center;font-size:20px;flex:0 0 auto;overflow:hidden}
    .macw-ava img{width:100%;height:100%;object-fit:cover;display:block}
    .macw-head h4{margin:0;font-size:15px;font-weight:700;line-height:1.1;color:#fff}
    .macw-head p{margin:2px 0 0;font-size:12px;opacity:.9;display:flex;align-items:center;gap:5px;color:#fff}
    .macw-head p i{width:8px;height:8px;border-radius:50%;background:#4ade80;display:inline-block}
    .macw-x{margin-left:auto;background:transparent;border:none;color:#fff;cursor:pointer;opacity:.9;
      font-size:22px;line-height:1;padding:4px 6px;border-radius:8px}
    .macw-x:hover{background:rgba(255,255,255,.15)}
    .macw-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
    .macw-b{max-width:82%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.4;
      white-space:pre-wrap;word-wrap:break-word}
    .macw-b.bot{align-self:flex-start;background:var(--macw-botbg);color:var(--macw-botfg);border-bottom-left-radius:5px}
    .macw-b.me{align-self:flex-end;background:var(--macw-pri);color:var(--macw-prifg);border-bottom-right-radius:5px}
    .macw-b strong{font-weight:700}
    .macw-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:2px}
    .macw-chip{background:transparent;border:1.5px solid var(--macw-pri);color:var(--macw-pri);
      padding:6px 11px;border-radius:999px;font-size:12.5px;cursor:pointer}
    .macw-typing{align-self:flex-start;background:var(--macw-botbg);padding:11px 14px;border-radius:14px;
      border-bottom-left-radius:5px;display:flex;gap:4px}
    .macw-typing span{width:7px;height:7px;border-radius:50%;background:var(--macw-muted);
      animation:macwb 1.2s infinite ease-in-out}
    .macw-typing span:nth-child(2){animation-delay:.2s}.macw-typing span:nth-child(3){animation-delay:.4s}
    @keyframes macwb{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}
    .macw-foot{border-top:1px solid var(--macw-line);padding:10px;display:flex;gap:8px;align-items:flex-end}
    .macw-in{flex:1;resize:none;border:1px solid var(--macw-line);border-radius:12px;padding:9px 12px;
      font-size:14px;font-family:inherit;max-height:96px;background:var(--macw-bg);color:var(--macw-fg);outline:none}
    .macw-in:focus{border-color:var(--macw-pri)}
    .macw-send{flex:0 0 auto;width:40px !important;height:40px !important;border-radius:12px;border:none;background:var(--macw-pri);
      color:var(--macw-prifg);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
    .macw-send:disabled{opacity:.5;cursor:default}
    .macw-send svg{width:20px !important;height:20px !important}
    `;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    // --- DOM ---
    const root = document.createElement('div'); root.className = 'macw-root';
    root.innerHTML = `
      <button class="macw-fab" aria-label="Abrir asistente de ayuda">
        <span class="macw-dot"></span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
      </button>
      <section class="macw-panel" role="dialog" aria-label="Asistente MY CLUB">
        <header class="macw-head">
          <div class="macw-ava"><img src="${LOGO}" alt="MY CLUB" onerror="this.parentNode.textContent='⚽'"></div>
          <div><h4>Asistente MY CLUB</h4><p><i></i> Te ayudo a usar la app</p></div>
          <button class="macw-x" aria-label="Cerrar">×</button>
        </header>
        <div class="macw-msgs"></div>
        <footer class="macw-foot">
          <textarea class="macw-in" rows="1" placeholder="Escribí tu pregunta…"></textarea>
          <button class="macw-send" aria-label="Enviar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </footer>
      </section>`;
    document.body.appendChild(root);

    const fab = root.querySelector('.macw-fab');
    const panel = root.querySelector('.macw-panel');
    const dot = root.querySelector('.macw-dot');
    const msgs = root.querySelector('.macw-msgs');
    const input = root.querySelector('.macw-in');
    const sendBtn = root.querySelector('.macw-send');

    const historial = [];
    let ocupado = false, saludado = false;

    const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const fmt = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    function burbuja(texto, quien) {
      const b = document.createElement('div');
      b.className = 'macw-b ' + (quien === 'me' ? 'me' : 'bot');
      b.innerHTML = fmt(texto);
      msgs.appendChild(b); msgs.scrollTop = msgs.scrollHeight;
    }
    function chips() {
      const wrap = document.createElement('div'); wrap.className = 'macw-chips';
      SUGERENCIAS.forEach(t => {
        const c = document.createElement('button'); c.className = 'macw-chip'; c.textContent = t;
        c.onclick = () => { wrap.remove(); enviar(t); };
        wrap.appendChild(c);
      });
      msgs.appendChild(wrap); msgs.scrollTop = msgs.scrollHeight;
    }
    function typing(on) {
      let t = msgs.querySelector('.macw-typing');
      if (on && !t) { t = document.createElement('div'); t.className = 'macw-typing'; t.innerHTML = '<span></span><span></span><span></span>'; msgs.appendChild(t); msgs.scrollTop = msgs.scrollHeight; }
      if (!on && t) t.remove();
    }

    function respuestaDemo(q) {
      const s = q.toLowerCase();
      if (s.includes('tema') || s.includes('oscuro') || s.includes('claro'))
        return 'Para cambiar el tema hay dos caminos, te doy el corto:\n\n1. En **Inicio**, arriba a la derecha, junto a la campana, tocá el **interruptor de sol/luna**. Listo. 🌙\n\n(El otro es **Más** → **🎨 Apariencia** → **Modo Oscuro** — es el mismo ajuste.)\n\n¿Te ayudo con algo más?';
      if (s.includes('moroso') || s.includes('debe') || s.includes('deuda'))
        return 'Los morosos están en **Contabilidad**:\n\nEntrá a **Pagos** → **Contabilidad** → **Ver Morosos**.\n\nAhí ves quién debe, y si hay vencidos aparece el listado con su **PDF de Vencidos**. ¿Algo más? ⚽';
      if (s.includes('pago') || s.includes('cobr') || s.includes('mensualidad'))
        return 'Para registrar un pago:\n\nEntrá a **Pagos** → **Registrar Pago** y elegí una de las tres opciones: **Mensualidades**, **Otros Cobros** o **Egreso**.\n\nEn Mensualidades podés cobrarle a varios jugadores a la vez (por ejemplo hermanos). ¿Seguimos?';
      return 'Con gusto te ayudo a usar MY CLUB. Contame qué querés hacer (por ejemplo: agregar un jugador, enviar un aviso, ver la contabilidad) y te digo el paso a paso. ⚽\n\n*(Respuesta de ejemplo — cuando se conecte la API real, contesta el asistente.)*';
    }

    async function llamarBackend(q) {
      // Bot RAG: público, no necesita JWT. Contrato: { query } -> { answer }.
      // Mandamos club_id (para el tope diario por club y la analítica) — cada club cuenta aparte.
      const clubId = (typeof getClubId === 'function' ? getClubId() : null) || localStorage.getItem('clubId') || null;
      const resp = await fetch(RAG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, conversation_id: window.__macwConv || null, club_id: clubId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      if (data.conversation_id) window.__macwConv = data.conversation_id;
      return data.answer || 'No pude generar una respuesta.';
    }

    async function enviar(texto) {
      const q = (texto != null ? texto : input.value).trim();
      if (!q || ocupado) return;
      input.value = ''; input.style.height = 'auto';
      burbuja(q, 'me'); historial.push({ role: 'user', content: q });
      ocupado = true; sendBtn.disabled = true; typing(true);
      try {
        const r = DEMO ? await new Promise(res => setTimeout(() => res(respuestaDemo(q)), 650)) : await llamarBackend(q);
        typing(false); burbuja(r, 'bot'); historial.push({ role: 'assistant', content: r });
      } catch (e) {
        typing(false);
        burbuja('Perdón, el asistente todavía no está disponible. Volvé a intentar en un rato o escribí al soporte por WhatsApp al **3104532888**. 🙏', 'bot');
      } finally {
        ocupado = false; sendBtn.disabled = false; input.focus();
      }
    }

    function abrir() {
      panel.classList.add('macw-open'); dot.style.display = 'none';
      if (!saludado) { saludado = true; setTimeout(() => { burbuja(BIENVENIDA, 'bot'); chips(); }, 150); }
      setTimeout(() => input.focus(), 200);
    }
    function cerrar() { panel.classList.remove('macw-open'); }

    fab.onclick = () => panel.classList.contains('macw-open') ? cerrar() : abrir();
    root.querySelector('.macw-x').onclick = cerrar;
    sendBtn.onclick = () => enviar();
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 96) + 'px'; });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });

    window.ChatAsistente = { mostrar: montar, abrir, cerrar };
  }

  // Auto-montar si el flag está prendido AL CARGAR (en la app real: MACW_ENABLED),
  // si la URL trae ?macw=1, o si se está corriendo en LOCAL (preview de desarrollo).
  // El chequeo de localhost nunca da true en producción (appmyclub.com), así que
  // esto deja ver el widget al correr la app en la máquina sin tocar el flag de prod.
  const _h = location.hostname;
  const _macwLocal = (_h === 'localhost' || _h === '127.0.0.1' || _h === '' || _h.endsWith('.local'));
  const _macwUrlOn = /[?&#]macw=1(?![0-9])/.test(location.href);
  const _macwOn = window.MACW_DEMO || window.MACW_ENABLED || _macwUrlOn || _macwLocal;

  // El chatbot SOLO debe verse cuando ya estás DENTRO del sistema: en la app cargada
  // (index.html) y pasadas AMBAS pantallas de arranque — el preloader de sesión
  // (#sessionLoader) y el splash de bienvenida del admin (#adminWelcomeSplash, se crea
  // en app.js). El FAB tiene z-index altísimo, así que si se monta antes se dibuja
  // ENCIMA de esos splash. En login.html el widget ni se incluye. En DEMO monta directo.
  function montarCuandoDentro() {
    const cubierto = () => document.getElementById('sessionLoader') || document.getElementById('adminWelcomeSplash');
    if (window.MACW_DEMO || !cubierto()) return montar();
    let intentos = 0;
    const iv = setInterval(() => {
      if (!cubierto()) { clearInterval(iv); montar(); }
      else if (++intentos > 150) { clearInterval(iv); } // ~60s de tope: si nunca entra, no monta
    }, 400);
  }
  if (_macwOn) montarCuandoDentro();
  // Siempre exponer mostrar() para poder verlo a mano en pruebas.
  window.ChatAsistente = window.ChatAsistente || { mostrar: montar };
})();
