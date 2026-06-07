import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import {
  getInstitutionalLiveSource,
  getLiquidityLiveSource,
  getMomentumLiveSource,
  getTrendLiveSource,
  getVolatilityLiveSource,
  syncAssetUniverseFromLiveSources
} from "./universe-live-source-adapter.js";

export const UNIVERSE_SCANNER_TABLES = Object.freeze([
  "market.asset_universe",
  "market.asset_scan_runs",
  "market.asset_scan_results",
  "market.asset_opportunity_scores",
  "market.qualified_trade_candidates",
  "market.scanner_pipeline_status",
  "market.scanner_health_metrics",
  "market.scanner_ai_summaries",
  "market.scanner_alerts",
  "market.scanner_audit_logs"
]);

const PIPELINE_MODULES = Object.freeze([
  ["universe-registry", "Universe Registry"],
  ["currency-strength", "Currency Strength"],
  ["trend-scan", "Trend Scan"],
  ["market-structure", "Market Structure"],
  ["momentum", "Momentum"],
  ["volatility", "Volatility"],
  ["liquidity", "Liquidity"],
  ["institutional", "Institutional"],
  ["sentiment", "Sentiment"],
  ["macro", "Macro"],
  ["economic-events", "Economic Events"],
  ["risk", "Risk"],
  ["compliance", "Compliance"],
  ["opportunity-ranking", "Opportunity Ranking"],
  ["qualified-trades", "Qualified Trades"],
  ["ai-insights", "AI Insights"]
]);

const READINESS_CHECKS = Object.freeze([
  "Assets scanned",
  "Minimum qualified opportunities met",
  "Source health acceptable",
  "No critical scanner failure",
  "Opportunity rankings calculated",
  "Qualified trade candidates generated",
  "Risk and compliance completed",
  "Audit logs written"
]);

const permissions = () => ({
  view: "universe_scanner.dashboard.view",
  runScan: "universe_scanner.dashboard.run_scan",
  refresh: "universe_scanner.dashboard.refresh",
  export: "universe_scanner.dashboard.export",
  createAlert: "universe_scanner.dashboard.create_alert"
});

const n = value => value === null || value === undefined || value === "" ? null : Number(value);
const round = value => value === null || value === undefined || Number.isNaN(Number(value)) ? null : Math.round(Number(value));
const avg = values => {
  const valid = values.map(n).filter(value => value !== null && !Number.isNaN(value));
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
};

async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    if (["42P01", "42703", "42883"].includes(error.code)) return { rows: [] };
    throw error;
  }
}

async function tableReadiness() {
  const { rows } = await query(
    "SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name",
    [UNIVERSE_SCANNER_TABLES]
  );
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyDashboard(status, message, missingTables = []) {
  return {
    sourceMode: "PRODUCTION_RECORDS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: {
      productionLive: true,
      mockDataDisabled: true,
      liveAssetsOnly: true,
      lastScan: null,
      scannerStatus: "Insufficient Data",
      card3Readiness: "Insufficient Data"
    },
    summary: {},
    pipeline: PIPELINE_MODULES.map(([moduleKey, moduleName]) => ({
      moduleKey,
      moduleName,
      status: "Not Configured",
      lastRun: null,
      recordsProcessed: 0,
      durationMs: null,
      health: "Warning"
    })),
    assets: [],
    topOpportunities: {
      topBuyCandidates: [],
      topSellCandidates: [],
      topInstitutionalSetups: [],
      topPropSafeOpportunities: [],
      topHighConfidenceAssets: []
    },
    rejected: [],
    health: null,
    distribution: [
      ["Elite", 0],
      ["Qualified", 0],
      ["Watchlist", 0],
      ["Rejected", 0],
      ["Blocked", 0],
      ["Insufficient Data", 0]
    ].map(([qualification, count]) => ({ qualification, count })),
    readiness: { status: "Insufficient Data", score: null, checks: READINESS_CHECKS.map(name => ({ name, status: "Insufficient Data" })) },
    aiSummary: null,
    emptyState: {
      title: "No universe scan has been completed yet.",
      message: "Run a live universe scan to evaluate assets, rank opportunities, and generate qualified trade candidates.",
      actions: ["Run Universe Scan", "Open Universe Registry", "Open Control Center", "Run Test Harness"]
    }
  };
}

