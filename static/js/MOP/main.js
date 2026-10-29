// ─── static/js/MOP/main.js ────────────────────────────────────────────────────
// Visualización "Tabla de proyectos" del módulo MOP: búsqueda, filtros y
// análisis (donuts por servicio y etapa) en el panel izquierdo, mapa MapLibre
// (project-map.js) y tabla de proyectos.
//
// Datos: window.MOP_DATA (static/data/mop_data.js), generado por
// scripts/export_static_data.py desde el Excel más reciente de "Iniciativas
// programadas y en ejecución" de la Dirección de Planeamiento. Un proyecto por
// código BIP: { bip, nombre, servicio, etapa, region, item, inversion }; `etapa` puede reunir
// varias ("Diseño - Ejecución") e `item` es "Proyectos" o "Estudios básicos". MOP_DATA.filters trae las opciones de los
// filtros y MOP_DATA.source el mes y año de cierre.
//
// Inversión: `inversion` es la estimación en M$ (miles de pesos) del año
// MOP_DATA.summary.inversion_year, suma por etapa de la sección 16 de las fichas
// IDI de BIP Consulta; null si el BIP no tiene ficha.
//
// Orden: los encabezados .sortable ordenan la tabla (estilos de styles.css,
// mismo patrón que DGC y Metro); un segundo clic invierte el sentido.
//
// Selección: un clic en una fila o en un trazado/ícono del mapa selecciona el
// proyecto (fila marcada, vuelo del mapa si tiene georreferenciación y su ficha
// en lugar de la tabla, ficha.js); "Volver a la Lista" o un clic en el fondo
// del mapa la quita.

const MOP_TABLE_PAGE_SIZE = 25;
// Ancho mínimo de la tabla (separador): código BIP, servicio, etapa, región e
// inversión con ancho fijo, y el nombre en el resto (los largos ocupan 2-3 líneas).
const MOP_TABLE_MIN_WIDTH = 769;
const MOP_ETAPA_SEPARATOR = ' - ';

// ─── Colores de los gráficos de Análisis ─────────────────────────────────────
// Paleta institucional inspirada en mop.gob.cl: un color fijo por servicio y una
// escala del celeste al azul marino para las etapas (orden de madurez).
const MOP_SERVICIO_COLORS = {
    'Dirección de Vialidad': '#0c71c3',
    'Subdirección de Servicios Sanitarios Rurales': '#2ea3f2',
    'Dirección de Obras Hidráulicas': '#1e4f65',
    'Dirección de Obras Portuarias': '#2d717c',
    'Dirección de Aeropuertos': '#de702c',
    'Dirección de Arquitectura': '#a51f15',
};
const MOP_OTROS_COLOR = '#6b7280';
// Servicios sin color fijo que entran al top con algunos filtros (ej. DGA en Biobío)
const MOP_SERVICIO_EXTRA_COLORS = ['#001c41', '#9fd1f6', '#7c5e9e'];
const MOP_SERVICIO_LABELS = {
    'Subdirección de Servicios Sanitarios Rurales': 'SSR',
    'Dirección General de Aguas': 'DGA',
};
const MOP_SERVICIO_TOP = 6;   // el resto se agrupa en "Otros"
const MOP_ETAPA_COLORS = {
    'Perfil': '#9fd1f6',
    'Prefactibilidad': '#2ea3f2',
    'Factibilidad': '#0c71c3',
    'Diseño': '#1e4f65',
    'Ejecución': '#001c41',
};
const MOP_VARIAS_ETAPAS = 'Varias etapas';
const MOP_CHART_ANIMATION = { duration: 450, easing: 'easeOutQuart' };
const mopTooltip = CatlecTooltip.create({ domId: 'mop-shared-tooltip' });

let mopTablePage = 1;
let mopSelectedBip = null;
let mopFilteredProjects = [];
const mopFilters = { servicios: [], regions: [], etapas: [], items: [] };
const mopCharts = {};
// Orden de la tabla: por defecto inversión de mayor a menor (como DGC, que parte
// con una columna en orden descendente); los proyectos sin monto van al final
const MOP_DEFAULT_SORT = { by: 'inversion', order: 'desc' };
const mopSort = { ...MOP_DEFAULT_SORT };
// Columnas que parten de mayor a menor en el primer clic
const MOP_SORT_DESC_FIRST = ['inversion'];
let mopProjectIndex = null;   // bip → posición en MOP_DATA.projects

function mopEscapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function mopFmt(n) {
    return Number(n || 0).toLocaleString('es-CL');
}

// Inversión en M$ → millones de pesos para la tabla ("1.410.030"; bajo 1 MM$, con
// decimales para no mostrar 0: "0,305", o "0,001" en las fichas con monto simbólico)
function mopFmtInversionMM(milesPesos) {
    const mm = milesPesos / 1000;
    return mm.toLocaleString('es-CL', { maximumFractionDigits: mm < 1 ? 3 : 0 });
}

// Inversión en M$ → cifra compacta en pesos para el KPI ("$29,7 billones")
function mopFmtInversionCompact(milesPesos) {
    const pesos = Number(milesPesos || 0) * 1000;
    const fmt = (v) => v.toLocaleString('es-CL', { maximumFractionDigits: 1 });
    if (pesos >= 1e12) return `$${fmt(pesos / 1e12)} billones`;
    if (pesos >= 1e9) return `$${fmt(pesos / 1e9)} mil millones`;
    return `$${fmt(pesos / 1e6)} millones`;
}

// "Dirección de Vialidad" → "Vialidad" (el nombre completo va en el title de la celda)
function mopShortServicio(servicio) {
    return String(servicio || '').replace(/^(Subdirección|Dirección) de /, '');
}

// ─── Selección (tabla ↔ mapa) ────────────────────────────────────────────────
// Desde el mapa, la tabla salta a la página del proyecto y desplaza la fila a la vista.
function mopSelectProject(bip, { fromMap = false, fly = true } = {}) {
    bip = bip || null;
    mopSelectedBip = bip;
    if (bip && fromMap) {
        const idx = mopFilteredProjects.findIndex(p => p.bip === bip);
        if (idx >= 0) mopTablePage = Math.floor(idx / MOP_TABLE_PAGE_SIZE) + 1;
    }
    mopRenderTable();
    mopMapSelectProject(bip, { fly });
    if (bip) mopShowProjectDetail(bip);
    else mopHideProjectDetail();
    if (bip && fromMap) {
        const row = document.querySelector(`#mop-projects-tbody tr[data-bip="${CSS.escape(bip)}"]`);
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function mopSetupTableEvents() {
    const tbody = document.getElementById('mop-projects-tbody');
    if (!tbody) return;
    tbody.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-bip]');
        if (!row) return;
        mopSelectProject(row.dataset.bip === mopSelectedBip ? null : row.dataset.bip);
    });
    tbody.addEventListener('mouseover', (e) => {
        const row = e.target.closest('tr[data-bip]');
        if (row) mopMapSetHover(row.dataset.bip);
    });
    tbody.addEventListener('mouseleave', () => mopMapSetHover(null));
}

// ─── Filtros ─────────────────────────────────────────────────────────────────
function mopSetupFilters() {
    const filters = (window.MOP_DATA && window.MOP_DATA.filters) || {};
    const servicios = (filters.servicios || []).slice()
        .sort((a, b) => mopShortServicio(a).localeCompare(mopShortServicio(b), 'es'));

    CatlecUtils.setupMultiselect('mop-servicio', servicios, 'Todos los servicios', 'servicios seleccionados', (selected) => {
        mopFilters.servicios = selected;
        mopApplyFilters();
    }, { renderOptionLabel: mopShortServicio, formatSingleLabel: mopShortServicio });

    CatlecUtils.setupMultiselect('mop-region', filters.regions || [], 'Todas las regiones', 'regiones seleccionadas', (selected) => {
        mopFilters.regions = selected;
        mopApplyFilters();
    });

    CatlecUtils.setupMultiselect('mop-etapa', filters.etapas || [], 'Todas las etapas', 'etapas seleccionadas', (selected) => {
        mopFilters.etapas = selected;
        mopApplyFilters();
    });

    CatlecUtils.setupMultiselect('mop-item', filters.items || [], 'Todos los ítems', 'ítems seleccionados', (selected) => {
        mopFilters.items = selected;
        mopApplyFilters();
    });

    const searchInput = document.getElementById('mop-search-input');
    if (searchInput) searchInput.addEventListener('input', CatlecUtils.debounce(mopApplyFilters, 300));
    document.addEventListener('click', CatlecUtils.closeAllMultiselects);
    document.getElementById('mop-btn-reset').addEventListener('click', mopResetFilters);
}

