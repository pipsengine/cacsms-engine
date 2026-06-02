import pg from "pg";
import { getDatabaseConfig, loadEnvFile } from "./load-env.mjs";
import { testDatabaseConnection } from "../packages/market-intelligence/src/db.js";

loadEnvFile();

const config = getDatabaseConfig();
const connection = await testDatabaseConnection();

if (!connection.configured) {
  console.error("DATABASE_URL is not configured.");
  console.error("Copy .env.example to .env and set postgres://cacsms:Adm1n.c0m@localhost:5432/db_cacsms-engine");
  process.exit(1);
}

if (!connection.connected) {
  console.error(JSON.stringify({ config, connection }, null, 2));
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const { rows: schemas } = await pool.query(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('market','infrastructure') ORDER BY 1"
  );
  const { rows: tables } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'market' AND table_name LIKE 'market_data%' ORDER BY 1"
  );
  const { rows: catalog } = await pool.query(
    "SELECT count(*)::int AS count FROM infrastructure.broker_server_catalog WHERE broker_name = 'IC Markets'"
  ).catch(() => ({ rows: [{ count: null }] }));
  const { rows: migrations } = await pool.query(
    "SELECT count(*)::int AS count FROM public.schema_migrations"
  ).catch(() => ({ rows: [{ count: 0 }] }));

  console.log(JSON.stringify({
    connection,
    config,
    schemas: schemas.map((row) => row.schema_name),
    marketDataTables: tables.map((row) => row.table_name),
    icMarketsServers: catalog[0]?.count ?? "catalog_missing",
    appliedMigrations: migrations[0]?.count ?? 0
  }, null, 2));
} finally {
  await pool.end();
}
