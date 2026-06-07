import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { getVolatilityLiveSource, syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

export const VOLATILITY_TABLES = Object.freeze([
  "market.asset_volatility_scores",
  "market.asset_volatility_timeframe_scores",
  "market.asset_volatility_rankings",
  "market.asset_volatility_expansion_signals",
  "market.asset_volatility_compression_signals",
  "market.asset_breakout_readiness_signals",
  "market.asset_abnormal_volatility_alerts",
  "market.volatility_scanner_weights",
  "market.volatility_scanner_runs",
  "market.volatility_scanner_ai_summaries",
  "market.volatility_scanner_alerts",
  "market.volatility_scanner_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.volatility.view",
  runScan: "universe_scanner.volatility.run_scan",
  recalculate: "universe_scanner.volatility.recalculate",
  configureRules: "universe_scanner.volatility.configure_rules",
  createAlert: "universe_scanner.volatility.create_alert",
  export: "universe_scanner.volatility.export"
});

const round = value => value === null || value === undefined || Number.isNaN(Number(value)) ? null : Math.round(Number(value));
const avg = values => {
  const valid = values.filter(value => value !== null && value !== undefined && !Number.isNaN(Number(value))).map(Number);
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
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [VOLATILITY_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "VolatilityScannerEngine",
    sourceMode: "LIVE_ASSETS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastVolatilityScan: null, volatilityScannerHealth: "Insufficient Data" },
    summary: {
      assetsScanned: 0,
      highVolatilityAssets: 0,
      normalVolatilityAssets: 0,
      lowVolatilityAssets: 0,
      volatilityExpansionAssets: 0,
      volatilityCompressionAssets: 0,
      breakoutReadyAssets: 0,
      abnormalVolatilityAlerts: 0,
      tooVolatileAssets: 0,
      averageVolatilityScore: null,
      averageVolatilityConfidence: null,
      scannerHealth: "Insufficient Data"
    },
    matrix: [],
    rankings: [],
    expansion: [],
    compression: [],
    breakoutReadiness: [],
    abnormalRisk: [],
    heatmap: [],
    weights: [],
    aiSummary: null,
    alerts: [],
    audit: [],
    emptyState: {
      title: "Volatility scanner cannot calculate volatility yet.",
      message: "Register active assets, map broker symbols, sync historical candles, and run a live volatility scan before viewing volatility results.",
      actions: ["Open Asset Universe Registry", "Sync Historical Data", "Run Volatility Scan", "Open Control Center"]
    }
  };
}

function rank(rows) { return rows.map((row, index) => ({ rank: row.rank || index + 1, ...row })); }

async function latestRun() {
  const { rows } = await safeQuery(`SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "durationMs", assets_scanned AS "assetsScanned", health FROM market.volatility_scanner_runs ORDER BY started_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function scoreRows() {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset) id, run_id AS "runId", asset_id AS "assetId", asset, asset_class AS "assetClass",
      atr, adr, historical_volatility AS "historicalVolatility", realized_volatility AS "realizedVolatility",
      volatility_rank AS "volatilityRank", volatility_percentile AS "volatilityPercentile",
      expansion_score AS "expansionScore", compression_score AS "compressionScore",
      breakout_readiness_score AS "breakoutReadinessScore", abnormal_volatility_risk AS "abnormalVolatilityRisk",
      overall_volatility AS "overallVolatility", volatility_condition AS "volatilityCondition",
      volatility_score AS "volatilityScore", confidence, qualification, last_scanned AS "lastScanned"
    FROM market.asset_volatility_scores
    ORDER BY asset, last_scanned DESC
  `);
  return rows.map(row => ({
    ...row,
    atr: round(row.atr), adr: round(row.adr), historicalVolatility: round(row.historicalVolatility),
    realizedVolatility: round(row.realizedVolatility), volatilityRank: round(row.volatilityRank),
    volatilityPercentile: round(row.volatilityPercentile), expansionScore: round(row.expansionScore),
    compressionScore: round(row.compressionScore), breakoutReadinessScore: round(row.breakoutReadinessScore),
    abnormalVolatilityRisk: round(row.abnormalVolatilityRisk), volatilityScore: round(row.volatilityScore), confidence: round(row.confidence)
  }));
}

async function matrixRows() {
  const scores = await scoreRows();
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset, timeframe) asset, timeframe, atr, volatility_state AS "volatilityState",
      expansion_compression_state AS "expansionCompressionState", confidence, observed_at AS "observedAt"
    FROM market.asset_volatility_timeframe_scores
    ORDER BY asset, timeframe, observed_at DESC
  `);
  const byAsset = new Map();
  for (const row of rows) {
    const entry = byAsset.get(row.asset) || {};
    entry[row.timeframe] = { atr: round(row.atr), volatilityState: row.volatilityState, expansionCompressionState: row.expansionCompressionState, confidence: round(row.confidence) };
    byAsset.set(row.asset, entry);
  }
  return scores.map(score => ({
    assetId: score.assetId,
    asset: score.asset,
    assetClass: score.assetClass,
    timeframes: byAsset.get(score.asset) || {},
    overallVolatility: score.overallVolatility,
    volatilityCondition: score.volatilityCondition,
    volatilityScore: score.volatilityScore,
    confidence: score.confidence,
    lastUpdated: score.lastScanned
  }));
}

async function rankingRows() {
  const { rows } = await safeQuery(`
    SELECT rank, asset_id AS "assetId", asset, asset_class AS "assetClass", atr, adr, realized_volatility AS "realizedVolatility",
      volatility_rank AS "volatilityRank", volatility_percentile AS "volatilityPercentile", expansion_score AS "expansionScore",
      compression_score AS "compressionScore", breakout_readiness AS "breakoutReadiness", abnormal_risk AS "abnormalRisk",
      volatility_score AS "volatilityScore", confidence, qualification, last_scanned AS "lastScanned"
    FROM market.asset_volatility_rankings
    ORDER BY rank NULLS LAST, volatility_score DESC NULLS LAST, last_scanned DESC
  `);
  if (rows.length) return rows.map(row => ({ ...row, atr: round(row.atr), adr: round(row.adr), realizedVolatility: round(row.realizedVolatility), volatilityRank: round(row.volatilityRank), volatilityPercentile: round(row.volatilityPercentile), expansionScore: round(row.expansionScore), compressionScore: round(row.compressionScore), volatilityScore: round(row.volatilityScore), confidence: round(row.confidence) }));
  return rank((await scoreRows()).sort((a, b) => Number(b.volatilityScore || 0) - Number(a.volatilityScore || 0)));
}

async function expansionRows() {
  const { rows } = await safeQuery(`SELECT asset, timeframe, previous_volatility AS "previousVolatility", current_volatility AS "currentVolatility", expansion_percent AS "expansionPercent", expansion_score AS "expansionScore", trend_support AS "trendSupport", momentum_support AS "momentumSupport", risk_level AS "riskLevel", recommended_action AS "recommendedAction", observed_at AS "observedAt" FROM market.asset_volatility_expansion_signals ORDER BY observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, previousVolatility: round(row.previousVolatility), currentVolatility: round(row.currentVolatility), expansionPercent: round(row.expansionPercent), expansionScore: round(row.expansionScore) }));
}

