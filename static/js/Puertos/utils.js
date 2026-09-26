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

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ── Ejes estándar (catlec-bar-chart) ──────────────────────────────────────
const AXIS_TICKS = { color: COLORS.textPrimary, font: { size: 10, weight: '600' } };

function axisTitle(text, color = COLORS.textPrimary) {
    return { display: true, text, color, font: { size: 9.5, weight: '600' } };
}

// ── Helpers de datos ──────────────────────────────────────────────────────
function getUltimoRegistro() {
    const agg = window.PUERTOS_DATA && window.PUERTOS_DATA.annual_aggregates;
    return agg && agg.length ? agg[agg.length - 1] : null;
}

// Devuelve { anio: [12 valores | null] } a partir de una serie mensual
function groupSeriesByYear(serie, campo) {
    const out = {};
    (serie || []).forEach(r => {
        if (!out[r.anio]) out[r.anio] = new Array(12).fill(null);
        out[r.anio][r.mes - 1] = r[campo];
    });
    return out;
}

function movingAverage(values, n) {
    return values.map((_, i) => {
        if (i < n - 1) return null;
        let sum = 0;
        for (let j = i - n + 1; j <= i; j++) sum += values[j];
        return sum / n;
    });
}

// Suma los meses 1..hastaMes de un año en una serie mensual
function sumSerieHastaMes(serie, anio, hastaMes, campo) {
    return (serie || [])
        .filter(r => r.anio === anio && r.mes <= hastaMes)
        .reduce((s, r) => s + (Number(r[campo]) || 0), 0);
}

function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lerpColor(hexA, hexB, t) {
    const a = hexA.replace('#', '');
    const b = hexB.replace('#', '');
    const ch = (i) => Math.round(parseInt(a.substring(i, i + 2), 16) + (parseInt(b.substring(i, i + 2), 16) - parseInt(a.substring(i, i + 2), 16)) * t);
    return `rgb(${ch(0)}, ${ch(2)}, ${ch(4)})`;
}

// Escala del mapa de calor: espuma → océano → azul marino
function heatColor(t) {
    return t < 0.55
        ? lerpColor(COLORS.foam, COLORS.ocean, t / 0.55)
        : lerpColor(COLORS.ocean, COLORS.navy, (t - 0.55) / 0.45);
}

// Rellena los textos dinámicos de año de las cabeceras ([data-ultimo-anio], etc.)
function fillYearTags() {
    const ult = getUltimoRegistro();
    if (!ult) return;
    const parcial = ult.meses_registrados < 12 ? ` · ${MESES_CORTOS[0]}–${MESES_CORTOS[ult.meses_registrados - 1]}` : '';
    document.querySelectorAll('[data-ultimo-anio]').forEach(el => { el.textContent = `${ult.anio}${parcial}`; });
    document.querySelectorAll('[data-anio-anterior]').forEach(el => { el.textContent = ult.anio - 1; });
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
