import { isDatabaseConfigured, query, withTransaction } from "./db.js";

export const SOURCE_HEALTH_REVIEW_TABLES = Object.freeze([
  "market.source_registry",
  "market.source_health_metrics",
  "market.source_sync_logs",
  "market.source_validation_logs",
  "market.source_alerts",
  "market.source_provider_health",
  "market.source_dependencies",
  "market.source_rate_limits",
  "market.source_credentials",
  "market.source_health_reviews",
  "market.source_health_recommendations",
  "market.source_audit_logs"
]);

const MODULES = Object.freeze([
  "Market Data",
  "Historical Data",
  "Broker Data",
  "Portfolio Data",
  "News Sentiment",
  "Economic Calendar",
  "Social Sentiment",
  "COT Reports",
  "Prop Firm Rules",
  "AI Intelligence",
  "System Internal"
]);

const STATUS_OK = new Set(["LIVE", "SYNCED"]);
const STATUS_WARN = new Set(["PAUSED", "DEGRADED", "RATE_LIMITED"]);
const STATUS_BAD = new Set(["FAILED", "OFFLINE", "AUTH_FAILED"]);
const n = value => value === null || value === undefined ? null : Number(value);
const pct = value => value === null || value === undefined ? null : Math.round(Number(value));
const latest = rows => rows[0] || null;
const LIVE_ID_MAP = Object.freeze({
  "market-data": "market-data",
  "news-sentiment": "news-sentiment",
  "economic-calendar": "economic-calendar",
  "social-sentiment": "social-sentiment",
  "institutional-cot": "institutional-cot-data",
  "historical-data": "historical-data",
  "broker-data": "broker-data",
  "account-portfolio": "account-portfolio-data",
  "prop-firm-rules": "prop-firm-rules"
});
const DEPENDENCY_MAP = Object.freeze({
  "market-data": [["Market Environment Intelligence", "Market Intelligence / Asset Scanner", "Pricing and spread context unavailable", "CRITICAL"]],
  "news-sentiment": [["Sentiment Intelligence", "News Sentiment / Market Alerts", "Headline sentiment and alert context degraded", "HIGH"]],
  "economic-calendar": [["Macro Intelligence", "Economic Calendar / Risk Restrictions", "Macro-event risk context degraded", "HIGH"]],
  "social-sentiment": [["Sentiment Intelligence", "Social Sentiment / Sentiment Heatmap", "Community sentiment confidence reduced", "MEDIUM"]],
  "institutional-cot": [["Institutional Intelligence", "Institutional COT", "Positioning bias stale or unavailable", "MEDIUM"]],
  "historical-data": [["Market Environment Intelligence", "Historical Data / Asset Ranking", "Backtest and comparison context degraded", "HIGH"]],
  "broker-data": [["Liquidity Intelligence", "Broker Data / Execution Center", "Liquidity and execution readiness degraded", "CRITICAL"]],
  "account-portfolio": [["Portfolio Intelligence", "Account Portfolio / Risk Validation", "Exposure and margin context degraded", "CRITICAL"]],
  "prop-firm-rules": [["Risk Validation", "Prop Firm Rules / Compliance", "Prop account compliance validation degraded", "CRITICAL"]]
});

function emptyState(status, message, missingTables = []) {
  return {
    sourceMode: "DATABASE_ONLY",
    status,
    message,
    schemaReady: false,
    missingTables,
    permissions: permissions(),
    header: {
      title: "Source Health Review Center",
      subtitle: "Review live provider health, synchronization performance, API reliability, latency, data quality, and operational risks across all market intelligence sources."
    },
    badges: { productionLive: true, mockDataDisabled: true, liveProvidersOnly: true, lastHealthCheck: null, systemHealthScore: null },
    summary: [],
    filters: filterOptions([]),
    sources: [],
    freshness: [],
    failures: [],
    reliability: emptyReliability(),
    quality: { metrics: [], rows: [] },
    dependencies: [],
    rateLimits: [],
    security: [],
    recommendations: [],
    audit: []
  };
}

function permissions() {
  return {
    view: "market_intelligence.source_health_review.view",
    runCheck: "market_intelligence.source_health_review.run_check",
    sync: "market_intelligence.source_health_review.sync",
    export: "market_intelligence.source_health_review.export",
    acknowledge: "market_intelligence.source_health_review.acknowledge",
    disableSource: "market_intelligence.source_health_review.disable_source",
    viewSecurity: "market_intelligence.source_health_review.view_security"
  };
}

