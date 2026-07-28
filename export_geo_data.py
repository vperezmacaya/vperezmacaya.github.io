"""
export_geo_data.py
-------------------
Exporta las capas GeoJSON del mapa (Regiones y DGC) como archivos JS estáticos
con coordenadas optimizadas a 5 decimales (~1m de precisión).

Genera:
  static/data/regions_data.js -> window.REGIONS_DATA
  static/data/dgc_data.js     -> window.DGC_DATA
"""

import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
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
print("\nExportación geográfica completada exitosamente.")
