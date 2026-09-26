// ─── static/js/Landing/route-art.js ──────────────────────────────────────────
// Trazados animados de la sección "Proyectos destacados" (featured.js): dibuja
// en SVG una línea de Metro o un servicio ferroviario a partir de
// window.LANDING_ROUTES (scripts/export_landing_routes.py), sobre la red
// existente en gris tenue, con barra de escala y norte como rótulos de plano.
//
// Proyección: Web Mercator en píxeles reales del escenario (viewBox = ancho x
// alto medidos), la misma de MapLibre. build() entrega en el SVG la cámara
// equivalente (data-lng, data-lat, data-zoom), así el mapa de referencia de
// fondo (CatlecMapGL.createStaticMap) calza exacto bajo la línea.
//
// Animación: cada tramo se revela con una máscara (trazo blanco con
// pathLength=1 y stroke-dashoffset, el mismo recurso del dibujo del hero en
// art.js). Los tramos se dibujan en secuencia con una duración proporcional a
// su largo y, cuando la línea está completa, caen los pines de las estaciones
// en orden de recorrido. play() reinicia la animación; con prefers-reduced-motion el
// trazado aparece completo.
window.LandingRouteArt = (function () {
    // Tamaño por omisión, antes de medir el escenario.
    const DEFAULT_W = 720;
    const DEFAULT_H = 520;
    // Márgenes del encuadre (px): arriba queda espacio para el pin y el rótulo
    // de un terminal; abajo, para la barra de escala y el norte.
    const PAD_X = 56;
    const PAD_TOP = 48;
    const PAD_BOTTOM = 56;
    // Teselas de 512 px (MapLibre): zoom = log2(tamaño del mundo / 512).
    const TILE = 512;
    const MAX_ZOOM = 15;
    const EARTH_M = 40075016.686;
    const DRAW_MS = 2200;   // duración total del trazo, repartida por largo
    const PIN_START_MS = 150;
    const PIN_STEP_MS = 85;
    const SCALE_STEPS_KM = [0.5, 1, 2, 5, 10, 20, 50, 100];

    const n1 = (v) => Math.round(v * 10) / 10;
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    // Web Mercator normalizado (0..1).
    const mercX = (lon) => (lon + 180) / 360;
    const mercY = (lat) => {
        const s = Math.sin(lat * Math.PI / 180);
        return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
    };
    const unmerc = (x, y) => [x * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI];

    // Encuadra los puntos en el área libre (W - padRight) x H con márgenes.
    function projection(points, W, H, padRight) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(([lon, lat]) => {
            const x = mercX(lon), y = mercY(lat);
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        });
        const dx = Math.max(maxX - minX, 1e-9);
        const dy = Math.max(maxY - minY, 1e-9);
        const availW = Math.max(40, W - padRight - 2 * PAD_X);
        const availH = Math.max(40, H - PAD_TOP - PAD_BOTTOM);
        // ws = tamaño del mundo en px
        const ws = Math.min(availW / dx, availH / dy, TILE * Math.pow(2, MAX_ZOOM));
        const ox = PAD_X + (availW - dx * ws) / 2 - minX * ws;
        const oy = PAD_TOP + (availH - dy * ws) / 2 - minY * ws;
        const project = ([lon, lat]) => [n1(mercX(lon) * ws + ox), n1(mercY(lat) * ws + oy)];

        const [minLon, maxLat] = unmerc(-ox / ws, -oy / ws);
        const [maxLon, minLat] = unmerc((W - ox) / ws, (H - oy) / ws);
        const [cLon, cLat] = unmerc((W / 2 - ox) / ws, (H / 2 - oy) / ws);
        const lat0 = unmerc(0, (minY + maxY) / 2)[1];
        return {
            project,
            view: { minLon, maxLon, minLat, maxLat },
            camera: { center: [cLon, cLat], zoom: Math.log2(ws / TILE) },
            kmPerPx: EARTH_M * Math.cos(lat0 * Math.PI / 180) / ws / 1000,
        };
    }

    const pathD = (pts) => 'M' + pts.map(p => p.join(' ')).join('L');

    const pxLength = (pts) => pts.reduce((acc, p, i) => i
        ? acc + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0);

    function intersectsView(path, v) {
        return path.some(([lon, lat]) => lon >= v.minLon && lon <= v.maxLon && lat >= v.minLat && lat <= v.maxLat);
    }

    function contextLayer(kind, paths, proj) {
        const visible = (paths || []).filter(p => intersectsView(p, proj.view));
        if (!visible.length) return '';
        const d = visible.map(p => pathD(p.map(proj.project))).join('');
        return kind === 'efe'
            ? `<path class="lp-route-ctx lp-route-ctx--rail" d="${d}"/><path class="lp-route-ctx-ties" d="${d}"/>`
            : `<path class="lp-route-ctx" d="${d}"/>`;
    }

    // Barra de escala "0 — 5 km" con marcas cada mitad. Devuelve también dónde
    // termina, para ubicar el norte a su derecha.
    function scaleBar(kmPerPx, H) {
        const km = SCALE_STEPS_KM.find(s => s / kmPerPx >= 70) || SCALE_STEPS_KM[SCALE_STEPS_KM.length - 1];
        const len = n1(km / kmPerPx);
        const x = 24, y = H - 26;
        const label = km < 1 ? `${km * 1000} m` : `${km} km`;
        return {
            end: x + len,
            svg: `<g class="lp-route-scale" transform="translate(${x} ${y})">
            <path d="M0 -5V0H${len}V-5M${n1(len / 2)} -3V0"/>
            <text x="0" y="-10">0</text><text x="${len}" y="-10" text-anchor="middle">${label}</text>
        </g>`
        };
    }

    // Norte junto a la barra de escala, en la franja inferior que el trazado
    // no ocupa (PAD_BOTTOM).
    function northArrow(x, H) {
        return `<g class="lp-route-north" transform="translate(${x} ${H - 32})">
            <path d="M0 -16L6 6L0 1L-6 6Z"/><text x="11" y="4">N</text>
        </g>`;
    }

    // Pin tipo gota con la punta en (0,0), todos del color de la línea (sin
    // variantes que requieran leyenda); los terminales son más grandes y
    // llevan su nombre fijo.
    const PIN_PATH = 'M0 0C-1.6-3.4-6.5-7.2-6.5-11.6A6.5 6.5 0 1 1 6.5-11.6C6.5-7.2 1.6-3.4 0 0Z';

    function pinHtml(st, xy, i, right) {
        const cls = ['lp-route-pin'];
        if (st.terminal) cls.push('is-terminal');
        // Rótulo hacia el lado con más espacio; fijo en los terminales y, en el
        // resto, visible al pasar el mouse.
        const labelLeft = xy[0] > right * 0.62;
        const s = st.terminal ? 1.3 : 1;
        return `<g class="${cls.join(' ')}" transform="translate(${xy[0]} ${xy[1]})" style="--i:${i}">
            <title>${esc(st.name)}${st.transfer ? ' · combinación' : ''}${st.existing ? ' · estación existente' : ''}</title>
            <circle class="lp-route-stop" r="3"/>
            <g class="lp-route-pin-head"><g transform="scale(${s})"><path d="${PIN_PATH}"/><circle cx="0" cy="-11.6" r="2.4"/></g></g>
            <text class="lp-route-label" x="${labelLeft ? -11 * s : 11 * s}" y="${n1(-9 * s)}" text-anchor="${labelLeft ? 'end' : 'start'}">${esc(st.name)}</text>
        </g>`;
    }

    // route: {
    //   uid,                                   prefijo único de ids de máscara
    //   width, height,                         tamaño del escenario en px (opcional)
    //   padRight,                              px tapados a la derecha (opcional)
    //   segments: [{ paths: [[[lon,lat]...]] }],
    //   stations: [{name, lon, lat, terminal, transfer, existing}],
    //   context: ['metro'|'efe', ...]
    // }
    // El color de la línea lo pone el contenedor con --route-color (CSS).
    function build(route) {
        const points = [];
        route.segments.forEach(s => s.paths.forEach(p => points.push(...p)));
        route.stations.forEach(s => points.push([s.lon, s.lat]));
        if (!points.length) return '';
        const W = Math.round(route.width || DEFAULT_W);
        const H = Math.round(route.height || DEFAULT_H);
        const padRight = Math.round(Math.min(W * 0.7, Math.max(0, route.padRight || 0)));
        const right = W - padRight;
        const proj = projection(points, W, H, padRight);
        const ctxData = (window.LANDING_ROUTES && LANDING_ROUTES.context) || {};

        // Tramos proyectados con su largo en píxeles, para repartir el tiempo.
        const parts = [];
        route.segments.forEach(seg => seg.paths.forEach(p => {
            const pts = p.map(proj.project);
            parts.push({ pts, len: pxLength(pts) });
        }));
        const total = parts.reduce((a, p) => a + p.len, 0) || 1;
        let acc = 0;
        const lines = parts.map((p, i) => {
            const d = pathD(p.pts);
            const delay = Math.round(DRAW_MS * acc / total);
            const dur = Math.max(120, Math.round(DRAW_MS * p.len / total));
            acc += p.len;
            const id = `${route.uid}-m${i}`;
            return `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
                    <path class="lp-route-reveal" pathLength="1" d="${d}" style="--d:${delay}ms;--t:${dur}ms"/>
                </mask>
                <g mask="url(#${id})">
                    <path class="lp-route-casing" d="${d}"/>
                    <path class="lp-route-line" d="${d}"/>
                </g>`;
        });

        const scale = scaleBar(proj.kmPerPx, H);
        const pins = route.stations.map((st, i) => pinHtml(st, proj.project([st.lon, st.lat]), i, right));
        const cam = proj.camera;

        return `<svg class="lp-route" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"
                data-w="${W}" data-h="${H}" data-pad="${padRight}"
                data-lng="${cam.center[0].toFixed(6)}" data-lat="${cam.center[1].toFixed(6)}" data-zoom="${cam.zoom.toFixed(4)}"
                style="--pins-at:${DRAW_MS + PIN_START_MS}ms;--pin-step:${PIN_STEP_MS}ms"
                role="img" aria-label="${esc(route.label || 'Trazado del proyecto')}">
            <g class="lp-route-context">${(route.context || []).map(k => contextLayer(k, ctxData[k], proj)).join('')}</g>
            <g class="lp-route-lines">${lines.join('')}</g>
            <g class="lp-route-pins">${pins.join('')}</g>
            ${scale.svg}
            ${northArrow(scale.end + 30, H)}
        </svg>`;
    }

    // Cámara MapLibre equivalente a la proyección de un SVG de build().
    function camera(svg) {
        return {
            center: [Number(svg.dataset.lng), Number(svg.dataset.lat)],
            zoom: Number(svg.dataset.zoom),
        };
    }

    const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Arranca (o reinicia) el trazado de un SVG construido con build().
    function play(svg) {
        if (!svg) return;
        svg.classList.remove('is-drawing', 'is-drawn');
        if (reduceMotion()) {
            svg.classList.add('is-drawn');
            return;
        }
        void svg.getBoundingClientRect();
        svg.classList.add('is-drawing');
    }

    // Deja el trazado vacío (diapositiva inactiva).
    function reset(svg) {
        if (svg) svg.classList.remove('is-drawing', 'is-drawn');
    }

    return { build, camera, play, reset };
})();