async function compressionRows() {
  const { rows } = await safeQuery(`SELECT asset, timeframe, compression_duration AS "compressionDuration", current_range AS "currentRange", average_range AS "averageRange", compression_percent AS "compressionPercent", breakout_readiness AS "breakoutReadiness", liquidity_context AS "liquidityContext", confidence, recommended_action AS "recommendedAction", observed_at AS "observedAt" FROM market.asset_volatility_compression_signals ORDER BY observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, currentRange: round(row.currentRange), averageRange: round(row.averageRange), compressionPercent: round(row.compressionPercent), breakoutReadiness: round(row.breakoutReadiness), confidence: round(row.confidence) }));
}

async function breakoutRows() {
  const { rows } = await safeQuery(`SELECT asset, setup_type AS "setupType", timeframe, compression_score AS "compressionScore", liquidity_support AS "liquiditySupport", momentum_support AS "momentumSupport", structure_support AS "structureSupport", breakout_readiness_score AS "breakoutReadinessScore", direction_bias AS "directionBias", confidence, observed_at AS "observedAt" FROM market.asset_breakout_readiness_signals ORDER BY observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, compressionScore: round(row.compressionScore), breakoutReadinessScore: round(row.breakoutReadinessScore), confidence: round(row.confidence) }));
}

