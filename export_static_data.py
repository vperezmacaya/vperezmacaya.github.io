"""
export_static_data.py
---------------------
Genera el archivo JSON/JS estático necesario para la plataforma estática.

Salida:
  static/data/contracts_data.js  → window.STATIC_DATA = { data, regions, sectors, stats, summary, map_projects }

Uso:
  python export_static_data.py
"""

import os
import re
import json
import unicodedata
import numpy as np
import pandas as pd

# ── Rutas ──────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_PATH = os.path.join(BASE_DIR, 'CATLEC.xlsx')
if not os.path.exists(EXCEL_PATH):
    EXCEL_PATH = os.path.join(BASE_DIR, 'CALTEC.xlsx')

OUT_DIR = os.path.join(BASE_DIR, 'static', 'data')
os.makedirs(OUT_DIR, exist_ok=True)

# ── Helpers ────────────────────────────────────────────────────────────────────

def _normalize_col(s):
    s = str(s).lower()
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def sanitize_value(v):
    try:
        if pd.isna(v):
            return None
    except Exception:
        pass
    if hasattr(v, 'strftime'):
        return v.strftime('%Y-%m-%d')
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        if np.isnan(v) or np.isinf(v):
            return None
        return float(v)
    if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
        return None
    return v

def parse_regions_from_row(region_str):
    if pd.isna(region_str) or not isinstance(region_str, str):
        return []
    region_str = region_str.replace('&nbsp;', ' ').replace('\xa0', ' ')
    parts = re.split(r'[;,]', region_str)
    cleaned = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if p == 'Metropolitana':
            p = 'Metropolitana de Santiago'
        elif p in ('Araucanía', 'Araucanía '):
            p = 'La Araucanía'
        if p not in cleaned:
            cleaned.append(p)
    return cleaned

def parse_shapes_list(val):
    if val is None:
        return []
    try:
        if pd.isna(val):
            return []
    except Exception:
        pass
    if isinstance(val, (int, np.integer)):
        return [str(val)]
    if isinstance(val, (float, np.floating)):
        if np.isnan(val):
            return []
        if val == int(val):
            return [str(int(val))]
        val_str = str(val)
        return [p for p in val_str.split('.') if p.strip()]
    if isinstance(val, str):
        cleaned_str = val.replace(';', ',').replace('.', ',')
        return [p.strip() for p in cleaned_str.split(',') if p.strip()]
    return []

def get_row_shapes_val(row_dict):
    for k, v in row_dict.items():
        if k.strip().lower() == 'shapes':
            return v
    return None

CHILE_NORTH_TO_SOUTH_ORDER = [
    'arica y parinacota', 'tarapaca', 'antofagasta', 'atacama',
    'coquimbo', 'valparaiso', 'metropolitana', 'higgins',
    'maule', 'nuble', 'biobio', 'araucania',
    'rios', 'lagos', 'aysen', 'magallanes'
]

def region_north_south_key(region_name):
    clean = unicodedata.normalize('NFD', str(region_name)).encode('ascii', 'ignore').decode('utf-8').lower()
    for idx, key in enumerate(CHILE_NORTH_TO_SOUTH_ORDER):
        if key in clean:
            return idx
    return 999

# ── Cargar Excel ───────────────────────────────────────────────────────────────
print(f"Leyendo Excel: {EXCEL_PATH}")
df_contracts = pd.read_excel(EXCEL_PATH, sheet_name='BD')
print(f"  -> {len(df_contracts)} filas cargadas en hoja 'BD'")

# ── Cargar oferentes ───────────────────────────────────────────────────────────
BIDDERS_BY_PROJECT = {}
try:
    df_of = pd.read_excel(EXCEL_PATH, sheet_name='OF')
    col_proj = col_cod_of = col_nom_of = col_adj = None
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
    if col_proj:
        for _, row in df_of.iterrows():
            p_code = str(row[col_proj]).strip() if pd.notna(row[col_proj]) else ''
            if not p_code:
                continue
            b_code = str(row[col_cod_of]).strip() if col_cod_of and pd.notna(row[col_cod_of]) else ''
            b_name = str(row[col_nom_of]).strip() if col_nom_of and pd.notna(row[col_nom_of]) else ''
            adj_val = str(row[col_adj]).strip() if col_adj and pd.notna(row[col_adj]) else ''
            is_adj = adj_val.upper() in ['SI', 'SÍ', 'YES', 'TRUE', '1']
            BIDDERS_BY_PROJECT.setdefault(p_code, []).append({
                'code': b_code, 'name': b_name,
                'adjudicado': is_adj, 'adjudicado_raw': adj_val
            })
    print(f"  -> {len(BIDDERS_BY_PROJECT)} proyectos con oferentes")
