"""Metro: Mapas vectoriales/Metro (+ Metro.xlsx) → static/data/metro_geo.js y metro_comunas.js.
"""
from etl.comun_geo import *  # noqa: F401,F403  rutas y simplificación de geometrías

# 3. Cargar capas de Metro (líneas y puntos)
EFE_DIR = os.path.join(MAPS_DIR, 'EFE')
METRO_DIR = os.path.join(MAPS_DIR, 'Metro')
# Cargar Metro_line.json (separando comerciales operativas y proyectos futuros)
metro_fc = {"type": "FeatureCollection", "features": []}
metro_expansion_features = []
metro_path = os.path.join(METRO_DIR, 'Metro_line.json')
if not os.path.exists(metro_path):
    metro_path = os.path.join(EFE_DIR, 'Metro_line.json')
if os.path.exists(metro_path):
    print("Procesando Metro_line.json (líneas operativas y proyectos)...")
    try:
        with open(metro_path, 'r', encoding='utf-8') as f:
            raw_metro = json.load(f)
            for ft in raw_metro.get('features', []):
                geom = ft.get('geometry')
                if not geom or not geom.get('coordinates'):
                    continue
                ft['geometry']['coordinates'] = round_coords(ft['geometry']['coordinates'])
                props = ft.get('properties') or {}
                if props.get('COD') is not None or props.get('ID Proyecto') is not None:
                    metro_expansion_features.append(ft)
                elif props.get('usage') == 'main':
                    metro_fc['features'].append(ft)
        print(f"  -> {len(metro_fc['features'])} líneas operativas y {len(metro_expansion_features)} proyectos cargados desde Metro_line.json.")
    except Exception as e:
        print(f"⚠ Error al leer Metro_line.json: {e}")

# Cargar Metro_point.json (Estaciones y puntos de Metro)
metro_all_points_raw = []
metro_point_path = os.path.join(METRO_DIR, 'Metro_point.json')
if not os.path.exists(metro_point_path):
    metro_point_path = os.path.join(EFE_DIR, 'Metro_point.json')
if os.path.exists(metro_point_path):
    print("Procesando Metro_point.json (estaciones y puntos de Metro)...")
    try:
        with open(metro_point_path, 'r', encoding='utf-8') as f:
            raw_pts = json.load(f)
            for ft in raw_pts.get('features', []):
                geom = ft.get('geometry')
                if not geom or not geom.get('coordinates'):
                    continue
                ft['geometry']['coordinates'] = round_coords(ft['geometry']['coordinates'])
                metro_all_points_raw.append(ft)
        print(f"  -> {len(metro_all_points_raw)} puntos de Metro cargados desde Metro_point.json.")
    except Exception as e:
        print(f"⚠ Error al leer Metro_point.json: {e}")

# Para EFE, filtrar estaciones operativas (nodos OSM)
metro_points_fc = {
    "type": "FeatureCollection",
    "features": [ft for ft in metro_all_points_raw if str(ft.get('id', '')).startswith('node/')]
}


# 4. Utilidades para leer Excel y normalizar nombres (las usa Metro)
import unicodedata
import re
import pandas as pd

def read_excel_flexible_header(excel_path, sheet_name, required_keywords, header_candidates=(2, 1, 0, 3)):
    """Lee una hoja de Excel probando varias posiciones de fila de encabezado
    hasta encontrar una cuyas columnas contengan alguna de las keywords esperadas.
    Evita que insertar/quitar una fila de título arriba del encabezado real
    rompa silenciosamente la detección de columnas."""
    for h in header_candidates:
        try:
            df = pd.read_excel(excel_path, sheet_name=sheet_name, header=h)
        except Exception:
            continue
        cols_str = ' '.join([str(c).lower() for c in df.columns])
        if any(kw in cols_str for kw in required_keywords):
            return df
    return pd.read_excel(excel_path, sheet_name=sheet_name, header=header_candidates[0])

def clean_feat_name(s):
    if not s: return ''
    s = str(s).strip()
    s = re.sub(r'^[0-9]+[a-zA-Z]?\s*:\s*', '', s)
    return s.replace('\xa0', ' ').strip()

def normalize_key(s):
    s = clean_feat_name(s).lower()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

# 5. Capas de Metro de Santiago (Red Existente y Proyectos desde Metro_line y Metro_point)
print("\nProcesando capas de Metro de Santiago...")
print(f"  -> {len(metro_expansion_features)} trazados de proyectos y {len(metro_fc['features'])} líneas operativas listos desde Metro_line.json.")
metro_futuro_stations_features = []

