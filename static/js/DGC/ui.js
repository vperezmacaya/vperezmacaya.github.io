function setActiveSubheaderTab(activeId) {
    const btnMap = document.getElementById('btn-view-map');
    const btnTl  = document.getElementById('btn-view-timeline');
    const btnInv = document.getElementById('btn-view-investment');
    const btnCnt = document.getElementById('btn-view-contracts');
    const btnBid = document.getElementById('btn-view-bidders');
    if (btnMap) btnMap.classList.toggle('active', activeId === 'map');
    if (btnTl)  btnTl.classList.toggle('active', activeId === 'timeline');
    if (btnInv) btnInv.classList.toggle('active', activeId === 'investment');
    if (btnCnt) btnCnt.classList.toggle('active', activeId === 'contracts');
    if (btnBid) btnBid.classList.toggle('active', activeId === 'bidders');
}

function initSubheaderViewSwitcher() {
    const btnMap = document.getElementById('btn-view-map');
    const btnTl  = document.getElementById('btn-view-timeline');
    const btnInv = document.getElementById('btn-view-investment');
    const btnCnt = document.getElementById('btn-view-contracts');
    const btnBid = document.getElementById('btn-view-bidders');

    if (btnMap) {
        btnMap.addEventListener('click', () => {
            if (typeof hideTimelineView === 'function') hideTimelineView();
            if (typeof hideInvestmentView === 'function') hideInvestmentView();
            if (typeof hideContractsView === 'function') hideContractsView();
            if (typeof hideBiddersView === 'function') hideBiddersView();
            setActiveSubheaderTab('map');
        });
    }

    if (btnTl) {
        btnTl.addEventListener('click', () => {
            if (typeof hideInvestmentView === 'function') hideInvestmentView();
            if (typeof hideContractsView === 'function') hideContractsView();
            if (typeof hideBiddersView === 'function') hideBiddersView();
            if (typeof showTimelineView === 'function') showTimelineView();
            setActiveSubheaderTab('timeline');
        });
    }

    if (btnInv) {
        btnInv.addEventListener('click', () => {
            if (typeof hideTimelineView === 'function') hideTimelineView();
            if (typeof hideContractsView === 'function') hideContractsView();
            if (typeof hideBiddersView === 'function') hideBiddersView();
            if (typeof showInvestmentView === 'function') showInvestmentView();
            setActiveSubheaderTab('investment');
        });
    }

    if (btnCnt) {
        btnCnt.addEventListener('click', () => {
            if (typeof hideTimelineView === 'function') hideTimelineView();
            if (typeof hideInvestmentView === 'function') hideInvestmentView();
            if (typeof hideBiddersView === 'function') hideBiddersView();
            if (typeof showContractsView === 'function') showContractsView();
            setActiveSubheaderTab('contracts');
        });
    }

    if (btnBid) {
        btnBid.addEventListener('click', () => {
            if (typeof hideTimelineView === 'function') hideTimelineView();
            if (typeof hideInvestmentView === 'function') hideInvestmentView();
            if (typeof hideContractsView === 'function') hideContractsView();
            if (typeof showBiddersView === 'function') showBiddersView();
            setActiveSubheaderTab('bidders');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initDOMReferences();
    initSubheaderViewSwitcher();

    if (btnBackToList) {
        btnBackToList.addEventListener('click', () => {
            showTableListView();
            appState.selectedProjectCode = null;
            updateMapStyles();
            if (leafletMap) leafletMap.closePopup();
        });
    }

    // Region Multi-Select Handlers
    if (regionMultiselectBtn && regionMultiselectDropdown) {
        regionMultiselectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sectorMultiselectDropdown) sectorMultiselectDropdown.style.display = 'none';
            const isVisible = regionMultiselectDropdown.style.display === 'flex';
            regionMultiselectDropdown.style.display = isVisible ? 'none' : 'flex';
        });
    }

    if (regionCheckAll) {
        regionCheckAll.addEventListener('change', () => {
            const isChecked = regionCheckAll.checked;
            document.querySelectorAll('.region-checkbox').forEach(cb => {
                cb.checked = isChecked;
            });
            updateSelectedRegions();
        });
    }

    // Sector Multi-Select Handlers
    if (sectorMultiselectBtn && sectorMultiselectDropdown) {
        sectorMultiselectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (regionMultiselectDropdown) regionMultiselectDropdown.style.display = 'none';
            if (statusMultiselectDropdown) statusMultiselectDropdown.style.display = 'none';
            const isVisible = sectorMultiselectDropdown.style.display === 'flex';
            sectorMultiselectDropdown.style.display = isVisible ? 'none' : 'flex';
        });
    }

    if (sectorCheckAll) {
        sectorCheckAll.addEventListener('change', () => {
            const isChecked = sectorCheckAll.checked;
            document.querySelectorAll('.sector-checkbox').forEach(cb => {
                cb.checked = isChecked;
            });
            updateSelectedSectors();
        });
    }

    // Status Multi-Select Handlers
    if (statusMultiselectBtn && statusMultiselectDropdown) {
        statusMultiselectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (regionMultiselectDropdown) regionMultiselectDropdown.style.display = 'none';
            if (sectorMultiselectDropdown) sectorMultiselectDropdown.style.display = 'none';
            const isVisible = statusMultiselectDropdown.style.display === 'flex';
            statusMultiselectDropdown.style.display = isVisible ? 'none' : 'flex';
        });
    }

    if (statusCheckAll) {
        statusCheckAll.addEventListener('change', () => {
            const isChecked = statusCheckAll.checked;
            document.querySelectorAll('.status-checkbox').forEach(cb => {
                cb.checked = isChecked;
            });
            updateSelectedStatuses();
        });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (regionMultiselectContainer && !regionMultiselectContainer.contains(e.target)) {
            if (regionMultiselectDropdown) regionMultiselectDropdown.style.display = 'none';
        }
        if (sectorMultiselectContainer && !sectorMultiselectContainer.contains(e.target)) {
            if (sectorMultiselectDropdown) sectorMultiselectDropdown.style.display = 'none';
        }
        if (statusMultiselectContainer && !statusMultiselectContainer.contains(e.target)) {
            if (statusMultiselectDropdown) statusMultiselectDropdown.style.display = 'none';
        }
    });

    // Load initial filters and initial data load
    loadFilters().then(() => {
        fetchData();
    });

    // Bind search filter
    searchInput.addEventListener('input', debounce(() => {
        appState.search = searchInput.value;
        appState.page = 1;
        fetchData();
    }, 300));

    btnReset.addEventListener('click', () => {
        searchInput.value = '';
        appState.search = '';
        appState.selectedRegions = [];
        appState.selectedSectors = [];
        appState.selectedStatuses = [];
        appState.selectedProjectCode = null;
        appState.sortBy = 'Fecha inicio del contrato de concesión';
        appState.sortOrder = 'desc';

        document.querySelectorAll('.data-table th.sortable').forEach(el => {
            el.classList.remove('asc', 'desc');
            if (el.getAttribute('data-sort') === appState.sortBy) {
                el.classList.add(appState.sortOrder);
            }
        });

        document.querySelectorAll('.region-checkbox').forEach(cb => cb.checked = false);
        document.querySelectorAll('.sector-checkbox').forEach(cb => cb.checked = false);
        document.querySelectorAll('.status-checkbox').forEach(cb => cb.checked = false);
        if (regionCheckAll) regionCheckAll.checked = false;
        if (sectorCheckAll) sectorCheckAll.checked = false;
        if (statusCheckAll) statusCheckAll.checked = false;
        if (regionMultiselectText) regionMultiselectText.textContent = 'Todas las regiones';
        if (sectorMultiselectText) sectorMultiselectText.textContent = 'Todos los sectores';
        if (statusMultiselectText) statusMultiselectText.textContent = 'Todos los estados';
        if (layers.regions) layers.regions.setStyle(getRegionStyle);

        showTableListView();
        fetchData();
    });

    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            exportDGCToExcel();
        });
    }

    btnResetMap.addEventListener('click', () => {
        if (leafletMap) {
            leafletMap.setView([-37.6751, -71.5430], 4.0);
        }
        appState.selectedProjectCode = null;
        showTableListView();
        updateMapStyles();
    });

    // Bind Pagination
    btnPrev.addEventListener('click', () => {
        if (appState.page > 1) {
            appState.page--;
            fetchData();
        }
    });

    btnNext.addEventListener('click', () => {
        appState.page++;
        fetchData();
    });

    // Bind Table Sorters
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortCol = th.getAttribute('data-sort');

            if (appState.sortBy === sortCol) {
                appState.sortOrder = appState.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                appState.sortBy = sortCol;
                appState.sortOrder = 'asc';
            }

            // CSS indicators
            document.querySelectorAll('.data-table th.sortable').forEach(el => {
                el.classList.remove('asc', 'desc');
            });
            th.classList.add(appState.sortOrder);

            fetchData();
        });
    });



    // Initialize Leaflet Map
    initLeafletMap();

    // Setup initial icons
    lucide.createIcons();

    // Initialize Timeline view events
    initTimelineEvents();
    initInvestmentEvents();
    initBiddersEvents();
});

