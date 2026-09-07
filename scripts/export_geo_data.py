"""
export_geo_data.py
-------------------
Exporta las capas GeoJSON del mapa (Regiones, DGC y EFE) como archivos JS estáticos
con coordenadas optimizadas a 5 decimales (~1m de precisión).

Genera:
  static/data/regions_data.js -> window.REGIONS_DATA
  static/data/dgc_data.js     -> window.DGC_DATA
  static/data/efe_geo.js      -> window.EFE_GEO_DATA
"""

import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPS_DIR = os.path.join(BASE_DIR, 'Mapas vectoriales')
DGC_DIR  = os.path.join(MAPS_DIR, 'DGC')
JSONS_DIR = os.path.join(MAPS_DIR, 'JSONS')
OUT_DIR  = os.path.join(BASE_DIR, 'static', 'data')
os.makedirs(OUT_DIR, exist_ok=True)

def round_coords(coords, precision=5):
    if isinstance(coords, (int, float)):
        return round(coords, precision)
    if isinstance(coords, list):
        return [round_coords(c, precision) for c in coords]
    return coords

# 1. Cargar y optimizar Regiones
reg_path = os.path.join(JSONS_DIR, 'Regional_simplified.json')
regions_fc = {"type": "FeatureCollection", "features": []}

if os.path.exists(reg_path):
    print(f"Procesando regiones: {reg_path}")
    with open(reg_path, 'r', encoding='utf-8') as f:
        raw_reg = json.load(f)
        for ft in raw_reg.get('features', []):
            ft['geometry']['coordinates'] = round_coords(ft['geometry']['coordinates'])
            regions_fc['features'].append(ft)
else:
    print(f"⚠ No se encontró {reg_path}")

out_regions_js = os.path.join(OUT_DIR, 'regions_data.js')
with open(out_regions_js, 'w', encoding='utf-8') as f:
    f.write('window.REGIONS_DATA = ' + json.dumps(regions_fc, ensure_ascii=False, separators=(',', ':')) + ';')

size_reg_mb = os.path.getsize(out_regions_js) / 1024 / 1024
print(f"OK Regiones exportado: {out_regions_js} ({size_reg_mb:.2f} MB)")

# 2. Cargar y optimizar capas DGC (puntos, líneas, polígonos)
dgc_fc = {"type": "FeatureCollection", "features": []}
dgc_filenames = ['DGC_point.json', 'DGC_polygon.json', 'DGC_line.json']

for fname in dgc_filenames:
    fpath = os.path.join(DGC_DIR, fname)
    if os.path.exists(fpath):
        print(f"Procesando DGC {fname}...")
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                raw_dgc = json.load(f)
                features = raw_dgc.get('features', [])
                for ft in features:
                    ft['geometry']['coordinates'] = round_coords(ft['geometry']['coordinates'])
                    dgc_fc['features'].append(ft)
        except Exception as e:
            print(f"⚠ Error al leer {fname}: {e}")
    else:
        print(f"⚠ Advertencia: No existe {fpath}")

out_dgc_js = os.path.join(OUT_DIR, 'dgc_data.js')
with open(out_dgc_js, 'w', encoding='utf-8') as f:
    f.write('window.DGC_DATA = ' + json.dumps(dgc_fc, ensure_ascii=False, separators=(',', ':')) + ';')

size_dgc_mb = os.path.getsize(out_dgc_js) / 1024 / 1024
print(f"OK DGC exportado: {out_dgc_js} ({size_dgc_mb:.2f} MB)")
print(f"Total features DGC: {len(dgc_fc['features'])}")

# 3. Cargar y optimizar capas EFE (líneas y puntos)
EFE_DIR = os.path.join(MAPS_DIR, 'EFE')
METRO_DIR = os.path.join(MAPS_DIR, 'Metro')
efe_fc = {"type": "FeatureCollection", "features": []}
efe_filenames = ['EFE_line.json', 'EFE_point.json']

for fname in efe_filenames:
    fpath = os.path.join(EFE_DIR, fname)
    if os.path.exists(fpath):
        print(f"Procesando EFE {fname}...")
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                raw_efe = json.load(f)
                features = raw_efe.get('features', [])
                for ft in features:
                    geom = ft.get('geometry')
                    if not geom or not geom.get('coordinates'):
                        continue  # skip features with null/empty geometry
                    ft['geometry']['coordinates'] = round_coords(ft['geometry']['coordinates'])
                    efe_fc['features'].append(ft)
        except Exception as e:
            print(f"⚠ Error al leer {fname}: {e}")
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