# Cargar datos de Estaciones desde Excel (Bases de dato/Metro/Metro.xlsx)
metro_excel_path = os.path.join(BASE_DIR, 'Bases de dato', 'Metro', 'Metro.xlsx')
metro_stations_by_shape = {}
metro_stations_by_line_name = {}
metro_stations_by_name = {}
metro_stations_by_comuna = {}

if os.path.exists(metro_excel_path):
    try:
        df_est_geo = read_excel_flexible_header(metro_excel_path, 'Estaciones', ['código shape', 'nombre estaci'], header_candidates=(2, 1, 0, 3))
        for _, r in df_est_geo.iterrows():
            st_name = str(r.get('Nombre Estación', '')).strip()
            if not st_name or st_name == 'nan': continue
            sh_id = str(r.get('Código Shape', '')).strip()
            lines_str = str(r.get('Línea', r.get('Líneas que Conecta', ''))).strip()
            lines_arr = [l.strip() for l in lines_str.split(',') if l.strip()]
            linea_p = lines_arr[0] if lines_arr else ''
            is_comb = str(r.get('Es Combinación', '')).strip().lower() in ['sí', 'si', 'true', '1']
            comunas_str = str(r.get('Comuna', '')).strip()
            comunas_arr = [c.strip() for c in comunas_str.split(',') if c.strip()]
            status = str(r.get('Estado', '')).strip()
            fut_comb = str(r.get('Combinación Futura', '')).strip()
            color_val = str(r.get('Color Hex', '')).strip()
            color_hex = color_val if color_val and color_val != 'nan' else '#52525b'

            raw_proj = str(r.get('ID Proyecto', '')).strip()
            proj_list = [p.strip() for p in raw_proj.split(',') if p.strip()] if raw_proj and raw_proj != 'nan' else []

            st_obj = {
                'id': str(r.get('ID Estación', '')).strip(),
                'name': st_name,
                'shape_id': sh_id,
                'line': linea_p,
                'lines': lines_arr if lines_arr else [linea_p],
                'lines_str': lines_str,
                'is_combination': is_comb,
                'future_combination': fut_comb if fut_comb != 'nan' else '',
                'commune': comunas_str,
                'communes': comunas_arr,
                'status': status,
                'color': color_hex,
                'project_id': raw_proj if raw_proj and raw_proj != 'nan' else None,
                'project_ids': proj_list
            }
            if sh_id and sh_id != 'nan':
                metro_stations_by_shape[sh_id] = st_obj
            
            norm_st = normalize_key(st_name)
            for single_l in lines_arr:
                metro_stations_by_line_name[(normalize_key(single_l), norm_st)] = st_obj

            # Para búsqueda fallback por nombre, priorizar estaciones operativas
            if norm_st not in metro_stations_by_name or status == 'Operativa':
                metro_stations_by_name[norm_st] = st_obj

            if status == 'Operativa':
                for c_item in comunas_arr:
                    c_k = normalize_key(c_item)
                    if c_k not in metro_stations_by_comuna:
                        metro_stations_by_comuna[c_k] = []
                    if st_name not in metro_stations_by_comuna[c_k]:
                        metro_stations_by_comuna[c_k].append(st_name)

        print(f"  -> {len(metro_stations_by_shape)} estaciones cargadas desde Excel indexadas por shape_id único.")

        # Enriquecer y separar puntos de Metro (operativos y futuros/proyectos) desde Excel
        metro_existing_stations_features = []
        metro_futuro_stations_features = []

        for ft in metro_all_points_raw:
            fid = str(ft.get('id') or ft.get('properties', {}).get('@id') or ft.get('properties', {}).get('shape_id') or '')
            fname = ft.get('properties', {}).get('name', '')
            fline = ft.get('properties', {}).get('linea', '')

            st_info = metro_stations_by_shape.get(fid)
            if not st_info and fline and fname:
                st_info = metro_stations_by_line_name.get((normalize_key(fline), normalize_key(fname)))
            if not st_info and fname:
                st_info = metro_stations_by_name.get(normalize_key(fname))

            if st_info:
                ft['id'] = st_info['shape_id']
                if 'properties' not in ft: ft['properties'] = {}
                ft['properties']['@id'] = st_info['shape_id']
                ft['properties']['shape_id'] = st_info['shape_id']
                ft['properties']['linea'] = st_info['line']
                ft['properties']['lines'] = st_info['lines']
                ft['properties']['color'] = st_info['color']
                ft['properties']['is_combination'] = st_info['is_combination']
                ft['properties']['future_combination'] = st_info['future_combination']
                ft['properties']['comuna'] = st_info['commune']
                ft['properties']['status'] = st_info['status']
                ft['properties']['project_id'] = st_info['project_id']
                ft['properties']['project_ids'] = st_info['project_ids']

                if st_info['status'] == 'Operativa':
                    metro_existing_stations_features.append(ft)
                else:
                    metro_futuro_stations_features.append(ft)
            else:
                # Punto de proyecto no registrado como estación comercial (ej: taller, subestación)
                ft['id'] = fid
                if 'properties' not in ft: ft['properties'] = {}
                ft['properties']['shape_id'] = fid
                metro_futuro_stations_features.append(ft)

        metro_points_fc = {"type": "FeatureCollection", "features": metro_existing_stations_features}

    except Exception as e_geo_est:
        print(f"  ⚠ Error al cargar Estaciones desde Excel en metro_mapa: {e_geo_est}")

