"""
Descarga los trazados (líneas) y ubicaciones (puntos) de los proyectos MOP desde
el servicio ArcGIS que dibuja el mapa de cada ficha de proyectos.mop.gob.cl, y
los guarda como GeoJSON en:

  Mapas vectoriales/MOP/MOP_line.json
  Mapas vectoriales/MOP/MOP_point.json

Se descargan los proyectos de la hoja 'Base MOP' y, además, los de los códigos
BIP del dashboard (static/data/mop_data.js) que no están en ella: la capa de
puntos de ArcGIS trae el BIP de cada proyecto (COD_BIP; la de líneas no), y con
su CODPROYECTO se piden también sus líneas.

Cada shape lleva en la propiedad COD el ID del proyecto MOP (CODPROYECTO; en Base
MOP, la columna CODIGO PROYECTO MOP) y en BIP su código BIP (de Base MOP o, si no
está ahí, de COD_BIP). export_geo_data.py cruza por BIP con el dashboard.
Al volver a correr solo se reemplazan los shapes con FUENTE = "ArcGIS MOP";
los dibujados a mano (otra FUENTE o sin ella) se conservan.

Uso:  python scripts/download_mop_geo.py
"""
import os
import json
from datetime import datetime, timezone

import pandas as pd

from scrape_mop_proyectos import (EXCEL_PATH, ARCGIS_URL, ARCGIS_FILTER, session,
                                  _clean, mop_id)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOP_MAPS_DIR = os.path.join(BASE_DIR, 'Mapas vectoriales', 'MOP')
MOP_DATA_JS = os.path.join(BASE_DIR, 'static', 'data', 'mop_data.js')
LAYERS = {
    'line': (0, os.path.join(MOP_MAPS_DIR, 'MOP_line.json')),
    'point': (1, os.path.join(MOP_MAPS_DIR, 'MOP_point.json')),
}
ARCGIS_SOURCE = 'ArcGIS MOP'
CODES_PER_QUERY = 100
IDS_PER_QUERY = 100


def _query(layer, params):
    r = session.get(ARCGIS_URL.format(layer=layer), params={**params, 'f': 'json'}, timeout=180)
    r.raise_for_status()
    data = r.json()
    if 'error' in data:
        raise RuntimeError(data['error'])
    return data


def _round(coords):
    return [[round(x, 6), round(y, 6)] for x, y, *_ in coords]


def esri_to_geojson(geom):
    """paths → LineString/MultiLineString; points → Point/MultiPoint."""
    if not geom:
        return None
    if geom.get('paths'):
        paths = [_round(p) for p in geom['paths'] if len(p) >= 2]
        if not paths:
            return None
        return ({'type': 'LineString', 'coordinates': paths[0]} if len(paths) == 1
                else {'type': 'MultiLineString', 'coordinates': paths})
    pts = geom.get('points') or ([[geom['x'], geom['y']]] if 'x' in geom else [])
    if not pts:
        return None
    pts = _round(pts)
    return ({'type': 'Point', 'coordinates': pts[0]} if len(pts) == 1
            else {'type': 'MultiPoint', 'coordinates': pts})


def dashboard_projects():
    """BIP → nombre de los proyectos del dashboard (vacío si aún no hay mop_data.js)."""
    if not os.path.exists(MOP_DATA_JS):
        return {}
    text = open(MOP_DATA_JS, encoding='utf-8').read()
    data = json.loads(text[text.index('{'):text.rstrip().rstrip(';').rindex('}') + 1])
    return {p['bip']: p.get('nombre', '') for p in data.get('projects', [])}


def arcgis_cod_to_bip():
    """CODPROYECTO → COD_BIP de la capa de puntos (la única que trae el BIP)."""
    layer = LAYERS['point'][0]
    ids = _query(layer, {'where': ARCGIS_FILTER, 'returnIdsOnly': 'true'}).get('objectIds') or []
    out = {}
    for i in range(0, len(ids), IDS_PER_QUERY):
        data = _query(layer, {
            'objectIds': ','.join(map(str, ids[i:i + IDS_PER_QUERY])),
            'outFields': 'CODPROYECTO,COD_BIP', 'returnGeometry': 'false',
        })
        for f in data.get('features', []):
            a = f['attributes']
            bip = (a.get('COD_BIP') or '').strip()
            if bip:
                out.setdefault(mop_id(a.get('CODPROYECTO')), bip)
    return out