# Cargar EFE_estaciones_filtradas.json (Estaciones de EFE con servicio activo de pasajeros)
efe_estaciones_fc = {"type": "FeatureCollection", "features": []}
efe_est_path = os.path.join(EFE_DIR, 'EFE_estaciones_filtradas.json')
if os.path.exists(efe_est_path):
    print("Procesando EFE_estaciones_filtradas.json (estaciones activas de pasajeros)...")
    try:
        with open(efe_est_path, 'r', encoding='utf-8') as f:
            raw_efe_est = json.load(f)
            for ft in raw_efe_est.get('features', []):
                geom = ft.get('geometry')
                if not geom or not geom.get('coordinates'):
                    continue
                ft['geometry']['coordinates'] = round_coords(ft['geometry']['coordinates'])
                efe_estaciones_fc['features'].append(ft)
        print(f"  -> {len(efe_estaciones_fc['features'])} estaciones activas de EFE agregadas.")
    except Exception as e:
        print(f"⚠ Error al leer EFE_estaciones_filtradas.json: {e}")

out_efe_js = os.path.join(OUT_DIR, 'efe_geo.js')
with open(out_efe_js, 'w', encoding='utf-8') as f:
    f.write('window.EFE_GEO_DATA = ' + json.dumps(efe_fc, ensure_ascii=False, separators=(',', ':')) + ';\n' +
            'window.METRO_GEO_DATA = ' + json.dumps(metro_fc, ensure_ascii=False, separators=(',', ':')) + ';\n' +
            'window.METRO_POINTS_DATA = ' + json.dumps(metro_points_fc, ensure_ascii=False, separators=(',', ':')) + ';\n' +
            'window.EFE_ESTACIONES_DATA = ' + json.dumps(efe_estaciones_fc, ensure_ascii=False, separators=(',', ':')) + ';')

size_efe_mb = os.path.getsize(out_efe_js) / 1024 / 1024
print(f"OK EFE geo exportado: {out_efe_js} ({size_efe_mb:.2f} MB)")
print(f"Total features EFE: {len(efe_fc['features'])}, Metro Líneas: {len(metro_fc['features'])}, Metro Estaciones: {len(metro_points_fc['features'])}, EFE Estaciones: {len(efe_estaciones_fc['features'])}")


# 4. Cargar y optimizar capas SECTRA (Gran Concepción y otros)
import unicodedata
import re
import pandas as pd

SECTRA_DIR = os.path.join(MAPS_DIR, 'SECTRA')
sectra_fc = {"type": "FeatureCollection", "features": []}

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

# Cargar proyectos de Excel para asociación precisa
sectra_excel_path = os.path.join(BASE_DIR, 'Bases de dato', 'Proyectos_SECTRA.xlsx')
if not os.path.exists(sectra_excel_path):
    sectra_excel_path = os.path.join(BASE_DIR, 'Bases de dato', 'Proyectos_SECTRA_actualizado.xlsx')

excel_projects = []
excel_lookup = {}
if os.path.exists(sectra_excel_path):
    try:
        df_sec = pd.read_excel(sectra_excel_path, sheet_name='Proyectos SECTRA')
        for idx, row in df_sec.iterrows():
            p_data = {
                'id': int(idx + 1),
                'region': str(row.get('Región') or ''),
                'city': str(row.get('Ciudad / Área') or ''),
                'name': str(row.get('Proyecto') or ''),
                'investment': float(row.get('Inversión')) if pd.notna(row.get('Inversión')) else None,
                'currency': str(row.get('Moneda') or ''),
                'tir': str(row.get('TIR') or ''),
                'mandante': str(row.get('Mandante') or ''),
                'status': str(row.get('Estado') or ''),
                'description': str(row.get('Descripción') or ''),
                'source_url': str(row.get('Fuente URL') or '')
            }
            excel_projects.append(p_data)
            norm = normalize_key(p_data['name'])
            excel_lookup[norm] = p_data
    except Exception as e:
        print(f"⚠ Error al leer excel SECTRA para matching: {e}")

