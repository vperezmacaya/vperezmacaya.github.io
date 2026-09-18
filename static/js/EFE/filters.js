// ─── EFE Filters & Data Module ───────────────────────────────────────────────
var currentFilteredEFEProjects = null;
var currentFilteredEFELines = null;
if (typeof window !== 'undefined') {
    window.currentFilteredEFEProjects = currentFilteredEFEProjects;
    window.currentFilteredEFELines = currentFilteredEFELines;
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
    const normProjFilial = CatlecUtils.normalizeAccents(projectFilial);
    return selectedFiliales.some(selected => {
        if (selected === 'Sin filial específica') return false;
        const normSelected = CatlecUtils.normalizeAccents(selected);
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
    CatlecUtils.setupMultiselect('efe-filial', efeAvailableFiliales, 'Todas las filiales', 'filiales seleccionadas', (selected) => {
        efeState.selectedFiliales = selected;
        efeState.page = 1;
        efeFetchData();
    });

    CatlecUtils.setupMultiselect('efe-detail', efeAvailableDetails, 'Toda la cartera', 'carteras seleccionadas', (selected) => {
        efeState.selectedDetails = selected;
        efeState.page = 1;
        efeFetchData();
    });

    CatlecUtils.setupMultiselect('efe-tipo', efeAvailableTipos, 'Todos los tipos', 'tipos seleccionados', (selected) => {
        efeState.selectedTipos = selected;
        efeState.page = 1;
        efeFetchData();
    });

    document.addEventListener('click', CatlecUtils.closeAllMultiselects);

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

function efeFetchData() {
    const allProjects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
    const searchNorm = CatlecUtils.normalizeAccents(efeState.search);

    // ─── 1. Filter Projects (Search, Filial, Cartera, Tipo) ───────────────
    let filtered = allProjects.filter(proj => {
        // Search
        if (searchNorm) {
            const haystack = CatlecUtils.normalizeAccents(proj.name + ' ' + (proj.filial || '') + ' ' + (proj.stage || '') + ' ' + (proj.detail || '') + ' ' + (proj.type || '') + ' ' + (proj.description || ''));
            if (!haystack.includes(searchNorm)) return false;
        }
        // Filial filter
        if (!efeFilialMatchesFilter(proj.filial, efeState.selectedFiliales)) return false;
        // Cartera / Detalle filter (Estratégico vs Preinversional vs Otros)
        if (!efeDetailMatchesFilter(proj.detail, efeState.selectedDetails)) return false;
        // Tipo filter
        if (!efeTipoMatchesFilter(proj.type, efeState.selectedTipos)) return false;
        return true;
    });

    // ─── 2. Filter Operating Lines (Search & Filial) ─────────────────────────
    const allLines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
    let filteredLines = allLines.filter(l => {
        if (searchNorm) {
            const haystack = CatlecUtils.normalizeAccents(
                (l.service || '') + ' ' +
                (l.filial || '') + ' ' +
                (l.terminals || '') + ' ' +
                (l.operational_classification || '') + ' ' +
                (l.regions || '') + ' ' +
                (l.rolling_stock || '') + ' ' +
                (l.traction || '')
            );
            if (!haystack.includes(searchNorm)) return false;
        }
        if (!efeFilialMatchesFilter(l.filial, efeState.selectedFiliales)) return false;
        return true;
    });

    currentFilteredEFELines = filteredLines;
    if (typeof window !== 'undefined') window.currentFilteredEFELines = currentFilteredEFELines;

    currentFilteredEFEProjects = filtered;
    if (typeof window !== 'undefined') window.currentFilteredEFEProjects = currentFilteredEFEProjects;

    // Sort projects
    const sortBy = efeState.sortBy || 'investment_mm_usd';
    const sortOrder = efeState.sortOrder || 'desc';

    filtered.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        if (sortBy === 'investment_mm_usd' || sortBy === 'operation_year') {
            if (sortBy === 'operation_year') {
                const rawA = a[sortBy];
                const rawB = b[sortBy];
                valA = typeof efeGetNumericYear === 'function' ? efeGetNumericYear(rawA) : (rawA != null && !isNaN(rawA) ? Number(rawA) : null);
                valB = typeof efeGetNumericYear === 'function' ? efeGetNumericYear(rawB) : (rawB != null && !isNaN(rawB) ? Number(rawB) : null);
                valA = valA != null ? valA : (sortOrder === 'asc' ? Infinity : -Infinity);
                valB = valB != null ? valB : (sortOrder === 'asc' ? Infinity : -Infinity);
                if (valA !== valB) {
                    return sortOrder === 'asc' ? valA - valB : valB - valA;
                }
                const plusA = String(rawA).includes('+') ? 1 : 0;
                const plusB = String(rawB).includes('+') ? 1 : 0;
                if (plusA !== plusB) {
                    return sortOrder === 'asc' ? plusA - plusB : plusB - plusA;
                }
                return 0;
            } else {
                valA = valA != null && !isNaN(valA) ? Number(valA) : (sortOrder === 'asc' ? Infinity : -Infinity);
                valB = valB != null && !isNaN(valB) ? Number(valB) : (sortOrder === 'asc' ? Infinity : -Infinity);
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }
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

    // Pagination for projects
    const page = efeState.page;
    const pageSize = efeState.pageSize;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    if (page > totalPages) efeState.page = totalPages;
    const startIdx = (efeState.page - 1) * pageSize;
    const pageSlice = filtered.slice(startIdx, startIdx + pageSize);

    // Update tables & KPIs according to active table mode
    if (efeState.tableMode === 'lines') {
        if (typeof efeRenderOperatingLinesTable === 'function') {
            efeRenderOperatingLinesTable(filteredLines);
        }
        const kpiVal1 = document.getElementById('efe-kpi-total-projects');
        const kpiVal2 = document.getElementById('efe-kpi-total-investment');

        const totalServices = filteredLines.length;
        const totalKm = filteredLines.reduce((sum, l) => sum + (typeof l.length_km === 'number' ? l.length_km : (Number(l.length_km) || 0)), 0);

        if (kpiVal1) kpiVal1.textContent = totalServices.toLocaleString('es-CL');
        if (kpiVal2) kpiVal2.textContent = totalKm.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
    } else {
        efeRenderTable(pageSlice);
        efeUpdatePagination(efeState.page, totalPages, totalFiltered);

        if (efeKpiTotalProjects) efeKpiTotalProjects.textContent = totalFiltered;
        if (efeKpiTotalInvestment) {
            const totalInvMM = filtered.reduce((sum, p) => sum + (p.investment_mm_usd || 0), 0);
            efeKpiTotalInvestment.textContent = efeFormatInvestment(totalInvMM);
        }
    }

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

    // Update count badge
    if (efeCountLoaded) efeCountLoaded.textContent = totalFiltered;
    if (efeCountTotal) efeCountTotal.textContent = totalAll;

    // Update analytics charts
    if (typeof efeUpdateAnalyticsCharts === 'function') {
        efeUpdateAnalyticsCharts(filtered);
    }

    // Update investment panel if currently open
    if (efeState.investmentOpen && typeof renderEfeInvestmentAnalytics === 'function') {
        renderEfeInvestmentAnalytics(filtered);
    }

    // Update timeline panel if currently open
    if (efeState.timelineOpen && typeof renderEfeTimeline === 'function') {
        renderEfeTimeline(filtered);
    }

    // Update operacion panel if currently open
    if (efeState.operacionOpen && typeof renderEfeOperacionView === 'function') {
        renderEfeOperacionView(filteredLines);
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

    // Append Líneas Operativas if available
    const lines = (window.EFE_DATA && window.EFE_DATA.lines) ? window.EFE_DATA.lines : [];
    if (lines.length > 0) {
        const lineRows = lines.map(l => ({
            "Servicio": l.service || '',
            "Filial": l.filial || '',
            "Clasificación Operacional": l.operational_classification || '',
            "Cabeceras / Trazado": l.terminals || '',
            "Longitud (km)": l.length_km || 0,
            "Estaciones": l.stations || 0,
            "Pasajeros 2025 (MM)": l.passengers_2025_mm != null ? l.passengers_2025_mm : '',
            "Satisfacción 2025 (%)": l.satisfaction_2025_pct != null ? `${l.satisfaction_2025_pct}%` : '',
            "Tiempo Promedio Viaje (min)": l.travel_time_avg_min != null ? l.travel_time_avg_min : '',
            "Tiempo Total Trayecto (min)": l.travel_time_total_min != null ? l.travel_time_total_min : '',
            "Material Rodante": l.rolling_stock || '',
            "Tracción / Alimentación": l.traction || '',
            "Regiones Conectadas": l.regions || '',
            "Fuente": l.source || ''
        }));
        const wsLines = XLSX.utils.json_to_sheet(lineRows);
        XLSX.utils.book_append_sheet(wb, wsLines, "Lineas_Operativas");
    }

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `CATLEC_EFE_BaseDatos_${today}.xlsx`);
}

/**
 * Exporta el GeoJSON depurado de la red e infraestructura ferroviaria oficial
 * tal como se visualiza en el mapa Leaflet al iniciar la aplicación,
 * descartando features sin infraestructura o proyectos asociados.
 */
function exportEFEToGeoJSON() {
    if (!window.EFE_GEO_DATA || !window.EFE_GEO_DATA.features) {
        alert('No se encontraron datos geográficos de EFE para exportar.');
        return;
    }

    const projects = (window.EFE_DATA && window.EFE_DATA.data) ? window.EFE_DATA.data : [];
    const shapeToProj = {};
    projects.forEach(proj => {
        (proj.shapes || []).forEach(cod => {
            const key = String(cod).trim();
            if (!shapeToProj[key]) shapeToProj[key] = [];
            shapeToProj[key].push({
                nombre_proyecto: proj.name,
                filial: proj.filial || 'Sin filial específica',
                tipo: proj.type || '',
                etapa: proj.stage || '',
                inversion_mm_usd: proj.investment_mm_usd != null ? proj.investment_mm_usd : null,
                operacion_estimada: proj.operation_year || '',
                avance_etapa: proj.progress || null,
                detalle_cartera: proj.detail || ''
            });
        });
    });

    const validFeatures = window.EFE_GEO_DATA.features.filter(feature => {
        if (!feature || !feature.geometry || !feature.geometry.coordinates || feature.geometry.coordinates.length === 0) {
            return false;
        }
        if (typeof efeHasValidShapeAttribute === 'function') {
            return efeHasValidShapeAttribute(feature);
        }
        const props = feature.properties || {};
        const cod = props.COD != null ? String(props.COD).trim() : '';
        const hasProj = cod && shapeToProj[cod] && shapeToProj[cod].length > 0;
        const hasLine = cod && typeof efeShapeToLines !== 'undefined' && efeShapeToLines[cod] && efeShapeToLines[cod].length > 0;
        return Boolean(hasProj || hasLine);
    }).map(feature => {
        const cloned = JSON.parse(JSON.stringify(feature));
        const props = cloned.properties || {};
        const cod = props.COD != null ? String(props.COD).trim() : '';
        if (cod && shapeToProj[cod]) {
            const projs = shapeToProj[cod];
            if (projs.length === 1) {
                cloned.properties.proyecto = projs[0].nombre_proyecto;
                cloned.properties.filial = projs[0].filial;
                cloned.properties.tipo = projs[0].tipo;
                cloned.properties.etapa = projs[0].etapa;
                cloned.properties.inversion_mm_usd = projs[0].inversion_mm_usd;
                cloned.properties.operacion_estimada = projs[0].operacion_estimada;
                cloned.properties.avance_etapa = projs[0].avance_etapa;
            } else {
                cloned.properties.proyectos_asociados = projs.map(p => p.nombre_proyecto).join(' | ');
            }
        }
        return cloned;
    });

    const exportCollection = {
        type: "FeatureCollection",
        name: "CATLEC_EFE_Red_Ferroviaria",
        crs: window.EFE_GEO_DATA.crs || {
            type: "name",
            properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" }
        },
        features: validFeatures
    };

    CatlecUtils.downloadGeoJSON(exportCollection, 'CATLEC_EFE_Red_Ferroviaria');
}



