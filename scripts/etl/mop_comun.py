"""MOP: constantes que comparten los pasos de datos de MOP (carpeta del Excel mensual, regiones, etapas, fichas IDI).
"""
from etl.comun_datos import *  # noqa: F401,F403  rutas, fotos y utilidades

# ── MOP: Iniciativas programadas y en ejecución (Dirección de Planeamiento) ────
# Fuente: Excel mensuales "Iniciativas programadas y en ejecución al cierre de
# <mes> <año>" (planeamiento.mop.gob.cl). Se usa el más reciente de la carpeta;
# cada fila del Excel es un contrato y los proyectos se agrupan por código BIP.
# Por ahora la carpeta tiene los cierres de diciembre 2021-2024, los meses de 2025
# y el de septiembre 2026 (el más reciente, el que se usa)
MOP_INICIATIVAS_DIR = os.path.join(DATA_DIR, 'MOP', 'Iniciativas programadas y en ejecucion')
MOP_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
             'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
MOP_REGIONES = [
    'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso',
    'Metropolitana de Santiago', "Libertador General Bernardo O'Higgins", 'Maule', 'Ñuble',
    'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos',
    'Aysén del General Carlos Ibáñez del Campo', 'Magallanes y de la Antártica Chilena',
]
# Servicios que no se consideran: las concesiones (sus contratos son los pagos
# fiscales de cada concesión, no la obra concesionada)
MOP_SERVICIOS_EXCLUIDOS = {'Dirección General de Concesiones de Obras Públicas'}
# Etapas en orden de madurez (un proyecto con varias se muestra "Diseño - Ejecución")
MOP_ETAPAS = {'PERFIL': 'Perfil', 'PREFACTIBILIDAD': 'Prefactibilidad', 'FACTIBILIDAD': 'Factibilidad',
              'DISEÑO': 'Diseño', 'EJECUCION': 'Ejecución'}
# Ítem presupuestario del contrato (columna "Item"): todos los contratos de un BIP comparten el suyo
MOP_ITEMS = {'PROYECTOS': 'Proyectos', 'ESTUDIOS BÁSICOS': 'Estudios básicos'}
# Inversión estimada por BIP (M$ de 2026): suma por etapa del TOTAL de la sección 16
# "Programación de la inversión" de su ficha IDI en BIP Consulta. La generan
# etl/mop_fichas_idi.py (descargar() y resumir()), que corre actualizar_mop.py.
MOP_INVERSION_JSON = os.path.join(DATA_DIR, 'MOP', 'BIP fichas IDI', '_resumen_inversion.json')
MOP_INVERSION_KEY = 'Inversión S16 (M$ 2026)'
MOP_INVERSION_ANIO = 2026
# Etapa del nombre de la ficha (DISENO, EJECUCION, ...) → como se muestra (Diseño, Ejecución, ...)
MOP_ETAPA_FICHA = {unicodedata.normalize('NFKD', k).encode('ascii', 'ignore').decode(): v for k, v in MOP_ETAPAS.items()}


# Todo lo de este archivo (también lo que empieza con _) queda disponible con `import *`.
__all__ = [n for n in dir() if not n.startswith('__')]
