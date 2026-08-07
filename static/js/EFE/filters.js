// ─── EFE Filters & Data Module ───────────────────────────────────────────────

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
    if (normProjRegion.includes('nacional')) return true;

    // Split multiregional string into tokens (by ;, ,, /, \n)
    const projTokens = normProjRegion
        .split(/[;,/\n]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0);

    return selectedRegions.some(selected => {
        const normSelected = efeNormalize(selected);

        // 1. Direct full match
        if (normProjRegion.includes(normSelected) || normSelected.includes(normProjRegion)) {
            return true;
        }

        // 2. Token-by-token match for multiregional strings (e.g. O'Higgins in Libertador General Bernardo O'Higgins)
        return projTokens.some(token => {
            if (token.length < 3) return false;
            return normSelected.includes(token) || token.includes(normSelected);
        });
    });
}

function efeFilialMatchesFilter(projectFilial, selectedFiliales) {
    if (!selectedFiliales || selectedFiliales.length === 0) return true;
    if (!projectFilial) return false;
    const normProjFilial = efeNormalize(projectFilial);
    return selectedFiliales.some(selected => {
        const normSelected = efeNormalize(selected);
        return normProjFilial.includes(normSelected) || normSelected.includes(normProjFilial);
    });
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

    // Populate filial checkboxes
    if (efeFilialOptionsList) {
        efeFilialOptionsList.innerHTML = '';
        efeAvailableFiliales.forEach(filial => {
            const label = document.createElement('label');
            label.className = 'multiselect-option';
            label.innerHTML = `<input type="checkbox" class="efe-filial-checkbox" value="${filial}">
                <span>${filial}</span>`;
            efeFilialOptionsList.appendChild(label);
        });

        // Check-all
        if (efeFilialCheckAll) {
            efeFilialCheckAll.addEventListener('change', () => {
                const isChecked = efeFilialCheckAll.checked;
                document.querySelectorAll('.efe-filial-checkbox').forEach(cb => cb.checked = isChecked);
                efeUpdateSelectedFiliales();
            });
        }

        document.querySelectorAll('.efe-filial-checkbox').forEach(cb => {
            cb.addEventListener('change', efeUpdateSelectedFiliales);
        });
    }

    // Multiselect dropdown toggles
    if (efeRegionMultiselectBtn && efeRegionMultiselectDropdown) {
        efeRegionMultiselectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (efeFilialMultiselectDropdown) efeFilialMultiselectDropdown.style.display = 'none';
            const isOpen = efeRegionMultiselectDropdown.style.display === 'block';
            efeRegionMultiselectDropdown.style.display = isOpen ? 'none' : 'block';
        });
    }

    if (efeFilialMultiselectBtn && efeFilialMultiselectDropdown) {
        efeFilialMultiselectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (efeRegionMultiselectDropdown) efeRegionMultiselectDropdown.style.display = 'none';
            const isOpen = efeFilialMultiselectDropdown.style.display === 'block';
            efeFilialMultiselectDropdown.style.display = isOpen ? 'none' : 'block';
        });
    }

    document.addEventListener('click', () => {
        if (efeRegionMultiselectDropdown) efeRegionMultiselectDropdown.style.display = 'none';
        if (efeFilialMultiselectDropdown) efeFilialMultiselectDropdown.style.display = 'none';
    });

    if (efeRegionMultiselectDropdown) efeRegionMultiselectDropdown.addEventListener('click', e => e.stopPropagation());
    if (efeFilialMultiselectDropdown) efeFilialMultiselectDropdown.addEventListener('click', e => e.stopPropagation());

    efeInitTableSorting();
}

function efeInitTableSorting() {
    document.querySelectorAll('.efe-sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (!col) return;

            if (efeState.sortBy === col) {
                efeState.sortOrder = efeState.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                efeState.sortBy = col;
                efeState.sortOrder = (col === 'investment_usd') ? 'desc' : 'asc';
            }

            efeState.page = 1;
            efeFetchData();
        });
    });
}

function efeUpdateSortHeaderIcons() {
    document.querySelectorAll('.efe-sortable').forEach(th => {
        const col = th.getAttribute('data-sort');
        th.classList.remove('sorted-asc', 'sorted-desc');
        const iconSpan = th.querySelector('.efe-sort-icon');

        if (col === efeState.sortBy) {
            th.classList.add(efeState.sortOrder === 'asc' ? 'sorted-asc' : 'sorted-desc');
            if (iconSpan) {
                iconSpan.textContent = efeState.sortOrder === 'asc' ? '▲' : '▼';
            }
        } else {
            if (iconSpan) {
                iconSpan.textContent = '⇅';
            }
        }
    });
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

function efeUpdateSelectedFiliales() {
    const checked = Array.from(document.querySelectorAll('.efe-filial-checkbox:checked'));
    efeState.selectedFiliales = checked.map(cb => cb.value);

    const total = efeAvailableFiliales.length;
    const count = efeState.selectedFiliales.length;
    if (efeFilialCheckAll) efeFilialCheckAll.checked = (count === total && total > 0);
    if (efeFilialMultiselectText) {
        if (count === 0 || count === total) efeFilialMultiselectText.textContent = 'Todas las filiales';
        else if (count === 1) efeFilialMultiselectText.textContent = efeState.selectedFiliales[0];
        else efeFilialMultiselectText.textContent = `${count} filiales seleccionadas`;
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
            const haystack = efeNormalize(proj.name + ' ' + (proj.region || '') + ' ' + (proj.filial || '') + ' ' + (proj.description || ''));
            if (!haystack.includes(searchNorm)) return false;
        }
        // Region filter
        if (!efeRegionMatchesFilter(proj.region, efeState.selectedRegions)) return false;
        // Filial filter
        if (!efeFilialMatchesFilter(proj.filial, efeState.selectedFiliales)) return false;
        return true;
    });

    // Sort
    const sortBy = efeState.sortBy || 'name';
    const sortOrder = efeState.sortOrder || 'asc';

    filtered.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        if (sortBy === 'investment_usd') {
            valA = valA != null ? Number(valA) : 0;
            valB = valB != null ? Number(valB) : 0;
            return sortOrder === 'asc' ? valA - valB : valB - valA;
        } else {
            valA = valA != null ? String(valA).trim() : '';
            valB = valB != null ? String(valB).trim() : '';
            return sortOrder === 'asc'
                ? valA.localeCompare(valB, 'es', { sensitivity: 'base', numeric: true })
                : valB.localeCompare(valA, 'es', { sensitivity: 'base', numeric: true });
        }
    });

    efeUpdateSortHeaderIcons();

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

    // Update count badge & KPIs
    if (efeCountLoaded) efeCountLoaded.textContent = totalFiltered;
    if (efeCountTotal) efeCountTotal.textContent = totalAll;

    if (efeKpiTotalProjects) efeKpiTotalProjects.textContent = totalFiltered;
    if (efeKpiTotalInvestment) {
        const totalInv = filtered.reduce((sum, p) => sum + (p.investment_usd || 0), 0);
        efeKpiTotalInvestment.textContent = typeof efeFormatCompactUSD === 'function'
            ? efeFormatCompactUSD(totalInv)
            : 'US$ ' + Math.round(totalInv).toLocaleString('es-CL');
    }

    // Update analytics charts
    if (typeof efeUpdateAnalyticsCharts === 'function') {
        efeUpdateAnalyticsCharts(filtered);
    }

    efeUpdateMapBadge(filtered.length, totalAll);
}
