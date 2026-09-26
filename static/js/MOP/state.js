// Estado global, paletas de color y configuración de Chart.js del dashboard MOP

// Paleta institucional inspirada en mop.gob.cl (sus valores se repiten en .mop-c-* de mop_addons.css)
const MOP_COLORS = {
    navy: '#001c41',
    navyAlpha: 'rgba(0, 28, 65, 0.85)',
    blue: '#0c71c3',
    blueAlpha: 'rgba(12, 113, 195, 0.82)',
    sky: '#2ea3f2',
    skyAlpha: 'rgba(46, 163, 242, 0.82)',
    petrol: '#1e4f65',
    petrolAlpha: 'rgba(30, 79, 101, 0.85)',
    teal: '#2d717c',
    tealAlpha: 'rgba(45, 113, 124, 0.85)',
    orange: '#de702c',
    orangeAlpha: 'rgba(222, 112, 44, 0.85)',
    red: '#a51f15',
    redAlpha: 'rgba(165, 31, 21, 0.82)',
    stone: '#6b7280',
    stoneAlpha: 'rgba(107, 114, 128, 0.82)',
};

const MOP_SERVICE_MAP = {
    'Dirección de Vialidad': MOP_COLORS.blue,
    'Dirección de Obras Portuarias': MOP_COLORS.teal,
    'Subdirección de Servicios Sanitarios Rurales': MOP_COLORS.sky,
    'Dirección de Aeropuertos': MOP_COLORS.orange,
    'Dirección de Obras Hidráulicas': MOP_COLORS.petrol,
    'Dirección de Arquitectura': MOP_COLORS.red,
};

const DISTINCT_PALETTE = [
    MOP_COLORS.blue, MOP_COLORS.teal, MOP_COLORS.sky, MOP_COLORS.orange,
    MOP_COLORS.petrol, MOP_COLORS.red, MOP_COLORS.navy, MOP_COLORS.stone
];

// Etapas en orden de madurez, con escala secuencial del celeste al azul marino
const MOP_ETAPA_ORDER = ['PERFIL', 'PREFACTIBILIDAD', 'FACTIBILIDAD', 'DISEÑO', 'EJECUCION'];
const MOP_ETAPA_COLORS = {
    'PERFIL': '#9fd1f6',
    'PREFACTIBILIDAD': MOP_COLORS.sky,
    'FACTIBILIDAD': MOP_COLORS.blue,
    'DISEÑO': MOP_COLORS.petrol,
    'EJECUCION': MOP_COLORS.navy,
};

// Clases del mapa coroplético (de menor a mayor) y color sin datos
const MOP_CHORO_SCALE = ['#d6ecfb', '#9fd1f6', '#2ea3f2', '#0c71c3', '#0a4f8f', '#001c41'];
const MOP_CHORO_EMPTY = '#e5e7eb';

// Nombre de región en MOP_DATA → codregion de static/data/sni_regions_data.js
const MOP_REGION_CODES = {
    'Arica y Parinacota': 15,
    'Tarapacá': 1,
    'Antofagasta': 2,
    'Atacama': 3,
    'Coquimbo': 4,
    'Valparaíso': 5,
    'Metropolitana de Santiago': 13,
    "Libertador General Bernardo O'Higgins": 6,
    'Maule': 7,
    'Ñuble': 16,
    'Biobío': 8,
    'La Araucanía': 9,
    'Los Ríos': 14,
    'Los Lagos': 10,
    'Aysén del General Carlos Ibáñez del Campo': 11,
    'Magallanes y de la Antártica Chilena': 12,
};

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
let selectedMapMetric = 'total'; // 'total' | 'count' | 'avg'
