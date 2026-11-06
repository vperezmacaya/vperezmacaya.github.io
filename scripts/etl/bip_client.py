"""Cliente de BIP Consulta (bip.ministeriodesarrollosocial.gob.cl): búsqueda por código BIP y descarga de fichas IDI.

El sitio es JSF/PrimeFaces sobre Spring Web Flow: cada búsqueda es un "flujo"
(execution=eNsM) con su javax.faces.ViewState; la ficha se genera con un clic AJAX
en la fila y se descarga con el botón "Descargar" del diálogo.
"""
import re
import time
from bs4 import BeautifulSoup
import requests

BASE = 'https://bip.ministeriodesarrollosocial.gob.cl'
FLOW = BASE + '/bip2-consulta/app/parent-flow'
PAUSE = 1.5          # segundos entre pedidos (no cargar el servidor)
AJAX = {'Faces-Request': 'partial/ajax', 'X-Requested-With': 'XMLHttpRequest'}
COLS = ['codigo', 'descripcion', 'anio_postulacion', 'tipologia', 'sector', 'subsector', 'fuente', 'rate',
        'solicitado_anio', 'etapa_actual', 'inst_financiera', 'inst_formuladora', 'costo_total']


def _num(s):
    s = (s or '').replace('.', '').replace(',', '.').strip()
    try:
        return float(s)
    except ValueError:
        return None


def _fields(soup):
    """Campos que el navegador enviaría (los <form> anidados se aplanan en uno)."""
    data = {}
    for el in soup.find_all(['input', 'select']):
        n = el.get('name')
        if not n:
            continue
        if el.name == 'select':
            opt = el.find('option', selected=True) or el.find('option')
            data.setdefault(n, opt.get('value', opt.get_text()) if opt else '')
        elif el.get('type') in ('hidden', 'text', None):
            data.setdefault(n, el.get('value', ''))
    return data


class BipClient:
    def __init__(self, user_agent='CATLEC-Observatorio (Universidad de Concepcion) - fichas IDI'):
        self.s = requests.Session()
        self.s.headers['User-Agent'] = user_agent
        self.soup = None
        self.action = None

    def _post(self, data, ajax=False, timeout=120):
        time.sleep(PAUSE)
        r = self.s.post(self.action, data=data, headers=AJAX if ajax else None, timeout=timeout)
        r.raise_for_status()
        return r

    def _set_page(self, html):
        self.soup = BeautifulSoup(html, 'html.parser')
        form = self.soup.find('form')
        self.action = BASE + form['action']

    def search(self, code):
        """Busca un código BIP (sin dígito verificador) y devuelve todas sus filas (todas las páginas)."""
        time.sleep(PAUSE)
        r = self.s.get(FLOW, timeout=60)
        r.raise_for_status()
        self._set_page(r.text)
        form = self.soup.find('form', id='formPrincipal')
        sel = form.find('select')
        opt = next(o for o in sel.find_all('option') if 'digo BIP' in o.get_text())
        data = _fields(form)
        data[sel['name']] = opt.get('value', opt.get_text())
        data[form.find('button')['name']] = ''
        self._set_page(self._post(data).text)

        form = self.soup.find('form', id='formPrincipal')
        data = _fields(form)
        data[form.find('input', attrs={'type': 'text'})['name']] = code
        data[next(b for b in form.find_all('button') if b.get_text(strip=True) == 'Buscar')['name']] = ''
        self._set_page(self._post(data).text)
        rows = self._parse_rows(self.soup)
        if self.soup.select_one('.ui-paginator-next:not(.ui-state-disabled)'):
            rows = self._all_rows()
        return rows

    def _all_rows(self, per_page=200):
        """Pide la tabla en una sola página (paginación AJAX de PrimeFaces con más filas)."""
        tid = 'form:formPrincipal:tabla'
        data = _fields(self.soup)
        data.update({'javax.faces.partial.ajax': 'true', 'javax.faces.source': tid, 'javax.faces.partial.execute': tid,
                     'javax.faces.partial.render': tid, tid: tid, f'{tid}_pagination': 'true',
                     f'{tid}_first': '0', f'{tid}_rows': str(per_page), f'{tid}_encodeFeature': 'true'})
        r = self._post(data, ajax=True)
        frag = re.search(r'<update id="' + re.escape(tid) + r'"><!\[CDATA\[(.*?)\]\]></update>', r.text, re.S)
        html = frag.group(1) if frag else r.text
        return self._parse_rows(BeautifulSoup('<table><tbody>' + html + '</tbody></table>', 'html.parser'))

    @staticmethod
    def _parse_rows(soup):
        out = []
        for tr in soup.select('tr'):
            a = tr.find('a', id=re.compile(r'tabla:\d+:j_idt\d+$'))
            tds = [td.get_text(' ', strip=True) for td in tr.find_all('td', recursive=False)]
            if not a or len(tds) < len(COLS):
                continue
            row = dict(zip(COLS, tds[:len(COLS)]))
            m = re.search(r'Año y Etapa a Financiar:\s*(\d{4})\s*-\s*(.+)$', row['descripcion'])
            row['anio_financiar'] = int(m.group(1)) if m else None
            row['etapa_financiar'] = m.group(2).strip() if m else ''
            row['nombre'] = re.sub(r'\s*Año y Etapa a Financiar:.*$', '', row['descripcion']).strip()
            row['solicitado_anio'] = _num(row['solicitado_anio'])
            row['costo_total'] = _num(row['costo_total'])
            row['row_id'] = a['id']
            out.append(row)
        return out

    def download_ficha(self, row_id):
        """Genera (clic AJAX en la fila) y descarga la ficha IDI de una fila. Devuelve (bytes, nombre_archivo)."""
        data = _fields(self.soup)
        data.update({'javax.faces.partial.ajax': 'true', 'javax.faces.source': row_id,
                     'javax.faces.partial.execute': row_id, row_id: row_id})
        r = self._post(data, ajax=True)
        if 'proceda a descargar' not in r.text:
            raise RuntimeError('el sitio no generó la ficha: ' + re.sub(r'<[^>]+>', ' ', r.text)[:200])
        btn = next(b for b in self.soup.find_all('button') if b.get_text(strip=True) == 'Descargar')
        data = _fields(self.soup)
        data[btn['name']] = ''
        r = self._post(data, timeout=180)
        if r.content[:4] != b'%PDF':
            raise RuntimeError('la descarga no es un PDF')
        m = re.search(r'filename="?([^";]+)', r.headers.get('Content-Disposition', ''))
        return r.content, (m.group(1) if m else 'ficha.pdf')
