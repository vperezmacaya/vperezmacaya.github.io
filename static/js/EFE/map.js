const EFE_TRAIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8"/><path d="M4 11V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6"/><path d="M4 11h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z"/><line x1="8" y1="15" x2="8.01" y2="15"/><line x1="16" y1="15" x2="16.01" y2="15"/><path d="m9 19-3 3"/><path d="m15 19 3 3"/></svg>`;

function efeInitLeafletMap() {
    efeMap = L.map('efe-map', {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5
    }).setView([-35.6751, -71.5430], 5);

    // Light CartoDB tile layer
    efeTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2j8c_1_dacb4df364cf092be679e47d', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(efeMap);

    // Clear project & line selection & collapse clusters when clicking map background
    efeMap.on('click', () => {
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
    });

    // Re-render leg lines and update zoom-dependent layers on zoom/move
    efeMap.on('zoomend moveend zoom', () => {
        if (efeClusterLegLayers.length > 0) {
            efeUpdateMapStyles();
        }
        efeUpdateStationsVisibility();
    });

    efeLoadMapLayers();
}

function efeIsMixedProject(proj) {
    if (!proj || !proj.shapes || !Array.isArray(proj.shapes) || proj.shapes.length === 0) return false;
    let hasPoint = false;
    let hasLine = false;

    proj.shapes.forEach(shapeId => {
        const sid = String(shapeId).trim();
        const layersArr = efeShapeGeometries[sid];
        if (layersArr) {
            layersArr.forEach(l => {
                if (l.feature && l.feature.geometry && l.feature.geometry.type) {
                    const t = l.feature.geometry.type.toLowerCase();
                    if (t.includes('point')) hasPoint = true;
                    if (t.includes('line')) hasLine = true;
                } else {
                    if ((l instanceof L.CircleMarker) || (l instanceof L.Marker)) hasPoint = true;
                    if ((l instanceof L.Polyline) && !(l instanceof L.Polygon)) hasLine = true;
                }
            });
        }
    });

    return hasPoint && hasLine;
}

