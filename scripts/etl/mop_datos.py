"""MOP: Excel mensual más reciente + resumen de fichas IDI (+ fotos de Fotos/MOP) → static/data/mop_data.js, mop_fichas.js y mop_contratos.js.
"""
from etl.comun_datos import *  # noqa: F401,F403  rutas, fotos y utilidades
from etl.mop_comun import *  # noqa: F401,F403


def mop_ficha_text(text):
    """Texto de la ficha IDI tal como viene; la ficha recorta los textos largos al alto de su
    recuadro, así que si no termina en punto (o paréntesis/comillas) se marca con '…'."""
    text = (text or '').strip()
    return text if not text or text.endswith(('.', ')', '"')) else text + '…'


def mop_etapas(values):
    """Etapas distintas de los contratos de un proyecto, en orden de madurez y unidas por ' - '."""
    found = {str(v).strip().upper() for v in values if str(v).strip()}
    order = list(MOP_ETAPAS)
    return ' - '.join(MOP_ETAPAS.get(e, e.capitalize()) for e in sorted(found, key=lambda e: order.index(e) if e in order else len(order)))


def mop_region(raw):
    """Nombre oficial de la región ('del Biobío' -> 'Biobío', 'de los Lagos' -> 'Los Lagos'); 'Interregional' queda igual."""
    norm = lambda s: re.sub(r'[^a-z0-9 ]', ' ', unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()).split()
    first = lambda words: next((w for w in words if w not in ('de', 'del', 'la', 'los')), '')
    key = first(norm(raw))
    return next((r for r in MOP_REGIONES if first(norm(r)) == key), str(raw).strip())


def mop_file_period(path):
    """(año, mes) del cierre que informa el archivo: celda 'Mes:' del encabezado o, si falta, el nombre del archivo."""
    head = pd.read_excel(path, header=None, nrows=6)
    cells = [str(v).strip() for v in head.values.ravel() if pd.notna(v) and str(v).strip()]
    texts = [c for i, c in enumerate(cells) if i and cells[i - 1].lower().startswith('mes')]
    for text in texts + [os.path.basename(path)]:
        m = re.search(r'(' + '|'.join(MOP_MESES) + r')\D{0,6}(20\d{2})', text.lower())
        if m:
            return int(m.group(2)), MOP_MESES.index(m.group(1)) + 1
    return None


def mop_read_iniciativas(path):
    """Tabla de contratos del Excel (la fila de encabezados es la que trae la columna 'Bip').
    Las últimas columnas ("Arrastre Año Siguiente", "Saldo", "Tipo de gasto") no traen
    nombre en esa fila sino en la de grupos de encima: se nombran con el texto más
    cercano hacia arriba."""
    raw = pd.read_excel(path, header=None)
    hdr = next(i for i in range(min(40, len(raw))) if any(str(v).strip() == 'Bip' for v in raw.iloc[i]))
    df = raw.iloc[hdr + 1:].reset_index(drop=True)
    names = []
    for j, c in enumerate(raw.iloc[hdr]):
        name = '' if pd.isna(c) else str(c).strip()
        if not name:
            above = [raw.iat[i, j] for i in range(hdr - 1, -1, -1) if pd.notna(raw.iat[i, j]) and str(raw.iat[i, j]).strip()]
            name = str(above[0]).strip() if above else f'col_{j}'
        names.append(name)
    df.columns = names
    return df


MOP_MESES_COLS = [m.upper() for m in MOP_MESES]
# Contratistas genéricos del Excel (gastos con varios proveedores, expropiaciones o sin adjudicar)
MOP_CONTRATISTAS_GENERICOS = {'', 'VARIOS PROVEEDORES', 'VARIOS EXPROPIADOS'}


