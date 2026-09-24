// Vista de detalle de proyecto: navegación prev/next y render del panel

function updateDetailNavButtons(index, list) {
    const btnDetailPrev = document.getElementById('mop-btn-detail-prev');
    const btnDetailNext = document.getElementById('mop-btn-detail-next');

    if (!btnDetailPrev || !btnDetailNext) return;

    if (index > 0) {
        btnDetailPrev.disabled = false;
        btnDetailPrev.style.opacity = '1';
        btnDetailPrev.style.cursor = 'pointer';
        btnDetailPrev.style.pointerEvents = 'auto';
        btnDetailPrev.onclick = (e) => {
            e.stopPropagation();
            showProjectDetail(list[index - 1], index - 1);
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
        btnDetailNext.onclick = (e) => {
            e.stopPropagation();
            showProjectDetail(list[index + 1], index + 1);
        };
    } else {
        btnDetailNext.disabled = true;
        btnDetailNext.style.opacity = '0.35';
        btnDetailNext.style.cursor = 'not-allowed';
        btnDetailNext.style.pointerEvents = 'none';
        btnDetailNext.onclick = null;
    }
}

function showProjectDetail(p, globalIndex) {
    const tableView = document.getElementById('mop-table-container-view');
    const detailView = document.getElementById('mop-project-detail-view');
    const detailBody = document.getElementById('mop-detail-view-body');
    if (!tableView || !detailView || !detailBody || !p) return;

    const alreadyOpen = detailView.style.display === 'flex';
    if (!alreadyOpen && tableView.style.display !== 'none' && typeof CatlecUtils !== 'undefined') {
        CatlecUtils.swapView(tableView, detailView, { direction: 'forward' });
    } else {
        tableView.style.display = 'none';
        detailView.style.display = 'flex';
    }
    detailView.scrollTop = 0;
    detailBody.scrollTop = 0;

    const sorted = getSortedProjects();
    const index = typeof globalIndex === 'number' ? globalIndex : sorted.indexOf(p);
    updateDetailNavButtons(index, sorted);

    const costFmt = p.cost_mm > 0 ? `$${p.cost_mm.toLocaleString('es-CL')} MM CLP` : 'No informado';
    const hasDesc = p.descripcion && p.descripcion.trim().length > 0;
    const descText = hasDesc ? escapeHtml(p.descripcion) : 'No se registra descripción en la base de datos.';
    const hasLoc = p.localizacion && p.localizacion.trim().length > 0 && p.localizacion.trim() !== '—';
    const locText = hasLoc ? escapeHtml(p.localizacion) : 'No informada';
    const badgeClass = getStageBadgeClass(p.etapa);
    const titleName = escapeHtml(p.nombre) || 'Iniciativa MOP';

    detailBody.innerHTML = `
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.1rem;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
                <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); line-height: 1.35; font-family: var(--font-heading); flex: 1; min-width: 0;">${titleName}</h3>
                <span class="badge ${badgeClass}" style="flex-shrink: 0; font-size: 0.7rem; padding: 0.2rem 0.5rem; white-space: nowrap; margin-top: 2px;">${escapeHtml(p.etapa) || 'Sin etapa'}</span>
            </div>
            <div style="font-size: 0.75rem; color: #0d9488; font-weight: 600; margin-top: 0.25rem;">${escapeHtml(p.servicio) || 'Servicio MOP'}</div>
        </div>

        <!-- Sección Descripción -->
        <div class="detail-section" style="margin-top: 0.4rem;">
            <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.35rem;">Descripción</h4>
            <p class="detail-desc" style="font-size: 0.76rem; line-height: 1.45;">${descText}</p>
        </div>

        <!-- Datos de la Iniciativa (Detail Grid exacto a index.html) -->
        <div class="detail-section" style="margin-top: 0.4rem;">
            <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.4rem;">Datos de la Iniciativa</h4>
            <div class="detail-grid" style="grid-template-columns: 130px 1fr; gap: 0.35rem; font-size: 0.74rem;">
                <span class="detail-label">Código BIP:</span>
                <span class="detail-value" style="font-family: var(--font-mono, monospace); font-weight: 600;">${escapeHtml(p.bip || 'No informado')}</span>

                <span class="detail-label">Servicio MOP:</span>
                <span class="detail-value">${escapeHtml(p.servicio || 'No especificado')}</span>

                <span class="detail-label">Programa:</span>
                <span class="detail-value">${escapeHtml(p.programa || 'No especificado')}</span>

                <span class="detail-label">Región:</span>
                <span class="detail-value">${formatRegionCell(p.region)}</span>

                <span class="detail-label">Comuna / Localización:</span>
                <span class="detail-value">${locText}</span>

                <span class="detail-label">Etapa Ciclo de Vida:</span>
                <span class="detail-value"><span class="badge ${badgeClass}">${escapeHtml(p.etapa || 'No informada')}</span></span>

                <span class="detail-label">Costo Total Estimado:</span>
                <span class="detail-value" style="font-weight: 700; color: #3b82f6;">${costFmt}</span>

                <span class="detail-label">Año Primera Postulación:</span>
                <span class="detail-value">${p.year || 'No informado'}</span>

                <span class="detail-label">Año Última Postulación:</span>
                <span class="detail-value">${p.year_ult || 'No informado'}</span>
            </div>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();

    const backBtn = document.getElementById('mop-btn-back-to-list');
    if (backBtn) {
        backBtn.onclick = hideProjectDetail;
    }
}

function hideProjectDetail() {
    const tableView = document.getElementById('mop-table-container-view');
    const detailView = document.getElementById('mop-project-detail-view');
    if (!tableView || !detailView) return;

    if (detailView.style.display === 'flex' && typeof CatlecUtils !== 'undefined') {
        CatlecUtils.swapView(detailView, tableView, { direction: 'back' });
    } else {
        detailView.style.display = 'none';
        tableView.style.display = 'flex';
    }
}
