// ─── EFE: vista "Carga Ferroviaria" (#carga) ─────────────────────────────────
// Estadísticas de carga de las Memorias de EFE: KPI, productos, meta 2030 y un
// gráfico por año con botones MM TKBC / TEU / Toneladas (fila superior), y el
// mapa de la Red EFE con sus centros de carga (fila inferior, carga-mapa.js).
// Datos: static/data/efe_carga.js (window.EFE_CARGA), que escribe
// scripts/etl/efe_carga.py desde los PDF.
// La vista ocupa toda la grilla, como "Demanda y Operación". No depende de
// filtros: los gráficos se crean la primera vez que se abre y luego se reutilizan.

const efeCargaCharts = {};

const EFE_CARGA_COLORS = {
    navy: '#0f3b6c',
    red: '#d92534',
    blue: '#2b5ec9',
    green: '#1e9952',
    gray: '#64748b'
};
const EFE_CARGA_PORTEADOR_COLORS = ['#0f3b6c', '#d92534', '#2b5ec9', '#1e9952', '#e69500'];

const efeCargaTooltip = (typeof efeExternalTooltip === 'function')
    ? efeExternalTooltip
    : CatlecTooltip.create({ domId: 'efe-analysis-tooltip' });

function efeCargaFmt(n, dec = 0) {
    if (n === null || n === undefined || !isFinite(n)) return 's/d';
    return Number(n).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function efeCargaVar(actual, anterior) {
    if (!isFinite(actual) || !isFinite(anterior) || !anterior) return null;
    return (actual - anterior) / anterior * 100;
}

function efeCargaVarText(pct, anio) {
    if (pct === null) return '';
    const signo = pct > 0 ? '+' : (pct < 0 ? '−' : '');
    return `${signo}${efeCargaFmt(Math.abs(pct), 1)}% respecto de ${anio}`;
}

function efeCargaPag(campo) {
    const D = window.EFE_CARGA;
    const p = D && D.paginas ? D.paginas[campo] : null;
    return p ? `Memoria ${D.anio}, pág. ${p}` : '';
}

// ── Mostrar / ocultar ────────────────────────────────────────────────────────
function showEfeCargaView() {
    if (typeof efeMap !== 'undefined' && efeMap && efeMap.getCenter) {
        efeState.savedMapCenter = efeMap.getCenter();
        efeState.savedMapZoom = efeMap.getZoom();
    }
    if (efeState.timelineOpen && typeof hideEfeTimelineView === 'function') hideEfeTimelineView(true);
    if (efeState.investmentOpen && typeof hideEfeInvestmentView === 'function') hideEfeInvestmentView(true);
    if (efeState.operacionOpen && typeof hideEfeOperacionView === 'function') hideEfeOperacionView(true);
    efeState.cargaOpen = true;

    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const panel = document.getElementById('efe-carga-full-panel');

    if (grid) grid.style.gridTemplateColumns = 'minmax(0, 1fr)';
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (panel) panel.style.display = 'flex';

    ['btn-efe-view-map', 'btn-efe-view-timeline', 'btn-efe-view-investment', 'btn-efe-view-operacion']
        .forEach(id => { const b = document.getElementById(id); if (b) b.classList.remove('active'); });
    const btn = document.getElementById('btn-efe-view-carga');
    if (btn) btn.classList.add('active');

    if (window.location.hash !== '#carga') history.replaceState(null, null, '#carga');

    renderEfeCargaView();
}

function hideEfeCargaView(skipRestoreCenter) {
    efeState.cargaOpen = false;

    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const panel = document.getElementById('efe-carga-full-panel');
    const btnMap = document.getElementById('btn-efe-view-map');
    const btn = document.getElementById('btn-efe-view-carga');

    if (grid) grid.style.gridTemplateColumns = '';
    if (centerPanel) centerPanel.style.display = 'flex';
    if (rightPanel) rightPanel.style.display = 'flex';
    if (panel) panel.style.display = 'none';

    if (btn) btn.classList.remove('active');
    if (btnMap && !efeState.investmentOpen && !efeState.timelineOpen && !efeState.operacionOpen) {
        btnMap.classList.add('active');
    }

    if (window.location.hash === '#carga') {
        history.replaceState(null, null, window.location.pathname + window.location.search);
    }

    if (typeof efeMap !== 'undefined' && efeMap) {
        efeMap.resize();
        if (!skipRestoreCenter && efeState.savedMapCenter) {
            efeMap.jumpTo({ center: efeState.savedMapCenter, zoom: efeState.savedMapZoom || 4 });
        }
    }
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderEfeCargaView() {
    const D = window.EFE_CARGA;
    const body = document.getElementById('efe-carga-body');
    const empty = document.getElementById('efe-carga-empty');
    if (!D) {
        if (body) body.style.display = 'none';
        if (empty) empty.style.display = 'flex';
        return;
    }
    renderEfeCargaKPIs(D);
    renderEfeCargaMeta(D);
    if (!efeCargaCharts.productos) renderEfeCargaProductos(D);
    if (!efeCargaCharts.serie) renderEfeCargaSerie(D);
    if (typeof renderEfeCargaMapa === 'function') renderEfeCargaMapa();
    if (window.lucide) lucide.createIcons();
}

function efeCargaSetText(id, text, title) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (title) el.title = title;
}

function renderEfeCargaKPIs(D) {
    const anio = D.anio;
    document.querySelectorAll('.efe-carga-anio').forEach(el => { el.textContent = anio; });

    efeCargaSetText('efe-carga-kpi-tkbc', D.tkbc_mm != null ? `${efeCargaFmt(D.tkbc_mm)} MM TKBC` : 's/d');
    const meta = D.meta || {};
    const serie = D.tkbc_serie || [];
    const kAnt = serie.length > 1 ? serie[serie.length - 2] : null;
    efeCargaSetText('efe-carga-kpi-tkbc-sub', [
        kAnt ? efeCargaVarText(efeCargaVar(D.tkbc_mm, kAnt.valor), kAnt.anio) : '',
        meta.tkbc_mm && D.tkbc_mm ? `${efeCargaFmt(D.tkbc_mm / meta.tkbc_mm * 100, 0)}% de la meta ${meta.anio}` : ''
    ].filter(Boolean).join(' · '));

    efeCargaSetText('efe-carga-kpi-ton', D.toneladas_mm != null ? `${efeCargaFmt(D.toneladas_mm, 2)} MM t` : 's/d');
    const v = D.variacion;
    efeCargaSetText('efe-carga-kpi-ton-sub', v ? efeCargaVarText(v.pct, v.respecto) : '');

    const teu = D.teu || [];
    const tUlt = teu[teu.length - 1];
    const tAnt = teu[teu.length - 2];
    efeCargaSetText('efe-carga-kpi-teu', tUlt ? `${efeCargaFmt(tUlt.valor)} TEU` : 's/d');
    efeCargaSetText('efe-carga-kpi-teu-sub', tUlt && tAnt ? efeCargaVarText(efeCargaVar(tUlt.valor, tAnt.valor), tAnt.anio) : '');
}

function renderEfeCargaMeta(D) {
    const meta = D.meta || {};
    const pct = meta.tkbc_mm && D.tkbc_mm ? Math.min(100, D.tkbc_mm / meta.tkbc_mm * 100) : 0;
    efeCargaSetText('efe-carga-meta-actual', `${efeCargaFmt(D.tkbc_mm)} de ${efeCargaFmt(meta.tkbc_mm)} MM TKBC`);
    efeCargaSetText('efe-carga-meta-pct', `${efeCargaFmt(pct, 0)}%`);
    efeCargaSetText('efe-carga-meta-anio', meta.anio || '');
    const fill = document.getElementById('efe-carga-meta-fill');
    if (fill) requestAnimationFrame(() => { fill.style.width = pct + '%'; });

    // Ritmo: crecimiento del último año frente al crecimiento anual que exige la meta
    const serie = D.tkbc_serie || [];
    const ult = serie[serie.length - 1];
    const ant = serie.length > 1 ? serie[serie.length - 2] : null;
    const ritmo = [];
    if (ult && ant) {
        const pctAnual = efeCargaVar(ult.valor, ant.valor);
        ritmo.push({
            val: `${pctAnual >= 0 ? '+' : '−'}${efeCargaFmt(Math.abs(pctAnual), 1)}%`,
            txt: `crecimiento ${ant.anio}–${ult.anio}`,
            title: serie.map(s => `${s.anio}: ${efeCargaFmt(s.valor)} MM TKBC (${s.fuente})`).join('\n')
        });
    }
    if (ult && meta.tkbc_mm && meta.anio > ult.anio) {
        const n = meta.anio - ult.anio;
        const cagr = (Math.pow(meta.tkbc_mm / ult.valor, 1 / n) - 1) * 100;
        ritmo.push({
            val: `${efeCargaFmt(cagr, 1)}% al año`,
            txt: `necesario hasta ${meta.anio}`,
            title: `Crecimiento anual para pasar de ${efeCargaFmt(ult.valor)} (${ult.anio}) a ${efeCargaFmt(meta.tkbc_mm)} MM TKBC (${meta.anio}): (${efeCargaFmt(meta.tkbc_mm)} / ${efeCargaFmt(ult.valor)})^(1/${n}) − 1`
        });
    }
    const ritmoBox = document.getElementById('efe-carga-ritmo');
    if (ritmoBox) {
        ritmoBox.innerHTML = ritmo.map(r => `
            <div class="efe-carga-fact efe-carga-fact--ritmo" title="${r.title}">
                <span class="efe-carga-fact-value">${r.val}</span>
                <span class="efe-carga-fact-label">${r.txt}</span>
            </div>`).join('');
    }
}

// Opciones comunes de los gráficos cartesianos
function efeCargaBaseOptions(extra) {
    return Object.assign({
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450, easing: 'easeOutQuart' },
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false, external: efeCargaTooltip }
        }
    }, extra || {});
}

