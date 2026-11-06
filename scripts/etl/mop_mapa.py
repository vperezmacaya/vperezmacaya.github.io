"""MOP: geometrías (manual > Contratos_MOP > ArcGIS > aeródromo) → static/data/mop_geo.js. Necesita mop_data.js.
"""
from etl.comun_geo import *  # noqa: F401,F403  rutas y simplificación de geometrías

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
    from etl.mop_arcgis import mop_id, EXCEL_PATH as MOP_EXCEL_PATH
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
    from etl.shapefile_min import read_dbf, read_shp
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
            # (mop_arcgis.py lo toma del COD_BIP de ArcGIS)
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
    raise
