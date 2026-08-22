import pg from 'pg'; import { readFileSync } from 'node:fs';
const url=readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c=new pg.Client({connectionString:url,ssl:{rejectUnauthorized:false}}); await c.connect();
const q=async s=>(await c.query(s)).rows;
const dec=(await q(`select value from settings where key='delivery_decay'`))[0].value;
const prior=Object.fromEntries((await q(`select courier, p_delivery from delivery_priors where province is null and product_id is null`)).map(r=>[r.courier,Number(r.p_delivery)]));
const raw=await q(`
  select s.courier, s.dispatched_at::date disp, (current_date-s.dispatched_at) edad,
    (s.status_canonical='entregado') deliv,
    case when s.status_canonical in ('entregado','rehusado','en_devolucion','devuelto','siniestro')
         then greatest(coalesce(s.resolved_at,s.status_at)::date-s.dispatched_at,0) end er
  from shipments s where s.courier in ('urbano','fixy') and s.status_canonical<>'cancelado'
    and not (((s.courier='urbano' and s.status_raw='PI') or (s.courier='fixy' and (s.status_raw='41'
        or lower(coalesce(s.status_raw,'')) like '%pendiente de retiro%'))) and current_date-s.dispatched_at>7)
    and s.dispatched_at >= current_date-90`);
await c.end();
const T=30;
for(const cr of ['urbano','fixy']){
  const cl=raw.filter(r=>r.courier===cr&&r.edad>=21);
  if(cl.length<100){console.log(`\n${cr}: base cerrada insuficiente (${cl.length})`);continue;}
  const D=cl.filter(r=>r.deliv).length;
  const Gd=[],Re=[];
  for(let u=0;u<=T;u++){Gd[u]=cl.filter(r=>r.deliv&&r.er!==null&&r.er<=u).length/D;Re[u]=cl.filter(r=>r.er!==null&&r.er<=u).length/cl.length;}
  console.log(`\n### ${cr} · prior=${(prior[cr]*100).toFixed(1)}% · Gd(7)=${Gd[7].toFixed(3)} Gd(14)=${Gd[14].toFixed(3)}`);
  console.log('despacho     edad   n   entreg  resuelto |    B      C      D   |  k_crudo  k_banda');
  for(let t=7;t<=20;t++){
    const d0=new Date(); d0.setDate(d0.getDate()-t);
    const key=d0.toISOString().slice(0,10);
    const w=raw.filter(r=>r.courier===cr&&Math.abs(r.edad-t)<=3);
    if(w.length<60){continue;}
    const dd=w.filter(r=>r.deliv).length/w.length, rr=w.filter(r=>r.er!==null).length/w.length;
    if(Gd[t]<0.10)continue;
    const B=dd/Gd[t];
    let te=T; for(let u=0;u<=T;u++){if(Re[u]>=rr){te=u===0?0:u-1+(rr-Re[u-1])/((Re[u]-Re[u-1])||1);break;}}
    const lo=Math.floor(te),hi=Math.min(T,lo+1); const gde=Gd[lo]+(Gd[hi]-Gd[lo])*(te-lo);
    if(gde<0.10)continue;
    const C=dd/gde, Dp=(B+C)/2;
    const impl=(1-rr)*prior[cr]*Number(dec?.[cr]?.[Math.min(t,30)]??1);
    const kraw=impl<=0.001?1:Math.max(0,Math.min((Dp-dd)/impl,3));
    const wb=Math.max(0,1-Math.abs(B-C)/0.20);
    const k=1+wb*(kraw-1);
    console.log(`${key}   ${String(t).padStart(2)}d ${String(w.length).padStart(4)}  ${(dd*100).toFixed(1).padStart(5)}%  ${(rr*100).toFixed(1).padStart(5)}%  | ${(B*100).toFixed(1).padStart(5)} ${(C*100).toFixed(1).padStart(5)} ${(Dp*100).toFixed(1).padStart(5)} | ${kraw.toFixed(3).padStart(6)} ${k.toFixed(3).padStart(6)}`);
  }
}
