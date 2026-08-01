// ─── EFE Filters & Data Module ───────────────────────────────────────────────

function efeNormalize(str) {
    return str
        ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        : '';
}

function efeFormatUSD(value) {
    if (value == null || isNaN(value)) return '—';
    if (value >= 1e9) return `US$ ${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `US$ ${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `US$ ${(value / 1e3).toFixed(0)}K`;
    return `US$ ${value.toLocaleString('es-CL')}`;
}

function efeRegionMatchesFilter(projectRegion, selectedRegions) {
    if (!selectedRegions || selectedRegions.length === 0) return true;
    if (!projectRegion) return false;
    const normProjRegion = efeNormalize(projectRegion);
    return selectedRegions.some(r => normProjRegion.includes(efeNormalize(r)));
}

function efeLoadFilters() {
    // Populate region checkboxes
    if (efeRegionOptionsList) {
        efeRegionOptionsList.innerHTML = '';
        efeAvailableRegions.forEach(region => {
            const label = document.createElement('label');
            label.className = 'multiselect-option';
            label.innerHTML = `<input type="checkbox" class="efe-region-checkbox" value="${region}">
                <span>${region}</span>`;
            efeRegionOptionsList.appendChild(label);
        });

        // Check-all
        if (efeRegionCheckAll) {
            efeRegionCheckAll.addEventListener('change', () => {
                const isChecked = efeRegionCheckAll.checked;
                document.querySelectorAll('.efe-region-checkbox').forEach(cb => cb.checked = isChecked);
                efeUpdateSelectedRegions();
            });
        }

        document.querySelectorAll('.efe-region-checkbox').forEach(cb => {
            cb.addEventListener('change', efeUpdateSelectedRegions);
        });
    }

    // Multiselect dropdown toggle
    if (efeRegionMultiselectBtn && efeRegionMultiselectDropdown) {
        efeRegionMultiselectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = efeRegionMultiselectDropdown.style.display === 'block';
            efeRegionMultiselectDropdown.style.display = isOpen ? 'none' : 'block';
        });
        document.addEventListener('click', () => {
            if (efeRegionMultiselectDropdown) efeRegionMultiselectDropdown.style.display = 'none';
        });
        efeRegionMultiselectDropdown.addEventListener('click', e => e.stopPropagation());
    }
}

function efeUpdateSelectedRegions() {
    const checked = Array.from(document.querySelectorAll('.efe-region-checkbox:checked'));
    efeState.selectedRegions = checked.map(cb => cb.value);

    const total = efeAvailableRegions.length;
    const count = efeState.selectedRegions.length;
    if (efeRegionCheckAll) efeRegionCheckAll.checked = (count === total && total > 0);
    if (efeRegionMultiselectText) {
        if (count === 0 || count === total) efeRegionMultiselectText.textContent = 'Todas las regiones';
        else if (count === 1) efeRegionMultiselectText.textContent = efeState.selectedRegions[0];
        else efeRegionMultiselectText.textContent = `${count} regiones seleccionadas`;
    }
    efeState.page = 1;
    efeFetchData();
}

function efeFetchData() {
    const allProjects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
    const searchNorm = efeNormalize(efeState.search);

    // Filter
    let filtered = allProjects.filter(proj => {
        // Search
        if (searchNorm) {
            const haystack = efeNormalize(proj.name + ' ' + (proj.region || '') + ' ' + (proj.description || ''));
            if (!haystack.includes(searchNorm)) return false;
        }
        // Region filter
        if (!efeRegionMatchesFilter(proj.region, efeState.selectedRegions)) return false;
        return true;
    });

    const totalFiltered = filtered.length;
    const totalAll = allProjects.length;

    // Pagination
    const page = efeState.page;
    const pageSize = efeState.pageSize;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    if (page > totalPages) efeState.page = totalPages;
    const startIdx = (efeState.page - 1) * pageSize;
    const pageSlice = filtered.slice(startIdx, startIdx + pageSize);

    // Update table
    efeRenderTable(pageSlice);
    efeUpdatePagination(efeState.page, totalPages, totalFiltered);

    // If currently selected project is no longer in filtered results, clear selection
    if (efeState.selectedProjectName) {
        const isStillVisible = filtered.some(p => p.name === efeState.selectedProjectName);
        if (!isStillVisible) {
            efeState.selectedProjectName = null;
        }
    }

    // Update map markers
    if (typeof efeRenderProjectMarkers === 'function') {
        efeRenderProjectMarkers(filtered);
    }

    // Update unified map styles
    if (typeof efeUpdateMapStyles === 'function') {
        efeUpdateMapStyles();
    }

    // Update count badge
    if (efeCountLoaded) efeCountLoaded.textContent = totalFiltered;
    if (efeCountTotal) efeCountTotal.textContent = totalAll;
    efeUpdateMapBadge(filtered.length, totalAll);
}
