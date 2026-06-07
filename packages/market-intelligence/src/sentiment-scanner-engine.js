import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

export const SENTIMENT_SCANNER_TABLES = Object.freeze([
  "market.asset_sentiment_scores",
  "market.asset_sentiment_source_scores",
  "market.asset_sentiment_rankings",
  "market.asset_news_sentiment_alignment",
  "market.asset_social_sentiment_alignment",
  "market.asset_sentiment_divergences",
  "market.asset_extreme_sentiment_risks",
  "market.asset_sentiment_momentum",
  "market.sentiment_scanner_weights",
  "market.sentiment_scanner_runs",
  "market.sentiment_scanner_ai_summaries",
  "market.sentiment_scanner_alerts",
  "market.sentiment_scanner_audit_logs"
]);

const SOURCE_TABLES = Object.freeze([
  "market.asset_universe",
  "market.sentiment_intelligence_scores",
  "market.instrument_sentiment_states",
  "market.currency_sentiment_matrix",
  "market.sentiment_divergence_events",
  "market.sentiment_extreme_risks",
  "market.sentiment_timeline_events"
]);

const permissions = () => ({
  view: "universe_scanner.sentiment.view",
  runScan: "universe_scanner.sentiment.run_scan",
  recalculate: "universe_scanner.sentiment.recalculate",
  configureRules: "universe_scanner.sentiment.configure_rules",
  createAlert: "universe_scanner.sentiment.create_alert",
  export: "universe_scanner.sentiment.export"
});

const round = value => value === null || value === undefined || Number.isNaN(Number(value)) ? null : Math.round(Number(value));
const avg = values => {
  const valid = values.filter(value => value !== null && value !== undefined && !Number.isNaN(Number(value))).map(Number);
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
};

async function safeQuery(sql, params = []) {
  try { return await query(sql, params); }
  catch (error) {
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
    engine: "SentimentScannerEngine",
    sourceMode: "LIVE_SENTIMENT_INPUTS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveSentimentInputsOnly: true, lastSentimentScan: null, sentimentScannerHealth: "Insufficient Data" },
    summary: {
      assetsScanned: 0,
      sentimentBullishAssets: 0,
      sentimentBearishAssets: 0,
      mixedSentimentAssets: 0,
      newsAlignedAssets: 0,
      socialAlignedAssets: 0,
      divergenceSignals: 0,
      extremeSentimentAlerts: 0,
      contrarianRiskAssets: 0,
      crowdOvercrowdingAlerts: 0,
      sentimentQualifiedAssets: 0,
      averageSentimentScore: null,
      averageSentimentConfidence: null,
      scannerHealth: "Insufficient Data"
    },
    matrix: [],
    rankings: [],
    newsAlignment: [],
    socialAlignment: [],
    divergence: [],
    extremeRisk: [],
    momentum: [],
    heatmap: [],
    weights: [],
    aiSummary: null,
    alerts: [],
    audit: [],
    emptyState: {
      title: "Sentiment scanner cannot calculate sentiment yet.",
      message: "Connect news sentiment, social sentiment, unified sentiment intelligence, and live asset mappings before running a sentiment scan.",
      actions: ["Open News Sentiment", "Open Social Sentiment", "Open Sentiment Intelligence", "Run Sentiment Scan"]
    }
  };
}

function normalize(value) {
  return String(value || "").toUpperCase().replaceAll("/", "").replaceAll("-", "").replaceAll("_", "").replace(/\s+/g, "");
}

function sentimentScore(label, fallback = null) {
  const value = String(label || "").toLowerCase();
  if (!label || /insufficient|unavailable|no data|unknown/.test(value)) return fallback;
  if (/strong.*bullish/.test(value)) return 100;
  if (/mild.*bullish/.test(value)) return 25;
  if (/bullish|buy/.test(value)) return 75;
  if (/strong.*bearish/.test(value)) return -100;
  if (/mild.*bearish/.test(value)) return -25;
  if (/bearish|sell/.test(value)) return -75;
  if (/mixed|neutral|wait/.test(value)) return 0;
  return fallback;
}

