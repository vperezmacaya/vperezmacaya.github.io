// ─── EFE Map Module ──────────────────────────────────────────────────────────

const EFE_TRAIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 31h8"/><path d="M4 11V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6"/><path d="M4 11h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z"/><line x1="8" y1="15" x2="8.01" y2="15"/><line x1="16" y1="15" x2="16.01" y2="15"/><path d="m9 19-3 3"/><path d="m15 19 3 3"/></svg>`;

function efeInitLeafletMap() {
    efeMap = L.map('efe-map', {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
    }).setView([-36.5000, -71.8000], 6);

    // Light CartoDB tile layer
    efeTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2j8c_1_dacb4df364cf092be679e47d', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(efeMap);

    // Clear project selection & collapse clusters when clicking map background
    efeMap.on('click', () => {
        efeState.selectedProjectName = null;
        efeState.hoveredProjectName = null;
        efeProjectMarkers.forEach(m => {
            if (m.clusterState) m.clusterState.isClickedDeployed = false;
        });
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

function efeIsServiceLine(feature) {
    if (!feature || !feature.properties) return false;
    const props = feature.properties;
    const val = props.line != null ? props.line : (props.LINE != null ? props.LINE : (props.linea != null ? props.linea : props.LINEA));
    return val != null && String(val).trim() !== '' && String(val).trim().toLowerCase() !== 'null' && String(val).trim().toLowerCase() !== 'none';
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
    const isServiceLine = efeIsServiceLine(feature);
    if (isServiceLine) return true;
    const props = feature.properties;
    const cod = props.COD != null ? String(props.COD).trim() : '';
    const hasCod = cod !== '' && cod.toLowerCase() !== 'null' && cod.toLowerCase() !== 'none';
    if (!hasCod) return false;
    // Only include shapes that belong to at least one project in the database
    return !!(efeShapeToProjects && efeShapeToProjects[cod] && efeShapeToProjects[cod].length > 0);
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

    efeGeoLayer = L.geoJSON(geoData, {
        filter: function (feature) {
            if (!feature || !feature.geometry || !feature.geometry.coordinates || feature.geometry.coordinates.length === 0) {
                return false;
            }
            // NEVER render shapes that lack BOTH a valid COD and a valid line attribute
            return efeHasValidShapeAttribute(feature);
        },
        style: function (feature) {
            if (feature.geometry && feature.geometry.type && feature.geometry.type.toLowerCase().includes('point')) {
                return { radius: 0, opacity: 0, fillOpacity: 0, stroke: false, fill: false };
            }
            if (efeIsServiceLine(feature)) {
                return { color: '#0284c7', weight: 3.0, opacity: 0.9, fillOpacity: 0 };
            }
            const props = feature.properties || {};
            const cod = props.COD != null ? String(props.COD).trim() : '';
            const hasProject = cod && efeShapeToProjects[cod] && efeShapeToProjects[cod].length > 0;
            if (!hasProject) {
                return { opacity: 0, fillOpacity: 0, stroke: false, fill: false };
            }
            return { color: '#059669', weight: 3.5, opacity: 0.85, fillOpacity: 0.2 };
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
            const isServiceLine = efeIsServiceLine(feature);

            if (cod) {
                if (!efeShapeGeometries[cod]) {
                    efeShapeGeometries[cod] = [];
                }
                efeShapeGeometries[cod].push(layer);
            }

            if (!cod && isServiceLine) {
                const serviceKey = 'service_' + (props.line || props.LINE || props.linea || props.LINEA || 'line');
                if (!efeShapeGeometries[serviceKey]) {
                    efeShapeGeometries[serviceKey] = [];
                }
                efeShapeGeometries[serviceKey].push(layer);
            }

            if (feature.geometry && feature.geometry.type && feature.geometry.type.toLowerCase().includes('point')) {
                return;
            }

            // Hover & Click events for line/polygon vectors
            layer.on({
                mouseover: function (e) {
                    L.DomEvent.stopPropagation(e);
                    if (isServiceLine) return;
                    const projNames = efeShapeToProjects[cod];
                    if (projNames && projNames.length > 0) {
                        efeState.hoveredProjectName = projNames[0];
                        efeUpdateMapStyles();
                    }
                },
                mouseout: function (e) {
                    L.DomEvent.stopPropagation(e);
                    if (isServiceLine) return;
                    efeState.hoveredProjectName = null;
                    efeUpdateMapStyles();
                },
                click: function (e) {
                    L.DomEvent.stopPropagation(e);
                    if (isServiceLine) return;
                    const projNames = efeShapeToProjects[cod];
                    if (projNames && projNames.length > 0) {
                        const allProjects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
                        const proj = allProjects.find(p => p.name === projNames[0]);
                        if (proj) {
                            efeSelectProject(proj);
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
        }).addTo(efeMap);
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
                layer.on({
                    mouseover: function (e) {
                        if (e.target.setRadius) e.target.setRadius(4.2);
                        e.target.setStyle({
                            weight: 2.0,
                            color: '#e11d48',
                            fillColor: '#ffffff',
                            opacity: 1.0,
                            fillOpacity: 1.0
                        });
                    },
                    mouseout: function (e) {
                        const isDimmed = !!efeState.selectedProjectName;
                        const targetRadius = isDimmed ? 2.0 : 2.5;
                        if (e.target.setRadius) e.target.setRadius(targetRadius);
                        e.target.setStyle({
                            radius: targetRadius,
                            fillColor: '#ffffff',
                            color: '#c53030',
                            weight: isDimmed ? 0.8 : 1.2,
                            opacity: isDimmed ? 0.35 : 0.85,
                            fillOpacity: isDimmed ? 0.35 : 0.95
                        });
                    }
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
                const props = feature.properties || {};
                const name = props.name || 'Estación EFE';
                const srvList = (props.servicios_activos && props.servicios_activos.length > 0)
                    ? props.servicios_activos.join(' · ')
                    : 'Servicio de Pasajeros EFE';

                layer.bindTooltip(`<strong>${name}</strong><br><span style="font-size:10.5px;color:#38bdf8;">${srvList}</span>`, {
                    sticky: true,
                    className: 'efe-tooltip'
                });

                layer.on({
                    mouseover: function (e) {
                        if (e.target.setRadius) e.target.setRadius(4.2);
                        e.target.setStyle({
                            weight: 2.2,
                            color: '#38bdf8',
                            fillColor: '#ffffff',
                            opacity: 1.0,
                            fillOpacity: 1.0
                        });
                    },
                    mouseout: function (e) {
                        const isDimmed = !!efeState.selectedProjectName;
                        const targetRadius = isDimmed ? 2.0 : 2.5;
                        if (e.target.setRadius) e.target.setRadius(targetRadius);
                        e.target.setStyle({
                            radius: targetRadius,
                            fillColor: '#ffffff',
                            color: '#0284c7',
                            weight: isDimmed ? 0.8 : 1.3,
                            opacity: isDimmed ? 0.35 : 0.9,
                            fillOpacity: isDimmed ? 0.35 : 0.95
                        });
                    }
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
}

// ─── Zoom-dependent Visibility for Stations (Metro & EFE) (Zoom >= 11) ─────────
const STATIONS_MIN_ZOOM = 11;

function efeUpdateStationsVisibility() {
    if (!efeMap) return;
    const currentZoom = efeMap.getZoom();

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

    // Estaciones de Pasajeros EFE
    if (efeEstacionesGeoLayer) {
        const isShownEfe = efeMap.hasLayer(efeEstacionesGeoLayer);
        const shouldShowEfe = efeShowEfeLines && (currentZoom >= STATIONS_MIN_ZOOM);
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
    const selectedName = efeState.selectedProjectName;
    const hoveredName = efeState.hoveredProjectName;

    const allProjects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
    const selectedProj = selectedName ? allProjects.find(p => p.name === selectedName) : null;
    const selectedShapes = new Set(selectedProj ? (selectedProj.shapes || []).map(s => String(s)) : []);

    const hoveredProj = hoveredName ? allProjects.find(p => p.name === hoveredName) : null;
    const hoveredShapes = new Set(hoveredProj ? (hoveredProj.shapes || []).map(s => String(s)) : []);

    const isMixedSelected = selectedProj && efeIsMixedProject(selectedProj);
    const isMixedHovered = hoveredProj && efeIsMixedProject(hoveredProj);

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
            const isServiceLine = efeIsServiceLine(feature);
            const hasProject = cod && efeShapeToProjects[cod] && efeShapeToProjects[cod].length > 0;

            // Shapes with a COD not associated with any project must NEVER appear on the map
            if (!hasProject && !isServiceLine) {
                return { opacity: 0, fillOpacity: 0, stroke: false, fill: false };
            }

            const isSelected = selectedName && cod && selectedShapes.has(cod);
            const isHovered = hoveredName && cod && hoveredShapes.has(cod);

            if (selectedName) {
                if (isSelected) {
                    if (isServiceLine) {
                        return {
                            color: '#0284c7',
                            weight: 5.5,
                            opacity: 1.0,
                            fillOpacity: 0.5,
                            fillColor: '#0284c7'
                        };
                    } else {
                        return {
                            color: '#047857',
                            weight: 5.5,
                            opacity: 1.0,
                            fillOpacity: 0.5,
                            fillColor: '#047857'
                        };
                    }
                } else if (isHovered && !isMixedHovered) {
                    if (isServiceLine) {
                        return {
                            color: '#0284c7',
                            weight: 4.5,
                            opacity: 0.9,
                            fillOpacity: 0.35,
                            fillColor: '#0284c7'
                        };
                    } else {
                        return {
                            color: '#059669',
                            weight: 4.5,
                            opacity: 0.85,
                            fillOpacity: 0.35,
                            fillColor: '#059669'
                        };
                    }
                } else {
                    if (isServiceLine) {
                        return { color: '#0284c7', weight: 2.0, opacity: 0.45, fillOpacity: 0 };
                    }
                    return {
                        color: '#6ee7b7',
                        weight: 2.0,
                        opacity: 0.45,
                        fillOpacity: 0.08,
                        fillColor: '#6ee7b7'
                    };
                }
            } else {
                // No selection active
                if (isHovered && !isMixedHovered) {
                    if (isServiceLine) {
                        return {
                            color: '#0284c7',
                            weight: 5.0,
                            opacity: 1.0,
                            fillOpacity: 0.4,
                            fillColor: '#0284c7'
                        };
                    } else {
                        return {
                            color: '#047857',
                            weight: 5.0,
                            opacity: 1.0,
                            fillOpacity: 0.4,
                            fillColor: '#047857'
                        };
                    }
                } else {
                    // Normal default state for all shapes
                    if (isServiceLine) {
                        return { color: '#0284c7', weight: 3.0, opacity: 0.9, fillOpacity: 0 };
                    }

                    return {
                        color: '#059669',
                        weight: 3.5,
                        opacity: 0.85,
                        fillOpacity: 0.25,
                        fillColor: '#059669'
                    };
                }
            }
        });

        // Bring selected vector shapes to front layer of SVG map
        if (selectedName && selectedShapes.size > 0) {
            selectedShapes.forEach(cod => {
                const sid = String(cod);
                const layersArr = efeShapeGeometries[sid];
                if (layersArr) {
                    layersArr.forEach(l => {
                        if (l.bringToFront) {
                            l.bringToFront();
                        }
                    });
                }
            });
        }
    }

    // 1.5 Update Metro Lines & Stations Style & Dimming
    if (efeMetroGeoLayer) {
        efeMetroGeoLayer.setStyle(function (feature) {
            if (selectedName) {
                // Dimming al seleccionar cualquier icono/proyecto
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
        const isDimmed = !!selectedName;
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

    // 1.6 Update EFE Passenger Stations (Dimming on project selection)
    if (efeEstacionesGeoLayer) {
        const isDimmed = !!selectedName;
        const targetRadius = isDimmed ? 2.0 : 2.5;
        efeEstacionesGeoLayer.eachLayer(layer => {
            if (layer.setRadius) layer.setRadius(targetRadius);
            layer.setStyle({
                radius: targetRadius,
                fillColor: '#ffffff',
                color: '#0284c7',
                weight: isDimmed ? 0.8 : 1.3,
                opacity: isDimmed ? 0.35 : 0.9,
                fillOpacity: isDimmed ? 0.35 : 0.95
            });
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

        if (selectedName) {
            if (isSelectedMarker) {
                // Selected train icon marker - Bring to absolute front of all map marker layers
                pulse.classList.add('active-selected');
                pulse.classList.remove('is-hovered');
                pulse.classList.remove('dimmed');
                bg = '#0284c7';
                scaleStr = 'scale(1.35)';
                zIndex = '10000';
                if (marker.setZIndexOffset) marker.setZIndexOffset(10000);
            } else if (isHoveredMarker) {
                pulse.classList.remove('active-selected');
                pulse.classList.add('is-hovered');
                pulse.classList.remove('dimmed');
                bg = '#2563eb';
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
                bg = '#2563eb';
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
            if (selectedName || isClusterActive) {
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
        efeZoomToProject(proj);
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
    const typeSvg = (typeof efeGetProjectTypeSvg === 'function')
        ? efeGetProjectTypeSvg(proj.type, 13, 13, '#ffffff')
        : EFE_TRAIN_SVG;
    const typeColor = (typeof EFE_TIPO_COLORS !== 'undefined' && EFE_TIPO_COLORS[proj.type])
        ? EFE_TIPO_COLORS[proj.type]
        : '#2563eb';

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

    // Also extend bounds by any active service line layers
    if (efeGeoLayer) {
        efeGeoLayer.eachLayer(l => {
            if (l.feature && efeIsServiceLine(l.feature)) {
                if (l.getBounds) bounds.extend(l.getBounds());
                else if (l.getLatLng) bounds.extend(l.getLatLng());
            }
        });
    }

    return bounds;
}

// ─── Zoom to Project (Fly to bounds or midpoint) ────────────────────────────
function efeZoomToProject(proj) {
    if (!efeMap || !proj) return;

    const isNacional = (!proj.shapes || proj.shapes.length === 0) || (proj.filial && String(proj.filial).toLowerCase().includes('nacional'));
    if (isNacional) {
        const extentBounds = efeGetProjectsExtentBounds();
        if (extentBounds.isValid()) {
            efeMap.flyToBounds(extentBounds, {
                animate: true,
                duration: 1.2,
                padding: [40, 40],
                maxZoom: 10
            });
            return;
        } else {
            efeMap.setView([-36.5000, -71.8000], 6);
            return;
        }
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
        efeMap.flyTo(midpoint, 10, { animate: true, duration: 1.2 });
    } else {
        const extentBounds = efeGetProjectsExtentBounds();
        if (extentBounds.isValid()) {
            efeMap.flyToBounds(extentBounds, {
                animate: true,
                duration: 1.2,
                padding: [50, 50],
                maxZoom: 9
            });
        }
    }
}

function efeResetMap() {
    efeState.selectedProjectName = null;
    efeState.hoveredProjectName = null;
    efeUpdateMapStyles();
    if (efeMap) {
        const extentBounds = efeGetProjectsExtentBounds();
        if (extentBounds.isValid()) {
            efeMap.flyToBounds(extentBounds, { animate: true, duration: 1.2, padding: [40, 40], maxZoom: 10 });
        } else {
            efeMap.setView([-35.6751, -71.5430], 5);
        }
    }
}

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
            <div class="efe-legend-item">
                <span class="efe-legend-icon-badge">
                    ${EFE_TRAIN_SVG}
                </span>
                <span>Proyectos</span>
            </div>
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

        return div;
    };

    legend.addTo(efeMap);
}