// Productos movilizados por año (barras horizontales agrupadas, una por año de productos_serie).
// La Memoria 2024 los da en millones de t redondeados a una décima (`redondeado`), así que las
// variaciones entre años son aproximadas y el tooltip lo indica.
const EFE_CARGA_ANIO_COLORS = ['#94a3b8', '#2b5ec9', '#0f3b6c'];   // años anteriores más claros

function renderEfeCargaProductos(D) {
    const canvas = document.getElementById('efeCargaChartProductos');
    if (!canvas) return;
    const serie = (D.productos_serie && D.productos_serie.length)
        ? D.productos_serie
        : [{ anio: D.anio, redondeado: false, fuente: efeCargaPag('toneladas'), productos: D.productos || [] }];
    const ult = serie[serie.length - 1];

    // Productos en el orden del último año (mayor a menor, "Otros" al final)
    const orden = ult.productos.slice()
        .sort((a, b) => (a.nombre === 'Otros') - (b.nombre === 'Otros') || b.toneladas - a.toneladas)
        .map(p => p.nombre);
    serie.forEach(s => s.productos.forEach(p => { if (!orden.includes(p.nombre)) orden.splice(orden.length - 1, 0, p.nombre); }));
    const valor = (s, nombre) => { const p = s.productos.find(x => x.nombre === nombre); return p ? p.toneladas : null; };
    const totalDe = s => s.productos.reduce((t, p) => t + p.toneladas, 0) || 1;
    const colorOf = i => EFE_CARGA_ANIO_COLORS[EFE_CARGA_ANIO_COLORS.length - serie.length + i] || EFE_CARGA_COLORS.navy;

    const anios = serie.map(s => s.anio);
    efeCargaSetText('efe-carga-prod-anios', anios.length > 1 ? `${anios[0]}–${anios[anios.length - 1]}` : String(anios[0]));
    const legend = document.getElementById('efe-carga-prod-legend');
    if (legend) {
        legend.innerHTML = serie.map((s, i) => `
            <span class="efe-carga-legend-item" style="color:${colorOf(i)}">
                <span class="efe-carga-swatch" style="background:${colorOf(i)}"></span>${s.anio}
            </span>`).join('');
    }

    const fmtMM = (v, s) => efeCargaFmt(v / 1e6, s.redondeado ? 1 : 2);
    efeCargaCharts.productos = new Chart(canvas, {
        type: 'bar',
        plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
        data: {
            labels: orden,
            datasets: serie.map((s, i) => ({
                label: String(s.anio),
                data: orden.map(n => valor(s, n)),
                backgroundColor: colorOf(i) + 'cc',
                borderColor: colorOf(i),
                borderWidth: 1,
                borderRadius: 3,
                maxBarThickness: 16
            }))
        },
        options: efeCargaBaseOptions({
            indexAxis: 'y',
            interaction: { mode: 'index', axis: 'y', intersect: false },   // barras horizontales: el producto sale de la fila (eje y)
            layout: { padding: { right: 8 } },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#334155', font: { size: 9.5 }, callback: v => efeCargaFmt(v / 1e6, 1) },
                    title: { display: true, text: 'Millones de toneladas', color: '#334155', font: { size: 9.5, weight: '600' } }
                },
                y: { grid: { display: false }, ticks: { color: '#334155', font: { size: 10 } } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: efeCargaTooltip,
                    filter: item => item.raw !== null && item.raw !== undefined,
                    callbacks: {
                        label: c => {
                            const s = serie[c.datasetIndex];
                            const pct = efeCargaFmt(c.raw / totalDe(s) * 100, s.redondeado ? 0 : 1);
                            return s.redondeado
                                ? ` ${s.anio}: ${fmtMM(c.raw, s)} MM t (${pct}% del total; cifra redondeada)`
                                : ` ${s.anio}: ${efeCargaFmt(c.raw)} t (${pct}% del total)`;
                        },
                        afterBody: items => {
                            if (items.length < 2) return [];
                            const a = items[items.length - 2], b = items[items.length - 1];
                            const pct = efeCargaVar(b.raw, a.raw);
                            if (pct === null) return [];
                            const aprox = serie[a.datasetIndex].redondeado ? '≈ ' : '';
                            return [`${aprox}${efeCargaVarText(pct, serie[a.datasetIndex].anio)}`];
                        }
                    }
                },
                horizontalBarDataLabelsPlugin: {
                    allDatasets: true,
                    formatter: (v, dIdx) => fmtMM(v, serie[dIdx]),
                    outsideColor: (v, dIdx) => colorOf(dIdx)
                }
            }
        })
    });
}

