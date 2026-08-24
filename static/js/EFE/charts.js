// ─── EFE Analytics Charts Module ─────────────────────────────────────────────
var efeFilialChart = null;
var efeRegionChart = null;

// Distinct color palettes matching CATLEC index.html aesthetics
const EFE_FILIAL_COLORS = {
    'EFE Valparaíso': '#0284c7', // Sky Blue
    'EFE Central': '#2563eb',   // Royal Blue
    'EFE Sur': '#d97706',       // Amber / Orange
    'Nacional': '#8b5cf6'       // Purple
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
}

function efeGetFilialForRegion(regionName) {
    if (typeof shortenRegionName === 'undefined') return null;
    const r = shortenRegionName(regionName);
    if (r === 'Valparaíso') return 'EFE Valparaíso';
    if (r === 'Metropolitana' || r === "O'Higgins" || r === 'Maule' || r === 'Ñuble') return 'EFE Central';
    if (r === 'Biobío' || r === 'La Araucanía' || r === 'Los Lagos') return 'EFE Sur';
    return null;
}

function efeUpdateAnalyticsCharts(filteredProjects) {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    efeInitAnalyticsCharts();

    const isLight = document.body.classList.contains('light-theme');
    const borderColor = isLight ? '#ffffff' : '#0f1626';

    const projects = filteredProjects || [];
    const activeRegions = (typeof efeState !== 'undefined' && efeState.selectedRegions && efeState.selectedRegions.length > 0)
        ? efeState.selectedRegions.map(r => shortenRegionName(r))
        : null;

    const EFE_OPERATIONAL_REGIONS = ['Valparaíso', 'Metropolitana', "O'Higgins", 'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Lagos'];

    // ─── 1. Group Projects Count by Filial (Con atribución territorial) ──────────
    const EFE_OPERATIONAL_FILIALS = ['EFE Sur', 'EFE Central', 'EFE Valparaíso'];
    const filialCounts = {
        'EFE Sur': 0,
        'EFE Central': 0,
        'EFE Valparaíso': 0
    };

    projects.forEach(p => {
        const fil = p.filial ? String(p.filial).trim() : 'Nacional';
        const regStr = p.region ? String(p.region).trim() : 'Nacional';

        if (regStr.toLowerCase().includes('nacional') || !regStr) {
            // Proyecto nacional
            if (activeRegions && activeRegions.length > 0) {
                // Solo atribuir a las filiales de las regiones activas seleccionadas
                const sharePerRegion = 1.0 / EFE_OPERATIONAL_REGIONS.length;
                activeRegions.forEach(selReg => {
                    const mappedFilial = efeGetFilialForRegion(selReg);
                    if (mappedFilial && filialCounts[mappedFilial] !== undefined) {
                        filialCounts[mappedFilial] += sharePerRegion;
                    }
                });
            } else {
                const share = 1.0 / EFE_OPERATIONAL_FILIALS.length;
                EFE_OPERATIONAL_FILIALS.forEach(f => {
                    filialCounts[f] += share;
                });
            }
        } else {
            // Proyecto regional
            if (fil === 'EFE Sur' || fil === 'EFE Central' || fil === 'EFE Valparaíso') {
                filialCounts[fil]++;
            } else {
                const parts = regStr.split(/[;,/\n]+/).map(r => r.trim()).filter(r => r.length > 0);
                const partVal = 1.0 / (parts.length || 1);
                parts.forEach(r => {
                    const mappedFilial = efeGetFilialForRegion(r);
                    if (mappedFilial && filialCounts[mappedFilial] !== undefined) {
                        filialCounts[mappedFilial] += partVal;
                    }
                });
            }
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

    // ─── 2. Group Projects Count by Region (Solo regiones seleccionadas si hay filtro) ──
    const regionCounts = {};

    projects.forEach(p => {
        const regStr = p.region ? String(p.region).trim() : 'Nacional';
        if (regStr.toLowerCase().includes('nacional') || !regStr) {
            // Proyecto nacional: dividido entre las regiones
            const share = 1.0 / EFE_OPERATIONAL_REGIONS.length;
            EFE_OPERATIONAL_REGIONS.forEach(r => {
                const cleanReg = shortenRegionName(r);
                if (!activeRegions || activeRegions.includes(cleanReg)) {
                    regionCounts[cleanReg] = (regionCounts[cleanReg] || 0) + share;
                }
            });
        } else {
            const parts = regStr.split(/[;,/\n]+/).map(r => r.trim()).filter(r => r.length > 0);
            const partVal = 1.0 / (parts.length || 1);
            parts.forEach(reg => {
                const cleanReg = shortenRegionName(reg);
                if (!activeRegions || activeRegions.includes(cleanReg)) {
                    regionCounts[cleanReg] = (regionCounts[cleanReg] || 0) + partVal;
                }
            });
        }
    });

    const sortedRegions = Object.keys(regionCounts).sort((a, b) => regionCounts[b] - regionCounts[a]);

    let topRegions = sortedRegions.slice(0, 5);
    let topRegionData = topRegions.map(r => regionCounts[r]);

    if (sortedRegions.length > 5) {
        const otherSum = sortedRegions.slice(5).reduce((acc, r) => acc + regionCounts[r], 0);
        if (otherSum > 0) {
            topRegions.push('Otros');
            topRegionData.push(otherSum);
        }
    }

    const totalRegionProjects = Object.values(regionCounts).reduce((a, b) => a + b, 0) || 1;
    const regionColors = topRegions.map((_, i) => EFE_PALETTE[i % EFE_PALETTE.length]);

    if (efeRegionChart) {
        efeRegionChart.data.labels = topRegions;
        efeRegionChart.data.datasets[0].data = topRegionData;
        efeRegionChart.data.datasets[0].backgroundColor = regionColors;
        efeRegionChart.data.datasets[0].borderColor = borderColor;
        efeRegionChart.options.plugins.tooltip.callbacks = {
            label: function (ctx) {
                const val = ctx.raw || 0;
                const pct = ((val / totalRegionProjects) * 100).toFixed(0);
                const displayVal = val % 1 === 0 ? val : (Math.round(val * 10) / 10).toFixed(1);
                return ` ${ctx.label}: ${displayVal} proyecto${val !== 1 ? 's' : ''} (${pct}%)`;
            }
        };
        efeRegionChart.update();
    }

    // Render Region Custom HTML Legend
    const legendRegionElem = document.getElementById('efeRegionChartLegend');
    if (legendRegionElem) {
        legendRegionElem.innerHTML = topRegions.map((lbl, idx) => {
            const val = topRegionData[idx];
            const pct = totalRegionProjects > 0 ? ((val / totalRegionProjects) * 100).toFixed(1).replace(/\.0$/, '') : '0';
            const col = regionColors[idx];
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.68rem; padding:0.08rem 0; color:var(--text-primary);">
                    <div style="display:flex; align-items:center; gap:0.3rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
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
