// ─── static/js/DGC/finanzas-vista.js ──────────────────────────────────────────
// Visualización "Estados Financieros de las Concesionarias" (#finanzas): KPI y
// gráficos agregados de los estados financieros que las sociedades
// concesionarias presentan a la CMF (static/data/dgc_cmf.js, que escribe
// scripts/etl/dgc_cmf.py). Usa los contratos que dejan los filtros del panel
// izquierdo (sector, región, estado, búsqueda): filters.js llama a
// renderFinanzasVista al filtrar con la vista abierta.
//
// Cifras en millones de UF, para poder sumar y comparar años: los flujos del
// año (ingresos, resultado operacional, utilidad) se dividen por la UF promedio
// de ese año y los saldos al 31-dic (deuda financiera) por la UF de ese día
// (DGC_CMF.uf, del SII). Los datos vienen en MM$, así que MM$ / UF = millones de UF.
//
// Reutiliza dgcFinRutCuerpo y el tooltip dgcFinTooltip de finanzas.js (la
// sección de la ficha) y getSectorConfig / createOrUpdateChart de DGC/utils.js.

const DGC_FV_TOP = 15;   // concesionarias del ranking
const dgcFvCharts = { evolucion: null, ranking: null, margen: null, deuda: null };

function dgcFvEnUF(mm, anio, clase) {
    const uf = window.DGC_CMF && DGC_CMF.uf && DGC_CMF.uf[anio];
    const valor = uf && (clase === 'saldo' ? uf.cierre : uf.promedio);
    return (mm == null || !valor) ? null : mm / valor;
}