async function tableReadiness() {
  const { rows } = await query(
    "SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name",
    [SOURCE_HEALTH_REVIEW_TABLES]
  );
  return {
    ready: rows.every(row => row.exists),
    missing: rows.filter(row => !row.exists).map(row => row.table_name)
  };
}

function scoreFrom(row) {
  if (row.enabled === false || row.status === "NOT_CONFIGURED") return null;
  const storedHealthScore = row.health_score ?? row.healthScore;
  if (storedHealthScore !== null && storedHealthScore !== undefined) return pct(storedHealthScore);
  const parts = [
    n(row.availability_pct ?? row.availabilityPct),
    n(row.success_rate_pct ?? row.successRatePct),
    (row.latency_ms ?? row.latencyMs) === null || (row.latency_ms ?? row.latencyMs) === undefined ? null : Math.max(0, 100 - Math.min(100, Number(row.latency_ms ?? row.latencyMs) / 30)),
    ["FRESH", "LIVE", "CURRENT"].includes(String((row.freshness_status ?? row.freshnessStatus) || "").toUpperCase()) ? 100 : ["NEAR_STALE", "WARNING"].includes(String((row.freshness_status ?? row.freshnessStatus) || "").toUpperCase()) ? 75 : null,
    n(row.validation_pass_rate_pct ?? row.validationPassRatePct),
    row.open_alerts ? Math.max(0, 100 - row.open_alerts * 20) : 100,
    ["NORMAL", "UNKNOWN", ""].includes(String((row.rate_limit_status ?? row.rateLimit) || "").toUpperCase()) ? 100 : String((row.rate_limit_status ?? row.rateLimit) || "").toUpperCase() === "WARNING" ? 75 : 35,
    ["VALID", "NONE", "UNKNOWN", ""].includes(String((row.authentication_status ?? row.authentication) || "").toUpperCase()) ? 100 : 0
  ].filter(value => value !== null && Number.isFinite(Number(value)));
  return parts.length ? Math.round(parts.reduce((sum, value) => sum + Number(value), 0) / parts.length) : null;
}

function healthFrom(row) {
  if (!row.enabled || row.status === "NOT_CONFIGURED") return "UNCONFIGURED";
  const status = String(row.status || "").toUpperCase();
  if (status === "AUTH_FAILED" || status === "OFFLINE" || status === "FAILED") return "CRITICAL";
  const score = scoreFrom(row);
  if (score === null) return "UNKNOWN";
  if (score >= 90) return "HEALTHY";
  if (score >= 70) return "WARNING";
  return "CRITICAL";
}

function recommendedAction(row) {
  const status = String(row.status || "").toUpperCase();
  if (status === "AUTH_FAILED") return "Rotate or repair credentials, then run a provider health check.";
  if (status === "RATE_LIMITED") return "Reduce polling frequency or upgrade provider plan.";
  if (status === "FAILED" || status === "OFFLINE") return "Inspect sync errors and run Sync Now after provider recovery.";
  if (["STALE", "EXPIRED", "NEVER_SYNCED"].includes(String(row.freshness_status || "").toUpperCase())) return "Run source sync and verify expected refresh interval.";
  if (Number(row.latency_ms || 0) > 2000) return "Review provider latency and network route.";
  return "Continue monitoring.";
}

function liveForProvider(provider, snapshots = []) {
  const liveId = LIVE_ID_MAP[provider.sourceKey] || provider.sourceKey;
  return snapshots.find(source => source.id === liveId || source.routeSlug === provider.sourceKey) || null;
}

function healthLabelForScore(score, status) {
  if (status === "NOT_CONFIGURED") return "UNCONFIGURED";
  if (score === null || score === undefined) return "UNKNOWN";
  if (score >= 90) return "HEALTHY";
  if (score >= 70) return "WARNING";
  return "CRITICAL";
}

function freshnessStatus(live) {
  const value = String(live?.freshness || "").toUpperCase();
  if (!live?.lastSyncAt) return "NEVER_SYNCED";
  if (value.includes("LIVE") || value.includes("REAL-TIME") || value.includes("SYNCED")) return "FRESH";
  if (value.includes("ARCHIVED")) return "NEAR_STALE";
  if (value.includes("STALE")) return "STALE";
  return "FRESH";
}

function credentialStatus(provider) {
  if (provider.authenticationType === "none") return "VALID";
  if (!provider.credentialRef) return "MISSING";
  return "VALID";
}

