// ─── EFE Analytics Charts Module ─────────────────────────────────────────────
var efeFilialChart = null;
var efeDetailChart = null;

// Distinct color palettes matching refined efe.cl palette (balanced tones)
const EFE_FILIAL_COLORS = {
    'EFE Central': '#d92534',
    'EFE Valparaíso': '#1694b8',
    'EFE Sur': '#2b5ec9',
    'EFE Arica - La Paz': '#1e9952',
    'Sin filial específica': '#64748b',
    'Nacional': '#64748b'
};

const EFE_DETAIL_COLORS = {
    'Portafolio de Proyectos Estratégicos': '#0f3b6c', // Azul Marino Corporativo
    'Proyectos Preinversionales': '#2b5ec9',           // Azul Transporte
    'Otros / Extra': '#64748b'                         // Gris Slate
};

var EFE_PALETTE = window.EFE_PALETTE || [
    '#0f3b6c', '#d92534', '#2b5ec9', '#1e9952', '#1694b8', '#e69500', '#64748b'
];

function efeFormatCompactUSD(val) {
    if (val == null || isNaN(val) || val === 0) return 'US$ 0';
    if (val >= 1e9) {
        return 'US$ ' + (val / 1e9).toFixed(1) + 'B';
    }
    if (val >= 1e6) {
        return 'US$ ' + (val / 1e6).toFixed(1) + 'M';
    }
    if (val >= 1e3) {
        return 'US$ ' + (val / 1e3).toFixed(0) + 'K';
    }
    return 'US$ ' + Math.round(val).toLocaleString('es-CL');
}

// Shared external tooltip for EFE analysis panel charts
const efeExternalTooltip = CatlecTooltip.create({ domId: 'efe-analysis-tooltip' });

function efeInitAnalyticsCharts() {
    const borderColor = '#ffffff';

    // Chart 1: Filial Pie Chart
    const ctxFilial = document.getElementById('efeFilialChart');
    if (ctxFilial && !efeFilialChart) {
        efeFilialChart = new Chart(ctxFilial, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [],
                    borderWidth: 2,
                    borderColor: borderColor,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                animation: { duration: 450, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: efeExternalTooltip,
                        callbacks: {
                            label: function (context) {
                                const val = context.parsed || 0;
                                return ' ' + context.label + ': ' + efeFormatCompactUSD(val);
                            }
                        }
                    }
                }
            }
        });
    }

    // Chart 2: Detalle / Cartera Pie Chart (Estratégico vs Preinversional)
    const ctxDetail = document.getElementById('efeDetailChart');
    if (ctxDetail && !efeDetailChart) {
        efeDetailChart = new Chart(ctxDetail, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [],
                    borderWidth: 2,
                    borderColor: borderColor,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                animation: { duration: 450, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: efeExternalTooltip,
                        callbacks: {
                            label: function (context) {
                                const val = context.parsed || 0;
                                return ' ' + context.label + ': ' + val + ' proyectos';
                            }
                        }
                    }
                }
            }
        });
    }
}

