/**
 * static/js/SNI/charts.js
 * Gráficos analíticos con Chart.js para la plataforma SNI
 * Homologados con la estética, tipografía ('Plus Jakarta Sans'), tooltips,
 * formato de ejes y animaciones de transición fluidas (sin destrucción) de index.html
 *
 * Patrón de actualización reactiva (idéntico a investment.js / contracts_analysis.js):
 *   - Si la instancia NO existe → new Chart(ctx, config)
 *   - Si la instancia YA existe → mutar .data.labels, .data.datasets[i].data y llamar chart.update()
 *   - Chart.js interpola automáticamente las posiciones anteriores a las nuevas (transición suave)
 */

// Instancias persistentes de Chart.js — NUNCA se destruyen, solo se mutan
let sniChartInstances = {
    mapMetricRanking: null,
    regionRanking: null,
    pibBalance: null,
    perCapita: null,
    ministryShare: null,
    mopServices: null,
    temporalEvolution: null,
    prePostGov: null
};

// Configurar defaults globales de Chart.js idénticos a index.html (investment.js L215-216)
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
    Chart.defaults.devicePixelRatio = Math.max(2, window.devicePixelRatio || 1);
}

// Tooltip externo negro compartido para todos los gráficos SNI
// (réplica exacta de investmentExternalTooltip de index.html)
function sniExternalTooltip(context) {
    const { chart, tooltip } = context;
    const tooltipId = 'sni-shared-tooltip';
    let el = document.getElementById(tooltipId);
    if (!el) {
        el = document.createElement('div');
        el.id = tooltipId;
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
        void el.offsetHeight;
        el.style.transition = 'opacity 0.2s ease-out';
        el.style.opacity = '1';
    }
}

// Plugin para dibujar etiquetas de valor en barras horizontales
// (réplica exacta de horizontalBarDataLabelsPlugin de index.html)
const sniHorizontalBarLabelsPlugin = {
    id: 'sniHorizontalBarLabelsPlugin',
    afterDatasetsDraw: (chart, args, pluginOptions) => {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data) return;

        const isDark = !document.body.classList.contains('light-theme');
        const outsideColor = isDark ? '#cbd5e1' : '#334155';
        const insideColor = '#ffffff';
        const formatter = (pluginOptions && pluginOptions.formatter) || ((v) => String(v));

        ctx.save();
        ctx.font = "600 9px 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
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

// Opciones comunes y tema unificado (idéntico a index.html)
function getChartThemeOptions() {
    const isDark = !document.body.classList.contains('light-theme');
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const textMuted = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 450,
            easing: 'easeOutQuart'
        },
        layout: {
            padding: { top: 4, bottom: 2, left: 2, right: 8 }
        },
        plugins: {
            legend: {
                labels: {
                    color: textColor,
                    font: { family: "'Plus Jakarta Sans', sans-serif", size: 10.5, weight: '500' },
                    boxWidth: 10,
                    boxHeight: 10,
                    usePointStyle: true,
                    padding: 12
                }
            },
            tooltip: {
                enabled: false,
                external: sniExternalTooltip
            }
        },
        scales: {
            x: {
                ticks: {
                    color: textMuted,
                    font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: '500' }
                },
                grid: { color: gridColor, drawBorder: false }
            },
            y: {
                ticks: {
                    color: textMuted,
                    font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: '500' }
                },
                grid: { color: gridColor, drawBorder: false }
            }
        }
    };
}

function initSNICharts() {
    updateSNICharts();
}

function updateSNICharts() {
    try { updateMapMetricRankingChart(); } catch (e) { console.error('Error in updateMapMetricRankingChart:', e); }
    try { updateRegionRankingChart(); } catch (e) { console.error('Error in updateRegionRankingChart:', e); }
    try { updatePibBalanceChart(); } catch (e) { console.error('Error in updatePibBalanceChart:', e); }
    try { updatePerCapitaChart(); } catch (e) { console.error('Error in updatePerCapitaChart:', e); }
    try { updateMinistryShareChart(); } catch (e) { console.error('Error in updateMinistryShareChart:', e); }
    try { updateMopServicesChart(); } catch (e) { console.error('Error in updateMopServicesChart:', e); }
    try { updateTemporalEvolutionChart(); } catch (e) { console.error('Error in updateTemporalEvolutionChart:', e); }
    try { updatePrePostGovChart(); } catch (e) { console.error('Error in updatePrePostGovChart:', e); }
}

