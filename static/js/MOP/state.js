// Estado global, paletas de color y configuración de Chart.js del dashboard MOP

const MOP_SERVICE_MAP = {
    'Dirección de Vialidad': '#2563eb',                    // Azul Real
    'Dirección de Obras Portuarias': '#0d9488',            // Verde azulado / Teal
    'Subdirección de Servicios Sanitarios Rurales': '#10b981', // Verde Esmeralda
    'Dirección de Aeropuertos': '#f59e0b',                 // Ámbar / Amarillo
    'Dirección de Obras Hidráulicas': '#8b5cf6',           // Violeta / Púrpura
    'Dirección de Arquitectura': '#f43f5e',                // Coral / Rosa
};

const DISTINCT_PALETTE = [
    '#2563eb', '#0d9488', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#ea580c'
];

const PALETTE_BLUE = [
    '#3b82f6','#0ea5e9','#6366f1','#8b5cf6','#06b6d4',
    '#0284c7','#14b8a6','#f59e0b','#10b981','#ef4444',
];
const PALETTE_ORANGE = [
    '#f97316','#fb923c','#fbbf24','#ef4444','#ec4899',
    '#a855f7','#0ea5e9','#22d3ee','#84cc16','#14b8a6',
];

// ── Chart.js defaults (estándar tipográfico CATLEC) ────────────────────────
Chart.defaults.font.family = "'Helvetica Neue', Helvetica, Arial, sans-serif";
Chart.defaults.font.size   = 10;
Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.padding  = 10;
Chart.defaults.plugins.tooltip.enabled = false;

// ── External Tooltip (Dark Floating Box aligned with EFE.html) ───────────
const mopExternalTooltip = CatlecTooltip.create({ domId: 'mop-analysis-tooltip' });

Chart.defaults.plugins.tooltip.external = mopExternalTooltip;

// ── Estado global de filtros, tabla y tabs ─────────────────────────────────
let charts = {};
let selectedRegions   = []; // empty = all
let selectedServicios = []; // empty = all
let selectedEtapas    = []; // empty = all
let filteredProjects  = [];

let tableCurrentPage = 1;
const TABLE_PAGE_SIZE = 25;
let sortColumn = 'cost_mm';
let sortDirection = 'desc';

let currentActiveTab = 'resumen';
