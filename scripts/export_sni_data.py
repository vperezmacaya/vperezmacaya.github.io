import os
import json
import re
import unicodedata
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'Bases de dato')
EXCEL_PATH = os.path.join(DATA_DIR, 'SNI.xlsx')
OUT_DIR = os.path.join(BASE_DIR, 'static', 'data')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_JS = os.path.join(OUT_DIR, 'sni_data.js')

CHILE_NORTH_TO_SOUTH_ORDER = [
    '01_Arica y Parinacota', '02_Tarapacá', '03_Antofagasta', '04_Atacama',
    '05_Coquimbo', '06_Valparaíso', '07_Metropolitana', '08_O´Higgins',
    '09_Maule', '10_Ñuble', '11_Biobío', '12_Araucanía',
    '13_Los Ríos', '14_Los Lagos', '15_Aysén', '16_Magallanes',
    '17_No Regionalizada'
]

DISPLAY_NAMES = {
    '01_Arica y Parinacota': '01_Arica y Parinacota',
    '02_Tarapaca': '02_Tarapacá',
    '03_Antofagasta': '03_Antofagasta',
    '04_Atacama': '04_Atacama',
    '05_Coquimbo': '05_Coquimbo',
    '06_Valparaiso': '06_Valparaíso',
    '07_Metropolitana': '07_Metropolitana',
    '08_OHiggins': '08_O´Higgins',
    '09_Maule': '09_Maule',
    '10_Nuble': '10_Ñuble',
    '11_Biobio': '11_Biobío',
    '12_Araucania': '12_Araucanía',
    '13_Los Rios': '13_Los Ríos',
    '14_Los Lagos': '14_Los Lagos',
    '15_Aysen': '15_Aysén',
    '16_Magallanes': '16_Magallanes',
    '17_No Regionalizada': '17_No Regionalizada'
}

def normalize_region(name):
    if not name or pd.isna(name):
        return '17_No Regionalizada'
    raw_str = str(name).strip()
    
    # Si comienza con dígitos numéricos (ej. 01_, 1_, 02_, etc.), mapear directo al orden canónico
    m = re.match(r'^(\d{1,2})', raw_str)
    if m:
        num = int(m.group(1))
        if 1 <= num <= len(CHILE_NORTH_TO_SOUTH_ORDER):
            return CHILE_NORTH_TO_SOUTH_ORDER[num - 1]
            
    name_clean = unicodedata.normalize('NFD', raw_str).encode('ascii', 'ignore').decode('utf-8').strip().lower()
    for r in CHILE_NORTH_TO_SOUTH_ORDER:
        r_clean = unicodedata.normalize('NFD', r).encode('ascii', 'ignore').decode('utf-8').strip().lower()
        if r_clean == name_clean or r_clean.split('_')[-1] == name_clean.split('_')[-1]:
            return r
    return raw_str

def load_regional_context(excel_path):
    """Carga y construye el diccionario REGIONAL_CONTEXT desde la hoja 'contexto regional' de SNI.xlsx."""
    print("Cargando 'contexto regional' desde SNI.xlsx...")
    try:
        df_ctx = pd.read_excel(excel_path, sheet_name='contexto regional')
        print(f"Filas leídas en 'contexto regional': {len(df_ctx)}")
        
        ctx_map = {}
        for c in df_ctx.columns:
            c_ascii = unicodedata.normalize('NFD', str(c)).encode('ascii', 'ignore').decode('utf-8').lower().strip()
            if 'region' in c_ascii:
                ctx_map['region'] = c
            elif 'pob' in c_ascii:
                ctx_map['poblacion'] = c
            elif 'sup' in c_ascii:
                ctx_map['superficie_km2'] = c
            elif 'pib' in c_ascii:
                ctx_map['pib_pct'] = c
            elif 'dist' in c_ascii:
                ctx_map['dist_santiago_km'] = c

        regional_context = {}
        for _, row in df_ctx.iterrows():
            raw_reg = row.get(ctx_map.get('region', 'Region'), '')
            reg_norm = normalize_region(raw_reg)
            
            pob = int(pd.to_numeric(row.get(ctx_map.get('poblacion', 'poblacion'), 0), errors='coerce') or 0)
            sup = int(pd.to_numeric(row.get(ctx_map.get('superficie_km2', 'superficie_km2'), 0), errors='coerce') or 0)
            pib = float(pd.to_numeric(row.get(ctx_map.get('pib_pct', 'aporte_pib'), 0.0), errors='coerce') or 0.0)
            dist = int(pd.to_numeric(row.get(ctx_map.get('dist_santiago_km', 'dist_santiago_km'), 0), errors='coerce') or 0)
            
            regional_context[reg_norm] = {
                'poblacion': pob,
                'superficie_km2': sup,
                'pib_pct': round(pib, 2),
                'dist_santiago_km': dist
            }
            
        # Asegurar completitud de las 17 regiones canónicas
        for r in CHILE_NORTH_TO_SOUTH_ORDER:
            if r not in regional_context:
                regional_context[r] = {
                    'poblacion': 0,
                    'superficie_km2': 0,
                    'pib_pct': 0.0,
                    'dist_santiago_km': 0
                }
        return regional_context
    except Exception as e:
        print(f"Error al leer hoja 'contexto regional': {e}. Usando valores predeterminados.")
        fallback = {}
        for r in CHILE_NORTH_TO_SOUTH_ORDER:
            fallback[r] = {
                'poblacion': 0,
                'superficie_km2': 0,
                'pib_pct': 0.0,
                'dist_santiago_km': 0
            }
        return fallback

