// ─── static/js/Metro/timeline.js ──────────────────────────────────────────────
// Visualización de Líneas de Tiempo (Gantt) para proyectos del Metro de Santiago.
// Diseño y estructura interactiva idéntica a la línea de tiempo de Concesiones (index.html).

const METRO_TL_AXIS_H = 36;      // px for year axis
const METRO_TL_LABEL_W = 240;    // px for label column
const METRO_TL_BAR_H = 14;       // height of individual project bar
const METRO_TL_MILESTONE_R = 6.5;// radius of milestone icons

function showMetroTimelineView() {
    if (metroState.comunasOpen && typeof hideMetroComunasView === 'function') {
        hideMetroComunasView();
    }
    if (metroState.demandaOpen && typeof hideMetroDemandaView === 'function') {
        hideMetroDemandaView();
    }
    metroState.timelineOpen = true;

    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const tlPanel = document.getElementById('metro-timeline-full-panel');
    const btnMap = document.getElementById('btn-metro-view-map');
    const btnTl = document.getElementById('btn-metro-view-timeline');
    const btnComunas = document.getElementById('btn-metro-view-comunas');
    const btnDemanda = document.getElementById('btn-metro-view-demanda');

    if (grid) grid.style.gridTemplateColumns = '1fr';
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (tlPanel) tlPanel.style.display = 'flex';

    if (btnMap) btnMap.classList.remove('active');
    if (btnComunas) btnComunas.classList.remove('active');
    if (btnDemanda) btnDemanda.classList.remove('active');
    if (btnTl) btnTl.classList.add('active');

    if (window.location.hash !== '#timeline') {
        history.replaceState(null, null, '#timeline');
    }

    const currentList = (typeof metroGetFilteredProjects === 'function')
        ? metroGetFilteredProjects()
        : ((window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : []);

    renderMetroTimeline(currentList);
    requestAnimationFrame(() => {
        renderMetroTimeline(currentList);
    });
}

function hideMetroTimelineView() {
    metroState.timelineOpen = false;

    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const tlPanel = document.getElementById('metro-timeline-full-panel');
    const btnMap = document.getElementById('btn-metro-view-map');
    const btnTl = document.getElementById('btn-metro-view-timeline');

    if (grid) grid.style.gridTemplateColumns = '1fr 520px';
    if (centerPanel) centerPanel.style.display = 'flex';
    if (rightPanel) rightPanel.style.display = 'flex';
    if (tlPanel) tlPanel.style.display = 'none';

    if (btnTl) btnTl.classList.remove('active');
    if (btnMap && !metroState.comunasOpen && !metroState.demandaOpen) {
        btnMap.classList.add('active');
    }

    if (window.location.hash === '#timeline') {
        history.replaceState(null, null, window.location.pathname + window.location.search);
    }

    if (typeof metroMap !== 'undefined' && metroMap) {
        setTimeout(() => {
            metroMap.invalidateSize({ animate: false });
        }, 50);
    }
}

function metroSvgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
}

function wrapMetroTimelineText(text, maxCharsPerLine = 28) {
    if (!text) return ['—'];
    const words = String(text).split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
        if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
            currentLine = (currentLine + ' ' + word).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    });
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [text];
}

// ── Convierte fechas / años de proyectos Metro a año decimal ──
function parseMetroYear(val, fallback = null) {
    if (!val) return fallback;
    const str = String(val).toLowerCase();

    // Buscar años explícitos (ej. 2022, 2028, 2030)
    const yearMatch = str.match(/(20\d\d)/);
    if (!yearMatch) return fallback;

    let y = parseInt(yearMatch[1], 10);

    // Meses
    if (str.includes('ene') || str.includes('enero')) y += 0.04;
    else if (str.includes('feb') || str.includes('febrero')) y += 0.12;
    else if (str.includes('mar') || str.includes('marzo')) y += 0.20;
    else if (str.includes('abr') || str.includes('abril')) y += 0.28;
    else if (str.includes('may') || str.includes('mayo')) y += 0.38;
    else if (str.includes('jun') || str.includes('junio')) y += 0.46;
    else if (str.includes('jul') || str.includes('julio')) y += 0.55;
    else if (str.includes('ago') || str.includes('agosto')) y += 0.63;
    else if (str.includes('sep') || str.includes('septiembre')) y += 0.72;
    else if (str.includes('oct') || str.includes('octubre')) y += 0.80;
    else if (str.includes('nov') || str.includes('noviembre')) y += 0.88;
    else if (str.includes('dic') || str.includes('diciembre')) y += 0.96;
    else y += 0.5; // mitad de año por defecto

    return y;
}

// ── Parsea el valor de la columna "Puesta en Servicio" (Excel) y determina la tipología del hito ──
/**
 * Soporta:
 * 1. Año solo ('2028', '2032', '2033'): Hito puntual (rombo púrpura en ese año).
 * 2. Rango de años ('2025-2026', '2027 - 2028', '2030 - 2032'): Barra de periodo entre esos años.
 * 3. Formato sin fin claro ('2033+', '2023 +', '2030+'): Barra abierta con concepto matemático [a, [.
 */
