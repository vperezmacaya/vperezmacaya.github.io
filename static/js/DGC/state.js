// Chart.js defaults (estándar tipográfico CATLEC)
if (typeof Chart !== 'undefined' && Chart.defaults) {
    Chart.defaults.font.family = "'Helvetica Neue', Helvetica, Arial, sans-serif";
    Chart.defaults.font.size = 10;
}

// State variables
let appState = {
    search: '',
    selectedRegions: [],
    selectedSectors: [],
    selectedStatuses: [],
    page: 1,
    sortBy: 'Fecha inicio del contrato de concesión',
    sortOrder: 'desc',
    lastMapProjects: [], // cache for map render on lazy tab switch
    selectedProjectCode: null, // track selected project for dimming
    hoveredProjectCode: null,  // track hovered project code
    timelineOpen: false,       // timeline panel visibility flag
    investmentOpen: false,
    contractsOpen: false,      // contracts analytics panel visibility flag
    biddersOpen: false,        // bidders analytics panel visibility flag
    topCompaniesMode: 'participaciones' // 'participaciones' | 'adjudicaciones'
};

// Chart references
let sectorChartInstance = null;
let statusChartInstance = null;
let availableRegionsList = [
    'Arica y Parinacota',
    'Tarapacá',
    'Antofagasta',
    'Atacama',
    'Coquimbo',
    'Valparaíso',
    'Metropolitana',
    'O\'Higgins',
    'Maule',
    'Ñuble',
    'Biobío',
    'La Araucanía',
    'Los Ríos',
    'Los Lagos',
    'Aysén',
    'Magallanes'
];
let availableSectorsList = [
    'Vial interurbana',
    'Vial urbana',
    'Aeroportuaria',
    'Edificación pública y equipamiento urbano',
    'Hospitalaria',
    'Penitenciaria',
    'Soluciones hídricas'
];
let availableStatusesList = ['Construcción', 'Construcción y Operación', 'En Licitación', 'Finalizado', 'Operación'];

// Map state (MapLibre GL; `leafletMap` conserva su nombre heredado)
let leafletMap = null;
let activeMapCodes = new Set();
let projectMetadata = {};
let shapeToProjectCodes = {};    // shape COD -> Set of project codes
let shapeGeometries = {};        // shape COD -> array of GeoJSON features
let projectMarkersMap = {};      // project code -> array of MapLibre markers


// Colors configurations for premium aesthetic
const chartColors = {
    grid: 'rgba(0,0,0,0.05)',
    text: '#4b5563'
};

// DOM elements
var searchInput = document.getElementById('search-input');

var regionMultiselectText = document.getElementById('region-multiselect-text');
var regionCheckAll = document.getElementById('region-check-all');

var sectorMultiselectText = document.getElementById('sector-multiselect-text');
var sectorCheckAll = document.getElementById('sector-check-all');

var statusMultiselectText = document.getElementById('status-multiselect-text');
var statusCheckAll = document.getElementById('status-check-all');

var btnReset = document.getElementById('btn-reset');
var tableBody = document.getElementById('table-body');
var emptyState = document.getElementById('empty-state');
var countLoaded = document.getElementById('count-loaded');
var countTotal = document.getElementById('count-total');

var kpiTotal = document.getElementById('kpi-total');
var kpiInvestment = document.getElementById('kpi-investment');
var kpiTotalInfras = document.getElementById('kpi-total-infras');
var kpiBidders = document.getElementById('kpi-bidders');

var btnPrev = document.getElementById('btn-prev');
var btnNext = document.getElementById('btn-next');
var paginationInfo = document.getElementById('pagination-info');



var mapStatsBadge = document.getElementById('map-stats-badge');
var btnResetMap = document.getElementById('btn-reset-map');

var tableContainerView = document.getElementById('table-container-view');
var projectDetailView = document.getElementById('project-detail-view');
var btnBackToList = document.getElementById('btn-back-to-list');
var detailViewBody = document.getElementById('detail-view-body');
var detailViewSectorBadge = document.getElementById('detail-view-sector-badge');

var allLoadedContractsMap = {};


function initDOMReferences() {
    searchInput = document.getElementById('search-input');
    regionMultiselectText = document.getElementById('region-multiselect-text');
    regionCheckAll = document.getElementById('region-check-all');
    sectorMultiselectText = document.getElementById('sector-multiselect-text');
    sectorCheckAll = document.getElementById('sector-check-all');
    statusMultiselectText = document.getElementById('status-multiselect-text');
    statusCheckAll = document.getElementById('status-check-all');
    btnReset = document.getElementById('btn-reset');
    tableBody = document.getElementById('table-body');
    emptyState = document.getElementById('empty-state');
    countLoaded = document.getElementById('count-loaded');
    countTotal = document.getElementById('count-total');
    kpiTotal = document.getElementById('kpi-total');
    kpiInvestment = document.getElementById('kpi-investment');
    kpiTotalInfras = document.getElementById('kpi-total-infras');
    kpiBidders = document.getElementById('kpi-bidders');
    btnPrev = document.getElementById('btn-prev');
    btnNext = document.getElementById('btn-next');
    paginationInfo = document.getElementById('pagination-info');
    mapStatsBadge = document.getElementById('map-stats-badge');
    btnResetMap = document.getElementById('btn-reset-map');
    tableContainerView = document.getElementById('table-container-view');
    projectDetailView = document.getElementById('project-detail-view');
    btnBackToList = document.getElementById('btn-back-to-list');
    detailViewBody = document.getElementById('detail-view-body');
    detailViewSectorBadge = document.getElementById('detail-view-sector-badge');
}
