// ─── EFE UI Module ───────────────────────────────────────────────────────────

function efeDebounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function efeFormatRegionCell(regionStr) {
    if (!regionStr || String(regionStr).trim() === '' || String(regionStr).trim() === 'N/A') {
        return '<span style="color:var(--text-muted);font-style:italic">Sin región</span>';
    }
    const str = String(regionStr).trim();
    if (str.toLowerCase().includes('nacional')) {
        return '<span class="region-pill">Nacional</span>';
    }

    const parts = str.split(/[;,/\n]+/).map(p => shortenRegionName(p.trim())).filter(p => p.length > 0);
    if (parts.length > 1) {
        return `<div class="region-pills-wrap">${parts.map(p => `<span class="region-pill">${p}</span>`).join('')}</div>`;
    }

    return `<span>${shortenRegionName(str)}</span>`;
}

function efeRenderTable(projects) {
    const selectedName = efeState.selectedProjectName;
    const allProjects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
    const selectedProj = selectedName ? allProjects.find(p => p.name === selectedName) : null;

    if (selectedProj) {
        // Replace table with full project detail view card
        efeShowProjectDetailView(selectedProj, currentFilteredEFEProjects);
        return;
    }

    // Show table view list
    efeShowTableListView();

    if (!efeTableBody) return;

    if (!projects || projects.length === 0) {
        efeTableBody.innerHTML = '';
        if (efeEmptyState) efeEmptyState.style.display = 'flex';
        return;
    }
    if (efeEmptyState) efeEmptyState.style.display = 'none';

    efeTableBody.innerHTML = '';
    projects.forEach((proj, index) => {
        const tr = document.createElement('tr');
        tr.className = 'row-main';
        tr.id = `efe-row-${index}`;
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
            <td><strong>${proj.name || 'Sin nombre'}</strong></td>
            <td>${efeFormatRegionCell(proj.region)}</td>
            <td style="text-align: right;"><span style="font-weight: 700; color: var(--primary); font-variant-numeric: tabular-nums;">${efeFormatUSD(proj.investment_usd)}</span></td>
        `;

        // Select project on click
        tr.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof efeSelectProject === 'function') {
                efeSelectProject(proj);
            }
        });

        // Hover highlight
        tr.addEventListener('mouseenter', () => {
            efeState.hoveredProjectName = proj.name;
            if (typeof efeUpdateMapStyles === 'function') efeUpdateMapStyles();
        });
        tr.addEventListener('mouseleave', () => {
            efeState.hoveredProjectName = null;
            if (typeof efeUpdateMapStyles === 'function') efeUpdateMapStyles();
        });

        efeTableBody.appendChild(tr);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function efeShowTableListView() {
    if (efeProjectDetailView) efeProjectDetailView.style.display = 'none';
    if (efeTableContainerView) efeTableContainerView.style.display = 'flex';
}

function efeShowProjectDetailView(proj, currentFilteredProjects) {
    if (!proj) {
        efeShowTableListView();
        return;
    }

    if (efeTableContainerView) efeTableContainerView.style.display = 'none';
    if (efeProjectDetailView) {
        efeProjectDetailView.style.display = 'flex';
        efeProjectDetailView.scrollTop = 0;
    }

    if (!efeDetailViewBody) return;
    efeDetailViewBody.scrollTop = 0;

    const rawDesc = proj.description;
    const hasDesc = rawDesc && String(rawDesc).trim() !== '' && String(rawDesc).trim().toLowerCase() !== 'none';
    const descContent = hasDesc
        ? String(rawDesc).trim()
        : 'No se registra descripción en la base de datos para este proyecto.';

    const rawSource = proj.source;
    const hasSource = rawSource && String(rawSource).trim() !== '' && String(rawSource).trim().toLowerCase() !== 'none';

    const filialColors = {
        'EFE Valparaíso': '#0284c7',
        'EFE Central': '#2563eb',
        'EFE Sur': '#d97706',
        'Nacional': '#8b5cf6'
    };
    const filialColor = filialColors[proj.filial] || '#3b82f6';
    const subtitleText = proj.filial ? `Filial ${proj.filial}` : 'Red Ferroviaria Nacional (EFE Matriz)';

    const badgeClass = proj.filial === 'EFE Sur' ? 'badge-warning' : (proj.filial === 'EFE Valparaíso' ? 'badge-info' : (proj.filial === 'EFE Central' ? 'badge-info' : 'badge-neutral'));
    const badgeText = proj.filial || 'Nacional';

    const invText = (proj.investment_usd != null && !isNaN(proj.investment_usd) && Number(proj.investment_usd) > 0)
        ? efeFormatUSD(proj.investment_usd)
        : 'No informada';

    // Región formateada
    let regionPillsHTML = '';
    const regStr = proj.region ? String(proj.region).trim() : 'Nacional';
    if (regStr.toLowerCase().includes('nacional') || !regStr) {
        regionPillsHTML = `<span class="region-pill region-pill-nacional">Nacional</span>`;
    } else {
        const parts = regStr.split(/[;,/\n]+/).map(r => shortenRegionName(r.trim())).filter(Boolean);
        regionPillsHTML = `<div class="region-pills-wrap">${parts.map(r => `<span class="region-pill">${r}</span>`).join('')}</div>`;
    }

    const linkSource = hasSource ? `
        <div class="detail-actions" style="margin-top: 0.5rem; gap: 0.4rem;">
            <a href="${String(rawSource).trim()}" target="_blank" class="btn-action-link" style="font-size: 0.72rem; padding: 0.3rem 0.6rem;">
                <i data-lucide="globe" style="width: 13px; height: 13px;"></i> Web EFE Proyectos
            </a>
        </div>
    ` : '';

    efeDetailViewBody.innerHTML = `
        <!-- 1. Nombre y Cabecera del Proyecto (Idéntico a index.html) -->
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.1rem;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
                <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); line-height: 1.35; font-family: var(--font-heading); flex: 1; min-width: 0;">${proj.name}</h3>
                <span class="badge ${badgeClass}" style="flex-shrink: 0; font-size: 0.7rem; padding: 0.2rem 0.5rem; white-space: nowrap; margin-top: 2px;">${badgeText}</span>
            </div>
            <div style="font-size: 0.75rem; color: ${filialColor}; font-weight: 600; margin-top: 0.25rem;">${subtitleText}</div>
        </div>

        <!-- 2. Descripción del Proyecto (Segundo) -->
        <div class="detail-section">
            <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.35rem;">Descripción</h4>
            <p class="detail-desc" style="font-size: 0.76rem; line-height: 1.45; white-space: pre-wrap;">${descContent}</p>
        </div>

        <!-- 3. Datos del Proyecto (Al final) -->
        <div class="detail-section">
            <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.4rem;">Datos del Proyecto</h4>
            <div class="detail-grid" style="grid-template-columns: 110px 1fr; gap: 0.3rem; font-size: 0.74rem;">
                <span class="detail-label">Filial:</span>
                <span class="detail-value">${proj.filial || 'Nacional (EFE Matriz)'}</span>

                <span class="detail-label">Región:</span>
                <span class="detail-value">${regionPillsHTML}</span>

                <span class="detail-label">Inversión (USD):</span>
                <span class="detail-value"><strong>${invText}</strong></span>
            </div>
        </div>

        ${linkSource}
    `;

    efeUpdateDetailNavButtons(proj.name, currentFilteredProjects);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function efeUpdateDetailNavButtons(currentProjName, currentFilteredProjects) {
    if (!efeBtnDetailPrev || !efeBtnDetailNext) return;

    const list = (currentFilteredProjects && currentFilteredProjects.length > 0)
        ? currentFilteredProjects
        : ((window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : []);

    const idx = list.findIndex(p => p.name === currentProjName);

    if (idx > 0) {
        efeBtnDetailPrev.disabled = false;
        efeBtnDetailPrev.style.opacity = '1';
        efeBtnDetailPrev.style.cursor = 'pointer';
        efeBtnDetailPrev.style.pointerEvents = 'auto';
        efeBtnDetailPrev.onclick = (e) => {
            e.stopPropagation();
            efeSelectProject(list[idx - 1]);
        };
    } else {
        efeBtnDetailPrev.disabled = true;
        efeBtnDetailPrev.style.opacity = '0.35';
        efeBtnDetailPrev.style.cursor = 'not-allowed';
        efeBtnDetailPrev.style.pointerEvents = 'none';
        efeBtnDetailPrev.onclick = null;
    }

    if (idx >= 0 && idx < list.length - 1) {
        efeBtnDetailNext.disabled = false;
        efeBtnDetailNext.style.opacity = '1';
        efeBtnDetailNext.style.cursor = 'pointer';
        efeBtnDetailNext.style.pointerEvents = 'auto';
        efeBtnDetailNext.onclick = (e) => {
            e.stopPropagation();
            efeSelectProject(list[idx + 1]);
        };
    } else {
        efeBtnDetailNext.disabled = true;
        efeBtnDetailNext.style.opacity = '0.35';
        efeBtnDetailNext.style.cursor = 'not-allowed';
        efeBtnDetailNext.style.pointerEvents = 'none';
        efeBtnDetailNext.onclick = null;
    }
}

function efeUpdatePagination(page, totalPages, totalFiltered) {
    const pageSize = efeState.pageSize || 50;
    const start = totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalFiltered);
    if (efePaginationInfo) {
        efePaginationInfo.textContent = `${start}-${end} de ${totalFiltered}`;
    }
    if (efeBtnPrev) efeBtnPrev.disabled = (page <= 1);
    if (efeBtnNext) efeBtnNext.disabled = (page >= totalPages || totalFiltered === 0);
}

// ─── DOMContentLoaded ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    efeInitDOMReferences();
    if (typeof efeLoadFilters === 'function') efeLoadFilters();
    if (typeof efeInitLeafletMap === 'function') efeInitLeafletMap();
    if (typeof efeFetchData === 'function') efeFetchData();

    // Back to table list view
    if (efeBtnBackToTable) {
        efeBtnBackToTable.addEventListener('click', () => {
            if (typeof efeSelectProject === 'function') {
                efeSelectProject(null);
            }
        });
    }

    // Pagination buttons
    if (efeBtnPrev) {
        efeBtnPrev.addEventListener('click', () => {
            if (efeState.page > 1) {
                efeState.page--;
                efeFetchData();
            }
        });
    }
    if (efeBtnNext) {
        efeBtnNext.addEventListener('click', () => {
            efeState.page++;
            efeFetchData();
        });
    }

    // Search
    if (efeSearchInput) {
        efeSearchInput.addEventListener('input', efeDebounce(() => {
            efeState.search = efeSearchInput.value;
            efeState.page = 1;
            efeFetchData();
        }, 300));
    }

    // Reset filters
    if (efeBtnReset) {
        efeBtnReset.addEventListener('click', () => {
            if (efeSearchInput) efeSearchInput.value = '';
            efeState.search = '';
            efeState.selectedRegions = [];
            efeState.selectedFiliales = [];
            efeState.selectedProjectName = null;
            efeState.hoveredProjectName = null;
            efeState.sortBy = 'name';
            efeState.sortOrder = 'asc';
            efeState.page = 1;

            document.querySelectorAll('.data-table th.sortable').forEach(el => {
                el.classList.remove('asc', 'desc');
                if (el.getAttribute('data-sort') === efeState.sortBy) {
                    el.classList.add(efeState.sortOrder);
                }
            });

            document.querySelectorAll('.efe-region-checkbox').forEach(cb => cb.checked = false);
            if (efeRegionCheckAll) efeRegionCheckAll.checked = false;
            if (efeRegionMultiselectText) efeRegionMultiselectText.textContent = 'Todas las regiones';

            document.querySelectorAll('.efe-filial-checkbox').forEach(cb => cb.checked = false);
            if (efeFilialCheckAll) efeFilialCheckAll.checked = false;
            if (efeFilialMultiselectText) efeFilialMultiselectText.textContent = 'Todas las filiales';

            efeShowTableListView();
            efeFetchData();
            if (typeof efeUpdateMapStyles === 'function') efeUpdateMapStyles();
        });
    }

    // Export to Excel
    const efeBtnExportExcel = document.getElementById('efe-btn-export-excel');
    if (efeBtnExportExcel) {
        efeBtnExportExcel.addEventListener('click', () => {
            if (typeof exportEFEToExcel === 'function') {
                exportEFEToExcel();
            }
        });
    }

    // Reset map
    if (efeBtnResetMap) {
        efeBtnResetMap.addEventListener('click', () => {
            efeResetMap();
        });
    }
});