# Generar static/data/metro_geo.js
out_metro_geo_js = os.path.join(OUT_DIR, 'metro_geo.js')
metro_geo_payload = {
    "type": "FeatureCollection",
    "features": metro_expansion_features
}
with open(out_metro_geo_js, 'w', encoding='utf-8') as f:
    f.write('window.METRO_GEO_DATA = ' + json.dumps(metro_geo_payload, ensure_ascii=False, separators=(',', ':')) + ';\n' +
            'window.METRO_EXISTING_LINES = ' + json.dumps(metro_fc, ensure_ascii=False, separators=(',', ':')) + ';\n' +
            'window.METRO_EXISTING_STATIONS = ' + json.dumps(metro_points_fc, ensure_ascii=False, separators=(',', ':')) + ';\n' +
            'window.METRO_FUTURO_STATIONS = ' + json.dumps({"type": "FeatureCollection", "features": metro_futuro_stations_features}, ensure_ascii=False, separators=(',', ':')) + ';')

size_metro_geo_mb = os.path.getsize(out_metro_geo_js) / 1024 / 1024
print(f"OK Metro geo exportado: {out_metro_geo_js} ({size_metro_geo_mb:.2f} MB)")
print(f"Total features expansión Metro: {len(metro_expansion_features)}, Líneas existentes: {len(metro_fc['features'])}, Estaciones existentes: {len(metro_points_fc['features'])}, Estaciones futuras: {len(metro_futuro_stations_features)}")

# 6. Procesar Comunas del Gran Santiago (Análisis Espacial y Estadísticas de Cobertura)
print("\nProcesando comunas del Gran Santiago (Gran_Santiago.geojson)...")
gran_stgo_path = os.path.join(METRO_DIR, 'Gran_Santiago.geojson')