function labelFromScore(score) {
  if (score === null || score === undefined) return "No Data";
  if (score >= 90) return "Strong Bullish";
  if (score >= 50) return "Bullish";
  if (score > 10) return "Mild Bullish";
  if (score <= -90) return "Strong Bearish";
  if (score <= -50) return "Bearish";
  if (score < -10) return "Mild Bearish";
  return "Neutral";
}

function qualification(score, confidence) {
  if (score === null || confidence === null || confidence < 35) return "Insufficient Data";
  if (Math.abs(score) >= 50 && confidence >= 55) return "Sentiment Qualified";
  if (confidence >= 45) return "Watchlist";
  return "Insufficient Data";
}

function cell(label, score, confidence, updatedAt) {
  return {
    label: label || "No Data",
    score: round(score),
    confidence: round(confidence),
    freshness: updatedAt ? new Date(updatedAt).toISOString() : "No record"
  };
}

async function activeAssets() {
  await syncAssetUniverseFromLiveSources();
  const { rows } = await safeQuery(`
    SELECT id, COALESCE(asset_code, asset, broker_symbol) AS asset, asset_class AS "assetClass",
      base_asset AS "baseAsset", quote_asset AS "quoteAsset", updated_at AS "updatedAt"
    FROM market.asset_universe
    WHERE active AND scanner_enabled
    ORDER BY asset
  `);
  return rows;
}

async function sourceContext() {
  const [assets, states, score, currencies, divergences, extreme, momentum, macro, institutional] = await Promise.all([
    activeAssets(),
    safeQuery(`SELECT DISTINCT ON (instrument) id, instrument, asset_class AS "assetClass", news_sentiment AS "newsSentiment", social_sentiment AS "socialSentiment", macro_bias AS "macroBias", cot_bias AS "cotBias", price_confirmation AS "priceConfirmation", volatility_risk AS "volatilityRisk", overall_sentiment AS "overallSentiment", confidence, trading_bias AS "tradingBias", payload, updated_at AS "updatedAt" FROM market.instrument_sentiment_states ORDER BY instrument, updated_at DESC`).then(r => r.rows.map(row => ({ ...row, confidence: round(row.confidence), sentimentScore: round(row.payload?.sentimentScore) }))),
    safeQuery(`SELECT overall_market_sentiment AS "overallMarketSentiment", risk_tone AS "riskTone", bullish_instruments AS "bullishInstruments", bearish_instruments AS "bearishInstruments", mixed_signals AS "mixedSignals", extreme_sentiment AS "extremeSentiment", overcrowded_trades AS "overcrowdedTrades", sentiment_divergence AS "sentimentDivergence", news_sentiment AS "newsSentiment", social_sentiment AS "socialSentiment", cot_positioning AS "cotPositioning", sentiment_confidence AS "sentimentConfidence", overall_sentiment_score AS "overallSentimentScore", calculated_at AS "calculatedAt" FROM market.sentiment_intelligence_scores ORDER BY calculated_at DESC LIMIT 1`).then(r => r.rows[0] ? { ...r.rows[0], sentimentConfidence: round(r.rows[0].sentimentConfidence), overallSentimentScore: round(r.rows[0].overallSentimentScore) } : null),
    safeQuery(`SELECT currency, news, social, macro, cot, price, overall, confidence, risk, updated_at AS "updatedAt" FROM market.currency_sentiment_matrix ORDER BY updated_at DESC`).then(r => r.rows.map(row => ({ ...row, confidence: round(row.confidence) }))),
    safeQuery(`SELECT instrument AS asset, news, social, macro, cot AS institutional, price, agreement_level AS "agreementLevel", divergence_type AS "divergenceType", risk_level AS "riskLevel", recommendation, created_at AS "createdAt" FROM market.sentiment_divergence_events ORDER BY created_at DESC LIMIT 100`).then(r => r.rows),
    safeQuery(`SELECT risk_type AS "riskType", instrument AS asset, risk_label AS "riskLabel", description, recommendation, payload, created_at AS "createdAt" FROM market.sentiment_extreme_risks ORDER BY created_at DESC LIMIT 100`).then(r => r.rows),
    safeQuery(`SELECT instrument AS asset, previous_sentiment AS "previousSentiment", current_sentiment AS "currentSentiment", change, trigger, confidence, created_at AS "lastUpdated" FROM market.sentiment_timeline_events ORDER BY created_at DESC LIMIT 100`).then(r => r.rows.map(row => ({ ...row, confidence: round(row.confidence) }))),
    safeQuery(`SELECT usd_macro_bias AS "usdMacroBias", gold_macro_bias AS "goldMacroBias", risk_tone AS "riskTone", macro_confidence AS "macroConfidence", calculated_at AS "calculatedAt" FROM market.macro_intelligence_scores ORDER BY calculated_at DESC LIMIT 1`).then(r => r.rows[0] || null),
    safeQuery(`SELECT institutional_bias AS "institutionalBias", smart_money_direction AS "smartMoneyDirection", institutional_confidence AS "institutionalConfidence", calculated_at AS "calculatedAt" FROM market.institutional_intelligence_scores ORDER BY calculated_at DESC LIMIT 1`).then(r => r.rows[0] || null)
  ]);
  return { assets, states, score, currencies, divergences, extreme, momentum, macro, institutional };
}

