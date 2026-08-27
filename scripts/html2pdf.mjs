// HTML local → PDF con tamaño de papel exacto. `--print-to-pdf` de la CLI ignora @page y siempre
// saca Letter, así que hay que pedírselo a Chrome por DevTools Protocol.
// Uso: node scripts/html2pdf.mjs entrada.html salida.pdf [anchoCm] [altoCm]
import fs from "node:fs";
import { spawn } from "node:child_process";

const CHROME = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CM = 1 / 2.54; // Chrome pide pulgadas

export async function htmlToPdf(htmlPath, pdfPath, anchoCm = 10, altoCm = 15, escala = 0.95) {
  const port = 9222 + Math.floor(process.pid % 500);
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${port}`, `--user-data-dir=${fs.mkdtempSync("/tmp/chr-")}`, "about:blank",
  ], { stdio: "ignore" });

  try {
    let target;
    for (let i = 0; i < 40 && !target; i++) {                       // Chrome tarda ~1s en levantar
      await new Promise((s) => setTimeout(s, 250));
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch { /* todavía no */ }
    }
    if (!target) throw new Error("Chrome no levantó el puerto de debugging");

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error("no conecta al WS")); });

    let id = 0;
    const pend = new Map();
    const eventos = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? {}); pend.delete(m.id); }
      if (m.method && eventos.has(m.method)) { eventos.get(m.method)(); eventos.delete(m.method); }
    };
    const cmd = (method, params = {}) => new Promise((r) => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
    const espera = (ev) => new Promise((r) => eventos.set(ev, r));

    await cmd("Page.enable");
    const cargado = espera("Page.loadEventFired");
    await cmd("Page.navigate", { url: `file://${htmlPath}` });
    await Promise.race([cargado, new Promise((r) => setTimeout(r, 20_000))]);
    await new Promise((s) => setTimeout(s, 800));                    // que terminen barcodes/QR embebidos

    const { data } = await cmd("Page.printToPDF", {
      paperWidth: anchoCm * CM, paperHeight: altoCm * CM,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
      scale: escala,          // el rótulo de Fixy es apenas más ancho que 10cm y queda al ras del borde
      printBackground: true, preferCSSPageSize: false,
    });
    ws.close();
    if (!data) throw new Error("printToPDF no devolvió nada");
    fs.writeFileSync(pdfPath, Buffer.from(data, "base64"));
    return pdfPath;
  } finally {
    chrome.kill();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , inp, out, w, h] = process.argv;
  if (!inp || !out) { console.error("uso: node scripts/html2pdf.mjs entrada.html salida.pdf [anchoCm] [altoCm]"); process.exit(1); }
  await htmlToPdf(inp, out, Number(w ?? 10), Number(h ?? 15));
  console.log(out);
}