def download_layer(layer, cods, names, bips):
    numeric = sorted({int(c) for c in cods if c.isdigit()})
    object_ids = []
    for i in range(0, len(numeric), CODES_PER_QUERY):
        chunk = numeric[i:i + CODES_PER_QUERY]
        data = _query(layer, {
            'where': f"{ARCGIS_FILTER} AND CODPROYECTO IN ({','.join(map(str, chunk))})",
            'returnIdsOnly': 'true',
        })
        object_ids += data.get('objectIds') or []

    features = []
    for i in range(0, len(object_ids), IDS_PER_QUERY):
        data = _query(layer, {
            'objectIds': ','.join(map(str, object_ids[i:i + IDS_PER_QUERY])),
            'outFields': 'OBJECTID,ID_IDE,CODPROYECTO,FECHA_ACTUALIZACION',
            'returnGeometry': 'true', 'outSR': 4326,
        })
        for f in data.get('features', []):
            geom = esri_to_geojson(f.get('geometry'))
            if not geom:
                continue
            a = f['attributes']
            cod = mop_id(a.get('CODPROYECTO'))
            fecha = a.get('FECHA_ACTUALIZACION')
            features.append({
                'type': 'Feature',
                'geometry': geom,
                'properties': {
                    'COD': cod,
                    'BIP': bips.get(cod, ''),
                    'NOMBRE': names.get(cod, ''),
                    'FUENTE': ARCGIS_SOURCE,
                    'ID_IDE': _clean(a.get('ID_IDE')),
                    'FECHA_ACTUALIZACION': (datetime.fromtimestamp(fecha / 1000, tz=timezone.utc).date().isoformat()
                                            if fecha else ''),
                },
            })
    features.sort(key=lambda f: (f['properties']['COD'], f['properties']['ID_IDE']))
    return features


def load_manual(path):
    """Shapes que no vienen de ArcGIS (dibujados a mano): se conservan."""
    if not os.path.exists(path):
        return []
    with open(path, encoding='utf-8') as f:
        fc = json.load(f)
    return [ft for ft in fc.get('features', [])
            if (ft.get('properties') or {}).get('FUENTE') != ARCGIS_SOURCE]


def main():
    os.makedirs(MOP_MAPS_DIR, exist_ok=True)
    df = pd.read_excel(EXCEL_PATH, sheet_name='Base MOP')
    base_cods = [mop_id(v) for v in df['CODIGO PROYECTO MOP']]
    names = dict(zip(base_cods, df['NOMBRE'].fillna('').astype(str)))
    bips = {c: str(b).strip() for c, b in zip(base_cods, df['CODIGO BIP']) if pd.notna(b) and str(b).strip()}
    print(f"-> {len(base_cods)} proyectos en Base MOP")

    # Proyectos del dashboard que no están en Base MOP: su CODPROYECTO sale del COD_BIP de ArcGIS
    dashboard = dashboard_projects()
    # (también otros CODPROYECTO de un BIP que sí está en Base MOP: el ETL junta las geometrías por BIP)
    extra = {cod: bip for cod, bip in arcgis_cod_to_bip().items() if bip in dashboard and cod not in bips}
    for cod, bip in extra.items():
        bips[cod] = bip
        names[cod] = dashboard[bip]
    cods = base_cods + sorted(extra)
    print(f"-> {len(extra)} proyectos más del dashboard (mop_data.js) por el COD_BIP de ArcGIS")

    with_geo = {}
    for kind, (layer, path) in LAYERS.items():
        manual = load_manual(path)
        arcgis = download_layer(layer, cods, names, bips)
        fc = {'type': 'FeatureCollection', 'features': arcgis + manual}
        with open(path, 'w', encoding='utf-8') as f:
            f.write('{"type":"FeatureCollection", "features": [\n')
            f.write(',\n'.join(json.dumps(ft, ensure_ascii=False, separators=(',', ':')) for ft in fc['features']))
            f.write('\n]}\n')
        layer_cods = {mop_id((ft.get('properties') or {}).get('COD')) for ft in fc['features']}
        with_geo[kind] = layer_cods
        size_mb = os.path.getsize(path) / 1024 / 1024
        print(f"OK {os.path.relpath(path, BASE_DIR)}: {len(arcgis)} shapes de ArcGIS + {len(manual)} manuales, "
              f"{len(layer_cods)} proyectos ({size_mb:.1f} MB)")

    known = set(cods)
    all_geo = with_geo['line'] | with_geo['point']
    print(f"Proyectos con geometría: {len(all_geo & known)} (línea {len(with_geo['line'] & known)}, "
          f"punto {len(with_geo['point'] & known)}); sin geometría: {len(known - all_geo)}")
    orphan = sorted(all_geo - known)
    print(f"Shapes con COD sin fila en Base MOP ni BIP del dashboard: {len(orphan)} {orphan[:20]}")


if __name__ == '__main__':
    main()
