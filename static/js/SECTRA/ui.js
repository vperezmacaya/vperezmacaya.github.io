// ─── UI, KPIs & Renderizado de Tablas / Ficha SECTRA ──────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initSectraFilters();
    initSectraMap();
    initSectraCharts();
    initSectraUI();
    
    // Renderizado inicial
    onFilterChanged();
    
    // Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }
});

function initSectraUI() {
    // 1. Paginador de la tabla
    const btnPrev = document.getElementById('sectra-btn-prev');
    const btnNext = document.getElementById('sectra-btn-next');
    
    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (sectraState.page > 1) {
                sectraState.page--;
                renderSectraTable();
            }
        });
    }
    
    if (btnNext) {
        btnNext.addEventListener('click', () => {
            const projs = getFilteredProjects();
            const maxPage = Math.ceil(projs.length / sectraState.pageSize) || 1;
            if (sectraState.page < maxPage) {
                sectraState.page++;
                renderSectraTable();
            }
        });
    }
    
    // 2. Ordenamiento de Columnas
    const tableHead = document.getElementById('sectra-table-head');
    if (tableHead) {
        tableHead.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const sortKey = th.getAttribute('data-sort');
                if (sectraState.sortBy === sortKey) {
                    sectraState.sortOrder = sectraState.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    sectraState.sortBy = sortKey;
                    sectraState.sortOrder = 'asc';
                }
                
                tableHead.querySelectorAll('th.sortable').forEach(h => h.classList.remove('asc', 'desc'));
                th.classList.add(sectraState.sortOrder);
                
                sectraState.page = 1;
                renderSectraTable();
            });
        });
    }
    
    // 3. Botón Volver a la Lista en Ficha del Proyecto
    const btnBackToList = document.getElementById('btn-back-to-list');
    if (btnBackToList) {
        btnBackToList.addEventListener('click', showTableListView);
    }
    
    // 4. Navegación Anterior / Siguiente en Ficha de Proyecto
    const btnDetailPrev = document.getElementById('btn-detail-prev');
    const btnDetailNext = document.getElementById('btn-detail-next');
    
    if (btnDetailPrev) {
        btnDetailPrev.addEventListener('click', () => navigateDetailProject(-1));
    }
    if (btnDetailNext) {
        btnDetailNext.addEventListener('click', () => navigateDetailProject(1));
    }
}

function renderSectraKPIs() {
    const projs = getFilteredProjects();
    
    // 1. Total Proyectos
    const kpiTotal = document.getElementById('kpi-total');
    if (kpiTotal) kpiTotal.textContent = formatNumberCL(projs.length);
    
    // 2. Inversión Total (UF)
    let totalInv = 0;
    projs.forEach(p => {
        if (p.investment && !isNaN(p.investment)) {
            totalInv += Number(p.investment);
        }
    });
    const kpiInv = document.getElementById('kpi-investment');
    if (kpiInv) {
        kpiInv.textContent = totalInv > 0 ? `${formatNumberCL(Math.round(totalInv))} UF` : '—';
    }
    
    // 3. Ciudades / Áreas Urbanas únicas
    const citiesSet = new Set(projs.map(p => p.city).filter(Boolean));
    const kpiCities = document.getElementById('kpi-total-cities');
    if (kpiCities) kpiCities.textContent = formatNumberCL(citiesSet.size);
    
    // 4. Regiones únicas
    const regSet = new Set(projs.map(p => p.region).filter(Boolean));
    const kpiReg = document.getElementById('kpi-total-regions');
    if (kpiReg) kpiReg.textContent = formatNumberCL(regSet.size);
}