if os.path.exists(gran_stgo_path):
    try:
        from shapely.geometry import shape, Point
        
        with open(gran_stgo_path, 'r', encoding='utf-8') as f:
            raw_comunas = json.load(f)

        # Proyectos futuros por comuna, derivados dinámicamente de la hoja 'Proyectos Metro'
        # (columna 'Comunas Conectadas', separada por ';') en vez de un diccionario escrito a mano.
        FUTURE_PROJECTS_BY_COMUNA = {}
        try:
            df_proj_geo = read_excel_flexible_header(metro_excel_path, 'Proyectos Metro', ['id proyecto'], header_candidates=(2, 1, 0, 3))
            for _, r in df_proj_geo.iterrows():
                proj_name = str(r.get('Proyecto', '')).strip()
                comunas_raw = str(r.get('Comunas Conectadas', '')).strip()
                if not proj_name or proj_name == 'nan' or not comunas_raw or comunas_raw == 'nan':
                    continue
                for c in comunas_raw.split(';'):
                    c_clean = c.strip()
                    if not c_clean:
                        continue
                    c_key = normalize_key(c_clean)
                    FUTURE_PROJECTS_BY_COMUNA.setdefault(c_key, [])
                    if proj_name not in FUTURE_PROJECTS_BY_COMUNA[c_key]:
                        FUTURE_PROJECTS_BY_COMUNA[c_key].append(proj_name)
            print(f"  -> Proyectos futuros por comuna calculados dinámicamente desde 'Proyectos Metro' ({len(FUTURE_PROJECTS_BY_COMUNA)} comunas).")
        except Exception as e_fut:
            print(f"  ⚠ No se pudo calcular proyectos futuros por comuna desde el Excel: {e_fut}")

        main_lines_geom = []
        for ft in metro_fc.get('features', []):
            props = ft.get('properties', {})
            main_lines_geom.append((shape(ft['geometry']), props.get('name') or props.get('ref') or 'Metro'))
            
        def line_length_km(geom):
            if geom.is_empty:
                return 0.0
            if geom.geom_type == 'LineString':
                coords = list(geom.coords)
                l = 0.0
                for i in range(len(coords) - 1):
                    lon1, lat1 = coords[i]
                    lon2, lat2 = coords[i+1]
                    l += (((lon2 - lon1) * 92.8)**2 + ((lat2 - lat1) * 110.9)**2)**0.5
                return l
            elif geom.geom_type in ['MultiLineString', 'GeometryCollection']:
                return sum(line_length_km(g) for g in geom.geoms if g.geom_type in ['LineString', 'MultiLineString'])
            return 0.0

        stations_pts = []
        for ft in metro_points_fc.get('features', []):
            coords = ft['geometry']['coordinates']
            stations_pts.append((Point(coords[0], coords[1]), ft['properties'].get('name', 'Estación')))
            
        comunas_features_out = []
        comunas_stats_list = []
        
        for ft in raw_comunas.get('features', []):
            c_name = str(ft.get('properties', {}).get('text') or '').strip()
            poly = shape(ft['geometry'])
            
            # Estaciones oficiales de la comuna (definidas en Excel, incluyendo limítrofes)
            c_norm = normalize_key(c_name)
            if c_norm in metro_stations_by_comuna:
                st_in_comuna = metro_stations_by_comuna[c_norm]
            else:
                st_in_comuna = [name for pt, name in stations_pts if poly.contains(pt)]
            
            # Líneas que cruzan
            lines_crossing = set()
            for l_geom, l_name in main_lines_geom:
                if poly.intersects(l_geom):
                    lines_crossing.add(l_name)
                        
            has_metro = len(st_in_comuna) > 0
            future_projs = FUTURE_PROJECTS_BY_COMUNA.get(c_norm, [])
            
            if has_metro:
                exp_status = 'Servicio Activo'
            elif len(future_projs) > 0:
                exp_status = 'En Expansión'
            else:
                exp_status = 'Sin Cobertura'
                
            props = {
                'comuna': c_name,
                'has_metro': has_metro,
                'estaciones_count': len(st_in_comuna),
                'estaciones_list': sorted(st_in_comuna),
                'lineas': sorted(list(lines_crossing)),
                'proyectos_futuros': future_projs,
                'expansion_status': exp_status
            }
            
            rounded_geom_coords = round_coords(ft['geometry']['coordinates'])
            comunas_features_out.append({
                'type': 'Feature',
                'properties': props,
                'geometry': {
                    'type': ft['geometry']['type'],
                    'coordinates': rounded_geom_coords
                }
            })
            comunas_stats_list.append(props)
            
        # Estadísticas resumidas
        total_c = len(comunas_stats_list)
        con_m = [c for c in comunas_stats_list if c['has_metro']]
        sin_m = [c for c in comunas_stats_list if not c['has_metro']]
        en_exp = [c for c in comunas_stats_list if not c['has_metro'] and len(c['proyectos_futuros']) > 0]
        
        comunas_stats_summary = {
            'total_comunas': total_c,
            'comunas_con_metro': len(con_m),
            'comunas_sin_metro': len(sin_m),
            'comunas_nuevas_expansion': len(en_exp),
            'comunas_nuevas_expansion_nombres': [c['comuna'] for c in en_exp],
            'ranking_estaciones': sorted(con_m, key=lambda x: x['estaciones_count'], reverse=True),
            'lista_sin_metro': sorted(sin_m, key=lambda x: (x['expansion_status'] != 'En Expansión', x['comuna']))
        }
        
        out_metro_comunas_js = os.path.join(OUT_DIR, 'metro_comunas.js')
        with open(out_metro_comunas_js, 'w', encoding='utf-8') as f:
            f.write('window.METRO_COMUNAS_GEO = ' + json.dumps({'type': 'FeatureCollection', 'features': comunas_features_out}, ensure_ascii=False, separators=(',', ':')) + ';\n' +
                    'window.METRO_COMUNAS_STATS = ' + json.dumps(comunas_stats_summary, ensure_ascii=False, indent=2) + ';')
                    
        size_comunas_kb = os.path.getsize(out_metro_comunas_js) / 1024
        print(f"OK Comunas Gran Santiago exportadas: {out_metro_comunas_js} ({size_comunas_kb:.1f} KB)")
        print(f"  -> Total: {total_c}, Con Metro: {len(con_m)}, Sin Metro: {len(sin_m)}, Nuevas en expansión: {len(en_exp)}")
    except Exception as e:
        print(f"⚠ Error al procesar comunas del Gran Santiago: {e}")
else:
    print(f"⚠ No se encontró {gran_stgo_path}")