def main():
    print(f'Cargando base de datos principal desde {EXCEL_PATH} (hoja "SNI")...')
    df = pd.read_excel(EXCEL_PATH, sheet_name='SNI')
    total_raw_rows = len(df)
    print(f'Total filas brutas: {total_raw_rows}')

    cols_map = {}
    for c in df.columns:
        c_ascii = unicodedata.normalize('NFD', str(c)).encode('ascii', 'ignore').decode('utf-8').upper().strip()
        if 'EXCLUIR' in c_ascii:
            cols_map['excluir'] = c
        elif 'EJERCICIO' in c_ascii:
            cols_map['ejercicio'] = c
        elif 'MINISTERIOS DESTACADOS' in c_ascii:
            cols_map['ministerio'] = c
        elif 'FUENTE' in c_ascii:
            cols_map['fuente'] = c
        elif 'DEFINITIVA' in c_ascii:
            cols_map['region'] = c
        elif 'MM DE US$ 2024' in c_ascii or 'MM USD 2024' in c_ascii:
            cols_map['usd_2024'] = c
        elif 'PESOS 2024' in c_ascii and 'INVERSION' in c_ascii:
            cols_map['pesos_2024'] = c
        elif 'SUBTITULO' in c_ascii and 'COD' in c_ascii:
            cols_map['subtitulo'] = c
        elif 'RECLAC' in c_ascii or 'RECLAS' in c_ascii:
            cols_map['servicio'] = c
        elif 'PROVINCIA' in c_ascii:
            cols_map['provincia'] = c
        elif 'COMUNA' in c_ascii:
            cols_map['comuna'] = c

    print('Columnas mapeadas:', cols_map)

    # 1. Filtro estricto de Excluir análisis
    if 'excluir' in cols_map:
        excluidos_count = df[cols_map['excluir']].notna().sum()
        print(f'Filas excluidas por \"{cols_map["excluir"]}\": {excluidos_count}')
        df = df[df[cols_map['excluir']].isna()].copy()
    
    print(f'Filas válidas para análisis: {len(df)}')

    df['year'] = df[cols_map['ejercicio']].astype(int)
    df['region'] = df[cols_map['region']].apply(normalize_region)
    df['ministerio'] = df[cols_map['ministerio']].fillna('Otros').astype(str).str.strip()
    df['fuente'] = df[cols_map['fuente']].fillna('Otros').astype(str).str.strip()
    df['subtitulo'] = df[cols_map.get('subtitulo', '')].fillna(0).astype(int).astype(str) if 'subtitulo' in cols_map else '31'
    df['servicio'] = df[cols_map.get('servicio', '')].fillna('Otros').astype(str).str.strip() if 'servicio' in cols_map else 'Otros'
    df['provincia'] = df[cols_map.get('provincia', '')].fillna('Sin Provincia').astype(str).str.strip() if 'provincia' in cols_map else 'Sin Provincia'
    df['comuna'] = df[cols_map.get('comuna', '')].fillna('Sin Comuna').astype(str).str.strip() if 'comuna' in cols_map else 'Sin Comuna'

    df['usd_2024'] = pd.to_numeric(df[cols_map['usd_2024']], errors='coerce').fillna(0.0)
    df['pesos_2024'] = pd.to_numeric(df[cols_map.get('pesos_2024', cols_map['usd_2024'])], errors='coerce').fillna(0.0)

    total_inversion_usd = float(df['usd_2024'].sum())
    total_inversion_pesos = float(df['pesos_2024'].sum())
    print(f'Inversión total consolidada: US$ {total_inversion_usd:,.2f} MM')

    # Agregación 1: Matriz completa (Año x Región x Ministerio x Fuente x Subtítulo)
    agg_main = df.groupby(['year', 'region', 'ministerio', 'fuente', 'subtitulo'])[['usd_2024', 'pesos_2024']].sum().reset_index()
    agg_main_list = [
        {
            'y': int(r['year']),
            'r': str(r['region']),
            'm': str(r['ministerio']),
            'f': str(r['fuente']),
            's': str(r['subtitulo']),
            'u': round(float(r['usd_2024']), 4),
            'p': round(float(r['pesos_2024']), 0)
        }
        for _, r in agg_main.iterrows() if r['usd_2024'] > 0 or r['pesos_2024'] > 0
    ]

    # Agregación 2: Direcciones MOP (Año x Región x Servicio)
    mop_df = df[df['ministerio'] == 'MOP']
    agg_mop = mop_df.groupby(['year', 'region', 'servicio'])[['usd_2024']].sum().reset_index()
    agg_mop_list = [
        {
            'y': int(r['year']),
            'r': str(r['region']),
            'srv': str(r['servicio']),
            'u': round(float(r['usd_2024']), 4)
        }
        for _, r in agg_mop.iterrows() if r['usd_2024'] > 0
    ]

    # Agregación 3: Comunal y Provincial
    comuna_df = df[(df['comuna'] != 'Sin Comuna') & (df['comuna'] != '')]
    agg_comuna = comuna_df.groupby(['region', 'provincia', 'comuna'])[['usd_2024']].sum().reset_index()
    agg_comuna = agg_comuna.sort_values(by='usd_2024', ascending=False)
    agg_comuna_list = [
        {
            'r': str(r['region']),
            'prov': str(r['provincia']),
            'com': str(r['comuna']),
            'u': round(float(r['usd_2024']), 3)
        }
        for _, r in agg_comuna.iterrows() if r['usd_2024'] > 0
    ]

    # Exportación 4: Registros granulares para exportación a Excel on-demand
    raw_records = []
    col_id = cols_map.get('id', 'ID_N')
    col_prog = cols_map.get('programa', 'Nombre Programa')
    col_asig = cols_map.get('asignacion', 'Nombre Asignacion')

    for _, r in df.iterrows():
        raw_records.append({
            'id': int(r.get(col_id, 0)) if col_id in r and pd.notna(r[col_id]) else 0,
            'y': int(r['year']),
            'r': str(r['region']),
            'm': str(r['ministerio']),
            'srv': str(r['servicio']),
            'f': str(r['fuente']),
            's': str(r['subtitulo']),
            'prog': str(r.get(col_prog, '')) if col_prog in r and pd.notna(r[col_prog]) else '',
            'asig': str(r.get(col_asig, '')) if col_asig in r and pd.notna(r[col_asig]) else '',
            'prov': str(r['provincia']),
            'com': str(r['comuna']),
            'u': round(float(r['usd_2024']), 4),
            'p': round(float(r['pesos_2024']), 0)
        })

    years = sorted(df['year'].unique().tolist())
    regions_ordered = [r for r in CHILE_NORTH_TO_SOUTH_ORDER if r in df['region'].unique()]
    for r in sorted(df['region'].unique()):
        if r not in regions_ordered:
            regions_ordered.append(r)

    ministries_ranked = df.groupby('ministerio')['usd_2024'].sum().sort_values(ascending=False).index.tolist()
    sources_ranked = df.groupby('fuente')['usd_2024'].sum().sort_values(ascending=False).index.tolist()
    subtitles = sorted(df['subtitulo'].unique().tolist())

    # Cargar contexto regional dinámicamente desde la hoja 'contexto regional'
    regional_context = load_regional_context(EXCEL_PATH)

    sni_payload = {
        'summary': {
            'total_usd_mm_2024': round(total_inversion_usd, 2),
            'total_pesos_2024': round(total_inversion_pesos, 0),
            'promedio_anual_usd': round(total_inversion_usd / max(len(years), 1), 2),
            'years_range': [min(years), max(years)],
            'total_records_processed': len(df),
            'total_raw_records': total_raw_rows,
            'top_ministerio': ministries_ranked[0] if ministries_ranked else '',
            'top_region': df.groupby('region')['usd_2024'].sum().sort_values(ascending=False).index[0]
        },
        'filters': {
            'years': years,
            'regions': regions_ordered,
            'ministries': ministries_ranked,
            'sources': sources_ranked,
            'subtitles': subtitles
        },
        'regional_context': regional_context,
        'matrix': agg_main_list,
        'mop_services': agg_mop_list,
        'communes': agg_comuna_list
    }

    js_content = f"// static/data/sni_data.js - Generado automáticamente por scripts/export_sni_data.py\nwindow.SNI_DATA = {json.dumps(sni_payload, ensure_ascii=False, indent=2)};\n"
    
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    file_size_kb = os.path.getsize(OUT_JS) / 1024
    print(f"\n[OK] Generado exitosamente: {OUT_JS}")
    print(f"Tamaño del archivo JS: {file_size_kb:.2f} KB ({file_size_kb/1024:.2f} MB)")

    # Guardar archivo JSON raw para exportación a Excel on-demand
    OUT_RAW_JSON = os.path.join(OUT_DIR, 'sni_raw_data.json')
    with open(OUT_RAW_JSON, 'w', encoding='utf-8') as f:
        json.dump(raw_records, f, ensure_ascii=False)
    
    raw_size_mb = os.path.getsize(OUT_RAW_JSON) / (1024 * 1024)
    print(f"[OK] Generado dataset completo para Excel ({len(raw_records)} filas): {OUT_RAW_JSON} ({raw_size_mb:.2f} MB)")

if __name__ == '__main__':
    main()
