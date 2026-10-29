// ─── static/js/MOP/project-map.js ─────────────────────────────────────────────
// Mapa MapLibre de la visualización "Tabla de proyectos" (patrón EFE: mapa +
// separador + tabla). Las utilidades comunes vienen de CatlecMapGL
// (common/map-gl.js); la tabla, los filtros y la selección viven en main.js.
//
// Navegación por región: el mapa parte solo con las 16 regiones
// (window.SNI_REGIONS_DATA, los polígonos del coroplético de SNI), clickeables.
// Clic en una región = filtro "Región" del panel con esa región (main.js,
// mopSetRegionFilter); y cuando el filtro tiene exactamente una región, el mapa
// vuela a ella y muestra sus proyectos (mopMapSetRegionFromFilter). Al
// seleccionar un proyecto (fila o mapa) muestra únicamente ese proyecto y, al
// quitar la selección, vuelve a la región. Dibujar los ~450 íconos de todo el
// país a la vez hacía que el mapa se trabara al moverlo.
//
// - Geometría: window.MOP_GEO_DATA (static/data/mop_geo.js, generado por
//   export_geo_data.py desde Mapas vectoriales/MOP). Una feature por proyecto y
//   tipo, con properties { bip, kind: 'line' | 'point', regions: [codregion] }.
//   Solo tienen geometría los proyectos de la hoja Base MOP con trazado o
//   ubicación en proyectos.mop.gob.cl; el resto aparece en la tabla pero no en el mapa.
// - Trazados: capa de líneas con estilo por feature-state (color por servicio),
//   capa superior para lo seleccionado o en hover y capa ancha de detección.
// - Ubicaciones puntuales: marcadores HTML con clusters desplegables (~80 m),
//   solo los de la región o el proyecto visibles.
// - Islas oceánicas y Antártica: con la Región de Valparaíso elegida se abren,
//   en una columna pegada a la esquina superior izquierda del mapa (el zoom
//   pasa a su derecha), dos recuadros fijos (Isla de Pascua y Juan Fernández,
//   como Alaska y Hawái en los mapas de EE. UU.), y con Magallanes uno de la
//   Antártica Chilena, porque el encuadre de la región los deja fuera. Son mapas MapLibre pequeños sin arrastre ni zoom
//   (CatlecMapGL.createStaticMap con events) con las mismas capas, íconos,
//   hover, tooltip y selección que el mapa principal.

const MOP_MAP_DEFAULT_CENTER = [-71.5, -38.5];
const MOP_MAP_DEFAULT_ZOOM = 4 - CatlecMapGL.ZOOM_OFFSET;
const MOP_MAP_HOVER_LAYERS = ['mop-shapes-hit', 'mop-polys-fill'];
const MOP_LINE_DEFAULT_COLOR = '#0c71c3';
// Los encuadres dejan fuera las islas oceánicas (Juan Fernández, Isla de Pascua)
// y la Antártica: siguen en el mapa, pero incluirlas achicaría todo el continente.
const MOP_MAP_EXTENT_MIN_LNG = -76;
const MOP_CHILE_CONTINENTAL_BOUNDS = [[-76, -56.5], [-66, -17.4]];
// codregion (sni_regions_data.js) ↔ nombre de la región en MOP_DATA
const MOP_REGION_NAMES = {
    15: 'Arica y Parinacota', 1: 'Tarapacá', 2: 'Antofagasta', 3: 'Atacama', 4: 'Coquimbo',
    5: 'Valparaíso', 13: 'Metropolitana de Santiago', 6: "Libertador General Bernardo O'Higgins",
    7: 'Maule', 16: 'Ñuble', 8: 'Biobío', 9: 'La Araucanía', 14: 'Los Ríos', 10: 'Los Lagos',
    11: 'Aysén del General Carlos Ibáñez del Campo', 12: 'Magallanes y de la Antártica Chilena'
};
// Coroplético de la vista del país: proyectos por región en clases por cuantiles
// (paleta institucional del celeste al azul marino, la del antiguo "Mapa regional")
const MOP_REGION_SCALE = ['#d6ecfb', '#9fd1f6', '#2ea3f2', '#0c71c3', '#0a4f8f', '#001c41'];
const MOP_REGION_EMPTY = '#e5e7eb';
const MOP_REGION_CODES = Object.fromEntries(Object.entries(MOP_REGION_NAMES).map(([code, name]) => [name, Number(code)]));

// Recuadros de territorios que el encuadre de su región deja fuera: las islas
// oceánicas de Valparaíso y la Antártica Chilena de Magallanes. Cada uno se ve
// con su `region` elegida; `area` decide qué geometrías van en él y `view` es
// su encuadre (en Juan Fernández, Robinson Crusoe y Santa Clara: Alejandro
// Selkirk queda 180 km al oeste; en la Antártica, la península Fildes de la isla
// Rey Jorge, donde están el aeródromo Teniente Marsh y Bahía Fildes)
const MOP_ISLAND_INSETS = [
    { id: 'pascua', region: 5, name: 'Isla de Pascua', area: [[-110, -28], [-108.5, -26.5]], view: [[-109.47, -27.215], [-109.2, -27.045]] },
    { id: 'juan-fernandez', region: 5, name: 'Archipiélago Juan Fernández', area: [[-81, -34.2], [-78.5, -33.2]], view: [[-79.03, -33.72], [-78.75, -33.58]] },
    { id: 'antartica', region: 12, name: 'Antártica Chilena (isla Rey Jorge)', area: [[-90, -90], [-53, -60]], view: [[-59.12, -62.245], [-58.68, -62.12]] }
];

// Índices BIP → features y BIP → regiones que cruza su geometría
const MOP_GEO_INDEX = {};
const MOP_GEO_REGIONS = {};
((window.MOP_GEO_DATA && window.MOP_GEO_DATA.features) || []).forEach(f => {
    const bip = String((f.properties || {}).bip || '').trim();
    if (!bip || !f.geometry) return;
    (MOP_GEO_INDEX[bip] = MOP_GEO_INDEX[bip] || []).push(f);
    const regions = MOP_GEO_REGIONS[bip] = MOP_GEO_REGIONS[bip] || new Set();
    (f.properties.regions || []).forEach(c => regions.add(Number(c)));
});

