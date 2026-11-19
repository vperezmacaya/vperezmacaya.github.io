// ─── static/js/Metro/vista-movil.js ─────────────────────────────────────────────
// Metro en celular (≤ 768 px, el corte del menú ☰ de visualizaciones): una sola
// pantalla con common/movil.js (CatlecMovil), como DGC y EFE. La visualización
// (el mapa, o la vista de pantalla completa) ocupa todo el alto y lo demás se
// abre encima:
// - Barra "Líneas Actuales | Proyectos | Comunas" bajo el menú ☰
//   (.metro-movil-modo, solo en la visualización Mapa): el mismo selector del
//   panel derecho, que cambia la tabla, los KPI y la etiqueta del botón de la lista.
// - "Líneas 7" / "Proyectos 5" / "Comunas 52": el panel con la tabla del modo
//   elegido y las descargas Excel / GeoJSON. Tocar un proyecto cierra la lista
//   y abre su ficha sobre el mapa (al cerrarla se vuelve a la lista); tocar una
//   línea o una comuna cierra la lista y la muestra en el mapa.
// - "Resumen": los KPI de la visualización abierta, los mismos de escritorio
//   (.kpi-grid en el Mapa, según el modo; la fila de KPI de Demanda y de
//   Estadísticas Comunales, que así no ocupan la pantalla).
// En tablet y escritorio no cambia nada (mapa y tabla lado a lado).
let metroMovil = null;  // CatlecMovil.init
let metroFicha = null;  // CatlecMovil.crearFicha

function metroVistaActiva() {
    if (metroState.demandaOpen) return 'demanda';
    if (metroState.comunasOpen) return 'comunas';
    if (metroState.timelineOpen) return 'timeline';
    return 'map';
}

// Margen del encuadre de un proyecto con la ficha abierta sobre el mapa
function metroFichaMovilPadding() {
    return metroFicha && metroFicha.abierta() ? metroFicha.padding() : null;
}

function metroSetupVistaMovil() {
    if (metroMovil || typeof CatlecMovil === 'undefined') return;
    // El botón "Volver" se guarda con su ícono para devolverlo en pantallas
    // anchas: que lucide ya lo haya convertido
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();

    metroFicha = CatlecMovil.crearFicha({
        view: document.getElementById('metro-project-detail-view'),
        mapPanel: document.querySelector('#metro-dashboard-grid > .center-panel'),
        backBtn: document.getElementById('metro-btn-detail-back')
    });

    const filaKpi = (sel) => {
        const card = document.querySelector(`${sel} .card-kpi`);
        return card ? card.parentElement : null;
    };
    const lineasView = document.getElementById('metro-lines-container-view');
    const comunasView = document.getElementById('metro-comunas-container-view');

    metroMovil = CatlecMovil.init({
        prefijo: 'metro',
        vistaActiva: metroVistaActiva,
        lista: {
            nodos: [
                document.querySelector('.metro-export-toolbar'),
                document.getElementById('metro-table-container-view'),
                lineasView,
                comunasView
            ],
            etiqueta: () => {
                const data = window.METRO_DATA || {};
                if (metroState.tableMode === 'lines') {
                    const n = Array.isArray(data.lines) ? data.lines.length : null;
                    return { texto: 'Líneas', n, titulo: n != null ? `Líneas en operación (${n})` : 'Líneas en operación', aria: 'Ver las líneas en operación' };
                }
                if (metroState.tableMode === 'comunas') {
                    const stats = window.METRO_COMUNAS_STATS || {};
                    const n = stats.total_comunas || null;
                    return { texto: 'Comunas', n, titulo: n != null ? `Comunas (${n})` : 'Comunas', aria: 'Ver las comunas' };
                }
                const n = Array.isArray(window.currentFilteredMetroProjects) ? window.currentFilteredMetroProjects.length
                    : (Array.isArray(data.data) ? data.data.length : null);
                return { texto: 'Proyectos', n, titulo: n != null ? `Proyectos (${n})` : 'Proyectos', aria: 'Ver los proyectos' };
            }
        },
        resumen: {
            kpis: {
                map: document.querySelector('#metro-dashboard-grid .right-panel .kpi-grid'),
                demanda: filaKpi('#metro-demanda-full-panel'),
                comunas: filaKpi('#metro-comunas-full-panel')
            }
        },
        ficha: metroFicha,
        mapa: () => metroMap
    });

    // Selector de modo: en celular, como barra bajo el menú ☰
    const modo = document.querySelector('.metro-table-mode-switch');
    const subheader = document.querySelector('.view-subheader');
    if (modo && subheader) {
        const barra = document.createElement('div');
        barra.className = 'metro-movil-modo';
        subheader.insertAdjacentElement('afterend', barra);
        const place = () => {
            if (metroMovil.enCelular()) CatlecMovil.mover(modo, barra);
            else CatlecMovil.devolver(modo);
        };
        if (metroMovil.mq.addEventListener) metroMovil.mq.addEventListener('change', place); else metroMovil.mq.addListener(place);
        place();
    }

    // Tocar una línea o una comuna en la lista: cerrarla para verla en el mapa
    // (los proyectos abren su ficha, que ya cierra la lista). En captura: las
    // filas detienen la propagación del clic.
    [lineasView, comunasView].forEach(view => {
        if (!view) return;
        view.addEventListener('click', (e) => {
            if (metroMovil.enCelular() && e.target.closest('tbody tr')) metroMovil.hojaLista.close();
        }, true);
    });

    // Cambio de visualización (los botones del subheader marcan la activa)
    new MutationObserver(() => metroMovil.actualizar())
        .observe(subheader || document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
}
