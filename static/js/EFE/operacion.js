/**
 * static/js/EFE/operacion.js
 * Visualización: Demanda y Operación de Servicios Ferroviarios EFE
 * Construida a partir de la hoja de Líneas Operativas (Memoria Integrada 2025).
 * Harmonized with CATLEC design system and Chart.js guidelines.
 */

let efeChartDemandaPaxInstance = null;
let efeChartDemandaFilialInstance = null;
let efeChartLongitudEstacionesInstance = null;
let efeChartSatisfaccionInstance = null;
let efeChartTraccionFlotaInstance = null;

const EFE_OPERACION_FILIAL_COLORS = {
    'EFE Central': '#2563eb',
    'EFE Valparaíso': '#0284c7',
    'EFE Sur': '#d97706',
    'EFE Arica - La Paz': '#059669',
    'EFE Arica-La Paz': '#059669',
    'Sin filial específica': '#64748b'
};

function getEfeFilialColor(filial) {
    return EFE_OPERACION_FILIAL_COLORS[filial] || '#2563eb';
}

function getEfeTractionGroup(traction) {
    if (!traction) return 'Otros';
    const t = traction.toLowerCase();
    if (t.includes('bimodal')) return 'Bimodal (160 km/h)';
    if (t.includes('eléctrica') || t.includes('electrica')) return 'Eléctrica (EMU)';
    if (t.includes('buscarril')) return 'Diésel Buscarril';
    if (t.includes('diésel') || t.includes('diesel')) return 'Diésel (Locomotora / DMU)';
    return 'Otros';
}

// Tooltip compartido flotante oscuro CATLEC (idéntico al de análisis de inversión y gráficos EFE)
function efeOperacionExternalTooltip(context) {
    if (typeof efeExternalTooltip === 'function') {
        return efeExternalTooltip(context);
    }
    const { chart, tooltip } = context;
    const tooltipId = 'efe-analysis-tooltip';
    let el = document.getElementById(tooltipId);
    if (!el) {
        el = document.createElement('div');
        el.id = tooltipId;
        el.style.cssText = [
            'position:fixed',
            'background:rgba(15,23,42,0.92)',
            'color:#fff',
            'border-radius:6px',
            'padding:6px 10px',
            'font:12px/1.4 system-ui,sans-serif',
            'pointer-events:none',
            'white-space:nowrap',
            'z-index:9999',
            'box-shadow:0 4px 14px rgba(0,0,0,0.25)',
            'border:1px solid rgba(255,255,255,0.1)',
            'opacity:0'
        ].join(';');
        document.body.appendChild(el);
    }

    if (tooltip.opacity === 0) {
        el.style.transition = 'opacity 0.25s ease-in';
        el.style.opacity = '0';
        return;
    }

    const wasVisible = parseFloat(el.style.opacity || '0') > 0.05;

    const title = (tooltip.title || []).join('\n');
    const bodyLines = (tooltip.body || []).flatMap(b => b.lines);

    el.innerHTML = [
        title ? `<div style="font-weight:700;margin-bottom:3px">${title}</div>` : '',
        ...bodyLines.map(line => `<div>${line}</div>`)
    ].join('');

    const canvasRect = chart.canvas.getBoundingClientRect();
    let left = canvasRect.left + tooltip.caretX + 10;
    let top = canvasRect.top + tooltip.caretY - 10;

    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && left + rect.width > window.innerWidth - 8) {
        left = canvasRect.left + tooltip.caretX - rect.width - 10;
    }

    if (wasVisible) {
        el.style.transition = 'opacity 0.2s ease-out, left 0.15s cubic-bezier(0.2, 0, 0, 1), top 0.15s cubic-bezier(0.2, 0, 0, 1)';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.opacity = '1';
    } else {
        el.style.transition = 'none';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        void el.offsetHeight;
        el.style.transition = 'opacity 0.2s ease-out';
        el.style.opacity = '1';
    }
}

