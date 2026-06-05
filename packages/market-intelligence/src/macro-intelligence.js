import { isDatabaseConfigured, query, withTransaction } from "./db.js";

export const MACRO_INTELLIGENCE_TABLES = Object.freeze([
  "market.macro_intelligence_scores",
  "market.macro_data_inputs",
  "market.currency_macro_bias",
  "market.central_bank_policy_states",
  "market.inflation_growth_metrics",
  "market.yield_rate_metrics",
  "market.cross_asset_macro_impacts",
  "market.macro_regime_history",
  "market.macro_ai_summaries",
  "market.macro_alerts",
  "market.macro_audit_logs"
]);

const HEALTHY_STATUSES = new Set(["ONLINE", "LIVE", "SYNCED", "READY", "PASSED", "HEALTHY"]);
const CURRENCIES = Object.freeze([
  ["USD", "United States", "Federal Reserve"],
  ["EUR", "Eurozone", "ECB"],
  ["GBP", "United Kingdom", "Bank of England"],
  ["JPY", "Japan", "Bank of Japan"],
  ["CHF", "Switzerland", "SNB"],
  ["CAD", "Canada", "Bank of Canada"],
  ["AUD", "Australia", "RBA"],
  ["NZD", "New Zealand", "RBNZ"],
  ["CNY", "China", "PBOC"]
]);
const CROSS_ASSETS = Object.freeze(["EUR/USD", "GBP/USD", "USD/JPY", "USD/CAD", "AUD/USD", "NZD/USD", "XAU/USD", "Oil", "US30", "NAS100", "SPX500", "BTC/USD"]);
const INPUT_DEFS = Object.freeze([
  ["economic-calendar", "Economic Calendar", 1.2],
  ["interest-rates", "Interest Rates", 1.1],
  ["inflation-data", "Inflation Data", 1.1],
  ["gdp-data", "GDP Data", 1],
  ["employment-data", "Employment Data", 1],
  ["pmi-data", "PMI Data", 0.9],
  ["bond-yields", "Bond Yields", 1.1],
  ["central-bank-speeches", "Central Bank Speeches", 1],
  ["institutional-cot-data", "COT Reports", 0.8],
  ["news-sentiment", "News Sentiment", 0.9],
  ["market-environment", "Market Environment", 1],
  ["commodity-data", "Commodity Data", 0.8],
  ["currency-strength", "Currency Strength", 0.8]
]);

const n = value => value === null || value === undefined || value === "" ? null : Number(value);
const avg = values => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value), 0) / values.length) : null;
const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value || 0))));

function permissions() {
  return {
    view: "market_intelligence.macro_intelligence.view",
    recalculate: "market_intelligence.macro_intelligence.recalculate",
    configureSources: "market_intelligence.macro_intelligence.configure_sources",
    export: "market_intelligence.macro_intelligence.export",
    createAlert: "market_intelligence.macro_intelligence.create_alert"
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
    badges: { productionLive: true, mockDataDisabled: true, liveMacroInputsOnly: true, lastSync: null, macroConfidenceScore: null },
    summary: [],
    inputs: [],
    currencyBias: [],
    centralBanks: [],
    inflationGrowth: [],
    yieldsRates: [],
    crossAsset: [],
    regimeTimeline: [],
    aiSummary: null,
    alerts: [],
    audit: []
  };
}

