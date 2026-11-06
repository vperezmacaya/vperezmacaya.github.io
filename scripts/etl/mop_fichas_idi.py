"""Fichas IDI de BIP Consulta (bip.ministeriodesarrollosocial.gob.cl) para el costo de los proyectos MOP.

Lo usa scripts/actualizar_mop.py en dos pasos:

  descargar()  Busca cada BIP de static/data/mop_data.js y descarga la ficha IDI del último año
               postulado de cada etapa en Bases de dato/MOP/BIP fichas IDI/<BIP>/<año>_<ETAPA>.pdf
               (más <BIP>/_busqueda.json con todas las filas de BIP Consulta). Es reanudable: los
               BIP ya registrados como "ok" o "sin resultados" en _registro.jsonl no se vuelven a
               buscar, las fichas ya descargadas no se repiten y los errores se reintentan.
               Los BIP ya descargados no se actualizan aunque tengan una postulación más nueva:
               para refrescarlos, quitar sus líneas de _registro.jsonl.
  resumir()    Lee las fichas de cada BIP (una por etapa) con ficha_idi.py: sección 16 (Programación
               de la inversión: TOTAL de "Monto Directo"), sección 15 (Costo Total), justificación y
               descripción; lleva cada monto a M$ 2026 con el factor de moneda de la ficha y suma las
               etapas. Escribe _resumen_inversion.xlsx (hojas "Por proyecto", "Por ficha", "Sin ficha"
               y "Nota") y _resumen_inversion.json, que lee mop_datos.py.
"""
import json, os, re, time, unicodedata
from datetime import datetime

import pandas as pd

from etl.bip_client import BipClient
from etl.ficha_idi import read_ficha

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MOP_DATA_JS = os.path.join(ROOT, 'static', 'data', 'mop_data.js')
OUT_DIR = os.path.join(ROOT, 'Bases de dato', 'MOP', 'BIP fichas IDI')
LOG_PATH = os.path.join(OUT_DIR, '_registro.jsonl')
RESUMEN_JSON = os.path.join(OUT_DIR, '_resumen_inversion.json')
RETRIES = 3          # intentos por BIP ante errores de red o del sitio
RETRY_WAIT = 30      # segundos de espera entre intentos (se multiplica por el intento)

# Factor de la "Moneda Presupuesto 2026" que traen las fichas del proceso 2026 y 2027:
# monto × FACTOR_DESTINO / factor_ficha lleva un monto a M$ de 2026.
FACTOR_DESTINO = 175.576
ANIO_DESTINO = 2026
ETAPA_ORDEN = ['PERFIL', 'PREFACTIBILIDAD', 'FACTIBILIDAD', 'DISENO', 'EJECUCION']


def load_bips():
    text = open(MOP_DATA_JS, encoding='utf-8').read()
    data = json.loads(text[text.index('{'):text.rindex('}') + 1])
    return [p['bip'] for p in data['projects']]


SITIO_NO_GENERA = 'Faltan datos para generar el archivo'


def pendientes():
    """(pendientes, no_genera): BIP de mop_data.js sin registro "ok" ni "sin resultados" (nuevos o con
    error), y aparte los que BIP Consulta no puede generar ("Faltan datos para generar el archivo" en su
    último intento), que no se reintentan solos: para reintentarlos, borrar sus líneas de _registro.jsonl."""
    done, last = done_bips(LOG_PATH), {}
    if os.path.exists(LOG_PATH):
        for line in open(LOG_PATH, encoding='utf-8'):
            e = json.loads(line)
            last[e['bip']] = e
    pend, no_genera = [], []
    for b in load_bips():
        if b in done:
            continue
        if SITIO_NO_GENERA in (last.get(b) or {}).get('error', ''):
            no_genera.append(b)
        else:
            pend.append(b)
    return pend, no_genera


