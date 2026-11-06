"""EFE: trenes de pasajeros en operación según cada Memoria de EFE (PDF) → static/data/efe_trenes.js.

Lee los mismos PDF que efe_carga.py (`Bases de dato/EFE/`, nombres con "Memoria" o "Reporte
Integrado") y toma de cada uno la cifra de trenes en operación del año del documento. EFE solo opera
servicios de pasajeros (la carga la mueven los porteadores), así que son trenes de pasajeros.

Dónde está la cifra (cambia de un documento a otro):
  - Cifras consolidadas (Reporte 2021, pág. 6; Memorias 2022, pág. 9; 2023, pág. 7; 2024, pág. 8;
    2025, pág. 14): una etiqueta "Trenes en operación actual" / "N° trenes en operación actual" /
    "Trenes actualmente en operación" con el número grande arriba, al lado o debajo. Se lee por
    posición: el número entero de 2 o 3 cifras más cercano a la etiqueta.
  - Reporte 2020 (pág. 12): la frase "81 trenes en operación: 75 eléctricos y 6 diésel".
  - Memorias Anuales 2018 y 2019: no traen la cifra (quedan en `sin_dato`).
Ojo: el Reporte 2021 repite en la pág. 27 la frase de 2020 (81 trenes); por eso se recorren las
páginas en orden y se toma la primera cifra (sus cifras consolidadas están en la pág. 6).

También se toma, si está, cuántos son eléctricos ("75 eléctricos" en 2020, "100 Trenes eléctricos en
operación" en 2025) o el porcentaje ("Porcentaje de trenes eléctricos": 93% en 2022 y 2023, 94% en 2024).

Uso suelto: python scripts/etl/efe_trenes.py   (normalmente lo corre scripts/actualizar_efe.py)
"""
import glob
import json
import os
import re
import sys

import pymupdf

if __name__ == '__main__':   # suelto: que se pueda importar etl.comun_datos
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from etl.comun_datos import DATA_DIR, OUT_DIR

EFE_MEMORIA_DIR = os.path.join(DATA_DIR, 'EFE')
OUT_JS = os.path.join(OUT_DIR, 'efe_trenes.js')

# Las cifras consolidadas están al principio; más adelante hay frases viejas copiadas (Reporte 2021)
PAGINAS_MAX = 40
# Documentos que se sabe que no traen la cifra (no se avisa)
SIN_DATO_REVISADO = (2018, 2019)

ETIQUETA_TOTAL = re.compile(r'trenes (actualmente )?en operaci.n|operaci.n actual', re.I)
ETIQUETA_ELECTRICOS = re.compile(r'trenes el.ctricos en operaci.n', re.I)
ETIQUETA_PCT = re.compile(r'porcentaje de trenes el.ctricos', re.I)
FRASE_TOTAL = re.compile(r'(\d{2,3}) trenes en operaci.n:? (\d{1,3}) el.ctricos y (\d{1,3}) di.sel', re.I)


def _palabras(page):
    """Palabras de la página como (x0, y0, x1, y1, texto, bloque)."""
    return [(w[0], w[1], w[2], w[3], w[4], w[5]) for w in page.get_text('words')]


def _etiquetas(palabras, rx):
    """Cajas de las frases que calzan con `rx`. La frase se busca en el texto de cada bloque (puede
    ocupar dos líneas: "Trenes actualmente / en operación") y la caja es la de sus palabras."""
    bloques = {}
    for w in palabras:
        bloques.setdefault(w[5], []).append(w)
    cajas = []
    for ws in bloques.values():
        texto, inicios = '', []
        for w in ws:
            inicios.append(len(texto))
            texto += w[4] + ' '
        for m in rx.finditer(texto):
            usadas = [w for w, ini in zip(ws, inicios) if m.start() <= ini < m.end()]
            if usadas:
                cajas.append((min(w[0] for w in usadas), min(w[1] for w in usadas),
                              max(w[2] for w in usadas), max(w[3] for w in usadas)))
    return cajas


def _numero_cercano(palabras, caja, patron=r'^\d{2,3}$', distancia_max=90):
    """Número (palabra que calza con `patron`) más cercano a la caja de la etiqueta: arriba, abajo o
    al lado, con algo de cruce horizontal o vertical. Devuelve el texto o None."""
    x0, y0, x1, y1 = caja
    mejor = None
    for w in palabras:
        if not re.match(patron, w[4]):
            continue
        if w[0] < 60 and w[2] < 70:   # índice de capítulos del margen izquierdo ("01" a "12")
            continue
        dx = max(0, x0 - w[2], w[0] - x1)
        dy = max(0, y0 - w[3], w[1] - y1)
        if dx > distancia_max or dy > distancia_max:
            continue
        d = dx + dy + (40 if dx > 0 and dy > 0 else 0)   # en diagonal, solo si no hay otro más alineado
        if mejor is None or d < mejor[0]:
            mejor = (d, w[4])
    return mejor[1] if mejor else None


