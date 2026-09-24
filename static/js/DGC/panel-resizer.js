// ─── Separador redimensionable mapa ↔ tabla (vista Mapa de index.html) ──────
// Permite ensanchar o angostar la columna derecha (KPIs + tabla) arrastrando el
// separador ubicado en el gap entre el mapa y la tabla. El ancho se escribe en
// la variable CSS --dgc-table-width de la grilla (ver dgc_addons.css) y se
// recuerda por navegador en localStorage.
(function () {
    const STORAGE_KEY = 'catlec.dgc.tableWidth';
    // Ancho mínimo en que se ven las 4 columnas completas: sus anchos fijos en
    // styles.css (180 + 95 + 120 + 85 = 480px) + scrollbar gutter + bordes.
    // Bajo ~497px la tabla deja de encogerse y la columna Estado queda cortada.
    const MIN_TABLE = 500;
    const KEY_STEP = 24;

    const grid = document.querySelector('.dgc-resizable-grid');
    const resizer = document.getElementById('dgc-panel-resizer');
    const leftPanel = grid && grid.querySelector('.left-panel');
    const rightPanel = grid && grid.querySelector('.right-panel');
    // El borde izquierdo de la tabla no puede pasar de la separación entre estos
    // dos botones del subheader (ancho máximo).
    const maxRefLeft = document.getElementById('btn-view-timeline');
    const maxRefRight = document.getElementById('btn-view-investment');
    if (!grid || !resizer || !leftPanel || !rightPanel) return;

    function readStored() {
        try {
            const v = parseFloat(localStorage.getItem(STORAGE_KEY));
            return Number.isFinite(v) ? v : null;
        } catch (e) { return null; }
    }

    function writeStored(width) {
        try {
            if (width == null) localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
        } catch (e) { /* almacenamiento no disponible */ }
    }

    function getMaxLeftEdge() {
        if (maxRefLeft && maxRefRight) {
            return (maxRefLeft.getBoundingClientRect().right + maxRefRight.getBoundingClientRect().left) / 2;
        }
        // Sin los botones de referencia: dejar al menos el ancho del panel izquierdo al mapa
        const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
        const leftRect = leftPanel.getBoundingClientRect();
        return leftRect.right + gap * 2 + leftRect.width;
    }

    function getBounds() {
        const max = rightPanel.getBoundingClientRect().right - getMaxLeftEdge();
        return { min: MIN_TABLE, max: Math.max(MIN_TABLE, max) };
    }

    function clamp(width) {
        const { min, max } = getBounds();
        return Math.min(max, Math.max(min, width));
    }

    function currentWidth() {
        return rightPanel.getBoundingClientRect().width;
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
            if (typeof leafletMap !== 'undefined' && leafletMap) {
                leafletMap.invalidateSize({ animate: false });
            }
        });
    }

    function applyWidth(width, persist) {
        const w = clamp(width);
        grid.style.setProperty('--dgc-table-width', Math.round(w) + 'px');
        if (persist) writeStored(w);
        updateAria();
        refreshMap();
    }

    function resetWidth() {
        grid.style.removeProperty('--dgc-table-width');
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
        document.body.classList.add('dgc-resizing');
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
        document.body.classList.remove('dgc-resizing');
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
        if (resizer.hidden) return; // tabla oculta: su ancho medido sería 0
        if (grid.style.getPropertyValue('--dgc-table-width')) applyWidth(currentWidth(), false);
        else updateAria();
    }, 150));

    // ── Ocultar el separador en las visualizaciones que esconden la tabla ──
    const syncVisibility = () => {
        resizer.hidden = rightPanel.style.display === 'none';
    };
    new MutationObserver(syncVisibility).observe(rightPanel, { attributes: true, attributeFilter: ['style'] });
    syncVisibility();

    // ── Restaurar el ancho guardado ──
    const stored = readStored();
    if (stored != null) applyWidth(stored, false);
    else updateAria();
})();
