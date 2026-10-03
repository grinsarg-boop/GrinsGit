// armar-v3.mjs — copia de armar.mjs (mismo layout de texto, mismos bullets, mismo sello, misma
// barra) apuntando a las 3 escenas v3 que pasaron QA. A4 murió en las 2 rondas (etiqueta
// garbleada) y no entra: no se fuerza una pieza que no pasó.
// Uso: node armar-v3.mjs <dirSalida>
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const OUT = resolve(process.argv[2] || 'piezas');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BARRA = 'PAGÁS AL RECIBIR · ENVÍO GRATIS · +10.000 PERSONAS';
const SRC2 = '/Users/franciscoandreudegasperi/Downloads/ProyectoEco/docs/creativos/arraigo-plan-0309/prod/_src2';

const piezas = [
  {
    id: 'a1-raya', escena: `${SRC2}/out-v3/p1-b-v3r2.jpg`,
    titular: ['NO ES EL SHAMPOO.', 'ES LA <u>RAÍZ</u>.'], tfs: 8.2, tbox: [4, 4, 92],
    quote: ['"Juntaba pelo del cepillo', 'todas las mañanas.', 'Ahora junto mucho menos."'],
    qfs: 3.5, qbox: [4, 30, 41],
    bullets: ['Romero + Cafeína + Capixyl', '60 segundos, de noche'], bfs: 2.4, bbox: [4, 50, 34],
    sello: ['SIN', 'MINOXIDIL'], sbox: [5, 63, 15],
  },
  {
    id: 'a2-sin-minoxidil', escena: `${SRC2}/out-v3/p2-b-v3r2.jpg`,
    titular: ['NO QUERÍA EMPEZAR', 'CON <u>MINOXIDIL</u>.'], tfs: 7.6, tbox: [4, 4, 92],
    quote: ['"No quería engancharme', 'con algo fuerte.', 'Elegí el de romero', 'y lo usé 3 meses."'],
    qfs: 3.4, qbox: [4, 29, 42],
    bullets: ['Cosmético de romero', '1 frasco = 1 mes de uso'], bfs: 2.4, bbox: [4, 55, 34],
    sello: ['GARANTÍA', '90 DÍAS'], sbox: [5, 68, 15],
  },
  {
    id: 'a3-90-dias', escena: `${SRC2}/out-v3/p3-a-v3.jpg`,
    titular: ['MES 1: NO PASA NADA.', '<u>TE LO DECIMOS ANTES.</u>'], tfs: 6.2, tbox: [4, 3, 73],
    quote: ['"El primer mes no vi nada', 'y casi lo dejo.', 'Terminé los tres igual."'],
    qfs: 3.2, qbox: [4, 30, 44],
    bullets: [], bfs: 2.5, bbox: [4, 0, 30],
    sello: ['TRATAMIENTO', '90 DÍAS'], sbox: [79, 3, 17],
  },
];

