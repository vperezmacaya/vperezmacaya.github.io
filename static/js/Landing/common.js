// ─── static/js/Landing/common.js ─────────────────────────────────────────────
// Piezas compartidas por las páginas del Observatorio: el landing (index.html,
// arranque en main.js) y "Acerca del Observatorio" (acerca.html, arranque en
// about.js). Contenido (objetivos, autores) y comportamiento del header, de las
// apariciones al hacer scroll y de los créditos fotográficos del footer.
window.LandingCommon = (function () {
    // Autores (los mismos del "Acerca de" de cada módulo).
    const AUTHORS = [
        { name: 'José Oliveros', role: 'Equipo desarrollador', email: 'joseoliveros@udec.cl' },
        { name: 'Vicente Pérez', role: 'Ingeniero Civil Industrial', email: 'vicperez2021@udec.cl' },
    ];
    const AFFILIATION = 'Departamento de Ingeniería Industrial, Facultad de Ingeniería, Universidad de Concepción';

    // Objetivos del Observatorio: icono Lucide, título, descripción completa
    // (acerca.html) y una línea corta (franja de portada del landing).
    const OBJECTIVES = [
        {
            icon: 'combine', title: 'Integrar', short: 'Fuentes oficiales dispersas en bases comparables',
            text: 'Consolidar fuentes oficiales dispersas (DGC, SNI, MOP, EFE, Metro e INE) en bases limpias, comparables y actualizables.'
        },
        {
            icon: 'map', title: 'Visualizar', short: 'Cada proyecto en el mapa y en el tiempo',
            text: 'Llevar cada proyecto al mapa y a la línea de tiempo: dónde está, en qué etapa va y cuándo entra en operación.'
        },
        {
            icon: 'chart-no-axes-combined', title: 'Analizar', short: 'Inversión, plazos, competencia y demanda',
            text: 'Medir la evolución de la inversión, los plazos de tramitación, la competencia entre oferentes y la demanda de los sistemas de transporte.'
        },
        {
            icon: 'eye', title: 'Transparentar', short: 'Datos abiertos para decidir con evidencia',
            text: 'Ofrecer acceso abierto y exportable a la academia, al sector público y a la ciudadanía para apoyar decisiones basadas en evidencia.'
        },
    ];

    // Foto de fondo de la sección de autores (static/js/Landing/photos.js)
    const AUTHORS_PHOTO = 'udec-campanil';

    const initials = (name) => name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

    function renderObjectives(id = 'lp-objectives') {
        const grid = document.getElementById(id);
        if (!grid) return;
        grid.innerHTML = OBJECTIVES.map((o, i) => `
        <article class="lp-objective lp-glass lp-reveal" style="--lp-reveal-delay:${i * 80}ms">
            <div class="lp-objective-top">
                <span class="lp-objective-num">${String(i + 1).padStart(2, '0')}</span>
                <span class="lp-objective-icon"><i data-lucide="${o.icon}"></i></span>
            </div>
            <h3>${o.title}</h3>
            <p>${o.text}</p>
        </article>`).join('');
    }

    // Versión compacta para la franja de portada del landing: ícono, título y
    // una línea por objetivo (los completos están en acerca.html).
    function renderObjectivesCompact(id = 'lp-band-objectives') {
        const row = document.getElementById(id);
        if (!row) return;
        row.innerHTML = OBJECTIVES.map((o, i) => `
        <li class="lp-band-objective lp-reveal" style="--lp-reveal-delay:${120 + i * 80}ms">
            <span class="lp-band-objective-icon" aria-hidden="true"><i data-lucide="${o.icon}"></i></span>
            <span><strong>${o.title}</strong>${o.short}</span>
        </li>`).join('');
    }

    function renderAuthors(id = 'lp-authors') {
        const grid = document.getElementById(id);
        if (!grid) return;
        grid.innerHTML = AUTHORS.map((a, i) => `
        <article class="lp-author lp-glass lp-reveal" style="--lp-reveal-delay:${i * 90}ms">
            <span class="lp-author-avatar" aria-hidden="true">${initials(a.name)}</span>
            <div class="lp-author-body">
                <h3 class="lp-author-name">${a.name}</h3>
                <div class="lp-author-role">${a.role} · ${AFFILIATION}</div>
                <a class="lp-author-mail" href="mailto:${a.email}" title="Enviar correo a ${a.name}">
                    <i data-lucide="mail" class="icon-13"></i>${a.email}
                </a>
            </div>
        </article>`).join('');

        const photoLayer = document.getElementById('lp-authors-photo');
        const photo = window.LandingPhotos && LandingPhotos.get(AUTHORS_PHOTO);
        if (photoLayer && photo) photoLayer.style.backgroundImage = `url("${photo.src}")`;
    }

    // Lista de créditos fotográficos del footer.
    function renderPhotoCredits() {
        const list = document.getElementById('lp-photo-credits');
        if (!list || !window.LandingPhotos) return;
        list.innerHTML = Object.keys(LandingPhotos.PHOTOS)
            .map(k => `<li><span>${LandingPhotos.get(k).alt}</span> · ${LandingPhotos.creditHtml(k).replace('Foto: ', '')}</li>`)
            .join('');
    }

    // Header: estado al hacer scroll, cajón móvil y pestaña activa según la
    // sección visible. Las pestañas sin sección en la página (enlaces a otra
    // página) conservan la clase .active que traigan del HTML.
    function wireHeader() {
        const header = document.getElementById('lp-header');
        const toggle = document.getElementById('lp-menu-toggle');
        if (!header || !toggle) return;
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
        const byId = new Map(tabs.filter(t => t.dataset.section && document.getElementById(t.dataset.section))
            .map(t => [t.dataset.section, t]));
        if (!byId.size) return;
        const spy = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                tabs.forEach(t => t.classList.toggle('active', t === byId.get(entry.target.id)));
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        byId.forEach((_, id) => spy.observe(document.getElementById(id)));
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

    function createIcons() {
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    }

    return { AUTHORS, AFFILIATION, OBJECTIVES, renderObjectives, renderObjectivesCompact, renderAuthors, renderPhotoCredits, wireHeader, wireReveal, createIcons };
})();
