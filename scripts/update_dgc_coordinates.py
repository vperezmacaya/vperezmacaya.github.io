import os, json, shutil, unicodedata, math, openpyxl

def geo_distance(p1, p2):
    # p = [lon, lat]
    R = 6371000
    phi1, phi2 = math.radians(p1[1]), math.radians(p2[1])
    dphi = math.radians(p2[1] - p1[1])
    dlam = math.radians(p2[0] - p1[0])
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, "Bases de dato")
EXCEL_PATH = os.path.join(DATA_DIR, "DGC.xlsx")
BACKUP_PATH = os.path.join(DATA_DIR, "DGC_backup.xlsx")
GEOJSON_PATH = os.path.join(ROOT_DIR, "Mapas vectoriales", "DGC", "DGC_line.json")

def normalize_text(val):
    if val is None:
        return ''
    s = str(val).strip().lower()
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def parse_shapes_list(val):
    if val is None:
        return []
    s = str(val).strip()
    if not s or s.lower() == 'nan' or s.lower() == 'none':
        return []
    try:
        f = float(s)
        if f == int(f):
            return [str(int(f))]
    except ValueError:
        pass
    cleaned = s.replace(';', ',').replace('.', ',')
    parts = [p.strip() for p in cleaned.split(',') if p.strip()]
    cleaned_parts = []
    for p in parts:
        try:
            f = float(p)
            if f == int(f):
                cleaned_parts.append(str(int(f)))
            else:
                cleaned_parts.append(p)
        except ValueError:
            cleaned_parts.append(p)
    return cleaned_parts

def get_start_end_coords(feature):
    geom = feature.get('geometry') or {}
    g_type = geom.get('type')
    coords = geom.get('coordinates') or []
    if not coords:
        return None, None
    if g_type == 'LineString':
        return coords[0], coords[-1]
    elif g_type == 'MultiLineString':
        return coords[0][0], coords[-1][-1]
    return None, None