function stateByAsset(states) {
  const map = new Map();
  for (const row of states) map.set(normalize(row.instrument), row);
  return map;
}

function currencyByKey(rows) {
  const map = new Map();
  for (const row of rows) map.set(normalize(row.currency), row);
  return map;
}

function assetCurrencies(asset) {
  const symbol = normalize(asset.asset);
  const parts = [asset.baseAsset, asset.quoteAsset].filter(Boolean);
  if (parts.length) return parts.map(value => String(value).toUpperCase());
  if (symbol.includes("XAU")) return ["XAU", "USD"];
  if (symbol.includes("OIL")) return ["OIL", "USD"];
  if (symbol.length === 6) return [symbol.slice(0, 3), symbol.slice(3, 6)];
  return [symbol.slice(0, 3)];
}

function deriveAsset(asset, context) {
  const direct = stateByAsset(context.states).get(normalize(asset.asset));
  const currencies = currencyByKey(context.currencies);
  const related = assetCurrencies(asset).map(key => currencies.get(normalize(key))).filter(Boolean);
  const scoreValues = [
    direct?.sentimentScore ?? sentimentScore(direct?.overallSentiment),
    ...related.map(row => sentimentScore(row.overall)),
    context.score?.overallSentimentScore
  ].filter(value => value !== null && value !== undefined);
  const score = scoreValues.length ? avg(scoreValues) : null;
  const confidence = avg([direct?.confidence, ...related.map(row => row.confidence), context.score?.sentimentConfidence].filter(value => value !== null && value !== undefined));
  const news = direct?.newsSentiment || related.find(row => row.news)?.news || context.score?.newsSentiment || "No Data";
  const social = direct?.socialSentiment || related.find(row => row.social)?.social || context.score?.socialSentiment || "No Data";
  const unified = direct?.overallSentiment || labelFromScore(score);
  const macro = direct?.macroBias || related.find(row => row.macro)?.macro || context.macro?.riskTone || "No Data";
  const crowd = direct?.tradingBias || related.find(row => row.overall)?.overall || "No Data";
  const contrarian = /strong|extreme/i.test(`${unified} ${crowd}`) ? "Elevated" : "Low";
  const alignment = sentimentScore(news) !== null && sentimentScore(social) !== null && Math.sign(sentimentScore(news)) === Math.sign(sentimentScore(social)) ? "Aligned" : /unavailable|No Data|Insufficient/i.test(`${news} ${social}`) ? "No Data" : "Mixed";
  return {
    assetId: asset.id,
    asset: asset.asset,
    assetClass: asset.assetClass || direct?.assetClass || "Unclassified",
    newsSentiment: news,
    socialSentiment: social,
    unifiedSentiment: unified,
    macroSentiment: macro,
    crowdBias: crowd,
    contrarianRisk: contrarian,
    sentimentAlignment: alignment,
    sentimentScore: score,
    confidence,
    qualification: qualification(score, confidence),
    lastScanned: direct?.updatedAt || related.map(row => row.updatedAt).filter(Boolean).sort().at(-1) || context.score?.calculatedAt || asset.updatedAt,
    source: { direct, related }
  };
}

