// ─── static/js/Metro/map.js ────────────────────────────────────────────────────
// Mapa de Metro de Santiago con MapLibre GL (WebGL). Las utilidades comunes
// (mapa base, tooltip, vuelos, geometría, leyenda, clusters) vienen de
// CatlecMapGL (common/map-gl.js).
//
// - Comunas, líneas operativas, estaciones y trazados de expansión son fuentes
//   GeoJSON. Cada una se maneja como un "grupo de estilo" (metroCreateStyleGroup)
//   cuyas features ofrecen setStyle / bringToFront / resetStyle: la lógica de
//   estilos de siempre se reutiliza tal cual y escribe feature-state en MapLibre.
// - Íconos de proyecto = marcadores HTML de MapLibre (.polygon-centroid-marker).

// ─── Lógica de colores, estaciones y líneas ─────────────────────────────────
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
    return CatlecUtils.normalizeAccents(String(str || ''))
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

    if (typeof stationOrFeature === 'object') {
        featProps = stationOrFeature.properties || stationOrFeature;
        stInfo = (typeof metroFindStation === 'function') ? metroFindStation(stationOrFeature) : null;
    } else {
        stInfo = (typeof metroFindStation === 'function') ? metroFindStation(stationOrFeature, targetLineName) : null;
    }

    // A. Asociación estricta según registro en Excel (Hoja Estaciones, Columna 'Línea' y 'Combinación Futura')
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
        return false;
    }

    // B. Si hay propiedades directas del feature GeoJSON
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
        return false;
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

    // 2. Lookup en METRO_DATA.stations buscando estrictamente por shape_id o id de estación (NUNCA por nombre solo)
    if (window.METRO_DATA && Array.isArray(window.METRO_DATA.stations)) {
        const shapeId = String(p.shape_id || stationOrFeature.id || p['@id'] || (typeof stationOrFeature === 'string' ? stationOrFeature : '')).trim();
        if (shapeId) {
            const st = window.METRO_DATA.stations.find(s => String(s.shape_id || s.id).trim() === shapeId);
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

// ─── Lógica de estilos y estados ────────────────────────────────────────────

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

// Proyectos visibles según los filtros actuales (mismo criterio que los llamadores)
function metroCurrentProjects() {
    return (typeof currentFilteredMetroProjects !== 'undefined' && currentFilteredMetroProjects)
        ? currentFilteredMetroProjects
        : (window.METRO_DATA ? window.METRO_DATA.data : []);
}

// ─── Contexto de estilos (selección, hover y filtros activos) ───────────────
// Lo comparten la actualización completa (metroUpdateMapStyles) y el hover
// liviano (metroSetHover), para que ambos estilicen exactamente igual.
function metroBuildStyleContext(filteredProjects) {
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

    return { projs, selectedName, hoveredName, selectedLine, hoveredLine, selectedProjId, visibleCods, selectedShapes, hoveredShapes };
}

// Estilo de un trazado de expansión. En el hover liviano no se reordena el SVG
// (bringHoveredToFront = false): reinsertar el path bajo el cursor dispara
// mouseout/mouseover falsos y rompía los eventos de puntero y los tooltips.
function metroStyleExpansionShape(layer, ctx, bringHoveredToFront = true) {
    const { selectedName, selectedLine, visibleCods, selectedShapes, hoveredShapes } = ctx;

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
        if (isHovered) {
            layer.setStyle({
                color: projColor,
                weight: 5.5,
                opacity: 1.0,
                dashArray: null
            });
            if (bringHoveredToFront && layer.bringToFront) layer.bringToFront();
        } else {
            // Hay una línea operativa seleccionada -> proyectos atenuados con moderación
            layer.setStyle({
                color: projColor,
                weight: 3.0,
                opacity: 0.35,
                dashArray: null
            });
        }
    } else {
        if (isHovered) {
            layer.setStyle({
                color: projColor,
                weight: 6.5,
                opacity: 1.0,
                dashArray: null
            });
            if (bringHoveredToFront && layer.bringToFront) layer.bringToFront();
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
}

// Líneas operativas y estaciones (existentes y futuras): dependen de la
// selección y del hover de líneas operativas, no del hover de proyectos.
function metroStyleOperatingNetwork(ctx) {
    const { selectedName, selectedLine, hoveredLine, selectedProjId } = ctx;

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
}

// Estilo DOM de un ícono de proyecto: escala, color, opacidad, fan-out y tooltip
function metroApplyMarkerState(marker, ctx) {
    const { selectedName, hoveredName, selectedLine } = ctx;
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
        if (isHoveredMarker) {
            pulse.classList.remove('active-selected', 'dimmed');
            pulse.classList.add('is-hovered');
            bg = pColor;
            scaleStr = 'scale(1.25)';
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
            // Línea operativa seleccionada -> marcadores atenuados con moderación
            pulse.classList.remove('active-selected', 'is-hovered');
            pulse.classList.add('dimmed');
            bg = pColor;
            scaleStr = 'scale(0.92)';
            opacityVal = '0.45';
            if (marker.setZIndexOffset) marker.setZIndexOffset(100);
        }
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

    // Solo reescribir el tooltip si su contenido cambió: hacerlo en cada
    // actualización re-renderiza y reposiciona el tooltip abierto (parpadeo).
    const N = clusterMembers.length;
    if (marker.setTooltipContent) {
        const tipHtml = (N > 1 && !isClusterActive)
            ? `<strong>${N} proyectos en este lugar</strong>`
            : `<strong>${marker.projectName}</strong><br><span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">Etapa: ${marker.projectStage || 'Proyecto de Expansión'}</span><br><span style="color:#94a3b8;font-size:0.68rem;">${marker.projectLine || 'Metro de Santiago'}</span>`;
        if (marker._metroTipHtml !== tipHtml) {
            marker.setTooltipContent(tipHtml);
            marker._metroTipHtml = tipHtml;
        }
    }

    pulse.style.backgroundColor = bg;
    pulse.style.opacity = opacityVal;
    pulse.style.transform = `translate(${dx}px, ${dy}px) ${scaleStr}`;
}

// ─── Hover liviano (mapa, tabla de proyectos y tabla de líneas) ─────────────
// Cambia el proyecto/línea en hover y reestiliza solo lo que depende de él: los
// trazados e íconos del proyecto anterior y del nuevo y, si cambió la línea
// operativa en hover, la red actual y sus estaciones. No llama a
// metroUpdateMapStyles(): recalcular todo el mapa, reordenar el SVG y recrear
// los marcadores de cluster en cada hover causaba parpadeos y tooltips pegados.
function metroSetHover(projectName, lineName, projectId = null) {
    const prevName = metroState.hoveredProjectName;
    const prevId = metroState.hoveredProjectId;
    const prevLine = metroState.hoveredOperatingLine;
    if (prevName === projectName && prevId === projectId && prevLine === lineName) return;

    metroState.hoveredProjectName = projectName;
    metroState.hoveredProjectId = projectId;
    metroState.hoveredOperatingLine = lineName;
    if (!metroMap) return;

    const ctx = metroBuildStyleContext(metroCurrentProjects());

    if (prevLine !== lineName) {
        metroStyleOperatingNetwork(ctx);
    }

    if (prevName !== projectName || prevId !== projectId) {
        const allProjects = (window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : [];
        const findProj = (name, id) => allProjects.find(p => (id && p.id === id) || (name && p.name === name));
        const affectedShapes = new Set();
        const affectedNames = new Set();
        [findProj(prevName, prevId), findProj(projectName, projectId)].forEach(p => {
            if (!p) return;
            affectedNames.add(p.name);
            (p.shapes || []).forEach(cod => affectedShapes.add(String(cod).trim()));
        });

        affectedShapes.forEach(cod => {
            (metroShapeGeometries[cod] || []).forEach(layer => metroStyleExpansionShape(layer, ctx, false));
        });
        metroProjectMarkers.forEach(marker => {
            if (affectedNames.has(marker.projectName)) metroApplyMarkerState(marker, ctx);
        });
    }
}
window.metroSetHover = metroSetHover;

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

    const html = `
        <div class="catlec-map-legend-title">Leyenda</div>
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

    CatlecMapGL.addLegendControl(metroMap, {
        html,
        storageKey: 'catlec.metro.legendCollapsed',
        onMount: (div) => {
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
        }
    });
}

// ─── Constantes y estado del mapa MapLibre ───────────────────────────────────
// Vista por defecto (zoom Leaflet 11.5 → MapLibre 10.5; ver CatlecMapGL.ZOOM_OFFSET)
const METRO_DEFAULT_CENTER = [-70.6600, -33.4900];
const METRO_DEFAULT_ZOOM = 11.5 - CatlecMapGL.ZOOM_OFFSET;
// Estaciones visibles desde zoom Leaflet 10
const METRO_STATIONS_MIN_ZOOM = 10 - CatlecMapGL.ZOOM_OFFSET;

// Capas consultables al pasar el mouse o hacer click (de arriba hacia abajo)
const METRO_HIT_LAYERS = ['metro-stations-future', 'metro-stations', 'metro-expansion-hit', 'metro-lines-hit', 'metro-comunas-fill'];

let metroMapReady = false;
let metroTooltip = null;              // tooltip único del mapa (CatlecMapGL.createTooltip)
let metroIsDragClick = () => false;   // click que el navegador dispara al soltar un arrastre
let metroMapHover = null;             // { kind, item } bajo el cursor (no íconos)

function metroApplyDefaultMapView(animate = false) {
    if (!metroMap) return;
    const view = { center: METRO_DEFAULT_CENTER, zoom: METRO_DEFAULT_ZOOM };
    if (animate) metroMap.easeTo(Object.assign(view, { duration: 450 }));
    else metroMap.jumpTo(view);
}

function metroCloseAllTooltips() {
    if (metroTooltip) metroTooltip.hide();
}
window.metroCloseAllTooltips = metroCloseAllTooltips;

// ─── Grupos de estilo ────────────────────────────────────────────────────────
// Cada capa temática (comunas, líneas, estaciones, trazados) es un "grupo" con
// un objeto por feature que ofrece setStyle / bringToFront / getBounds y un
// resetStyle / eachLayer en el grupo. Así la lógica de estilos de siempre
// (metroStyleExpansionShape, metroStyleOperatingNetwork, comunas en ui.js y
// comunas.js) se reutiliza tal cual: cada setStyle escribe el feature-state
// de la feature en MapLibre, y bringToFront la agrega a la capa superior.
const METRO_STATE_KEYS = ['color', 'weight', 'opacity', 'fillColor', 'fillOpacity', 'radius'];
let metroTopFiltersPending = false;

function metroCreateStyleGroup(sourceId, features, baseStyleFn) {
    const group = { sourceId, items: [], byId: {}, front: new Set(), topLayers: [] };
    group.write = (item) => {
        if (!metroMapReady) return;
        const state = {};
        METRO_STATE_KEYS.forEach(k => { if (item._style[k] != null) state[k] = item._style[k]; });
        metroMap.setFeatureState({ source: sourceId, id: item.id }, state);
    };
    group.eachLayer = (fn) => group.items.forEach(fn);
    group.getLayers = () => group.items;
    group.resetStyle = (item) => {
        item._style = Object.assign({}, baseStyleFn(item.feature));
        group.write(item);
    };
    group.toGeoJSON = (extraProps) => ({
        type: 'FeatureCollection',
        features: group.items.map(item => ({
            type: 'Feature',
            geometry: item.feature.geometry,
            properties: Object.assign({ _gid: item.id }, extraProps ? extraProps(item) : {})
        }))
    });

    features.forEach((feature, i) => {
        const item = {
            id: String(i),
            feature,
            _style: Object.assign({}, baseStyleFn(feature)),
            setStyle(style) {
                Object.assign(this._style, style);
                group.write(this);
            },
            bringToFront() {
                if (group.front.has(this.id)) return;
                group.front.add(this.id);
                metroScheduleTopFilters();
            },
            getBounds() {
                return CatlecMapGL.boundsOfFeatures([feature]);
            }
        };
        group.items.push(item);
        group.byId[item.id] = item;
    });
    return group;
}

// Aplica (en una microtarea, una sola vez por ráfaga) los filtros de las capas
// superiores con lo que se trajo al frente
function metroScheduleTopFilters() {
    if (metroTopFiltersPending) return;
    metroTopFiltersPending = true;
    queueMicrotask(() => {
        metroTopFiltersPending = false;
        if (!metroMapReady) return;
        [metroComunasLayer, metroExistingLinesLayer, metroExpansionLayer].forEach(group => {
            if (!group) return;
            group.topLayers.forEach(({ id, filter }) => {
                const inFront = CatlecMapGL.inFilter('_gid', group.front);
                metroMap.setFilter(id, filter ? ['all', filter, inFront] : inFront);
            });
        });
    });
}

function metroFeatureCod(feature) {
    const props = (feature && feature.properties) ? feature.properties : {};
    return (props.shape_id != null && String(props.shape_id).trim() !== '')
        ? String(props.shape_id).trim()
        : (props.COD != null ? String(props.COD).trim() : (props['@id'] || ''));
}

// ─── Inicialización ──────────────────────────────────────────────────────────
// (Nombre heredado de Leaflet: lo llama Metro/ui.js)
function metroInitLeafletMap() {
    const mapContainer = document.getElementById('metro-map');
    if (!mapContainer || metroMap) return;

    metroMap = CatlecMapGL.createMap('metro-map', { center: METRO_DEFAULT_CENTER, zoom: METRO_DEFAULT_ZOOM });
    metroTooltip = CatlecMapGL.createTooltip(metroMap);
    metroIsDragClick = CatlecMapGL.trackDragClick(metroMap);

    metroMap.on('mousemove', metroOnMapMouseMove);
    metroMap.on('click', metroOnMapClick);
    metroMap.getCanvas().addEventListener('mouseleave', () => metroSetMapHover(null));
    mapContainer.addEventListener('mouseleave', () => {
        if (metroState.hoveredProjectName) {
            metroSetHover(null, metroState.hoveredOperatingLine);
        }
        metroCloseAllTooltips();
    });

    metroMap.on('load', metroLoadMapLayers);
}

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

    const featuresOf = (fc) => (fc && fc.features ? fc.features : []).filter(f => f && f.geometry && f.geometry.coordinates && f.geometry.coordinates.length);

    // 0. Comunas del Gran Santiago (límites y cobertura territorial)
    metroComunasLayer = metroCreateStyleGroup('metro-comunas', featuresOf(window.METRO_COMUNAS_GEO), metroGetComunaStyle);

    // 1. Red actual de Metro (líneas en servicio)
    metroExistingLinesLayer = metroCreateStyleGroup('metro-lines', featuresOf(window.METRO_EXISTING_LINES), (feature) => {
        const p = feature.properties || {};
        return { color: metroGetLineColor(p.name || p.ref || ''), weight: 3.5, opacity: 0.85 };
    });
    metroExistingLinesLayer.eachLayer(item => {
        const p = item.feature.properties || {};
        item.lineName = p.name || `Línea ${p.ref || ''}`;
        item.tooltipHtml = `<strong>${item.lineName}</strong><br><span style="font-size:10.5px;color:#38bdf8;">Red Metro de Santiago</span>`;
    });

    // 2. Estaciones existentes
    metroExistingStationsLayer = metroCreateStyleGroup('metro-stations', featuresOf(window.METRO_EXISTING_STATIONS), metroGetStationStyle);
    metroExistingStationsLayer.eachLayer(item => { item.tooltipHtml = metroExistingStationTooltip(item.feature); });

    // 2b. Estaciones futuras (Líneas 7, 8, 9 y Línea A)
    metroFuturoStationsLayer = metroCreateStyleGroup('metro-stations-future', featuresOf(window.METRO_FUTURO_STATIONS), metroGetStationStyle);
    metroFuturoStationsLayer.eachLayer(item => { item.tooltipHtml = metroFutureStationTooltip(item.feature); });

    // 3. Trazados de proyectos de expansión
    metroShapeGeometries = {};
    metroExpansionLayer = metroCreateStyleGroup('metro-expansion', featuresOf(window.METRO_GEO_DATA), (feature) => {
        const props = feature.properties || {};
        const projs = metroShapeToProjects[metroFeatureCod(feature)] || [];
        const proj = projs[0] || props;
        const col = (typeof metroGetProjectColor === 'function')
            ? metroGetProjectColor(proj.line || proj.linea || props.color)
            : (props.color || '#52525b');
        return { color: col, weight: 4.0, opacity: 0.90 };
    });
    metroExpansionLayer.eachLayer(item => {
        const props = item.feature.properties || {};
        const cod = metroFeatureCod(item.feature);
        if (cod) {
            if (!metroShapeGeometries[cod]) metroShapeGeometries[cod] = [];
            metroShapeGeometries[cod].push(item);
        }
        item.projs = metroShapeToProjects[cod] || [];
        const projName = item.projs.length > 0 ? item.projs[0].name : props.name;
        const projStage = item.projs.length > 0 ? item.projs[0].stage : 'En desarrollo';
        const projLine = item.projs.length > 0 ? item.projs[0].line : props.linea;
        item.tooltipHtml = `<strong>${projName}</strong><br><span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">Etapa: ${projStage || 'En desarrollo'}</span><br><span style="color:#94a3b8;font-size:0.68rem;">${projLine || 'Metro de Santiago'}</span>`;
    });

    // ─── Fuentes y capas (orden de dibujo: comunas → líneas → trazados → estaciones)
    const before = CatlecMapGL.labelsBeforeId(metroMap);
    const state = (key, fallback) => ['coalesce', ['feature-state', key], fallback];
    const roundLine = { 'line-cap': 'round', 'line-join': 'round' };
    const linePaint = { 'line-color': state('color', '#64748b'), 'line-width': state('weight', 0), 'line-opacity': state('opacity', 0) };
    const noIds = CatlecMapGL.inFilter('_gid', []);
    const addSource = (group, extraProps) => metroMap.addSource(group.sourceId, { type: 'geojson', data: group.toGeoJSON(extraProps), promoteId: '_gid' });

    addSource(metroComunasLayer, item => ({ dashed: !!metroGetComunaStyle(item.feature).dashArray }));
    addSource(metroExistingLinesLayer);
    addSource(metroExpansionLayer);
    addSource(metroExistingStationsLayer);
    addSource(metroFuturoStationsLayer);

    const isDashed = ['==', ['get', 'dashed'], true];
    const isSolid = ['!=', ['get', 'dashed'], true];
    const comunaDash = { 'line-dasharray': [3.5, 3.5] };

    metroMap.addLayer({ id: 'metro-comunas-fill', type: 'fill', source: 'metro-comunas', paint: { 'fill-color': state('fillColor', '#64748b'), 'fill-opacity': state('fillOpacity', 0) } }, before);
    metroMap.addLayer({ id: 'metro-comunas-line', type: 'line', source: 'metro-comunas', filter: isSolid, paint: linePaint }, before);
    metroMap.addLayer({ id: 'metro-comunas-line-dashed', type: 'line', source: 'metro-comunas', filter: isDashed, paint: Object.assign({}, linePaint, comunaDash) }, before);
    metroMap.addLayer({ id: 'metro-lines', type: 'line', source: 'metro-lines', layout: roundLine, paint: linePaint }, before);
    metroMap.addLayer({ id: 'metro-lines-top', type: 'line', source: 'metro-lines', layout: roundLine, paint: linePaint, filter: noIds }, before);
    // Comuna seleccionada o resaltada: su borde queda sobre las líneas operativas
    metroMap.addLayer({ id: 'metro-comunas-top', type: 'line', source: 'metro-comunas', paint: linePaint, filter: ['all', isSolid, noIds] }, before);
    metroMap.addLayer({ id: 'metro-comunas-top-dashed', type: 'line', source: 'metro-comunas', paint: Object.assign({}, linePaint, comunaDash), filter: ['all', isDashed, noIds] }, before);
    metroMap.addLayer({ id: 'metro-expansion', type: 'line', source: 'metro-expansion', layout: roundLine, paint: linePaint }, before);
    metroMap.addLayer({ id: 'metro-expansion-top', type: 'line', source: 'metro-expansion', layout: roundLine, paint: linePaint, filter: noIds }, before);
    // Detección invisible (líneas anchas)
    metroMap.addLayer({ id: 'metro-lines-hit', type: 'line', source: 'metro-lines', paint: { 'line-width': 10, 'line-opacity': 0 } }, before);
    metroMap.addLayer({ id: 'metro-expansion-hit', type: 'line', source: 'metro-expansion', paint: { 'line-width': 12, 'line-opacity': 0 } }, before);
    // Estaciones (encima de todo lo vectorial)
    const stationPaint = {
        'circle-radius': state('radius', 3.5),
        'circle-color': state('fillColor', '#ffffff'),
        'circle-opacity': state('fillOpacity', 1),
        'circle-stroke-color': state('color', '#ffffff'),
        'circle-stroke-width': state('weight', 1.2),
        'circle-stroke-opacity': state('opacity', 1)
    };
    metroMap.addLayer({ id: 'metro-stations', type: 'circle', source: 'metro-stations', minzoom: METRO_STATIONS_MIN_ZOOM, paint: stationPaint }, before);
    metroMap.addLayer({ id: 'metro-stations-future', type: 'circle', source: 'metro-stations-future', minzoom: METRO_STATIONS_MIN_ZOOM, paint: stationPaint }, before);

    metroComunasLayer.topLayers = [{ id: 'metro-comunas-top', filter: isSolid }, { id: 'metro-comunas-top-dashed', filter: isDashed }];
    metroExistingLinesLayer.topLayers = [{ id: 'metro-lines-top' }];
    metroExpansionLayer.topLayers = [{ id: 'metro-expansion-top' }];

    metroMapReady = true;

    // Estilo inicial de todas las features
    [metroComunasLayer, metroExistingLinesLayer, metroExistingStationsLayer, metroFuturoStationsLayer, metroExpansionLayer]
        .forEach(group => group.eachLayer(group.write));

    metroApplyLayerToggles();
    metroUpdateStationsVisibility();

    // Encuadre y zoom por defecto (idéntico al botón de restablecer)
    metroApplyDefaultMapView(false);

    // 4. Íconos de proyectos en los puntos medios de sus trazados
    metroRenderProjectMarkers(projects);

    metroAddMapLegend();

    // Inicializar primera carga de datos
    if (typeof metroFetchData === 'function') {
        metroFetchData();
    }
}

// ─── Tooltips de estaciones (mismo contenido de siempre) ─────────────────────
function metroExistingStationTooltip(feature) {
    const p = feature.properties || {};
    const stInfo = (typeof metroFindStation === 'function') ? metroFindStation(feature) : null;
    const name = (stInfo && stInfo.name) || p.name || 'Estación de Metro';
    const style = metroGetStationStyle(feature);

    const comuna = (stInfo && (stInfo.commune || (stInfo.communes && stInfo.communes.join(', ')))) || p.comuna || '';
    const servedLines = (stInfo && stInfo.lines) || p.lines || [style.line];
    const futCombStr = (stInfo && (stInfo.future_combination_str || (Array.isArray(stInfo.future_combination) ? stInfo.future_combination.join(', ') : stInfo.future_combination))) || p.future_combination || '';

    let lineText = '';
    if (style.isCombination) {
        let combLabel = 'Combinación';
        if (servedLines.length > 1) {
            combLabel += ` [${servedLines.map(l => l.replace('Línea ', 'L')).join('/')}]`;
        }
        if (futCombStr) {
            combLabel += ` + Fut. [${futCombStr.replace(/Línea\s*/g, 'L')}]`;
        }
        lineText = combLabel;
    } else {
        lineText = style.line;
    }

    const lineHtml = `<span style="color:#38bdf8;font-size:0.72rem;font-weight:600;">${lineText}</span>`;
    const comunaHtml = comuna
        ? `<br><span style="color:#94a3b8;font-size:0.68rem;">${comuna}</span>`
        : `<br><span style="color:#94a3b8;font-size:0.68rem;">Red Metro de Santiago</span>`;
    return `<strong>${name}</strong><br>${lineHtml}${comunaHtml}`;
}

function metroFutureStationTooltip(feature) {
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
        lineText = futCombStr ? `Combinación [${futCombStr.replace(/Línea\s*/g, 'L')}]` : 'Combinación';
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
    return `<strong>${name}</strong><br>${lineHtml}${locationHtml}${combHtml}`;
}

// ─── Eventos del mapa (capas WebGL) ──────────────────────────────────────────
const METRO_LAYER_GROUP_KIND = {
    'metro-stations-future': 'station',
    'metro-stations': 'station',
    'metro-expansion-hit': 'expansion',
    'metro-lines-hit': 'line',
    'metro-comunas-fill': 'comuna'
};

function metroGroupOfLayer(layerId) {
    switch (layerId) {
        case 'metro-stations-future': return metroFuturoStationsLayer;
        case 'metro-stations': return metroExistingStationsLayer;
        case 'metro-expansion-hit': return metroExpansionLayer;
        case 'metro-lines-hit': return metroExistingLinesLayer;
        case 'metro-comunas-fill': return metroComunasLayer;
        default: return null;
    }
}

// Elemento temático bajo el cursor, respetando el orden visual
function metroPickAt(point) {
    if (!metroMapReady) return null;
    const layers = METRO_HIT_LAYERS.filter(id => metroMap.getLayer(id));
    const feats = metroMap.queryRenderedFeatures(point, { layers });
    for (const f of feats) {
        const group = metroGroupOfLayer(f.layer.id);
        const item = group && group.byId[String(f.properties._gid)];
        if (item) return { kind: METRO_LAYER_GROUP_KIND[f.layer.id], item };
    }
    return null;
}

function metroOnMapMouseMove(e) {
    if (metroTooltip.moving || CatlecMapGL.isMarkerEvent(e)) return;
    metroSetMapHover(metroPickAt(e.point), e.point);
}

function metroComunaMouseOver(layer) {
    const p = layer.feature.properties || {};
    if (metroState.selectedComuna === p.comuna) return;
    metroHoveredComuna = p.comuna;
    layer.setStyle({
        weight: 2.0,
        color: p.has_metro ? '#059669' : (p.expansion_status === 'En Expansión' ? '#0284c7' : '#475569'),
        fillOpacity: p.has_metro ? 0.14 : 0.08,
        opacity: 0.95
    });
}

function metroComunaMouseOut(layer) {
    const p = layer.feature.properties || {};
    const isSelected = metroState.selectedComuna && (
        typeof metroNormalizeText === 'function'
            ? metroNormalizeText(metroState.selectedComuna) === metroNormalizeText(p.comuna)
            : metroState.selectedComuna === p.comuna
    );
    if (isSelected) return;
    metroHoveredComuna = null;
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
            opacity: 0.20,
            fillOpacity: 0.02
        });
    } else {
        metroComunasLayer.resetStyle(layer);
    }
}

