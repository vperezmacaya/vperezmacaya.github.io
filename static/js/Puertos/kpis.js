// Inicialización de las tarjetas KPI de las 4 vistas de Puertos

function initKPIs() {
    if (!window.PUERTOS_DATA || !window.PUERTOS_DATA.kpis) return;
    const k = window.PUERTOS_DATA.kpis;

    // Vista 1: Resumen de Carga
    const elTotCarga = document.getElementById('kpi-total-carga');
    if (elTotCarga) elTotCarga.textContent = formatMillion(k.total_carga_historica_ton, 'Ton');

    const elAvgCarga = document.getElementById('kpi-avg-carga');
    if (elAvgCarga) elAvgCarga.textContent = `${formatMillion(k.avg_carga_anual_ton, 'Ton')}/año`;

    const elEmbExt = document.getElementById('kpi-embarque-exterior');
    if (elEmbExt) elEmbExt.textContent = formatMillion(k.total_embarcada_exterior_ton, 'Ton');

    const elDesembExt = document.getElementById('kpi-desembarque-exterior');
    if (elDesembExt) elDesembExt.textContent = formatMillion(k.total_desembarcada_exterior_ton, 'Ton');

    const elCabTrans = document.getElementById('kpi-cabotaje-transito');
    if (elCabTrans) elCabTrans.textContent = formatMillion(k.total_cabotaje_ton + k.total_transito_ton, 'Ton');

    // Vista 2: Contenedores y TEUs
    const elTotTeus = document.getElementById('kpi-total-teus');
    if (elTotTeus) elTotTeus.textContent = formatMillion(k.total_teus_historico, 'TEUs');

    const elAvgTeus = document.getElementById('kpi-avg-teus');
    if (elAvgTeus) elAvgTeus.textContent = `${formatMillion(k.avg_teus_anual, 'TEUs')}/año`;

    const elC40 = document.getElementById('kpi-c40-unidades');
    if (elC40) elC40.textContent = formatMillion(k.total_c40_unidades, 'Unid.');

    const elC20 = document.getElementById('kpi-c20-unidades');
    if (elC20) elC20.textContent = formatMillion(k.total_c20_unidades, 'Unid.');

    const elRatio = document.getElementById('kpi-ratio-c40-c20');
    if (elRatio) {
        const ratio = k.total_c20_unidades > 0 ? (k.total_c40_unidades / k.total_c20_unidades).toFixed(1) : '0';
        elRatio.textContent = `${ratio}x (40ft/20ft)`;
    }

    // Vista 3: Tipología de Carga
    const elGrLiq = document.getElementById('kpi-granel-liquido');
    if (elGrLiq) elGrLiq.textContent = formatMillion(k.total_granel_liquido_ton, 'Ton');

    const elGrSol = document.getElementById('kpi-granel-solido');
    if (elGrSol) elGrSol.textContent = formatMillion(k.total_granel_solido_ton, 'Ton');

    const elCargaCont = document.getElementById('kpi-carga-contenedores');
    if (elCargaCont) elCargaCont.textContent = formatMillion(k.total_contenedores_ton, 'Ton');

    const elCargaSuel = document.getElementById('kpi-carga-suelta');
    if (elCargaSuel) elCargaSuel.textContent = formatMillion(k.total_carga_suelta_ton, 'Ton');

    // Vista 4: Conectividad Terrestre
    const elTotPeaje = document.getElementById('kpi-total-pasadas-peaje');
    if (elTotPeaje) elTotPeaje.textContent = formatMillion(k.total_peaje_pasadas, 'Pasadas');

    const elPj3 = document.getElementById('kpi-camiones-3mas-ejes');
    if (elPj3) {
        const pct3 = k.total_peaje_pasadas > 0 ? ((k.total_peaje_camiones_3mas_ejes / k.total_peaje_pasadas) * 100).toFixed(1) : 0;
        elPj3.textContent = `${formatMillion(k.total_peaje_camiones_3mas_ejes, '')} (${pct3}%)`;
    }

    const elPj2 = document.getElementById('kpi-camiones-2ejes');
    if (elPj2) {
        const pct2 = k.total_peaje_pasadas > 0 ? ((k.total_peaje_camiones_2ejes / k.total_peaje_pasadas) * 100).toFixed(1) : 0;
        elPj2.textContent = `${formatMillion(k.total_peaje_camiones_2ejes, '')} (${pct2}%)`;
    }

    const elReestTrans = document.getElementById('kpi-reestibas-transbordos');
    if (elReestTrans) elReestTrans.textContent = formatMillion(k.total_reestibas_transbordos_ton, 'Ton');

    const elTransitoInt = document.getElementById('kpi-transito-internacional');
    if (elTransitoInt) elTransitoInt.textContent = formatMillion(k.total_transito_ton, 'Ton');
}
