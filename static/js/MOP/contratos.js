// ─── static/js/MOP/contratos.js ───────────────────────────────────────────────
// Visualizaciones del módulo MOP fuera de la tabla de proyectos: "Costo por
// región y servicio" (costo de etapa de los proyectos filtrados, de sus fichas
// IDI) y, con los contratos de esos proyectos, "Contratos y contratistas". Ocupan el lugar del mapa y la tabla (el panel de filtros y
// Análisis sigue a la izquierda) y usan los proyectos filtrados
// (mopFilteredProjects de main.js).
//
// Datos de los contratos: window.MOP_CONTRATOS (static/data/mop_contratos.js, generado por
// scripts/export_static_data.py desde el mismo Excel mensual que MOP_DATA), un
// registro por contrato: { bip, cod, nombre, estado, tipo, gasto, an, fl, fa,
// fi, ft (fechas AAAA-MM-DD), po (presupuesto oficial), mv (monto vigente), ct,
// rut (contratista; null si es genérico), av (% ejecución), m (12 meses), ar
// (arrastre al año siguiente) }. Montos en M$ (miles de pesos). En `m`, hasta el
// mes de cierre (MOP_CONTRATOS.mes) son pagos y desde ahí, lo programado. Pesa
// ~2,4 MB, así que se carga recién al abrir "Contratos y contratistas".
//
// Navegación: botones del subheader, enlaces del menú "Seleccionar Base de
// Datos" y hash de la URL (#costos, #contratos) llaman a
// mopSetView.

const MOP_CONTRATOS_SRC = 'static/data/mop_contratos.js?v=20261029_1';
const MOP_VIEWS = ['resumen', 'costos', 'contratos'];
// Hash de vistas que ya no existen → vista que las reemplazó
const MOP_VIEW_ALIASES = { contratistas: 'contratos', ejecucion: 'costos' };
// Vistas que usan mop_contratos.js (la de costos usa solo MOP_DATA)
const MOP_CONTRATOS_VIEWS = ['contratos'];
// Estados en el orden del ciclo del contrato ("Nulo" no se muestra)
const MOP_ESTADOS = ['Por Licitar', 'En Licitación', 'En Adjudicación', 'Adjudicado', 'En Ejecución', 'Terminado'];
const MOP_ESTADO_LABELS = {
    'Por Licitar': 'Por licitar', 'En Licitación': 'En licitación', 'En Adjudicación': 'En adjudicación',
    'Adjudicado': 'Adjudicado', 'En Ejecución': 'En ejecución', 'Terminado': 'Terminado',
};
const MOP_ESTADO_COLORS = {
    'Por Licitar': '#9fd1f6', 'En Licitación': '#2ea3f2', 'En Adjudicación': '#0c71c3',
    'Adjudicado': '#1e4f65', 'En Ejecución': '#001c41', 'Terminado': '#6b7280',
};
const MOP_TIPO_LABELS = {
    'Propuesta publica': 'Propuesta pública', 'Trato directo': 'Trato directo',
    'Trato Directo con Cotización': 'Trato directo con cotización', 'Propuesta privada': 'Propuesta privada',
    'Sin Información': 'Sin información',
};
const MOP_TIPO_COLORS = {
    'Propuesta pública': '#0c71c3', 'Trato directo': '#de702c', 'Trato directo con cotización': '#2d717c',
    'Propuesta privada': '#a51f15', 'Sin información': '#6b7280',
};
const MOP_REGION_CORTA = {
    "Libertador General Bernardo O'Higgins": "O'Higgins", 'Metropolitana de Santiago': 'Metropolitana',
    'Aysén del General Carlos Ibáñez del Campo': 'Aysén', 'Magallanes y de la Antártica Chilena': 'Magallanes',
};
const MOP_CT_COLORS = { barra: '#0c71c3' };

let mopView = 'resumen';
let mopContratosPromise = null;
const mopCtCharts = {};

