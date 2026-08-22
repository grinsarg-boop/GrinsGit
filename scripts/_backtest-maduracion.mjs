// Backtest out-of-sample de 3 formas de estimar la tasa final de una cohorte COD.
//   A = prior de la ventana 21-35 días (canon Pancho 21/08/2026)
//   B = cadena neta: entregado(t) / Gd(t), con Gd medida en cohortes ya cerradas
//   C = edad efectiva: se lee cuánto resolvió la cohorte, se busca a qué edad
//       corresponde ese % en el ritmo histórico, y se usa Gd de ESA edad.
// Entrenamiento: solo cohortes del mismo courier cerradas (>=21d) a la fecha de proyección.
import pg from 'pg';
import { readFileSync } from 'node:fs';
const url = readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: url, ssl:{rejectUnauthorized:false} });
await c.connect();
const { rows } = await c.query(`
  select s.courier, to_char(s.dispatched_at,'YYYY-MM-DD') as disp,
         (s.status_canonical='entregado') as deliv,
         (s.status_canonical in ('rehusado','en_devolucion','devuelto','siniestro')) as ret,
         case when s.status_canonical in ('entregado','rehusado','en_devolucion','devuelto','siniestro')
              then greatest(coalesce(s.resolved_at, s.status_at)::date - s.dispatched_at, 0) end as er
  from shipments s
  where s.courier in ('urbano','fixy') and s.status_canonical <> 'cancelado'
    and s.dispatched_at >= date '2026-05-15' and s.dispatched_at <= current_date - 21`);
await c.end();

const weekOf=d=>{const x=new Date(d+'T00:00:00Z');const dow=(x.getUTCDay()+6)%7;x.setUTCDate(x.getUTCDate()-dow);return x.toISOString().slice(0,10);};
const addD=(s,n)=>{const x=new Date(s+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const MAXT=30;
const MINN=Number(process.argv[2]||150);

const coh=new Map();
for(const r of rows){const k=r.courier+'|'+weekOf(r.disp);if(!coh.has(k))coh.set(k,[]);coh.get(k).push(r);}
const dAt=(gs,t)=>gs.filter(g=>g.deliv&&g.er!==null&&g.er<=t).length/gs.length;
const rAt=(gs,t)=>gs.filter(g=>g.er!==null&&g.er<=t).length/gs.length;
const Dfin=gs=>gs.filter(g=>g.deliv).length/gs.length;
const ok=(k,gs)=>{const[c2,w2]=k.split('|');return gs.length>=MINN&&!(c2==='fixy'&&w2<'2026-06-29');};

const AGES=[7,10,14], out=[];
for(const [k,gs] of coh){
  if(!ok(k,gs))continue;
  const [courier,wk]=k.split('|'), real=Dfin(gs);
  for(const t of AGES){
    const projDate=addD(wk,6+t);
    const train=[...coh].filter(([k2,g2])=>k2!==k&&k2.split('|')[0]===courier&&ok(k2,g2)&&addD(k2.split('|')[1],27)<=projDate).map(([,g])=>g);
    if(train.length<2)continue;
    const W=train.reduce((a,g)=>a+g.length,0);
    // curvas históricas ponderadas por tamaño: Gd(u)=entregas a u / entregas finales ; Rexp(u)=% resuelto a u
    const Gd=[],Rexp=[];
    for(let u=0;u<=MAXT;u++){
      Gd[u]=train.reduce((a,g)=>a+dAt(g,u)*g.length,0)/train.reduce((a,g)=>a+Dfin(g)*g.length,0);
      Rexp[u]=train.reduce((a,g)=>a+rAt(g,u)*g.length,0)/W;
    }
    // edad efectiva: u tal que Rexp(u) = resuelto observado (interpolado)
    const robs=rAt(gs,t); let teff=MAXT;
    for(let u=0;u<=MAXT;u++){ if(Rexp[u]>=robs){ teff = u===0?0:u-1+(robs-Rexp[u-1])/((Rexp[u]-Rexp[u-1])||1); break; } }
    const gdAt=x=>{const lo=Math.floor(x),hi=Math.min(MAXT,lo+1);return Gd[lo]+(Gd[hi]-Gd[lo])*(x-lo);};
    // A: prior ventana 21-35 antes de la fecha de proyección
    const lo=addD(projDate,-35),hi=addD(projDate,-21);
    let pd=0,pn=0; for(const r of rows) if(r.courier===courier&&r.disp>=lo&&r.disp<=hi){pn++;if(r.deliv)pd++;}
    const d=dAt(gs,t);
    out.push({courier,wk,n:gs.length,t,real,
      A: pn>=100?pd/pn:null,
      B: Gd[t]>0?d/Gd[t]:null,
      C: gdAt(teff)>0?d/gdAt(teff):null,
      D: (Gd[t]>0&&gdAt(teff)>0)?(d/Gd[t]+d/gdAt(teff))/2:null,
      teff});
  }
}
const p=x=>x==null?'  —  ':(x*100).toFixed(1).padStart(5);
const e=(x,r)=>x==null?'  — ':((x-r)>=0?'+':'')+((x-r)*100).toFixed(1).padStart(4);
console.log('courier semana         n  edad  real | A prior  B cadena  C ef.   D mix |  errA   errB   errC   errD');
for(const o of out.sort((a,b)=>a.courier.localeCompare(b.courier)||a.wk.localeCompare(b.wk)||a.t-b.t))
  console.log(`${o.courier.padEnd(7)}${o.wk} ${String(o.n).padStart(4)}  ${String(o.t).padStart(2)}d ${p(o.real)} | ${p(o.A)}   ${p(o.B)}   ${p(o.C)}  ${p(o.D)} | ${e(o.A,o.real)}  ${e(o.B,o.real)}  ${e(o.C,o.real)}  ${e(o.D,o.real)}`);
console.log('\n=== MAE / sesgo (puntos porcentuales) ===');
for(const cr of ['urbano','fixy'])for(const t of AGES){
  const s=out.filter(o=>o.courier===cr&&o.t===t); if(!s.length)continue;
  const f=(k,fn)=>{const v=s.filter(o=>o[k]!=null);return v.length?fn(v):null;};
  const mae=k=>f(k,v=>(v.reduce((a,o)=>a+Math.abs(o[k]-o.real),0)/v.length*100).toFixed(2));
  const bia=k=>f(k,v=>{const x=v.reduce((a,o)=>a+(o[k]-o.real),0)/v.length*100;return (x>=0?'+':'')+x.toFixed(2);});
  console.log(`${cr.padEnd(7)}${String(t).padStart(2)}d n=${String(s.length).padStart(2)} | MAE A=${String(mae('A')??'—').padStart(5)} B=${String(mae('B')??'—').padStart(5)} C=${String(mae('C')??'—').padStart(5)} D=${String(mae('D')??'—').padStart(5)} | sesgo A=${String(bia('A')??'—').padStart(6)} B=${String(bia('B')??'—').padStart(6)} C=${String(bia('C')??'—').padStart(6)} D=${String(bia('D')??'—').padStart(6)}`);
}
