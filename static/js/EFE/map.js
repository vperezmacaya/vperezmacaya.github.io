// ─── static/js/EFE/map.js ──────────────────────────────────────────────────────
// Mapa de EFE con MapLibre GL (WebGL). Las utilidades comunes (mapa base,
// tooltip, vuelos, geometría, leyenda) vienen de CatlecMapGL (common/map-gl.js).
//
// - WebGL redibuja los vectores en cada cuadro: durante el zoom las líneas
//   mantienen su grosor y su forma correcta.
// - El estilo de cada shape vive en feature-state (color/ancho/opacidad por
//   COD), calculado con las funciones puras de estado de este archivo. Lo
//   seleccionado o en hover se dibuja en una capa superior filtrada.
// - Íconos de proyecto = marcadores HTML de MapLibre con el marcado/CSS de
//   siempre (.polygon-centroid-marker / .centroid-marker-pulse).

const EFE_TRAIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8"/><path d="M4 11V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6"/><path d="M4 11h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z"/><line x1="8" y1="15" x2="8.01" y2="15"/><line x1="16" y1="15" x2="16.01" y2="15"/><path d="m9 19-3 3"/><path d="m15 19 3 3"/></svg>`;
const EFE_UPGRADE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;

// ─── Lógica de estados ───────────────────────────────────────────────────────

function efeIsExpansionProject(proj) {
    if (!proj) return false;
    const t = String(proj.type || proj.projectType || '').trim().toLowerCase();
    return t.includes('expansi');
}

function efeIsNationalProject(proj) {
    if (!proj || !proj.shapes || !Array.isArray(proj.shapes)) return false;
    return proj.shapes.some(s => String(s).trim().toLowerCase() === 'nacional');
}
window.efeIsNationalProject = efeIsNationalProject;

function efeGetProjectColor(proj, state = 'default') {
    const isExp = efeIsExpansionProject(proj);
    if (state === 'selected' || state === 'active') {
        return isExp ? '#15733d' : '#b01c29';
    }
    if (state === 'hover') {
        return isExp ? '#1e9952' : '#d92534';
    }
    if (state === 'dimmed') {
        return isExp ? 'rgba(30, 153, 82, 0.25)' : 'rgba(217, 37, 52, 0.25)';
    }
    return isExp ? '#1e9952' : '#d92534';
}

function efeHasValidShapeAttribute(feature) {
    if (!feature || !feature.properties) return false;
    const props = feature.properties;
    const cod = (props.id != null ? String(props.id) : (props.COD != null ? String(props.COD) : '')).trim();
    const hasCod = cod !== '' && cod.toLowerCase() !== 'null' && cod.toLowerCase() !== 'none';
    if (!hasCod) return false;
    // Only include shapes that belong to at least one project or operating line in the database
    const hasProj = efeShapeToProjects && efeShapeToProjects[cod] && efeShapeToProjects[cod].length > 0;
    const hasLine = efeShapeToLines && efeShapeToLines[cod] && efeShapeToLines[cod].length > 0;
    return !!(hasProj || hasLine);
}

function efeGetActiveProjectForShape(cod) {
    if (!cod || !efeShowProjects) return null;
    const sCod = String(cod).trim();
    const activeProjects = (currentFilteredEFEProjects !== null && typeof currentFilteredEFEProjects !== 'undefined')
        ? currentFilteredEFEProjects
        : ((window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : []);
    const projNames = efeShapeToProjects[sCod] || [];
    return activeProjects.find(p => projNames.includes(p.name)) || null;
}

function efeGetActiveLineForShape(cod) {
    if (!cod) return null;
    const sCod = String(cod).trim();
    const activeLines = (currentFilteredEFELines !== null && typeof currentFilteredEFELines !== 'undefined')
        ? currentFilteredEFELines
        : ((window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : []);
    const lineNames = efeShapeToLines[sCod] || [];
    return activeLines.find(l => lineNames.includes(l.service)) || null;
}

// ─── Normalizador de Nombres de Servicio ──────────────────────────────────────
function efeNormalizeServiceName(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u2013\u2014–—]/g, '-')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();
}

// ─── Contexto de estilos (selección, hover y filtros activos) ───────────────
// Lo comparten la actualización completa (efeUpdateMapStyles) y el hover
// liviano (efeSetHover), para que ambos estilicen exactamente igual.
function efeBuildStyleContext() {
    const selectedName = efeState.selectedProjectName;
    const hoveredName = efeState.hoveredProjectName;
    const selectedLine = efeState.selectedOperatingLine;
    const hoveredLine = efeState.hoveredOperatingLine;

    const allProjects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
    const allLines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];

    const selectedProj = selectedName ? allProjects.find(p => p.name === selectedName) : null;
    const isSelectedNational = efeIsNationalProject(selectedProj);
    const selectedShapes = new Set();
    if (selectedProj) {
        if (isSelectedNational) {
            allLines.forEach(l => {
                (l.shapes || []).forEach(cod => selectedShapes.add(String(cod).trim()));
            });
        } else {
            (selectedProj.shapes || []).forEach(s => selectedShapes.add(String(s).trim()));
        }
    }

    const hoveredProj = hoveredName ? allProjects.find(p => p.name === hoveredName) : null;
    const isHoveredNational = efeIsNationalProject(hoveredProj);
    const hoveredShapes = new Set();
    if (hoveredProj) {
        if (isHoveredNational) {
            allLines.forEach(l => {
                (l.shapes || []).forEach(cod => hoveredShapes.add(String(cod).trim()));
            });
        } else {
            (hoveredProj.shapes || []).forEach(s => hoveredShapes.add(String(s).trim()));
        }
    }

    const selectedLineObj = selectedLine ? allLines.find(l => l.service === selectedLine) : null;
    const selectedLineShapes = new Set(selectedLineObj ? (selectedLineObj.shapes || []).map(s => String(s)) : []);
    const selectedLineColor = '#0f3b6c';

    const hoveredLineObj = hoveredLine ? allLines.find(l => l.service === hoveredLine) : null;
    const hoveredLineShapes = new Set(hoveredLineObj ? (hoveredLineObj.shapes || []).map(s => String(s)) : []);
    const hoveredLineColor = '#0f3b6c';

    // Active filtered projects and lines
    const activeProjects = (currentFilteredEFEProjects !== null && typeof currentFilteredEFEProjects !== 'undefined')
        ? currentFilteredEFEProjects
        : allProjects;
    const activeLines = (currentFilteredEFELines !== null && typeof currentFilteredEFELines !== 'undefined')
        ? currentFilteredEFELines
        : allLines;

    // Active project shape CODs (respecting efeShowProjects toggle)
    const activeFilteredProjectShapes = new Set();
    if (efeShowProjects) {
        activeProjects.forEach(proj => {
            (proj.shapes || []).forEach(cod => activeFilteredProjectShapes.add(String(cod).trim()));
        });
    }

    // Active line shape CODs
    const activeFilteredLineShapes = new Set();
    activeLines.forEach(l => {
        (l.shapes || []).forEach(cod => activeFilteredLineShapes.add(String(cod).trim()));
    });

    return {
        selectedName, hoveredName, selectedLine, hoveredLine, selectedProj, isSelectedNational, selectedShapes,
        hoveredProj, isHoveredNational, hoveredShapes, selectedLineShapes, selectedLineColor,
        hoveredLineShapes, hoveredLineColor, activeFilteredProjectShapes, activeFilteredLineShapes
    };
}

