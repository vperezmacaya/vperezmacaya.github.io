// Mapa de las instalaciones portuarias de la Región del Biobío para naves de más de 100 m
// (window.PUERTOS_GEO_DATA, de static/data/puertos_geo.js), a la izquierda de la visualización
// "Resumen de Carga". MapLibre con CatlecMapGL (estándar catlec-maplibre-map); sin lista ni ficha:
// la información va en los tooltips.
//
// Dos niveles según el zoom: a escala regional, un ícono por zona portuaria (la de la encuesta
// del INE, propiedad zona_portuaria) con la cantidad de operadores; al acercarse (o al hacer clic
// en una zona, que encuadra sus terminales), un ícono por operador, del color de su régimen, con
// su polígono (el ETL une en uno los de las instalaciones de un mismo operador).

// Régimen de propiedad (valores de 'regimen' en puertos_geo.js) → etiqueta y color del ícono
const PUERTOS_REGIMENES = [
    { value: 'Empresa portuaria estatal (Ley 19.542), concesionado', label: 'Puerto estatal concesionado', color: COLORS.navy },
    { value: 'Empresa del Estado (no portuaria)', label: 'Empresa del Estado (no portuaria)', color: COLORS.sand },
    { value: 'Privado', label: 'Privado', color: COLORS.teal }
];
const PUERTOS_REGIMEN_OTRO = { label: 'Sin clasificar', color: COLORS.steel };

// Zonas portuarias de norte a sur (las que no estén aquí van al final) y color de su ícono
const PUERTOS_ZONAS_ORDEN = ['Lirquén', 'Penco', 'Talcahuano', 'San Vicente', 'Coronel'];
const PUERTOS_ZONA_COLOR = COLORS.ocean;
// Lado de la etiqueta del ícono de zona: Lirquén y Penco, y Talcahuano y San Vicente, quedan a
// 3-4 km entre sí y a escala regional sus etiquetas se taparían
const PUERTOS_ZONA_ETIQUETA = { 'Lirquén': 'right', 'Penco': 'bottom', 'Talcahuano': 'top', 'San Vicente': 'left' };

// Bajo este zoom (MapLibre) se ven las zonas; desde este zoom, los operadores
const PUERTOS_ZONE_ZOOM = 11;
// Capas de etiquetas de localidades del mapa base (CARTO Positron) que se ocultan
const PUERTOS_LOCALIDADES_RE = /^place_(city|capital|town|villages|suburbs|hamlet)/;
// Vista inicial y "Restablecer Mapa": centro y zoom fijos (MapLibre) que eligió el usuario
// (bahía de Concepción a Coronel, en el nivel de zonas porque queda bajo PUERTOS_ZONE_ZOOM)
const PUERTOS_MAP_DEFAULT_CENTER = [-73.1183, -36.8481];
const PUERTOS_MAP_DEFAULT_ZOOM = 9.42;
// Encuadre al abrir una zona: sus terminales con margen, sin pasar de este zoom (MapLibre)
const PUERTOS_ZONE_PADDING = 70;
const PUERTOS_ZONE_MAX_ZOOM = 14;
// Radio del grupo principal de una zona, cuando todas sus terminales no caben (metros)
const PUERTOS_ZONE_CORE_M = 4000;
// Zoom al seleccionar un operador (zoom Leaflet, como pide CatlecMapGL.flyToBounds)
const PUERTOS_MAP_SELECT_ZOOM_LEAFLET = 15;

const PUERTOS_ANCHOR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/></svg>';

let puertosMap = null;
let puertosMapTip = null;
let puertosMapIsDragClick = () => false;
const puertosMapState = {
    selected: null,       // id del operador seleccionado (ícono o polígono)
    hovered: null,        // id del operador en hover (ícono o polígono)
    hoveredZone: null,    // nombre de la zona en hover (ícono de zona)
    zoneMode: true,       // true: se ven las zonas; false: los operadores
    operadores: new Map(), // id → { id, operador, features, zona, regimen, coords }
    markers: new Map(),   // id de operador → { marker, el, pulse, zona }
    zones: new Map(),     // zona → { name, features, operadores, center, bounds, marker, el, pulse }
    polygons: [],         // features de PUERTOS_GEO_DATA.poligonos (uno por operador)
    polygonIds: new Set(), // ids de los polígonos (= id de su operador)
    polygonHover: null    // id del operador cuyo polígono está bajo el cursor
};

