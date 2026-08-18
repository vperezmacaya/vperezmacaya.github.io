const BAR_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2'];
const ROW_H = 38;       // px per project row
const AXIS_H = 36;      // px for year axis
const LABEL_W = 210;    // px for label column
const BAR_PAD = 7;      // vertical padding inside row
const MILESTONE_R = 6.5; // radius of milestone icons (larger hit area)

function showTimelineView() {
    if (typeof leafletMap !== 'undefined' && leafletMap && leafletMap.getCenter) {
        appState.savedMapCenter = leafletMap.getCenter();
        appState.savedMapZoom = leafletMap.getZoom();
    }
    if (appState.investmentOpen) hideInvestmentView();
    appState.timelineOpen = true;
    const grid = document.querySelector('.dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const tlPanel = document.getElementById('timeline-full-panel');
    if (grid) { grid.style.gridTemplateColumns = '240px 1fr'; }
    if (centerPanel) { centerPanel.style.display = 'none'; }
    if (rightPanel) { rightPanel.style.display = 'none'; }
    if (tlPanel) { tlPanel.style.display = 'flex'; }
    if (typeof setActiveSubheaderTab === 'function') setActiveSubheaderTab('timeline');

    // Render timeline data
    const projects = (appState.lastMapProjects && appState.lastMapProjects.length > 0)
        ? appState.lastMapProjects
        : (window.STATIC_DATA && window.STATIC_DATA.data ? window.STATIC_DATA.data : []);
    if (typeof renderTimeline === 'function') {
        renderTimeline(projects);
    }
}

function hideTimelineView(skipRestoreCenter) {
    appState.timelineOpen = false;
    const grid = document.querySelector('.dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const tlPanel = document.getElementById('timeline-full-panel');
    if (grid) { grid.style.gridTemplateColumns = ''; }
    if (centerPanel) { centerPanel.style.display = ''; }
    if (rightPanel) { rightPanel.style.display = ''; }
    if (tlPanel) { tlPanel.style.display = 'none'; }
    if (typeof setActiveSubheaderTab === 'function' && !appState.investmentOpen) setActiveSubheaderTab('map');

    if (typeof leafletMap !== 'undefined' && leafletMap) {
        leafletMap.invalidateSize({ animate: false });
        if (!skipRestoreCenter && appState.savedMapCenter) {
            leafletMap.setView(appState.savedMapCenter, appState.savedMapZoom || 6, { animate: false });
        }
    }
}

// ── Parse date string → fractional year number ────────────────────────

function getGroupEarliestStartDate(g) {
    if (!g || !g.segments || !g.segments.length) return Infinity;
    let earliest = Infinity;
    g.segments.forEach(seg => {
        if (seg.start_date) {
            const y = dateToYear(seg.start_date);
            if (y !== null && y < earliest) {
                earliest = y;
            }
        }
    });
    return earliest;
}

// ── Group data by concession family (relicitaciones) ─────────────────
function buildTimelineGroups(data) {
    const seen = new Map();  // canonicalKey → group object

    data.forEach(item => {
        const tl = item['group_timeline'];
        if (!tl || !tl.length) return;

        // Canonical key: sorted codes joined
        const key = tl.map(t => t.code).sort().join('|');
        if (seen.has(key)) return;

        // Display name: use "Nombre de la Concesión " of df_contracts
        const sorted = [...tl].sort((a, b) => a.seq - b.seq);
        const displayName = item['Nombre de la Concesión '] ||
            (sorted[0] && sorted[0].concession_name) ||
            (sorted[0] && sorted[0].name) ||
            item['Nombre de uso común'] ||
            (sorted[0] && sorted[0].code) ||
            'Sin nombre';

        seen.set(key, { name: displayName, segments: sorted });
    });

    const groupsList = Array.from(seen.values());

    // ALWAYS sort from oldest to newest based on contract start date
    groupsList.sort((a, b) => {
        const yearA = getGroupEarliestStartDate(a);
        const yearB = getGroupEarliestStartDate(b);
        return yearA - yearB;
    });

    return groupsList;
}

// ── SVG helper: create element with attributes ────────────────────────

function renderTimeline(data, highlightCode = null) {
    const groups = buildTimelineGroups(data);
    const badge = document.getElementById('timeline-count-badge');
    if (badge) badge.textContent = `${groups.length} proyecto${groups.length !== 1 ? 's' : ''}`;

    // Layout constants
    const SUBLANE_H = 11;  // height of each individual bar
    const SUBLANE_GAP = 4;   // gap between lanes in the same row
    const ROW_PAD_V = 6;   // top/bottom padding within each row

    // Per-group row metrics (variable heights with multiline text wrapping)
    const rowMetrics = groups.map(g => {
        const n = g.segments.length;
        const lines = wrapTimelineText(g.name, 27);
        const textH = lines.length * 13;
        const barLanesH = n * SUBLANE_H + Math.max(0, n - 1) * SUBLANE_GAP;
        const height = Math.max(ROW_PAD_V * 2 + barLanesH, textH + ROW_PAD_V * 2);

        const startLaneY = (height - barLanesH) / 2;
        const laneYs = g.segments.map((_, si) =>
            startLaneY + si * (SUBLANE_H + SUBLANE_GAP)
        );
        return { height, laneYs, lines };
    });

    // Cumulative row Y positions
    const rowYOffsets = [];
    let cumY = 0;
    rowMetrics.forEach(m => { rowYOffsets.push(cumY); cumY += m.height; });
    const totalH = cumY;

    // Track index of highlighted row for auto-scrolling
    let highlightedRowIdx = -1;

    // Compute global year range
    let minYear = Infinity, maxYear = -Infinity;
    const todayYear = dateToYear(new Date().toISOString().slice(0, 10));

    groups.forEach(g => {
        g.segments.forEach(seg => {
            [seg.start_date, seg.end_date,
            seg.resolution_date, seg.adjudication_date].forEach(d => {
                const y = dateToYear(d);
                if (y !== null) {
                    if (y < minYear) minYear = y;
                    if (y > maxYear) maxYear = y;
                }
            });
        });
    });

    if (!isFinite(minYear)) { minYear = 1990; maxYear = 2070; }
    minYear = Math.floor((minYear - 1) / 5) * 5;
    maxYear = Math.ceil((maxYear + 1) / 5) * 5;

    // DOM references
    const barsEl = document.getElementById('timeline-bars-scroll');
    const labelEl = document.getElementById('timeline-label-col');
    const barsSvg = document.getElementById('timeline-bars-svg');
    const axisSvg = document.getElementById('timeline-axis-svg');

    // Chart dimensions
    const availW = (barsEl.parentElement.parentElement.offsetWidth || 900) - LABEL_W - 2;
    const chartW = Math.max(availW, 100);  // never zero, fills container
    const yearRange = maxYear - minYear;
    function toPx(y) { return ((y - minYear) / yearRange) * chartW; }

    const isLight = document.body.classList.contains('light-theme');
    const textColor = isLight ? '#374151' : '#94a3b8';
    const gridColor = isLight ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.055)';
    const rowAltColor = isLight ? 'rgba(241,245,249,0.7)' : 'rgba(255,255,255,0.018)';
    const labelBg = isLight ? '#f8fafc' : '#0f1626';
    const labelColor = isLight ? '#1e293b' : '#e2e8f0';
    const sepColor = isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.07)';

    const cleanHighlight = highlightCode ? highlightCode.toString().trim() : null;

    // BUILD LABELS
    labelEl.innerHTML = '';
    const labelSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    labelSvg.setAttribute('width', LABEL_W);
    labelSvg.setAttribute('height', totalH);
    labelSvg.style.display = 'block';

    groups.forEach((g, i) => {
        const rowY = rowYOffsets[i];
        const rowH = rowMetrics[i].height;
        const isHighlighted = cleanHighlight && g.segments.some(s => s.code && s.code.toString().trim() === cleanHighlight);

        if (isHighlighted) {
            highlightedRowIdx = i;
        }

        const rowBg = isHighlighted
            ? (isLight ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.30)')
            : (i % 2 === 0 ? rowAltColor : 'transparent');

        labelSvg.appendChild(svgEl('rect', {
            x: 0, y: rowY, width: LABEL_W, height: rowH, fill: rowBg
        }));

        if (isHighlighted) {
            labelSvg.appendChild(svgEl('rect', {
                x: 0, y: rowY, width: 4, height: rowH, fill: 'var(--primary)'
            }));
        }

        labelSvg.appendChild(svgEl('line', {
            x1: 0, y1: rowY + rowH, x2: LABEL_W, y2: rowY + rowH,
            stroke: isHighlighted ? 'rgba(37, 99, 235, 0.3)' : sepColor, 'stroke-width': 1
        }));

        const lines = rowMetrics[i].lines;
        const lineCount = lines.length;

        const txt = svgEl('text', {
            x: 12,
            y: rowY + rowH / 2,
            'text-anchor': 'start',
            'dominant-baseline': 'middle',
            fill: isHighlighted ? 'var(--primary)' : labelColor,
            'font-family': "'Plus Jakarta Sans', sans-serif",
            'font-size': '10',
            'font-weight': isHighlighted ? '700' : '500'
        });

        const lineHeight = 13;
        const startDY = -((lineCount - 1) * lineHeight) / 2;

        lines.forEach((lineStr, lineIdx) => {
            const tspan = svgEl('tspan', {
                x: 12,
                dy: lineIdx === 0 ? startDY : lineHeight
            });
            tspan.textContent = lineStr;
            txt.appendChild(tspan);
        });

        const ttl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        ttl.textContent = g.name || '\u2014';
        txt.appendChild(ttl);
        labelSvg.appendChild(txt);
    });
    labelEl.appendChild(labelSvg);

    // BUILD AXIS
    axisSvg.setAttribute('width', chartW);
    axisSvg.setAttribute('height', AXIS_H);
    axisSvg.innerHTML = '';

    axisSvg.appendChild(svgEl('rect', {
        x: 0, y: 0, width: chartW, height: AXIS_H, fill: labelBg
    }));

    for (let yr = minYear; yr <= maxYear; yr += 5) {
        const x = toPx(yr);
        axisSvg.appendChild(svgEl('line', {
            x1: x, y1: AXIS_H - 8, x2: x, y2: AXIS_H,
            stroke: isLight ? '#cbd5e1' : '#334155', 'stroke-width': 1
        }));
        const lbl = svgEl('text', {
            x: x, y: AXIS_H - 12, 'text-anchor': 'middle',
            fill: textColor,
            'font-family': "'Plus Jakarta Sans', sans-serif",
            'font-size': '10', 'font-weight': '500'
        });
        lbl.textContent = yr;
        axisSvg.appendChild(lbl);
    }

    if (todayYear >= minYear && todayYear <= maxYear) {
        const tx = toPx(todayYear);
        axisSvg.appendChild(svgEl('line', {
            x1: tx, y1: 0, x2: tx, y2: AXIS_H,
            stroke: '#ef4444', 'stroke-width': 1.5, 'stroke-dasharray': '3,3'
        }));
        const todayLbl = svgEl('text', {
            x: tx + 3, y: 12, fill: '#ef4444',
            'font-family': "'Plus Jakarta Sans', sans-serif",
            'font-size': '9', 'font-weight': '700'
        });
        todayLbl.textContent = 'Hoy';
        axisSvg.appendChild(todayLbl);
    }

    axisSvg.appendChild(svgEl('line', {
        x1: 0, y1: AXIS_H - 1, x2: chartW, y2: AXIS_H - 1,
        stroke: isLight ? '#e2e8f0' : '#1e293b', 'stroke-width': 1
    }));

    // BUILD BARS
    barsSvg.setAttribute('width', chartW);
    barsSvg.setAttribute('height', totalH || 1);
    barsSvg.innerHTML = '';

    groups.forEach((g, i) => {
        const rowY = rowYOffsets[i];
        const rowH = rowMetrics[i].height;
        const isHighlighted = cleanHighlight && g.segments.some(s => s.code && s.code.toString().trim() === cleanHighlight);

        const rowBg = isHighlighted
            ? (isLight ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.22)')
            : (i % 2 === 0 ? rowAltColor : 'transparent');

        barsSvg.appendChild(svgEl('rect', {
            x: 0, y: rowY, width: chartW, height: rowH, fill: rowBg
        }));

        barsSvg.appendChild(svgEl('line', {
            x1: 0, y1: rowY + rowH, x2: chartW, y2: rowY + rowH,
            stroke: isHighlighted ? 'rgba(37, 99, 235, 0.3)' : sepColor, 'stroke-width': 1
        }));

        for (let yr = minYear; yr <= maxYear; yr += 5) {
            barsSvg.appendChild(svgEl('line', {
                x1: toPx(yr), y1: rowY, x2: toPx(yr), y2: rowY + rowH,
                stroke: gridColor, 'stroke-width': 1
            }));
        }

        // "Hoy" full-row vertical line
        if (todayYear >= minYear && todayYear <= maxYear) {
            barsSvg.appendChild(svgEl('line', {
                x1: toPx(todayYear), y1: rowY,
                x2: toPx(todayYear), y2: rowY + rowH,
                stroke: '#ef4444', 'stroke-width': 1.2,
                'stroke-dasharray': '3,3', 'pointer-events': 'none'
            }));
        }

        // Segments: each in its own sub-lane
        g.segments.forEach((seg, si) => {
            const color = BAR_COLORS[Math.min(si, BAR_COLORS.length - 1)];
            const laneY = rowY + rowMetrics[i].laneYs[si];
            const startY = dateToYear(seg.start_date);
            const endY = dateToYear(seg.end_date);
            const isCurrentSeg = cleanHighlight && seg.code && seg.code.toString().trim() === cleanHighlight;

            if (startY !== null && endY !== null) {
                const bx = toPx(startY);
                const bw = Math.max(toPx(endY) - bx, 2);
                const by = laneY;
                const bh = SUBLANE_H;

                const rect = svgEl('rect', {
                    x: bx, y: by, width: bw, height: bh,
                    rx: 3, ry: 3, fill: color,
                    opacity: isCurrentSeg ? 1 : 0.82
                });
                rect.style.cursor = 'pointer';

                if (isCurrentSeg) {
                    rect.setAttribute('stroke', '#ffffff');
                    rect.setAttribute('stroke-width', '1.5');
                    rect.setAttribute('filter', 'drop-shadow(0 0 6px ' + color + ')');
                }

                rect.addEventListener('mouseenter', (e) => {
                    rect.setAttribute('opacity', '1');
                    rect.setAttribute('filter', 'drop-shadow(0 2px 5px rgba(0,0,0,0.22))');
                    showTimelineTooltip(e, seg, si + 1, color);
                });
                rect.addEventListener('mousemove', (e) => moveTimelineTooltip(e));
                rect.addEventListener('mouseleave', () => {
                    rect.setAttribute('opacity', isCurrentSeg ? '1' : '0.82');
                    if (!isCurrentSeg) rect.removeAttribute('filter');
                    else rect.setAttribute('filter', 'drop-shadow(0 0 6px ' + color + ')');
                    hideTimelineTooltip();
                });
                rect.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideTimelineTooltip();
                    hideTimelineView(true);
                    if (seg.code) {
                        setTimeout(() => {
                            zoomToProjectCode(seg.code);
                        }, 50);
                    }
                });

                barsSvg.appendChild(rect);

                if (bw > 20) {
                    const seqTxt = svgEl('text', {
                        x: bx + 4, y: by + bh / 2 + 0.5,
                        'dominant-baseline': 'middle',
                        fill: '#ffffff',
                        'font-family': "'Plus Jakarta Sans', sans-serif",
                        'font-size': '8', 'font-weight': '700',
                        'pointer-events': 'none'
                    });
                    seqTxt.textContent = `${seg.seq}\u00ba`;
                    barsSvg.appendChild(seqTxt);
                }
            }

            // Milestone diamond: adjudication_date
            const adjY = dateToYear(seg.adjudication_date);
            if (adjY !== null && adjY >= minYear && adjY <= maxYear) {
                const mx = toPx(adjY);
                const my = laneY + SUBLANE_H / 2;
                const d = MILESTONE_R;
                const poly = svgEl('polygon', {
                    points: `${mx},${my - d} ${mx + d},${my} ${mx},${my + d} ${mx - d},${my}`,
                    fill: '#7c3aed', stroke: '#ffffff', 'stroke-width': 1.5,
                    style: 'cursor: pointer;'
                });
                poly.addEventListener('mouseenter', (e) => {
                    poly.setAttribute('stroke-width', '2.5');
                    poly.setAttribute('fill', '#8b5cf6');
                    showMilestoneTooltip(e, seg.common_name || seg.name, 'Adjudicación', seg.adjudication_date, '#a78bfa');
                });
                poly.addEventListener('mousemove', (e) => moveTimelineTooltip(e));
                poly.addEventListener('mouseleave', () => {
                    poly.setAttribute('stroke-width', '1.5');
                    poly.setAttribute('fill', '#7c3aed');
                    hideTimelineTooltip();
                });
                poly.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideTimelineTooltip();
                    hideTimelineView(true);
                    if (seg.code) {
                        setTimeout(() => {
                            zoomToProjectCode(seg.code);
                        }, 50);
                    }
                });
                barsSvg.appendChild(poly);
            }

            // Milestone circle: resolution_date
            const resY = dateToYear(seg.resolution_date);
            if (resY !== null && resY >= minYear && resY <= maxYear) {
                const cx = toPx(resY);
                const cy = laneY + SUBLANE_H / 2;
                const circ = svgEl('circle', {
                    cx: cx, cy: cy,
                    r: MILESTONE_R,
                    fill: '#f59e0b', stroke: '#ffffff', 'stroke-width': 1.5,
                    style: 'cursor: pointer;'
                });
                circ.addEventListener('mouseenter', (e) => {
                    circ.setAttribute('stroke-width', '2.5');
                    circ.setAttribute('r', (MILESTONE_R + 1.5).toString());
                    circ.setAttribute('fill', '#fbbf24');
                    showMilestoneTooltip(e, seg.common_name || seg.name, 'Resolución', seg.resolution_date, '#fbbf24');
                });
                circ.addEventListener('mousemove', (e) => moveTimelineTooltip(e));
                circ.addEventListener('mouseleave', () => {
                    circ.setAttribute('stroke-width', '1.5');
                    circ.setAttribute('r', MILESTONE_R.toString());
                    circ.setAttribute('fill', '#f59e0b');
                    hideTimelineTooltip();
                });
                circ.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hideTimelineTooltip();
                    hideTimelineView(true);
                    if (seg.code) {
                        setTimeout(() => {
                            zoomToProjectCode(seg.code);
                        }, 50);
                    }
                });
                barsSvg.appendChild(circ);
            }
        });
    });

    // Sync vertical scroll from bars container to label column
    //const barsScrollEl = document.getElementById('timeline-bars-scroll');
    //const labelColEl = document.getElementById('timeline-label-col');
    //if (barsScrollEl && labelColEl) {
    //barsScrollEl.onscroll = () => {
    //labelColEl.scrollTop = barsScrollEl.scrollTop;
    //};
    //}

    // Auto-scroll to highlighted row if specified
    const rowsWrapperEl = document.querySelector('.timeline-rows-wrapper');
    if (highlightedRowIdx !== -1 && rowYOffsets[highlightedRowIdx] !== undefined && rowsWrapperEl) {
        setTimeout(() => {
            const rowY = rowYOffsets[highlightedRowIdx];
            const rowH = rowMetrics[highlightedRowIdx].height;
            const targetScroll = Math.max(0, rowY - (rowsWrapperEl.clientHeight / 2) + (rowH / 2));
            rowsWrapperEl.scrollTo({ top: targetScroll, behavior: 'smooth' });
        }, 60);
    }
}


