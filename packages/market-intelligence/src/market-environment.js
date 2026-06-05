import { isDatabaseConfigured, query, withTransaction } from "./db.js";

export const MARKET_ENVIRONMENT_TABLES = Object.freeze([
  "market.market_environment_scores",
  "market.market_environment_inputs",
  "market.market_regime_history",
  "market.instrument_environment_states",
  "market.volatility_regime_metrics",
  "market.risk_tone_metrics",
  "market.session_environment_metrics",
  "market.market_environment_alerts",
  "market.market_environment_ai_summaries",
  "market.market_environment_audit_logs"
]);

const HEALTHY_STATUSES = new Set(["ONLINE", "LIVE", "SYNCED", "READY", "PASSED", "HEALTHY"]);
const INPUT_WEIGHTS = Object.freeze({
  "market-data": 1.3,
  "historical-data": 1.1,
  "news-sentiment": 1,
  "economic-calendar": 1,
  "social-sentiment": 0.7,
  "institutional-cot-data": 0.8,
  "broker-data": 1,
  "prop-firm-rules": 0.6
});

const n = value => value === null || value === undefined || value === "" ? null : Number(value);
const avg = values => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value), 0) / values.length) : null;
const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value || 0))));

function permissions() {
  return {
    view: "market_intelligence.market_environment.view",
    recalculate: "market_intelligence.market_environment.recalculate",
    configureInputs: "market_intelligence.market_environment.configure_inputs",
    export: "market_intelligence.market_environment.export",
    createAlert: "market_intelligence.market_environment.create_alert"
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
    badges: { productionLive: true, mockDataDisabled: true, liveInputsOnly: true, lastCalculation: null, environmentScore: null },
    summary: [],
    inputs: [],
    instruments: [],
    volatility: [],
    riskTone: null,
    sessions: [],
    events: [],
    aiSummary: null,
    audit: []
  };
}