function summaryCards(rows, failures, qualityRows, rateLimits, security) {
  const total = rows.length;
  const scoreRows = rows.map(scoreFrom).filter(value => value !== null);
  const avg = values => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value), 0) / values.length) : null;
  const latencyValues = rows.map(row => n(row.latency_ms ?? row.latencyMs)).filter(value => value !== null);
  const qualityValues = qualityRows.map(row => n(row.validation_pass_rate_pct ?? row.validationPassRatePct ?? row.data_completeness_pct ?? row.dataCompletenessPct)).filter(value => value !== null);
  const sourceQualityValues = rows.map(row => n(row.quality_score ?? row.qualityScore ?? row.healthScore)).filter(value => value !== null);
  return [
    ["Total Sources", total, "info"],
    ["Healthy Sources", rows.filter(row => row.health === "HEALTHY").length, "ok"],
    ["Warning Sources", rows.filter(row => row.health === "WARNING").length, "warn"],
    ["Critical Sources", rows.filter(row => row.health === "CRITICAL").length, "bad"],
    ["Offline Sources", rows.filter(row => ["OFFLINE", "FAILED"].includes(row.status)).length, "bad"],
    ["Stale Sources", rows.filter(row => ["STALE", "EXPIRED", "NEVER_SYNCED"].includes(row.freshness_status)).length, "warn"],
    ["Failed Syncs Today", failures.length, failures.length ? "bad" : "ok"],
    ["Average Latency", latencyValues.length ? `${avg(latencyValues)} ms` : null, "info"],
    ["Data Quality Score", avg(qualityValues.length ? qualityValues : sourceQualityValues), "quality"],
    ["Rate Limit Warnings", rateLimits.filter(row => ["WARNING", "CRITICAL", "EXCEEDED"].includes(row.status)).length, "warn"],
    ["Authentication Failures", security.filter(row => ["INVALID", "EXPIRED", "MISSING"].includes(row.credentialStatus)).length, "bad"],
    ["System Health Score", avg(scoreRows), "quality"]
  ];
}

function filterOptions(rows) {
  const unique = key => [...new Set(rows.map(row => row[key]).filter(Boolean))].sort();
  return {
    modules: MODULES,
    sourceCategories: unique("category"),
    providers: unique("provider"),
    statuses: ["LIVE", "SYNCED", "PAUSED", "NOT_CONFIGURED", "DEGRADED", "FAILED", "OFFLINE", "RATE_LIMITED", "AUTH_FAILED"],
    health: ["HEALTHY", "WARNING", "CRITICAL", "UNKNOWN", "UNCONFIGURED"],
    priorities: unique("priority"),
    environments: unique("environment"),
    authenticationTypes: unique("authenticationType"),
    dateRanges: ["Today", "7 Days", "30 Days", "90 Days"],
    failureTypes: ["Authentication Error", "Timeout", "Rate Limit", "Invalid Response", "Provider Down", "Schema Changed", "Validation Failed", "Network Error", "Database Error", "Unknown"],
    rateLimitStatuses: ["Normal", "Warning", "Critical", "Exceeded", "Unknown"]
  };
}

function emptyReliability() {
  return {
    availabilityTrend: [],
    latencyTrend: [],
    successRateTrend: [],
    failureRateTrend: [],
    rateLimitUsage: [],
    recordsImportedTrend: []
  };
}

