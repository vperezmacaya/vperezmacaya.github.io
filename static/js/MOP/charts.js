/**
 * static/js/MOP/charts.js
 * Render de los gráficos Chart.js del dashboard MOP.
 * Requiere: Chart.js, window.MOP_DATA (mop_data.js), static/js/MOP/state.js, utils.js
 */

function clearEmpty(canvas) {
    if (!canvas || !canvas.parentElement) return;
    canvas.parentElement.querySelectorAll('.mop-empty-placeholder').forEach(el => el.remove());
}

function showEmpty(canvas) {
    if (!canvas || !canvas.parentElement) return;
    clearEmpty(canvas);
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    const p = document.createElement('p');
    p.className = 'mop-empty-placeholder';
    p.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.75rem;pointer-events:none;margin:0;';
    p.textContent = 'Sin datos para los filtros aplicados';
    canvas.parentElement.appendChild(p);
}

// ── Render de todos los gráficos ──────────────────────────────────────────
function renderAllCharts() {
    // Donut charts en panel izquierdo (siempre visibles)
    renderServicioDonut();
    renderServicioCostDonut();

    // Gráficos y tablas según la pestaña activa
    if (currentActiveTab === 'resumen') {
        renderGlobalTable();
    } else if (currentActiveTab === 'mapa') {
        if (typeof updateMOPMap === 'function') updateMOPMap();
    } else if (currentActiveTab === 'inversion') {
        renderProgramaInversionBar();
        renderServicioEtapaStacked();
        renderConcentracion();
    } else if (currentActiveTab === 'programas') {
        renderYearLine();
        renderCarteraActiva();
        renderPipelineEtapa();
    }
}

function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// Crea el gráfico la primera vez; después actualiza datos y opciones en el lugar
// (mantiene la interpolación de Chart.js, estándar catlec-bar-chart)
function upsertChart(id, canvas, config) {
    const ch = charts[id];
    if (!ch) {
        charts[id] = new Chart(canvas, config);
        return charts[id];
    }
    ch.data.labels = config.data.labels;
    config.data.datasets.forEach((ds, i) => {
        if (ch.data.datasets[i]) Object.assign(ch.data.datasets[i], ds);
        else ch.data.datasets.push(ds);
    });
    ch.data.datasets.length = config.data.datasets.length;
    ch.options = config.options;
    ch.update();
    return ch;
}

const MOP_AXIS_TICKS = { color: labelColor(), font: { size: 10, weight: '600' } };

function mopAxisTitle(text, color = titleColor()) {
    return { display: true, text, color, font: { size: 9.5, weight: '600' } };
}

const mopMoney = (v) => `$${Number(v).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MM CLP`;

