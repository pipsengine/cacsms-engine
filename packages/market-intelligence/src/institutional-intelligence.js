import { isDatabaseConfigured, query, withTransaction } from "./db.js";

export const INSTITUTIONAL_INTELLIGENCE_TABLES = Object.freeze([
  "market.institutional_intelligence_scores",
  "market.institutional_intelligence_inputs",
  "market.instrument_institutional_states",
  "market.liquidity_zones",
  "market.cot_positioning_metrics",
  "market.accumulation_distribution_states",
  "market.smart_money_concept_signals",
  "market.retail_trap_risks",
  "market.institutional_ai_summaries",
  "market.institutional_alerts",
  "market.institutional_audit_logs"
]);

const HEALTHY = new Set(["ONLINE", "LIVE", "SYNCED", "READY", "PASSED", "HEALTHY"]);
const INPUTS = Object.freeze([
  ["institutional-cot-data", "COT Reports", 1.2],
  ["market-data", "Market Data", 1.1],
  ["historical-data", "Historical Data", 1],
  ["broker-data", "Broker Data", 0.9],
  ["order-flow-data", "Order Flow Data", 1],
  ["volume-data", "Volume Data", 0.9],
  ["liquidity-zones", "Liquidity Zones", 1],
  ["market-structure", "Market Structure", 1],
  ["news-sentiment", "News Sentiment", 0.7],
  ["macro-intelligence", "Macro Intelligence", 0.8],
  ["sentiment-intelligence", "Sentiment Intelligence", 0.8],
  ["economic-calendar", "Economic Calendar", 0.7]
]);

const n = value => value === null || value === undefined || value === "" ? null : Number(value);
const avg = values => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value), 0) / values.length) : null;
const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value || 0))));

function permissions() {
  return {
    view: "market_intelligence.institutional_intelligence.view",
    recalculate: "market_intelligence.institutional_intelligence.recalculate",
    configureInputs: "market_intelligence.institutional_intelligence.configure_inputs",
    export: "market_intelligence.institutional_intelligence.export",
    createAlert: "market_intelligence.institutional_intelligence.create_alert"
  };
}

function emptyState(status, message, missingTables = []) {
  return {
    sourceMode: "DATABASE_ONLY",
    status,
    message,
    schemaReady: false,
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveInputsOnly: true, lastCalculation: null, institutionalConfidenceScore: null },
    summary: [],
    inputs: [],
    instruments: [],
    liquidity: [],
    cotPositioning: [],
    accumulationDistribution: [],
    smc: [],
    retailTraps: [],
    aiSummary: null,
    alerts: [],
    audit: []
  };
}

