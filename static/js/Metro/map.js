// Constantes de encuadre y zoom por defecto para Metro de Santiago (+0.5 de zoom)
const METRO_DEFAULT_CENTER = [-33.4900, -70.6600];
const METRO_DEFAULT_ZOOM = 11.5;

function metroApplyDefaultMapView(animate = false) {
    if (!metroMap) return;
    metroMap.setView(METRO_DEFAULT_CENTER, METRO_DEFAULT_ZOOM, { animate: animate });
}

function metroCloseAllTooltips() {
    if (!metroMap) return;
    try {
        if (metroExpansionLayer && typeof metroExpansionLayer.eachLayer === 'function') {
            metroExpansionLayer.eachLayer(l => {
                if (l && typeof l.closeTooltip === 'function') {
                    l.closeTooltip();
                }
            });
        }
        if (Array.isArray(metroProjectMarkers)) {
            metroProjectMarkers.forEach(m => {
                if (m && typeof m.closeTooltip === 'function') {
                    m.closeTooltip();
                }
            });
        }
        const tipPane = metroMap.getPane('tooltipPane');
        if (tipPane) {
            tipPane.innerHTML = '';
        }
    } catch (e) {
        console.warn('metroCloseAllTooltips error:', e);
    }
}
window.metroCloseAllTooltips = metroCloseAllTooltips;

function metroInitLeafletMap() {
    const mapContainer = document.getElementById('metro-map');
    if (!mapContainer || metroMap) return;

    // Inicializar mapa centrado con soporte para zoom fraccional (zoomSnap: 0.5)
    metroMap = L.map('metro-map', {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5
    }).setView(METRO_DEFAULT_CENTER, METRO_DEFAULT_ZOOM);

    // Light CartoDB tile layer con API key oficial (idéntica a EFE.html)
    metroTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2j8c_1_dacb4df364cf092be679e47d', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(metroMap);

    // Panes específicos para trazados de expansión (zIndex 500) y estaciones (zIndex 550) sobre líneas operativas (400)
    metroMap.createPane('metroExpansionPane');
    metroMap.getPane('metroExpansionPane').style.zIndex = 500;

    metroMap.createPane('metroStationsPane');
    metroMap.getPane('metroStationsPane').style.zIndex = 550;

    // Deseleccionar al hacer clic en el fondo del mapa
    metroMap.on('click', () => {
        metroState.selectedProjectName = null;
        metroState.selectedProjectId = null;
        metroState.hoveredProjectName = null;
        metroState.hoveredProjectId = null;
        metroState.selectedOperatingLine = null;
        metroState.hoveredOperatingLine = null;
        metroState.selectedComuna = null;
        if (typeof metroUpdateSideComunasTableSelection === 'function') {
            metroUpdateSideComunasTableSelection();
        }
        metroCloseAllTooltips();
        metroProjectMarkers.forEach(m => {
            if (m.clusterState) m.clusterState.isClickedDeployed = false;
        });
        if (typeof metroSelectProject === 'function') {
            metroSelectProject(null);
        }
        if (typeof metroUpdateOperatingLinesTableSelection === 'function') {
            metroUpdateOperatingLinesTableSelection();
        }
        metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : (window.METRO_DATA ? window.METRO_DATA.data : []));
    });

    // Limpiar hover y cerrar tooltips rezagados al mover el cursor por el fondo del mapa
    metroMap.on('mousemove', (e) => {
        const target = e.originalEvent && e.originalEvent.target;
        const isInteractivePathOrMarker = target && (
            (target.tagName === 'path' && target.classList && target.classList.contains('leaflet-interactive')) ||
            (target.closest && (target.closest('.leaflet-marker-icon') || target.closest('.leaflet-tooltip')))
        );

        if (!isInteractivePathOrMarker) {
            if (metroState.hoveredProjectName) {
                const wasHovered = metroState.hoveredProjectName;
                metroState.hoveredProjectName = null;
                if (metroState.selectedProjectName !== wasHovered) {
                    metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : (window.METRO_DATA ? window.METRO_DATA.data : []));
                }
            }
            metroCloseAllTooltips();
        }
    });

    mapContainer.addEventListener('mouseleave', () => {
        if (metroState.hoveredProjectName) {
            const wasHovered = metroState.hoveredProjectName;
            metroState.hoveredProjectName = null;
            if (metroState.selectedProjectName !== wasHovered) {
                metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : (window.METRO_DATA ? window.METRO_DATA.data : []));
            }
        }
        metroCloseAllTooltips();
    });

    // Re-render leg lines y visibilidad en zoom
    metroMap.on('zoomend moveend zoom', () => {
        if (metroClusterLegLayers.length > 0) {
            metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : (window.METRO_DATA ? window.METRO_DATA.data : []));
        }
        metroUpdateStationsVisibility();
    });

    metroLoadMapLayers();
}

function metroGetLineColor(refOrName) {
    const s = String(refOrName || '').toLowerCase();
    if (s.includes('1') && !s.includes('13') && !s.includes('14')) return '#d7141a'; // L1
    if (s.includes('2')) return '#ffc72c'; // L2
    if (s.includes('3')) return '#6d3b14'; // L3
    if (s.includes('4a')) return '#00a3e0'; // L4A
    if (s.includes('4')) return '#0047ba'; // L4
    if (s.includes('5')) return '#00843d'; // L5
    if (s.includes('6')) return '#7b1fa2'; // L6
    if (s.includes('7')) return '#00bcd4'; // L7
    if (s.includes('8')) return '#f97316'; // L8
    if (s.includes('9')) return '#8b5cf6'; // L9
    if (s.includes('a')) return '#0284c7'; // L-A
    return '#64748b';
}

