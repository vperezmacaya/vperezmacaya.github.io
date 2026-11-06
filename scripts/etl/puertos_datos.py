"""Puertos: Bases de dato/Puertos/puertos.xlsx → static/data/puertos_data.js.
"""
from etl.comun_datos import *  # noqa: F401,F403  rutas, fotos y utilidades

# ==============================================================================
# ── Exportar Datos Puertos (Región del Biobío) ─────────────────────────────────
# ==============================================================================
try:
    if os.path.exists(PUERTOS_EXCEL_PATH):
        print(f"\n[INFO] Procesando datos de Puertos desde {PUERTOS_EXCEL_PATH}...")

        def _clean_float(val):
            if pd.isna(val):
                return 0.0
            try:
                v = float(val)
                return 0.0 if (np.isnan(v) or np.isinf(v)) else round(v, 2)
            except Exception:
                return 0.0

        def _get_sheet_df(excel_path, sheet_name):
            df = pd.read_excel(excel_path, sheet_name=sheet_name, header=None)
            h_idx = None
            for i, r in df.iterrows():
                if any('Año' in str(x) or 'Ao' in str(x) for x in r.values):
                    h_idx = i
                    break
            if h_idx is None:
                return pd.DataFrame()
            df_data = df.iloc[h_idx+1:].copy()
            df_data = df_data[pd.to_numeric(df_data.iloc[:, 0], errors='coerce').notnull()].copy()
            return df_data

        # 1. Carga Total
        df_carga = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Carga Total')
        carga_total_series = []
        for _, r in df_carga.iterrows():
            carga_total_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'embarcada_exterior': _clean_float(r.iloc[3]),
                'desembarcada_exterior': _clean_float(r.iloc[4]),
                'cabotaje': _clean_float(r.iloc[5]),
                'reestibas_transbordos': _clean_float(r.iloc[6]),
                'transito': _clean_float(r.iloc[7]),
                'var_12m': _clean_float(r.iloc[8]),
                'var_acum': _clean_float(r.iloc[9]) if len(r) > 9 else 0.0
            })

        # 2. TEUS
        df_teus = _get_sheet_df(PUERTOS_EXCEL_PATH, 'TEUS')
        teus_series = []
        for _, r in df_teus.iterrows():
            teus_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'contenedores_20': _clean_float(r.iloc[2]),
                'contenedores_40': _clean_float(r.iloc[3]),
                'teus': _clean_float(r.iloc[4]),
                'var_12m': _clean_float(r.iloc[5]),
                'var_acum': _clean_float(r.iloc[6]) if len(r) > 6 else 0.0
            })

        # 3. Embarcada
        df_emb = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Embarcada')
        embarcada_series = []
        for _, r in df_emb.iterrows():
            embarcada_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'suelta_general': _clean_float(r.iloc[3]),
                'contenedores': _clean_float(r.iloc[4]),
                'granel_solido': _clean_float(r.iloc[5]),
                'granel_liquido_gaseoso': _clean_float(r.iloc[6]),
                'var_12m': _clean_float(r.iloc[7]),
                'var_acum': _clean_float(r.iloc[8]) if len(r) > 8 else 0.0
            })

        # 4. Desembarcada
        df_desemb = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Desembarcada')
        desembarcada_series = []
        for _, r in df_desemb.iterrows():
            desembarcada_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'suelta_general': _clean_float(r.iloc[3]),
                'contenedores': _clean_float(r.iloc[4]),
                'granel_solido': _clean_float(r.iloc[5]),
                'granel_liquido_gaseoso': _clean_float(r.iloc[6]),
                'var_12m': _clean_float(r.iloc[7]),
                'var_acum': _clean_float(r.iloc[8]) if len(r) > 8 else 0.0
            })

        # 5. Cabotaje
        df_cabot = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Cabotaje')
        cabotaje_series = []
        for _, r in df_cabot.iterrows():
            cabotaje_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'embarcada': _clean_float(r.iloc[3]),
                'desembarcada': _clean_float(r.iloc[4]),
                'var_12m': _clean_float(r.iloc[5]),
                'var_acum': _clean_float(r.iloc[6]) if len(r) > 6 else 0.0
            })

        # 6. Contenedores 20 pies
        df_c20 = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Contenedores 20 pies')
        contenedores_20_series = []
        for _, r in df_c20.iterrows():
            contenedores_20_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'embarcados': _clean_float(r.iloc[3]),
                'desembarcados': _clean_float(r.iloc[4]),
                'reestibas_transbordos': _clean_float(r.iloc[5]),
                'cabotaje_transitos': _clean_float(r.iloc[6]),
                'var_12m': _clean_float(r.iloc[7]),
                'var_acum': _clean_float(r.iloc[8]) if len(r) > 8 else 0.0
            })

        # 7. Contenedores 40 pies
        df_c40 = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Contenedores 40 pies')
        contenedores_40_series = []
        for _, r in df_c40.iterrows():
            contenedores_40_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'embarcados': _clean_float(r.iloc[3]),
                'desembarcados': _clean_float(r.iloc[4]),
                'reestibas_transbordos': _clean_float(r.iloc[5]),
                'cabotaje_transitos': _clean_float(r.iloc[6]),
                'var_12m': _clean_float(r.iloc[7]),
                'var_acum': _clean_float(r.iloc[8]) if len(r) > 8 else 0.0
            })

        # 8. Re-estibas y Transbordos
        df_reest = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Re-estibas y Transbordos')
        reestibas_series = []
        for _, r in df_reest.iterrows():
            reestibas_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'reestibas': _clean_float(r.iloc[3]),
                'transbordos': _clean_float(r.iloc[4]),
                'var_12m': _clean_float(r.iloc[5]),
                'var_acum': _clean_float(r.iloc[6]) if len(r) > 6 else 0.0
            })

        # 9. Transito
        df_trans = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Transito')
        transito_series = []
        for _, r in df_trans.iterrows():
            transito_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'embarcada': _clean_float(r.iloc[3]),
                'desembarcada': _clean_float(r.iloc[4]),
                'var_12m': _clean_float(r.iloc[5]),
                'var_acum': _clean_float(r.iloc[6]) if len(r) > 6 else 0.0
            })

        # 10. Plaza de Peaje
        df_peaje = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Plaza de Peaje')
        peaje_series = []
        for _, r in df_peaje.iterrows():
            peaje_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'camiones_2_ejes': _clean_float(r.iloc[3]),
                'camiones_3_mas_ejes': _clean_float(r.iloc[4]),
                'var_12m': _clean_float(r.iloc[5]),
                'var_acum': _clean_float(r.iloc[6]) if len(r) > 6 else 0.0
            })

        # ── Resúmenes Anuales ──────────────────────────────────────────────────
        years = sorted(list(set(x['anio'] for x in carga_total_series)))
        annual_aggregates = []
        for yr in years:
            yr_carga = [x for x in carga_total_series if x['anio'] == yr]
            yr_teus = [x for x in teus_series if x['anio'] == yr]
            yr_emb = [x for x in embarcada_series if x['anio'] == yr]
            yr_desemb = [x for x in desembarcada_series if x['anio'] == yr]
            yr_cab = [x for x in cabotaje_series if x['anio'] == yr]
            yr_c20 = [x for x in contenedores_20_series if x['anio'] == yr]
            yr_c40 = [x for x in contenedores_40_series if x['anio'] == yr]
            yr_reest = [x for x in reestibas_series if x['anio'] == yr]
            yr_trans = [x for x in transito_series if x['anio'] == yr]
            yr_peaje = [x for x in peaje_series if x['anio'] == yr]

            # Carga total
            c_tot = round(sum(x['total'] for x in yr_carga), 2)
            c_emb_ext = round(sum(x['embarcada_exterior'] for x in yr_carga), 2)
            c_desemb_ext = round(sum(x['desembarcada_exterior'] for x in yr_carga), 2)
            c_cab = round(sum(x['cabotaje'] for x in yr_carga), 2)
            c_reest = round(sum(x['reestibas_transbordos'] for x in yr_carga), 2)
            c_trans = round(sum(x['transito'] for x in yr_carga), 2)

            # TEUS
            t_teus = round(sum(x['teus'] for x in yr_teus), 2)
            t_c20 = round(sum(x['contenedores_20'] for x in yr_teus), 2)
            t_c40 = round(sum(x['contenedores_40'] for x in yr_teus), 2)

            # Tipologia Embarcada
            emb_suelta = round(sum(x['suelta_general'] for x in yr_emb), 2)
            emb_cont = round(sum(x['contenedores'] for x in yr_emb), 2)
            emb_solido = round(sum(x['granel_solido'] for x in yr_emb), 2)
            emb_liq = round(sum(x['granel_liquido_gaseoso'] for x in yr_emb), 2)

            # Tipologia Desembarcada
            des_suelta = round(sum(x['suelta_general'] for x in yr_desemb), 2)
            des_cont = round(sum(x['contenedores'] for x in yr_desemb), 2)
            des_solido = round(sum(x['granel_solido'] for x in yr_desemb), 2)
            des_liq = round(sum(x['granel_liquido_gaseoso'] for x in yr_desemb), 2)

            # Contenedores manejo (20 + 40)
            c20_emb = round(sum(x['embarcados'] for x in yr_c20), 2)
            c20_des = round(sum(x['desembarcados'] for x in yr_c20), 2)
            c20_reest = round(sum(x['reestibas_transbordos'] for x in yr_c20), 2)
            c20_cab_trans = round(sum(x['cabotaje_transitos'] for x in yr_c20), 2)

            c40_emb = round(sum(x['embarcados'] for x in yr_c40), 2)
            c40_des = round(sum(x['desembarcados'] for x in yr_c40), 2)
            c40_reest = round(sum(x['reestibas_transbordos'] for x in yr_c40), 2)
            c40_cab_trans = round(sum(x['cabotaje_transitos'] for x in yr_c40), 2)

            # Peaje
            pj_tot = round(sum(x['total'] for x in yr_peaje), 2)
            pj_2ejes = round(sum(x['camiones_2_ejes'] for x in yr_peaje), 2)
            pj_3ejes = round(sum(x['camiones_3_mas_ejes'] for x in yr_peaje), 2)

            # Reestibas vs Transbordos
            reest_reest = round(sum(x['reestibas'] for x in yr_reest), 2)
            reest_transb = round(sum(x['transbordos'] for x in yr_reest), 2)

            annual_aggregates.append({
                'anio': yr,
                'meses_registrados': len(yr_carga),
                'carga_total': c_tot,
                'carga_embarcada_ext': c_emb_ext,
                'carga_desembarcada_ext': c_desemb_ext,
                'carga_cabotaje': c_cab,
                'carga_reestibas_transbordos': c_reest,
                'carga_transito': c_trans,
                'teus_total': t_teus,
                'contenedores_20_unidades': t_c20,
                'contenedores_40_unidades': t_c40,
                'emb_suelta': emb_suelta,
                'emb_contenedores': emb_cont,
                'emb_granel_solido': emb_solido,
                'emb_granel_liquido': emb_liq,
                'des_suelta': des_suelta,
                'des_contenedores': des_cont,
                'des_granel_solido': des_solido,
                'des_granel_liquido': des_liq,
                'cont_embarcados_total': c20_emb + c40_emb,
                'cont_desembarcados_total': c20_des + c40_des,
                'cont_reestibas_total': c20_reest + c40_reest,
                'cont_cabotaje_transito_total': c20_cab_trans + c40_cab_trans,
                'peaje_total_pasadas': pj_tot,
                'peaje_camiones_2ejes': pj_2ejes,
                'peaje_camiones_3mas_ejes': pj_3ejes,
                'reestibas_ton': reest_reest,
                'transbordos_ton': reest_transb
            })

        # Calcular variaciones anuales
        for i in range(len(annual_aggregates)):
            if i == 0:
                annual_aggregates[i]['var_anual_carga_pct'] = 0.0
                annual_aggregates[i]['var_anual_teus_pct'] = 0.0
            else:
                prev = annual_aggregates[i-1]
                curr = annual_aggregates[i]
                # Para años completos o comparables
                if prev['carga_total'] > 0 and curr['meses_registrados'] == 12 and prev['meses_registrados'] == 12:
                    curr['var_anual_carga_pct'] = round(((curr['carga_total'] - prev['carga_total']) / prev['carga_total']) * 100, 2)
                    curr['var_anual_teus_pct'] = round(((curr['teus_total'] - prev['teus_total']) / prev['teus_total']) * 100, 2)
                else:
                    curr['var_anual_carga_pct'] = 0.0
                    curr['var_anual_teus_pct'] = 0.0

        # Estacionalidad Mensual Promedio (2019 - 2025)
        monthly_seasonality = []
        month_names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        for m in range(1, 13):
            m_cargas = [x['total'] for x in carga_total_series if x['mes'] == m and x['anio'] < 2026]
            m_teus = [x['teus'] for x in teus_series if x['mes'] == m and x['anio'] < 2026]
            m_peaje = [x['total'] for x in peaje_series if x['mes'] == m and x['anio'] < 2026]
            monthly_seasonality.append({
                'mes_num': m,
                'mes_nombre': month_names[m-1],
                'avg_carga_ton': round(sum(m_cargas) / len(m_cargas), 2) if m_cargas else 0,
                'avg_teus': round(sum(m_teus) / len(m_teus), 2) if m_teus else 0,
                'avg_peajes': round(sum(m_peaje) / len(m_peaje), 2) if m_peaje else 0
            })

        # KPIs Globales
        tot_carga_hist = sum(x['carga_total'] for x in annual_aggregates)
        full_years_count = sum(1 for x in annual_aggregates if x['meses_registrados'] == 12)
        full_years_carga = sum(x['carga_total'] for x in annual_aggregates if x['meses_registrados'] == 12)
        avg_carga_anual = round(full_years_carga / full_years_count, 2) if full_years_count > 0 else 0

        tot_teus_hist = sum(x['teus_total'] for x in annual_aggregates)
        full_years_teus = sum(x['teus_total'] for x in annual_aggregates if x['meses_registrados'] == 12)
        avg_teus_anual = round(full_years_teus / full_years_count, 2) if full_years_count > 0 else 0

        kpis = {
            'total_carga_historica_ton': round(tot_carga_hist, 2),
            'avg_carga_anual_ton': avg_carga_anual,
            'total_teus_historico': round(tot_teus_hist, 2),
            'avg_teus_anual': avg_teus_anual,
            'total_embarcada_exterior_ton': round(sum(x['carga_embarcada_ext'] for x in annual_aggregates), 2),
            'total_desembarcada_exterior_ton': round(sum(x['carga_desembarcada_ext'] for x in annual_aggregates), 2),
            'total_cabotaje_ton': round(sum(x['carga_cabotaje'] for x in annual_aggregates), 2),
            'total_transito_ton': round(sum(x['carga_transito'] for x in annual_aggregates), 2),
            'total_reestibas_transbordos_ton': round(sum(x['carga_reestibas_transbordos'] for x in annual_aggregates), 2),
            'total_granel_solido_ton': round(sum(x['emb_granel_solido'] + x['des_granel_solido'] for x in annual_aggregates), 2),
            'total_granel_liquido_ton': round(sum(x['emb_granel_liquido'] + x['des_granel_liquido'] for x in annual_aggregates), 2),
            'total_contenedores_ton': round(sum(x['emb_contenedores'] + x['des_contenedores'] for x in annual_aggregates), 2),
            'total_carga_suelta_ton': round(sum(x['emb_suelta'] + x['des_suelta'] for x in annual_aggregates), 2),
            'total_peaje_pasadas': round(sum(x['peaje_total_pasadas'] for x in annual_aggregates), 2),
            'total_peaje_camiones_2ejes': round(sum(x['peaje_camiones_2ejes'] for x in annual_aggregates), 2),
            'total_peaje_camiones_3mas_ejes': round(sum(x['peaje_camiones_3mas_ejes'] for x in annual_aggregates), 2),
            'total_c20_unidades': round(sum(x['contenedores_20_unidades'] for x in annual_aggregates), 2),
            'total_c40_unidades': round(sum(x['contenedores_40_unidades'] for x in annual_aggregates), 2)
        }

        puertos_payload = {
            'metadata': {
                'region': 'Región del Biobío',
                'fuente': 'INE - Encuesta Directa a Puertos de la Región del Biobío',
                'periodo_inicio': f"{carga_total_series[0]['anio']}-01",
                'periodo_fin': f"{carga_total_series[-1]['anio']}-{carga_total_series[-1]['mes']:02d}",
                'anios_disponibles': years,
                'total_meses': len(carga_total_series)
            },
            'kpis': kpis,
            'annual_aggregates': annual_aggregates,
            'monthly_seasonality': monthly_seasonality,
            'series': {
                'carga_total': carga_total_series,
                'teus': teus_series,
                'embarcada': embarcada_series,
                'desembarcada': desembarcada_series,
                'cabotaje': cabotaje_series,
                'contenedores_20': contenedores_20_series,
                'contenedores_40': contenedores_40_series,
                'reestibas_transbordos': reestibas_series,
                'transito': transito_series,
                'plaza_peaje': peaje_series
            }
        }

        out_puertos_js = os.path.join(OUT_DIR, 'puertos_data.js')
        puertos_json = json.dumps(puertos_payload, ensure_ascii=False, separators=(',', ':'))
        with open(out_puertos_js, 'w', encoding='utf-8') as f:
            f.write(f'window.PUERTOS_DATA = {puertos_json};')

        size_puertos = os.path.getsize(out_puertos_js) / 1024
        print(f"OK Puertos Generado: {out_puertos_js} ({size_puertos:.1f} KB)")
        print(f"   Meses exportados: {len(carga_total_series)} ({years[0]} - {years[-1]})")
        print(f"   Carga Total Histórica: {kpis['total_carga_historica_ton']:,.2f} Ton")
    else:
        print(f"[WARN] No se encontró el archivo Excel de Puertos en {PUERTOS_EXCEL_PATH}")

except Exception as e:
    print(f"[WARN] Error al exportar datos Puertos: {e}")
    raise