def mop_contratos_payload(df, latest):
    """Un registro por contrato para las visualizaciones de ejecución, contratos y
    contratistas (static/js/MOP/contratos.js). Montos en M$ (miles de pesos, como el
    Excel). En `m` van los 12 meses del año: hasta el mes de cierre son pagos y de
    ahí en adelante, lo programado (los grupos "PAGADO AÑO" y "PROGRAMADO AÑO" del
    Excel); la columna "Pagado Año" no se usa porque viene en 0 en muchos contratos
    que sí registran pagos mensuales."""
    num = lambda v: 0 if pd.isna(pd.to_numeric(v, errors='coerce')) else float(pd.to_numeric(v, errors='coerce'))
    txt = lambda v: '' if pd.isna(v) else re.sub(r'\s+', ' ', str(v)).strip()

    def fecha(v):
        d = pd.to_datetime(v, errors='coerce')
        return None if pd.isna(d) else d.strftime('%Y-%m-%d')

    contratos = []
    for _, r in df.iterrows():
        contratista = txt(r.get('Nombre Contratista'))
        generico = contratista.upper() in MOP_CONTRATISTAS_GENERICOS or txt(r.get('Rut Contratista')) in ('', '1-9')
        cod = pd.to_numeric(r.get('Cod Contrato'), errors='coerce')
        contratos.append({
            'bip': r['Bip'],
            'cod': None if pd.isna(cod) else int(cod),
            'nombre': txt(r.get('Nombre Contrato')),
            'estado': txt(r.get('Estado')),
            'tipo': txt(r.get('Tipo Contratación')),
            'gasto': txt(r.get('Tipo de gasto')),
            'an': txt(r.get('A/N')),
            'fl': fecha(r.get('F Licitación')),
            'fa': fecha(r.get('F Apertura')),
            'fi': fecha(r.get('F Inicio')),
            'ft': fecha(r.get('F Término')),
            'po': round(num(r.get('Presupuesto oficial'))),
            'mv': round(num(r.get('Monto Vigente Contrato'))),
            'ct': None if generico else contratista,
            'rut': None if generico else txt(r.get('Rut Contratista')),
            'av': round(num(r.get('% ejecución')), 1),
            'm': [round(num(r.get(m))) for m in MOP_MESES_COLS],
            'ar': round(num(r.get('Arrastre Año Siguiente'))),
        })
    return {'anio': latest['year'], 'mes': latest['month'], 'label': latest['label'], 'contratos': contratos}


print("\nProcesando Iniciativas programadas y en ejecución (MOP)...")

