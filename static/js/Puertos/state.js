// Estado global, paleta de color y configuración de Chart.js del dashboard Puertos

// ── Configuración HiDPI / Retina ──────────────────────────────────────────
if (typeof Chart !== 'undefined' && Chart.defaults) {
    Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    Chart.defaults.font.family = "'Helvetica Neue', Helvetica, Arial, sans-serif";
    Chart.defaults.font.size = 10;
}

// Instancias de Gráficos
const chartInstances = {};

// Paleta marina/naval propia de Puertos (sus valores se repiten en .puertos-c-* de puertos_addons.css)
const COLORS = {
    navy: '#1d3557',
    navyAlpha: 'rgba(29, 53, 87, 0.85)',
    ocean: '#3a7ca5',
    oceanAlpha: 'rgba(58, 124, 165, 0.82)',
    teal: '#2a9d8f',
    tealAlpha: 'rgba(42, 157, 143, 0.85)',
    sand: '#d9a23d',
    sandAlpha: 'rgba(217, 162, 61, 0.85)',
    coral: '#e76f51',
    coralAlpha: 'rgba(231, 111, 81, 0.85)',
    buoy: '#c1121f',
    buoyAlpha: 'rgba(193, 18, 31, 0.8)',
    steel: '#5c7185',
    steelAlpha: 'rgba(92, 113, 133, 0.82)',
    lagoon: '#4ea8c7',
    lagoonAlpha: 'rgba(78, 168, 199, 0.82)',
    foam: '#e8f1f7',
    grid: '#e2e8f0',
    textPrimary: '#1e293b',
    textSecondary: '#64748b'
};

// ── Tooltip externo negro compartido para todos los gráficos de Puertos ───
// (réplica exacta del estándar investmentExternalTooltip de DGC.html)
const puertosExternalTooltip = CatlecTooltip.create({ domId: 'puertos-shared-tooltip' });

window.puertosCloseAllTooltips = function () {
    CatlecTooltip.hide('puertos-shared-tooltip');
    const heatTip = document.getElementById('puertos-heatmap-tooltip');
    if (heatTip) heatTip.style.display = 'none';
};