async function sourceRows() {
  const { rows } = await query(`
    SELECT r.id, r.source_key, r.name AS source, coalesce(r.module, r.name) AS module, r.category,
           r.priority, r.environment, r.enabled,
           coalesce(ph.provider, r.name) AS provider,
           ph.provider_type, ph.status, ph.availability_pct, ph.success_rate_pct,
           ph.failure_rate_pct, ph.latency_ms, ph.rate_limit_status, ph.authentication_status,
           hm.health AS stored_health, hm.health_score, hm.quality_score, hm.freshness_status,
           hm.data_freshness, hm.records_imported, hm.records_rejected,
           c.authentication_type,
           sl.last_success_at, sl.last_failure_at, sl.started_at AS last_sync_at,
           coalesce(a.open_alerts, 0)::int AS open_alerts
    FROM market.source_registry r
    LEFT JOIN LATERAL (
      SELECT * FROM market.source_provider_health ph
      WHERE ph.registry_id = r.id OR ph.source_key = r.source_key
      ORDER BY ph.observed_at DESC LIMIT 1
    ) ph ON true
    LEFT JOIN LATERAL (
      SELECT * FROM market.source_health_metrics hm
      WHERE hm.registry_id = r.id OR hm.source_key = r.source_key
      ORDER BY hm.observed_at DESC LIMIT 1
    ) hm ON true
    LEFT JOIN LATERAL (
      SELECT * FROM market.source_sync_logs sl
      WHERE sl.registry_id = r.id OR sl.source_key = r.source_key
      ORDER BY sl.started_at DESC LIMIT 1
    ) sl ON true
    LEFT JOIN LATERAL (
      SELECT * FROM market.source_credentials c
      WHERE c.registry_id = r.id OR c.source_key = r.source_key
      ORDER BY c.created_at DESC LIMIT 1
    ) c ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS open_alerts FROM market.source_alerts a
      WHERE (a.registry_id = r.id OR a.source_key = r.source_key) AND upper(a.status) = 'OPEN'
    ) a ON true
    ORDER BY r.name
  `);
  return rows.map(row => {
    const status = String(row.status || (row.enabled ? "NOT_CONFIGURED" : "PAUSED")).toUpperCase();
    const health = healthFrom({ ...row, status });
    const healthScore = scoreFrom({ ...row, status });
    return {
      id: row.id,
      sourceKey: row.source_key,
      source: row.source,
      module: row.module,
      provider: row.provider,
      providerType: row.provider_type,
      status,
      health,
      healthScore,
      priority: row.priority,
      lastSync: row.last_sync_at,
      lastSuccess: row.last_success_at,
      lastFailure: row.last_failure_at,
      latencyMs: row.latency_ms,
      availabilityPct: pct(row.availability_pct),
      successRatePct: pct(row.success_rate_pct),
      failureRatePct: pct(row.failure_rate_pct),
      recordsImported: row.records_imported,
      recordsRejected: row.records_rejected,
      qualityScore: pct(row.quality_score),
      dataFreshness: row.data_freshness,
      freshnessStatus: String(row.freshness_status || "UNKNOWN").toUpperCase(),
      rateLimit: String(row.rate_limit_status || "UNKNOWN").toUpperCase(),
      authentication: String(row.authentication_status || "UNKNOWN").toUpperCase(),
      authenticationType: row.authentication_type,
      environment: row.environment,
      category: row.category,
      recommendedAction: recommendedAction({ ...row, status, freshness_status: row.freshness_status })
    };
  });
}

async function failureRows() {
  const { rows } = await query(`
    SELECT coalesce(sl.started_at, sl.completed_at) AS time, coalesce(r.name, sl.source_key) AS source,
           sl.provider, sl.job_type, sl.failure_type, sl.error_message, sl.retry_count,
           sl.resolved, sl.affected_records, sl.severity, sl.status
    FROM market.source_sync_logs sl
    LEFT JOIN market.source_registry r ON r.id = sl.registry_id OR r.source_key = sl.source_key
    WHERE upper(coalesce(sl.status, '')) IN ('FAILED', 'ERROR') OR sl.failure_type IS NOT NULL
    ORDER BY coalesce(sl.started_at, sl.completed_at) DESC
    LIMIT 100
  `);
  return rows.map(row => ({
    time: row.time,
    source: row.source,
    provider: row.provider,
    jobType: row.job_type,
    failureType: row.failure_type,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    resolved: row.resolved,
    affectedRecords: row.affected_records,
    severity: row.severity,
    action: row.resolved ? "Review" : "Investigate"
  }));
}

async function qualityRows() {
  const { rows } = await query(`
    SELECT coalesce(r.name, vl.source_key) AS source, vl.validation_rule, vl.issue_count,
           vl.severity, vl.detected_at, vl.status, vl.recommended_fix,
           hm.duplicate_records, hm.missing_records, hm.invalid_records, hm.records_rejected,
           hm.outdated_records, hm.schema_errors, hm.timestamp_gaps, hm.data_completeness_pct,
           hm.validation_pass_rate_pct
    FROM market.source_validation_logs vl
    LEFT JOIN market.source_registry r ON r.id = vl.registry_id OR r.source_key = vl.source_key
    LEFT JOIN LATERAL (
      SELECT * FROM market.source_health_metrics hm
      WHERE hm.registry_id = vl.registry_id OR hm.source_key = vl.source_key
      ORDER BY hm.observed_at DESC LIMIT 1
    ) hm ON true
    ORDER BY vl.detected_at DESC
    LIMIT 100
  `);
  return rows.map(row => ({
    source: row.source,
    validationRule: row.validation_rule,
    issueCount: row.issue_count,
    severity: row.severity,
    lastDetected: row.detected_at,
    status: row.status,
    recommendedFix: row.recommended_fix,
    duplicateRecords: row.duplicate_records,
    missingRecords: row.missing_records,
    invalidRecords: row.invalid_records,
    rejectedRecords: row.records_rejected,
    outdatedRecords: row.outdated_records,
    schemaErrors: row.schema_errors,
    timestampGaps: row.timestamp_gaps,
    dataCompletenessPct: pct(row.data_completeness_pct),
    validationPassRatePct: pct(row.validation_pass_rate_pct)
  }));
}

