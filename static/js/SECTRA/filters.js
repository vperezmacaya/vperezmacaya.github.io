// ─── Control de Filtros & Multiselects SECTRA ───────────────────────────────

function initSectraFilters() {
    if (!window.SECTRA_DATA) return;
    
    sectraAvailableRegions = window.SECTRA_DATA.filters.regions || [];
    sectraAvailableCities = window.SECTRA_DATA.filters.cities || [];
    sectraAvailableStatuses = window.SECTRA_DATA.filters.statuses || [];
    sectraAvailableMandantes = window.SECTRA_DATA.filters.mandantes || [];
    
    // 1. Inicializar Multiselects
    CatlecUtils.setupMultiselect('region', sectraAvailableRegions, 'Todas las regiones', 'regiones seleccionadas', (selected) => {
        sectraState.selectedRegions = selected;
        updateCityMultiselect();
        sectraState.page = 1;
        onFilterChanged();
    });

    CatlecUtils.setupMultiselect('city', sectraAvailableCities, 'Todas las ciudades/áreas', 'ciudades/áreas seleccionadas', (selected) => {
        sectraState.selectedCities = selected;
        sectraState.page = 1;
        onFilterChanged();
    });

    CatlecUtils.setupMultiselect('status', sectraAvailableStatuses, 'Todos los estados', 'estados seleccionados', (selected) => {
        sectraState.selectedStatuses = selected;
        sectraState.page = 1;
        onFilterChanged();
    });

    CatlecUtils.setupMultiselect('mandante', sectraAvailableMandantes, 'Todos los mandantes', 'mandantes seleccionados', (selected) => {
        sectraState.selectedMandantes = selected;
        sectraState.page = 1;
        onFilterChanged();
    });
    
    // 2. Buscador reactivo
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', CatlecUtils.debounce((e) => {
            sectraState.search = e.target.value;
            sectraState.page = 1;
            onFilterChanged();
        }, 200));
    }
    
    // 3. Botón Restablecer
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.addEventListener('click', resetAllFilters);
    }
    
    // 4. Botón Exportar Excel
    const btnExport = document.getElementById('btn-export-excel');
    if (btnExport) {
        btnExport.addEventListener('click', exportSectraToExcel);
    }
    
    // 5. Subheader View Switcher
    setupViewSwitcher();
}

function updateCityMultiselect() {
    const listEl = document.getElementById('city-options-list');
    const textSpan = document.getElementById('city-multiselect-text');
    const checkAll = document.getElementById('city-check-all');
    if (!listEl || !window.SECTRA_DATA) return;

    let cities = [];
    if (sectraState.selectedRegions.length > 0) {
        const projs = window.SECTRA_DATA.projects.filter(p => sectraState.selectedRegions.includes(p.region));
        cities = Array.from(new Set(projs.map(p => p.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
    } else {
        cities = sectraAvailableCities;
    }

    // Solo se reconstruyen las opciones (la lista de ciudades depende de las
    // regiones seleccionadas); los listeners de botón/check-all/dropdown ya
    // quedaron delegados sobre listEl/checkAll en la llamada inicial de
    // CatlecUtils.setupMultiselect('city', ...) en initSectraFilters().
    listEl.innerHTML = '';
    cities.filter(Boolean).forEach(opt => {
        const label = document.createElement('label');
        label.className = 'multiselect-option';
        label.innerHTML = `<input type="checkbox" class="city-checkbox" value="${opt}"><span>${opt}</span>`;
        listEl.appendChild(label);
    });
    if (textSpan) textSpan.textContent = 'Todas las ciudades/áreas';
    if (checkAll) checkAll.checked = false;
    sectraState.selectedCities = [];
}

document.addEventListener('click', CatlecUtils.closeAllMultiselects);

function resetAllFilters() {
    sectraState.search = '';
    sectraState.selectedRegions = [];
    sectraState.selectedCities = [];
    sectraState.selectedStatuses = [];
    sectraState.selectedMandantes = [];
    sectraState.selectedProjectId = null;
    sectraState.page = 1;
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    
    ['region', 'city', 'status', 'mandante'].forEach(prefix => {
        const checkAll = document.getElementById(`${prefix}-check-all`);
        if (checkAll) checkAll.checked = false;
        const checkboxes = document.querySelectorAll(`.${prefix}-checkbox`);
        checkboxes.forEach(cb => cb.checked = false);
        const textSpan = document.getElementById(`${prefix}-multiselect-text`);
        if (textSpan) {
            if (prefix === 'region') textSpan.textContent = 'Todas las regiones';
            else if (prefix === 'city') textSpan.textContent = 'Todas las ciudades/áreas';
            else if (prefix === 'status') textSpan.textContent = 'Todos los estados';
            else if (prefix === 'mandante') textSpan.textContent = 'Todos los mandantes';
        }
    });
    
    updateCityMultiselect();
    onFilterChanged();
}

function onFilterChanged() {
    renderSectraKPIs();
    renderSectraTable();
    renderSectraConurbations();
    if (typeof updateQuickPieCharts === 'function') {
        updateQuickPieCharts();
    }
    if (typeof updateFullAnalyticsCharts === 'function') {
        updateFullAnalyticsCharts();
    }
    if (typeof filterSectraMapLayers === 'function') {
        filterSectraMapLayers();
    }
}

function setupViewSwitcher() {
    const btnMap = document.getElementById('btn-view-map');
    const btnConurb = document.getElementById('btn-view-conurbations');
    const btnAnalytics = document.getElementById('btn-view-analytics');
    
    const mapPanel = document.querySelector('.center-panel.map-panel');
    const rightPanel = document.querySelector('.right-panel.results-panel');
    const tableView = document.getElementById('table-container-view');
    const conurbView = document.getElementById('conurbations-container-view');
    const analyticsView = document.getElementById('analytics-container-view');
    
    function activateTab(tabBtn, viewName) {
        document.querySelectorAll('.view-tab-btn').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        sectraState.currentView = viewName;
        
        if (viewName === 'map') {
            if (mapPanel) mapPanel.style.display = 'block';
            if (rightPanel) rightPanel.style.display = 'flex';
            if (tableView) tableView.style.display = 'flex';
            if (conurbView) conurbView.style.display = 'none';
            if (analyticsView) analyticsView.style.display = 'none';
            if (sectraMap) {
                setTimeout(() => sectraMap.invalidateSize(), 150);
            }
        } else if (viewName === 'conurbations') {
            if (mapPanel) mapPanel.style.display = 'none';
            if (rightPanel) rightPanel.style.display = 'flex';
            if (tableView) tableView.style.display = 'none';
            if (conurbView) conurbView.style.display = 'flex';
            if (analyticsView) analyticsView.style.display = 'none';
            renderSectraConurbations();
        } else if (viewName === 'analytics') {
            if (mapPanel) mapPanel.style.display = 'none';
            if (rightPanel) rightPanel.style.display = 'flex';
            if (tableView) tableView.style.display = 'none';
            if (conurbView) conurbView.style.display = 'none';
            if (analyticsView) analyticsView.style.display = 'flex';
            if (typeof renderFullAnalyticsCharts === 'function') {
                renderFullAnalyticsCharts();
            }
        }
    }
    
    if (btnMap) btnMap.addEventListener('click', () => activateTab(btnMap, 'map'));
    if (btnConurb) btnConurb.addEventListener('click', () => activateTab(btnConurb, 'conurbations'));
    if (btnAnalytics) btnAnalytics.addEventListener('click', () => activateTab(btnAnalytics, 'analytics'));
}
