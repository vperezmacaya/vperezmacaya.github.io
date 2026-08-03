// ─── EFE Analytics Charts Module ─────────────────────────────────────────────
var efeFilialChart = null;
var efeRegionChart = null;

// Distinct color palettes matching dark theme aesthetics
const EFE_FILIAL_COLORS = {
    'EFE Valparaíso': '#0284c7', // Sky Blue
    'EFE Central': '#16a34a',   // Rail Green
    'EFE Sur': '#d97706'        // Amber / Orange
};

const EFE_PALETTE = [
    '#16a34a', '#0284c7', '#d97706', '#8b5cf6', '#ec4899',
    '#14b8a6', '#f43f5e', '#6366f1', '#eab308', '#64748b'
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

function efeInitAnalyticsCharts() {
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
                    borderWidth: 1.5,
                    borderColor: '#0f1626',
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
                        backgroundColor: '#0f1626',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        borderWidth: 1,
                        padding: 8,
                        boxPadding: 4,
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

    // Chart 2: Region Pie Chart
    const ctxRegion = document.getElementById('efeRegionChart');
    if (ctxRegion && !efeRegionChart) {
        efeRegionChart = new Chart(ctxRegion, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [],
                    borderWidth: 1.5,
                    borderColor: '#0f1626',
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
                        backgroundColor: '#0f1626',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        borderWidth: 1,
                        padding: 8,
                        boxPadding: 4,
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
}

function efeUpdateAnalyticsCharts(filteredProjects) {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    efeInitAnalyticsCharts();

    const projects = filteredProjects || [];

    // ─── 1. Group Investment by Filial (EXCLUDING "Nacional" / null) ─────────
    const filialTotals = {
        'EFE Valparaíso': 0,
        'EFE Central': 0,
        'EFE Sur': 0
    };

    projects.forEach(p => {
        if (p.filial && filialTotals.hasOwnProperty(p.filial)) {
            filialTotals[p.filial] += (p.investment_usd || 0);
        }
    });

    const filialLabels = Object.keys(filialTotals);
    const filialData = filialLabels.map(f => filialTotals[f]);
    const filialColors = filialLabels.map(f => EFE_FILIAL_COLORS[f] || '#64748b');

    if (efeFilialChart) {
        efeFilialChart.data.labels = filialLabels;
        efeFilialChart.data.datasets[0].data = filialData;
        efeFilialChart.data.datasets[0].backgroundColor = filialColors;
        efeFilialChart.update();
    }

    // Render Filial Custom HTML Legend
    const legendFilialElem = document.getElementById('efeFilialChartLegend');
    if (legendFilialElem) {
        const totalFilialInv = filialData.reduce((a, b) => a + b, 0);
        legendFilialElem.innerHTML = filialLabels.map((lbl, idx) => {
            const val = filialData[idx];
            const pct = totalFilialInv > 0 ? ((val / totalFilialInv) * 100).toFixed(0) : 0;
            const col = filialColors[idx];
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.69rem; padding:0.12rem 0;">
                    <div style="display:flex; align-items:center; gap:0.35rem; flex-shrink:0;">
                        <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-primary); font-weight:600; white-space:nowrap;">${lbl}</span>
                    </div>
                    <span style="font-size:0.67rem; color:#4ade80; font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                        ${efeFormatCompactUSD(val)} <span style="color:var(--text-muted); font-weight:500; font-size:0.62rem;">(${pct}%)</span>
                    </span>
                </div>
            `;
        }).join('');
    }

    // ─── 2. Group Investment by Region ───────────────────────────────────────
    const regionTotals = {};
    projects.forEach(p => {
        const regStr = p.region ? String(p.region).trim() : 'Sin información';
        const parts = regStr.split(/[;,]+/).map(r => r.trim()).filter(r => r.length > 0);
        const invPerPart = (p.investment_usd || 0) / (parts.length || 1);
        parts.forEach(reg => {
            regionTotals[reg] = (regionTotals[reg] || 0) + invPerPart;
        });
    });

    const sortedRegions = Object.keys(regionTotals).sort((a, b) => regionTotals[b] - regionTotals[a]);

    let topRegions = sortedRegions.slice(0, 5);
    let topRegionData = topRegions.map(r => regionTotals[r]);

    if (sortedRegions.length > 5) {
        const otherSum = sortedRegions.slice(5).reduce((acc, r) => acc + regionTotals[r], 0);
        if (otherSum > 0) {
            topRegions.push('Otros');
            topRegionData.push(otherSum);
        }
    }

    const regionColors = topRegions.map((_, i) => EFE_PALETTE[i % EFE_PALETTE.length]);

    if (efeRegionChart) {
        efeRegionChart.data.labels = topRegions;
        efeRegionChart.data.datasets[0].data = topRegionData;
        efeRegionChart.data.datasets[0].backgroundColor = regionColors;
        efeRegionChart.update();
    }

    // Render Region Custom HTML Legend
    const legendRegionElem = document.getElementById('efeRegionChartLegend');
    if (legendRegionElem) {
        const totalRegionInv = topRegionData.reduce((a, b) => a + b, 0);
        legendRegionElem.innerHTML = topRegions.map((lbl, idx) => {
            const val = topRegionData[idx];
            const pct = totalRegionInv > 0 ? ((val / totalRegionInv) * 100).toFixed(0) : 0;
            const col = regionColors[idx];
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.68rem; padding:0.08rem 0;">
                    <div style="display:flex; align-items:center; gap:0.3rem; min-width:0; overflow:hidden;">
                        <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-secondary); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${lbl}</span>
                    </div>
                    <span style="font-size:0.67rem; color:#4ade80; font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                        ${efeFormatCompactUSD(val)} <span style="color:var(--text-muted); font-weight:500; font-size:0.62rem;">(${pct}%)</span>
                    </span>
                </div>
            `;
        }).join('');
    }
}
