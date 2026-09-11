// ─── static/js/Metro/comunas.js ──────────────────────────────────────────────
// Módulo de Análisis y Estadísticas Comunales para Metro de Santiago (Gran Santiago)

let metroChartPoblacionInstance = null;
let metroPoblacionLineMode = 'hab_est'; // 'hab_est' | 'est_km2'
let metroShowFutureStations = false;

// ─── Normalización y Mapeo Dinámico de Estaciones (desde METRO_DATA.stations) ────

function metroNormalizeComunaText(text) {
    if (typeof window.metroNormalizeStationText === 'function') {
        return window.metroNormalizeStationText(text);
    }
    if (!text) return '';
    return text.toString().toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

// ─── Control de Apertura / Cierre de Vista ──────────────────────────────────────

function showMetroComunasView() {
    if (metroState.timelineOpen && typeof hideMetroTimelineView === 'function') {
        hideMetroTimelineView();
    }
    if (metroState.demandaOpen && typeof hideMetroDemandaView === 'function') {
        hideMetroDemandaView();
    }
    metroState.comunasOpen = true;

    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const comunasPanel = document.getElementById('metro-comunas-full-panel');
    const btnMap = document.getElementById('btn-metro-view-map');
    const btnTl = document.getElementById('btn-metro-view-timeline');
    const btnComunas = document.getElementById('btn-metro-view-comunas');
    const btnDemanda = document.getElementById('btn-metro-view-demanda');

    if (grid) grid.style.gridTemplateColumns = '1fr';
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (comunasPanel) comunasPanel.style.display = 'flex';

    if (btnMap) btnMap.classList.remove('active');
    if (btnTl) btnTl.classList.remove('active');
    if (btnDemanda) btnDemanda.classList.remove('active');
    if (btnComunas) btnComunas.classList.add('active');

    if (typeof window !== 'undefined' && window.location && window.location.hash !== '#comunas' && window.history && window.history.replaceState) {
        history.replaceState(null, null, '#comunas');
    }

    metroRenderComunasPanel();

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function hideMetroComunasView() {
    metroState.comunasOpen = false;

    const tip = document.getElementById('metro-chart-external-tooltip');
    if (tip) tip.style.opacity = '0';

    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const comunasPanel = document.getElementById('metro-comunas-full-panel');
    const btnMap = document.getElementById('btn-metro-view-map');
    const btnComunas = document.getElementById('btn-metro-view-comunas');

    if (grid) grid.style.gridTemplateColumns = '1fr 640px';
    if (centerPanel) centerPanel.style.display = 'flex';
    if (rightPanel) rightPanel.style.display = 'flex';
    if (comunasPanel) comunasPanel.style.display = 'none';

    if (btnComunas) btnComunas.classList.remove('active');
    if (btnMap && !metroState.timelineOpen && !metroState.demandaOpen) btnMap.classList.add('active');

    if (typeof window !== 'undefined' && window.location && window.location.hash === '#comunas' && window.history && window.history.replaceState) {
        history.replaceState(null, null, ' ');
    }

    if (metroMap) {
        setTimeout(() => metroMap.invalidateSize(), 50);
    }
}

function metroRenderComunasPanel() {
    const stats = window.METRO_COMUNAS_STATS;
    const metroData = window.METRO_DATA;
    if (!stats) return;

    // Actualizar KPIs superiores con contexto demográfico
    const elTotal = document.getElementById('metro-comunas-kpi-total');
    const elConMetro = document.getElementById('metro-comunas-kpi-con-metro');
    const elSinMetro = document.getElementById('metro-comunas-kpi-sin-metro');
    const elEnExp = document.getElementById('metro-comunas-kpi-en-expansion');

    const totalCom = stats.total_comunas || 41;
    const conMetro = stats.comunas_con_metro || 27;
    const sinMetro = stats.comunas_sin_metro || 14;
    const enExp = stats.comunas_nuevas_expansion || 4;
    const sinCob = sinMetro - enExp;

    const demo = (metroData && metroData.summary && metroData.summary.demographics) ? metroData.summary.demographics : null;
    const pctPobCon = demo ? demo.pct_pop_with_metro : '80.3';
    const pctPobExp = demo ? demo.pct_pop_in_expansion : '7.8';
    const pctPobSin = demo ? demo.pct_pop_without_metro : '11.9';

    if (elTotal) elTotal.textContent = `${totalCom} (${demo ? (demo.total_population / 1000000).toFixed(2) : '7.58'}M de habitantes)`;
    if (elConMetro) elConMetro.textContent = `${conMetro} (${pctPobCon}% de la población)`;
    if (elEnExp) elEnExp.textContent = `${enExp} (${pctPobExp}% de la población)`;
    if (elSinMetro) elSinMetro.textContent = `${sinCob} (${pctPobSin}% de la población)`;

    // Renderizar los gráficos comunales
    metroRenderComunasCharts();
}

function metroRenderComunasCharts() {
    metroRenderPoblacionChart();
}

// ─── Gráfico Panorámico: Población vs Cobertura Metro (Combo Bar + Line) ───────

function metroRenderPoblacionChart() {
    const ctx = document.getElementById('metroChartComunasPoblacion');
    if (!ctx) return;

    if (metroChartPoblacionInstance) {
        metroChartPoblacionInstance.destroy();
    }

    const dsInfo = getMetroComunasPoblacionDatasets();
    if (!dsInfo) return;

    const { list, isHabEst, dataLine, dataLineFuture, lineLabel, lineLabelFuture } = dsInfo;

    // Ajustar dinámicamente el ancho del canvas para garantizar scroll horizontal fluido, barras más gruesas y espacioso
    const wrapper = document.getElementById('metroChartComunasPoblacionWrapper');
    if (wrapper) {
        const targetWidth = Math.max(2250, (list.length + 2) * 52);
        wrapper.style.width = `${targetWidth}px`;
    }

    const isLight = document.body.classList.contains('light-theme');
    const textColor = isLight ? '#334155' : '#f8fafc';
    const textSecColor = isLight ? '#64748b' : '#94a3b8';
    const gridColor = isLight ? '#e2e8f0' : '#334155';

    // Rótulos del eje X con spacers al inicio y final para desplazar las barras a la derecha
    // y evitar cualquier colisión o solapamiento del rótulo 'Santiago' con el eje congelado
    const labels = ['', ...list.map(c => c.name), ''];

    // Eje Y primario (Barras Base): Cantidad de Estaciones operativas
    const dataEstaciones = [null, ...list.map(c => c.stations_count || 0), null];

    // Eje Y primario (Barras Apiladas): Nuevas Estaciones Futuras (Expansión)
    const dataEstacionesFuturas = [null, ...list.map(c => (c.stations_future || 0)), null];
    const futureBarBgColor = 'rgba(2, 132, 199, 0.75)';
    const futureBarBorderColor = '#0284c7';

    // Colores semánticos de barras según cobertura de Metro
    const bgColors = [
        'transparent',
        ...list.map(c => {
            if (c.has_metro) return 'rgba(37, 99, 235, 0.85)';
            if (c.metro_status === 'En Expansión' || (c.stations_future || 0) > 0) return 'rgba(2, 132, 199, 0.75)';
            return 'rgba(148, 163, 184, 0.45)';
        }),
        'transparent'
    ];
    const borderColors = [
        'transparent',
        ...list.map(c => {
            if (c.has_metro) return '#2563eb';
            if (c.metro_status === 'En Expansión' || (c.stations_future || 0) > 0) return '#0284c7';
            return '#94a3b8';
        }),
        'transparent'
    ];

    // Métrica alternable para la línea en eje Y derecho: Hab/Estación (#10b981) o Estaciones/km² (#f59e0b)
    const activeColor = isHabEst ? '#10b981' : '#f59e0b';
    const y1TitleText = isHabEst ? 'Hab. por Estación' : 'Estaciones / km²';
    const y1TickCallback = isHabEst
        ? (v) => `${(v / 1000).toFixed(0)}k/est`
        : (v) => `${v.toFixed(2)} est/km²`;

    metroChartPoblacionInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Estaciones Operativas',
                    data: dataEstaciones,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 3,
                    yAxisID: 'y',
                    stack: 'stations',
                    order: 3,
                    barPercentage: 0.78,
                    categoryPercentage: 0.88,
                    minBarLength: 5
                },
                {
                    type: 'bar',
                    label: 'Estaciones en Expansión',
                    data: dataEstacionesFuturas,
                    backgroundColor: futureBarBgColor,
                    borderColor: futureBarBorderColor,
                    borderWidth: 1,
                    borderRadius: 3,
                    yAxisID: 'y',
                    stack: 'stations',
                    order: 2,
                    barPercentage: 0.78,
                    categoryPercentage: 0.88,
                    hidden: !metroShowFutureStations
                },
                {
                    type: 'line',
                    label: metroShowFutureStations ? lineLabelFuture : lineLabel,
                    data: metroShowFutureStations ? dataLineFuture : dataLine,
                    borderColor: activeColor,
                    backgroundColor: activeColor,
                    borderWidth: 2.6,
                    borderDash: metroShowFutureStations ? [5, 4] : [],
                    yAxisID: 'y1',
                    order: 0,
                    z: 25,
                    pointRadius: 3.5,
                    pointHoverRadius: 6,
                    pointHitRadius: 10,
                    tension: 0.25,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 10,
                    right: 15
                }
            },
            interaction: {
                mode: 'index',
                intersect: true
            },
            onHover: (event, elements) => {
                const canvas = event?.native?.target || ctx;
                if (canvas) {
                    const hasHoveredBar = elements && elements.length > 0 && elements.some(el => el.index > 0 && el.index <= list.length);
                    canvas.style.cursor = hasHoveredBar ? 'pointer' : 'default';
                }
            },
            onClick: (e, elements) => {
                if (elements && elements.length > 0) {
                    const rawIdx = elements[0].index;
                    if (rawIdx <= 0 || rawIdx > list.length) return;
                    const c = list[rawIdx - 1];
                    if (c) {
                        const comunaName = c.name || c.comuna;
                        metroState.selectedComuna = null;
                        if (typeof metroOnClickComunaFromTable === 'function') {
                            metroOnClickComunaFromTable(comunaName);
                        } else if (typeof metroZoomToComuna === 'function') {
                            metroZoomToComuna(comunaName);
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false,
                        drawTicks: true,
                        tickColor: (ctx) => {
                            if (ctx.index === 0 || ctx.index > list.length) return 'transparent';
                            return gridColor;
                        }
                    },
                    ticks: {
                        color: textColor,
                        font: { size: 9.5, weight: '600' },
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: false,
                        callback: function (val, index) {
                            if (index === 0 || index > list.length) return '';
                            return this.getLabelForValue(val);
                        }
                    }
                },
                y: {
                    stacked: true,
                    position: 'left',
                    beginAtZero: true,
                    suggestedMax: 28,
                    grid: { color: gridColor },
                    ticks: {
                        color: textSecColor,
                        font: { size: 9 },
                        stepSize: 4,
                        callback: (v) => `${v} est`
                    },
                    title: {
                        display: true,
                        text: 'Cantidad de Estaciones',
                        font: { size: 9, weight: '600' },
                        color: textSecColor
                    }
                },
                y1: {
                    stacked: false,
                    position: 'right',
                    beginAtZero: true,
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: activeColor,
                        font: { size: 9, weight: '600' },
                        callback: y1TickCallback
                    },
                    title: {
                        display: true,
                        text: y1TitleText,
                        font: { size: 9, weight: '600' },
                        color: activeColor
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: function (context) {
                        const tip = document.getElementById('metro-chart-external-tooltip');
                        const tooltip = context.tooltip;
                        if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints || tooltip.dataPoints.length === 0) {
                            if (tip) tip.style.opacity = '0';
                            return;
                        }
                        const hasRealData = tooltip.dataPoints.some(dp => dp.dataIndex > 0 && dp.dataIndex <= list.length && dp.raw !== null);
                        if (!hasRealData) {
                            if (tip) tip.style.opacity = '0';
                            return;
                        }
                        if (typeof metroExternalTooltip === 'function') {
                            metroExternalTooltip(context);
                        }
                    },
                    filter: function (item) {
                        if (item.datasetIndex === 1 && (!item.raw || item.raw === 0)) return false;
                        return item.dataIndex > 0 && item.dataIndex <= list.length && item.raw !== null;
                    },
                    callbacks: {
                        title: function (items) {
                            if (!items || !items[0]) return '';
                            const rawIdx = items[0].dataIndex;
                            if (rawIdx <= 0 || rawIdx > list.length) return '';
                            const c = list[rawIdx - 1];
                            if (metroShowFutureStations && (c.stations_future || 0) > 0) {
                                return `${c.name} — ${c.stations_total} est. totales (${c.stations_count} op. + ${c.stations_future} fut.)`;
                            }
                            const stText = c.stations_count > 0 ? `${c.stations_count} estaciones operativas` : c.metro_status;
                            return `${c.name} — ${stText}`;
                        },
                        label: function (ctx) {
                            const rawIdx = ctx.dataIndex;
                            if (rawIdx <= 0 || rawIdx > list.length) return '';
                            const c = list[rawIdx - 1];
                            const isHab = (metroPoblacionLineMode === 'hab_est');
                            if (ctx.datasetIndex === 0) {
                                return ` Estaciones operativas: ${ctx.parsed.y}`;
                            } else if (ctx.datasetIndex === 1) {
                                if (!ctx.parsed.y || ctx.parsed.y === 0) return null;
                                return ` Estaciones en expansión: +${ctx.parsed.y}`;
                            } else if (ctx.datasetIndex === 2) {
                                const statusSuffix = metroShowFutureStations ? '(Proyectada)' : '(Actual)';
                                if (isHab) {
                                    return ` Presión Demográfica ${statusSuffix}: ${ctx.parsed.y ? Number(ctx.parsed.y).toLocaleString('es-CL') : '0'} hab / estación`;
                                } else {
                                    return ` Densidad Infraestructura ${statusSuffix}: ${ctx.parsed.y !== null ? Number(ctx.parsed.y).toFixed(2) : '0.00'} est/km²`;
                                }
                            }
                            return '';
                        },
                        afterBody: function (items) {
                            if (!items || !items[0]) return [];
                            const rawIdx = items[0].dataIndex;
                            if (rawIdx <= 0 || rawIdx > list.length) return [];
                            const c = list[rawIdx - 1];
                            if (!c) return [];
                            const lines = [];
                            if (c.population) {
                                lines.push(`Población: ${c.population.toLocaleString('es-CL')} hab`);
                            }
                            if (c.surface_km2) {
                                lines.push(`Superficie: ${c.surface_km2} km²`);
                            }
                            if (c.lines && c.lines.length > 0) {
                                lines.push(`Líneas operativas: ${c.lines.join(', ')}`);
                            }
                            if (c.future_projects && c.future_projects.length > 0) {
                                lines.push(`Proyectos futuros: ${c.future_projects.join(', ')}`);
                            }
                            return lines;
                        }
                    }
                }
            }
        },
        plugins: [
            {
                id: 'metroPinnedYAxesPlugin',
                afterDraw: (chart) => {
                    syncPinnedYAxes(chart);
                }
            }
        ]
    });

    ctx.onmouseleave = () => {
        ctx.style.cursor = 'default';
    };

    attachPinnedAxesWheelHandlers();
    setTimeout(() => {
        if (metroChartPoblacionInstance) {
            syncPinnedYAxes(metroChartPoblacionInstance);
        }
    }, 50);
}
window.metroRenderPoblacionChart = metroRenderPoblacionChart;

