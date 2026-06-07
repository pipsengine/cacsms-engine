import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { getMomentumLiveSource, syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

export const MOMENTUM_TABLES = Object.freeze([
  "market.asset_momentum_scores",
  "market.asset_momentum_timeframe_scores",
  "market.asset_momentum_rankings",
  "market.asset_momentum_acceleration_signals",
  "market.asset_momentum_deceleration_signals",
  "market.asset_momentum_divergence_signals",
  "market.asset_momentum_exhaustion_signals",
  "market.momentum_scanner_weights",
  "market.momentum_scanner_runs",
  "market.momentum_scanner_ai_summaries",
  "market.momentum_scanner_alerts",
  "market.momentum_scanner_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.momentum.view",
  runScan: "universe_scanner.momentum.run_scan",
  recalculate: "universe_scanner.momentum.recalculate",
  configureRules: "universe_scanner.momentum.configure_rules",
  createAlert: "universe_scanner.momentum.create_alert",
  export: "universe_scanner.momentum.export"
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
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [MOMENTUM_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "MomentumScannerEngine",
    sourceMode: "LIVE_ASSETS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastMomentumScan: null, momentumScannerHealth: "Insufficient Data" },
    summary: {
      assetsScanned: 0,
      bullishMomentumAssets: 0,
      bearishMomentumAssets: 0,
      momentumAcceleration: 0,
      momentumDeceleration: 0,
      bullishDivergenceSignals: 0,
      bearishDivergenceSignals: 0,
      momentumExhaustionRisks: 0,
      momentumConfirmedTrends: 0,
      momentumRejectedAssets: 0,
      averageMomentumScore: null,
      averageMomentumConfidence: null,
      scannerHealth: "Insufficient Data"
    },
    matrix: [],
    rankings: [],
    acceleration: [],
    deceleration: [],
    divergence: [],
    exhaustion: [],
    heatmap: [],
    weights: [],
    aiSummary: null,
    alerts: [],
    audit: [],
    emptyState: {
      title: "Momentum scanner cannot calculate momentum yet.",
      message: "Register active assets, map broker symbols, sync historical candles, and run a live momentum scan before viewing momentum results.",
      actions: ["Open Asset Universe Registry", "Sync Historical Data", "Run Momentum Scan", "Open Control Center"]
    }
  };
}

function rank(rows) { return rows.map((row, index) => ({ rank: row.rank || index + 1, ...row })); }

async function latestRun() {
  const { rows } = await safeQuery(`SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "durationMs", assets_scanned AS "assetsScanned", health FROM market.momentum_scanner_runs ORDER BY started_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function scoreRows() {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset) id, run_id AS "runId", asset_id AS "assetId", asset, asset_class AS "assetClass",
      overall_momentum AS "overallMomentum", momentum_score AS "momentumScore", momentum_direction AS "momentumDirection",
      momentum_strength_score AS "momentumStrengthScore", acceleration_score AS "accelerationScore",
      deceleration_score AS "decelerationScore", alignment_score AS "alignmentScore", divergence_score AS "divergenceScore",
      exhaustion_risk AS "exhaustionRisk", confidence, opportunity_impact AS "opportunityImpact", qualification, last_scanned AS "lastScanned"
    FROM market.asset_momentum_scores
    ORDER BY asset, last_scanned DESC
  `);
  return rows.map(row => ({
    ...row,
    momentumScore: round(row.momentumScore),
    momentumStrengthScore: round(row.momentumStrengthScore),
    accelerationScore: round(row.accelerationScore),
    decelerationScore: round(row.decelerationScore),
    alignmentScore: round(row.alignmentScore),
    divergenceScore: round(row.divergenceScore),
    exhaustionRisk: round(row.exhaustionRisk),
    confidence: round(row.confidence)
  }));
}

async function matrixRows() {
  const scores = await scoreRows();
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset, timeframe) asset, timeframe, momentum_direction AS "momentumDirection",
      momentum_strength AS "momentumStrength", acceleration_state AS "accelerationState", confidence, state, observed_at AS "observedAt"
    FROM market.asset_momentum_timeframe_scores
    ORDER BY asset, timeframe, observed_at DESC
  `);
  const byAsset = new Map();
  for (const row of rows) {
    const entry = byAsset.get(row.asset) || {};
    entry[row.timeframe] = {
      momentumDirection: row.momentumDirection,
      momentumStrength: round(row.momentumStrength),
      accelerationState: row.accelerationState,
      confidence: round(row.confidence),
      state: row.state || row.momentumDirection
    };
    byAsset.set(row.asset, entry);
  }
  return scores.map(score => ({
    assetId: score.assetId,
    asset: score.asset,
    assetClass: score.assetClass,
    timeframes: byAsset.get(score.asset) || {},
    overallMomentum: score.overallMomentum,
    momentumAlignment: score.alignmentScore,
    momentumScore: score.momentumScore,
    confidence: score.confidence,
    lastUpdated: score.lastScanned
  }));
}

async function rankingRows() {
  const { rows } = await safeQuery(`
    SELECT rank, asset_id AS "assetId", asset, asset_class AS "assetClass", overall_momentum AS "overallMomentum",
      momentum_score AS "momentumScore", momentum_direction AS "momentumDirection", acceleration, deceleration,
      divergence_signal AS "divergenceSignal", exhaustion_risk AS "exhaustionRisk", confidence,
      opportunity_impact AS "opportunityImpact", qualification, last_scanned AS "lastScanned"
    FROM market.asset_momentum_rankings
    ORDER BY rank NULLS LAST, momentum_score DESC NULLS LAST, last_scanned DESC
  `);
  if (rows.length) return rows.map(row => ({ ...row, momentumScore: round(row.momentumScore), confidence: round(row.confidence) }));
  return rank((await scoreRows()).sort((a, b) => Number(b.momentumScore || 0) - Number(a.momentumScore || 0)));
}

async function accelerationRows() {
  const { rows } = await safeQuery(`SELECT asset, direction, previous_momentum AS "previousMomentum", current_momentum AS "currentMomentum", momentum_change AS "momentumChange", acceleration_score AS "accelerationScore", trend_support AS "trendSupport", structure_support AS "structureSupport", confidence, recommended_action AS "recommendedAction", observed_at AS "observedAt" FROM market.asset_momentum_acceleration_signals ORDER BY observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, previousMomentum: round(row.previousMomentum), currentMomentum: round(row.currentMomentum), momentumChange: round(row.momentumChange), accelerationScore: round(row.accelerationScore), confidence: round(row.confidence) }));
}

