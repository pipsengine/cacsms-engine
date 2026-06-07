import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { getTrendLiveSource, syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

export const TREND_SCANNER_TABLES = Object.freeze([
  "market.asset_trend_scores",
  "market.asset_trend_timeframe_scores",
  "market.asset_trend_rankings",
  "market.asset_trend_continuation_signals",
  "market.asset_trend_exhaustion_signals",
  "market.asset_breakout_breakdown_signals",
  "market.trend_scanner_weights",
  "market.trend_scanner_runs",
  "market.trend_scanner_ai_summaries",
  "market.trend_scanner_alerts",
  "market.trend_scanner_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.trend_scanner.view",
  runScan: "universe_scanner.trend_scanner.run_scan",
  recalculate: "universe_scanner.trend_scanner.recalculate",
  configureRules: "universe_scanner.trend_scanner.configure_rules",
  createAlert: "universe_scanner.trend_scanner.create_alert",
  export: "universe_scanner.trend_scanner.export"
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
  const { rows } = await query(
    "SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name",
    [TREND_SCANNER_TABLES]
  );
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    sourceMode: "LIVE_ASSETS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastTrendScan: null, trendScannerHealth: "Insufficient Data" },
    summary: {
      assetsScanned: 0,
      strongUptrends: 0,
      weakUptrends: 0,
      strongDowntrends: 0,
      weakDowntrends: 0,
      rangeBoundAssets: 0,
      breakoutCandidates: 0,
      breakdownCandidates: 0,
      exhaustionRisks: 0,
      averageTrendScore: null,
      averageTrendConfidence: null,
      trendScannerHealth: "Insufficient Data"
    },
    matrix: [],
    rankings: [],
    continuation: [],
    exhaustion: [],
    breakouts: [],
    heatmap: [],
    weights: [],
    aiSummary: null,
    alerts: [],
    audit: [],
    emptyState: {
      title: "Trend scanner cannot calculate trends yet.",
      message: "Register active assets, map broker symbols, sync historical candles, and run a live trend scan before viewing trend results.",
      actions: ["Open Asset Universe Registry", "Sync Historical Data", "Run Trend Scan", "Open Control Center"]
    }
  };
}

function rank(rows) {
  return rows.map((row, index) => ({ rank: row.rank || index + 1, ...row }));
}

async function latestRun() {
  const { rows } = await safeQuery(`SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "durationMs", assets_scanned AS "assetsScanned", health FROM market.trend_scanner_runs ORDER BY started_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function scoreRows() {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset) id, run_id AS "runId", asset_id AS "assetId", asset, asset_class AS "assetClass",
      overall_trend AS "overallTrend", trend_score AS "trendScore", trend_alignment AS "trendAlignment",
      continuation_probability AS "continuationProbability", exhaustion_probability AS "exhaustionProbability",
      breakout_probability AS "breakoutProbability", breakdown_probability AS "breakdownProbability",
      confidence, opportunity_impact AS "opportunityImpact", qualification, last_scanned AS "lastScanned"
    FROM market.asset_trend_scores
    ORDER BY asset, last_scanned DESC
  `);
  return rows.map(row => ({
    ...row,
    trendScore: round(row.trendScore),
    trendAlignment: round(row.trendAlignment),
    continuationProbability: round(row.continuationProbability),
    exhaustionProbability: round(row.exhaustionProbability),
    breakoutProbability: round(row.breakoutProbability),
    breakdownProbability: round(row.breakdownProbability),
    confidence: round(row.confidence)
  }));
}

async function matrixRows() {
  const scores = await scoreRows();
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset, timeframe) asset, timeframe, trend_direction AS "trendDirection",
      trend_strength AS "trendStrength", confidence, state, observed_at AS "observedAt"
    FROM market.asset_trend_timeframe_scores
    ORDER BY asset, timeframe, observed_at DESC
  `);
  const byAsset = new Map();
  for (const row of rows) {
    const entry = byAsset.get(row.asset) || {};
    entry[row.timeframe] = { trendDirection: row.trendDirection, trendStrength: round(row.trendStrength), confidence: round(row.confidence), state: row.state || row.trendDirection };
    byAsset.set(row.asset, entry);
  }
  return scores.map(score => ({
    asset: score.asset,
    assetClass: score.assetClass,
    timeframes: byAsset.get(score.asset) || {},
    overallTrend: score.overallTrend,
    trendAlignment: score.trendAlignment,
    trendScore: score.trendScore,
    confidence: score.confidence,
    lastUpdated: score.lastScanned
  }));
}

async function rankingRows() {
  const { rows } = await safeQuery(`
    SELECT rank, asset, asset_class AS "assetClass", overall_trend AS "overallTrend", trend_score AS "trendScore",
      trend_alignment AS "trendAlignment", continuation_probability AS "continuationProbability",
      exhaustion_risk AS "exhaustionRisk", breakout_breakdown_signal AS "breakoutBreakdownSignal",
      trend_confidence AS "trendConfidence", opportunity_impact AS "opportunityImpact", qualification,
      last_scanned AS "lastScanned"
    FROM market.asset_trend_rankings
    ORDER BY rank NULLS LAST, trend_score DESC NULLS LAST, last_scanned DESC
  `);
  if (rows.length) return rows.map(row => ({ ...row, trendScore: round(row.trendScore), trendAlignment: round(row.trendAlignment), continuationProbability: round(row.continuationProbability), exhaustionRisk: round(row.exhaustionRisk), trendConfidence: round(row.trendConfidence) }));
  return rank((await scoreRows()).sort((a, b) => Number(b.trendScore || 0) - Number(a.trendScore || 0)).map(row => ({
    asset: row.asset,
    assetClass: row.assetClass,
    overallTrend: row.overallTrend,
    trendScore: row.trendScore,
    trendAlignment: row.trendAlignment,
    continuationProbability: row.continuationProbability,
    exhaustionRisk: row.exhaustionProbability,
    breakoutBreakdownSignal: row.breakoutProbability >= row.breakdownProbability ? "Breakout" : "Breakdown",
    trendConfidence: row.confidence,
    opportunityImpact: row.opportunityImpact,
    qualification: row.qualification,
    lastScanned: row.lastScanned
  })));
}

async function continuationRows() {
  const { rows } = await safeQuery(`SELECT asset, direction, trend_score AS "trendScore", momentum_support AS "momentumSupport", volatility_support AS "volatilitySupport", structure_support AS "structureSupport", continuation_probability AS "continuationProbability", confidence, recommended_action AS "recommendedAction", observed_at AS "observedAt" FROM market.asset_trend_continuation_signals ORDER BY continuation_probability DESC NULLS LAST, observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, trendScore: round(row.trendScore), continuationProbability: round(row.continuationProbability), confidence: round(row.confidence) }));
}

