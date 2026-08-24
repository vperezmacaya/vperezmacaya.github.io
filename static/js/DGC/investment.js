let chartInvByRegionInstance = null;
let chartInvShareRegionInstance = null;
let chartInvIniciativaInstance = null;
let chartActiveInvYearInstance = null;

function showInvestmentView() {
    if (typeof leafletMap !== 'undefined' && leafletMap && leafletMap.getCenter) {
        appState.savedMapCenter = leafletMap.getCenter();
        appState.savedMapZoom = leafletMap.getZoom();
    }
    if (appState.timelineOpen) hideTimelineView();
    if (appState.contractsOpen) hideContractsView();
    if (appState.biddersOpen) hideBiddersView();
    appState.investmentOpen = true;
    const grid = document.querySelector('.dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const invPanel = document.getElementById('investment-full-panel');

    if (grid) grid.style.gridTemplateColumns = '240px 1fr';
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (invPanel) invPanel.style.display = 'flex';

    if (typeof setActiveSubheaderTab === 'function') setActiveSubheaderTab('investment');

    // Renderizar gráficos siempre con la lista completa de contratos filtrados (todos los 127 al inicio)
    const currentList = (currentFilteredContractsList && currentFilteredContractsList.length > 0)
        ? currentFilteredContractsList
        : (window.STATIC_DATA && window.STATIC_DATA.data ? window.STATIC_DATA.data : []);
    renderInvestmentAnalytics(currentList);
}

function hideInvestmentView() {
    appState.investmentOpen = false;
    const grid = document.querySelector('.dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const invPanel = document.getElementById('investment-full-panel');

    if (grid) grid.style.gridTemplateColumns = '';
    if (centerPanel) centerPanel.style.display = 'flex';
    if (rightPanel) rightPanel.style.display = 'flex';
    if (invPanel) invPanel.style.display = 'none';

    if (typeof setActiveSubheaderTab === 'function' && !appState.timelineOpen && !appState.contractsOpen && !appState.biddersOpen) setActiveSubheaderTab('map');

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

// Plugin para dibujar la línea vertical de "Hoy" en los histogramas temporales
const todayLineChartPlugin = {
    id: 'todayLineChartPlugin',
    afterDraw: (chart) => {
        const currentYear = new Date().getFullYear();
        const labels = chart.data.labels || [];
        const index = labels.indexOf(currentYear);
        if (index !== -1) {
            const xAxis = chart.scales.x;
            const yAxis = chart.scales.y;
            const x = xAxis.getPixelForValue(index);
            const ctx = chart.ctx;

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([4, 3]);
            ctx.lineWidth = 1.8;
            ctx.strokeStyle = '#ef4444';
            ctx.moveTo(x, yAxis.top);
            ctx.lineTo(x, yAxis.bottom);
            ctx.stroke();

            // Etiqueta "Hoy" en la parte superior
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 8.5px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Hoy (${currentYear})`, x, Math.max(10, yAxis.top - 3));
            ctx.restore();
        }
    }
};

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

// Shared external tooltip for all investment panel charts (ensures identical style across all)
function investmentExternalTooltip(context) {
    const { chart, tooltip } = context;
    const tooltipId = 'inv-shared-tooltip';
    let el = document.getElementById(tooltipId);
    if (!el) {
        el = document.createElement('div');
        el.id = tooltipId;
        // Match Chart.js native tooltip style exactly
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
        // Fade out: slower, ease-in
        el.style.transition = 'opacity 0.25s ease-in';
        el.style.opacity = '0';
        return;
    }

    const wasVisible = parseFloat(el.style.opacity || '0') > 0.05;

    // Title
    const title = (tooltip.title || []).join('\n');
    // Body lines
    const bodyLines = (tooltip.body || []).flatMap(b => b.lines);

    el.innerHTML = [
        title ? `<div style="font-weight:700;margin-bottom:3px">${title}</div>` : '',
        ...bodyLines.map(line => `<div>${line}</div>`)
    ].join('');

    // Position near caret using page coordinates
    const canvasRect = chart.canvas.getBoundingClientRect();
    let left = canvasRect.left + tooltip.caretX + 10;
    let top = canvasRect.top + tooltip.caretY - 10;

    // Nudge left if overflowing right edge
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && left + rect.width > window.innerWidth - 8) {
        left = canvasRect.left + tooltip.caretX - rect.width - 10;
    }

    if (wasVisible) {
        // Smooth slide transition when moving between slices/bars
        el.style.transition = 'opacity 0.2s ease-out, left 0.8s cubic-bezier(0.2, 0, 0.2, 1), top 0.8s cubic-bezier(0.2, 0, 0.2, 1)';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.opacity = '1';
    } else {
        // Instant position placement on initial hover, then fade in
        el.style.transition = 'none';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        // Force reflow
        void el.offsetHeight;
        el.style.transition = 'opacity 0.2s ease-out';
        el.style.opacity = '1';
    }
}

function renderInvestmentAnalytics(contractsList) {
    if (!contractsList) return;

    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#94a3b8' : '#374151';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    if (typeof Chart !== 'undefined') {
        Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    }

    // 1. REPARTO PROPORCIONAL POR REGIÓN
    const invByRegion = {};
    const contractsByRegion = {};
    let totalSampleInv = 0;

    contractsList.forEach(item => {
        const regs = _parseRegionsFromVal(item['Región geográfica']);
        const inv = parseFloat(item['Inversión Materializada estimada'] || 0) || 0;
        totalSampleInv += inv;
        const n = regs.length;

        if (n > 0) {
            const invPart = inv / n;
            const cntPart = 1.0 / n;
            regs.forEach(r => {
                invByRegion[r] = (invByRegion[r] || 0) + invPart;
                contractsByRegion[r] = (contractsByRegion[r] || 0) + cntPart;
            });
        } else {
            invByRegion['Sin región'] = (invByRegion['Sin región'] || 0) + inv;
            contractsByRegion['Sin región'] = (contractsByRegion['Sin región'] || 0) + 1;
        }
    });

    // Determinar si hay un filtro de región activo
    const hasRegionFilter = appState.selectedRegions && appState.selectedRegions.length > 0;
    const selectedRegionsSet = new Set(hasRegionFilter ? appState.selectedRegions : []);

    let displayTotalInv = totalSampleInv;
    if (hasRegionFilter) {
        let attributableInv = 0;
        appState.selectedRegions.forEach(r => {
            attributableInv += (invByRegion[r] || 0);
        });
        displayTotalInv = attributableInv;
    }

    // Actualizar KPI Header Principal
    const kpiTotalEl = document.getElementById('kpi-panel-total-inv');
    const kpiTotalLabelEl = document.getElementById('kpi-panel-total-inv-label');
    const kpiAvgEl = document.getElementById('kpi-panel-avg-inv');
    const badgeEl = document.getElementById('investment-panel-badge');
    const kpiAvgSubEl = document.getElementById('kpi-panel-avg-sub');

    // Considerar únicamente los proyectos que tienen inversión informada (> 0)
    const contractsWithInv = contractsList.filter(item => {
        const inv = parseFloat(item['Inversión Materializada estimada'] || 0) || 0;
        return inv > 0;
    });
    const reportedInvCount = contractsWithInv.length;
    const avgInv = reportedInvCount > 0 ? (displayTotalInv / reportedInvCount) : 0;

    if (kpiTotalLabelEl) {
        kpiTotalLabelEl.textContent = hasRegionFilter ? 'Inversión atribuible a region/es seleccionadas' : 'Inversión total';
    }
    if (kpiTotalEl) kpiTotalEl.textContent = formatUFComplete(displayTotalInv) + ' UF';
    if (kpiAvgEl) kpiAvgEl.textContent = formatUF(avgInv);
    if (badgeEl) badgeEl.textContent = `${contractsList.length} contratos`;
    if (kpiAvgSubEl) {
        if (reportedInvCount > 0 && reportedInvCount < contractsList.length) {
            kpiAvgSubEl.textContent = `*${reportedInvCount} contratos con inversión registrados`;
        } else {
            kpiAvgSubEl.textContent = '';
        }
    }

    // 1) Gráfico 1: Inversión por Región (Barras Horizontales a toda la altura)
    // Si hay filtro de región activo, solo mostrar la/s región/es seleccionadas
    let regionEntries = Object.entries(invByRegion);
    if (hasRegionFilter) {
        regionEntries = regionEntries.filter(([reg]) => selectedRegionsSet.has(reg));
    }
    const sortedInvRegions = regionEntries.sort((a, b) => b[1] - a[1]);
    const invLabels = sortedInvRegions.map(e => e[0]);
    const invValues = sortedInvRegions.map(e => e[1]);

    const canvasInv = document.getElementById('chartInvByRegion');
    if (canvasInv) {
        if (!chartInvByRegionInstance) {
            chartInvByRegionInstance = new Chart(canvasInv.getContext('2d'), {
                type: 'bar',
                plugins: [horizontalBarDataLabelsPlugin],
                data: {
                    labels: invLabels,
                    datasets: [{
                        label: 'Inversión (UF)',
                        data: invValues,
                        backgroundColor: '#2563eb',
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
                            formatter: (val) => formatUF(val)
                        },
                        tooltip: {
                            enabled: false,
                            external: investmentExternalTooltip,
                            callbacks: {
                                label: (ctx) => ` Inversión: ${formatUFComplete(ctx.raw)} UF (${((ctx.raw / (displayTotalInv || 1)) * 100).toFixed(1)}%)`
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Inversión (UF)',
                                color: textColor,
                                font: { size: 10, weight: '600' }
                            },
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                font: { size: 10 },
                                callback: (val) => {
                                    if (val === 0) return '0';
                                    if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
                                    if (val >= 1000) return `${(val / 1000).toFixed(1).replace(/\.0$/, '')}k`;
                                    return val.toLocaleString('es-CL');
                                }
                            }
                        },
                        y: {
                            grid: { display: false },
                            ticks: {
                                color: textColor,
                                font: { size: 10.5, weight: '500' },
                                autoSkip: false
                            }
                        }
                    }
                }
            });
        } else {
            chartInvByRegionInstance.data.labels = invLabels;
            chartInvByRegionInstance.data.datasets[0].data = invValues;
            if (chartInvByRegionInstance.options.scales.x.max !== undefined) {
                delete chartInvByRegionInstance.options.scales.x.max;
            }
            if (!chartInvByRegionInstance.options.scales.x.title) {
                chartInvByRegionInstance.options.scales.x.title = {
                    display: true,
                    text: 'Inversión (UF)',
                    color: textColor,
                    font: { size: 10, weight: '600' }
                };
            }
            chartInvByRegionInstance.options.scales.x.grid.color = gridColor;
            chartInvByRegionInstance.options.scales.x.ticks.color = textColor;
            chartInvByRegionInstance.options.scales.x.ticks.font = { size: 10 };
            chartInvByRegionInstance.options.scales.x.ticks.callback = (val) => {
                if (val === 0) return '0';
                if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
                if (val >= 1000) return `${(val / 1000).toFixed(1).replace(/\.0$/, '')}k`;
                return val.toLocaleString('es-CL');
            };
            chartInvByRegionInstance.options.scales.y.ticks.color = textColor;
            chartInvByRegionInstance.options.scales.y.ticks.font = { size: 10.5, weight: '500' };
            chartInvByRegionInstance.options.scales.y.ticks.autoSkip = false;
            chartInvByRegionInstance.options.plugins.tooltip.callbacks.label = (ctx) => ` Inversión: ${formatUFComplete(ctx.raw)} UF (${((ctx.raw / (displayTotalInv || 1)) * 100).toFixed(1)}%)`;
            chartInvByRegionInstance.update();
        }
    }

    // Función auxiliar para obtener la fracción de inversión atribuible a la(s) región(es) seleccionada(s)
    const getContractAttributableFraction = (item) => {
        if (!hasRegionFilter) return 1.0;
        const regs = _parseRegionsFromVal(item['Región geográfica']);
        if (regs.length === 0) return 1.0;
        const matchedCount = regs.filter(r => selectedRegionsSet.has(r)).length;
        return matchedCount / regs.length;
    };

    // 2) Gráfico 2: Pie / Donut Chart (% Inversión por Sector del Proyecto)
    const invBySector = {};
    contractsList.forEach(item => {
        const sec = item['Sector del proyecto'] || 'Sin sector';
        const rawInv = parseFloat(item['Inversión Materializada estimada'] || 0) || 0;
        const frac = getContractAttributableFraction(item);
        const inv = rawInv * frac;
        if (inv > 0) {
            invBySector[sec] = (invBySector[sec] || 0) + inv;
        }
    });

    const sortedSec = Object.entries(invBySector).sort((a, b) => b[1] - a[1]);
    const secLabels = sortedSec.map(e => e[0]);
    const secValues = sortedSec.map(e => e[1]);
    const secColors = secLabels.map(s => getSectorConfig(s).color);
    const totalSecInv = secValues.reduce((s, v) => s + v, 0) || displayTotalInv || 1;

    const canvasShare = document.getElementById('chartInvShareRegion');
    if (canvasShare) {
        if (!chartInvShareRegionInstance) {
            chartInvShareRegionInstance = new Chart(canvasShare.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: secLabels,
                    datasets: [{
                        data: secValues,
                        backgroundColor: secColors,
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
                                label: (ctx) => ` ${((ctx.raw / totalSecInv) * 100).toFixed(1)}% (${formatUF(ctx.raw)})`
                            }
                        }
                    }
                }
            });
        } else {
            chartInvShareRegionInstance.data.labels = secLabels;
            chartInvShareRegionInstance.data.datasets[0].data = secValues;
            chartInvShareRegionInstance.data.datasets[0].backgroundColor = secColors;
            chartInvShareRegionInstance.data.datasets[0].borderColor = isDark ? '#0f172a' : '#ffffff';
            chartInvShareRegionInstance.options.plugins.tooltip.callbacks.label = (ctx) => ` ${((ctx.raw / totalSecInv) * 100).toFixed(1)}% (${formatUF(ctx.raw)})`;
            chartInvShareRegionInstance.update();
        }
    }

    // Render Custom HTML Legend for Sector Investment Chart (Non-jumpy fixed layout)
    const legendSecEl = document.getElementById('chartInvShareRegionLegend');
    if (legendSecEl) {
        legendSecEl.innerHTML = '';
        secLabels.forEach((lbl, idx) => {
            const val = secValues[idx];
            const pct = totalSecInv > 0 ? ((val / totalSecInv) * 100).toFixed(1) : 0;
            const col = secColors[idx];
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'display:flex; align-items:center; gap:0.3rem; font-size:0.75rem; padding:0.04rem 0;';
            itemDiv.innerHTML = `
                <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                <span style="color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">${lbl}</span>
                <span style="font-weight:700; color:var(--text-primary); flex-shrink:0; white-space:nowrap;">${pct}%</span>
            `;
            legendSecEl.appendChild(itemDiv);
        });
    }

    // 3) Gráfico 3: Pie / Donut Chart (% Inversión por Tipo de Iniciativa)
    const invByIniciativa = { 'Iniciativa Pública': 0, 'Iniciativa Privada': 0 };
    contractsList.forEach(item => {
        const rawOrig = (item['Origen'] || '').trim().toLowerCase();
        const origKey = (rawOrig.includes('privad')) ? 'Iniciativa Privada' : 'Iniciativa Pública';
        const rawInv = parseFloat(item['Inversión Materializada estimada'] || 0) || 0;
        const frac = getContractAttributableFraction(item);
        const inv = rawInv * frac;
        invByIniciativa[origKey] = (invByIniciativa[origKey] || 0) + inv;
    });

    const initLabels = ['Iniciativa Pública', 'Iniciativa Privada'];
    const initValues = [invByIniciativa['Iniciativa Pública'] || 0, invByIniciativa['Iniciativa Privada'] || 0];
    const initColors = ['#2563eb', '#10b981'];
    const totalInitInv = (initValues[0] + initValues[1]) || displayTotalInv || 1;

    const canvasInit = document.getElementById('chartInvIniciativa');
    if (canvasInit) {
        if (!chartInvIniciativaInstance) {
            chartInvIniciativaInstance = new Chart(canvasInit.getContext('2d'), {
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
                                label: (ctx) => ` ${((ctx.raw / totalInitInv) * 100).toFixed(1)}% (${formatUF(ctx.raw)})`
                            }
                        }
                    }
                }
            });
        } else {
            chartInvIniciativaInstance.data.labels = initLabels;
            chartInvIniciativaInstance.data.datasets[0].data = initValues;
            chartInvIniciativaInstance.data.datasets[0].backgroundColor = initColors;
            chartInvIniciativaInstance.data.datasets[0].borderColor = isDark ? '#0f172a' : '#ffffff';
            chartInvIniciativaInstance.options.plugins.tooltip.callbacks.label = (ctx) => ` ${((ctx.raw / totalInitInv) * 100).toFixed(1)}% (${formatUF(ctx.raw)})`;
            chartInvIniciativaInstance.update();
        }
    }

    // Render Custom HTML Legend for Iniciativa Chart
    const legendInitEl = document.getElementById('chartInvIniciativaLegend');
    if (legendInitEl) {
        legendInitEl.innerHTML = '';
        initLabels.forEach((lbl, idx) => {
            const val = initValues[idx];
            const pct = totalInitInv > 0 ? ((val / totalInitInv) * 100).toFixed(1) : 0;
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

    // 4) Histograma Temporal: Inversión Activa por Año
    const yearlyInvestment = {};

    const parseYear = (dStr) => {
        if (!dStr) return null;
        const m = String(dStr).match(/(\d{4})/);
        return m ? parseInt(m[1], 10) : null;
    };

    contractsList.forEach(c => {
        const startY = parseYear(c['Fecha inicio del contrato de concesión']) || parseYear(c['Fecha decreto adjudicación']);
        const endY = parseYear(c['Fecha término de la concesión']) || 2050;
        const rawInv = parseFloat(c['Inversión Materializada estimada'] || 0) || 0;
        const frac = getContractAttributableFraction(c);
        const inv = rawInv * frac;

        if (startY && inv > 0) {
            const s = Math.max(1993, startY);
            const e = Math.min(2055, endY);
            for (let y = s; y <= e; y++) {
                yearlyInvestment[y] = (yearlyInvestment[y] || 0) + inv;
            }
        }
    });

    const yearsArr = [];
    for (let y = 1993; y <= 2055; y++) { yearsArr.push(y); }
    const activeInvData = yearsArr.map(y => yearlyInvestment[y] || 0);

    // 5) Gráfico 5: Inversión Activa por Año (Histograma)
    const canvasActiveInv = document.getElementById('chartActiveInvYear');
    if (canvasActiveInv) {
        if (!chartActiveInvYearInstance) {
            chartActiveInvYearInstance = new Chart(canvasActiveInv.getContext('2d'), {
                type: 'bar',
                plugins: [todayLineChartPlugin],
                data: {
                    labels: yearsArr,
                    datasets: [{
                        label: 'Inversión Activa (UF)',
                        data: activeInvData,
                        backgroundColor: '#8b5cf6',
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
                                label: (ctx) => ` Año ${ctx.label}: ${formatUFComplete(ctx.raw)} UF activas`
                            }
                        }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 9.5 } } },
                        y: {
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                font: { size: 9.5 },
                                callback: (val) => formatUF(val)
                            }
                        }
                    }
                }
            });
        } else {
            chartActiveInvYearInstance.data.labels = yearsArr;
            chartActiveInvYearInstance.data.datasets[0].data = activeInvData;
            chartActiveInvYearInstance.options.scales.x.ticks.color = textColor;
            chartActiveInvYearInstance.options.scales.x.ticks.font = { size: 9.5 };
            chartActiveInvYearInstance.options.scales.y.grid.color = gridColor;
            chartActiveInvYearInstance.options.scales.y.ticks.color = textColor;
            chartActiveInvYearInstance.options.scales.y.ticks.font = { size: 9.5 };
            chartActiveInvYearInstance.update();
        }
    }

    lucide.createIcons();
}

function initInvestmentEvents() {
    const btnClose = document.getElementById('btn-close-investment');
    if (btnClose) {
        btnClose.addEventListener('click', () => hideInvestmentView());
    }
}