function renderSectraTable() {
    const tableBody = document.getElementById('sectra-table-body');
    const countLoaded = document.getElementById('sectra-count-loaded');
    const countTotal = document.getElementById('sectra-count-total');
    const pagInfo = document.getElementById('sectra-pagination-info');
    const btnPrev = document.getElementById('sectra-btn-prev');
    const btnNext = document.getElementById('sectra-btn-next');
    
    if (!tableBody) return;
    
    let projs = getFilteredProjects();
    
    // Ordenamiento
    projs.sort((a, b) => {
        let valA = a[sectraState.sortBy];
        let valB = b[sectraState.sortBy];
        
        if (sectraState.sortBy === 'investment' || sectraState.sortBy === 'tir') {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
            return sectraState.sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        
        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
        return sectraState.sortOrder === 'asc' ? valA.localeCompare(valB, 'es') : valB.localeCompare(valA, 'es');
    });
    
    const total = projs.length;
    const startIdx = (sectraState.page - 1) * sectraState.pageSize;
    const endIdx = Math.min(startIdx + sectraState.pageSize, total);
    const pagedProjs = projs.slice(startIdx, endIdx);
    
    if (countLoaded) countLoaded.textContent = formatNumberCL(pagedProjs.length);
    if (countTotal) countTotal.textContent = formatNumberCL(total);
    if (pagInfo) pagInfo.textContent = `${total === 0 ? 0 : startIdx + 1} - ${endIdx} de ${total}`;
    
    if (btnPrev) btnPrev.disabled = sectraState.page <= 1;
    if (btnNext) btnNext.disabled = endIdx >= total;
    
    tableBody.innerHTML = '';
    
    if (pagedProjs.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    No se encontraron proyectos con los filtros seleccionados.
                </td>
            </tr>
        `;
        return;
    }
    
    pagedProjs.forEach(p => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        
        // Status badge color matching map palette
        let statusBadgeStyle = 'background: rgba(100, 116, 139, 0.15); color: #64748b; border: 1px solid rgba(100, 116, 139, 0.3);';
        if (/ejecuci[oó]n|obra/i.test(p.status)) {
            statusBadgeStyle = 'background: rgba(5, 150, 105, 0.15); color: #059669; border: 1px solid rgba(5, 150, 105, 0.3);';
        } else if (/dise[ñn]o|ingenier/i.test(p.status)) {
            statusBadgeStyle = 'background: rgba(37, 99, 235, 0.15); color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.3);';
        } else if (/prefactibilidad|factibilidad|anteproyecto/i.test(p.status)) {
            statusBadgeStyle = 'background: rgba(8, 145, 178, 0.15); color: #0891b2; border: 1px solid rgba(8, 145, 178, 0.3);';
        } else if (/perfil|estudio/i.test(p.status)) {
            statusBadgeStyle = 'background: rgba(217, 119, 6, 0.15); color: #d97706; border: 1px solid rgba(217, 119, 6, 0.3);';
        }
        
        const shortReg = shortenRegionLabel(p.region);
        const invFormatted = p.investment ? `${formatNumberCL(Math.round(p.investment))} UF` : '<span style="color:var(--text-muted);">S/I</span>';
        const tirFormatted = p.tir ? `${p.tir}%` : '<span style="color:var(--text-muted);">-</span>';
        
        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--text-primary); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${p.name}">
                ${p.name}
            </td>
            <td style="color: var(--text-secondary); font-size: 0.72rem;">${shortReg}</td>
            <td style="color: var(--text-secondary); font-size: 0.72rem; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${p.city}">${p.city || '—'}</td>
            <td style="text-align: right; font-family: monospace; font-size: 0.72rem; font-weight: 600; color: #2563eb;">${invFormatted}</td>
            <td style="text-align: center; font-size: 0.72rem;">${tirFormatted}</td>
            <td style="color: var(--text-secondary); font-size: 0.72rem; max-width: 75px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${p.mandante}">${p.mandante || '—'}</td>
            <td><span style="display:inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 600; ${statusBadgeStyle}">${p.status || 'En Estudio'}</span></td>
        `;
        
        tr.addEventListener('click', () => {
            showProjectDetailView(p);
            zoomToProjectOnMap(p.id);
        });
        
        tableBody.appendChild(tr);
    });
}

// ─── Ficha del Proyecto (Reemplaza la tabla en el panel derecho) ───────────────

