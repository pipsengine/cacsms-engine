import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

const sqlPath = fileURLToPath(new URL("../database/bootstrap/market-data-postgres.sql", import.meta.url));
const sql = readFileSync(sqlPath, "utf8");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM market.market_data_providers) AS providers,
      (SELECT count(*)::int FROM infrastructure.broker_server_catalog) AS broker_servers
  `);
  console.log("Market data bootstrap complete:", rows[0]);
} catch (error) {
  console.error("Bootstrap failed:", error.message);
  process.exit(1);
} finally {
  await pool.end();
}
