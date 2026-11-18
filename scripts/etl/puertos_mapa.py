"""Puertos: instalaciones portuarias del Biobío → static/data/puertos_geo.js.

Lee Mapas vectoriales/Puertos/puertos_biobio.geojson (dato fijo: lista de la tabla 8.1 del
Boletín Estadístico Marítimo 2025 de DIRECTEMAR y coordenadas de la resolución de habilitación
de cada instalación) y lo escribe como window.PUERTOS_GEO_DATA para el mapa de "Resumen de Carga"
de puertos.html. Solo copia los campos que usa el mapa.

Si existe Mapas vectoriales/Puertos/puertos_biobio_poligonos.json (dato fijo: polígono de cada
instalación, con el mismo id), une los de un mismo operador en uno solo (ej. los tres muelles de
Portuaria Cabo Froward) y los agrega en PUERTOS_GEO_DATA.poligonos, cada uno con la lista de sus
instalaciones.
"""
import re
import unicodedata

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

from etl.comun_geo import *  # noqa: F401,F403  rutas

PUERTOS_GEOJSON = os.path.join(MAPS_DIR, 'Puertos', 'puertos_biobio.geojson')
PUERTOS_POLIGONOS_GEOJSON = os.path.join(MAPS_DIR, 'Puertos', 'puertos_biobio_poligonos.json')
# Instalaciones que van sin polígono a propósito (no avisa): Escuadrón es un terminal multiboyas,
# sin muelle ni otra estructura que dibujar (la nave fondea en el mar y descarga por cañerías submarinas)
PUERTOS_SIN_POLIGONO = {'escuadron'}
PUERTOS_CAMPOS = (
    'id', 'nombre', 'operador', 'regimen', 'capitania_puerto', 'comuna', 'carga',
    'resolucion', 'fecha_resolucion', 'url_resolucion', 'fuente_coordenadas', 'observacion',
    'ine_zona_portuaria', 'ine_informante_2011', 'zona_portuaria',
)
# Valores de 'regimen' que entiende la vista (static/js/Puertos/mapa.js)
PUERTOS_REGIMENES = {
    'Empresa portuaria estatal (Ley 19.542), concesionado',
    'Empresa del Estado (no portuaria)',
    'Privado',
}



def _puertos_slug(texto):
    """Id del polígono de un operador: 'Portuaria Cabo Froward S.A.' -> 'op_portuaria_cabo_froward_s_a'."""
    s = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode().lower()
    return 'op_' + re.sub(r'[^a-z0-9]+', '_', s).strip('_')


try:
    with open(PUERTOS_GEOJSON, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    features = []
    for ft in raw.get('features', []):
        props = ft.get('properties') or {}
        geom = ft.get('geometry') or {}
        if geom.get('type') != 'Point':
            print(f"⚠ Instalación {props.get('id')}: geometría {geom.get('type')}, se omite (la vista usa puntos)")
            continue
        if props.get('regimen') not in PUERTOS_REGIMENES:
            print(f"⚠ Instalación {props.get('id')}: régimen desconocido '{props.get('regimen')}'")
        if not props.get('zona_portuaria'):
            print(f"⚠ Instalación {props.get('id')}: sin zona_portuaria (el mapa la deja fuera de los íconos de zona)")
        lon, lat = geom['coordinates'][:2]
        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [round(lon, 6), round(lat, 6)]},
            'properties': {k: props.get(k) for k in PUERTOS_CAMPOS},
        })

    poligonos = []
    if os.path.exists(PUERTOS_POLIGONOS_GEOJSON):
        insts = {ft['properties']['id']: ft['properties'] for ft in features}
        with open(PUERTOS_POLIGONOS_GEOJSON, 'r', encoding='utf-8') as f:
            raw_pol = json.load(f)
        # Polígonos por operador, en el orden de las instalaciones
        por_operador = {}
        for ft in raw_pol.get('features', []):
            props = ft.get('properties') or {}
            geom = ft.get('geometry') or {}
            pid = props.get('id')
            if pid not in insts:
                print(f"⚠ Polígono {pid}: no corresponde a ninguna instalación, se omite")
                continue
            if geom.get('type') not in ('Polygon', 'MultiPolygon'):
                print(f"⚠ Polígono {pid}: geometría {geom.get('type')}, se omite")
                continue
            por_operador.setdefault(insts[pid]['operador'], []).append((pid, props, shape(geom)))
        orden = list(insts)
        for operador, partes in por_operador.items():
            partes.sort(key=lambda x: orden.index(x[0]))
            ids = [pid for pid, _, _ in partes]
            if len(partes) == 1:
                pid, props, geom = partes[0]
                poly_id, tipo, metodo, fuente = pid, props.get('tipo'), props.get('metodo'), props.get('fuente')
            else:
                geom = unary_union([g for _, _, g in partes])
                if geom.geom_type != 'Polygon':
                    print(f"[AVISO] Polígono de {operador}: sus {len(partes)} instalaciones no se tocan, queda en {len(geom.geoms)} partes")
                poly_id = _puertos_slug(operador)
                tipos = {p.get('tipo') for _, p, _ in partes}
                metodos = {p.get('metodo') for _, p, _ in partes}
                tipo = tipos.pop() if len(tipos) == 1 else 'terminal'
                metodo = metodos.pop() if len(metodos) == 1 else 'oficial y dibujado'
                nombres = ', '.join(insts[i]['nombre'] for i in ids)
                fuente = (f"Unión de los polígonos de las {len(ids)} instalaciones de {operador} ({nombres}), "
                          'dibujados sobre imagen satelital Esri World Imagery (noviembre 2026); aproximado.')
            gj = mapping(geom)
            poligonos.append({
                'type': 'Feature',
                'geometry': {'type': gj['type'], 'coordinates': round_coords(json.loads(json.dumps(gj['coordinates'])), 6)},
                'properties': {'id': poly_id, 'instalaciones': ids, 'operador': operador,
                               'tipo': tipo, 'metodo': metodo, 'fuente': fuente},
            })
        con_poligono = {i for p in poligonos for i in p['properties']['instalaciones']}
        sin_poligono = set(insts) - con_poligono - PUERTOS_SIN_POLIGONO
        if sin_poligono:
            print(f"[AVISO] Instalaciones sin polígono: {', '.join(sorted(sin_poligono))}")
    else:
        print(f"[AVISO] No existe {PUERTOS_POLIGONOS_GEOJSON}: el mapa queda sin polígonos")

    out = {
        'type': 'FeatureCollection',
        'metadata': raw.get('metadata', {}),
        'features': features,
        'poligonos': {'type': 'FeatureCollection', 'features': poligonos},
    }
    out_js = os.path.join(OUT_DIR, 'puertos_geo.js')
    with open(out_js, 'w', encoding='utf-8') as f:
        f.write('window.PUERTOS_GEO_DATA = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';')
    print(f"OK Puertos mapa: {len(features)} instalaciones y {len(poligonos)} polígonos (por operador) -> {out_js} "
          f"({os.path.getsize(out_js) / 1024:.1f} KB)")
except Exception as e:
    print(f"ERROR al exportar las instalaciones portuarias ({PUERTOS_GEOJSON}): {e}")
    raise
