// Exportación de datos DGC a Excel y GeoJSON

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

/**
 * Exporta las geometrías y trazados oficiales de concesiones DGC a GeoJSON (.geojson)
 * respetando las geometrías oficiales iniciales de la plataforma (excluyendo shapes huérfanos).
 */
function exportDGCToGeoJSON() {
    if (!window.DGC_DATA || !window.DGC_DATA.features || window.DGC_DATA.features.length === 0) {
        alert('No se encontraron geometrías de concesiones DGC para exportar.');
        return;
    }

    const allContracts = (window.STATIC_DATA && window.STATIC_DATA.data)
        ? window.STATIC_DATA.data
        : (window.contractsData || []);

    // Construir mapa de COD de shape -> Proyectos de Concesión asociados
    const shapeToContracts = {};
    allContracts.forEach(p => {
        const shapes = p.shapes || p.Shapes || [];
        if (Array.isArray(shapes)) {
            shapes.forEach(s => {
                const sid = String(s).trim();
                if (sid) {
                    if (!shapeToContracts[sid]) shapeToContracts[sid] = [];
                    shapeToContracts[sid].push(p);
                }
            });
        }
    });

    const validFeatures = window.DGC_DATA.features.filter(feature => {
        if (!feature || !feature.geometry || !feature.geometry.coordinates || feature.geometry.coordinates.length === 0) {
            return false;
        }
        const props = feature.properties || {};
        const cod = props.COD != null ? String(props.COD).trim() : '';
        // Solo incluir si tiene un COD asociado a alguna concesión registrada
        return Boolean(cod && shapeToContracts[cod] && shapeToContracts[cod].length > 0);
    }).map(feature => {
        const cloned = JSON.parse(JSON.stringify(feature));
        const props = cloned.properties || {};
        const cod = props.COD != null ? String(props.COD).trim() : '';

        if (cod && shapeToContracts[cod]) {
            const projs = shapeToContracts[cod];
            if (projs.length === 1) {
                const p = projs[0];
                cloned.properties.codigo_proyecto = p["Código proyecto"] || p.code || "";
                cloned.properties.nombre_concesion = p["Nombre de la Concesión "] || p["Nombre de la Concesión"] || p.official_name || "";
                cloned.properties.nombre_comun = p["Nombre de uso común"] || p.name || "";
                cloned.properties.sector = p["Sector del proyecto"] || p.sector || props.Sector_DGC || "";
                cloned.properties.region = p["Región geográfica"] || p.region || "";
                cloned.properties.estado = p["ESTADO"] || p.status || "";
                cloned.properties.presupuesto_uf = p["Presupuesto oficial estimado"] != null ? p["Presupuesto oficial estimado"] : (p.budget_uf != null ? p.budget_uf : null);
                cloned.properties.inversion_uf = p["Inversión Materializada estimada"] != null ? p["Inversión Materializada estimada"] : (p.investment_uf != null ? p.investment_uf : null);
                cloned.properties.sociedad_concesionaria = p["Nombre sociedad concesionaria"] || p.concessionaire || "";
                cloned.properties.metodo_licitacion = p["Metodo de licitación"] || p.tender_method || "";
            } else {
                cloned.properties.concesiones_asociadas = projs.map(p => p["Nombre de uso común"] || p["Nombre de la Concesión "] || p.name || p.code).join(' | ');
                cloned.properties.codigos_proyectos = projs.map(p => p["Código proyecto"] || p.code).join(' | ');
                cloned.properties.sector = props.Sector_DGC || (projs[0] && (projs[0]["Sector del proyecto"] || projs[0].sector)) || "";
            }
        }
        return cloned;
    });

    const exportCollection = {
        type: "FeatureCollection",
        name: "CATLEC_DGC_Concesiones_Chile",
        crs: window.DGC_DATA.crs || {
            type: "name",
            properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" }
        },
        features: validFeatures
    };

    CatlecUtils.downloadGeoJSON(exportCollection, 'CATLEC_DGC_Concesiones');
}
