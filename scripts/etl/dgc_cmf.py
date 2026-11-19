"""Estados financieros de las sociedades concesionarias (CMF) para la ficha de DGC.html.

Lo usa scripts/actualizar_dgc.py en dos pasos, después de dgc_datos (lee su contracts_data.js):

  descargar()  Baja los listados de entidades de la CMF (Registro de Valores y Registro Especial de
               Entidades Informantes, vigentes y no vigentes) a Bases de dato/DGC/CMF/_entidades.json
               y, para cada RUT de sociedad concesionaria de contracts_data.js que figure en ellos,
               el XBRL de los estados financieros anuales (diciembre) de ANIO_INI al último año
               cerrado, en Bases de dato/DGC/CMF/<RUT>/<año>_<I|C>.zip (I: individual,
               C: consolidado). Es reanudable: lo anotado en _registro.jsonl como "ok" no se vuelve
               a pedir, los errores se reintentan y los años sin XBRL solo se reintentan si son el
               último año (la CMF los publica entre marzo y abril).
  escribir()   Lee los XBRL descargados y escribe static/data/dgc_cmf.js (window.DGC_CMF).

Cada XBRL trae el año que informa y el anterior: un año sin archivo propio se completa con la
columna comparativa del archivo del año siguiente. Las cifras se toman por fecha de los contextos
(cada software los nombra distinto) y sin dimensiones (el total, no un desglose), buscando el
concepto por su nombre sin prefijo (en 2012 era ifrs:, hoy ifrs-full:).
"""
import glob
import html
import json
import os
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import date, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONTRACTS_JS = os.path.join(ROOT, 'static', 'data', 'contracts_data.js')
OUT_JS = os.path.join(ROOT, 'static', 'data', 'dgc_cmf.js')
CMF_DIR = os.path.join(ROOT, 'Bases de dato', 'DGC', 'CMF')
ENTIDADES_JSON = os.path.join(CMF_DIR, '_entidades.json')
LOG_PATH = os.path.join(CMF_DIR, '_registro.jsonl')

ANIO_INI = 2021                      # primer año que se muestra en la ficha
ANIO_FIN = date.today().year - 1     # último año cerrado (sus EEFF anuales salen en marzo-abril)
PAUSA = 0.5                          # segundos entre pedidos a la CMF
REINTENTOS = 3

CMF_BASE = 'https://www.cmfchile.cl/institucional/mercados/'
CMF_LISTADO = CMF_BASE + 'consulta.php?mercado=V&Estado={vig}&entidad={tipo}'
CMF_FICHA = CMF_BASE + 'entidad.php?mercado=V&rut={rut}&grupo=&tipoentidad={tipo}&vig={vig}&control=svs&pestania=3'
# Orden de preferencia del registro con que se consulta cada RUT (algunas sociedades están en varios).
REGISTROS = [('RVEMI', 'VI'), ('RGEIN', 'VI'), ('RVEMI', 'NV'), ('RGEIN', 'NV')]
REGISTRO_NOMBRE = {'RVEMI': 'Registro de Valores', 'RGEIN': 'Registro Especial de Entidades Informantes'}
UA = {'User-Agent': 'Mozilla/5.0'}

# Conceptos de la taxonomía IFRS que se leen. 'flujo': del año (1-ene a 31-dic); 'saldo': al 31-dic.
CONCEPTOS = {
    'ingresos': ('flujo', ['Revenue']),
    'resultado_operacional': ('flujo', ['ProfitLossFromOperatingActivities']),
    'utilidad': ('flujo', ['ProfitLoss']),
    'flujo_operacional': ('flujo', ['CashFlowsFromUsedInOperatingActivities']),
    'activos': ('saldo', ['Assets']),
    'pasivos': ('saldo', ['Liabilities']),
    'patrimonio': ('saldo', ['Equity']),
    'caja': ('saldo', ['CashAndCashEquivalents']),
    # Deuda financiera: otros pasivos financieros corrientes + no corrientes (bonos y préstamos).
    'deuda_financiera': ('saldo', ['OtherCurrentFinancialLiabilities', 'OtherNoncurrentFinancialLiabilities']),
}
TEXTOS = {'auditor': 'NombreEmpresaAuditoriExterna', 'opinion': 'TipoOpinionEEFFDiciembre'}


