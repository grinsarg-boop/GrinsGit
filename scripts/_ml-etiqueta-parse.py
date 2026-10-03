"""Lee un PDF de etiquetas de ML y devuelve, por etiqueta, su envio, su Venta/Pack ID y el limite impreso.

Solo cuenta como etiqueta la pagina que dice "Recortá". La hoja "Identificación Productos" del final
no lo dice, y trae enteros los numeros de envio de las Flex: contarla haria pasar esa hoja por la
etiqueta de un Flex.

`envio` sale None en las Flex: ahi el numero viene partido ("Envio: 4810547 4871"). Se identifican
por `venta` (el Venta ID o Pack ID del encabezado). `despachar` es el "Despachar: …" impreso; la
seleccion ya viene de GET /shipments/{id}/sla, esto queda para el control cruzado.

Salida: JSON [{"pagina": 0, "envio": "48067191546", "venta": "2000018603382674", "despachar": "2026-09-24T17:30"}]
"""
import json
import re
import sys
from datetime import datetime

from pypdf import PdfReader

MESES = {m: i + 1 for i, m in enumerate(
    "ene feb mar abr may jun jul ago sep oct nov dic".split())}

RE_ENVIO = re.compile(r"\b(4[0-9]{10})\b")
RE_VENTA = re.compile(r"(?:Venta|Pack) ID:\s*(\d{16})")
RE_DESP = re.compile(r"Despachar:\s*\w+\s+(\d{1,2})/(\w{3})\s+antes de\s+(\d{1,2}):(\d{2})")


def main(path: str, anio: int) -> None:
    out = []
    for i, page in enumerate(PdfReader(path).pages):
        t = page.extract_text() or ""
        if "recort" not in t.lower():
            continue
        envio = RE_ENVIO.search(t)
        venta = RE_VENTA.search(t)
        m = RE_DESP.search(t)
        limite = None
        if m:
            dia, mes, hh, mm = int(m[1]), MESES.get(m[2].lower()), int(m[3]), int(m[4])
            if mes:
                limite = datetime(anio, mes, dia, hh, mm).isoformat(timespec="minutes")
        out.append({"pagina": i, "envio": envio[1] if envio else None,
                    "venta": venta[1] if venta else None, "despachar": limite})
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]))
