// ─── static/js/common/photo-viewer.js ────────────────────────────────────────
// Fotos de referencia de las fichas de proyecto (DGC y MOP): carrusel dentro de
// la ficha (flechas, contador, nombre de la infraestructura, aviso de IA y
// deslizamiento táctil) y visor a tamaño completo al hacer clic (Esc, ←/→).
// Estilos: clases .catlec-photo-* de styles.css.
//
// Foto: { src, full?, label? } (src = versión de ficha; full = versión del visor,
// si falta se usa src; label = nombre de la infraestructura, opcional).
//
// Uso:
//   body.innerHTML = `... ${CatlecPhotoViewer.html(photos, titulo)} ...`;
//   CatlecPhotoViewer.setup(body.querySelector('.catlec-photo-carousel'), photos, titulo);
window.CatlecPhotoViewer = (function () {
    const AI_NOTE = 'Imagen de referencia generada por IA';
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const createIcons = () => { if (typeof lucide !== 'undefined') lucide.createIcons(); };

    // Texto alternativo: nombre del proyecto y, si la hay, su infraestructura
    function photoAlt(title, photo) {
        return photo && photo.label ? `${title} — ${photo.label}` : (title || '');
    }

    const validPhotos = (photos) => (photos || []).filter(p => p && p.src);

    // Marcado del carrusel ('' si no hay fotos)
    function html(photos, title) {
        const list = validPhotos(photos);
        if (!list.length) return '';
        const first = list[0];
        return `
            <div class="detail-photo-wrapper catlec-photo-carousel">
                ${list.map((p, i) => `
                    <img src="${encodeURI(p.src)}" alt="${esc(photoAlt(title, p))}" class="detail-project-photo catlec-photo-zoomable catlec-photo-slide${i === 0 ? ' active' : ''}" title="Ver imagen completa" loading="eager" draggable="false">
                `).join('')}
                <button type="button" class="catlec-photo-nav catlec-photo-nav--prev" title="Foto anterior" aria-label="Foto anterior"><i data-lucide="chevron-left"></i></button>
                <button type="button" class="catlec-photo-nav catlec-photo-nav--next" title="Foto siguiente" aria-label="Foto siguiente"><i data-lucide="chevron-right"></i></button>
                <span class="catlec-photo-counter">1 / ${list.length}</span>
                <div class="catlec-photo-overlay">
                    <span class="catlec-photo-label"${first.label ? '' : ' hidden'}>${esc(first.label)}</span>
                    <span class="catlec-photo-ai-note">${AI_NOTE}</span>
                </div>
            </div>
        `;
    }

    // Deslizamiento táctil horizontal (> 40 px) sobre `el` para cambiar de foto.
    // Devuelve una función que indica si el último toque fue un deslizamiento,
    // para que el clic que lo sigue no abra ni cierre el visor.
    function bindSwipe(el, step) {
        let startX = null;
        let swiped = false;
        el.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') return;
            startX = e.clientX;
            swiped = false;
        });
        el.addEventListener('pointerup', (e) => {
            if (startX === null) return;
            const dx = e.clientX - startX;
            startX = null;
            if (Math.abs(dx) > 40) {
                swiped = true;
                step(dx < 0 ? 1 : -1);
            }
        });
        el.addEventListener('pointercancel', () => { startX = null; });
        return () => {
            const wasSwipe = swiped;
            swiped = false;
            return wasSwipe;
        };
    }

    // Activa el carrusel creado con html(). Con una sola foto los controles
    // quedan ocultos (CSS). Una foto que no carga se quita; si no queda
    // ninguna, se quita el carrusel.
    function setup(wrapper, photos, title) {
        if (!wrapper) return;
        const list = validPhotos(photos).slice();
        const slides = Array.from(wrapper.querySelectorAll('.catlec-photo-slide'));
        const counter = wrapper.querySelector('.catlec-photo-counter');
        const labelEl = wrapper.querySelector('.catlec-photo-label');
        let index = 0;

        const show = (i) => {
            index = (i + slides.length) % slides.length;
            slides.forEach((s, k) => s.classList.toggle('active', k === index));
            counter.textContent = `${index + 1} / ${slides.length}`;
            labelEl.textContent = list[index].label || '';
            labelEl.hidden = !list[index].label;
        };
        const refreshControls = () => wrapper.classList.toggle('catlec-photo-carousel--multi', slides.length > 1);

        slides.forEach(img => img.addEventListener('error', () => {
            const k = slides.indexOf(img);
            if (k < 0) return;
            slides.splice(k, 1);
            list.splice(k, 1);
            img.remove();
            if (!slides.length) {
                wrapper.remove();
                return;
            }
            if (k < index) index--;
            refreshControls();
            show(Math.min(index, slides.length - 1));
        }));

        wrapper.querySelector('.catlec-photo-nav--prev').addEventListener('click', () => show(index - 1));
        wrapper.querySelector('.catlec-photo-nav--next').addEventListener('click', () => show(index + 1));
        const consumeSwipe = bindSwipe(wrapper, (dir) => { if (slides.length > 1) show(index + dir); });
        wrapper.addEventListener('click', (e) => {
            if (consumeSwipe()) return;
            if (e.target.closest('.catlec-photo-slide.active')) open(list, index, title);
        });

        refreshControls();
    }

    // ─── Visor a tamaño completo (se crea una sola vez) ─────────────────────
    let lightbox = null;
    let releaseTimer = null;
    let lbPhotos = [];
    let lbIndex = 0;
    let lbTitle = '';

    function showLightboxPhoto(i) {
        const n = lbPhotos.length;
        lbIndex = (i + n) % n;
        const photo = lbPhotos[lbIndex];
        const img = lightbox.querySelector('.catlec-photo-lightbox-img');
        img.src = encodeURI(photo.full || photo.src);
        img.alt = photoAlt(lbTitle, photo);
        lightbox.querySelector('.catlec-photo-counter').textContent = `${lbIndex + 1} / ${n}`;
        const labelEl = lightbox.querySelector('.catlec-photo-label');
        labelEl.textContent = photo.label || '';
        labelEl.hidden = !photo.label;
    }

    function step(dir) {
        if (lbPhotos.length > 1) showLightboxPhoto(lbIndex + dir);
    }

    function createLightbox() {
        lightbox = document.createElement('div');
        lightbox.className = 'catlec-photo-lightbox';
        lightbox.setAttribute('role', 'dialog');
        lightbox.setAttribute('aria-modal', 'true');
        lightbox.innerHTML = `
            <button type="button" class="catlec-photo-lightbox-btn catlec-photo-lightbox-close" title="Cerrar (Esc)" aria-label="Cerrar">
                <i data-lucide="x"></i>
            </button>
            <button type="button" class="catlec-photo-lightbox-btn catlec-photo-lightbox-nav catlec-photo-lightbox-nav--prev" title="Foto anterior (←)" aria-label="Foto anterior">
                <i data-lucide="chevron-left"></i>
            </button>
            <button type="button" class="catlec-photo-lightbox-btn catlec-photo-lightbox-nav catlec-photo-lightbox-nav--next" title="Foto siguiente (→)" aria-label="Foto siguiente">
                <i data-lucide="chevron-right"></i>
            </button>
            <figure class="catlec-photo-lightbox-figure">
                <img class="catlec-photo-lightbox-img" alt="">
                <span class="catlec-photo-counter"></span>
                <div class="catlec-photo-overlay">
                    <span class="catlec-photo-label" hidden></span>
                    <span class="catlec-photo-ai-note">${AI_NOTE}</span>
                </div>
            </figure>
        `;
        document.body.appendChild(lightbox);

        const consumeSwipe = bindSwipe(lightbox, step);
        lightbox.addEventListener('click', (e) => {
            if (consumeSwipe()) return;
            const nav = e.target.closest('.catlec-photo-lightbox-nav');
            if (nav) step(nav.classList.contains('catlec-photo-lightbox-nav--prev') ? -1 : 1);
            else if (!e.target.closest('.catlec-photo-lightbox-img')) close();
        });
        document.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('open')) return;
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowLeft') step(-1);
            else if (e.key === 'ArrowRight') step(1);
        });
        createIcons();
    }

    function open(photos, startIndex, title) {
        const list = validPhotos(photos);
        if (!list.length) return;
        if (releaseTimer) {
            clearTimeout(releaseTimer);
            releaseTimer = null;
        }
        if (!lightbox) createLightbox();
        lbPhotos = list;
        lbTitle = title || '';
        lightbox.classList.toggle('catlec-photo-lightbox--multi', list.length > 1);
        showLightboxPhoto(startIndex || 0);
        lightbox.classList.add('open');
    }

    function close() {
        if (!lightbox || !lightbox.classList.contains('open')) return;
        lightbox.classList.remove('open');
        // Suelta la foto (y su versión decodificada) al terminar el fundido de
        // cierre (0,2 s en styles.css); open() cancela el temporizador si el
        // visor se vuelve a abrir entretanto.
        releaseTimer = setTimeout(() => {
            releaseTimer = null;
            lightbox.querySelector('.catlec-photo-lightbox-img').removeAttribute('src');
        }, 250);
    }

    return { html, setup, open, close, AI_NOTE };
})();