// ── Carga por año: un gráfico de barras con botones MM TKBC / TEU / Toneladas ──
// MM TKBC va apilado por porteador (los años sin desglose, en gris); TEU y
// toneladas, una barra por año. El eje tiene siempre los mismos años en las tres
// métricas (de la primera a la última con dato en cualquiera de ellas): los años
// sin dato de una métrica quedan vacíos (TEU antes de 2022, toneladas 2020). La
// instancia se reutiliza al cambiar de métrica. Para que el cambio sea fluido, el
// área del gráfico no se mueve: el eje y tiene un ancho fijo (EFE_CARGA_SERIE_EJE_Y,
// suficiente para "60.000" de TEU con su título) y la tarjeta no lleva pie de fuente
// (cambiaba de una a dos líneas según la métrica; las fuentes están en "Acerca de").
const EFE_CARGA_SERIE_EJE_Y = 70;
const EFE_CARGA_METRICAS = {
    tkbc: { eje: 'Millones de TKBC', color: '#0f3b6c' },
    teu: { eje: 'TEU', color: '#2b5ec9' },
    toneladas: { eje: 'Millones de toneladas', color: '#e69500' }
};
let efeCargaSerieMetrica = 'tkbc';

function efeCargaRangoAnios(anios) {
    if (!anios.length) return [];
    const out = [];
    for (let a = Math.min(...anios); a <= Math.max(...anios); a++) out.push(a);
    return out;
}

