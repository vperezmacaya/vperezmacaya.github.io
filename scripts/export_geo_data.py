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
                efe_feat_dict = {}
                for ft in features:
                    geom = ft.get('geometry')
                    if not geom or not geom.get('coordinates'):
                        continue  # skip features with null/empty geometry
                    ft['geometry']['coordinates'] = round_coords(ft['geometry']['coordinates'])

                    props = ft.get('properties') or {}
                    fid = props.get('id')
                    fcod = props.get('COD')
                    key = (str(fid), str(fcod)) if (fid is not None or fcod is not None) else None

                    if key and key in efe_feat_dict:
                        existing = efe_feat_dict[key]
                        ex_props = existing.get('properties') or {}
                        ex_linea = ex_props.get('linea') or ex_props.get('line') or ex_props.get('LINE') or ex_props.get('LINEA')
                        cur_linea = props.get('linea') or props.get('line') or props.get('LINE') or props.get('LINEA')
                        if not ex_linea and cur_linea:
                            efe_feat_dict[key] = ft
                    elif key:
                        efe_feat_dict[key] = ft
                    else:
                        efe_fc['features'].append(ft)

                for ft in efe_feat_dict.values():
                    efe_fc['features'].append(ft)
        except Exception as e:
            print(f"⚠ Error al leer {fname}: {e}")
    else:
        print(f"⚠ Advertencia: No existe {fpath}")

out_efe_js = os.path.join(OUT_DIR, 'efe_geo.js')
with open(out_efe_js, 'w', encoding='utf-8') as f:
    f.write('window.EFE_GEO_DATA = ' + json.dumps(efe_fc, ensure_ascii=False, separators=(',', ':')) + ';')

size_efe_mb = os.path.getsize(out_efe_js) / 1024 / 1024
print(f"OK EFE geo exportado: {out_efe_js} ({size_efe_mb:.2f} MB)")
print(f"Total features EFE: {len(efe_fc['features'])}")


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

print("\nExportación geográfica completada exitosamente.")

