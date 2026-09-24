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

let lastRenderedEfeDemandLines = [];
let efeSatisfactionViewMode = 'trend'; // 'trend' | 'ranking'
let lastRenderedEfeLines = [];

const EFE_OPERACION_FILIAL_COLORS = {
    'EFE Central': '#d92534',
    'EFE Valparaíso': '#1694b8',
    'EFE Sur': '#2b5ec9',
    'EFE Arica - La Paz': '#1e9952',
    'EFE Arica-La Paz': '#1e9952',
    'Sin filial específica': '#64748b',
    'Nacional': '#64748b'
};

const EFE_EXTRA_PALETTE = ['#0f3b6c', '#d92534', '#2b5ec9', '#1e9952', '#1694b8', '#e69500', '#64748b'];

function getEfeFilialColor(filial) {
    if (EFE_OPERACION_FILIAL_COLORS[filial]) return EFE_OPERACION_FILIAL_COLORS[filial];
    const allFiliales = window.EFE_DATA?.demand_filiales || Object.keys(window.EFE_DATA?.demand_summary || {});
    const idx = allFiliales.indexOf(filial);
    if (idx >= 0) {
        return EFE_EXTRA_PALETTE[idx % EFE_EXTRA_PALETTE.length];
    }
    return '#2b5ec9';
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
const efeOperacionExternalTooltip = (typeof efeExternalTooltip === 'function')
    ? efeExternalTooltip
    : CatlecTooltip.create({ domId: 'efe-analysis-tooltip' });

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

    if (efeChartDemandaFilialInstance) {
        efeChartDemandaFilialInstance.destroy();
        efeChartDemandaFilialInstance = null;
    }

    renderEfeOperacionKPIs(lines);
    renderEfeChartDemandaPax(lines);
    renderEfeChartLongitudEstaciones(lines);
    renderEfeChartSatisfaccion(lines);
    renderEfeChartTraccionFlota(lines);

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

/**
 * Determina dinámicamente el año más reciente disponible en los datos (demand_years,
 * o si no existiera, el máximo año presente en satisfaction_history de las líneas).
 * Los campos 'passengers_2025_mm'/'satisfaction_2025_pct' del ETL siempre contienen
 * el último año detectado en el Excel, sin importar si ese año es literalmente 2025.
 */
function getEfeLatestYear() {
    const years = window.EFE_DATA?.demand_years;
    if (Array.isArray(years) && years.length > 0) {
        return years[years.length - 1];
    }
    const allLines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
    let maxYear = null;
    allLines.forEach(l => {
        if (l.satisfaction_history) {
            Object.keys(l.satisfaction_history).forEach(y => {
                if (!maxYear || y > maxYear) maxYear = y;
            });
        }
    });
    return maxYear || '2025';
}

/**
 * Obtiene la demanda agregada anual (en millones de pasajeros) para una filial o conjunto de líneas.
 * Prioriza la cifra oficial CMF 6.2.iv almacenada en demand_summary (hoja Demanda Histórica)
 * para reflejar con exactitud los balances oficiales y evitar discrepancias por definición de servicios.
 */
function calculateFilialDemand(lines, year, filialName) {
    const fName = filialName || (lines && lines.length > 0 ? lines[0].filial : null);
    if (fName && window.EFE_DATA?.demand_summary?.[fName]) {
        const val = window.EFE_DATA.demand_summary[fName][String(year)];
        if (typeof val === 'number') return val;
    }

    if (!lines || lines.length === 0) return null;
    let sum = 0;
    let hasVal = false;
    let biotrenHandled = false;

    lines.forEach(l => {
        let val = null;
        if (l.demand_history && typeof l.demand_history[year] === 'number') {
            val = l.demand_history[year];
        } else if (String(year) === getEfeLatestYear() && typeof l.passengers_2025_mm === 'number') {
            val = l.passengers_2025_mm;
        }

        if (typeof val === 'number' && !isNaN(val)) {
            // Evitar duplicar el conteo de la red Biotren si ambas líneas están presentes
            if (l.id === 'SRV-07' || l.id === 'SRV-08' || l.id === 'SRV-07;SRV-08') {
                if (biotrenHandled) return;
                biotrenHandled = true;
            }
            sum += val;
            hasVal = true;
        }
    });

    return hasVal ? Math.round(sum * 100) / 100 : null;
}

/**
 * Calcula dinámicamente la demanda total (en millones de pasajeros) para un año dado,
 * sumando en tiempo real todas las filiales disponibles en demand_summary.
 * Si se pasa un filtro de filiales, suma exclusivamente las seleccionadas.
 */
function getEfeDemandTotalForYear(year, filialesFilter) {
    const demandSummary = window.EFE_DATA?.demand_summary;
    if (!demandSummary) return 0;

    const allFiliales = window.EFE_DATA?.demand_filiales || Object.keys(demandSummary);
    const targetFiliales = (filialesFilter && filialesFilter.length > 0)
        ? filialesFilter
        : allFiliales;

    let sum = 0;
    targetFiliales.forEach(f => {
        const val = demandSummary[f]?.[String(year)];
        if (typeof val === 'number' && !isNaN(val)) {
            sum += val;
        }
    });

    return Math.round(sum * 100) / 100;
}

/**
 * Calcula dinámicamente la satisfacción ponderada por afluencia (pasajeros transportados)
 * para un subconjunto de líneas y un año específico.
 * Metodología oficial EFE (Memoria Integrada 2025, pág. 59: "Satisfacción NETA ponderada por afluencia"):
 *   Sat_Ponderada = Sum(Sat_i * Pax_i) / Sum(Pax_i)
 */
function calculateWeightedSatisfaction(lines, year) {
    if (!lines || lines.length === 0) return null;
    let weightedSum = 0;
    let totalWeight = 0;
    let biotrenHandled = false;

    lines.forEach(l => {
        let sat = null;
        if (l.satisfaction_history && typeof l.satisfaction_history[year] === 'number') {
            sat = l.satisfaction_history[year];
        } else if (String(year) === getEfeLatestYear() && typeof l.satisfaction_2025_pct === 'number') {
            sat = l.satisfaction_2025_pct;
        }

        if (typeof sat === 'number' && sat > 0) {
            let weight = (typeof l.passengers_2025_mm === 'number' && l.passengers_2025_mm > 0)
                ? l.passengers_2025_mm
                : 0.1;

            if (l.id === 'SRV-07' || l.id === 'SRV-08' || l.id === 'SRV-07;SRV-08') {
                if (biotrenHandled) return;
                biotrenHandled = true;
            }

            weightedSum += sat * weight;
            totalWeight += weight;
        }
    });

    if (totalWeight <= 0) return null;
    return Math.round(weightedSum / totalWeight);
}

/**
 * Calcula el promedio consolidado de satisfacción para toda la red EFE en un año dado,
 * ponderando cada filial por su demanda de pasajeros según la metodología oficial (valores enteros).
 */
function calculateEfeTotalSatisfaction(year) {
    const allLines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
    const demandSummary = window.EFE_DATA?.demand_summary || {};
    const allFiliales = window.EFE_DATA?.demand_filiales || Object.keys(demandSummary);

    let wSatSum = 0;
    let wSatPax = 0;

    allFiliales.forEach(filial => {
        const fPax = demandSummary[filial]?.[String(year)] ?? demandSummary[filial]?.[getEfeLatestYear()];
        const fLines = allLines.filter(l => l.filial === filial);
        const fSatRaw = calculateWeightedSatisfaction(fLines, year);
        if (typeof fPax === 'number' && typeof fSatRaw === 'number') {
            wSatSum += fSatRaw * fPax;
            wSatPax += fPax;
        }
    });

    if (wSatPax > 0) {
        return Math.round(wSatSum / wSatPax);
    }
    return calculateWeightedSatisfaction(allLines, year);
}

// ── 1. Top KPI Banner ─────────────────────────────────────────────────────────
function renderEfeOperacionKPIs(lines) {
    const allLines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
    const demandSummary = window.EFE_DATA?.demand_summary || {};
    const allFiliales = window.EFE_DATA?.demand_filiales || Object.keys(demandSummary);
    const activeFiliales = [...new Set((lines || []).map(l => l.filial).filter(Boolean))];

    const latestYear = getEfeLatestYear();
    let totalPax = 0;
    // Si están seleccionadas todas las líneas o todas las filiales (o no hay filtro)
    if (!lines || lines.length >= allLines.length || activeFiliales.length === allFiliales.length) {
        totalPax = getEfeDemandTotalForYear(latestYear);
    } else {
        // Calcular total según las filiales activas seleccionadas
        activeFiliales.forEach(filial => {
            const linesInFilial = lines.filter(l => l.filial === filial);
            const totalLinesInFilial = allLines.filter(l => l.filial === filial).length;

            // Si la filial completa está seleccionada
            if (demandSummary[filial] && typeof demandSummary[filial][latestYear] === 'number' && linesInFilial.length === totalLinesInFilial && totalLinesInFilial > 0) {
                totalPax += demandSummary[filial][latestYear];
            } else {
                // Caso de servicio individual filtrado
                let biotrenHandled = false;
                linesInFilial.forEach(l => {
                    if (typeof l.passengers_2025_mm === 'number') {
                        if (l.id === 'SRV-07' || l.id === 'SRV-08' || l.id === 'SRV-07;SRV-08') {
                            if (biotrenHandled) return;
                            biotrenHandled = true;
                        }
                        totalPax += l.passengers_2025_mm;
                    }
                });
            }
        });
        totalPax = Math.round(totalPax * 100) / 100;
    }

    // Cálculo dinámico de satisfacción 2025 ponderada para las líneas activas
    // Metodología oficial EFE (Memoria 2025 pág. 59: "Satisfacción NETA ponderada por afluencia"):
    // Al estar seleccionadas todas las filiales (vista global), se ponderan los resultados de cada filial
    // según su demanda consolidada oficial (Valparaíso 23.3 MM @ 69%, Central 30.3 MM @ 83%, Sur 12.5 MM @ 91%),
    // lo que da exactamente 80% (79.58% redondeado a entero como publica EFE).
    let avgSat = 0;
    if (!lines || lines.length >= allLines.length || activeFiliales.length === allFiliales.length) {
        let wSatSum = 0;
        let wSatPax = 0;
        allFiliales.forEach(filial => {
            const fPax = demandSummary[filial]?.[latestYear];
            const fLines = allLines.filter(l => l.filial === filial);
            const fSatRaw = calculateWeightedSatisfaction(fLines, latestYear);
            const fSat = typeof fSatRaw === 'number' ? Math.round(fSatRaw) : null;
            if (typeof fPax === 'number' && typeof fSat === 'number') {
                wSatSum += fSat * fPax;
                wSatPax += fPax;
            }
        });
        avgSat = wSatPax > 0 ? Math.round(wSatSum / wSatPax) : 0;
    } else {
        avgSat = calculateWeightedSatisfaction(lines, latestYear) || 0;
    }

    // Cálculo de Estaciones Activas: Cantidad de estaciones con "Si" en la columna 'En Operacion'
    const allStations = (window.EFE_DATA && window.EFE_DATA.stations) ? window.EFE_DATA.stations : [];
    let activeStationsCount = 0;

    if (lines && lines.length > 0 && lines.length < (window.EFE_DATA?.lines?.length || 999)) {
        // Filtrado por servicios específicos: estaciones en operación asociadas a las líneas activas
        const serviceNames = new Set(lines.map(l => (l.service || '').toLowerCase().trim()));
        const matched = allStations.filter(s => {
            const inOp = s.in_operation === true || s.in_operation === 'Si' || s.in_operation === 'si';
            if (!inOp) return false;
            return (s.services || []).some(serv => serviceNames.has(serv.toLowerCase().trim()));
        });
        activeStationsCount = matched.length;
    } else {
        // Total global de estaciones activas en operación
        activeStationsCount = allStations.filter(s => s.in_operation === true || s.in_operation === 'Si' || s.in_operation === 'si').length;
    }

    const elPax = document.getElementById('efe-kpi-op-pax');
    const elSt = document.getElementById('efe-kpi-op-estaciones');
    const elSat = document.getElementById('efe-kpi-op-satisfaccion');

    if (elPax) elPax.textContent = totalPax.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MM';
    if (elSt) elSt.textContent = activeStationsCount.toLocaleString('es-CL') + ' Estaciones';
    if (elSat) elSat.textContent = avgSat.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + '%';
}

// ── 2. Gráfico 1: Demanda de Pasajeros por Filial (Barras Apiladas) ────────────
function renderEfeChartDemandaPax(linesData) {
    const ctx = document.getElementById('efeChartDemandaPax');
    const legendEl = document.getElementById('efeChartDemandaPaxLegend');
    if (!ctx) return;

    if (linesData && linesData.length > 0) {
        lastRenderedEfeDemandLines = linesData;
    }
    const lines = (lastRenderedEfeDemandLines && lastRenderedEfeDemandLines.length > 0)
        ? lastRenderedEfeDemandLines
        : ((window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : []);

    const demandSummary = window.EFE_DATA?.demand_summary || {};
    const allFiliales = window.EFE_DATA?.demand_filiales || Object.keys(demandSummary);

    // Obtener años dinámicamente desde demand_years o analizando las claves de demand_summary
    let years = window.EFE_DATA?.demand_years;
    if (!Array.isArray(years) || years.length === 0) {
        const yearSet = new Set();
        Object.values(demandSummary).forEach(fMap => {
            if (fMap && typeof fMap === 'object') {
                Object.keys(fMap).forEach(y => {
                    if (/^\d{4}$/.test(y)) yearSet.add(y);
                });
            }
        });
        years = Array.from(yearSet).sort((a, b) => Number(a) - Number(b));
    }
    if (!years || years.length === 0) {
        years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
    }

    // Filiales activas según el filtro de líneas actual
    const activeFilialesInLines = [...new Set(lines.map(l => l.filial).filter(Boolean))];
    const isFiltered = activeFilialesInLines.length > 0 && activeFilialesInLines.length < allFiliales.length;
    const filialesToRender = isFiltered
        ? allFiliales.filter(f => activeFilialesInLines.includes(f))
        : allFiliales;

    // Generar datasets apilados por filial dinámica
    const datasets = filialesToRender.map(fName => {
        const fColor = getEfeFilialColor(fName);
        const fData = years.map(y => {
            const val = demandSummary[fName]?.[y];
            return typeof val === 'number' ? val : 0;
        });

        return {
            type: 'bar',
            label: fName,
            data: fData,
            backgroundColor: `${fColor}cc`,
            borderColor: fColor,
            borderWidth: 1,
            borderRadius: 2,
            stack: 'demanda'
        };
    });

    // Microleyenda en cabecera con cápsula / píldora redondeada
    if (legendEl) {
        legendEl.innerHTML = datasets.map(ds => `
            <span style="display:inline-flex;align-items:center;gap:0.3rem;color:var(--text-primary);font-size:0.62rem;font-weight:600;">
                <span style="width:13px;height:5.5px;border-radius:9999px;background-color:${ds.borderColor};flex-shrink:0;"></span>
                <span>${ds.label}</span>
            </span>
        `).join('');
    }

    if (efeChartDemandaPaxInstance) {
        if (efeChartDemandaPaxInstance.config.type !== 'bar') {
            efeChartDemandaPaxInstance.destroy();
            efeChartDemandaPaxInstance = null;
        } else {
            efeChartDemandaPaxInstance.data.labels = years;
            efeChartDemandaPaxInstance.data.datasets = datasets;
            efeChartDemandaPaxInstance.update();
            return;
        }
    }

    efeChartDemandaPaxInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: datasets
        },
        plugins: (window.CatlecUtils && window.CatlecUtils.stackedBarDataLabelsPlugin)
            ? [window.CatlecUtils.stackedBarDataLabelsPlugin]
            : [],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: Math.max(2.5, window.devicePixelRatio || 1),
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
                        title: (items) => 'Año ' + (items[0] ? items[0].label : ''),
                        label: (c) => {
                            const val = c.raw;
                            if (val !== null && typeof val === 'number' && val > 0) {
                                return ` ${c.dataset.label}: ${val.toFixed(2)} MM pasajeros`;
                            }
                            return ` ${c.dataset.label}: 0.00 MM`;
                        },
                        afterBody: (items) => {
                            const total = items.reduce((sum, item) => sum + (Number(item.raw) || 0), 0);
                            const linesAfter = [`Total Red: ${total.toFixed(2)} MM pasajeros`];
                            const y = items[0] ? items[0].label : '';
                            if (y === '2020') {
                                linesAfter.push('*Período con fuertes restricciones de movilidad por pandemia COVID-19.');
                            }
                            if (y === '2024') {
                                linesAfter.push('*Afectado por temporales e interrupciones en puente ferroviario Biobío.');
                            }
                            return linesAfter;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: {
                        color: '#475569',
                        font: { size: 10, weight: '600' }
                    }
                },
                y: {
                    stacked: true,
                    min: 0,
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: {
                        color: '#64748b',
                        font: { size: 10, weight: '600' },
                        callback: (v) => v + ' MM'
                    },
                    title: {
                        display: true,
                        text: 'Demanda Anual Consolidada (MM pasajeros)',
                        color: '#475569',
                        font: { size: 9.5, weight: '600' }
                    }
                }
            }
        }
    });
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
        efeChartLongitudEstacionesInstance.data.datasets[0].backgroundColor = 'rgba(15, 59, 108, 0.85)';
        efeChartLongitudEstacionesInstance.data.datasets[0].borderColor = '#0f3b6c';
        efeChartLongitudEstacionesInstance.data.datasets[1].data = dataStations;
        efeChartLongitudEstacionesInstance.data.datasets[1].borderColor = '#d92534';
        efeChartLongitudEstacionesInstance.data.datasets[1].backgroundColor = '#d92534';
        efeChartLongitudEstacionesInstance.options.scales.y.suggestedMax = Math.max(...dataKm, 0) * 1.18;
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
                    backgroundColor: 'rgba(15, 59, 108, 0.85)',
                    borderColor: '#0f3b6c',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y',
                    order: 2
                },
                {
                    type: 'line',
                    label: 'Estaciones',
                    data: dataStations,
                    borderColor: '#d92534',
                    backgroundColor: '#d92534',
                    pointRadius: 3.5,
                    pointHoverRadius: 5.5,
                    borderWidth: 2,
                    tension: 0.2,
                    yAxisID: 'y1',
                    order: 1
                }
            ]
        },
        plugins: [CatlecUtils.groupedBarDataLabelsPlugin],
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
                },
                groupedBarDataLabelsPlugin: {
                    formatter: (v) => Number(v).toFixed(1),
                    color: '#0f3b6c',
                    offset: 4
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#334155',
                        font: { size: 10, weight: '600' },
                        maxRotation: 35,
                        minRotation: 20
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    suggestedMax: Math.max(...dataKm, 0) * 1.18,
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: {
                        color: '#0f3b6c',
                        font: { size: 10, weight: '600' }
                    },
                    title: {
                        display: true,
                        text: 'Longitud (km)',
                        color: '#0f3b6c',
                        font: { size: 9.5, weight: '600' }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#d92534',
                        font: { size: 10, weight: '600' }
                    },
                    title: {
                        display: true,
                        text: 'N° Estaciones',
                        color: '#d92534',
                        font: { size: 9.5, weight: '600' }
                    }
                }
            }
        }
    });
}

