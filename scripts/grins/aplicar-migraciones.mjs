// Aplica supabase/migrations/*.sql en orden sobre DATABASE_URL, una transacción por archivo,
// y registra las aplicadas en public._migraciones para poder re-correrlo sin repetir.
//   node --env-file=.env.local scripts/grins/aplicar-migraciones.mjs
import pg from "pg";
import { readdirSync, readFileSync } from "node:fs";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("create extension if not exists pg_cron"); // las migraciones 056+ usan cron.schedule
await c.query("create table if not exists public._migraciones (name text primary key, applied_at timestamptz default now())");
const done = new Set((await c.query("select name from public._migraciones")).rows.map((r) => r.name));

const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
let ok = 0;
for (const f of files) {
  if (done.has(f)) continue;
  const sql = readFileSync(`supabase/migrations/${f}`, "utf8");
  try {
    await c.query("begin");
    await c.query(sql);
    await c.query("insert into public._migraciones(name) values($1)", [f]);
    await c.query("commit");
    ok++;
  } catch (e) {
    await c.query("rollback");
    console.error(`✗ ${f}: ${e.message}`);
    await c.end();
    process.exit(1);
  }
}
const t = (await c.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n;
console.log(`✓ ${ok} migraciones aplicadas (${done.size} ya estaban) · ${t} tablas en public`);
await c.end();
