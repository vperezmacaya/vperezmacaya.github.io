/**
 * static/js/EFE/timeline.js
 * Visualización de Líneas de Tiempo (Gantt) para proyectos EFE Trenes de Chile.
 * Harmonized with CATLEC index.html design palette, fonts, and SVG styling.
 */

// ── Parse date string → fractional year number (standard CATLEC) ──────
function dateToYear(str) {
    if (!str) return null;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const start = new Date(y, 0, 1);
    const end = new Date(y + 1, 0, 1);
    return y + (d - start) / (end - start);
}

// ── Paleta de Colores por Etapa (CATLEC EFE) ──────────────────────────────────
const EFE_STAGE_COLORS = {
    'ejecución': '#2563eb',      // Azul Real
    'ejecucion': '#2563eb',
    'diseño': '#ea580c',         // Naranja Intenso
    'diseno': '#ea580c',
    'factibilidad': '#0891b2',   // Turquesa / Cian profundo
    'prefactibilidad': '#8b5cf6',// Violeta
    'estudio básico': '#6366f1', // Índigo
    'estudio basico': '#6366f1',
    'estudio': '#6366f1',
    'operación': '#10b981',      // Verde Esmeralda
    'operacion': '#10b981',
    'programa con componentes en distintas fases': 'rgba(100, 116, 139, 0.45)', // Gris transparente
    'programa con componentes en distinta fase': 'rgba(100, 116, 139, 0.45)',
    'programa con compenentes en distintas fases': 'rgba(100, 116, 139, 0.45)',
    'programa con compenentes en distinta fase': 'rgba(100, 116, 139, 0.45)'
};

function getEfeStageSingleColor(stageStr) {
    if (!stageStr) return '#2563eb';
    const clean = String(stageStr).trim().toLowerCase();
    const norm = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (norm.includes('programa') || norm.includes('componente') || norm.includes('compenente')) {
        return 'rgba(100, 116, 139, 0.45)';
    }
    return EFE_STAGE_COLORS[clean] || EFE_STAGE_COLORS[norm] || '#2563eb';
}

/**
 * Analiza la etapa de un proyecto.
 * Para casos con 2 etapas al mismo tiempo (ej: "Ejecución - diseño", "Diseño - Ejecución", "Factibilidad - Ejecución"):
 * Configura un patrón SVG con franjas diagonales a 45° con ambos colores.
 */
function parseEfeStageInfo(stageRaw) {
    const raw = (stageRaw && String(stageRaw).trim()) ? String(stageRaw).trim() : 'Sin Etapa';
    let parts = [raw];
    if (/\s+[-–/]\s+/.test(raw)) {
        parts = raw.split(/\s+[-–/]\s+/).map(s => s.trim()).filter(Boolean);
    }
    if (parts.length >= 2) {
        const c1 = getEfeStageSingleColor(parts[0]);
        const c2 = getEfeStageSingleColor(parts[1]);
        const safeKey1 = parts[0].toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
        const safeKey2 = parts[1].toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
        const patternId = `efe-pattern-${safeKey1}-${safeKey2}`;
        return {
            isCompound: true,
            stages: parts,
            color1: c1,
            color2: c2,
            patternId: patternId,
            fill: `url(#${patternId})`,
            stroke: c1,
            label: raw,
            legendGradient: `repeating-linear-gradient(45deg, ${c1}, ${c1} 4px, ${c2} 4px, ${c2} 8px)`
        };
    } else {
        const c = getEfeStageSingleColor(parts[0] || raw);
        const isTransp = typeof c === 'string' && c.startsWith('rgba');
        return {
            isCompound: false,
            stages: [raw],
            color1: c,
            color2: null,
            patternId: null,
            fill: c,
            stroke: isTransp ? '#64748b' : c,
            label: raw,
            legendGradient: c
        };
    }
}

/** Actualiza dinámicamente la leyenda del timeline mostrando solo los colores base de las etapas presentes */
function updateEfeTimelineLegend(projects) {
    const legendEl = document.getElementById('efe-timeline-header-legend');
    if (!legendEl) return;

    const uniqueBaseStages = [];
    const seen = new Set();

    (projects || []).forEach(p => {
        const raw = (p.stage && String(p.stage).trim()) ? String(p.stage).trim() : 'Sin Etapa';
        const parts = /\s+[-–/]\s+/.test(raw)
            ? raw.split(/\s+[-–/]\s+/).map(s => s.trim()).filter(Boolean)
            : [raw];

        parts.forEach(st => {
            const key = st.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (!seen.has(key)) {
                seen.add(key);
                uniqueBaseStages.push(st);
            }
        });
    });

    let html = '';
    uniqueBaseStages.forEach(stName => {
        const color = getEfeStageSingleColor(stName);
        const isTransp = typeof color === 'string' && color.startsWith('rgba');
        const borderStyle = isTransp ? 'border: 1px solid #94a3b8;' : '';
        html += `
            <span class="timeline-legend-item">
                <span class="tl-legend-dot" style="background:${color}; width:11px; height:7px; border-radius:2px; ${borderStyle}"></span>${stName}
            </span>
        `;
    });

    html += `
        <span class="timeline-legend-item">
            <span class="tl-legend-dot" style="background:#10b981; border-radius:50%; text-align:center; color:#fff; font-size:7px; line-height:10px; width:10px; height:10px;">✓</span>Operativo
        </span>
        <span class="timeline-legend-item">
            <span class="tl-legend-dot" style="background:#10b981; transform:rotate(45deg); width:7px; height:7px; border-radius:1px;"></span>Puesta en Operación
        </span>
        <span class="timeline-legend-item">
            <span style="display:inline-block;width:2px;height:12px;background:#ef4444;border-radius:1px;"></span>Hoy
        </span>
    `;

    legendEl.innerHTML = html;
}

