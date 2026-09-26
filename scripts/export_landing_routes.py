"""
export_landing_routes.py
------------------------
Exporta los trazados livianos que dibuja la sección "Proyectos destacados" del
landing (index.html). El landing no carga metro_geo.js ni efe_geo.js (este
último pesa ~5 MB y además redefine window.METRO_GEO_DATA), así que aquí se
extraen solo los proyectos Metro y los proyectos ferroviarios EFE con trazado,
simplificados, más la red existente de ambos como contexto tenue.

Lee los archivos ya exportados en static/data/ (lo llama export_geo_data.py al
final; también se puede ejecutar solo):
  metro_geo.js, metro_data.js, efe_geo.js, efe_data.js

Genera:
  static/data/landing_routes.js -> window.LANDING_ROUTES = {
      metro:   { "<id proyecto>": { paths: [[[lon, lat], ...], ...], stations: [...] } },
      efe:     { ... },
      context: { metro: [paths], efe: [paths] }
  }

Cada proyecto trae sus tramos encadenados y orientados en un solo sentido (para
que el trazo animado avance de un extremo al otro) y sus estaciones ordenadas
según su posición a lo largo del trazado: {name, lon, lat, terminal, existing,
transfer}.
"""

import json
import math
import os
import re

from shapely.geometry import LineString, MultiLineString
from shapely.ops import linemerge

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'static', 'data')
OUT_PATH = os.path.join(DATA_DIR, 'landing_routes.js')

# Tolerancias de simplificación en metros. Los trazados se dibujan a ~700 px de
# ancho: un proyecto de 25 km da ~35 m por píxel, así que 15 m no se nota. El
# contexto (red existente, gris tenue) admite más.
ROUTE_TOL_M = 15
CONTEXT_METRO_TOL_M = 30
CONTEXT_EFE_TOL_M = 80

# Dos tramos son el mismo (vía doble dibujada dos veces, o ida y vuelta) si sus
# extremos coinciden a menos de esta distancia.
DUPLICATE_ENDPOINT_M = 120
# Extremos de tramos distintos a menos de esto se consideran el mismo nodo
# (las capas traen cortes de 3 a 160 m entre tramos consecutivos).
SNAP_ENDPOINT_M = 170
# Tras fusionar, un tramo extra más corto que esto es un ramal mínimo (desvío,
# cola de maniobra) que no aporta al dibujo.
MIN_SPUR_M = 300
# Estación nueva de Metro que queda a menos de esto de una existente = combinación.
TRANSFER_RADIUS_M = 250
# Estación existente ligada al proyecto (combinación) que se agrega a sus pines
# si queda a menos de esto del trazado.
EXISTING_ON_ROUTE_M = 400

# Tipos EFE que son servicios o tramos nuevos (el resto son sistemas,
# logística o reposición sin un trazado propio que valga la pena dibujar).
EFE_ROUTE_TYPES = ('expansión', 'expansion', 'ampliación', 'ampliacion', 'mejoramiento')


def load_js_globals(path):
    """Lee un archivo 'window.X = {...};' y devuelve {X: objeto}."""
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    decoder = json.JSONDecoder()
    out = {}
    for m in re.finditer(r'window\.(\w+)\s*=\s*', text):
        obj, _ = decoder.raw_decode(text[m.end():])
        out[m.group(1)] = obj
    return out


def dist_m(a, b):
    kx = 111320 * math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * 110540)


def line_length_m(coords):
    return sum(dist_m(coords[i], coords[i + 1]) for i in range(len(coords) - 1))


def geometry_lines(geom):
    if not geom:
        return []
    if geom['type'] == 'LineString':
        return [geom['coordinates']]
    if geom['type'] == 'MultiLineString':
        return list(geom['coordinates'])
    return []


