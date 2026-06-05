import { isDatabaseConfigured, query, withTransaction } from "./db.js";

export const SENTIMENT_INTELLIGENCE_TABLES = Object.freeze([
  "market.sentiment_intelligence_scores",
  "market.sentiment_intelligence_inputs",
  "market.instrument_sentiment_states",
  "market.currency_sentiment_matrix",
  "market.sentiment_divergence_events",
  "market.sentiment_extreme_risks",
  "market.sentiment_timeline_events",
  "market.sentiment_ai_summaries",
  "market.sentiment_alerts",
  "market.sentiment_audit_logs"
]);

const HEALTHY_STATUSES = new Set(["ONLINE", "LIVE", "SYNCED", "READY", "PASSED", "HEALTHY"]);
const INPUTS = Object.freeze([
  ["news-sentiment", "News Sentiment", 1.2],
  ["social-sentiment", "Social Sentiment", 1.1],
  ["economic-calendar", "Economic Calendar", 0.9],
  ["macro-intelligence", "Macro Intelligence", 1],
  ["market-environment", "Market Environment", 1],
  ["institutional-cot-data", "COT Reports", 0.9],
  ["price-action", "Price Action", 1],
  ["volatility-data", "Volatility Data", 0.8],
  ["broker-data", "Broker Spread Data", 0.7],
  ["central-bank-tone", "Central Bank Tone", 0.8]
]);
const MATRIX = Object.freeze(["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "XAU", "Oil", "BTC"]);

const n = value => value === null || value === undefined || value === "" ? null : Number(value);
const avg = values => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value), 0) / values.length) : null;
const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value || 0))));

function permissions() {
  return {
    view: "market_intelligence.sentiment_intelligence.view",
    recalculate: "market_intelligence.sentiment_intelligence.recalculate",
    configureInputs: "market_intelligence.sentiment_intelligence.configure_inputs",
    export: "market_intelligence.sentiment_intelligence.export",
    createAlert: "market_intelligence.sentiment_intelligence.create_alert"
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
    badges: { productionLive: true, mockDataDisabled: true, liveInputsOnly: true, lastCalculation: null, sentimentConfidenceScore: null },
    summary: [],
    inputs: [],
    instruments: [],
    currencyMatrix: [],
    divergence: [],
    extremeRisk: [],
    timeline: [],
    aiSummary: null,
    alerts: [],
    audit: []
  };
}

