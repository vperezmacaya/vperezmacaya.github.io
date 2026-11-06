"""MOP: Bases de dato/MOP/INVERSIONHISTORICAMOP_*.xls → static/data/mop_historico.js.
"""
from etl.comun_datos import *  # noqa: F401,F403  rutas, fotos y utilidades
from etl.mop_comun import *  # noqa: F401,F403

# ── MOP: Inversión histórica 1986-2025 (Dirección de Planeamiento) ──────────────
# Fuente: "Inversión Histórica MOP" del Departamento de Gestión Presupuestaria de
# la Dirección de Planeamiento: una fila por año, servicio, región, BIP y
# asignación con lo pagado en el año (miles de $ de cada año y de 2025). Lo pagado
# de un año es lo que informa el Excel mensual de diciembre de ese año, agregado
# por BIP. Se lleva a pesos de MOP_INVERSION_ANIO con el factor de IPC de su hoja
# "Factores act". Como en MOP_DATA, no se consideran las concesiones (pagos
# fiscales de cada concesión, no la obra). Lo usa la vista "Inversión histórica"
# de MOP.html (static/js/MOP/historica.js).
MOP_HISTORICO_XLS = os.path.join(DATA_DIR, 'MOP', 'INVERSIONHISTORICAMOP_1986_2025_.xls')
MOP_HISTORICO_CONCESIONES = re.compile(r'concesion', re.I)
# Servicio del Excel → el de MOP_DATA (los del Fondo de Emergencia Transitoria,
# "- FET - Covid", van a su servicio). Las empresas y servicios que el MOP ya no
# tiene (SENDOS, EMOS, ESVAL, Dirección General de Metro) conservan su nombre.
MOP_HISTORICO_SERVICIOS = {
    'Agua Potable Rural': 'Subdirección de Servicios Sanitarios Rurales',
    'Dirección de Vialidad - CAD': 'Conservaciones por Administración Directa - Dirección de Vialidad',
    'Dirección de Aeropuertos - CAD': 'Conservaciones por Administración Directa - Dirección de Aeropuertos',
    'I. N. de Hidráulica': 'Instituto Nacional de Hidráulica',
    'S.S. Sanitarios': 'Superintendencia de Servicios Sanitarios',
    'D.G.METRO': 'Dirección General de Metro',
}
# Región del Excel → la de MOP_DATA ("No Regionalizable" es "Interregional").
# Ñuble aparece desde 2018; antes sus proyectos van en Biobío.
MOP_HISTORICO_REGIONES = {
    'Bio Bio': 'Biobío', 'Metropolitana': 'Metropolitana de Santiago',
    'Libertador B O Higgins': "Libertador General Bernardo O'Higgins", 'Araucanía': 'La Araucanía',
    'Aysén': 'Aysén del General Carlos Ibáñez del Campo', 'Magallanes y Ach': 'Magallanes y de la Antártica Chilena',
    'No Regionalizable': 'Interregional',
}
# Programas y conservaciones: BIP que agrupan muchos contratos sobre una red o un
# territorio (conservaciones, glosas, planes, emergencias, sistemas APR, estudios
# de varios caminos...). Se reconocen por el nombre y quedan fuera del ranking de
# obras; la clasificación es aproximada.
MOP_HISTORICO_PROGRAMA = re.compile(
    r'CONSERVACI|MANTENCI|MANTENIMIENTO|REPARACION(ES)? (DE )?(OBRAS|CAMINOS|RED)|GLOSA|PROGRAMA'
    r'|PLAN (DE )?(DESARROLLO|RECUPERACION|INDIGENA)|ESTUDIOS? DE (PREFACTIBILIDAD|INGENIERIA DE VARIOS)'
    r'|VARIOS|DIVERSOS|RED VIAL|RED BASICA|CAMINOS BASICOS|EMERGENCIA|ADMINISTRACION DIRECTA|\bCAD\b'
    r'|SISTEMAS? (DE )?A\.?P\.? RURAL|SISTEMAS APR|REQUISITOS|ADQUISICION|EXPROPIACION|ASESORIA')
