"""Motor de los scripts actualizar_<modulo>.py de CATLEC.

Cada actualizar_<modulo>.py define sus pasos en `pasos(act)` y llama a `etl.main(...)`.
`Actualizacion` corre cada paso (un archivo de esta carpeta o una función), sigue con los
demás si uno falla, junta los avisos que imprimen los pasos ([WARN], ⚠, [AVISO]) y al final:
  1. regenera los trazados del landing si algún paso lo pidió (EFE y Metro),
  2. sube la versión de caché (?v=AAAAMMDD_HHMM) de cada archivo de static/data/ que cambió,
     en los HTML y JS que lo cargan, para que el navegador no use el anterior,
  3. imprime un resumen con lo que falló, los avisos y los archivos que cambiaron.
"""
import argparse
import glob
import hashlib
import os
import re
import runpy
import sys
import time
import traceback
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ETL_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, 'static', 'data')
AVISO_RE = re.compile(r'\[WARN\]|\[AVISO\]|⚠|\bERROR\b')


def _hashes():
    out = {}
    for path in glob.glob(os.path.join(DATA_DIR, '*')):
        if os.path.isfile(path):
            with open(path, 'rb') as f:
                out[os.path.basename(path)] = hashlib.md5(f.read()).hexdigest()
    return out


class _Tee:
    """Deja pasar lo que se imprime y anota las líneas de aviso."""

    def __init__(self, stream, act):
        self.stream, self.act, self.buf = stream, act, ''

    def write(self, s):
        self.stream.write(s)
        self.buf += s
        while '\n' in self.buf:
            line, self.buf = self.buf.split('\n', 1)
            if AVISO_RE.search(line):
                self.act.avisos.append((self.act.paso_actual, line.strip()))
        return len(s)

    def flush(self):
        self.stream.flush()

    def __getattr__(self, name):
        return getattr(self.stream, name)


class Actualizacion:
    def __init__(self, nombre, descargas=True):
        self.nombre = nombre
        self.descargas = descargas
        self.pasos = []          # (título, ok, segundos)
        self.avisos = []         # (paso, texto)
        self.paso_actual = ''
        self.landing = False
        self.t0 = time.time()
        self.hash0 = _hashes()
        sys.stdout = _Tee(sys.stdout, self)

    def correr(self, titulo, paso):
        """Corre un paso: el nombre de un archivo de etl/ (sin .py) o una función. Devuelve True si terminó bien."""
        self.paso_actual = titulo
        print(f"\n{'=' * 78}\n▶ {titulo}\n{'=' * 78}", flush=True)
        t = time.time()
        try:
            if isinstance(paso, str):
                runpy.run_path(os.path.join(ETL_DIR, paso + '.py'), run_name='etl.' + paso)
            else:
                paso()
            ok = True
        except Exception:
            traceback.print_exc(file=sys.stdout)
            ok = False
        self.pasos.append((titulo, ok, time.time() - t))
        return ok

    def aviso(self, texto):
        print(f"[AVISO] {texto}", flush=True)

    def pedir_landing(self):
        """Los trazados del landing salen de los datos de EFE y Metro: se regeneran una vez al final."""
        self.landing = True

    def _versionar(self, cambiados):
        """Sube el ?v= de cada archivo cambiado en los HTML (src="...") y JS (los que ya tienen ?v=)."""
        stamp = datetime.now().strftime('%Y%m%d_%H%M')
        tocados = {}
        files = glob.glob(os.path.join(ROOT, '*.html')) + glob.glob(os.path.join(ROOT, 'static', 'js', '**', '*.js'), recursive=True)
        for path in files:
            with open(path, encoding='utf-8', newline='') as f:   # conserva los fines de línea (CRLF/LF)
                txt = f.read()
            nuevo = txt
            for name in cambiados:
                ref = re.escape('static/data/' + name)
                nuevo = re.sub(ref + r'\?v=[\w.-]+', 'static/data/' + name + '?v=' + stamp, nuevo)
                if path.endswith('.html'):
                    nuevo = re.sub(r'(src=["\'])' + ref + r'(["\'])', r'\g<1>static/data/' + name + '?v=' + stamp + r'\g<2>', nuevo)
            if nuevo != txt:
                with open(path, 'w', encoding='utf-8', newline='') as f:
                    f.write(nuevo)
                tocados[os.path.relpath(path, ROOT)] = True
        return stamp, sorted(tocados)

    def terminar(self):
        if self.landing:
            from etl.landing_rutas import export_landing_routes
            self.correr('Trazados del landing (Proyectos destacados)', export_landing_routes)
        hash1 = _hashes()
        cambiados = sorted(n for n, h in hash1.items() if self.hash0.get(n) != h)
        stamp, tocados = self._versionar(cambiados) if cambiados else (None, [])

        sys.stdout = sys.stdout.stream
        fallidos = [p for p in self.pasos if not p[1]]
        print(f"\n{'=' * 78}\nResumen: actualización de {self.nombre} ({time.time() - self.t0:.0f} s)\n{'=' * 78}")
        for titulo, ok, seg in self.pasos:
            print(f"  {'OK   ' if ok else 'FALLÓ'}  {titulo} ({seg:.0f} s)")
        if self.avisos:
            print(f"\nAvisos ({len(self.avisos)}):")
            for paso, texto in self.avisos:
                print(f"  - [{paso}] {texto}")
        if cambiados:
            print(f"\nArchivos de static/data que cambiaron: {', '.join(cambiados)}")
            print(f"Versión de caché ?v={stamp} en: {', '.join(tocados) if tocados else '(ningún archivo los carga con ?v=)'}")
        else:
            print("\nNingún archivo de static/data cambió.")
        if fallidos:
            print(f"\n{len(fallidos)} paso(s) fallaron: revisar el error más arriba.")
        return 1 if fallidos else 0


def main(nombre, pasos):
    """Punto de entrada de los actualizar_<modulo>.py."""
    parser = argparse.ArgumentParser(description=f'Actualiza {nombre} en CATLEC.')
    parser.add_argument('--sin-descargas', action='store_true',
                        help='no descargar nada de internet (fichas IDI de BIP Consulta, ArcGIS del MOP)')
    args = parser.parse_args()
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding='utf-8')
        except (AttributeError, ValueError):
            pass
    os.chdir(ROOT)
    act = Actualizacion(nombre, descargas=not args.sin_descargas)
    pasos(act)
    sys.exit(act.terminar())
