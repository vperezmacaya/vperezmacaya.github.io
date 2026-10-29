"""
export_geo_data.py
-------------------
Exporta las capas GeoJSON del mapa (DGC y EFE) como archivos JS estáticos
con coordenadas optimizadas a 5 decimales (~1m de precisión).

Genera:
  static/data/dgc_data.js     -> window.DGC_DATA
  static/data/efe_geo.js      -> window.EFE_GEO_DATA
  static/data/mop_geo.js      -> window.MOP_GEO_DATA
  static/data/landing_routes.js -> window.LANDING_ROUTES (vía export_landing_routes.py)
"""

import os
import json
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPS_DIR = os.path.join(BASE_DIR, 'Mapas vectoriales')
DGC_DIR  = os.path.join(MAPS_DIR, 'DGC')
JSONS_DIR = os.path.join(MAPS_DIR, 'JSONS')
OUT_DIR  = os.path.join(BASE_DIR, 'static', 'data')
os.makedirs(OUT_DIR, exist_ok=True)

import math
from shapely.geometry import shape, mapping
from shapely.ops import transform

# Tolerancia de simplificación (Douglas-Peucker) para las formas DGC, en metros.
# El mapa DGC llega a zoom 18, donde 1 px ≈ 0,5 m en Santiago, y las coordenadas
# se redondean a 5 decimales (±0,55 m): con 0,5 m la diferencia es invisible en
# cualquier zoom. Subirla a 1 m ya se nota (2-3 px) en curvas a zoom 18.
DGC_SIMPLIFY_TOLERANCE_M = 0.5

# Trazados MOP (~1,5 M de vértices en bruto, rutas de cientos de km): con 1 m el
# archivo queda en ~6 MB (~1,4 MB comprimido) y el trazado es fiel a cualquier
# zoom útil. El mapa muestra una región o un proyecto a la vez, así que la
# cantidad de vértices no traba el dibujo (con 10 m eran ~2 MB, fiel hasta zoom 14).
MOP_SIMPLIFY_TOLERANCE_M = 1
# Líneas de la capa Contratos_MOP de proyectos con más de MOP_CONTRATOS_NETWORK_KM
# en total: las conservaciones de caminos traen la red vial de una provincia o
# región entera (cientos o miles de km, en muchos contratos y tramos), así que se
# simplifican más; a la escala en que se ve una red así la diferencia no se nota.
# Los demás proyectos (puentes, rutas, obras) van a 1 m, como ArcGIS.
MOP_CONTRATOS_SIMPLIFY_TOLERANCE_M = 10
MOP_CONTRATOS_NETWORK_KM = 100
# Proyectos de Aeropuertos sin geometría: se ubican en el punto de su aeródromo
# (capa Red_Aeroportuaria de la IDE del MOP) cuando el nombre del proyecto lo
# nombra después de "aeródromo", "aeropuerto", "AD." o "aeronaval". Equivalencias
# que el texto no resuelve (frase del nombre del proyecto, sin tildes y en
# mayúsculas → código OACI del aeródromo); agregar aquí las que aparezcan en el
# reporte de cada corrida.
MOP_AERODROMO_ALIAS = {
    'AMB': 'SCEL',                 # Aeropuerto Arturo Merino Benítez
    'CANAL BAJO': 'SCJO',          # en la capa: "Cañal Bajo Carlos Hott Siebert"
    'PUERTO WILLIAMS': 'SCGZ',     # aeródromo Guardiamarina Zañartu
    'ISLA DE PASCUA': 'SCIP',      # aeropuerto Mataveri, el único de la isla
}
MOP_AERODROMO_KEYWORDS = {'AERODROMO', 'AERODROMOS', 'AEROPUERTO', 'AEROPUERTOS', 'AEROD', 'AD', 'AERONAVAL'}
# Más al oeste de esta longitud solo hay islas oceánicas (todas de la Región de Valparaíso)
MOP_OCEANIC_MAX_LNG = -76
# Una geometría a menos de ~2 km de la región que declara el Excel también se
# asigna a ella: los polígonos de sni_regions_data.js están simplificados y los
# caminos que corren por el límite caen a veces del otro lado.
MOP_REGION_BORDER_TOLERANCE_DEG = 0.02
# Región del Excel de iniciativas (mop_data.js) → codregion de sni_regions_data.js
MOP_REGION_CODE_BY_NAME = {
    'Arica y Parinacota': 15, 'Tarapacá': 1, 'Antofagasta': 2, 'Atacama': 3, 'Coquimbo': 4,
    'Valparaíso': 5, 'Metropolitana de Santiago': 13, "Libertador General Bernardo O'Higgins": 6,
    'Maule': 7, 'Ñuble': 16, 'Biobío': 8, 'La Araucanía': 9, 'Los Ríos': 14, 'Los Lagos': 10,
    'Aysén del General Carlos Ibáñez del Campo': 11, 'Magallanes y de la Antártica Chilena': 12,
}