# Obras guardadas por servicio y región: las 10 mayores de cada par alcanzan para
# el ranking de cualquier combinación de filtros
MOP_HISTORICO_TOP_OBRAS = 10

try:
    if os.path.exists(MOP_HISTORICO_XLS):
        print(f"\nProcesando inversión histórica MOP desde: {MOP_HISTORICO_XLS}...")
        df_hist = pd.read_excel(MOP_HISTORICO_XLS, sheet_name='Hoja1', header=4)
        df_hist.columns = [str(c).strip() for c in df_hist.columns]
        df_hist = df_hist[pd.to_numeric(df_hist['AÑO'], errors='coerce').notna()].copy()
        df_hist['AÑO'] = df_hist['AÑO'].astype(int)

        # Factor de IPC del Excel para llevar cada año a pesos de MOP_INVERSION_ANIO
        df_fac = pd.read_excel(MOP_HISTORICO_XLS, sheet_name='Factores act', header=None)
        fac_hdr = next(i for i in range(len(df_fac)) if str(df_fac.iat[i, 0]).strip() == 'Año')
        fac_col = next(j for j in range(df_fac.shape[1]) if str(MOP_INVERSION_ANIO) in str(df_fac.iat[fac_hdr, j]))
        hist_factor = {int(a): float(f) for a, f in zip(df_fac.iloc[fac_hdr + 1:, 0], df_fac.iloc[fac_hdr + 1:, fac_col])
                       if pd.notna(pd.to_numeric(a, errors='coerce')) and pd.notna(pd.to_numeric(f, errors='coerce'))}
        sin_factor = sorted(set(df_hist['AÑO']) - set(hist_factor))
        if sin_factor:
            print(f"  [WARN] Años sin factor de actualización (se omiten): {sin_factor}")
            df_hist = df_hist[df_hist['AÑO'].isin(hist_factor)]
        col_nominal = next(c for c in df_hist.columns if c.startswith('INVERSIÓN') and 'CADA AÑO' in c)
        df_hist['monto'] = pd.to_numeric(df_hist[col_nominal], errors='coerce').fillna(0) * df_hist['AÑO'].map(hist_factor)

        df_hist['SERVICIO'] = df_hist['SERVICIO'].fillna('').astype(str).str.replace(r'\s+', ' ', regex=True).str.strip()
        es_concesion = df_hist['SERVICIO'].str.contains(MOP_HISTORICO_CONCESIONES)
        print(f"  -> Se excluyen las concesiones: {df_hist.loc[es_concesion, 'monto'].sum() / 1e9:,.1f} billones de $ {MOP_INVERSION_ANIO}")
        df_hist = df_hist[~es_concesion].copy()
        df_hist['servicio'] = (df_hist['SERVICIO'].str.replace(r'\s*-\s*FET\b.*$', '', regex=True)
                               .map(lambda s: MOP_HISTORICO_SERVICIOS.get(s, s)))
        df_hist['region'] = df_hist['REGIÓN'].fillna('').astype(str).str.strip().map(lambda r: MOP_HISTORICO_REGIONES.get(r, r))
        df_hist['BIP'] = df_hist['BIP'].fillna('').astype(str).str.strip()
        df_hist['NOMBRE'] = df_hist['NOMBRE'].fillna('').astype(str).str.replace(r'\s+', ' ', regex=True).str.strip()

        # Servicios de mayor a menor monto; regiones de norte a sur (Interregional al final)
        servicios_h = list(df_hist.groupby('servicio')['monto'].sum().sort_values(ascending=False).index)
        present_regions_h = set(df_hist['region'])
        regiones_h = [r for r in MOP_REGIONES if r in present_regions_h] + sorted(present_regions_h - set(MOP_REGIONES))
        s_idx = {s: i for i, s in enumerate(servicios_h)}
        r_idx = {r: i for i, r in enumerate(regiones_h)}

        # Pagado por año, servicio y región: [año, servicio, región, M$]
        anual = df_hist.groupby(['AÑO', 'servicio', 'region'])['monto'].sum()
        anual_rows = [[int(a), s_idx[s], r_idx[r], round(m)] for (a, s, r), m in anual.items() if round(m)]

        # Obras: BIP que no son programas ni conservaciones (por su nombre en cualquier año)
        con_bip = df_hist[df_hist['BIP'].str.match(r'^\d')]
        nombres_bip = con_bip.groupby('BIP')['NOMBRE'].agg(lambda s: ' || '.join(sorted(set(s))))
        nombres_norm = nombres_bip.map(lambda s: unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().upper())
        obras_bip = set(nombres_norm[~nombres_norm.str.contains(MOP_HISTORICO_PROGRAMA)].index)
        df_obras = con_bip[con_bip['BIP'].isin(obras_bip)]
        par = df_obras.groupby(['BIP', 'servicio', 'region'])['monto'].sum().reset_index()
        par = par[par['monto'] > 0]
        top_par = par.sort_values('monto', ascending=False).groupby(['servicio', 'region']).head(MOP_HISTORICO_TOP_OBRAS)
        bips_top = list(dict.fromkeys(top_par.sort_values('monto', ascending=False)['BIP']))
        # Montos de esas obras en todos sus pares servicio/región (no solo en los que entran al top)
        par_top = par[par['BIP'].isin(bips_top)]
        b_idx = {b: i for i, b in enumerate(bips_top)}
        info_bip = df_obras[df_obras['BIP'].isin(bips_top)].sort_values('AÑO').groupby('BIP').agg(
            nombre=('NOMBRE', 'last'), a0=('AÑO', 'min'), a1=('AÑO', 'max'))
        # Obras que siguen en la cartera de MOP.html (mop_data.js, que escribe mop_datos.py antes de este paso)
        with open(os.path.join(OUT_DIR, 'mop_data.js'), encoding='utf-8') as f_mop:
            _mop_txt = f_mop.read()
        mop_bips_actuales = {p['bip'] for p in json.loads(_mop_txt[_mop_txt.index('{'):_mop_txt.rindex('}') + 1])['projects']}
        obras_list = [{'bip': b, 'nombre': info_bip.at[b, 'nombre'], 'a0': int(info_bip.at[b, 'a0']), 'a1': int(info_bip.at[b, 'a1']),
                       'actual': b in mop_bips_actuales} for b in bips_top]
        obra_rows = [[b_idx[r['BIP']], s_idx[r['servicio']], r_idx[r['region']], round(r['monto'])] for _, r in par_top.iterrows()]

        hist_payload = {
            'source': {'file': os.path.basename(MOP_HISTORICO_XLS), 'desde': int(df_hist['AÑO'].min()),
                       'hasta': int(df_hist['AÑO'].max()), 'moneda': MOP_INVERSION_ANIO},
            'servicios': servicios_h,
            'regiones': regiones_h,
            'anual': anual_rows,
            'obras': obras_list,
            'obra_montos': obra_rows,
        }
        out_hist_js = os.path.join(OUT_DIR, 'mop_historico.js')
        with open(out_hist_js, 'w', encoding='utf-8') as f:
            f.write('window.MOP_HISTORICO = ' + json.dumps(hist_payload, ensure_ascii=False, separators=(',', ':')) + ';')
        print(f"OK MOP Inversión histórica: {out_hist_js} ({os.path.getsize(out_hist_js) / 1024:.0f} KB, "
              f"{hist_payload['source']['desde']}-{hist_payload['source']['hasta']}, "
              f"{df_hist['monto'].sum() / 1e9:,.1f} billones de $ {MOP_INVERSION_ANIO} sin concesiones, "
              f"{len(obras_list)} obras para el ranking)")
    else:
        print(f"[WARN] Sin {MOP_HISTORICO_XLS}; no se genera mop_historico.js")
except Exception as e:
    print(f"[WARN] Error al exportar la inversión histórica MOP: {e}")
    raise