function metroNormalizeText(str) {
    return String(str || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
if (typeof window !== 'undefined') window.metroNormalizeText = metroNormalizeText;

// Referencias dinámicas a diccionarios poblados desde Excel en state.js
var METRO_COMBINATION_LINE_MAP = window.METRO_COMBINATION_LINE_MAP || {};
var METRO_COMBINATION_STATIONS = window.METRO_COMBINATION_STATIONS || new Set();
var METRO_STATION_LINE_MAP = window.METRO_STATION_LINE_MAP || {};


function metroGetStationStyle(feature) {
    const p = (feature && feature.properties) || {};
    const stInfo = (typeof metroFindStation === 'function') ? metroFindStation(feature) : null;
    const rawName = String((stInfo && stInfo.name) || p.name || '').trim();
    const clean = typeof metroNormalizeText === 'function' ? metroNormalizeText(rawName) : rawName.toLowerCase().trim();

    // 1. Verificar si es estación de combinación (estrictamente según el Excel: columna de combinación o combinación futura)
    let isComb = false;
    let hasFutureComb = false;

    if (stInfo) {
        isComb = !!stInfo.is_combination;
        hasFutureComb = Boolean(
            (Array.isArray(stInfo.future_combination) && stInfo.future_combination.length > 0) ||
            (typeof stInfo.future_combination === 'string' && stInfo.future_combination.trim() && stInfo.future_combination.trim() !== 'nan' && stInfo.future_combination.trim() !== 'None') ||
            (stInfo.future_combination_str && stInfo.future_combination_str.trim() && stInfo.future_combination_str.trim() !== 'nan' && stInfo.future_combination_str.trim() !== 'None')
        );
    } else {
        isComb = !!p.is_combination;
        hasFutureComb = Boolean(
            p.future_combination || p.combinacion ||
            (typeof p.future_combination === 'string' && p.future_combination.trim() && p.future_combination.trim() !== 'nan' && p.future_combination.trim() !== 'None')
        );
    }

    const isAnyCombination = isComb || hasFutureComb;

    if (isAnyCombination) {
        return {
            isCombination: true,
            hasFutureCombination: hasFutureComb,
            line: 'Combinación',
            color: '#0f172a',
            fillColor: '#ffffff',
            radius: 4.5,
            weight: 2.0,
            opacity: 1.0,
            fillOpacity: 1.0
        };
    }

    // 2. Estación regular: obtener línea y color oficial desde Excel
    const lineName = (stInfo && stInfo.line) || p.linea || p.line || 'Línea 2';
    const excelColor = (stInfo && (stInfo.color_hex || stInfo.color)) || p.color || (window.METRO_LINE_COLORS && window.METRO_LINE_COLORS[lineName]) || metroGetLineColor(lineName);

    return {
        isCombination: false,
        hasFutureCombination: false,
        line: lineName,
        color: '#ffffff',
        fillColor: excelColor,
        radius: 3.5,
        weight: 1.2,
        opacity: 1.0,
        fillOpacity: 1.0
    };
}

function metroStationServesLine(stationOrFeature, targetLineName) {
    if (!targetLineName || !stationOrFeature) return false;
    const targetNorm = typeof metroNormalizeText === 'function' ? metroNormalizeText(targetLineName) : targetLineName.toLowerCase().trim();
    const targetRef = targetNorm.replace(/^linea\s*/, '').trim();

    function lineMatches(candidateLine) {
        if (!candidateLine) return false;
        const candNorm = typeof metroNormalizeText === 'function' ? metroNormalizeText(candidateLine) : String(candidateLine).toLowerCase().trim();
        const candRef = candNorm.replace(/^linea\s*/, '').trim();

        if (targetRef === '4a') {
            return candRef === '4a' || candNorm.includes('4a');
        }
        if (targetRef === '4') {
            return (candRef === '4' || candNorm === 'linea 4') && candRef !== '4a' && !candNorm.includes('4a');
        }

        if (candNorm === targetNorm) return true;
        if (candRef && targetRef && candRef === targetRef) return true;
        return candNorm.includes(targetNorm) || targetNorm.includes(candNorm);
    }

    let stInfo = null;
    let featProps = null;
    let stationName = '';

    if (typeof stationOrFeature === 'object') {
        featProps = stationOrFeature.properties || stationOrFeature;
        stInfo = (typeof metroFindStation === 'function') ? metroFindStation(stationOrFeature) : null;
        stationName = (stInfo && stInfo.name) || featProps.name || '';
    } else {
        stationName = String(stationOrFeature).trim();
        stInfo = (typeof metroFindStation === 'function') ? metroFindStation(stationName, targetLineName) : null;
    }

    // A. Si se resolvió estación exacta en el Excel (por shape_id o composite key)
    if (stInfo) {
        if (stInfo.lines && Array.isArray(stInfo.lines)) {
            if (stInfo.lines.some(lineMatches)) return true;
        }
        if (stInfo.line && lineMatches(stInfo.line)) return true;
        if (stInfo.future_combination) {
            if (Array.isArray(stInfo.future_combination) && stInfo.future_combination.some(lineMatches)) return true;
            if (typeof stInfo.future_combination === 'string' && lineMatches(stInfo.future_combination)) return true;
        }
        if (stInfo.future_combination_str && lineMatches(stInfo.future_combination_str)) return true;
    }

    // B. Si hay propiedades directas del feature
    if (featProps) {
        if (featProps.lines && Array.isArray(featProps.lines)) {
            if (featProps.lines.some(lineMatches)) return true;
        }
        if (featProps.linea && lineMatches(featProps.linea)) return true;
        if (featProps.line && lineMatches(featProps.line)) return true;
        const futComb = featProps.future_combination || featProps.combinacion;
        if (futComb) {
            if (Array.isArray(futComb) && futComb.some(lineMatches)) return true;
            if (typeof futComb === 'string' && lineMatches(futComb)) return true;
        }
    }

    // C. Fallback por nombre en mapas globales
    const clean = typeof metroNormalizeText === 'function' ? metroNormalizeText(stationName) : stationName.toLowerCase().trim();
    const combLineMap = window.METRO_COMBINATION_LINE_MAP || METRO_COMBINATION_LINE_MAP;
    if (combLineMap && combLineMap[clean]) {
        if (Array.isArray(combLineMap[clean]) && combLineMap[clean].some(lineMatches)) return true;
        if (typeof combLineMap[clean] === 'string' && lineMatches(combLineMap[clean])) return true;
    }
    const stationLineMap = window.METRO_STATION_LINE_MAP || METRO_STATION_LINE_MAP;
    if (stationLineMap && stationLineMap[clean]) {
        if (lineMatches(stationLineMap[clean])) return true;
    }
    return false;
}
if (typeof window !== 'undefined') window.metroStationServesLine = metroStationServesLine;

function metroStationBelongsToProject(stationOrFeature, targetProjId) {
    if (!targetProjId || !stationOrFeature) return false;
    const normProjId = String(targetProjId).trim().toUpperCase();
    const p = (stationOrFeature.properties || stationOrFeature);

    // 1. Verificación directa en propiedades del feature GeoJSON
    if (Array.isArray(p.project_ids)) {
        if (p.project_ids.some(id => String(id).trim().toUpperCase() === normProjId)) return true;
    }
    if (p.project_id && typeof p.project_id === 'string') {
        const ids = p.project_id.split(',').map(s => s.trim().toUpperCase());
        if (ids.includes(normProjId)) return true;
    }

    // 2. Fallback buscando en METRO_DATA.stations (cargado desde Excel)
    if (window.METRO_DATA && Array.isArray(window.METRO_DATA.stations)) {
        const shapeId = String(p.shape_id || stationOrFeature.id || p['@id'] || '').trim();
        const stName = String(p.name || '').trim().toLowerCase();
        const st = window.METRO_DATA.stations.find(s => 
            (shapeId && s.shape_id === shapeId) ||
            (s.name && s.name.toLowerCase() === stName)
        );
        if (st) {
            if (Array.isArray(st.project_ids) && st.project_ids.some(id => String(id).trim().toUpperCase() === normProjId)) {
                return true;
            }
            if (st.project_id && typeof st.project_id === 'string') {
                const ids = st.project_id.split(',').map(s => s.trim().toUpperCase());
                if (ids.includes(normProjId)) return true;
            }
        }
    }

    return false;
}
if (typeof window !== 'undefined') window.metroStationBelongsToProject = metroStationBelongsToProject;

function metroIsLineMatch(feature, targetLineName) {
    if (!targetLineName || !feature) return false;
    const p = feature.properties || {};
    const normTarget = metroNormalizeText(targetLineName);
    const targetRef = normTarget.replace(/^linea\s*/, '').trim();

    const featName = metroNormalizeText(p.name || '');
    const featRef = metroNormalizeText(p.ref || '');

    // Partición estricta entre Línea 4 y Línea 4A
    if (targetRef === '4a') {
        return featRef === '4a' || featName.includes('4a');
    }
    if (targetRef === '4') {
        return (featRef === '4' || featName === 'linea 4') && featRef !== '4a' && !featName.includes('4a');
    }

    if (featName === normTarget) return true;
    if (featRef === targetRef) return true;

    return featName.includes(normTarget) || (featRef && featRef === targetRef);
}
if (typeof window !== 'undefined') window.metroIsLineMatch = metroIsLineMatch;

function metroLoadMapLayers() {
    if (!metroMap) return;

    const projects = (window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : [];

    // Mapear COD -> lista de proyectos
    metroShapeToProjects = {};
    projects.forEach(proj => {
        if (proj.shapes && Array.isArray(proj.shapes)) {
            proj.shapes.forEach(cod => {
                const sCod = String(cod);
                if (!metroShapeToProjects[sCod]) {
                    metroShapeToProjects[sCod] = [];
                }
                metroShapeToProjects[sCod].push(proj);
            });
        }
    });

    // 0. Capa de Comunas del Gran Santiago (Límites y Cobertura Territorial)
    metroLoadComunasLayer();

    // 1. Capa de Red Actual de Metro (Líneas en Servicio 1, 2, 3, 4, 4A, 5, 6)
    window.metroOperatingLineLayers = {};
    if (window.METRO_EXISTING_LINES && window.METRO_EXISTING_LINES.features) {
        metroExistingLinesLayer = L.geoJSON(window.METRO_EXISTING_LINES, {
            style: function (feature) {
                const p = feature.properties || {};
                const lineName = p.name || p.ref || '';
                const color = metroGetLineColor(lineName);
                return {
                    color: color,
                    weight: 3.5,
                    opacity: 0.85,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dashArray: null
                };
            },
            onEachFeature: function (feature, layer) {
                const p = feature.properties || {};
                const name = p.name || `Línea ${p.ref || ''}`;
                const rawRef = String(p.ref || '').toLowerCase();
                const key = String(p.name || rawRef).toLowerCase();

                if (!window.metroOperatingLineLayers[key]) {
                    window.metroOperatingLineLayers[key] = [];
                }
                window.metroOperatingLineLayers[key].push(layer);

                // Normalizar claves comunes (ej: 'línea 1', 'l1', '1')
                const numOnly = rawRef.replace(/[^0-9a-z]/g, '');
                if (numOnly) {
                    if (!window.metroOperatingLineLayers[numOnly]) window.metroOperatingLineLayers[numOnly] = [];
                    window.metroOperatingLineLayers[numOnly].push(layer);
                }

                layer.bindTooltip(`<strong>${name}</strong><br><span style="font-size:10.5px;color:#38bdf8;">Red Metro de Santiago</span>`, {
                    sticky: true,
                    className: 'catlec-map-tooltip'
                });

                layer.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (typeof metroOnClickOperatingLine === 'function') {
                        metroOnClickOperatingLine(name);
                    }
                });
            }
        }).addTo(metroMap);
    }

    // 2. Capa de Estaciones Existentes de Metro
    if (window.METRO_EXISTING_STATIONS && window.METRO_EXISTING_STATIONS.features) {
        metroExistingStationsLayer = L.geoJSON(window.METRO_EXISTING_STATIONS, {
            pane: 'metroStationsPane',
            pointToLayer: function (feature, latlng) {
                const style = metroGetStationStyle(feature);
                return L.circleMarker(latlng, {
                    pane: 'metroStationsPane',
                    radius: style.radius,
                    fillColor: style.fillColor,
                    color: style.color,
                    weight: style.weight,
                    opacity: style.opacity,
                    fillOpacity: style.fillOpacity
                });
            },
            onEachFeature: function (feature, layer) {
                const p = feature.properties || {};
                const stInfo = (typeof metroFindStation === 'function') ? metroFindStation(feature) : null;
                const name = (stInfo && stInfo.name) || p.name || 'Estación de Metro';
                const style = metroGetStationStyle(feature);

                let badge = '';
                const comuna = (stInfo && (stInfo.commune || (stInfo.communes && stInfo.communes.join(', ')))) || p.comuna || '';
                const servedLines = (stInfo && stInfo.lines) || p.lines || [style.line];
                const futCombStr = (stInfo && (stInfo.future_combination_str || (Array.isArray(stInfo.future_combination) ? stInfo.future_combination.join(', ') : stInfo.future_combination))) || p.future_combination || '';

                let lineText = '';
                let lineColor = style.fillColor || '#60a5fa';
                if (style.isCombination) {
                    let combLabel = 'Combinación';
                    if (servedLines.length > 1) {
                        combLabel += ` [${servedLines.map(l => l.replace('Línea ', 'L')).join('/')}]`;
                    }
                    if (futCombStr) {
                        combLabel += ` + Fut. [${futCombStr.replace(/Línea\s*/g, 'L')}]`;
                    }
                    lineText = combLabel;
                    lineColor = '#60a5fa';
                } else {
                    lineText = style.line;
                }

                const lineHtml = `<span style="color:#38bdf8;font-size:0.72rem;font-weight:600;">${lineText}</span>`;
                const comunaHtml = comuna
                    ? `<br><span style="color:#94a3b8;font-size:0.68rem;">${comuna}</span>`
                    : `<br><span style="color:#94a3b8;font-size:0.68rem;">Red Metro de Santiago</span>`;

                layer.bindTooltip(`<strong>${name}</strong><br>${lineHtml}${comunaHtml}`, {
                    direction: 'top',
                    offset: [0, -4],
                    sticky: true,
                    className: 'catlec-map-tooltip'
                });

                layer.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                });
            }
        });

        // Visibilidad de estaciones condicionada al zoom (visible desde el zoom inicial de la web: zoom 12)
        metroMap.on('zoomend moveend zoom', metroUpdateStationsVisibility);
        metroUpdateStationsVisibility();
    }

    // 2b. Capa de Nuevas Estaciones Futuras de Metro (Líneas 7, 8, 9 y Línea A)
    if (window.METRO_FUTURO_STATIONS && window.METRO_FUTURO_STATIONS.features) {
        metroFuturoStationsLayer = L.geoJSON(window.METRO_FUTURO_STATIONS, {
            pane: 'metroStationsPane',
            pointToLayer: function (feature, latlng) {
                const style = metroGetStationStyle(feature);
                return L.circleMarker(latlng, {
                    pane: 'metroStationsPane',
                    radius: style.radius,
                    fillColor: style.fillColor,
                    color: style.color,
                    weight: style.weight,
                    opacity: style.opacity,
                    fillOpacity: style.fillOpacity
                });
            },
            onEachFeature: function (feature, layer) {
                const p = feature.properties || {};
                const stInfo = (typeof metroFindStation === 'function') ? metroFindStation(feature) : null;
                const name = (stInfo && stInfo.name) || p.name || 'Estación Futura';
                const style = metroGetStationStyle(feature);
                const lineName = (stInfo && stInfo.line) || p.linea || 'Línea Futura';
                const lineColor = (stInfo && (stInfo.color_hex || stInfo.color)) || p.color || (typeof METRO_LINE_COLORS !== 'undefined' && METRO_LINE_COLORS[lineName]) || '#52525b';
                const ubicacion = p.ubicacion || '';
                const comuna = (stInfo && (stInfo.commune || (stInfo.communes && stInfo.communes.join(', ')))) || p.comuna || '';
                const futCombStr = (stInfo && (stInfo.future_combination_str || (Array.isArray(stInfo.future_combination) ? stInfo.future_combination.join(', ') : stInfo.future_combination))) || p.combinacion || '';
                const inauguracion = (stInfo && stInfo.inauguration)
                    ? `(est. ${stInfo.inauguration})`
                    : (p.inauguracion ? `(est. ${p.inauguracion})` : '');
                let lineText = '';
                let displayColor = lineColor;
                if (style.isCombination) {
                    const badgeText = futCombStr ? `Combinación [${futCombStr.replace(/Línea\s*/g, 'L')}]` : 'Combinación';
                    lineText = badgeText;
                    displayColor = '#60a5fa';
                } else {
                    lineText = `${lineName}${inauguracion ? ' ' + inauguracion : ''}`;
                }

                const lineHtml = `<span style="color:${displayColor};font-size:0.72rem;font-weight:600;">${lineText}</span>`;
                const locationHtml = (ubicacion || comuna)
                    ? `<br><span style="color:#94a3b8;font-size:0.68rem;">${ubicacion ? ubicacion + ' · ' : ''}${comuna}</span>`
                    : '';
                const combHtml = (futCombStr && !style.isCombination)
                    ? `<br><span style="color:#38bdf8;font-size:0.68rem;font-weight:600;">Comb.: ${futCombStr}</span>`
                    : '';

                layer.bindTooltip(`<strong>${name}</strong><br>${lineHtml}${locationHtml}${combHtml}`, {
                    direction: 'top',
                    offset: [0, -4],
                    sticky: true,
                    className: 'catlec-map-tooltip'
                });

                layer.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                });
            }
        });
    }

    // 3. Capa de Futuros Trazados de Proyectos de Expansión (Verde corporativo idéntico a EFE.html)
    metroShapeGeometries = {};
    if (window.METRO_GEO_DATA && window.METRO_GEO_DATA.features) {
        metroExpansionLayer = L.geoJSON(window.METRO_GEO_DATA, {
            pane: 'metroExpansionPane',
            style: function (feature) {
                const props = (feature && feature.properties) ? feature.properties : {};
                const cod = (props.shape_id != null && String(props.shape_id).trim() !== '')
                    ? String(props.shape_id).trim()
                    : (props.COD != null ? String(props.COD).trim() : (props['@id'] || ''));
                const projs = metroShapeToProjects[cod] || [];
                const proj = projs[0] || props;
                const col = (typeof metroGetProjectColor === 'function')
                    ? metroGetProjectColor(proj.line || proj.linea || props.color)
                    : (props.color || '#52525b');
                return {
                    color: col,
                    weight: 4.0,
                    opacity: 0.90,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dashArray: null
                };
            },
            onEachFeature: function (feature, layer) {
                const props = feature.properties || {};
                const cod = (props.shape_id != null && String(props.shape_id).trim() !== '')
                    ? String(props.shape_id).trim()
                    : (props.COD != null ? String(props.COD).trim() : (props['@id'] || ''));

                if (cod) {
                    if (!metroShapeGeometries[cod]) {
                        metroShapeGeometries[cod] = [];
                    }
                    metroShapeGeometries[cod].push(layer);
                }

                const projs = metroShapeToProjects[cod] || [];
                const projName = projs.length > 0 ? projs[0].name : props.name;
                const projStage = projs.length > 0 ? projs[0].stage : 'En desarrollo';
                const projLine = projs.length > 0 ? projs[0].line : props.linea;
                const projCol = (typeof metroGetProjectColor === 'function') ? metroGetProjectColor(projLine) : (props.color || '#52525b');

                const tooltipContent = `<strong>${projName}</strong><br><span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">Etapa: ${projStage || 'En desarrollo'}</span><br><span style="color:#94a3b8;font-size:0.68rem;">${projLine || 'Metro de Santiago'}</span>`;
                layer.bindTooltip(tooltipContent, { sticky: true, className: 'catlec-map-tooltip' });

                layer.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (layer.closeTooltip) layer.closeTooltip();
                    metroCloseAllTooltips();
                    if (projs.length > 0 && typeof metroSelectProject === 'function') {
                        metroSelectProject(projs[0]);
                    }
                });

                layer.on('mouseover', () => {
                    if (projs.length > 0) {
                        const pName = projs[0].name;
                        // Si el proyecto ya está seleccionado, no reordenar DOM ni re-aplicar estilos para no romper eventos de puntero
                        if (metroState.selectedProjectName === pName) {
                            metroState.hoveredProjectName = pName;
                            return;
                        }
                        if (metroState.hoveredProjectName !== pName) {
                            metroState.hoveredProjectName = pName;
                            metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : projects);
                        }
                    }
                });

                layer.on('mouseout', () => {
                    if (layer.closeTooltip) {
                        layer.closeTooltip();
                    }
                    // Cerrar tooltips en todas las capas del mismo proyecto (clave para Línea 6 Poniente, Línea 7 y Línea 8)
                    if (projs.length > 0) {
                        const pName = projs[0].name;
                        const pObj = (window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data.find(p => p.name === pName) : null;
                        if (pObj && pObj.shapes) {
                            pObj.shapes.forEach(sid => {
                                const sibLayers = metroShapeGeometries[String(sid)] || [];
                                sibLayers.forEach(sl => {
                                    if (sl && sl.closeTooltip) sl.closeTooltip();
                                });
                            });
                        }
                    }
                    metroCloseAllTooltips();
                    if (metroState.hoveredProjectName) {
                        const wasHovered = metroState.hoveredProjectName;
                        metroState.hoveredProjectName = null;
                        if (metroState.selectedProjectName !== wasHovered) {
                            metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : projects);
                        }
                    }
                });
            }
        });
        if (metroShowProjects) {
            metroExpansionLayer.addTo(metroMap);
        }

        // Aplicar el encuadre y zoom por defecto (idéntico al botón de restablecer: zoom 11.5)
        metroApplyDefaultMapView(false);

        // Invalidar tamaño y asegurar encuadre exacto una vez que el layout DOM se estabilice
        setTimeout(() => {
            if (metroMap) {
                metroMap.invalidateSize();
                metroApplyDefaultMapView(false);
            }
        }, 120);
    }

    // 4. Renderizar marcadores SVG de proyectos en sus puntos medios
    metroRenderProjectMarkers(projects);

    metroAddMapLegend();

    // Inicializar primera carga de datos
    if (typeof metroFetchData === 'function') {
        metroFetchData();
    }
}