def round_coords(coords, precision=5):
    if isinstance(coords, (int, float)):
        return round(coords, precision)
    if isinstance(coords, (list, tuple)):
        return [round_coords(c, precision) for c in coords]
    return coords

def count_vertices(coords):
    if not coords:
        return 0
    if isinstance(coords[0], (int, float)):
        return 1
    return sum(count_vertices(c) for c in coords)

def _dedupe_consecutive(coords, is_ring):
    """Quita vértices consecutivos repetidos (los deja el redondeo a 5 decimales)
    sin bajar del mínimo válido: 2 puntos por línea, 4 por anillo cerrado."""
    if not coords:
        return coords
    if isinstance(coords[0][0], (int, float)):
        out = [coords[0]]
        for p in coords[1:]:
            if p != out[-1]:
                out.append(p)
        if is_ring and out[-1] != out[0]:
            out.append(out[0])
        return out if len(out) >= (4 if is_ring else 2) else coords
    return [_dedupe_consecutive(c, is_ring) for c in coords]

def simplify_geometry(geom, tol_m):
    """Simplifica líneas/polígonos en metros locales y devuelve coordenadas
    redondeadas a 5 decimales. Los puntos se devuelven solo redondeados."""
    gtype = geom.get('type')
    if gtype in ('Point', 'MultiPoint') or not geom.get('coordinates'):
        return round_coords(geom.get('coordinates'))

    shp = shape(geom)
    minx, miny, maxx, maxy = shp.bounds
    kx = 111320 * math.cos(math.radians((miny + maxy) / 2))
    ky = 110540
    to_m = lambda x, y, z=None: (x * kx, y * ky)
    to_deg = lambda x, y, z=None: (x / kx, y / ky)

    simplified = transform(to_deg, transform(to_m, shp).simplify(tol_m, preserve_topology=True))
    if simplified.is_empty or simplified.geom_type != shp.geom_type:
        return round_coords(geom['coordinates'])

    coords = round_coords(mapping(simplified)['coordinates'])
    return _dedupe_consecutive(coords, is_ring=gtype in ('Polygon', 'MultiPolygon'))

# 2. Cargar y optimizar capas DGC (puntos, líneas, polígonos)
dgc_fc = {"type": "FeatureCollection", "features": []}
dgc_filenames = ['DGC_point.json', 'DGC_polygon.json', 'DGC_line.json']
dgc_vertices_before = 0
dgc_vertices_after = 0

for fname in dgc_filenames:
    fpath = os.path.join(DGC_DIR, fname)
    if os.path.exists(fpath):
        print(f"Procesando DGC {fname}...")
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                raw_dgc = json.load(f)
                features = raw_dgc.get('features', [])
                for ft in features:
                    dgc_vertices_before += count_vertices(ft['geometry']['coordinates'])
                    ft['geometry']['coordinates'] = simplify_geometry(ft['geometry'], DGC_SIMPLIFY_TOLERANCE_M)
                    dgc_vertices_after += count_vertices(ft['geometry']['coordinates'])
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
print(f"Vértices DGC: {dgc_vertices_before} -> {dgc_vertices_after} (simplificación {DGC_SIMPLIFY_TOLERANCE_M} m)")

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

