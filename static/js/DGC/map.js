function initLeafletMap() {
    // Center map on Chile's geographical center
    leafletMap = L.map('leaflet-map', {
        zoomControl: true,
        minZoom: 3,
        maxZoom: 18,
        zoomSnap: 0.5
    }).setView([-37.6751, -71.5430], 4.0);

    // Set initial theme tile layer
    tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2j8c_1_dacb4df364cf092be679e47d', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(leafletMap);
    // Load map layers asynchronously
    loadMapLayers();

    // Clear selected project selection when clicking on the map background
    leafletMap.on('click', () => {
        appState.selectedProjectCode = null;
        collapseSpiderLegs();
        updateMapStyles();
        showTableListView();
    });

    // Collapse spider legs when zoom changes
    leafletMap.on('zoomstart', () => {
        collapseSpiderLegs();
    });
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

function onEachRegionFeature(feature, layer) {
    let clickTimeout = null;

    layer.on({
        mouseover: (e) => {
            const l = e.target;
            const regionName = feature.properties ? feature.properties.Region : '';
            const dbRegionValue = mapGeojsonRegionToDbRegion(regionName);
            const isSelected = appState.selectedRegions && appState.selectedRegions.length > 0 && dbRegionValue && appState.selectedRegions.includes(dbRegionValue);

            l.setStyle({
                fillOpacity: isSelected ? 0.38 : 0.25,
                strokeOpacity: 0.85,
                weight: isSelected ? 2.5 : 1.5
            });
        },
        mouseout: (e) => {
            const l = e.target;
            l.setStyle(getRegionStyle(feature));
        },
        click: (e) => {
            const regionName = feature.properties ? feature.properties.Region : '';
            const dbRegionValue = mapGeojsonRegionToDbRegion(regionName);

            if (dbRegionValue) {
                if (clickTimeout) {
                    clearTimeout(clickTimeout);
                    clickTimeout = null;
                    return;
                }

                clickTimeout = setTimeout(() => {
                    clickTimeout = null;
                    const cb = document.querySelector(`.region-checkbox[value="${dbRegionValue}"]`);
                    if (cb) {
                        cb.checked = !cb.checked;
                        updateSelectedRegions();
                    }
                }, 250);
            }
        },
        dblclick: (e) => {
            L.DomEvent.stopPropagation(e);
            if (e.originalEvent) {
                e.originalEvent.preventDefault();
            }
            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
            }

            const regionName = feature.properties ? feature.properties.Region : '';
            const dbRegionValue = mapGeojsonRegionToDbRegion(regionName);

            if (dbRegionValue) {
                const cb = document.querySelector(`.region-checkbox[value="${dbRegionValue}"]`);
                if (cb && !cb.checked) {
                    cb.checked = true;
                    updateSelectedRegions();
                }

                fetchData().then(() => {
                    let groupBounds = L.latLngBounds();
                    const isValparaiso = dbRegionValue && dbRegionValue.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("valparaiso");

                    if (isValparaiso) {
                        function traverseLatLngs(latlngs) {
                            if (Array.isArray(latlngs)) {
                                if (latlngs.length > 0 && latlngs[0] instanceof L.LatLng) {
                                    latlngs.forEach(ll => {
                                        if (ll.lng >= -75.0) {
                                            groupBounds.extend(ll);
                                        }
                                    });
                                } else {
                                    latlngs.forEach(item => traverseLatLngs(item));
                                }
                            }
                        }
                        if (layer.getLatLngs) {
                            traverseLatLngs(layer.getLatLngs());
                        }
                        if (!groupBounds.isValid() && layer.getBounds) {
                            groupBounds = L.latLngBounds(layer.getBounds());
                        }
                    } else {
                        groupBounds = layer.getBounds ? L.latLngBounds(layer.getBounds()) : L.latLngBounds();
                    }

                    if (layers.dgc) {
                        layers.dgc.eachLayer(l => {
                            const lCode = l.feature && l.feature.properties && l.feature.properties.COD
                                ? l.feature.properties.COD.toString().trim()
                                : '';
                            const projCodesSet = shapeToProjectCodes[lCode];
                            let isActive = false;
                            if (projCodesSet) {
                                for (let pc of projCodesSet) {
                                    if (activeMapCodes.has(pc)) {
                                        isActive = true;
                                        break;
                                    }
                                }
                            }
                            if (isActive) {
                                if (l.getBounds) {
                                    groupBounds.extend(l.getBounds());
                                } else if (l.getLatLng) {
                                    groupBounds.extend(l.getLatLng());
                                }
                            }
                        });
                    }

                    if (groupBounds.isValid()) {
                        leafletMap.flyToBounds(groupBounds, {
                            animate: true,
                            duration: 1.5,
                            padding: [60, 60]
                        });
                    }
                });
            }
        }
    });

    if (feature.properties && feature.properties.Region) {
        layer.bindTooltip(`<b>${feature.properties.Region}</b>`, {
            sticky: true,
            className: 'custom-tooltip'
        });
    }
}

