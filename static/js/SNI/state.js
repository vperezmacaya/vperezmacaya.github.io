/**
 * static/js/SNI/state.js
 * Estado global y funciones de consulta para la plataforma SNI (Inversión Pública)
 */

const sniState = {
    // Filtros activos
    selectedYears: [],       // [] = todos
    selectedRegions: [],     // [] = todas
    selectedMinistries: [],  // [] = todos
    selectedSources: [],     // [] = todas
    selectedSubtitles: [],   // [] = todos
    
    // Vista y UI
    currentView: 'map',      // 'map' | 'territorial' | 'ministries' | 'temporal' | 'table'
    selectedMapMetric: 'total', // 'total' | 'per_capita' | 'km2' | 'pib_ratio'
    activeRegionDetail: null, // Región seleccionada para el panel lateral / modal
    
    // Búsqueda y tabla
    tableSearch: '',
    tableSortCol: 'usd',
    tableSortOrder: 'desc',
    tablePage: 1,
    tablePageSize: 20
};

// Paleta de colores consistente con CATLEC
const SNI_COLORS = {
    primary: '#2563eb',
    secondary: '#0ea5e9',
    accent: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    ministries: {
        'MOP': '#2563eb',
        'MINSAL': '#10b981',
        'CONCESIONES': '#8b5cf6',
        'Interior (sin subdere)': '#f59e0b',
        'SUBDERE': '#06b6d4',
        'Tesoro Público': '#64748b',
        'EMPRESAS DEL ESTADO': '#ec4899',
        'MINVU': '#f97316',
        'MINEDUC': '#14b8a6',
        'Transportes': '#a855f7',
        'MINAGRI': '#84cc16',
        'MINDEP': '#eab308',
        'Otros': '#94a3b8'
    },
    palette: [
        '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4',
        '#ec4899', '#f97316', '#14b8a6', '#a855f7', '#84cc16',
        '#64748b', '#e11d48', '#0284c7', '#059669', '#d97706'
    ]
};

/**
 * Retorna la matriz filtrada según los filtros actualmente seleccionados
 */
function getFilteredSNIMatrix() {
    if (!window.SNI_DATA || !window.SNI_DATA.matrix) return [];
    const { selectedYears, selectedRegions, selectedMinistries, selectedSources, selectedSubtitles } = sniState;

    return window.SNI_DATA.matrix.filter(row => {
        if (selectedYears.length > 0 && !selectedYears.includes(row.y)) return false;
        if (selectedRegions.length > 0 && !selectedRegions.includes(row.r)) return false;
        if (selectedMinistries.length > 0 && !selectedMinistries.includes(row.m)) return false;
        if (selectedSources.length > 0 && !selectedSources.includes(row.f)) return false;
        if (selectedSubtitles.length > 0 && !selectedSubtitles.includes(row.s)) return false;
        return true;
    });
}

/**
 * Calcula los totales agregados por Región a partir de la matriz filtrada
 */
function getRegionalAggregates() {
    const matrix = getFilteredSNIMatrix();
    const context = window.SNI_DATA ? window.SNI_DATA.regional_context : {};
    const regionMap = {};

    // Inicializar con regiones del orden oficial
    if (window.SNI_DATA && window.SNI_DATA.filters.regions) {
        window.SNI_DATA.filters.regions.forEach(r => {
            const ctx = context[r] || { poblacion: 0, superficie_km2: 0, pib_pct: 0 };
            regionMap[r] = {
                region: r,
                total_usd: 0,
                total_pesos: 0,
                poblacion: ctx.poblacion || 0,
                superficie_km2: ctx.superficie_km2 || 0,
                pib_pct: ctx.pib_pct || 0,
                ministries: {}
            };
        });
    }

    let globalTotalUsd = 0;
    matrix.forEach(row => {
        if (!regionMap[row.r]) {
            regionMap[row.r] = {
                region: row.r,
                total_usd: 0,
                total_pesos: 0,
                poblacion: 0,
                superficie_km2: 0,
                pib_pct: 0,
                ministries: {}
            };
        }
        regionMap[row.r].total_usd += row.u;
        regionMap[row.r].total_pesos += row.p;
        globalTotalUsd += row.u;

        if (!regionMap[row.r].ministries[row.m]) regionMap[row.r].ministries[row.m] = 0;
        regionMap[row.r].ministries[row.m] += row.u;
    });

    const activeYearsCount = sniState.selectedYears.length > 0 
        ? sniState.selectedYears.length 
        : (window.SNI_DATA ? window.SNI_DATA.filters.years.length : 15);

    // Calcular ratios y per cápita
    const result = Object.values(regionMap).map(item => {
        const avg_usd_year = item.total_usd / Math.max(activeYearsCount, 1);
        const avg_pesos_year = item.total_pesos / Math.max(activeYearsCount, 1);
        const per_capita_clp = item.poblacion > 0 ? avg_pesos_year / item.poblacion : 0;
        const per_km2_clp = item.superficie_km2 > 0 ? avg_pesos_year / item.superficie_km2 : 0;
        const inv_pct = globalTotalUsd > 0 ? (item.total_usd / globalTotalUsd) * 100 : 0;
        const pib_ratio = item.pib_pct > 0 ? inv_pct / item.pib_pct : 0;

        return {
            ...item,
            avg_usd_year: Math.round(avg_usd_year * 100) / 100,
            per_capita_clp: Math.round(per_capita_clp),
            per_km2_clp: Math.round(per_km2_clp),
            inv_pct: Math.round(inv_pct * 100) / 100,
            pib_ratio: Math.round(pib_ratio * 100) / 100
        };
    });

    return { regions: result, globalTotalUsd };
}