function updateDetailNavButtons(code) {
    if (!code) return;
    const cleanCode = code.toString().trim();
    const list = currentFilteredContractsList.length > 0 ? currentFilteredContractsList : Object.values(allLoadedContractsMap);
    const index = list.findIndex(c => (c['Código proyecto'] && c['Código proyecto'].toString().trim() === cleanCode) || (c.code && c.code.toString().trim() === cleanCode));

    const btnDetailPrev = document.getElementById('btn-detail-prev');
    const btnDetailNext = document.getElementById('btn-detail-next');

    if (!btnDetailPrev || !btnDetailNext) return;

    if (index > 0) {
        btnDetailPrev.disabled = false;
        btnDetailPrev.style.opacity = '1';
        btnDetailPrev.style.cursor = 'pointer';
        btnDetailPrev.style.pointerEvents = 'auto';
        const prevItem = list[index - 1];
        const prevCode = prevItem['Código proyecto'] || prevItem.code;
        btnDetailPrev.onclick = (e) => {
            e.stopPropagation();
            if (prevCode) zoomToProjectCode(prevCode);
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
        const nextItem = list[index + 1];
        const nextCode = nextItem['Código proyecto'] || nextItem.code;
        btnDetailNext.onclick = (e) => {
            e.stopPropagation();
            if (nextCode) zoomToProjectCode(nextCode);
        };
    } else {
        btnDetailNext.disabled = true;
        btnDetailNext.style.opacity = '0.35';
        btnDetailNext.style.cursor = 'not-allowed';
        btnDetailNext.style.pointerEvents = 'none';
        btnDetailNext.onclick = null;
    }
}

// Render table list elements

function formatRegionCell(regionStr) {
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

function renderTable(contracts) {
    tableBody.innerHTML = '';

    if (contracts.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }
    emptyState.style.display = 'none';

    contracts.forEach((item, index) => {
        let badgeClass = 'badge-neutral';
        const status = item['ESTADO'] || '';
        if (status === 'Operación') badgeClass = 'badge-success';
        else if (status === 'Construcción') badgeClass = 'badge-info';
        else if (status === 'Construcción y Operación') badgeClass = 'badge-warning';
        else if (status === 'En Licitación' || status.toLowerCase().includes('licitaci')) badgeClass = 'badge-licitacion';
        else if (status === 'Finalizado') badgeClass = 'badge-neutral';

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
            if (item['Código proyecto']) {
                appState.hoveredProjectCode = item['Código proyecto'].toString().trim();
                if (typeof updateMapStyles === 'function') updateMapStyles();
            }
        });

        tr.addEventListener('mouseleave', () => {
            appState.hoveredProjectCode = null;
            if (typeof updateMapStyles === 'function') updateMapStyles();
        });

        tableBody.appendChild(tr);
    });
}


