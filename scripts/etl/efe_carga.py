"""EFE: estadísticas de carga ferroviaria de las Memorias de EFE (PDF) → static/data/efe_carga.js.

Lee cada PDF de `Bases de dato/EFE/` con "Memoria" o "Reporte Integrado" en el nombre (descargados de
efe.cl, Memorias Anuales: hoy las Memorias Anuales 2018 y 2019, los Reportes Integrados 2020 y 2021 y
las Memorias Integradas 2022 a 2025) con pymupdf y busca las cifras por su texto, no por número de
página, porque la diagramación cambia de un año a otro. Cada Memoria trae su redacción: las
expresiones regulares tienen una alternativa por formato. La más reciente da los valores del año;
las anteriores solo completan las series por año (CAMPOS_SERIE). En los años que se repiten manda la
más reciente y se avisa si no coinciden, salvo las diferencias ya revisadas (DIFERENCIAS_REVISADAS);
lo que se sabe que una Memoria no trae está en CAMPOS_AUSENTES_REVISADOS.

Series y de dónde salen:
  - TKBC por año (`tkbc_serie`, total y, si hay, por porteador): 2014-2017 del gráfico "Millones de
    TKBC por Sector" de la Memoria Anual 2018 (pág. 26, leído por la posición de los números: el más
    alto de cada columna es el total); 2018 y 2019 de las tablas "Ingresos desde Porteadores
    Privados" de las Memorias 2018 (pág. 49) y 2019 (pág. 65); 2019-2021 de los Reportes 2020 (págs.
    27 y 82; para 2019 su resumen dice 3.137 y su tabla 3.101, se usa la tabla) y 2021 (pág. 166);
    2022-2024 de la tabla "Carga movilizada (millones TKBC)" de la Memoria 2024 (pág. 107; respaldo
    transcrito en EFE_TKBC_MANUAL) y 2025 de las cifras consolidadas de la Memoria 2025 (pág. 14).
    Esas tablas de 2018-2021 traen también el peaje variable, que no se usa.
  - Toneladas por año (`toneladas_serie`): 2019 como suma de las tres zonas de la Memoria 2019 (pág.
    36, `zonas`); 2021 y 2023 como promedio mensual × 12 (`calculado`: 873.021 y 666.983 t/mes,
    porque esas Memorias no dan el total exacto); 2022, 2024 y 2025, el total publicado. 2020 no
    tiene cifra (el Reporte 2021 solo dice que 2021 fue "un 3% inferior").
  - TEU (2022-2025, Memorias 2023 a 2025; para 2024 la Memoria 2024 dice 58.761 y la 2025, 57.948:
    se usa la más reciente).
  - Productos por año (`productos_serie`): 2024 (millones de t redondeados a una décima,
    `redondeado`) y 2025 (toneladas exactas). La 2023 no desglosa y la 2022 lo hace por industria.

Cifras del año (Memoria 2025): volumen en MM TKBC y meta 2030 (págs. 14, 48 y 67); toneladas por
producto y promedio mensual con su variación (págs. 50 y 69); datos de contexto: camiones por
tren, eficiencia energética,
participación de EFE Sur, plazo de los contratos de los porteadores y piloto bimodal (págs. 56, 67
y 71).

Si una cifra no aparece (otra redacción en una Memoria nueva) se avisa con [AVISO] y queda en null;
hay que ajustar su expresión regular en este archivo. Si no aparecen ni el volumen ni los productos,
el paso falla y no reescribe efe_carga.js.

Uso suelto: python scripts/etl/efe_carga.py   (normalmente lo corre scripts/actualizar_efe.py)
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
OUT_JS = os.path.join(OUT_DIR, 'efe_carga.js')

# Carga movilizada en millones de TKBC, total y por porteador, transcrita de la tabla de la
# Memoria 2024 (pág. 107). Es el respaldo si ese PDF no está en Bases de dato/EFE (la carpeta no se
# versiona): cuando está, manda lo que se lee del PDF y se avisa si no coincide.
_FUENTE_MEMORIA_2024 = 'Memoria Integrada EFE 2024, tabla "Carga movilizada (millones TKBC)" (SASB TR-RA-000.D)'
EFE_TKBC_MANUAL = {
    2022: {'valor': 3634, 'porteadores': {'Fepasa': 2626, 'Transap': 1008}, 'fuente': _FUENTE_MEMORIA_2024},
    2023: {'valor': 2790, 'porteadores': {'Fepasa': 1903, 'Transap': 887}, 'fuente': _FUENTE_MEMORIA_2024},
    2024: {'valor': 3330, 'porteadores': {'Fepasa': 2514, 'Transap': 816}, 'fuente': _FUENTE_MEMORIA_2024},
}

# Campos que aportan las Memorias anteriores a la más reciente (series por año). De ellas solo se
# avisa si falta uno de estos; las demás cifras (contexto, meta, productos...) salen de la última.
CAMPOS_SERIE = ('tkbc_porteador', 'toneladas', 'promedio_mensual', 'teu')

# Diferencias entre Memorias ya revisadas: (serie, año) → valor que se acepta (siempre el de la
# Memoria más reciente). No se avisan mientras ese siga siendo el valor; si cambia, vuelve el aviso.
#   TEU 2024: la Memoria 2024 dice 58.761 y la 2025, 57.948 (igual que 2023). Se usa la más
#   reciente por decisión del usuario (noviembre 2026).
DIFERENCIAS_REVISADAS = {
    ('teu', 2024): 57948,
    # TKBC 2019 en el Reporte Integrado 2020: la pág. 82 (tabla "Ingresos desde Porteadores
    # Privados") dice 3.101 y la pág. 27 (resumen), 3.137. Se usa 3.101, que cuadra con el aumento
    # de 140 millones de TKBC que explica el texto de la pág. 82 (decisión del usuario, nov. 2026).
    ('tkbc', 2019): 3101,
}

# Campos de CAMPOS_SERIE que se sabe que una Memoria no trae: no se avisan.
CAMPOS_AUSENTES_REVISADOS = {
    # Memoria 2022: sin promedio mensual ni TEU (el TEU 2022 sale de la Memoria 2024)
    2022: ('promedio_mensual', 'teu'),
    # Reporte 2021: sin TEU
    2021: ('teu',),
    # Reporte 2020: solo TKBC (2018-2020); sin toneladas, promedio mensual ni TEU
    2020: ('toneladas', 'promedio_mensual', 'teu'),
    # Memoria Anual 2019: toneladas solo por zona (se suman), sin promedio mensual ni TEU
    2019: ('promedio_mensual', 'teu'),
    # Memoria Anual 2018: sin toneladas exactas (solo "más de 11 millones"), promedio mensual ni TEU
    2018: ('toneladas', 'promedio_mensual', 'teu'),
}

NUMD = r'\d{1,3}(?:\.\d{3})*(?:,\d+)?'   # 3.599,9 (TKBC con decimales del Reporte 2021)
NUM =r'\d{1,3}(?:\.\d{3})*'          # 1.299.321
DEC = r'\d+(?:,\d+)?'                  # 9,03


def _int(s):
    return int(s.replace('.', ''))


def _dec(s):
    return float(s.replace('.', '').replace(',', '.'))


def _nombre_producto(s):
    """Mismo nombre en todas las Memorias: "Concentrado de Cobre" (2024) = "Concentrado de cobre" (2025)."""
    s = s.strip()
    return s[:1].upper() + s[1:].lower()


def _avisar(campo, archivo):
    print(f"[AVISO] Carga EFE: no se encontró '{campo}' en {os.path.basename(archivo)} "
          f"(revisar la expresión regular en scripts/etl/efe_carga.py)")


class Memoria:
    """Texto de un PDF, página por página, con los espacios y saltos de línea reducidos a uno."""

    def __init__(self, path, principal=True):
        self.path = path
        self.principal = principal   # la más reciente: avisa por todo lo que falte
        doc = pymupdf.open(path)
        self.pages = [re.sub(r'\s+', ' ', p.get_text()).strip() for p in doc]
        self.doc_pages = list(doc)   # para leer gráficos por posición (Memoria Anual 2018)
        m = re.search(r'(20\d{2})', os.path.basename(path))
        anio = int(m.group(1)) if m else None
        if anio is None:
            m = re.search(r'MEMORIA INTEGRADA (20\d{2})', ' '.join(self.pages[:5]))
            anio = int(m.group(1)) if m else None
        self.anio = anio
        self.paginas = {}   # campo → página (1-based) de donde salió

    def buscar(self, campo, patron, debe_tener=None, flags=re.IGNORECASE, opcional=False):
        """Primer calce de `patron`; si `debe_tener`, solo en páginas que contienen ese texto.
        Con `opcional` no avisa si no lo encuentra (cifras que no todas las Memorias traen)."""
        rx = re.compile(patron, flags)
        for i, txt in enumerate(self.pages):
            if debe_tener and debe_tener not in txt:
                continue
            m = rx.search(txt)
            if m:
                self.paginas.setdefault(campo, i + 1)
                return m
        if self.debe_avisar(campo, opcional):
            _avisar(campo, self.path)
        return None

    def debe_avisar(self, campo, opcional=False):
        """La Memoria más reciente avisa por todo lo no opcional; las anteriores, que solo
        completan las series, avisan únicamente por los campos de CAMPOS_SERIE."""
        if campo in CAMPOS_AUSENTES_REVISADOS.get(self.anio, ()):
            return False
        return (self.principal and not opcional) or (not self.principal and campo in CAMPOS_SERIE)


def leer_memoria(path, principal=True):
    mem = Memoria(path, principal)
    nombre = os.path.basename(path).lower()
    tipo = 'Reporte Integrado' if 'reporte' in nombre else ('Memoria Anual' if 'anual' in nombre else 'Memoria Integrada')
    r = {'anio': mem.anio, 'documento': f"{tipo} EFE {mem.anio}"}

    # ── Volumen ──────────────────────────────────────────────────────────────
    m = mem.buscar('tkbc', r'Volumen de carga transportada (' + NUM + r')\b', debe_tener='TKBC')
    r['tkbc_mm'] = _int(m.group(1)) if m else None

    # Tabla de TKBC por porteador (SASB TR-RA-000.D): "Carga movilizada (millones TKBC)" en la
    # Memoria 2024 y "Toneladas kilómetro transportadas en MMTKBC" en la 2023, con columnas por año;
    # en la 2022, "MMTKBC (*)" con una sola columna, la del año de la Memoria. La Memoria 2025 no
    # la trae: con el mismo código SASB publica otra tabla, en pesos (peaje variable, no se usa).
    tkbc_porteador = {}
    m = mem.buscar('tkbc_tabla',
                   r'(?:Carga movilizada \(millones TKBC\*?\)|Toneladas kil[oó]metro transportadas en MMTKBC\*?)'
                   r'.{0,60}?Empresa porteadora ((?:\d{4} )+)(.+?) Total ((?:' + NUM + r' ?)+)',
                   opcional=True)
    if not m:
        m1 = mem.buscar('tkbc_tabla_anio', r'MMTKBC \(\*\) ((?:[A-ZÁÉÍÓÚÑ]+ ' + NUM + r' )+)Total (' + NUM + r')\b',
                        opcional=True)
        if m1 and mem.anio:
            filas = re.findall(r'([A-ZÁÉÍÓÚÑ]+) (' + NUM + r')', m1.group(1))
            tkbc_porteador[mem.anio] = {'valor': _int(m1.group(2)),
                                        'porteadores': {n.capitalize(): _int(v) for n, v in filas}}
            mem.paginas['tkbc_porteador'] = mem.paginas['tkbc_tabla_anio']
    else:
        mem.paginas['tkbc_porteador'] = mem.paginas['tkbc_tabla']
    if m:
        anios = [int(a) for a in m.group(1).split()]
        filas = [(fm.group(1).strip().capitalize(), [_int(v) for v in fm.group(2).split()])
                 for fm in re.finditer(r'([A-Za-zÁÉÍÓÚáéíóúñÑ][\w.\- ]*?) ((?:' + NUM + r' ?)+)', m.group(2))]
        total = [_int(v) for v in m.group(3).split()]
        for i, a in enumerate(anios):
            if i < len(total):
                tkbc_porteador[a] = {'valor': total[i],
                                     'porteadores': {n: v[i] for n, v in filas if i < len(v)}}
    # Tablas "Ingresos desde Porteadores Privados" (Memorias 2018-2019, Reportes 2020-2021): traen el
    # peaje variable (que no se usa) y las TKBC; de ellas solo se toman las TKBC
    if not tkbc_porteador:
        m = mem.buscar('tkbc_ri',r'Ingresos Variables ((?:[A-ZÁÉÍÓÚÑ]{3,} )+)Cobros de peajes', opcional=True)
        if m:
            pagina = mem.pages[mem.paginas['tkbc_ri'] - 1]
            nombres = [n.capitalize() for n in m.group(1).split()]
            ma = re.search(r'(\d{4}) (\d{4}) Variaci\S* mill\. TKBC', pagina)
            fila = (r'(' + NUM + r') (' + NUM + r') \(?' + NUM + r'\)? -?' + DEC + r' ?% '
                    r'(' + NUMD + r') (' + NUMD + r') \(?' + NUMD + r'\)? -?' + DEC + r' ?%')
            filas = re.findall(fila, pagina[ma.end():]) if ma else []
            if ma and len(filas) == len(nombres) + 1:   # fila de ingresos variables (total) + una por porteador
                anios = [int(ma.group(1)), int(ma.group(2))]
                for i, a in enumerate(anios):
                    tkbc_porteador[a] = {'valor': _dec(filas[0][2 + i]),
                                         'porteadores': {n: _dec(f[2 + i]) for n, f in zip(nombres, filas[1:])}}
                mem.paginas['tkbc_porteador'] = mem.paginas['tkbc_ri']
    if not tkbc_porteador:
        # Reporte Integrado 2020, pág. 82: "Peaje Variable 6.596 6.242 354 5,7% 3.241 3.101 140 4,5%"
        # (peaje en MM$ y TKBC de 2020 y 2019, sin desglose por porteador)
        m = mem.buscar('tkbc_ri2020', r'Peaje Variable (' + NUM + r') (' + NUM + r') \(?-?' + NUM + r'\)? -?' + DEC + r' ?% '
                       r'(' + NUM + r') (' + NUM + r') \(?-?' + NUM + r'\)? -?' + DEC + r' ?%', opcional=True)
        if m:
            pagina = mem.pages[mem.paginas['tkbc_ri2020'] - 1]
            ma = re.search(r'Rubro (\d{4}) Millones TKBC (\d{4}) Millones TKBC', pagina)
            if ma:
                anios = [int(ma.group(1)), int(ma.group(2))]
                for i, a in enumerate(anios):
                    tkbc_porteador[a] = {'valor': _int(m.group(3 + i)), 'porteadores': None}
                mem.paginas['tkbc_porteador'] = mem.paginas['tkbc_ri2020']
        # Pág. 27 (resumen): "Total de Toneladas Kilómetro Brutas Completa transportadas (...) 2020
        # 2019 2018 3.241 3.137 3.412": completa los años que no trae la tabla (2018)
        m = mem.buscar('tkbc_resumen', r'Total de Toneladas Kil[oó]metro Brutas Completas? transportadas.{0,80}?'
                       r'((?:\d{4} )+)((?:' + NUM + r' ?)+)', opcional=True)
        if m:
            anios = [int(a) for a in m.group(1).split()]
            valores = [_int(v) for v in m.group(2).split()][:len(anios)]
            for a, v in zip(anios, valores):
                if a not in tkbc_porteador:
                    tkbc_porteador[a] = {'valor': v, 'porteadores': None, 'pagina': mem.paginas['tkbc_resumen']}
                elif tkbc_porteador[a]['valor'] != v and DIFERENCIAS_REVISADAS.get(('tkbc', a)) != tkbc_porteador[a]['valor']:
                    print(f"[AVISO] Carga EFE: TKBC {a} en {os.path.basename(path)}: el resumen (pág. "
                          f"{mem.paginas['tkbc_resumen']}) dice {v:,} y la tabla, {tkbc_porteador[a]['valor']:,}; se usa la tabla")
            mem.paginas.setdefault('tkbc_porteador', mem.paginas['tkbc_resumen'])
    if not tkbc_porteador:
        # Memoria Anual 2018, pág. 49: "PEAJE VARIABLE 6.614.743 5.460.036 1.154.707 21% 3.412 19%
        # Fepasa 4.659.940 3.686.846 973.094 26% 2.399 27% Transap ..." (TKBC solo de 2018, total y
        # por porteador, tras el peaje de 2018 y 2017)
        fila = r'(' + NUM + r') (' + NUM + r') \(?-?' + NUM + r'\)? -?\d+ ?% (' + NUM + r') -?\d+ ?%'
        m = mem.buscar('tkbc_tabla_2018', r'al 31 de diciembre (\d{4}) M\$ al 31 de diciembre (\d{4}) M\$.*?'
                       r'PEAJE VARIABLE ' + fila + r'((?: [A-Z][a-záéíóúñ]+ ' + fila + r')+)', opcional=True)
        if m:
            anio = int(m.group(1))
            filas = re.findall(r'([A-Z][a-záéíóúñ]+) ' + fila, m.group(6))
            tkbc_porteador[anio] = {'valor': _int(m.group(5)),
                                    'porteadores': {f[0]: _int(f[3]) for f in filas}}
            mem.paginas['tkbc_porteador'] = mem.paginas['tkbc_tabla_2018']
        # Pág. 26: gráfico "Millones de TKBC por Sector" 2014-2018. Se lee por posición: bajo cada
        # año (rotulado "2.014"...) el número más alto de su columna es el total de la barra
        for i, pg in enumerate(mem.doc_pages or []):
            if 'Millones de TKBC por Sector' not in mem.pages[i]:
                continue
            palabras = pg.get_text('words')
            anios_x = [((w[0] + w[2]) / 2, w[1], 2000 + int(w[4][2:])) for w in palabras if re.fullmatch(r'2\.0\d\d', w[4])]
            if len(anios_x) < 2:
                continue
            ancho = min(b[0] - a[0] for a, b in zip(sorted(anios_x), sorted(anios_x)[1:])) / 2
            for xc, y_anio, anio in anios_x:
                col = [w for w in palabras if re.fullmatch(NUM, w[4]) and not re.fullmatch(r'2\.0\d\d', w[4])
                       and abs((w[0] + w[2]) / 2 - xc) < ancho and w[1] < y_anio]
                if not col:
                    continue
                col.sort(key=lambda w: w[1])
                total, partes = _int(col[0][4]), sum(_int(w[4]) for w in col[1:])
                if partes and abs(partes - total) > 3:
                    print(f"[AVISO] Carga EFE: TKBC {anio} en {os.path.basename(path)} (pág. {i + 1}): "
                          f"los sectores suman {partes:,} y el total dice {total:,}")
                if anio not in tkbc_porteador:
                    tkbc_porteador[anio] = {'valor': total, 'porteadores': None, 'pagina': i + 1}
            mem.paginas.setdefault('tkbc_porteador', i + 1)
            break
    if not tkbc_porteador:
        # Memoria Anual 2019, pág. 65: "PEAJE VARIABLE 6.205.714 6.591.743 (386.028) -5,9% 3.101 3.411
        # (310) -9,1% Fepasa 4.274.283 ... 2.128 2.399 -271 -11,3% Transap ...", con los años en el
        # encabezado "Al 31 de diciembre 2019 M$ Al 31 de diciembre 2018 M$". De las TKBC se toma
        # solo el año de la Memoria (2018 ya viene de la Memoria 2018)
        fila = (r'(' + NUM + r') (' + NUM + r') \(?-?' + NUM + r'\)? -?' + DEC + r' ?% '
                r'(' + NUM + r') (' + NUM + r') \(?-?' + NUM + r'\)? -?' + DEC + r' ?%')
        m = mem.buscar('tkbc_tabla_2019', r'PEAJE VARIABLE ' + fila + r'((?: [A-Z][a-záéíóúñ]+ ' + fila + r')+)',
                       flags=0, opcional=True)
        if m:
            pagina = mem.pages[mem.paginas['tkbc_tabla_2019'] - 1]
            ma = re.search(r'Al 31 de diciembre (\d{4}) M\$ Al 31 de diciembre (\d{4}) M\$', pagina, re.IGNORECASE)
            filas = re.findall(r'([A-Z][a-záéíóúñ]+) ' + fila, m.group(5))
            if ma and filas:
                tkbc_porteador[int(ma.group(1))] = {'valor': _int(m.group(3)),
                                                    'porteadores': {f[0]: _int(f[3]) for f in filas}}
                mem.paginas['tkbc_porteador'] = mem.paginas['tkbc_tabla_2019']
    if not tkbc_porteador and mem.debe_avisar('tkbc_porteador', opcional=True):
        _avisar('tkbc_porteador', path)
    r['tkbc_porteador'] = tkbc_porteador

    m = mem.buscar('promedio_mensual', r'(' + NUM + r') toneladas de carga promedio mensual'
                   r'|carga promedio mensual transportada alcanza las (' + NUM + r') toneladas'
                   r'|(' + NUM + r') Carga Promedio Mensual Transportada'
                   r'|(' + NUM + r') TONELADAS Carga promedio mensual transportada')
    r['promedio_mensual_t'] = _int(m.group(1) or m.group(2) or m.group(3) or m.group(4)) if m else None

    m = mem.buscar('variacion', r'crecimiento aproximado de (' + DEC + r') ?% respecto del año (\d{4})')
    r['variacion'] = {'pct': _dec(m.group(1)), 'respecto': int(m.group(2))} if m else None

    # Total del año: "9,03 millones de toneladas de productos" (2024-2025) o, en la Memoria 2022,
    # "se transportaron 9.400.913 toneladas de materias" (exacto, queda también en `toneladas_t`)
    m = mem.buscar('toneladas_texto', r'(' + DEC + r') millones de toneladas de productos'
                   r'|se transportaron (' + NUM + r') toneladas de materias', opcional=True)
    r['toneladas_t'] = _int(m.group(2)) if m and m.group(2) else None
    r['toneladas_mm'] = (_dec(m.group(1)) if m.group(1) else round(r['toneladas_t'] / 1e6, 2)) if m else None
    if m:
        mem.paginas['toneladas'] = mem.paginas['toneladas_texto']
    r['toneladas_calculadas'] = False
    r['toneladas_zonas'] = None
    if r['toneladas_mm'] is None and not r['promedio_mensual_t']:
        # Memoria Anual 2019, pág. 36: "El mercado de trasporte de carga se puede dividir en tres
        # zonas geográficas" y da las toneladas de cada una; el total del año es la suma
        m_z = mem.buscar('toneladas_zonas', r'se puede dividir en (?:tres|\d) zonas geográficas', opcional=True)
        if m_z and mem.anio:
            pagina = mem.pages[mem.paginas['toneladas_zonas'] - 1]
            nombres = re.findall(r'\b[a-c]\) Zona (\w+)', pagina)
            valores = re.findall(r'(?:Durante el|durante el año) ' + str(mem.anio) + r',? se transportaron (' + NUM + r') '
                                 r'(?:millones de )?toneladas', pagina)
            if nombres and len(nombres) == len(valores):
                r['toneladas_zonas'] = [{'zona': n.capitalize(), 'toneladas': _int(v)} for n, v in zip(nombres, valores)]
                r['toneladas_t'] = sum(z['toneladas'] for z in r['toneladas_zonas'])
                r['toneladas_mm'] = round(r['toneladas_t'] / 1e6, 2)
                mem.paginas['toneladas'] = mem.paginas['toneladas_zonas']
            else:
                print(f"[AVISO] Carga EFE: {os.path.basename(path)}: {len(nombres)} zonas y {len(valores)} cifras de toneladas")
    if r['toneladas_mm'] is None and r['promedio_mensual_t']:
        # La Memoria 2023 solo dice "8 millones": se usa el promedio mensual × 12 (8.003.796 t)
        r['toneladas_t'] = r['promedio_mensual_t'] * 12
        r['toneladas_mm'] = round(r['toneladas_t'] / 1e6, 2)
        r['toneladas_calculadas'] = True
        mem.paginas['toneladas'] = mem.paginas.get('promedio_mensual')
    elif r['toneladas_mm'] is None and mem.debe_avisar('toneladas'):
        _avisar('toneladas', path)

    productos = []
    if m and not r['toneladas_calculadas']:
        pagina = mem.pages[mem.paginas['toneladas_texto'] - 1]
        bloque = pagina[m.end():]
        fin = re.search(r'unidades intermodales|TEU', bloque)
        bloque = bloque[:fin.start()] if fin else bloque[:600]
        # Memoria 2025: "• Celulosa: 4.915.569" (toneladas exactas)
        for pm in re.finditer(r'•\s*([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ ]*?):\s*(' + NUM + r')\b', bloque):
            productos.append({'nombre': _nombre_producto(pm.group(1)), 'toneladas': _int(pm.group(2))})
        # Memoria 2024: "4,4 Mill Ton Celulosa" (millones de t redondeados a una décima)
        if not productos:
            for pm in re.finditer(r'(' + DEC + r') Mill Ton ([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ ]*?)(?= \d| \(|$)', bloque):
                productos.append({'nombre': _nombre_producto(pm.group(2)), 'toneladas': round(_dec(pm.group(1)) * 1e6)})
            r['productos_redondeados'] = bool(productos)
    if not productos and mem.debe_avisar('productos'):
        _avisar('productos', path)
    r['productos'] = productos
    r.setdefault('productos_redondeados', False)

    # ── Unidades intermodales (TEU) ─────────────────────────────────────────
    teu = {}
    m = mem.buscar('teu_tabla', r'VARIABLES?/ ?AÑOS? ((?:\d{4} )+)Número total de unidades intermodales '
                   r'transportadas \(TEU\) ((?:' + NUM + r' ?)+)', opcional=True)
    if m:   # Memoria 2024: tabla "Número de unidades intermodales transportadas"
        anios = [int(a) for a in m.group(1).split()]
        teu.update(zip(anios, [_int(v) for v in m.group(2).split()][:len(anios)]))
        mem.paginas['teu'] = mem.paginas['teu_tabla']
    if not teu:   # Memoria 2023: "Las unidades intermodales (...) para el año 2023 son: 57.948 TEU"
        m = mem.buscar('teu_frase', r'unidades intermodales .{0,120}?para el año (\d{4}) son:? (' + NUM + r') TEU',
                       opcional=True)
        if m:
            teu[int(m.group(1))] = _int(m.group(2))
            mem.paginas['teu'] = mem.paginas['teu_frase']
    m = None if teu else mem.buscar('teu', r'unidades intermodales transportadas.{0,400}?TEU')
    if m:   # Memoria 2025: el dato viene en el texto
        pagina = mem.pages[mem.paginas['teu'] - 1]
        texto = pagina[m.start():m.start() + 700]
        for tm in re.finditer(r'entre (\d{4}) y (\d{4}) con (' + NUM + r') TEU', texto):
            teu[int(tm.group(1))] = teu[int(tm.group(2))] = _int(tm.group(3))
        for tm in re.finditer(r'\b[Ee]n (\d{4}),? .{0,80}?(' + NUM + r') TEU', texto):
            teu.setdefault(int(tm.group(1)), _int(tm.group(2)))
    r['teu'] = teu

    # ── Meta 2030 ────────────────────────────────────────────────────────────
    meta = {}
    m = mem.buscar('meta', r'Duplicar la carga transportada al (\d{4}) y llegar a (' + NUM + r') millones de toneladas')
    if m:
        meta = {'anio': int(m.group(1)), 'tkbc_mm': _int(m.group(2))}
    m = mem.buscar('meta_toneladas', r'equivalentes a aproximadamente (' + DEC + r') millones de toneladas')
    if m:
        meta['toneladas_mm'] = _dec(m.group(1))
    r['meta'] = meta or None

    # ── Contexto ─────────────────────────────────────────────────────────────
    ctx = {}
    m = mem.buscar('camiones_por_tren', r'reemplazar entre (\d+) y (\d+) camiones')
    if m:
        ctx['camiones_por_tren'] = [int(m.group(1)), int(m.group(2))]
    m = mem.buscar('eficiencia_combustible', r'aproximadamente (' + DEC + r') veces más eficiente en el uso de combustible')
    if m:
        ctx['eficiencia_combustible'] = _dec(m.group(1))
    m = mem.buscar('reduccion_emisiones', r'reducciones superiores al (\d+) ?% en emisiones')
    if m:
        ctx['reduccion_emisiones_pct'] = int(m.group(1))
    m = mem.buscar('efe_sur_pct', r'tráfico de carga correspondiente a más del (\d+) ?%')
    if m:
        ctx['efe_sur_pct'] = int(m.group(1))
    m = mem.buscar('contrato_anios', r'continuidad operacional por los próximos (\d+) años')
    if m:
        ctx['contrato_porteadores_anios'] = int(m.group(1))
    bimodal = {}
    m = mem.buscar('bimodal_km', r'corredor ferroviario de más de (' + NUM + r') kilómetros')
    if m:
        bimodal['km'] = _int(m.group(1))
    m = mem.buscar('bimodal_co2', r'reducción del (\d+) ?% en las emisiones de CO2')
    if m:
        bimodal['reduccion_co2_pct'] = int(m.group(1))
    m = mem.buscar('bimodal_camiones', r'cada tren reemplace a (\d+) camiones')
    if m:
        bimodal['camiones_por_tren'] = int(m.group(1))
    ctx['bimodal'] = bimodal or None
    r['contexto'] = ctx

    r['paginas'] = mem.paginas
    return r


def _memorias():
    paths = sorted(set(glob.glob(os.path.join(EFE_MEMORIA_DIR, '*Memoria*.pdf')) +
                       glob.glob(os.path.join(EFE_MEMORIA_DIR, '*memoria*.pdf')) +
                       glob.glob(os.path.join(EFE_MEMORIA_DIR, '*Reporte*Integrado*.pdf'))))
    return paths


def main():
    paths = _memorias()
    if not paths:
        raise FileNotFoundError(f"No hay Memorias Integradas en PDF en {EFE_MEMORIA_DIR}")
    def anio_de(p):
        m = re.search(r'(20\d{2})', os.path.basename(p))
        return int(m.group(1)) if m else 0
    paths.sort(key=anio_de)
    leidas = []
    for i, p in enumerate(paths):
        print(f"  -> Leyendo {os.path.basename(p)}")
        leidas.append((p, leer_memoria(p, principal=(i == len(paths) - 1))))
    leidas = [x for x in leidas if x[1]['anio']]
    leidas.sort(key=lambda x: x[1]['anio'])
    path, ult = leidas[-1]

    if ult['tkbc_mm'] is None and not ult['productos']:
        raise ValueError(f"No se encontró el volumen de carga ni los productos en {os.path.basename(path)}: "
                         "no se reescribe efe_carga.js")

    # Validaciones cruzadas
    if ult['productos'] and ult['toneladas_mm']:
        suma = sum(p['toneladas'] for p in ult['productos'])
        if abs(suma / 1e6 - ult['toneladas_mm']) > 0.01:
            print(f"[AVISO] Carga EFE: los productos suman {suma:,} t y la Memoria dice {ult['toneladas_mm']} millones")
    if ult['promedio_mensual_t'] and ult['toneladas_mm']:
        anual = ult['promedio_mensual_t'] * 12 / 1e6
        if abs(anual - ult['toneladas_mm']) / ult['toneladas_mm'] > 0.02:
            print(f"[AVISO] Carga EFE: promedio mensual × 12 = {anual:.2f} millones de t, distinto de {ult['toneladas_mm']}")

    # Series: cada Memoria aporta su año; en años repetidos manda la más reciente
    def serie(clave, campo_pag):
        """Valores por año de `clave`, con la Memoria y página de donde sale cada uno."""
        out, origen = {}, {}
        for p, r in leidas:
            for a, v in (r[clave] or {}).items():
                if a in out and out[a] != v and DIFERENCIAS_REVISADAS.get((clave, a)) != v:
                    print(f"[AVISO] Carga EFE: {clave} {a}: {os.path.basename(origen[a][0])} dice {out[a]:,} y "
                          f"{os.path.basename(p)} dice {v:,}; se usa la más reciente")
                out[a] = v
                origen[a] = (p, f"{r['documento']}, pág. {r['paginas'].get(campo_pag)}")
        return [{'anio': a, 'valor': v, 'fuente': origen[a][1]} for a, v in sorted(out.items())]

    # Productos por año: cada Memoria informa los de su propio año (2023 no desglosa por producto;
    # 2024 en millones de t redondeados a una décima, `redondeado`; 2025 en toneladas exactas)
    productos_serie = [{
        'anio': r['anio'],
        'redondeado': r['productos_redondeados'],
        'fuente': f"{r['documento']}, pág. {r['paginas'].get('toneladas_texto')}",
        'productos': r['productos'],
    } for _, r in leidas if r['productos']]

    # Toneladas por año: cada Memoria informa las de su propio año. Si no da el total exacto
    # (Memoria 2023: "8 millones"), se calcula como promedio mensual × 12 (`calculado`).
    toneladas_serie = [{
        'anio': r['anio'],
        'valor_mm': r['toneladas_mm'],
        'toneladas_t': r['toneladas_t'],
        'promedio_mensual_t': r['promedio_mensual_t'],
        'calculado': r['toneladas_calculadas'],
        'zonas': r['toneladas_zonas'],
        'fuente': f"{r['documento']}, pág. {r['paginas'].get('toneladas')}",
    } for _, r in leidas if r['toneladas_mm'] is not None]

    # Serie de TKBC por año: las tablas por porteador y el total de "Cifras consolidadas" de cada
    # Memoria (en años repetidos manda la más reciente; el total del año de la Memoria, sobre su
    # tabla), más los años de EFE_TKBC_MANUAL que ninguna Memoria trae.
    tkbc = {}
    for p, r in leidas:
        for anio, d in r['tkbc_porteador'].items():
            previo = tkbc.get(anio)
            if previo and previo.get('porteadores') and not d['porteadores'] and abs(previo['valor'] - d['valor']) <= 1:
                continue   # ej. 2018: la Memoria 2018 lo desglosa por porteador y el Reporte 2020 no
            tkbc[anio] = {'anio': anio, 'valor': d['valor'], 'porteadores': d['porteadores'],
                          'fuente': f"{r['documento']}, pág. {d.get('pagina') or r['paginas'].get('tkbc_porteador')}"}
        if r['tkbc_mm'] is not None:
            previo = tkbc.get(r['anio'], {})
            if previo and previo['valor'] != r['tkbc_mm']:
                print(f"[AVISO] Carga EFE: TKBC {r['anio']}: la tabla por porteador da {previo['valor']} "
                      f"y Cifras consolidadas {r['tkbc_mm']}; se usa Cifras consolidadas")
            tkbc[r['anio']] = {'anio': r['anio'], 'valor': r['tkbc_mm'],
                               'porteadores': previo.get('porteadores') if previo.get('valor') == r['tkbc_mm'] else None,
                               'fuente': f"{r['documento']}, pág. {r['paginas'].get('tkbc')}"}
    for anio, d in EFE_TKBC_MANUAL.items():
        if anio in tkbc:
            if tkbc[anio]['valor'] != d['valor']:
                print(f"[AVISO] Carga EFE: TKBC {anio} de EFE_TKBC_MANUAL ({d['valor']}) distinto del PDF "
                      f"({tkbc[anio]['valor']}); se usa el PDF. Revisar EFE_TKBC_MANUAL.")
            continue
        suma = sum(d['porteadores'].values())
        if suma != d['valor']:
            print(f"[AVISO] Carga EFE: TKBC {anio} de EFE_TKBC_MANUAL: los porteadores suman {suma}, no {d['valor']}")
        tkbc[anio] = {'anio': anio, 'valor': d['valor'], 'porteadores': d['porteadores'], 'fuente': d['fuente']}
    tkbc_serie = [tkbc[a] for a in sorted(tkbc)]

    payload = {
        'fuente': {
            'documento': ult['documento'],
            'archivo': os.path.basename(path),
            'memorias': [os.path.basename(p) for p, _ in leidas],
        },
        'anio': ult['anio'],
        'tkbc_mm': ult['tkbc_mm'],
        'tkbc_serie': tkbc_serie,
        'toneladas_mm': ult['toneladas_mm'],
        'promedio_mensual_t': ult['promedio_mensual_t'],
        'variacion': ult['variacion'],
        'productos': ult['productos'],
        'productos_serie': productos_serie,
        'teu': serie('teu', 'teu'),
        'meta': ult['meta'],
        'contexto': ult['contexto'],
        'toneladas_serie': toneladas_serie,
        'paginas': ult['paginas'],
    }
    txt = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('window.EFE_CARGA = ' + txt + ';')

    print(f"OK Carga EFE generado: {OUT_JS} ({os.path.getsize(OUT_JS) / 1024:.1f} KB) desde {os.path.basename(path)}")
    print(f"   TKBC {[(d['anio'], d['valor']) for d in tkbc_serie]} · "
          f"MM t {[(d['anio'], d['valor_mm']) for d in toneladas_serie]} · {len(ult['productos'])} productos · "
          f"TEU {[(d['anio'], d['valor']) for d in payload['teu']]}")


main()