function efeUpdateAnalyticsCharts(filteredProjects) {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    efeInitAnalyticsCharts();

    const borderColor = '#ffffff';

    const projects = filteredProjects || [];

    // ─── 1. Group Projects Count by Filial (Lectura exacta de Filial) ──────────
    const filialCounts = {
        'EFE Sur': 0,
        'EFE Central': 0,
        'EFE Valparaíso': 0,
        'EFE Arica - La Paz': 0,
        'Sin filial específica': 0
    };

    projects.forEach(p => {
        const fil = (p.filial && String(p.filial).trim() !== '' && String(p.filial).trim().toLowerCase() !== 'nan')
            ? String(p.filial).trim()
            : null;

        if (fil && filialCounts[fil] !== undefined) {
            filialCounts[fil]++;
        } else {
            filialCounts['Sin filial específica']++;
        }
    });

    // Remove keys with 0 if no projects
    const filialLabels = Object.keys(filialCounts).filter(k => filialCounts[k] > 0);
    const filialData = filialLabels.map(f => filialCounts[f]);
    const totalFilialProjects = filialData.reduce((a, b) => a + b, 0) || 1;
    const filialColors = filialLabels.map(f => EFE_FILIAL_COLORS[f] || '#64748b');

    if (efeFilialChart) {
        efeFilialChart.data.labels = filialLabels;
        efeFilialChart.data.datasets[0].data = filialData;
        efeFilialChart.data.datasets[0].backgroundColor = filialColors;
        efeFilialChart.data.datasets[0].borderColor = borderColor;
        efeFilialChart.options.plugins.tooltip.callbacks = {
            label: function (ctx) {
                const val = ctx.raw || 0;
                const pct = ((val / totalFilialProjects) * 100).toFixed(0);
                const displayVal = val % 1 === 0 ? val : (Math.round(val * 10) / 10).toFixed(1);
                return ` ${ctx.label}: ${displayVal} proyecto${val !== 1 ? 's' : ''} (${pct}%)`;
            }
        };
        efeFilialChart.update();
    }

    // Render Filial Custom HTML Legend
    const legendFilialElem = document.getElementById('efeFilialChartLegend');
    if (legendFilialElem) {
        legendFilialElem.innerHTML = filialLabels.map((lbl, idx) => {
            const val = filialData[idx];
            const pct = totalFilialProjects > 0 ? ((val / totalFilialProjects) * 100).toFixed(1).replace(/\.0$/, '') : '0';
            const col = filialColors[idx];
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.69rem; padding:0.12rem 0; color:var(--text-primary);">
                    <div style="display:flex; align-items:center; gap:0.35rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="width:13px; height:5.5px; border-radius:9999px; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-primary); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${lbl}</span>
                    </div>
                    <span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                        ${pct}%
                    </span>
                </div>
            `;
        }).join('');
    }

    // ─── 2. Group Projects Count by Detalle / Portafolio (Estratégico vs Preinversional) ──
    const detailCounts = {
        'Portafolio de Proyectos Estratégicos': 0,
        'Proyectos Preinversionales': 0,
        'Otros / Extra': 0
    };

    projects.forEach(p => {
        const cat = typeof efeGetDetailCategory === 'function' ? efeGetDetailCategory(p.detail) : 'Otros / Extra';
        if (detailCounts[cat] !== undefined) {
            detailCounts[cat]++;
        } else {
            detailCounts['Otros / Extra']++;
        }
    });

    const detailLabels = Object.keys(detailCounts).filter(k => detailCounts[k] > 0);
    const detailData = detailLabels.map(k => detailCounts[k]);
    const totalDetailProjects = detailData.reduce((a, b) => a + b, 0) || 1;
    const detailColors = detailLabels.map(k => EFE_DETAIL_COLORS[k] || '#6c757d');

    if (efeDetailChart) {
        efeDetailChart.data.labels = detailLabels;
        efeDetailChart.data.datasets[0].data = detailData;
        efeDetailChart.data.datasets[0].backgroundColor = detailColors;
        efeDetailChart.data.datasets[0].borderColor = borderColor;
        efeDetailChart.options.plugins.tooltip.callbacks = {
            label: function (ctx) {
                const val = ctx.raw || 0;
                const pct = ((val / totalDetailProjects) * 100).toFixed(0);
                return ` ${ctx.label}: ${val} proyecto${val !== 1 ? 's' : ''} (${pct}%)`;
            }
        };
        efeDetailChart.update();
    }

    // Render Detail Custom HTML Legend
    const legendDetailElem = document.getElementById('efeDetailChartLegend');
    if (legendDetailElem) {
        legendDetailElem.innerHTML = detailLabels.map((lbl, idx) => {
            const val = detailData[idx];
            const pct = totalDetailProjects > 0 ? ((val / totalDetailProjects) * 100).toFixed(1).replace(/\.0$/, '') : '0';
            const col = detailColors[idx];

            let shortLbl = lbl;
            if (lbl === 'Portafolio de Proyectos Estratégicos') shortLbl = 'Estratégicos';
            else if (lbl === 'Proyectos Preinversionales') shortLbl = 'Preinversionales';
            else if (lbl === 'Otros / Extra') shortLbl = 'Otros / Extra';

            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.68rem; padding:0.08rem 0; color:var(--text-primary);" title="${lbl}: ${val} proyecto${val !== 1 ? 's' : ''} (${pct}%)">
                    <div style="display:flex; align-items:center; gap:0.3rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="width:13px; height:5.5px; border-radius:9999px; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${shortLbl}</span>
                    </div>
                    <span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                        ${pct}%
                    </span>
                </div>
            `;
        }).join('');
    }
}

