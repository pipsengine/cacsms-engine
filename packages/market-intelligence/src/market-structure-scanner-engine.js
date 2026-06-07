import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { getMarketStructureLiveSource, syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

export const MARKET_STRUCTURE_TABLES = Object.freeze([
  "market.asset_market_structure_scores",
  "market.asset_market_structure_timeframe_scores",
  "market.asset_market_structure_rankings",
  "market.asset_swing_points",
  "market.asset_bos_signals",
  "market.asset_choch_signals",
  "market.asset_structure_shift_signals",
  "market.market_structure_scanner_weights",
  "market.market_structure_scanner_runs",
  "market.market_structure_ai_summaries",
  "market.market_structure_alerts",
  "market.market_structure_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.market_structure.view",
  runScan: "universe_scanner.market_structure.run_scan",
  recalculate: "universe_scanner.market_structure.recalculate",
  configureRules: "universe_scanner.market_structure.configure_rules",
  createAlert: "universe_scanner.market_structure.create_alert",
  export: "universe_scanner.market_structure.export"
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
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [MARKET_STRUCTURE_TABLES]);
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
    badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastStructureScan: null, structureScannerHealth: "Insufficient Data" },
    summary: {
      assetsScanned: 0,
      bullishStructures: 0,
      bearishStructures: 0,
      neutralStructures: 0,
      rangeStructures: 0,
      breakOfStructureSignals: 0,
      changeOfCharacterSignals: 0,
      structureShiftAlerts: 0,
      liquidityBreakSignals: 0,
      structureQualifiedAssets: 0,
      averageStructureScore: null,
      averageStructureConfidence: null,
      scannerHealth: "Insufficient Data"
    },
    matrix: [],
    rankings: [],
    bos: [],
    choch: [],
    swingPoints: [],
    shifts: [],
    heatmap: [],
    weights: [],
    aiSummary: null,
    alerts: [],
    audit: [],
    emptyState: {
      title: "Market structure scanner cannot calculate structure yet.",
      message: "Register active assets, map broker symbols, sync historical candles, and run a live structure scan before viewing market structure results.",
      actions: ["Open Asset Universe Registry", "Sync Historical Data", "Run Structure Scan", "Open Control Center"]
    }
  };
}

function rank(rows) { return rows.map((row, index) => ({ rank: row.rank || index + 1, ...row })); }

async function latestRun() {
  const { rows } = await safeQuery(`SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "durationMs", assets_scanned AS "assetsScanned", health FROM market.market_structure_scanner_runs ORDER BY started_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function scoreRows() {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset) id, run_id AS "runId", asset_id AS "assetId", asset, asset_class AS "assetClass",
      overall_structure AS "overallStructure", last_swing_pattern AS "lastSwingPattern", latest_signal AS "latestSignal",
      signal_direction AS "signalDirection", structure_score AS "structureScore", alignment_score AS "alignmentScore",
      confidence, opportunity_impact AS "opportunityImpact", qualification, last_scanned AS "lastScanned"
    FROM market.asset_market_structure_scores
    ORDER BY asset, last_scanned DESC
  `);
  return rows.map(row => ({ ...row, structureScore: round(row.structureScore), alignmentScore: round(row.alignmentScore), confidence: round(row.confidence) }));
}

async function matrixRows() {
  const scores = await scoreRows();
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset, timeframe) asset, timeframe, structure_direction AS "structureDirection",
      last_swing_status AS "lastSwingStatus", bos_choch_status AS "bosChochStatus", confidence, state, observed_at AS "observedAt"
    FROM market.asset_market_structure_timeframe_scores
    ORDER BY asset, timeframe, observed_at DESC
  `);
  const byAsset = new Map();
  for (const row of rows) {
    const entry = byAsset.get(row.asset) || {};
    entry[row.timeframe] = { structureDirection: row.structureDirection, lastSwingStatus: row.lastSwingStatus, bosChochStatus: row.bosChochStatus, confidence: round(row.confidence), state: row.state || row.structureDirection };
    byAsset.set(row.asset, entry);
  }
  return scores.map(score => ({
    asset: score.asset,
    assetClass: score.assetClass,
    timeframes: byAsset.get(score.asset) || {},
    overallStructure: score.overallStructure,
    structureAlignment: score.alignmentScore,
    structureScore: score.structureScore,
    confidence: score.confidence,
    lastUpdated: score.lastScanned
  }));
}

async function rankingRows() {
  const { rows } = await safeQuery(`
    SELECT rank, asset, asset_class AS "assetClass", overall_structure AS "overallStructure",
      last_swing_pattern AS "lastSwingPattern", latest_signal AS "latestSignal", signal_direction AS "signalDirection",
      structure_score AS "structureScore", alignment_score AS "alignmentScore", confidence,
      opportunity_impact AS "opportunityImpact", qualification, last_scanned AS "lastScanned"
    FROM market.asset_market_structure_rankings
    ORDER BY rank NULLS LAST, structure_score DESC NULLS LAST, last_scanned DESC
  `);
  if (rows.length) return rows.map(row => ({ ...row, structureScore: round(row.structureScore), alignmentScore: round(row.alignmentScore), confidence: round(row.confidence) }));
  return rank((await scoreRows()).sort((a, b) => Number(b.structureScore || 0) - Number(a.structureScore || 0)));
}

async function bosRows() {
  const { rows } = await safeQuery(`SELECT asset, timeframe, direction, broken_level AS "brokenLevel", break_type AS "breakType", confirmation_type AS "confirmationType", candle_close AS "candleClose", retest_status AS "retestStatus", confidence, recommended_action AS "recommendedAction", observed_at AS "observedAt" FROM market.asset_bos_signals ORDER BY observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, confidence: round(row.confidence) }));
}