async function tableReadiness() {
  const { rows } = await query(
    "SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name",
    [SENTIMENT_INTELLIGENCE_TABLES]
  );
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function classifyAsset(symbol) {
  const value = String(symbol || "").toUpperCase();
  if (value.includes("XAU")) return "Metals";
  if (value.includes("OIL")) return "Commodities";
  if (value.includes("BTC")) return "Crypto";
  if (value.includes("NAS") || value.includes("SPX") || value.includes("US30")) return "Indices";
  return "Forex";
}

function sentimentLabel(score) {
  if (score === null || score === undefined) return "Insufficient Data";
  if (score >= 90) return "Strong Bullish";
  if (score >= 50) return "Bullish";
  if (score >= 15) return "Mild Bullish";
  if (score <= -90) return "Strong Bearish";
  if (score <= -50) return "Bearish";
  if (score <= -15) return "Mild Bearish";
  return "Neutral";
}

function tradingBias(score, confidence) {
  if (confidence < 45) return "Insufficient Data";
  if (Math.abs(score) < 15) return "Neutral";
  if (confidence < 65) return "Wait";
  if (score >= 50) return "Buy Bias";
  if (score <= -50) return "Sell Bias";
  return "Wait";
}

function sourceByKey(snapshots, key) {
  return snapshots.find(source => [source.id, source.routeSlug, source.category].includes(key));
}

async function latestContext() {
  if (!isDatabaseConfigured()) return {};
  const context = {};
  try {
    const { rows } = await query(`SELECT global_macro_regime, risk_tone, usd_macro_bias, gold_macro_bias, macro_confidence, calculated_at FROM market.macro_intelligence_scores ORDER BY calculated_at DESC LIMIT 1`);
    context.macro = rows[0] || null;
  } catch {}
  try {
    const { rows } = await query(`SELECT risk_tone, volatility_regime, market_stress_level, environment_score, confidence, calculated_at FROM market.market_environment_scores ORDER BY calculated_at DESC LIMIT 1`);
    context.marketEnvironment = rows[0] || null;
  } catch {}
  return context;
}

function inputsFromContext(snapshots = [], ticks = [], context = {}) {
  return INPUTS.map(([key, name, weight]) => {
    const source = sourceByKey(snapshots, key);
    const derived = key === "price-action" && ticks.length
      ? { provider: "Recorded MT5 Tick Repository", status: "SYNCED", health: 100, freshness: "Latest recorded ticks", lastUpdated: ticks[0]?.observed_at }
      : key === "volatility-data" && context.marketEnvironment
        ? { provider: "Market Environment Intelligence Center", status: "SYNCED", health: n(context.marketEnvironment.confidence), freshness: "Latest persisted volatility regime", lastUpdated: context.marketEnvironment.calculated_at }
        : key === "macro-intelligence" && context.macro
          ? { provider: "Macro Intelligence Center", status: "SYNCED", health: n(context.macro.macro_confidence), freshness: "Latest persisted macro score", lastUpdated: context.macro.calculated_at }
          : key === "market-environment" && context.marketEnvironment
            ? { provider: "Market Environment Intelligence Center", status: "SYNCED", health: n(context.marketEnvironment.confidence), freshness: "Latest persisted market environment score", lastUpdated: context.marketEnvironment.calculated_at }
            : key === "central-bank-tone" && context.macro
              ? { provider: "Macro Intelligence Center", status: "SYNCED", health: n(context.macro.macro_confidence), freshness: "Latest persisted central bank bias", lastUpdated: context.macro.calculated_at }
              : null;
    const status = String(derived?.status || source?.status || "UNKNOWN").toUpperCase();
    const health = n(derived?.health ?? source?.healthScore);
    const used = HEALTHY_STATUSES.has(status);
    return {
      inputKey: key,
      input: name,
      source: derived?.provider || source?.provider || source?.adapter || "Input unavailable",
      status,
      freshness: derived?.freshness || source?.freshness || "Input unavailable. Sentiment confidence score reduced.",
      health: health === null ? (used ? 100 : 0) : clamp(health),
      weight,
      lastUpdated: derived?.lastUpdated || source?.lastSyncAt || null,
      usedInScore: used,
      usedIn: used ? "Unified sentiment score" : "Input unavailable. Sentiment confidence score reduced."
    };
  });
}

function tickGroups(ticks = []) {
  const groups = new Map();
  for (const tick of ticks) {
    const symbol = String(tick.symbol || "").toUpperCase();
    if (!symbol) continue;
    const bid = n(tick.bid);
    const ask = n(tick.ask);
    const mid = bid !== null && ask !== null ? (bid + ask) / 2 : bid ?? ask;
    if (mid === null) continue;
    const rows = groups.get(symbol) || [];
    rows.push({ mid, observedAt: tick.observed_at || tick.observedAt || null });
    groups.set(symbol, rows);
  }
  return [...groups.entries()];
}

function scoreFromMacro(context) {
  const riskTone = String(context.macro?.risk_tone || context.marketEnvironment?.risk_tone || "");
  if (/risk-on|bullish/i.test(riskTone)) return 25;
  if (/risk-off|bearish|recession/i.test(riskTone)) return -25;
  return 0;
}

function instrumentsFromTicks(ticks, inputs, context) {
  const confidence = clamp(avg(inputs.filter(input => input.usedInScore).map(input => input.health)) ?? 0);
  const macroScore = scoreFromMacro(context);
  return tickGroups(ticks).map(([instrument, rows]) => {
    const first = rows[0]?.mid;
    const last = rows[rows.length - 1]?.mid ?? first;
    const priceScore = first ? Math.max(-100, Math.min(100, Math.round(((last - first) / Math.abs(first)) * 10000))) : 0;
    const overallScore = confidence >= 50 ? Math.round((priceScore + macroScore) / 2) : null;
    const overall = sentimentLabel(overallScore);
    return {
      instrument,
      assetClass: classifyAsset(instrument),
      newsSentiment: inputs.find(input => input.inputKey === "news-sentiment")?.usedInScore ? "Insufficient Data" : "Input unavailable",
      socialSentiment: inputs.find(input => input.inputKey === "social-sentiment")?.usedInScore ? "Insufficient Data" : "Input unavailable",
      macroBias: context.macro?.usd_macro_bias || "Insufficient Data",
      cotBias: inputs.find(input => input.inputKey === "institutional-cot-data")?.usedInScore ? "Insufficient Data" : "Input unavailable",
      priceConfirmation: priceScore > 15 ? "Bullish" : priceScore < -15 ? "Bearish" : "Neutral",
      volatilityRisk: context.marketEnvironment?.volatility_regime || "Insufficient Data",
      overallSentiment: overall,
      sentimentScore: overallScore ?? 0,
      confidence,
      tradingBias: tradingBias(overallScore ?? 0, confidence),
      lastUpdated: rows.reduce((latest, row) => row.observedAt && (!latest || row.observedAt > latest) ? row.observedAt : latest, null)
    };
  });
}

function currencyMatrix(inputs, instruments, context) {
  const confidence = clamp(avg(inputs.filter(input => input.usedInScore).map(input => input.health)) ?? 0);
  return MATRIX.map(currency => {
    const related = instruments.find(row => row.instrument.includes(currency === "Oil" ? "OIL" : currency === "XAU" ? "XAU" : currency === "BTC" ? "BTC" : currency));
    return {
      currency,
      news: "Insufficient Data",
      social: "Insufficient Data",
      macro: currency === "USD" ? context.macro?.usd_macro_bias || "Insufficient Data" : currency === "XAU" ? context.macro?.gold_macro_bias || "Insufficient Data" : "Insufficient Data",
      cot: "Insufficient Data",
      price: related?.priceConfirmation || "Insufficient Data",
      overall: related?.overallSentiment || (confidence >= 70 ? "Neutral" : "Insufficient Data"),
      confidence: related?.confidence ?? (confidence >= 70 ? confidence : 0),
      risk: related?.volatilityRisk || "Insufficient Data"
    };
  });
}

function divergenceRows(instruments) {
  return instruments.filter(row => row.confidence >= 50).slice(0, 20).map(row => ({
    instrument: row.instrument,
    news: row.newsSentiment,
    social: row.socialSentiment,
    macro: row.macroBias,
    cot: row.cotBias,
    price: row.priceConfirmation,
    agreementLevel: row.priceConfirmation === "Neutral" ? "Mixed" : "Partial Agreement",
    divergenceType: row.newsSentiment.includes("unavailable") || row.socialSentiment.includes("unavailable") ? "Input Gap" : "Signal Divergence",
    riskLevel: row.confidence < 65 ? "Medium" : "Low",
    recommendation: row.confidence < 65 ? "Wait for sentiment confirmation" : "Monitor price confirmation"
  }));
}

function scoreSummary(instruments, inputs, context) {
  const confidence = clamp(avg(inputs.filter(input => input.usedInScore).map(input => input.health)) ?? 0);
  const bullish = instruments.filter(row => row.sentimentScore > 15).length;
  const bearish = instruments.filter(row => row.sentimentScore < -15).length;
  const mixed = instruments.filter(row => Math.abs(row.sentimentScore) <= 15).length;
  const overallScore = instruments.length ? avg(instruments.map(row => row.sentimentScore)) : null;
  return {
    overallMarketSentiment: sentimentLabel(overallScore),
    riskTone: context.marketEnvironment?.risk_tone || context.macro?.risk_tone || "Insufficient Data",
    bullishInstruments: bullish,
    bearishInstruments: bearish,
    mixedSignals: mixed,
    extremeSentiment: instruments.filter(row => Math.abs(row.sentimentScore) >= 90).length,
    overcrowdedTrades: 0,
    sentimentDivergence: instruments.filter(row => row.newsSentiment.includes("unavailable") || row.socialSentiment.includes("unavailable")).length,
    newsSentiment: inputs.find(input => input.inputKey === "news-sentiment")?.usedInScore ? "Insufficient Data" : "Input unavailable",
    socialSentiment: inputs.find(input => input.inputKey === "social-sentiment")?.usedInScore ? "Insufficient Data" : "Input unavailable",
    cotPositioning: inputs.find(input => input.inputKey === "institutional-cot-data")?.usedInScore ? "Insufficient Data" : "Input unavailable",
    sentimentConfidence: confidence,
    overallSentimentScore: overallScore ?? 0
  };
}

function summaryCards(score) {
  const s = score || {};
  return [
    ["Overall Market Sentiment", s.overallMarketSentiment, "info"],
    ["Risk Tone", s.riskTone, "info"],
    ["Bullish Instruments", s.bullishInstruments, "ok"],
    ["Bearish Instruments", s.bearishInstruments, "bad"],
    ["Mixed Signals", s.mixedSignals, "warn"],
    ["Extreme Sentiment", s.extremeSentiment, "bad"],
    ["Overcrowded Trades", s.overcrowdedTrades, "warn"],
    ["Sentiment Divergence", s.sentimentDivergence, "warn"],
    ["News Sentiment", s.newsSentiment, "info"],
    ["Social Sentiment", s.socialSentiment, "info"],
    ["COT Positioning", s.cotPositioning, "info"],
    ["Sentiment Confidence", s.sentimentConfidence, "quality"]
  ];
}

function aiSummary(score, instruments, divergence) {
  const strongestBullish = instruments.filter(row => row.sentimentScore > 15).sort((a, b) => b.sentimentScore - a.sentimentScore).slice(0, 3).map(row => row.instrument).join(", ");
  const strongestBearish = instruments.filter(row => row.sentimentScore < -15).sort((a, b) => a.sentimentScore - b.sentimentScore).slice(0, 3).map(row => row.instrument).join(", ");
  return {
    summary: `${score.overallMarketSentiment || "Insufficient Data"} unified sentiment with ${score.riskTone || "insufficient"} risk tone. Confidence score is ${score.sentimentConfidence ?? "unavailable"}.`,
    strongestBullishInstruments: strongestBullish || "Insufficient Data",
    strongestBearishInstruments: strongestBearish || "Insufficient Data",
    agreementNotes: divergence.length ? "Partial agreement exists where price confirms available macro context." : "Insufficient Data",
    conflictNotes: score.sentimentDivergence ? "Input unavailable. Sentiment confidence score reduced." : "No live sentiment conflicts recorded.",
    contrarianRisks: score.extremeSentiment ? "Extreme sentiment risk detected." : "No extreme sentiment records detected.",
    tradeCaution: score.sentimentConfidence < 70 ? "Wait for additional live sentiment confirmation." : "Use sentiment with execution and risk gates.",
    propFirmCaution: "Confirm news and economic restrictions before trading sentiment-driven setups."
  };
}

async function latestRows() {
  const [score, inputs, instruments, matrix, divergence, extremeRisk, timeline, ai, alerts, audit] = await Promise.all([
    query(`SELECT overall_market_sentiment AS "overallMarketSentiment", risk_tone AS "riskTone", bullish_instruments AS "bullishInstruments", bearish_instruments AS "bearishInstruments", mixed_signals AS "mixedSignals", extreme_sentiment AS "extremeSentiment", overcrowded_trades AS "overcrowdedTrades", sentiment_divergence AS "sentimentDivergence", news_sentiment AS "newsSentiment", social_sentiment AS "socialSentiment", cot_positioning AS "cotPositioning", sentiment_confidence AS "sentimentConfidence", overall_sentiment_score AS "overallSentimentScore", calculated_at AS "calculatedAt" FROM market.sentiment_intelligence_scores ORDER BY calculated_at DESC LIMIT 1`),
    query(`SELECT input_name AS input, source, status, freshness, health, weight, last_updated AS "lastUpdated", used_in_score AS "usedInScore", payload->>'usedIn' AS "usedIn" FROM market.sentiment_intelligence_inputs ORDER BY created_at DESC LIMIT 40`),
    query(`SELECT instrument, asset_class AS "assetClass", news_sentiment AS "newsSentiment", social_sentiment AS "socialSentiment", macro_bias AS "macroBias", cot_bias AS "cotBias", price_confirmation AS "priceConfirmation", volatility_risk AS "volatilityRisk", overall_sentiment AS "overallSentiment", confidence, trading_bias AS "tradingBias", updated_at AS "lastUpdated" FROM market.instrument_sentiment_states ORDER BY updated_at DESC, instrument LIMIT 80`),
    query(`SELECT currency, news, social, macro, cot, price, overall, confidence, risk, updated_at AS "updatedAt" FROM market.currency_sentiment_matrix ORDER BY updated_at DESC, currency LIMIT 80`),
    query(`SELECT instrument, news, social, macro, cot, price, agreement_level AS "agreementLevel", divergence_type AS "divergenceType", risk_level AS "riskLevel", recommendation, created_at AS "createdAt" FROM market.sentiment_divergence_events ORDER BY created_at DESC LIMIT 80`),
    query(`SELECT risk_type AS "riskType", instrument, risk_label AS "riskLabel", description, recommendation, created_at AS "createdAt" FROM market.sentiment_extreme_risks ORDER BY created_at DESC LIMIT 80`),
    query(`SELECT created_at AS time, instrument, previous_sentiment AS "previousSentiment", current_sentiment AS "currentSentiment", change, trigger, confidence FROM market.sentiment_timeline_events ORDER BY created_at DESC LIMIT 80`),
    query(`SELECT summary, strongest_bullish_instruments AS "strongestBullishInstruments", strongest_bearish_instruments AS "strongestBearishInstruments", agreement_notes AS "agreementNotes", conflict_notes AS "conflictNotes", contrarian_risks AS "contrarianRisks", trade_caution AS "tradeCaution", prop_firm_caution AS "propFirmCaution", generated_at AS "generatedAt" FROM market.sentiment_ai_summaries ORDER BY generated_at DESC LIMIT 1`),
    query(`SELECT alert_type AS "alertType", title, severity, status, payload, created_at AS "createdAt" FROM market.sentiment_alerts ORDER BY created_at DESC LIMIT 50`),
    query(`SELECT action, source, status, actor, payload, created_at FROM market.sentiment_audit_logs ORDER BY created_at DESC LIMIT 80`)
  ]);
  return { score: score.rows[0] || null, inputs: inputs.rows, instruments: instruments.rows, currencyMatrix: matrix.rows, divergence: divergence.rows, extremeRisk: extremeRisk.rows, timeline: timeline.rows, aiSummary: ai.rows[0] || null, alerts: alerts.rows, audit: audit.rows };
}

export async function getSentimentIntelligenceDashboard() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const readiness = await tableReadiness();
  if (!readiness.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${readiness.missing.join(", ")}`, readiness.missing);
  const rows = await latestRows();
  if (!rows.score && !rows.inputs.length && !rows.instruments.length) {
    return { ...emptyState("EMPTY", "Sentiment intelligence cannot be calculated yet. Connect news sentiment, social sentiment, macro intelligence, COT, and market environment sources to enable unified sentiment analysis."), schemaReady: true };
  }
  return {
    sourceMode: "DATABASE_ONLY",
    status: rows.score ? "READY" : "EMPTY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveInputsOnly: true, lastCalculation: rows.score?.calculatedAt || null, sentimentConfidenceScore: rows.score?.sentimentConfidence ?? null },
    summary: summaryCards(rows.score),
    ...rows
  };
}

export async function getSentimentIntelligenceSlice(slice) {
  const dashboard = await getSentimentIntelligenceDashboard();
  const map = {
    summary: { status: dashboard.status, summary: dashboard.summary, score: dashboard.score },
    inputs: { status: dashboard.status, inputs: dashboard.inputs },
    instruments: { status: dashboard.status, instruments: dashboard.instruments },
    "currency-matrix": { status: dashboard.status, currencyMatrix: dashboard.currencyMatrix },
    divergence: { status: dashboard.status, divergence: dashboard.divergence },
    "extreme-risk": { status: dashboard.status, extremeRisk: dashboard.extremeRisk },
    timeline: { status: dashboard.status, timeline: dashboard.timeline },
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

export async function runSentimentIntelligenceAction(action, body = {}, actor = "api", context = {}) {
  await assertReady();
  if (action === "alerts") {
    const title = String(body.title || "Sentiment intelligence alert").trim();
    await query(`INSERT INTO market.sentiment_alerts (alert_type, title, severity, status, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`, [body.alertType || "operator_alert", title, body.severity || "info", "OPEN", JSON.stringify(body)]);
    await query(`INSERT INTO market.sentiment_audit_logs (action, actor, status, payload) VALUES ($1,$2,$3,$4::jsonb)`, ["create-alert", actor, "RECORDED", JSON.stringify({ title })]);
    return { type: "sentiment_intelligence.alert.created", title };
  }
  if (!["recalculate", "regenerate-summary"].includes(action)) throw new Error("unsupported_sentiment_intelligence_action");
  const contextRows = { ...await latestContext(), ...context };
  const inputs = inputsFromContext(context.liveSnapshots || [], context.ticks || [], contextRows);
  const instruments = instrumentsFromTicks(context.ticks || [], inputs, contextRows);
  const score = scoreSummary(instruments, inputs, contextRows);
  const matrix = currencyMatrix(inputs, instruments, contextRows);
  const divergence = divergenceRows(instruments);
  const ai = aiSummary(score, instruments, divergence);
  await withTransaction(async client => {
    for (const input of inputs) await client.query(`INSERT INTO market.sentiment_intelligence_inputs (input_key, input_name, source, status, freshness, health, weight, last_updated, used_in_score, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [input.inputKey, input.input, input.source, input.status, input.freshness, input.health, input.weight, input.lastUpdated, input.usedInScore, JSON.stringify({ usedIn: input.usedIn })]);
    await client.query(`INSERT INTO market.sentiment_intelligence_scores (overall_market_sentiment, risk_tone, bullish_instruments, bearish_instruments, mixed_signals, extreme_sentiment, overcrowded_trades, sentiment_divergence, news_sentiment, social_sentiment, cot_positioning, sentiment_confidence, overall_sentiment_score, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`, [score.overallMarketSentiment, score.riskTone, score.bullishInstruments, score.bearishInstruments, score.mixedSignals, score.extremeSentiment, score.overcrowdedTrades, score.sentimentDivergence, score.newsSentiment, score.socialSentiment, score.cotPositioning, score.sentimentConfidence, score.overallSentimentScore, JSON.stringify({ inputs: inputs.length, engine: "SentimentIntelligenceEngine" })]);
    for (const row of instruments) await client.query(`INSERT INTO market.instrument_sentiment_states (instrument, asset_class, news_sentiment, social_sentiment, macro_bias, cot_bias, price_confirmation, volatility_risk, overall_sentiment, confidence, trading_bias, payload, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,coalesce($13::timestamptz, now()))`, [row.instrument, row.assetClass, row.newsSentiment, row.socialSentiment, row.macroBias, row.cotBias, row.priceConfirmation, row.volatilityRisk, row.overallSentiment, row.confidence, row.tradingBias, JSON.stringify({ sentimentScore: row.sentimentScore }), row.lastUpdated]);
    for (const row of matrix) await client.query(`INSERT INTO market.currency_sentiment_matrix (currency, news, social, macro, cot, price, overall, confidence, risk, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [row.currency, row.news, row.social, row.macro, row.cot, row.price, row.overall, row.confidence, row.risk, JSON.stringify({})]);
    for (const row of divergence) await client.query(`INSERT INTO market.sentiment_divergence_events (instrument, news, social, macro, cot, price, agreement_level, divergence_type, risk_level, recommendation, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`, [row.instrument, row.news, row.social, row.macro, row.cot, row.price, row.agreementLevel, row.divergenceType, row.riskLevel, row.recommendation, JSON.stringify({})]);
    await client.query(`INSERT INTO market.sentiment_timeline_events (instrument, previous_sentiment, current_sentiment, change, trigger, confidence, payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`, ["ALL", null, score.overallMarketSentiment, "Recalculated", "Price Breakout", score.sentimentConfidence, JSON.stringify({ instruments: instruments.length })]);
    await client.query(`INSERT INTO market.sentiment_ai_summaries (summary, strongest_bullish_instruments, strongest_bearish_instruments, agreement_notes, conflict_notes, contrarian_risks, trade_caution, prop_firm_caution, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [ai.summary, ai.strongestBullishInstruments, ai.strongestBearishInstruments, ai.agreementNotes, ai.conflictNotes, ai.contrarianRisks, ai.tradeCaution, ai.propFirmCaution, JSON.stringify({ generatedBy: "SentimentIntelligenceEngine" })]);
    await client.query(`INSERT INTO market.sentiment_audit_logs (action, actor, status, payload) VALUES ($1,$2,$3,$4::jsonb)`, [action, actor, "RECORDED", JSON.stringify({ inputs: inputs.length, instruments: instruments.length, sentimentConfidence: score.sentimentConfidence })]);
  });
  return { type: "sentiment_intelligence.recalculated", status: "READY", inputs: inputs.length, instruments: instruments.length, currencies: matrix.length, score };
}