const EFE_TL_ROW_PAD_V = 7;
const EFE_TL_BAR_H = 14;
const EFE_TL_AXIS_H = 36;
const EFE_TL_LABEL_W = 240;
const EFE_TL_MILESTONE_R = 6.5;

// ── Parsea el valor de la columna "Operación estimada" (Excel) y determina la tipología del hito ──
/**
 * Soporta:
 * 1. Año solo ('2028', '2032'): Hito puntual (rombo esmeralda en ese año).
 * 2. Rango de años ('2025-2026', '2030 - 2032'): Barra de periodo entre esos años.
 * 3. Formato sin fin claro ('2030+', '2030 +'): Barra abierta con concepto matemático [a, [.
 */
function parseEfeMilestone(val) {
    if (val == null) return null;
    const s = String(val).trim();
    if (!s) return null;

    // Caso 3: Formato '2030+', '2030 +', etc. (Intervalo abierto)
    const mOpen = s.match(/(20\d\d)\s*\+/);
    if (mOpen) {
        const startYr = parseInt(mOpen[1], 10);
        return {
            type: 'open_range',
            start: startYr,
            label: `Puesta en Operación Estimada ${s}`,
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
            label: `Puesta en Operación Estimada ${s}`,
            displayTag: s,
            raw: s
        };
    }

    // Caso 1: Año solo '2028', '2032' (Hito puntual)
    const mSingle = s.match(/(20\d\d)/);
    if (mSingle) {
        const y = parseInt(mSingle[1], 10);
        return {
            type: 'point',
            year: y,
            label: `Puesta en Operación Estimada ${y}`,
            displayTag: String(y),
            raw: s
        };
    }

    return null;
}

/** Extrae un número de año desde el operation_year (que puede ser int, string, etc.) */
function efeGetNumericYear(val) {
    if (val == null) return null;
    if (typeof val === 'number') return val;
    const m = String(val).match(/(20\d\d)/);
    return m ? parseInt(m[1], 10) : null;
}


function showEfeTimelineView() {
    if (efeState.investmentOpen && typeof hideEfeInvestmentView === 'function') {
        hideEfeInvestmentView();
    }
    efeState.timelineOpen = true;

    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const tlPanel = document.getElementById('efe-timeline-full-panel');
    const btnMap = document.getElementById('btn-efe-view-map');
    const btnInv = document.getElementById('btn-efe-view-investment');
    const btnTl = document.getElementById('btn-efe-view-timeline');

    if (grid) grid.style.gridTemplateColumns = '280px 1fr';
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (tlPanel) tlPanel.style.display = 'flex';

    if (btnMap) btnMap.classList.remove('active');
    if (btnInv) btnInv.classList.remove('active');
    if (btnTl) btnTl.classList.add('active');

    if (window.location.hash !== '#timeline') {
        history.replaceState(null, null, '#timeline');
    }

    const currentList = (typeof efeGetFilteredProjects === 'function')
        ? efeGetFilteredProjects()
        : ((typeof currentFilteredEFEProjects !== 'undefined' && currentFilteredEFEProjects)
            ? currentFilteredEFEProjects
            : ((window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : []));

    renderEfeTimeline(currentList);
}

function hideEfeTimelineView() {
    efeState.timelineOpen = false;

    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const tlPanel = document.getElementById('efe-timeline-full-panel');
    const btnMap = document.getElementById('btn-efe-view-map');
    const btnTl = document.getElementById('btn-efe-view-timeline');

    if (grid) grid.style.gridTemplateColumns = '';
    if (centerPanel) centerPanel.style.display = 'flex';
    if (rightPanel) rightPanel.style.display = 'flex';
    if (tlPanel) tlPanel.style.display = 'none';

    if (btnTl) btnTl.classList.remove('active');
    if (btnMap && !efeState.investmentOpen) btnMap.classList.add('active');

    if (window.location.hash === '#timeline') {
        history.replaceState(null, null, window.location.pathname + window.location.search);
    }

    if (typeof efeMap !== 'undefined' && efeMap) {
        setTimeout(() => {
            efeMap.invalidateSize({ animate: false });
            if (!efeState.selectedProjectName && typeof efeApplyDefaultMapView === 'function') {
                efeApplyDefaultMapView(false);
            }
        }, 50);
    }
}

// ── SVG Helper ───────────────────────────────────────────────────────────────
function efeSvgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
}

function efeWrapText(text, maxChars = 32) {
    if (!text) return ['—'];
    const words = text.toString().split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(w => {
        if ((currentLine + (currentLine ? ' ' : '') + w).length <= maxChars) {
            currentLine += (currentLine ? ' ' : '') + w;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = w;
        }
    });
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [text];
}