function metroFindOperatingLayers(lineName) {
    if (!metroExistingLinesLayer || !lineName) return [];
    const matches = [];
    metroExistingLinesLayer.eachLayer(layer => {
        if (layer.feature && metroIsLineMatch(layer.feature, lineName)) {
            matches.push(layer);
        }
    });
    return matches;
}
window.metroFindOperatingLayers = metroFindOperatingLayers;

function metroFocusOperatingLine(lineName, shouldZoom = false) {
    if (!lineName) return;
    metroState.selectedOperatingLine = lineName;
    metroState.selectedProjectName = null;
    metroState.selectedProjectId = null;

    if (shouldZoom && metroMap) {
        const layers = metroFindOperatingLayers(lineName);
        if (layers && layers.length > 0) {
            const group = L.featureGroup(layers);
            if (group.getBounds && group.getBounds().isValid()) {
                metroMap.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 13.5, animate: true });
            }
        }
    }

    if (typeof metroUpdateOperatingLinesTableSelection === 'function') {
        metroUpdateOperatingLinesTableSelection();
    }
    metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : (window.METRO_DATA ? window.METRO_DATA.data : []));
}
window.metroFocusOperatingLine = metroFocusOperatingLine;

function metroResetOperatingLine(lineName) {
    if (!metroState.selectedOperatingLine && !metroState.selectedProjectName) {
        metroState.hoveredOperatingLine = null;
        metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : (window.METRO_DATA ? window.METRO_DATA.data : []));
    }
}
window.metroResetOperatingLine = metroResetOperatingLine;

