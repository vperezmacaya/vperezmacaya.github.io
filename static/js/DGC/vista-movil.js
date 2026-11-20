// ─── static/js/DGC/vista-movil.js ───────────────────────────────────────────────
// DGC en pantallas chicas.
//
// Celular (≤ 768 px, el corte del menú ☰ de visualizaciones): una sola
// pantalla con common/movil.js (CatlecMovil). La visualización (el mapa, o la
// vista de pantalla completa) ocupa todo el alto y lo demás se abre encima:
// - "Lista 132": la tabla de concesiones (#table-container-view). Tocar una
//   fila cierra la lista y abre la ficha sobre el mapa (DGC/project-detail.js);
//   al cerrar la ficha se vuelve a la lista.
// - "Resumen": los KPI de la visualización abierta, los mismos de escritorio
//   (.kpi-grid en el Mapa; la fila de tarjetas de cada vista de pantalla
//   completa, que así no ocupa la pantalla), y los gráficos de "Análisis"
//   (.panel-card-analytics).
// Los filtros tienen su propio panel (CatlecFilterDrawer, DGC/ui.js).
//
// Tablet (769-1100 px): mapa y tabla lado a lado, con el panel izquierdo
// plegable (más abajo).
let dgcMovil = null; // CatlecMovil.init

function dgcEnVisualizacionMapa() {
    return dgcVistaActiva() === 'map';
}

// Visualización abierta: 'map' o la de pantalla completa
function dgcVistaActiva() {
    if (appState.timelineOpen) return 'timeline';
    if (appState.investmentOpen) return 'investment';
    if (appState.contractsOpen) return 'contracts';
    if (appState.biddersOpen) return 'bidders';
    if (appState.finanzasOpen) return 'finanzas';
    return 'map';
}

// Botones y paneles de celular y pestaña de tablet. La llaman fetchData (el
// número de "Lista" sigue a los filtros) y setActiveSubheaderTab (cambio de vista).
function dgcActualizarBotonVista() {
    dgcActualizarPanelTablet();
    if (dgcMovil) dgcMovil.actualizar();
}

// ─── Tablet (769-1100 px): panel izquierdo plegable ────────────────────────────
// El mapa y la tabla (con los KPI) se ven lado a lado; el panel izquierdo
// (filtros, búsqueda y "Análisis") se despliega sobre el mapa con la pestaña
// de CatlecMovil.crearPanelLateral, que muestra cuántos filtros hay activos.
let dgcPanelLateral = null;

function dgcActualizarPanelTablet() {
    if (dgcPanelLateral) dgcPanelLateral.actualizar();
}

function dgcSetupPanelTablet() {
    if (dgcPanelLateral || typeof CatlecMovil === 'undefined') return;
    dgcPanelLateral = CatlecMovil.crearPanelLateral({
        grid: document.querySelector('.dashboard-grid'),
        panel: document.querySelector('.dashboard-grid > .left-panel'),
        etiqueta: 'Filtros y análisis',
        contar: () => (typeof dgcFilterSummary === 'function' ? dgcFilterSummary().count : 0),
        mapa: () => leafletMap
    });
}

function dgcSetupVistaMovil() {
    dgcSetupPanelTablet();
    if (dgcMovil || typeof CatlecMovil === 'undefined') return;
    // KPI de cada visualización (los de escritorio): los del Mapa y la fila de
    // tarjetas de cada vista de pantalla completa
    const filaKpi = (id) => {
        const card = document.querySelector(`#${id} .card-kpi`);
        return card ? card.parentElement : null;
    };
    dgcMovil = CatlecMovil.init({
        prefijo: 'dgc',
        vistaActiva: dgcVistaActiva,
        lista: {
            nodos: [document.getElementById('table-container-view')],
            etiqueta: () => {
                const n = appState.filteredCount;
                return {
                    texto: 'Lista',
                    n,
                    titulo: n != null ? `Concesiones (${n.toLocaleString('es-CL')})` : 'Concesiones',
                    aria: n != null ? `Ver la lista de ${n} contratos` : 'Ver la lista'
                };
            }
        },
        resumen: {
            kpis: {
                map: document.querySelector('.right-panel .kpi-grid'),
                timeline: filaKpi('timeline-full-panel'),
                investment: filaKpi('investment-full-panel'),
                contracts: filaKpi('contracts-analysis-full-panel'),
                bidders: filaKpi('bidders-full-panel'),
                finanzas: document.querySelector('#finanzas-full-panel .dgc-fv-kpis')
            },
            extra: [document.querySelector('.panel-card-analytics')]
        },
        ficha: dgcFicha,
        mapa: () => leafletMap
    });
}