function mopInArea(lngLat, area) {
    const [[w, s], [e, n]] = area;
    return !!lngLat && lngLat[0] >= w && lngLat[0] <= e && lngLat[1] >= s && lngLat[1] <= n;
}

// Geometrías de cada isla; el mapa del recuadro se crea recién al mostrarlo
MOP_ISLAND_INSETS.forEach(inset => {
    inset.features = Object.values(MOP_GEO_INDEX).flat().filter(f => mopInArea(CatlecMapGL.boundsCenter(f), inset.area));
    inset.bips = new Set(inset.features.map(f => String(f.properties.bip)));
    Object.assign(inset, { map: null, ready: false, markers: [], lineBips: new Set(), polyBips: new Set() });
});

let mopProjectMap = null;
let mopMapReady = false;
let mopMapTooltip = null;
let mopMapIsDragClick = () => false;
let mopMapHoverKey = null;
let mopProjectsByBip = null;
let mopLineBips = new Set();        // BIP con trazado en la fuente 'mop-shapes'
let mopPolyBips = new Set();        // BIP con polígonos en la fuente 'mop-polys' (ej. obras de un EIA)
let mopPointMarkers = [];           // marcadores HTML de los proyectos puntuales visibles
let mopClusterOrigins = [];         // orígenes de clusters desplegados
let mopActiveBips = new Set();      // BIP con ubicación que pasan los filtros
let mopVisibleBips = new Set();     // BIP dibujados: los de la región o el seleccionado
let mopMapProjects = [];            // proyectos filtrados (última llamada de main.js)
let mopRegionStats = {};            // codregion → { total, geo } con todos los filtros salvo el de región
let mopRegionBreaks = [];           // cortes de clase del coroplético
let mopIslandControl = null;        // control con los recuadros de las islas
let mopIslandShown = [];            // recuadros de la columna (abierta o abriéndose)
let mopIslandSwapTimer = null;      // cambio de recuadros tras esconder la columna
const mopMapState = { selected: null, hovered: null, region: null, hoveredRegion: null };

function mopProjectHasGeo(bip) {
    return !!(bip && MOP_GEO_INDEX[bip]);
}

// Ubicación referencial: el punto del aeródromo que nombra el proyecto
// (export_geo_data.py, src 'aerodromo'), no el de la obra
function mopProjectGeoIsAerodromo(bip) {
    return !!(bip && MOP_GEO_INDEX[bip] && MOP_GEO_INDEX[bip].some(f => f.properties.src === 'aerodromo'));
}

function mopProjectByBip(bip) {
    if (!mopProjectsByBip) {
        mopProjectsByBip = new Map(((window.MOP_DATA && window.MOP_DATA.projects) || []).map(p => [p.bip, p]));
    }
    return mopProjectsByBip.get(bip) || null;
}

function mopProjectColor(p) {
    return (p && MOP_SERVICIO_COLORS[p.servicio]) || MOP_OTROS_COLOR;
}

function mopBipInRegion(bip, code) {
    return !!(MOP_GEO_REGIONS[bip] && MOP_GEO_REGIONS[bip].has(code));
}

// Proyectos por región (región declarada en el Excel, como el filtro de la tabla)
function mopComputeRegionStats(projects) {
    const stats = {};
    Object.keys(MOP_REGION_NAMES).forEach(code => { stats[code] = { total: 0, geo: 0 }; });
    projects.forEach(p => {
        const code = MOP_REGION_CODES[p.region];
        if (!code) return;
        stats[code].total++;
        if (mopProjectHasGeo(p.bip)) stats[code].geo++;
    });
    return stats;
}

// Cortes por cuantiles: cada clase agrupa una cantidad similar de regiones
function mopComputeRegionBreaks(values) {
    const v = values.filter(x => x > 0).sort((a, b) => a - b);
    if (!v.length) return [];
    const k = MOP_REGION_SCALE.length;
    return Array.from({ length: k - 1 }, (_, i) => v[Math.min(v.length - 1, Math.floor(((i + 1) / k) * v.length))]);
}

function mopRegionClass(value) {
    let i = 0;
    while (i < mopRegionBreaks.length && value > mopRegionBreaks[i]) i++;
    return i;
}

function mopRegionColor(value) {
    return value > 0 ? MOP_REGION_SCALE[mopRegionClass(value)] : MOP_REGION_EMPTY;
}

// El coroplético solo se ve en la vista del país: sin región elegida ni un
// proyecto con ubicación seleccionado (entonces el mapa base queda sin color)
function mopShowChoropleth() {
    return !mopMapState.region && !(mopMapState.selected && mopProjectHasGeo(mopMapState.selected));
}

// Lo que se dibuja: solo el proyecto seleccionado (si tiene ubicación); si no,
// los proyectos filtrados de la región elegida; sin región, nada.
function mopComputeVisibleBips() {
    const { selected, region } = mopMapState;
    if (selected && mopProjectHasGeo(selected)) return new Set([selected]);
    if (!region) return new Set();
    return new Set([...mopActiveBips].filter(bip => mopBipInRegion(bip, region)));
}

// ─── Estados (funciones puras) ───────────────────────────────────────────────
function mopBuildStyleContext() {
    const { selected, hovered } = mopMapState;
    return {
        selected: selected && mopVisibleBips.has(selected) ? selected : null,
        hovered,
        visible: mopVisibleBips
    };
}

// Estilo de un trazado: normal 2.5 px/0.85, hover o seleccionado 4 px/1.0 (un
// grosor intermedio: con 4.5/8 px los planos de detalle, como el del BIP
// 30067364-0, se juntaban en una banda); oculto si no está en la región
// elegida, no pasa los filtros o hay otro proyecto seleccionado.
function mopShapeStyle(bip, ctx) {
    if (!ctx.visible.has(bip)) return { color: MOP_LINE_DEFAULT_COLOR, width: 0, opacity: 0 };
    const color = mopProjectColor(mopProjectByBip(bip));
    if (bip === ctx.selected || bip === ctx.hovered) return { color, width: 4, opacity: 1 };
    return { color, width: 2.5, opacity: 0.85 };
}

