// ─── static/js/Landing/main.js ───────────────────────────────────────────────
// Arranque del landing del Observatorio CATLEC (index.html): hero, carrusel de cifras, tarjetas de módulos, autores, pestañas del header
// con seguimiento de scroll y apariciones al hacer scroll.

// Autores (los mismos del "Acerca de" de cada módulo).
const LANDING_AUTHORS = [
    { name: 'José Oliveros', role: 'Equipo desarrollador', email: 'joseoliveros@udec.cl' },
    { name: 'Vicente Pérez', role: 'Equipo desarrollador', email: 'vicperez2021@udec.cl' },
];
const LANDING_AFFILIATION = 'Departamento de Ingeniería Industrial, Facultad de Ingeniería, Universidad de Concepción';

// Descripción corta de cada módulo (el resto sale de CatlecNav.NAV_MODULES).
const LANDING_MODULE_INFO = {
    dgc: 'Contratos de concesión: mapa, líneas de tiempo, inversión, contratos y oferentes.',
    efe: 'Proyectos ferroviarios, servicios de pasajeros, demanda y satisfacción.',
    metro: 'Expansión de la red, cobertura por comuna y evolución de la demanda.',
    mop: 'Cartera de iniciativas del MOP por región, servicio, etapa y programa.',
    sni: 'Inversión pública 2010–2024 por región, ministerio y año.',
    puertos: 'Carga, contenedores, tipología y transporte terrestre en el Biobío.',
};

// Foto de cabecera de cada tarjeta de módulo (static/js/Landing/photos.js)
const LANDING_MODULE_PHOTOS = {
    dgc: 'santiago-autopistas-bn',
    efe: 'efe-tren-bmu',
    metro: 'metro-l7-obras',
    mop: 'viaducto-malleco',
    sni: 'puente-ferroviario-biobio',
    puertos: 'valparaiso-puerto',
};

// Fotos de la franja de portada y de la sección de autores
// Ancho real de la foto en cada tarjeta, según la grilla de .lp-modules
// (landing_addons.css): 3 columnas en el contenedor de 1200 px, 2 bajo 1100 px
// y 1 bajo 640 px, menos los 2 px del borde de la tarjeta. En escritorio da
// 370 px, que es una de las variantes (CARD_WIDTHS en photos.js), así la foto
// se muestra 1:1 con los píxeles de la pantalla. Si cambia la grilla,
// actualizar estos anchos y las variantes.
const LANDING_CARD_SIZES = '(max-width: 640px) calc(100vw - 34px), '
    + '(max-width: 1100px) calc((100vw - 66px) / 2 - 2px), '
    + '(max-width: 1200px) calc((100vw - 84px) / 3 - 2px), 370px';

const LANDING_BAND_PHOTO = 'santiago-skyline';
const LANDING_AUTHORS_PHOTO = 'udec-campanil';