function buildMatrix(rows) {
  return rows.map(row => ({
    assetId: row.assetId,
    asset: row.asset,
    assetClass: row.assetClass,
    newsSentiment: cell(row.newsSentiment, sentimentScore(row.newsSentiment), row.confidence, row.lastScanned),
    socialSentiment: cell(row.socialSentiment, sentimentScore(row.socialSentiment), row.confidence, row.lastScanned),
    unifiedSentiment: cell(row.unifiedSentiment, row.sentimentScore, row.confidence, row.lastScanned),
    macroSentiment: cell(row.macroSentiment, sentimentScore(row.macroSentiment), row.confidence, row.lastScanned),
    crowdBias: cell(row.crowdBias, sentimentScore(row.crowdBias), row.confidence, row.lastScanned),
    contrarianRisk: cell(row.contrarianRisk, /high|extreme/i.test(row.contrarianRisk) ? 80 : /elevated/i.test(row.contrarianRisk) ? 55 : 15, row.confidence, row.lastScanned),
    sentimentAlignment: cell(row.sentimentAlignment, row.sentimentAlignment === "Aligned" ? 80 : row.sentimentAlignment === "Mixed" ? 40 : null, row.confidence, row.lastScanned),
    sentimentScore: row.sentimentScore,
    confidence: row.confidence,
    lastUpdated: row.lastScanned
  }));
}

function buildRankings(rows) {
  return rows.slice().sort((a, b) => Math.abs(Number(b.sentimentScore || 0)) - Math.abs(Number(a.sentimentScore || 0))).map((row, index) => ({
    rank: index + 1,
    assetId: row.assetId,
    asset: row.asset,
    assetClass: row.assetClass,
    newsSentiment: row.newsSentiment,
    socialSentiment: row.socialSentiment,
    unifiedSentiment: row.unifiedSentiment,
    crowdBias: row.crowdBias,
    contrarianRisk: row.contrarianRisk,
    alignmentScore: row.sentimentAlignment === "Aligned" ? 80 : row.sentimentAlignment === "Mixed" ? 40 : null,
    divergenceScore: row.sentimentAlignment === "Mixed" ? 60 : 0,
    sentimentScore: row.sentimentScore,
    confidence: row.confidence,
    qualification: row.qualification,
    lastScanned: row.lastScanned
  }));
}

function newsAlignment(rows) {
  return rows.map(row => ({
    asset: row.asset,
    newsSentiment: row.newsSentiment,
    mainNewsDriver: row.newsSentiment === "Input unavailable" || row.newsSentiment === "No Data" ? "No production news sentiment record" : row.newsSentiment,
    impactLevel: Math.abs(Number(sentimentScore(row.newsSentiment) || 0)) >= 75 ? "High" : row.newsSentiment === "No Data" ? "No Data" : "Medium",
    affectedCurrency: assetCurrencies(row).join(", "),
    affectedInstrument: row.asset,
    newsFreshness: row.lastScanned,
    alignmentStatus: sentimentScore(row.newsSentiment) > 0 ? "Aligned Bullish" : sentimentScore(row.newsSentiment) < 0 ? "Aligned Bearish" : /No Data|unavailable|Insufficient/i.test(row.newsSentiment) ? "No Data" : "Neutral",
    confidence: row.confidence,
    recommendedAction: row.qualification === "Sentiment Qualified" ? "Send to Opportunity Ranking" : "Watchlist"
  }));
}

function socialAlignment(rows) {
  return rows.map(row => ({
    asset: row.asset,
    socialSentiment: row.socialSentiment,
    mentionVolume: null,
    bullishMentionsPercent: null,
    bearishMentionsPercent: null,
    viralityScore: null,
    influencerWeight: null,
    crowdBias: row.crowdBias,
    alignmentStatus: sentimentScore(row.socialSentiment) > 0 ? "Aligned Bullish" : sentimentScore(row.socialSentiment) < 0 ? "Aligned Bearish" : /No Data|unavailable|Insufficient/i.test(row.socialSentiment) ? "No Data" : "Neutral",
    confidence: row.confidence
  }));
}