// ── Main Timeline Render ─────────────────────────────────────────────────────
function renderEfeTimeline(projects, highlightName = null) {
    const data = (projects && projects.length > 0)
        ? projects
        : ((window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : []);

    const badge = document.getElementById('efe-timeline-count-badge');
    if (badge) badge.textContent = `${data.length} proyecto${data.length !== 1 ? 's' : ''}`;

    // Actualizar dinámicamente la leyenda con las etapas presentes
    updateEfeTimelineLegend(data);

    const todayYear = dateToYear(new Date().toISOString().slice(0, 10));

    const opYears = data.map(p => efeGetNumericYear(p.operation_year)).filter(y => y != null && !isNaN(y));
    const maxOp = opYears.length > 0 ? Math.max(...opYears) : Math.floor(todayYear);

    // ── Sort projects for timeline display (ascendente por operación estimada) ──
    const sortedData = [...data].sort((a, b) => {
        const numA = efeGetNumericYear(a.operation_year);
        const numB = efeGetNumericYear(b.operation_year);
        if (numA == null && numB == null) return 0;
        if (numA == null) return 1;
        if (numB == null) return -1;
        if (numA !== numB) return numA - numB;
        // Desempate: si dos proyectos tienen fecha "2030" y "2030 +", aparece primero el año a secas
        const hasPlusA = String(a.operation_year).includes('+') ? 1 : 0;
        const hasPlusB = String(b.operation_year).includes('+') ? 1 : 0;
        if (hasPlusA !== hasPlusB) return hasPlusA - hasPlusB;
        return 0;
    });

    // Recolectar patrones diagonales para etapas compuestas presentes en los proyectos
    const compoundPatterns = new Map();
    sortedData.forEach(p => {
        const stInfo = parseEfeStageInfo(p.stage);
        if (stInfo.isCompound && !compoundPatterns.has(stInfo.patternId)) {
            compoundPatterns.set(stInfo.patternId, stInfo);
        }
    });

    // ── Calculate Year Range for Axis ───────────────────────────────────────
    let minYear = 2023;
    let maxYear = Math.max(2032, maxOp);

    // ── Row Metrics ─────────────────────────────────────────────────────────
    const rowMetrics = sortedData.map(p => {
        const lines = efeWrapText(p.name, 30);
        const textH = lines.length * 13;
        const height = Math.max(EFE_TL_ROW_PAD_V * 2 + EFE_TL_BAR_H, textH + EFE_TL_ROW_PAD_V * 2);
        return { height, lines };
    });

    const rowYOffsets = [];
    let cumY = 0;
    rowMetrics.forEach(m => { rowYOffsets.push(cumY); cumY += m.height; });
    const totalH = cumY;

    // DOM references
    const barsEl = document.getElementById('efe-timeline-bars-scroll');
    const labelEl = document.getElementById('efe-timeline-label-col');
    const barsSvg = document.getElementById('efe-timeline-bars-svg');
    const axisSvg = document.getElementById('efe-timeline-axis-svg');

    if (!barsEl || !labelEl || !barsSvg || !axisSvg) return;

    // Width calculation
    const availW = (barsEl.parentElement.parentElement.offsetWidth || 900) - EFE_TL_LABEL_W - 2;
    const chartW = Math.max(availW, 600);
    const PADDING_LEFT = 35;
    const PADDING_RIGHT = 50;
    const chartInnerW = chartW - PADDING_LEFT - PADDING_RIGHT;
    const yearRange = maxYear - minYear;
    function toPx(y) { return PADDING_LEFT + ((y - minYear) / yearRange) * chartInnerW; }

    const isLight = document.body.classList.contains('light-theme');
    const textColor = isLight ? '#374151' : '#94a3b8';
    const gridColor = isLight ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.055)';
    const rowAltColor = isLight ? 'rgba(241,245,249,0.7)' : 'rgba(255,255,255,0.018)';
    const labelBg = isLight ? '#f8fafc' : '#0f1626';
    const labelColor = isLight ? '#1e293b' : '#e2e8f0';
    const sepColor = isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.07)';

    let highlightedRowIdx = -1;

    // ── 1. BUILD LABELS (Left Column) ────────────────────────────────────────
    labelEl.innerHTML = '';
    const labelSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    labelSvg.setAttribute('width', EFE_TL_LABEL_W);
    labelSvg.setAttribute('height', totalH);
    labelSvg.style.display = 'block';

    // Inyectar defs para dots con patrones diagonales en labelSvg
    const labelDefs = efeSvgEl('defs');
    compoundPatterns.forEach(st => {
        const pat = efeSvgEl('pattern', {
            id: `lbl-${st.patternId}`,
            width: 8,
            height: 8,
            patternUnits: 'userSpaceOnUse',
            patternTransform: 'rotate(45)'
        });
        pat.appendChild(efeSvgEl('rect', { x: 0, y: 0, width: 4, height: 8, fill: st.color1 }));
        pat.appendChild(efeSvgEl('rect', { x: 4, y: 0, width: 4, height: 8, fill: st.color2 }));
        labelDefs.appendChild(pat);
    });
    labelSvg.appendChild(labelDefs);

    sortedData.forEach((p, i) => {
        const rowY = rowYOffsets[i];
        const rowH = rowMetrics[i].height;
        const isHighlighted = highlightName && p.name === highlightName;
        if (isHighlighted) highlightedRowIdx = i;

        const rowBg = isHighlighted
            ? (isLight ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.30)')
            : (i % 2 === 0 ? rowAltColor : 'transparent');

        // Background
        labelSvg.appendChild(efeSvgEl('rect', {
            x: 0, y: rowY, width: EFE_TL_LABEL_W, height: rowH, fill: rowBg
        }));

        // Left accent bar if highlighted
        if (isHighlighted) {
            labelSvg.appendChild(efeSvgEl('rect', {
                x: 0, y: rowY, width: 4, height: rowH, fill: 'var(--primary)'
            }));
        }

        // Row bottom separator line
        labelSvg.appendChild(efeSvgEl('line', {
            x1: 0, y1: rowY + rowH, x2: EFE_TL_LABEL_W, y2: rowY + rowH,
            stroke: isHighlighted ? 'rgba(37, 99, 235, 0.3)' : sepColor, 'stroke-width': 1
        }));

        // Stage color indicator dot (coloreado según etapa)
        const stageInfo = parseEfeStageInfo(p.stage);
        labelSvg.appendChild(efeSvgEl('circle', {
            cx: 14, cy: rowY + rowH / 2, r: 3.5,
            fill: stageInfo.isCompound ? `url(#lbl-${stageInfo.patternId})` : stageInfo.color1,
            stroke: stageInfo.isCompound ? 'rgba(0,0,0,0.2)' : 'none',
            'stroke-width': stageInfo.isCompound ? 0.8 : 0
        }));

        // Multiline project text
        const lines = rowMetrics[i].lines;
        const lineCount = lines.length;
        const txt = efeSvgEl('text', {
            x: 24,
            y: rowY + rowH / 2,
            'text-anchor': 'start',
            'dominant-baseline': 'middle',
            fill: isHighlighted ? 'var(--primary)' : labelColor,
            'font-family': "'Plus Jakarta Sans', sans-serif",
            'font-size': '10',
            'font-weight': isHighlighted ? '700' : '500',
            style: 'cursor: pointer;'
        });

        const lineHeight = 13;
        const startDY = -((lineCount - 1) * lineHeight) / 2;

        lines.forEach((lineStr, lineIdx) => {
            const tspan = efeSvgEl('tspan', {
                x: 24,
                dy: lineIdx === 0 ? startDY : lineHeight
            });
            tspan.textContent = lineStr;
            txt.appendChild(tspan);
        });

        const ttl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        ttl.textContent = `${p.name} (${p.filial || 'EFE'})`;
        txt.appendChild(ttl);

        // Click to view project details
        txt.addEventListener('click', () => {
            hideEfeTimelineView();
            if (typeof efeSelectProject === 'function') {
                efeSelectProject(p);
            }
        });

        labelSvg.appendChild(txt);
    });
    labelEl.appendChild(labelSvg);

    // ── 2. BUILD AXIS (Sticky Top Year Bar) ──────────────────────────────────
    axisSvg.setAttribute('width', chartW);
    axisSvg.setAttribute('height', EFE_TL_AXIS_H);
    axisSvg.innerHTML = '';

    axisSvg.appendChild(efeSvgEl('rect', {
        x: 0, y: 0, width: chartW, height: EFE_TL_AXIS_H, fill: labelBg
    }));

    for (let yr = minYear; yr <= maxYear; yr++) {
        const x = toPx(yr);
        axisSvg.appendChild(efeSvgEl('line', {
            x1: x, y1: EFE_TL_AXIS_H - 8, x2: x, y2: EFE_TL_AXIS_H,
            stroke: isLight ? '#cbd5e1' : '#334155', 'stroke-width': 1
        }));
        const lbl = efeSvgEl('text', {
            x: x, y: EFE_TL_AXIS_H - 12, 'text-anchor': 'middle',
            fill: textColor,
            'font-family': "'Plus Jakarta Sans', sans-serif",
            'font-size': '10', 'font-weight': '600'
        });
        lbl.textContent = yr;
        axisSvg.appendChild(lbl);
    }

    // Today indicator line in axis
    if (todayYear >= minYear && todayYear <= maxYear) {
        const tx = toPx(todayYear);
        axisSvg.appendChild(efeSvgEl('line', {
            x1: tx, y1: 0, x2: tx, y2: EFE_TL_AXIS_H,
            stroke: '#ef4444', 'stroke-width': 1.5, 'stroke-dasharray': '3,3'
        }));
        const todayLbl = efeSvgEl('text', {
            x: tx + 3, y: 12, fill: '#ef4444',
            'font-family': "'Plus Jakarta Sans', sans-serif",
            'font-size': '9', 'font-weight': '700'
        });
        todayLbl.textContent = 'Hoy';
        axisSvg.appendChild(todayLbl);
    }

    axisSvg.appendChild(efeSvgEl('line', {
        x1: 0, y1: EFE_TL_AXIS_H - 1, x2: chartW, y2: EFE_TL_AXIS_H - 1,
        stroke: isLight ? '#e2e8f0' : '#1e293b', 'stroke-width': 1
    }));

    // ── 3. BUILD BARS (Gantt Rows) ──────────────────────────────────────────
    barsSvg.setAttribute('width', chartW);
    barsSvg.setAttribute('height', totalH || 1);
    barsSvg.innerHTML = '';

    // Inyectar definiciones de gradientes para hitos SVG (open_range y range) y patrones diagonales de etapas
    const efeDefs = efeSvgEl('defs');
    efeDefs.innerHTML = `
        <linearGradient id="efe-grad-open-range" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.88"/>
            <stop offset="50%" stop-color="#34d399" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.06"/>
        </linearGradient>
        <linearGradient id="efe-milestone-range-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="#34d399" stop-opacity="0.95"/>
        </linearGradient>
    `;

    compoundPatterns.forEach(st => {
        const pat = efeSvgEl('pattern', {
            id: st.patternId,
            width: 16,
            height: 16,
            patternUnits: 'userSpaceOnUse',
            patternTransform: 'rotate(45)'
        });
        pat.appendChild(efeSvgEl('rect', { x: 0, y: 0, width: 8, height: 16, fill: st.color1 }));
        pat.appendChild(efeSvgEl('rect', { x: 8, y: 0, width: 8, height: 16, fill: st.color2 }));
        efeDefs.appendChild(pat);
    });
    barsSvg.appendChild(efeDefs);

    sortedData.forEach((p, i) => {
        const rowY = rowYOffsets[i];
        const rowH = rowMetrics[i].height;
        const isHighlighted = highlightName && p.name === highlightName;

        const rowBg = isHighlighted
            ? (isLight ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.22)')
            : (i % 2 === 0 ? rowAltColor : 'transparent');

        // Row background rect
        barsSvg.appendChild(efeSvgEl('rect', {
            x: 0, y: rowY, width: chartW, height: rowH, fill: rowBg
        }));

        // Row bottom separator line
        barsSvg.appendChild(efeSvgEl('line', {
            x1: 0, y1: rowY + rowH, x2: chartW, y2: rowY + rowH,
            stroke: isHighlighted ? 'rgba(37, 99, 235, 0.3)' : sepColor, 'stroke-width': 1
        }));

        // Year grid vertical lines
        for (let yr = minYear; yr <= maxYear; yr++) {
            barsSvg.appendChild(efeSvgEl('line', {
                x1: toPx(yr), y1: rowY, x2: toPx(yr), y2: rowY + rowH,
                stroke: gridColor, 'stroke-width': 1
            }));
        }

        // "Hoy" vertical dashed line across the row
        if (todayYear >= minYear && todayYear <= maxYear) {
            barsSvg.appendChild(efeSvgEl('line', {
                x1: toPx(todayYear), y1: rowY,
                x2: toPx(todayYear), y2: rowY + rowH,
                stroke: '#ef4444', 'stroke-width': 1.2,
                'stroke-dasharray': '3,3', 'pointer-events': 'none'
            }));
        }

        // Bar and Milestones rendering logic (coloreado según etapa)
        const stageInfo = parseEfeStageInfo(p.stage);
        const barY = rowY + (rowH - EFE_TL_BAR_H) / 2;
        const numericOpYear = efeGetNumericYear(p.operation_year);
        const ms = parseEfeMilestone(p.operation_year);
        const isOperational = numericOpYear != null && numericOpYear <= Math.floor(todayYear);
        const hasFutureOp = numericOpYear != null && numericOpYear > Math.floor(todayYear);

        if (hasFutureOp) {
            // ── SCENARIO A: Future Operation (extends right from todayYear) ───
            const startYear = todayYear;
            const endYear = numericOpYear;
            const bx = toPx(startYear);
            // Extend bar to mid-year for point milestones so it reaches the diamond
            const barEndX = (ms && ms.type === 'point') ? toPx(endYear + 0.5) : toPx(endYear);
            const bw = Math.max(barEndX - bx, 6);

            const rect = efeSvgEl('rect', {
                x: bx, y: barY, width: bw, height: EFE_TL_BAR_H,
                rx: 3, ry: 3, fill: stageInfo.fill,
                opacity: 0.92,
                stroke: stageInfo.isCompound ? 'rgba(0,0,0,0.22)' : 'none',
                'stroke-width': stageInfo.isCompound ? 1 : 0,
                style: 'cursor: pointer; transition: opacity 0.15s ease;'
            });

            rect.addEventListener('mouseenter', (e) => {
                rect.setAttribute('opacity', '1');
                rect.setAttribute('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))');
                showEfeTimelineTooltip(e, p, stageInfo.color1);
            });
            rect.addEventListener('mousemove', (e) => moveEfeTimelineTooltip(e));
            rect.addEventListener('mouseleave', () => {
                rect.setAttribute('opacity', '0.92');
                rect.removeAttribute('filter');
                hideEfeTimelineTooltip();
            });
            rect.addEventListener('click', (e) => {
                e.stopPropagation();
                hideEfeTimelineTooltip();
                hideEfeTimelineView();
                if (typeof efeSelectProject === 'function') efeSelectProject(p);
            });

            barsSvg.appendChild(rect);

            // Text inside bar
            if (bw > 36) {
                const barTxt = efeSvgEl('text', {
                    x: bx + 6, y: barY + EFE_TL_BAR_H / 2 + 0.5,
                    'dominant-baseline': 'middle',
                    fill: '#ffffff',
                    'font-family': "'Plus Jakarta Sans', sans-serif",
                    'font-size': '8.5', 'font-weight': '700',
                    'pointer-events': 'none',
                    style: 'text-shadow: 0 1px 2px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.6);'
                });
                barTxt.textContent = p.stage || `${endYear}`;
                barsSvg.appendChild(barTxt);
            }

            // ── Hito de Puesta en Operación (Mapeo dinámico según valor del Excel) ──
            if (ms && ms.type === 'point') {
                // Caso 1: Año solo (ej. 2028, 2032) -> Hito puntual (rombo esmeralda)
                const mx = toPx(ms.year + 0.5);
                const my = barY + EFE_TL_BAR_H / 2;
                const d = EFE_TL_MILESTONE_R;
                const milestone = efeSvgEl('polygon', {
                    points: `${mx},${my - d} ${mx + d},${my} ${mx},${my + d} ${mx - d},${my}`,
                    fill: '#10b981', stroke: '#ffffff', 'stroke-width': 1.5,
                    style: 'cursor: pointer; filter: drop-shadow(0 2px 4px rgba(16, 185, 129, 0.45));'
                });

                milestone.addEventListener('mouseenter', (e) => {
                    milestone.setAttribute('stroke-width', '2.5');
                    milestone.setAttribute('fill', '#34d399');
                    showEfeMilestoneTooltip(e, p.name, 'Puesta en Operación Estimada', `${ms.year}`, '#10b981');
                });
                milestone.addEventListener('mousemove', (e) => moveEfeTimelineTooltip(e));
                milestone.addEventListener('mouseleave', () => {
                    milestone.setAttribute('stroke-width', '1.5');
                    milestone.setAttribute('fill', '#10b981');
                    hideEfeTimelineTooltip();
                });
                milestone.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideEfeTimelineTooltip();
                    hideEfeTimelineView();
                    if (typeof efeSelectProject === 'function') efeSelectProject(p);
                });
                barsSvg.appendChild(milestone);

                // Label at the end showing year
                const yearLbl = efeSvgEl('text', {
                    x: mx + d + 5, y: my + 0.5,
                    'dominant-baseline': 'middle',
                    fill: isLight ? '#059669' : '#34d399',
                    'font-family': "'Plus Jakarta Sans', sans-serif",
                    'font-size': '9', 'font-weight': '700',
                    'pointer-events': 'none'
                });
                yearLbl.textContent = `${ms.year}`;
                barsSvg.appendChild(yearLbl);

            } else if (ms && ms.type === 'range') {
                // Caso 2: Formato '2025-2026' / '2027 - 2028' (Barra de periodo para el hito)
                const mx1 = toPx(ms.start);
                const mx2 = toPx(ms.end + 1.0);
                const mw = Math.max(mx2 - mx1, 24);

                const rangeG = efeSvgEl('g', { style: 'cursor: pointer;' });

                const rangeRect = efeSvgEl('rect', {
                    x: mx1, y: barY, width: mw, height: EFE_TL_BAR_H,
                    rx: 4, ry: 4,
                    fill: 'url(#efe-milestone-range-grad)',
                    stroke: '#6ee7b7', 'stroke-width': 1.2,
                    opacity: 0.95,
                    style: 'filter: drop-shadow(0 2px 6px rgba(16, 185, 129, 0.35));'
                });
                rangeG.appendChild(rangeRect);

                // Mini icono rombo blanco al inicio de la barra
                const dMini = 3.5;
                const rmx = mx1 + 7;
                const rmy = barY + EFE_TL_BAR_H / 2;
                const rPoly = efeSvgEl('polygon', {
                    points: `${rmx},${rmy - dMini} ${rmx + dMini},${rmy} ${rmx},${rmy + dMini} ${rmx - dMini},${rmy}`,
                    fill: '#ffffff', opacity: 0.95
                });
                rangeG.appendChild(rPoly);

                // Texto informativo del periodo
                if (mw > 35) {
                    const rangeTxt = efeSvgEl('text', {
                        x: mx1 + 15, y: barY + EFE_TL_BAR_H / 2 + 0.5,
                        'dominant-baseline': 'middle',
                        fill: '#ffffff',
                        'font-family': "'Plus Jakarta Sans', sans-serif",
                        'font-size': '8', 'font-weight': '700',
                        'pointer-events': 'none'
                    });
                    const rTxt = ms.raw || ms.displayTag;
                    rangeTxt.textContent = (mw >= 70) ? `P. Operación ${rTxt}` : rTxt;
                    rangeG.appendChild(rangeTxt);
                }

                rangeG.addEventListener('mouseenter', (e) => {
                    rangeRect.setAttribute('opacity', '1');
                    rangeRect.setAttribute('stroke', '#ffffff');
                    showEfeMilestoneTooltip(e, p.name, 'Puesta en Operación Estimada', ms.raw || `${ms.start} - ${ms.end}`, '#10b981');
                });
                rangeG.addEventListener('mousemove', (e) => moveEfeTimelineTooltip(e));
                rangeG.addEventListener('mouseleave', () => {
                    rangeRect.setAttribute('opacity', '0.95');
                    rangeRect.setAttribute('stroke', '#6ee7b7');
                    hideEfeTimelineTooltip();
                });
                rangeG.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideEfeTimelineTooltip();
                    hideEfeTimelineView();
                    if (typeof efeSelectProject === 'function') efeSelectProject(p);
                });
                barsSvg.appendChild(rangeG);

            } else if (ms && ms.type === 'open_range') {
                // Caso 3: Formato '2030+' / '2030 +' (Barra sin fin con concepto matemático [a, [)
                const mx1 = toPx(ms.start);
                const mx2 = chartW - PADDING_RIGHT;
                const mw = Math.max(mx2 - mx1, 40);

                const openG = efeSvgEl('g', { style: 'cursor: pointer;' });

                // 1. Relleno degradado esmeralda hacia la derecha (desvanecimiento al infinito)
                const openRect = efeSvgEl('rect', {
                    x: mx1, y: barY, width: mw, height: EFE_TL_BAR_H,
                    fill: 'url(#efe-grad-open-range)'
                });
                openG.appendChild(openRect);

                // 2. Líneas superior e inferior punteadas para indicar continuidad indefinida
                const topLine = efeSvgEl('line', {
                    x1: mx1, y1: barY, x2: mx2, y2: barY,
                    stroke: '#6ee7b7', 'stroke-width': 1.2, 'stroke-dasharray': '4,3'
                });
                const botLine = efeSvgEl('line', {
                    x1: mx1, y1: barY + EFE_TL_BAR_H, x2: mx2, y2: barY + EFE_TL_BAR_H,
                    stroke: '#6ee7b7', 'stroke-width': 1.2, 'stroke-dasharray': '4,3'
                });
                openG.appendChild(topLine);
                openG.appendChild(botLine);

                // 3. Corchete cerrado '[' en el inicio del hito
                const bracketLeft = efeSvgEl('path', {
                    d: `M ${mx1 + 6} ${barY} L ${mx1} ${barY} L ${mx1} ${barY + EFE_TL_BAR_H} L ${mx1 + 6} ${barY + EFE_TL_BAR_H}`,
                    stroke: '#ffffff', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'square'
                });
                openG.appendChild(bracketLeft);

                // 4. Corchete abierto '[' al extremo derecho
                const bracketRight = efeSvgEl('path', {
                    d: `M ${mx2} ${barY} L ${mx2 - 6} ${barY} M ${mx2 - 6} ${barY} L ${mx2 - 6} ${barY + EFE_TL_BAR_H} M ${mx2 - 6} ${barY + EFE_TL_BAR_H} L ${mx2} ${barY + EFE_TL_BAR_H}`,
                    stroke: '#6ee7b7', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'square'
                });
                openG.appendChild(bracketRight);

                // 5. Etiqueta con 'P. Operación ' + texto del Excel (ej. P. Operación 2030+)
                const openTxt = efeSvgEl('text', {
                    x: mx1 + 14, y: barY + EFE_TL_BAR_H / 2 + 0.5,
                    'dominant-baseline': 'middle',
                    fill: '#ffffff',
                    'font-family': "'Plus Jakarta Sans', sans-serif",
                    'font-size': '8.5', 'font-weight': '700',
                    'letter-spacing': '0.3px',
                    'pointer-events': 'none'
                });
                const excelText = ms.raw || `${ms.start}+`;
                openTxt.textContent = `P. Operación ${excelText}`;
                openG.appendChild(openTxt);

                openG.addEventListener('mouseenter', (e) => {
                    openRect.setAttribute('opacity', '1');
                    bracketLeft.setAttribute('stroke-width', '3');
                    bracketRight.setAttribute('stroke-width', '3');
                    showEfeMilestoneTooltip(e, p.name, 'Puesta en Operación Estimada', ms.raw || `${ms.start}+`, '#10b981');
                });
                openG.addEventListener('mousemove', (e) => moveEfeTimelineTooltip(e));
                openG.addEventListener('mouseleave', () => {
                    bracketLeft.setAttribute('stroke-width', '2.4');
                    bracketRight.setAttribute('stroke-width', '2.4');
                    hideEfeTimelineTooltip();
                });
                openG.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideEfeTimelineTooltip();
                    hideEfeTimelineView();
                    if (typeof efeSelectProject === 'function') efeSelectProject(p);
                });
                barsSvg.appendChild(openG);
            }

        } else if (isOperational && numericOpYear != null) {
            // ── SCENARIO B: Already Operational (<= todayYear) ───────────────
            const startYear = Math.max(minYear, numericOpYear);
            const endYear = todayYear;
            const bx = toPx(startYear);
            const bw = Math.max(toPx(endYear + 0.2) - bx, 24);

            // Operative bar
            const rect = efeSvgEl('rect', {
                x: bx, y: barY, width: bw, height: EFE_TL_BAR_H,
                rx: 3, ry: 3,
                fill: '#059669',
                opacity: 0.85,
                style: 'cursor: pointer; transition: opacity 0.15s ease;'
            });

            rect.addEventListener('mouseenter', (e) => {
                rect.setAttribute('opacity', '1');
                rect.setAttribute('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))');
                showEfeTimelineTooltip(e, p, '#059669');
            });
            rect.addEventListener('mousemove', (e) => moveEfeTimelineTooltip(e));
            rect.addEventListener('mouseleave', () => {
                rect.setAttribute('opacity', '0.85');
                rect.removeAttribute('filter');
                hideEfeTimelineTooltip();
            });
            rect.addEventListener('click', (e) => {
                e.stopPropagation();
                hideEfeTimelineTooltip();
                hideEfeTimelineView();
                if (typeof efeSelectProject === 'function') efeSelectProject(p);
            });

            barsSvg.appendChild(rect);

            // Checkmark circle milestone at operation year
            const cx = toPx(numericOpYear);
            const cy = barY + EFE_TL_BAR_H / 2;

            // Adaptive text inside operative bar
            const opLabel = efeSvgEl('text', {
                x: bx + 8, y: cy + 0.5,
                'dominant-baseline': 'middle',
                fill: '#ffffff',
                'font-family': "'Plus Jakarta Sans', sans-serif",
                'font-size': '8.5', 'font-weight': '700',
                'pointer-events': 'none'
            });
            if (bw > 85) {
                opLabel.textContent = `✓ Operativo (${numericOpYear})`;
            } else if (bw > 42) {
                opLabel.textContent = `✓ ${numericOpYear}`;
            } else {
                opLabel.textContent = '✓';
            }
            barsSvg.appendChild(opLabel);

        } else {
            // ── SCENARIO C: Study / Prefeasibility (no op year reported) ────────
            const bx = toPx(todayYear);
            const bw = Math.max(toPx(todayYear + 0.8) - bx, 20);

            const isTranspFill = typeof stageInfo.fill === 'string' && stageInfo.fill.startsWith('rgba');
            const rect = efeSvgEl('rect', {
                x: bx, y: barY, width: bw, height: EFE_TL_BAR_H,
                rx: 3, ry: 3, fill: stageInfo.fill,
                opacity: isTranspFill ? 1 : 0.55,
                'stroke-dasharray': '3,2',
                stroke: stageInfo.stroke || stageInfo.color1,
                'stroke-width': 1,
                style: 'cursor: pointer;'
            });

            rect.addEventListener('mouseenter', (e) => {
                rect.setAttribute('opacity', '1');
                showEfeTimelineTooltip(e, p, stageInfo.stroke || stageInfo.color1);
            });
            rect.addEventListener('mousemove', (e) => moveEfeTimelineTooltip(e));
            rect.addEventListener('mouseleave', () => {
                rect.setAttribute('opacity', isTranspFill ? '1' : '0.55');
                hideEfeTimelineTooltip();
            });
            rect.addEventListener('click', (e) => {
                e.stopPropagation();
                hideEfeTimelineTooltip();
                hideEfeTimelineView();
                if (typeof efeSelectProject === 'function') efeSelectProject(p);
            });

            barsSvg.appendChild(rect);

            const txt = efeSvgEl('text', {
                x: bx + bw + 6, y: barY + EFE_TL_BAR_H / 2 + 0.5,
                'dominant-baseline': 'middle',
                fill: isLight ? '#64748b' : '#94a3b8',
                'font-family': "'Plus Jakarta Sans', sans-serif",
                'font-size': '8.5', 'font-style': 'italic',
                'pointer-events': 'none'
            });
            txt.textContent = `${p.stage || 'Estudio'} (Fecha por definir)`;
            barsSvg.appendChild(txt);
        }
    });

    // Auto-scroll to highlighted row if specified
    const rowsWrapperEl = document.querySelector('#efe-timeline-full-panel .timeline-rows-wrapper');
    if (highlightedRowIdx !== -1 && rowYOffsets[highlightedRowIdx] !== undefined && rowsWrapperEl) {
        setTimeout(() => {
            const targetScrollTop = Math.max(0, rowYOffsets[highlightedRowIdx] - 100);
            rowsWrapperEl.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        }, 150);
    }
}

