// Cliente mínimo del MCP de Veltron por HTTP (mismo patrón que scripts/despacho-etiquetas.mts).
// Sirve para llamadas sueltas desde la terminal o los agentes sin reinventar el cliente cada vez.
//   node --env-file=.env.local scripts/veltron.mjs tools/list '' ver_pedido,editar_guia   # schemas
//   node --env-file=.env.local scripts/veltron.mjs ver_pedido '{"pedido_id":2852,"carrier":"urbano"}'
//   node --env-file=.env.local scripts/veltron.mjs editar_guia '{"pedido_id":2852,"carrier":"urbano","guia":"BLABS20825R1","guia_anterior":"BLABS20825","forzar":true}'
// Las tools que escriben (editar_guia, agregar_nota, generar_etiqueta…) pegan en producción: el OK de
// Pancho va antes de invocarlas. ponytail: sin reintentos ni cupo — para lotes va despacho-etiquetas.mts.
const URL = process.env.VELTRON_MCP_URL ?? "https://ecomdash-board-platform-production.up.railway.app/mcp";
const [name, argsJson, filtro] = process.argv.slice(2);
if (!name) { console.error("uso: veltron.mjs <tool|tools/list> ['{json}'] [tool1,tool2]"); process.exit(1); }
const isList = name === "tools/list";
const body = isList ? { jsonrpc: "2.0", id: 1, method: name }
  : { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: JSON.parse(argsJson || "{}") } };
const r = await fetch(URL, {
  method: "POST",
  headers: { authorization: `Bearer ${process.env.VELTRON_API_KEY}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
  body: JSON.stringify(body), signal: AbortSignal.timeout(120_000),
});
const txt = await r.text();
if (!r.ok) { console.error(`HTTP ${r.status} ${txt.slice(0, 300)}`); process.exit(1); }
const res = JSON.parse(txt.startsWith("event:") || txt.startsWith("data:")
  ? txt.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("") : txt);
if (res.error) { console.error(res.error.message); process.exit(1); }
if (isList) {
  const quiero = filtro?.split(",");
  for (const t of res.result.tools) if (!quiero || quiero.includes(t.name))
    console.log(`${t.name} :: ${(t.description ?? "").replace(/\n/g, " ").slice(0, 400)}\n   params: ${JSON.stringify(t.inputSchema?.properties ?? {}).slice(0, 900)}`);
  process.exit(0);
}
const text = (res.result?.content ?? []).map((c) => c.text ?? "").join("");
if (res.result?.isError) { console.error(text); process.exit(1); }
console.log(text);
