"""Actualiza el módulo Puertos (puertos.html).

Lee Bases de dato/Puertos/puertos.xlsx y escribe static/data/puertos_data.js.

Uso:  python scripts/actualizar_puertos.py
"""
import etl


def pasos(act):
    act.correr('Puertos: datos (puertos.xlsx → puertos_data.js)', 'puertos_datos')


if __name__ == '__main__':
    etl.main('Puertos', pasos)