// Millones de UF con decimales según el tamaño (11,2 · 0,22 · 1.234)
function dgcFvFmt(v) {
    if (v == null || isNaN(v)) return '–';
    const abs = Math.abs(v);
    const dec = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
    return v.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// Sociedades (una por RUT) de los contratos filtrados que tienen datos en la CMF
function dgcFvSociedades(lista) {
    const out = new Map();
    (lista || []).forEach(c => {
        const cuerpo = dgcFinRutCuerpo(c['Rut sociedad Concesionaria']);
        const soc = cuerpo && DGC_CMF.sociedades[cuerpo];
        if (!soc || out.has(cuerpo)) return;
        const sector = getSectorConfig(c['Sector del proyecto'] || '');
        out.set(cuerpo, {
            soc,
            code: c['Código proyecto'],
            nombre: (c['Nombre de uso común'] || c['Nombre de la Concesión '] || soc.nombre || '').trim(),
            sector: sector.name,
            color: sector.color,
        });
    });
    return [...out.values()];
}

// Cifras de una sociedad en un año, en millones de UF
function dgcFvCifras(s, anio) {
    const a = s.soc.anios[anio];
    if (!a) return null;
    return {
        ingresos: dgcFvEnUF(a.ingresos, anio, 'flujo'),
        operacional: dgcFvEnUF(a.resultado_operacional, anio, 'flujo'),
        utilidad: dgcFvEnUF(a.utilidad, anio, 'flujo'),
        deuda: dgcFvEnUF(a.deuda_financiera, anio, 'saldo'),
    };
}

// Abre la ficha de una concesión desde un gráfico: vuelve al Mapa y la selecciona
function dgcFvAbrirFicha(code) {
    if (!code) return;
    hideFinanzasView();
    if (typeof zoomToProjectCode === 'function') zoomToProjectCode(code);
}

function dgcFvSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function dgcFvCursor(evt, elements) {
    if (evt.native && evt.native.target) evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
}

function renderFinanzasVista(lista) {
    if (!window.DGC_CMF || typeof Chart === 'undefined') return;
    Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    const anio = DGC_CMF.anio_fin;
    const socs = dgcFvSociedades(lista);
    const conAnio = socs.map(s => ({ ...s, c: dgcFvCifras(s, anio) })).filter(s => s.c);
    const textColor = '#334155';
    const gridColor = '#e2e8f0';
    const sum = (arr, k) => arr.reduce((t, s) => t + (s.c[k] || 0), 0);

    // ── KPI del último año cerrado ──────────────────────────────────────────
    const perdidas = conAnio.filter(s => s.c.utilidad != null && s.c.utilidad < 0).length;
    dgcFvSetText('kpi-fv-ingresos-label', `Ingresos ${anio}`);
    dgcFvSetText('kpi-fv-utilidad-label', `Utilidad ${anio}${perdidas ? ` · ${perdidas} con pérdida` : ''}`);
    dgcFvSetText('kpi-fv-deuda-label', `Deuda financiera al 31-dic-${anio}`);
    dgcFvSetText('kpi-fv-sociedades-label', `Sociedades con EEFF ${anio}`);
    dgcFvSetText('kpi-fv-ingresos', conAnio.length ? `${dgcFvFmt(sum(conAnio, 'ingresos'))} MM UF` : '–');
    dgcFvSetText('kpi-fv-utilidad', conAnio.length ? `${dgcFvFmt(sum(conAnio, 'utilidad'))} MM UF` : '–');
    dgcFvSetText('kpi-fv-deuda', conAnio.length ? `${dgcFvFmt(sum(conAnio, 'deuda'))} MM UF` : '–');
    dgcFvSetText('kpi-fv-sociedades', `${conAnio.length} de ${socs.length}`);

    // ── 1. Ingresos por sector y año (barras apiladas) + n.º de sociedades ──
    const anios = [];
    for (let a = DGC_CMF.anio_ini; a <= anio; a++) anios.push(a);
    const porSector = new Map();
    const informan = anios.map(() => 0);
    socs.forEach(s => {
        anios.forEach((a, i) => {
            const c = dgcFvCifras(s, a);
            if (!c || c.ingresos == null) return;
            informan[i]++;
            if (!porSector.has(s.sector)) porSector.set(s.sector, { color: s.color, data: anios.map(() => 0) });
            porSector.get(s.sector).data[i] += c.ingresos;
        });
    });
    const sectores = [...porSector.entries()].sort((x, y) =>
        y[1].data.reduce((t, v) => t + v, 0) - x[1].data.reduce((t, v) => t + v, 0));
    const lineColor = '#0f172a';
    const legend = document.getElementById('fv-legend-evolucion');
    if (legend) {
        legend.innerHTML = sectores.map(([nom, v]) => `
            <span class="dgc-fin-legend-item" style="color: ${v.color};">
                <span class="dgc-fin-legend-swatch" style="background: ${v.color};"></span>${nom}
            </span>`).join('') + `
            <span class="dgc-fin-legend-item" style="color: ${lineColor};">
                <span class="dgc-fin-legend-swatch dgc-fv-swatch--linea" style="background: ${lineColor};"></span>N.º de sociedades
            </span>`;
    }
    dgcFvCharts.evolucion = createOrUpdateChart('chartFvEvolucion', dgcFvCharts.evolucion, {
        type: 'bar',
        data: {
            labels: anios.map(String),
            datasets: [
                ...sectores.map(([nom, v]) => ({
                    label: nom, data: v.data, backgroundColor: v.color, borderColor: v.color,
                    borderWidth: 1, borderRadius: 2, stack: 'ingresos', order: 2,
                })),
                {
                    type: 'line', label: 'Sociedades que informan', data: informan, yAxisID: 'y1',
                    borderColor: lineColor, backgroundColor: lineColor, borderWidth: 2.2, tension: 0.2,
                    pointRadius: 3.5, pointHoverRadius: 5.5, pointBackgroundColor: lineColor, order: 1,
                },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false, external: dgcFinTooltip,
                    callbacks: {
                        title: (items) => `Año ${items[0].label}`,
                        label: (ctx) => ctx.dataset.type === 'line'
                            ? ` ${ctx.raw} sociedades informan`
                            : ` ${ctx.dataset.label}: ${dgcFvFmt(ctx.raw)} MM UF`,
                        afterBody: (items) => {
                            const total = items.filter(i => i.dataset.type !== 'line').reduce((t, i) => t + (i.raw || 0), 0);
                            return [`Total: ${dgcFvFmt(total)} MM UF`];
                        },
                    },
                },
            },
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
                y: {
                    stacked: true, grid: { color: gridColor },
                    ticks: { color: textColor, font: { size: 9.5 }, callback: (v) => dgcFvFmt(v) },
                    title: { display: true, text: 'MM UF', color: textColor, font: { size: 9.5, weight: '600' } },
                },
                y1: {
                    position: 'right', beginAtZero: true, grid: { drawOnChartArea: false },
                    ticks: { color: lineColor, font: { size: 9.5 }, precision: 0 },
                    title: { display: true, text: 'Sociedades', color: lineColor, font: { size: 9.5, weight: '600' } },
                },
            },
        },
    });

    // ── 2. Ranking de concesionarias por ingresos del último año ───────────
    const ranking = conAnio.filter(s => s.c.ingresos > 0).sort((x, y) => y.c.ingresos - x.c.ingresos).slice(0, DGC_FV_TOP);
    dgcFvSetText('fv-ranking-title', `${DGC_FV_TOP} concesionarias con mayores ingresos ${anio} (MM UF)`);
    dgcFvCharts.ranking = createOrUpdateChart('chartFvRanking', dgcFvCharts.ranking, {
        type: 'bar',
        plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
        data: {
            labels: ranking.map(s => CatlecUtils.wrapTextToLines(s.nombre, 30, 2)),
            datasets: [{
                label: 'Ingresos', data: ranking.map(s => s.c.ingresos),
                backgroundColor: ranking.map(s => s.color), borderColor: ranking.map(s => s.color),
                borderWidth: 1, borderRadius: 3,
            }],
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            layout: { padding: { right: 36 } },
            onClick: (evt, els) => { if (els.length) dgcFvAbrirFicha(ranking[els[0].index].code); },
            onHover: dgcFvCursor,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false, external: dgcFinTooltip,
                    callbacks: {
                        title: (items) => ranking[items[0].dataIndex].nombre,
                        label: (ctx) => {
                            const s = ranking[ctx.dataIndex];
                            return [` Ingresos ${anio}: ${dgcFvFmt(s.c.ingresos)} MM UF`, ` ${s.sector}`];
                        },
                        afterBody: () => ['Clic para abrir su ficha'],
                    },
                },
                horizontalBarDataLabelsPlugin: { formatter: (v) => dgcFvFmt(v) },
            },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 9.5 }, callback: (v) => dgcFvFmt(v) } },
                y: { grid: { display: false }, ticks: { color: textColor, font: { size: 9.5 }, autoSkip: false } },
            },
        },
    });

    // ── 3. Margen operacional por sector del último año ─────────────────────
    const margenes = new Map();
    conAnio.forEach(s => {
        if (!(s.c.ingresos > 0) || s.c.operacional == null) return;
        if (!margenes.has(s.sector)) margenes.set(s.sector, { color: s.color, ing: 0, op: 0, n: 0 });
        const m = margenes.get(s.sector);
        m.ing += s.c.ingresos; m.op += s.c.operacional; m.n++;
    });
    const margen = [...margenes.entries()].map(([nom, m]) => ({ nom, ...m, pct: m.op / m.ing * 100 }))
        .sort((x, y) => y.pct - x.pct);
    dgcFvSetText('fv-margen-title', `Margen operacional por sector ${anio} (resultado operacional / ingresos)`);
    dgcFvCharts.margen = createOrUpdateChart('chartFvMargen', dgcFvCharts.margen, {
        type: 'bar',
        plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
        data: {
            labels: margen.map(m => m.nom),
            datasets: [{
                label: 'Margen operacional', data: margen.map(m => m.pct),
                backgroundColor: margen.map(m => m.color), borderColor: margen.map(m => m.color),
                borderWidth: 1, borderRadius: 3,
            }],
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            layout: { padding: { right: 36 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false, external: dgcFinTooltip,
                    callbacks: {
                        title: (items) => margen[items[0].dataIndex].nom,
                        label: (ctx) => {
                            const m = margen[ctx.dataIndex];
                            return [` Margen operacional: ${m.pct.toFixed(1).replace('.', ',')}%`,
                                ` Resultado operacional: ${dgcFvFmt(m.op)} MM UF`,
                                ` Ingresos: ${dgcFvFmt(m.ing)} MM UF`,
                                ` ${m.n} ${m.n === 1 ? 'sociedad' : 'sociedades'}`];
                        },
                    },
                },
                horizontalBarDataLabelsPlugin: { formatter: (v) => `${v.toFixed(0)}%`, allowNegative: true },
            },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 9.5 }, callback: (v) => `${v}%` } },
                y: { grid: { display: false }, ticks: { color: textColor, font: { size: 9.5 } } },
            },
        },
    });

    // ── 4. Deuda financiera frente a ingresos (dispersión, escala logarítmica) ──
    const puntos = conAnio.filter(s => s.c.ingresos > 0 && s.c.deuda > 0);
    dgcFvSetText('fv-deuda-title', `Deuda financiera frente a ingresos ${anio}`);
    dgcFvCharts.deuda = createOrUpdateChart('chartFvDeuda', dgcFvCharts.deuda, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Sociedades',
                data: puntos.map(s => ({ x: s.c.ingresos, y: s.c.deuda })),
                backgroundColor: puntos.map(s => s.color + 'cc'), borderColor: puntos.map(s => s.color),
                borderWidth: 1, pointRadius: 5, pointHoverRadius: 7,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            onClick: (evt, els) => { if (els.length) dgcFvAbrirFicha(puntos[els[0].index].code); },
            onHover: dgcFvCursor,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false, external: dgcFinTooltip,
                    callbacks: {
                        title: (items) => puntos[items[0].dataIndex].nombre,
                        label: (ctx) => {
                            const s = puntos[ctx.dataIndex];
                            return [` ${s.sector}`,
                                ` Ingresos ${anio}: ${dgcFvFmt(s.c.ingresos)} MM UF`,
                                ` Deuda financiera: ${dgcFvFmt(s.c.deuda)} MM UF`,
                                ` Deuda / ingresos: ${(s.c.deuda / s.c.ingresos).toFixed(1).replace('.', ',')} veces`];
                        },
                        afterBody: () => ['Clic para abrir su ficha'],
                    },
                },
            },
            scales: {
                x: {
                    type: 'logarithmic', grid: { color: gridColor },
                    ticks: { color: textColor, font: { size: 9.5 }, maxRotation: 0, callback: (v) => ([0.01, 0.1, 1, 10, 100].includes(v) ? v.toLocaleString('es-CL') : '') },
                    title: { display: true, text: `Ingresos ${anio} (MM UF)`, color: textColor, font: { size: 9.5, weight: '600' } },
                },
                y: {
                    type: 'logarithmic', grid: { color: gridColor },
                    ticks: { color: textColor, font: { size: 9.5 }, maxRotation: 0, callback: (v) => ([0.01, 0.1, 1, 10, 100].includes(v) ? v.toLocaleString('es-CL') : '') },
                    title: { display: true, text: 'Deuda financiera (MM UF)', color: textColor, font: { size: 9.5, weight: '600' } },
                },
            },
        },
    });
}

