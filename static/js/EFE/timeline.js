/**
 * static/js/EFE/timeline.js
 * Visualización de Líneas de Tiempo (Gantt) para proyectos EFE Trenes de Chile.
 * Harmonized with CATLEC index.html design palette, fonts, and SVG styling.
 */

const EFE_TIMELINE_FILIAL_COLORS = {
    'EFE Central': '#2563eb',       // Royal Blue
    'EFE Valparaíso': '#0284c7',     // Sky Blue
    'EFE Sur': '#d97706',           // Amber / Orange
    'EFE Arica - La Paz': '#059669', // Emerald
    'Nacional': '#8b5cf6'           // Purple
};

const EFE_TL_ROW_PAD_V = 7;
const EFE_TL_BAR_H = 14;
const EFE_TL_AXIS_H = 36;
const EFE_TL_LABEL_W = 240;
const EFE_TL_MILESTONE_R = 6.5;

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

    const currentYear = new Date().getFullYear();

    // ── Update Timeline KPI Banner ──────────────────────────────────────────
    const totalInvMM = data.reduce((sum, p) => sum + (p.investment_mm_usd || 0), 0);
    const projectsWithOp = data.filter(p => p.operation_year != null);
    const opYears = projectsWithOp.map(p => Number(p.operation_year)).filter(y => !isNaN(y));
    const minOp = opYears.length > 0 ? Math.min(...opYears) : currentYear;
    const maxOp = opYears.length > 0 ? Math.max(...opYears) : currentYear;

    const elInv = document.getElementById('efe-kpi-tl-investment');
    const elProjects = document.getElementById('efe-kpi-tl-projects');
    const elHorizon = document.getElementById('efe-kpi-tl-horizon');

    if (elInv) elInv.textContent = typeof efeFormatInvestment === 'function' ? efeFormatInvestment(totalInvMM) : `US$ ${Math.round(totalInvMM)} MM`;
    if (elProjects) elProjects.textContent = `${projectsWithOp.length} de ${data.length}`;
    if (elHorizon) elHorizon.textContent = opYears.length > 0 ? `${minOp} – ${maxOp}` : '—';

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    // ── Sort projects for timeline display ───────────────────────────────────
    const sortedData = [...data].sort((a, b) => {
        const opA = a.operation_year != null ? Number(a.operation_year) : Infinity;
        const opB = b.operation_year != null ? Number(b.operation_year) : Infinity;

        const isOpA = opA <= currentYear;
        const isOpB = opB <= currentYear;

        const getGroup = (y, isOp) => {
            if (y === Infinity) return 3;
            if (isOp) return 2;
            return 1;
        };

        const gA = getGroup(opA, isOpA);
        const gB = getGroup(opB, isOpB);

        if (gA !== gB) return gA - gB;
        return opA - opB;
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

        // Filial color indicator dot
        const filColor = EFE_TIMELINE_FILIAL_COLORS[p.filial] || '#3b82f6';
        labelSvg.appendChild(efeSvgEl('circle', {
            cx: 14, cy: rowY + rowH / 2, r: 3.5, fill: filColor
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
    if (currentYear >= minYear && currentYear <= maxYear) {
        const tx = toPx(currentYear);
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
        if (currentYear >= minYear && currentYear <= maxYear) {
            barsSvg.appendChild(efeSvgEl('line', {
                x1: toPx(currentYear), y1: rowY,
                x2: toPx(currentYear), y2: rowY + rowH,
                stroke: '#ef4444', 'stroke-width': 1.2,
                'stroke-dasharray': '3,3', 'pointer-events': 'none'
            }));
        }

        // Bar and Milestones rendering logic
        const filColor = EFE_TIMELINE_FILIAL_COLORS[p.filial] || '#2563eb';
        const barY = rowY + (rowH - EFE_TL_BAR_H) / 2;
        const opYear = p.operation_year != null ? Number(p.operation_year) : null;
        const isOperational = opYear != null && opYear <= currentYear;
        const hasFutureOp = opYear != null && opYear > currentYear;

        if (hasFutureOp) {
            // ── SCENARIO A: Future Operation (extends right from currentYear) ───
            const startYear = currentYear;
            const endYear = opYear;
            const bx = toPx(startYear);
            const bw = Math.max(toPx(endYear) - bx, 6);

            const rect = efeSvgEl('rect', {
                x: bx, y: barY, width: bw, height: EFE_TL_BAR_H,
                rx: 3, ry: 3, fill: filColor,
                opacity: 0.88,
                style: 'cursor: pointer; transition: opacity 0.15s ease;'
            });

            rect.addEventListener('mouseenter', (e) => {
                rect.setAttribute('opacity', '1');
                rect.setAttribute('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))');
                showEfeTimelineTooltip(e, p, filColor);
            });
            rect.addEventListener('mousemove', (e) => moveEfeTimelineTooltip(e));
            rect.addEventListener('mouseleave', () => {
                rect.setAttribute('opacity', '0.88');
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
                    'pointer-events': 'none'
                });
                barTxt.textContent = p.stage || `${endYear}`;
                barsSvg.appendChild(barTxt);
            }

            // Milestone Marker at Operation Year (Diamond)
            const mx = toPx(endYear);
            const my = barY + EFE_TL_BAR_H / 2;
            const d = EFE_TL_MILESTONE_R;
            const milestone = efeSvgEl('polygon', {
                points: `${mx},${my - d} ${mx + d},${my} ${mx},${my + d} ${mx - d},${my}`,
                fill: '#10b981', stroke: '#ffffff', 'stroke-width': 1.5,
                style: 'cursor: pointer; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.25));'
            });

            milestone.addEventListener('mouseenter', (e) => {
                milestone.setAttribute('stroke-width', '2.5');
                milestone.setAttribute('fill', '#34d399');
                showEfeMilestoneTooltip(e, p.name, `Puesta en Operación Estimada`, `${endYear}`, '#10b981');
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
            yearLbl.textContent = `${endYear}`;
            barsSvg.appendChild(yearLbl);

        } else if (isOperational) {
            // ── SCENARIO B: Already Operational (<= currentYear) ───────────────
            const startYear = Math.max(minYear, opYear);
            const endYear = currentYear;
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
            const cx = toPx(opYear);
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
                opLabel.textContent = `✓ Operativo (${opYear})`;
            } else if (bw > 42) {
                opLabel.textContent = `✓ ${opYear}`;
            } else {
                opLabel.textContent = '✓';
            }
            barsSvg.appendChild(opLabel);

        } else {
            // ── SCENARIO C: Study / Prefeasibility (no op year reported) ────────
            const bx = toPx(currentYear);
            const bw = Math.max(toPx(currentYear + 0.8) - bx, 20);

            const rect = efeSvgEl('rect', {
                x: bx, y: barY, width: bw, height: EFE_TL_BAR_H,
                rx: 3, ry: 3, fill: filColor,
                opacity: 0.45,
                'stroke-dasharray': '3,2',
                stroke: filColor,
                'stroke-width': 1,
                style: 'cursor: pointer;'
            });

            rect.addEventListener('mouseenter', (e) => {
                rect.setAttribute('opacity', '0.8');
                showEfeTimelineTooltip(e, p, filColor);
            });
            rect.addEventListener('mousemove', (e) => moveEfeTimelineTooltip(e));
            rect.addEventListener('mouseleave', () => {
                rect.setAttribute('opacity', '0.45');
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
            <span class="timeline-tooltip-val" style="font-weight:600;color:var(--text-primary);">${p.stage || '—'}</span>
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
