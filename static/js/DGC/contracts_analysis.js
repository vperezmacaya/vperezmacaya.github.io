/**
 * static/js/DGC/contracts_analysis.js
 * Visualización: Análisis de Contratos por Región y Tiempo (Concesiones DGC).
 */

let chartContractsByRegionInstance = null;
let chartContractsByMetodoInstance = null;
let chartContractsByIniciativaInstance = null;
let chartActiveContractsYearInstance = null;

function showContractsView() {
    if (typeof leafletMap !== 'undefined' && leafletMap && leafletMap.getCenter) {
        appState.savedMapCenter = leafletMap.getCenter();
        appState.savedMapZoom = leafletMap.getZoom();
    }
    if (appState.timelineOpen) hideTimelineView();
    if (appState.investmentOpen) hideInvestmentView();
    if (appState.biddersOpen) hideBiddersView();

    appState.contractsOpen = true;
    const grid = document.querySelector('.dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const cntPanel = document.getElementById('contracts-analysis-full-panel');

    if (grid) grid.style.gridTemplateColumns = '240px 1fr';
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (cntPanel) cntPanel.style.display = 'flex';

    if (typeof setActiveSubheaderTab === 'function') setActiveSubheaderTab('contracts');

    const currentList = (currentFilteredContractsList && currentFilteredContractsList.length > 0)
        ? currentFilteredContractsList
        : (window.STATIC_DATA && window.STATIC_DATA.data ? window.STATIC_DATA.data : []);
    renderContractsAnalytics(currentList);
}

function hideContractsView() {
    appState.contractsOpen = false;
    const grid = document.querySelector('.dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const cntPanel = document.getElementById('contracts-analysis-full-panel');

    if (grid) grid.style.gridTemplateColumns = '';
    if (centerPanel) centerPanel.style.display = 'flex';
    if (rightPanel) rightPanel.style.display = 'flex';
    if (cntPanel) cntPanel.style.display = 'none';

    if (typeof setActiveSubheaderTab === 'function' && !appState.timelineOpen && !appState.investmentOpen && !appState.biddersOpen) {
        setActiveSubheaderTab('map');
    }

    if (typeof leafletMap !== 'undefined' && leafletMap) {
        leafletMap.invalidateSize({ animate: false });
        if (appState.savedMapCenter) {
            leafletMap.setView(appState.savedMapCenter, appState.savedMapZoom || 6, { animate: false });
        }
        setTimeout(() => {
            leafletMap.invalidateSize({ animate: false });
            if (appState.savedMapCenter) {
                leafletMap.setView(appState.savedMapCenter, appState.savedMapZoom || 6, { animate: false });
            }
        }, 0);
    }
}

function renderContractsAnalytics(contractsList) {
    if (!contractsList) return;

    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#94a3b8' : '#374151';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    if (typeof Chart !== 'undefined') {
        Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    }

    const parseYear = (dStr) => {
        if (!dStr) return null;
        const m = String(dStr).match(/(\d{4})/);
        return m ? parseInt(m[1], 10) : null;
    };
    const currentYear = new Date().getFullYear();

    // 1. Reparto proporcional por región y conteo de vigentes e interregionales
    const contractsByRegion = {};
    let totalContracts = contractsList.length;
    let vigentesContractsCount = 0;
    let interregionalContractsCount = 0;

    contractsList.forEach(item => {
        const regs = _parseRegionsFromVal(item['Región geográfica']);
        const startY = parseYear(item['Fecha inicio del contrato de concesión']) || parseYear(item['Fecha decreto adjudicación']);
        const endY = parseYear(item['Fecha término de la concesión']) || 2050;

        if (startY && currentYear >= startY && currentYear <= endY) {
            vigentesContractsCount++;
        }

        if (regs.length > 1) {
            interregionalContractsCount++;
        }

        const n = regs.length;
        if (n > 0) {
            const cntPart = 1.0 / n;
            regs.forEach(r => {
                contractsByRegion[r] = (contractsByRegion[r] || 0) + cntPart;
            });
        } else {
            contractsByRegion['Sin región'] = (contractsByRegion['Sin región'] || 0) + 1;
        }
    });

    // Determinar si hay un filtro de región activo
    const hasRegionFilter = appState.selectedRegions && appState.selectedRegions.length > 0;
    const selectedRegionsSet = new Set(hasRegionFilter ? appState.selectedRegions : []);

    const getContractAttributableFraction = (item) => {
        if (!hasRegionFilter) return 1.0;
        const regs = _parseRegionsFromVal(item['Región geográfica']);
        if (regs.length === 0) return 1.0;
        const matchedCount = regs.filter(r => selectedRegionsSet.has(r)).length;
        return matchedCount / regs.length;
    };

    const formatContractVal = (val) => {
        if (val === null || val === undefined || isNaN(val)) return '0';
        return (val % 1 === 0) ? val.toString() : val.toFixed(1);
    };

    let displayTotalContracts = totalContracts;
    if (hasRegionFilter) {
        let attributableContracts = 0;
        appState.selectedRegions.forEach(r => {
            attributableContracts += (contractsByRegion[r] || 0);
        });
        displayTotalContracts = attributableContracts;
    }

    // Actualizar KPIs de Contratos
    const kpiTotalCnt = document.getElementById('kpi-contracts-total');
    const kpiTotalCntLabel = document.getElementById('kpi-contracts-total-label');
    const kpiActiveCnt = document.getElementById('kpi-contracts-active');
    const kpiInterreg = document.getElementById('kpi-contracts-interregional');

    if (kpiTotalCntLabel) {
        kpiTotalCntLabel.textContent = hasRegionFilter ? 'Contratos atribuibles a region/es seleccionadas' : 'Contratos totales';
    }
    if (kpiTotalCnt) {
        if (hasRegionFilter) {
            kpiTotalCnt.innerHTML = `${formatContractVal(displayTotalContracts)} <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">(de ${totalContracts} netos)</span>`;
        } else {
            kpiTotalCnt.textContent = formatContractVal(displayTotalContracts);
        }
    }
    if (kpiActiveCnt) kpiActiveCnt.textContent = vigentesContractsCount.toString();
    if (kpiInterreg) kpiInterreg.textContent = interregionalContractsCount.toString();

    // 1) Gráfico 1: Contratos por Región (Barras Horizontales Proporcionales)
    // Si hay filtro de región activo, solo mostrar la/s región/es seleccionadas
    let regionEntries = Object.entries(contractsByRegion);
    if (hasRegionFilter) {
        regionEntries = regionEntries.filter(([reg]) => selectedRegionsSet.has(reg));
    }
    const sortedCntRegions = regionEntries.sort((a, b) => b[1] - a[1]);
    const cntLabels = sortedCntRegions.map(e => e[0]);
    const cntValues = sortedCntRegions.map(e => e[1]);

// Plugin para dibujar etiquetas de valor en barras horizontales (dentro o fuera según espacio disponible)
const horizontalBarDataLabelsPlugin = {
    id: 'horizontalBarDataLabelsPlugin',
    afterDatasetsDraw: (chart, args, pluginOptions) => {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data) return;

        const isDark = document.body.classList.contains('dark-theme');
        const outsideColor = isDark ? '#cbd5e1' : '#334155';
        const insideColor = '#ffffff';
        const formatter = (pluginOptions && pluginOptions.formatter) || ((v) => String(v));

        ctx.save();
        ctx.font = '600 9px Inter, system-ui, -apple-system, sans-serif';
        ctx.textBaseline = 'middle';

        meta.data.forEach((bar, index) => {
            const rawVal = chart.data.datasets[0].data[index];
            if (rawVal === undefined || rawVal === null || rawVal <= 0) return;

            const text = formatter(rawVal);
            const textWidth = ctx.measureText(text).width;
            const barWidth = Math.abs(bar.x - bar.base);

            // Si la barra tiene suficiente espacio interior (ancho >= texto + 18px), se dibuja adentro
            if (barWidth >= textWidth + 18) {
                ctx.fillStyle = insideColor;
                ctx.textAlign = 'right';
                ctx.fillText(text, bar.x - 6, bar.y);
            } else {
                // Si la barra es estrecha, se dibuja afuera a la derecha
                ctx.fillStyle = outsideColor;
                ctx.textAlign = 'left';
                ctx.fillText(text, bar.x + 5, bar.y);
            }
        });

        ctx.restore();
    }
};

    const canvasCnt = document.getElementById('chartContractsByRegion');
    if (canvasCnt) {
        if (!chartContractsByRegionInstance) {
            chartContractsByRegionInstance = new Chart(canvasCnt.getContext('2d'), {
                type: 'bar',
                plugins: [horizontalBarDataLabelsPlugin],
                data: {
                    labels: cntLabels,
                    datasets: [{
                        label: 'Contratos (Proporcional)',
                        data: cntValues,
                        backgroundColor: '#059669',
                        borderRadius: 3,
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: { top: 0, bottom: 0, left: 0, right: 0 }
                    },
                    plugins: {
                        legend: { display: false },
                        horizontalBarDataLabelsPlugin: {
                            formatter: (val) => formatContractVal(val)
                        },
                        tooltip: {
                            enabled: false,
                            external: investmentExternalTooltip,
                            callbacks: {
                                label: (ctx) => ` Contratos: ${formatContractVal(ctx.raw)} (${((ctx.raw / (displayTotalContracts || 1)) * 100).toFixed(1)}%)`
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Número de contratos atribuibles',
                                color: textColor,
                                font: { size: 10, weight: '600' }
                            },
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 10 } }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 10.5, weight: '500' }, autoSkip: false }
                        }
                    }
                }
            });
        } else {
            chartContractsByRegionInstance.data.labels = cntLabels;
            chartContractsByRegionInstance.data.datasets[0].data = cntValues;
            if (chartContractsByRegionInstance.options.scales.x.max !== undefined) {
                delete chartContractsByRegionInstance.options.scales.x.max;
            }
            if (!chartContractsByRegionInstance.options.scales.x.title) {
                chartContractsByRegionInstance.options.scales.x.title = {
                    display: true,
                    text: 'Número de contratos atribuibles',
                    color: textColor,
                    font: { size: 10, weight: '600' }
                };
            }
            chartContractsByRegionInstance.options.scales.x.grid.color = gridColor;
            chartContractsByRegionInstance.options.scales.x.ticks.color = textColor;
            chartContractsByRegionInstance.options.scales.x.ticks.font = { size: 10 };
            chartContractsByRegionInstance.options.scales.y.ticks.color = textColor;
            chartContractsByRegionInstance.options.scales.y.ticks.font = { size: 10.5, weight: '500' };
            chartContractsByRegionInstance.options.scales.y.ticks.autoSkip = false;
            chartContractsByRegionInstance.options.plugins.tooltip.callbacks.label = (ctx) => ` Contratos: ${formatContractVal(ctx.raw)} (${((ctx.raw / (displayTotalContracts || 1)) * 100).toFixed(1)}%)`;
            chartContractsByRegionInstance.update();
        }
    }

    // 2) Gráfico 2: Pie / Donut Chart (% Contratos por Método de Licitación)
    const cntByMetodo = {};
    contractsList.forEach(item => {
        const rawM = (item['Metodo de licitación'] || '').trim();
        let key = 'Sin información';
        if (rawM.toLowerCase().includes('preselec')) {
            key = 'Con preselección';
        } else if (rawM.toLowerCase().includes('sólo') || rawM.toLowerCase().includes('solo') || rawM.toLowerCase().includes('pública') || rawM.toLowerCase().includes('publica')) {
            key = 'Sólo licitación pública';
        } else if (rawM) {
            key = rawM;
        }
        const frac = getContractAttributableFraction(item);
        if (frac > 0) {
            cntByMetodo[key] = (cntByMetodo[key] || 0) + frac;
        }
    });

    const metodoColorMap = {
        'Con preselección': '#8b5cf6',
        'Sólo licitación pública': '#059669',
        'Sin información': '#94a3b8'
    };

    const sortedMet = Object.entries(cntByMetodo).sort((a, b) => b[1] - a[1]);
    const metLabels = sortedMet.map(e => e[0]);
    const metValues = sortedMet.map(e => e[1]);
    const metColors = metLabels.map(m => metodoColorMap[m] || '#3b82f6');
    const totalMetCnt = metValues.reduce((s, v) => s + v, 0) || displayTotalContracts || 1;

    const canvasMet = document.getElementById('chartContractsByMetodo');
    if (canvasMet) {
        if (!chartContractsByMetodoInstance) {
            chartContractsByMetodoInstance = new Chart(canvasMet.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: metLabels,
                    datasets: [{
                        data: metValues,
                        backgroundColor: metColors,
                        borderColor: isDark ? '#0f172a' : '#ffffff',
                        borderWidth: 1.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: investmentExternalTooltip,
                            callbacks: {
                                label: (ctx) => ` ${((ctx.raw / totalMetCnt) * 100).toFixed(1)}% (${formatContractVal(ctx.raw)} contratos)`
                            }
                        }
                    }
                }
            });
        } else {
            chartContractsByMetodoInstance.data.labels = metLabels;
            chartContractsByMetodoInstance.data.datasets[0].data = metValues;
            chartContractsByMetodoInstance.data.datasets[0].backgroundColor = metColors;
            chartContractsByMetodoInstance.data.datasets[0].borderColor = isDark ? '#0f172a' : '#ffffff';
            chartContractsByMetodoInstance.options.plugins.tooltip.callbacks.label = (ctx) => ` ${((ctx.raw / totalMetCnt) * 100).toFixed(1)}% (${formatContractVal(ctx.raw)} contratos)`;
            chartContractsByMetodoInstance.update();
        }
    }

    // Custom HTML Legend for Metodo Chart
    const legendMetEl = document.getElementById('chartContractsByMetodoLegend');
    if (legendMetEl) {
        legendMetEl.innerHTML = '';
        metLabels.forEach((lbl, idx) => {
            const val = metValues[idx];
            const pct = totalMetCnt > 0 ? ((val / totalMetCnt) * 100).toFixed(1) : 0;
            const col = metColors[idx];
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'display:flex; align-items:center; gap:0.3rem; font-size:0.75rem; padding:0.04rem 0;';
            itemDiv.innerHTML = `
                <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                <span style="color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">${lbl}</span>
                <span style="font-weight:700; color:var(--text-primary); flex-shrink:0; white-space:nowrap;">${pct}%</span>
            `;
            legendMetEl.appendChild(itemDiv);
        });
    }

    // 3) Gráfico 3: Pie / Donut Chart (% Contratos por Tipo de Iniciativa)
    const cntByIniciativa = { 'Iniciativa Pública': 0, 'Iniciativa Privada': 0 };
    contractsList.forEach(item => {
        const rawOrig = (item['Origen'] || '').trim().toLowerCase();
        const origKey = (rawOrig.includes('privad')) ? 'Iniciativa Privada' : 'Iniciativa Pública';
        const frac = getContractAttributableFraction(item);
        cntByIniciativa[origKey] = (cntByIniciativa[origKey] || 0) + frac;
    });

    const initLabels = ['Iniciativa Pública', 'Iniciativa Privada'];
    const initValues = [cntByIniciativa['Iniciativa Pública'] || 0, cntByIniciativa['Iniciativa Privada'] || 0];
    const initColors = ['#2563eb', '#10b981'];
    const totalInitCnt = (initValues[0] + initValues[1]) || displayTotalContracts || 1;

    const canvasInit = document.getElementById('chartContractsByIniciativa');
    if (canvasInit) {
        if (!chartContractsByIniciativaInstance) {
            chartContractsByIniciativaInstance = new Chart(canvasInit.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: initLabels,
                    datasets: [{
                        data: initValues,
                        backgroundColor: initColors,
                        borderColor: isDark ? '#0f172a' : '#ffffff',
                        borderWidth: 1.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: investmentExternalTooltip,
                            callbacks: {
                                label: (ctx) => ` ${((ctx.raw / totalInitCnt) * 100).toFixed(1)}% (${formatContractVal(ctx.raw)} contratos)`
                            }
                        }
                    }
                }
            });
        } else {
            chartContractsByIniciativaInstance.data.labels = initLabels;
            chartContractsByIniciativaInstance.data.datasets[0].data = initValues;
            chartContractsByIniciativaInstance.data.datasets[0].backgroundColor = initColors;
            chartContractsByIniciativaInstance.data.datasets[0].borderColor = isDark ? '#0f172a' : '#ffffff';
            chartContractsByIniciativaInstance.options.plugins.tooltip.callbacks.label = (ctx) => ` ${((ctx.raw / totalInitCnt) * 100).toFixed(1)}% (${formatContractVal(ctx.raw)} contratos)`;
            chartContractsByIniciativaInstance.update();
        }
    }

    // Custom HTML Legend for Iniciativa Chart
    const legendInitEl = document.getElementById('chartContractsByIniciativaLegend');
    if (legendInitEl) {
        legendInitEl.innerHTML = '';
        initLabels.forEach((lbl, idx) => {
            const val = initValues[idx];
            const pct = totalInitCnt > 0 ? ((val / totalInitCnt) * 100).toFixed(1) : 0;
            const col = initColors[idx];
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'display:flex; align-items:center; gap:0.3rem; font-size:0.78rem; padding:0.06rem 0;';
            itemDiv.innerHTML = `
                <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                <span style="color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">${lbl}</span>
                <span style="font-weight:700; color:var(--text-primary); flex-shrink:0; white-space:nowrap;">${pct}%</span>
            `;
            legendInitEl.appendChild(itemDiv);
        });
    }

    // 4) Gráfico 4: Contratos Vigentes por Año (Histograma Temporal)
    const yearlyContracts = {};

    contractsList.forEach(c => {
        const startY = parseYear(c['Fecha inicio del contrato de concesión']) || parseYear(c['Fecha decreto adjudicación']);
        const endY = parseYear(c['Fecha término de la concesión']) || 2050;
        const frac = getContractAttributableFraction(c);

        if (startY && frac > 0) {
            const s = Math.max(1993, startY);
            const e = Math.min(2055, endY);
            for (let y = s; y <= e; y++) {
                yearlyContracts[y] = (yearlyContracts[y] || 0) + frac;
            }
        }
    });

    const yearsArr = [];
    for (let y = 1993; y <= 2055; y++) { yearsArr.push(y); }
    const activeCntData = yearsArr.map(y => yearlyContracts[y] || 0);

    const canvasActiveCnt = document.getElementById('chartActiveContractsYear');
    if (canvasActiveCnt) {
        if (!chartActiveContractsYearInstance) {
            chartActiveContractsYearInstance = new Chart(canvasActiveCnt.getContext('2d'), {
                type: 'bar',
                plugins: [todayLineChartPlugin],
                data: {
                    labels: yearsArr,
                    datasets: [{
                        label: 'Contratos Vigentes',
                        data: activeCntData,
                        backgroundColor: '#3b82f6',
                        borderRadius: 2,
                        barThickness: 7,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: investmentExternalTooltip,
                            callbacks: {
                                label: (ctx) => ` Año ${ctx.label}: ${formatContractVal(ctx.raw)} contratos vigentes`
                            }
                        }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 9.5 } } },
                        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 9.5 } } }
                    }
                }
            });
        } else {
            chartActiveContractsYearInstance.data.labels = yearsArr;
            chartActiveContractsYearInstance.data.datasets[0].data = activeCntData;
            chartActiveContractsYearInstance.options.scales.x.ticks.color = textColor;
            chartActiveContractsYearInstance.options.scales.x.ticks.font = { size: 9.5 };
            chartActiveContractsYearInstance.options.scales.y.grid.color = gridColor;
            chartActiveContractsYearInstance.options.scales.y.ticks.color = textColor;
            chartActiveContractsYearInstance.options.scales.y.ticks.font = { size: 9.5 };
            chartActiveContractsYearInstance.options.plugins.tooltip.callbacks.label = (ctx) => ` Año ${ctx.label}: ${formatContractVal(ctx.raw)} contratos vigentes`;
            chartActiveContractsYearInstance.update();
        }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}
