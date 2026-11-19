"""Actualiza el módulo DGC (DGC.html): datos del Excel, estados financieros de la CMF y mapa.

Lee Bases de dato/DGC/DGC.xlsx, las fotos de Fotos/DGC, los XBRL de la CMF (descargados a
Bases de dato/DGC/CMF/) y las capas de Mapas vectoriales/DGC.
Escribe static/data/contracts_data.js, dgc_cmf.js y dgc_data.js.

Uso:  python scripts/actualizar_dgc.py [--sin-descargas]
      --sin-descargas  no consulta la CMF (usa los XBRL ya descargados)
"""
import etl


def cmf(act):
    from etl import dgc_cmf
    if act.descargas:
        act.correr('DGC: descargar estados financieros de la CMF (XBRL)', dgc_cmf.descargar)
    act.correr('DGC: estados financieros de las concesionarias (dgc_cmf.js)', dgc_cmf.escribir)


def pasos(act):
    if act.correr('DGC: datos (DGC.xlsx → contracts_data.js)', 'dgc_datos'):
        cmf(act)
    act.correr('DGC: mapa (Mapas vectoriales/DGC → dgc_data.js)', 'dgc_mapa')


if __name__ == '__main__':
    etl.main('DGC', pasos)