function metroSetMapHover(hit, point) {
    const prev = metroMapHover;
    const changed = (hit ? hit.item : null) !== (prev ? prev.item : null);

    if (changed) {
        metroMapHover = hit;
        // Salida del elemento anterior
        if (prev && prev.kind === 'expansion' && metroState.hoveredProjectName) {
            metroSetHover(null, metroState.hoveredOperatingLine);
        }
        if (prev && prev.kind === 'comuna') metroComunaMouseOut(prev.item);
        // Entrada al nuevo
        if (hit && hit.kind === 'expansion' && hit.item.projs.length > 0) {
            metroSetHover(hit.item.projs[0].name, metroState.hoveredOperatingLine);
        }
        if (hit && hit.kind === 'comuna') metroComunaMouseOver(hit.item);
        metroMap.getCanvas().style.cursor = hit ? 'pointer' : '';
    }

    if (hit && point) {
        const isComuna = hit.kind === 'comuna';
        const html = isComuna ? `<strong>${hit.item.feature.properties.comuna}</strong>` : hit.item.tooltipHtml;
        metroTooltip.show(`${hit.kind}:${hit.item.id}`, html, point, isComuna ? { className: 'metro-comuna-name-tooltip' } : {});
    } else if (metroTooltip.owner && !String(metroTooltip.owner).startsWith('marker:')) {
        metroTooltip.hide();
    }
}