function showProjectDetailView(p) {
    if (!p) return;
    
    sectraState.selectedProjectId = p.id;
    
    const tableView = document.getElementById('table-container-view');
    const detailView = document.getElementById('project-detail-view');
    const detailBody = document.getElementById('detail-view-body');
    
    if (!detailView || !detailBody) return;
    
    // Ocultar tabla y mostrar ficha
    if (tableView) tableView.style.display = 'none';
    detailView.style.display = 'flex';
    
    // Actualizar botones prev / next
    updateDetailNavButtons(p.id);
    
    const statusColor = getSectraStatusColor(p.status);
    const shortReg = shortenRegionLabel(p.region);
    const invFormatted = p.investment ? `${formatNumberCL(p.investment)} ${p.moneda || 'UF'}` : 'Sin Información';
    
    detailBody.innerHTML = `
        <!-- Title & Badges Header -->
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.6rem;">
            <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.35rem;">
                <span style="background: rgba(37, 99, 235, 0.1); color: var(--primary); border: 1px solid rgba(37, 99, 235, 0.25); border-radius: 4px; padding: 2px 6px; font-size: 0.68rem; font-weight: 600;">
                    ${p.region || 'Chile'}
                </span>
                <span style="background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border: 1px solid var(--border-color); border-radius: 4px; padding: 2px 6px; font-size: 0.68rem; font-weight: 500;">
                    ${p.city || 'Área Urbana'}
                </span>
                <span style="background: rgba(5, 150, 105, 0.1); color: ${statusColor}; border: 1px solid ${statusColor}40; border-radius: 4px; padding: 2px 6px; font-size: 0.68rem; font-weight: 600; margin-left: auto;">
                    ${p.status || 'En Estudio'}
                </span>
            </div>
            <h3 style="font-family: var(--font-heading); font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.35;">
                ${p.name}
            </h3>
        </div>

        <!-- Metric Cards 2x2 Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem;">
            <div class="card-kpi" style="padding: 0.5rem; gap: 0.4rem;">
                <div class="kpi-icon" style="width: 26px; height: 26px; min-width: 26px;"><i data-lucide="trending-up" style="width: 13px; height: 13px;"></i></div>
                <div class="kpi-val-container">
                    <span class="kpi-label" style="font-size: 0.62rem;">Inversión Estimada</span>
                    <span class="kpi-value" style="font-size: 0.84rem; color: #2563eb;">${invFormatted}</span>
                </div>
            </div>
            
            <div class="card-kpi" style="padding: 0.5rem; gap: 0.4rem;">
                <div class="kpi-icon" style="width: 26px; height: 26px; min-width: 26px;"><i data-lucide="percent" style="width: 13px; height: 13px;"></i></div>
                <div class="kpi-val-container">
                    <span class="kpi-label" style="font-size: 0.62rem;">TIR / Rentabilidad</span>
                    <span class="kpi-value" style="font-size: 0.84rem;">${p.tir ? p.tir + '%' : 'S/I'}</span>
                </div>
            </div>
            
            <div class="card-kpi" style="padding: 0.5rem; gap: 0.4rem;">
                <div class="kpi-icon" style="width: 26px; height: 26px; min-width: 26px;"><i data-lucide="building" style="width: 13px; height: 13px;"></i></div>
                <div class="kpi-val-container">
                    <span class="kpi-label" style="font-size: 0.62rem;">Mandante</span>
                    <span class="kpi-value" style="font-size: 0.8rem;">${p.mandante || '—'}</span>
                </div>
            </div>
            
            <div class="card-kpi" style="padding: 0.5rem; gap: 0.4rem;">
                <div class="kpi-icon" style="width: 26px; height: 26px; min-width: 26px;"><i data-lucide="activity" style="width: 13px; height: 13px;"></i></div>
                <div class="kpi-val-container">
                    <span class="kpi-label" style="font-size: 0.62rem;">Estado</span>
                    <span class="kpi-value" style="font-size: 0.78rem; color:${statusColor};">${p.status || 'En Estudio'}</span>
                </div>
            </div>
        </div>

        <!-- Description Box -->
        <div style="background: var(--bg-sidebar); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.75rem;">
            <div style="font-size: 0.68rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.3rem;">
                <i data-lucide="file-text" style="width: 12px; height: 12px; color: var(--primary);"></i>
                Descripción del Proyecto
            </div>
            <p style="font-size: 0.76rem; color: var(--text-primary); line-height: 1.5; margin: 0;">
                ${p.description || 'Sin descripción detallada disponible en la base de datos SECTRA.'}
            </p>
        </div>

        <!-- Action Link -->
        ${p.link ? `
        <div style="display: flex; justify-content: flex-end; margin-top: auto; padding-top: 0.35rem;">
            <a href="${p.link}" target="_blank" rel="noopener noreferrer" class="btn-reset" 
                style="padding: 0.35rem 0.75rem; font-size: 0.72rem; background: var(--primary); color: #ffffff; text-decoration: none; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600;">
                <i data-lucide="external-link" style="width: 12px; height: 12px;"></i> Ver Ficha Oficial SECTRA
            </a>
        </div>
        ` : ''}
    `;
    
    if (window.lucide) window.lucide.createIcons();
}

function showTableListView() {
    sectraState.selectedProjectId = null;
    
    const tableView = document.getElementById('table-container-view');
    const detailView = document.getElementById('project-detail-view');
    
    if (detailView) detailView.style.display = 'none';
    if (tableView) tableView.style.display = 'flex';
    
    if (typeof filterSectraMapLayers === 'function') {
        filterSectraMapLayers();
    }
}

function updateDetailNavButtons(currentId) {
    const projs = getFilteredProjects();
    const currIdx = projs.findIndex(p => p.id === currentId);
    
    const btnPrev = document.getElementById('btn-detail-prev');
    const btnNext = document.getElementById('btn-detail-next');
    
    if (btnPrev) btnPrev.disabled = currIdx <= 0;
    if (btnNext) btnNext.disabled = currIdx < 0 || currIdx >= projs.length - 1;
}