def resumen_desactualizado():
    """True si _resumen_inversion.json falta, es anterior al registro de descargas o no cubre
    exactamente los BIP de mop_data.js (Excel mensual nuevo)."""
    if not os.path.exists(RESUMEN_JSON):
        return True
    if os.path.exists(LOG_PATH) and os.path.getmtime(LOG_PATH) > os.path.getmtime(RESUMEN_JSON):
        return True
    with open(RESUMEN_JSON, encoding='utf-8') as f:
        res = json.load(f)
    en_resumen = {p['BIP'] for p in res.get('proyectos', [])} | {p['BIP'] for p in res.get('sin_ficha', [])}
    return en_resumen != set(load_bips())


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().upper()
    return re.sub(r'[^A-Z0-9]+', '_', s).strip('_') or 'SIN_ETAPA'


def done_bips(log_path):
    done = set()
    if os.path.exists(log_path):
        for line in open(log_path, encoding='utf-8'):
            e = json.loads(line)
            if e.get('estado') in ('ok', 'sin resultados'):
                done.add(e['bip'])
    return done


def latest_by_etapa(rows):
    """Fila del último año postulado de cada etapa (la etapa a financiar o, si falta, la actual)."""
    latest = {}
    for r in rows:
        e = r['etapa_financiar'] or r['etapa_actual']
        if r['anio_financiar'] and (e not in latest or r['anio_financiar'] > latest[e]['anio_financiar']):
            latest[e] = r
    return latest


def fetch(bip, folder):
    client = BipClient()
    rows = client.search(bip.split('-')[0])
    with open(os.path.join(folder, '_busqueda.json'), 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    if not rows:
        return {'estado': 'sin resultados'}
    latest = latest_by_etapa(rows)
    got = []
    for etapa, r in sorted(latest.items(), key=lambda kv: kv[1]['anio_financiar']):
        path = os.path.join(folder, f"{r['anio_financiar']}_{slug(etapa)}.pdf")
        if not (os.path.exists(path) and os.path.getsize(path) > 0):
            pdf, _ = client.download_ficha(r['row_id'])
            with open(path, 'wb') as f:
                f.write(pdf)
        got.append(os.path.basename(path))
    return {'estado': 'ok', 'filas': len(rows), 'fichas': got}


def descargar(bips=None, out=OUT_DIR):
    """Descarga las fichas de los BIP (por defecto, los de mop_data.js) que no estén registrados
    como "ok" o "sin resultados" en <out>/_registro.jsonl. Devuelve cuántos BIP procesó."""
    bips = load_bips() if bips is None else bips
    os.makedirs(out, exist_ok=True)
    log_path = os.path.join(out, '_registro.jsonl')
    done = done_bips(log_path)
    pending = [b for b in bips if b not in done]
    print(f'{len(bips)} BIP; {len(bips) - len(pending)} ya registrados; {len(pending)} por descargar', flush=True)

    t0 = time.time()
    for i, bip in enumerate(pending, 1):
        folder = os.path.join(out, bip)
        os.makedirs(folder, exist_ok=True)
        for attempt in range(1, RETRIES + 1):
            try:
                entry = fetch(bip, folder)
                break
            except Exception as e:
                entry = {'estado': 'error', 'error': str(e)[:300]}
                if attempt < RETRIES:
                    time.sleep(RETRY_WAIT * attempt)
        entry = {'bip': bip, **entry, 'fecha': datetime.now().isoformat(timespec='seconds')}
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
        eta = (time.time() - t0) / i * (len(pending) - i) / 60
        detail = entry.get('fichas') or entry.get('error') or ''
        print(f'[{i}/{len(pending)}] {bip}: {entry["estado"]} {detail} (faltan ~{eta:.0f} min)', flush=True)

    return len(pending)


# ── Resumen de las fichas descargadas ──────────────────────────────────────────

def to_destino(monto, factor):
    if monto is None or not factor:
        return None
    return round(monto * FACTOR_DESTINO / factor)


def etapa_of(filename):
    return os.path.splitext(filename)[0].split('_', 1)[1]


def resumir(folder=OUT_DIR):
    """Lee las fichas de cada BIP de mop_data.js y escribe <folder>/_resumen_inversion.xlsx y .json."""
    out_xlsx = os.path.join(folder, '_resumen_inversion.xlsx')
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

