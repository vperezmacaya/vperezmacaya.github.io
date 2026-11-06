"""Actualiza el módulo MOP (MOP.html) completo, en el orden que corresponde.

Antes de correrlo, dejar en su carpeta lo que llega cada mes:
  - el Excel "Iniciativas programadas y en ejecución al cierre de <mes> <año>" en
    Bases de dato/MOP/Iniciativas programadas y en ejecucion/ (se usa el más reciente),
  - la capa Contratos_MOP de la IDE del MOP de ese mes en Mapas vectoriales/MOP/Contratos_MOP/
    (y Red_Aeroportuaria en Mapas vectoriales/MOP/Red_Aeroportuaria/ si hay una nueva).

Pasos:
  1. Datos del Excel mensual → mop_data.js, mop_fichas.js y mop_contratos.js.
  2. Fichas IDI: descarga de BIP Consulta solo las de BIP nuevos o con error (~10 s por BIP) y,
     si hay fichas nuevas o el Excel cambió, rehace _resumen_inversion.json y vuelve a correr el
     paso 1 para que el costo quede en los datos.
  3. Inversión histórica → mop_historico.js.
  4. Geometrías del ArcGIS del MOP (MOP_line.json y MOP_point.json).
  5. Mapa → mop_geo.js (manual > Contratos_MOP > ArcGIS > aeródromo).
Avisa si el Excel parece desactualizado o si la capa Contratos_MOP es de otro mes, y al final
sube la versión de caché de los archivos que cambiaron.

Uso:  python scripts/actualizar_mop.py [--sin-descargas]
      --sin-descargas  no descarga fichas IDI ni el ArcGIS del MOP (usa lo que ya está en disco)
"""
import glob
import json
import os
import re
from datetime import date

import etl

MOP_DATA_JS = os.path.join(etl.DATA_DIR, 'mop_data.js')
MOP_MAPS_DIR = os.path.join(etl.ROOT, 'Mapas vectoriales', 'MOP')
PLANEAMIENTO_URL = 'https://planeamiento.mop.gob.cl/iniciativas-de-inversion-programadas-y-en-ejecucion/'


def _mop_source():
    with open(MOP_DATA_JS, encoding='utf-8') as f:
        text = f.read()
    return json.loads(text[text.index('{'):text.rindex('}') + 1])['source']


def _capa_mas_reciente(carpeta, prefijo):
    """(año, mes, día) más reciente de los shapefiles <prefijo>_AAAA_MM_DD.shp de la carpeta, o None."""
    fechas = []
    for path in glob.glob(os.path.join(MOP_MAPS_DIR, carpeta, prefijo + '_*.shp')):
        m = re.search(r'_(\d{4})_(\d{2})_(\d{2})\.shp$', path)
        if m:
            fechas.append(tuple(int(g) for g in m.groups()))
    return max(fechas) if fechas else None


def revisar_excel(act):
    src = _mop_source()
    print(f"Excel usado: {src['file']} ({src['label']})")
    hoy = date.today()
    atraso = (hoy.year * 12 + hoy.month) - (src['year'] * 12 + src['month'])
    # El Excel de un mes se publica durante el mes siguiente: más de 2 meses de atraso es sospechoso.
    if atraso > 2:
        act.aviso(f"El Excel más reciente de la carpeta es de {src['label']}; puede haber uno más nuevo en {PLANEAMIENTO_URL}")


def revisar_capas(act):
    src = _mop_source()
    for prefijo in ('Contratos_MOP_Linea', 'Contratos_MOP_Punto'):
        fecha = _capa_mas_reciente('Contratos_MOP', prefijo)
        if not fecha:
            act.aviso(f"No hay capa {prefijo} en Mapas vectoriales/MOP/Contratos_MOP: el mapa queda solo con ArcGIS")
        elif fecha[:2] != (src['year'], src['month']):
            act.aviso(f"La capa {prefijo} es del {fecha[2]:02d}-{fecha[1]:02d}-{fecha[0]} y el Excel de {src['label']}: "
                      f"copiar la del mes a Mapas vectoriales/MOP/Contratos_MOP para que el mapa no quede desfasado")
        else:
            print(f"Capa {prefijo}: {fecha[2]:02d}-{fecha[1]:02d}-{fecha[0]} (mismo mes del Excel)")
    aero = _capa_mas_reciente('Red_Aeroportuaria', 'Red_Aeroportuaria')
    if aero:
        print(f"Capa Red_Aeroportuaria: {aero[2]:02d}-{aero[1]:02d}-{aero[0]}")


def fichas_idi(act):
    """Descarga las fichas que faltan y rehace el resumen si hace falta. True si el resumen cambió."""
    from etl import mop_fichas_idi
    pend, no_genera = mop_fichas_idi.pendientes()
    if no_genera:
        print(f"BIP sin ficha porque BIP Consulta no la genera (no se reintentan): {', '.join(no_genera)}")
    if pend:
        if act.descargas:
            print(f"Fichas IDI por descargar: {len(pend)} BIP (~{len(pend) * 10 / 60:.0f} min)")
            act.correr(f'MOP: descargar fichas IDI de {len(pend)} BIP (BIP Consulta)',
                       lambda: mop_fichas_idi.descargar(bips=pend))
        else:
            act.aviso(f"{len(pend)} BIP sin ficha IDI descargada (--sin-descargas): quedan sin costo")
    else:
        print("Fichas IDI: no falta ninguna.")
    if mop_fichas_idi.resumen_desactualizado():
        return act.correr('MOP: resumen de las fichas IDI (_resumen_inversion.json)', mop_fichas_idi.resumir)
    print("Resumen de fichas IDI: al día.")
    return False


def pasos(act):
    if not act.correr('MOP: datos del Excel mensual (mop_data.js, mop_fichas.js, mop_contratos.js)', 'mop_datos'):
        return
    act.correr('MOP: revisar el Excel mensual', lambda: revisar_excel(act))
    if fichas_idi(act):
        act.correr('MOP: datos con el costo de las fichas (segunda pasada)', 'mop_datos')
    act.correr('MOP: inversión histórica (mop_historico.js)', 'mop_historico')
    if act.descargas:
        from etl import mop_arcgis
        act.correr('MOP: geometrías del ArcGIS del MOP (MOP_line.json, MOP_point.json)', mop_arcgis.descargar)
    act.correr('MOP: revisar capas Contratos_MOP y Red_Aeroportuaria', lambda: revisar_capas(act))
    act.correr('MOP: mapa (mop_geo.js)', 'mop_mapa')


if __name__ == '__main__':
    etl.main('MOP', pasos)