// Estilo de una shape del GeoJSON EFE (línea/polígono/punto) según el contexto
function efeGetShapeStyle(feature, ctx) {
    const {
        selectedName, hoveredName, selectedLine, hoveredLine, selectedProj, isSelectedNational,
        selectedShapes, isHoveredNational, hoveredShapes, selectedLineShapes, selectedLineColor,
        hoveredLineShapes, hoveredLineColor, activeFilteredProjectShapes, activeFilteredLineShapes
    } = ctx;

    if (feature.geometry && feature.geometry.type && feature.geometry.type.toLowerCase().includes('point')) {
        return { radius: 0, opacity: 0, fillOpacity: 0, stroke: false, fill: false };
    }

    const props = feature.properties || {};
    const cod = String(props.id != null ? props.id : (props.COD != null ? props.COD : '')).trim();
    const hasActiveProject = cod !== '' && activeFilteredProjectShapes.has(cod);
    const hasActiveLine = cod !== '' && activeFilteredLineShapes.has(cod);

    // Shapes not associated with any active filtered project or line are hidden
    if (!hasActiveProject && !hasActiveLine) {
        return { opacity: 0, fillOpacity: 0, stroke: false, fill: false };
    }

    const isProjSelected = efeShowProjects && selectedName && cod && selectedShapes.has(cod);
    const isProjHovered = efeShowProjects && hoveredName && cod && hoveredShapes.has(cod);
    const isLineSelected = selectedLine && cod && selectedLineShapes.has(cod);
    const isLineHovered = hoveredLine && cod && hoveredLineShapes.has(cod);

    const actProj = efeGetActiveProjectForShape(cod);
    const projColor = efeGetProjectColor(actProj, 'default');
    const projDimColor = efeGetProjectColor(actProj, 'dimmed');
    const projDarkColor = efeGetProjectColor(actProj, 'selected');

    if (selectedLine) {
        if (isLineSelected) {
            return {
                stroke: true,
                color: selectedLineColor,
                weight: 6.0,
                opacity: 1.0,
                fillOpacity: 0.5,
                fillColor: selectedLineColor
            };
        } else if (isProjHovered && hasActiveProject) {
            return {
                stroke: true,
                color: projColor,
                weight: 4.5,
                opacity: 0.90,
                fillOpacity: 0.35,
                fillColor: projColor
            };
        } else {
            return {
                stroke: true,
                color: hasActiveProject ? projDimColor : '#94a3b8',
                weight: 2.0,
                opacity: 0.30,
                fillOpacity: 0.05,
                fillColor: hasActiveProject ? projDimColor : '#94a3b8'
            };
        }
    } else if (selectedName) {
        if (isProjSelected) {
            const selCol = isSelectedNational ? selectedLineColor : efeGetProjectColor(selectedProj, 'selected');
            return {
                stroke: true,
                color: selCol,
                weight: isSelectedNational ? 6.0 : 5.5,
                opacity: 1.0,
                fillOpacity: 0.5,
                fillColor: selCol
            };
        } else if (isProjHovered && (hasActiveProject || isHoveredNational)) {
            const hovCol = isHoveredNational ? hoveredLineColor : projColor;
            return {
                stroke: true,
                color: hovCol,
                weight: isHoveredNational ? 5.5 : 4.5,
                opacity: 0.85,
                fillOpacity: 0.35,
                fillColor: hovCol
            };
        } else if (isLineHovered && hasActiveLine) {
            return {
                stroke: true,
                color: '#0f3b6c',
                weight: 4.5,
                opacity: 0.85,
                fillOpacity: 0.35,
                fillColor: '#0f3b6c'
            };
        } else {
            return {
                stroke: true,
                color: hasActiveProject ? projDimColor : '#94a3b8',
                weight: 2.0,
                opacity: 0.30,
                fillOpacity: 0.08,
                fillColor: hasActiveProject ? projDimColor : '#94a3b8'
            };
        }
    } else {
        // No selection active
        if (isLineHovered && hasActiveLine) {
            return {
                stroke: true,
                color: hoveredLineColor,
                weight: 5.5,
                opacity: 1.0,
                fillOpacity: 0.4,
                fillColor: hoveredLineColor
            };
        } else if (isProjHovered && (hasActiveProject || isHoveredNational)) {
            const hovCol = isHoveredNational ? hoveredLineColor : projDarkColor;
            return {
                stroke: true,
                color: hovCol,
                weight: isHoveredNational ? 5.5 : 5.0,
                opacity: 1.0,
                fillOpacity: 0.4,
                fillColor: hovCol
            };
        } else {
            // Default active state:
            // 1) Si está asociado a un proyecto activo -> Verde si es Expansión (#1e9952), Rojo si es No-Expansión (#d92534)
            // 2) Si el proyecto fue filtrado pero el servicio sigue activo -> Azul Marino (#0f3b6c)
            if (hasActiveProject) {
                return {
                    stroke: true,
                    color: projColor,
                    weight: 3.5,
                    opacity: 0.85,
                    fillOpacity: 0.25,
                    fillColor: projColor
                };
            } else {
                return {
                    stroke: true,
                    color: '#0f3b6c',
                    weight: 3.0,
                    opacity: 0.90,
                    fillOpacity: 0,
                    fillColor: '#0f3b6c'
                };
            }
        }
    }
}