function getProjectPopupContent(code, sector) {
    const cleanCode = code ? code.toString().trim() : '';
    const proj = projectMetadata[cleanCode];

    if (proj) {
        const investmentFormatted = formatUFComplete(proj.investment);
        const secCfg = getSectorConfig(proj.sector);
        return `
            <div style="font-family: var(--font-sans); min-width: 220px;">
                <h3 style="margin: 0 0 6px 0; font-size: 0.9rem; font-weight: 600; color: var(--text-primary); line-height: 1.35; font-family: var(--font-heading);">${proj.name}</h3>
                <div style="font-size: 0.76rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.35rem; border-top: 1px solid var(--border-color); padding-top: 6px;">
                    <div><b>Estado:</b> <span class="badge ${proj.status === 'Operación' ? 'badge-success' : proj.status === 'Construcción' ? 'badge-info' : 'badge-warning'}" style="font-size: 0.68rem; padding: 0.1rem 0.35rem;">${proj.status}</span></div>
                    <div><b>Región:</b> ${proj.region}</div>
                </div>
            </div>
        `;
    } else {
        return `
            <div style="font-family: var(--font-sans); min-width: 180px;">
                <h3 style="margin: 0 0 6px 0; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); font-family: var(--font-heading);">Capa: ${sector}</h3>
                <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0; border-top: 1px solid var(--border-color); padding-top: 6px;">No se encontró información detallada en los contratos activos / filtrados.</p>
            </div>
        `;
    }
}

function onEachProjectFeature(feature, layer, sector) {
    const code = feature.properties && feature.properties.COD ? feature.properties.COD.toString().trim() : '';

    // Index feature geometry by shape COD
    if (code) {
        if (!shapeGeometries[code]) {
            shapeGeometries[code] = [];
        }
        shapeGeometries[code].push(layer);
    }

    // Vector geometry click handler
    layer.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        const projSet = shapeToProjectCodes[code];
        if (!projSet || projSet.size === 0) return;

        const activeCodesList = Array.from(projSet).filter(pc => activeMapCodes.has(pc));
        if (activeCodesList.length === 0) return;

        // Sort candidate project codes by tender_date descending (most recent first)
        activeCodesList.sort((a, b) => {
            const dateA = (projectMetadata[a] && projectMetadata[a].tender_date) || '';
            const dateB = (projectMetadata[b] && projectMetadata[b].tender_date) || '';
            if (dateA && !dateB) return -1;
            if (!dateA && dateB) return 1;
            return dateB.localeCompare(dateA);
        });

        zoomToProjectCode(activeCodesList[0]);
    });

    // Vector geometry hover highlight
    layer.on('mouseover', (e) => {
        const projSet = shapeToProjectCodes[code];
        if (!projSet || projSet.size === 0) return;
        const activeCodesList = Array.from(projSet).filter(pc => activeMapCodes.has(pc));
        if (activeCodesList.length === 0) return;

        activeCodesList.sort((a, b) => {
            const dateA = (projectMetadata[a] && projectMetadata[a].tender_date) || '';
            const dateB = (projectMetadata[b] && projectMetadata[b].tender_date) || '';
            if (dateA && !dateB) return -1;
            if (!dateA && dateB) return 1;
            return dateB.localeCompare(dateA);
        });

        const firstProj = activeCodesList[0];
        if (appState.hoveredProjectCode === firstProj) return;
        appState.hoveredProjectCode = firstProj;
        updateMapStyles();
    });

    layer.on('mouseout', (e) => {
        if (appState.hoveredProjectCode === null) return;
        appState.hoveredProjectCode = null;
        updateMapStyles();
    });
}

