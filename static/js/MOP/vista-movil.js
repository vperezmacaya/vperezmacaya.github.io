// ─── static/js/MOP/vista-movil.js ───────────────────────────────────────────────
// MOP en pantallas chicas, como DGC (common/movil.js y common/filter-drawer.js).
//
// Tablet (769-1100 px): el mapa y la tabla (con los KPI) lado a lado; el panel
// izquierdo (filtros, búsqueda y "Análisis") se despliega sobre el mapa con la
// pestaña de CatlecMovil.crearPanelLateral (no en Inversión histórica, que
// tiene filtros propios y no usa ese panel).
//
// Celular (≤ 768 px): una sola pantalla. El mapa ocupa todo el alto y lo demás
// se abre encima:
// - Barra "Filtros" bajo el menú ☰ (CatlecFilterDrawer) con los filtros de la
//   cartera (se oculta en Inversión histórica).
// - "Lista 2.187": la tabla de proyectos (#mop-table-container-view). Tocar un
//   proyecto cierra la lista y abre su ficha sobre el mapa; al cerrarla se
//   vuelve a la lista.
// - "Resumen": los KPI de la visualización abierta, los mismos de escritorio
//   (los del Mapa, los de Contratos y contratistas y los de Inversión
//   histórica; Costo por región y servicio no tiene), y los donuts de
//   "Análisis" (salvo en Inversión histórica).
// Las vistas de costos, contratos e histórica van en una columna con scroll
// interno (mop_addons.css).
let mopMovil = null;          // CatlecMovil.init
let mopFicha = null;          // CatlecMovil.crearFicha
let mopPanelLateral = null;   // CatlecMovil.crearPanelLateral
let mopFiltrosMovil = null;   // CatlecFilterDrawer.init

function mopVistaActiva() {
    const v = typeof mopView !== 'undefined' ? mopView : 'resumen';
    return v === 'resumen' ? 'map' : v;
}

// Filtros activos de la cartera: uno por campo; con 1 o 2 valores se nombran
function mopFilterSummary() {
    const labels = [];
    const input = document.getElementById('mop-search-input');
    const search = input ? input.value.trim() : '';
    if (search) labels.push(`"${search}"`);
    const grupo = (values, plural, fmt = (v) => v) => {
        if (!values || !values.length) return;
        labels.push(values.length <= 2 ? values.map(fmt).join(', ') : `${values.length} ${plural}`);
    };
    grupo(mopFilters.servicios, 'servicios', mopShortServicio);
    grupo(mopFilters.regions, 'regiones');
    grupo(mopFilters.etapas, 'etapas');
    grupo(mopFilters.items, 'ítems');
    return { count: labels.length, labels };
}

// Margen del encuadre de un proyecto con la ficha abierta sobre el mapa
function mopFichaMovilPadding() {
    return mopFicha && mopFicha.abierta() ? mopFicha.padding() : null;
}

// La llaman mopApplyFilters (número de la lista, filtros activos) y mopSetView
function mopActualizarMovil() {
    document.body.classList.toggle('mop-vista-historica', mopVistaActiva() === 'historica');
    if (mopPanelLateral) mopPanelLateral.actualizar();
    if (mopFiltrosMovil) mopFiltrosMovil.update();
    if (mopMovil) mopMovil.actualizar();
}

function mopSetupVistaMovil() {
    if (mopMovil || typeof CatlecMovil === 'undefined') return;
    const grid = document.getElementById('mop-dashboard-grid');
    const lista = document.getElementById('mop-table-container-view');

    mopFicha = CatlecMovil.crearFicha({
        view: document.getElementById('mop-project-detail-view'),
        mapPanel: document.getElementById('mop-map-panel'),
        backBtn: document.getElementById('mop-btn-back-to-list'),
        // En celular la tabla (en "Lista") no se oculta; en pantalla ancha, la
        // ficha abierta la reemplaza (como deja swapView)
        alCambiarAncho: (enCelular, abierta) => {
            if (lista) lista.style.display = (enCelular || !abierta) ? '' : 'none';
        }
    });

    mopPanelLateral = CatlecMovil.crearPanelLateral({
        grid,
        panel: grid.querySelector(':scope > .left-panel'),
        etiqueta: 'Filtros y análisis',
        contar: () => mopFilterSummary().count,
        visible: () => mopVistaActiva() !== 'historica',
        mapa: () => mopProjectMap
    });

    if (typeof CatlecFilterDrawer !== 'undefined') {
        mopFiltrosMovil = CatlecFilterDrawer.init({
            panel: grid.querySelector('.panel-card-filters'),
            after: '.view-subheader',
            media: CatlecMovil.MEDIA,
            getSummary: mopFilterSummary,
            getResultLabel: () => {
                const n = mopFilteredProjects.length;
                return n === 1 ? 'Ver 1 proyecto' : `Ver ${n.toLocaleString('es-CL')} proyectos`;
            },
            onReset: mopResetFilters
        });
    }

    mopMovil = CatlecMovil.init({
        prefijo: 'mop',
        vistaActiva: mopVistaActiva,
        lista: {
            nodos: [lista],
            etiqueta: () => {
                const n = mopFilteredProjects.length;
                return { texto: 'Lista', n, titulo: `Proyectos (${n.toLocaleString('es-CL')})`, aria: `Ver la lista de ${n} proyectos` };
            }
        },
        resumen: {
            kpis: {
                map: document.querySelector('#mop-right-panel .mop-kpi-row'),
                contratos: document.querySelector('#mop-view-contratos .mop-kpi-row'),
                historica: document.querySelector('#mop-view-historica .mop-kpi-row')
            },
            extra: [grid.querySelector('.panel-card-analytics')],
            extraVisible: (vista) => vista !== 'historica'
        },
        ficha: mopFicha,
        mapa: () => mopProjectMap
    });
    mopActualizarMovil();
}