function puertosInstalaciones() {
    return (window.PUERTOS_GEO_DATA && window.PUERTOS_GEO_DATA.features) || [];
}

function puertosPoligonosFC() {
    return (window.PUERTOS_GEO_DATA && window.PUERTOS_GEO_DATA.poligonos) || { type: 'FeatureCollection', features: [] };
}

function puertosRegimen(value) {
    return PUERTOS_REGIMENES.find(r => r.value === value) || PUERTOS_REGIMEN_OTRO;
}

function puertosEsc(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function puertosOperadorCorto(nombre) {
    return String(nombre || '').replace(/\s+S\.A\.?$/i, '');
}

// Operadores con sus instalaciones, en el orden de puertos_geo.js. El id de cada uno es el de su
// polígono (el ETL arma uno por operador) o, si no tiene (Escuadrón), el de su primera instalación.
// El ícono va en el promedio de los puntos de sus instalaciones (coordenadas de sus resoluciones)
function puertosArmarOperadores() {
    const polyDe = new Map();
    puertosPoligonosFC().features.forEach(p => {
        (p.properties.instalaciones || [p.properties.id]).forEach(i => polyDe.set(i, p.properties.id));
    });
    const porOperador = new Map();
    puertosInstalaciones().forEach(f => {
        const k = f.properties.operador;
        if (!porOperador.has(k)) porOperador.set(k, []);
        porOperador.get(k).push(f);
    });
    const ops = new Map();
    porOperador.forEach((features, operador) => {
        const first = features[0].properties;
        const id = polyDe.get(first.id) || first.id;
        const n = features.length;
        const coords = [0, 1].map(k => features.reduce((s, f) => s + f.geometry.coordinates[k], 0) / n);
        ops.set(id, { id, operador, features, zona: first.zona_portuaria, regimen: first.regimen, coords });
    });
    return ops;
}

function puertosOpZona(id) {
    const op = id && puertosMapState.operadores.get(id);
    return op ? op.zona : null;
}

// Zonas portuarias con sus instalaciones y operadores, de norte a sur
function puertosZonas() {
    const porZona = new Map();
    puertosInstalaciones().forEach(f => {
        const z = f.properties.zona_portuaria;
        if (!z) return;
        if (!porZona.has(z)) porZona.set(z, []);
        porZona.get(z).push(f);
    });
    const rank = z => { const i = PUERTOS_ZONAS_ORDEN.indexOf(z); return i < 0 ? 99 : i; };
    return [...porZona.keys()].sort((a, b) => rank(a) - rank(b)).map(name => ({
        name,
        features: porZona.get(name),
        operadores: [...puertosMapState.operadores.values()].filter(op => op.zona === name)
    }));
}

// Encuadre de un grupo de instalaciones: sus puntos y los polígonos de sus operadores
function puertosBoundsFor(features) {
    const ids = new Set(features.map(f => f.properties.id));
    const poligonos = puertosMapState.polygons.filter(p => (p.properties.instalaciones || [p.properties.id]).some(i => ids.has(i)));
    return CatlecMapGL.boundsOfFeatures([...features, ...poligonos]);
}

// Mediana de las coordenadas: el ícono de la zona queda sobre el grupo principal de terminales
// aunque una quede lejos (Escuadrón está unos 10 km al norte del resto de Coronel)
function puertosMedianCenter(features) {
    const med = arr => {
        const s = [...arr].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    return [med(features.map(f => f.geometry.coordinates[0])), med(features.map(f => f.geometry.coordinates[1]))];
}

// ── Tooltips ──────────────────────────────────────────────────────────────
// Un operador con una instalación: su nombre y el operador; con varias: el operador y la lista
function puertosOperadorTooltipHtml(op) {
    const reg = puertosRegimen(op.regimen);
    const pie = `<span style="color:#94a3b8;font-size:0.68rem;">${puertosEsc(reg.label)} · Zona ${puertosEsc(op.zona)}</span>`;
    if (op.features.length === 1) {
        return `<strong>${puertosEsc(op.features[0].properties.nombre)}</strong>`
            + `<span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">${puertosEsc(op.operador)}</span>` + pie;
    }
    return `<strong>${puertosEsc(op.operador)}</strong>`
        + `<span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">${op.features.length} terminales: ${puertosEsc(op.features.map(f => f.properties.nombre).join(' · '))}</span>`
        + pie;
}

function puertosZoneTooltipHtml(zona) {
    const n = zona.features.length;
    const operadores = zona.operadores.map(op => puertosOperadorCorto(op.operador));
    return `<strong>Zona portuaria ${puertosEsc(zona.name)}</strong>`
        + `<span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">${operadores.length} ${operadores.length === 1 ? 'operador' : 'operadores'} · ${n} ${n === 1 ? 'terminal' : 'terminales'} · clic para acercar</span>`
        + `<span style="color:#94a3b8;font-size:0.68rem;">${puertosEsc(operadores.join(', '))}</span>`;
}

// ── Íconos de operador ────────────────────────────────────────────────────
function puertosAddMarker(op) {
    const reg = puertosRegimen(op.regimen);
    const el = document.createElement('div');
    el.className = 'polygon-centroid-marker catlec-gl-marker puertos-marker';
    el.innerHTML = `<div class="centroid-marker-pulse" style="background-color:${reg.color};">${PUERTOS_ANCHOR_SVG}</div>`;
    const marker = new maplibregl.Marker({ element: el, anchor: 'center', subpixelPositioning: true })
        .setLngLat(op.coords)
        .addTo(puertosMap);

    const html = puertosOperadorTooltipHtml(op);
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (puertosMapIsDragClick()) return;
        puertosSelect(op.id);
    });
    el.addEventListener('mouseenter', (e) => {
        puertosSetHover(op.id);
        puertosMapTip.show('op:' + op.id, html, puertosMapTip.pointFromEvent(e));
    });
    el.addEventListener('mousemove', (e) => {
        puertosMapTip.show('op:' + op.id, html, puertosMapTip.pointFromEvent(e));
    });
    el.addEventListener('mouseleave', () => {
        puertosSetHover(null);
        puertosMapTip.hide();
    });
    puertosMapState.markers.set(op.id, { marker, el, pulse: el.firstElementChild, zona: op.zona });
}

