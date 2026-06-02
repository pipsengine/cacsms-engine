import pg from "pg";
import { loadEnvFile } from "./load-env.mjs";
import { deleteMarketDataProvider } from "../packages/market-intelligence/src/market-data-providers.js";

loadEnvFile();

function mt5Identity(row) {
  const mt5 = row.config?.mt5 || {};
  return [
    String(mt5.brokerName || row.name || "").trim().toLowerCase(),
    String(mt5.serverName || "").trim().toLowerCase(),
    String(row.environment || "").trim().toLowerCase()
  ].join("|");
}

function scoreProvider(row) {
  let score = 0;
  score += Number(row.terminals || 0) * 100;
  score += row.status === "ACTIVE" || row.status === "LIVE" ? 50 : 0;
  score += row.status === "PARTIALLY_CONFIGURED" ? 10 : 0;
  return score;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(`
  SELECT p.id, p.name, p.provider_code, p.environment, p.status, p.config, p.created_at,
         (SELECT count(*)::int FROM infrastructure.mt5_terminals t WHERE t.provider_id = p.id) AS terminals
  FROM market.market_data_providers p
  WHERE p.archived = false AND p.connection_method = 'MT5 Bridge'
  ORDER BY p.created_at ASC
`);
await pool.end();

const groups = new Map();
for (const row of rows) {
  const key = mt5Identity(row);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}

const archived = [];
const kept = [];

for (const [key, providers] of groups) {
  if (providers.length <= 1) {
    kept.push(providers[0]);
    continue;
  }
  const sorted = [...providers].sort((a, b) => scoreProvider(b) - scoreProvider(a) || new Date(b.created_at) - new Date(a.created_at));
  kept.push(sorted[0]);
  for (const provider of sorted.slice(1)) {
    await deleteMarketDataProvider(provider.id);
    archived.push({ id: provider.id, name: provider.name, providerCode: provider.provider_code, group: key });
  }
}

console.log(JSON.stringify({
  kept: kept.map((row) => ({ id: row.id, name: row.name, providerCode: row.provider_code })),
  archived,
  remainingCount: kept.length
}, null, 2));
