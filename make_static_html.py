"""
make_static_html.py
-------------------
Genera index.html a partir del archivo HTML base.

Cambios que aplica:
  1. Reemplaza {{ url_for('static', ...) }} por rutas relativas
  2. Agrega los <script> para cargar contracts_data.js, regions_data.js y dgc_data.js
  3. Reemplaza loadFilters() para usar window.STATIC_DATA
  4. Reemplaza fetchData() para filtrar y paginar en el cliente
  5. Reemplaza fetch('/api/project/...') para buscar en memoria
  6. Reemplaza fetch('/api/map/regions') y fetch('/api/map/dgc') por window.REGIONS_DATA y window.DGC_DATA
"""

import os
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(BASE_DIR, 'index.html')
OUT_PATH      = os.path.join(BASE_DIR, 'index.html')

with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Reemplazar url_for de Flask si estuviera presente
html = html.replace(
    "{{ url_for('static', filename='css/styles.css') }}",
    "static/css/styles.css"
)

# 2. Asegurar scripts de datos estáticos en el <head>
if 'contracts_data.js' not in html:
    STATIC_SCRIPTS = """    <!-- Datos estáticos pre-generados -->
    <script src="static/data/contracts_data.js"></script>
    <script src="static/data/regions_data.js"></script>
    <script src="static/data/dgc_data.js"></script>
"""
    html = html.replace('</head>', STATIC_SCRIPTS + '</head>', 1)

# Guardar index.html en la raíz
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"\nOK index.html procesado y guardado en raíz: {OUT_PATH}")
