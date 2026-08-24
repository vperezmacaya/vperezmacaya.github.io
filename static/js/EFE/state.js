// ─── Estado global EFE ───────────────────────────────────────────────────────
let efeState = {
    search: '',
    selectedRegions: [],
    selectedFiliales: [],
    selectedProjectName: null,
    hoveredProjectName: null,
    sortBy: 'name',
    sortOrder: 'asc',
    page: 1,
    pageSize: 50,
    investmentOpen: false
};

// Leaflet Map state
let efeMap = null;
let efeTileLayer = null;
let efeRegionsGeoLayer = null;  // GeoJSON layer for regional boundaries
let efeGeoLayer = null;         // GeoJSON layer for all EFE shapes
let efeShapeToProjects = {};    // cod (int) -> array of project names
let efeHighlightedCods = new Set(); // currently highlighted shape CODs
let efeShapeGeometries = {};    // cod (string) -> array of Leaflet layer objects
let efeProjectMarkers = [];     // Array of train marker objects currently on map
let efeClusterOriginMarkers = []; // Array of cluster origin dot markers
let efeClusterLegLayers = [];     // Array of spiderfy connecting leg polylines

// Available filter options (hardcoded)
let efeAvailableRegions = [
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

let efeAvailableFiliales = [
    'EFE Valparaíso',
    'EFE Central',
    'EFE Sur'
];

// DOM Element References – initialized after DOMContentLoaded
var efeSearchInput,
    efeRegionMultiselectContainer, efeRegionMultiselectBtn, efeRegionMultiselectDropdown,
    efeRegionMultiselectText, efeRegionCheckAll, efeRegionOptionsList,
    efeFilialMultiselectContainer, efeFilialMultiselectBtn, efeFilialMultiselectDropdown,
    efeFilialMultiselectText, efeFilialCheckAll, efeFilialOptionsList,
    efeBtnReset,
    efeTableBody, efeEmptyState,
    efeCountLoaded, efeCountTotal,
    efeKpiTotalProjects, efeKpiTotalInvestment,
    efeBtnPrev, efeBtnNext, efePaginationInfo,
    efeMapStatsBadge, efeBtnResetMap,
    efeTableContainerView, efeProjectDetailView, efeDetailViewBody,
    efeBtnBackToTable, efeBtnDetailPrev, efeBtnDetailNext;

function efeInitDOMReferences() {
    efeSearchInput                  = document.getElementById('efe-search-input');
    efeRegionMultiselectContainer   = document.getElementById('efe-region-multiselect-container');
    efeRegionMultiselectBtn         = document.getElementById('efe-region-multiselect-btn');
    efeRegionMultiselectDropdown    = document.getElementById('efe-region-multiselect-dropdown');
    efeRegionMultiselectText        = document.getElementById('efe-region-multiselect-text');
    efeRegionCheckAll               = document.getElementById('efe-region-check-all');
    efeRegionOptionsList            = document.getElementById('efe-region-options-list');
    efeFilialMultiselectContainer   = document.getElementById('efe-filial-multiselect-container');
    efeFilialMultiselectBtn         = document.getElementById('efe-filial-multiselect-btn');
    efeFilialMultiselectDropdown    = document.getElementById('efe-filial-multiselect-dropdown');
    efeFilialMultiselectText        = document.getElementById('efe-filial-multiselect-text');
    efeFilialCheckAll               = document.getElementById('efe-filial-check-all');
    efeFilialOptionsList            = document.getElementById('efe-filial-options-list');
    efeBtnReset                     = document.getElementById('efe-btn-reset');
    efeTableBody                    = document.getElementById('efe-table-body');
    efeEmptyState                   = document.getElementById('efe-empty-state');
    efeCountLoaded                  = document.getElementById('efe-count-loaded');
    efeCountTotal                   = document.getElementById('efe-count-total');
    efeKpiTotalProjects             = document.getElementById('efe-kpi-total-projects');
    efeKpiTotalInvestment           = document.getElementById('efe-kpi-total-investment');
    efeBtnPrev                      = document.getElementById('efe-btn-prev');
    efeBtnNext                      = document.getElementById('efe-btn-next');
    efePaginationInfo               = document.getElementById('efe-pagination-info');
    efeMapStatsBadge                = document.getElementById('efe-map-stats-badge');
    efeBtnResetMap                  = document.getElementById('efe-btn-reset-map');
    efeTableContainerView          = document.getElementById('efe-table-container-view');
    efeProjectDetailView           = document.getElementById('efe-project-detail-view');
    efeDetailViewBody              = document.getElementById('efe-detail-view-body');
    efeBtnBackToTable              = document.getElementById('efe-btn-back-to-table');
    efeBtnDetailPrev               = document.getElementById('efe-btn-detail-prev');
    efeBtnDetailNext               = document.getElementById('efe-btn-detail-next');
}
