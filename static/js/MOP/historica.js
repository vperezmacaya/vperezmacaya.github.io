// ─── static/js/MOP/historica.js ───────────────────────────────────────────────
// Visualización "Inversión histórica" del módulo MOP: lo pagado cada año desde
// 1986 por servicio (histograma apilado), lo acumulado por región y las mayores
// obras del período. Ocupa el lugar del mapa y la tabla, como las vistas de
// contratos.js (que la abre con mopSetView y la redibuja al filtrar).
//
// Datos: window.MOP_HISTORICO (static/data/mop_historico.js, generado por
// scripts/etl/mop_historico.py desde el Excel "Inversión Histórica MOP" de la
// Dirección de Planeamiento), sin las concesiones y en M$ (miles de pesos) del
// año MOP_HISTORICO.source.moneda:
//   servicios, regiones   nombres (los de MOP_DATA cuando el servicio sigue existiendo)
//   anual                 [año, servicio, región, M$] (índices de servicios y regiones)
//   obras                 [{ bip, nombre, a0, a1, actual }] BIP que no son programas ni
//                         conservaciones (por su nombre); `actual`: sigue en MOP_DATA
//   obra_montos           [obra, servicio, región, M$] de esas obras
// La vista oculta el panel izquierdo (filtros y Análisis de la cartera actual,
// otra base) y trae sus propios filtros de servicio y región, con las listas de
// MOP_HISTORICO (incluye servicios que ya no existen); no tocan los de la tabla.

const MOP_HIST_TOP_SERVICIOS = 6;   // el resto va apilado en "Otros"
const MOP_HIST_TOP_OBRAS = 10;
const MOP_HIST_ULTIMOS_ANIOS = 10;  // período del KPI "Promedio anual"

// Filtros propios de la vista (nombres de MOP_HISTORICO.servicios y .regiones)
const mopHistFilters = { servicios: [], regions: [] };
let mopHistFiltersReady = false;

// Arma los desplegables la primera vez que se abre la vista (los datos se
// cargan recién entonces)
function mopSetupHistoricaFilters(H) {
    if (mopHistFiltersReady) return;
    mopHistFiltersReady = true;
    const servicios = H.servicios.slice()
        .sort((a, b) => mopHistServicioCorto(a).localeCompare(mopHistServicioCorto(b), 'es'));
    CatlecUtils.setupMultiselect('mop-hi-servicio', servicios, 'Todos los servicios', 'servicios seleccionados', (selected) => {
        mopHistFilters.servicios = selected;
        mopRenderHistorica();
    }, { renderOptionLabel: mopHistServicioCorto, formatSingleLabel: mopHistServicioCorto });
    CatlecUtils.setupMultiselect('mop-hi-region', H.regiones, 'Todas las regiones', 'regiones seleccionadas', (selected) => {
        mopHistFilters.regions = selected;
        mopRenderHistorica();
    });
    document.getElementById('mop-hi-btn-reset').addEventListener('click', mopResetHistoricaFilters);
}

function mopResetHistoricaFilters() {
    [['mop-hi-servicio', 'Todos los servicios'], ['mop-hi-region', 'Todas las regiones']].forEach(([prefix, label]) => {
        document.querySelectorAll(`.${prefix}-checkbox, #${prefix}-check-all`).forEach(cb => { cb.checked = false; });
        document.getElementById(`${prefix}-multiselect-text`).textContent = label;
    });
    mopHistFilters.servicios = [];
    mopHistFilters.regions = [];
    CatlecUtils.closeAllMultiselects();
    mopRenderHistorica();
}

// Índices de servicios y regiones que dejan pasar los filtros (null: todos)
function mopHistAllowed(names, selected) {
    if (!selected.length) return null;
    const set = new Set(selected);
    return new Set(names.map((n, i) => (set.has(n) ? i : -1)).filter(i => i >= 0));
}

function mopHistPasa(allowedS, allowedR, s, r) {
    return (!allowedS || allowedS.has(s)) && (!allowedR || allowedR.has(r));
}

// Nombre corto de un servicio para leyendas y ejes (igual que en Análisis)
function mopHistServicioCorto(servicio) {
    return MOP_SERVICIO_LABELS[servicio] || mopShortServicio(servicio).replace(/^Conservaciones por Administración Directa - Dirección de /, 'Adm. directa ');
}

