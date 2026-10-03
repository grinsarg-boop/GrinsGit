// gen.mjs — tira imágenes por fal directo. Uso: node gen.mjs jobs.json
// jobs.json = [{out, prompt, refs:[path], aspect_ratio}]  (máximo 3 por corrida: regla dura)
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.FAL_KEY;
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (jobs.length > 3) throw new Error('máximo 3 imágenes por vez');

const dataUri = p => 'data:image/jpeg;base64,' + readFileSync(p).toString('base64');

const run = async j => {
  const body = {
    prompt: j.prompt,
    image_urls: j.refs.map(dataUri),
    aspect_ratio: j.aspect_ratio || '1:1',
    resolution: '2K',
    num_images: 1,
    output_format: 'jpeg',
  };
  const r = await fetch('https://fal.run/fal-ai/nano-banana-pro/edit', {
    method: 'POST',
    headers: { Authorization: `Key ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) return console.log(`${j.out} ERROR ${r.status} ${t.slice(0, 300)}`);
  const url = JSON.parse(t).images?.[0]?.url;
  if (!url) return console.log(`${j.out} SIN IMAGEN ${t.slice(0, 300)}`);
  writeFileSync(j.out, Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log(`${j.out} OK`);
};

await Promise.all(jobs.map(run));
