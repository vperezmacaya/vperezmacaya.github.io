// ─── static/js/DGC/map.js ──────────────────────────────────────────────────────
// Mapa de DGC con MapLibre GL (WebGL). Las utilidades comunes (mapa base,
// vuelos, geometría) vienen de CatlecMapGL (common/map-gl.js).
//
// - Líneas y polígonos de concesiones en una fuente GeoJSON; los polígonos se
//   dibujan como relleno + borde. El estilo de cada shape vive en feature-state
//   (por COD) y se calcula con getFeatureStyle. Lo seleccionado o en hover se
//   dibuja en capas superiores filtradas.
// - Los puntos no se dibujan: solo ubican íconos y definen encuadres.
// - Íconos de proyecto = marcadores HTML de MapLibre (.polygon-centroid-marker).
// - DGC no tiene tooltips en el mapa.

// Vista inicial (zoom Leaflet 4 → MapLibre 3; ver CatlecMapGL.ZOOM_OFFSET)
const DGC_DEFAULT_CENTER = [-71.5430, -37.6751];
const DGC_DEFAULT_ZOOM = 4 - CatlecMapGL.ZOOM_OFFSET;

// Capas invisibles usadas para detectar hover/click sobre las shapes
const DGC_HIT_LAYERS = ['dgc-lines-hit', 'dgc-fill-hit'];

let dgcMapReady = false;
let dgcShapeCods = new Set();       // CODs con líneas o polígonos en la fuente 'dgc-shapes'
let dgcIsDragClick = () => false;   // click que el navegador dispara al soltar un arrastre
let dgcMapHoverCode = null;         // proyecto en hover desde una shape del mapa

// (Nombre heredado de Leaflet: lo llama DGC/ui.js)
function initLeafletMap() {
    leafletMap = CatlecMapGL.createMap('leaflet-map', {
        center: DGC_DEFAULT_CENTER,
        zoom: DGC_DEFAULT_ZOOM,
        minZoom: 3 - CatlecMapGL.ZOOM_OFFSET,
        maxZoom: 18 - CatlecMapGL.ZOOM_OFFSET
    });
    dgcIsDragClick = CatlecMapGL.trackDragClick(leafletMap);

    leafletMap.on('mousemove', dgcOnMapMouseMove);
    leafletMap.getCanvas().addEventListener('mouseleave', () => dgcSetMapHover(null));
    leafletMap.on('click', dgcOnMapClick);
    leafletMap.on('load', loadMapLayers);
}

function getFeatureStyle(feature, sector) {
    const code = feature.properties && feature.properties.COD ? feature.properties.COD.toString().trim() : '';
    const projCodesSet = shapeToProjectCodes[code];
    let isActive = false;
    let activeProj = null;

    if (projCodesSet) {
        const activeCodesList = Array.from(projCodesSet).filter(pc => activeMapCodes.has(pc));
        if (activeCodesList.length > 0) {
            isActive = true;
            activeCodesList.sort((a, b) => {
                const dateA = (projectMetadata[a] && projectMetadata[a].tender_date) || '';
                const dateB = (projectMetadata[b] && projectMetadata[b].tender_date) || '';
                if (dateA && !dateB) return -1;
                if (!dateA && dateB) return 1;
                return dateB.localeCompare(dateA);
            });
            activeProj = projectMetadata[activeCodesList[0]];
        }
    }

    if (!isActive) {
        return {
            color: 'transparent',
            weight: 0,
            opacity: 0,
            fillColor: 'transparent',
            fillOpacity: 0
        };
    }

    const actualSector = (activeProj && activeProj.sector) ? activeProj.sector : (sector || (feature.properties && feature.properties.Sector_DGC) || 'Diversos');

    const selectedCode = appState.selectedProjectCode;
    const hoveredCode = appState.hoveredProjectCode;

    const selectedProj = selectedCode ? projectMetadata[selectedCode] : null;
    const selectedShapes = (selectedProj && selectedProj.shapes) ? selectedProj.shapes.map(s => s.toString().trim()) : [];
    const isSelected = selectedCode && selectedShapes.includes(code);

    const hoveredProj = hoveredCode ? projectMetadata[hoveredCode] : null;
    const hoveredShapes = (hoveredProj && hoveredProj.shapes) ? hoveredProj.shapes.map(s => s.toString().trim()) : [];
    const isHovered = hoveredCode && hoveredShapes.includes(code);

    const secCfg = getSectorConfig(actualSector);
    const color = secCfg.color;

    const isLineGeom = feature.geometry && feature.geometry.type && feature.geometry.type.toLowerCase().includes('line');

    let opacity = 0.85;
    let fillOpacity = isLineGeom ? 0 : 0.45;
    let weight = isLineGeom ? 4.5 : 2.2;

    if (isSelected || isHovered) {
        opacity = 1.0;
        fillOpacity = isLineGeom ? 0 : 0.8;
        weight = isLineGeom ? 8.0 : 4.0;
    } else if (selectedCode !== null) {
        opacity = 0.20;
        fillOpacity = isLineGeom ? 0 : 0.05;
        weight = isLineGeom ? 1.5 : 1.0;
    }

    return {
        color: color,
        weight: weight,
        opacity: opacity,
        fillColor: color,
        fillOpacity: fillOpacity
    };
}