function metroOnMapClick(e) {
    if (CatlecMapGL.isMarkerEvent(e)) return;
    const hit = metroPickAt(e.point);

    if (hit) {
        if (hit.kind === 'station') return; // las estaciones solo muestran su tooltip
        metroCloseAllTooltips();
        if (hit.kind === 'expansion') {
            if (hit.item.projs.length > 0 && typeof metroSelectProject === 'function') {
                metroSelectProject(hit.item.projs[0]);
            }
        } else if (hit.kind === 'line') {
            if (typeof metroOnClickOperatingLine === 'function') metroOnClickOperatingLine(hit.item.lineName);
        } else if (hit.kind === 'comuna') {
            if (typeof metroOnClickComunaFromTable === 'function') metroOnClickComunaFromTable(hit.item.feature.properties.comuna);
        }
        return;
    }

    // Deseleccionar al hacer clic en el fondo del mapa
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
    metroUpdateMapStyles(metroCurrentProjects());
}

function metroFindOperatingLayers(lineName) {
    if (!metroExistingLinesLayer || !lineName) return [];
    return metroExistingLinesLayer.getLayers().filter(item => metroIsLineMatch(item.feature, lineName));
}
window.metroFindOperatingLayers = metroFindOperatingLayers;

// ─── Íconos de proyecto (marcadores HTML de MapLibre) ───────────────────────
function metroCreateSubwayMarker(proj, lngLat, isMiniDot = false, clusterCount = 1) {
    const badgeHtml = clusterCount > 1 ? `<span class="marker-cluster-badge">${clusterCount}</span>` : '';
    const typeSvg = METRO_SUBWAY_SVG;
    const projectColor = (typeof metroGetProjectColor === 'function')
        ? metroGetProjectColor(proj.line || proj.name)
        : (METRO_LINE_COLORS[proj.line] || '#52525b');

    const el = document.createElement('div');
    el.className = 'polygon-centroid-marker catlec-gl-marker';
    el.innerHTML = isMiniDot
        ? `<div class="centroid-marker-pulse" style="background-color: ${projectColor}; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #ffffff; box-shadow: 0 0 4px rgba(0,0,0,0.3); margin: 8px;">${badgeHtml}</div>`
        : `<div class="centroid-marker-pulse" style="background-color: ${projectColor};">${typeSvg}${badgeHtml}</div>`;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center', subpixelPositioning: true }).setLngLat(lngLat);
    marker.projectName = proj.name;
    marker.projectStage = proj.stage || proj.type || 'Proyecto de Expansión';
    marker.projectLine = proj.line || 'Metro de Santiago';
    marker.projectColor = projectColor;
    marker.tooltipHtml = clusterCount > 1
        ? `<strong>${clusterCount} proyectos en este lugar</strong>`
        : `<strong>${proj.name}</strong><br><span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">Etapa: ${marker.projectStage}</span><br><span style="color:#94a3b8;font-size:0.68rem;">${marker.projectLine}</span>`;

    // Interfaz que usa metroApplyMarkerState (contenido del tooltip y orden)
    marker.setTooltipContent = (html) => {
        marker.tooltipHtml = html;
        metroTooltip.update('marker:' + marker.projectName, html);
    };
    marker.setZIndexOffset = (z) => { el.style.zIndex = String(z); };

    return marker;
}

