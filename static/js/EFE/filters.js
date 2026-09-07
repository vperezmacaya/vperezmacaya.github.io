// ─── EFE Filters & Data Module ───────────────────────────────────────────────
var currentFilteredEFEProjects = [];

function efeNormalize(str) {
    return str
        ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        : '';
}

function efeFormatInvestment(valueMM) {
    if (valueMM == null || isNaN(valueMM)) return '—';
    const v = Number(valueMM);
    if (v >= 1000) return `US$ ${(v / 1000).toFixed(2)}B`;
    if (v >= 1) return `US$ ${v.toLocaleString('es-CL', {maximumFractionDigits: 0})} MM`;
    return `US$ ${v.toFixed(1)} MM`;
}
window.efeFormatInvestment = efeFormatInvestment;

// Legacy alias
function efeFormatUSD(value) {
    return efeFormatInvestment(value);
}
window.efeFormatUSD = efeFormatUSD;

function efeFilialMatchesFilter(projectFilial, selectedFiliales) {
    if (!selectedFiliales || selectedFiliales.length === 0) return true;
    const hasSinFilial = selectedFiliales.includes('Sin filial específica');
    if (!projectFilial || String(projectFilial).trim() === '' || String(projectFilial).trim().toLowerCase() === 'nan') {
        return hasSinFilial;
    }
    const normProjFilial = efeNormalize(projectFilial);
    return selectedFiliales.some(selected => {
        if (selected === 'Sin filial específica') return false;
        const normSelected = efeNormalize(selected);
        return normProjFilial.includes(normSelected) || normSelected.includes(normProjFilial);
    });
}

function efeDetailMatchesFilter(projectDetail, selectedDetails) {
    if (!selectedDetails || selectedDetails.length === 0) return true;
    const cat = typeof efeGetDetailCategory === 'function' ? efeGetDetailCategory(projectDetail) : 'Otros / Extra';
    return selectedDetails.includes(cat);
}

function efeTipoMatchesFilter(projectTipo, selectedTipos) {
    if (!selectedTipos || selectedTipos.length === 0) return true;
    if (!projectTipo) return false;
    const t = String(projectTipo).trim();
    return selectedTipos.includes(t);
}