// ── Tooltip Handlers ─────────────────────────────────────────────────────────
function showEfeTimelineTooltip(e, p, color) {
    const tip = document.getElementById('efe-timeline-tooltip');
    if (!tip) return;

    const invText = p.investment_mm_usd != null
        ? (typeof efeFormatInvestment === 'function' ? efeFormatInvestment(p.investment_mm_usd) : `US$ ${p.investment_mm_usd} MM`)
        : 'No informada';

    let progressText = '—';
    if (p.progress != null) {
        const pv = Number(p.progress);
        progressText = !isNaN(pv) ? (pv <= 1 ? `${Math.round(pv * 100)}%` : `${pv}%`) : String(p.progress);
    }

    const opText = p.operation_year
        ? `${p.operation_year}`
        : 'Por definir (En etapa de estudio)';

    const stInfo = parseEfeStageInfo(p.stage);
    const isTransp = typeof stInfo.color1 === 'string' && stInfo.color1.startsWith('rgba');
    const stageBadgeHtml = stInfo.isCompound
        ? `<span style="display:inline-block;width:12px;height:7px;border-radius:2px;background:${stInfo.legendGradient};border:1px solid rgba(0,0,0,0.15);vertical-align:middle;margin-right:5px;"></span>`
        : `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${stInfo.color1};${isTransp ? 'border:1px solid #94a3b8;' : ''}vertical-align:middle;margin-right:5px;"></span>`;

    tip.innerHTML = `
        <span class="timeline-tooltip-name" style="color:${color}; font-weight:700; font-size:0.78rem; margin-bottom:0.3rem; display:block;">${p.name || 'Sin nombre'}</span>
        <div class="timeline-tooltip-row" style="display:flex;justify-content:space-between;gap:0.75rem;font-size:0.72rem;margin-bottom:0.15rem;">
            <span class="timeline-tooltip-label" style="color:var(--text-secondary);">Filial:</span>
            <span class="timeline-tooltip-val" style="font-weight:600;color:var(--text-primary);">${p.filial || 'EFE Corporativo'}</span>
        </div>
        <div class="timeline-tooltip-row" style="display:flex;justify-content:space-between;gap:0.75rem;font-size:0.72rem;margin-bottom:0.15rem;">
            <span class="timeline-tooltip-label" style="color:var(--text-secondary);">Tipo:</span>
            <span class="timeline-tooltip-val" style="font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:0.3rem;">${typeof efeGetProjectTypeSvg === 'function' ? efeGetProjectTypeSvg(p.type, 12, 12, 'currentColor') : ''} ${p.type || '—'}</span>
        </div>
        <div class="timeline-tooltip-row" style="display:flex;justify-content:space-between;gap:0.75rem;font-size:0.72rem;margin-bottom:0.15rem;">
            <span class="timeline-tooltip-label" style="color:var(--text-secondary);">Etapa Actual:</span>
            <span class="timeline-tooltip-val" style="font-weight:600;color:var(--text-primary);display:flex;align-items:center;">${stageBadgeHtml}${p.stage || '—'}</span>
        </div>
        <div class="timeline-tooltip-row" style="display:flex;justify-content:space-between;gap:0.75rem;font-size:0.72rem;margin-bottom:0.15rem;">
            <span class="timeline-tooltip-label" style="color:var(--text-secondary);">Inversión estimada:</span>
            <span class="timeline-tooltip-val" style="font-weight:700;color:var(--primary);">${invText}</span>
        </div>
        <div class="timeline-tooltip-row" style="display:flex;justify-content:space-between;gap:0.75rem;font-size:0.72rem;margin-bottom:0.15rem;">
            <span class="timeline-tooltip-label" style="color:var(--text-secondary);">Operación estimada:</span>
            <span class="timeline-tooltip-val" style="font-weight:700;color:#10b981;">${opText}</span>
        </div>
        <div class="timeline-tooltip-row" style="display:flex;justify-content:space-between;gap:0.75rem;font-size:0.72rem;margin-bottom:0.15rem;">
            <span class="timeline-tooltip-label" style="color:var(--text-secondary);">Avance etapa:</span>
            <span class="timeline-tooltip-val" style="font-weight:600;color:var(--text-primary);">${progressText}</span>
        </div>
        <div class="timeline-tooltip-row" style="display:flex;justify-content:space-between;gap:0.75rem;font-size:0.7rem;margin-top:0.25rem;border-top:1px solid var(--border-color);padding-top:0.2rem;">
            <span class="timeline-tooltip-label" style="color:var(--text-muted);">Fuente:</span>
            <span class="timeline-tooltip-val" style="color:var(--text-muted);">${p.source || 'EFE'}</span>
        </div>
    `;
    tip.style.display = 'block';
    moveEfeTimelineTooltip(e);
}

