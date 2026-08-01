// ─── EFE Map Module ──────────────────────────────────────────────────────────

const EFE_TRAIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 31h8"/><path d="M4 11V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6"/><path d="M4 11h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z"/><line x1="8" y1="15" x2="8.01" y2="15"/><line x1="16" y1="15" x2="16.01" y2="15"/><path d="m9 19-3 3"/><path d="m15 19 3 3"/></svg>`;

function efeInitLeafletMap() {
    efeMap = L.map('efe-map', {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
    }).setView([-35.6751, -71.5430], 5);

    // Light CartoDB tile layer
    efeTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(efeMap);

    // Clear project selection when clicking map background
    efeMap.on('click', () => {
        efeState.selectedProjectName = null;
        efeState.hoveredProjectName = null;
        efeUpdateMapStyles();
        if (typeof efeFetchData === 'function') efeFetchData();
    });

    efeLoadMapLayers();
}

function efeLoadMapLayers() {
    efeShapeGeometries = {};

    // 1. Regional boundaries background layer
    if (window.REGIONS_DATA) {
        L.geoJSON(window.REGIONS_DATA, {
            style: {
                color: '#16a34a',
                weight: 1,
                opacity: 0.25,
                fillColor: '#16a34a',
                fillOpacity: 0.03
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
            return feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates.length > 0;
        },
        style: function () {
            return { color: '#16a34a', weight: 3.5, opacity: 0.85, fillOpacity: 0.2 };
        },
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 6,
                fillColor: '#16a34a',
                color: '#fff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.85,
            });
        },
        onEachFeature: function (feature, layer) {
            const cod = String(feature.properties && feature.properties.COD != null ? feature.properties.COD : '');

            // Index layer geometry by shape COD
            if (cod) {
                if (!efeShapeGeometries[cod]) efeShapeGeometries[cod] = [];
                efeShapeGeometries[cod].push(layer);
            }

            const projs = efeShapeToProjects[cod];
            if (!projs) return;

            const tooltip = projs.join('<br>');
            layer.bindTooltip(tooltip, { sticky: true, className: 'efe-map-tooltip' });

            layer.on('click', function (e) {
                L.DomEvent.stopPropagation(e);
                let targetProj = null;
                projs.forEach(projName => {
                    const proj = (window.EFE_DATA.data || []).find(p => p.name === projName);
                    if (proj && !targetProj) targetProj = proj;
                });
                if (targetProj) {
                    efeSelectProject(targetProj);
                }
            });

            layer.on('mouseover', function () {
                let targetProjName = projs[0];
                if (targetProjName && efeState.hoveredProjectName !== targetProjName) {
                    efeState.hoveredProjectName = targetProjName;
                    efeUpdateMapStyles();
                }
            });

            layer.on('mouseout', function () {
                if (efeState.hoveredProjectName !== null) {
                    efeState.hoveredProjectName = null;
                    efeUpdateMapStyles();
                }
            });
        }
    }).addTo(efeMap);

    efeUpdateMapBadge(projects.length, projects.length);

    // Initial render of train project markers
    efeRenderProjectMarkers(projects);
    efeUpdateMapStyles();

    [100, 300, 800].forEach(delay => {
        setTimeout(function () {
            if (efeMap) efeMap.invalidateSize();
        }, delay);
    });

    window.addEventListener('resize', function () {
        if (efeMap) efeMap.invalidateSize();
    });
}

