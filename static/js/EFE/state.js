// ─── Estado global EFE ───────────────────────────────────────────────────────
var efeState = {
    search: '',
    selectedFiliales: [],
    selectedDetails: [],
    selectedTipos: [],
    selectedProjectName: null,
    hoveredProjectName: null,
    sortBy: 'investment_mm_usd',
    sortOrder: 'desc',
    page: 1,
    pageSize: 50,
    investmentOpen: false,
    timelineOpen: false
};
if (typeof window !== 'undefined') window.efeState = efeState;

// Helper de clasificación de Detalle / Portafolio
function efeGetDetailCategory(detailStr) {
    if (!detailStr || String(detailStr).trim() === '' || String(detailStr).trim().toLowerCase() === 'nan') {
        return 'Otros / Extra';
    }
    const s = String(detailStr).trim().toLowerCase();
    if (s.includes('estrat') || s.includes('portafolio')) {
        return 'Portafolio de Proyectos Estratégicos';
    }
    if (s.includes('preinvers')) {
        return 'Proyectos Preinversionales';
    }
    return 'Otros / Extra';
}

// Colores consistentes por Tipo de Proyecto
const EFE_TIPO_COLORS = {
    'Expansión': '#2563eb',             // Royal Blue
    'Mejoramiento': '#059669',          // Emerald
    'Ampliación': '#0284c7',            // Sky Blue
    'Reposición': '#d97706',            // Amber / Orange
    'Mejoramiento Sistemas': '#8b5cf6', // Purple
    'Logística': '#e11d48'              // Rose / Crimson
};

// Generador de Iconos SVG según Tipo de Proyecto
function efeGetProjectTypeSvg(tipo, w = 13, h = 13, stroke = 'currentColor') {
    const t = tipo ? String(tipo).trim().toLowerCase() : '';

    // 1. Expansión: Rutas/vías en expansión (flechas divergentes / bifurcación hacia adelante)
    if (t.includes('expansi')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    }

    // 2. Ampliación: Aumento de estaciones y capacidad (geometría en expansión)
    if (t.includes('amplia')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>`;
    }

    // 3. Reposición: Reemplazo de material rodante y trenes (recambio cíclico / tren renovado)
    if (t.includes('reposici') || t.includes('rodante')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>`;
    }

    // 4. Mejoramiento: Obras de infraestructura, puentes y vías existentes (upgrade / superación)
    if (t.includes('mejoramiento') && !t.includes('sistema')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
    }

    // 5. Logística: Terminales de carga, intermodal, desvíos trenes 600m
    if (t.includes('log') || t.includes('carga') || t.includes('desv')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>`;
    }

    // 6. Mejoramiento Sistemas: Medios de pago, señalización virtual CSV, tecnología
    if (t.includes('sistema') || t.includes('seña') || t.includes('pago')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`;
    }

    // Default: Tren estándar
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 31h8"/><path d="M4 11V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6"/><path d="M4 11h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z"/><line x1="8" y1="15" x2="8.01" y2="15"/><line x1="16" y1="15" x2="16.01" y2="15"/><path d="m9 19-3 3"/><path d="m15 19 3 3"/></svg>`;
}

// Leaflet Map state
var efeMap = null;
var efeTileLayer = null;
var efeRegionsGeoLayer = null;  // GeoJSON layer for regional boundaries
var efeGeoLayer = null;         // GeoJSON layer for all EFE shapes
var efeMetroGeoLayer = null;    // GeoJSON layer for Metro de Santiago lines
var efeMetroPointsLayer = null; // GeoJSON layer for Metro de Santiago stations
var efeEstacionesGeoLayer = null; // GeoJSON layer for EFE active passenger stations
var efeShapeToProjects = {};    // cod (int) -> array of project names
var efeHighlightedCods = new Set(); // currently highlighted shape CODs
var efeShapeGeometries = {};    // cod (string) -> array of Leaflet layer objects
var efeProjectMarkers = [];     // Array of train marker objects currently on map
var efeClusterOriginMarkers = []; // Array of cluster origin dot markers
var efeClusterLegLayers = [];     // Array of spiderfy connecting leg polylines
var efeShowEfeLines = true;       // Toggle for EFE passenger lines layer
var efeShowMetroLines = true;     // Toggle for Metro lines and stations layer

let efeAvailableFiliales = [
    'EFE Valparaíso',
    'EFE Central',
    'EFE Sur',
    'EFE Arica - La Paz',
    'Sin filial específica'
];

let efeAvailableDetails = [
    'Portafolio de Proyectos Estratégicos',
    'Proyectos Preinversionales',
    'Otros / Extra'
];

let efeAvailableTipos = [
    'Expansión',
    'Ampliación',
    'Reposición',
    'Mejoramiento',
    'Logística',
    'Mejoramiento Sistemas'
];

// DOM Element References – initialized after DOMContentLoaded
var efeSearchInput,
    efeFilialMultiselectContainer, efeFilialMultiselectBtn, efeFilialMultiselectDropdown,
    efeFilialMultiselectText, efeFilialCheckAll, efeFilialOptionsList,
    efeDetailMultiselectContainer, efeDetailMultiselectBtn, efeDetailMultiselectDropdown,
    efeDetailMultiselectText, efeDetailCheckAll, efeDetailOptionsList,
    efeTipoMultiselectContainer, efeTipoMultiselectBtn, efeTipoMultiselectDropdown,
    efeTipoMultiselectText, efeTipoCheckAll, efeTipoOptionsList,
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
    efeFilialMultiselectContainer   = document.getElementById('efe-filial-multiselect-container');
    efeFilialMultiselectBtn         = document.getElementById('efe-filial-multiselect-btn');
    efeFilialMultiselectDropdown    = document.getElementById('efe-filial-multiselect-dropdown');
    efeFilialMultiselectText        = document.getElementById('efe-filial-multiselect-text');
    efeFilialCheckAll               = document.getElementById('efe-filial-check-all');
    efeFilialOptionsList            = document.getElementById('efe-filial-options-list');
    efeDetailMultiselectContainer   = document.getElementById('efe-detail-multiselect-container');
    efeDetailMultiselectBtn         = document.getElementById('efe-detail-multiselect-btn');
    efeDetailMultiselectDropdown    = document.getElementById('efe-detail-multiselect-dropdown');
    efeDetailMultiselectText        = document.getElementById('efe-detail-multiselect-text');
    efeDetailCheckAll               = document.getElementById('efe-detail-check-all');
    efeDetailOptionsList            = document.getElementById('efe-detail-options-list');
    efeTipoMultiselectContainer     = document.getElementById('efe-tipo-multiselect-container');
    efeTipoMultiselectBtn           = document.getElementById('efe-tipo-multiselect-btn');
    efeTipoMultiselectDropdown      = document.getElementById('efe-tipo-multiselect-dropdown');
    efeTipoMultiselectText          = document.getElementById('efe-tipo-multiselect-text');
    efeTipoCheckAll                 = document.getElementById('efe-tipo-check-all');
    efeTipoOptionsList              = document.getElementById('efe-tipo-options-list');
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