async function tableReadiness() {
  const { rows } = await query(
    "SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name",
    [MACRO_INTELLIGENCE_TABLES]
  );
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function sourceByKey(snapshots, key) {
  return snapshots.find(source => [source.id, source.routeSlug, source.category].includes(key));
}

async function latestMarketEnvironment() {
  if (!isDatabaseConfigured()) return null;
  try {
    const { rows } = await query(`SELECT risk_tone, market_stress_level, trading_suitability, environment_score, confidence, calculated_at FROM market.market_environment_scores ORDER BY calculated_at DESC LIMIT 1`);
    return rows[0] || null;
  } catch {
    return null;
  }
}

function inputsFromContext(snapshots = [], marketEnvironment = null) {
  return INPUT_DEFS.map(([key, name, weight]) => {
    const source = sourceByKey(snapshots, key);
    const fromMarketEnvironment = key === "market-environment" && marketEnvironment;
    const status = fromMarketEnvironment ? "SYNCED" : String(source?.status || "UNKNOWN").toUpperCase();
    const health = fromMarketEnvironment ? n(marketEnvironment.confidence) : n(source?.healthScore);
    const used = HEALTHY_STATUSES.has(status);
    return {
      inputKey: key,
      input: name,
      provider: fromMarketEnvironment ? "Market Environment Intelligence Center" : source?.provider || source?.adapter || "Input unavailable",
      status,
      freshness: fromMarketEnvironment ? "Latest persisted market environment score" : source?.freshness || "Input unavailable. Macro confidence score reduced.",
      health: health === null ? (used ? 100 : 0) : clamp(health),
      weight,
      lastUpdated: fromMarketEnvironment ? marketEnvironment.calculated_at : source?.lastSyncAt || null,
      usedInMacroScore: used,
      usedIn: used ? "Macro score" : "Input unavailable. Macro confidence score reduced."
    };
  });
}

function biasFromScore(score) {
  if (score === null || score === undefined) return "Insufficient Data";
  if (score >= 85) return "Strong Bullish";
  if (score >= 65) return "Bullish";
  if (score >= 45) return "Neutral";
  if (score >= 25) return "Bearish";
  return "Strong Bearish";
}

function macroRegime(confidence, marketEnvironment) {
  const riskTone = marketEnvironment?.risk_tone || "Mixed";
  if (confidence < 45) return "Mixed";
  if (/risk-off/i.test(riskTone)) return "Risk-Off";
  if (/risk-on/i.test(riskTone)) return "Risk-On";
  if (/high/i.test(marketEnvironment?.market_stress_level || "")) return "Recessionary";
  return "Expansionary";
}

function currencyRows(inputs) {
  const confidence = clamp(avg(inputs.filter(input => input.usedInMacroScore).map(input => input.health)) ?? 0);
  return CURRENCIES.map(([currency, economy, bank]) => ({
    currency,
    economy,
    inflationTrend: "Insufficient Data",
    growthMomentum: "Insufficient Data",
    centralBankTone: "Insufficient Data",
    yieldSupport: "Insufficient Data",
    employmentStrength: "Insufficient Data",
    riskSensitivity: ["JPY", "CHF", "USD"].includes(currency) ? "Safe Haven" : ["AUD", "NZD", "CAD", "CNY"].includes(currency) ? "Growth Sensitive" : "Macro Sensitive",
    macroBias: confidence >= 70 && currency === "USD" ? "Neutral" : "Insufficient Data",
    confidence: confidence >= 70 && currency === "USD" ? confidence : 0,
    lastUpdated: new Date().toISOString(),
    bank
  }));
}

function centralBankRows(inputs) {
  const confidence = clamp(avg(inputs.filter(input => input.usedInMacroScore).map(input => input.health)) ?? 0);
  return CURRENCIES.map(([, , centralBank]) => ({
    centralBank,
    currentRate: null,
    latestDecision: "Insufficient Data",
    policyTone: confidence >= 70 ? "Mixed" : "Insufficient Data",
    inflationConcern: "Insufficient Data",
    growthConcern: "Insufficient Data",
    nextMeeting: null,
    ratePathBias: "Insufficient Data",
    marketExpectation: "Insufficient Data",
    currencyImpact: "Insufficient Data"
  }));
}

function scoreFromInputs(inputs, marketEnvironment) {
  const active = inputs.filter(input => input.usedInMacroScore);
  const confidence = clamp(avg(active.map(input => input.health)) ?? 0);
  return {
    globalMacroRegime: macroRegime(confidence, marketEnvironment),
    riskTone: marketEnvironment?.risk_tone || (confidence ? "Mixed" : "Insufficient Data"),
    inflationPressure: "Insufficient Data",
    growthMomentum: "Insufficient Data",
    centralBankBias: confidence >= 70 ? "Mixed" : "Insufficient Data",
    yieldDirection: "Insufficient Data",
    usdMacroBias: confidence >= 70 ? "Neutral" : "Insufficient Data",
    goldMacroBias: marketEnvironment?.market_stress_level === "High" ? "Bullish" : "Insufficient Data",
    oilMacroBias: "Insufficient Data",
    equityMacroBias: marketEnvironment?.risk_tone || "Insufficient Data",
    recessionRisk: marketEnvironment?.market_stress_level === "High" ? "Elevated" : "Insufficient Data",
    macroConfidence: confidence
  };
}

function summaryCards(score) {
  const s = score || {};
  return [
    ["Global Macro Regime", s.globalMacroRegime, "info"],
    ["Risk Tone", s.riskTone, "info"],
    ["Inflation Pressure", s.inflationPressure, "warn"],
    ["Growth Momentum", s.growthMomentum, "info"],
    ["Central Bank Bias", s.centralBankBias, "info"],
    ["Yield Direction", s.yieldDirection, "warn"],
    ["USD Macro Bias", s.usdMacroBias, "quality"],
    ["Gold Macro Bias", s.goldMacroBias, "quality"],
    ["Oil Macro Bias", s.oilMacroBias, "info"],
    ["Equity Macro Bias", s.equityMacroBias, "info"],
    ["Recession Risk", s.recessionRisk, "bad"],
    ["Macro Confidence", s.macroConfidence, "ok"]
  ];
}

function crossAssetRows(score, inputs) {
  const confidence = score.macroConfidence || 0;
  return CROSS_ASSETS.map(asset => ({
    asset,
    macroBias: confidence >= 70 ? biasFromScore(confidence) : "Insufficient Data",
    primaryDriver: score.riskTone || "Insufficient Data",
    secondaryDriver: score.centralBankBias || "Insufficient Data",
    riskToneImpact: score.riskTone || "Insufficient Data",
    yieldImpact: score.yieldDirection || "Insufficient Data",
    commodityImpact: /XAU|Oil/i.test(asset) ? score.goldMacroBias || score.oilMacroBias : "Insufficient Data",
    tradingSuitability: confidence >= 70 ? "Neutral" : "Insufficient Data",
    confidence: confidence >= 70 ? confidence : 0,
    payload: { liveInputsUsed: inputs.filter(input => input.usedInMacroScore).length }
  }));
}

function aiSummary(score, currencies) {
  const strongest = currencies.filter(row => /Bullish|Neutral/.test(row.macroBias)).map(row => row.currency).join(", ");
  const weakest = currencies.filter(row => /Bearish/.test(row.macroBias)).map(row => row.currency).join(", ");
  return {
    summary: `${score.globalMacroRegime || "Mixed"} macro regime with ${score.riskTone || "mixed"} risk tone. Macro confidence score is ${score.macroConfidence ?? "unavailable"}.`,
    strongestCurrencies: strongest || "Insufficient Data",
    weakestCurrencies: weakest || "Insufficient Data",
    centralBankDivergence: score.centralBankBias || "Insufficient Data",
    inflationRisks: score.inflationPressure || "Insufficient Data",
    growthRisks: score.growthMomentum || "Insufficient Data",
    yieldRateImpact: score.yieldDirection || "Insufficient Data",
    crossAssetImplications: `USD: ${score.usdMacroBias}; Gold: ${score.goldMacroBias}; Oil: ${score.oilMacroBias}; Equities: ${score.equityMacroBias}`,
    tradingCaution: score.macroConfidence < 70 ? "Input unavailable. Macro confidence score reduced." : "Use macro bias with live execution and prop-firm risk rules."
  };
}

async function latestRows() {
  const [score, inputs, currencyBias, centralBanks, inflationGrowth, yieldsRates, crossAsset, regimeTimeline, ai, alerts, audit] = await Promise.all([
    query(`SELECT global_macro_regime AS "globalMacroRegime", risk_tone AS "riskTone", inflation_pressure AS "inflationPressure", growth_momentum AS "growthMomentum", central_bank_bias AS "centralBankBias", yield_direction AS "yieldDirection", usd_macro_bias AS "usdMacroBias", gold_macro_bias AS "goldMacroBias", oil_macro_bias AS "oilMacroBias", equity_macro_bias AS "equityMacroBias", recession_risk AS "recessionRisk", macro_confidence AS "macroConfidence", calculated_at AS "calculatedAt" FROM market.macro_intelligence_scores ORDER BY calculated_at DESC LIMIT 1`),
    query(`SELECT input_name AS input, provider, status, freshness, health, weight, last_updated AS "lastUpdated", used_in_macro_score AS "usedInMacroScore", payload->>'usedIn' AS "usedIn" FROM market.macro_data_inputs ORDER BY created_at DESC LIMIT 40`),
    query(`SELECT currency, economy, inflation_trend AS "inflationTrend", growth_momentum AS "growthMomentum", central_bank_tone AS "centralBankTone", yield_support AS "yieldSupport", employment_strength AS "employmentStrength", risk_sensitivity AS "riskSensitivity", macro_bias AS "macroBias", confidence, updated_at AS "lastUpdated" FROM market.currency_macro_bias ORDER BY updated_at DESC, currency LIMIT 60`),
    query(`SELECT central_bank AS "centralBank", current_rate AS "currentRate", latest_decision AS "latestDecision", policy_tone AS "policyTone", inflation_concern AS "inflationConcern", growth_concern AS "growthConcern", next_meeting AS "nextMeeting", rate_path_bias AS "ratePathBias", market_expectation AS "marketExpectation", currency_impact AS "currencyImpact", updated_at AS "updatedAt" FROM market.central_bank_policy_states ORDER BY updated_at DESC, central_bank LIMIT 60`),
    query(`SELECT metric_name AS "metricName", latest, previous, forecast, deviation, trend_direction AS "trendDirection", market_impact AS "marketImpact", observed_at AS "observedAt" FROM market.inflation_growth_metrics ORDER BY observed_at DESC LIMIT 80`),
    query(`SELECT metric_name AS "metricName", latest, previous, direction, usd_bias AS "usdBias", jpy_bias AS "jpyBias", gold_impact AS "goldImpact", equity_impact AS "equityImpact", carry_trade_condition AS "carryTradeCondition", observed_at AS "observedAt" FROM market.yield_rate_metrics ORDER BY observed_at DESC LIMIT 80`),
    query(`SELECT asset, macro_bias AS "macroBias", primary_driver AS "primaryDriver", secondary_driver AS "secondaryDriver", risk_tone_impact AS "riskToneImpact", yield_impact AS "yieldImpact", commodity_impact AS "commodityImpact", trading_suitability AS "tradingSuitability", confidence, updated_at AS "updatedAt" FROM market.cross_asset_macro_impacts ORDER BY updated_at DESC, asset LIMIT 80`),
    query(`SELECT created_at AS date, regime, trigger, affected_markets AS "affectedMarkets", confidence, notes FROM market.macro_regime_history ORDER BY created_at DESC LIMIT 60`),
    query(`SELECT summary, strongest_currencies AS "strongestCurrencies", weakest_currencies AS "weakestCurrencies", central_bank_divergence AS "centralBankDivergence", inflation_risks AS "inflationRisks", growth_risks AS "growthRisks", yield_rate_impact AS "yieldRateImpact", cross_asset_implications AS "crossAssetImplications", trading_caution AS "tradingCaution", generated_at AS "generatedAt" FROM market.macro_ai_summaries ORDER BY generated_at DESC LIMIT 1`),
    query(`SELECT alert_type AS "alertType", title, severity, status, payload, created_at AS "createdAt" FROM market.macro_alerts ORDER BY created_at DESC LIMIT 50`),
    query(`SELECT action, source, status, actor, payload, created_at FROM market.macro_audit_logs ORDER BY created_at DESC LIMIT 80`)
  ]);
  return { score: score.rows[0] || null, inputs: inputs.rows, currencyBias: currencyBias.rows, centralBanks: centralBanks.rows, inflationGrowth: inflationGrowth.rows, yieldsRates: yieldsRates.rows, crossAsset: crossAsset.rows, regimeTimeline: regimeTimeline.rows, aiSummary: ai.rows[0] || null, alerts: alerts.rows, audit: audit.rows };
}

export async function getMacroIntelligenceDashboard() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const readiness = await tableReadiness();
  if (!readiness.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${readiness.missing.join(", ")}`, readiness.missing);
  const rows = await latestRows();
  if (!rows.score && !rows.inputs.length && !rows.currencyBias.length) {
    return { ...emptyState("EMPTY", "Macro intelligence cannot be calculated yet. Connect economic calendar, central bank, interest rate, yield, inflation, and sentiment data sources to enable live macro analysis."), schemaReady: true };
  }
  return {
    sourceMode: "DATABASE_ONLY",
    status: rows.score ? "READY" : "EMPTY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveMacroInputsOnly: true, lastSync: rows.score?.calculatedAt || null, macroConfidenceScore: rows.score?.macroConfidence ?? null },
    summary: summaryCards(rows.score),
    ...rows
  };
}

export async function getMacroIntelligenceSlice(slice) {
  const dashboard = await getMacroIntelligenceDashboard();
  const map = {
    summary: { status: dashboard.status, summary: dashboard.summary, score: dashboard.score },
    inputs: { status: dashboard.status, inputs: dashboard.inputs },
    "currency-bias": { status: dashboard.status, currencyBias: dashboard.currencyBias },
    "central-banks": { status: dashboard.status, centralBanks: dashboard.centralBanks },
    "inflation-growth": { status: dashboard.status, inflationGrowth: dashboard.inflationGrowth },
    "yields-rates": { status: dashboard.status, yieldsRates: dashboard.yieldsRates },
    "cross-asset": { status: dashboard.status, crossAsset: dashboard.crossAsset },
    "regime-timeline": { status: dashboard.status, regimeTimeline: dashboard.regimeTimeline },
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

export async function runMacroIntelligenceAction(action, body = {}, actor = "api", context = {}) {
  await assertReady();
  if (action === "alerts") {
    const title = String(body.title || "Macro intelligence alert").trim();
    await query(`INSERT INTO market.macro_alerts (alert_type, title, severity, status, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`, [body.alertType || "operator_alert", title, body.severity || "info", "OPEN", JSON.stringify(body)]);
    await query(`INSERT INTO market.macro_audit_logs (action, actor, status, payload) VALUES ($1,$2,$3,$4::jsonb)`, ["create-alert", actor, "RECORDED", JSON.stringify({ title })]);
    return { type: "macro_intelligence.alert.created", title };
  }
  if (!["recalculate", "regenerate-summary", "sync-sources"].includes(action)) throw new Error("unsupported_macro_intelligence_action");
  const marketEnvironment = context.marketEnvironment || await latestMarketEnvironment();
  const inputs = inputsFromContext(context.liveSnapshots || [], marketEnvironment);
  const score = scoreFromInputs(inputs, marketEnvironment);
  const currencies = currencyRows(inputs);
  const centralBanks = centralBankRows(inputs);
  const crossAssets = crossAssetRows(score, inputs);
  const summary = aiSummary(score, currencies);
  await withTransaction(async client => {
    for (const input of inputs) {
      await client.query(`INSERT INTO market.macro_data_inputs (input_key, input_name, provider, status, freshness, health, weight, last_updated, used_in_macro_score, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [input.inputKey, input.input, input.provider, input.status, input.freshness, input.health, input.weight, input.lastUpdated, input.usedInMacroScore, JSON.stringify({ usedIn: input.usedIn })]);
    }
    await client.query(`INSERT INTO market.macro_intelligence_scores (global_macro_regime, risk_tone, inflation_pressure, growth_momentum, central_bank_bias, yield_direction, usd_macro_bias, gold_macro_bias, oil_macro_bias, equity_macro_bias, recession_risk, macro_confidence, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`, [score.globalMacroRegime, score.riskTone, score.inflationPressure, score.growthMomentum, score.centralBankBias, score.yieldDirection, score.usdMacroBias, score.goldMacroBias, score.oilMacroBias, score.equityMacroBias, score.recessionRisk, score.macroConfidence, JSON.stringify({ inputs: inputs.length })]);
    for (const row of currencies) await client.query(`INSERT INTO market.currency_macro_bias (currency, economy, inflation_trend, growth_momentum, central_bank_tone, yield_support, employment_strength, risk_sensitivity, macro_bias, confidence, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`, [row.currency, row.economy, row.inflationTrend, row.growthMomentum, row.centralBankTone, row.yieldSupport, row.employmentStrength, row.riskSensitivity, row.macroBias, row.confidence, JSON.stringify({ centralBank: row.bank })]);
    for (const row of centralBanks) await client.query(`INSERT INTO market.central_bank_policy_states (central_bank, current_rate, latest_decision, policy_tone, inflation_concern, growth_concern, next_meeting, rate_path_bias, market_expectation, currency_impact, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`, [row.centralBank, row.currentRate, row.latestDecision, row.policyTone, row.inflationConcern, row.growthConcern, row.nextMeeting, row.ratePathBias, row.marketExpectation, row.currencyImpact, JSON.stringify({})]);
    for (const row of crossAssets) await client.query(`INSERT INTO market.cross_asset_macro_impacts (asset, macro_bias, primary_driver, secondary_driver, risk_tone_impact, yield_impact, commodity_impact, trading_suitability, confidence, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [row.asset, row.macroBias, row.primaryDriver, row.secondaryDriver, row.riskToneImpact, row.yieldImpact, row.commodityImpact, row.tradingSuitability, row.confidence, JSON.stringify(row.payload)]);
    await client.query(`INSERT INTO market.macro_regime_history (regime, trigger, affected_markets, confidence, notes) VALUES ($1,$2,$3,$4,$5)`, [score.globalMacroRegime, "Live macro recalculation", crossAssets.map(row => row.asset).join(", "), score.macroConfidence, summary.tradingCaution]);
    await client.query(`INSERT INTO market.macro_ai_summaries (summary, strongest_currencies, weakest_currencies, central_bank_divergence, inflation_risks, growth_risks, yield_rate_impact, cross_asset_implications, trading_caution, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [summary.summary, summary.strongestCurrencies, summary.weakestCurrencies, summary.centralBankDivergence, summary.inflationRisks, summary.growthRisks, summary.yieldRateImpact, summary.crossAssetImplications, summary.tradingCaution, JSON.stringify({ generatedBy: "MacroIntelligenceEngine" })]);
    await client.query(`INSERT INTO market.macro_audit_logs (action, actor, status, payload) VALUES ($1,$2,$3,$4::jsonb)`, [action, actor, "RECORDED", JSON.stringify({ inputs: inputs.length, macroConfidence: score.macroConfidence })]);
  });
  return { type: "macro_intelligence.recalculated", status: "READY", inputs: inputs.length, currencies: currencies.length, crossAssets: crossAssets.length, score };
}