// ─── Lógica de Ejes Y Inmovilizados (Freeze Panes sin interferir con categorías) ──

function getOpaqueCardBgColor() {
    const isLight = document.body.classList.contains('light-theme');
    if (isLight) return '#ffffff';
    const card = document.querySelector('.panel-card');
    if (card) {
        const bg = window.getComputedStyle(card).backgroundColor;
        const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
        }
    }
    return '#1e293b';
}

function updatePinnedAxesShadows() {
    const scrollContainer = document.getElementById('metroComunasScrollContainer');
    const leftCanvas = document.getElementById('metroChartPoblacionAxisLeft');
    const rightCanvas = document.getElementById('metroChartPoblacionAxisRight');
    if (!scrollContainer || !leftCanvas || !rightCanvas) return;

    const isLight = document.body.classList.contains('light-theme');
    const scrollLeft = scrollContainer.scrollLeft;
    const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;

    if (scrollLeft > 4) {
        leftCanvas.style.boxShadow = isLight ? '4px 0 10px rgba(0, 0, 0, 0.10)' : '4px 0 12px rgba(0, 0, 0, 0.45)';
    } else {
        leftCanvas.style.boxShadow = 'none';
    }

    if (maxScroll - scrollLeft > 4) {
        rightCanvas.style.boxShadow = isLight ? '-4px 0 10px rgba(0, 0, 0, 0.10)' : '-4px 0 12px rgba(0, 0, 0, 0.45)';
    } else {
        rightCanvas.style.boxShadow = 'none';
    }
}

