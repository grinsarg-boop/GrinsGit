// ponytail: modelo unit-economics por lead, todo en una función; assert al final.
const T={urb:51740,fixy:51775,cuo:51960}, C={urb:5063,fixy:5194,cuo:5150};
const dU=0.551, dF=(622*0.709+97*0.721)/719, comU=0.05547, comF=0.01, FU=10197, FF=8945, FC=9000;
const spend=24321311.63, spendReal=27275030.9, leads=5130;
const A={db:spendReal/leads, nom:spend/leads, flat:spend*1.364/leads};
const r=x=>Math.round(x);
// COD antes de pauta
const codU=dU*(T.urb-C.urb-comU*T.urb)-FU;
const codF=dF*(T.fixy-C.fixy-comF*T.fixy)-FF;
const mixU=1133/1275, codMix=mixU*codU+(1-mixU)*codF;
// cuotas: por pedido PAGADO. no entregado = reembolso total, fee perdido, COGS vuelve (SUPUESTO conservador)
const PC=(e,f)=>e*(T.cuo-C.cuo)-f*T.cuo-FC;
const out=[];
out.push(`A por lead: db ${r(A.db)} · nominal ${r(A.nom)} · x1,364 ${r(A.flat)}`);
out.push(`dF mix fixy ${(dF*100).toFixed(1)}%`);
out.push(`COD antes de pauta: Urbano ${r(codU)} · Fixy ${r(codF)} · mix cuotas (88,9/11,1) ${r(codMix)}`);
out.push(`COD neto (A db): Urbano ${r(codU-A.db)} · Fixy ${r(codF-A.db)} · mix ${r(codMix-A.db)}`);
for (const [e,f,lab] of [[0.9,0.1711,'e90 f17,1'],[0.8,0.1711,'e80 f17,1'],[1,0.1711,'e100 f17,1'],[0.9,0.2262,'e90 3cuotas 22,6'],[0.9,0.1175,'e90 1pago 11,75'],[0.8,0.2262,'e80 3cuotas'],[0.8,0.1175,'e80 1pago']]){
  const pc=PC(e,f), p=0.285;
  out.push(`${lab}: PC=${r(pc)} · lead p28,5%=${r(p*pc-A.db)} (antes pauta ${r(p*pc)}) · p* vs Urb ${(codU/pc*100).toFixed(1)}% · vs Fixy ${(codF/pc*100).toFixed(1)}% · vs mix ${(codMix/pc*100).toFixed(1)}%`);
}
out.push('--- Q3 Bricks bueno, 1.275 leads/mes, delta vs p=28,5%');
for (const e of [0.9,0.8]) for (const p of [0.40,0.50]) out.push(`e${e*100} p${p*100}: +${r((p-0.285)*PC(e,0.1711))}/lead = ${r((p-0.285)*PC(e,0.1711)*1275/1e6*100)/100} M/mes`);
out.push('--- Q5 cuotas -> COD (todos), delta/mes');
for (const e of [0.9,0.8]) out.push(`e${e*100}: COD mix ${r(codMix)} - cuotas ${r(0.285*PC(e,0.1711))} = ${r(codMix-0.285*PC(e,0.1711))}/lead = ${r((codMix-0.285*PC(e,0.1711))*1275/1e6*100)/100} M/mes`);
const rec=r(0.18*911); out.push(`variante 18% de 911 no pagados = ${rec} leads: hoy 0 antes pauta -> COD mix ${r(codMix)} = ${r(rec*codMix/1e6*100)/100} M/mes`);
out.push('--- Q6 sensibilidad por 10 pp (e90 f17,1 base), $/lead y M/mes');
out.push(`tasa pago +10pp: ${r(0.10*PC(0.9,0.1711))} · ${r(0.10*PC(0.9,0.1711)*1275/1e4)/100} M`);
out.push(`fee +10pp: ${r(-0.285*0.10*T.cuo)} · ${r(-0.285*0.10*T.cuo*1275/1e4)/100} M`);
out.push(`entrega prepago -10pp: ${r(-0.285*0.10*(T.cuo-C.cuo))} · ${r(-0.285*0.10*(T.cuo-C.cuo)*1275/1e4)/100} M`);
out.push(`fee mix todo 3 cuotas (+5,5pp): ${r(-0.285*0.0551*T.cuo*1275/1e4)/100} M · entrega 70% (-20pp): ${r(-0.285*0.20*(T.cuo-C.cuo)*1275/1e4)/100} M`);
// canal hoy /mes
out.push(`--- canal cuotas_3 hoy/mes (e90): ${r(1275*(0.285*PC(0.9,0.1711)-A.db)/1e4)/100} M · pauta del canal ${r(1275*A.db/1e4)/100} M`);
console.log(out.join('\n'));
console.assert(Math.abs(codU-13941)<50 && Math.abs(PC(0.9,0.1711)-24244)<50, 'formulas drift');