// Estilo DOM de un ícono de proyecto: escala, color, z-index, fan-out y tooltip
function efeApplyMarkerState(marker, ctx) {
    const { selectedName, hoveredName, selectedLine, selectedProj } = ctx;
    if (!marker || !marker.getElement) return;
    const elem = marker.getElement();
    if (!elem) return;

    const pulse = elem.querySelector('.centroid-marker-pulse');
    if (!pulse) return;

    const isSelectedMarker = selectedName && marker.projectName === selectedName;
    const isHoveredMarker = hoveredName && marker.projectName === hoveredName;

    const clusterMembers = marker.clusterMembers || [marker];
    const isClusterActive = clusterMembers.some(m =>
        m.clusterState && m.clusterState.isClickedDeployed
    );

    const dx = (isClusterActive && marker.clusterDx != null) ? marker.clusterDx : 0;
    const dy = (isClusterActive && marker.clusterDy != null) ? marker.clusterDy : 0;

    let scaleStr = 'scale(1.0)';
    const baseColor = marker.projectColor || (marker.isExpansion ? '#1e9952' : '#d92534');
    let bg = baseColor;
    let zIndex = '100';

    if (selectedLine) {
        if (isHoveredMarker) {
            // Animate hovered project marker even when an operating line is selected
            pulse.classList.remove('active-selected');
            pulse.classList.add('is-hovered');
            pulse.classList.remove('dimmed');
            bg = baseColor;
            scaleStr = 'scale(1.25)';
            zIndex = '9500';
            if (marker.setZIndexOffset) marker.setZIndexOffset(9500);
        } else if (isClusterActive) {
            pulse.classList.remove('active-selected');
            pulse.classList.remove('is-hovered');
            pulse.classList.remove('dimmed');
            bg = baseColor;
            scaleStr = 'scale(1.0)';
            zIndex = '9000';
            if (marker.setZIndexOffset) marker.setZIndexOffset(9000);
        } else {
            // Dimming for non-hovered train icons when an operating line is selected
            pulse.classList.remove('active-selected');
            pulse.classList.remove('is-hovered');
            pulse.classList.add('dimmed');
            bg = baseColor;
            scaleStr = 'scale(0.85)';
            zIndex = '1';
            if (marker.setZIndexOffset) marker.setZIndexOffset(-1000);
        }
    } else if (selectedName) {
        if (isSelectedMarker) {
            // Selected train icon marker - Bring to absolute front of all map marker layers
            pulse.classList.add('active-selected');
            pulse.classList.remove('is-hovered');
            pulse.classList.remove('dimmed');
            bg = efeGetProjectColor(selectedProj, 'selected');
            scaleStr = 'scale(1.35)';
            zIndex = '10000';
            if (marker.setZIndexOffset) marker.setZIndexOffset(10000);
        } else if (isHoveredMarker) {
            pulse.classList.remove('active-selected');
            pulse.classList.add('is-hovered');
            pulse.classList.remove('dimmed');
            bg = baseColor;
            scaleStr = 'scale(1.25)';
            zIndex = '9500';
            if (marker.setZIndexOffset) marker.setZIndexOffset(9500);
        } else if (isClusterActive) {
            // Bring all deployed cluster icons to high z-index (9000) so nearby markers never overlap them
            pulse.classList.remove('active-selected');
            pulse.classList.remove('is-hovered');
            pulse.classList.remove('dimmed');
            bg = baseColor;
            scaleStr = 'scale(1.0)';
            zIndex = '9000';
            if (marker.setZIndexOffset) marker.setZIndexOffset(9000);
        } else {
            // DIMMING for non-selected train icons (reduced dimming: scale 0.85, opacity 0.48)
            pulse.classList.remove('active-selected');
            pulse.classList.remove('is-hovered');
            pulse.classList.add('dimmed');
            bg = baseColor;
            scaleStr = 'scale(0.85)';
            zIndex = '1';
            if (marker.setZIndexOffset) marker.setZIndexOffset(-1000);
        }
    } else {
        // No selection active
        if (isHoveredMarker) {
            pulse.classList.remove('active-selected');
            pulse.classList.add('is-hovered');
            pulse.classList.remove('dimmed');
            bg = baseColor;
            scaleStr = 'scale(1.25)';
            zIndex = '9500';
            if (marker.setZIndexOffset) marker.setZIndexOffset(9500);
        } else if (isClusterActive) {
            // Bring all deployed cluster icons to high z-index (9000) so nearby markers never overlap them
            pulse.classList.remove('active-selected');
            pulse.classList.remove('is-hovered');
            pulse.classList.remove('dimmed');
            bg = baseColor;
            scaleStr = 'scale(1.0)';
            zIndex = '9000';
            if (marker.setZIndexOffset) marker.setZIndexOffset(9000);
        } else {
            // Normal state for all train icons
            pulse.classList.remove('active-selected');
            pulse.classList.remove('is-hovered');
            pulse.classList.remove('dimmed');
            bg = baseColor;
            scaleStr = 'scale(1.0)';
            zIndex = '100';
            if (marker.setZIndexOffset) marker.setZIndexOffset(0);
        }
    }

    // Solo reescribir el tooltip si su contenido cambió: hacerlo en cada
    // actualización re-renderiza y reposiciona el tooltip abierto (parpadeo).
    const N = clusterMembers.length;
    if (marker.setTooltipContent) {
        const tipHtml = (N > 1 && !isClusterActive)
            ? `<strong>${N} proyectos en este lugar</strong>`
            : `<strong>${marker.projectName}</strong><br><span style="color:#94a3b8;font-size:0.7rem">${marker.projectFilial || ''}</span>`;
        if (marker._efeTipHtml !== tipHtml) {
            marker.setTooltipContent(tipHtml);
            marker._efeTipHtml = tipHtml;
        }
    }

    const badge = pulse.querySelector('.marker-cluster-badge');
    if (badge) {
        if (selectedName || selectedLine || isClusterActive) {
            badge.style.display = 'none';
        } else {
            badge.style.display = 'flex';
        }
    }

    pulse.style.backgroundColor = bg;
    elem.style.zIndex = zIndex;

    if (dx !== 0 || dy !== 0) {
        pulse.style.transform = `translate(${dx}px, ${dy}px) ${scaleStr}`;
        pulse.classList.add('deployed');
    } else {
        pulse.style.transform = `translate(0px, 0px) ${scaleStr}`;
        pulse.classList.remove('deployed');
    }
}

// ─── Select Project (Zoom + Highlight + Dimming) ────────────────────────────
function efeSelectProject(proj) {
    if (!proj) {
        efeState.selectedProjectName = null;
    } else {
        efeState.selectedProjectName = proj.name;
        efeState.selectedOperatingLine = null;
        efeState.hoveredOperatingLine = null;
        // Si el usuario está en la vista de líneas actuales, alternar a la vista proyectos
        if (efeState.tableMode !== 'projects' && typeof setEfeTableMode === 'function') {
            setEfeTableMode('projects');
        }
        efeZoomToProject(proj);
    }
    if (typeof efeUpdateOperatingLinesTableSelection === 'function') {
        efeUpdateOperatingLinesTableSelection();
    }
    efeUpdateMapStyles();
    if (typeof efeFetchData === 'function') {
        efeFetchData();
    }
}

function efeResetMap() {
    efeState.selectedProjectName = null;
    efeState.hoveredProjectName = null;
    efeState.selectedOperatingLine = null;
    efeState.hoveredOperatingLine = null;
    efeProjectMarkers.forEach(m => {
        if (m.clusterState) m.clusterState.isClickedDeployed = false;
    });
    if (typeof efeUpdateOperatingLinesTableSelection === 'function') {
        efeUpdateOperatingLinesTableSelection();
    }
    efeUpdateMapStyles();
    if (typeof efeShowTableListView === 'function') {
        efeShowTableListView();
    }
    if (typeof efeFetchData === 'function') {
        efeFetchData();
    }
    efeApplyDefaultMapView(true);
}

// ─── Operating Lines (Servicios Actuales) Map Interaction ──────────────────
function efeSelectOperatingLine(lineName) {
    if (!lineName) {
        efeState.selectedOperatingLine = null;
    } else {
        efeState.selectedOperatingLine = lineName;
        efeState.selectedProjectName = null;
        efeZoomToOperatingLine(lineName);
    }
    if (typeof efeUpdateOperatingLinesTableSelection === 'function') {
        efeUpdateOperatingLinesTableSelection();
    }
    efeUpdateMapStyles();
}
window.efeSelectOperatingLine = efeSelectOperatingLine;

function efeOnClickOperatingLine(lineName) {
    if (!lineName) return;
    if (efeState.tableMode !== 'lines' && typeof setEfeTableMode === 'function') {
        setEfeTableMode('lines');
    }
    if (efeState.selectedOperatingLine === lineName) {
        efeState.selectedOperatingLine = null;
        if (typeof efeApplyDefaultMapView === 'function') efeApplyDefaultMapView(true);
    } else {
        efeState.selectedOperatingLine = lineName;
        efeState.selectedProjectName = null;
        efeZoomToOperatingLine(lineName);
    }
    if (typeof efeUpdateOperatingLinesTableSelection === 'function') {
        efeUpdateOperatingLinesTableSelection();
    }
    efeUpdateMapStyles();
}
window.efeOnClickOperatingLine = efeOnClickOperatingLine;