// ─── EFE Operating Lines Analytics Charts (Servicios Actuales) ───────────────
var efeLinesFilialChart = null;
var efeLinesTraccionChart = null;

const EFE_TRACCION_COLORS = {
    'Eléctrica': '#2b5ec9', // Azul Transporte
    'Diésel': '#64748b',    // Gris Slate
    'Bimodal': '#1e9952'    // Verde Sostenible
};

function efeGetTractionCategory(tractionStr) {
    if (!tractionStr || String(tractionStr).trim() === '' || String(tractionStr).trim().toLowerCase() === 'nan') {
        return 'Diésel';
    }
    const t = String(tractionStr).trim().toLowerCase();
    if (t.includes('bimodal') || t.includes('híbrido')) {
        return 'Bimodal';
    }
    if (t.includes('eléctric')) {
        return 'Eléctrica';
    }
    if (t.includes('diésel') || t.includes('trocha') || t.includes('diesel')) {
        return 'Diésel';
    }
    return 'Diésel';
}

function efeInitLinesAnalyticsCharts() {
    const borderColor = '#ffffff';

    // Lines Chart 1: Filial Pie Chart
    const ctxFilial = document.getElementById('efeLinesFilialChart');
    if (ctxFilial && !efeLinesFilialChart) {
        efeLinesFilialChart = new Chart(ctxFilial, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [],
                    borderWidth: 2,
                    borderColor: borderColor,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                animation: { duration: 450, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: efeExternalTooltip,
                        callbacks: {
                            label: function (context) {
                                const val = context.parsed || 0;
                                return ' ' + context.label + ': ' + val + ' servicios';
                            }
                        }
                    }
                }
            }
        });
    }

    // Lines Chart 2: Tracción Pie Chart
    const ctxTraccion = document.getElementById('efeLinesTraccionChart');
    if (ctxTraccion && !efeLinesTraccionChart) {
        efeLinesTraccionChart = new Chart(ctxTraccion, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [],
                    borderWidth: 2,
                    borderColor: borderColor,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                animation: { duration: 450, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: efeExternalTooltip,
                        callbacks: {
                            label: function (context) {
                                const val = context.parsed || 0;
                                return ' ' + context.label + ': ' + val + ' servicios';
                            }
                        }
                    }
                }
            }
        });
    }
}