async function abnormalRows() {
  const { rows } = await safeQuery(`SELECT asset, risk_type AS "riskType", timeframe, current_volatility AS "currentVolatility", normal_volatility AS "normalVolatility", deviation, severity, recommended_action AS "recommendedAction", observed_at AS "observedAt" FROM market.asset_abnormal_volatility_alerts ORDER BY observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, currentVolatility: round(row.currentVolatility), normalVolatility: round(row.normalVolatility), deviation: round(row.deviation) }));
}

async function weights() {
  const { rows } = await safeQuery(`SELECT component_key AS "componentKey", component_name AS "componentName", weight, enabled, updated_at AS "updatedAt" FROM market.volatility_scanner_weights ORDER BY component_name`);
  return rows;
}

async function aiSummary() {
  const { rows } = await safeQuery(`SELECT most_volatile_assets AS "mostVolatileAssets", calmest_assets AS "calmestAssets", best_breakout_ready_assets AS "bestBreakoutReadyAssets", assets_too_volatile_to_trade AS "assetsTooVolatileToTrade", compression_opportunities AS "compressionOpportunities", abnormal_volatility_risks AS "abnormalVolatilityRisks", assets_to_monitor AS "assetsToMonitor", assets_to_avoid AS "assetsToAvoid", recommended_next_step AS "recommendedNextStep", summary, generated_at AS "generatedAt" FROM market.volatility_scanner_ai_summaries ORDER BY generated_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function alerts() {
  const { rows } = await safeQuery(`SELECT alert_type AS "alertType", title, severity, asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.volatility_scanner_alerts ORDER BY created_at DESC LIMIT 80`);
  return rows;
}

async function audit(assetId = null) {
  const { rows } = await safeQuery(`SELECT asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.volatility_scanner_audit_logs ${assetId ? "WHERE asset_id = $1" : ""} ORDER BY created_at DESC LIMIT 80`, assetId ? [assetId] : []);
  return rows;
}

function buildSummary(scores, expansion, compression, breakoutReadiness, abnormalRisk, run) {
  const has = text => row => String(row.overallVolatility || row.volatilityCondition || "").includes(text);
  return {
    assetsScanned: scores.length || run?.assetsScanned || 0,
    highVolatilityAssets: scores.filter(row => ["Extreme", "High", "Elevated"].includes(row.overallVolatility) || ["Extreme", "High", "Elevated"].includes(row.volatilityCondition)).length,
    normalVolatilityAssets: scores.filter(has("Normal")).length,
    lowVolatilityAssets: scores.filter(row => ["Low", "Compressed"].includes(row.overallVolatility) || ["Low", "Compressed"].includes(row.volatilityCondition)).length,
    volatilityExpansionAssets: expansion.length,
    volatilityCompressionAssets: compression.length,
    breakoutReadyAssets: breakoutReadiness.length || scores.filter(has("Breakout Ready")).length,
    abnormalVolatilityAlerts: abnormalRisk.length,
    tooVolatileAssets: scores.filter(row => row.qualification === "Too Volatile").length,
    averageVolatilityScore: avg(scores.map(row => row.volatilityScore)),
    averageVolatilityConfidence: avg(scores.map(row => row.confidence)),
    scannerHealth: run?.health || (scores.length ? "Healthy" : "Insufficient Data")
  };
}

export async function getVolatilityScannerEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  const [run, scores, matrix, rankings, expansion, compression, breakoutReadiness, abnormalRisk, weightRows, ai, alertRows, auditRows] = await Promise.all([
    latestRun(), scoreRows(), matrixRows(), rankingRows(), expansionRows(), compressionRows(), breakoutRows(), abnormalRows(), weights(), aiSummary(), alerts(), audit()
  ]);
  if (!scores.length && !matrix.length && !rankings.length && !expansion.length && !compression.length && !breakoutReadiness.length && !abnormalRisk.length) {
    await syncAssetUniverseFromLiveSources();
    const live = await getVolatilityLiveSource();
    if (!live.scores.length) return { ...emptyState("EMPTY", "Volatility scanner cannot calculate volatility yet."), schemaReady: true, weights: weightRows, alerts: alertRows, audit: auditRows };
    const summary = buildSummary(live.scores, live.expansion, live.compression, live.breakoutReadiness, live.abnormalRisk, run);
    return {
      engine: "VolatilityScannerEngine",
      sourceMode: "LIVE_MARKET_INTELLIGENCE_SOURCES",
      mockDataDisabled: true,
      status: "READY",
      schemaReady: true,
      permissions: permissions(),
      badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastVolatilityScan: live.scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null, volatilityScannerHealth: summary.scannerHealth },
      summary, matrix: live.matrix, rankings: live.rankings, expansion: live.expansion, compression: live.compression,
      breakoutReadiness: live.breakoutReadiness, abnormalRisk: live.abnormalRisk, heatmap: live.matrix, weights: weightRows,
      aiSummary: ai, alerts: alertRows, audit: auditRows, emptyState: null
    };
  }
  const summary = buildSummary(scores, expansion, compression, breakoutReadiness, abnormalRisk, run);
  return {
    engine: "VolatilityScannerEngine",
    sourceMode: "LIVE_ASSETS_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastVolatilityScan: run?.completedAt || scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null, volatilityScannerHealth: summary.scannerHealth },
    summary, matrix, rankings, expansion, compression, breakoutReadiness, abnormalRisk, heatmap: matrix, weights: weightRows, aiSummary: ai, alerts: alertRows, audit: auditRows, emptyState: null
  };
}