// ─── Calculador de Punto Medio (50% de distancia a lo largo del trazado) ───
function metroGetLineMidpoint(matchedLayers) {
    if (!matchedLayers || matchedLayers.length === 0) return null;

    let allSegments = [];
    matchedLayers.forEach(l => {
        if (l.getLatLngs) {
            const rawLatLngs = l.getLatLngs();
            function extractSegments(arr) {
                if (!Array.isArray(arr) || arr.length === 0) return;
                if ((typeof L.LatLng === 'function' && arr[0] instanceof L.LatLng) || (arr[0] && typeof arr[0].lat === 'number')) {
                    if (arr.length >= 2) allSegments.push(arr);
                } else {
                    arr.forEach(sub => extractSegments(sub));
                }
            }
            extractSegments(rawLatLngs);
        }
    });

    if (allSegments.length === 0) return null;

    let totalLength = 0;
    allSegments.forEach(seg => {
        for (let i = 0; i < seg.length - 1; i++) {
            totalLength += seg[i].distanceTo(seg[i + 1]);
        }
    });

    if (totalLength === 0) return allSegments[0][0];

    const halfDistance = totalLength / 2;
    let accumulated = 0;

    for (let s = 0; s < allSegments.length; s++) {
        const seg = allSegments[s];
        for (let i = 0; i < seg.length - 1; i++) {
            const p1 = seg[i];
            const p2 = seg[i + 1];
            const dist = p1.distanceTo(p2);
            if (accumulated + dist >= halfDistance) {
                const needed = halfDistance - accumulated;
                const ratio = dist > 0 ? (needed / dist) : 0;
                return L.latLng(p1.lat + (p2.lat - p1.lat) * ratio, p1.lng + (p2.lng - p1.lng) * ratio);
            }
            accumulated += dist;
        }
    }

    return allSegments[0][Math.floor(allSegments[0].length / 2)];
}

// ─── Marcadores SVG de Metro (Misma lógica y estilo de EFE.html) ─────────────
function metroCreateSubwayMarker(proj, latLng, isMiniDot = false, clusterCount = 1) {
    const badgeHtml = clusterCount > 1 ? `<span class="marker-cluster-badge">${clusterCount}</span>` : '';
    const typeSvg = METRO_SUBWAY_SVG;
    const projectColor = (typeof metroGetProjectColor === 'function')
        ? metroGetProjectColor(proj.line || proj.name)
        : (METRO_LINE_COLORS[proj.line] || '#52525b');

    let iconHtml = '';
    if (isMiniDot) {
        iconHtml = `<div class="centroid-marker-pulse" style="background-color: ${projectColor}; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #ffffff; box-shadow: 0 0 4px rgba(0,0,0,0.3); margin: 8px;">${badgeHtml}</div>`;
    } else {
        iconHtml = `<div class="centroid-marker-pulse" style="background-color: ${projectColor};">${typeSvg}${badgeHtml}</div>`;
    }

    const customIcon = L.divIcon({
        className: 'polygon-centroid-marker',
        html: iconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
    });

    const marker = L.marker(latLng, { icon: customIcon });
    marker.projectName = proj.name;
    marker.projectStage = proj.stage || proj.type || 'Proyecto de Expansión';
    marker.projectLine = proj.line || 'Metro de Santiago';
    marker.projectColor = projectColor;

    const invText = (proj.investment_mm_usd != null && Number(proj.investment_mm_usd) > 0)
        ? `US$ ${Number(proj.investment_mm_usd).toLocaleString('es-CL')} MM`
        : '—';
    const tooltipContent = clusterCount > 1
        ? `<strong>${clusterCount} proyectos en este lugar</strong>`
        : `<strong>${proj.name}</strong><br><span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">Etapa: ${marker.projectStage}</span><br><span style="color:#94a3b8;font-size:0.68rem;">${marker.projectLine}</span>`;

    marker.bindTooltip(tooltipContent, { sticky: true, className: 'catlec-map-tooltip' });

    return marker;
}

function metroRenderProjectMarkers(mapProjects) {
    if (!metroMap) return;

    // Limpiar marcadores existentes
    metroProjectMarkers.forEach(m => {
        if (m && metroMap) metroMap.removeLayer(m);
    });
    metroProjectMarkers = [];

    // Limpiar legs y origin markers previos de clusters
    metroClusterLegLayers.forEach(l => {
        if (l && metroMap) metroMap.removeLayer(l);
    });
    metroClusterLegLayers = [];

    metroClusterOriginMarkers.forEach(m => {
        if (m && metroMap) metroMap.removeLayer(m);
    });
    metroClusterOriginMarkers = [];

    if (!mapProjects || mapProjects.length === 0) return;

    const rawMarkerList = [];

    mapProjects.forEach(proj => {
        if (!proj.shapes || !Array.isArray(proj.shapes) || proj.shapes.length === 0) return;

        let matchedLayers = [];
        proj.shapes.forEach(shapeId => {
            const sid = String(shapeId).trim();
            const layersForShape = metroShapeGeometries[sid];
            if (layersForShape) matchedLayers.push(...layersForShape);
        });

        if (matchedLayers.length === 0) return;

        const lineLayers = matchedLayers.filter(l => {
            if (l.feature && l.feature.geometry && l.feature.geometry.type) {
                return l.feature.geometry.type.toLowerCase().includes('line');
            }
            return (l instanceof L.Polyline) && !(l instanceof L.Polygon);
        });

        if (lineLayers.length > 0) {
            const midpoint = metroGetLineMidpoint(lineLayers);
            if (midpoint) {
                rawMarkerList.push({ proj, latLng: midpoint, isMini: false });
            }
        }
    });

    // Agrupar marcadores por proximidad geográfica (< 0.0008, ~80 metros)
    const clusters = [];
    rawMarkerList.forEach(item => {
        let placed = false;
        for (let c of clusters) {
            const center = c[0].latLng;
            if (Math.abs(center.lat - item.latLng.lat) < 0.0008 && Math.abs(center.lng - item.latLng.lng) < 0.0008) {
                c.push(item);
                placed = true;
                break;
            }
        }
        if (!placed) {
            clusters.push([item]);
        }
    });

    clusters.forEach(cluster => {
        const N = cluster.length;
        const R = 22;
        const clusterMarkers = [];
        const clusterState = { isClickedDeployed: false };

        cluster.forEach((item, k) => {
            const marker = metroCreateSubwayMarker(item.proj, item.latLng, item.isMini, N);
            if (!marker) return;

            marker.clusterState = clusterState;

            if (N > 1) {
                const angle = (2 * Math.PI * k) / N - Math.PI / 2;
                marker.clusterDx = Math.round(R * Math.cos(angle));
                marker.clusterDy = Math.round(R * Math.sin(angle));
            } else {
                marker.clusterDx = 0;
                marker.clusterDy = 0;
            }

            clusterMarkers.push(marker);
            metroProjectMarkers.push(marker);
        });

        clusterMarkers.forEach(m => {
            m.clusterMembers = clusterMarkers;

            m.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                if (N > 1 && !clusterState.isClickedDeployed) {
                    clusterState.isClickedDeployed = true;
                    metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : mapProjects);
                } else {
                    const allP = (window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : [];
                    const proj = allP.find(p => p.name === m.projectName);
                    clusterState.isClickedDeployed = false;
                    if (proj && typeof metroSelectProject === 'function') {
                        metroSelectProject(proj);
                    }
                }
            });

            m.on('mouseover', () => {
                if (metroState.selectedProjectName === m.projectName) {
                    metroState.hoveredProjectName = m.projectName;
                    return;
                }
                if (metroState.hoveredProjectName !== m.projectName) {
                    metroState.hoveredProjectName = m.projectName;
                    metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : mapProjects);
                }
            });

            m.on('mouseout', () => {
                if (m.closeTooltip) {
                    m.closeTooltip();
                }
                metroCloseAllTooltips();
                if (metroState.hoveredProjectName) {
                    const wasH = metroState.hoveredProjectName;
                    metroState.hoveredProjectName = null;
                    if (metroState.selectedProjectName !== wasH) {
                        metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : mapProjects);
                    }
                }
            });

            if (metroShowProjects) {
                m.addTo(metroMap);
            }
        });
    });
}