function divergenceRows(rows, context) {
  const persisted = context.divergences.map(row => ({
    asset: row.asset,
    divergenceType: row.divergenceType,
    news: row.news,
    social: row.social,
    price: row.price,
    macro: row.macro,
    institutional: row.institutional,
    severity: row.riskLevel,
    tradingInterpretation: row.agreementLevel,
    recommendedAction: row.recommendation,
    observedAt: row.createdAt
  }));
  if (persisted.length) return persisted;
  return rows.filter(row => row.sentimentAlignment === "Mixed").map(row => ({
    asset: row.asset,
    divergenceType: "News / Social Sentiment Divergence",
    news: row.newsSentiment,
    social: row.socialSentiment,
    price: row.source.direct?.priceConfirmation || "No Data",
    macro: row.macroSentiment,
    institutional: context.institutional?.institutionalBias || "No Data",
    severity: "Medium",
    tradingInterpretation: "Mixed sentiment inputs require confirmation.",
    recommendedAction: "Review before Opportunity Ranking",
    observedAt: row.lastScanned
  }));
}

function extremeRiskRows(rows, context) {
  if (context.extreme.length) {
    return context.extreme.map(row => ({
      asset: row.asset || "ALL",
      extremeSentimentType: row.riskType,
      crowdDirection: row.riskLabel,
      mentionVolume: null,
      contrarianRiskScore: /high|extreme/i.test(row.riskLabel) ? 80 : 30,
      reversalRisk: row.description,
      confidence: null,
      recommendedAction: row.recommendation,
      observedAt: row.createdAt
    }));
  }
  return rows.filter(row => Math.abs(Number(row.sentimentScore || 0)) >= 75).map(row => ({
    asset: row.asset,
    extremeSentimentType: row.sentimentScore > 0 ? "Overcrowded bullish sentiment" : "Overcrowded bearish sentiment",
    crowdDirection: row.crowdBias,
    mentionVolume: null,
    contrarianRiskScore: Math.abs(Number(row.sentimentScore || 0)),
    reversalRisk: row.contrarianRisk,
    confidence: row.confidence,
    recommendedAction: "Watch contrarian reversal risk",
    observedAt: row.lastScanned
  }));
}

function momentumRows(rows, context) {
  if (context.momentum.length) {
    return context.momentum.map(row => ({
      asset: row.asset || "ALL",
      previousSentiment: row.previousSentiment,
      currentSentiment: row.currentSentiment,
      sentimentChange: row.change,
      momentumDirection: row.change,
      trigger: row.trigger,
      confidence: row.confidence,
      lastUpdated: row.lastUpdated
    }));
  }
  return rows.map(row => ({
    asset: row.asset,
    previousSentiment: "No Data",
    currentSentiment: row.unifiedSentiment,
    sentimentChange: "No production previous sentiment record",
    momentumDirection: "No Data",
    trigger: "No Data",
    confidence: row.confidence,
    lastUpdated: row.lastScanned
  }));
}

function heatmapRows(rows) {
  return rows.flatMap(row => [
    ["News", row.newsSentiment, sentimentScore(row.newsSentiment)],
    ["Social", row.socialSentiment, sentimentScore(row.socialSentiment)],
    ["Unified", row.unifiedSentiment, row.sentimentScore],
    ["Macro", row.macroSentiment, sentimentScore(row.macroSentiment)],
    ["Crowd", row.crowdBias, sentimentScore(row.crowdBias)],
    ["Contrarian", row.contrarianRisk, /high|extreme/i.test(row.contrarianRisk) ? 80 : /elevated/i.test(row.contrarianRisk) ? 55 : 15],
    ["Overall", row.unifiedSentiment, row.sentimentScore]
  ].map(([source, state, score]) => ({ asset: row.asset, source, state, score: round(score), confidence: row.confidence })));
}

