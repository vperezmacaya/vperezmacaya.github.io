/**
 * Visualización: Tipología de Carga (Vista 3) — layout "Comparativa"
 */
const PUERTOS_TIPOLOGIAS = [
    { label: 'Contenedores', key: 'contenedores', serieKey: 'contenedores', color: COLORS.navy },
    { label: 'Carga suelta', key: 'suelta', serieKey: 'suelta_general', color: COLORS.ocean },
    { label: 'Granel sólido', key: 'granel_solido', serieKey: 'granel_solido', color: COLORS.sand },
    { label: 'Granel líquido', key: 'granel_liquido', serieKey: 'granel_liquido_gaseoso', color: COLORS.teal }
];

function renderVistaTipologia() {
    const data = window.PUERTOS_DATA;
    if (!data || !data.annual_aggregates) return;

    const agg = data.annual_aggregates;
    const years = agg.map(d => d.anio.toString());
    const ult = getUltimoRegistro();
    const tipos = PUERTOS_TIPOLOGIAS;

    // A. Butterfly: embarque (izquierda, negativo) vs desembarque (derecha) del último año
    const c1 = document.getElementById('chart-tipologia-butterfly');
    if (c1 && ult) {
        destroyChart('chart-tipologia-butterfly');
        const emb = tipos.map(t => -roundNumber(ult[`emb_${t.key}`] / 1e6, 2));
        const des = tipos.map(t => roundNumber(ult[`des_${t.key}`] / 1e6, 2));
        const lim = Math.ceil(Math.max(...emb.map(Math.abs), ...des, 0.1) * 1.3);

        chartInstances['chart-tipologia-butterfly'] = new Chart(c1.getContext('2d'), {
            type: 'bar',
            plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
            data: {
                labels: tipos.map(t => t.label),
                datasets: [
                    { label: 'Embarque exterior', data: emb, backgroundColor: COLORS.oceanAlpha, borderColor: COLORS.ocean, borderWidth: 1, borderRadius: 3, maxBarThickness: 30 },
                    { label: 'Desembarque exterior', data: des, backgroundColor: COLORS.tealAlpha, borderColor: COLORS.teal, borderWidth: 1, borderRadius: 3, maxBarThickness: 30 }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 450, easing: 'easeOutQuart' },
                interaction: { mode: 'index', axis: 'y', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: puertosExternalTooltip,
                        callbacks: {
                            title: (items) => items[0].label,
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(Math.abs(ctx.raw), 2)} MM Ton`
                        }
                    },
                    horizontalBarDataLabelsPlugin: {
                        allDatasets: true,
                        allowNegative: true,
                        formatter: (v) => Math.abs(v).toFixed(2)
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        min: -lim,
                        max: lim,
                        grid: { color: (ctx) => (ctx.tick && ctx.tick.value === 0 ? '#94a3b8' : COLORS.grid) },
                        ticks: { ...AXIS_TICKS, callback: (v) => Math.abs(v).toFixed(1) },
                        title: axisTitle('MM Toneladas')
                    },
                    y: { stacked: true, grid: { display: false }, ticks: AXIS_TICKS }
                }
            }
        });
    }

    // B. Barras divergentes: variación vs año anterior (mismo período si el año es parcial)
    const c2 = document.getElementById('chart-tipologia-variacion');
    const serieEmb = data.series && data.series.embarcada;
    const serieDes = data.series && data.series.desembarcada;
    if (c2 && ult && serieEmb && serieDes && agg.some(d => d.anio === ult.anio - 1)) {
        destroyChart('chart-tipologia-variacion');
        const hasta = ult.meses_registrados || 12;
        const suma = (anio, campo) => sumSerieHastaMes(serieEmb, anio, hasta, campo) + sumSerieHastaMes(serieDes, anio, hasta, campo);
        const filas = [
            ...tipos.map(t => ({ label: t.label, act: suma(ult.anio, t.serieKey), prev: suma(ult.anio - 1, t.serieKey) })),
            { label: 'Total exterior', act: suma(ult.anio, 'total'), prev: suma(ult.anio - 1, 'total') }
        ];
        const pcts = filas.map(f => (f.prev > 0 ? roundNumber(((f.act - f.prev) / f.prev) * 100, 1) : null));
        const lim = Math.ceil((Math.max(...pcts.filter(v => v !== null).map(Math.abs), 5) * 1.35) / 10) * 10;

        const badge = document.getElementById('puertos-tipologia-var-periodo');
        if (badge) {
            const periodo = hasta < 12 ? ` · Ene–${MESES_CORTOS[hasta - 1]}` : '';
            badge.textContent = `${ult.anio} vs ${ult.anio - 1}${periodo}`;
        }

        chartInstances['chart-tipologia-variacion'] = new Chart(c2.getContext('2d'), {
            type: 'bar',
            plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
            data: {
                labels: filas.map(f => f.label),
                datasets: [{
                    label: 'Variación',
                    data: pcts,
                    backgroundColor: pcts.map(v => (v >= 0 ? COLORS.tealAlpha : COLORS.buoyAlpha)),
                    borderColor: pcts.map(v => (v >= 0 ? COLORS.teal : COLORS.buoy)),
                    borderWidth: 1,
                    borderRadius: 3,
                    maxBarThickness: 22
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 450, easing: 'easeOutQuart' },
                interaction: { mode: 'index', axis: 'y', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: puertosExternalTooltip,
                        filter: (item) => item.raw !== null,
                        callbacks: {
                            title: (items) => items[0].label,
                            label: (ctx) => ` Variación: ${ctx.raw > 0 ? '+' : ''}${formatNumber(ctx.raw, 1)}%`,
                            afterBody: (items) => {
                                const f = filas[items[0].dataIndex];
                                return [`${ult.anio}: ${formatMillion(f.act, 'Ton')}`, `${ult.anio - 1}: ${formatMillion(f.prev, 'Ton')}`];
                            }
                        }
                    },
                    horizontalBarDataLabelsPlugin: {
                        allowNegative: true,
                        formatter: (v) => `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}%`,
                        outsideColor: (v) => (v >= 0 ? COLORS.teal : COLORS.buoy)
                    }
                },
                scales: {
                    x: {
                        min: -lim,
                        max: lim,
                        grid: { color: (ctx) => (ctx.tick && ctx.tick.value === 0 ? '#94a3b8' : COLORS.grid) },
                        ticks: { ...AXIS_TICKS, callback: (v) => `${Math.round(v)}%` }
                    },
                    y: { grid: { display: false }, ticks: AXIS_TICKS }
                }
            }
        });
    }

    // C. Barras apiladas agrupadas: embarque y desembarque por tipología y año
    const c3 = document.getElementById('chart-tipologia-evolucion');
    if (c3) {
        destroyChart('chart-tipologia-evolucion');
        const datasets = [];
        [['emb', 'Embarque', 0.85, 1], ['des', 'Desembarque', 0.35, 0.75]].forEach(([pref, nombre, aFill, aBorder]) => {
            tipos.forEach(t => {
                datasets.push({
                    label: `${nombre} · ${t.label}`,
                    stack: pref,
                    data: agg.map(d => roundNumber(d[`${pref}_${t.key}`] / 1e6, 2)),
                    backgroundColor: hexToRgba(t.color, aFill),
                    borderColor: hexToRgba(t.color, aBorder),
                    borderWidth: 1,
                    borderRadius: 2
                });
            });
        });

        const totalStack = (idx, pref) => tipos.reduce((s, t) => s + agg[idx][`${pref}_${t.key}`], 0);

        chartInstances['chart-tipologia-evolucion'] = new Chart(c3.getContext('2d'), {
            type: 'bar',
            data: { labels: years, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 450, easing: 'easeOutQuart' },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: puertosExternalTooltip,
                        filter: (item) => item.raw > 0,
                        callbacks: {
                            title: (items) => `Año ${items[0].label}`,
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw, 2)} MM Ton`,
                            afterBody: (items) => {
                                const i = items[0].dataIndex;
                                return [
                                    `Total embarque: ${formatNumber(totalStack(i, 'emb') / 1e6, 2)} MM Ton`,
                                    `Total desembarque: ${formatNumber(totalStack(i, 'des') / 1e6, 2)} MM Ton`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: AXIS_TICKS },
                    y: { stacked: true, grid: { color: COLORS.grid }, ticks: AXIS_TICKS, title: axisTitle('MM Toneladas') }
                }
            }
        });
    }
}
