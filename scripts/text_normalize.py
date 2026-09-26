"""
text_normalize.py
-----------------
Normalización de textos libres que llegan escritos íntegramente en MAYÚSCULAS
desde las bases Excel (hoy: descripciones de iniciativas MOP).

normalize_description(texto):
  1. Limpia artefactos de Excel: `_x000D_`, tildes corruptas (mojibake UTF-8 leído
     como cp1252), tildes graves (À→Á), acentos escritos con apóstrofo (CI'ON),
     comillas dobladas ("") y espacios repetidos.
  2. Une los saltos de línea que cortan una oración y conserva los que separan
     párrafos o ítems de lista.
  3. Si el texto está casi todo en mayúsculas, lo pasa a minúsculas con mayúscula
     inicial de oración, conservando siglas, códigos de ruta/rol, números romanos
     y códigos alfanuméricos, y escribiendo con su ortografía oficial las comunas,
     provincias y regiones de Chile.
"""

import re
import unicodedata

# ── Siglas que se conservan en mayúsculas ─────────────────────────────────────
ACRONYMS = {
    # Instituciones y organismos
    'MOP', 'DGOP', 'DOH', 'DOP', 'DGA', 'DAP', 'DGAC', 'DGC', 'DV', 'DIRPLAN', 'SERVIU',
    'MINVU', 'MINSAL', 'MINEDUC', 'MTT', 'MDSF', 'SUBDERE', 'GORE', 'FNDR', 'CORFO',
    'CONAF', 'CONADI', 'SAG', 'SEREMI', 'SEIA', 'RCA', 'EIA', 'SNI', 'BIP', 'IDI',
    'EFE', 'ENAP', 'SISS', 'ESSBIO', 'ESVAL', 'INE', 'ONEMI', 'SENAPRED', 'OACI',
    'SERNAGEOMIN', 'SERNAPESCA', 'SHOA', 'DIRECTEMAR', 'CMT', 'CONAMA', 'CChC',
    'APR', 'SSR', 'SMAPA', 'CBI', 'PDI', 'ENDESA', 'CGE', 'SEC', 'JJVV',
    # Materiales, técnicas y normas
    'HDPE', 'PEAD', 'PVC', 'PE', 'PN', 'DN', 'TSD', 'TSS', 'CBR', 'TCN', 'DTS',
    'SAP', 'ASTM', 'NCH', 'LED', 'GPS', 'LIDAR', 'CFGD', 'DM', 'CH', 'HCV',
}
# Siglas con forma mixta propia
ACRONYM_FORMS = {'NCH': 'NCh', 'CCHC': 'CChC'}

ROMAN_RE = re.compile(r'^[IVX]{2,}$')
# Unidades que se escriben en minúscula cuando siguen a un número (40 M → 40 m)
UNITS = {'M', 'M2', 'M3', 'KM', 'KM2', 'KMS', 'MM', 'CM', 'HA', 'HÁ', 'KG', 'ML', 'MTS',
         'MT', 'LTS', 'L', 'TON', 'HRS', 'KV', 'MW', 'KW', 'MVA', 'PULG'}
UNIT_FORMS = {'KV': 'kV', 'MW': 'MW', 'KW': 'kW', 'MVA': 'MVA', 'HÁ': 'ha'}

# ── Nombres geográficos de Chile (ortografía oficial) ─────────────────────────
REGIONS = [
    'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso',
    "O'Higgins", "Libertador General Bernardo O'Higgins", 'Maule', 'Ñuble', 'Biobío',
    'Bío Bío', 'La Araucanía', 'Araucanía', 'Aysén del General Carlos Ibáñez del Campo',
    'Aysén', 'Magallanes y de la Antártica Chilena', 'Magallanes', 'Chile',
]

