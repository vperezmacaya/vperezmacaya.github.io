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

    // 3. Hoja 3: estados financieros de las sociedades concesionarias (CMF) y sus notas
    dgcExportEstadosFinancieros(wb, contracts);

    // 4. Descargar archivo
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `CATLEC_DGC_Concesiones_${today}.xlsx`);
}

/**
 * Agrega al libro las hojas "Estados_Financieros" (una fila por concesión y año con
 * estados financieros en la CMF, de static/data/dgc_cmf.js) y "Notas_EEFF" (fuente y
 * definiciones). Se cruza por el RUT de la sociedad con dgcFinRutCuerpo (finanzas.js).
 */
function dgcExportEstadosFinancieros(wb, contracts) {
    const data = window.DGC_CMF;
    if (!data || typeof dgcFinRutCuerpo !== 'function') return;

    const rows = [];
    contracts.forEach(p => {
        const cuerpo = dgcFinRutCuerpo(p["Rut sociedad Concesionaria"]);
        const soc = cuerpo && data.sociedades[cuerpo];
        if (!soc) return;
        Object.keys(soc.anios).map(Number).sort((a, b) => a - b).forEach(anio => {
            const c = soc.anios[anio];
            const uf = (data.uf && data.uf[anio]) || {};
            rows.push({
                "Código Proyecto": p["Código proyecto"] || "",
                "Nombre Concesión": p["Nombre de uso común"] || p["Nombre de la Concesión "] || "",
                "Sector del Proyecto": p["Sector del proyecto"] || "",
                "Región Geográfica": p["Región geográfica"] || "",
                "Estado Concesión": p["ESTADO"] || "",
                "RUT Sociedad": soc.rut || "",
                "Sociedad Concesionaria (CMF)": soc.nombre || "",
                "Registro CMF": soc.registro || "",
                "Inscripción Vigente": soc.vigente ? "Sí" : "No",
                "Año": anio,
                "Estados": c.tipo === 'C' ? "Consolidados" : "Individuales",
                "Ingresos Ordinarios (MM$)": c.ingresos,
                "Resultado Operacional (MM$)": c.resultado_operacional,
                "Utilidad (Pérdida) (MM$)": c.utilidad,
                "Flujo Operacional (MM$)": c.flujo_operacional,
                "Activos (MM$)": c.activos,
                "Pasivos (MM$)": c.pasivos,
                "Patrimonio (MM$)": c.patrimonio,
                "Caja y Equivalentes (MM$)": c.caja,
                "Deuda Financiera (MM$)": c.deuda_financiera,
                "UF Promedio del Año ($)": uf.promedio != null ? uf.promedio : null,
                "UF al 31-dic ($)": uf.cierre != null ? uf.cierre : null,
                "XBRL de Origen (año)": c.archivo,
                "Auditor (último año)": soc.auditor || "",
                "Opinión del Auditor (último año)": soc.opinion || "",
                "Link CMF (Información Financiera)": soc.url || ""
            });
        });
    });

    if (rows.length > 0) {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = Object.keys(rows[0]).map(key => {
            let maxLen = key.length;
            for (let i = 0; i < Math.min(rows.length, 60); i++) {
                const val = rows[i][key];
                if (val != null && String(val).length > maxLen) maxLen = String(val).length;
            }
            return { wch: Math.min(Math.max(maxLen + 2, 10), 48) };
        });
        XLSX.utils.book_append_sheet(wb, ws, "Estados_Financieros");
    } else {
        const wsEmpty = XLSX.utils.json_to_sheet([{ "Mensaje": "Ninguna de las concesiones seleccionadas tiene estados financieros en la CMF" }]);
        XLSX.utils.book_append_sheet(wb, wsEmpty, "Estados_Financieros");
    }

    const notas = [
        ["Fuente", `Estados financieros anuales (al 31 de diciembre) que cada sociedad concesionaria presenta a la Comisión para el Mercado Financiero (CMF) en formato XBRL, de ${data.anio_ini} a ${data.anio_fin}. Generado el ${data.generado || ''}.`],
        ["Cruce", "Por el RUT de la sociedad concesionaria del contrato (columna \"Rut sociedad Concesionaria\" de la base DGC). Solo aparecen las concesiones cuya sociedad está inscrita en la CMF y tiene estados financieros en el periodo; si una sociedad tiene varios contratos, sus cifras se repiten en cada uno."],
        ["Unidad", "Millones de pesos nominales de cada año (MM$), tal como los informa la sociedad. Para pasarlos a millones de UF: dividir los flujos (ingresos, resultados, flujo operacional) por la UF promedio del año y los saldos (activos, pasivos, patrimonio, caja, deuda) por la UF al 31-dic. Valores de la UF: Servicio de Impuestos Internos (SII)."],
        ["Estados", "Individuales o consolidados, los que presentó la sociedad (casi todas son individuales)."],
        ["Ingresos Ordinarios", "Concepto IFRS Revenue. Son contables: según el modelo del contrato (CINIIF 12), parte de lo que paga el Estado (subsidios, ingresos mínimos garantizados) se registra como cuenta por cobrar y no como ingreso."],
        ["Resultado Operacional", "ProfitLossFromOperatingActivities: ingresos menos costos de operación, mantención, amortización de la concesión y gastos de administración. Cada sociedad clasifica algunas partidas a su criterio."],
        ["Utilidad (Pérdida)", "ProfitLoss: resultado del año después de ingresos y costos financieros, reajustes de la deuda en UF e impuestos."],
        ["Flujo Operacional", "CashFlowsFromUsedInOperatingActivities: flujo de efectivo de las actividades de operación."],
        ["Deuda Financiera", "Otros pasivos financieros corrientes + no corrientes (OtherCurrentFinancialLiabilities + OtherNoncurrentFinancialLiabilities): bonos y préstamos. Vacía si la sociedad no informa esos conceptos."],
        ["XBRL de Origen", "Año del archivo XBRL del que salen las cifras: el del mismo año o, si no hay, la columna comparativa del archivo del año siguiente."],
        ["Celdas vacías", "La sociedad no informó ese concepto en su XBRL."]
    ].map(([campo, descripcion]) => ({ "Campo": campo, "Descripción": descripcion }));
    const wsNotas = XLSX.utils.json_to_sheet(notas);
    wsNotas['!cols'] = [{ wch: 22 }, { wch: 140 }];
    XLSX.utils.book_append_sheet(wb, wsNotas, "Notas_EEFF");
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