// ── Íconos de zona portuaria ──────────────────────────────────────────────
function puertosAddZoneMarker(z) {
    const zona = {
        name: z.name,
        features: z.features,
        operadores: z.operadores,
        center: puertosMedianCenter(z.features),
        bounds: puertosBoundsFor(z.features)
    };
    const el = document.createElement('div');
    el.className = `polygon-centroid-marker puertos-zone-marker puertos-zone-label--${PUERTOS_ZONA_ETIQUETA[z.name] || 'bottom'}`;
    el.innerHTML = `<div class="centroid-marker-pulse puertos-zone-pulse" style="background-color:${PUERTOS_ZONA_COLOR};">${PUERTOS_ANCHOR_SVG}</div>`
        + `<span class="marker-cluster-badge">${z.operadores.length}</span>`
        + `<span class="puertos-zone-label">${puertosEsc(z.name)}</span>`;
    zona.marker = new maplibregl.Marker({ element: el, anchor: 'center', subpixelPositioning: true })
        .setLngLat(zona.center)
        .addTo(puertosMap);
    zona.el = el;
    zona.pulse = el.firstElementChild;

    const html = puertosZoneTooltipHtml(zona);
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (puertosMapIsDragClick()) return;
        puertosOpenZone(zona.name);
    });
    el.addEventListener('mouseenter', (e) => {
        puertosSetZoneHover(zona.name);
        puertosMapTip.show('zona:' + zona.name, html, puertosMapTip.pointFromEvent(e));
    });
    el.addEventListener('mousemove', (e) => {
        puertosMapTip.show('zona:' + zona.name, html, puertosMapTip.pointFromEvent(e));
    });
    el.addEventListener('mouseleave', () => {
        puertosSetZoneHover(null);
        puertosMapTip.hide();
    });
    puertosMapState.zones.set(zona.name, zona);
}