function efeOnHoverOperatingLine(lineName, isHover) {
    if (efeState.selectedProjectName || efeState.selectedOperatingLine) return;
    efeSetHover(efeState.hoveredProjectName, isHover ? lineName : null);
}
window.efeOnHoverOperatingLine = efeOnHoverOperatingLine;

function efeHighlightProjectShapes(shapes) {
    let nextProj = efeState.hoveredProjectName;
    if (!shapes || shapes.length === 0) {
        nextProj = null;
    } else {
        const shapeStrSet = new Set(shapes.map(String));
        const allProjects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
        const proj = allProjects.find(p => (p.shapes || []).some(s => shapeStrSet.has(String(s))));
        if (proj) {
            nextProj = proj.name;
        }
    }
    efeSetHover(nextProj, efeState.hoveredOperatingLine);
}

function efeUpdateMapBadge(shown, total) {
    if (efeMapStatsBadge) {
        efeMapStatsBadge.textContent = `${shown} / ${total} proyectos`;
    }
}

// ─── Constantes y estado del mapa MapLibre ───────────────────────────────────
// Umbrales heredados de Leaflet convertidos a zoom MapLibre (ver CatlecMapGL)
const STATIONS_MIN_ZOOM = 11 - CatlecMapGL.ZOOM_OFFSET;
const EFE_DEFAULT_CENTER = [-71.5430, -35.6751];
const EFE_DEFAULT_ZOOM = 5 - CatlecMapGL.ZOOM_OFFSET;

// Capas consultables al pasar el mouse (de arriba hacia abajo)
const EFE_HOVER_LAYERS = ['efe-stations', 'metro-stations', 'efe-shapes-hit', 'metro-lines-hit'];

let efeMapReady = false;           // true cuando el estilo y las capas están cargados
let efeLineCods = new Set();       // CODs con geometría lineal en la fuente 'efe-shapes'
let efeStationsInfo = [];          // estaciones EFE precalculadas (id, stInfo, servicios, proyectos)
let efeTooltip = null;             // tooltip único del mapa (CatlecMapGL.createTooltip)
let efeIsDragClick = () => false;  // click que el navegador dispara al soltar un arrastre
let efeMapHoverKey = null;         // elemento del mapa bajo el cursor (no íconos)
let efeHoveredMetroLineId = null;

// ─── Inicialización ──────────────────────────────────────────────────────────
// (Nombre heredado de Leaflet: lo llama EFE/ui.js)
function efeInitLeafletMap() {
    if (!document.getElementById('efe-map') || efeMap) return;

    efeMap = CatlecMapGL.createMap('efe-map', { center: EFE_DEFAULT_CENTER, zoom: EFE_DEFAULT_ZOOM });
    efeTooltip = CatlecMapGL.createTooltip(efeMap);
    efeIsDragClick = CatlecMapGL.trackDragClick(efeMap);

    efeMap.on('mousemove', efeOnMapMouseMove);
    efeMap.getCanvas().addEventListener('mouseleave', () => efeSetMapHover(null));
    efeMap.on('click', efeOnMapClick);
    efeMap.on('load', efeLoadMapLayers);
}

function efeFeatureCod(feature) {
    const props = (feature && feature.properties) || {};
    return (props.id != null ? String(props.id) : (props.COD != null ? String(props.COD) : '')).trim();
}

function efeIsPointFeature(feature) {
    return !!(feature && feature.geometry && String(feature.geometry.type).toLowerCase().includes('point'));
}

function efeFeaturesOfCods(cods) {
    const out = [];
    (cods || []).forEach(cod => (efeShapeGeometries[String(cod).trim()] || []).forEach(f => out.push(f)));
    return out;
}

function efeLoadMapLayers() {
    efeShapeGeometries = {};

    const geoData = window.EFE_GEO_DATA;
    if (!geoData || !geoData.features) {
        console.warn('EFE_GEO_DATA not available');
        return;
    }

    // Build shape→projects index from EFE_DATA
    const projects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
    efeShapeToProjects = {};
    projects.forEach(proj => {
        (proj.shapes || []).forEach(cod => {
            const key = String(cod);
            if (!efeShapeToProjects[key]) efeShapeToProjects[key] = [];
            efeShapeToProjects[key].push(proj.name);
        });
    });

    // Build shape→lines index from EFE_DATA.lines
    const lines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
    efeShapeToLines = {};
    lines.forEach(l => {
        (l.shapes || []).forEach(cod => {
            const key = String(cod);
            if (!efeShapeToLines[key]) efeShapeToLines[key] = [];
            efeShapeToLines[key].push(l.service);
        });
    });

    // Índice COD → features (líneas y puntos) y fuente solo con las líneas.
    // promoteId 'cod': todas las features de un mismo COD comparten feature-state.
    const lineFeatures = [];
    efeLineCods = new Set();
    geoData.features.forEach(feature => {
        if (!feature || !feature.geometry || !feature.geometry.coordinates || feature.geometry.coordinates.length === 0) return;
        if (!efeHasValidShapeAttribute(feature)) return;
        const cod = efeFeatureCod(feature);
        if (!efeShapeGeometries[cod]) efeShapeGeometries[cod] = [];
        efeShapeGeometries[cod].push(feature);
        if (!efeIsPointFeature(feature)) {
            lineFeatures.push({ type: 'Feature', geometry: feature.geometry, properties: { cod } });
            efeLineCods.add(cod);
        }
    });

    const before = CatlecMapGL.labelsBeforeId(efeMap);
    const state = (key, fallback) => ['coalesce', ['feature-state', key], fallback];
    const shapePaint = {
        'line-color': state('color', '#0f3b6c'),
        'line-width': state('width', 0),
        'line-opacity': state('opacity', 0)
    };
    const roundLine = { 'line-cap': 'round', 'line-join': 'round' };
    const hover = ['boolean', ['feature-state', 'hover'], false];

    efeMap.addSource('efe-shapes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: lineFeatures },
        promoteId: 'cod'
    });
    efeMap.addLayer({ id: 'efe-shapes-line', type: 'line', source: 'efe-shapes', layout: roundLine, paint: shapePaint }, before);

    // Metro de Santiago (solo usage == 'main')
    const metroData = window.METRO_GEO_DATA;
    const metroFeatures = (metroData && metroData.features ? metroData.features : []).filter(f =>
        f && f.geometry && f.geometry.coordinates && f.geometry.coordinates.length > 0 && (f.properties || {}).usage === 'main'
    ).map(f => {
        const p = f.properties || {};
        return {
            type: 'Feature',
            geometry: f.geometry,
            properties: { id: String(p.id || p['@id'] || ''), label: p.name || (p.ref ? ('Línea ' + p.ref) : 'Metro de Santiago') }
        };
    });
    efeMap.addSource('metro-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: metroFeatures }, promoteId: 'id' });
    efeMap.addLayer({
        id: 'metro-lines', type: 'line', source: 'metro-lines', layout: roundLine,
        paint: {
            'line-color': ['case', hover, '#e11d48', '#c53030'],
            'line-width': ['case', hover, 3.6, 2.3],
            'line-opacity': ['case', hover, 0.95, 0.75]
        }
    }, before);

    // Lo seleccionado o en hover se dibuja encima (equivale a bringToFront, sin
    // tocar el DOM ni romper eventos del puntero)
    efeMap.addLayer({
        id: 'efe-shapes-top', type: 'line', source: 'efe-shapes', layout: roundLine, paint: shapePaint,
        filter: CatlecMapGL.inFilter('cod', [])
    }, before);

    // Capas invisibles y anchas solo para detectar hover/click con holgura
    efeMap.addLayer({ id: 'metro-lines-hit', type: 'line', source: 'metro-lines', paint: { 'line-width': 10, 'line-opacity': 0 } }, before);
    efeMap.addLayer({ id: 'efe-shapes-hit', type: 'line', source: 'efe-shapes', paint: { 'line-width': 12, 'line-opacity': 0 } }, before);

    // Estaciones de Metro
    const metroPoints = window.METRO_POINTS_DATA;
    efeMap.addSource('metro-stations', {
        type: 'geojson',
        data: metroPoints && metroPoints.features ? metroPoints : { type: 'FeatureCollection', features: [] }
    });
    efeMap.addLayer({
        id: 'metro-stations', type: 'circle', source: 'metro-stations', minzoom: STATIONS_MIN_ZOOM,
        paint: {
            'circle-radius': 2.5, 'circle-color': '#ffffff', 'circle-opacity': 0.95,
            'circle-stroke-color': '#c53030', 'circle-stroke-width': 1.2, 'circle-stroke-opacity': 0.85
        }
    }, before);

    // Estaciones de pasajeros EFE (estilo por estación vía feature-state)
    const estaciones = window.EFE_ESTACIONES_DATA;
    efeStationsInfo = [];
    const estacionFeatures = (estaciones && estaciones.features ? estaciones.features : []).map((f, i) => {
        const props = f.properties || {};
        const id = String(props.id != null ? props.id : ('est-' + i));
        const stInfo = (typeof efeFindStation === 'function') ? efeFindStation(f) : null;
        efeStationsInfo.push({
            id,
            name: (stInfo && stInfo.name) || props.name || 'Estación EFE',
            stInfo,
            actServs: (stInfo && stInfo.services) ? stInfo.services : (props.services || props.servicios_activos || []),
            projIds: (stInfo && stInfo.project_ids) ? stInfo.project_ids : (props.project_ids || [])
        });
        return { type: 'Feature', geometry: f.geometry, properties: { id } };
    });
    efeMap.addSource('efe-stations', { type: 'geojson', data: { type: 'FeatureCollection', features: estacionFeatures }, promoteId: 'id' });
    efeMap.addLayer({
        id: 'efe-stations', type: 'circle', source: 'efe-stations', minzoom: STATIONS_MIN_ZOOM,
        paint: {
            'circle-radius': state('radius', 2.5),
            'circle-color': '#ffffff',
            'circle-opacity': state('fillOpacity', 0.95),
            'circle-stroke-color': state('color', '#1e293b'),
            'circle-stroke-width': state('width', 1.3),
            'circle-stroke-opacity': state('opacity', 0.9)
        }
    }, before);

    efeMapReady = true;

    efeAddMapLegend();
    efeApplyLayerToggles();
    efeUpdateStationsVisibility();

    if (typeof efeFetchData === 'function') {
        efeFetchData();
    }

    // Encuadre inicial idéntico al botón Restablecer Mapa
    efeApplyDefaultMapView(false);
}

