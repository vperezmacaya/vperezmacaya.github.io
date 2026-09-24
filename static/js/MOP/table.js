// Tabla global de proyectos MOP: orden y paginación

function formatRegionCell(regionStr) {
    return CatlecUtils.formatRegionCell(regionStr);
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