function mopRenderHistorica() {
    const H = window.MOP_HISTORICO;
    if (!H) return;
    mopSetupHistoricaFilters(H);
    const { desde, hasta, moneda } = H.source;
    const allowedS = mopHistAllowed(H.servicios, mopHistFilters.servicios);
    const allowedR = mopHistAllowed(H.regiones, mopHistFilters.regions);
    const anios = [];
    for (let a = desde; a <= hasta; a++) anios.push(a);

    // Totales por año y servicio, por servicio y por año. Por región, con todos los
    // filtros salvo el de región: las regiones elegidas se resaltan entre las demás
    const porAnioServicio = {};
    const porServicio = {};
    const porRegion = {};
    const porAnio = {};
    H.anual.forEach(([a, s, r, m]) => {
        if (mopHistPasa(allowedS, null, s, r)) porRegion[r] = (porRegion[r] || 0) + m;
        if (!mopHistPasa(allowedS, allowedR, s, r)) return;
        const key = `${a}|${s}`;
        porAnioServicio[key] = (porAnioServicio[key] || 0) + m;
        porServicio[s] = (porServicio[s] || 0) + m;
        porAnio[a] = (porAnio[a] || 0) + m;
    });
    const total = Object.values(porAnio).reduce((s, v) => s + v, 0);

    mopRenderHistoricaKpis(anios, porAnio, total, moneda);
    mopRenderHistoricaAnual(H, anios, porAnioServicio, porServicio, porAnio, moneda);
    mopRenderHistoricaRegiones(H, porRegion, allowedR, desde, hasta);
    mopRenderHistoricaObras(H, allowedS, allowedR, desde, hasta);
    mopSetText('mop-hi-nota', 'Sin concesiones');  // excluidas en el ETL
}

// ─── KPI ─────────────────────────────────────────────────────────────────────
function mopRenderHistoricaKpis(anios, porAnio, total, moneda) {
    const desde = anios[0];
    const hasta = anios[anios.length - 1];
    const ultimo = porAnio[hasta] || 0;
    const previo = porAnio[hasta - 1] || 0;
    const recientes = anios.slice(-MOP_HIST_ULTIMOS_ANIOS);
    const promedio = recientes.reduce((s, a) => s + (porAnio[a] || 0), 0) / recientes.length;
    const max = anios.reduce((best, a) => ((porAnio[a] || 0) > (porAnio[best] || 0) ? a : best), desde);
    const pctVar = previo ? (ultimo / previo - 1) * 100 : null;

    mopSetText('mop-hi-kpi-total', total ? mopFmtInversionCompact(total) : '—');
    mopSetText('mop-hi-kpi-total-sub', `${desde}–${hasta} · pesos ${moneda}`);
    mopSetText('mop-hi-kpi-ultimo', ultimo ? mopFmtInversionCompact(ultimo) : '—');
    mopSetText('mop-hi-kpi-ultimo-sub', pctVar == null ? `Pagado en ${hasta}`
        : `${pctVar >= 0 ? '+' : '−'}${Math.abs(pctVar).toLocaleString('es-CL', { maximumFractionDigits: 1 })}% respecto de ${hasta - 1}`);
    mopSetText('mop-hi-kpi-promedio', promedio ? mopFmtInversionCompact(promedio) : '—');
    mopSetText('mop-hi-kpi-promedio-sub', `${recientes[0]}–${hasta}`);
    mopSetText('mop-hi-kpi-max', total ? String(max) : '—');
    mopSetText('mop-hi-kpi-max-sub', total ? `${mopFmtInversionCompact(porAnio[max])} pagados` : 'Sin inversión para los filtros');
}

// ─── Histograma: pagado por año, apilado por servicio ────────────────────────
function mopRenderHistoricaAnual(H, anios, porAnioServicio, porServicio, porAnio, moneda) {
    const orden = Object.keys(porServicio).map(Number).sort((a, b) => porServicio[b] - porServicio[a]);
    const top = orden.slice(0, MOP_HIST_TOP_SERVICIOS);
    const otros = orden.slice(MOP_HIST_TOP_SERVICIOS);
    let extra = 0;
    const series = top.map(s => ({
        label: mopHistServicioCorto(H.servicios[s]),
        ids: [s],
        color: MOP_SERVICIO_COLORS[H.servicios[s]] || MOP_SERVICIO_EXTRA_COLORS[extra++ % MOP_SERVICIO_EXTRA_COLORS.length],
    }));
    if (otros.length) series.push({ label: 'Otros', ids: otros, color: MOP_OTROS_COLOR });

    // Micro-leyenda de cabecera (estándar catlec-bar-chart)
    const legend = document.getElementById('mop-hi-anual-legend');
    if (legend) {
        legend.innerHTML = series.map(s => `<span class="mop-legend-item" style="--legend-color: ${s.color}"><span class="mop-legend-dot"></span>${mopEscapeHtml(s.label)}</span>`).join('');
    }

    // Los años en 0 van en null: así el tooltip no los lista
    const datasets = series.map(s => mopBar(s.label, anios.map(a => {
        const v = s.ids.reduce((sum, id) => sum + (porAnioServicio[`${a}|${id}`] || 0), 0);
        return v ? mopToMMM(v) : null;
    }), s.color, { borderRadius: 2, maxBarThickness: 22 }));

    const options = mopCtBarOptions({
        stacked: true,
        title: (items) => (items.length ? `Año ${items[0].label}` : ''),
        label: (ctx) => ` ${ctx.dataset.label}: ${mopFmtMMM(ctx.raw)}`,
        afterBody: (items) => (items.length ? [`Total: ${mopFmtMMM(mopToMMM(porAnio[items[0].label] || 0))} de ${moneda}`] : []),
    });
    // 40 años: el eje salta etiquetas para que no se encimen
    options.scales.x.ticks = { ...options.scales.x.ticks, autoSkip: true, maxRotation: 0 };
    options.plugins.tooltip.itemSort = (a, b) => b.raw - a.raw;
    mopCtChart('chart-mop-hi-anual', 'bar', { labels: anios, datasets }, options);
}