COMUNAS = [
    # Arica y Parinacota / Tarapacá / Antofagasta
    'Arica', 'Putre', 'General Lagos', 'Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Camiña',
    'Colchane', 'Huara', 'Antofagasta', 'Sierra Gorda', 'Taltal', 'Calama', 'Ollagüe',
    'San Pedro de Atacama', 'Tocopilla', 'María Elena',
    # Atacama / Coquimbo
    'Copiapó', 'Caldera', 'Tierra Amarilla', 'Chañaral', 'Diego de Almagro', 'Vallenar',
    'Alto del Carmen', 'Freirina', 'Huasco', 'La Serena', 'Coquimbo', 'Andacollo',
    'Paiguano', 'Vicuña', 'Illapel', 'Los Vilos', 'Salamanca', 'Ovalle', 'Combarbalá',
    'Monte Patria', 'Punitaqui', 'Río Hurtado',
    # Valparaíso
    'Valparaíso', 'Casablanca', 'Concón', 'Juan Fernández', 'Puchuncaví', 'Quintero',
    'Viña del Mar', 'Isla de Pascua', 'Los Andes', 'San Esteban', 'La Ligua', 'Cabildo',
    'Papudo', 'Petorca', 'Zapallar', 'Quillota', 'La Calera', 'Hijuelas', 'Limache',
    'San Antonio', 'Cartagena', 'El Quisco', 'El Tabo', 'Santo Domingo', 'San Felipe',
    'Catemu', 'Llaillay', 'Panquehue', 'Putaendo', 'Santa María', 'Quilpué',
    'Villa Alemana',
    # Metropolitana
    'Santiago', 'Cerrillos', 'Cerro Navia', 'Conchalí', 'Estación Central', 'Huechuraba',
    'La Cisterna', 'La Pintana', 'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado',
    'Macul', 'Maipú', 'Ñuñoa', 'Pedro Aguirre Cerda', 'Peñalolén', 'Pudahuel', 'Quilicura',
    'Quinta Normal', 'Renca', 'San Joaquín', 'San Miguel', 'San Ramón', 'Vitacura',
    'Pirque', 'San José de Maipo', 'Lampa', 'Tiltil', 'San Bernardo', 'Buin',
    'Calera de Tango', 'Paine', 'Melipilla', 'Alhué', 'Curacaví', 'María Pinto',
    'Talagante', 'Isla de Maipo', 'Padre Hurtado', 'Peñaflor',
    # O'Higgins
    'Rancagua', 'Codegua', 'Coinco', 'Coltauco', 'Doñihue', 'Graneros', 'Las Cabras',
    'Machalí', 'Malloa', 'Mostazal', 'Peumo', 'Pichidegua', 'Quinta de Tilcoco', 'Rengo',
    'Requínoa', 'San Vicente de Tagua Tagua', 'San Vicente', 'Pichilemu', 'Litueche',
    'Marchigüe', 'Paredones', 'San Fernando', 'Chépica', 'Chimbarongo', 'Lolol',
    'Nancagua', 'Peralillo', 'Pumanque', 'Santa Cruz',
    # Maule
    'Talca', 'Curepto', 'Pelarco', 'Pencahue', 'Río Claro', 'San Clemente', 'San Rafael',
    'Cauquenes', 'Chanco', 'Pelluhue', 'Curicó', 'Hualañé', 'Licantén', 'Rauco',
    'Romeral', 'Sagrada Familia', 'Teno', 'Vichuquén', 'Linares', 'Colbún', 'Longaví',
    'San Javier', 'Villa Alegre', 'Yerbas Buenas',
    # Ñuble
    'Chillán Viejo', 'Chillán', 'Bulnes', 'El Carmen', 'Pemuco', 'Quillón', 'San Ignacio',
    'Cobquecura', 'Coelemu', 'Ninhue', 'Quirihue', 'Ránquil', 'Treguaco', 'Coihueco',
    'Ñiquén', 'San Carlos', 'San Fabián', 'San Nicolás',
    # Biobío
    'Concepción', 'Chiguayante', 'Hualqui', 'Lota', 'Penco', 'San Pedro de la Paz',
    'Santa Juana', 'Talcahuano', 'Tomé', 'Hualpén', 'Lebu', 'Arauco', 'Cañete',
    'Contulmo', 'Curanilahue', 'Los Álamos', 'Tirúa', 'Los Ángeles', 'Antuco', 'Cabrero',
    'Mulchén', 'Negrete', 'Quilaco', 'Quilleco', 'San Rosendo', 'Santa Bárbara',
    'Tucapel', 'Yumbel', 'Alto Biobío',
    # La Araucanía
    'Temuco', 'Carahue', 'Cunco', 'Curarrehue', 'Galvarino', 'Gorbea', 'Loncoche',
    'Melipeuco', 'Nueva Imperial', 'Padre Las Casas', 'Perquenco', 'Pitrufquén', 'Pucón',
    'Teodoro Schmidt', 'Toltén', 'Vilcún', 'Villarrica', 'Cholchol', 'Angol',
    'Collipulli', 'Curacautín', 'Ercilla', 'Lonquimay', 'Los Sauces', 'Lumaco', 'Purén',
    'Renaico', 'Traiguén',
    # Los Ríos
    'Valdivia', 'Lanco', 'Máfil', 'Mariquina', 'Paillaco', 'Panguipulli', 'Futrono',
    'Lago Ranco', 'Río Bueno',
    # Los Lagos
    'Puerto Montt', 'Calbuco', 'Cochamó', 'Fresia', 'Frutillar', 'Los Muermos',
    'Llanquihue', 'Maullín', 'Puerto Varas', 'Castro', 'Ancud', 'Chonchi',
    'Curaco de Vélez', 'Dalcahue', 'Puqueldón', 'Queilén', 'Quellón', 'Quemchi',
    'Quinchao', 'Osorno', 'Puerto Octay', 'Purranque', 'Puyehue', 'Río Negro',
    'San Juan de la Costa', 'San Pablo', 'Chaitén', 'Futaleufú', 'Hualaihué', 'Palena',
    # Aysén
    'Coyhaique', 'Lago Verde', 'Guaitecas', 'Cochrane', 'Tortel', 'Chile Chico',
    'Río Ibáñez',
    # Magallanes
    'Punta Arenas', 'Laguna Blanca', 'Río Verde', 'San Gregorio', 'Cabo de Hornos',
    'Timaukel', 'Natales', 'Torres del Paine',
]

