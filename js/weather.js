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
        return map[code] || ['🌡️', '—'];
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
            '&current=temperature_2m,weather_code' +
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
            if (f.daily && Array.isArray(f.daily.time)
                && Array.isArray(f.daily.weather_code)
                && Array.isArray(f.daily.temperature_2m_max)
                && Array.isArray(f.daily.temperature_2m_min)) {
                f.daily.time.forEach((d, i) => {
                    days[d] = {
                        code: f.daily.weather_code[i],
                        tmax: Math.round(f.daily.temperature_2m_max[i]),
                        tmin: Math.round(f.daily.temperature_2m_min[i])
                    };
                });
            }
            _data = {
                ts: Date.now(),
                cityQuery: city,                 // ciudad consultada (para invalidar cache al cambiar)
                city: geo.name || city,
                country: geo.country || '',
                current: (f.current && typeof f.current.temperature_2m === 'number')
                    ? { code: f.current.weather_code, temp: Math.round(f.current.temperature_2m) }
                    : null,
                days: days
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

    // Pinta el widget del Inicio.
    function paintDashboard() {
        const el = document.getElementById('weatherWidget');
        if (!el) return;
        if (!_data || !_data.current) { el.classList.add('hidden'); return; }
        const [emoji, desc] = wmo(_data.current.code);
        const loc = _data.city + (_data.country ? ', ' + _data.country : '');
        const set = (id, val) => { const n = document.getElementById(id); if (n) n.textContent = val; };
        set('weatherEmoji', emoji);
        set('weatherTemp', _data.current.temp + '°');
        set('weatherDesc', desc);
        set('weatherCity', '📍 ' + loc);
        el.classList.remove('hidden');
    }

    // Pinta los íconos del clima en las celdas del calendario (solo días con pronóstico).
    function paintCalendar() {
        if (!_data || !_data.days) return;
        const spans = document.querySelectorAll('.calendar-weather[data-date]');
        spans.forEach(sp => {
            const d = _data.days[sp.getAttribute('data-date')];
            if (d) {
                const [emoji] = wmo(d.code);
                sp.textContent = emoji;
                sp.title = d.tmin + '° / ' + d.tmax + '°';
            } else {
                sp.textContent = '';
                sp.removeAttribute('title');
            }
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