function showTableListView() {
    if (projectDetailView) projectDetailView.style.display = 'none';
    if (tableContainerView) tableContainerView.style.display = 'flex';
    if (detailViewBody) detailViewBody.scrollTop = 0;
}

async function showProjectDetailView(code) {
    if (!code) return;
    const cleanCode = code.toString().trim();

    if (tableContainerView) tableContainerView.style.display = 'none';
    if (projectDetailView) {
        projectDetailView.style.display = 'flex';
        projectDetailView.scrollTop = 0;
    }
    if (detailViewBody) {
        detailViewBody.scrollTop = 0;
    }

    updateDetailNavButtons(cleanCode);

    let item = allLoadedContractsMap[cleanCode];

    // If detail is not cached or bidders missing, fetch on-demand from API
    if (!item || !item.bidders) {
        if (detailViewBody) {
            detailViewBody.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 1rem; color: var(--text-secondary); gap: 0.75rem; font-size: 0.8rem; text-align: center;">
                    <i data-lucide="loader-2" class="spin" style="width: 22px; height: 22px; color: var(--primary); animation: spin 1s linear infinite;"></i>
                    <span>Cargando detalle del proyecto...</span>
                </div>
            `;
            detailViewBody.scrollTop = 0;
            lucide.createIcons();
        }
        try {
            // VERSIÓN ESTÁTICA: buscar en datos pre-cargados
            const allData = (window.STATIC_DATA && window.STATIC_DATA.data) || [];
            const found = allData.find(r => {
                const c = r['Código proyecto'] || r['Codigo proyecto'] || '';
                return c.toString().trim() === cleanCode;
            });
            if (found) {
                item = found;
                allLoadedContractsMap[cleanCode] = item;
            }
        } catch (err) {
            console.error("Error al cargar detalle del proyecto:", err);
        }
    }

    renderProjectDetailBody(cleanCode, item);
}


function renderProjectDetailBody(cleanCode, item) {
    const sector = item ? item['Sector del proyecto'] : (projectMetadata[cleanCode] ? projectMetadata[cleanCode].sector : '');
    const status = item ? item['ESTADO'] : (projectMetadata[cleanCode] ? projectMetadata[cleanCode].status : '');
    const secCfg = getSectorConfig(sector);

    let badgeClass = 'badge-neutral';
    if (status === 'Operación') badgeClass = 'badge-success';
    else if (status === 'Construcción') badgeClass = 'badge-info';
    else if (status === 'Construcción y Operación') badgeClass = 'badge-warning';
    else if (status === 'En Licitación' || (status && status.toLowerCase().includes('licitaci'))) badgeClass = 'badge-licitacion';

    const titleName = (item && item['Nombre de uso común']) || (item && item['Nombre de la Concesión ']) || (projectMetadata[cleanCode] && projectMetadata[cleanCode].name) || 'Concesión';

    const timelineBtnHTML = `
        <div style="margin-top: 0.1rem; margin-bottom: 0.1rem;">
            <button id="btn-view-in-timeline" class="btn-action-link" style="width: 100%; justify-content: center; padding: 0.45rem 0.75rem; font-size: 0.76rem; font-weight: 600; background: linear-gradient(135deg, rgba(37,99,235,0.1), rgba(37,99,235,0.04)); border: 1px solid rgba(37,99,235,0.3); color: var(--primary); border-radius: 8px; cursor: pointer; transition: all 0.2s ease; gap: 0.4rem;">
                <i data-lucide="gantt-chart" style="width: 15px; height: 15px;"></i>
                Ver en línea de tiempo
            </button>
        </div>
    `;

    const linkCMF = item && item['Link a CMF de SC'] && item['Link a CMF de SC'] !== 'SIN' && item['Link a CMF de SC'] !== 'Sin informar'
        ? `<a href="${item['Link a CMF de SC']}" target="_blank" class="btn-action-link" style="font-size: 0.72rem; padding: 0.3rem 0.6rem;"><i data-lucide="external-link"></i> Perfil CMF</a>`
        : '';

    const linkMap = item && item['Link a mapa página web'] && item['Link a mapa página web'] !== 'SIN' && item['Link a mapa página web'] !== 'Sin informar'
        ? `<a href="${item['Link a mapa página web']}" target="_blank" class="btn-action-link" style="font-size: 0.72rem; padding: 0.3rem 0.6rem;"><i data-lucide="map-pin"></i> Ficha MOP</a>`
        : '';

    const linkMOP = item && item['Link pagina web concesiones'] && item['Link pagina web concesiones'] !== 'SIN' && item['Link pagina web concesiones'] !== 'Sin informar'
        ? `<a href="${item['Link pagina web concesiones']}" target="_blank" class="btn-action-link" style="font-size: 0.72rem; padding: 0.3rem 0.6rem;"><i data-lucide="globe"></i> Web Concesiones</a>`
        : '';

    // Street view iframe handling
    let streetViewHTML = '';
    let rawSvVal = item ? (item['streetview'] || item['StreetView'] || item['Streetview']) : '';
    if (!rawSvVal && projectMetadata[cleanCode]) {
        rawSvVal = projectMetadata[cleanCode].streetview || '';
    }
    let svUrl = rawSvVal ? String(rawSvVal).trim() : '';

    if (svUrl.includes('<iframe') && svUrl.includes('src=')) {
        const match = svUrl.match(/src=["']([^"']+)["']/);
        if (match) svUrl = match[1];
    }

    // Muestra el iframe ÚNICAMENTE si existe una URL de Street View en la columna del Excel
    if (svUrl && svUrl.startsWith('http')) {
        streetViewHTML = `
            <div class="detail-section" style="margin-top: 0.65rem;">
                <div style="position: relative; width: 100%; height: 250px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-card);">
                    <iframe
                        src="${svUrl}"
                        width="100%"
                        height="250"
                        style="border:0; display: block;"
                        allowfullscreen=""
                        loading="lazy"
                        referrerpolicy="no-referrer-when-downgrade">
                    </iframe>
                </div>
            </div>
        `;
    }

    // Build bidders HTML section (Contenedores por oferente con desglose de consorcio)
    const biddersList = (item && item.bidders) || (projectMetadata[cleanCode] && projectMetadata[cleanCode].bidders) || [];
    const isEnLicitacion = (status === 'En Licitación' || (item && item['ESTADO'] === 'En Licitación') || (status && status.toLowerCase().includes('licitaci')));

    let biddersHTML = '';
    if (biddersList && biddersList.length > 0) {
        const bidderItems = biddersList.map(b => {
            const isAwarded = b.adjudicado || (b.adjudicado_raw && b.adjudicado_raw.toUpperCase().startsWith('S'));
            const badge = isAwarded
                ? `<span class="badge badge-success" style="font-size: 0.62rem; padding: 0.1rem 0.35rem; font-weight: 600; flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.2rem;"><i data-lucide="award" style="width: 10px; height: 10px;"></i>Adjudicado</span>`
                : '';
            const empresasFmt = b.empresas
                ? b.empresas.split(';').map(s => s.trim()).filter(Boolean).join(' - ')
                : '';

            return `
                <li style="padding: 0.4rem 0.55rem; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.74rem; display: flex; align-items: flex-start; justify-content: space-between; gap: 0.45rem; margin-bottom: 0.3rem;">
                    <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
                        <span style="font-weight: 600; color: var(--text-primary); word-break: break-word; line-height: 1.35;">${b.name}</span>
                        ${empresasFmt ? `<span style="font-size: 0.65rem; color: var(--text-muted); line-height: 1.25; margin-top: 0.15rem;">${empresasFmt}</span>` : ''}
                    </div>
                    ${badge}
                </li>
            `;
        }).join('');

        biddersHTML = `
            <div class="detail-section" style="margin-top: 0.65rem;">
                <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between;">
                    <span style="display: flex; align-items: center; gap: 0.35rem;">
                        <i data-lucide="users" style="width: 14px; height: 14px; color: var(--primary);"></i>
                        Oferentes / Licitantes
                    </span>
                    <span class="badge" style="font-size: 0.68rem; background: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border-color); padding: 0.1rem 0.4rem;">${biddersList.length}</span>
                </h4>
                <ul style="list-style: none; padding: 0; margin: 0; max-height: 180px; overflow-y: auto;">
                    ${bidderItems}
                </ul>
            </div>
        `;
    } else if (isEnLicitacion) {
        biddersHTML = `
            <div class="detail-section" style="margin-top: 0.65rem;">
                <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
                    <i data-lucide="users" style="width: 14px; height: 14px; color: #a78bfa;"></i>
                    Oferentes / Licitantes
                </h4>
                <p class="detail-desc" style="font-size: 0.75rem; color: #c4b5fd; font-style: italic; background: rgba(139, 92, 246, 0.08); padding: 0.45rem 0.6rem; border-radius: 6px; border: 1px solid rgba(139, 92, 246, 0.25); display: flex; align-items: center; gap: 0.35rem;">
                    <i data-lucide="info" style="width: 13px; height: 13px; flex-shrink: 0; color: #a78bfa;"></i>
                    El proyecto se encuentra actualmente en proceso de licitación.
                </p>
            </div>
        `;
    } else {
        biddersHTML = `
            <div class="detail-section" style="margin-top: 0.65rem;">
                <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
                    <i data-lucide="users" style="width: 14px; height: 14px; color: var(--text-muted);"></i>
                    Oferentes / Licitantes
                </h4>
                <p class="detail-desc" style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; background: rgba(255, 255, 255, 0.02); padding: 0.4rem 0.5rem; border-radius: 6px; border: 1px dashed var(--border-color);">No se registran licitantes en la base de datos para este proyecto.</p>
            </div>
        `;
    }

    // Build relicitation navigation bar (shown only when group has > 1 concession)
    let relicitNavHTML = '';
    const groupNodes = (item && item.group_timeline) ? item.group_timeline : [];
    // Sort by seq ascending (1=primera, 2=segunda, ...)
    const sortedNodes = [...groupNodes].sort((a, b) => a.seq - b.seq);
    if (sortedNodes.length > 1) {
        const currentSeq = sortedNodes.find(n => n.code === cleanCode);
        const currentIdx = sortedNodes.indexOf(currentSeq);
        const prevNode = currentIdx > 0 ? sortedNodes[currentIdx - 1] : null;
        const nextNode = currentIdx < sortedNodes.length - 1 ? sortedNodes[currentIdx + 1] : null;

        const seqWords = ['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta', 'Séptima', 'Octava'];
        const seqLabel = (seq) => (seqWords[seq - 1] || `N°${seq}`) + ' Licitación';

        const pills = sortedNodes.map((node, idx) => {
            const isActive = node.code === cleanCode;
            const statusColors = {
                'Operación': '#059669',
                'Construcción': '#0284c7',
                'Construcción y Operación': '#d97706',
                'En Licitación': '#8b5cf6'
            };
            const dotColor = statusColors[node.status] || '#64748b';
            return `<button
                onclick="zoomToProjectCode('${node.code}')"
                title="${seqLabel(node.seq)}: ${node.name || node.code}"
                style="
                    display: inline-flex; align-items: center; gap: 0.3rem;
                    font-size: 0.68rem; font-weight: ${isActive ? '700' : '500'};
                    padding: 0.2rem 0.5rem; border-radius: 20px; border: 1.5px solid ${isActive ? secCfg.color : 'var(--border-color)'};
                    background: ${isActive ? secCfg.color + '22' : 'transparent'};
                    color: ${isActive ? secCfg.color : 'var(--text-secondary)'};
                    cursor: ${isActive ? 'default' : 'pointer'};
                    transition: all 0.2s ease;
                    white-space: nowrap;
                "
                ${isActive ? 'disabled' : ''}
            >
                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${dotColor}; flex-shrink: 0;"></span>
                ${node.seq}ª
            </button>`;
        }).join('');

        const prevBtn = prevNode
            ? `<button onclick="zoomToProjectCode('${prevNode.code}')" title="Ir a ${seqLabel(prevNode.seq)}"
                style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.72rem; font-weight: 600; padding: 0.25rem 0.55rem; border-radius: 8px; border: 1.5px solid var(--border-color); background: transparent; color: var(--text-secondary); cursor: pointer; transition: all 0.2s ease;"
                onmouseover="this.style.borderColor='${secCfg.color}';this.style.color='${secCfg.color}'"
                onmouseout="this.style.borderColor='var(--border-color)';this.style.color='var(--text-secondary)'"
              ><i data-lucide="chevron-left" style="width: 12px; height: 12px;"></i> Anterior</button>`
            : `<button disabled style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.72rem; font-weight: 600; padding: 0.25rem 0.55rem; border-radius: 8px; border: 1.5px solid transparent; background: transparent; color: transparent; cursor: default; visibility: hidden;"><i style="width: 12px; height: 12px;"></i> Anterior</button>`;

        const nextBtn = nextNode
            ? `<button onclick="zoomToProjectCode('${nextNode.code}')" title="Ir a ${seqLabel(nextNode.seq)}"
                style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.72rem; font-weight: 600; padding: 0.25rem 0.55rem; border-radius: 8px; border: 1.5px solid var(--border-color); background: transparent; color: var(--text-secondary); cursor: pointer; transition: all 0.2s ease;"
                onmouseover="this.style.borderColor='${secCfg.color}';this.style.color='${secCfg.color}'"
                onmouseout="this.style.borderColor='var(--border-color)';this.style.color='var(--text-secondary)'"
              >Siguiente <i data-lucide="chevron-right" style="width: 12px; height: 12px;"></i></button>`
            : `<button disabled style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.72rem; font-weight: 600; padding: 0.25rem 0.55rem; border-radius: 8px; border: 1.5px solid transparent; background: transparent; color: transparent; cursor: default; visibility: hidden;">Siguiente <i style="width: 12px; height: 12px;"></i></button>`;

        relicitNavHTML = `
            <div style="
                margin-top: 0.1rem;
                padding: 0.55rem 0.7rem;
                background: linear-gradient(135deg, ${secCfg.color}08, ${secCfg.color}12);
                border: 1px solid ${secCfg.color}30;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
                flex-wrap: wrap;
            ">
                <div style="display: flex; align-items: center; gap: 0.3rem; flex-shrink: 0;">
                    <i data-lucide="git-branch" style="width: 13px; height: 13px; color: ${secCfg.color};"></i>
                    <span style="font-size: 0.68rem; font-weight: 700; color: ${secCfg.color}; text-transform: uppercase; letter-spacing: 0.04em;">${sortedNodes.length} Licitaciones</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; flex: 1; justify-content: center;">
                    ${pills}
                </div>
                <div style="display: flex; align-items: center; gap: 0.3rem; flex-shrink: 0;">
                    ${prevBtn}
                    ${nextBtn}
                </div>
            </div>
        `;
    }

    const presVal = item && (item['Presupuesto oficial estimado'] || item['Presupuesto oficial']);
    const presCurrency = (item && item['Moneda']) ? item['Moneda'] : 'UF';
    const presText = (presVal != null && !isNaN(presVal) && Number(presVal) > 0)
        ? `${formatUFComplete(presVal)} ${presCurrency}`
        : 'No informado';

    const invVal = item && item['Inversión Materializada estimada'];
    const invText = (invVal != null && !isNaN(invVal) && Number(invVal) > 0)
        ? `${formatUFComplete(invVal)} UF`
        : 'No informada';

    if (detailViewBody) {
        detailViewBody.innerHTML = `
            <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.1rem;">
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
                    <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); line-height: 1.35; font-family: var(--font-heading); flex: 1; min-width: 0;">${titleName}</h3>
                    <span class="badge ${badgeClass}" style="flex-shrink: 0; font-size: 0.7rem; padding: 0.2rem 0.5rem; white-space: nowrap; margin-top: 2px;">${status || sector}</span>
                </div>
                <div style="font-size: 0.75rem; color: ${secCfg.color}; font-weight: 600; margin-top: 0.25rem;">${sector}</div>
            </div>

            ${relicitNavHTML}

            ${timelineBtnHTML}

            <div class="detail-section">
                <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.35rem;">Descripción</h4>
                <p class="detail-desc" style="font-size: 0.76rem; line-height: 1.45;">${(item && item['Descripción ']) || 'No se registra descripción en la base de datos.'}</p>
            </div>

            ${streetViewHTML}

            ${biddersHTML}

            <div class="detail-section">
                <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.4rem;">Datos Contractuales</h4>
                <div class="detail-grid" style="grid-template-columns: 110px 1fr; gap: 0.3rem; font-size: 0.74rem;">
                    <span class="detail-label">Sociedad:</span>
                    <span class="detail-value">${(item && item['Nombre sociedad concesionaria']) || 'N/A'}</span>

                    <span class="detail-label">Región:</span>
                    <span class="detail-value">${formatRegionCell(item && item['Región geográfica'])}</span>

                    <span class="detail-label">Presupuesto:</span>
                    <span class="detail-value">${presText}</span>

                    <span class="detail-label">Inversión:</span>
                    <span class="detail-value">${invText}</span>

                    <span class="detail-label">Plazo:</span>
                    <span class="detail-value">${(item && item['Plazo fijo / variable ']) || 'Indefinido'}</span>

                    <span class="detail-label">Llamado Licitación:</span>
                    <span class="detail-value">${item ? formatDate(item['Fecha llamado a licitación']) : 'N/A'}</span>

                    <span class="detail-label">Adjudicación:</span>
                    <span class="detail-value">${item ? formatDate(item['Fecha decreto adjudicación']) : 'N/A'}</span>

                    <span class="detail-label">Inicio Contrato:</span>
                    <span class="detail-value">${item ? formatDate(item['Fecha inicio del contrato de concesión']) : 'N/A'}</span>

                    <span class="detail-label">Término Contrato:</span>
                    <span class="detail-value">${item ? formatDate(item['Fecha término de la concesión']) : 'N/A'}</span>

                    <span class="detail-label">Avance Obras:</span>
                    <span class="detail-value"><strong>${item ? formatProgress(item['% Avance obras físicas']) : 'N/A'}</strong></span>
                </div>
            </div>

            <div class="detail-actions" style="margin-top: 0.5rem; gap: 0.4rem;">
                ${linkMap}
                ${linkCMF}
                ${linkMOP}
            </div>
        `;
        detailViewBody.scrollTop = 0;
    }

    if (projectDetailView) {
        projectDetailView.scrollTop = 0;
    }

    const btnViewTl = document.getElementById('btn-view-in-timeline');
    if (btnViewTl) {
        btnViewTl.addEventListener('click', () => {
            showTimelineView();
            renderTimeline(appState.lastMapProjects || [], cleanCode);
        });
    }

    lucide.createIcons();
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

/**
 * Exporta la base de datos de concesiones (completa o filtrada) a Excel (.xlsx)
 * con TODAS las columnas originales y datos estructurados de oferentes.
 */
function exportDGCToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('La librería SheetJS (XLSX) no se encuentra disponible.');
        return;
    }

    const contracts = (typeof currentFilteredContractsList !== 'undefined' && currentFilteredContractsList.length > 0)
        ? currentFilteredContractsList
        : (window.STATIC_DATA ? window.STATIC_DATA.data : []);

    if (!contracts || contracts.length === 0) {
        alert('No hay concesiones disponibles para exportar con los filtros seleccionados.');
        return;
    }

    // Mapear cada concesión con todas sus columnas originales y orden óptimo
    const dataRows = contracts.map(p => {
        // Extraer datos de oferentes de forma limpia
        let adjudicadoName = '';
        let tipoAdjudicado = '';
        let empresasIntegrantes = '';
        let todosOferentes = '';

        if (Array.isArray(p.bidders) && p.bidders.length > 0) {
            const adj = p.bidders.find(b => b.adjudicado === true || String(b.adjudicado_raw).toLowerCase().includes('si'));
            if (adj) {
                adjudicadoName = adj.name || '';
                tipoAdjudicado = adj.consorcio ? 'Consorcio' : 'Empresa Única';
                empresasIntegrantes = adj.empresas || '';
            }
            todosOferentes = p.bidders.map(b => b.name).filter(Boolean).join(' | ');
        }

        return {
            "Código Proyecto": p["Código proyecto"] || "",
            "Nombre Concesión Oficial": p["Nombre de la Concesión "] || p["Nombre de la Concesión"] || "",
            "Nombre Uso Común": p["Nombre de uso común"] || "",
            "N° Licitación": p["NUM_Lic"] != null ? p["NUM_Lic"] : "",
            "Sector del Proyecto": p["Sector del proyecto"] || "",
            "Región Geográfica": p["Región geográfica"] || "",
            "Estado": p["ESTADO"] || "",
            "Origen": p["Origen"] || "",
            "Descripción": p["Descripción "] || p["Descripción"] || "",
            "Presupuesto Oficial Estimado (UF)": p["Presupuesto oficial estimado"] != null ? p["Presupuesto oficial estimado"] : "",
            "Inversión Materializada Estimada (UF)": p["Inversión Materializada estimada"] != null ? p["Inversión Materializada estimada"] : "",
            "Moneda": p["Moneda"] || "UF",
            "Método de Licitación": p["Metodo de licitación"] || "",
            "Variable(s) de Licitación": p["Variable(s) de licitación"] || "",
            "Fecha Declaración Interés Público": p["Fecha resolución declaración interes público"] || "",
            "Fecha Llamado a Licitación": p["Fecha llamado a licitación"] || "",
            "Fecha Recepción Ofertas": p["Fecha recepción ofertas"] || "",
            "Fecha Apertura Económica": p["Fecha apertura económica"] || "",
            "Fecha Decreto Adjudicación": p["Fecha decreto adjudicación"] || "",
            "Fecha Publicación Decreto": p["Fecha publicación decreto adjudicación"] || "",
            "Fecha Inicio Contrato": p["Fecha inicio del contrato de concesión"] || "",
            "Fecha Término Estimada": p["Fecha término de la concesión"] || "",
            "Plazo Fijo / Variable": p["Plazo fijo / variable "] || p["Plazo fijo / variable"] || "",
            "Fecha Inicio de Obras": p["Fecha inicio de obras"] || "",
            "Fecha Puesta Servicio Provisorio": p["Fecha puesta servicio provisorio"] || "",
            "Fecha Puesta Servicio Definitivo": p["Fecha puesta servicio definitivo"] || "",
            "% Avance Obras Físicas": p["% Avance obras físicas"] != null ? p["% Avance obras físicas"] : "",
            "RUT Sociedad Concesionaria": p["Rut sociedad Concesionaria"] || "",
            "Nombre Sociedad Concesionaria": p["Nombre sociedad concesionaria"] || "",
            "Oferente Adjudicado": adjudicadoName,
            "Tipo Adjudicatario": tipoAdjudicado,
            "Empresas Integrantes": empresasIntegrantes,
            "Todos los Oferentes Participantes": todosOferentes,
            "Link Concesiones MOP": p["Link pagina web concesiones"] || "",
            "Link CMF": p["Link a CMF de SC"] || ""
        };
    });

    // 1. Crear Hoja Principal de Concesiones
    const ws = XLSX.utils.json_to_sheet(dataRows);

    // Ajuste automático de anchos de columna
    if (dataRows.length > 0) {
        const colKeys = Object.keys(dataRows[0]);
        ws['!cols'] = colKeys.map(key => {
            let maxLen = key.length;
            for (let i = 0; i < Math.min(dataRows.length, 60); i++) {
                const val = dataRows[i][key];
                if (val != null) {
                    const strLen = String(val).length;
                    if (strLen > maxLen) maxLen = strLen;
                }
            }
            return { wch: Math.min(Math.max(maxLen + 2, 12), 48) };
        });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Concesiones_DGC");

    // 2. Hoja 2: Base de Datos de Oferentes de la Licitación
    const bidderRows = [];
    contracts.forEach(p => {
        const projCode = p["Código proyecto"] || "";
        const projName = p["Nombre de uso común"] || p["Nombre de la Concesión "] || "";
        const sector = p["Sector del proyecto"] || "";
        const region = p["Región geográfica"] || "";
        const estado = p["ESTADO"] || "";

        if (Array.isArray(p.bidders) && p.bidders.length > 0) {
            p.bidders.forEach((b, idx) => {
                const isAdj = (b.adjudicado === true || String(b.adjudicado_raw).trim().toUpperCase() === 'SI' || String(b.adjudicado_raw).trim().toUpperCase() === 'SÍ');
                const isCons = (b.consorcio === true || String(b.consorcio_raw).trim().toUpperCase() === 'SI' || String(b.consorcio_raw).trim().toUpperCase() === 'SÍ' || String(b.consorcio_raw).trim().toUpperCase() === 'X');

                bidderRows.push({
                    "Código Proyecto": projCode,
                    "Nombre Concesión": projName,
                    "Sector del Proyecto": sector,
                    "Región Geográfica": region,
                    "Estado Concesión": estado,
                    "N° Oferente": idx + 1,
                    "Código Oferente": b.code || "",
                    "Nombre Oferente / Consorcio": b.name || "",
                    "¿Adjudicado?": isAdj ? "Sí" : "No",
                    "¿Es Consorcio?": isCons ? "Sí" : "No",
                    "Empresas Integrantes": b.empresas || "",
                    "% Participación": b.pct || ""
                });
            });
        }
    });

    if (bidderRows.length > 0) {
        const wsBidders = XLSX.utils.json_to_sheet(bidderRows);
        const colKeysBidders = Object.keys(bidderRows[0]);
        wsBidders['!cols'] = colKeysBidders.map(key => {
            let maxLen = key.length;
            for (let i = 0; i < Math.min(bidderRows.length, 60); i++) {
                const val = bidderRows[i][key];
                if (val != null) {
                    const strLen = String(val).length;
                    if (strLen > maxLen) maxLen = strLen;
                }
            }
            return { wch: Math.min(Math.max(maxLen + 2, 12), 50) };
        });
        XLSX.utils.book_append_sheet(wb, wsBidders, "Oferentes_Licitaciones");
    } else {
        const wsEmpty = XLSX.utils.json_to_sheet([{ "Mensaje": "No hay registro de oferentes para las concesiones seleccionadas" }]);
        XLSX.utils.book_append_sheet(wb, wsEmpty, "Oferentes_Licitaciones");
    }

    // 3. Descargar archivo
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `CATLEC_DGC_Concesiones_${today}.xlsx`);
}