# Provincias, islas y localidades frecuentes en las fichas
PLACES = [
    'Parinacota', 'Tamarugal', 'Elqui', 'Limarí', 'Choapa', 'Aconcagua', 'Marga Marga',
    'Cachapoal', 'Colchagua', 'Cardenal Caro', 'Diguillín', 'Punilla', 'Itata', 'Cautín',
    'Malleco', 'Ranco', 'Chiloé', 'Capitán Prat', 'General Carrera', 'Última Esperanza',
    'Tierra del Fuego', 'Antártica Chilena', 'Rapa Nui', 'Carretera Austral', 'Patagonia',
    'Puerto Natales', 'Puerto Aysén', 'Puerto Williams', 'Puerto Cisnes',
    'Puerto Chacabuco', "Villa O'Higgins", 'Caleta Tortel', 'Chiu Chiu', 'Lluta', 'Azapa',
    'Yendegaia', 'Tinguiririca', 'Mapocho', 'Estrecho de Magallanes', 'Isla Mocha',
    'Quiriquina', 'Cerro Castillo', 'Isla Santa María',
]

# Nombres que también son palabras comunes: solo se escriben como nombre propio
# cuando van precedidos de "comuna de", "ciudad de", "localidad de", etc.
AMBIGUOUS_PLACES = [
    'Camarones', 'Mejillones', 'Canela', 'La Higuera', 'Algarrobo', 'Nogales', 'Olivar',
    'Rinconada', 'Calle Larga', 'La Cruz', 'El Bosque', 'Independencia', 'La Florida',
    'La Granja', 'La Reina', 'Providencia', 'Recoleta', 'Puente Alto', 'Colina',
    'El Monte', 'La Estrella', 'Navidad', 'Palmilla', 'Placilla', 'Constitución',
    'Empedrado', 'Maule', 'Molina', 'Parral', 'Retiro', 'Pinto', 'Yungay', 'Portezuelo',
    'Coronel', 'Florida', 'Laja', 'Nacimiento', 'Freire', 'Lautaro', 'Saavedra',
    'Victoria', 'Corral', 'Los Lagos', 'La Unión', 'Los Ríos', 'Cisnes', 'Primavera',
    'Porvenir', 'Antártica', 'Pica', 'Metropolitana',
]
PLACE_CONTEXT = (r'(?:comunas?|ciudad(?:es)?|localidad(?:es)?|provincias?|regi[oó]n(?:es)?|'
                 r'pueblo|poblado|villa)\s+(?:de\s+|del\s+)?')