// ─── Acumulado por región (de norte a sur, Interregional al final) ───────────
// Con el filtro de región, las regiones elegidas en azul y las demás en gris
function mopRenderHistoricaRegiones(H, porRegion, allowedR, desde, hasta) {
    const rows = H.regiones.map((r, i) => ({ label: mopRegionCorta(r), full: r, monto: porRegion[i] || 0, activa: !allowedR || allowedR.has(i) }))
        .filter(r => r.monto > 0);
    const total = rows.reduce((s, r) => s + r.monto, 0);
    mopSetText('mop-hi-region-badge', `${desde}–${hasta}`);
    mopCtChart('chart-mop-hi-region', 'bar', {
        labels: rows.map(r => r.label),
        datasets: [mopBar('Pagado', rows.map(r => mopToMMM(r.monto)), rows.map(r => (r.activa ? 'rgba(12, 113, 195, 0.8)' : '#cbd5e1')),
            { borderColor: rows.map(r => (r.activa ? MOP_CT_COLORS.barra : '#cbd5e1')) })],
    }, mopCtBarOptions({
        horizontal: true,
        title: (items) => (items.length ? rows[items[0].dataIndex].full : ''),
        label: (ctx) => ` Pagado: ${mopFmtMMM(ctx.raw)} (${mopPct(rows[ctx.dataIndex].monto, total)})`,
        dataLabels: mopFmtEtiquetaMMM,
        // Texto oscuro dentro de las barras grises
        insideColor: (v, d, i) => (rows[i] && !rows[i].activa ? '#334155' : '#ffffff'),
        afterBody: (items) => {
            if (!items.length) return [];
            const r = rows[items[0].dataIndex].full;
            if (r === 'Biobío' || r === 'Ñuble') return ['Ñuble es región desde 2018; antes, sus proyectos van en Biobío'];
            if (r === 'Interregional') return ['Proyectos de más de una región o no regionalizables'];
            return [];
        },
    }));
}

// ─── Mayores obras del período (sin programas ni conservaciones) ─────────────
function mopRenderHistoricaObras(H, allowedS, allowedR, desde, hasta) {
    const porObra = {};
    H.obra_montos.forEach(([o, s, r, m]) => {
        if (mopHistPasa(allowedS, allowedR, s, r)) porObra[o] = (porObra[o] || 0) + m;
    });
    const top = Object.entries(porObra).sort((a, b) => b[1] - a[1]).slice(0, MOP_HIST_TOP_OBRAS)
        .map(([o, monto]) => ({ ...H.obras[o], monto }));
    mopCtChart('chart-mop-hi-obras', 'bar', {
        labels: top.map(o => mopCorto(o.nombre, 34)),
        datasets: [mopBar('Pagado', top.map(o => mopToMMM(o.monto)), 'rgba(30, 79, 101, 0.85)', { borderColor: '#1e4f65' })],
    }, mopCtBarOptions({
        horizontal: true,
        title: (items) => (items.length ? top[items[0].dataIndex].nombre : ''),
        label: (ctx) => ` Pagado: ${mopFmtMMM(ctx.raw)}`,
        dataLabels: mopFmtEtiquetaMMM,
        afterBody: (items) => {
            if (!items.length) return [];
            const o = top[items[0].dataIndex];
            return [`BIP ${o.bip} · pagos ${o.a0 === o.a1 ? o.a0 : `${o.a0}–${o.a1}`}`,
                    o.actual ? 'Sigue en la tabla de proyectos' : 'Ya no está en la cartera actual'];
        },
    }));
}
