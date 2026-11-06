// ─── EFE: mapa "Red de carga EFE" (vista Carga Ferroviaria) ────────
// Mapa D3 de las regiones de Chile (CatlecChoropleth, el mismo de SNI) "acostado",
// con el norte a la izquierda y el Pacífico abajo, para ocupar la fila inferior de
// la vista. Se gira un poco más de 90° para que Arica y Concepción queden a la misma
// altura (efeCargaMapaEncuadre) y se encuadra a la red de carga que se dibuja
// (EFE_CARGA_MAPA_VISTA: de La Calera y Puerto Ventanas a Puerto Montt, llenando el
// ancho; el norte grande y la Patagonia quedan fuera de la vista).
// Encima: la Red EFE (efe_red.js, un trazo
// por ramal, toda del mismo color) y los puntos de EFE_CARGA_NODOS_VISIBLES
// (de efe_red_nodos.js: puertos, centros de carga y ciudades). Rueda o doble clic
// acercan; arrastrar mueve. Las etiquetas se ubican sin taparse: primero puertos y
// centros de carga, luego ciudades.

let efeCargaMapa = null;
let efeCargaMapaCapas = null;   // grupos SVG, zoom y posiciones proyectadas
const EFE_CARGA_MAPA_ANGULO_BASE = 90;          // Chile acostado: norte a la izquierda
const EFE_CARGA_MAPA_ALINEAR = ['Arica', 'Concepción'];   // nodos que quedan a la misma altura
const EFE_CARGA_MAPA_MARGEN = 8;                // px alrededor de Chile (encuadre previo al ajuste)
// Vista inicial (y la de "Restablecer"): la red de carga que se dibuja (ramales y nodos, sin los de
// EFE_CARGA_RAMALES_EXCLUIDOS) ocupa el ancho del mapa, desde La Calera y Puerto Ventanas a la
// izquierda hasta Puerto Montt a la derecha, con estos márgenes como mínimo (fracción del ancho;
// dejan espacio para las etiquetas de los extremos). Si la red quedara más alta que `altoMax`
// (fracción del alto), manda el alto. `zoom` < 1 aleja la vista respecto de ese encuadre justo. La
// red queda centrada en alto y en el ancho libre (sin el mapa de ubicación de la esquina derecha):
// lo que sobra se reparte entre el norte y el sur.
const EFE_CARGA_MAPA_VISTA = { margenIzq: 0.045, margenDer: 0.045, altoMax: 0.8, zoom: 0.78 };
const EFE_CARGA_MAPA_REGION = '#d8e0eb';

// Solo dos símbolos en el mapa: azul para los puertos y oscuro para todo lo demás (centros de carga,
// ciudades y empalmes se ven iguales). La leyenda muestra los tipos con `leyenda: true`.
const EFE_CARGA_NODO_OSCURO = { fill: '#0f3b6c', stroke: '#ffffff', r: 3.6 };
const EFE_CARGA_NODO_TIPOS = {
    puerto: { label: 'Puerto', fill: '#0284c7', stroke: '#ffffff', r: 5.2, prioridad: 0, leyenda: true },
    carga: Object.assign({ label: 'Centro de carga', prioridad: 1 }, EFE_CARGA_NODO_OSCURO),
    ciudad: Object.assign({ label: 'Ciudad', prioridad: 2 }, EFE_CARGA_NODO_OSCURO),
    empalme: Object.assign({ label: 'Empalme', prioridad: 3 }, EFE_CARGA_NODO_OSCURO)
};

// Toda la red de un solo color (sin distinguir filiales)
const EFE_CARGA_RED_COLOR = '#d92534';

// Ramales de efe_red.js que no se dibujan en este mapa (sí en el mapa principal de EFE). Sus nodos
// terminales se quitan; los empalmes que quedan sin ramal secundario pasan a ser ciudades.
// Arica – Visviri: sin trenes de carga regulares. Hubo una prueba con carga real en mayo de 2021,
// "tras 16 años de suspensión de operaciones" (Reporte Integrado 2021, pág. 45), y la Memoria 2025
// (pág. 50) ubica la red de carga "desde la Calera a Puerto Montt". El giro del mapa sigue usando
// Arica (de EFE_RED_NODOS completo).
// Santa Fe – Los Ángeles: declarado prescindible y dado de baja en 1998, último tren en 2006 y vía
// levantada por EFE en 2008; Concepción – Los Ángeles es hoy un proyecto de pasajeros en
// prefactibilidad (Memoria 2025, pág. 36).
const EFE_CARGA_RAMALES_EXCLUIDOS = ['Talca – Constitución', 'San Fernando – Peralillo', 'Antilhue – Valdivia', 'Arica – Visviri', 'Santa Fe – Los Ángeles'];

