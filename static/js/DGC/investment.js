function showInvestmentView() {
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

    const kpiInvCard = document.getElementById('kpi-investment-card');
    if (kpiInvCard) kpiInvCard.classList.add('timeline-active');

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

    const kpiInvCard = document.getElementById('kpi-investment-card');
    if (kpiInvCard) kpiInvCard.classList.remove('timeline-active');

    if (typeof leafletMap !== 'undefined' && leafletMap) {
        setTimeout(() => { leafletMap.invalidateSize(); }, 100);
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
                        borderRadius: 3
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
                            ticks: { color: textColor, font: { size: 8.5 } }
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
                        borderRadius: 3
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
                            ticks: { color: textColor, font: { size: 8.5 } }
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
                            padding: 5,
                            titleFont: { size: 8.5 },
                            bodyFont: { size: 8 },
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
            itemDiv.style.cssText = 'display:flex; align-items:center; justify-content:space-between; font-size:0.65rem; padding:0.06rem 0;';
            itemDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.3rem; min-width:0; overflow:hidden;">
                    <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                    <span style="color:var(--text-secondary); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${lbl}</span>
                </div>
                <span style="font-weight:700; color:var(--text-primary); font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                    ${pct}% <span style="font-weight:500; color:var(--text-muted); font-size:0.61rem;">(${formatUF(val)})</span>
                </span>
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
                        borderRadius: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
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
                        borderRadius: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
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
    const kpiInvCard = document.getElementById('kpi-investment-card');
    if (kpiInvCard) {
        kpiInvCard.addEventListener('click', () => {
            if (appState.investmentOpen) {
                hideInvestmentView();
            } else {
                showInvestmentView();
            }
        });
    }

    const btnClose = document.getElementById('btn-close-investment');
    if (btnClose) {
        btnClose.addEventListener('click', () => hideInvestmentView());
    }
}

