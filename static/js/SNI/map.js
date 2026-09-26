/**
 * static/js/SNI/map.js
 * Mapa Coroplético Regional Interactivo (D3.js) para SNI
 */

let sniChoropleth = null;
let sniTooltipEl = null;

function initSNIMap() {
    if (sniChoropleth) return;
    sniTooltipEl = document.getElementById('sni-map-tooltip');
    setupMapMetricSelectors();

    sniChoropleth = CatlecChoropleth.create('sni-map', {
        features: getD3SafeRegionFeatures(),
        onEnter: (event, feature) => {
            const { rawName, regionKey } = getRegionKeyForFeature(feature);
            showRegionTooltip(event, regionKey, rawName);
        },
        onMove: (event) => CatlecChoropleth.positionTooltip(sniTooltipEl, event),
        onLeave: () => hideRegionTooltip(),
        onDraw: () => updateSNIMapChoropleth()
    });
    if (sniChoropleth) sniChoropleth.redraw();
}

function drawOrResizeSNIMap() {
    if (sniChoropleth) sniChoropleth.redraw();
}

// Los anillos de window.REGIONS_DATA no vienen exactamente cerrados (el último
// punto es una versión redondeada del primero, no un duplicado exacto — un
// GeoJSON inválido según la especificación). Leaflet lo tolera (cierra el path
// SVG visualmente sin más), pero el recorte esférico de d3-geo es sensible a
// esto: un anillo "casi cerrado" puede hacer que d3 interprete el polígono
// como si cruzara un polo/antimeridiano, generando un complemento gigante en
// vez del polígono real. Se cierra explícitamente reemplazando el último punto
// por una copia exacta del primero.
function closeRing(ring) {
    const first = ring[0], last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return ring;
    return ring.slice(0, -1).concat([[first[0], first[1]]]);
}

// Área firmada de un anillo (fórmula del cordón de zapato/shoelace). Con esta
// fórmula, un anillo en sentido HORARIO (en el plano lon/lat, x=lon, y=lat)
// da un valor positivo.
function ringSignedArea(ring) {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        const p1 = ring[i], p2 = ring[i + 1];
        sum += (p2[0] - p1[0]) * (p2[1] + p1[1]);
    }
    return sum;
}

// Devuelve el anillo con el sentido de giro correcto para d3-geo (que procesa
// la geometría sobre la esfera y es sensible al winding order, a diferencia
// de Leaflet). Un anillo exterior con el sentido "equivocado" hace que d3-geo
// lo interprete como el COMPLEMENTO (todo el globo salvo ese recorte) en vez
// del polígono pequeño esperado — nunca muta el anillo original.
function rewoundRing(ring, wantClockwise) {
    const isClockwise = ringSignedArea(ring) > 0;
    return isClockwise === wantClockwise ? ring : ring.slice().reverse();
}

function rewoundPolygonCoords(coordinates) {
    // Anillo 0 = exterior (horario); anillos siguientes = huecos (antihorario)
    return coordinates.map((ring, i) => rewoundRing(closeRing(ring), i === 0));
}

function getD3SafeRegionFeatures() {
    if (window.SNI_REGIONS_DATA && window.SNI_REGIONS_DATA.features) {
        return window.SNI_REGIONS_DATA.features.filter(f => f && f.geometry);
    }
    const raw = (window.REGIONS_DATA && window.REGIONS_DATA.features) || [];
    return raw.filter(f => f && f.geometry).map(f => {
        const geom = f.geometry;
        let coordinates = geom.coordinates;
        if (geom.type === 'Polygon') {
            coordinates = rewoundPolygonCoords(geom.coordinates);
        } else if (geom.type === 'MultiPolygon') {
            coordinates = geom.coordinates.map(rewoundPolygonCoords);
        }
        return { type: 'Feature', properties: f.properties, geometry: { type: geom.type, coordinates } };
    });
}

function getRegionKeyForFeature(feature) {
    if (feature && feature._sniRegionKey) {
        return { rawName: feature._sniRawName, regionKey: feature._sniRegionKey };
    }
    const rawName = feature && feature.properties ? (feature.properties.Region || feature.properties.nom_reg) : '';
    const regionKey = normalizeGeoJSONRegionName(rawName);
    if (feature) {
        feature._sniRawName = rawName;
        feature._sniRegionKey = regionKey;
    }
    return { rawName, regionKey };
}

