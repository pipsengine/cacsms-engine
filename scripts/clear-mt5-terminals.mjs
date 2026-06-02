import pg from "pg";
import { loadEnvFile } from "./load-env.mjs";

loadEnvFile();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const { rows: before } = await pool.query("SELECT count(*)::int AS count FROM infrastructure.mt5_terminals");
  await pool.query("DELETE FROM infrastructure.mt5_terminals");
  const { rows: after } = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM infrastructure.mt5_terminals) AS terminals,
      (SELECT count(*)::int FROM infrastructure.mt5_terminal_paths) AS paths,
      (SELECT count(*)::int FROM infrastructure.mt5_registration_tokens) AS tokens,
      (SELECT count(*)::int FROM infrastructure.ea_deployments) AS deployments
  `);
  console.log(JSON.stringify({ removed: before[0].count, remaining: after[0] }, null, 2));
} catch (error) {
  console.error("Failed to clear terminals:", error.message);
  process.exit(1);
} finally {
  await pool.end();
}
