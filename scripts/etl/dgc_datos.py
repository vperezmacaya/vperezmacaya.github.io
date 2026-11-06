"""DGC: Bases de dato/DGC/DGC.xlsx (+ fotos de Fotos/DGC) → static/data/contracts_data.js.
"""
from etl.comun_datos import *  # noqa: F401,F403  rutas, fotos y utilidades

# ── Cargar Excel DGC ───────────────────────────────────────────────────────────
print(f"Leyendo Excel DGC: {DGC_EXCEL_PATH}")
df_contracts = pd.read_excel(DGC_EXCEL_PATH, sheet_name='BD')
print(f"  -> {len(df_contracts)} filas cargadas en hoja 'BD'")

# ── Cargar oferentes ───────────────────────────────────────────────────────────
BIDDERS_BY_PROJECT = {}
try:
    df_of = pd.read_excel(DGC_EXCEL_PATH, sheet_name='OF')
    col_proj = col_cod_of = col_nom_of = col_adj = col_consorcio = col_empresas = col_pct = None
    for col in df_of.columns:
        c_norm = _normalize_col(col)
        if 'codigo' in c_norm and 'proyecto' in c_norm:
            col_proj = col
        elif 'codigo' in c_norm and 'oferente' in c_norm:
            col_cod_of = col
        elif 'nombre' in c_norm and 'oferente' in c_norm:
            col_nom_of = col
        elif 'adjudicad' in c_norm:
            col_adj = col
        elif 'consorcio' in c_norm or 'grupo' in c_norm:
            col_consorcio = col
        elif c_norm == 'empresas' or 'empresa' in c_norm:
            col_empresas = col
        elif c_norm == '%' or c_norm == 'porcentaje' or c_norm == 'pct':
            col_pct = col
    if col_proj:
        for _, row in df_of.iterrows():
            p_code = str(row[col_proj]).strip() if pd.notna(row[col_proj]) else ''
            if not p_code:
                continue
            b_code = str(row[col_cod_of]).strip() if col_cod_of and pd.notna(row[col_cod_of]) else ''
            b_name = str(row[col_nom_of]).strip() if col_nom_of and pd.notna(row[col_nom_of]) else ''
            adj_val = str(row[col_adj]).strip() if col_adj and pd.notna(row[col_adj]) else ''
            is_adj = adj_val.upper() in ['SI', 'SÍ', 'YES', 'TRUE', '1']
            consorcio_val = str(row[col_consorcio]).strip() if col_consorcio and pd.notna(row[col_consorcio]) else ''
            is_consorcio = consorcio_val.upper() in ['SI', 'SÍ', 'YES', 'TRUE', '1', 'X']
            empresas_val = str(row[col_empresas]).strip() if col_empresas and pd.notna(row[col_empresas]) else ''
            pct_val = str(row[col_pct]).strip() if col_pct and pd.notna(row[col_pct]) else ''
            BIDDERS_BY_PROJECT.setdefault(p_code, []).append({
                'code': b_code, 'name': b_name,
                'adjudicado': is_adj, 'adjudicado_raw': adj_val,
                'consorcio': is_consorcio, 'consorcio_raw': consorcio_val,
                'empresas': empresas_val,
                'pct': pct_val
            })
    print(f"  -> {len(BIDDERS_BY_PROJECT)} proyectos con oferentes")
    if col_consorcio:
        print(f"  -> Columna 'Consorcio' detectada: '{col_consorcio}'")
    else:
        print(f"  AVISO: Columna 'Consorcio' NO detectada en hoja OF")
    if col_empresas:
        print(f"  -> Columna 'Empresas' detectada: '{col_empresas}'")
    if col_pct:
        print(f"  -> Columna '%' detectada: '{col_pct}'")
except Exception as e:
    print(f"  ERROR al cargar hoja 'OF': {e}")



# ── Calcular índice de búsqueda ────────────────────────────────────────────────
def _build_row_search_index(row):
    proj_code = str(row.get('Código proyecto') or '')
    bidders = BIDDERS_BY_PROJECT.get(proj_code.strip(), [])
    bidders_text = ' '.join([f"{b.get('name','')} {b.get('code','')}" for b in bidders])
    fields = [
        proj_code,
        str(row.get('Nombre de la Concesión ') or ''),
        str(row.get('Nombre de uso común') or ''),
        str(row.get('Descripción ') or ''),
        str(row.get('Nombre sociedad concesionaria') or ''),
        str(row.get('Región geográfica') or ''),
        str(row.get('Sector del proyecto') or ''),
        bidders_text
    ]
    combined = ' '.join(fields)
    norm = unicodedata.normalize('NFD', combined)
    return ''.join(c for c in norm if unicodedata.category(c) != 'Mn').lower()

df_contracts['_search_index'] = df_contracts.apply(_build_row_search_index, axis=1)

