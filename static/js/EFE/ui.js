// ─── EFE UI Module ───────────────────────────────────────────────────────────

function efeDebounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function efeFormatFilialCell(filialStr) {
    if (!filialStr || String(filialStr).trim() === '' || String(filialStr).trim().toLowerCase() === 'nan' || String(filialStr).trim().toLowerCase() === 'null') {
        return '<span style="color:var(--text-muted);font-style:italic;font-size:0.75rem;">Sin filial específica</span>';
    }
    const str = String(filialStr).trim();
    return `<span style="font-size:0.75rem; font-weight:600; color:var(--text-primary);">${str}</span>`;
}

function efeFormatStageCell(stageStr) {
    if (!stageStr || String(stageStr).trim() === '' || String(stageStr).trim().toLowerCase() === 'nan' || String(stageStr).trim().toLowerCase() === 'null') {
        return '<span style="color:var(--text-muted);font-style:italic;font-size:0.75rem;">—</span>';
    }
    const str = String(stageStr).trim();
    return `<span style="font-size:0.75rem; color:var(--text-primary); font-weight:500;" title="${str}">${str}</span>`;
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
            <td style="width: 38%;"><strong>${proj.name || 'Sin nombre'}</strong></td>
            <td style="width: 22%;">${efeFormatFilialCell(proj.filial)}</td>
            <td style="width: 20%; text-align: right;"><span style="font-weight: 700; color: var(--primary); font-variant-numeric: tabular-nums;">${efeFormatInvestment(proj.investment_mm_usd)}</span></td>
            <td style="width: 20%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${efeFormatStageCell(proj.stage)}</td>
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
        'EFE Arica - La Paz': '#059669'
    };
    const hasFilial = proj.filial && String(proj.filial).trim() !== '' && String(proj.filial).trim().toLowerCase() !== 'nan';
    const filialColor = hasFilial ? (filialColors[proj.filial] || '#3b82f6') : 'var(--text-muted)';
    const subtitleText = hasFilial ? `Filial ${proj.filial}` : 'Sin filial específica';

    const badgeClass = proj.filial === 'EFE Sur' ? 'badge-warning' : (proj.filial === 'EFE Valparaíso' ? 'badge-info' : (proj.filial === 'EFE Central' ? 'badge-info' : (proj.filial === 'EFE Arica - La Paz' ? 'badge-success' : 'badge-neutral')));
    const badgeText = hasFilial ? proj.filial : 'Sin filial';

    const invText = (proj.investment_mm_usd != null && !isNaN(proj.investment_mm_usd) && Number(proj.investment_mm_usd) > 0)
        ? efeFormatInvestment(proj.investment_mm_usd)
        : 'No informada';

    // Progress display
    let progressDisplay = '—';
    if (proj.progress != null) {
        const pv = Number(proj.progress);
        if (!isNaN(pv)) {
            progressDisplay = pv <= 1 ? `${Math.round(pv * 100)}%` : `${pv}%`;
        } else {
            progressDisplay = String(proj.progress);
        }
    }

    const linkSource = hasSource ? `
        <div class="detail-actions" style="margin-top: 0.5rem; gap: 0.4rem;">
            <a href="${String(rawSource).trim()}" target="_blank" class="btn-action-link" style="font-size: 0.72rem; padding: 0.3rem 0.6rem;">
                <i data-lucide="globe"></i> Web EFE Proyectos
            </a>
        </div>
    ` : '';

    // Renderizado de fotografía(s) asociada(s) desde Fotos/EFE (después de la descripción y antes de los datos)
    let photoHTML = '';
    const photosList = proj.photos && proj.photos.length > 0 ? proj.photos : (proj.photo ? [proj.photo] : []);
    if (photosList.length === 1) {
        const encodedUrl = encodeURI(photosList[0]);
        photoHTML = `
        <div class="detail-photo-wrapper">
            <img src="${encodedUrl}" alt="${proj.name}" class="detail-project-photo" onerror="this.parentElement.style.display='none'">
            <div class="detail-photo-caption">Fuente: EFE</div>
        </div>
        `;
    } else if (photosList.length > 1) {
        photoHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem;">
            ${photosList.map((pUrl, pIdx) => {
                const enc = encodeURI(pUrl);
                return `
                <div class="detail-photo-wrapper" style="margin: 0;">
                    <img src="${enc}" alt="${proj.name} - Foto ${pIdx + 1}" class="detail-project-photo" onerror="this.parentElement.style.display='none'">
                    <div class="detail-photo-caption">Fuente: EFE (${pIdx + 1}/${photosList.length})</div>
                </div>
                `;
            }).join('')}
        </div>
        `;
    }

    efeDetailViewBody.innerHTML = `
        <!-- 1. Nombre y Cabecera del Proyecto -->
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.1rem;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
                <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); line-height: 1.35; font-family: var(--font-heading); flex: 1; min-width: 0;">${proj.name}</h3>
                <span class="badge ${badgeClass}" style="flex-shrink: 0; font-size: 0.7rem; padding: 0.2rem 0.5rem; white-space: nowrap; margin-top: 2px;">${badgeText}</span>
            </div>
            <div style="font-size: 0.75rem; color: ${filialColor}; font-weight: 600; margin-top: 0.25rem;">${subtitleText}</div>
        </div>

        <!-- 2. Descripción del Proyecto -->
        <div class="detail-section">
            <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.35rem;">Descripción</h4>
            <p class="detail-desc" style="font-size: 0.76rem; line-height: 1.45; white-space: pre-wrap;">${descContent}</p>
        </div>

        <!-- 3. Foto del Proyecto -->
        ${photoHTML}

        <!-- 4. Datos del Proyecto -->
        <div class="detail-section">
            <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.4rem;">Datos del Proyecto</h4>
            <div class="detail-grid" style="grid-template-columns: 120px 1fr; gap: 0.3rem; font-size: 0.74rem;">
                <span class="detail-label">Filial:</span>
                <span class="detail-value">${hasFilial ? proj.filial : 'Sin filial específica'}</span>

                <span class="detail-label">Tipo:</span>
                <span class="detail-value" style="display:flex; align-items:center; gap:0.35rem;">
                    <span style="display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:3px; background:rgba(37,99,235,0.08); color:var(--primary); flex-shrink:0;">
                        ${typeof efeGetProjectTypeSvg === 'function' ? efeGetProjectTypeSvg(proj.type, 12, 12, 'currentColor') : ''}
                    </span>
                    <strong>${proj.type || '—'}</strong>
                </span>

                <span class="detail-label">Etapa:</span>
                <span class="detail-value">${proj.stage || '—'}</span>

                <span class="detail-label">Inversión (MM USD):</span>
                <span class="detail-value"><strong>${invText}</strong></span>

                <span class="detail-label">Operación estimada:</span>
                <span class="detail-value">${proj.operation_year || '—'}</span>

                <span class="detail-label">Avance etapa:</span>
                <span class="detail-value">${progressDisplay}</span>

                <span class="detail-label">Fuente:</span>
                <span class="detail-value">${proj.source || '—'}</span>
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
            efeState.selectedFiliales = [];
            efeState.selectedDetails = [];
            efeState.selectedTipos = [];
            efeState.selectedProjectName = null;
            efeState.hoveredProjectName = null;
            efeState.sortBy = 'investment_mm_usd';
            efeState.sortOrder = 'desc';
            efeState.page = 1;

            document.querySelectorAll('.data-table th.sortable').forEach(el => {
                el.classList.remove('asc', 'desc');
                if (el.getAttribute('data-sort') === efeState.sortBy) {
                    el.classList.add(efeState.sortOrder);
                }
            });

            document.querySelectorAll('.efe-filial-checkbox').forEach(cb => cb.checked = false);
            if (efeFilialCheckAll) efeFilialCheckAll.checked = false;
            if (efeFilialMultiselectText) efeFilialMultiselectText.textContent = 'Todas las filiales';

            document.querySelectorAll('.efe-detail-checkbox').forEach(cb => cb.checked = false);
            if (efeDetailCheckAll) efeDetailCheckAll.checked = false;
            if (efeDetailMultiselectText) efeDetailMultiselectText.textContent = 'Todo el portafolio';

            document.querySelectorAll('.efe-tipo-checkbox').forEach(cb => cb.checked = false);
            if (efeTipoCheckAll) efeTipoCheckAll.checked = false;
            if (efeTipoMultiselectText) efeTipoMultiselectText.textContent = 'Todos los tipos';

            efeShowTableListView();
            efeFetchData();
            if (typeof efeUpdateMapStyles === 'function') efeUpdateMapStyles();
        });
    }

    // Export to Excel & GeoJSON
    const efeBtnExportExcel = document.getElementById('efe-btn-export-excel');
    if (efeBtnExportExcel) {
        efeBtnExportExcel.addEventListener('click', () => {
            if (typeof exportEFEToExcel === 'function') {
                exportEFEToExcel();
            }
        });
    }

    const efeBtnExportGeoJSON = document.getElementById('efe-btn-export-geojson');
    if (efeBtnExportGeoJSON) {
        efeBtnExportGeoJSON.addEventListener('click', () => {
            if (typeof exportEFEToGeoJSON === 'function') {
                exportEFEToGeoJSON();
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