// ─── Utilidades de shapes ────────────────────────────────────────────────────
function dgcFeatureCod(feature) {
    return feature && feature.properties && feature.properties.COD ? feature.properties.COD.toString().trim() : '';
}

function dgcGeomType(feature) {
    return String((feature && feature.geometry && feature.geometry.type) || '').toLowerCase();
}

function dgcFeaturesOfShapes(shapes) {
    const out = [];
    (shapes || []).forEach(shapeId => (shapeGeometries[shapeId.toString().trim()] || []).forEach(f => out.push(f)));
    return out;
}

// Proyecto activo (según filtros) que representa a una shape: el de licitación
// más reciente, como en el estilo y en los íconos
function dgcActiveProjectForShape(code) {
    const projSet = shapeToProjectCodes[code];
    if (!projSet || projSet.size === 0) return null;
    const activeCodesList = Array.from(projSet).filter(pc => activeMapCodes.has(pc));
    if (activeCodesList.length === 0) return null;

    activeCodesList.sort((a, b) => {
        const dateA = (projectMetadata[a] && projectMetadata[a].tender_date) || '';
        const dateB = (projectMetadata[b] && projectMetadata[b].tender_date) || '';
        if (dateA && !dateB) return -1;
        if (!dateA && dateB) return 1;
        return dateB.localeCompare(dateA);
    });
    return activeCodesList[0];
}

// Custom Principal Shapes mapping for multi-point concessions
const PRINCIPAL_SHAPES = {
    '050_ETTT1': '71' // Alameda - Exposición (Santiago/Estación Central)
};

