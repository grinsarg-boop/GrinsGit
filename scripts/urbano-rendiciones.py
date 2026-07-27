#!/usr/bin/env python3
"""Rendiciones de Urbano: PDF / .xls -> datos/urbano_rendiciones.csv (una fila por guía cobrada).

Uso:  python3 scripts/urbano-rendiciones.py <carpeta-o-archivo> [más...]
El CSV se MERGEA por (resumen, fecha, guia), así que se puede correr cada vez que llega
un resumen nuevo sin duplicar nada.

Por qué existe: `urbano_cobranza()` (migr 033) ESTIMA lo que Urbano nos debe a partir de la
fecha de entrega. Esto es lo que Urbano REALMENTE pagó, guía por guía. La resta de los dos es
el reclamo. Sin esto no hay forma de saber qué entregó y nunca rindió.

Dos formatos conviven, ambos son pago (no se solapan nunca dentro del mismo martes):
  A "RESUMEN A PAGAR N° x"  -> guía de 13 dígitos sola + Valor Declarado; trae Total a transferir.
  B "Resumen a pagar numero x" -> guía embebida en QOPQ<ddmm><guía> + monto con separador de miles.
El `resumen_transferencia_*.xls` es el MISMO formato B pero en HTML (no es un xls de verdad) y
encima trae fecha de transferencia y N° de comprobante: es el único que PRUEBA que el giro salió.
Ojo: la fecha del NOMBRE de ese archivo es la de descarga, no la del giro — se usa la de la tabla.
"""
import csv, glob, os, re, sys

import fitz  # PyMuPDF

DEST = os.path.join(os.path.dirname(__file__), "..", "datos", "urbano_rendiciones.csv")
COLS = ["resumen", "fecha", "fmt", "guia", "monto", "comprobante", "archivo"]
plata = lambda s: float(s.replace(".", "").replace(",", "."))       # 1.234.567,89 -> float


def parse_pdf(path):
    txt = "\n".join(p.get_text() for p in fitz.open(path))
    base = os.path.basename(path)
    m = re.search(r"[Rr]esumen a pagar (?:numero|N°) (\d+)", txt) or re.search(r"N[°º] (\d+)", txt)
    resumen = m.group(1) if m else "?"
    f = re.search(r"(\d{2})-(\d{2})-(\d{2})", base)          # el PDF no trae fecha adentro: la del nombre
    fecha = f"20{f.group(3)}-{f.group(2)}-{f.group(1)}" if f else "?"
    out = []
    for g, monto in re.findall(r"^(\d{13})\n(\d+(?:\.\d+)?)$", txt, re.M):
        out.append((resumen, fecha, "A", g, float(monto), "", base))
    for g, monto in re.findall(r"^QOPQ\d{4}(\d{13})\n([\d.]+,\d{2})$", txt, re.M):
        out.append((resumen, fecha, "B", g, plata(monto), "", base))
    return out


def parse_xls(path):
    """resumen_transferencia_*.xls — HTML disfrazado de xls."""
    s = open(path, encoding="latin-1").read()
    base = os.path.basename(path)
    cab = re.search(r"<tbody>\s*<tr>\s*<td>(\d+)</td>\s*<td>[A-Z]+</td>\s*<td>(\d{2})-(\d{2})-(\d{4})</td>", s)
    resumen = cab.group(1) if cab else "?"
    fecha = f"{cab.group(4)}-{cab.group(3)}-{cab.group(2)}" if cab else "?"
    comp = re.search(r"Comprobante.*?<td>[\d-]+</td>\s*<td>(\d+)</td>", s, re.S)
    filas = re.findall(r">QOPQ\d{4}(\d{13})</td><td[^>]*>\d{13}</td>\s*<td[^>]*>([\d.]+,\d{2})</td>", s)
    return [(resumen, fecha, "B", g, plata(m), comp.group(1) if comp else "", base) for g, m in filas]


def parse(path):
    return parse_xls(path) if path.lower().endswith((".xls", ".html")) else parse_pdf(path)


def main(carpetas):
    filas = {}
    if os.path.exists(DEST):
        with open(DEST) as fh:
            for r in csv.DictReader(fh):
                filas[(r["resumen"], r["fecha"], r["guia"])] = [r.get(c, "") for c in COLS]
    previas = len(filas)

    archivos = sorted({a for x in carpetas for pat in ("*.pdf", "*.xls")
                       for a in (glob.glob(os.path.join(x, pat)) if os.path.isdir(x) else [x])})
    for p in archivos:
        rows = parse(p)
        if not rows:
            print(f"⚠️  {os.path.basename(p)}: 0 guías — ¿formato nuevo?")
            continue
        for r in rows:
            filas[(r[0], r[1], r[3])] = list(r)
        print(f"  {os.path.basename(p):45s} res {rows[0][0]:>5s} fmt {rows[0][2]} · {len(rows):4d} guías")

    with open(DEST, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(COLS)
        for k in sorted(filas, key=lambda k: (k[1], k[0])):
            w.writerow(filas[k])
    print(f"\n{len(filas)} filas ({len(filas) - previas} nuevas) → {os.path.relpath(DEST)}")

    # Un resumen cuyas guías ya están casi todas en otro ANTERIOR es una reimpresión, no un pago
    # nuevo (pasó con el 5545@19-06, copia exacta del 5468@12-05). Contarlo dos veces infla lo
    # cobrado y esconde el faltante.
    porres = {}
    for r in filas.values():
        porres.setdefault((r[1], r[0]), set()).add(r[3])
    ks = sorted(porres)
    for i, a in enumerate(ks):
        for b in ks[i + 1:]:
            comun = porres[a] & porres[b]
            if comun and len(comun) / len(porres[b]) > 0.95:
                print(f"⚠️  resumen {b[1]}@{b[0]} repite {len(comun)}/{len(porres[b])} guías "
                      f"de {a[1]}@{a[0]} — parece REIMPRESIÓN, no un giro nuevo")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