// ─── Visibilidad de capas ────────────────────────────────────────────────────
function efeApplyLayerToggles() {
    ['metro-lines', 'metro-lines-hit'].forEach(id => CatlecMapGL.setLayerVisible(efeMap, id, efeShowMetroLines));
    ['efe-shapes-line', 'efe-shapes-top', 'efe-shapes-hit'].forEach(id => CatlecMapGL.setLayerVisible(efeMap, id, efeShowEfeLines));
}

function efeUpdateStationsVisibility() {
    if (!efeMapReady) return;
    CatlecMapGL.setLayerVisible(efeMap, 'metro-stations', efeShowMetroLines);
    CatlecMapGL.setLayerVisible(efeMap, 'efe-stations', efeShowEfeLines);
    // Estaciones EFE visibles a cualquier zoom si hay un servicio o proyecto seleccionado
    const hasActiveSelection = !!(efeState.selectedOperatingLine || efeState.selectedProjectName);
    efeMap.setLayerZoomRange('efe-stations', hasActiveSelection ? 0 : STATIONS_MIN_ZOOM, 24);
}

function efeToggleEfeLines(visible) {
    efeShowEfeLines = !!visible;
    if (!efeMapReady) return;
    efeApplyLayerToggles();
    efeUpdateStationsVisibility();
    efeUpdateMapStyles();
}

function efeToggleMetroLines(visible) {
    efeShowMetroLines = !!visible;
    if (!efeMapReady) return;
    efeApplyLayerToggles();
    efeUpdateStationsVisibility();
    efeUpdateMapStyles();
}

