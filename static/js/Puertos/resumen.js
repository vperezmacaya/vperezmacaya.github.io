/**
 * Visualización: Resumen de Carga (Vista 1) — layout "Tendencia"
 */
function renderVistaResumen() {
    const data = window.PUERTOS_DATA;
    if (!data || !data.annual_aggregates || !data.series) return;

    const agg = data.annual_aggregates;
    const years = agg.map(d => d.anio.toString());
    const serie = data.series.carga_total || [];

    // A. Carga total mensual (área) + promedio móvil de 12 meses
    const c1 = document.getElementById('chart-carga-mensual');
    if (c1 && serie.length) {
        destroyChart('chart-carga-mensual');
        const labels = serie.map(r => `${MESES_CORTOS[r.mes - 1]} ${r.anio}`);
        const valores = serie.map(r => roundNumber(r.total / 1e6, 2));
        const media = movingAverage(valores, 12).map(v => (v === null ? null : roundNumber(v, 2)));

        const badge = document.getElementById('puertos-carga-periodo');
        if (badge) badge.textContent = `${labels[0]} – ${labels[labels.length - 1]}`;

        chartInstances['chart-carga-mensual'] = new Chart(c1.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Carga mensual',
                        data: valores,
                        borderColor: COLORS.ocean,
                        backgroundColor: hexToRgba(COLORS.ocean, 0.14),
                        fill: 'origin',
                        borderWidth: 1.8,
                        tension: 0.25,
                        pointRadius: 0,
                        pointHoverRadius: 4.5,
                        pointBackgroundColor: COLORS.ocean,
                        order: 2
                    },
                    {
                        label: 'Promedio móvil 12 meses',
                        data: media,
                        borderColor: COLORS.sand,
                        borderDash: [5, 4],
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointBackgroundColor: COLORS.sand,
                        fill: false,
                        order: 1
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
                        external: puertosExternalTooltip,
                        filter: (item) => item.raw !== null,
                        callbacks: {
                            title: (items) => items[0].label,
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw, 2)} MM Ton`,
                            afterBody: (items) => {
                                const r = serie[items[0].dataIndex];
                                return r && r.var_12m !== undefined ? [`Var. 12 meses (INE): ${r.var_12m > 0 ? '+' : ''}${formatNumber(r.var_12m, 1)}%`] : [];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: (ctx) => (serie[ctx.index] && serie[ctx.index].mes === 1 ? COLORS.grid : 'transparent'),
                            drawTicks: false
                        },
                        ticks: {
                            ...AXIS_TICKS,
                            autoSkip: false,
                            maxRotation: 0,
                            padding: 6,
                            callback: (val, idx) => (serie[idx] && serie[idx].mes === 1 ? serie[idx].anio : '')
                        }
                    },
                    y: {
                        beginAtZero: true,
                        suggestedMax: Math.max(...valores, 0) * 1.1,
                        grid: { color: COLORS.grid },
                        ticks: AXIS_TICKS,
                        title: axisTitle('MM Toneladas / Mes')
                    }
                }
            }
        });
    }

    // B. Carga anual apilada por tipo de flujo (el total va en el tooltip)
    const c2 = document.getElementById('chart-carga-flujos');
    if (c2) {
        destroyChart('chart-carga-flujos');
        const flujos = [
            { label: 'Embarcada Ext.', key: 'carga_embarcada_ext', color: COLORS.ocean, alpha: COLORS.oceanAlpha },
            { label: 'Desembarcada Ext.', key: 'carga_desembarcada_ext', color: COLORS.navy, alpha: COLORS.navyAlpha },
            { label: 'Cabotaje', key: 'carga_cabotaje', color: COLORS.teal, alpha: COLORS.tealAlpha },
            { label: 'Re-estibas/Transb.', key: 'carga_reestibas_transbordos', color: COLORS.sand, alpha: COLORS.sandAlpha },
            { label: 'Tránsito', key: 'carga_transito', color: COLORS.coral, alpha: COLORS.coralAlpha }
        ];

        chartInstances['chart-carga-flujos'] = new Chart(c2.getContext('2d'), {
            type: 'bar',
            plugins: [CatlecUtils.stackedBarDataLabelsPlugin],
            data: {
                labels: years,
                datasets: flujos.map(f => ({
                    label: f.label,
                    data: agg.map(d => roundNumber(d[f.key] / 1e6, 2)),
                    backgroundColor: f.alpha,
                    borderColor: f.color,
                    borderWidth: 1,
                    borderRadius: 2
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
                        external: puertosExternalTooltip,
                        callbacks: {
                            title: (items) => `Año ${items[0].label}`,
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw, 2)} MM Ton`,
                            afterBody: (items) => [`Total: ${formatNumber(agg[items[0].dataIndex].carga_total / 1e6, 2)} MM Ton`]
                        }
                    },
                    stackedBarDataLabelsPlugin: {
                        formatter: (v) => Number(v).toFixed(1),
                        minHeight: 14
                    }
                },
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: AXIS_TICKS },
                    y: { stacked: true, grid: { color: COLORS.grid }, ticks: AXIS_TICKS, title: axisTitle('MM Toneladas') }
                }
            }
        });
    }

    // C. Perfil estacional: último año vs promedio de los años completos anteriores
    const c3 = document.getElementById('chart-carga-estacionalidad');
    const ult = getUltimoRegistro();
    if (c3 && ult && serie.length) {
        destroyChart('chart-carga-estacionalidad');
        const porAnio = groupSeriesByYear(serie, 'total');
        const aniosPrevios = Object.keys(porAnio)
            .map(Number)
            .filter(a => a < ult.anio && porAnio[a].every(v => v !== null));
        const actual = (porAnio[ult.anio] || []).map(v => (v === null ? null : roundNumber(v / 1e6, 2)));
        const promedio = MESES_CORTOS.map((_, m) => {
            if (!aniosPrevios.length) return null;
            const s = aniosPrevios.reduce((acc, a) => acc + porAnio[a][m], 0);
            return roundNumber(s / aniosPrevios.length / 1e6, 2);
        });
        const rango = aniosPrevios.length ? `${Math.min(...aniosPrevios)}–${Math.max(...aniosPrevios)}` : '';

        const legUlt = document.getElementById('leg-estac-ultimo');
        if (legUlt) legUlt.textContent = ult.anio;
        const legProm = document.getElementById('leg-estac-prom');
        if (legProm) legProm.textContent = `Promedio ${rango}`;

        const valoresC = [...actual, ...promedio].filter(v => v !== null);

        chartInstances['chart-carga-estacionalidad'] = new Chart(c3.getContext('2d'), {
            type: 'line',
            plugins: [CatlecUtils.lineDataLabelsPlugin],
            data: {
                labels: MESES_CORTOS,
                datasets: [
                    {
                        label: `${ult.anio}`,
                        data: actual,
                        borderColor: COLORS.ocean,
                        backgroundColor: COLORS.ocean,
                        borderWidth: 2.2,
                        tension: 0.2,
                        pointRadius: 3.5,
                        pointHoverRadius: 5.5,
                        pointBackgroundColor: COLORS.ocean,
                        fill: false,
                        order: 1
                    },
                    {
                        label: `Promedio ${rango}`,
                        data: promedio,
                        borderColor: COLORS.steel,
                        backgroundColor: COLORS.steel,
                        borderDash: [5, 4],
                        borderWidth: 1.8,
                        tension: 0.2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointBackgroundColor: COLORS.steel,
                        fill: false,
                        order: 2
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
                        external: puertosExternalTooltip,
                        filter: (item) => item.raw !== null,
                        callbacks: {
                            title: (items) => `Mes: ${items[0].label}`,
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw, 2)} MM Ton`
                        }
                    },
                    lineDataLabelsPlugin: {
                        formatter: (v, dIdx) => (dIdx === 0 ? Number(v).toFixed(1) : ''),
                        color: COLORS.ocean
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: AXIS_TICKS },
                    y: {
                        suggestedMin: Math.min(...valoresC) * 0.85,
                        suggestedMax: Math.max(...valoresC) * 1.12,
                        grid: { color: COLORS.grid },
                        ticks: AXIS_TICKS,
                        title: axisTitle('MM Toneladas / Mes')
                    }
                }
            }
        });
    }
}
