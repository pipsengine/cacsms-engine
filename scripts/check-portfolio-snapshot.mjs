import pg from "pg";
import { loadEnvFile } from "./load-env.mjs";

loadEnvFile();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(`
  SELECT t.id, t.terminal_name, t.connection_status, t.last_heartbeat_at, t.account_snapshot,
         ta.balance, ta.equity, ta.last_sync_at
  FROM infrastructure.mt5_terminals t
  LEFT JOIN market.trading_accounts ta ON ta.terminal_id = t.id
  ORDER BY t.updated_at DESC
  LIMIT 5
`);
console.log(JSON.stringify(rows, null, 2));
await client.end();