function efeLoadFilters() {
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

    // Populate detail checkboxes (Portafolio Estratégico vs Preinversional)
    if (efeDetailOptionsList) {
        efeDetailOptionsList.innerHTML = '';
        efeAvailableDetails.forEach(detail => {
            const label = document.createElement('label');
            label.className = 'multiselect-option';
            label.innerHTML = `<input type="checkbox" class="efe-detail-checkbox" value="${detail}">
                <span>${detail}</span>`;
            efeDetailOptionsList.appendChild(label);
        });

        // Check-all
        if (efeDetailCheckAll) {
            efeDetailCheckAll.addEventListener('change', () => {
                const isChecked = efeDetailCheckAll.checked;
                document.querySelectorAll('.efe-detail-checkbox').forEach(cb => cb.checked = isChecked);
                efeUpdateSelectedDetails();
            });
        }

        document.querySelectorAll('.efe-detail-checkbox').forEach(cb => {
            cb.addEventListener('change', efeUpdateSelectedDetails);
        });
    }

    // Populate tipo checkboxes
    if (efeTipoOptionsList) {
        efeTipoOptionsList.innerHTML = '';
        efeAvailableTipos.forEach(tipo => {
            const label = document.createElement('label');
            label.className = 'multiselect-option';
            const svgIcon = (typeof efeGetProjectTypeSvg === 'function')
                ? efeGetProjectTypeSvg(tipo, 12, 12, 'currentColor')
                : '';
            const tipoColor = (typeof EFE_TIPO_COLORS !== 'undefined' && EFE_TIPO_COLORS[tipo])
                ? EFE_TIPO_COLORS[tipo]
                : '#2563eb';
            label.innerHTML = `<input type="checkbox" class="efe-tipo-checkbox" value="${tipo}">
                <span style="display:flex; align-items:center; gap:0.35rem;">
                    <span style="display:inline-flex; align-items:center; justify-content:center; color:${tipoColor};">${svgIcon}</span>
                    <span>${tipo}</span>
                </span>`;
            efeTipoOptionsList.appendChild(label);
        });

        // Check-all
        if (efeTipoCheckAll) {
            efeTipoCheckAll.addEventListener('change', () => {
                const isChecked = efeTipoCheckAll.checked;
                document.querySelectorAll('.efe-tipo-checkbox').forEach(cb => cb.checked = isChecked);
                efeUpdateSelectedTipos();
            });
        }

        document.querySelectorAll('.efe-tipo-checkbox').forEach(cb => {
            cb.addEventListener('change', efeUpdateSelectedTipos);
        });
    }

    // Multiselect dropdown toggles
    if (efeFilialMultiselectBtn && efeFilialMultiselectDropdown) {
        efeFilialMultiselectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (efeDetailMultiselectDropdown) efeDetailMultiselectDropdown.style.display = 'none';
            if (efeTipoMultiselectDropdown) efeTipoMultiselectDropdown.style.display = 'none';
            const isOpen = efeFilialMultiselectDropdown.style.display === 'block';
            efeFilialMultiselectDropdown.style.display = isOpen ? 'none' : 'block';
        });
    }

    if (efeDetailMultiselectBtn && efeDetailMultiselectDropdown) {
        efeDetailMultiselectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (efeFilialMultiselectDropdown) efeFilialMultiselectDropdown.style.display = 'none';
            if (efeTipoMultiselectDropdown) efeTipoMultiselectDropdown.style.display = 'none';
            const isOpen = efeDetailMultiselectDropdown.style.display === 'block';
            efeDetailMultiselectDropdown.style.display = isOpen ? 'none' : 'block';
        });
    }

    if (efeTipoMultiselectBtn && efeTipoMultiselectDropdown) {
        efeTipoMultiselectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (efeFilialMultiselectDropdown) efeFilialMultiselectDropdown.style.display = 'none';
            if (efeDetailMultiselectDropdown) efeDetailMultiselectDropdown.style.display = 'none';
            const isOpen = efeTipoMultiselectDropdown.style.display === 'block';
            efeTipoMultiselectDropdown.style.display = isOpen ? 'none' : 'block';
        });
    }

    document.addEventListener('click', () => {
        if (efeFilialMultiselectDropdown) efeFilialMultiselectDropdown.style.display = 'none';
        if (efeDetailMultiselectDropdown) efeDetailMultiselectDropdown.style.display = 'none';
        if (efeTipoMultiselectDropdown) efeTipoMultiselectDropdown.style.display = 'none';
    });

    if (efeFilialMultiselectDropdown) efeFilialMultiselectDropdown.addEventListener('click', e => e.stopPropagation());
    if (efeDetailMultiselectDropdown) efeDetailMultiselectDropdown.addEventListener('click', e => e.stopPropagation());
    if (efeTipoMultiselectDropdown) efeTipoMultiselectDropdown.addEventListener('click', e => e.stopPropagation());

    efeInitTableSorting();
}

function efeInitTableSorting() {
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (!col) return;

            if (efeState.sortBy === col) {
                efeState.sortOrder = efeState.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                efeState.sortBy = col;
                efeState.sortOrder = (col === 'investment_mm_usd' || col.includes('investment')) ? 'desc' : 'asc';
            }

            document.querySelectorAll('.data-table th.sortable').forEach(el => {
                el.classList.remove('asc', 'desc');
            });
            th.classList.add(efeState.sortOrder);

            efeState.page = 1;
            efeFetchData();
        });
    });
}

function efeUpdateSortHeaderIcons() {
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
        const col = th.getAttribute('data-sort');
        th.classList.remove('asc', 'desc');
        if (col === efeState.sortBy) {
            th.classList.add(efeState.sortOrder);
        }
    });
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

function efeUpdateSelectedDetails() {
    const checked = Array.from(document.querySelectorAll('.efe-detail-checkbox:checked'));
    efeState.selectedDetails = checked.map(cb => cb.value);

    const total = efeAvailableDetails.length;
    const count = efeState.selectedDetails.length;
    if (efeDetailCheckAll) efeDetailCheckAll.checked = (count === total && total > 0);
    if (efeDetailMultiselectText) {
        if (count === 0 || count === total) efeDetailMultiselectText.textContent = 'Todo el portafolio';
        else if (count === 1) efeDetailMultiselectText.textContent = efeState.selectedDetails[0];
        else efeDetailMultiselectText.textContent = `${count} tipos seleccionados`;
    }
    efeState.page = 1;
    efeFetchData();
}