// ── Control de Vistas ────────────────────────────────────────────────────────
function showEfeOperacionView() {
    if (typeof efeMap !== 'undefined' && efeMap && efeMap.getCenter) {
        efeState.savedMapCenter = efeMap.getCenter();
        efeState.savedMapZoom = efeMap.getZoom();
    }
    if (efeState.timelineOpen && typeof hideEfeTimelineView === 'function') {
        hideEfeTimelineView(true);
    }
    if (efeState.investmentOpen && typeof hideEfeInvestmentView === 'function') {
        hideEfeInvestmentView(true);
    }
    efeState.operacionOpen = true;

    const grid = document.querySelector('.efe-dashboard-grid');
    const leftPanel = document.querySelector('.left-panel');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const opPanel = document.getElementById('efe-operacion-full-panel');

    const btnMap = document.getElementById('btn-efe-view-map');
    const btnTl = document.getElementById('btn-efe-view-timeline');
    const btnInv = document.getElementById('btn-efe-view-investment');
    const btnOp = document.getElementById('btn-efe-view-operacion');

    if (grid) grid.style.gridTemplateColumns = '280px 1fr';
    if (leftPanel) leftPanel.style.display = 'flex';
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (opPanel) opPanel.style.display = 'flex';

    if (btnMap) btnMap.classList.remove('active');
    if (btnTl) btnTl.classList.remove('active');
    if (btnInv) btnInv.classList.remove('active');
    if (btnOp) btnOp.classList.add('active');

    if (window.location.hash !== '#operacion') {
        history.replaceState(null, null, '#operacion');
    }

    const currentLines = (typeof currentFilteredEFELines !== 'undefined' && currentFilteredEFELines.length > 0)
        ? currentFilteredEFELines
        : ((window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : []);
    renderEfeOperacionView(currentLines);
}

function hideEfeOperacionView(skipRestoreCenter) {
    efeState.operacionOpen = false;

    const grid = document.querySelector('.efe-dashboard-grid');
    const leftPanel = document.querySelector('.left-panel');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const opPanel = document.getElementById('efe-operacion-full-panel');

    const btnMap = document.getElementById('btn-efe-view-map');
    const btnOp = document.getElementById('btn-efe-view-operacion');

    if (grid) grid.style.gridTemplateColumns = '';
    if (leftPanel) leftPanel.style.display = 'flex';
    if (centerPanel) centerPanel.style.display = 'flex';
    if (rightPanel) rightPanel.style.display = 'flex';
    if (opPanel) opPanel.style.display = 'none';

    if (btnOp) btnOp.classList.remove('active');
    if (btnMap && !efeState.investmentOpen && !efeState.timelineOpen) {
        btnMap.classList.add('active');
    }

    if (window.location.hash === '#operacion') {
        history.replaceState(null, null, window.location.pathname + window.location.search);
    }

    if (typeof efeMap !== 'undefined' && efeMap) {
        efeMap.invalidateSize({ animate: false });
        if (!skipRestoreCenter && efeState.savedMapCenter) {
            efeMap.setView(efeState.savedMapCenter, efeState.savedMapZoom || 5, { animate: false });
        }
        setTimeout(() => {
            if (typeof efeMap !== 'undefined' && efeMap) {
                efeMap.invalidateSize({ animate: false });
                if (!skipRestoreCenter && efeState.savedMapCenter) {
                    efeMap.setView(efeState.savedMapCenter, efeState.savedMapZoom || 5, { animate: false });
                }
            }
        }, 50);
    }
}

// ── Renderizado Principal ───────────────────────────────────────────────────
function renderEfeOperacionView(linesData) {
    const lines = linesData || (typeof currentFilteredEFELines !== 'undefined' && currentFilteredEFELines.length > 0
        ? currentFilteredEFELines
        : ((window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : []));
    if (!lines || lines.length === 0) return;

    renderEfeOperacionKPIs(lines);
    renderEfeChartDemandaPax(lines);
    renderEfeChartDemandaFilial(lines);
    renderEfeChartLongitudEstaciones(lines);
    renderEfeChartSatisfaccion(lines);
    renderEfeChartTraccionFlota(lines);

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// ── 1. Top KPI Banner ─────────────────────────────────────────────────────────
function renderEfeOperacionKPIs(lines) {
    let totalPax = 0;
    let totalStations = 0;
    let satSum = 0;
    let satCount = 0;

    lines.forEach(l => {
        if (typeof l.passengers_2025_mm === 'number') totalPax += l.passengers_2025_mm;
        if (typeof l.stations === 'number') totalStations += l.stations;
        if (typeof l.satisfaction_2025_pct === 'number' && l.satisfaction_2025_pct > 0) {
            satSum += l.satisfaction_2025_pct;
            satCount++;
        }
    });

    const avgSat = satCount > 0 ? (satSum / satCount) : 0;

    const elPax = document.getElementById('efe-kpi-op-pax');
    const elSt = document.getElementById('efe-kpi-op-estaciones');
    const elSat = document.getElementById('efe-kpi-op-satisfaccion');

    if (elPax) elPax.textContent = totalPax.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MM';
    if (elSt) elSt.textContent = totalStations.toLocaleString('es-CL') + ' Estaciones';
    if (elSat) elSat.textContent = avgSat.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

// ── 2. Gráfico 1: Demanda Anual por Servicio (MM Pasajeros) ───────────────────
function renderEfeChartDemandaPax(lines) {
    const ctx = document.getElementById('efeChartDemandaPax');
    if (!ctx) return;

    // Filtrar y ordenar servicios por demanda descendente
    const sorted = [...lines]
        .filter(l => (l.passengers_2025_mm || 0) > 0)
        .sort((a, b) => (b.passengers_2025_mm || 0) - (a.passengers_2025_mm || 0));

    const labels = sorted.map(l => l.service);
    const dataVals = sorted.map(l => l.passengers_2025_mm);
    const bgColors = sorted.map(l => getEfeFilialColor(l.filial));

    if (efeChartDemandaPaxInstance) {
        efeChartDemandaPaxInstance.data.labels = labels;
        efeChartDemandaPaxInstance.data.datasets[0].data = dataVals;
        efeChartDemandaPaxInstance.data.datasets[0].backgroundColor = bgColors;
        efeChartDemandaPaxInstance.options.plugins.tooltip.callbacks = {
            title: (items) => (sorted[items[0].dataIndex] ? sorted[items[0].dataIndex].service : ''),
            label: (c) => [
                ' Filial: ' + (sorted[c.dataIndex] ? sorted[c.dataIndex].filial : ''),
                ' Demanda 2025: ' + (c.raw >= 1 ? Number(c.raw).toFixed(2) : Number(c.raw).toFixed(3)) + ' MM pasajeros'
            ]
        };
        efeChartDemandaPaxInstance.update();
        return;
    }

    efeChartDemandaPaxInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Pasajeros (MM)',
                data: dataVals,
                backgroundColor: bgColors,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 450,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: efeOperacionExternalTooltip,
                    callbacks: {
                        title: (items) => (sorted[items[0].dataIndex] ? sorted[items[0].dataIndex].service : ''),
                        label: (c) => [
                            ' Filial: ' + (sorted[c.dataIndex] ? sorted[c.dataIndex].filial : ''),
                            ' Demanda 2025: ' + (c.raw >= 1 ? Number(c.raw).toFixed(2) : Number(c.raw).toFixed(3)) + ' MM pasajeros'
                        ]
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: {
                        color: '#64748b',
                        font: { size: 9.5 },
                        callback: (v) => v + ' MM'
                    },
                    title: {
                        display: true,
                        text: 'Millones de Pasajeros (Año 2025)',
                        color: '#475569',
                        font: { size: 9, weight: '600' }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: '#1e293b',
                        font: { size: 9.5, weight: '600' }
                    }
                }
            }
        }
    });
}

