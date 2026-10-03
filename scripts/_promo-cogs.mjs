import { sql } from './_ml.mjs';
console.table(await sql(`select p.name, pc.pack, pc.unit_cost, pc.is_estimated from product_costs pc join products p on p.id=pc.product_id where p.name in ('Pureza') order by pc.pack`));
console.table(await sql(`select table_name from information_schema.tables where table_name like 'ml_ad%'`));