function metroGetComunaStyle(feature) {
    const p = (feature && feature.properties) ? feature.properties : {};
    if (p.has_metro) {
        return {
            color: '#64748b',
            weight: 1.0,
            opacity: 0.55,
            fillColor: '#10b981',
            fillOpacity: 0.05,
            dashArray: null
        };
    } else if (p.expansion_status === 'En Expansión') {
        return {
            color: '#0284c7',
            weight: 1.2,
            opacity: 0.65,
            fillColor: '#0284c7',
            fillOpacity: 0.07,
            dashArray: '4, 4'
        };
    } else {
        return {
            color: '#94a3b8',
            weight: 0.8,
            opacity: 0.35,
            fillColor: '#64748b',
            fillOpacity: 0.02,
            dashArray: null
        };
    }
}

function metroLoadComunasLayer() {
    if (!metroMap || !window.METRO_COMUNAS_GEO || !window.METRO_COMUNAS_GEO.features) return;

    metroComunasLayer = L.geoJSON(window.METRO_COMUNAS_GEO, {
        style: metroGetComunaStyle,
        onEachFeature: function (feature, layer) {
            const p = feature.properties || {};

            let statusBadge = '';
            if (p.has_metro) {
                statusBadge = '<span style="background:rgba(16,185,129,0.15);color:#059669;padding:2px 6px;border-radius:4px;font-weight:700;font-size:0.65rem;">Servicio Activo</span>';
            } else if (p.expansion_status === 'En Expansión') {
                statusBadge = '<span style="background:rgba(2,132,199,0.15);color:#0284c7;padding:2px 6px;border-radius:4px;font-weight:700;font-size:0.65rem;">En Expansión</span>';
            } else {
                statusBadge = '<span style="background:rgba(148,163,184,0.15);color:#64748b;padding:2px 6px;border-radius:4px;font-weight:700;font-size:0.65rem;">Sin Cobertura</span>';
            }

            let content = `
                <div style="font-family: inherit; font-size: 0.76rem; min-width: 175px; line-height: 1.35; padding: 2px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:4px;border-bottom:1px solid rgba(0,0,0,0.08);padding-bottom:3px;">
                        <strong style="font-size:0.84rem;color:#0f172a;">${p.comuna}</strong>
                        ${statusBadge}
                    </div>
            `;

            if (p.has_metro) {
                content += `
                    <div style="color:#059669;font-weight:700;font-size:0.75rem;margin-bottom:3px;">
                        • ${p.estaciones_count} estaciones de Metro
                    </div>
                    <div style="color:#475569;font-size:0.7rem;margin-bottom:2px;">
                        Líneas: <strong>${p.lineas && p.lineas.length ? p.lineas.join(', ') : 'Metro'}</strong>
                    </div>
                `;
                if (p.proyectos_futuros && p.proyectos_futuros.length > 0) {
                    content += `
                        <div style="margin-top:4px;padding-top:4px;border-top:1px dashed #cbd5e1;color:#0284c7;font-size:0.68rem;">
                            Proyectos futuros: <em>${p.proyectos_futuros.join(', ')}</em>
                        </div>
                    `;
                }
            } else if (p.proyectos_futuros && p.proyectos_futuros.length > 0) {
                content += `
                    <div style="color:#0284c7;font-weight:700;font-size:0.73rem;margin-bottom:3px;">
                        • Próximamente con Metro
                    </div>
                    <div style="color:#475569;font-size:0.7rem;">
                        Nuevas líneas: <strong>${p.proyectos_futuros.join(', ')}</strong>
                    </div>
                `;
            } else {
                content += `
                    <div style="color:#64748b;font-size:0.72rem;">
                        Sin red de Metro en la comuna.
                    </div>
                `;
            }
            content += `</div>`;

            // Tooltip minimalista y discreto solo con el nombre de la comuna al pasar el cursor
            layer.bindTooltip(`<strong>${p.comuna}</strong>`, {
                sticky: true,
                direction: 'top',
                className: 'metro-comuna-name-tooltip',
                opacity: 0.95
            });

            layer.on({
                mouseover: function () {
                    if (metroState.selectedComuna === p.comuna) return;
                    metroHoveredComuna = p.comuna;
                    layer.setStyle({
                        weight: 2.0,
                        color: p.has_metro ? '#059669' : (p.expansion_status === 'En Expansión' ? '#0284c7' : '#475569'),
                        fillOpacity: p.has_metro ? 0.14 : 0.08,
                        opacity: 0.95
                    });
                },
                mouseout: function () {
                    const isSelected = metroState.selectedComuna && (
                        typeof metroNormalizeText === 'function'
                            ? metroNormalizeText(metroState.selectedComuna) === metroNormalizeText(p.comuna)
                            : metroState.selectedComuna === p.comuna
                    );
                    if (isSelected) return;
                    metroHoveredComuna = null;
                    if (layer.closeTooltip) layer.closeTooltip();
                    if (metroComunasLayer) {
                        if (metroState.selectedComuna) {
                            layer.setStyle({
                                weight: 1.0,
                                color: '#94a3b8',
                                opacity: 0.25,
                                fillOpacity: 0.02
                            });
                        } else if (metroState.selectedProjectName || metroState.selectedOperatingLine) {
                            const defStyle = metroGetComunaStyle(layer.feature);
                            layer.setStyle({
                                color: defStyle.color,
                                weight: defStyle.weight,
                                fillColor: defStyle.fillColor,
                                dashArray: defStyle.dashArray,
                                opacity: 0.20,
                                fillOpacity: 0.02
                            });
                        } else {
                            metroComunasLayer.resetStyle(layer);
                        }
                    }
                },
                click: function (e) {
                    L.DomEvent.stopPropagation(e);
                    if (layer.closeTooltip) layer.closeTooltip();
                    if (typeof metroOnClickComunaFromTable === 'function') {
                        metroOnClickComunaFromTable(p.comuna);
                    }
                }
            });
        }
    });

    if (metroShowComunas) {
        metroComunasLayer.addTo(metroMap);
        if (metroComunasLayer.bringToBack) {
            metroComunasLayer.bringToBack();
        }
    }
}

function metroToggleProjects(show) {
    metroShowProjects = show;
    if (!metroMap) return;

    // 1. Capa de trazados futuros de proyectos de expansión
    if (metroExpansionLayer) {
        if (show) {
            if (!metroMap.hasLayer(metroExpansionLayer)) {
                metroMap.addLayer(metroExpansionLayer);
            }
        } else {
            if (metroMap.hasLayer(metroExpansionLayer)) {
                metroMap.removeLayer(metroExpansionLayer);
            }
        }
    }

    // 2. Marcadores centroides de proyectos
    metroProjectMarkers.forEach(m => {
        if (!m) return;
        if (show) {
            if (!metroMap.hasLayer(m)) {
                metroMap.addLayer(m);
            }
        } else {
            if (metroMap.hasLayer(m)) {
                metroMap.removeLayer(m);
            }
        }
    });

    // 3. Legs y origin markers de clusters
    metroClusterOriginMarkers.forEach(m => {
        if (!m) return;
        if (show) {
            if (!metroMap.hasLayer(m)) metroMap.addLayer(m);
        } else {
            if (metroMap.hasLayer(m)) metroMap.removeLayer(m);
        }
    });

    metroClusterLegLayers.forEach(l => {
        if (!l) return;
        if (show) {
            if (!metroMap.hasLayer(l)) metroMap.addLayer(l);
        } else {
            if (metroMap.hasLayer(l)) metroMap.removeLayer(l);
        }
    });

    // Sincronizar checkbox si fue llamado programáticamente
    const chk = document.getElementById('metro-toggle-projects');
    if (chk && chk.checked !== !!show) {
        chk.checked = !!show;
    }

    // Actualizar visibilidad de estaciones futuras vinculadas a proyectos
    metroUpdateStationsVisibility();
}
window.metroToggleProjects = metroToggleProjects;

function metroToggleComunas(show) {
    metroShowComunas = show;
    if (!metroMap || !metroComunasLayer) return;
    if (show) {
        if (!metroMap.hasLayer(metroComunasLayer)) {
            metroMap.addLayer(metroComunasLayer);
            if (metroComunasLayer.bringToBack) metroComunasLayer.bringToBack();
        }
    } else {
        if (metroMap.hasLayer(metroComunasLayer)) {
            metroMap.removeLayer(metroComunasLayer);
        }
    }
}