// ── 5. Gráfico 4: Índice de Satisfacción Usuaria (%) ───────────────────────────
function initEfeSatControls() {
    const btnTrend = document.getElementById('btn-efe-sat-trend');
    const btnRanking = document.getElementById('btn-efe-sat-ranking');
    if (btnTrend && !btnTrend._hasSatListener) {
        btnTrend._hasSatListener = true;
        btnTrend.addEventListener('click', () => {
            if (efeSatisfactionViewMode === 'trend') return;
            efeSatisfactionViewMode = 'trend';
            updateEfeSatButtonStyles();
            renderEfeChartSatisfaccion();
        });
    }
    if (btnRanking && !btnRanking._hasSatListener) {
        btnRanking._hasSatListener = true;
        btnRanking.addEventListener('click', () => {
            if (efeSatisfactionViewMode === 'ranking') return;
            efeSatisfactionViewMode = 'ranking';
            updateEfeSatButtonStyles();
            renderEfeChartSatisfaccion();
        });
    }
}

function updateEfeSatButtonStyles() {
    const btnTrend = document.getElementById('btn-efe-sat-trend');
    const btnRanking = document.getElementById('btn-efe-sat-ranking');
    if (!btnTrend || !btnRanking) return;

    if (efeSatisfactionViewMode === 'trend') {
        btnTrend.style.background = 'var(--primary, #2563eb)';
        btnTrend.style.color = '#ffffff';
        btnRanking.style.background = 'transparent';
        btnRanking.style.color = 'var(--text-muted)';
    } else {
        btnRanking.style.background = 'var(--primary, #2563eb)';
        btnRanking.style.color = '#ffffff';
        btnTrend.style.background = 'transparent';
        btnTrend.style.color = 'var(--text-muted)';
    }
}

