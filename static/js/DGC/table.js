// Tabla de resultados: render de filas, celda de región y paginación

function formatRegionCell(regionStr) {
    return CatlecUtils.formatRegionCell(regionStr);
}

function renderTable(contracts) {
    tableBody.innerHTML = '';

    if (contracts.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }
    emptyState.style.display = 'none';

    contracts.forEach((item, index) => {
        const status = item['ESTADO'] || '';
        const badgeClass = getStatusBadgeClass(status);

        const tr = document.createElement('tr');
        tr.className = 'row-main';
        tr.id = `row-${index}`;
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
            <td><strong>${item['Nombre de uso común'] || item['Nombre de la Concesión '] || 'Sin nombre'}</strong></td>
            <td>${formatRegionCell(item['Región geográfica'])}</td>
            <td>${item ? formatDate(item['Fecha inicio del contrato de concesión']) : 'N/A'}</td>
            <td><span class="badge ${badgeClass}">${status}</span></td>
        `;

        tr.addEventListener('click', () => {
            if (item['Código proyecto']) {
                zoomToProjectCode(item['Código proyecto']);
            }
        });

        tr.addEventListener('mouseenter', () => {
            if (item['Código proyecto'] && typeof setHoveredProject === 'function') {
                setHoveredProject(item['Código proyecto'].toString().trim());
            }
        });

        tr.addEventListener('mouseleave', () => {
            if (typeof setHoveredProject === 'function') setHoveredProject(null);
        });

        tableBody.appendChild(tr);
    });
}

function showTableListView() {
    const wasDetailOpen = projectDetailView && projectDetailView.style.display === 'flex';
    if (wasDetailOpen && tableContainerView && typeof CatlecUtils !== 'undefined') {
        CatlecUtils.swapView(projectDetailView, tableContainerView, { direction: 'back' });
    } else {
        if (projectDetailView) projectDetailView.style.display = 'none';
        if (tableContainerView) tableContainerView.style.display = 'flex';
    }
    if (detailViewBody) detailViewBody.scrollTop = 0;
}

// Handle Pagination State and updates

function updatePaginationControls(pInfo) {
    appState.page = pInfo.page;
    const paginationContainer = document.querySelector('.pagination-container');

    if (pInfo.total_pages <= 1) {
        if (paginationContainer) paginationContainer.style.display = 'none';
    } else {
        if (paginationContainer) paginationContainer.style.display = 'flex';
        const startRecord = (pInfo.page - 1) * pInfo.page_size + 1;
        const endRecord = Math.min(pInfo.page * pInfo.page_size, pInfo.total_records);

        if (pInfo.total_records === 0) {
            paginationInfo.textContent = 'Mostrando 0 de 0 filtrados';
            btnPrev.disabled = true;
            btnNext.disabled = true;
        } else {
            paginationInfo.textContent = `Mostrando ${startRecord}-${endRecord} de ${pInfo.total_records} contratos`;
            btnPrev.disabled = (pInfo.page <= 1);
            btnNext.disabled = (pInfo.page >= pInfo.total_pages);
        }
    }
}
