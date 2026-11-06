// ─── static/js/Metro/inversion.js ─────────────────────────────────────────────
// "Proyectos por inversión": columna derecha de la vista Líneas de Tiempo de Metro.html, como "5 proyectos
// ferroviarios con mayor inversión" de EFE (static/js/EFE/investment.js): barras horizontales de mayor a menor
// con la inversión de cada proyecto (investment_mm_usd, MM USD). Cada barra va del color oficial de su línea.
// Los proyectos sin monto informado no se dibujan; la nota bajo el gráfico los nombra.
// Se dibuja con los proyectos que muestra el cronograma (renderMetroTimeline la llama con la misma lista).

let metroChartInversionInstance = null;

function metroFmtUSD(mm) {
    return CatlecUtils.formatCompactUSD(mm, { emptyText: 'Sin monto', treatZeroAsInvalid: true, bWholeStrip: true, mmRounding: 'round' });
}

function renderMetroInversionChart(projects) {
    const canvas = document.getElementById('metroChartInversion');
    if (!canvas || typeof Chart === 'undefined') return;
    const lista = (projects && projects.length) ? projects : ((window.METRO_DATA && window.METRO_DATA.data) || []);

    const conMonto = lista.filter(p => (p.investment_mm_usd || 0) > 0)
        .sort((a, b) => b.investment_mm_usd - a.investment_mm_usd);   // Chart.js dibuja la primera etiqueta arriba
    const sinMonto = lista.filter(p => !((p.investment_mm_usd || 0) > 0));
    const total = conMonto.reduce((t, p) => t + p.investment_mm_usd, 0);

    const totalEl = document.getElementById('metro-inversion-total');
    if (totalEl) totalEl.textContent = conMonto.length ? `Total ${metroFmtUSD(total)}` : '';
    const notaEl = document.getElementById('metro-inversion-nota');
    if (notaEl) {
        notaEl.textContent = sinMonto.length
            ? `Sin monto informado: ${sinMonto.map(p => p.line || p.name).join(', ')}.`
            : '';
        notaEl.title = sinMonto.map(p => p.name).join('\n');
    }

    const etiquetas = conMonto.map(p => CatlecUtils.wrapTextToLines(p.name || 'Sin nombre', 24, 2));
    const valores = conMonto.map(p => p.investment_mm_usd);
    const colores = conMonto.map(p => p.color_hex || '#cc1527');
    const tooltipCallbacks = {
        title: items => (conMonto[items[0].dataIndex] || {}).name || '',
        label: ctx => {
            const p = conMonto[ctx.dataIndex];
            const pct = total > 0 ? (ctx.raw / total * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 }) : 0;
            return [
                ` Inversión: ${metroFmtUSD(ctx.raw)} (${pct}% del total)`,
                ` Línea: ${p.line || '-'}`,
                ` Tipo: ${p.type || '-'} · Etapa: ${p.stage || '-'}`
            ];
        }
    };

    if (metroChartInversionInstance) {
        metroChartInversionInstance.data.labels = etiquetas;
        metroChartInversionInstance.data.datasets[0].data = valores;
        metroChartInversionInstance.data.datasets[0].backgroundColor = colores.map(c => c + 'cc');
        metroChartInversionInstance.data.datasets[0].borderColor = colores;
        metroChartInversionInstance.options.plugins.tooltip.callbacks = tooltipCallbacks;
        metroChartInversionInstance.update();
        return;
    }

    const textColor = '#475569';
    metroChartInversionInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Inversión (MM USD)',
                data: valores,
                backgroundColor: colores.map(c => c + 'cc'),
                borderColor: colores,
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 450, easing: 'easeOutQuart' },
            layout: { padding: { right: 10 } },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false, external: metroExternalTooltip, callbacks: tooltipCallbacks },
                horizontalBarDataLabelsPlugin: {
                    formatter: v => v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(0, 0, 0, 0.06)' },
                    ticks: { color: textColor, font: { size: 10, weight: '600' }, callback: v => v.toLocaleString('es-CL') },
                    title: { display: true, text: 'Inversión (MM USD)', color: textColor, font: { size: 9.5, weight: '600' } }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 10, weight: '600' }, autoSkip: false }
                }
            }
        }
    });
}

if (typeof window !== 'undefined') {
    window.renderMetroInversionChart = renderMetroInversionChart;
}
