// ponytail: psql-lite temporal. SQL por stdin -> JSON.
import pg from 'pg';
import { readFileSync } from 'node:fs';
const url = readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: url, ssl:{rejectUnauthorized:false} });
await c.connect();
const r = await c.query(readFileSync(0,'utf8'));
console.log(JSON.stringify(Array.isArray(r)?r.map(x=>x.rows):r.rows, null, 1));
await c.end();