# ── Calcular grupos de concesiones ─────────────────────────────────────────────
BASE_GROUPS = {}
for idx, row in df_contracts.iterrows():
    code = str(row['Código proyecto'])
    m = re.search(r'^[A-Za-z0-9]+_(.+)(\d)$', code)
    if m:
        base_code, seq = m.group(1), int(m.group(2))
    else:
        m_simple = re.search(r'^(.+)(\d)$', code)
        if m_simple:
            base_code, seq = m_simple.group(1), int(m_simple.group(2))
        else:
            base_code, seq = code, 1
    BASE_GROUPS.setdefault(base_code, []).append({
        'code': code, 'seq': seq,
        'name': sanitize_value(row.get('Nombre de la Concesión ')) or sanitize_value(row.get('Nombre de uso común')),
        'concession_name': sanitize_value(row.get('Nombre de la Concesión ')),
        'common_name': sanitize_value(row.get('Nombre de uso común')),
        'status': sanitize_value(row['ESTADO']),
        'resolution_date': sanitize_value(row.get('Fecha resolución declaración interes público')),
        'tender_date': sanitize_value(row.get('Fecha llamado a licitación')),
        'adjudication_date': sanitize_value(row.get('Fecha decreto adjudicación')),
        'start_date': sanitize_value(row.get('Fecha inicio del contrato de concesión')),
        'end_date': sanitize_value(row.get('Fecha término de la concesión')),
        'investment': sanitize_value(row.get('Inversión Materializada estimada')),
        'progress': sanitize_value(row.get('% Avance obras físicas'))
    })

for base_code in BASE_GROUPS:
    BASE_GROUPS[base_code] = sorted(BASE_GROUPS[base_code], key=lambda x: x['seq'])

# ── Calcular filtros únicos ────────────────────────────────────────────────────
ALL_REGIONS = set()
for cell in df_contracts['Región geográfica'].dropna():
    for rn in parse_regions_from_row(cell):
        ALL_REGIONS.add(rn)
UNIQUE_REGIONS = sorted(list(ALL_REGIONS), key=region_north_south_key)
UNIQUE_SECTORS = sorted([str(s) for s in df_contracts['Sector del proyecto'].dropna().unique().tolist()])

# ── Calcular estadísticas globales ─────────────────────────────────────────────
total_inv_uf = float(df_contracts['Inversión Materializada estimada'].dropna().sum())
total_bidders = int(sum(len(BIDDERS_BY_PROJECT.get(str(row['Código proyecto'] or '').strip(), [])) for _, row in df_contracts.iterrows()))
hitos_status = {
    'operación':       int((df_contracts['ESTADO'] == 'Operación').sum()),
    'construcción':    int((df_contracts['ESTADO'] == 'Construcción').sum()),
    'comb_const_oper': int((df_contracts['ESTADO'] == 'Construcción y Operación').sum()),
    'licitación':      int((df_contracts['ESTADO'].astype(str).str.contains('Licitaci', case=False, na=False)).sum()),
    'finalizado':      int((df_contracts['ESTADO'] == 'Finalizado').sum()),
    'activos':         int(((df_contracts['ESTADO'] == 'Operación') | (df_contracts['ESTADO'] == 'Construcción y Operación')).sum())
}
sector_stats  = {str(k): int(v) for k, v in df_contracts['Sector del proyecto'].value_counts().to_dict().items()}
status_stats  = {str(k): int(v) for k, v in df_contracts['ESTADO'].value_counts().to_dict().items()}
count_total   = len(df_contracts)

