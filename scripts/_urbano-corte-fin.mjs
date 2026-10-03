// Medición final: solo los giros con historial completo en el WS (>= 2026-06-16; antes Urbano
// purga los movimientos y no hay hora para nadie).
import { readFileSync } from 'node:fs';
const DOW = ['dom','lun','mar','mié','jue','vie','sáb'], DIA = 86400000;
const filas = JSON.parse(readFileSync('datos/urbano_corte.json','utf8'))
  .filter(x => x.pago >= '2026-06-16' && x.fecha && x.hora)
  .map(x => {
    const [D,M,Y] = x.fecha.split('-');
    const t = Date.parse(`${Y}-${M}-${D}T${x.hora}:00-03:00`);
    const dow = new Date(t - 3*3600000).getUTCDay();
    const esperado = Date.parse(`${Y}-${M}-${D}T00:00:00-03:00`) + (dow===2 ? 7 : (2-dow+7)%7)*DIA;
    return { ...x, t, dow, dowN: DOW[dow], hh:+x.hora.slice(0,2),
             lag: Math.round((Date.parse(`${x.pago}T00:00:00-03:00`) - esperado)/(7*DIA)) };
  });
const n = filas.length, ok = filas.filter(x => x.lag === 0).length;
console.log(`giros 16/06→18/08 · guías con hora de entrega: ${n}`);
console.log(`caen en la ventana martes 00:00 → lunes 23:59 de su giro: ${ok} (${(100*ok/n).toFixed(1)}%)\n`);
for (const k of [2,3,4,5,6,0,1]) {
  const g = filas.filter(x => x.dow === k); if (!g.length) continue;
  const o = g.filter(x => x.lag===0).length;
  console.log(`  ${DOW[k]}  n=${String(g.length).padStart(4)}  en su ventana ${(100*o/g.length).toFixed(1)}%  ventana+1 ${g.filter(x=>x.lag>0).length}  ventana−1 ${g.filter(x=>x.lag<0).length}`);
}
const lun = filas.filter(x => x.dow===1);
console.log('\nlunes por franja (el borde de cierre):');
for (const [a,b] of [[8,16],[16,18],[18,20],[20,21],[21,22],[22,24]]) {
  const g = lun.filter(x => x.hh>=a && x.hh<b);
  console.log(`  ${String(a).padStart(2,'0')}–${String(b).padStart(2,'0')}h  n=${String(g.length).padStart(3)}  en su ventana ${g.filter(x=>x.lag===0).length}  ventana+1 ${g.filter(x=>x.lag>0).length}`);
}
const mar = filas.filter(x => x.dow===2);
console.log('\nmartes por franja (el borde de apertura):');
for (const [a,b] of [[8,16],[16,18],[18,20],[20,24]]) {
  const g = mar.filter(x => x.hh>=a && x.hh<b);
  console.log(`  ${String(a).padStart(2,'0')}–${String(b).padStart(2,'0')}h  n=${String(g.length).padStart(3)}  ventana que ABRE ${g.filter(x=>x.lag===0).length}  ventana que CIERRA ${g.filter(x=>x.lag<0).length}`);
}
