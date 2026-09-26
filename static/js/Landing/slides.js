// ─── static/js/Landing/slides.js ─────────────────────────────────────────────
// Define las diapositivas del carrusel de cifras del landing a partir de los
// datos de cada módulo (window.STATIC_DATA, SNI_DATA, MOP_DATA, METRO_DATA,
// EFE_DATA, PUERTOS_DATA). Las fórmulas replican los KPI de cada dashboard,
// así que las cifras se actualizan solas al volver a correr el ETL.
// Si falta la base de un módulo, su diapositiva simplemente no se incluye.
window.LandingSlides = (function () {
    const landingTooltip = CatlecTooltip.create({ domId: 'landing-shared-tooltip' });

    const TEXT_COLOR = '#334155';
    const GRID_COLOR = '#e2e8f0';
    const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
    const ANIMATION = { duration: 450, easing: 'easeOutQuart' };

    // Paleta sobria del landing (derivada del logo CATLEC): una escala de
    // azul marino a gris azulado y un teal apagado como único acento.
    const P = {
        navy: '#1b365d',
        steel: '#3d5a80',
        blue: '#5c7ea3',
        mist: '#8aa4bf',
        fog: '#b8c6d6',
        teal: '#4f7c7a',
        ink: '#17233a',
    };
    // Escala secuencial oscuro → claro para categorías ordenadas por tamaño
    const SEQ = ['#1b365d', '#2d4a70', '#3d5a80', '#5c7ea3', '#7d97b5', '#9fb1c6', '#b8c6d6'];
    // Posición de SEQ desde la cual el texto blanco pierde contraste
    const SEQ_LIGHT_FROM = 4;

    // ── Formato es-CL ────────────────────────────────────────────────────────
    const fmt = (n, decimals = 0) => Number(n).toLocaleString('es-CL', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
    const pct = (part, total, decimals = 0) => (total > 0 ? fmt((part / total) * 100, decimals) : '0') + '%';
    const sum = (arr, fn) => arr.reduce((acc, x) => acc + (Number(fn(x)) || 0), 0);
    const rgba = (hex, a) => {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };

    function baseOptions(extra = {}) {
        return Object.assign({
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: Math.max(2.5, window.devicePixelRatio || 1),
            animation: ANIMATION,
            layout: { padding: { top: 18, right: 8 } },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false, external: landingTooltip },
            },
        }, extra);
    }

    const axisTicks = { color: TEXT_COLOR, font: { size: 10, family: FONT } };
    const axisTitle = (text) => ({ display: true, text, color: TEXT_COLOR, font: { size: 9.5, weight: '600', family: FONT } });

    // ── DGC: inversión materializada por sector ─────────────────────────────

    function dgcSlide() {
        const D = window.STATIC_DATA;
        if (!D || !Array.isArray(D.data)) return null;
        const rows = D.data;
        const inv = (r) => parseFloat(r['Inversión Materializada estimada']) || 0;
        const total = sum(rows, inv);
        const infra = new Set(rows.map(r => r['Nombre de la Concesión ']).filter(Boolean).map(n => String(n).trim())).size;
        const bidders = sum(rows, r => (r.bidders || []).length);

        const bySector = {};
        rows.forEach(r => {
            const s = r['Sector del proyecto'] || 'Diversos';
            bySector[s] = (bySector[s] || 0) + inv(r);
        });
        const sectors = Object.entries(bySector).sort((a, b) => b[1] - a[1]);
        const [topName, topVal] = sectors[0];
        const colors = sectors.map((_, i) => SEQ[Math.min(i, SEQ.length - 1)]);
        const shortName = (s) => s === 'Edificación pública y equipamiento urbano' ? 'Edificación pública' : s;

        return {
            id: 'dgc',
            short: 'DGC',
            photo: 'costanera-norte',
            accent: P.steel,
            number: fmt(total / 1e6, 1),
            unit: 'M UF',
            phrase: `de inversión materializada en <strong>${fmt(rows.length)} contratos de concesión</strong>. `
                + `La vialidad interurbana concentra el <strong>${pct(topVal, total)}</strong>.`,
            stats: [
                { value: fmt(infra), label: 'infraestructuras concesionadas' },
                { value: fmt(bidders), label: 'ofertas en licitaciones' },
            ],
            chartTitle: 'Inversión materializada por sector (M UF)',
            legend: [],
            source: 'Fuente: Dirección General de Concesiones (MOP).',
            link: 'DGC.html#investment',
            chart: () => ({
                type: 'bar',
                plugins: [CatlecUtils.horizontalBarDataLabelsPlugin],
                data: {
                    labels: sectors.map(([s]) => shortName(s)),
                    datasets: [{
                        data: sectors.map(([, v]) => +(v / 1e6).toFixed(1)),
                        backgroundColor: colors.map(c => rgba(c, 0.9)),
                        borderColor: colors,
                        borderWidth: 1,
                        borderRadius: 3,
                        barPercentage: 0.78,
                    }],
                },
                options: baseOptions({
                    indexAxis: 'y',
                    scales: {
                        x: { grid: { color: GRID_COLOR }, ticks: axisTicks, title: axisTitle('Millones de UF') },
                        y: { grid: { display: false }, ticks: axisTicks },
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: landingTooltip,
                            callbacks: {
                                title: (items) => items[0].label,
                                label: (ctx) => ` ${fmt(ctx.raw, 1)} M UF (${pct(ctx.raw * 1e6, total, 1)})`,
                            },
                        },
                        horizontalBarDataLabelsPlugin: {
                            formatter: (v) => fmt(v, 1),
                            insideColor: (v, d, i) => (i >= SEQ_LIGHT_FROM ? P.ink : '#ffffff'),
                        },
                    },
                }),
            }),
        };
    }

    // ── SNI: inversión pública anual 2010–2024 ──────────────────────────────
    function sniSlide() {
        const D = window.SNI_DATA;
        if (!D || !Array.isArray(D.matrix)) return null;
        const byYear = {};
        D.matrix.forEach(r => { byYear[r.y] = (byYear[r.y] || 0) + (r.u || 0); });
        const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
        const values = years.map(y => byYear[y]);
        const total = sum(values, v => v);
        const first = values[0];
        const last = values[values.length - 1];

        const byMin = {};
        D.matrix.forEach(r => { byMin[r.m] = (byMin[r.m] || 0) + (r.u || 0); });
        const [topMin, topMinVal] = Object.entries(byMin).sort((a, b) => b[1] - a[1])[0];
        const growth = first > 0 ? ((last / first) - 1) * 100 : 0;
        const color = P.mist;
        const peak = Math.max(...values);

        return {
            id: 'sni',
            short: 'SNI',
            photo: 'santiago-hora-azul',
            accent: P.steel,
            prefix: 'US$',
            number: fmt(total / 1000),
            unit: 'mil MM',
            phrase: `de inversión pública en infraestructura entre <strong>${years[0]} y ${years[years.length - 1]}</strong> `
                + `(moneda de 2024). En ${years[years.length - 1]} se invirtió un <strong>${fmt(growth)}% más</strong> que en ${years[0]}.`,
            stats: [
                { value: `US$ ${fmt(total / years.length)} MM`, label: 'promedio anual' },
                { value: `${topMin} ${pct(topMinVal, total)}`, label: 'ministerio con mayor inversión' },
            ],
            chartTitle: 'Inversión pública anual (US$ MM de 2024)',
            legend: [
                { label: 'Inversión anual', color: P.blue, shape: 'bar' },
                { label: 'Máximo', color: P.navy, shape: 'bar' },
            ],
            source: 'Fuente: Sistema Nacional de Inversiones (MDSF).',
            link: 'SNI.html#temporal',
            chart: () => ({
                type: 'bar',
                data: {
                    labels: years.map(String),
                    datasets: [{
                        label: 'Inversión anual',
                        data: values.map(v => +v.toFixed(1)),
                        backgroundColor: values.map(v => (v === peak ? rgba(P.navy, 0.92) : rgba(color, 0.85))),
                        borderColor: values.map(v => (v === peak ? P.navy : P.blue)),
                        borderWidth: 1,
                        borderRadius: 3,
                    }],
                },
                options: baseOptions({
                    scales: {
                        x: { grid: { display: false }, ticks: axisTicks },
                        y: { grid: { color: GRID_COLOR }, ticks: { ...axisTicks, callback: (v) => fmt(v) }, title: axisTitle('US$ MM') },
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: landingTooltip,
                            callbacks: { label: (ctx) => ` US$ ${fmt(ctx.raw, 1)} MM` },
                        },
                    },
                }),
            }),
        };
    }

    // ── MOP: iniciativas por etapa ───────────────────────────────────────────
    // Escala secuencial por madurez, de la etapa más temprana a la ejecución
    const MOP_ETAPAS = [
        { key: 'PERFIL', label: 'Perfil', color: '#c9d3df' },
        { key: 'PREFACTIBILIDAD', label: 'Prefactibilidad', color: '#9fb1c6' },
        { key: 'FACTIBILIDAD', label: 'Factibilidad', color: '#6f89a6' },
        { key: 'DISEÑO', label: 'Diseño', color: '#3d5a80' },
        { key: 'EJECUCION', label: 'Ejecución', color: '#1b365d' },
    ];

    function mopSlide() {
        const D = window.MOP_DATA;
        if (!D || !Array.isArray(D.projects)) return null;
        const projects = D.projects;
        const totalCost = sum(projects, p => p.cost_mm);
        const exec = projects.filter(p => p.etapa === 'EJECUCION');
        const execCost = sum(exec, p => p.cost_mm);
        const counts = MOP_ETAPAS.map(e => projects.filter(p => p.etapa === e.key).length);

        const bySrv = {};
        projects.forEach(p => { bySrv[p.servicio] = (bySrv[p.servicio] || 0) + 1; });
        const [topSrv, topSrvCount] = Object.entries(bySrv).sort((a, b) => b[1] - a[1])[0];

        return {
            id: 'mop',
            short: 'MOP',
            photo: 'embalse-el-yeso',
            accent: P.steel,
            number: fmt(projects.length),
            unit: 'iniciativas',
            phrase: `en la cartera del Ministerio de Obras Públicas. Las <strong>${fmt(exec.length)} en ejecución</strong> `
                + `concentran el <strong>${pct(execCost, totalCost)}</strong> del costo total.`,
            stats: [
                { value: `$${fmt(totalCost)} MM`, label: 'costo total de la cartera (CLP)' },
                { value: fmt(topSrvCount), label: `iniciativas de ${topSrv.replace('Dirección de ', '')}` },
            ],
            chartTitle: 'Iniciativas por etapa',
            legend: MOP_ETAPAS.map(e => ({ label: e.label, color: e.color, shape: 'bar' })),
            source: 'Fuente: Ministerio de Obras Públicas, cartera de proyectos.',
            link: 'MOP.html#inversion',
            chart: () => ({
                type: 'doughnut',
                data: {
                    labels: MOP_ETAPAS.map(e => e.label),
                    datasets: [{
                        data: counts,
                        backgroundColor: MOP_ETAPAS.map(e => e.color),
                        borderColor: '#ffffff',
                        borderWidth: 1.5,
                        hoverOffset: 6,
                    }],
                },
                options: baseOptions({
                    cutout: '65%',
                    layout: { padding: 10 },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: landingTooltip,
                            callbacks: { label: (ctx) => ` ${fmt(ctx.raw)} iniciativas (${pct(ctx.raw, projects.length, 1)})` },
                        },
                    },
                }),
            }),
        };
    }

    // ── Metro: viajes anuales ───────────────────────────────────────────────
    function metroSlide() {
        const D = window.METRO_DATA;
        if (!D || !Array.isArray(D.historical_demand) || !D.historical_demand.length) return null;
        const hist = D.historical_demand.slice().sort((a, b) => a.year - b.year);
        const last = hist[hist.length - 1];
        const base = hist.find(h => h.year === 2019) || hist[0];
        const color = P.navy;
        const expansionKm = D.summary && D.summary.total_length_km;

        return {
            id: 'metro',
            short: 'Metro',
            photo: 'metro-santiago',
            accent: P.steel,
            number: fmt(last.trips_mm),
            unit: 'MM viajes',
            phrase: `en ${last.year} en la red de Metro de Santiago: <strong>${pct(last.trips_mm, base.trips_mm)}</strong> `
                + `de la demanda de ${base.year}, antes de la pandemia.`,
            stats: [
                { value: `${fmt(last.daily_trips_mm, 2)} MM`, label: 'viajes por día hábil' },
                expansionKm
                    ? { value: `${fmt(expansionKm, 1)} km`, label: 'de nuevas líneas en cartera' }
                    : { value: fmt(D.summary ? D.summary.total_projects : 0), label: 'proyectos de expansión' },
            ],
            chartTitle: 'Viajes anuales (millones)',
            legend: [{ label: 'Viajes', color, shape: 'line' }],
            source: 'Fuente: Metro de Santiago, memorias anuales.',
            link: 'Metro.html#demanda',
            chart: (canvas) => {
                const ctx = canvas.getContext('2d');
                const fill = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 300);
                fill.addColorStop(0, rgba(color, 0.12));
                fill.addColorStop(1, rgba(color, 0));
                return {
                    type: 'line',
                    plugins: [CatlecUtils.lineDataLabelsPlugin],
                    data: {
                        labels: hist.map(h => String(h.year)),
                        datasets: [{
                            label: 'Viajes',
                            data: hist.map(h => h.trips_mm),
                            borderColor: color,
                            backgroundColor: fill,
                            fill: true,
                            tension: 0.2,
                            borderWidth: 2.2,
                            pointRadius: 3.5,
                            pointHoverRadius: 5.5,
                            pointBackgroundColor: color,
                        }],
                    },
                    options: baseOptions({
                        interaction: { mode: 'index', intersect: false },
                        scales: {
                            x: { grid: { display: false }, ticks: axisTicks },
                            y: { beginAtZero: true, grid: { color: GRID_COLOR }, ticks: axisTicks, title: axisTitle('Millones de viajes') },
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                enabled: false,
                                external: landingTooltip,
                                callbacks: { label: (c) => ` ${fmt(c.raw, 1)} MM viajes` },
                            },
                            lineDataLabelsPlugin: { formatter: (v) => fmt(v), color },
                        },
                    }),
                };
            },
        };
    }

    // ── EFE: pasajeros por filial ───────────────────────────────────────────
    const EFE_FILIAL_COLORS = {
        'EFE Central': P.navy,
        'EFE Valparaíso': P.blue,
        'EFE Sur': '#9fb1c6',
        'EFE Arica - La Paz': P.teal,
    };
    const EFE_LIGHT_FILIALES = new Set(['EFE Sur']);

    function efeSlide() {
        const D = window.EFE_DATA;
        if (!D || !D.demand_summary) return null;
        const filiales = D.demand_filiales || Object.keys(D.demand_summary);
        const years = (D.demand_years || []).slice().sort();
        if (!years.length) return null;
        const totals = years.map(y => sum(filiales, f => (D.demand_summary[f] || {})[y]));
        const lastYear = years[years.length - 1];
        const lastTotal = totals[totals.length - 1];
        const isRecord = lastTotal >= Math.max(...totals);
        const km = sum(D.lines || [], l => l.length_km);
        const investment = sum(D.data || [], p => p.investment_mm_usd);

        return {
            id: 'efe',
            short: 'EFE',
            photo: 'biotren-biobio',
            accent: P.steel,
            number: fmt(lastTotal, 1),
            unit: 'MM pasajeros',
            phrase: `viajaron en los trenes de EFE durante ${lastYear}`
                + (isRecord ? `, <strong>el mayor registro desde ${years[0]}</strong>.` : '.'),
            stats: [
                { value: `${fmt(km, 1)} km`, label: `en ${fmt((D.lines || []).length)} servicios de pasajeros` },
                { value: `US$ ${fmt(investment)} MM`, label: `en ${fmt((D.data || []).length)} proyectos` },
            ],
            chartTitle: 'Pasajeros por filial (millones)',
            legend: filiales.map(f => ({ label: f.replace('EFE ', ''), color: EFE_FILIAL_COLORS[f] || P.mist, shape: 'bar' })),
            source: 'Fuente: Empresa de los Ferrocarriles del Estado, reportes de gestión.',
            link: 'EFE.html#operacion',
            chart: () => ({
                type: 'bar',
                plugins: [CatlecUtils.stackedBarDataLabelsPlugin],
                data: {
                    labels: years,
                    datasets: filiales.map(f => {
                        const c = EFE_FILIAL_COLORS[f] || P.mist;
                        return {
                            label: f,
                            data: years.map(y => (D.demand_summary[f] || {})[y] || 0),
                            backgroundColor: rgba(c, 0.9),
                            borderColor: c,
                            borderWidth: 1,
                            borderRadius: 3,
                        };
                    }),
                },
                options: baseOptions({
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { stacked: true, grid: { display: false }, ticks: axisTicks },
                        y: { stacked: true, grid: { color: GRID_COLOR }, ticks: axisTicks, title: axisTitle('Millones de pasajeros') },
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: landingTooltip,
                            callbacks: {
                                label: (c) => ` ${c.dataset.label}: ${fmt(c.raw, 1)} MM`,
                                afterBody: (items) => [`Total: ${fmt(totals[items[0].dataIndex], 1)} MM pasajeros`],
                            },
                        },
                        stackedBarDataLabelsPlugin: {
                            formatter: (v) => fmt(v, 1),
                            minHeight: 16,
                            color: (dIdx, ds) => (EFE_LIGHT_FILIALES.has(ds.label) ? P.ink : '#ffffff'),
                        },
                    },
                }),
            }),
        };
    }

    // ── Puertos: TEUs anuales en el Biobío ──────────────────────────────────
    function puertosSlide() {
        const D = window.PUERTOS_DATA;
        if (!D || !Array.isArray(D.annual_aggregates)) return null;
        // Solo años completos: el último año suele venir con meses parciales.
        const full = D.annual_aggregates.filter(a => a.meses_registrados === 12).sort((a, b) => a.anio - b.anio);
        if (!full.length) return null;
        const last = full[full.length - 1];
        const maxTeus = Math.max(...full.map(a => a.teus_total));
        const isRecord = last.teus_total >= maxTeus;
        const base = P.mist;
        const highlight = P.navy;
        const varCarga = last.var_anual_carga_pct;

        return {
            id: 'puertos',
            short: 'Puertos',
            photo: 'valparaiso-puerto',
            accent: P.steel,
            number: fmt(last.teus_total / 1e6, 2),
            unit: 'M TEUs',
            phrase: `movieron los puertos del Biobío en ${last.anio}`
                + (isRecord ? `, <strong>el máximo del período ${full[0].anio}–${last.anio}</strong>.` : '.'),
            stats: [
                { value: `${fmt(last.carga_total / 1e6, 1)} M ton`, label: `de carga total en ${last.anio}` },
                {
                    value: `${varCarga > 0 ? '+' : ''}${fmt(varCarga, 1)}%`,
                    label: 'variación anual de la carga',
                },
            ],
            chartTitle: 'Contenedores movilizados (millones de TEUs)',
            legend: [
                { label: 'TEUs', color: P.blue, shape: 'bar' },
                { label: 'Máximo', color: highlight, shape: 'bar' },
            ],
            source: `Fuente: ${(D.metadata && D.metadata.fuente) || 'INE'}.`,
            link: 'puertos.html#contenedores',
            chart: () => {
                const colors = full.map(a => (a.teus_total === maxTeus ? highlight : base));
                return {
                    type: 'bar',
                    plugins: [CatlecUtils.groupedBarDataLabelsPlugin],
                    data: {
                        labels: full.map(a => String(a.anio)),
                        datasets: [{
                            label: 'TEUs',
                            data: full.map(a => +(a.teus_total / 1e6).toFixed(3)),
                            backgroundColor: colors.map(c => rgba(c, c === highlight ? 0.92 : 0.85)),
                            borderColor: colors.map(c => (c === highlight ? highlight : P.blue)),
                            borderWidth: 1,
                            borderRadius: 3,
                        }],
                    },
                    options: baseOptions({
                        scales: {
                            x: { grid: { display: false }, ticks: axisTicks },
                            y: { beginAtZero: true, grid: { color: GRID_COLOR }, ticks: { ...axisTicks, callback: (v) => fmt(v, 1) }, title: axisTitle('Millones de TEUs') },
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                enabled: false,
                                external: landingTooltip,
                                callbacks: { label: (c) => ` ${fmt(c.raw * 1e6)} TEUs` },
                            },
                            groupedBarDataLabelsPlugin: {
                                formatter: (v) => fmt(v, 2),
                                color: P.navy,
                            },
                        },
                    }),
                };
            },
        };
    }

    // Cifras resumen para el hero y las tarjetas de módulos.
    function summary() {
        const S = window.STATIC_DATA, M = window.MOP_DATA, E = window.EFE_DATA;
        const MT = window.METRO_DATA, SN = window.SNI_DATA, P = window.PUERTOS_DATA;
        const sniYears = SN && SN.summary && SN.summary.years_range;

        // Cifras de las cotas del dibujo del hero (static/js/Landing/art.js)
        const art = {};
        if (S && S.data) {
            const inv = (r) => parseFloat(r['Inversión Materializada estimada']) || 0;
            const bySector = (name) => sum(S.data.filter(r => r['Sector del proyecto'] === name), inv);
            art.concesiones = `${fmt(sum(S.data, inv) / 1e6, 1)} M UF`;
            art.hospital = `${fmt(bySector('Hospitalaria') / 1e6, 1)} M UF`;
            art.aero = `${fmt(bySector('Aeroportuaria') / 1e6, 1)} M UF`;
        }
        if (M && M.projects) art.mop = `${fmt(M.projects.filter(p => p.etapa === 'EJECUCION').length)} en ejecución`;
        if (MT && MT.historical_demand && MT.historical_demand.length) {
            const last = MT.historical_demand.slice().sort((a, b) => a.year - b.year).pop();
            art.metro = `${fmt(last.trips_mm)} MM viajes/año`;
        }
        if (SN && SN.matrix) art.sni = `US$ ${fmt(sum(SN.matrix, r => r.u) / 1000)} mil MM`;
        if (P && P.annual_aggregates) {
            const full = P.annual_aggregates.filter(a => a.meses_registrados === 12).sort((a, b) => a.anio - b.anio);
            if (full.length) art.port = `${fmt(full[full.length - 1].teus_total / 1e6, 2)} M TEUs/año`;
        }

        return {
            art,
            dgc: S && S.data ? `${fmt(S.data.length)} contratos` : null,
            efe: E && E.data ? `${fmt(E.data.length)} proyectos · ${fmt((E.lines || []).length)} servicios` : null,
            metro: MT && MT.data ? `${fmt(MT.data.length)} proyectos de expansión` : null,
            mop: M && M.projects ? `${fmt(M.projects.length)} iniciativas` : null,
            sni: sniYears ? `${sniYears[0]}–${sniYears[1]}` : null,
            puertos: P && P.metadata ? `${fmt(P.metadata.total_meses)} meses de registros` : null,
        };
    }

    function build() {
        return [dgcSlide, sniSlide, mopSlide, metroSlide, efeSlide, puertosSlide]
            .map(fn => {
                try { return fn(); } catch (err) { console.warn('[Landing] diapositiva omitida:', err); return null; }
            })
            .filter(Boolean);
    }

    return { build, summary, fmt };
})();
