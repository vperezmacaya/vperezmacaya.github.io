// ─── EFE Analytics Charts Module ─────────────────────────────────────────────
// Tarjeta "Análisis" de la visualización Mapa: donuts de la red en operación
// (pasajeros por filial y km por tracción), según los servicios filtrados.

// Distinct color palettes matching refined efe.cl palette (balanced tones)
const EFE_FILIAL_COLORS = {
    'EFE Central': '#d92534',
    'EFE Valparaíso': '#1694b8',
    'EFE Sur': '#2b5ec9',
    'EFE Arica - La Paz': '#1e9952',
    'Sin filial específica': '#64748b',
    'Nacional': '#64748b'
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

// ─── Donuts de la red en operación ──────────────────────────────────────────
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

    // Chart 1: Pasajeros del último año por filial
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
                                return ' ' + context.label + ': ' + val + ' MM pasajeros';
                            }
                        }
                    }
                }
            }
        });
    }

    // Chart 2: Extensión de red (km) por tracción
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
                                return ' ' + context.label + ': ' + val + ' km';
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

    // ─── 1. Pasajeros del último año por filial ─────────────────────────────
    // efeComputeOperationTotals (operacion.js) usa la demanda oficial de cada filial
    // cuando están todos sus servicios y la suma por servicio cuando hay un subconjunto.
    const filialOrder = ['EFE Central', 'EFE Valparaíso', 'EFE Sur'];
    const filiales = [...new Set(lines.map(l => String(l.filial || '').trim()).filter(Boolean))]
        .sort((a, b) => (filialOrder.indexOf(a) + 1 || 99) - (filialOrder.indexOf(b) + 1 || 99));
    const filialPax = {};
    filiales.forEach(fil => {
        const pax = efeComputeOperationTotals(lines.filter(l => String(l.filial || '').trim() === fil)).totalPax;
        if (pax > 0) filialPax[fil] = Math.round(pax * 100) / 100;
    });

    const filialLabels = Object.keys(filialPax);
    const filialData = filialLabels.map(f => filialPax[f]);
    const totalFilialPax = filialData.reduce((a, b) => a + b, 0) || 1;
    const filialColors = filialLabels.map(f => EFE_FILIAL_COLORS[f] || '#64748b');
    const fmtPax = (v) => v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    if (efeLinesFilialChart) {
        efeLinesFilialChart.data.labels = filialLabels;
        efeLinesFilialChart.data.datasets[0].data = filialData;
        efeLinesFilialChart.data.datasets[0].backgroundColor = filialColors;
        efeLinesFilialChart.data.datasets[0].borderColor = borderColor;
        efeLinesFilialChart.options.plugins.tooltip.callbacks = {
            label: function (ctx) {
                const val = ctx.raw || 0;
                const pct = ((val / totalFilialPax) * 100).toFixed(0);
                return ` ${ctx.label}: ${fmtPax(val)} MM pasajeros (${pct}%)`;
            }
        };
        efeLinesFilialChart.update();
    }

    const legendFilialElem = document.getElementById('efeLinesFilialChartLegend');
    if (legendFilialElem) {
        legendFilialElem.innerHTML = filialLabels.map((lbl, idx) => {
            const val = filialData[idx];
            const pct = totalFilialPax > 0 ? ((val / totalFilialPax) * 100).toFixed(1).replace(/\.0$/, '').replace('.', ',') : '0';
            const col = filialColors[idx];
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.69rem; padding:0.12rem 0; color:var(--text-primary);" title="${lbl}: ${fmtPax(val)} MM pasajeros (${pct}%)">
                    <div style="display:flex; align-items:center; gap:0.35rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="width:13px; height:5.5px; border-radius:9999px; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-primary); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${lbl}</span>
                    </div>
                    <span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                        ${pct}%
                    </span>
                </div>
            `;
        }).join('') || '<span style="font-size:0.68rem; color:var(--text-muted);">Sin servicios para los filtros</span>';
    }

    // ─── 2. Extensión de red (km) por tracción (Eléctrica, Bimodal, Diésel) ──
    const traccionKm = {
        'Eléctrica': 0,
        'Bimodal': 0,
        'Diésel': 0
    };

    lines.forEach(l => {
        const tr = efeGetTractionCategory(l.traction);
        traccionKm[tr] = (traccionKm[tr] || 0) + (Number(l.length_km) || 0);
    });

    const traccionLabels = Object.keys(traccionKm).filter(k => traccionKm[k] > 0);
    const traccionData = traccionLabels.map(k => Math.round(traccionKm[k] * 10) / 10);
    const totalTraccionKm = traccionData.reduce((a, b) => a + b, 0) || 1;
    const fmtKm = (v) => v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const traccionColors = traccionLabels.map(k => EFE_TRACCION_COLORS[k] || '#64748b');

    if (efeLinesTraccionChart) {
        efeLinesTraccionChart.data.labels = traccionLabels;
        efeLinesTraccionChart.data.datasets[0].data = traccionData;
        efeLinesTraccionChart.data.datasets[0].backgroundColor = traccionColors;
        efeLinesTraccionChart.data.datasets[0].borderColor = borderColor;
        efeLinesTraccionChart.options.plugins.tooltip.callbacks = {
            label: function (ctx) {
                const val = ctx.raw || 0;
                const pct = ((val / totalTraccionKm) * 100).toFixed(0);
                return ` ${ctx.label}: ${fmtKm(val)} km (${pct}%)`;
            }
        };
        efeLinesTraccionChart.update();
    }

    const legendTraccionElem = document.getElementById('efeLinesTraccionChartLegend');
    if (legendTraccionElem) {
        legendTraccionElem.innerHTML = traccionLabels.map((lbl, idx) => {
            const val = traccionData[idx];
            const pct = totalTraccionKm > 0 ? ((val / totalTraccionKm) * 100).toFixed(1).replace(/\.0$/, '').replace('.', ',') : '0';
            const col = traccionColors[idx];
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.68rem; padding:0.08rem 0; color:var(--text-primary);" title="${lbl}: ${fmtKm(val)} km (${pct}%)">
                    <div style="display:flex; align-items:center; gap:0.3rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="width:13px; height:5.5px; border-radius:9999px; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${lbl}</span>
                    </div>
                    <span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                        ${pct}%
                    </span>
                </div>
            `;
        }).join('') || '<span style="font-size:0.68rem; color:var(--text-muted);">Sin servicios para los filtros</span>';
    }
}
window.efeInitLinesAnalyticsCharts = efeInitLinesAnalyticsCharts;
window.efeUpdateLinesAnalyticsCharts = efeUpdateLinesAnalyticsCharts;