// Marca el filtro "Región" con una sola región (o lo limpia con null), como si
// se eligiera en el desplegable: lo usa el clic en una región del mapa.
function mopSetRegionFilter(region) {
    const boxes = [...document.querySelectorAll('.mop-region-checkbox')];
    if (!boxes.length) return;
    boxes.forEach(cb => { cb.checked = !!region && cb.value === region; });
    const target = boxes.find(cb => cb.checked) || boxes[0];
    target.dispatchEvent(new Event('change', { bubbles: true }));
}

function mopApplyFilters() {
    const projects = (window.MOP_DATA && window.MOP_DATA.projects) || [];
    const matchSearch = CatlecUtils.createSearchMatcher(document.getElementById('mop-search-input').value);
    const { servicios, regions, etapas, items } = mopFilters;

    // Todos los filtros salvo el de región: el coroplético del mapa cuenta por
    // región con esta lista (con una región filtrada, las demás no quedan en 0)
    const withoutRegion = projects.filter(p => {
        if (servicios.length && !servicios.includes(p.servicio)) return false;
        // Un proyecto con varias etapas cumple si alguna de ellas está seleccionada
        if (etapas.length && !String(p.etapa || '').split(MOP_ETAPA_SEPARATOR).some(e => etapas.includes(e))) return false;
        if (items.length && !items.includes(p.item)) return false;
        return matchSearch(p.nombre, p.bip);
    });
    mopFilteredProjects = regions.length ? withoutRegion.filter(p => regions.includes(p.region)) : withoutRegion;

    mopSortProjects();
    mopTablePage = 1;
    // Con exactamente una región en el filtro, el mapa muestra esa región
    const regionChanged = mopMapSetRegionFromFilter(mopFilters.regions);
    if (mopSelectedBip && !mopFilteredProjects.some(p => p.bip === mopSelectedBip)) {
        mopSelectedBip = null;
        mopMapSelectProject(null, { fly: !regionChanged });
        mopHideProjectDetail();
    }
    if (mopSelectedBip) mopUpdateDetailNav(mopSelectedBip);
    mopRenderKpis();
    mopRenderTable();
    mopRenderAnalysis();
    mopMapApplyFilters(mopFilteredProjects, withoutRegion);
    if (regionChanged && mopMapReady && !(mopSelectedBip && mopProjectHasGeo(mopSelectedBip))) {
        mopFlyToRegion(mopMapState.region);
    }
    // Vistas de contratos (contratos.js): se redibujan con los proyectos filtrados
    if (typeof mopContratosOnFilter === 'function') mopContratosOnFilter();
}

function mopResetFilters() {
    document.getElementById('mop-search-input').value = '';
    [['mop-servicio', 'Todos los servicios'], ['mop-region', 'Todas las regiones'], ['mop-etapa', 'Todas las etapas'], ['mop-item', 'Todos los ítems']]
        .forEach(([prefix, label]) => {
            document.querySelectorAll(`.${prefix}-checkbox, #${prefix}-check-all`).forEach(cb => { cb.checked = false; });
            document.getElementById(`${prefix}-multiselect-text`).textContent = label;
        });
    mopFilters.servicios = [];
    mopFilters.regions = [];
    mopFilters.etapas = [];
    mopFilters.items = [];
    Object.assign(mopSort, MOP_DEFAULT_SORT);
    mopUpdateSortHeaders();
    CatlecUtils.closeAllMultiselects();
    mopApplyFilters();
}

