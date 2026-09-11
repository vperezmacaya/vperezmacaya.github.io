function _normalizeStr(s) {
    if (!s) return '';
    return String(s).toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function shortenRegionName(name) {
    if (!name) return '';
    let str = String(name).trim();
    str = str.replace(/^Región\s+(de\s+la\s+|del\s+|de\s+)?/i, '');

    if (/metropolitana/i.test(str)) return 'Metropolitana';
    if (/ays[eé]n/i.test(str)) return 'Aysén';
    if (/magallanes/i.test(str)) return 'Magallanes';
    if (/o'higgins|bernardo/i.test(str)) return "O'Higgins";

    return str;
}

function _parseRegionsFromVal(regionStr) {
    if (!regionStr) return [];
    const str = String(regionStr).replace(/&nbsp;/g, ' ').replace(/ /g, ' ');
    return str.split(/[;,/]/).map(p => {
        return shortenRegionName(p.trim());
    }).filter(Boolean);
}

// Generate Chart.js display (Dual charts displayed simultaneously)

function formatUF(val) {
    if (val === null || val === undefined || isNaN(val)) return '0 UF';

    // Format millions
    const millions = val / 1000000;
    if (millions >= 1) {
        return `${millions.toFixed(1).replace(/\.0$/, '')}M UF`;
    }
    if (val >= 1000) {
        return `${(val / 1000).toFixed(1).replace(/\.0$/, '')}k UF`;
    }
    return `${val.toLocaleString('es-CL')} UF`;
}

function formatUFComplete(val) {
    if (val === null || val === undefined || isNaN(val)) return 'SIN DATO';
    return Math.round(val).toLocaleString('es-CL');
}

function formatDate(val) {
    if (val === null || val === undefined || val === 'NaT' || val === 'NaT 00:00:00') return 'N/A';
    if (typeof val === 'string') {
        if (val.trim() === '' || val.startsWith('SD') || val.startsWith('sin')) return 'N/A';
        // Try clean up date format
        const tIndex = val.indexOf(' ');
        return tIndex > 0 ? val.substring(0, tIndex) : val;
    }
    return val;
}

function formatProgress(val) {
    if (val === null || val === undefined) return 'No registra';
    if (typeof val === 'string') {
        if (val.trim() === 'No aplica' || val.trim() === 'SD') return val;
        return val;
    }
    // If it is a float between 0 and 1, represent as percentage
    if (val <= 1.0) {
        return `${Math.round(val * 100)}%`;
    }
    return `${val}%`;
}

// De-bouncer for keystrokes
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// --- SECTOR-BASED DESIGN SYSTEM & COLOR STRATEGY ---
function getSectorConfig(sector) {

    const secLower = (sector || '').toLowerCase();
    if (secLower.includes('aerop')) {
        return {
            name: 'Aeroportuaria',
            color: '#0284c7',
            svg: `<svg viewBox="0 0 24 24" fill="white" style="width: 13px; height: 13px; display: block;"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L14 19v-5.5z"/></svg>`
        };
    } else if (secLower.includes('hosp') || secLower.includes('salud')) {
        return {
            name: 'Hospitalaria',
            color: '#059669',
            svg: `<svg viewBox="0 0 24 24" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px; display: block;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
        };
    } else if (secLower.includes('vial urbana')) {
        return {
            name: 'Vial urbana',
            color: '#c2410c',
            svg: `<svg viewBox="0 0 24 24" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px; display: block;"><path d="M4 21L9 3M20 21L15 3M12 3v4M12 11v4M12 19v2"/></svg>`
        };
    } else if (secLower.includes('vial interurbana') || secLower.includes('vial') || secLower.includes('camino') || secLower.includes('ruta') || secLower.includes('autop')) {
        return {
            name: 'Vial interurbana',
            color: '#d97706',
            svg: `<svg viewBox="0 0 24 24" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px; display: block;"><line x1="6" y1="3" x2="6" y2="21"></line><line x1="18" y1="3" x2="18" y2="21"></line><line x1="12" y1="3" x2="12" y2="7"></line><line x1="12" y1="11" x2="12" y2="15"></line><line x1="12" y1="19" x2="12" y2="21"></line></svg>`
        };
    } else if (secLower.includes('edificaci') || secLower.includes('equipamiento')) {
        return {
            name: 'Edificación pública',
            color: '#6366f1',
            svg: `<svg viewBox="0 0 24 24" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px; display: block;"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h2M13 10h2M9 14h2M13 14h2"/></svg>`
        };
    } else if (secLower.includes('penitenciaria') || secLower.includes('carcel')) {
        return {
            name: 'Penitenciaria',
            color: '#475569',
            svg: `<svg viewBox="0 0 24 24" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px; display: block;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
        };
    } else if (secLower.includes('hidrica') || secLower.includes('hídrica') || secLower.includes('agua')) {
        return {
            name: 'Soluciones hídricas',
            color: '#0891b2',
            svg: `<svg viewBox="0 0 24 24" fill="white" style="width: 12px; height: 12px; display: block;"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`
        };
    } else {
        return {
            name: sector || 'Diversos',
            color: '#8b5cf6',
            svg: `<svg viewBox="0 0 24 24" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px; display: block;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
        };
    }
}


function getRegionStyle(feature) {
    return {
        color: '#3b82f6',
        weight: 1,
        opacity: 0.25,
        fillColor: '#3b82f6',
        fillOpacity: 0.03,
        className: 'efe-region-path',
        interactive: false
    };
}


function wrapTimelineText(text, maxCharsPerLine = 27) {
    if (!text) return ['—'];
    const words = text.toString().split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(w => {
        if ((currentLine + (currentLine ? ' ' : '') + w).length <= maxCharsPerLine) {
            currentLine += (currentLine ? ' ' : '') + w;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = w;
        }
    });
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [text];
}

// ── Show / Hide timeline ──────────────────────────────────────────────

function dateToYear(str) {
    if (!str) return null;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const start = new Date(y, 0, 1);
    const end = new Date(y + 1, 0, 1);
    return y + (d - start) / (end - start);
}


function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
}

// ── Chart.js Helper Utilities (DGC Dashboard) ───────────────────────────

/**
 * Creates a new Chart.js instance or safely updates an existing one in-place.
 * Prevents canvas recreation, eliminates code duplication, and preserves animations.
 */
function createOrUpdateChart(canvasOrId, instance, config) {
    const canvas = typeof canvasOrId === 'string' ? document.getElementById(canvasOrId) : canvasOrId;
    if (!canvas) return null;

    if (instance && typeof instance.destroy === 'function') {
        instance.destroy();
    }

    return new Chart(canvas.getContext('2d'), config);
}

/**
 * Specialized helper for DGC Doughnut Charts with decoupled HTML Legends.
 */
function renderDgcDoughnutChart({
    canvasId,
    instance,
    labels = [],
    data = [],
    colors = [],
    cutout = '65%',
    borderWidth = 1.5,
    isDark = false,
    hoverOffset = 0,
    externalTooltip = null,
    tooltipLabelCallback = null,
    legendContainerId = null,
    legendTotal = null,
    legendFontSize = '0.75rem',
    legendItemPadding = '0.04rem 0',
    onLegendHover = null,
    emptyLegendHtml = null,
    extraLegendHtml = null
}) {
    const borderColor = isDark ? '#0f172a' : '#ffffff';

    const config = {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: borderColor,
                borderWidth: borderWidth,
                hoverOffset: hoverOffset
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: cutout,
            plugins: {
                legend: { display: false }
            }
        }
    };

    if (externalTooltip || tooltipLabelCallback) {
        config.options.plugins.tooltip = {
            enabled: false,
            external: externalTooltip
        };
        if (tooltipLabelCallback) {
            config.options.plugins.tooltip.callbacks = {
                label: tooltipLabelCallback
            };
        }
    }

    const chart = createOrUpdateChart(canvasId, instance, config);

    // Render HTML Legend if container provided
    if (legendContainerId) {
        const legendEl = document.getElementById(legendContainerId);
        if (legendEl) {
            legendEl.innerHTML = '';
            if (emptyLegendHtml) {
                legendEl.innerHTML = emptyLegendHtml;
            } else {
                const total = (legendTotal !== null && legendTotal !== undefined)
                    ? legendTotal
                    : (data.reduce((acc, v) => acc + (Number(v) || 0), 0) || 1);

                labels.forEach((lbl, idx) => {
                    const val = data[idx] !== undefined ? data[idx] : 0;
                    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                    const col = colors[idx] || '#64748b';

                    const itemDiv = document.createElement('div');
                    itemDiv.style.cssText = `display:flex; align-items:center; justify-content:space-between; gap:0.2rem; font-size:${legendFontSize}; padding:${legendItemPadding}; cursor:pointer;`;
                    itemDiv.innerHTML = `
                        <div style="display:flex; align-items:center; gap:0.3rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">
                            <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:${legendFontSize};">${lbl}</span>
                        </div>
                        <span style="font-weight:700; color:var(--text-primary); flex-shrink:0; font-size:${legendFontSize};">${pct}%</span>
                    `;

                    if (typeof onLegendHover === 'function' && chart) {
                        itemDiv.addEventListener('mouseenter', () => onLegendHover(chart, idx, 'enter'));
                        itemDiv.addEventListener('mouseleave', () => onLegendHover(chart, idx, 'leave'));
                    }

                    legendEl.appendChild(itemDiv);
                });

                if (extraLegendHtml) {
                    const extraDiv = document.createElement('div');
                    extraDiv.innerHTML = extraLegendHtml;
                    legendEl.appendChild(extraDiv.firstElementChild || extraDiv);
                }
            }
        }
    }

    return chart;
}