// Años del eje: de la primera a la última con dato en cualquiera de las métricas
function efeCargaSerieAnios(D) {
    const anios = [].concat(D.tkbc_serie || [], D.teu || [], D.toneladas_serie || []).map(s => s.anio);
    return efeCargaRangoAnios(anios.filter(a => Number.isFinite(a)));
}

// Datos, leyenda, fuente y textos del tooltip de una métrica
function efeCargaSerieDatos(D, metrica) {
    const meta = D.meta || {};
    const anios = efeCargaSerieAnios(D);
    const barra = (label, color, data) => ({
        type: 'bar', label, data, backgroundColor: color + 'cc', borderColor: color,
        borderWidth: 1, borderRadius: 3, maxBarThickness: 44
    });
    // Variación respecto del año anterior con dato
    const varAnterior = (valores, anios, i) => {
        for (let j = i - 1; j >= 0; j--) {
            if (valores[j] != null) return efeCargaVarText(efeCargaVar(valores[i], valores[j]), anios[j]);
        }
        return '';
    };

    if (metrica === 'tkbc') {
        const serie = D.tkbc_serie || [];
        const de = a => serie.find(s => s.anio === a) || null;
        const nombres = [];
        serie.forEach(s => Object.keys(s.porteadores || {}).forEach(n => { if (!nombres.includes(n)) nombres.push(n); }));
        const colorOf = i => EFE_CARGA_PORTEADOR_COLORS[i % EFE_CARGA_PORTEADOR_COLORS.length];
        const datasets = nombres.map((n, i) => barra(n, colorOf(i), anios.map(a => {
            const s = de(a);
            return s && s.porteadores && s.porteadores[n] != null ? s.porteadores[n] : null;
        })));
        const sinDesglose = anios.map(a => { const s = de(a); return s && !s.porteadores ? s.valor : null; });
        if (sinDesglose.some(v => v !== null)) datasets.push(barra('Sin desglose por porteador', EFE_CARGA_COLORS.gray, sinDesglose));
        const totales = anios.map(a => (de(a) || {}).valor ?? null);
        return {
            anios, datasets, apilado: true,
            leyenda: datasets.map(ds => ({ label: ds.label === 'Sin desglose por porteador' ? 'Sin desglose' : ds.label, color: ds.borderColor })),
            max: Math.max(0, ...totales.filter(v => v != null)),
            label: c => ` ${c.dataset.label}: ${efeCargaFmt(c.raw)} MM TKBC`,
            afterBody: i => {
                if (totales[i] == null) return ['Sin dato en las Memorias'];
                const lines = [`Total: ${efeCargaFmt(totales[i])} MM TKBC`];
                const v = varAnterior(totales, anios, i);
                if (v) lines.push(v);
                if (meta.tkbc_mm) lines.push(`${efeCargaFmt(totales[i] / meta.tkbc_mm * 100, 0)}% de la meta ${meta.anio} (${efeCargaFmt(meta.tkbc_mm)})`);
                return lines;
            },
            etiqueta: v => efeCargaFmt(v)
        };
    }

    if (metrica === 'teu') {
        const serie = D.teu || [];
        const valores = anios.map(a => (serie.find(s => s.anio === a) || {}).valor ?? null);
        const color = EFE_CARGA_METRICAS.teu.color;
        return {
            anios, datasets: [barra('Unidades intermodales', color, valores)], apilado: false,
            leyenda: [{ label: 'Unidades intermodales (TEU)', color }],
            max: Math.max(0, ...valores.filter(v => v != null)),
            label: c => ` Unidades intermodales: ${efeCargaFmt(c.raw)} TEU`,
            afterBody: i => valores[i] == null ? ['Sin dato en las Memorias'] : [varAnterior(valores, anios, i)].filter(Boolean),
            etiqueta: v => efeCargaFmt(v)
        };
    }

    // Toneladas
    const serie = D.toneladas_serie || [];
    const de = a => serie.find(s => s.anio === a) || null;
    const valores = anios.map(a => (de(a) || {}).valor_mm ?? null);
    const color = EFE_CARGA_METRICAS.toneladas.color;
    return {
        anios, datasets: [barra('Toneladas', color, valores)], apilado: false,
        leyenda: [{ label: 'Millones de toneladas', color }],
        max: Math.max(0, ...valores.filter(v => v != null)),
        label: c => ` ${efeCargaFmt(c.raw, 2)} millones de toneladas`,   // mismo formato todos los años
        afterBody: i => {
            if (valores[i] == null) return ['Sin dato: ninguna Memoria publica las toneladas de este año'];
            // Si este año y el anterior tienen promedio mensual, la variación sale de él (es la que
            // publica EFE: 2025 +4,8%); los totales de 2024 vienen redondeados (8,6 MM t) y darían otra
            const s = de(anios[i]), p = de(anios[i] - 1);
            if (s && p && s.promedio_mensual_t && p.promedio_mensual_t) {
                return [efeCargaVarText(efeCargaVar(s.promedio_mensual_t, p.promedio_mensual_t), p.anio)];
            }
            return [varAnterior(valores, anios, i)].filter(Boolean);
        },
        etiqueta: v => efeCargaFmt(v, 2)
    };
}