# ── Fotos de referencia en Fotos/DGC (nombre de archivo = Código proyecto) ────
# Una concesión puede agrupar varias infraestructuras (ej. 125_ARNO1, dos aeropuertos):
#   <código>.jpg              → foto única, sin etiqueta
#   <código> - <etiqueta>.jpg → una foto por infraestructura; la etiqueta se muestra en la ficha
# Por cada foto se generan dos WebP: <nombre>.webp (ficha) y <nombre>_full.webp (visor),
# con <nombre> = <código> o <código>_<etiqueta-slug>. Orden: alfabético (la sin etiqueta primero).
DGC_PHOTOS_DIR = os.path.join(PHOTOS_SRC_DIR, 'DGC')
DGC_PHOTOS_OUT_DIR = os.path.join(PHOTOS_OUT_DIR, 'DGC')
DGC_PHOTOS_BY_CODE = {}
if os.path.exists(DGC_PHOTOS_DIR):
    known_codes = set(df_contracts['Código proyecto'].astype(str).str.strip().str.upper())
    photo_files = [pf for pf in os.listdir(DGC_PHOTOS_DIR) if os.path.splitext(pf)[1].lower() in PHOTO_EXTENSIONS]
    for pf in sorted(photo_files, key=lambda f: (' - ' in f, f.lower())):
        base = os.path.splitext(pf)[0]
        code, _, label = base.partition(' - ')
        code, label = code.strip(), label.strip()
        code_key = code.upper()
        if code_key not in known_codes:
            print(f"     ! {pf}: el código '{code}' no corresponde a ninguna concesión (se omite)")
            continue
        out_base = f'{code}_{_slugify(label)}' if label else code
        photos = DGC_PHOTOS_BY_CODE.setdefault(code_key, [])
        if any(os.path.basename(p['src']) == f'{out_base}.webp' for p in photos):
            print(f"     ! {pf}: repite la foto de {code}{' - ' + label if label else ''} (se omite)")
            continue
        card, full = optimize_photo(os.path.join(DGC_PHOTOS_DIR, pf), DGC_PHOTOS_OUT_DIR, [
            (f'{out_base}.webp', PHOTO_CARD_WIDTH),
            (f'{out_base}_full.webp', PHOTO_FULL_WIDTH),
        ])
        photos.append({'src': card, 'full': full, 'label': label or None})
    n_photos = sum(len(v) for v in DGC_PHOTOS_BY_CODE.values())
    print(f"  -> {n_photos} fotos de {len(DGC_PHOTOS_BY_CODE)} concesiones detectadas en Fotos/DGC")
prune_photo_dir(DGC_PHOTOS_OUT_DIR, {os.path.basename(p[k]) for v in DGC_PHOTOS_BY_CODE.values() for p in v for k in ('src', 'full')})

# ── Serializar datos de contratos ──────────────────────────────────────────────
print("Serializando contratos...")
serialized_data = []
map_projects    = []

for _, row in df_contracts.iterrows():
    row_dict  = row.to_dict()
    sanitized = {k: sanitize_value(v) for k, v in row_dict.items()}

    code = str(sanitized.get('Código proyecto', ''))
    m = re.search(r'^[A-Za-z0-9]+_(.+)(\d)$', code)
    if m:
        base_code = m.group(1)
    else:
        m_simple = re.search(r'^(.+)(\d)$', code)
        base_code = m_simple.group(1) if m_simple else code

    sanitized['group_timeline'] = BASE_GROUPS.get(base_code, [])
    sanitized['shapes']         = parse_shapes_list(get_row_shapes_val(row_dict))
    sanitized['bidders']        = BIDDERS_BY_PROJECT.get(code, [])
    sanitized['photos']         = DGC_PHOTOS_BY_CODE.get(code.strip().upper()) or []
    sanitized.pop('_search_index', None)

    serialized_data.append(sanitized)

    map_projects.append({
        'code':           code,
        'name':           sanitize_value(row.get('Nombre de uso común')) or sanitize_value(row.get('Nombre de la Concesión ')),
        'common':         sanitize_value(row.get('Nombre de uso común')),
        'region':         sanitize_value(row.get('Región geográfica')),
        'status':         sanitize_value(row.get('ESTADO')),
        'sector':         sanitize_value(row.get('Sector del proyecto')),
        'shapes':         parse_shapes_list(get_row_shapes_val(row_dict)),
        'lat_inicio':     sanitize_value(row.get('Latitud Inicio')),
        'lon_inicio':     sanitize_value(row.get('Longitud Inicio')),
        'lat_fin':        sanitize_value(row.get('Latitud Fin')),
        'lon_fin':        sanitize_value(row.get('Longitud Fin')),
        'group_timeline': BASE_GROUPS.get(base_code, [])
    })

# ── Empaquetar la respuesta completa ───────────────────────────────────────────
static_payload = {
    'data':        serialized_data,
    'regions':     UNIQUE_REGIONS,
    'sectors':     UNIQUE_SECTORS,
    'stats': {
        'sectors': sector_stats,
        'status':  status_stats
    },
    'summary': {
        'count_filtered':      count_total,
        'count_total':         count_total,
        'total_investment_uf': total_inv_uf,
        'total_bidders':       total_bidders,
        'total_infrastructures': len(BASE_GROUPS),
        'hitos':               hitos_status
    },
    'pagination': {
        'page':          1,
        'page_size':     count_total,
        'total_records': count_total,
        'total_pages':   1
    },
    'map_projects': map_projects
}

# ── Guardar como archivo JS (window.STATIC_DATA = {...}) ───────────────────────
out_js  = os.path.join(OUT_DIR, 'contracts_data.js')
json_str = json.dumps(static_payload, ensure_ascii=False, indent=None, separators=(',', ':'))
with open(out_js, 'w', encoding='utf-8') as f:
    f.write(f'window.STATIC_DATA = {json_str};')

size_mb = os.path.getsize(out_js) / 1024 / 1024
print(f"OK Generado: {out_js} ({size_mb:.2f} MB)")
print(f"   Contratos exportados: {count_total}")
