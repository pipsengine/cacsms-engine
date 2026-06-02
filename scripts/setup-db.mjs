import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { getDatabaseConfig, loadEnvFile } from "./load-env.mjs";

loadEnvFile();

const sqlPath = fileURLToPath(new URL("../database/setup-local-postgres.sql", import.meta.url));
const setupSql = readFileSync(sqlPath, "utf8");
const adminUrl = process.env.POSTGRES_ADMIN_URL || process.env.DATABASE_ADMIN_URL || "";

if (!adminUrl) {
  console.error("POSTGRES_ADMIN_URL is not set.");
  console.error("Example:");
  console.error('  $env:POSTGRES_ADMIN_URL="postgres://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/postgres"');
  console.error("  npm run db:setup");
  console.error("");
  console.error("Or run this file manually as a PostgreSQL superuser:");
  console.error(`  ${sqlPath}`);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: adminUrl });
try {
  await pool.query(setupSql);

  const { rows } = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", ["db_cacsms-engine"]);
  if (!rows.length) {
    await pool.query('CREATE DATABASE "db_cacsms-engine" OWNER cacsms');
  }

  await pool.query('GRANT ALL PRIVILEGES ON DATABASE "db_cacsms-engine" TO cacsms');
  console.log("PostgreSQL role and database ready:");
  console.log(JSON.stringify(getDatabaseConfig(), null, 2));
  console.log("Next: npm run db:migrate");
} catch (error) {
  console.error("Database setup failed:", error.message);
  process.exit(1);
} finally {
  await pool.end();
}
