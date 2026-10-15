// Registra los 4 webhooks de Shopify que consume app/api/webhooks/shopify/route.ts.
// Uso: node --env-file=.env.local scripts/grins/registrar-webhooks.mjs https://<dominio>
// Idempotente: no crea los que ya existen con la misma address + topic. No borra nada.
// Shopify firma los webhooks creados por API con el client secret de la app → SHOPIFY_WEBHOOK_SECRET
// tiene que valer lo mismo que SHOPIFY_CLIENT_SECRET.

const API_VERSION = "2024-10";
const TOPICS = ["orders/create", "orders/updated", "orders/cancelled", "fulfillments/create"];

const base = process.argv[2]?.replace(/\/+$/, "");
if (!/^https:\/\/[^/]+$/.test(base ?? "")) {
  console.error("uso: node --env-file=.env.local scripts/grins/registrar-webhooks.mjs https://<dominio>");
  process.exit(1);
}
const { SHOPIFY_SHOP_DOMAIN: shop, SHOPIFY_CLIENT_ID: id, SHOPIFY_CLIENT_SECRET: secret } = process.env;
if (!shop || !id || !secret) {
  console.error("faltan SHOPIFY_SHOP_DOMAIN / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET en el env");
  process.exit(1);
}
const address = `${base}/api/webhooks/shopify`;

const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
});
if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}: ${await tokenRes.text()}`);
const { access_token } = await tokenRes.json();

const api = async (path, init = {}) => {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/${path}`, {
    ...init,
    headers: { "X-Shopify-Access-Token": access_token, "content-type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} ${res.status}: ${await res.text()}`);
  return res.json();
};

// ponytail: una página de 250 alcanza; una tienda no tiene más webhooks que eso.
const { webhooks: existentes } = await api("webhooks.json?limit=250");
const yaHay = (topic) => existentes.find((w) => w.topic === topic && w.address === address);

for (const topic of TOPICS) {
  const previo = yaHay(topic);
  if (previo) {
    console.log(`= ${topic.padEnd(20)} ya existía (id ${previo.id})`);
    continue;
  }
  const { webhook } = await api("webhooks.json", {
    method: "POST",
    body: JSON.stringify({ webhook: { topic, address, format: "json" } }),
  });
  console.log(`+ ${topic.padEnd(20)} creado (id ${webhook.id})`);
}

const otros = existentes.filter((w) => w.address !== address);
if (otros.length) {
  console.log(`\n${otros.length} webhook(s) apuntan a otra address (no se tocan):`);
  for (const w of otros) console.log(`  ${w.topic.padEnd(20)} → ${w.address}`);
}