function syncPinnedYAxes(chart) {
    if (!chart || !chart.ctx || !chart.chartArea) return;
    if (!chart.chartArea.left || chart.chartArea.left <= 0) return;
    if (!chart.height || chart.height <= 0) return;

    const mainCanvas = chart.canvas;
    const leftCanvas = document.getElementById('metroChartPoblacionAxisLeft');
    const rightCanvas = document.getElementById('metroChartPoblacionAxisRight');
    const scrollContainer = document.getElementById('metroComunasScrollContainer');
    if (!leftCanvas || !rightCanvas || !scrollContainer) return;

    const dpr = chart.currentDevicePixelRatio || window.devicePixelRatio || 1;
    const opaqueBg = getOpaqueCardBgColor();
    const isLight = document.body.classList.contains('light-theme');

    const clientHeight = scrollContainer.clientHeight || mainCanvas.clientHeight || chart.height;
    const leftCssWidth = Math.ceil(chart.chartArea.left);
    const rightCssWidth = Math.ceil(chart.width - chart.chartArea.right);

    if (leftCssWidth <= 0 || rightCssWidth <= 0 || clientHeight <= 0) return;

    const plotBottomCss = Math.ceil(chart.chartArea.bottom);
    // El texto del valor 0 ("0 est" y "0.00 est/km²") está verticalmente centrado en chartArea.bottom,
    // extendiéndose unos 10px por debajo de dicha línea base. Añadimos 12px para capturar el texto íntegro sin recortarlo.
    const copyBottomCss = Math.min(clientHeight, plotBottomCss + 12);
    const copyBottomPx = Math.round(copyBottomCss * dpr);

    // ─── 1. Sincronizar Eje Izquierdo ──────────────────────────────────────────
    const leftPxWidth = Math.round(leftCssWidth * dpr);
    const leftPxHeight = Math.round(clientHeight * dpr);
    if (leftCanvas.width !== leftPxWidth || leftCanvas.height !== leftPxHeight) {
        leftCanvas.width = leftPxWidth;
        leftCanvas.height = leftPxHeight;
        leftCanvas.style.width = `${leftCssWidth}px`;
        leftCanvas.style.height = `${clientHeight}px`;
    }

    const ctxL = leftCanvas.getContext('2d');
    ctxL.save();
    ctxL.fillStyle = opaqueBg;
    ctxL.fillRect(0, 0, leftPxWidth, leftPxHeight);

    // Copiar el eje Y desde mainCanvas incluyendo la mitad inferior del rótulo '0 est'
    ctxL.drawImage(
        mainCanvas,
        0, 0, leftPxWidth, copyBottomPx,
        0, 0, leftPxWidth, copyBottomPx
    );

    // Borde delimitador vertical estilo inmovilizar paneles de Excel
    ctxL.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.14)';
    ctxL.lineWidth = dpr;
    ctxL.beginPath();
    ctxL.moveTo(leftPxWidth - (dpr / 2), 0);
    ctxL.lineTo(leftPxWidth - (dpr / 2), leftPxHeight);
    ctxL.stroke();
    ctxL.restore();

    // ─── 2. Sincronizar Eje Derecho ───────────────────────────────────────────
    const rightPxWidth = Math.round(rightCssWidth * dpr);
    const rightPxHeight = Math.round(clientHeight * dpr);
    if (rightCanvas.width !== rightPxWidth || rightCanvas.height !== rightPxHeight) {
        rightCanvas.width = rightPxWidth;
        rightCanvas.height = rightPxHeight;
        rightCanvas.style.width = `${rightCssWidth}px`;
        rightCanvas.style.height = `${clientHeight}px`;
    }

    const ctxR = rightCanvas.getContext('2d');
    ctxR.save();
    ctxR.fillStyle = opaqueBg;
    ctxR.fillRect(0, 0, rightPxWidth, rightPxHeight);

    // Copiar el eje Y derecho incluyendo la mitad inferior del rótulo '0.00 est/km²'
    const rightSrcPx = Math.round(chart.chartArea.right * dpr);
    ctxR.drawImage(
        mainCanvas,
        rightSrcPx, 0, rightPxWidth, copyBottomPx,
        0, 0, rightPxWidth, copyBottomPx
    );

    // Borde delimitador vertical
    ctxR.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.14)';
    ctxR.lineWidth = dpr;
    ctxR.beginPath();
    ctxR.moveTo(dpr / 2, 0);
    ctxR.lineTo(dpr / 2, rightPxHeight);
    ctxR.stroke();
    ctxR.restore();

    updatePinnedAxesShadows();
}

