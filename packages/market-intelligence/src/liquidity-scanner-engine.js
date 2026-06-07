import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { getLiquidityLiveSource, syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

export const LIQUIDITY_TABLES = Object.freeze([
  "market.asset_liquidity_scores",
  "market.asset_liquidity_timeframe_scores",
  "market.asset_liquidity_rankings",
  "market.asset_buy_side_liquidity_zones",
  "market.asset_sell_side_liquidity_zones",
  "market.asset_liquidity_sweeps",
  "market.asset_liquidity_voids",
  "market.asset_fair_value_gaps",
  "market.asset_stop_clusters",
  "market.asset_liquidity_broker_risks",
  "market.liquidity_scanner_weights",
  "market.liquidity_scanner_runs",
  "market.liquidity_scanner_ai_summaries",
  "market.liquidity_scanner_alerts",
  "market.liquidity_scanner_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.liquidity.view",
  runScan: "universe_scanner.liquidity.run_scan",
  recalculate: "universe_scanner.liquidity.recalculate",
  configureRules: "universe_scanner.liquidity.configure_rules",
  createAlert: "universe_scanner.liquidity.create_alert",
  export: "universe_scanner.liquidity.export"
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
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [LIQUIDITY_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "LiquidityScannerEngine",
    sourceMode: "LIVE_ASSETS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastLiquidityScan: null, liquidityScannerHealth: "Insufficient Data" },
    summary: {
      assetsScanned: 0,
      buySideLiquidityZones: 0,
      sellSideLiquidityZones: 0,
      equalHighZones: 0,
      equalLowZones: 0,
      recentLiquiditySweeps: 0,
      liquidityVoidAlerts: 0,
      stopClusterAlerts: 0,
      poorBrokerLiquidityAssets: 0,
      spreadRiskAssets: 0,
      averageLiquidityScore: null,
      averageLiquidityConfidence: null,
      scannerHealth: "Insufficient Data"
    },
    matrix: [],
    rankings: [],
    buySide: [],
    sellSide: [],
    sweeps: [],
    voids: [],
    stopClusters: [],
    brokerRisk: [],
    heatmap: [],
    weights: [],
    aiSummary: null,
    alerts: [],
    audit: [],
    emptyState: {
      title: "Liquidity scanner cannot calculate liquidity yet.",
      message: "Register active assets, map broker symbols, sync historical candles, connect broker liquidity data, and run a live liquidity scan before viewing liquidity results.",
      actions: ["Open Asset Universe Registry", "Sync Historical Data", "Open Broker Liquidity", "Run Liquidity Scan"]
    }
  };
}

function rank(rows) { return rows.map((row, index) => ({ rank: row.rank || index + 1, ...row })); }

async function latestRun() {
  const { rows } = await safeQuery(`SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "durationMs", assets_scanned AS "assetsScanned", health FROM market.liquidity_scanner_runs ORDER BY started_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function scoreRows() {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset) id, run_id AS "runId", asset_id AS "assetId", asset, asset_class AS "assetClass",
      nearest_buy_side_liquidity AS "nearestBuySideLiquidity", nearest_sell_side_liquidity AS "nearestSellSideLiquidity",
      liquidity_bias AS "liquidityBias", liquidity_score AS "liquidityScore", sweep_risk AS "sweepRisk",
      void_risk AS "voidRisk", stop_cluster_risk AS "stopClusterRisk", broker_liquidity_score AS "brokerLiquidityScore",
      spread_risk_score AS "spreadRiskScore", execution_risk AS "executionRisk", confidence, qualification,
      last_scanned AS "lastScanned"
    FROM market.asset_liquidity_scores
    ORDER BY asset, last_scanned DESC
  `);
  return rows.map(row => ({ ...row, liquidityScore: round(row.liquidityScore), brokerLiquidityScore: round(row.brokerLiquidityScore), spreadRiskScore: round(row.spreadRiskScore), confidence: round(row.confidence) }));
}

async function matrixRows() {
  const scores = await scoreRows();
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset, timeframe) asset, timeframe, buy_side_status AS "buySideStatus",
      sell_side_status AS "sellSideStatus", sweep_status AS "sweepStatus", liquidity_state AS "liquidityState",
      confidence, observed_at AS "observedAt"
    FROM market.asset_liquidity_timeframe_scores
    ORDER BY asset, timeframe, observed_at DESC
  `);
  const byAsset = new Map();
  for (const row of rows) {
    const entry = byAsset.get(row.asset) || {};
    entry[row.timeframe] = { buySideStatus: row.buySideStatus, sellSideStatus: row.sellSideStatus, sweepStatus: row.sweepStatus, liquidityState: row.liquidityState, confidence: round(row.confidence) };
    byAsset.set(row.asset, entry);
  }
  return scores.map(score => ({
    assetId: score.assetId,
    asset: score.asset,
    assetClass: score.assetClass,
    timeframes: byAsset.get(score.asset) || {},
    overallLiquidity: score.liquidityBias,
    liquidityScore: score.liquidityScore,
    sweepRisk: score.sweepRisk,
    executionRisk: score.executionRisk,
    confidence: score.confidence,
    lastUpdated: score.lastScanned
  }));
}

async function rankingRows() {
  const { rows } = await safeQuery(`
    SELECT rank, asset_id AS "assetId", asset, asset_class AS "assetClass",
      nearest_buy_side_liquidity AS "nearestBuySideLiquidity", nearest_sell_side_liquidity AS "nearestSellSideLiquidity",
      liquidity_bias AS "liquidityBias", liquidity_score AS "liquidityScore", sweep_risk AS "sweepRisk",
      void_risk AS "voidRisk", stop_cluster_risk AS "stopClusterRisk", broker_liquidity AS "brokerLiquidity",
      spread_risk AS "spreadRisk", execution_risk AS "executionRisk", confidence, qualification, last_scanned AS "lastScanned"
    FROM market.asset_liquidity_rankings
    ORDER BY rank NULLS LAST, liquidity_score DESC NULLS LAST, last_scanned DESC
  `);
  if (rows.length) return rows.map(row => ({ ...row, liquidityScore: round(row.liquidityScore), confidence: round(row.confidence) }));
  return rank((await scoreRows()).sort((a, b) => Number(b.liquidityScore || 0) - Number(a.liquidityScore || 0)));
}

async function zoneRows(table) {
  const { rows } = await safeQuery(`SELECT asset, timeframe, current_price AS "currentPrice", liquidity_level AS "liquidityLevel", liquidity_type AS "liquidityType", distance, strength, sweep_probability AS "sweepProbability", trend_context AS "trendContext", recommended_action AS "recommendedAction", observed_at AS "observedAt" FROM ${table} ORDER BY observed_at DESC LIMIT 100`);
  return rows.map(row => ({ ...row, sweepProbability: round(row.sweepProbability) }));
}

async function sweepRows() {
  const { rows } = await safeQuery(`SELECT asset, timeframe, sweep_type AS "sweepType", swept_level AS "sweptLevel", sweep_time AS "sweepTime", confirmation, reversal_probability AS "reversalProbability", continuation_probability AS "continuationProbability", confidence, risk_level AS "riskLevel", observed_at AS "observedAt" FROM market.asset_liquidity_sweeps ORDER BY observed_at DESC LIMIT 100`);
  return rows.map(row => ({ ...row, reversalProbability: round(row.reversalProbability), continuationProbability: round(row.continuationProbability), confidence: round(row.confidence) }));
}

async function voidRows() {
  const { rows } = await safeQuery(`SELECT asset, timeframe, void_type AS "voidType", price_zone AS "priceZone", gap_size AS "gapSize", fill_probability AS "fillProbability", direction, status, confidence, observed_at AS "observedAt" FROM market.asset_liquidity_voids ORDER BY observed_at DESC LIMIT 100`);
  return rows.map(row => ({ ...row, gapSize: round(row.gapSize), fillProbability: round(row.fillProbability), confidence: round(row.confidence) }));
}

async function stopRows() {
  const { rows } = await safeQuery(`SELECT asset, cluster_location AS "clusterLocation", price_level AS "priceLevel", cluster_type AS "clusterType", distance_from_price AS "distanceFromPrice", sweep_risk AS "sweepRisk", risk_level AS "riskLevel", recommended_action AS "recommendedAction", observed_at AS "observedAt" FROM market.asset_stop_clusters ORDER BY observed_at DESC LIMIT 100`);
  return rows;
}

async function brokerRows() {
  const { rows } = await safeQuery(`SELECT asset, broker, server, current_spread AS "currentSpread", average_spread AS "averageSpread", spread_widening_percent AS "spreadWideningPercent", broker_liquidity_score AS "brokerLiquidityScore", execution_quality AS "executionQuality", slippage_risk AS "slippageRisk", tradeability, observed_at AS "observedAt" FROM market.asset_liquidity_broker_risks ORDER BY observed_at DESC LIMIT 100`);
  return rows.map(row => ({ ...row, spreadWideningPercent: round(row.spreadWideningPercent), brokerLiquidityScore: round(row.brokerLiquidityScore) }));
}

async function weights() {
  const { rows } = await safeQuery(`SELECT component_key AS "componentKey", component_name AS "componentName", weight, enabled, updated_at AS "updatedAt" FROM market.liquidity_scanner_weights ORDER BY component_name`);
  return rows;
}

async function aiSummary() {
  const { rows } = await safeQuery(`SELECT most_attractive_liquidity_targets AS "mostAttractiveLiquidityTargets", recent_liquidity_sweeps AS "recentLiquiditySweeps", potential_stop_hunt_setups AS "potentialStopHuntSetups", liquidity_voids_likely_to_fill AS "liquidityVoidsLikelyToFill", poor_broker_liquidity_assets AS "poorBrokerLiquidityAssets", high_spread_risk_assets AS "highSpreadRiskAssets", best_liquidity_opportunities AS "bestLiquidityOpportunities", assets_to_avoid AS "assetsToAvoid", recommended_next_step AS "recommendedNextStep", summary, generated_at AS "generatedAt" FROM market.liquidity_scanner_ai_summaries ORDER BY generated_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function alerts() {
  const { rows } = await safeQuery(`SELECT alert_type AS "alertType", title, severity, asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.liquidity_scanner_alerts ORDER BY created_at DESC LIMIT 80`);
  return rows;
}

async function audit(assetId = null) {
  const { rows } = await safeQuery(`SELECT asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.liquidity_scanner_audit_logs ${assetId ? "WHERE asset_id = $1" : ""} ORDER BY created_at DESC LIMIT 80`, assetId ? [assetId] : []);
  return rows;
}

function buildSummary(scores, buySide, sellSide, sweeps, voids, stops, brokerRisk, run) {
  return {
    assetsScanned: scores.length || run?.assetsScanned || 0,
    buySideLiquidityZones: buySide.length,
    sellSideLiquidityZones: sellSide.length,
    equalHighZones: buySide.filter(row => /equal high/i.test(row.liquidityType || "")).length,
    equalLowZones: sellSide.filter(row => /equal low/i.test(row.liquidityType || "")).length,
    recentLiquiditySweeps: sweeps.length,
    liquidityVoidAlerts: voids.length,
    stopClusterAlerts: stops.length,
    poorBrokerLiquidityAssets: brokerRisk.filter(row => /avoid|caution|insufficient/i.test(row.tradeability || "")).length,
    spreadRiskAssets: brokerRisk.filter(row => Number(row.spreadWideningPercent || 0) > 0 || /risk|wide/i.test(row.slippageRisk || "")).length,
    averageLiquidityScore: avg(scores.map(row => row.liquidityScore)),
    averageLiquidityConfidence: avg(scores.map(row => row.confidence)),
    scannerHealth: run?.health || (scores.length ? "Healthy" : "Insufficient Data")
  };
}

export async function getLiquidityScannerEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  const [run, scores, matrix, rankings, buySide, sellSide, sweeps, voids, stopClusters, brokerRisk, weightRows, ai, alertRows, auditRows] = await Promise.all([
    latestRun(), scoreRows(), matrixRows(), rankingRows(), zoneRows("market.asset_buy_side_liquidity_zones"), zoneRows("market.asset_sell_side_liquidity_zones"), sweepRows(), voidRows(), stopRows(), brokerRows(), weights(), aiSummary(), alerts(), audit()
  ]);
  if (!scores.length && !matrix.length && !rankings.length && !buySide.length && !sellSide.length && !sweeps.length && !voids.length && !stopClusters.length && !brokerRisk.length) {
    await syncAssetUniverseFromLiveSources();
    const live = await getLiquidityLiveSource();
    if (!live.scores.length) return { ...emptyState("EMPTY", "Liquidity scanner cannot calculate liquidity yet."), schemaReady: true, weights: weightRows, alerts: alertRows, audit: auditRows };
    const summary = buildSummary(live.scores, live.buySide, live.sellSide, live.sweeps, live.voids, live.stopClusters, live.brokerRisk, run);
    return {
      engine: "LiquidityScannerEngine",
      sourceMode: "LIVE_MARKET_INTELLIGENCE_SOURCES",
      mockDataDisabled: true,
      status: "READY",
      schemaReady: true,
      permissions: permissions(),
      badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastLiquidityScan: live.scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null, liquidityScannerHealth: summary.scannerHealth },
      summary, matrix: live.matrix, rankings: live.rankings, buySide: live.buySide, sellSide: live.sellSide, sweeps: live.sweeps,
      voids: live.voids, stopClusters: live.stopClusters, brokerRisk: live.brokerRisk, heatmap: live.matrix, weights: weightRows,
      aiSummary: ai, alerts: alertRows, audit: auditRows, emptyState: null
    };
  }
  const summary = buildSummary(scores, buySide, sellSide, sweeps, voids, stopClusters, brokerRisk, run);
  return {
    engine: "LiquidityScannerEngine",
    sourceMode: "LIVE_ASSETS_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastLiquidityScan: run?.completedAt || scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null, liquidityScannerHealth: summary.scannerHealth },
    summary, matrix, rankings, buySide, sellSide, sweeps, voids, stopClusters, brokerRisk, heatmap: matrix, weights: weightRows, aiSummary: ai, alerts: alertRows, audit: auditRows, emptyState: null
  };
}