function landingInitials(name) {
    return name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function renderModules(summary) {
    const grid = document.getElementById('lp-modules');
    if (!grid || !window.CatlecNav) return;
    // SECTRA es un módulo aislado (ver CLAUDE.md): nunca se enlaza desde aquí.
    const modules = CatlecNav.NAV_MODULES.filter(m => m.id !== 'sectra');
    grid.innerHTML = modules.map((m, i) => {
        const logo = m.logo.type === 'lucide'
            ? `<i data-lucide="${m.logo.name}"></i>`
            : `<img src="${m.logo.src}" alt="">`;
        const stat = summary[m.id] || '';
        const photo = window.LandingPhotos && LandingPhotos.get(LANDING_MODULE_PHOTOS[m.id]);
        // La tarjeta entera es un enlace: el crédito va en texto plano (los
        // enlaces a fuente y licencia están en el footer).
        const figure = photo ? `
            <figure class="lp-module-photo">
                <img src="${LandingPhotos.cardSrc(LANDING_MODULE_PHOTOS[m.id])}"
                    srcset="${LandingPhotos.cardSrcset(LANDING_MODULE_PHOTOS[m.id])}"
                    sizes="${LANDING_CARD_SIZES}" alt="" loading="lazy" decoding="async">
                <figcaption>${LandingPhotos.creditText(LANDING_MODULE_PHOTOS[m.id])}</figcaption>
            </figure>` : '';
        return `
        <a class="lp-module lp-glass lp-reveal" href="${m.file}" style="--lp-reveal-delay:${(i % 3) * 80}ms">
            ${figure}
            <div class="lp-module-head">
                <span class="lp-module-logo">${logo}</span>
                <span class="lp-module-name">${m.label}</span>
            </div>
            <p>${LANDING_MODULE_INFO[m.id] || ''}</p>
            <div class="lp-module-foot">
                <span class="lp-module-stat">${stat}</span>
                <span class="lp-module-go">Abrir <i data-lucide="arrow-right" class="icon-13"></i></span>
            </div>
        </a>`;
    }).join('');
}

function renderAuthors() {
    const grid = document.getElementById('lp-authors');
    if (grid) {
        grid.innerHTML = LANDING_AUTHORS.map((a, i) => `
        <article class="lp-author lp-glass lp-reveal" style="--lp-reveal-delay:${i * 90}ms">
            <span class="lp-author-avatar" aria-hidden="true">${landingInitials(a.name)}</span>
            <div class="lp-author-body">
                <h3 class="lp-author-name">${a.name}</h3>
                <div class="lp-author-role">${a.role} · ${LANDING_AFFILIATION}</div>
                <a class="lp-author-mail" href="mailto:${a.email}" title="Enviar correo a ${a.name}">
                    <i data-lucide="mail" class="icon-13"></i>${a.email}
                </a>
            </div>
        </article>`).join('');
    }
}

// Franja de portada, foto de autores y créditos fotográficos del footer.
function renderPhotos() {
    if (!window.LandingPhotos) return;
    const band = document.getElementById('lp-band-img');
    const bandPhoto = LandingPhotos.get(LANDING_BAND_PHOTO);
    if (band && bandPhoto) {
        band.src = bandPhoto.src;
        band.alt = bandPhoto.alt;
        document.getElementById('lp-band-credit').innerHTML = LandingPhotos.creditHtml(LANDING_BAND_PHOTO);
    }
    const authors = document.getElementById('lp-authors-photo');
    const authorsPhoto = LandingPhotos.get(LANDING_AUTHORS_PHOTO);
    if (authors && authorsPhoto) authors.style.backgroundImage = `url("${authorsPhoto.src}")`;

    const list = document.getElementById('lp-photo-credits');
    if (list) {
        list.innerHTML = Object.keys(LandingPhotos.PHOTOS)
            .map(k => `<li><span>${LandingPhotos.get(k).alt}</span> · ${LandingPhotos.creditHtml(k).replace('Foto: ', '')}</li>`)
            .join('');
    }
}

// Parallax suave de la franja de portada (desactivado con movimiento reducido).
function wireBandParallax() {
    const band = document.getElementById('lp-band');
    const img = document.getElementById('lp-band-img');
    if (!band || !img) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let ticking = false;
    const update = () => {
        ticking = false;
        const r = band.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        // -1 (entrando por abajo) → 1 (saliendo por arriba)
        const p = (window.innerHeight / 2 - (r.top + r.height / 2)) / (window.innerHeight / 2 + r.height / 2);
        img.style.transform = `translate3d(0, ${(p * 8).toFixed(2)}%, 0) scale(1.18)`;
    };
    window.addEventListener('scroll', () => {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
}

function wireHeader() {
    const header = document.getElementById('lp-header');
    const toggle = document.getElementById('lp-menu-toggle');
    const tabs = Array.from(document.querySelectorAll('.lp-tab'));

    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const closeDrawer = () => {
        header.classList.remove('menu-open');
        toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !header.classList.contains('menu-open');
        header.classList.toggle('menu-open', open);
        toggle.setAttribute('aria-expanded', String(open));
    });
    tabs.forEach(t => t.addEventListener('click', closeDrawer));
    document.addEventListener('click', (e) => { if (!header.contains(e.target)) closeDrawer(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

    // Pestaña activa según la sección visible (banda central de la pantalla).
    const byId = new Map(tabs.map(t => [t.dataset.section, t]));
    const spy = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            tabs.forEach(t => t.classList.toggle('active', t === byId.get(entry.target.id)));
        });
    }, { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((_, id) => {
        const section = document.getElementById(id);
        if (section) spy.observe(section);
    });
}

function wireReveal() {
    const els = document.querySelectorAll('.lp-reveal');
    if (!('IntersectionObserver' in window)) {
        els.forEach(el => el.classList.add('is-visible'));
        return;
    }
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
        });
    }, { threshold: 0.12 });
    els.forEach(el => io.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
    Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
    Chart.defaults.color = '#334155';

    const summary = LandingSlides.summary();
    LandingArt.init(summary.art);
    renderModules(summary);
    renderAuthors();
    renderPhotos();
    LandingCarousel.init(LandingSlides.build());

    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();

    wireHeader();
    wireReveal();
    wireBandParallax();
});
