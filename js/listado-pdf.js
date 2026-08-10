/**
 * LISTADO DE JUGADORES EN PDF
 * ═══════════════════════════
 *
 * Arma la planilla que las escuelas imprimen para pasar lista y depurar datos:
 * portada con totales, un bloque por categoría con foto y casilla para marcar, y
 * un anexo "Para revisar" con los problemas de datos que se detectan solos.
 *
 * ¿POR QUÉ HTML Y NO jsPDF?
 * La versión anterior dibujaba el PDF a mano con coordenadas milimétricas
 * (`doc.text(x, y)`), y cada cambio de diseño obligaba a recalcular todo. Acá se
 * arma HTML y se deja que el navegador lo pagine e imprima — es el mismo motor
 * que genera el PDF, así que lo que se ve es lo que sale.
 *
 * Y sobre todo por las FOTOS: una escuela puede tener 500 jugadores. Incrustar
 * 500 imágenes en un PDF armado por JavaScript obliga a convertirlas a texto y
 * tenerlas todas en memoria a la vez, y eso en un celular lo cuelga. Como <img>,
 * el navegador las va trayendo y descartando solo.
 *
 * Se imprime desde un iframe oculto y no con window.open() porque los
 * navegadores bloquean las ventanas emergentes, y en la app instalada (PWA) una
 * pestaña nueva saca a la persona de la aplicación.
 */

/* ────────────────────────────────────────────────────────────────────────────
   AYUDAS
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Escapa texto para meterlo en HTML.
 *
 * Incluye las comillas a propósito: los nombres se insertan también dentro de
 * atributos (`alt="..."`), y sin escaparlas un nombre con comillas rompe la
 * etiqueta y permite inyectar HTML.
 */
function _lpEsc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Edad cumplida, o null si la fecha no sirve. */
function _lpEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacio = new Date(fechaNacimiento);
  if (isNaN(nacio.getTime())) return null;

  const hoy = new Date();
  let edad = hoy.getFullYear() - nacio.getFullYear();
  const mes = hoy.getMonth() - nacio.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacio.getDate())) edad--;
  return edad;
}

/** El año que nombra la categoría ("Categoría 2019" → 2019), o null. */
function _lpAnioCategoria(categoria) {
  const encontrado = String(categoria || '').match(/(19|20)\d{2}/);
  return encontrado ? Number(encontrado[0]) : null;
}

/** El año de nacimiento, o null si la fecha no sirve. */
function _lpAnioNacimiento(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacio = new Date(fechaNacimiento);
  return isNaN(nacio.getTime()) ? null : nacio.getFullYear();
}

/* ────────────────────────────────────────────────────────────────────────────
   AGRUPACIÓN
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Agrupa por categoría y ordena: las categorías de la más nueva a la más vieja
 * (que es como las nombran en la cancha) y los jugadores alfabéticamente.
 *
 * `localeCompare` con 'es' para que la Ñ y los acentos queden donde corresponde:
 * un orden por código de caracter manda "Ñoño" después de "Zapata".
 */
