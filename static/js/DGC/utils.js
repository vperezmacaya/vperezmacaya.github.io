function _normalizeStr(s) {
    if (!s) return '';
    return String(s).toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function _parseRegionsFromVal(regionStr) {
    if (!regionStr) return [];
    const str = String(regionStr).replace(/&nbsp;/g, ' ').replace(/ /g, ' ');
    return str.split(/[;,]/).map(p => {
        p = p.trim();
        if (p === 'Metropolitana') return 'Metropolitana de Santiago';
        if (p === 'Araucanía' || p === 'Araucania') return 'La Araucanía';
        return p;
    }).filter(Boolean);
}

function getStatusColor(statusName) {
    const s = (statusName || '').toLowerCase();
    if (s.includes('operac') && s.includes('construc')) return '#d97706';
    if (s.includes('operac')) return '#059669';
    if (s.includes('construc')) return '#0284c7';
    return '#64748b';
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

// --- MAP INITIALIZATION AND STYLE LOGIC ---

function mapGeojsonRegionToDbRegion(geojsonName) {
    if (!geojsonName) return '';

    const name = geojsonName.trim();
    const lowerName = name.toLowerCase();

    if (lowerName.includes('bío-bío') || lowerName.includes('biobío') || lowerName.includes('del bío')) {
        return 'Biobío';
    }
    if (lowerName.includes('magallanes')) {
        return 'Magallanes y de la Antártica Chilena';
    }
    if (lowerName.includes('aysén') || lowerName.includes('aysen') || lowerName.includes('ibáñez') || lowerName.includes('ibañez')) {
        const found = availableRegionsList.find(reg => reg.toLowerCase().includes('aysén') || reg.toLowerCase().includes('aysen'));
        if (found) return found;
    }

    const cleanGeo = name.toLowerCase()
        .replace(/región de |región del |región metropolitana de /g, '')
        .replace(/ del gral\.ibañez del campo/g, '')
        .replace(/libertador bernardo o['’]higgins/g, "o'higgins")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/-/g, '')
        .trim();

    for (let regVal of availableRegionsList) {
        if (!regVal) continue;
        const cleanOpt = regVal.toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/-/g, '');

        if (cleanOpt.includes(cleanGeo) || cleanGeo.includes(cleanOpt)) {
            return regVal;
        }
    }
    return '';
}

function getRegionStyle(feature) {
    const regionName = feature.properties ? feature.properties.Region : '';
    const dbRegionValue = mapGeojsonRegionToDbRegion(regionName);
    const isSelected = appState.selectedRegions && appState.selectedRegions.length > 0 && dbRegionValue && appState.selectedRegions.includes(dbRegionValue);

    return {
        className: 'region-boundary',
        color: 'var(--primary)',
        weight: isSelected ? 2.5 : 0.8,
        opacity: isSelected ? 0.95 : 0.25,
        fillColor: isSelected ? 'var(--primary)' : 'var(--bg-card)',
        fillOpacity: isSelected ? 0.32 : 0.08
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

// ── Main render function ──────────────────────────────────────────────