function efeToggleProjects(visible) {
    efeShowProjects = !!visible;
    if (!efeMap) return;

    const otherBadge = document.querySelector('.efe-legend-subitem');
    if (otherBadge) {
        otherBadge.style.opacity = visible ? '1.0' : '0.4';
    }

    if (!efeShowProjects) {
        efeProjectMarkers.forEach(m => m.remove());
        efeClearClusterDecorations();
    } else {
        const projs = (typeof currentFilteredEFEProjects !== 'undefined' && currentFilteredEFEProjects && currentFilteredEFEProjects.length > 0)
            ? currentFilteredEFEProjects
            : ((window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : []);
        efeRenderProjectMarkers(projs);
    }
    efeUpdateMapStyles();
}

function efeClearClusterDecorations() {
    efeClusterOriginMarkers.forEach(m => m.remove());
    efeClusterOriginMarkers = [];
}

// ─── Estilos (misma lógica de estados de siempre, aplicada con feature-state) ─
function efeApplyShapeState(cod, ctx) {
    if (!efeLineCods.has(cod)) return;
    const feature = (efeShapeGeometries[cod] || []).find(f => !efeIsPointFeature(f));
    if (!feature) return;
    const s = efeGetShapeStyle(feature, ctx);
    const hidden = s.stroke === false || !s.opacity;
    efeMap.setFeatureState({ source: 'efe-shapes', id: cod }, {
        color: s.color || '#0f3b6c',
        width: hidden ? 0 : s.weight,
        opacity: hidden ? 0 : s.opacity
    });
}

// Capa superior: shapes seleccionadas y en hover
function efeUpdateTopLayer(ctx) {
    const top = new Set();
    if (ctx.selectedLine) ctx.selectedLineShapes.forEach(c => top.add(String(c).trim()));
    else if (ctx.selectedName) ctx.selectedShapes.forEach(c => top.add(String(c).trim()));
    if (ctx.hoveredLine) ctx.hoveredLineShapes.forEach(c => top.add(String(c).trim()));
    if (ctx.hoveredName) ctx.hoveredShapes.forEach(c => top.add(String(c).trim()));
    efeMap.setFilter('efe-shapes-top', CatlecMapGL.inFilter('cod', top));
}

function efeApplyStationStyles(ctx) {
    const { selectedName, selectedLine, selectedProj, isSelectedNational, selectedLineColor } = ctx;
    const isDimmed = !!(selectedName || selectedLine);
    const normSelLine = efeNormalizeServiceName(selectedLine);

    efeStationsInfo.forEach(st => {
        const isMatchLine = normSelLine && st.actServs.some(s => {
            const sNorm = efeNormalizeServiceName(s);
            return sNorm === normSelLine || sNorm.includes(normSelLine) || normSelLine.includes(sNorm);
        });
        const isMatchProj = selectedProj && (
            isSelectedNational
                ? (st.stInfo ? (st.stInfo.in_operation === true || st.stInfo.in_operation === 'Si' || st.stInfo.in_operation === 1) : true)
                : st.projIds.some(pid => {
                    const pStr = String(pid).trim();
                    return pStr === String(selectedProj.id) || (selectedProj.name && pStr === String(selectedProj.name).trim());
                })
        );

        let style;
        if (isMatchLine) {
            style = { radius: 4.5, color: selectedLineColor, width: 2.2, opacity: 1.0, fillOpacity: 1.0 };
        } else if (isMatchProj) {
            const projStColor = isSelectedNational ? selectedLineColor : efeGetProjectColor(selectedProj, 'default');
            style = { radius: 4.5, color: projStColor, width: 2.2, opacity: 1.0, fillOpacity: 1.0 };
        } else {
            style = {
                radius: isDimmed ? 2.0 : 2.5,
                color: '#1e293b',
                width: isDimmed ? 0.8 : 1.3,
                opacity: isDimmed ? 0.30 : 0.9,
                fillOpacity: isDimmed ? 0.30 : 0.95
            };
        }
        efeMap.setFeatureState({ source: 'efe-stations', id: st.id }, style);
    });
}

function efeApplyMetroStyles(ctx) {
    const dimmed = !!(ctx.selectedName || ctx.selectedLine);
    const hover = ['boolean', ['feature-state', 'hover'], false];
    efeMap.setPaintProperty('metro-lines', 'line-width', ['case', hover, 3.6, dimmed ? 1.6 : 2.3]);
    efeMap.setPaintProperty('metro-lines', 'line-opacity', ['case', hover, 0.95, dimmed ? 0.35 : 0.75]);
    efeMap.setPaintProperty('metro-stations', 'circle-radius', dimmed ? 2.0 : 2.5);
    efeMap.setPaintProperty('metro-stations', 'circle-stroke-width', dimmed ? 0.8 : 1.2);
    efeMap.setPaintProperty('metro-stations', 'circle-stroke-opacity', dimmed ? 0.35 : 0.85);
    efeMap.setPaintProperty('metro-stations', 'circle-opacity', dimmed ? 0.35 : 0.95);
}

// ─── Dynamic Map Styler (Dimming, Hover, Selection, and Spiderfy Fan-out) ───
function efeUpdateMapStyles() {
    if (!efeMapReady) return;
    efeUpdateStationsVisibility();

    const ctx = efeBuildStyleContext();

    efeLineCods.forEach(cod => efeApplyShapeState(cod, ctx));
    efeUpdateTopLayer(ctx);
    efeApplyMetroStyles(ctx);
    efeApplyStationStyles(ctx);

    // Íconos y clusters desplegados
    efeClearClusterDecorations();
    const processedClusterStates = new Set();
    efeProjectMarkers.forEach(marker => {
        const clusterMembers = marker.clusterMembers || [marker];
        const clusterState = marker.clusterState;
        const isClusterActive = clusterMembers.some(m => m.clusterState && m.clusterState.isClickedDeployed);

        if (efeShowProjects && isClusterActive && clusterMembers.length > 1 && clusterState && !processedClusterStates.has(clusterState)) {
            processedClusterStates.add(clusterState);
            efeClusterOriginMarkers.push(CatlecMapGL.createClusterOrigin(efeMap, clusterMembers, {
                isDragClick: efeIsDragClick,
                onCollapse: () => {
                    clusterState.isClickedDeployed = false;
                    efeUpdateMapStyles();
                }
            }));
        }

        efeApplyMarkerState(marker, ctx);
    });
}

// ─── Hover liviano (mapa, tabla y líneas de servicio) ───────────────────────
// Reestiliza solo las shapes e íconos del hover anterior y del nuevo; el hover
// no afecta Metro, estaciones ni clusters (dependen solo de la selección).
function efeSetHover(projectName, lineName) {
    const prevProj = efeState.hoveredProjectName;
    const prevLine = efeState.hoveredOperatingLine;
    if (prevProj === projectName && prevLine === lineName) return;

    efeState.hoveredProjectName = projectName;
    efeState.hoveredOperatingLine = lineName;
    if (!efeMapReady) return;

    const allProjects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
    const allLines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
    const affectedShapes = new Set();

    [prevProj, projectName].forEach(name => {
        const proj = name ? allProjects.find(p => p.name === name) : null;
        if (!proj) return;
        const shapeSource = efeIsNationalProject(proj) ? allLines.flatMap(l => l.shapes || []) : (proj.shapes || []);
        shapeSource.forEach(cod => affectedShapes.add(String(cod).trim()));
    });
    [prevLine, lineName].forEach(service => {
        const line = service ? allLines.find(l => l.service === service) : null;
        if (line) (line.shapes || []).forEach(cod => affectedShapes.add(String(cod).trim()));
    });

    const ctx = efeBuildStyleContext();
    affectedShapes.forEach(cod => efeApplyShapeState(cod, ctx));
    efeUpdateTopLayer(ctx);

    efeProjectMarkers.forEach(marker => {
        if (marker.projectName === prevProj || marker.projectName === projectName) {
            efeApplyMarkerState(marker, ctx);
        }
    });
}
window.efeSetHover = efeSetHover;

// ─── Eventos del mapa (capas WebGL) ──────────────────────────────────────────
function efeIsActiveShapeCod(cod) {
    return efeShowEfeLines && !!(efeGetActiveLineForShape(cod) || efeGetActiveProjectForShape(cod));
}

// Primer elemento significativo bajo el cursor (las shapes ocultas por filtro
// siguen en la capa de detección, así que se descartan aquí)
function efePickFeature(point) {
    const layers = EFE_HOVER_LAYERS.filter(id => efeMap.getLayer(id));
    const feats = efeMap.queryRenderedFeatures(point, { layers });
    for (const f of feats) {
        const layerId = f.layer.id;
        if (layerId === 'efe-shapes-hit') {
            if (efeIsActiveShapeCod(f.properties.cod)) return { kind: 'shape', cod: f.properties.cod };
        } else if (layerId === 'metro-lines-hit') {
            return { kind: 'metro-line', id: f.properties.id, label: f.properties.label };
        } else if (layerId === 'efe-stations') {
            const st = efeStationsInfo.find(s => s.id === String(f.properties.id));
            return { kind: 'efe-station', id: String(f.properties.id), name: st ? st.name : 'Estación EFE' };
        } else if (layerId === 'metro-stations') {
            return { kind: 'metro-station', id: String(f.id != null ? f.id : f.properties.name), name: f.properties.name || 'Estación Metro' };
        }
    }
    return null;
}

function efeOnMapMouseMove(e) {
    if (efeTooltip.moving || CatlecMapGL.isMarkerEvent(e)) return;
    efeSetMapHover(efePickFeature(e.point), e.point);
}

function efeTooltipHtml(hit) {
    if (hit.kind === 'metro-line') {
        return `<strong>${hit.label}</strong><br><span style="font-size:11px;color:#94a3b8;">Red Metro de Santiago</span>`;
    }
    if (hit.kind === 'efe-station') {
        return `<strong>${hit.name}</strong><br><span style="font-size:10.5px;color:#94a3b8;">Estación</span>`;
    }
    if (hit.kind === 'metro-station') {
        return `<strong>${hit.name}</strong><br><span style="font-size:10.5px;color:#94a3b8;">Estación Metro de Santiago</span>`;
    }
    return null; // las shapes EFE no tienen tooltip
}

function efeSetMapHover(hit, point) {
    const key = hit ? `${hit.kind}:${hit.cod || hit.id}` : null;

    if (key !== efeMapHoverKey) {
        const prevKey = efeMapHoverKey;
        efeMapHoverKey = key;

        // Salida de una shape EFE: limpiar el hover
        if (prevKey && prevKey.startsWith('shape:') && !(hit && hit.kind === 'shape')) {
            efeSetHover(null, null);
        }

        // Resaltado de la línea de Metro bajo el cursor
        const metroId = hit && hit.kind === 'metro-line' ? hit.id : null;
        if (metroId !== efeHoveredMetroLineId) {
            if (efeHoveredMetroLineId) efeMap.setFeatureState({ source: 'metro-lines', id: efeHoveredMetroLineId }, { hover: false });
            if (metroId) efeMap.setFeatureState({ source: 'metro-lines', id: metroId }, { hover: true });
            efeHoveredMetroLineId = metroId;
        }

        if (hit && hit.kind === 'shape') {
            const actLine = efeGetActiveLineForShape(hit.cod);
            const actProj = efeGetActiveProjectForShape(hit.cod);
            let nextProj = efeState.hoveredProjectName;
            let nextLine = efeState.hoveredOperatingLine;
            if (efeState.tableMode === 'lines') {
                if (actLine) nextLine = actLine.service; else nextProj = actProj.name;
            } else {
                if (actProj) nextProj = actProj.name; else nextLine = actLine.service;
            }
            efeSetHover(nextProj, nextLine);
        }

        efeMap.getCanvas().style.cursor = hit ? 'pointer' : '';
    }

    const html = hit ? efeTooltipHtml(hit) : null;
    if (html && point) efeTooltip.show(key, html, point);
    else if (efeTooltip.owner && !String(efeTooltip.owner).startsWith('marker:')) efeTooltip.hide();
}

function efeOnMapClick(e) {
    if (CatlecMapGL.isMarkerEvent(e)) return;
    const hit = efePickFeature(e.point);

    if (hit && hit.kind === 'shape') {
        const actLine = efeGetActiveLineForShape(hit.cod);
        const actProj = efeGetActiveProjectForShape(hit.cod);
        if (efeState.tableMode === 'lines') {
            if (actLine) efeOnClickOperatingLine(actLine.service);
            else if (actProj) efeSelectProject(actProj);
        } else {
            if (actProj) efeSelectProject(actProj);
            else if (actLine) efeOnClickOperatingLine(actLine.service);
        }
        return;
    }

    // Clic en el fondo (o en estaciones/Metro): deseleccionar
    efeState.selectedProjectName = null;
    efeState.hoveredProjectName = null;
    efeState.selectedOperatingLine = null;
    efeState.hoveredOperatingLine = null;
    efeProjectMarkers.forEach(m => {
        if (m.clusterState) m.clusterState.isClickedDeployed = false;
    });
    if (typeof efeUpdateOperatingLinesTableSelection === 'function') {
        efeUpdateOperatingLinesTableSelection();
    }
    efeUpdateMapStyles();
    if (typeof efeFetchData === 'function') efeFetchData();
}

// ─── Íconos de proyecto (marcadores HTML de MapLibre) ───────────────────────
function efeRenderProjectMarkers(mapProjects) {
    if (!efeMap) return;

    efeProjectMarkers.forEach(m => m.remove());
    efeProjectMarkers = [];
    efeClearClusterDecorations();

    if (!efeShowProjects || !efeMapReady) return;
    if (!mapProjects || mapProjects.length === 0) return;

    const rawMarkerList = [];
    mapProjects.forEach(proj => {
        if (!proj.shapes || !Array.isArray(proj.shapes) || proj.shapes.length === 0) return;
        if (efeIsNationalProject(proj)) return;

        const features = efeFeaturesOfCods(proj.shapes);
        if (features.length === 0) return;

        const points = features.filter(efeIsPointFeature);
        const lineFeatures = features.filter(f => !efeIsPointFeature(f));

        if (points.length > 0) {
            // Proyectos puntuales: un marcador por punto
            const isManyPoints = points.length > 5;
            points.forEach((f, idx) => {
                const c = f.geometry.type === 'Point' ? f.geometry.coordinates : f.geometry.coordinates[0];
                rawMarkerList.push({ proj, lngLat: c, isMini: isManyPoints && idx > 0 });
            });
        } else if (lineFeatures.length > 0) {
            // Proyectos lineales: 1 marcador en el punto medio del trazado
            const mid = CatlecMapGL.lineMidpoint(lineFeatures);
            if (mid) rawMarkerList.push({ proj, lngLat: mid, isMini: false });
        }
    });

    // Agrupar por proximidad (~80 m)
    const clusters = [];
    rawMarkerList.forEach(item => {
        const c = clusters.find(cl =>
            Math.abs(cl[0].lngLat[1] - item.lngLat[1]) < 0.0008 && Math.abs(cl[0].lngLat[0] - item.lngLat[0]) < 0.0008
        );
        if (c) c.push(item); else clusters.push([item]);
    });

    clusters.forEach(cluster => {
        const N = cluster.length;
        const R = 22; // Offset radius in pixels (kept very close to original location)
        const clusterState = { isClickedDeployed: false };
        const clusterMarkers = cluster.map((item, k) => {
            const marker = efeCreateTrainMarker(item.proj, item.lngLat, item.isMini, N);
            marker.clusterState = clusterState;
            if (N > 1) {
                const angle = (2 * Math.PI * k) / N - Math.PI / 2;
                marker.clusterDx = Math.round(R * Math.cos(angle));
                marker.clusterDy = Math.round(R * Math.sin(angle));
            } else {
                marker.clusterDx = 0;
                marker.clusterDy = 0;
            }
            efeProjectMarkers.push(marker);
            return marker;
        });

        clusterMarkers.forEach(m => {
            m.clusterMembers = clusterMarkers;
            const el = m.getElement();
            const owner = 'marker:' + m.projectName;

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (efeIsDragClick()) return;
                if (N > 1 && !clusterState.isClickedDeployed) {
                    // Primer click en un cluster: desplegar los íconos
                    clusterState.isClickedDeployed = true;
                    efeUpdateMapStyles();
                } else {
                    const proj = (window.EFE_DATA.data || []).find(p => p.name === m.projectName);
                    clusterState.isClickedDeployed = false;
                    efeTooltip.hide();
                    efeSelectProject(proj);
                }
            });
            el.addEventListener('mouseenter', (e) => {
                efeSetHover(m.projectName, efeState.hoveredOperatingLine);
                efeTooltip.show(owner, m.tooltipHtml, efeTooltip.pointFromEvent(e));
            });
            el.addEventListener('mousemove', (e) => {
                efeTooltip.show(owner, m.tooltipHtml, efeTooltip.pointFromEvent(e));
            });
            el.addEventListener('mouseleave', () => {
                efeSetHover(null, efeState.hoveredOperatingLine);
                if (efeTooltip.owner === owner) efeTooltip.hide();
            });

            m.addTo(efeMap);
        });
    });
}