// ── Mostrar / ocultar la vista (mismo patrón que contracts_analysis.js) ──────
function showFinanzasView() {
    if (typeof leafletMap !== 'undefined' && leafletMap && leafletMap.getCenter && !appState.finanzasOpen
        && !appState.timelineOpen && !appState.investmentOpen && !appState.contractsOpen && !appState.biddersOpen) {
        appState.savedMapCenter = leafletMap.getCenter();
        appState.savedMapZoom = leafletMap.getZoom();
        appState.savedMapDefault = dgcAtDefaultView;
    }
    if (appState.timelineOpen) hideTimelineView();
    if (appState.investmentOpen) hideInvestmentView();
    if (appState.contractsOpen) hideContractsView();
    if (appState.biddersOpen) hideBiddersView();

    appState.finanzasOpen = true;
    const grid = document.querySelector('.dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const panel = document.getElementById('finanzas-full-panel');
    if (grid) grid.classList.add('dgc-grid--vista-completa');
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (panel) panel.style.display = 'flex';

    if (typeof setActiveSubheaderTab === 'function') setActiveSubheaderTab('finanzas');

    const lista = (currentFilteredContractsList && currentFilteredContractsList.length > 0)
        ? currentFilteredContractsList
        : (window.STATIC_DATA && window.STATIC_DATA.data ? window.STATIC_DATA.data : []);
    renderFinanzasVista(lista);
}

// Cierra la vista. Con volverAlMapa (por defecto) restaura el mapa y la tabla;
// sin él solo oculta el panel (otra vista de pantalla completa toma su lugar:
// la llama setActiveSubheaderTab al activarse otra pestaña).
function hideFinanzasView(volverAlMapa = true) {
    if (!appState.finanzasOpen) return;
    appState.finanzasOpen = false;
    const panel = document.getElementById('finanzas-full-panel');
    if (panel) panel.style.display = 'none';
    if (typeof CatlecTooltip !== 'undefined') CatlecTooltip.hide('dgc-fin-tooltip');
    if (!volverAlMapa) return;

    const grid = document.querySelector('.dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    if (grid) grid.classList.remove('dgc-grid--vista-completa');
    if (centerPanel) centerPanel.style.display = 'flex';
    if (rightPanel) rightPanel.style.display = 'flex';
    if (typeof setActiveSubheaderTab === 'function') setActiveSubheaderTab('map');

    if (typeof leafletMap !== 'undefined' && leafletMap) {
        leafletMap.resize();
        if (appState.savedMapCenter) dgcRestoreMapView();
        setTimeout(() => {
            leafletMap.resize();
            if (appState.savedMapCenter) dgcRestoreMapView();
        }, 0);
    }
}