function attachPinnedAxesWheelHandlers() {
    const scrollContainer = document.getElementById('metroComunasScrollContainer');
    const leftCanvas = document.getElementById('metroChartPoblacionAxisLeft');
    const rightCanvas = document.getElementById('metroChartPoblacionAxisRight');
    if (!scrollContainer) return;

    const onWheel = (e) => {
        let delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (e.deltaMode === 1) {
            delta *= 33; // Normalización para eventos por línea (Firefox en Windows)
        } else if (e.deltaMode === 2) {
            delta *= 100;
        }

        if (delta !== 0) {
            scrollContainer.scrollLeft += delta;
            updatePinnedAxesShadows();
            const tip = document.getElementById('metro-chart-external-tooltip');
            if (tip) tip.style.opacity = '0';
            e.preventDefault();
        }
    };

    if (!scrollContainer._wheelBound) {
        scrollContainer.addEventListener('wheel', onWheel, { passive: false });
        scrollContainer._wheelBound = true;
    }
    if (leftCanvas && !leftCanvas._wheelBound) {
        leftCanvas.addEventListener('wheel', onWheel, { passive: false });
        leftCanvas._wheelBound = true;
    }
    if (rightCanvas && !rightCanvas._wheelBound) {
        rightCanvas.addEventListener('wheel', onWheel, { passive: false });
        rightCanvas._wheelBound = true;
    }

    if (!scrollContainer._scrollShadowBound) {
        scrollContainer.addEventListener('scroll', () => {
            updatePinnedAxesShadows();
            const tip = document.getElementById('metro-chart-external-tooltip');
            if (tip) tip.style.opacity = '0';
        }, { passive: true });
        scrollContainer._scrollShadowBound = true;
    }
}


