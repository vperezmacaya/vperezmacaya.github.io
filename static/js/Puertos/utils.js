// Helpers de formato y renderizado compartidos por las 4 vistas de Puertos

function formatNumber(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('es-CL', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatMillion(num, unit = 'Ton') {
    if (num === null || num === undefined || isNaN(num)) return `0 ${unit}`;
    const val = Number(num);
    if (Math.abs(val) >= 1e6) {
        return `${formatNumber(val / 1e6, 2)} M ${unit}`;
    } else if (Math.abs(val) >= 1e3) {
        return `${formatNumber(val / 1e3, 1)} K ${unit}`;
    }
    return `${formatNumber(val, 0)} ${unit}`;
}

function roundNumber(num, decimals = 2) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// ── Destrucción segura de gráficos ────────────────────────────────────────
function destroyChart(key) {
    if (chartInstances[key]) {
        chartInstances[key].destroy();
        delete chartInstances[key];
    }
}

// ── Helper para Doughnut con Leyenda HTML desacoplada (Standard CATLEC) ───
function renderPieWithLegend(canvasId, legendId, items, valueFormatter = (v) => formatMillion(v, 'Ton')) {
    const canvas = document.getElementById(canvasId);
    const legendEl = document.getElementById(legendId);
    if (!canvas) return;

    destroyChart(canvasId);

    const labels = items.map(d => d.label);
    const values = items.map(d => Number(d.value) || 0);
    const colors = items.map(d => d.color);
    const total = values.reduce((acc, v) => acc + v, 0) || 1;

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: '#ffffff',
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            interaction: {
                mode: 'nearest',
                intersect: true
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: puertosExternalTooltip,
                    callbacks: {
                        title: (items) => (items && items[0] ? items[0].label : ''),
                        label: (ctx) => {
                            const val = ctx.raw;
                            const pct = ((val / total) * 100).toFixed(1);
                            return ` ${valueFormatter(val)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    if (legendEl) {
        legendEl.innerHTML = '';
        labels.forEach((lbl, idx) => {
            const val = values[idx];
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
            const col = colors[idx];

            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'display:flex; align-items:center; gap:0.35rem; font-size:0.72rem; padding:0.06rem 0;';
            itemDiv.title = `${lbl}: ${valueFormatter(val)} (${pct}%)`;
            itemDiv.innerHTML = `
                <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                <span style="color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">${lbl}</span>
                <span style="font-weight:700; color:var(--text-primary); flex-shrink:0; white-space:nowrap; font-size:0.7rem;">${pct}%</span>
            `;
            legendEl.appendChild(itemDiv);
        });
    }
}