def main():
    print(f'Cargando GeoJSON: {GEOJSON_PATH}...')
    with open(GEOJSON_PATH, 'r', encoding='utf-8') as f:
        dgc_line = json.load(f)

    line_by_cod = {}
    for ft in dgc_line.get('features', []):
        cod = ft.get('properties', {}).get('COD')
        if cod is not None:
            line_by_cod.setdefault(str(cod).strip(), []).append(ft)

    print(f'  -> Features cargadas. CODs indexados: {len(line_by_cod)}')

    if not os.path.exists(EXCEL_PATH):
        raise FileNotFoundError(f'No se encontro {EXCEL_PATH}')

    if not os.path.exists(BACKUP_PATH):
        print(f'Creando respaldo en {BACKUP_PATH}...')
        shutil.copy2(EXCEL_PATH, BACKUP_PATH)

    print(f'Abriendo Excel: {EXCEL_PATH}...')
    wb = openpyxl.load_workbook(EXCEL_PATH)
    if 'BD' not in wb.sheetnames:
        raise ValueError('No se encontro la hoja BD en el archivo Excel.')

    ws = wb['BD']
    col_shapes = None
    col_sector = None
    col_code = None
    col_name = None

    for col in range(1, ws.max_column + 1):
        val = ws.cell(row=1, column=col).value
        norm_val = normalize_text(val)
        if norm_val == 'shapes':
            col_shapes = col
        elif 'sector' in norm_val and 'proyecto' in norm_val:
            col_sector = col
        elif 'codigo' in norm_val and 'proyecto' in norm_val:
            col_code = col
        elif 'nombre' in norm_val and ('comun' in norm_val or 'concesion' in norm_val):
            if col_name is None:
                col_name = col

    print(f'Columnas detectadas: Shapes={col_shapes}, Sector={col_sector}, Codigo={col_code}')

    if not col_shapes or not col_sector:
        raise ValueError('No se pudieron ubicar las columnas Shapes o Sector del proyecto.')

    target_headers = ['Latitud Inicio', 'Longitud Inicio', 'Latitud Fin', 'Longitud Fin']
    header_cols = {}

    for col in range(1, ws.max_column + 1):
        h_val = str(ws.cell(row=1, column=col).value or '').strip()
        if h_val in target_headers:
            header_cols[h_val] = col

    next_col = ws.max_column + 1
    for h in target_headers:
        if h not in header_cols:
            header_cols[h] = next_col
            ws.cell(row=1, column=next_col, value=h)
            next_col += 1

    print('Columnas destino en hoja BD:')
    for h in target_headers:
        print(f'  - {h}: Columna {header_cols[h]}')

    vial_count = 0
    updated_count = 0
    warning_count = 0

    for r in range(2, ws.max_row + 1):
        sector_raw = ws.cell(row=r, column=col_sector).value
        norm_sector = normalize_text(sector_raw)

        in_vial = ('vial urbana' in norm_sector) or ('vial interurbana' in norm_sector)

        if not in_vial:
            for h in target_headers:
                ws.cell(row=r, column=header_cols[h], value=None)
            continue

        vial_count += 1
        code_val = ws.cell(row=r, column=col_code).value if col_code else f'Fila {r}'
        shapes_raw = ws.cell(row=r, column=col_shapes).value
        shape_ids = parse_shapes_list(shapes_raw)

        if not shape_ids:
            print(f'  [AVISO] Fila {r} ({code_val}): Sector vial pero sin Shapes')
            warning_count += 1
            for h in target_headers:
                ws.cell(row=r, column=header_cols[h], value=None)
            continue

        all_pts = []
        for s_id in shape_ids:
            for f in line_by_cod.get(s_id, []):
                pt_start, pt_end = get_start_end_coords(f)
                if pt_start and pt_end:
                    all_pts.append(pt_start)
                    all_pts.append(pt_end)

        if len(all_pts) < 2:
            print(f'  [AVISO] Fila {r} ({code_val}): Menos de 2 puntos validos en shapes {shape_ids}')
            warning_count += 1
            continue

        # Encontrar el par de extremos con maxima distancia geodésica (diámetro del corredor)
        max_d = -1
        p_a, p_b = all_pts[0], all_pts[1]
        for i in range(len(all_pts)):
            for j in range(i + 1, len(all_pts)):
                d = geo_distance(all_pts[i], all_pts[j])
                if d > max_d:
                    max_d = d
                    p_a, p_b = all_pts[i], all_pts[j]

        d_lat = abs(p_a[1] - p_b[1])
        d_lon = abs(p_a[0] - p_b[0])

        # Orientación estándar vial en Chile:
        # Si la ruta es principalmente Norte-Sur (|d_lat| >= |d_lon|): Inicio es Norte (mayor latitud) y Fin es Sur (menor latitud)
        # Si la ruta es principalmente Oriente-Poniente (|d_lon| > |d_lat|): Inicio es Oriente/Stgo/Cordillera (mayor longitud) y Fin es Poniente/Costa (menor longitud)
        if d_lat >= d_lon:
            p_start = p_a if p_a[1] > p_b[1] else p_b
            p_end = p_b if p_a[1] > p_b[1] else p_a
        else:
            p_start = p_a if p_a[0] > p_b[0] else p_b
            p_end = p_b if p_a[0] > p_b[0] else p_a

        lon_start, lat_start = p_start[0], p_start[1]
        lon_end, lat_end = p_end[0], p_end[1]

        ws.cell(row=r, column=header_cols['Latitud Inicio'], value=round(lat_start, 5))
        ws.cell(row=r, column=header_cols['Longitud Inicio'], value=round(lon_start, 5))
        ws.cell(row=r, column=header_cols['Latitud Fin'], value=round(lat_end, 5))
        ws.cell(row=r, column=header_cols['Longitud Fin'], value=round(lon_end, 5))

        updated_count += 1

    print(f'\nResumen del proceso:')
    print(f'  Proyectos viales encontrados: {vial_count}')
    print(f'  Proyectos con coordenadas actualizadas: {updated_count}')
    print(f'  Advertencias: {warning_count}')

    print(f'Guardando cambios en {EXCEL_PATH}...')
    wb.save(EXCEL_PATH)
    print('Guardado exitoso.')

if __name__ == '__main__':
    main()
