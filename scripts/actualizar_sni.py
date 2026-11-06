"""Actualiza el módulo SNI (SNI.html).

Lee Bases de dato/SNI/SNI.xlsx y escribe static/data/sni_data.js y sni_raw_data.json.
Las regiones del coroplético (sni_regions_data.js) son un dato fijo y no se regeneran.

Uso:  python scripts/actualizar_sni.py
"""
import etl


def pasos(act):
    from etl import sni_datos
    act.correr('SNI: datos (SNI.xlsx → sni_data.js)', sni_datos.main)


if __name__ == '__main__':
    etl.main('SNI', pasos)