# ── Datos de DGC ───────────────────────────────────────────────────────────────

def rut_cuerpo(rut):
    """'78.159.936-0' → '78159936'; None si no es un RUT."""
    s = str(rut or '').strip()
    m = re.match(r'^([\d.\s]+)\s*-\s*[\dkK]$', s) or re.match(r'^(\d{7,8})$', s)
    if not m:
        return None
    cuerpo = re.sub(r'\D', '', m.group(1))
    return cuerpo if 6 <= len(cuerpo) <= 8 else None


def sociedades_dgc():
    """{rut_cuerpo: {'rut', 'nombre', 'codigos': [...]}} de contracts_data.js."""
    text = open(CONTRACTS_JS, encoding='utf-8').read()
    rows = json.loads(text[text.index('{'):text.rindex('}') + 1])['data']
    out = {}
    for r in rows:
        k = {c.strip(): c for c in r}
        rut = r.get(k.get('Rut sociedad Concesionaria', ''), '')
        cuerpo = rut_cuerpo(rut)
        if not cuerpo:
            continue
        s = out.setdefault(cuerpo, {'rut': str(rut).strip(), 'nombre': (r.get(k.get('Nombre sociedad concesionaria', '')) or '').strip(), 'codigos': []})
        s['codigos'].append(r.get(k.get('Código proyecto', '')))
    return out


# ── CMF ────────────────────────────────────────────────────────────────────────

def _get(url, data=None):
    for i in range(REINTENTOS):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            return urllib.request.urlopen(req, timeout=90).read()
        except Exception as e:
            err = e
            time.sleep(5 * (i + 1))
    raise err


def bajar_entidades():
    """Listados de entidades de la CMF → {rut_cuerpo: [[tipo, vig, nombre], ...]} (también a _entidades.json)."""
    out = {}
    for tipo in ('RVEMI', 'RGEIN'):
        for vig in ('VI', 'NV'):
            h = _get(CMF_LISTADO.format(tipo=tipo, vig=vig)).decode('latin-1')
            for m in re.finditer(r'rut=(\d+)[^"]*"[^>]*>([^<]+)<', h):
                fila = [tipo, vig, html.unescape(m.group(2)).strip()]
                if fila not in out.setdefault(m.group(1), []):
                    out[m.group(1)].append(fila)
            time.sleep(PAUSA)
    if len(out) < 500:   # hoy son ~1.600: menos es una página cambiada o caída, no se pisa el caché
        raise RuntimeError(f'Los listados de la CMF trajeron solo {len(out)} entidades')
    os.makedirs(CMF_DIR, exist_ok=True)
    with open(ENTIDADES_JSON, 'w', encoding='utf-8') as f:
        json.dump({'fecha': date.today().isoformat(), 'entidades': out}, f, ensure_ascii=False)
    return out


def leer_entidades():
    if not os.path.exists(ENTIDADES_JSON):
        return {}
    return json.load(open(ENTIDADES_JSON, encoding='utf-8'))['entidades']


def registro_preferido(filas):
    regs = {(t, v) for t, v, _ in filas}
    return next(r for r in REGISTROS if r in regs)


def _leer_log():
    ultimo = {}
    if os.path.exists(LOG_PATH):
        for line in open(LOG_PATH, encoding='utf-8'):
            e = json.loads(line)
            ultimo[(e['rut'], e['anio'])] = e
    return ultimo


