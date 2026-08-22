// Markdown → PDF A4. Convertidor mínimo para los constructos que usan los reportes de docs/:
// headings, tablas, blockquote (con contenido anidado), listas, negrita, código, hr, párrafos.
// No pretende ser CommonMark: pretende que los reportes salgan bien y que se vea si algo no.
// Uso: node scripts/md2pdf.mjs docs/informe.md docs/informe.pdf
import fs from 'node:fs';
import { htmlToPdf } from './html2pdf.mjs';

const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const inline = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

function bloques(lineas) {
  const out = []; let i = 0;
  const esTabla = k => /^\s*\|/.test(lineas[k] ?? '') && /^\s*\|[\s:|-]+\|\s*$/.test(lineas[k+1] ?? '');
  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) { i++; continue; }

    if (/^>/.test(l)) {                                    // blockquote (puede traer de todo adentro)
      const buf = [];
      while (i < lineas.length && /^>/.test(lineas[i])) buf.push(lineas[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${bloques(buf)}</blockquote>`); continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }

    if (esTabla(i)) {
      const celdas = f => f.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = celdas(lineas[i]); i += 2;
      const filas = [];
      while (i < lineas.length && /^\s*\|/.test(lineas[i])) filas.push(celdas(lineas[i++]));
      out.push('<table><thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' + filas.map(f => '<tr>' + f.map(c =>
          `<td${/^-?[\d$€]/.test(c.replace(/\*\*/g,'')) ? ' class="n"' : ''}>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>'); continue;
    }

    const ol = /^\s*\d+\.\s+/.test(l), ul = /^\s*[-*]\s+/.test(l);
    if (ol || ul) {
      const items = [];
      while (i < lineas.length && (/^\s*\d+\.\s+/.test(lineas[i]) || /^\s*[-*]\s+/.test(lineas[i]) || /^\s{2,}\S/.test(lineas[i]))) {
        if (/^\s{2,}\S/.test(lineas[i]) && items.length) items[items.length-1] += ' ' + lineas[i].trim();
        else items.push(lineas[i].replace(/^\s*(?:\d+\.|[-*])\s+/, ''));
        i++;
      }
      const t = ol ? 'ol' : 'ul';
      out.push(`<${t}>` + items.map(x => `<li>${inline(x)}</li>`).join('') + `</${t}>`); continue;
    }

    const par = [];
    while (i < lineas.length && lineas[i].trim() && !/^[>#|]/.test(lineas[i]) &&
           !/^(-{3,})\s*$/.test(lineas[i]) && !/^\s*(?:\d+\.|[-*])\s+/.test(lineas[i])) par.push(lineas[i++]);
    if (par.length) out.push(`<p>${inline(par.join(' '))}</p>`);
  }
  return out.join('\n');
}

const CSS = `
  @page { margin: 0; }
  body { font: 10.5px/1.55 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a;
         margin: 0; padding: 22px 26px; -webkit-print-color-adjust: exact; }
  h1 { font-size: 19px; margin: 0 0 4px; letter-spacing: -.3px; }
  h2 { font-size: 14.5px; margin: 20px 0 7px; padding-bottom: 4px; border-bottom: 1.5px solid #111;
       break-after: avoid; }
  h3 { font-size: 12px; margin: 14px 0 5px; break-after: avoid; }
  p { margin: 6px 0; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 16px 0; }
  code { font: 9.5px ui-monospace, Menlo, monospace; background: #f2f2f2; padding: 1px 4px;
         border-radius: 3px; }
  table { border-collapse: collapse; width: 100%; margin: 9px 0; font-size: 9.8px;
          break-inside: avoid; }
  th { background: #f0f0f0; text-align: left; font-weight: 600; }
  th, td { border: 1px solid #d6d6d6; padding: 4px 7px; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:nth-child(even) { background: #fafafa; }
  blockquote { margin: 12px 0; padding: 10px 14px; background: #fff8e6; border-left: 3px solid #e0a800;
               break-inside: avoid; }
  blockquote h3 { margin-top: 0; }
  ul, ol { margin: 6px 0; padding-left: 20px; }
  li { margin: 3px 0; }
  strong { font-weight: 600; }
`;

const [,, inp, out] = process.argv;
if (!inp || !out) { console.error('uso: node scripts/md2pdf.mjs entrada.md salida.pdf'); process.exit(1); }
const md = fs.readFileSync(inp, 'utf8');
const html = `<!doctype html><meta charset="utf-8"><style>${CSS}</style>\n${bloques(md.split('\n'))}`;
const tmp = `/tmp/md2pdf-${process.pid}.html`;
fs.writeFileSync(tmp, html);
await htmlToPdf(tmp, out, 21, 29.7, 1);          // A4
fs.unlinkSync(tmp);
console.log(out);