// ─── Carga diferida de mop_contratos.js ──────────────────────────────────────
function mopLoadContratos() {
    if (window.MOP_CONTRATOS) return Promise.resolve();
    if (!mopContratosPromise) {
        mopContratosPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = MOP_CONTRATOS_SRC;
            script.onload = () => resolve();
            script.onerror = () => { mopContratosPromise = null; reject(new Error('No se pudo cargar mop_contratos.js')); };
            document.head.appendChild(script);
        });
    }
    return mopContratosPromise;
}

// ─── Cambio de visualización ─────────────────────────────────────────────────
function mopSetView(view, { updateHash = true } = {}) {
    view = MOP_VIEW_ALIASES[view] || view;
    if (!MOP_VIEWS.includes(view)) view = 'resumen';
    mopView = view;
    document.querySelectorAll('.view-subheader .view-tab-btn[data-mop-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mopView === view);
    });
    const resumen = view === 'resumen';
    // El separador mapa ↔ tabla se oculta solo al ocultar la tabla (CatlecPanelResizer)
    document.getElementById('mop-map-panel').style.display = resumen ? '' : 'none';
    document.getElementById('mop-right-panel').style.display = resumen ? '' : 'none';
    MOP_VIEWS.slice(1).forEach(v => {
        document.getElementById(`mop-view-${v}`).style.display = v === view ? 'flex' : 'none';
    });
    if (updateHash) {
        history.replaceState(null, '', resumen ? location.pathname + location.search : `#${view}`);
    }
    mopTooltip && CatlecTooltip.hide('mop-shared-tooltip');
    if (resumen) {
        if (typeof mopProjectMap !== 'undefined' && mopProjectMap) requestAnimationFrame(() => mopProjectMap.resize());
        return;
    }
    if (!MOP_CONTRATOS_VIEWS.includes(view)) {
        mopRenderView(view);
        return;
    }
    mopLoadContratos()
        .then(() => { if (mopView === view) mopRenderView(view); })
        .catch(err => console.error('[MOP]', err));
}

// main.js la llama al cambiar los filtros
function mopContratosOnFilter() {
    if (mopView === 'resumen') return;
    if (!MOP_CONTRATOS_VIEWS.includes(mopView) || window.MOP_CONTRATOS) mopRenderView(mopView);
}

function mopRenderView(view) {
    if (typeof Chart === 'undefined') return;
    if (view === 'costos') mopRenderCostos();
    else if (view === 'contratos') mopRenderContratos();
}

// ─── Utilidades ──────────────────────────────────────────────────────────────
// Contratos de los proyectos filtrados (sin los nulos)
function mopFilteredContratos() {
    const bips = new Set(mopFilteredProjects.map(p => p.bip));
    return window.MOP_CONTRATOS.contratos.filter(c => bips.has(c.bip) && c.estado !== 'Nulo');
}

// M$ → miles de millones de pesos, para los ejes de los gráficos
function mopToMMM(milesPesos) {
    return milesPesos / 1e6;
}

// Etiqueta de barra en miles de millones: sin decimales desde 100, con uno abajo
function mopFmtEtiquetaMMM(mmm) {
    return Number(mmm || 0).toLocaleString('es-CL', { maximumFractionDigits: mmm >= 100 ? 0 : 1 });
}

function mopFmtMMM(mmm) {
    return `${Number(mmm || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil millones`;
}

function mopPct(part, total) {
    return total ? `${(part / total * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 })}%` : '0%';
}

function mopSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// Etiqueta de eje acortada (el nombre completo va en el título del tooltip)
function mopCorto(text, max) {
    const s = String(text || '');
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function mopRegionCorta(region) {
    return MOP_REGION_CORTA[region] || region || 'Sin región';
}

// Opciones comunes de los gráficos de barras (estándar catlec-bar-chart)
// `dataLabels`: formato de la etiqueta de cada barra (plugins comunes de CatlecUtils:
// al final de la barra horizontal, dentro si cabe; sobre la barra vertical)
function mopCtBarOptions({ horizontal = false, stacked = false, label, title, afterBody, y1 = null, dataLabels = null, insideColor = null } = {}) {
    const grid = 'rgba(0, 0, 0, 0.06)';
    const ticks = { font: { size: 10 }, color: '#475569' };
    const valueAxis = { beginAtZero: true, stacked, grid: { color: grid }, ticks: { ...ticks, maxTicksLimit: horizontal ? 5 : 7, callback: (v) => Number(v).toLocaleString('es-CL') } };
    const catAxis = { stacked, grid: { display: false }, ticks: { ...ticks, autoSkip: false } };
    const scales = horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis };
    if (y1) scales.y1 = y1;
    const labelPlugins = {};
    if (dataLabels) {
        labelPlugins[horizontal ? 'horizontalBarDataLabelsPlugin' : 'groupedBarDataLabelsPlugin'] = { formatter: dataLabels, ...(insideColor ? { insideColor } : {}) };
    }
    return {
        indexAxis: horizontal ? 'y' : 'x',
        // Margen para las etiquetas que quedan fuera de la barra más larga o alta
        layout: { padding: dataLabels ? (horizontal ? { right: 8 } : { top: 14 }) : 0 },
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: Math.max(2.5, window.devicePixelRatio || 1),
        animation: MOP_CHART_ANIMATION,
        // En barras horizontales la categoría está en el eje Y: sin axis 'y', el modo
        // index elige por la posición horizontal del cursor y muestra otra barra
        interaction: { mode: 'index', intersect: false, axis: horizontal ? 'y' : 'x' },
        scales,
        plugins: {
            legend: { display: false },
            ...labelPlugins,
            // Sin las barras vacías (meses pagados o programados que no corresponden)
            tooltip: { enabled: false, external: mopTooltip, filter: (item) => item.raw != null,
                       callbacks: { label, ...(title ? { title } : {}), ...(afterBody ? { afterBody } : {}) } },
        },
    };
}

// Crea el gráfico la primera vez y luego lo actualiza en el lugar
function mopCtChart(id, type, data, options) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const chart = mopCtCharts[id];
    if (!chart) {
        // Plugin de etiquetas solo si las opciones lo piden (sin opciones dibujaría igual)
        const plugins = ['horizontalBarDataLabelsPlugin', 'groupedBarDataLabelsPlugin']
            .filter(k => options.plugins && options.plugins[k]).map(k => CatlecUtils[k]);
        mopCtCharts[id] = new Chart(canvas, { type, data, options, plugins });
        return;
    }
    chart.data = data;
    chart.options = options;
    chart.update();
}

function mopBar(label, data, color, extra = {}) {
    return { type: 'bar', label, data, backgroundColor: color, borderColor: color, borderWidth: 1, borderRadius: 3, order: 2, ...extra };
}