// ── 3. Gráfico 2: Participación de Demanda por Filial (Doughnut) ──────────────
function renderEfeChartDemandaFilial(lines) {
    const ctx = document.getElementById('efeChartDemandaFilial');
    const legendEl = document.getElementById('efeChartDemandaFilialLegend');
    if (!ctx) return;

    // Agrupar por filial
    const filialMap = {};
    let totalPax = 0;
    lines.forEach(l => {
        const f = l.filial || 'Sin filial';
        const p = l.passengers_2025_mm || 0;
        filialMap[f] = (filialMap[f] || 0) + p;
        totalPax += p;
    });

    const labels = Object.keys(filialMap);
    const dataVals = labels.map(f => filialMap[f]);
    const bgColors = labels.map(f => getEfeFilialColor(f));

    if (efeChartDemandaFilialInstance) {
        efeChartDemandaFilialInstance.data.labels = labels;
        efeChartDemandaFilialInstance.data.datasets[0].data = dataVals;
        efeChartDemandaFilialInstance.data.datasets[0].backgroundColor = bgColors;
        efeChartDemandaFilialInstance.options.plugins.tooltip.callbacks = {
            title: (items) => labels[items[0].dataIndex],
            label: (c) => {
                const pct = totalPax > 0 ? ((c.raw / totalPax) * 100).toFixed(1) : 0;
                return [
                    ' Demanda: ' + Number(c.raw).toFixed(2) + ' MM pax',
                    ' Participación: ' + pct + '%'
                ];
            }
        };
        efeChartDemandaFilialInstance.update();
    } else {
        efeChartDemandaFilialInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataVals,
                    backgroundColor: bgColors,
                    borderWidth: 1.5,
                    borderColor: '#ffffff',
                    hoverOffset: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                animation: {
                    duration: 450,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: efeOperacionExternalTooltip,
                        callbacks: {
                            title: (items) => labels[items[0].dataIndex],
                            label: (c) => {
                                const pct = totalPax > 0 ? ((c.raw / totalPax) * 100).toFixed(1) : 0;
                                return [
                                    ' Demanda: ' + Number(c.raw).toFixed(2) + ' MM pax',
                                    ' Participación: ' + pct + '%'
                                ];
                            }
                        }
                    }
                }
            }
        });
    }

    // Renderizar microleyenda HTML desacoplada
    if (legendEl) {
        legendEl.innerHTML = labels.map((f, i) => {
            const val = dataVals[i];
            const pct = totalPax > 0 ? ((val / totalPax) * 100).toFixed(1) : 0;
            const color = bgColors[i];
            return `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.35rem;font-size:0.7rem;line-height:1.35;">
                    <div style="display:flex;align-items:center;gap:0.35rem;min-width:0;">
                        <span style="width:7px;height:7px;border-radius:50%;background-color:${color};flex-shrink:0;"></span>
                        <span style="color:var(--text-secondary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f}</span>
                    </div>
                    <span style="font-weight:700;color:var(--text-primary);flex-shrink:0;">${pct}%</span>
                </div>
            `;
        }).join('');
    }
}

