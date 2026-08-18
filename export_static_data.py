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
    m = re.search(r'^[A-Za-z0-9]+_(.+)(\d)$', code)
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


# ── MOP: Exportar datos del Ministerio de Obras Públicas ───────────────────────
print("\nProcesando hoja 'Base MOP'...")

try:
    MOP_EXCEL_PATH = os.path.join(BASE_DIR, 'BASE MOP.xlsx')
    df_mop = pd.read_excel(MOP_EXCEL_PATH, sheet_name='Base MOP')
    print(f"  -> {len(df_mop)} filas cargadas en hoja 'Base MOP'")

    # Normalizar columnas con posibles caracteres especiales
    df_mop.columns = [str(c).strip() for c in df_mop.columns]

    # Detectar nombres reales de columnas clave
    col_region   = next((c for c in df_mop.columns if 'regi' in c.lower()), None)
    col_servicio = next((c for c in df_mop.columns if 'servicio' in c.lower()), None)
    col_nombre   = next((c for c in df_mop.columns if 'nombre proyecto' in c.lower()), None)
    col_bip      = next((c for c in df_mop.columns if 'bip' in c.lower()), None)
    col_programa = next((c for c in df_mop.columns if 'programa' in c.lower()), None)
    col_etapa    = next((c for c in df_mop.columns if 'etapa' in c.lower()), None)
    col_cost     = next((c for c in df_mop.columns if c.lower() == 'cost'), None)
    col_primera  = next((c for c in df_mop.columns if 'primera' in c.lower() and 'postulacion' in c.lower()), None)
    col_ultima   = next((c for c in df_mop.columns if 'ultima' in c.lower() and 'postulacion' in c.lower()), None)
    col_desc     = next((c for c in df_mop.columns if 'desc' in c.lower() or 'ebi_desc' in c.lower()), None)
    col_loc      = next((c for c in df_mop.columns if 'localizacion' in c.lower() or 'ebi_loc' in c.lower()), None)

    print(f"  -> Columnas detectadas: región={col_region}, servicio={col_servicio}, "
          f"nombre={col_nombre}, bip={col_bip}, programa={col_programa}, "
          f"etapa={col_etapa}, cost={col_cost}, desc={col_desc}, loc={col_loc}")

    # Estandarizar columnas a nombres internos fijos
    rename_map = {}
    if col_region:   rename_map[col_region]   = '_region'
    if col_servicio: rename_map[col_servicio] = '_servicio'
    if col_nombre:   rename_map[col_nombre]   = '_nombre'
    if col_bip:      rename_map[col_bip]      = '_bip'
    if col_programa: rename_map[col_programa] = '_programa'
    if col_etapa:    rename_map[col_etapa]    = '_etapa'
    if col_cost:     rename_map[col_cost]     = '_cost_raw'
    if col_primera:  rename_map[col_primera]  = '_primera'
    if col_ultima:   rename_map[col_ultima]   = '_ultima'
    if col_desc:     rename_map[col_desc]     = '_desc'
    if col_loc:      rename_map[col_loc]      = '_loc'
    df_mop = df_mop.rename(columns=rename_map)

    df_mop['_cost'] = pd.to_numeric(df_mop['_cost_raw'] if '_cost_raw' in df_mop.columns else 0, errors='coerce').fillna(0)
    df_mop['_year'] = pd.to_numeric(df_mop['_primera'] if '_primera' in df_mop.columns else None, errors='coerce')

    # ── Limpiar valores "No se encuentra" y cadenas vacías → NaN ─────────────
    INVALID_VALS = {'no se encuentra', 'n/a', 'nd', '-', ''}
    str_cols = ['_region', '_servicio', '_nombre', '_programa', '_etapa', '_bip']
    for col in str_cols:
        if col in df_mop.columns:
            df_mop[col] = df_mop[col].apply(
                lambda v: np.nan if (
                    pd.isna(v) or str(v).strip().lower() in INVALID_VALS
                ) else str(v).strip()
            )

    # Helper seguro para valor de columna
    def _sv(row, col):
        val = row.get(col)
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return ''
        if str(val).strip().lower() in {'no se encuentra', 'n/a', 'nd', '-'}:
            return ''
        return str(val).strip()

    # ── By Región ─────────────────────────────────────────────────────────────
    MOP_NORTE_SUR = [
        'Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo',
        'Valparaíso','Metropolitana de Santiago',
        "Libertador General Bernardo O'Higgins",'Maule','Ñuble',
        'Biobío','La Araucanía','Los Ríos','Los Lagos',
        'Aysén del General Carlos Ibáñez del Campo',
        'Magallanes y de la Antártica Chilena'
    ]

    def mop_region_sort(r):
        norm_r = unicodedata.normalize('NFD', str(r)).encode('ascii','ignore').decode().lower()
        for i, ref in enumerate(MOP_NORTE_SUR):
            norm_ref = unicodedata.normalize('NFD', ref).encode('ascii','ignore').decode().lower()
            if norm_ref in norm_r or norm_r in norm_ref:
                return i
        return 99

    reg_g = df_mop.groupby('_region').agg(
        count=('_nombre','count'), total=('_cost','sum')
    ).reset_index().sort_values('total', ascending=False)

    by_region = [
        {'region': str(r['_region']), 'count': int(r['count']),
         'total_mm': round(float(r['total'])/1e6, 2)}
        for _, r in reg_g.iterrows()
    ]
    by_region_ns = sorted(by_region, key=lambda x: mop_region_sort(x['region']))

    # ── By Servicio ───────────────────────────────────────────────────────────
    srv_g = df_mop.groupby('_servicio').agg(
        count=('_nombre','count'), total=('_cost','sum')
    ).reset_index().sort_values('count', ascending=False)

    by_servicio = [
        {'servicio': str(r['_servicio']), 'count': int(r['count']),
         'total_mm': round(float(r['total'])/1e6, 2)}
        for _, r in srv_g.iterrows()
    ]

    # ── By Etapa ──────────────────────────────────────────────────────────────
    etp_g = df_mop.groupby('_etapa').agg(
        count=('_nombre','count'), total=('_cost','sum')
    ).reset_index().sort_values('count', ascending=False)

    ETAPA_EXCLUIR = {'no se encuentra', 'nan', ''}
    by_etapa = [
        {'etapa': str(r['_etapa']), 'count': int(r['count']),
         'total_mm': round(float(r['total'])/1e6, 2)}
        for _, r in etp_g.iterrows()
        if str(r['_etapa']).lower() not in ETAPA_EXCLUIR
    ]

    # ── By Programa (top 10 por inversión) ────────────────────────────────────
    prg_g = df_mop.groupby('_programa').agg(
        count=('_nombre','count'), total=('_cost','sum')
    ).reset_index().sort_values('total', ascending=False).head(10)

    by_programa = [
        {'programa': str(r['_programa']), 'count': int(r['count']),
         'total_mm': round(float(r['total'])/1e6, 2)}
        for _, r in prg_g.iterrows()
    ]

    # ── By Year ───────────────────────────────────────────────────────────────
    yr_g = df_mop[df_mop['_year'].notna()].groupby('_year').agg(
        count=('_nombre','count'), total=('_cost','sum')
    ).reset_index().sort_values('_year')

    by_year = [
        {'year': int(r['_year']), 'count': int(r['count']),
         'total_mm': round(float(r['total'])/1e6, 2)}
        for _, r in yr_g.iterrows()
    ]

    # ── Top 10 megaproyectos ──────────────────────────────────────────────────
    top10 = df_mop.sort_values('_cost', ascending=False).head(10)
    top_projects = [
        {
            'nombre':   _sv(r, '_nombre'),
            'region':   _sv(r, '_region'),
            'servicio': _sv(r, '_servicio'),
            'etapa':    _sv(r, '_etapa'),
            'programa': _sv(r, '_programa'),
            'bip':      _sv(r, '_bip'),
            'cost_mm':  round(float(r['_cost'])/1e6, 2),
            'year':     int(r['_year']) if pd.notna(r.get('_year')) else None,
        }
        for _, r in top10.iterrows()
    ]

    # ── All projects list (para tabla filtrable) ───────────────────────────────
    all_projects = []
    for _, r in df_mop.iterrows():
        yr_ult_raw = pd.to_numeric(r.get('_ultima'), errors='coerce')
        desc_val = _sv(r, '_desc')
        loc_val = _sv(r, '_loc')
        if loc_val in {'0', '0.0', 'nan', 'none'}:
            loc_val = ''

        all_projects.append({
            'nombre':       _sv(r, '_nombre'),
            'region':       _sv(r, '_region'),
            'servicio':     _sv(r, '_servicio'),
            'programa':     _sv(r, '_programa'),
            'etapa':        _sv(r, '_etapa'),
            'bip':          _sv(r, '_bip'),
            'cost_mm':      round(float(r['_cost'])/1e6, 2),
            'year':         int(r['_year']) if pd.notna(r.get('_year')) else None,
            'year_ult':     int(yr_ult_raw) if pd.notna(yr_ult_raw) else None,
            'descripcion':  desc_val,
            'localizacion': loc_val,
        })

    # ── KPIs Resumen ──────────────────────────────────────────────────────────
    total_cost_mm = round(float(df_mop['_cost'].sum())/1e6, 2)
    top_srv = by_servicio[0] if by_servicio else {}
    en_ejecucion = int((df_mop['_etapa'].str.upper() == 'EJECUCION').sum()) if '_etapa' in df_mop else 0

    # ── Filtros únicos ────────────────────────────────────────────────────────
    unique_regions  = sorted(df_mop['_region'].dropna().unique().tolist(), key=mop_region_sort)
    unique_servicios= sorted(df_mop['_servicio'].dropna().unique().tolist())
    unique_etapas   = [e for e in df_mop['_etapa'].dropna().unique().tolist()
                       if str(e).lower() not in ETAPA_EXCLUIR]
    unique_programas= sorted(df_mop['_programa'].dropna().unique().tolist())

    mop_payload = {
        'summary': {
            'total_projects': len(df_mop),
            'total_cost_mm':  total_cost_mm,
            'top_servicio':   top_srv.get('servicio', ''),
            'top_servicio_count': top_srv.get('count', 0),
            'en_ejecucion':   en_ejecucion,
        },
        'by_region':   by_region,
        'by_region_ns': by_region_ns,
        'by_servicio': by_servicio,
        'by_etapa':    by_etapa,
        'by_programa': by_programa,
        'by_year':     by_year,
        'top_projects': top_projects,
        'projects':    all_projects,
        'filters': {
            'regions':   unique_regions,
            'servicios': unique_servicios,
            'etapas':    unique_etapas,
            'programas': unique_programas,
        }
    }

    out_mop_js = os.path.join(OUT_DIR, 'mop_data.js')
    mop_json = json.dumps(mop_payload, ensure_ascii=False, separators=(',', ':'))
    with open(out_mop_js, 'w', encoding='utf-8') as f:
        f.write(f'window.MOP_DATA = {mop_json};')

    size_mop = os.path.getsize(out_mop_js) / 1024 / 1024
    print(f"OK MOP Generado: {out_mop_js} ({size_mop:.3f} MB)")
    print(f"   Proyectos MOP exportados: {len(all_projects)}")

except Exception as e:
    print(f"[WARN] Error al exportar datos MOP: {e}")
    import traceback; traceback.print_exc()
