"""Lector mínimo de shapefiles (atributos .dbf y geometrías .shp de puntos,
multipuntos, líneas y polígonos), sin dependencias.

Lo usa export_geo_data.py para la capa Contratos_MOP de la IDE del MOP
(Mapas vectoriales/MOP/Contratos_MOP). Devuelve las coordenadas tal como vienen
en el archivo (la capa está en SIRGAS geográfico, que para el mapa equivale a WGS84).
"""
import struct


def read_dbf(path, encoding='utf-8'):
    """(campos, filas): campos = [(nombre, tipo, largo)], filas = [dict | None si está borrada]."""
    with open(path, 'rb') as f:
        data = f.read()
    n = struct.unpack('<I', data[4:8])[0]
    hlen, rlen = struct.unpack('<HH', data[8:12])
    fields = []
    pos = 32
    while data[pos] != 0x0D:
        name = data[pos:pos + 11].split(b'\x00')[0].decode('ascii')
        fields.append((name, chr(data[pos + 11]), data[pos + 16]))
        pos += 32
    rows = []
    for i in range(n):
        rec = data[hlen + i * rlen: hlen + (i + 1) * rlen]
        if rec[:1] == b'*':
            rows.append(None)
            continue
        off = 1
        row = {}
        for name, ftype, flen in fields:
            raw = rec[off:off + flen]
            off += flen
            try:
                txt = raw.decode(encoding).strip()
            except UnicodeDecodeError:
                txt = raw.decode('latin-1').strip()
            if ftype in 'NF':
                try:
                    row[name] = float(txt) if txt else None
                except ValueError:
                    row[name] = None
            else:
                row[name] = txt
        rows.append(row)
    return fields, rows


def read_shp(path):
    """Una geometría GeoJSON (dict) por registro, o None si el registro no tiene forma."""
    with open(path, 'rb') as f:
        data = f.read()
    pos = 100
    out = []
    while pos < len(data):
        _, clen = struct.unpack('>ii', data[pos:pos + 8])
        content = data[pos + 8: pos + 8 + clen * 2]
        pos += 8 + clen * 2
        stype = struct.unpack('<i', content[:4])[0]
        if stype == 0:
            out.append(None)
        elif stype in (1, 11, 21):
            out.append({'type': 'Point', 'coordinates': list(struct.unpack('<dd', content[4:20]))})
        elif stype in (8, 18, 28):
            npts = struct.unpack('<i', content[36:40])[0]
            pts = [list(struct.unpack('<dd', content[40 + 16 * k: 56 + 16 * k])) for k in range(npts)]
            out.append({'type': 'MultiPoint', 'coordinates': pts} if pts else None)
        elif stype in (3, 5, 13, 15, 23, 25):
            nparts, npts = struct.unpack('<ii', content[36:44])
            starts = list(struct.unpack('<%di' % nparts, content[44:44 + 4 * nparts])) + [npts]
            base = 44 + 4 * nparts
            pts = [list(struct.unpack('<dd', content[base + 16 * k: base + 16 * k + 16])) for k in range(npts)]
            parts = [pts[starts[k]:starts[k + 1]] for k in range(nparts)]
            # Una sola parte va como LineString/Polygon: simplificar una
            # MultiLineString de una parte devuelve una LineString (otro tipo)
            if stype in (3, 13, 23):
                parts = [p for p in parts if len(p) >= 2]
                if not parts:
                    out.append(None)
                elif len(parts) == 1:
                    out.append({'type': 'LineString', 'coordinates': parts[0]})
                else:
                    out.append({'type': 'MultiLineString', 'coordinates': parts})
            else:
                # Polígono: cada anillo como un polígono (suficiente para dibujar y
                # para asignar regiones; los agujeros no se distinguen)
                rings = [r for r in parts if len(r) >= 4]
                if not rings:
                    out.append(None)
                elif len(rings) == 1:
                    out.append({'type': 'Polygon', 'coordinates': rings})
                else:
                    out.append({'type': 'MultiPolygon', 'coordinates': [[r] for r in rings]})
        else:
            out.append(None)
    return out
