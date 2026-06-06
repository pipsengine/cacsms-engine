import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadEnvFile } from "./load-env.mjs";

loadEnvFile();

const migrationsDir = fileURLToPath(new URL("../database/migrations/", import.meta.url));
const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(`
  CREATE TABLE IF NOT EXISTS public.schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const { rows: applied } = await pool.query("SELECT filename FROM public.schema_migrations");
const done = new Set(applied.map((row) => row.filename));

for (const file of files) {
  if (done.has(file)) {
    console.log(`skip ${file}`);
    continue;
  }
  const content = readFileSync(join(migrationsDir, file), "utf8");
  process.stdout.write(`apply ${file}... `);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(content);
    await client.query("INSERT INTO public.schema_migrations (filename) VALUES ($1)", [file]);
    await client.query("COMMIT");
    console.log("ok");
  } catch (error) {
    const message = error.message || String(error);
    if (/already exists/i.test(message)) {
      await client.query("ROLLBACK");
      await client.query("INSERT INTO public.schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING", [file]);
      console.log("skip (already exists)");
      client.release();
      continue;
    }
    await client.query("ROLLBACK");
    console.log("failed");
    console.error(message);
    client.release();
    await pool.end();
    process.exit(1);
  }
  client.release();
}

await pool.end();
console.log("migrations complete");