// ── 1. Donut: Distribución por Servicio (Nº Proyectos) ────────────────────
function renderServicioDonut() {
    const canvas = document.getElementById('chart-servicio');
    if (!canvas) return;
    clearEmpty(canvas);

    const data = aggregateBy('servicio', 'cost_mm').sort((a,b) => b.count - a.count);
    if (!data.length) {
        destroyChart('servicio');
        showEmpty(canvas);
        return;
    }

    const totalProjects = data.reduce((sum, d) => sum + d.count, 0);
    const labels = data.map(d => shortServiceName(d.label));
    const values = data.map(d => d.count);
    const colors = data.map(d => getServiceColor(d.label));

    if (charts.servicio) {
        charts.servicio.data.labels = labels;
        charts.servicio.data.datasets[0].data = values;
        charts.servicio.data.datasets[0].backgroundColor = colors;
        charts.servicio.data.datasets[0].borderColor = '#ffffff';
        delete charts.servicio.options.onClick;
        charts.servicio.update();
    } else {
        charts.servicio = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data:            values,
                    backgroundColor: colors,
                    borderWidth:     1.5,
                    borderColor:     '#ffffff',
                    hoverOffset:     4,
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
                        external: mopExternalTooltip,
                        callbacks: {
                            title: items => items.length ? items[0].label : '',
                            label: ctx => ` ${ctx.raw} proyectos (${((ctx.raw / (totalProjects || 1)) * 100).toFixed(1)}%)`
                        }
                    }
                }
            }
        });
    }

    // Render custom HTML legend
    const legendEl = document.getElementById('mopServicioChartLegend');
    if (legendEl) {
        legendEl.innerHTML = data.map((d, idx) => {
            const count = d.count;
            const pct = totalProjects > 0 ? ((count / totalProjects) * 100).toFixed(1).replace(/\.0$/, '') : '0';
            const col = colors[idx];
            const sName = shortServiceName(d.label);
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.69rem; padding:0.1rem 0; color:var(--text-primary);">
                    <div style="display:flex; align-items:center; gap:0.35rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-primary); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sName}</span>
                    </div>
                    <span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                        ${pct}%
                    </span>
                </div>
            `;
        }).join('');
    }
}

// ── 1b. Donut: Costo Total por Servicio (Inversión MM CLP) ────────────────
function renderServicioCostDonut() {
    const canvas = document.getElementById('chart-servicio-cost');
    if (!canvas) return;
    clearEmpty(canvas);

    const data = aggregateBy('servicio', 'cost_mm').sort((a,b) => b.total - a.total);
    if (!data.length) {
        destroyChart('servicioCost');
        showEmpty(canvas);
        return;
    }

    const totalCost = data.reduce((sum, d) => sum + d.total, 0);
    const labels = data.map(d => shortServiceName(d.label));
    const values = data.map(d => +d.total.toFixed(1));
    const colors = data.map(d => getServiceColor(d.label));

    if (charts.servicioCost) {
        charts.servicioCost.data.labels = labels;
        charts.servicioCost.data.datasets[0].data = values;
        charts.servicioCost.data.datasets[0].backgroundColor = colors;
        charts.servicioCost.data.datasets[0].borderColor = '#ffffff';
        delete charts.servicioCost.options.onClick;
        charts.servicioCost.update();
    } else {
        charts.servicioCost = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data:            values,
                    backgroundColor: colors,
                    borderWidth:     1.5,
                    borderColor:     '#ffffff',
                    hoverOffset:     4,
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
                        external: mopExternalTooltip,
                        callbacks: {
                            title: items => items.length ? items[0].label : '',
                            label: ctx => ` Inversión: $${formatMM(ctx.raw)} MM CLP (${((ctx.raw / (totalCost || 1)) * 100).toFixed(1)}%)`
                        }
                    }
                }
            }
        });
    }

    // Render custom HTML legend
    const legendEl = document.getElementById('mopServicioCostChartLegend');
    if (legendEl) {
        legendEl.innerHTML = data.map((d, idx) => {
            const cost = d.total;
            const pct = totalCost > 0 ? ((cost / totalCost) * 100).toFixed(1).replace(/\.0$/, '') : '0';
            const col = colors[idx];
            const sName = shortServiceName(d.label);
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.69rem; padding:0.1rem 0; color:var(--text-primary);">
                    <div style="display:flex; align-items:center; gap:0.35rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-primary); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sName}</span>
                    </div>
                    <span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                        ${pct}%
                    </span>
                </div>
            `;
        }).join('');
    }
}