// Custom Principal Shapes mapping for multi-point concessions
const PRINCIPAL_SHAPES = {
    '050_ETTT1': '71' // Alameda - Exposición (Santiago/Estación Central)
};

async function loadMapLayers() {
    try {
        shapeGeometries = {};

        // Regions (VERSIÓN ESTÁTICA)
        const dataRegions = window.REGIONS_DATA || { type: 'FeatureCollection', features: [] };
        layers.regions = L.geoJSON(dataRegions, {
            style: getRegionStyle,
            onEachFeature: onEachRegionFeature
        }).addTo(leafletMap);

        // Consolidated DGC Layers (VERSIÓN ESTÁTICA)
        const dataDGC = window.DGC_DATA || { type: 'FeatureCollection', features: [] };
        layers.dgc = L.geoJSON(dataDGC, {
            style: (f) => getFeatureStyle(f, f.properties.Sector_DGC),
            pointToLayer: (feature, latlng) => {
                const invisibleIcon = L.divIcon({
                    className: 'dgc-hidden-point-marker',
                    html: '',
                    iconSize: [0, 0]
                });
                return L.marker(latlng, { icon: invisibleIcon, opacity: 0, interactive: false });
            },
            onEachFeature: (f, l) => onEachProjectFeature(f, l, f.properties.Sector_DGC)
        }).addTo(leafletMap);

        updateMapStyles();
        if (appState.lastMapProjects && appState.lastMapProjects.length > 0) {
            renderProjectMarkersOnMap(appState.lastMapProjects);
        }

    } catch (err) {
        console.error("Error al cargar capas del mapa:", err);
    }
}

