import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { getCurrencyStrengthLiveSource, syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

export const CURRENCY_STRENGTH_TABLES = Object.freeze([
  "market.currency_strength_scores",
  "market.currency_strength_matrix",
  "market.currency_pair_strength_scores",
  "market.currency_strength_rotations",
  "market.currency_strength_divergences",
  "market.currency_strength_heatmap",
  "market.currency_strength_opportunities",
  "market.currency_strength_weights",
  "market.currency_strength_ai_summaries",
  "market.currency_strength_alerts",
  "market.currency_strength_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.currency_strength.view",
  recalculate: "universe_scanner.currency_strength.recalculate",
  configureWeights: "universe_scanner.currency_strength.configure_weights",
  createAlert: "universe_scanner.currency_strength.create_alert",
  export: "universe_scanner.currency_strength.export"
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
    [CURRENCY_STRENGTH_TABLES]
  );
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    sourceMode: "LIVE_FX_DATA_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveFxDataOnly: true, lastCalculation: null, strengthConfidenceScore: null },
    summary: {
      strongestCurrency: "Insufficient Data",
      weakestCurrency: "Insufficient Data",
      mostImprovedCurrency: "Insufficient Data",
      mostWeakenedCurrency: "Insufficient Data",
      bestBullishPair: "Insufficient Data",
      bestBearishPair: "Insufficient Data",
      highestRotationSignal: "Insufficient Data",
      highestDivergenceSignal: "Insufficient Data",
      averageStrengthConfidence: null,
      fxScanHealth: "Insufficient Data"
    },
    matrix: [],
    pairs: [],
    rotation: [],
    heatmap: [],
    divergence: [],
    opportunities: { topBuyForexPairs: [], topSellForexPairs: [], neutralPairs: [], rejectedPairs: [], blockedPairs: [] },
    weights: [],
    aiSummary: null,
    alerts: [],
    audit: [],
    emptyState: {
      title: "Currency strength cannot be calculated yet.",
      message: "Register FX assets, map broker symbols, sync live price feeds, and load historical data before running the Currency Strength Engine.",
      actions: ["Open Asset Universe Registry", "Sync Broker Symbols", "Open Historical Data", "Run Readiness Check"]
    }
  };
}

function rank(rows) {
  return rows.map((row, index) => ({ rank: index + 1, ...row }));
}

async function matrixRows() {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (currency) currency, current_strength AS "currentStrength", previous_strength AS "previousStrength",
      strength_change AS "strengthChange", momentum, trend_direction AS "trendDirection", volatility,
      confidence, strength_label AS "strengthLabel", calculated_at AS "lastUpdated"
    FROM market.currency_strength_scores
    ORDER BY currency, calculated_at DESC
  `);
  return rows.map(row => ({
    ...row,
    currentStrength: round(row.currentStrength),
    previousStrength: round(row.previousStrength),
    strengthChange: round(row.strengthChange),
    momentum: round(row.momentum),
    volatility: round(row.volatility),
    confidence: round(row.confidence)
  }));
}

async function pairRows() {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (pair) pair, base_currency AS "baseCurrency", quote_currency AS "quoteCurrency",
      base_strength AS "baseStrength", quote_strength AS "quoteStrength", strength_spread AS "strengthSpread",
      direction_bias AS "directionBias", trend_alignment AS "trendAlignment", momentum_alignment AS "momentumAlignment",
      volatility_condition AS "volatilityCondition", opportunity_score AS "opportunityScore", confidence,
      qualification, calculated_at AS "calculatedAt"
    FROM market.currency_pair_strength_scores
    ORDER BY pair, calculated_at DESC
  `);
  return rank(rows.sort((a, b) => Number(b.opportunityScore || 0) - Number(a.opportunityScore || 0)).map(row => ({
    ...row,
    baseStrength: round(row.baseStrength),
    quoteStrength: round(row.quoteStrength),
    strengthSpread: round(row.strengthSpread),
    opportunityScore: round(row.opportunityScore),
    confidence: round(row.confidence)
  })));
}

async function rotationRows() {
  const { rows } = await safeQuery(`
    SELECT currency, previous_rank AS "previousRank", current_rank AS "currentRank", rank_change AS "rankChange",
      rotation_type AS "rotationType", momentum, confidence, observed_at AS "observedAt"
    FROM market.currency_strength_rotations
    ORDER BY observed_at DESC, abs(rank_change) DESC NULLS LAST
    LIMIT 80
  `);
  return rows.map(row => ({ ...row, momentum: round(row.momentum), confidence: round(row.confidence) }));
}