async function exhaustionRows() {
  const { rows } = await safeQuery(`SELECT asset, direction, trend_age AS "trendAge", exhaustion_score AS "exhaustionScore", momentum_divergence AS "momentumDivergence", volatility_compression AS "volatilityCompression", liquidity_sweep_risk AS "liquiditySweepRisk", reversal_warning AS "reversalWarning", risk_level AS "riskLevel", observed_at AS "observedAt" FROM market.asset_trend_exhaustion_signals ORDER BY exhaustion_score DESC NULLS LAST, observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, exhaustionScore: round(row.exhaustionScore) }));
}

async function breakoutRows() {
  const { rows } = await safeQuery(`SELECT asset, signal_type AS "signalType", direction, break_level AS "breakLevel", confirmation_status AS "confirmationStatus", false_break_risk AS "falseBreakRisk", opportunity_score AS "opportunityScore", confidence, observed_at AS "observedAt" FROM market.asset_breakout_breakdown_signals ORDER BY opportunity_score DESC NULLS LAST, observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, opportunityScore: round(row.opportunityScore), confidence: round(row.confidence) }));
}

async function weights() {
  const { rows } = await safeQuery(`SELECT component_key AS "componentKey", component_name AS "componentName", weight, enabled, updated_at AS "updatedAt" FROM market.trend_scanner_weights ORDER BY component_name`);
  return rows;
}

