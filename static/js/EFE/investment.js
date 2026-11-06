/**
 * static/js/EFE/investment.js
 * Análisis de inversión de EFE Trenes de Chile: columna derecha de la vista "Portafolio de Proyectos"
 * (las líneas de tiempo van a la izquierda, timeline.js). KPI, inversión por tipo de proyecto (donut) y los 5 proyectos con mayor inversión.
 * Harmonized with CATLEC DGC.html design palette.
 */

let efeChartInvByTipoInstance = null;
let efeChartTopProjectsInstance = null;

// Colores del gráfico circular de inversión por tipo de proyecto (los tipos de EFE.xlsx)
const EFE_INV_TIPO_COLORS = {
    'Expansión': '#0f3b6c',
    'Mejoramiento': '#d92534',
    'Ampliación': '#2b5ec9',
    'Mejoramiento Sistemas': '#1694b8',
    'Logística': '#e69500',
    'Reposición': '#1e9952',
    'Sin tipo': '#94a3b8'
};
const EFE_INV_TIPO_EXTRA = ['#64748b', '#8b5cf6', '#475569'];

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

// ── Vista ─────────────────────────────────────────────────────────────────────
// El análisis de inversión es la columna derecha de "Portafolio de Proyectos" (timeline.js): mostrar u
// ocultar esta vista es mostrar u ocultar esa.
function showEfeInvestmentView() {
    if (typeof showEfeTimelineView === 'function') showEfeTimelineView();
}

function hideEfeInvestmentView(skipRestoreCenter) {
    if (efeState.timelineOpen && typeof hideEfeTimelineView === 'function') hideEfeTimelineView(skipRestoreCenter);
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

    const projectsWithInv = projectsList.filter(p => (p.investment_mm_usd || 0) > 0);
    const reportedCount = projectsWithInv.length;
    const avgInv = reportedCount > 0 ? (displayTotalInv / reportedCount) : 0;

    // Actualizar KPI Banner
    const kpiTotal = document.getElementById('efe-kpi-inv-total');
    const kpiTotalLabel = document.getElementById('efe-kpi-inv-total-label');
    const kpiAvg = document.getElementById('efe-kpi-inv-avg');

    if (kpiTotalLabel) kpiTotalLabel.textContent = 'Inversión total';
    if (kpiTotal) kpiTotal.textContent = formatEfeUSD(displayTotalInv);
    if (kpiAvg) kpiAvg.textContent = formatEfeUSD(avgInv);

    // ─── Gráfico 1: Inversión según Tipo de Proyecto (donut) ──────────────────
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

    const tipoColors = tipoLabels.map((t, i) => EFE_INV_TIPO_COLORS[t] || EFE_INV_TIPO_EXTRA[i % EFE_INV_TIPO_EXTRA.length]);
    const pctDe = v => (displayTotalInv > 0 ? (v / displayTotalInv * 100) : 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const tipoLabel = (ctx) => {
        const cnt = tipoCounts[ctx.label] || 0;
        return [` Inversión: ${formatEfeUSD(ctx.raw || 0)} (${pctDe(ctx.raw || 0)}%)`, ` ${cnt} proyecto${cnt !== 1 ? 's' : ''}`];
    };

    const canvasTipo = document.getElementById('efeChartInvByTipo');
    if (canvasTipo) {
        if (!efeChartInvByTipoInstance) {
            efeChartInvByTipoInstance = new Chart(canvasTipo.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: tipoLabels,
                    datasets: [{
                        data: tipoValues,
                        backgroundColor: tipoColors,
                        borderColor: doughnutBorder,
                        borderWidth: 1.5,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    layout: { padding: 4 },
                    animation: { duration: 450, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: efeInvExternalTooltip,
                            callbacks: { label: tipoLabel }
                        }
                    }
                }
            });
        } else {
            efeChartInvByTipoInstance.data.labels = tipoLabels;
            efeChartInvByTipoInstance.data.datasets[0].data = tipoValues;
            efeChartInvByTipoInstance.data.datasets[0].backgroundColor = tipoColors;
            efeChartInvByTipoInstance.options.plugins.tooltip.callbacks.label = tipoLabel;
            efeChartInvByTipoInstance.update();
        }
    }

    // Leyenda HTML (viñeta circular, tipo, monto y porcentaje)
    const legendTipoEl = document.getElementById('efeChartInvByTipoLegend');
    if (legendTipoEl) {
        legendTipoEl.innerHTML = tipoLabels.map((t, i) => `
            <div class="efe-portafolio-legend-row" title="${t}: ${formatEfeUSD(tipoValues[i])} (${pctDe(tipoValues[i])}%) · ${tipoCounts[t]} proyecto${tipoCounts[t] !== 1 ? 's' : ''}">
                <span class="efe-portafolio-legend-dot" style="background:${tipoColors[i]}"></span>
                <span class="efe-portafolio-legend-label">${t}</span>
                <span class="efe-portafolio-legend-val">${formatEfeUSD(tipoValues[i])} <span>(${pctDe(tipoValues[i])}%)</span></span>
            </div>`).join('');
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

    // En barras horizontales Chart.js dibuja la primera etiqueta arriba: el mayor va primero
    const topProjRev = sortedProjects;
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

