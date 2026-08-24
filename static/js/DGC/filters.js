function toggleChartTabStyles() {
    if (appState.chartType === 'sector') {
        btnChartSector.style.backgroundColor = 'var(--primary)';
        btnChartSector.style.color = '#ffffff';
        btnChartSector.style.borderColor = 'var(--primary)';
        btnChartStatus.style.backgroundColor = 'var(--bg-card)';
        btnChartStatus.style.color = 'var(--text-secondary)';
        btnChartStatus.style.borderColor = 'var(--border-color)';
    } else {
        btnChartStatus.style.backgroundColor = 'var(--primary)';
        btnChartStatus.style.color = '#ffffff';
        btnChartStatus.style.borderColor = 'var(--primary)';
        btnChartSector.style.backgroundColor = 'var(--bg-card)';
        btnChartSector.style.color = 'var(--text-secondary)';
        btnChartSector.style.borderColor = 'var(--border-color)';
    }
}

function updateSelectedRegions() {
    const checkedCbs = Array.from(document.querySelectorAll('.region-checkbox:checked'));
    appState.selectedRegions = checkedCbs.map(cb => cb.value);

    const totalCount = availableRegionsList.length;
    const checkedCount = appState.selectedRegions.length;

    if (regionCheckAll) {
        regionCheckAll.checked = (checkedCount === totalCount && totalCount > 0);
    }

    if (regionMultiselectText) {
        if (checkedCount === 0 || checkedCount === totalCount) {
            regionMultiselectText.textContent = 'Todas las regiones';
        } else if (checkedCount === 1) {
            regionMultiselectText.textContent = appState.selectedRegions[0];
        } else {
            regionMultiselectText.textContent = `${checkedCount} regiones seleccionadas`;
        }
    }

    appState.page = 1;
    appState.selectedProjectCode = null;
    if (layers.regions) layers.regions.setStyle(getRegionStyle);
    fetchData();
}

function updateSelectedSectors() {
    const checkedCbs = Array.from(document.querySelectorAll('.sector-checkbox:checked'));
    appState.selectedSectors = checkedCbs.map(cb => cb.value);

    const totalCount = availableSectorsList.length;
    const checkedCount = appState.selectedSectors.length;

    if (sectorCheckAll) {
        sectorCheckAll.checked = (checkedCount === totalCount && totalCount > 0);
    }

    if (sectorMultiselectText) {
        if (checkedCount === 0 || checkedCount === totalCount) {
            sectorMultiselectText.textContent = 'Todos los sectores';
        } else if (checkedCount === 1) {
            sectorMultiselectText.textContent = appState.selectedSectors[0];
        } else {
            sectorMultiselectText.textContent = `${checkedCount} sectores seleccionados`;
        }
    }

    appState.page = 1;
    appState.selectedProjectCode = null;
    fetchData();
}

function updateSelectedStatuses() {
    const checkedCbs = Array.from(document.querySelectorAll('.status-checkbox:checked'));
    appState.selectedStatuses = checkedCbs.map(cb => cb.value);

    const totalCount = availableStatusesList.length;
    const checkedCount = appState.selectedStatuses.length;

    if (statusCheckAll) {
        statusCheckAll.checked = (checkedCount === totalCount && totalCount > 0);
    }

    if (statusMultiselectText) {
        if (checkedCount === 0 || checkedCount === totalCount) {
            statusMultiselectText.textContent = 'Todos los estados';
        } else if (checkedCount === 1) {
            statusMultiselectText.textContent = appState.selectedStatuses[0];
        } else {
            statusMultiselectText.textContent = `${checkedCount} estados seleccionados`;
        }
    }

    appState.page = 1;
    appState.selectedProjectCode = null;
    fetchData();
}