// Rótulo "Sin info" en los años sin dato de la métrica (todas las series en null), sobre el eje x.
// Si la columna es más angosta que el texto, va vertical.
const efeCargaSinInfoPlugin = {
    id: 'efeCargaSinInfo',
    afterDatasetsDraw(chart) {
        const n = chart.data.labels.length;
        if (!n) return;
        const area = chart.chartArea, x = chart.scales.x, ctx = chart.ctx;
        const ancho = (area.right - area.left) / n;
        ctx.save();
        ctx.font = 'italic 500 9px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#94a3b8';
        const texto = 'Sin info';
        const vertical = ctx.measureText(texto).width > ancho - 4;
        for (let i = 0; i < n; i++) {
            if (chart.data.datasets.some(ds => ds.data[i] !== null && ds.data[i] !== undefined)) continue;
            const cx = x.getPixelForValue(i);
            if (vertical) {
                ctx.save();
                ctx.translate(cx, area.bottom - 4);
                ctx.rotate(-Math.PI / 2);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(texto, 0, 0);
                ctx.restore();
            } else {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(texto, cx, area.bottom - 3);
            }
        }
        ctx.restore();
    }
};

function renderEfeCargaSerie(D) {
    const canvas = document.getElementById('efeCargaChartSerie');
    if (!canvas) return;
    const S = efeCargaSerieDatos(D, efeCargaSerieMetrica);

    efeCargaCharts.serie = new Chart(canvas, {
        type: 'bar',
        plugins: [CatlecUtils.stackedBarDataLabelsPlugin, CatlecUtils.groupedBarDataLabelsPlugin, efeCargaSinInfoPlugin],
        data: { labels: S.anios.map(String), datasets: S.datasets },
        options: efeCargaBaseOptions({
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: '#334155', font: { size: 10 } } },
                y: {
                    stacked: true, beginAtZero: true,
                    afterFit: axis => { axis.width = EFE_CARGA_SERIE_EJE_Y; },
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#334155', font: { size: 9.5 }, callback: v => efeCargaFmt(v) },
                    title: { display: true, text: '', color: '#334155', font: { size: 9.5, weight: '600' } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: efeCargaTooltip,
                    filter: item => item.raw !== null && item.raw !== undefined,
                    callbacks: {}
                }
            }
        })
    });

    document.querySelectorAll('#efe-carga-serie-toggle button').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.metrica === efeCargaSerieMetrica) return;
            efeCargaSerieMetrica = btn.dataset.metrica;
            efeCargaActualizarSerie(D);
        });
    });
    efeCargaActualizarSerie(D);
}

