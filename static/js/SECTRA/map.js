// ─── Mapa Leaflet SECTRA (Líneas + Íconos Dinámicos en Punto Medio) ───────────

let sectraProjectMarkers = [];

function getSectraStatusColor(status) {
    const s = (status || '').toLowerCase();
    if (/ejecuci[oó]n|obra/i.test(s)) return '#059669'; // Verde Esmeralda
    if (/dise[ñn]o|ingenier/i.test(s)) return '#2563eb'; // Azul Real
    if (/prefactibilidad|factibilidad|anteproyecto/i.test(s)) return '#0891b2'; // Cian / Turquesa
    if (/perfil|estudio/i.test(s)) return '#d97706'; // Ámbar / Ocre
    return '#64748b'; // Pizarra
}

function getSectraFeatureStyle(feature, isSelected = false, isDimmed = false) {
    const p = (feature && feature.properties) || {};
    const status = p.status || '';
    const color = getSectraStatusColor(status);
    const isLine = feature.geometry && feature.geometry.type && feature.geometry.type.toLowerCase().includes('line');
    
    let opacity = 0.9;
    let fillOpacity = isLine ? 0 : 0.35;
    let weight = isLine ? 4.5 : 2.0;
    
    if (isSelected) {
        opacity = 1.0;
        fillOpacity = isLine ? 0 : 0.7;
        weight = isLine ? 8.0 : 4.0;
    } else if (isDimmed) {
        opacity = 0.15;
        fillOpacity = isLine ? 0 : 0.05;
        weight = isLine ? 1.5 : 1.0;
    }
    
    return {
        color: color,
        weight: weight,
        opacity: opacity,
        fillColor: color,
        fillOpacity: fillOpacity
    };
}

