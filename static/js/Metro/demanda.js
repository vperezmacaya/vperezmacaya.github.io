// ─── static/js/Metro/demanda.js ──────────────────────────────────────────────
// Visualización de Demanda Histórica y Caracterización Operacional de Metro de Santiago.

let metroChartDemandaAnualInstance = null;
let metroChartOfertaCkmInstance = null;
let metroChartTipologiaViasInstance = null;
let metroChartLineasCompInstance = null;
let metroChartAveriasInstance = null;

function showMetroDemandaView() {
    if (metroState.timelineOpen && typeof hideMetroTimelineView === 'function') {
        hideMetroTimelineView();
    }
    if (metroState.comunasOpen && typeof hideMetroComunasView === 'function') {
        hideMetroComunasView();
    }
    metroState.demandaOpen = true;

    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const demandaPanel = document.getElementById('metro-demanda-full-panel');
    const btnMap = document.getElementById('btn-metro-view-map');
    const btnTl = document.getElementById('btn-metro-view-timeline');
    const btnComunas = document.getElementById('btn-metro-view-comunas');
    const btnDemanda = document.getElementById('btn-metro-view-demanda');

    if (grid) grid.style.gridTemplateColumns = '1fr';
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (demandaPanel) demandaPanel.style.display = 'flex';

    if (btnMap) btnMap.classList.remove('active');
    if (btnTl) btnTl.classList.remove('active');
    if (btnComunas) btnComunas.classList.remove('active');
    if (btnDemanda) btnDemanda.classList.add('active');

    if (typeof window !== 'undefined' && window.location && window.location.hash !== '#demanda' && window.history && window.history.replaceState) {
        history.replaceState(null, null, '#demanda');
    }

    renderMetroDemandaAnalytics();
}

function hideMetroDemandaView() {
    metroState.demandaOpen = false;

    const tip = document.getElementById('metro-chart-external-tooltip');
    if (tip) tip.style.opacity = '0';

    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const demandaPanel = document.getElementById('metro-demanda-full-panel');
    const btnMap = document.getElementById('btn-metro-view-map');
    const btnDemanda = document.getElementById('btn-metro-view-demanda');

    if (grid) grid.style.gridTemplateColumns = '1fr 520px';
    if (centerPanel) centerPanel.style.display = 'flex';
    if (rightPanel) rightPanel.style.display = 'flex';
    if (demandaPanel) demandaPanel.style.display = 'none';

    if (btnDemanda) btnDemanda.classList.remove('active');
    if (btnMap && !metroState.timelineOpen && !metroState.comunasOpen) {
        btnMap.classList.add('active');
    }

    if (window.location.hash === '#demanda' || window.location.hash === '#operacion') {
        history.replaceState(null, null, window.location.pathname + window.location.search);
    }

    if (typeof metroMap !== 'undefined' && metroMap) {
        setTimeout(() => {
            metroMap.invalidateSize({ animate: false });
        }, 50);
    }
}