function statusFromReadiness(score, blocked) {
  if (blocked) return "Blocked";
  if (score === null || score === undefined) return "Insufficient Data";
  if (score >= 85) return "Ready";
  if (score >= 70) return "Ready With Warnings";
  if (score >= 45) return "Review Required";
  return "Blocked";
}

function qualificationBucket(value) {
  const normalized = String(value || "Insufficient Data").trim();
  const allowed = new Set(["Elite", "Qualified", "Watchlist", "Rejected", "Blocked", "Insufficient Data"]);
  return allowed.has(normalized) ? normalized : "Insufficient Data";
}

function rankRows(rows) {
  return rows.map((row, index) => ({ rank: index + 1, ...row }));
}

async function latestRun() {
  const { rows } = await safeQuery(`
    SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt",
      duration_ms AS "durationMs", assets_requested AS "assetsRequested", assets_scanned AS "assetsScanned",
      triggered_by AS "triggeredBy", readiness_status AS "readinessStatus", readiness_score AS "readinessScore", payload
    FROM market.asset_scan_runs
    ORDER BY started_at DESC
    LIMIT 1
  `);
  return rows[0] || null;
}

async function summary(run) {
  const runFilter = run?.id ? "WHERE r.run_id = $1" : "";
  const params = run?.id ? [run.id] : [];
  const [assets, results, scores, health] = await Promise.all([
    safeQuery("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active)::int AS active FROM market.asset_universe"),
    safeQuery(`SELECT qualification, COUNT(*)::int AS count FROM market.asset_scan_results r ${runFilter} GROUP BY qualification`, params),
    safeQuery(`SELECT avg(opportunity_score)::numeric AS opportunity, avg(confidence_score)::numeric AS confidence FROM market.asset_opportunity_scores s ${run?.id ? "WHERE s.run_id = $1" : ""}`, params),
    safeQuery(`SELECT health_score FROM market.scanner_health_metrics ${run?.id ? "WHERE run_id = $1" : ""} ORDER BY observed_at DESC LIMIT 1`, params)
  ]);
  const byQualification = Object.fromEntries(results.rows.map(row => [qualificationBucket(row.qualification), Number(row.count || 0)]));
  const blocked = byQualification.Blocked || 0;
  const rejected = byQualification.Rejected || 0;
  const readinessScore = round(run?.readinessScore);
  return {
    assetsScanned: run?.assetsScanned ?? 0,
    activeAssets: assets.rows[0]?.active || 0,
    qualifiedOpportunities: byQualification.Qualified || 0,
    watchlistOpportunities: byQualification.Watchlist || 0,
    rejectedAssets: rejected,
    blockedAssets: blocked,
    eliteOpportunities: byQualification.Elite || 0,
    highRiskAssets: rejected + blocked,
    averageOpportunityScore: round(scores.rows[0]?.opportunity),
    averageConfidenceScore: round(scores.rows[0]?.confidence),
    scannerHealthScore: round(health.rows[0]?.health_score),
    card3ReadinessScore: readinessScore,
    status: statusFromReadiness(readinessScore, blocked > 0)
  };
}

