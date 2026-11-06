"""EFE: Mapas vectoriales/EFE (+ hoja 'Estaciones' de EFE.xlsx) → static/data/efe_geo.js.
"""
from etl.comun_geo import *  # noqa: F401,F403  rutas y simplificación de geometrías

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
                for ft in features:
                    geom = ft.get('geometry')
                    if not geom or not geom.get('coordinates'):
                        continue  # skip features with null/empty geometry
                    efe_fc['features'].append(ft)
        except Exception as e:
            print(f"⚠ Error al leer {fname}: {e}")
# Cargar EFE_estaciones.json (Estaciones de EFE con servicio activo de pasajeros enriquecidas desde Excel)
efe_estaciones_fc = {"type": "FeatureCollection", "features": []}
efe_est_path = os.path.join(EFE_DIR, 'EFE_estaciones.json')
efe_excel_path = os.path.join(BASE_DIR, 'Bases de dato', 'EFE', 'EFE.xlsx')

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
