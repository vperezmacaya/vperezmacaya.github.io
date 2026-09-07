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
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'Bases de dato')

DGC_EXCEL_PATH = os.path.join(DATA_DIR, 'DGC.xlsx')
if not os.path.exists(DGC_EXCEL_PATH):
    DGC_EXCEL_PATH = os.path.join(DATA_DIR, 'CATLEC.xlsx')
if not os.path.exists(DGC_EXCEL_PATH):
    DGC_EXCEL_PATH = os.path.join(DATA_DIR, 'CALTEC.xlsx')
if not os.path.exists(DGC_EXCEL_PATH):
    DGC_EXCEL_PATH = os.path.join(BASE_DIR, 'CATLEC.xlsx')

EFE_EXCEL_PATH = os.path.join(DATA_DIR, 'EFE.xlsx')

if not os.path.exists(EFE_EXCEL_PATH):
    EFE_EXCEL_PATH = os.path.join(DATA_DIR, 'CATLEC.xlsx')
if not os.path.exists(EFE_EXCEL_PATH):
    EFE_EXCEL_PATH = os.path.join(DATA_DIR, 'CALTEC.xlsx')
if not os.path.exists(EFE_EXCEL_PATH):
    EFE_EXCEL_PATH = os.path.join(BASE_DIR, 'CATLEC.xlsx')

METRO_EXCEL_PATH = os.path.join(DATA_DIR, 'Metro.xlsx')

EXCEL_PATH = DGC_EXCEL_PATH

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
print(f"\nProcesando EFE desde: {EFE_EXCEL_PATH}...")