function showEfeMilestoneTooltip(e, name, milestoneTitle, value, color) {
    const tip = document.getElementById('efe-timeline-tooltip');
    if (!tip) return;

    tip.innerHTML = `
        <span class="timeline-tooltip-name" style="color:${color}; font-weight:700; font-size:0.78rem; margin-bottom:0.3rem; display:block;">${name}</span>
        <div class="timeline-tooltip-row" style="display:flex;justify-content:space-between;gap:0.75rem;font-size:0.72rem;margin-bottom:0.15rem;">
            <span class="timeline-tooltip-label" style="color:var(--text-secondary);">Hito:</span>
            <span class="timeline-tooltip-val" style="font-weight:700;color:${color};">${milestoneTitle}</span>
        </div>
        <div class="timeline-tooltip-row" style="display:flex;justify-content:space-between;gap:0.75rem;font-size:0.72rem;">
            <span class="timeline-tooltip-label" style="color:var(--text-secondary);">Año:</span>
            <span class="timeline-tooltip-val" style="font-weight:700;color:var(--text-primary);">${value}</span>
        </div>
    `;
    tip.style.display = 'block';
    moveEfeTimelineTooltip(e);
}

function moveEfeTimelineTooltip(e) {
    const tip = document.getElementById('efe-timeline-tooltip');
    if (!tip || tip.style.display === 'none') return;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let tx = e.clientX + 12;
    let ty = e.clientY - 12;

    if (tx + tw + 10 > window.innerWidth) {
        tx = e.clientX - tw - 12;
    }
    if (ty + th + 10 > window.innerHeight) {
        ty = window.innerHeight - th - 10;
    }
    if (ty < 10) ty = 10;

    tip.style.left = tx + 'px';
    tip.style.top = ty + 'px';
}

function hideEfeTimelineTooltip() {
    const tip = document.getElementById('efe-timeline-tooltip');
    if (tip) tip.style.display = 'none';
}

// Window resize listener
window.addEventListener('resize', () => {
    if (efeState.timelineOpen) {
        const currentList = (typeof efeGetFilteredProjects === 'function')
            ? efeGetFilteredProjects()
            : ((window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : []);
        renderEfeTimeline(currentList);
    }
});