// Polígonos: mismo color y estados que los trazados, con relleno translúcido
function mopPolyStyle(bip, ctx) {
    if (!ctx.visible.has(bip)) return { color: MOP_LINE_DEFAULT_COLOR, fillOpacity: 0, width: 0, opacity: 0 };
    const color = mopProjectColor(mopProjectByBip(bip));
    const strong = bip === ctx.selected || bip === ctx.hovered;
    return { color, fillOpacity: strong ? 0.6 : 0.35, width: strong ? 2.5 : 1.5, opacity: 1 };
}

// Mapas con capas de proyectos: el principal y los recuadros de islas ya cargados
function mopShapeViews() {
    return [{ map: mopProjectMap, lineBips: mopLineBips, polyBips: mopPolyBips }, ...MOP_ISLAND_INSETS.filter(i => i.ready)];
}

// Íconos de todos los mapas
function mopAllMarkers() {
    return [...mopPointMarkers, ...MOP_ISLAND_INSETS.flatMap(i => i.markers)];
}

function mopApplyShapeState(bip, ctx) {
    mopShapeViews().forEach(v => {
        if (v.lineBips.has(bip)) v.map.setFeatureState({ source: 'mop-shapes', id: bip }, mopShapeStyle(bip, ctx));
        if (v.polyBips.has(bip)) v.map.setFeatureState({ source: 'mop-polys', id: bip }, mopPolyStyle(bip, ctx));
    });
}

function mopUpdateTopLayer(ctx) {
    mopShapeViews().forEach(v => {
        const top = [ctx.selected, ctx.hovered].filter(b => b && v.lineBips.has(b) && ctx.visible.has(b));
        v.map.setFilter('mop-shapes-top', CatlecMapGL.inFilter('bip', top));
    });
}

// Estilo de una región. Vista del país: coroplético por cantidad de proyectos
// (estándar CatlecChoropleth: borde blanco, opacidad 0,7; hover 0,9 con borde
// azul). Con una región elegida o un proyecto a la vista el mapa base queda sin
// color ni bordes de región: solo un relleno tenue al pasar sobre las demás
// regiones (siguen clickeables).
function mopRegionStyle(code) {
    const { region, hoveredRegion } = mopMapState;
    const isHover = code === hoveredRegion && code !== region;
    if (!mopShowChoropleth()) return { fill: '#64748b', fillOpacity: isHover ? 0.12 : 0, line: '#94a3b8', lineWidth: 0, lineOpacity: 0 };
    const total = (mopRegionStats[code] || {}).total || 0;
    return {
        fill: mopRegionColor(total), fillOpacity: isHover ? 0.9 : 0.7,
        line: isHover ? '#3b82f6' : '#ffffff', lineWidth: isHover ? 2.5 : 1.2, lineOpacity: 1
    };
}

function mopApplyRegionState(code) {
    mopProjectMap.setFeatureState({ source: 'mop-regions', id: code }, mopRegionStyle(code));
}

// Estado DOM de un ícono: escala, z-index y despliegue del cluster
function mopApplyMarkerState(marker, ctx) {
    const elem = marker.getElement();
    const pulse = elem && elem.querySelector('.centroid-marker-pulse');
    if (!pulse) return;

    const isSelected = ctx.selected === marker.bip;
    const isHovered = ctx.hovered === marker.bip;
    const deployed = marker.clusterState && marker.clusterState.isClickedDeployed;

    pulse.classList.toggle('active-selected', isSelected);
    pulse.classList.toggle('is-hovered', isHovered && !isSelected);

    let scale = 1;
    let z = 100;
    if (isSelected) { scale = 1.35; z = 10000; }
    else if (isHovered) { scale = 1.25; z = 9500; }
    else if (deployed) { z = 9000; }

    const dx = deployed ? marker.clusterDx : 0;
    const dy = deployed ? marker.clusterDy : 0;
    pulse.classList.toggle('deployed', !!(deployed && (dx || dy)));
    pulse.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    elem.style.zIndex = String(z);

    const badge = pulse.querySelector('.marker-cluster-badge');
    if (badge) badge.style.display = (ctx.selected || deployed) ? 'none' : 'flex';

    const n = marker.clusterMembers ? marker.clusterMembers.length : 1;
    marker.tooltipHtml = (n > 1 && !deployed) ? `<strong>${n} proyectos en este lugar</strong>` : marker.projectTooltip;
    mopMapTooltip.update('marker:' + marker.bip, marker.tooltipHtml);
}

// ─── Actualización completa (región, selección, filtros, clusters) ───────────
function mopUpdateMapStyles() {
    if (!mopMapReady) return;
    const ctx = mopBuildStyleContext();
    new Set([...mopLineBips, ...mopPolyBips]).forEach(bip => mopApplyShapeState(bip, ctx));
    mopUpdateTopLayer(ctx);
    Object.keys(MOP_REGION_NAMES).forEach(code => mopApplyRegionState(Number(code)));

    mopClusterOrigins.forEach(m => m.remove());
    mopClusterOrigins = [];
    const done = new Set();
    mopAllMarkers().forEach(marker => {
        const cs = marker.clusterState;
        if (cs && cs.isClickedDeployed && marker.clusterMembers.length > 1 && !done.has(cs)) {
            done.add(cs);
            mopClusterOrigins.push(CatlecMapGL.createClusterOrigin(marker.ownerMap, marker.clusterMembers, {
                isDragClick: mopMapIsDragClick,
                onCollapse: () => {
                    cs.isClickedDeployed = false;
                    mopUpdateMapStyles();
                }
            }));
        }
        mopApplyMarkerState(marker, ctx);
    });
}

// Recalcula lo visible, redibuja los íconos y restiliza todo
function mopRefreshVisible() {
    mopVisibleBips = mopComputeVisibleBips();
    mopUpdateGeoCount();
    if (!mopMapReady) return;
    mopPointMarkers = mopRenderPointMarkers(mopMapProjects.filter(p => mopVisibleBips.has(p.bip)), { previous: mopPointMarkers });
    mopRefreshIslandInsets();
    mopUpdateMapStyles();
}

// ─── Hover liviano (tabla y mapa): solo restiliza el anterior y el nuevo ─────
function mopMapSetHover(bip) {
    bip = bip || null;
    const prev = mopMapState.hovered;
    if (prev === bip) return;
    mopMapState.hovered = bip;
    if (!mopMapReady) return;

    const ctx = mopBuildStyleContext();
    [prev, bip].forEach(b => { if (b) mopApplyShapeState(b, ctx); });
    mopUpdateTopLayer(ctx);
    mopAllMarkers().forEach(m => {
        if (m.bip === prev || m.bip === bip) mopApplyMarkerState(m, ctx);
    });
}