/**
 * Calcula los totales agregados por Ministerio a partir de la matriz filtrada
 */
function getMinistryAggregates() {
    const matrix = getFilteredSNIMatrix();
    const minMap = {};

    matrix.forEach(row => {
        if (!minMap[row.m]) minMap[row.m] = { ministerio: row.m, total_usd: 0, count: 0 };
        minMap[row.m].total_usd += row.u;
        minMap[row.m].count++;
    });

    const list = Object.values(minMap).sort((a, b) => b.total_usd - a.total_usd);
    const total = list.reduce((acc, x) => acc + x.total_usd, 0);

    return list.map(item => ({
        ...item,
        total_usd: Math.round(item.total_usd * 100) / 100,
        pct: total > 0 ? Math.round((item.total_usd / total) * 1000) / 10 : 0
    }));
}

/**
 * Calcula la serie temporal de inversión año a año por Ministerio
 */
function getTemporalMinistryAggregates() {
    const matrix = getFilteredSNIMatrix();
    const allYears = window.SNI_DATA ? window.SNI_DATA.filters.years : [];
    const activeYears = sniState.selectedYears.length > 0 ? sniState.selectedYears : allYears;
    const sortedYears = [...activeYears].sort((a, b) => a - b);

    const ministries = getMinistryAggregates().slice(0, 6).map(m => m.ministerio);
    if (!ministries.includes('Otros')) ministries.push('Otros');

    const yearData = {};
    sortedYears.forEach(y => {
        yearData[y] = { year: y, total: 0 };
        ministries.forEach(m => yearData[y][m] = 0);
    });

    matrix.forEach(row => {
        if (yearData[row.y]) {
            const mKey = ministries.includes(row.m) ? row.m : 'Otros';
            yearData[row.y][mKey] += row.u;
            yearData[row.y].total += row.u;
        }
    });

    return { years: sortedYears, ministries, yearData };
}

/**
 * Calcula los KPIs clave para las tarjetas superiores del dashboard
 */
function getSummaryKPIs() {
    const matrix = getFilteredSNIMatrix();
    const totalUsd = matrix.reduce((acc, r) => acc + r.u, 0);
    const activeYearsCount = sniState.selectedYears.length > 0 
        ? sniState.selectedYears.length 
        : (window.SNI_DATA ? window.SNI_DATA.filters.years.length : 15);
    const avgYearUsd = totalUsd / Math.max(activeYearsCount, 1);

    const minAgg = getMinistryAggregates();
    const topMin = minAgg.length > 0 ? minAgg[0] : { ministerio: 'N/A', pct: 0, total_usd: 0 };

    const regAgg = getRegionalAggregates().regions.filter(r => r.region !== '17_No Regionalizada');
    const topReg = regAgg.length > 0 
        ? [...regAgg].sort((a, b) => b.total_usd - a.total_usd)[0] 
        : { region: 'N/A', total_usd: 0, inv_pct: 0 };

    // Subtítulo 31 (Inversión directa) vs Subtítulo 33 (Transferencias / FNDR)
    let sub31 = 0;
    let sub33 = 0;
    matrix.forEach(r => {
        if (r.s === '31') sub31 += r.u;
        else if (r.s === '33') sub33 += r.u;
    });

    return {
        totalUsd: Math.round(totalUsd * 100) / 100,
        avgYearUsd: Math.round(avgYearUsd * 100) / 100,
        topMinisterio: topMin.ministerio,
        topMinisterioPct: topMin.pct,
        topMinisterioUsd: topMin.total_usd,
        topRegion: topReg.region,
        topRegionUsd: topReg.total_usd,
        topRegionPct: topReg.inv_pct,
        sub31Pct: totalUsd > 0 ? Math.round((sub31 / totalUsd) * 100) : 0,
        sub33Pct: totalUsd > 0 ? Math.round((sub33 / totalUsd) * 100) : 0,
        recordsCount: matrix.length
    };
}

