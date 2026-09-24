/**
 * static/js/EFE/investment.js
 * Visualización de Análisis de Inversión para EFE Trenes de Chile.
 * Harmonized with CATLEC index.html design palette.
 */

let efeChartInvByTipoInstance = null;
let efeChartInvByFilialInstance = null;
let efeChartTopProjectsInstance = null;

const EFE_INV_FILIAL_COLORS = {
    'EFE Central': '#d92534',
    'EFE Valparaíso': '#1694b8',
    'EFE Sur': '#2b5ec9',
    'EFE Arica - La Paz': '#1e9952',
    'Sin filial específica': '#64748b',
    'Nacional': '#64748b'
};

// Formato compacto de dólares USD (valores en MM USD)
function formatEfeUSD(val) {
    return CatlecUtils.formatCompactUSD(val, {
        emptyText: 'US$ 0',
        treatZeroAsInvalid: true,
        bWholeStrip: true,
        mmRounding: 'round'
    });
}

// Tooltip compartido para los gráficos de inversión EFE (idéntico al de análisis rápido)
const efeInvExternalTooltip = (typeof efeExternalTooltip === 'function')
    ? efeExternalTooltip
    : CatlecTooltip.create({ domId: 'efe-analysis-tooltip' });

// ── Control de Vistas (Mostrar / Ocultar Panel de Inversión) ───────────────────
function showEfeInvestmentView() {
    if (typeof efeMap !== 'undefined' && efeMap && efeMap.getCenter) {
        efeState.savedMapCenter = efeMap.getCenter();
        efeState.savedMapZoom = efeMap.getZoom();
    }
    if (efeState.timelineOpen && typeof hideEfeTimelineView === 'function') {
        hideEfeTimelineView(true);
    }
    if (efeState.operacionOpen && typeof hideEfeOperacionView === 'function') {
        hideEfeOperacionView(true);
    }
    efeState.investmentOpen = true;
    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const invPanel = document.getElementById('efe-investment-full-panel') || document.getElementById('investment-full-panel');
    const btnMap = document.getElementById('btn-efe-view-map');
    const btnInv = document.getElementById('btn-efe-view-investment');
    const btnTl = document.getElementById('btn-efe-view-timeline');
    const btnOp = document.getElementById('btn-efe-view-operacion');

    if (grid) grid.style.gridTemplateColumns = '280px 1fr';
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (invPanel) invPanel.style.display = 'flex';

    if (btnMap) btnMap.classList.remove('active');
    if (btnTl) btnTl.classList.remove('active');
    if (btnOp) btnOp.classList.remove('active');
    if (btnInv) btnInv.classList.add('active');

    // Cambiar URL hash limpiamente
    if (window.location.hash !== '#inversion') {
        history.replaceState(null, null, '#inversion');
    }

    const currentList = (typeof efeGetFilteredProjects === 'function')
        ? efeGetFilteredProjects()
        : ((typeof currentFilteredEFEProjects !== 'undefined' && currentFilteredEFEProjects)
            ? currentFilteredEFEProjects
            : ((window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : []));

    renderEfeInvestmentAnalytics(currentList);
}

function hideEfeInvestmentView(skipRestoreCenter) {
    efeState.investmentOpen = false;
    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const invPanel = document.getElementById('efe-investment-full-panel') || document.getElementById('investment-full-panel');
    const btnMap = document.getElementById('btn-efe-view-map');
    const btnInv = document.getElementById('btn-efe-view-investment');

    if (grid) grid.style.gridTemplateColumns = '';
    if (centerPanel) centerPanel.style.display = 'flex';
    if (rightPanel) rightPanel.style.display = 'flex';
    if (invPanel) invPanel.style.display = 'none';

    if (btnInv) btnInv.classList.remove('active');
    if (btnMap && !efeState.timelineOpen && !efeState.operacionOpen) btnMap.classList.add('active');

    if (window.location.hash === '#inversion' || window.location.hash === '#investment') {
        history.replaceState(null, null, window.location.pathname + window.location.search);
    }

    if (typeof efeMap !== 'undefined' && efeMap) {
        efeMap.invalidateSize({ animate: false });
        if (!skipRestoreCenter && efeState.savedMapCenter) {
            efeMap.setView(efeState.savedMapCenter, efeState.savedMapZoom || 5, { animate: false });
        }
        setTimeout(() => {
            if (typeof efeMap !== 'undefined' && efeMap) {
                efeMap.invalidateSize({ animate: false });
                if (!skipRestoreCenter && efeState.savedMapCenter) {
                    efeMap.setView(efeState.savedMapCenter, efeState.savedMapZoom || 5, { animate: false });
                }
            }
        }, 50);
    }
}

// ── Sincronizador de Botones Activos ──────────────────────────────────────────
function setEfeActiveSubheaderTab(tabName) {
    const btnMap = document.getElementById('btn-efe-view-map');
    const btnInv = document.getElementById('btn-efe-view-investment');
    if (tabName === 'investment') {
        if (btnMap) btnMap.classList.remove('active');
        if (btnInv) btnInv.classList.add('active');
    } else {
        if (btnMap) btnMap.classList.add('active');
        if (btnInv) btnInv.classList.remove('active');
    }
    if (window.location.hash !== (tabName === 'investment' ? '#inversion' : '')) {
        history.replaceState(null, null, tabName === 'investment' ? '#inversion' : '#');
    }
}

// ── Render Principal de Análisis de Inversión EFE ─────────────────────────────
function renderEfeInvestmentAnalytics(projectsList) {
    if (!projectsList) return;

    const textColor = '#475569';
    const gridColor = 'rgba(0, 0, 0, 0.06)';
    const doughnutBorder = '#ffffff';

    if (typeof Chart !== 'undefined') {
        Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    }

    // 1. Inversión total
    let displayTotalInv = 0;
    projectsList.forEach(p => {
        displayTotalInv += (p.investment_mm_usd || 0);
    });

    // 2. Distribución de inversión por filial (Lectura exacta de Filial)
    const filialInv = {
        'EFE Central': 0,
        'EFE Sur': 0,
        'EFE Valparaíso': 0,
        'EFE Arica - La Paz': 0,
        'Sin filial específica': 0
    };

    projectsList.forEach(p => {
        const inv = p.investment_mm_usd || 0;
        if (inv <= 0) return;

        const fil = (p.filial && String(p.filial).trim() !== '' && String(p.filial).trim().toLowerCase() !== 'nan')
            ? String(p.filial).trim()
            : null;

        if (fil && filialInv[fil] !== undefined) {
            filialInv[fil] += inv;
        } else {
            filialInv['Sin filial específica'] += inv;
        }
    });

    const projectsWithInv = projectsList.filter(p => (p.investment_mm_usd || 0) > 0);
    const reportedCount = projectsWithInv.length;
    const avgInv = reportedCount > 0 ? (displayTotalInv / reportedCount) : 0;

    const sortedFilials = Object.entries(filialInv).sort((a, b) => b[1] - a[1]);
    const topFilial = sortedFilials.length > 0 && sortedFilials[0][1] > 0 ? sortedFilials[0] : ['Sin datos', 0];

    // Actualizar KPI Banner
    const kpiTotal = document.getElementById('efe-kpi-inv-total');
    const kpiTotalLabel = document.getElementById('efe-kpi-inv-total-label');
    const kpiAvg = document.getElementById('efe-kpi-inv-avg');
    const kpiTopFilial = document.getElementById('efe-kpi-inv-top-filial');

    if (kpiTotalLabel) kpiTotalLabel.textContent = 'Inversión total';
    if (kpiTotal) kpiTotal.textContent = formatEfeUSD(displayTotalInv);
    if (kpiAvg) kpiAvg.textContent = formatEfeUSD(avgInv);
    if (kpiTopFilial) {
        if (topFilial[0] === 'Sin datos' || topFilial[1] === 0) {
            kpiTopFilial.textContent = 'Sin datos';
            kpiTopFilial.title = '';
        } else {
            kpiTopFilial.textContent = `${topFilial[0]} (${formatEfeUSD(topFilial[1])})`;
            kpiTopFilial.title = `${topFilial[0]} - ${formatEfeUSD(topFilial[1])}`;
        }
    }

    // ─── Gráfico 1: Inversión según Tipo de Proyecto (Barras Horizontales) ────
    const tipoInv = {};
    const tipoCounts = {};

    projectsList.forEach(p => {
        const t = (p.type && String(p.type).trim() !== '' && String(p.type).trim().toLowerCase() !== 'nan')
            ? String(p.type).trim()
            : 'Sin tipo';
        const inv = p.investment_mm_usd || 0;
        tipoInv[t] = (tipoInv[t] || 0) + inv;
        tipoCounts[t] = (tipoCounts[t] || 0) + 1;
    });

    const sortedTipos = Object.entries(tipoInv).sort((a, b) => b[1] - a[1]);
    const tipoLabels = sortedTipos.map(e => e[0]);
    const tipoValues = sortedTipos.map(e => e[1]);

    const canvasTipo = document.getElementById('efeChartInvByTipo');
    if (canvasTipo) {
        if (!efeChartInvByTipoInstance) {
            efeChartInvByTipoInstance = new Chart(canvasTipo.getContext('2d'), {
                type: 'bar',
                plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
                data: {
                    labels: tipoLabels,
                    datasets: [{
                        label: 'Inversión (MM USD)',
                        data: tipoValues,
                        backgroundColor: 'rgba(15,59,108,0.8)',
                        borderColor: '#0f3b6c',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 450, easing: 'easeOutQuart' },
                    layout: { padding: { top: 0, bottom: 0, left: 0, right: 10 } },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: efeInvExternalTooltip,
                            callbacks: {
                                label: (ctx) => {
                                    const val = ctx.raw || 0;
                                    const tName = ctx.label;
                                    const cnt = tipoCounts[tName] || 0;
                                    const pct = displayTotalInv > 0 ? ((val / displayTotalInv) * 100).toFixed(1) : 0;
                                    return ` Inversión: ${formatEfeUSD(val)} (${pct}%) · ${cnt} proyecto${cnt !== 1 ? 's' : ''}`;
                                }
                            }
                        },
                        horizontalBarDataLabelsPlugin: {
                            formatter: (val) => {
                                const pct = displayTotalInv > 0 ? ((val / displayTotalInv) * 100).toFixed(1) : 0;
                                return `${val.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${pct}%)`;
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                font: { size: 10, weight: '600' },
                                callback: (val) => val.toLocaleString('es-CL')
                            },
                            title: {
                                display: true,
                                text: 'Inversión (MM USD)',
                                color: textColor,
                                font: { size: 9.5, weight: '600' }
                            }
                        },
                        y: {
                            grid: { display: false },
                            ticks: {
                                color: textColor,
                                font: { size: 10, weight: '600' },
                                autoSkip: false
                            }
                        }
                    }
                }
            });
        } else {
            efeChartInvByTipoInstance.data.labels = tipoLabels;
            efeChartInvByTipoInstance.data.datasets[0].data = tipoValues;
            efeChartInvByTipoInstance.data.datasets[0].backgroundColor = '#0f3b6c';
            efeChartInvByTipoInstance.options.scales.x.grid.color = gridColor;
            efeChartInvByTipoInstance.options.scales.x.ticks.color = textColor;
            efeChartInvByTipoInstance.options.scales.x.ticks.font = { size: 10, weight: '600' };
            efeChartInvByTipoInstance.options.scales.x.ticks.callback = (val) => val.toLocaleString('es-CL');
            efeChartInvByTipoInstance.options.scales.x.title = {
                display: true,
                text: 'Inversión (MM USD)',
                color: textColor,
                font: { size: 9.5, weight: '600' }
            };
            efeChartInvByTipoInstance.options.scales.y.ticks.color = textColor;
            efeChartInvByTipoInstance.options.scales.y.ticks.font = { size: 10, weight: '600' };
            efeChartInvByTipoInstance.options.plugins.tooltip.callbacks.label = (ctx) => {
                const val = ctx.raw || 0;
                const tName = ctx.label;
                const cnt = tipoCounts[tName] || 0;
                const pct = displayTotalInv > 0 ? ((val / displayTotalInv) * 100).toFixed(1) : 0;
                return ` Inversión: ${formatEfeUSD(val)} (${pct}%) · ${cnt} proyecto${cnt !== 1 ? 's' : ''}`;
            };
            if (efeChartInvByTipoInstance.options.plugins.horizontalBarDataLabelsPlugin) {
                efeChartInvByTipoInstance.options.plugins.horizontalBarDataLabelsPlugin.formatter = (val) => {
                    const pct = displayTotalInv > 0 ? ((val / displayTotalInv) * 100).toFixed(1) : 0;
                    return `${val.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${pct}%)`;
                };
            }
            efeChartInvByTipoInstance.update();
        }
    }

    // ─── Gráfico 2: Inversión por Filial (%) ──────────────────────────────────
    const filLabels = sortedFilials.map(e => e[0]);
    const filValues = sortedFilials.map(e => e[1]);
    const filColors = filLabels.map(f => EFE_INV_FILIAL_COLORS[f] || '#64748b');
    const totalFilialInv = filValues.reduce((s, v) => s + v, 0) || displayTotalInv || 1;

    const canvasFilial = document.getElementById('efeChartInvByFilial');
    if (canvasFilial) {
        if (!efeChartInvByFilialInstance) {
            efeChartInvByFilialInstance = new Chart(canvasFilial.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: filLabels,
                    datasets: [{
                        data: filValues,
                        backgroundColor: filColors,
                        borderColor: doughnutBorder,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    animation: { duration: 450, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: efeInvExternalTooltip,
                            callbacks: {
                                label: (ctx) => ` Inversión: ${formatEfeUSD(ctx.raw)} (${totalFilialInv > 0 ? ((ctx.raw / totalFilialInv) * 100).toFixed(1) : 0}%)`
                            }
                        }
                    }
                }
            });
        } else {
            efeChartInvByFilialInstance.data.labels = filLabels;
            efeChartInvByFilialInstance.data.datasets[0].data = filValues;
            efeChartInvByFilialInstance.data.datasets[0].backgroundColor = filColors;
            efeChartInvByFilialInstance.data.datasets[0].borderColor = doughnutBorder;
            efeChartInvByFilialInstance.options.plugins.tooltip.callbacks.label = (ctx) => ` Inversión: ${formatEfeUSD(ctx.raw)} (${totalFilialInv > 0 ? ((ctx.raw / totalFilialInv) * 100).toFixed(1) : 0}%)`;
            efeChartInvByFilialInstance.update();
        }
    }

    // Leyenda HTML de Filiales
    const legendFilialEl = document.getElementById('efeChartInvByFilialLegend');
    if (legendFilialEl) {
        legendFilialEl.innerHTML = '';
        filLabels.forEach((lbl, idx) => {
            const val = filValues[idx];
            const pct = totalFilialInv > 0 ? ((val / totalFilialInv) * 100).toFixed(1) : 0;
            const col = filColors[idx];
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:0.4rem; font-size:0.75rem; padding:0.06rem 0;';
            itemDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.35rem; min-width:0; overflow:hidden;">
                    <span style="width:13px; height:5.5px; border-radius:9999px; background-color:${col}; flex-shrink:0;"></span>
                    <span style="color:var(--text-secondary); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${lbl}</span>
                </div>
                <span style="font-weight:700; color:var(--text-primary); flex-shrink:0; white-space:nowrap;">${formatEfeUSD(val)} <span style="font-weight:400; color:var(--text-muted); font-size:0.68rem;">(${pct}%)</span></span>
            `;
            legendFilialEl.appendChild(itemDiv);
        });
    }

    // ─── Gráfico 3: Top 5 Proyectos Ferroviarios con Mayor Inversión ──────────
    const sortedProjects = [...projectsList]
        .map(p => ({
            ...p,
            attributableInv: (p.investment_mm_usd || 0)
        }))
        .filter(p => p.attributableInv > 0)
        .sort((a, b) => b.attributableInv - a.attributableInv)
        .slice(0, 5);

    // Invertir para renderizar el mayor en la parte superior en Chart.js
    const topProjRev = [...sortedProjects].reverse();
    const projLabels = topProjRev.map(p => CatlecUtils.wrapTextToLines(p.name || 'Sin nombre', 24, 2));
    const projValues = topProjRev.map(p => p.attributableInv);

    const canvasTop = document.getElementById('efeChartTopProjects');
    if (canvasTop) {
        if (!efeChartTopProjectsInstance) {
            efeChartTopProjectsInstance = new Chart(canvasTop.getContext('2d'), {
                type: 'bar',
                plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
                data: {
                    labels: projLabels,
                    datasets: [{
                        label: 'Inversión (USD)',
                        data: projValues,
                        backgroundColor: 'rgba(217,37,52,0.8)',
                        borderColor: '#d92534',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 450, easing: 'easeOutQuart' },
                    layout: { padding: { top: 0, bottom: 0, left: 0, right: 10 } },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: efeInvExternalTooltip,
                            callbacks: {
                                title: (items) => {
                                    const entry = topProjRev[items[0].dataIndex];
                                    return entry ? entry.name : items[0].label;
                                },
                                label: (ctx) => {
                                    const entry = topProjRev[ctx.dataIndex];
                                    return [
                                        ` Inversión: ${formatEfeUSD(ctx.raw)}`,
                                        ` Filial: ${entry.filial || 'Sin filial específica'}`,
                                        ` Tipo: ${entry.type || 'Sin tipo'}`
                                    ];
                                }
                            }
                        },
                        horizontalBarDataLabelsPlugin: {
                            formatter: (val) => val.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                font: { size: 10, weight: '600' },
                                callback: (val) => val.toLocaleString('es-CL')
                            },
                            title: {
                                display: true,
                                text: 'Inversión (MM USD)',
                                color: textColor,
                                font: { size: 9.5, weight: '600' }
                            }
                        },
                        y: {
                            grid: { display: false },
                            ticks: {
                                color: textColor,
                                font: { size: 10, weight: '600' },
                                autoSkip: false,
                                callback: function (val, idx) {
                                    const entry = topProjRev[idx];
                                    if (!entry) return this.getLabelForValue(val);
                                    return CatlecUtils.wrapTextToLines(entry.name, 24, 2);
                                }
                            }
                        }
                    }
                }
            });
        } else {
            efeChartTopProjectsInstance.data.labels = projLabels;
            efeChartTopProjectsInstance.data.datasets[0].data = projValues;
            efeChartTopProjectsInstance.data.datasets[0].backgroundColor = '#d92534';
            efeChartTopProjectsInstance.options.scales.x.grid.color = gridColor;
            efeChartTopProjectsInstance.options.scales.x.ticks.color = textColor;
            efeChartTopProjectsInstance.options.scales.x.ticks.font = { size: 10, weight: '600' };
            efeChartTopProjectsInstance.options.scales.x.ticks.callback = (val) => val.toLocaleString('es-CL');
            efeChartTopProjectsInstance.options.scales.x.title = {
                display: true,
                text: 'Inversión (MM USD)',
                color: textColor,
                font: { size: 9.5, weight: '600' }
            };
            efeChartTopProjectsInstance.options.scales.y.ticks.color = textColor;
            efeChartTopProjectsInstance.options.scales.y.ticks.font = { size: 10, weight: '600' };
            efeChartTopProjectsInstance.options.scales.y.ticks.callback = function (val, idx) {
                const entry = topProjRev[idx];
                if (!entry) return this.getLabelForValue(val);
                return CatlecUtils.wrapTextToLines(entry.name, 24, 2);
            };
            efeChartTopProjectsInstance.options.plugins.tooltip.callbacks.title = (items) => {
                const entry = topProjRev[items[0].dataIndex];
                return entry ? entry.name : items[0].label;
            };
            efeChartTopProjectsInstance.options.plugins.tooltip.callbacks.label = (ctx) => {
                const entry = topProjRev[ctx.dataIndex];
                return [
                    ` Inversión: ${formatEfeUSD(ctx.raw)}`,
                    ` Filial: ${entry.filial || 'Sin filial específica'}`,
                    ` Tipo: ${entry.type || 'Sin tipo'}`
                ];
            };
            if (efeChartTopProjectsInstance.options.plugins.horizontalBarDataLabelsPlugin) {
                efeChartTopProjectsInstance.options.plugins.horizontalBarDataLabelsPlugin.formatter = (val) => val.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            }
            efeChartTopProjectsInstance.update();
        }
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