def _anotar(**e):
    e['fecha'] = datetime.now().isoformat(timespec='seconds')
    with open(LOG_PATH, 'a', encoding='utf-8') as f:
        f.write(json.dumps(e, ensure_ascii=False) + '\n')


def pendientes(entidades=None):
    """[(rut, año)] por pedir a la CMF según _registro.jsonl."""
    entidades = entidades if entidades is not None else leer_entidades()
    log = _leer_log()
    out = []
    for rut in sorted(sociedades_dgc()):
        if rut not in entidades:
            continue
        for anio in range(ANIO_INI, ANIO_FIN + 1):
            e = log.get((rut, anio))
            if e is None or e['estado'] == 'error' or (e['estado'] == 'sin_xbrl' and anio == ANIO_FIN):
                out.append((rut, anio))
    return out


def bajar_xbrl(rut, anio, tipo_ent, vig):
    """Pide los EEFF de diciembre de `anio` (individual y, si no hay, consolidado) y guarda el XBRL."""
    url = CMF_FICHA.format(rut=rut, tipo=tipo_ent, vig=vig)
    sin_dato = True
    for tipo in ('I', 'C'):
        data = urllib.parse.urlencode({'forma': 'F', 'mm': '12', 'aa': str(anio), 'tipo': tipo, 'tipo_norma': 'IFRS'}).encode()
        h = _get(url, data).decode('latin-1')
        time.sleep(PAUSA)
        m = re.search(r'href="([^"]+)"[^>]*>\s*Estados financieros \(XBRL\)', h)
        if m:
            z = _get(urllib.parse.urljoin(url, html.unescape(m.group(1))))
            time.sleep(PAUSA)
            # Según el software con que la sociedad lo generó, la CMF entrega un ZIP o el .xbrl suelto.
            if z.startswith(b'PK'):
                ext = 'zip'
            elif b'xbrl' in z[:3000].lower() and z.lstrip().startswith(b'<'):
                ext = 'xbrl'
            else:
                raise RuntimeError('la descarga no es un ZIP ni un XBRL')
            carpeta = os.path.join(CMF_DIR, rut)
            os.makedirs(carpeta, exist_ok=True)
            with open(os.path.join(carpeta, f'{anio}_{tipo}.{ext}'), 'wb') as f:
                f.write(z)
            return 'ok', tipo
        if 'No existe informaci' not in h and 'Estados financieros (PDF)' not in h:
            sin_dato = False   # página inesperada: se anota como error y se reintenta
    return ('sin_xbrl' if sin_dato else 'error'), None


def descargar():
    entidades = bajar_entidades()
    print(f'Listados de la CMF: {len(entidades)} entidades')
    pend = pendientes(entidades)
    print(f'XBRL por pedir: {len(pend)} (sociedad, año) de {ANIO_INI} a {ANIO_FIN}')
    n_ok = n_err = 0
    for i, (rut, anio) in enumerate(pend, 1):
        tipo_ent, vig = registro_preferido(entidades[rut])
        try:
            estado, tipo = bajar_xbrl(rut, anio, tipo_ent, vig)
        except Exception as e:
            estado, tipo = 'error', None
            print(f'  {rut} {anio}: error ({e})')
        _anotar(rut=rut, anio=anio, estado=estado, tipo=tipo)
        n_ok += estado == 'ok'
        n_err += estado == 'error'
        if i % 25 == 0:
            print(f'  {i}/{len(pend)}', flush=True)
    print(f'Descargados {n_ok} XBRL; {n_err} con error (se reintentan en la próxima corrida)')
    if n_err:
        print(f'[AVISO] {n_err} pedidos a la CMF fallaron: volver a correr actualizar_dgc.py para reintentarlos')


# ── Lectura del XBRL ───────────────────────────────────────────────────────────

def _local(tag):
    return tag.rsplit('}', 1)[-1]