async function dependencyRows() {
  const { rows } = await query(`
    SELECT coalesce(r.name, d.source_key) AS source, d.affected_module, d.affected_page,
           d.business_impact, d.risk_level, d.fallback_available, d.recommended_action
    FROM market.source_dependencies d
    LEFT JOIN market.source_registry r ON r.id = d.registry_id OR r.source_key = d.source_key
    ORDER BY coalesce(r.name, d.source_key), d.affected_module
  `);
  return rows.map(row => ({
    source: row.source,
    affectedModules: row.affected_module,
    affectedPages: row.affected_page,
    businessImpact: row.business_impact,
    riskLevel: row.risk_level,
    fallbackAvailable: row.fallback_available,
    recommendedAction: row.recommended_action
  }));
}

async function rateLimitRows() {
  const { rows } = await query(`
    SELECT coalesce(rl.provider, ph.provider, r.name) AS provider, rl.plan, rl.api_calls_used,
           rl.api_calls_remaining, rl.reset_time, rl.usage_pct, rl.status, rl.recommended_action
    FROM market.source_rate_limits rl
    LEFT JOIN market.source_registry r ON r.id = rl.registry_id OR r.source_key = rl.source_key
    LEFT JOIN LATERAL (
      SELECT provider FROM market.source_provider_health ph
      WHERE ph.registry_id = r.id OR ph.source_key = r.source_key
      ORDER BY observed_at DESC LIMIT 1
    ) ph ON true
    ORDER BY rl.observed_at DESC
    LIMIT 100
  `);
  return rows.map(row => ({
    provider: row.provider,
    plan: row.plan,
    apiCallsUsed: row.api_calls_used,
    apiCallsRemaining: row.api_calls_remaining,
    resetTime: row.reset_time,
    usagePct: pct(row.usage_pct),
    status: row.status,
    recommendedAction: row.recommended_action
  }));
}

async function securityRows() {
  const { rows } = await query(`
    SELECT coalesce(r.name, c.source_key) AS source, c.authentication_type, c.credential_status,
           c.credential_expiry, c.last_rotation,
           c.encryption_status, c.access_scope, c.security_risk
    FROM market.source_credentials c
    LEFT JOIN market.source_registry r ON r.id = c.registry_id OR r.source_key = c.source_key
    ORDER BY coalesce(r.name, c.source_key)
  `);
  return rows.map(row => ({
    source: row.source,
    authenticationType: row.authentication_type,
    credentialStatus: String(row.credential_status || "UNKNOWN").toUpperCase(),
    credentialExpiry: row.credential_expiry,
    lastRotation: row.last_rotation,
    encryptionStatus: row.encryption_status,
    accessScope: row.access_scope,
    securityRisk: row.security_risk
  }));
}

async function recommendations() {
  const { rows } = await query(`
    SELECT coalesce(r.name, rec.source_key) AS source, rec.recommendation, rec.severity, rec.status, rec.created_at
    FROM market.source_health_recommendations rec
    LEFT JOIN market.source_registry r ON r.id = rec.registry_id OR r.source_key = rec.source_key
    ORDER BY rec.created_at DESC
    LIMIT 100
  `);
  return rows.map(row => ({ source: row.source, recommendation: row.recommendation, severity: row.severity, status: row.status, createdAt: row.created_at }));
}

async function auditRows() {
  const { rows } = await query("SELECT created_at, event, source_key, severity, actor, result FROM market.source_audit_logs ORDER BY created_at DESC LIMIT 50");
  return rows.map(row => ({ timestamp: row.created_at, action: row.event, source: row.source_key, severity: row.severity, actor: row.actor, status: row.result }));
}

async function latestReview() {
  const { rows } = await query("SELECT created_at, summary FROM market.source_health_reviews ORDER BY created_at DESC LIMIT 1");
  return latest(rows);
}

function freshnessRows(rows) {
  return rows.map(row => ({
    source: row.source,
    expectedRefreshInterval: row.dataFreshness || null,
    lastSuccessfulSync: row.lastSuccess,
    ageOfData: row.dataFreshness,
    freshnessStatus: row.freshnessStatus,
    affectedModule: row.module,
    recommendedAction: recommendedAction({ ...row, freshness_status: row.freshnessStatus })
  }));
}