function parseMetroMilestone(val) {
    if (!val) return null;
    const s = String(val).trim();

    // Caso 3: Formato '2033+', '2023 +', etc. (Intervalo abierto)
    const mOpen = s.match(/(20\d\d)\s*\+/);
    if (mOpen) {
        const startYr = parseInt(mOpen[1], 10);
        return {
            type: 'open_range',
            start: startYr,
            label: `Puesta en Servicio Estimada ${s}`,
            displayTag: s,
            raw: s
        };
    }

    // Caso 2: Formato '2025-2026', '2027 - 2028', '2030 - 2032' (Barra de periodo)
    const mRange = s.match(/(20\d\d)\s*[-/–—]\s*(20\d\d)/);
    if (mRange) {
        const y1 = parseInt(mRange[1], 10);
        const y2 = parseInt(mRange[2], 10);
        return {
            type: 'range',
            start: y1,
            end: y2,
            label: `Puesta en Servicio Estimada ${s}`,
            displayTag: s,
            raw: s
        };
    }

    // Caso 1: Año solo '2028', '2032', '2033' (Hito puntual)
    const mSingle = s.match(/(20\d\d)/);
    if (mSingle) {
        const y = parseInt(mSingle[1], 10);
        return {
            type: 'point',
            year: y,
            label: `Puesta en Servicio Estimada ${y}`,
            displayTag: String(y),
            raw: s
        };
    }

    return null;
}


// ── Paleta y Detección Dinámica de Etapas (Uniques de la columna "Etapa") ──────
const METRO_DEFAULT_STAGE_COLORS = {
    'ejecución': '#2563eb',    // Azul Real
    'ejecucion': '#2563eb',
    'diseño': '#ea580c',       // Naranja Intenso
    'diseno': '#ea580c',
    'factibilidad': '#0891b2', // Turquesa / Cian profundo
    'operación': '#10b981',    // Verde Esmeralda
    'operacion': '#10b981',
    'licitación': '#8b5cf6',   // Violeta
    'licitacion': '#8b5cf6',
    'estudio': '#6366f1'       // Índigo
};

const METRO_STAGE_PALETTE = [
    '#2563eb', '#ea580c', '#0891b2', '#8b5cf6', '#10b981', '#d97706', '#ec4899', '#6366f1'
];

/**
 * Identifica todos los valores únicos presentes en la propiedad stage (columna "Etapa" de Excel)
 * y asigna a cada etapa un color armónico y distintivo.
 */
function getMetroStagesMap(projects) {
    const stageMap = {};
    let colorIdx = 0;

    (projects || []).forEach(p => {
        const rawStage = (p.stage && String(p.stage).trim()) ? String(p.stage).trim() : 'Sin Etapa';
        if (!stageMap[rawStage]) {
            const normKey = rawStage.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // sin tildes
            
            let color = METRO_DEFAULT_STAGE_COLORS[rawStage.toLowerCase()] 
                     || METRO_DEFAULT_STAGE_COLORS[normKey] 
                     || METRO_STAGE_PALETTE[colorIdx % METRO_STAGE_PALETTE.length];
            
            colorIdx++;
            stageMap[rawStage] = {
                key: normKey,
                label: rawStage,
                color: color
            };
        }
    });

    return stageMap;
}

function getMetroStageInfo(p, stageMap = null) {
    const rawStage = (p && p.stage && String(p.stage).trim()) ? String(p.stage).trim() : 'Sin Etapa';
    if (stageMap && stageMap[rawStage]) {
        return stageMap[rawStage];
    }
    const normKey = rawStage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const color = METRO_DEFAULT_STAGE_COLORS[rawStage.toLowerCase()] 
               || METRO_DEFAULT_STAGE_COLORS[normKey] 
               || '#2563eb';
    return {
        key: normKey,
        label: rawStage,
        color: color
    };
}

/**
 * Actualiza dinámicamente la leyenda de la cabecera según los valores únicos de etapa encontrados.
 */
function updateMetroTimelineLegend(stageMap) {
    const legendEl = document.getElementById('metro-timeline-header-legend');
    if (!legendEl) return;

    let html = `
        <span class="timeline-legend-item">
            <span class="tl-legend-dot" style="background:#7c3aed; width:8px; height:8px; transform:rotate(45deg); border-radius:1px;"></span>Puesta en Servicio
        </span>
    `;

    Object.values(stageMap || {}).forEach(st => {
        html += `
            <span class="timeline-legend-item">
                <span class="tl-legend-dot" style="background:${st.color}; width:12px; height:6px; border-radius:2px;"></span>${st.label}
            </span>
        `;
    });

    html += `
        <span class="timeline-legend-item">
            <span style="display:inline-block;width:2px;height:12px;background:#ef4444;border-radius:1px;"></span>
            Hoy
        </span>
    `;

    legendEl.innerHTML = html;
}

if (typeof window !== 'undefined') {
    window.parseMetroMilestone = parseMetroMilestone;
    window.getMetroStagesMap = getMetroStagesMap;
    window.getMetroStageInfo = getMetroStageInfo;
    window.updateMetroTimelineLegend = updateMetroTimelineLegend;
}