// ─── Costo por región y servicio ─────────────────────────────────────────────
// Costo total = suma del costo de etapa de los proyectos filtrados (columna
// "Costo etapa" de la tabla: sección 16 de sus fichas IDI, M$ del año
// MOP_DATA.summary.inversion_year); los proyectos sin ficha no suman.
function mopRenderCostos() {
    const porRegion = {};
    const porServicio = {};
    const sumar = (acc, key, p) => {
        const row = acc[key] = acc[key] || { costo: 0, n: 0, sinFicha: 0 };
        row.n++;
        if (p.inversion == null) row.sinFicha++;
        else row.costo += p.inversion;
    };
    mopFilteredProjects.forEach(p => {
        sumar(porRegion, p.region || 'Sin región', p);
        sumar(porServicio, p.servicio || 'Sin servicio', p);
    });
    const anio = (window.MOP_DATA.summary && window.MOP_DATA.summary.inversion_year) || '';
    const total = mopFilteredProjects.reduce((s, p) => s + (p.inversion || 0), 0);
    const badge = `${mopFmtInversionCompact(total)} · pesos ${anio}`;
    mopSetText('mop-co-region-badge', badge);
    mopSetText('mop-co-servicio-badge', badge);

    // Regiones de norte a sur (Interregional al final); servicios de mayor a menor costo
    const orden = (window.MOP_DATA.filters && window.MOP_DATA.filters.regions) || [];
    const regiones = Object.entries(porRegion).sort((a, b) => (orden.indexOf(a[0]) + 1 || 99) - (orden.indexOf(b[0]) + 1 || 99));
    mopRenderCostoBarras('chart-mop-co-region', regiones.map(([r, v]) => ({ label: mopRegionCorta(r), full: r, ...v })));
    const servicios = Object.entries(porServicio).sort((a, b) => b[1].costo - a[1].costo);
    mopRenderCostoBarras('chart-mop-co-servicio', servicios.map(([s, v]) => ({
        label: mopCorto(MOP_SERVICIO_LABELS[s] || mopShortServicio(s), 26), full: s, ...v,
    })));
}

// Barras horizontales del costo total; el tooltip suma proyectos y los sin ficha
function mopRenderCostoBarras(id, rows) {
    mopCtChart(id, 'bar', {
        labels: rows.map(r => r.label),
        datasets: [mopBar('Costo total', rows.map(r => mopToMMM(r.costo)), 'rgba(12, 113, 195, 0.8)', { borderColor: MOP_CT_COLORS.barra })],
    }, mopCtBarOptions({
        horizontal: true,
        title: (items) => (items.length ? rows[items[0].dataIndex].full : ''),
        label: (ctx) => ` Costo total: ${mopFmtMMM(ctx.raw)}`,
        dataLabels: mopFmtEtiquetaMMM,
        afterBody: (items) => {
            if (!items.length) return [];
            const r = rows[items[0].dataIndex];
            return [`${mopFmt(r.n)} proyectos${r.sinFicha ? ` · ${mopFmt(r.sinFicha)} sin ficha IDI` : ''}`];
        },
    }));
}

// ─── Contratos y contratistas ────────────────────────────────────────────────
// Monto de un contrato: el vigente o, si aún no se adjudica, el presupuesto oficial
function mopMontoContrato(c) {
    return c.mv || c.po || 0;
}

