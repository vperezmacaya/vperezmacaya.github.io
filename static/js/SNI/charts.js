/**
 * static/js/SNI/charts.js
 * Gráficos analíticos con Chart.js para la plataforma SNI
 * Homologados con la estética, tipografía ('Helvetica Neue'), tooltips,
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
    ministryShare: null,
    mopServices: null,
    temporalEvolution: null,
    prePostGov: null
};

// Configurar defaults globales de Chart.js (estándar tipográfico CATLEC)
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Helvetica Neue', Helvetica, Arial, sans-serif";
    Chart.defaults.font.size = 10;
    Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
}

// Tooltip externo negro compartido para todos los gráficos SNI
// (réplica exacta de investmentExternalTooltip de index.html)
const sniExternalTooltip = CatlecTooltip.create({ domId: 'sni-shared-tooltip' });


// Opciones comunes y tema unificado (idéntico a index.html)
function getChartThemeOptions() {
    const textColor = '#334155';
    const textMuted = '#334155';
    const gridColor = 'rgba(0, 0, 0, 0.06)';

    return {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: Math.max(2.5, window.devicePixelRatio || 1),
        animation: {
            duration: 450,
            easing: 'easeOutQuart'
        },
        layout: {
            padding: { top: 4, bottom: 2, left: 2, right: 8 }
        },
        plugins: {
            legend: {
                display: false
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
                    font: { size: 10, weight: '600' }
                },
                grid: { color: gridColor, drawBorder: false }
            },
            y: {
                ticks: {
                    color: textMuted,
                    font: { size: 10, weight: '600' }
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
    let xAxisTitle = '';
    let dataLabelFormatter = (v) => v;

    switch (metric) {
        case 'per_capita':
            sorted = [...valid].sort((a, b) => b.per_capita_clp - a.per_capita_clp);
            title = 'Ranking Regional: Inversión Per Cápita (Pesos 2024 / hab)';
            unitLabel = '$ CLP / hab';
            barColor = '#059669';
            valFormatter = (v) => `$${Math.round(v).toLocaleString('es-CL')} CLP`;
            xAxisTitle = 'Inversión Per Cápita (CLP / hab)';
            dataLabelFormatter = (v) => Math.round(v).toLocaleString('es-CL');
            break;
        case 'km2':
            sorted = [...valid].sort((a, b) => b.per_km2_clp - a.per_km2_clp);
            title = 'Ranking Regional: Inversión por Superficie ($ / km²)';
            unitLabel = '$ CLP / km²';
            barColor = '#8b5cf6';
            valFormatter = (v) => `$${Math.round(v).toLocaleString('es-CL')} / km²`;
            xAxisTitle = 'Inversión por Superficie (CLP / km²)';
            dataLabelFormatter = (v) => Math.round(v).toLocaleString('es-CL');
            break;
        case 'pib_ratio':
            sorted = [...valid].sort((a, b) => b.pib_ratio - a.pib_ratio);
            title = 'Ranking Regional: Ratio Redistributivo (Inversión / PIB)';
            unitLabel = 'Ratio Inv/PIB';
            barColor = '#f59e0b';
            valFormatter = (v) => `${v.toFixed(2)}x`;
            xAxisTitle = 'Ratio Inversión / PIB';
            dataLabelFormatter = (v) => `${v.toFixed(2)}x`;
            break;
        case 'total':
        default:
            sorted = [...valid].sort((a, b) => b.total_usd - a.total_usd);
            title = 'Ranking Regional: Inversión Total (MM USD 2024)';
            unitLabel = 'MM USD';
            barColor = '#2563eb';
            valFormatter = (v) => `US$ ${v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MM`;
            xAxisTitle = 'Inversión (MM USD 2024)';
            dataLabelFormatter = (v) => v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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

    const nonNoReg = sorted.filter(r => !r.region.includes('No Regionalizada') && !r.region.includes('Exterior'));
    const nonNoRegVals = nonNoReg.map(r => {
        if (metric === 'per_capita') return r.per_capita_clp;
        if (metric === 'km2') return r.per_km2_clp;
        if (metric === 'pib_ratio') return r.pib_ratio;
        return r.total_usd;
    }).filter(v => typeof v === 'number' && v > 0);

    const maxVal = nonNoRegVals.length > 0 ? Math.max(...nonNoRegVals) : 0;
    const minVal = nonNoRegVals.length > 0 ? Math.min(...nonNoRegVals) : 0;

    const backgroundColors = sorted.map(r => {
        if (r.region.includes('No Regionalizada')) return '#64748b';
        let val = r.total_usd;
        if (metric === 'per_capita') val = r.per_capita_clp;
        else if (metric === 'km2') val = r.per_km2_clp;
        else if (metric === 'pib_ratio') val = r.pib_ratio;
        return typeof getChoroplethColor === 'function' ? getChoroplethColor(val, maxVal, minVal) : barColor;
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
            plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
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
                    horizontalBarDataLabelsPlugin: {
                        formatter: (val) => dataLabelFormatter(val)
                    }
                },
                scales: {
                    x: {
                        ...baseOpts.scales.x,
                        ticks: { ...baseOpts.scales.x.ticks, callback: makeTickCallback() },
                        title: { display: true, text: xAxisTitle, color: baseOpts.scales.x.ticks.color, font: { size: 9.5, weight: '600' } }
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
        chart.options.plugins.horizontalBarDataLabelsPlugin.formatter = (val) => dataLabelFormatter(val);
        chart.options.scales.x.title = { display: true, text: xAxisTitle, color: baseOpts.scales.x.ticks.color, font: { size: 9.5, weight: '600' } };
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
            plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
            data: {
                labels: labels,
                datasets: [{
                    label: 'Inversión (MM USD 2024)',
                    data: data,
                    backgroundColor: 'rgba(37,99,235,0.8)',
                    borderColor: '#2563eb',
                    borderWidth: 1,
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
                    horizontalBarDataLabelsPlugin: {
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
function wrapRegionLabel(name) {
    if (!name || typeof name !== 'string') return name;
    const clean = name.replace(/^\d+_/, '').trim();
    if (clean === 'Arica y Parinacota') return ['Arica y', 'Parinacota'];
    if (clean === 'Los Ríos') return ['Los', 'Ríos'];
    if (clean === 'Los Lagos') return ['Los', 'Lagos'];
    if (clean.startsWith('La ')) return ['La', clean.slice(3)];
    if (clean.includes(' ') && clean.length > 9) {
        const words = clean.split(' ');
        const mid = Math.ceil(words.length / 2);
        return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
    }
    return clean;
}

function updatePibBalanceChart() {
    const ctx = document.getElementById('chart-pib-balance');
    if (!ctx) return;

    const { regions } = getRegionalAggregates();
    const valid = regions.filter(r => r.region !== '17_No Regionalizada' && r.pib_pct > 0);
    const rawLabels = valid.map(r => r.region.replace(/^\d+_/, ''));
    const labels = rawLabels.map(wrapRegionLabel);

    const pibData = valid.map(r => r.pib_pct);
    const invData = valid.map(r => r.inv_pct);
    const ratioData = valid.map(r => r.pib_ratio);

    const baseOpts = getChartThemeOptions();

    const titleCb = (items) => {
        if (!items || !items.length) return '';
        const idx = items[0].dataIndex;
        return rawLabels[idx] || (Array.isArray(items[0].label) ? items[0].label.join(' ') : items[0].label);
    };

    if (!sniChartInstances.pibBalance) {
        sniChartInstances.pibBalance = new Chart(ctx, {
            type: 'bar',
            plugins: [CatlecUtils.groupedBarDataLabelsPlugin],
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'bar',
                        label: '% Aporte PIB País',
                        data: pibData,
                        backgroundColor: 'rgba(245, 158, 11, 0.85)',
                        borderColor: 'rgba(245, 158, 11, 1)',
                        borderWidth: 1,
                        borderRadius: 3,
                        barPercentage: 0.75,
                        categoryPercentage: 0.8,
                        order: 2
                    },
                    {
                        type: 'bar',
                        label: '% Inversión Recibida',
                        data: invData,
                        backgroundColor: 'rgba(37, 99, 235, 0.85)',
                        borderColor: 'rgba(37, 99, 235, 1)',
                        borderWidth: 1,
                        borderRadius: 3,
                        barPercentage: 0.75,
                        categoryPercentage: 0.8,
                        order: 2
                    },
                    {
                        type: 'line',
                        label: 'Ratio (Inv / PIB)',
                        data: ratioData,
                        borderColor: '#10b981',
                        backgroundColor: '#10b981',
                        borderWidth: 2.2,
                        pointBackgroundColor: '#10b981',
                        yAxisID: 'y1',
                        pointRadius: 3.5,
                        pointHoverRadius: 5.5,
                        tension: 0.2,
                        order: 1
                    }
                ]
            },
            options: {
                ...baseOpts,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    ...baseOpts.plugins,
                    legend: { display: false },
                    tooltip: {
                        ...baseOpts.plugins.tooltip,
                        callbacks: {
                            title: titleCb,
                            label: (c) => {
                                if (c.dataset.type === 'line') {
                                    return ` Ratio Redistributivo: ${c.raw.toFixed(2)}x ${c.raw > 1 ? '(Receptor neto)' : '(Aportante neto)'}`;
                                }
                                return ` ${c.dataset.label}: ${c.raw.toFixed(1)}%`;
                            }
                        }
                    },
                    groupedBarDataLabelsPlugin: {
                        formatter: (v) => `${v.toFixed(1)}%`,
                        color: (dIdx) => dIdx === 0 ? 'rgba(245, 158, 11, 1)' : 'rgba(37, 99, 235, 1)',
                        font: '700 9.5px Helvetica Neue, Helvetica, Arial, sans-serif',
                        offset: 3
                    }
                },
                scales: {
                    x: {
                        ...baseOpts.scales.x,
                        ticks: {
                            ...baseOpts.scales.x.ticks,
                            font: { size: 10, weight: '600' },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false,
                            padding: 3
                        }
                    },
                    y: {
                        ...baseOpts.scales.y,
                        suggestedMax: Math.max(...pibData, ...invData, 0) * 1.18,
                        ticks: {
                            ...baseOpts.scales.y.ticks,
                            font: { size: 10, weight: '600' },
                            callback: (v) => `${v}%`
                        },
                        title: { display: true, text: '% Participación', color: baseOpts.scales.y.ticks.color, font: { size: 9.5, weight: '600' } }
                    },
                    y1: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: '#10b981',
                            font: { size: 10, weight: '600' },
                            callback: (v) => `${v}x`
                        },
                        title: { display: true, text: 'Ratio Inversión / PIB', color: '#10b981', font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    } else {
        const chart = sniChartInstances.pibBalance;
        chart.data.labels = labels;
        chart.data.datasets[0].data = pibData;
        chart.data.datasets[0].order = 2;
        chart.data.datasets[1].data = invData;
        chart.data.datasets[1].order = 2;
        chart.data.datasets[2].data = ratioData;
        chart.data.datasets[2].order = 1;
        chart.options.scales.y.suggestedMax = Math.max(...pibData, ...invData, 0) * 1.18;
        chart.options.plugins.legend = { display: false };
        chart.options.plugins.tooltip.callbacks.title = titleCb;
        chart.options.scales.x.ticks.maxRotation = 0;
        chart.options.scales.x.ticks.minRotation = 0;
        chart.options.scales.x.ticks.autoSkip = false;
        chart.options.scales.x.ticks.font = { size: 10, weight: '600' };
        chart.options.scales.x.ticks.color = baseOpts.scales.x.ticks.color;
        chart.options.scales.x.grid.color = baseOpts.scales.x.grid.color;
        chart.options.scales.y.ticks.color = baseOpts.scales.y.ticks.color;
        chart.options.scales.y.grid.color = baseOpts.scales.y.grid.color;
        chart.update();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Distribución por Ministerio (Horizontal Bar Chart)
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
            plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
            data: {
                labels: labels,
                datasets: [{
                    label: 'Inversión por Ministerio (MM USD)',
                    data: data,
                    backgroundColor: colors.map(c => `${c}cc`),
                    borderRadius: 3,
                    borderWidth: 1,
                    borderColor: colors,
                    barPercentage: 0.75
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
                    horizontalBarDataLabelsPlugin: {
                        formatter: (val) => {
                            const pct = totalUsd > 0 ? ((val / totalUsd) * 100).toFixed(1) : '0';
                            return `${val.toLocaleString('es-CL', { minimumFractionDigits: 1 })} (${pct}%)`;
                        }
                    }
                },
                scales: {
                    x: {
                        ...baseOpts.scales.x,
                        ticks: {
                            ...baseOpts.scales.x.ticks,
                            font: { size: 10, weight: '600' },
                            callback: (v) => v.toLocaleString('es-CL')
                        },
                        title: { display: true, text: 'Inversión (MM USD 2024)', color: baseOpts.scales.x.ticks.color, font: { size: 9.5, weight: '600' } }
                    },
                    y: {
                        ...baseOpts.scales.y,
                        grid: { display: false },
                        ticks: { ...baseOpts.scales.y.ticks, font: { size: 10, weight: '600' }, autoSkip: false }
                    }
                }
            }
        });
    } else {
        const chart = sniChartInstances.ministryShare;
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.data.datasets[0].backgroundColor = colors.map(c => `${c}cc`);
        chart.data.datasets[0].borderColor = colors;
        chart.options.plugins.tooltip.callbacks.label = tooltipCb;
        chart.options.scales.x.ticks.callback = (v) => v.toLocaleString('es-CL');
        if (chart.options.plugins.horizontalBarDataLabelsPlugin) {
            chart.options.plugins.horizontalBarDataLabelsPlugin.formatter = (val) => {
                const pct = totalUsd > 0 ? ((val / totalUsd) * 100).toFixed(1) : '0';
                return `${val.toLocaleString('es-CL', { minimumFractionDigits: 1 })} (${pct}%)`;
            };
        }
        chart.options.scales.x.ticks.color = baseOpts.scales.x.ticks.color;
        chart.options.scales.x.grid.color = baseOpts.scales.x.grid.color;
        chart.options.scales.y.ticks.color = baseOpts.scales.y.ticks.color;
        chart.update();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Desglose Direcciones MOP (Consolidadas)
// ─────────────────────────────────────────────────────────────────────────────
function getConsolidatedMopService(srv) {
    if (!srv || typeof srv !== 'string') return 'Otros';
    const s = srv.trim();
    if (s.includes('Vialidad')) return 'Dirección de Vialidad';
    if (s.includes('Concesiones')) return 'Dirección General de Concesiones';
    if (s.includes('Obras Hidráulicas') || s.includes('Obras Hidraulicas') || s.includes('Hidráulica') || s.includes('Hidraulica')) {
        return 'Dirección de Obras Hidráulicas';
    }
    if (s.includes('Agua Potable') || s.includes('Sanitarios')) {
        return 'Agua Potable Rural';
    }
    if (s.includes('Portuarias') || s.includes('Obras Portuarias')) return 'Dirección de Obras Portuarias';
    if (s.includes('Aeropuertos')) return 'Dirección de Aeropuertos';
    if (s.includes('Arquitectura')) return 'Dirección de Arquitectura';
    if (s.includes('Aguas')) return 'Dirección General de Aguas';
    if (s.includes('Planeamiento')) return 'Dirección de Planeamiento';
    if (s.includes('General de Obras')) return 'Dirección General de Obras Públicas';
    if (s.includes('Secretaría') || s.includes('Secretaria')) return 'Secretaría y Adm. General';
    return 'Otros';
}

function wrapMopServiceLabel(label) {
    if (!label || typeof label !== 'string') return label;
    const words = label.split(' ');
    if (words.length <= 1) return label;

    // Si empieza con "Dirección General de", dividir en 2 renglones
    if (label.startsWith('Dirección General de ') && words.length > 3) {
        return ['Dirección General de', words.slice(3).join(' ')];
    }

    // Si empieza con "Dirección de", dividir en exactamente 2 renglones
    if (label.startsWith('Dirección de ') && words.length > 2) {
        return ['Dirección de', words.slice(2).join(' ')];
    }

    // Para cualquier otro nombre, dividir en exactamente 2 renglones equilibrados
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

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
        const consName = getConsolidatedMopService(r.srv);
        if (!srvMap[consName]) srvMap[consName] = 0;
        srvMap[consName] += r.u;
        totalMop += r.u;
    });

    const sorted = Object.entries(srvMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const rawLabels = sorted.map(s => s[0]);
    const labels = rawLabels.map(wrapMopServiceLabel);
    const data = sorted.map(s => Math.round(s[1] * 100) / 100);

    const baseOpts = getChartThemeOptions();

    const tooltipCb = (c) => {
        const val = c.raw;
        const pct = totalMop > 0 ? ((val / totalMop) * 100).toFixed(1) : '0';
        return ` Inversión: US$ ${val.toLocaleString('es-CL', { minimumFractionDigits: 1 })} MM (${pct}% MOP)`;
    };

    const titleCb = (items) => {
        if (!items || !items.length) return '';
        const idx = items[0].dataIndex;
        return rawLabels[idx] || (Array.isArray(items[0].label) ? items[0].label.join(' ') : items[0].label);
    };

    if (!sniChartInstances.mopServices) {
        sniChartInstances.mopServices = new Chart(ctx, {
            type: 'bar',
            plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
            data: {
                labels: labels,
                datasets: [{
                    label: 'Inversión MOP (MM USD)',
                    data: data,
                    backgroundColor: 'rgba(59,130,246,0.8)',
                    borderColor: '#2563eb',
                    borderWidth: 1,
                    borderRadius: 3,
                    barPercentage: 0.75
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
                        callbacks: {
                            title: titleCb,
                            label: tooltipCb
                        }
                    },
                    horizontalBarDataLabelsPlugin: {
                        formatter: (val) => {
                            const pct = totalMop > 0 ? ((val / totalMop) * 100).toFixed(1) : '0';
                            return `${val.toLocaleString('es-CL', { minimumFractionDigits: 1 })} (${pct}%)`;
                        }
                    }
                },
                scales: {
                    x: {
                        ...baseOpts.scales.x,
                        ticks: {
                            ...baseOpts.scales.x.ticks,
                            font: { size: 10, weight: '600' },
                            callback: (v) => v.toLocaleString('es-CL')
                        },
                        title: { display: true, text: 'Inversión MOP (MM USD)', color: baseOpts.scales.x.ticks.color, font: { size: 9.5, weight: '600' } }
                    },
                    y: {
                        ...baseOpts.scales.y,
                        grid: { display: false },
                        ticks: { ...baseOpts.scales.y.ticks, font: { size: 10, weight: '600' }, autoSkip: false }
                    }
                }
            }
        });
    } else {
        const chart = sniChartInstances.mopServices;
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.options.plugins.tooltip.callbacks.title = titleCb;
        chart.options.plugins.tooltip.callbacks.label = tooltipCb;
        chart.options.scales.x.ticks.callback = (v) => v.toLocaleString('es-CL');
        if (chart.options.plugins.horizontalBarDataLabelsPlugin) {
            chart.options.plugins.horizontalBarDataLabelsPlugin.formatter = (val) => {
                const pct = totalMop > 0 ? ((val / totalMop) * 100).toFixed(1) : '0';
                return `${val.toLocaleString('es-CL', { minimumFractionDigits: 1 })} (${pct}%)`;
            };
        }
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
            backgroundColor: `${color}cc`,
            borderRadius: 2,
            borderWidth: 1,
            borderColor: color,
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
            backgroundColor: 'rgba(148,163,184,0.8)',
            borderRadius: 2,
            borderWidth: 1,
            borderColor: '#94a3b8',
            stack: 'total'
        });
    }

    // Actualizar micro-leyenda HTML en cabecera del card
    const legendEl = document.getElementById('temporal-evolution-legend');
    if (legendEl) {
        legendEl.innerHTML = datasets.map(ds => `
            <span class="sni-card-legend-item" style="color:${ds.borderColor};">
                <span class="sni-legend-dot" style="background:${ds.borderColor};"></span>
                ${ds.label}
            </span>
        `).join('');
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
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    ...baseOpts.plugins,
                    legend: { display: false },
                    tooltip: {
                        ...baseOpts.plugins.tooltip,
                        callbacks: {
                            label: (c) => ` ${c.dataset.label}: US$ ${c.raw.toLocaleString('es-CL')} MM`
                        }
                    }
                },
                scales: {
                    x: {
                        ...baseOpts.scales.x,
                        stacked: true,
                        grid: { display: false },
                        ticks: {
                            ...baseOpts.scales.x.ticks,
                            font: { size: 10, weight: '600' }
                        }
                    },
                    y: {
                        ...baseOpts.scales.y,
                        stacked: true,
                        ticks: {
                            ...baseOpts.scales.y.ticks,
                            font: { size: 10, weight: '600' },
                            callback: (v) => v.toLocaleString('es-CL')
                        },
                        title: { display: true, text: 'Inversión Anual (MM USD 2024)', color: baseOpts.scales.y.ticks.color, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    } else {
        const chart = sniChartInstances.temporalEvolution;
        chart.data.labels = years.map(String);
        // Para stacked charts con datasets dinámicos, reemplazamos el array completo
        chart.data.datasets = datasets;
        chart.options.plugins.legend = { display: false };
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
            plugins: [CatlecUtils.groupedBarDataLabelsPlugin],
            data: {
                labels: labels,
                datasets: [{
                    label: 'Promedio Anual (MM USD 2024)',
                    data: avgData,
                    backgroundColor: colors.map(c => `${c}cc`),
                    borderColor: colors,
                    borderWidth: 1,
                    borderRadius: 3,
                    barPercentage: 0.55
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
                    },
                    groupedBarDataLabelsPlugin: {
                        formatter: (v) => v.toLocaleString('es-CL', { minimumFractionDigits: 1 }),
                        color: (dIdx) => colors[dIdx],
                        offset: 4
                    }
                },
                scales: {
                    x: {
                        ...baseOpts.scales.x,
                        grid: { display: false },
                        ticks: {
                            ...baseOpts.scales.x.ticks,
                            font: { size: 10, weight: '600' }
                        }
                    },
                    y: {
                        ...baseOpts.scales.y,
                        suggestedMax: Math.max(...avgData, 0) * 1.18,
                        ticks: {
                            ...baseOpts.scales.y.ticks,
                            font: { size: 10, weight: '600' },
                            callback: (v) => v.toLocaleString('es-CL')
                        },
                        title: { display: true, text: 'Promedio Anual (MM USD 2024)', color: baseOpts.scales.y.ticks.color, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    } else {
        const chart = sniChartInstances.prePostGov;
        chart.data.labels = labels;
        chart.data.datasets[0].data = avgData;
        chart.data.datasets[0].backgroundColor = colors.map(c => `${c}cc`);
        chart.data.datasets[0].borderColor = colors;
        chart.options.plugins.legend = { display: false };
        chart.options.scales.x.ticks.color = baseOpts.scales.x.ticks.color;
        chart.options.scales.x.grid.color = baseOpts.scales.x.grid.color;
        chart.options.scales.y.ticks.color = baseOpts.scales.y.ticks.color;
        chart.options.scales.y.grid.color = baseOpts.scales.y.grid.color;
        chart.update();
    }
}
