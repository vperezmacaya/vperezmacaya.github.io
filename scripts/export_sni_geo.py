"""
export_sni_geo.py
-----------------
Genera una versión ultra-simplificada y optimizada de las regiones de Chile
exclusivamente para el mapa coroplético de SNI (SNI.html).

Optimizaciones aplicadas:
1. Exclusión de islas oceánicas lejanas (Rapa Nui y Juan Fernández) pertenecientes
   a Valparaíso para un encuadre continental perfecto y sin distorsiones.
2. Filtrado de más de 10.000 islotes, rocas y canales menores (área < 0.02 grados²).
3. Simplificación topológica de geometrías (tolerancia 0.03 grados) con Shapely.
4. Redondeo de coordenadas a 4 decimales (~11m de precisión).
5. Orientación de anillos segura para D3.js (exterior horario en plano lon/lat).

Salida:
  static/data/sni_regions_data.js -> window.SNI_REGIONS_DATA
"""

import os
import json
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import orient

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_GEOJSON = os.path.join(BASE_DIR, 'Mapas vectoriales', 'JSONS', 'Regional_simplified.json')
OUT_FILE = os.path.join(BASE_DIR, 'static', 'data', 'sni_regions_data.js')

MIN_AREA = 0.02       # Área mínima en grados² (~20 km²) para conservar islas
SIMP_TOLERANCE = 0.03 # Tolerancia Douglas-Peucker en grados
COORD_PRECISION = 4   # Decimales de lat/lon

def round_coords(coords, precision=COORD_PRECISION):
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], precision), round(coords[1], precision)]
    return [round_coords(c, precision) for c in coords]

def close_and_rewind_ring(ring, want_clockwise=True):
    if len(ring) < 3:
        return ring
    # Asegurar cierre exacto del anillo
    if ring[0] != ring[-1]:
        ring = list(ring) + [ring[0]]
    
    # Calcular área con fórmula shoelace
    area_sum = 0
    for i in range(len(ring) - 1):
        p1, p2 = ring[i], ring[i + 1]
        area_sum += (p2[0] - p1[0]) * (p2[1] + p1[1])
    
    is_clockwise = area_sum > 0
    if is_clockwise != want_clockwise:
        ring = list(reversed(ring))
    return ring

def rewind_polygon(coords):
    # Anillo exterior = horario (want_clockwise=True); agujeros interiores = antihorario (False)
    out = []
    for i, ring in enumerate(coords):
        out.append(close_and_rewind_ring(ring, want_clockwise=(i == 0)))
    return out

def rewind_geometry(geom_dict):
    g_type = geom_dict['type']
    coords = geom_dict['coordinates']
    if g_type == 'Polygon':
        return {'type': 'Polygon', 'coordinates': round_coords(rewind_polygon(coords))}
    elif g_type == 'MultiPolygon':
        return {'type': 'MultiPolygon', 'coordinates': round_coords([rewind_polygon(p) for p in coords])}
    return geom_dict

def process_sni_regions():
    if not os.path.exists(SRC_GEOJSON):
        raise FileNotFoundError(f"No se encontró el archivo fuente: {SRC_GEOJSON}")

    with open(SRC_GEOJSON, 'r', encoding='utf-8') as f:
        data = json.load(f)

    out_features = []
    total_vertices = 0
    total_polys = 0

    for ft in data.get('features', []):
        props = ft.get('properties', {})
        name = props.get('nom_reg') or props.get('Region') or ''
        
        # Omitir zonas no válidas
        if 'sin demarcar' in name.lower():
            continue

        raw_geom = shape(ft['geometry'])
        geoms = list(raw_geom.geoms) if raw_geom.geom_type == 'MultiPolygon' else [raw_geom]

        # 1. Filtrar islas oceánicas (lon < -76.0) e islotes diminutos (area < MIN_AREA)
        kept = []
        for p in geoms:
            if not p.is_valid:
                p = p.buffer(0)
            # Excluir Rapa Nui (-109) y Juan Fernández (-80)
            if p.bounds[0] < -76.0:
                continue
            # Excluir islotes menores
            if p.area < MIN_AREA:
                continue
            kept.append(p)

        # Si todo fue filtrado (caso borde), conservar el polígono continental mayor
        if not kept:
            continental = [p for p in geoms if p.bounds[0] >= -76.0]
            kept = [max(continental or geoms, key=lambda p: p.area)]

        # 2. Simplificar geometrías preservando topología
        simplified_parts = []
        for p in kept:
            s = p.simplify(SIMP_TOLERANCE, preserve_topology=True)
            if not s.is_empty and s.is_valid:
                if s.geom_type == 'Polygon':
                    simplified_parts.append(s)
                elif s.geom_type == 'MultiPolygon':
                    simplified_parts.extend(list(s.geoms))

        if not simplified_parts:
            continue

        if len(simplified_parts) == 1:
            final_geom = simplified_parts[0]
        else:
            final_geom = MultiPolygon(simplified_parts)

        # Contar métricas
        def count_geom_pts(g):
            if g.geom_type == 'Polygon':
                return len(g.exterior.coords) + sum(len(r.coords) for r in g.interiors)
            elif g.geom_type == 'MultiPolygon':
                return sum(count_geom_pts(sub) for sub in g.geoms)
            return 0

        pts = count_geom_pts(final_geom)
        total_vertices += pts
        total_polys += 1 if final_geom.geom_type == 'Polygon' else len(final_geom.geoms)

        # 3. Orientar y redondear
        rewound = rewind_geometry(mapping(final_geom))

        out_features.append({
            'type': 'Feature',
            'properties': props,
            'geometry': rewound
        })
        print(f"  {name}: {pts} vértices (partes: {1 if final_geom.geom_type == 'Polygon' else len(final_geom.geoms)})")

    out_fc = {
        'type': 'FeatureCollection',
        'features': out_features
    }

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        f.write('window.SNI_REGIONS_DATA = ' + json.dumps(out_fc, ensure_ascii=False, separators=(',', ':')) + ';\n')

    size_kb = os.path.getsize(OUT_FILE) / 1024
    print("\n" + "="*50)
    print(f"Exportación SNI exitosa:")
    print(f"  Archivo generado : {OUT_FILE}")
    print(f"  Tamaño           : {size_kb:.1f} KB")
    print(f"  Regiones         : {len(out_features)}")
    print(f"  Total polígonos  : {total_polys} partes")
    print(f"  Total vértices   : {total_vertices}")
    print("="*50)

if __name__ == '__main__':
    process_sni_regions()
