/**
 * static/js/MOP/charts.js
 * Lógica principal del dashboard MOP.
 * Requiere: Chart.js, window.MOP_DATA (mop_data.js)
 */

(function () {
    'use strict';

    // ── Paletas de colores institucionales para servicios MOP ─────────────────
    const MOP_SERVICE_MAP = {
        'Dirección de Vialidad': '#2563eb',                    // Azul Real
        'Dirección de Obras Portuarias': '#0d9488',            // Verde azulado / Teal
        'Subdirección de Servicios Sanitarios Rurales': '#10b981', // Verde Esmeralda
        'Dirección de Aeropuertos': '#f59e0b',                 // Ámbar / Amarillo
        'Dirección de Obras Hidráulicas': '#8b5cf6',           // Violeta / Púrpura
        'Dirección de Arquitectura': '#f43f5e',                // Coral / Rosa
    };

    const DISTINCT_PALETTE = [
        '#2563eb', '#0d9488', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#ea580c'
    ];

    function getServiceColor(servicioName, idx) {
        if (MOP_SERVICE_MAP[servicioName]) {
            return MOP_SERVICE_MAP[servicioName];
        }
        return DISTINCT_PALETTE[idx % DISTINCT_PALETTE.length];
    }

    const PALETTE_BLUE = [
        '#3b82f6','#0ea5e9','#6366f1','#8b5cf6','#06b6d4',
        '#0284c7','#14b8a6','#f59e0b','#10b981','#ef4444',
    ];
    const PALETTE_ORANGE = [
        '#f97316','#fb923c','#fbbf24','#ef4444','#ec4899',
        '#a855f7','#0ea5e9','#22d3ee','#84cc16','#14b8a6',
    ];

    // ── Helpers ───────────────────────────────────────────────────────────────
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
        return name
            .replace('Aysén del General Carlos Ibáñez del Campo', 'Aysén')
            .replace('Magallanes y de la Antártica Chilena', 'Magallanes')
            .replace("Libertador General Bernardo O'Higgins", "O'Higgins")
            .replace('Metropolitana de Santiago', 'Metropolitana');
    }

    // ── Detección de tema oscuro y estilos idénticos a index.html ─────────────
    function isDark() {
        return document.body.classList.contains('dark-theme');
    }
    function gridColor() { return isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; }
    function labelColor() { return isDark() ? '#94a3b8' : '#374151'; }
    function titleColor() { return isDark() ? '#cbd5e1' : '#334155'; }

    // Plugin para dibujar la línea vertical de "Hoy" en los histogramas temporales (idéntico a index.html)
    const todayLineChartPlugin = {
        id: 'todayLineChartPlugin',
        afterDraw: (chart) => {
            const currentYear = new Date().getFullYear();
            const labels = chart.data.labels || [];
            const index = labels.indexOf(currentYear);
            if (index !== -1) {
                const xAxis = chart.scales.x;
                const yAxis = chart.scales.y;
                const x = xAxis.getPixelForValue(index);
                const ctx = chart.ctx;

                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([4, 3]);
                ctx.lineWidth = 1.8;
                ctx.strokeStyle = '#ef4444';
                ctx.moveTo(x, yAxis.top);
                ctx.lineTo(x, yAxis.bottom);
                ctx.stroke();

                // Etiqueta "Hoy" en la parte superior
                ctx.fillStyle = '#ef4444';
                ctx.font = 'bold 8.5px Inter, system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`Hoy (${currentYear})`, x, Math.max(10, yAxis.top - 3));
                ctx.restore();
            }
        }
    };

    // Plugin para dibujar etiquetas de valor en barras horizontales (idéntico a index.html)
    const horizontalBarDataLabelsPlugin = {
        id: 'horizontalBarDataLabelsPlugin',
        afterDatasetsDraw: (chart, args, pluginOptions) => {
            const ctx = chart.ctx;
            const meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data) return;

            const isDarkTheme = isDark();
            const outsideColor = isDarkTheme ? '#cbd5e1' : '#334155';
            const insideColor = '#ffffff';
            const formatter = (pluginOptions && pluginOptions.formatter) || ((v) => String(v));

            ctx.save();
            ctx.font = '600 9px Inter, system-ui, -apple-system, sans-serif';
            ctx.textBaseline = 'middle';

            meta.data.forEach((bar, index) => {
                const rawVal = chart.data.datasets[0].data[index];
                if (rawVal === undefined || rawVal === null || rawVal <= 0) return;

                const text = formatter(rawVal);
                const textWidth = ctx.measureText(text).width;
                const barWidth = Math.abs(bar.x - bar.base);

                if (barWidth >= textWidth + 18) {
                    ctx.fillStyle = insideColor;
                    ctx.textAlign = 'right';
                    ctx.fillText(text, bar.x - 6, bar.y);
                } else {
                    ctx.fillStyle = outsideColor;
                    ctx.textAlign = 'left';
                    ctx.fillText(text, bar.x + 5, bar.y);
                }
            });

            ctx.restore();
        }
    };

    // ── Chart.js defaults (exactos a index.html) ───────────────────────────────
    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.font.size   = 10.5;
    Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.padding  = 10;
    Chart.defaults.plugins.tooltip.enabled = false;
    Chart.defaults.plugins.tooltip.external = mopExternalTooltip;

    // ── Global Filter State ───────────────────────────────────────────────────
    let charts = {};
    let selectedRegions   = []; // empty = all
    let selectedServicios = []; // empty = all
    let selectedEtapas    = []; // empty = all
    let filteredProjects  = [];

    // ── Inicialización ────────────────────────────────────────────────────────
    function init() {
        if (!window.MOP_DATA) {
            console.error('[MOP] window.MOP_DATA no cargado.');
            return;
        }

        populateFilters();
        applyFilters();
        bindFilterEvents();
        bindTableSortEvents();
        bindTabEvents();

        window.addEventListener('resize', () => {
            Object.values(charts).forEach(ch => {
                if (ch && typeof ch.resize === 'function') ch.resize();
            });
        });

        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                setTimeout(renderAllCharts, 120);
            });
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ── Filtros ───────────────────────────────────────────────────────────────
    function populateFilters() {
        const { filters } = window.MOP_DATA;

        populateMultiselect('mop-region-options-list',   filters.regions,   'mop-region-cb',   updateSelectedRegions);
        populateMultiselect('mop-servicio-options-list', filters.servicios, 'mop-servicio-cb', updateSelectedServicios);
        populateMultiselect('mop-etapa-options-list',    filters.etapas,    'mop-etapa-cb',    updateSelectedEtapas);
    }

    function populateMultiselect(listId, items, cbClass, onChangeFn) {
        const container = document.getElementById(listId);
        if (!container) return;
        container.innerHTML = '';
        (items || []).filter(Boolean).forEach(val => {
            const label = document.createElement('label');
            label.className = 'multiselect-option';
            const displayText = (val.includes('Servicios Sanitarios Rurales') && !val.includes('(SSR)'))
                ? `${val} (SSR)`
                : val;
            label.innerHTML = `
                <input type="checkbox" class="${cbClass}" value="${val}">
                <span>${displayText}</span>
            `;
            container.appendChild(label);
        });

        container.querySelectorAll(`.${cbClass}`).forEach(cb => {
            cb.addEventListener('change', onChangeFn);
        });
    }

    function bindFilterEvents() {
        const searchInput = document.getElementById('mop-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', applyFilters);
        }

        // Toggle dropdowns
        bindDropdownToggle('mop-region-multiselect-btn', 'mop-region-multiselect-dropdown');
        bindDropdownToggle('mop-servicio-multiselect-btn', 'mop-servicio-multiselect-dropdown');
        bindDropdownToggle('mop-etapa-multiselect-btn', 'mop-etapa-multiselect-dropdown');

        // Check All actions
        bindCheckAll('mop-region-check-all', '.mop-region-cb', updateSelectedRegions);
        bindCheckAll('mop-servicio-check-all', '.mop-servicio-cb', updateSelectedServicios);
        bindCheckAll('mop-etapa-check-all', '.mop-etapa-cb', updateSelectedEtapas);

        // Click outside closes dropdowns
        document.addEventListener('click', () => {
            closeAllMultiselects();
        });

        // Reset button
        const resetBtn = document.getElementById('mop-btn-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetFilters);
        }

        // Export to Excel button
        const exportBtn = document.getElementById('mop-btn-export-excel');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportMOPToExcel);
        }
    }

    function bindDropdownToggle(btnId, dropdownId) {
        const btn = document.getElementById(btnId);
        const dropdown = document.getElementById(dropdownId);
        if (!btn || !dropdown) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.style.display === 'flex';
            closeAllMultiselects();
            dropdown.style.display = isOpen ? 'none' : 'flex';
        });

        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    function closeAllMultiselects() {
        document.querySelectorAll('.multiselect-dropdown').forEach(dd => {
            dd.style.display = 'none';
        });
    }

    function bindCheckAll(checkAllId, cbSelector, updateFn) {
        const checkAll = document.getElementById(checkAllId);
        if (!checkAll) return;
        checkAll.addEventListener('change', () => {
            const isChecked = checkAll.checked;
            document.querySelectorAll(cbSelector).forEach(cb => {
                cb.checked = isChecked;
            });
            updateFn();
        });
    }

    function updateSelectedRegions() {
        const checked = Array.from(document.querySelectorAll('.mop-region-cb:checked')).map(c => c.value);
        selectedRegions = checked;
        const total = window.MOP_DATA?.filters?.regions?.length || 0;
        const count = checked.length;

        const checkAll = document.getElementById('mop-region-check-all');
        if (checkAll) checkAll.checked = (count === total && total > 0);

        const textEl = document.getElementById('mop-region-multiselect-text');
        if (textEl) {
            if (count === 0 || count === total) textEl.textContent = 'Todas las regiones';
            else if (count === 1) textEl.textContent = checked[0];
            else textEl.textContent = `${count} regiones seleccionadas`;
        }

        applyFilters();
    }

    function updateSelectedServicios() {
        const checked = Array.from(document.querySelectorAll('.mop-servicio-cb:checked')).map(c => c.value);
        selectedServicios = checked;
        const total = window.MOP_DATA?.filters?.servicios?.length || 0;
        const count = checked.length;

        const checkAll = document.getElementById('mop-servicio-check-all');
        if (checkAll) checkAll.checked = (count === total && total > 0);

        const textEl = document.getElementById('mop-servicio-multiselect-text');
        if (textEl) {
            if (count === 0 || count === total) textEl.textContent = 'Todos los servicios';
            else if (count === 1) textEl.textContent = shortServiceName(checked[0]);
            else textEl.textContent = `${count} servicios seleccionados`;
        }

        applyFilters();
    }

    function updateSelectedEtapas() {
        const checked = Array.from(document.querySelectorAll('.mop-etapa-cb:checked')).map(c => c.value);
        selectedEtapas = checked;
        const total = window.MOP_DATA?.filters?.etapas?.length || 0;
        const count = checked.length;

        const checkAll = document.getElementById('mop-etapa-check-all');
        if (checkAll) checkAll.checked = (count === total && total > 0);

        const textEl = document.getElementById('mop-etapa-multiselect-text');
        if (textEl) {
            if (count === 0 || count === total) textEl.textContent = 'Todas las etapas';
            else if (count === 1) textEl.textContent = checked[0];
            else textEl.textContent = `${count} etapas seleccionadas`;
        }

        applyFilters();
    }

    function resetFilters() {
        const searchInput = document.getElementById('mop-search-input');
        if (searchInput) searchInput.value = '';

        document.querySelectorAll('.mop-region-cb, .mop-servicio-cb, .mop-etapa-cb, #mop-region-check-all, #mop-servicio-check-all, #mop-etapa-check-all').forEach(cb => {
            cb.checked = false;
        });

        selectedRegions = [];
        selectedServicios = [];
        selectedEtapas = [];

        const regionText = document.getElementById('mop-region-multiselect-text');
        if (regionText) regionText.textContent = 'Todas las regiones';

        const servicioText = document.getElementById('mop-servicio-multiselect-text');
        if (servicioText) servicioText.textContent = 'Todos los servicios';

        const etapaText = document.getElementById('mop-etapa-multiselect-text');
        if (etapaText) etapaText.textContent = 'Todas las etapas';

        closeAllMultiselects();

        // Restablecer ordenación de la tabla al orden original por defecto (descendente por costo total)
        sortColumn = 'cost_mm';
        sortDirection = 'desc';
        tableCurrentPage = 1;

        // Restablecer indicadores visuales de ordenación en las cabeceras
        document.querySelectorAll('.mop-data-table .mop-sortable, .mop-global-table .sort-th').forEach(t => {
            t.classList.remove('active-sort');
            const icon = t.querySelector('.mop-sort-icon');
            if (icon) icon.textContent = '⇅';
        });
        const defaultSortTh = document.querySelector('.mop-data-table [data-sort="cost_mm"], .mop-global-table [data-sort="cost_mm"]');
        if (defaultSortTh) {
            defaultSortTh.classList.add('active-sort');
            const defaultIcon = defaultSortTh.querySelector('.mop-sort-icon');
            if (defaultIcon) defaultIcon.textContent = '↓';
        }

        applyFilters();
    }

    function applyFilters() {
        if (typeof hideProjectDetail === 'function') hideProjectDetail();
        const query = (document.getElementById('mop-search-input')?.value || '').toLowerCase().trim();

        filteredProjects = window.MOP_DATA.projects.filter(p => {
            if (selectedRegions.length > 0 && !selectedRegions.includes(p.region)) return false;
            if (selectedServicios.length > 0 && !selectedServicios.includes(p.servicio)) return false;
            if (selectedEtapas.length > 0 && !selectedEtapas.includes(p.etapa)) return false;
            if (query && !p.nombre.toLowerCase().includes(query) && !p.bip.toLowerCase().includes(query)) return false;
            return true;
        });

        updateKPIs();
        renderAllCharts();
        updateProjectCount(filteredProjects.length);
    }

    function updateProjectCount(count) {
        const el = document.getElementById('mop-project-count');
        if (el) el.textContent = `${count} Proyectos`;
    }

    // ── KPIs ──────────────────────────────────────────────────────────────────
    function updateKPIs() {
        const p = filteredProjects;
        const totalCost = p.reduce((s, r) => s + (r.cost_mm || 0), 0);
        const enEjec    = p.filter(r => r.etapa === 'EJECUCION').length;

        // Top servicio from filtered
        const srvCount = {};
        p.forEach(r => { if (r.servicio) srvCount[r.servicio] = (srvCount[r.servicio] || 0) + 1; });
        const topSrv = Object.entries(srvCount).sort((a,b) => b[1]-a[1])[0];

        setKPI('kpi-total-cost',    formatMM(totalCost), 'Millones CLP (inversión total)');
        setKPI('kpi-total-projects', p.length,           'Iniciativas en cartera');
        setKPI('kpi-top-servicio',  topSrv ? topSrv[0] : '—',
               topSrv ? `${topSrv[1]} proyectos` : '');
        setKPI('kpi-en-ejecucion',  enEjec, `${p.length > 0 ? ((enEjec/p.length)*100).toFixed(1) : 0}% del total filtrado`);
    }

    function setKPI(id, val, sub) {
        const card = document.getElementById(id);
        if (!card) return;
        const valEl = card.querySelector('.kpi-value') || card.querySelector('.kpi-val');
        const subEl = card.querySelector('.kpi-sub');
        if (valEl) valEl.textContent = val;
        if (subEl) subEl.textContent = sub;
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

    // ── Global Table State & Functions ────────────────────────────────────────
    let tableCurrentPage = 1;
    const TABLE_PAGE_SIZE = 25;
    let sortColumn = 'cost_mm';
    let sortDirection = 'desc';

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatRegionCell(regionStr) {
        if (!regionStr || String(regionStr).trim() === '' || String(regionStr).trim() === 'N/A' || String(regionStr).trim() === '—') {
            return '<span style="color:var(--text-muted);font-style:italic">Sin región</span>';
        }
        const str = String(regionStr).trim();
        if (str.toLowerCase().includes('nacional') || str.toLowerCase().includes('interregional')) {
            return '<span class="region-pill">Nacional</span>';
        }

        const parts = str.split(/[;,/\n]+/).map(p => shortRegion(p.trim())).filter(p => p.length > 0);
        if (parts.length > 1) {
            return `<div class="region-pills-wrap">${parts.map(p => `<span class="region-pill">${p}</span>`).join('')}</div>`;
        }

        return `<span>${shortRegion(str)}</span>`;
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

    function getSortedProjects() {
        return [...filteredProjects].sort((a, b) => {
            let valA = a[sortColumn];
            let valB = b[sortColumn];

            if (valA === null || valA === undefined || valA === '') valA = (sortDirection === 'desc' ? -Infinity : Infinity);
            if (valB === null || valB === undefined || valB === '') valB = (sortDirection === 'desc' ? -Infinity : Infinity);

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function renderGlobalTable() {
        const tbody = document.getElementById('mop-global-table-tbody');
        const pageInfoEl = document.getElementById('mop-pagination-info');
        const prevBtn = document.getElementById('mop-btn-prev');
        const nextBtn = document.getElementById('mop-btn-next');
        const emptyState = document.getElementById('mop-empty-state');

        if (!tbody) return;

        const sorted = getSortedProjects();
        const totalRecords = sorted.length;
        const totalPages = Math.ceil(totalRecords / TABLE_PAGE_SIZE) || 1;

        if (tableCurrentPage > totalPages) tableCurrentPage = totalPages;
        if (tableCurrentPage < 1) tableCurrentPage = 1;

        const startIndex = (tableCurrentPage - 1) * TABLE_PAGE_SIZE;
        const pageProjects = sorted.slice(startIndex, startIndex + TABLE_PAGE_SIZE);

        if (pageInfoEl) {
            if (totalRecords === 0) {
                pageInfoEl.textContent = '0-0 de 0';
            } else {
                const startRecord = startIndex + 1;
                const endRecord = Math.min(startIndex + TABLE_PAGE_SIZE, totalRecords);
                pageInfoEl.textContent = `${startRecord}-${endRecord} de ${totalRecords.toLocaleString('es-CL')}`;
            }
        }

        if (prevBtn) prevBtn.disabled = (tableCurrentPage <= 1);
        if (nextBtn) nextBtn.disabled = (tableCurrentPage >= totalPages || totalRecords === 0);

        if (pageProjects.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }
        if (emptyState) emptyState.style.display = 'none';

        tbody.innerHTML = pageProjects.map((p, idx) => {
            const rowNum = startIndex + idx + 1;
            const costFmt = p.cost_mm > 0 ? `$${p.cost_mm.toLocaleString('es-CL')} M` : '—';
            const bipFmt = p.bip || '—';
            const yearFmt = p.year || '—';
            const yearUltFmt = p.year_ult || '—';
            const badgeClass = getStageBadgeClass(p.etapa);

            return `
                <tr class="row-main mop-project-row" data-idx="${idx}" style="cursor: pointer;">
                    <td style="text-align: center; color: var(--text-muted);">${rowNum}</td>
                    <td><strong>${escapeHtml(p.nombre) || 'Sin nombre'}</strong></td>
                    <td>${bipFmt}</td>
                    <td>${formatRegionCell(p.region)}</td>
                    <td>${escapeHtml(p.servicio) || '—'}</td>
                    <td>${escapeHtml(p.programa) || '—'}</td>
                    <td><span class="badge ${badgeClass}">${escapeHtml(p.etapa) || '—'}</span></td>
                    <td style="text-align: right; font-weight: 700; color: #3b82f6;">${costFmt}</td>
                    <td style="text-align: center; color: var(--text-muted);">${yearFmt}</td>
                    <td style="text-align: center; color: var(--text-muted);">${yearUltFmt}</td>
                </tr>
            `;
        }).join('');

        // Bind click event on rows to open project detail
        tbody.querySelectorAll('.mop-project-row').forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt(row.dataset.idx, 10);
                const proj = pageProjects[idx];
                if (proj) showProjectDetail(proj, startIndex + idx);
            });
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ── Ficha Detallada del Proyecto (Reemplazo de la Tabla - Idéntica a index.html) ──
    function updateDetailNavButtons(index, list) {
        const btnDetailPrev = document.getElementById('mop-btn-detail-prev');
        const btnDetailNext = document.getElementById('mop-btn-detail-next');

        if (!btnDetailPrev || !btnDetailNext) return;

        if (index > 0) {
            btnDetailPrev.disabled = false;
            btnDetailPrev.style.opacity = '1';
            btnDetailPrev.style.cursor = 'pointer';
            btnDetailPrev.style.pointerEvents = 'auto';
            btnDetailPrev.onclick = (e) => {
                e.stopPropagation();
                showProjectDetail(list[index - 1], index - 1);
            };
        } else {
            btnDetailPrev.disabled = true;
            btnDetailPrev.style.opacity = '0.35';
            btnDetailPrev.style.cursor = 'not-allowed';
            btnDetailPrev.style.pointerEvents = 'none';
            btnDetailPrev.onclick = null;
        }

        if (index >= 0 && index < list.length - 1) {
            btnDetailNext.disabled = false;
            btnDetailNext.style.opacity = '1';
            btnDetailNext.style.cursor = 'pointer';
            btnDetailNext.style.pointerEvents = 'auto';
            btnDetailNext.onclick = (e) => {
                e.stopPropagation();
                showProjectDetail(list[index + 1], index + 1);
            };
        } else {
            btnDetailNext.disabled = true;
            btnDetailNext.style.opacity = '0.35';
            btnDetailNext.style.cursor = 'not-allowed';
            btnDetailNext.style.pointerEvents = 'none';
            btnDetailNext.onclick = null;
        }
    }

    function showProjectDetail(p, globalIndex) {
        const tableView = document.getElementById('mop-table-container-view');
        const detailView = document.getElementById('mop-project-detail-view');
        const detailBody = document.getElementById('mop-detail-view-body');
        if (!tableView || !detailView || !detailBody || !p) return;

        tableView.style.display = 'none';
        detailView.style.display = 'flex';
        detailView.scrollTop = 0;
        detailBody.scrollTop = 0;

        const sorted = getSortedProjects();
        const index = typeof globalIndex === 'number' ? globalIndex : sorted.indexOf(p);
        updateDetailNavButtons(index, sorted);

        const costFmt = p.cost_mm > 0 ? `$${p.cost_mm.toLocaleString('es-CL')} MM CLP` : 'No informado';
        const hasDesc = p.descripcion && p.descripcion.trim().length > 0;
        const descText = hasDesc ? escapeHtml(p.descripcion) : 'No se registra descripción en la base de datos.';
        const hasLoc = p.localizacion && p.localizacion.trim().length > 0 && p.localizacion.trim() !== '—';
        const locText = hasLoc ? escapeHtml(p.localizacion) : 'No informada';
        const badgeClass = getStageBadgeClass(p.etapa);
        const titleName = escapeHtml(p.nombre) || 'Iniciativa MOP';

        detailBody.innerHTML = `
            <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.1rem;">
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
                    <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); line-height: 1.35; font-family: var(--font-heading); flex: 1; min-width: 0;">${titleName}</h3>
                    <span class="badge ${badgeClass}" style="flex-shrink: 0; font-size: 0.7rem; padding: 0.2rem 0.5rem; white-space: nowrap; margin-top: 2px;">${escapeHtml(p.etapa) || 'Sin etapa'}</span>
                </div>
                <div style="font-size: 0.75rem; color: #0d9488; font-weight: 600; margin-top: 0.25rem;">${escapeHtml(p.servicio) || 'Servicio MOP'}</div>
            </div>

            <!-- Sección Descripción -->
            <div class="detail-section" style="margin-top: 0.4rem;">
                <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.35rem;">Descripción</h4>
                <p class="detail-desc" style="font-size: 0.76rem; line-height: 1.45;">${descText}</p>
            </div>

            <!-- Datos de la Iniciativa (Detail Grid exacto a index.html) -->
            <div class="detail-section" style="margin-top: 0.4rem;">
                <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.4rem;">Datos de la Iniciativa</h4>
                <div class="detail-grid" style="grid-template-columns: 130px 1fr; gap: 0.35rem; font-size: 0.74rem;">
                    <span class="detail-label">Código BIP:</span>
                    <span class="detail-value" style="font-family: var(--font-mono, monospace); font-weight: 600;">${escapeHtml(p.bip || 'No informado')}</span>

                    <span class="detail-label">Servicio MOP:</span>
                    <span class="detail-value">${escapeHtml(p.servicio || 'No especificado')}</span>

                    <span class="detail-label">Programa:</span>
                    <span class="detail-value">${escapeHtml(p.programa || 'No especificado')}</span>

                    <span class="detail-label">Región:</span>
                    <span class="detail-value">${formatRegionCell(p.region)}</span>

                    <span class="detail-label">Comuna / Localización:</span>
                    <span class="detail-value">${locText}</span>

                    <span class="detail-label">Etapa Ciclo de Vida:</span>
                    <span class="detail-value"><span class="badge ${badgeClass}">${escapeHtml(p.etapa || 'No informada')}</span></span>

                    <span class="detail-label">Costo Total Estimado:</span>
                    <span class="detail-value" style="font-weight: 700; color: #3b82f6;">${costFmt}</span>

                    <span class="detail-label">Año Primera Postulación:</span>
                    <span class="detail-value">${p.year || 'No informado'}</span>

                    <span class="detail-label">Año Última Postulación:</span>
                    <span class="detail-value">${p.year_ult || 'No informado'}</span>
                </div>
            </div>
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons();

        const backBtn = document.getElementById('mop-btn-back-to-list');
        if (backBtn) {
            backBtn.onclick = hideProjectDetail;
        }
    }

    function hideProjectDetail() {
        const tableView = document.getElementById('mop-table-container-view');
        const detailView = document.getElementById('mop-project-detail-view');
        if (tableView && detailView) {
            detailView.style.display = 'none';
            tableView.style.display = 'flex';
        }
    }

    function bindTableSortEvents() {
        document.querySelectorAll('.data-table.mop-data-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (!col) return;
                if (sortColumn === col) {
                    sortDirection = (sortDirection === 'asc' ? 'desc' : 'asc');
                } else {
                    sortColumn = col;
                    sortDirection = (col === 'cost_mm' ? 'desc' : 'asc');
                }

                // Reset all sort headers
                document.querySelectorAll('.data-table.mop-data-table th.sortable').forEach(t => {
                    t.classList.remove('asc', 'desc', 'active-sort');
                });

                // Activate current header
                th.classList.add(sortDirection, 'active-sort');

                tableCurrentPage = 1;
                renderGlobalTable();
            });
        });

        const prevBtn = document.getElementById('mop-btn-prev');
        const nextBtn = document.getElementById('mop-btn-next');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (tableCurrentPage > 1) {
                    tableCurrentPage--;
                    renderGlobalTable();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(filteredProjects.length / TABLE_PAGE_SIZE) || 1;
                if (tableCurrentPage < totalPages) {
                    tableCurrentPage++;
                    renderGlobalTable();
                }
            });
        }
    }

    // ── External Tooltip (Dark Floating Box aligned with EFE.html) ───────────
    function mopExternalTooltip(context) {
        const { chart, tooltip } = context;
        const tooltipId = 'mop-analysis-tooltip';
        let el = document.getElementById(tooltipId);
        if (!el) {
            el = document.createElement('div');
            el.id = tooltipId;
            el.style.cssText = [
                'position:fixed',
                'background:rgba(0,0,0,0.85)',
                'color:#fff',
                'border-radius:4px',
                'padding:6px 9px',
                'font:11.5px/1.4 system-ui,-apple-system,sans-serif',
                'pointer-events:none',
                'white-space:nowrap',
                'z-index:9999',
                'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
                'opacity:0'
            ].join(';');
            document.body.appendChild(el);
        }

        if (tooltip.opacity === 0) {
            el.style.transition = 'opacity 0.2s ease-in';
            el.style.opacity = '0';
            return;
        }

        const wasVisible = parseFloat(el.style.opacity || '0') > 0.05;
        const title = (tooltip.title || []).join('\n');
        const bodyLines = (tooltip.body || []).flatMap(b => b.lines);

        el.innerHTML = [
            title ? `<div style="font-weight:700;margin-bottom:2px">${title}</div>` : '',
            ...bodyLines.map(line => `<div>${line}</div>`)
        ].join('');

        const canvasRect = chart.canvas.getBoundingClientRect();
        let left = canvasRect.left + tooltip.caretX + 10;
        let top = canvasRect.top + tooltip.caretY - 10;

        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && left + rect.width > window.innerWidth - 8) {
            left = canvasRect.left + tooltip.caretX - rect.width - 10;
        }

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

    // ── Global Filter State ───────────────────────────────────────────────────
    let currentActiveTab  = 'resumen';

    function clearEmpty(canvas) {
        if (!canvas || !canvas.parentElement) return;
        canvas.parentElement.querySelectorAll('.mop-empty-placeholder').forEach(el => el.remove());
    }

    function showEmpty(canvas) {
        if (!canvas || !canvas.parentElement) return;
        clearEmpty(canvas);
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        const p = document.createElement('p');
        p.className = 'mop-empty-placeholder';
        p.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.75rem;pointer-events:none;margin:0;';
        p.textContent = 'Sin datos para los filtros aplicados';
        canvas.parentElement.appendChild(p);
    }

    // ── Render de todos los gráficos ──────────────────────────────────────────
    function renderAllCharts() {
        // Donut charts en panel izquierdo (siempre visibles)
        renderServicioDonut();
        renderServicioCostDonut();

        // Gráficos y tablas según la pestaña activa
        if (currentActiveTab === 'resumen') {
            renderTopTable();
            renderGlobalTable();
        } else if (currentActiveTab === 'inversion') {
            renderRegionBar();
            renderServicioInversionBar();
            renderProgramaInversionBar();
        } else if (currentActiveTab === 'programas') {
            renderEtapaBar();
            renderRegionCountBar();
            renderYearLine();
        }
    }

    function destroyChart(id) {
        if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    }

    // ── 1. Donut: Distribución por Servicio (Nº Proyectos) ────────────────────
    function renderServicioDonut() {
        const canvas = document.getElementById('chart-servicio');
        if (!canvas) return;
        clearEmpty(canvas);

        const data = aggregateBy('servicio', 'cost_mm').sort((a,b) => b.count - a.count);
        if (!data.length) {
            destroyChart('servicio');
            showEmpty(canvas);
            return;
        }

        const totalProjects = data.reduce((sum, d) => sum + d.count, 0);
        const labels = data.map(d => shortServiceName(d.label));
        const values = data.map(d => d.count);
        const colors = data.map(d => getServiceColor(d.label));

        if (charts.servicio) {
            charts.servicio.data.labels = labels;
            charts.servicio.data.datasets[0].data = values;
            charts.servicio.data.datasets[0].backgroundColor = colors;
            charts.servicio.data.datasets[0].borderColor = isDark() ? '#0f1626' : '#ffffff';
            delete charts.servicio.options.onClick;
            charts.servicio.update();
        } else {
            charts.servicio = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data:            values,
                        backgroundColor: colors,
                        borderWidth:     1.5,
                        borderColor:     isDark() ? '#0f1626' : '#ffffff',
                        hoverOffset:     4,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '68%',
                    animation: { duration: 450, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: mopExternalTooltip,
                            callbacks: {
                                title: items => items.length ? items[0].label : '',
                                label: ctx => ` ${ctx.raw} proyectos (${((ctx.raw / (totalProjects || 1)) * 100).toFixed(1)}%)`
                            }
                        }
                    }
                }
            });
        }

        // Render custom HTML legend
        const legendEl = document.getElementById('mopServicioChartLegend');
        if (legendEl) {
            legendEl.innerHTML = data.map((d, idx) => {
                const count = d.count;
                const pct = totalProjects > 0 ? ((count / totalProjects) * 100).toFixed(1).replace(/\.0$/, '') : '0';
                const col = colors[idx];
                const sName = shortServiceName(d.label);
                return `
                    <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.69rem; padding:0.1rem 0; color:var(--text-primary);">
                        <div style="display:flex; align-items:center; gap:0.35rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                            <span style="color:var(--text-primary); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sName}</span>
                        </div>
                        <span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                            ${pct}%
                        </span>
                    </div>
                `;
            }).join('');
        }
    }

    // ── 1b. Donut: Costo Total por Servicio (Inversión MM CLP) ────────────────
    function renderServicioCostDonut() {
        const canvas = document.getElementById('chart-servicio-cost');
        if (!canvas) return;
        clearEmpty(canvas);

        const data = aggregateBy('servicio', 'cost_mm').sort((a,b) => b.total - a.total);
        if (!data.length) {
            destroyChart('servicioCost');
            showEmpty(canvas);
            return;
        }

        const totalCost = data.reduce((sum, d) => sum + d.total, 0);
        const labels = data.map(d => shortServiceName(d.label));
        const values = data.map(d => +d.total.toFixed(1));
        const colors = data.map(d => getServiceColor(d.label));

        if (charts.servicioCost) {
            charts.servicioCost.data.labels = labels;
            charts.servicioCost.data.datasets[0].data = values;
            charts.servicioCost.data.datasets[0].backgroundColor = colors;
            charts.servicioCost.data.datasets[0].borderColor = isDark() ? '#0f1626' : '#ffffff';
            delete charts.servicioCost.options.onClick;
            charts.servicioCost.update();
        } else {
            charts.servicioCost = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data:            values,
                        backgroundColor: colors,
                        borderWidth:     1.5,
                        borderColor:     isDark() ? '#0f1626' : '#ffffff',
                        hoverOffset:     4,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '68%',
                    animation: { duration: 450, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: mopExternalTooltip,
                            callbacks: {
                                title: items => items.length ? items[0].label : '',
                                label: ctx => ` Inversión: $${formatMM(ctx.raw)} MM CLP (${((ctx.raw / (totalCost || 1)) * 100).toFixed(1)}%)`
                            }
                        }
                    }
                }
            });
        }

        // Render custom HTML legend
        const legendEl = document.getElementById('mopServicioCostChartLegend');
        if (legendEl) {
            legendEl.innerHTML = data.map((d, idx) => {
                const cost = d.total;
                const pct = totalCost > 0 ? ((cost / totalCost) * 100).toFixed(1).replace(/\.0$/, '') : '0';
                const col = colors[idx];
                const sName = shortServiceName(d.label);
                return `
                    <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.69rem; padding:0.1rem 0; color:var(--text-primary);">
                        <div style="display:flex; align-items:center; gap:0.35rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                            <span style="color:var(--text-primary); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sName}</span>
                        </div>
                        <span style="font-size:0.68rem; color:var(--text-secondary); font-weight:700; font-variant-numeric:tabular-nums; flex-shrink:0; margin-left:0.25rem;">
                            ${pct}%
                        </span>
                    </div>
                `;
            }).join('');
        }
    }

    // ── 2. Barras: Inversión por Región (Actualización dinámica interactiva) ──
    function renderRegionBar() {
        const canvas = document.getElementById('chart-region');
        if (!canvas) return;
        clearEmpty(canvas);

        const data = aggregateBy('region', 'cost_mm').sort((a,b) => b.total - a.total);
        if (!data.length) {
            destroyChart('region');
            showEmpty(canvas);
            return;
        }

        const totalCost = data.reduce((sum, d) => sum + d.total, 0);
        const labels = data.map(d => shortRegion(d.label));
        const values = data.map(d => +d.total.toFixed(1));
        const bgColors = '#2563eb';

        if (charts.region) {
            charts.region.data.labels = labels;
            charts.region.data.datasets[0].data = values;
            charts.region.data.datasets[0].backgroundColor = bgColors;
            charts.region.options.scales.x.title.color = titleColor();
            charts.region.options.scales.x.grid.color = gridColor();
            charts.region.options.scales.x.ticks.color = labelColor();
            charts.region.options.scales.y.ticks.color = labelColor();
            charts.region.options.plugins.tooltip.callbacks.label = (ctx) => ` Inversión: $${Number(ctx.raw).toLocaleString('es-CL')} MM CLP (${((ctx.raw / (totalCost || 1)) * 100).toFixed(1)}%)`;
            delete charts.region.options.onClick;
            charts.region.update();
        } else {
            charts.region = new Chart(canvas, {
                type: 'bar',
                plugins: [horizontalBarDataLabelsPlugin],
                data: {
                    labels: labels,
                    datasets: [{
                        label:           'Inversión (MM CLP)',
                        data:            values,
                        backgroundColor: bgColors,
                        borderRadius:    3,
                        borderSkipped:   false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    animation: { duration: 450, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        horizontalBarDataLabelsPlugin: {
                            formatter: (v) => formatMM(v)
                        },
                        tooltip: {
                            enabled: false,
                            external: mopExternalTooltip,
                            callbacks: {
                                title: items => items.length ? items[0].label : '',
                                label: ctx => ` Inversión: $${Number(ctx.raw).toLocaleString('es-CL')} MM CLP (${((ctx.raw / (totalCost || 1)) * 100).toFixed(1)}%)`
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Inversión (MM CLP)',
                                color: titleColor(),
                                font: { size: 10, weight: '600' }
                            },
                            grid:  { color: gridColor() },
                            ticks: {
                                color: labelColor(),
                                font: { size: 10 },
                                callback: v => `$${v.toLocaleString('es-CL')}M`
                            }
                        },
                        y: {
                            grid:  { display: false },
                            ticks: {
                                color: labelColor(),
                                font: { size: 10.5, weight: '500' },
                                autoSkip: false
                            }
                        }
                    }
                }
            });
        }
    }

    // ── 2b. Barras: Inversión por Servicio MOP (Inversión MM CLP) ───────────
    function renderServicioInversionBar() {
        const id = 'chart-servicio-inversion';
        const canvas = document.getElementById(id);
        if (!canvas) return;
        clearEmpty(canvas);

        const data = aggregateBy('servicio', 'cost_mm').sort((a,b) => b.total - a.total);
        if (!data.length) {
            destroyChart(id);
            showEmpty(canvas);
            return;
        }

        const totalCost = data.reduce((sum, d) => sum + d.total, 0);
        const labels = data.map(d => shortServiceName(d.label));
        const values = data.map(d => +d.total.toFixed(1));
        const colors = data.map(d => getServiceColor(d.label));

        if (charts[id]) {
            charts[id].data.labels = labels;
            charts[id].data.datasets[0].data = values;
            charts[id].data.datasets[0].backgroundColor = colors;
            charts[id].options.scales.x.title.color = titleColor();
            charts[id].options.scales.x.grid.color = gridColor();
            charts[id].options.scales.x.ticks.color = labelColor();
            charts[id].options.scales.y.ticks.color = labelColor();
            charts[id].options.plugins.tooltip.callbacks.label = (ctx) => ` Inversión: $${Number(ctx.raw).toLocaleString('es-CL')} MM CLP (${((ctx.raw / (totalCost || 1)) * 100).toFixed(1)}%)`;
            charts[id].update();
        } else {
            charts[id] = new Chart(canvas, {
                type: 'bar',
                plugins: [horizontalBarDataLabelsPlugin],
                data: {
                    labels: labels,
                    datasets: [{
                        label:           'Inversión (MM CLP)',
                        data:            values,
                        backgroundColor: colors,
                        borderRadius:    3,
                        borderSkipped:   false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    animation: { duration: 450, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        horizontalBarDataLabelsPlugin: {
                            formatter: (v) => formatMM(v)
                        },
                        tooltip: {
                            enabled: false,
                            external: mopExternalTooltip,
                            callbacks: {
                                title: (items) => {
                                    if (items.length > 0) {
                                        const idx = items[0].dataIndex;
                                        return data[idx] ? data[idx].label : (items[0].label || '');
                                    }
                                    return '';
                                },
                                label: ctx => ` Inversión: $${Number(ctx.raw).toLocaleString('es-CL')} MM CLP (${((ctx.raw / (totalCost || 1)) * 100).toFixed(1)}%)`
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Inversión (MM CLP)',
                                color: titleColor(),
                                font: { size: 10, weight: '600' }
                            },
                            grid:  { color: gridColor() },
                            ticks: {
                                color: labelColor(),
                                font: { size: 10 },
                                callback: v => `$${v.toLocaleString('es-CL')}M`
                            }
                        },
                        y: {
                            grid:  { display: false },
                            ticks: {
                                color: labelColor(),
                                font: { size: 10.5, weight: '500' },
                                autoSkip: false
                            }
                        }
                    }
                }
            });
        }
    }

    // ── 2c. Barras: Inversión por Programa (Top 10 Programas por Inversión) ──
    function renderProgramaInversionBar() {
        const id = 'chart-programa-inversion';
        const canvas = document.getElementById(id);
        if (!canvas) return;
        clearEmpty(canvas);

        const data = aggregateBy('programa', 'cost_mm')
            .sort((a,b) => b.total - a.total)
            .slice(0, 10);
        if (!data.length) {
            destroyChart(id);
            showEmpty(canvas);
            return;
        }

        const labels = data.map(d => d.label.length > 32 ? d.label.slice(0, 31) + '…' : d.label);
        const values = data.map(d => +d.total.toFixed(1));
        const barColor = '#f59e0b';

        if (charts[id]) {
            charts[id].data.labels = labels;
            charts[id].data.datasets[0].data = values;
            charts[id].data.datasets[0].backgroundColor = barColor;
            charts[id].options.scales.x.title.color = titleColor();
            charts[id].options.scales.x.grid.color = gridColor();
            charts[id].options.scales.x.ticks.color = labelColor();
            charts[id].options.scales.y.ticks.color = labelColor();
            charts[id].update();
        } else {
            charts[id] = new Chart(canvas, {
                type: 'bar',
                plugins: [horizontalBarDataLabelsPlugin],
                data: {
                    labels: labels,
                    datasets: [{
                        label:           'Inversión (MM CLP)',
                        data:            values,
                        backgroundColor: barColor,
                        borderRadius:    3,
                        borderSkipped:   false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    animation: { duration: 450, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        horizontalBarDataLabelsPlugin: {
                            formatter: (v) => formatMM(v)
                        },
                        tooltip: {
                            enabled: false,
                            external: mopExternalTooltip,
                            callbacks: {
                                title: (items) => {
                                    if (items.length > 0) {
                                        const idx = items[0].dataIndex;
                                        return data[idx] ? data[idx].label : (items[0].label || '');
                                    }
                                    return '';
                                },
                                label: ctx => ` Inversión: $${Number(ctx.raw).toLocaleString('es-CL')} MM CLP`
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Inversión (MM CLP)',
                                color: titleColor(),
                                font: { size: 10, weight: '600' }
                            },
                            grid:  { color: gridColor() },
                            ticks: {
                                color: labelColor(),
                                font: { size: 10 },
                                callback: v => `$${v.toLocaleString('es-CL')}M`
                            }
                        },
                        y: {
                            grid:  { display: false },
                            ticks: {
                                color: labelColor(),
                                font: { size: 9.5, weight: '500' },
                                autoSkip: false
                            }
                        }
                    }
                }
            });
        }
    }

    // ── 3. Barras: Número de Proyectos por Región (Reubicado en Programas y Etapas) ──
    function renderRegionCountBar() {
        const canvas = document.getElementById('chart-region-count');
        if (!canvas) return;
        clearEmpty(canvas);

        const data = aggregateBy('region', 'cost_mm').sort((a,b) => b.count - a.count);
        if (!data.length) {
            destroyChart('region-count');
            showEmpty(canvas);
            return;
        }

        const totalProjects = data.reduce((sum, d) => sum + d.count, 0);
        const labels = data.map(d => shortRegion(d.label));
        const values = data.map(d => d.count);
        const bgColors = '#10b981';

        if (charts['region-count']) {
            charts['region-count'].data.labels = labels;
            charts['region-count'].data.datasets[0].data = values;
            charts['region-count'].data.datasets[0].backgroundColor = bgColors;
            charts['region-count'].options.scales.x.title.color = titleColor();
            charts['region-count'].options.scales.x.grid.color = gridColor();
            charts['region-count'].options.scales.x.ticks.color = labelColor();
            charts['region-count'].options.scales.y.ticks.color = labelColor();
            charts['region-count'].options.plugins.tooltip.callbacks.label = (ctx) => ` Cantidad: ${ctx.raw} proyecto${ctx.raw !== 1 ? 's' : ''} (${((ctx.raw / (totalProjects || 1)) * 100).toFixed(1)}%)`;
            delete charts['region-count'].options.onClick;
            charts['region-count'].update();
        } else {
            charts['region-count'] = new Chart(canvas, {
                type: 'bar',
                plugins: [horizontalBarDataLabelsPlugin],
                data: {
                    labels: labels,
                    datasets: [{
                        label:           'Nº Proyectos',
                        data:            values,
                        backgroundColor: bgColors,
                        borderRadius:    3,
                        borderSkipped:   false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    animation: { duration: 450, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        horizontalBarDataLabelsPlugin: {
                            formatter: (v) => String(v)
                        },
                        tooltip: {
                            enabled: false,
                            external: mopExternalTooltip,
                            callbacks: {
                                title: items => items.length ? items[0].label : '',
                                label: ctx => ` Cantidad: ${ctx.raw} proyecto${ctx.raw !== 1 ? 's' : ''} (${((ctx.raw / (totalProjects || 1)) * 100).toFixed(1)}%)`
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Número de Proyectos',
                                color: titleColor(),
                                font: { size: 10, weight: '600' }
                            },
                            grid:  { color: gridColor() },
                            ticks: {
                                color: labelColor(),
                                font: { size: 10 },
                                stepSize: 1
                            }
                        },
                        y: {
                            grid:  { display: false },
                            ticks: {
                                color: labelColor(),
                                font: { size: 10, weight: '500' },
                                autoSkip: false
                            }
                        }
                    }
                }
            });
        }
    }

    // ── 4. Barras: Proyectos por Etapa (Sin línea amarilla de inversión) ────────
    function renderEtapaBar() {
        const id = 'chart-etapa-tab';
        const canvas = document.getElementById(id);
        if (!canvas) return;
        clearEmpty(canvas);

        const data = aggregateBy('etapa', 'cost_mm').sort((a,b) => b.count - a.count);
        if (!data.length) {
            destroyChart(id);
            showEmpty(canvas);
            return;
        }

        const totalProjects = data.reduce((sum, d) => sum + d.count, 0);
        const labels = data.map(d => d.label);
        const countValues = data.map(d => d.count);
        const barColor = '#2563eb';

        if (charts[id]) {
            charts[id].data.labels = labels;
            charts[id].data.datasets = [{
                label:           'Nº Proyectos',
                data:            countValues,
                backgroundColor: barColor,
                borderRadius:    3,
                borderSkipped:   false,
            }];
            charts[id].options.scales.y.title.color = titleColor();
            charts[id].options.scales.y.grid.color = gridColor();
            charts[id].options.scales.y.ticks.color = labelColor();
            charts[id].options.scales.x.ticks.color = labelColor();
            charts[id].options.plugins.tooltip.callbacks.label = (ctx) => ` Cantidad: ${ctx.raw} proyecto${ctx.raw !== 1 ? 's' : ''} (${((ctx.raw / (totalProjects || 1)) * 100).toFixed(1)}%)`;
            delete charts[id].options.onClick;
            charts[id].update();
        } else {
            charts[id] = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label:           'Nº Proyectos',
                        data:            countValues,
                        backgroundColor: barColor,
                        borderRadius:    3,
                        borderSkipped:   false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 450, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            mode: 'index',
                            intersect: false,
                            external: mopExternalTooltip,
                            callbacks: {
                                title: items => items.length ? `Etapa: ${items[0].label}` : '',
                                label: ctx => ` Cantidad: ${ctx.raw} proyecto${ctx.raw !== 1 ? 's' : ''} (${((ctx.raw / (totalProjects || 1)) * 100).toFixed(1)}%)`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: labelColor(),
                                font: { size: 10, weight: '600' }
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Nº Proyectos',
                                color: titleColor(),
                                font: { size: 10, weight: '600' }
                            },
                            grid: { color: gridColor() },
                            ticks: {
                                color: labelColor(),
                                font: { size: 10 }
                            }
                        }
                    }
                }
            });
        }
    }

    // ── 5. Línea: Evolución por año de primera postulación (Plugin Hoy exacto a index.html) ──
    function renderYearLine() {
        const canvas = document.getElementById('chart-year');
        if (!canvas) return;
        clearEmpty(canvas);

        const map = {};
        filteredProjects.forEach(p => {
            if (!p.year) return;
            if (!map[p.year]) map[p.year] = { count: 0, total: 0 };
            map[p.year].count++;
            map[p.year].total += (p.cost_mm || 0);
        });
        const years = Object.keys(map).map(Number).sort((a,b) => a-b);
        if (!years.length) {
            destroyChart('year');
            showEmpty(canvas);
            return;
        }

        const countValues = years.map(y => map[y].count);
        const costValues = years.map(y => +map[y].total.toFixed(1));

        if (charts.year) {
            charts.year.data.labels = years;
            charts.year.data.datasets[0].data = countValues;
            charts.year.data.datasets[1].data = costValues;
            charts.year.options.scales.x.grid.color = gridColor();
            charts.year.options.scales.x.ticks.color = labelColor();
            charts.year.options.scales.y.title.color = titleColor();
            charts.year.options.scales.y.grid.color = gridColor();
            charts.year.options.scales.y.ticks.color = labelColor();
            charts.year.options.scales.y2.title.color = '#f59e0b';
            charts.year.options.scales.y2.ticks.color = '#f59e0b';
            charts.year.update();
        } else {
            charts.year = new Chart(canvas, {
                type: 'bar',
                plugins: [todayLineChartPlugin],
                data: {
                    labels: years,
                    datasets: [
                        {
                            label:           'Nº Proyectos',
                            data:            countValues,
                            backgroundColor: '#2563eb',
                            borderRadius:    3,
                            borderSkipped:   false,
                            yAxisID:         'y',
                        },
                        {
                            label:           'Inversión (MM CLP)',
                            data:            costValues,
                            type:            'line',
                            borderColor:     '#f59e0b',
                            backgroundColor: 'transparent',
                            borderWidth:     2,
                            pointRadius:     4,
                            pointHoverRadius:6,
                            tension:         0.25,
                            yAxisID:         'y2',
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 450, easing: 'easeOutQuart' },
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            align: 'end',
                            labels: {
                                boxWidth: 10,
                                boxHeight: 10,
                                padding: 12,
                                color: labelColor(),
                                font: { size: 10 }
                            }
                        },
                        tooltip: {
                            enabled: false,
                            mode: 'index',
                            intersect: false,
                            external: mopExternalTooltip,
                            callbacks: {
                                title: (items) => items.length ? `Año ${items[0].label}` : '',
                                label: (ctx) => {
                                    if (ctx.datasetIndex === 0) return ` Proyectos: ${ctx.raw}`;
                                    return ` Inversión: $${Number(ctx.raw).toLocaleString('es-CL')} MM CLP`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor() },
                            ticks: {
                                color: labelColor(),
                                font: { size: 10 }
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Nº Proyectos',
                                color: titleColor(),
                                font: { size: 10, weight: '600' }
                            },
                            grid: { color: gridColor() },
                            ticks: {
                                color: labelColor(),
                                font: { size: 10 }
                            }
                        },
                        y2: {
                            position: 'right',
                            title: {
                                display: true,
                                text: 'Inversión (MM CLP)',
                                color: '#f59e0b',
                                font: { size: 10, weight: '600' }
                            },
                            grid: { display: false },
                            ticks: {
                                color: '#f59e0b',
                                font: { size: 10 },
                                callback: v => `$${v.toLocaleString('es-CL')}M`
                            }
                        }
                    }
                }
            });
        }
    }

    // ── 6. Tabla: Top 10 Megaproyectos ───────────────────────────────────────
    function renderTopTable() {
        const tbody = document.getElementById('top-projects-tbody');
        if (!tbody) return;

        const top10 = [...filteredProjects]
            .filter(p => p.cost_mm > 0)
            .sort((a,b) => b.cost_mm - a.cost_mm)
            .slice(0, 10);

        if (!top10.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:1rem;">Sin resultados</td></tr>';
            return;
        }

        tbody.innerHTML = top10.map((p, i) => `
            <tr>
                <td style="padding:0.4rem 0.5rem;font-size:0.7rem;color:var(--text-muted);">${i+1}</td>
                <td style="padding:0.4rem 0.5rem;font-size:0.7rem;color:var(--text-primary);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${p.nombre}">${p.nombre || '—'}</td>
                <td style="padding:0.4rem 0.5rem;font-size:0.7rem;color:var(--text-secondary);">${shortRegion(p.region || '—')}</td>
                <td style="padding:0.4rem 0.5rem;font-size:0.7rem;font-weight:700;color:#3b82f6;text-align:right;">$${p.cost_mm.toLocaleString('es-CL')} M</td>
            </tr>
        `).join('');
    }

    // ── Tabs del subheader ────────────────────────────────────────────────────
    function switchTab(targetView) {
        currentActiveTab = targetView;
        const tabs = document.querySelectorAll('.view-tab-btn[data-mop-view]');
        const containers = document.querySelectorAll('.mop-view-container');
        tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.mopView === targetView);
        });
        containers.forEach(c => {
            const isMatch = (c.dataset.mopView === targetView);
            c.classList.toggle('hidden', !isMatch);
        });

        requestAnimationFrame(() => {
            renderAllCharts();
            Object.values(charts).forEach(ch => {
                if (ch && typeof ch.resize === 'function') ch.resize();
            });
        });
    }
    window.switchMOPTab = switchTab;

    function bindTabEvents() {
        const tabs = document.querySelectorAll('.view-tab-btn[data-mop-view]');
        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                switchTab(btn.dataset.mopView);
            });
        });

        // Verificar hash en la URL al cargar
        if (window.location.hash === '#inversion') {
            switchTab('inversion');
        } else if (window.location.hash === '#programas') {
            switchTab('programas');
        } else {
            switchTab('resumen');
        }

        window.addEventListener('hashchange', () => {
            if (window.location.hash === '#inversion') {
                switchTab('inversion');
            } else if (window.location.hash === '#programas') {
                switchTab('programas');
            } else if (window.location.hash === '#resumen' || !window.location.hash) {
                switchTab('resumen');
            }
        });
    }

    // ── Exportación a Excel ──────────────────────────────────────────────────
    function exportMOPToExcel() {
        if (typeof XLSX === 'undefined') {
            alert('La librería SheetJS (XLSX) no se encuentra disponible.');
            return;
        }

        const projects = (filteredProjects && filteredProjects.length > 0)
            ? filteredProjects
            : (window.MOP_DATA?.projects || []);

        if (!projects || projects.length === 0) {
            alert('No hay iniciativas del MOP para exportar con los filtros seleccionados.');
            return;
        }

        const dataRows = projects.map(p => ({
            "Nombre de la Iniciativa": p.nombre || '',
            "Código BIP": p.bip || '',
            "Región": p.region || '',
            "Servicio / Dirección": p.servicio || '',
            "Programa": p.programa || '',
            "Etapa del Proyecto": p.etapa || '',
            "Costo Total (MM$)": p.cost_mm != null ? p.cost_mm : '',
            "Año Inicio": p.year != null ? p.year : '',
            "Año Término Estimado": p.year_ult != null ? p.year_ult : ''
        }));

        const ws = XLSX.utils.json_to_sheet(dataRows);

        if (dataRows.length > 0) {
            const colKeys = Object.keys(dataRows[0]);
            ws['!cols'] = colKeys.map(key => {
                let maxLen = key.length;
                for (let i = 0; i < Math.min(dataRows.length, 50); i++) {
                    const val = dataRows[i][key];
                    if (val != null) {
                        const strLen = String(val).length;
                        if (strLen > maxLen) maxLen = strLen;
                    }
                }
                return { wch: Math.min(Math.max(maxLen + 2, 14), 50) };
            });
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cartera_MOP");

        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `CATLEC_MOP_Cartera_${today}.xlsx`);
    }

    // ── Bootstrap ────────────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