// ─── Cálculo del Punto Medio de Líneas (50% de la distancia total) ────────────
function getLineMidpoint(layer) {
    if (!layer) return null;
    
    let allSegments = [];
    if (layer.getLatLngs) {
        const rawLatLngs = layer.getLatLngs();
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
    } else if (layer.getLatLng) {
        return layer.getLatLng();
    }

    if (allSegments.length === 0) {
        return layer.getBounds ? layer.getBounds().getCenter() : null;
    }

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

function initSectraMap() {
    const mapEl = document.getElementById('sectra-map');
    if (!mapEl) return;
    
    // Centrar en Chile (Biobío / Gran Concepción como vista inicial)
    sectraMap = L.map('sectra-map', {
        center: [-36.82, -73.05],
        zoom: 11,
        zoomControl: true,
        minZoom: 3,
        maxZoom: 18,
        zoomSnap: 0.5
    });
    
    // Tile layer CartoDB Light Positron (Exactamente igual a index.html)
    sectraTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(sectraMap);
    
    // Capa de Regiones Geográficas (Sin highlight al hover, estática)
    if (window.REGIONS_DATA) {
        sectraRegionsGeoLayer = L.geoJSON(window.REGIONS_DATA, {
            style: {
                color: '#3b82f6',
                weight: 1.2,
                opacity: 0.45,
                dashArray: '3, 4',
                fillColor: '#3b82f6',
                fillOpacity: 0.04
            },
            interactive: false // Deshabilita hover / highlight en regiones
        }).addTo(sectraMap);
    }
    
    // Capa de Proyectos Vectoriales SECTRA
    loadSectraVectorLayers();
    
    // Al hacer click en el fondo del mapa (sin tocar una shape), volver a la lista
    sectraMap.on('click', () => {
        if (typeof showTableListView === 'function') {
            showTableListView();
        }
    });
    
    // Botón Restablecer Mapa
    const btnResetMap = document.getElementById('btn-reset-map');
    if (btnResetMap) {
        btnResetMap.addEventListener('click', () => {
            if (sectraGeoLayer && sectraGeoLayer.getLayers().length > 0) {
                sectraMap.fitBounds(sectraGeoLayer.getBounds(), { padding: [40, 40] });
            } else {
                sectraMap.setView([-36.82, -73.05], 11);
            }
        });
    }
}

function loadSectraVectorLayers() {
    if (!window.SECTRA_GEO_DATA) return;
    
    sectraProjectGeometries = {};
    
    // Limpiar marcadores previos si hubiese
    sectraProjectMarkers.forEach(m => {
        if (sectraMap && m) sectraMap.removeLayer(m);
    });
    sectraProjectMarkers = [];
    
    sectraGeoLayer = L.geoJSON(window.SECTRA_GEO_DATA, {
        style: (feature) => getSectraFeatureStyle(feature, false, false),
        pointToLayer: (feature, latlng) => {
            // Para features que son únicamente puntos (ej. Lota, Centro Concepción)
            const p = feature.properties || {};
            const marker = createSectraProjectMarker(p, latlng, null, feature);
            return marker;
        },
        onEachFeature: (feature, layer) => {
            const p = feature.properties || {};
            const projId = p.project_id || p.matched_project_id;
            const isLine = feature.geometry && feature.geometry.type && feature.geometry.type.toLowerCase().includes('line');
            
            const isPolygon = feature.geometry && feature.geometry.type && feature.geometry.type.toLowerCase().includes('polygon');
            
            if (projId) {
                if (!sectraProjectGeometries[projId]) {
                    sectraProjectGeometries[projId] = [];
                }
                sectraProjectGeometries[projId].push(layer);
            }
            
            // 1. Si es línea: generar el ícono en el punto medio (50% de la distancia)
            if (isLine) {
                const midpoint = getLineMidpoint(layer);
                if (midpoint) {
                    const marker = createSectraProjectMarker(p, midpoint, layer, feature);
                    if (marker) {
                        marker.addTo(sectraMap);
                        sectraProjectMarkers.push(marker);
                        if (projId) {
                            sectraProjectGeometries[projId].push(marker);
                        }
                    }
                }
            } 
            // 2. Si es polígono: generar el ícono en el centroide geográfico del polígono
            else if (isPolygon) {
                const center = layer.getBounds ? layer.getBounds().getCenter() : null;
                if (center) {
                    const marker = createSectraProjectMarker(p, center, layer, feature);
                    if (marker) {
                        marker.addTo(sectraMap);
                        sectraProjectMarkers.push(marker);
                        if (projId) {
                            sectraProjectGeometries[projId].push(marker);
                        }
                    }
                }
            }
            
            // Tooltip preview en la forma vectorial
            bindSectraTooltip(layer, p);
            
            // Eventos sobre la geometría vectorial
            layer.on({
                mouseover: (e) => {
                    const l = e.target;
                    if (l.setStyle) {
                        l.setStyle({ 
                            weight: isLine ? 7.0 : 3.5, 
                            opacity: 1.0, 
                            fillOpacity: isLine ? 0 : 0.65 
                        });
                    }
                },
                mouseout: (e) => {
                    const l = e.target;
                    const isDimmed = sectraState.selectedProjectId && sectraState.selectedProjectId !== projId;
                    const isSelected = sectraState.selectedProjectId && sectraState.selectedProjectId === projId;
                    const style = getSectraFeatureStyle(feature, isSelected, isDimmed);
                    if (l.setStyle) {
                        l.setStyle(style);
                    }
                },
                click: (e) => {
                    if (e && e.originalEvent) {
                        L.DomEvent.stopPropagation(e);
                    }
                    handleSectraProjectClick(p, projId);
                }
            });
        }
    }).addTo(sectraMap);
    
    // Fit bounds inicial
    if (sectraGeoLayer.getLayers().length > 0) {
        sectraMap.fitBounds(sectraGeoLayer.getBounds(), { padding: [40, 40] });
    }
}

// ─── Generador de Ícono de Proyecto (Lógica index.html) ───────────────────────
function createSectraProjectMarker(p, latlng, linkedLineLayer, feature) {
    const projId = p.project_id || p.matched_project_id;
    const status = p.status || 'En Estudio';
    const color = getSectraStatusColor(status);
    const isSelected = sectraState.selectedProjectId && (sectraState.selectedProjectId === projId);
    
    // Ícono SVG blanco de transporte / infraestructura vial
    const svgIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`;
    
    const iconHtml = `<div class="centroid-marker-pulse ${isSelected ? 'active-selected' : ''}" style="background-color: ${color};">${svgIcon}</div>`;
    
    const customIcon = L.divIcon({
        className: 'polygon-centroid-marker',
        html: iconHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    const marker = L.marker(latlng, { icon: customIcon });
    marker.projectId = projId;
    marker.projectData = p;
    marker.linkedLine = linkedLineLayer;
    
    bindSectraTooltip(marker, p);
    
    marker.on('click', (e) => {
        if (e && e.originalEvent) {
            L.DomEvent.stopPropagation(e);
        }
        handleSectraProjectClick(p, projId);
    });
    
    marker.on('mouseover', () => {
        if (linkedLineLayer && linkedLineLayer.setStyle) {
            linkedLineLayer.setStyle({ weight: 7.0, opacity: 1.0, fillOpacity: 0.65 });
        }
        const el = marker.getElement();
        if (el) {
            const pulse = el.querySelector('.centroid-marker-pulse');
            if (pulse) pulse.style.transform = 'scale(1.25)';
        }
    });
    
    marker.on('mouseout', () => {
        const isDimmed = sectraState.selectedProjectId && sectraState.selectedProjectId !== projId;
        const isSel = sectraState.selectedProjectId && sectraState.selectedProjectId === projId;
        if (linkedLineLayer && linkedLineLayer.setStyle) {
            linkedLineLayer.setStyle(getSectraFeatureStyle(feature || linkedLineLayer.feature, isSel, isDimmed));
        }
        const el = marker.getElement();
        if (el) {
            const pulse = el.querySelector('.centroid-marker-pulse');
            if (pulse) pulse.style.transform = isSel ? 'scale(1.35)' : '';
        }
    });
    
    return marker;
}

function bindSectraTooltip(target, p) {
    const status = p.status || 'En Estudio';
    const color = getSectraStatusColor(status);
    const popupContent = `
        <div style="font-family:'Plus Jakarta Sans', sans-serif; font-size:0.75rem; min-width: 170px;">
            <div style="font-size:0.65rem; color:${color}; font-weight:700; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                <span style="width:6px; height:6px; border-radius:50%; background:${color};"></span>
                ${p.region || 'Biobío'} · ${p.city || 'Gran Concepción'}
            </div>
            <strong style="color:var(--text-primary, #0f172a); font-size:0.82rem; display:block; margin:3px 0 2px 0;">${p.project_name || p.name || 'Proyecto SECTRA'}</strong>
            <div style="color:var(--text-secondary, #475569); font-size:0.7rem;">
                Estado: <strong style="color:${color}; font-weight:700;">${status}</strong>
            </div>
        </div>
    `;
    target.bindTooltip(popupContent, { sticky: true, className: 'sectra-map-tooltip' });
}

function handleSectraProjectClick(p, projId) {
    let found = null;
    if (projId && window.SECTRA_DATA && window.SECTRA_DATA.projects) {
        found = window.SECTRA_DATA.projects.find(x => x.id === projId);
    }
    if (!found && (p.project_name || p.name) && window.SECTRA_DATA && window.SECTRA_DATA.projects) {
        const targetName = (p.project_name || p.name || '').toLowerCase().trim();
        found = window.SECTRA_DATA.projects.find(x => 
            (x.name && x.name.toLowerCase().trim() === targetName) ||
            (x.name && targetName.includes(x.name.toLowerCase().trim())) ||
            (x.name && x.name.toLowerCase().trim().includes(targetName))
        );
    }
    
    if (found && typeof showProjectDetailView === 'function') {
        showProjectDetailView(found);
        zoomToProjectOnMap(found.id);
    } else if (typeof showProjectDetailView === 'function') {
        const rawDesc = typeof p.description === 'object' && p.description ? p.description.value : p.description;
        const cleanDesc = p.description_clean || (rawDesc ? rawDesc.replace(/<[^>]*>/g, ' ') : '');
        const directObj = {
            id: projId || p.name,
            name: p.project_name || p.name || 'Proyecto SECTRA',
            region: p.region || 'Región del Biobío',
            city: p.city || 'Gran Concepción',
            investment: p.investment,
            moneda: p.currency || 'UF',
            tir: p.tir,
            mandante: p.mandante || 'SERVIU / MOP',
            status: p.status || 'En Estudio',
            description: cleanDesc || 'Proyecto de la cartera de infraestructura SECTRA.',
            link: null
        };
        showProjectDetailView(directObj);
    }
}

function filterSectraMapLayers() {
    if (!sectraGeoLayer) return;
    
    const isFiltered = (
        (sectraState.search && sectraState.search.trim() !== '') ||
        sectraState.selectedRegions.length > 0 ||
        sectraState.selectedCities.length > 0 ||
        sectraState.selectedStatuses.length > 0 ||
        sectraState.selectedMandantes.length > 0
    );
    
    const filteredProjs = getFilteredProjects();
    const allowedIds = new Set(filteredProjs.map(p => p.id));
    const allowedNames = new Set(filteredProjs.map(p => (p.name || '').toLowerCase().trim()));
    
    // 1. Filtrar capas vectoriales (Líneas)
    sectraGeoLayer.eachLayer(layer => {
        const feature = layer.feature;
        if (!feature) return;
        const p = feature.properties || {};
        
        let isMatch = true;
        if (isFiltered) {
            const projId = p.project_id || p.matched_project_id;
            const projName = (p.project_name || p.name || '').toLowerCase().trim();
            const origName = (p.original_name || '').toLowerCase().trim();
            
            isMatch = (
                (projId && allowedIds.has(projId)) ||
                allowedNames.has(projName) ||
                allowedNames.has(origName)
            );
        }
        
        const isSelected = sectraState.selectedProjectId && (p.project_id === sectraState.selectedProjectId || p.matched_project_id === sectraState.selectedProjectId);
        const isDimmed = (isFiltered && !isMatch) || (sectraState.selectedProjectId && !isSelected);
        
        const style = getSectraFeatureStyle(feature, isSelected, isDimmed);
        if (layer.setStyle) {
            layer.setStyle(style);
        }
    });
    
    // 2. Filtrar marcadores (Íconos de punto medio)
    const allMarkers = [...sectraProjectMarkers];
    sectraGeoLayer.eachLayer(l => {
        if (l instanceof L.Marker && !allMarkers.includes(l)) {
            allMarkers.push(l);
        }
    });
    
    allMarkers.forEach(m => {
        const p = m.projectData || (m.feature && m.feature.properties) || {};
        const projId = m.projectId || p.project_id || p.matched_project_id;
        
        let isMatch = true;
        if (isFiltered) {
            const projName = (p.project_name || p.name || '').toLowerCase().trim();
            const origName = (p.original_name || '').toLowerCase().trim();
            isMatch = (
                (projId && allowedIds.has(projId)) ||
                allowedNames.has(projName) ||
                allowedNames.has(origName)
            );
        }
        
        const isSelected = sectraState.selectedProjectId && (projId === sectraState.selectedProjectId);
        const isDimmed = (isFiltered && !isMatch) || (sectraState.selectedProjectId && !isSelected);
        
        const el = m.getElement();
        if (el) {
            const pulse = el.querySelector('.centroid-marker-pulse');
            if (pulse) {
                if (isSelected) {
                    pulse.classList.add('active-selected');
                } else {
                    pulse.classList.remove('active-selected');
                }
            }
            if (isDimmed) {
                el.style.opacity = '0.15';
                el.style.pointerEvents = 'none';
            } else {
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
            }
        }
    });
}

function zoomToProjectOnMap(projectId) {
    if (!sectraMap || !projectId) return;
    
    // Actualizar estilos para resaltar la forma seleccionada
    filterSectraMapLayers();
    
    const layers = sectraProjectGeometries[projectId];
    if (layers && layers.length > 0) {
        const group = L.featureGroup(layers);
        sectraMap.fitBounds(group.getBounds(), { maxZoom: 15, padding: [50, 50] });
        layers.forEach(l => {
            if (l.openTooltip) l.openTooltip();
        });
    }
}
