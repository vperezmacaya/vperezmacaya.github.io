// ─── static/js/Landing/carousel.js ───────────────────────────────────────────
// Carruseles del landing: "Módulos del Observatorio" (una diapositiva por
// módulo con una cifra grande y un gráfico Chart.js, elegida desde una lista de
// módulos) y "Proyectos destacados" (featured.js). Ambos usan la misma
// mecánica, LandingCarousel.create():
//
// - Marcado: dentro de la raíz .lp-carousel van .lp-carousel-viewport >
//   .lp-carousel-track, .lp-carousel-progress-fill, .lp-carousel-dots y, si
//   las hay, las flechas .lp-carousel-arrow--prev / --next. Todas las
//   diapositivas son .lp-slide y comparten la misma celda de la grilla;
//   cambian con fundido y desplazamiento (o con opts.animate).
// - Selectores: por omisión, puntos .lp-dot; con opts.dotClass / opts.dotHtml
//   pueden ser elementos con contenido (la lista de módulos).
// - Autoplay: una barra de progreso delgada es una animación CSS que se
//   reinicia en cada cambio de diapositiva; su animationend avanza a la
//   siguiente. Con opts.progressInDot la barra se mueve dentro del selector
//   activo. Pausar la animación (hover, foco, carrusel fuera de pantalla,
//   pestaña del navegador oculta) pausa también el avance. Sin autoplay con
//   prefers-reduced-motion.
// - La primera diapositiva se activa recién cuando el carrusel entra en
//   pantalla. Cada carrusel decide qué pasa al activar/desactivar una
//   diapositiva (onActivate / onDeactivate).
//
// Carrusel de módulos (LandingCarousel.init): los gráficos se crean la primera
// vez que su diapositiva se activa y en las visitas siguientes repiten su
// animación de entrada (reset + update); la cifra grande es un .kpi-value que
// CatlecKpiAnimate anima desde cero; cada diapositiva tiene de fondo una foto
// de su módulo (LandingPhotos), difuminada y velada.
window.LandingCarousel = (function () {
    const SWIPE_PX = 50;
    const DIGITS_RE = /\d(?:[\d.,]*\d)?/g;

    const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // "1.033,6" → "0,0" · "661" → "0": misma forma que el valor final, para
    // que CatlecKpiAnimate haga un conteo (y no un fundido) al activar.
    const zeroOf = (text) => text.replace(DIGITS_RE, (m) => {
        const dec = m.match(/,(\d+)$/);
        return dec ? '0,' + '0'.repeat(dec[1].length) : '0';
    });

    function navModule(moduleId) {
        return (window.CatlecNav && CatlecNav.NAV_MODULES || []).find(m => m.id === moduleId);
    }

    function logoHtml(moduleId) {
        const mod = navModule(moduleId);
        if (!mod) return '';
        return mod.logo.type === 'lucide'
            ? `<i data-lucide="${mod.logo.name}"></i>`
            : `<img src="${mod.logo.src}" alt="">`;
    }

    function moduleFile(moduleId) {
        const mod = navModule(moduleId);
        return mod ? mod.file : '#';
    }

    function moduleLabel(moduleId) {
        const mod = navModule(moduleId);
        return mod ? mod.label : moduleId.toUpperCase();
    }

    // Pill con el logo y el nombre del módulo (cabecera de cada diapositiva).
    function modulePillHtml(moduleId) {
        return `<span class="lp-slide-module">
                    <span class="lp-slide-module-logo">${logoHtml(moduleId)}</span>${moduleLabel(moduleId)}
                </span>`;
    }

    // ─── Fábrica ────────────────────────────────────────────────────────────
    // opts: {
    //   slides: [...],                        definiciones (cualquier forma)
    //   renderSlide(slide, i, total) → HTML,  un <article class="lp-slide" ...>
    //   dotLabel(slide, i) → texto,           aria-label de cada selector
    //   dotClass, dotHtml(slide, i) → HTML,   clase y contenido del selector
    //                                         (por omisión, un punto .lp-dot vacío)
    //   progressInDot,                        la barra de autoplay va dentro del
    //                                         selector activo
    //   onActivate(el, slide, i),             tras el repintado de la activa
    //   onDeactivate(el, slide, i),           cuando la saliente ya salió de la vista
    //   deactivateDelay,                      ms hasta onDeactivate (650: el fundido del CSS)
    //   animate(prevEl, nextEl, dir),         transición propia (opcional; dir = 1
    //                                         avanza, -1 retrocede); sin ella se usa
    //                                         el fundido de .lp-slide del CSS
    //   autoplayMs
    // }
    function create(root, opts) {
        if (!root) return null;
        const track = root.querySelector('.lp-carousel-track');
        const dots = root.querySelector('.lp-carousel-dots');
        const viewport = root.querySelector('.lp-carousel-viewport');
        const progressFill = root.querySelector('.lp-carousel-progress-fill');
        if (!track || !dots) return null;

        const slides = opts.slides || [];
        if (!slides.length) {
            root.hidden = true;
            return null;
        }

        const pauseReasons = new Set();
        let current = -1;

        track.innerHTML = slides.map((s, i) => opts.renderSlide(s, i, slides.length)).join('');
        const slideEls = Array.from(track.querySelectorAll('.lp-slide'));

        const prefix = root.id || 'lp-carousel';
        const dotClass = opts.dotClass || 'lp-dot';
        dots.innerHTML = slides.map((s, i) => `
            <button class="${dotClass}" role="tab" id="${prefix}-dot-${i}" aria-controls="${slideEls[i].id}"
                aria-selected="false" aria-label="${opts.dotLabel(s, i)}" tabindex="-1" data-index="${i}">${opts.dotHtml ? opts.dotHtml(s, i) : ''}</button>`).join('');
        const dotEls = Array.from(dots.querySelectorAll('[role="tab"]'));

        function goTo(index) {
            const n = slides.length;
            const next = ((index % n) + n) % n;
            if (next === current) return;
            const prev = current;
            // Sentido según el índice pedido (antes de dar la vuelta): "siguiente"
            // desde la última avanza aunque vuelva a la primera.
            const dir = index > prev ? 1 : -1;
            current = next;

            slideEls.forEach((el, i) => {
                const active = i === next;
                el.classList.toggle('is-active', active);
                el.classList.toggle('is-before', i < next);
                el.toggleAttribute('inert', !active);
                el.setAttribute('aria-hidden', String(!active));
            });
            dotEls.forEach((d, i) => {
                d.classList.toggle('is-active', i === next);
                d.setAttribute('aria-selected', String(i === next));
                d.tabIndex = i === next ? 0 : -1;
            });
            if (opts.animate && prev >= 0) opts.animate(slideEls[prev], slideEls[next], dir);

            CatlecTooltip.hide('landing-shared-tooltip');
            if (opts.progressInDot && progressFill) dotEls[next].appendChild(progressFill);
            restartProgress();

            // La saliente se reinicia cuando ya salió de la vista, para que la
            // próxima visita vuelva a animarse desde el principio.
            if (prev >= 0 && opts.onDeactivate) {
                setTimeout(() => { if (current !== prev) opts.onDeactivate(slideEls[prev], slides[prev], prev); },
                    opts.deactivateDelay || 650);
            }
            if (opts.onActivate) {
                CatlecUtils.afterNextPaint(() => {
                    if (current === next) opts.onActivate(slideEls[next], slides[next], next);
                });
            }
        }

        function setPaused(reason, on) {
            if (on) pauseReasons.add(reason); else pauseReasons.delete(reason);
            root.classList.toggle('is-paused', pauseReasons.size > 0);
        }

        // Reinicia la barra de progreso al cambiar de diapositiva quitando y
        // reponiendo la animación CSS (fuerza un reflow entre medio).
        function restartProgress() {
            if (!progressFill) return;
            progressFill.style.animation = 'none';
            void progressFill.offsetWidth;
            progressFill.style.animation = '';
        }

        function wireAutoplay() {
            if (reduceMotion() || !progressFill) return;
            root.style.setProperty('--lp-autoplay-ms', (opts.autoplayMs || 7000) + 'ms');
            root.classList.add('is-autoplay');

            progressFill.addEventListener('animationend', () => goTo(current + 1));

            root.addEventListener('mouseenter', () => setPaused('hover', true));
            root.addEventListener('mouseleave', () => setPaused('hover', false));
            root.addEventListener('focusin', () => setPaused('focus', true));
            root.addEventListener('focusout', (e) => {
                if (!root.contains(e.relatedTarget)) setPaused('focus', false);
            });
            document.addEventListener('visibilitychange', () => setPaused('hidden', document.hidden));

            // Arranca en pausa hasta que el carrusel entra en pantalla.
            setPaused('offscreen', true);
            new IntersectionObserver((entries) => {
                setPaused('offscreen', !entries[0].isIntersecting);
            }, { threshold: 0.35 }).observe(root);
        }

        function wireSwipe() {
            if (!viewport) return;
            let startX = null, startY = 0;
            viewport.addEventListener('pointerdown', (e) => {
                if (e.pointerType === 'mouse') return;
                startX = e.clientX;
                startY = e.clientY;
            });
            viewport.addEventListener('pointerup', (e) => {
                if (startX === null) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                startX = null;
                if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) goTo(current + (dx < 0 ? 1 : -1));
            });
            viewport.addEventListener('pointercancel', () => { startX = null; });
        }

        dotEls.forEach(d => d.addEventListener('click', () => goTo(Number(d.dataset.index))));
        const prevBtn = root.querySelector('.lp-carousel-arrow--prev');
        const nextBtn = root.querySelector('.lp-carousel-arrow--next');
        if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));
        root.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); dotEls[current].focus(); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); dotEls[current].focus(); }
        });

        wireSwipe();
        wireAutoplay();

        const first = new IntersectionObserver((entries) => {
            if (!entries[0].isIntersecting) return;
            first.disconnect();
            goTo(0);
        }, { threshold: 0.35 });
        first.observe(root);

        return { goTo, slideEls, get current() { return current; } };
    }

    // ─── Módulos del Observatorio (lista de módulos + panel de cifras) ─────
    function legendHtml(items) {
        if (!items.length) return '';
        return `<div class="lp-legend">${items.map(i => `
            <span class="lp-legend-item" style="color:${i.color}">
                <span class="lp-legend-swatch${i.shape === 'line' ? ' lp-legend-swatch--line' : ''}" style="background:${i.color}"></span>${i.label}
            </span>`).join('')}</div>`;
    }

    function figureSlideHtml(s, i, total) {
        return `
        <article class="lp-slide" id="lp-slide-${s.id}" role="group" aria-roledescription="diapositiva"
            aria-label="${i + 1} de ${total}: ${s.short}" style="--slide-accent:${s.accent}">
            ${s.photo ? `<div class="lp-slide-photo" data-photo="${s.photo}" aria-hidden="true"></div>` : ''}
            <div class="lp-slide-info">
                ${modulePillHtml(s.id)}
                <div class="lp-big">
                    ${s.prefix ? `<span class="lp-big-prefix">${s.prefix}</span>` : ''}
                    <span class="kpi-value lp-big-num">${zeroOf(s.number)}</span>
                    <span class="lp-big-unit">${s.unit}</span>
                </div>
                <p class="lp-slide-phrase">${s.phrase}</p>
                <div class="lp-slide-stats">
                    ${s.stats.map(st => `<div class="lp-slide-stat"><strong>${st.value}</strong><span>${st.label}</span></div>`).join('')}
                </div>
                <div class="lp-slide-actions">
                    <a class="lp-btn lp-btn--primary lp-btn--sm" href="${moduleFile(s.id)}">Abrir módulo <i data-lucide="arrow-right" class="icon-13"></i></a>
                    <a class="lp-slide-link" href="${s.link}">Ver este análisis</a>
                </div>
            </div>
            <div class="lp-slide-chart">
                <div class="lp-slide-chart-head">
                    <span class="lp-slide-chart-title">${s.chartTitle}</span>
                    ${legendHtml(s.legend)}
                </div>
                <div class="lp-slide-canvas"><canvas aria-label="${s.chartTitle}" role="img"></canvas></div>
                <span class="lp-slide-source">${s.source}${s.photo && window.LandingPhotos ? ` · ${LandingPhotos.creditHtml(s.photo)}` : ''}</span>
            </div>
        </article>`;
    }

    // Selector de la lista: logo, nombre corto y descripción del módulo; la
    // barra de autoplay se inserta dentro del activo (progressInDot).
    function moduleItemHtml(s) {
        return `
            <span class="lp-hub-item-logo" aria-hidden="true">${logoHtml(s.id)}</span>
            <span class="lp-hub-item-name">${s.name || moduleLabel(s.id)}</span>
            <span class="lp-hub-item-desc">${s.description || ''}</span>`;
    }

    // En móvil la lista es una fila deslizable: centra el módulo activo sin
    // mover la página (solo el desplazamiento horizontal de la lista).
    function revealItem(list, item) {
        if (!list || !item || list.scrollWidth <= list.clientWidth) return;
        const left = item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2;
        list.scrollTo({ left: Math.max(0, left), behavior: reduceMotion() ? 'auto' : 'smooth' });
    }

    function init(slideDefs) {
        const root = document.getElementById('lp-carousel');
        const list = root && root.querySelector('.lp-carousel-dots');
        const charts = new Array(slideDefs.length).fill(null);

        function loadPhoto(el) {
            const layer = el && el.querySelector('.lp-slide-photo');
            if (!layer || layer.style.backgroundImage || !window.LandingPhotos) return;
            const photo = LandingPhotos.get(layer.dataset.photo);
            if (photo) layer.style.backgroundImage = `url("${photo.src}")`;
        }

        const carousel = create(root, {
            slides: slideDefs,
            renderSlide: figureSlideHtml,
            dotLabel: (s) => moduleLabel(s.id),
            dotClass: 'lp-hub-item',
            dotHtml: moduleItemHtml,
            progressInDot: true,
            autoplayMs: 7000,
            onActivate(el, s, i) {
                revealItem(list, list && list.children[i]);
                loadPhoto(el);
                loadPhoto(carousel.slideEls[(i + 1) % slideDefs.length]); // precarga la siguiente
                el.querySelector('.lp-big-num').textContent = s.number;
                const canvas = el.querySelector('canvas');
                if (!charts[i]) {
                    charts[i] = new Chart(canvas.getContext('2d'), s.chart(canvas));
                } else if (!reduceMotion()) {
                    charts[i].reset();
                    charts[i].update();
                }
            },
            onDeactivate(el, s) {
                el.querySelector('.lp-big-num').textContent = zeroOf(s.number);
            }
        });
        if (!carousel) return;
        carousel.slideEls.forEach(el => CatlecKpiAnimate.observe(el.querySelector('.lp-big-num')));
    }

    return { create, init, zeroOf, modulePillHtml, moduleLabel, reduceMotion };
})();