async function chochRows() {
  const { rows } = await safeQuery(`SELECT asset, timeframe, previous_structure AS "previousStructure", new_structure AS "newStructure", choch_level AS "chochLevel", confirmation, reversal_probability AS "reversalProbability", risk_level AS "riskLevel", confidence, recommended_action AS "recommendedAction", observed_at AS "observedAt" FROM market.asset_choch_signals ORDER BY observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, reversalProbability: round(row.reversalProbability), confidence: round(row.confidence) }));
}

async function swingRows() {
  const { rows } = await safeQuery(`SELECT asset, timeframe, latest_swing_high AS "swingHigh", latest_swing_high_time AS "swingHighTime", latest_swing_low AS "swingLow", latest_swing_low_time AS "swingLowTime", previous_swing_high AS "previousSwingHigh", previous_swing_low AS "previousSwingLow", current_price AS "currentPrice", distance_to_high AS "distanceToHigh", distance_to_low AS "distanceToLow", structure_context AS "structureContext", observed_at AS "observedAt" FROM market.asset_swing_points ORDER BY observed_at DESC LIMIT 120`);
  return rows;
}

async function shiftRows() {
  const { rows } = await safeQuery(`SELECT asset, shift_type AS "shiftType", previous_structure AS "previousStructure", new_structure AS "newStructure", confidence, observed_at AS "observedAt" FROM market.asset_structure_shift_signals ORDER BY observed_at DESC LIMIT 80`);
  return rows.map(row => ({ ...row, confidence: round(row.confidence) }));
}

async function weights() {
  const { rows } = await safeQuery(`SELECT component_key AS "componentKey", component_name AS "componentName", weight, enabled, updated_at AS "updatedAt" FROM market.market_structure_scanner_weights ORDER BY component_name`);
  return rows;
}

async function aiSummary() {
  const { rows } = await safeQuery(`SELECT strongest_bullish_structures AS "strongestBullishStructures", strongest_bearish_structures AS "strongestBearishStructures", recent_bos_signals AS "recentBosSignals", recent_choch_signals AS "recentChochSignals", potential_reversals AS "potentialReversals", false_break_risks AS "falseBreakRisks", assets_to_monitor AS "assetsToMonitor", assets_to_avoid AS "assetsToAvoid", recommended_next_step AS "recommendedNextStep", summary, generated_at AS "generatedAt" FROM market.market_structure_ai_summaries ORDER BY generated_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function alerts() {
  const { rows } = await safeQuery(`SELECT alert_type AS "alertType", title, severity, asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.market_structure_alerts ORDER BY created_at DESC LIMIT 80`);
  return rows;
}

async function audit(assetId = null) {
  const { rows } = await safeQuery(`SELECT asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.market_structure_audit_logs ${assetId ? "WHERE asset_id = $1" : ""} ORDER BY created_at DESC LIMIT 80`, assetId ? [assetId] : []);
  return rows;
}

function buildSummary(scores, bos, choch, shifts, swing, run) {
  const count = label => scores.filter(row => row.overallStructure === label).length;
  return {
    assetsScanned: scores.length || run?.assetsScanned || 0,
    bullishStructures: count("Bullish") + scores.filter(row => /Bullish/.test(row.overallStructure || "")).length,
    bearishStructures: count("Bearish") + scores.filter(row => /Bearish/.test(row.overallStructure || "")).length,
    neutralStructures: count("Neutral"),
    rangeStructures: count("Ranging"),
    breakOfStructureSignals: bos.length,
    changeOfCharacterSignals: choch.length,
    structureShiftAlerts: shifts.length,
    liquidityBreakSignals: bos.filter(row => /liquidity/i.test(row.breakType || "")).length,
    structureQualifiedAssets: scores.filter(row => row.qualification === "Structure Qualified").length,
    averageStructureScore: avg(scores.map(row => row.structureScore)),
    averageStructureConfidence: avg(scores.map(row => row.confidence)),
    scannerHealth: run?.health || (scores.length || swing.length ? "Healthy" : "Insufficient Data")
  };
}

export async function getMarketStructureScannerEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  const [run, scores, matrix, rankings, bos, choch, swingPoints, shifts, weightRows, ai, alertRows, auditRows] = await Promise.all([
    latestRun(), scoreRows(), matrixRows(), rankingRows(), bosRows(), chochRows(), swingRows(), shiftRows(), weights(), aiSummary(), alerts(), audit()
  ]);
  if (!scores.length && !matrix.length && !rankings.length && !bos.length && !choch.length) {
    await syncAssetUniverseFromLiveSources();
    const live = await getMarketStructureLiveSource();
    if (!live.scores.length) return { ...emptyState("EMPTY", "Market structure scanner cannot calculate structure yet."), schemaReady: true, weights: weightRows, alerts: alertRows, audit: auditRows };
    const summary = buildSummary(live.scores, live.bos, live.choch, live.shifts, live.swingPoints, run);
    return {
      sourceMode: "LIVE_MARKET_INTELLIGENCE_SOURCES",
      mockDataDisabled: true,
      status: "READY",
      schemaReady: true,
      permissions: permissions(),
      badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastStructureScan: live.scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null, structureScannerHealth: summary.scannerHealth },
      summary, matrix: live.matrix, rankings: live.rankings, bos: live.bos, choch: live.choch,
      swingPoints: live.swingPoints, shifts: live.shifts, heatmap: live.matrix, weights: weightRows,
      aiSummary: ai, alerts: alertRows, audit: auditRows, emptyState: null
    };
  }
  const summary = buildSummary(scores, bos, choch, shifts, swingPoints, run);
  return {
    sourceMode: "LIVE_ASSETS_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveAssetsOnly: true, lastStructureScan: run?.completedAt || scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null, structureScannerHealth: summary.scannerHealth },
    summary, matrix, rankings, bos, choch, swingPoints, shifts, heatmap: matrix, weights: weightRows, aiSummary: ai, alerts: alertRows, audit: auditRows, emptyState: null
  };
}