// ─── Orden de la tabla ───────────────────────────────────────────────────────
// Textos en orden alfabético (servicio por su nombre corto, como se muestra),
// etapa en orden de madurez (la primera de las que tenga), BIP numérico e
// inversión por monto; los proyectos sin inversión van siempre al final.
// Los empates conservan el orden por nombre de MOP_DATA.projects.
function mopSortValue(p, by) {
    if (by === 'servicio') return mopShortServicio(p.servicio);
    if (by === 'etapa') {
        const order = Object.keys(MOP_ETAPA_COLORS);
        const first = String(p.etapa || '').split(MOP_ETAPA_SEPARATOR)[0];
        const idx = order.indexOf(first);
        return (idx < 0 ? order.length : idx) + String(p.etapa || '').split(MOP_ETAPA_SEPARATOR).length / 10;
    }
    if (by === 'bip') return parseInt(p.bip, 10) || 0;
    return p[by];
}

function mopSortProjects() {
    if (!mopProjectIndex) {
        mopProjectIndex = new Map(((window.MOP_DATA && window.MOP_DATA.projects) || []).map((p, i) => [p.bip, i]));
    }
    const { by, order } = mopSort;
    const dir = order === 'desc' ? -1 : 1;
    const byIndex = (a, b) => mopProjectIndex.get(a.bip) - mopProjectIndex.get(b.bip);
    mopFilteredProjects.sort((a, b) => {
        if (by === 'nombre') return dir * byIndex(a, b);
        const va = mopSortValue(a, by);
        const vb = mopSortValue(b, by);
        const emptyA = va == null || va === '';
        const emptyB = vb == null || vb === '';
        if (emptyA || emptyB) return emptyA === emptyB ? byIndex(a, b) : (emptyA ? 1 : -1);
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' });
        return cmp ? dir * cmp : byIndex(a, b);
    });
}

function mopUpdateSortHeaders() {
    document.querySelectorAll('.mop-data-table th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.sort === mopSort.by) th.classList.add(mopSort.order);
    });
}

function mopSetupTableSorting() {
    document.querySelectorAll('.mop-data-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const by = th.dataset.sort;
            if (mopSort.by === by) {
                mopSort.order = mopSort.order === 'asc' ? 'desc' : 'asc';
            } else {
                mopSort.by = by;
                mopSort.order = MOP_SORT_DESC_FIRST.includes(by) ? 'desc' : 'asc';
            }
            mopUpdateSortHeaders();
            mopSortProjects();
            mopTablePage = 1;
            mopRenderTable();
            if (mopSelectedBip) mopUpdateDetailNav(mopSelectedBip);
        });
    });
}

// ─── Tabla ───────────────────────────────────────────────────────────────────
function mopRenderTable() {
    const projects = mopFilteredProjects;
    const tbody = document.getElementById('mop-projects-tbody');
    const pageInfo = document.getElementById('mop-pagination-info');
    const prevBtn = document.getElementById('mop-btn-prev');
    const nextBtn = document.getElementById('mop-btn-next');
    const emptyState = document.getElementById('mop-empty-state');
    if (!tbody) return;

    const total = projects.length;
    const totalPages = Math.max(1, Math.ceil(total / MOP_TABLE_PAGE_SIZE));
    mopTablePage = Math.min(Math.max(mopTablePage, 1), totalPages);
    const start = (mopTablePage - 1) * MOP_TABLE_PAGE_SIZE;
    const page = projects.slice(start, start + MOP_TABLE_PAGE_SIZE);

    if (pageInfo) {
        pageInfo.textContent = total
            ? `${mopFmt(start + 1)}-${mopFmt(start + page.length)} de ${mopFmt(total)}`
            : '0-0 de 0';
    }
    if (prevBtn) prevBtn.disabled = mopTablePage <= 1;
    if (nextBtn) nextBtn.disabled = mopTablePage >= totalPages;
    if (emptyState) emptyState.style.display = total ? 'none' : 'flex';

    tbody.innerHTML = page.map(p => `
        <tr class="row-main${p.bip === mopSelectedBip ? ' row-selected' : ''}" data-bip="${mopEscapeHtml(p.bip)}"${mopProjectHasGeo(p.bip) ? '' : ' title="Sin ubicación en el mapa"'}>
            <td><span class="mop-cell-code">${mopEscapeHtml(p.bip)}</span></td>
            <td><strong>${mopEscapeHtml(p.nombre) || 'Sin nombre'}</strong></td>
            <td title="${mopEscapeHtml(p.servicio)}">${mopCellText(mopShortServicio(p.servicio))}</td>
            <td>${mopCellText(p.etapa)}</td>
            <td>${mopCellText(p.region)}</td>
            <td>${p.inversion != null
                ? `<span class="mop-cell-code">${mopFmtInversionMM(p.inversion)}</span>`
                : '<span class="mop-cell-empty" title="Sin ficha IDI en BIP Consulta">—</span>'}</td>
        </tr>
    `).join('');
}

