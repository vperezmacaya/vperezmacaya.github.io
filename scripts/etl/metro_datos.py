"""Metro: Bases de dato/Metro/Metro.xlsx → static/data/metro_data.js.
"""
from etl.comun_datos import *  # noqa: F401,F403  rutas, fotos y utilidades

# ── Exportar Proyectos Metro de Santiago ────────────────────────────────────────
try:
    if os.path.exists(METRO_EXCEL_PATH):
        print(f"\nProcesando Metro desde: {METRO_EXCEL_PATH}...")
        df_metro = read_excel_flexible_header(METRO_EXCEL_PATH, 'Proyectos Metro', ['id proyecto'], header_candidates=(2, 1, 0, 3))
        print(f"  -> {len(df_metro)} filas cargadas desde hoja 'Proyectos Metro'")

        metro_projects = []
        for _, row in df_metro.iterrows():
            shapes_raw = str(row.get('Shapes', ''))
            shapes = [int(s.strip()) if s.strip().isdigit() else s.strip() for s in shapes_raw.split(',') if s.strip() and s.strip() != '—' and s.strip().lower() != 'nan']

            inv_val = row.get('Inversión estimada (MM USD)')
            inv_num = None
            try:
                if pd.notna(inv_val) and str(inv_val).strip() != '' and str(inv_val).strip() != '—':
                    inv_num = float(inv_val)
            except Exception:
                inv_num = None
            raw_inv = str(inv_val).strip() if pd.notna(inv_val) and str(inv_val).strip() not in ['', 'nan', '—', '-'] else None

            inv_acum_val = row.get('Inversión acumulada 2025 (MM USD)')
            inv_acum_num = None
            try:
                if pd.notna(inv_acum_val) and str(inv_acum_val).strip() != '' and str(inv_acum_val).strip() != '—':
                    inv_acum_num = float(inv_acum_val)
            except Exception:
                inv_acum_num = None
            raw_inv_acum = str(inv_acum_val).strip() if pd.notna(inv_acum_val) and str(inv_acum_val).strip() not in ['', 'nan', '—', '-'] else None

            av_fin_val = row.get('Avance Financiero')
            av_fin = None
            try:
                if pd.notna(av_fin_val) and str(av_fin_val).strip() != '' and str(av_fin_val).strip() != '—':
                    av_fin = float(av_fin_val)
            except Exception:
                av_fin = None
            raw_av_fin = str(av_fin_val).strip() if pd.notna(av_fin_val) and str(av_fin_val).strip() not in ['', 'nan', '—', '-'] else None

            av_fis_val = row.get('Avance Físico')
            av_fis = None
            try:
                if pd.notna(av_fis_val) and str(av_fis_val).strip() != '' and str(av_fis_val).strip() != '—':
                    av_fis = float(av_fis_val)
            except Exception:
                av_fis = None
            raw_av_fis = str(av_fis_val).strip() if pd.notna(av_fis_val) and str(av_fis_val).strip() not in ['', 'nan', '—', '-'] else None

            km_val = row.get('Longitud (km)')
            km_num = None
            try:
                if pd.notna(km_val): km_num = float(km_val)
            except Exception:
                km_num = None

            est_val = row.get('Estaciones')
            est_num = None
            try:
                if pd.notna(est_val): est_num = int(est_val)
            except Exception:
                est_num = None

            pob_val = row.get('Población Beneficiada (hab)')
            pob_num = None
            try:
                if pd.notna(pob_val) and str(pob_val).replace('.','').replace(',','').strip().isdigit():
                    pob_num = int(str(pob_val).replace('.','').replace(',','').strip())
            except Exception:
                pob_num = None

            proj_obj = {
                'id': str(row.get('ID Proyecto', '')),
                'shapes': shapes,
                'name': str(row.get('Proyecto', '')),
                'line': str(row.get('Línea', '')),
                'type': str(row.get('Tipo', 'Línea Nueva')),
                'environmental_classification': str(row.get('Clasificación Ambiental', '')),
                'stage': str(row.get('Etapa', '')),
                'environmental_status': str(row.get('Estado Ambiental / RCA', '')),
                'start_date': str(row.get('Fecha Inicio / Hito', '')),
                'length_km': km_num,
                'stations': est_num,
                'terminals': str(row.get('Terminales', '')),
                'communes': str(row.get('Comunas Conectadas', '')),
                'communes_list': [c.strip() for c in str(row.get('Comunas', '')).split(';') if c.strip()] if row.get('Comunas') and str(row.get('Comunas')).strip().lower() != 'nan' else [],
                'benefited_population': pob_num or sanitize_value(row.get('Población Beneficiada (hab)')),
                'travel_time': str(row.get('Tiempo de Viaje / Reducción', '')),
                'operation_year': str(row.get('Puesta en Servicio', '')),
                'investment_mm_usd': inv_num,
                'investment_str': raw_inv,
                'accumulated_investment_2025_mm_usd': inv_acum_num,
                'accumulated_investment_str': raw_inv_acum,
                'financial_progress_pct': av_fin,
                'financial_progress_str': raw_av_fin,
                'physical_progress_pct': av_fis,
                'physical_progress_str': raw_av_fis,
                'tunnel_excavation': str(row.get('Avance Túnel / Excavaciones', '')),
                'combinations': str(row.get('Combinaciones e Intermodalidad', '')),
                'workshops_depots': str(row.get('Talleres y Cocheras', '')),
                'rolling_stock': str(row.get('Material Rodante', '')),
                'systems_technology': str(row.get('Tecnología y Sistemas', '')),
                'heritage_archaeology': str(row.get('Patrimonio y Arqueología', '')),
                'source': str(row.get('Fuente', '')),
                'color_hex': sanitize_value(row.get('Color Hex'))
            }
            metro_projects.append(proj_obj)

        # ── Cargar Líneas Operativas ──
        metro_lines = []
        try:
            df_lines = read_excel_flexible_header(METRO_EXCEL_PATH, 'Líneas Operativas', ['terminales'], header_candidates=(2, 1, 0, 3))
            for _, r in df_lines.iterrows():
                l_name = str(r.get('Línea', '')).strip()
                if not l_name or 'TOTAL' in l_name.upper():
                    continue
                metro_lines.append({
                    'line': l_name,
                    'color': sanitize_value(r.get('Color')),
                    'color_hex': sanitize_value(r.get('Color Hex')),
                    'terminals': sanitize_value(r.get('Terminales (Cabeceras)')),
                    'length_km': float(r.get('Longitud (km)')) if pd.notna(r.get('Longitud (km)')) else 0,
                    'stations': int(r.get('Estaciones')) if pd.notna(r.get('Estaciones')) else 0,
                    'combinations': int(r.get('Combinaciones')) if pd.notna(r.get('Combinaciones')) else 0,
                    'communes_count': int(r.get('Cant. Comunas')) if pd.notna(r.get('Cant. Comunas')) else 0,
                    'communes': sanitize_value(r.get('Comunas Conectadas')),
                    'alignment': sanitize_value(r.get('Tipo de Trazado')),
                    'rolling_type': sanitize_value(r.get('Rodadura')),
                    'driving_mode': sanitize_value(r.get('Conducción / Automatización')),
                    'rolling_stock': sanitize_value(r.get('Material Rodante')),
                    'cars_per_train': int(r.get('Coches / Convoy')) if pd.notna(r.get('Coches / Convoy')) else 0,
                    'platform_doors': sanitize_value(r.get('Puertas de Andén')),
                    'air_conditioning': sanitize_value(r.get('Aire Acondicionado')),
                    'inauguration_year': int(r.get('Año Inauguración')) if pd.notna(r.get('Año Inauguración')) else None,
                    'last_extension_year': int(r.get('Última Extensión')) if pd.notna(r.get('Última Extensión')) else None,
                    'commercial_speed': sanitize_value(r.get('Velocidad Comercial')),
                    'peak_headway': sanitize_value(r.get('Intervalo Hora Punta')),
                    'source': sanitize_value(r.get('Fuente')),
                    'track_type': sanitize_value(r.get('Tipología Tecnología') or r.get('Tipología Tecnológica')),
                    'inspection_days': int(r.get('Frecuencia de Inspección (días)')) if pd.notna(r.get('Frecuencia de Inspección (días)')) and str(r.get('Frecuencia de Inspección (días)')).isdigit() else None
                })
            print(f"  -> {len(metro_lines)} líneas operativas cargadas desde 'Líneas Operativas'")
        except Exception as e_l:
            print(f"  AVISO: No se pudo cargar hoja 'Líneas Operativas': {e_l}")

        # ── Cargar Hoja: Demanda Histórica ──
        historical_demand = []
        try:
            df_demanda = pd.read_excel(METRO_EXCEL_PATH, sheet_name='Demanda Histórica')
            for _, r in df_demanda.iterrows():
                if pd.notna(r.get('Año')):
                    historical_demand.append({
                        'year': int(r.get('Año')),
                        'trips_mm': float(r.get('Afluencia Total (MM Viajes)')) if pd.notna(r.get('Afluencia Total (MM Viajes)')) else 0.0,
                        'daily_trips_mm': float(r.get('Viajes Día Hábil (MM Pax/día)')) if pd.notna(r.get('Viajes Día Hábil (MM Pax/día)')) else 0.0,
                        'revenue_mm_clp': float(r.get('Ingresos Tarifarios (MM CLP)')) if pd.notna(r.get('Ingresos Tarifarios (MM CLP)')) else 0.0
                    })
            historical_demand.sort(key=lambda d: d['year'])
            print(f"  -> {len(historical_demand)} registros cargados desde 'Demanda Histórica'")
        except Exception as e_d:
            print(f"  AVISO: No se pudo cargar hoja 'Demanda Histórica': {e_d}")

        # ── Cargar Hoja: Oferta Operacional ──
        operational_supply = []
        try:
            df_supply = pd.read_excel(METRO_EXCEL_PATH, sheet_name='Oferta Operacional')
            for _, r in df_supply.iterrows():
                if pd.notna(r.get('Año')):
                    operational_supply.append({
                        'year': int(r.get('Año')),
                        'car_km_mm': float(r.get('Total Coches-Km (MMCKm)')) if pd.notna(r.get('Total Coches-Km (MMCKm)')) else 0.0,
                        'op_costs_mm': float(r.get('Costos Op. (MM CLP)')) if pd.notna(r.get('Costos Op. (MM CLP)')) else 0.0,
                        'energy_gwh': float(r.get('Consumo Energía (GWh)')) if pd.notna(r.get('Consumo Energía (GWh)')) else 0.0,
                        'energy_efficiency': float(r.get('Eficiencia (GWh / MMCKm)')) if pd.notna(r.get('Eficiencia (GWh / MMCKm)')) else 0.0
                    })
            operational_supply.sort(key=lambda d: d['year'])
            print(f"  -> {len(operational_supply)} registros cargados desde 'Oferta Operacional'")
        except Exception as e_s:
            print(f"  AVISO: No se pudo cargar hoja 'Oferta Operacional': {e_s}")

        # ── Tipología de Vías (Consolidada dinámicamente desde Líneas Operativas) ──
        track_types = []
        track_colors = {
            'Vías Convencionales Neumáticas': '#002447',
            'Vías Convencionales Férreas (Acero)': '#0284c7',
            'Vías Automáticas GoA 4 (CBTC)': '#10b981'
        }
        try:
            grouped_tracks = {}
            for l in metro_lines:
                t_name = l.get('track_type')
                if not t_name or t_name == '—':
                    continue
                if t_name not in grouped_tracks:
                    grouped_tracks[t_name] = {
                        'type': t_name,
                        'lines_list': [],
                        'length_km': 0.0,
                        'inspection_days': l.get('inspection_days') or 14,
                        'color': track_colors.get(t_name, '#0284c7')
                    }
                grouped_tracks[t_name]['lines_list'].append(l.get('line'))
                grouped_tracks[t_name]['length_km'] += float(l.get('length_km') or 0.0)
                if l.get('inspection_days'):
                    grouped_tracks[t_name]['inspection_days'] = l.get('inspection_days')

            # Orden canónico
            preferred_order = [
                'Vías Convencionales Neumáticas',
                'Vías Convencionales Férreas (Acero)',
                'Vías Automáticas GoA 4 (CBTC)'
            ]
            sorted_keys = sorted(grouped_tracks.keys(), key=lambda k: preferred_order.index(k) if k in preferred_order else 99)

            for t_name in sorted_keys:
                g = grouped_tracks[t_name]
                track_types.append({
                    'type': g['type'],
                    'lines': ', '.join(g['lines_list']),
                    'length_km': round(g['length_km'], 1),
                    'inspection_days': g['inspection_days'],
                    'color': g['color']
                })
            print(f"  -> {len(track_types)} tipologías calculadas dinámicamente desde 'Líneas Operativas'")
        except Exception as e_v:
            print(f"  AVISO: No se pudo calcular 'Tipologías de Vías': {e_v}")

        # ── Cargar Hoja: Confiabilidad y Averías (años detectados dinámicamente) ──
        operational_indicators = []
        operational_indicator_years = []
        try:
            df_ind = pd.read_excel(METRO_EXCEL_PATH, sheet_name='Confiabilidad y Averías')

            # Detectar dinámicamente las columnas de año (numéricas o strings de 4 dígitos, ej. 2019, '2025')
            ind_year_cols = [c for c in df_ind.columns if re.match(r'^\d{4}(\.0)?$', str(c).strip())]
            ind_year_cols.sort(key=lambda c: int(float(str(c))))
            operational_indicator_years = [str(int(float(str(c)))) for c in ind_year_cols]

            for _, r in df_ind.iterrows():
                ind_name = str(r.get('Indicador de Desempeño', '')).strip()
                if ind_name and ind_name != 'nan':
                    values = {}
                    for col in ind_year_cols:
                        year_key = str(int(float(str(col))))
                        val = r.get(col)
                        values[year_key] = float(val) if pd.notna(val) else None
                    operational_indicators.append({
                        'indicator': ind_name,
                        'values': values
                    })
            print(f"  -> {len(operational_indicators)} indicadores cargados desde 'Confiabilidad y Averías' ({len(operational_indicator_years)} años: {', '.join(operational_indicator_years)})")
        except Exception as e_i:
            print(f"  AVISO: No se pudo cargar hoja 'Confiabilidad y Averías': {e_i}")

        # ── Cargar Hoja: Estaciones ──
        metro_stations = []
        try:
            df_est = read_excel_flexible_header(METRO_EXCEL_PATH, 'Estaciones', ['código shape', 'nombre estaci'], header_candidates=(2, 1, 0, 3))
            for _, r in df_est.iterrows():
                st_name = str(r.get('Nombre Estación', '')).strip()
                if not st_name or st_name == 'nan':
                    continue
                
                raw_lines = str(r.get('Línea', r.get('Líneas que Conecta', ''))).strip()
                lines_list = [l.strip() for l in raw_lines.split(',') if l.strip()] if raw_lines and raw_lines != 'nan' else []
                main_line = lines_list[0] if lines_list else ''
                
                raw_comunas = str(r.get('Comuna', '')).strip()
                comunas_list = [c.strip() for c in raw_comunas.split(',') if c.strip()] if raw_comunas and raw_comunas != 'nan' else []
                
                fut_comb = str(r.get('Combinación Futura', '')).strip()
                fut_comb_list = [f.strip() for f in fut_comb.split(',') if f.strip()] if fut_comb and fut_comb != 'nan' else []

                raw_proj = str(r.get('ID Proyecto', '')).strip()
                proj_list = [p.strip() for p in raw_proj.split(',') if p.strip()] if raw_proj and raw_proj != 'nan' else []

                metro_stations.append({
                    'id': sanitize_value(r.get('ID Estación')),
                    'shape_id': sanitize_value(r.get('Código Shape')),
                    'name': st_name,
                    'line': main_line,
                    'lines': lines_list,
                    'lines_connected_str': raw_lines if raw_lines != 'nan' else '',
                    'is_combination': str(r.get('Es Combinación', '')).strip().lower() in ['sí', 'si', 'true', '1'],
                    'future_combination': fut_comb_list,
                    'future_combination_str': fut_comb if fut_comb != 'nan' else '',
                    'commune': raw_comunas if raw_comunas != 'nan' else '',
                    'communes': comunas_list,
                    'status': sanitize_value(r.get('Estado')),
                    'inauguration': sanitize_value(r.get('Año Inauguración')),
                    'color_hex': sanitize_value(r.get('Color Hex')),
                    'project_id': raw_proj if raw_proj and raw_proj != 'nan' else None,
                    'project_ids': proj_list
                })
            print(f"  -> {len(metro_stations)} estaciones cargadas desde 'Estaciones'")
        except Exception as e_est:
            print(f"  AVISO: No se pudo cargar hoja 'Estaciones': {e_est}")

        # ── Cargar Hoja: Comunas (Datos Demográficos y Cálculo Automático de Cobertura) ──
        metro_communes = []
        try:
            df_com = pd.read_excel(METRO_EXCEL_PATH, sheet_name='Comunas')
            
            # Construir diccionarios automáticos desde metro_stations (Estaciones Operativas y En Proyecto)
            st_op_by_comuna = {}
            st_future_by_comuna = {}
            lines_by_comuna = {}
            proj_by_comuna = {}

            # Proyectos futuros por comuna, derivados de la columna 'Comunas' en 'Proyectos Metro'
            # (independiente de si la hoja 'Estaciones' ya tiene filas para ese proyecto)
            future_projects_by_comuna = {}
            for p in metro_projects:
                for c in p.get('communes_list', []):
                    ck = _normalize_col(c)
                    future_projects_by_comuna.setdefault(ck, [])
                    if p['name'] not in future_projects_by_comuna[ck]:
                        future_projects_by_comuna[ck].append(p['name'])

            for st in metro_stations:
                st_coms = st.get('communes', [])
                st_status = str(st.get('status', '')).strip()
                st_lines = st.get('lines', [])
                if not st_lines and st.get('line'):
                    st_lines = [st.get('line')]
                
                is_future = (st_status == 'En Proyecto / Construcción') or \
                            ('proyecto' in st_status.lower()) or \
                            ('construcci' in st_status.lower() and st_status != 'Operativa')

                for c in st_coms:
                    cn = _normalize_col(c)
                    if st_status == 'Operativa':
                        st_op_by_comuna[cn] = st_op_by_comuna.get(cn, 0) + 1
                        if cn not in lines_by_comuna:
                            lines_by_comuna[cn] = set()
                        lines_by_comuna[cn].update(st_lines)
                    elif is_future:
                        st_future_by_comuna[cn] = st_future_by_comuna.get(cn, 0) + 1
                        if cn not in proj_by_comuna:
                            proj_by_comuna[cn] = set()
                        proj_by_comuna[cn].update(st_lines)

            # Diccionario auxiliar de Provincias del Gran Santiago
            PROVINCIAS_MAP = {
                'puente alto': 'Cordillera', 'pirque': 'Cordillera', 'san jose de maipo': 'Cordillera',
                'san bernardo': 'Maipo', 'calera de tango': 'Maipo',
                'colina': 'Chacabuco', 'lampa': 'Chacabuco',
                'padre hurtado': 'Talagante', 'penaflor': 'Talagante'
            }

            for _, r in df_com.iterrows():
                c_name = str(r.get('Comuna', '')).strip()
                if not c_name or c_name == 'nan':
                    continue
                cn = _normalize_col(c_name)
                
                # Obtener población y superficie con nombres de columnas flexibles
                pob_val = r.get('Población', r.get('Población (Habitantes)', r.get('Poblacion', 0)))
                pob = int(pob_val) if pd.notna(pob_val) else 0
                
                sup_val = r.get('Superficie (km²)', r.get('Superficie', r.get('Superficie (km2)', r.get('Área', r.get('Area', 0.0)))))
                sup = float(sup_val) if pd.notna(sup_val) else 0.0
                
                # Densidad calculada automáticamente
                den_val = r.get('Densidad (hab/km²)', r.get('Densidad'))
                den = float(den_val) if pd.notna(den_val) else (round(pob / sup, 1) if sup > 0 else 0.0)
                
                # Estaciones calculadas automáticamente desde metro_stations si no vienen en Excel
                est_val = r.get('Estaciones Metro', r.get('Estaciones'))
                est = int(est_val) if pd.notna(est_val) else st_op_by_comuna.get(cn, 0)
                
                # Estaciones futuras calculadas desde metro_stations (Estado == 'En Proyecto / Construcción')
                fut_val = r.get('Estaciones Futuras', r.get('Estaciones Proyecto'))
                fut_est = int(fut_val) if pd.notna(fut_val) else st_future_by_comuna.get(cn, 0)
                tot_est = est + fut_est

                # Líneas operativas inferidas de las estaciones
                lin_val = r.get('Líneas que Conectan', r.get('Líneas'))
                if pd.notna(lin_val) and str(lin_val).strip() and str(lin_val).strip() != 'nan':
                    lin_list = [l.strip() for l in str(lin_val).split(',') if l.strip()]
                else:
                    lin_list = sorted(list(lines_by_comuna.get(cn, set())))
                    
                # Proyectos futuros
                proy_val = r.get('Proyectos Futuros', r.get('Proyectos'))
                if pd.notna(proy_val) and str(proy_val).strip() and str(proy_val).strip() != 'nan':
                    proy_list = [p.strip() for p in str(proy_val).split(',') if p.strip()]
                else:
                    proy_list = sorted(list(proj_by_comuna.get(cn, set())))
                    if not proy_list:
                        proy_list = future_projects_by_comuna.get(cn, [])

                # Estado Metro calculado automáticamente
                status_val = r.get('Estado Metro', r.get('Estado'))
                if pd.notna(status_val) and str(status_val).strip() and str(status_val).strip() != 'nan':
                    metro_stat = str(status_val).strip()
                elif est > 0:
                    metro_stat = 'Servicio Activo'
                elif fut_est > 0 or len(proy_list) > 0 or cn in future_projects_by_comuna:
                    metro_stat = 'En Expansión'
                else:
                    metro_stat = 'Sin Cobertura'

                hab_per_st = round(pob / est) if est > 0 else None
                hab_per_st_future = round(pob / tot_est) if tot_est > 0 else None
                den_future = round(tot_est / sup, 2) if (sup > 0 and tot_est > 0) else (0.0 if tot_est > 0 else None)

                prov = str(r.get('Provincia', '')).strip()
                if not prov or prov == 'nan':
                    prov = PROVINCIAS_MAP.get(cn, 'Santiago')

                metro_communes.append({
                    'name': c_name,
                    'province': prov,
                    'population': pob,
                    'surface_km2': sup,
                    'density_hab_km2': den,
                    'metro_status': metro_stat,
                    'has_metro': est > 0,
                    'stations_count': est,
                    'stations_future': fut_est,
                    'stations_total': tot_est,
                    'network_km': float(r.get('Longitud Red (km)')) if pd.notna(r.get('Longitud Red (km)')) else 0.0,
                    'hab_per_station': hab_per_st,
                    'hab_per_station_future': hab_per_st_future,
                    'density_future_km2': den_future,
                    'lines': lin_list,
                    'future_projects': proy_list
                })
            print(f"  -> {len(metro_communes)} comunas cargadas/calculadas desde 'Comunas'")
        except Exception as e_com:
            print(f"  AVISO: No se pudo cargar hoja 'Comunas': {e_com}")

        # Mapa de colores oficiales cargados desde Excel
        metro_line_colors = {}
        for l in metro_lines:
            if l.get('line') and l.get('color_hex'):
                metro_line_colors[l['line']] = l['color_hex']
        for p in metro_projects:
            if p.get('line') and p.get('color_hex'):
                metro_line_colors[p['line']] = p['color_hex']

        # Estadísticas agregadas para gráficos
        tot_inv = sum([p['investment_mm_usd'] for p in metro_projects if p['investment_mm_usd'] is not None])
        tot_km = sum([p['length_km'] for p in metro_projects if p['length_km'] is not None])
        tot_est = sum([p['stations'] for p in metro_projects if p['stations'] is not None])

        by_class = {}
        for p in metro_projects:
            c = p['environmental_classification'] or 'Otros'
            by_class[c] = by_class.get(c, 0) + 1

        by_type = {}
        for p in metro_projects:
            t = p['type'] or 'Otros'
            by_type[t] = by_type.get(t, 0) + 1

        total_pob_gs = sum(c['population'] for c in metro_communes)
        pob_con_metro = sum(c['population'] for c in metro_communes if c['has_metro'])
        pob_en_exp = sum(c['population'] for c in metro_communes if c['metro_status'] == 'En Expansión')
        pob_sin_metro = sum(c['population'] for c in metro_communes if c['metro_status'] == 'Sin Cobertura')

        metro_payload = {
            'summary': {
                'total_projects': len(metro_projects),
                'total_investment_mm_usd': round(tot_inv, 1),
                'plan_expansion_total_mm_usd': 7649.18,
                'total_length_km': round(tot_km, 1),
                'total_stations': tot_est,
                'by_classification': by_class,
                'by_type': by_type,
                'demographics': {
                    'total_population': total_pob_gs,
                    'pop_with_metro': pob_con_metro,
                    'pop_in_expansion': pob_en_exp,
                    'pop_without_metro': pob_sin_metro,
                    'pct_pop_with_metro': round((pob_con_metro / total_pob_gs * 100), 1) if total_pob_gs > 0 else 0,
                    'pct_pop_in_expansion': round((pob_en_exp / total_pob_gs * 100), 1) if total_pob_gs > 0 else 0,
                    'pct_pop_without_metro': round((pob_sin_metro / total_pob_gs * 100), 1) if total_pob_gs > 0 else 0
                }
            },
            'data': metro_projects,
            'lines': metro_lines,
            'line_colors': metro_line_colors,
            'stations': metro_stations,
            'communes': metro_communes,
            'historical_demand': historical_demand,
            'operational_supply': operational_supply,
            'track_types': track_types,
            'operational_indicators': operational_indicators,
            'operational_indicator_years': operational_indicator_years
        }

        out_metro_js = os.path.join(OUT_DIR, 'metro_data.js')
        metro_json = json.dumps(metro_payload, ensure_ascii=False, separators=(',', ':'))
        with open(out_metro_js, 'w', encoding='utf-8') as f:
            f.write(f'window.METRO_DATA = {metro_json};')

        size_metro = os.path.getsize(out_metro_js) / 1024
        print(f"OK Metro Generado: {out_metro_js} ({size_metro:.1f} KB)")
        print(f"   Proyectos Metro exportados: {len(metro_projects)}")
        print(f"   Líneas operativas exportadas: {len(metro_lines)}")
        print(f"   Estaciones exportadas: {len(metro_stations)}")
    else:
        print(f"[WARN] No se encontró el archivo Excel de Metro en {METRO_EXCEL_PATH}")

except Exception as e:
    print(f"[WARN] Error al exportar datos Metro: {e}")
    raise
