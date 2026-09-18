
// Carga estática de filtros desde window.STATIC_DATA
async function loadFilters() {
    const data = window.STATIC_DATA || {};

    const statuses = (data.stats && data.stats.status)
        ? Object.keys(data.stats.status).sort()
        : availableStatusesList;
    availableStatusesList = statuses;

    CatlecUtils.setupMultiselect('region', availableRegionsList, 'Todas las regiones', 'regiones seleccionadas', (selected) => {
        appState.selectedRegions = selected;
        appState.page = 1;
        appState.selectedProjectCode = null;
        if (layers.regions) layers.regions.setStyle(getRegionStyle);
        fetchData();
    });

    CatlecUtils.setupMultiselect('sector', availableSectorsList, 'Todos los sectores', 'sectores seleccionados', (selected) => {
        appState.selectedSectors = selected;
        appState.page = 1;
        appState.selectedProjectCode = null;
        fetchData();
    });

    CatlecUtils.setupMultiselect('status', availableStatusesList, 'Todos los estados', 'estados seleccionados', (selected) => {
        appState.selectedStatuses = selected;
        appState.page = 1;
        appState.selectedProjectCode = null;
        fetchData();
    });
}



function staticFetchData(params) {
    const allData = (window.STATIC_DATA && window.STATIC_DATA.data) || [];
    const searchRaw = params.get('search') || '';
    const regionRaw = params.get('region') || '';
    const sectorRaw = params.get('sector') || '';
    const statusRaw = params.get('status') || '';
    const sortBy = params.get('sort_by') || 'Fecha inicio del contrato de concesión';
    const sortOrder = params.get('sort_order') || 'asc';
    const page = parseInt(params.get('page') || '1', 10);

    const PAGE_SIZE = 50;

    const searchNorm = CatlecUtils.normalizeAccents(searchRaw);
    const selRegions = regionRaw ? regionRaw.split(',').map(r => r.trim()).filter(Boolean) : [];
    const selSectors = sectorRaw ? sectorRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selStatuses = statusRaw ? statusRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    let filtered = allData.filter(item => {
        if (selRegions.length > 0) {
            const rowRegions = _parseRegionsFromVal(item['Región geográfica']);
            const match = selRegions.some(sr => rowRegions.includes(sr));
            if (!match) return false;
        }
        if (selSectors.length > 0) {
            const sec = item['Sector del proyecto'] || '';
            if (!selSectors.includes(sec)) return false;
        }
        if (selStatuses.length > 0) {
            const st = item['ESTADO'] || '';
            if (!selStatuses.includes(st)) return false;
        }
        if (searchNorm) {
            const code = CatlecUtils.normalizeAccents(item['Código proyecto']);
            const name1 = CatlecUtils.normalizeAccents(item['Nombre de la Concesión ']);
            const name2 = CatlecUtils.normalizeAccents(item['Nombre de uso común']);
            const desc = CatlecUtils.normalizeAccents(item['Descripción ']);
            const soc = CatlecUtils.normalizeAccents(item['Nombre sociedad concesionaria']);
            const reg = CatlecUtils.normalizeAccents(item['Región geográfica']);
            const sec = CatlecUtils.normalizeAccents(item['Sector del proyecto']);
            const bidders = (item.bidders || []).map(b => CatlecUtils.normalizeAccents(b.name + ' ' + b.code)).join(' ');
            const haystack = [code, name1, name2, desc, soc, reg, sec, bidders].join(' ');
            if (!haystack.includes(searchNorm)) return false;
        }
        return true;
    });

    const countFiltered = filtered.length;
    const totalDB = allData.length;

    let totalInv = 0;
    let totalBidders = 0;
    const uniqueInfraNames = new Set();
    const hitos = { 'operación': 0, 'construcción': 0, 'comb_const_oper': 0, 'finalizado': 0, 'activos': 0 };
    const sectorStats = {}, statusStats = {};

    filtered.forEach(item => {
        totalInv += parseFloat(item['Inversión Materializada estimada'] || 0) || 0;
        totalBidders += (item.bidders || []).length;
        const infraName = item['Nombre de la Concesión '];
        if (infraName) uniqueInfraNames.add(String(infraName).trim());
        const st = item['ESTADO'] || '';
        if (st) {
            statusStats[st] = (statusStats[st] || 0) + 1;
            if (st === 'Operación') { hitos['operación']++; hitos['activos']++; }
            else if (st === 'Construcción') hitos['construcción']++;
            else if (st === 'Construcción y Operación') { hitos['comb_const_oper']++; hitos['activos']++; }
            else if (st === 'En Licitación' || st.toLowerCase().includes('licitaci')) { hitos['licitación'] = (hitos['licitación'] || 0) + 1; }
            else if (st === 'Finalizado') hitos['finalizado']++;
        }
        const sec = item['Sector del proyecto'] || '';
        if (sec) sectorStats[sec] = (sectorStats[sec] || 0) + 1;
    });

    filtered.sort((a, b) => {
        const va = a[sortBy] != null ? String(a[sortBy]) : 'zzzzzz';
        const vb = b[sortBy] != null ? String(b[sortBy]) : 'zzzzzz';
        return sortOrder === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    const totalPages = Math.max(1, Math.ceil(countFiltered / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const pageData = filtered.slice(start, start + PAGE_SIZE);

    const mapProjects = filtered.map(item => ({
        code: item['Código proyecto'],
        name: item['Nombre de uso común'] || item['Nombre de la Concesión '],
        common: item['Nombre de uso común'],
        region: item['Región geográfica'],
        status: item['ESTADO'],
        sector: item['Sector del proyecto'],
        shapes: item.shapes || [],
        group_timeline: item.group_timeline || []
    }));

    return {
        data: pageData,
        full_filtered: filtered,
        regions: (window.STATIC_DATA && window.STATIC_DATA.regions) || [],
        sectors: (window.STATIC_DATA && window.STATIC_DATA.sectors) || [],
        stats: { sectors: sectorStats, status: statusStats },
        summary: {
            count_filtered: countFiltered,
            count_total: totalDB,
            total_investment_uf: totalInv,
            total_bidders: totalBidders,
            total_infrastructures: uniqueInfraNames.size,
            hitos: hitos
        },
        pagination: {
            page: safePage,
            page_size: PAGE_SIZE,
            total_records: countFiltered,
            total_pages: totalPages
        },
        map_projects: mapProjects
    };
}

// Main AJAX Fetch data method
async function fetchData() {
    try {
        const params = new URLSearchParams({
            search: appState.search,
            region: appState.selectedRegions.join(','),
            sector: appState.selectedSectors.join(','),
            status: appState.selectedStatuses.join(','),
            page: appState.page,
            sort_by: appState.sortBy,
            sort_order: appState.sortOrder
        });

        // VERSIÓN ESTÁTICA: filtrar y paginar en el cliente
        const resData = staticFetchData(params);

        // Si el panel de análisis de inversión está abierto, re-renderizar los gráficos en tiempo real
        if (appState.investmentOpen) {
            renderInvestmentAnalytics(resData.full_filtered || resData.data);
        }

        // Si el panel de análisis de contratos está abierto, re-renderizar los gráficos de contratos
        if (appState.contractsOpen && typeof renderContractsAnalytics === 'function') {
            renderContractsAnalytics(resData.full_filtered || resData.data);
        }

        // Si el panel de análisis de oferentes está abierto, re-renderizar los gráficos de oferentes
        if (appState.biddersOpen) {
            renderBiddersAnalytics(resData.full_filtered || resData.data);
        }

        // 1. Update KPI Values
        if (kpiTotal) kpiTotal.textContent = resData.summary.count_filtered;

        const elTotalSub = document.getElementById('kpi-total-sub');
        if (elTotalSub) elTotalSub.textContent = `Filtrado de ${resData.summary.count_total} total`;

        // Format investment: commas and UF
        const rawInv = resData.summary.total_investment_uf;
        if (kpiInvestment) kpiInvestment.textContent = formatUF(rawInv);

        if (kpiTotalInfras) kpiTotalInfras.textContent = resData.summary.total_infrastructures.toLocaleString('es-CL');
        if (kpiBidders) kpiBidders.textContent = resData.summary.total_bidders !== undefined ? resData.summary.total_bidders.toLocaleString('es-CL') : '0';

        // Update sub KPI context
        const elConstSub = document.getElementById('kpi-construction-sub');
        if (elConstSub) elConstSub.textContent = `Construcción + Operación: ${resData.summary.hitos.comb_const_oper}`;

        // 2. Rendering Table Row Items
        if (appState.page === 1) {
            allLoadedContractsMap = {};
        }
        resData.data.forEach(item => {
            if (item['Código proyecto']) {
                allLoadedContractsMap[item['Código proyecto'].toString().trim()] = item;
            }
        });
        currentFilteredContractsList = resData.full_filtered || (window.STATIC_DATA ? window.STATIC_DATA.data : []);
        renderTable(resData.data);

        // 3. Render count values
        if (countLoaded) countLoaded.textContent = resData.data.length;
        if (countTotal) countTotal.textContent = resData.pagination.total_records;

        // 4. Manage Pagination Button Elements
        updatePaginationControls(resData.pagination);

        // 5. Redraw Chart Analytics visual elements
        renderChart(resData.stats, 'light');

        // 6. Refresh Map Visualizer Markers Map elements
        appState.lastMapProjects = resData.map_projects;
        activeMapCodes.clear();
        shapeToProjectCodes = {};
        resData.map_projects.forEach(p => {
            activeMapCodes.add(p.code);
            projectMetadata[p.code] = p;
            if (p.shapes && Array.isArray(p.shapes)) {
                p.shapes.forEach(shapeId => {
                    const sid = shapeId.toString().trim();
                    if (sid) {
                        if (!shapeToProjectCodes[sid]) {
                            shapeToProjectCodes[sid] = new Set();
                        }
                        shapeToProjectCodes[sid].add(p.code);
                    }
                });
            }
        });
        updateMapStyles();
        renderProjectMarkersOnMap(appState.lastMapProjects);

        // 7. If timeline is open, re-render with updated data (all filtered projects)
        if (appState.timelineOpen) {
            renderTimeline(resData.map_projects);
        }

        // Trigger Lucide refreshes
        lucide.createIcons();
    } catch (err) {
        console.error("Error al obtener los datos de la API:", err);
    }
}

let currentFilteredContractsList = [];


// Shared external tooltip for DGC analysis panel charts
const customChartTooltip = CatlecTooltip.create({ domId: 'dgc-analysis-tooltip' });

function renderChart(statsData, currentThemeMode) {
    const sectorCanvas = document.getElementById('sectorChart');
    const statusCanvas = document.getElementById('statusChart');
    const sectorLegendEl = document.getElementById('sectorChartLegend');
    if (!sectorCanvas || !statusCanvas) return;

    const themeConfig = chartColors[currentThemeMode];

    if (typeof Chart !== 'undefined') {
        Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    }

    // 1. Sector Doughnut Chart (Sorted descending by count: mayor a menor)
    const sectorEntries = Object.entries(statsData.sectors || {});
    sectorEntries.sort((a, b) => b[1] - a[1]);

    const sectorLabels = sectorEntries.map(e => e[0]);
    const sectorCounts = sectorEntries.map(e => e[1]);
    const sectorColorsList = sectorLabels.map(secName => getSectorConfig(secName).color);

    // 1. Sector Doughnut Chart (Sorted descending by count: mayor a menor)
    sectorChartInstance = renderDgcDoughnutChart({
        canvasId: sectorCanvas,
        instance: sectorChartInstance,
        labels: sectorLabels,
        data: sectorCounts,
        colors: sectorColorsList,
        cutout: '68%',
        borderWidth: 2,
        isDark: currentThemeMode === 'dark',
        hoverOffset: 3,
        externalTooltip: customChartTooltip,
        tooltipLabelCallback: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
            const pct = ((ctx.raw / total) * 100).toFixed(1);
            return ` ${ctx.label}: ${pct}% (${ctx.raw} contratos)`;
        },
        legendContainerId: 'sectorChartLegend',
        legendFontSize: '0.66rem',
        legendItemPadding: '0.05rem 0.1rem',
        onLegendHover: (chart, idx, action) => {
            chart.setActiveElements(action === 'enter' ? [{ datasetIndex: 0, index: idx }] : []);
            chart.update();
        }
    });

    // 2. Status Bar Chart (Uniform single color for all bars)
    const statusLabels = Object.keys(statsData.status || {});
    const statusCounts = Object.values(statsData.status || {});
    const uniformBarColor = currentThemeMode === 'dark' ? '#3b82f6' : '#2563eb';

    statusChartInstance = createOrUpdateChart(statusCanvas, statusChartInstance, {
        type: 'bar',
        data: {
            labels: statusLabels,
            datasets: [{
                label: 'Contratos',
                data: statusCounts,
                backgroundColor: uniformBarColor,
                borderColor: 'transparent',
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: customChartTooltip,
                    callbacks: {
                        label: (ctx) => ` ${ctx.label}: ${ctx.raw} contratos`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: themeConfig.text,
                        font: { size: 7.5 }
                    }
                },
                y: {
                    grid: { color: themeConfig.grid },
                    ticks: {
                        color: themeConfig.text,
                        font: { size: 8 },
                        precision: 0
                    }
                }
            }
        }
    });
}

// Formatting utilities
