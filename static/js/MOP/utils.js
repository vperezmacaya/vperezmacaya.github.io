// Helpers de formato, color y agregación específicos de MOP

function getServiceColor(servicioName, idx) {
    if (MOP_SERVICE_MAP[servicioName]) {
        return MOP_SERVICE_MAP[servicioName];
    }
    return DISTINCT_PALETTE[idx % DISTINCT_PALETTE.length];
}

function shortServiceName(name) {
    return name
        .replace('Dirección de ', '')
        .replace('Subdirección de ', '')
        .replace('Servicios Sanitarios Rurales', 'SSR')
        .trim();
}

function formatMM(val) {
    if (!val || val === 0) return '$0M';
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1).replace(/\.0$/, '')}B`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1).replace(/\.0$/, '')}kM`;
    return `$${Number(val).toLocaleString('es-CL')}M`;
}

function shortRegion(name) {
    return CatlecUtils.shortenRegionName(name);
}

// ── Detección de tema oscuro y estilos idénticos a index.html ─────────────
function isDark() {
    return document.body.classList.contains('dark-theme');
}
function gridColor() { return isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; }
function labelColor() { return isDark() ? '#94a3b8' : '#374151'; }
function titleColor() { return isDark() ? '#cbd5e1' : '#334155'; }

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getStageBadgeClass(etapa) {
    if (!etapa) return 'badge-neutral';
    const e = etapa.toUpperCase();
    if (e.includes('EJECUCION') || e.includes('EJECUCIÓN')) return 'badge-info';
    if (e.includes('DISEÑO') || e.includes('DISENO')) return 'badge-warning';
    if (e.includes('LICITAC')) return 'badge-licitacion';
    if (e.includes('OPERACION') || e.includes('OPERACIÓN') || e.includes('TERMINADO')) return 'badge-success';
    return 'badge-neutral';
}

// ── Agregaciones sobre datos filtrados ────────────────────────────────────
function aggregateBy(key, valueKey) {
    const map = {};
    filteredProjects.forEach(p => {
        const k = p[key];
        if (!k) return;
        if (!map[k]) map[k] = { count: 0, total: 0 };
        map[k].count++;
        map[k].total += (p[valueKey] || 0);
    });
    return Object.entries(map).map(([k, v]) => ({ label: k, count: v.count, total: v.total }));
}