// Puntos que se marcan en el mapa (los eligió el usuario; el resto de EFE_RED_NODOS no se dibuja).
// La clave es el nombre en EFE_RED_NODOS; el valor cambia el nombre o el tipo que se muestra.
const EFE_CARGA_NODOS_VISIBLES = {
    'Valparaíso': {}, 'Puerto Ventanas': {}, 'San Antonio': {}, 'Saladillo': {},
    'Santiago (Estación Central)': { nombre: 'Alameda', tipo: 'ciudad' },
    'Talca': {}, 'Nueva Aldea': {}, 'Lirquén': {}, 'Talcahuano': {}, 'Horcones': {}, 'Coronel': {},
    'Coigüe': {}, 'Temuco': {}, 'Puerto Montt': {}
};

function efeCargaMapaRamales() {
    return ((window.EFE_RED_DATA && window.EFE_RED_DATA.features) || [])
        .filter(f => f && f.geometry && !EFE_CARGA_RAMALES_EXCLUIDOS.includes(f.properties.ramal));
}

function efeCargaMapaNodos() {
    return (window.EFE_RED_NODOS || []).map(n => {
        const cambio = EFE_CARGA_NODOS_VISIBLES[n.nombre];
        if (!cambio) return null;
        const ramales = n.ramales.filter(r => !EFE_CARGA_RAMALES_EXCLUIDOS.includes(r));
        if (!ramales.length) return null;
        const tipo = n.tipo === 'empalme' && ramales.length < 2 ? 'ciudad' : n.tipo;
        return Object.assign({}, n, { ramales, tipo }, cambio);
    }).filter(Boolean);
}

function renderEfeCargaMapa() {
    if (typeof d3 === 'undefined' || typeof CatlecChoropleth === 'undefined') return;
    if (efeCargaMapa) { efeCargaMapa.redraw(); return; }
    const regiones = ((window.SNI_REGIONS_DATA && window.SNI_REGIONS_DATA.features) || []).filter(f => f && f.geometry);
    const encuadre = efeCargaMapaEncuadre(regiones);

    efeCargaMapa = CatlecChoropleth.create('efe-carga-mapa', {
        features: regiones,
        padding: EFE_CARGA_MAPA_MARGEN,
        bounds: encuadre.bounds,
        ajuste: efeCargaMapaAjustarVista,
        angle: encuadre.angulo,
        hover: false,
        style: { fillOpacity: 1, strokeWidth: 0.8 },
        onDraw: () => efeCargaMapa.paths().attr('fill', EFE_CARGA_MAPA_REGION).style('cursor', 'default'),
        onRedraw: (projection, pathGen) => efeCargaMapaDibujar(projection, pathGen)
    });
    if (!efeCargaMapa) return;
    efeCargaMapaLeyenda();
    const reset = document.getElementById('efe-carga-mapa-reset');
    if (reset) reset.addEventListener('click', () => {
        if (efeCargaMapaCapas) efeCargaMapa.svg.transition().duration(450).call(efeCargaMapaCapas.zoom.transform, d3.zoomIdentity);
    });
    efeCargaMapa.redraw();
}