function getMetroFutureStationsMap() {
    const map = {};
    if (!window.METRO_DATA || !Array.isArray(window.METRO_DATA.stations)) return map;

    window.METRO_DATA.stations.forEach(st => {
        const status = (st.status || '').toString().trim().toLowerCase();
        // Columna "estado" == "En Proyecto / Construcción"
        const isFuture = status === 'en proyecto / construcción' ||
                         status === 'en proyecto / construccion' ||
                         status.includes('proyecto') ||
                         status.includes('construcci');
        if (isFuture) {
            let coms = [];
            if (Array.isArray(st.communes) && st.communes.length > 0) {
                coms = st.communes;
            } else if (st.commune) {
                coms = st.commune.split(',').map(s => s.trim());
            }
            coms.forEach(c => {
                const norm = metroNormalizeComunaText(c);
                if (norm) {
                    map[norm] = (map[norm] || 0) + 1;
                }
            });
        }
    });
    return map;
}

function getMetroComunasSortedList() {
    const metroData = window.METRO_DATA;
    if (!metroData || !metroData.communes || metroData.communes.length === 0) return [];

    const futMap = getMetroFutureStationsMap();
    const list = metroData.communes.map(c => {
        const cNorm = metroNormalizeComunaText(c.name);
        const futCount = (typeof c.stations_future === 'number')
            ? c.stations_future
            : (futMap[cNorm] || 0);
        const opCount = c.stations_count || 0;
        const tot = opCount + futCount;
        return {
            ...c,
            stations_count: opCount,
            stations_future: futCount,
            stations_total: tot,
            hab_per_station_future: tot > 0 && c.population ? Math.round(c.population / tot) : null,
            density_future_km2: tot > 0 && c.surface_km2 ? Number((tot / c.surface_km2).toFixed(2)) : (tot > 0 ? 0 : null)
        };
    });

    list.sort((a, b) => {
        const stA = a.stations_count || 0;
        const stB = b.stations_count || 0;
        if (stB !== stA) return stB - stA;
        const expA = (a.metro_status === 'En Expansión' || (a.stations_future || 0) > 0) ? 1 : 0;
        const expB = (b.metro_status === 'En Expansión' || (b.stations_future || 0) > 0) ? 1 : 0;
        if (expB !== expA) return expB - expA;
        return (b.population || 0) - (a.population || 0);
    });

    return list;
}

