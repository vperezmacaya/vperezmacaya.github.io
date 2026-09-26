// ─── static/js/Landing/main.js ───────────────────────────────────────────────
// Arranque del landing del Observatorio CATLEC (index.html): hero, franja de
// portada con los objetivos en versión compacta, módulos del Observatorio
// (lista de módulos con el panel de cifras de cada uno, LandingCarousel.init)
// y proyectos destacados (LandingFeatured). El header, las apariciones al
// hacer scroll, los objetivos y los créditos fotográficos vienen de
// LandingCommon (common.js), compartido con acerca.html.

// Foto de la franja de portada (static/js/Landing/photos.js)
const LANDING_BAND_PHOTO = 'santiago-skyline';

function renderBand() {
    if (!window.LandingPhotos) return;
    const band = document.getElementById('lp-band-img');
    const bandPhoto = LandingPhotos.get(LANDING_BAND_PHOTO);
    if (band && bandPhoto) {
        band.src = bandPhoto.src;
        band.alt = bandPhoto.alt;
        document.getElementById('lp-band-credit').innerHTML = LandingPhotos.creditHtml(LANDING_BAND_PHOTO);
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

document.addEventListener('DOMContentLoaded', () => {
    Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
    Chart.defaults.color = '#334155';

    LandingArt.init(LandingSlides.summary().art);
    LandingCommon.renderObjectivesCompact();
    renderBand();
    LandingCommon.renderPhotoCredits();
    LandingCarousel.init(LandingSlides.build());
    LandingFeatured.init();

    LandingCommon.createIcons();
    LandingCommon.wireHeader();
    LandingCommon.wireReveal();
    wireBandParallax();
});