# Cargar EFE_estaciones.json (Estaciones de EFE con servicio activo de pasajeros enriquecidas desde Excel)
efe_estaciones_fc = {"type": "FeatureCollection", "features": []}
efe_est_path = os.path.join(EFE_DIR, 'EFE_estaciones.json')
efe_excel_path = os.path.join(BASE_DIR, 'Bases de dato', 'EFE.xlsx')

efe_stations_excel_lookup = {}
if os.path.exists(efe_excel_path):
    try:
        import pandas as pd
        df_est_efe = pd.read_excel(efe_excel_path, sheet_name='Estaciones', header=2)
        for _, r in df_est_efe.iterrows():
            sid = str(r.get('ID Estación', '')).strip()
            if not sid or sid == 'nan': continue
            s_raw = str(r.get('Servicio', '')).strip()
            s_arr = [s.strip() for s in s_raw.split(',') if s.strip()] if s_raw and s_raw != 'nan' else []
            proj_raw = str(r.get('ID Proyecto', '')).strip()
            proj_arr = []
            if proj_raw and proj_raw.lower() != 'nan':
                for p in re.split(r'[,;/\n]', proj_raw):
                    p_clean = p.strip()
                    if p_clean and p_clean.lower() != 'nan':
                        if re.match(r'^\d+(\.0)?$', p_clean):
                            p_clean = f"P-{int(float(p_clean))}"
                        proj_arr.append(p_clean)
            op_raw = str(r.get('En Operacion', '')).strip().lower()
            in_op = op_raw in ['si', 'sí', 'true', '1', 'yes'] or (not op_raw and len(s_arr) > 0)
            efe_stations_excel_lookup[sid] = {
                'station_id': sid,
                'name': str(r.get('Nombre Estación', '')).strip(),
                'services': s_arr,
                'services_str': s_raw if s_raw != 'nan' else '',
                'project_ids': proj_arr,
                'in_operation': 'Si' if in_op else 'No'
            }
        print(f"  -> {len(efe_stations_excel_lookup)} estaciones EFE indexadas desde hoja 'Estaciones' en {efe_excel_path}.")
    except Exception as e_est_ex:
        print(f"⚠ Error al leer hoja 'Estaciones' de EFE.xlsx: {e_est_ex}")

if os.path.exists(efe_est_path):
    print(f"Procesando {os.path.basename(efe_est_path)} (estaciones activas de pasajeros)...")
    try:
        with open(efe_est_path, 'r', encoding='utf-8') as f:
            raw_efe_est = json.load(f)
            for ft in raw_efe_est.get('features', []):
                geom = ft.get('geometry')
                if not geom or not geom.get('coordinates'):
                    continue
                
                # Enrich with Excel data
                fid = str(ft.get('properties', {}).get('id') or ft.get('id') or '').strip()
                st_info = efe_stations_excel_lookup.get(fid)
                if 'properties' not in ft: ft['properties'] = {}
                # Remove top-level id if present to conform to Option B
                if 'id' in ft:
                    del ft['id']
                if st_info:
                    ft['properties']['id'] = st_info['station_id']
                    ft['properties']['name'] = st_info['name']
                    ft['properties']['services'] = st_info['services']
                    ft['properties']['servicios_activos'] = st_info['services']
                    ft['properties']['services_str'] = st_info['services_str']
                    ft['properties']['project_ids'] = st_info['project_ids']
                    ft['properties']['in_operation'] = st_info['in_operation']
                else:
                    ft['properties']['id'] = fid
                    ft['properties']['services'] = []
                    ft['properties']['servicios_activos'] = []
                    ft['properties']['services_str'] = ''
                    ft['properties']['project_ids'] = []
                    ft['properties']['in_operation'] = 'No'

                efe_estaciones_fc['features'].append(ft)
        print(f"  -> {len(efe_estaciones_fc['features'])} estaciones activas de EFE enriquecidas y agregadas.")
    except Exception as e:
        print(f"⚠ Error al leer EFE_estaciones.json: {e}")

