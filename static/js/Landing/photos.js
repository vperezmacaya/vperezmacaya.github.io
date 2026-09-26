// ─── static/js/Landing/photos.js ─────────────────────────────────────────────
// Registro de las fotos del landing (static/img/landing/) con su autoría y
// licencia. Es la única fuente de los créditos: cada foto que se muestra en la
// página lleva su crédito y el footer lista todas con enlace a la licencia.
// Las marcadas con attribution: true (CC BY / CC BY-SA) exigen mostrar autor
// y licencia; al agregar una foto nueva, registrarla aquí con esos datos.
window.LandingPhotos = (function () {
    const PHOTOS = {
        'santiago-skyline': {
            src: 'static/img/landing/santiago-skyline.webp',
            alt: 'Skyline de Santiago al atardecer con la Gran Torre Costanera y los Andes',
            author: 'Pablo García Saldaña',
            license: 'CC0 1.0',
            licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
            source: 'https://commons.wikimedia.org/wiki/File:Skyline_of_Santiago,_Chile.jpg',
            attribution: false,
        },
        'costanera-norte': {
            src: 'static/img/landing/costanera-norte.webp',
            alt: 'Autopista Costanera Norte y el río Mapocho al anochecer',
            author: 'Chalo Gallardo',
            license: 'Unsplash License',
            licenseUrl: 'https://unsplash.com/license',
            source: 'https://unsplash.com/photos/eXL2DYVmq-0',
            attribution: false,
        },
        'valparaiso-puerto': {
            src: 'static/img/landing/valparaiso-puerto.webp',
            alt: 'Terminal de contenedores de Valparaíso con neblina',
            author: 'David Vives',
            license: 'Unsplash License',
            licenseUrl: 'https://unsplash.com/license',
            source: 'https://unsplash.com/photos/zLcV9nXr2y0',
            attribution: false,
        },
        'metro-santiago': {
            src: 'static/img/landing/metro-santiago.webp',
            alt: 'Tren del Metro de Santiago en trinchera abierta',
            author: 'Gustavo Sánchez',
            license: 'Unsplash License',
            licenseUrl: 'https://unsplash.com/license',
            source: 'https://unsplash.com/photos/OlwV34e81cY',
            attribution: false,
        },
        'embalse-el-yeso': {
            src: 'static/img/landing/embalse-el-yeso.webp',
            alt: 'Embalse El Yeso en la cordillera de los Andes',
            author: 'Pablo Acevedo',
            license: 'CC0 1.0',
            licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
            source: 'https://commons.wikimedia.org/wiki/File:El_Yeso_Dam,_Chile_(Unsplash).jpg',
            attribution: false,
        },
        'udec-campanil': {
            src: 'static/img/landing/udec-campanil.webp',
            alt: 'Campanil de la Universidad de Concepción',
            author: 'Yaguer',
            license: 'Unsplash License',
            licenseUrl: 'https://unsplash.com/license',
            source: 'https://unsplash.com/photos/qt3DK38MO2o',
            attribution: false,
        },
        'biotren-biobio': {
            src: 'static/img/landing/biotren-biobio.webp',
            alt: 'Biotrén cruzando el río Biobío en Concepción',
            author: 'Kabelleger / David Gubler',
            license: 'CC BY-SA 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
            source: 'https://commons.wikimedia.org/wiki/File:EFE_CM-112_Juan_Pablo_II_-_Concepci%C3%B3n.jpg',
            attribution: true,
        },
        'santiago-hora-azul': {
            src: 'static/img/landing/santiago-hora-azul.webp',
            alt: 'Santiago en la hora azul con la cordillera de fondo',
            author: 'Marco Nürnberger',
            license: 'CC BY 2.0',
            licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
            source: 'https://commons.wikimedia.org/wiki/File:Blue_hour_in_Santiago_de_Chile.jpg',
            attribution: true,
        },
    };

    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    // Crédito con enlaces a la fuente y a la licencia.
    function creditHtml(key) {
        const p = PHOTOS[key];
        if (!p) return '';
        return `Foto: <a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.author)}</a>`
            + ` · <a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener">${esc(p.license)}</a>`;
    }

    return { PHOTOS, get: (key) => PHOTOS[key] || null, creditHtml };
})();
