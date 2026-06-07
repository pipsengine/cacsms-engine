import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

export const MACRO_SCANNER_TABLES = Object.freeze([
  "market.asset_macro_scores",
  "market.asset_macro_component_scores",
  "market.asset_macro_rankings",
  "market.asset_currency_macro_bias",
  "market.asset_central_bank_alignment",
  "market.asset_yield_rate_impacts",
  "market.asset_inflation_growth_impacts",
  "market.asset_commodity_macro_drivers",
  "market.asset_macro_divergences",
  "market.macro_scanner_weights",
  "market.macro_scanner_runs",
  "market.macro_scanner_ai_summaries",
  "market.macro_scanner_alerts",
  "market.macro_scanner_audit_logs"
]);

const MACRO_SOURCE_TABLES = Object.freeze([
  "market.asset_universe",
  "market.macro_intelligence_scores",
  "market.macro_data_inputs",
  "market.currency_macro_bias",
  "market.central_bank_policy_states",
  "market.inflation_growth_metrics",
  "market.yield_rate_metrics",
  "market.cross_asset_macro_impacts",
  "market.sentiment_intelligence_scores"
]);

const permissions = () => ({
  view: "universe_scanner.macro.view",
  runScan: "universe_scanner.macro.run_scan",
  recalculate: "universe_scanner.macro.recalculate",
  configureRules: "universe_scanner.macro.configure_rules",
  createAlert: "universe_scanner.macro.create_alert",
  export: "universe_scanner.macro.export"
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

async function tableReadiness(tables) {
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [tables]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "MacroScannerEngine",
    sourceMode: "PRODUCTION_MACRO_RECORDS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveMacroInputsOnly: true, lastMacroScan: null, macroScannerHealth: "Insufficient Data" },
    summary: {
      assetsScanned: 0,
      macroBullishAssets: 0,
      macroBearishAssets: 0,
      neutralMacroAssets: 0,
      centralBankAlignedAssets: 0,
      yieldSupportedAssets: 0,
      inflationSensitiveAssets: 0,
      growthSensitiveAssets: 0,
      commodityMacroAssets: 0,
      macroDivergenceAssets: 0,
      macroQualifiedAssets: 0,
      averageMacroScore: null,
      averageMacroConfidence: null,
      scannerHealth: "Insufficient Data"
    },
    matrix: [],
    rankings: [],
    currencyBias: [],
    centralBanks: [],
    yieldsRates: [],
    inflationGrowth: [],
    commodityDrivers: [],
    divergence: [],
    heatmap: [],
    weights: [],
    aiSummary: null,
    alerts: [],
    audit: [],
    emptyState: {
      title: "Macro scanner cannot calculate macro bias yet.",
      message: "Connect macro intelligence, economic calendar, interest rate, central bank, yield, inflation, growth, and sentiment sources before running a macro scan.",
      actions: ["Open Macro Intelligence", "Open Economic Calendar", "Open Source Registry", "Run Macro Scan"]
    }
  };
}

function normalizeAsset(value) {
  return String(value || "").toUpperCase().replaceAll("/", "").replaceAll("-", "").replaceAll("_", "").replace(/\s+/g, "");
}

function displayAsset(value) {
  return String(value || "").toUpperCase().replaceAll("/", "");
}

function biasScore(label) {
  const value = String(label || "").toLowerCase();
  if (!label || /insufficient|no data|unknown/.test(value)) return null;
  if (/strong.*bullish/.test(value)) return 100;
  if (/mild.*bullish/.test(value)) return 25;
  if (/bullish|hawkish|risk-on|support/.test(value)) return 75;
  if (/strong.*bearish/.test(value)) return -100;
  if (/mild.*bearish/.test(value)) return -25;
  if (/bearish|dovish|risk-off|pressure/.test(value)) return -75;
  if (/mixed|neutral/.test(value)) return 0;
  return null;
}

function scoreLabel(score) {
  if (score === null || score === undefined) return "No Data";
  if (score >= 85) return "Strong Macro Bullish";
  if (score >= 45) return "Macro Bullish";
  if (score > 10) return "Mild Macro Bullish";
  if (score <= -85) return "Strong Macro Bearish";
  if (score <= -45) return "Macro Bearish";
  if (score < -10) return "Mild Macro Bearish";
  return "Neutral";
}

function qualification(score, confidence) {
  if (score === null || confidence === null || confidence < 35) return "Insufficient Data";
  if (confidence < 55) return "Watchlist";
  if (Math.abs(score) >= 45) return "Macro Qualified";
  return "Watchlist";
}

function cell(label, score, confidence, updatedAt) {
  return {
    label: label || "No Data",
    score: round(score),
    confidence: round(confidence),
    freshness: updatedAt ? new Date(updatedAt).toISOString() : "No record"
  };
}

function pairParts(asset, row = {}) {
  const base = row.base_asset || row.baseAsset;
  const quote = row.quote_asset || row.quoteAsset;
  if (base || quote) return { base, quote };
  const normalized = normalizeAsset(asset);
  if (normalized.startsWith("XAU")) return { base: "XAU", quote: normalized.slice(3, 6) || null };
  if (normalized.endsWith("USD") && normalized.length >= 6) return { base: normalized.slice(0, normalized.length - 3), quote: "USD" };
  if (normalized.length === 6) return { base: normalized.slice(0, 3), quote: normalized.slice(3, 6) };
  return { base: normalized.slice(0, 3) || null, quote: null };
}

async function activeAssets() {
  const { rows } = await safeQuery(`
    SELECT id, asset, asset_code AS "assetCode", display_name AS "displayName", asset_class AS "assetClass",
      broker_symbol AS "brokerSymbol", base_asset AS "baseAsset", quote_asset AS "quoteAsset", updated_at AS "updatedAt"
    FROM market.asset_universe
    WHERE active AND scanner_enabled
    ORDER BY asset
  `);
  return rows.map(row => ({ ...row, asset: row.assetCode || row.asset || row.brokerSymbol }));
}

async function latestRun() {
  const { rows } = await safeQuery(`SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "durationMs", assets_scanned AS "assetsScanned", health FROM market.macro_scanner_runs ORDER BY started_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function scoreRows() {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset) id, run_id AS "runId", asset_id AS "assetId", asset, asset_class AS "assetClass",
      macro_bias AS "macroBias", currency_bias AS "currencyBias", central_bank_bias AS "centralBankBias",
      interest_rate_bias AS "interestRateBias", inflation_bias AS "inflationBias", growth_bias AS "growthBias",
      yield_bias AS "yieldBias", commodity_bias AS "commodityBias", risk_tone AS "riskTone",
      macro_score AS "macroScore", confidence, qualification, last_scanned AS "lastScanned", payload
    FROM market.asset_macro_scores
    ORDER BY asset, last_scanned DESC
  `);
  return rows.map(row => ({ ...row, macroScore: round(row.macroScore), confidence: round(row.confidence) }));
}

async function componentRows() {
  const { rows } = await safeQuery(`
    SELECT asset, component_key AS "componentKey", component_name AS "componentName", component_bias AS "componentBias",
      component_score AS "componentScore", confidence, freshness, observed_at AS "observedAt"
    FROM market.asset_macro_component_scores
    ORDER BY observed_at DESC
  `);
  return rows.map(row => ({ ...row, componentScore: round(row.componentScore), confidence: round(row.confidence) }));
}

async function rankingRows(scores = null) {
  const { rows } = await safeQuery(`
    SELECT rank, asset_id AS "assetId", asset, asset_class AS "assetClass", macro_bias AS "macroBias",
      currency_bias AS "currencyBias", central_bank_bias AS "centralBankBias", rate_differential AS "rateDifferential",
      inflation_impact AS "inflationImpact", growth_impact AS "growthImpact", yield_impact AS "yieldImpact",
      risk_tone_impact AS "riskToneImpact", commodity_impact AS "commodityImpact", macro_score AS "macroScore",
      confidence, qualification, last_scanned AS "lastScanned"
    FROM market.asset_macro_rankings
    ORDER BY rank NULLS LAST, ABS(macro_score) DESC NULLS LAST, confidence DESC NULLS LAST, last_scanned DESC
  `);
  if (rows.length) return rows.map(row => ({ ...row, macroScore: round(row.macroScore), confidence: round(row.confidence) }));
  return (scores || await scoreRows()).slice().sort((a, b) => Math.abs(Number(b.macroScore || 0)) - Math.abs(Number(a.macroScore || 0))).map((row, index) => ({
    rank: index + 1,
    assetId: row.assetId,
    asset: row.asset,
    assetClass: row.assetClass,
    macroBias: row.macroBias,
    currencyBias: row.currencyBias,
    centralBankBias: row.centralBankBias,
    rateDifferential: row.interestRateBias,
    inflationImpact: row.inflationBias,
    growthImpact: row.growthBias,
    yieldImpact: row.yieldBias,
    riskToneImpact: row.riskTone,
    commodityImpact: row.commodityBias,
    macroScore: row.macroScore,
    confidence: row.confidence,
    qualification: row.qualification,
    lastScanned: row.lastScanned
  }));
}

async function sourceContext() {
  const [assets, macro, currencies, banks, inflation, yields, crossAssets, sentiment] = await Promise.all([
    activeAssets(),
    safeQuery(`SELECT * FROM market.macro_intelligence_scores ORDER BY calculated_at DESC LIMIT 1`).then(result => result.rows[0] || null),
    safeQuery(`SELECT currency, economy, inflation_trend AS "inflationTrend", growth_momentum AS "growthMomentum", central_bank_tone AS "centralBankTone", yield_support AS "yieldSupport", employment_strength AS "employmentStrength", risk_sensitivity AS "riskSensitivity", macro_bias AS "macroBias", confidence, payload, updated_at AS "updatedAt" FROM market.currency_macro_bias ORDER BY updated_at DESC`).then(result => result.rows.map(row => ({ ...row, confidence: round(row.confidence) }))),
    safeQuery(`SELECT central_bank AS "centralBank", current_rate AS "currentRate", latest_decision AS "latestDecision", policy_tone AS "policyTone", inflation_concern AS "inflationConcern", growth_concern AS "growthConcern", next_meeting AS "nextMeeting", rate_path_bias AS "ratePathBias", market_expectation AS "marketExpectation", currency_impact AS "currencyImpact", payload, updated_at AS "updatedAt" FROM market.central_bank_policy_states ORDER BY updated_at DESC`).then(result => result.rows.map(row => ({ ...row, confidence: null }))),
    safeQuery(`SELECT metric_name AS "metricName", latest, previous, forecast, deviation, trend_direction AS "trendDirection", market_impact AS "marketImpact", payload, observed_at AS "observedAt" FROM market.inflation_growth_metrics ORDER BY observed_at DESC`).then(result => result.rows),
    safeQuery(`SELECT metric_name AS "metricName", latest, previous, direction, usd_bias AS "usdBias", jpy_bias AS "jpyBias", gold_impact AS "goldImpact", equity_impact AS "equityImpact", carry_trade_condition AS "carryTradeCondition", payload, observed_at AS "observedAt" FROM market.yield_rate_metrics ORDER BY observed_at DESC`).then(result => result.rows),
    safeQuery(`SELECT asset, macro_bias AS "macroBias", primary_driver AS "primaryDriver", secondary_driver AS "secondaryDriver", risk_tone_impact AS "riskToneImpact", yield_impact AS "yieldImpact", commodity_impact AS "commodityImpact", trading_suitability AS "tradingSuitability", confidence, payload, updated_at AS "updatedAt" FROM market.cross_asset_macro_impacts ORDER BY updated_at DESC`).then(result => result.rows.map(row => ({ ...row, asset: displayAsset(row.asset), normalizedAsset: normalizeAsset(row.asset), confidence: round(row.confidence) }))),
    safeQuery(`SELECT overall_market_sentiment AS "overallMarketSentiment", risk_tone AS "sentimentRiskTone", sentiment_confidence AS "sentimentConfidence", overall_sentiment_score AS "overallSentimentScore", calculated_at AS "calculatedAt" FROM market.sentiment_intelligence_scores ORDER BY calculated_at DESC LIMIT 1`).then(result => result.rows[0] || null)
  ]);
  return { assets, macro: macro ? { ...macro, macro_confidence: round(macro.macro_confidence) } : null, currencies, banks, inflation, yields, crossAssets, sentiment };
}

function currencyLookup(currencies) {
  const map = new Map();
  for (const row of currencies) map.set(String(row.currency || "").toUpperCase(), row);
  return map;
}

function crossAssetLookup(crossAssets) {
  const map = new Map();
  for (const row of crossAssets) map.set(row.normalizedAsset, row);
  return map;
}

function deriveAssetScore(asset, context) {
  const normalized = normalizeAsset(asset.asset);
  const cross = crossAssetLookup(context.crossAssets).get(normalized);
  const currencies = currencyLookup(context.currencies);
  const parts = pairParts(asset.asset, asset);
  const base = currencies.get(String(parts.base || "").toUpperCase());
  const quote = currencies.get(String(parts.quote || "").toUpperCase());
  const global = context.macro;
  const baseScore = biasScore(base?.macroBias);
  const quoteScore = biasScore(quote?.macroBias);
  const currencyScores = [baseScore, quoteScore === null ? null : -quoteScore].filter(value => value !== null);
  const currencyScore = currencyScores.length ? avg(currencyScores) : null;
  const crossScore = biasScore(cross?.macroBias);
  const goldScore = normalized.includes("XAU") ? biasScore(global?.gold_macro_bias) : null;
  const oilScore = normalized.includes("OIL") ? biasScore(global?.oil_macro_bias) : null;
  const equityScore = /NAS|US30|SPX|GER|DAX|DJ|USTEC|US500/.test(normalized) ? biasScore(global?.equity_macro_bias) : null;
  const score = avg([crossScore, currencyScore, goldScore, oilScore, equityScore].filter(value => value !== null));
  const confidence = avg([cross?.confidence, base?.confidence, quote?.confidence, global?.macro_confidence].filter(value => value !== null && value !== undefined));
  const centralBankBias = base?.centralBankTone || global?.central_bank_bias || "No Data";
  const interestRateBias = base?.yieldSupport || cross?.yieldImpact || global?.yield_direction || "No Data";
  const commodityBias = cross?.commodityImpact || (goldScore !== null ? global?.gold_macro_bias : oilScore !== null ? global?.oil_macro_bias : "No Data");
  return {
    assetId: asset.id,
    asset: displayAsset(asset.asset),
    assetClass: asset.assetClass || "Unclassified",
    macroBias: cross?.macroBias || scoreLabel(score),
    currencyBias: base?.macroBias || "No Data",
    centralBankBias,
    interestRateBias,
    inflationBias: base?.inflationTrend || global?.inflation_pressure || "No Data",
    growthBias: base?.growthMomentum || global?.growth_momentum || "No Data",
    yieldBias: cross?.yieldImpact || base?.yieldSupport || global?.yield_direction || "No Data",
    commodityBias,
    riskTone: cross?.riskToneImpact || global?.risk_tone || "No Data",
    macroScore: score,
    confidence,
    qualification: qualification(score, confidence),
    lastScanned: cross?.updatedAt || base?.updatedAt || global?.calculated_at || asset.updatedAt || null,
    parts,
    source: { cross, base, quote, global }
  };
}

function buildMatrix(scores) {
  return scores.map(row => ({
    assetId: row.assetId,
    asset: row.asset,
    assetClass: row.assetClass,
    macroBias: cell(row.macroBias, row.macroScore, row.confidence, row.lastScanned),
    currencyBias: cell(row.currencyBias, biasScore(row.currencyBias), row.confidence, row.lastScanned),
    centralBankBias: cell(row.centralBankBias, biasScore(row.centralBankBias), row.confidence, row.lastScanned),
    interestRateBias: cell(row.interestRateBias, biasScore(row.interestRateBias), row.confidence, row.lastScanned),
    inflationBias: cell(row.inflationBias, biasScore(row.inflationBias), row.confidence, row.lastScanned),
    growthBias: cell(row.growthBias, biasScore(row.growthBias), row.confidence, row.lastScanned),
    yieldBias: cell(row.yieldBias, biasScore(row.yieldBias), row.confidence, row.lastScanned),
    commodityBias: cell(row.commodityBias, biasScore(row.commodityBias), row.confidence, row.lastScanned),
    riskTone: cell(row.riskTone, biasScore(row.riskTone), row.confidence, row.lastScanned),
    macroScore: row.macroScore,
    confidence: row.confidence,
    lastUpdated: row.lastScanned
  }));
}

function buildSummary(scores, currencyBias, centralBanks, yieldsRates, inflationGrowth, commodityDrivers, divergence, run) {
  const has = pattern => row => pattern.test(`${row.macroBias} ${row.currencyBias} ${row.centralBankBias} ${row.yieldBias} ${row.commodityBias}`);
  return {
    assetsScanned: scores.length || run?.assetsScanned || 0,
    macroBullishAssets: scores.filter(row => Number(row.macroScore) > 10 || /bullish/i.test(row.macroBias)).length,
    macroBearishAssets: scores.filter(row => Number(row.macroScore) < -10 || /bearish/i.test(row.macroBias)).length,
    neutralMacroAssets: scores.filter(row => row.macroScore === 0 || /neutral|mixed/i.test(row.macroBias)).length,
    centralBankAlignedAssets: scores.filter(has(/hawkish|dovish|mixed|neutral/i)).length,
    yieldSupportedAssets: scores.filter(has(/yield|support|carry/i)).length,
    inflationSensitiveAssets: inflationGrowth.length || scores.filter(has(/inflation/i)).length,
    growthSensitiveAssets: inflationGrowth.length || scores.filter(has(/growth|pmi|employment/i)).length,
    commodityMacroAssets: commodityDrivers.length || scores.filter(row => /XAU|OIL|CAD|AUD|NZD|BTC/i.test(row.asset)).length,
    macroDivergenceAssets: divergence.length,
    macroQualifiedAssets: scores.filter(row => row.qualification === "Macro Qualified").length,
    averageMacroScore: avg(scores.map(row => row.macroScore)),
    averageMacroConfidence: avg(scores.map(row => row.confidence)),
    scannerHealth: scores.length && (currencyBias.length || centralBanks.length) ? "Healthy" : "Insufficient Data"
  };
}

function liveCurrencyBias(rows) {
  return rows.map(row => ({
    currency: row.currency,
    economy: row.economy,
    inflationTrend: row.inflationTrend,
    growthMomentum: row.growthMomentum,
    centralBankTone: row.centralBankTone,
    rateDirection: row.yieldSupport,
    yieldSupport: row.yieldSupport,
    employmentStrength: row.employmentStrength,
    riskSensitivity: row.riskSensitivity,
    macroBias: row.macroBias,
    confidence: row.confidence,
    lastUpdated: row.updatedAt
  }));
}

function liveCentralBanks(rows, currencyRows) {
  const byBank = new Map(currencyRows.map(row => [String(row.payload?.centralBank || "").toLowerCase(), row]));
  return rows.map(row => {
    const currency = byBank.get(String(row.centralBank || "").toLowerCase());
    return {
      centralBank: row.centralBank,
      currency: currency?.currency || row.payload?.currency || null,
      currentRate: row.currentRate,
      latestDecision: row.latestDecision,
      policyTone: row.policyTone,
      ratePathBias: row.ratePathBias,
      inflationConcern: row.inflationConcern,
      growthConcern: row.growthConcern,
      nextMeeting: row.nextMeeting,
      currencyImpact: row.currencyImpact,
      confidence: currency?.confidence ?? null,
      lastUpdated: row.updatedAt
    };
  });
}

function liveYieldsRates(context, scores) {
  if (context.yields.length) {
    return context.yields.map(row => ({
      asset: row.metricName,
      baseCurrencyRateBias: row.usdBias,
      quoteCurrencyRateBias: row.jpyBias,
      rateDifferentialBias: row.direction,
      yieldDirection: row.direction,
      realYieldImpact: row.goldImpact,
      carryTradeBias: row.carryTradeCondition,
      macroInterpretation: row.equityImpact || row.goldImpact || row.direction,
      confidence: context.macro?.macro_confidence ?? null,
      observedAt: row.observedAt
    }));
  }
  return scores.filter(row => !/No Data|Insufficient Data/i.test(row.yieldBias)).map(row => ({
    asset: row.asset,
    baseCurrencyRateBias: row.source.base?.yieldSupport || "No Data",
    quoteCurrencyRateBias: row.source.quote?.yieldSupport || "No Data",
    rateDifferentialBias: row.interestRateBias,
    yieldDirection: row.yieldBias,
    realYieldImpact: row.source.global?.gold_macro_bias || "No Data",
    carryTradeBias: row.source.cross?.tradingSuitability || "No Data",
    macroInterpretation: row.yieldBias,
    confidence: row.confidence,
    observedAt: row.lastScanned
  }));
}

function liveInflationGrowth(context, scores) {
  if (context.inflation.length) {
    return context.inflation.map(row => ({
      asset: row.metricName,
      currencyEconomy: row.payload?.currency || row.metricName,
      inflationTrend: row.trendDirection,
      coreInflation: row.payload?.coreInflation || null,
      growthMomentum: row.payload?.growthMomentum || null,
      pmiDirection: row.payload?.pmiDirection || null,
      employmentDirection: row.payload?.employmentDirection || null,
      economicSurprise: row.deviation,
      assetImpact: row.marketImpact,
      confidence: context.macro?.macro_confidence ?? null,
      observedAt: row.observedAt
    }));
  }
  return scores.filter(row => !/No Data|Insufficient Data/i.test(`${row.inflationBias} ${row.growthBias}`)).map(row => ({
    asset: row.asset,
    currencyEconomy: row.source.base?.economy || row.parts?.base || null,
    inflationTrend: row.inflationBias,
    coreInflation: "No Data",
    growthMomentum: row.growthBias,
    pmiDirection: "No Data",
    employmentDirection: row.source.base?.employmentStrength || "No Data",
    economicSurprise: "No Data",
    assetImpact: row.macroBias,
    confidence: row.confidence,
    observedAt: row.lastScanned
  }));
}

function liveCommodityDrivers(scores) {
  return scores.filter(row => /XAU|OIL|CAD|AUD|NZD|BTC/i.test(row.asset) || !/No Data|Insufficient Data/i.test(row.commodityBias)).map(row => ({
    asset: row.asset,
    driver: row.source.cross?.primaryDriver || row.commodityBias,
    driverDirection: row.commodityBias,
    affectedCurrency: row.parts?.base || row.parts?.quote || null,
    macroImpact: row.macroBias,
    riskLevel: Math.abs(Number(row.macroScore || 0)) >= 75 ? "High" : "Medium",
    confidence: row.confidence,
    observedAt: row.lastScanned
  }));
}

function liveDivergence(scores, context) {
  const sentimentScore = biasScore(context.sentiment?.overallMarketSentiment);
  if (sentimentScore === null) return [];
  return scores.filter(row => row.macroScore !== null && Math.sign(row.macroScore) !== 0 && Math.sign(row.macroScore) !== Math.sign(sentimentScore)).map(row => ({
    asset: row.asset,
    divergenceType: "Macro / Sentiment Conflict",
    macroBias: row.macroBias,
    technicalBias: "No Data",
    sentimentBias: context.sentiment?.overallMarketSentiment,
    institutionalBias: "No Data",
    severity: Math.abs(Number(row.macroScore || 0)) >= 75 ? "High" : "Medium",
    tradingInterpretation: "Macro and sentiment records disagree. Require confirmation before ranking.",
    recommendedAction: "Review in Sentiment Scanner",
    observedAt: row.lastScanned
  }));
}

async function weights() {
  const { rows } = await safeQuery(`SELECT component_key AS "componentKey", component_name AS "componentName", weight, enabled, updated_at AS "updatedAt" FROM market.macro_scanner_weights ORDER BY component_name`);
  return rows.map(row => ({ ...row, weight: round(row.weight) }));
}

async function alerts() {
  const { rows } = await safeQuery(`SELECT alert_type AS "alertType", title, severity, asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.macro_scanner_alerts ORDER BY created_at DESC LIMIT 80`);
  return rows;
}

async function audit(assetId = null) {
  const { rows } = await safeQuery(`SELECT asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.macro_scanner_audit_logs ${assetId ? "WHERE asset_id = $1" : ""} ORDER BY created_at DESC LIMIT 80`, assetId ? [assetId] : []);
  return rows;
}

async function aiSummary() {
  const { rows } = await safeQuery(`SELECT strongest_macro_bullish_assets AS "strongestMacroBullishAssets", strongest_macro_bearish_assets AS "strongestMacroBearishAssets", best_currency_macro_opportunities AS "bestCurrencyMacroOpportunities", central_bank_divergence_opportunities AS "centralBankDivergenceOpportunities", yield_supported_opportunities AS "yieldSupportedOpportunities", inflation_growth_risks AS "inflationGrowthRisks", commodity_macro_themes AS "commodityMacroThemes", macro_conflicts AS "macroConflicts", assets_to_monitor AS "assetsToMonitor", assets_to_avoid AS "assetsToAvoid", recommended_next_step AS "recommendedNextStep", summary, generated_at AS "generatedAt" FROM market.macro_scanner_ai_summaries ORDER BY generated_at DESC LIMIT 1`);
  return rows[0] || null;
}

function buildAiSummary(scores, context) {
  const sorted = scores.slice().sort((a, b) => Number(b.macroScore || 0) - Number(a.macroScore || 0));
  const bullish = sorted.filter(row => Number(row.macroScore || 0) > 10).slice(0, 5).map(row => row.asset).join(", ") || "Insufficient Data";
  const bearish = sorted.filter(row => Number(row.macroScore || 0) < -10).slice(-5).map(row => row.asset).join(", ") || "Insufficient Data";
  return {
    strongestMacroBullishAssets: bullish,
    strongestMacroBearishAssets: bearish,
    bestCurrencyMacroOpportunities: context.currencies.filter(row => !/insufficient/i.test(row.macroBias || "")).map(row => `${row.currency}: ${row.macroBias}`).join(", ") || "Insufficient Data",
    centralBankDivergenceOpportunities: context.banks.filter(row => /hawkish|dovish|mixed/i.test(row.policyTone || "")).map(row => `${row.centralBank}: ${row.policyTone}`).join(", ") || "Insufficient Data",
    yieldSupportedOpportunities: scores.filter(row => /support|yield|carry/i.test(row.yieldBias || "")).slice(0, 5).map(row => row.asset).join(", ") || "Insufficient Data",
    inflationGrowthRisks: "Use Inflation / Growth panel. No standalone risk rows are shown unless production metrics exist.",
    commodityMacroThemes: scores.filter(row => /XAU|OIL|CAD|AUD|NZD|BTC/i.test(row.asset)).slice(0, 8).map(row => `${row.asset}: ${row.commodityBias}`).join(", ") || "Insufficient Data",
    macroConflicts: "See Macro Divergence panel.",
    assetsToMonitor: sorted.slice(0, 8).map(row => row.asset).join(", ") || "Insufficient Data",
    assetsToAvoid: scores.filter(row => row.qualification === "Insufficient Data").slice(0, 8).map(row => row.asset).join(", ") || "Insufficient Data",
    recommendedNextStep: "Confirm macro-aligned assets against sentiment, institutional, risk, and opportunity ranking.",
    summary: `${scores.length} active assets scanned from production macro records. Macro confidence: ${context.macro?.macro_confidence ?? "Insufficient Data"}.`
  };
}

async function scannerOutput() {
  const [run, scores, components, ranking, currencyBias, centralBanks, yieldsRates, inflationGrowth, commodityDrivers, divergence, weightRows, alertRows, auditRows, ai] = await Promise.all([
    latestRun(),
    scoreRows(),
    componentRows(),
    rankingRows(),
    safeQuery(`SELECT currency, economy, inflation_trend AS "inflationTrend", growth_momentum AS "growthMomentum", central_bank_tone AS "centralBankTone", rate_direction AS "rateDirection", yield_support AS "yieldSupport", employment_strength AS "employmentStrength", risk_sensitivity AS "riskSensitivity", macro_bias AS "macroBias", confidence, updated_at AS "lastUpdated" FROM market.asset_currency_macro_bias ORDER BY updated_at DESC`).then(result => result.rows.map(row => ({ ...row, confidence: round(row.confidence) }))),
    safeQuery(`SELECT central_bank AS "centralBank", currency, current_rate AS "currentRate", latest_decision AS "latestDecision", policy_tone AS "policyTone", rate_path_bias AS "ratePathBias", inflation_concern AS "inflationConcern", growth_concern AS "growthConcern", next_meeting AS "nextMeeting", currency_impact AS "currencyImpact", confidence, updated_at AS "lastUpdated" FROM market.asset_central_bank_alignment ORDER BY updated_at DESC`).then(result => result.rows.map(row => ({ ...row, confidence: round(row.confidence) }))),
    safeQuery(`SELECT asset, base_currency_rate_bias AS "baseCurrencyRateBias", quote_currency_rate_bias AS "quoteCurrencyRateBias", rate_differential_bias AS "rateDifferentialBias", yield_direction AS "yieldDirection", real_yield_impact AS "realYieldImpact", carry_trade_bias AS "carryTradeBias", macro_interpretation AS "macroInterpretation", confidence, observed_at AS "observedAt" FROM market.asset_yield_rate_impacts ORDER BY observed_at DESC`).then(result => result.rows.map(row => ({ ...row, confidence: round(row.confidence) }))),
    safeQuery(`SELECT asset, currency_economy AS "currencyEconomy", inflation_trend AS "inflationTrend", core_inflation AS "coreInflation", growth_momentum AS "growthMomentum", pmi_direction AS "pmiDirection", employment_direction AS "employmentDirection", economic_surprise AS "economicSurprise", asset_impact AS "assetImpact", confidence, observed_at AS "observedAt" FROM market.asset_inflation_growth_impacts ORDER BY observed_at DESC`).then(result => result.rows.map(row => ({ ...row, confidence: round(row.confidence) }))),
    safeQuery(`SELECT asset, driver, driver_direction AS "driverDirection", affected_currency AS "affectedCurrency", macro_impact AS "macroImpact", risk_level AS "riskLevel", confidence, observed_at AS "observedAt" FROM market.asset_commodity_macro_drivers ORDER BY observed_at DESC`).then(result => result.rows.map(row => ({ ...row, confidence: round(row.confidence) }))),
    safeQuery(`SELECT asset, divergence_type AS "divergenceType", macro_bias AS "macroBias", technical_bias AS "technicalBias", sentiment_bias AS "sentimentBias", institutional_bias AS "institutionalBias", severity, trading_interpretation AS "tradingInterpretation", recommended_action AS "recommendedAction", observed_at AS "observedAt" FROM market.asset_macro_divergences ORDER BY observed_at DESC`).then(result => result.rows),
    weights(), alerts(), audit(), aiSummary()
  ]);
  return { run, scores, components, ranking, currencyBias, centralBanks, yieldsRates, inflationGrowth, commodityDrivers, divergence, weightRows, alertRows, auditRows, ai };
}

function heatmapFromMatrix(matrix) {
  return matrix.flatMap(row => [
    ["Currency Bias", row.currencyBias],
    ["Central Bank", row.centralBankBias],
    ["Rates", row.interestRateBias],
    ["Inflation", row.inflationBias],
    ["Growth", row.growthBias],
    ["Yields", row.yieldBias],
    ["Risk Tone", row.riskTone],
    ["Commodity", row.commodityBias],
    ["Overall", row.macroBias]
  ].map(([component, item]) => ({ asset: row.asset, component, state: item.label, score: item.score, confidence: item.confidence })));
}

async function liveOutput() {
  await syncAssetUniverseFromLiveSources();
  const context = await sourceContext();
  const scores = context.assets.map(asset => deriveAssetScore(asset, context));
  const matrix = buildMatrix(scores);
  const rankings = await rankingRows(scores);
  const currencyBias = liveCurrencyBias(context.currencies);
  const centralBanks = liveCentralBanks(context.banks, context.currencies);
  const yieldsRates = liveYieldsRates(context, scores);
  const inflationGrowth = liveInflationGrowth(context, scores);
  const commodityDrivers = liveCommodityDrivers(scores);
  const divergence = liveDivergence(scores, context);
  const [run, weightRows, alertRows, auditRows, persistedAi] = await Promise.all([latestRun(), weights(), alerts(), audit(), aiSummary()]);
  const summary = buildSummary(scores, currencyBias, centralBanks, yieldsRates, inflationGrowth, commodityDrivers, divergence, run);
  return {
    engine: "MacroScannerEngine",
    sourceMode: "LIVE_MACRO_INTELLIGENCE_INPUTS_ONLY",
    mockDataDisabled: true,
    status: scores.length && (context.macro || context.currencies.length || context.crossAssets.length) ? "READY" : "EMPTY",
    schemaReady: true,
    permissions: permissions(),
    badges: {
      productionLive: true,
      mockDataDisabled: true,
      liveMacroInputsOnly: true,
      lastMacroScan: scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || null,
      macroScannerHealth: summary.scannerHealth
    },
    latestRun: run,
    summary,
    matrix,
    rankings,
    currencyBias,
    centralBanks,
    yieldsRates,
    inflationGrowth,
    commodityDrivers,
    divergence,
    heatmap: heatmapFromMatrix(matrix),
    weights: weightRows,
    aiSummary: persistedAi || buildAiSummary(scores, context),
    alerts: alertRows,
    audit: auditRows,
    emptyState: scores.length ? null : emptyState("EMPTY", "Macro scanner cannot calculate macro bias yet.").emptyState
  };
}

export async function getMacroScannerEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const scannerReady = await tableReadiness(MACRO_SCANNER_TABLES);
  if (!scannerReady.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${scannerReady.missing.join(", ")}`, scannerReady.missing);
  const sourceReady = await tableReadiness(MACRO_SOURCE_TABLES);
  if (!sourceReady.ready) return emptyState("SCHEMA_NOT_READY", `Missing source tables: ${sourceReady.missing.join(", ")}`, sourceReady.missing);
  const output = await scannerOutput();
  if (!output.scores.length && !output.ranking.length && !output.currencyBias.length && !output.centralBanks.length) return liveOutput();
  const matrix = buildMatrix(output.scores);
  const summary = buildSummary(output.scores, output.currencyBias, output.centralBanks, output.yieldsRates, output.inflationGrowth, output.commodityDrivers, output.divergence, output.run);
  return {
    engine: "MacroScannerEngine",
    sourceMode: "PRODUCTION_MACRO_SCANNER_RECORDS_ONLY",
    mockDataDisabled: true,
    status: output.scores.length ? "READY" : "EMPTY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveMacroInputsOnly: true, lastMacroScan: output.scores.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || output.run?.completedAt || null, macroScannerHealth: summary.scannerHealth },
    latestRun: output.run,
    summary,
    matrix,
    rankings: output.ranking,
    currencyBias: output.currencyBias,
    centralBanks: output.centralBanks,
    yieldsRates: output.yieldsRates,
    inflationGrowth: output.inflationGrowth,
    commodityDrivers: output.commodityDrivers,
    divergence: output.divergence,
    heatmap: heatmapFromMatrix(matrix),
    weights: output.weightRows,
    aiSummary: output.ai,
    alerts: output.alertRows,
    audit: output.auditRows,
    emptyState: output.scores.length ? null : emptyState("EMPTY", "Macro scanner cannot calculate macro bias yet.").emptyState
  };
}

export async function getMacroScannerSlice(slice) {
  const dashboard = await getMacroScannerEngine();
  const map = {
    summary: { status: dashboard.status, badges: dashboard.badges, summary: dashboard.summary },
    matrix: { status: dashboard.status, matrix: dashboard.matrix },
    rankings: { status: dashboard.status, rankings: dashboard.rankings },
    "currency-bias": { status: dashboard.status, currencyBias: dashboard.currencyBias },
    "central-banks": { status: dashboard.status, centralBanks: dashboard.centralBanks },
    "yields-rates": { status: dashboard.status, yieldsRates: dashboard.yieldsRates },
    "inflation-growth": { status: dashboard.status, inflationGrowth: dashboard.inflationGrowth },
    "commodity-drivers": { status: dashboard.status, commodityDrivers: dashboard.commodityDrivers },
    divergence: { status: dashboard.status, divergence: dashboard.divergence },
    heatmap: { status: dashboard.status, heatmap: dashboard.heatmap },
    "ai-summary": { status: dashboard.status, aiSummary: dashboard.aiSummary },
    export: dashboard
  };
  return map[slice] || dashboard;
}

export async function getMacroScannerAssetDetail(assetId) {
  const dashboard = await getMacroScannerEngine();
  const id = normalizeAsset(assetId);
  const row = dashboard.rankings.find(item => normalizeAsset(item.assetId || item.asset) === id) || dashboard.rankings.find(item => normalizeAsset(item.asset) === id);
  const matrix = dashboard.matrix.find(item => normalizeAsset(item.assetId || item.asset) === id || normalizeAsset(item.asset) === id);
  if (!row && !matrix) return null;
  return {
    asset: row || matrix,
    matrix,
    scoreBreakdown: dashboard.heatmap.filter(item => normalizeAsset(item.asset) === normalizeAsset(row?.asset || matrix?.asset)),
    currencyBias: dashboard.currencyBias.filter(item => normalizeAsset(row?.asset || matrix?.asset).includes(String(item.currency || "").toUpperCase())),
    centralBanks: dashboard.centralBanks.filter(item => normalizeAsset(row?.asset || matrix?.asset).includes(String(item.currency || "").toUpperCase())),
    yieldsRates: dashboard.yieldsRates.filter(item => normalizeAsset(item.asset) === normalizeAsset(row?.asset || matrix?.asset)),
    inflationGrowth: dashboard.inflationGrowth.filter(item => normalizeAsset(item.asset) === normalizeAsset(row?.asset || matrix?.asset)),
    commodityDrivers: dashboard.commodityDrivers.filter(item => normalizeAsset(item.asset) === normalizeAsset(row?.asset || matrix?.asset)),
    divergence: dashboard.divergence.filter(item => normalizeAsset(item.asset) === normalizeAsset(row?.asset || matrix?.asset)),
    aiSummary: dashboard.aiSummary,
    alerts: dashboard.alerts.filter(item => normalizeAsset(item.asset) === normalizeAsset(row?.asset || matrix?.asset)),
    audit: dashboard.audit.filter(item => !item.assetId || String(item.assetId) === String(row?.assetId || matrix?.assetId))
  };
}

async function assertReady() {
  if (!isDatabaseConfigured()) {
    const error = new Error("database_not_configured");
    error.status = 503;
    throw error;
  }
  const ready = await tableReadiness(MACRO_SCANNER_TABLES);
  if (!ready.ready) {
    const error = new Error("schema_not_ready");
    error.status = 503;
    error.missingTables = ready.missing;
    throw error;
  }
}

export async function runMacroScannerAction(action, body = {}, actor = "api", assetId = null) {
  await assertReady();
  if (action === "run-scan" || action === "recalculate") {
    const dashboard = await liveOutput();
    await withTransaction(async client => {
      const runKey = `MACRO-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
      await client.query(`INSERT INTO market.macro_scanner_runs (run_key, status, completed_at, assets_scanned, health, triggered_by, payload) VALUES ($1,'Completed',now(),$2,$3,$4,$5::jsonb)`, [runKey, dashboard.summary.assetsScanned, dashboard.summary.scannerHealth, actor, JSON.stringify({ action, sourceMode: dashboard.sourceMode })]);
      await client.query(`INSERT INTO market.macro_scanner_audit_logs (user_name, action, entity_type, reason, payload) VALUES ($1,$2,'macro_scanner',$3,$4::jsonb)`, [actor, action, body.reason || null, JSON.stringify({ assetsScanned: dashboard.summary.assetsScanned })]);
    });
    return { accepted: true, type: `macro_scanner.${action}`, assetsScanned: dashboard.summary.assetsScanned, status: dashboard.status };
  }
  if (action === "recalculate-asset") {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(assetId || "")) ? assetId : null;
    await safeQuery(`INSERT INTO market.macro_scanner_audit_logs (asset_id, user_name, action, entity_type, entity_id, reason, payload) VALUES ($1::uuid,$2,'recalculate_asset','asset_macro_score',$3,$4,$5::jsonb)`, [uuid, actor, assetId, body.reason || null, JSON.stringify({ assetId })]);
    return { accepted: true, type: "macro_scanner.asset.recalculated", assetId };
  }
  if (action === "create-alert") {
    await safeQuery(`INSERT INTO market.macro_scanner_alerts (alert_type, title, severity, asset, created_by, payload) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [body.alertType || "macro_scanner", body.title || "Macro scanner alert", body.severity || "Info", body.asset || null, actor, JSON.stringify(body)]);
    return { accepted: true, type: "macro_scanner.alert.created" };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    const dashboard = await liveOutput();
    const ai = dashboard.aiSummary || {};
    await safeQuery(`INSERT INTO market.macro_scanner_ai_summaries (summary, strongest_macro_bullish_assets, strongest_macro_bearish_assets, best_currency_macro_opportunities, central_bank_divergence_opportunities, yield_supported_opportunities, inflation_growth_risks, commodity_macro_themes, macro_conflicts, assets_to_monitor, assets_to_avoid, recommended_next_step, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`, [ai.summary || "Macro summary unavailable.", ai.strongestMacroBullishAssets, ai.strongestMacroBearishAssets, ai.bestCurrencyMacroOpportunities, ai.centralBankDivergenceOpportunities, ai.yieldSupportedOpportunities, ai.inflationGrowthRisks, ai.commodityMacroThemes, ai.macroConflicts, ai.assetsToMonitor, ai.assetsToAvoid, ai.recommendedNextStep, JSON.stringify({ actor, action })]);
    return { accepted: true, type: "macro_scanner.ai_summary.saved" };
  }
  return { accepted: true, type: `macro_scanner.${action}.recorded` };
}

export async function exportMacroScannerReport() {
  return getMacroScannerEngine();
}