function reliabilityRows(rows, rateLimits) {
  if (!rows.length) return emptyReliability();
  return {
    availabilityTrend: rows.filter(row => row.availabilityPct !== null).map(row => ({ label: row.source, value: row.availabilityPct })),
    latencyTrend: rows.filter(row => row.latencyMs !== null && row.latencyMs !== undefined).map(row => ({ label: row.source, value: row.latencyMs })),
    successRateTrend: rows.filter(row => row.successRatePct !== null).map(row => ({ label: row.source, value: row.successRatePct })),
    failureRateTrend: rows.filter(row => row.failureRatePct !== null).map(row => ({ label: row.source, value: row.failureRatePct })),
    rateLimitUsage: rateLimits.filter(row => row.usagePct !== null).map(row => ({ label: row.provider, value: row.usagePct })),
    recordsImportedTrend: rows.filter(row => Number(row.recordsImported || 0) > 0).map(row => ({ label: row.source, value: row.recordsImported }))
  };
}

function qualityMetrics(rows) {
  const sum = key => rows.reduce((total, row) => total + Number(row[key] || 0), 0);
  const avg = key => {
    const values = rows.map(row => n(row[key])).filter(value => value !== null);
    return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : null;
  };
  return [
    ["Duplicate Records", sum("duplicateRecords")],
    ["Missing Records", sum("missingRecords")],
    ["Invalid Records", sum("invalidRecords")],
    ["Rejected Records", sum("rejectedRecords")],
    ["Outdated Records", sum("outdatedRecords")],
    ["Schema Errors", sum("schemaErrors")],
    ["Timestamp Gaps", sum("timestampGaps")],
    ["Data Completeness %", avg("dataCompletenessPct")],
    ["Validation Pass Rate %", avg("validationPassRatePct")]
  ];
}