function mopSetRegionHover(code) {
    code = code || null;
    const prev = mopMapState.hoveredRegion;
    if (prev === code) return;
    mopMapState.hoveredRegion = code;
    if (!mopMapReady) return;
    [prev, code].forEach(c => { if (c) mopApplyRegionState(c); });
    mopProjectMap.setFilter('mop-regions-hover', ['==', ['to-number', ['get', 'codregion']], code || -1]);
}

// ─── Selección (la llama main.js al elegir una fila o un elemento del mapa) ──
// Con un proyecto seleccionado el mapa muestra solo ese proyecto; al quitar la
// selección vuelve a la región elegida (o al país si no hay región).
function mopMapSelectProject(bip, { fly = true } = {}) {
    bip = bip || null;
    mopUpdateNoGeoOverlay(bip);
    const prev = mopMapState.selected;
    if (prev === bip) return;
    mopMapState.selected = bip;
    mopRefreshVisible();
    if (!mopMapReady || !fly) return;
    if (bip && mopProjectHasGeo(bip)) mopFlyToFeatures(MOP_GEO_INDEX[bip]);
    else if (!bip && prev && mopProjectHasGeo(prev)) mopFlyToRegion(mopMapState.region);
}

// Proyecto seleccionado sin georreferenciación: difumina el mapa y muestra el
// aviso del centro (#mop-map-nogeo en MOP.html, estilos en mop_addons.css)
function mopUpdateNoGeoOverlay(bip) {
    const el = document.getElementById('mop-map-nogeo');
    if (!el) return;
    const show = !!bip && !mopProjectHasGeo(bip);
    el.classList.toggle('is-visible', show);
    el.setAttribute('aria-hidden', String(!show));
    if (show) mopMapTooltip && mopMapTooltip.hide();
}

// Región del mapa según el filtro "Región": exactamente una región con
// polígono; si no (ninguna, varias o "Interregional"), la vista del país.
// Solo cambia el estado (main.js redibuja y vuela); devuelve si cambió.
function mopMapSetRegionFromFilter(regions) {
    const code = regions.length === 1 ? (MOP_REGION_CODES[regions[0]] || null) : null;
    if (code === mopMapState.region) return false;
    mopMapState.region = code;
    return true;
}

function mopFlyToFeatures(features) {
    if (!features || !features.length) return;
    const bounds = CatlecMapGL.boundsOfFeatures(features);
    CatlecUtils.afterNextPaint(() => CatlecMapGL.flyToBounds(mopProjectMap, bounds, {
        onDefaultView: () => mopApplyDefaultMapView(true)
    }));
}

// Encuadre de una región sin sus islas oceánicas (Valparaíso: Juan Fernández e Isla de Pascua)
function mopRegionBounds(code) {
    const feat = ((window.SNI_REGIONS_DATA && window.SNI_REGIONS_DATA.features) || [])
        .find(f => Number(f.properties.codregion) === code);
    if (!feat) return null;
    const g = feat.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const continental = polys.filter(poly => poly[0].some(c => c[0] > MOP_MAP_EXTENT_MIN_LNG));
    return CatlecMapGL.boundsOfFeatures([{ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: continental } }]);
}

function mopFlyToRegion(code) {
    if (!code) {
        mopApplyDefaultMapView(true);
        return;
    }
    const bounds = mopRegionBounds(code);
    if (!bounds) return;
    // Con los recuadros de islas abiertos, la región se encuadra a su derecha
    const insetW = mopIslandControl && mopIslandShown.length ? mopIslandControl.offsetWidth + 20 : 0;
    CatlecUtils.afterNextPaint(() => mopProjectMap.fitBounds(bounds, {
        padding: { top: 30, bottom: 30, right: 30, left: 30 + insetW }, maxZoom: 9 - CatlecMapGL.ZOOM_OFFSET, duration: 900
    }));
}

// ─── Filtros: solo se muestran los proyectos que los cumplen ─────────────────
// projects: los filtrados (tabla); withoutRegion: con todos los filtros salvo el
// de región, para el coroplético y los conteos del tooltip de cada región
function mopMapApplyFilters(projects, withoutRegion = projects) {
    mopMapProjects = projects;
    mopActiveBips = new Set(projects.map(p => p.bip).filter(mopProjectHasGeo));
    mopRegionStats = mopComputeRegionStats(withoutRegion);
    mopRegionBreaks = mopComputeRegionBreaks(Object.values(mopRegionStats).map(s => s.total));
    mopRenderChoroLegend();
    mopRefreshVisible();
}