def simplify_line(coords, tol_m):
    coords = [(float(c[0]), float(c[1])) for c in coords]
    if len(coords) < 2:
        return []
    lat0 = sum(c[1] for c in coords) / len(coords)
    kx = 111320 * math.cos(math.radians(lat0))
    ky = 110540
    simple = LineString([(x * kx, y * ky) for x, y in coords]).simplify(tol_m, preserve_topology=False)
    out = []
    for x, y in simple.coords:
        p = [round(x / kx, 5), round(y / ky, 5)]
        if not out or p != out[-1]:
            out.append(p)
    return out if len(out) >= 2 else []


def dedupe_lines(lines):
    """Quita tramos repetidos: mismos extremos (en cualquier sentido) y largo
    parecido. Deja el que tiene más vértices."""
    kept = []
    for ln in sorted(lines, key=len, reverse=True):
        a, b = ln[0], ln[-1]
        length = line_length_m(ln)
        dup = False
        for k in kept:
            same = (dist_m(a, k[0]) < DUPLICATE_ENDPOINT_M and dist_m(b, k[-1]) < DUPLICATE_ENDPOINT_M) or \
                   (dist_m(a, k[-1]) < DUPLICATE_ENDPOINT_M and dist_m(b, k[0]) < DUPLICATE_ENDPOINT_M)
            if same and abs(line_length_m(k) - length) <= 0.2 * max(length, 1):
                dup = True
                break
        if not dup:
            kept.append(ln)
    return kept


def merge_lines(lines):
    """Une los tramos consecutivos: primero lleva al mismo punto los extremos que
    están a menos de SNAP_ENDPOINT_M y luego los fusiona con linemerge, que
    corta solo en las bifurcaciones."""
    reps = []

    def snap(p):
        for r in reps:
            if dist_m(p, r) < SNAP_ENDPOINT_M:
                return r
        reps.append(p)
        return p

    snapped = [[snap(ln[0])] + ln[1:-1] + [snap(ln[-1])] for ln in lines]
    merged = linemerge(MultiLineString([[tuple(c) for c in ln] for ln in snapped]))
    parts = merged.geoms if merged.geom_type == 'MultiLineString' else [merged]
    return [[[round(x, 5), round(y, 5)] for x, y in g.coords] for g in parts if len(g.coords) >= 2]


def chain_lines(lines, start_hint=None):
    """Ordena y orienta los tramos para recorrerlos de un extremo al otro.
    Parte de un extremo libre de la red (que no toca otro tramo): el más cercano
    a start_hint (la primera estación del proyecto) o, sin pista, el más
    alejado del centro; luego agrega siempre el tramo con un extremo más
    cercano al final de la cadena. Descarta los ramales mínimos sueltos."""
    remaining = [list(ln) for ln in lines]
    if not remaining:
        return []
    endpoints = [(i, end) for i, ln in enumerate(remaining) for end in (0, -1)]

    def is_free(ie):
        p = remaining[ie[0]][ie[1]]
        return not any(dist_m(p, remaining[j][e]) < SNAP_ENDPOINT_M for j, e in endpoints if j != ie[0])

    candidates = [ie for ie in endpoints if is_free(ie)] or endpoints
    if start_hint:
        i0, e0 = min(candidates, key=lambda ie: dist_m(remaining[ie[0]][ie[1]], start_hint))
    else:
        pts = [remaining[i][e] for i, e in endpoints]
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        i0, e0 = max(candidates, key=lambda ie: dist_m(remaining[ie[0]][ie[1]], (cx, cy)))

    first = remaining.pop(i0)
    chain = [first if e0 == 0 else first[::-1]]
    while remaining:
        # El punto de la cadena más cercano a algún tramo restante (no solo el
        # final): así un ramal parte desde donde se bifurca.
        best = min(
            ((i, rev, min(dist_m(q, ln[-1] if rev else ln[0]) for c in chain for q in (c[0], c[-1])))
             for i, ln in enumerate(remaining) for rev in (False, True)),
            key=lambda t: t[2]
        )
        ln = remaining.pop(best[0])
        ln = ln[::-1] if best[1] else ln
        if line_length_m(ln) < MIN_SPUR_M:
            continue
        chain.append(ln)
    return chain


