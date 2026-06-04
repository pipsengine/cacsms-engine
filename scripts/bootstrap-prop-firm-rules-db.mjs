#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { loadEnvFile } from "./load-env.mjs";

loadEnvFile();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required (.env or environment)");
  process.exit(1);
}

const files = [
  "database/migrations/013_prop_firm_rules.sql",
  "database/migrations/029_prop_firm_rules_production.sql"
];

function stripOptionalAuthGrants(sql) {
  return sql.replace(/INSERT INTO auth\.permissions[\s\S]*?ON CONFLICT DO NOTHING;\s*/gi, "").trim();
}

const client = new pg.Client({ connectionString: url });
await client.connect();
for (const file of files) {
  const sql = stripOptionalAuthGrants(readFileSync(path.join(root, file), "utf8"));
  await client.query(sql);
  console.log(`[bootstrap] applied ${file}`);
}
await client.end();
console.log("[bootstrap] prop firm rules schema ready");
