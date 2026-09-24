// ─── static/js/common/kpi-animate.js ──────────────────────────────────────────
// Anima el cambio de valor de todas las tarjetas KPI (.kpi-value) de la
// plataforma, sin que los módulos cambien su forma de escribir el valor
// (siguen usando textContent / innerHTML). Un MutationObserver detecta la
// escritura y, antes del repintado, reemplaza el salto por una transición:
//
//  - Contador (count-up): si el valor anterior y el nuevo tienen el mismo texto
//    alrededor de los números (prefijo, sufijo, unidad) y solo cambian las
//    cifras, cada número se interpola en COUNT_MS con easeOutQuart (la misma
//    duración y curva que las animaciones de Chart.js), conservando su
//    formato (separadores es-CL o con punto decimal, cantidad de decimales).
//    Ej: "450" → "460", "US$ 8.463,7 MM/año" → "US$ 9.120,4 MM/año".
//  - Slide + fade: en cualquier otro caso (texto, cambio de unidad "M" → "B",
//    fechas, "—"), el valor nuevo entra con un fundido y un leve
//    desplazamiento: desde abajo si aumentó, desde arriba si disminuyó.
//
// No anima: la carga inicial (se engancha después del evento load), valores
// que no cambiaron, tarjetas ocultas (pestañas inactivas), tarjetas cuya
// etiqueta (.kpi-label) cambió en la misma escritura (la tarjeta pasó a mostrar
// otra métrica al cambiar de visualización) ni con prefers-reduced-motion.
//
// Se inicializa solo. Para una tarjeta KPI creada dinámicamente después de la
// carga, llamar CatlecKpiAnimate.observe(elementoValor).
window.CatlecKpiAnimate = (function () {
    // Igual al estándar de los gráficos: animation: { duration: 450, easing: 'easeOutQuart' }.
    const COUNT_MS = 450;
    const SLIDE_MS = 300;
    const SLIDE_PX = 6;
    const NUM_RE = /\d(?:[\d.,]*\d)?/g;
    const states = new WeakMap();
    const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let observer = null;

    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    // Interpretaciones posibles de una cifra escrita. "1.234" es ambiguo
    // (miles es-CL o decimal con punto) y devuelve ambas; merge() elige la que
    // sea compatible con la otra cifra de la transición.
    function candidates(tok) {
        const dots = tok.split('.').length - 1;
        const commas = tok.split(',').length - 1;
        const out = [];
        const add = (decSep, thouSep) => {
            let intPart = tok;
            let frac = '';
            if (decSep) {
                const i = tok.lastIndexOf(decSep);
                intPart = tok.slice(0, i);
                frac = tok.slice(i + 1);
                if (!frac || /[.,]/.test(frac)) return;
            }
            if (thouSep) {
                const grouped = new RegExp(`^[1-9]\\d{0,2}(\\${thouSep}\\d{3})+$`);
                if (!grouped.test(intPart)) return;
                intPart = intPart.split(thouSep).join('');
            }
            if (!/^\d+$/.test(intPart)) return;
            // Ceros a la izquierda: fechas o códigos ("06", "007"), no cantidades.
            if (intPart.length > 1 && intPart[0] === '0') return;
            out.push({
                value: parseFloat(frac ? `${intPart}.${frac}` : intPart),
                decSep: decSep || null,
                thouSep: thouSep || null,
                decimals: frac.length
            });
        };

        if (!dots && !commas) add(null, null);
        else if (dots && commas) {
            const dec = tok.lastIndexOf('.') > tok.lastIndexOf(',') ? '.' : ',';
            add(dec, dec === '.' ? ',' : '.');
        } else if (commas) {
            if (commas === 1) add(',', null);
            add(null, ',');
        } else {
            add(null, '.');
            if (dots === 1) add('.', null);
        }
        return out;
    }

    function merge(fromTok, toTok) {
        for (const a of candidates(fromTok)) {
            for (const b of candidates(toTok)) {
                if (a.decSep && b.decSep && a.decSep !== b.decSep) continue;
                if (a.thouSep && b.thouSep && a.thouSep !== b.thouSep) continue;
                const thouSep = a.thouSep || b.thouSep;
                const decSep = a.decSep || b.decSep || (thouSep === '.' ? ',' : '.');
                if (decSep === thouSep) continue;
                return {
                    from: a.value,
                    to: b.value,
                    fmt: { decSep, thouSep, decimals: Math.max(a.decimals, b.decimals) }
                };
            }
        }
        return null;
    }

    function format(value, { decSep, thouSep, decimals }) {
        const [intPart, frac] = value.toFixed(decimals).split('.');
        const int = thouSep ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thouSep) : intPart;
        return frac ? int + decSep + frac : int;
    }

    function textNodes(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
    }

    // Separa el HTML en su "esqueleto" (estructura + texto sin cifras) y las
    // cifras de cada nodo de texto, en orden.
    function parse(html) {
        const tpl = document.createElement('template');
        tpl.innerHTML = html;
        const nodes = textNodes(tpl.content).map(n => {
            const node = { literals: n.nodeValue.split(NUM_RE), nums: n.nodeValue.match(NUM_RE) || [], text: n.nodeValue };
            n.nodeValue = node.literals.join('\u0000');
            return node;
        });
        return { skeleton: tpl.innerHTML, nodes };
    }

    // Plan de conteo por nodo de texto, o null si la transición no se puede
    // interpolar (cambia el texto alrededor o alguna cifra no es compatible).
    function buildCountPlan(fromHTML, toHTML) {
        const a = parse(fromHTML);
        const b = parse(toHTML);
        if (a.skeleton !== b.skeleton) return null;
        let changes = false;
        const plan = [];
        for (let i = 0; i < b.nodes.length; i++) {
            const nums = [];
            for (let j = 0; j < b.nodes[i].nums.length; j++) {
                const m = merge(a.nodes[i].nums[j], b.nodes[i].nums[j]);
                if (!m) return null;
                if (m.from !== m.to) changes = true;
                nums.push(m);
            }
            plan.push({ literals: b.nodes[i].literals, nums, final: b.nodes[i].text });
        }
        return changes ? plan : null;
    }

    // +1 si el valor aumentó, -1 si disminuyó (según la primera cifra). Solo
    // compara si el texto alrededor de las cifras es el mismo: "912.4M" vs
    // "1.2B" o dos nombres distintos no son comparables y entran desde abajo.
    function direction(fromHTML, toHTML) {
        if (fromHTML.replace(NUM_RE, '') !== toHTML.replace(NUM_RE, '')) return 1;
        const a = fromHTML.replace(/<[^>]*>/g, '').match(NUM_RE);
        const b = toHTML.replace(/<[^>]*>/g, '').match(NUM_RE);
        const m = a && b ? merge(a[0], b[0]) : null;
        return m && m.to < m.from ? -1 : 1;
    }

    function labelText(el) {
        const card = el.closest('.card-kpi') || el.parentElement;
        const label = card && card.querySelector('.kpi-label');
        return label ? label.textContent : '';
    }

    function canAnimate(el) {
        return !document.hidden
            && !(reduceMotion && reduceMotion.matches)
            && el.getClientRects().length > 0;
    }

    function cancel(st) {
        if (st.raf) cancelAnimationFrame(st.raf);
        if (st.anim) st.anim.cancel();
        st.raf = null;
        st.anim = null;
    }

    function countUp(el, st, plan) {
        const nodes = textNodes(el);
        if (nodes.length !== plan.length) {
            st.shown = el.innerHTML;
            return;
        }
        const render = (e) => {
            plan.forEach((p, i) => {
                nodes[i].nodeValue = e >= 1
                    ? p.final
                    : p.literals.reduce((acc, lit, j) => acc + lit + (j < p.nums.length
                        ? format(p.nums[j].from + (p.nums[j].to - p.nums[j].from) * e, p.nums[j].fmt)
                        : ''), '');
            });
            st.shown = el.innerHTML;
            // Descarta las mutaciones propias para no re-disparar el observer.
            observer.takeRecords();
        };

        // Primer cuadro con el valor anterior, antes del repintado (sin parpadeo).
        render(0);
        const start = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - start) / COUNT_MS);
            render(t >= 1 ? 1 : easeOutQuart(t));
            st.raf = t < 1 ? requestAnimationFrame(step) : null;
        };
        st.raf = requestAnimationFrame(step);
    }

    function slide(el, st, fromHTML, toHTML) {
        st.shown = toHTML;
        if (typeof el.animate !== 'function') return;
        const dy = getComputedStyle(el).display === 'inline' ? 0 : SLIDE_PX * direction(fromHTML, toHTML);
        st.anim = el.animate([
            { opacity: 0, transform: `translateY(${dy}px)` },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: SLIDE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    }

    function handle(el) {
        const st = states.get(el);
        const toHTML = el.innerHTML;
        // Si llega un valor nuevo a mitad de una animación, parte desde lo que
        // se está mostrando en ese momento.
        const fromHTML = st.shown;
        const label = labelText(el);
        const labelChanged = label !== st.label;
        st.label = label;
        cancel(st);

        if (toHTML === fromHTML || labelChanged || !canAnimate(el)) {
            st.shown = toHTML;
            return;
        }
        const plan = buildCountPlan(fromHTML, toHTML);
        if (plan) countUp(el, st, plan);
        else slide(el, st, fromHTML, toHTML);
    }

    function onMutations(records) {
        const changed = new Set();
        records.forEach(r => {
            let n = r.target;
            while (n && !states.has(n)) n = n.parentNode;
            if (n) changed.add(n);
        });
        changed.forEach(handle);
    }

    function observe(el) {
        if (!el || states.has(el)) return;
        if (!observer) observer = new MutationObserver(onMutations);
        states.set(el, { shown: el.innerHTML, label: labelText(el), raf: null, anim: null });
        observer.observe(el, { childList: true, characterData: true, subtree: true });
    }

    function init() {
        document.querySelectorAll('.kpi-value').forEach(observe);
    }

    // Después del load y del primer repintado, para no animar el llenado inicial.
    const start = () => requestAnimationFrame(() => requestAnimationFrame(init));
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });

    return { observe };
})();
