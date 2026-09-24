/**
 * Visualización: Tipología de Carga (Vista 3)
 */
function renderVistaTipologia() {
    const data = window.PUERTOS_DATA;
    if (!data || !data.annual_aggregates) return;

    const agg = data.annual_aggregates;
    const years = agg.map(d => d.anio.toString());

    // 1. Tipología Embarcada (Apilada)
    const c1 = document.getElementById('chart-tipologia-embarcada');
    if (c1) {
        destroyChart('chart-tipologia-embarcada');
        chartInstances['chart-tipologia-embarcada'] = new Chart(c1.getContext('2d'), {
            type: 'bar',
            plugins: [CatlecUtils.stackedBarDataLabelsPlugin],
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Contenedores',
                        data: agg.map(d => roundNumber(d.emb_contenedores / 1e6, 2)),
                        backgroundColor: COLORS.primaryAlpha,
                        borderColor: COLORS.primary,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Carga Suelta / General',
                        data: agg.map(d => roundNumber(d.emb_suelta / 1e6, 2)),
                        backgroundColor: COLORS.skyAlpha,
                        borderColor: COLORS.sky,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Granel Sólido',
                        data: agg.map(d => roundNumber(d.emb_granel_solido / 1e6, 2)),
                        backgroundColor: COLORS.amberAlpha,
                        borderColor: COLORS.amber,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Granel Líquido/Gaseoso',
                        data: agg.map(d => roundNumber(d.emb_granel_liquido / 1e6, 2)),
                        backgroundColor: COLORS.emeraldAlpha,
                        borderColor: COLORS.emerald,
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
                        title: { display: true, text: 'MM Ton Embarcadas', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }

    // 2. Tipología Desembarcada (Apilada)
    const c2 = document.getElementById('chart-tipologia-desembarcada');
    if (c2) {
        destroyChart('chart-tipologia-desembarcada');
        chartInstances['chart-tipologia-desembarcada'] = new Chart(c2.getContext('2d'), {
            type: 'bar',
            plugins: [CatlecUtils.stackedBarDataLabelsPlugin],
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Granel Líquido/Gaseoso',
                        data: agg.map(d => roundNumber(d.des_granel_liquido / 1e6, 2)),
                        backgroundColor: COLORS.emeraldAlpha,
                        borderColor: COLORS.emerald,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Granel Sólido',
                        data: agg.map(d => roundNumber(d.des_granel_solido / 1e6, 2)),
                        backgroundColor: COLORS.amberAlpha,
                        borderColor: COLORS.amber,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Contenedores',
                        data: agg.map(d => roundNumber(d.des_contenedores / 1e6, 2)),
                        backgroundColor: COLORS.primaryAlpha,
                        borderColor: COLORS.primary,
                        borderWidth: 1,
                        borderRadius: 2
                    },
                    {
                        label: 'Carga Suelta / General',
                        data: agg.map(d => roundNumber(d.des_suelta / 1e6, 2)),
                        backgroundColor: COLORS.skyAlpha,
                        borderColor: COLORS.sky,
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
                        title: { display: true, text: 'MM Ton Desembarcadas', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }

    // 3. Doughnut Embarcada
    const totEmbCont = agg.reduce((s, d) => s + d.emb_contenedores, 0);
    const totEmbSuel = agg.reduce((s, d) => s + d.emb_suelta, 0);
    const totEmbSol = agg.reduce((s, d) => s + d.emb_granel_solido, 0);
    const totEmbLiq = agg.reduce((s, d) => s + d.emb_granel_liquido, 0);

    const pieEmb = [
        { label: 'Contenedores', value: totEmbCont, color: COLORS.primary },
        { label: 'Carga Suelta', value: totEmbSuel, color: COLORS.sky },
        { label: 'Granel Sólido', value: totEmbSol, color: COLORS.amber },
        { label: 'Granel Líquido', value: totEmbLiq, color: COLORS.emerald }
    ];
    renderPieWithLegend('chart-pie-embarcada', 'chart-pie-embarcadaLegend', pieEmb);

    // 4. Doughnut Desembarcada
    const totDesLiq = agg.reduce((s, d) => s + d.des_granel_liquido, 0);
    const totDesSol = agg.reduce((s, d) => s + d.des_granel_solido, 0);
    const totDesCont = agg.reduce((s, d) => s + d.des_contenedores, 0);
    const totDesSuel = agg.reduce((s, d) => s + d.des_suelta, 0);

    const pieDesemb = [
        { label: 'Granel Líquido', value: totDesLiq, color: COLORS.emerald },
        { label: 'Granel Sólido', value: totDesSol, color: COLORS.amber },
        { label: 'Contenedores', value: totDesCont, color: COLORS.primary },
        { label: 'Carga Suelta', value: totDesSuel, color: COLORS.sky }
    ];
    renderPieWithLegend('chart-pie-desembarcada', 'chart-pie-desembarcadaLegend', pieDesemb);
}