// Margen del encuadre de una zona: la leyenda desplegada ocupa la esquina inferior izquierda,
// así que se suma su ancho al margen izquierdo (si el mapa es lo bastante ancho)
function puertosZonePadding() {
    const p = PUERTOS_ZONE_PADDING;
    const pad = { top: p, right: p, bottom: p, left: p };
    const legend = puertosMap && puertosMap.getContainer().querySelector('.catlec-map-legend');
    const mapW = puertosMap ? puertosMap.getContainer().clientWidth : 0;
    if (legend && !legend.classList.contains('collapsed') && legend.offsetWidth && mapW > 2.5 * legend.offsetWidth) {
        pad.left = Math.max(p, legend.offsetWidth + 24);
    }
    return pad;
}

// Encuadra las terminales y sus polígonos de una zona; queda siempre en el nivel de operadores
function puertosOpenZone(name) {
    const zona = puertosMapState.zones.get(name);
    if (!zona || !puertosMap) return;
    puertosMapTip.hide();
    puertosSetZoneHover(null);
    // Una selección de otra zona deja de tener sentido al abrir esta
    if (puertosMapState.selected && puertosOpZona(puertosMapState.selected) !== name) puertosSelect(null);

    const opts = { padding: puertosZonePadding(), maxZoom: PUERTOS_ZONE_MAX_ZOOM };
    const minZoom = PUERTOS_ZONE_ZOOM + 0.3;
    let cam = puertosMap.cameraForBounds(zona.bounds, opts);
    if (!cam) return;
    // Si todas las terminales no caben sobre el zoom de operadores (mapa chico, o Coronel con
    // Escuadrón 10 km al norte), se encuadra el grupo principal: las terminales a menos de
    // PUERTOS_ZONE_CORE_M de la mediana
    if (cam.zoom < minZoom) {
        const core = zona.features.filter(f => CatlecMapGL.distance(f.geometry.coordinates, zona.center) <= PUERTOS_ZONE_CORE_M);
        const camCore = core.length ? puertosMap.cameraForBounds(puertosBoundsFor(core), opts) : null;
        cam = camCore || { center: zona.center, zoom: minZoom };
    }
    CatlecUtils.afterNextPaint(() => puertosMap.flyTo({
        center: cam.center,
        zoom: Math.max(cam.zoom, minZoom),
        duration: 1200,
        essential: true
    }));
}

// ── Estados ───────────────────────────────────────────────────────────────
// Estilo de un ícono de operador según selección y hover (función pura de estado)
function puertosMarkerStyle(id) {
    const { selected, hovered } = puertosMapState;
    const isSel = selected === id;
    const isHov = hovered === id;
    return {
        selected: isSel,
        hovered: isHov && !isSel,
        opacity: selected && !isSel && !isHov ? '0.35' : '1',
        zIndex: isSel ? 9000 : (isHov ? 8000 : 100)
    };
}

// Estilo de un ícono de zona: resaltado si está en hover, si contiene el operador en hover
// (desde su polígono) o el seleccionado; atenuado si hay otro seleccionado
function puertosZoneStyle(name) {
    const { selected, hovered, hoveredZone } = puertosMapState;
    const isSel = puertosOpZona(selected) === name;
    const isHov = hoveredZone === name || puertosOpZona(hovered) === name;
    return {
        selected: isSel,
        hovered: isHov && !isSel,
        opacity: selected && !isSel && !isHov ? '0.35' : '1',
        zIndex: isSel ? 9000 : (isHov ? 8000 : 200)
    };
}

