/**
 * Visualización: Conectividad Terrestre y Peajes (Vista 4) — layout "Mapa de calor"
 */
const puertosHeatmapTooltip = CatlecTimeline.createCursorTooltip({ domId: 'puertos-heatmap-tooltip' });

function renderHeatmapPeajes(serie) {
    const container = document.getElementById('puertos-heatmap-peajes');
    if (!container || !serie || !serie.length) return;

    const registros = {};
    serie.forEach(r => { registros[`${r.anio}-${r.mes}`] = r; });
    const anios = [...new Set(serie.map(r => r.anio))].sort((a, b) => a - b);
    const totales = serie.map(r => r.total);
    const min = Math.min(...totales);
    const max = Math.max(...totales);

    const minEl = document.getElementById('puertos-heatmap-min');
    if (minEl) minEl.textContent = formatNumber(min / 1e3, 0);
    const maxEl = document.getElementById('puertos-heatmap-max');
    if (maxEl) maxEl.textContent = formatNumber(max / 1e3, 0);

    let html = '<div></div>';
    html += MESES_CORTOS.map(m => `<div class="puertos-heatmap-head">${m}</div>`).join('');
    html += '<div class="puertos-heatmap-head">Total</div>';

    anios.forEach(anio => {
        html += `<div class="puertos-heatmap-year">${anio}</div>`;
        let totalAnio = 0;
        let meses = 0;
        for (let mes = 1; mes <= 12; mes++) {
            const r = registros[`${anio}-${mes}`];
            if (!r) {
                html += '<div class="puertos-heatmap-cell puertos-heatmap-cell--empty"></div>';
                continue;
            }
            totalAnio += r.total;
            meses++;
            const t = max > min ? (r.total - min) / (max - min) : 0;
            const dark = t > 0.4 ? ' puertos-heatmap-cell--dark' : '';
            html += `<div class="puertos-heatmap-cell${dark}" data-key="${anio}-${mes}" style="background:${heatColor(t)};">${formatNumber(r.total / 1e3, 0)}</div>`;
        }
        const parcial = meses < 12 ? ` title="Año parcial: ${meses} meses"` : '';
        html += `<div class="puertos-heatmap-total"${parcial}>${formatMillion(totalAnio, '').trim()}${meses < 12 ? '*' : ''}</div>`;
    });

    container.innerHTML = html;

    const tooltipHtml = (r) => {
        const v = r.var_12m;
        const colorVar = v >= 0 ? `color:${COLORS.teal};` : `color:${COLORS.buoy};`;
        return CatlecTimeline.tooltipName(`${MESES_CORTOS[r.mes - 1]} ${r.anio}`, COLORS.navy)
            + CatlecTimeline.tooltipRow('Total pasadas', formatNumber(r.total))
            + CatlecTimeline.tooltipRow('3 y más ejes', formatNumber(r.camiones_3_mas_ejes))
            + CatlecTimeline.tooltipRow('2 ejes', formatNumber(r.camiones_2_ejes))
            + CatlecTimeline.tooltipRow('Var. 12 meses', `${v > 0 ? '+' : ''}${formatNumber(v, 1)}%`, colorVar);
    };

    container.onmouseover = (e) => {
        const cell = e.target.closest('[data-key]');
        if (!cell) { puertosHeatmapTooltip.hide(); return; }
        puertosHeatmapTooltip.show(e, tooltipHtml(registros[cell.dataset.key]));
    };
    container.onmousemove = (e) => puertosHeatmapTooltip.move(e);
    container.onmouseleave = () => puertosHeatmapTooltip.hide();
}

function renderVistaTerrestre() {
    const data = window.PUERTOS_DATA;
    if (!data || !data.annual_aggregates) return;

    const agg = data.annual_aggregates;
    const years = agg.map(d => d.anio.toString());
    const ult = getUltimoRegistro();

    // A. Mapa de calor año × mes de pasadas de camiones
    renderHeatmapPeajes(data.series && data.series.plaza_peaje);

    // B. Donut compacto de la flota por ejes del último año
    if (ult) {
        renderPieWithLegend('chart-peajes-pie', 'chart-peajes-pieLegend', [
            { label: 'Camiones de 3 y más ejes', value: ult.peaje_camiones_3mas_ejes, color: COLORS.navy },
            { label: 'Camiones de 2 ejes', value: ult.peaje_camiones_2ejes, color: COLORS.sand }
        ], (v) => formatMillion(v, 'Pasadas'));
    }

    // C. Re-estibas vs Transbordos (líneas anuales)
    const c3 = document.getElementById('chart-reestibas-transbordos');
    if (c3) {
        destroyChart('chart-reestibas-transbordos');
        const dataReestibas = agg.map(d => roundNumber(d.reestibas_ton / 1e3, 1));
        const dataTransbordos = agg.map(d => roundNumber(d.transbordos_ton / 1e3, 1));
        const linea = (label, valores, color) => ({
            label,
            data: valores,
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2.2,
            tension: 0.2,
            pointRadius: 3.5,
            pointHoverRadius: 5.5,
            pointBackgroundColor: color,
            fill: false
        });

        chartInstances['chart-reestibas-transbordos'] = new Chart(c3.getContext('2d'), {
            type: 'line',
            plugins: [CatlecUtils.lineDataLabelsPlugin],
            data: {
                labels: years,
                datasets: [
                    linea('Re-estibas', dataReestibas, COLORS.ocean),
                    linea('Transbordos', dataTransbordos, COLORS.coral)
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
                    lineDataLabelsPlugin: {
                        formatter: (v) => Number(v).toFixed(0),
                        color: (dIdx) => (dIdx === 0 ? COLORS.ocean : COLORS.coral)
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: AXIS_TICKS },
                    y: {
                        beginAtZero: true,
                        suggestedMax: Math.max(...dataReestibas, ...dataTransbordos, 0) * 1.18,
                        grid: { color: COLORS.grid },
                        ticks: AXIS_TICKS,
                        title: axisTitle('Miles de Toneladas (kTon)')
                    }
                }
            }
        });
    }
}
