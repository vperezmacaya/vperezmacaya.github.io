// ─── static/js/common/tooltip.js ──────────────────────────────────────────────
// Fábrica de tooltips externos para Chart.js, compartida por todos los módulos
// (DGC, EFE, MOP, Metro, Puertos, SNI). Reemplaza las ~8 copias casi idénticas
// que existían antes, una por módulo, dejando solo las diferencias de estilo y
// comportamiento como opciones explícitas por instancia.
window.CatlecTooltip = (function () {
    function buildStyle(o) {
        const parts = [
            'position:fixed',
            `background:${o.background}`,
            'color:#fff',
            `border-radius:${o.borderRadius}`,
            `padding:${o.padding}`,
            `font:${o.fontSize}/1.4 ${o.fontFamily}`,
            'pointer-events:none',
            `z-index:${o.zIndex}`,
        ];
        if (o.allowWrap) {
            parts.push('max-width:380px', 'word-break:break-word');
        } else {
            parts.push('white-space:nowrap');
        }
        if (o.boxShadow) parts.push(`box-shadow:${o.boxShadow}`);
        if (o.border) parts.push(`border:${o.border}`);
        parts.push('opacity:0');
        return parts.join(';');
    }

    function create(opts) {
        const o = Object.assign({
            background: 'rgba(15, 23, 42, 0.94)',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            zIndex: 99999,
            slideSpeed: 'fast',       // 'fast' (0.15s) | 'slow' (0.8s)
            fadeOutDuration: '0.2s',
            titleJoin: ' ',           // flatten anidado + trim limpio
            titleMarginBottom: '3px',
            allowWrap: true,          // salto de línea inteligente (max 380px)
            clampVertical: true,      // anti-desborde vertical
            supportAfterBody: true,   // soporte de notas al pie
            hideWhenEmpty: true,      // ocultar si no hay contenido
            textColors: { title: '#f8fafc', body: '#e2e8f0', afterBody: '#94a3b8' },
        }, opts);

        if (!o.domId) throw new Error('CatlecTooltip.create requiere opts.domId');

        const slideTiming = o.slideSpeed === 'fast'
            ? '0.15s cubic-bezier(0.2, 0, 0, 1)'
            : '0.8s cubic-bezier(0.2, 0, 0.2, 1)';

        return function externalTooltip(context) {
            const { chart, tooltip } = context;
            let el = document.getElementById(o.domId);
            if (!el) {
                el = document.createElement('div');
                el.id = o.domId;
                el.style.cssText = buildStyle(o);
                document.body.appendChild(el);
            }

            const title = o.titleJoin === ' '
                ? (tooltip.title || []).flatMap(t => Array.isArray(t) ? t : [t]).map(t => String(t).trim()).filter(Boolean).join(' ')
                : (tooltip.title || []).join('\n');
            const bodyLines = o.titleJoin === ' '
                ? (tooltip.body || []).flatMap(b => b.lines).flatMap(l => Array.isArray(l) ? l : [l])
                : (tooltip.body || []).flatMap(b => b.lines);
            const afterLines = o.supportAfterBody ? (tooltip.afterBody || []) : [];

            const isEmpty = o.hideWhenEmpty && !title && bodyLines.length === 0 && afterLines.length === 0;
            if (tooltip.opacity === 0 || isEmpty) {
                el.style.transition = `opacity ${o.fadeOutDuration} ease-in`;
                el.style.opacity = '0';
                return;
            }

            const wasVisible = parseFloat(el.style.opacity || '0') > 0.05;

            if (o.textColors) {
                el.innerHTML = [
                    title ? `<div style="font-weight:700;margin-bottom:${o.titleMarginBottom};color:${o.textColors.title};font-size:12px;">${title}</div>` : '',
                    ...bodyLines.map(line => `<div style="color:${o.textColors.body};font-size:11.5px;margin-top:2px;">${line}</div>`),
                    afterLines.length > 0
                        ? `<div style="margin-top:6px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.15);color:${o.textColors.afterBody};font-size:11px;line-height:1.45;">`
                            + afterLines.map(line => `<div>${line}</div>`).join('') + `</div>`
                        : ''
                ].join('');
            } else {
                el.innerHTML = [
                    title ? `<div style="font-weight:700;margin-bottom:${o.titleMarginBottom}">${title}</div>` : '',
                    ...bodyLines.map(line => `<div>${line}</div>`)
                ].join('');
            }

            const canvasRect = chart.canvas.getBoundingClientRect();
            let left = canvasRect.left + tooltip.caretX + 10;
            let top = canvasRect.top + tooltip.caretY - 10;

            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && left + rect.width > window.innerWidth - 8) {
                left = canvasRect.left + tooltip.caretX - rect.width - 10;
            }
            if (o.clampVertical) {
                if (rect.height > 0 && top + rect.height > window.innerHeight - 8) {
                    top = window.innerHeight - rect.height - 8;
                }
                if (top < 10) top = 10;
                if (left < 10) left = 10;
            }

            if (wasVisible) {
                el.style.transition = `opacity 0.2s ease-out, left ${slideTiming}, top ${slideTiming}`;
                el.style.left = left + 'px';
                el.style.top = top + 'px';
                el.style.opacity = '1';
            } else {
                el.style.transition = 'none';
                el.style.left = left + 'px';
                el.style.top = top + 'px';
                void el.offsetHeight; // Forzar reflow
                el.style.transition = 'opacity 0.2s ease-out';
                el.style.opacity = '1';
            }
        };
    }

    function hide(domId) {
        const el = document.getElementById(domId);
        if (el) el.style.opacity = '0';
    }

    return { create, hide };
})();