// ─── Unified Map Styling (Selection & Dimming) ──────────────────────────────
function efeUpdateMapStyles() {
    const selectedName = efeState.selectedProjectName;
    const hoveredName = efeState.hoveredProjectName;

    const allProjects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];

    const selectedProj = selectedName ? allProjects.find(p => p.name === selectedName) : null;
    const selectedShapes = new Set(selectedProj ? (selectedProj.shapes || []).map(s => String(s)) : []);

    const hoveredProj = hoveredName ? allProjects.find(p => p.name === hoveredName) : null;
    const hoveredShapes = new Set(hoveredProj ? (hoveredProj.shapes || []).map(s => String(s)) : []);

    // 1. Update GeoJSON Vector Line/Polygon/Point Layer Styles
    if (efeGeoLayer) {
        efeGeoLayer.setStyle(function (feature) {
            const cod = String(feature.properties && feature.properties.COD != null ? feature.properties.COD : '');
            const hasProject = !!efeShapeToProjects[cod];
            if (!hasProject) {
                return { color: '#d1fae5', weight: 1, opacity: 0.15, fillOpacity: 0.02 };
            }

            const isSelected = selectedName && selectedShapes.has(cod);
            const isHovered = hoveredName && hoveredShapes.has(cod);

            if (selectedName) {
                if (isSelected) {
                    // Selected project shapes
                    return {
                        color: '#15803d',
                        weight: 5.5,
                        opacity: 1.0,
                        fillOpacity: 0.5,
                        fillColor: '#15803d'
                    };
                } else if (isHovered) {
                    // Hovered shapes while another project is selected
                    return {
                        color: '#16a34a',
                        weight: 4.5,
                        opacity: 0.85,
                        fillOpacity: 0.35,
                        fillColor: '#16a34a'
                    };
                } else {
                    // DIMMING for all non-selected shapes
                    return {
                        color: '#bbf7d0',
                        weight: 1.0,
                        opacity: 0.15,
                        fillOpacity: 0.02,
                        fillColor: '#bbf7d0'
                    };
                }
            } else {
                // No selection active
                if (isHovered) {
                    return {
                        color: '#15803d',
                        weight: 5.0,
                        opacity: 1.0,
                        fillOpacity: 0.4,
                        fillColor: '#15803d'
                    };
                } else {
                    // Normal default state for all shapes
                    return {
                        color: '#16a34a',
                        weight: 3.5,
                        opacity: 0.85,
                        fillOpacity: 0.25,
                        fillColor: '#16a34a'
                    };
                }
            }
        });
    }

    // 2. Update Train Icon Markers (Dimming & Scale safely on inner pulse element)
    efeProjectMarkers.forEach(marker => {
        if (!marker || !marker.getElement) return;
        const elem = marker.getElement();
        if (!elem) return;

        const pulse = elem.querySelector('.centroid-marker-pulse');
        if (!pulse) return;

        const isSelectedMarker = selectedName && marker.projectName === selectedName;
        const isHoveredMarker = hoveredName && marker.projectName === hoveredName;

        if (selectedName) {
            if (isSelectedMarker) {
                // Selected train icon marker
                pulse.classList.add('active-selected');
                pulse.classList.remove('dimmed');
                pulse.style.backgroundColor = '#15803d';
                elem.style.zIndex = '1000';
            } else if (isHoveredMarker) {
                pulse.classList.remove('active-selected');
                pulse.classList.remove('dimmed');
                pulse.style.backgroundColor = '#16a34a';
                elem.style.zIndex = '900';
            } else {
                // DIMMING for non-selected train icons
                pulse.classList.remove('active-selected');
                pulse.classList.add('dimmed');
                pulse.style.backgroundColor = '#16a34a';
                elem.style.zIndex = '1';
            }
        } else {
            // No selection active
            if (isHoveredMarker) {
                pulse.classList.remove('active-selected');
                pulse.classList.remove('dimmed');
                pulse.style.backgroundColor = '#15803d';
                elem.style.zIndex = '1000';
            } else {
                // Normal state for all train icons
                pulse.classList.remove('active-selected');
                pulse.classList.remove('dimmed');
                pulse.style.backgroundColor = '#16a34a';
                elem.style.zIndex = '100';
            }
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

    mapProjects.forEach(proj => {
        if (!proj.shapes || !Array.isArray(proj.shapes) || proj.shapes.length === 0) return;

        let matchedLayers = [];
        proj.shapes.forEach(shapeId => {
            const sid = String(shapeId).trim();
            const layersForShape = efeShapeGeometries[sid];
            if (layersForShape) matchedLayers.push(...layersForShape);
        });

        if (matchedLayers.length === 0) return;

        const isLine = matchedLayers.some(l => {
            if (l.feature && l.feature.geometry && l.feature.geometry.type) {
                return l.feature.geometry.type.toLowerCase().includes('line');
            }
            return (l instanceof L.Polyline) && !(l instanceof L.Polygon);
        });

        if (isLine) {
            // Line project: 1 train icon at exact path midpoint
            const midpoint = efeGetLineMidpoint(matchedLayers);
            if (midpoint) {
                const marker = efeCreateTrainMarker(proj, midpoint);
                if (marker) {
                    marker.addTo(efeMap);
                    efeProjectMarkers.push(marker);
                }
            }
        } else {
            // Point project: 1 icon per point (or mini dot if > 5 points)
            const isManyPoints = proj.shapes.length > 5;
            proj.shapes.forEach((shapeId, idx) => {
                const sid = String(shapeId).trim();
                const layersForShape = efeShapeGeometries[sid];
                if (layersForShape && layersForShape.length > 0) {
                    layersForShape.forEach(l => {
                        let center = l.getLatLng ? l.getLatLng() : (l.getBounds ? l.getBounds().getCenter() : null);
                        if (center) {
                            const isMini = isManyPoints && idx > 0;
                            const marker = efeCreateTrainMarker(proj, center, isMini);
                            if (marker) {
                                marker.addTo(efeMap);
                                efeProjectMarkers.push(marker);
                            }
                        }
                    });
                }
            });
        }
    });
}

function efeCreateTrainMarker(proj, latLng, isMiniDot = false) {
    let iconHtml = '';
    if (isMiniDot) {
        iconHtml = `<div class="centroid-marker-pulse" style="background-color: #16a34a; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #ffffff; box-shadow: 0 0 4px rgba(0,0,0,0.4); margin: 8px;"></div>`;
    } else {
        iconHtml = `<div class="centroid-marker-pulse" style="background-color: #16a34a;">${EFE_TRAIN_SVG}</div>`;
    }

    const customIcon = L.divIcon({
        className: 'polygon-centroid-marker',
        html: iconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
    });

    const marker = L.marker(latLng, { icon: customIcon });
    marker.projectName = proj.name;
    marker.bindTooltip(`<strong>${proj.name}</strong><br><span style="color:#94a3b8;font-size:0.7rem">${proj.region || ''}</span>`, { sticky: true, className: 'efe-map-tooltip' });

    marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        efeSelectProject(proj);
    });

    marker.on('mouseover', () => {
        efeState.hoveredProjectName = proj.name;
        efeUpdateMapStyles();
    });

    marker.on('mouseout', () => {
        efeState.hoveredProjectName = null;
        efeUpdateMapStyles();
    });

    return marker;
}

// ─── Zoom to Project (Fly to bounds or midpoint) ────────────────────────────
function efeZoomToProject(proj) {
    if (!efeMap || !proj) return;

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
                padding: [50, 50],
                maxZoom: 13
            });
            return;
        }
    }

    const midpoint = efeGetLineMidpoint(matchedLayers);
    if (midpoint) {
        efeMap.flyTo(midpoint, 12, { animate: true, duration: 1.2 });
    }
}

function efeResetMap() {
    efeState.selectedProjectName = null;
    efeState.hoveredProjectName = null;
    efeUpdateMapStyles();
    if (efeMap) efeMap.setView([-35.6751, -71.5430], 5);
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
