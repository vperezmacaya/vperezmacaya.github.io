/**
 * Visualización: Contenedores y TEUs (Vista 2)
 */
function renderVistaContenedores() {
    const data = window.PUERTOS_DATA;
    if (!data || !data.annual_aggregates) return;

    const agg = data.annual_aggregates;
    const years = agg.map(d => d.anio.toString());

    // 1. Combo TEUs Totales vs Variación %
    const c1 = document.getElementById('chart-teus-evolucion');
    if (c1) {
        destroyChart('chart-teus-evolucion');
        const teusK = agg.map(d => roundNumber(d.teus_total / 1e3, 1));
        const varsPct = agg.map(d => d.var_anual_teus_pct);

        chartInstances['chart-teus-evolucion'] = new Chart(c1.getContext('2d'), {
            type: 'bar',
            data: {
                labels: years,
                datasets: [
                    {
                        type: 'bar',
                        label: 'TEUs Totales (Miles)',
                        data: teusK,
                        backgroundColor: COLORS.primaryAlpha,
                        borderColor: COLORS.primary,
                        borderWidth: 1,
                        borderRadius: 3,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        type: 'line',
                        label: 'Variación Anual (%)',
                        data: varsPct,
                        borderColor: COLORS.emerald,
                        backgroundColor: COLORS.emerald,
                        borderWidth: 2.2,
                        tension: 0,
                        pointRadius: 2.5,
                        pointHoverRadius: 4.5,
                        pointBackgroundColor: COLORS.emerald,
                        fill: false,
                        yAxisID: 'y1',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'nearest', intersect: true },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: puertosExternalTooltip,
                        callbacks: {
                            title: (items) => `Año ${items[0].label}`,
                            label: (ctx) => {
                                if (ctx.dataset.type === 'line') {
                                    return ` Variación: ${ctx.raw > 0 ? '+' : ''}${ctx.raw}%`;
                                }
                                return ` TEUs: ${formatNumber(ctx.raw * 1000)} TEUs`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        grid: { color: COLORS.grid },
                        ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                        title: { display: true, text: 'Miles de TEUs (kTEU)', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: COLORS.emerald,
                            font: { size: 10 },
                            callback: (v) => `${v}%`
                        },
                        title: { display: true, text: 'Var. Interanual (%)', color: COLORS.emerald, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }

    // 2. Comparativa Unidades 20ft vs 40ft
    const c2 = document.getElementById('chart-contenedores-comparativa');
    if (c2) {
        destroyChart('chart-contenedores-comparativa');
        chartInstances['chart-contenedores-comparativa'] = new Chart(c2.getContext('2d'), {
            type: 'bar',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Contenedores 40 pies',
                        data: agg.map(d => roundNumber(d.contenedores_40_unidades / 1e3, 1)),
                        backgroundColor: COLORS.skyAlpha,
                        borderColor: COLORS.sky,
                        borderWidth: 1,
                        borderRadius: 3
                    },
                    {
                        label: 'Contenedores 20 pies',
                        data: agg.map(d => roundNumber(d.contenedores_20_unidades / 1e3, 1)),
                        backgroundColor: COLORS.amberAlpha,
                        borderColor: COLORS.amber,
                        borderWidth: 1,
                        borderRadius: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'nearest', intersect: true },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: puertosExternalTooltip,
                        callbacks: {
                            title: (items) => `Año ${items[0].label}`,
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw * 1000)} Unidades`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                    },
                    y: {
                        grid: { color: COLORS.grid },
                        ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                        title: { display: true, text: 'Miles de Unidades', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }

    // 3. Estado de Manejo de Contenedores (Apilado)
    const c3 = document.getElementById('chart-contenedores-manejo');
    if (c3) {
        destroyChart('chart-contenedores-manejo');
        chartInstances['chart-contenedores-manejo'] = new Chart(c3.getContext('2d'), {
            type: 'bar',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Embarcados',
                        data: agg.map(d => roundNumber(d.cont_embarcados_total / 1e3, 1)),
                        backgroundColor: COLORS.primaryAlpha,
                        borderColor: COLORS.primary,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Desembarcados',
                        data: agg.map(d => roundNumber(d.cont_desembarcados_total / 1e3, 1)),
                        backgroundColor: COLORS.skyAlpha,
                        borderColor: COLORS.sky,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Cabotaje y Tránsito',
                        data: agg.map(d => roundNumber(d.cont_cabotaje_transito_total / 1e3, 1)),
                        backgroundColor: COLORS.emeraldAlpha,
                        borderColor: COLORS.emerald,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Re-estibas',
                        data: agg.map(d => roundNumber(d.cont_reestibas_total / 1e3, 1)),
                        backgroundColor: COLORS.amberAlpha,
                        borderColor: COLORS.amber,
                        borderWidth: 1,
                        borderRadius: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'nearest', intersect: true },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: puertosExternalTooltip,
                        callbacks: {
                            title: (items) => `Año ${items[0].label}`,
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw * 1000)} Unid.`
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                    },
                    y: {
                        stacked: true,
                        grid: { color: COLORS.grid },
                        ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                        title: { display: true, text: 'Miles de Contenedores', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }

    // 4. Doughnut Estado de Manipulación
    const totEmb = agg.reduce((s, d) => s + d.cont_embarcados_total, 0);
    const totDes = agg.reduce((s, d) => s + d.cont_desembarcados_total, 0);
    const totCabTr = agg.reduce((s, d) => s + d.cont_cabotaje_transito_total, 0);
    const totReest = agg.reduce((s, d) => s + d.cont_reestibas_total, 0);

    const pieManejo = [
        { label: 'Embarcados', value: totEmb, color: COLORS.primary },
        { label: 'Desembarcados', value: totDes, color: COLORS.sky },
        { label: 'Cabotaje y Tránsito', value: totCabTr, color: COLORS.emerald },
        { label: 'Re-estibas', value: totReest, color: COLORS.amber }
    ];
    renderPieWithLegend('chart-contenedores-pie', 'chart-contenedores-pieLegend', pieManejo, (v) => formatMillion(v, 'Unid.'));
}