async function pipeline(run) {
  const params = run?.id ? [run.id] : [];
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (module_key) module_key AS "moduleKey", module_name AS "moduleName", status,
      last_run AS "lastRun", records_processed AS "recordsProcessed", duration_ms AS "durationMs", health, updated_at AS "updatedAt"
    FROM market.scanner_pipeline_status
    ${run?.id ? "WHERE run_id = $1" : ""}
    ORDER BY module_key, updated_at DESC
  `, params);
  const byKey = new Map(rows.map(row => [row.moduleKey, row]));
  return PIPELINE_MODULES.map(([moduleKey, moduleName]) => ({
    moduleKey,
    moduleName,
    status: byKey.get(moduleKey)?.status || "Not Configured",
    lastRun: byKey.get(moduleKey)?.lastRun || null,
    recordsProcessed: byKey.get(moduleKey)?.recordsProcessed || 0,
    durationMs: byKey.get(moduleKey)?.durationMs ?? null,
    health: byKey.get(moduleKey)?.health || "Warning"
  }));
}

async function assets(run) {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (r.asset)
      r.asset, r.asset_class AS "assetClass", r.broker_symbol AS "brokerSymbol", r.status,
      r.last_price AS "lastPrice", r.spread,
      s.trend_score AS "trendScore", s.momentum_score AS "momentumScore", s.volatility_score AS "volatilityScore",
      s.liquidity_score AS "liquidityScore", s.institutional_score AS "institutionalScore",
      s.sentiment_score AS "sentimentScore", s.macro_score AS "macroScore", s.risk_score AS "riskScore",
      s.compliance_score AS "complianceScore", s.confidence_score AS "confidenceScore",
      s.opportunity_score AS "opportunityScore", r.qualification, r.last_scanned AS "lastScanned"
    FROM market.asset_scan_results r
    LEFT JOIN market.asset_opportunity_scores s ON s.scan_result_id = r.id
    ${run?.id ? "WHERE r.run_id = $1" : ""}
    ORDER BY r.asset, r.last_scanned DESC, s.calculated_at DESC
  `, run?.id ? [run.id] : []);
  return rows.map(row => ({
    ...row,
    qualification: qualificationBucket(row.qualification),
    trendScore: round(row.trendScore),
    momentumScore: round(row.momentumScore),
    volatilityScore: round(row.volatilityScore),
    liquidityScore: round(row.liquidityScore),
    institutionalScore: round(row.institutionalScore),
    sentimentScore: round(row.sentimentScore),
    macroScore: round(row.macroScore),
    riskScore: round(row.riskScore),
    complianceScore: round(row.complianceScore),
    confidenceScore: round(row.confidenceScore),
    opportunityScore: round(row.opportunityScore)
  }));
}

async function topOpportunities(run) {
  const { rows } = await safeQuery(`
    SELECT asset, direction, opportunity_score AS "opportunityScore", confidence_score AS confidence,
      risk_score AS "riskScore", compliance_score AS "complianceScore", main_reason AS "mainReason",
      institutional_setup AS "institutionalSetup", prop_safe AS "propSafe"
    FROM market.qualified_trade_candidates
    ${run?.id ? "WHERE run_id = $1" : ""}
    ORDER BY opportunity_score DESC NULLS LAST, confidence_score DESC NULLS LAST, created_at DESC
    LIMIT 100
  `, run?.id ? [run.id] : []);
  const mapped = rows.map(row => ({
    asset: row.asset,
    direction: row.direction,
    opportunityScore: round(row.opportunityScore),
    confidence: round(row.confidence),
    riskScore: round(row.riskScore),
    mainReason: row.mainReason || row.payload?.mainReason || null,
    institutionalSetup: Boolean(row.institutionalSetup),
    propSafe: Boolean(row.propSafe)
  }));
  return {
    topBuyCandidates: rankRows(mapped.filter(row => String(row.direction).toLowerCase() === "buy").slice(0, 5)),
    topSellCandidates: rankRows(mapped.filter(row => String(row.direction).toLowerCase() === "sell").slice(0, 5)),
    topInstitutionalSetups: rankRows(mapped.filter(row => row.institutionalSetup).slice(0, 5)),
    topPropSafeOpportunities: rankRows(mapped.filter(row => row.propSafe).slice(0, 5)),
    topHighConfidenceAssets: rankRows(mapped.slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 5))
  };
}

async function rejected(run) {
  const { rows } = await safeQuery(`
    SELECT r.asset, r.rejection_reason AS reason, r.blocking_module AS "blockingModule", r.severity,
      s.risk_score AS "riskScore", s.compliance_score AS "complianceScore",
      COALESCE(r.payload->>'recommendedAction', s.payload->>'recommendedAction') AS "recommendedAction"
    FROM market.asset_scan_results r
    LEFT JOIN market.asset_opportunity_scores s ON s.scan_result_id = r.id
    WHERE r.qualification IN ('Rejected','Blocked')
      ${run?.id ? "AND r.run_id = $1" : ""}
    ORDER BY r.last_scanned DESC
    LIMIT 100
  `, run?.id ? [run.id] : []);
  return rows.map(row => ({ ...row, riskScore: round(row.riskScore), complianceScore: round(row.complianceScore) }));
}

