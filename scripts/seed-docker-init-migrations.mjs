#!/usr/bin/env node
import pg from "pg";
import { loadEnvFile } from "./load-env.mjs";

loadEnvFile();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const initMigrationFiles = [
  "001_foundation.sql",
  "002_level_1_architecture.sql",
  "003_operational_workflow_foundation.sql",
  "004_market_intelligence_data_sources.sql"
];

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int AS count FROM public.schema_migrations`);
  if (Number(countRows[0]?.count) > 0) {
    process.exit(0);
  }

  const { rows: marker } = await pool.query(`SELECT 1 FROM pg_type WHERE typname = 'run_status' LIMIT 1`);
  if (!marker.length) {
    process.exit(0);
  }

  for (const file of initMigrationFiles) {
    await pool.query(
      `INSERT INTO public.schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
      [file]
    );
    console.log(`[seed] marked ${file} as applied (postgres initdb)`);
  }
} finally {
  await pool.end();
}