function efeUpdateLinesAnalyticsCharts(filteredLines) {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    efeInitLinesAnalyticsCharts();

    const borderColor = '#ffffff';

    const lines = filteredLines || (window.EFE_DATA && window.EFE_DATA.lines ? window.EFE_DATA.lines : []);

    // ─── 1. Group Lines by Filial ───────────────────────────────────────────
    const filialCounts = {
        'EFE Central': 0,
        'EFE Sur': 0,
        'EFE Valparaíso': 0
    };

    lines.forEach(l => {
        const fil = (l.filial && String(l.filial).trim() !== '' && String(l.filial).trim().toLowerCase() !== 'nan')
            ? String(l.filial).trim()
            : null;

        if (fil && filialCounts[fil] !== undefined) {
            filialCounts[fil]++;
        } else if (fil) {
            filialCounts[fil] = (filialCounts[fil] || 0) + 1;
        }
    });

    const filialLabels = Object.keys(filialCounts).filter(k => filialCounts[k] > 0);
    const filialData = filialLabels.map(f => filialCounts[f]);
    const totalFilialServices = filialData.reduce((a, b) => a + b, 0) || 1;
    const filialColors = filialLabels.map(f => EFE_FILIAL_COLORS[f] || '#64748b');

    if (efeLinesFilialChart) {
        efeLinesFilialChart.data.labels = filialLabels;
        efeLinesFilialChart.data.datasets[0].data = filialData;
        efeLinesFilialChart.data.datasets[0].backgroundColor = filialColors;
        efeLinesFilialChart.data.datasets[0].borderColor = borderColor;
        efeLinesFilialChart.options.plugins.tooltip.callbacks = {
            label: function (ctx) {
                const val = ctx.raw || 0;
                const pct = ((val / totalFilialServices) * 100).toFixed(0);
                return ` ${ctx.label}: ${val} servicio${val !== 1 ? 's' : ''} (${pct}%)`;
            }
        };
        efeLinesFilialChart.update();
    }

    const legendFilialElem = document.getElementById('efeLinesFilialChartLegend');
    if (legendFilialElem) {
        legendFilialElem.innerHTML = filialLabels.map((lbl, idx) => {
            const val = filialData[idx];
            const pct = totalFilialServices > 0 ? ((val / totalFilialServices) * 100).toFixed(1).replace(/\.0$/, '') : '0';
            const col = filialColors[idx];
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.69rem; padding:0.12rem 0; color:var(--text-primary);">
                    <div style="display:flex; align-items:center; gap:0.35rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="width:13px; height:5.5px; border-radius:9999px; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-primary); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${lbl}</span>
                    </div>
                    <span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                        ${pct}%
                    </span>
                </div>
            `;
        }).join('');
    }

    // ─── 2. Group Lines by Tracción (Eléctrica, Diésel, Bimodal) ─────────────
    const traccionCounts = {
        'Eléctrica': 0,
        'Diésel': 0,
        'Bimodal': 0
    };

    lines.forEach(l => {
        const tr = efeGetTractionCategory(l.traction);
        if (traccionCounts[tr] !== undefined) {
            traccionCounts[tr]++;
        } else {
            traccionCounts[tr] = 1;
        }
    });

    const traccionLabels = Object.keys(traccionCounts).filter(k => traccionCounts[k] > 0);
    const traccionData = traccionLabels.map(k => traccionCounts[k]);
    const totalTraccionServices = traccionData.reduce((a, b) => a + b, 0) || 1;
    const traccionColors = traccionLabels.map(k => EFE_TRACCION_COLORS[k] || '#64748b');

    if (efeLinesTraccionChart) {
        efeLinesTraccionChart.data.labels = traccionLabels;
        efeLinesTraccionChart.data.datasets[0].data = traccionData;
        efeLinesTraccionChart.data.datasets[0].backgroundColor = traccionColors;
        efeLinesTraccionChart.data.datasets[0].borderColor = borderColor;
        efeLinesTraccionChart.options.plugins.tooltip.callbacks = {
            label: function (ctx) {
                const val = ctx.raw || 0;
                const pct = ((val / totalTraccionServices) * 100).toFixed(0);
                return ` ${ctx.label}: ${val} servicio${val !== 1 ? 's' : ''} (${pct}%)`;
            }
        };
        efeLinesTraccionChart.update();
    }

    const legendTraccionElem = document.getElementById('efeLinesTraccionChartLegend');
    if (legendTraccionElem) {
        legendTraccionElem.innerHTML = traccionLabels.map((lbl, idx) => {
            const val = traccionData[idx];
            const pct = totalTraccionServices > 0 ? ((val / totalTraccionServices) * 100).toFixed(1).replace(/\.0$/, '') : '0';
            const col = traccionColors[idx];
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.68rem; padding:0.08rem 0; color:var(--text-primary);" title="${lbl}: ${val} servicio${val !== 1 ? 's' : ''} (${pct}%)">
                    <div style="display:flex; align-items:center; gap:0.3rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="width:13px; height:5.5px; border-radius:9999px; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${lbl}</span>
                    </div>
                    <span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                        ${pct}%
                    </span>
                </div>
            `;
        }).join('');
    }
}
window.efeInitLinesAnalyticsCharts = efeInitLinesAnalyticsCharts;
window.efeUpdateLinesAnalyticsCharts = efeUpdateLinesAnalyticsCharts;
