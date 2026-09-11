// ─── Módulo de Interfaz de Usuario (UI) de Metro de Santiago ──────────────────

function metroDebounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function metroFormatLineCell(lineStr) {
    if (!lineStr) return '<span style="color:var(--text-muted);font-style:italic;">—</span>';
    const str = String(lineStr).trim();
    const color = METRO_LINE_COLORS[str] || 'var(--primary)';
    return `
        <div style="display:flex; align-items:center; gap:0.4rem;">
            <span style="width:8px; height:8px; border-radius:50%; background:${color}; flex-shrink:0;"></span>
            <span style="font-size:0.75rem; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${str}</span>
        </div>
    `;
}

function metroFormatStageCell(stageStr) {
    if (!stageStr || String(stageStr).trim() === '' || String(stageStr).trim().toLowerCase() === 'nan') {
        return '<span style="color:var(--text-muted);font-style:italic;font-size:0.75rem;">—</span>';
    }
    const str = String(stageStr).trim();
    return `<span style="font-size:0.74rem; color:var(--text-primary); font-weight:500;" title="${str}">${str}</span>`;
}

function metroFormatInvestmentCell(proj) {
    if (!proj) return '<span style="color:var(--text-muted);font-style:italic;">—</span>';
    if (proj.investment_mm_usd != null && !isNaN(proj.investment_mm_usd) && Number(proj.investment_mm_usd) > 0) {
        return `<span style="font-weight: 700; color: var(--primary); font-variant-numeric: tabular-nums;">${metroFormatInvestment(proj.investment_mm_usd)}</span>`;
    }
    const literal = proj.investment_str || (typeof proj.investment_mm_usd === 'string' ? proj.investment_mm_usd : null);
    if (literal && typeof literal === 'string') {
        const trimmed = literal.trim();
        if (trimmed !== '' && trimmed !== '—' && trimmed !== '-' && trimmed.toLowerCase() !== 'nan') {
            return `<span style="font-weight: 600; font-size: 0.72rem; color: var(--text-secondary); line-height: 1.25; display: inline-block;" title="${trimmed}">${trimmed}</span>`;
        }
    }
    return '<span style="color:var(--text-muted);font-style:italic;">—</span>';
}

