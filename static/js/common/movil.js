// ─── static/js/common/movil.js ──────────────────────────────────────────────────
// Dashboards en celular como una sola pantalla (window.CatlecMovil). Requiere
// common/sheet.js (CatlecSheet). Lo usan DGC (DGC/vista-movil.js y
// DGC/project-detail.js) y EFE (EFE/vista-movil.js).
//
// En celular (por defecto ≤ 768 px, el corte del menú ☰ de visualizaciones)
// la visualización ocupa toda la pantalla y lo demás se abre encima:
// - crearFicha(): la ficha del proyecto se mueve dentro del mapa como un panel
//   que sube desde abajo y cubre ~72% de su alto (.catlec-ficha-movil), como
//   Google Maps; su botón "Volver a la Lista" pasa a "Cerrar" y Escape la
//   cierra. padding() da el margen para encuadrar el proyecto en la franja libre.
// - init(): dos botones flotantes abajo al centro (.catlec-movil-btns) abren
//   los paneles "Lista" (la tabla) y "Resumen" (los KPI de la visualización
//   abierta, los mismos de escritorio, y lo que el módulo agregue). Tocar una
//   fila de la lista la cierra y abre la ficha; al cerrar la ficha se vuelve a
//   la lista. Los botones se ocultan con la ficha abierta.
// Se mueven los mismos nodos (listeners, gráficos y KPI siguen funcionando) y
// vuelven a su lugar en pantallas anchas (mover / devolver). Estilos
// .catlec-ficha-movil, .catlec-movil-* y .catlec-kpi-oculto en styles.css.
window.CatlecMovil = (function () {
    const MEDIA = '(max-width: 768px)';
    const ICON_CERRAR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="icon-13" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> Cerrar';
    const ICON_LISTA = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
    const ICON_RESUMEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>';

    const onChange = (mq, fn) => { if (mq.addEventListener) mq.addEventListener('change', fn); else mq.addListener(fn); };

    // ─── Mover nodos y devolverlos a su lugar ───────────────────────────────
    const hogares = new Map(); // nodo → comentario que marca su lugar original
    function mover(node, destino) {
        if (!node || !destino || node.parentNode === destino) return;
        if (!hogares.has(node)) {
            const marca = document.createComment('catlec-movil');
            node.parentNode.insertBefore(marca, node);
            hogares.set(node, marca);
        }
        destino.appendChild(node);
    }
    function devolver(node) {
        const marca = hogares.get(node);
        if (marca && node.parentNode !== marca.parentNode) marca.parentNode.insertBefore(node, marca.nextSibling);
    }

    // ─── Ficha del proyecto sobre el mapa ───────────────────────────────────
    // opts: { view, mapPanel, backBtn, media, alCambiarAncho(enCelular, abierta) }
    // El módulo abre y cierra con abrir() / cerrar() desde sus funciones de
    // mostrar ficha / volver a la tabla, solo si enMapa().
    function crearFicha(opts) {
        const o = opts || {};
        const view = o.view;
        const mapPanel = o.mapPanel;
        if (!view || !mapPanel) return null;
        const mq = window.matchMedia(o.media || MEDIA);
        const hogar = document.createComment('catlec-ficha');
        view.parentNode.insertBefore(hogar, view);
        const backHtml = o.backBtn ? o.backBtn.innerHTML : '';
        let timer = null;

        const api = {
            enMapa: () => mq.matches && view.classList.contains('catlec-ficha-movil'),
            abierta: () => api.enMapa() && view.classList.contains('is-open'),
            // Margen para encuadrar el proyecto en la franja que la ficha deja libre
            padding: () => (api.enMapa() ? { top: 16, left: 28, right: 28, bottom: view.offsetHeight + 16 } : null),
            antesDeAbrir: null,     // los pone init()
            despuesDeCerrar: null,
            onCambio: null,
            abrir() {
                clearTimeout(timer);
                if (api.antesDeAbrir) api.antesDeAbrir();
                view.style.display = 'flex';
                void view.offsetWidth; // para que la transición parta desde abajo
                view.classList.add('is-open');
                if (api.onCambio) api.onCambio();
            },
            cerrar() {
                const estaba = view.classList.contains('is-open');
                view.classList.remove('is-open');
                clearTimeout(timer);
                timer = setTimeout(() => {
                    if (!view.classList.contains('is-open')) view.style.display = 'none';
                }, 300);
                if (estaba && api.despuesDeCerrar) api.despuesDeCerrar();
                if (api.onCambio) api.onCambio();
            }
        };

        const place = () => {
            const abierta = view.style.display === 'flex';
            clearTimeout(timer);
            if (mq.matches) {
                mapPanel.appendChild(view);
                view.classList.add('catlec-ficha-movil');
                view.classList.toggle('is-open', abierta);
                if (o.backBtn) o.backBtn.innerHTML = ICON_CERRAR;
            } else {
                hogar.parentNode.insertBefore(view, hogar.nextSibling);
                view.classList.remove('catlec-ficha-movil', 'is-open');
                if (o.backBtn) o.backBtn.innerHTML = backHtml;
            }
            if (typeof o.alCambiarAncho === 'function') o.alCambiarAncho(mq.matches, abierta);
        };
        onChange(mq, place);
        place();

        // Escape cierra la ficha (si no hay otro panel encima ni el visor de fotos)
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !api.abierta()) return;
            if (typeof CatlecSheet !== 'undefined' && CatlecSheet.anyOpen()) return;
            if (document.querySelector('.catlec-photo-lightbox.open')) return;
            if (o.backBtn) o.backBtn.click();
        });
        return api;
    }

    // ─── Pantalla única: Lista, Resumen y botones flotantes ─────────────────
    // opts: {
    //   prefijo,                      // ids: <prefijo>-hoja-lista / -hoja-resumen
    //   media,
    //   vistaActiva: () => 'map' | clave de otra visualización,
    //   lista: { nodos: [...], etiqueta: () => ({ texto, n, titulo, aria }), visible: (vista) => bool },
    //   resumen: { kpis: { clave: filaDeKpi }, extra: [...], extraVisible: (vista) => bool },  // extra: va bajo los KPI
    //   ficha,                        // de crearFicha (opcional)
    //   mapa: () => mapa MapLibre     // para resize() al cambiar de ancho
    // }
    function init(opts) {
        const o = opts || {};
        if (typeof CatlecSheet === 'undefined') return null;
        const mq = window.matchMedia(o.media || MEDIA);
        const p = o.prefijo || 'catlec';
        const lista = o.lista || { nodos: [] };
        const resumen = o.resumen || { kpis: {}, extra: [] };
        const filasKpi = () => Object.values(resumen.kpis || {}).filter(Boolean);

        const hojaLista = CatlecSheet.create({ id: `${p}-hoja-lista`, title: '', className: 'catlec-sheet--fill catlec-movil-lista' });
        const hojaResumen = CatlecSheet.create({ id: `${p}-hoja-resumen`, title: 'Resumen' });
        const kpisWrap = document.createElement('div');
        kpisWrap.className = 'catlec-movil-kpis';
        const extraWrap = document.createElement('div');
        extraWrap.className = 'catlec-movil-extra';
        hojaResumen.body.append(kpisWrap, extraWrap);

        const botones = document.createElement('div');
        botones.className = 'catlec-movil-btns';
        botones.hidden = true;
        botones.innerHTML = `
            <button type="button" class="catlec-movil-btn" data-hoja="lista" aria-haspopup="dialog" aria-controls="${p}-hoja-lista"></button>
            <button type="button" class="catlec-movil-btn" data-hoja="resumen" aria-haspopup="dialog" aria-controls="${p}-hoja-resumen">
                ${ICON_RESUMEN}<span>Resumen</span>
            </button>`;
        document.body.appendChild(botones);
        const btnLista = botones.querySelector('[data-hoja="lista"]');
        const btnResumen = botones.querySelector('[data-hoja="resumen"]');
        let desdeLista = false;
        btnLista.addEventListener('click', () => { desdeLista = false; hojaLista.open(); });
        btnResumen.addEventListener('click', () => hojaResumen.open());

        const ficha = o.ficha;
        if (ficha) {
            // Tocar una fila de la lista: se cierra y, al cerrar la ficha, vuelve
            ficha.antesDeAbrir = () => {
                if (!mq.matches) return;
                if (hojaLista.isOpen()) desdeLista = true;
                CatlecSheet.closeAll();
            };
            ficha.despuesDeCerrar = () => {
                const volver = desdeLista && mq.matches && !CatlecSheet.anyOpen();
                desdeLista = false;
                if (volver) hojaLista.open();
            };
            ficha.onCambio = () => actualizar();
        }

        function actualizar() {
            const vista = typeof o.vistaActiva === 'function' ? o.vistaActiva() : 'map';
            document.body.classList.toggle('catlec-movil-en-mapa', mq.matches && vista === 'map');
            if (mq.matches) {
                Object.entries(resumen.kpis || {}).forEach(([clave, fila]) => {
                    if (fila) fila.classList.toggle('catlec-kpi-oculto', clave !== vista);
                });
            }
            botones.hidden = !mq.matches || !!(ficha && ficha.abierta());
            btnLista.hidden = typeof lista.visible === 'function' ? !lista.visible(vista) : vista !== 'map';
            // Contenido extra (ej. "Análisis"): en todas las visualizaciones salvo
            // que extraVisible(vista) diga otra cosa. Sin KPI para esta
            // visualización ni contenido extra, "Resumen" quedaría vacío.
            const hayExtra = (resumen.extra || []).some(Boolean)
                && (typeof resumen.extraVisible !== 'function' || resumen.extraVisible(vista));
            extraWrap.hidden = !hayExtra;
            btnResumen.hidden = !hayExtra && !(resumen.kpis || {})[vista];
            if (btnResumen.hidden && hojaResumen.isOpen()) hojaResumen.close();

            const et = (typeof lista.etiqueta === 'function' && lista.etiqueta()) || { texto: 'Lista' };
            const n = et.n != null ? `<span class="catlec-movil-btn-count">${Number(et.n).toLocaleString('es-CL')}</span>` : '';
            btnLista.innerHTML = `${ICON_LISTA}<span>${et.texto || 'Lista'}</span>${n}`;
            btnLista.setAttribute('aria-label', et.aria || et.texto || 'Ver la lista');
            hojaLista.el.querySelector('.catlec-sheet-title').textContent = et.titulo || et.texto || 'Lista';
        }

        function place() {
            const nodos = (lista.nodos || []).filter(Boolean);
            const extra = (resumen.extra || []).filter(Boolean);
            if (mq.matches) {
                nodos.forEach(n => mover(n, hojaLista.body));
                filasKpi().forEach(f => mover(f, kpisWrap));
                extra.forEach(n => mover(n, extraWrap));
            } else {
                hojaLista.close();
                hojaResumen.close();
                desdeLista = false;
                [...nodos, ...filasKpi(), ...extra].forEach(devolver);
                filasKpi().forEach(f => f.classList.remove('catlec-kpi-oculto'));
            }
            // El mapa cambió de alto (se ocultan o vuelven el pie y los paneles)
            const mapa = typeof o.mapa === 'function' ? o.mapa() : null;
            if (mapa) mapa.resize();
            actualizar();
        }
        onChange(mq, place);
        place();

        return { actualizar, hojaLista, hojaResumen, mq, enCelular: () => mq.matches };
    }

    // ─── Tablet: panel izquierdo plegable ───────────────────────────────────
    // En tablet (769-1100 px) el mapa y la tabla van lado a lado y el panel
    // izquierdo (filtros, búsqueda, "Análisis") sale de la grilla: se despliega
    // sobre el mapa con una pestaña vertical en su borde izquierdo
    // (.catlec-panel-tab), que muestra cuántos filtros hay activos. La grilla
    // lleva .catlec-con-panel-lateral y, abierto, .catlec-panel-izq-abierto
    // (estilos en styles.css; la posición vertical de la pestaña se ajusta con
    // --catlec-panel-tab-top). Escape lo cierra.
    // opts: { grid, panel, etiqueta, contar: () => n, visible: () => bool, mapa: () => mapa, media }
    const MEDIA_TABLET = '(min-width: 769px) and (max-width: 1100px)';
    const ICON_FILTROS = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/></svg>';
    const ICON_CHEVRON = '<svg class="catlec-panel-tab-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

    function crearPanelLateral(opts) {
        const o = opts || {};
        const grid = o.grid;
        const panel = o.panel;
        if (!grid || !panel) return null;
        const mq = window.matchMedia(o.media || MEDIA_TABLET);
        const etiqueta = o.etiqueta || 'Filtros';
        if (!panel.id) panel.id = 'catlec-panel-izq';
        grid.classList.add('catlec-con-panel-lateral');
        // Clase propia: el panel puede ser .left-panel (DGC, MOP) u otro (.sni-sidebar)
        panel.classList.add('catlec-panel-lateral');

        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'catlec-panel-tab';
        tab.hidden = true;
        tab.setAttribute('aria-controls', panel.id);
        tab.setAttribute('aria-expanded', 'false');
        tab.innerHTML = `${ICON_FILTROS}<span class="catlec-panel-tab-label">${etiqueta}</span>`
            + `<span class="catlec-panel-tab-count" hidden></span>${ICON_CHEVRON}`;
        grid.appendChild(tab);
        const countEl = tab.querySelector('.catlec-panel-tab-count');

        const closeMultiselects = () => {
            if (typeof CatlecUtils !== 'undefined' && CatlecUtils.closeAllMultiselects) CatlecUtils.closeAllMultiselects();
        };
        const abierto = () => grid.classList.contains('catlec-panel-izq-abierto');
        const visible = () => mq.matches && (typeof o.visible !== 'function' || o.visible());

        function set(abrir) {
            const open = !!abrir && visible();
            if (!open) closeMultiselects();
            grid.classList.toggle('catlec-panel-izq-abierto', open);
            tab.setAttribute('aria-expanded', String(open));
            actualizar();
        }

        function actualizar() {
            tab.hidden = !visible();
            if (tab.hidden && abierto()) {
                grid.classList.remove('catlec-panel-izq-abierto');
                tab.setAttribute('aria-expanded', 'false');
            }
            const n = typeof o.contar === 'function' ? (o.contar() || 0) : 0;
            countEl.hidden = n === 0;
            countEl.textContent = String(n);
            const accion = abierto() ? 'Ocultar' : 'Mostrar';
            tab.setAttribute('aria-label', `${accion} ${etiqueta.toLowerCase()}${n ? ` (${n} filtros activos)` : ''}`);
            tab.title = `${accion} ${etiqueta.toLowerCase()}`;
        }

        tab.addEventListener('click', () => set(!abierto()));
        // Escape lo cierra (si hay un multiselect abierto, primero ese)
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !abierto()) return;
            if (panel.querySelector('.custom-multiselect.open')) {
                closeMultiselects();
                return;
            }
            set(false);
        });
        onChange(mq, () => {
            if (!mq.matches) set(false);
            const mapa = typeof o.mapa === 'function' ? o.mapa() : null;
            if (mapa) mapa.resize();
            actualizar();
        });
        actualizar();
        return { actualizar, abrir: () => set(true), cerrar: () => set(false), abierto };
    }

    return { MEDIA, MEDIA_TABLET, mover, devolver, crearFicha, crearPanelLateral, init };
})();