function renderMetroTimeline(projects, highlightId = null) {
    const data = (projects && projects.length > 0)
        ? projects
        : ((window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : []);

    const badge = document.getElementById('metro-timeline-count-badge');
    if (badge) badge.textContent = `${data.length} Proyectos`;

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    // ── Mapeo dinámico de etapas uniques presentes en el Excel ────────────────
    const stageMap = getMetroStagesMap(data);
    updateMetroTimelineLegend(stageMap);

    // ── Mapear cada proyecto con sus métricas dinámicas desde el Excel ───────
    const timelineItems = data.map(proj => {
        const start = parseMetroYear(proj.start_date, 2024.0);
        const ms = parseMetroMilestone(proj.operation_year);

        let stageEnd = 2030.0;
        let schEnd = 2030.0;
        let milestoneLabel = `Puesta en Servicio ${proj.operation_year || ''}`.trim();

        if (ms) {
            milestoneLabel = ms.label;
            if (ms.type === 'point') {
                // Caso 1: Año solo -> La etapa termina en el hito
                stageEnd = ms.year + 0.5;
                schEnd = ms.year + 0.5;
            } else if (ms.type === 'range') {
                // Caso 2: Rango '2025-2026' -> La etapa termina al iniciar la ventana del hito
                stageEnd = ms.start;
                schEnd = ms.end + 1.0; // Abarca el año de término completo
            } else if (ms.type === 'open_range') {
                // Caso 3: Formato '2033+' -> La etapa previa termina al iniciar el periodo abierto
                stageEnd = ms.start;
                schEnd = ms.start + 3.0;
            }
        } else {
            stageEnd = parseMetroYear(proj.operation_year, 2030.0);
            schEnd = stageEnd;
        }

        const sch = {
            start: start,
            stageEnd: stageEnd,
            end: schEnd,
            milestone: ms,
            milestoneLabel: milestoneLabel
        };
        return { proj, sch };
    });

    // Ordenar cronológicamente por fecha de inicio / puesta en servicio
    timelineItems.sort((a, b) => (a.sch.start - b.sch.start) || (a.sch.stageEnd - b.sch.stageEnd));

    if (timelineItems.length === 0) {
        const barsContainer = document.getElementById('metro-timeline-bars-scroll');
        const labelCol = document.getElementById('metro-timeline-label-col');
        if (barsContainer) barsContainer.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-secondary);font-size:0.8rem;">No hay proyectos para mostrar en el cronograma.</div>';
        if (labelCol) labelCol.innerHTML = '';
        return;
    }

    // ── Layout Metrics ───────────────────────────────────────────────────────
    const ROW_PAD_V = 8;
    const rowMetrics = timelineItems.map(item => {
        const lines = wrapMetroTimelineText(item.proj.name, 30);
        const textH = lines.length * 13;
        const barH = METRO_TL_BAR_H;
        const height = Math.max(40, textH + ROW_PAD_V * 2);
        return { height, lines, barH };
    });

    const rowYOffsets = [];
    let cumY = 0;
    rowMetrics.forEach(m => { rowYOffsets.push(cumY); cumY += m.height; });
    const totalH = cumY;

    // Rango global de Años dinámico según datos del Excel (por defecto 2022 a 2034)
    let minYear = 2022;
    let maxYear = 2034;
    timelineItems.forEach(item => {
        if (item.sch.start && item.sch.start < minYear) minYear = Math.floor(item.sch.start);
        if (item.sch.milestone) {
            const ms = item.sch.milestone;
            if (ms.year && ms.year > maxYear - 1) maxYear = ms.year + 1;
            if (ms.end && ms.end > maxYear - 1) maxYear = ms.end + 1;
            if (ms.start && ms.start > maxYear - 1) maxYear = ms.start + 2;
        }
    });
    const todayYear = 2026.17; // Fecha actual / representativa

    // DOM references
    const barsEl = document.getElementById('metro-timeline-bars-scroll');
    const labelEl = document.getElementById('metro-timeline-label-col');
    const barsSvg = document.getElementById('metro-timeline-bars-svg');
    const axisSvg = document.getElementById('metro-timeline-axis-svg');
    const axisScrollEl = document.getElementById('metro-timeline-axis-scroll');
    const rowsWrapperEl = document.getElementById('metro-timeline-rows-wrapper');

    if (!barsEl || !labelEl || !barsSvg || !axisSvg) return;

    // Evitar desbordamiento horizontal
    barsEl.style.overflowX = 'hidden';
    if (axisScrollEl) axisScrollEl.style.overflowX = 'hidden';

    // Chart dimensions: ocupar el ancho visible disponible
    const availW = barsEl.clientWidth || ((barsEl.parentElement ? barsEl.parentElement.clientWidth : 900) - METRO_TL_LABEL_W);
    const chartW = Math.max(availW, 600);
    const yearRange = maxYear - minYear;
    const PAD_X = 22;
    function toPx(y) {
        return PAD_X + ((y - minYear) / yearRange) * (chartW - PAD_X * 2);
    }

    const isLight = document.body.classList.contains('light-theme');
    const textColor = isLight ? '#374151' : '#94a3b8';
    const gridColor = isLight ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.055)';
    const rowAltColor = isLight ? 'rgba(241,245,249,0.7)' : 'rgba(255,255,255,0.018)';
    const labelBg = isLight ? '#f8fafc' : '#0f1626';
    const labelColor = isLight ? '#1e293b' : '#e2e8f0';
    const textMuted = isLight ? '#64748b' : '#94a3b8';
    const sepColor = isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.07)';

    let highlightedRowIdx = -1;

    // ── 1. CONSTRUCCIÓN DE LA COLUMNA DE ETIQUETAS (LABELS) ─────────────────
    labelEl.innerHTML = '';
    const labelSvg = metroSvgEl('svg', {
        width: METRO_TL_LABEL_W,
        height: totalH,
        style: 'display: block;'
    });

    timelineItems.forEach((item, i) => {
        const p = item.proj;
        const rowY = rowYOffsets[i];
        const rowH = rowMetrics[i].height;
        const isHighlighted = highlightId && (p.id === highlightId || p.name === highlightId);
        if (isHighlighted) highlightedRowIdx = i;

        const lineColor = (window.METRO_LINE_COLORS && window.METRO_LINE_COLORS[p.line]) ? window.METRO_LINE_COLORS[p.line] : '#0284c7';

        // Background row
        const rowBg = isHighlighted
            ? (isLight ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.30)')
            : (i % 2 === 0 ? rowAltColor : 'transparent');

        labelSvg.appendChild(metroSvgEl('rect', {
            x: 0, y: rowY, width: METRO_TL_LABEL_W, height: rowH, fill: rowBg
        }));

        // Borde izquierdo con el color oficial de la línea
        labelSvg.appendChild(metroSvgEl('rect', {
            x: 0, y: rowY, width: 4.5, height: rowH, fill: lineColor
        }));

        // Línea separadora inferior
        labelSvg.appendChild(metroSvgEl('line', {
            x1: 0, y1: rowY + rowH, x2: METRO_TL_LABEL_W, y2: rowY + rowH,
            stroke: isHighlighted ? 'rgba(37, 99, 235, 0.3)' : sepColor, 'stroke-width': 1
        }));

        // Badge / Texto de Línea + Estado
        const lines = rowMetrics[i].lines;
        const txtGroup = metroSvgEl('g', { style: 'cursor: pointer;' });
        txtGroup.addEventListener('click', () => {
            hideMetroTimelineView();
            metroSelectProject(p);
        });

        // Nombre del Proyecto (multilínea, centrado verticalmente en la fila)
        const totalTextH = lines.length * 13;
        const startY = rowY + (rowH - totalTextH) / 2 + 10;
        const txtName = metroSvgEl('text', {
            x: 14,
            y: startY,
            fill: isHighlighted ? 'var(--primary)' : labelColor,
            'font-family': "'Plus Jakarta Sans', sans-serif",
            'font-size': '10',
            'font-weight': isHighlighted ? '800' : '700'
        });

        lines.forEach((lineStr, lineIdx) => {
            const tspan = metroSvgEl('tspan', {
                x: 14,
                dy: lineIdx === 0 ? 0 : 13
            });
            tspan.textContent = lineStr;
            txtName.appendChild(tspan);
        });
        txtGroup.appendChild(txtName);

        const ttl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        ttl.textContent = `${p.name} (${p.line})`;
        txtGroup.appendChild(ttl);

        labelSvg.appendChild(txtGroup);
    });
    labelEl.appendChild(labelSvg);

    // ── 2. CONSTRUCCIÓN DEL EJE DE AÑOS (STICKY AXIS) ────────────────────────
    axisSvg.setAttribute('width', chartW);
    axisSvg.setAttribute('height', METRO_TL_AXIS_H);
    axisSvg.innerHTML = '';

    axisSvg.appendChild(metroSvgEl('rect', {
        x: 0, y: 0, width: chartW, height: METRO_TL_AXIS_H, fill: labelBg
    }));

    // Ticks y etiquetas anuales
    for (let yr = minYear; yr <= maxYear; yr++) {
        const x = toPx(yr);
        const isMajor = (yr % 2 === 0);

        axisSvg.appendChild(metroSvgEl('line', {
            x1: x, y1: isMajor ? METRO_TL_AXIS_H - 10 : METRO_TL_AXIS_H - 5,
            x2: x, y2: METRO_TL_AXIS_H,
            stroke: isLight ? '#cbd5e1' : '#334155',
            'stroke-width': isMajor ? 1.5 : 1
        }));

        if (isMajor || yr === minYear || yr === maxYear) {
            const lbl = metroSvgEl('text', {
                x: x, y: METRO_TL_AXIS_H - 14,
                'text-anchor': 'middle',
                fill: textColor,
                'font-family': "'Plus Jakarta Sans', sans-serif",
                'font-size': '10',
                'font-weight': '600'
            });
            lbl.textContent = yr;
            axisSvg.appendChild(lbl);
        }
    }

    // Línea y Etiqueta "Hoy" en el eje
    if (todayYear >= minYear && todayYear <= maxYear) {
        const tx = toPx(todayYear);
        axisSvg.appendChild(metroSvgEl('line', {
            x1: tx, y1: 0, x2: tx, y2: METRO_TL_AXIS_H,
            stroke: '#ef4444', 'stroke-width': 1.5, 'stroke-dasharray': '3,3'
        }));
        const todayLbl = metroSvgEl('text', {
            x: tx + 3, y: 12, fill: '#ef4444',
            'font-family': "'Plus Jakarta Sans', sans-serif",
            'font-size': '9', 'font-weight': '700'
        });
        todayLbl.textContent = 'Hoy (2026)';
        axisSvg.appendChild(todayLbl);
    }

    axisSvg.appendChild(metroSvgEl('line', {
        x1: 0, y1: METRO_TL_AXIS_H - 1, x2: chartW, y2: METRO_TL_AXIS_H - 1,
        stroke: isLight ? '#e2e8f0' : '#1e293b', 'stroke-width': 1
    }));

    // ── 3. CONSTRUCCIÓN DE LAS BARRAS Y GANTT ────────────────────────────────
    barsSvg.setAttribute('width', chartW);
    barsSvg.setAttribute('height', totalH || 1);
    barsSvg.innerHTML = '';

    // Inyectar definiciones de gradientes para hitos SVG
    const defs = metroSvgEl('defs');
    defs.innerHTML = `
        <linearGradient id="metro-grad-open-range" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.88"/>
            <stop offset="50%" stop-color="#8b5cf6" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#7c3aed" stop-opacity="0.06"/>
        </linearGradient>
        <linearGradient id="metro-milestone-range-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.95"/>
        </linearGradient>
    `;
    barsSvg.appendChild(defs);

    timelineItems.forEach((item, i) => {
        const p = item.proj;
        const sch = item.sch;
        const rowY = rowYOffsets[i];
        const rowH = rowMetrics[i].height;
        const isHighlighted = highlightId && (p.id === highlightId || p.name === highlightId);

        const lineColor = (window.METRO_LINE_COLORS && window.METRO_LINE_COLORS[p.line]) ? window.METRO_LINE_COLORS[p.line] : '#0284c7';

        // Background row
        const rowBg = isHighlighted
            ? (isLight ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.22)')
            : (i % 2 === 0 ? rowAltColor : 'transparent');

        barsSvg.appendChild(metroSvgEl('rect', {
            x: 0, y: rowY, width: chartW, height: rowH, fill: rowBg
        }));

        // Línea separadora
        barsSvg.appendChild(metroSvgEl('line', {
            x1: 0, y1: rowY + rowH, x2: chartW, y2: rowY + rowH,
            stroke: isHighlighted ? 'rgba(37, 99, 235, 0.3)' : sepColor, 'stroke-width': 1
        }));

        // Cuadrícula vertical de años
        for (let yr = minYear; yr <= maxYear; yr++) {
            barsSvg.appendChild(metroSvgEl('line', {
                x1: toPx(yr), y1: rowY, x2: toPx(yr), y2: rowY + rowH,
                stroke: gridColor, 'stroke-width': 1
            }));
        }

        // Línea vertical "Hoy" a lo largo de toda la fila
        if (todayYear >= minYear && todayYear <= maxYear) {
            barsSvg.appendChild(metroSvgEl('line', {
                x1: toPx(todayYear), y1: rowY,
                x2: toPx(todayYear), y2: rowY + rowH,
                stroke: '#ef4444', 'stroke-width': 1.2,
                'stroke-dasharray': '3,3', 'pointer-events': 'none'
            }));
        }

        // Barra de Etapa del Proyecto coloreada según Etapa (Ejecución, Diseño, Factibilidad)
        const stageInfo = getMetroStageInfo(p, stageMap);
        const startY = sch.start;
        const endY = sch.stageEnd;
        const bx = toPx(startY);
        const bw = Math.max(toPx(endY) - bx, 20);
        const by = rowY + (rowH - METRO_TL_BAR_H) / 2;
        const bh = METRO_TL_BAR_H;

        const rect = metroSvgEl('rect', {
            x: bx, y: by, width: bw, height: bh,
            rx: 4, ry: 4, fill: stageInfo.color,
            opacity: isHighlighted ? 1 : 0.88,
            style: 'cursor: pointer; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.18));'
        });

        if (isHighlighted) {
            rect.setAttribute('stroke', '#ffffff');
            rect.setAttribute('stroke-width', '2');
        }

        rect.addEventListener('mouseenter', (e) => {
            rect.setAttribute('opacity', '1');
            rect.setAttribute('height', (bh + 2).toString());
            rect.setAttribute('y', (by - 1).toString());
            showMetroTimelineTooltip(e, p, sch, stageInfo);
        });
        rect.addEventListener('mousemove', (e) => moveMetroTimelineTooltip(e));
        rect.addEventListener('mouseleave', () => {
            rect.setAttribute('opacity', isHighlighted ? '1' : '0.88');
            rect.setAttribute('height', bh.toString());
            rect.setAttribute('y', by.toString());
            hideMetroTimelineTooltip();
        });
        rect.addEventListener('click', (e) => {
            e.stopPropagation();
            hideMetroTimelineTooltip();
            hideMetroTimelineView();
            metroSelectProject(p);
        });

        barsSvg.appendChild(rect);

        // Texto informativo dentro de la barra de Gantt (Solo el nombre de la etapa)
        if (bw > 24) {
            const barTxt = metroSvgEl('text', {
                x: bx + 8, y: by + bh / 2 + 0.5,
                'dominant-baseline': 'middle',
                fill: '#ffffff',
                'font-family': "'Plus Jakarta Sans', sans-serif",
                'font-size': '8.5', 'font-weight': '700',
                'pointer-events': 'none'
            });
            barTxt.textContent = stageInfo.label;
            barsSvg.appendChild(barTxt);
        }

        // ── Hito de Puesta en Servicio (Mapeo dinámico según valor del Excel) ──
        const ms = sch.milestone;
        if (ms) {
            if (ms.type === 'point') {
                // Caso 1: Año solo (ej. 2028, 2032, 2033) -> Hito puntual (rombo púrpura)
                const mx = toPx(ms.year + 0.5);
                const my = by + bh / 2;
                const d = METRO_TL_MILESTONE_R;
                const polyEnd = metroSvgEl('polygon', {
                    points: `${mx},${my - d} ${mx + d},${my} ${mx},${my + d} ${mx - d},${my}`,
                    fill: '#7c3aed', stroke: '#ffffff', 'stroke-width': 1.8,
                    style: 'cursor: pointer; filter: drop-shadow(0 2px 4px rgba(124, 58, 237, 0.45));'
                });
                polyEnd.addEventListener('mouseenter', (e) => {
                    polyEnd.setAttribute('stroke-width', '2.5');
                    polyEnd.setAttribute('fill', '#8b5cf6');
                    showMetroMilestoneTooltip(e, p.name, 'Puesta en Servicio Estimada', `${ms.year}`, '#7c3aed');
                });
                polyEnd.addEventListener('mousemove', (e) => moveMetroTimelineTooltip(e));
                polyEnd.addEventListener('mouseleave', () => {
                    polyEnd.setAttribute('stroke-width', '1.8');
                    polyEnd.setAttribute('fill', '#7c3aed');
                    hideMetroTimelineTooltip();
                });
                polyEnd.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideMetroTimelineTooltip();
                    hideMetroTimelineView();
                    metroSelectProject(p);
                });
                barsSvg.appendChild(polyEnd);

            } else if (ms.type === 'range') {
                // Caso 2: Formato '2025-2026' / '2027 - 2028' (Barra de periodo para el hito)
                const mx1 = toPx(ms.start);
                const mx2 = toPx(ms.end + 1.0);
                const mw = Math.max(mx2 - mx1, 24);

                const rangeG = metroSvgEl('g', { style: 'cursor: pointer;' });

                const rangeRect = metroSvgEl('rect', {
                    x: mx1, y: by, width: mw, height: bh,
                    rx: 4, ry: 4,
                    fill: 'url(#metro-milestone-range-grad)',
                    stroke: '#a78bfa', 'stroke-width': 1.2,
                    opacity: 0.95,
                    style: 'filter: drop-shadow(0 2px 6px rgba(124, 58, 237, 0.35));'
                });
                rangeG.appendChild(rangeRect);

                // Mini icono rombo blanco al inicio de la barra
                const dMini = 3.5;
                const rmx = mx1 + 7;
                const rmy = by + bh / 2;
                const rPoly = metroSvgEl('polygon', {
                    points: `${rmx},${rmy - dMini} ${rmx + dMini},${rmy} ${rmx},${rmy + dMini} ${rmx - dMini},${rmy}`,
                    fill: '#ffffff', opacity: 0.95
                });
                rangeG.appendChild(rPoly);

                // Texto informativo del periodo
                if (mw > 35) {
                    const rangeTxt = metroSvgEl('text', {
                        x: mx1 + 15, y: by + bh / 2 + 0.5,
                        'dominant-baseline': 'middle',
                        fill: '#ffffff',
                        'font-family': "'Plus Jakarta Sans', sans-serif",
                        'font-size': '8', 'font-weight': '700',
                        'pointer-events': 'none'
                    });
                    const rTxt = ms.raw || ms.displayTag;
                    rangeTxt.textContent = (mw >= 70) ? `P. Servicio ${rTxt}` : rTxt;
                    rangeG.appendChild(rangeTxt);
                }

                rangeG.addEventListener('mouseenter', (e) => {
                    rangeRect.setAttribute('opacity', '1');
                    rangeRect.setAttribute('stroke', '#ffffff');
                    showMetroMilestoneTooltip(e, p.name, 'Puesta en Servicio Estimada', ms.raw || `${ms.start} - ${ms.end}`, '#7c3aed');
                });
                rangeG.addEventListener('mousemove', (e) => moveMetroTimelineTooltip(e));
                rangeG.addEventListener('mouseleave', () => {
                    rangeRect.setAttribute('opacity', '0.95');
                    rangeRect.setAttribute('stroke', '#a78bfa');
                    hideMetroTimelineTooltip();
                });
                rangeG.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideMetroTimelineTooltip();
                    hideMetroTimelineView();
                    metroSelectProject(p);
                });
                barsSvg.appendChild(rangeG);

            } else if (ms.type === 'open_range') {
                // Caso 3: Formato '2033+' / '2030+' (Barra sin fin con concepto matemático [a, [)
                const mx1 = toPx(ms.start);
                const mx2 = chartW - PAD_X;
                const mw = Math.max(mx2 - mx1, 40);

                const openG = metroSvgEl('g', { style: 'cursor: pointer;' });

                // 1. Relleno degradado púrpura hacia la derecha (desvanecimiento al infinito)
                const openRect = metroSvgEl('rect', {
                    x: mx1, y: by, width: mw, height: bh,
                    fill: 'url(#metro-grad-open-range)'
                });
                openG.appendChild(openRect);

                // 2. Líneas superior e inferior punteadas para indicar continuidad indefinida
                const topLine = metroSvgEl('line', {
                    x1: mx1, y1: by, x2: mx2, y2: by,
                    stroke: '#c4b5fd', 'stroke-width': 1.2, 'stroke-dasharray': '4,3'
                });
                const botLine = metroSvgEl('line', {
                    x1: mx1, y1: by + bh, x2: mx2, y2: by + bh,
                    stroke: '#c4b5fd', 'stroke-width': 1.2, 'stroke-dasharray': '4,3'
                });
                openG.appendChild(topLine);
                openG.appendChild(botLine);

                // 3. Corchete cerrado '[' en el inicio del hito (a = mx1)
                // Representa que el intervalo comienza formalmente en ese año
                const bracketLeft = metroSvgEl('path', {
                    d: `M ${mx1 + 6} ${by} L ${mx1} ${by} L ${mx1} ${by + bh} L ${mx1 + 6} ${by + bh}`,
                    stroke: '#ffffff', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'square'
                });
                openG.appendChild(bracketLeft);

                // 4. Corchete abierto '[' al extremo derecho (mx2)
                // En notación matemática [a, b[, el corchete mirando hacia afuera representa que NO tiene fin cerrado
                const bracketRight = metroSvgEl('path', {
                    d: `M ${mx2} ${by} L ${mx2 - 6} ${by} M ${mx2 - 6} ${by} L ${mx2 - 6} ${by + bh} M ${mx2 - 6} ${by + bh} L ${mx2} ${by + bh}`,
                    stroke: '#c4b5fd', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'square'
                });
                openG.appendChild(bracketRight);

                // 5. Etiqueta con 'P. Servicio ' + texto del Excel (ej. P. Servicio 2030+) dentro de la barra
                const openTxt = metroSvgEl('text', {
                    x: mx1 + 14, y: by + bh / 2 + 0.5,
                    'dominant-baseline': 'middle',
                    fill: '#ffffff',
                    'font-family': "'Plus Jakarta Sans', sans-serif",
                    'font-size': '8.5', 'font-weight': '700',
                    'letter-spacing': '0.3px',
                    'pointer-events': 'none'
                });
                const excelText = ms.raw || `${ms.start}+`;
                openTxt.textContent = `P. Servicio ${excelText}`;
                openG.appendChild(openTxt);

                openG.addEventListener('mouseenter', (e) => {
                    openRect.setAttribute('opacity', '1');
                    bracketLeft.setAttribute('stroke-width', '3');
                    bracketRight.setAttribute('stroke-width', '3');
                    showMetroMilestoneTooltip(e, p.name, 'Puesta en Servicio Estimada', ms.raw || `${ms.start}+`, '#7c3aed');
                });
                openG.addEventListener('mousemove', (e) => moveMetroTimelineTooltip(e));
                openG.addEventListener('mouseleave', () => {
                    bracketLeft.setAttribute('stroke-width', '2.4');
                    bracketRight.setAttribute('stroke-width', '2.4');
                    hideMetroTimelineTooltip();
                });
                openG.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideMetroTimelineTooltip();
                    hideMetroTimelineView();
                    metroSelectProject(p);
                });
                barsSvg.appendChild(openG);
            }
        }
    });

    // ── 4. SINCRONIZACIÓN DE SCROLL HORIZONTAL Y VERTICAL ───────────────────
    if (barsEl && axisScrollEl) {
        barsEl.onscroll = () => {
            axisScrollEl.scrollLeft = barsEl.scrollLeft;
        };
    }

    if (highlightedRowIdx !== -1 && rowYOffsets[highlightedRowIdx] !== undefined && rowsWrapperEl) {
        setTimeout(() => {
            const targetScrollTop = Math.max(0, rowYOffsets[highlightedRowIdx] - 80);
            rowsWrapperEl.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        }, 120);
    }
}

