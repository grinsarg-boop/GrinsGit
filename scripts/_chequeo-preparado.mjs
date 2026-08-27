// Cruza el filtro "Preparado" de Veltron contra las APIs de Urbano y Fixy:
// ¿la guía que muestra el panel existe de verdad en el courier, y llegó a moverse?
const U = { url: process.env.URBANO_API_URL.replace(/\/$/, ""), shipper: Number(process.env.URBANO_SHIPPER), pass: process.env.URBANO_PASSWORD };
const FX = "https://fixy.epresis.com";

const URBANO = "19446,19444,19443,19442,19440,19439,19437,19435,19434,19431,19430,19429,19428,19426,19424,19423,19419,19418,19416,19415,19401,19400,19399,19397,19396,19164,18975,19349,19372,19370,19368,19367,19366,19363,19362,19358,19357,19355,19353,19351,19350,19348,19347,19346,19345,19343,19342,19341,19339,19338,19337,19336,19335,19331,19330,19329,19327,19325,19324,19322,19321,19320,19318,19316,19315,19314,19312,19311,19310,19308,19307,19305,19304,19300,19297,19296,19294,19293,19292,19291,19289,19288,19287,19286,19284,19283,19282,19281,19278,19276,19275,19266,19264,19263,19260,19259,19258,19256,19255,19252,19251,19250,19249,19247,19246,19242,19239,19236,19235,19234,19232,19231,19230,19225,19224,19221,19220,19215,19212,19210,19207,19206,19197,19196,19194,19191,19188,19183,19177,19162,19146,19129,19125,19119,19104,19098,19094,19060,19035".split(",");
const FIXY = "19433:1764777 19432:1764776 19427:1764775 19425:1764778 19422:1764779 19410:1764780 19406:1764781 19398:1764782 18782:1762122 19391:1762121 19390:1762120 19382:1762123 19369:1762124 19361:1762125 19356:1762126 19334:1762127 19332:1762128 19328:1762129 19326:1762130 19323:1762131 19241:1758915 19240:1758914 19219:1758917 19095:1758929"
  .split(" ").map((s) => { const [pedido, guia] = s.split(":"); return { pedido, guia }; });

// --- Urbano: masivo
const urb = [];
for (let i = 0; i < URBANO.length; i += 100) {
  const lote = URBANO.slice(i, i + 100);
  const r = await (await fetch(`${U.url}/tracking/consultaTrackingMasivo/`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ autentificacion: { shipper: U.shipper, password: U.pass }, datos: lote.map((p) => ({ codigoSeguimiento: `BLABS${p}` })) }),
  })).json();
  urb.push(...r);
}
const urbRes = urb.map((x) => {
  const movs = (x.movimientos ?? []).filter((m) => m.checkFecha);
  const soloPI = movs.length > 0 && movs.every((m) => (m.check ?? "").toUpperCase() === "PI");
  return {
    pedido: String(x.codGestion).replace(/^BLABS/, ""),
    existe: x.codError === 0,
    estado: movs.length ? (soloPI ? "solo PI" : movs.at(-1).check) : "sin movimientos",
    movio: movs.length > 0 && !soloPI,
    ultima: movs.at(-1)?.checkFecha ?? null,
  };
});

// --- Fixy: uno por remito (el pedido pelado; estos son altas nuevas, sin sufijo)
const fixRes = [];
for (let i = 0; i < FIXY.length; i += 5) {
  const lote = FIXY.slice(i, i + 5);
  fixRes.push(...await Promise.all(lote.map(async (f) => {
    const j = await (await fetch(`${FX}/api/v2/seguimiento.json`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_token: process.env.FIXY_API_TOKEN, remito: f.pedido }),
    })).json().catch(() => ({}));
    const ev = j?.guia?.fechas ?? [];
    return {
      pedido: f.pedido, guiaPanel: f.guia, guiaApi: ev[0]?.guia ? String(ev[0].guia) : null,
      existe: !!ev.length, estado: ev[0] ? `${ev[0].codigo_estado} ${ev[0].estado}` : "sin datos",
      movio: ev.length > 1, coincide: ev[0]?.guia ? String(ev[0].guia) === f.guia : false,
    };
  })));
}

const p = (t) => console.log("\n" + t);
console.log(`URBANO ${urbRes.length} · FIXY ${fixRes.length}`);


// La ventana normal PI→admisión es ~1,3 d (p90 2,1). Con eso, "solo PI" de hoy es normal y
// "solo PI" de hace 2 días o más está trabado.
const HOY = new Date(2026, 7, 11);
const dias = (f) => f ? Math.round((HOY - new Date(+f.slice(6), +f.slice(3,5)-1, +f.slice(0,2))) / 864e5) : null;
const uNo = urbRes.filter((r) => !r.existe);
const uPI = urbRes.filter((r) => r.existe && !r.movio);
p(`URBANO — no existen en el courier: ${uNo.length}`);
if (uNo.length) console.log("  " + uNo.map((r) => r.pedido).join(", "));
const porDia = {};
for (const r of uPI) (porDia[r.ultima ?? "?"] ??= []).push(r.pedido);
p(`URBANO — existen pero NO se movieron: ${uPI.length}`);
for (const [f, ps] of Object.entries(porDia).sort()) {
  const d = dias(f);
  console.log(`  ${f} (${d} d) · ${ps.length} ${d >= 2 ? "← TRABADOS" : "← normal, dentro de ventana"}`);
  if (d >= 2) console.log(`     ${ps.join(", ")}`);
}
p(`URBANO — procesados de verdad (con movimiento real): ${urbRes.filter((r) => r.movio).length}`);

const fNo = fixRes.filter((r) => !r.existe);
const fDist = fixRes.filter((r) => r.existe && !r.coincide);
const fPI = fixRes.filter((r) => r.existe && !r.movio);
p(`FIXY — no existen: ${fNo.length}`);
if (fNo.length) console.log("  " + fNo.map((r) => `${r.pedido}(panel ${r.guiaPanel})`).join(", "));
p(`FIXY — guía del panel ≠ guía de la API: ${fDist.length}`);
if (fDist.length) console.log("  " + fDist.map((r) => `${r.pedido}: panel ${r.guiaPanel} vs api ${r.guiaApi}`).join(", "));
p(`FIXY — existen pero sin movimiento (solo el alta): ${fPI.length}`);
if (fPI.length) console.log("  " + fPI.map((r) => r.pedido).join(", "));
p(`FIXY — procesados de verdad: ${fixRes.filter((r) => r.movio).length}`);
