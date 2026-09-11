// ─── Estado global Metro de Santiago ──────────────────────────────────────────
var metroState = {
    search: '',
    selectedClasses: [],
    selectedTipos: [],
    selectedProjectName: null,
    selectedProjectId: null,
    hoveredProjectName: null,
    hoveredProjectId: null,
    selectedOperatingLine: null,
    hoveredOperatingLine: null,
    sortBy: 'investment_mm_usd',
    sortOrder: 'desc',
    page: 1,
    pageSize: 50,
    tableMode: 'projects', // 'projects', 'lines' or 'comunas'
    selectedComuna: null,
    userExplicitlyEnabledComunas: false,
    timelineOpen: false,
    comunasOpen: false,
    demandaOpen: false
};
if (typeof window !== 'undefined') window.metroState = metroState;

// Colores oficiales por Línea de Metro (dinámicos desde Excel METRO_DATA.line_colors)
var METRO_LINE_COLORS = {
    'Línea 1': '#d7141a',
    'Línea 2': '#ffc72c',
    'Línea 3': '#6d3b14',
    'Línea 4': '#0047ba',
    'Línea 4A': '#00a3e0',
    'Línea 5': '#00843d',
    'Línea 6': '#7b1fa2', // Morado
    'Extensión Línea 6 Oriente': '#7b1fa2', // Morado
    'Extensión Línea 6 Poniente': '#7b1fa2', // Morado
    'Línea 7': '#52525b', // Gris
    'Línea 8': '#ea580c', // Naranjo
    'Línea 9': '#db2777', // Rosado
    'Línea 9 (Tramos 1 y 2)': '#db2777', // Rosado
    'Línea 9 (Tramo 3)': '#db2777', // Rosado
    'Línea A': '#06b6d4'  // Cian
};
if (typeof window !== 'undefined' && window.METRO_DATA && window.METRO_DATA.line_colors) {
    Object.assign(METRO_LINE_COLORS, window.METRO_DATA.line_colors);
}

// Función para obtener el color específico de cualquier proyecto de expansión o línea
function metroGetProjectColor(lineOrProj) {
    if (!lineOrProj) return '#52525b';
    const str = typeof lineOrProj === 'string'
        ? lineOrProj
        : (lineOrProj.line || lineOrProj.linea || lineOrProj.name || '');
    
    const colors = (typeof window !== 'undefined' && window.METRO_LINE_COLORS) ? window.METRO_LINE_COLORS : METRO_LINE_COLORS;
    if (colors && colors[str]) {
        return colors[str];
    }
    const s = str.toLowerCase();
    for (let k in colors) {
        if (s === k.toLowerCase() || s.includes(k.toLowerCase()) || k.toLowerCase().includes(s)) {
            return colors[k];
        }
    }
    return '#52525b';
}
if (typeof window !== 'undefined') window.metroGetProjectColor = metroGetProjectColor;

// Colores por Clasificación Ambiental
const METRO_CLASS_COLORS = {
    'Con RCA y en construcción': '#10b981',                         // Verde Esmeralda
    'En Estudio de Impacto Ambiental (EIA)': '#f59e0b',             // Ámbar
    'En etapa de Factibilidad (sin ingreso de EIA)': '#3b82f6'      // Azul
};

// Colores por Tipo de Proyecto
const METRO_TIPO_COLORS = {
    'Línea Nueva': '#0284c7', // Azul Royal
    'Extensión': '#8b5cf6'    // Púrpura
};

// Color distintivo corporativo idéntico a EFE.html
var METRO_PROJECT_COLOR = '#059669'; // Emerald Green oficial CATLEC / EFE
if (typeof window !== 'undefined') window.METRO_PROJECT_COLOR = METRO_PROJECT_COLOR;

// Icono SVG distintivo de Metro de Santiago (idéntico en espíritu y escala a EFE_TRAIN_SVG)
var METRO_SUBWAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M4 10h16"/><path d="M10 4v16"/><path d="m8 20-2 2"/><path d="m16 20 2 2"/><circle cx="8" cy="15" r="0.8" fill="#ffffff"/><circle cx="16" cy="15" r="0.8" fill="#ffffff"/></svg>`;
if (typeof window !== 'undefined') window.METRO_SUBWAY_SVG = METRO_SUBWAY_SVG;

