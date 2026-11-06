"""DGC: Mapas vectoriales/DGC → static/data/dgc_data.js.
"""
from etl.comun_geo import *  # noqa: F401,F403  rutas y simplificación de geometrías

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
