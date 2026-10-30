"""Descarga desde BIP Consulta la ficha IDI del último año postulado de cada etapa de cada código BIP.

Uso:
    python scripts/bip_download_fichas.py                 # todos los BIP de static/data/mop_data.js
    python scripts/bip_download_fichas.py lista.json      # una lista JSON de códigos ("30125021-0", ...)
    python scripts/bip_download_fichas.py lista.json carpeta_salida

Por BIP deja <salida>/<BIP>/_busqueda.json (todas las filas de BIP Consulta) y
<salida>/<BIP>/<año>_<ETAPA>.pdf. Es reanudable: los BIP ya registrados como "ok" o
"sin resultados" en <salida>/_registro.jsonl no se vuelven a buscar, y las fichas ya
descargadas no se repiten. Los errores se reintentan al volver a ejecutar el script.
Los montos se leen después con ficha_idi.py (secciones 15 y 16).
"""
import json, os, re, sys, time, unicodedata
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bip_client import BipClient

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOP_DATA_JS = os.path.join(ROOT, 'static', 'data', 'mop_data.js')
OUT_DIR = os.path.join(ROOT, 'Bases de dato', 'MOP', 'BIP fichas IDI')
RETRIES = 3          # intentos por BIP ante errores de red o del sitio
RETRY_WAIT = 30      # segundos de espera entre intentos (se multiplica por el intento)


def load_bips(path=None):
    if path:
        return json.load(open(path, encoding='utf-8'))
    text = open(MOP_DATA_JS, encoding='utf-8').read()
    data = json.loads(text[text.index('{'):text.rindex('}') + 1])
    return [p['bip'] for p in data['projects']]


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


def main():
    bips = load_bips(sys.argv[1] if len(sys.argv) > 1 else None)
    out = sys.argv[2] if len(sys.argv) > 2 else OUT_DIR
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


if __name__ == '__main__':
    main()
