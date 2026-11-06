"""Actualiza todos los módulos de CATLEC, uno tras otro (DGC, EFE, Metro, MOP, Puertos, SNI).

Hace lo mismo que correr cada actualizar_<modulo>.py, con un solo resumen al final y los
trazados del landing regenerados una sola vez.

Uso:  python scripts/actualizar_todo.py [--sin-descargas]
      --sin-descargas  no descarga fichas IDI de BIP Consulta ni geometrías del ArcGIS del MOP
"""
import etl
import actualizar_dgc
import actualizar_efe
import actualizar_metro
import actualizar_mop
import actualizar_puertos
import actualizar_sni

MODULOS = [actualizar_dgc, actualizar_efe, actualizar_metro, actualizar_mop, actualizar_puertos, actualizar_sni]


def pasos(act):
    for modulo in MODULOS:
        modulo.pasos(act)


if __name__ == '__main__':
    etl.main('todos los módulos', pasos)