def leer_xbrl(path):
    """{'moneda', 'flujo': {año: {concepto: valor}}, 'saldo': {año: {...}}, 'textos': {...}} de un ZIP o .xbrl de la CMF."""
    if path.lower().endswith('.zip'):
        with zipfile.ZipFile(path) as z:
            nombre = next(n for n in z.namelist() if n.lower().endswith('.xbrl'))
            root = ET.fromstring(z.read(nombre))
    else:
        root = ET.fromstring(open(path, 'rb').read())
    contextos = {}
    for c in root.iter():
        if _local(c.tag) != 'context':
            continue
        fechas = {_local(e.tag): (e.text or '').strip() for e in c.iter() if _local(e.tag) in ('startDate', 'endDate', 'instant')}
        dims = any(_local(e.tag) in ('explicitMember', 'typedMember') for e in c.iter())
        contextos[c.get('id')] = (fechas.get('startDate'), fechas.get('endDate') or fechas.get('instant'), dims)
    # unitRef es un id ('CLP', 'ID16'...): la moneda es el <measure> de esa unidad ('iso4217:CLP' → 'CLP').
    unidades = {}
    for u in root.iter():
        if _local(u.tag) == 'unit':
            medida = next((m.text or '' for m in u.iter() if _local(m.tag) == 'measure'), '')
            unidades[u.get('id')] = medida.split(':')[-1].strip().upper()
    buscados = {n for _, ns in CONCEPTOS.values() for n in ns}
    out = {'moneda': None, 'flujo': {}, 'saldo': {}, 'textos': {}}
    for e in root:
        nom = _local(e.tag)
        ctx = contextos.get(e.get('contextRef'))
        if not ctx or ctx[2]:
            continue
        ini, fin, _ = ctx
        if nom in TEXTOS.values() and (e.text or '').strip():
            out['textos'].setdefault(nom, (e.text or '').strip())
            continue
        if nom not in buscados or not fin or not fin.endswith('-12-31'):
            continue
        try:
            valor = float(e.text)
        except (TypeError, ValueError):
            continue
        anio = int(fin[:4])
        unidad = unidades.get(e.get('unitRef')) or (e.get('unitRef') or '').upper()
        out['moneda'] = out['moneda'] or unidad
        if ini and ini == f'{anio}-01-01':
            out['flujo'].setdefault(anio, {}).setdefault(nom, valor)
        if not ini or ini == f'{anio}-01-01':
            out['saldo'].setdefault(anio, {}).setdefault(nom, valor)
    return out


def limpiar_auditor(texto):
    """'[81513400-1] \\tPRICEWATERHOUSECOOPERS ...' → 'PRICEWATERHOUSECOOPERS ...'."""
    return re.sub(r'\s+', ' ', re.sub(r'^\s*\[[^\]]*\]', '', texto or '')).strip() or None


def limpiar_opinion(texto):
    """Algunos XBRL traen la tilde dañada ('Opini�n sin salvedades'): se normaliza por palabras clave."""
    t = (texto or '').lower()
    for clave, nombre in (('sin salvedad', 'Sin salvedades'), ('con salvedad', 'Con salvedades'),
                          ('adversa', 'Adversa'), ('abstenci', 'Abstención de opinión')):
        if clave in t:
            return nombre
    return (texto or '').strip() or None


def cifras_del_anio(x, anio):
    """{campo: millones} de un XBRL ya leído para `anio` (None en lo que no trae)."""
    res = {}
    for campo, (clase, nombres) in CONCEPTOS.items():
        datos = x[clase].get(anio, {})
        vals = [datos[n] for n in nombres if n in datos]
        res[campo] = round(sum(vals) / 1e6, 1) if vals else None
    return res


# ── Salida ─────────────────────────────────────────────────────────────────────

