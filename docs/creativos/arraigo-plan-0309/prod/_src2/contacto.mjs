import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const CH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const items = process.argv.slice(3).map(a => { const [f,t]=a.split('::'); return {f:resolve(f),t}; });
const html = `<!doctype html><meta charset=utf-8><style>
body{margin:0;background:#111;font:600 13px/1.3 -apple-system,Arial;color:#eee;display:flex;flex-wrap:wrap;gap:14px;padding:14px}
figure{margin:0;width:380px}img{width:380px;display:block;border-radius:6px}figcaption{padding:5px 2px}
</style>` + items.map(i=>`<figure><img src="file://${i.f}"><figcaption>${i.t}</figcaption></figure>`).join('');
const f=`/tmp/contacto-${Date.now()}.html`; writeFileSync(f,html);
const cols=Math.min(items.length,5), rows=Math.ceil(items.length/cols);
const W=Math.round(cols*394+28), H=Math.round(rows*(380*1.30+42)+28);
execFileSync(CH,['--headless=new','--hide-scrollbars',`--window-size=${W},${H}`,
  `--screenshot=${resolve(process.argv[2])}`,`file://${f}`],{stdio:'ignore'});
console.log(process.argv[2]);