function efeHasValidShapeAttribute(feature) {
    if (!feature || !feature.properties) return false;
    const props = feature.properties;
    const cod = props.COD != null ? String(props.COD).trim() : '';
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

function efeLoadMapLayers() {
    efeShapeGeometries = {};

    // 1. Regional boundaries background layer
    if (window.REGIONS_DATA) {
        efeRegionsGeoLayer = L.geoJSON(window.REGIONS_DATA, {
            style: {
                color: '#3b82f6',
                weight: 1,
                opacity: 0.25,
                fillColor: '#3b82f6',
                fillOpacity: 0.03,
                className: 'efe-region-path'
            }
        }).addTo(efeMap);
    }

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

    efeGeoLayer = L.geoJSON(geoData, {
        filter: function (feature) {
            if (!feature || !feature.geometry || !feature.geometry.coordinates || feature.geometry.coordinates.length === 0) {
                return false;
            }
            return efeHasValidShapeAttribute(feature);
        },
        style: function (feature) {
            if (feature.geometry && feature.geometry.type && feature.geometry.type.toLowerCase().includes('point')) {
                return { radius: 0, opacity: 0, fillOpacity: 0, stroke: false, fill: false };
            }
            const props = feature.properties || {};
            const cod = props.COD != null ? String(props.COD).trim() : '';
            const hasProject = cod && efeShapeToProjects[cod] && efeShapeToProjects[cod].length > 0;
            const hasLine = cod && efeShapeToLines[cod] && efeShapeToLines[cod].length > 0;
            if (!hasProject && !hasLine) {
                return { opacity: 0, fillOpacity: 0, stroke: false, fill: false };
            }
            // Prioridad Verde: Proyectos prevalece sobre Líneas Operativas
            if (hasProject) {
                return { color: '#059669', weight: 3.5, opacity: 0.85, fillOpacity: 0.2 };
            }
            // Solo Línea Operativa: Azul
            return { color: '#0284c7', weight: 3.0, opacity: 0.90, fillOpacity: 0 };
        },
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 0,
                opacity: 0,
                fillOpacity: 0,
                stroke: false,
                fill: false,
                interactive: false
            });
        },
        onEachFeature: function (feature, layer) {
            const props = feature.properties || {};
            const cod = props.COD != null ? String(props.COD).trim() : '';

            if (cod) {
                if (!efeShapeGeometries[cod]) {
                    efeShapeGeometries[cod] = [];
                }
                efeShapeGeometries[cod].push(layer);
            }

            if (feature.geometry && feature.geometry.type && feature.geometry.type.toLowerCase().includes('point')) {
                return;
            }

            // Hover & Click events for line/polygon vectors (Dynamically resolving active filtered project or line)
            layer.on({
                mouseover: function (e) {
                    L.DomEvent.stopPropagation(e);
                    const actLine = efeGetActiveLineForShape(cod);
                    const actProj = efeGetActiveProjectForShape(cod);

                    if (efeState.tableMode === 'lines') {
                        if (actLine) {
                            efeState.hoveredOperatingLine = actLine.service;
                        } else if (actProj) {
                            efeState.hoveredProjectName = actProj.name;
                        }
                    } else {
                        if (actProj) {
                            efeState.hoveredProjectName = actProj.name;
                        } else if (actLine) {
                            efeState.hoveredOperatingLine = actLine.service;
                        }
                    }
                    if (actLine || actProj) {
                        efeUpdateMapStyles();
                    }
                },
                mouseout: function (e) {
                    L.DomEvent.stopPropagation(e);
                    efeState.hoveredOperatingLine = null;
                    efeState.hoveredProjectName = null;
                    efeUpdateMapStyles();
                },
                click: function (e) {
                    L.DomEvent.stopPropagation(e);
                    const actLine = efeGetActiveLineForShape(cod);
                    const actProj = efeGetActiveProjectForShape(cod);

                    if (efeState.tableMode === 'lines') {
                        if (actLine) {
                            efeOnClickOperatingLine(actLine.service);
                        } else if (actProj) {
                            efeSelectProject(actProj);
                        }
                    } else {
                        if (actProj) {
                            efeSelectProject(actProj);
                        } else if (actLine) {
                            efeOnClickOperatingLine(actLine.service);
                        }
                    }
                }
            });
        }
    }).addTo(efeMap);

    // 2. Metro de Santiago Network Layer (Solo usage == 'main' en color rojo suave con dimming)
    const metroData = window.METRO_GEO_DATA;
    if (metroData && metroData.features && metroData.features.length > 0) {
        efeMetroGeoLayer = L.geoJSON(metroData, {
            filter: function (feature) {
                if (!feature || !feature.geometry || !feature.geometry.coordinates || feature.geometry.coordinates.length === 0) {
                    return false;
                }
                const props = feature.properties || {};
                return props.usage === 'main';
            },
            style: function (feature) {
                return {
                    color: '#c53030',      // Rojo más suave / atenuado
                    weight: 2.3,
                    opacity: 0.75,
                    lineCap: 'round',
                    lineJoin: 'round'
                };
            },
            onEachFeature: function (feature, layer) {
                const props = feature.properties || {};
                const name = props.name || (props.ref ? ('Línea ' + props.ref) : 'Metro de Santiago');
                layer.bindTooltip(`<strong>${name}</strong><br><span style="font-size:11px;color:#94a3b8;">Red Metro de Santiago</span>`, {
                    sticky: true,
                    className: 'efe-tooltip'
                });
                layer.on({
                    mouseover: function (e) {
                        e.target.setStyle({ weight: 3.6, opacity: 0.95, color: '#e11d48' });
                    },
                    mouseout: function (e) {
                        if (efeMetroGeoLayer) {
                            efeMetroGeoLayer.resetStyle(e.target);
                            if (efeState.selectedProjectName) {
                                e.target.setStyle({ weight: 1.6, opacity: 0.35, color: '#c53030' });
                            }
                        }
                    }
                });
            }
        });
        if (efeShowMetroLines) {
            efeMetroGeoLayer.addTo(efeMap);
        }
    }

    // 3. Metro de Santiago Stations Layer (Puntos pequeños y sutiles)
    const metroPointsData = window.METRO_POINTS_DATA;
    if (metroPointsData && metroPointsData.features && metroPointsData.features.length > 0) {
        efeMetroPointsLayer = L.geoJSON(metroPointsData, {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 2.5,
                    fillColor: '#ffffff',
                    color: '#c53030',
                    weight: 1.2,
                    opacity: 0.85,
                    fillOpacity: 0.95
                });
            },
            onEachFeature: function (feature, layer) {
                const props = feature.properties || {};
                const name = props.name || 'Estación Metro';
                layer.bindTooltip(`<strong>${name}</strong><br><span style="font-size:10.5px;color:#94a3b8;">Estación Metro de Santiago</span>`, {
                    sticky: true,
                    className: 'efe-tooltip'
                });
            }
        });
    }

    // 4. Estaciones de Pasajeros EFE (Puntos pequeños y sutiles en azul)
    const efeEstacionesData = window.EFE_ESTACIONES_DATA;
    if (efeEstacionesData && efeEstacionesData.features && efeEstacionesData.features.length > 0) {
        efeEstacionesGeoLayer = L.geoJSON(efeEstacionesData, {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 2.5,
                    fillColor: '#ffffff',
                    color: '#0284c7',
                    weight: 1.3,
                    opacity: 0.9,
                    fillOpacity: 0.95
                });
            },
            onEachFeature: function (feature, layer) {
                const stInfo = (typeof efeFindStation === 'function') ? efeFindStation(feature) : null;
                const name = (stInfo && stInfo.name) || (feature.properties && feature.properties.name) || 'Estación EFE';

                layer.bindTooltip(`<strong>${name}</strong><br><span style="font-size:10.5px;color:#94a3b8;">Estación</span>`, {
                    sticky: true,
                    className: 'efe-tooltip'
                });
            }
        });
    }

    // Control inicial de visibilidad según zoom actual (oculto en zoom < 11)
    efeUpdateStationsVisibility();

    efeAddMapLegend();

    if (typeof efeFetchData === 'function') {
        efeFetchData();
    }

    // Encuadre inicial idéntico al botón Restablecer Mapa
    efeApplyDefaultMapView(false);
    setTimeout(() => {
        if (efeMap) {
            efeMap.invalidateSize({ animate: false });
            if (!efeState.selectedProjectName) {
                efeApplyDefaultMapView(false);
            }
        }
    }, 100);
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

