// ─── static/js/common/table-fade.js ───────────────────────────────────────────
// Fundido corto del cuerpo de las tablas (.data-table tbody) cada vez que su
// contenido cambia (filtros, búsqueda, paginación, orden). Los módulos siguen
// dibujando sus filas como siempre (innerHTML / appendChild); un
// MutationObserver detecta el reemplazo de filas y anima la opacidad del tbody.
//
// Solo anima si cambió el texto de las filas: re-render con el mismo contenido
// (ej. marcar la fila seleccionada) no parpadea. Tampoco anima el llenado
// inicial (se engancha después del load), tablas ocultas, la pestaña del
// navegador oculta ni con prefers-reduced-motion.
//
// Se inicializa solo. Para una tabla creada dinámicamente después de la
// carga, llamar CatlecTableFade.observe(tbody).
window.CatlecTableFade = (function () {
    const FADE_MS = 200;
    const states = new WeakMap();
    const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let observer = null;

    function canAnimate(tbody) {
        return !document.hidden
            && !(reduceMotion && reduceMotion.matches)
            && tbody.getClientRects().length > 0
            && typeof tbody.animate === 'function';
    }

    function handle(tbody) {
        const st = states.get(tbody);
        const text = tbody.textContent;
        if (text === st.text) return;
        st.text = text;
        if (!canAnimate(tbody)) return;
        if (st.anim) st.anim.cancel();
        st.anim = tbody.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' });
    }

    function onMutations(records) {
        // Un render (vaciar + agregar N filas) llega como un solo lote: una
        // animación por tbody.
        new Set(records.map(r => r.target)).forEach(t => { if (states.has(t)) handle(t); });
    }

    function observe(tbody) {
        if (!tbody || states.has(tbody)) return;
        if (!observer) observer = new MutationObserver(onMutations);
        states.set(tbody, { text: tbody.textContent, anim: null });
        observer.observe(tbody, { childList: true });
    }

    function init() {
        document.querySelectorAll('.data-table tbody').forEach(observe);
    }

    // Después del load y del primer repintado, para no animar el llenado inicial.
    const start = () => requestAnimationFrame(() => requestAnimationFrame(init));
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });

    return { observe };
})();
