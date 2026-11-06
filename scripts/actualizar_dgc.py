"""Actualiza el módulo DGC (DGC.html): datos del Excel y mapa.

Lee Bases de dato/DGC/DGC.xlsx, las fotos de Fotos/DGC y las capas de Mapas vectoriales/DGC.
Escribe static/data/contracts_data.js y dgc_data.js.

Uso:  python scripts/actualizar_dgc.py
"""
import etl


def pasos(act):
    act.correr('DGC: datos (DGC.xlsx → contracts_data.js)', 'dgc_datos')
    act.correr('DGC: mapa (Mapas vectoriales/DGC → dgc_data.js)', 'dgc_mapa')


if __name__ == '__main__':
    etl.main('DGC', pasos)