function efeCreateTrainMarker(proj, lngLat, isMiniDot = false, clusterCount = 1) {
    const badgeHtml = clusterCount > 1 ? `<span class="marker-cluster-badge">${clusterCount}</span>` : '';
    const isExp = efeIsExpansionProject(proj);
    const typeSvg = isExp ? EFE_TRAIN_SVG : EFE_UPGRADE_SVG;
    const typeColor = efeGetProjectColor(proj, 'default');

    const el = document.createElement('div');
    el.className = 'polygon-centroid-marker catlec-gl-marker';
    el.innerHTML = isMiniDot
        ? `<div class="centroid-marker-pulse" style="background-color: ${typeColor}; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #ffffff; box-shadow: 0 0 4px rgba(0,0,0,0.3); margin: 8px;">${badgeHtml}</div>`
        : `<div class="centroid-marker-pulse" style="background-color: ${typeColor};">${typeSvg}${badgeHtml}</div>`;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center', subpixelPositioning: true }).setLngLat(lngLat);
    marker.projectName = proj.name;
    marker.projectFilial = proj.filial || 'Sin filial específica';
    marker.projectType = proj.type || '';
    marker.projectColor = typeColor;
    marker.isExpansion = isExp;

    const tooltipColor = isExp ? '#1e9952' : '#d92534';
    marker.tooltipHtml = clusterCount > 1
        ? `<strong>${clusterCount} proyectos en este lugar</strong>`
        : `<strong>${proj.name}</strong><br><span style="color:${tooltipColor};font-size:0.72rem;font-weight:600;">Tipo: ${proj.type || '—'}</span><br><span style="color:#94a3b8;font-size:0.68rem;">${proj.filial || 'Red General'}</span>`;
    // Interfaz que usa efeApplyMarkerState para actualizar el contenido del tooltip
    marker.setTooltipContent = (html) => {
        marker.tooltipHtml = html;
        efeTooltip.update('marker:' + marker.projectName, html);
    };

    return marker;
}

