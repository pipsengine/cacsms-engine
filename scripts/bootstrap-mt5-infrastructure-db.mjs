import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadEnvFile } from "./load-env.mjs";

loadEnvFile();

const sqlPath = fileURLToPath(new URL("../database/bootstrap/mt5-infrastructure-postgres.sql", import.meta.url));
const sql = readFileSync(sqlPath, "utf8");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM infrastructure.machines) AS machines,
      (SELECT count(*)::int FROM infrastructure.mt5_terminals) AS terminals,
      (SELECT count(*)::int FROM infrastructure.mt5_registration_tokens) AS tokens
  `);
  console.log("MT5 infrastructure bootstrap complete:", rows[0]);
} catch (error) {
  console.error("Bootstrap failed:", error.message);
  process.exit(1);
} finally {
  await pool.end();
}
