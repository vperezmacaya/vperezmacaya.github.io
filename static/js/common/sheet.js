// ─── static/js/common/sheet.js ──────────────────────────────────────────────────
// Paneles que suben desde abajo (bottom sheets) para pantallas angostas
// (window.CatlecSheet). Los usan los filtros (common/filter-drawer.js) y, en
// DGC, la lista y el resumen (DGC/vista-movil.js), para que en celular el
// dashboard siga siendo una sola pantalla: el contenido secundario se abre
// encima en vez de alargar la página.
//
// - Un panel a la vez: abrir uno cierra los demás.
// - Se cierra con su ✕, tocando el fondo o con Escape (`onEscape` puede
//   atender la tecla antes, ej. cerrar un multiselect abierto, devolviendo true).
// - Estilos .catlec-sheet* en styles.css; `className: 'catlec-sheet--fill'`
//   le da alto fijo y un cuerpo flex sin scroll propio (para tablas con
//   encabezado fijo y scroll interno).
//
// Uso:
//   const hoja = CatlecSheet.create({ id, title, className, footer: true, onOpen, onClose, onEscape });
//   hoja.body.appendChild(nodo); hoja.open(); hoja.close(); hoja.isOpen();
window.CatlecSheet = (function () {
    const ICON_CLOSE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    const sheets = [];

    function create(opts) {
        const o = opts || {};
        const title = o.title || '';

        const backdrop = document.createElement('div');
        backdrop.className = 'catlec-sheet-backdrop';

        const el = document.createElement('div');
        el.className = 'catlec-sheet' + (o.className ? ` ${o.className}` : '');
        if (o.id) el.id = o.id;
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', title);
        el.innerHTML = `
            <div class="catlec-sheet-header">
                <span class="catlec-sheet-title"></span>
                <button type="button" class="catlec-sheet-close" aria-label="Cerrar">${ICON_CLOSE}</button>
            </div>
            <div class="catlec-sheet-body"></div>
            ${o.footer ? '<div class="catlec-sheet-footer"></div>' : ''}`;
        el.querySelector('.catlec-sheet-title').textContent = title;
        document.body.append(backdrop, el);

        const closeBtn = el.querySelector('.catlec-sheet-close');
        let lastFocus = null;

        const api = {
            el,
            body: el.querySelector('.catlec-sheet-body'),
            footer: el.querySelector('.catlec-sheet-footer'),
            onEscape: o.onEscape,
            isOpen: () => el.classList.contains('is-open'),
            open() {
                if (api.isOpen()) return;
                sheets.forEach(s => { if (s !== api) s.close(); });
                lastFocus = document.activeElement;
                if (typeof o.onOpen === 'function') o.onOpen();
                backdrop.classList.add('is-open');
                el.classList.add('is-open');
                closeBtn.focus({ preventScroll: true });
            },
            close() {
                if (!api.isOpen()) return;
                backdrop.classList.remove('is-open');
                el.classList.remove('is-open');
                if (typeof o.onClose === 'function') o.onClose();
                if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
            },
            toggle() { if (api.isOpen()) api.close(); else api.open(); }
        };

        backdrop.addEventListener('click', api.close);
        closeBtn.addEventListener('click', api.close);
        sheets.push(api);
        return api;
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const open = sheets.find(s => s.isOpen());
        if (!open) return;
        // La tecla es del panel: que no cierre además lo que hay debajo (ej. la ficha de DGC)
        e.stopImmediatePropagation();
        if (typeof open.onEscape === 'function' && open.onEscape()) return;
        open.close();
    });

    return {
        create,
        closeAll: () => sheets.forEach(s => s.close()),
        anyOpen: () => sheets.some(s => s.isOpen())
    };
})();
