// ─── EFE UI Module ───────────────────────────────────────────────────────────

function efeDebounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function efeRenderTable(projects) {
    const selectedName = efeState.selectedProjectName;
    const allProjects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
    const selectedProj = selectedName ? allProjects.find(p => p.name === selectedName) : null;

    if (selectedProj) {
        // Replace table with full project detail view card
        efeShowProjectDetailView(selectedProj, projects);
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
    projects.forEach(proj => {
        const tr = document.createElement('tr');
        tr.className = 'efe-table-row';
        tr.innerHTML = `
            <td class="efe-td efe-td-name" title="${proj.name || ''}">${proj.name || '—'}</td>
            <td class="efe-td efe-td-region">${proj.region || '<span style="color:var(--text-muted);font-style:italic">Sin región</span>'}</td>
            <td class="efe-td efe-td-inv">${efeFormatUSD(proj.investment_usd)}</td>
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
    if (efeProjectDetailView) efeProjectDetailView.style.display = 'flex';

    if (!efeDetailViewBody) return;

    const rawDesc = proj.description;
    const hasDesc = rawDesc && String(rawDesc).trim() !== '' && String(rawDesc).trim().toLowerCase() !== 'none';
    const descContent = hasDesc
        ? String(rawDesc).trim()
        : '<span style="color:var(--text-muted);font-style:italic">No se registra</span>';

    const rawSource = proj.source;
    const hasSource = rawSource && String(rawSource).trim() !== '' && String(rawSource).trim().toLowerCase() !== 'none';

    efeDetailViewBody.innerHTML = `
        <!-- Title & Subtitle Card -->
        <div style="background: rgba(22, 163, 74, 0.08); border: 1px solid rgba(22, 163, 74, 0.25); border-radius: 8px; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; flex-shrink: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                <span class="badge" style="background: #16a34a; color: white; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;">
                    <i data-lucide="train-front" style="width: 12px; height: 12px;"></i> Proyecto EFE
                </span>
                <span style="font-size: 0.7rem; color: var(--text-muted);">COD Shapes: <strong>${(proj.shapes || []).join(', ') || 'N/A'}</strong></span>
            </div>
            <h3 style="font-size: 0.92rem; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.35;">${proj.name}</h3>
        </div>

        <!-- Meta Details Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; flex-shrink: 0;">
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.55rem 0.7rem; display: flex; flex-direction: column; gap: 0.15rem;">
                <span style="font-size: 0.66rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.04em;">Región</span>
                <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-primary);">${proj.region || 'Sin información'}</span>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.55rem 0.7rem; display: flex; flex-direction: column; gap: 0.15rem;">
                <span style="font-size: 0.66rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.04em;">Inversión (USD)</span>
                <span style="font-size: 0.78rem; font-weight: 700; color: #4ade80;">${efeFormatUSD(proj.investment_usd)}</span>
            </div>
        </div>

        <!-- Description Card -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; flex: 1; min-height: 0; overflow: hidden;">
            <div style="font-size: 0.72rem; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.35rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.35rem; flex-shrink: 0;">
                <i data-lucide="file-text" style="width: 13px; height: 13px;"></i> Descripción del Proyecto
            </div>
            <div style="font-size: 0.76rem; color: var(--text-primary); line-height: 1.5; white-space: pre-wrap; overflow-y: auto; flex: 1; padding-right: 0.2rem;">${descContent}</div>
        </div>

        <!-- Source Footer Card (if present) -->
        ${hasSource ? `
        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.45rem 0.65rem; display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; color: var(--text-secondary); flex-shrink: 0;">
            <i data-lucide="info" style="width: 12px; height: 12px; color: var(--text-muted); flex-shrink: 0;"></i>
            <span>Fuente: <strong>${String(rawSource).trim()}</strong></span>
        </div>` : ''}
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
        efeBtnDetailPrev.onclick = (e) => {
            e.stopPropagation();
            efeSelectProject(list[idx - 1]);
        };
    } else {
        efeBtnDetailPrev.disabled = true;
        efeBtnDetailPrev.style.opacity = '0.35';
        efeBtnDetailPrev.style.cursor = 'not-allowed';
        efeBtnDetailPrev.onclick = null;
    }

    if (idx >= 0 && idx < list.length - 1) {
        efeBtnDetailNext.disabled = false;
        efeBtnDetailNext.style.opacity = '1';
        efeBtnDetailNext.style.cursor = 'pointer';
        efeBtnDetailNext.onclick = (e) => {
            e.stopPropagation();
            efeSelectProject(list[idx + 1]);
        };
    } else {
        efeBtnDetailNext.disabled = true;
        efeBtnDetailNext.style.opacity = '0.35';
        efeBtnDetailNext.style.cursor = 'not-allowed';
        efeBtnDetailNext.onclick = null;
    }
}

function efeUpdatePagination(page, totalPages, totalFiltered) {
    if (efePaginationInfo) {
        efePaginationInfo.textContent = `Página ${page} de ${totalPages} (${totalFiltered} proyectos)`;
    }
    if (efeBtnPrev) efeBtnPrev.disabled = page <= 1;
    if (efeBtnNext) efeBtnNext.disabled = page >= totalPages;
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
            efeState.selectedProjectName = null;
            efeState.hoveredProjectName = null;
            efeState.page = 1;
            document.querySelectorAll('.efe-region-checkbox').forEach(cb => cb.checked = false);
            if (efeRegionCheckAll) efeRegionCheckAll.checked = false;
            if (efeRegionMultiselectText) efeRegionMultiselectText.textContent = 'Todas las regiones';
            efeFetchData();
            if (typeof efeUpdateMapStyles === 'function') efeUpdateMapStyles();
        });
    }

    // Reset map
    if (efeBtnResetMap) {
        efeBtnResetMap.addEventListener('click', () => {
            efeResetMap();
        });
    }
});
