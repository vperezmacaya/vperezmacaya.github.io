// ─── static/js/common/panel-resizer.js ──────────────────────────────────────
// Separador arrastrable mapa ↔ tabla (window.CatlecPanelResizer).
// Permite ensanchar o angostar la columna derecha (KPIs + tabla) arrastrando el
// separador .catlec-panel-resizer ubicado en el gap entre el mapa y la tabla.
// El ancho se escribe en la variable CSS --catlec-table-width de la grilla
// (cada módulo la usa en su grid-template-columns) y se recuerda por navegador
// en localStorage.
//
// Límites:
//   · mínimo: minWidth (por módulo), el ancho en que se ven todas las columnas.
//   · máximo: el borde izquierdo de la tabla no pasa del 40% del subheader
//     (en DGC es la separación entre "Líneas de Tiempo" y "Análisis de Inversión").
//
// Uso:
//   CatlecPanelResizer.init({
//       resizer: '#dgc-panel-resizer',       // separador (hermano previo del panel derecho)
//       minWidth: 500,
//       storageKey: 'catlec.dgc.tableWidth',
//       getMap: () => leafletMap             // mapa (MapLibre o Leaflet) a re-dimensionar (puede ser null al inicio)
//   });
(function () {
    const MAX_LEFT_RATIO = 0.4;
    const KEY_STEP = 24;

    function resolve(el) {
        return typeof el === 'string' ? document.querySelector(el) : el;
    }

    function init(options) {
        const opts = options || {};
        const resizer = resolve(opts.resizer);
        const grid = resolve(opts.grid) || (resizer && resizer.parentElement);
        const panel = resolve(opts.panel) || (resizer && resizer.nextElementSibling);
        if (!resizer || !grid || !panel) return null;

        const minWidth = opts.minWidth || 400;
        const storageKey = opts.storageKey || null;
        const getMap = typeof opts.getMap === 'function' ? opts.getMap : () => null;
        const subheader = document.querySelector('.view-subheader');

        grid.classList.add('catlec-resizable-grid');

        function readStored() {
            if (!storageKey) return null;
            try {
                const v = parseFloat(localStorage.getItem(storageKey));
                return Number.isFinite(v) ? v : null;
            } catch (e) { return null; }
        }

        function writeStored(width) {
            if (!storageKey) return;
            try {
                if (width == null) localStorage.removeItem(storageKey);
                else localStorage.setItem(storageKey, String(Math.round(width)));
            } catch (e) { /* almacenamiento no disponible */ }
        }

        function getMaxLeftEdge() {
            if (subheader) {
                const r = subheader.getBoundingClientRect();
                if (r.width > 0) return r.left + r.width * MAX_LEFT_RATIO;
            }
            return document.documentElement.clientWidth * MAX_LEFT_RATIO;
        }

        function getBounds() {
            const max = panel.getBoundingClientRect().right - getMaxLeftEdge();
            return { min: minWidth, max: Math.max(minWidth, max) };
        }

        function clamp(width) {
            const { min, max } = getBounds();
            return Math.min(max, Math.max(min, width));
        }

        function currentWidth() {
            return panel.getBoundingClientRect().width;
        }

        function updateAria() {
            const { min, max } = getBounds();
            resizer.setAttribute('aria-valuemin', String(Math.round(min)));
            resizer.setAttribute('aria-valuemax', String(Math.round(max)));
            resizer.setAttribute('aria-valuenow', String(Math.round(currentWidth())));
        }

        let mapFrame = null;
        function refreshMap() {
            if (mapFrame) return;
            mapFrame = requestAnimationFrame(() => {
                mapFrame = null;
                const map = getMap();
                if (map && typeof map.resize === 'function') {
                    // MapLibre borra el canvas al cambiar su tamaño y no redibuja
                    // hasta su próximo ciclo (limitado a 50 ms): redibujar en el
                    // mismo cuadro evita que el mapa parpadee durante el arrastre.
                    map.resize();
                    if (typeof map.redraw === 'function') map.redraw();
                } else if (map && typeof map.invalidateSize === 'function') {
                    // Leaflet
                    map.invalidateSize({ animate: false });
                }
            });
        }

        function applyWidth(width, persist) {
            const w = clamp(width);
            grid.style.setProperty('--catlec-table-width', Math.round(w) + 'px');
            if (persist) writeStored(w);
            updateAria();
            refreshMap();
        }

        function resetWidth() {
            grid.style.removeProperty('--catlec-table-width');
            writeStored(null);
            updateAria();
            refreshMap();
        }

        // ── Arrastre con puntero (mouse, lápiz o touch) ──
        let drag = null;

        resizer.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            drag = { startX: e.clientX, startWidth: currentWidth() };
            resizer.setPointerCapture(e.pointerId);
            resizer.classList.add('dragging');
            document.body.classList.add('catlec-resizing');
        });

        resizer.addEventListener('pointermove', (e) => {
            if (!drag) return;
            applyWidth(drag.startWidth + (drag.startX - e.clientX), false);
        });

        function endDrag(e) {
            if (!drag) return;
            drag = null;
            if (resizer.hasPointerCapture(e.pointerId)) resizer.releasePointerCapture(e.pointerId);
            resizer.classList.remove('dragging');
            document.body.classList.remove('catlec-resizing');
            writeStored(currentWidth());
            refreshMap();
        }

        resizer.addEventListener('pointerup', endDrag);
        resizer.addEventListener('pointercancel', endDrag);
        resizer.addEventListener('dblclick', resetWidth);

        // ── Teclado ──
        resizer.addEventListener('keydown', (e) => {
            const step = e.shiftKey ? KEY_STEP * 3 : KEY_STEP;
            const { min, max } = getBounds();
            let target = null;
            if (e.key === 'ArrowLeft') target = currentWidth() + step;
            else if (e.key === 'ArrowRight') target = currentWidth() - step;
            else if (e.key === 'Home') target = max;
            else if (e.key === 'End') target = min;
            if (target == null) return;
            e.preventDefault();
            applyWidth(target, true);
        });

        // ── Re-ajuste al cambiar el tamaño de la ventana ──
        window.addEventListener('resize', CatlecUtils.debounce(() => {
            if (resizer.hidden) return; // panel oculto: su ancho medido sería 0
            if (grid.style.getPropertyValue('--catlec-table-width')) applyWidth(currentWidth(), false);
            else updateAria();
        }, 150));

        // ── Ocultar el separador en las visualizaciones que esconden la tabla ──
        const syncVisibility = () => {
            resizer.hidden = panel.style.display === 'none';
        };
        new MutationObserver(syncVisibility).observe(panel, { attributes: true, attributeFilter: ['style'] });
        syncVisibility();

        // ── Restaurar el ancho guardado ──
        const stored = readStored();
        if (stored != null) applyWidth(stored, false);
        else updateAria();

        return { reset: resetWidth, setWidth: (w) => applyWidth(w, true) };
    }

    window.CatlecPanelResizer = { init };
})();