function loadMapLayers() {
    shapeGeometries = {};
    dgcShapeCods = new Set();

    // Índice COD → features (todas) y fuente solo con líneas y polígonos.
    // promoteId 'cod': todas las features de un mismo COD comparten feature-state.
    const dataDGC = window.DGC_DATA || { type: 'FeatureCollection', features: [] };
    const sourceFeatures = [];
    dataDGC.features.forEach(feature => {
        const cod = dgcFeatureCod(feature);
        if (!cod || !feature.geometry) return;
        if (!shapeGeometries[cod]) shapeGeometries[cod] = [];
        shapeGeometries[cod].push(feature);

        const type = dgcGeomType(feature);
        if (type.includes('point')) return;
        sourceFeatures.push({
            type: 'Feature',
            geometry: feature.geometry,
            properties: { cod, kind: type.includes('line') ? 'line' : 'poly' }
        });
        dgcShapeCods.add(cod);
    });

    const before = CatlecMapGL.labelsBeforeId(leafletMap);
    const state = (key, fallback) => ['coalesce', ['feature-state', key], fallback];
    const isPoly = ['==', ['get', 'kind'], 'poly'];
    const isLine = ['==', ['get', 'kind'], 'line'];
    const roundLine = { 'line-cap': 'round', 'line-join': 'round' };
    const fillPaint = { 'fill-color': state('color', '#000000'), 'fill-opacity': state('fillOpacity', 0) };
    const outlinePaint = { 'line-color': state('color', '#000000'), 'line-width': state('polyWidth', 0), 'line-opacity': state('opacity', 0) };
    const linePaint = { 'line-color': state('color', '#000000'), 'line-width': state('lineWidth', 0), 'line-opacity': state('opacity', 0) };
    const noCods = CatlecMapGL.inFilter('cod', []);

    leafletMap.addSource('dgc-shapes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: sourceFeatures },
        promoteId: 'cod'
    });

    // Base: polígonos (relleno + borde) debajo de las líneas
    leafletMap.addLayer({ id: 'dgc-fill', type: 'fill', source: 'dgc-shapes', filter: isPoly, paint: fillPaint }, before);
    leafletMap.addLayer({ id: 'dgc-outline', type: 'line', source: 'dgc-shapes', filter: isPoly, layout: roundLine, paint: outlinePaint }, before);
    leafletMap.addLayer({ id: 'dgc-lines', type: 'line', source: 'dgc-shapes', filter: isLine, layout: roundLine, paint: linePaint }, before);

    // Superiores: lo seleccionado o en hover encima del resto (reemplaza a bringToFront)
    leafletMap.addLayer({ id: 'dgc-fill-top', type: 'fill', source: 'dgc-shapes', filter: ['all', isPoly, noCods], paint: fillPaint }, before);
    leafletMap.addLayer({ id: 'dgc-outline-top', type: 'line', source: 'dgc-shapes', filter: ['all', isPoly, noCods], layout: roundLine, paint: outlinePaint }, before);
    leafletMap.addLayer({ id: 'dgc-lines-top', type: 'line', source: 'dgc-shapes', filter: ['all', isLine, noCods], layout: roundLine, paint: linePaint }, before);

    // Detección invisible: relleno de polígonos y líneas anchas
    leafletMap.addLayer({ id: 'dgc-fill-hit', type: 'fill', source: 'dgc-shapes', filter: isPoly, paint: { 'fill-color': '#000000', 'fill-opacity': 0 } }, before);
    leafletMap.addLayer({ id: 'dgc-lines-hit', type: 'line', source: 'dgc-shapes', filter: isLine, paint: { 'line-width': 12, 'line-opacity': 0 } }, before);

    dgcMapReady = true;

    const legendEl = document.getElementById('map-legend');
    if (legendEl) {
        CatlecMapGL.addLegendControl(leafletMap, { element: legendEl, storageKey: 'catlec.dgc.legendCollapsed' });
    }

    updateMapStyles();
    if (appState.lastMapProjects && appState.lastMapProjects.length > 0) {
        renderProjectMarkersOnMap(appState.lastMapProjects);
    }
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
// Estado de un COD: estilo de sus líneas y de sus polígonos (pueden coexistir)
function dgcApplyShapeState(code) {
    if (!dgcShapeCods.has(code)) return;
    const feats = shapeGeometries[code] || [];
    const lineFeat = feats.find(f => dgcGeomType(f).includes('line'));
    const polyFeat = feats.find(f => dgcGeomType(f).includes('polygon'));
    const lineStyle = lineFeat ? getFeatureStyle(lineFeat, lineFeat.properties.Sector_DGC) : null;
    const polyStyle = polyFeat ? getFeatureStyle(polyFeat, polyFeat.properties.Sector_DGC) : null;
    const base = lineStyle || polyStyle;
    leafletMap.setFeatureState({ source: 'dgc-shapes', id: code }, {
        color: base.color,
        opacity: base.opacity,
        lineWidth: lineStyle ? lineStyle.weight : 0,
        polyWidth: polyStyle ? polyStyle.weight : 0,
        fillOpacity: polyStyle ? polyStyle.fillOpacity : 0
    });
}

// Capas superiores: shapes del proyecto seleccionado y del proyecto en hover
function dgcUpdateTopLayers() {
    const top = new Set();
    [appState.selectedProjectCode, appState.hoveredProjectCode].forEach(pc => {
        const proj = pc ? projectMetadata[pc] : null;
        (proj && proj.shapes ? proj.shapes : []).forEach(s => top.add(s.toString().trim()));
    });
    const inTop = CatlecMapGL.inFilter('cod', top);
    leafletMap.setFilter('dgc-fill-top', ['all', ['==', ['get', 'kind'], 'poly'], inTop]);
    leafletMap.setFilter('dgc-outline-top', ['all', ['==', ['get', 'kind'], 'poly'], inTop]);
    leafletMap.setFilter('dgc-lines-top', ['all', ['==', ['get', 'kind'], 'line'], inTop]);
}