LIST_MARKER = r'(?:[-•*·–]|\d{1,2}(?:[.)]-?|-)|[a-zA-Z]\))'


def _accent_pattern(name):
    """Patrón que reconoce `name` sin importar tildes ni mayúsculas."""
    groups = {
        'a': 'aáà', 'e': 'eéè', 'i': 'iíì', 'o': 'oóò', 'u': 'uúùü', 'n': 'nñ',
    }
    out = []
    for ch in name:
        base = ''.join(c for c in unicodedata.normalize('NFD', ch.lower())
                       if unicodedata.category(c) != 'Mn')
        if ch == "'":
            out.append("['’]?")
        elif ch == ' ':
            out.append(r'[\s-]+')
        elif base in groups:
            out.append(f'[{groups[base]}]')
        else:
            out.append(re.escape(ch.lower()))
    return ''.join(out)


def _build_place_regex(names, context=False):
    names = sorted(set(names), key=len, reverse=True)
    canon = {}
    for n in names:
        key = ''.join(c for c in unicodedata.normalize('NFD', n.lower().replace('’', "'"))
                      if unicodedata.category(c) != 'Mn')
        key = re.sub(r'[\s-]+', ' ', key)
        canon.setdefault(key, n)
    alt = '|'.join(_accent_pattern(n) for n in names)
    if context:
        return re.compile(rf'(\b{PLACE_CONTEXT})({alt})(?![\w])', re.IGNORECASE), canon
    return re.compile(rf'(?<![\w])({alt})(?![\w])', re.IGNORECASE), canon


_PLACES_RE, _PLACES_CANON = _build_place_regex(REGIONS + COMUNAS + PLACES)
_AMBIG_RE, _AMBIG_CANON = _build_place_regex(AMBIGUOUS_PLACES, context=True)


def _canon_key(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', s.lower().replace('’', "'"))
                if unicodedata.category(c) != 'Mn')
    return re.sub(r'[\s-]+', ' ', s)


# ── Limpieza de artefactos ────────────────────────────────────────────────────
_GRAVE_TO_ACUTE = str.maketrans('ÀÈÌÒÙàèìòù', 'ÁÉÍÓÚáéíóú')


def _fix_mojibake(text):
    def repl(m):
        try:
            return m.group(0).encode('cp1252').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            return m.group(0)
    return re.sub(r'[ÃÂ][\x80-\xbfŒœŠšŸŽžƒ'
                  r'ˆ˜–—‘’‚“”„†'
                  r'‡•…‰‹›€™]', repl, text)


def _fix_lost_chars(text):
    """
    Sin ningún "?" en el texto, cada "¿" es un carácter que Excel no pudo representar.
    Se deduce cuál era según su posición: viñeta, apóstrofo, guion o comilla.
    """
    if '¿' not in text or '?' in text:
        return text
    text = re.sub(r'(?m)^[ \t]*¿[ \t]*', '• ', text)             # ¿<tab>TEXTO → viñeta
    text = re.sub(r'[ \t]*¿\t[ \t]*', '\n• ', text)
    text = re.sub(r"(?<=[^\W\d_])¿(?=[^\W\d_])", "'", text)       # O¿HIGGINS
    text = re.sub(r'(?<=\S) ¿ (?=\S)', ' – ', text)                # ALTO MOLLE ¿ ROTONDA
    text = re.sub(r'(?<=[.;:,])¿(?=\s|$)', '', text)               # "MIXTO.¿" al final
    return text.replace('¿', '"')                                  # ¿ALTO HOSPICIO¿


def _clean_artifacts(text):
    text = text.replace('_x000D_', '').replace('\r\n', '\n').replace('\r', '\n')
    text = _fix_mojibake(text).translate(_GRAVE_TO_ACUTE)
    text = _fix_lost_chars(text)
    # Acento escrito con apóstrofo o tilde suelta: COMPACTACI'ON → COMPACTACIÓN
    text = re.sub(r"(?<=[A-ZÑ])['´]([AEIOU])(?=[A-ZÑ])",
                  lambda m: m.group(1).translate(str.maketrans('AEIOU', 'ÁÉÍÓÚ')), text)
    text = text.replace('""', '"')
    text = re.sub(r'\(vac[ií]o\)(?=[²³])', '', text, flags=re.IGNORECASE)   # M(VACÍO)² → M²
    text = text.replace(' ', ' ').replace('\t', ' ')
    return text