function getMetroComunasPoblacionDatasets() {
    const list = getMetroComunasSortedList();
    if (!list || list.length === 0) return null;

    const isHabEst = (metroPoblacionLineMode === 'hab_est');
    const dataLine = [
        null,
        ...list.map(c => {
            if (isHabEst) {
                return c.stations_count > 0 ? (c.hab_per_station || Math.round(c.population / c.stations_count)) : null;
            } else {
                return (c.surface_km2 > 0 && c.stations_count > 0) ? Number((c.stations_count / c.surface_km2).toFixed(2)) : (c.stations_count > 0 ? 0 : null);
            }
        }),
        null
    ];

    const dataLineFuture = [
        null,
        ...list.map(c => {
            const tot = (c.stations_count || 0) + (c.stations_future || 0);
            if (isHabEst) {
                return tot > 0 ? (c.hab_per_station_future || Math.round(c.population / tot)) : null;
            } else {
                return (c.surface_km2 > 0 && tot > 0)
                    ? (c.density_future_km2 !== undefined && c.density_future_km2 !== null ? Number(c.density_future_km2) : Number((tot / c.surface_km2).toFixed(2)))
                    : (tot > 0 ? 0 : null);
            }
        }),
        null
    ];

    const lineLabel = isHabEst ? 'Habitantes / Estación (Presión Demográfica)' : 'Estaciones / km² (Densidad Red)';
    const lineLabelFuture = isHabEst ? 'Hab. / Estación Proyectado (con futuras)' : 'Estaciones / km² Proyectado (con futuras)';

    return { list, isHabEst, dataLine, dataLineFuture, lineLabel, lineLabelFuture };
}

// ─── Control de Alternancia de Métrica en Línea (Hab/Est vs Est/km²) ───────────