// Escala del coroplético en la leyenda: un rango por clase con regiones
function mopRenderChoroLegend() {
    const el = document.getElementById('mop-map-choro-legend');
    if (!el) return;
    const fmt = n => n.toLocaleString('es-CL');
    const byClass = {};
    Object.values(mopRegionStats).forEach(s => {
        if (s.total <= 0) return;
        const c = mopRegionClass(s.total);
        const r = byClass[c] = byClass[c] || { min: s.total, max: s.total };
        r.min = Math.min(r.min, s.total);
        r.max = Math.max(r.max, s.total);
    });
    const rows = Object.keys(byClass).map(Number).sort((a, b) => a - b).map(c => {
        const { min, max } = byClass[c];
        return `<div class="mop-maplegend-item"><span class="mop-maplegend-choro" style="background-color: ${MOP_REGION_SCALE[c]};"></span><span>${min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`}</span></div>`;
    });
    if (Object.values(mopRegionStats).some(s => s.total === 0)) {
        rows.push(`<div class="mop-maplegend-item"><span class="mop-maplegend-choro" style="background-color: ${MOP_REGION_EMPTY};"></span><span>Sin proyectos</span></div>`);
    }
    el.innerHTML = `<div class="mop-maplegend-subtitle">Proyectos por región</div>${rows.join('')}`;
}

// Nota de la leyenda según el estado: proyecto seleccionado o cuántos proyectos
// con ubicación tiene la región elegida; en la vista del país, ninguna
function mopUpdateGeoCount() {
    const choro = document.getElementById('mop-map-choro-legend');
    if (choro) choro.hidden = !mopShowChoropleth();
    const el = document.getElementById('mop-map-geo-count');
    if (!el) return;
    const fmt = n => n.toLocaleString('es-CL');
    const { selected, region } = mopMapState;
    let text = '';   // en la vista del país no hay nota (la leyenda muestra el coroplético)
    if (selected && mopProjectHasGeo(selected)) {
        text = 'Mostrando solo el proyecto seleccionado';
    } else if (region) {
        const n = mopVisibleBips.size;
        text = `${MOP_REGION_NAMES[region]}: ${fmt(n)} proyecto${n === 1 ? '' : 's'} con ubicación`;
    }
    el.textContent = text;
    el.hidden = !text;
}

// ─── Inicialización ──────────────────────────────────────────────────────────
function mopInitProjectMap() {
    if (mopProjectMap || !document.getElementById('mop-project-map')) return;

    mopProjectMap = CatlecMapGL.createMap('mop-project-map', { center: MOP_MAP_DEFAULT_CENTER, zoom: MOP_MAP_DEFAULT_ZOOM });
    mopMapTooltip = CatlecMapGL.createTooltip(mopProjectMap);
    mopMapIsDragClick = CatlecMapGL.trackDragClick(mopProjectMap);

    mopProjectMap.on('mousemove', mopOnMapMouseMove);
    mopProjectMap.getCanvas().addEventListener('mouseleave', () => mopSetMapHoverHit(null));
    mopProjectMap.on('click', mopOnMapClick);
    mopProjectMap.on('load', mopLoadMapLayers);

    const resetBtn = document.getElementById('mop-btn-reset-map');
    if (resetBtn) resetBtn.addEventListener('click', mopResetMap);
}

function mopLoadMapLayers() {
    const lineFeatures = [];
    const polyFeatures = [];
    mopLineBips = new Set();
    mopPolyBips = new Set();
    Object.entries(MOP_GEO_INDEX).forEach(([bip, feats]) => {
        feats.forEach(f => {
            if (f.properties.kind === 'line') {
                lineFeatures.push({ type: 'Feature', geometry: f.geometry, properties: { bip } });
                mopLineBips.add(bip);
            } else if (f.properties.kind === 'polygon') {
                polyFeatures.push({ type: 'Feature', geometry: f.geometry, properties: { bip } });
                mopPolyBips.add(bip);
            }
        });
    });

    const before = CatlecMapGL.labelsBeforeId(mopProjectMap);
    const state = (key, fallback) => ['coalesce', ['feature-state', key], fallback];

    // Regiones (bajo los trazados): relleno y borde por feature-state
    mopProjectMap.addSource('mop-regions', {
        type: 'geojson',
        data: window.SNI_REGIONS_DATA || { type: 'FeatureCollection', features: [] },
        promoteId: 'codregion'
    });
    mopProjectMap.addLayer({
        id: 'mop-regions-fill', type: 'fill', source: 'mop-regions',
        paint: { 'fill-color': state('fill', MOP_LINE_DEFAULT_COLOR), 'fill-opacity': state('fillOpacity', 0) }
    }, before);
    mopProjectMap.addLayer({
        id: 'mop-regions-line', type: 'line', source: 'mop-regions', layout: { 'line-join': 'round' },
        paint: { 'line-color': state('line', '#94a3b8'), 'line-width': state('lineWidth', 0.8), 'line-opacity': state('lineOpacity', 0.6) }
    }, before);
    // Borde de la región en hover, en su propia capa encima de las demás: en
    // 'mop-regions-line' los bordes blancos de las regiones vecinas lo tapaban
    mopProjectMap.addLayer({
        id: 'mop-regions-hover', type: 'line', source: 'mop-regions', layout: { 'line-join': 'round' },
        filter: ['==', ['to-number', ['get', 'codregion']], -1],
        paint: { 'line-color': state('line', '#94a3b8'), 'line-width': state('lineWidth', 0.8), 'line-opacity': state('lineOpacity', 0.6) }
    }, before);

    mopAddShapeLayers(mopProjectMap, lineFeatures, polyFeatures);

    mopMapReady = true;
    mopAddMapLegend();
    mopAddIslandInsets();
    mopMapApplyFilters(mopFilteredProjects);

    // Encuadre inicial idéntico al botón Restablecer Mapa (o la región, si se
    // eligió antes de que cargara el mapa)
    if (mopMapState.region) mopFlyToRegion(mopMapState.region);
    else mopApplyDefaultMapView(false);
    if (mopMapState.selected && mopProjectHasGeo(mopMapState.selected)) mopFlyToFeatures(MOP_GEO_INDEX[mopMapState.selected]);
}

// Polígonos y trazados de proyectos (bajo las etiquetas del mapa base), con
// estilo por feature-state; los usan el mapa principal y los recuadros de islas
function mopAddShapeLayers(map, lineFeatures, polyFeatures) {
    const before = CatlecMapGL.labelsBeforeId(map);
    const state = (key, fallback) => ['coalesce', ['feature-state', key], fallback];
    const paint = {
        'line-color': state('color', MOP_LINE_DEFAULT_COLOR),
        'line-width': state('width', 0),
        'line-opacity': state('opacity', 0)
    };
    const roundLine = { 'line-cap': 'round', 'line-join': 'round' };

    // Polígonos de proyectos (bajo los trazados): relleno y borde por feature-state;
    // el relleno sirve también de capa de detección
    map.addSource('mop-polys', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: polyFeatures },
        promoteId: 'bip'
    });
    map.addLayer({
        id: 'mop-polys-fill', type: 'fill', source: 'mop-polys',
        paint: { 'fill-color': state('color', MOP_LINE_DEFAULT_COLOR), 'fill-opacity': state('fillOpacity', 0) }
    }, before);
    map.addLayer({
        id: 'mop-polys-line', type: 'line', source: 'mop-polys', layout: { 'line-join': 'round' },
        paint: { 'line-color': state('color', MOP_LINE_DEFAULT_COLOR), 'line-width': state('width', 0), 'line-opacity': state('opacity', 0) }
    }, before);

    map.addSource('mop-shapes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: lineFeatures },
        promoteId: 'bip'
    });
    map.addLayer({ id: 'mop-shapes-line', type: 'line', source: 'mop-shapes', layout: roundLine, paint }, before);
    map.addLayer({
        id: 'mop-shapes-top', type: 'line', source: 'mop-shapes', layout: roundLine, paint,
        filter: CatlecMapGL.inFilter('bip', [])
    }, before);
    map.addLayer({ id: 'mop-shapes-hit', type: 'line', source: 'mop-shapes', paint: { 'line-width': 12, 'line-opacity': 0 } }, before);
}

// ─── Recuadros de islas oceánicas y Antártica (Valparaíso, Magallanes) ───────
// Los de la región elegida, sin un proyecto a la vista (el seleccionado se
// muestra solo en el mapa principal, que vuela a él)
function mopShownIslandInsets() {
    if (mopShowingProject()) return [];
    return MOP_ISLAND_INSETS.filter(i => i.region === mopMapState.region);
}

// Control de MapLibre pegado a la esquina superior izquierda (mop_addons.css):
// no recibe los eventos del mapa principal y el tooltip del mapa (z-index
// mayor) queda encima de los recuadros
function mopAddIslandInsets() {
    const div = document.createElement('div');
    div.className = 'maplibregl-ctrl mop-island-insets';
    div.innerHTML = MOP_ISLAND_INSETS.map(i => `
        <div class="mop-island-inset">
            <div class="mop-island-inset-title" title="${mopEscapeHtml(i.name)}">${mopEscapeHtml(i.name)}</div>
            <div class="mop-island-inset-map" id="mop-island-${i.id}"></div>
            <div class="mop-island-inset-empty" hidden>Sin proyectos</div>
        </div>`).join('');
    mopProjectMap.addControl({ onAdd: () => div, onRemove: () => div.remove() }, 'top-left');
    MOP_ISLAND_INSETS.forEach(i => {
        i.el = div.querySelector(`#mop-island-${i.id}`);
        i.box = i.el.parentElement;
        i.emptyEl = i.el.nextElementSibling;
    });
    mopIslandControl = div;
}

