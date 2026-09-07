// ─── Filtros y Lógica de Datos Metro de Santiago ───────────────────────────────
var currentFilteredMetroProjects = [];

function metroNormalize(str) {
    return str
        ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        : '';
}

function metroFormatInvestment(valueMM, rawStr) {
    if (valueMM != null && !isNaN(valueMM) && valueMM !== '' && Number(valueMM) > 0) {
        const v = Number(valueMM);
        if (v >= 1000) return `US$ ${(v / 1000).toFixed(2)}B`;
        if (v >= 1) return `US$ ${v.toLocaleString('es-CL', { maximumFractionDigits: 0 })} MM`;
        return `US$ ${v.toFixed(1)} MM`;
    }
    const literal = rawStr || (typeof valueMM === 'string' && isNaN(valueMM) ? valueMM : null);
    if (literal && typeof literal === 'string') {
        const trimmed = literal.trim();
        if (trimmed !== '' && trimmed !== '—' && trimmed !== '-' && trimmed.toLowerCase() !== 'nan') {
            return trimmed;
        }
    }
    return '—';
}
window.metroFormatInvestment = metroFormatInvestment;

function metroFormatUSD(value) {
    return metroFormatInvestment(value);
}
window.metroFormatUSD = metroFormatUSD;

function metroLoadFilters() {
    // Los proyectos de Metro se muestran siempre completos sin filtros
}

function metroInitTableSorting() {
    const headers = document.querySelectorAll('#metro-table-container-view thead th.sortable');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.getAttribute('data-sort');
            if (!sortKey) return;

            if (metroState.sortBy === sortKey) {
                metroState.sortOrder = metroState.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                metroState.sortBy = sortKey;
                metroState.sortOrder = sortKey === 'investment_mm_usd' ? 'desc' : 'asc';
            }

            headers.forEach(h => {
                h.classList.remove('asc', 'desc');
            });
            th.classList.add(metroState.sortOrder);

            metroState.page = 1;
            metroFetchData();
        });
    });
}

function metroFetchData() {
    const allProjects = (window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : [];
    // Sin filtros: se preserva siempre la totalidad de proyectos de Metro
    let filtered = [...allProjects];

    // Ordenar (Inversión descendente por defecto)
    const sortBy = metroState.sortBy || 'investment_mm_usd';
    const sortOrder = metroState.sortOrder || 'desc';

    filtered.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        if (sortBy === 'investment_mm_usd' || sortBy === 'length_km' || sortBy === 'stations') {
            valA = valA != null && !isNaN(valA) ? Number(valA) : (sortOrder === 'asc' ? Infinity : -Infinity);
            valB = valB != null && !isNaN(valB) ? Number(valB) : (sortOrder === 'asc' ? Infinity : -Infinity);
            return sortOrder === 'asc' ? valA - valB : valB - valA;
        } else {
            valA = valA != null ? String(valA).trim() : '';
            valB = valB != null ? String(valB).trim() : '';
            return sortOrder === 'asc'
                ? valA.localeCompare(valB, 'es', { sensitivity: 'base', numeric: true })
                : valB.localeCompare(valA, 'es', { sensitivity: 'base', numeric: true });
        }
    });

    currentFilteredMetroProjects = filtered;

    // Paginación
    const total = filtered.length;
    const pageSize = metroState.pageSize || 50;
    const totalPages = Math.ceil(total / pageSize) || 1;
    if (metroState.page > totalPages) metroState.page = totalPages;
    if (metroState.page < 1) metroState.page = 1;

    const start = (metroState.page - 1) * pageSize;
    const pageSlice = filtered.slice(start, start + pageSize);

    // Actualizar KPIs superiores del panel derecho
    if (metroState.tableMode === 'projects' || !metroState.tableMode) {
        const kpiVal1 = document.getElementById('metro-kpi-val-1');
        const kpiVal2 = document.getElementById('metro-kpi-val-2');
        if (kpiVal1) kpiVal1.textContent = total > 0 ? String(total) : '—';
        if (kpiVal2) {
            const sumInv = filtered.reduce((acc, p) => acc + (Number(p.investment_mm_usd) || 0), 0);
            kpiVal2.textContent = sumInv > 0 ? metroFormatInvestment(sumInv) : '—';
        }
    }

    if (typeof metroUpdateDynamicLabels === 'function') {
        metroUpdateDynamicLabels();
    }

    // Renderizar Componentes
    if (typeof metroRenderTable === 'function') {
        metroRenderTable(pageSlice);
    }
    if (typeof metroUpdatePagination === 'function') {
        metroUpdatePagination(total, start, pageSlice.length);
    }
    if (typeof metroRenderProjectMarkers === 'function') {
        metroRenderProjectMarkers(filtered);
    }
    if (typeof metroUpdateMapStyles === 'function') {
        metroUpdateMapStyles(filtered);
    }
    if (metroState.timelineOpen && typeof renderMetroTimeline === 'function') {
        renderMetroTimeline(filtered);
    }
}

function metroGetFilteredProjects() {
    return currentFilteredMetroProjects;
}