function setMetroPoblacionLineMode(mode) {
    if (metroPoblacionLineMode === mode) return;
    metroPoblacionLineMode = mode;

    const isHabEst = (mode === 'hab_est');
    const activeColor = isHabEst ? '#10b981' : '#f59e0b';

    const btnHab = document.getElementById('btn-metro-pob-hab-est');
    const btnKm2 = document.getElementById('btn-metro-pob-est-km2');
    const legendLabel = document.getElementById('metro-pob-legend-line-label');
    const legendIndicator = document.getElementById('metro-pob-legend-line-indicator');
    const descEl = document.getElementById('metro-pob-header-desc');

    if (btnHab && btnKm2) {
        if (isHabEst) {
            btnHab.style.background = 'var(--primary, #2563eb)';
            btnHab.style.color = '#fff';
            btnKm2.style.background = 'transparent';
            btnKm2.style.color = 'var(--text-muted)';
            if (legendLabel) legendLabel.textContent = 'Hab/Estación (Eje Der)';
            if (legendIndicator) legendIndicator.style.background = '#10b981';
            if (descEl) descEl.textContent = '41 comunas del Gran Santiago — Cantidad de estaciones y presión demográfica (hab/estación)';
        } else {
            btnKm2.style.background = 'var(--primary, #2563eb)';
            btnKm2.style.color = '#fff';
            btnHab.style.background = 'transparent';
            btnHab.style.color = 'var(--text-muted)';
            if (legendLabel) legendLabel.textContent = 'Est/km² (Eje Der)';
            if (legendIndicator) legendIndicator.style.background = '#f59e0b';
            if (descEl) descEl.textContent = '41 comunas del Gran Santiago — Cantidad de estaciones y densidad territorial (estaciones/km²)';
        }
    }

    const legendFutureIndicator = document.getElementById('metro-pob-legend-future-line-indicator');
    if (legendFutureIndicator) {
        legendFutureIndicator.style.borderTopColor = activeColor;
    }

    const legendLineLabel = document.getElementById('metro-pob-legend-future-line-label');
    if (legendLineLabel) {
        legendLineLabel.textContent = isHabEst ? 'Hab/Est Proyectado (Eje Der)' : 'Est/km² Proyectado (Eje Der)';
    }

    // Actualización reactiva fluida: anima la transición de la línea
    if (metroChartPoblacionInstance && metroChartPoblacionInstance.data && metroChartPoblacionInstance.data.datasets.length > 2) {
        const lineInfo = getMetroComunasPoblacionDatasets();
        if (!lineInfo) return;

        const dsLine = metroChartPoblacionInstance.data.datasets[2];
        dsLine.data = metroShowFutureStations ? lineInfo.dataLineFuture : lineInfo.dataLine;
        dsLine.label = metroShowFutureStations ? lineInfo.lineLabelFuture : lineInfo.lineLabel;
        dsLine.borderDash = metroShowFutureStations ? [5, 4] : [];
        dsLine.borderColor = activeColor;
        dsLine.backgroundColor = activeColor;

        const y1TitleText = isHabEst ? 'Hab. por Estación' : 'Estaciones / km²';
        const y1TickCallback = isHabEst
            ? (v) => `${(v / 1000).toFixed(0)}k/est`
            : (v) => `${v.toFixed(2)} est/km²`;

        // Modificar el eje Y derecho
        if (metroChartPoblacionInstance.options.scales && metroChartPoblacionInstance.options.scales.y1) {
            const y1 = metroChartPoblacionInstance.options.scales.y1;
            y1.title.text = y1TitleText;
            y1.title.color = activeColor;
            y1.ticks.color = activeColor;
            y1.ticks.callback = y1TickCallback;
        }

        // Llamar update() nativo de Chart.js: anima únicamente la transición de la línea
        metroChartPoblacionInstance.update();
    } else {
        metroRenderPoblacionChart();
    }
}
window.setMetroPoblacionLineMode = setMetroPoblacionLineMode;

// ─── Control de Visualización de Futuras Estaciones (Apiladas y Proyección) ──

function toggleMetroFutureStations() {
    metroShowFutureStations = !metroShowFutureStations;
    updateMetroFutureStationsUI();
}
window.toggleMetroFutureStations = toggleMetroFutureStations;

