"""Lee las fichas IDI descargadas por bip_download_fichas.py y arma el resumen de inversión por BIP
(con la justificación y descripción de su ficha más reciente).

Uso:
    python scripts/bip_resumen_fichas.py [carpeta_fichas] [salida.xlsx]

Por cada BIP de static/data/mop_data.js toma las fichas de <carpeta>/<BIP>/ (una por etapa,
la del último año postulado), lee la sección 16 (Programación de la inversión: TOTAL de
"Monto Directo") y la sección 15 (Costo Total) con ficha_idi.py, lleva cada monto a M$ 2026
con el factor de moneda de la ficha y suma las etapas. Escribe <carpeta>/_resumen_inversion.xlsx
(hojas "Por proyecto", "Por ficha", "Sin ficha" y "Nota") y _resumen_inversion.json.
"""
import json, os, sys
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bip_download_fichas import MOP_DATA_JS, OUT_DIR
from ficha_idi import read_ficha

# Factor de la "Moneda Presupuesto 2026" que traen las fichas del proceso 2026 y 2027:
# monto × FACTOR_DESTINO / factor_ficha lleva un monto a M$ de 2026.
FACTOR_DESTINO = 175.576
ANIO_DESTINO = 2026
ETAPA_ORDEN = ['PERFIL', 'PREFACTIBILIDAD', 'FACTIBILIDAD', 'DISENO', 'EJECUCION']


def to_destino(monto, factor):
    if monto is None or not factor:
        return None
    return round(monto * FACTOR_DESTINO / factor)


