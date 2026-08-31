/**
 * static/js/SNI/map.js
 * Mapa Coroplético Regional Interactivo (Leaflet) para SNI
 */

let sniLeafletMap = null;
let sniTileLayer = null;
let sniGeoLayer = null;
let sniChoroplethLegend = null;

// Límites territoriales exactos de Chile Continental (Arica a Magallanes / Cabo de Hornos)
// Excluye la distorsión del extremo oceánico insular (Isla de Pascua en long -109°) para encuadre inicial perfecto
const CHILE_CONTINENTAL_BOUNDS = [
    [-55.98, -76.20], // Suroeste (Magallanes / Cabo de Hornos)
    [-17.50, -66.40]  // Noreste (Arica y Parinacota)
];

function initSNIMap() {
    const mapContainer = document.getElementById('sni-map');
    if (!mapContainer || sniLeafletMap) return;

    // Mapa interactivo con zoom y scroll habilitados
    sniLeafletMap = L.map('sni-map', {
        zoomControl: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        scrollWheelZoom: true,
        boxZoom: true,
        keyboard: true,
        attributionControl: false,
        zoomSnap: 0.1,
        minZoom: 3,
        maxZoom: 14
    });

    updateMapTileTheme();
    loadSNIGeoJSON();
    setupMapMetricSelectors();
    setupMapDetailCardClose();
    setupMapResetButton();
}

function setupMapResetButton() {
    const btnResetMap = document.getElementById('btn-reset-map');
    if (btnResetMap) {
        btnResetMap.addEventListener('click', () => {
            fitSNIMapBounds();
            const card = document.getElementById('map-region-detail-card');
            if (card) card.style.display = 'none';
            if (sniLeafletMap) sniLeafletMap.closePopup();
        });
    }
}

function fitSNIMapBounds() {
    if (!sniLeafletMap) return;
    try {
        sniLeafletMap.fitBounds(CHILE_CONTINENTAL_BOUNDS, {
            paddingTopLeft: [6, 6],
            paddingBottomRight: [6, 6],
            animate: false
        });
    } catch (e) {
        sniLeafletMap.setView([-37.0, -71.5], 4.2);
    }
}

function updateMapTileTheme() {
    if (!sniLeafletMap) return;
    const isDark = !document.body.classList.contains('light-theme');
    const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_2j8c_1_dacb4df364cf092be679e47d'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2j8c_1_dacb4df364cf092be679e47d';

    if (sniTileLayer) {
        sniLeafletMap.removeLayer(sniTileLayer);
    }

    sniTileLayer = L.tileLayer(tileUrl, {
        attribution: '',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(sniLeafletMap);
}

function setupMapMetricSelectors() {
    const buttons = document.querySelectorAll('.map-metric-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sniState.selectedMapMetric = btn.dataset.metric;
            updateSNIMapChoropleth();
            if (typeof updateMapMetricRankingChart === 'function') {
                updateMapMetricRankingChart();
            }
        });
    });
}

function loadSNIGeoJSON() {
    if (!window.REGIONS_DATA || !sniLeafletMap) return;

    if (sniGeoLayer) {
        sniLeafletMap.removeLayer(sniGeoLayer);
    }

    sniGeoLayer = L.geoJSON(window.REGIONS_DATA, {
        style: getRegionFeatureStyle,
        onEachFeature: onEachRegionFeature
    }).addTo(sniLeafletMap);

    fitSNIMapBounds();
    updateSNIMapChoropleth();
}