function updateMetroFutureStationsUI() {
    const btn = document.getElementById('btn-metro-pob-future');
    const text = document.getElementById('btn-metro-pob-future-text');
    const legendSolid = document.getElementById('metro-pob-legend-solid-line');
    const legendLine = document.getElementById('metro-pob-legend-future-line');
    const legendLineLabel = document.getElementById('metro-pob-legend-future-line-label');

    const isHab = (metroPoblacionLineMode === 'hab_est');
    const activeColor = isHab ? '#10b981' : '#f59e0b';

    if (metroShowFutureStations) {
        if (btn) {
            btn.style.background = 'rgba(2, 132, 199, 0.16)';
            btn.style.borderColor = '#0284c7';
            btn.style.color = '#0284c7';
        }
        if (text) text.textContent = 'Ocultar Futuras Estaciones';
        if (legendSolid) legendSolid.style.display = 'none';
        if (legendLine) {
            legendLine.style.display = 'inline-flex';
            const futureInd = document.getElementById('metro-pob-legend-future-line-indicator');
            if (futureInd) futureInd.style.borderTopColor = activeColor;
            if (legendLineLabel) {
                legendLineLabel.textContent = isHab
                    ? 'Hab/Est Proyectado (Eje Der)'
                    : 'Est/km² Proyectado (Eje Der)';
            }
        }
    } else {
        if (btn) {
            btn.style.background = 'var(--bg-hover, rgba(0,0,0,0.06))';
            btn.style.borderColor = 'var(--border-color)';
            btn.style.color = 'var(--text-muted)';
        }
        if (text) text.textContent = '+ Futuras Estaciones';
        if (legendSolid) legendSolid.style.display = 'inline-flex';
        if (legendLine) legendLine.style.display = 'none';
    }

    if (metroChartPoblacionInstance && metroChartPoblacionInstance.data && metroChartPoblacionInstance.data.datasets.length > 2) {
        const lineInfo = getMetroComunasPoblacionDatasets();
        if (!lineInfo) return;

        // Asegurar valores actualizados para la barra apilada de futuras estaciones
        metroChartPoblacionInstance.data.datasets[1].data = [null, ...lineInfo.list.map(c => (c.stations_future || 0)), null];

        // Animar la barra apilada de estaciones en expansión (se apila o desapila)
        metroChartPoblacionInstance.data.datasets[1].hidden = !metroShowFutureStations;

        // Desplazamiento dinámico animado de los puntos de la línea hacia su nueva posición
        const dsLine = metroChartPoblacionInstance.data.datasets[2];
        dsLine.data = metroShowFutureStations ? lineInfo.dataLineFuture : lineInfo.dataLine;
        dsLine.label = metroShowFutureStations ? lineInfo.lineLabelFuture : lineInfo.lineLabel;
        dsLine.borderDash = metroShowFutureStations ? [5, 4] : [];
        dsLine.borderColor = activeColor;
        dsLine.backgroundColor = activeColor;

        // Si hubiera un cuarto dataset legacy en memoria, mantenerlo oculto
        if (metroChartPoblacionInstance.data.datasets.length > 3) {
            metroChartPoblacionInstance.data.datasets[3].hidden = true;
        }

        // Llamar update() nativo de Chart.js: anima el movimiento fluido de la línea y el apilado de barras
        metroChartPoblacionInstance.update();
    }
}
window.updateMetroFutureStationsUI = updateMetroFutureStationsUI;

// ─── Interacción con el Mapa (Zoom a Comuna) ───────────────────────────────────

function metroZoomToComuna(comunaName) {
    if (metroState.comunasOpen && typeof hideMetroComunasView === 'function') {
        hideMetroComunasView();
    }

    if (!metroMap) return;
    if (typeof metroMap.invalidateSize === 'function') {
        metroMap.invalidateSize({ animate: false });
    }

    if (!metroComunasLayer) return;

    if (!metroShowComunas && typeof metroToggleComunas === 'function') {
        metroToggleComunas(true);
        const chk = document.getElementById('metro-toggle-comunas');
        if (chk) chk.checked = true;
    }

    // Resetear estilos anteriores de todas las comunas
    metroComunasLayer.eachLayer(layer => {
        metroComunasLayer.resetStyle(layer);
    });

    const normTarget = typeof metroNormalizeComunaText === 'function'
        ? metroNormalizeComunaText(comunaName)
        : (typeof metroNormalizeText === 'function' ? metroNormalizeText(comunaName) : (comunaName ? comunaName.toString().toLowerCase().trim() : ''));

    let targetLayer = null;
    metroComunasLayer.eachLayer(layer => {
        if (layer.feature && layer.feature.properties) {
            const propComuna = layer.feature.properties.comuna || '';
            const normProp = typeof metroNormalizeComunaText === 'function'
                ? metroNormalizeComunaText(propComuna)
                : (typeof metroNormalizeText === 'function' ? metroNormalizeText(propComuna) : propComuna.toString().toLowerCase().trim());
            if (normProp === normTarget) {
                targetLayer = layer;
            }
        }
    });

    if (targetLayer) {
        if (targetLayer.getBounds) {
            const bounds = targetLayer.getBounds();
            if (bounds && bounds.isValid && bounds.isValid()) {
                if (typeof metroMap.flyToBounds === 'function') {
                    metroMap.flyToBounds(bounds, { padding: [50, 50], maxZoom: 14, duration: 0.8 });
                } else {
                    metroMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
                }
            }
        }
        // Resaltar la comuna seleccionada
        targetLayer.setStyle({
            weight: 3.5,
            color: '#059669',
            fillOpacity: 0.28,
            opacity: 1.0
        });
        if (targetLayer.bringToFront) targetLayer.bringToFront();
    }
}

// ─── Exportar funciones globales a window ──────────────────────────────────────
window.showMetroComunasView = showMetroComunasView;
window.hideMetroComunasView = hideMetroComunasView;
window.metroRenderComunasPanel = metroRenderComunasPanel;
window.metroRenderComunasCharts = metroRenderComunasCharts;
window.metroZoomToComuna = metroZoomToComuna;