function navigateDetailProject(step) {
    const projs = getFilteredProjects();
    const currIdx = projs.findIndex(p => p.id === sectraState.selectedProjectId);
    if (currIdx === -1) return;
    
    const newIdx = currIdx + step;
    if (newIdx >= 0 && newIdx < projs.length) {
        const nextProj = projs[newIdx];
        showProjectDetailView(nextProj);
        zoomToProjectOnMap(nextProj.id);
    }
}

function openSectraModalById(id) {
    if (!window.SECTRA_DATA || !window.SECTRA_DATA.projects) return;
    const p = window.SECTRA_DATA.projects.find(x => x.id === id);
    if (p) {
        showProjectDetailView(p);
        zoomToProjectOnMap(p.id);
    }
}

function renderSectraConurbations() {
    const listEl = document.getElementById('sectra-conurbations-list');
    if (!listEl) return;
    
    const conurbs = getFilteredConurbations();
    listEl.innerHTML = '';
    
    if (conurbs.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No hay conurbaciones disponibles con los filtros actuales.</div>';
        return;
    }
    
    conurbs.forEach(c => {
        const card = document.createElement('div');
        card.className = 'panel-card';
        card.style.cssText = 'padding: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem;';
        
        card.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.35rem;">
                <div>
                    <h4 style="font-size: 0.84rem; font-weight: 700; color: var(--text-primary); margin: 0;">${c.city || 'Conurbación'}</h4>
                    <span style="font-size: 0.68rem; color: var(--primary);">${c.region || 'Chile'}</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 0.65rem; color: var(--text-muted); display: block;">Plazo Plan Maestro</span>
                    <strong style="font-size: 0.74rem; color: #059669;">${c.plazo_ejecucion || 'S/I'}</strong>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; font-size: 0.7rem; margin-top: 0.15rem;">
                <div style="background: var(--bg-sidebar); border: 1px solid var(--border-color); padding: 0.35rem; border-radius: 4px;">
                    <span style="color: var(--text-muted); display: block; font-size: 0.62rem;">Población</span>
                    <strong>${formatNumberCL(c.poblacion)}</strong>
                </div>
                <div style="background: var(--bg-sidebar); border: 1px solid var(--border-color); padding: 0.35rem; border-radius: 4px;">
                    <span style="color: var(--text-muted); display: block; font-size: 0.62rem;">Hogares</span>
                    <strong>${formatNumberCL(c.hogares)}</strong>
                </div>
                <div style="background: var(--bg-sidebar); border: 1px solid var(--border-color); padding: 0.35rem; border-radius: 4px;">
                    <span style="color: var(--text-muted); display: block; font-size: 0.62rem;">Vehículos Privados</span>
                    <strong>${formatNumberCL(c.vehiculos_privados)}</strong>
                </div>
                <div style="background: var(--bg-sidebar); border: 1px solid var(--border-color); padding: 0.35rem; border-radius: 4px;">
                    <span style="color: var(--text-muted); display: block; font-size: 0.62rem;">Red Vial (km)</span>
                    <strong>${formatNumberCL(c.redes_viales_km)}</strong>
                </div>
                <div style="background: var(--bg-sidebar); border: 1px solid var(--border-color); padding: 0.35rem; border-radius: 4px;">
                    <span style="color: var(--text-muted); display: block; font-size: 0.62rem;">Viajes Diarios</span>
                    <strong>${formatNumberCL(c.viajes_diarios)}</strong>
                </div>
                <div style="background: var(--bg-sidebar); border: 1px solid var(--border-color); padding: 0.35rem; border-radius: 4px;">
                    <span style="color: var(--text-muted); display: block; font-size: 0.62rem;">Valor Cartera (UF)</span>
                    <strong style="color: #2563eb;">${formatNumberCL(c.valor_cartera_uf)}</strong>
                </div>
            </div>
        `;
        listEl.appendChild(card);
    });
}

function exportSectraToExcel() {
    if (!window.XLSX) {
        alert('Librería SheetJS no cargada.');
        return;
    }
    
    const projs = getFilteredProjects();
    const rows = projs.map(p => ({
        'ID': p.id,
        'Proyecto': p.name,
        'Región': p.region,
        'Ciudad / Conurbación': p.city,
        'Inversión': p.investment,
        'Moneda': p.moneda || 'UF',
        'TIR (%)': p.tir,
        'Mandante': p.mandante,
        'Estado': p.status,
        'Descripción': p.description,
        'Link Ficha': p.link
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Proyectos_SECTRA');
    XLSX.writeFile(wb, 'Proyectos_SECTRA_Filtrados.xlsx');
}