function normalizeGeoJSONRegionName(geoName) {
    if (!geoName) return '';

    // Normalización de texto (remover tildes, comillas, apóstrofes, guiones)
    const norm = (str) => (str || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/['´`\-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const cleanGeo = norm(geoName);
    const { regions } = getRegionalAggregates();

    // Reglas directas prioritarias por palabras clave representativas
    if (cleanGeo.includes('higgins')) return (regions.find(r => norm(r.region).includes('higgins')) || {}).region || '';
    if (cleanGeo.includes('bio') || cleanGeo.includes('biobio')) return (regions.find(r => norm(r.region).includes('bio')) || {}).region || '';
    if (cleanGeo.includes('metropolitana') || cleanGeo.includes('santiago')) return (regions.find(r => norm(r.region).includes('metropolitana')) || {}).region || '';
    if (cleanGeo.includes('araucania')) return (regions.find(r => norm(r.region).includes('araucan')) || {}).region || '';
    if (cleanGeo.includes('aysen') || cleanGeo.includes('ibanez')) return (regions.find(r => norm(r.region).includes('ays')) || {}).region || '';
    if (cleanGeo.includes('magallanes')) return (regions.find(r => norm(r.region).includes('magallanes')) || {}).region || '';
    if (cleanGeo.includes('los rios')) return (regions.find(r => norm(r.region).includes('los rios')) || {}).region || '';
    if (cleanGeo.includes('los lagos')) return (regions.find(r => norm(r.region).includes('los lagos')) || {}).region || '';
    if (cleanGeo.includes('arica')) return (regions.find(r => norm(r.region).includes('arica')) || {}).region || '';
    if (cleanGeo.includes('tarapaca')) return (regions.find(r => norm(r.region).includes('tarapaca')) || {}).region || '';
    if (cleanGeo.includes('antofagasta')) return (regions.find(r => norm(r.region).includes('antofagasta')) || {}).region || '';
    if (cleanGeo.includes('atacama')) return (regions.find(r => norm(r.region).includes('atacama')) || {}).region || '';
    if (cleanGeo.includes('coquimbo')) return (regions.find(r => norm(r.region).includes('coquimbo')) || {}).region || '';
    if (cleanGeo.includes('valparaiso')) return (regions.find(r => norm(r.region).includes('valparaiso')) || {}).region || '';
    if (cleanGeo.includes('maule')) return (regions.find(r => norm(r.region).includes('maule')) || {}).region || '';
    if (cleanGeo.includes('nuble')) return (regions.find(r => norm(r.region).includes('nuble')) || {}).region || '';

    // Búsqueda general por inclusión
    for (const r of regions) {
        const cleanR = norm(r.region.replace(/^\d+_/, ''));
        if (cleanGeo.includes(cleanR) || cleanR.includes(cleanGeo)) {
            return r.region;
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

function getChoroplethColor(value) {
    const metric = sniState.selectedMapMetric;

    if (metric === 'pib_ratio') {
        return value > 3.0 ? '#1e3a8a' :
            value > 2.0 ? '#2563eb' :
                value > 1.0 ? '#3b82f6' :
                    value > 0.7 ? '#60a5fa' :
                        value > 0 ? '#93c5fd' : '#cbd5e1';
    }

    if (metric === 'per_capita') {
        return value > 1200000 ? '#047857' :
            value > 700000 ? '#059669' :
                value > 450000 ? '#10b981' :
                    value > 250000 ? '#34d399' :
                        value > 0 ? '#6ee7b7' : '#cbd5e1';
    }

    if (metric === 'km2') {
        return value > 50000000 ? '#7c2d12' :
            value > 20000000 ? '#c2410c' :
                value > 10000000 ? '#ea580c' :
                    value > 3000000 ? '#f97316' :
                        value > 0 ? '#fdba74' : '#cbd5e1';
    }

    // Default: Total USD MM
    return value > 15000 ? '#1e3a8a' :
        value > 8000 ? '#1d4ed8' :
            value > 5000 ? '#2563eb' :
                value > 3000 ? '#3b82f6' :
                    value > 1500 ? '#60a5fa' :
                        value > 0 ? '#93c5fd' : '#cbd5e1';
}

function getRegionFeatureStyle(feature) {
    const rawName = feature.properties ? (feature.properties.Region || feature.properties.nom_reg) : '';
    const regionKey = normalizeGeoJSONRegionName(rawName);
    const value = getRegionMetricValue(regionKey);

    return {
        fillColor: getChoroplethColor(value),
        weight: 1.5,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.7
    };
}

function onEachRegionFeature(feature, layer) {
    const rawName = feature.properties ? (feature.properties.Region || feature.properties.nom_reg) : '';
    const regionKey = normalizeGeoJSONRegionName(rawName);

    layer.on({
        mouseover: (e) => {
            const l = e.target;
            l.setStyle({
                weight: 3,
                color: '#3b82f6',
                fillOpacity: 0.9
            });
            l.bringToFront();
            showRegionTooltip(e, regionKey, rawName);
        },
        mouseout: (e) => {
            if (sniGeoLayer) sniGeoLayer.resetStyle(e.target);
            hideRegionTooltip();
        },
        click: () => {
            selectRegionFromMap(regionKey);
        }
    });
}

function showRegionTooltip(e, regionKey, rawName) {
    const { regions } = getRegionalAggregates();
    const reg = regions.find(r => r.region === regionKey);
    const val = getRegionMetricValue(regionKey);

    let metricText = '';
    switch (sniState.selectedMapMetric) {
        case 'per_capita':
            metricText = `<strong>Inversión Per Cápita:</strong> $${(val || 0).toLocaleString()} CLP / hab`;
            break;
        case 'km2':
            metricText = `<strong>Inversión por km²:</strong> $${(val || 0).toLocaleString()} CLP / km²`;
            break;
        case 'pib_ratio':
            metricText = `<strong>Ratio Inversión/PIB:</strong> ${(val || 0).toFixed(2)}x`;
            break;
        case 'total':
        default:
            metricText = `<strong>Inversión Total:</strong> US$ ${(val || 0).toLocaleString()} MM`;
            break;
    }

    const popupContent = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; line-height: 1.4;">
            <div style="font-weight: 700; font-size: 13px; color: #2563eb; margin-bottom: 4px;">${rawName || regionKey}</div>
            <div>${metricText}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                Población: ${reg && reg.poblacion ? reg.poblacion.toLocaleString('es-CL') : 'N/A'} hab | 
                Superficie: ${reg && reg.superficie_km2 ? reg.superficie_km2.toLocaleString('es-CL') + ' km²' : 'N/A'}
            </div>
            <div style="font-size: 10px; color: #f59e0b; margin-top: 4px;"><em>Haz clic para ver detalles</em></div>
        </div>
    `;

    L.popup({
        offset: L.point(0, -10),
        closeButton: false,
        autoPan: false
    })
        .setLatLng(e.latlng)
        .setContent(popupContent)
        .openOn(sniLeafletMap);
}

function hideRegionTooltip() {
    if (sniLeafletMap) sniLeafletMap.closePopup();
}

function selectRegionFromMap(regionKey) {
    if (!regionKey) return;
    showRegionDetailCard(regionKey);
}

function showRegionDetailCard(regionKey) {
    const card = document.getElementById('map-region-detail-card');
    if (!card) return;

    const { regions } = getRegionalAggregates();
    const reg = regions.find(r => r.region === regionKey);
    if (!reg) return;

    const nameEl = document.getElementById('mrd-name');
    const totalEl = document.getElementById('mrd-total-usd');
    const perCapitaEl = document.getElementById('mrd-per-capita');
    const pobEl = document.getElementById('mrd-poblacion');
    const supEl = document.getElementById('mrd-superficie');

    if (nameEl) nameEl.innerText = reg.region.replace(/^\d+_/, '');
    if (totalEl) totalEl.innerText = `US$ ${reg.total_usd.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MM`;
    if (perCapitaEl) perCapitaEl.innerText = `$${Math.round(reg.per_capita_clp).toLocaleString('es-CL')} CLP / hab`;
    if (pobEl) pobEl.innerText = `${reg.poblacion.toLocaleString('es-CL')} hab`;
    if (supEl) supEl.innerText = `${reg.superficie_km2.toLocaleString('es-CL')} km²`;

    card.style.display = 'block';
    if (window.lucide) lucide.createIcons();
}

function setupMapDetailCardClose() {
    const btnClose = document.getElementById('btn-close-map-detail');
    const card = document.getElementById('map-region-detail-card');
    if (btnClose && card) {
        btnClose.addEventListener('click', (e) => {
            e.stopPropagation();
            card.style.display = 'none';
        });
    }
}

function updateSNIMapChoropleth() {
    if (!sniGeoLayer) return;
    sniGeoLayer.eachLayer(layer => {
        if (layer.feature) {
            layer.setStyle(getRegionFeatureStyle(layer.feature));
        }
    });
    if (typeof updateMapMetricRankingChart === 'function') {
        updateMapMetricRankingChart();
    }
}

