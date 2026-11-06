"""Rutas, fotos y utilidades que comparten los pasos de datos (Excel → static/data/*.js).
"""

import os
import re
import json
import unicodedata
import numpy as np
import pandas as pd


# ── Rutas ──────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Una subcarpeta por módulo (DGC, EFE, Metro, MOP, SNI, Puertos)
DATA_DIR = os.path.join(BASE_DIR, 'Bases de dato')

DGC_EXCEL_PATH = os.path.join(DATA_DIR, 'DGC', 'DGC.xlsx')
EFE_EXCEL_PATH = os.path.join(DATA_DIR, 'EFE', 'EFE.xlsx')
METRO_EXCEL_PATH = os.path.join(DATA_DIR, 'Metro', 'Metro.xlsx')
PUERTOS_EXCEL_PATH = os.path.join(DATA_DIR, 'Puertos', 'puertos.xlsx')

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

def _slugify(s):
    """Texto → fragmento seguro para nombre de archivo/URL (ASCII, minúsculas, guiones)."""
    s = _normalize_col(s).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

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


# Todo lo de este archivo (también lo que empieza con _) queda disponible con `import *`.
__all__ = [n for n in dir() if not n.startswith('__')]