function metroRenderTable(projects) {
    const selectedName = metroState.selectedProjectName;
    const allProjects = (window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : [];
    const selectedProj = selectedName ? allProjects.find(p => p.name === selectedName) : null;

    if (selectedProj) {
        metroShowProjectDetailView(selectedProj);
        return;
    }

    metroShowTableListView();

    if (!metroTableBody) return;

    if (!projects || projects.length === 0) {
        metroTableBody.innerHTML = '';
        if (metroEmptyState) metroEmptyState.style.display = 'flex';
        return;
    }
    if (metroEmptyState) metroEmptyState.style.display = 'none';

    metroTableBody.innerHTML = '';
    projects.forEach((proj, index) => {
        const tr = document.createElement('tr');
        tr.className = 'row-main';
        tr.id = `metro-row-${index}`;
        const pColor = (typeof metroGetProjectColor === 'function')
            ? metroGetProjectColor(proj.line || proj.name)
            : (METRO_LINE_COLORS[proj.line] || '#52525b');
        tr.innerHTML = `
            <td style="width: 44%;">
                <div style="display:flex; align-items:center; gap:0.45rem;">
                    <span style="width:9px; height:9px; border-radius:50%; background:${pColor}; flex-shrink:0; box-shadow:0 0 3px rgba(0,0,0,0.25);" title="${proj.line || ''}"></span>
                    <strong>${proj.name || 'Sin nombre'}</strong>
                </div>
            </td>
            <td style="width: 26%; text-align: right;">${metroFormatInvestmentCell(proj)}</td>
            <td style="width: 30%;">${metroFormatStageCell(proj.stage)}</td>
        `;

        tr.addEventListener('click', (e) => {
            e.stopPropagation();
            metroSelectProject(proj);
        });

        tr.addEventListener('mouseenter', () => {
            metroState.hoveredProjectName = proj.name;
            metroState.hoveredProjectId = proj.id;
            if (typeof metroUpdateMapStyles === 'function') {
                metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : projects);
            }
        });

        tr.addEventListener('mouseleave', () => {
            metroState.hoveredProjectName = null;
            metroState.hoveredProjectId = null;
            if (typeof metroUpdateMapStyles === 'function') {
                metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : projects);
            }
        });

        metroTableBody.appendChild(tr);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function metroShowTableListView() {
    const tableProjectsContainer = document.getElementById('metro-table-container-view');
    const tableLinesContainer = document.getElementById('metro-lines-container-view');
    const tableComunasContainer = document.getElementById('metro-comunas-container-view');
    const detailContainer = document.getElementById('metro-project-detail-view');

    if (metroState.tableMode === 'lines') {
        if (tableProjectsContainer) tableProjectsContainer.style.display = 'none';
        if (tableLinesContainer) tableLinesContainer.style.display = 'flex';
        if (tableComunasContainer) tableComunasContainer.style.display = 'none';
        metroRenderOperatingLinesTable();
    } else if (metroState.tableMode === 'comunas') {
        if (tableProjectsContainer) tableProjectsContainer.style.display = 'none';
        if (tableLinesContainer) tableLinesContainer.style.display = 'none';
        if (tableComunasContainer) tableComunasContainer.style.display = 'flex';
        metroRenderSideComunasTable();
    } else {
        if (tableProjectsContainer) tableProjectsContainer.style.display = 'flex';
        if (tableLinesContainer) tableLinesContainer.style.display = 'none';
        if (tableComunasContainer) tableComunasContainer.style.display = 'none';
    }
    if (detailContainer) detailContainer.style.display = 'none';
}

function setMetroTableMode(mode) {
    metroState.tableMode = mode;
    const btnProjects = document.getElementById('metro-tab-mode-projects');
    const btnLines = document.getElementById('metro-tab-mode-lines');
    const btnComunas = document.getElementById('metro-tab-mode-comunas');
    const kpiIcon1 = document.getElementById('metro-kpi-icon-1');
    const kpiLabel1 = document.getElementById('metro-kpi-label-1');
    const kpiVal1 = document.getElementById('metro-kpi-val-1');
    const kpiIcon2 = document.getElementById('metro-kpi-icon-2');
    const kpiLabel2 = document.getElementById('metro-kpi-label-2');
    const kpiVal2 = document.getElementById('metro-kpi-val-2');

    // Reset styles de los tres botones
    [btnProjects, btnLines, btnComunas].forEach(b => {
        if (!b) return;
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = 'var(--text-secondary)';
        b.style.border = '1px solid var(--border-color)';
    });

    if (mode === 'lines') {
        if (btnLines) {
            btnLines.classList.add('active');
            btnLines.style.background = 'var(--primary)';
            btnLines.style.color = '#ffffff';
            btnLines.style.border = '1px solid var(--primary)';
        }
        if (kpiIcon1) kpiIcon1.innerHTML = '<i data-lucide="milestone"></i>';
        if (kpiLabel1) kpiLabel1.textContent = 'Red Operativa';

        const lines = (window.METRO_DATA && window.METRO_DATA.lines) ? window.METRO_DATA.lines : [];
        const totalKm = lines.reduce((acc, l) => acc + (Number(l.length_km) || 0), 0);
        const totalEst = lines.reduce((acc, l) => acc + (Number(l.stations) || 0), 0);

        if (kpiVal1) kpiVal1.textContent = totalKm > 0 ? `${totalKm.toFixed(1)} km` : '—';

        if (kpiIcon2) kpiIcon2.innerHTML = '<i data-lucide="map-pin"></i>';
        if (kpiLabel2) kpiLabel2.textContent = 'Estaciones Activas';
        if (kpiVal2) kpiVal2.textContent = totalEst > 0 ? `${totalEst} est.` : '—';

        // Desactivar capa comunas si el usuario no la activó manualmente
        const userActive = (window.metroState && window.metroState.userExplicitlyEnabledComunas) || (typeof metroUserExplicitlyEnabledComunas !== 'undefined' && metroUserExplicitlyEnabledComunas);
        if (!userActive && typeof metroToggleComunas === 'function') {
            metroToggleComunas(false);
            const chk = document.getElementById('metro-toggle-comunas');
            if (chk) chk.checked = false;
        }
    } else if (mode === 'comunas') {
        if (btnComunas) {
            btnComunas.classList.add('active');
            btnComunas.style.background = 'var(--primary)';
            btnComunas.style.color = '#ffffff';
            btnComunas.style.border = '1px solid var(--primary)';
        }
        if (kpiIcon1) kpiIcon1.innerHTML = '<i data-lucide="building-2"></i>';
        if (kpiLabel1) kpiLabel1.textContent = 'Comunas del Gran Santiago';

        const stats = window.METRO_COMUNAS_STATS || {};
        const totalCom = stats.total_comunas || ((stats.ranking_estaciones || []).length + (stats.lista_sin_metro || []).length);
        const conMetro = stats.comunas_con_metro || 0;
        const enExp = stats.comunas_nuevas_expansion || 0;
        const conCob = conMetro + enExp;
        const pctCob = totalCom > 0 ? ((conCob / totalCom) * 100).toFixed(1).replace('.', ',') : '0';

        if (kpiVal1) kpiVal1.textContent = totalCom > 0 ? `${totalCom} comunas` : '—';

        if (kpiIcon2) kpiIcon2.innerHTML = '<i data-lucide="check-circle-2"></i>';
        if (kpiLabel2) kpiLabel2.textContent = 'Con Cobertura Metro';
        if (kpiVal2) kpiVal2.textContent = totalCom > 0 ? `${conCob} de ${totalCom} (${pctCob}%)` : '—';

        // Asegurar que la capa de comunas esté activa en el mapa para ver los shapes
        if (typeof metroToggleComunas === 'function') {
            metroToggleComunas(true);
            const chk = document.getElementById('metro-toggle-comunas');
            if (chk) chk.checked = true;
        }
    } else {
        if (btnProjects) {
            btnProjects.classList.add('active');
            btnProjects.style.background = 'var(--primary)';
            btnProjects.style.color = '#ffffff';
            btnProjects.style.border = '1px solid var(--primary)';
        }
        if (kpiIcon1) kpiIcon1.innerHTML = '<i data-lucide="train-front-tunnel"></i>';
        if (kpiLabel1) kpiLabel1.textContent = 'Proyectos de Expansión';

        const projects = (typeof currentFilteredMetroProjects !== 'undefined' && currentFilteredMetroProjects.length > 0)
            ? currentFilteredMetroProjects
            : ((window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : []);
        const totalProjects = projects.length;
        const totalInv = projects.reduce((acc, p) => acc + (Number(p.investment_mm_usd) || 0), 0);

        if (kpiVal1) kpiVal1.textContent = totalProjects > 0 ? String(totalProjects) : '—';

        if (kpiIcon2) kpiIcon2.innerHTML = '<i data-lucide="dollar-sign"></i>';
        if (kpiLabel2) kpiLabel2.textContent = 'Inversión Estimada';
        if (kpiVal2) kpiVal2.textContent = totalInv > 0 ? (typeof metroFormatInvestment === 'function' ? metroFormatInvestment(totalInv) : `US$ ${totalInv} MM`) : '—';

        // Desactivar capa comunas si el usuario no la activó manualmente
        const userActive = (window.metroState && window.metroState.userExplicitlyEnabledComunas) || (typeof metroUserExplicitlyEnabledComunas !== 'undefined' && metroUserExplicitlyEnabledComunas);
        if (!userActive && typeof metroToggleComunas === 'function') {
            metroToggleComunas(false);
            const chk = document.getElementById('metro-toggle-comunas');
            if (chk) chk.checked = false;
        }
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }

    metroState.selectedProjectName = null;
    metroState.selectedProjectId = null;
    metroShowTableListView();
}
window.setMetroTableMode = setMetroTableMode;

function metroRenderOperatingLinesTable() {
    const tbody = document.getElementById('metro-operating-lines-table-body');
    if (!tbody) return;

    const lines = (window.METRO_DATA && window.METRO_DATA.lines) ? window.METRO_DATA.lines : [];
    if (!lines || lines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-secondary);">No hay información de líneas operativas.</td></tr>';
        return;
    }

    let html = '';
    lines.forEach((l, idx) => {
        const lineColor = (window.METRO_LINE_COLORS && window.METRO_LINE_COLORS[l.line]) ? window.METRO_LINE_COLORS[l.line] : '#0a3b75';
        
        let rodaduraBadge = `<span class="badge" style="background: rgba(10, 59, 117, 0.08); color: #0a3b75; font-weight:600; font-size:0.68rem; padding: 0.15rem 0.4rem; border-radius: 4px;">${l.rolling_type.replace(' (Acero)', '')}</span>`;
        if (l.rolling_type.includes('Férrea')) {
            rodaduraBadge = `<span class="badge" style="background: rgba(2, 132, 199, 0.1); color: #0284c7; font-weight:600; font-size:0.68rem; padding: 0.15rem 0.4rem; border-radius: 4px;">${l.rolling_type.replace(' (Acero)', '')}</span>`;
        }

        let modeBadge = `<span style="font-size:0.68rem; color:var(--text-secondary); margin-left:0.25rem;">${l.driving_mode}</span>`;
        if (l.driving_mode.includes('GoA 4')) {
            modeBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; font-weight:700; font-size:0.65rem; padding: 0.15rem 0.35rem; border-radius: 4px; margin-left:0.25rem;">GoA 4</span>`;
        }

        html += `
            <tr class="row-main" id="metro-line-row-${idx}" data-line="${l.line}" style="cursor: pointer; border-bottom: 1px solid var(--border-color); transition: background 0.15s ease;"
                onmouseenter="metroOnHoverOperatingLine('${l.line}', true)"
                onmouseleave="metroOnHoverOperatingLine('${l.line}', false)"
                onclick="metroOnClickOperatingLine('${l.line}')">
                <td style="width: 14%; text-align: center; padding: 0.5rem 0.4rem;">
                    <span style="display:inline-flex; align-items:center; justify-content:center; padding: 0.18rem 0.5rem; border-radius: 999px; background: ${lineColor}; color: #ffffff; font-weight: 700; font-size: 0.72rem; letter-spacing: 0.3px; box-shadow: 0 1px 2px rgba(0,0,0,0.15);">
                        ${l.line}
                    </span>
                </td>
                <td style="width: 33%; padding: 0.5rem 0.5rem;">
                    <div style="font-weight: 600; font-size: 0.76rem; color: var(--text-primary); line-height: 1.25;">${l.terminals}</div>
                    <div style="font-size: 0.67rem; color: var(--text-secondary); margin-top: 2px;">Inaug. ${l.inauguration_year || '—'} · ${l.communes_count} comunas</div>
                </td>
                <td style="width: 13%; text-align: right; padding: 0.5rem 0.5rem;">
                    <span style="font-weight: 700; font-size: 0.78rem; color: var(--primary); font-variant-numeric: tabular-nums;">${l.length_km.toFixed(1)} km</span>
                </td>
                <td style="width: 14%; text-align: center; padding: 0.5rem 0.4rem;">
                    <div style="font-weight: 600; font-size: 0.76rem; color: var(--text-primary);">${l.stations} est.</div>
                    <div style="font-size: 0.65rem; color: var(--text-secondary);">${l.combinations} comb.</div>
                </td>
                <td style="width: 26%; text-align: center; padding: 0.5rem 0.4rem;">
                    <div style="display:inline-flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:0.2rem;">
                        ${rodaduraBadge}
                        ${modeBadge}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    const linesLabel = document.getElementById('metro-lines-pagination-label');
    if (linesLabel) {
        linesLabel.textContent = lines.length > 0 ? `1-${lines.length} de ${lines.length}` : '0-0 de 0';
    }
    const btnPrevLines = document.getElementById('metro-lines-btn-prev');
    const btnNextLines = document.getElementById('metro-lines-btn-next');
    if (btnPrevLines) btnPrevLines.disabled = true;
    if (btnNextLines) btnNextLines.disabled = true;

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }

    metroUpdateOperatingLinesTableSelection();
}
window.metroRenderOperatingLinesTable = metroRenderOperatingLinesTable;

function metroUpdateOperatingLinesTableSelection() {
    const rows = document.querySelectorAll('#metro-operating-lines-table-body tr.row-main');
    const selected = metroState.selectedOperatingLine;
    rows.forEach(row => {
        const isSelected = selected && row.getAttribute('data-line') === selected;
        row.style.backgroundColor = isSelected ? 'rgba(10, 59, 117, 0.12)' : '';
        row.style.boxShadow = isSelected ? 'inset 4px 0 0 #0a3b75' : '';
    });
}
window.metroUpdateOperatingLinesTableSelection = metroUpdateOperatingLinesTableSelection;

function metroOnHoverOperatingLine(lineName, isHover) {
    if (metroState.selectedProjectName || metroState.selectedOperatingLine) return;
    metroState.hoveredOperatingLine = isHover ? lineName : null;
    if (typeof metroUpdateMapStyles === 'function') {
        metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : (window.METRO_DATA ? window.METRO_DATA.data : []));
    }
}
window.metroOnHoverOperatingLine = metroOnHoverOperatingLine;

function metroOnClickOperatingLine(lineName) {
    if (!lineName) return;

    if (metroState.tableMode !== 'lines' && typeof setMetroTableMode === 'function') {
        setMetroTableMode('lines');
    }

    if (metroState.selectedOperatingLine === lineName) {
        metroState.selectedOperatingLine = null;
        if (typeof metroApplyDefaultMapView === 'function') metroApplyDefaultMapView(true);
    } else {
        metroState.selectedOperatingLine = lineName;
        metroState.selectedProjectName = null;
        metroState.selectedProjectId = null;
        metroState.selectedComuna = null;
        if (typeof metroUpdateSideComunasTableSelection === 'function') {
            metroUpdateSideComunasTableSelection();
        }
        if (typeof metroComunasLayer !== 'undefined' && metroComunasLayer) {
            metroComunasLayer.eachLayer(l => metroComunasLayer.resetStyle(l));
        }

        if (metroMap && typeof metroFindOperatingLayers === 'function') {
            const layers = metroFindOperatingLayers(lineName);
            if (layers && layers.length > 0) {
                const group = L.featureGroup(layers);
                if (group.getBounds && group.getBounds().isValid()) {
                    metroMap.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 13.5, animate: true });
                }
            }
        }
    }

    metroState.hoveredOperatingLine = null;
    metroUpdateOperatingLinesTableSelection();

    if (typeof metroUpdateMapStyles === 'function') {
        metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : (window.METRO_DATA ? window.METRO_DATA.data : []));
    }
}
window.metroOnClickOperatingLine = metroOnClickOperatingLine;

// ─── Tabla Lateral de Comunas del Gran Santiago ───────────────────────────────
let metroSideComunasFilterState = 'all';
let metroSideComunasPage = 1;
const metroSideComunasPageSize = 15;

function setMetroSideComunasFilter(filter) {
    metroSideComunasFilterState = filter;
    metroSideComunasPage = 1;
    const btns = document.querySelectorAll('.metro-side-comunas-filter-btn');
    btns.forEach(b => {
        if (b.getAttribute('data-filter') === filter) {
            b.classList.add('active');
            b.style.background = 'var(--primary)';
            b.style.color = '#ffffff';
            b.style.border = '1px solid var(--primary)';
        } else {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = 'var(--text-secondary)';
            b.style.border = '1px solid var(--border-color)';
        }
    });
    metroFilterSideComunasTable();
}
window.setMetroSideComunasFilter = setMetroSideComunasFilter;

function metroFilterSideComunasTable() {
    metroSideComunasPage = 1;
    metroRenderSideComunasTable();
}
window.metroFilterSideComunasTable = metroFilterSideComunasTable;

function metroFormatLineBadge(lineName, isFuture = false) {
    let clean = lineName.replace('Línea ', 'L').replace('Línea', 'L').trim();
    if (clean.includes('Acceso Aeropuerto') || clean.includes('Línea A') || clean.includes('L-A') || clean === 'A') {
        clean = 'LA';
    } else if (clean.includes('Línea 4A') || clean === '4A') {
        clean = 'L4A';
    } else if (clean.includes('Extensión Línea 6') || clean.includes('Ext. L6') || clean.includes('L6 Oriente') || clean.includes('L6 Poniente')) {
        clean = 'Ext.L6';
    }
    const color = (typeof metroGetLineColor === 'function') ? metroGetLineColor(lineName) : '#0a3b75';

    if (isFuture) {
        return `<span style="display:inline-flex; align-items:center; justify-content:center; padding:1px 4px; border-radius:3px; font-size:0.65rem; font-weight:700; color:${color}; border:1px dashed ${color}; background:${color}18; margin:1px;" title="Futuro: ${lineName}">+${clean}</span>`;
    }
    return `<span style="display:inline-flex; align-items:center; justify-content:center; padding:1px 4px; border-radius:3px; font-size:0.65rem; font-weight:700; color:#ffffff; background:${color}; margin:1px;" title="${lineName}">${clean}</span>`;
}

function metroRenderSideComunasTable() {
    const tbody = document.getElementById('metro-side-comunas-table-body');
    const labelPagination = document.getElementById('metro-side-comunas-pagination-label');
    const btnPrev = document.getElementById('metro-side-comunas-btn-prev');
    const btnNext = document.getElementById('metro-side-comunas-btn-next');
    if (!tbody) return;

    const stats = window.METRO_COMUNAS_STATS;
    if (!stats) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-secondary);">No hay información de comunas cargada.</td></tr>';
        if (labelPagination) labelPagination.textContent = '0-0 de 0';
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        return;
    }

    const allComunas = [...(stats.ranking_estaciones || []), ...(stats.lista_sin_metro || [])];
    const searchInput = document.getElementById('metro-side-comunas-search');
    const searchVal = (searchInput && searchInput.value) ? (typeof metroNormalizeText === 'function' ? metroNormalizeText(searchInput.value) : searchInput.value.toLowerCase().trim()) : '';

    const filtered = allComunas.filter(c => {
        // Filtro de botones de estado
        if (metroSideComunasFilterState === 'con_metro' && !c.has_metro) return false;
        if (metroSideComunasFilterState === 'sin_metro' && c.has_metro) return false;
        if (metroSideComunasFilterState === 'en_expansion' && (c.has_metro || c.expansion_status !== 'En Expansión')) return false;

        // Filtro de búsqueda de texto
        if (searchVal) {
            const normName = typeof metroNormalizeText === 'function' ? metroNormalizeText(c.comuna) : c.comuna.toLowerCase();
            const normStatus = typeof metroNormalizeText === 'function' ? metroNormalizeText(c.expansion_status || '') : (c.expansion_status || '').toLowerCase();
            const matchLines = (c.lineas || []).some(l => {
                const normL = typeof metroNormalizeText === 'function' ? metroNormalizeText(l) : l.toLowerCase();
                return normL.includes(searchVal);
            });
            const matchFuturos = (c.proyectos_futuros || []).some(p => {
                const normP = typeof metroNormalizeText === 'function' ? metroNormalizeText(p) : p.toLowerCase();
                return normP.includes(searchVal);
            });

            if (!normName.includes(searchVal) && !normStatus.includes(searchVal) && !matchLines && !matchFuturos) {
                return false;
            }
        }
        return true;
    });

    if (searchVal) {
        filtered.sort((a, b) => {
            const normA = typeof metroNormalizeText === 'function' ? metroNormalizeText(a.comuna) : a.comuna.toLowerCase();
            const normB = typeof metroNormalizeText === 'function' ? metroNormalizeText(b.comuna) : b.comuna.toLowerCase();
            const aExact = normA === searchVal;
            const bExact = normB === searchVal;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            const aName = normA.includes(searchVal);
            const bName = normB.includes(searchVal);
            if (aName && !bName) return -1;
            if (!aName && bName) return 1;
            return 0;
        });
    }

    const totalComunas = filtered.length;
    const totalPages = Math.ceil(totalComunas / metroSideComunasPageSize) || 1;
    if (metroSideComunasPage > totalPages) metroSideComunasPage = totalPages;
    if (metroSideComunasPage < 1) metroSideComunasPage = 1;

    const start = totalComunas === 0 ? 0 : (metroSideComunasPage - 1) * metroSideComunasPageSize;
    const end = Math.min(start + metroSideComunasPageSize, totalComunas);

    if (labelPagination) {
        labelPagination.textContent = totalComunas === 0 ? '0-0 de 0' : `${start + 1}-${end} de ${totalComunas}`;
    }

    if (btnPrev) {
        btnPrev.disabled = (metroSideComunasPage <= 1 || totalComunas === 0);
        btnPrev.onclick = (e) => {
            e.stopPropagation();
            if (metroSideComunasPage > 1) {
                metroSideComunasPage--;
                metroRenderSideComunasTable();
            }
        };
    }

    if (btnNext) {
        btnNext.disabled = (metroSideComunasPage >= totalPages || totalComunas === 0);
        btnNext.onclick = (e) => {
            e.stopPropagation();
            if (metroSideComunasPage < totalPages) {
                metroSideComunasPage++;
                metroRenderSideComunasTable();
            }
        };
    }

    const btnAll = document.getElementById('metro-side-btn-filter-all');
    const btnCon = document.getElementById('metro-side-btn-filter-con');
    const btnExp = document.getElementById('metro-side-btn-filter-exp');
    const btnSin = document.getElementById('metro-side-btn-filter-sin');
    if (btnAll) btnAll.textContent = `Todas (${allComunas.length})`;
    if (btnCon) btnCon.textContent = `Con Metro (${allComunas.filter(c => c.has_metro).length})`;
    if (btnExp) btnExp.textContent = `En Expansión (${allComunas.filter(c => !c.has_metro && c.expansion_status === 'En Expansión').length})`;
    if (btnSin) btnSin.textContent = `Sin Metro (${allComunas.filter(c => !c.has_metro && c.expansion_status !== 'En Expansión').length})`;

    if (totalComunas === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-secondary); font-size:0.75rem;">No se encontraron comunas que coincidan con los filtros.</td></tr>';
        return;
    }

    const pageSlice = filtered.slice(start, end);
    let html = '';
    pageSlice.forEach((c, idx) => {
        let badgeEstado = '';
        if (c.has_metro) {
            badgeEstado = `<span class="badge" style="background:rgba(16,185,129,0.12); color:#059669; border:1px solid rgba(16,185,129,0.25); font-weight:700; font-size:0.66rem; padding:0.12rem 0.35rem; border-radius:4px; display:inline-flex; align-items:center; gap:3px;"><span style="width:5px; height:5px; border-radius:50%; background:#10b981;"></span>Activo</span>`;
        } else if (c.expansion_status === 'En Expansión') {
            badgeEstado = `<span class="badge" style="background:rgba(2,132,199,0.12); color:#0284c7; border:1px solid rgba(2,132,199,0.25); font-weight:700; font-size:0.66rem; padding:0.12rem 0.35rem; border-radius:4px; display:inline-flex; align-items:center; gap:3px;"><span style="width:5px; height:5px; border-radius:50%; background:#0284c7;"></span>Expansión</span>`;
        } else {
            badgeEstado = `<span class="badge" style="background:rgba(148,163,184,0.12); color:#64748b; border:1px solid rgba(148,163,184,0.2); font-weight:600; font-size:0.66rem; padding:0.12rem 0.35rem; border-radius:4px;">Sin Red</span>`;
        }

        const estCountHtml = c.estaciones_count > 0
            ? `<span style="font-weight:700; font-size:0.76rem; color:var(--text-primary); font-variant-numeric:tabular-nums;">${c.estaciones_count}</span>`
            : `<span style="font-size:0.72rem; color:var(--text-muted);">—</span>`;

        // Badges de Líneas actuales y futuras
        let lineasBadges = [];
        if (c.lineas && c.lineas.length > 0) {
            c.lineas.forEach(l => lineasBadges.push(metroFormatLineBadge(l, false)));
        }
        if (c.proyectos_futuros && c.proyectos_futuros.length > 0) {
            c.proyectos_futuros.forEach(p => {
                let match = p.match(/Línea\s*[0-9A-Za-z]+/i);
                let lbl = match ? match[0] : (p.includes('Línea 6') ? 'Ext. L6' : p);
                lineasBadges.push(metroFormatLineBadge(lbl, true));
            });
        }
        const lineasHtml = lineasBadges.length > 0
            ? `<div style="display:flex; flex-wrap:wrap; gap:2px; align-items:center;">${lineasBadges.join('')}</div>`
            : `<span style="font-size:0.72rem; color:var(--text-muted);">—</span>`;

        html += `
            <tr class="row-main metro-side-comuna-row" id="metro-side-comuna-row-${start + idx}" data-comuna="${c.comuna}"
                style="cursor: pointer; border-bottom: 1px solid var(--border-color); transition: background 0.15s ease;"
                onmouseenter="metroOnHoverSideComuna('${c.comuna.replace(/'/g, "\\'")}', true)"
                onmouseleave="metroOnHoverSideComuna('${c.comuna.replace(/'/g, "\\'")}', false)"
                onclick="metroOnClickComunaFromTable('${c.comuna.replace(/'/g, "\\'")}')">
                <td style="width: 32%; padding: 0.45rem 0.5rem;">
                    <div style="font-weight: 700; font-size: 0.76rem; color: var(--text-primary); line-height: 1.25;">${c.comuna}</div>
                </td>
                <td style="width: 26%; padding: 0.45rem 0.4rem;">
                    ${badgeEstado}
                </td>
                <td style="width: 16%; text-align: center; padding: 0.45rem 0.35rem;">
                    ${estCountHtml}
                </td>
                <td style="width: 26%; padding: 0.45rem 0.35rem;">
                    ${lineasHtml}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
    metroUpdateSideComunasTableSelection();
}
window.metroRenderSideComunasTable = metroRenderSideComunasTable;

function metroUpdateSideComunasTableSelection() {
    const tbody = document.getElementById('metro-side-comunas-table-body');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr.metro-side-comuna-row');
    const selected = metroState.selectedComuna;
    const normSelected = (selected && typeof metroNormalizeText === 'function') ? metroNormalizeText(selected) : (selected ? String(selected).toLowerCase().trim() : null);

    let selectedRow = null;
    rows.forEach(row => {
        const cAttr = row.getAttribute('data-comuna') || '';
        const normC = (typeof metroNormalizeText === 'function') ? metroNormalizeText(cAttr) : cAttr.toLowerCase().trim();
        if (normSelected && normC === normSelected) {
            row.style.backgroundColor = 'rgba(16, 185, 129, 0.12)';
            row.style.boxShadow = 'inset 4px 0 0 #059669';
            selectedRow = row;
        } else {
            row.style.backgroundColor = '';
            row.style.boxShadow = '';
        }
    });

    if (selectedRow) {
        selectedRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}
window.metroUpdateSideComunasTableSelection = metroUpdateSideComunasTableSelection;

function metroOnHoverSideComuna(comunaName, isHover) {
    if (metroState.selectedComuna) return;
    if (!metroComunasLayer) return;

    metroComunasLayer.eachLayer(layer => {
        if (layer.feature && layer.feature.properties && layer.feature.properties.comuna === comunaName) {
            if (isHover) {
                layer.setStyle({
                    weight: 2.5,
                    color: '#059669',
                    fillOpacity: 0.18,
                    opacity: 0.95
                });
                if (layer.bringToFront) layer.bringToFront();
            } else {
                metroComunasLayer.resetStyle(layer);
            }
        }
    });
}
window.metroOnHoverSideComuna = metroOnHoverSideComuna;

function metroOnClickComunaFromTable(comunaName) {
    if (!comunaName) return;

    // Asegurar que la vista esté en modo 'comunas' en la tabla
    if (metroState.tableMode !== 'comunas' && typeof setMetroTableMode === 'function') {
        setMetroTableMode('comunas');
    }

    // Si la comuna no está visible en el DOM debido a filtros o búsqueda, restablecerlos
    const tbody = document.getElementById('metro-side-comunas-table-body');
    const existingRow = tbody ? tbody.querySelector(`tr[data-comuna="${comunaName}"]`) : null;
    if (!existingRow) {
        const searchInput = document.getElementById('metro-side-comunas-search');
        if (searchInput && searchInput.value) searchInput.value = '';
        metroSideComunasFilterState = 'all';
        const btns = document.querySelectorAll('.metro-side-comunas-filter-btn');
        btns.forEach(b => {
            if (b.getAttribute('data-filter') === 'all') {
                b.classList.add('active');
                b.style.background = 'var(--primary)';
                b.style.color = '#ffffff';
                b.style.border = '1px solid var(--primary)';
            } else {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--text-secondary)';
                b.style.border = '1px solid var(--border-color)';
            }
        });
        metroRenderSideComunasTable();
    }

    const isSame = metroState.selectedComuna &&
        (typeof metroNormalizeText === 'function' ?
            metroNormalizeText(metroState.selectedComuna) === metroNormalizeText(comunaName) :
            metroState.selectedComuna.toLowerCase().trim() === comunaName.toLowerCase().trim());

    if (isSame) {
        metroState.selectedComuna = null;
        metroUpdateSideComunasTableSelection();
        if (typeof metroUpdateMapStyles === 'function') {
            metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : (window.METRO_DATA ? window.METRO_DATA.data : []));
        }
        if (typeof metroApplyDefaultMapView === 'function') {
            metroApplyDefaultMapView(true);
        }
    } else {
        metroState.selectedComuna = comunaName;
        metroState.selectedProjectName = null;
        metroState.selectedProjectId = null;
        metroState.selectedOperatingLine = null;
        metroUpdateSideComunasTableSelection();
        if (typeof metroZoomToComuna === 'function') {
            metroZoomToComuna(comunaName);
        }
        if (typeof metroUpdateMapStyles === 'function') {
            metroUpdateMapStyles(typeof currentFilteredMetroProjects !== 'undefined' ? currentFilteredMetroProjects : (window.METRO_DATA ? window.METRO_DATA.data : []));
        }
    }
}
window.metroOnClickComunaFromTable = metroOnClickComunaFromTable;