export async function getVolatilitySlice(slice) {
  const data = await getVolatilityScannerEngine();
  const map = {
    summary: { status: data.status, summary: data.summary, badges: data.badges },
    matrix: { status: data.status, matrix: data.matrix },
    rankings: { status: data.status, rankings: data.rankings },
    expansion: { status: data.status, expansion: data.expansion },
    compression: { status: data.status, compression: data.compression },
    "breakout-readiness": { status: data.status, breakoutReadiness: data.breakoutReadiness },
    "abnormal-risk": { status: data.status, abnormalRisk: data.abnormalRisk },
    heatmap: { status: data.status, heatmap: data.heatmap },
    "ai-summary": { status: data.status, aiSummary: data.aiSummary },
    export: data
  };
  return map[slice] || data;
}

async function assertReady() {
  if (!isDatabaseConfigured()) { const error = new Error("database_not_configured"); error.status = 503; throw error; }
  const ready = await tableReadiness();
  if (!ready.ready) { const error = new Error("schema_not_ready"); error.status = 503; error.missingTables = ready.missing; throw error; }
}

export async function getVolatilityAssetDetail(assetId) {
  await assertReady();
  const data = await getVolatilityScannerEngine();
  const asset = data.rankings.find(row => String(row.assetId) === String(assetId) || row.asset === assetId) || data.matrix.find(row => String(row.assetId) === String(assetId) || row.asset === assetId);
  if (!asset) return null;
  return {
    asset,
    timeframeBreakdown: data.matrix.find(row => row.asset === asset.asset)?.timeframes || {},
    atrAdrSnapshot: data.rankings.find(row => row.asset === asset.asset) || asset,
    expansionHistory: data.expansion.filter(row => row.asset === asset.asset),
    compressionHistory: data.compression.filter(row => row.asset === asset.asset),
    breakoutReadinessBreakdown: data.breakoutReadiness.filter(row => row.asset === asset.asset),
    abnormalRisk: data.abnormalRisk.filter(row => row.asset === asset.asset),
    audit: await audit(asset.assetId || null)
  };
}

export async function runVolatilityAction(action, body = {}, actor = "api", assetId = null) {
  await assertReady();
  if (action === "run-scan" || action === "recalculate") {
    const runKey = `VOL-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
    await withTransaction(async client => {
      const run = await client.query("INSERT INTO market.volatility_scanner_runs (run_key, status, triggered_by, payload) VALUES ($1,'Queued',$2,$3::jsonb) RETURNING id", [runKey, actor, JSON.stringify({ action })]);
      await client.query("INSERT INTO market.volatility_scanner_audit_logs (run_id, user_name, action, after_value) VALUES ($1,$2,$3,$4::jsonb)", [run.rows[0].id, actor, action, JSON.stringify({ runKey, note: "Requires live candle and volatility records." })]);
    });
    return { accepted: true, type: `volatility.${action}.requested`, runKey };
  }
  if (action === "recalculate-asset") {
    await safeQuery("INSERT INTO market.volatility_scanner_audit_logs (asset_id, user_name, action, after_value) VALUES ($1,$2,'recalculate_asset',$3::jsonb)", [assetId, actor, JSON.stringify(body)]);
    return { accepted: true, type: "volatility.asset.recalculate.requested", assetId };
  }
  if (action === "create-alert") {
    const title = String(body.title || "Volatility scanner alert").trim();
    await safeQuery("INSERT INTO market.volatility_scanner_alerts (alert_type, title, severity, asset, payload, created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6)", [body.alertType || "operator_alert", title, body.severity || "Info", body.asset || null, JSON.stringify(body), actor]);
    await safeQuery("INSERT INTO market.volatility_scanner_audit_logs (user_name, action, after_value) VALUES ($1,'alert_created',$2::jsonb)", [actor, JSON.stringify({ title })]);
    return { accepted: true, type: "volatility.alert.created", title };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    await safeQuery("INSERT INTO market.volatility_scanner_audit_logs (user_name, action, after_value) VALUES ($1,$2,$3::jsonb)", [actor, action, JSON.stringify(body)]);
    return { accepted: true, type: `volatility.${action}.recorded` };
  }
  throw new Error("unsupported_volatility_action");
}

export async function exportVolatilityReport() {
  return { exportedAt: new Date().toISOString(), report: await getVolatilityScannerEngine() };
}
