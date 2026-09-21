/**
 * static/js/MOP/charts.js
 * Render de los gráficos Chart.js del dashboard MOP.
 * Requiere: Chart.js, window.MOP_DATA (mop_data.js), static/js/MOP/state.js, utils.js
 */

function clearEmpty(canvas) {
    if (!canvas || !canvas.parentElement) return;
    canvas.parentElement.querySelectorAll('.mop-empty-placeholder').forEach(el => el.remove());
}

function showEmpty(canvas) {
    if (!canvas || !canvas.parentElement) return;
    clearEmpty(canvas);
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    const p = document.createElement('p');
    p.className = 'mop-empty-placeholder';
    p.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.75rem;pointer-events:none;margin:0;';
    p.textContent = 'Sin datos para los filtros aplicados';
    canvas.parentElement.appendChild(p);
}

// ── Render de todos los gráficos ──────────────────────────────────────────
function renderAllCharts() {
    // Donut charts en panel izquierdo (siempre visibles)
    renderServicioDonut();
    renderServicioCostDonut();

    // Gráficos y tablas según la pestaña activa
    if (currentActiveTab === 'resumen') {
        renderTopTable();
        renderGlobalTable();
    } else if (currentActiveTab === 'inversion') {
        renderRegionBar();
        renderServicioInversionBar();
        renderProgramaInversionBar();
    } else if (currentActiveTab === 'programas') {
        renderEtapaBar();
        renderRegionCountBar();
        renderYearLine();
    }
}

function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ── 1. Donut: Distribución por Servicio (Nº Proyectos) ────────────────────
function renderServicioDonut() {
    const canvas = document.getElementById('chart-servicio');
    if (!canvas) return;
    clearEmpty(canvas);

    const data = aggregateBy('servicio', 'cost_mm').sort((a,b) => b.count - a.count);
    if (!data.length) {
        destroyChart('servicio');
        showEmpty(canvas);
        return;
    }

    const totalProjects = data.reduce((sum, d) => sum + d.count, 0);
    const labels = data.map(d => shortServiceName(d.label));
    const values = data.map(d => d.count);
    const colors = data.map(d => getServiceColor(d.label));

    if (charts.servicio) {
        charts.servicio.data.labels = labels;
        charts.servicio.data.datasets[0].data = values;
        charts.servicio.data.datasets[0].backgroundColor = colors;
        charts.servicio.data.datasets[0].borderColor = isDark() ? '#0f1626' : '#ffffff';
        delete charts.servicio.options.onClick;
        charts.servicio.update();
    } else {
        charts.servicio = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data:            values,
                    backgroundColor: colors,
                    borderWidth:     1.5,
                    borderColor:     isDark() ? '#0f1626' : '#ffffff',
                    hoverOffset:     4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                animation: { duration: 450, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: mopExternalTooltip,
                        callbacks: {
                            title: items => items.length ? items[0].label : '',
                            label: ctx => ` ${ctx.raw} proyectos (${((ctx.raw / (totalProjects || 1)) * 100).toFixed(1)}%)`
                        }
                    }
                }
            }
        });
    }

    // Render custom HTML legend
    const legendEl = document.getElementById('mopServicioChartLegend');
    if (legendEl) {
        legendEl.innerHTML = data.map((d, idx) => {
            const count = d.count;
            const pct = totalProjects > 0 ? ((count / totalProjects) * 100).toFixed(1).replace(/\.0$/, '') : '0';
            const col = colors[idx];
            const sName = shortServiceName(d.label);
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.69rem; padding:0.1rem 0; color:var(--text-primary);">
                    <div style="display:flex; align-items:center; gap:0.35rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-primary); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sName}</span>
                    </div>
                    <span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                        ${pct}%
                    </span>
                </div>
            `;
        }).join('');
    }
}

// ── 1b. Donut: Costo Total por Servicio (Inversión MM CLP) ────────────────
function renderServicioCostDonut() {
    const canvas = document.getElementById('chart-servicio-cost');
    if (!canvas) return;
    clearEmpty(canvas);

    const data = aggregateBy('servicio', 'cost_mm').sort((a,b) => b.total - a.total);
    if (!data.length) {
        destroyChart('servicioCost');
        showEmpty(canvas);
        return;
    }

    const totalCost = data.reduce((sum, d) => sum + d.total, 0);
    const labels = data.map(d => shortServiceName(d.label));
    const values = data.map(d => +d.total.toFixed(1));
    const colors = data.map(d => getServiceColor(d.label));

    if (charts.servicioCost) {
        charts.servicioCost.data.labels = labels;
        charts.servicioCost.data.datasets[0].data = values;
        charts.servicioCost.data.datasets[0].backgroundColor = colors;
        charts.servicioCost.data.datasets[0].borderColor = isDark() ? '#0f1626' : '#ffffff';
        delete charts.servicioCost.options.onClick;
        charts.servicioCost.update();
    } else {
        charts.servicioCost = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data:            values,
                    backgroundColor: colors,
                    borderWidth:     1.5,
                    borderColor:     isDark() ? '#0f1626' : '#ffffff',
                    hoverOffset:     4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                animation: { duration: 450, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: mopExternalTooltip,
                        callbacks: {
                            title: items => items.length ? items[0].label : '',
                            label: ctx => ` Inversión: $${formatMM(ctx.raw)} MM CLP (${((ctx.raw / (totalCost || 1)) * 100).toFixed(1)}%)`
                        }
                    }
                }
            }
        });
    }

    // Render custom HTML legend
    const legendEl = document.getElementById('mopServicioCostChartLegend');
    if (legendEl) {
        legendEl.innerHTML = data.map((d, idx) => {
            const cost = d.total;
            const pct = totalCost > 0 ? ((cost / totalCost) * 100).toFixed(1).replace(/\.0$/, '') : '0';
            const col = colors[idx];
            const sName = shortServiceName(d.label);
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.69rem; padding:0.1rem 0; color:var(--text-primary);">
                    <div style="display:flex; align-items:center; gap:0.35rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-primary); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sName}</span>
                    </div>
                    <span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                        ${pct}%
                    </span>
                </div>
            `;
        }).join('');
    }
}