function getProjectCentroid(proj) {
    if (!proj || !proj.shapes || !Array.isArray(proj.shapes) || proj.shapes.length === 0) {
        return null;
    }
    let totalLat = 0;
    let totalLng = 0;
    let count = 0;

    dgcFeaturesOfShapes(proj.shapes).forEach(f => {
        const center = dgcGeomType(f) === 'point' ? f.geometry.coordinates : CatlecMapGL.boundsCenter(f);
        if (center) {
            totalLng += center[0];
            totalLat += center[1];
            count++;
        }
    });

    return count > 0 ? [totalLng / count, totalLat / count] : null;
}

function clearAllProjectMarkers() {
    const unique = new Set();
    Object.values(projectMarkersMap).forEach(arr => [].concat(arr).forEach(m => m && unique.add(m)));
    unique.forEach(m => m.remove());
    projectMarkersMap = {};
}

function createSingleProjectMarker(proj, lngLat, isMiniDot = false) {
    const secCfg = getSectorConfig(proj.sector);
    const isSelected = proj.code === appState.selectedProjectCode;

    const el = document.createElement('div');
    el.className = 'polygon-centroid-marker catlec-gl-marker';
    el.innerHTML = isMiniDot
        ? `<div class="centroid-marker-pulse mini-dot-marker ${isSelected ? 'active-selected' : ''}" style="background-color: ${secCfg.color}; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #ffffff; box-shadow: 0 0 4px rgba(0,0,0,0.4); margin: 7px;"></div>`
        : `<div class="centroid-marker-pulse ${isSelected ? 'active-selected' : ''}" style="background-color: ${secCfg.color};">${secCfg.svg}</div>`;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center', subpixelPositioning: true }).setLngLat(lngLat);
    marker.projectCode = proj.code;
    marker.projectSector = proj.sector;
    marker.isMiniDot = isMiniDot;

    el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dgcIsDragClick()) return;
        zoomToProjectCode(proj.code);
    });
    el.addEventListener('mouseenter', () => setHoveredProject(proj.code));
    el.addEventListener('mouseleave', () => setHoveredProject(null));

    return marker;
}

function renderProjectMarkersOnMap(mapProjects) {
    if (!leafletMap) return;

    clearAllProjectMarkers();

    if (!dgcMapReady || !mapProjects || mapProjects.length === 0) return;

    let candidateEntries = [];

    mapProjects.forEach(proj => {
        if (!proj.shapes || !Array.isArray(proj.shapes) || proj.shapes.length === 0) return;

        const matched = dgcFeaturesOfShapes(proj.shapes);
        if (matched.length === 0) return;

        // Check if concession is LINE type
        const isLine = matched.some(f => dgcGeomType(f).includes('line'));

        if (isLine) {
            // Condition 1: Single icon on the midpoint of the line
            const midpoint = CatlecMapGL.lineMidpoint(matched.filter(f => !dgcGeomType(f).includes('point')));
            if (midpoint) {
                candidateEntries.push({ lngLat: midpoint, proj: proj, shapeId: 'line', isMiniDot: false });
            }
        } else {
            // Condition 2: Point / Polygon -> 1 icon per EACH shape/polygon/point
            const isManyPoints = proj.shapes.length > 5;
            const principalShape = PRINCIPAL_SHAPES[proj.code] || (proj.shapes[0] ? proj.shapes[0].toString().trim() : '');

            proj.shapes.forEach(shapeId => {
                const sid = shapeId.toString().trim();
                (shapeGeometries[sid] || []).forEach(f => {
                    const center = dgcGeomType(f) === 'point' ? f.geometry.coordinates : CatlecMapGL.boundsCenter(f);
                    if (center) {
                        candidateEntries.push({
                            lngLat: center,
                            proj: proj,
                            shapeId: sid,
                            isMiniDot: isManyPoints && (sid !== principalShape)
                        });
                    }
                });
            });
        }
    });

    // Group candidate entries by location key. Pick ONLY the entry with most recent tender_date.
    const locationMap = {};
    candidateEntries.forEach(entry => {
        const key = `${entry.lngLat[1].toFixed(4)},${entry.lngLat[0].toFixed(4)}`;
        if (!locationMap[key]) locationMap[key] = [];
        locationMap[key].push(entry);
    });

    Object.keys(locationMap).forEach(groupKey => {
        const group = locationMap[groupKey];

        // Sort by tender_date descending (most recent first)
        group.sort((a, b) => {
            const dateA = a.proj.tender_date || '';
            const dateB = b.proj.tender_date || '';
            if (dateA && !dateB) return -1;
            if (!dateA && dateB) return 1;
            return dateB.localeCompare(dateA);
        });

        // Render ONLY the most recent concession marker, but associate with all shared project codes
        const bestEntry = group[0];
        const marker = createSingleProjectMarker(bestEntry.proj, bestEntry.lngLat, bestEntry.isMiniDot);
        marker.addTo(leafletMap);
        marker.associatedProjectCodes = group.map(g => g.proj.code);

        group.forEach(entry => {
            const code = entry.proj.code;
            if (!projectMarkersMap[code]) projectMarkersMap[code] = [];
            if (!projectMarkersMap[code].includes(marker)) projectMarkersMap[code].push(marker);
        });
    });

    updateMapStyles();
}

