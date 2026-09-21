// Exportación de la cartera de proyectos MOP a Excel

function exportMOPToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('La librería SheetJS (XLSX) no se encuentra disponible.');
        return;
    }

    const projects = (filteredProjects && filteredProjects.length > 0)
        ? filteredProjects
        : (window.MOP_DATA?.projects || []);

    if (!projects || projects.length === 0) {
        alert('No hay iniciativas del MOP para exportar con los filtros seleccionados.');
        return;
    }

    const dataRows = projects.map(p => ({
        "Nombre de la Iniciativa": p.nombre || '',
        "Código BIP": p.bip || '',
        "Región": p.region || '',
        "Servicio / Dirección": p.servicio || '',
        "Programa": p.programa || '',
        "Etapa del Proyecto": p.etapa || '',
        "Costo Total (MM$)": p.cost_mm != null ? p.cost_mm : '',
        "Año Inicio": p.year != null ? p.year : '',
        "Año Término Estimado": p.year_ult != null ? p.year_ult : ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);

    if (dataRows.length > 0) {
        const colKeys = Object.keys(dataRows[0]);
        ws['!cols'] = colKeys.map(key => {
            let maxLen = key.length;
            for (let i = 0; i < Math.min(dataRows.length, 50); i++) {
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
    XLSX.utils.book_append_sheet(wb, ws, "Cartera_MOP");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `CATLEC_MOP_Cartera_${today}.xlsx`);
}