async function aiSummary() {
  const { rows } = await safeQuery(`SELECT strongest_trend_assets AS "strongestTrendAssets", weakest_trend_assets AS "weakestTrendAssets", best_continuation_opportunities AS "bestContinuationOpportunities", exhaustion_risks AS "exhaustionRisks", breakout_candidates AS "breakoutCandidates", assets_to_avoid AS "assetsToAvoid", scanner_confidence AS "scannerConfidence", recommended_next_step AS "recommendedNextStep", summary, generated_at AS "generatedAt" FROM market.trend_scanner_ai_summaries ORDER BY generated_at DESC LIMIT 1`);
  return rows[0] ? { ...rows[0], scannerConfidence: round(rows[0].scannerConfidence) } : null;
}

async function alerts() {
  const { rows } = await safeQuery(`SELECT alert_type AS "alertType", title, severity, asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.trend_scanner_alerts ORDER BY created_at DESC LIMIT 80`);
  return rows;
}

async function audit(assetId = null) {
  const { rows } = await safeQuery(`SELECT asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.trend_scanner_audit_logs ${assetId ? "WHERE asset_id = $1" : ""} ORDER BY created_at DESC LIMIT 80`, assetId ? [assetId] : []);
  return rows;
}

function buildSummary(scores, continuation, exhaustion, breakouts, run) {
  const stateCount = label => scores.filter(row => row.overallTrend === label).length;
  return {
    assetsScanned: scores.length || run?.assetsScanned || 0,
    strongUptrends: stateCount("Strong Uptrend"),
    weakUptrends: stateCount("Weak Uptrend"),
    strongDowntrends: stateCount("Strong Downtrend"),
    weakDowntrends: stateCount("Weak Downtrend"),
    rangeBoundAssets: scores.filter(row => ["Sideways", "Range-Bound"].includes(row.overallTrend)).length,
    breakoutCandidates: breakouts.filter(row => /breakout/i.test(row.signalType || "")).length,
    breakdownCandidates: breakouts.filter(row => /breakdown/i.test(row.signalType || "")).length,
    exhaustionRisks: exhaustion.length,
    averageTrendScore: avg(scores.map(row => row.trendScore)),
    averageTrendConfidence: avg(scores.map(row => row.confidence)),
    trendScannerHealth: run?.health || (scores.length ? "Healthy" : "Insufficient Data")
  };
}

export async function getTrendScannerEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  const [run, scores, matrix, rankings, continuation, exhaustion, breakouts, weightRows, ai, alertRows, auditRows] = await Promise.all([
    latestRun(), scoreRows(), matrixRows(), rankingRows(), continuationRows(), exhaustionRows(), breakoutRows(), weights(), aiSummary(), alerts(), audit()
  ]);
  if (!scores.length && !matrix.length && !rankings.length) {
    await syncAssetUniverseFromLiveSources();
    const live = await getTrendLiveSource();
    if (!live.scores.length) return { ...emptyState("EMPTY", "Trend scanner cannot calculate trends yet."), schemaReady: true, weights: weightRows, alerts: alertRows, audit: auditRows };
    const summary = buildSummary(live.scores, [], [], [], run);
    return {
      sourceMode: "LIVE_MARKET_INTELLIGENCE_SOURCES",
      mockDataDisabled: true,
      status: "READY",
      schemaReady: true,
      permissions: permissions(),
      badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastTrendScan: live.scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null, trendScannerHealth: summary.trendScannerHealth },
      summary,
      matrix: live.matrix,
      rankings: live.rankings,
      continuation: [],
      exhaustion: [],
      breakouts: [],
      heatmap: live.matrix,
      weights: weightRows,
      aiSummary: ai,
      alerts: alertRows,
      audit: auditRows,
      emptyState: null
    };
  }
  const summary = buildSummary(scores, continuation, exhaustion, breakouts, run);
  return {
    sourceMode: "LIVE_ASSETS_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastTrendScan: run?.completedAt || scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null, trendScannerHealth: summary.trendScannerHealth },
    summary,
    matrix,
    rankings,
    continuation,
    exhaustion,
    breakouts,
    heatmap: matrix,
    weights: weightRows,
    aiSummary: ai,
    alerts: alertRows,
    audit: auditRows,
    emptyState: null
  };
}

