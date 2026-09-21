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