function updateMapStyles() {
    if (dgcMapReady) {
        dgcShapeCods.forEach(dgcApplyShapeState);
        dgcUpdateTopLayers();
    }

    // Collect all unique marker instances
    const allUniqueMarkers = new Set();
    Object.values(projectMarkersMap).forEach(arr => {
        const list = Array.isArray(arr) ? arr : [arr];
        list.forEach(m => {
            if (m) allUniqueMarkers.add(m);
        });
    });

    allUniqueMarkers.forEach(applyProjectMarkerState);

    if (mapStatsBadge) {
        mapStatsBadge.textContent = `${activeMapCodes.size} contratos (${allUniqueMarkers.size} íconos)`;
    }
}

// Estilo de un ícono de proyecto según filtro, selección y hover actuales
function applyProjectMarkerState(marker) {
    if (!marker || !marker.getElement()) return;
    const elem = marker.getElement();

    const selectedCode = appState.selectedProjectCode;
    const hoveredCode = appState.hoveredProjectCode;
    const codes = marker.associatedProjectCodes || [marker.projectCode];
    const isActiveInFilter = codes.some(c => activeMapCodes.has(c));
    const isSelected = codes.includes(selectedCode);
    const isHovered = codes.includes(hoveredCode);

    // Opacidad con marker.setOpacity: MapLibre reescribe style.opacity del
    // elemento en cada movimiento del mapa, así que un valor inline se perdería.
    if (!isActiveInFilter) {
        marker.setOpacity('0');
        elem.style.zIndex = '0';
        elem.style.pointerEvents = 'none';
        return;
    }

    elem.style.pointerEvents = 'auto';

    if (selectedCode) {
        const isTarget = isSelected || isHovered;
        marker.setOpacity(isTarget ? '1' : '0.35');
        elem.style.zIndex = isTarget ? '1000' : '100';
    } else {
        marker.setOpacity('1');
        elem.style.zIndex = '100';
    }

    const el = elem.querySelector('.centroid-marker-pulse');

    if (el) {
        const secCfg = getSectorConfig(marker.projectSector);
        if (isSelected) {
            el.classList.add('active-selected');
            el.style.transform = marker.isMiniDot ? 'scale(2.2)' : 'scale(1.35)';
            if (marker.isMiniDot) el.style.boxShadow = `0 0 8px ${secCfg.color}`;
        } else if (isHovered) {
            el.classList.remove('active-selected');
            el.style.transform = marker.isMiniDot ? 'scale(1.8)' : 'scale(1.25)';
            if (marker.isMiniDot) el.style.boxShadow = `0 0 6px ${secCfg.color}`;
        } else {
            el.classList.remove('active-selected');
            el.style.transform = '';
            if (marker.isMiniDot) el.style.boxShadow = '';
        }
    }
}