// ── Tooltip interactivo flotante idéntico a index.html ───────────────────────
function showMetroTimelineTooltip(e, p, sch, stageInfo) {
    const tip = document.getElementById('metro-timeline-tooltip');
    if (!tip) return;

    const info = stageInfo || getMetroStageInfo(p);
    const color = info.color;
    const stageLabel = info.label;

    const avFisico = (p.physical_progress_pct !== null && p.physical_progress_pct !== undefined && typeof p.physical_progress_pct === 'number')
        ? `${(p.physical_progress_pct * 100).toFixed(1)}%`
        : (p.physical_progress_str || '—');

    const inv = p.investment_mm_usd
        ? `US$ ${Number(p.investment_mm_usd).toLocaleString('es-CL')} MM`
        : (p.investment_str || 'Incluida en L7/L9');

    const rcaStatus = p.environmental_classification || p.environmental_status || 'En evaluación';

    tip.innerHTML = `
        <div style="font-weight: 800; font-size: 0.8rem; color: ${color}; margin-bottom: 0.35rem; line-height: 1.25; border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 0.25rem;">
            ${p.name}
        </div>
        <div class="timeline-tooltip-row" style="display:flex; justify-content:space-between; gap:0.5rem; margin-bottom:0.18rem; font-size:0.72rem;">
            <span style="color:var(--text-secondary);">Etapa Actual:</span>
            <span style="font-weight:700; color:${color};">${stageLabel}</span>
        </div>
        <div class="timeline-tooltip-row" style="display:flex; justify-content:space-between; gap:0.5rem; margin-bottom:0.18rem; font-size:0.72rem;">
            <span style="color:var(--text-secondary);">Avance Físico:</span>
            <span style="font-weight:700; color:var(--text-primary);">${avFisico}</span>
        </div>
        <div class="timeline-tooltip-row" style="display:flex; justify-content:space-between; gap:0.5rem; margin-bottom:0.18rem; font-size:0.72rem;">
            <span style="color:var(--text-secondary);">Inversión:</span>
            <span style="font-weight:700; color:var(--text-primary);">${inv}</span>
        </div>
        <div class="timeline-tooltip-row" style="display:flex; justify-content:space-between; gap:0.5rem; font-size:0.72rem;">
            <span style="color:var(--text-secondary);">Estado de RCA:</span>
            <span style="font-weight:600; color:var(--text-primary);">${rcaStatus}</span>
        </div>
    `;
    tip.style.display = 'block';
    moveMetroTimelineTooltip(e);
}