async function heatmapRows() {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (currency, timeframe) currency, timeframe, strength_score AS "strengthScore",
      direction, confidence, state, observed_at AS "observedAt"
    FROM market.currency_strength_heatmap
    ORDER BY currency, timeframe, observed_at DESC
  `);
  return rows.map(row => ({ ...row, strengthScore: round(row.strengthScore), confidence: round(row.confidence) }));
}

async function divergenceRows() {
  const { rows } = await safeQuery(`
    SELECT pair, currency_strength_bias AS "currencyStrengthBias", price_direction AS "priceDirection",
      divergence_type AS "divergenceType", severity, trading_interpretation AS "tradingInterpretation",
      recommended_action AS "recommendedAction", observed_at AS "observedAt"
    FROM market.currency_strength_divergences
    ORDER BY observed_at DESC
    LIMIT 80
  `);
  return rows;
}

async function opportunityRows() {
  const { rows } = await safeQuery(`
    SELECT pair, direction, strength_spread AS "strengthSpread", trend_confirmation AS "trendConfirmation",
      momentum_confirmation AS "momentumConfirmation", risk_score AS "riskScore", confidence_score AS "confidenceScore",
      opportunity_score AS "opportunityScore", qualification, reason, created_at AS "createdAt"
    FROM market.currency_strength_opportunities
    ORDER BY opportunity_score DESC NULLS LAST, confidence_score DESC NULLS LAST, created_at DESC
    LIMIT 100
  `);
  const mapped = rows.map(row => ({
    ...row,
    strengthSpread: round(row.strengthSpread),
    riskScore: round(row.riskScore),
    confidenceScore: round(row.confidenceScore),
    opportunityScore: round(row.opportunityScore)
  }));
  return {
    topBuyForexPairs: rank(mapped.filter(row => /buy/i.test(row.direction || "")).slice(0, 10)),
    topSellForexPairs: rank(mapped.filter(row => /sell/i.test(row.direction || "")).slice(0, 10)),
    neutralPairs: rank(mapped.filter(row => /neutral/i.test(row.direction || "")).slice(0, 10)),
    rejectedPairs: rank(mapped.filter(row => row.qualification === "Rejected").slice(0, 10)),
    blockedPairs: rank(mapped.filter(row => row.qualification === "Blocked").slice(0, 10))
  };
}

async function aiSummary() {
  const { rows } = await safeQuery(`
    SELECT strongest_currencies AS "strongestCurrencies", weakest_currencies AS "weakestCurrencies",
      best_pair_combinations AS "bestPairCombinations", currency_rotation AS "currencyRotation",
      divergence_risks AS "divergenceRisks", opportunity_candidates AS "opportunityCandidates",
      pairs_to_avoid AS "pairsToAvoid", scanner_readiness AS "scannerReadiness", summary,
      generated_at AS "generatedAt"
    FROM market.currency_strength_ai_summaries
    ORDER BY generated_at DESC
    LIMIT 1
  `);
  return rows[0] || null;
}

async function weights() {
  const { rows } = await safeQuery("SELECT component_key AS \"componentKey\", component_name AS \"componentName\", weight, enabled, updated_at AS \"updatedAt\" FROM market.currency_strength_weights ORDER BY component_name");
  return rows;
}

async function alerts() {
  const { rows } = await safeQuery("SELECT alert_type AS \"alertType\", title, severity, currency, pair, status, created_by AS \"createdBy\", created_at AS \"createdAt\" FROM market.currency_strength_alerts ORDER BY created_at DESC LIMIT 80");
  return rows;
}

async function audit() {
  const { rows } = await safeQuery("SELECT user_name AS \"userName\", action, entity_type AS \"entityType\", entity_id AS \"entityId\", reason, created_at AS \"createdAt\" FROM market.currency_strength_audit_logs ORDER BY created_at DESC LIMIT 80");
  return rows;
}

function buildSummary(matrix, pairs, rotation, divergence, opportunities) {
  const sorted = matrix.slice().sort((a, b) => Number(b.currentStrength || 0) - Number(a.currentStrength || 0));
  const buy = opportunities.topBuyForexPairs[0] || pairs.find(row => /buy/i.test(row.directionBias || ""));
  const sell = opportunities.topSellForexPairs[0] || pairs.find(row => /sell/i.test(row.directionBias || ""));
  const confidence = avg(matrix.map(row => row.confidence));
  return {
    strongestCurrency: sorted[0]?.currency || "Insufficient Data",
    weakestCurrency: sorted.at(-1)?.currency || "Insufficient Data",
    mostImprovedCurrency: matrix.slice().sort((a, b) => Number(b.strengthChange || 0) - Number(a.strengthChange || 0))[0]?.currency || "Insufficient Data",
    mostWeakenedCurrency: matrix.slice().sort((a, b) => Number(a.strengthChange || 0) - Number(b.strengthChange || 0))[0]?.currency || "Insufficient Data",
    bestBullishPair: buy?.pair || "Insufficient Data",
    bestBearishPair: sell?.pair || "Insufficient Data",
    highestRotationSignal: rotation[0]?.currency || "Insufficient Data",
    highestDivergenceSignal: divergence[0]?.pair || "Insufficient Data",
    averageStrengthConfidence: confidence,
    fxScanHealth: confidence === null ? "Insufficient Data" : confidence >= 75 ? "Strong" : confidence >= 50 ? "Neutral" : "Weak"
  };
}

export async function getCurrencyStrengthEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  const [matrix, pairs, rotation, heatmap, divergence, opportunities, summaryText, weightRows, alertRows, auditRows] = await Promise.all([
    matrixRows(), pairRows(), rotationRows(), heatmapRows(), divergenceRows(), opportunityRows(), aiSummary(), weights(), alerts(), audit()
  ]);
  if (!matrix.length && !pairs.length && !heatmap.length) {
    await syncAssetUniverseFromLiveSources();
    const live = await getCurrencyStrengthLiveSource();
    if (!live.matrix.length && !live.pairs.length && !live.heatmap.length) return { ...emptyState("EMPTY", "Currency strength cannot be calculated yet."), schemaReady: true, weights: weightRows, alerts: alertRows, audit: auditRows };
    const summary = buildSummary(live.matrix, live.pairs, live.rotation, live.divergence, live.opportunities);
    const lastCalculation = live.matrix.map(row => row.lastUpdated).filter(Boolean).sort().at(-1) || live.pairs.map(row => row.calculatedAt).filter(Boolean).sort().at(-1) || null;
    return {
      sourceMode: "LIVE_MARKET_TICKS",
      mockDataDisabled: true,
      status: "READY",
      schemaReady: true,
      permissions: permissions(),
      badges: { productionLive: true, mockDataDisabled: true, liveFxDataOnly: true, lastCalculation, strengthConfidenceScore: summary.averageStrengthConfidence },
      summary,
      matrix: live.matrix,
      pairs: live.pairs,
      rotation: live.rotation,
      heatmap: live.heatmap,
      divergence: live.divergence,
      opportunities: live.opportunities,
      weights: weightRows,
      aiSummary: summaryText,
      alerts: alertRows,
      audit: auditRows,
      emptyState: null
    };
  }
  const summary = buildSummary(matrix, pairs, rotation, divergence, opportunities);
  const lastCalculation = matrix.map(row => row.lastUpdated).filter(Boolean).sort().at(-1) || pairs.map(row => row.calculatedAt).filter(Boolean).sort().at(-1) || null;
  return {
    sourceMode: "LIVE_FX_DATA_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveFxDataOnly: true, lastCalculation, strengthConfidenceScore: summary.averageStrengthConfidence },
    summary,
    matrix,
    pairs,
    rotation,
    heatmap,
    divergence,
    opportunities,
    weights: weightRows,
    aiSummary: summaryText,
    alerts: alertRows,
    audit: auditRows,
    emptyState: null
  };
}

export async function getCurrencyStrengthSlice(slice) {
  const data = await getCurrencyStrengthEngine();
  const map = {
    summary: { status: data.status, summary: data.summary, badges: data.badges },
    matrix: { status: data.status, matrix: data.matrix },
    pairs: { status: data.status, pairs: data.pairs },
    rotation: { status: data.status, rotation: data.rotation },
    heatmap: { status: data.status, heatmap: data.heatmap },
    divergence: { status: data.status, divergence: data.divergence },
    opportunities: { status: data.status, opportunities: data.opportunities },
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

export async function runCurrencyStrengthAction(action, body = {}, actor = "api") {
  await assertReady();
  if (action === "create-alert") {
    const title = String(body.title || "Currency strength alert").trim();
    await safeQuery(
      "INSERT INTO market.currency_strength_alerts (alert_type, title, severity, currency, pair, payload, created_by) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)",
      [body.alertType || "operator_alert", title, body.severity || "Info", body.currency || null, body.pair || null, JSON.stringify(body), actor]
    );
    await safeQuery("INSERT INTO market.currency_strength_audit_logs (user_name, action, after_value) VALUES ($1,'alert_created',$2::jsonb)", [actor, JSON.stringify({ title })]);
    return { accepted: true, type: "currency_strength.alert.created", title };
  }
  if (action === "recalculate") {
    await withTransaction(async client => {
      await client.query("INSERT INTO market.currency_strength_audit_logs (user_name, action, after_value) VALUES ($1,'recalculate_requested',$2::jsonb)", [actor, JSON.stringify({ requestedAt: new Date().toISOString(), note: "Calculation requires live FX records." })]);
    });
    return { accepted: true, type: "currency_strength.recalculate.requested", status: "queued_for_live_inputs" };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    await safeQuery("INSERT INTO market.currency_strength_audit_logs (user_name, action, after_value) VALUES ($1,$2,$3::jsonb)", [actor, action, JSON.stringify(body)]);
    return { accepted: true, type: `currency_strength.${action}.recorded` };
  }
  throw new Error("unsupported_currency_strength_action");
}

export async function exportCurrencyStrengthReport() {
  return { exportedAt: new Date().toISOString(), report: await getCurrencyStrengthEngine() };
}