function efeUpdateSelectedTipos() {
    const checked = Array.from(document.querySelectorAll('.efe-tipo-checkbox:checked'));
    efeState.selectedTipos = checked.map(cb => cb.value);

    const total = efeAvailableTipos.length;
    const count = efeState.selectedTipos.length;
    if (efeTipoCheckAll) efeTipoCheckAll.checked = (count === total && total > 0);
    if (efeTipoMultiselectText) {
        if (count === 0 || count === total) efeTipoMultiselectText.textContent = 'Todos los tipos';
        else if (count === 1) efeTipoMultiselectText.textContent = efeState.selectedTipos[0];
        else efeTipoMultiselectText.textContent = `${count} tipos seleccionados`;
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
            const haystack = efeNormalize(proj.name + ' ' + (proj.filial || '') + ' ' + (proj.stage || '') + ' ' + (proj.detail || '') + ' ' + (proj.type || '') + ' ' + (proj.description || ''));
            if (!haystack.includes(searchNorm)) return false;
        }
        // Filial filter
        if (!efeFilialMatchesFilter(proj.filial, efeState.selectedFiliales)) return false;
        // Detail filter (Estratégico vs Preinversional)
        if (!efeDetailMatchesFilter(proj.detail, efeState.selectedDetails)) return false;
        // Tipo filter
        if (!efeTipoMatchesFilter(proj.type, efeState.selectedTipos)) return false;
        return true;
    });

    // Sort
    const sortBy = efeState.sortBy || 'investment_mm_usd';
    const sortOrder = efeState.sortOrder || 'desc';

    filtered.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        if (sortBy === 'investment_mm_usd' || sortBy === 'operation_year') {
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
        const totalInvMM = filtered.reduce((sum, p) => sum + (p.investment_mm_usd || 0), 0);
        efeKpiTotalInvestment.textContent = efeFormatInvestment(totalInvMM);
    }

    // Update analytics charts
    if (typeof efeUpdateAnalyticsCharts === 'function') {
        efeUpdateAnalyticsCharts(filtered);
    }

    currentFilteredEFEProjects = filtered;

    // Update investment panel if currently open
    if (efeState.investmentOpen && typeof renderEfeInvestmentAnalytics === 'function') {
        renderEfeInvestmentAnalytics(filtered);
    }

    // Update timeline panel if currently open
    if (efeState.timelineOpen && typeof renderEfeTimeline === 'function') {
        renderEfeTimeline(filtered);
    }

    efeUpdateMapBadge(filtered.length, totalAll);
}

function efeGetFilteredProjects() {
    return (currentFilteredEFEProjects && currentFilteredEFEProjects.length > 0)
        ? currentFilteredEFEProjects
        : ((window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : []);
}

/**
 * Exporta la base de datos de proyectos ferroviarios EFE a Excel (.xlsx)
 * con todas las columnas originales y resumen de métricas.
 */
function exportEFEToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('La librería SheetJS (XLSX) no se encuentra disponible.');
        return;
    }

    const projects = (currentFilteredEFEProjects && currentFilteredEFEProjects.length > 0)
        ? currentFilteredEFEProjects
        : ((window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : []);

    if (!projects || projects.length === 0) {
        alert('No hay proyectos de EFE para exportar con los filtros seleccionados.');
        return;
    }

    const dataRows = projects.map(p => ({
        "Nombre del Proyecto": p.name || '',
        "Filial EFE": p.filial || 'Sin filial específica',
        "Detalle / Cartera": typeof efeGetDetailCategory === 'function' ? efeGetDetailCategory(p.detail) : (p.detail || ''),
        "Tipo": p.type || '',
        "Etapa": p.stage || '',
        "Inversión Estimada (MM USD)": p.investment_mm_usd != null ? p.investment_mm_usd : '',
        "Operación Estimada": p.operation_year || '',
        "% Avance Etapa": p.progress || '',
        "Fuente": p.source || '',
        "Descripción": p.description || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);

    if (dataRows.length > 0) {
        const colKeys = Object.keys(dataRows[0]);
        ws['!cols'] = colKeys.map(key => {
            let maxLen = key.length;
            for (let i = 0; i < Math.min(dataRows.length, 30); i++) {
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
    XLSX.utils.book_append_sheet(wb, ws, "Proyectos_EFE");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `CATLEC_EFE_Proyectos_${today}.xlsx`);
}

