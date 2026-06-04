import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDatabaseConfigured, query } from "./db.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const PORTFOLIO_MIGRATIONS = [
  "database/migrations/012_account_portfolio.sql",
  "database/migrations/027_portfolio_intelligence_center_expansion.sql",
  "database/migrations/028_portfolio_live_account_snapshot.sql"
];

let schemaReady = null;

export async function isPortfolioSchemaReady() {
  if (!isDatabaseConfigured()) return false;
  if (schemaReady === true) return true;
  try {
    const { rows } = await query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'market' AND table_name = 'trading_accounts'
       ) AS ok`
    );
    schemaReady = Boolean(rows[0]?.ok);
    return schemaReady;
  } catch {
    schemaReady = false;
    return false;
  }
}

export async function ensurePortfolioSchema() {
  if (!isDatabaseConfigured()) {
    return { ready: false, reason: "DATABASE_NOT_CONFIGURED" };
  }
  if (await isPortfolioSchemaReady()) {
    return { ready: true, applied: false };
  }

  const applied = [];
  for (const file of PORTFOLIO_MIGRATIONS) {
    let sql = readFileSync(join(repoRoot, file), "utf8").replace(
      /INSERT INTO auth\.permissions[\s\S]*?ON CONFLICT DO NOTHING;\s*/gi,
      ""
    ).trim();
    await query(sql);
    applied.push(file);
  }
  schemaReady = true;
  return { ready: true, applied };
}