// 
// ── Tooltip helpers ───────────────────────────────────────────
function showTimelineTooltip(e, seg, licitNum, color) {
    const tip = document.getElementById('timeline-tooltip');
    if (!tip) return;
    const fmt = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { year: 'numeric', month: 'short' }) : '—';
    tip.innerHTML = `
        <span class="timeline-tooltip-name" style="color:${color};">${seg.common_name || seg.name || '—'}</span>
        <div class="timeline-tooltip-row">
            <span class="timeline-tooltip-label">Inicio</span>
            <span class="timeline-tooltip-val">${fmt(seg.start_date)}</span>
        </div>
        <div class="timeline-tooltip-row">
            <span class="timeline-tooltip-label">Término</span>
            <span class="timeline-tooltip-val">${fmt(seg.end_date)}</span>
        </div>
        <div class="timeline-tooltip-row">
            <span class="timeline-tooltip-label">Estado</span>
            <span class="timeline-tooltip-val">${seg.status || '—'}</span>
        </div>
        ${seg.adj ? `<div class="timeline-tooltip-row">
            <span class="timeline-tooltip-label">Adjudicación</span>
            <span class="timeline-tooltip-val">${fmt(seg.adj)}</span>
        </div>` : ''}
    `;
    tip.style.display = 'block';
    moveTimelineTooltip(e);
}