// La columna emerge desde el borde izquierdo del mapa y se esconde tras él
// (transición de .mop-island-insets.is-open en mop_addons.css). Al pasar de
// una región con recuadros a otra (Valparaíso ↔ Magallanes), primero se
// esconde, cambia de recuadros y vuelve a emerger.
const MOP_ISLAND_ANIM_MS = 380;

// Recuadros de la región elegida (los de la columna, abierta o abriéndose)
function mopRefreshIslandInsets() {
    if (!mopIslandControl) return;
    const shown = mopShownIslandInsets();
    const same = shown.length === mopIslandShown.length && shown.every(i => mopIslandShown.includes(i));
    if (same) {
        mopRenderIslandInsets();
        return;
    }
    mopIslandShown = shown;
    clearTimeout(mopIslandSwapTimer);
    if (mopIslandControl.classList.contains('is-open')) {
        mopSetIslandInsetsOpen(false);
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        mopIslandSwapTimer = setTimeout(mopSwapIslandInsets, reduce ? 0 : MOP_ISLAND_ANIM_MS);
    } else {
        mopSwapIslandInsets();
    }
}

// Abre o cierra la columna; los botones de zoom pasan a su derecha mientras está abierta
function mopSetIslandInsetsOpen(open) {
    mopIslandControl.classList.toggle('is-open', open);
    mopProjectMap.getContainer().classList.toggle('mop-has-island-insets', open);
}

// Deja en la columna solo los recuadros de mopIslandShown (quita los íconos de
// los demás), los dibuja y la abre un cuadro después, para que la transición
// parta desde fuera del mapa
function mopSwapIslandInsets() {
    MOP_ISLAND_INSETS.forEach(inset => {
        inset.box.hidden = !mopIslandShown.includes(inset);
        if (inset.box.hidden && inset.markers.length) {
            inset.markers.forEach(m => m.remove());
            inset.markers = [];
        }
    });
    if (!mopIslandShown.length) return;
    mopRenderIslandInsets();
    mopUpdateMapStyles();
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if (mopIslandShown.length) mopSetIslandInsetsOpen(true);
    }));
}

// Crea los mapas de los recuadros visibles (la primera vez) y redibuja sus
// íconos: los proyectos visibles que caen en cada uno
function mopRenderIslandInsets() {
    mopIslandShown.forEach(inset => {
        if (inset.box.hidden) return;
        if (!inset.map) mopCreateIslandMap(inset);
        else inset.map.resize();
        const visible = mopMapProjects.filter(p => inset.bips.has(p.bip) && mopVisibleBips.has(p.bip));
        inset.emptyEl.hidden = visible.length > 0;
        if (inset.ready) {
            inset.markers = mopRenderPointMarkers(visible, { map: inset.map, previous: inset.markers, area: inset.area, keepOrigins: true });
        }
    });
}

function mopCreateIslandMap(inset) {
    inset.map = CatlecMapGL.createStaticMap(inset.el, { bounds: inset.view, attribution: false, events: true });
    inset.map.on('load', () => {
        const lines = [];
        const polys = [];
        inset.features.forEach(f => {
            const bip = String(f.properties.bip);
            if (f.properties.kind === 'line') {
                lines.push({ type: 'Feature', geometry: f.geometry, properties: { bip } });
                inset.lineBips.add(bip);
            } else if (f.properties.kind === 'polygon') {
                polys.push({ type: 'Feature', geometry: f.geometry, properties: { bip } });
                inset.polyBips.add(bip);
            }
        });
        mopAddShapeLayers(inset.map, lines, polys);
        inset.ready = true;
        mopRefreshVisible();
    });
    inset.map.on('mousemove', e => mopOnIslandMouseMove(inset, e));
    inset.map.getCanvas().addEventListener('mouseleave', () => mopOnIslandMouseMove(inset, null));
    inset.map.on('click', e => mopOnIslandClick(inset, e));
}

// Trazado o polígono visible bajo el cursor en un recuadro
function mopIslandPick(inset, point) {
    if (!inset.ready) return null;
    const f = inset.map.queryRenderedFeatures(point, { layers: MOP_MAP_HOVER_LAYERS })
        .find(ft => mopVisibleBips.has(ft.properties.bip));
    return f ? f.properties.bip : null;
}