function metroToggleExistingLines(show) {
    metroShowExistingLines = show;
    if (!metroMap || !metroExistingLinesLayer) return;
    if (show) {
        if (!metroMap.hasLayer(metroExistingLinesLayer)) {
            metroMap.addLayer(metroExistingLinesLayer);
        }
    } else {
        if (metroMap.hasLayer(metroExistingLinesLayer)) {
            metroMap.removeLayer(metroExistingLinesLayer);
        }
    }
}

function metroToggleStations(show) {
    metroShowStations = show;
    metroUpdateStationsVisibility();
}

function metroUpdateStationsVisibility() {
    if (!metroMap) return;
    const currentZoom = metroMap.getZoom();
    const shouldShow = metroShowStations && (currentZoom >= 10);

    if (metroExistingStationsLayer) {
        if (shouldShow) {
            if (!metroMap.hasLayer(metroExistingStationsLayer)) metroMap.addLayer(metroExistingStationsLayer);
        } else {
            if (metroMap.hasLayer(metroExistingStationsLayer)) metroMap.removeLayer(metroExistingStationsLayer);
        }
    }

    if (metroFuturoStationsLayer) {
        const shouldShowFuturo = shouldShow && metroShowProjects;
        if (shouldShowFuturo) {
            if (!metroMap.hasLayer(metroFuturoStationsLayer)) metroMap.addLayer(metroFuturoStationsLayer);
        } else {
            if (metroMap.hasLayer(metroFuturoStationsLayer)) metroMap.removeLayer(metroFuturoStationsLayer);
        }
    }
}

