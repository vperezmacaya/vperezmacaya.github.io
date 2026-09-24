/**
 * Visualización: Resumen de Carga (Vista 1)
 */
function renderVistaResumen() {
    const data = window.PUERTOS_DATA;
    if (!data || !data.annual_aggregates) return;

    const agg = data.annual_aggregates;
    const years = agg.map(d => d.anio.toString());

    // 1. Combo Carga Total vs Variación %
    const c1 = document.getElementById('chart-carga-evolucion');
    if (c1) {
        destroyChart('chart-carga-evolucion');
        const tonsMM = agg.map(d => roundNumber(d.carga_total / 1e6, 2));
        const varsPct = agg.map(d => d.var_anual_carga_pct);

        chartInstances['chart-carga-evolucion'] = new Chart(c1.getContext('2d'), {
            type: 'bar',
            plugins: [CatlecUtils.groupedBarDataLabelsPlugin],
            data: {
                labels: years,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Carga Total (MM Ton)',
                        data: tonsMM,
                        backgroundColor: COLORS.skyAlpha,
                        borderColor: COLORS.sky,
                        borderWidth: 1,
                        borderRadius: 3,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        type: 'line',
                        label: 'Variación Anual (%)',
                        data: varsPct,
                        borderColor: COLORS.amber,
                        backgroundColor: COLORS.amber,
                        borderWidth: 2.2,
                        tension: 0.2,
                        pointRadius: 3.5,
                        pointHoverRadius: 5.5,
                        pointBackgroundColor: COLORS.amber,
                        fill: false,
                        yAxisID: 'y1',
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
                        callbacks: {
                            title: (items) => `Año ${items[0].label}`,
                            label: (ctx) => {
                                if (ctx.dataset.type === 'line') {
                                    return ` Variación: ${ctx.raw > 0 ? '+' : ''}${ctx.raw}%`;
                                }
                                return ` Carga Total: ${formatNumber(ctx.raw, 2)} MM Ton`;
                            }
                        }
                    },
                    groupedBarDataLabelsPlugin: {
                        formatter: (v) => Number(v).toFixed(2),
                        color: COLORS.sky,
                        offset: 4
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: COLORS.textPrimary, font: { size: 10, weight: '600' } }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        suggestedMax: Math.max(...tonsMM, 0) * 1.18,
                        grid: { color: COLORS.grid },
                        ticks: { color: COLORS.textPrimary, font: { size: 10, weight: '600' } },
                        title: { display: true, text: 'Millones de Toneladas (MM Ton)', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: COLORS.amber,
                            font: { size: 10, weight: '600' },
                            callback: (v) => `${v}%`
                        },
                        title: { display: true, text: 'Var. Interanual (%)', color: COLORS.amber, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }

    // 2. Barras Apiladas por Flujo de Carga
    const c2 = document.getElementById('chart-carga-flujos');
    if (c2) {
        destroyChart('chart-carga-flujos');
        chartInstances['chart-carga-flujos'] = new Chart(c2.getContext('2d'), {
            type: 'bar',
            plugins: [CatlecUtils.stackedBarDataLabelsPlugin],
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Embarcada Ext.',
                        data: agg.map(d => roundNumber(d.carga_embarcada_ext / 1e6, 2)),
                        backgroundColor: COLORS.skyAlpha,
                        borderColor: COLORS.sky,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Desembarcada Ext.',
                        data: agg.map(d => roundNumber(d.carga_desembarcada_ext / 1e6, 2)),
                        backgroundColor: COLORS.primaryAlpha,
                        borderColor: COLORS.primary,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Cabotaje',
                        data: agg.map(d => roundNumber(d.carga_cabotaje / 1e6, 2)),
                        backgroundColor: COLORS.emeraldAlpha,
                        borderColor: COLORS.emerald,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Re-estibas/Transb.',
                        data: agg.map(d => roundNumber(d.carga_reestibas_transbordos / 1e6, 2)),
                        backgroundColor: COLORS.amberAlpha,
                        borderColor: COLORS.amber,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Tránsito',
                        data: agg.map(d => roundNumber(d.carga_transito / 1e6, 2)),
                        backgroundColor: COLORS.purpleAlpha,
                        borderColor: COLORS.purple,
                        borderWidth: 1,
                        borderRadius: 2
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
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw, 2)} MM Ton`
                        }
                    },
                    stackedBarDataLabelsPlugin: {
                        formatter: (v) => Number(v).toFixed(2)
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { color: COLORS.textPrimary, font: { size: 10, weight: '600' } }
                    },
                    y: {
                        stacked: true,
                        grid: { color: COLORS.grid },
                        ticks: { color: COLORS.textPrimary, font: { size: 10, weight: '600' } },
                        title: { display: true, text: 'MM Toneladas', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }

    // 3. Doughnut Participación Operación Portuaria
    const k = data.kpis;
    const pieFlujos = [
        { label: 'Embarcada al Exterior', value: k.total_embarcada_exterior_ton, color: COLORS.sky },
        { label: 'Desembarcada del Exterior', value: k.total_desembarcada_exterior_ton, color: COLORS.primary },
        { label: 'Cabotaje', value: k.total_cabotaje_ton, color: COLORS.emerald },
        { label: 'Re-estibas y Transbordos', value: k.total_reestibas_transbordos_ton, color: COLORS.amber },
        { label: 'Tránsito Internacional', value: k.total_transito_ton, color: COLORS.purple }
    ];
    renderPieWithLegend('chart-carga-operacion-pie', 'chart-carga-operacion-pieLegend', pieFlujos);

    // 4. Estacionalidad Mensual
    const c4 = document.getElementById('chart-carga-estacionalidad');
    if (c4 && data.monthly_seasonality) {
        destroyChart('chart-carga-estacionalidad');
        const mLabels = data.monthly_seasonality.map(d => d.mes_nombre);
        const mData = data.monthly_seasonality.map(d => roundNumber(d.avg_carga_ton / 1e6, 2));

        chartInstances['chart-carga-estacionalidad'] = new Chart(c4.getContext('2d'), {
            type: 'bar',
            plugins: [CatlecUtils.groupedBarDataLabelsPlugin],
            data: {
                labels: mLabels,
                datasets: [{
                    label: 'Promedio Mensual (MM Ton)',
                    data: mData,
                    backgroundColor: COLORS.cyanAlpha,
                    borderColor: COLORS.cyan,
                    borderWidth: 1,
                    borderRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 450, easing: 'easeOutQuart' },
                interaction: { mode: 'nearest', intersect: true },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: puertosExternalTooltip,
                        callbacks: {
                            title: (items) => `Mes: ${items[0].label}`,
                            label: (ctx) => ` Promedio: ${formatNumber(ctx.raw, 2)} MM Ton`
                        }
                    },
                    groupedBarDataLabelsPlugin: {
                        formatter: (v) => Number(v).toFixed(2),
                        color: COLORS.cyan,
                        offset: 4
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: COLORS.textPrimary, font: { size: 10, weight: '600' } }
                    },
                    y: {
                        suggestedMax: Math.max(...mData, 0) * 1.18,
                        grid: { color: COLORS.grid },
                        ticks: { color: COLORS.textPrimary, font: { size: 10, weight: '600' } },
                        title: { display: true, text: 'MM Toneladas / Mes', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }
}