def leer(path):
    nombre = os.path.basename(path)
    m = re.search(r'(20\d{2})', nombre)
    anio = int(m.group(1)) if m else None
    tipo = 'Reporte Integrado' if 'reporte' in nombre.lower() else ('Memoria Anual' if 'anual' in nombre.lower() else 'Memoria Integrada')
    r = {'anio': anio, 'documento': f'{tipo} EFE {anio}', 'trenes': None, 'electricos': None,
         'pct_electricos': None, 'pagina': None}
    doc = pymupdf.open(path)
    paginas = list(doc)[:PAGINAS_MAX]

    # Página por página (las cifras consolidadas van antes que las frases viejas copiadas): primero la
    # frase "81 trenes en operación: 75 eléctricos y 6 diésel" (Reporte 2020), que trae su número;
    # si no está, la etiqueta de las cifras consolidadas con su número por posición.
    for i, page in enumerate(paginas):
        m = FRASE_TOTAL.search(re.sub(r'\s+', ' ', page.get_text()))
        if m:
            r['trenes'], r['electricos'], r['pagina'] = int(m.group(1)), int(m.group(2)), i + 1
            break
        palabras = _palabras(page)
        for caja in _etiquetas(palabras, ETIQUETA_TOTAL):
            n = _numero_cercano(palabras, caja)
            if n:
                r['trenes'], r['pagina'] = int(n), i + 1
                break
        if r['trenes']:
            for caja in _etiquetas(palabras, ETIQUETA_PCT):
                p = _numero_cercano(palabras, caja, r'^\d{2,3}%$')
                if p:
                    r['pct_electricos'] = int(p.rstrip('%'))
                    break
            break

    # Trenes eléctricos en cantidad (Memoria 2025: "100 Trenes eléctricos en operación", en la página siguiente)
    if r['trenes'] and r['electricos'] is None:
        for page in paginas[max(0, r['pagina'] - 1):r['pagina'] + 2]:
            palabras = _palabras(page)
            for caja in _etiquetas(palabras, ETIQUETA_ELECTRICOS):
                n = _numero_cercano(palabras, caja)
                if n:
                    r['electricos'] = int(n)
                    break
            if r['electricos'] is not None:
                break
    if r['electricos'] is not None and r['electricos'] > (r['trenes'] or 0):
        print(f"[AVISO] Trenes EFE: {nombre} dice {r['electricos']} eléctricos de {r['trenes']} trenes; se ignoran los eléctricos")
        r['electricos'] = None
    return r


def main():
    paths = sorted(set(glob.glob(os.path.join(EFE_MEMORIA_DIR, '*Memoria*.pdf')) +
                       glob.glob(os.path.join(EFE_MEMORIA_DIR, '*memoria*.pdf')) +
                       glob.glob(os.path.join(EFE_MEMORIA_DIR, '*Reporte*Integrado*.pdf'))))
    if not paths:
        raise FileNotFoundError(f'No hay Memorias de EFE en PDF en {EFE_MEMORIA_DIR}')
    leidas = [leer(p) for p in paths]
    leidas = sorted((r for r in leidas if r['anio']), key=lambda r: r['anio'])

    serie, sin_dato = [], []
    for r in leidas:
        if not r['trenes']:
            sin_dato.append(r['anio'])
            if r['anio'] not in SIN_DATO_REVISADO:
                print(f"[AVISO] Trenes EFE: no se encontró la cifra de trenes en operación en {r['documento']}")
            continue
        if any(s['anio'] == r['anio'] for s in serie):
            continue
        serie.append({
            'anio': r['anio'], 'trenes': r['trenes'], 'electricos': r['electricos'],
            'pct_electricos': r['pct_electricos'], 'fuente': f"{r['documento']}, pág. {r['pagina']}"
        })
    if not serie:
        raise ValueError('No se encontró la cifra de trenes en operación en ninguna Memoria: no se reescribe efe_trenes.js')

    payload = {'serie': serie, 'sin_dato': sorted(set(sin_dato) - {s['anio'] for s in serie})}
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('window.EFE_TRENES = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';')
    print(f"OK Trenes EFE generado: {OUT_JS} · "
          + ' · '.join(f"{s['anio']}: {s['trenes']}" + (f" ({s['electricos']} eléctricos)" if s['electricos'] else '')
                       + (f" ({s['pct_electricos']}% eléctricos)" if s['pct_electricos'] else '') for s in serie)
          + (f" · sin dato: {payload['sin_dato']}" if payload['sin_dato'] else ''))


main()