try:
    efe_excel_file = pd.ExcelFile(EFE_EXCEL_PATH)
    sheet_to_use = 'Proyectos Deduplicados' if 'Proyectos Deduplicados' in efe_excel_file.sheet_names else 'EFE'
    df_efe = pd.read_excel(EFE_EXCEL_PATH, sheet_name=sheet_to_use)
    print(f"  -> {len(df_efe)} filas cargadas en hoja '{sheet_to_use}'")
    print(f"  -> Columnas: {list(df_efe.columns)}")

    df_history = None
    if 'EFE' in efe_excel_file.sheet_names:
        df_history = pd.read_excel(EFE_EXCEL_PATH, sheet_name='EFE')
        print(f"  -> {len(df_history)} filas históricas cargadas desde hoja 'EFE'")

    # Escaneo de fotos en Fotos/EFE para cruce automático con proyectos
    efe_photos_dir = os.path.join(BASE_DIR, 'Fotos', 'EFE')
    efe_photo_files = []
    if os.path.exists(efe_photos_dir):
        efe_photo_files = [f for f in os.listdir(efe_photos_dir) if os.path.splitext(f)[1].lower() in ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']]
        print(f"  -> {len(efe_photo_files)} fotos detectadas en Fotos/EFE: {efe_photo_files}")

    def _normalize_name_for_match(s):
        if not s: return ''
        s_norm = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode('utf-8')
        s_norm = s_norm.lower()
        return re.sub(r'[^a-z0-9]+', ' ', s_norm).strip()

    # ── Detectar columnas dinámicamente ───────────────────────────────────────
    efe_cols = {_normalize_col(c): c for c in df_efe.columns}

    def _find_efe_col(*keywords):
        """Find column whose normalized name contains ALL given keywords."""
        for norm_name, orig_name in efe_cols.items():
            if all(kw in norm_name for kw in keywords):
                return orig_name
        return None

    # Explicit column mapping — 'Proyecto' must be exact to avoid matching 'ID Proyecto'
    col_proyecto    = 'Proyecto' if 'Proyecto' in df_efe.columns else _find_efe_col('proyecto') or 'Proyecto'
    col_descripcion = _find_efe_col('descripcion') or 'Descripción'
    col_filial      = _find_efe_col('filial') or 'Filial'
    col_fuente      = _find_efe_col('fuente') or 'Fuente'
    col_detalle     = _find_efe_col('detalle') or 'Detalle'
    col_tipo        = _find_efe_col('tipo') or 'Tipo'
    col_etapa       = _find_efe_col('etapa') or 'Etapa'
    col_shapes      = _find_efe_col('shapes') or 'Shapes'
    col_id          = _find_efe_col('id', 'proyecto') or 'ID Proyecto'

    def _safe_parse_operation_year(val):
        """Parse operation year from values like 2030, '2030 + ', etc."""
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return None
        s = str(val).strip()
        m = re.search(r'(\d{4})', s)
        return int(m.group(1)) if m else None

    # New columns
    col_inv_mm      = _find_efe_col('inversion') or 'Inversion estimada (MM USD)'
    col_operacion   = _find_efe_col('operacion') or 'Operación estimada'
    col_avance      = _find_efe_col('avance') or '%Avance etapa'

    print(f"  -> Columnas detectadas: proyecto={col_proyecto}, inv={col_inv_mm}, "
          f"operacion={col_operacion}, avance={col_avance}, fuente={col_fuente}")

    # ── Extraer año de la columna Fuente ──────────────────────────────────────
    def _extract_source_year(fuente_val):
        if not fuente_val or pd.isna(fuente_val):
            return 0
        m = re.search(r'(\d{4})', str(fuente_val))
        return int(m.group(1)) if m else 0

    df_efe['_source_year'] = df_efe[col_fuente].apply(_extract_source_year) if col_fuente in df_efe.columns else 0

    if df_history is not None and col_fuente in df_history.columns:
        df_history['_source_year'] = df_history[col_fuente].apply(_extract_source_year)

    # ── Iterar por la tabla de proyectos deduplicados ─────────────────────────
    # Si la hoja ya es 'Proyectos Deduplicados', cada fila ya es un ID único.
    # Si es hoja 'EFE', agrupamos por col_id o col_proyecto.
    if sheet_to_use == 'Proyectos Deduplicados':
        # Ordenar por ID Proyecto si existe
        if col_id in df_efe.columns:
            df_efe = df_efe.sort_values(col_id, ascending=True)
        project_rows = [(r.get(col_proyecto), r) for _, r in df_efe.iterrows()]
    else:
        # Fallback: deduplicar por ID Proyecto
        if col_id in df_efe.columns:
            dedup_df = df_efe.sort_values(by=[col_id, '_source_year'], ascending=[True, False]).drop_duplicates(subset=[col_id], keep='first')
        else:
            dedup_df = df_efe.sort_values(by=['_source_year'], ascending=False).drop_duplicates(subset=[col_proyecto], keep='first')
        project_rows = [(r.get(col_proyecto), r) for _, r in dedup_df.iterrows()]

    efe_projects = []
    for proj_name, latest_row in project_rows:
        if not proj_name or pd.isna(proj_name):
            continue

        id_val = latest_row.get(col_id)
        try:
            id_int = int(id_val) if id_val is not None and not pd.isna(id_val) else None
        except Exception:
            id_int = None

        # Construir historial (all_records)
        all_records = []
        if df_history is not None:
            if id_int is not None and col_id in df_history.columns:
                h_rows = df_history[df_history[col_id] == id_int]
            elif col_proyecto in df_history.columns:
                h_rows = df_history[df_history[col_proyecto] == proj_name]
            else:
                h_rows = pd.DataFrame()

            if not h_rows.empty:
                h_sorted = h_rows.sort_values('_source_year', ascending=False)
                for _, rec_row in h_sorted.iterrows():
                    rec_inv = rec_row.get(col_inv_mm)
                    try:
                        rec_inv = float(rec_inv) if rec_inv is not None and not pd.isna(rec_inv) else None
                    except Exception:
                        rec_inv = None

                    all_records.append({
                        'source_year': int(rec_row['_source_year']) if rec_row.get('_source_year') else None,
                        'source': sanitize_value(rec_row.get(col_fuente)),
                        'investment_mm_usd': rec_inv,
                        'stage': sanitize_value(rec_row.get(col_etapa)),
                        'progress': sanitize_value(rec_row.get(col_avance)),
                        'operation_year': _safe_parse_operation_year(rec_row.get(col_operacion)),
                    })

        if not all_records:
            all_records.append({
                'source_year': int(latest_row['_source_year']) if latest_row.get('_source_year') else None,
                'source': sanitize_value(latest_row.get(col_fuente)),
                'investment_mm_usd': float(latest_row.get(col_inv_mm)) if latest_row.get(col_inv_mm) is not None and not pd.isna(latest_row.get(col_inv_mm)) else None,
                'stage': sanitize_value(latest_row.get(col_etapa)),
                'progress': sanitize_value(latest_row.get(col_avance)),
                'operation_year': _safe_parse_operation_year(latest_row.get(col_operacion)),
            })

        # Extract fields from latest row
        inv_raw = latest_row.get(col_inv_mm)
        try:
            inv_mm = float(inv_raw) if inv_raw is not None and not pd.isna(inv_raw) else None
        except Exception:
            inv_mm = None

        operacion_raw = latest_row.get(col_operacion)
        operation_year = _safe_parse_operation_year(operacion_raw)

        avance_raw = sanitize_value(latest_row.get(col_avance))
        detalle_raw = sanitize_value(latest_row.get(col_detalle))
        fuente_raw = sanitize_value(latest_row.get(col_fuente))
        source_year = int(latest_row['_source_year']) if latest_row['_source_year'] else None
        descripcion = sanitize_value(latest_row.get(col_descripcion))

        shapes_val = latest_row.get(col_shapes)
        shapes = parse_shapes_list(shapes_val)

        estaciones_col = 'Estaciones' if 'Estaciones' in latest_row.index else ('estaciones' if 'estaciones' in latest_row.index else None)
        stations = parse_shapes_list(latest_row.get(estaciones_col)) if estaciones_col else []

        filial_raw = latest_row.get(col_filial)
        filial = None
        if filial_raw is not None and not pd.isna(filial_raw):
            f_str = str(filial_raw).strip()
            if f_str and f_str.lower() not in ['nan', 'none', 'null', '']:
                filial = f_str

        tipo_raw = sanitize_value(latest_row.get(col_tipo))
        etapa_raw = sanitize_value(latest_row.get(col_etapa))

        # Cruce automático de fotos
        matched_photos = []
        proj_norm = _normalize_name_for_match(proj_name)
        for pf in efe_photo_files:
            base, _ = os.path.splitext(pf)
            f_norm = _normalize_name_for_match(base)
            if f_norm == proj_norm or (len(f_norm) > 8 and f_norm in proj_norm) or (len(proj_norm) > 8 and proj_norm in f_norm):
                matched_photos.append(f'Fotos/EFE/{pf}')

        photo = matched_photos[0] if matched_photos else None

        efe_projects.append({
            'id': id_int,
            'name': str(proj_name),
            'type': tipo_raw,
            'stage': etapa_raw,
            'filial': filial,
            'investment_mm_usd': inv_mm,
            'operation_year': operation_year,
            'progress': avance_raw,
            'detail': detalle_raw,
            'source': fuente_raw,
            'source_year': source_year,
            'shapes': shapes,
            'stations': stations,
            'description': descripcion,
            'photo': photo,
            'photos': matched_photos,
            'all_records': all_records,
        })

    # Sort by investment descending (None last)
    efe_projects.sort(key=lambda p: p.get('investment_mm_usd') or 0, reverse=True)

    efe_payload = {'data': efe_projects}
    out_efe_js = os.path.join(OUT_DIR, 'efe_data.js')
    efe_json_str = json.dumps(efe_payload, ensure_ascii=False, indent=None, separators=(',', ':'))
    with open(out_efe_js, 'w', encoding='utf-8') as f:
        f.write(f'window.EFE_DATA = {efe_json_str};')

    size_efe_mb = os.path.getsize(out_efe_js) / 1024 / 1024
    print(f"OK EFE Generado: {out_efe_js} ({size_efe_mb:.3f} MB)")
    print(f"   Proyectos EFE exportados: {len(efe_projects)} (deduplicados de {len(df_efe)} registros)")

except Exception as e:
    print(f"[WARN] Error al exportar datos EFE: {e}")
    import traceback; traceback.print_exc()


# ── MOP: Exportar datos del Ministerio de Obras Públicas ───────────────────────
print("\nProcesando hoja 'Base MOP'...")

try:
    MOP_EXCEL_PATH = os.path.join(DATA_DIR, 'BASE MOP.xlsx')
    if not os.path.exists(MOP_EXCEL_PATH):
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


# ── SECTRA: Exportar datos de Secretaría de Planificación de Transporte ───────────
print("\nProcesando Base de Datos SECTRA...")

try:
    SECTRA_EXCEL_PATH = os.path.join(DATA_DIR, 'Proyectos_SECTRA.xlsx')
    if not os.path.exists(SECTRA_EXCEL_PATH):
        SECTRA_EXCEL_PATH = os.path.join(DATA_DIR, 'Proyectos_SECTRA_actualizado.xlsx')
    if not os.path.exists(SECTRA_EXCEL_PATH):
        SECTRA_EXCEL_PATH = os.path.join(BASE_DIR, 'Proyectos_SECTRA.xlsx')

    if os.path.exists(SECTRA_EXCEL_PATH):
        # 1. Cargar proyectos
        df_sectra = pd.read_excel(SECTRA_EXCEL_PATH, sheet_name='Proyectos SECTRA')
        print(f"  -> {len(df_sectra)} filas cargadas en hoja 'Proyectos SECTRA'")

        # 2. Cargar conurbaciones e indicadores
        df_conurb = pd.DataFrame()
        try:
            df_conurb = pd.read_excel(SECTRA_EXCEL_PATH, sheet_name='Info por Conurbación')
            print(f"  -> {len(df_conurb)} filas cargadas en hoja 'Info por Conurbación'")
        except Exception:
            print("  -> Hoja 'Info por Conurbación' no encontrada o vacía.")

        sectra_projects = []
        for idx, row in df_sectra.iterrows():
            inv = sanitize_value(row.get('Inversión'))
            if inv is not None:
                try:
                    inv = float(inv)
                except Exception:
                    inv = None

            sectra_projects.append({
                'id': int(idx + 1),
                'region': sanitize_value(row.get('Región')),
                'city': sanitize_value(row.get('Ciudad / Área')),
                'number': sanitize_value(row.get('N°')),
                'name': sanitize_value(row.get('Proyecto')),
                'investment': inv,
                'currency': sanitize_value(row.get('Moneda')),
                'tir': sanitize_value(row.get('TIR')),
                'mandante': sanitize_value(row.get('Mandante')),
                'status': sanitize_value(row.get('Estado')),
                'description': sanitize_value(row.get('Descripción')),
                'source_url': sanitize_value(row.get('Fuente URL')),
            })

        conurbations = []
        if not df_conurb.empty:
            for c_idx, crow in df_conurb.iterrows():
                conurbations.append({
                    'id': int(c_idx + 1),
                    'region': sanitize_value(crow.get('Región')),
                    'city': sanitize_value(crow.get('Ciudad / Conurbación')),
                    'population': sanitize_value(crow.get('Población')),
                    'households': sanitize_value(crow.get('Hogares')),
                    'private_vehicles': sanitize_value(crow.get('Vehículos privados')),
                    'road_network': sanitize_value(crow.get('Redes viales')),
                    'daily_trips': sanitize_value(crow.get('Viajes diarios')),
                    'execution_deadline': sanitize_value(crow.get('Plazo de ejecución')),
                    'portfolio_value': sanitize_value(crow.get('Valor de la cartera')),
                    'source_url': sanitize_value(crow.get('Fuente URL')),
                })

        # Summary KPIs & distributions
        unique_regions = sorted(list(set([p['region'] for p in sectra_projects if p['region']])))
        unique_cities = sorted(list(set([p['city'] for p in sectra_projects if p['city']])))
        unique_statuses = sorted(list(set([p['status'] for p in sectra_projects if p['status']])))
        unique_mandantes = sorted(list(set([p['mandante'] for p in sectra_projects if p['mandante']])))

        # Region stats
        by_region = []
        for r in unique_regions:
            r_projs = [p for p in sectra_projects if p['region'] == r]
            r_inv = sum([p['investment'] for p in r_projs if p['investment'] and p.get('currency') == 'UF'])
            by_region.append({
                'region': r,
                'count': len(r_projs),
                'total_inv_uf': round(r_inv, 2)
            })
        by_region.sort(key=lambda x: x['count'], reverse=True)

        # Status stats
        by_status = []
        for st in unique_statuses:
            st_projs = [p for p in sectra_projects if p['status'] == st]
            by_status.append({
                'status': st,
                'count': len(st_projs)
            })
        by_status.sort(key=lambda x: x['count'], reverse=True)

        # Mandante stats
        by_mandante = []
        for m in unique_mandantes:
            m_projs = [p for p in sectra_projects if p['mandante'] == m]
            by_mandante.append({
                'mandante': m,
                'count': len(m_projs)
            })
        by_mandante.sort(key=lambda x: x['count'], reverse=True)

        total_inv_uf = sum([p['investment'] for p in sectra_projects if p['investment'] and p.get('currency') == 'UF'])

        sectra_payload = {
            'summary': {
                'total_projects': len(sectra_projects),
                'total_investment_uf': round(total_inv_uf, 2),
                'total_conurbations': len(conurbations),
                'total_regions': len(unique_regions),
                'total_cities': len(unique_cities)
            },
            'projects': sectra_projects,
            'conurbations': conurbations,
            'by_region': by_region,
            'by_status': by_status,
            'by_mandante': by_mandante,
            'filters': {
                'regions': unique_regions,
                'cities': unique_cities,
                'statuses': unique_statuses,
                'mandantes': unique_mandantes
            }
        }

        out_sectra_js = os.path.join(OUT_DIR, 'sectra_data.js')
        sectra_json = json.dumps(sectra_payload, ensure_ascii=False, separators=(',', ':'))
        with open(out_sectra_js, 'w', encoding='utf-8') as f:
            f.write(f'window.SECTRA_DATA = {sectra_json};')

        size_sectra = os.path.getsize(out_sectra_js) / 1024 / 1024
        print(f"OK SECTRA Generado: {out_sectra_js} ({size_sectra:.3f} MB)")
        print(f"   Proyectos SECTRA exportados: {len(sectra_projects)}")
        print(f"   Conurbaciones exportadas: {len(conurbations)}")
    else:
        print(f"[WARN] No se encontró el archivo Excel de SECTRA en {SECTRA_EXCEL_PATH}")

except Exception as e:
    print(f"[WARN] Error al exportar datos SECTRA: {e}")
    import traceback; traceback.print_exc()


# ── Exportar Proyectos Metro de Santiago ────────────────────────────────────────
try:
    if os.path.exists(METRO_EXCEL_PATH):
        print(f"\nProcesando Metro desde: {METRO_EXCEL_PATH}...")
        df_metro = pd.read_excel(METRO_EXCEL_PATH, sheet_name='Proyectos Metro', header=2)
        print(f"  -> {len(df_metro)} filas cargadas desde hoja 'Proyectos Metro'")

        metro_projects = []
        for _, row in df_metro.iterrows():
            shapes_raw = str(row.get('Shapes', ''))
            shapes = [int(s.strip()) if s.strip().isdigit() else s.strip() for s in shapes_raw.split(',') if s.strip() and s.strip() != '—' and s.strip().lower() != 'nan']

            inv_val = row.get('Inversión estimada (MM USD)')
            inv_num = None
            try:
                if pd.notna(inv_val) and str(inv_val).strip() != '' and str(inv_val).strip() != '—':
                    inv_num = float(inv_val)
            except Exception:
                inv_num = None
            raw_inv = str(inv_val).strip() if pd.notna(inv_val) and str(inv_val).strip() not in ['', 'nan', '—', '-'] else None

            inv_acum_val = row.get('Inversión acumulada 2025 (MM USD)')
            inv_acum_num = None
            try:
                if pd.notna(inv_acum_val) and str(inv_acum_val).strip() != '' and str(inv_acum_val).strip() != '—':
                    inv_acum_num = float(inv_acum_val)
            except Exception:
                inv_acum_num = None
            raw_inv_acum = str(inv_acum_val).strip() if pd.notna(inv_acum_val) and str(inv_acum_val).strip() not in ['', 'nan', '—', '-'] else None

            av_fin_val = row.get('Avance Financiero')
            av_fin = None
            try:
                if pd.notna(av_fin_val) and str(av_fin_val).strip() != '' and str(av_fin_val).strip() != '—':
                    av_fin = float(av_fin_val)
            except Exception:
                av_fin = None
            raw_av_fin = str(av_fin_val).strip() if pd.notna(av_fin_val) and str(av_fin_val).strip() not in ['', 'nan', '—', '-'] else None

            av_fis_val = row.get('Avance Físico')
            av_fis = None
            try:
                if pd.notna(av_fis_val) and str(av_fis_val).strip() != '' and str(av_fis_val).strip() != '—':
                    av_fis = float(av_fis_val)
            except Exception:
                av_fis = None
            raw_av_fis = str(av_fis_val).strip() if pd.notna(av_fis_val) and str(av_fis_val).strip() not in ['', 'nan', '—', '-'] else None

            km_val = row.get('Longitud (km)')
            km_num = None
            try:
                if pd.notna(km_val): km_num = float(km_val)
            except Exception:
                km_num = None

            est_val = row.get('Estaciones')
            est_num = None
            try:
                if pd.notna(est_val): est_num = int(est_val)
            except Exception:
                est_num = None

            pob_val = row.get('Población Beneficiada (hab)')
            pob_num = None
            try:
                if pd.notna(pob_val) and str(pob_val).replace('.','').replace(',','').strip().isdigit():
                    pob_num = int(str(pob_val).replace('.','').replace(',','').strip())
            except Exception:
                pob_num = None

            proj_obj = {
                'id': str(row.get('ID Proyecto', '')),
                'shapes': shapes,
                'name': str(row.get('Proyecto', '')),
                'line': str(row.get('Línea', '')),
                'type': str(row.get('Tipo', 'Línea Nueva')),
                'environmental_classification': str(row.get('Clasificación Ambiental', '')),
                'stage': str(row.get('Etapa', '')),
                'environmental_status': str(row.get('Estado Ambiental / RCA', '')),
                'start_date': str(row.get('Fecha Inicio / Hito', '')),
                'length_km': km_num,
                'stations': est_num,
                'terminals': str(row.get('Terminales', '')),
                'communes': str(row.get('Comunas Conectadas', '')),
                'benefited_population': pob_num or sanitize_value(row.get('Población Beneficiada (hab)')),
                'travel_time': str(row.get('Tiempo de Viaje / Reducción', '')),
                'operation_year': str(row.get('Puesta en Servicio', '')),
                'investment_mm_usd': inv_num,
                'investment_str': raw_inv,
                'accumulated_investment_2025_mm_usd': inv_acum_num,
                'accumulated_investment_str': raw_inv_acum,
                'financial_progress_pct': av_fin,
                'financial_progress_str': raw_av_fin,
                'physical_progress_pct': av_fis,
                'physical_progress_str': raw_av_fis,
                'tunnel_excavation': str(row.get('Avance Túnel / Excavaciones', '')),
                'combinations': str(row.get('Combinaciones e Intermodalidad', '')),
                'workshops_depots': str(row.get('Talleres y Cocheras', '')),
                'rolling_stock': str(row.get('Material Rodante', '')),
                'systems_technology': str(row.get('Tecnología y Sistemas', '')),
                'heritage_archaeology': str(row.get('Patrimonio y Arqueología', '')),
                'source': str(row.get('Fuente', '')),
                'color_hex': sanitize_value(row.get('Color Hex'))
            }
            metro_projects.append(proj_obj)

        # ── Cargar Líneas Operativas ──
        metro_lines = []
        try:
            df_lines = pd.read_excel(METRO_EXCEL_PATH, sheet_name='Líneas Operativas', header=2)
            for _, r in df_lines.iterrows():
                l_name = str(r.get('Línea', '')).strip()
                if not l_name or 'TOTAL' in l_name.upper():
                    continue
                metro_lines.append({
                    'line': l_name,
                    'color': sanitize_value(r.get('Color')),
                    'color_hex': sanitize_value(r.get('Color Hex')),
                    'terminals': sanitize_value(r.get('Terminales (Cabeceras)')),
                    'length_km': float(r.get('Longitud (km)')) if pd.notna(r.get('Longitud (km)')) else 0,
                    'stations': int(r.get('Estaciones')) if pd.notna(r.get('Estaciones')) else 0,
                    'combinations': int(r.get('Combinaciones')) if pd.notna(r.get('Combinaciones')) else 0,
                    'communes_count': int(r.get('Cant. Comunas')) if pd.notna(r.get('Cant. Comunas')) else 0,
                    'communes': sanitize_value(r.get('Comunas Conectadas')),
                    'alignment': sanitize_value(r.get('Tipo de Trazado')),
                    'rolling_type': sanitize_value(r.get('Rodadura')),
                    'driving_mode': sanitize_value(r.get('Conducción / Automatización')),
                    'rolling_stock': sanitize_value(r.get('Material Rodante')),
                    'cars_per_train': int(r.get('Coches / Convoy')) if pd.notna(r.get('Coches / Convoy')) else 0,
                    'platform_doors': sanitize_value(r.get('Puertas de Andén')),
                    'air_conditioning': sanitize_value(r.get('Aire Acondicionado')),
                    'inauguration_year': int(r.get('Año Inauguración')) if pd.notna(r.get('Año Inauguración')) else None,
                    'last_extension_year': int(r.get('Última Extensión')) if pd.notna(r.get('Última Extensión')) else None,
                    'commercial_speed': sanitize_value(r.get('Velocidad Comercial')),
                    'peak_headway': sanitize_value(r.get('Intervalo Hora Punta')),
                    'source': sanitize_value(r.get('Fuente')),
                    'track_type': sanitize_value(r.get('Tipología Tecnología') or r.get('Tipología Tecnológica')),
                    'inspection_days': int(r.get('Frecuencia de Inspección (días)')) if pd.notna(r.get('Frecuencia de Inspección (días)')) and str(r.get('Frecuencia de Inspección (días)')).isdigit() else None
                })
            print(f"  -> {len(metro_lines)} líneas operativas cargadas desde 'Líneas Operativas'")
        except Exception as e_l:
            print(f"  AVISO: No se pudo cargar hoja 'Líneas Operativas': {e_l}")

        # ── Cargar Hoja: Demanda Histórica ──
        historical_demand = []
        try:
            df_demanda = pd.read_excel(METRO_EXCEL_PATH, sheet_name='Demanda Histórica')
            for _, r in df_demanda.iterrows():
                if pd.notna(r.get('Año')):
                    historical_demand.append({
                        'year': int(r.get('Año')),
                        'trips_mm': float(r.get('Afluencia Total (MM Viajes)')) if pd.notna(r.get('Afluencia Total (MM Viajes)')) else 0.0,
                        'daily_trips_mm': float(r.get('Viajes Día Hábil (MM Pax/día)')) if pd.notna(r.get('Viajes Día Hábil (MM Pax/día)')) else 0.0,
                        'revenue_mm_clp': float(r.get('Ingresos Tarifarios (MM CLP)')) if pd.notna(r.get('Ingresos Tarifarios (MM CLP)')) else 0.0
                    })
            print(f"  -> {len(historical_demand)} registros cargados desde 'Demanda Histórica'")
        except Exception as e_d:
            print(f"  AVISO: No se pudo cargar hoja 'Demanda Histórica': {e_d}")

        # ── Cargar Hoja: Oferta Operacional ──
        operational_supply = []
        try:
            df_supply = pd.read_excel(METRO_EXCEL_PATH, sheet_name='Oferta Operacional')
            for _, r in df_supply.iterrows():
                if pd.notna(r.get('Año')):
                    operational_supply.append({
                        'year': int(r.get('Año')),
                        'car_km_mm': float(r.get('Total Coches-Km (MMCKm)')) if pd.notna(r.get('Total Coches-Km (MMCKm)')) else 0.0,
                        'op_costs_mm': float(r.get('Costos Op. (MM CLP)')) if pd.notna(r.get('Costos Op. (MM CLP)')) else 0.0,
                        'energy_gwh': float(r.get('Consumo Energía (GWh)')) if pd.notna(r.get('Consumo Energía (GWh)')) else 0.0,
                        'energy_efficiency': float(r.get('Eficiencia (GWh / MMCKm)')) if pd.notna(r.get('Eficiencia (GWh / MMCKm)')) else 0.0
                    })
            print(f"  -> {len(operational_supply)} registros cargados desde 'Oferta Operacional'")
        except Exception as e_s:
            print(f"  AVISO: No se pudo cargar hoja 'Oferta Operacional': {e_s}")

        # ── Tipología de Vías (Consolidada dinámicamente desde Líneas Operativas) ──
        track_types = []
        track_colors = {
            'Vías Convencionales Neumáticas': '#002447',
            'Vías Convencionales Férreas (Acero)': '#0284c7',
            'Vías Automáticas GoA 4 (CBTC)': '#10b981'
        }
        try:
            grouped_tracks = {}
            for l in metro_lines:
                t_name = l.get('track_type')
                if not t_name or t_name == '—':
                    continue
                if t_name not in grouped_tracks:
                    grouped_tracks[t_name] = {
                        'type': t_name,
                        'lines_list': [],
                        'length_km': 0.0,
                        'inspection_days': l.get('inspection_days') or 14,
                        'color': track_colors.get(t_name, '#0284c7')
                    }
                grouped_tracks[t_name]['lines_list'].append(l.get('line'))
                grouped_tracks[t_name]['length_km'] += float(l.get('length_km') or 0.0)
                if l.get('inspection_days'):
                    grouped_tracks[t_name]['inspection_days'] = l.get('inspection_days')

            # Orden canónico
            preferred_order = [
                'Vías Convencionales Neumáticas',
                'Vías Convencionales Férreas (Acero)',
                'Vías Automáticas GoA 4 (CBTC)'
            ]
            sorted_keys = sorted(grouped_tracks.keys(), key=lambda k: preferred_order.index(k) if k in preferred_order else 99)

            for t_name in sorted_keys:
                g = grouped_tracks[t_name]
                track_types.append({
                    'type': g['type'],
                    'lines': ', '.join(g['lines_list']),
                    'length_km': round(g['length_km'], 1),
                    'inspection_days': g['inspection_days'],
                    'color': g['color']
                })
            print(f"  -> {len(track_types)} tipologías calculadas dinámicamente desde 'Líneas Operativas'")
        except Exception as e_v:
            print(f"  AVISO: No se pudo calcular 'Tipologías de Vías': {e_v}")

        # ── Cargar Hoja: Confiabilidad y Averías ──
        operational_indicators = []
        try:
            df_ind = pd.read_excel(METRO_EXCEL_PATH, sheet_name='Confiabilidad y Averías')
            for _, r in df_ind.iterrows():
                ind_name = str(r.get('Indicador de Desempeño', '')).strip()
                if ind_name and ind_name != 'nan':
                    operational_indicators.append({
                        'indicator': ind_name,
                        'y2019': float(r.get(2019)) if pd.notna(r.get(2019)) else (float(r.get('2019')) if pd.notna(r.get('2019')) else 0.0),
                        'y2022': float(r.get(2022)) if pd.notna(r.get(2022)) else (float(r.get('2022')) if pd.notna(r.get('2022')) else 0.0),
                        'y2023': float(r.get(2023)) if pd.notna(r.get(2023)) else (float(r.get('2023')) if pd.notna(r.get('2023')) else 0.0),
                        'y2024': float(r.get(2024)) if pd.notna(r.get(2024)) else (float(r.get('2024')) if pd.notna(r.get('2024')) else 0.0),
                        'y2025': float(r.get(2025)) if pd.notna(r.get(2025)) else (float(r.get('2025')) if pd.notna(r.get('2025')) else 0.0)
                    })
            print(f"  -> {len(operational_indicators)} indicadores cargados desde 'Confiabilidad y Averías'")
        except Exception as e_i:
            print(f"  AVISO: No se pudo cargar hoja 'Confiabilidad y Averías': {e_i}")

        # ── Cargar Hoja: Estaciones ──
        metro_stations = []
        try:
            df_est = pd.read_excel(METRO_EXCEL_PATH, sheet_name='Estaciones', header=2)
            for _, r in df_est.iterrows():
                st_name = str(r.get('Nombre Estación', '')).strip()
                if not st_name or st_name == 'nan':
                    continue
                
                raw_lines = str(r.get('Línea', r.get('Líneas que Conecta', ''))).strip()
                lines_list = [l.strip() for l in raw_lines.split(',') if l.strip()] if raw_lines and raw_lines != 'nan' else []
                main_line = lines_list[0] if lines_list else ''
                
                raw_comunas = str(r.get('Comuna', '')).strip()
                comunas_list = [c.strip() for c in raw_comunas.split(',') if c.strip()] if raw_comunas and raw_comunas != 'nan' else []
                
                fut_comb = str(r.get('Combinación Futura', '')).strip()
                fut_comb_list = [f.strip() for f in fut_comb.split(',') if f.strip()] if fut_comb and fut_comb != 'nan' else []

                raw_proj = str(r.get('ID Proyecto', '')).strip()
                proj_list = [p.strip() for p in raw_proj.split(',') if p.strip()] if raw_proj and raw_proj != 'nan' else []

                metro_stations.append({
                    'id': sanitize_value(r.get('ID Estación')),
                    'shape_id': sanitize_value(r.get('Código Shape')),
                    'name': st_name,
                    'line': main_line,
                    'lines': lines_list,
                    'lines_connected_str': raw_lines if raw_lines != 'nan' else '',
                    'is_combination': str(r.get('Es Combinación', '')).strip().lower() in ['sí', 'si', 'true', '1'],
                    'future_combination': fut_comb_list,
                    'future_combination_str': fut_comb if fut_comb != 'nan' else '',
                    'commune': raw_comunas if raw_comunas != 'nan' else '',
                    'communes': comunas_list,
                    'status': sanitize_value(r.get('Estado')),
                    'inauguration': sanitize_value(r.get('Año Inauguración')),
                    'color_hex': sanitize_value(r.get('Color Hex')),
                    'project_id': raw_proj if raw_proj and raw_proj != 'nan' else None,
                    'project_ids': proj_list
                })
            print(f"  -> {len(metro_stations)} estaciones cargadas desde 'Estaciones'")
        except Exception as e_est:
            print(f"  AVISO: No se pudo cargar hoja 'Estaciones': {e_est}")

        # ── Cargar Hoja: Comunas (Datos Demográficos y Cálculo Automático de Cobertura) ──
        metro_communes = []
        try:
            df_com = pd.read_excel(METRO_EXCEL_PATH, sheet_name='Comunas')
            
            # Construir diccionarios automáticos desde metro_stations (Estaciones Operativas y En Proyecto)
            st_op_by_comuna = {}
            st_future_by_comuna = {}
            lines_by_comuna = {}
            proj_by_comuna = {}

            for st in metro_stations:
                st_coms = st.get('communes', [])
                st_status = str(st.get('status', '')).strip()
                st_lines = st.get('lines', [])
                if not st_lines and st.get('line'):
                    st_lines = [st.get('line')]
                
                is_future = (st_status == 'En Proyecto / Construcción') or \
                            ('proyecto' in st_status.lower()) or \
                            ('construcci' in st_status.lower() and st_status != 'Operativa')

                for c in st_coms:
                    cn = _normalize_col(c)
                    if st_status == 'Operativa':
                        st_op_by_comuna[cn] = st_op_by_comuna.get(cn, 0) + 1
                        if cn not in lines_by_comuna:
                            lines_by_comuna[cn] = set()
                        lines_by_comuna[cn].update(st_lines)
                    elif is_future:
                        st_future_by_comuna[cn] = st_future_by_comuna.get(cn, 0) + 1
                        if cn not in proj_by_comuna:
                            proj_by_comuna[cn] = set()
                        proj_by_comuna[cn].update(st_lines)

            # Diccionario auxiliar de Provincias del Gran Santiago
            PROVINCIAS_MAP = {
                'puente alto': 'Cordillera', 'pirque': 'Cordillera', 'san jose de maipo': 'Cordillera',
                'san bernardo': 'Maipo', 'calera de tango': 'Maipo',
                'colina': 'Chacabuco', 'lampa': 'Chacabuco',
                'padre hurtado': 'Talagante', 'penaflor': 'Talagante'
            }

            for _, r in df_com.iterrows():
                c_name = str(r.get('Comuna', '')).strip()
                if not c_name or c_name == 'nan':
                    continue
                cn = _normalize_col(c_name)
                
                # Obtener población y superficie con nombres de columnas flexibles
                pob_val = r.get('Población', r.get('Población (Habitantes)', r.get('Poblacion', 0)))
                pob = int(pob_val) if pd.notna(pob_val) else 0
                
                sup_val = r.get('Superficie (km²)', r.get('Superficie', r.get('Superficie (km2)', r.get('Área', r.get('Area', 0.0)))))
                sup = float(sup_val) if pd.notna(sup_val) else 0.0
                
                # Densidad calculada automáticamente
                den_val = r.get('Densidad (hab/km²)', r.get('Densidad'))
                den = float(den_val) if pd.notna(den_val) else (round(pob / sup, 1) if sup > 0 else 0.0)
                
                # Estaciones calculadas automáticamente desde metro_stations si no vienen en Excel
                est_val = r.get('Estaciones Metro', r.get('Estaciones'))
                est = int(est_val) if pd.notna(est_val) else st_op_by_comuna.get(cn, 0)
                
                # Estaciones futuras calculadas desde metro_stations (Estado == 'En Proyecto / Construcción')
                fut_val = r.get('Estaciones Futuras', r.get('Estaciones Proyecto'))
                fut_est = int(fut_val) if pd.notna(fut_val) else st_future_by_comuna.get(cn, 0)
                tot_est = est + fut_est

                # Líneas operativas inferidas de las estaciones
                lin_val = r.get('Líneas que Conectan', r.get('Líneas'))
                if pd.notna(lin_val) and str(lin_val).strip() and str(lin_val).strip() != 'nan':
                    lin_list = [l.strip() for l in str(lin_val).split(',') if l.strip()]
                else:
                    lin_list = sorted(list(lines_by_comuna.get(cn, set())))
                    
                # Proyectos futuros
                proy_val = r.get('Proyectos Futuros', r.get('Proyectos'))
                if pd.notna(proy_val) and str(proy_val).strip() and str(proy_val).strip() != 'nan':
                    proy_list = [p.strip() for p in str(proy_val).split(',') if p.strip()]
                else:
                    proy_list = sorted(list(proj_by_comuna.get(cn, set())))
                    
                # Estado Metro calculado automáticamente
                status_val = r.get('Estado Metro', r.get('Estado'))
                if pd.notna(status_val) and str(status_val).strip() and str(status_val).strip() != 'nan':
                    metro_stat = str(status_val).strip()
                elif est > 0:
                    metro_stat = 'Servicio Activo'
                elif fut_est > 0 or len(proy_list) > 0 or cn in ['cerro navia', 'la pintana', 'renca', 'vitacura']:
                    metro_stat = 'En Expansión'
                else:
                    metro_stat = 'Sin Cobertura'

                hab_per_st = round(pob / est) if est > 0 else None
                hab_per_st_future = round(pob / tot_est) if tot_est > 0 else None
                den_future = round(tot_est / sup, 2) if (sup > 0 and tot_est > 0) else (0.0 if tot_est > 0 else None)

                prov = str(r.get('Provincia', '')).strip()
                if not prov or prov == 'nan':
                    prov = PROVINCIAS_MAP.get(cn, 'Santiago')

                metro_communes.append({
                    'name': c_name,
                    'province': prov,
                    'population': pob,
                    'surface_km2': sup,
                    'density_hab_km2': den,
                    'metro_status': metro_stat,
                    'has_metro': est > 0,
                    'stations_count': est,
                    'stations_future': fut_est,
                    'stations_total': tot_est,
                    'network_km': float(r.get('Longitud Red (km)')) if pd.notna(r.get('Longitud Red (km)')) else 0.0,
                    'hab_per_station': hab_per_st,
                    'hab_per_station_future': hab_per_st_future,
                    'density_future_km2': den_future,
                    'lines': lin_list,
                    'future_projects': proy_list
                })
            print(f"  -> {len(metro_communes)} comunas cargadas/calculadas desde 'Comunas'")
        except Exception as e_com:
            print(f"  AVISO: No se pudo cargar hoja 'Comunas': {e_com}")

        # Mapa de colores oficiales cargados desde Excel
        metro_line_colors = {}
        for l in metro_lines:
            if l.get('line') and l.get('color_hex'):
                metro_line_colors[l['line']] = l['color_hex']
        for p in metro_projects:
            if p.get('line') and p.get('color_hex'):
                metro_line_colors[p['line']] = p['color_hex']

        # Estadísticas agregadas para gráficos
        tot_inv = sum([p['investment_mm_usd'] for p in metro_projects if p['investment_mm_usd'] is not None])
        tot_km = sum([p['length_km'] for p in metro_projects if p['length_km'] is not None])
        tot_est = sum([p['stations'] for p in metro_projects if p['stations'] is not None])

        by_class = {}
        for p in metro_projects:
            c = p['environmental_classification'] or 'Otros'
            by_class[c] = by_class.get(c, 0) + 1

        by_type = {}
        for p in metro_projects:
            t = p['type'] or 'Otros'
            by_type[t] = by_type.get(t, 0) + 1

        total_pob_gs = sum(c['population'] for c in metro_communes)
        pob_con_metro = sum(c['population'] for c in metro_communes if c['has_metro'])
        pob_en_exp = sum(c['population'] for c in metro_communes if c['metro_status'] == 'En Expansión')
        pob_sin_metro = sum(c['population'] for c in metro_communes if c['metro_status'] == 'Sin Cobertura')

        metro_payload = {
            'summary': {
                'total_projects': len(metro_projects),
                'total_investment_mm_usd': round(tot_inv, 1),
                'plan_expansion_total_mm_usd': 7649.18,
                'total_length_km': round(tot_km, 1),
                'total_stations': tot_est,
                'by_classification': by_class,
                'by_type': by_type,
                'current_network': {
                    'total_length_km': 143.0,
                    'total_stations': 143,
                    'total_communes': 27,
                    'trips_2025_mm': 661.0,
                    'daily_trips_2025_mm': 2.22,
                    'car_km_2025_mm': 166.25,
                    'punctuality_pct': 99.0,
                    'headway_avg_min': '1:40 min'
                },
                'demographics': {
                    'total_population': total_pob_gs,
                    'pop_with_metro': pob_con_metro,
                    'pop_in_expansion': pob_en_exp,
                    'pop_without_metro': pob_sin_metro,
                    'pct_pop_with_metro': round((pob_con_metro / total_pob_gs * 100), 1) if total_pob_gs > 0 else 0,
                    'pct_pop_in_expansion': round((pob_en_exp / total_pob_gs * 100), 1) if total_pob_gs > 0 else 0,
                    'pct_pop_without_metro': round((pob_sin_metro / total_pob_gs * 100), 1) if total_pob_gs > 0 else 0
                }
            },
            'data': metro_projects,
            'lines': metro_lines,
            'line_colors': metro_line_colors,
            'stations': metro_stations,
            'communes': metro_communes,
            'historical_demand': historical_demand,
            'operational_supply': operational_supply,
            'track_types': track_types,
            'operational_indicators': operational_indicators
        }

        out_metro_js = os.path.join(OUT_DIR, 'metro_data.js')
        metro_json = json.dumps(metro_payload, ensure_ascii=False, separators=(',', ':'))
        with open(out_metro_js, 'w', encoding='utf-8') as f:
            f.write(f'window.METRO_DATA = {metro_json};')

        size_metro = os.path.getsize(out_metro_js) / 1024
        print(f"OK Metro Generado: {out_metro_js} ({size_metro:.1f} KB)")
        print(f"   Proyectos Metro exportados: {len(metro_projects)}")
        print(f"   Líneas operativas exportadas: {len(metro_lines)}")
        print(f"   Estaciones exportadas: {len(metro_stations)}")
    else:
        print(f"[WARN] No se encontró el archivo Excel de Metro en {METRO_EXCEL_PATH}")

except Exception as e:
    print(f"[WARN] Error al exportar datos Metro: {e}")
    import traceback; traceback.print_exc()