// ── 2. Inversión: Top 10 Programas (barras horizontales) ──────────────────
function renderProgramaInversionBar() {
    const id = 'chart-programa-inversion';
    const canvas = document.getElementById(id);
    if (!canvas) return;
    clearEmpty(canvas);

    const data = aggregateBy('programa', 'cost_mm')
        .sort((a,b) => b.total - a.total)
        .slice(0, 10);
    if (!data.length) {
        destroyChart(id);
        showEmpty(canvas);
        return;
    }

    const totalCost = filteredProjects.reduce((s, p) => s + (p.cost_mm || 0), 0);
    const pct = (v) => ((v / (totalCost || 1)) * 100).toFixed(1);

    upsertChart(id, canvas, {
        type: 'bar',
        plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
        data: {
            labels: data.map(d => CatlecUtils.wrapTextToLines(d.label, 22, 2)),
            datasets: [{
                label: 'Inversión (MM CLP)',
                data: data.map(d => +d.total.toFixed(1)),
                backgroundColor: MOP_COLORS.petrolAlpha,
                borderColor: MOP_COLORS.petrol,
                borderWidth: 1,
                borderRadius: 3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            animation: { duration: 450, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                horizontalBarDataLabelsPlugin: {
                    formatter: (v) => `${Number(v).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${pct(v)}%)`
                },
                tooltip: {
                    enabled: false,
                    external: mopExternalTooltip,
                    callbacks: {
                        title: (items) => (items.length && data[items[0].dataIndex] ? data[items[0].dataIndex].label : ''),
                        label: (ctx) => ` Inversión: ${mopMoney(ctx.raw)} (${pct(ctx.raw)}% del total filtrado)`,
                        afterBody: (items) => {
                            const d = data[items[0].dataIndex];
                            return d ? [`${d.count} proyecto${d.count !== 1 ? 's' : ''}`] : [];
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: mopAxisTitle('Inversión (Millones CLP)'),
                    grid: { color: gridColor() },
                    ticks: { ...MOP_AXIS_TICKS, callback: v => v.toLocaleString('es-CL') }
                },
                y: { grid: { display: false }, ticks: { ...MOP_AXIS_TICKS, autoSkip: false } }
            }
        }
    });
}

// ── 3. Inversión: composición por etapa de cada servicio (apilada 100%) ──
// En 100% porque Vialidad concentra ~75% del monto y en valores absolutos
// aplastaría al resto; el monto de cada servicio ya está en el donut lateral.
function renderServicioEtapaStacked() {
    const id = 'chart-servicio-etapa';
    const canvas = document.getElementById(id);
    if (!canvas) return;
    clearEmpty(canvas);

    const servicios = aggregateBy('servicio', 'cost_mm').filter(s => s.total > 0).sort((a, b) => b.total - a.total);
    if (!servicios.length) {
        destroyChart(id);
        showEmpty(canvas);
        return;
    }

    const suma = (servicio, etapa) => filteredProjects
        .filter(p => p.servicio === servicio && (etapa ? p.etapa === etapa : !p.etapa))
        .reduce((s, p) => s + (p.cost_mm || 0), 0);

    const etapas = MOP_ETAPA_ORDER.map(e => ({ key: e, label: mopEtapaLabel(e), color: MOP_ETAPA_COLORS[e] }));
    etapas.push({ key: null, label: 'Sin etapa', color: MOP_COLORS.stone });
    const montos = etapas.map(e => servicios.map(s => suma(s.label, e.key)));

    upsertChart(id, canvas, {
        type: 'bar',
        plugins: [CatlecUtils.stackedBarDataLabelsPlugin],
        data: {
            labels: servicios.map(s => CatlecUtils.wrapText(shortServiceName(s.label), 12)),
            datasets: etapas.map((e, i) => ({
                label: e.label,
                data: servicios.map((s, j) => +((montos[i][j] / s.total) * 100).toFixed(1)),
                backgroundColor: e.color,
                borderColor: '#ffffff',
                borderWidth: 1,
                borderRadius: 2,
                maxBarThickness: 56,
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 450, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: mopExternalTooltip,
                    filter: (item) => item.raw > 0,
                    callbacks: {
                        title: (items) => (items.length ? servicios[items[0].dataIndex].label : ''),
                        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toLocaleString('es-CL')}% (${mopMoney(montos[ctx.datasetIndex][ctx.dataIndex])})`,
                        afterBody: (items) => (items.length ? [`Total del servicio: ${mopMoney(servicios[items[0].dataIndex].total)}`] : [])
                    }
                },
                stackedBarDataLabelsPlugin: {
                    formatter: (v) => `${Math.round(v)}%`,
                    minHeight: 14,
                    color: (dIdx) => (etapas[dIdx].key === 'PERFIL' ? MOP_COLORS.navy : '#ffffff')
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { ...MOP_AXIS_TICKS, maxRotation: 0 } },
                y: {
                    stacked: true,
                    min: 0,
                    max: 100,
                    title: mopAxisTitle('% de la inversión del servicio'),
                    grid: { color: gridColor() },
                    ticks: { ...MOP_AXIS_TICKS, stepSize: 25, callback: v => `${v}%` }
                }
            }
        }
    });
}

// ── 4. Inversión: Concentración por tramo de costo (Pareto) ───────────────
const MOP_COST_BINS = [
    { label: '> $100M', test: v => v > 100 },
    { label: '$20–100M', test: v => v > 20 && v <= 100 },
    { label: '$5–20M', test: v => v > 5 && v <= 20 },
    { label: '$1–5M', test: v => v > 1 && v <= 5 },
    { label: '≤ $1M', test: v => v > 0 && v <= 1 },
    { label: 'Sin costo', test: v => !v },
];

function renderConcentracion() {
    const id = 'chart-concentracion';
    const canvas = document.getElementById(id);
    if (!canvas) return;
    clearEmpty(canvas);

    if (!filteredProjects.length) {
        destroyChart(id);
        showEmpty(canvas);
        return;
    }

    const totalCost = filteredProjects.reduce((s, p) => s + (p.cost_mm || 0), 0);
    const tramos = MOP_COST_BINS.map(b => {
        const ps = filteredProjects.filter(p => b.test(p.cost_mm || 0));
        return { label: b.label, count: ps.length, total: ps.reduce((s, p) => s + (p.cost_mm || 0), 0) };
    });
    let acum = 0;
    const acumPct = tramos.map(t => {
        acum += t.total;
        return totalCost > 0 ? +((acum / totalCost) * 100).toFixed(1) : 0;
    });
    const counts = tramos.map(t => t.count);

    upsertChart(id, canvas, {
        type: 'bar',
        plugins: [CatlecUtils.groupedBarDataLabelsPlugin, CatlecUtils.lineDataLabelsPlugin],
        data: {
            labels: tramos.map(t => t.label),
            datasets: [
                {
                    type: 'bar',
                    label: 'Nº Proyectos',
                    data: counts,
                    backgroundColor: MOP_COLORS.blueAlpha,
                    borderColor: MOP_COLORS.blue,
                    borderWidth: 1,
                    borderRadius: 3,
                    yAxisID: 'y',
                    order: 2,
                },
                {
                    type: 'line',
                    label: '% acumulado de la inversión',
                    data: acumPct,
                    borderColor: MOP_COLORS.orange,
                    backgroundColor: MOP_COLORS.orange,
                    borderWidth: 2.2,
                    tension: 0.2,
                    pointRadius: 3.5,
                    pointHoverRadius: 5.5,
                    pointBackgroundColor: MOP_COLORS.orange,
                    fill: false,
                    yAxisID: 'y1',
                    order: 1,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 450, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: mopExternalTooltip,
                    callbacks: {
                        title: (items) => (items.length ? `Tramo de costo: ${items[0].label}` : ''),
                        label: (ctx) => (ctx.datasetIndex === 0
                            ? ` Proyectos: ${ctx.raw}`
                            : ` Inversión acumulada: ${ctx.raw.toLocaleString('es-CL')}%`),
                        afterBody: (items) => (items.length ? [`Inversión del tramo: ${mopMoney(tramos[items[0].dataIndex].total)}`] : [])
                    }
                },
                groupedBarDataLabelsPlugin: {
                    formatter: (v) => String(v),
                    color: MOP_COLORS.blue,
                    offset: 4
                },
                lineDataLabelsPlugin: {
                    formatter: (v) => `${Math.round(v)}%`,
                    color: MOP_COLORS.orange
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: MOP_AXIS_TICKS },
                y: {
                    type: 'linear',
                    position: 'left',
                    suggestedMax: Math.max(...counts, 0) * 1.2,
                    title: mopAxisTitle('Nº Proyectos'),
                    grid: { color: gridColor() },
                    ticks: MOP_AXIS_TICKS
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    min: 0,
                    max: 115,
                    grid: { drawOnChartArea: false },
                    title: mopAxisTitle('% acumulado', MOP_COLORS.orange),
                    ticks: { ...MOP_AXIS_TICKS, color: MOP_COLORS.orange, stepSize: 25, callback: v => (v <= 100 ? `${v}%` : '') }
                }
            }
        }
    });
}

// ── 5. Programas: Evolución por año de primera postulación (combo) ─────────
function renderYearLine() {
    const id = 'year';
    const canvas = document.getElementById('chart-year');
    if (!canvas) return;
    clearEmpty(canvas);

    const map = {};
    filteredProjects.forEach(p => {
        if (!p.year) return;
        if (!map[p.year]) map[p.year] = { count: 0, total: 0 };
        map[p.year].count++;
        map[p.year].total += (p.cost_mm || 0);
    });
    const years = Object.keys(map).map(Number).sort((a,b) => a-b);
    if (!years.length) {
        destroyChart(id);
        showEmpty(canvas);
        return;
    }

    const countValues = years.map(y => map[y].count);
    const costValues = years.map(y => +map[y].total.toFixed(1));

    upsertChart(id, canvas, {
        type: 'bar',
        plugins: [CatlecUtils.groupedBarDataLabelsPlugin],
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Nº Proyectos',
                    data: countValues,
                    backgroundColor: MOP_COLORS.blueAlpha,
                    borderColor: MOP_COLORS.blue,
                    borderWidth: 1,
                    borderRadius: 3,
                    yAxisID: 'y',
                    order: 2,
                },
                {
                    label: 'Inversión (MM CLP)',
                    data: costValues,
                    type: 'line',
                    borderColor: MOP_COLORS.orange,
                    backgroundColor: MOP_COLORS.orange,
                    borderWidth: 2.2,
                    pointRadius: 3.5,
                    pointHoverRadius: 5.5,
                    pointBackgroundColor: MOP_COLORS.orange,
                    fill: false,
                    tension: 0.2,
                    yAxisID: 'y2',
                    order: 1,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 450, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: mopExternalTooltip,
                    callbacks: {
                        title: (items) => items.length ? `Año ${items[0].label}` : '',
                        label: (ctx) => (ctx.datasetIndex === 0 ? ` Proyectos: ${ctx.raw}` : ` Inversión: ${mopMoney(ctx.raw)}`)
                    }
                },
                groupedBarDataLabelsPlugin: {
                    formatter: (v) => String(v),
                    color: MOP_COLORS.blue,
                    offset: 4
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: MOP_AXIS_TICKS },
                y: {
                    type: 'linear',
                    position: 'left',
                    suggestedMax: Math.max(...countValues, 0) * 1.18,
                    title: mopAxisTitle('Nº Proyectos'),
                    grid: { color: gridColor() },
                    ticks: MOP_AXIS_TICKS
                },
                y2: {
                    type: 'linear',
                    position: 'right',
                    title: mopAxisTitle('Inversión (MM CLP)', MOP_COLORS.orange),
                    grid: { drawOnChartArea: false },
                    ticks: { ...MOP_AXIS_TICKS, color: MOP_COLORS.orange, callback: v => `$${v.toLocaleString('es-CL')}M` }
                }
            }
        }
    });
}

// ── 6. Programas: Cartera activa por año (área + línea punteada) ──────────
function renderCarteraActiva() {
    const id = 'chart-cartera-activa';
    const canvas = document.getElementById(id);
    if (!canvas) return;
    clearEmpty(canvas);

    const conAnio = filteredProjects.filter(p => p.year);
    if (!conAnio.length) {
        destroyChart(id);
        showEmpty(canvas);
        return;
    }
    const sinAnio = filteredProjects.length - conAnio.length;
    const desde = Math.min(...conAnio.map(p => p.year));
    const hasta = Math.max(...conAnio.map(p => p.year_ult || p.year));
    const years = [];
    for (let y = desde; y <= hasta; y++) years.push(y);

    const activos = years.map(y => conAnio.filter(p => p.year <= y && y <= (p.year_ult || p.year)));
    const counts = activos.map(ps => ps.length);
    const montos = activos.map(ps => +ps.reduce((s, p) => s + (p.cost_mm || 0), 0).toFixed(1));

    upsertChart(id, canvas, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Proyectos activos',
                    data: counts,
                    borderColor: MOP_COLORS.petrol,
                    backgroundColor: 'rgba(30, 79, 101, 0.16)',
                    fill: 'origin',
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: 0,
                    pointHoverRadius: 4.5,
                    pointBackgroundColor: MOP_COLORS.petrol,
                    yAxisID: 'y',
                    order: 2,
                },
                {
                    label: 'Inversión activa',
                    data: montos,
                    borderColor: MOP_COLORS.orange,
                    backgroundColor: MOP_COLORS.orange,
                    borderDash: [5, 4],
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointBackgroundColor: MOP_COLORS.orange,
                    fill: false,
                    yAxisID: 'y1',
                    order: 1,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 450, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: mopExternalTooltip,
                    callbacks: {
                        title: (items) => (items.length ? `Año ${items[0].label}` : ''),
                        label: (ctx) => (ctx.datasetIndex === 0 ? ` Proyectos activos: ${ctx.raw}` : ` Inversión activa: ${mopMoney(ctx.raw)}`),
                        afterBody: () => (sinAnio > 0 ? [`Excluye ${sinAnio} proyecto${sinAnio !== 1 ? 's' : ''} sin año registrado`] : [])
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { ...MOP_AXIS_TICKS, maxRotation: 0, autoSkipPadding: 8 } },
                y: {
                    beginAtZero: true,
                    title: mopAxisTitle('Nº Proyectos'),
                    grid: { color: gridColor() },
                    ticks: MOP_AXIS_TICKS
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: mopAxisTitle('Inversión (MM CLP)', MOP_COLORS.orange),
                    ticks: { ...MOP_AXIS_TICKS, color: MOP_COLORS.orange, callback: v => `$${v.toLocaleString('es-CL')}M` }
                }
            }
        }
    });
}

// ── 7. Programas: Pipeline por etapa (horizontal en orden de madurez) ─────
function renderPipelineEtapa() {
    const id = 'chart-pipeline-etapa';
    const canvas = document.getElementById(id);
    if (!canvas) return;
    clearEmpty(canvas);

    const agg = aggregateBy('etapa', 'cost_mm');
    const porEtapa = MOP_ETAPA_ORDER.map(e => agg.find(a => a.label === e) || { label: e, count: 0, total: 0 });
    const totalProjects = porEtapa.reduce((s, d) => s + d.count, 0);
    if (!totalProjects) {
        destroyChart(id);
        showEmpty(canvas);
        return;
    }
    const pct = (v) => ((v / (totalProjects || 1)) * 100).toFixed(1);

    upsertChart(id, canvas, {
        type: 'bar',
        plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
        data: {
            labels: porEtapa.map(d => mopEtapaLabel(d.label)),
            datasets: [{
                label: 'Nº Proyectos',
                data: porEtapa.map(d => d.count),
                backgroundColor: porEtapa.map(d => MOP_ETAPA_COLORS[d.label]),
                borderColor: porEtapa.map(d => MOP_ETAPA_COLORS[d.label]),
                borderWidth: 1,
                borderRadius: 3,
                maxBarThickness: 34,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            animation: { duration: 450, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                horizontalBarDataLabelsPlugin: {
                    formatter: (v) => `${v} (${pct(v)}%)`,
                    insideColor: (v, dIdx, idx) => (porEtapa[idx].label === 'PERFIL' ? MOP_COLORS.navy : '#ffffff')
                },
                tooltip: {
                    enabled: false,
                    external: mopExternalTooltip,
                    callbacks: {
                        title: (items) => (items.length ? `Etapa: ${items[0].label}` : ''),
                        label: (ctx) => ` Cantidad: ${ctx.raw} proyecto${ctx.raw !== 1 ? 's' : ''} (${pct(ctx.raw)}%)`,
                        afterBody: (items) => (items.length ? [`Inversión: ${mopMoney(porEtapa[items[0].dataIndex].total)}`] : [])
                    }
                }
            },
            scales: {
                x: {
                    title: mopAxisTitle('Nº Proyectos'),
                    grid: { color: gridColor() },
                    ticks: MOP_AXIS_TICKS
                },
                y: { grid: { display: false }, ticks: { ...MOP_AXIS_TICKS, autoSkip: false } }
            }
        }
    });
}