// Encuadre y giro del mapa. El encuadre es todo Chile continental: las regiones sin sus polígonos
// al oeste de -76° (Isla de Pascua, Juan Fernández), que alejarían el mapa. El giro parte de 90°
// (Chile acostado) y se corrige para que la recta entre Arica y Concepción quede horizontal (con
// Arica a la izquierda): ~97,5°.
function efeCargaMapaEncuadre(regiones) {
    const nodos = window.EFE_RED_NODOS || [];
    const continental = (poligono) => poligono[0].some(c => c[0] > -76);
    const bounds = {
        type: 'FeatureCollection',
        features: regiones.map(f => {
            const g = f.geometry;
            if (g.type === 'Polygon') return continental(g.coordinates) ? f : null;
            if (g.type !== 'MultiPolygon') return f;
            const partes = g.coordinates.filter(continental);
            return partes.length ? { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: partes } } : null;
        }).filter(Boolean)
    };

    let angulo = EFE_CARGA_MAPA_ANGULO_BASE;
    const [a, b] = EFE_CARGA_MAPA_ALINEAR.map(nombre => nodos.find(n => n.nombre === nombre));
    if (a && b) {
        const pendiente = (ang) => {
            const p = d3.geoMercator().angle(ang);
            const pa = p([a.lon, a.lat]), pb = p([b.lon, b.lat]);
            return { dx: pb[0] - pa[0], dy: pb[1] - pa[1] };
        };
        const base = pendiente(angulo);
        const giro = Math.atan2(base.dy, base.dx) * 180 / Math.PI;
        // El signo con que d3 aplica angle() se comprueba en vez de suponerlo
        angulo = [angulo + giro, angulo - giro]
            .map(ang => ({ ang, ...pendiente(ang) }))
            .filter(c => c.dx > 0)
            .sort((x, y) => Math.abs(x.dy) - Math.abs(y.dy))[0].ang;
    }
    return { bounds, angulo };
}

// Escala y desplaza la proyección para que la red de carga visible llene el ancho con los márgenes
// de EFE_CARGA_MAPA_VISTA y quede centrada en alto
function efeCargaMapaAjustarVista(projection, width, height) {
    const V = EFE_CARGA_MAPA_VISTA;
    const red = {
        type: 'FeatureCollection',
        features: efeCargaMapaRamales().concat(efeCargaMapaNodos()
            .map(n => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [n.lon, n.lat] } })))
    };
    if (!red.features.length) return;
    let b = d3.geoPath(projection).bounds(red);
    const ancho = b[1][0] - b[0][0], alto = b[1][1] - b[0][1];
    if (!ancho || !alto) return;
    const k = Math.min((1 - V.margenIzq - V.margenDer) * width / ancho, V.altoMax * height / alto) * (V.zoom || 1);
    projection.scale(projection.scale() * k);
    b = d3.geoPath(projection).bounds(red);
    const [tx, ty] = projection.translate();
    const anchoLibre = width - efeCargaUbicacionTamano(height).reserva;
    projection.translate([
        tx + (anchoLibre - (b[1][0] - b[0][0])) / 2 - b[0][0],
        ty + (height - (b[1][1] - b[0][1])) / 2 - b[0][1]
    ]);
}

function efeCargaMapaLeyenda() {
    const el = document.getElementById('efe-carga-mapa-legend');
    if (!el) return;
    // Solo los tipos de la leyenda (`leyenda: true`) que tienen algún punto en el mapa
    const presentes = new Set(efeCargaMapaNodos().map(n => n.tipo));
    const nodos = Object.keys(EFE_CARGA_NODO_TIPOS).filter(k => presentes.has(k) && EFE_CARGA_NODO_TIPOS[k].leyenda).map(k => EFE_CARGA_NODO_TIPOS[k]).map(t => `
        <span class="efe-carga-legend-item efe-carga-legend-item--muted">
            <span class="efe-carga-swatch efe-carga-swatch--nodo" style="background:${t.fill};border-color:${t.stroke === '#ffffff' ? t.fill : t.stroke}"></span>${t.label}
        </span>`).join('');
    el.innerHTML = nodos;   // solo los puntos (sin la línea de la Red EFE)
}

