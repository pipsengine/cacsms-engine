import pg from "pg";
import { loadEnvFile } from "./load-env.mjs";

loadEnvFile();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(`
  SELECT t.terminal_name, t.connection_status, t.last_heartbeat_at, t.account_snapshot,
         ec.ea_version, ec.last_heartbeat_at AS ea_last
  FROM infrastructure.mt5_terminals t
  LEFT JOIN infrastructure.ea_connections ec ON ec.terminal_id = t.id
  ORDER BY t.updated_at DESC
  LIMIT 3
`);
console.log(JSON.stringify(rows, null, 2));
await client.end();
