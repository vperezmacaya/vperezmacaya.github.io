/**
 * static/js/MOP/map.js
 * Vista "Mapa regional": mapa coroplético de las 16 regiones (CatlecChoropleth,
 * el mismo mapa D3 de SNI) y ranking Chart.js (estándar catlec-bar-chart). Ambos
 * reflejan los filtros activos del panel izquierdo; el hover en el mapa resalta
 * la barra de la región.
 * Requiere: d3 v7, static/js/common/choropleth.js, SNI_REGIONS_DATA,
 * static/js/MOP/state.js, utils.js, charts.js
 */

const mopMillones = (v) => `$${Math.round(v).toLocaleString('es-CL')}M`;

const MOP_MAP_METRICS = {
    total: {
        title: 'Inversión por Región (Millones CLP)',
        axis: 'Inversión (Millones CLP)',
        value: (r) => r.total,
        fmt: mopMillones,
    },
    count: {
        title: 'Número de Proyectos por Región',
        axis: 'Nº Proyectos',
        value: (r) => r.count,
        fmt: (v) => `${Number(v).toLocaleString('es-CL', { maximumFractionDigits: 1 })} proy.`,
    },
    avg: {
        title: 'Inversión Promedio por Proyecto (Millones CLP)',
        axis: 'Millones CLP por proyecto',
        value: (r) => (r.count ? r.total / r.count : 0),
        fmt: (v) => `$${v.toLocaleString('es-CL', { maximumFractionDigits: 1 })}M`,
    },
};

let mopChoropleth = null;
let mopMapTooltipEl = null;
let mopMapStatsByCode = {};
let mopRankingOrder = [];

// ── Datos por región ──────────────────────────────────────────────────────
function getMopRegionStats() {
    const stats = {};
    Object.entries(MOP_REGION_CODES).forEach(([region, code]) => {
        stats[region] = { region, code, count: 0, total: 0 };
    });
    filteredProjects.forEach(p => {
        const s = stats[p.region];
        if (!s) return;
        s.count++;
        s.total += p.cost_mm || 0;
    });
    const metric = MOP_MAP_METRICS[selectedMapMetric];
    return Object.values(stats).map(s => ({ ...s, value: metric.value(s) }));
}

// Cortes por cuantiles: cada clase agrupa una cantidad similar de regiones
function getMopChoroBreaks(values) {
    const v = values.filter(x => x > 0).sort((a, b) => a - b);
    if (!v.length) return [];
    const k = MOP_CHORO_SCALE.length;
    return Array.from({ length: k - 1 }, (_, i) => v[Math.min(v.length - 1, Math.floor(((i + 1) / k) * v.length))]);
}

function getMopChoroClass(value, breaks) {
    return breaks.filter(b => value >= b).length;
}

function getMopChoroplethColor(value, breaks) {
    if (!value) return MOP_CHORO_EMPTY;
    return MOP_CHORO_SCALE[getMopChoroClass(value, breaks)];
}

// ── Mapa ──────────────────────────────────────────────────────────────────
function initMOPMap() {
    if (mopChoropleth || !window.SNI_REGIONS_DATA) return;
    mopMapTooltipEl = document.getElementById('mop-map-tooltip');

    mopChoropleth = CatlecChoropleth.create('mop-map', {
        features: window.SNI_REGIONS_DATA.features,
        onEnter: (event, f) => {
            syncMopRankingHover(f.properties.codregion);
            showMopMapTooltip(event, f.properties.codregion);
        },
        onMove: (event) => CatlecChoropleth.positionTooltip(mopMapTooltipEl, event),
        onLeave: () => {
            syncMopRankingHover(null);
            hideMopMapTooltip();
        },
        onDraw: () => updateMOPMap()
    });
    if (mopChoropleth) mopChoropleth.redraw();
}

function showMopMapTooltip(event, code) {
    const s = mopMapStatsByCode[code];
    if (!mopMapTooltipEl || !s) return;
    const metric = MOP_MAP_METRICS[selectedMapMetric];
    const totalPais = Object.values(mopMapStatsByCode).reduce((acc, r) => acc + r.total, 0);
    const pct = totalPais > 0 ? ((s.total / totalPais) * 100).toFixed(1) : '0';
    mopMapTooltipEl.innerHTML = `
        <strong>${s.region}</strong>
        <span style="color:#2ea3f2;font-weight:600;">${metric.axis}: ${metric.fmt(s.value)}</span>
        <span style="color:#94a3b8;">${s.count} proyecto${s.count !== 1 ? 's' : ''} · ${mopMillones(s.total)} (${pct}% de la inversión filtrada)</span>`;
    mopMapTooltipEl.classList.add('visible');
    CatlecChoropleth.positionTooltip(mopMapTooltipEl, event);
}