// Texto secundario de una celda (estilo de la etapa en la tabla de Metro)
function mopCellText(value) {
    return value
        ? `<span class="mop-cell-text">${mopEscapeHtml(value)}</span>`
        : '<span class="mop-cell-empty">—</span>';
}

// ─── KPI sobre la tabla (según los filtros activos) ──────────────────────────
// "En ejecución": proyectos cuya etapa incluye Ejecución (también "Diseño - Ejecución")
function mopRenderKpis() {
    const D = window.MOP_DATA;
    if (!D) return;
    const shown = mopFilteredProjects.length;
    const total = D.summary.total_projects;
    const enEjecucion = mopFilteredProjects
        .filter(p => String(p.etapa || '').split(MOP_ETAPA_SEPARATOR).includes('Ejecución')).length;
    const period = D.source && D.source.label ? D.source.label : '';

    document.getElementById('kpi-val-projects').textContent = mopFmt(shown);
    document.getElementById('kpi-sub-projects').textContent = shown === total
        ? `Al cierre de ${period}`
        : `de ${mopFmt(total)} · al cierre de ${period}`;
    document.getElementById('kpi-val-ejecucion').textContent = mopFmt(enEjecucion);
    document.getElementById('kpi-sub-ejecucion').textContent = shown
        ? `${(enEjecucion / shown * 100).toFixed(1).replace('.', ',')}% de los proyectos`
        : 'Sin proyectos para los filtros';

    // Costo Total: suma del costo de etapa de los proyectos filtrados que tienen ficha IDI
    const conInversion = mopFilteredProjects.filter(p => p.inversion != null);
    const inversion = conInversion.reduce((s, p) => s + p.inversion, 0);
    const sinFicha = shown - conInversion.length;
    document.getElementById('kpi-val-inversion').textContent = conInversion.length ? mopFmtInversionCompact(inversion) : '—';
    document.getElementById('kpi-sub-inversion').textContent = !shown
        ? 'Sin proyectos para los filtros'
        : `Pesos ${D.summary.inversion_year}${sinFicha ? ` · ${mopFmt(sinFicha)} sin ficha IDI` : ''}`;
}

