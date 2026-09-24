// Estado global, paleta de color y configuración de Chart.js del dashboard Puertos

// ── Configuración HiDPI / Retina ──────────────────────────────────────────
if (typeof Chart !== 'undefined' && Chart.defaults) {
    Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    Chart.defaults.font.family = "'Helvetica Neue', Helvetica, Arial, sans-serif";
    Chart.defaults.font.size = 10;
}

// Instancias de Gráficos
const chartInstances = {};

// Paleta oficial CATLEC
const COLORS = {
    primary: '#6366f1',
    primaryAlpha: 'rgba(99, 102, 241, 0.82)',
    sky: '#0284c7',
    skyAlpha: 'rgba(2, 132, 199, 0.82)',
    amber: '#f59e0b',
    amberAlpha: 'rgba(245, 158, 11, 0.85)',
    emerald: '#10b981',
    emeraldAlpha: 'rgba(16, 185, 129, 0.85)',
    purple: '#8b5cf6',
    purpleAlpha: 'rgba(139, 92, 246, 0.82)',
    rose: '#f43f5e',
    roseAlpha: 'rgba(244, 63, 94, 0.82)',
    slate: '#64748b',
    slateAlpha: 'rgba(100, 116, 139, 0.82)',
    cyan: '#06b6d4',
    cyanAlpha: 'rgba(6, 182, 212, 0.82)',
    grid: '#e2e8f0',
    textPrimary: '#1e293b',
    textSecondary: '#64748b'
};

// ── Tooltip externo negro compartido para todos los gráficos de Puertos ───
// (réplica exacta del estándar investmentExternalTooltip de index.html)
const puertosExternalTooltip = CatlecTooltip.create({ domId: 'puertos-shared-tooltip' });

window.puertosCloseAllTooltips = function () {
    CatlecTooltip.hide('puertos-shared-tooltip');
};