function metroClearClusterDecorations() {
    metroClusterOriginMarkers.forEach(m => m.remove());
    metroClusterOriginMarkers = [];
}

function metroRenderProjectMarkers(mapProjects) {
    if (!metroMap) return;

    metroProjectMarkers.forEach(m => m.remove());
    metroProjectMarkers = [];
    metroClearClusterDecorations();

    if (!metroMapReady || !mapProjects || mapProjects.length === 0) return;

    const rawMarkerList = [];
    mapProjects.forEach(proj => {
        if (!proj.shapes || !Array.isArray(proj.shapes) || proj.shapes.length === 0) return;
        const lineFeatures = [];
        proj.shapes.forEach(shapeId => {
            (metroShapeGeometries[String(shapeId).trim()] || []).forEach(item => {
                if (String(item.feature.geometry.type).toLowerCase().includes('line')) lineFeatures.push(item.feature);
            });
        });
        if (lineFeatures.length > 0) {
            const midpoint = CatlecMapGL.lineMidpoint(lineFeatures);
            if (midpoint) rawMarkerList.push({ proj, lngLat: midpoint, isMini: false });
        }
    });

    // Agrupar marcadores por proximidad geográfica (< 0.0008, ~80 metros)
    const clusters = [];
    rawMarkerList.forEach(item => {
        const c = clusters.find(cl =>
            Math.abs(cl[0].lngLat[1] - item.lngLat[1]) < 0.0008 && Math.abs(cl[0].lngLat[0] - item.lngLat[0]) < 0.0008
        );
        if (c) c.push(item); else clusters.push([item]);
    });

    clusters.forEach(cluster => {
        const N = cluster.length;
        const R = 22;
        const clusterState = { isClickedDeployed: false };
        const clusterMarkers = cluster.map((item, k) => {
            const marker = metroCreateSubwayMarker(item.proj, item.lngLat, item.isMini, N);
            marker.clusterState = clusterState;
            if (N > 1) {
                const angle = (2 * Math.PI * k) / N - Math.PI / 2;
                marker.clusterDx = Math.round(R * Math.cos(angle));
                marker.clusterDy = Math.round(R * Math.sin(angle));
            } else {
                marker.clusterDx = 0;
                marker.clusterDy = 0;
            }
            metroProjectMarkers.push(marker);
            return marker;
        });

        clusterMarkers.forEach(m => {
            m.clusterMembers = clusterMarkers;
            const el = m.getElement();
            const owner = 'marker:' + m.projectName;

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (metroIsDragClick()) return;
                if (N > 1 && !clusterState.isClickedDeployed) {
                    clusterState.isClickedDeployed = true;
                    metroUpdateMapStyles(metroCurrentProjects());
                } else {
                    const allP = (window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : [];
                    const proj = allP.find(p => p.name === m.projectName);
                    clusterState.isClickedDeployed = false;
                    metroCloseAllTooltips();
                    if (proj && typeof metroSelectProject === 'function') {
                        metroSelectProject(proj);
                    }
                }
            });
            el.addEventListener('mouseenter', (e) => {
                metroSetHover(m.projectName, metroState.hoveredOperatingLine);
                metroTooltip.show(owner, m.tooltipHtml, metroTooltip.pointFromEvent(e));
            });
            el.addEventListener('mousemove', (e) => {
                metroTooltip.show(owner, m.tooltipHtml, metroTooltip.pointFromEvent(e));
            });
            el.addEventListener('mouseleave', () => {
                if (metroTooltip.owner === owner) metroTooltip.hide();
                if (metroState.hoveredProjectName) {
                    metroSetHover(null, metroState.hoveredOperatingLine);
                }
            });

            if (metroShowProjects) {
                m.addTo(metroMap);
            }
        });
    });
}