// ─── Análisis: donuts de proyectos por servicio y por etapa ──────────────────
// Cuenta proyectos de los filtrados con la llave que devuelve keyFn
function mopCountBy(keyFn) {
    const counts = {};
    mopFilteredProjects.forEach(p => {
        const key = keyFn(p);
        if (key) counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
}

function mopServicioItems() {
    const sorted = Object.entries(mopCountBy(p => p.servicio)).sort((a, b) => b[1] - a[1]);
    let extra = 0;
    const items = sorted.slice(0, MOP_SERVICIO_TOP).map(([servicio, count]) => ({
        label: MOP_SERVICIO_LABELS[servicio] || mopShortServicio(servicio),
        full: servicio,
        count,
        color: MOP_SERVICIO_COLORS[servicio] || MOP_SERVICIO_EXTRA_COLORS[extra++ % MOP_SERVICIO_EXTRA_COLORS.length],
    }));
    const otros = sorted.slice(MOP_SERVICIO_TOP).reduce((s, [, c]) => s + c, 0);
    if (otros) items.push({ label: 'Otros', full: 'Otros servicios', count: otros, color: MOP_OTROS_COLOR });
    return items;
}

// Los proyectos con contratos en más de una etapa van juntos en "Varias etapas"
// para no contarlos dos veces.
function mopEtapaItems() {
    const counts = mopCountBy(p => (String(p.etapa || '').includes(MOP_ETAPA_SEPARATOR) ? MOP_VARIAS_ETAPAS : p.etapa));
    const order = Object.keys(MOP_ETAPA_COLORS).concat(MOP_VARIAS_ETAPAS);
    return Object.keys(counts)
        .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
        .map(etapa => ({ label: etapa, full: etapa, count: counts[etapa], color: MOP_ETAPA_COLORS[etapa] || MOP_OTROS_COLOR }));
}

// Donut estándar CATLEC (catlec-pie-chart): se crea una vez y luego se actualiza en el lugar.
// `fmt` da el texto del valor en el tooltip (por defecto, cantidad de proyectos).
function mopRenderDonut(key, items, { fmt = (v) => `${mopFmt(v)} proyectos`, empty = 'Sin proyectos para los filtros' } = {}) {
    const canvas = document.getElementById(`chart-mop-${key}`);
    const legendEl = document.getElementById(`mop${key.charAt(0).toUpperCase()}${key.slice(1)}ChartLegend`);
    if (!canvas) return;

    const labels = items.map(d => d.label);
    const values = items.map(d => d.count);
    const colors = items.map(d => d.color);
    const total = values.reduce((s, v) => s + v, 0);
    const pct = (v) => (total ? ((v / total) * 100).toFixed(1).replace(/\.0$/, '') : '0');
    const tooltipLabel = (ctx) => ` ${fmt(ctx.raw)} (${pct(ctx.raw)}%)`;

    const chart = mopCharts[key];
    if (!chart) {
        mopCharts[key] = new Chart(canvas, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#ffffff', borderWidth: 1.5, hoverOffset: 4 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                animation: MOP_CHART_ANIMATION,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false, external: mopTooltip, callbacks: { label: tooltipLabel } },
                },
            },
        });
    } else {
        chart.data.labels = labels;
        chart.data.datasets[0].data = values;
        chart.data.datasets[0].backgroundColor = colors;
        chart.options.plugins.tooltip.callbacks.label = tooltipLabel;
        chart.update();
    }

    if (!legendEl) return;
    legendEl.innerHTML = items.length ? items.map(d => `
        <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.69rem; padding:0.1rem 0;" title="${mopEscapeHtml(d.full)}: ${mopEscapeHtml(fmt(d.count))} (${pct(d.count)}%)">
            <span style="width:7px; height:7px; border-radius:50%; background-color:${d.color}; flex-shrink:0;"></span>
            <span style="color:var(--text-primary); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">${mopEscapeHtml(d.label)}</span>
            <span style="font-weight:700; color:var(--text-secondary); font-variant-numeric:tabular-nums; flex-shrink:0;">${pct(d.count)}%</span>
        </div>
    `).join('') : `<span style="font-size:0.69rem; color:var(--text-muted);">${empty}</span>`;
}

function mopRenderAnalysis() {
    if (typeof Chart === 'undefined') return;
    mopRenderDonut('servicio', mopServicioItems());
    mopRenderDonut('etapa', mopEtapaItems());
}

// ─── Inicialización ──────────────────────────────────────────────────────────
// Título de la barra superior con el mes y año del Excel de iniciativas que se usa
function mopRenderNavbarTitle() {
    const el = document.getElementById('mop-navbar-title');
    const label = window.MOP_DATA && window.MOP_DATA.source && window.MOP_DATA.source.label;
    if (el && label) el.textContent = `Observatorio de infraestructura - Contratos en ejecución y planificados MOP (${label})`;
}

function mopInit() {
    if (!window.MOP_DATA) console.error('[MOP] window.MOP_DATA no cargado.');
    mopRenderNavbarTitle();

    CatlecPanelResizer.init({
        resizer: '#mop-panel-resizer',
        minWidth: MOP_TABLE_MIN_WIDTH,
        storageKey: 'catlec.mop.tableWidth',
        getMap: () => mopProjectMap
    });
    mopInitProjectMap();

    mopSetupFilters();
    mopSetupTableEvents();
    mopSetupTableSorting();
    mopSetupProjectDetail();
    mopApplyFilters();
    document.getElementById('mop-btn-prev').addEventListener('click', () => { mopTablePage--; mopRenderTable(); });
    document.getElementById('mop-btn-next').addEventListener('click', () => { mopTablePage++; mopRenderTable(); });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mopInit);
} else {
    mopInit();
}
