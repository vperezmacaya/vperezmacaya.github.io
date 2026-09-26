// Inicialización de las tarjetas KPI de las 4 vistas de Puertos

function initKPIs() {
    if (!window.PUERTOS_DATA || !window.PUERTOS_DATA.kpis) return;
    const k = window.PUERTOS_DATA.kpis;
    const u = getUltimoRegistro() || {};
    const anio = u.anio || '';

    // Escribe el valor y, si se indica, el título con el año entre paréntesis
    const setKpi = (id, value, label) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
        const lbl = label && document.getElementById(`${id}-label`);
        if (lbl) lbl.textContent = `${label} (${anio})`;
    };

    // Vista 1: Resumen de Carga
    setKpi('kpi-total-carga', formatMillion(u.carga_total, 'Ton'), 'Carga Total');
    setKpi('kpi-avg-carga', `${formatMillion(k.avg_carga_anual_ton, 'Ton')}/año`);
    setKpi('kpi-embarque-exterior', formatMillion(u.carga_embarcada_ext, 'Ton'), 'Embarque Exterior');
    setKpi('kpi-desembarque-exterior', formatMillion(u.carga_desembarcada_ext, 'Ton'), 'Desembarque Exterior');
    setKpi('kpi-cabotaje-transito', formatMillion((u.carga_cabotaje || 0) + (u.carga_transito || 0), 'Ton'), 'Cabotaje y Tránsito');

    // Vista 2: Contenedores y TEUs
    setKpi('kpi-total-teus', formatMillion(u.teus_total, 'TEUs'), 'Total TEUs');
    setKpi('kpi-avg-teus', `${formatMillion(k.avg_teus_anual, 'TEUs')}/año`);
    setKpi('kpi-c40-unidades', formatMillion(u.contenedores_40_unidades, 'Unid.'), 'Contenedores 40 pies');
    setKpi('kpi-c20-unidades', formatMillion(u.contenedores_20_unidades, 'Unid.'), 'Contenedores 20 pies');
    const ratio = k.total_c20_unidades > 0 ? (k.total_c40_unidades / k.total_c20_unidades).toFixed(1) : '0';
    setKpi('kpi-ratio-c40-c20', `${ratio}x (40ft/20ft)`);

    // Vista 3: Tipología de Carga (embarque + desembarque)
    setKpi('kpi-carga-contenedores', formatMillion((u.emb_contenedores || 0) + (u.des_contenedores || 0), 'Ton'), 'Carga en Contenedores');
    setKpi('kpi-granel-liquido', formatMillion((u.emb_granel_liquido || 0) + (u.des_granel_liquido || 0), 'Ton'), 'Granel Líquido/Gaseoso');
    setKpi('kpi-granel-solido', formatMillion((u.emb_granel_solido || 0) + (u.des_granel_solido || 0), 'Ton'), 'Granel Sólido');
    setKpi('kpi-carga-suelta', formatMillion((u.emb_suelta || 0) + (u.des_suelta || 0), 'Ton'), 'Carga Suelta / General');

    // Vista 4: Conectividad Terrestre
    const p3 = u.peaje_camiones_3mas_ejes || 0;
    const p2 = u.peaje_camiones_2ejes || 0;
    const pTot = p3 + p2;
    const pct = (v) => (pTot > 0 ? ((v / pTot) * 100).toFixed(1) : 0);
    setKpi('kpi-total-pasadas-peaje', formatMillion(pTot, 'Pasadas'), 'Pasadas de Camiones');
    setKpi('kpi-camiones-3mas-ejes', `${formatMillion(p3, '')} (${pct(p3)}%)`, 'Camiones 3 y más ejes');
    setKpi('kpi-camiones-2ejes', `${formatMillion(p2, '')} (${pct(p2)}%)`, 'Camiones de 2 ejes');
    setKpi('kpi-reestibas-transbordos', formatMillion((u.reestibas_ton || 0) + (u.transbordos_ton || 0), 'Ton'), 'Re-estibas y Transbordos');
    setKpi('kpi-transito-internacional', formatMillion(u.carga_transito, 'Ton'), 'Tránsito Internacional');

    fillYearTags();
}