try:
    mop_files = []
    for name in sorted(os.listdir(MOP_INICIATIVAS_DIR)):
        if name.startswith('~$') or not name.lower().endswith(('.xls', '.xlsx')):
            continue
        path = os.path.join(MOP_INICIATIVAS_DIR, name)
        period = mop_file_period(path)
        if period is None:
            print(f"  [WARN] No se pudo identificar el mes y año de {name}; se omite")
            continue
        mop_files.append({'file': name, 'path': path, 'year': period[0], 'month': period[1]})
    if not mop_files:
        raise FileNotFoundError(f"Sin Excel de iniciativas en {MOP_INICIATIVAS_DIR}")

    mop_files.sort(key=lambda f: (f['year'], f['month']))
    for f in mop_files:
        f['label'] = f"{MOP_MESES[f['month'] - 1]} {f['year']}"
        print(f"  - {f['label']:<16} {f['file']}")
    latest = mop_files[-1]
    print(f"  -> Más reciente: {latest['label']} ({latest['file']})")

    df_ini = mop_read_iniciativas(latest['path'])
    df_ini['Bip'] = df_ini['Bip'].fillna('').astype(str).str.replace(r'\s', '', regex=True)
    df_ini = df_ini[df_ini['Bip'] != '']
    if 'Item' not in df_ini.columns:
        df_ini['Item'] = ''
    for col in ('Nombre IDI', 'Servicio', 'Reg Proyecto', 'Etapa', 'Item'):
        df_ini[col] = df_ini[col].fillna('').astype(str).str.replace(r'\s+', ' ', regex=True).str.strip()
    n_excluidos = int(df_ini['Servicio'].isin(MOP_SERVICIOS_EXCLUIDOS).sum())
    df_ini = df_ini[~df_ini['Servicio'].isin(MOP_SERVICIOS_EXCLUIDOS)]
    print(f"  -> Se excluyen {n_excluidos} contratos de {', '.join(sorted(MOP_SERVICIOS_EXCLUIDOS))}")

    # Un proyecto por código BIP (nombre, servicio, región e ítem son los de su primer
    # contrato: son los mismos en todos sus contratos). La etapa reúne las de todos sus contratos.
    df_bip = df_ini.groupby('Bip', sort=False).agg(
        nombre=('Nombre IDI', 'first'), servicio=('Servicio', 'first'), region=('Reg Proyecto', 'first'),
        etapa=('Etapa', mop_etapas), item=('Item', 'first'),
    ).reset_index()
    df_bip['region'] = df_bip['region'].map(mop_region)
    df_bip['item'] = df_bip['item'].map(lambda v: MOP_ITEMS.get(v.upper(), v.capitalize()))
    # Orden alfabético sin tildes y sin guiones o signos iniciales en el nombre
    sort_key = lambda s: re.sub(r'^[^a-z0-9]+', '', unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower())
    mop_projects = sorted(
        ({'bip': r['Bip'], 'nombre': r['nombre'], 'servicio': r['servicio'], 'etapa': r['etapa'], 'region': r['region'],
          'item': r['item']}
         for _, r in df_bip.iterrows()),
        key=lambda p: sort_key(p['nombre']),
    )
    by_servicio = [{'servicio': s, 'count': int(c)} for s, c in df_bip['servicio'].value_counts().items()]

    # Inversión estimada (fichas IDI); null si el BIP no tiene ficha en BIP Consulta
    mop_inversion, mop_fichas = {}, {}
    if os.path.exists(MOP_INVERSION_JSON):
        with open(MOP_INVERSION_JSON, encoding='utf-8') as f:
            mop_resumen = json.load(f)['proyectos']
        mop_inversion = {r['BIP']: r[MOP_INVERSION_KEY] for r in mop_resumen if r.get(MOP_INVERSION_KEY) is not None}
        # Ficha del proyecto (static/js/MOP/main.js): justificación y descripción de la ficha
        # más reciente e inversión de cada etapa
        mop_fichas = {
            r['BIP']: {
                'justificacion': mop_ficha_text(r.get('Justificación')),
                'descripcion': mop_ficha_text(r.get('Descripción')),
                'ficha': r.get('Ficha de los textos'),
                'etapas': [{'etapa': MOP_ETAPA_FICHA.get(e['etapa'], e['etapa'].capitalize()), 'anio': e['anio'], 'monto': e['monto']}
                           for e in r.get('Por etapa', [])],
            }
            for r in mop_resumen
        }
    else:
        print(f"  [WARN] Sin {MOP_INVERSION_JSON}; los proyectos quedan sin inversión")
    for p in mop_projects:
        p['inversion'] = mop_inversion.get(p['bip'])
    n_inversion = sum(p['inversion'] is not None for p in mop_projects)
    print(f"  -> Inversión estimada (fichas IDI) en {n_inversion} de {len(mop_projects)} proyectos")

    # Fotos de referencia en Fotos/MOP: nombre de archivo = código BIP sin el dígito
    # verificador (30125021.jpg → 30125021-0). Una por proyecto, como en DGC: WebP de
    # ficha (<bip>.webp) y de visor (<bip>_full.webp) en static/img/fotos/MOP;
    # `photos` ([{src, full, label}], formato de CatlecPhotoViewer) solo va en los
    # proyectos que tienen foto.
    mop_photos_dir = os.path.join(PHOTOS_SRC_DIR, 'MOP')
    mop_photos_out_dir = os.path.join(PHOTOS_OUT_DIR, 'MOP')
    mop_photo_by_bip = {}
    if os.path.exists(mop_photos_dir):
        mop_bip_by_num = {p['bip'].split('-')[0]: p['bip'] for p in mop_projects}
        for pf in sorted(os.listdir(mop_photos_dir)):
            num, ext = os.path.splitext(pf)
            if ext.lower() not in PHOTO_EXTENSIONS:
                continue
            bip = mop_bip_by_num.get(num.strip().split('-')[0])
            if not bip:
                print(f"     ! {pf}: el código BIP '{num}' no corresponde a ningún proyecto de MOP (se omite)")
                continue
            if bip in mop_photo_by_bip:
                print(f"     ! {pf}: repite la foto de {bip} (se omite)")
                continue
            num = bip.split('-')[0]
            card, full = optimize_photo(os.path.join(mop_photos_dir, pf), mop_photos_out_dir, [
                (f'{num}.webp', PHOTO_CARD_WIDTH),
                (f'{num}_full.webp', PHOTO_FULL_WIDTH),
            ])
            mop_photo_by_bip[bip] = {'src': card, 'full': full, 'label': None}
        print(f"  -> {len(mop_photo_by_bip)} fotos de proyectos detectadas en Fotos/MOP")
    prune_photo_dir(mop_photos_out_dir, {os.path.basename(ph[k]) for ph in mop_photo_by_bip.values() for k in ('src', 'full')})
    for p in mop_projects:
        if p['bip'] in mop_photo_by_bip:
            p['photos'] = [mop_photo_by_bip[p['bip']]]

    # Opciones de los filtros: regiones de norte a sur (Interregional al final),
    # servicios por nombre, etapas en orden de madurez e ítems en el orden de MOP_ITEMS
    present_regions = set(df_bip['region'])
    present_etapas = {e for v in df_bip['etapa'] for e in v.split(' - ') if e}
    mop_filters = {
        'regions': [r for r in MOP_REGIONES if r in present_regions] + sorted(present_regions - set(MOP_REGIONES)),
        'servicios': sorted(set(df_bip['servicio']) - {''}, key=sort_key),
        'etapas': [e for e in MOP_ETAPAS.values() if e in present_etapas] + sorted(present_etapas - set(MOP_ETAPAS.values())),
        'items': [i for i in MOP_ITEMS.values() if i in set(df_bip['item'])] + sorted(set(df_bip['item']) - set(MOP_ITEMS.values()) - {''}),
    }

    mop_payload = {
        'source': {
            'folder': os.path.basename(MOP_INICIATIVAS_DIR),
            'file': latest['file'],
            'year': latest['year'],
            'month': latest['month'],
            'label': latest['label'],
            'files': [{k: f[k] for k in ('file', 'year', 'month', 'label')} for f in mop_files],
        },
        'summary': {
            'total_projects': len(mop_projects),
            'total_contracts': int(len(df_ini)),
            'total_inversion': sum(p['inversion'] or 0 for p in mop_projects),
            'projects_with_inversion': n_inversion,
            'inversion_year': MOP_INVERSION_ANIO,
        },
        'filters': mop_filters,
        # Solo para la diapositiva del landing (static/js/Landing/slides.js)
        'by_servicio': by_servicio,
        'projects': mop_projects,
    }

    out_mop_js = os.path.join(OUT_DIR, 'mop_data.js')
    mop_json = json.dumps(mop_payload, ensure_ascii=False, separators=(',', ':'))
    with open(out_mop_js, 'w', encoding='utf-8') as f:
        f.write(f'window.MOP_DATA = {mop_json};')

    out_contratos_js = os.path.join(OUT_DIR, 'mop_contratos.js')
    mop_contratos = mop_contratos_payload(df_ini, latest)
    with open(out_contratos_js, 'w', encoding='utf-8') as f:
        f.write('window.MOP_CONTRATOS = ' + json.dumps(mop_contratos, ensure_ascii=False, separators=(',', ':')) + ';')
    print(f"OK MOP Contratos: {out_contratos_js} ({os.path.getsize(out_contratos_js) / 1024 / 1024:.3f} MB, "
          f"{len(mop_contratos['contratos'])} contratos)")

    out_fichas_js = os.path.join(OUT_DIR, 'mop_fichas.js')
    with open(out_fichas_js, 'w', encoding='utf-8') as f:
        f.write('window.MOP_FICHAS = ' + json.dumps(mop_fichas, ensure_ascii=False, separators=(',', ':')) + ';')
    print(f"OK MOP Fichas: {out_fichas_js} ({os.path.getsize(out_fichas_js) / 1024 / 1024:.3f} MB, {len(mop_fichas)} proyectos)")

    size_mop = os.path.getsize(out_mop_js) / 1024 / 1024
    print(f"OK MOP Generado: {out_mop_js} ({size_mop:.3f} MB)")
    print(f"   Proyectos (código BIP) al cierre de {latest['label']}: {len(mop_projects)} (de {len(df_ini)} contratos)")

except Exception as e:
    print(f"[WARN] Error al exportar datos MOP: {e}")
    raise