function mopRenderContratos() {
    const contratos = mopFilteredContratos();
    const porEstado = {};
    MOP_ESTADOS.forEach(e => { porEstado[e] = { n: 0, monto: 0 }; });
    contratos.forEach(c => {
        const row = porEstado[c.estado];
        if (!row) return;
        row.n++;
        row.monto += mopMontoContrato(c);
    });
    const montoTotal = contratos.reduce((s, c) => s + mopMontoContrato(c), 0);
    const licitar = ['Por Licitar', 'En Licitación'].reduce((acc, e) => ({ n: acc.n + porEstado[e].n, monto: acc.monto + porEstado[e].monto }), { n: 0, monto: 0 });

    // Contratistas: por RUT, solo los contratos con contratista (sin los genéricos)
    const porContratista = {};
    contratos.filter(c => c.ct).forEach(c => {
        const key = c.rut || c.ct;
        const row = porContratista[key] = porContratista[key] || { nombre: c.ct, n: 0, monto: 0 };
        row.n++;
        row.monto += c.mv;
    });
    const contratistas = Object.values(porContratista).sort((a, b) => b.monto - a.monto);
    const montoContratistas = contratistas.reduce((s, r) => s + r.monto, 0);
    const top10 = contratistas.slice(0, 10).reduce((s, r) => s + r.monto, 0);

    mopSetText('mop-ct-kpi-total', mopFmt(contratos.length));
    mopSetText('mop-ct-kpi-total-sub', `${mopFmtInversionCompact(montoTotal)} en monto vigente o presupuesto`);
    mopSetText('mop-ct-kpi-ejecucion', mopFmt(porEstado['En Ejecución'].n));
    mopSetText('mop-ct-kpi-ejecucion-sub', `${mopFmtInversionCompact(porEstado['En Ejecución'].monto)} en monto vigente`);
    mopSetText('mop-ct-kpi-licitar', mopFmt(licitar.n));
    mopSetText('mop-ct-kpi-licitar-sub', `${mopFmtInversionCompact(licitar.monto)} en presupuesto oficial`);
    mopSetText('mop-cs-kpi-total', mopFmt(contratistas.length));
    mopSetText('mop-cs-kpi-total-sub', contratistas.length ? `Los 10 mayores: ${mopPct(top10, montoContratistas)} del monto vigente` : 'Sin contratistas para los filtros');
    mopSetText('mop-ct-estado-badge', `${mopFmt(contratos.length)} contratos`);

    // Contratos por estado (orden del ciclo del contrato)
    const estados = MOP_ESTADOS.filter(e => porEstado[e].n);
    mopCtChart('chart-mop-ct-estado', 'bar', {
        labels: estados.map(e => MOP_ESTADO_LABELS[e]),
        datasets: [mopBar('Contratos', estados.map(e => porEstado[e].n), estados.map(e => MOP_ESTADO_COLORS[e]))],
    }, {
        ...mopCtBarOptions({
            horizontal: true,
            label: (ctx) => ` ${mopFmt(ctx.raw)} contratos · ${mopFmtInversionCompact(porEstado[estados[ctx.dataIndex]].monto)}`,
            dataLabels: (v) => mopFmt(v),
            // Texto oscuro dentro de las barras celestes (por licitar, en licitación)
            insideColor: (v, d, i) => (['Por Licitar', 'En Licitación'].includes(estados[i]) ? '#0f172a' : '#ffffff'),
        }),
        interaction: { mode: 'nearest', intersect: true, axis: 'y' },
    });

    // Tipo de contratación (por monto)
    const porTipo = {};
    contratos.forEach(c => {
        const tipo = MOP_TIPO_LABELS[c.tipo] || c.tipo || 'Sin información';
        porTipo[tipo] = (porTipo[tipo] || 0) + mopMontoContrato(c);
    });
    const tipos = Object.entries(porTipo).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    mopRenderDonut('tipo', tipos.map(([tipo, monto]) => ({
        label: tipo, full: tipo, count: monto, color: MOP_TIPO_COLORS[tipo] || MOP_OTROS_COLOR,
    })), { fmt: (v) => mopFmtInversionCompact(v), empty: 'Sin contratos para los filtros' });

    // 15 mayores contratistas por monto vigente
    const top = contratistas.slice(0, 15);
    mopCtChart('chart-mop-cs-top', 'bar', {
        labels: top.map(r => mopCorto(r.nombre, 30)),
        datasets: [mopBar('Monto vigente', top.map(r => mopToMMM(r.monto)), 'rgba(12, 113, 195, 0.8)', { borderColor: MOP_CT_COLORS.barra })],
    }, mopCtBarOptions({
        horizontal: true,
        title: (items) => (items.length ? top[items[0].dataIndex].nombre : ''),
        label: (ctx) => ` ${mopFmtMMM(ctx.raw)} · ${mopFmt(top[ctx.dataIndex].n)} contratos`,
        dataLabels: mopFmtEtiquetaMMM,
    }));
}

// ─── Inicialización ──────────────────────────────────────────────────────────
function mopInitViews() {
    document.querySelectorAll('.view-subheader .view-tab-btn[data-mop-view]').forEach(btn => {
        btn.addEventListener('click', () => mopSetView(btn.dataset.mopView));
    });
    const fromHash = () => mopSetView(location.hash.replace('#', ''), { updateHash: false });
    window.addEventListener('hashchange', fromHash);
    if (location.hash) fromHash();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mopInitViews);
} else {
    mopInitViews();
}