// ── 4. Gráfico 3: Extensión de Red (km) vs Estaciones (Combo Bar + Line) ──────
function renderEfeChartLongitudEstaciones(lines) {
    const ctx = document.getElementById('efeChartLongitudEstaciones');
    if (!ctx) return;

    // Ordenar por longitud descendente
    const sorted = [...lines].sort((a, b) => (b.length_km || 0) - (a.length_km || 0));

    const labels = sorted.map(l => l.service);
    const dataKm = sorted.map(l => l.length_km || 0);
    const dataStations = sorted.map(l => l.stations || 0);

    if (efeChartLongitudEstacionesInstance) {
        efeChartLongitudEstacionesInstance.data.labels = labels;
        efeChartLongitudEstacionesInstance.data.datasets[0].data = dataKm;
        efeChartLongitudEstacionesInstance.data.datasets[1].data = dataStations;
        efeChartLongitudEstacionesInstance.options.plugins.tooltip.callbacks = {
            title: (items) => (sorted[items[0].dataIndex] ? sorted[items[0].dataIndex].service : ''),
            label: (c) => {
                if (c.datasetIndex === 0) {
                    return ' Extensión: ' + Number(c.raw).toFixed(1) + ' km';
                } else {
                    return ' Estaciones: ' + c.raw + ' paradas';
                }
            }
        };
        efeChartLongitudEstacionesInstance.update();
        return;
    }

    efeChartLongitudEstacionesInstance = new Chart(ctx, {
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Extensión (km)',
                    data: dataKm,
                    backgroundColor: 'rgba(2, 132, 199, 0.82)',
                    borderColor: '#0284c7',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y',
                    order: 2
                },
                {
                    type: 'line',
                    label: 'Estaciones',
                    data: dataStations,
                    borderColor: '#f59e0b',
                    backgroundColor: '#f59e0b',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                    tension: 0.2,
                    yAxisID: 'y1',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 450,
                easing: 'easeOutQuart'
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: efeOperacionExternalTooltip,
                    callbacks: {
                        title: (items) => (sorted[items[0].dataIndex] ? sorted[items[0].dataIndex].service : ''),
                        label: (c) => {
                            if (c.datasetIndex === 0) {
                                return ' Extensión: ' + Number(c.raw).toFixed(1) + ' km';
                            } else {
                                return ' Estaciones: ' + c.raw + ' paradas';
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#334155',
                        font: { size: 9, weight: '500' },
                        maxRotation: 35,
                        minRotation: 20
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: {
                        color: '#0284c7',
                        font: { size: 9 }
                    },
                    title: {
                        display: true,
                        text: 'Longitud (km)',
                        color: '#0284c7',
                        font: { size: 9, weight: '600' }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#d97706',
                        font: { size: 9 }
                    },
                    title: {
                        display: true,
                        text: 'N° Estaciones',
                        color: '#d97706',
                        font: { size: 9, weight: '600' }
                    }
                }
            }
        }
    });
}