function puertosApplyMarkerStyle(id) {
    const m = puertosMapState.markers.get(id);
    if (!m) return;
    const st = puertosMarkerStyle(id);
    m.marker.setOpacity(st.opacity);
    m.el.style.zIndex = String(st.zIndex);
    m.pulse.classList.toggle('active-selected', st.selected);
    m.el.classList.toggle('is-hovered', st.hovered);
    m.el.classList.toggle('puertos-marker-hidden', puertosMapState.zoneMode);
}

// ── Polígonos de los operadores (PUERTOS_GEO_DATA.poligonos) ──────────────
// Estilo de un polígono (función pura de estado): mismo criterio que el ícono de su operador
function puertosPolygonStyle(id) {
    const { selected, hovered } = puertosMapState;
    const isSel = selected === id;
    const isHov = hovered === id;
    const op = puertosMapState.operadores.get(id);
    const color = op ? puertosRegimen(op.regimen).color : PUERTOS_REGIMEN_OTRO.color;
    if (isSel || isHov) return { color, fill: 0.5, line: 1, width: 2.5 };
    if (selected) return { color, fill: 0.05, line: 0.3, width: 1 };
    return { color, fill: 0.3, line: 0.85, width: 1.5 };
}

function puertosApplyPolygonStyle(id) {
    if (!puertosMap || !puertosMapState.polygonIds.has(id) || !puertosMap.getSource('puertos-poligonos')) return;
    puertosMap.setFeatureState({ source: 'puertos-poligonos', id }, puertosPolygonStyle(id));
}

function puertosAddPolygonLayers() {
    const fc = puertosPoligonosFC();
    puertosMapState.polygons = fc.features;
    fc.features.forEach(f => puertosMapState.polygonIds.add(f.properties.id));
    puertosMap.addSource('puertos-poligonos', { type: 'geojson', data: fc, promoteId: 'id' });
    const state = (k, d) => ['coalesce', ['feature-state', k], d];
    const before = CatlecMapGL.labelsBeforeId(puertosMap);
    puertosMap.addLayer({
        id: 'puertos-pol-fill', type: 'fill', source: 'puertos-poligonos', minzoom: PUERTOS_ZONE_ZOOM,
        paint: { 'fill-color': state('color', COLORS.steel), 'fill-opacity': state('fill', 0.3) }
    }, before);
    puertosMap.addLayer({
        id: 'puertos-pol-line', type: 'line', source: 'puertos-poligonos', minzoom: PUERTOS_ZONE_ZOOM,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': state('color', COLORS.steel), 'line-opacity': state('line', 0.85), 'line-width': state('width', 1.5) }
    }, before);
}

// Operador cuyo polígono está bajo el cursor (solo en el nivel de operadores)
function puertosPolygonAt(point) {
    if (!puertosMap || puertosMapState.zoneMode || !puertosMap.getLayer('puertos-pol-fill')) return null;
    const hits = puertosMap.queryRenderedFeatures(point, { layers: ['puertos-pol-fill'] });
    if (!hits.length) return null;
    // Si se superponen polígonos, manda el más chico
    const area = f => { const b = CatlecMapGL.boundsOfFeatures([f]); return b ? (b.getEast() - b.getWest()) * (b.getNorth() - b.getSouth()) : Infinity; };
    return hits.sort((a, b) => area(a) - area(b))[0].properties.id;
}

function puertosApplyZoneStyle(name) {
    const z = puertosMapState.zones.get(name);
    if (!z) return;
    const st = puertosZoneStyle(name);
    z.marker.setOpacity(st.opacity);
    z.el.style.zIndex = String(st.zIndex);
    z.pulse.classList.toggle('active-selected', st.selected);
    z.el.classList.toggle('is-hovered', st.hovered);
    z.el.classList.toggle('puertos-marker-hidden', !puertosMapState.zoneMode);
}

function puertosUpdateMarkers() {
    puertosMapState.markers.forEach((_, id) => puertosApplyMarkerStyle(id));
    puertosMapState.polygonIds.forEach(id => puertosApplyPolygonStyle(id));
    puertosMapState.zones.forEach((_, name) => puertosApplyZoneStyle(name));
}