// Carga estática de filtros desde window.STATIC_DATA
async function loadFilters() {
    const data = window.STATIC_DATA || {};

    //availableRegionsList = data.regions || [];
    //availableSectorsList = data.sectors || [];

    // Populate region checkboxes
    if (regionOptionsList) {
        regionOptionsList.innerHTML = '';
        availableRegionsList.forEach(reg => {
            const label = document.createElement('label');
            label.className = 'multiselect-option';
            label.innerHTML = `
                <input type="checkbox" class="region-checkbox" value="${reg}">
                <span>${reg}</span>
            `;
            regionOptionsList.appendChild(label);
        });

        document.querySelectorAll('.region-checkbox').forEach(cb => {
            cb.addEventListener('change', updateSelectedRegions);
        });
    }

    // Populate sector checkboxes
    if (sectorOptionsList) {
        sectorOptionsList.innerHTML = '';
        availableSectorsList.forEach(sec => {
            const label = document.createElement('label');
            label.className = 'multiselect-option';
            label.innerHTML = `
                <input type="checkbox" class="sector-checkbox" value="${sec}">
                <span>${sec}</span>
            `;
            sectorOptionsList.appendChild(label);
        });

        document.querySelectorAll('.sector-checkbox').forEach(cb => {
            cb.addEventListener('change', updateSelectedSectors);
        });
    }

    // Populate status checkboxes
    if (statusOptionsList) {
        statusOptionsList.innerHTML = '';
        const statuses = (data.stats && data.stats.status)
            ? Object.keys(data.stats.status).sort()
            : availableStatusesList;
        availableStatusesList = statuses;

        availableStatusesList.forEach(st => {
            const label = document.createElement('label');
            label.className = 'multiselect-option';
            label.innerHTML = `
                <input type="checkbox" class="status-checkbox" value="${st}">
                <span>${st}</span>
            `;
            statusOptionsList.appendChild(label);
        });

        document.querySelectorAll('.status-checkbox').forEach(cb => {
            cb.addEventListener('change', updateSelectedStatuses);
        });
    }
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

    const searchNorm = _normalizeStr(searchRaw);
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
            const code = _normalizeStr(item['Código proyecto']);
            const name1 = _normalizeStr(item['Nombre de la Concesión ']);
            const name2 = _normalizeStr(item['Nombre de uso común']);
            const desc = _normalizeStr(item['Descripción ']);
            const soc = _normalizeStr(item['Nombre sociedad concesionaria']);
            const reg = _normalizeStr(item['Región geográfica']);
            const sec = _normalizeStr(item['Sector del proyecto']);
            const bidders = (item.bidders || []).map(b => _normalizeStr(b.name + ' ' + b.code)).join(' ');
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
function customChartTooltip(context) {
    const { chart, tooltip } = context;
    const tooltipId = 'dgc-analysis-tooltip';
    let el = document.getElementById(tooltipId);
    if (!el) {
        el = document.createElement('div');
        el.id = tooltipId;
        el.style.cssText = [
            'position:fixed',
            'background:rgba(0,0,0,0.8)',
            'color:#fff',
            'border-radius:3px',
            'padding:6px 8px',
            'font:12px/1.4 system-ui,sans-serif',
            'pointer-events:none',
            'white-space:nowrap',
            'z-index:9999',
            'opacity:0'
        ].join(';');
        document.body.appendChild(el);
    }

    if (tooltip.opacity === 0) {
        el.style.transition = 'opacity 0.25s ease-in';
        el.style.opacity = '0';
        return;
    }

    const wasVisible = parseFloat(el.style.opacity || '0') > 0.05;

    const title = (tooltip.title || []).join('\n');
    const bodyLines = (tooltip.body || []).flatMap(b => b.lines);

    el.innerHTML = [
        title ? `<div style="font-weight:700;margin-bottom:3px">${title}</div>` : '',
        ...bodyLines.map(line => `<div>${line}</div>`)
    ].join('');

    const canvasRect = chart.canvas.getBoundingClientRect();
    let left = canvasRect.left + tooltip.caretX + 10;
    let top = canvasRect.top + tooltip.caretY - 10;

    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && left + rect.width > window.innerWidth - 8) {
        left = canvasRect.left + tooltip.caretX - rect.width - 10;
    }

    if (wasVisible) {
        el.style.transition = 'opacity 0.2s ease-out, left 0.15s cubic-bezier(0.2, 0, 0, 1), top 0.15s cubic-bezier(0.2, 0, 0, 1)';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.opacity = '1';
    } else {
        el.style.transition = 'none';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        void el.offsetHeight;
        el.style.transition = 'opacity 0.2s ease-out';
        el.style.opacity = '1';
    }
}

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

    if (!sectorChartInstance) {
        sectorChartInstance = new Chart(sectorCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: sectorLabels,
                datasets: [{
                    label: 'Contratos',
                    data: sectorCounts,
                    backgroundColor: sectorColorsList,
                    borderColor: currentThemeMode === 'dark' ? '#0f1626' : '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: customChartTooltip,
                        callbacks: {
                            label: (ctx) => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
                                const pct = ((ctx.raw / total) * 100).toFixed(1);
                                return ` ${ctx.label}: ${pct}% (${ctx.raw} contratos)`;
                            }
                        }
                    }
                }
            }
        });
    } else {
        sectorChartInstance.data.labels = sectorLabels;
        sectorChartInstance.data.datasets[0].data = sectorCounts;
        sectorChartInstance.data.datasets[0].backgroundColor = sectorColorsList;
        sectorChartInstance.data.datasets[0].borderColor = currentThemeMode === 'dark' ? '#0f1626' : '#ffffff';
        sectorChartInstance.update();
    }

    // Populate custom HTML Legend for Sector Chart (Non-scrollable, all visible)
    if (sectorLegendEl) {
        sectorLegendEl.innerHTML = '';
        const totalSectorCount = sectorCounts.reduce((acc, v) => acc + v, 0) || 1;
        sectorLabels.forEach((label, i) => {
            const count = sectorCounts[i];
            const pct = totalSectorCount > 0 ? ((count / totalSectorCount) * 100).toFixed(1) : '0.0';
            const secCfg = getSectorConfig(label);
            const itemEl = document.createElement('div');
            itemEl.className = 'sector-legend-item';
            itemEl.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 0.66rem; color: var(--text-primary); cursor: pointer; gap: 0.2rem; padding: 0.05rem 0.1rem; border-radius: 3px; line-height: 1.15;';
            itemEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.3rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <span style="width: 7px; height: 7px; border-radius: 50%; background-color: ${secCfg.color}; flex-shrink: 0;"></span>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.66rem;">${label}</span>
                </div>
                <span style="font-weight: 700; color: var(--text-secondary); flex-shrink: 0; font-size: 0.66rem;">${pct}%</span>
            `;

            itemEl.addEventListener('mouseenter', () => {
                if (sectorChartInstance) {
                    sectorChartInstance.setActiveElements([{ datasetIndex: 0, index: i }]);
                    sectorChartInstance.update();
                }
            });
            itemEl.addEventListener('mouseleave', () => {
                if (sectorChartInstance) {
                    sectorChartInstance.setActiveElements([]);
                    sectorChartInstance.update();
                }
            });

            sectorLegendEl.appendChild(itemEl);
        });
    }

    // 2. Status Bar Chart (Uniform single color for all bars)
    const statusLabels = Object.keys(statsData.status || {});
    const statusCounts = Object.values(statsData.status || {});
    const uniformBarColor = currentThemeMode === 'dark' ? '#3b82f6' : '#2563eb';

    if (!statusChartInstance) {
        statusChartInstance = new Chart(statusCanvas.getContext('2d'), {
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
    } else {
        statusChartInstance.data.labels = statusLabels;
        statusChartInstance.data.datasets[0].data = statusCounts;
        statusChartInstance.data.datasets[0].backgroundColor = uniformBarColor;
        statusChartInstance.options.scales.x.ticks.color = themeConfig.text;
        statusChartInstance.options.scales.y.grid.color = themeConfig.grid;
        statusChartInstance.options.scales.y.ticks.color = themeConfig.text;
        statusChartInstance.update();
    }
}

// Formatting utilities
