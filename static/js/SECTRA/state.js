// ─── Estado global SECTRA ───────────────────────────────────────────────────
let sectraState = {
    search: '',
    selectedRegions: [],
    selectedCities: [],
    selectedStatuses: [],
    selectedMandantes: [],
    selectedProjectId: null,
    hoveredProjectId: null,
    currentView: 'map', // 'map' | 'conurbations' | 'analytics'
    sortBy: 'name',
    sortOrder: 'asc',
    page: 1,
    pageSize: 15,
};

// Leaflet Map state
let sectraMap = null;
let sectraTileLayer = null;
let sectraGeoLayer = null;
let sectraProjectGeometries = {}; // id or name -> array of Leaflet layer objects

// Chart instances
let regionInvChartInstance = null;
let regionCountChartInstance = null;
let fullRegionChartInstance = null;
let fullStatusChartInstance = null;

// Available filters
let sectraAvailableRegions = [];
let sectraAvailableCities = [];
let sectraAvailableStatuses = [];
let sectraAvailableMandantes = [];

// Palette colors for region charts
const regionPalette = [
    '#0ea5e9', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6',
    '#14b8a6', '#f43f5e', '#06b6d4', '#eab308', '#84cc16', '#a855f7',
    '#3b82f6', '#d946ef', '#64748b', '#78716c'
];

function formatNumberCL(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return Number(num).toLocaleString('es-CL');
}

function formatInvestment(inv, curr) {
    if (inv === null || inv === undefined || isNaN(inv)) return '<span class="text-muted">S/I</span>';
    const c = curr || 'UF';
    return `<strong>${formatNumberCL(inv)}</strong> <span style="font-size:0.68rem;color:var(--text-muted);">${c}</span>`;
}

function getFilteredProjects() {
    if (!window.SECTRA_DATA || !window.SECTRA_DATA.projects) return [];
    
    let projs = window.SECTRA_DATA.projects;
    const matchSearch = CatlecUtils.createSearchMatcher(sectraState.search);

    return projs.filter(p => {
        // Search Filter
        if (!matchSearch(p.name, p.description, p.city, p.region, p.mandante, p.status)) return false;
        
        // Region Filter
        if (sectraState.selectedRegions.length > 0) {
            if (!sectraState.selectedRegions.includes(p.region)) return false;
        }
        
        // City Filter
        if (sectraState.selectedCities.length > 0) {
            if (!sectraState.selectedCities.includes(p.city)) return false;
        }
        
        // Status Filter
        if (sectraState.selectedStatuses.length > 0) {
            if (!sectraState.selectedStatuses.includes(p.status)) return false;
        }
        
        // Mandante Filter
        if (sectraState.selectedMandantes.length > 0) {
            if (!sectraState.selectedMandantes.includes(p.mandante)) return false;
        }
        
        return true;
    });
}

function getFilteredConurbations() {
    if (!window.SECTRA_DATA || !window.SECTRA_DATA.conurbations) return [];
    let conurbs = window.SECTRA_DATA.conurbations;
    const matchSearch = CatlecUtils.createSearchMatcher(sectraState.search);

    return conurbs.filter(c => {
        if (!matchSearch(c.city, c.region)) return false;
        if (sectraState.selectedRegions.length > 0) {
            if (!sectraState.selectedRegions.includes(c.region)) return false;
        }
        if (sectraState.selectedCities.length > 0) {
            if (!sectraState.selectedCities.includes(c.city)) return false;
        }
        return true;
    });
}
