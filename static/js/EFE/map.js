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

    // Re-render leg lines on zoom/move to maintain perfect alignment
    efeMap.on('zoomend moveend zoom', () => {
        if (efeClusterLegLayers.length > 0) {
            efeUpdateMapStyles();
        }
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
    const props = feature.properties;
    const cod = props.COD;
    const hasCod = cod != null && String(cod).trim() !== '' && String(cod).trim().toLowerCase() !== 'null' && String(cod).trim().toLowerCase() !== 'none';
    const isServiceLine = efeIsServiceLine(feature);
    return hasCod || isServiceLine;
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

    efeAddMapLegend();

    if (typeof efeFetchData === 'function') {
        efeFetchData();
    }
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

    // 0. Update Regional Boundaries Glow for "Nacional" projects
    const isNacionalSelected = selectedProj && selectedProj.region && String(selectedProj.region).toLowerCase().includes('nacional');
    if (efeRegionsGeoLayer) {
        efeRegionsGeoLayer.setStyle(function () {
            if (isNacionalSelected) {
                return {
                    color: '#2563eb',
                    weight: 2.5,
                    opacity: 0.95,
                    fillColor: '#2563eb',
                    fillOpacity: 0.08,
                    className: 'efe-region-path efe-region-glow-path'
                };
            } else {
                return {
                    color: '#3b82f6',
                    weight: 1,
                    opacity: 0.25,
                    fillColor: '#3b82f6',
                    fillOpacity: 0.03,
                    className: 'efe-region-path'
                };
            }
        });

        efeRegionsGeoLayer.eachLayer(layer => {
            if (layer.getElement) {
                const elem = layer.getElement();
                if (elem) {
                    if (isNacionalSelected) {
                        elem.classList.add('efe-region-glow-path');
                    } else {
                        elem.classList.remove('efe-region-glow-path');
                    }
                }
            }
        });
    }

    // 1. Update GeoJSON Vector Line/Polygon/Point Layer Styles
    if (efeGeoLayer) {
        efeGeoLayer.setStyle(function (feature) {
            if (feature.geometry && feature.geometry.type && feature.geometry.type.toLowerCase().includes('point')) {
                return { radius: 0, opacity: 0, fillOpacity: 0, stroke: false, fill: false };
            }

            const props = feature.properties || {};
            const cod = String(props.COD != null ? props.COD : '');
            const isServiceLine = efeIsServiceLine(feature);

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

                    const hasProject = !!efeShapeToProjects[cod];
                    if (!hasProject) {
                        return { color: '#10b981', weight: 1.5, opacity: 0.25, fillOpacity: 0.02 };
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
        let bg = '#059669';
        let zIndex = '100';

        if (selectedName) {
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
                bg = '#059669';
                scaleStr = 'scale(1.25)';
                zIndex = '9500';
                if (marker.setZIndexOffset) marker.setZIndexOffset(9500);
            } else if (isClusterActive) {
                // Bring all deployed cluster icons to high z-index (9000) so nearby markers never overlap them
                pulse.classList.remove('active-selected');
                pulse.classList.remove('is-hovered');
                pulse.classList.remove('dimmed');
                bg = '#059669';
                scaleStr = 'scale(1.0)';
                zIndex = '9000';
                if (marker.setZIndexOffset) marker.setZIndexOffset(9000);
            } else {
                // DIMMING for non-selected train icons (reduced dimming: scale 0.85, opacity 0.48)
                pulse.classList.remove('active-selected');
                pulse.classList.remove('is-hovered');
                pulse.classList.add('dimmed');
                bg = '#059669';
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
                bg = '#047857';
                scaleStr = 'scale(1.25)';
                zIndex = '9500';
                if (marker.setZIndexOffset) marker.setZIndexOffset(9500);
            } else if (isClusterActive) {
                // Bring all deployed cluster icons to high z-index (9000) so nearby markers never overlap them
                pulse.classList.remove('active-selected');
                pulse.classList.remove('is-hovered');
                pulse.classList.remove('dimmed');
                bg = '#059669';
                scaleStr = 'scale(1.0)';
                zIndex = '9000';
                if (marker.setZIndexOffset) marker.setZIndexOffset(9000);
            } else {
                // Normal state for all train icons
                pulse.classList.remove('active-selected');
                pulse.classList.remove('is-hovered');
                pulse.classList.remove('dimmed');
                bg = '#059669';
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
                marker.setTooltipContent(`<strong>${marker.projectName}</strong><br><span style="color:#94a3b8;font-size:0.7rem">${marker.projectRegion || ''}</span>`);
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
    let iconHtml = '';
    if (isMiniDot) {
        iconHtml = `<div class="centroid-marker-pulse" style="background-color: #059669; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #ffffff; box-shadow: 0 0 4px rgba(5,150,105,0.3); margin: 8px;">${badgeHtml}</div>`;
    } else {
        iconHtml = `<div class="centroid-marker-pulse" style="background-color: #059669;">${EFE_TRAIN_SVG}${badgeHtml}</div>`;
    }

    const customIcon = L.divIcon({
        className: 'polygon-centroid-marker',
        html: iconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
    });

    const marker = L.marker(latLng, { icon: customIcon });
    marker.projectName = proj.name;
    marker.projectRegion = proj.region || '';
    marker.bindTooltip(clusterCount > 1 ? `<strong>${clusterCount} proyectos en este lugar</strong>` : `<strong>${proj.name}</strong><br><span style="color:#94a3b8;font-size:0.7rem">${proj.region || ''}</span>`, { sticky: true, className: 'efe-map-tooltip' });

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

    const isNacional = proj.region && String(proj.region).toLowerCase().includes('nacional');
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
            <div class="efe-legend-item">
                <span class="efe-legend-color-line"></span>
                <span>Línea con servicio de pasajeros</span>
            </div>
            <div class="efe-legend-item">
                <span class="efe-legend-icon-badge">
                    ${EFE_TRAIN_SVG}
                </span>
                <span>Proyectos</span>
            </div>
        `;
        return div;
    };

    legend.addTo(efeMap);
}