async function health(run) {
  const { rows } = await safeQuery(`
    SELECT scanner_status AS "scannerStatus", worker_status AS "workerStatus", queue_status AS "queueStatus",
      last_full_scan AS "lastFullScan", average_scan_duration_ms AS "averageScanDurationMs",
      failed_scan_jobs AS "failedScanJobs", retry_count AS "retryCount", data_freshness AS "dataFreshness",
      source_health AS "sourceHealth", dependency_health AS "dependencyHealth", health_score AS "healthScore",
      observed_at AS "observedAt"
    FROM market.scanner_health_metrics
    ${run?.id ? "WHERE run_id = $1" : ""}
    ORDER BY observed_at DESC
    LIMIT 1
  `, run?.id ? [run.id] : []);
  return rows[0] ? { ...rows[0], healthScore: round(rows[0].healthScore) } : null;
}

async function distribution(run) {
  const { rows } = await safeQuery(`
    SELECT qualification, COUNT(*)::int AS count
    FROM market.asset_scan_results
    ${run?.id ? "WHERE run_id = $1" : ""}
    GROUP BY qualification
  `, run?.id ? [run.id] : []);
  const counts = Object.fromEntries(rows.map(row => [qualificationBucket(row.qualification), Number(row.count || 0)]));
  return ["Elite", "Qualified", "Watchlist", "Rejected", "Blocked", "Insufficient Data"].map(qualification => ({
    qualification,
    count: counts[qualification] || 0
  }));
}

async function readiness(run, summaryRow, pipelineRows) {
  const audit = await safeQuery("SELECT COUNT(*)::int AS count FROM market.scanner_audit_logs WHERE created_at >= COALESCE($1::timestamptz, now() - interval '1 day')", [run?.startedAt || null]);
  const pipelineByKey = new Map(pipelineRows.map(row => [row.moduleKey, row]));
  const checks = [
    { name: "Assets scanned", status: summaryRow.assetsScanned > 0 ? "Passed" : "Insufficient Data" },
    { name: "Minimum qualified opportunities met", status: summaryRow.qualifiedOpportunities + summaryRow.eliteOpportunities > 0 ? "Passed" : "Review Required" },
    { name: "Source health acceptable", status: summaryRow.scannerHealthScore === null ? "Insufficient Data" : summaryRow.scannerHealthScore >= 70 ? "Passed" : "Blocked" },
    { name: "No critical scanner failure", status: pipelineRows.some(row => row.status === "Failed" || row.health === "Critical") ? "Blocked" : "Passed" },
    { name: "Opportunity rankings calculated", status: pipelineByKey.get("opportunity-ranking")?.status === "Passed" ? "Passed" : "Insufficient Data" },
    { name: "Qualified trade candidates generated", status: summaryRow.qualifiedOpportunities + summaryRow.eliteOpportunities > 0 ? "Passed" : "Insufficient Data" },
    { name: "Risk and compliance completed", status: ["Passed", "Ready"].includes(pipelineByKey.get("risk")?.status) && ["Passed", "Ready"].includes(pipelineByKey.get("compliance")?.status) ? "Passed" : "Insufficient Data" },
    { name: "Audit logs written", status: Number(audit.rows[0]?.count || 0) > 0 ? "Passed" : "Insufficient Data" }
  ];
  const blocked = checks.some(check => check.status === "Blocked");
  const passed = checks.filter(check => check.status === "Passed").length;
  const score = checks.length ? round(passed / checks.length * 100) : null;
  return { status: statusFromReadiness(score, blocked), score, checks };
}

