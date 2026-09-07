// ─── EFE Analytics Charts Module ─────────────────────────────────────────────
var efeFilialChart = null;
var efeDetailChart = null;

// Distinct color palettes matching CATLEC index.html aesthetics
const EFE_FILIAL_COLORS = {
    'EFE Valparaíso': '#0284c7', // Sky Blue
    'EFE Central': '#2563eb',   // Royal Blue
    'EFE Sur': '#d97706',       // Amber / Orange
    'EFE Arica - La Paz': '#059669', // Emerald
    'Sin filial específica': '#64748b', // Slate Gray
    'Nacional': '#8b5cf6'       // Purple
};

const EFE_DETAIL_COLORS = {
    'Portafolio de Proyectos Estratégicos': '#2563eb', // Royal Blue
    'Proyectos Preinversionales': '#10b981',           // Emerald
    'Otros / Extra': '#f59e0b'                         // Amber
};

const EFE_PALETTE = [
    '#2563eb', '#0284c7', '#d97706', '#8b5cf6', '#ec4899',
    '#14b8a6', '#10b981', '#6366f1', '#eab308', '#64748b'
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
function efeExternalTooltip(context) {
    const { chart, tooltip } = context;
    const tooltipId = 'efe-analysis-tooltip';
    let el = document.getElementById(tooltipId);
    if (!el) {
        el = document.createElement('div');
        el.id = tooltipId;
        el.style.cssText = [
            'position:fixed',
            'background:rgba(15,23,42,0.92)',
            'color:#fff',
            'border-radius:6px',
            'padding:6px 10px',
            'font:12px/1.4 system-ui,sans-serif',
            'pointer-events:none',
            'white-space:nowrap',
            'z-index:9999',
            'box-shadow:0 4px 14px rgba(0,0,0,0.25)',
            'border:1px solid rgba(255,255,255,0.1)',
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

function efeInitAnalyticsCharts() {
    const isLight = document.body.classList.contains('light-theme');
    const borderColor = isLight ? '#ffffff' : '#0f1626';

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

    const isLight = document.body.classList.contains('light-theme');
    const borderColor = isLight ? '#ffffff' : '#0f1626';

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
                        <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
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
    const detailColors = detailLabels.map(k => EFE_DETAIL_COLORS[k] || '#64748b');

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
                        <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
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
