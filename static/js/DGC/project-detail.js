// Vista de detalle de proyecto: navegación prev/next y render del panel completo

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

async function showProjectDetailView(code) {
    if (!code) return;
    const cleanCode = code.toString().trim();

    const alreadyOpen = projectDetailView && projectDetailView.style.display === 'flex';
    const visibleListView = (tableContainerView && tableContainerView.style.display !== 'none') ? tableContainerView : null;

    if (!alreadyOpen && visibleListView && projectDetailView && typeof CatlecUtils !== 'undefined') {
        CatlecUtils.swapView(visibleListView, projectDetailView, { direction: 'forward' });
    } else {
        if (tableContainerView) tableContainerView.style.display = 'none';
        if (projectDetailView) projectDetailView.style.display = 'flex';
    }
    if (projectDetailView) projectDetailView.scrollTop = 0;
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

    const badgeClass = getStatusBadgeClass(status);

    const titleName = (item && item['Nombre de uso común']) || (item && item['Nombre de la Concesión ']) || (projectMetadata[cleanCode] && projectMetadata[cleanCode].name) || 'Concesión';

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

    // Foto de referencia (Fotos/DGC → WebP en static/img/fotos/DGC, cruce por código en el ETL)
    let photoHTML = '';
    const photoUrl = item && item.photo;
    if (photoUrl) {
        photoHTML = `
            <div class="detail-photo-wrapper">
                <img src="${encodeURI(photoUrl)}" data-full="${encodeURI(item.photo_full || photoUrl)}" alt="${titleName}" class="detail-project-photo dgc-photo-zoomable" title="Ver imagen completa" loading="eager" onerror="this.closest('.detail-photo-wrapper').remove();">
                <span class="dgc-photo-ai-note">Imagen de referencia generada por IA</span>
            </div>
        `;
    }

    // Build bidders HTML section (Contenedores por oferente con desglose de consorcio)
    const biddersList = (item && item.bidders) || (projectMetadata[cleanCode] && projectMetadata[cleanCode].bidders) || [];
    const isEnLicitacion = getStatusKey(status) === 'licitacion';

    const biddersTitle = (countBadge = '') => `
        <h4 class="detail-title dgc-bidders-title">
            <span><i data-lucide="users" class="icon-14 icon-color-primary"></i>Oferentes / Licitantes</span>
            ${countBadge}
        </h4>
    `;

    let biddersHTML = '';
    if (biddersList && biddersList.length > 0) {
        const bidderItems = biddersList.map(b => {
            const isAwarded = b.adjudicado || (b.adjudicado_raw && b.adjudicado_raw.toUpperCase().startsWith('S'));
            const badge = isAwarded
                ? `<span class="badge badge-success"><i data-lucide="award"></i>Adjudicado</span>`
                : '';
            const empresasFmt = b.empresas
                ? b.empresas.split(';').map(s => s.trim()).filter(Boolean).join(' - ')
                : '';

            return `
                <li class="dgc-bidder-item">
                    <div class="dgc-bidder-info">
                        <span class="dgc-bidder-name">${b.name}</span>
                        ${empresasFmt ? `<span class="dgc-bidder-members">${empresasFmt}</span>` : ''}
                    </div>
                    ${badge}
                </li>
            `;
        }).join('');

        biddersHTML = `
            <div class="detail-section">
                ${biddersTitle(`<span class="badge badge-neutral">${biddersList.length}</span>`)}
                <ul class="dgc-bidder-list">
                    ${bidderItems}
                </ul>
            </div>
        `;
    } else if (isEnLicitacion) {
        biddersHTML = `
            <div class="detail-section">
                ${biddersTitle()}
                <div class="dgc-detail-notice dgc-detail-notice--licitacion">
                    <i data-lucide="hourglass"></i>
                    <span>Concesión en proceso de licitación. Los oferentes se publicarán tras la apertura de ofertas.</span>
                </div>
            </div>
        `;
    } else {
        biddersHTML = `
            <div class="detail-section">
                ${biddersTitle()}
                <div class="dgc-detail-notice dgc-detail-notice--empty">
                    <i data-lucide="info"></i>
                    <span>No se registran licitantes en la base de datos para este proyecto.</span>
                </div>
            </div>
        `;
    }

    // Historial de licitaciones (solo si el grupo tiene más de una concesión)
    let relicitNavHTML = '';
    const groupNodes = (item && item.group_timeline) ? item.group_timeline : [];
    // Sort by seq ascending (1=primera, 2=segunda, ...)
    const sortedNodes = [...groupNodes].sort((a, b) => a.seq - b.seq);
    if (sortedNodes.length > 1) {
        const seqWords = ['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta', 'Séptima', 'Octava'];
        const seqLabel = (seq) => (seqWords[seq - 1] || `N°${seq}`) + ' Licitación';
        const compact = sortedNodes.length > 3;

        const segments = sortedNodes.map(node => {
            const isActive = node.code === cleanCode;
            return `<button type="button" class="dgc-seg-btn${isActive ? ' active' : ''}" role="tab"
                aria-selected="${isActive}" data-code="${node.code}"
                title="${seqLabel(node.seq)}: ${node.name || node.code}${node.status ? ` (${node.status})` : ''}">
                <span class="dgc-status-dot dgc-status-dot--${getStatusKey(node.status)}"></span>
                ${node.seq}ª${compact ? '' : ' Licitación'}
            </button>`;
        }).join('');

        relicitNavHTML = `
            <div class="detail-section dgc-relicit">
                <span class="dgc-section-caption">Historial de licitaciones · ${sortedNodes.length}</span>
                <div class="dgc-seg" role="tablist">${segments}</div>
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
            <div class="dgc-detail-head">
                <div class="dgc-detail-head-row">
                    <h3 class="dgc-detail-title">${titleName}</h3>
                    <span class="badge ${badgeClass}">${status || sector}</span>
                </div>
                <div class="dgc-detail-subrow">
                    <button type="button" id="btn-view-in-timeline" class="btn btn-ghost btn-xs" title="Ver en línea de tiempo">
                        <i data-lucide="gantt-chart"></i>
                        Línea de tiempo
                    </button>
                </div>
            </div>

            ${relicitNavHTML}

            <div class="detail-section">
                <h4 class="detail-title" style="font-size: 0.78rem; margin-bottom: 0.35rem;">Descripción</h4>
                <p class="detail-desc" style="font-size: 0.76rem; line-height: 1.45;">${(item && item['Descripción ']) || 'No se registra descripción en la base de datos.'}</p>
            </div>

            ${photoHTML}

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

    const photoImg = detailViewBody && detailViewBody.querySelector('.dgc-photo-zoomable');
    if (photoImg) {
        photoImg.addEventListener('click', () => openDgcPhotoLightbox(photoImg.dataset.full, photoImg.alt));
    }

    const relicitSeg = detailViewBody && detailViewBody.querySelector('.dgc-seg');
    if (relicitSeg) {
        relicitSeg.addEventListener('click', (e) => {
            const btn = e.target.closest('.dgc-seg-btn');
            if (btn && !btn.classList.contains('active') && btn.dataset.code) {
                zoomToProjectCode(btn.dataset.code);
            }
        });
    }

    lucide.createIcons();
}

// Visor a tamaño completo de la foto de referencia (se crea una sola vez)
let dgcPhotoLightbox = null;
let dgcPhotoLightboxReleaseTimer = null;

function openDgcPhotoLightbox(src, alt) {
    if (dgcPhotoLightboxReleaseTimer) {
        clearTimeout(dgcPhotoLightboxReleaseTimer);
        dgcPhotoLightboxReleaseTimer = null;
    }
    if (!dgcPhotoLightbox) {
        dgcPhotoLightbox = document.createElement('div');
        dgcPhotoLightbox.className = 'dgc-photo-lightbox';
        dgcPhotoLightbox.setAttribute('role', 'dialog');
        dgcPhotoLightbox.setAttribute('aria-modal', 'true');
        dgcPhotoLightbox.innerHTML = `
            <button type="button" class="dgc-photo-lightbox-close" title="Cerrar (Esc)" aria-label="Cerrar">
                <i data-lucide="x"></i>
            </button>
            <figure class="dgc-photo-lightbox-figure">
                <img class="dgc-photo-lightbox-img" alt="">
                <span class="dgc-photo-ai-note">Imagen de referencia generada por IA</span>
            </figure>
        `;
        document.body.appendChild(dgcPhotoLightbox);

        dgcPhotoLightbox.addEventListener('click', (e) => {
            if (!e.target.closest('.dgc-photo-lightbox-img')) closeDgcPhotoLightbox();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && dgcPhotoLightbox.classList.contains('open')) closeDgcPhotoLightbox();
        });
        lucide.createIcons();
    }

    const img = dgcPhotoLightbox.querySelector('.dgc-photo-lightbox-img');
    img.src = src;
    img.alt = alt || '';
    dgcPhotoLightbox.classList.add('open');
}

function closeDgcPhotoLightbox() {
    if (!dgcPhotoLightbox || !dgcPhotoLightbox.classList.contains('open')) return;
    dgcPhotoLightbox.classList.remove('open');

    // Suelta la foto (y su versión decodificada) al terminar el fundido de
    // cierre (0,2 s en dgc_addons.css); openDgcPhotoLightbox cancela el
    // temporizador si el visor se vuelve a abrir entretanto.
    dgcPhotoLightboxReleaseTimer = setTimeout(() => {
        dgcPhotoLightboxReleaseTimer = null;
        dgcPhotoLightbox.querySelector('.dgc-photo-lightbox-img').removeAttribute('src');
    }, 250);
}