# Aliases específicos para Gran Concepción
KNOWN_ALIASES = {
    normalize_key("Corredor Eje Colón-21 de Mayo. Tramo 1A"): "Corredor Eje Colón-21 de Mayo (entre Plaza El Ancla y Calle Hualpén)",
    normalize_key("1A: Corredor Eje Colón-21 de Mayo. Tramo 1A"): "Corredor Eje Colón-21 de Mayo (entre Plaza El Ancla y Calle Hualpén)",
    normalize_key("Mejoramiento de Acceso Tumbes"): "Mejoramiento de acceso a Tumbes",
    normalize_key("11: Mejoramiento de Acceso Tumbes"): "Mejoramiento de acceso a Tumbes",
    normalize_key("Corredor Manuel Montt en Coronel, Tramo C y D"): "Corredor Manuel Montt en Coronel, Tramos C y D",
    normalize_key("16C: Corredor Manuel Montt en Coronel, Tramo C y D"): "Corredor Manuel Montt en Coronel, Tramos C y D",
    normalize_key("Vicuña Mackenna"): "Mejoramiento Camilo Henríquez, Par Vial Bulnes-Cruz",
    normalize_key("8: Vicuña Mackenna"): "Mejoramiento Camilo Henríquez, Par Vial Bulnes-Cruz"
}

if os.path.exists(SECTRA_DIR):
    print("\nProcesando capas SECTRA...")
    
    # 1. Procesar Polígonos y Líneas primero, luego Puntos no redundantes
    poly_file = os.path.join(SECTRA_DIR, 'PLAN TRANSPORTE URBANO GRAN CONCEPCIÓN PROYECTOS_polygon.json')
    line_file = os.path.join(SECTRA_DIR, 'PLAN TRANSPORTE URBANO GRAN CONCEPCIÓN PROYECTOS_line.json')
    point_file = os.path.join(SECTRA_DIR, 'PLAN TRANSPORTE URBANO GRAN CONCEPCIÓN PROYECTOS_point.json')
    
    seen_project_keys = set()
    
    for fpath in [poly_file, line_file, point_file]:
        if not os.path.exists(fpath):
            continue
        is_point_file = 'point' in os.path.basename(fpath).lower()
        
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                raw_sec = json.load(f)
                features = raw_sec.get('features', [])
                for ft in features:
                    geom = ft.get('geometry')
                    if not geom or not geom.get('coordinates'):
                        continue

                    props = ft.get('properties', {})
                    name = str(props.get('name') or '').strip()
                    desc = str(props.get('description') or '').strip()

                    # Excluir 'Situación Base' o 'SB'
                    if (name.upper() in ['SB', 'SITUACION BASE', 'SITUACIÓN BASE'] or
                        'situacion base' in name.lower() or 'situación base' in name.lower() or
                        'situacion base' in desc.lower() or 'situación base' in desc.lower()):
                        continue

                    cleaned_title = clean_feat_name(name)
                    norm = normalize_key(name)
                    matched_project = None

                    # 1. Alias conocido
                    if norm in KNOWN_ALIASES:
                        alias_target = KNOWN_ALIASES[norm]
                        norm_alias = normalize_key(alias_target)
                        matched_project = excel_lookup.get(norm_alias)

                    # 2. Coincidencia exacta
                    if not matched_project and norm in excel_lookup:
                        matched_project = excel_lookup[norm]

                    # 3. Substring matching
                    if not matched_project:
                        for k, p_data in excel_lookup.items():
                            if len(k) >= 10 and (k in norm or norm in k):
                                matched_project = p_data
                                break

                    # Llave única del proyecto para evitar duplicar punto si ya existe línea
                    proj_key = str(matched_project['id']) if matched_project else norm
                    
                    if is_point_file and proj_key in seen_project_keys:
                        # Ya existe geometría de línea para este proyecto, omitir punto redundante
                        continue

                    seen_project_keys.add(proj_key)
                    ft['geometry']['coordinates'] = round_coords(geom['coordinates'])

                    # Inyectar propiedades estandarizadas
                    if matched_project:
                        props['matched'] = True
                        props['project_id'] = matched_project['id']
                        props['project_name'] = matched_project['name']
                        props['region'] = matched_project['region']
                        props['city'] = matched_project['city']
                        props['investment'] = matched_project['investment']
                        props['currency'] = matched_project['currency']
                        props['tir'] = matched_project['tir']
                        props['mandante'] = matched_project['mandante']
                        props['status'] = matched_project['status']
                        props['description_clean'] = matched_project['description']
                    else:
                        props['matched'] = False
                        props['project_name'] = cleaned_title
                        props['region'] = 'Región del Biobío'
                        props['city'] = 'Conurbación Gran Concepción'

                    props['original_name'] = name
                    ft['properties'] = props
                    sectra_fc['features'].append(ft)

        except Exception as e:
            print(f"⚠ Error al procesar {fpath}: {e}")

