

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
let availableStatusesList = ['Construcción', 'Construcción y Operación', 'Finalizado', 'Operación'];

// Leaflet Map state and layers
let leafletMap = null;
let tileLayer = null;
let activeMapCodes = new Set();
let projectMetadata = {};
let shapeToProjectCodes = {};    // shape COD -> Set of project codes
let shapeGeometries = {};        // shape COD -> array of GeoJSON layer objects
let projectMarkersMap = {};      // project code -> Leaflet marker instance
let activeClusterMarkers = [];   // array of active cluster markers
let activeSpiderLegs = [];       // array of spider leg connector lines
let spiderfiedClusterGroupKey = null; // key of currently expanded cluster group
let layers = {
    regions: null,
    dgc: null
};


// Colors configurations for premium aesthetic
const chartColors = {
    dark: {
        grid: 'rgba(255,255,255,0.06)',
        text: '#94a3b8',
        palette: [
            '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
            '#0ea5e9', '#ec4899', '#f43f5e', '#14b8a6'
        ]
    },
    light: {
        grid: 'rgba(0,0,0,0.05)',
        text: '#4b5563',
        palette: [
            '#2563eb', '#7c3aed', '#059669', '#d97706',
            '#0284c7', '#db2777', '#e11d48', '#0d9488'
        ]
    }
};

// DOM elements
var searchInput = document.getElementById('search-input');

var regionMultiselectContainer = document.getElementById('region-multiselect-container');
var regionMultiselectBtn = document.getElementById('region-multiselect-btn');
var regionMultiselectDropdown = document.getElementById('region-multiselect-dropdown');
var regionMultiselectText = document.getElementById('region-multiselect-text');
var regionCheckAll = document.getElementById('region-check-all');
var regionOptionsList = document.getElementById('region-options-list');

var sectorMultiselectContainer = document.getElementById('sector-multiselect-container');
var sectorMultiselectBtn = document.getElementById('sector-multiselect-btn');
var sectorMultiselectDropdown = document.getElementById('sector-multiselect-dropdown');
var sectorMultiselectText = document.getElementById('sector-multiselect-text');
var sectorCheckAll = document.getElementById('sector-check-all');
var sectorOptionsList = document.getElementById('sector-options-list');

var statusMultiselectContainer = document.getElementById('status-multiselect-container');
var statusMultiselectBtn = document.getElementById('status-multiselect-btn');
var statusMultiselectDropdown = document.getElementById('status-multiselect-dropdown');
var statusMultiselectText = document.getElementById('status-multiselect-text');
var statusCheckAll = document.getElementById('status-check-all');
var statusOptionsList = document.getElementById('status-options-list');

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
    regionMultiselectContainer = document.getElementById('region-multiselect-container');
    regionMultiselectBtn = document.getElementById('region-multiselect-btn');
    regionMultiselectDropdown = document.getElementById('region-multiselect-dropdown');
    regionMultiselectText = document.getElementById('region-multiselect-text');
    regionCheckAll = document.getElementById('region-check-all');
    regionOptionsList = document.getElementById('region-options-list');
    sectorMultiselectContainer = document.getElementById('sector-multiselect-container');
    sectorMultiselectBtn = document.getElementById('sector-multiselect-btn');
    sectorMultiselectDropdown = document.getElementById('sector-multiselect-dropdown');
    sectorMultiselectText = document.getElementById('sector-multiselect-text');
    sectorCheckAll = document.getElementById('sector-check-all');
    sectorOptionsList = document.getElementById('sector-options-list');
    statusMultiselectContainer = document.getElementById('status-multiselect-container');
    statusMultiselectBtn = document.getElementById('status-multiselect-btn');
    statusMultiselectDropdown = document.getElementById('status-multiselect-dropdown');
    statusMultiselectText = document.getElementById('status-multiselect-text');
    statusCheckAll = document.getElementById('status-check-all');
    statusOptionsList = document.getElementById('status-options-list');
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
