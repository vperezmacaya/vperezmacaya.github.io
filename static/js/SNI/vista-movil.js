// ─── static/js/SNI/vista-movil.js ───────────────────────────────────────────────
// SNI en pantallas chicas, como los demás módulos (common/movil.js y
// common/filter-drawer.js). SNI no tiene tabla ni ficha: solo filtros, KPI y
// gráficos, y su mapa es un coroplético D3.
//
// Tablet (769-1100 px): la barra lateral de filtros (.sni-sidebar) se
// despliega sobre el contenido con la pestaña de CatlecMovil.crearPanelLateral
// (no en Análisis Territorial, que la oculta también en escritorio); el
// contenido ocupa todo el ancho.
//
// Celular (≤ 768 px): una sola pantalla. La visualización ocupa todo el alto
// y lo demás se abre encima:
// - Barra "Filtros" bajo el menú ☰ (CatlecFilterDrawer) con la tarjeta de filtros.
// - "Resumen": la fila de KPI (la misma en todas las visualizaciones) y, en
//   Mapa Regional, el ranking por región con sus tres cifras (Región líder,
//   Menor valor, Promedio), que en escritorio va junto al mapa.
// Las vistas de gráficos van en una columna con scroll interno (sni_addons.css).
let sniMovil = null;          // CatlecMovil.init
let sniPanelLateral = null;   // CatlecMovil.crearPanelLateral
let sniFiltrosMovil = null;   // CatlecFilterDrawer.init

function sniVistaActiva() {
    return sniState.currentView || 'map';
}

// Filtros activos: uno por grupo; con 1 o 2 valores se nombran
function sniFilterSummary() {
    const labels = [];
    const grupo = (values, plural) => {
        if (!values || !values.length) return;
        labels.push(values.length <= 2 ? values.join(', ') : `${values.length} ${plural}`);
    };
    grupo(sniState.selectedYears, 'años');
    grupo(sniState.selectedRegions, 'regiones');
    grupo(sniState.selectedMinistries, 'ministerios');
    grupo(sniState.selectedSources, 'fuentes');
    return { count: labels.length, labels };
}

// La llaman updateSNIDashboard (filtros) y switchViewContainer (cambio de vista)
function sniActualizarMovil() {
    if (sniPanelLateral) sniPanelLateral.actualizar();
    if (sniFiltrosMovil) sniFiltrosMovil.update();
    if (sniMovil) sniMovil.actualizar();
}

function sniSetupVistaMovil() {
    if (sniMovil || typeof CatlecMovil === 'undefined') return;
    const layout = document.querySelector('.sni-layout');
    const sidebar = document.querySelector('.sni-sidebar');

    sniPanelLateral = CatlecMovil.crearPanelLateral({
        grid: layout,
        panel: sidebar,
        etiqueta: 'Filtros',
        contar: () => sniFilterSummary().count,
        visible: () => !layout.classList.contains('no-sidebar')
    });

    if (typeof CatlecFilterDrawer !== 'undefined') {
        sniFiltrosMovil = CatlecFilterDrawer.init({
            panel: '.sni-sidebar-card',
            after: '.view-subheader',
            media: CatlecMovil.MEDIA,
            title: 'Filtros de inversión',
            getSummary: sniFilterSummary,
            onReset: resetAllSNIFilters
        });
    }

    // El ranking del Mapa Regional (la tarjeta junto al mapa)
    const rankingCard = document.getElementById('map-metric-chart-title');
    sniMovil = CatlecMovil.init({
        prefijo: 'sni',
        vistaActiva: sniVistaActiva,
        lista: { nodos: [], visible: () => false },
        resumen: {
            // Los mismos KPI en todas las visualizaciones
            kpis: {
                map: document.querySelector('.sni-kpi-row'),
                territorial: document.querySelector('.sni-kpi-row'),
                ministries: document.querySelector('.sni-kpi-row'),
                temporal: document.querySelector('.sni-kpi-row')
            },
            extra: [rankingCard ? rankingCard.closest('.sni-card') : null],
            extraVisible: (vista) => vista === 'map'
        }
    });
    sniActualizarMovil();
}
