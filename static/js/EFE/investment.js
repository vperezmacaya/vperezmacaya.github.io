/**
 * static/js/EFE/investment.js
 * Visualización de Análisis de Inversión para EFE Trenes de Chile.
 * Harmonized with CATLEC index.html design palette.
 */

let efeChartInvByRegionInstance = null;
let efeChartInvByFilialInstance = null;
let efeChartTopProjectsInstance = null;

// Colores consistentes de filiales
const EFE_INV_FILIAL_COLORS = {
    'EFE Central': '#2563eb',
    'EFE Valparaíso': '#0284c7',
    'EFE Sur': '#d97706',
    'Nacional': '#8b5cf6'
};

// Helper de normalización de nombres de región
if (typeof shortenRegionName !== 'function') {
    window.shortenRegionName = function(name) {
        if (!name) return '';
        let str = String(name).trim();
        str = str.replace(/^Región\s+(de\s+la\s+|del\s+|de\s+)?/i, '');

        if (/metropolitana/i.test(str)) return 'Metropolitana';
        if (/ays[eé]n/i.test(str)) return 'Aysén';
        if (/magallanes/i.test(str)) return 'Magallanes';
        if (/o'higgins|bernardo/i.test(str)) return "O'Higgins";
        if (/biob[ií]o/i.test(str)) return 'Biobío';
        if (/araucan[ií]a/i.test(str)) return 'La Araucanía';
        if (/r[ií]os/i.test(str)) return 'Los Ríos';
        if (/lagos/i.test(str)) return 'Los Lagos';
        if (/tarapac[aá]/i.test(str)) return 'Tarapacá';
        if (/valpara[ií]so/i.test(str)) return 'Valparaíso';
        if (/antofagasta/i.test(str)) return 'Antofagasta';
        if (/atacama/i.test(str)) return 'Atacama';
        if (/coquimbo/i.test(str)) return 'Coquimbo';
        if (/maule/i.test(str)) return 'Maule';
        if (/ñuble/i.test(str)) return 'Ñuble';
        if (/arica/i.test(str)) return 'Arica y Parinacota';

        return str;
    };
}

// Formato compacto de dólares USD
function formatEfeUSD(val) {
    if (val == null || isNaN(val) || val === 0) return 'US$ 0';
    if (val >= 1e9) {
        const b = val / 1e9;
        return 'US$ ' + (b % 1 === 0 ? b.toFixed(0) : b.toFixed(2)) + 'B';
    }
    if (val >= 1e6) {
        const m = val / 1e6;
        return 'US$ ' + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'M';
    }
    if (val >= 1e3) {
        return 'US$ ' + (val / 1e3).toFixed(0) + 'K';
    }
    return 'US$ ' + Math.round(val).toLocaleString('es-CL');
}

// Tooltip compartido para los gráficos de inversión EFE (idéntico al de análisis rápido)
function efeInvExternalTooltip(context) {
    if (typeof efeExternalTooltip === 'function') {
        return efeExternalTooltip(context);
    }
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

// Plugin para dibujar etiquetas dinámicas de valor en barras horizontales (dentro o fuera según espacio disponible)
const efeHorizontalBarLabelsPlugin = {
    id: 'efeHorizontalBarLabelsPlugin',
    afterDatasetsDraw: (chart, args, pluginOptions) => {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data) return;

        const isLight = document.body.classList.contains('light-theme');
        const outsideColor = isLight ? '#334155' : '#cbd5e1';
        const insideColor = '#ffffff';
        const formatter = (pluginOptions && pluginOptions.formatter) || ((v) => formatEfeUSD(v));

        ctx.save();
        ctx.font = '600 9px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
        ctx.textBaseline = 'middle';

        meta.data.forEach((bar, index) => {
            const rawVal = chart.data.datasets[0].data[index];
            if (rawVal === undefined || rawVal === null || rawVal <= 0) return;

            const text = formatter(rawVal);
            const textWidth = ctx.measureText(text).width;
            const barWidth = Math.abs(bar.x - bar.base);

            if (barWidth >= textWidth + 18) {
                ctx.fillStyle = insideColor;
                ctx.textAlign = 'right';
                ctx.fillText(text, bar.x - 6, bar.y);
            } else {
                ctx.fillStyle = outsideColor;
                ctx.textAlign = 'left';
                ctx.fillText(text, bar.x + 5, bar.y);
            }
        });

        ctx.restore();
    }
};

// ── Control de Vistas (Mostrar / Ocultar Panel de Inversión) ───────────────────
function showEfeInvestmentView() {
    efeState.investmentOpen = true;
    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const invPanel = document.getElementById('efe-investment-full-panel') || document.getElementById('investment-full-panel');
    const btnMap = document.getElementById('btn-efe-view-map');
    const btnInv = document.getElementById('btn-efe-view-investment');

    if (grid) grid.style.gridTemplateColumns = '280px 1fr';
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (invPanel) invPanel.style.display = 'flex';

    if (btnMap) btnMap.classList.remove('active');
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

function hideEfeInvestmentView() {
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

    if (btnMap) btnMap.classList.add('active');
    if (btnInv) btnInv.classList.remove('active');

    if (window.location.hash === '#inversion' || window.location.hash === '#investment') {
        history.replaceState(null, null, window.location.pathname + window.location.search);
    }

    if (typeof efeMap !== 'undefined' && efeMap) {
        efeMap.invalidateSize({ animate: false });
        setTimeout(() => {
            if (typeof efeMap !== 'undefined' && efeMap) {
                efeMap.invalidateSize({ animate: false });
            }
        }, 100);
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

    const isLight = document.body.classList.contains('light-theme');
    const textColor = isLight ? '#475569' : '#94a3b8';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255,255,255,0.06)';
    const doughnutBorder = isLight ? '#ffffff' : '#0f172a';

    if (typeof Chart !== 'undefined') {
        Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    }

    // 1. Regiones y Filiales operativas de EFE
    const EFE_OPERATIONAL_FILIALS = ['EFE Sur', 'EFE Central', 'EFE Valparaíso'];
    const EFE_OPERATIONAL_REGIONS = ['Valparaíso', 'Metropolitana', "O'Higgins", 'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Lagos'];

    // 2. Determinar si hay un filtro de región activo
    const hasRegionFilter = efeState.selectedRegions && efeState.selectedRegions.length > 0;
    const selectedRegionsSet = new Set(hasRegionFilter ? efeState.selectedRegions.map(r => shortenRegionName(r)) : []);

    // Helper: Mapeo de región a filial operativa responsable
    const getFilialForRegion = (regionName) => {
        const r = shortenRegionName(regionName);
        if (r === 'Valparaíso') return 'EFE Valparaíso';
        if (['Metropolitana', "O'Higgins", 'Maule', 'Ñuble'].includes(r)) return 'EFE Central';
        if (['Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes', 'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo'].includes(r)) return 'EFE Sur';
        return null;
    };

    // Helper: Obtener fracción de inversión atribuible de un proyecto a las regiones seleccionadas
    const getProjectAttributableFraction = (p) => {
        if (!hasRegionFilter) return 1.0;
        const regStr = p.region ? String(p.region).trim() : 'Nacional';
        if (regStr.toLowerCase().includes('nacional') || !regStr) {
            const matchedCount = EFE_OPERATIONAL_REGIONS.filter(r => selectedRegionsSet.has(shortenRegionName(r))).length;
            return matchedCount / EFE_OPERATIONAL_REGIONS.length;
        }
        const parts = regStr.split(/[;,/\n]+/).map(r => shortenRegionName(r.trim())).filter(Boolean);
        if (parts.length === 0) return 1.0;
        const matchedCount = parts.filter(r => selectedRegionsSet.has(r)).length;
        return matchedCount / parts.length;
    };

    // 3. Distribución proporcional por región
    let totalSampleInv = 0;
    const regionInv = {};

    projectsList.forEach(p => {
        const inv = p.investment_usd || 0;
        totalSampleInv += inv;

        const regStr = p.region ? String(p.region).trim() : 'Nacional';
        if (regStr.toLowerCase().includes('nacional') || !regStr) {
            // Nacional: dividido equitativamente entre las 8 regiones operativas
            const regShare = inv / EFE_OPERATIONAL_REGIONS.length;
            EFE_OPERATIONAL_REGIONS.forEach(r => {
                const cleanR = shortenRegionName(r);
                regionInv[cleanR] = (regionInv[cleanR] || 0) + regShare;
            });
        } else {
            const parts = regStr.split(/[;,/\n]+/).map(r => shortenRegionName(r.trim())).filter(Boolean);
            const invPart = inv / (parts.length || 1);
            parts.forEach(r => {
                const cleanR = shortenRegionName(r);
                regionInv[cleanR] = (regionInv[cleanR] || 0) + invPart;
            });
        }
    });

    // 4. Calcular inversión total atribuible (base 100%)
    let displayTotalInv = totalSampleInv;
    if (hasRegionFilter) {
        let attributableInv = 0;
        efeState.selectedRegions.forEach(r => {
            const cleanR = shortenRegionName(r);
            attributableInv += (regionInv[cleanR] || 0);
        });
        displayTotalInv = attributableInv;
    }

    // 5. Distribución de inversión atribuible por filial territorial
    const filialInv = {
        'EFE Central': 0,
        'EFE Valparaíso': 0,
        'EFE Sur': 0
    };

    projectsList.forEach(p => {
        const inv = p.investment_usd || 0;
        if (inv <= 0) return;

        const regStr = p.region ? String(p.region).trim() : 'Nacional';
        if (regStr.toLowerCase().includes('nacional') || !regStr) {
            // Proyecto Nacional: dividido equitativamente entre las 8 regiones operativas
            const regShare = inv / EFE_OPERATIONAL_REGIONS.length;
            EFE_OPERATIONAL_REGIONS.forEach(r => {
                const cleanR = shortenRegionName(r);
                if (!hasRegionFilter || selectedRegionsSet.has(cleanR)) {
                    const targetFilial = getFilialForRegion(cleanR);
                    if (targetFilial && filialInv[targetFilial] !== undefined) {
                        filialInv[targetFilial] += regShare;
                    }
                }
            });
        } else {
            // Proyecto específico / multirregional
            const parts = regStr.split(/[;,/\n]+/).map(r => shortenRegionName(r.trim())).filter(Boolean);
            const invPart = inv / (parts.length || 1);
            parts.forEach(r => {
                const cleanR = shortenRegionName(r);
                if (!hasRegionFilter || selectedRegionsSet.has(cleanR)) {
                    const targetFilial = (p.filial && (p.filial === 'EFE Sur' || p.filial === 'EFE Central' || p.filial === 'EFE Valparaíso'))
                        ? p.filial
                        : getFilialForRegion(cleanR);
                    if (targetFilial && filialInv[targetFilial] !== undefined) {
                        filialInv[targetFilial] += invPart;
                    }
                }
            });
        }
    });

    const projectsWithInv = projectsList.filter(p => (p.investment_usd || 0) > 0);
    const reportedCount = projectsWithInv.length;
    const avgInv = reportedCount > 0 ? (displayTotalInv / reportedCount) : 0;

    const sortedFilials = Object.entries(filialInv).sort((a, b) => b[1] - a[1]);
    const topFilial = sortedFilials.length > 0 && sortedFilials[0][1] > 0 ? sortedFilials[0] : ['Sin datos', 0];

    // Actualizar KPI Banner
    const kpiTotal = document.getElementById('efe-kpi-inv-total');
    const kpiTotalLabel = document.getElementById('efe-kpi-inv-total-label');
    const kpiAvg = document.getElementById('efe-kpi-inv-avg');
    const kpiTopFilial = document.getElementById('efe-kpi-inv-top-filial');

    if (kpiTotalLabel) {
        kpiTotalLabel.textContent = hasRegionFilter
            ? 'Inversión atribuible a region/es seleccionadas'
            : 'Inversión total';
    }
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

    // ─── Gráfico 1: Inversión por Región (Barras Horizontales) ────────────────
    let regionEntries = Object.entries(regionInv);
    if (hasRegionFilter) {
        regionEntries = regionEntries.filter(([reg]) => selectedRegionsSet.has(reg));
    }
    const sortedRegions = regionEntries.sort((a, b) => b[1] - a[1]);
    const regLabels = sortedRegions.map(e => e[0]);
    const regValues = sortedRegions.map(e => e[1]);

    const canvasRegion = document.getElementById('efeChartInvByRegion');
    if (canvasRegion) {
        if (!efeChartInvByRegionInstance) {
            efeChartInvByRegionInstance = new Chart(canvasRegion.getContext('2d'), {
                type: 'bar',
                plugins: [efeHorizontalBarLabelsPlugin],
                data: {
                    labels: regLabels,
                    datasets: [{
                        label: 'Inversión (USD)',
                        data: regValues,
                        backgroundColor: '#2563eb',
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { top: 0, bottom: 0, left: 0, right: 10 } },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: efeInvExternalTooltip,
                            callbacks: {
                                label: (ctx) => ` Inversión: ${formatEfeUSD(ctx.raw)} (${displayTotalInv > 0 ? ((ctx.raw / displayTotalInv) * 100).toFixed(1) : 0}%)`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                font: { size: 10 },
                                callback: (val) => formatEfeUSD(val)
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
            efeChartInvByRegionInstance.data.labels = regLabels;
            efeChartInvByRegionInstance.data.datasets[0].data = regValues;
            efeChartInvByRegionInstance.data.datasets[0].backgroundColor = '#2563eb';
            efeChartInvByRegionInstance.options.scales.x.grid.color = gridColor;
            efeChartInvByRegionInstance.options.scales.x.ticks.color = textColor;
            efeChartInvByRegionInstance.options.scales.x.ticks.font = { size: 10 };
            efeChartInvByRegionInstance.options.scales.y.ticks.color = textColor;
            efeChartInvByRegionInstance.options.scales.y.ticks.font = { size: 10.5, weight: '500' };
            efeChartInvByRegionInstance.options.plugins.tooltip.callbacks.label = (ctx) => ` Inversión: ${formatEfeUSD(ctx.raw)} (${displayTotalInv > 0 ? ((ctx.raw / displayTotalInv) * 100).toFixed(1) : 0}%)`;
            efeChartInvByRegionInstance.update();
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
                    <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
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
            attributableInv: (p.investment_usd || 0) * getProjectAttributableFraction(p)
        }))
        .filter(p => p.attributableInv > 0)
        .sort((a, b) => b.attributableInv - a.attributableInv)
        .slice(0, 5);

    // Invertir para renderizar el mayor en la parte superior en Chart.js
    const topProjRev = [...sortedProjects].reverse();
    const projLabels = topProjRev.map(p => wrapTextToLines(p.name || 'Sin nombre', 24));
    const projValues = topProjRev.map(p => p.attributableInv);

    const canvasTop = document.getElementById('efeChartTopProjects');
    if (canvasTop) {
        if (!efeChartTopProjectsInstance) {
            efeChartTopProjectsInstance = new Chart(canvasTop.getContext('2d'), {
                type: 'bar',
                plugins: [efeHorizontalBarLabelsPlugin],
                data: {
                    labels: projLabels,
                    datasets: [{
                        label: 'Inversión (USD)',
                        data: projValues,
                        backgroundColor: '#0284c7',
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
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
                                        ` Filial: ${entry.filial || 'Nacional'}`,
                                        ` Región: ${entry.region || 'Sin información'}`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                font: { size: 10 },
                                callback: (val) => formatEfeUSD(val)
                            }
                        },
                        y: {
                            grid: { display: false },
                            ticks: {
                                color: textColor,
                                font: { size: 9.5, weight: '500' },
                                autoSkip: false,
                                callback: function (val, idx) {
                                    const entry = topProjRev[idx];
                                    if (!entry) return this.getLabelForValue(val);
                                    return wrapTextToLines(entry.name, 24);
                                }
                            }
                        }
                    }
                }
            });
        } else {
            efeChartTopProjectsInstance.data.labels = projLabels;
            efeChartTopProjectsInstance.data.datasets[0].data = projValues;
            efeChartTopProjectsInstance.data.datasets[0].backgroundColor = '#0284c7';
            efeChartTopProjectsInstance.options.scales.x.grid.color = gridColor;
            efeChartTopProjectsInstance.options.scales.x.ticks.color = textColor;
            efeChartTopProjectsInstance.options.scales.x.ticks.font = { size: 10 };
            efeChartTopProjectsInstance.options.scales.y.ticks.color = textColor;
            efeChartTopProjectsInstance.options.scales.y.ticks.font = { size: 9.5, weight: '500' };
            efeChartTopProjectsInstance.options.scales.y.ticks.callback = function (val, idx) {
                const entry = topProjRev[idx];
                if (!entry) return this.getLabelForValue(val);
                return wrapTextToLines(entry.name, 24);
            };
            efeChartTopProjectsInstance.options.plugins.tooltip.callbacks.title = (items) => {
                const entry = topProjRev[items[0].dataIndex];
                return entry ? entry.name : items[0].label;
            };
            efeChartTopProjectsInstance.options.plugins.tooltip.callbacks.label = (ctx) => {
                const entry = topProjRev[ctx.dataIndex];
                return [
                    ` Inversión: ${formatEfeUSD(ctx.raw)}`,
                    ` Filial: ${entry.filial || 'Nacional'}`,
                    ` Región: ${entry.region || 'Sin información'}`
                ];
            };
            efeChartTopProjectsInstance.update();
        }
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// ── Helper: wrapTextToLines para ejes en Chart.js ──────────────────────────────
function wrapTextToLines(str, maxLen = 22, maxLines = 2) {
    if (!str || str.length <= maxLen) return str;
    const words = str.split(' ');
    if (words.length <= 1) return str.length > maxLen ? str.substring(0, maxLen - 1) + '…' : str;

    const lines = [];
    let cur = '';

    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (lines.length === maxLines - 1) {
            const remaining = words.slice(i).join(' ');
            let candidate = cur ? cur + ' ' + remaining : remaining;
            if (candidate.length > maxLen) {
                candidate = candidate.substring(0, maxLen - 1).trimEnd() + '…';
            }
            lines.push(candidate);
            cur = '';
            break;
        }

        if ((cur ? cur + ' ' + w : w).length <= maxLen) {
            cur = cur ? cur + ' ' + w : w;
        } else {
            if (cur) lines.push(cur);
            cur = w;
        }
    }
    if (cur && lines.length < maxLines) {
        lines.push(cur);
    }

    return lines.length > 1 ? lines : str;
}
