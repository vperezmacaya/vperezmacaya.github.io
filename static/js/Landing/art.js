// ─── static/js/Landing/art.js ────────────────────────────────────────────────
// Ilustraciones SVG de fondo del landing, con estética de plano técnico:
//
//  - skyline(): corte de obras públicas en el hero (grúa portuaria, puente
//    atirantado, hospital, edificio en construcción con grúa torre, viaducto
//    de metro, torre de control y edificio público). Cada obra lleva una cota
//    con una cifra en vivo del módulo correspondiente. Se dibuja a sí misma al
//    cargar (stroke-dashoffset), salvo con prefers-reduced-motion.
//  - contours(): curvas de nivel topográficas (fondo de "Cifras").
//  - streetMap(): trama urbana con avenida, río, vía férrea y estaciones
//    (fondo de "Módulos").
//
// Todo se genera de forma determinista (sin azar), así el dibujo es siempre
// el mismo.
window.LandingArt = (function () {
    const G = 320;          // línea de suelo del corte
    const W = 1600;         // ancho del viewBox del corte
    const H = 380;
    const DRAW_TOTAL_MS = 4200;

    const n1 = (v) => Math.round(v * 10) / 10;

    // Generador pseudoaleatorio con semilla (mulberry32), para siluetas fijas.
    function seeded(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Onda horizontal (agua) de x0 a x1 a la altura y.
    function wave(x0, x1, y, amp = 3, len = 22) {
        let d = `M${x0} ${y}`;
        for (let x = x0; x < x1; x += len) {
            d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
        }
        return d;
    }

    // Curva cerrada suave (Catmull-Rom → Bézier) por una lista de puntos.
    function smoothClosed(pts) {
        const n = pts.length;
        let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
        for (let i = 0; i < n; i++) {
            const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
            const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
            const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
            d += ` C${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])}`;
        }
        return d + 'Z';
    }

    // ── Corte de obras públicas ─────────────────────────────────────────────
    function farSkyline() {
        const rnd = seeded(7);
        let s = '';
        for (let x = 0; x < W;) {
            const w = 26 + rnd() * 44;
            const h = 34 + rnd() * 110;
            s += `<rect x="${n1(x)}" y="${n1(G - h)}" width="${n1(w - 5)}" height="${n1(h)}"/>`;
            x += w;
        }
        return `<g class="lp-art-far">${s}</g>`;
    }

    function port() {
        let s = '';
        // Grúa pórtico (STS)
        s += '<path d="M60 320 L68 170 M132 320 L124 170 M62 282 H130 M64 232 H128 M62 282 L128 232"/>';
        s += '<rect class="f" x="56" y="162" width="82" height="10"/>';
        s += '<rect class="f" x="4" y="146" width="206" height="7"/>';
        s += '<path d="M84 162 L108 96 L132 162 M108 96 L10 146 M108 96 L204 146"/>';
        s += '<rect class="f" x="112" y="132" width="30" height="14"/>';
        s += '<rect class="f" x="30" y="153" width="16" height="8"/>';
        s += '<path d="M38 161 V222"/>';
        s += '<rect class="f" x="24" y="222" width="30" height="13"/>';
        // Contenedores apilados en el muelle
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (r === 2 && c === 0) continue;
                s += `<rect class="f" x="${150 + c * 26}" y="${G - 13 * (r + 1)}" width="24" height="12"/>`;
            }
        }
        return `<g class="lp-art-item" style="--d:0.1s">${s}</g>`;
    }

    function bridge() {
        let s = '<rect class="f" x="236" y="246" width="424" height="7"/><path d="M236 241 H660"/>';
        [360, 540].forEach(px => {
            s += `<path class="f" d="M${px - 7} 320 L${px - 3} 104 H${px + 3} L${px + 7} 320 Z"/>`;
            s += `<path d="M${px - 10} 262 H${px + 10}"/>`;
            let cables = '';
            for (let i = 1; i <= 6; i++) {
                const y = 110 + i * 6;
                cables += ` M${px} ${y} L${px - i * 15} 246 M${px} ${y} L${px + i * 15} 246`;
            }
            s += `<path d="${cables.trim()}"/>`;
        });
        s += '<path d="M256 253 V320 M300 253 V320 M600 253 V320 M644 253 V320"/>';
        return `<g class="lp-art-item" style="--d:0.35s">${s}</g>`;
    }

    function hospital() {
        let s = '<rect class="f" x="690" y="186" width="160" height="134"/><path d="M686 186 H854"/>';
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 5; c++) {
                s += `<rect x="${703 + c * 29}" y="${200 + r * 24}" width="16" height="11"/>`;
            }
        }
        s += '<rect class="f" x="752" y="292" width="36" height="28"/><path d="M742 290 H798 M770 292 V320"/>';
        s += '<rect class="f" x="755" y="152" width="30" height="30"/><path class="b" d="M770 158 V176 M761 167 H779"/>';
        s += '<rect class="f" x="850" y="240" width="28" height="80"/>';
        s += '<rect x="856" y="252" width="16" height="11"/><rect x="856" y="276" width="16" height="11"/>';
        return `<g class="lp-art-item" style="--d:0.6s">${s}</g>`;
    }

    function construction() {
        let s = '';
        // Estructura en obra gruesa: pilares, losas y arriostramiento
        s += '<path d="M910 320 V176 M950 320 V176 M990 320 V200 M1030 320 V230"/>';
        s += '<path d="M904 290 H1036 M904 260 H1036 M904 230 H1036 M904 200 H996 M904 176 H956"/>';
        s += '<path d="M990 290 L1030 260 M1030 290 L990 260"/>';
        // Grúa torre
        let lattice = 'M1080 320';
        for (let y = 320, left = true; y > 88; y -= 14, left = !left) lattice += ` L${left ? 1090 : 1080} ${Math.max(88, y - 14)}`;
        s += `<rect x="1080" y="88" width="10" height="232"/><path d="${lattice}"/>`;
        s += '<rect class="f" x="930" y="80" width="210" height="7"/>';
        s += '<rect class="f" x="1112" y="87" width="24" height="14"/>';
        s += '<rect class="f" x="1068" y="88" width="12" height="12"/>';
        s += '<path d="M1080 80 L1085 52 L1090 80 M1085 52 L940 80 M1085 52 L1136 80"/>';
        s += '<rect class="f" x="1004" y="87" width="12" height="6"/><path d="M1010 93 V150"/>';
        s += '<rect class="f" x="992" y="150" width="36" height="5"/>';
        return `<g class="lp-art-item" style="--d:0.85s">${s}</g>`;
    }

    function metro() {
        let s = '<rect class="f" x="1130" y="232" width="250" height="8"/>';
        [1160, 1225, 1290, 1355].forEach(p => {
            s += `<rect class="f" x="${p - 5}" y="240" width="10" height="80"/><rect class="f" x="${p - 13}" y="240" width="26" height="5"/>`;
        });
        for (let k = 0; k < 3; k++) {
            const x0 = 1142 + k * 78;
            s += `<rect class="f" x="${x0}" y="204" width="74" height="26" rx="${k === 2 ? 10 : 4}"/>`;
            for (let i = 0; i < 4; i++) s += `<rect x="${x0 + 8 + i * 16}" y="210" width="11" height="8"/>`;
        }
        return `<g class="lp-art-item" style="--d:1.1s">${s}</g>`;
    }

    function tower() {
        let s = '<rect class="f" x="1380" y="292" width="70" height="28"/>';
        s += '<rect class="f" x="1406" y="160" width="18" height="132"/>';
        s += '<path class="f" d="M1394 140 H1436 L1430 160 H1400 Z"/><path d="M1397 147 H1433"/>';
        s += '<rect class="f" x="1398" y="130" width="34" height="10"/><path d="M1415 130 V100"/>';
        return `<g class="lp-art-item" style="--d:1.3s">${s}</g>`;
    }

    function publicBuilding() {
        let s = '<path class="f" d="M1468 214 L1530 186 L1592 214 Z"/>';
        s += '<rect class="f" x="1468" y="214" width="124" height="9"/>';
        for (let i = 0; i < 6; i++) s += `<rect class="f" x="${1472 + i * 22}" y="223" width="8" height="80"/>`;
        s += '<rect class="f" x="1462" y="303" width="136" height="7"/><rect class="f" x="1456" y="310" width="148" height="10"/>';
        s += '<path d="M1530 186 V160"/><rect class="f" x="1530" y="160" width="18" height="11"/>';
        return `<g class="lp-art-item" style="--d:1.5s">${s}</g>`;
    }

    function ground() {
        let s = `<path d="M0 ${G} H${W}"/>`;
        // Postes de alumbrado
        [668, 1112, 1446].forEach(x => { s += `<path d="M${x} ${G} V286 q0 -6 8 -6 h6"/>`; });
        return `<g class="lp-art-item" style="--d:0s">${s}</g>`;
    }

    // Agua, calzada y línea central: sin animación de trazo (usan dasharray propio)
    function staticLayer() {
        let s = '';
        [334, 346, 358, 370].forEach((y, i) => { s += `<path class="w" d="${wave(0, 232, y, 3, 22 + i * 2)}"/>`; });
        [334, 346].forEach(y => { s += `<path class="w" d="${wave(384, 516, y, 2.5, 20)}"/>`; });
        s += '<path d="M232 336 H380 M520 336 H1600 M232 356 H380 M520 356 H1600"/>';
        s += '<path class="dash" d="M232 346 H380 M520 346 H1600"/>';
        return `<g class="lp-art-static">${s}</g>`;
    }

    // Cota con leyenda: línea desde el punto de la obra hasta el rótulo.
    function callout(c, i) {
        if (!c.value) return '';
        const tx = c.align === 'start' ? c.ax + 6 : c.align === 'end' ? c.ax - 6 : c.ax;
        const anchor = c.align === 'middle' ? 'middle' : c.align;
        return `<g class="lp-art-callout" style="--d:${(1.9 + i * 0.12).toFixed(2)}s">
            <path class="lead" d="M${c.ax} ${c.ay} V${c.ly}"/>
            <circle class="dot" cx="${c.ax}" cy="${c.ay}" r="3.5"/>
            <text x="${tx}" y="${c.ly - 20}" text-anchor="${anchor}" class="t">${c.title}</text>
            <text x="${tx}" y="${c.ly - 4}" text-anchor="${anchor}" class="v">${c.value}</text>
        </g>`;
    }

    function skyline(fig) {
        const f = fig || {};
        const callouts = [
            { ax: 108, ay: 96, ly: 60, align: 'start', title: 'PUERTOS BIOBÍO', value: f.port },
            { ax: 540, ay: 104, ly: 60, align: 'start', title: 'CONCESIONES', value: f.concesiones },
            { ax: 770, ay: 150, ly: 100, align: 'middle', title: 'HOSPITALES', value: f.hospital },
            { ax: 910, ay: 176, ly: 150, align: 'end', title: 'OBRAS MOP', value: f.mop },
            { ax: 1290, ay: 202, ly: 160, align: 'end', title: 'METRO DE SANTIAGO', value: f.metro },
            { ax: 1415, ay: 100, ly: 84, align: 'end', title: 'AEROPUERTOS', value: f.aero },
            { ax: 1530, ay: 160, ly: 64, align: 'end', title: 'INVERSIÓN PÚBLICA', value: f.sni },
        ];
        return `<svg class="lp-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
            ${farSkyline()}
            ${staticLayer()}
            ${ground()}${port()}${bridge()}${hospital()}${construction()}${metro()}${tower()}${publicBuilding()}
            ${callouts.map(callout).join('')}
        </svg>`;
    }

    // ── Curvas de nivel ─────────────────────────────────────────────────────
    function contours() {
        const hills = [
            { cx: 300, cy: 250, rings: 12, base: 30, step: 30, s: 0.7 },
            { cx: 1350, cy: 700, rings: 14, base: 40, step: 32, s: 2.1 },
        ];
        let paths = '';
        hills.forEach(h => {
            for (let k = 0; k < h.rings; k++) {
                const r = h.base + k * h.step;
                const pts = [];
                for (let j = 0; j < 72; j++) {
                    const t = (j / 72) * Math.PI * 2;
                    const rr = r * (1 + 0.14 * Math.sin(2 * t + h.s) + 0.08 * Math.sin(3 * t + k * 0.35 + h.s * 2) + 0.05 * Math.sin(5 * t + h.s * 3));
                    pts.push([h.cx + rr * Math.cos(t), h.cy + rr * 0.72 * Math.sin(t)]);
                }
                paths += `<path class="${k % 4 === 3 ? 'idx' : ''}" d="${smoothClosed(pts)}"/>`;
            }
        });
        return `<svg class="lp-topo" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${paths}</svg>`;
    }

    // ── Trama urbana ────────────────────────────────────────────────────────
    function streetMap() {
        const riverY = (x) => 540 + 70 * Math.sin(x / 230);
        // Avenida diagonal: recta de (-200, 900) a (1400, -100)
        const ax0 = -200, ay0 = 900, ax1 = 1400, ay1 = -100;
        const alen = Math.hypot(ax1 - ax0, ay1 - ay0);
        const avenueDist = (x, y) => Math.abs((ay1 - ay0) * x - (ax1 - ax0) * y + ax1 * ay0 - ay1 * ax0) / alen;
        const railY = 170;
        const inPark = (x, y) => x > 180 && x < 360 && y > 260 && y < 390;

        let blocks = '';
        for (let x = -240; x < 1440; x += 84) {
            for (let y = -240; y < 1040; y += 62) {
                const cx = x + 43, cy = y + 32;
                if (Math.abs(cy - riverY(cx)) < 62) continue;
                if (avenueDist(cx, cy) < 40) continue;
                if (Math.abs(cy - railY) < 30) continue;
                if (inPark(cx, cy)) continue;
                blocks += `<rect x="${x + 8}" y="${y + 8}" width="70" height="48"/>`;
            }
        }
        let river = '', riverB = '';
        for (let x = -300; x <= 1500; x += 20) {
            river += `${x === -300 ? 'M' : 'L'}${x} ${n1(riverY(x) - 36)} `;
            riverB += `${x === -300 ? 'M' : 'L'}${x} ${n1(riverY(x) + 36)} `;
        }
        let park = '<rect class="park" x="190" y="268" width="160" height="116" rx="6"/>';
        const rnd = seeded(3);
        for (let i = 0; i < 18; i++) park += `<circle class="tree" cx="${n1(204 + rnd() * 132)}" cy="${n1(282 + rnd() * 88)}" r="${n1(3 + rnd() * 3)}"/>`;
        const ux = (ax1 - ax0) / alen, uy = (ay1 - ay0) / alen;
        const ox = -uy * 16, oy = ux * 16;
        const avenue = `M${n1(ax0 + ox)} ${n1(ay0 + oy)} L${n1(ax1 + ox)} ${n1(ay1 + oy)} M${n1(ax0 - ox)} ${n1(ay0 - oy)} L${n1(ax1 - ox)} ${n1(ay1 - oy)}`;
        let stations = '';
        [0.3, 0.45, 0.6, 0.75].forEach(t => {
            stations += `<circle class="station" cx="${n1(ax0 + (ax1 - ax0) * t)}" cy="${n1(ay0 + (ay1 - ay0) * t)}" r="7"/>`;
        });
        return `<svg class="lp-streets" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
            <g transform="rotate(-14 600 400)">
                ${blocks}
                <path class="river" d="${river.trim()}"/><path class="river" d="${riverB.trim()}"/>
                ${park}
                <path class="avenue" d="${avenue}"/>
                <path class="median" d="M${ax0} ${ay0} L${ax1} ${ay1}"/>
                <path class="rail" d="M-300 ${railY} H1500"/><path class="ties" d="M-300 ${railY} H1500"/>
                ${stations}
            </g>
        </svg>`;
    }

    // Dibujo progresivo del corte: pathLength=1 normaliza el largo de cada
    // trazo; al terminar se quita el dasharray (navegadores sin pathLength en
    // formas básicas quedarían punteados).
    function animateSkyline(host) {
        const svg = host.querySelector('.lp-art');
        if (!svg) return;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) return;
        svg.querySelectorAll('.lp-art-item path, .lp-art-item rect, .lp-art-item circle, .lp-art-callout .lead')
            .forEach(el => el.setAttribute('pathLength', '1'));
        svg.classList.add('is-drawing');
        setTimeout(() => {
            svg.classList.add('is-drawn');
            svg.classList.remove('is-drawing');
        }, DRAW_TOTAL_MS);
    }

    function init(figures) {
        const hero = document.getElementById('lp-hero-art');
        if (hero) {
            hero.innerHTML = skyline(figures);
            animateSkyline(hero);
        }
        const topo = document.getElementById('lp-topo');
        if (topo) topo.innerHTML = contours();
        const streets = document.getElementById('lp-streets');
        if (streets) streets.innerHTML = streetMap();
    }

    return { init };
})();