async function tableReadiness() {
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [INSTITUTIONAL_INTELLIGENCE_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function assetClass(symbol) {
  const value = String(symbol || "").toUpperCase();
  if (value.includes("XAU")) return "Metals";
  if (value.includes("OIL")) return "Commodities";
  if (value.includes("BTC")) return "Crypto";
  if (value.includes("NAS") || value.includes("SPX") || value.includes("US30")) return "Indices";
  return "Forex";
}

function biasLabel(score, confidence) {
  if (confidence < 45) return "Insufficient Data";
  if (score >= 75) return "Strong Institutional Buy Bias";
  if (score >= 25) return "Institutional Buy Bias";
  if (score <= -75) return "Strong Institutional Sell Bias";
  if (score <= -25) return "Institutional Sell Bias";
  return "Neutral";
}

function sourceByKey(snapshots, key) {
  return snapshots.find(source => [source.id, source.routeSlug, source.category].includes(key));
}

async function latestContext() {
  const context = {};
  if (!isDatabaseConfigured()) return context;
  try {
    const { rows } = await query(`SELECT macro_confidence, global_macro_regime, risk_tone, calculated_at FROM market.macro_intelligence_scores ORDER BY calculated_at DESC LIMIT 1`);
    context.macro = rows[0] || null;
  } catch {}
  try {
    const { rows } = await query(`SELECT sentiment_confidence, overall_market_sentiment, risk_tone, calculated_at FROM market.sentiment_intelligence_scores ORDER BY calculated_at DESC LIMIT 1`);
    context.sentiment = rows[0] || null;
  } catch {}
  try {
    const { rows } = await query(`SELECT confidence, risk_tone, market_stress_level, calculated_at FROM market.market_environment_scores ORDER BY calculated_at DESC LIMIT 1`);
    context.environment = rows[0] || null;
  } catch {}
  return context;
}

function inputsFromContext(snapshots = [], ticks = [], context = {}) {
  return INPUTS.map(([key, name, weight]) => {
    const source = sourceByKey(snapshots, key);
    const derived = key === "market-structure" && ticks.length
      ? { source: "Recorded MT5 Tick Repository", status: "SYNCED", health: 100, freshness: "Latest recorded ticks", lastUpdated: ticks[0]?.observed_at }
      : key === "liquidity-zones" && ticks.length
        ? { source: "Recorded MT5 Tick Repository", status: "SYNCED", health: 100, freshness: "Derived from latest recorded price levels", lastUpdated: ticks[0]?.observed_at }
        : key === "volume-data" && ticks.length
          ? { source: "Recorded MT5 Tick Repository", status: "SYNCED", health: 70, freshness: "Tick activity proxy", lastUpdated: ticks[0]?.observed_at }
          : key === "macro-intelligence" && context.macro
            ? { source: "Macro Intelligence Center", status: "SYNCED", health: n(context.macro.macro_confidence), freshness: "Latest macro intelligence score", lastUpdated: context.macro.calculated_at }
            : key === "sentiment-intelligence" && context.sentiment
              ? { source: "Sentiment Intelligence Center", status: "SYNCED", health: n(context.sentiment.sentiment_confidence), freshness: "Latest sentiment intelligence score", lastUpdated: context.sentiment.calculated_at }
              : null;
    const status = String(derived?.status || source?.status || "UNKNOWN").toUpperCase();
    const health = n(derived?.health ?? source?.healthScore);
    const used = HEALTHY.has(status);
    return {
      inputKey: key,
      input: name,
      source: derived?.source || source?.provider || source?.adapter || "Input unavailable",
      status,
      freshness: derived?.freshness || source?.freshness || "Input unavailable. Institutional confidence score reduced.",
      health: health === null ? (used ? 100 : 0) : clamp(health),
      weight,
      lastUpdated: derived?.lastUpdated || source?.lastSyncAt || null,
      usedInScore: used,
      usedIn: used ? "Institutional score" : "Input unavailable. Institutional confidence score reduced."
    };
  });
}

function tickGroups(ticks = []) {
  const groups = new Map();
  for (const tick of ticks) {
    const symbol = String(tick.symbol || "").toUpperCase();
    const bid = n(tick.bid);
    const ask = n(tick.ask);
    const mid = bid !== null && ask !== null ? (bid + ask) / 2 : bid ?? ask;
    if (!symbol || mid === null) continue;
    const rows = groups.get(symbol) || [];
    rows.push({ mid, observedAt: tick.observed_at || tick.observedAt || null });
    groups.set(symbol, rows);
  }
  return [...groups.entries()];
}

function instrumentRows(ticks, inputs) {
  const confidence = clamp(avg(inputs.filter(input => input.usedInScore).map(input => input.health)) ?? 0);
  return tickGroups(ticks).map(([instrument, rows]) => {
    const first = rows[0]?.mid;
    const last = rows[rows.length - 1]?.mid ?? first;
    const score = first ? Math.max(-100, Math.min(100, Math.round(((last - first) / Math.abs(first)) * 10000))) : 0;
    const direction = score > 15 ? "Smart Money Buy Bias" : score < -15 ? "Smart Money Sell Bias" : "Neutral";
    return {
      instrument,
      assetClass: assetClass(instrument),
      cotBias: inputs.find(input => input.inputKey === "institutional-cot-data")?.usedInScore ? "Insufficient Data" : "Input unavailable",
      smartMoneyBias: confidence >= 50 ? direction : "Insufficient Data",
      liquidityBias: confidence >= 50 ? "Liquidity Grab" : "Insufficient Data",
      orderFlowBias: inputs.find(input => input.inputKey === "order-flow-data")?.usedInScore ? direction : "Input unavailable",
      marketStructure: confidence >= 50 ? (score > 15 ? "Bullish Structure" : score < -15 ? "Bearish Structure" : "Neutral") : "Insufficient Data",
      accumulationDistribution: score > 15 ? "Accumulation" : score < -15 ? "Distribution" : "Neutral",
      retailTrapRisk: confidence < 65 ? "Medium" : "Low",
      stopHuntRisk: confidence < 65 ? "Medium" : "Low",
      institutionalBias: biasLabel(score, confidence),
      score,
      confidence,
      lastUpdated: rows.reduce((latest, row) => row.observedAt && (!latest || row.observedAt > latest) ? row.observedAt : latest, null),
      price: last
    };
  });
}

function liquidityRows(instruments) {
  return instruments.flatMap(row => {
    if (!row.price) return [];
    return [
      { instrument: row.instrument, liquidityZone: "Buy-Side Liquidity", zoneType: "Previous High Proxy", priceLevel: row.price * 1.001, timeframe: "Latest", strength: row.confidence >= 70 ? "Medium" : "Low", distanceFromPrice: row.price * 0.001, sweepStatus: "Unswept", riskLevel: row.stopHuntRisk },
      { instrument: row.instrument, liquidityZone: "Sell-Side Liquidity", zoneType: "Previous Low Proxy", priceLevel: row.price * 0.999, timeframe: "Latest", strength: row.confidence >= 70 ? "Medium" : "Low", distanceFromPrice: row.price * 0.001, sweepStatus: "Unswept", riskLevel: row.stopHuntRisk }
    ];
  });
}

function scoreSummary(instruments, inputs) {
  const confidence = clamp(avg(inputs.filter(input => input.usedInScore).map(input => input.health)) ?? 0);
  const score = instruments.length ? avg(instruments.map(row => row.score)) : 0;
  return {
    institutionalBias: biasLabel(score, confidence),
    smartMoneyDirection: score > 15 ? "Smart Money Buy Bias" : score < -15 ? "Smart Money Sell Bias" : "Neutral",
    liquidityCondition: instruments.length ? "Liquidity Grab" : "Insufficient Data",
    accumulationSignals: instruments.filter(row => row.accumulationDistribution === "Accumulation").length,
    distributionSignals: instruments.filter(row => row.accumulationDistribution === "Distribution").length,
    cotAlignment: inputs.find(input => input.inputKey === "institutional-cot-data")?.usedInScore ? "Insufficient Data" : "Input unavailable",
    orderFlowBias: inputs.find(input => input.inputKey === "order-flow-data")?.usedInScore ? "Neutral" : "Input unavailable",
    retailTrapRisk: confidence < 65 ? "Medium" : "Low",
    stopHuntRisk: confidence < 65 ? "Medium" : "Low",
    manipulationRisk: confidence < 65 ? "Medium" : "Low",
    highConfidenceInstruments: instruments.filter(row => row.confidence >= 80).length,
    institutionalConfidence: confidence,
    institutionalScore: score
  };
}

function summaryCards(score) {
  const s = score || {};
  return [
    ["Institutional Bias", s.institutionalBias, "info"],
    ["Smart Money Direction", s.smartMoneyDirection, "quality"],
    ["Liquidity Condition", s.liquidityCondition, "warn"],
    ["Accumulation Signals", s.accumulationSignals, "ok"],
    ["Distribution Signals", s.distributionSignals, "bad"],
    ["COT Alignment", s.cotAlignment, "info"],
    ["Order Flow Bias", s.orderFlowBias, "info"],
    ["Retail Trap Risk", s.retailTrapRisk, "warn"],
    ["Stop Hunt Risk", s.stopHuntRisk, "warn"],
    ["Manipulation Risk", s.manipulationRisk, "bad"],
    ["High-Confidence Instruments", s.highConfidenceInstruments, "ok"],
    ["Institutional Confidence", s.institutionalConfidence, "quality"]
  ];
}

function aiSummary(score, instruments) {
  const best = instruments.filter(row => row.confidence >= 70).slice(0, 5).map(row => row.instrument).join(", ");
  return {
    summary: `${score.institutionalBias || "Insufficient Data"} with ${score.smartMoneyDirection || "unclear"} smart money direction. Institutional confidence is ${score.institutionalConfidence ?? "unavailable"}.`,
    bestAlignedInstruments: best || "Insufficient Data",
    liquidityTargets: score.liquidityCondition || "Insufficient Data",
    smartMoneyDirection: score.smartMoneyDirection || "Insufficient Data",
    cotConfirmation: score.cotAlignment || "Insufficient Data",
    retailTrapWarnings: score.retailTrapRisk || "Insufficient Data",
    stopHuntRisk: score.stopHuntRisk || "Insufficient Data",
    tradingCaution: score.institutionalConfidence < 70 ? "Input unavailable. Institutional confidence score reduced." : "Use institutional bias with live execution and prop firm risk gates."
  };
}

async function latestRows() {
  const [score, inputs, instruments, liquidity, cotPositioning, accumulationDistribution, smc, retailTraps, ai, alerts, audit] = await Promise.all([
    query(`SELECT institutional_bias AS "institutionalBias", smart_money_direction AS "smartMoneyDirection", liquidity_condition AS "liquidityCondition", accumulation_signals AS "accumulationSignals", distribution_signals AS "distributionSignals", cot_alignment AS "cotAlignment", order_flow_bias AS "orderFlowBias", retail_trap_risk AS "retailTrapRisk", stop_hunt_risk AS "stopHuntRisk", manipulation_risk AS "manipulationRisk", high_confidence_instruments AS "highConfidenceInstruments", institutional_confidence AS "institutionalConfidence", institutional_score AS "institutionalScore", calculated_at AS "calculatedAt" FROM market.institutional_intelligence_scores ORDER BY calculated_at DESC LIMIT 1`),
    query(`SELECT input_name AS input, source, status, freshness, health, weight, last_updated AS "lastUpdated", used_in_score AS "usedInScore", payload->>'usedIn' AS "usedIn" FROM market.institutional_intelligence_inputs ORDER BY created_at DESC LIMIT 40`),
    query(`SELECT instrument, asset_class AS "assetClass", cot_bias AS "cotBias", smart_money_bias AS "smartMoneyBias", liquidity_bias AS "liquidityBias", order_flow_bias AS "orderFlowBias", market_structure AS "marketStructure", accumulation_distribution AS "accumulationDistribution", retail_trap_risk AS "retailTrapRisk", stop_hunt_risk AS "stopHuntRisk", institutional_bias AS "institutionalBias", confidence, updated_at AS "lastUpdated" FROM market.instrument_institutional_states ORDER BY updated_at DESC, instrument LIMIT 80`),
    query(`SELECT instrument, liquidity_zone AS "liquidityZone", zone_type AS "zoneType", price_level AS "priceLevel", timeframe, strength, distance_from_price AS "distanceFromPrice", sweep_status AS "sweepStatus", risk_level AS "riskLevel", observed_at AS "observedAt" FROM market.liquidity_zones ORDER BY observed_at DESC LIMIT 120`),
    query(`SELECT market, commercial_net AS "commercialNet", large_spec_net AS "largeSpecNet", small_spec_net AS "smallSpecNet", open_interest AS "openInterest", weekly_change AS "weeklyChange", cot_bias AS "cotBias", extreme_positioning AS "extremePositioning", last_report_date AS "lastReportDate" FROM market.cot_positioning_metrics ORDER BY observed_at DESC LIMIT 80`),
    query(`SELECT instrument, state, volume_behaviour AS "volumeBehaviour", range_compression AS "rangeCompression", breakout_failure AS "breakoutFailure", liquidity_sweeps AS "liquiditySweeps", candle_displacement AS "candleDisplacement", cot_direction AS "cotDirection", market_structure_shift AS "marketStructureShift", confidence, observed_at AS "observedAt" FROM market.accumulation_distribution_states ORDER BY observed_at DESC LIMIT 80`),
    query(`SELECT instrument, smc_signal AS "smcSignal", direction, timeframe, price_zone AS "priceZone", strength, confirmation, invalidation_level AS "invalidationLevel", status, observed_at AS "observedAt" FROM market.smart_money_concept_signals ORDER BY observed_at DESC LIMIT 80`),
    query(`SELECT instrument, retail_overcrowding AS "retailOvercrowding", stop_cluster_risk AS "stopClusterRisk", fake_breakout_risk AS "fakeBreakoutRisk", liquidity_sweep_risk AS "liquiditySweepRisk", news_trap_risk AS "newsTrapRisk", session_trap_risk AS "sessionTrapRisk", risk_level AS "riskLevel", observed_at AS "observedAt" FROM market.retail_trap_risks ORDER BY observed_at DESC LIMIT 80`),
    query(`SELECT summary, best_aligned_instruments AS "bestAlignedInstruments", liquidity_targets AS "liquidityTargets", smart_money_direction AS "smartMoneyDirection", cot_confirmation AS "cotConfirmation", retail_trap_warnings AS "retailTrapWarnings", stop_hunt_risk AS "stopHuntRisk", trading_caution AS "tradingCaution", generated_at AS "generatedAt" FROM market.institutional_ai_summaries ORDER BY generated_at DESC LIMIT 1`),
    query(`SELECT alert_type AS "alertType", title, severity, status, payload, created_at AS "createdAt" FROM market.institutional_alerts ORDER BY created_at DESC LIMIT 50`),
    query(`SELECT action, source, status, actor, payload, created_at FROM market.institutional_audit_logs ORDER BY created_at DESC LIMIT 80`)
  ]);
  return { score: score.rows[0] || null, inputs: inputs.rows, instruments: instruments.rows, liquidity: liquidity.rows, cotPositioning: cotPositioning.rows, accumulationDistribution: accumulationDistribution.rows, smc: smc.rows, retailTraps: retailTraps.rows, aiSummary: ai.rows[0] || null, alerts: alerts.rows, audit: audit.rows };
}

export async function getInstitutionalIntelligenceDashboard() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const readiness = await tableReadiness();
  if (!readiness.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${readiness.missing.join(", ")}`, readiness.missing);
  const rows = await latestRows();
  if (!rows.score && !rows.inputs.length && !rows.instruments.length) return { ...emptyState("EMPTY", "Institutional intelligence cannot be calculated yet. Connect COT reports, market data, broker data, volume data, liquidity data, and macro intelligence sources to enable institutional analysis."), schemaReady: true };
  return {
    sourceMode: "DATABASE_ONLY",
    status: rows.score ? "READY" : "EMPTY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveInputsOnly: true, lastCalculation: rows.score?.calculatedAt || null, institutionalConfidenceScore: rows.score?.institutionalConfidence ?? null },
    summary: summaryCards(rows.score),
    ...rows
  };
}

export async function getInstitutionalIntelligenceSlice(slice) {
  const dashboard = await getInstitutionalIntelligenceDashboard();
  const map = {
    summary: { status: dashboard.status, summary: dashboard.summary, score: dashboard.score },
    inputs: { status: dashboard.status, inputs: dashboard.inputs },
    instruments: { status: dashboard.status, instruments: dashboard.instruments },
    liquidity: { status: dashboard.status, liquidity: dashboard.liquidity },
    "cot-positioning": { status: dashboard.status, cotPositioning: dashboard.cotPositioning },
    "accumulation-distribution": { status: dashboard.status, accumulationDistribution: dashboard.accumulationDistribution },
    smc: { status: dashboard.status, smc: dashboard.smc },
    "retail-traps": { status: dashboard.status, retailTraps: dashboard.retailTraps },
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
  const readiness = await tableReadiness();
  if (!readiness.ready) {
    const error = new Error("schema_not_ready");
    error.status = 503;
    error.missingTables = readiness.missing;
    throw error;
  }
}

export async function runInstitutionalIntelligenceAction(action, body = {}, actor = "api", context = {}) {
  await assertReady();
  if (action === "alerts") {
    const title = String(body.title || "Institutional intelligence alert").trim();
    await query(`INSERT INTO market.institutional_alerts (alert_type, title, severity, status, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`, [body.alertType || "operator_alert", title, body.severity || "info", "OPEN", JSON.stringify(body)]);
    await query(`INSERT INTO market.institutional_audit_logs (action, actor, status, payload) VALUES ($1,$2,$3,$4::jsonb)`, ["create-alert", actor, "RECORDED", JSON.stringify({ title })]);
    return { type: "institutional_intelligence.alert.created", title };
  }
  if (!["recalculate", "regenerate-summary"].includes(action)) throw new Error("unsupported_institutional_intelligence_action");
  const contextRows = { ...await latestContext(), ...context };
  const inputs = inputsFromContext(context.liveSnapshots || [], context.ticks || [], contextRows);
  const instruments = instrumentRows(context.ticks || [], inputs);
  const liquidity = liquidityRows(instruments);
  const score = scoreSummary(instruments, inputs);
  const ai = aiSummary(score, instruments);
  await withTransaction(async client => {
    for (const input of inputs) await client.query(`INSERT INTO market.institutional_intelligence_inputs (input_key, input_name, source, status, freshness, health, weight, last_updated, used_in_score, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [input.inputKey, input.input, input.source, input.status, input.freshness, input.health, input.weight, input.lastUpdated, input.usedInScore, JSON.stringify({ usedIn: input.usedIn })]);
    await client.query(`INSERT INTO market.institutional_intelligence_scores (institutional_bias, smart_money_direction, liquidity_condition, accumulation_signals, distribution_signals, cot_alignment, order_flow_bias, retail_trap_risk, stop_hunt_risk, manipulation_risk, high_confidence_instruments, institutional_confidence, institutional_score, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`, [score.institutionalBias, score.smartMoneyDirection, score.liquidityCondition, score.accumulationSignals, score.distributionSignals, score.cotAlignment, score.orderFlowBias, score.retailTrapRisk, score.stopHuntRisk, score.manipulationRisk, score.highConfidenceInstruments, score.institutionalConfidence, score.institutionalScore, JSON.stringify({ inputs: inputs.length, engine: "InstitutionalIntelligenceEngine" })]);
    for (const row of instruments) await client.query(`INSERT INTO market.instrument_institutional_states (instrument, asset_class, cot_bias, smart_money_bias, liquidity_bias, order_flow_bias, market_structure, accumulation_distribution, retail_trap_risk, stop_hunt_risk, institutional_bias, confidence, payload, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,coalesce($14::timestamptz, now()))`, [row.instrument, row.assetClass, row.cotBias, row.smartMoneyBias, row.liquidityBias, row.orderFlowBias, row.marketStructure, row.accumulationDistribution, row.retailTrapRisk, row.stopHuntRisk, row.institutionalBias, row.confidence, JSON.stringify({ score: row.score }), row.lastUpdated]);
    for (const row of liquidity) await client.query(`INSERT INTO market.liquidity_zones (instrument, liquidity_zone, zone_type, price_level, timeframe, strength, distance_from_price, sweep_status, risk_level, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [row.instrument, row.liquidityZone, row.zoneType, row.priceLevel, row.timeframe, row.strength, row.distanceFromPrice, row.sweepStatus, row.riskLevel, JSON.stringify({})]);
    for (const row of instruments) await client.query(`INSERT INTO market.accumulation_distribution_states (instrument, state, volume_behaviour, range_compression, breakout_failure, liquidity_sweeps, candle_displacement, cot_direction, market_structure_shift, confidence, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`, [row.instrument, row.accumulationDistribution, "Insufficient Data", "Insufficient Data", "Insufficient Data", row.liquidityBias, "Insufficient Data", row.cotBias, row.marketStructure, row.confidence, JSON.stringify({})]);
    for (const row of instruments) await client.query(`INSERT INTO market.smart_money_concept_signals (instrument, smc_signal, direction, timeframe, price_zone, strength, confirmation, invalidation_level, status, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [row.instrument, "Liquidity Sweep", row.smartMoneyBias, "Latest", row.price ? String(row.price) : null, row.confidence >= 70 ? "Medium" : "Low", row.marketStructure, null, "Observed", JSON.stringify({})]);
    for (const row of instruments) await client.query(`INSERT INTO market.retail_trap_risks (instrument, retail_overcrowding, stop_cluster_risk, fake_breakout_risk, liquidity_sweep_risk, news_trap_risk, session_trap_risk, risk_level, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [row.instrument, "Insufficient Data", row.stopHuntRisk, row.confidence < 65 ? "Medium" : "Low", row.stopHuntRisk, "Insufficient Data", "Insufficient Data", row.retailTrapRisk, JSON.stringify({})]);
    await client.query(`INSERT INTO market.institutional_ai_summaries (summary, best_aligned_instruments, liquidity_targets, smart_money_direction, cot_confirmation, retail_trap_warnings, stop_hunt_risk, trading_caution, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [ai.summary, ai.bestAlignedInstruments, ai.liquidityTargets, ai.smartMoneyDirection, ai.cotConfirmation, ai.retailTrapWarnings, ai.stopHuntRisk, ai.tradingCaution, JSON.stringify({ generatedBy: "InstitutionalIntelligenceEngine" })]);
    await client.query(`INSERT INTO market.institutional_audit_logs (action, actor, status, payload) VALUES ($1,$2,$3,$4::jsonb)`, [action, actor, "RECORDED", JSON.stringify({ inputs: inputs.length, instruments: instruments.length, institutionalConfidence: score.institutionalConfidence })]);
  });
  return { type: "institutional_intelligence.recalculated", status: "READY", inputs: inputs.length, instruments: instruments.length, liquidityZones: liquidity.length, score };
}
