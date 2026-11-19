// Bootstrap de la interfaz: conecta filtros, tabla, paginación, mapa y exportaciones al cargar el DOM

// Filtros activos para la barra de celular (CatlecFilterDrawer): un filtro por
// campo; con 1 o 2 valores se nombran y con más se cuentan.
function dgcFilterSummary() {
    const labels = [];
    const search = (appState.search || '').trim();
    if (search) labels.push(`"${search}"`);
    const group = (values, plural) => {
        if (!values || !values.length) return;
        labels.push(values.length <= 2 ? values.join(', ') : `${values.length} ${plural}`);
    };
    group(appState.selectedRegions, 'regiones');
    group(appState.selectedSectors, 'sectores');
    group(appState.selectedStatuses, 'estados');
    return { count: labels.length, labels };
}

document.addEventListener('DOMContentLoaded', () => {
    initDOMReferences();
    initSubheaderViewSwitcher();

    // Separador mapa ↔ tabla. 500px: ancho mínimo en que se ven las 4 columnas
    // (anchos fijos 180 + 95 + 120 + 85 = 480px en styles.css + gutter y bordes)
    CatlecPanelResizer.init({
        resizer: '#dgc-panel-resizer',
        minWidth: 500,
        storageKey: 'catlec.dgc.tableWidth',
        getMap: () => leafletMap
    });

    if (btnBackToList) {
        btnBackToList.addEventListener('click', () => {
            showTableListView();
            appState.selectedProjectCode = null;
            updateMapStyles();
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

        showTableListView();
        fetchData();
    });

    // Celular (≤ 768 px): la tarjeta de filtros pasa a un panel inferior con
    // una barra "Filtros" bajo el subheader. En tablet (769-1100 px) sigue en
    // el panel izquierdo, que se despliega con su pestaña (DGC/vista-movil.js).
    // fetchData llama a update().
    window.dgcFilterDrawer = CatlecFilterDrawer.init({
        panel: '.panel-card-filters',
        after: '.view-subheader',
        media: '(max-width: 768px)',
        getSummary: dgcFilterSummary,
        getResultLabel: () => {
            const n = appState.filteredCount;
            if (n == null) return 'Ver resultados';
            return n === 1 ? 'Ver 1 contrato' : `Ver ${n.toLocaleString('es-CL')} contratos`;
        },
        onReset: () => btnReset.click()
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
            dgcApplyDefaultMapView(true);
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

    // Celular: la ficha del proyecto se abre sobre el mapa (DGC/project-detail.js).
    // Después de createIcons, para guardar el botón "Volver a la Lista" con su ícono.
    dgcSetupFichaMovil();
    // Celular: botón flotante Mapa / Lista (DGC/vista-movil.js)
    dgcSetupVistaMovil();

    // Initialize Timeline view events
    initTimelineEvents();
    initInvestmentEvents();
    initBiddersEvents();
});