// ─────────────────────────────────────────────────────────────────────────────
// 0. Gráfico Dinámico de la Vista de Mapa (Ranking por Métrica Activa)
// ─────────────────────────────────────────────────────────────────────────────
function updateMapMetricRankingChart() {
    const ctx = document.getElementById('chart-map-ranking');
    if (!ctx) return;

    const { regions, globalTotalUsd } = getRegionalAggregates();
    // Incluir todas las categorías, incluyendo 17_No Regionalizada
    const valid = regions;
    const metric = (typeof sniState !== 'undefined' && sniState.selectedMapMetric) ? sniState.selectedMapMetric : 'total';

    let sorted = [];
    let title = '';
    let unitLabel = '';
    let barColor = '#2563eb';
    let valFormatter = (v) => v;

    switch (metric) {
        case 'per_capita':
            sorted = [...valid].sort((a, b) => b.per_capita_clp - a.per_capita_clp);
            title = 'Ranking Regional: Inversión Per Cápita (Pesos 2024 / hab)';
            unitLabel = '$ CLP / hab';
            barColor = '#059669';
            valFormatter = (v) => `$${Math.round(v).toLocaleString('es-CL')} CLP`;
            break;
        case 'km2':
            sorted = [...valid].sort((a, b) => b.per_km2_clp - a.per_km2_clp);
            title = 'Ranking Regional: Inversión por Superficie ($ / km²)';
            unitLabel = '$ CLP / km²';
            barColor = '#8b5cf6';
            valFormatter = (v) => `$${Math.round(v).toLocaleString('es-CL')} / km²`;
            break;
        case 'pib_ratio':
            sorted = [...valid].sort((a, b) => b.pib_ratio - a.pib_ratio);
            title = 'Ranking Regional: Ratio Redistributivo (Inversión / PIB)';
            unitLabel = 'Ratio Inv/PIB';
            barColor = '#f59e0b';
            valFormatter = (v) => `${v.toFixed(2)}x`;
            break;
        case 'total':
        default:
            sorted = [...valid].sort((a, b) => b.total_usd - a.total_usd);
            title = 'Ranking Regional: Inversión Total (MM USD 2024)';
            unitLabel = 'MM USD';
            barColor = '#2563eb';
            valFormatter = (v) => `US$ ${v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MM`;
            break;
    }

    // Actualizar encabezados y mini KPIs en el panel del mapa (excluyendo no regionalizada de kpis territoriales si procede)
    const titleEl = document.getElementById('map-metric-chart-title');
    if (titleEl) titleEl.innerText = title;

    if (sorted.length > 0) {
        const regionalOnly = sorted.filter(r => !r.region.includes('No Regionalizada'));
        const kpiSource = regionalOnly.length > 0 ? regionalOnly : sorted;

        const leader = kpiSource[0];
        const lowest = kpiSource[kpiSource.length - 1];

        let leaderVal = leader.total_usd;
        let lowestVal = lowest.total_usd;
        let sum = kpiSource.reduce((acc, r) => acc + r.total_usd, 0);

        if (metric === 'per_capita') {
            leaderVal = leader.per_capita_clp;
            lowestVal = lowest.per_capita_clp;
            sum = kpiSource.reduce((acc, r) => acc + r.per_capita_clp, 0);
        } else if (metric === 'km2') {
            leaderVal = leader.per_km2_clp;
            lowestVal = lowest.per_km2_clp;
            sum = kpiSource.reduce((acc, r) => acc + r.per_km2_clp, 0);
        } else if (metric === 'pib_ratio') {
            leaderVal = leader.pib_ratio;
            lowestVal = lowest.pib_ratio;
            sum = kpiSource.reduce((acc, r) => acc + r.pib_ratio, 0);
        }

        const avg = sum / kpiSource.length;

        const kpiLeader = document.getElementById('map-kpi-leader');
        const kpiLowest = document.getElementById('map-kpi-lowest');
        const kpiAvg = document.getElementById('map-kpi-avg');

        if (kpiLeader) kpiLeader.innerText = `${leader.region.replace(/^\d+_/, '')} (${valFormatter(leaderVal)})`;
        if (kpiLowest) kpiLowest.innerText = `${lowest.region.replace(/^\d+_/, '')} (${valFormatter(lowestVal)})`;
        if (kpiAvg) kpiAvg.innerText = valFormatter(avg);
    }

    const labels = sorted.map(r => r.region.replace(/^\d+_/, ''));
    let dataValues = [];

    if (metric === 'per_capita') {
        dataValues = sorted.map(r => r.per_capita_clp);
    } else if (metric === 'km2') {
        dataValues = sorted.map(r => r.per_km2_clp);
    } else if (metric === 'pib_ratio') {
        dataValues = sorted.map(r => r.pib_ratio);
    } else {
        dataValues = sorted.map(r => r.total_usd);
    }

    const backgroundColors = sorted.map(r => {
        if (r.region.includes('No Regionalizada')) return '#64748b';
        let val = r.total_usd;
        if (metric === 'per_capita') val = r.per_capita_clp;
        else if (metric === 'km2') val = r.per_km2_clp;
        else if (metric === 'pib_ratio') val = r.pib_ratio;
        return typeof getChoroplethColor === 'function' ? getChoroplethColor(val) : barColor;
    });

    const baseOpts = getChartThemeOptions();

    const makeTooltipCallback = () => (c) => {
        const raw = c.raw;
        const regObj = sorted[c.dataIndex];
        if (!regObj) return ` ${unitLabel}: ${valFormatter(raw)}`;
        const pctTotal = globalTotalUsd > 0 ? ((regObj.total_usd / globalTotalUsd) * 100).toFixed(1) : '0';
        const lines = [
            ` ${unitLabel}: ${valFormatter(raw)}`,
            ` Inversión Total: US$ ${regObj.total_usd.toLocaleString('es-CL')} MM (${pctTotal}%)`
        ];
        if (regObj.poblacion > 0) {
            lines.push(` Población: ${regObj.poblacion.toLocaleString('es-CL')} hab`);
        }
        return lines;
    };

    const makeTickCallback = () => (v) => {
        if (metric === 'pib_ratio') return `${v}x`;
        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
        if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
        return v.toLocaleString('es-CL');
    };

    if (!sniChartInstances.mapMetricRanking) {
        // CREAR instancia nueva (primera vez)
        sniChartInstances.mapMetricRanking = new Chart(ctx, {
            type: 'bar',
            plugins: [sniHorizontalBarLabelsPlugin],
            data: {
                labels: labels,
                datasets: [{
                    label: unitLabel,
                    data: dataValues,
                    backgroundColor: backgroundColors,
                    borderRadius: 4,
                    barPercentage: 0.78,
                    categoryPercentage: 0.88
                }]
            },
            options: {
                ...baseOpts,
                indexAxis: 'y',
                plugins: {
                    ...baseOpts.plugins,
                    legend: { display: false },
                    tooltip: {
                        ...baseOpts.plugins.tooltip,
                        callbacks: { label: makeTooltipCallback() }
                    },
                    sniHorizontalBarLabelsPlugin: {
                        formatter: (val) => valFormatter(val)
                    }
                },
                scales: {
                    x: {
                        ...baseOpts.scales.x,
                        ticks: { ...baseOpts.scales.x.ticks, callback: makeTickCallback() }
                    },
                    y: {
                        ...baseOpts.scales.y,
                        grid: { display: false },
                        ticks: { ...baseOpts.scales.y.ticks, autoSkip: false }
                    }
                },
                onClick: (e, elements) => {
                    if (elements.length > 0) {
                        const idx = elements[0].index;
                        const clickedRegion = sorted[idx];
                        if (clickedRegion && typeof showRegionDetailCard === 'function') {
                            showRegionDetailCard(clickedRegion.region);
                        }
                    }
                }
            }
        });
    } else {
        // ACTUALIZAR instancia existente (transición suave)
        const chart = sniChartInstances.mapMetricRanking;
        chart.data.labels = labels;
        chart.data.datasets[0].data = dataValues;
        chart.data.datasets[0].backgroundColor = backgroundColors;
        chart.data.datasets[0].label = unitLabel;
        // Actualizar callbacks dinámicos
        chart.options.scales.x.ticks.callback = makeTickCallback();
        chart.options.plugins.tooltip.callbacks.label = makeTooltipCallback();
        // Actualizar colores del tema
        chart.options.scales.x.ticks.color = baseOpts.scales.x.ticks.color;
        chart.options.scales.x.grid.color = baseOpts.scales.x.grid.color;
        chart.options.scales.y.ticks.color = baseOpts.scales.y.ticks.color;
        chart.update();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Gráfico de Ranking Regional Consolidado
// ─────────────────────────────────────────────────────────────────────────────
function updateRegionRankingChart() {
    const ctx = document.getElementById('chart-region-ranking');
    if (!ctx) return;

    const { regions, globalTotalUsd } = getRegionalAggregates();
    const valid = regions.filter(r => r.region !== '17_No Regionalizada');
    const sorted = [...valid].sort((a, b) => b.total_usd - a.total_usd);

    const labels = sorted.map(r => r.region.replace(/^\d+_/, ''));
    const data = sorted.map(r => r.total_usd);

    const baseOpts = getChartThemeOptions();

    const tooltipCb = (c) => {
        const val = c.raw;
        const pct = globalTotalUsd > 0 ? ((val / globalTotalUsd) * 100).toFixed(1) : '0';
        return ` Inversión: US$ ${val.toLocaleString('es-CL', { minimumFractionDigits: 1 })} MM (${pct}%)`;
    };

    if (!sniChartInstances.regionRanking) {
        sniChartInstances.regionRanking = new Chart(ctx, {
            type: 'bar',
            plugins: [sniHorizontalBarLabelsPlugin],
            data: {
                labels: labels,
                datasets: [{
                    label: 'Inversión (MM USD 2024)',
                    data: data,
                    backgroundColor: '#2563eb',
                    borderRadius: 4,
                    barPercentage: 0.8
                }]
            },
            options: {
                ...baseOpts,
                indexAxis: 'y',
                plugins: {
                    ...baseOpts.plugins,
                    legend: { display: false },
                    tooltip: {
                        ...baseOpts.plugins.tooltip,
                        callbacks: { label: tooltipCb }
                    },
                    sniHorizontalBarLabelsPlugin: {
                        formatter: (val) => `US$ ${val.toLocaleString('es-CL', { minimumFractionDigits: 1 })} MM`
                    }
                },
                scales: {
                    x: {
                        ...baseOpts.scales.x,
                        ticks: {
                            ...baseOpts.scales.x.ticks,
                            callback: (v) => `US$ ${v.toLocaleString('es-CL')} MM`
                        }
                    },
                    y: {
                        ...baseOpts.scales.y,
                        grid: { display: false },
                        ticks: { ...baseOpts.scales.y.ticks, autoSkip: false }
                    }
                }
            }
        });
    } else {
        const chart = sniChartInstances.regionRanking;
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.options.plugins.tooltip.callbacks.label = tooltipCb;
        chart.options.scales.x.ticks.color = baseOpts.scales.x.ticks.color;
        chart.options.scales.x.grid.color = baseOpts.scales.x.grid.color;
        chart.options.scales.y.ticks.color = baseOpts.scales.y.ticks.color;
        chart.update();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Matriz de Equidad Territorial: Inversión vs Aporte al PIB
// ─────────────────────────────────────────────────────────────────────────────
function updatePibBalanceChart() {
    const ctx = document.getElementById('chart-pib-balance');
    if (!ctx) return;

    const { regions } = getRegionalAggregates();
    const valid = regions.filter(r => r.region !== '17_No Regionalizada' && r.pib_pct > 0);
    const labels = valid.map(r => r.region.replace(/^\d+_/, ''));

    const pibData = valid.map(r => r.pib_pct);
    const invData = valid.map(r => r.inv_pct);
    const ratioData = valid.map(r => r.pib_ratio);

    const baseOpts = getChartThemeOptions();

    if (!sniChartInstances.pibBalance) {
        sniChartInstances.pibBalance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'bar',
                        label: '% Aporte PIB País',
                        data: pibData,
                        backgroundColor: 'rgba(245, 158, 11, 0.85)',
                        borderRadius: 4,
                        barPercentage: 0.75,
                        categoryPercentage: 0.8
                    },
                    {
                        type: 'bar',
                        label: '% Inversión Recibida',
                        data: invData,
                        backgroundColor: 'rgba(37, 99, 235, 0.85)',
                        borderRadius: 4,
                        barPercentage: 0.75,
                        categoryPercentage: 0.8
                    },
                    {
                        type: 'line',
                        label: 'Ratio (Inv / PIB)',
                        data: ratioData,
                        borderColor: '#10b981',
                        backgroundColor: '#10b981',
                        borderWidth: 2.2,
                        yAxisID: 'y1',
                        pointRadius: 3.5,
                        pointHoverRadius: 5.5,
                        tension: 0.2
                    }
                ]
            },
            options: {
                ...baseOpts,
                plugins: {
                    ...baseOpts.plugins,
                    tooltip: {
                        ...baseOpts.plugins.tooltip,
                        callbacks: {
                            label: (c) => {
                                if (c.dataset.type === 'line') {
                                    return ` Ratio Redistributivo: ${c.raw.toFixed(2)}x ${c.raw > 1 ? '(Receptor neto)' : '(Aportante neto)'}`;
                                }
                                return ` ${c.dataset.label}: ${c.raw.toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: baseOpts.scales.x,
                    y: {
                        ...baseOpts.scales.y,
                        ticks: {
                            ...baseOpts.scales.y.ticks,
                            callback: (v) => `${v}%`
                        },
                        title: { display: true, text: '% Participación', color: baseOpts.scales.y.ticks.color, font: { size: 10, weight: '600' } }
                    },
                    y1: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: '#10b981',
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: '600' },
                            callback: (v) => `${v}x`
                        },
                        title: { display: true, text: 'Ratio Inversión / PIB', color: '#10b981', font: { size: 10, weight: '600' } }
                    }
                }
            }
        });
    } else {
        const chart = sniChartInstances.pibBalance;
        chart.data.labels = labels;
        chart.data.datasets[0].data = pibData;
        chart.data.datasets[1].data = invData;
        chart.data.datasets[2].data = ratioData;
        chart.options.scales.x.ticks.color = baseOpts.scales.x.ticks.color;
        chart.options.scales.x.grid.color = baseOpts.scales.x.grid.color;
        chart.options.scales.y.ticks.color = baseOpts.scales.y.ticks.color;
        chart.options.scales.y.grid.color = baseOpts.scales.y.grid.color;
        chart.update();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Inversión Total vs Inversión Per Cápita (Pesos por habitante)
// ─────────────────────────────────────────────────────────────────────────────
function updatePerCapitaChart() {
    const ctx = document.getElementById('chart-per-capita');
    if (!ctx) return;

    const { regions } = getRegionalAggregates();
    const valid = regions.filter(r => r.region !== '17_No Regionalizada' && r.poblacion > 0);
    const labels = valid.map(r => r.region.replace(/^\d+_/, ''));

    const totalUsd = valid.map(r => r.avg_usd_year);
    const perCapita = valid.map(r => r.per_capita_clp);

    const baseOpts = getChartThemeOptions();

    if (!sniChartInstances.perCapita) {
        sniChartInstances.perCapita = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Inversión Prom. Anual (MM USD)',
                        data: totalUsd,
                        backgroundColor: 'rgba(37, 99, 235, 0.75)',
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        type: 'line',
                        label: 'Gasto Anual Per Cápita (Pesos 2024 / hab)',
                        data: perCapita,
                        borderColor: '#10b981',
                        backgroundColor: '#10b981',
                        borderWidth: 2.2,
                        yAxisID: 'y1',
                        pointRadius: 3.5,
                        pointHoverRadius: 5.5,
                        tension: 0.2
                    }
                ]
            },
            options: {
                ...baseOpts,
                plugins: {
                    ...baseOpts.plugins,
                    tooltip: {
                        ...baseOpts.plugins.tooltip,
                        callbacks: {
                            label: (c) => {
                                if (c.dataset.type === 'line') {
                                    return ` Per Cápita: $${Math.round(c.raw).toLocaleString('es-CL')} CLP / hab`;
                                }
                                return ` Inversión Anual: US$ ${c.raw.toLocaleString('es-CL', { minimumFractionDigits: 1 })} MM`;
                            }
                        }
                    }
                },
                scales: {
                    x: baseOpts.scales.x,
                    y: {
                        ...baseOpts.scales.y,
                        ticks: {
                            ...baseOpts.scales.y.ticks,
                            callback: (v) => `US$ ${v}M`
                        },
                        title: { display: true, text: 'Promedio Anual (MM USD)', color: baseOpts.scales.y.ticks.color, font: { size: 10, weight: '600' } }
                    },
                    y1: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: '#10b981',
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: '600' },
                            callback: (v) => `$${(v / 1000).toFixed(0)}k`
                        },
                        title: { display: true, text: 'Pesos 2024 / Habitante', color: '#10b981', font: { size: 10, weight: '600' } }
                    }
                }
            }
        });
    } else {
        const chart = sniChartInstances.perCapita;
        chart.data.labels = labels;
        chart.data.datasets[0].data = totalUsd;
        chart.data.datasets[1].data = perCapita;
        chart.options.scales.x.ticks.color = baseOpts.scales.x.ticks.color;
        chart.options.scales.x.grid.color = baseOpts.scales.x.grid.color;
        chart.options.scales.y.ticks.color = baseOpts.scales.y.ticks.color;
        chart.options.scales.y.grid.color = baseOpts.scales.y.grid.color;
        chart.update();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Distribución por Ministerio (Horizontal Bar Chart)
// ─────────────────────────────────────────────────────────────────────────────
function updateMinistryShareChart() {
    const ctx = document.getElementById('chart-ministry-share');
    if (!ctx) return;

    const ministries = getMinistryAggregates();
    const totalUsd = ministries.reduce((acc, m) => acc + m.total_usd, 0);
    const labels = ministries.map(m => m.ministerio);
    const data = ministries.map(m => m.total_usd);

    const colors = labels.map((name, i) => {
        return (typeof SNI_COLORS !== 'undefined' && SNI_COLORS.ministries && SNI_COLORS.ministries[name])
            ? SNI_COLORS.ministries[name]
            : (SNI_COLORS && SNI_COLORS.palette ? SNI_COLORS.palette[i % SNI_COLORS.palette.length] : '#2563eb');
    });

    const baseOpts = getChartThemeOptions();

    const tooltipCb = (c) => {
        const val = c.raw;
        const pct = totalUsd > 0 ? ((val / totalUsd) * 100).toFixed(1) : '0';
        return ` Inversión: US$ ${val.toLocaleString('es-CL', { minimumFractionDigits: 1 })} MM (${pct}%)`;
    };

    if (sniChartInstances.ministryShare && sniChartInstances.ministryShare.config.type !== 'bar') {
        sniChartInstances.ministryShare.destroy();
        sniChartInstances.ministryShare = null;
    }

    if (!sniChartInstances.ministryShare) {
        sniChartInstances.ministryShare = new Chart(ctx, {
            type: 'bar',
            plugins: [sniHorizontalBarLabelsPlugin],
            data: {
                labels: labels,
                datasets: [{
                    label: 'Inversión por Ministerio (MM USD)',
                    data: data,
                    backgroundColor: colors,
                    borderRadius: 4,
                    barPercentage: 0.8
                }]
            },
            options: {
                ...baseOpts,
                indexAxis: 'y',
                plugins: {
                    ...baseOpts.plugins,
                    legend: { display: false },
                    tooltip: {
                        ...baseOpts.plugins.tooltip,
                        callbacks: { label: tooltipCb }
                    },
                    sniHorizontalBarLabelsPlugin: {
                        formatter: (val) => {
                            const pct = totalUsd > 0 ? ((val / totalUsd) * 100).toFixed(1) : '0';
                            return `US$ ${val.toLocaleString('es-CL', { minimumFractionDigits: 1 })} MM (${pct}%)`;
                        }
                    }
                },
                scales: {
                    x: {
                        ...baseOpts.scales.x,
                        ticks: {
                            ...baseOpts.scales.x.ticks,
                            callback: (v) => `US$ ${v}M`
                        }
                    },
                    y: {
                        ...baseOpts.scales.y,
                        grid: { display: false },
                        ticks: { ...baseOpts.scales.y.ticks, autoSkip: false }
                    }
                }
            }
        });
    } else {
        const chart = sniChartInstances.ministryShare;
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.data.datasets[0].backgroundColor = colors;
        chart.options.plugins.tooltip.callbacks.label = tooltipCb;
        if (chart.options.plugins.sniHorizontalBarLabelsPlugin) {
            chart.options.plugins.sniHorizontalBarLabelsPlugin.formatter = (val) => {
                const pct = totalUsd > 0 ? ((val / totalUsd) * 100).toFixed(1) : '0';
                return `US$ ${val.toLocaleString('es-CL', { minimumFractionDigits: 1 })} MM (${pct}%)`;
            };
        }
        chart.options.scales.x.ticks.color = baseOpts.scales.x.ticks.color;
        chart.options.scales.x.grid.color = baseOpts.scales.x.grid.color;
        chart.options.scales.y.ticks.color = baseOpts.scales.y.ticks.color;
        chart.update();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Desglose Direcciones MOP
// ─────────────────────────────────────────────────────────────────────────────
function updateMopServicesChart() {
    const ctx = document.getElementById('chart-mop-services');
    if (!ctx) return;

    if (!window.SNI_DATA || !window.SNI_DATA.mop_services) return;
    const services = window.SNI_DATA.mop_services;

    const { selectedYears, selectedRegions } = (typeof sniState !== 'undefined') ? sniState : { selectedYears: [], selectedRegions: [] };
    const filtered = services.filter(row => {
        if (selectedYears && selectedYears.length > 0 && !selectedYears.includes(row.y)) return false;
        if (selectedRegions && selectedRegions.length > 0 && !selectedRegions.includes(row.r)) return false;
        return true;
    });

    const srvMap = {};
    let totalMop = 0;
    filtered.forEach(r => {
        if (!srvMap[r.srv]) srvMap[r.srv] = 0;
        srvMap[r.srv] += r.u;
        totalMop += r.u;
    });

    const sorted = Object.entries(srvMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const labels = sorted.map(s => s[0]);
    const data = sorted.map(s => Math.round(s[1] * 100) / 100);

    const baseOpts = getChartThemeOptions();

    const tooltipCb = (c) => {
        const val = c.raw;
        const pct = totalMop > 0 ? ((val / totalMop) * 100).toFixed(1) : '0';
        return ` ${c.label}: US$ ${val.toLocaleString('es-CL')} MM (${pct}% MOP)`;
    };

    if (!sniChartInstances.mopServices) {
        sniChartInstances.mopServices = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Inversión MOP (MM USD)',
                    data: data,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4,
                    barPercentage: 0.8
                }]
            },
            options: {
                ...baseOpts,
                indexAxis: 'y',
                plugins: {
                    ...baseOpts.plugins,
                    legend: { display: false },
                    tooltip: {
                        ...baseOpts.plugins.tooltip,
                        callbacks: { label: tooltipCb }
                    }
                },
                scales: {
                    x: {
                        ...baseOpts.scales.x,
                        ticks: {
                            ...baseOpts.scales.x.ticks,
                            callback: (v) => `US$ ${v}M`
                        }
                    },
                    y: {
                        ...baseOpts.scales.y,
                        grid: { display: false },
                        ticks: { ...baseOpts.scales.y.ticks, autoSkip: false }
                    }
                }
            }
        });
    } else {
        const chart = sniChartInstances.mopServices;
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.options.plugins.tooltip.callbacks.label = tooltipCb;
        chart.options.scales.x.ticks.color = baseOpts.scales.x.ticks.color;
        chart.options.scales.x.grid.color = baseOpts.scales.x.grid.color;
        chart.options.scales.y.ticks.color = baseOpts.scales.y.ticks.color;
        chart.update();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Evolución Anual de Inversión Pública por Ministerio
// ─────────────────────────────────────────────────────────────────────────────
function updateTemporalEvolutionChart() {
    const ctx = document.getElementById('chart-temporal-evolution');
    if (!ctx) return;

    const matrix = getFilteredSNIMatrix();
    const years = (window.SNI_DATA && window.SNI_DATA.filters ? window.SNI_DATA.filters.years : []).slice().sort((a, b) => a - b);

    // Top 5 ministerios dinámicos
    const minAgg = getMinistryAggregates();
    const topMins = minAgg.slice(0, 5).map(m => m.ministerio);

    const datasets = topMins.map((min, idx) => {
        const color = (typeof SNI_COLORS !== 'undefined' && SNI_COLORS.ministries && SNI_COLORS.ministries[min])
            ? SNI_COLORS.ministries[min]
            : (SNI_COLORS && SNI_COLORS.palette ? SNI_COLORS.palette[idx % SNI_COLORS.palette.length] : '#2563eb');

        const data = years.map(y => {
            const sum = matrix
                .filter(r => r.y === y && r.m === min)
                .reduce((acc, r) => acc + r.u, 0);
            return Math.round(sum * 100) / 100;
        });

        return {
            label: min,
            data: data,
            backgroundColor: color,
            borderRadius: 2,
            stack: 'total'
        };
    });

    // Otros ministerios
    const otrosData = years.map(y => {
        const sum = matrix
            .filter(r => r.y === y && !topMins.includes(r.m))
            .reduce((acc, r) => acc + r.u, 0);
        return Math.round(sum * 100) / 100;
    });

    if (otrosData.some(v => v > 0)) {
        datasets.push({
            label: 'Otros Ministerios',
            data: otrosData,
            backgroundColor: '#94a3b8',
            borderRadius: 2,
            stack: 'total'
        });
    }

    const baseOpts = getChartThemeOptions();

    if (!sniChartInstances.temporalEvolution) {
        sniChartInstances.temporalEvolution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: years.map(String),
                datasets: datasets
            },
            options: {
                ...baseOpts,
                plugins: {
                    ...baseOpts.plugins,
                    tooltip: {
                        ...baseOpts.plugins.tooltip,
                        callbacks: {
                            label: (c) => ` ${c.dataset.label}: US$ ${c.raw.toLocaleString('es-CL')} MM`
                        }
                    }
                },
                scales: {
                    x: { ...baseOpts.scales.x, stacked: true },
                    y: {
                        ...baseOpts.scales.y,
                        stacked: true,
                        ticks: {
                            ...baseOpts.scales.y.ticks,
                            callback: (v) => `US$ ${v}M`
                        },
                        title: { display: true, text: 'Inversión Anual (MM USD 2024)', color: baseOpts.scales.y.ticks.color, font: { size: 10, weight: '600' } }
                    }
                }
            }
        });
    } else {
        const chart = sniChartInstances.temporalEvolution;
        chart.data.labels = years.map(String);
        // Para stacked charts con datasets dinámicos, reemplazamos el array completo
        chart.data.datasets = datasets;
        chart.options.scales.x.ticks.color = baseOpts.scales.x.ticks.color;
        chart.options.scales.x.grid.color = baseOpts.scales.x.grid.color;
        chart.options.scales.y.ticks.color = baseOpts.scales.y.ticks.color;
        chart.options.scales.y.grid.color = baseOpts.scales.y.grid.color;
        chart.update();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Comparativa por Períodos Presidenciales
// ─────────────────────────────────────────────────────────────────────────────
function updatePrePostGovChart() {
    const ctx = document.getElementById('chart-pre-post-gov');
    if (!ctx) return;

    const matrix = getFilteredSNIMatrix();
    const periods = [
        { name: 'Piñera I (2010–2013)', years: [2010, 2011, 2012, 2013], color: '#3b82f6' },
        { name: 'Bachelet II (2014–2017)', years: [2014, 2015, 2016, 2017], color: '#f43f5e' },
        { name: 'Piñera II (2018–2021)', years: [2018, 2019, 2020, 2021], color: '#2563eb' },
        { name: 'Boric (2022–2024)', years: [2022, 2023, 2024], color: '#10b981' }
    ];

    const labels = periods.map(p => p.name);
    const avgData = periods.map(p => {
        const total = matrix
            .filter(r => p.years.includes(r.y))
            .reduce((acc, r) => acc + r.u, 0);
        return Math.round((total / p.years.length) * 100) / 100;
    });

    const colors = periods.map(p => p.color);
    const baseOpts = getChartThemeOptions();

    if (!sniChartInstances.prePostGov) {
        sniChartInstances.prePostGov = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Promedio Anual (MM USD 2024)',
                    data: avgData,
                    backgroundColor: colors,
                    borderRadius: 4,
                    barPercentage: 0.65
                }]
            },
            options: {
                ...baseOpts,
                plugins: {
                    ...baseOpts.plugins,
                    legend: { display: false },
                    tooltip: {
                        ...baseOpts.plugins.tooltip,
                        callbacks: {
                            label: (c) => ` Promedio Anual: US$ ${c.raw.toLocaleString('es-CL', { minimumFractionDigits: 1 })} MM`
                        }
                    }
                },
                scales: {
                    x: baseOpts.scales.x,
                    y: {
                        ...baseOpts.scales.y,
                        ticks: {
                            ...baseOpts.scales.y.ticks,
                            callback: (v) => `US$ ${v}M`
                        },
                        title: { display: true, text: 'Promedio Anual (MM USD 2024)', color: baseOpts.scales.y.ticks.color, font: { size: 10, weight: '600' } }
                    }
                }
            }
        });
    } else {
        const chart = sniChartInstances.prePostGov;
        chart.data.labels = labels;
        chart.data.datasets[0].data = avgData;
        chart.data.datasets[0].backgroundColor = colors;
        chart.options.scales.x.ticks.color = baseOpts.scales.x.ticks.color;
        chart.options.scales.x.grid.color = baseOpts.scales.x.grid.color;
        chart.options.scales.y.ticks.color = baseOpts.scales.y.ticks.color;
        chart.options.scales.y.grid.color = baseOpts.scales.y.grid.color;
        chart.update();
    }
}