// ─── Visibilidad de capas ────────────────────────────────────────────────────
function metroApplyLayerToggles() {
    if (!metroMapReady) return;
    ['metro-comunas-fill', 'metro-comunas-line', 'metro-comunas-line-dashed', 'metro-comunas-top', 'metro-comunas-top-dashed']
        .forEach(id => CatlecMapGL.setLayerVisible(metroMap, id, metroShowComunas));
    ['metro-lines', 'metro-lines-top', 'metro-lines-hit']
        .forEach(id => CatlecMapGL.setLayerVisible(metroMap, id, metroShowExistingLines));
    ['metro-expansion', 'metro-expansion-top', 'metro-expansion-hit']
        .forEach(id => CatlecMapGL.setLayerVisible(metroMap, id, metroShowProjects));
}

function metroToggleProjects(show) {
    metroShowProjects = show;
    if (!metroMap) return;

    // 1. Trazados de proyectos de expansión
    metroApplyLayerToggles();

    // 2. Íconos de proyectos y 3. clusters desplegados
    metroProjectMarkers.forEach(m => {
        if (show) m.addTo(metroMap);
        else m.remove();
    });
    if (show) {
        metroUpdateMapStyles(metroCurrentProjects());
    } else {
        metroClearClusterDecorations();
    }

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
    metroApplyLayerToggles();
}

