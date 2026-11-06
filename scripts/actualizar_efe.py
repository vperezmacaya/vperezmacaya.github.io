"""Actualiza el módulo EFE (EFE.html): datos del Excel, carga ferroviaria, mapa y trazados del landing.

Lee Bases de dato/EFE/EFE.xlsx, la Memoria Integrada EFE (Bases de dato/EFE/Memoria-Integrada-EFE-<año>.pdf),
las fotos de Fotos/EFE y las capas de Mapas vectoriales/EFE.
Escribe static/data/efe_data.js, efe_carga.js, efe_trenes.js, efe_seguridad.js, efe_geo.js y landing_routes.js. La Red EFE (efe_red.js)
es un dato fijo y no se regenera.

Uso:  python scripts/actualizar_efe.py
"""
import etl


def pasos(act):
    act.correr('EFE: datos (EFE.xlsx → efe_data.js)', 'efe_datos')
    act.correr('EFE: carga ferroviaria (Memoria Integrada EFE → efe_carga.js)', 'efe_carga')
    act.correr('EFE: trenes en operación (Memorias EFE → efe_trenes.js)', 'efe_trenes')
    act.correr('EFE: seguridad ferroviaria (Memorias EFE → efe_seguridad.js)', 'efe_seguridad')
    act.correr('EFE: mapa (Mapas vectoriales/EFE → efe_geo.js)', 'efe_mapa')
    act.pedir_landing()


if __name__ == '__main__':
    etl.main('EFE', pasos)