// Crea las capas la primera vez y las reproyecta en cada redibujo (cambio de tamaño)
function efeCargaMapaDibujar(projection, pathGen) {
    const svg = efeCargaMapa.svg;
    const node = svg.node();
    const width = node.clientWidth, height = node.clientHeight;

    if (!efeCargaMapaCapas) {
        const red = svg.append('g').attr('class', 'efe-carga-red');
        const nodosG = svg.append('g').attr('class', 'efe-carga-nodos');
        const etiquetasG = svg.append('g').attr('class', 'efe-carga-etiquetas');
        const zoom = d3.zoom()
            .scaleExtent([1, 12])
            .on('zoom', (event) => {
                efeCargaMapaCapas.t = event.transform;
                efeCargaMapa.regionsGroup.attr('transform', event.transform);
                red.attr('transform', event.transform);
                efeCargaMapaUbicarNodos();
                efeCargaMapaActualizarUbicacion();
            });
        svg.call(zoom).on('dblclick.zoom', null);
        svg.on('dblclick', (event) => {
            const [x, y] = d3.pointer(event);
            svg.transition().duration(350).call(zoom.scaleBy, 2, [x, y]);
        });
        efeCargaMapaCapas = { red, nodosG, etiquetasG, zoom, t: d3.zoomIdentity };

        // Red EFE: un trazo por ramal, sin hover ni tooltip (solo los nodos los tienen)
        const ramales = efeCargaMapaRamales();
        red.selectAll('path.efe-carga-red-path').data(ramales).enter().append('path')
            .attr('class', 'efe-carga-red-path')
            .attr('vector-effect', 'non-scaling-stroke')
            .attr('stroke', EFE_CARGA_RED_COLOR);

        // Nodos: los menos importantes abajo, puertos y centros de carga encima
        const nodos = efeCargaMapaNodos()
            .sort((a, b) => EFE_CARGA_NODO_TIPOS[b.tipo].prioridad - EFE_CARGA_NODO_TIPOS[a.tipo].prioridad);
        nodosG.selectAll('circle').data(nodos).enter().append('circle')
            .attr('class', d => `efe-carga-nodo efe-carga-nodo--${d.tipo}`)
            .attr('r', d => EFE_CARGA_NODO_TIPOS[d.tipo].r)
            .attr('fill', d => EFE_CARGA_NODO_TIPOS[d.tipo].fill)
            .attr('stroke', d => EFE_CARGA_NODO_TIPOS[d.tipo].stroke);   // sin hover ni tooltip
        etiquetasG.selectAll('text').data(nodos).enter().append('text')
            .attr('class', d => `efe-carga-etiqueta efe-carga-etiqueta--${d.tipo}`)
            .text(d => d.nombre);
    }

    const C = efeCargaMapaCapas;
    C.red.selectAll('path').attr('d', pathGen);
    C.nodosG.selectAll('circle').each(d => { d._xy = projection([d.lon, d.lat]); });
    C.proj = projection;
    efeCargaMapaCrearUbicacion();
    C.zoom.translateExtent([[0, 0], [width, height]]).extent([[0, 0], [width, height]]);
    // Al cambiar el tamaño se vuelve a la vista completa
    C.t = d3.zoomIdentity;
    svg.call(C.zoom.transform, d3.zoomIdentity);
    efeCargaMapaUbicarNodos();
}

// Ubica nodos y etiquetas según el zoom; las etiquetas que se taparían se ocultan
function efeCargaMapaUbicarNodos() {
    const C = efeCargaMapaCapas;
    if (!C) return;
    const t = C.t;
    C.nodosG.selectAll('circle')
        .attr('cx', d => t.applyX(d._xy[0]))
        .attr('cy', d => t.applyY(d._xy[1]));

    const ocupadas = [];
    const choca = (b) => ocupadas.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
    // Los puntos también ocupan espacio: ninguna etiqueta tapa un puerto o centro de carga
    C.nodosG.selectAll('circle').each(d => {
        if (d.tipo !== 'puerto' && d.tipo !== 'carga') return;
        const x = t.applyX(d._xy[0]), y = t.applyY(d._xy[1]), r = EFE_CARGA_NODO_TIPOS[d.tipo].r;
        ocupadas.push({ x0: x - r, x1: x + r, y0: y - r, y1: y + r });
    });
    const orden = C.etiquetasG.selectAll('text').data()
        .slice().sort((a, b) => EFE_CARGA_NODO_TIPOS[a.tipo].prioridad - EFE_CARGA_NODO_TIPOS[b.tipo].prioridad);
    const visibles = new Map();
    orden.forEach(d => {
        const x = t.applyX(d._xy[0]), y = t.applyY(d._xy[1]);
        const w = d.nombre.length * 5.4 + 4, h = 11, gap = EFE_CARGA_NODO_TIPOS[d.tipo].r + 2;
        // Arriba (lado de la cordillera), abajo (lado del mar) o, si no caben, a un costado o en diagonal
        const dx = gap + w / 2, dy = gap + h / 2;
        const posiciones = [
            [x, y - dy], [x, y + dy], [x + dx, y], [x - dx, y],
            [x + dx, y + dy], [x - dx, y + dy], [x + dx, y - dy], [x - dx, y - dy]
        ];
        for (const [xc, yc] of posiciones) {
            const b = { x0: xc - w / 2, x1: xc + w / 2, y0: yc - h / 2, y1: yc + h / 2 };
            if (!choca(b)) {
                ocupadas.push(b);
                visibles.set(d, { x: xc, y: yc });
                return;
            }
        }
    });
    C.etiquetasG.selectAll('text')
        .style('display', d => visibles.has(d) ? null : 'none')
        .attr('x', d => visibles.has(d) ? visibles.get(d).x : 0)
        .attr('y', d => visibles.has(d) ? visibles.get(d).y : 0);
}