export async function getLiquiditySlice(slice) {
  const data = await getLiquidityScannerEngine();
  const map = {
    summary: { status: data.status, summary: data.summary, badges: data.badges },
    matrix: { status: data.status, matrix: data.matrix },
    rankings: { status: data.status, rankings: data.rankings },
    "buy-side": { status: data.status, buySide: data.buySide },
    "sell-side": { status: data.status, sellSide: data.sellSide },
    sweeps: { status: data.status, sweeps: data.sweeps },
    voids: { status: data.status, voids: data.voids },
    "stop-clusters": { status: data.status, stopClusters: data.stopClusters },
    "broker-risk": { status: data.status, brokerRisk: data.brokerRisk },
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

export async function getLiquidityAssetDetail(assetId) {
  await assertReady();
  const data = await getLiquidityScannerEngine();
  const asset = data.rankings.find(row => String(row.assetId) === String(assetId) || row.asset === assetId) || data.matrix.find(row => String(row.assetId) === String(assetId) || row.asset === assetId);
  if (!asset) return null;
  return {
    asset,
    timeframeBreakdown: data.matrix.find(row => row.asset === asset.asset)?.timeframes || {},
    buySideZones: data.buySide.filter(row => row.asset === asset.asset),
    sellSideZones: data.sellSide.filter(row => row.asset === asset.asset),
    sweepHistory: data.sweeps.filter(row => row.asset === asset.asset),
    voidZones: data.voids.filter(row => row.asset === asset.asset),
    stopClusters: data.stopClusters.filter(row => row.asset === asset.asset),
    brokerRisk: data.brokerRisk.filter(row => row.asset === asset.asset),
    audit: await audit(asset.assetId || null)
  };
}

export async function runLiquidityAction(action, body = {}, actor = "api", assetId = null) {
  await assertReady();
  if (action === "run-scan" || action === "recalculate") {
    const runKey = `LIQ-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
    await withTransaction(async client => {
      const run = await client.query("INSERT INTO market.liquidity_scanner_runs (run_key, status, triggered_by, payload) VALUES ($1,'Queued',$2,$3::jsonb) RETURNING id", [runKey, actor, JSON.stringify({ action })]);
      await client.query("INSERT INTO market.liquidity_scanner_audit_logs (run_id, user_name, action, after_value) VALUES ($1,$2,$3,$4::jsonb)", [run.rows[0].id, actor, action, JSON.stringify({ runKey, note: "Requires live candles and broker liquidity records." })]);
    });
    return { accepted: true, type: `liquidity.${action}.requested`, runKey };
  }
  if (action === "recalculate-asset") {
    await safeQuery("INSERT INTO market.liquidity_scanner_audit_logs (asset_id, user_name, action, after_value) VALUES ($1,$2,'recalculate_asset',$3::jsonb)", [assetId, actor, JSON.stringify(body)]);
    return { accepted: true, type: "liquidity.asset.recalculate.requested", assetId };
  }
  if (action === "create-alert") {
    const title = String(body.title || "Liquidity scanner alert").trim();
    await safeQuery("INSERT INTO market.liquidity_scanner_alerts (alert_type, title, severity, asset, payload, created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6)", [body.alertType || "operator_alert", title, body.severity || "Info", body.asset || null, JSON.stringify(body), actor]);
    await safeQuery("INSERT INTO market.liquidity_scanner_audit_logs (user_name, action, after_value) VALUES ($1,'alert_created',$2::jsonb)", [actor, JSON.stringify({ title })]);
    return { accepted: true, type: "liquidity.alert.created", title };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    await safeQuery("INSERT INTO market.liquidity_scanner_audit_logs (user_name, action, after_value) VALUES ($1,$2,$3::jsonb)", [actor, action, JSON.stringify(body)]);
    return { accepted: true, type: `liquidity.${action}.recorded` };
  }
  throw new Error("unsupported_liquidity_action");
}

export async function exportLiquidityReport() {
  return { exportedAt: new Date().toISOString(), report: await getLiquidityScannerEngine() };
}
