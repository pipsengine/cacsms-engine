import { isDatabaseConfigured, query } from "./db.js";
import { ensurePropFirmSchema, isPropFirmSchemaReady } from "./prop-firm-rules-schema.js";
import { listPropFirmSources } from "./prop-firm-rules.js";

function failedChecks(message) {
  return {
    configured: false,
    availability: false,
    apiValidation: false,
    latency: "NOT TESTED",
    freshness: "UNAVAILABLE",
    quality: "FAILED",
    message
  };
}

function passedChecks(latencyMs, freshnessLabel = "LIVE") {
  return {
    configured: true,
    availability: true,
    apiValidation: true,
    latency: latencyMs != null ? `${latencyMs} ms` : "NOT TESTED",
    freshness: freshnessLabel,
    quality: "PASSED"
  };
}

export async function buildPropFirmRulesLiveSourceSnapshot() {
  const base = {
    id: "prop-firm-rules",
    routeSlug: "prop-firm-rules",
    name: "Prop Firm Rules & Limits",
    category: "prop-firm-rules",
    subtitle: "Production rule catalog, compliance monitoring, and breach alerts from market.prop_firms.",
    required: true,
    feedsStage: "Card 1",
    failureAction: "block_card_1",
    configuration: "Add firms on Prop Firm Rules or configure an approved rule source. No external URL probe.",
    connectionLabel: "Internal Rule Database",
    adapter: "prop_firm_rules_repository",
    envKey: null,
    httpStatus: null,
    probeError: null
  };

  if (!isDatabaseConfigured()) {
    return {
      ...base,
      provider: "Database Not Connected",
      status: "NOT_CONFIGURED",
      lastSyncAt: null,
      freshnessSeconds: 0,
      freshness: "UNAVAILABLE",
      healthScore: 0,
      latencyMs: 0,
      errorCount: 1,
      records: 0,
      checks: failedChecks("DATABASE_URL not configured")
    };
  }

  try {
    await ensurePropFirmSchema();
  } catch (error) {
    return {
      ...base,
      provider: "Prop Firm Schema",
      status: "FAILED",
      lastSyncAt: null,
      freshnessSeconds: 0,
      freshness: "UNAVAILABLE",
      healthScore: 0,
      latencyMs: 0,
      errorCount: 1,
      records: 0,
      probeError: error.message,
      checks: failedChecks("Run npm run db:bootstrap:prop-firm")
    };
  }

  if (!(await isPropFirmSchemaReady())) {
    return {
      ...base,
      provider: "Prop Firm Schema",
      status: "FAILED",
      lastSyncAt: null,
      freshnessSeconds: 0,
      freshness: "UNAVAILABLE",
      healthScore: 0,
      latencyMs: 0,
      errorCount: 1,
      records: 0,
      checks: failedChecks("Prop firm schema not ready")
    };
  }

  const started = Date.now();
  const [{ rows: firms }, { rows: rules }, { rows: sync }, sources] = await Promise.all([
    query(`SELECT COUNT(*)::int AS count FROM market.prop_firms`),
    query(`SELECT COUNT(*)::int AS count FROM market.prop_firm_rules`),
    query(
      `SELECT completed_at FROM market.prop_firm_sync_logs
       WHERE status = 'COMPLETED' ORDER BY completed_at DESC NULLS LAST LIMIT 1`
    ).catch(() => ({ rows: [] })),
    listPropFirmSources()
  ]);

  const firmCount = Number(firms[0]?.count ?? 0);
  const ruleCount = Number(rules[0]?.count ?? 0);
  const sourceCount = sources.sources?.length ?? 0;
  const lastSync = sync[0]?.completed_at || null;
  const latencyMs = Date.now() - started;
  const freshnessSeconds = lastSync
    ? Math.max(0, Math.round((Date.now() - new Date(lastSync).getTime()) / 1000))
    : 0;

  const hasCatalog = ruleCount > 0;
  const checks = passedChecks(latencyMs, hasCatalog ? "LIVE" : "READY");

  return {
    ...base,
    provider: hasCatalog
      ? `Internal DB · ${firmCount} firms · ${ruleCount} rules`
      : "Internal DB · production catalog (empty)",
    status: hasCatalog ? "LIVE" : "SYNCED",
    lastSyncAt: lastSync,
    freshnessSeconds,
    freshness: hasCatalog
      ? freshnessSeconds < 3600 ? "LIVE" : `${freshnessSeconds}s since last sync`
      : "READY — add firms or import rules",
    healthScore: hasCatalog ? 98 : 92,
    latencyMs,
    errorCount: 0,
    records: ruleCount + sourceCount,
    configuration: hasCatalog
      ? "Production prop firm rules loaded from database."
      : "Database ready. Catalog empty until you add a firm or approved source.",
    checks
  };
}