function metroUpdateDetailNavButtons(currentProjName) {
    const btnPrev = document.getElementById('metro-btn-detail-prev');
    const btnNext = document.getElementById('metro-btn-detail-next');
    if (!btnPrev || !btnNext) return;

    const list = (typeof currentFilteredMetroProjects !== 'undefined' && currentFilteredMetroProjects && currentFilteredMetroProjects.length > 0)
        ? currentFilteredMetroProjects
        : ((window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : []);

    const idx = list.findIndex(p => p.name === currentProjName);

    if (idx > 0) {
        btnPrev.disabled = false;
        btnPrev.style.opacity = '1';
        btnPrev.style.cursor = 'pointer';
        btnPrev.style.pointerEvents = 'auto';
        btnPrev.onclick = () => metroSelectProject(list[idx - 1]);
    } else {
        btnPrev.disabled = true;
        btnPrev.style.opacity = '0.35';
        btnPrev.style.cursor = 'not-allowed';
        btnPrev.style.pointerEvents = 'none';
        btnPrev.onclick = null;
    }

    if (idx >= 0 && idx < list.length - 1) {
        btnNext.disabled = false;
        btnNext.style.opacity = '1';
        btnNext.style.cursor = 'pointer';
        btnNext.style.pointerEvents = 'auto';
        btnNext.onclick = () => metroSelectProject(list[idx + 1]);
    } else {
        btnNext.disabled = true;
        btnNext.style.opacity = '0.35';
        btnNext.style.cursor = 'not-allowed';
        btnNext.style.pointerEvents = 'none';
        btnNext.onclick = null;
    }
}

function metroShowProjectDetailView(proj) {
    const tableProjectsContainer = document.getElementById('metro-table-container-view');
    const tableLinesContainer = document.getElementById('metro-lines-container-view');
    const tableComunasContainer = document.getElementById('metro-comunas-container-view');
    const detailContainer = document.getElementById('metro-project-detail-view');
    const detailBody = document.getElementById('metro-detail-view-body');

    if (tableProjectsContainer) tableProjectsContainer.style.display = 'none';
    if (tableLinesContainer) tableLinesContainer.style.display = 'none';
    if (tableComunasContainer) tableComunasContainer.style.display = 'none';
    if (!detailContainer || !detailBody) return;
    detailContainer.style.display = 'flex';

    const lineColor = (typeof metroGetProjectColor === 'function')
        ? metroGetProjectColor(proj.line || proj.name)
        : (METRO_LINE_COLORS[proj.line] || '#0284c7');

    let badgeClass = 'badge-neutral';
    const stageLower = (proj.stage || '').toLowerCase();
    if (stageLower.includes('ejecu') || stageLower.includes('construc')) {
        badgeClass = 'badge-info';
    } else if (stageLower.includes('diseñ')) {
        badgeClass = 'badge-warning';
    } else if (stageLower.includes('factib') || stageLower.includes('estudio')) {
        badgeClass = 'badge-neutral';
    } else if (stageLower.includes('opera')) {
        badgeClass = 'badge-success';
    }

    const invFormatted = (proj.investment_mm_usd != null && Number(proj.investment_mm_usd) > 0)
        ? metroFormatInvestment(proj.investment_mm_usd)
        : (proj.investment_str || (proj.investment_mm_usd ? String(proj.investment_mm_usd) : 'No informada'));

    const invAcumFormatted = (proj.accumulated_investment_2025_mm_usd != null && Number(proj.accumulated_investment_2025_mm_usd) > 0)
        ? metroFormatInvestment(proj.accumulated_investment_2025_mm_usd)
        : (proj.accumulated_investment_str || (proj.accumulated_investment_2025_mm_usd ? String(proj.accumulated_investment_2025_mm_usd) : '—'));

    const avFinFormatted = (proj.financial_progress_pct != null && !isNaN(proj.financial_progress_pct))
        ? `${(Number(proj.financial_progress_pct) * 100).toFixed(1)}%`
        : (proj.financial_progress_str || '—');

    const avFisFormatted = (proj.physical_progress_pct != null && !isNaN(proj.physical_progress_pct))
        ? `${(Number(proj.physical_progress_pct) * 100).toFixed(1)}%`
        : (proj.physical_progress_str || '—');

    const pobFormatted = (proj.benefited_population != null && !isNaN(proj.benefited_population))
        ? Number(proj.benefited_population).toLocaleString('es-CL') + ' habitantes'
        : (proj.benefited_population || '—');

    detailBody.innerHTML = `
        <!-- Cabecera del Proyecto (Estilo index.html) -->
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.1rem;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
                <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); line-height: 1.35; font-family: var(--font-heading); flex: 1; min-width: 0;">${proj.name}</h3>
                <span class="badge ${badgeClass}" style="flex-shrink: 0; font-size: 0.7rem; padding: 0.2rem 0.5rem; white-space: nowrap; margin-top: 2px;">${proj.stage || 'Expansión'}</span>
            </div>
            <div style="font-size: 0.75rem; color: ${lineColor}; font-weight: 600; margin-top: 0.25rem;">
                ${proj.line || 'Metro de Santiago'} ${proj.type ? `• ${proj.type}` : ''}
            </div>
        </div>

        <!-- 1. Características y Trazado -->
        <div class="detail-section">
            <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.4rem;">
                <i data-lucide="map-pin" style="width: 14px; height: 14px; color: var(--primary);"></i>
                Características y Trazado
            </h4>
            <div class="detail-grid" style="grid-template-columns: 125px 1fr; gap: 0.3rem; font-size: 0.74rem;">
                <span class="detail-label">Terminales:</span>
                <span class="detail-value">${proj.terminals || '—'}</span>

                <span class="detail-label">Longitud:</span>
                <span class="detail-value">${proj.length_km ? proj.length_km + ' km' : '—'}</span>

                <span class="detail-label">Estaciones:</span>
                <span class="detail-value">${proj.stations ? proj.stations + ' estaciones' : '—'}</span>

                <span class="detail-label">Tiempo de Viaje:</span>
                <span class="detail-value">${proj.travel_time || '—'}</span>

                <span class="detail-label">Población Beneficiada:</span>
                <span class="detail-value">${pobFormatted}</span>

                <span class="detail-label">Combinaciones:</span>
                <span class="detail-value">${proj.combinations || '—'}</span>

                <span class="detail-label">Comunas:</span>
                <span class="detail-value">${proj.communes || '—'}</span>
            </div>
        </div>

        <!-- 2. Inversión y Avance -->
        <div class="detail-section">
            <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.4rem;">
                <i data-lucide="trending-up" style="width: 14px; height: 14px; color: var(--primary);"></i>
                Inversión y Avance
            </h4>
            <div class="detail-grid" style="grid-template-columns: 125px 1fr; gap: 0.3rem; font-size: 0.74rem;">
                <span class="detail-label">Inversión Total:</span>
                <span class="detail-value"><strong>${invFormatted}</strong></span>

                <span class="detail-label">Inversión Acumulada:</span>
                <span class="detail-value">${invAcumFormatted}</span>

                <span class="detail-label">Puesta en Servicio:</span>
                <span class="detail-value"><strong>${proj.operation_year || '—'}</strong></span>

                <span class="detail-label">Fecha de Inicio:</span>
                <span class="detail-value">${proj.start_date || '—'}</span>

                <span class="detail-label">Avance Físico:</span>
                <span class="detail-value"><strong>${avFisFormatted}</strong></span>

                <span class="detail-label">Avance Financiero:</span>
                <span class="detail-value">${avFinFormatted}</span>
            </div>
        </div>

        <!-- 3. Infraestructura y Obras -->
        <div class="detail-section">
            <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.4rem;">
                <i data-lucide="activity" style="width: 14px; height: 14px; color: var(--primary);"></i>
                Infraestructura y Obras
            </h4>
            <div class="detail-grid" style="grid-template-columns: 125px 1fr; gap: 0.3rem; font-size: 0.74rem;">
                <span class="detail-label">Avance Túneles:</span>
                <span class="detail-value">${proj.tunnel_excavation || '—'}</span>

                <span class="detail-label">Talleres y Cocheras:</span>
                <span class="detail-value">${proj.workshops_depots || '—'}</span>
            </div>
        </div>

        <!-- 4. Material Rodante y Sistemas -->
        <div class="detail-section">
            <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.4rem;">
                <i data-lucide="train" style="width: 14px; height: 14px; color: var(--primary);"></i>
                Material Rodante y Sistemas
            </h4>
            <div class="detail-grid" style="grid-template-columns: 125px 1fr; gap: 0.3rem; font-size: 0.74rem;">
                <span class="detail-label">Trenes / Flota:</span>
                <span class="detail-value">${proj.rolling_stock || '—'}</span>

                <span class="detail-label">Tecnología y Sistemas:</span>
                <span class="detail-value">${proj.systems_technology || '—'}</span>
            </div>
        </div>

        <!-- 5. Medio Ambiente y Patrimonio -->
        <div class="detail-section">
            <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.4rem;">
                <i data-lucide="shield-check" style="width: 14px; height: 14px; color: var(--primary);"></i>
                Medio Ambiente y Patrimonio
            </h4>
            <div class="detail-grid" style="grid-template-columns: 125px 1fr; gap: 0.3rem; font-size: 0.74rem;">
                <span class="detail-label">Clasificación Ambiental:</span>
                <span class="detail-value">${proj.environmental_classification || '—'}</span>

                <span class="detail-label">Estado Ambiental (RCA):</span>
                <span class="detail-value">${proj.environmental_status || '—'}</span>

                <span class="detail-label">Arqueología y Patrimonio:</span>
                <span class="detail-value">${proj.heritage_archaeology || '—'}</span>
            </div>
        </div>
    `;

    detailBody.scrollTop = 0;

    const backBtn = document.getElementById('metro-btn-detail-back');
    if (backBtn) {
        backBtn.onclick = () => {
            metroSelectProject(null);
            if (typeof metroApplyDefaultMapView === 'function') {
                metroApplyDefaultMapView(true);
            }
        };
    }

    metroUpdateDetailNavButtons(proj.name);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function metroSelectProject(proj) {
    // Limpiar selección de línea operativa al seleccionar o deseleccionar proyectos
    metroState.selectedOperatingLine = null;
    metroState.hoveredOperatingLine = null;
    if (typeof metroUpdateOperatingLinesTableSelection === 'function') {
        metroUpdateOperatingLinesTableSelection();
    }

    if (typeof metroCloseAllTooltips === 'function') {
        metroCloseAllTooltips();
    } else if (window.metroCloseAllTooltips) {
        window.metroCloseAllTooltips();
    }

    // Deseleccionar comuna del mapa y de la tabla si estaba seleccionada
    if (metroState.selectedComuna) {
        metroState.selectedComuna = null;
        if (typeof metroUpdateSideComunasTableSelection === 'function') {
            metroUpdateSideComunasTableSelection();
        }
        if (typeof metroComunasLayer !== 'undefined' && metroComunasLayer) {
            metroComunasLayer.eachLayer(l => metroComunasLayer.resetStyle(l));
        }
    }

    if (!proj) {
        metroState.selectedProjectName = null;
        metroState.selectedProjectId = null;
        metroShowTableListView();
        if (typeof metroUpdateMapStyles === 'function') {
            metroUpdateMapStyles(currentFilteredMetroProjects);
        }
        return;
    }

    // Sincronizar modo de tabla a 'projects' si venía de comunas o líneas
    if (metroState.tableMode !== 'projects' && typeof setMetroTableMode === 'function') {
        setMetroTableMode('projects');
    }

    if (!metroShowProjects && typeof metroToggleProjects === 'function') {
        metroToggleProjects(true);
    }

    metroState.selectedProjectName = proj.name;
    metroState.selectedProjectId = proj.id;
    metroShowProjectDetailView(proj);

    if (typeof metroZoomToProject === 'function') {
        metroZoomToProject(proj);
    }
    if (typeof metroUpdateMapStyles === 'function') {
        metroUpdateMapStyles(currentFilteredMetroProjects);
    }
}

function metroUpdatePagination(total, start, count) {
    if (!metroPaginationInfo) return;
    if (total === 0) {
        metroPaginationInfo.textContent = '0-0 de 0';
        if (metroBtnPrev) metroBtnPrev.disabled = true;
        if (metroBtnNext) metroBtnNext.disabled = true;
        return;
    }

    const end = start + count;
    metroPaginationInfo.textContent = `${start + 1}-${end} de ${total}`;
    if (metroBtnPrev) metroBtnPrev.disabled = metroState.page <= 1;
    if (metroBtnNext) metroBtnNext.disabled = end >= total;
}

function metroUpdateDynamicLabels() {
    const projects = (window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : [];
    const lines = (window.METRO_DATA && window.METRO_DATA.lines) ? window.METRO_DATA.lines : [];
    const stats = window.METRO_COMUNAS_STATS || {};
    const totalCom = stats.total_comunas || ((stats.ranking_estaciones || []).length + (stats.lista_sin_metro || []).length);

    const tabProjects = document.getElementById('metro-tab-text-projects');
    const tabLines = document.getElementById('metro-tab-text-lines');
    const tabComunas = document.getElementById('metro-tab-text-comunas');

    if (tabProjects) tabProjects.textContent = 'Proyectos';
    if (tabLines) tabLines.textContent = 'Líneas Actuales';
    if (tabComunas) tabComunas.textContent = 'Comunas';

    const linesLabel = document.getElementById('metro-lines-pagination-label');
    if (linesLabel) {
        linesLabel.textContent = lines.length > 0 ? `1-${lines.length} de ${lines.length}` : '0-0 de 0';
    }

    if (typeof setMetroTableMode === 'function') {
        setMetroTableMode(metroState.tableMode || 'projects');
    }
}
window.metroUpdateDynamicLabels = metroUpdateDynamicLabels;

function metroInitDOMReferences() {
    metroTableBody = document.getElementById('metro-table-body');
    metroEmptyState = document.getElementById('metro-empty-state');
    metroPaginationInfo = document.getElementById('metro-pagination-info');
    metroBtnPrev = document.getElementById('metro-btn-prev');
    metroBtnNext = document.getElementById('metro-btn-next');
    metroBtnResetMap = document.getElementById('metro-btn-reset-map');
}

// ─── Inicialización al cargar el DOM ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    metroInitDOMReferences();
    metroUpdateDynamicLabels();
    if (typeof metroInitTableSorting === 'function') metroInitTableSorting();

    // Paginación
    if (metroBtnPrev) {
        metroBtnPrev.addEventListener('click', () => {
            if (metroState.page > 1) {
                metroState.page--;
                metroFetchData();
            }
        });
    }

    if (metroBtnNext) {
        metroBtnNext.addEventListener('click', () => {
            metroState.page++;
            metroFetchData();
        });
    }

    // Reset Map
    if (metroBtnResetMap) {
        metroBtnResetMap.addEventListener('click', () => {
            metroResetMap();
        });
    }

    // Modal de Cronograma
    const btnOpenTimeline = document.getElementById('metro-btn-timeline');
    const modalTimeline = document.getElementById('metro-timeline-modal');
    const btnCloseTimeline = document.getElementById('metro-btn-close-timeline');

    if (btnOpenTimeline && modalTimeline) {
        btnOpenTimeline.addEventListener('click', () => {
            modalTimeline.classList.add('open');
            renderMetroTimeline();
        });
    }
    if (btnCloseTimeline && modalTimeline) {
        btnCloseTimeline.addEventListener('click', () => {
            modalTimeline.classList.remove('open');
        });
    }

    // Exportar a Excel
    const btnExportExcel = document.getElementById('metro-btn-export-excel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            if (typeof XLSX !== 'undefined') {
                const allProjects = (window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : [];
                const ws = XLSX.utils.json_to_sheet(allProjects);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Metro_Proyectos");
                XLSX.writeFile(wb, "Metro_Santiago_Proyectos.xlsx");
            }
        });
    }

    // Exportar a GeoJSON
    const btnExportGeoJSON = document.getElementById('metro-btn-export-geojson');
    if (btnExportGeoJSON) {
        btnExportGeoJSON.addEventListener('click', () => {
            exportMetroToGeoJSON();
        });
    }

    // Iniciar Módulos
    if (typeof metroLoadFilters === 'function') metroLoadFilters();
    if (typeof metroInitLeafletMap === 'function') metroInitLeafletMap();
    if (typeof metroFetchData === 'function') metroFetchData();
});