def _join_lines(text):
    """Une saltos de línea que cortan una oración; conserva párrafos e ítems de lista."""
    lines = [re.sub(r' {2,}', ' ', ln).strip() for ln in text.split('\n')]
    # Descarta líneas vacías y viñetas sin texto
    lines = [ln for ln in lines if ln and not re.fullmatch(r'[-•*·–]+', ln)]
    if not lines:
        return ''
    out = [lines[0]]
    for ln in lines[1:]:
        prev = out[-1]
        starts_item = re.match(LIST_MARKER + r'\s*\S', ln) or ln.startswith('¿')
        ends_sentence = re.search(r'[.:;!?]["”)]*$', prev)
        if starts_item or ends_sentence:
            out.append(ln)
        else:
            out[-1] = f'{prev} {ln}'
    # Marcador de lista seguido directo del texto: "-92 BENEFICIARIOS" → "- 92 ..."
    out = [re.sub(r'^([-•*·–])(?=\S)', r'\1 ', ln) for ln in out]
    return '\n'.join(out)


def _fix_spacing(text):
    text = re.sub(r' {2,}', ' ', text)
    text = re.sub(r' +([,;])', r'\1', text)
    # "ORIENTE .LAS" / "ATACAMA\".LA" → punto pegado a la palabra anterior y espacio después
    text = re.sub(r' +\.(?=[A-Za-zÁÉÍÓÚÑáéíóúñ]| )', '.', text)
    text = re.sub(r'(?<!\.)\.\.(?!\.)', '.', text)
    text = re.sub(r'(?<=[A-Za-zÁÉÍÓÚÑáéíóúñ"”)])\.(?=[A-ZÁÉÍÓÚÑ]{2})', '. ', text)
    return text


# ── Paso a minúsculas ─────────────────────────────────────────────────────────
_TOKEN_RE = re.compile(r"[^\W_]+(?:[-'’][^\W_]+)*")
_NUMBER_RE = re.compile(r'^\d+(?:[.,]\d+)*$')
_NUM_UNIT_RE = re.compile(r'^(\d+(?:[.,]\d+)*)([A-ZÁ]+\d?)$')


def _is_mostly_upper(text):
    letters = [c for c in text if c.isalpha()]
    if len(letters) < 8:
        return False
    return sum(c.isupper() for c in letters) / len(letters) > 0.9


def _lower_token(tok, prev_tok):
    if tok in ACRONYMS or tok.upper() in ACRONYM_FORMS:
        return ACRONYM_FORMS.get(tok.upper(), tok)
    if ROMAN_RE.match(tok):
        return tok
    if prev_tok is not None and _NUMBER_RE.match(prev_tok) and tok in UNITS:
        return UNIT_FORMS.get(tok, tok.lower())
    m = _NUM_UNIT_RE.match(tok)
    if m and m.group(2) in UNITS:
        return m.group(1) + UNIT_FORMS.get(m.group(2), m.group(2).lower())
    if any(c.isdigit() for c in tok):
        # Códigos de ruta, rol y materiales: Y-290, P-72-S, PN10, PE100
        return tok
    if len(tok) == 1:
        return tok.lower() if tok in 'AEOUYX' else tok
    return tok.lower()


def _to_lower(text):
    out, last, prev_tok = [], 0, None
    for m in _TOKEN_RE.finditer(text):
        out.append(text[last:m.start()])
        tok = m.group(0)
        out.append(_lower_token(tok, prev_tok))
        prev_tok, last = tok, m.end()
    out.append(text[last:])
    return ''.join(out)


_SENTENCE_START_RE = re.compile(
    rf'(^|[.!?]["”)]*\s+|\n\s*(?:{LIST_MARKER}\s*)?)(["“(¿¡\'‘]*)([a-záéíóúñü])',
    re.MULTILINE)