async function decelerationRows() {
  const { rows } = await safeQuery(`SELECT asset, direction, previous_momentum AS "previousMomentum", current_momentum AS "currentMomentum", momentum_change AS "momentumChange", deceleration_score AS "decelerationScore", exhaustion_risk AS "exhaustionRisk", risk_level AS "riskLevel", recommended_action AS "recommendedAction", observed_at AS "observedAt" FROM market.asset_momentum_deceleration_signals ORDER BY observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, previousMomentum: round(row.previousMomentum), currentMomentum: round(row.currentMomentum), momentumChange: round(row.momentumChange), decelerationScore: round(row.decelerationScore) }));
}

async function divergenceRows() {
  const { rows } = await safeQuery(`SELECT asset, timeframe, divergence_type AS "divergenceType", price_pattern AS "pricePattern", indicator_pattern AS "indicatorPattern", signal_strength AS "signalStrength", confirmation_status AS "confirmationStatus", risk_level AS "riskLevel", confidence, observed_at AS "observedAt" FROM market.asset_momentum_divergence_signals ORDER BY observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, signalStrength: round(row.signalStrength), confidence: round(row.confidence) }));
}

async function exhaustionRows() {
  const { rows } = await safeQuery(`SELECT asset, direction, exhaustion_type AS "exhaustionType", exhaustion_score AS "exhaustionScore", trend_age AS "trendAge", divergence_present AS "divergencePresent", liquidity_risk AS "liquidityRisk", reversal_warning AS "reversalWarning", confidence, observed_at AS "observedAt" FROM market.asset_momentum_exhaustion_signals ORDER BY observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, exhaustionScore: round(row.exhaustionScore), confidence: round(row.confidence) }));
}

async function weights() {
  const { rows } = await safeQuery(`SELECT component_key AS "componentKey", component_name AS "componentName", weight, enabled, updated_at AS "updatedAt" FROM market.momentum_scanner_weights ORDER BY component_name`);
  return rows;
}

async function aiSummary() {
  const { rows } = await safeQuery(`SELECT strongest_momentum_assets AS "strongestMomentumAssets", weakest_momentum_assets AS "weakestMomentumAssets", best_acceleration_opportunities AS "bestAccelerationOpportunities", deceleration_risks AS "decelerationRisks", divergence_warnings AS "divergenceWarnings", exhaustion_risks AS "exhaustionRisks", assets_to_monitor AS "assetsToMonitor", assets_to_avoid AS "assetsToAvoid", recommended_next_step AS "recommendedNextStep", summary, generated_at AS "generatedAt" FROM market.momentum_scanner_ai_summaries ORDER BY generated_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function alerts() {
  const { rows } = await safeQuery(`SELECT alert_type AS "alertType", title, severity, asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.momentum_scanner_alerts ORDER BY created_at DESC LIMIT 80`);
  return rows;
}

async function audit(assetId = null) {
  const { rows } = await safeQuery(`SELECT asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.momentum_scanner_audit_logs ${assetId ? "WHERE asset_id = $1" : ""} ORDER BY created_at DESC LIMIT 80`, assetId ? [assetId] : []);
  return rows;
}

function buildSummary(scores, acceleration, deceleration, divergence, exhaustion, run) {
  const includes = text => row => String(row.overallMomentum || row.momentumDirection || "").includes(text);
  return {
    assetsScanned: scores.length || run?.assetsScanned || 0,
    bullishMomentumAssets: scores.filter(includes("Bullish")).length,
    bearishMomentumAssets: scores.filter(includes("Bearish")).length,
    momentumAcceleration: acceleration.length,
    momentumDeceleration: deceleration.length,
    bullishDivergenceSignals: divergence.filter(row => /bullish/i.test(row.divergenceType || "")).length,
    bearishDivergenceSignals: divergence.filter(row => /bearish/i.test(row.divergenceType || "")).length,
    momentumExhaustionRisks: exhaustion.length,
    momentumConfirmedTrends: scores.filter(row => /confirm/i.test(row.opportunityImpact || "")).length,
    momentumRejectedAssets: scores.filter(row => row.qualification === "Rejected" || row.qualification === "Blocked").length,
    averageMomentumScore: avg(scores.map(row => row.momentumScore)),
    averageMomentumConfidence: avg(scores.map(row => row.confidence)),
    scannerHealth: run?.health || (scores.length ? "Healthy" : "Insufficient Data")
  };
}

export async function getMomentumScannerEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  const [run, scores, matrix, rankings, acceleration, deceleration, divergence, exhaustion, weightRows, ai, alertRows, auditRows] = await Promise.all([
    latestRun(), scoreRows(), matrixRows(), rankingRows(), accelerationRows(), decelerationRows(), divergenceRows(), exhaustionRows(), weights(), aiSummary(), alerts(), audit()
  ]);
  if (!scores.length && !matrix.length && !rankings.length && !acceleration.length && !deceleration.length && !divergence.length && !exhaustion.length) {
    await syncAssetUniverseFromLiveSources();
    const live = await getMomentumLiveSource();
    if (!live.scores.length) return { ...emptyState("EMPTY", "Momentum scanner cannot calculate momentum yet."), schemaReady: true, weights: weightRows, alerts: alertRows, audit: auditRows };
    const summary = buildSummary(live.scores, live.acceleration, live.deceleration, live.divergence, live.exhaustion, run);
    return {
      engine: "MomentumScannerEngine",
      sourceMode: "LIVE_MARKET_TICKS",
      mockDataDisabled: true,
      status: "READY",
      schemaReady: true,
      permissions: permissions(),
      badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastMomentumScan: live.scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null, momentumScannerHealth: summary.scannerHealth },
      summary, matrix: live.matrix, rankings: live.rankings, acceleration: live.acceleration, deceleration: live.deceleration,
      divergence: live.divergence, exhaustion: live.exhaustion, heatmap: live.matrix, weights: weightRows,
      aiSummary: ai, alerts: alertRows, audit: auditRows, emptyState: null
    };
  }
  const summary = buildSummary(scores, acceleration, deceleration, divergence, exhaustion, run);
  return {
    engine: "MomentumScannerEngine",
    sourceMode: "LIVE_ASSETS_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastMomentumScan: run?.completedAt || scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null, momentumScannerHealth: summary.scannerHealth },
    summary, matrix, rankings, acceleration, deceleration, divergence, exhaustion, heatmap: matrix, weights: weightRows, aiSummary: ai, alerts: alertRows, audit: auditRows, emptyState: null
  };
}

