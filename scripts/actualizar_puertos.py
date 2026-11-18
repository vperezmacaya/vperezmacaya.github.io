"""Actualiza el módulo Puertos (puertos.html).

Lee Bases de dato/Puertos/puertos.xlsx y escribe static/data/puertos_data.js; lee
Mapas vectoriales/Puertos/puertos_biobio.geojson y escribe static/data/puertos_geo.js.

Uso:  python scripts/actualizar_puertos.py
"""
import etl


def pasos(act):
    act.correr('Puertos: datos (puertos.xlsx → puertos_data.js)', 'puertos_datos')
    act.correr('Puertos: mapa de instalaciones (puertos_biobio.geojson → puertos_geo.js)', 'puertos_mapa')


if __name__ == '__main__':
    etl.main('Puertos', pasos)