async function aiSummary(run) {
  const { rows } = await safeQuery(`
    SELECT best_opportunities AS "bestOpportunities", weakest_assets AS "weakestAssets",
      main_market_theme AS "mainMarketTheme", risk_warnings AS "riskWarnings",
      scanner_confidence AS "scannerConfidence", readiness_for_next_card AS "readinessForNextCard",
      recommended_next_action AS "recommendedNextAction", summary, generated_at AS "generatedAt"
    FROM market.scanner_ai_summaries
    ${run?.id ? "WHERE run_id = $1" : ""}
    ORDER BY generated_at DESC
    LIMIT 1
  `, run?.id ? [run.id] : []);
  return rows[0] ? { ...rows[0], scannerConfidence: round(rows[0].scannerConfidence) } : null;
}

async function liveSourceDashboard() {
  await syncAssetUniverseFromLiveSources("universe-dashboard-live-source");
  const [trend, momentum, volatility, liquidity, institutional, pipelineRows] = await Promise.all([
    getTrendLiveSource(),
    getMomentumLiveSource(),
    getVolatilityLiveSource(),
    getLiquidityLiveSource(),
    getInstitutionalLiveSource(),
    pipeline(null)
  ]);
  const byAsset = new Map();
  const merge = (asset, patch) => {
    if (!asset) return;
    byAsset.set(asset, { ...(byAsset.get(asset) || { asset, assetClass: patch.assetClass || "Forex" }), ...patch });
  };
  for (const row of trend.scores) merge(row.asset, { assetClass: row.assetClass, trendScore: row.trendScore, confidenceScore: row.confidence, lastScanned: row.lastScanned });
  for (const row of momentum.scores) merge(row.asset, { assetClass: row.assetClass, momentumScore: row.momentumScore, confidenceScore: row.confidence, lastScanned: row.lastScanned });
  for (const row of volatility.scores) merge(row.asset, { assetClass: row.assetClass, volatilityScore: row.volatilityScore, confidenceScore: row.confidence, lastScanned: row.lastScanned });
  for (const row of liquidity.scores) merge(row.asset, { assetClass: row.assetClass, liquidityScore: row.liquidityScore, confidenceScore: row.confidence, qualification: row.qualification, lastScanned: row.lastScanned });
  for (const row of institutional.scores) merge(row.asset, { assetClass: row.assetClass, institutionalScore: row.institutionalScore, confidenceScore: round(row.confidence), qualification: row.qualification, lastScanned: row.lastScanned });
  const assetRows = [...byAsset.values()].map(row => {
    const componentScores = [row.trendScore, row.momentumScore, row.volatilityScore, row.liquidityScore, row.institutionalScore].filter(value => value !== null && value !== undefined);
    const opportunityScore = componentScores.length ? round(componentScores.reduce((sum, value) => sum + Number(value), 0) / componentScores.length) : null;
    const confidenceScore = row.confidenceScore ?? null;
    const qualification = row.qualification || (opportunityScore >= 70 ? "Qualified" : opportunityScore >= 40 ? "Watchlist" : "Insufficient Data");
    return {
      ...row,
      brokerSymbol: row.asset,
      status: "Live Source",
      lastPrice: null,
      spread: null,
      sentimentScore: null,
      macroScore: null,
      riskScore: null,
      complianceScore: null,
      opportunityScore,
      confidenceScore,
      qualification
    };
  }).sort((a, b) => Number(b.opportunityScore || 0) - Number(a.opportunityScore || 0));
  const summaryRow = {
    assetsScanned: assetRows.length,
    activeAssets: assetRows.length,
    qualifiedOpportunities: assetRows.filter(row => row.qualification === "Qualified").length,
    watchlistOpportunities: assetRows.filter(row => row.qualification === "Watchlist").length,
    rejectedAssets: assetRows.filter(row => row.qualification === "Rejected").length,
    blockedAssets: assetRows.filter(row => row.qualification === "Blocked").length,
    eliteOpportunities: assetRows.filter(row => Number(row.opportunityScore || 0) >= 85).length,
    highRiskAssets: assetRows.filter(row => ["Rejected", "Blocked"].includes(row.qualification)).length,
    averageOpportunityScore: avg(assetRows.map(row => row.opportunityScore)),
    averageConfidenceScore: avg(assetRows.map(row => row.confidenceScore)),
    scannerHealthScore: avg([trend.scores.length, momentum.scores.length, volatility.scores.length, liquidity.scores.length, institutional.scores.length].map(count => count ? 100 : 0)),
    card3ReadinessScore: null,
    status: assetRows.length ? "Ready With Warnings" : "Insufficient Data"
  };
  return {
    sourceMode: "LIVE_MARKET_INTELLIGENCE_SOURCES",
    mockDataDisabled: true,
    status: assetRows.length ? "READY" : "EMPTY",
    schemaReady: true,
    permissions: permissions(),
    badges: {
      productionLive: true,
      mockDataDisabled: true,
      liveAssetsOnly: true,
      lastScan: assetRows.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null,
      scannerStatus: "Live Source Bridge",
      card3Readiness: summaryRow.status
    },
    summary: summaryRow,
    pipeline: pipelineRows.map(row => ({ ...row, status: row.status === "Not Configured" ? "Live Source" : row.status, recordsProcessed: row.recordsProcessed || assetRows.length })),
    assets: assetRows,
    topOpportunities: {
      topBuyCandidates: rankRows(assetRows.slice(0, 10).map(row => ({ asset: row.asset, direction: "Review", opportunityScore: row.opportunityScore, confidence: row.confidenceScore, riskScore: row.riskScore, mainReason: "Live scanner source alignment" }))),
      topSellCandidates: [],
      topInstitutionalSetups: rankRows(assetRows.filter(row => row.institutionalScore !== null && row.institutionalScore !== undefined).slice(0, 10).map(row => ({ asset: row.asset, direction: "Institutional", opportunityScore: row.institutionalScore, confidence: row.confidenceScore, riskScore: row.riskScore, mainReason: "Live institutional intelligence" }))),
      topPropSafeOpportunities: [],
      topHighConfidenceAssets: rankRows(assetRows.slice().sort((a, b) => Number(b.confidenceScore || 0) - Number(a.confidenceScore || 0)).slice(0, 10).map(row => ({ asset: row.asset, direction: "Review", opportunityScore: row.opportunityScore, confidence: row.confidenceScore, riskScore: row.riskScore, mainReason: "Highest live confidence" })))
    },
    rejected: [],
    health: null,
    distribution: ["Elite", "Qualified", "Watchlist", "Rejected", "Blocked", "Insufficient Data"].map(qualification => ({ qualification, count: qualification === "Elite" ? summaryRow.eliteOpportunities : assetRows.filter(row => row.qualification === qualification).length })),
    readiness: { status: summaryRow.status, score: summaryRow.scannerHealthScore, checks: [{ name: "Live source records available", status: assetRows.length ? "Passed" : "Insufficient Data" }] },
    aiSummary: null,
    emptyState: assetRows.length ? null : emptyDashboard("EMPTY", "No live scanner source rows are available.").emptyState
  };
}