// ── Mapa de ubicación ──────────────────────────────────────────────────────────
// En la esquina superior derecha, Chile continental con el norte arriba y un recuadro con lo que
// muestra el mapa en ese momento (se actualiza al acercar o mover). Como el mapa principal está
// girado, el recuadro es el polígono de sus cuatro esquinas pasadas a lon/lat.
const EFE_CARGA_UBICACION_ALTO = 0.78;   // alto del mapa de ubicación, como fracción del alto del mapa

// Tamaño del mapa de ubicación para un mapa de `alturaMapa` px, su proyección y el ancho que ocupa en
// la esquina derecha (con su relleno y separación del borde; en celular, donde se oculta, 0)
function efeCargaUbicacionTamano(alturaMapa) {
    const regiones = ((window.SNI_REGIONS_DATA && window.SNI_REGIONS_DATA.features) || []).filter(f => f && f.geometry);
    const continental = efeCargaMapaEncuadre(regiones).bounds;
    const alto = Math.max(60, Math.round(alturaMapa * EFE_CARGA_UBICACION_ALTO));
    const proj = d3.geoMercator().fitHeight(alto, continental);
    const b = d3.geoPath(proj).bounds(continental);
    const ancho = Math.ceil(b[1][0] - b[0][0]);
    proj.translate([proj.translate()[0] - b[0][0], proj.translate()[1]]);
    const visible = !window.matchMedia || !window.matchMedia('(max-width: 600px)').matches;
    return { alto, ancho, proj, continental, reserva: visible ? ancho + 22 : 0 };
}

function efeCargaMapaCrearUbicacion() {
    const C = efeCargaMapaCapas;
    const cont = document.getElementById('efe-carga-mapa');
    if (!C || !cont) return;
    let caja = cont.querySelector('.efe-carga-ubicacion');
    if (!caja) {
        caja = document.createElement('div');
        caja.className = 'efe-carga-ubicacion';
        caja.setAttribute('aria-hidden', 'true');
        cont.appendChild(caja);
    }
    const { alto, ancho, proj, continental } = efeCargaUbicacionTamano(cont.clientHeight);
    const path = d3.geoPath(proj);

    caja.innerHTML = '';
    const svg = d3.select(caja).append('svg').attr('width', ancho).attr('height', alto);
    svg.append('g').selectAll('path').data(continental.features).enter().append('path')
        .attr('class', 'efe-carga-ubicacion-region')
        .attr('d', path);
    C.ubicacion = { proj, recuadro: svg.append('path').attr('class', 'efe-carga-ubicacion-recuadro') };
    efeCargaMapaActualizarUbicacion();
}

function efeCargaMapaActualizarUbicacion() {
    const C = efeCargaMapaCapas;
    if (!C || !C.ubicacion || !C.proj) return;
    const svg = efeCargaMapa.svg.node();
    const W = svg.clientWidth, H = svg.clientHeight, t = C.t;
    // Esquinas de lo visible: pantalla → sin zoom → lon/lat → mapa de ubicación
    const esquinas = [[0, 0], [W, 0], [W, H], [0, H]]
        .map(([x, y]) => C.proj.invert([(x - t.x) / t.k, (y - t.y) / t.k]))
        .filter(Boolean)
        .map(ll => C.ubicacion.proj(ll));
    C.ubicacion.recuadro.attr('d', esquinas.length === 4 ? 'M' + esquinas.map(p => p.join(',')).join('L') + 'Z' : null);
}

if (typeof window !== 'undefined') {
    window.renderEfeCargaMapa = renderEfeCargaMapa;
}