export async function getMomentumSlice(slice) {
  const data = await getMomentumScannerEngine();
  const map = {
    summary: { status: data.status, summary: data.summary, badges: data.badges },
    matrix: { status: data.status, matrix: data.matrix },
    rankings: { status: data.status, rankings: data.rankings },
    acceleration: { status: data.status, acceleration: data.acceleration },
    deceleration: { status: data.status, deceleration: data.deceleration },
    divergence: { status: data.status, divergence: data.divergence },
    exhaustion: { status: data.status, exhaustion: data.exhaustion },
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

export async function getMomentumAssetDetail(assetId) {
  await assertReady();
  const data = await getMomentumScannerEngine();
  const asset = data.rankings.find(row => String(row.assetId) === String(assetId) || row.asset === assetId) || data.matrix.find(row => String(row.assetId) === String(assetId) || row.asset === assetId);
  if (!asset) return null;
  return {
    asset,
    timeframeBreakdown: data.matrix.find(row => row.asset === asset.asset)?.timeframes || {},
    scoreBreakdown: data.weights,
    accelerationHistory: data.acceleration.filter(row => row.asset === asset.asset),
    decelerationHistory: data.deceleration.filter(row => row.asset === asset.asset),
    divergenceHistory: data.divergence.filter(row => row.asset === asset.asset),
    exhaustionRiskBreakdown: data.exhaustion.filter(row => row.asset === asset.asset),
    audit: await audit(asset.assetId || null)
  };
}

export async function runMomentumAction(action, body = {}, actor = "api", assetId = null) {
  await assertReady();
  if (action === "run-scan" || action === "recalculate") {
    const runKey = `MOM-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
    await withTransaction(async client => {
      const run = await client.query("INSERT INTO market.momentum_scanner_runs (run_key, status, triggered_by, payload) VALUES ($1,'Queued',$2,$3::jsonb) RETURNING id", [runKey, actor, JSON.stringify({ action })]);
      await client.query("INSERT INTO market.momentum_scanner_audit_logs (run_id, user_name, action, after_value) VALUES ($1,$2,$3,$4::jsonb)", [run.rows[0].id, actor, action, JSON.stringify({ runKey, note: "Requires live candle and indicator records." })]);
    });
    return { accepted: true, type: `momentum.${action}.requested`, runKey };
  }
  if (action === "recalculate-asset") {
    await safeQuery("INSERT INTO market.momentum_scanner_audit_logs (asset_id, user_name, action, after_value) VALUES ($1,$2,'recalculate_asset',$3::jsonb)", [assetId, actor, JSON.stringify(body)]);
    return { accepted: true, type: "momentum.asset.recalculate.requested", assetId };
  }
  if (action === "create-alert") {
    const title = String(body.title || "Momentum scanner alert").trim();
    await safeQuery("INSERT INTO market.momentum_scanner_alerts (alert_type, title, severity, asset, payload, created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6)", [body.alertType || "operator_alert", title, body.severity || "Info", body.asset || null, JSON.stringify(body), actor]);
    await safeQuery("INSERT INTO market.momentum_scanner_audit_logs (user_name, action, after_value) VALUES ($1,'alert_created',$2::jsonb)", [actor, JSON.stringify({ title })]);
    return { accepted: true, type: "momentum.alert.created", title };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    await safeQuery("INSERT INTO market.momentum_scanner_audit_logs (user_name, action, after_value) VALUES ($1,$2,$3::jsonb)", [actor, action, JSON.stringify(body)]);
    return { accepted: true, type: `momentum.${action}.recorded` };
  }
  throw new Error("unsupported_momentum_action");
}

export async function exportMomentumReport() {
  return { exportedAt: new Date().toISOString(), report: await getMomentumScannerEngine() };
}
