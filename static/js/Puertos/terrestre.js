/**
 * Visualización: Conectividad Terrestre y Peajes (Vista 4)
 */
function renderVistaTerrestre() {
    const data = window.PUERTOS_DATA;
    if (!data || !data.annual_aggregates) return;

    const agg = data.annual_aggregates;
    const years = agg.map(d => d.anio.toString());

    // 1. Pasadas de Camiones por Peajes
    const c1 = document.getElementById('chart-peajes-evolucion');
    if (c1) {
        destroyChart('chart-peajes-evolucion');
        const data3ejes = agg.map(d => roundNumber(d.peaje_camiones_3mas_ejes / 1e6, 2));
        const data2ejes = agg.map(d => roundNumber(d.peaje_camiones_2ejes / 1e6, 2));
        chartInstances['chart-peajes-evolucion'] = new Chart(c1.getContext('2d'), {
            type: 'bar',
            plugins: [CatlecUtils.groupedBarDataLabelsPlugin],
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Camiones 3 y más ejes',
                        data: data3ejes,
                        backgroundColor: COLORS.primaryAlpha,
                        borderColor: COLORS.primary,
                        borderWidth: 1,
                        borderRadius: 3
                    },
                    {
                        label: 'Camiones 2 ejes',
                        data: data2ejes,
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
                animation: { duration: 450, easing: 'easeOutQuart' },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: puertosExternalTooltip,
                        callbacks: {
                            title: (items) => `Año ${items[0].label}`,
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw, 2)} MM Pasadas`
                        }
                    },
                    groupedBarDataLabelsPlugin: {
                        formatter: (v) => Number(v).toFixed(1),
                        color: (dIdx) => dIdx === 0 ? COLORS.primary : COLORS.amber,
                        offset: 4
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: COLORS.textPrimary, font: { size: 10, weight: '600' } }
                    },
                    y: {
                        suggestedMax: Math.max(...data3ejes, ...data2ejes, 0) * 1.18,
                        grid: { color: COLORS.grid },
                        ticks: { color: COLORS.textPrimary, font: { size: 10, weight: '600' } },
                        title: { display: true, text: 'Millones de Pasadas (MM)', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }

    // 2. Re-estibas vs Transbordos (Toneladas)
    const c2 = document.getElementById('chart-reestibas-transbordos');
    if (c2) {
        destroyChart('chart-reestibas-transbordos');
        const dataReestibas = agg.map(d => roundNumber(d.reestibas_ton / 1e3, 1));
        const dataTransbordos = agg.map(d => roundNumber(d.transbordos_ton / 1e3, 1));
        chartInstances['chart-reestibas-transbordos'] = new Chart(c2.getContext('2d'), {
            type: 'bar',
            plugins: [CatlecUtils.groupedBarDataLabelsPlugin],
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Re-estibas (Ton)',
                        data: dataReestibas,
                        backgroundColor: COLORS.skyAlpha,
                        borderColor: COLORS.sky,
                        borderWidth: 1,
                        borderRadius: 3
                    },
                    {
                        label: 'Transbordos (Ton)',
                        data: dataTransbordos,
                        backgroundColor: COLORS.purpleAlpha,
                        borderColor: COLORS.purple,
                        borderWidth: 1,
                        borderRadius: 3
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
                            label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw * 1000)} Ton`
                        }
                    },
                    groupedBarDataLabelsPlugin: {
                        formatter: (v) => Number(v).toFixed(1),
                        color: (dIdx) => dIdx === 0 ? COLORS.sky : COLORS.purple,
                        offset: 4
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: COLORS.textPrimary, font: { size: 10, weight: '600' } }
                    },
                    y: {
                        suggestedMax: Math.max(...dataReestibas, ...dataTransbordos, 0) * 1.18,
                        grid: { color: COLORS.grid },
                        ticks: { color: COLORS.textPrimary, font: { size: 10, weight: '600' } },
                        title: { display: true, text: 'Miles de Toneladas (kTon)', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }

    // 3. Doughnut Proporción de Flota de Carga
    const k = data.kpis;
    const piePeajes = [
        { label: 'Camiones de 3 y más ejes', value: k.total_peaje_camiones_3mas_ejes, color: COLORS.primary },
        { label: 'Camiones de 2 ejes', value: k.total_peaje_camiones_2ejes, color: COLORS.amber }
    ];
    renderPieWithLegend('chart-peajes-pie', 'chart-peajes-pieLegend', piePeajes, (v) => formatMillion(v, 'Pasadas'));

    // 4. Estacionalidad Mensual de Tránsito Pesado
    const c4 = document.getElementById('chart-peajes-estacionalidad');
    if (c4 && data.monthly_seasonality) {
        destroyChart('chart-peajes-estacionalidad');
        const mLabels = data.monthly_seasonality.map(d => d.mes_nombre);
        const mData = data.monthly_seasonality.map(d => roundNumber(d.avg_peajes / 1e3, 1));

        chartInstances['chart-peajes-estacionalidad'] = new Chart(c4.getContext('2d'), {
            type: 'bar',
            plugins: [CatlecUtils.groupedBarDataLabelsPlugin],
            data: {
                labels: mLabels,
                datasets: [{
                    label: 'Pasadas Promedio (Miles)',
                    data: mData,
                    backgroundColor: COLORS.emeraldAlpha,
                    borderColor: COLORS.emerald,
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
                            label: (ctx) => ` Pasadas Promedio: ${formatNumber(ctx.raw * 1000)}`
                        }
                    },
                    groupedBarDataLabelsPlugin: {
                        formatter: (v) => Number(v).toFixed(1),
                        color: COLORS.emerald,
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
                        title: { display: true, text: 'Miles de Pasadas / Mes', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }
}