// Iconos SVG para Líneas y Tipos de Metro
function metroGetProjectTypeSvg(tipo, w = 13, h = 13, stroke = 'currentColor') {
    const t = tipo ? String(tipo).trim().toLowerCase() : '';
    if (t.includes('extensi')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M4 10h16"/><path d="M10 4v16"/><path d="m8 20-2 2"/><path d="m16 20 2 2"/><circle cx="8" cy="15" r="0.8" fill="${stroke}"/><circle cx="16" cy="15" r="0.8" fill="${stroke}"/></svg>`;
}

// Variables globales de capas Leaflet
var metroMap = null;
var metroTileLayer = null;
var metroExistingLinesLayer = null;
var metroExistingStationsLayer = null;
var metroFuturoStationsLayer = null;
var metroExpansionLayer = null;
var metroShapeGeometries = {};   // cod (string) -> array de capas Leaflet
var metroProjectMarkers = [];
var metroClusterOriginMarkers = [];
var metroClusterLegLayers = [];
var metroShapeToProjects = {};   // cod -> [proj, ...]
var metroShowProjects = true;
var metroShowExistingLines = true;
var metroShowStations = true;
var metroComunasLayer = null;
var metroShowComunas = false;
var metroUserExplicitlyEnabledComunas = false;
var metroSelectedComuna = null;
var metroHoveredComuna = null;

var metroAvailableClasses = [
    'Con RCA y en construcción',
    'En Estudio de Impacto Ambiental (EIA)',
    'En etapa de Factibilidad (sin ingreso de EIA)'
];

var metroAvailableTipos = [
    'Línea Nueva',
    'Extensión'
];

if (typeof window !== 'undefined') {
    window.METRO_LINE_COLORS = METRO_LINE_COLORS;
    window.METRO_CLASS_COLORS = METRO_CLASS_COLORS;
    window.METRO_TIPO_COLORS = METRO_TIPO_COLORS;
    window.metroAvailableClasses = metroAvailableClasses;
    window.metroAvailableTipos = metroAvailableTipos;
}

// Referencias DOM
var metroTableBody, metroEmptyState,
    metroPaginationInfo, metroBtnPrev, metroBtnNext,
    metroBtnResetMap;

// ─── Normalización y Mapeo Dinámico de Estaciones desde METRO_DATA.stations ───
function metroNormalizeStationText(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}
if (typeof window !== 'undefined') {
    window.metroNormalizeStationText = metroNormalizeStationText;
    window.metroNormalizeText = metroNormalizeStationText;
    window.metroNormalizeComunaText = metroNormalizeStationText;
}

// Estructuras dinámicas de estaciones
var METRO_ACTIVE_COMBINATIONS = {};
var METRO_EXCLUSIVE_STATIONS_MAP = {};
var METRO_COMBINATION_LINE_MAP = {};
var METRO_STATION_LINE_MAP = {};
var METRO_COMBINATION_STATIONS = new Set();
var METRO_STATIONS_MAP = {};
var METRO_STATIONS_BY_SHAPE = {};
var METRO_STATIONS_BY_LINE_NAME = {};

function metroInitStationsLookup() {
    METRO_ACTIVE_COMBINATIONS = {};
    METRO_EXCLUSIVE_STATIONS_MAP = {};
    METRO_COMBINATION_LINE_MAP = {};
    METRO_STATION_LINE_MAP = {};
    METRO_COMBINATION_STATIONS = new Set();
    METRO_STATIONS_MAP = {};
    METRO_STATIONS_BY_SHAPE = {};
    METRO_STATIONS_BY_LINE_NAME = {};

    // Sincronizar colores dinámicos desde Excel si METRO_DATA está presente
    if (typeof window !== 'undefined' && window.METRO_DATA && window.METRO_DATA.line_colors) {
        Object.assign(METRO_LINE_COLORS, window.METRO_DATA.line_colors);
        window.METRO_LINE_COLORS = METRO_LINE_COLORS;
    }

    const stations = (window.METRO_DATA && window.METRO_DATA.stations) || [];
    if (!stations || stations.length === 0) return;

    stations.forEach(st => {
        const normName = metroNormalizeStationText(st.name);
        const mainLine = st.line || (st.lines && st.lines[0]) || '';
        const normLine = metroNormalizeStationText(mainLine);
        const shapeId = st.shape_id ? String(st.shape_id).trim() : '';

        // 1. Indexar por Código Shape (llave primaria 100% única)
        if (shapeId) {
            METRO_STATIONS_BY_SHAPE[shapeId] = st;
        }

        // 2. Indexar por Clave Compuesta Línea + Nombre (ej: 'linea 5::cumming' vs 'linea 7::cumming')
        const compositeKey = `${normLine}::${normName}`;
        METRO_STATIONS_BY_LINE_NAME[compositeKey] = st;

        // 3. Indexar por nombre preservando prioridad a operativas en caso de colisión
        if (!METRO_STATIONS_MAP[normName] || st.status === 'Operativa') {
            METRO_STATIONS_MAP[normName] = st;
        }
        if (!METRO_STATIONS_MAP[normName]._list) {
            METRO_STATIONS_MAP[normName]._list = [];
        }
        METRO_STATIONS_MAP[normName]._list.push(st);

        const activeLines = st.lines || (mainLine ? [mainLine] : []);

        // Todas las líneas incluyendo futuras combinaciones
        const allLines = [...activeLines];
        if (st.future_combination && Array.isArray(st.future_combination)) {
            st.future_combination.forEach(fl => {
                if (fl && !allLines.includes(fl)) allLines.push(fl);
            });
        }

        METRO_STATION_LINE_MAP[normName] = mainLine;
        METRO_STATION_LINE_MAP[compositeKey] = mainLine;
        if (shapeId) METRO_STATION_LINE_MAP[shapeId] = mainLine;

        const hasFutureComb = Boolean(
            (Array.isArray(st.future_combination) && st.future_combination.length > 0) ||
            (typeof st.future_combination === 'string' && st.future_combination.trim() && st.future_combination.trim() !== 'nan' && st.future_combination.trim() !== 'None') ||
            (st.future_combination_str && st.future_combination_str.trim() && st.future_combination_str.trim() !== 'nan' && st.future_combination_str.trim() !== 'None')
        );
        const isCombStation = Boolean(st.is_combination || hasFutureComb);

        if (isCombStation) {
            METRO_COMBINATION_STATIONS.add(normName);
            METRO_COMBINATION_LINE_MAP[normName] = allLines;
            METRO_COMBINATION_LINE_MAP[compositeKey] = allLines;
            if (shapeId) METRO_COMBINATION_LINE_MAP[shapeId] = allLines;
            if (activeLines.length > 1) {
                METRO_ACTIVE_COMBINATIONS[normName] = activeLines;
                METRO_ACTIVE_COMBINATIONS[compositeKey] = activeLines;
                if (shapeId) METRO_ACTIVE_COMBINATIONS[shapeId] = activeLines;
            }
        } else {
            METRO_EXCLUSIVE_STATIONS_MAP[normName] = mainLine;
            METRO_EXCLUSIVE_STATIONS_MAP[compositeKey] = mainLine;
            if (shapeId) METRO_EXCLUSIVE_STATIONS_MAP[shapeId] = mainLine;
        }
    });

    if (typeof window !== 'undefined') {
        window.METRO_ACTIVE_COMBINATIONS = METRO_ACTIVE_COMBINATIONS;
        window.METRO_EXCLUSIVE_STATIONS_MAP = METRO_EXCLUSIVE_STATIONS_MAP;
        window.METRO_COMBINATION_LINE_MAP = METRO_COMBINATION_LINE_MAP;
        window.METRO_STATION_LINE_MAP = METRO_STATION_LINE_MAP;
        window.METRO_COMBINATION_STATIONS = METRO_COMBINATION_STATIONS;
        window.METRO_STATIONS_MAP = METRO_STATIONS_MAP;
        window.METRO_STATIONS_BY_SHAPE = METRO_STATIONS_BY_SHAPE;
        window.METRO_STATIONS_BY_LINE_NAME = METRO_STATIONS_BY_LINE_NAME;
    }
}

// Función unificada para resolver una estación por Feature, Código Shape o Nombre + Línea
function metroFindStation(param, lineHint) {
    if (!param) return null;
    const byShape = window.METRO_STATIONS_BY_SHAPE || METRO_STATIONS_BY_SHAPE || {};
    const byComp = window.METRO_STATIONS_BY_LINE_NAME || METRO_STATIONS_BY_LINE_NAME || {};
    const byName = window.METRO_STATIONS_MAP || METRO_STATIONS_MAP || {};

    // Si se pasa un objeto Feature GeoJSON
    if (typeof param === 'object') {
        const p = param.properties || param;
        const sh = p.shape_id || param.id || p['@id'];
        if (sh && byShape[sh]) return byShape[sh];
        const l = p.linea || p.line || lineHint;
        const n = p.name;
        if (l && n) {
            const comp = `${metroNormalizeStationText(l)}::${metroNormalizeStationText(n)}`;
            if (byComp[comp]) return byComp[comp];
        }
        return (n && byName[metroNormalizeStationText(n)]) || null;
    }

    // Si se pasa un string
    const s = String(param).trim();
    if (byShape[s]) return byShape[s];
    if (lineHint) {
        const comp = `${metroNormalizeStationText(lineHint)}::${metroNormalizeStationText(s)}`;
        if (byComp[comp]) return byComp[comp];
    }
    const norm = metroNormalizeStationText(s);
    return byName[norm] || null;
}
if (typeof window !== 'undefined') window.metroFindStation = metroFindStation;
if (typeof window !== 'undefined') window.metroInitStationsLookup = metroInitStationsLookup;

// Inicializar inmediatamente al cargar state.js si METRO_DATA ya está en memoria
if (typeof window !== 'undefined' && window.METRO_DATA && window.METRO_DATA.stations) {
    metroInitStationsLookup();
}

// ─── Shared External Dark Tooltip (mismo popup negro que EFE.html) ────────────
function metroExternalTooltip(context) {
    const { chart, tooltip } = context;
    const tooltipId = 'metro-chart-external-tooltip';
    let el = document.getElementById(tooltipId);
    if (!el) {
        el = document.createElement('div');
        el.id = tooltipId;
        el.style.cssText = [
            'position:fixed',
            'background:rgba(15,23,42,0.94)',
            'color:#fff',
            'border-radius:6px',
            'padding:6px 10px',
            'font:12px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            'pointer-events:none',
            'z-index:99999',
            'box-shadow:0 4px 14px rgba(0,0,0,0.3)',
            'border:1px solid rgba(255,255,255,0.12)',
            'max-width:380px',
            'word-break:break-word',
            'opacity:0'
        ].join(';');
        document.body.appendChild(el);
    }

    const title = (tooltip.title || []).join('\n');
    const bodyLines = (tooltip.body || []).flatMap(b => b.lines);
    const afterLines = tooltip.afterBody || [];

    if (tooltip.opacity === 0 || (!title && bodyLines.length === 0 && afterLines.length === 0)) {
        el.style.transition = 'opacity 0.25s ease-in';
        el.style.opacity = '0';
        return;
    }

    const wasVisible = parseFloat(el.style.opacity || '0') > 0.05;

    el.innerHTML = [
        title ? `<div style="font-weight:700;margin-bottom:3px;color:#f8fafc;font-size:12px;">${title}</div>` : '',
        ...bodyLines.map(line => `<div style="color:#e2e8f0;font-size:11.5px;margin-top:2px;">${line}</div>`),
        afterLines.length > 0 ? `<div style="margin-top:6px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.15);color:#94a3b8;font-size:11px;line-height:1.45;">` + afterLines.map(line => `<div>${line}</div>`).join('') + `</div>` : ''
    ].join('');

    const canvasRect = chart.canvas.getBoundingClientRect();
    let left = canvasRect.left + tooltip.caretX + 10;
    let top = canvasRect.top + tooltip.caretY - 10;

    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && left + rect.width > window.innerWidth - 8) {
        left = canvasRect.left + tooltip.caretX - rect.width - 10;
    }
    if (rect.height > 0 && top + rect.height > window.innerHeight - 8) {
        top = window.innerHeight - rect.height - 8;
    }
    if (top < 10) top = 10;
    if (left < 10) left = 10;

    if (wasVisible) {
        el.style.transition = 'opacity 0.2s ease-out, left 0.15s cubic-bezier(0.2, 0, 0, 1), top 0.15s cubic-bezier(0.2, 0, 0, 1)';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.opacity = '1';
    } else {
        el.style.transition = 'none';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        void el.offsetHeight;
        el.style.transition = 'opacity 0.2s ease-out';
        el.style.opacity = '1';
    }
}
if (typeof window !== 'undefined') {
    window.metroExternalTooltip = metroExternalTooltip;
}