export async function getTrendScannerSlice(slice) {
  const data = await getTrendScannerEngine();
  const map = {
    summary: { status: data.status, summary: data.summary, badges: data.badges },
    matrix: { status: data.status, matrix: data.matrix },
    rankings: { status: data.status, rankings: data.rankings },
    continuation: { status: data.status, continuation: data.continuation },
    exhaustion: { status: data.status, exhaustion: data.exhaustion },
    breakouts: { status: data.status, breakouts: data.breakouts },
    heatmap: { status: data.status, heatmap: data.heatmap },
    "ai-summary": { status: data.status, aiSummary: data.aiSummary },
    export: data
  };
  return map[slice] || data;
}

async function assertReady() {
  if (!isDatabaseConfigured()) {
    const error = new Error("database_not_configured");
    error.status = 503;
    throw error;
  }
  const ready = await tableReadiness();
  if (!ready.ready) {
    const error = new Error("schema_not_ready");
    error.status = 503;
    error.missingTables = ready.missing;
    throw error;
  }
}

export async function getTrendAssetDetail(assetId) {
  await assertReady();
  const data = await getTrendScannerEngine();
  const asset = data.rankings.find(row => String(row.assetId) === String(assetId) || row.asset === assetId) || data.matrix.find(row => String(row.assetId) === String(assetId) || row.asset === assetId);
  if (!asset) return null;
  return {
    asset,
    timeframeBreakdown: data.matrix.find(row => row.asset === asset.asset)?.timeframes || {},
    continuation: data.continuation.filter(row => row.asset === asset.asset),
    exhaustion: data.exhaustion.filter(row => row.asset === asset.asset),
    breakouts: data.breakouts.filter(row => row.asset === asset.asset),
    audit: await audit(asset.assetId || null)
  };
}

export async function runTrendScannerAction(action, body = {}, actor = "api", assetId = null) {
  await assertReady();
  if (action === "run-scan" || action === "recalculate") {
    const runKey = `TRD-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
    await withTransaction(async client => {
      const run = await client.query("INSERT INTO market.trend_scanner_runs (run_key, status, triggered_by, payload) VALUES ($1,'Queued',$2,$3::jsonb) RETURNING id", [runKey, actor, JSON.stringify({ action })]);
      await client.query("INSERT INTO market.trend_scanner_audit_logs (run_id, user_name, action, after_value) VALUES ($1,$2,$3,$4::jsonb)", [run.rows[0].id, actor, action, JSON.stringify({ runKey, note: "Requires live candle records." })]);
    });
    return { accepted: true, type: `trend_scanner.${action}.requested`, runKey };
  }
  if (action === "recalculate-asset") {
    await safeQuery("INSERT INTO market.trend_scanner_audit_logs (asset_id, user_name, action, after_value) VALUES ($1,$2,'recalculate_asset',$3::jsonb)", [assetId, actor, JSON.stringify(body)]);
    return { accepted: true, type: "trend_scanner.asset.recalculate.requested", assetId };
  }
  if (action === "create-alert") {
    const title = String(body.title || "Trend scanner alert").trim();
    await safeQuery("INSERT INTO market.trend_scanner_alerts (alert_type, title, severity, asset, payload, created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6)", [body.alertType || "operator_alert", title, body.severity || "Info", body.asset || null, JSON.stringify(body), actor]);
    await safeQuery("INSERT INTO market.trend_scanner_audit_logs (user_name, action, after_value) VALUES ($1,'alert_created',$2::jsonb)", [actor, JSON.stringify({ title })]);
    return { accepted: true, type: "trend_scanner.alert.created", title };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    await safeQuery("INSERT INTO market.trend_scanner_audit_logs (user_name, action, after_value) VALUES ($1,$2,$3::jsonb)", [actor, action, JSON.stringify(body)]);
    return { accepted: true, type: `trend_scanner.${action}.recorded` };
  }
  throw new Error("unsupported_trend_scanner_action");
}

export async function exportTrendScannerReport() {
  return { exportedAt: new Date().toISOString(), report: await getTrendScannerEngine() };
}
