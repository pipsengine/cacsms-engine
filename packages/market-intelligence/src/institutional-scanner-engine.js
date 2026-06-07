import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { getInstitutionalLiveSource, syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

export const INSTITUTIONAL_SCANNER_TABLES = Object.freeze([
  "market.asset_institutional_scores",
  "market.asset_institutional_timeframe_scores",
  "market.asset_institutional_rankings",
  "market.asset_cot_alignment_scores",
  "market.asset_accumulation_distribution_signals",
  "market.asset_smart_money_signals",
  "market.asset_order_block_signals",
  "market.asset_fair_value_gap_signals",
  "market.asset_institutional_liquidity_confirmations",
  "market.institutional_scanner_weights",
  "market.institutional_scanner_runs",
  "market.institutional_scanner_ai_summaries",
  "market.institutional_scanner_alerts",
  "market.institutional_scanner_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.institutional.view",
  runScan: "universe_scanner.institutional.run_scan",
  recalculate: "universe_scanner.institutional.recalculate",
  configureRules: "universe_scanner.institutional.configure_rules",
  createAlert: "universe_scanner.institutional.create_alert",
  export: "universe_scanner.institutional.export"
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
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [INSTITUTIONAL_SCANNER_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "InstitutionalScannerEngine",
    sourceMode: "LIVE_INSTITUTIONAL_INPUTS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveInstitutionalInputsOnly: true, lastInstitutionalScan: null, institutionalScannerHealth: "Insufficient Data" },
    summary: {
      assetsScanned: 0,
      institutionalBullishAssets: 0,
      institutionalBearishAssets: 0,
      accumulationSignals: 0,
      distributionSignals: 0,
      cotAlignedAssets: 0,
      cotDivergenceAssets: 0,
      orderBlockSignals: 0,
      fairValueGapSignals: 0,
      liquiditySweepConfirmations: 0,
      institutionalQualifiedAssets: 0,
      averageInstitutionalScore: null,
      averageInstitutionalConfidence: null,
      scannerHealth: "Insufficient Data"
    },
    matrix: [],
    rankings: [],
    cotAlignment: [],
    accumulationDistribution: [],
    smc: [],
    liquidityConfirmation: [],
    orderBlocksFvg: [],
    heatmap: [],
    weights: [],
    aiSummary: null,
    alerts: [],
    audit: [],
    emptyState: {
      title: "Institutional scanner cannot calculate institutional bias yet.",
      message: "Register active assets, sync COT reports, connect institutional intelligence inputs, sync historical data, and run an institutional scan before viewing results.",
      actions: ["Open Asset Universe Registry", "Open Institutional Intelligence", "Sync COT Reports", "Run Institutional Scan"]
    }
  };
}

function rank(rows) { return rows.map((row, index) => ({ rank: row.rank || index + 1, ...row })); }

async function latestRun() {
  const { rows } = await safeQuery(`SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "durationMs", assets_scanned AS "assetsScanned", health FROM market.institutional_scanner_runs ORDER BY started_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function scoreRows() {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset) id, run_id AS "runId", asset_id AS "assetId", asset, asset_class AS "assetClass",
      institutional_bias AS "institutionalBias", cot_bias AS "cotBias", smart_money_bias AS "smartMoneyBias",
      accumulation_distribution AS "accumulationDistribution", liquidity_confirmation AS "liquidityConfirmation",
      order_block_signal AS "orderBlockSignal", fvg_signal AS "fvgSignal", institutional_score AS "institutionalScore",
      confidence, qualification, last_scanned AS "lastScanned"
    FROM market.asset_institutional_scores
    ORDER BY asset, last_scanned DESC
  `);
  return rows.map(row => ({ ...row, institutionalScore: round(row.institutionalScore), confidence: round(row.confidence) }));
}

async function matrixRows() {
  const scores = await scoreRows();
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset, timeframe) asset, timeframe, institutional_bias AS "institutionalBias",
      smc_signal AS "smcSignal", liquidity_confirmation AS "liquidityConfirmation", confidence, observed_at AS "observedAt"
    FROM market.asset_institutional_timeframe_scores
    ORDER BY asset, timeframe, observed_at DESC
  `);
  const byAsset = new Map();
  for (const row of rows) {
    const entry = byAsset.get(row.asset) || {};
    entry[row.timeframe] = { institutionalBias: row.institutionalBias, smcSignal: row.smcSignal, liquidityConfirmation: row.liquidityConfirmation, confidence: round(row.confidence) };
    byAsset.set(row.asset, entry);
  }
  return scores.map(score => ({
    assetId: score.assetId,
    asset: score.asset,
    assetClass: score.assetClass,
    timeframes: byAsset.get(score.asset) || {},
    cotBias: score.cotBias,
    smartMoneyBias: score.smartMoneyBias,
    institutionalScore: score.institutionalScore,
    confidence: score.confidence,
    lastUpdated: score.lastScanned
  }));
}

async function rankingRows() {
  const { rows } = await safeQuery(`
    SELECT rank, asset_id AS "assetId", asset, asset_class AS "assetClass", institutional_bias AS "institutionalBias",
      cot_bias AS "cotBias", smart_money_bias AS "smartMoneyBias", accumulation_distribution AS "accumulationDistribution",
      liquidity_confirmation AS "liquidityConfirmation", order_block_signal AS "orderBlockSignal", fvg_signal AS "fvgSignal",
      institutional_score AS "institutionalScore", confidence, qualification, last_scanned AS "lastScanned"
    FROM market.asset_institutional_rankings
    ORDER BY rank NULLS LAST, institutional_score DESC NULLS LAST, last_scanned DESC
  `);
  if (rows.length) return rows.map(row => ({ ...row, institutionalScore: round(row.institutionalScore), confidence: round(row.confidence) }));
  return rank((await scoreRows()).sort((a, b) => Number(b.institutionalScore || 0) - Number(a.institutionalScore || 0)));
}

async function cotRows() {
  const { rows } = await safeQuery(`SELECT asset, cot_market AS "cotMarket", commercial_net AS "commercialNet", large_spec_net AS "largeSpecNet", small_spec_net AS "smallSpecNet", open_interest AS "openInterest", weekly_change AS "weeklyChange", cot_bias AS "cotBias", cot_alignment AS "cotAlignment", extreme_positioning AS "extremePositioning", last_report_date AS "lastReportDate", observed_at AS "observedAt" FROM market.asset_cot_alignment_scores ORDER BY observed_at DESC LIMIT 100`);
  return rows.map(row => ({ ...row, commercialNet: round(row.commercialNet), largeSpecNet: round(row.largeSpecNet), smallSpecNet: round(row.smallSpecNet), openInterest: round(row.openInterest), weeklyChange: round(row.weeklyChange) }));
}

async function accDistRows() {
  const { rows } = await safeQuery(`SELECT asset, timeframe, state, evidence, structure_context AS "structureContext", volume_tick_context AS "volumeTickContext", liquidity_context AS "liquidityContext", confidence, recommended_action AS "recommendedAction", observed_at AS "observedAt" FROM market.asset_accumulation_distribution_signals ORDER BY observed_at DESC LIMIT 100`);
  return rows.map(row => ({ ...row, confidence: round(row.confidence) }));
}

async function smcRows() {
  const { rows } = await safeQuery(`SELECT asset, smc_signal AS "smcSignal", direction, timeframe, price_zone AS "priceZone", strength, confirmation, invalidation_level AS "invalidationLevel", status, observed_at AS "observedAt" FROM market.asset_smart_money_signals ORDER BY observed_at DESC LIMIT 100`);
  return rows;
}

async function liquidityRows() {
  const { rows } = await safeQuery(`SELECT asset, sweep_type AS "sweepType", swept_level AS "sweptLevel", sweep_time AS "sweepTime", structure_reaction AS "structureReaction", institutional_confirmation AS "institutionalConfirmation", reversal_probability AS "reversalProbability", continuation_probability AS "continuationProbability", confidence, observed_at AS "observedAt" FROM market.asset_institutional_liquidity_confirmations ORDER BY observed_at DESC LIMIT 100`);
  return rows.map(row => ({ ...row, reversalProbability: round(row.reversalProbability), continuationProbability: round(row.continuationProbability), confidence: round(row.confidence) }));
}

async function orderBlockFvgRows() {
  const orderBlocks = await safeQuery(`SELECT asset, signal_type AS "signalType", direction, timeframe, price_zone AS "priceZone", created_at_signal AS "createdAt", mitigation_status AS "mitigationStatus", strength, confidence, observed_at AS "observedAt" FROM market.asset_order_block_signals ORDER BY observed_at DESC LIMIT 80`);
  const fvgs = await safeQuery(`SELECT asset, signal_type AS "signalType", direction, timeframe, price_zone AS "priceZone", created_at_signal AS "createdAt", mitigation_status AS "mitigationStatus", strength, confidence, observed_at AS "observedAt" FROM market.asset_fair_value_gap_signals ORDER BY observed_at DESC LIMIT 80`);
  return [...orderBlocks.rows, ...fvgs.rows].map(row => ({ ...row, confidence: round(row.confidence) }));
}

async function weights() {
  const { rows } = await safeQuery(`SELECT component_key AS "componentKey", component_name AS "componentName", weight, enabled, updated_at AS "updatedAt" FROM market.institutional_scanner_weights ORDER BY component_name`);
  return rows;
}

async function aiSummary() {
  const { rows } = await safeQuery(`SELECT strongest_institutional_buy_assets AS "strongestInstitutionalBuyAssets", strongest_institutional_sell_assets AS "strongestInstitutionalSellAssets", cot_aligned_opportunities AS "cotAlignedOpportunities", cot_divergent_warnings AS "cotDivergentWarnings", accumulation_zones AS "accumulationZones", distribution_zones AS "distributionZones", smart_money_setups AS "smartMoneySetups", liquidity_sweep_confirmations AS "liquiditySweepConfirmations", institutional_opportunities_to_monitor AS "institutionalOpportunitiesToMonitor", assets_to_avoid AS "assetsToAvoid", recommended_next_step AS "recommendedNextStep", summary, generated_at AS "generatedAt" FROM market.institutional_scanner_ai_summaries ORDER BY generated_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function alerts() {
  const { rows } = await safeQuery(`SELECT alert_type AS "alertType", title, severity, asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.institutional_scanner_alerts ORDER BY created_at DESC LIMIT 80`);
  return rows;
}

async function audit(assetId = null) {
  const { rows } = await safeQuery(`SELECT asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.institutional_scanner_audit_logs ${assetId ? "WHERE asset_id = $1" : ""} ORDER BY created_at DESC LIMIT 80`, assetId ? [assetId] : []);
  return rows;
}

function buildSummary(scores, cot, accDist, smc, liquidity, orderBlocksFvg, run) {
  return {
    assetsScanned: scores.length || run?.assetsScanned || 0,
    institutionalBullishAssets: scores.filter(row => /buy|bullish/i.test(row.institutionalBias || "")).length,
    institutionalBearishAssets: scores.filter(row => /sell|bearish/i.test(row.institutionalBias || "")).length,
    accumulationSignals: accDist.filter(row => /accumulation/i.test(row.state || "")).length,
    distributionSignals: accDist.filter(row => /distribution/i.test(row.state || "")).length,
    cotAlignedAssets: cot.filter(row => /aligned/i.test(row.cotAlignment || "")).length,
    cotDivergenceAssets: cot.filter(row => /divergent/i.test(row.cotAlignment || "")).length,
    orderBlockSignals: orderBlocksFvg.filter(row => /order block|breaker|mitigation/i.test(row.signalType || "")).length,
    fairValueGapSignals: orderBlocksFvg.filter(row => /fvg|fair value/i.test(row.signalType || "")).length,
    liquiditySweepConfirmations: liquidity.length,
    institutionalQualifiedAssets: scores.filter(row => row.qualification === "Institutional Qualified").length,
    averageInstitutionalScore: avg(scores.map(row => row.institutionalScore)),
    averageInstitutionalConfidence: avg(scores.map(row => row.confidence)),
    scannerHealth: run?.health || (scores.length ? "Healthy" : "Insufficient Data")
  };
}

export async function getInstitutionalScannerEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  const [run, scores, matrix, rankings, cotAlignment, accumulationDistribution, smc, liquidityConfirmation, orderBlocksFvg, weightRows, ai, alertRows, auditRows] = await Promise.all([
    latestRun(), scoreRows(), matrixRows(), rankingRows(), cotRows(), accDistRows(), smcRows(), liquidityRows(), orderBlockFvgRows(), weights(), aiSummary(), alerts(), audit()
  ]);
  if (!scores.length && !matrix.length && !rankings.length && !cotAlignment.length && !accumulationDistribution.length && !smc.length && !liquidityConfirmation.length && !orderBlocksFvg.length) {
    await syncAssetUniverseFromLiveSources();
    const live = await getInstitutionalLiveSource();
    if (!live.scores.length) return { ...emptyState("EMPTY", "Institutional scanner cannot calculate institutional bias yet."), schemaReady: true, weights: weightRows, alerts: alertRows, audit: auditRows };
    const summary = buildSummary(live.scores, live.cotAlignment, live.accumulationDistribution, live.smc, live.liquidityConfirmation, live.orderBlocksFvg, run);
    return {
      engine: "InstitutionalScannerEngine",
      sourceMode: "LIVE_INSTITUTIONAL_INPUTS_ONLY",
      mockDataDisabled: true,
      status: "READY",
      schemaReady: true,
      permissions: permissions(),
      badges: { productionLive: true, mockDataDisabled: true, liveInstitutionalInputsOnly: true, lastInstitutionalScan: live.scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null, institutionalScannerHealth: summary.scannerHealth },
      summary, matrix: live.matrix, rankings: live.rankings, cotAlignment: live.cotAlignment, accumulationDistribution: live.accumulationDistribution,
      smc: live.smc, liquidityConfirmation: live.liquidityConfirmation, orderBlocksFvg: live.orderBlocksFvg, heatmap: live.matrix,
      weights: weightRows, aiSummary: ai, alerts: alertRows, audit: auditRows, emptyState: null
    };
  }
  const summary = buildSummary(scores, cotAlignment, accumulationDistribution, smc, liquidityConfirmation, orderBlocksFvg, run);
  return {
    engine: "InstitutionalScannerEngine",
    sourceMode: "LIVE_INSTITUTIONAL_INPUTS_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveInstitutionalInputsOnly: true, lastInstitutionalScan: run?.completedAt || scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null, institutionalScannerHealth: summary.scannerHealth },
    summary, matrix, rankings, cotAlignment, accumulationDistribution, smc, liquidityConfirmation, orderBlocksFvg, heatmap: matrix, weights: weightRows, aiSummary: ai, alerts: alertRows, audit: auditRows, emptyState: null
  };
}

export async function getInstitutionalScannerSlice(slice) {
  const data = await getInstitutionalScannerEngine();
  const map = {
    summary: { status: data.status, summary: data.summary, badges: data.badges },
    matrix: { status: data.status, matrix: data.matrix },
    rankings: { status: data.status, rankings: data.rankings },
    "cot-alignment": { status: data.status, cotAlignment: data.cotAlignment },
    "accumulation-distribution": { status: data.status, accumulationDistribution: data.accumulationDistribution },
    smc: { status: data.status, smc: data.smc },
    "liquidity-confirmation": { status: data.status, liquidityConfirmation: data.liquidityConfirmation },
    "order-blocks-fvg": { status: data.status, orderBlocksFvg: data.orderBlocksFvg },
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

export async function getInstitutionalScannerAssetDetail(assetId) {
  await assertReady();
  const data = await getInstitutionalScannerEngine();
  const asset = data.rankings.find(row => String(row.assetId) === String(assetId) || row.asset === assetId) || data.matrix.find(row => String(row.assetId) === String(assetId) || row.asset === assetId);
  if (!asset) return null;
  return {
    asset,
    timeframeBreakdown: data.matrix.find(row => row.asset === asset.asset)?.timeframes || {},
    cot: data.cotAlignment.filter(row => row.asset === asset.asset),
    accumulationDistribution: data.accumulationDistribution.filter(row => row.asset === asset.asset),
    smc: data.smc.filter(row => row.asset === asset.asset),
    liquidityConfirmation: data.liquidityConfirmation.filter(row => row.asset === asset.asset),
    orderBlocksFvg: data.orderBlocksFvg.filter(row => row.asset === asset.asset),
    audit: await audit(asset.assetId || null)
  };
}

export async function runInstitutionalScannerAction(action, body = {}, actor = "api", assetId = null) {
  await assertReady();
  if (action === "run-scan" || action === "recalculate") {
    const runKey = `INS-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
    await withTransaction(async client => {
      const run = await client.query("INSERT INTO market.institutional_scanner_runs (run_key, status, triggered_by, payload) VALUES ($1,'Queued',$2,$3::jsonb) RETURNING id", [runKey, actor, JSON.stringify({ action })]);
      await client.query("INSERT INTO market.institutional_scanner_audit_logs (run_id, user_name, action, after_value) VALUES ($1,$2,$3,$4::jsonb)", [run.rows[0].id, actor, action, JSON.stringify({ runKey, note: "Requires live COT, institutional, candle, liquidity, and structure records." })]);
    });
    return { accepted: true, type: `institutional_scanner.${action}.requested`, runKey };
  }
  if (action === "recalculate-asset") {
    await safeQuery("INSERT INTO market.institutional_scanner_audit_logs (asset_id, user_name, action, after_value) VALUES ($1,$2,'recalculate_asset',$3::jsonb)", [assetId, actor, JSON.stringify(body)]);
    return { accepted: true, type: "institutional_scanner.asset.recalculate.requested", assetId };
  }
  if (action === "create-alert") {
    const title = String(body.title || "Institutional scanner alert").trim();
    await safeQuery("INSERT INTO market.institutional_scanner_alerts (alert_type, title, severity, asset, payload, created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6)", [body.alertType || "operator_alert", title, body.severity || "Info", body.asset || null, JSON.stringify(body), actor]);
    await safeQuery("INSERT INTO market.institutional_scanner_audit_logs (user_name, action, after_value) VALUES ($1,'alert_created',$2::jsonb)", [actor, JSON.stringify({ title })]);
    return { accepted: true, type: "institutional_scanner.alert.created", title };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    await safeQuery("INSERT INTO market.institutional_scanner_audit_logs (user_name, action, after_value) VALUES ($1,$2,$3::jsonb)", [actor, action, JSON.stringify(body)]);
    return { accepted: true, type: `institutional_scanner.${action}.recorded` };
  }
  throw new Error("unsupported_institutional_scanner_action");
}

export async function exportInstitutionalScannerReport() {
  return { exportedAt: new Date().toISOString(), report: await getInstitutionalScannerEngine() };
}
