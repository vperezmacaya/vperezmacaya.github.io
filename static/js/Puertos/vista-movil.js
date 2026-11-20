// ─── static/js/Puertos/vista-movil.js ───────────────────────────────────────────
// Puertos en celular (≤ 768 px), como los demás módulos (common/movil.js):
// una sola pantalla. Puertos no tiene filtros, tabla ni ficha, así que solo
// hay botón "Resumen":
// - Resumen de Carga: el mapa de instalaciones a todo el alto; "Resumen" trae
//   sus KPI y los tres gráficos que en escritorio van junto al mapa.
// - Las demás visualizaciones van en una columna con scroll interno y sus KPI
//   pasan a "Resumen".
// En tablet (769-1100 px) no cambia nada: sin panel de filtros, cada vista
// conserva su armado de escritorio (puertos_addons.css ajusta los KPI).
let puertosMovil = null;   // CatlecMovil.init

// Clave de la visualización abierta; Resumen de Carga es 'map' para que
// CatlecMovil la trate como la vista del mapa (body.catlec-movil-en-mapa)
function puertosVistaActiva() {
    const btn = document.querySelector('.view-tab-btn.active');
    const vista = btn ? btn.id.replace('btn-view-', '') : 'resumen';
    return vista === 'resumen' ? 'map' : vista;
}

// La llama switchVisualization (ui.js) al cambiar de visualización
function puertosActualizarMovil() {
    if (puertosMovil) puertosMovil.actualizar();
}

function puertosSetupVistaMovil() {
    if (puertosMovil || typeof CatlecMovil === 'undefined') return;
    const fila = (vista) => document.querySelector(`#vis-container-${vista} > .puertos-kpi-row`);
    // Los tres gráficos de Resumen de Carga (todas las tarjetas salvo la del mapa)
    const graficosResumen = [...document.querySelectorAll('.puertos-layout-resumen > .puertos-chart-card:not(.puertos-map-card)')];

    puertosMovil = CatlecMovil.init({
        prefijo: 'puertos',
        vistaActiva: puertosVistaActiva,
        lista: { nodos: [], visible: () => false },
        resumen: {
            kpis: {
                map: fila('resumen'),
                contenedores: fila('contenedores'),
                tipologia: fila('tipologia'),
                terrestre: fila('terrestre')
            },
            extra: graficosResumen,
            extraVisible: (vista) => vista === 'map'
        },
        mapa: () => (typeof puertosMap !== 'undefined' ? puertosMap : null)
    });
}