function buildSummary(rows, divergence, extreme) {
  return {
    assetsScanned: rows.length,
    sentimentBullishAssets: rows.filter(row => Number(row.sentimentScore || 0) > 10 || /bullish/i.test(row.unifiedSentiment)).length,
    sentimentBearishAssets: rows.filter(row => Number(row.sentimentScore || 0) < -10 || /bearish/i.test(row.unifiedSentiment)).length,
    mixedSentimentAssets: rows.filter(row => /mixed|neutral/i.test(`${row.unifiedSentiment} ${row.sentimentAlignment}`)).length,
    newsAlignedAssets: rows.filter(row => /Aligned/.test(newsAlignment([row])[0].alignmentStatus)).length,
    socialAlignedAssets: rows.filter(row => /Aligned/.test(socialAlignment([row])[0].alignmentStatus)).length,
    divergenceSignals: divergence.length,
    extremeSentimentAlerts: extreme.length,
    contrarianRiskAssets: rows.filter(row => /elevated|high|extreme/i.test(row.contrarianRisk)).length,
    crowdOvercrowdingAlerts: extreme.filter(row => /overcrowded|fomo|panic/i.test(row.extremeSentimentType || "")).length,
    sentimentQualifiedAssets: rows.filter(row => row.qualification === "Sentiment Qualified").length,
    averageSentimentScore: avg(rows.map(row => row.sentimentScore)),
    averageSentimentConfidence: avg(rows.map(row => row.confidence)),
    scannerHealth: rows.length ? "Healthy" : "Insufficient Data"
  };
}

