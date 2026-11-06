"""EFE: seguridad ferroviaria de las Memorias de EFE (PDF) → static/data/efe_seguridad.js.

Lee los mismos PDF que efe_carga.py y efe_trenes.py (`Bases de dato/EFE/`, nombres con "Memoria" o
"Reporte Integrado") y arma, por año:
  - `taf`: tasa de accidentabilidad ferroviaria (accidentes por cada 100.000 trenes-km).
      2018: frase de la Memoria 2018 (pág. 36: "con 3,4 acc/100.000 TKM"); 2019-2021: tabla del
      Reporte 2021 (pág. 72); 2021-2023: tablas de las Memorias 2022 (pág. 104) y 2023 (pág. 78);
      2023-2025: tabla de la Memoria 2025 (pág. 65). La Memoria 2024 no trae el valor del año.
  - `fallecidos`: personas fallecidas en la red (incluye suicidios): 2019-2023 (Reporte 2021 y
      Memorias 2022 y 2023). La Memoria 2025 ya no publica el total.
  - `fallecidos_operacionales`: sin suicidios: 2021-2023 del desglose "N suicidios y M operacionales"
      de las Memorias 2022 y 2023, y 2023-2025 de la Memoria 2025.
  - `accidentes` e `incidentes`: totales 2023-2025 (Memoria 2025, pág. 65).
  - `proyeccion`: la tasa que la Memoria más reciente proyecta para un año (2025: 1,7 al 2030); y
    `metas`, las metas de TAF que fijó la Memoria 2024 (0,95 al 2026 y 0,74 al 2030).
En los años que se repiten manda la Memoria más reciente y se avisa si no coinciden, salvo las
diferencias revisadas (DIFERENCIAS_REVISADAS). Cada dato lleva el documento y la página.

Uso suelto: python scripts/etl/efe_seguridad.py   (normalmente lo corre scripts/actualizar_efe.py)
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
OUT_JS = os.path.join(OUT_DIR, 'efe_seguridad.js')

CAMPOS = ('taf', 'fallecidos', 'fallecidos_operacionales', 'accidentes', 'incidentes')

# Diferencias entre Memorias ya revisadas: (campo, año) → valor que se usa (no se avisa).
#   Fallecidos operacionales 2023: la Memoria 2023 (pág. 78) dice 30 y la 2025 (pág. 65), 33. Se usa
#   la más reciente.
DIFERENCIAS_REVISADAS = {('fallecidos_operacionales', 2023): 33}

NUM = r'\d+(?:,\d+)?'


def _num(s):
    return float(s.replace(',', '.')) if ',' in s else int(s)


def _anios(s):
    return [int(a) for a in re.findall(r'20\d\d', s)]


def _nums(s):
    return [_num(v) for v in re.findall(NUM, s)]


def leer(path):
    nombre = os.path.basename(path)
    m = re.search(r'(20\d{2})', nombre)
    anio_doc = int(m.group(1)) if m else None
    tipo = 'Reporte Integrado' if 'reporte' in nombre.lower() else ('Memoria Anual' if 'anual' in nombre.lower() else 'Memoria Integrada')
    documento = f'{tipo} EFE {anio_doc}'
    datos = {c: {} for c in CAMPOS}   # campo → {año: (valor, fuente)}
    extra = {}

    def poner(campo, anio, valor, pag):
        datos[campo].setdefault(anio, (valor, f'{documento}, pág. {pag}'))

    doc = pymupdf.open(path)
    for i, page in enumerate(doc):
        pag = i + 1
        t = re.sub(r'\s+', ' ', page.get_text())

        # Memoria 2018: "Nuestra tasa de accidentes ferroviarios (...) con 3,4 acc/100.000 TKM"
        m = re.search(r'tasa de accidentes ferroviarios.{0,200}?con (' + NUM + r') acc/100\.000', t, re.I)
        if m:
            poner('taf', anio_doc, _num(m.group(1)), pag)

        # Reporte 2021 (texto desordenado): "Tasa de accidentes ferroviarios INDICADOR 2,87 2019 2,67
        # 2020 2,97 Número de personas fallecidas 38 23 32 2021"
        m = re.search(r'Tasa de accidentes ferroviarios INDICADOR (' + NUM + r') (20\d\d) (' + NUM + r') (20\d\d) ('
                      + NUM + r') N.mero de personas fallecidas (\d+) (\d+) (\d+) (20\d\d)', t, re.I)
        if m:
            anios = [int(m.group(2)), int(m.group(4)), int(m.group(9))]
            for a, v in zip(anios, [m.group(1), m.group(3), m.group(5)]):
                poner('taf', a, _num(v), pag)
            for a, v in zip(anios, [m.group(6), m.group(7), m.group(8)]):
                poner('fallecidos', a, int(v), pag)

        # Tablas de las Memorias 2022, 2023 y 2025: "2021 2022 2023 Tasa de accidentabilidad
        # ferroviaria [(TAF)] 2,97 2,36 2,17 Número de personas fallecidas [por accidentes operacionales] 32 34 40"
        m = re.search(r'((?:20\d\d ){2,})Tasa de accidentabilidad ferroviaria (?:\(TAF\) )?((?:' + NUM + r' ?)+)'
                      r'(?:N(?:.mero|°|º) de personas fallecidas (por accidentes operacionales )?((?:\d+ ?)+))?', t, re.I)
        if m:
            anios = _anios(m.group(1))
            for a, v in zip(anios, _nums(m.group(2))):
                poner('taf', a, v, pag)
            if m.group(4):
                campo = 'fallecidos_operacionales' if m.group(3) else 'fallecidos'
                for a, v in zip(anios, _nums(m.group(4))):
                    poner(campo, a, int(v), pag)
            # Desglose "10 suicidios y 24 operacionales": uno por año de la tabla, o uno solo (el del documento)
            desg = re.findall(r'(\d+) (?:fueron )?suicidios y (\d+) operacionales', t, re.I)
            if len(desg) == len(anios):
                for a, (_, op) in zip(anios, desg):
                    poner('fallecidos_operacionales', a, int(op), pag)
            elif len(desg) == 1:
                poner('fallecidos_operacionales', anio_doc, int(desg[0][1]), pag)

        # Memoria 2025: "Variables 2023 2024 2025 Número total de accidentes 213 202 206 Número total de incidentes 66 73 82"
        m = re.search(r'((?:20\d\d ){2,})N.mero total de accidentes ((?:\d+ ?)+)N.mero total de incidentes ((?:\d+ ?)+)', t, re.I)
        if m:
            anios = _anios(m.group(1))
            for a, v in zip(anios, _nums(m.group(2))):
                poner('accidentes', a, int(v), pag)
            for a, v in zip(anios, _nums(m.group(3))):
                poner('incidentes', a, int(v), pag)

        # Proyección (Memoria 2025): "estimando alcanzar una tasa de 1,7 para el año 2030"
        m = re.search(r'alcanzar una tasa de (' + NUM + r') para el a.o (20\d\d)', t, re.I)
        if m and 'proyeccion' not in extra:
            extra['proyeccion'] = {'anio': int(m.group(2)), 'valor': _num(m.group(1)), 'fuente': f'{documento}, pág. {pag}'}
        # Metas (Memoria 2024): "0,95 al 2026 Tasa de accidentabilidad ferroviaria (TAF), y 0,74 al 2030"
        m = re.search(r'(' + NUM + r') al (20\d\d) Tasa de accidentabilidad ferroviaria \(TAF\),? y (' + NUM + r') al (20\d\d)', t, re.I)
        if m and 'metas' not in extra:
            extra['metas'] = {'fuente': f'{documento}, pág. {pag}',
                              'valores': [{'anio': int(m.group(2)), 'valor': _num(m.group(1))},
                                          {'anio': int(m.group(4)), 'valor': _num(m.group(3))}]}
    return {'anio': anio_doc, 'documento': documento, 'datos': datos, **extra}


def main():
    paths = sorted(set(glob.glob(os.path.join(EFE_MEMORIA_DIR, '*Memoria*.pdf')) +
                       glob.glob(os.path.join(EFE_MEMORIA_DIR, '*memoria*.pdf')) +
                       glob.glob(os.path.join(EFE_MEMORIA_DIR, '*Reporte*Integrado*.pdf'))))
    if not paths:
        raise FileNotFoundError(f'No hay Memorias de EFE en PDF en {EFE_MEMORIA_DIR}')
    leidas = sorted((r for r in (leer(p) for p in paths) if r['anio']), key=lambda r: r['anio'])

    # Por campo y año manda la Memoria más reciente; se avisa si otra dice otra cosa
    series = {c: {} for c in CAMPOS}
    for r in reversed(leidas):
        for c in CAMPOS:
            for a, (v, fuente) in r['datos'][c].items():
                if a not in series[c]:
                    series[c][a] = (v, fuente)
                elif series[c][a][0] != v and DIFERENCIAS_REVISADAS.get((c, a)) != series[c][a][0]:
                    print(f"[AVISO] Seguridad EFE: {c} {a} es {series[c][a][0]} en {series[c][a][1]} y {v} en {fuente}")

    if not series['taf']:
        raise ValueError('No se encontró la tasa de accidentabilidad ferroviaria en ninguna Memoria: no se reescribe efe_seguridad.js')
    ult = leidas[-1]
    if ult['anio'] not in series['taf']:
        print(f"[AVISO] Seguridad EFE: la Memoria más reciente ({ult['documento']}) no trae la tasa de accidentabilidad de {ult['anio']}")

    anios = sorted(set(a for c in CAMPOS for a in series[c]))
    serie = []
    for a in anios:
        fila = {'anio': a}
        for c in CAMPOS:
            v = series[c].get(a)
            fila[c] = v[0] if v else None
            if v:
                fila.setdefault('fuentes', {})[c] = v[1]
        serie.append(fila)
    proyeccion = next((r['proyeccion'] for r in reversed(leidas) if 'proyeccion' in r), None)
    metas = next((r['metas'] for r in reversed(leidas) if 'metas' in r), None)
    payload = {'serie': serie, 'proyeccion': proyeccion, 'metas': metas}
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('window.EFE_SEGURIDAD = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';')
    print(f"OK Seguridad EFE generado: {OUT_JS}")
    print('   TAF ' + ' · '.join(f"{s['anio']}: {s['taf']}" for s in serie if s['taf'] is not None))
    print('   Fallecidos (total / operacionales) ' + ' · '.join(
        f"{s['anio']}: {s['fallecidos'] if s['fallecidos'] is not None else '-'} / "
        f"{s['fallecidos_operacionales'] if s['fallecidos_operacionales'] is not None else '-'}" for s in serie))
    print('   Accidentes / incidentes ' + ' · '.join(
        f"{s['anio']}: {s['accidentes']} / {s['incidentes']}" for s in serie if s['accidentes'] is not None))
    print(f"   Proyección {proyeccion} · metas {metas}")


main()
