"""Actualiza el módulo Metro (Metro.html): datos del Excel, mapa, comunas y trazados del landing.

Lee Bases de dato/Metro/Metro.xlsx y las capas de Mapas vectoriales/Metro.
Escribe static/data/metro_data.js, metro_geo.js, metro_comunas.js y landing_routes.js.

Uso:  python scripts/actualizar_metro.py
"""
import etl


def pasos(act):
    act.correr('Metro: datos (Metro.xlsx → metro_data.js)', 'metro_datos')
    act.correr('Metro: mapa y comunas (Mapas vectoriales/Metro → metro_geo.js, metro_comunas.js)', 'metro_mapa')
    act.pedir_landing()


if __name__ == '__main__':
    etl.main('Metro', pasos)