function metroUpdateMapStyles(filteredProjects) {
    if (!metroMap) return;
    const projs = filteredProjects || (window.METRO_DATA ? window.METRO_DATA.data : []);
    const selectedName = metroState.selectedProjectName;
    const hoveredName = metroState.hoveredProjectName;
    const selectedLine = metroState.selectedOperatingLine;
    const hoveredLine = metroState.hoveredOperatingLine;

    const selP = (window.METRO_DATA && window.METRO_DATA.data)
        ? window.METRO_DATA.data.find(p => (metroState.selectedProjectId && p.id === metroState.selectedProjectId) || (selectedName && p.name === selectedName))
        : null;
    const selectedProjId = selP ? selP.id : metroState.selectedProjectId;

    const hovP = (window.METRO_DATA && window.METRO_DATA.data)
        ? window.METRO_DATA.data.find(p => (metroState.hoveredProjectId && p.id === metroState.hoveredProjectId) || (hoveredName && p.name === hoveredName))
        : null;
    const hoveredProjId = hovP ? hovP.id : metroState.hoveredProjectId;

    const visibleCods = new Set();
    projs.forEach(p => {
        if (p.shapes && Array.isArray(p.shapes)) {
            p.shapes.forEach(c => visibleCods.add(String(c)));
        }
    });

    const selectedShapes = new Set();
    if (selP && selP.shapes) {
        selP.shapes.forEach(c => selectedShapes.add(String(c)));
    }

    const hoveredShapes = new Set();
    if (hovP && hovP.shapes) {
        hovP.shapes.forEach(c => hoveredShapes.add(String(c)));
    }

    // 1. Estilos de líneas de trazado de expansión
    if (metroExpansionLayer) {
        metroExpansionLayer.eachLayer(layer => {
            const props = layer.feature ? layer.feature.properties : {};
            const cod = (props.shape_id != null && String(props.shape_id).trim() !== '')
                ? String(props.shape_id).trim()
                : (props.COD != null ? String(props.COD).trim() : (props['@id'] || ''));
            const isVisible = visibleCods.has(cod);
            const isSelected = selectedShapes.has(cod);
            const isHovered = hoveredShapes.has(cod);

            const projs = metroShapeToProjects[cod] || [];
            const proj = projs[0] || props;
            const projColor = (typeof metroGetProjectColor === 'function')
                ? metroGetProjectColor(proj.line || proj.linea || props.color)
                : (props.color || '#52525b');

            if (selectedName) {
                if (isSelected) {
                    layer.setStyle({
                        color: projColor,
                        weight: 5.5,
                        opacity: 1.0,
                        dashArray: null
                    });
                    if (layer.bringToFront) layer.bringToFront();
                } else if (isHovered) {
                    layer.setStyle({
                        color: projColor,
                        weight: 4.8,
                        opacity: 0.95,
                        dashArray: null
                    });
                } else {
                    // Dimming suave y legible conservando el tono de la línea
                    layer.setStyle({
                        color: projColor,
                        weight: 3.0,
                        opacity: 0.35,
                        dashArray: null
                    });
                }
            } else if (selectedLine) {
                // Hay una línea operativa seleccionada -> proyectos atenuados con moderación
                layer.setStyle({
                    color: projColor,
                    weight: 3.0,
                    opacity: 0.35,
                    dashArray: null
                });
            } else {
                if (isHovered) {
                    layer.setStyle({
                        color: projColor,
                        weight: 6.5,
                        opacity: 1.0,
                        dashArray: null
                    });
                    if (layer.bringToFront) layer.bringToFront();
                } else if (isVisible) {
                    layer.setStyle({
                        color: projColor,
                        weight: 4.0,
                        opacity: 0.90,
                        dashArray: null
                    });
                } else {
                    layer.setStyle({
                        color: '#cbd5e1',
                        weight: 2.2,
                        opacity: 0.25,
                        dashArray: null
                    });
                }
            }
        });
    }

    // 2. Capa de Red Actual de Metro (Líneas Operativas)
    if (metroExistingLinesLayer) {
        metroExistingLinesLayer.eachLayer(layer => {
            const feat = layer.feature || {};
            const p = feat.properties || {};
            const featLineName = p.name || `Línea ${p.ref || ''}`;
            const baseColor = metroGetLineColor(featLineName);

            if (selectedName) {
                // Proyecto seleccionado -> atenuar líneas operativas preservando su color oficial y visibilidad
                layer.setStyle({
                    color: baseColor,
                    weight: 2.5,
                    opacity: 0.40
                });
            } else if (selectedLine) {
                // Línea operativa seleccionada
                const isMatch = metroIsLineMatch(feat, selectedLine);
                if (isMatch) {
                    layer.setStyle({
                        color: baseColor,
                        weight: 6.0,
                        opacity: 1.0
                    });
                    if (layer.bringToFront) layer.bringToFront();
                } else {
                    // Demás líneas atenuadas suavemente manteniendo su color oficial
                    layer.setStyle({
                        color: baseColor,
                        weight: 2.5,
                        opacity: 0.35
                    });
                }
            } else if (hoveredLine) {
                const isMatch = metroIsLineMatch(feat, hoveredLine);
                if (isMatch) {
                    layer.setStyle({
                        color: baseColor,
                        weight: 5.5,
                        opacity: 1.0
                    });
                    if (layer.bringToFront) layer.bringToFront();
                } else {
                    layer.setStyle({
                        color: baseColor,
                        weight: 3.5,
                        opacity: 0.85
                    });
                }
            } else {
                // Normal
                layer.setStyle({
                    color: baseColor,
                    weight: 3.5,
                    opacity: 0.85
                });
            }
        });
    }

    // 3. Capa de Estaciones Existentes
    if (metroExistingStationsLayer) {
        metroExistingStationsLayer.eachLayer(layer => {
            const feat = layer.feature || {};
            const baseStyle = metroGetStationStyle(feat);
            const stationName = (feat.properties && feat.properties.name) || '';

            if (selectedProjId) {
                // Proyecto seleccionado -> resaltar si pertenece a este proyecto; atenuar en caso contrario
                const isMatch = metroStationBelongsToProject(feat, selectedProjId);
                if (isMatch) {
                    layer.setStyle({
                        opacity: 1.0,
                        fillOpacity: 1.0,
                        radius: baseStyle.isCombination ? 5.5 : 4.8,
                        weight: baseStyle.isCombination ? 2.5 : 2.0,
                        color: baseStyle.color,
                        fillColor: baseStyle.fillColor
                    });
                    if (layer.bringToFront) layer.bringToFront();
                } else {
                    layer.setStyle({
                        opacity: 0.35,
                        fillOpacity: 0.35,
                        radius: Math.max(2.8, baseStyle.radius - 0.5),
                        weight: 1.0,
                        color: baseStyle.color,
                        fillColor: baseStyle.fillColor
                    });
                }
            } else if (selectedLine) {
                // Línea operativa seleccionada -> resaltar estaciones pertenecientes a esta línea; atenuar las demás
                const servesLine = metroStationServesLine(feat, selectedLine);
                if (servesLine) {
                    layer.setStyle({
                        opacity: 1.0,
                        fillOpacity: 1.0,
                        radius: baseStyle.isCombination ? 5.5 : 4.8,
                        weight: baseStyle.isCombination ? 2.5 : 2.0,
                        color: baseStyle.color,
                        fillColor: baseStyle.fillColor
                    });
                    if (layer.bringToFront) layer.bringToFront();
                } else {
                    layer.setStyle({
                        opacity: 0.35,
                        fillOpacity: 0.35,
                        radius: Math.max(2.8, baseStyle.radius - 0.5),
                        weight: 1.0,
                        color: baseStyle.color,
                        fillColor: baseStyle.fillColor
                    });
                }
            } else if (hoveredLine) {
                const servesLine = metroStationServesLine(feat, hoveredLine);
                if (servesLine) {
                    layer.setStyle({
                        opacity: 1.0,
                        fillOpacity: 1.0,
                        radius: baseStyle.isCombination ? 5.0 : 4.0,
                        weight: baseStyle.weight,
                        color: baseStyle.color,
                        fillColor: baseStyle.fillColor
                    });
                    if (layer.bringToFront) layer.bringToFront();
                } else {
                    layer.setStyle({
                        radius: baseStyle.radius,
                        fillColor: baseStyle.fillColor,
                        color: baseStyle.color,
                        weight: baseStyle.weight,
                        opacity: baseStyle.opacity,
                        fillOpacity: baseStyle.fillOpacity
                    });
                }
            } else {
                // Estado normal
                layer.setStyle({
                    radius: baseStyle.radius,
                    fillColor: baseStyle.fillColor,
                    color: baseStyle.color,
                    weight: baseStyle.weight,
                    opacity: baseStyle.opacity,
                    fillOpacity: baseStyle.fillOpacity
                });
            }
        });
    }

    // 3b. Capa de Estaciones Futuras de Expansión (Líneas 7, 8, 9 y A)
    if (metroFuturoStationsLayer) {
        metroFuturoStationsLayer.eachLayer(layer => {
            const feat = layer.feature || {};
            const baseStyle = metroGetStationStyle(feat);
            const p = feat.properties || {};
            const lineName = p.linea || (baseStyle && baseStyle.line) || 'Línea 7';

            if (selectedProjId) {
                const isProjMatch = metroStationBelongsToProject(feat, selectedProjId);
                if (isProjMatch) {
                    layer.setStyle({
                        opacity: 1.0,
                        fillOpacity: 1.0,
                        radius: baseStyle.isCombination ? 5.5 : 4.8,
                        weight: baseStyle.isCombination ? 2.5 : 2.0,
                        color: baseStyle.color,
                        fillColor: baseStyle.fillColor
                    });
                    if (layer.bringToFront) layer.bringToFront();
                } else {
                    layer.setStyle({
                        opacity: 0.35,
                        fillOpacity: 0.35,
                        radius: 2.8,
                        weight: 1.0,
                        color: baseStyle.color,
                        fillColor: baseStyle.fillColor
                    });
                }
            } else if (selectedLine) {
                // Línea operativa seleccionada -> resaltar si combina con esta línea; de lo contrario atenuar
                const servesLine = metroStationServesLine(feat, selectedLine);
                if (servesLine) {
                    layer.setStyle({
                        opacity: 1.0,
                        fillOpacity: 1.0,
                        radius: baseStyle.isCombination ? 5.5 : 4.8,
                        weight: baseStyle.isCombination ? 2.5 : 2.0,
                        color: baseStyle.color,
                        fillColor: baseStyle.fillColor
                    });
                    if (layer.bringToFront) layer.bringToFront();
                } else {
                    layer.setStyle({
                        opacity: 0.35,
                        fillOpacity: 0.35,
                        radius: 2.8,
                        weight: 1.0,
                        color: baseStyle.color,
                        fillColor: baseStyle.fillColor
                    });
                }
            } else if (hoveredLine) {
                const servesLine = metroStationServesLine(feat, hoveredLine);
                if (servesLine) {
                    layer.setStyle({
                        opacity: 1.0,
                        fillOpacity: 1.0,
                        radius: baseStyle.isCombination ? 5.0 : 4.0,
                        weight: baseStyle.isCombination ? 2.2 : 1.5,
                        color: baseStyle.color,
                        fillColor: baseStyle.fillColor
                    });
                    if (layer.bringToFront) layer.bringToFront();
                } else {
                    layer.setStyle({
                        opacity: 1.0,
                        fillOpacity: 1.0,
                        radius: baseStyle.radius,
                        weight: baseStyle.weight,
                        color: baseStyle.color,
                        fillColor: baseStyle.fillColor
                    });
                }
            } else {
                layer.setStyle({
                    opacity: 1.0,
                    fillOpacity: 1.0,
                    radius: baseStyle.radius,
                    weight: baseStyle.weight,
                    color: baseStyle.color,
                    fillColor: baseStyle.fillColor
                });
            }
        });
    }

    // 4. Capa de Comunas (si está cargada y activa)
    if (typeof metroComunasLayer !== 'undefined' && metroComunasLayer && metroShowComunas) {
        const selectedComuna = metroState.selectedComuna;
        metroComunasLayer.eachLayer(layer => {
            const p = layer.feature ? layer.feature.properties : {};
            const isSelectedComuna = selectedComuna && (
                typeof metroNormalizeText === 'function'
                    ? metroNormalizeText(p.comuna) === metroNormalizeText(selectedComuna)
                    : p.comuna === selectedComuna
            );

            if (isSelectedComuna) {
                // Mantener siempre el highlight de la comuna seleccionada aunque se haga hover en proyectos o iconos
                layer.setStyle({
                    weight: 3.5,
                    color: '#059669',
                    fillOpacity: 0.28,
                    opacity: 1.0
                });
                if (layer.bringToFront) layer.bringToFront();
            } else if (selectedName || selectedLine) {
                const defStyle = metroGetComunaStyle(layer.feature);
                layer.setStyle({
                    color: defStyle.color,
                    weight: defStyle.weight,
                    fillColor: defStyle.fillColor,
                    dashArray: defStyle.dashArray,
                    opacity: 0.20,
                    fillOpacity: 0.02
                });
            } else if (selectedComuna) {
                // Comuna seleccionada activa: atenuar suavemente las demás comunas para destacar la seleccionada
                layer.setStyle({
                    weight: 1.0,
                    color: '#94a3b8',
                    opacity: 0.25,
                    fillOpacity: 0.02
                });
            } else {
                metroComunasLayer.resetStyle(layer);
            }
        });
    }

    // 5. Limpiar legs y origin markers previos de clusters
    metroClusterLegLayers.forEach(l => {
        if (l && metroMap) metroMap.removeLayer(l);
    });
    metroClusterLegLayers = [];

    metroClusterOriginMarkers.forEach(m => {
        if (m && metroMap) metroMap.removeLayer(m);
    });
    metroClusterOriginMarkers = [];

    const processedClusterStates = new Set();

    // 6. Estilos de marcadores SVG
    metroProjectMarkers.forEach(marker => {
        if (!marker || !marker.getElement) return;
        const elem = marker.getElement();
        if (!elem) return;

        const pulse = elem.querySelector('.centroid-marker-pulse');
        if (!pulse) return;

        const isSelectedMarker = selectedName && marker.projectName === selectedName;
        const isHoveredMarker = hoveredName && marker.projectName === hoveredName;

        const clusterMembers = marker.clusterMembers || [marker];
        const clusterState = marker.clusterState;
        const isClusterActive = clusterMembers.some(m =>
            m.clusterState && m.clusterState.isClickedDeployed
        );

        // Desplegar patas de cluster si está activo
        if (metroShowProjects && isClusterActive && clusterMembers.length > 1 && clusterState && !processedClusterStates.has(clusterState)) {
            processedClusterStates.add(clusterState);
            const centerLatLng = clusterMembers[0].getLatLng();

            const originDotIcon = L.divIcon({
                className: 'polygon-centroid-marker',
                html: '<div class="cluster-origin-dot" title="Haga clic para replegar"></div>',
                iconSize: [8, 8],
                iconAnchor: [4, 4]
            });
            const originMarker = L.marker(centerLatLng, { icon: originDotIcon });
            originMarker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                clusterState.isClickedDeployed = false;
                metroUpdateMapStyles(projs);
            });
            originMarker.addTo(metroMap);
            metroClusterOriginMarkers.push(originMarker);

            if (metroMap && metroMap.latLngToContainerPoint) {
                const centerPoint = metroMap.latLngToContainerPoint(centerLatLng);
                clusterMembers.forEach(cm => {
                    if (cm.clusterDx != null && cm.clusterDy != null) {
                        const targetPoint = L.point(centerPoint.x + cm.clusterDx, centerPoint.y + cm.clusterDy);
                        const targetLatLng = metroMap.containerPointToLatLng(targetPoint);
                        const legColor = cm.projectColor || (typeof metroGetProjectColor === 'function' ? metroGetProjectColor(cm.projectName) : '#52525b');
                        const leg = L.polyline([centerLatLng, targetLatLng], {
                            color: legColor,
                            weight: 2,
                            opacity: 0.75,
                            dashArray: '3, 3'
                        });
                        leg.addTo(metroMap);
                        metroClusterLegLayers.push(leg);
                    }
                });
            }
        }

        const dx = (isClusterActive && marker.clusterDx != null) ? marker.clusterDx : 0;
        const dy = (isClusterActive && marker.clusterDy != null) ? marker.clusterDy : 0;

        let scaleStr = 'scale(1.0)';
        const pColor = marker.projectColor || (typeof metroGetProjectColor === 'function' ? metroGetProjectColor(marker.projectName) : '#52525b');
        let bg = pColor;
        let opacityVal = '1.0';

        if (selectedName) {
            if (isSelectedMarker) {
                pulse.classList.add('active-selected');
                pulse.classList.remove('is-hovered', 'dimmed');
                bg = pColor;
                scaleStr = 'scale(1.35)';
                opacityVal = '1.0';
                if (marker.setZIndexOffset) marker.setZIndexOffset(10000);
            } else if (isHoveredMarker) {
                pulse.classList.remove('active-selected', 'dimmed');
                pulse.classList.add('is-hovered');
                bg = pColor;
                scaleStr = 'scale(1.25)';
                opacityVal = '0.95';
                if (marker.setZIndexOffset) marker.setZIndexOffset(9500);
            } else {
                pulse.classList.remove('active-selected', 'is-hovered');
                pulse.classList.add('dimmed');
                bg = pColor;
                scaleStr = 'scale(0.92)';
                opacityVal = '0.45';
                if (marker.setZIndexOffset) marker.setZIndexOffset(100);
            }
        } else if (selectedLine) {
            // Línea operativa seleccionada -> marcadores atenuados con moderación
            pulse.classList.remove('active-selected', 'is-hovered');
            pulse.classList.add('dimmed');
            bg = pColor;
            scaleStr = 'scale(0.92)';
            opacityVal = '0.45';
            if (marker.setZIndexOffset) marker.setZIndexOffset(100);
        } else {
            if (isHoveredMarker) {
                pulse.classList.remove('active-selected', 'dimmed');
                pulse.classList.add('is-hovered');
                bg = pColor;
                scaleStr = 'scale(1.30)';
                opacityVal = '1.0';
                if (marker.setZIndexOffset) marker.setZIndexOffset(9500);
            } else if (isClusterActive) {
                pulse.classList.remove('active-selected', 'is-hovered', 'dimmed');
                pulse.classList.add('deployed');
                bg = pColor;
                scaleStr = 'scale(1.05)';
                opacityVal = '1.0';
                if (marker.setZIndexOffset) marker.setZIndexOffset(9000);
            } else {
                pulse.classList.remove('active-selected', 'is-hovered', 'dimmed', 'deployed');
                bg = pColor;
                scaleStr = 'scale(1.0)';
                opacityVal = '1.0';
                if (marker.setZIndexOffset) marker.setZIndexOffset(0);
            }
        }
 
        const N = clusterMembers.length;
        if (marker.setTooltipContent) {
            if (N > 1 && !isClusterActive) {
                marker.setTooltipContent(`<strong>${N} proyectos en este lugar</strong>`);
            } else {
                marker.setTooltipContent(`<strong>${marker.projectName}</strong><br><span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">Etapa: ${marker.projectStage || 'Proyecto de Expansión'}</span><br><span style="color:#94a3b8;font-size:0.68rem;">${marker.projectLine || 'Metro de Santiago'}</span>`);
            }
        }

        pulse.style.backgroundColor = bg;
        pulse.style.opacity = opacityVal;
        pulse.style.transform = `translate(${dx}px, ${dy}px) ${scaleStr}`;
    });
}