def _sentence_case(text):
    text = _SENTENCE_START_RE.sub(lambda m: m.group(1) + m.group(2) + m.group(3).upper(), text)
    # Primer carácter tras un marcador de lista al comienzo del texto
    text = re.sub(rf'^({LIST_MARKER}\s*)([a-záéíóúñü])',
                  lambda m: m.group(1) + m.group(2).upper(), text)
    return text


# Palabras que cortan el nombre de una localidad ("localidad de Peleco hasta ...")
_LOCALITY_STOP = {
    'y', 'e', 'o', 'u', 'a', 'al', 'en', 'con', 'por', 'para', 'hasta', 'desde', 'entre',
    'hacia', 'que', 'se', 'donde', 'cuyo', 'cuya', 'sector', 'comuna', 'km', 'ruta',
    'camino', 'ubicado', 'ubicada', 'situado', 'situada', 'como', 'sobre', 'sin', 'su',
    'sus', 'un', 'una', 'lo', 'zona', 'área', 'influencia', 'proyecto', 'es', 'son',
    'presenta', 'considera', 'tiene', 'cuenta', 'posee', 'permite',
}
_LOCALITY_LINKS = {'de', 'del', 'la', 'las', 'los', 'el'}
_LOCALITY_RE = re.compile(r"\b(localidad(es)? de )((?:[a-záéíóúñü][\w'’]*)(?: [a-záéíóúñü][\w'’]*){0,6})")


def _capitalize_name_words(words):
    """Toma palabras hasta la primera de corte y las escribe como nombre propio."""
    kept = []
    for w in words:
        if w in _LOCALITY_STOP or w.endswith('mente'):
            break
        kept.append(w)
    while kept and kept[-1] in _LOCALITY_LINKS:        # no terminar en "de", "la", ...
        kept.pop()
    name = ' '.join(w if (i and w in _LOCALITY_LINKS) else w[:1].upper() + w[1:]
                    for i, w in enumerate(kept))
    return name, len(kept)


def _capitalize_locality(m):
    words = m.group(3).split(' ')
    name, n = _capitalize_name_words(words)
    if not n:
        return m.group(0)
    out = [name]
    # "localidades de Hornopirén y Pichanco": el segundo nombre también es propio
    if m.group(2) and n + 1 < len(words) and words[n] == 'y':
        second, n2 = _capitalize_name_words(words[n + 1:])
        if n2:
            out += ['y', second]
            n += 1 + n2
    return m.group(1) + ' '.join(out + words[n:])


def _proper_names(text):
    text = _LOCALITY_RE.sub(_capitalize_locality, text)
    text = _PLACES_RE.sub(lambda m: _PLACES_CANON.get(_canon_key(m.group(1)), m.group(1)), text)
    text = _AMBIG_RE.sub(
        lambda m: m.group(1) + _AMBIG_CANON.get(_canon_key(m.group(2)), m.group(2)), text)
    # "región de Los Lagos" / "región metropolitana" / "VIII región"
    text = re.sub(r'\bregi[oó]n(?=\s+(?:de\s+|del\s+)?[A-ZÁÉÍÓÚÑ])', 'Región', text)
    text = re.sub(r'\b([IVX]{1,4}\s)regi[oó]n\b', r'\1Región', text)
    text = re.sub(r'\bRegión\s+metropolitana\b', 'Región Metropolitana', text)
    # Ruta 5, Ruta Y-290, Ley 21.155, Av. Costanera
    text = re.sub(r'\bruta(?=\s+(?:\d|[A-Z]{1,2}-\d))', 'Ruta', text)
    text = re.sub(r'\bley(?=\s+(?:n[°º]\s*)?\d)', 'Ley', text)
    text = re.sub(r'\bav\.', 'Av.', text)
    return text


def normalize_description(text):
    """Devuelve la descripción limpia y, si venía en mayúsculas, en tipo oración."""
    if not text:
        return text
    text = _clean_artifacts(str(text))
    # Texto de relleno ("XXXXXXXX"): equivale a no tener descripción
    if re.fullmatch(r'[Xx\s.,;:-]*', text):
        return ''
    text = _fix_spacing(_join_lines(text))
    text = re.sub(r'^[.,;:\s]+', '', text)
    if _is_mostly_upper(text):
        text = _proper_names(_sentence_case(_to_lower(text)))
    return text.strip()