function hideMopMapTooltip() {
    if (mopMapTooltipEl) mopMapTooltipEl.classList.remove('visible');
}

// Hover en el mapa → resalta la barra de la región en el ranking
function syncMopRankingHover(code) {
    const chart = charts['chart-mapa-ranking'];
    if (!chart) return;
    const idx = mopRankingOrder.indexOf(code);
    chart.setActiveElements(idx >= 0 ? [{ datasetIndex: 0, index: idx }] : []);
    chart.update('none');
}

// ── Actualización (filtros, métrica) ─────────────────────────────────────
function updateMOPMap() {
    const metric = MOP_MAP_METRICS[selectedMapMetric];
    const stats = getMopRegionStats();
    const breaks = getMopChoroBreaks(stats.map(s => s.value));
    stats.forEach(s => { s.color = getMopChoroplethColor(s.value, breaks); });
    mopMapStatsByCode = Object.fromEntries(stats.map(s => [s.code, s]));

    if (mopChoropleth) {
        mopChoropleth.paths().attr('fill', f => (mopMapStatsByCode[f.properties.codregion] || {}).color || MOP_CHORO_EMPTY);
    }

    const title = document.getElementById('mop-map-ranking-title');
    if (title) title.textContent = metric.title;

    renderMopRanking(stats, metric);
    renderMopMapKpis(stats, metric);
}

function renderMopRanking(stats, metric) {
    const id = 'chart-mapa-ranking';
    const canvas = document.getElementById(id);
    if (!canvas) return;

    const sorted = [...stats].sort((a, b) => b.value - a.value);
    mopRankingOrder = sorted.map(s => s.code);
    const colors = sorted.map(s => (s.value ? s.color : MOP_CHORO_EMPTY));

    upsertChart(id, canvas, {
        type: 'bar',
        plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
        data: {
            labels: sorted.map(s => shortRegion(s.region)),
            datasets: [{
                label: metric.axis,
                data: sorted.map(s => +s.value.toFixed(2)),
                backgroundColor: colors,
                borderColor: colors,
                hoverBorderColor: colors,
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
                    formatter: (v) => metric.fmt(v),
                    // Texto oscuro dentro de las clases claras de la escala
                    insideColor: (v, dIdx, idx) => (MOP_CHORO_SCALE.indexOf(sorted[idx].color) <= 1 ? MOP_COLORS.navy : '#ffffff')
                },
                tooltip: {
                    enabled: false,
                    external: mopExternalTooltip,
                    callbacks: {
                        title: (items) => (items.length ? sorted[items[0].dataIndex].region : ''),
                        label: (ctx) => ` ${metric.axis}: ${metric.fmt(ctx.raw)}`,
                        afterBody: (items) => {
                            if (!items.length) return [];
                            const s = sorted[items[0].dataIndex];
                            return [`${s.count} proyecto${s.count !== 1 ? 's' : ''} · ${mopMillones(s.total)}`];
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    suggestedMax: Math.max(...sorted.map(s => s.value), 0) * 1.15,
                    title: mopAxisTitle(metric.axis),
                    grid: { color: gridColor() },
                    ticks: { ...MOP_AXIS_TICKS, callback: v => v.toLocaleString('es-CL') }
                },
                y: { grid: { display: false }, ticks: { ...MOP_AXIS_TICKS, autoSkip: false } }
            }
        }
    });
}

function renderMopMapKpis(stats, metric) {
    const conDatos = stats.filter(s => s.value > 0);
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = text; el.title = text; }
    };
    if (!conDatos.length) {
        ['mop-map-kpi-leader', 'mop-map-kpi-lowest', 'mop-map-kpi-avg'].forEach(id => set(id, '-'));
        return;
    }
    const lider = conDatos.reduce((a, b) => (b.value > a.value ? b : a));
    const menor = conDatos.reduce((a, b) => (b.value < a.value ? b : a));
    const promedio = conDatos.reduce((acc, s) => acc + s.value, 0) / conDatos.length;
    set('mop-map-kpi-leader', `${shortRegion(lider.region)} · ${metric.fmt(lider.value)}`);
    set('mop-map-kpi-lowest', `${shortRegion(menor.region)} · ${metric.fmt(menor.value)}`);
    set('mop-map-kpi-avg', metric.fmt(promedio));
}

// ── Selector de métrica ──────────────────────────────────────────────────
document.querySelectorAll('#mop-map-metric-toolbar .map-metric-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedMapMetric = btn.dataset.metric;
        document.querySelectorAll('#mop-map-metric-toolbar .map-metric-btn')
            .forEach(b => b.classList.toggle('active', b === btn));
        updateMOPMap();
    });
});