// Cambia la métrica del gráfico por año en la misma instancia (sin recrearlo)
function efeCargaActualizarSerie(D) {
    const chart = efeCargaCharts.serie;
    if (!chart) return;
    const S = efeCargaSerieDatos(D, efeCargaSerieMetrica);
    const o = chart.options;

    chart.data.labels = S.anios.map(String);
    chart.data.datasets = S.datasets;
    o.scales.x.stacked = S.apilado;
    o.scales.y.stacked = S.apilado;
    o.scales.y.suggestedMax = S.max * 1.15;
    o.scales.y.title.text = EFE_CARGA_METRICAS[efeCargaSerieMetrica].eje;
    o.plugins.tooltip.callbacks = { label: S.label, afterBody: items => items.length ? S.afterBody(items[0].dataIndex) : [] };
    // Etiquetas: dentro de cada tramo si es apilado, sobre la barra si no
    o.plugins.stackedBarDataLabelsPlugin = S.apilado ? { formatter: S.etiqueta, minHeight: 14 } : false;
    o.plugins.groupedBarDataLabelsPlugin = S.apilado ? false
        : { formatter: v => S.etiqueta(v), color: S.datasets[0].borderColor, offset: 4 };
    chart.update();

    document.querySelectorAll('#efe-carga-serie-toggle button').forEach(btn => {
        const activo = btn.dataset.metrica === efeCargaSerieMetrica;
        btn.classList.toggle('is-active', activo);
        btn.setAttribute('aria-pressed', activo ? 'true' : 'false');
    });
    const legend = document.getElementById('efe-carga-serie-legend');
    if (legend) {
        legend.innerHTML = S.leyenda.map(l => `
            <span class="efe-carga-legend-item" style="color:${l.color}">
                <span class="efe-carga-swatch" style="background:${l.color}"></span>${l.label}
            </span>`).join('');
    }
}

if (typeof window !== 'undefined') {
    window.showEfeCargaView = showEfeCargaView;
    window.hideEfeCargaView = hideEfeCargaView;
}
