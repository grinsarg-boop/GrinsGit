#!/usr/bin/env python3
"""Motor de decisión COD-Dropi. Dado PV, costo, flete y comisión, calcula el
CPA maximo que banca un producto por tasa de entrega p, y el flete/p de breakeven.
Regla dura BioLabs: profit_por_pedido = CPA_max - CPA_real_Meta.
Ancla real (22/07): Kit Blanqueador Dental a Palermo -> Urbano flete 15564, comision 3212 (4.025% del PV).
"""
COMIS_PCT = 0.04025   # comisión Dropi = 4.025% del PV (medido en la cotización real; verificar en otros)
D = 0.75              # tasa de despacho (pedido pauteado -> despachado) con confirmación WhatsApp/Veltron
CPA_REAL = 5000       # CPA de Meta esperado (rango real BioLabs 4000-6000); referencia
PS = [0.40, 0.45, 0.50, 0.55, 0.60, 0.65]

def margin_if_delivered(pv, cost, flete, comis_pct=COMIS_PCT):
    return pv - cost - flete - comis_pct*pv

def e_despacho(pv, cost, flete, p, comis_pct=COMIS_PCT):
    """Valor esperado por pedido DESPACHADO: entrega o se pierde el flete de ida."""
    m = margin_if_delivered(pv, cost, flete, comis_pct)
    return p*m - (1-p)*flete

def cpa_max(pv, cost, flete, p, d=D, comis_pct=COMIS_PCT):
    """Lo maximo que podes pagar de CPA por pedido PAUTEADO y no perder."""
    return d*e_despacho(pv, cost, flete, p, comis_pct)

def flete_breakeven(pv, cost, p, cpa_target=CPA_REAL, d=D, comis_pct=COMIS_PCT):
    """Flete maximo que el producto banca a tasa p para cubrir cpa_target. Si Dropi cobra menos, sirve."""
    base = pv - cost - comis_pct*pv
    # cpa_target = d*(p*(base-flete) - (1-p)*flete)  -> resolver flete
    # cpa_target/d = p*base - p*flete - (1-p)*flete = p*base - flete
    return p*base - cpa_target/d

def p_breakeven(pv, cost, flete, cpa_target=CPA_REAL, d=D, comis_pct=COMIS_PCT):
    """Tasa de entrega minima para que CPA_max >= cpa_target, dado el flete real."""
    m = margin_if_delivered(pv, cost, flete, comis_pct)
    # d*(p*m - (1-p)*flete) = cpa_target -> p*(m+flete) - flete = cpa_target/d
    denom = m + flete
    if denom <= 0: return None
    return (cpa_target/d + flete) / denom

def fmt(x):
    if x is None: return "  n/a"
    return f"{x:>10,.0f}".replace(",", ".")

# ---- Candidatos. flete_urbano/fixy: None = aun no cotizado (breakeven en su lugar) ----
PROD = [
    # nombre, PV, costo, flete_urbano, flete_fixy
    ("Kit Blanqueador Dental", 79800, 39900, 15564, 9680),   # REAL (Palermo)
    ("Camara Jortan",         110000, 42000, None,  None),
    ("Gorro migrana",          39900,  6000, None,  None),
    ("Juego Basta!",           59000, 18700, None,  None),
    ("Parches x2",             39990,  5000, None,  None),
]

print("="*92)
print(f"MOTOR COD-DROPI  |  comision {COMIS_PCT*100:.2f}% del PV  |  d(despacho)={D:.0%}  |  CPA_Meta objetivo ${CPA_REAL:,}".replace(",", "."))
print("="*92)

for name, pv, cost, fu, ff in PROD:
    print(f"\n### {name}   PV ${pv:,}  costo ${cost:,}".replace(",", "."))
    m_no_flete = pv - cost - COMIS_PCT*pv
    print(f"    Margen antes de flete: ${m_no_flete:,.0f}".replace(",", "."))
    for label, flete in [("Urbano", fu), ("Fixy", ff)]:
        if flete is None:
            # no cotizado: mostrar flete de breakeven por p
            print(f"    {label}: (sin cotizar) flete MAXIMO que banca CPA ${CPA_REAL:,} por p:".replace(",", "."))
            fb = "   ".join(f"p{int(pp*100)}:{fmt(flete_breakeven(pv,cost,pp))}" for pp in [0.4,0.5,0.6])
            print(f"        {fb}")
        else:
            pbe = p_breakeven(pv, cost, flete)
            pbe_s = f"{pbe*100:.0f}%" if pbe else "imposible"
            row = "  ".join(f"p{int(pp*100)}:{fmt(cpa_max(pv,cost,flete,pp))}" for pp in PS)
            print(f"    {label} flete ${flete:,}  ->  CPA_max por p:".replace(",", "."))
            print(f"        {row}")
            print(f"        margen si entrega: ${margin_if_delivered(pv,cost,flete):,.0f}   p de breakeven (CPA_max=${CPA_REAL:,}): {pbe_s}".replace(",", "."))

print("\n" + "="*92)
print("LECTURA: CPA_max negativo = perdes plata en cada pedido pauteado a esa tasa de entrega.")
print("Para los sin cotizar: si el flete real de Dropi < el flete-breakeven mostrado, el producto banca ese CPA.")
print("="*92)
