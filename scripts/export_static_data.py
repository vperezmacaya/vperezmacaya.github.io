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
PUERTOS_EXCEL_PATH = os.path.join(DATA_DIR, 'puertos.xlsx')
if not os.path.exists(PUERTOS_EXCEL_PATH):
    PUERTOS_EXCEL_PATH = os.path.join(BASE_DIR, 'puertos.xlsx')

EXCEL_PATH = DGC_EXCEL_PATH

OUT_DIR = os.path.join(BASE_DIR, 'static', 'data')
os.makedirs(OUT_DIR, exist_ok=True)

# ── Fotos: originales en Fotos/ (no versionada) → versiones web en static/img/fotos/
PHOTOS_SRC_DIR = os.path.join(BASE_DIR, 'Fotos')
PHOTOS_OUT_DIR = os.path.join(BASE_DIR, 'static', 'img', 'fotos')
PHOTO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
# Ancho de la foto en la ficha: el panel mide 500 px por defecto (ensanchable),
# así que 1024 px se ve nítido incluso en pantallas de densidad ×2.
PHOTO_CARD_WIDTH = 1024
# Ancho de la foto en el visor a pantalla completa (pantalla Full HD).
PHOTO_FULL_WIDTH = 1920
# Calidad WebP: sin artefactos visibles en fotografía y ~30 veces más liviano que el JPG original.
PHOTO_WEBP_QUALITY = 80

# ── Helpers ────────────────────────────────────────────────────────────────────

def optimize_photo(src_path, out_dir, variants):
    """Genera versiones WebP de una foto, redimensionadas al ancho en que se muestran.

    `variants` es una lista de (nombre_salida, ancho_máximo). Nunca agranda la foto,
    respeta la orientación EXIF y no vuelve a codificar una variante que ya es más
    nueva que el original. Devuelve la ruta web relativa de cada variante."""
    from PIL import Image, ImageOps

    os.makedirs(out_dir, exist_ok=True)
    src_mtime = os.path.getmtime(src_path)
    image = None
    paths = []
    for out_name, max_width in variants:
        out_path = os.path.join(out_dir, out_name)
        if not (os.path.exists(out_path) and os.path.getmtime(out_path) >= src_mtime):
            if image is None:
                image = ImageOps.exif_transpose(Image.open(src_path))
                has_alpha = image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info)
                image = image.convert('RGBA' if has_alpha else 'RGB')
            variant = image.copy()
            variant.thumbnail((max_width, variant.height), Image.LANCZOS)
            variant.save(out_path, 'WEBP', quality=PHOTO_WEBP_QUALITY, method=6)
            print(f"     · {out_name}: {variant.width}x{variant.height}, {os.path.getsize(out_path) / 1024:.0f} KB")
        paths.append(os.path.relpath(out_path, BASE_DIR).replace(os.sep, '/'))
    return paths

def prune_photo_dir(out_dir, keep_names):
    """Borra de una carpeta de fotos generadas (gestionada solo por el ETL) los
    archivos cuya foto original ya no existe."""
    if not os.path.exists(out_dir):
        return
    for f in os.listdir(out_dir):
        if f not in keep_names:
            os.remove(os.path.join(out_dir, f))
            print(f"     · eliminada {f} (sin foto original)")

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

def parse_dgc_shapes_list(val):
    if val is None:
        return []
    try:
        if pd.isna(val):
            return []
    except Exception:
        pass
    if isinstance(val, (int, np.integer)):
        return [int(val)]
    if isinstance(val, (float, np.floating)):
        if np.isnan(val):
            return []
        if val == int(val):
            return [int(val)]
        val_str = str(val)
        return [int(p.strip()) if p.strip().isdigit() else p.strip() for p in val_str.split('.') if p.strip()]
    if isinstance(val, str):
        cleaned_str = val.replace(';', ',')
        parts = []
        for p in cleaned_str.split(','):
            p = p.strip()
            if not p or p.lower() in ['none', 'nan', 'null']:
                continue
            if p.isdigit():
                parts.append(int(p))
            else:
                parts.append(p)
        return parts
    return []

def parse_efe_shapes_list(val):
    if val is None:
        return []
    try:
        if pd.isna(val):
            return []
    except Exception:
        pass
    if isinstance(val, (int, np.integer)):
        return [f"S-{val}"]
    if isinstance(val, (float, np.floating)):
        if np.isnan(val):
            return []
        if val == int(val):
            return [f"S-{int(val)}"]
        val_str = str(val)
        return [f"S-{p.strip()}" if p.strip().isdigit() else p.strip() for p in val_str.split('.') if p.strip()]
    if isinstance(val, str):
        cleaned_str = val.replace(';', ',')
        parts = []
        for p in cleaned_str.split(','):
            p = p.strip()
            if not p or p.lower() in ['none', 'nan', 'null']:
                continue
            if re.match(r'^\d+$', p):
                parts.append(f"S-{p}")
            else:
                parts.append(p)
        return parts
    return []

def read_excel_flexible_header(excel_path, sheet_name, required_keywords, header_candidates=(0, 1, 2, 3)):
    """Lee una hoja de Excel probando varias posiciones de fila de encabezado
    hasta encontrar una cuyas columnas contengan alguna de las keywords esperadas.
    Evita que insertar/quitar una fila de título arriba del encabezado real
    rompa silenciosamente la detección de columnas (mismo patrón usado para 'Estaciones')."""
    for h in header_candidates:
        try:
            df = pd.read_excel(excel_path, sheet_name=sheet_name, header=h)
        except Exception:
            continue
        cols_str = ' '.join([str(c).lower() for c in df.columns])
        if any(kw in cols_str for kw in required_keywords):
            return df
    # Fallback: si ninguna posición coincidió con las keywords, devolver la primera candidata igual
    return pd.read_excel(excel_path, sheet_name=sheet_name, header=header_candidates[0])

def parse_shapes_list(val):
    return parse_dgc_shapes_list(val)

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