// ─── Encuadres y vuelos ──────────────────────────────────────────────────────
function efeGetProjectsExtentBounds() {
    const all = [];
    Object.values(efeShapeGeometries).forEach(arr => arr.forEach(f => all.push(f)));
    return CatlecMapGL.boundsOfFeatures(all);
}

function efeGetOperatingLinesBounds() {
    const allLines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
    return CatlecMapGL.boundsOfFeatures(efeFeaturesOfCods(allLines.flatMap(l => l.shapes || [])));
}

function efeApplyDefaultMapView(animate = false) {
    if (!efeMap) return;
    const extent = efeGetProjectsExtentBounds();
    if (extent) {
        efeMap.fitBounds(extent, { padding: 40, maxZoom: 10 - CatlecMapGL.ZOOM_OFFSET, duration: animate ? 450 : 0 });
    } else {
        efeMap.jumpTo({ center: EFE_DEFAULT_CENTER, zoom: EFE_DEFAULT_ZOOM });
    }
}
window.efeApplyDefaultMapView = efeApplyDefaultMapView;

// Vuelo diferido tras el repintado: efeSelectProject aún debe restilizar el
// mapa y refrescar tabla/KPIs, y ese trabajo no debe comerse los primeros cuadros
function efeFlyToFeatures(features) {
    const bounds = CatlecMapGL.boundsOfFeatures(features);
    CatlecUtils.afterNextPaint(() => CatlecMapGL.flyToBounds(efeMap, bounds, { onDefaultView: () => efeApplyDefaultMapView(true) }));
}

function efeZoomToProject(proj) {
    if (!efeMap || !proj) return;

    if (efeIsNationalProject(proj)) {
        const allLines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
        const lineFeatures = efeFeaturesOfCods(allLines.flatMap(l => l.shapes || []));
        if (lineFeatures.length > 0) {
            efeFlyToFeatures(lineFeatures);
            return;
        }
    }

    const isNacional = (!proj.shapes || proj.shapes.length === 0) ||
        (proj.filial && String(proj.filial).toLowerCase().includes('nacional'));
    if (isNacional) {
        efeApplyDefaultMapView(true);
        return;
    }

    efeFlyToFeatures(efeFeaturesOfCods(proj.shapes));
}

function efeZoomToOperatingLine(lineName) {
    if (!efeMap || !lineName) return;
    const lines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
    const lineObj = lines.find(l => l.service === lineName);
    if (!lineObj || !lineObj.shapes || lineObj.shapes.length === 0) {
        efeApplyDefaultMapView(true);
        return;
    }
    efeFlyToFeatures(efeFeaturesOfCods(lineObj.shapes));
}
window.efeZoomToOperatingLine = efeZoomToOperatingLine;

// ─── Leyenda (control de MapLibre, abajo a la izquierda) ─────────────────────
function efeAddMapLegend() {
    if (!efeMap) return;

    const html = `
        <div class="catlec-map-legend-title">Leyenda</div>
        <label class="efe-legend-item efe-legend-toggleable" for="efe-toggle-efe-lines" title="Activar/desactivar líneas de pasajeros EFE">
            <input type="checkbox" id="efe-toggle-efe-lines" class="efe-legend-checkbox" ${efeShowEfeLines ? 'checked' : ''}>
            <span class="efe-legend-color-line" style="background-color: #0f3b6c; box-shadow: 0 0 4px rgba(15, 59, 108, 0.45);"></span>
            <span>Línea de pasajeros EFE</span>
        </label>
        <label class="efe-legend-item efe-legend-toggleable" for="efe-toggle-metro-lines" title="Activar/desactivar líneas de Metro de Santiago">
            <input type="checkbox" id="efe-toggle-metro-lines" class="efe-legend-checkbox" ${efeShowMetroLines ? 'checked' : ''}>
            <span class="efe-legend-color-line" style="background-color: #c53030;"></span>
            <span>Líneas Metro de Santiago</span>
        </label>
        <label class="efe-legend-item efe-legend-toggleable" for="efe-toggle-projects" title="Activar/desactivar todos los proyectos">
            <input type="checkbox" id="efe-toggle-projects" class="efe-legend-checkbox" ${efeShowProjects ? 'checked' : ''}>
            <span class="efe-legend-icon-badge" style="background-color: #1e9952;">
                ${EFE_TRAIN_SVG}
            </span>
            <span>Proyectos Expansión</span>
        </label>
        <div class="efe-legend-item efe-legend-subitem" style="padding-left: 1.25rem; ${efeShowProjects ? '' : 'opacity: 0.4;'}">
            <span class="efe-legend-icon-badge" style="background-color: #d92534;">
                ${EFE_UPGRADE_SVG}
            </span>
            <span>Mejoramiento y Renovación</span>
        </div>
    `;

    CatlecMapGL.addLegendControl(efeMap, {
        html,
        storageKey: 'catlec.efe.legendCollapsed',
        onMount: (div) => {
            div.querySelector('#efe-toggle-efe-lines').addEventListener('change', (e) => efeToggleEfeLines(e.target.checked));
            div.querySelector('#efe-toggle-metro-lines').addEventListener('change', (e) => efeToggleMetroLines(e.target.checked));
            div.querySelector('#efe-toggle-projects').addEventListener('change', (e) => efeToggleProjects(e.target.checked));
        }
    });
}
