// ─── static/js/EFE/vista-movil.js ───────────────────────────────────────────────
// EFE en celular (≤ 768 px, el corte del menú ☰ de visualizaciones): una sola
// pantalla con common/movil.js (CatlecMovil), como DGC. La visualización (el
// mapa, o la vista de pantalla completa) ocupa todo el alto y lo demás se abre
// encima:
// - Barra "Servicios Actuales | Proyectos" bajo el menú ☰ (.efe-movil-modo,
//   solo en la visualización Mapa): el mismo selector del panel derecho, que
//   cambia la tabla, los KPI y la etiqueta del botón de la lista.
// - "Servicios 10" / "Proyectos 20": el panel con la tabla del modo elegido y
//   las descargas Excel / GeoJSON. Tocar un proyecto cierra la lista y abre su
//   ficha sobre el mapa (al cerrarla se vuelve a la lista); tocar un servicio
//   cierra la lista y lo muestra en el mapa.
// - "Resumen": los KPI de la visualización abierta, los mismos de escritorio
//   (.kpi-grid en el Mapa, según el modo; la fila de KPI de Demanda y
//   Operación, de Carga y del Portafolio, que así no ocupan la pantalla).
// En tablet y escritorio no cambia nada (mapa y tabla lado a lado).
let efeMovil = null;  // CatlecMovil.init
let efeFicha = null;  // CatlecMovil.crearFicha

function efeVistaActiva() {
    if (efeState.operacionOpen) return 'operacion';
    if (efeState.cargaOpen) return 'carga';
    if (efeState.timelineOpen || efeState.investmentOpen) return 'portafolio';
    return 'map';
}

// Margen del encuadre de un proyecto con la ficha abierta sobre el mapa
function efeFichaMovilPadding() {
    return efeFicha ? efeFicha.padding() : null;
}

function efeSetupVistaMovil() {
    if (efeMovil || typeof CatlecMovil === 'undefined') return;
    // El botón "Volver a la Lista" se guarda con su ícono para devolverlo en
    // pantallas anchas: que lucide ya lo haya convertido
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();

    const mapPanel = document.querySelector('#efe-dashboard-grid > .center-panel');
    efeFicha = CatlecMovil.crearFicha({
        view: efeProjectDetailView,
        mapPanel,
        backBtn: efeBtnBackToTable
    });

    const filaKpi = (sel) => {
        const card = document.querySelector(`${sel} .card-kpi`);
        return card ? card.parentElement : null;
    };
    const lineasView = document.getElementById('efe-lines-container-view');

    efeMovil = CatlecMovil.init({
        prefijo: 'efe',
        vistaActiva: efeVistaActiva,
        lista: {
            nodos: [
                document.querySelector('.efe-export-toolbar'),
                efeTableContainerView,
                lineasView
            ],
            etiqueta: () => {
                if (efeState.tableMode === 'lines') {
                    const n = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines.length : null;
                    return { texto: 'Servicios', n, titulo: n != null ? `Servicios en operación (${n})` : 'Servicios en operación', aria: 'Ver los servicios en operación' };
                }
                const n = Array.isArray(window.currentFilteredEFEProjects) ? window.currentFilteredEFEProjects.length : null;
                return { texto: 'Proyectos', n, titulo: n != null ? `Proyectos (${n})` : 'Proyectos', aria: 'Ver los proyectos' };
            }
        },
        resumen: {
            kpis: {
                map: document.querySelector('#efe-dashboard-grid .right-panel .kpi-grid'),
                operacion: filaKpi('#efe-operacion-full-panel'),
                carga: document.querySelector('#efe-carga-full-panel .efe-carga-kpis'),
                portafolio: document.querySelector('#efe-investment-full-panel .efe-portafolio-kpis')
            }
        },
        ficha: efeFicha,
        mapa: () => efeMap
    });

    // Selector "Servicios Actuales | Proyectos": en celular, como barra bajo el menú ☰
    const modo = document.querySelector('.efe-table-mode-switch');
    const subheader = document.querySelector('.view-subheader');
    if (modo && subheader) {
        const barra = document.createElement('div');
        barra.className = 'efe-movil-modo';
        subheader.insertAdjacentElement('afterend', barra);
        const place = () => {
            if (efeMovil.enCelular()) CatlecMovil.mover(modo, barra);
            else CatlecMovil.devolver(modo);
        };
        efeMovil.mq.addEventListener ? efeMovil.mq.addEventListener('change', place) : efeMovil.mq.addListener(place);
        place();
    }

    // Tocar un servicio en la lista: cerrarla para verlo en el mapa (los
    // proyectos abren su ficha, que ya cierra la lista). En captura: la fila
    // detiene la propagación del clic.
    if (lineasView) {
        lineasView.addEventListener('click', (e) => {
            if (efeMovil.enCelular() && e.target.closest('tbody tr')) efeMovil.hojaLista.close();
        }, true);
    }

    // Cambio de visualización (los botones del subheader marcan la activa)
    new MutationObserver(() => efeMovil.actualizar())
        .observe(subheader || document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
}