# ── Fotos de referencia en Fotos/DGC (nombre de archivo = Código proyecto) ────
# Por cada foto se generan dos WebP: <código>.webp (ficha) y <código>_full.webp (visor).
DGC_PHOTOS_DIR = os.path.join(PHOTOS_SRC_DIR, 'DGC')
DGC_PHOTOS_OUT_DIR = os.path.join(PHOTOS_OUT_DIR, 'DGC')
DGC_PHOTOS_BY_CODE = {}
if os.path.exists(DGC_PHOTOS_DIR):
    for pf in sorted(os.listdir(DGC_PHOTOS_DIR)):
        base, ext = os.path.splitext(pf)
        code_key = base.strip().upper()
        if ext.lower() in PHOTO_EXTENSIONS and code_key not in DGC_PHOTOS_BY_CODE:
            card, full = optimize_photo(os.path.join(DGC_PHOTOS_DIR, pf), DGC_PHOTOS_OUT_DIR, [
                (f'{base.strip()}.webp', PHOTO_CARD_WIDTH),
                (f'{base.strip()}_full.webp', PHOTO_FULL_WIDTH),
            ])
            DGC_PHOTOS_BY_CODE[code_key] = {'photo': card, 'photo_full': full}
    print(f"  -> {len(DGC_PHOTOS_BY_CODE)} fotos detectadas en Fotos/DGC")
prune_photo_dir(DGC_PHOTOS_OUT_DIR, {os.path.basename(p) for v in DGC_PHOTOS_BY_CODE.values() for p in v.values()})

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
    photo_entry                 = DGC_PHOTOS_BY_CODE.get(code.strip().upper()) or {}
    sanitized['photo']          = photo_entry.get('photo')
    sanitized['photo_full']     = photo_entry.get('photo_full')
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

# ── EFE: Exportar datos de proyectos ferroviarios ──────────────────────────────
print(f"\nProcesando EFE desde: {EFE_EXCEL_PATH}...")

