// Proyección de cohortes VIVAS: cada día de despacho se proyecta a SU propia edad
// y se agrega ponderando por guías. Curvas medidas solo sobre cohortes cerradas (>=21d).
import pg from 'pg';
import { readFileSync } from 'node:fs';
const url=readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c=new pg.Client({connectionString:url,ssl:{rejectUnauthorized:false}}); await c.connect();
const {rows}=await c.query(`
  select s.courier, to_char(s.dispatched_at,'YYYY-MM-DD') disp, (current_date-s.dispatched_at) edad,
         (s.status_canonical='entregado') deliv,
         case when s.status_canonical in ('entregado','rehusado','en_devolucion','devuelto','siniestro')
              then greatest(coalesce(s.resolved_at,s.status_at)::date-s.dispatched_at,0) end er
  from shipments s where s.courier in ('urbano','fixy') and s.status_canonical<>'cancelado'
    and s.dispatched_at >= date '2026-05-15'`);
await c.end();
const MAXT=30, MINAGE=4;
const dAt=(g,t)=>g.filter(x=>x.deliv&&x.er!==null&&x.er<=t).length/g.length;
const rAt=(g,t)=>g.filter(x=>x.er!==null&&x.er<=t).length/g.length;
const Dfin=g=>g.filter(x=>x.deliv).length/g.length;

for(const cr of ['urbano','fixy']){
  const all=rows.filter(r=>r.courier===cr);
  const cerr=all.filter(r=>r.edad>=21 && !(cr==='fixy'&&r.disp<'2026-06-29'));
  if(cerr.length<300){console.log(`\n### ${cr.toUpperCase()}: muestra cerrada insuficiente`);continue;}
  const Gd=[],Rexp=[]; const Dc=Dfin(cerr);
  for(let u=0;u<=MAXT;u++){Gd[u]=dAt(cerr,u)/Dc;Rexp[u]=rAt(cerr,u);}
  const gd=x=>{const lo=Math.floor(x),hi=Math.min(MAXT,lo+1);return Gd[lo]+(Gd[hi]-Gd[lo])*(x-lo);};
  console.log(`\n### ${cr.toUpperCase()} — curvas sobre ${cerr.length} guías cerradas · prior (tasa de esa base) = ${(Dc*100).toFixed(1)}%`);
  console.log('semana de despacho    n   |  entregado hoy   B cadena   C ef.    D mix');
  const sem=new Map();
  for(const r of all.filter(r=>r.edad<21&&r.edad>=MINAGE)){
    const x=new Date(r.disp+'T00:00:00Z'); const w=(x.getUTCDay()+6)%7; x.setUTCDate(x.getUTCDate()-w);
    const k=x.toISOString().slice(0,10); if(!sem.has(k))sem.set(k,[]); sem.get(k).push(r);
  }
  for(const [k,gs] of [...sem].sort()){
    const byDay=new Map(); for(const r of gs){if(!byDay.has(r.disp))byDay.set(r.disp,[]);byDay.get(r.disp).push(r);}
    let nB=0,nC=0,N=0,ent=0;
    for(const [,g] of byDay){
      const t=Math.min(g[0].edad,MAXT), d=dAt(g,t), robs=rAt(g,t);
      let te=MAXT; for(let u=0;u<=MAXT;u++){if(Rexp[u]>=robs){te=u===0?0:u-1+(robs-Rexp[u-1])/((Rexp[u]-Rexp[u-1])||1);break;}}
      if(Gd[t]>0.02) nB+=(d/Gd[t])*g.length; else nB+=Dc*g.length;
      if(gd(te)>0.02)  nC+=(d/gd(te))*g.length; else nC+=Dc*g.length;
      N+=g.length; ent+=g.filter(x=>x.deliv).length;
    }
    if(N<50)continue;
    const B=nB/N,C=nC/N;
    console.log(`${k}  ${String(N).padStart(5)}   |    ${(ent/N*100).toFixed(1).padStart(5)}%      ${(B*100).toFixed(1).padStart(5)}%   ${(C*100).toFixed(1).padStart(5)}%   ${((B+C)/2*100).toFixed(1).padStart(5)}%`);
  }
}
