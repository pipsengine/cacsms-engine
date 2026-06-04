import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDatabaseConfigured, query } from "./db.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const PROP_FIRM_MIGRATIONS = [
  "database/migrations/013_prop_firm_rules.sql",
  "database/migrations/029_prop_firm_rules_production.sql"
];

let schemaReady = null;

export async function isPropFirmSchemaReady() {
  if (!isDatabaseConfigured()) return false;
  if (schemaReady === true) return true;
  try {
    const { rows } = await query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'market' AND table_name = 'prop_firms'
       ) AS ok`
    );
    schemaReady = Boolean(rows[0]?.ok);
    return schemaReady;
  } catch {
    schemaReady = false;
    return false;
  }
}

export async function ensurePropFirmSchema() {
  if (!isDatabaseConfigured()) {
    return { ready: false, reason: "DATABASE_NOT_CONFIGURED" };
  }
  if (await isPropFirmSchemaReady()) {
    return { ready: true, applied: false };
  }

  const applied = [];
  for (const file of PROP_FIRM_MIGRATIONS) {
    const sql = readFileSync(join(repoRoot, file), "utf8")
      .replace(/INSERT INTO auth\.permissions[\s\S]*?ON CONFLICT DO NOTHING;\s*/gi, "")
      .trim();
    await query(sql);
    applied.push(file);
  }
  schemaReady = true;
  return { ready: true, applied };
}
