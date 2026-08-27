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
El `transferencia_ID-<n>_*.xlsx` (xlsx de verdad, "Detalle de Transferencia Contrarrembolso N° n")
es el MISMO stream A con otra numeración: el 5141 trae las 82 guías exactas del resumen A 5728 del
16/06. Por eso entra como fmt A y el detector de reimpresión de abajo se queda con una sola copia.
El `resumen_transferencia_*.xls` es el MISMO formato B pero en HTML (no es un xls de verdad) y
encima trae fecha de transferencia y N° de comprobante: es el único que PRUEBA que el giro salió.
Ojo: la fecha del NOMBRE de ese archivo es la de descarga, no la del giro — se usa la de la tabla.
"""
import csv, datetime as dt, glob, os, re, sys

import fitz  # PyMuPDF
import openpyxl

DEST = os.path.join(os.path.dirname(__file__), "..", "datos", "urbano_rendiciones.csv")
COLS = ["resumen", "fecha", "fmt", "guia", "monto", "comprobante", "transferido", "archivo"]
plata = lambda s: float(s.replace(".", "").replace(",", "."))       # 1.234.567,89 -> float


def parse_pdf(path):
    txt = "\n".join(p.get_text() for p in fitz.open(path))
    base = os.path.basename(path)
    m = re.search(r"[Rr]esumen a pagar (?:numero|N°) (\d+)", txt) or re.search(r"N[°º] (\d+)", txt)
    resumen = m.group(1) if m else "?"
    f = re.search(r"(\d{2})-(\d{2})-(\d{2})", base)          # el PDF no trae fecha adentro: la del nombre
    fecha = f"20{f.group(3)}-{f.group(2)}-{f.group(1)}" if f else "?"
    # Desde el 04/08/2026 el código de seguimiento dejó de ser el order_id de 13 dígitos y pasó a
    # BLABS<nro-pedido>: los dos regex pedían \d{13}, así que un resumen nuevo habría entrado
    # PARCIAL. Y `main` solo avisa cuando salen CERO filas — 11 de 78 pasaba en silencio, y el
    # faltante se lee como plata que Urbano no pagó (infla el reclamo). Por eso cada formato cierra
    # ahora contra el total impreso en el propio PDF: es plata contra plata, no conteo, y el
    # próximo cambio de formato tiene que gritar en vez de mentir. Mismo criterio que `parse_xls`.
    out = []
    for fmt, pat, tot, num in (
            ("A", r"^(\d{13}|BLABS\d+)\n(\d+(?:\.\d+)?)$", r"^SUB-TOTALES\n([\d.]+)$", float),
            ("B", r"^QOPQ\d{4}(\w+)\n([\d.]+,\d{2})$", r"^TOTALES\n([\d.]+,\d{2})$", plata)):
        filas = re.findall(pat, txt, re.M)
        if not filas:
            continue
        t = re.search(tot, txt, re.M)
        if not t:
            sys.exit(f"❌ {base}: {len(filas)} guías fmt {fmt} y ningún total impreso — no puedo validar, no sigo")
        leido, esperado = sum(num(x) for _, x in filas), num(t.group(1))
        if abs(leido - esperado) > 0.01:
            sys.exit(f"❌ {base}: fmt {fmt} parseé ${leido:,.2f} de ${esperado:,.2f} impresos "
                     f"({len(filas)} guías) — formato nuevo, no sigo")
        out += [(resumen, fecha, fmt, g, num(x), "", "", base) for g, x in filas]
    return out


def parse_xls(path):
    """resumen_transferencia_*.xls — HTML disfrazado de xls."""
    s = open(path, encoding="latin-1").read()
    base = os.path.basename(path)
    cab = re.search(r"<tbody>\s*<tr>\s*<td>(\d+)</td>\s*<td>[A-Z]+</td>\s*<td>(\d{2})-(\d{2})-(\d{4})</td>", s)
    resumen = cab.group(1) if cab else "?"
    fecha = f"{cab.group(4)}-{cab.group(3)}-{cab.group(2)}" if cab else "?"
    giro = re.search(r"Comprobante.*?<td>([\d-]{8,10})</td>\s*<td>([^<]*)</td>", s, re.S)
    transf = f"{giro.group(1)[6:]}-{giro.group(1)[3:5]}-{giro.group(1)[:2]}" if giro else ""
    comp = (giro.group(2).strip() if giro else "")
    # La barra es QOPQ<ddmm><código> y la 2ª columna repite el código: el backreference los ata,
    # así que no importa si el código son 13 dígitos o el BLABS<pedido> nuevo (desde el 04/08). El
    # regex viejo pedía \d{13} y se comía las BLABS EN SILENCIO — 67 de 78 guías en el resumen del
    # 18/08. Por eso abajo se cuenta contra las filas del tbody: un formato nuevo tiene que gritar.
    filas = re.findall(r">QOPQ\d{4}(\w+)</td><td[^>]*>\1</td>\s*<td[^>]*>([\d.]+,\d{2})</td>", s)
    cuerpo = re.search(r"<tbody>(.*?)</tbody>", s, re.S)
    esperadas = sum(1 for tr in re.findall(r"<tr>(.*?)</tr>", cuerpo.group(1), re.S)
                    if "TOTALES" not in tr) if cuerpo else len(filas)
    if filas and len(filas) != esperadas:       # 0 = no es este formato; parcial = perdemos plata
        sys.exit(f"❌ {base}: parseé {len(filas)} de {esperadas} filas — formato nuevo, no sigo")
    return [(resumen, fecha, "B", g, plata(m), comp, transf, base) for g, m in filas]


def parse_xlsx(path):
    """transferencia_ID-*.xlsx — filas (fecha, shipper, nombre, barra, monto, cheques, iibb)."""
    ws = openpyxl.load_workbook(path, data_only=True).active
    base = os.path.basename(path)
    m = (re.search(r"N[°º] (\d+)", str(ws.cell(1, 1).value or "")) or re.search(r"ID-(\d+)", base))
    if not m:                                  # cualquier otro xlsx de la carpeta: no es un resumen
        return []
    resumen = m.group(1)
    filas = [r for r in ws.iter_rows(min_row=3, values_only=True)
             if r[3] and not str(r[0] or "").startswith("Total")]
    # El detalle se genera al CIERRE de la ventana (lunes) y el giro sale el martes siguiente. Si
    # salió tarde (el 5254 se transfirió un jueves), el lunes anterior sigue siendo el cierre: por
    # eso se retrocede al lunes antes de pedir el martes de giro, y no se usa la fecha cruda.
    d = dt.date.fromisoformat(str(filas[0][0])[:10])
    lunes = d - dt.timedelta(days=(d.weekday() - 0) % 7)
    fecha = str(lunes + dt.timedelta(days=1))
    return [(resumen, fecha, "A", str(r[3]), float(r[4] or 0), f"T{resumen}", str(d), base) for r in filas]


def parse(path):
    if path.lower().endswith(".xlsx"):
        return parse_xlsx(path)
    return parse_xls(path) if path.lower().endswith((".xls", ".html")) else parse_pdf(path)


def main(carpetas):
    filas = {}
    if os.path.exists(DEST):
        with open(DEST) as fh:
            for r in csv.DictReader(fh):
                filas[(r["resumen"], r["fecha"], r["guia"])] = [r.get(c, "") for c in COLS]
    previas = len(filas)

    archivos = sorted({a for x in carpetas for pat in ("*.pdf", "*.xls", "*.xlsx")
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