function metroZoomToProject(proj) {
    if (!metroMap || !proj) return;

    // Buscar si tiene shapes asociados
    const cods = proj.shapes || [];
    let bounds = L.latLngBounds([]);

    cods.forEach(cod => {
        const layers = metroShapeGeometries[String(cod)] || [];
        layers.forEach(layer => {
            if (layer.getBounds) {
                bounds.extend(layer.getBounds());
            } else if (layer.getLatLng) {
                bounds.extend(layer.getLatLng());
            }
        });
    });

    if (!bounds.isValid() && Array.isArray(metroProjectMarkers)) {
        const marker = metroProjectMarkers.find(m => m.projectName === proj.name);
        if (marker && marker.getLatLng) {
            bounds.extend(marker.getLatLng());
        }
    }

    if (bounds.isValid()) {
        if (metroMap.flyToBounds) {
            metroMap.flyToBounds(bounds, {
                animate: true,
                duration: 0.9,
                padding: [50, 50],
                maxZoom: 14
            });
        } else {
            metroMap.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 14,
                animate: true
            });
        }
    } else {
        metroApplyDefaultMapView(true);
    }
}
window.metroZoomToProject = metroZoomToProject;

function metroResetMap() {
    if (!metroMap) return;
    metroState.selectedProjectName = null;
    metroState.selectedProjectId = null;
    metroState.hoveredProjectName = null;
    metroState.hoveredProjectId = null;
    metroState.selectedOperatingLine = null;
    metroState.hoveredOperatingLine = null;
    metroState.selectedComuna = null;
    metroApplyDefaultMapView(true);
    if (typeof metroSelectProject === 'function') {
        metroSelectProject(null);
    }
    if (typeof metroUpdateOperatingLinesTableSelection === 'function') {
        metroUpdateOperatingLinesTableSelection();
    }
    if (typeof metroUpdateSideComunasTableSelection === 'function') {
        metroUpdateSideComunasTableSelection();
    }
    if (metroComunasLayer) {
        metroComunasLayer.eachLayer(l => metroComunasLayer.resetStyle(l));
    }
    metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : (window.METRO_DATA ? window.METRO_DATA.data : []));
}

function metroAddMapLegend() {
    if (!metroMap) return;

    const legend = L.control({ position: 'bottomleft' });

    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'efe-map-legend');
        div.innerHTML = `
            <div class="efe-legend-title">Leyenda</div>
            <label class="efe-legend-item efe-legend-toggleable" for="metro-toggle-metro-lines" title="Activar/desactivar líneas de Metro de Santiago">
                <input type="checkbox" id="metro-toggle-metro-lines" class="efe-legend-checkbox" ${metroShowExistingLines ? 'checked' : ''}>
                <span class="efe-legend-color-line" style="background-color: #c53030;"></span>
                <span>Líneas Metro de Santiago</span>
            </label>
            <label class="efe-legend-item efe-legend-toggleable" for="metro-toggle-projects" title="Activar/desactivar trazados y marcadores de proyectos de expansión de Metro">
                <input type="checkbox" id="metro-toggle-projects" class="efe-legend-checkbox" ${metroShowProjects ? 'checked' : ''}>
                <span style="display:inline-flex; align-items:center; gap:3px; margin-left: 2px; margin-right: 4px; flex-shrink: 0;">
                    <span style="width: 7px; height: 7px; border-radius: 50%; background-color: #7b1fa2;" title="Línea 6: Morado"></span>
                    <span style="width: 7px; height: 7px; border-radius: 50%; background-color: #52525b;" title="Línea 7: Gris"></span>
                    <span style="width: 7px; height: 7px; border-radius: 50%; background-color: #ea580c;" title="Línea 8: Naranjo"></span>
                    <span style="width: 7px; height: 7px; border-radius: 50%; background-color: #db2777;" title="Línea 9: Rosado"></span>
                    <span style="width: 7px; height: 7px; border-radius: 50%; background-color: #06b6d4;" title="Línea A: Cian"></span>
                </span>
                <span>Proyectos de Expansión</span>
            </label>
            <label class="efe-legend-item efe-legend-toggleable" for="metro-toggle-stations" title="Activar/desactivar estaciones operativas">
                <input type="checkbox" id="metro-toggle-stations" class="efe-legend-checkbox" ${metroShowStations ? 'checked' : ''}>
                <span style="display:inline-flex; align-items:center; gap:3px; margin-left: 4px; margin-right: 4px;">
                    <span style="width: 7px; height: 7px; border-radius: 50%; background: #d7141a; border: 1px solid #ffffff; display: inline-block; box-shadow: 0 0 2px rgba(0,0,0,0.3);"></span>
                    <span style="width: 8.5px; height: 8.5px; border-radius: 50%; background: #ffffff; border: 1.5px solid #0f172a; display: inline-block; box-shadow: 0 0 2px rgba(0,0,0,0.3);"></span>
                </span>
                <span>Estaciones (Línea / Comb.)</span>
            </label>
            <label class="efe-legend-item efe-legend-toggleable" for="metro-toggle-comunas" title="Activar/desactivar límites de comunas del Gran Santiago">
                <input type="checkbox" id="metro-toggle-comunas" class="efe-legend-checkbox" ${metroShowComunas ? 'checked' : ''}>
                <span style="width: 13px; height: 9px; border: 1.5px solid #059669; background: rgba(5,150,105,0.25); display: inline-block; border-radius: 2px; margin-left: 4px; margin-right: 4px; flex-shrink: 0;"></span>
                <span>Comunas Gran Santiago</span>
            </label>
        `;

        // Prevent map click or scroll propagation when clicking inside the legend
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        const chkMetro = div.querySelector('#metro-toggle-metro-lines');
        if (chkMetro) {
            chkMetro.addEventListener('change', (e) => {
                metroToggleExistingLines(e.target.checked);
            });
        }

        const chkProjects = div.querySelector('#metro-toggle-projects');
        if (chkProjects) {
            chkProjects.addEventListener('change', (e) => {
                metroToggleProjects(e.target.checked);
            });
        }

        const chkStations = div.querySelector('#metro-toggle-stations');
        if (chkStations) {
            chkStations.addEventListener('change', (e) => {
                metroToggleStations(e.target.checked);
            });
        }

        const chkComunas = div.querySelector('#metro-toggle-comunas');
        if (chkComunas) {
            chkComunas.addEventListener('change', (e) => {
                metroUserExplicitlyEnabledComunas = e.target.checked;
                if (window.metroState) {
                    window.metroState.userExplicitlyEnabledComunas = e.target.checked;
                }
                metroToggleComunas(e.target.checked);
            });
        }

        return div;
    };

    legend.addTo(metroMap);
}