out_sectra_geo_js = os.path.join(OUT_DIR, 'sectra_geo.js')
with open(out_sectra_geo_js, 'w', encoding='utf-8') as f:
    f.write('window.SECTRA_GEO_DATA = ' + json.dumps(sectra_fc, ensure_ascii=False, separators=(',', ':')) + ';')

size_sectra_geo_mb = os.path.getsize(out_sectra_geo_js) / 1024 / 1024
print(f"OK SECTRA geo exportado: {out_sectra_geo_js} ({size_sectra_geo_mb:.2f} MB)")
print(f"Total features SECTRA válidos: {len(sectra_fc['features'])}")

# 5. Capas de Metro de Santiago (Red Existente y Proyectos desde Metro_line y Metro_point)
print("\nProcesando capas de Metro de Santiago...")
print(f"  -> {len(metro_expansion_features)} trazados de proyectos y {len(metro_fc['features'])} líneas operativas listos desde Metro_line.json.")
metro_futuro_stations_features = []

# Cargar datos de Estaciones desde Excel (Bases de dato/Metro.xlsx)
metro_excel_path = os.path.join(BASE_DIR, 'Bases de dato', 'Metro.xlsx')
metro_stations_by_shape = {}
metro_stations_by_line_name = {}
metro_stations_by_name = {}
metro_stations_by_comuna = {}

if os.path.exists(metro_excel_path):
    try:
        df_est_geo = pd.read_excel(metro_excel_path, sheet_name='Estaciones', header=2)
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
        print(f"  ⚠ Error al cargar Estaciones desde Excel en export_geo_data: {e_geo_est}")

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
            
        FUTURE_PROJECTS_BY_COMUNA = {
            'Renca': ['Línea 7 (Renca - Vitacura)'],
            'Cerro Navia': ['Línea 7 (Renca - Vitacura)', 'Línea A (Acceso Aeropuerto AMB)'],
            'Vitacura': ['Línea 7 (Renca - Vitacura)', 'Extensión Línea 6 Oriente'],
            'La Pintana': ['Línea 9 (Cal y Canto - Plaza La Pintana - Puente Alto)'],
            'Puente Alto': ['Línea 8 (Los Leones - Puente Alto)', 'Línea 9 Tramo 3 (La Pintana - Puente Alto)'],
            'Providencia': ['Línea 7 (Renca - Vitacura)', 'Línea 8 (Los Leones - Puente Alto)'],
            'Santiago': ['Línea 7 (Renca - Vitacura)', 'Línea 9 (Cal y Canto - Plaza La Pintana)'],
            'Recoleta': ['Línea 7 (Renca - Vitacura)', 'Línea 9 (Cal y Canto - Plaza La Pintana)'],
            'Quinta Normal': ['Línea 7 (Renca - Vitacura)'],
            'Las Condes': ['Línea 7 (Renca - Vitacura)'],
            'Cerrillos': ['Extensión Línea 6 Poniente (Cerrillos - Lo Errázuriz)'],
            'San Miguel': ['Línea 9 (Tramos 1 y 2)'],
            'San Joaquín': ['Línea 9 (Tramos 1 y 2)'],
            'La Granja': ['Línea 9 (Tramos 1 y 2)'],
            'San Ramón': ['Línea 9 (Tramos 1 y 2)'],
            'Ñuñoa': ['Línea 8 (Los Leones - Puente Alto)'],
            'Macul': ['Línea 8 (Los Leones - Puente Alto)'],
            'Peñalolén': ['Línea 8 (Los Leones - Puente Alto)'],
            'La Florida': ['Línea 8 (Los Leones - Puente Alto)'],
            'Pudahuel': ['Línea A (Acceso Aeropuerto AMB)'],
            'Lo Prado': ['Línea A (Acceso Aeropuerto AMB)']
        }
        
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
            
            # Líneas y km
            lines_crossing = set()
            total_km = 0.0
            for l_geom, l_name in main_lines_geom:
                if poly.intersects(l_geom):
                    inter = poly.intersection(l_geom)
                    k = line_length_km(inter)
                    if k > 0.05:
                        total_km += k
                        lines_crossing.add(l_name)
                        
            has_metro = len(st_in_comuna) > 0
            future_projs = FUTURE_PROJECTS_BY_COMUNA.get(c_name, [])
            
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
                'km_red': round(total_km, 1),
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

print("\nExportación geográfica completada exitosamente.")