export class SourceHealthReviewService {
  static async dashboard() {
    if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured. Source Health Review reads production source health tables only.");
    const readiness = await tableReadiness();
    if (!readiness.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${readiness.missing.join(", ")}`, readiness.missing);

    const [sources, failures, quality, dependencies, rateLimits, security, recs, audit, review] = await Promise.all([
      sourceRows(),
      failureRows(),
      qualityRows(),
      dependencyRows(),
      rateLimitRows(),
      securityRows(),
      recommendations(),
      auditRows(),
      latestReview()
    ]);
    const rowsWithHealth = sources.map(row => ({ ...row, health: row.health || healthFrom(row) }));
    if (!rowsWithHealth.length) {
      return { ...emptyState("EMPTY", "No production data sources registered yet. Register a source in the Data Source Intelligence Center to begin health monitoring."), schemaReady: true, status: "EMPTY" };
    }
    const summary = summaryCards(rowsWithHealth, failures, quality, rateLimits, security);
    const systemHealth = summary.find(([label]) => label === "System Health Score")?.[1] ?? null;
    return {
      sourceMode: "DATABASE_ONLY",
      status: "READY",
      schemaReady: true,
      permissions: permissions(),
      header: emptyState().header,
      badges: { productionLive: true, mockDataDisabled: true, liveProvidersOnly: true, lastHealthCheck: review?.created_at || null, systemHealthScore: systemHealth },
      summary,
      filters: filterOptions(rowsWithHealth),
      sources: rowsWithHealth,
      freshness: freshnessRows(rowsWithHealth),
      failures,
      reliability: reliabilityRows(rowsWithHealth, rateLimits),
      quality: { metrics: qualityMetrics(quality), rows: quality },
      dependencies,
      rateLimits,
      security,
      recommendations: recs,
      audit
    };
  }

  static async persistRuntimeSnapshot({ providers = [], liveSnapshots = [], actor = "api" } = {}) {
    if (!providers.length) return { registered: 0, metrics: 0 };
    return withTransaction(async client => {
      let metrics = 0;
      for (const provider of providers) {
        const live = liveForProvider(provider, liveSnapshots);
        const status = String(live?.status || (provider.enabled ? "NOT_CONFIGURED" : "PAUSED")).toUpperCase();
        const healthy = ["ONLINE", "LIVE", "SYNCED"].includes(status);
        const healthScore = live?.healthScore === null || live?.healthScore === undefined ? null : Number(live.healthScore);
        const health = healthLabelForScore(healthScore, status);
        const authStatus = credentialStatus(provider);
        const sourceKey = provider.sourceKey;
        const registry = await client.query(`
          INSERT INTO market.source_registry (source_key, name, module, category, required, priority, environment, enabled, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
          ON CONFLICT (source_key) DO UPDATE SET
            name = excluded.name,
            module = excluded.module,
            category = excluded.category,
            required = excluded.required,
            priority = excluded.priority,
            environment = excluded.environment,
            enabled = excluded.enabled,
            updated_at = now()
          RETURNING id
        `, [
          sourceKey,
          provider.sourceLabel || sourceKey,
          provider.sourceLabel || sourceKey,
          provider.category || sourceKey,
          Boolean(provider.required),
          provider.required ? "critical" : "normal",
          provider.environment || "production",
          provider.enabled !== false
        ]);
        const registryId = registry.rows[0].id;
        await client.query(`
          INSERT INTO market.source_provider_health (
            registry_id, source_key, provider, provider_type, status, availability_pct, success_rate_pct,
            failure_rate_pct, latency_ms, rate_limit_status, authentication_status, environment, payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'UNKNOWN', $10, $11, $12::jsonb)
        `, [
          registryId,
          sourceKey,
          live?.provider || provider.providerName,
          provider.providerType,
          status,
          healthy ? 100 : status === "NOT_CONFIGURED" ? null : 0,
          healthy ? 100 : status === "NOT_CONFIGURED" ? null : 0,
          healthy ? 0 : status === "NOT_CONFIGURED" ? null : 100,
          live?.latencyMs ?? null,
          authStatus,
          provider.environment || "production",
          JSON.stringify({ adapter: live?.adapter || null, apiUrlConfigured: Boolean(provider.apiUrl), probeError: live?.probeError || null })
        ]);
        await client.query(`
          INSERT INTO market.source_health_metrics (
            registry_id, source_key, health, health_score, quality_score, freshness_status, data_freshness,
            records_imported, records_rejected, data_completeness_pct, validation_pass_rate_pct, payload
          )
          VALUES ($1, $2, $3, $4, $4, $5, $6, $7, 0, $8, $8, $9::jsonb)
        `, [
          registryId,
          sourceKey,
          health,
          healthScore,
          freshnessStatus(live),
          live?.freshness || null,
          Number(live?.records || 0),
          healthy ? 100 : status === "NOT_CONFIGURED" ? null : 0,
          JSON.stringify({ checks: live?.checks || {}, lastSyncAt: live?.lastSyncAt || null })
        ]);
        await client.query(`
          INSERT INTO market.source_sync_logs (
            registry_id, source_key, provider, job_type, status, records_imported, records_rejected,
            started_at, completed_at, last_success_at, last_failure_at, severity, error_message, payload
          )
          VALUES ($1, $2, $3, 'health_check', $4, $5, 0, now(), now(), $6, $7, $8, $9, $10::jsonb)
        `, [
          registryId,
          sourceKey,
          live?.provider || provider.providerName,
          healthy ? "COMPLETED" : status === "NOT_CONFIGURED" ? "SKIPPED" : "FAILED",
          Number(live?.records || 0),
          healthy ? (live?.lastSyncAt || new Date().toISOString()) : null,
          healthy ? null : new Date().toISOString(),
          healthy ? "info" : provider.required ? "critical" : "warning",
          live?.probeError || null,
          JSON.stringify({ status, freshness: live?.freshness || null })
        ]);
        await client.query(`
          INSERT INTO market.source_credentials (
            registry_id, source_key, authentication_type, credential_status, encryption_status,
            access_scope, security_risk, vault_ref
          )
          VALUES ($1, $2, $3, $4, 'ENCRYPTED_REFERENCE', $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [
          registryId,
          sourceKey,
          provider.authenticationType || "unknown",
          authStatus,
          provider.credentialRef ? "provider_api" : "none",
          authStatus === "VALID" ? "LOW" : "HIGH",
          provider.credentialRef || null
        ]);
        for (const [module, page, impact, risk] of DEPENDENCY_MAP[sourceKey] || []) {
          await client.query(`
            INSERT INTO market.source_dependencies (
              registry_id, source_key, affected_module, affected_page, business_impact, risk_level,
              fallback_available, recommended_action
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT DO NOTHING
          `, [
            registryId,
            sourceKey,
            module,
            page,
            impact,
            risk,
            !provider.required,
            recommendedAction({ status, freshness_status: freshnessStatus(live), latency_ms: live?.latencyMs })
          ]);
        }
        metrics += 1;
      }
      await client.query(
        "INSERT INTO market.source_audit_logs (source_key, event, severity, actor, result, payload) VALUES ('system', 'Source Health Snapshot Persisted', 'info', $1, 'COMPLETED', $2::jsonb)",
        [actor, JSON.stringify({ registered: providers.length, liveSnapshots: liveSnapshots.length })]
      );
      return { registered: providers.length, metrics };
    });
  }

  static async runHealthCheck(actor = "api", context = {}) {
    if (context.providers?.length) {
      await SourceHealthReviewService.persistRuntimeSnapshot({ ...context, actor });
    }
    const dashboard = await SourceHealthReviewService.dashboard();
    if (!dashboard.schemaReady) return dashboard;
    return withTransaction(async client => {
      await client.query(
        "INSERT INTO market.source_health_reviews (review_type, status, summary) VALUES ('manual_health_check', $1, $2::jsonb)",
        [dashboard.status === "READY" ? "COMPLETED" : dashboard.status, JSON.stringify({ summary: dashboard.summary, sourceCount: dashboard.sources.length })]
      );
      await client.query(
        "INSERT INTO market.source_audit_logs (source_key, event, severity, actor, result, payload) VALUES ('system', 'Source Health Check Run', 'info', $1, $2, $3::jsonb)",
        [actor, dashboard.status === "READY" ? "COMPLETED" : dashboard.status, JSON.stringify({ sourceCount: dashboard.sources.length })]
      );
      return { action: "run-check", status: dashboard.status, checkedSources: dashboard.sources.length, summary: dashboard.summary };
    });
  }

  static async syncFailed(actor = "api") {
    const failures = await failureRows();
    return withTransaction(async client => {
      await client.query(
        "INSERT INTO market.source_health_reviews (review_type, status, summary) VALUES ('sync_failed_sources', 'RECORDED', $1::jsonb)",
        [JSON.stringify({ failedSources: failures.length })]
      );
      await client.query(
        "INSERT INTO market.source_audit_logs (source_key, event, severity, actor, result, payload) VALUES ('system', 'Sync Failed Sources Requested', 'warning', $1, 'RECORDED', $2::jsonb)",
        [actor, JSON.stringify({ failedSources: failures.length })]
      );
      return { action: "sync-failed", status: "RECORDED", failedSources: failures.length };
    });
  }

  static async acknowledgeAlert(alertId, actor = "api") {
    if (!alertId) {
      const error = new Error("alert_id_required");
      error.status = 400;
      throw error;
    }
    const { rows } = await query(
      "UPDATE market.source_alerts SET status = 'ACKNOWLEDGED', acknowledged_at = now() WHERE id = $1 RETURNING id, source_key, status",
      [alertId]
    );
    if (!rows.length) {
      const error = new Error("alert_not_found");
      error.status = 404;
      throw error;
    }
    await query(
      "INSERT INTO market.source_audit_logs (source_key, event, severity, actor, result, payload) VALUES ($1, 'Source Alert Acknowledged', 'info', $2, 'ACKNOWLEDGED', $3::jsonb)",
      [rows[0].source_key || "system", actor, JSON.stringify({ alertId })]
    );
    return { action: "acknowledge-alert", alert: rows[0] };
  }
}

