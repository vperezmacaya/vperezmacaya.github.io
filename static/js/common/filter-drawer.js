// ─── static/js/common/filter-drawer.js ──────────────────────────────────────────
// Filtros en un panel inferior en pantallas angostas (window.CatlecFilterDrawer).
// Requiere common/sheet.js (CatlecSheet).
//
// En escritorio la tarjeta de filtros vive en el panel izquierdo. En celular
// (por defecto ≤ 1100 px) el módulo la MUEVE a un panel que sube desde abajo
// (CatlecSheet) y deja bajo el subheader una barra fija con el botón
// "Filtros", cuántos hay activos, su resumen y "Limpiar". Al volver a una
// pantalla ancha la tarjeta regresa a su lugar. Se mueve el mismo nodo, así
// que sus listeners, multiselects y estado no cambian.
//
// Uso (una vez, después de cablear los filtros):
//   const drawer = CatlecFilterDrawer.init({
//       panel: '.panel-card-filters',            // tarjeta de filtros
//       after: '.view-subheader',                // la barra va después de este elemento
//       getSummary: () => ({ count, labels }),    // filtros activos (labels: textos cortos)
//       getResultLabel: () => 'Ver 132 contratos', // texto del botón del pie (opcional)
//       onReset: () => btnReset.click()            // "Limpiar" (opcional)
//   });
//   drawer.update();   // llamar cada vez que cambian los filtros o los resultados
window.CatlecFilterDrawer = (function () {
    const ICON_SLIDERS = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/></svg>';

    const resolve = (x) => (typeof x === 'string' ? document.querySelector(x) : x);
    const closeMultiselects = () => {
        if (typeof CatlecUtils !== 'undefined' && CatlecUtils.closeAllMultiselects) CatlecUtils.closeAllMultiselects();
    };

    function init(opts) {
        const o = opts || {};
        const panel = resolve(o.panel);
        const after = resolve(o.after);
        if (!panel || !after || typeof CatlecSheet === 'undefined') return null;
        const mq = window.matchMedia(o.media || '(max-width: 1100px)');

        // Lugar original de la tarjeta (un comentario como marcador)
        const home = document.createComment('catlec-filter-drawer');
        panel.parentNode.insertBefore(home, panel);

        // Barra bajo el subheader
        const bar = document.createElement('div');
        bar.className = 'catlec-filter-bar';
        bar.hidden = true;
        bar.innerHTML = `
            <button type="button" class="catlec-filter-bar-btn" aria-haspopup="dialog" aria-controls="catlec-filter-sheet">
                ${ICON_SLIDERS}<span>Filtros</span><span class="catlec-filter-bar-count" hidden></span>
            </button>
            <span class="catlec-filter-bar-summary"></span>
            <button type="button" class="catlec-filter-bar-clear" hidden>Limpiar</button>`;
        after.insertAdjacentElement('afterend', bar);
        const barBtn = bar.querySelector('.catlec-filter-bar-btn');
        const countEl = bar.querySelector('.catlec-filter-bar-count');
        const summaryEl = bar.querySelector('.catlec-filter-bar-summary');
        const clearBtn = bar.querySelector('.catlec-filter-bar-clear');

        const sheet = CatlecSheet.create({
            id: 'catlec-filter-sheet',
            title: o.title || 'Filtros y búsqueda',
            className: 'catlec-sheet--filters',
            footer: true,
            onOpen: () => { update(); barBtn.setAttribute('aria-expanded', 'true'); },
            onClose: () => { closeMultiselects(); barBtn.setAttribute('aria-expanded', 'false'); },
            // Escape cierra primero un multiselect abierto y luego el panel
            onEscape: () => {
                if (!sheet.el.querySelector('.custom-multiselect.open')) return false;
                closeMultiselects();
                return true;
            }
        });
        sheet.footer.innerHTML = '<button type="button" class="catlec-sheet-btn-primary">Ver resultados</button>';
        const applyBtn = sheet.footer.querySelector('button');

        function update() {
            const s = (typeof o.getSummary === 'function' && o.getSummary()) || { count: 0, labels: [] };
            const n = s.count || 0;
            countEl.hidden = n === 0;
            countEl.textContent = String(n);
            bar.classList.toggle('has-active', n > 0);
            summaryEl.textContent = n > 0 ? (s.labels || []).join(' · ') : 'Sin filtros';
            clearBtn.hidden = n === 0 || typeof o.onReset !== 'function';
            barBtn.setAttribute('aria-label', n > 0 ? `Filtros: ${n} activos` : 'Filtros');
            if (typeof o.getResultLabel === 'function') applyBtn.textContent = o.getResultLabel() || 'Ver resultados';
        }

        // Mueve la tarjeta según el ancho
        function place() {
            if (mq.matches) {
                if (panel.parentNode !== sheet.body) sheet.body.appendChild(panel);
                bar.hidden = false;
                document.body.classList.add('catlec-filter-drawer-on');
            } else {
                sheet.close();
                if (panel.parentNode !== home.parentNode) home.parentNode.insertBefore(panel, home.nextSibling);
                bar.hidden = true;
                document.body.classList.remove('catlec-filter-drawer-on');
            }
        }

        barBtn.addEventListener('click', () => { if (mq.matches) sheet.open(); });
        clearBtn.addEventListener('click', () => { o.onReset(); update(); });
        applyBtn.addEventListener('click', sheet.close);
        if (mq.addEventListener) mq.addEventListener('change', place); else mq.addListener(place);

        place();
        update();
        return { open: sheet.open, close: sheet.close, isOpen: sheet.isOpen, update };
    }

    return { init };
})();