// ─── Zoom-dependent Visibility for Stations (Metro & EFE) (Zoom >= 11) ─────────
const STATIONS_MIN_ZOOM = 11;
let efeIsZoomTransitioning = false;
let efeZoomTransitionTimeout = null;

function efeStartZoomTransition(durationMs = 1200) {
    efeIsZoomTransitioning = true;
    if (efeZoomTransitionTimeout) {
        clearTimeout(efeZoomTransitionTimeout);
        efeZoomTransitionTimeout = null;
    }

    if (efeEstacionesGeoLayer && efeMap && efeMap.hasLayer(efeEstacionesGeoLayer)) {
        efeMap.removeLayer(efeEstacionesGeoLayer);
    }
    if (efeMetroPointsLayer && efeMap && efeMap.hasLayer(efeMetroPointsLayer)) {
        efeMap.removeLayer(efeMetroPointsLayer);
    }

    const onZoomEnd = () => {
        if (!efeIsZoomTransitioning) return;
        efeIsZoomTransitioning = false;
        if (efeZoomTransitionTimeout) {
            clearTimeout(efeZoomTransitionTimeout);
            efeZoomTransitionTimeout = null;
        }
        efeUpdateStationsVisibility();
        efeUpdateMapStyles();
    };

    if (efeMap) {
        efeMap.once('moveend', onZoomEnd);
    }
    efeZoomTransitionTimeout = setTimeout(onZoomEnd, durationMs + 80);
}

function efeUpdateStationsVisibility() {
    if (!efeMap) return;
    const currentZoom = efeMap.getZoom();

    // If a flyTo / flyToBounds zoom transition is currently animating, keep station layers hidden
    if (efeIsZoomTransitioning) {
        if (efeMetroPointsLayer && efeMap.hasLayer(efeMetroPointsLayer)) {
            efeMap.removeLayer(efeMetroPointsLayer);
        }
        if (efeEstacionesGeoLayer && efeMap.hasLayer(efeEstacionesGeoLayer)) {
            efeMap.removeLayer(efeEstacionesGeoLayer);
        }
        return;
    }

    // Estaciones Metro de Santiago
    if (efeMetroPointsLayer) {
        const isShownMetro = efeMap.hasLayer(efeMetroPointsLayer);
        const shouldShowMetro = efeShowMetroLines && (currentZoom >= STATIONS_MIN_ZOOM);
        if (shouldShowMetro) {
            if (!isShownMetro) efeMap.addLayer(efeMetroPointsLayer);
        } else {
            if (isShownMetro) efeMap.removeLayer(efeMetroPointsLayer);
        }
    }

    // Estaciones de Pasajeros EFE (Forzar visibilidad si hay un servicio o proyecto seleccionado)
    if (efeEstacionesGeoLayer) {
        const isShownEfe = efeMap.hasLayer(efeEstacionesGeoLayer);
        const hasActiveSelection = !!(efeState.selectedOperatingLine || efeState.selectedProjectName);
        const shouldShowEfe = efeShowEfeLines && (hasActiveSelection || currentZoom >= STATIONS_MIN_ZOOM);
        if (shouldShowEfe) {
            if (!isShownEfe) efeMap.addLayer(efeEstacionesGeoLayer);
        } else {
            if (isShownEfe) efeMap.removeLayer(efeEstacionesGeoLayer);
        }
    }
}

// ─── Layer Toggles for EFE & Metro Networks ──────────────────────────────────
function efeToggleEfeLines(visible) {
    efeShowEfeLines = !!visible;
    if (!efeMap) return;

    if (efeShowEfeLines) {
        if (efeGeoLayer && !efeMap.hasLayer(efeGeoLayer)) {
            efeMap.addLayer(efeGeoLayer);
        }
    } else {
        if (efeGeoLayer && efeMap.hasLayer(efeGeoLayer)) {
            efeMap.removeLayer(efeGeoLayer);
        }
        if (efeEstacionesGeoLayer && efeMap.hasLayer(efeEstacionesGeoLayer)) {
            efeMap.removeLayer(efeEstacionesGeoLayer);
        }
    }
    efeUpdateStationsVisibility();
    efeUpdateMapStyles();
}

function efeToggleMetroLines(visible) {
    efeShowMetroLines = !!visible;
    if (!efeMap) return;

    if (efeShowMetroLines) {
        if (efeMetroGeoLayer && !efeMap.hasLayer(efeMetroGeoLayer)) {
            efeMap.addLayer(efeMetroGeoLayer);
        }
    } else {
        if (efeMetroGeoLayer && efeMap.hasLayer(efeMetroGeoLayer)) {
            efeMap.removeLayer(efeMetroGeoLayer);
        }
        if (efeMetroPointsLayer && efeMap.hasLayer(efeMetroPointsLayer)) {
            efeMap.removeLayer(efeMetroPointsLayer);
        }
    }
    efeUpdateStationsVisibility();
    efeUpdateMapStyles();
}