// ── 5. Gráfico 4: Índice de Satisfacción Usuaria (%) ───────────────────────────
function renderEfeChartSatisfaccion(lines) {
    const ctx = document.getElementById('efeChartSatisfaccion');
    if (!ctx) return;

    // Solo servicios con dato de satisfacción
    const filtered = lines
        .filter(l => typeof l.satisfaction_2025_pct === 'number' && l.satisfaction_2025_pct > 0)
        .sort((a, b) => b.satisfaction_2025_pct - a.satisfaction_2025_pct);

    const labels = filtered.map(l => l.service);
    const dataVals = filtered.map(l => l.satisfaction_2025_pct);

    // Colores basados en umbral de calidad
    const bgColors = dataVals.map(val => {
        if (val >= 90) return '#10b981'; // Verde óptimo
        if (val >= 80) return '#0284c7'; // Azul bueno
        if (val >= 70) return '#f59e0b'; // Ámbar moderado
        return '#ef4444'; // Rojo bajo
    });

    if (efeChartSatisfaccionInstance) {
        efeChartSatisfaccionInstance.data.labels = labels;
        efeChartSatisfaccionInstance.data.datasets[0].data = dataVals;
        efeChartSatisfaccionInstance.data.datasets[0].backgroundColor = bgColors;
        efeChartSatisfaccionInstance.options.plugins.tooltip.callbacks = {
            title: (items) => (filtered[items[0].dataIndex] ? filtered[items[0].dataIndex].service : ''),
            label: (c) => [
                ' Filial: ' + (filtered[c.dataIndex] ? filtered[c.dataIndex].filial : ''),
                ' Satisfacción 2025: ' + Number(c.raw).toFixed(1) + '%'
            ]
        };
        efeChartSatisfaccionInstance.update();
        return;
    }

    efeChartSatisfaccionInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Satisfacción (%)',
                data: dataVals,
                backgroundColor: bgColors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 450,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: efeOperacionExternalTooltip,
                    callbacks: {
                        title: (items) => (filtered[items[0].dataIndex] ? filtered[items[0].dataIndex].service : ''),
                        label: (c) => [
                            ' Filial: ' + (filtered[c.dataIndex] ? filtered[c.dataIndex].filial : ''),
                            ' Satisfacción 2025: ' + Number(c.raw).toFixed(1) + '%'
                        ]
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#334155',
                        font: { size: 9, weight: '500' },
                        maxRotation: 30,
                        minRotation: 15
                    }
                },
                y: {
                    min: 50,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: {
                        color: '#64748b',
                        font: { size: 9 },
                        callback: (v) => v + '%'
                    },
                    title: {
                        display: true,
                        text: 'Índice de Satisfacción (%)',
                        color: '#475569',
                        font: { size: 9, weight: '600' }
                    }
                }
            }
        }
    });
}

