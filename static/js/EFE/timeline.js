/**
 * static/js/EFE/timeline.js
 * Visualización de Líneas de Tiempo (Gantt) para proyectos EFE Trenes de Chile.
 * Harmonized with CATLEC DGC.html design palette, fonts, and SVG styling.
 */

// ── Color Único para las Barras del Timeline (Azul Marino Corporativo) ──────
var EFE_TL_BAR_COLOR = '#0f3b6c';

function getEfeStageSingleColor(stageStr) {
    return EFE_TL_BAR_COLOR;
}

/**
 * Analiza la etapa de un proyecto.
 * Con color unificado Azul Marino (#0f3b6c) para todas las barras del timeline.
 */
function parseEfeStageInfo(stageRaw) {
    const raw = (stageRaw && String(stageRaw).trim()) ? String(stageRaw).trim() : 'Sin Etapa';
    const c = EFE_TL_BAR_COLOR;
    return {
        isCompound: false,
        stages: [raw],
        color1: c,
        color2: null,
        patternId: null,
        fill: c,
        stroke: c,
        label: raw,
        legendGradient: c
    };
}

/** Actualiza dinámicamente la leyenda del timeline */
function updateEfeTimelineLegend(projects) {
    const legendEl = document.getElementById('efe-timeline-header-legend');
    if (!legendEl) return;

    legendEl.innerHTML = `
        <span class="timeline-legend-item">
            <span class="tl-legend-dot" style="background:#0f3b6c; width:11px; height:7px; border-radius:2px;"></span>Etapa de Proyecto
        </span>
        <span class="timeline-legend-item">
            <span class="tl-legend-dot" style="background:#1e9952; transform:rotate(45deg); width:7px; height:7px; border-radius:1px;"></span>Puesta en Operación
        </span>
        <span class="timeline-legend-item">
            <span style="display:inline-block;width:2px;height:12px;background:#ef4444;border-radius:1px;"></span>Hoy
        </span>
    `;
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
    if (typeof efeMap !== 'undefined' && efeMap && efeMap.getCenter) {
        efeState.savedMapCenter = efeMap.getCenter();
        efeState.savedMapZoom = efeMap.getZoom();
    }
    if (efeState.investmentOpen && typeof hideEfeInvestmentView === 'function') {
        hideEfeInvestmentView(true);
    }
    if (efeState.operacionOpen && typeof hideEfeOperacionView === 'function') {
        hideEfeOperacionView(true);
    }
    efeState.timelineOpen = true;

    const grid = document.querySelector('.efe-dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const tlPanel = document.getElementById('efe-timeline-full-panel');
    const btnMap = document.getElementById('btn-efe-view-map');
    const btnInv = document.getElementById('btn-efe-view-investment');
    const btnTl = document.getElementById('btn-efe-view-timeline');
    const btnOp = document.getElementById('btn-efe-view-operacion');

    if (grid) grid.style.gridTemplateColumns = '280px 1fr';
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (tlPanel) tlPanel.style.display = 'flex';

    if (btnMap) btnMap.classList.remove('active');
    if (btnInv) btnInv.classList.remove('active');
    if (btnOp) btnOp.classList.remove('active');
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

function hideEfeTimelineView(skipRestoreCenter) {
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
    if (btnMap && !efeState.investmentOpen && !efeState.operacionOpen) btnMap.classList.add('active');

    if (window.location.hash === '#timeline') {
        history.replaceState(null, null, window.location.pathname + window.location.search);
    }

    if (typeof efeMap !== 'undefined' && efeMap) {
        efeMap.resize();
        if (!skipRestoreCenter && efeState.savedMapCenter) {
            efeMap.jumpTo({ center: efeState.savedMapCenter, zoom: efeState.savedMapZoom || 4 });
        }
        setTimeout(() => {
            if (typeof efeMap !== 'undefined' && efeMap) {
                efeMap.resize();
                if (!skipRestoreCenter && efeState.savedMapCenter) {
                    efeMap.jumpTo({ center: efeState.savedMapCenter, zoom: efeState.savedMapZoom || 4 });
                }
            }
        }, 50);
    }
}

// ── SVG Helper ───────────────────────────────────────────────────────────────
const efeSvgEl = CatlecTimeline.svgEl;
const efeTimelineTooltip = CatlecTimeline.createCursorTooltip({ domId: 'efe-timeline-tooltip' });

// ── Main Timeline Render ─────────────────────────────────────────────────────
function renderEfeTimeline(projects, highlightName = null) {
    const data = (projects && projects.length > 0)
        ? projects
        : ((window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : []);

    const badge = document.getElementById('efe-timeline-count-badge');
    if (badge) badge.textContent = `${data.length} proyecto${data.length !== 1 ? 's' : ''}`;

    // Actualizar dinámicamente la leyenda con las etapas presentes
    updateEfeTimelineLegend(data);

    const todayYear = CatlecUtils.dateToYear(new Date().toISOString().slice(0, 10));

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
    let minYear = 2024;
    let maxYear = Math.max(2031, maxOp);

    // ── Row Metrics ─────────────────────────────────────────────────────────
    const rowMetrics = sortedData.map(p => {
        const lines = CatlecUtils.wrapText(p.name, 30);
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

    const textColor = '#374151';
    const gridColor = 'rgba(0,0,0,0.055)';
    const rowAltColor = 'rgba(241,245,249,0.7)';
    const labelBg = '#f8fafc';
    const labelColor = '#1e293b';
    const sepColor = 'rgba(0,0,0,0.09)';

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
            ? 'rgba(37, 99, 235, 0.18)'
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
            hideEfeTimelineView(true);
            if (typeof efeSelectProject === 'function') {
                setTimeout(() => {
                    efeSelectProject(p);
                }, 50);
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
            stroke: '#cbd5e1', 'stroke-width': 1
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
        stroke: '#e2e8f0', 'stroke-width': 1
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
            ? 'rgba(37, 99, 235, 0.12)'
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

        // Bar and Milestones rendering logic (coloreado según etapa, empezando desde x=0)
        const stageInfo = parseEfeStageInfo(p.stage);
        const barY = rowY + (rowH - EFE_TL_BAR_H) / 2;
        const numericOpYear = efeGetNumericYear(p.operation_year);
        const ms = parseEfeMilestone(p.operation_year);

        if (ms && ms.type === 'range') {
            // Caso 2: Rango '2025-2026' / '2027-2028'
            const mx1 = toPx(ms.start);
            const mx2 = toPx(ms.end);
            const mainW = Math.max(mx1, 0);

            // Barra base desde el extremo izquierdo (x=0) hasta el inicio del periodo de operación (mx1)
            if (mainW > 0) {
                const rect = efeSvgEl('rect', {
                    x: 0, y: barY, width: mainW, height: EFE_TL_BAR_H,
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
                    hideEfeTimelineView(true);
                    if (typeof efeSelectProject === 'function') {
                        setTimeout(() => {
                            efeSelectProject(p);
                        }, 50);
                    }
                });
                barsSvg.appendChild(rect);

                if (mainW > 36) {
                    const barTxt = efeSvgEl('text', {
                        x: 8, y: barY + EFE_TL_BAR_H / 2 + 0.5,
                        'dominant-baseline': 'middle',
                        fill: '#ffffff',
                        'font-family': "'Plus Jakarta Sans', sans-serif",
                        'font-size': '8.5', 'font-weight': '700',
                        'pointer-events': 'none',
                        style: 'text-shadow: 0 1px 2px rgba(0,0,0,0.85);'
                    });
                    barTxt.textContent = p.stage || '';
                    barsSvg.appendChild(barTxt);
                }
            }

            // Barra de hito rango (mx1 a mx2)
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

            // Mini icono rombo blanco
            const dMini = 3.5;
            const rmx = mx1 + 7;
            const rmy = barY + EFE_TL_BAR_H / 2;
            const rPoly = efeSvgEl('polygon', {
                points: `${rmx},${rmy - dMini} ${rmx + dMini},${rmy} ${rmx},${rmy + dMini} ${rmx - dMini},${rmy}`,
                fill: '#ffffff', opacity: 0.95
            });
            rangeG.appendChild(rPoly);

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
                hideEfeTimelineView(true);
                if (typeof efeSelectProject === 'function') {
                    setTimeout(() => {
                        efeSelectProject(p);
                    }, 50);
                }
            });
            barsSvg.appendChild(rangeG);

        } else if (ms && ms.type === 'open_range') {
            // Caso 3: Formato '2030+' / '2030 +'
            const mx1 = toPx(ms.start);
            const mx2 = chartW - PADDING_RIGHT;
            const mainW = Math.max(mx1, 0);

            // Barra base desde el extremo izquierdo (x=0) hasta el inicio del hito abierto (mx1)
            if (mainW > 0) {
                const rect = efeSvgEl('rect', {
                    x: 0, y: barY, width: mainW, height: EFE_TL_BAR_H,
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
                    hideEfeTimelineView(true);
                    if (typeof efeSelectProject === 'function') {
                        setTimeout(() => {
                            efeSelectProject(p);
                        }, 50);
                    }
                });
                barsSvg.appendChild(rect);

                if (mainW > 36) {
                    const barTxt = efeSvgEl('text', {
                        x: 8, y: barY + EFE_TL_BAR_H / 2 + 0.5,
                        'dominant-baseline': 'middle',
                        fill: '#ffffff',
                        'font-family': "'Plus Jakarta Sans', sans-serif",
                        'font-size': '8.5', 'font-weight': '700',
                        'pointer-events': 'none',
                        style: 'text-shadow: 0 1px 2px rgba(0,0,0,0.85);'
                    });
                    barTxt.textContent = p.stage || '';
                    barsSvg.appendChild(barTxt);
                }
            }

            const mw = Math.max(mx2 - mx1, 40);
            const openG = efeSvgEl('g', { style: 'cursor: pointer;' });

            const openRect = efeSvgEl('rect', {
                x: mx1, y: barY, width: mw, height: EFE_TL_BAR_H,
                fill: 'url(#efe-grad-open-range)'
            });
            openG.appendChild(openRect);

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

            const bracketLeft = efeSvgEl('path', {
                d: `M ${mx1 + 6} ${barY} L ${mx1} ${barY} L ${mx1} ${barY + EFE_TL_BAR_H} L ${mx1 + 6} ${barY + EFE_TL_BAR_H}`,
                stroke: '#ffffff', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'square'
            });
            openG.appendChild(bracketLeft);

            const bracketRight = efeSvgEl('path', {
                d: `M ${mx2} ${barY} L ${mx2 - 6} ${barY} M ${mx2 - 6} ${barY} L ${mx2 - 6} ${barY + EFE_TL_BAR_H} M ${mx2 - 6} ${barY + EFE_TL_BAR_H} L ${mx2} ${barY + EFE_TL_BAR_H}`,
                stroke: '#6ee7b7', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'square'
            });
            openG.appendChild(bracketRight);

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
                hideEfeTimelineView(true);
                if (typeof efeSelectProject === 'function') {
                    setTimeout(() => {
                        efeSelectProject(p);
                    }, 50);
                }
            });
            barsSvg.appendChild(openG);

        } else if (numericOpYear != null) {
            // Caso 1: Hito puntual / Año único (ej. 2024, 2025, 2026, 2027, 2030, 2031)
            const endYear = numericOpYear;
            const mx = toPx(endYear);
            const bw = Math.max(mx, 8);

            // Barra continua desde x=0 hasta el año de operación estimado
            const rect = efeSvgEl('rect', {
                x: 0, y: barY, width: bw, height: EFE_TL_BAR_H,
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
                hideEfeTimelineView(true);
                if (typeof efeSelectProject === 'function') {
                    setTimeout(() => {
                        efeSelectProject(p);
                    }, 50);
                }
            });
            barsSvg.appendChild(rect);

            // Texto dentro de la barra
            if (bw > 36) {
                const barTxt = efeSvgEl('text', {
                    x: 8, y: barY + EFE_TL_BAR_H / 2 + 0.5,
                    'dominant-baseline': 'middle',
                    fill: '#ffffff',
                    'font-family': "'Plus Jakarta Sans', sans-serif",
                    'font-size': '8.5', 'font-weight': '700',
                    'pointer-events': 'none',
                    style: 'text-shadow: 0 1px 2px rgba(0,0,0,0.85);'
                });
                barTxt.textContent = p.stage || `${endYear}`;
                barsSvg.appendChild(barTxt);
            }

            // Hito de Puesta en Operación en el extremo derecho
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
                showEfeMilestoneTooltip(e, p.name, 'Puesta en Operación Estimada', `${endYear}`, '#10b981');
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
                hideEfeTimelineView(true);
                if (typeof efeSelectProject === 'function') {
                    setTimeout(() => {
                        efeSelectProject(p);
                    }, 50);
                }
            });
            barsSvg.appendChild(milestone);

            // Etiqueta de año al final
            const yearLbl = efeSvgEl('text', {
                x: mx + d + 5, y: my + 0.5,
                'dominant-baseline': 'middle',
                fill: '#059669',
                'font-family': "'Plus Jakarta Sans', sans-serif",
                'font-size': '9', 'font-weight': '700',
                'pointer-events': 'none'
            });
            yearLbl.textContent = `${endYear}`;
            barsSvg.appendChild(yearLbl);

        } else {
            // Caso 4: Estudio / Prefactibilidad (sin fecha informada)
            const bw = Math.max(toPx(minYear + 1.2), 60);
            const isTranspFill = typeof stageInfo.fill === 'string' && stageInfo.fill.startsWith('rgba');
            const rect = efeSvgEl('rect', {
                x: 0, y: barY, width: bw, height: EFE_TL_BAR_H,
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
                hideEfeTimelineView(true);
                if (typeof efeSelectProject === 'function') {
                    setTimeout(() => {
                        efeSelectProject(p);
                    }, 50);
                }
            });
            barsSvg.appendChild(rect);

            const txt = efeSvgEl('text', {
                x: bw + 6, y: barY + EFE_TL_BAR_H / 2 + 0.5,
                'dominant-baseline': 'middle',
                fill: '#64748b',
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
    const typeIconHtml = typeof efeGetProjectTypeSvg === 'function' ? efeGetProjectTypeSvg(p.type, 12, 12, 'currentColor') : '';

    const html = CatlecTimeline.tooltipName(p.name || 'Sin nombre', color)
        + CatlecTimeline.tooltipRow('Filial:', p.filial || 'EFE Corporativo')
        + CatlecTimeline.tooltipRow('Tipo:', `<span style="display:flex;align-items:center;gap:0.3rem;">${typeIconHtml} ${p.type || '—'}</span>`)
        + CatlecTimeline.tooltipRow('Etapa Actual:', `<span style="display:flex;align-items:center;">${stageBadgeHtml}${p.stage || '—'}</span>`)
        + CatlecTimeline.tooltipRow('Inversión estimada:', invText, 'font-weight:700;color:var(--primary);')
        + CatlecTimeline.tooltipRow('Operación estimada:', opText, 'font-weight:700;color:#10b981;')
        + CatlecTimeline.tooltipRow('Avance etapa:', progressText)
        + `<div class="timeline-tooltip-row" style="font-size:0.7rem;margin-top:0.25rem;border-top:1px solid var(--border-color);padding-top:0.2rem;">
            <span class="timeline-tooltip-label" style="color:var(--text-muted);">Fuente:</span>
            <span class="timeline-tooltip-val" style="color:var(--text-muted);">${p.source || 'EFE'}</span>
        </div>`;
    efeTimelineTooltip.show(e, html);
}

function showEfeMilestoneTooltip(e, name, milestoneTitle, value, color) {
    const html = CatlecTimeline.tooltipName(name, color)
        + CatlecTimeline.tooltipRow('Hito:', milestoneTitle, `font-weight:700;color:${color};`)
        + CatlecTimeline.tooltipRow('Año:', value);
    efeTimelineTooltip.show(e, html);
}

function moveEfeTimelineTooltip(e) {
    efeTimelineTooltip.move(e);
}

function hideEfeTimelineTooltip() {
    efeTimelineTooltip.hide();
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
