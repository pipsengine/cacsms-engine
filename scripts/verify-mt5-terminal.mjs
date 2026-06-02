import pg from "pg";
import { loadEnvFile } from "./load-env.mjs";
import { discoverMt5TerminalPaths, ensureTerminalPathLinks } from "../packages/market-intelligence/src/ea-deployment.js";

loadEnvFile();

await ensureTerminalPathLinks();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const { rows: terminals } = await pool.query(`
  SELECT t.id, t.terminal_name, t.broker_name, t.server_name, t.environment, t.machine_id, m.name AS machine_name
  FROM infrastructure.mt5_terminals t
  LEFT JOIN infrastructure.machines m ON m.id = t.machine_id
  ORDER BY t.created_at DESC
`);

const { rows: paths } = await pool.query(`
  SELECT p.terminal_id, p.terminal_install_id, p.data_path, p.discovered_at, t.terminal_name
  FROM infrastructure.mt5_terminal_paths p
  LEFT JOIN infrastructure.mt5_terminals t ON t.id = p.terminal_id
  ORDER BY p.discovered_at DESC
`);

const discovered = discoverMt5TerminalPaths();

console.log(JSON.stringify({
  database: { terminals, paths },
  filesystem: { discovered },
  match: {
    terminalCount: terminals.length,
    pathCount: paths.length,
    discoveredCount: discovered.length,
    linked: paths.map((row) => ({
      terminalName: row.terminal_name,
      installId: row.terminal_install_id,
      dataPath: row.data_path,
      matchesFilesystem: discovered.some((item) => item.terminalInstallId === row.terminal_install_id)
    }))
  }
}, null, 2));

await pool.end();
