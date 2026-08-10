// ========================================
// BOOTSTRAP — Inicialización de la app
// Se ejecuta después de que todos los scripts estén cargados
// ========================================

// Inicializar Lucide Icons
try {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    } else {
        console.warn('⚠️ Lucide Icons no disponible — iconos no renderizados');
    }
} catch (e) {
    console.warn('⚠️ Error al inicializar Lucide Icons:', e);
}

/* ════════════════════════════════════════════════════════════════════════════
   AVISO DE NUEVA VERSIÓN
   ══════════════════════
   El service worker nuevo se instala pero queda EN ESPERA (sw.js ya no llama a
   skipWaiting al instalar). Acá se avisa, y solo si la persona acepta se le da
   permiso de tomar el control.

   Por qué importa: si la versión nueva se impone en caliente, el cambio ocurre a
   mitad de sesión y puede interrumpir la hidratación de IndexedDB — la app queda
   en blanco (pasó en producción, v1.7.10).
   ════════════════════════════════════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
    // Una sola recarga, pase lo que pase. Sin esta guarda, dos eventos seguidos
    // (o dos pestañas abiertas) recargan la app en bucle.
    let _yaRecargando = false;

    // ¿Ya había un worker al mando cuando arrancó esta carga?
    //
    // Hace falta distinguirlo porque 'controllerchange' NO significa solo
    // "actualizaron la app": también se dispara la PRIMERA vez que un worker toma
    // el control, por el clients.claim() del activate. Eso pasa en cada
    // dispositivo nuevo y cada vez que se usa "limpiar caché" (que desregistra el
    // SW). Sin esta distinción, esos casos se comían una recarga de más sin que
    // hubiera ninguna versión nueva — lo contrario de lo que se busca acá.
    let _habiaControlador = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (_yaRecargando) return;
        if (!_habiaControlador) {
            // Primera toma de control: la página ya está mostrando esta versión,
            // no hay nada que recargar.
            _habiaControlador = true;
            return;
        }
        _yaRecargando = true;
        window.location.reload();
    });

    /**
     * Ofrece la actualización y, si aceptan, deja pasar al worker que espera.
     *
     * La recarga NO se hace acá: se hace en 'controllerchange', cuando el worker
     * nuevo ya tomó el control. Recargar apenas se manda el mensaje es una
     * carrera — la página vuelve a cargar con el worker viejo todavía al mando y
     * la persona ve la misma versión de antes.
     */
    const ofrecerActualizacion = (workerEnEspera) => {
        if (!workerEnEspera) return;
        const aplicar = () => workerEnEspera.postMessage({ type: 'SKIP_WAITING' });

        if (typeof showUpdateModal === 'function') {
            showUpdateModal(aplicar);
            return;
        }

        // cache.js (que define showUpdateModal) va con `defer` y este archivo no,
        // así que al arrancar todavía no está. Se espera mirando, no un tiempo
        // fijo: con un setTimeout largo el aviso llegaba tarde aunque cache.js ya
        // estuviera listo hace rato.
        //
        // Si pasado el tope sigue sin aparecer, se aplica sin preguntar: es
        // preferible a dejar a la persona clavada en una versión vieja.
        const DESDE = Date.now();
        const TOPE_MS = 8000;
        const revisar = setInterval(() => {
            if (typeof showUpdateModal === 'function') {
                clearInterval(revisar);
                showUpdateModal(aplicar);
            } else if (Date.now() - DESDE > TOPE_MS) {
                clearInterval(revisar);
                aplicar();
            }
        }, 150);
    };

    navigator.serviceWorker.register('sw.js').then(registration => {
        // Caso 1: ya había una versión esperando de una sesión anterior (la
        // persona cerró la app sin aceptar). Sin esto queda trabada para siempre.
        if (registration.waiting && navigator.serviceWorker.controller) {
            ofrecerActualizacion(registration.waiting);
        }

        // Caso 2: la versión nueva llega con la app abierta.
        registration.addEventListener('updatefound', () => {
            const workerNuevo = registration.installing;
            if (!workerNuevo) return;
            workerNuevo.addEventListener('statechange', () => {
                // `controller` distingue una actualización de la PRIMERA instalación:
                // en la primera no hay nada que avisar, es la app arrancando.
                if (workerNuevo.state === 'installed' && navigator.serviceWorker.controller) {
                    ofrecerActualizacion(registration.waiting || workerNuevo);
                }
            });
        });

        // Buscar actualizaciones al volver a la app. Sin esto, quien deja la PWA
        // abierta días enteros no se entera de una versión nueva hasta que la
        // cierra del todo — y las escuelas la dejan abierta toda la jornada.
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                registration.update().catch(() => { /* sin red: se reintenta después */ });
            }
        });
    }).catch(err => console.log('❌ Error al registrar SW', err));
}
