/**
 * Visualización: Contenedores y TEUs (Vista 2) — layout 42/58
 */
function renderVistaContenedores() {
    const data = window.PUERTOS_DATA;
    if (!data || !data.annual_aggregates) return;

    const agg = data.annual_aggregates;
    const years = agg.map(d => d.anio.toString());
    const ult = getUltimoRegistro();

    // A. TEUs Totales (Barras simples)
    const c1 = document.getElementById('chart-teus-evolucion');
    if (c1) {
        destroyChart('chart-teus-evolucion');
        const teusK = agg.map(d => roundNumber(d.teus_total / 1e3, 1));

        chartInstances['chart-teus-evolucion'] = new Chart(c1.getContext('2d'), {
            type: 'bar',
            plugins: [CatlecUtils.groupedBarDataLabelsPlugin],
            data: {
                labels: years,
                datasets: [
                    {
                        type: 'bar',
                        label: 'TEUs Totales (Miles)',
                        data: teusK,
                        backgroundColor: COLORS.navyAlpha,
                        borderColor: COLORS.navy,
                        borderWidth: 1,
                        borderRadius: 3,
                        yAxisID: 'y',
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
                        callbacks: {
                            title: (items) => `Año ${items[0].label}`,
                            label: (ctx) => ` TEUs: ${formatNumber(ctx.raw * 1000)} TEUs`
                        }
                    },
                    groupedBarDataLabelsPlugin: {
                        formatter: (v) => Number(v).toFixed(1),
                        color: COLORS.navy,
                        offset: 4
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: AXIS_TICKS },
                    y: {
                        type: 'linear',
                        position: 'left',
                        suggestedMax: Math.max(...teusK, 0) * 1.18,
                        grid: { color: COLORS.grid },
                        ticks: AXIS_TICKS,
                        title: axisTitle('Miles de TEUs (kTEU)')
                    }
                }
            }
        });
    }

    // B. Donuts compactos del último año: estado de manejo y formato 40/20
    if (ult) {
        renderPieWithLegend('chart-contenedores-pie', 'chart-contenedores-pieLegend', [
            { label: 'Embarcados', value: ult.cont_embarcados_total, color: COLORS.navy },
            { label: 'Desembarcados', value: ult.cont_desembarcados_total, color: COLORS.ocean },
            { label: 'Cabotaje y Tránsito', value: ult.cont_cabotaje_transito_total, color: COLORS.teal },
            { label: 'Re-estibas', value: ult.cont_reestibas_total, color: COLORS.sand }
        ], (v) => formatMillion(v, 'Unid.'));

        renderPieWithLegend('chart-contenedores-formato-pie', 'chart-contenedores-formato-pieLegend', [
            { label: 'Contenedores 40 pies', value: ult.contenedores_40_unidades, color: COLORS.ocean },
            { label: 'Contenedores 20 pies', value: ult.contenedores_20_unidades, color: COLORS.sand }
        ], (v) => formatMillion(v, 'Unid.'));
    }

    // C. TEUs por mes: una línea por año (último año destacado)
    const c3 = document.getElementById('chart-teus-interanual');
    if (c3 && ult && data.series && data.series.teus) {
        destroyChart('chart-teus-interanual');
        const porAnio = groupSeriesByYear(data.series.teus, 'teus');
        const anios = Object.keys(porAnio).map(Number).sort((a, b) => a - b);

        const legUlt = document.getElementById('leg-teus-ultimo');
        if (legUlt) legUlt.textContent = ult.anio;

        const estilo = (anio) => {
            if (anio === ult.anio) return { color: COLORS.navy, width: 2.6, radius: 3.5, order: 1 };
            if (anio === ult.anio - 1) return { color: COLORS.ocean, width: 2, radius: 2.5, order: 2 };
            return { color: hexToRgba(COLORS.steel, 0.3), width: 1.2, radius: 0, order: 3 };
        };

        chartInstances['chart-teus-interanual'] = new Chart(c3.getContext('2d'), {
            type: 'line',
            data: {
                labels: MESES_CORTOS,
                datasets: anios.map(anio => {
                    const e = estilo(anio);
                    return {
                        label: `${anio}`,
                        data: porAnio[anio].map(v => (v === null ? null : roundNumber(v / 1e3, 1))),
                        borderColor: e.color,
                        backgroundColor: e.color,
                        borderWidth: e.width,
                        tension: 0.2,
                        pointRadius: e.radius,
                        pointHoverRadius: e.radius + 2,
                        pointBackgroundColor: e.color,
                        fill: false,
                        order: e.order
                    };
                })
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
                        itemSort: (a, b) => Number(b.dataset.label) - Number(a.dataset.label),
                        callbacks: {
                            title: (items) => `Mes: ${items[0].label}`,
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw * 1000)} TEUs`
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: AXIS_TICKS },
                    y: { grid: { color: COLORS.grid }, ticks: AXIS_TICKS, title: axisTitle('Miles de TEUs / Mes') }
                }
            }
        });
    }
}