export async function getUniverseScannerDashboard() {
  if (!isDatabaseConfigured()) return emptyDashboard("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const readinessState = await tableReadiness();
  if (!readinessState.ready) return emptyDashboard("SCHEMA_NOT_READY", `Missing tables: ${readinessState.missing.join(", ")}`, readinessState.missing);
  const run = await latestRun();
  if (!run) return liveSourceDashboard();
  const [summaryRow, pipelineRows, assetRows, topRows, rejectedRows, healthRow, distributionRows, aiRow] = await Promise.all([
    summary(run),
    pipeline(run),
    assets(run),
    topOpportunities(run),
    rejected(run),
    health(run),
    distribution(run),
    aiSummary(run)
  ]);
  if (!assetRows.length) return liveSourceDashboard();
  const readinessRow = await readiness(run, summaryRow, pipelineRows);
  return {
    sourceMode: "PRODUCTION_RECORDS_ONLY",
    mockDataDisabled: true,
    status: assetRows.length ? "READY" : "EMPTY",
    schemaReady: true,
    permissions: permissions(),
    badges: {
      productionLive: true,
      mockDataDisabled: true,
      liveAssetsOnly: true,
      lastScan: run.completedAt || run.startedAt,
      scannerStatus: healthRow?.scannerStatus || run.status,
      card3Readiness: readinessRow.status
    },
    latestRun: run,
    summary: summaryRow,
    pipeline: pipelineRows,
    assets: assetRows,
    topOpportunities: topRows,
    rejected: rejectedRows,
    health: healthRow,
    distribution: distributionRows,
    readiness: readinessRow,
    aiSummary: aiRow,
    emptyState: assetRows.length ? null : emptyDashboard("EMPTY", "No universe scan has been completed yet.").emptyState
  };
}

export async function getUniverseScannerDashboardSlice(slice) {
  const dashboard = await getUniverseScannerDashboard();
  const map = {
    summary: { status: dashboard.status, badges: dashboard.badges, summary: dashboard.summary },
    pipeline: { status: dashboard.status, pipeline: dashboard.pipeline },
    assets: { status: dashboard.status, assets: dashboard.assets },
    "top-opportunities": { status: dashboard.status, topOpportunities: dashboard.topOpportunities },
    rejected: { status: dashboard.status, rejected: dashboard.rejected },
    health: { status: dashboard.status, health: dashboard.health },
    readiness: { status: dashboard.status, readiness: dashboard.readiness },
    "ai-summary": { status: dashboard.status, aiSummary: dashboard.aiSummary },
    export: dashboard
  };
  return map[slice] || dashboard;
}

async function assertReady() {
  if (!isDatabaseConfigured()) {
    const error = new Error("database_not_configured");
    error.status = 503;
    throw error;
  }
  const readinessState = await tableReadiness();
  if (!readinessState.ready) {
    const error = new Error("schema_not_ready");
    error.status = 503;
    error.missingTables = readinessState.missing;
    throw error;
  }
}

export async function runUniverseScannerDashboardAction(action, body = {}, actor = "api") {
  await assertReady();
  if (action === "run-scan") {
    const runKey = `USR-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
    const active = await safeQuery("SELECT COUNT(*)::int AS count FROM market.asset_universe WHERE active AND scanner_enabled");
    await withTransaction(async client => {
      const run = await client.query(
        `INSERT INTO market.asset_scan_runs (run_key, status, assets_requested, triggered_by, payload)
         VALUES ($1,'Queued',$2,$3,$4::jsonb) RETURNING id`,
        [runKey, Number(active.rows[0]?.count || 0), actor, JSON.stringify({ requestedBy: actor, source: "dashboard" })]
      );
      await client.query(
        "INSERT INTO market.scanner_audit_logs (run_id, user_name, action, after_value, reason) VALUES ($1,$2,'run_scan_requested',$3::jsonb,$4)",
        [run.rows[0].id, actor, JSON.stringify({ runKey, activeAssets: Number(active.rows[0]?.count || 0) }), body.reason || null]
      );
    });
    return { accepted: true, type: "universe_scanner.run_scan.requested", runKey };
  }
  if (action === "refresh") {
    await safeQuery("INSERT INTO market.scanner_audit_logs (user_name, action, after_value) VALUES ($1,'dashboard_refreshed',$2::jsonb)", [actor, JSON.stringify({ refreshedAt: new Date().toISOString() })]);
    return { accepted: true, type: "universe_scanner.dashboard.refreshed" };
  }
  if (action === "create-alert") {
    const title = String(body.title || "Universe scanner dashboard alert").trim();
    await safeQuery(
      "INSERT INTO market.scanner_alerts (alert_type, title, severity, asset, payload, created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6)",
      [body.alertType || "operator_alert", title, body.severity || "info", body.asset || null, JSON.stringify(body), actor]
    );
    await safeQuery("INSERT INTO market.scanner_audit_logs (user_name, action, after_value) VALUES ($1,'alert_created',$2::jsonb)", [actor, JSON.stringify({ title })]);
    return { accepted: true, type: "universe_scanner.alert.created", title };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    await safeQuery("INSERT INTO market.scanner_audit_logs (user_name, action, after_value) VALUES ($1,$2,$3::jsonb)", [actor, action, JSON.stringify(body || {})]);
    return { accepted: true, type: `universe_scanner.${action}.recorded` };
  }
  throw new Error("unsupported_universe_scanner_dashboard_action");
}

export async function exportUniverseScannerDashboard() {
  return { exportedAt: new Date().toISOString(), report: await getUniverseScannerDashboard() };
}