function efeToggleProjects(visible) {
    efeShowProjects = !!visible;
    if (!efeMap) return;

    if (!efeShowProjects) {
        // Hide project markers
        efeProjectMarkers.forEach(m => {
            if (m && efeMap && efeMap.hasLayer(m)) {
                efeMap.removeLayer(m);
            }
        });
        efeClearClusterDecorations();
    } else {
        // Re-render project markers
        const projs = (typeof currentFilteredEFEProjects !== 'undefined' && currentFilteredEFEProjects.length > 0)
            ? currentFilteredEFEProjects
            : ((window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : []);
        efeRenderProjectMarkers(projs);
    }
    efeUpdateMapStyles();
}

// ─── Clear Cluster Origin Dots & Leg Lines ──────────────────────────────────
function efeClearClusterDecorations() {
    efeClusterOriginMarkers.forEach(m => {
        if (m && efeMap) efeMap.removeLayer(m);
    });
    efeClusterOriginMarkers = [];

    efeClusterLegLayers.forEach(l => {
        if (l && efeMap) efeMap.removeLayer(l);
    });
    efeClusterLegLayers = [];
}

// ─── Dynamic Map Styler (Dimming, Hover, Selection, and Spiderfy Fan-out) ───
function efeUpdateMapStyles() {
    efeUpdateStationsVisibility();

    const selectedName = efeState.selectedProjectName;
    const hoveredName = efeState.hoveredProjectName;
    const selectedLine = efeState.selectedOperatingLine;
    const hoveredLine = efeState.hoveredOperatingLine;

    const allProjects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
    const selectedProj = selectedName ? allProjects.find(p => p.name === selectedName) : null;
    const selectedShapes = new Set(selectedProj ? (selectedProj.shapes || []).map(s => String(s)) : []);

    const hoveredProj = hoveredName ? allProjects.find(p => p.name === hoveredName) : null;
    const hoveredShapes = new Set(hoveredProj ? (hoveredProj.shapes || []).map(s => String(s)) : []);

    const allLines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
    const selectedLineObj = selectedLine ? allLines.find(l => l.service === selectedLine) : null;
    const selectedLineShapes = new Set(selectedLineObj ? (selectedLineObj.shapes || []).map(s => String(s)) : []);
    const selectedLineColor = '#0284c7';

    const hoveredLineObj = hoveredLine ? allLines.find(l => l.service === hoveredLine) : null;
    const hoveredLineShapes = new Set(hoveredLineObj ? (hoveredLineObj.shapes || []).map(s => String(s)) : []);
    const hoveredLineColor = '#0284c7';

    const isMixedSelected = selectedProj && efeIsMixedProject(selectedProj);
    const isMixedHovered = hoveredProj && efeIsMixedProject(hoveredProj);

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

    // Clear previous cluster decorations (origin dots & leg lines)
    efeClearClusterDecorations();

    // 1. Update GeoJSON Vector Line/Polygon/Point Layer Styles
    if (efeGeoLayer) {
        efeGeoLayer.setStyle(function (feature) {
            if (feature.geometry && feature.geometry.type && feature.geometry.type.toLowerCase().includes('point')) {
                return { radius: 0, opacity: 0, fillOpacity: 0, stroke: false, fill: false };
            }

            const props = feature.properties || {};
            const cod = String(props.COD != null ? props.COD : '');
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

            if (selectedLine) {
                if (isLineSelected) {
                    return {
                        color: selectedLineColor,
                        weight: 6.0,
                        opacity: 1.0,
                        fillOpacity: 0.5,
                        fillColor: selectedLineColor
                    };
                } else if (isProjHovered && hasActiveProject) {
                    return {
                        color: '#059669',
                        weight: 4.5,
                        opacity: 0.90,
                        fillOpacity: 0.35,
                        fillColor: '#059669'
                    };
                } else {
                    return {
                        color: hasActiveProject ? '#6ee7b7' : '#94a3b8',
                        weight: 2.0,
                        opacity: 0.30,
                        fillOpacity: 0.05,
                        fillColor: hasActiveProject ? '#6ee7b7' : '#94a3b8'
                    };
                }
            } else if (selectedName) {
                if (isProjSelected) {
                    return {
                        color: '#047857',
                        weight: 5.5,
                        opacity: 1.0,
                        fillOpacity: 0.5,
                        fillColor: '#047857'
                    };
                } else if (isProjHovered && !isMixedHovered && hasActiveProject) {
                    return {
                        color: '#059669',
                        weight: 4.5,
                        opacity: 0.85,
                        fillOpacity: 0.35,
                        fillColor: '#059669'
                    };
                } else if (isLineHovered && hasActiveLine) {
                    return {
                        color: '#0284c7',
                        weight: 4.5,
                        opacity: 0.85,
                        fillOpacity: 0.35,
                        fillColor: '#0284c7'
                    };
                } else {
                    return {
                        color: hasActiveProject ? '#6ee7b7' : '#94a3b8',
                        weight: 2.0,
                        opacity: 0.30,
                        fillOpacity: 0.08,
                        fillColor: hasActiveProject ? '#6ee7b7' : '#94a3b8'
                    };
                }
            } else {
                // No selection active
                if (isLineHovered && hasActiveLine) {
                    return {
                        color: hoveredLineColor,
                        weight: 5.5,
                        opacity: 1.0,
                        fillOpacity: 0.4,
                        fillColor: hoveredLineColor
                    };
                } else if (isProjHovered && !isMixedHovered && hasActiveProject) {
                    return {
                        color: '#047857',
                        weight: 5.0,
                        opacity: 1.0,
                        fillOpacity: 0.4,
                        fillColor: '#047857'
                    };
                } else {
                    // Default active state:
                    // 1) Si está asociado a un proyecto activo -> VERDE (#059669)
                    // 2) Si el proyecto fue filtrado pero el servicio sigue activo -> AZUL (#0284c7)
                    if (hasActiveProject) {
                        return {
                            color: '#059669',
                            weight: 3.5,
                            opacity: 0.85,
                            fillOpacity: 0.25,
                            fillColor: '#059669'
                        };
                    } else {
                        return {
                            color: '#0284c7',
                            weight: 3.0,
                            opacity: 0.90,
                            fillOpacity: 0,
                            fillColor: '#0284c7'
                        };
                    }
                }
            }
        });

        // Bring selected vector shapes to front layer of SVG map
        if (selectedLine && selectedLineShapes.size > 0) {
            selectedLineShapes.forEach(cod => {
                const sid = String(cod);
                const layersArr = efeShapeGeometries[sid];
                if (layersArr) {
                    layersArr.forEach(l => {
                        if (l.bringToFront) l.bringToFront();
                    });
                }
            });
        } else if (selectedName && selectedShapes.size > 0) {
            selectedShapes.forEach(cod => {
                const sid = String(cod);
                const layersArr = efeShapeGeometries[sid];
                if (layersArr) {
                    layersArr.forEach(l => {
                        if (l.bringToFront) l.bringToFront();
                    });
                }
            });
        }
    }

    // 1.5 Update Metro Lines & Stations Style & Dimming
    if (efeMetroGeoLayer) {
        efeMetroGeoLayer.setStyle(function (feature) {
            if (selectedName || selectedLine) {
                // Dimming al seleccionar cualquier icono/proyecto/línea
                return {
                    color: '#c53030',
                    weight: 1.6,
                    opacity: 0.35,
                    lineCap: 'round',
                    lineJoin: 'round'
                };
            } else {
                // Estado normal
                return {
                    color: '#c53030',
                    weight: 2.3,
                    opacity: 0.75,
                    lineCap: 'round',
                    lineJoin: 'round'
                };
            }
        });
    }

    if (efeMetroPointsLayer) {
        const isDimmed = !!(selectedName || selectedLine);
        const targetRadius = isDimmed ? 2.0 : 2.5;
        efeMetroPointsLayer.eachLayer(layer => {
            if (layer.setRadius) layer.setRadius(targetRadius);
            layer.setStyle({
                radius: targetRadius,
                fillColor: '#ffffff',
                color: '#c53030',
                weight: isDimmed ? 0.8 : 1.2,
                opacity: isDimmed ? 0.35 : 0.85,
                fillOpacity: isDimmed ? 0.35 : 0.95
            });
        });
    }

    // 1.6 Update EFE Passenger Stations (Highlight matching line or project stations, dim others)
    if (efeEstacionesGeoLayer) {
        const isDimmed = !!(selectedName || selectedLine);
        efeEstacionesGeoLayer.eachLayer(layer => {
            const stInfo = (typeof efeFindStation === 'function') ? efeFindStation(layer.feature) : null;
            const props = (layer.feature && layer.feature.properties) ? layer.feature.properties : {};
            const actServs = (stInfo && stInfo.services) ? stInfo.services : (props.services || props.servicios_activos || []);
            const projIds = (stInfo && stInfo.project_ids) ? stInfo.project_ids : (props.project_ids || []);

            const normSelLine = efeNormalizeServiceName(selectedLine);
            const isMatchLine = normSelLine && actServs.some(s => {
                const sNorm = efeNormalizeServiceName(s);
                return sNorm === normSelLine || sNorm.includes(normSelLine) || normSelLine.includes(sNorm);
            });

            const isMatchProj = selectedProj && projIds.some(pid => {
                const pStr = String(pid).trim();
                return pStr === String(selectedProj.id) || (selectedProj.name && pStr === String(selectedProj.name).trim());
            });

            if (isMatchLine) {
                if (layer.setRadius) layer.setRadius(4.5);
                layer.setStyle({
                    radius: 4.5,
                    fillColor: '#ffffff',
                    color: selectedLineColor,
                    weight: 2.2,
                    opacity: 1.0,
                    fillOpacity: 1.0
                });
                if (layer.bringToFront) layer.bringToFront();
            } else if (isMatchProj) {
                if (layer.setRadius) layer.setRadius(4.5);
                layer.setStyle({
                    radius: 4.5,
                    fillColor: '#ffffff',
                    color: '#059669',
                    weight: 2.2,
                    opacity: 1.0,
                    fillOpacity: 1.0
                });
                if (layer.bringToFront) layer.bringToFront();
            } else {
                const targetRadius = isDimmed ? 2.0 : 2.5;
                if (layer.setRadius) layer.setRadius(targetRadius);
                layer.setStyle({
                    radius: targetRadius,
                    fillColor: '#ffffff',
                    color: '#0284c7',
                    weight: isDimmed ? 0.8 : 1.3,
                    opacity: isDimmed ? 0.30 : 0.9,
                    fillOpacity: isDimmed ? 0.30 : 0.95
                });
            }
        });
    }

    const processedClusterStates = new Set();

    // 2. Update Train Icon Markers (Dimming, Selection, and Cluster Spiderfy)
    efeProjectMarkers.forEach(marker => {
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

        // Draw Origin Center Circle Dot & Leg Lines for deployed clusters
        if (isClusterActive && clusterMembers.length > 1 && clusterState && !processedClusterStates.has(clusterState)) {
            processedClusterStates.add(clusterState);

            const centerLatLng = clusterMembers[0].getLatLng();

            // 1. Origin Circle Dot (8px diameter)
            const originDotIcon = L.divIcon({
                className: 'polygon-centroid-marker',
                html: '<div class="cluster-origin-dot" title="Haga click para replegar"></div>',
                iconSize: [8, 8],
                iconAnchor: [4, 4]
            });
            const originMarker = L.marker(centerLatLng, { icon: originDotIcon });
            originMarker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                clusterState.isClickedDeployed = false;
                efeUpdateMapStyles();
            });
            originMarker.addTo(efeMap);
            efeClusterOriginMarkers.push(originMarker);

            // 2. Connecting Leg Lines from origin dot out to deployed markers
            if (efeMap && efeMap.latLngToContainerPoint) {
                const centerPoint = efeMap.latLngToContainerPoint(centerLatLng);
                clusterMembers.forEach(cm => {
                    if (cm.clusterDx != null && cm.clusterDy != null) {
                        const targetPoint = L.point(centerPoint.x + cm.clusterDx, centerPoint.y + cm.clusterDy);
                        const targetLatLng = efeMap.containerPointToLatLng(targetPoint);
                        const leg = L.polyline([centerLatLng, targetLatLng], {
                            color: '#059669',
                            weight: 2,
                            opacity: 0.65,
                            dashArray: '3, 3'
                        });
                        leg.addTo(efeMap);
                        efeClusterLegLayers.push(leg);
                    }
                });
            }
        }

        const dx = (isClusterActive && marker.clusterDx != null) ? marker.clusterDx : 0;
        const dy = (isClusterActive && marker.clusterDy != null) ? marker.clusterDy : 0;

        let scaleStr = 'scale(1.0)';
        const baseColor = marker.projectColor || '#059669';
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
                bg = '#047857';
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

        const N = clusterMembers.length;
        if (marker.setTooltipContent) {
            if (N > 1 && !isClusterActive) {
                marker.setTooltipContent(`<strong>${N} proyectos en este lugar</strong>`);
            } else {
                marker.setTooltipContent(`<strong>${marker.projectName}</strong><br><span style="color:#94a3b8;font-size:0.7rem">${marker.projectFilial || ''}</span>`);
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
    });
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

// ─── Midpoint Calculator for Line Projects (50% distance along path) ───────
function efeGetLineMidpoint(matchedLayers) {
    if (!matchedLayers || matchedLayers.length === 0) return null;

    let allSegments = [];
    matchedLayers.forEach(l => {
        if (l.getLatLngs) {
            const rawLatLngs = l.getLatLngs();
            function extractSegments(arr) {
                if (!Array.isArray(arr) || arr.length === 0) return;
                if (arr[0] instanceof L.LatLng || (arr[0] && typeof arr[0].lat === 'number')) {
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

// ─── Render Train Markers on Map ─────────────────────────────────────────────
function efeRenderProjectMarkers(mapProjects) {
    if (!efeMap) return;

    // Clear existing markers
    efeProjectMarkers.forEach(m => {
        if (m && efeMap) efeMap.removeLayer(m);
    });
    efeProjectMarkers = [];

    if (!efeShowProjects) return;

    if (!mapProjects || mapProjects.length === 0) return;

    const rawMarkerList = [];

    mapProjects.forEach(proj => {
        if (!proj.shapes || !Array.isArray(proj.shapes) || proj.shapes.length === 0) return;

        let matchedLayers = [];
        proj.shapes.forEach(shapeId => {
            const sid = String(shapeId).trim();
            const layersForShape = efeShapeGeometries[sid];
            if (layersForShape) matchedLayers.push(...layersForShape);
        });

        if (matchedLayers.length === 0) return;

        const pointLayers = matchedLayers.filter(l => {
            if (l.feature && l.feature.geometry && l.feature.geometry.type) {
                return l.feature.geometry.type.toLowerCase().includes('point');
            }
            return (l instanceof L.CircleMarker) || (l instanceof L.Marker);
        });

        const lineLayers = matchedLayers.filter(l => {
            if (l.feature && l.feature.geometry && l.feature.geometry.type) {
                return l.feature.geometry.type.toLowerCase().includes('line');
            }
            return (l instanceof L.Polyline) && !(l instanceof L.Polygon);
        });

        if (pointLayers.length > 0) {
            // Point or Mixed (Point + Line) project: generate icons at point geometries
            const isManyPoints = pointLayers.length > 5;
            pointLayers.forEach((l, idx) => {
                let center = l.getLatLng ? l.getLatLng() : (l.getBounds ? l.getBounds().getCenter() : null);
                if (center) {
                    const isMini = isManyPoints && idx > 0;
                    rawMarkerList.push({ proj, latLng: center, isMini });
                }
            });
        } else if (lineLayers.length > 0) {
            // Line-only project: 1 train icon at exact path midpoint
            const midpoint = efeGetLineMidpoint(lineLayers);
            if (midpoint) {
                rawMarkerList.push({ proj, latLng: midpoint, isMini: false });
            }
        }
    });

    // Group marker items by geographical proximity (within ~0.0008 threshold, ~80 meters)
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

    // Create markers and compute fan-out offsets for overlapping locations
    clusters.forEach(cluster => {
        const N = cluster.length;
        const R = 22; // Offset radius in pixels (kept very close to original location)
        const clusterMarkers = [];
        const clusterState = { isClickedDeployed: false };

        cluster.forEach((item, k) => {
            const marker = efeCreateTrainMarker(item.proj, item.latLng, item.isMini, N);
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
            efeProjectMarkers.push(marker);
        });

        // Attach shared cluster reference & listeners to all markers in cluster
        clusterMarkers.forEach(m => {
            m.clusterMembers = clusterMarkers;

            m.on('click', (e) => {
                L.DomEvent.stopPropagation(e);

                if (N > 1 && !clusterState.isClickedDeployed) {
                    // First click on stacked cluster: deploy/fan-out icons
                    clusterState.isClickedDeployed = true;
                    efeUpdateMapStyles();
                } else {
                    const proj = (window.EFE_DATA.data || []).find(p => p.name === m.projectName);
                    clusterState.isClickedDeployed = false;

                    // Execute instant selection
                    efeSelectProject(proj);
                }
            });

            m.on('mouseover', () => {
                efeState.hoveredProjectName = m.projectName;
                efeUpdateMapStyles();
            });

            m.on('mouseout', () => {
                efeState.hoveredProjectName = null;
                efeUpdateMapStyles();
            });

            m.addTo(efeMap);
        });
    });
}

function efeCreateTrainMarker(proj, latLng, isMiniDot = false, clusterCount = 1) {
    const badgeHtml = clusterCount > 1 ? `<span class="marker-cluster-badge">${clusterCount}</span>` : '';
    const typeSvg = EFE_TRAIN_SVG;
    const typeColor = '#059669';

    let iconHtml = '';
    if (isMiniDot) {
        iconHtml = `<div class="centroid-marker-pulse" style="background-color: ${typeColor}; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #ffffff; box-shadow: 0 0 4px rgba(0,0,0,0.3); margin: 8px;">${badgeHtml}</div>`;
    } else {
        iconHtml = `<div class="centroid-marker-pulse" style="background-color: ${typeColor};">${typeSvg}${badgeHtml}</div>`;
    }

    const customIcon = L.divIcon({
        className: 'polygon-centroid-marker',
        html: iconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
    });

    const marker = L.marker(latLng, { icon: customIcon });
    marker.projectName = proj.name;
    marker.projectFilial = proj.filial || 'Sin filial específica';
    marker.projectType = proj.type || '';
    marker.projectColor = typeColor;

    const tooltipContent = clusterCount > 1
        ? `<strong>${clusterCount} proyectos en este lugar</strong>`
        : `<strong>${proj.name}</strong><br><span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">Tipo: ${proj.type || '—'}</span><br><span style="color:#94a3b8;font-size:0.68rem;">${proj.filial || 'Red General'}</span>`;

    marker.bindTooltip(tooltipContent, { sticky: true, className: 'efe-map-tooltip' });

    return marker;
}

// ─── Calculate Bounding Box of all Railway Projects & Service Lines ─────────
function efeGetProjectsExtentBounds() {
    let bounds = L.latLngBounds();

    // Extend bounds by all project shape layers indexed in efeShapeGeometries
    Object.values(efeShapeGeometries).forEach(layersArr => {
        if (Array.isArray(layersArr)) {
            layersArr.forEach(l => {
                if (l.getBounds) bounds.extend(l.getBounds());
                else if (l.getLatLng) bounds.extend(l.getLatLng());
            });
        }
    });

    return bounds;
}

// ─── Apply Default Map View (Synchronized between initial load and reset) ───
function efeApplyDefaultMapView(animate = false) {
    if (!efeMap) return;
    const extentBounds = efeGetProjectsExtentBounds();
    if (extentBounds && extentBounds.isValid()) {
        efeMap.fitBounds(extentBounds, {
            padding: [40, 40],
            maxZoom: 10,
            animate: animate
        });
    } else {
        efeMap.setView([-35.6751, -71.5430], 5, { animate: animate });
    }
}
window.efeApplyDefaultMapView = efeApplyDefaultMapView;

// ─── Zoom to Project (Fly to bounds or midpoint) ────────────────────────────
function efeZoomToProject(proj) {
    if (!efeMap || !proj) return;

    const isNacional = (!proj.shapes || proj.shapes.length === 0) || (proj.filial && String(proj.filial).toLowerCase().includes('nacional'));
    if (isNacional) {
        efeApplyDefaultMapView(true);
        return;
    }

    let matchedLayers = [];
    if (proj.shapes && Array.isArray(proj.shapes)) {
        proj.shapes.forEach(shapeId => {
            const sid = String(shapeId).trim();
            const layersForShape = efeShapeGeometries[sid];
            if (layersForShape) {
                matchedLayers.push(...layersForShape);
            }
        });
    }

    if (matchedLayers.length > 0) {
        let combinedBounds = L.latLngBounds();
        matchedLayers.forEach(l => {
            if (l.getBounds) {
                combinedBounds.extend(l.getBounds());
            } else if (l.getLatLng) {
                combinedBounds.extend(l.getLatLng());
            }
        });

        if (combinedBounds.isValid()) {
            efeStartZoomTransition(1200);
            efeMap.flyToBounds(combinedBounds, {
                animate: true,
                duration: 1.2,
                padding: [70, 70],
                maxZoom: 10
            });
            return;
        }
    }

    const midpoint = efeGetLineMidpoint(matchedLayers);
    if (midpoint) {
        efeStartZoomTransition(1200);
        efeMap.flyTo(midpoint, 10, { animate: true, duration: 1.2 });
    } else {
        efeApplyDefaultMapView(true);
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
    efeState.hoveredOperatingLine = isHover ? lineName : null;
    efeUpdateMapStyles();
}
window.efeOnHoverOperatingLine = efeOnHoverOperatingLine;

function efeZoomToOperatingLine(lineName) {
    if (!efeMap || !lineName) return;
    const lines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
    const lineObj = lines.find(l => l.service === lineName);
    if (!lineObj || !lineObj.shapes || lineObj.shapes.length === 0) {
        efeApplyDefaultMapView(true);
        return;
    }

    let matchedLayers = [];
    lineObj.shapes.forEach(shapeId => {
        const sid = String(shapeId).trim();
        const layersForShape = efeShapeGeometries[sid];
        if (layersForShape) matchedLayers.push(...layersForShape);
    });

    if (matchedLayers.length > 0) {
        let combinedBounds = L.latLngBounds();
        matchedLayers.forEach(l => {
            if (l.getBounds) combinedBounds.extend(l.getBounds());
            else if (l.getLatLng) combinedBounds.extend(l.getLatLng());
        });

        if (combinedBounds.isValid()) {
            efeStartZoomTransition(1200);
            efeMap.flyToBounds(combinedBounds, {
                animate: true,
                duration: 1.2,
                padding: [60, 60],
                maxZoom: 12
            });
            return;
        }
    }

    efeApplyDefaultMapView(true);
}
window.efeZoomToOperatingLine = efeZoomToOperatingLine;

function efeHighlightProjectShapes(shapes) {
    if (!shapes || shapes.length === 0) {
        efeState.hoveredProjectName = null;
    } else {
        const shapeStrSet = new Set(shapes.map(String));
        const allProjects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
        const proj = allProjects.find(p => (p.shapes || []).some(s => shapeStrSet.has(String(s))));
        if (proj) {
            efeState.hoveredProjectName = proj.name;
        }
    }
    efeUpdateMapStyles();
}

function efeUpdateMapBadge(shown, total) {
    if (efeMapStatsBadge) {
        efeMapStatsBadge.textContent = `${shown} / ${total} proyectos`;
    }
}

// ─── Map Legend Control (Bottom-Left) ────────────────────────────────────────
function efeAddMapLegend() {
    if (!efeMap) return;

    const legend = L.control({ position: 'bottomleft' });

    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'efe-map-legend');
        div.innerHTML = `
            <div class="efe-legend-title">Leyenda</div>
            <label class="efe-legend-item efe-legend-toggleable" for="efe-toggle-efe-lines" title="Activar/desactivar líneas de pasajeros EFE">
                <input type="checkbox" id="efe-toggle-efe-lines" class="efe-legend-checkbox" ${efeShowEfeLines ? 'checked' : ''}>
                <span class="efe-legend-color-line"></span>
                <span>Línea de pasajeros EFE</span>
            </label>
            <label class="efe-legend-item efe-legend-toggleable" for="efe-toggle-metro-lines" title="Activar/desactivar líneas de Metro de Santiago">
                <input type="checkbox" id="efe-toggle-metro-lines" class="efe-legend-checkbox" ${efeShowMetroLines ? 'checked' : ''}>
                <span class="efe-legend-color-line" style="background-color: #c53030;"></span>
                <span>Líneas Metro de Santiago</span>
            </label>
            <label class="efe-legend-item efe-legend-toggleable" for="efe-toggle-projects" title="Activar/desactivar proyectos (íconos y trazados)">
                <input type="checkbox" id="efe-toggle-projects" class="efe-legend-checkbox" ${efeShowProjects ? 'checked' : ''}>
                <span class="efe-legend-icon-badge">
                    ${EFE_TRAIN_SVG}
                </span>
                <span>Proyectos</span>
            </label>
        `;

        // Prevent map click or scroll propagation when clicking inside the legend
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        const chkEfe = div.querySelector('#efe-toggle-efe-lines');
        if (chkEfe) {
            chkEfe.addEventListener('change', (e) => {
                efeToggleEfeLines(e.target.checked);
            });
        }

        const chkMetro = div.querySelector('#efe-toggle-metro-lines');
        if (chkMetro) {
            chkMetro.addEventListener('change', (e) => {
                efeToggleMetroLines(e.target.checked);
            });
        }

        const chkProjects = div.querySelector('#efe-toggle-projects');
        if (chkProjects) {
            chkProjects.addEventListener('change', (e) => {
                efeToggleProjects(e.target.checked);
            });
        }

        return div;
    };

    legend.addTo(efeMap);
}
