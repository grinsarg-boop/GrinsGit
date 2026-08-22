// ¿La tasa estimada de un día de VENTA sube, baja o se mantiene a medida que envejece?
// Modelo de dos etapas: P(entrega|generado, edad a) = δ(a) × p(a)
//   δ(a) = P(despacho | generado), condicionada a lo ya observado a la edad a
//   p(a) = P(entrega | despachado), con la maduración de la cohorte (B y C promediados)
import pg from 'pg'; import { readFileSync } from 'node:fs';
const url=readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c=new pg.Client({connectionString:url,ssl:{rejectUnauthorized:false}}); await c.connect();
const rows=(await c.query(`
  select o.created_at::date gen, (current_date - o.created_at::date) edad_gen,
         s.disp, s.deliv, s.er,
         case when s.disp is null then null else s.disp - o.created_at::date end lag
  from orders o
  left join lateral (
    select min(s2.dispatched_at) disp,
           bool_or(s2.status_canonical='entregado') deliv,
           min(case when s2.status_canonical in ('entregado','rehusado','en_devolucion','devuelto','siniestro')
                    then greatest(coalesce(s2.resolved_at,s2.status_at)::date - s2.dispatched_at,0) end) er
    from shipments s2 where s2.order_id=o.id and s2.status_canonical<>'cancelado') s on true
  where o.cancelled_at is null and o.courier in ('urbano','fixy')
    and lower(coalesce(o.tags,'')) not like '%cuotas_3%'
    and o.created_at::date between current_date-75 and current_date-1`)).rows;
await c.end();

const T=30;
const semOf=d=>{const x=new Date(d);const w=(x.getUTCDay()+6)%7;x.setUTCDate(x.getUTCDate()-w);return x.toISOString().slice(0,10);};
const cerradas=rows.filter(r=>r.edad_gen>=28);
const sem=new Map();
for(const r of cerradas){const k=semOf(r.gen);if(!sem.has(k))sem.set(k,[]);sem.get(k).push(r);}
const weeks=[...sem.keys()].sort();

const curvas=set=>{
  const Dd=set.filter(r=>r.deliv).length, Ld=set.filter(r=>r.disp).length;
  const Gdisp=[],Gd=[],Rex=[];
  for(let u=0;u<=T;u++){
    Gdisp[u]=Ld?set.filter(r=>r.lag!==null&&r.lag<=u).length/Ld:0;
    Gd[u]=Dd?set.filter(r=>r.deliv&&r.lag!==null&&r.lag+r.er<=u).length/Dd:0;
    Rex[u]=set.filter(r=>r.lag!==null&&r.er!==null&&r.lag+r.er<=u).length/set.length;
  }
  return {Gdisp,Gd,Rex,delta0:Ld/set.length,p0:Dd/Ld,fin:Dd/set.length};
};

const AGES=[0,2,3,5,7,10,14];
const acc=Object.fromEntries(AGES.map(a=>[a,[]]));
for(let i=3;i<weeks.length;i++){
  const target=sem.get(weeks[i]);
  const train=weeks.slice(0,i).flatMap(w=>sem.get(w));      // solo semanas ANTERIORES
  if(train.length<600||target.length<150)continue;
  const cu=curvas(train);
  const real=target.filter(r=>r.deliv).length/target.length;
  for(const a of AGES){
    const dispA=target.filter(r=>r.lag!==null&&r.lag<=a).length/target.length;
    const delA=target.filter(r=>r.deliv&&r.lag!==null&&r.lag+r.er<=a).length/target.length;
    const resA=target.filter(r=>r.lag!==null&&r.er!==null&&r.lag+r.er<=a).length/target.length;
    const dhat = cu.Gdisp[a]>0.05 ? Math.min(dispA/cu.Gdisp[a],1) : cu.delta0;
    let est;
    if(cu.Gd[a]>0.10 && dhat>0){
      const B=(delA/dhat)/cu.Gd[a];
      let te=T; for(let u=0;u<=T;u++){if(cu.Rex[u]>=resA){te=u;break;}}
      const gde=cu.Gd[Math.min(te,T)];
      const C= gde>0.10 ? (delA/dhat)/gde : B;
      est = dhat*((B+C)/2);
    } else { est = dhat*cu.p0; }
    acc[a].push({est,real,w:weeks[i],n:target.length});
  }
}
console.log('Deriva OUT-OF-SAMPLE del estimado de una semana de venta');
console.log('(curvas construidas SOLO con semanas anteriores a la evaluada)\n');
console.log('edad   semanas   estimado_prom   real_prom   sesgo    MAE');
for(const a of AGES){
  const v=acc[a]; if(!v.length)continue;
  const e=v.reduce((s,x)=>s+x.est,0)/v.length, r=v.reduce((s,x)=>s+x.real,0)/v.length;
  const mae=v.reduce((s,x)=>s+Math.abs(x.est-x.real),0)/v.length;
  console.log(`${String(a).padStart(3)}d   ${String(v.length).padStart(5)}    ${(e*100).toFixed(1).padStart(9)}%  ${(r*100).toFixed(1).padStart(9)}%  ${((e-r)*100>=0?'+':'')+((e-r)*100).toFixed(2).padStart(6)}  ${(mae*100).toFixed(2).padStart(5)}`);
}
console.log('\nPor semana, cómo evoluciona el estimado con la edad:');
const ws=[...new Set(acc[7].map(x=>x.w))];
console.log('semana        real  | ' + AGES.map(a=>String(a).padStart(5)+'d').join(''));
for(const w of ws){
  const row=AGES.map(a=>{const f=acc[a].find(x=>x.w===w);return f?(f.est*100).toFixed(1).padStart(6):'     -';}).join('');
  const rl=acc[7].find(x=>x.w===w).real;
  console.log(`${w}  ${(rl*100).toFixed(1).padStart(5)}% |${row}`);
}
