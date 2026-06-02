import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadEnvFile } from "./load-env.mjs";

loadEnvFile();

const sqlPath = fileURLToPath(new URL("../database/bootstrap/ea-deployment-postgres.sql", import.meta.url));
const sql = readFileSync(sqlPath, "utf8");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  const { ensureEaVersionCatalog } = await import("../packages/market-intelligence/src/ea-deployment.js");
  await ensureEaVersionCatalog();
  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM infrastructure.ea_versions) AS versions,
      (SELECT count(*)::int FROM infrastructure.ea_deployments) AS deployments,
      (SELECT count(*)::int FROM infrastructure.mt5_terminal_paths) AS terminal_paths
  `);
  console.log("EA deployment bootstrap complete:", rows[0]);
} catch (error) {
  console.error("Bootstrap failed:", error.message);
  process.exit(1);
} finally {
  await pool.end();
}
