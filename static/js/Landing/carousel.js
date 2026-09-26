// ─── static/js/Landing/carousel.js ───────────────────────────────────────────
// Carrusel de cifras del landing: una diapositiva por módulo con una cifra
// grande, una frase, dos indicadores secundarios y un gráfico Chart.js.
//
// - Autoplay: una barra de progreso delgada (compartida, no una por punto) es
//   una animación CSS que se reinicia en cada cambio de diapositiva; su
//   animationend avanza a la siguiente. Pausar la animación (hover, foco,
//   carrusel fuera de pantalla, pestaña del navegador oculta) pausa también
//   el avance. Sin autoplay con prefers-reduced-motion.
// - Los gráficos se crean la primera vez que su diapositiva se activa y en las
//   visitas siguientes repiten su animación de entrada (reset + update).
// - La cifra grande es un .kpi-value: CatlecKpiAnimate la anima desde cero.
// - Cada diapositiva tiene de fondo una foto de su módulo (LandingPhotos),
//   difuminada y velada; se carga recién la primera vez que se activa.
window.LandingCarousel = (function () {
    const AUTOPLAY_MS = 7000;
    const SWIPE_PX = 50;
    const DIGITS_RE = /\d(?:[\d.,]*\d)?/g;

    const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let slides = [];
    let slideEls = [];
    let dotEls = [];
    let charts = [];
    let current = -1;
    let root = null;
    let progressFill = null;

    // "1.033,6" → "0,0" · "661" → "0": misma forma que el valor final, para
    // que CatlecKpiAnimate haga un conteo (y no un fundido) al activar.
    const zeroOf = (text) => text.replace(DIGITS_RE, (m) => {
        const dec = m.match(/,(\d+)$/);
        return dec ? '0,' + '0'.repeat(dec[1].length) : '0';
    });

    function logoHtml(moduleId) {
        const mod = (window.CatlecNav && CatlecNav.NAV_MODULES || []).find(m => m.id === moduleId);
        if (!mod) return '';
        return mod.logo.type === 'lucide'
            ? `<i data-lucide="${mod.logo.name}"></i>`
            : `<img src="${mod.logo.src}" alt="">`;
    }

    function moduleLabel(moduleId) {
        const mod = (window.CatlecNav && CatlecNav.NAV_MODULES || []).find(m => m.id === moduleId);
        return mod ? mod.label : moduleId.toUpperCase();
    }

    function legendHtml(items) {
        if (!items.length) return '';
        return `<div class="lp-legend">${items.map(i => `
            <span class="lp-legend-item" style="color:${i.color}">
                <span class="lp-legend-swatch${i.shape === 'line' ? ' lp-legend-swatch--line' : ''}" style="background:${i.color}"></span>${i.label}
            </span>`).join('')}</div>`;
    }

    function slideHtml(s, i) {
        return `
        <article class="lp-slide" id="lp-slide-${s.id}" role="group" aria-roledescription="diapositiva"
            aria-label="${i + 1} de ${slides.length}: ${s.short}" style="--slide-accent:${s.accent}">
            ${s.photo ? `<div class="lp-slide-photo" data-photo="${s.photo}" aria-hidden="true"></div>` : ''}
            <div class="lp-slide-info">
                <span class="lp-slide-module">
                    <span class="lp-slide-module-logo">${logoHtml(s.id)}</span>${moduleLabel(s.id)}
                </span>
                <div class="lp-big">
                    ${s.prefix ? `<span class="lp-big-prefix">${s.prefix}</span>` : ''}
                    <span class="kpi-value lp-big-num">${zeroOf(s.number)}</span>
                    <span class="lp-big-unit">${s.unit}</span>
                </div>
                <p class="lp-slide-phrase">${s.phrase}</p>
                <div class="lp-slide-stats">
                    ${s.stats.map(st => `<div class="lp-slide-stat"><strong>${st.value}</strong><span>${st.label}</span></div>`).join('')}
                </div>
                <a class="lp-slide-link" href="${s.link}">Ver en el módulo <i data-lucide="arrow-right" class="icon-13"></i></a>
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

    function loadPhoto(i) {
        const layer = slideEls[i].querySelector('.lp-slide-photo');
        if (!layer || layer.style.backgroundImage || !window.LandingPhotos) return;
        const photo = LandingPhotos.get(layer.dataset.photo);
        if (photo) layer.style.backgroundImage = `url("${photo.src}")`;
    }

    function activateChart(i) {
        const canvas = slideEls[i].querySelector('canvas');
        if (!charts[i]) {
            charts[i] = new Chart(canvas.getContext('2d'), slides[i].chart(canvas));
            return;
        }
        if (!reduceMotion()) {
            charts[i].reset();
            charts[i].update();
        }
    }

    function goTo(index) {
        const n = slides.length;
        const next = ((index % n) + n) % n;
        if (next === current) return;
        const prev = current;
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

        CatlecTooltip.hide('landing-shared-tooltip');
        restartProgress();

        // La cifra saliente vuelve a cero cuando ya se desvaneció, para que la
        // próxima visita cuente de nuevo desde cero.
        if (prev >= 0) {
            const prevNum = slideEls[prev].querySelector('.lp-big-num');
            const zero = zeroOf(slides[prev].number);
            setTimeout(() => { if (current !== prev) prevNum.textContent = zero; }, 650);
        }

        loadPhoto(next);
        loadPhoto((next + 1) % n); // precarga la siguiente para que no aparezca en blanco

        const num = slideEls[next].querySelector('.lp-big-num');
        CatlecUtils.afterNextPaint(() => {
            num.textContent = slides[next].number;
            activateChart(next);
        });
    }

    function setPaused(reason, on) {
        const reasons = root._pauseReasons;
        if (on) reasons.add(reason); else reasons.delete(reason);
        root.classList.toggle('is-paused', reasons.size > 0);
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
        if (reduceMotion()) return;
        root.style.setProperty('--lp-autoplay-ms', AUTOPLAY_MS + 'ms');
        root.classList.add('is-autoplay');
        root._pauseReasons = new Set();

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

    function wireSwipe(viewport) {
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

    function init(slideDefs) {
        root = document.getElementById('lp-carousel');
        const track = document.getElementById('lp-carousel-track');
        const dots = document.getElementById('lp-carousel-dots');
        progressFill = document.getElementById('lp-carousel-progress-fill');
        if (!root || !track || !dots) return;

        slides = slideDefs;
        if (!slides.length) {
            root.hidden = true;
            return;
        }

        track.innerHTML = slides.map(slideHtml).join('');
        slideEls = Array.from(track.querySelectorAll('.lp-slide'));
        charts = new Array(slides.length).fill(null);

        dots.innerHTML = slides.map((s, i) => `
            <button class="lp-dot" role="tab" id="lp-dot-${s.id}" aria-controls="lp-slide-${s.id}"
                aria-selected="false" aria-label="${moduleLabel(s.id)}" tabindex="-1" data-index="${i}"></button>`).join('');
        dotEls = Array.from(dots.querySelectorAll('.lp-dot'));
        dotEls.forEach(d => d.addEventListener('click', () => goTo(Number(d.dataset.index))));

        slideEls.forEach(el => CatlecKpiAnimate.observe(el.querySelector('.lp-big-num')));

        document.getElementById('lp-carousel-prev').addEventListener('click', () => goTo(current - 1));
        document.getElementById('lp-carousel-next').addEventListener('click', () => goTo(current + 1));
        root.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); dotEls[current].focus(); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); dotEls[current].focus(); }
        });

        wireSwipe(document.getElementById('lp-carousel-viewport'));
        wireAutoplay();

        // La primera diapositiva se activa (y cuenta) cuando el carrusel entra
        // en pantalla, no al cargar la página.
        const first = new IntersectionObserver((entries) => {
            if (!entries[0].isIntersecting) return;
            first.disconnect();
            goTo(0);
        }, { threshold: 0.35 });
        first.observe(root);
    }

    return { init, goTo };
})();
