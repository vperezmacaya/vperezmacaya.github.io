// Filtros de búsqueda, KPIs y aplicación de filtros sobre window.MOP_DATA

function populateFilters() {
    const { filters } = window.MOP_DATA;

    CatlecUtils.setupMultiselect('mop-region', filters.regions, 'Todas las regiones', 'regiones seleccionadas', (selected) => {
        selectedRegions = selected;
        applyFilters();
    });

    CatlecUtils.setupMultiselect('mop-servicio', filters.servicios, 'Todos los servicios', 'servicios seleccionados', (selected) => {
        selectedServicios = selected;
        applyFilters();
    }, {
        renderOptionLabel: (val) => (val.includes('Servicios Sanitarios Rurales') && !val.includes('(SSR)')) ? `${val} (SSR)` : val,
        formatSingleLabel: shortServiceName,
    });

    CatlecUtils.setupMultiselect('mop-etapa', filters.etapas, 'Todas las etapas', 'etapas seleccionadas', (selected) => {
        selectedEtapas = selected;
        applyFilters();
    });
}

function bindFilterEvents() {
    const searchInput = document.getElementById('mop-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', CatlecUtils.debounce(applyFilters, 300));
    }

    // Click outside closes dropdowns
    document.addEventListener('click', CatlecUtils.closeAllMultiselects);

    // Reset button
    const resetBtn = document.getElementById('mop-btn-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }

    // Export to Excel button
    const exportBtn = document.getElementById('mop-btn-export-excel');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportMOPToExcel);
    }
}

function resetFilters() {
    const searchInput = document.getElementById('mop-search-input');
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('.mop-region-checkbox, .mop-servicio-checkbox, .mop-etapa-checkbox, #mop-region-check-all, #mop-servicio-check-all, #mop-etapa-check-all').forEach(cb => {
        cb.checked = false;
    });

    selectedRegions = [];
    selectedServicios = [];
    selectedEtapas = [];

    const regionText = document.getElementById('mop-region-multiselect-text');
    if (regionText) regionText.textContent = 'Todas las regiones';

    const servicioText = document.getElementById('mop-servicio-multiselect-text');
    if (servicioText) servicioText.textContent = 'Todos los servicios';

    const etapaText = document.getElementById('mop-etapa-multiselect-text');
    if (etapaText) etapaText.textContent = 'Todas las etapas';

    CatlecUtils.closeAllMultiselects();

    // Restablecer ordenación de la tabla al orden original por defecto (descendente por costo total)
    sortColumn = 'cost_mm';
    sortDirection = 'desc';
    tableCurrentPage = 1;

    // Restablecer indicadores visuales de ordenación en las cabeceras
    document.querySelectorAll('.mop-data-table .mop-sortable, .mop-global-table .sort-th').forEach(t => {
        t.classList.remove('active-sort');
        const icon = t.querySelector('.mop-sort-icon');
        if (icon) icon.textContent = '⇅';
    });
    const defaultSortTh = document.querySelector('.mop-data-table [data-sort="cost_mm"], .mop-global-table [data-sort="cost_mm"]');
    if (defaultSortTh) {
        defaultSortTh.classList.add('active-sort');
        const defaultIcon = defaultSortTh.querySelector('.mop-sort-icon');
        if (defaultIcon) defaultIcon.textContent = '↓';
    }

    applyFilters();
}

function applyFilters() {
    if (typeof hideProjectDetail === 'function') hideProjectDetail();
    const matchSearch = CatlecUtils.createSearchMatcher(document.getElementById('mop-search-input')?.value);

    filteredProjects = window.MOP_DATA.projects.filter(p => {
        if (selectedRegions.length > 0 && !selectedRegions.includes(p.region)) return false;
        if (selectedServicios.length > 0 && !selectedServicios.includes(p.servicio)) return false;
        if (selectedEtapas.length > 0 && !selectedEtapas.includes(p.etapa)) return false;
        if (!matchSearch(p.nombre, p.bip)) return false;
        return true;
    });

    updateKPIs();
    renderAllCharts();
    updateProjectCount(filteredProjects.length);
}

function updateProjectCount(count) {
    const el = document.getElementById('mop-project-count');
    if (el) el.textContent = `${count} Proyectos`;
}

// ── KPIs ──────────────────────────────────────────────────────────────────
function updateKPIs() {
    const p = filteredProjects;
    const totalCost = p.reduce((s, r) => s + (r.cost_mm || 0), 0);
    const enEjec    = p.filter(r => r.etapa === 'EJECUCION').length;

    // Top servicio from filtered
    const srvCount = {};
    p.forEach(r => { if (r.servicio) srvCount[r.servicio] = (srvCount[r.servicio] || 0) + 1; });
    const topSrv = Object.entries(srvCount).sort((a,b) => b[1]-a[1])[0];

    setKPI('kpi-total-cost',    formatMM(totalCost), 'Millones CLP (inversión total)');
    setKPI('kpi-total-projects', p.length,           'Iniciativas en cartera');
    setKPI('kpi-top-servicio',  topSrv ? topSrv[0] : '—',
           topSrv ? `${topSrv[1]} proyectos` : '');
    setKPI('kpi-en-ejecucion',  enEjec, `${p.length > 0 ? ((enEjec/p.length)*100).toFixed(1) : 0}% del total filtrado`);
}

function setKPI(id, val, sub) {
    const card = document.getElementById(id);
    if (!card) return;
    const valEl = card.querySelector('.kpi-value') || card.querySelector('.kpi-val');
    const subEl = card.querySelector('.kpi-sub');
    if (valEl) valEl.textContent = val;
    if (subEl) subEl.textContent = sub;
}
