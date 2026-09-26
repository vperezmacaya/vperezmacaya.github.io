// ─── static/js/Landing/featured.js ───────────────────────────────────────────
// Sección "Proyectos destacados" del landing: un carrusel (LandingCarousel) con
// proyectos emblemáticos de DGC (concesiones con foto), Metro (líneas nuevas)
// y EFE (servicios ferroviarios nuevos), intercalando los tres módulos y, dentro
// de eso, por relevancia social (ver el orden en FEATURED).
//
// Cada diapositiva tiene un escenario en primer plano (la foto de la concesión,
// o el trazado SVG animado de LandingRouteArt, que se dibuja y luego muestra las
// estaciones como pines) y una ficha con dos KPI grandes (sin conteo: se
// muestran con su valor final). Las diapositivas cambian con un deslizamiento
// horizontal simple (slideTo). Las cifras se leen en vivo de STATIC_DATA,
// METRO_DATA y EFE_DATA; los trazados, de LANDING_ROUTES. Aquí solo se elige
// qué proyectos se muestran, en qué orden, y su título y frase.
window.LandingFeatured = (function () {
    const AUTOPLAY_MS = 9000;
    // Deslizamiento entre proyectos: pausado, con aceleración suave en ambos
    // extremos.
    const SLIDE_MS = 900;
    const SLIDE_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
    const PHOTO_ROTATE_MS = 3600;
    const EFE_COLOR = '#4f7c7a';
    // Créditos del mapa de referencia (Metro/EFE): una línea fija al pie de la
    // ficha, junto a la fuente, en vez del botón "i" sobre el mapa.
    const MAP_CREDIT = 'Mapa base: &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
        + ' &middot; &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

    // Orden: la Línea 7 abre y el resto de Metro se intercala con proyectos de
    // EFE y DGC, para no concentrar Metro al principio; dentro de eso, primero
    // lo de mayor alcance social. module: 'metro' | 'efe' | 'dgc'.
    // ids (Metro/EFE): proyectos que se dibujan juntos, como un solo trazado.
    // Si un proyecto falta en los datos, se omite.
    const FEATURED = [
        { module: 'metro', ids: ['METRO-01'], title: 'Línea 7' },
        {
            module: 'efe', ids: ['P-1'], title: 'Tren Santiago – Melipilla',
            phrase: 'Once estaciones en 61 km unirán Melipilla, Talagante y Padre Hurtado con Estación Central, con ahorros de hasta dos horas diarias de viaje.'
        },
        {
            module: 'dgc', id: '082_AAMB2', title: 'Aeropuerto Arturo Merino Benítez',
            phrase: 'Nuevo terminal internacional de unos 249.500 m² y remodelación del terminal existente, que queda para vuelos nacionales, en el principal aeropuerto del país.'
        },
        { module: 'metro', ids: ['METRO-04', 'METRO-06'], title: 'Línea 9' },
        {
            module: 'efe', ids: ['P-2'], title: 'Tren Santiago – Batuco',
            phrase: 'Nuevo tren de cercanía para el norponiente de la Región Metropolitana: Quinta Normal, Renca, Quilicura, Lampa y Colina hasta Batuco.'
        },
        {
            module: 'dgc', id: 'XXX_TAHI1', title: 'Teleférico Alto Hospicio – Iquique',
            phrase: 'Teleférico de 5,7 km entre Alto Hospicio e Iquique: transporte público no contaminante para hasta 2.000 pasajeros por hora y sentido.'
        },
        { module: 'metro', ids: ['METRO-05'], title: 'Línea 8' },
        {
            module: 'efe', ids: ['P-9'], title: 'Metro Valparaíso a La Calera',
            phrase: 'Extiende el Metro Valparaíso desde Limache hacia Quillota, La Cruz y La Calera, con 26 km de doble vía exclusiva para pasajeros.'
        },
        {
            module: 'dgc', id: '122_NARA2', title: 'Aeropuerto de La Araucanía',
            phrase: 'Ampliación y renovación de la infraestructura, el equipamiento y las instalaciones del aeropuerto regional de La Araucanía.'
        },
        { module: 'metro', ids: ['METRO-07'], title: 'Línea A' },
        {
            module: 'dgc', id: '125_ARNO1', title: 'Red Aeroportuaria Norte',
            phrase: 'Primera concesión en red: amplía y renueva los aeropuertos Andrés Sabella y Desierto de Atacama, en Antofagasta y Atacama.'
        },
    ];

    const fmt = (n, d = 0) => Number(n).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
    const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));
    const yearOf = (v) => { const m = String(v || '').match(/(19|20)\d{2}/); return m ? Number(m[0]) : null; };
    const dash = (s) => String(s || '').replace(/\s+-\s+/g, ' – ');
    const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;

    const kpi = (label, { prefix = '', value, unit = '' }) => ({ label, prefix, value, unit });
    const yearKpi = (label, year) => kpi(label, { value: String(year) });

    function ufKpi(label, uf) {
        const m = uf / 1e6;
        return kpi(label, { value: fmt(m, m < 10 ? 2 : 1), unit: 'M UF' });
    }

    const usdKpi = (label, mm) => kpi(label, { prefix: 'US$', value: fmt(mm), unit: 'MM' });

    function mergeStations(routes) {
        const seen = new Set();
        const out = [];
        routes.forEach(r => (r.stations || []).forEach(st => {
            if (seen.has(st.name)) return;
            seen.add(st.name);
            out.push(Object.assign({}, st));
        }));
        out.forEach((st, i) => { st.terminal = i === 0 || i === out.length - 1; });
        return out;
    }

    // ─── Metro ──────────────────────────────────────────────────────────────
    function metroSlide(cfg) {
        const D = window.METRO_DATA, R = window.LANDING_ROUTES;
        if (!D || !R) return null;
        const projects = cfg.ids.map(id => D.data.find(p => p.id === id)).filter(Boolean);
        const routes = projects.map(p => R.metro[p.id]).filter(Boolean);
        if (!projects.length || !routes.length) return null;
        const main = projects[0];

        const invest = projects.reduce((a, p) => a + (num(p.investment_mm_usd) || 0), 0);
        const benefited = num(main.benefited_population);

        const kpis = [usdKpi('Inversión estimada', invest)];
        if (benefited) kpis.push(kpi('Población beneficiada', { value: fmt(benefited / 1e6, 1), unit: 'M hab.' }));

        return {
            key: `metro-${main.id}`,
            module: 'metro',
            title: cfg.title,
            phrase: main.travel_time ? `Tiempo de viaje: ${main.travel_time}.` : '',
            kpis,
            link: 'Metro.html',
            source: 'Fuente: Metro de Santiago, Memoria 2025.',
            stage: {
                type: 'route',
                context: ['metro', 'efe'],
                color: main.color_hex || '#3d5a80',
                segments: projects.map(p => ({ paths: (R.metro[p.id] || {}).paths || [] })),
                stations: mergeStations(routes),
            },
        };
    }

    // ─── EFE ────────────────────────────────────────────────────────────────
    function efeSlide(cfg) {
        const D = window.EFE_DATA, R = window.LANDING_ROUTES;
        if (!D || !R) return null;
        const projects = cfg.ids.map(id => D.data.find(p => p.id === id)).filter(Boolean);
        const routes = projects.map(p => R.efe[p.id]).filter(Boolean);
        if (!projects.length || !routes.length) return null;
        const main = projects[0];

        const invest = projects.reduce((a, p) => a + (num(p.investment_mm_usd) || 0), 0);
        const year = yearOf(main.operation_year);
        const stations = mergeStations(routes);

        const kpis = [usdKpi('Inversión estimada', invest)];
        if (year) kpis.push(yearKpi('Inicio de operación', year));

        return {
            key: `efe-${main.id}`,
            module: 'efe',
            title: cfg.title,
            phrase: cfg.phrase || '',
            kpis,
            link: 'EFE.html',
            source: `Fuente: Empresa de los Ferrocarriles del Estado, ${main.source || 'Memoria'}.`,
            stage: {
                type: 'route',
                context: ['efe', 'metro'],
                color: EFE_COLOR,
                segments: projects.map(p => ({ paths: (R.efe[p.id] || {}).paths || [] })),
                stations,
            },
        };
    }

    // ─── DGC ────────────────────────────────────────────────────────────────
    function dgcSlide(cfg) {
        const S = window.STATIC_DATA;
        if (!S || !S.data) return null;
        const r = S.data.find(x => x['Código proyecto'] === cfg.id);
        const photos = r && (r.photos || []).filter(p => p && p.src);
        if (!r || !photos.length) return null;

        const built = num(r['Inversión Materializada estimada']);
        const budget = num(r['Presupuesto oficial estimado']);
        const start = yearOf(r['Fecha inicio del contrato de concesión']);
        const call = yearOf(r['Fecha llamado a licitación']);

        const kpis = [];
        if (built) kpis.push(ufKpi('Inversión materializada estimada', built));
        else if (budget) kpis.push(ufKpi('Presupuesto oficial estimado', budget));
        if (start) kpis.push(yearKpi('Inicio de la concesión', start));
        else if (call) kpis.push(yearKpi('Llamado a licitación', call));

        return {
            key: `dgc-${cfg.id}`,
            module: 'dgc',
            title: cfg.title || dash(String(r['Nombre de la Concesión '] || '').trim()),
            phrase: cfg.phrase || '',
            kpis,
            link: 'DGC.html',
            source: 'Fuente: Dirección General de Concesiones (MOP).',
            stage: { type: 'photo', photos },
        };
    }

    const BUILDERS = { metro: metroSlide, efe: efeSlide, dgc: dgcSlide };

    function build() {
        return FEATURED.map(cfg => {
            try { return BUILDERS[cfg.module](cfg); } catch (err) { console.warn('[Landing] destacado omitido:', err); return null; }
        }).filter(Boolean);
    }

    // ─── Marcado ────────────────────────────────────────────────────────────
    function routeSvg(s, size = {}) {
        return LandingRouteArt.build({
            uid: `lp-rt-${s.key}`,
            label: `Trazado de ${s.title}${s.stage.stations.length ? ` con ${plural(s.stage.stations.length, 'estación', 'estaciones')}` : ''}`,
            width: size.width,
            height: size.height,
            padRight: size.padRight,
            segments: s.stage.segments,
            stations: s.stage.stations,
            context: s.stage.context,
        });
    }

    function stageHtml(s) {
        if (s.stage.type === 'photo') {
            const photos = s.stage.photos;
            return `
            <div class="lp-feature-stage lp-feature-stage--photo">
                ${photos.map((p, i) => `
                <figure class="lp-feature-photo${i === 0 ? ' is-shown' : ''}">
                    <img data-src="${encodeURI(p.src)}" alt="${s.title}${p.label ? ' — ' + p.label : ''}" decoding="async">
                    ${p.label ? `<figcaption>${p.label}</figcaption>` : ''}
                </figure>`).join('')}
                <span class="lp-feature-ai-note">Imagen de referencia generada por IA</span>
            </div>`;
        }
        return `
        <div class="lp-feature-stage lp-feature-stage--route" style="--route-color:${s.stage.color}">
            <div class="lp-feature-map">
                <div class="lp-feature-basemap" aria-hidden="true"></div>
                <div class="lp-feature-route">${routeSvg(s)}</div>
            </div>
        </div>`;
    }

    function slideHtml(s, i, total) {
        return `
        <article class="lp-slide lp-feature" id="lp-feature-${s.key}" role="group" aria-roledescription="diapositiva"
            aria-label="${i + 1} de ${total}: ${s.title}" style="--slide-accent:#3d5a80">
            ${stageHtml(s)}
            <div class="lp-feature-info">
                ${LandingCarousel.modulePillHtml(s.module)}
                <div class="lp-feature-body">
                <h3 class="lp-feature-title">${s.title}</h3>
                ${s.phrase ? `<p class="lp-feature-phrase">${s.phrase}</p>` : ''}
                <div class="lp-feature-kpis">
                    ${s.kpis.map(k => `
                    <div class="lp-feature-kpi">
                        <span class="lp-feature-kpi-label">${k.label}</span>
                        <div class="lp-big lp-big--feature">
                            ${k.prefix ? `<span class="lp-big-prefix">${k.prefix}</span>` : ''}
                            <span class="lp-big-num">${k.value}</span>
                            ${k.unit ? `<span class="lp-big-unit">${k.unit}</span>` : ''}
                        </div>
                    </div>`).join('')}
                </div>
                </div>
                <div class="lp-feature-foot">
                    <a class="lp-slide-link" href="${s.link}">Ver en el módulo <i data-lucide="arrow-right" class="icon-13"></i></a>
                    <span class="lp-slide-source">${s.source}${s.stage.type === 'route' ? `<br>${MAP_CREDIT}` : ''}</span>
                </div>
            </div>
        </article>`;
    }

    // ─── Activación ─────────────────────────────────────────────────────────
    const rotations = new WeakMap();

    function loadPhotos(el) {
        if (!el) return;
        el.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
    }

    // Con varias fotos (una concesión con varias infraestructuras), alterna
    // entre ellas con un fundido mientras la diapositiva está activa.
    function startRotation(el) {
        const figs = Array.from(el.querySelectorAll('.lp-feature-photo'));
        if (figs.length < 2 || LandingCarousel.reduceMotion()) return;
        let k = 0;
        rotations.set(el, setInterval(() => {
            figs[k].classList.remove('is-shown');
            k = (k + 1) % figs.length;
            figs[k].classList.add('is-shown');
        }, PHOTO_ROTATE_MS));
    }

    function stopRotation(el) {
        clearInterval(rotations.get(el));
        rotations.delete(el);
        const figs = el.querySelectorAll('.lp-feature-photo');
        figs.forEach((f, i) => f.classList.toggle('is-shown', i === 0));
    }

    // Redibuja el trazado con el tamaño real de su escenario (cambia con el
    // ancho de pantalla), dejando libre la parte que tape la ficha si va
    // superpuesta, y mueve el mapa de referencia a la misma cámara.
    // Devuelve el SVG vigente.
    function fitRoute(el, s) {
        const map = el.querySelector('.lp-feature-map');
        if (!map || s.stage.type !== 'route') return null;
        const layer = map.querySelector('.lp-feature-route');
        let svg = layer.querySelector('.lp-route');
        const box = map.getBoundingClientRect();
        if (!box.width || !box.height) return svg;
        const info = el.querySelector('.lp-feature-info').getBoundingClientRect();
        const overlaps = info.top < box.bottom && info.bottom > box.top && info.left > box.left && info.left < box.right;
        const size = {
            width: Math.round(box.width),
            height: Math.round(box.height),
            padRight: overlaps ? Math.round(box.right - info.left) : 0,
        };
        const same = svg && Math.abs(Number(svg.dataset.w) - size.width) <= 2
            && Math.abs(Number(svg.dataset.h) - size.height) <= 2
            && Math.abs(Number(svg.dataset.pad) - size.padRight) <= 2;
        if (!same) {
            layer.innerHTML = routeSvg(s, size);
            svg = layer.querySelector('.lp-route');
        }
        syncBasemap(el, svg);
        return svg;
    }

    // ─── Mapa de referencia (MapLibre, CARTO Positron) ──────────────────────
    // Un mapa sin interacción bajo el trazado de la diapositiva activa, con la
    // cámara que calza con la proyección del SVG. Se crea al activar la
    // diapositiva y se elimina al salir (a lo más dos a la vez, durante el
    // fundido), para no acumular contextos WebGL. Sin MapLibre o sin WebGL,
    // el trazado queda sobre el papel milimetrado.
    const basemaps = new Map();

    function syncBasemap(el, svg) {
        const host = el.querySelector('.lp-feature-basemap');
        if (!host || !svg || !window.maplibregl || !window.CatlecMapGL) return;
        const cam = LandingRouteArt.camera(svg);
        const current = basemaps.get(el);
        if (current) {
            current.resize();
            current.jumpTo(cam);
            return;
        }
        try {
            const map = CatlecMapGL.createStaticMap(host, Object.assign({ attribution: false }, cam));
            map.once('idle', () => host.classList.add('is-ready'));
            basemaps.set(el, map);
        } catch (err) {
            console.warn('[Landing] mapa de referencia no disponible:', err);
        }
    }

    function removeBasemap(el) {
        const map = basemaps.get(el);
        if (!map) return;
        map.remove();
        basemaps.delete(el);
        const host = el.querySelector('.lp-feature-basemap');
        if (host) {
            host.classList.remove('is-ready');
            host.innerHTML = '';
        }
    }

    // Deslizamiento horizontal: la saliente sale hacia un lado mientras la
    // entrante llega desde el otro (dir = 1 avanza hacia la izquierda). La
    // saliente sigue visible (.is-leaving) hasta que termina de salir.
    function slideTo(prevEl, nextEl, dir) {
        if (LandingCarousel.reduceMotion() || typeof nextEl.animate !== 'function') return;
        const opts = { duration: SLIDE_MS, easing: SLIDE_EASE };
        prevEl.getAnimations().forEach(a => a.cancel());
        nextEl.getAnimations().forEach(a => a.cancel());
        prevEl.classList.add('is-leaving');
        const out = prevEl.animate([
            { transform: 'translateX(0)' },
            { transform: `translateX(${-100 * dir}%)` }
        ], opts);
        nextEl.animate([
            { transform: `translateX(${100 * dir}%)` },
            { transform: 'translateX(0)' }
        ], opts);
        const done = () => prevEl.classList.remove('is-leaving');
        out.onfinish = done;
        out.oncancel = done;
    }

    function init() {
        const root = document.getElementById('lp-featured');
        if (!root || !window.LandingRouteArt) return;
        const slides = build();
        if (!slides.length) {
            const section = document.getElementById('destacados');
            if (section) section.hidden = true;
            return;
        }

        const carousel = LandingCarousel.create(root, {
            slides,
            renderSlide: slideHtml,
            dotLabel: (s) => s.title,
            autoplayMs: AUTOPLAY_MS,
            animate: slideTo,
            deactivateDelay: SLIDE_MS + 50,
            onActivate(el, s, i) {
                loadPhotos(el);
                loadPhotos(carousel.slideEls[(i + 1) % slides.length]); // precarga la siguiente
                LandingRouteArt.play(fitRoute(el, s));
                startRotation(el);
            },
            onDeactivate(el, s) {
                LandingRouteArt.reset(el.querySelector('.lp-route'));
                removeBasemap(el);
                stopRotation(el);
            },
        });
        if (!carousel) return;

        // Al cambiar el ancho, la diapositiva activa se reajusta ya dibujada (sin
        // repetir la animación); las demás se reajustan al activarse.
        window.addEventListener('resize', CatlecUtils.debounce(() => {
            const i = carousel.current;
            if (i < 0) return;
            const el = carousel.slideEls[i];
            const before = el.querySelector('.lp-route');
            const svg = fitRoute(el, slides[i]);
            if (svg && svg !== before) svg.classList.add('is-drawn');
        }, 150));
    }

    return { init, build };
})();