function renderEfeChartSatisfaccion(linesData) {
    const ctx = document.getElementById('efeChartSatisfaccion');
    const legendEl = document.getElementById('efeChartSatisfaccionLegend');
    if (!ctx) return;

    initEfeSatControls();
    updateEfeSatButtonStyles();

    if (linesData && linesData.length > 0) {
        lastRenderedEfeLines = linesData;
    }
    const lines = (lastRenderedEfeLines && lastRenderedEfeLines.length > 0)
        ? lastRenderedEfeLines
        : ((window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : []);

    // Obtener años dinámicamente desde el historial de satisfacción de las líneas
    const satYearSet = new Set();
    const allLinesList = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
    allLinesList.forEach(l => {
        if (l.satisfaction_history && typeof l.satisfaction_history === 'object') {
            Object.keys(l.satisfaction_history).forEach(y => {
                if (/^\d{4}$/.test(y)) satYearSet.add(y);
            });
        }
    });
    let years = Array.from(satYearSet).sort((a, b) => Number(a) - Number(b));
    if (years.length === 0) {
        years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];
    }

    if (efeSatisfactionViewMode === 'trend') {
        // MODO 1: TENDENCIA HISTÓRICA (Line Chart)
        if (efeChartSatisfaccionInstance && efeChartSatisfaccionInstance.config.type !== 'line') {
            efeChartSatisfaccionInstance.destroy();
            efeChartSatisfaccionInstance = null;
        }

        const filiales = [...new Set(lines.map(l => l.filial).filter(Boolean))];
        let datasets = [];

        // Orden estándar para presentación de filiales
        const filialOrder = ['EFE Valparaíso', 'EFE Central', 'EFE Sur'];

        // Agregar las filiales correspondientes según el filtro activo
        filialOrder.forEach(fName => {
            if (filiales.includes(fName) || filiales.length === 0) {
                const fLines = lines.filter(l => l.filial === fName);
                if (fLines.length > 0) {
                    const fColor = getEfeFilialColor(fName);
                    const fData = years.map(y => calculateWeightedSatisfaction(fLines, y));
                    datasets.push({
                        label: fName,
                        data: fData,
                        borderColor: fColor,
                        backgroundColor: fColor,
                        borderWidth: 2.4,
                        pointRadius: 3.5,
                        pointHoverRadius: 5.5,
                        pointBackgroundColor: fColor,
                        tension: 0.25,
                        spanGaps: false
                    });
                }
            }
        });

        // Filiales adicionales si se incorporan en el futuro
        filiales.forEach(fName => {
            if (!filialOrder.includes(fName)) {
                const fLines = lines.filter(l => l.filial === fName);
                if (fLines.length > 0) {
                    const fColor = getEfeFilialColor(fName);
                    const fData = years.map(y => calculateWeightedSatisfaction(fLines, y));
                    datasets.push({
                        label: fName,
                        data: fData,
                        borderColor: fColor,
                        backgroundColor: fColor,
                        borderWidth: 2.4,
                        pointRadius: 3.5,
                        pointHoverRadius: 5.5,
                        pointBackgroundColor: fColor,
                        tension: 0.25,
                        spanGaps: false
                    });
                }
            }
        });

        // Render microleyenda para modo tendencia (muestra las filiales activas)
        if (legendEl) {
            legendEl.innerHTML = datasets.map(ds => `
                <span style="display:inline-flex;align-items:center;gap:0.3rem;color:var(--text-primary);font-size:0.62rem;font-weight:600;">
                    <span style="width:13px;height:5.5px;border-radius:9999px;background-color:${ds.borderColor};flex-shrink:0;"></span>
                    <span>${ds.label}</span>
                </span>
            `).join('');
        }

        if (efeChartSatisfaccionInstance) {
            efeChartSatisfaccionInstance.data.labels = years;
            efeChartSatisfaccionInstance.data.datasets = datasets;
            efeChartSatisfaccionInstance.update();
            return;
        }

        efeChartSatisfaccionInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 400,
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
                            title: (items) => 'Año ' + (items[0] ? items[0].label : ''),
                            label: (c) => {
                                const val = c.raw;
                                if (val !== null && typeof val === 'number') {
                                    return ` ${c.dataset.label}: ${Math.round(val)}%`;
                                }
                                return ` ${c.dataset.label}: S/D (No medido)`;
                            },
                            afterBody: (items) => {
                                const y = items[0] ? items[0].label : '';
                                const linesAfter = [];
                                const totalSat = calculateEfeTotalSatisfaction(y);
                                if (typeof totalSat === 'number') {
                                    linesAfter.push(`Promedio EFE Total: ${Math.round(totalSat)}%`);
                                }
                                if (y === '2020') {
                                    linesAfter.push('*Período con restricciones operativas por pandemia COVID-19.');
                                }
                                if (y === '2023') {
                                    linesAfter.push('*En 2023 Chillán no fue medido por cortes de vías y temporales.');
                                }
                                return linesAfter;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(0,0,0,0.04)' },
                        ticks: {
                            color: '#475569',
                            font: { size: 10, weight: '600' }
                        }
                    },
                    y: {
                        min: 45,
                        max: 100,
                        grid: { color: 'rgba(0,0,0,0.06)' },
                        ticks: {
                            stepSize: 10,
                            color: '#64748b',
                            font: { size: 10, weight: '600' },
                            callback: (v) => v + '%'
                        },
                        title: {
                            display: true,
                            text: 'Satisfacción (%)',
                            color: '#475569',
                            font: { size: 9.5, weight: '600' }
                        }
                    }
                }
            }
        });

    } else {
        // MODO 2: RANKING del último año disponible (Bar Chart)
        const rankingYear = getEfeLatestYear();
        if (efeChartSatisfaccionInstance && efeChartSatisfaccionInstance.config.type !== 'bar') {
            efeChartSatisfaccionInstance.destroy();
            efeChartSatisfaccionInstance = null;
        }

        const filtered = lines
            .filter(l => typeof l.satisfaction_2025_pct === 'number' && l.satisfaction_2025_pct > 0)
            .sort((a, b) => b.satisfaction_2025_pct - a.satisfaction_2025_pct);

        const labels = filtered.map(l => (l.service || '').replace(' - Estación Central', ' - Alameda'));
        const dataVals = filtered.map(l => l.satisfaction_2025_pct);

        // Colores basados en umbral de calidad (Paleta oficial EFE Trenes de Chile)
        const bgColors = dataVals.map(val => {
            if (val >= 90) return '#1e9952'; // Verde Sostenible
            if (val >= 80) return '#2b5ec9'; // Azul Transporte
            if (val >= 70) return '#e69500'; // Ámbar
            return '#d92534'; // Rojo EFE
        });

        // Microleyenda de umbrales (Estándar CATLEC: viñeta cuadrada, color de texto = color propio, negrita 600)
        if (legendEl) {
            legendEl.innerHTML = `
                <span style="display:inline-flex;align-items:center;gap:0.25rem;color:#1e9952;font-weight:600;font-size:0.63rem;">
                    <span style="width:8px;height:8px;border-radius:2px;background:#1e9952;display:inline-block;"></span>≥90%
                </span>
                <span style="display:inline-flex;align-items:center;gap:0.25rem;color:#2b5ec9;font-weight:600;font-size:0.63rem;">
                    <span style="width:8px;height:8px;border-radius:2px;background:#2b5ec9;display:inline-block;"></span>80-89%
                </span>
                <span style="display:inline-flex;align-items:center;gap:0.25rem;color:#e69500;font-weight:600;font-size:0.63rem;">
                    <span style="width:8px;height:8px;border-radius:2px;background:#e69500;display:inline-block;"></span>70-79%
                </span>
                <span style="display:inline-flex;align-items:center;gap:0.25rem;color:#d92534;font-weight:600;font-size:0.63rem;">
                    <span style="width:8px;height:8px;border-radius:2px;background:#d92534;display:inline-block;"></span>&lt;70%
                </span>
            `;
        }

        if (efeChartSatisfaccionInstance) {
            efeChartSatisfaccionInstance.data.labels = labels;
            efeChartSatisfaccionInstance.data.datasets[0].data = dataVals;
            efeChartSatisfaccionInstance.data.datasets[0].backgroundColor = bgColors.map(c => `${c}cc`);
            efeChartSatisfaccionInstance.data.datasets[0].borderColor = bgColors;
            efeChartSatisfaccionInstance.options.plugins.tooltip.callbacks = {
                title: (items) => (filtered[items[0].dataIndex] ? filtered[items[0].dataIndex].service : ''),
                label: (c) => [
                    ' Filial: ' + (filtered[c.dataIndex] ? filtered[c.dataIndex].filial : ''),
                    ` Satisfacción ${rankingYear}: ` + Math.round(Number(c.raw)) + '%'
                ]
            };
            efeChartSatisfaccionInstance.update();
            return;
        }

        efeChartSatisfaccionInstance = new Chart(ctx, {
            type: 'bar',
            plugins: [CatlecUtils.groupedBarDataLabelsPlugin],
            data: {
                labels: labels,
                datasets: [{
                    label: `Satisfacción ${rankingYear} (%)`,
                    data: dataVals,
                    backgroundColor: bgColors.map(c => `${c}cc`),
                    borderColor: bgColors,
                    borderWidth: 1,
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
                                ` Satisfacción ${rankingYear}: ` + Math.round(Number(c.raw)) + '%'
                            ]
                        }
                    },
                    groupedBarDataLabelsPlugin: {
                        formatter: (v) => `${Math.round(v)}%`,
                        offset: 4
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#334155',
                            font: { size: 10, weight: '600' },
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
                            font: { size: 10, weight: '600' },
                            callback: (v) => v + '%'
                        },
                        title: {
                            display: true,
                            text: `Satisfacción ${rankingYear} (%)`,
                            color: '#475569',
                            font: { size: 9.5, weight: '600' }
                        }
                    }
                }
            }
        });
    }
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
    const EFE_TRACTION_PALETTE = {
        'Eléctrica (EMU)': '#2b5ec9',
        'Bimodal (160 km/h)': '#1e9952',
        'Diésel (Locomotora / DMU)': '#64748b',
        'Diésel Buscarril': '#475569',
        'Otros': '#e69500'
    };
    const bgColors = labels.map((g, i) => EFE_TRACTION_PALETTE[g] || EFE_EXTRA_PALETTE[i % EFE_EXTRA_PALETTE.length]);

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