// Hover en un recuadro: mismo estado y tooltip que el mapa principal (el tooltip
// vive en el contenedor del mapa principal, que contiene a los recuadros)
function mopOnIslandMouseMove(inset, e) {
    if (e && CatlecMapGL.isMarkerEvent(e)) return;
    const bip = e ? mopIslandPick(inset, e.point) : null;
    const p = bip && mopProjectByBip(bip);
    inset.map.getCanvas().style.cursor = p ? 'pointer' : '';
    const owner = 'island:' + inset.id;
    if (p) {
        mopMapSetHover(bip);
        mopMapTooltip.show(owner, mopProjectTooltipHtml(p), mopMapTooltip.pointFromEvent(e.originalEvent));
    } else if (mopMapTooltip.owner === owner) {
        mopMapSetHover(null);
        mopMapTooltip.hide();
    }
}

function mopOnIslandClick(inset, e) {
    if (CatlecMapGL.isMarkerEvent(e)) return;
    const bip = mopIslandPick(inset, e.point);
    mopMapTooltip.hide();
    if (bip) {
        mopSelectProject(bip, { fromMap: true });
        return;
    }
    // Clic en el fondo del recuadro: repliega sus clusters
    inset.markers.forEach(m => { if (m.clusterState) m.clusterState.isClickedDeployed = false; });
    mopUpdateMapStyles();
}

// ─── Íconos de proyectos puntuales (marcadores HTML) ─────────────────────────
// Dibuja los íconos de `projects` en `map` (el principal o un recuadro de isla,
// solo los puntos dentro de `area`) y devuelve los marcadores; quita `previous`.
function mopRenderPointMarkers(projects, { map = mopProjectMap, previous = [], area = null, keepOrigins = false } = {}) {
    previous.forEach(m => m.remove());
    if (!keepOrigins) {
        mopClusterOrigins.forEach(m => m.remove());
        mopClusterOrigins = [];
    }
    const markers = [];

    const items = [];
    projects.forEach(p => {
        (MOP_GEO_INDEX[p.bip] || []).forEach(f => {
            if (f.properties.kind !== 'point') return;
            const coords = f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates;
            coords.forEach(c => { if (!area || mopInArea(c, area)) items.push({ p, lngLat: c }); });
        });
    });

    // Agrupar por proximidad (~80 m), como EFE
    const clusters = [];
    items.forEach(item => {
        const c = clusters.find(cl =>
            Math.abs(cl[0].lngLat[1] - item.lngLat[1]) < 0.0008 && Math.abs(cl[0].lngLat[0] - item.lngLat[0]) < 0.0008
        );
        if (c) c.push(item); else clusters.push([item]);
    });

    clusters.forEach(cluster => {
        const n = cluster.length;
        const R = 22;
        const clusterState = { isClickedDeployed: false };
        const members = cluster.map((item, k) => {
            const marker = mopCreatePointMarker(item.p, item.lngLat, n);
            marker.ownerMap = map;
            marker.clusterState = clusterState;
            const angle = (2 * Math.PI * k) / n - Math.PI / 2;
            marker.clusterDx = n > 1 ? Math.round(R * Math.cos(angle)) : 0;
            marker.clusterDy = n > 1 ? Math.round(R * Math.sin(angle)) : 0;
            markers.push(marker);
            return marker;
        });

        members.forEach(m => {
            m.clusterMembers = members;
            const el = m.getElement();
            const owner = 'marker:' + m.bip;
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (mopMapIsDragClick()) return;
                if (n > 1 && !clusterState.isClickedDeployed) {
                    // Primer clic en un cluster: desplegar los íconos
                    clusterState.isClickedDeployed = true;
                    mopUpdateMapStyles();
                } else {
                    mopMapTooltip.hide();
                    mopSelectProject(m.bip, { fromMap: true });
                }
            });
            el.addEventListener('mouseenter', (e) => {
                mopSetRegionHover(null);
                mopMapSetHover(m.bip);
                mopMapTooltip.show(owner, m.tooltipHtml, mopMapTooltip.pointFromEvent(e));
            });
            el.addEventListener('mousemove', (e) => {
                mopMapTooltip.show(owner, m.tooltipHtml, mopMapTooltip.pointFromEvent(e));
            });
            el.addEventListener('mouseleave', () => {
                mopMapSetHover(null);
                if (mopMapTooltip.owner === owner) mopMapTooltip.hide();
            });
            m.addTo(map);
        });
    });
    return markers;
}

function mopCreatePointMarker(p, lngLat, clusterCount) {
    const badge = clusterCount > 1 ? `<span class="marker-cluster-badge">${clusterCount}</span>` : '';
    const el = document.createElement('div');
    el.className = 'polygon-centroid-marker catlec-gl-marker mop-point-marker';
    el.innerHTML = `<div class="centroid-marker-pulse" style="background-color: ${mopProjectColor(p)};">${badge}</div>`;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center', subpixelPositioning: true }).setLngLat(lngLat);
    marker.bip = p.bip;
    marker.projectTooltip = mopProjectTooltipHtml(p);
    marker.tooltipHtml = marker.projectTooltip;
    return marker;
}

function mopProjectTooltipHtml(p) {
    return `<strong>${mopEscapeHtml(p.nombre)}</strong><br>`
        + `<span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">${mopEscapeHtml(mopShortServicio(p.servicio))} · ${mopEscapeHtml(p.etapa || 'Sin etapa')}</span><br>`
        + `<span style="color:#94a3b8;font-size:0.68rem;">${mopEscapeHtml(p.region || '')} · BIP ${mopEscapeHtml(p.bip)}</span>`
        + (mopProjectGeoIsAerodromo(p.bip)
            ? '<br><span style="color:#fbbf24;font-size:0.66rem;">Ubicación del aeródromo (referencial)</span>'
            : '');
}

function mopRegionTooltipHtml(code) {
    const { total = 0, geo = 0 } = mopRegionStats[code] || {};
    const fmt = n => n.toLocaleString('es-CL');
    return `<strong>${mopEscapeHtml(MOP_REGION_NAMES[code] || 'Región')}</strong><br>`
        + `<span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">${fmt(total)} proyecto${total === 1 ? '' : 's'} · ${fmt(geo)} con ubicación</span><br>`
        + '<span style="color:#94a3b8;font-size:0.68rem;">Clic para filtrar por esta región</span>';
}