// --- MIDPOINT CALCULATOR FOR LINES (50% DISTANCE ALONG THE PATH) ---
function getLineMidpoint(matchedLayers) {
    if (!matchedLayers || matchedLayers.length === 0) return null;

    let allSegments = [];
    matchedLayers.forEach(l => {
        if (l.getLatLngs) {
            const rawLatLngs = l.getLatLngs();
            function extractSegments(arr) {
                if (!Array.isArray(arr) || arr.length === 0) return;
                if (arr[0] instanceof L.LatLng || (arr[0] && typeof arr[0].lat === 'number')) {
                    if (arr.length >= 2) {
                        allSegments.push(arr);
                    }
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

    if (totalLength === 0) {
        return allSegments[0][0];
    }

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
                const lat = p1.lat + (p2.lat - p1.lat) * ratio;
                const lng = p1.lng + (p2.lng - p1.lng) * ratio;
                return L.latLng(lat, lng);
            }
            accumulated += dist;
        }
    }

    return allSegments[0][Math.floor(allSegments[0].length / 2)];
}

function getProjectCentroid(proj) {
    if (!proj || !proj.shapes || !Array.isArray(proj.shapes) || proj.shapes.length === 0) {
        return null;
    }
    let totalLat = 0;
    let totalLng = 0;
    let count = 0;

    proj.shapes.forEach(shapeId => {
        const sid = shapeId.toString().trim();
        const matchedLayers = shapeGeometries[sid];
        if (matchedLayers && matchedLayers.length > 0) {
            matchedLayers.forEach(l => {
                if (l.getBounds) {
                    const center = l.getBounds().getCenter();
                    totalLat += center.lat;
                    totalLng += center.lng;
                    count++;
                } else if (l.getLatLng) {
                    const center = l.getLatLng();
                    totalLat += center.lat;
                    totalLng += center.lng;
                    count++;
                }
            });
        }
    });

    if (count > 0) {
        return L.latLng(totalLat / count, totalLng / count);
    }
    return null;
}

function clearAllProjectMarkers() {
    Object.values(projectMarkersMap).forEach(markersArr => {
        if (Array.isArray(markersArr)) {
            markersArr.forEach(m => {
                if (m && leafletMap) leafletMap.removeLayer(m);
            });
        } else if (markersArr && leafletMap) {
            leafletMap.removeLayer(markersArr);
        }
    });
    projectMarkersMap = {};

    activeClusterMarkers.forEach(m => {
        if (m && leafletMap) leafletMap.removeLayer(m);
    });
    activeClusterMarkers = [];

    collapseSpiderLegs();
}

function collapseSpiderLegs() {
    activeSpiderLegs.forEach(obj => {
        if (obj && leafletMap) leafletMap.removeLayer(obj);
    });
    activeSpiderLegs = [];
    spiderfiedClusterGroupKey = null;
}

function createSingleProjectMarker(proj, latLng, isSpiderfied = false, isMiniDot = false) {
    const secCfg = getSectorConfig(proj.sector);
    const isSelected = proj.code === appState.selectedProjectCode;

    let iconHtml = '';
    if (isMiniDot) {
        iconHtml = `<div class="centroid-marker-pulse mini-dot-marker ${isSelected ? 'active-selected' : ''}" style="background-color: ${secCfg.color}; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #ffffff; box-shadow: 0 0 4px rgba(0,0,0,0.4); margin: 7px;"></div>`;
    } else {
        iconHtml = `<div class="centroid-marker-pulse ${isSelected ? 'active-selected' : ''}" style="background-color: ${secCfg.color};">${secCfg.svg}</div>`;
    }

    const customIcon = L.divIcon({
        className: 'polygon-centroid-marker',
        html: iconHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    const marker = L.marker(latLng, { icon: customIcon });
    marker.projectCode = proj.code;
    marker.projectSector = proj.sector;
    marker.isSpiderfied = isSpiderfied;
    marker.isMiniDot = isMiniDot;

    marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        zoomToProjectCode(proj.code);
    });

    marker.on('mouseover', () => {
        if (appState.hoveredProjectCode === proj.code) return;
        appState.hoveredProjectCode = proj.code;
        updateMapStyles();
    });

    marker.on('mouseout', () => {
        if (appState.hoveredProjectCode === null) return;
        appState.hoveredProjectCode = null;
        updateMapStyles();
    });

    return marker;
}

function renderProjectMarkersOnMap(mapProjects) {
    if (!leafletMap) return;

    clearAllProjectMarkers();

    if (!mapProjects || mapProjects.length === 0) return;

    let candidateEntries = [];

    mapProjects.forEach(proj => {
        if (!proj.shapes || !Array.isArray(proj.shapes) || proj.shapes.length === 0) return;

        let matchedLayers = [];
        proj.shapes.forEach(shapeId => {
            const sid = shapeId.toString().trim();
            const layersForShape = shapeGeometries[sid];
            if (layersForShape) {
                matchedLayers.push(...layersForShape);
            }
        });

        if (matchedLayers.length === 0) return;

        // Check if concession is LINE type
        const isLine = matchedLayers.some(l => {
            if (l.feature && l.feature.geometry && l.feature.geometry.type) {
                return l.feature.geometry.type.toLowerCase().includes('line');
            }
            return (l instanceof L.Polyline) && !(l instanceof L.Polygon);
        });

        if (isLine) {
            // Condition 1: Single icon on the midpoint of the line
            const midpoint = getLineMidpoint(matchedLayers);
            if (midpoint) {
                candidateEntries.push({
                    latLng: midpoint,
                    proj: proj,
                    shapeId: 'line',
                    isMiniDot: false
                });
            }
        } else {
            // Condition 2: Point / Polygon -> 1 icon per EACH shape/polygon/point
            const isManyPoints = proj.shapes.length > 5;
            const principalShape = PRINCIPAL_SHAPES[proj.code] || (proj.shapes[0] ? proj.shapes[0].toString().trim() : '');

            proj.shapes.forEach((shapeId, idx) => {
                const sid = shapeId.toString().trim();
                const layersForShape = shapeGeometries[sid];
                if (layersForShape && layersForShape.length > 0) {
                    layersForShape.forEach(l => {
                        let center = null;
                        if (l.getBounds) {
                            center = l.getBounds().getCenter();
                        } else if (l.getLatLng) {
                            center = l.getLatLng();
                        }
                        if (center) {
                            const isMini = isManyPoints && (sid !== principalShape);
                            candidateEntries.push({
                                latLng: center,
                                proj: proj,
                                shapeId: sid,
                                isMiniDot: isMini
                            });
                        }
                    });
                }
            });
        }
    });

    // Group candidate entries by location key
    // Condition 4 & Request: No spiderfy legs/clusters. Pick ONLY the entry with most recent tender_date.
    const locationMap = {};

    candidateEntries.forEach(entry => {
        const key = `${entry.latLng.lat.toFixed(4)},${entry.latLng.lng.toFixed(4)}`;
        if (!locationMap[key]) {
            locationMap[key] = [];
        }
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
        const proj = bestEntry.proj;
        const marker = createSingleProjectMarker(proj, bestEntry.latLng, false, bestEntry.isMiniDot);

        if (marker) {
            marker.addTo(leafletMap);
            marker.associatedProjectCodes = group.map(g => g.proj.code);

            group.forEach(entry => {
                const code = entry.proj.code;
                if (!projectMarkersMap[code]) {
                    projectMarkersMap[code] = [];
                }
                if (!projectMarkersMap[code].includes(marker)) {
                    projectMarkersMap[code].push(marker);
                }
            });
        }
    });

    updateMapStyles();
}

function updateMapStyles() {
    if (layers.regions) {
        layers.regions.setStyle(getRegionStyle);
    }

    if (layers.dgc) {
        layers.dgc.setStyle((f) => getFeatureStyle(f, f.properties.Sector_DGC));

        layers.dgc.eachLayer(l => {
            if (l.feature) {
                const code = l.feature.properties && l.feature.properties.COD ? l.feature.properties.COD.toString().trim() : '';
                const projSet = shapeToProjectCodes[code];
                if (projSet) {
                    const activeCodesList = Array.from(projSet).filter(pc => activeMapCodes.has(pc));
                    if (activeCodesList.length > 0) {
                        const isHovered = activeCodesList.includes(appState.hoveredProjectCode);
                        const isSelected = activeCodesList.includes(appState.selectedProjectCode);
                        if ((isHovered || isSelected) && l.bringToFront && !(l instanceof L.Marker)) {
                            l.bringToFront();
                        }
                    }
                }
            }

            if (l instanceof L.Marker && l.feature) {
                const code = l.feature.properties && l.feature.properties.COD ? l.feature.properties.COD.toString().trim() : '';
                const projSet = shapeToProjectCodes[code];
                let isActive = false;
                let activeProj = null;
                if (projSet) {
                    for (let pc of projSet) {
                        if (activeMapCodes.has(pc)) {
                            isActive = true;
                            activeProj = projectMetadata[pc];
                            break;
                        }
                    }
                }
                const selectedCode = appState.selectedProjectCode;
                const isSelected = activeProj && activeProj.code === selectedCode;
                const isHovered = activeProj && activeProj.code === appState.hoveredProjectCode;

                if (!isActive) {
                    l.setOpacity(0);
                    l.setZIndexOffset(-1000);
                    if (l.getElement()) {
                        l.getElement().style.pointerEvents = 'none';
                    }
                } else {
                    if (l.getElement()) {
                        l.getElement().style.pointerEvents = 'auto';
                    }
                    if (selectedCode) {
                        const isTarget = isSelected || isHovered;
                        l.setOpacity(isTarget ? 1.0 : 0.35);
                        l.setZIndexOffset(isTarget ? 1000 : 0);
                    } else {
                        l.setOpacity(1.0);
                        l.setZIndexOffset(100);
                    }

                    const sector = (activeProj && activeProj.sector) || l.feature.properties.Sector_DGC;
                    const secCfg = getSectorConfig(sector);

                    if (l.getElement()) {
                        const el = l.getElement().querySelector('.centroid-marker-pulse');
                        if (el) {
                            el.style.backgroundColor = secCfg.color;
                            if (isSelected) {
                                el.classList.add('active-selected');
                                el.style.transform = 'scale(1.35)';
                            } else if (isHovered) {
                                el.classList.remove('active-selected');
                                el.style.transform = 'scale(1.25)';
                            } else {
                                el.classList.remove('active-selected');
                                el.style.transform = '';
                            }
                        }
                    }
                }
            } else if (l.feature && !(l instanceof L.Marker)) {
                const code = l.feature.properties && l.feature.properties.COD ? l.feature.properties.COD.toString().trim() : '';
                const projSet = shapeToProjectCodes[code];
                let isActive = false;
                if (projSet) {
                    for (let pc of projSet) {
                        if (activeMapCodes.has(pc)) {
                            isActive = true;
                            break;
                        }
                    }
                }
                const isLayerActive = isActive;

                if (l.getElement()) {
                    l.getElement().style.pointerEvents = isLayerActive ? 'auto' : 'none';
                }
            }
        });
    }

    const selectedCode = appState.selectedProjectCode;
    const hoveredCode = appState.hoveredProjectCode;

    // Collect all unique marker instances
    const allUniqueMarkers = new Set();
    Object.values(projectMarkersMap).forEach(arr => {
        const list = Array.isArray(arr) ? arr : [arr];
        list.forEach(m => {
            if (m) allUniqueMarkers.add(m);
        });
    });

    allUniqueMarkers.forEach(marker => {
        if (!marker || !marker.getElement()) return;

        const codes = marker.associatedProjectCodes || [marker.projectCode];
        const isActiveInFilter = codes.some(c => activeMapCodes.has(c));
        const isSelected = codes.includes(selectedCode);
        const isHovered = codes.includes(hoveredCode);

        if (!isActiveInFilter) {
            marker.setOpacity(0);
            marker.setZIndexOffset(-1000);
            marker.getElement().style.pointerEvents = 'none';
        } else {
            marker.getElement().style.pointerEvents = 'auto';

            if (selectedCode) {
                const isTarget = isSelected || isHovered;
                marker.setOpacity(isTarget ? 1.0 : 0.35);
                marker.setZIndexOffset(isTarget ? 1000 : 100);
            } else {
                marker.setOpacity(1.0);
                marker.setZIndexOffset(100);
            }

            const el = marker.getElement().querySelector('.centroid-marker-pulse');

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
    });

    if (mapStatsBadge) {
        mapStatsBadge.textContent = `${activeMapCodes.size} contratos (${allUniqueMarkers.size} íconos)`;
    }
}

function zoomToProjectCode(code) {
    if (!leafletMap || !code) return;

    const cleanCode = code.toString().trim();
    const proj = projectMetadata[cleanCode];
    if (!proj) return;

    appState.selectedProjectCode = cleanCode;
    updateMapStyles();
    showProjectDetailView(cleanCode);

    let targetMarkers = projectMarkersMap[cleanCode];
    let targetMarker = (Array.isArray(targetMarkers) && targetMarkers.length > 0) ? targetMarkers[0] : (targetMarkers && !Array.isArray(targetMarkers) ? targetMarkers : null);
    let targetLatLng = targetMarker ? targetMarker.getLatLng() : getProjectCentroid(proj);

    let matchedLayers = [];
    let foundSector = proj.sector;

    if (layers.dgc && proj.shapes) {
        proj.shapes.forEach(shapeId => {
            const sid = shapeId.toString().trim();
            const layersForShape = shapeGeometries[sid];
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
            leafletMap.flyToBounds(combinedBounds, {
                animate: true,
                duration: 1.2,
                padding: [50, 50],
                maxZoom: 12
            });
            leafletMap.closePopup();
        }
    } else if (targetLatLng) {
        leafletMap.flyTo(targetLatLng, 11, { animate: true, duration: 1.2 });
        leafletMap.closePopup();
    }
}