// ─── Hover liviano (mapa y tabla) ────────────────────────────────────────────
// Cambia el proyecto en hover y reestiliza SOLO las shapes e íconos del hover
// anterior y del nuevo (no recalcula todo el mapa).
function setHoveredProject(code) {
    const prev = appState.hoveredProjectCode;
    if (prev === code) return;
    appState.hoveredProjectCode = code;
    if (!leafletMap) return;

    const affectedCodes = [prev, code].filter(Boolean);
    affectedCodes.forEach(pc => {
        const proj = projectMetadata[pc];
        if (dgcMapReady) (proj && proj.shapes ? proj.shapes : []).forEach(s => dgcApplyShapeState(s.toString().trim()));
        (projectMarkersMap[pc] || []).forEach(applyProjectMarkerState);
    });
    if (dgcMapReady) dgcUpdateTopLayers();
}
window.setHoveredProject = setHoveredProject;

// ─── Eventos del mapa (shapes) ───────────────────────────────────────────────
// Proyecto activo bajo el cursor (las shapes filtradas siguen en las capas de
// detección, así que se descartan aquí)
function dgcPickProjectAt(point) {
    if (!dgcMapReady) return null;
    const feats = leafletMap.queryRenderedFeatures(point, { layers: DGC_HIT_LAYERS });
    for (const f of feats) {
        const code = dgcActiveProjectForShape(f.properties.cod);
        if (code) return code;
    }
    return null;
}

function dgcOnMapMouseMove(e) {
    if (CatlecMapGL.isMarkerEvent(e)) return;
    dgcSetMapHover(dgcPickProjectAt(e.point));
}

function dgcSetMapHover(code) {
    if (code === dgcMapHoverCode) return;
    const prev = dgcMapHoverCode;
    dgcMapHoverCode = code;
    if (code) setHoveredProject(code);
    else if (prev && appState.hoveredProjectCode === prev) setHoveredProject(null);
    leafletMap.getCanvas().style.cursor = code ? 'pointer' : '';
}

function dgcOnMapClick(e) {
    if (CatlecMapGL.isMarkerEvent(e)) return;
    const code = dgcPickProjectAt(e.point);
    if (code) {
        zoomToProjectCode(code);
        return;
    }
    // Clear selected project selection when clicking on the map background
    appState.selectedProjectCode = null;
    updateMapStyles();
    showTableListView();
}

function zoomToProjectCode(code) {
    if (!leafletMap || !code) return;

    const cleanCode = code.toString().trim();
    const proj = projectMetadata[cleanCode];
    if (!proj) return;

    appState.selectedProjectCode = cleanCode;
    updateMapStyles();
    showProjectDetailView(cleanCode);

    // Encuadre: las shapes del proyecto o, si no tiene, su ícono o centroide
    let features = dgcFeaturesOfShapes(proj.shapes);
    if (features.length === 0) {
        const targetMarker = (projectMarkersMap[cleanCode] || [])[0];
        const lngLat = targetMarker ? targetMarker.getLngLat().toArray() : getProjectCentroid(proj);
        if (lngLat) features = [{ type: 'Feature', geometry: { type: 'Point', coordinates: lngLat } }];
    }
    const bounds = CatlecMapGL.boundsOfFeatures(features);
    if (!bounds) return;

    // Zoom hardcodeado para "Estaciones de Transbordo para Transantiago": sus
    // estaciones se dispersan por 22 comunas de Santiago, lo que hace que el
    // zoom adaptativo por defecto quede demasiado alejado (valor en zoom Leaflet).
    const zoomOptions = { duration: 1.2 };
    if (cleanCode === '050_ETTT1') {
        zoomOptions.maxZoomOverride = 12.5;
    }
    // El vuelo se inicia tras el repintado, para que el render del panel de
    // detalle no se coma los primeros cuadros de la animación.
    CatlecUtils.afterNextPaint(() => CatlecMapGL.flyToBounds(leafletMap, bounds, zoomOptions));
}