function renderMetroDemandaAnalytics() {
    if (typeof Chart !== 'undefined' && Chart.defaults) {
        Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    }

    const isLight = document.body.classList.contains('light-theme');
    const textColor = isLight ? '#0f172a' : '#f8fafc';
    const textSecColor = isLight ? '#64748b' : '#94a3b8';
    const gridColor = isLight ? '#e2e8f0' : '#334155';
    const cardBg = isLight ? '#ffffff' : '#1e293b';

    const demandData = (window.METRO_DATA && window.METRO_DATA.historical_demand) ? window.METRO_DATA.historical_demand : [];
    const supplyData = (window.METRO_DATA && window.METRO_DATA.operational_supply) ? window.METRO_DATA.operational_supply : [];
    const linesData = (window.METRO_DATA && window.METRO_DATA.lines) ? window.METRO_DATA.lines : [];
    const trackData = (window.METRO_DATA && window.METRO_DATA.track_types) ? window.METRO_DATA.track_types : [];
    const indicatorData = (window.METRO_DATA && window.METRO_DATA.operational_indicators) ? window.METRO_DATA.operational_indicators : [];

    // ── Actualizar Banner de KPIs de Demanda y Operación desde datos del Excel ──
    const elKpiDemanda1 = document.getElementById('metro-demanda-kpi-1');
    const elKpiDemanda2 = document.getElementById('metro-demanda-kpi-2');
    const elKpiDemanda3 = document.getElementById('metro-demanda-kpi-3');
    const elKpiDemanda4 = document.getElementById('metro-demanda-kpi-4');
    const elKpiDemanda5 = document.getElementById('metro-demanda-kpi-5');
    const elKpiDemandaLabel1 = document.getElementById('metro-demanda-kpi-label-1');
    const elKpiDemandaLabel2 = document.getElementById('metro-demanda-kpi-label-2');

    if (demandData.length > 0) {
        const latestDemand = demandData[demandData.length - 1];
        if (elKpiDemandaLabel1) elKpiDemandaLabel1.textContent = `Cantidad de viajes (${latestDemand.year})`;
        if (elKpiDemandaLabel2) elKpiDemandaLabel2.textContent = `Pasajeros día hábil promedio (${latestDemand.year})`;
        if (elKpiDemanda1) elKpiDemanda1.textContent = `${latestDemand.trips_mm.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MM`;
        if (elKpiDemanda2) elKpiDemanda2.textContent = `${latestDemand.daily_trips_mm.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MM`;
    }

    if (linesData.length > 0) {
        const totalKm = linesData.reduce((acc, l) => acc + (Number(l.length_km) || 0), 0);
        const totalEst = linesData.reduce((acc, l) => acc + (Number(l.stations) || 0), 0);
        if (elKpiDemanda3) elKpiDemanda3.textContent = `${totalKm.toFixed(1)} km`;
        if (elKpiDemanda4) elKpiDemanda4.textContent = `${totalEst} est.`;
    }

    if (supplyData.length > 0) {
        const latestSupply = supplyData[supplyData.length - 1];
        if (elKpiDemanda5) elKpiDemanda5.textContent = `${latestSupply.car_km_mm.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MM`;
    }

    // ── 1. GRÁFICO: Demanda Histórica (Afluencia 2019-2025) (Skill CATLEC Bar Chart - Combo) ──
    const ctxDemanda = document.getElementById('metroChartDemandaAnual');
    if (ctxDemanda && demandData.length > 0) {
        if (metroChartDemandaAnualInstance) metroChartDemandaAnualInstance.destroy();

        const labels = demandData.map(d => String(d.year));
        const trips = demandData.map(d => d.trips_mm);
        const dailyTrips = demandData.map(d => d.daily_trips_mm);

        metroChartDemandaAnualInstance = new Chart(ctxDemanda, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Cantidad de Viajes (MM Anual)',
                        data: trips,
                        backgroundColor: isLight ? 'rgba(2, 132, 199, 0.8)' : 'rgba(56, 189, 248, 0.8)',
                        borderColor: isLight ? '#0284c7' : '#38bdf8',
                        borderWidth: 1,
                        borderRadius: 3,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        type: 'line',
                        label: 'Pasajeros en Día Hábil Promedio (MM Pasajeros)',
                        data: dailyTrips,
                        borderColor: '#f59e0b',
                        backgroundColor: '#f59e0b',
                        borderWidth: 2.2,
                        tension: 0,
                        pointRadius: 2.5,
                        pointHoverRadius: 4.5,
                        pointBackgroundColor: '#f59e0b',
                        fill: false,
                        yAxisID: 'y1',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(2.5, window.devicePixelRatio || 1),
                interaction: { mode: 'nearest', intersect: true },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: metroExternalTooltip,
                        callbacks: {
                            title: function (items) {
                                if (!items || !items[0]) return '';
                                return `Año ${items[0].label}`;
                            },
                            label: function (ctx) {
                                const idx = ctx.dataIndex;
                                const t = trips[idx] !== undefined ? trips[idx] : ctx.raw;
                                const dt = dailyTrips[idx] !== undefined ? dailyTrips[idx] : ctx.raw;
                                const tFormatted = Number(t).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                                const dtFormatted = Number(dt).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                return [
                                    `Cantidad de Viajes (Anual): ${tFormatted} MM viajes`,
                                    `Pasajeros en Día Hábil Promedio: ${dtFormatted} MM pasajeros/día`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textSecColor, font: { size: 10 } }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Cantidad de Viajes (MM Anual)', color: textSecColor, font: { size: 9.5, weight: '600' } },
                        grid: { color: gridColor },
                        ticks: { color: textSecColor, font: { size: 10 } }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Pasajeros Día Hábil (MM)', color: '#f59e0b', font: { size: 9.5, weight: '600' } },
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#f59e0b', font: { size: 10 } }
                    }
                }
            }
        });
    }

    // ── 2. GRÁFICO: Oferta Operacional y Eficiencia (Skill CATLEC Bar Chart - Combo) ──
    const ctxOferta = document.getElementById('metroChartOfertaCkm');
    if (ctxOferta && supplyData.length > 0) {
        if (metroChartOfertaCkmInstance) metroChartOfertaCkmInstance.destroy();

        const labelsSupply = supplyData.map(s => String(s.year));
        const carKmData = supplyData.map(s => s.car_km_mm);
        const efficiencyData = supplyData.map(s => s.energy_efficiency);

        metroChartOfertaCkmInstance = new Chart(ctxOferta, {
            type: 'bar',
            data: {
                labels: labelsSupply,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Coches-Km Recorridos (MMCKm)',
                        data: carKmData,
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        borderRadius: 3,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        type: 'line',
                        label: 'Consumo Energético (GWh / MMCKm)',
                        data: efficiencyData,
                        borderColor: '#10b981',
                        backgroundColor: '#10b981',
                        borderWidth: 2.2,
                        tension: 0,
                        pointRadius: 2.5,
                        pointHoverRadius: 4.5,
                        pointBackgroundColor: '#10b981',
                        fill: false,
                        yAxisID: 'y1',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(2.5, window.devicePixelRatio || 1),
                interaction: { mode: 'nearest', intersect: true },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: metroExternalTooltip,
                        callbacks: {
                            title: function (items) {
                                if (!items || !items[0]) return '';
                                return `Año ${items[0].label}`;
                            },
                            label: function (ctx) {
                                const idx = ctx.dataIndex;
                                const ckm = carKmData[idx] !== undefined ? carKmData[idx] : ctx.raw;
                                const eff = efficiencyData[idx] !== undefined ? efficiencyData[idx] : ctx.raw;
                                const ckmFormatted = Number(ckm).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                const effFormatted = Number(eff).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                return [
                                    `Oferta: ${ckmFormatted} MMCKm`,
                                    `Consumo Energético: ${effFormatted} GWh/MMCKm`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textSecColor, font: { size: 10 } }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        min: 140,
                        max: 180,
                        grid: { color: gridColor },
                        ticks: { color: textSecColor, font: { size: 10 } },
                        title: { display: true, text: 'MM Coches-Km', color: textSecColor, font: { size: 9.5, weight: '600' } }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        min: 2.7,
                        max: 3.2,
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: '#10b981',
                            font: { size: 10 },
                            callback: (v) => Number(v).toFixed(2)
                        },
                        title: { display: true, text: 'Consumo Energético (GWh / MMCKm)', color: '#10b981', font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }

    // ── 3. GRÁFICO: Tipología de Vías (Doughnut - Skill CATLEC Pie Chart) ──
    const ctxTipologia = document.getElementById('metroChartTipologiaVias');
    const legendTipologiaEl = document.getElementById('metroChartTipologiaViasLegend');
    if (ctxTipologia && trackData.length > 0) {
        if (metroChartTipologiaViasInstance) metroChartTipologiaViasInstance.destroy();

        const tipologiaLabels = trackData.map(t => t.type);
        const tipologiaValues = trackData.map(t => t.length_km);
        const tipologiaColors = trackData.map((t, idx) => {
            const fallback = ['#002447', '#0284c7', '#10b981'][idx % 3];
            return t.color || fallback;
        });
        const totalKmTipologia = tipologiaValues.reduce((a, b) => a + b, 0) || 149;

        metroChartTipologiaViasInstance = new Chart(ctxTipologia, {
            type: 'doughnut',
            data: {
                labels: tipologiaLabels,
                datasets: [{
                    data: tipologiaValues,
                    backgroundColor: tipologiaColors,
                    borderColor: isLight ? '#ffffff' : '#1e293b',
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: metroExternalTooltip,
                        callbacks: {
                            title: function () { return 'Tipología de Vías de Red'; },
                            label: function (ctx) {
                                const pct = ((ctx.raw / totalKmTipologia) * 100).toFixed(1);
                                return ` ${ctx.label}: ${ctx.raw} km (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Generar Leyenda HTML Personalizada lateral (Desacoplada)
        if (legendTipologiaEl) {
            legendTipologiaEl.innerHTML = '';
            tipologiaLabels.forEach((lbl, idx) => {
                const val = tipologiaValues[idx];
                const pct = totalKmTipologia > 0 ? ((val / totalKmTipologia) * 100).toFixed(1) : 0;
                const col = tipologiaColors[idx];

                const itemDiv = document.createElement('div');
                itemDiv.style.cssText = 'display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; padding:0.06rem 0;';
                itemDiv.title = `${lbl}: ${val} km (${pct}%)`;
                itemDiv.innerHTML = `
                    <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                    <span style="color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;" title="${lbl}">${lbl}</span>
                    <span style="font-weight:700; color:var(--text-primary); flex-shrink:0; white-space:nowrap;">${pct}%</span>
                `;
                legendTipologiaEl.appendChild(itemDiv);
            });
        }
    }

    // ── 4. GRÁFICO: Comparativa Longitud y Estaciones por Línea (Skill CATLEC Bar Chart - Barras Agrupadas) ──
    const ctxLineasComp = document.getElementById('metroChartLineasComp');
    if (ctxLineasComp && linesData.length > 0) {
        if (metroChartLineasCompInstance) metroChartLineasCompInstance.destroy();

        metroChartLineasCompInstance = new Chart(ctxLineasComp, {
            type: 'bar',
            data: {
                labels: linesData.map(l => l.line),
                datasets: [
                    {
                        label: 'Longitud (km)',
                        data: linesData.map(l => l.length_km),
                        backgroundColor: 'rgba(2, 132, 199, 0.8)',
                        borderColor: '#0284c7',
                        borderWidth: 1,
                        borderRadius: 3
                    },
                    {
                        label: 'Estaciones',
                        data: linesData.map(l => l.stations),
                        backgroundColor: 'rgba(245, 158, 11, 0.85)',
                        borderColor: '#f59e0b',
                        borderWidth: 1,
                        borderRadius: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: metroExternalTooltip,
                        callbacks: {
                            title: function (items) {
                                if (!items || !items[0]) return '';
                                return items[0].label;
                            },
                            label: function (ctx) {
                                if (ctx.datasetIndex === 0) return ` ${ctx.dataset.label}: ${ctx.raw} km`;
                                return ` ${ctx.dataset.label}: ${ctx.raw} estaciones`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textSecColor, font: { size: 10 } }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textSecColor, font: { size: 10 } },
                        title: { display: true, text: 'Cantidad / Km', color: textSecColor, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }

    // ── 5. GRÁFICO: Desempeño y Averías (2019-2025) ──
    const ctxAverias = document.getElementById('metroChartAverias');
    if (ctxAverias && indicatorData.length > 0) {
        if (metroChartAveriasInstance) metroChartAveriasInstance.destroy();

        const years = ['2019', '2022', '2023', '2024', '2025'];
        const avMat = indicatorData.find(i => i.indicator.includes('material rodante (averías'));
        const avVias = indicatorData.find(i => i.indicator.includes('energía, vías'));

        const dataMat = avMat ? [avMat.y2019, avMat.y2022, avMat.y2023, avMat.y2024, avMat.y2025] : [];
        const dataVias = avVias ? [avVias.y2019, avVias.y2022, avVias.y2023, avVias.y2024, avVias.y2025] : [];

        metroChartAveriasInstance = new Chart(ctxAverias, {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Averías Mat. Rodante / MM Ckm',
                        data: dataMat,
                        borderColor: '#ef4444',
                        backgroundColor: '#ef4444',
                        borderWidth: 2,
                        pointRadius: 2.5,
                        pointHoverRadius: 4.5,
                        pointBackgroundColor: '#ef4444',
                        tension: 0,
                        fill: false
                    },
                    {
                        label: 'Averías Vías/Sistemas / MM Ckm',
                        data: dataVias,
                        borderColor: '#10b981',
                        backgroundColor: '#10b981',
                        borderWidth: 2,
                        pointRadius: 2.5,
                        pointHoverRadius: 4.5,
                        pointBackgroundColor: '#10b981',
                        tension: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(2.5, window.devicePixelRatio || 1),
                interaction: { mode: 'nearest', intersect: true },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: metroExternalTooltip,
                        callbacks: {
                            title: function (items) {
                                if (!items || !items[0]) return '';
                                return `Año ${items[0].label}`;
                            },
                            label: function (ctx) {
                                const val = Number(ctx.raw).toFixed(2).replace('.', ',');
                                return ` ${ctx.dataset.label}: ${val}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textSecColor, font: { size: 10 } }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textSecColor, font: { size: 10 } },
                        title: { display: true, text: 'Averías / MM Ckm', color: textSecColor, font: { size: 9.5, weight: '600' } }
                    }
                }
            }
        });
    }

}

function exportMetroLineasExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Librería XLSX no cargada.');
        return;
    }

    const linesData = (window.METRO_DATA && window.METRO_DATA.lines) ? window.METRO_DATA.lines : [];
    if (!linesData || linesData.length === 0) {
        alert('No hay datos de líneas para exportar.');
        return;
    }

    const rows = linesData.map(l => ({
        'Línea': l.line,
        'Terminales': l.terminals,
        'Longitud (km)': l.length_km,
        'Estaciones': l.stations,
        'Combinaciones': l.combinations,
        'Cant. Comunas': l.communes_count,
        'Comunas Conectadas': l.communes,
        'Rodadura': l.rolling_type,
        'Conducción': l.driving_mode,
        'Material Rodante': l.rolling_stock,
        'Coches por Tren': l.cars_per_train,
        'Puertas de Andén': l.platform_doors,
        'Aire Acondicionado': l.air_conditioning,
        'Año Inauguración': l.inauguration_year,
        'Última Extensión': l.last_extension_year,
        'Intervalo Hora Punta': l.peak_headway
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lineas Operativas Metro");
    XLSX.writeFile(wb, "Metro_Lineas_Operativas.xlsx");
}

if (typeof window !== 'undefined') {
    window.showMetroDemandaView = showMetroDemandaView;
    window.hideMetroDemandaView = hideMetroDemandaView;
    window.renderMetroDemandaAnalytics = renderMetroDemandaAnalytics;
    window.exportMetroLineasExcel = exportMetroLineasExcel;
}