export async function getSourceHealthReviewDashboard() {
  return SourceHealthReviewService.dashboard();
}

export async function runSourceHealthReviewAction(action, body = {}, actor = "api", context = {}) {
  if (!isDatabaseConfigured()) {
    const error = new Error("database_not_configured");
    error.status = 503;
    throw error;
  }
  const readiness = await tableReadiness();
  if (!readiness.ready) {
    const error = new Error("schema_not_ready");
    error.status = 503;
    error.missingTables = readiness.missing;
    throw error;
  }
  if (action === "run-check") return SourceHealthReviewService.runHealthCheck(actor, context);
  if (action === "sync-failed") return SourceHealthReviewService.syncFailed(actor);
  if (action === "acknowledge-alert") return SourceHealthReviewService.acknowledgeAlert(body.alertId, actor);
  const error = new Error("unsupported_source_health_action");
  error.status = 404;
  throw error;
}

export async function getSourceHealthReviewSlice(slice) {
  const dashboard = await SourceHealthReviewService.dashboard();
  if (slice === "summary") return { status: dashboard.status, summary: dashboard.summary, badges: dashboard.badges };
  if (slice === "freshness") return { status: dashboard.status, freshness: dashboard.freshness };
  if (slice === "failures") return { status: dashboard.status, failures: dashboard.failures };
  if (slice === "quality") return { status: dashboard.status, quality: dashboard.quality };
  if (slice === "dependencies") return { status: dashboard.status, dependencies: dashboard.dependencies };
  if (slice === "rate-limits") return { status: dashboard.status, rateLimits: dashboard.rateLimits };
  if (slice === "security") return { status: dashboard.status, security: dashboard.security };
  if (slice === "export") return { exportedAt: new Date().toISOString(), dashboard };
  return dashboard;
}