// Cambia de nivel solo al cruzar PUERTOS_ZONE_ZOOM (se llama en cada cuadro de zoom)
function puertosSyncZoneMode() {
    if (!puertosMap) return;
    const zoneMode = puertosMap.getZoom() < PUERTOS_ZONE_ZOOM;
    if (zoneMode === puertosMapState.zoneMode) return;
    puertosMapState.zoneMode = zoneMode;
    if (puertosMapTip) puertosMapTip.hide();
    puertosUpdateMarkers();
}

// Hover liviano de un operador (ícono o polígono): reestiliza solo lo afectado
function puertosSetHover(id) {
    const prev = puertosMapState.hovered;
    if (prev === id) return;
    puertosMapState.hovered = id;
    [prev, id].forEach(x => {
        if (!x) return;
        puertosApplyMarkerStyle(x);
        puertosApplyPolygonStyle(x);
    });
    [puertosOpZona(prev), puertosOpZona(id)].forEach(z => { if (z) puertosApplyZoneStyle(z); });
}

// Hover liviano de un ícono de zona
function puertosSetZoneHover(name) {
    const prev = puertosMapState.hoveredZone;
    if (prev === name) return;
    puertosMapState.hoveredZone = name;
    if (prev) puertosApplyZoneStyle(prev);
    if (name) puertosApplyZoneStyle(name);
}

// Selección desde el ícono o el polígono (null = quitar selección): resalta el operador,
// atenúa los demás y vuela hasta encuadrar sus instalaciones y su polígono
function puertosSelect(id) {
    puertosMapState.selected = id || null;
    puertosUpdateMarkers();
    if (!id) return;
    const op = puertosMapState.operadores.get(id);
    if (puertosMap && op) {
        CatlecUtils.afterNextPaint(() => CatlecMapGL.flyToBounds(
            puertosMap,
            puertosBoundsFor(op.features),
            { duration: 1.2, maxZoomOverride: PUERTOS_MAP_SELECT_ZOOM_LEAFLET }
        ));
    }
}

function puertosResetMap({ animate = true } = {}) {
    puertosSetHover(null);
    puertosSetZoneHover(null);
    puertosSelect(null);
    if (puertosMapTip) puertosMapTip.hide();
    if (puertosMap) {
        puertosMap.easeTo({
            center: PUERTOS_MAP_DEFAULT_CENTER,
            zoom: PUERTOS_MAP_DEFAULT_ZOOM,
            bearing: 0,
            pitch: 0,
            duration: animate ? 450 : 0
        });
    }
}

function puertosLegendHtml() {
    const presentes = new Set([...puertosMapState.operadores.values()].map(op => puertosRegimen(op.regimen).label));
    const zona = `<div class="puertos-map-legend-item"><span class="puertos-map-legend-icon puertos-map-legend-icon--zona" style="background:${PUERTOS_ZONA_COLOR};">${PUERTOS_ANCHOR_SVG}<span class="puertos-map-legend-badge">n</span></span>Zona portuaria (n.º de operadores)</div>`;
    const filas = [...PUERTOS_REGIMENES, PUERTOS_REGIMEN_OTRO]
        .filter(r => presentes.has(r.label))
        .map(r => `<div class="puertos-map-legend-item"><span class="puertos-map-legend-icon" style="background:${r.color};">${PUERTOS_ANCHOR_SVG}</span>${r.label}</div>`)
        .join('');
    const area = `<div class="puertos-map-legend-item"><span class="puertos-map-legend-area"></span>Área del operador (aprox.)</div>`;
    return `<div class="catlec-map-legend-title">Leyenda</div>${zona}<div class="puertos-map-legend-sub">Operadores, por régimen</div>${filas}${area}`;
}