async function latestRun() {
  const { rows } = await safeQuery(`SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "durationMs", assets_scanned AS "assetsScanned", health FROM market.sentiment_scanner_runs ORDER BY started_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function weights() {
  const { rows } = await safeQuery(`SELECT component_key AS "componentKey", component_name AS "componentName", weight, enabled, updated_at AS "updatedAt" FROM market.sentiment_scanner_weights ORDER BY component_name`);
  return rows.map(row => ({ ...row, weight: round(row.weight) }));
}

async function alerts() {
  const { rows } = await safeQuery(`SELECT alert_type AS "alertType", title, severity, asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.sentiment_scanner_alerts ORDER BY created_at DESC LIMIT 80`);
  return rows;
}

async function audit(assetId = null) {
  const { rows } = await safeQuery(`SELECT asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.sentiment_scanner_audit_logs ${assetId ? "WHERE asset_id = $1" : ""} ORDER BY created_at DESC LIMIT 80`, assetId ? [assetId] : []);
  return rows;
}

async function persistedAiSummary() {
  const { rows } = await safeQuery(`SELECT strongest_sentiment_bullish_assets AS "strongestSentimentBullishAssets", strongest_sentiment_bearish_assets AS "strongestSentimentBearishAssets", news_supported_opportunities AS "newsSupportedOpportunities", social_supported_opportunities AS "socialSupportedOpportunities", mixed_sentiment_risks AS "mixedSentimentRisks", contrarian_warnings AS "contrarianWarnings", crowd_overcrowding_risks AS "crowdOvercrowdingRisks", assets_to_monitor AS "assetsToMonitor", assets_to_avoid AS "assetsToAvoid", recommended_next_step AS "recommendedNextStep", summary, generated_at AS "generatedAt" FROM market.sentiment_scanner_ai_summaries ORDER BY generated_at DESC LIMIT 1`);
  return rows[0] || null;
}

function aiSummary(rows, divergence, extreme) {
  const sorted = rows.slice().sort((a, b) => Number(b.sentimentScore || 0) - Number(a.sentimentScore || 0));
  return {
    strongestSentimentBullishAssets: sorted.filter(row => Number(row.sentimentScore || 0) > 10).slice(0, 8).map(row => row.asset).join(", ") || "Insufficient Data",
    strongestSentimentBearishAssets: sorted.filter(row => Number(row.sentimentScore || 0) < -10).slice(-8).map(row => row.asset).join(", ") || "Insufficient Data",
    newsSupportedOpportunities: rows.filter(row => sentimentScore(row.newsSentiment) !== null).slice(0, 8).map(row => `${row.asset}: ${row.newsSentiment}`).join(", ") || "Insufficient Data",
    socialSupportedOpportunities: rows.filter(row => sentimentScore(row.socialSentiment) !== null).slice(0, 8).map(row => `${row.asset}: ${row.socialSentiment}`).join(", ") || "Insufficient Data",
    mixedSentimentRisks: divergence.slice(0, 8).map(row => `${row.asset}: ${row.divergenceType}`).join(", ") || "Insufficient Data",
    contrarianWarnings: extreme.slice(0, 8).map(row => `${row.asset}: ${row.extremeSentimentType}`).join(", ") || "Insufficient Data",
    crowdOvercrowdingRisks: extreme.filter(row => /overcrowded|fomo|panic/i.test(row.extremeSentimentType || "")).map(row => row.asset).join(", ") || "Insufficient Data",
    assetsToMonitor: sorted.slice(0, 8).map(row => row.asset).join(", ") || "Insufficient Data",
    assetsToAvoid: rows.filter(row => row.qualification === "Insufficient Data").slice(0, 8).map(row => row.asset).join(", ") || "Insufficient Data",
    recommendedNextStep: "Confirm sentiment-qualified assets with Macro, Institutional, Risk, and Opportunity Ranking.",
    summary: `${rows.length} active assets scanned from production sentiment intelligence records.`
  };
}

async function liveOutput() {
  const context = await sourceContext();
  const [run, weightRows, alertRows, auditRows, persistedAi] = await Promise.all([latestRun(), weights(), alerts(), audit(), persistedAiSummary()]);
  const rows = context.assets.map(asset => deriveAsset(asset, context));
  if (!rows.length || (!context.states.length && !context.score && !context.currencies.length)) {
    return { ...emptyState("EMPTY", "Sentiment scanner cannot calculate sentiment yet."), schemaReady: true, weights: weightRows, alerts: alertRows, audit: auditRows };
  }
  const divergence = divergenceRows(rows, context);
  const extremeRisk = extremeRiskRows(rows, context);
  const momentum = momentumRows(rows, context);
  const summary = buildSummary(rows, divergence, extremeRisk);
  return {
    engine: "SentimentScannerEngine",
    sourceMode: "LIVE_SENTIMENT_INPUTS_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveSentimentInputsOnly: true, lastSentimentScan: rows.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || run?.completedAt || null, sentimentScannerHealth: summary.scannerHealth },
    latestRun: run,
    summary,
    matrix: buildMatrix(rows),
    rankings: buildRankings(rows),
    newsAlignment: newsAlignment(rows),
    socialAlignment: socialAlignment(rows),
    divergence,
    extremeRisk,
    momentum,
    heatmap: heatmapRows(rows),
    weights: weightRows,
    aiSummary: persistedAi || aiSummary(rows, divergence, extremeRisk),
    alerts: alertRows,
    audit: auditRows,
    emptyState: null
  };
}

export async function getSentimentScannerEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness(SENTIMENT_SCANNER_TABLES);
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  const sourceReady = await tableReadiness(SOURCE_TABLES);
  if (!sourceReady.ready) return emptyState("SCHEMA_NOT_READY", `Missing source tables: ${sourceReady.missing.join(", ")}`, sourceReady.missing);
  return liveOutput();
}

export async function getSentimentScannerSlice(slice) {
  const data = await getSentimentScannerEngine();
  const map = {
    summary: { status: data.status, badges: data.badges, summary: data.summary },
    matrix: { status: data.status, matrix: data.matrix },
    rankings: { status: data.status, rankings: data.rankings },
    "news-alignment": { status: data.status, newsAlignment: data.newsAlignment },
    "social-alignment": { status: data.status, socialAlignment: data.socialAlignment },
    divergence: { status: data.status, divergence: data.divergence },
    "extreme-risk": { status: data.status, extremeRisk: data.extremeRisk },
    momentum: { status: data.status, momentum: data.momentum },
    heatmap: { status: data.status, heatmap: data.heatmap },
    "ai-summary": { status: data.status, aiSummary: data.aiSummary },
    export: data
  };
  return map[slice] || data;
}

export async function getSentimentScannerAssetDetail(assetId) {
  const data = await getSentimentScannerEngine();
  const id = normalize(assetId);
  const asset = data.rankings.find(row => normalize(row.assetId || row.asset) === id || normalize(row.asset) === id);
  if (!asset) return null;
  return {
    asset,
    matrix: data.matrix.find(row => normalize(row.asset) === normalize(asset.asset)),
    newsAlignment: data.newsAlignment.filter(row => normalize(row.asset) === normalize(asset.asset)),
    socialAlignment: data.socialAlignment.filter(row => normalize(row.asset) === normalize(asset.asset)),
    divergence: data.divergence.filter(row => normalize(row.asset) === normalize(asset.asset)),
    extremeRisk: data.extremeRisk.filter(row => normalize(row.asset) === normalize(asset.asset)),
    momentum: data.momentum.filter(row => normalize(row.asset) === normalize(asset.asset) || row.asset === "ALL"),
    heatmap: data.heatmap.filter(row => normalize(row.asset) === normalize(asset.asset)),
    aiSummary: data.aiSummary,
    alerts: data.alerts.filter(row => normalize(row.asset) === normalize(asset.asset)),
    audit: data.audit.filter(row => !row.assetId || String(row.assetId) === String(asset.assetId))
  };
}

async function assertReady() {
  if (!isDatabaseConfigured()) {
    const error = new Error("database_not_configured");
    error.status = 503;
    throw error;
  }
  const ready = await tableReadiness(SENTIMENT_SCANNER_TABLES);
  if (!ready.ready) {
    const error = new Error("schema_not_ready");
    error.status = 503;
    error.missingTables = ready.missing;
    throw error;
  }
}

export async function runSentimentScannerAction(action, body = {}, actor = "api", assetId = null) {
  await assertReady();
  if (action === "run-scan" || action === "recalculate") {
    const data = await liveOutput();
    await withTransaction(async client => {
      const runKey = `SENT-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
      await client.query(`INSERT INTO market.sentiment_scanner_runs (run_key, status, completed_at, assets_scanned, health, triggered_by, payload) VALUES ($1,'Completed',now(),$2,$3,$4,$5::jsonb)`, [runKey, data.summary.assetsScanned, data.summary.scannerHealth, actor, JSON.stringify({ action })]);
      await client.query(`INSERT INTO market.sentiment_scanner_audit_logs (user_name, action, entity_type, reason, payload) VALUES ($1,$2,'sentiment_scanner',$3,$4::jsonb)`, [actor, action, body.reason || null, JSON.stringify({ assetsScanned: data.summary.assetsScanned })]);
    });
    return { accepted: true, type: `sentiment_scanner.${action}`, status: data.status, assetsScanned: data.summary.assetsScanned };
  }
  if (action === "recalculate-asset") {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(assetId || "")) ? assetId : null;
    await safeQuery(`INSERT INTO market.sentiment_scanner_audit_logs (asset_id, user_name, action, entity_type, entity_id, reason, payload) VALUES ($1::uuid,$2,'recalculate_asset','asset_sentiment_score',$3,$4,$5::jsonb)`, [uuid, actor, assetId, body.reason || null, JSON.stringify({ assetId })]);
    return { accepted: true, type: "sentiment_scanner.asset.recalculated", assetId };
  }
  if (action === "create-alert") {
    await safeQuery(`INSERT INTO market.sentiment_scanner_alerts (alert_type, title, severity, asset, created_by, payload) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [body.alertType || "sentiment_scanner", body.title || "Sentiment scanner alert", body.severity || "Info", body.asset || null, actor, JSON.stringify(body)]);
    return { accepted: true, type: "sentiment_scanner.alert.created" };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    const data = await liveOutput();
    const ai = data.aiSummary || {};
    await safeQuery(`INSERT INTO market.sentiment_scanner_ai_summaries (summary, strongest_sentiment_bullish_assets, strongest_sentiment_bearish_assets, news_supported_opportunities, social_supported_opportunities, mixed_sentiment_risks, contrarian_warnings, crowd_overcrowding_risks, assets_to_monitor, assets_to_avoid, recommended_next_step, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`, [ai.summary, ai.strongestSentimentBullishAssets, ai.strongestSentimentBearishAssets, ai.newsSupportedOpportunities, ai.socialSupportedOpportunities, ai.mixedSentimentRisks, ai.contrarianWarnings, ai.crowdOvercrowdingRisks, ai.assetsToMonitor, ai.assetsToAvoid, ai.recommendedNextStep, JSON.stringify({ actor, action })]);
    return { accepted: true, type: "sentiment_scanner.ai_summary.saved" };
  }
  return { accepted: true, type: `sentiment_scanner.${action}.recorded` };
}

export async function exportSentimentScannerReport() {
  return getSentimentScannerEngine();
}