def escribir():
    entidades = leer_entidades()
    if not entidades:
        raise RuntimeError(f'No está {ENTIDADES_JSON}: correr actualizar_dgc.py sin --sin-descargas una vez')
    dgc = sociedades_dgc()
    sociedades, sin_cmf = {}, []
    for rut, s in sorted(dgc.items()):
        if rut not in entidades:
            sin_cmf.append(f"{s['rut']} ({', '.join(c for c in s['codigos'] if c)})")
            continue
        tipo_ent, vig = registro_preferido(entidades[rut])
        nombre_cmf = next(n for t, v, n in entidades[rut] if (t, v) == (tipo_ent, vig))
        leidos = {}
        for path in glob.glob(os.path.join(CMF_DIR, rut, '*')):
            m = re.match(r'(\d{4})_([IC])\.(zip|xbrl)$', os.path.basename(path))
            if m and ANIO_INI <= int(m.group(1)) <= ANIO_FIN + 1:
                try:
                    leidos[int(m.group(1))] = (m.group(2), leer_xbrl(path))
                except Exception as e:
                    print(f'[AVISO] {rut}: no se pudo leer {os.path.basename(path)} ({e})')
        anios, monedas = {}, set()
        for anio in range(ANIO_INI, ANIO_FIN + 1):
            # Cifras del archivo de ese año; lo que falte, de la columna comparativa del año siguiente.
            propio, siguiente = leidos.get(anio), leidos.get(anio + 1)
            if not propio and not siguiente:
                continue
            c = cifras_del_anio(propio[1], anio) if propio else {k: None for k in CONCEPTOS}
            fuente = anio if propio else anio + 1
            if siguiente:
                c2 = cifras_del_anio(siguiente[1], anio)
                for k, v in c.items():
                    if v is None and c2[k] is not None:
                        c[k] = c2[k]
            if all(v is None for v in c.values()):
                continue
            c['archivo'] = fuente
            c['tipo'] = (propio or siguiente)[0]
            anios[anio] = c
            monedas.add((propio or siguiente)[1]['moneda'])
        ultimo = leidos[max(leidos)][1]['textos'] if leidos else {}
        moneda = sorted(m for m in monedas if m)
        if len(moneda) > 1:
            print(f'[AVISO] {rut}: monedas distintas entre años ({moneda})')
        if moneda and moneda[0] != 'CLP':
            print(f'[AVISO] {rut}: informa en {moneda[0]}, no en pesos')
        sociedades[rut] = {
            'rut': s['rut'],
            'nombre': nombre_cmf,
            'registro': REGISTRO_NOMBRE[tipo_ent],
            'vigente': vig == 'VI',
            'url': CMF_FICHA.format(rut=rut, tipo=tipo_ent, vig=vig),
            'moneda': moneda[0] if moneda else None,
            'auditor': limpiar_auditor(ultimo.get(TEXTOS['auditor'])),
            'opinion': limpiar_opinion(ultimo.get(TEXTOS['opinion'])),
            'anio_auditoria': max(leidos) if leidos else None,
            'anios': anios,
        }
    con = sum(1 for s in sociedades.values() if s['anios'])
    print(f'Sociedades de DGC en la CMF: {len(sociedades)} ({con} con EEFF {ANIO_INI}-{ANIO_FIN}); '
          f'RUT que no figuran en la CMF: {len(sin_cmf)}')
    for x in sin_cmf:
        print(f'  sin registro en la CMF: {x}')
    pend = pendientes(entidades)
    if pend:
        print(f'[AVISO] {len(pend)} (sociedad, año) sin pedir o con error a la CMF: correr sin --sin-descargas')
    payload = {
        'fuente': 'Comisión para el Mercado Financiero (CMF), estados financieros anuales en XBRL',
        'generado': date.today().isoformat(),
        'anio_ini': ANIO_INI,
        'anio_fin': ANIO_FIN,
        'sociedades': sociedades,
    }
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write('window.DGC_CMF = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'Escrito {os.path.relpath(OUT_JS, ROOT)} ({os.path.getsize(OUT_JS) / 1024:.0f} KB)')