// ─── Eventos del mapa (capas WebGL) ──────────────────────────────────────────
// Lo que hay bajo el cursor: primero un trazado o polígono visible (los ocultos
// siguen en las capas de detección con ancho/opacidad 0, así que se descartan
// aquí) y si no, la región
function mopPickAt(point) {
    if (!mopMapReady) return null;
    const shape = mopProjectMap.queryRenderedFeatures(point, { layers: MOP_MAP_HOVER_LAYERS })
        .find(f => mopVisibleBips.has(f.properties.bip));
    if (shape) return { kind: 'shape', bip: shape.properties.bip };
    const region = mopProjectMap.queryRenderedFeatures(point, { layers: ['mop-regions-fill'] })[0];
    if (region) return { kind: 'region', code: Number(region.properties.codregion) };
    return null;
}

function mopOnMapMouseMove(e) {
    if (mopMapTooltip.moving || CatlecMapGL.isMarkerEvent(e)) return;
    mopSetMapHoverHit(mopPickAt(e.point), e.point);
}

function mopSetMapHoverHit(hit, point) {
    // La región ya elegida, y todas mientras se muestra un proyecto seleccionado,
    // no tienen hover, tooltip ni cursor de clic: son el fondo del mapa
    if (hit && hit.kind === 'region' && (hit.code === mopMapState.region || mopShowingProject())) hit = null;
    const key = hit ?(hit.kind === 'shape' ? 'shape:' + hit.bip : 'region:' + hit.code) : null;
    if (key !== mopMapHoverKey) {
        mopMapHoverKey = key;
        mopMapSetHover(hit && hit.kind === 'shape' ? hit.bip : null);
        mopSetRegionHover(hit && hit.kind === 'region' ? hit.code : null);
        mopProjectMap.getCanvas().style.cursor = hit ? 'pointer' : '';
    }
    let html = null;
    if (hit && hit.kind === 'shape') {
        const p = mopProjectByBip(hit.bip);
        if (p) html = mopProjectTooltipHtml(p);
    } else if (hit && hit.kind === 'region') {
        html = mopRegionTooltipHtml(hit.code);
    }
    if (html && point) mopMapTooltip.show(key, html, point);
    else if (mopMapTooltip.owner && !String(mopMapTooltip.owner).startsWith('marker:')) mopMapTooltip.hide();
}

// Proyecto seleccionado a la vista (con ubicación): el mapa muestra solo ese proyecto
function mopShowingProject() {
    return !!(mopMapState.selected && mopProjectHasGeo(mopMapState.selected));
}

// Clic: trazado → selecciona el proyecto; región → filtra por ella (y quita la
// selección); fuera de las regiones → quita la selección o, sin selección,
// quita el filtro de región y vuelve a la vista del país. Con un proyecto a la
// vista las regiones son fondo: el clic en ellas solo quita la selección.
function mopOnMapClick(e) {
    if (CatlecMapGL.isMarkerEvent(e)) return;
    let hit = mopPickAt(e.point);
    if (hit && hit.kind === 'region' && mopShowingProject()) hit = null;
    mopMapTooltip.hide();
    mopAllMarkers().forEach(m => { if (m.clusterState) m.clusterState.isClickedDeployed = false; });

    if (hit && hit.kind === 'shape') {
        mopSelectProject(hit.bip, { fromMap: true });
        return;
    }
    if (hit && hit.kind === 'region') {
        // Si el proyecto seleccionado es de otra región, el filtro ya lo deselecciona
        if (hit.code !== mopMapState.region) mopSetRegionFilter(MOP_REGION_NAMES[hit.code]);
        if (mopSelectedBip) mopSelectProject(null);
        else mopUpdateMapStyles();
        return;
    }
    mopMapState.hovered = null;
    if (mopSelectedBip) mopSelectProject(null);
    else if (mopMapState.region) mopSetRegionFilter(null);
    else mopUpdateMapStyles();
}

// ─── Encuadres ───────────────────────────────────────────────────────────────
function mopApplyDefaultMapView(animate = false) {
    if (!mopProjectMap) return;
    mopProjectMap.fitBounds(MOP_CHILE_CONTINENTAL_BOUNDS, { padding: 20, duration: animate ? 450 : 0 });
}

// Restablecer Mapa: sin proyecto ni filtro de región, vista del país
function mopResetMap() {
    mopMapState.hovered = null;
    if (mopSelectedBip) mopSelectProject(null, { fly: false });
    if (mopFilters.regions.length) mopSetRegionFilter(null);
    mopApplyDefaultMapView(true);
}

// ─── Leyenda (control de MapLibre, abajo a la izquierda) ─────────────────────
function mopAddMapLegend() {
    const services = Object.entries(MOP_SERVICIO_COLORS).map(([name, color]) => `
        <div class="mop-maplegend-item">
            <span class="mop-maplegend-line" style="background-color: ${color};"></span>
            <span>${mopEscapeHtml(MOP_SERVICIO_LABELS[name] || mopShortServicio(name))}</span>
        </div>`).join('');

    CatlecMapGL.addLegendControl(mopProjectMap, {
        html: `
            <div class="catlec-map-legend-title">Leyenda</div>
            ${services}
            <div class="mop-maplegend-item">
                <span class="mop-maplegend-line" style="background-color: ${MOP_OTROS_COLOR};"></span>
                <span>Otros servicios</span>
            </div>
            ${mopPolyBips.size ? `<div class="mop-maplegend-sep"></div>
            <div class="mop-maplegend-item">
                <span class="mop-maplegend-poly"></span>
                <span>Área de obra</span>
            </div>` : ''}
            <div class="mop-maplegend-sep"></div>
            <div id="mop-map-choro-legend"></div>
            <div class="mop-maplegend-note" id="mop-map-geo-count"></div>`,
        storageKey: 'catlec.mop.legendCollapsed',
        // En celular parte plegada: desplegada tapa los recuadros de islas y casi todo el mapa
        collapsedByDefault: window.matchMedia('(max-width: 600px)').matches
    });
    mopRenderChoroLegend();
    mopUpdateGeoCount();
}