function _lpAgrupar(jugadores) {
  const porCategoria = new Map();

  jugadores.forEach(jugador => {
    const categoria = (jugador.category || 'Sin categoría').trim();
    if (!porCategoria.has(categoria)) porCategoria.set(categoria, []);
    porCategoria.get(categoria).push(jugador);
  });

  porCategoria.forEach(lista => {
    lista.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));
  });

  // Sin año reconocible van al final, no primero: son la excepción.
  return [...porCategoria.entries()].sort((a, b) => {
    const anioA = _lpAnioCategoria(a[0]);
    const anioB = _lpAnioCategoria(b[0]);
    if (anioA === null && anioB === null) return a[0].localeCompare(b[0], 'es');
    if (anioA === null) return 1;
    if (anioB === null) return -1;
    return anioB - anioA;
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   ANEXO "PARA REVISAR"
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Busca problemas de datos que se pueden detectar sin salir de la app.
 *
 * No frena nada ni corrige nada: solo los lista para que la escuela los revise.
 * Cada uno tiene consecuencias reales — una fecha mal cargada manda el saludo de
 * cumpleaños el día equivocado, y un nombre incompleto deja al chico sin
 * identificar en la planilla de asistencia.
 */
function _lpRevisar(jugadores) {
  const anioActual = new Date().getFullYear();

  const fechaImposible = [];
  const categoriaCruzada = [];
  const nombreIncompleto = [];
  const inactivos = [];

  jugadores.forEach(jugador => {
    const nombre = (jugador.name || '').trim();
    const categoria = jugador.category || 'Sin categoría';
    const anioNacio = _lpAnioNacimiento(jugador.birthDate);
    const edad = _lpEdad(jugador.birthDate);

    // Una fecha futura o una edad fuera de rango es siempre un error de tipeo.
    if (jugador.birthDate && (edad === null || edad < 0 || edad > 30)) {
      fechaImposible.push({ nombre, categoria, detalle: `nació ${jugador.birthDate}` });
    } else if (anioNacio !== null) {
      // Solo se compara si la fecha es creíble: si ya se marcó como imposible,
      // avisar además que "está en otra categoría" es ruido sobre el mismo error.
      const anioCategoria = _lpAnioCategoria(categoria);
      if (anioCategoria !== null && anioCategoria !== anioNacio) {
        categoriaCruzada.push({ nombre, categoria, detalle: `nació en ${anioNacio}` });
      }
    }

    if (nombre && nombre.split(/\s+/).length < 2) {
      nombreIncompleto.push({ nombre, categoria, detalle: 'falta apellido' });
    }

    if (jugador.status && jugador.status !== 'Activo') {
      inactivos.push({ nombre, categoria, detalle: 'dado de baja' });
    }
  });

  void anioActual; // reservado por si se agrega un chequeo por temporada

  return [
    {
      titulo: 'Fecha de nacimiento imposible',
      nota: 'La fecha cargada da una edad que no puede ser. Casi seguro es un error de tipeo — corregila para que el cumpleaños y la categoría salgan bien.',
      filas: fechaImposible
    },
    {
      titulo: 'Está en una categoría de otro año',
      nota: 'Puede ser correcto (subir de categoría es normal), pero vale confirmarlo uno por uno.',
      filas: categoriaCruzada
    },
    {
      titulo: 'Nombre incompleto',
      nota: 'Cargado con una sola palabra. Completá nombre y apellidos.',
      filas: nombreIncompleto
    },
    {
      titulo: 'Inactivos',
      nota: 'No aparecen en la app ni reciben avisos. Confirmá si siguen así.',
      filas: inactivos
    }
  ].filter(bloque => bloque.filas.length > 0);
}

/* ────────────────────────────────────────────────────────────────────────────
   PLANTILLA
   ──────────────────────────────────────────────────────────────────────────── */

/** Hoja de estilos de la planilla impresa. */
const _LP_CSS = `
  @page { size: A4; margin: 12mm 10mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #16181d;
         font-size: 9.5pt; margin: 0;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* La portada entra justa en una A4. Si se agrega algo, hay que restarle altura
     a otra cosa o se desborda a una segunda hoja casi vacía. */
  .portada { text-align: center; padding-top: 8mm; page-break-after: always; }
  .portada .marca { font-size: 10pt; letter-spacing: .22em; color: #6b7280; text-transform: uppercase; }
  .portada h1 { font-size: 26pt; margin: 10px 0 3px; letter-spacing: -.5px; }
  .portada .sub { font-size: 11pt; color: #6b7280; margin-bottom: 20px; }
  .portada .fecha { font-size: 9.5pt; color: #6b7280; margin-top: 18px; }

  .kpis { display: flex; justify-content: center; gap: 12px; margin: 18px 0 24px; }
  .kpi { border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 12px 22px; min-width: 100px; }
  .kpi b { display: block; font-size: 21pt; line-height: 1.1; }
  .kpi span { font-size: 7.5pt; color: #6b7280; text-transform: uppercase; letter-spacing: .07em; }

  .tablares { margin: 0 auto; border-collapse: collapse; min-width: 250px; }
  .tablares td { border-bottom: 1px solid #eef0f3; padding: 3.5px 16px; text-align: left; font-size: 9pt; }
  .tablares td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .tablares tr:last-child td { border-bottom: none; }
  .restit { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .1em;
            color: #6b7280; margin-bottom: 8px; }

  .instr { max-width: 132mm; margin: 20px auto 0; border: 1.5px solid #e5e7eb; border-radius: 10px;
           padding: 12px 18px; text-align: left; font-size: 8.5pt; color: #374151; line-height: 1.55; }
  .instr b { display: block; margin-bottom: 6px; color: #16181d; }

  /* Las categorías fluyen entre hojas (una de 63 chicos no entra en una sola).
     Lo que no se parte es cada fila, y el título nunca queda solo al pie. */
  .cat { margin-bottom: 15px; }
  .cathead { display: flex; align-items: baseline; gap: 10px; border-bottom: 2px solid #16181d;
             padding-bottom: 5px; margin-bottom: 0;
             break-after: avoid; page-break-after: avoid; }
  .cathead h2 { font-size: 12.5pt; margin: 0; }
  .conteo { font-size: 8.5pt; color: #6b7280; }

  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .06em; color: #6b7280;
       text-align: left; padding: 6px 5px; border-bottom: 1px solid #e5e7eb; font-weight: 600; }
  td { padding: 3px 5px; border-bottom: 1px solid #f1f2f4; vertical-align: middle; }
  tr { page-break-inside: avoid; }

  .c-chk { width: 8mm; text-align: center; }
  .c-n   { width: 8mm; color: #9ca3af; font-size: 8pt; text-align: right;
           font-variant-numeric: tabular-nums; }
  .c-f   { width: 13mm; }
  .c-doc { width: 26mm; font-variant-numeric: tabular-nums; font-size: 8.5pt; }
  .c-ed  { width: 11mm; text-align: center; font-variant-numeric: tabular-nums; }
  .c-obs { width: 42mm; }
  .c-nom { font-weight: 500; }

  .box { display: inline-block; width: 3.6mm; height: 3.6mm; border: 1.2px solid #9ca3af;
         border-radius: 2px; }
  .ph { width: 10mm; height: 10mm; border-radius: 50%; object-fit: cover; display: block;
        background: #f3f4f6; }
  .falta { color: #c0392b; font-weight: 600; }
  .tag { font-size: 6.5pt; background: #fdecea; color: #c0392b; border-radius: 3px;
         padding: 1px 4px; margin-left: 6px; letter-spacing: .04em; vertical-align: middle; }
  tr.inact td { color: #9ca3af; }

  .revpage { page-break-before: always; }
  .revh { font-size: 15pt; margin: 0 0 3px; }
  .revsub { font-size: 9pt; color: #6b7280; margin: 0 0 18px; max-width: 150mm; line-height: 1.5; }
  .rev { margin-bottom: 17px; page-break-inside: avoid; }
  .rev h3 { font-size: 10.5pt; margin: 0 0 2px; display: flex; align-items: baseline; gap: 8px; }
  .cuenta { font-size: 7.5pt; background: #16181d; color: #fff; border-radius: 20px;
            padding: 1.5px 7px; font-weight: 600; }
  .nota { font-size: 8.5pt; color: #6b7280; margin: 0 0 6px; line-height: 1.45; }
  .revt { width: 100%; border-collapse: collapse; }
  .revt td { padding: 3px 5px; font-size: 9pt; border-bottom: 1px solid #f1f2f4; }
  .revt td:first-child { font-weight: 500; width: 62mm; }
  .revt td:nth-child(2) { color: #6b7280; width: 36mm; }
  .revt td:last-child { color: #c0392b; font-size: 8.5pt; }
`;

/** Portada: totales y cómo se usa la planilla. */
function _lpPortada(club, ciudad, grupos, totalJugadores, totalConFoto, fecha) {
  const filasResumen = grupos.map(([categoria, lista]) => `
        <tr><td>${_lpEsc(categoria)}</td><td class="num">${lista.length}</td></tr>`).join('');

  return `
  <section class="portada">
    <div class="marca">MY CLUB</div>
    <h1>${_lpEsc(club)}</h1>
    <div class="sub">Listado de jugadores${ciudad ? ' · ' + _lpEsc(ciudad) : ''}</div>

    <div class="kpis">
      <div class="kpi"><b>${totalJugadores}</b><span>Jugadores</span></div>
      <div class="kpi"><b>${grupos.length}</b><span>Categorías</span></div>
      <div class="kpi"><b>${totalConFoto}</b><span>Con foto</span></div>
    </div>

    <div class="restit">Jugadores por categoría</div>
    <table class="tablares">
      ${filasResumen}
      <tr><td><b>Total</b></td><td class="num">${totalJugadores}</td></tr>
    </table>

    <div class="instr">
      <b>Cómo usar esta planilla</b>
      Marcá la casilla ✓ de cada jugador que esté al día en la escuela. Los que queden
      sin marcar son los que hay que revisar: dar de baja, actualizar o completar. Usá
      la columna de observaciones para anotar lo que encuentres.
    </div>

    <div class="fecha">Generado el ${_lpEsc(fecha)}</div>
  </section>`;
}

/** Un bloque de categoría con su tabla de jugadores. */
function _lpBloqueCategoria(categoria, lista, fotoPorDefecto) {
  const filas = lista.map((jugador, indice) => {
    const activo = !jugador.status || jugador.status === 'Activo';
    const nombre = (jugador.name || '').trim();
    const edad = _lpEdad(jugador.birthDate);
    const documento = (jugador.documentNumber || '').trim();
    const foto = jugador.avatar || fotoPorDefecto;

    return `
        <tr class="${activo ? '' : 'inact'}">
          <td class="c-chk"><span class="box"></span></td>
          <td class="c-n">${indice + 1}</td>
          <td class="c-f"><img class="ph" src="${_lpEsc(foto)}" alt="">
          </td>
          <td class="c-nom">${_lpEsc(nombre) || '<span class="falta">Sin nombre</span>'}${
            activo ? '' : '<span class="tag">INACTIVO</span>'}</td>
          <td class="c-doc">${_lpEsc(documento) || '<span class="falta">—</span>'}</td>
          <td class="c-ed">${edad === null ? '' : edad}</td>
          <td class="c-obs"></td>
        </tr>`;
  }).join('');

  return `
  <section class="cat">
    <div class="cathead">
      <h2>${_lpEsc(categoria)}</h2>
      <span class="conteo">${lista.length} ${lista.length === 1 ? 'jugador' : 'jugadores'}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th class="c-chk">✓</th><th class="c-n">#</th><th class="c-f">Foto</th>
          <th>Nombre completo</th><th class="c-doc">Documento</th>
          <th class="c-ed">Edad</th><th class="c-obs">Observaciones</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  </section>`;
}

/** Anexo con los problemas de datos detectados. */
function _lpAnexo(bloques) {
  if (bloques.length === 0) return '';

  const contenido = bloques.map(bloque => `
    <div class="rev">
      <h3>${_lpEsc(bloque.titulo)} <span class="cuenta">${bloque.filas.length}</span></h3>
      <p class="nota">${_lpEsc(bloque.nota)}</p>
      <table class="revt">
        ${bloque.filas.map(fila => `
        <tr>
          <td>${_lpEsc(fila.nombre) || 'Sin nombre'}</td>
          <td>${_lpEsc(fila.categoria)}</td>
          <td>${_lpEsc(fila.detalle)}</td>
        </tr>`).join('')}
      </table>
    </div>`).join('');

  return `
  <section class="revpage">
    <h2 class="revh">Para revisar</h2>
    <p class="revsub">Detectado automáticamente al armar este listado. No frena nada:
      la app funciona igual, pero corregirlo mejora los cumpleaños, las categorías y
      los avisos.</p>
    ${contenido}
  </section>`;
}

/* ────────────────────────────────────────────────────────────────────────────
   IMPRESIÓN
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Manda el documento a imprimir desde un iframe oculto.
 *
 * Espera a que carguen las fotos antes de abrir el diálogo: si se imprime
 * mientras siguen bajando, salen los huecos vacíos. El tope de tiempo evita que
 * una foto rota o una conexión lenta dejen a la persona esperando para siempre —
 * pasado ese punto se imprime igual, con las fotos que hayan llegado.
 */
function _lpImprimir(html, tiempoMaximoMs = 15000) {
  return new Promise(resolve => {
    const marco = document.createElement('iframe');
    marco.setAttribute('aria-hidden', 'true');
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(marco);

    let terminado = false;
    const limpiar = () => {
      if (terminado) return;
      terminado = true;
      // Se saca después del diálogo: si se borra antes, algunos navegadores
      // cancelan la impresión a medio camino.
      setTimeout(() => marco.remove(), 1000);
      resolve();
    };

    const doc = marco.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();

    const imprimir = () => {
      if (terminado) return;
      try {
        marco.contentWindow.focus();
        marco.contentWindow.print();
      } catch (_) { /* si el navegador lo bloquea, no hay nada que hacer */ }
      limpiar();
    };

    const imagenes = [...doc.images];
    const pendientes = imagenes.filter(img => !img.complete);

    if (pendientes.length === 0) {
      // Un cuadro de margen para que termine de maquetar antes de medir páginas.
      setTimeout(imprimir, 100);
      return;
    }

    let faltan = pendientes.length;
    const unaMenos = () => { if (--faltan <= 0) imprimir(); };
    pendientes.forEach(img => {
      img.addEventListener('load', unaMenos, { once: true });
      img.addEventListener('error', unaMenos, { once: true });
    });

    setTimeout(imprimir, tiempoMaximoMs);
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   ENTRADA
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Genera el listado de jugadores y lo manda a imprimir.
 *
 * Se expone en window porque el botón la llama desde el HTML (index.html, vista
 * de Jugadores).
 */
async function exportPlayersPDF() {
  if (window._lpGenerando) return; // doble toque en el botón
  const jugadores = getPlayers();

  if (!jugadores || jugadores.length === 0) {
    showToast('No hay jugadores para exportar');
    return;
  }

  const confirmado = await showAppConfirm(
    `Se va a armar la planilla de ${jugadores.length} jugadores, ordenada por categoría y con foto.\n\n` +
    `Se abrirá el cuadro de impresión: elegí "Guardar como PDF" para descargarla.`,
    { type: 'info', title: 'Listado de jugadores', confirmText: 'Generar' }
  );
  if (!confirmado) return;

  window._lpGenerando = true;
  showToast('Armando la planilla…');

  try {
    const ajustes = (typeof getSchoolSettings === 'function' ? getSchoolSettings() : {}) || {};
    const fotoPorDefecto = (typeof getDefaultAvatar === 'function' ? getDefaultAvatar() : '');

    const grupos = _lpAgrupar(jugadores);
    const totalConFoto = jugadores.filter(j => !!j.avatar).length;
    const fecha = new Date().toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    const cuerpo =
      _lpPortada(ajustes.name || 'MI CLUB', ajustes.city || '', grupos,
                 jugadores.length, totalConFoto, fecha) +
      grupos.map(([categoria, lista]) =>
        _lpBloqueCategoria(categoria, lista, fotoPorDefecto)).join('') +
      _lpAnexo(_lpRevisar(jugadores));

    // El <title> es el nombre que el navegador propone al guardar el PDF.
    const nombreArchivo = `${(ajustes.name || 'Club').replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/g, '')} — listado de jugadores`;

    await _lpImprimir(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${_lpEsc(nombreArchivo)}</title><style>${_LP_CSS}</style></head>
<body>${cuerpo}</body></html>`);
  } catch (error) {
    console.error('Error armando el listado:', error);
    showToast('No se pudo armar el listado');
  } finally {
    window._lpGenerando = false;
  }
}

window.exportPlayersPDF = exportPlayersPDF;
