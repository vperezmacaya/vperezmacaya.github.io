function showInvestmentView() {
    if (typeof leafletMap !== 'undefined' && leafletMap && leafletMap.getCenter) {
        appState.savedMapCenter = leafletMap.getCenter();
        appState.savedMapZoom = leafletMap.getZoom();
    }
    if (appState.timelineOpen) hideTimelineView();
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

    if (typeof setActiveSubheaderTab === 'function' && !appState.timelineOpen) setActiveSubheaderTab('map');

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

    // Actualizar KPI Header Principal
    const kpiTotalEl = document.getElementById('kpi-panel-total-inv');
    const kpiAvgEl = document.getElementById('kpi-panel-avg-inv');
    const badgeEl = document.getElementById('investment-panel-badge');

    const avgInv = totalSampleInv / (contractsList.length || 1);

    if (kpiTotalEl) kpiTotalEl.textContent = formatUFComplete(totalSampleInv) + ' UF';
    if (kpiAvgEl) kpiAvgEl.textContent = formatUF(avgInv);
    if (badgeEl) badgeEl.textContent = `${contractsList.length} contratos`;

    // 1) Gráfico 1: Inversión por Región (Barras Horizontales)
    const sortedInvRegions = Object.entries(invByRegion).sort((a, b) => b[1] - a[1]);
    const invLabels = sortedInvRegions.map(e => e[0]);
    const invValues = sortedInvRegions.map(e => e[1]);

    const canvasInv = document.getElementById('chartInvByRegion');
    if (canvasInv) {
        if (!chartInvByRegionInstance) {
            chartInvByRegionInstance = new Chart(canvasInv.getContext('2d'), {
                type: 'bar',
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
                        tooltip: {
                            enabled: false,
                            external: investmentExternalTooltip,
                            callbacks: {
                                label: (ctx) => ` Inversión: ${formatUFComplete(ctx.raw)} UF (${((ctx.raw / (totalSampleInv || 1)) * 100).toFixed(1)}%)`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                font: { size: 8.5 },
                                callback: (val) => formatUF(val)
                            }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 8.5 }, autoSkip: false }
                        }
                    }
                }
            });
        } else {
            chartInvByRegionInstance.data.labels = invLabels;
            chartInvByRegionInstance.data.datasets[0].data = invValues;
            chartInvByRegionInstance.options.scales.x.grid.color = gridColor;
            chartInvByRegionInstance.options.scales.x.ticks.color = textColor;
            chartInvByRegionInstance.options.scales.y.ticks.color = textColor;
            chartInvByRegionInstance.options.scales.y.ticks.autoSkip = false;
            chartInvByRegionInstance.options.plugins.tooltip.callbacks.label = (ctx) => ` Inversión: ${formatUFComplete(ctx.raw)} UF (${((ctx.raw / (totalSampleInv || 1)) * 100).toFixed(1)}%)`;
            chartInvByRegionInstance.update();
        }
    }

    // 2) Gráfico 2: Contratos por Región (Barras Horizontales Proporcionales)
    const sortedCntRegions = Object.entries(contractsByRegion).sort((a, b) => b[1] - a[1]);
    const cntLabels = sortedCntRegions.map(e => e[0]);
    const cntValues = sortedCntRegions.map(e => e[1]);

    const canvasCnt = document.getElementById('chartContractsByRegion');
    if (canvasCnt) {
        if (!chartContractsByRegionInstance) {
            chartContractsByRegionInstance = new Chart(canvasCnt.getContext('2d'), {
                type: 'bar',
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
                        tooltip: {
                            enabled: false,
                            external: investmentExternalTooltip,
                            callbacks: {
                                label: (ctx) => ` Contratos: ${ctx.raw.toFixed(2)} (${((ctx.raw / (contractsList.length || 1)) * 100).toFixed(1)}%)`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 8.5 } }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 8.5 }, autoSkip: false }
                        }
                    }
                }
            });
        } else {
            chartContractsByRegionInstance.data.labels = cntLabels;
            chartContractsByRegionInstance.data.datasets[0].data = cntValues;
            chartContractsByRegionInstance.options.scales.x.grid.color = gridColor;
            chartContractsByRegionInstance.options.scales.x.ticks.color = textColor;
            chartContractsByRegionInstance.options.scales.y.ticks.color = textColor;
            chartContractsByRegionInstance.options.scales.y.ticks.autoSkip = false;
            chartContractsByRegionInstance.options.plugins.tooltip.callbacks.label = (ctx) => ` Contratos: ${ctx.raw.toFixed(2)} (${((ctx.raw / (contractsList.length || 1)) * 100).toFixed(1)}%)`;
            chartContractsByRegionInstance.update();
        }
    }

    // 3) Gráfico 3: Pie / Donut Chart (% Inversión por Sector del Proyecto)
    const invBySector = {};
    contractsList.forEach(item => {
        const sec = item['Sector del proyecto'] || 'Sin sector';
        const inv = parseFloat(item['Inversión Materializada estimada'] || 0) || 0;
        invBySector[sec] = (invBySector[sec] || 0) + inv;
    });

    const sortedSec = Object.entries(invBySector).sort((a, b) => b[1] - a[1]);
    const secLabels = sortedSec.map(e => e[0]);
    const secValues = sortedSec.map(e => e[1]);
    const secColors = secLabels.map(s => getSectorConfig(s).color);

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
                                label: (ctx) => ` ${((ctx.raw / (totalSampleInv || 1)) * 100).toFixed(1)}% (${formatUF(ctx.raw)})`
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
            chartInvShareRegionInstance.options.plugins.tooltip.callbacks.label = (ctx) => ` ${((ctx.raw / (totalSampleInv || 1)) * 100).toFixed(1)}% (${formatUF(ctx.raw)})`;
            chartInvShareRegionInstance.update();
        }
    }

    // Render Custom HTML Legend for Sector Investment Chart (Non-jumpy fixed layout)
    const legendSecEl = document.getElementById('chartInvShareRegionLegend');
    if (legendSecEl) {
        legendSecEl.innerHTML = '';
        secLabels.forEach((lbl, idx) => {
            const val = secValues[idx];
            const pct = totalSampleInv > 0 ? ((val / totalSampleInv) * 100).toFixed(1) : 0;
            const col = secColors[idx];
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'display:flex; align-items:center; gap:0.3rem; font-size:0.64rem; padding:0.03rem 0;';
            itemDiv.innerHTML = `
                <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                <span style="color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">${lbl}</span>
                <span style="font-weight:700; color:var(--text-primary); flex-shrink:0; white-space:nowrap;">${pct}%</span>
            `;
            legendSecEl.appendChild(itemDiv);
        });
    }

    // 4. CÁLCULO HISTOGRAMAS TEMPORALES (Contratos e Inversión Activa por Año)
    const yearlyContracts = {};
    const yearlyInvestment = {};

    const parseYear = (dStr) => {
        if (!dStr) return null;
        const m = String(dStr).match(/(\d{4})/);
        return m ? parseInt(m[1], 10) : null;
    };

    contractsList.forEach(c => {
        const startY = parseYear(c['Fecha inicio del contrato de concesión']) || parseYear(c['Fecha decreto adjudicación']);
        const endY = parseYear(c['Fecha término de la concesión']) || 2050;
        const inv = parseFloat(c['Inversión Materializada estimada'] || 0) || 0;

        if (startY) {
            const s = Math.max(1993, startY);
            const e = Math.min(2055, endY);
            for (let y = s; y <= e; y++) {
                yearlyContracts[y] = (yearlyContracts[y] || 0) + 1;
                yearlyInvestment[y] = (yearlyInvestment[y] || 0) + inv;
            }
        }
    });

    const yearsArr = [];
    for (let y = 1993; y <= 2055; y++) { yearsArr.push(y); }

    const activeCntData = yearsArr.map(y => yearlyContracts[y] || 0);
    const activeInvData = yearsArr.map(y => yearlyInvestment[y] || 0);

    // 4) Gráfico 4: Contratos Vigentes por Año 
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
                                label: (ctx) => ` Año ${ctx.label}: ${ctx.raw} contratos vigentes`
                            }
                        }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 8 } } },
                        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 8 } } }
                    }
                }
            });
        } else {
            chartActiveContractsYearInstance.data.labels = yearsArr;
            chartActiveContractsYearInstance.data.datasets[0].data = activeCntData;
            chartActiveContractsYearInstance.options.scales.x.ticks.color = textColor;
            chartActiveContractsYearInstance.options.scales.y.grid.color = gridColor;
            chartActiveContractsYearInstance.options.scales.y.ticks.color = textColor;
            chartActiveContractsYearInstance.update();
        }
    }

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
                        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 8 } } },
                        y: {
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                font: { size: 8 },
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
            chartActiveInvYearInstance.options.scales.y.grid.color = gridColor;
            chartActiveInvYearInstance.options.scales.y.ticks.color = textColor;
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