function setupMapMetricSelectors() {
    const buttons = document.querySelectorAll('.map-metric-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sniState.selectedMapMetric = btn.dataset.metric;
            updateSNIMapChoropleth();
        });
    });
}

function normalizeGeoJSONRegionName(geoName) {
    if (!geoName) return '';

    // Normalización de texto (remover tildes, comillas, apóstrofes, guiones)
    const norm = (str) => CatlecUtils.normalizeAccents(str || '')
        .replace(/['´`\-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const cleanGeo = norm(geoName);
    const regions = (window.SNI_DATA && window.SNI_DATA.filters && window.SNI_DATA.filters.regions) || [];

    // Reglas directas prioritarias por palabras clave representativas
    if (cleanGeo.includes('higgins')) return regions.find(r => norm(r).includes('higgins')) || '';
    if (cleanGeo.includes('bio') || cleanGeo.includes('biobio')) return regions.find(r => norm(r).includes('bio')) || '';
    if (cleanGeo.includes('metropolitana') || cleanGeo.includes('santiago')) return regions.find(r => norm(r).includes('metropolitana')) || '';
    if (cleanGeo.includes('araucania')) return regions.find(r => norm(r).includes('araucan')) || '';
    if (cleanGeo.includes('aysen') || cleanGeo.includes('ibanez')) return regions.find(r => norm(r).includes('ays')) || '';
    if (cleanGeo.includes('magallanes')) return regions.find(r => norm(r).includes('magallanes')) || '';
    if (cleanGeo.includes('los rios')) return regions.find(r => norm(r).includes('los rios')) || '';
    if (cleanGeo.includes('los lagos')) return regions.find(r => norm(r).includes('los lagos')) || '';
    if (cleanGeo.includes('arica')) return regions.find(r => norm(r).includes('arica')) || '';
    if (cleanGeo.includes('tarapaca')) return regions.find(r => norm(r).includes('tarapaca')) || '';
    if (cleanGeo.includes('antofagasta')) return regions.find(r => norm(r).includes('antofagasta')) || '';
    if (cleanGeo.includes('atacama')) return regions.find(r => norm(r).includes('atacama')) || '';
    if (cleanGeo.includes('coquimbo')) return regions.find(r => norm(r).includes('coquimbo')) || '';
    if (cleanGeo.includes('valparaiso')) return regions.find(r => norm(r).includes('valparaiso')) || '';
    if (cleanGeo.includes('maule')) return regions.find(r => norm(r).includes('maule')) || '';
    if (cleanGeo.includes('nuble')) return regions.find(r => norm(r).includes('nuble')) || '';

    // Búsqueda general por inclusión
    for (const r of regions) {
        const cleanR = norm(r.replace(/^\d+_/, ''));
        if (cleanGeo.includes(cleanR) || cleanR.includes(cleanGeo)) {
            return r;
        }
    }
    return '';
}

function getRegionMetricValue(regionKey) {
    const { regions } = getRegionalAggregates();
    const reg = regions.find(r => r.region === regionKey);
    if (!reg) return 0;

    switch (sniState.selectedMapMetric) {
        case 'per_capita':
            return reg.per_capita_clp;
        case 'km2':
            return reg.per_km2_clp;
        case 'pib_ratio':
            return reg.pib_ratio;
        case 'total':
        default:
            return reg.total_usd;
    }
}

function getChoroplethColor(value, maxVal, minVal) {
    if (value === null || value === undefined || isNaN(value) || value <= 0) {
        return '#cbd5e1';
    }

    const metric = (typeof sniState !== 'undefined' && sniState.selectedMapMetric) ? sniState.selectedMapMetric : 'total';

    if (maxVal === undefined || minVal === undefined) {
        if (typeof getRegionalAggregates === 'function') {
            const { regions } = getRegionalAggregates();
            const valid = regions.filter(r => !r.region.includes('No Regionalizada') && !r.region.includes('Exterior'));
            const vals = valid.map(r => {
                if (metric === 'per_capita') return r.per_capita_clp;
                if (metric === 'km2') return r.per_km2_clp;
                if (metric === 'pib_ratio') return r.pib_ratio;
                return r.total_usd;
            }).filter(v => typeof v === 'number' && v > 0);
            maxVal = vals.length > 0 ? Math.max(...vals) : 0;
            minVal = vals.length > 0 ? Math.min(...vals) : 0;
        } else {
            maxVal = 0;
            minVal = 0;
        }
    }

    if (maxVal <= 0) return '#cbd5e1';

    const norm = maxVal > minVal ? (value - minVal) / (maxVal - minVal) : 1;

    if (metric === 'per_capita') {
        return norm >= 0.80 ? '#047857' :
            norm >= 0.60 ? '#059669' :
                norm >= 0.40 ? '#10b981' :
                    norm >= 0.20 ? '#34d399' : '#6ee7b7';
    }

    if (metric === 'km2') {
        return norm >= 0.80 ? '#7c2d12' :
            norm >= 0.60 ? '#c2410c' :
                norm >= 0.40 ? '#ea580c' :
                    norm >= 0.20 ? '#f97316' : '#fdba74';
    }

    // Default: Total USD MM & pib_ratio
    return norm >= 0.85 ? '#1e3a8a' :
        norm >= 0.68 ? '#1d4ed8' :
            norm >= 0.50 ? '#2563eb' :
                norm >= 0.32 ? '#3b82f6' :
                    norm >= 0.15 ? '#60a5fa' : '#93c5fd';
}
window.getChoroplethColor = getChoroplethColor;

function showRegionTooltip(event, regionKey, rawName) {
    if (!sniTooltipEl) return;

    const { regions } = getRegionalAggregates();
    const reg = regions.find(r => r.region === regionKey);
    const val = getRegionMetricValue(regionKey);

    let metricText = '';
    switch (sniState.selectedMapMetric) {
        case 'per_capita':
            metricText = `Inversión Per Cápita: $${(val || 0).toLocaleString('es-CL')} CLP / hab`;
            break;
        case 'km2':
            metricText = `Inversión por km²: $${(val || 0).toLocaleString('es-CL')} CLP / km²`;
            break;
        case 'pib_ratio':
            metricText = `Ratio Inversión/PIB: ${(val || 0).toFixed(2)}x`;
            break;
        case 'total':
        default:
            metricText = `Inversión Total: US$ ${(val || 0).toLocaleString('es-CL')} MM`;
            break;
    }

    sniTooltipEl.innerHTML = `
        <strong>${rawName || regionKey}</strong>
        <span style="color:#60a5fa;font-weight:600;">${metricText}</span>
        <span style="color:#94a3b8;">Población: ${reg && reg.poblacion ? reg.poblacion.toLocaleString('es-CL') : 'N/A'} hab · Superficie: ${reg && reg.superficie_km2 ? reg.superficie_km2.toLocaleString('es-CL') + ' km²' : 'N/A'}</span>
    `;
    sniTooltipEl.classList.add('visible');
    CatlecChoropleth.positionTooltip(sniTooltipEl, event);
}

function hideRegionTooltip() {
    if (sniTooltipEl) sniTooltipEl.classList.remove('visible');
}

function updateSNIMapChoropleth() {
    if (!sniChoropleth) return;

    const { regions } = getRegionalAggregates();
    const metric = (typeof sniState !== 'undefined' && sniState.selectedMapMetric) ? sniState.selectedMapMetric : 'total';

    const valueMap = {};
    const validRegions = regions.filter(r => !r.region.includes('No Regionalizada') && !r.region.includes('Exterior'));
    validRegions.forEach(r => {
        if (metric === 'per_capita') valueMap[r.region] = r.per_capita_clp;
        else if (metric === 'km2') valueMap[r.region] = r.per_km2_clp;
        else if (metric === 'pib_ratio') valueMap[r.region] = r.pib_ratio;
        else valueMap[r.region] = r.total_usd;
    });

    const activeVals = Object.values(valueMap).filter(v => typeof v === 'number' && v > 0);
    const maxVal = activeVals.length > 0 ? Math.max(...activeVals) : 0;
    const minVal = activeVals.length > 0 ? Math.min(...activeVals) : 0;

    sniChoropleth.paths()
        .attr('fill', (d) => {
            const { regionKey } = getRegionKeyForFeature(d);
            const val = valueMap[regionKey] || 0;
            return getChoroplethColor(val, maxVal, minVal);
        });

    if (typeof updateMapMetricRankingChart === 'function') {
        updateMapMetricRankingChart();
    }
}
