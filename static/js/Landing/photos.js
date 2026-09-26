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
        'santiago-autopistas-bn': {
            src: 'static/img/landing/santiago-autopistas-bn.webp',
            alt: 'Vista aérea en blanco y negro de las autopistas de Santiago',
            author: 'Camila Garcia Moreira',
            license: 'Pexels License',
            licenseUrl: 'https://www.pexels.com/license/',
            source: 'https://www.pexels.com/photo/roads-in-modern-city-in-mountains-landscape-17056276/',
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
        'efe-tren-bmu': {
            src: 'static/img/landing/efe-tren-bmu.webp',
            alt: 'Tren BMU del servicio Santiago–Chillán en Estación Central',
            author: 'TomasVial',
            license: 'CC0 1.0',
            licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
            source: 'https://commons.wikimedia.org/wiki/File:Tren_BMU_en_Estaci%C3%B3n_Central_de_Santiago.jpg',
            attribution: false,
        },
        'metro-l7-obras': {
            src: 'static/img/landing/metro-l7-obras.webp',
            alt: 'Faena de construcción de la Línea 7 del Metro de Santiago',
            author: 'TomasVial',
            license: 'CC0 1.0',
            licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
            source: 'https://commons.wikimedia.org/wiki/File:Dique_de_construcci%C3%B3n_de_L%C3%ADnea_7_del_Metro_de_Santiago,_Chile.jpg',
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
        'puente-ferroviario-biobio': {
            src: 'static/img/landing/puente-ferroviario-biobio.webp',
            alt: 'Nuevo puente ferroviario sobre el río Biobío (diciembre de 2025)',
            author: 'Caineuser1431',
            license: 'CC BY-SA 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
            source: 'https://commons.wikimedia.org/wiki/File:Nuevo_puente_ferroviario_Biob%C3%ADo_diciembre_de_2025.jpg',
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
        'viaducto-malleco': {
            src: 'static/img/landing/viaducto-malleco.webp',
            alt: 'Tren de carga cruzando el Viaducto del Malleco',
            author: 'EL GUILLE!',
            license: 'CC BY 2.0',
            licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
            source: 'https://commons.wikimedia.org/wiki/File:Siempre_es_bueno_ver_un_tren_en_El_Malleco..._(25649779192).jpg',
            attribution: true,
        },
    };

    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    // Crédito corto en texto plano (para usar dentro de enlaces o tarjetas).
    function creditText(key) {
        const p = PHOTOS[key];
        return p ? `Foto: ${p.author} · ${p.license}` : '';
    }

    // Crédito con enlaces a la fuente y a la licencia.
    function creditHtml(key) {
        const p = PHOTOS[key];
        if (!p) return '';
        return `Foto: <a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.author)}</a>`
            + ` · <a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener">${esc(p.license)}</a>`;
    }

    // Variantes reducidas de las fotos de las tarjetas de módulos
    // (static/img/landing/cards/<clave>-<ancho>.webp). Con srcset + sizes el
    // navegador elige la que coincide con el ancho real de la tarjeta por la
    // densidad de píxeles de la pantalla, en vez de achicar la de 2400 px.
    // Al cambiar una foto de tarjeta, regenerar sus variantes con estos anchos.
    const CARD_WIDTHS = [370, 480, 560, 740, 960, 1110];

    function cardSrcset(key) {
        return CARD_WIDTHS.map(w => `static/img/landing/cards/${key}-${w}.webp ${w}w`).join(', ');
    }

    const cardSrc = (key) => `static/img/landing/cards/${key}-560.webp`;

    return { PHOTOS, get: (key) => PHOTOS[key] || null, creditText, creditHtml, cardSrcset, cardSrc };
})();