except Exception as e:
    print(f"  ⚠ Error al cargar hoja 'OF': {e}")

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
    m = re.search(r'^\d+_(.+)(\d)$', code)
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
        'resolution_date': sanitize_value(row['Fecha resolución declaración interes público']),
        'adjudication_date': sanitize_value(row['Fecha decreto adjudicación']),
        'start_date': sanitize_value(row['Fecha inicio del contrato de concesión']),
        'end_date': sanitize_value(row['Fecha término de la concesión']),
        'investment': sanitize_value(row['Inversión Materializada estimada']),
        'progress': sanitize_value(row['% Avance obras físicas'])
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
    'operación':      int((df_contracts['ESTADO'] == 'Operación').sum()),
    'construcción':   int((df_contracts['ESTADO'] == 'Construcción').sum()),
    'comb_const_oper': int((df_contracts['ESTADO'] == 'Construcción y Operación').sum()),
    'finalizado':     int((df_contracts['ESTADO'] == 'Finalizado').sum()),
    'activos':        int(((df_contracts['ESTADO'] == 'Operación') | (df_contracts['ESTADO'] == 'Construcción y Operación')).sum())
}
sector_stats  = {str(k): int(v) for k, v in df_contracts['Sector del proyecto'].value_counts().to_dict().items()}
status_stats  = {str(k): int(v) for k, v in df_contracts['ESTADO'].value_counts().to_dict().items()}
count_total   = len(df_contracts)

# ── Serializar datos de contratos ──────────────────────────────────────────────
print("Serializando contratos...")
serialized_data = []
map_projects    = []

for _, row in df_contracts.iterrows():
    row_dict  = row.to_dict()
    sanitized = {k: sanitize_value(v) for k, v in row_dict.items()}

    code = str(sanitized.get('Código proyecto', ''))
    m = re.search(r'^\d+_(.+)(\d)$', code)
    if m:
        base_code = m.group(1)
    else:
        m_simple = re.search(r'^(.+)(\d)$', code)
        base_code = m_simple.group(1) if m_simple else code

    sanitized['group_timeline'] = BASE_GROUPS.get(base_code, [])
    sanitized['shapes']         = parse_shapes_list(get_row_shapes_val(row_dict))
    sanitized['bidders']        = BIDDERS_BY_PROJECT.get(code, [])
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

# ── EFE: Exportar datos de proyectos ferroviarios ──────────────────────────────
print("\nProcesando hoja EFE...")

try:
    df_efe = pd.read_excel(EXCEL_PATH, sheet_name='EFE')
    print(f"  -> {len(df_efe)} filas cargadas en hoja 'EFE'")

    efe_projects = []
    for _, row in df_efe.iterrows():
        proyecto = sanitize_value(row.get('Proyecto'))
        if not proyecto:
            continue

        region_raw = sanitize_value(row.get('region'))
        region = region_raw if region_raw else None

        inv_raw = row.get('Inversion (USD) ')
        try:
            inv = float(inv_raw) if inv_raw is not None and str(inv_raw).replace('.', '', 1).isdigit() else None
        except Exception:
            inv = None

        shapes_val = row.get('Shapes')
        shapes = parse_shapes_list(shapes_val)

        descripcion = sanitize_value(row.get('Descripcion'))
        fuente = sanitize_value(row.get('Fuente  de inf'))

        filial_raw = sanitize_value(row.get('Filial') if 'Filial' in row else row.get('filial'))
        filial = None
        if filial_raw and not pd.isna(filial_raw):
            f_str = str(filial_raw).strip()
            f_norm = _normalize_col(f_str)
            if 'valpara' in f_norm:
                filial = 'EFE Valparaíso'
            elif 'central' in f_norm:
                filial = 'EFE Central'
            elif 'sur' in f_norm:
                filial = 'EFE Sur'
            else:
                filial = f_str

        efe_projects.append({
            'name': str(proyecto),
            'region': region,
            'filial': filial,
            'investment_usd': inv,
            'shapes': shapes,
            'description': descripcion,
            'source': fuente,
        })

    efe_payload = {'data': efe_projects}
    out_efe_js = os.path.join(OUT_DIR, 'efe_data.js')
    efe_json_str = json.dumps(efe_payload, ensure_ascii=False, indent=None, separators=(',', ':'))
    with open(out_efe_js, 'w', encoding='utf-8') as f:
        f.write(f'window.EFE_DATA = {efe_json_str};')

    size_efe_mb = os.path.getsize(out_efe_js) / 1024 / 1024
    print(f"OK EFE Generado: {out_efe_js} ({size_efe_mb:.3f} MB)")
    print(f"   Proyectos EFE exportados: {len(efe_projects)}")

except Exception as e:
    print(f"⚠ Error al exportar datos EFE: {e}")
    import traceback; traceback.print_exc()

