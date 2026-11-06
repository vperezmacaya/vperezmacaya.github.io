"""Rutas y utilidades de geometría (redondeo y simplificación) que comparten los pasos de mapas.
"""

import os
import json
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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


# Todo lo de este archivo (también lo que empieza con _) queda disponible con `import *`.
__all__ = [n for n in dir() if not n.startswith('__')]
