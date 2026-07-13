// ========================================
// ☀️ CLIMA METEOROLÓGICO — MY CLUB
// API: Open-Meteo (gratis, sin API key, sin registro). https://open-meteo.com
// Módulo AUTÓNOMO y TOLERANTE A FALLOS: si falla la red o falta la ciudad
// del club, simplemente NO muestra clima. NUNCA rompe la app.
// Cachea en localStorage con vencimiento (3 h) para no golpear la API ni
// depender de la red en cada render.
// ========================================
(function () {
    'use strict';

    const GEO_URL   = 'https://geocoding-api.open-meteo.com/v1/search';
    const FCAST_URL = 'https://api.open-meteo.com/v1/forecast';
    const CACHE_KEY = 'myclub_weather_cache';
    const GEO_KEY   = 'myclub_weather_geo';
    const TTL_MS    = 3 * 60 * 60 * 1000; // 3 horas
    const SCHEMA    = 2;  // subir este número al cambiar la forma de _data (invalida cachés viejas)

    let _data = null;      // { ts, city, country, current:{code,temp}, days:{ 'YYYY-MM-DD': {code,tmax,tmin} } }
    let _loading = false;  // evita llamadas concurrentes

    // WMO weather code → [emoji, descripción corta en español]
    function wmo(code) {
        const map = {
            0:  ['☀️', 'Despejado'],
            1:  ['🌤️', 'Mayormente despejado'],
            2:  ['⛅', 'Parcialmente nublado'],
            3:  ['☁️', 'Nublado'],
            45: ['🌫️', 'Niebla'], 48: ['🌫️', 'Niebla'],
            51: ['🌦️', 'Llovizna'], 53: ['🌦️', 'Llovizna'], 55: ['🌦️', 'Llovizna'],
            56: ['🌧️', 'Llovizna helada'], 57: ['🌧️', 'Llovizna helada'],
            61: ['🌧️', 'Lluvia'], 63: ['🌧️', 'Lluvia'], 65: ['🌧️', 'Lluvia fuerte'],
            66: ['🌧️', 'Lluvia helada'], 67: ['🌧️', 'Lluvia helada'],
            71: ['🌨️', 'Nieve'], 73: ['🌨️', 'Nieve'], 75: ['🌨️', 'Nieve fuerte'],
            77: ['🌨️', 'Aguanieve'],
            80: ['🌦️', 'Chubascos'], 81: ['🌧️', 'Chubascos'], 82: ['⛈️', 'Chubascos fuertes'],
            85: ['🌨️', 'Chubascos de nieve'], 86: ['🌨️', 'Chubascos de nieve'],
            95: ['⛈️', 'Tormenta'], 96: ['⛈️', 'Tormenta con granizo'], 99: ['⛈️', 'Tormenta con granizo']
        };
        return Object.prototype.hasOwnProperty.call(map, code) ? map[code] : ['🌡️', '—'];
    }

    function _getCity() {
        try {
            const s = (typeof getSchoolSettings === 'function') ? getSchoolSettings() : null;
            return (s && s.city) ? String(s.city).trim() : '';
        } catch (e) { return ''; }
    }

    function _readCache() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (!obj || !obj.ts) return null;
            if (obj.schema !== SCHEMA) return null; // formato viejo → pedir de nuevo
            if ((Date.now() - obj.ts) > TTL_MS) return null; // vencida
            // Descartar si la cache es de OTRA ciudad (cambió la config del club
            // o entró otro club en el mismo dispositivo) → se vuelve a pedir.
            if (obj.cityQuery && obj.cityQuery !== _getCity()) return null;
            return obj;
        } catch (e) { return null; }
    }

    // Geocodifica la ciudad → {lat, lon}. Cachea por nombre de ciudad.
    async function _geocode(city) {
        try {
            const raw = localStorage.getItem(GEO_KEY);
            if (raw) {
                const g = JSON.parse(raw);
                if (g && g.city === city && typeof g.lat === 'number') return g;
            }
        } catch (e) { /* ignorar cache corrupta */ }

        const url = GEO_URL + '?name=' + encodeURIComponent(city) + '&count=1&language=es&format=json';
        const res = await fetch(url);
        if (!res.ok) throw new Error('geocoding HTTP ' + res.status);
        const j = await res.json();
        const r = j && j.results && j.results[0];
        if (!r) throw new Error('ciudad no encontrada: ' + city);
        const g = { city, lat: r.latitude, lon: r.longitude, name: r.name || city, country: r.country || '' };
        try { localStorage.setItem(GEO_KEY, JSON.stringify(g)); } catch (e) { /* cuota */ }
        return g;
    }

    async function _fetchForecast(lat, lon) {
        const url = FCAST_URL + '?latitude=' + lat + '&longitude=' + lon +
            '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m' +
            '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
            '&timezone=auto&forecast_days=16';
        const res = await fetch(url);
        if (!res.ok) throw new Error('forecast HTTP ' + res.status);
        return res.json();
    }

    // Carga datos (usa cache fresca salvo force=true). Devuelve _data o null.
    async function load(force) {
        if (!force) {
            const cached = _readCache();
            if (cached) { _data = cached; return _data; }
        }
        if (_loading) return _data;
        const city = _getCity();
        if (!city) return null; // sin ciudad configurada → no hay clima
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return _data;

        _loading = true;
        try {
            const geo = await _geocode(city);
            const f = await _fetchForecast(geo.lat, geo.lon);

            const days = {};
            const forecast = [];   // primeros días ordenados (mini-pronóstico del Inicio)
            if (f.daily && Array.isArray(f.daily.time)
                && Array.isArray(f.daily.weather_code)
                && Array.isArray(f.daily.temperature_2m_max)
                && Array.isArray(f.daily.temperature_2m_min)) {
                const rnd = (v) => (typeof v === 'number') ? Math.round(v) : null;
                f.daily.time.forEach((d, i) => {
                    const entry = {
                        code: f.daily.weather_code[i],
                        tmax: rnd(f.daily.temperature_2m_max[i]),
                        tmin: rnd(f.daily.temperature_2m_min[i])
                    };
                    days[d] = entry;
                    if (i < 4) forecast.push({ date: d, code: entry.code, tmax: entry.tmax });
                });
            }
            const cur = f.current;
            _data = {
                ts: Date.now(),
                schema: SCHEMA,
                cityQuery: city,                 // ciudad consultada (para invalidar cache al cambiar)
                city: geo.name || city,
                country: geo.country || '',
                current: (cur && typeof cur.temperature_2m === 'number')
                    ? {
                        code: cur.weather_code,
                        temp: Math.round(cur.temperature_2m),
                        humidity: (typeof cur.relative_humidity_2m === 'number') ? Math.round(cur.relative_humidity_2m) : null,
                        wind: (typeof cur.wind_speed_10m === 'number') ? Math.round(cur.wind_speed_10m) : null
                    }
                    : null,
                days: days,
                forecast: forecast
            };
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(_data)); } catch (e) { /* cuota */ }
            return _data;
        } catch (e) {
            console.warn('[clima] no disponible:', e && e.message);
            return null;
        } finally {
            _loading = false;
        }
    }

    // Clima de un día concreto (para el calendario). null si está fuera del pronóstico.
    function getDay(dateStr) {
        if (!_data || !_data.days) return null;
        return _data.days[dateStr] || null;
    }

    // Pinta el widget detallado del Inicio (temp grande + humedad + viento + mini-pronóstico).
    function paintDashboard() {
        const el = document.getElementById('weatherWidget');
        if (!el) return;
        if (!_data || !_data.current) { el.classList.add('hidden'); return; }
        const c = _data.current;
        const [emoji, desc] = wmo(c.code);
        const loc = _data.city + (_data.country ? ', ' + _data.country : '');
        const set = (id, val) => { const n = document.getElementById(id); if (n) n.textContent = val; };
        set('weatherEmoji', emoji);
        set('weatherTemp', c.temp + '°');
        set('weatherDesc', desc);
        set('weatherCity', '📍 ' + loc);
        set('weatherHumidity', (c.humidity != null ? c.humidity : '--') + '%');
        set('weatherWind', (c.wind != null ? c.wind : '--') + ' km/h');

        // Mini-pronóstico de los próximos días. Contenido 100% del sistema
        // (emojis + números + etiquetas fijas), sin datos de usuario → sin XSS.
        const cont = document.getElementById('weatherForecast');
        if (cont) {
            const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
            let html = '';
            (_data.forecast || []).forEach(fc => {
                const [em] = wmo(fc.code);
                const dt = new Date(fc.date + 'T00:00:00');
                const label = (dt.getTime() === hoy.getTime()) ? 'Hoy' : (dias[dt.getDay()] || '');
                html += '<div class="text-center">' +
                    '<p class="text-[11px] text-white/70">' + label + '</p>' +
                    '<p class="text-lg leading-none my-1">' + em + '</p>' +
                    '<p class="text-xs font-bold">' + (fc.tmax != null ? fc.tmax : '--') + '°</p>' +
                    '</div>';
            });
            cont.innerHTML = html;
            cont.style.display = html ? '' : 'none'; // sin pronóstico → sin línea suelta
        }
        el.classList.remove('hidden');
    }

    // Pinta ícono + temperatura máxima en las celdas del calendario (días con pronóstico).
    function paintCalendar() {
        if (!_data || !_data.days) return;
        document.querySelectorAll('.calendar-weather[data-date]').forEach(sp => {
            const d = _data.days[sp.getAttribute('data-date')];
            sp.textContent = d ? wmo(d.code)[0] : '';
        });
        document.querySelectorAll('.calendar-temp[data-date]').forEach(tp => {
            const d = _data.days[tp.getAttribute('data-date')];
            tp.textContent = (d && d.tmax != null) ? (d.tmax + '°') : '';
        });
    }

    // API pública. refresh() = carga (cache o red) + repinta Inicio y calendario.
    window.MyWeather = {
        load: load,
        getDay: getDay,
        paintDashboard: paintDashboard,
        paintCalendar: paintCalendar,
        async refresh(force) {
            try { await load(force); } catch (e) { /* nunca romper */ }
            try { paintDashboard(); } catch (e) { }
            try { paintCalendar(); } catch (e) { }
        }
    };

    console.log('☀️ Módulo de clima cargado');
})();
