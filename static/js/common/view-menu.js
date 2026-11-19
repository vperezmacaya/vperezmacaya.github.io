// ─── static/js/common/view-menu.js ─────────────────────────────────────────────
// Menú de visualizaciones en pantallas angostas (window.CatlecViewMenu).
//
// En escritorio, el subheader azul (.view-subheader) muestra un botón por
// visualización. Hasta 768 px (VIEW_MENU_MQ, mismo corte que styles.css) no
// caben: el subheader se pliega en un botón de tres barras con el nombre de
// la visualización abierta, que despliega la lista completa.
//
// No reemplaza la lógica de cada módulo: los botones .view-tab-btn originales
// (con sus listeners y la clase .active que pone cada módulo) se mueven a una
// lista, .view-menu-list, que en escritorio es display: contents (la grilla del
// subheader los sigue viendo como hijos directos). El nombre del botón de tres
// barras sigue a la clase .active con un MutationObserver, y un clic en una
// visualización cierra la lista.
//
// Uso: incluir el script en todo dashboard con .view-subheader (después de
// utils.js). Se inicia solo; no hay que llamar nada.
window.CatlecViewMenu = (function () {
    const VIEW_MENU_MQ = '(max-width: 768px)';

    const ICON_BARS = '<svg class="view-menu-bars" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';
    const ICON_CHEVRON = '<svg class="view-menu-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

    function init(subheader) {
        subheader = subheader || document.querySelector('.view-subheader');
        if (!subheader || subheader.dataset.viewMenu) return null;
        const buttons = Array.from(subheader.querySelectorAll(':scope > .view-tab-btn'));
        if (buttons.length < 2) return null;
        subheader.dataset.viewMenu = 'on';

        const list = document.createElement('div');
        list.className = 'view-menu-list';
        list.id = 'view-menu-list';
        list.setAttribute('role', 'menu');
        buttons.forEach(btn => {
            btn.setAttribute('role', 'menuitem');
            list.appendChild(btn);
        });

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'view-menu-toggle';
        toggle.setAttribute('aria-haspopup', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', list.id);
        toggle.innerHTML = `${ICON_BARS}<span class="view-menu-current"></span>`
            + `<span class="view-menu-count"></span>${ICON_CHEVRON}`;
        const currentEl = toggle.querySelector('.view-menu-current');
        const countEl = toggle.querySelector('.view-menu-count');

        subheader.prepend(toggle);
        subheader.appendChild(list);

        const labelOf = (btn) => {
            const span = btn.querySelector('span');
            return ((span ? span.textContent : btn.textContent) || '').replace(/\s+/g, ' ').trim();
        };

        function updateCurrent() {
            const idx = buttons.findIndex(b => b.classList.contains('active'));
            const active = buttons[idx >= 0 ? idx : 0];
            currentEl.textContent = labelOf(active);
            countEl.textContent = `${(idx >= 0 ? idx : 0) + 1}/${buttons.length}`;
            toggle.setAttribute('aria-label', `Visualización: ${labelOf(active)}. Cambiar de visualización`);
        }

        const isOpen = () => subheader.classList.contains('is-open');
        function setOpen(open) {
            subheader.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', String(open));
        }

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            setOpen(!isOpen());
        });
        // El listener propio del botón (del módulo) corre primero; luego se cierra.
        list.addEventListener('click', (e) => {
            if (e.target.closest('.view-tab-btn')) setOpen(false);
        });
        document.addEventListener('click', (e) => {
            if (isOpen() && !subheader.contains(e.target)) setOpen(false);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen()) {
                setOpen(false);
                toggle.focus();
            }
        });

        const mq = window.matchMedia(VIEW_MENU_MQ);
        // Al cruzar el corte (girar el celular, achicar la ventana) la lista pasa
        // de display: contents a oculta: sin .view-menu-instant se vería un
        // fundido de salida de 0,18 s sobre el contenido.
        const onMq = () => {
            if (!mq.matches) setOpen(false);
            subheader.classList.add('view-menu-instant');
            requestAnimationFrame(() => requestAnimationFrame(() => subheader.classList.remove('view-menu-instant')));
        };
        if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq);

        new MutationObserver(updateCurrent)
            .observe(list, { subtree: true, attributes: true, attributeFilter: ['class'] });
        updateCurrent();

        return { open: () => setOpen(true), close: () => setOpen(false), update: updateCurrent };
    }

    let instance = null;
    function start() { instance = init(); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    return {
        init,
        open: () => instance && instance.open(),
        close: () => instance && instance.close()
    };
})();