async function tableReadiness() {
  const { rows } = await query(
    "SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name",
    [MARKET_ENVIRONMENT_TABLES]
  );
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function scoreBand(score) {
  if (score === null || score === undefined) return "Unclear";
  if (score <= 20) return "Avoid";
  if (score <= 40) return "High Risk";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Tradeable";
  return "Strong Opportunity";
}

function classifyAsset(symbol) {
  const value = String(symbol || "").toUpperCase();
  if (value.includes("XAU") || value.includes("XAG")) return "Metals";
  if (value.includes("OIL") || value.includes("BRENT") || value.includes("WTI")) return "Commodities";
  if (value.includes("NAS") || value.includes("SPX") || value.includes("US30") || value.includes("GER")) return "Indices";
  if (value.includes("BTC") || value.includes("ETH")) return "Crypto";
  return "Forex";
}

function volatilityStatus(value) {
  if (value >= 90) return "Extreme";
  if (value >= 70) return "High";
  if (value >= 50) return "Elevated";
  if (value >= 25) return "Normal";
  return "Low";
}

function trendRegime(trend, volatility, liquidityScore, newsRisk) {
  if (liquidityScore < 35) return "Low Liquidity";
  if (newsRisk === "High") return "News-Driven";
  if (volatility >= 75) return "Volatility Expansion";
  if (volatility <= 20) return "Volatility Compression";
  if (trend >= 70) return "Strong Trend";
  if (trend >= 45) return "Weak Trend";
  return "Range-Bound";
}

function riskToneFromInputs(inputs, instruments) {
  const healthy = inputs.filter(input => HEALTHY_STATUSES.has(String(input.status || "").toUpperCase())).length;
  const required = inputs.filter(input => input.weight >= 1).length || inputs.length || 1;
  const coverage = Math.round((healthy / required) * 100);
  const indexScores = instruments.filter(row => row.assetClass === "Indices").map(row => row.environmentScore);
  const metalScores = instruments.filter(row => row.assetClass === "Metals").map(row => row.environmentScore);
  if (!inputs.length) return "Unclear";
  if (coverage < 50) return "Unclear";
  if (avg(indexScores) !== null && avg(indexScores) >= 65) return "Risk-On";
  if (avg(metalScores) !== null && avg(metalScores) >= 65 && avg(indexScores) !== null && avg(indexScores) < 55) return "Risk-Off";
  return coverage >= 80 ? "Neutral" : "Mixed";
}

function inputRowsFromSnapshots(liveSnapshots = []) {
  return liveSnapshots.map(source => {
    const status = String(source.status || "UNKNOWN").toUpperCase();
    const key = source.id || source.routeSlug || source.category || source.name;
    const health = n(source.healthScore);
    return {
      inputKey: key,
      input: source.name || key,
      source: source.provider || source.adapter || "Production Adapter",
      status,
      freshness: source.freshness || null,
      health: health === null ? (HEALTHY_STATUSES.has(status) ? 100 : 0) : clamp(health),
      weight: INPUT_WEIGHTS[key] || (source.required ? 1 : 0.6),
      lastUpdated: source.lastSyncAt || source.observedAt || null,
      usedInScore: HEALTHY_STATUSES.has(status),
      usedIn: key === "market-data" ? "Regime, volatility, liquidity" : key === "economic-calendar" ? "News/event risk" : key === "news-sentiment" ? "Risk tone, news sensitivity" : "Confidence"
    };
  });
}

function groupTicks(ticks = []) {
  const groups = new Map();
  for (const tick of ticks) {
    const symbol = String(tick.symbol || "").toUpperCase();
    if (!symbol) continue;
    const bid = n(tick.bid);
    const ask = n(tick.ask);
    if (bid === null && ask === null) continue;
    const mid = bid !== null && ask !== null ? (bid + ask) / 2 : bid ?? ask;
    const spread = n(tick.spread) ?? (bid !== null && ask !== null ? Math.abs(ask - bid) : null);
    const entry = groups.get(symbol) || [];
    entry.push({ mid, spread, observedAt: tick.observed_at || tick.observedAt || null });
    groups.set(symbol, entry);
  }
  return [...groups.entries()];
}

function instrumentRowsFromTicks(ticks = [], inputs = []) {
  const inputHealth = avg(inputs.filter(input => input.usedInScore).map(input => input.health).filter(value => value !== null)) ?? 0;
  const newsInput = inputs.find(input => /news|calendar|sentiment/i.test(input.inputKey));
  const newsRisk = newsInput?.usedInScore ? "Normal" : "Input unavailable";
  return groupTicks(ticks).map(([symbol, rows]) => {
    const mids = rows.map(row => row.mid).filter(value => value !== null);
    const spreads = rows.map(row => row.spread).filter(value => value !== null);
    const first = mids[0];
    const last = mids[mids.length - 1] ?? first;
    const high = Math.max(...mids);
    const low = Math.min(...mids);
    const rangePct = first ? Math.abs(high - low) / Math.abs(first) * 10000 : 0;
    const trend = first ? clamp(Math.abs(last - first) / Math.abs(first) * 10000 * 3) : 0;
    const volatility = clamp(rangePct * 2);
    const avgSpread = avg(spreads) ?? 0;
    const liquidityScore = avgSpread <= 0 ? 70 : clamp(100 - Math.min(90, avgSpread * 10000));
    const score = clamp(avg([inputHealth, trend, volatility, liquidityScore].filter(value => value !== null)) ?? 0);
    const regime = trendRegime(trend, volatility, liquidityScore, newsRisk === "Input unavailable" ? "High" : "Normal");
    return {
      instrument: symbol,
      assetClass: classifyAsset(symbol),
      regime,
      trendStrength: trend,
      volatility: volatilityStatus(volatility),
      volatilityScore: volatility,
      liquidity: liquidityScore >= 70 ? "High Liquidity" : liquidityScore >= 45 ? "Normal Liquidity" : "Low Liquidity",
      spreadCondition: avgSpread <= 0 ? "Unknown" : liquidityScore >= 70 ? "Tight" : liquidityScore >= 45 ? "Normal" : "Wide",
      newsRisk,
      sessionBias: activeSession(new Date()).name,
      environmentScore: score,
      tradingSuitability: scoreBand(score),
      confidence: clamp(avg([inputHealth, rows.length ? 100 : 0]) ?? 0),
      lastUpdated: rows.reduce((latest, row) => row.observedAt && (!latest || row.observedAt > latest) ? row.observedAt : latest, null),
      payload: { ticks: rows.length, averageSpread: avgSpread, firstMid: first, lastMid: last }
    };
  });
}

function activeSession(date) {
  const hour = date.getUTCHours();
  if (hour >= 21 || hour < 6) return { name: "Sydney", overlap: false };
  if (hour >= 0 && hour < 9) return { name: "Tokyo", overlap: hour >= 6 };
  if (hour >= 7 && hour < 16) return { name: "London", overlap: hour >= 12 };
  return { name: "New York", overlap: hour >= 12 && hour < 16 };
}

function sessionRows(instruments, now = new Date()) {
  if (!instruments.length) return [];
  const active = activeSession(now);
  const score = avg(instruments.map(row => row.environmentScore)) ?? 0;
  const volatility = avg(instruments.map(row => row.volatilityScore)) ?? 0;
  const liquidity = avg(instruments.map(row => row.liquidity.includes("High") ? 80 : row.liquidity.includes("Normal") ? 55 : 25)) ?? 0;
  const base = {
    sessionVolatility: volatilityStatus(volatility),
    sessionDirection: avg(instruments.map(row => row.trendStrength)) >= 50 ? "Directional" : "Mixed",
    sessionLiquidity: liquidity >= 70 ? "High" : liquidity >= 45 ? "Normal" : "Low",
    sessionSpreadBehaviour: liquidity >= 70 ? "Stable" : "Widening",
    breakoutRisk: score >= 70 ? "Elevated" : "Normal",
    reversalRisk: score < 45 ? "Elevated" : "Normal"
  };
  const sessions = [active.name];
  if (active.overlap) sessions.push("Overlap");
  return sessions.map(sessionName => ({ sessionName, ...base }));
}

function summaryCards(score, instruments, inputs) {
  const current = score || {};
  return [
    ["Current Market Regime", current.regime, "info"],
    ["Risk Tone", current.riskTone, "info"],
    ["Volatility Regime", current.volatilityRegime, "warn"],
    ["Liquidity Condition", current.liquidityCondition, "info"],
    ["Trend Strength", current.trendStrength, "quality"],
    ["Range Probability", current.rangeProbability, "info"],
    ["News Sensitivity", current.newsSensitivity, "warn"],
    ["Session Bias", current.sessionBias, "info"],
    ["Market Stress Level", current.marketStressLevel, "bad"],
    ["Trading Suitability", current.tradingSuitability, "ok"],
    ["Instruments Classified", instruments.length, "info"],
    ["Live Inputs Used", inputs.filter(input => input.usedInScore).length, "ok"]
  ];
}

function buildScore(instruments, inputs, sessions) {
  const instrumentScore = avg(instruments.map(row => row.environmentScore)) ?? null;
  const inputScore = avg(inputs.filter(input => input.usedInScore).map(input => input.health).filter(value => value !== null)) ?? null;
  const environmentScore = clamp(avg([instrumentScore, inputScore].filter(value => value !== null)) ?? 0);
  const trendStrength = avg(instruments.map(row => row.trendStrength)) ?? 0;
  const volatilityScore = avg(instruments.map(row => row.volatilityScore)) ?? 0;
  const lowLiquidity = instruments.filter(row => row.liquidity.includes("Low")).length;
  const liquidityCondition = lowLiquidity ? "Low Liquidity" : instruments.length ? "High Liquidity" : "Input unavailable";
  const newsUnavailable = inputs.some(input => /news|calendar|sentiment/i.test(input.inputKey) && !input.usedInScore);
  const regime = trendRegime(trendStrength, volatilityScore, lowLiquidity ? 25 : 80, newsUnavailable ? "High" : "Normal");
  return {
    regime,
    riskTone: riskToneFromInputs(inputs, instruments),
    volatilityRegime: volatilityStatus(volatilityScore),
    liquidityCondition,
    trendStrength,
    rangeProbability: clamp(100 - trendStrength),
    newsSensitivity: newsUnavailable ? "Input unavailable. Market environment confidence reduced." : "Normal",
    sessionBias: sessions[0]?.sessionName || "Input unavailable",
    marketStressLevel: volatilityScore >= 75 || lowLiquidity ? "High" : volatilityScore >= 50 ? "Elevated" : "Normal",
    tradingSuitability: scoreBand(environmentScore),
    environmentScore,
    confidence: clamp(avg([inputScore, instruments.length ? 100 : 0].filter(value => value !== null)) ?? 0)
  };
}

function aiSummary(score, instruments, inputs) {
  const sorted = instruments.slice().sort((a, b) => b.environmentScore - a.environmentScore);
  const missing = inputs.filter(input => !input.usedInScore).map(input => input.input).join(", ");
  const best = sorted.slice(0, 3).map(row => row.instrument).join(", ");
  const worst = sorted.slice(-3).reverse().map(row => row.instrument).join(", ");
  return {
    summary: `${score.regime || "Unclear"} environment with ${score.riskTone || "unclear"} risk tone and ${score.volatilityRegime || "unknown"} volatility. Environment score is ${score.environmentScore ?? "unavailable"}.`,
    bestInstruments: best || "No classified instruments",
    worstInstruments: worst || "No classified instruments",
    tradingStyleSuitability: score.tradingSuitability || "Unclear",
    newsEventRisk: missing ? `Input unavailable. Market environment confidence reduced: ${missing}.` : score.newsSensitivity,
    volatilityWarning: score.marketStressLevel === "High" ? "High stress or volatility expansion detected." : "No high-stress volatility warning recorded.",
    liquidityWarning: score.liquidityCondition,
    propFirmCaution: score.newsSensitivity?.includes("unavailable") ? "Verify restricted events before trading." : "Apply prop firm event restrictions from connected rule sources."
  };
}

async function latestDashboardRows() {
  const [score, inputs, instruments, volatility, riskTone, sessions, alerts, summary, audit] = await Promise.all([
    query(`SELECT regime, risk_tone AS "riskTone", volatility_regime AS "volatilityRegime", liquidity_condition AS "liquidityCondition", trend_strength AS "trendStrength", range_probability AS "rangeProbability", news_sensitivity AS "newsSensitivity", session_bias AS "sessionBias", market_stress_level AS "marketStressLevel", trading_suitability AS "tradingSuitability", environment_score AS "environmentScore", confidence, calculated_at AS "calculatedAt" FROM market.market_environment_scores ORDER BY calculated_at DESC LIMIT 1`),
    query(`SELECT input_name AS input, source, status, freshness, health, weight, last_updated AS "lastUpdated", used_in_score AS "usedInScore", payload->>'usedIn' AS "usedIn" FROM market.market_environment_inputs ORDER BY created_at DESC LIMIT 30`),
    query(`SELECT instrument, asset_class AS "assetClass", regime, trend_strength AS "trendStrength", volatility, liquidity, spread_condition AS "spreadCondition", news_risk AS "newsRisk", session_bias AS "sessionBias", environment_score AS "environmentScore", trading_suitability AS "tradingSuitability", confidence, updated_at AS "lastUpdated" FROM market.instrument_environment_states ORDER BY updated_at DESC, environment_score DESC LIMIT 80`),
    query(`SELECT instrument, atr, average_daily_range AS "averageDailyRange", realized_volatility AS "realizedVolatility", implied_volatility AS "impliedVolatility", volatility_rank AS "volatilityRank", volatility_percentile AS "volatilityPercentile", expansion_signal AS "expansionSignal", status, observed_at AS "observedAt" FROM market.volatility_regime_metrics ORDER BY observed_at DESC LIMIT 80`),
    query(`SELECT risk_tone AS "riskTone", equity_bias AS "equityBias", gold_bias AS "goldBias", jpy_bias AS "jpyBias", chf_bias AS "chfBias", usd_bias AS "usdBias", oil_bias AS "oilBias", crypto_bias AS "cryptoBias", bond_yield_bias AS "bondYieldBias", news_sentiment AS "newsSentiment", economic_surprise AS "economicSurprise", confidence, observed_at AS "observedAt" FROM market.risk_tone_metrics ORDER BY observed_at DESC LIMIT 1`),
    query(`SELECT session_name AS "sessionName", session_volatility AS "sessionVolatility", session_direction AS "sessionDirection", session_liquidity AS "sessionLiquidity", session_spread_behaviour AS "sessionSpreadBehaviour", breakout_risk AS "breakoutRisk", reversal_risk AS "reversalRisk", observed_at AS "observedAt" FROM market.session_environment_metrics ORDER BY observed_at DESC LIMIT 20`),
    query(`SELECT alert_type AS "alertType", title, severity, status, payload, created_at AS "createdAt" FROM market.market_environment_alerts ORDER BY created_at DESC LIMIT 50`),
    query(`SELECT summary, best_instruments AS "bestInstruments", worst_instruments AS "worstInstruments", trading_style_suitability AS "tradingStyleSuitability", news_event_risk AS "newsEventRisk", volatility_warning AS "volatilityWarning", liquidity_warning AS "liquidityWarning", prop_firm_caution AS "propFirmCaution", generated_at AS "generatedAt" FROM market.market_environment_ai_summaries ORDER BY generated_at DESC LIMIT 1`),
    query(`SELECT action, source, status, actor, payload, created_at FROM market.market_environment_audit_logs ORDER BY created_at DESC LIMIT 80`)
  ]);
  return {
    score: score.rows[0] || null,
    inputs: inputs.rows,
    instruments: instruments.rows,
    volatility: volatility.rows,
    riskTone: riskTone.rows[0] || null,
    sessions: sessions.rows,
    events: alerts.rows,
    aiSummary: summary.rows[0] || null,
    audit: audit.rows
  };
}

export async function getMarketEnvironmentDashboard() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const readiness = await tableReadiness();
  if (!readiness.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${readiness.missing.join(", ")}`, readiness.missing);
  const rows = await latestDashboardRows();
  if (!rows.score && !rows.inputs.length && !rows.instruments.length) {
    return {
      ...emptyState("EMPTY", "Market environment cannot be calculated yet. Connect market data, historical data, economic calendar, and sentiment sources to enable live environment classification."),
      schemaReady: true,
      permissions: permissions()
    };
  }
  return {
    sourceMode: "DATABASE_ONLY",
    status: rows.score ? "READY" : "EMPTY",
    schemaReady: true,
    permissions: permissions(),
    badges: {
      productionLive: true,
      mockDataDisabled: true,
      liveInputsOnly: true,
      lastCalculation: rows.score?.calculatedAt || null,
      environmentScore: rows.score?.environmentScore ?? null
    },
    summary: summaryCards(rows.score, rows.instruments, rows.inputs),
    ...rows
  };
}

export async function getMarketEnvironmentSlice(slice) {
  const dashboard = await getMarketEnvironmentDashboard();
  const map = {
    summary: { status: dashboard.status, summary: dashboard.summary, score: dashboard.score },
    instruments: { status: dashboard.status, instruments: dashboard.instruments },
    inputs: { status: dashboard.status, inputs: dashboard.inputs },
    volatility: { status: dashboard.status, volatility: dashboard.volatility },
    "risk-tone": { status: dashboard.status, riskTone: dashboard.riskTone },
    session: { status: dashboard.status, sessions: dashboard.sessions },
    events: { status: dashboard.status, events: dashboard.events },
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

export async function runMarketEnvironmentAction(action, body = {}, actor = "api", context = {}) {
  await assertReady();
  if (action === "alerts") {
    const title = String(body.title || "Market environment alert").trim();
    await query(
      `INSERT INTO market.market_environment_alerts (alert_type, title, severity, status, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [body.alertType || "operator_alert", title, body.severity || "info", "OPEN", JSON.stringify(body)]
    );
    await query(`INSERT INTO market.market_environment_audit_logs (action, actor, status, payload) VALUES ($1,$2,$3,$4::jsonb)`, ["create-alert", actor, "RECORDED", JSON.stringify({ title })]);
    return { type: "market_environment.alert.created", title };
  }
  if (!["recalculate", "regenerate-summary"].includes(action)) throw new Error("unsupported_market_environment_action");
  const inputs = inputRowsFromSnapshots(context.liveSnapshots || []);
  const instruments = instrumentRowsFromTicks(context.ticks || [], inputs);
  const sessions = sessionRows(instruments);
  const score = buildScore(instruments, inputs, sessions);
  const summary = aiSummary(score, instruments, inputs);
  await withTransaction(async client => {
    for (const input of inputs) {
      await client.query(
        `INSERT INTO market.market_environment_inputs (input_key, input_name, source, status, freshness, health, weight, last_updated, used_in_score, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [input.inputKey, input.input, input.source, input.status, input.freshness, input.health, input.weight, input.lastUpdated, input.usedInScore, JSON.stringify({ usedIn: input.usedIn })]
      );
    }
    for (const row of instruments) {
      await client.query(
        `INSERT INTO market.instrument_environment_states (instrument, asset_class, regime, trend_strength, volatility, liquidity, spread_condition, news_risk, session_bias, environment_score, trading_suitability, confidence, payload, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,coalesce($14::timestamptz, now()))`,
        [row.instrument, row.assetClass, row.regime, row.trendStrength, row.volatility, row.liquidity, row.spreadCondition, row.newsRisk, row.sessionBias, row.environmentScore, row.tradingSuitability, row.confidence, JSON.stringify(row.payload), row.lastUpdated]
      );
      await client.query(
        `INSERT INTO market.volatility_regime_metrics (instrument, atr, average_daily_range, realized_volatility, implied_volatility, volatility_rank, volatility_percentile, expansion_signal, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [row.instrument, row.payload?.averageSpread || null, row.payload?.averageSpread || null, row.volatilityScore, null, row.volatilityScore, row.volatilityScore, row.volatilityScore >= 70 ? "Expansion" : row.volatilityScore <= 20 ? "Compression" : "Neutral", row.volatility]
      );
    }
    for (const row of sessions) {
      await client.query(
        `INSERT INTO market.session_environment_metrics (session_name, session_volatility, session_direction, session_liquidity, session_spread_behaviour, breakout_risk, reversal_risk)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [row.sessionName, row.sessionVolatility, row.sessionDirection, row.sessionLiquidity, row.sessionSpreadBehaviour, row.breakoutRisk, row.reversalRisk]
      );
    }
    await client.query(
      `INSERT INTO market.risk_tone_metrics (risk_tone, equity_bias, gold_bias, jpy_bias, chf_bias, usd_bias, oil_bias, crypto_bias, bond_yield_bias, news_sentiment, economic_surprise, confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [score.riskTone, "Input dependent", "Input dependent", "Input dependent", "Input dependent", "Input dependent", "Input dependent", "Input dependent", "Input dependent", score.newsSensitivity, "Input dependent", score.confidence]
    );
    await client.query(
      `INSERT INTO market.market_environment_scores (regime, risk_tone, volatility_regime, liquidity_condition, trend_strength, range_probability, news_sensitivity, session_bias, market_stress_level, trading_suitability, environment_score, confidence, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
      [score.regime, score.riskTone, score.volatilityRegime, score.liquidityCondition, score.trendStrength, score.rangeProbability, score.newsSensitivity, score.sessionBias, score.marketStressLevel, score.tradingSuitability, score.environmentScore, score.confidence, JSON.stringify({ inputs: inputs.length, instruments: instruments.length })]
    );
    await client.query(
      `INSERT INTO market.market_regime_history (regime, risk_tone, environment_score, reason) VALUES ($1,$2,$3,$4)`,
      [score.regime, score.riskTone, score.environmentScore, "Calculated from live market environment inputs"]
    );
    await client.query(
      `INSERT INTO market.market_environment_ai_summaries (summary, best_instruments, worst_instruments, trading_style_suitability, news_event_risk, volatility_warning, liquidity_warning, prop_firm_caution, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [summary.summary, summary.bestInstruments, summary.worstInstruments, summary.tradingStyleSuitability, summary.newsEventRisk, summary.volatilityWarning, summary.liquidityWarning, summary.propFirmCaution, JSON.stringify({ generatedBy: "deterministic_market_environment_engine" })]
    );
    await client.query(
      `INSERT INTO market.market_environment_audit_logs (action, actor, status, payload) VALUES ($1,$2,$3,$4::jsonb)`,
      [action, actor, "RECORDED", JSON.stringify({ inputs: inputs.length, instruments: instruments.length, environmentScore: score.environmentScore })]
    );
  });
  return { type: "market_environment.recalculated", status: instruments.length ? "READY" : "INPUTS_ONLY", inputs: inputs.length, instruments: instruments.length, score };
}