out_efe_js = os.path.join(OUT_DIR, 'efe_geo.js')
with open(out_efe_js, 'w', encoding='utf-8') as f:
    # Solo EFE: la red de Metro va en metro_geo.js (EFE.html no la dibuja)
    f.write('window.EFE_GEO_DATA = ' + json.dumps(efe_fc, ensure_ascii=False, separators=(',', ':')) + ';\n' +
            'window.EFE_ESTACIONES_DATA = ' + json.dumps(efe_estaciones_fc, ensure_ascii=False, separators=(',', ':')) + ';')

size_efe_mb = os.path.getsize(out_efe_js) / 1024 / 1024
print(f"OK EFE geo exportado: {out_efe_js} ({size_efe_mb:.2f} MB)")
print(f"Total features EFE: {len(efe_fc['features'])}, EFE Estaciones: {len(efe_estaciones_fc['features'])}")


# 4. Cargar y optimizar capas SECTRA (Gran Concepción y otros)
import unicodedata
import re
import pandas as pd

SECTRA_DIR = os.path.join(MAPS_DIR, 'SECTRA')
sectra_fc = {"type": "FeatureCollection", "features": []}

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

# 7. Proyectos MOP (Mapas vectoriales/MOP, propiedad COD = CODIGO PROYECTO MOP de Base MOP).
# El dashboard identifica los proyectos por código BIP (Excel de iniciativas), así
# que cada COD se traduce a su CODIGO BIP con la hoja Base MOP; los shapes de
# proyectos sin BIP o sin fila en Base MOP se descartan.
# MOP_manual_bip.json trae geometrías agregadas a mano ya identificadas por BIP
# (propiedad BIP; líneas, puntos o polígonos), para proyectos sin trazado en
# proyectos.mop.gob.cl (ej. 30067364-0, Trazado del Proyecto del Anexo 1.3 de su EIA).
# Contratos_MOP/ (shapefiles de la IDE del MOP, con CODIGOBIP por contrato) es la
# fuente principal para los BIP del dashboard; ArcGIS queda para los que no tienen
# contratos con geometría, y MOP_manual_bip.json manda sobre ambas. Los proyectos de
# Aeropuertos que siguen sin geometría toman el punto de su aeródromo
# (Red_Aeroportuaria/, cruce por nombre y MOP_AERODROMO_ALIAS).
print("\nProcesando proyectos MOP...")
try:
    from scrape_mop_proyectos import mop_id, EXCEL_PATH as MOP_EXCEL_PATH
    import pandas as pd

    df_base_mop = pd.read_excel(MOP_EXCEL_PATH, sheet_name='Base MOP')
    mop_cod_to_bip = {}
    for cod_val, bip_val in zip(df_base_mop['CODIGO PROYECTO MOP'], df_base_mop['CODIGO BIP']):
        bip = '' if pd.isna(bip_val) else str(bip_val).strip()
        if bip:
            mop_cod_to_bip[mop_id(cod_val)] = bip

    # Regiones (codregion 1-16 de sni_regions_data.js, los mismos polígonos del mapa):
    # el mapa de MOP muestra los proyectos por región. Los puntos costeros que caen
    # fuera de esos polígonos simplificados toman la región más cercana, salvo las
    # islas oceánicas (Juan Fernández, Isla de Pascua, Desventuradas), que no están
    # en los polígonos y son de Valparaíso.
    sni_regions_path = os.path.join(OUT_DIR, 'sni_regions_data.js')
    with open(sni_regions_path, 'r', encoding='utf-8') as f:
        regions_txt = f.read()
    regions_fc = json.loads(regions_txt[regions_txt.index('{'):regions_txt.rstrip().rstrip(';').rindex('}') + 1])
    from shapely.prepared import prep
    mop_regions = [(int(ft['properties']['codregion']), shape(ft['geometry'])) for ft in regions_fc['features']]
    mop_regions_prep = [(cod, prep(geom), geom) for cod, geom in mop_regions]

    def mop_regions_of(geom):
        """(codregion que cruza la geometría, si cayó fuera de los polígonos)"""
        codes = sorted(cod for cod, prepared, _ in mop_regions_prep if prepared.intersects(geom))
        if codes:
            return codes, False
        if geom.centroid.x < MOP_OCEANIC_MAX_LNG:
            return [5], True
        return [min(mop_regions, key=lambda r: r[1].distance(geom))[0]], True

    # Región que declara el Excel de iniciativas para cada BIP del dashboard
    mop_data_path = os.path.join(OUT_DIR, 'mop_data.js')
    mop_dash_projects = {}
    if os.path.exists(mop_data_path):
        with open(mop_data_path, 'r', encoding='utf-8') as f:
            mop_txt = f.read()
        mop_dash_projects = {p['bip']: p for p in
                             json.loads(mop_txt[mop_txt.index('{'):mop_txt.rstrip().rstrip(';').rindex('}') + 1])['projects']}
    mop_declared = {bip: p.get('region') for bip, p in mop_dash_projects.items()}

    MOP_MAPS_DIR = os.path.join(MAPS_DIR, 'MOP')
    # Un feature por proyecto y tipo: todos los tramos (o puntos) de un BIP se juntan
    mop_parts = {}
    mop_cods_sin_bip = set()
    mop_descartadas = []
    mop_vertices_before = mop_vertices_after = 0

    MOP_KIND_BY_TYPE = {'LineString': 'line', 'MultiLineString': 'line', 'Point': 'point',
                        'MultiPoint': 'point', 'Polygon': 'polygon', 'MultiPolygon': 'polygon'}
    mop_manual_path = os.path.join(MOP_MAPS_DIR, 'MOP_manual_bip.json')
    raw_manual = {'features': []}
    if os.path.exists(mop_manual_path):
        with open(mop_manual_path, 'r', encoding='utf-8') as f:
            raw_manual = json.load(f)
    mop_manual_bips = {str((ft.get('properties') or {}).get('BIP') or '').strip() for ft in raw_manual.get('features', [])}

    # Fuente principal: contratos MOP con geometría (capa Contratos_MOP de la IDE
    # del MOP, puntos y líneas al cierre de un mes, en Mapas vectoriales/MOP/
    # Contratos_MOP). Cada contrato trae su CODIGOBIP, así que no hay códigos que
    # traducir, y muestra lo que se contrata hoy (en ~80% de los BIP coincide con
    # ArcGIS; donde no, ArcGIS muestra otros contratos o sectores del proyecto).
    # Solo BIP del dashboard y sin geometría manual. No se descartan por región: el
    # BIP viene escrito en el contrato, y las que caen fuera de la región declarada
    # están junto al límite o son de antes de la creación de Ñuble.
    from shapefile_min import read_dbf, read_shp
    import glob
    import unicodedata
    mop_contratos_dir = os.path.join(MOP_MAPS_DIR, 'Contratos_MOP')
    mop_contratos_bips = set()
    mop_contratos_count = 0
    mop_contratos_rows = []
    for kind, prefix in (('point', 'Contratos_MOP_Punto_'), ('line', 'Contratos_MOP_Linea_')):
        files = sorted(glob.glob(os.path.join(mop_contratos_dir, prefix + '*.shp')))
        if not files:
            print(f"⚠ Advertencia: No hay {prefix}*.shp en {mop_contratos_dir}")
            continue
        base = files[-1][:-4]   # el más reciente (fecha AAAA_MM_DD en el nombre)
        _, rows = read_dbf(base + '.dbf')
        for row, geom in zip(rows, read_shp(base + '.shp')):
            bip = str((row or {}).get('CODIGOBIP') or '').strip()
            if geom and bip in mop_declared and bip not in mop_manual_bips:
                mop_contratos_rows.append((bip, kind, geom))
    # Largo total de líneas por BIP, en km aproximados (grados × 111: sobra para
    # separar las redes viales de las obras)
    mop_contratos_km = {}
    for bip, kind, geom in mop_contratos_rows:
        if kind == 'line':
            mop_contratos_km[bip] = mop_contratos_km.get(bip, 0) + shape(geom).length * 111
    mop_contratos_redes = {b for b, km in mop_contratos_km.items() if km > MOP_CONTRATOS_NETWORK_KM}
    for bip, kind, geom in mop_contratos_rows:
        mop_vertices_before += count_vertices(geom['coordinates'])
        tol = MOP_CONTRATOS_SIMPLIFY_TOLERANCE_M if bip in mop_contratos_redes else MOP_SIMPLIFY_TOLERANCE_M
        coords = simplify_geometry(geom, tol)
        single = geom['type'] in ('Point', 'LineString')
        mop_parts.setdefault((bip, kind), []).extend([coords] if single else coords)
        mop_contratos_bips.add(bip)
        mop_contratos_count += 1

    # ArcGIS (MOP_line/point.json): solo para los BIP sin contratos ni geometría manual
    mop_arcgis_bips = set()
    for kind, fname in (('line', 'MOP_line.json'), ('point', 'MOP_point.json')):
        fpath = os.path.join(MOP_MAPS_DIR, fname)
        if not os.path.exists(fpath):
            print(f"⚠ Advertencia: No existe {fpath}")
            continue
        with open(fpath, 'r', encoding='utf-8') as f:
            raw_mop = json.load(f)
        for ft in raw_mop.get('features', []):
            geom = ft.get('geometry') or {}
            cod = mop_id((ft.get('properties') or {}).get('COD'))
            if not cod or not geom.get('coordinates'):
                continue
            # BIP de Base MOP o, para proyectos que no están ahí, el que trae el shape
            # (download_mop_geo.py lo toma del COD_BIP de ArcGIS)
            bip = mop_cod_to_bip.get(cod) or str((ft.get('properties') or {}).get('BIP') or '').strip()
            if not bip:
                mop_cods_sin_bip.add(cod)
                continue
            if bip in mop_contratos_bips or bip in mop_manual_bips:
                continue
            # Las que solo llegan por el COD_BIP (sin ficha en Base MOP, que ya está
            # revisada) se descartan una por una, antes de juntarlas, si no caen en la
            # región que declara el Excel: hay puntos asociados al BIP equivocado
            # (ej. el aeródromo Pichoy de Valdivia ubicado en Antofagasta).
            declared = MOP_REGION_CODE_BY_NAME.get(mop_declared.get(bip))
            if cod not in mop_cod_to_bip and declared:
                codes, _ = mop_regions_of(shape(geom))
                if declared not in codes:
                    mop_descartadas.append((bip, kind, mop_declared.get(bip), codes))
                    continue
            mop_vertices_before += count_vertices(geom['coordinates'])
            coords = simplify_geometry(geom, MOP_SIMPLIFY_TOLERANCE_M)
            single = geom['type'] in ('Point', 'LineString')
            mop_parts.setdefault((bip, kind), []).extend([coords] if single else coords)
            mop_arcgis_bips.add(bip)

    # Geometrías manuales por BIP: el tipo sale de la geometría; los polígonos (obras
    # de pocos metros) se simplifican con la tolerancia fina de DGC
    mop_manual_count = 0
    if raw_manual.get('features'):
        for ft in raw_manual.get('features', []):
            geom = ft.get('geometry') or {}
            bip = str((ft.get('properties') or {}).get('BIP') or '').strip()
            kind = MOP_KIND_BY_TYPE.get(geom.get('type'))
            if not bip or not kind or not geom.get('coordinates'):
                continue
            mop_vertices_before += count_vertices(geom['coordinates'])
            tol = DGC_SIMPLIFY_TOLERANCE_M if kind == 'polygon' else MOP_SIMPLIFY_TOLERANCE_M
            coords = simplify_geometry(geom, tol)
            single = geom['type'] in ('Point', 'LineString', 'Polygon')
            mop_parts.setdefault((bip, kind), []).extend([coords] if single else coords)
            mop_manual_count += 1

    # Aeródromos (último recurso, solo proyectos de Aeropuertos sin ninguna
    # geometría): el punto del aeródromo que nombra el proyecto, de la capa
    # Red_Aeroportuaria (Mapas vectoriales/MOP/Red_Aeroportuaria, la fecha más
    # reciente; un punto por aeródromo con su código OACI). Es la ubicación del
    # aeródromo, no de la obra: la feature lleva src 'aerodromo' y el mapa y la
    # ficha la rotulan como referencial.
    def mop_norm(text):
        text = unicodedata.normalize('NFD', str(text or '')).encode('ascii', 'ignore').decode().upper()
        return re.sub(r'[^A-Z0-9]+', ' ', text.replace("'", '').replace('´', '')).strip()

    mop_aero_bips = set()
    mop_aero_sin = []
    aero_files = sorted(glob.glob(os.path.join(MOP_MAPS_DIR, 'Red_Aeroportuaria', 'Red_Aeroportuaria_*.shp')))
    if aero_files:
        _, aero_rows = read_dbf(aero_files[-1][:-4] + '.dbf')
        aeros = []        # (nombre normalizado, OACI, [lng, lat], codregion)
        aero_by_oaci = {}
        for row, geom in zip(aero_rows, read_shp(aero_files[-1])):
            if not row or not geom or geom['type'] != 'Point':
                continue
            coord = geom['coordinates']
            code = mop_regions_of(shape(geom))[0][0]
            aero_by_oaci[row['COD_OACI']] = (coord, code)
            # Nombres con variantes separadas por "/" (ej. "Cerro Guido/Gunther Plüschow")
            for variant in str(row['NOMBRE']).split('/'):
                if mop_norm(variant):
                    aeros.append((mop_norm(variant), row['COD_OACI'], coord, code))
        aeros.sort(key=lambda a: -len(a[0]))   # el nombre más largo primero

        def mop_find_aerodromos(name, declared):
            """OACI de los aeródromos que nombra el proyecto, en su región."""
            in_region = lambda code: not declared or code == declared
            found = []
            for phrase, oaci in MOP_AERODROMO_ALIAS.items():
                if re.search(r'\b' + phrase + r'\b', name) and oaci in aero_by_oaci and in_region(aero_by_oaci[oaci][1]):
                    found.append(oaci)
            toks = name.split()
            for i, tok in enumerate(toks):
                if tok not in MOP_AERODROMO_KEYWORDS:
                    continue
                rest = toks[i + 1:]
                # "aeródromo de X", "aeródromos X y Z", "aeródromo y aeronaval de X"
                while rest:
                    while rest and (rest[0] in ('DE', 'DEL', 'Y') or rest[0] in MOP_AERODROMO_KEYWORDS):
                        rest = rest[1:]
                    text = ' '.join(rest)
                    hit = next((a for a in aeros if in_region(a[3]) and
                                (text == a[0] or text.startswith(a[0] + ' '))), None)
                    if not hit:
                        break
                    found.append(hit[1])
                    rest = rest[len(hit[0].split()):]
                    if not rest or rest[0] != 'Y':
                        break
            return list(dict.fromkeys(found))

        mop_with_geo = {b for b, _ in mop_parts}
        for bip, p in sorted(mop_dash_projects.items()):
            if 'Aeropuertos' not in str(p.get('servicio')) or bip in mop_with_geo:
                continue
            oacis = mop_find_aerodromos(mop_norm(p.get('nombre')), MOP_REGION_CODE_BY_NAME.get(p.get('region')))
            if not oacis:
                mop_aero_sin.append((bip, p.get('nombre')))
                continue
            mop_parts[(bip, 'point')] = [round_coords(aero_by_oaci[o][0]) for o in oacis]
            mop_aero_bips.add(bip)
    else:
        print(f"⚠ Advertencia: No hay Red_Aeroportuaria_*.shp en {os.path.join(MOP_MAPS_DIR, 'Red_Aeroportuaria')}")

    mop_fc = {"type": "FeatureCollection", "features": []}
    mop_region_shapes = dict(mop_regions)
    mop_sin_region = 0
    mop_borde = 0
    for (bip, kind), parts in sorted(mop_parts.items()):
        if kind == 'line':
            geom = ({"type": "LineString", "coordinates": parts[0]} if len(parts) == 1
                    else {"type": "MultiLineString", "coordinates": parts})
        elif kind == 'polygon':
            geom = ({"type": "Polygon", "coordinates": parts[0]} if len(parts) == 1
                    else {"type": "MultiPolygon", "coordinates": parts})
        else:
            geom = ({"type": "Point", "coordinates": parts[0]} if len(parts) == 1
                    else {"type": "MultiPoint", "coordinates": parts})
        mop_vertices_after += count_vertices(geom['coordinates'])
        geom_shape = shape(geom)
        codes, outside = mop_regions_of(geom_shape)
        mop_sin_region += outside
        declared = MOP_REGION_CODE_BY_NAME.get(mop_declared.get(bip))
        if declared and declared not in codes and \
                mop_region_shapes[declared].distance(geom_shape) < MOP_REGION_BORDER_TOLERANCE_DEG:
            codes = sorted(codes + [declared])
            mop_borde += 1
        props = {"bip": bip, "kind": kind, "regions": codes}
        if bip in mop_aero_bips:
            props["src"] = "aerodromo"
        mop_fc['features'].append({"type": "Feature", "geometry": geom, "properties": props})

    out_mop_js = os.path.join(OUT_DIR, 'mop_geo.js')
    with open(out_mop_js, 'w', encoding='utf-8') as f:
        f.write('window.MOP_GEO_DATA = ' + json.dumps(mop_fc, ensure_ascii=False, separators=(',', ':')) + ';')

    geo_bips = {ft['properties']['bip'] for ft in mop_fc['features']}
    print(f"OK MOP exportado: {out_mop_js} ({os.path.getsize(out_mop_js) / 1024 / 1024:.2f} MB)")
    print(f"  -> Vértices MOP: {mop_vertices_before} -> {mop_vertices_after} (simplificación {MOP_SIMPLIFY_TOLERANCE_M} m)")
    print(f"  -> Geometrías manuales por BIP (MOP_manual_bip.json): {mop_manual_count}")
    print(f"  -> Contratos MOP (Contratos_MOP, fuente principal): {mop_contratos_count} geometrías de {len(mop_contratos_bips)} proyectos del dashboard")
    print(f"  -> ArcGIS (MOP_line/point.json) para proyectos sin contratos: {len(mop_arcgis_bips)} BIP")
    print(f"  -> Aeródromos (Red_Aeroportuaria) para proyectos de Aeropuertos sin geometría: {len(mop_aero_bips)} BIP")
    print(f"  -> Proyectos de Aeropuertos sin geometría ni aeródromo reconocido ({len(mop_aero_sin)}; revisar y, si nombran "
          f"un aeródromo, agregarlo a MOP_AERODROMO_ALIAS):")
    for bip, nombre in mop_aero_sin:
        print(f"       {bip}  {nombre}")
    print(f"  -> Regiones asignadas a {len(mop_fc['features'])} geometrías ({mop_sin_region} fuera de los polígonos: islas o cercanía; "
          f"{mop_borde} suman su región declarada por estar junto al límite)")
    print(f"  -> Descartadas por caer fuera de la región declarada (solo COD_BIP de ArcGIS): {len(mop_descartadas)} {mop_descartadas[:10]}")
    print(f"  -> Proyectos (BIP) con geometría: {len(geo_bips)} ({len(geo_bips & set(mop_cod_to_bip.values()))} de los "
          f"{len(set(mop_cod_to_bip.values()))} con BIP en Base MOP); "
          f"shapes sin BIP en Base MOP: {len(mop_cods_sin_bip)} {sorted(mop_cods_sin_bip)[:20]}")
    mop_data_path = os.path.join(OUT_DIR, 'mop_data.js')
    if os.path.exists(mop_data_path):
        with open(mop_data_path, 'r', encoding='utf-8') as f:
            mop_txt = f.read()
        mop_dash_bips = {p['bip'] for p in json.loads(mop_txt[mop_txt.index('{'):mop_txt.rstrip().rstrip(';').rindex('}') + 1])['projects']}
        print(f"  -> Proyectos del dashboard (mop_data.js) con geometría: {len(mop_dash_bips & geo_bips)} de {len(mop_dash_bips)}")
except Exception as e:
    print(f"⚠ Error al exportar proyectos MOP: {e}")

# 8. Trazados livianos de la sección "Proyectos destacados" del landing
# (lee los archivos de Metro y EFE recién exportados).
print("\nExportando trazados del landing (Proyectos destacados)...")
try:
    from export_landing_routes import export_landing_routes
    export_landing_routes()
except Exception as e:
    print(f"⚠ Error al exportar los trazados del landing: {e}")

print("\nExportación geográfica completada exitosamente.")

