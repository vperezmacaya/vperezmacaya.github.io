"""Lectura de la ficha IDI (PDF de BIP Consulta): justificación y descripción (secciones 10 y 11),
secciones 15 y 16 (montos) y datos de encabezado.

Uso: python scripts/ficha_idi.py <ficha.pdf> [...]  (imprime lo leído en JSON)
"""
import re
import pymupdf

NUM = r'-?\d{1,3}(?:\.\d{3})*'


def _n(s):
    return int(s.replace('.', '')) if s and re.fullmatch(NUM, s) else None


def _section(text, title):
    """Texto de la sección cuyo título empieza con `title`, hasta el título numerado siguiente.
    Se busca por título y no por número: en las fichas de estudios básicos la numeración
    cambia (14. Solicitud de financiamiento, 15. Programación de la inversión)."""
    m = re.search(r'\n\d{1,2}\. ' + title, text)
    if not m:
        return ''
    nxt = re.search(r'\n\d{1,2}\. [A-ZÁÉÍÓÚ]', text[m.end():])
    return text[m.start():m.end() + nxt.start()] if nxt else text[m.start():]


def _paragraphs(section):
    """Texto de una sección sin su título: une las líneas cortadas por el ancho de la ficha
    y deja un salto de párrafo donde una línea termina en punto (o dos puntos) antes del margen."""
    lines = [l.strip() for l in section.strip().splitlines()[1:]]
    lines = [l for l in lines if l]
    if not lines:
        return ''
    width = max(len(l) for l in lines)
    out = lines[0]
    for prev, line in zip(lines, lines[1:]):
        brk = prev.endswith(('.', ':')) and len(prev) < 0.85 * width
        out += ('\n' if brk else ' ') + line
    return re.sub(r'[ \t]+', ' ', out).strip()


def read_ficha(path):
    text = '\n'.join(p.get_text() for p in pymupdf.open(path))
    lines = [l.strip() for l in text.splitlines()]
    out = {'archivo': path}

    m = re.search(r'PROCESO PRESUPUESTARIO\s+(\d{4})', text)
    out['proceso'] = int(m.group(1)) if m else None
    m = re.search(r'POSTULA A\s+([^\n]+)', text)
    out['postula_a'] = m.group(1).strip() if m else None
    m = re.search(r'\n(RS|FI|OT|IN|AD|RE|NC)\n(\d{7,8}-\d)\n', text)
    out['rate'] = m.group(1) if m else None
    # Moneda de los montos: "Moneda Presupuesto 2026 / Factor: 175.576" (fichas recientes) o
    # "Moneda IDI 31/12/2010 / Factor: 108.61" (antiguas). El factor es el índice de precios
    # de esa moneda: monto × factor_destino / factor lleva el monto a otra moneda.
    m = re.search(r'Moneda (?:Presupuesto\s+|IDI\s+\d{2}/\d{2}/)(\d{4})\s*/\s*Factor:\s*([\d.]+)', text)
    out['moneda_anio'] = int(m.group(1)) if m else None
    out['moneda_factor'] = float(m.group(2)) if m else None

    # ── 10. Justificación y 11. Descripción (de la etapa programada en proyectos;
    # de las actividades a realizar en estudios básicos)
    out['justificacion'] = _paragraphs(_section(text, 'JUSTIFICACI'))
    out['descripcion'] = _paragraphs(_section(text, 'DESCRIPCI'))

    # ── 16. Programación de la inversión (15 en estudios básicos): ítems con "Monto Directo (M$)" y su TOTAL
    sec16 = _section(text, 'PROGRAMACI')
    items = []
    for m in re.finditer(r'\n([^\n\d][^\n]*)\n(\d+)\s*Meses\n[^\n]*\n[^\n]*\n(' + NUM + r')(?=\n)', sec16):
        items.append({'item': m.group(1).strip(), 'meses': int(m.group(2)), 'monto': _n(m.group(3))})
    m = re.search(r'TOTAL\n(' + NUM + r')', sec16)
    out['s16_total'] = _n(m.group(1)) if m else None
    out['s16_items'] = items
    out['s16_suma_items'] = sum(i['monto'] or 0 for i in items)

    # ── 15. Solicitud de financiamiento (14 en estudios básicos): fila Total (pagado, solicitado año, años siguientes, costo total)
    sec15 = _section(text, 'SOLICITUD DE FINANCIAMIENTO')
    m = re.search(r'\nTotal\n_?\n?(' + NUM + r')\n(' + NUM + r')\n(' + NUM + r')\n(' + NUM + r')', sec15)
    if m:
        out.update({'s15_pagado': _n(m.group(1)), 's15_solicitado': _n(m.group(2)),
                    's15_siguientes': _n(m.group(3)), 's15_costo_total': _n(m.group(4))})
    m = re.search(r'Pagado al\s*\n?\s*(\d{2}/\d{2}/\d{4})', sec15)
    out['s15_pagado_al'] = m.group(1) if m else None
    return out


if __name__ == '__main__':
    import sys, json
    for p in sys.argv[1:]:
        print(json.dumps(read_ficha(p), ensure_ascii=False, indent=1))
