import pg from "pg";
import { loadEnvFile } from "./load-env.mjs";

loadEnvFile();
const api = process.env.CACSMS_API_URL || "http://127.0.0.1:8080";
const balance = Number(process.argv[2] || 10000);
const equity = Number(process.argv[3] || 10050);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(
  `SELECT token FROM infrastructure.mt5_registration_tokens
   WHERE status IN ('PENDING','USED') AND expires_at > now()
   ORDER BY created_at DESC LIMIT 1`
);
await pool.end();

if (!rows[0]?.token) {
  console.error("No active registration token found. Register terminal in Market Data first.");
  process.exit(1);
}

const body = {
  token: rows[0].token,
  eaVersion: "1.0.2-test",
  latencyMs: 12,
  account: {
    balance,
    equity,
    margin: 0,
    freeMargin: equity,
    floatingPL: equity - balance,
    currency: "USD",
    leverage: 500,
    source: "manual-sync"
  },
  openPositions: [],
  ticks: []
};

const response = await fetch(`${api}/api/mt5/terminals/heartbeat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});
const payload = await response.json().catch(() => ({}));
console.log("HTTP", response.status, payload);
if (!response.ok) process.exit(1);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const check = await client.query(
  `SELECT account_snapshot, (SELECT balance FROM market.trading_accounts WHERE terminal_id = $1) AS ledger_balance
   FROM infrastructure.mt5_terminals WHERE id = $2`,
  [payload.terminalId, payload.terminalId]
);
console.log("DB after heartbeat:", JSON.stringify(check.rows[0], null, 2));
await client.end();