def etapa_of(filename):
    return os.path.splitext(filename)[0].split('_', 1)[1]


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else OUT_DIR
    out_xlsx = sys.argv[2] if len(sys.argv) > 2 else os.path.join(folder, '_resumen_inversion.xlsx')
    text = open(MOP_DATA_JS, encoding='utf-8').read()
    mop = json.loads(text[text.index('{'):text.rindex('}') + 1])

    fichas, proyectos, sin_ficha = [], [], []
    for p in mop['projects']:
        bip_dir = os.path.join(folder, p['bip'])
        pdfs = sorted(f for f in os.listdir(bip_dir) if f.endswith('.pdf')) if os.path.isdir(bip_dir) else []
        if not pdfs:
            sin_ficha.append({'BIP': p['bip'], 'Nombre': p['nombre'], 'Servicio': p['servicio'],
                              'Etapa (Iniciativas)': p['etapa'], 'Región': p['region'], 'Ítem': p.get('item')})
            continue
        pdfs.sort(key=lambda f: (ETAPA_ORDEN.index(etapa_of(f)) if etapa_of(f) in ETAPA_ORDEN else 99, f))
        rows = []
        for f in pdfs:
            r = read_ficha(os.path.join(bip_dir, f))
            row = {
                'BIP': p['bip'], 'Archivo': f, 'Año': int(f[:4]), 'Etapa': etapa_of(f),
                'Proceso': r['proceso'], 'RATE': r['rate'] or 'sin RATE',
                'Moneda año': r['moneda_anio'], 'Factor': r['moneda_factor'],
                'S16 total (nominal)': r['s16_total'], 'S16 suma ítems': r['s16_suma_items'],
                'S16 cuadra': r['s16_total'] is not None and r['s16_total'] == r['s16_suma_items'],
                f'S16 total (M$ {ANIO_DESTINO})': to_destino(r['s16_total'], r['moneda_factor']),
                'S15 costo total (nominal)': r.get('s15_costo_total'),
                f'S15 costo total (M$ {ANIO_DESTINO})': to_destino(r.get('s15_costo_total'), r['moneda_factor']),
                'S15 pagado': r.get('s15_pagado'), 'S15 pagado al': r['s15_pagado_al'],
                'S15 solicitado año': r.get('s15_solicitado'), 'S15 años siguientes': r.get('s15_siguientes'),
                'Ítems S16': '; '.join(f"{i['item']}: {i['monto']}" for i in r['s16_items']),
                'Justificación': r['justificacion'], 'Descripción': r['descripcion'],
            }
            rows.append(row)
        fichas.extend(rows)
        # Textos: los de la ficha más reciente (a igual año, la de la etapa más avanzada)
        texto = max(enumerate(rows), key=lambda ir: (ir[1]['Año'], ir[0]))[1]
        s16 = [r[f'S16 total (M$ {ANIO_DESTINO})'] for r in rows]
        s15 = [r[f'S15 costo total (M$ {ANIO_DESTINO})'] for r in rows]
        proyectos.append({
            'BIP': p['bip'], 'Nombre': p['nombre'], 'Servicio': p['servicio'], 'Región': p['region'],
            'Ítem': p.get('item'), 'Etapa (Iniciativas)': p['etapa'],
            'Etapas con ficha': ' - '.join(f"{r['Etapa']} {r['Año']}" for r in rows),
            'N° fichas': len(rows),
            'Fichas sin RATE': sum(r['RATE'] == 'sin RATE' for r in rows),
            f'Inversión S16 (M$ {ANIO_DESTINO})': sum(v for v in s16 if v is not None) if any(v is not None for v in s16) else None,
            f'Costo total S15 (M$ {ANIO_DESTINO})': sum(v for v in s15 if v is not None) if any(v is not None for v in s15) else None,
            'Lectura completa': all(v is not None for v in s16) and all(r['S16 cuadra'] for r in rows),
            'Ficha de los textos': texto['Archivo'],
            'Justificación': texto['Justificación'], 'Descripción': texto['Descripción'],
            'Por etapa': [{'etapa': r['Etapa'], 'anio': r['Año'], 'rate': r['RATE'],
                           'monto': r[f'S16 total (M$ {ANIO_DESTINO})']} for r in rows],
        })

    df_p = pd.DataFrame(proyectos).drop(columns=['Por etapa'])
    df_f, df_s = pd.DataFrame(fichas), pd.DataFrame(sin_ficha)
    col16 = f'Inversión S16 (M$ {ANIO_DESTINO})'
    nota = pd.DataFrame({'Nota': [
        f"Fuente: fichas IDI de BIP Consulta (bip.ministeriodesarrollosocial.gob.cl), una por etapa: la del último año postulado.",
        f"Proyectos: {len(mop['projects'])} BIP del Excel de Iniciativas ({mop['source']['label']}), sin Concesiones.",
        f"Con ficha: {len(df_p)} BIP, {len(df_f)} fichas. Sin resultados en BIP Consulta: {len(df_s)} (hoja 'Sin ficha').",
        f"Inversión S16 = suma, por etapa, del TOTAL de la sección 16 'Programación de la inversión' (Monto Directo, M$).",
        f"Costo total S15 = suma, por etapa, del 'Costo Total' de la sección 15 (pagado + solicitado + años siguientes); es la cifra que muestra la tabla de BIP Consulta.",
        f"Moneda: cada monto se lleva a M$ {ANIO_DESTINO} con el factor de la ficha: monto × {FACTOR_DESTINO} / factor.",
        f"'Lectura completa' = todas las fichas del BIP tienen TOTAL en la sección 16 y sus ítems suman ese TOTAL.",
        f"Fichas sin RATE: postulaciones aún en evaluación; su monto es el solicitado, no el aprobado.",
        f"Total Inversión S16: {df_p[col16].sum():,.0f} M$ {ANIO_DESTINO}".replace(',', '.'),
    ]})
    with pd.ExcelWriter(out_xlsx, engine='openpyxl') as xw:
        df_p.to_excel(xw, sheet_name='Por proyecto', index=False)
        df_f.to_excel(xw, sheet_name='Por ficha', index=False)
        df_s.to_excel(xw, sheet_name='Sin ficha', index=False)
        nota.to_excel(xw, sheet_name='Nota', index=False)
        for ws in xw.book.worksheets:
            ws.freeze_panes = 'A2'
            for col in ws.columns:
                width = max(len(str(c.value or '')) for c in col[:200])
                ws.column_dimensions[col[0].column_letter].width = min(max(width + 2, 8), 60)
    with open(os.path.splitext(out_xlsx)[0] + '.json', 'w', encoding='utf-8') as f:
        json.dump({'proyectos': proyectos, 'fichas': fichas, 'sin_ficha': sin_ficha}, f, ensure_ascii=False, indent=1)
    print(f'{len(df_p)} BIP con ficha, {len(df_f)} fichas, {len(df_s)} sin ficha -> {out_xlsx}')


if __name__ == '__main__':
    main()