def position_along(chain, point):
    """Distancia acumulada (m) hasta el vértice del trazado más cercano al punto."""
    best, acc = (float('inf'), 0.0), 0.0
    for ln in chain:
        for i, p in enumerate(ln):
            if i:
                acc += dist_m(ln[i - 1], p)
            d = dist_m(p, point)
            if d < best[0]:
                best = (d, acc)
    return best[1]


def dist_to_chain(chain, point):
    """Distancia (m) de un punto al trazado, medida contra sus segmentos."""
    kx = 111320 * math.cos(math.radians(point[1]))
    ky = 110540
    px, py = point[0] * kx, point[1] * ky
    best = float('inf')
    for ln in chain:
        for a, b in zip(ln, ln[1:]):
            ax, ay, bx, by = a[0] * kx, a[1] * ky, b[0] * kx, b[1] * ky
            dx, dy = bx - ax, by - ay
            seg2 = dx * dx + dy * dy
            t = 0 if seg2 == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / seg2))
            best = min(best, math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
    return best


def build_route(features, stations, tol_m, existing=None):
    """existing: estaciones en operación ligadas al proyecto (combinaciones);
    se suman si quedan sobre el trazado y no repiten una estación nueva."""
    lines = [simplify_line(c, tol_m) for ft in features for c in geometry_lines(ft.get('geometry'))]
    lines = dedupe_lines([ln for ln in lines if ln])
    if not lines:
        return None
    lines = merge_lines(lines)
    if not lines:
        return None
    hint = [stations[0]['lon'], stations[0]['lat']] if stations else None
    chain = chain_lines(lines, hint)

    for st in existing or []:
        pt = (st['lon'], st['lat'])
        if dist_to_chain(chain, pt) > EXISTING_ON_ROUTE_M:
            continue
        if any(dist_m(pt, (o['lon'], o['lat'])) < TRANSFER_RADIUS_M for o in stations):
            continue
        stations = stations + [st]

    seen = set()
    ordered = []
    for st in sorted(stations, key=lambda s: position_along(chain, (s['lon'], s['lat']))):
        if st['name'] in seen:
            continue
        seen.add(st['name'])
        ordered.append(st)
    for i, st in enumerate(ordered):
        st['terminal'] = i in (0, len(ordered) - 1)
    return {'paths': chain, 'stations': ordered}


def export_landing_routes():
    metro_geo = load_js_globals(os.path.join(DATA_DIR, 'metro_geo.js'))
    metro_data = load_js_globals(os.path.join(DATA_DIR, 'metro_data.js'))['METRO_DATA']
    efe_geo = load_js_globals(os.path.join(DATA_DIR, 'efe_geo.js'))
    efe_data = load_js_globals(os.path.join(DATA_DIR, 'efe_data.js'))['EFE_DATA']

    # ─── Metro: proyectos (METRO_GEO_DATA) y estaciones futuras ──────────────
    metro_existing_pts = [ft['geometry']['coordinates'] for ft in metro_geo['METRO_EXISTING_STATIONS']['features']]
    metro_routes = {}
    for proj in metro_data.get('data', []):
        shape_ids = {str(s) for s in proj.get('shapes') or []}
        feats = [ft for ft in metro_geo['METRO_GEO_DATA']['features']
                 if str(ft['properties'].get('shape_id', ft['properties'].get('COD'))) in shape_ids]
        stations = []
        for ft in metro_geo['METRO_FUTURO_STATIONS']['features']:
            p = ft['properties']
            if proj['id'] not in (p.get('project_ids') or []) or not p.get('name'):
                continue
            lon, lat = ft['geometry']['coordinates'][:2]
            transfer = any(dist_m((lon, lat), q) < TRANSFER_RADIUS_M for q in metro_existing_pts)
            stations.append({
                'name': p['name'],
                'lon': round(lon, 5),
                'lat': round(lat, 5),
                'existing': False,
                'transfer': bool(transfer or p.get('combinacion') or p.get('future_combination')),
            })
        # Las estaciones quedan en el orden de la fuente (FUT-01, FUT-02, ...):
        # la primera orienta el trazado. Se suman las estaciones existentes con
        # las que combina (ligadas al proyecto o que anuncian la línea).
        line_name = re.sub(r'\s*\(.*\)', '', str(proj.get('line') or '')).strip()
        existing = []
        for ft in metro_geo['METRO_EXISTING_STATIONS']['features']:
            p = ft['properties']
            tied = proj['id'] in (p.get('project_ids') or []) or \
                (line_name and line_name in str(p.get('future_combination') or ''))
            if not tied or not p.get('name'):
                continue
            lon, lat = ft['geometry']['coordinates'][:2]
            existing.append({'name': p['name'], 'lon': round(lon, 5), 'lat': round(lat, 5),
                             'existing': True, 'transfer': True})
        route = build_route(feats, stations, ROUTE_TOL_M, existing)
        if route:
            metro_routes[proj['id']] = route

    # ─── EFE: proyectos con trazado de líneas y sus estaciones ───────────────
    efe_by_shape = {}
    for ft in efe_geo['EFE_GEO_DATA']['features']:
        efe_by_shape.setdefault(ft['properties'].get('id'), []).append(ft)
    efe_stations = efe_geo['EFE_ESTACIONES_DATA']['features']
    # Orden de la fuente: el de EFE_DATA.stations (recorre cada servicio en orden).
    source_order = {s.get('name'): i for i, s in enumerate(efe_data.get('stations', []))}

    efe_routes = {}
    for proj in efe_data.get('data', []):
        ptype = str(proj.get('type') or '').strip().lower()
        if not ptype.startswith(EFE_ROUTE_TYPES):
            continue
        feats = [ft for sid in proj.get('shapes') or [] for ft in efe_by_shape.get(sid, [])]
        stations = []
        for ft in efe_stations:
            p = ft['properties']
            if proj['id'] not in (p.get('project_ids') or []) or not p.get('name'):
                continue
            lon, lat = ft['geometry']['coordinates'][:2]
            stations.append({
                'name': p['name'],
                'lon': round(lon, 5),
                'lat': round(lat, 5),
                'existing': p.get('in_operation') == 'Si',
                'transfer': False,
            })
        stations.sort(key=lambda s: source_order.get(s['name'], 10 ** 6))
        route = build_route(feats, stations, ROUTE_TOL_M)
        if route:
            efe_routes[proj['id']] = route

    # ─── Contexto: redes existentes ─────────────────────────────────────────
    ctx_metro = [ln for ft in metro_geo['METRO_EXISTING_LINES']['features']
                 for c in geometry_lines(ft.get('geometry'))
                 for ln in [simplify_line(c, CONTEXT_METRO_TOL_M)] if ln]
    efe_line_shapes = {sid for line in efe_data.get('lines', []) for sid in line.get('shapes') or []}
    ctx_efe = [ln for sid in sorted(efe_line_shapes) for ft in efe_by_shape.get(sid, [])
               for c in geometry_lines(ft.get('geometry'))
               for ln in [simplify_line(c, CONTEXT_EFE_TOL_M)] if ln]

    payload = {
        'metro': metro_routes,
        'efe': efe_routes,
        'context': {'metro': ctx_metro, 'efe': ctx_efe},
    }
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        f.write('window.LANDING_ROUTES = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';')

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"OK Trazados del landing exportados: {OUT_PATH} ({size_kb:.1f} KB)")
    for group, routes in (('Metro', metro_routes), ('EFE', efe_routes)):
        for pid, r in routes.items():
            n_pts = sum(len(p) for p in r['paths'])
            print(f"  -> {group} {pid}: {len(r['paths'])} tramos, {n_pts} vértices, {len(r['stations'])} estaciones")


if __name__ == '__main__':
    export_landing_routes()