// ── Mapa ──────────────────────────────────────────────────────────────────
function puertosInitMap() {
    puertosMapState.operadores = puertosArmarOperadores();
    puertosMap = CatlecMapGL.createMap('puertos-map', {
        center: PUERTOS_MAP_DEFAULT_CENTER, zoom: PUERTOS_MAP_DEFAULT_ZOOM, minZoom: 5, maxZoom: 17
    });
    puertosMapTip = CatlecMapGL.createTooltip(puertosMap);
    puertosMapIsDragClick = CatlecMapGL.trackDragClick(puertosMap);

    puertosMap.on('load', () => {
        // Sin nombres de ciudades, pueblos ni barrios del mapa base: compiten con
        // los nombres de las zonas portuarias (quedan países, regiones, aguas y calles)
        puertosMap.getStyle().layers
            .filter(l => l.type === 'symbol' && PUERTOS_LOCALIDADES_RE.test(l.id))
            .forEach(l => CatlecMapGL.setLayerVisible(puertosMap, l.id, false));
        puertosResetMap({ animate: false });
        puertosAddPolygonLayers();
        puertosMapState.operadores.forEach(puertosAddMarker);
        puertosZonas().forEach(puertosAddZoneMarker);
        puertosMapState.zoneMode = puertosMap.getZoom() < PUERTOS_ZONE_ZOOM;
        puertosUpdateMarkers();
        CatlecMapGL.addLegendControl(puertosMap, {
            html: puertosLegendHtml(),
            storageKey: 'catlec.puertos.legendCollapsed'
        });
    });

    puertosMap.on('zoom', puertosSyncZoneMode);

    // Hover sobre un polígono: resalta el operador (ícono y polígono) y muestra su tooltip
    puertosMap.on('mousemove', (e) => {
        if (CatlecMapGL.isMarkerEvent(e)) return;
        const id = puertosPolygonAt(e.point);
        if (id !== puertosMapState.polygonHover) {
            if (puertosMapState.polygonHover && puertosMapState.hovered === puertosMapState.polygonHover) puertosSetHover(null);
            puertosMapState.polygonHover = id;
            if (id) puertosSetHover(id);
            puertosMap.getCanvas().style.cursor = id ? 'pointer' : '';
        }
        const op = id ? puertosMapState.operadores.get(id) : null;
        if (op) puertosMapTip.show('pol:' + id, puertosOperadorTooltipHtml(op), e.point);
        else if (puertosMapTip.owner && puertosMapTip.owner.startsWith('pol:')) puertosMapTip.hide();
    });
    puertosMap.on('mouseout', () => {
        if (puertosMapState.polygonHover && puertosMapState.hovered === puertosMapState.polygonHover) puertosSetHover(null);
        puertosMapState.polygonHover = null;
        puertosMap.getCanvas().style.cursor = '';
        if (puertosMapTip.owner && puertosMapTip.owner.startsWith('pol:')) puertosMapTip.hide();
    });

    // Clic en un polígono: selecciona el operador; en el fondo: quita la selección
    puertosMap.on('click', (e) => {
        if (CatlecMapGL.isMarkerEvent(e) || puertosMapIsDragClick()) return;
        const id = puertosPolygonAt(e.point);
        if (id) {
            puertosSelect(id);
            return;
        }
        if (puertosMapState.selected) puertosSelect(null);
    });

    const btn = document.getElementById('btn-puertos-map-reset');
    if (btn) btn.addEventListener('click', () => puertosResetMap());
}

// El cierre global de tooltips del módulo (state.js) también oculta el del mapa
const puertosCloseTooltipsBase = window.puertosCloseAllTooltips;
window.puertosCloseAllTooltips = function () {
    if (typeof puertosCloseTooltipsBase === 'function') puertosCloseTooltipsBase();
    if (puertosMapTip) puertosMapTip.hide();
};

// Llamada por switchVisualization (ui.js) al mostrar "Resumen de Carga": crea el mapa la
// primera vez (MapLibre necesita el contenedor visible) y lo redimensiona al volver
window.renderVistaMapa = function () {
    if (!puertosMap) {
        puertosInitMap();
    } else {
        puertosMap.resize();
    }
};