/**
 * Exporta los trazados oficiales y estaciones de Metro de Santiago a GeoJSON (.geojson)
 * unificando la red operativa y los proyectos de expansión tal cual se cargan al inicio.
 */
function exportMetroToGeoJSON() {
    const features = [];

    // 1. Líneas en Servicio (Red Operativa)
    if (window.METRO_EXISTING_LINES && Array.isArray(window.METRO_EXISTING_LINES.features)) {
        window.METRO_EXISTING_LINES.features.forEach(f => {
            if (!f || !f.geometry || !f.geometry.coordinates || f.geometry.coordinates.length === 0) return;
            const cloned = JSON.parse(JSON.stringify(f));
            const p = cloned.properties || {};
            cloned.properties = {
                tipo_elemento: "Línea Operativa",
                red: "Metro de Santiago",
                nombre_linea: p.name || (p.ref ? `Línea ${p.ref}` : "Línea Metro"),
                ref: p.ref || "",
                color: p.colour || p.color || (typeof metroGetLineColor === 'function' ? metroGetLineColor(p.name || p.ref) : ""),
                operativa: true,
                ...p
            };
            features.push(cloned);
        });
    }

    // 2. Proyectos de Expansión (Trazados futuros)
    if (window.METRO_GEO_DATA && Array.isArray(window.METRO_GEO_DATA.features)) {
        const allProjects = (window.METRO_DATA && window.METRO_DATA.data) ? window.METRO_DATA.data : [];
        window.METRO_GEO_DATA.features.forEach(f => {
            if (!f || !f.geometry || !f.geometry.coordinates || f.geometry.coordinates.length === 0) return;
            const cloned = JSON.parse(JSON.stringify(f));
            const p = cloned.properties || {};
            const cod = (p.shape_id != null && String(p.shape_id).trim() !== '')
                ? String(p.shape_id).trim()
                : (p.COD != null ? String(p.COD).trim() : (p['@id'] || ''));
            
            const matchedProj = allProjects.find(proj => {
                const shapes = proj.shapes || proj.Shapes || [];
                return shapes.map(String).includes(cod) || proj.name === p.name;
            });

            cloned.properties = {
                tipo_elemento: "Proyecto de Expansión",
                red: "Metro de Santiago",
                nombre_proyecto: (matchedProj && matchedProj.name) || p.name || "Proyecto Metro",
                linea: (matchedProj && matchedProj.line) || p.linea || "",
                etapa: (matchedProj && matchedProj.stage) || p.stage || "En desarrollo",
                inversion_mm_usd: (matchedProj && matchedProj.investment_mm_usd != null) ? matchedProj.investment_mm_usd : (p.investment_mm_usd || null),
                operacion_estimada: (matchedProj && (matchedProj.operation_year || matchedProj.estimated_operation)) || p.inauguracion || "",
                longitud_km: (matchedProj && matchedProj.length_km) || p.length_km || null,
                nuevas_estaciones: (matchedProj && matchedProj.new_stations) || p.new_stations || null,
                comunas_beneficiadas: (matchedProj && Array.isArray(matchedProj.communes)) ? matchedProj.communes.join(', ') : (p.comunas || ""),
                color: (typeof metroGetProjectColor === 'function') ? metroGetProjectColor((matchedProj && matchedProj.line) || p.linea) : (p.color || "#52525b"),
                operativa: false,
                ...p
            };
            features.push(cloned);
        });
    }

    // 3. Estaciones Operativas
    if (window.METRO_EXISTING_STATIONS && Array.isArray(window.METRO_EXISTING_STATIONS.features)) {
        window.METRO_EXISTING_STATIONS.features.forEach(f => {
            if (!f || !f.geometry || !f.geometry.coordinates) return;
            const cloned = JSON.parse(JSON.stringify(f));
            const p = cloned.properties || {};
            cloned.properties = {
                tipo_elemento: "Estación Operativa",
                red: "Metro de Santiago",
                nombre_estacion: p.name || "",
                lineas: p.linea || p.line || "",
                comuna: p.comuna || "",
                es_combinacion: Boolean(p.combinacion || p.is_combination),
                operativa: true,
                ...p
            };
            features.push(cloned);
        });
    }

    // 4. Nuevas Estaciones Futuras
    if (window.METRO_FUTURO_STATIONS && Array.isArray(window.METRO_FUTURO_STATIONS.features)) {
        window.METRO_FUTURO_STATIONS.features.forEach(f => {
            if (!f || !f.geometry || !f.geometry.coordinates) return;
            const cloned = JSON.parse(JSON.stringify(f));
            const p = cloned.properties || {};
            cloned.properties = {
                tipo_elemento: "Estación Futura",
                red: "Metro de Santiago",
                nombre_estacion: p.name || "",
                linea: p.linea || p.line || "",
                comuna: p.comuna || "",
                combinacion_futura: p.combinacion || "",
                inauguracion_estimada: p.inauguracion || "",
                operativa: false,
                ...p
            };
            features.push(cloned);
        });
    }

    if (features.length === 0) {
        alert('No se encontraron geometrías de la Red de Metro para exportar.');
        return;
    }

    const exportCollection = {
        type: "FeatureCollection",
        name: "CATLEC_Metro_Red_Santiago",
        crs: {
            type: "name",
            properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" }
        },
        features: features
    };

    const jsonString = JSON.stringify(exportCollection, null, 2);
    const blob = new Blob([jsonString], { type: "application/geo+json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `CATLEC_Metro_Red_Santiago_${today}.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