function metroToggleExistingLines(show) {
    metroShowExistingLines = show;
    metroApplyLayerToggles();
}

function metroToggleStations(show) {
    metroShowStations = show;
    metroUpdateStationsVisibility();
}

// Estaciones visibles desde METRO_STATIONS_MIN_ZOOM (minzoom de la capa); las
// futuras, además, solo si se muestran los proyectos
function metroUpdateStationsVisibility() {
    if (!metroMapReady) return;
    CatlecMapGL.setLayerVisible(metroMap, 'metro-stations', metroShowStations);
    CatlecMapGL.setLayerVisible(metroMap, 'metro-stations-future', metroShowStations && metroShowProjects);
}

// ─── Estilos completos ───────────────────────────────────────────────────────
function metroUpdateMapStyles(filteredProjects) {
    if (!metroMapReady) return;
    const ctx = metroBuildStyleContext(filteredProjects);
    const { projs, selectedName, selectedLine } = ctx;

    // Lo que se trae al frente se recalcula en cada actualización completa
    [metroExpansionLayer, metroExistingLinesLayer, metroComunasLayer].forEach(g => g.front.clear());

    // 1. Estilos de líneas de trazado de expansión
    metroExpansionLayer.eachLayer(layer => metroStyleExpansionShape(layer, ctx));

    // 2-3b. Red actual (líneas operativas) y estaciones existentes/futuras
    metroStyleOperatingNetwork(ctx);

    // 4. Capa de Comunas (si está activa)
    if (metroShowComunas) {
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
                layer.bringToFront();
            } else if (selectedName || selectedLine) {
                const defStyle = metroGetComunaStyle(layer.feature);
                layer.setStyle({
                    color: defStyle.color,
                    weight: defStyle.weight,
                    fillColor: defStyle.fillColor,
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
    metroScheduleTopFilters();

    // 5-6. Íconos y clusters desplegados
    metroClearClusterDecorations();
    const processedClusterStates = new Set();
    metroProjectMarkers.forEach(marker => {
        const clusterMembers = marker.clusterMembers || [marker];
        const clusterState = marker.clusterState;
        const isClusterActive = clusterMembers.some(m => m.clusterState && m.clusterState.isClickedDeployed);

        if (metroShowProjects && isClusterActive && clusterMembers.length > 1 && clusterState && !processedClusterStates.has(clusterState)) {
            processedClusterStates.add(clusterState);
            metroClusterOriginMarkers.push(CatlecMapGL.createClusterOrigin(metroMap, clusterMembers, {
                legOpacity: 0.75,
                isDragClick: metroIsDragClick,
                onCollapse: () => {
                    clusterState.isClickedDeployed = false;
                    metroUpdateMapStyles(projs);
                }
            }));
        }

        metroApplyMarkerState(marker, ctx);
    });
}

// ─── Vuelos ──────────────────────────────────────────────────────────────────
function metroZoomToProject(proj) {
    if (!metroMap || !proj) return;

    // Encuadre: los trazados del proyecto o, si no tiene, su ícono
    let features = [];
    (proj.shapes || []).forEach(cod => {
        (metroShapeGeometries[String(cod)] || []).forEach(item => features.push(item.feature));
    });
    if (features.length === 0) {
        const marker = metroProjectMarkers.find(m => m.projectName === proj.name);
        if (marker) features = [{ type: 'Feature', geometry: { type: 'Point', coordinates: marker.getLngLat().toArray() } }];
    }
    const bounds = CatlecMapGL.boundsOfFeatures(features);

    // Se inicia tras el repintado: metroSelectProject aún debe restilizar el mapa
    // y refrescar tabla/panel, y ese trabajo no debe comerse los primeros cuadros.
    CatlecUtils.afterNextPaint(() => CatlecMapGL.flyToBounds(metroMap, bounds, {
        duration: 0.9,
        onDefaultView: () => metroApplyDefaultMapView(true)
    }));
}
window.metroZoomToProject = metroZoomToProject;