const css = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{overflow:hidden;background:#F4EEE2}
body{font-family:"Avenir Next","Arial Black",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.canvas{position:relative;width:100vw;overflow:hidden;display:flex;flex-direction:column}
.head{display:none}
.foto{position:relative;width:100vw;height:100vw;overflow:hidden}
.foto>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.l{white-space:nowrap;display:block}
.tit{position:absolute;font-weight:800;letter-spacing:-.02em;line-height:1.02;color:#1E2A1B;
     text-transform:uppercase;text-shadow:0 0 26px rgba(255,255,255,.92),0 0 10px rgba(255,255,255,.95)}
.tit u{text-decoration:none;box-shadow:inset 0 -.14em 0 rgba(107,133,96,.85);color:#31502C}
.quote{position:absolute;font-weight:700;line-height:1.28;color:#20291D;
       text-shadow:0 0 20px rgba(255,255,255,.95),0 0 8px rgba(255,255,255,.95)}
.bul{position:absolute;display:flex;flex-direction:column;gap:.55em}
.bul div{display:flex;align-items:center;gap:.5em;font-weight:700;color:#20291D;line-height:1.15;
         text-shadow:0 0 16px rgba(255,255,255,.95)}
.bul i{flex:0 0 auto;width:1.5em;height:1.5em;border-radius:50%;background:#3E5238;color:#FBF6EC;
       font-style:normal;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:.8em}
.sello{position:absolute;aspect-ratio:1;border-radius:50%;background:#3E5238;color:#FBF6EC;
       display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
       font-weight:800;letter-spacing:.02em;line-height:1.12;box-shadow:0 6px 22px rgba(0,0,0,.28);
       border:.35vw solid rgba(251,246,236,.55);outline:.18vw dashed rgba(251,246,236,.5);outline-offset:-1.1vw}
.barra{position:absolute;left:0;right:0;bottom:0;height:7.8vw;background:#2F4230;color:#FBF6EC;
       display:flex;align-items:center;justify-content:center;gap:1.4vw;white-space:nowrap}
.barra .st{color:#F5B301;font-size:3.1vw;letter-spacing:.12vw;line-height:1}
.barra .tx{font-weight:800;letter-spacing:.04em;font-size:2.15vw}
/* 4:5 — banda de titular arriba, foto cuadrada abajo */
.f45 .head{display:flex;align-items:center;width:100vw;height:25vw;background:#F4EEE2;
           border-bottom:.55vw solid #3E5238;padding:0 4vw}
.f45 .head .tit{position:static;text-shadow:none}
.f45 .foto .tit{display:none}
`;

const L = a => a.map(x => `<span class="l">${x}</span>`).join('');
const html = (p, f45) => `<!doctype html><meta charset="utf-8"><style>${css}</style>
<body class="${f45 ? 'f45' : ''}"><div class="canvas">
  <div class="head"><div class="tit" style="font-size:${p.tfs * 0.92}vw">${p.titular.join('<br>')}</div></div>
  <div class="foto">
    <img src="${p.escena}">
    <div class="tit" style="left:${p.tbox[0]}%;top:${p.tbox[1]}%;width:${p.tbox[2]}%;font-size:${p.tfs}vw">${L(p.titular)}</div>
    <div class="quote" style="left:${p.qbox[0]}%;top:${p.qbox[1]}%;width:${p.qbox[2]}%;font-size:${p.qfs}vw">${L(p.quote)}</div>
    ${p.bullets.length ? `<div class="bul" style="left:${p.bbox[0]}%;top:${p.bbox[1]}%;width:${p.bbox[2]}%;font-size:${p.bfs}vw">
      ${p.bullets.map(b => `<div><i>✓</i><span>${b}</span></div>`).join('')}</div>` : ''}
    <div class="sello" style="left:${p.sbox[0]}%;top:${p.sbox[1]}%;width:${p.sbox[2]}%;font-size:${p.sbox[2] * 0.148}vw">${L(p.sello)}</div>
    <div class="barra"><span class="st">★★★★★</span><span class="tx">${BARRA}</span></div>
  </div>
</div></body>
<script>
document.querySelectorAll('.tit,.quote').forEach(function(b){
  var px = parseFloat(getComputedStyle(b).fontSize);
  var cabe = function(){ var w = b.clientWidth;
    return [].every.call(b.querySelectorAll('.l'), function(l){ return l.scrollWidth <= w; }); };
  while (!cabe() && px > 12) { px -= 1; b.style.fontSize = px + 'px'; }
});
</script>`;

mkdirSync(OUT, { recursive: true });
const tmp = `/tmp/armar-v3-${Date.now()}`; mkdirSync(tmp);
for (const p of piezas) {
  for (const [suf, w, h, f45] of [['1x1', 2048, 2048, false], ['4x5', 1080, 1350, true]]) {
    const f = `${tmp}/${p.id}-${suf}.html`;
    writeFileSync(f, html(p, f45));
    const png = `${tmp}/${p.id}-${suf}.png`;
    execFileSync(CHROME, ['--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1',
      `--window-size=${w},${h}`, `--screenshot=${png}`, `file://${f}`], { stdio: 'ignore' });
    execFileSync('/usr/bin/sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '88', png,
      '--out', `${OUT}/${p.id}-${suf}.jpg`], { stdio: 'ignore' });
    console.log(`${OUT}/${p.id}-${suf}.jpg`);
  }
}