// ── 2. Barras: Inversión por Región (Actualización dinámica interactiva) ──
function renderRegionBar() {
    const canvas = document.getElementById('chart-region');
    if (!canvas) return;
    clearEmpty(canvas);

    const data = aggregateBy('region', 'cost_mm').sort((a,b) => b.total - a.total);
    if (!data.length) {
        destroyChart('region');
        showEmpty(canvas);
        return;
    }

    const totalCost = data.reduce((sum, d) => sum + d.total, 0);
    const labels = data.map(d => shortRegion(d.label));
    const values = data.map(d => +d.total.toFixed(1));
    const bgColors = 'rgba(37, 99, 235, 0.8)';
    const borderColors = '#2563eb';

    if (charts.region) {
        charts.region.data.labels = labels;
        charts.region.data.datasets[0].data = values;
        charts.region.data.datasets[0].backgroundColor = bgColors;
        charts.region.data.datasets[0].borderColor = borderColors;
        charts.region.options.scales.x.title.text = 'Inversión (Millones CLP)';
        charts.region.options.scales.x.title.color = titleColor();
        charts.region.options.scales.x.grid.color = gridColor();
        charts.region.options.scales.x.ticks.color = labelColor();
        charts.region.options.scales.x.ticks.callback = v => v.toLocaleString('es-CL');
        charts.region.options.scales.y.ticks.color = labelColor();
        if (charts.region.options.plugins.horizontalBarDataLabelsPlugin) {
            charts.region.options.plugins.horizontalBarDataLabelsPlugin.formatter = (v) => `${Number(v).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${((v / (totalCost || 1)) * 100).toFixed(1)}%)`;
        }
        charts.region.options.plugins.tooltip.callbacks.label = (ctx) => ` Inversión: $${Number(ctx.raw).toLocaleString('es-CL')} MM CLP (${((ctx.raw / (totalCost || 1)) * 100).toFixed(1)}%)`;
        delete charts.region.options.onClick;
        charts.region.update();
    } else {
        charts.region = new Chart(canvas, {
            type: 'bar',
            plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
            data: {
                labels: labels,
                datasets: [{
                    label:           'Inversión (MM CLP)',
                    data:            values,
                    backgroundColor: bgColors,
                    borderColor:     borderColors,
                    borderWidth:     1,
                    borderRadius:    3,
                    borderSkipped:   false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                animation: { duration: 450, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    horizontalBarDataLabelsPlugin: {
                        formatter: (v) => `${Number(v).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${((v / (totalCost || 1)) * 100).toFixed(1)}%)`
                    },
                    tooltip: {
                        enabled: false,
                        external: mopExternalTooltip,
                        callbacks: {
                            title: items => items.length ? items[0].label : '',
                            label: ctx => ` Inversión: $${Number(ctx.raw).toLocaleString('es-CL')} MM CLP (${((ctx.raw / (totalCost || 1)) * 100).toFixed(1)}%)`
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Inversión (Millones CLP)',
                            color: titleColor(),
                            font: { size: 9.5, weight: '600' }
                        },
                        grid:  { color: gridColor() },
                        ticks: {
                            color: labelColor(),
                            font: { size: 10 },
                            callback: v => v.toLocaleString('es-CL')
                        }
                    },
                    y: {
                        grid:  { display: false },
                        ticks: {
                            color: labelColor(),
                            font: { size: 10, weight: '600' },
                            autoSkip: false
                        }
                    }
                }
            }
        });
    }
}

// ── 2b. Barras: Inversión por Servicio MOP (Inversión MM CLP) ───────────
function renderServicioInversionBar() {
    const id = 'chart-servicio-inversion';
    const canvas = document.getElementById(id);
    if (!canvas) return;
    clearEmpty(canvas);

    const data = aggregateBy('servicio', 'cost_mm').sort((a,b) => b.total - a.total);
    if (!data.length) {
        destroyChart(id);
        showEmpty(canvas);
        return;
    }

    const totalCost = data.reduce((sum, d) => sum + d.total, 0);
    const labels = data.map(d => shortServiceName(d.label));
    const values = data.map(d => +d.total.toFixed(1));
    const colors = data.map(d => getServiceColor(d.label));

    if (charts[id]) {
        charts[id].data.labels = labels;
        charts[id].data.datasets[0].data = values;
        charts[id].data.datasets[0].backgroundColor = colors;
        charts[id].options.scales.x.title.text = 'Inversión (Millones CLP)';
        charts[id].options.scales.x.title.color = titleColor();
        charts[id].options.scales.x.grid.color = gridColor();
        charts[id].options.scales.x.ticks.color = labelColor();
        charts[id].options.scales.x.ticks.callback = v => v.toLocaleString('es-CL');
        charts[id].options.scales.y.ticks.color = labelColor();
        if (charts[id].options.plugins.horizontalBarDataLabelsPlugin) {
            charts[id].options.plugins.horizontalBarDataLabelsPlugin.formatter = (v) => `${Number(v).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${((v / (totalCost || 1)) * 100).toFixed(1)}%)`;
        }
        charts[id].options.plugins.tooltip.callbacks.label = (ctx) => ` Inversión: $${Number(ctx.raw).toLocaleString('es-CL')} MM CLP (${((ctx.raw / (totalCost || 1)) * 100).toFixed(1)}%)`;
        charts[id].update();
    } else {
        charts[id] = new Chart(canvas, {
            type: 'bar',
            plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
            data: {
                labels: labels,
                datasets: [{
                    label:           'Inversión (MM CLP)',
                    data:            values,
                    backgroundColor: colors,
                    borderWidth:     1,
                    borderRadius:    3,
                    borderSkipped:   false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                animation: { duration: 450, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    horizontalBarDataLabelsPlugin: {
                        formatter: (v) => `${Number(v).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${((v / (totalCost || 1)) * 100).toFixed(1)}%)`
                    },
                    tooltip: {
                        enabled: false,
                        external: mopExternalTooltip,
                        callbacks: {
                            title: (items) => {
                                if (items.length > 0) {
                                    const idx = items[0].dataIndex;
                                    return data[idx] ? data[idx].label : (items[0].label || '');
                                }
                                return '';
                            },
                            label: ctx => ` Inversión: $${Number(ctx.raw).toLocaleString('es-CL')} MM CLP (${((ctx.raw / (totalCost || 1)) * 100).toFixed(1)}%)`
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Inversión (Millones CLP)',
                            color: titleColor(),
                            font: { size: 9.5, weight: '600' }
                        },
                        grid:  { color: gridColor() },
                        ticks: {
                            color: labelColor(),
                            font: { size: 10 },
                            callback: v => v.toLocaleString('es-CL')
                        }
                    },
                    y: {
                        grid:  { display: false },
                        ticks: {
                            color: labelColor(),
                            font: { size: 10, weight: '600' },
                            autoSkip: false
                        }
                    }
                }
            }
        });
    }
}

// ── 2c. Barras: Inversión por Programa (Top 10 Programas por Inversión) ──
function renderProgramaInversionBar() {
    const id = 'chart-programa-inversion';
    const canvas = document.getElementById(id);
    if (!canvas) return;
    clearEmpty(canvas);

    const data = aggregateBy('programa', 'cost_mm')
        .sort((a,b) => b.total - a.total)
        .slice(0, 10);
    if (!data.length) {
        destroyChart(id);
        showEmpty(canvas);
        return;
    }

    const totalCost = data.reduce((sum, d) => sum + d.total, 0);
    const labels = data.map(d => d.label.length > 32 ? d.label.slice(0, 31) + '…' : d.label);
    const values = data.map(d => +d.total.toFixed(1));
    const barColor = 'rgba(245, 158, 11, 0.85)';
    const borderColor = '#f59e0b';

    if (charts[id]) {
        charts[id].data.labels = labels;
        charts[id].data.datasets[0].data = values;
        charts[id].data.datasets[0].backgroundColor = barColor;
        charts[id].data.datasets[0].borderColor = borderColor;
        charts[id].options.scales.x.title.text = 'Inversión (Millones CLP)';
        charts[id].options.scales.x.title.color = titleColor();
        charts[id].options.scales.x.grid.color = gridColor();
        charts[id].options.scales.x.ticks.color = labelColor();
        charts[id].options.scales.x.ticks.callback = v => v.toLocaleString('es-CL');
        charts[id].options.scales.y.ticks.color = labelColor();
        if (charts[id].options.plugins.horizontalBarDataLabelsPlugin) {
            charts[id].options.plugins.horizontalBarDataLabelsPlugin.formatter = (v) => `${Number(v).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${((v / (totalCost || 1)) * 100).toFixed(1)}%)`;
        }
        charts[id].update();
    } else {
        charts[id] = new Chart(canvas, {
            type: 'bar',
            plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
            data: {
                labels: labels,
                datasets: [{
                    label:           'Inversión (MM CLP)',
                    data:            values,
                    backgroundColor: barColor,
                    borderColor:     borderColor,
                    borderWidth:     1,
                    borderRadius:    3,
                    borderSkipped:   false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                animation: { duration: 450, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    horizontalBarDataLabelsPlugin: {
                        formatter: (v) => `${Number(v).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${((v / (totalCost || 1)) * 100).toFixed(1)}%)`
                    },
                    tooltip: {
                        enabled: false,
                        external: mopExternalTooltip,
                        callbacks: {
                            title: (items) => {
                                if (items.length > 0) {
                                    const idx = items[0].dataIndex;
                                    return data[idx] ? data[idx].label : (items[0].label || '');
                                }
                                return '';
                            },
                            label: ctx => ` Inversión: $${Number(ctx.raw).toLocaleString('es-CL')} MM CLP (${((ctx.raw / (totalCost || 1)) * 100).toFixed(1)}%)`
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Inversión (Millones CLP)',
                            color: titleColor(),
                            font: { size: 9.5, weight: '600' }
                        },
                        grid:  { color: gridColor() },
                        ticks: {
                            color: labelColor(),
                            font: { size: 10 },
                            callback: v => v.toLocaleString('es-CL')
                        }
                    },
                    y: {
                        grid:  { display: false },
                        ticks: {
                            color: labelColor(),
                            font: { size: 9.5, weight: '600' },
                            autoSkip: false
                        }
                    }
                }
            }
        });
    }
}

// ── 3. Barras: Número de Proyectos por Región (Reubicado en Programas y Etapas) ──
function renderRegionCountBar() {
    const canvas = document.getElementById('chart-region-count');
    if (!canvas) return;
    clearEmpty(canvas);

    const data = aggregateBy('region', 'cost_mm').sort((a,b) => b.count - a.count);
    if (!data.length) {
        destroyChart('region-count');
        showEmpty(canvas);
        return;
    }

    const totalProjects = data.reduce((sum, d) => sum + d.count, 0);
    const labels = data.map(d => shortRegion(d.label));
    const values = data.map(d => d.count);
    const bgColors = 'rgba(16, 185, 129, 0.85)';
    const borderColors = '#10b981';

    if (charts['region-count']) {
        charts['region-count'].data.labels = labels;
        charts['region-count'].data.datasets[0].data = values;
        charts['region-count'].data.datasets[0].backgroundColor = bgColors;
        charts['region-count'].data.datasets[0].borderColor = borderColors;
        charts['region-count'].options.scales.x.title.color = titleColor();
        charts['region-count'].options.scales.x.grid.color = gridColor();
        charts['region-count'].options.scales.x.ticks.color = labelColor();
        charts['region-count'].options.scales.y.ticks.color = labelColor();
        charts['region-count'].options.plugins.tooltip.callbacks.label = (ctx) => ` Cantidad: ${ctx.raw} proyecto${ctx.raw !== 1 ? 's' : ''} (${((ctx.raw / (totalProjects || 1)) * 100).toFixed(1)}%)`;
        delete charts['region-count'].options.onClick;
        charts['region-count'].update();
    } else {
        charts['region-count'] = new Chart(canvas, {
            type: 'bar',
            plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
            data: {
                labels: labels,
                datasets: [{
                    label:           'Nº Proyectos',
                    data:            values,
                    backgroundColor: bgColors,
                    borderColor:     borderColors,
                    borderWidth:     1,
                    borderRadius:    3,
                    borderSkipped:   false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                animation: { duration: 450, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    horizontalBarDataLabelsPlugin: {
                        formatter: (v) => String(v)
                    },
                    tooltip: {
                        enabled: false,
                        external: mopExternalTooltip,
                        callbacks: {
                            title: items => items.length ? items[0].label : '',
                            label: ctx => ` Cantidad: ${ctx.raw} proyecto${ctx.raw !== 1 ? 's' : ''} (${((ctx.raw / (totalProjects || 1)) * 100).toFixed(1)}%)`
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Número de Proyectos',
                            color: titleColor(),
                            font: { size: 9.5, weight: '600' }
                        },
                        grid:  { color: gridColor() },
                        ticks: {
                            color: labelColor(),
                            font: { size: 10 },
                            stepSize: 1
                        }
                    },
                    y: {
                        grid:  { display: false },
                        ticks: {
                            color: labelColor(),
                            font: { size: 10, weight: '600' },
                            autoSkip: false
                        }
                    }
                }
            }
        });
    }
}

// ── 4. Barras: Proyectos por Etapa ─────────────────────────────────────────
function renderEtapaBar() {
    const id = 'chart-etapa-tab';
    const canvas = document.getElementById(id);
    if (!canvas) return;
    clearEmpty(canvas);

    const data = aggregateBy('etapa', 'cost_mm').sort((a,b) => b.count - a.count);
    if (!data.length) {
        destroyChart(id);
        showEmpty(canvas);
        return;
    }

    const totalProjects = data.reduce((sum, d) => sum + d.count, 0);
    const labels = data.map(d => d.label);
    const countValues = data.map(d => d.count);
    const barColor = 'rgba(37, 99, 235, 0.8)';
    const borderColor = '#2563eb';

    if (charts[id]) {
        charts[id].data.labels = labels;
        charts[id].data.datasets = [{
            label:           'Nº Proyectos',
            data:            countValues,
            backgroundColor: barColor,
            borderColor:     borderColor,
            borderWidth:     1,
            borderRadius:    3,
            borderSkipped:   false,
        }];
        charts[id].options.scales.y.title.color = titleColor();
        charts[id].options.scales.y.grid.color = gridColor();
        charts[id].options.scales.y.ticks.color = labelColor();
        charts[id].options.scales.x.ticks.color = labelColor();
        charts[id].options.plugins.tooltip.callbacks.label = (ctx) => ` Cantidad: ${ctx.raw} proyecto${ctx.raw !== 1 ? 's' : ''} (${((ctx.raw / (totalProjects || 1)) * 100).toFixed(1)}%)`;
        delete charts[id].options.onClick;
        charts[id].update();
    } else {
        charts[id] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label:           'Nº Proyectos',
                    data:            countValues,
                    backgroundColor: barColor,
                    borderColor:     borderColor,
                    borderWidth:     1,
                    borderRadius:    3,
                    borderSkipped:   false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 450, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        mode: 'index',
                        intersect: false,
                        external: mopExternalTooltip,
                        callbacks: {
                            title: items => items.length ? `Etapa: ${items[0].label}` : '',
                            label: ctx => ` Cantidad: ${ctx.raw} proyecto${ctx.raw !== 1 ? 's' : ''} (${((ctx.raw / (totalProjects || 1)) * 100).toFixed(1)}%)`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: labelColor(),
                            font: { size: 10, weight: '600' }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Nº Proyectos',
                            color: titleColor(),
                            font: { size: 9.5, weight: '600' }
                        },
                        grid: { color: gridColor() },
                        ticks: {
                            color: labelColor(),
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }
}

// ── 5. Línea Combo: Evolución por año de primera postulación (Standard index.html) ──
function renderYearLine() {
    const canvas = document.getElementById('chart-year');
    if (!canvas) return;
    clearEmpty(canvas);

    const map = {};
    filteredProjects.forEach(p => {
        if (!p.year) return;
        if (!map[p.year]) map[p.year] = { count: 0, total: 0 };
        map[p.year].count++;
        map[p.year].total += (p.cost_mm || 0);
    });
    const years = Object.keys(map).map(Number).sort((a,b) => a-b);
    if (!years.length) {
        destroyChart('year');
        showEmpty(canvas);
        return;
    }

    const countValues = years.map(y => map[y].count);
    const costValues = years.map(y => +map[y].total.toFixed(1));

    if (charts.year) {
        charts.year.data.labels = years;
        charts.year.data.datasets[0].data = countValues;
        charts.year.data.datasets[1].data = costValues;
        charts.year.options.scales.x.grid.color = gridColor();
        charts.year.options.scales.x.ticks.color = labelColor();
        charts.year.options.scales.y.title.color = titleColor();
        charts.year.options.scales.y.grid.color = gridColor();
        charts.year.options.scales.y.ticks.color = labelColor();
        charts.year.options.scales.y2.title.color = '#f59e0b';
        charts.year.options.scales.y2.ticks.color = '#f59e0b';
        charts.year.update();
    } else {
        charts.year = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: years,
                datasets: [
                    {
                        label:           'Nº Proyectos',
                        data:            countValues,
                        backgroundColor: 'rgba(37, 99, 235, 0.8)',
                        borderColor:     '#2563eb',
                        borderWidth:     1,
                        borderRadius:    3,
                        borderSkipped:   false,
                        yAxisID:         'y',
                        order:           2,
                    },
                    {
                        label:           'Inversión (MM CLP)',
                        data:            costValues,
                        type:            'line',
                        borderColor:     '#f59e0b',
                        backgroundColor: '#f59e0b',
                        borderWidth:     2.2,
                        pointRadius:     2.5,
                        pointHoverRadius:4.5,
                        pointBackgroundColor: '#f59e0b',
                        fill:            false,
                        tension:         0,
                        yAxisID:         'y2',
                        order:           1,
                    }
                ]
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
                        external: mopExternalTooltip,
                        callbacks: {
                            title: (items) => items.length ? `Año ${items[0].label}` : '',
                            label: (ctx) => {
                                if (ctx.datasetIndex === 0) return ` Proyectos: ${ctx.raw}`;
                                return ` Inversión: $${Number(ctx.raw).toLocaleString('es-CL')} MM CLP`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: labelColor(),
                            font: { size: 10 }
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Nº Proyectos',
                            color: titleColor(),
                            font: { size: 9.5, weight: '600' }
                        },
                        grid: { color: gridColor() },
                        ticks: {
                            color: labelColor(),
                            font: { size: 10 }
                        }
                    },
                    y2: {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Inversión (MM CLP)',
                            color: '#f59e0b',
                            font: { size: 9.5, weight: '600' }
                        },
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: '#f59e0b',
                            font: { size: 10 },
                            callback: v => `$${v.toLocaleString('es-CL')}M`
                        }
                    }
                }
            }
        });
    }
}
