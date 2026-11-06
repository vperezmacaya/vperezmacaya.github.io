"""EFE: Bases de dato/EFE/EFE.xlsx (+ fotos de Fotos/EFE) → static/data/efe_data.js.
"""
from etl.comun_datos import *  # noqa: F401,F403  rutas, fotos y utilidades

# ── EFE: Exportar datos de proyectos ferroviarios ──────────────────────────────
print(f"\nProcesando EFE desde: {EFE_EXCEL_PATH}...")

try:
    efe_excel_file = pd.ExcelFile(EFE_EXCEL_PATH)
    sheet_to_use = 'Proyectos' if 'Proyectos' in efe_excel_file.sheet_names else ('Proyectos Deduplicados' if 'Proyectos Deduplicados' in efe_excel_file.sheet_names else 'EFE')
    df_efe = pd.read_excel(EFE_EXCEL_PATH, sheet_name=sheet_to_use)
    print(f"  -> {len(df_efe)} filas cargadas en hoja '{sheet_to_use}'")
    print(f"  -> Columnas: {list(df_efe.columns)}")

    df_history = None
    if 'EFE' in efe_excel_file.sheet_names:
        df_history = pd.read_excel(EFE_EXCEL_PATH, sheet_name='EFE')
        print(f"  -> {len(df_history)} filas históricas cargadas desde hoja 'EFE'")

    # Escaneo de fotos en Fotos/EFE para cruce automático con proyectos
    # (cada foto se publica como WebP de ficha en static/img/fotos/EFE; EFE no tiene visor)
    efe_photos_dir = os.path.join(PHOTOS_SRC_DIR, 'EFE')
    efe_photos_out_dir = os.path.join(PHOTOS_OUT_DIR, 'EFE')
    efe_photo_files = []
    efe_photo_web_paths = {}
    if os.path.exists(efe_photos_dir):
        efe_photo_files = [f for f in sorted(os.listdir(efe_photos_dir)) if os.path.splitext(f)[1].lower() in PHOTO_EXTENSIONS]
        print(f"  -> {len(efe_photo_files)} fotos detectadas en Fotos/EFE: {efe_photo_files}")
        for pf in efe_photo_files:
            base, _ = os.path.splitext(pf)
            efe_photo_web_paths[pf] = optimize_photo(os.path.join(efe_photos_dir, pf), efe_photos_out_dir, [
                (f'{base}.webp', PHOTO_CARD_WIDTH),
            ])[0]
    prune_photo_dir(efe_photos_out_dir, {os.path.basename(p) for p in efe_photo_web_paths.values()})

    def _normalize_name_for_match(s):
        if not s: return ''
        s_norm = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode('utf-8')
        s_norm = s_norm.lower()
        return re.sub(r'[^a-z0-9]+', ' ', s_norm).strip()

    # ── Detectar columnas dinámicamente ───────────────────────────────────────
    efe_cols = {_normalize_col(c): c for c in df_efe.columns}

    def _find_efe_col(*keywords):
        """Find column whose normalized name contains ALL given keywords."""
        for norm_name, orig_name in efe_cols.items():
            if all(kw in norm_name for kw in keywords):
                return orig_name
        return None

    # Explicit column mapping — 'Proyecto' must be exact to avoid matching 'ID Proyecto'
    col_proyecto    = 'Proyecto' if 'Proyecto' in df_efe.columns else _find_efe_col('proyecto') or 'Proyecto'
    col_descripcion = _find_efe_col('descripcion') or 'Descripción'
    col_filial      = _find_efe_col('filial') or 'Filial'
    col_fuente      = _find_efe_col('fuente') or 'Fuente'
    col_detalle     = _find_efe_col('detalle') or 'Detalle'
    col_tipo        = _find_efe_col('tipo') or 'Tipo'
    col_etapa       = _find_efe_col('etapa') or 'Etapa'
    col_shapes      = _find_efe_col('shapes') or 'Shapes'
    col_id          = _find_efe_col('id', 'proyecto') or 'ID Proyecto'

    def _safe_parse_operation_year(val):
        """Parse operation year from values like 2030, '2030 + ', '2030-2032', etc.
        Returns a string when the value contains '+' or a range ('-'),
        preserving the original format so the JS timeline can render
        open_range or range milestones. Otherwise returns an int."""
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return None
        s = str(val).strip()
        if not s:
            return None
        # Preserve formats like "2030+", "2030 +", "2030 - 2032"
        if re.search(r'\d{4}\s*\+', s) or re.search(r'\d{4}\s*[-–—]\s*\d{4}', s):
            return s
        m = re.search(r'(\d{4})', s)
        return int(m.group(1)) if m else None

    # New columns
    col_inv_mm      = _find_efe_col('inversion') or 'Inversion estimada (MM USD)'
    col_operacion   = _find_efe_col('operacion') or 'Operación estimada'
    col_avance      = _find_efe_col('avance') or '%Avance etapa'

    print(f"  -> Columnas detectadas: proyecto={col_proyecto}, inv={col_inv_mm}, "
          f"operacion={col_operacion}, avance={col_avance}, fuente={col_fuente}")

    # ── Extraer año de la columna Fuente ──────────────────────────────────────
    def _extract_source_year(fuente_val):
        if not fuente_val or pd.isna(fuente_val):
            return 0
        m = re.search(r'(\d{4})', str(fuente_val))
        return int(m.group(1)) if m else 0

    df_efe['_source_year'] = df_efe[col_fuente].apply(_extract_source_year) if col_fuente in df_efe.columns else 0

    if df_history is not None and col_fuente in df_history.columns:
        df_history['_source_year'] = df_history[col_fuente].apply(_extract_source_year)

    # ── Iterar por la tabla de proyectos deduplicados ─────────────────────────
    # Si la hoja ya es 'Proyectos Deduplicados', cada fila ya es un ID único.
    # Si es hoja 'EFE', agrupamos por col_id o col_proyecto.
    if sheet_to_use == 'Proyectos Deduplicados':
        # Ordenar por ID Proyecto si existe
        if col_id in df_efe.columns:
            df_efe = df_efe.sort_values(col_id, ascending=True)
        project_rows = [(r.get(col_proyecto), r) for _, r in df_efe.iterrows()]
    else:
        # Fallback: deduplicar por ID Proyecto
        if col_id in df_efe.columns:
            dedup_df = df_efe.sort_values(by=[col_id, '_source_year'], ascending=[True, False]).drop_duplicates(subset=[col_id], keep='first')
        else:
            dedup_df = df_efe.sort_values(by=['_source_year'], ascending=False).drop_duplicates(subset=[col_proyecto], keep='first')
        project_rows = [(r.get(col_proyecto), r) for _, r in dedup_df.iterrows()]

    efe_projects = []
    for proj_name, latest_row in project_rows:
        if not proj_name or pd.isna(proj_name):
            continue

        id_val = latest_row.get(col_id)
        id_str = None
        if id_val is not None and not pd.isna(id_val):
            raw_s = str(id_val).strip()
            if raw_s and raw_s.lower() != 'nan':
                if re.match(r'^\d+(\.0)?$', raw_s):
                    id_str = f"P-{int(float(raw_s))}"
                else:
                    id_str = raw_s

        # Construir historial (all_records)
        all_records = []
        if df_history is not None:
            if id_str is not None and col_id in df_history.columns:
                def _match_hid(val):
                    if val is None or pd.isna(val): return None
                    vs = str(val).strip()
                    return f"P-{int(float(vs))}" if re.match(r'^\d+(\.0)?$', vs) else vs
                h_rows = df_history[df_history[col_id].apply(_match_hid) == id_str]
            elif col_proyecto in df_history.columns:
                h_rows = df_history[df_history[col_proyecto] == proj_name]
            else:
                h_rows = pd.DataFrame()

            if not h_rows.empty:
                h_sorted = h_rows.sort_values('_source_year', ascending=False)
                for _, rec_row in h_sorted.iterrows():
                    rec_inv = rec_row.get(col_inv_mm)
                    try:
                        rec_inv = float(rec_inv) if rec_inv is not None and not pd.isna(rec_inv) else None
                    except Exception:
                        rec_inv = None

                    all_records.append({
                        'source_year': int(rec_row['_source_year']) if rec_row.get('_source_year') else None,
                        'source': sanitize_value(rec_row.get(col_fuente)),
                        'investment_mm_usd': rec_inv,
                        'stage': sanitize_value(rec_row.get(col_etapa)),
                        'progress': sanitize_value(rec_row.get(col_avance)),
                        'operation_year': _safe_parse_operation_year(rec_row.get(col_operacion)),
                    })

        if not all_records:
            all_records.append({
                'source_year': int(latest_row['_source_year']) if latest_row.get('_source_year') else None,
                'source': sanitize_value(latest_row.get(col_fuente)),
                'investment_mm_usd': float(latest_row.get(col_inv_mm)) if latest_row.get(col_inv_mm) is not None and not pd.isna(latest_row.get(col_inv_mm)) else None,
                'stage': sanitize_value(latest_row.get(col_etapa)),
                'progress': sanitize_value(latest_row.get(col_avance)),
                'operation_year': _safe_parse_operation_year(latest_row.get(col_operacion)),
            })

        # Extract fields from latest row
        inv_raw = latest_row.get(col_inv_mm)
        try:
            inv_mm = float(inv_raw) if inv_raw is not None and not pd.isna(inv_raw) else None
        except Exception:
            inv_mm = None

        operacion_raw = latest_row.get(col_operacion)
        operation_year = _safe_parse_operation_year(operacion_raw)

        avance_raw = sanitize_value(latest_row.get(col_avance))
        detalle_raw = sanitize_value(latest_row.get(col_detalle))
        fuente_raw = sanitize_value(latest_row.get(col_fuente))
        source_year = int(latest_row['_source_year']) if latest_row['_source_year'] else None
        descripcion = sanitize_value(latest_row.get(col_descripcion))

        shapes_val = latest_row.get(col_shapes)
        shapes = parse_efe_shapes_list(shapes_val)

        estaciones_col = 'Estaciones' if 'Estaciones' in latest_row.index else ('estaciones' if 'estaciones' in latest_row.index else None)
        stations = parse_efe_shapes_list(latest_row.get(estaciones_col)) if estaciones_col else []

        filial_raw = latest_row.get(col_filial)
        filial = None
        if filial_raw is not None and not pd.isna(filial_raw):
            f_str = str(filial_raw).strip()
            if f_str and f_str.lower() not in ['nan', 'none', 'null', '']:
                filial = f_str

        tipo_raw = sanitize_value(latest_row.get(col_tipo))
        etapa_raw = sanitize_value(latest_row.get(col_etapa))

        # Cruce automático de fotos
        matched_photos = []
        proj_norm = _normalize_name_for_match(proj_name)
        id_norm = _normalize_name_for_match(id_str)
        for pf in efe_photo_files:
            base, _ = os.path.splitext(pf)
            f_norm = _normalize_name_for_match(base)
            if (id_norm and f_norm == id_norm) or (f_norm == proj_norm) or (len(f_norm) > 8 and f_norm in proj_norm) or (len(proj_norm) > 8 and proj_norm in f_norm):
                matched_photos.append(efe_photo_web_paths[pf])

        photo = matched_photos[0] if matched_photos else None

        efe_projects.append({
            'id': id_str,
            'name': str(proj_name),
            'type': tipo_raw,
            'stage': etapa_raw,
            'filial': filial,
            'investment_mm_usd': inv_mm,
            'operation_year': operation_year,
            'progress': avance_raw,
            'detail': detalle_raw,
            'source': fuente_raw,
            'source_year': source_year,
            'shapes': shapes,
            'stations': stations,
            'description': descripcion,
            'photo': photo,
            'photos': matched_photos,
            'all_records': all_records,
        })

    # Sort by investment descending (None last)
    efe_projects.sort(key=lambda p: p.get('investment_mm_usd') or 0, reverse=True)

    # ── 1. Cargar Hoja Maestra: Líneas Operativas (Servicios Regulares de Pasajeros) ──
    efe_lines = []
    service_master = {}
    try:
        # Keywords que solo aparecen en la fila de encabezados: 'servicio' a secas
        # también aparece en los datos (ej. "Servicio urbano" en Clasificación
        # Operacional) y hacía tomar una fila de datos como encabezado.
        df_lines = read_excel_flexible_header(EFE_EXCEL_PATH, 'Líneas Operativas', ['id servicio', 'longitud'], header_candidates=(2, 1, 0, 3))
        col_srv_id = next((c for c in df_lines.columns if 'id' in str(c).lower() and 'serv' in str(c).lower()), None)
        if not col_srv_id:
            col_srv_id = next((c for c in df_lines.columns if 'id' in str(c).lower()), 'ID Servicio')
        col_srv_name = next((c for c in df_lines.columns if 'servicio' in str(c).lower() and 'id' not in str(c).lower()), 'Servicio')

        for idx_l, r in df_lines.iterrows():
            serv_name = str(r.get(col_srv_name, '')).strip()
            if not serv_name or serv_name == 'nan':
                continue

            serv_id = str(r.get(col_srv_id, '')).strip() if col_srv_id in df_lines.columns else ''
            if not serv_id or serv_id.lower() == 'nan':
                serv_id = f"SRV-{idx_l+1:02d}"

            pax_val = r.get('Pasajeros 2025 (MM)')
            try:
                pax_2025 = float(pax_val) if pd.notna(pax_val) else None
            except Exception:
                pax_2025 = None

            sat_val = r.get('Satisfacción 2025 (%)')
            try:
                sat_2025 = float(sat_val) if pd.notna(sat_val) else None
            except Exception:
                sat_2025 = None

            km_val = r.get('Longitud (km)')
            try:
                km = float(km_val) if pd.notna(km_val) else 0.0
            except Exception:
                km = 0.0

            line_entry = {
                'id': serv_id,
                'service': serv_name,
                'filial': sanitize_value(r.get('Filial')),
                'operational_classification': sanitize_value(r.get('Clasificación Operacional')),
                'terminals': sanitize_value(r.get('Cabeceras / Trazado')),
                'length_km': km,
                'stations': 0,  # Se calcula dinámicamente con Estaciones
                'passengers_2025_mm': pax_2025,
                'demand_history': {},
                'satisfaction_2025_pct': sat_2025,
                'satisfaction_history': {},
                'travel_time_avg_min': int(r.get('Tiempo Promedio Viaje (min)')) if pd.notna(r.get('Tiempo Promedio Viaje (min)')) else None,
                'travel_time_total_min': int(r.get('Tiempo Total Trayecto (min)')) if pd.notna(r.get('Tiempo Total Trayecto (min)')) else None,
                'rolling_stock': sanitize_value(r.get('Material Rodante')),
                'traction': sanitize_value(r.get('Tracción / Alimentación')),
                'regions': sanitize_value(r.get('Regiones Conectadas')),
                'shapes': parse_efe_shapes_list(r.get('Shapes')),
                'source': sanitize_value(r.get('Fuente Memoria 2025'))
            }
            efe_lines.append(line_entry)
            service_master[serv_id] = line_entry
            # Registrar también sub-tokens si el ID es compuesto (ej. 'SRV-07;SRV-08' -> mapea también 'SRV-07' y 'SRV-08')
            for sub_id in serv_id.split(';'):
                sub_id_clean = sub_id.strip()
                if sub_id_clean and sub_id_clean not in service_master:
                    service_master[sub_id_clean] = line_entry

        print(f"  -> {len(efe_lines)} servicios regulares cargados desde 'Líneas Operativas' (Clave Maestra por ID Servicio)")
    except Exception as e_l:
        print(f"  AVISO: No se pudo cargar hoja 'Líneas Operativas' de EFE: {e_l}")

    # ── 2. Cargar Hoja: Satisfacción Histórica (Cruzada 100% por ID Servicio) ──
    sat_years = []
    try:
        if 'Satisfacción Histórica' in efe_excel_file.sheet_names:
            df_sat = read_excel_flexible_header(EFE_EXCEL_PATH, 'Satisfacción Histórica', ['id', 'servicio'])
            col_sat_id = next((c for c in df_sat.columns if 'id' in str(c).lower()), 'ID Servicio')

            # Detectar dinámicamente columnas de año (ej. 2018, 2019, ..., 2025)
            found_sat_years = []
            for col in df_sat.columns:
                col_str = str(col).strip()
                if col_str.isdigit() and len(col_str) == 4:
                    found_sat_years.append(col_str)
            sat_years = sorted(list(set(found_sat_years)), key=lambda y: int(y))
            if not sat_years:
                sat_years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025']

            # 'Satisfacción Histórica' es la única fuente de verdad para la satisfacción.
            # Se resetea en service_master para que cualquier servicio eliminado de esta hoja quede en None.
            for s_entry in service_master.values():
                s_entry['satisfaction_2025_pct'] = None
                s_entry['satisfaction_history'] = {}

            latest_sat_year = sat_years[-1] if sat_years else '2025'

            for _, r_sat in df_sat.iterrows():
                sid = str(r_sat.get(col_sat_id) or '').strip()
                if not sid or sid.lower() == 'nan':
                    continue

                hist_map = {}
                for yr in sat_years:
                    val = r_sat.get(yr) if yr in df_sat.columns else r_sat.get(int(yr))
                    if pd.notna(val):
                        try:
                            hist_map[yr] = float(val)
                        except Exception:
                            hist_map[yr] = None
                    else:
                        hist_map[yr] = None

                # Cruzar por ID de servicio operativo (SRV-XX o compuesto ej. SRV-07;SRV-08) con Líneas Operativas
                target_entry = service_master.get(sid)
                if not target_entry:
                    for sub_id in sid.split(';'):
                        if sub_id.strip() in service_master:
                            target_entry = service_master[sub_id.strip()]
                            break
                if target_entry:
                    target_entry['satisfaction_history'] = hist_map
                    if hist_map.get(latest_sat_year) is not None:
                        target_entry['satisfaction_2025_pct'] = hist_map[latest_sat_year]

            print(f"  -> Satisfacción histórica cargada y cruzada por ID ({len(sat_years)} años: {', '.join(sat_years)})")
    except Exception as e_sat:
        print(f"  AVISO: No se pudo cargar hoja 'Satisfacción Histórica': {e_sat}")

    # ── 3. Cargar Hoja: Demanda Histórica por Filial (Dinámica por Años) ──
    demand_summary = {}
    demand_filiales = []
    demand_years = []
    try:
        if 'Demanda Histórica' in efe_excel_file.sheet_names:
            df_dem = read_excel_flexible_header(EFE_EXCEL_PATH, 'Demanda Histórica', ['filial'])
            col_fil = next((c for c in df_dem.columns if 'filial' in str(c).lower()), df_dem.columns[0])

            # Detectar dinámicamente columnas de año (ej. 2018, 2019, ..., 2025)
            found_years = []
            for col in df_dem.columns:
                col_str = str(col).strip()
                if col_str.isdigit() and len(col_str) == 4:
                    found_years.append(col_str)
            demand_years = sorted(list(set(found_years)), key=lambda y: int(y))
            if not demand_years:
                demand_years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025']

            for _, r_dem in df_dem.iterrows():
                f_name = str(r_dem.get(col_fil) or '').strip()
                if not f_name or f_name.lower() == 'nan' or 'total' in f_name.lower():
                    continue

                hist_map = {}
                for yr in demand_years:
                    val = r_dem.get(yr) if yr in df_dem.columns else r_dem.get(int(yr))
                    if pd.notna(val):
                        try:
                            hist_map[yr] = round(float(val), 2)
                        except Exception:
                            hist_map[yr] = None
                    else:
                        hist_map[yr] = None

                demand_summary[f_name] = hist_map
                if f_name not in demand_filiales:
                    demand_filiales.append(f_name)

            print(f"  -> Demanda histórica por filial cargada ({len(demand_filiales)} filiales, {len(demand_years)} años: {', '.join(demand_years)})")
    except Exception as e_dem:
        print(f"  AVISO: No se pudo cargar hoja 'Demanda Histórica': {e_dem}")

    # ── 4. Cargar Hoja: Estaciones (Resolviendo nombres desde ID Servicio) ──
    efe_stations = []
    try:
        df_est = None
        for h in [2, 1, 0]:
            try:
                temp_df = pd.read_excel(EFE_EXCEL_PATH, sheet_name='Estaciones', header=h)
                cols_str = ' '.join([str(c).lower() for c in temp_df.columns])
                if 'estaci' in cols_str or 'id' in cols_str:
                    df_est = temp_df
                    break
            except Exception:
                pass

        if df_est is not None:
            col_id = next((c for c in df_est.columns if 'id' in str(c).lower() and 'estaci' in str(c).lower()), 'ID Estación')
            if col_id not in df_est.columns:
                col_id = next((c for c in df_est.columns if 'id' in str(c).lower()), 'ID Estación')
            col_name = next((c for c in df_est.columns if 'nombre' in str(c).lower()), 'Nombre Estación')
            col_serv = next((c for c in df_est.columns if 'servicio' in str(c).lower()), 'ID Servicio')
            col_proj = next((c for c in df_est.columns if 'proyecto' in str(c).lower()), 'ID Proyecto')
            col_op = next((c for c in df_est.columns if 'operacion' in str(c).lower() or 'operación' in str(c).lower()), 'En Operacion')

            for _, r in df_est.iterrows():
                st_id = str(r.get(col_id) or '').strip()
                st_name = str(r.get(col_name) or '').strip()
                if not st_id or st_id.lower() == 'nan' or 'id estaci' in st_id.lower():
                    continue

                srv_raw = r.get(col_serv)
                srv_ids = []
                srv_names = []
                if pd.notna(srv_raw) and str(srv_raw).strip() and str(srv_raw).lower() != 'nan':
                    tokens = [s.strip().replace('\u2013', '-').replace('\u2014', '-') for s in re.split(r'[,;/·\n]', str(srv_raw)) if s.strip()]
                    for tok in tokens:
                        if tok in service_master:
                            srv_ids.append(tok)
                            srv_names.append(service_master[tok]['service'])
                        else:
                            # Fallback por coincidencia de nombre si se usó texto
                            matched_by_name = False
                            for sid, sinfo in service_master.items():
                                if sinfo['service'].lower() == tok.lower():
                                    srv_ids.append(sid)
                                    srv_names.append(sinfo['service'])
                                    matched_by_name = True
                                    break
                            if not matched_by_name:
                                srv_names.append(tok)

                proj_raw = r.get(col_proj)
                proj_list = []
                if pd.notna(proj_raw) and str(proj_raw).strip() and str(proj_raw).lower() != 'nan':
                    for p in re.split(r'[,;/\n]', str(proj_raw)):
                        p_clean = str(p).strip()
                        if p_clean and p_clean.lower() != 'nan':
                            if re.match(r'^\d+(\.0)?$', p_clean):
                                p_clean = f"P-{int(float(p_clean))}"
                            proj_list.append(p_clean)

                op_raw = str(r.get(col_op) or '').strip().lower() if col_op in df_est.columns else ''
                in_op = op_raw in ['si', 'sí', 'true', '1', 'yes'] or (not op_raw and len(srv_names) > 0)

                efe_stations.append({
                    'id': st_id,
                    'name': st_name,
                    'service_ids': srv_ids,
                    'services': srv_names,
                    'project_ids': proj_list,
                    'in_operation': in_op
                })
            print(f"  -> {len(efe_stations)} estaciones de pasajeros cargadas desde 'Estaciones' ({sum(1 for s in efe_stations if s['in_operation'])} en operación)")
    except Exception as e_est:
        print(f"  AVISO: No se pudo cargar hoja 'Estaciones' de EFE: {e_est}")

    # ── 4. Conteo dinámico de estaciones por servicio ──
    for line in efe_lines:
        lid = str(line.get('id') or '')
        l_tokens = [t.strip() for t in lid.split(';') if t.strip()]
        lname = line.get('service', '').lower()
        cnt = sum(1 for st in efe_stations if (
            any(t in st.get('service_ids', []) for t in l_tokens) or
            lid in st.get('service_ids', []) or
            lname in [s.lower() for s in st.get('services', [])]
        ))
        line['stations'] = cnt

    efe_payload = {
        'data': efe_projects,
        'lines': efe_lines,
        'stations': efe_stations,
        'demand_summary': demand_summary,
        'demand_filiales': demand_filiales,
        'demand_years': demand_years
    }
    out_efe_js = os.path.join(OUT_DIR, 'efe_data.js')
    efe_json_str = json.dumps(efe_payload, ensure_ascii=False, indent=None, separators=(',', ':'))
    with open(out_efe_js, 'w', encoding='utf-8') as f:
        f.write(f'window.EFE_DATA = {efe_json_str};')

    size_efe_mb = os.path.getsize(out_efe_js) / 1024 / 1024
    print(f"OK EFE Generado: {out_efe_js} ({size_efe_mb:.3f} MB)")
    print(f"   Proyectos EFE exportados: {len(efe_projects)} (deduplicados de {len(df_efe)} registros)")
    print(f"   Servicios regulares de pasajeros exportados: {len(efe_lines)}")
    print(f"   Estaciones de pasajeros exportadas: {len(efe_stations)}")

except Exception as e:
    print(f"[WARN] Error al exportar datos EFE: {e}")
    raise