export async function getMarketStructureSlice(slice) {
  const data = await getMarketStructureScannerEngine();
  const map = {
    summary: { status: data.status, summary: data.summary, badges: data.badges },
    matrix: { status: data.status, matrix: data.matrix },
    rankings: { status: data.status, rankings: data.rankings },
    bos: { status: data.status, bos: data.bos },
    choch: { status: data.status, choch: data.choch },
    "swing-points": { status: data.status, swingPoints: data.swingPoints },
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

export async function getMarketStructureAssetDetail(assetId) {
  await assertReady();
  const data = await getMarketStructureScannerEngine();
  const asset = data.rankings.find(row => String(row.assetId) === String(assetId) || row.asset === assetId) || data.matrix.find(row => String(row.assetId) === String(assetId) || row.asset === assetId);
  if (!asset) return null;
  return {
    asset,
    timeframeBreakdown: data.matrix.find(row => row.asset === asset.asset)?.timeframes || {},
    swingPoints: data.swingPoints.filter(row => row.asset === asset.asset),
    bos: data.bos.filter(row => row.asset === asset.asset),
    choch: data.choch.filter(row => row.asset === asset.asset),
    shifts: data.shifts.filter(row => row.asset === asset.asset),
    audit: await audit(asset.assetId || null)
  };
}

export async function runMarketStructureAction(action, body = {}, actor = "api", assetId = null) {
  await assertReady();
  if (action === "run-scan" || action === "recalculate") {
    const runKey = `MSS-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
    await withTransaction(async client => {
      const run = await client.query("INSERT INTO market.market_structure_scanner_runs (run_key, status, triggered_by, payload) VALUES ($1,'Queued',$2,$3::jsonb) RETURNING id", [runKey, actor, JSON.stringify({ action })]);
      await client.query("INSERT INTO market.market_structure_audit_logs (run_id, user_name, action, after_value) VALUES ($1,$2,$3,$4::jsonb)", [run.rows[0].id, actor, action, JSON.stringify({ runKey, note: "Requires live candle records." })]);
    });
    return { accepted: true, type: `market_structure.${action}.requested`, runKey };
  }
  if (action === "recalculate-asset") {
    await safeQuery("INSERT INTO market.market_structure_audit_logs (asset_id, user_name, action, after_value) VALUES ($1,$2,'recalculate_asset',$3::jsonb)", [assetId, actor, JSON.stringify(body)]);
    return { accepted: true, type: "market_structure.asset.recalculate.requested", assetId };
  }
  if (action === "create-alert") {
    const title = String(body.title || "Market structure alert").trim();
    await safeQuery("INSERT INTO market.market_structure_alerts (alert_type, title, severity, asset, payload, created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6)", [body.alertType || "operator_alert", title, body.severity || "Info", body.asset || null, JSON.stringify(body), actor]);
    await safeQuery("INSERT INTO market.market_structure_audit_logs (user_name, action, after_value) VALUES ($1,'alert_created',$2::jsonb)", [actor, JSON.stringify({ title })]);
    return { accepted: true, type: "market_structure.alert.created", title };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    await safeQuery("INSERT INTO market.market_structure_audit_logs (user_name, action, after_value) VALUES ($1,$2,$3::jsonb)", [actor, action, JSON.stringify(body)]);
    return { accepted: true, type: `market_structure.${action}.recorded` };
  }
  throw new Error("unsupported_market_structure_action");
}

export async function exportMarketStructureReport() {
  return { exportedAt: new Date().toISOString(), report: await getMarketStructureScannerEngine() };
}
