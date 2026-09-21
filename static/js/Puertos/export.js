// Exportación de las series de datos de Puertos a Excel

window.exportPuertosExcel = function () {
    if (!window.PUERTOS_DATA || !window.XLSX) {
        alert('Datos no disponibles para exportar.');
        return;
    }
    const wb = XLSX.utils.book_new();
    const s = window.PUERTOS_DATA.series;

    if (s.carga_total) {
        const ws1 = XLSX.utils.json_to_sheet(s.carga_total);
        XLSX.utils.book_append_sheet(wb, ws1, 'Carga Total');
    }
    if (s.teus) {
        const ws2 = XLSX.utils.json_to_sheet(s.teus);
        XLSX.utils.book_append_sheet(wb, ws2, 'TEUS');
    }
    if (s.embarcada) {
        const ws3 = XLSX.utils.json_to_sheet(s.embarcada);
        XLSX.utils.book_append_sheet(wb, ws3, 'Embarcada');
    }
    if (s.desembarcada) {
        const ws4 = XLSX.utils.json_to_sheet(s.desembarcada);
        XLSX.utils.book_append_sheet(wb, ws4, 'Desembarcada');
    }
    if (s.plaza_peaje) {
        const ws5 = XLSX.utils.json_to_sheet(s.plaza_peaje);
        XLSX.utils.book_append_sheet(wb, ws5, 'Plazas de Peaje');
    }

    XLSX.writeFile(wb, 'CATLEC_Puertos_Biobio_Data.xlsx');
};