function showMilestoneTooltip(e, commonName, milestoneType, dateVal, color) {
    const tip = document.getElementById('timeline-tooltip');
    if (!tip) return;
    const fmt = (d) => {
        if (!d) return '—';
        const str = String(d).split('T')[0];
        const parts = str.split('-');
        if (parts.length === 3) {
            const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            return dt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
        }
        return d;
    };
    tip.innerHTML = `
        <span class="timeline-tooltip-name" style="color:${color};">${commonName || '—'}</span>
        <div class="timeline-tooltip-row">
            <span class="timeline-tooltip-label">Hito</span>
            <span class="timeline-tooltip-val" style="color:${color}; font-weight:700;">${milestoneType}</span>
        </div>
        <div class="timeline-tooltip-row">
            <span class="timeline-tooltip-label">Fecha</span>
            <span class="timeline-tooltip-val">${fmt(dateVal)}</span>
        </div>
    `;
    tip.style.display = 'block';
    moveTimelineTooltip(e);
}

function moveTimelineTooltip(e) {
    const tip = document.getElementById('timeline-tooltip');
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

function hideTimelineTooltip() {
    const tip = document.getElementById('timeline-tooltip');
    if (tip) tip.style.display = 'none';
}

// ── Wire up events (called from DOMContentLoaded) ─────────────
// ── MOTOR DE ANÁLISIS DE INVERSIÓN Y ESTADÍSTICAS REGIONALES ─────────────────
let chartInvByRegionInstance = null;
let chartContractsByRegionInstance = null;
let chartInvShareRegionInstance = null;
let chartActiveContractsYearInstance = null;
let chartActiveInvYearInstance = null;

// Bidders analytics chart instances
let chartBiddersHistogramInstance = null;
let chartBiddersPieInstance = null;
let chartTopCompaniesInstance = null;



function initTimelineEvents() {
    const closeBtn = document.getElementById('btn-close-timeline');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => hideTimelineView());
    }

    // Forward wheel events from the label column to the bars scroller.
    // The label col has overflow-y:hidden so the browser won't scroll it
    // natively — we intercept wheel events and delegate to barsScrollEl,
    // which in turn syncs the label position via its onscroll handler.
    //const labelCol = document.getElementById('timeline-label-col');
    //if (labelCol) {
    //labelCol.addEventListener('wheel', (e) => {
    //e.preventDefault();
    //const barsScroll = document.getElementById('timeline-bars-scroll');
    //if (barsScroll) barsScroll.scrollTop += e.deltaY;
    //}, { passive: false });
    //}
}