// ── 6. Gráfico 5: Distribución de Tracción y Tecnología (Doughnut) ────────────
function renderEfeChartTraccionFlota(lines) {
    const ctx = document.getElementById('efeChartTraccionFlota');
    const legendEl = document.getElementById('efeChartTraccionFlotaLegend');
    if (!ctx) return;

    const groupMap = {};
    lines.forEach(l => {
        const g = getEfeTractionGroup(l.traction);
        groupMap[g] = (groupMap[g] || 0) + 1;
    });

    const labels = Object.keys(groupMap);
    const dataVals = labels.map(g => groupMap[g]);
    const palette = ['#2563eb', '#8b5cf6', '#d97706', '#ea580c', '#64748b'];
    const bgColors = labels.map((g, i) => palette[i % palette.length]);

    if (efeChartTraccionFlotaInstance) {
        efeChartTraccionFlotaInstance.data.labels = labels;
        efeChartTraccionFlotaInstance.data.datasets[0].data = dataVals;
        efeChartTraccionFlotaInstance.data.datasets[0].backgroundColor = bgColors;
        efeChartTraccionFlotaInstance.options.plugins.tooltip.callbacks = {
            title: (items) => labels[items[0].dataIndex],
            label: (c) => [
                ' Servicios: ' + c.raw,
                ' Proporción: ' + ((c.raw / (lines.length || 1)) * 100).toFixed(1) + '%'
            ]
        };
        efeChartTraccionFlotaInstance.update();
    } else {
        efeChartTraccionFlotaInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataVals,
                    backgroundColor: bgColors,
                    borderWidth: 1.5,
                    borderColor: '#ffffff',
                    hoverOffset: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                animation: {
                    duration: 450,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: efeOperacionExternalTooltip,
                        callbacks: {
                            title: (items) => labels[items[0].dataIndex],
                            label: (c) => [
                                ' Servicios: ' + c.raw,
                                ' Proporción: ' + ((c.raw / (lines.length || 1)) * 100).toFixed(1) + '%'
                            ]
                        }
                    }
                }
            }
        });
    }

    if (legendEl) {
        legendEl.innerHTML = labels.map((g, i) => {
            const count = dataVals[i];
            const pct = ((count / (lines.length || 1)) * 100).toFixed(1);
            const color = bgColors[i];
            return `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.35rem;font-size:0.7rem;line-height:1.35;">
                    <div style="display:flex;align-items:center;gap:0.35rem;min-width:0;">
                        <span style="width:7px;height:7px;border-radius:50%;background-color:${color};flex-shrink:0;"></span>
                        <span style="color:var(--text-secondary);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${g}</span>
                    </div>
                    <span style="font-weight:700;color:var(--text-primary);flex-shrink:0;">${count} <span style="font-weight:400;color:var(--text-muted);font-size:0.65rem;">(${pct}%)</span></span>
                </div>
            `;
        }).join('');
    }
}


