// Bootstrap de la interfaz: conecta filtros, tabla, paginación, mapa y exportaciones al cargar el DOM

document.addEventListener('DOMContentLoaded', () => {
    initDOMReferences();
    initSubheaderViewSwitcher();

    if (btnBackToList) {
        btnBackToList.addEventListener('click', () => {
            showTableListView();
            appState.selectedProjectCode = null;
            updateMapStyles();
            if (leafletMap) leafletMap.closePopup();
        });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', CatlecUtils.closeAllMultiselects);

    // Load initial filters and initial data load
    loadFilters().then(() => {
        fetchData();
    });

    // Bind search filter
    searchInput.addEventListener('input', CatlecUtils.debounce(() => {
        appState.search = searchInput.value;
        appState.page = 1;
        fetchData();
    }, 300));

    btnReset.addEventListener('click', () => {
        searchInput.value = '';
        appState.search = '';
        appState.selectedRegions = [];
        appState.selectedSectors = [];
        appState.selectedStatuses = [];
        appState.selectedProjectCode = null;
        appState.sortBy = 'Fecha inicio del contrato de concesión';
        appState.sortOrder = 'desc';

        document.querySelectorAll('.data-table th.sortable').forEach(el => {
            el.classList.remove('asc', 'desc');
            if (el.getAttribute('data-sort') === appState.sortBy) {
                el.classList.add(appState.sortOrder);
            }
        });

        document.querySelectorAll('.region-checkbox').forEach(cb => cb.checked = false);
        document.querySelectorAll('.sector-checkbox').forEach(cb => cb.checked = false);
        document.querySelectorAll('.status-checkbox').forEach(cb => cb.checked = false);
        if (regionCheckAll) regionCheckAll.checked = false;
        if (sectorCheckAll) sectorCheckAll.checked = false;
        if (statusCheckAll) statusCheckAll.checked = false;
        if (regionMultiselectText) regionMultiselectText.textContent = 'Todas las regiones';
        if (sectorMultiselectText) sectorMultiselectText.textContent = 'Todos los sectores';
        if (statusMultiselectText) statusMultiselectText.textContent = 'Todos los estados';
        if (layers.regions) layers.regions.setStyle(getRegionStyle);

        showTableListView();
        fetchData();
    });

    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            exportDGCToExcel();
        });
    }

    const btnExportGeoJSON = document.getElementById('btn-export-geojson');
    if (btnExportGeoJSON) {
        btnExportGeoJSON.addEventListener('click', () => {
            exportDGCToGeoJSON();
        });
    }

    btnResetMap.addEventListener('click', () => {
        if (leafletMap) {
            leafletMap.setView([-37.6751, -71.5430], 4.0);
        }
        appState.selectedProjectCode = null;
        showTableListView();
        updateMapStyles();
    });

    // Bind Pagination
    btnPrev.addEventListener('click', () => {
        if (appState.page > 1) {
            appState.page--;
            fetchData();
        }
    });

    btnNext.addEventListener('click', () => {
        appState.page++;
        fetchData();
    });

    // Bind Table Sorters
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortCol = th.getAttribute('data-sort');

            if (appState.sortBy === sortCol) {
                appState.sortOrder = appState.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                appState.sortBy = sortCol;
                appState.sortOrder = 'asc';
            }

            // CSS indicators
            document.querySelectorAll('.data-table th.sortable').forEach(el => {
                el.classList.remove('asc', 'desc');
            });
            th.classList.add(appState.sortOrder);

            fetchData();
        });
    });

    // Initialize Leaflet Map
    initLeafletMap();

    // Setup initial icons
    lucide.createIcons();

    // Initialize Timeline view events
    initTimelineEvents();
    initInvestmentEvents();
    initBiddersEvents();
});
