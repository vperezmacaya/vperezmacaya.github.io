// ─── static/js/common/timeline.js ─────────────────────────────────────────────
// Helpers compartidos por las vistas "Líneas de Tiempo" de DGC, EFE y Metro.
// Consolida el creador de nodos SVG y el tooltip flotante que sigue al cursor,
// que existían como ~3 copias casi idénticas por módulo. El renderizado de cada
// timeline (agrupación de datos, colores por etapa/línea, layout de panel)
// permanece en cada módulo porque es lógica de negocio distinta por dashboard.
window.CatlecTimeline = (function () {
    function svgEl(tag, attrs = {}) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    }

    function createCursorTooltip(opts) {
        const o = Object.assign({ offsetX: 12, offsetY: -12 }, opts);
        if (!o.domId) throw new Error('CatlecTimeline.createCursorTooltip requiere opts.domId');

        function move(e) {
            const tip = document.getElementById(o.domId);
            if (!tip || tip.style.display === 'none') return;
            const tw = tip.offsetWidth;
            const th = tip.offsetHeight;
            let tx = e.clientX + o.offsetX;
            let ty = e.clientY + o.offsetY;

            if (tx + tw + 10 > window.innerWidth) {
                tx = e.clientX - tw - o.offsetX;
            }
            if (ty + th + 10 > window.innerHeight) {
                ty = window.innerHeight - th - 10;
            }
            if (ty < 10) ty = 10;

            tip.style.left = tx + 'px';
            tip.style.top = ty + 'px';
        }

        function show(e, html) {
            const tip = document.getElementById(o.domId);
            if (!tip) return;
            tip.innerHTML = html;
            tip.style.display = 'block';
            move(e);
        }

        function hide() {
            const tip = document.getElementById(o.domId);
            if (tip) tip.style.display = 'none';
        }

        return { show, move, hide };
    }

    function tooltipName(text, color) {
        return `<span class="timeline-tooltip-name" style="color:${color};">${text}</span>`;
    }

    function tooltipRow(label, value, valueStyle = '') {
        return `
        <div class="timeline-tooltip-row">
            <span class="timeline-tooltip-label">${label}</span>
            <span class="timeline-tooltip-val"${valueStyle ? ` style="${valueStyle}"` : ''}>${value}</span>
        </div>`;
    }

    return { svgEl, createCursorTooltip, tooltipName, tooltipRow };
})();