function showMetroMilestoneTooltip(e, projectName, milestoneType, dateVal, color) {
    const tip = document.getElementById('metro-timeline-tooltip');
    if (!tip) return;

    tip.innerHTML = `
        <div style="font-weight: 800; font-size: 0.78rem; color: ${color}; margin-bottom: 0.25rem;">
            ${projectName}
        </div>
        <div class="timeline-tooltip-row" style="display:flex; justify-content:space-between; gap:0.5rem; margin-bottom:0.15rem; font-size:0.72rem;">
            <span style="color:var(--text-secondary);">Hito:</span>
            <span style="font-weight:700; color:${color};">${milestoneType}</span>
        </div>
        <div class="timeline-tooltip-row" style="display:flex; justify-content:space-between; gap:0.5rem; font-size:0.72rem;">
            <span style="color:var(--text-secondary);">Fecha / Periodo:</span>
            <span style="font-weight:600; color:var(--text-primary);">${dateVal}</span>
        </div>
    `;
    tip.style.display = 'block';
    moveMetroTimelineTooltip(e);
}

function moveMetroTimelineTooltip(e) {
    const tip = document.getElementById('metro-timeline-tooltip');
    if (!tip || tip.style.display === 'none') return;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let tx = e.clientX + 14;
    let ty = e.clientY - 12;

    if (tx + tw + 10 > window.innerWidth) {
        tx = e.clientX - tw - 14;
    }
    if (ty + th + 10 > window.innerHeight) {
        ty = window.innerHeight - th - 10;
    }
    if (ty < 10) ty = 10;

    tip.style.left = tx + 'px';
    tip.style.top = ty + 'px';
}

function hideMetroTimelineTooltip() {
    const tip = document.getElementById('metro-timeline-tooltip');
    if (tip) tip.style.display = 'none';
}

// ── Listener de redimensionamiento de ventana (Auto-fit dinámico) ───────────
let metroTimelineResizeTimer = null;
if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
        if (typeof metroState !== 'undefined' && metroState.timelineOpen && typeof renderMetroTimeline === 'function') {
            clearTimeout(metroTimelineResizeTimer);
            metroTimelineResizeTimer = setTimeout(() => {
                const currentList = (typeof metroGetFilteredProjects === 'function')
                    ? metroGetFilteredProjects()
                    : ((window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : []);
                renderMetroTimeline(currentList);
            }, 80);
        }
    });

    window.showMetroTimelineView = showMetroTimelineView;
    window.hideMetroTimelineView = hideMetroTimelineView;
    window.renderMetroTimeline = renderMetroTimeline;
}
