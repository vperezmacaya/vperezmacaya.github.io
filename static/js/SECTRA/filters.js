// ─── Control de Filtros & Multiselects SECTRA ───────────────────────────────

function initSectraFilters() {
    if (!window.SECTRA_DATA) return;
    
    sectraAvailableRegions = window.SECTRA_DATA.filters.regions || [];
    sectraAvailableCities = window.SECTRA_DATA.filters.cities || [];
    sectraAvailableStatuses = window.SECTRA_DATA.filters.statuses || [];
    sectraAvailableMandantes = window.SECTRA_DATA.filters.mandantes || [];
    
    // 1. Inicializar Multiselects
    setupCustomMultiselect('region', sectraAvailableRegions, 'Todas las regiones', (selected) => {
        sectraState.selectedRegions = selected;
        updateCityMultiselect();
        sectraState.page = 1;
        onFilterChanged();
    });
    
    setupCustomMultiselect('city', sectraAvailableCities, 'Todas las ciudades/áreas', (selected) => {
        sectraState.selectedCities = selected;
        sectraState.page = 1;
        onFilterChanged();
    });
    
    setupCustomMultiselect('status', sectraAvailableStatuses, 'Todos los estados', (selected) => {
        sectraState.selectedStatuses = selected;
        sectraState.page = 1;
        onFilterChanged();
    });
    
    setupCustomMultiselect('mandante', sectraAvailableMandantes, 'Todos los mandantes', (selected) => {
        sectraState.selectedMandantes = selected;
        sectraState.page = 1;
        onFilterChanged();
    });
    
    // 2. Buscador reactivo
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                sectraState.search = e.target.value;
                sectraState.page = 1;
                onFilterChanged();
            }, 200);
        });
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

function setupCustomMultiselect(idPrefix, options, defaultLabel, onChangeCallback) {
    const container = document.getElementById(`${idPrefix}-multiselect-container`);
    const btn = document.getElementById(`${idPrefix}-multiselect-btn`);
    const dropdown = document.getElementById(`${idPrefix}-multiselect-dropdown`);
    const textSpan = document.getElementById(`${idPrefix}-multiselect-text`);
    const checkAll = document.getElementById(`${idPrefix}-check-all`);
    const listEl = document.getElementById(`${idPrefix}-options-list`);
    
    if (!btn || !dropdown || !listEl) return;
    
    // Renderizar opciones
    renderMultiselectOptions(listEl, options, idPrefix);
    
    // Toggle dropdown
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display === 'block';
        closeAllMultiselects();
        dropdown.style.display = isOpen ? 'none' : 'block';
    });
    
    dropdown.addEventListener('click', (e) => e.stopPropagation());
    
    // Check all listener
    if (checkAll) {
        checkAll.addEventListener('change', () => {
            const checkboxes = listEl.querySelectorAll(`.${idPrefix}-checkbox`);
            checkboxes.forEach(cb => cb.checked = checkAll.checked);
            updateSelected();
        });
    }
    
    // Item checkbox listener
    listEl.addEventListener('change', (e) => {
        if (e.target.classList.contains(`${idPrefix}-checkbox`)) {
            const checkboxes = listEl.querySelectorAll(`.${idPrefix}-checkbox`);
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            if (checkAll) checkAll.checked = allChecked;
            updateSelected();
        }
    });
    
    function updateSelected() {
        const checkboxes = listEl.querySelectorAll(`.${idPrefix}-checkbox:checked`);
        const selectedValues = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedValues.length === 0 || selectedValues.length === options.length) {
            textSpan.textContent = defaultLabel;
            if (checkAll) checkAll.checked = selectedValues.length === options.length;
            onChangeCallback([]);
        } else if (selectedValues.length === 1) {
            textSpan.textContent = selectedValues[0];
            onChangeCallback(selectedValues);
        } else {
            textSpan.textContent = `${selectedValues.length} seleccionados`;
            onChangeCallback(selectedValues);
        }
    }
}

function renderMultiselectOptions(listEl, options, idPrefix) {
    listEl.innerHTML = '';
    options.forEach(opt => {
        if (!opt) return;
        const label = document.createElement('label');
        label.className = 'multiselect-option';
        label.innerHTML = `
            <input type="checkbox" class="${idPrefix}-checkbox" value="${opt}">
            <span>${opt}</span>
        `;
        listEl.appendChild(label);
    });
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
    
    renderMultiselectOptions(listEl, cities, 'city');
    if (textSpan) textSpan.textContent = 'Todas las ciudades/áreas';
    if (checkAll) checkAll.checked = false;
    sectraState.selectedCities = [];
}

function closeAllMultiselects() {
    document.querySelectorAll('.multiselect-dropdown').forEach(d => {
        d.style.display = 'none';
    });
}

document.addEventListener('click', closeAllMultiselects);

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