try:
    efe_excel_file = pd.ExcelFile(EFE_EXCEL_PATH)
    sheet_to_use = 'Proyectos' if 'Proyectos' in efe_excel_file.sheet_names else ('Proyectos Deduplicados' if 'Proyectos Deduplicados' in efe_excel_file.sheet_names else 'EFE')
    df_efe = pd.read_excel(EFE_EXCEL_PATH, sheet_name=sheet_to_use)
    print(f"  -> {len(df_efe)} filas cargadas en hoja '{sheet_to_use}'")
    print(f"  -> Columnas: {list(df_efe.columns)}")

    df_history = None
    if 'EFE' in efe_excel_file.sheet_names:
        df_history = pd.read_excel(EFE_EXCEL_PATH, sheet_name='EFE')
        print(f"  -> {len(df_history)} filas históricas cargadas desde hoja 'EFE'")

    # Escaneo de fotos en Fotos/EFE para cruce automático con proyectos
    # (cada foto se publica como WebP de ficha en static/img/fotos/EFE; EFE no tiene visor)
    efe_photos_dir = os.path.join(PHOTOS_SRC_DIR, 'EFE')
    efe_photos_out_dir = os.path.join(PHOTOS_OUT_DIR, 'EFE')
    efe_photo_files = []
    efe_photo_web_paths = {}
    if os.path.exists(efe_photos_dir):
        efe_photo_files = [f for f in sorted(os.listdir(efe_photos_dir)) if os.path.splitext(f)[1].lower() in PHOTO_EXTENSIONS]
        print(f"  -> {len(efe_photo_files)} fotos detectadas en Fotos/EFE: {efe_photo_files}")
        for pf in efe_photo_files:
            base, _ = os.path.splitext(pf)
            efe_photo_web_paths[pf] = optimize_photo(os.path.join(efe_photos_dir, pf), efe_photos_out_dir, [
                (f'{base}.webp', PHOTO_CARD_WIDTH),
            ])[0]
    prune_photo_dir(efe_photos_out_dir, {os.path.basename(p) for p in efe_photo_web_paths.values()})

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
        """Parse operation year from values like 2030, '2030 + ', '2030-2032', etc.
        Returns a string when the value contains '+' or a range ('-'),
        preserving the original format so the JS timeline can render
        open_range or range milestones. Otherwise returns an int."""
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return None
        s = str(val).strip()
        if not s:
            return None
        # Preserve formats like "2030+", "2030 +", "2030 - 2032"
        if re.search(r'\d{4}\s*\+', s) or re.search(r'\d{4}\s*[-–—]\s*\d{4}', s):
            return s
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
        id_str = None
        if id_val is not None and not pd.isna(id_val):
            raw_s = str(id_val).strip()
            if raw_s and raw_s.lower() != 'nan':
                if re.match(r'^\d+(\.0)?$', raw_s):
                    id_str = f"P-{int(float(raw_s))}"
                else:
                    id_str = raw_s

        # Construir historial (all_records)
        all_records = []
        if df_history is not None:
            if id_str is not None and col_id in df_history.columns:
                def _match_hid(val):
                    if val is None or pd.isna(val): return None
                    vs = str(val).strip()
                    return f"P-{int(float(vs))}" if re.match(r'^\d+(\.0)?$', vs) else vs
                h_rows = df_history[df_history[col_id].apply(_match_hid) == id_str]
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
        shapes = parse_efe_shapes_list(shapes_val)

        estaciones_col = 'Estaciones' if 'Estaciones' in latest_row.index else ('estaciones' if 'estaciones' in latest_row.index else None)
        stations = parse_efe_shapes_list(latest_row.get(estaciones_col)) if estaciones_col else []

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
        id_norm = _normalize_name_for_match(id_str)
        for pf in efe_photo_files:
            base, _ = os.path.splitext(pf)
            f_norm = _normalize_name_for_match(base)
            if (id_norm and f_norm == id_norm) or (f_norm == proj_norm) or (len(f_norm) > 8 and f_norm in proj_norm) or (len(proj_norm) > 8 and proj_norm in f_norm):
                matched_photos.append(efe_photo_web_paths[pf])

        photo = matched_photos[0] if matched_photos else None

        efe_projects.append({
            'id': id_str,
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

    # ── 1. Cargar Hoja Maestra: Líneas Operativas (Servicios Regulares de Pasajeros) ──
    efe_lines = []
    service_master = {}
    try:
        df_lines = read_excel_flexible_header(EFE_EXCEL_PATH, 'Líneas Operativas', ['servicio'], header_candidates=(2, 1, 0, 3))
        col_srv_id = next((c for c in df_lines.columns if 'id' in str(c).lower() and 'serv' in str(c).lower()), None)
        if not col_srv_id:
            col_srv_id = next((c for c in df_lines.columns if 'id' in str(c).lower()), 'ID Servicio')
        col_srv_name = next((c for c in df_lines.columns if 'servicio' in str(c).lower() and 'id' not in str(c).lower()), 'Servicio')

        for idx_l, r in df_lines.iterrows():
            serv_name = str(r.get(col_srv_name, '')).strip()
            if not serv_name or serv_name == 'nan':
                continue

            serv_id = str(r.get(col_srv_id, '')).strip() if col_srv_id in df_lines.columns else ''
            if not serv_id or serv_id.lower() == 'nan':
                serv_id = f"SRV-{idx_l+1:02d}"

            pax_val = r.get('Pasajeros 2025 (MM)')
            try:
                pax_2025 = float(pax_val) if pd.notna(pax_val) else None
            except Exception:
                pax_2025 = None

            sat_val = r.get('Satisfacción 2025 (%)')
            try:
                sat_2025 = float(sat_val) if pd.notna(sat_val) else None
            except Exception:
                sat_2025 = None

            km_val = r.get('Longitud (km)')
            try:
                km = float(km_val) if pd.notna(km_val) else 0.0
            except Exception:
                km = 0.0

            line_entry = {
                'id': serv_id,
                'service': serv_name,
                'filial': sanitize_value(r.get('Filial')),
                'operational_classification': sanitize_value(r.get('Clasificación Operacional')),
                'terminals': sanitize_value(r.get('Cabeceras / Trazado')),
                'length_km': km,
                'stations': 0,  # Se calcula dinámicamente con Estaciones
                'passengers_2025_mm': pax_2025,
                'demand_history': {},
                'satisfaction_2025_pct': sat_2025,
                'satisfaction_history': {},
                'travel_time_avg_min': int(r.get('Tiempo Promedio Viaje (min)')) if pd.notna(r.get('Tiempo Promedio Viaje (min)')) else None,
                'travel_time_total_min': int(r.get('Tiempo Total Trayecto (min)')) if pd.notna(r.get('Tiempo Total Trayecto (min)')) else None,
                'rolling_stock': sanitize_value(r.get('Material Rodante')),
                'traction': sanitize_value(r.get('Tracción / Alimentación')),
                'regions': sanitize_value(r.get('Regiones Conectadas')),
                'shapes': parse_efe_shapes_list(r.get('Shapes')),
                'source': sanitize_value(r.get('Fuente Memoria 2025'))
            }
            efe_lines.append(line_entry)
            service_master[serv_id] = line_entry
            # Registrar también sub-tokens si el ID es compuesto (ej. 'SRV-07;SRV-08' -> mapea también 'SRV-07' y 'SRV-08')
            for sub_id in serv_id.split(';'):
                sub_id_clean = sub_id.strip()
                if sub_id_clean and sub_id_clean not in service_master:
                    service_master[sub_id_clean] = line_entry

        print(f"  -> {len(efe_lines)} servicios regulares cargados desde 'Líneas Operativas' (Clave Maestra por ID Servicio)")
    except Exception as e_l:
        print(f"  AVISO: No se pudo cargar hoja 'Líneas Operativas' de EFE: {e_l}")

    # ── 2. Cargar Hoja: Satisfacción Histórica (Cruzada 100% por ID Servicio) ──
    sat_years = []
    try:
        if 'Satisfacción Histórica' in efe_excel_file.sheet_names:
            df_sat = read_excel_flexible_header(EFE_EXCEL_PATH, 'Satisfacción Histórica', ['id', 'servicio'])
            col_sat_id = next((c for c in df_sat.columns if 'id' in str(c).lower()), 'ID Servicio')

            # Detectar dinámicamente columnas de año (ej. 2018, 2019, ..., 2025)
            found_sat_years = []
            for col in df_sat.columns:
                col_str = str(col).strip()
                if col_str.isdigit() and len(col_str) == 4:
                    found_sat_years.append(col_str)
            sat_years = sorted(list(set(found_sat_years)), key=lambda y: int(y))
            if not sat_years:
                sat_years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025']

            # 'Satisfacción Histórica' es la única fuente de verdad para la satisfacción.
            # Se resetea en service_master para que cualquier servicio eliminado de esta hoja quede en None.
            for s_entry in service_master.values():
                s_entry['satisfaction_2025_pct'] = None
                s_entry['satisfaction_history'] = {}

            latest_sat_year = sat_years[-1] if sat_years else '2025'

            for _, r_sat in df_sat.iterrows():
                sid = str(r_sat.get(col_sat_id) or '').strip()
                if not sid or sid.lower() == 'nan':
                    continue

                hist_map = {}
                for yr in sat_years:
                    val = r_sat.get(yr) if yr in df_sat.columns else r_sat.get(int(yr))
                    if pd.notna(val):
                        try:
                            hist_map[yr] = float(val)
                        except Exception:
                            hist_map[yr] = None
                    else:
                        hist_map[yr] = None

                # Cruzar por ID de servicio operativo (SRV-XX o compuesto ej. SRV-07;SRV-08) con Líneas Operativas
                target_entry = service_master.get(sid)
                if not target_entry:
                    for sub_id in sid.split(';'):
                        if sub_id.strip() in service_master:
                            target_entry = service_master[sub_id.strip()]
                            break
                if target_entry:
                    target_entry['satisfaction_history'] = hist_map
                    if hist_map.get(latest_sat_year) is not None:
                        target_entry['satisfaction_2025_pct'] = hist_map[latest_sat_year]

            print(f"  -> Satisfacción histórica cargada y cruzada por ID ({len(sat_years)} años: {', '.join(sat_years)})")
    except Exception as e_sat:
        print(f"  AVISO: No se pudo cargar hoja 'Satisfacción Histórica': {e_sat}")

    # ── 3. Cargar Hoja: Demanda Histórica por Filial (Dinámica por Años) ──
    demand_summary = {}
    demand_filiales = []
    demand_years = []
    try:
        if 'Demanda Histórica' in efe_excel_file.sheet_names:
            df_dem = read_excel_flexible_header(EFE_EXCEL_PATH, 'Demanda Histórica', ['filial'])
            col_fil = next((c for c in df_dem.columns if 'filial' in str(c).lower()), df_dem.columns[0])

            # Detectar dinámicamente columnas de año (ej. 2018, 2019, ..., 2025)
            found_years = []
            for col in df_dem.columns:
                col_str = str(col).strip()
                if col_str.isdigit() and len(col_str) == 4:
                    found_years.append(col_str)
            demand_years = sorted(list(set(found_years)), key=lambda y: int(y))
            if not demand_years:
                demand_years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025']

            for _, r_dem in df_dem.iterrows():
                f_name = str(r_dem.get(col_fil) or '').strip()
                if not f_name or f_name.lower() == 'nan' or 'total' in f_name.lower():
                    continue

                hist_map = {}
                for yr in demand_years:
                    val = r_dem.get(yr) if yr in df_dem.columns else r_dem.get(int(yr))
                    if pd.notna(val):
                        try:
                            hist_map[yr] = round(float(val), 2)
                        except Exception:
                            hist_map[yr] = None
                    else:
                        hist_map[yr] = None

                demand_summary[f_name] = hist_map
                if f_name not in demand_filiales:
                    demand_filiales.append(f_name)

            print(f"  -> Demanda histórica por filial cargada ({len(demand_filiales)} filiales, {len(demand_years)} años: {', '.join(demand_years)})")
    except Exception as e_dem:
        print(f"  AVISO: No se pudo cargar hoja 'Demanda Histórica': {e_dem}")

    # ── 4. Cargar Hoja: Estaciones (Resolviendo nombres desde ID Servicio) ──
    efe_stations = []
    try:
        df_est = None
        for h in [2, 1, 0]:
            try:
                temp_df = pd.read_excel(EFE_EXCEL_PATH, sheet_name='Estaciones', header=h)
                cols_str = ' '.join([str(c).lower() for c in temp_df.columns])
                if 'estaci' in cols_str or 'id' in cols_str:
                    df_est = temp_df
                    break
            except Exception:
                pass

        if df_est is not None:
            col_id = next((c for c in df_est.columns if 'id' in str(c).lower() and 'estaci' in str(c).lower()), 'ID Estación')
            if col_id not in df_est.columns:
                col_id = next((c for c in df_est.columns if 'id' in str(c).lower()), 'ID Estación')
            col_name = next((c for c in df_est.columns if 'nombre' in str(c).lower()), 'Nombre Estación')
            col_serv = next((c for c in df_est.columns if 'servicio' in str(c).lower()), 'ID Servicio')
            col_proj = next((c for c in df_est.columns if 'proyecto' in str(c).lower()), 'ID Proyecto')
            col_op = next((c for c in df_est.columns if 'operacion' in str(c).lower() or 'operación' in str(c).lower()), 'En Operacion')

            for _, r in df_est.iterrows():
                st_id = str(r.get(col_id) or '').strip()
                st_name = str(r.get(col_name) or '').strip()
                if not st_id or st_id.lower() == 'nan' or 'id estaci' in st_id.lower():
                    continue

                srv_raw = r.get(col_serv)
                srv_ids = []
                srv_names = []
                if pd.notna(srv_raw) and str(srv_raw).strip() and str(srv_raw).lower() != 'nan':
                    tokens = [s.strip().replace('\u2013', '-').replace('\u2014', '-') for s in re.split(r'[,;/·\n]', str(srv_raw)) if s.strip()]
                    for tok in tokens:
                        if tok in service_master:
                            srv_ids.append(tok)
                            srv_names.append(service_master[tok]['service'])
                        else:
                            # Fallback por coincidencia de nombre si se usó texto
                            matched_by_name = False
                            for sid, sinfo in service_master.items():
                                if sinfo['service'].lower() == tok.lower():
                                    srv_ids.append(sid)
                                    srv_names.append(sinfo['service'])
                                    matched_by_name = True
                                    break
                            if not matched_by_name:
                                srv_names.append(tok)

                proj_raw = r.get(col_proj)
                proj_list = []
                if pd.notna(proj_raw) and str(proj_raw).strip() and str(proj_raw).lower() != 'nan':
                    for p in re.split(r'[,;/\n]', str(proj_raw)):
                        p_clean = str(p).strip()
                        if p_clean and p_clean.lower() != 'nan':
                            if re.match(r'^\d+(\.0)?$', p_clean):
                                p_clean = f"P-{int(float(p_clean))}"
                            proj_list.append(p_clean)

                op_raw = str(r.get(col_op) or '').strip().lower() if col_op in df_est.columns else ''
                in_op = op_raw in ['si', 'sí', 'true', '1', 'yes'] or (not op_raw and len(srv_names) > 0)

                efe_stations.append({
                    'id': st_id,
                    'name': st_name,
                    'service_ids': srv_ids,
                    'services': srv_names,
                    'project_ids': proj_list,
                    'in_operation': in_op
                })
            print(f"  -> {len(efe_stations)} estaciones de pasajeros cargadas desde 'Estaciones' ({sum(1 for s in efe_stations if s['in_operation'])} en operación)")
    except Exception as e_est:
        print(f"  AVISO: No se pudo cargar hoja 'Estaciones' de EFE: {e_est}")

    # ── 4. Conteo dinámico de estaciones por servicio ──
    for line in efe_lines:
        lid = str(line.get('id') or '')
        l_tokens = [t.strip() for t in lid.split(';') if t.strip()]
        lname = line.get('service', '').lower()
        cnt = sum(1 for st in efe_stations if (
            any(t in st.get('service_ids', []) for t in l_tokens) or
            lid in st.get('service_ids', []) or
            lname in [s.lower() for s in st.get('services', [])]
        ))
        line['stations'] = cnt

    efe_payload = {
        'data': efe_projects,
        'lines': efe_lines,
        'stations': efe_stations,
        'demand_summary': demand_summary,
        'demand_filiales': demand_filiales,
        'demand_years': demand_years
    }
    out_efe_js = os.path.join(OUT_DIR, 'efe_data.js')
    efe_json_str = json.dumps(efe_payload, ensure_ascii=False, indent=None, separators=(',', ':'))
    with open(out_efe_js, 'w', encoding='utf-8') as f:
        f.write(f'window.EFE_DATA = {efe_json_str};')

    size_efe_mb = os.path.getsize(out_efe_js) / 1024 / 1024
    print(f"OK EFE Generado: {out_efe_js} ({size_efe_mb:.3f} MB)")
    print(f"   Proyectos EFE exportados: {len(efe_projects)} (deduplicados de {len(df_efe)} registros)")
    print(f"   Servicios regulares de pasajeros exportados: {len(efe_lines)}")
    print(f"   Estaciones de pasajeros exportadas: {len(efe_stations)}")

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
        df_metro = read_excel_flexible_header(METRO_EXCEL_PATH, 'Proyectos Metro', ['id proyecto'], header_candidates=(2, 1, 0, 3))
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
                'communes_list': [c.strip() for c in str(row.get('Comunas', '')).split(';') if c.strip()] if row.get('Comunas') and str(row.get('Comunas')).strip().lower() != 'nan' else [],
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
            df_lines = read_excel_flexible_header(METRO_EXCEL_PATH, 'Líneas Operativas', ['terminales'], header_candidates=(2, 1, 0, 3))
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
            historical_demand.sort(key=lambda d: d['year'])
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
            operational_supply.sort(key=lambda d: d['year'])
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

        # ── Cargar Hoja: Confiabilidad y Averías (años detectados dinámicamente) ──
        operational_indicators = []
        operational_indicator_years = []
        try:
            df_ind = pd.read_excel(METRO_EXCEL_PATH, sheet_name='Confiabilidad y Averías')

            # Detectar dinámicamente las columnas de año (numéricas o strings de 4 dígitos, ej. 2019, '2025')
            ind_year_cols = [c for c in df_ind.columns if re.match(r'^\d{4}(\.0)?$', str(c).strip())]
            ind_year_cols.sort(key=lambda c: int(float(str(c))))
            operational_indicator_years = [str(int(float(str(c)))) for c in ind_year_cols]

            for _, r in df_ind.iterrows():
                ind_name = str(r.get('Indicador de Desempeño', '')).strip()
                if ind_name and ind_name != 'nan':
                    values = {}
                    for col in ind_year_cols:
                        year_key = str(int(float(str(col))))
                        val = r.get(col)
                        values[year_key] = float(val) if pd.notna(val) else None
                    operational_indicators.append({
                        'indicator': ind_name,
                        'values': values
                    })
            print(f"  -> {len(operational_indicators)} indicadores cargados desde 'Confiabilidad y Averías' ({len(operational_indicator_years)} años: {', '.join(operational_indicator_years)})")
        except Exception as e_i:
            print(f"  AVISO: No se pudo cargar hoja 'Confiabilidad y Averías': {e_i}")

        # ── Cargar Hoja: Estaciones ──
        metro_stations = []
        try:
            df_est = read_excel_flexible_header(METRO_EXCEL_PATH, 'Estaciones', ['código shape', 'nombre estaci'], header_candidates=(2, 1, 0, 3))
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

            # Proyectos futuros por comuna, derivados de la columna 'Comunas' en 'Proyectos Metro'
            # (independiente de si la hoja 'Estaciones' ya tiene filas para ese proyecto)
            future_projects_by_comuna = {}
            for p in metro_projects:
                for c in p.get('communes_list', []):
                    ck = _normalize_col(c)
                    future_projects_by_comuna.setdefault(ck, [])
                    if p['name'] not in future_projects_by_comuna[ck]:
                        future_projects_by_comuna[ck].append(p['name'])

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
                    if not proy_list:
                        proy_list = future_projects_by_comuna.get(cn, [])

                # Estado Metro calculado automáticamente
                status_val = r.get('Estado Metro', r.get('Estado'))
                if pd.notna(status_val) and str(status_val).strip() and str(status_val).strip() != 'nan':
                    metro_stat = str(status_val).strip()
                elif est > 0:
                    metro_stat = 'Servicio Activo'
                elif fut_est > 0 or len(proy_list) > 0 or cn in future_projects_by_comuna:
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
            'operational_indicators': operational_indicators,
            'operational_indicator_years': operational_indicator_years
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


# ==============================================================================
# ── Exportar Datos Puertos (Región del Biobío) ─────────────────────────────────
# ==============================================================================
try:
    if os.path.exists(PUERTOS_EXCEL_PATH):
        print(f"\n[INFO] Procesando datos de Puertos desde {PUERTOS_EXCEL_PATH}...")

        def _clean_float(val):
            if pd.isna(val):
                return 0.0
            try:
                v = float(val)
                return 0.0 if (np.isnan(v) or np.isinf(v)) else round(v, 2)
            except Exception:
                return 0.0

        def _get_sheet_df(excel_path, sheet_name):
            df = pd.read_excel(excel_path, sheet_name=sheet_name, header=None)
            h_idx = None
            for i, r in df.iterrows():
                if any('Año' in str(x) or 'Ao' in str(x) for x in r.values):
                    h_idx = i
                    break
            if h_idx is None:
                return pd.DataFrame()
            df_data = df.iloc[h_idx+1:].copy()
            df_data = df_data[pd.to_numeric(df_data.iloc[:, 0], errors='coerce').notnull()].copy()
            return df_data

        # 1. Carga Total
        df_carga = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Carga Total')
        carga_total_series = []
        for _, r in df_carga.iterrows():
            carga_total_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'embarcada_exterior': _clean_float(r.iloc[3]),
                'desembarcada_exterior': _clean_float(r.iloc[4]),
                'cabotaje': _clean_float(r.iloc[5]),
                'reestibas_transbordos': _clean_float(r.iloc[6]),
                'transito': _clean_float(r.iloc[7]),
                'var_12m': _clean_float(r.iloc[8]),
                'var_acum': _clean_float(r.iloc[9]) if len(r) > 9 else 0.0
            })

        # 2. TEUS
        df_teus = _get_sheet_df(PUERTOS_EXCEL_PATH, 'TEUS')
        teus_series = []
        for _, r in df_teus.iterrows():
            teus_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'contenedores_20': _clean_float(r.iloc[2]),
                'contenedores_40': _clean_float(r.iloc[3]),
                'teus': _clean_float(r.iloc[4]),
                'var_12m': _clean_float(r.iloc[5]),
                'var_acum': _clean_float(r.iloc[6]) if len(r) > 6 else 0.0
            })

        # 3. Embarcada
        df_emb = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Embarcada')
        embarcada_series = []
        for _, r in df_emb.iterrows():
            embarcada_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'suelta_general': _clean_float(r.iloc[3]),
                'contenedores': _clean_float(r.iloc[4]),
                'granel_solido': _clean_float(r.iloc[5]),
                'granel_liquido_gaseoso': _clean_float(r.iloc[6]),
                'var_12m': _clean_float(r.iloc[7]),
                'var_acum': _clean_float(r.iloc[8]) if len(r) > 8 else 0.0
            })

        # 4. Desembarcada
        df_desemb = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Desembarcada')
        desembarcada_series = []
        for _, r in df_desemb.iterrows():
            desembarcada_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'suelta_general': _clean_float(r.iloc[3]),
                'contenedores': _clean_float(r.iloc[4]),
                'granel_solido': _clean_float(r.iloc[5]),
                'granel_liquido_gaseoso': _clean_float(r.iloc[6]),
                'var_12m': _clean_float(r.iloc[7]),
                'var_acum': _clean_float(r.iloc[8]) if len(r) > 8 else 0.0
            })

        # 5. Cabotaje
        df_cabot = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Cabotaje')
        cabotaje_series = []
        for _, r in df_cabot.iterrows():
            cabotaje_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'embarcada': _clean_float(r.iloc[3]),
                'desembarcada': _clean_float(r.iloc[4]),
                'var_12m': _clean_float(r.iloc[5]),
                'var_acum': _clean_float(r.iloc[6]) if len(r) > 6 else 0.0
            })

        # 6. Contenedores 20 pies
        df_c20 = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Contenedores 20 pies')
        contenedores_20_series = []
        for _, r in df_c20.iterrows():
            contenedores_20_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'embarcados': _clean_float(r.iloc[3]),
                'desembarcados': _clean_float(r.iloc[4]),
                'reestibas_transbordos': _clean_float(r.iloc[5]),
                'cabotaje_transitos': _clean_float(r.iloc[6]),
                'var_12m': _clean_float(r.iloc[7]),
                'var_acum': _clean_float(r.iloc[8]) if len(r) > 8 else 0.0
            })

        # 7. Contenedores 40 pies
        df_c40 = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Contenedores 40 pies')
        contenedores_40_series = []
        for _, r in df_c40.iterrows():
            contenedores_40_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'embarcados': _clean_float(r.iloc[3]),
                'desembarcados': _clean_float(r.iloc[4]),
                'reestibas_transbordos': _clean_float(r.iloc[5]),
                'cabotaje_transitos': _clean_float(r.iloc[6]),
                'var_12m': _clean_float(r.iloc[7]),
                'var_acum': _clean_float(r.iloc[8]) if len(r) > 8 else 0.0
            })

        # 8. Re-estibas y Transbordos
        df_reest = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Re-estibas y Transbordos')
        reestibas_series = []
        for _, r in df_reest.iterrows():
            reestibas_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'reestibas': _clean_float(r.iloc[3]),
                'transbordos': _clean_float(r.iloc[4]),
                'var_12m': _clean_float(r.iloc[5]),
                'var_acum': _clean_float(r.iloc[6]) if len(r) > 6 else 0.0
            })

        # 9. Transito
        df_trans = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Transito')
        transito_series = []
        for _, r in df_trans.iterrows():
            transito_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'embarcada': _clean_float(r.iloc[3]),
                'desembarcada': _clean_float(r.iloc[4]),
                'var_12m': _clean_float(r.iloc[5]),
                'var_acum': _clean_float(r.iloc[6]) if len(r) > 6 else 0.0
            })

        # 10. Plaza de Peaje
        df_peaje = _get_sheet_df(PUERTOS_EXCEL_PATH, 'Plaza de Peaje')
        peaje_series = []
        for _, r in df_peaje.iterrows():
            peaje_series.append({
                'anio': int(r.iloc[0]),
                'mes': int(r.iloc[1]),
                'total': _clean_float(r.iloc[2]),
                'camiones_2_ejes': _clean_float(r.iloc[3]),
                'camiones_3_mas_ejes': _clean_float(r.iloc[4]),
                'var_12m': _clean_float(r.iloc[5]),
                'var_acum': _clean_float(r.iloc[6]) if len(r) > 6 else 0.0
            })

        # ── Resúmenes Anuales ──────────────────────────────────────────────────
        years = sorted(list(set(x['anio'] for x in carga_total_series)))
        annual_aggregates = []
        for yr in years:
            yr_carga = [x for x in carga_total_series if x['anio'] == yr]
            yr_teus = [x for x in teus_series if x['anio'] == yr]
            yr_emb = [x for x in embarcada_series if x['anio'] == yr]
            yr_desemb = [x for x in desembarcada_series if x['anio'] == yr]
            yr_cab = [x for x in cabotaje_series if x['anio'] == yr]
            yr_c20 = [x for x in contenedores_20_series if x['anio'] == yr]
            yr_c40 = [x for x in contenedores_40_series if x['anio'] == yr]
            yr_reest = [x for x in reestibas_series if x['anio'] == yr]
            yr_trans = [x for x in transito_series if x['anio'] == yr]
            yr_peaje = [x for x in peaje_series if x['anio'] == yr]

            # Carga total
            c_tot = round(sum(x['total'] for x in yr_carga), 2)
            c_emb_ext = round(sum(x['embarcada_exterior'] for x in yr_carga), 2)
            c_desemb_ext = round(sum(x['desembarcada_exterior'] for x in yr_carga), 2)
            c_cab = round(sum(x['cabotaje'] for x in yr_carga), 2)
            c_reest = round(sum(x['reestibas_transbordos'] for x in yr_carga), 2)
            c_trans = round(sum(x['transito'] for x in yr_carga), 2)

            # TEUS
            t_teus = round(sum(x['teus'] for x in yr_teus), 2)
            t_c20 = round(sum(x['contenedores_20'] for x in yr_teus), 2)
            t_c40 = round(sum(x['contenedores_40'] for x in yr_teus), 2)

            # Tipologia Embarcada
            emb_suelta = round(sum(x['suelta_general'] for x in yr_emb), 2)
            emb_cont = round(sum(x['contenedores'] for x in yr_emb), 2)
            emb_solido = round(sum(x['granel_solido'] for x in yr_emb), 2)
            emb_liq = round(sum(x['granel_liquido_gaseoso'] for x in yr_emb), 2)

            # Tipologia Desembarcada
            des_suelta = round(sum(x['suelta_general'] for x in yr_desemb), 2)
            des_cont = round(sum(x['contenedores'] for x in yr_desemb), 2)
            des_solido = round(sum(x['granel_solido'] for x in yr_desemb), 2)
            des_liq = round(sum(x['granel_liquido_gaseoso'] for x in yr_desemb), 2)

            # Contenedores manejo (20 + 40)
            c20_emb = round(sum(x['embarcados'] for x in yr_c20), 2)
            c20_des = round(sum(x['desembarcados'] for x in yr_c20), 2)
            c20_reest = round(sum(x['reestibas_transbordos'] for x in yr_c20), 2)
            c20_cab_trans = round(sum(x['cabotaje_transitos'] for x in yr_c20), 2)

            c40_emb = round(sum(x['embarcados'] for x in yr_c40), 2)
            c40_des = round(sum(x['desembarcados'] for x in yr_c40), 2)
            c40_reest = round(sum(x['reestibas_transbordos'] for x in yr_c40), 2)
            c40_cab_trans = round(sum(x['cabotaje_transitos'] for x in yr_c40), 2)

            # Peaje
            pj_tot = round(sum(x['total'] for x in yr_peaje), 2)
            pj_2ejes = round(sum(x['camiones_2_ejes'] for x in yr_peaje), 2)
            pj_3ejes = round(sum(x['camiones_3_mas_ejes'] for x in yr_peaje), 2)

            # Reestibas vs Transbordos
            reest_reest = round(sum(x['reestibas'] for x in yr_reest), 2)
            reest_transb = round(sum(x['transbordos'] for x in yr_reest), 2)

            annual_aggregates.append({
                'anio': yr,
                'meses_registrados': len(yr_carga),
                'carga_total': c_tot,
                'carga_embarcada_ext': c_emb_ext,
                'carga_desembarcada_ext': c_desemb_ext,
                'carga_cabotaje': c_cab,
                'carga_reestibas_transbordos': c_reest,
                'carga_transito': c_trans,
                'teus_total': t_teus,
                'contenedores_20_unidades': t_c20,
                'contenedores_40_unidades': t_c40,
                'emb_suelta': emb_suelta,
                'emb_contenedores': emb_cont,
                'emb_granel_solido': emb_solido,
                'emb_granel_liquido': emb_liq,
                'des_suelta': des_suelta,
                'des_contenedores': des_cont,
                'des_granel_solido': des_solido,
                'des_granel_liquido': des_liq,
                'cont_embarcados_total': c20_emb + c40_emb,
                'cont_desembarcados_total': c20_des + c40_des,
                'cont_reestibas_total': c20_reest + c40_reest,
                'cont_cabotaje_transito_total': c20_cab_trans + c40_cab_trans,
                'peaje_total_pasadas': pj_tot,
                'peaje_camiones_2ejes': pj_2ejes,
                'peaje_camiones_3mas_ejes': pj_3ejes,
                'reestibas_ton': reest_reest,
                'transbordos_ton': reest_transb
            })

        # Calcular variaciones anuales
        for i in range(len(annual_aggregates)):
            if i == 0:
                annual_aggregates[i]['var_anual_carga_pct'] = 0.0
                annual_aggregates[i]['var_anual_teus_pct'] = 0.0
            else:
                prev = annual_aggregates[i-1]
                curr = annual_aggregates[i]
                # Para años completos o comparables
                if prev['carga_total'] > 0 and curr['meses_registrados'] == 12 and prev['meses_registrados'] == 12:
                    curr['var_anual_carga_pct'] = round(((curr['carga_total'] - prev['carga_total']) / prev['carga_total']) * 100, 2)
                    curr['var_anual_teus_pct'] = round(((curr['teus_total'] - prev['teus_total']) / prev['teus_total']) * 100, 2)
                else:
                    curr['var_anual_carga_pct'] = 0.0
                    curr['var_anual_teus_pct'] = 0.0

        # Estacionalidad Mensual Promedio (2019 - 2025)
        monthly_seasonality = []
        month_names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        for m in range(1, 13):
            m_cargas = [x['total'] for x in carga_total_series if x['mes'] == m and x['anio'] < 2026]
            m_teus = [x['teus'] for x in teus_series if x['mes'] == m and x['anio'] < 2026]
            m_peaje = [x['total'] for x in peaje_series if x['mes'] == m and x['anio'] < 2026]
            monthly_seasonality.append({
                'mes_num': m,
                'mes_nombre': month_names[m-1],
                'avg_carga_ton': round(sum(m_cargas) / len(m_cargas), 2) if m_cargas else 0,
                'avg_teus': round(sum(m_teus) / len(m_teus), 2) if m_teus else 0,
                'avg_peajes': round(sum(m_peaje) / len(m_peaje), 2) if m_peaje else 0
            })

        # KPIs Globales
        tot_carga_hist = sum(x['carga_total'] for x in annual_aggregates)
        full_years_count = sum(1 for x in annual_aggregates if x['meses_registrados'] == 12)
        full_years_carga = sum(x['carga_total'] for x in annual_aggregates if x['meses_registrados'] == 12)
        avg_carga_anual = round(full_years_carga / full_years_count, 2) if full_years_count > 0 else 0

        tot_teus_hist = sum(x['teus_total'] for x in annual_aggregates)
        full_years_teus = sum(x['teus_total'] for x in annual_aggregates if x['meses_registrados'] == 12)
        avg_teus_anual = round(full_years_teus / full_years_count, 2) if full_years_count > 0 else 0

        kpis = {
            'total_carga_historica_ton': round(tot_carga_hist, 2),
            'avg_carga_anual_ton': avg_carga_anual,
            'total_teus_historico': round(tot_teus_hist, 2),
            'avg_teus_anual': avg_teus_anual,
            'total_embarcada_exterior_ton': round(sum(x['carga_embarcada_ext'] for x in annual_aggregates), 2),
            'total_desembarcada_exterior_ton': round(sum(x['carga_desembarcada_ext'] for x in annual_aggregates), 2),
            'total_cabotaje_ton': round(sum(x['carga_cabotaje'] for x in annual_aggregates), 2),
            'total_transito_ton': round(sum(x['carga_transito'] for x in annual_aggregates), 2),
            'total_reestibas_transbordos_ton': round(sum(x['carga_reestibas_transbordos'] for x in annual_aggregates), 2),
            'total_granel_solido_ton': round(sum(x['emb_granel_solido'] + x['des_granel_solido'] for x in annual_aggregates), 2),
            'total_granel_liquido_ton': round(sum(x['emb_granel_liquido'] + x['des_granel_liquido'] for x in annual_aggregates), 2),
            'total_contenedores_ton': round(sum(x['emb_contenedores'] + x['des_contenedores'] for x in annual_aggregates), 2),
            'total_carga_suelta_ton': round(sum(x['emb_suelta'] + x['des_suelta'] for x in annual_aggregates), 2),
            'total_peaje_pasadas': round(sum(x['peaje_total_pasadas'] for x in annual_aggregates), 2),
            'total_peaje_camiones_2ejes': round(sum(x['peaje_camiones_2ejes'] for x in annual_aggregates), 2),
            'total_peaje_camiones_3mas_ejes': round(sum(x['peaje_camiones_3mas_ejes'] for x in annual_aggregates), 2),
            'total_c20_unidades': round(sum(x['contenedores_20_unidades'] for x in annual_aggregates), 2),
            'total_c40_unidades': round(sum(x['contenedores_40_unidades'] for x in annual_aggregates), 2)
        }

        puertos_payload = {
            'metadata': {
                'region': 'Región del Biobío',
                'fuente': 'INE - Encuesta Directa a Puertos de la Región del Biobío',
                'periodo_inicio': f"{carga_total_series[0]['anio']}-01",
                'periodo_fin': f"{carga_total_series[-1]['anio']}-{carga_total_series[-1]['mes']:02d}",
                'anios_disponibles': years,
                'total_meses': len(carga_total_series)
            },
            'kpis': kpis,
            'annual_aggregates': annual_aggregates,
            'monthly_seasonality': monthly_seasonality,
            'series': {
                'carga_total': carga_total_series,
                'teus': teus_series,
                'embarcada': embarcada_series,
                'desembarcada': desembarcada_series,
                'cabotaje': cabotaje_series,
                'contenedores_20': contenedores_20_series,
                'contenedores_40': contenedores_40_series,
                'reestibas_transbordos': reestibas_series,
                'transito': transito_series,
                'plaza_peaje': peaje_series
            }
        }

        out_puertos_js = os.path.join(OUT_DIR, 'puertos_data.js')
        puertos_json = json.dumps(puertos_payload, ensure_ascii=False, separators=(',', ':'))
        with open(out_puertos_js, 'w', encoding='utf-8') as f:
            f.write(f'window.PUERTOS_DATA = {puertos_json};')

        size_puertos = os.path.getsize(out_puertos_js) / 1024
        print(f"OK Puertos Generado: {out_puertos_js} ({size_puertos:.1f} KB)")
        print(f"   Meses exportados: {len(carga_total_series)} ({years[0]} - {years[-1]})")
        print(f"   Carga Total Histórica: {kpis['total_carga_historica_ton']:,.2f} Ton")
    else:
        print(f"[WARN] No se encontró el archivo Excel de Puertos en {PUERTOS_EXCEL_PATH}")

except Exception as e:
    print(f"[WARN] Error al exportar datos Puertos: {e}")
    import traceback; traceback.print_exc()



