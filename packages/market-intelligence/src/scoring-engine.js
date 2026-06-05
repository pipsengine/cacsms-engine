import { query } from "./db.js";
import { getBrokerLiquidityDashboard } from "./broker-liquidity.js";
import { getPortfolioIntelligenceDashboard } from "./portfolio-intelligence.js";

const MODULES = Object.freeze([
  ["market_environment", "Market Environment", "bias"],
  ["macro", "Macro Intelligence", "bias"],
  ["sentiment", "Sentiment Intelligence", "bias"],
  ["institutional", "Institutional Intelligence", "bias"],
  ["broker_liquidity", "Broker Liquidity", "safety"],
  ["portfolio", "Portfolio Intelligence", "risk"],
  ["economic_calendar", "Economic Calendar", "risk"],
  ["news_sentiment", "News Sentiment", "sentiment"],
  ["social_sentiment", "Social Sentiment", "sentiment"],
  ["cot_reports", "COT Reports", "institutional"],
  ["historical_data", "Historical Data", "data_quality"],
  ["broker_data", "Broker Data", "liquidity"],
  ["account_portfolio", "Account Portfolio", "portfolio"],
  ["prop_firm_rules", "Prop Firm Rules", "compliance"],
  ["source_health", "Source Health Review", "data_quality"],
  ["dependency_matrix", "Dependency Matrix", "dependency"]
]);

const DECISION_LAYER_KEYS = ["market_score", "opportunity_score", "risk_score", "execution_score", "portfolio_score", "confidence_score", "compliance_score"];
const TRADE_THRESHOLDS = Object.freeze({
  marketScore: 70,
  opportunityScore: 75,
  maxRiskScore: 30,
  confidenceScore: 70,
  complianceScore: 90
});

function n(value) {
  return value == null || value === "" ? null : Number(value);
}

function round(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

function avg(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function biasLabel(score) {
  if (score == null) return "Insufficient Data";
  if (score >= 75) return "Strong Bullish";
  if (score >= 25) return "Bullish";
  if (score > 5) return "Mild Bullish";
  if (score <= -75) return "Strong Bearish";
  if (score <= -25) return "Bearish";
  if (score < -5) return "Mild Bearish";
  return "Neutral";
}

function confidenceLabel(score) {
  if (score == null) return "Insufficient Data";
  if (score >= 90) return "Very High Confidence";
  if (score >= 75) return "High Confidence";
  if (score >= 60) return "Medium Confidence";
  if (score >= 40) return "Low Confidence";
  return "Very Low Confidence";
}

function riskLabel(score) {
  if (score == null) return "Insufficient Data";
  if (score <= 20) return "Low Risk";
  if (score <= 40) return "Moderate Risk";
  if (score <= 60) return "Elevated Risk";
  if (score <= 80) return "High Risk";
  return "Extreme Risk";
}

function freshness(value) {
  if (!value) return "No live timestamp";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function scoreFromText(value) {
  const text = String(value || "").toLowerCase();
  if (/strong bullish|risk-on|tradeable|healthy|excellent/.test(text)) return 75;
  if (/bullish|good|active|passed/.test(text)) return 35;
  if (/neutral|mixed|normal|watchlist/.test(text)) return 0;
  if (/bearish|at risk|weak|poor/.test(text)) return -35;
  if (/strong bearish|critical|breached|avoid|failed/.test(text)) return -75;
  return null;
}

async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) return { rows: [] };
    throw error;
  }
}

async function activeModel() {
  const { rows } = await safeQuery(`
    SELECT m.id AS model_id, m.model_name, m.environment, m.status AS model_status,
           v.id AS version_id, v.model_version, v.status AS version_status,
           v.created_by, v.created_at, v.approved_by, v.approved_at, v.activated_at, v.change_summary
    FROM market.scoring_models m
    JOIN market.scoring_model_versions v ON v.model_id = m.id AND v.status = 'Active'
    WHERE m.status = 'Active'
    ORDER BY v.activated_at DESC NULLS LAST
    LIMIT 1
  `);
  return rows[0] || null;
}

async function weights(modelVersionId) {
  const { rows } = await safeQuery(`
    SELECT id, module_key, module_label, score_category, weight_percent, minimum_required_confidence,
           enabled, required, last_changed_by, last_changed_at
    FROM market.scoring_model_weights
    WHERE model_version_id = $1
    ORDER BY score_category, module_label
  `, [modelVersionId]);
  return rows.map((row) => ({
    id: row.id,
    moduleKey: row.module_key,
    module: row.module_label,
    scoreCategory: row.score_category,
    weightPercent: Number(row.weight_percent),
    minimumRequiredConfidence: Number(row.minimum_required_confidence),
    enabled: row.enabled,
    required: row.required,
    lastChangedBy: row.last_changed_by,
    lastChangedAt: row.last_changed_at
  }));
}

async function moduleInputs() {
  const [env, macro, sentiment, institutional, sourceHealth, dependency, social, cot, history, broker, portfolio, symbols] = await Promise.all([
    safeQuery("SELECT environment_score, confidence, risk_tone, trading_suitability, calculated_at FROM market.market_environment_scores ORDER BY calculated_at DESC LIMIT 1").then((r) => r.rows[0]),
    safeQuery("SELECT macro_confidence, risk_tone, usd_macro_bias, gold_macro_bias, equity_macro_bias, calculated_at FROM market.macro_intelligence_scores ORDER BY calculated_at DESC LIMIT 1").then((r) => r.rows[0]),
    safeQuery("SELECT overall_sentiment_score, sentiment_confidence, overall_market_sentiment, calculated_at FROM market.sentiment_intelligence_scores ORDER BY calculated_at DESC LIMIT 1").then((r) => r.rows[0]),
    safeQuery("SELECT institutional_score, institutional_confidence, institutional_bias, calculated_at FROM market.institutional_intelligence_scores ORDER BY calculated_at DESC LIMIT 1").then((r) => r.rows[0]),
    safeQuery("SELECT avg(health_score)::numeric AS score, max(observed_at) AS observed_at FROM market.source_health_metrics").then((r) => r.rows[0]),
    safeQuery("SELECT avg(score)::numeric AS score, max(calculated_at) AS calculated_at FROM market.dependency_health_scores").then((r) => r.rows[0]),
    safeQuery("SELECT avg(sentiment_score)::numeric AS score, avg(ai_confidence)::numeric AS confidence, max(observed_at) AS observed_at FROM market.social_sentiment_scores").then((r) => r.rows[0]),
    safeQuery("SELECT cot_bias, avg(large_spec_net)::numeric AS large_spec_net, max(observed_at) AS observed_at FROM market.cot_positioning_metrics GROUP BY cot_bias ORDER BY max(observed_at) DESC LIMIT 1").then((r) => r.rows[0]),
    safeQuery("SELECT avg(coverage)::numeric AS score FROM market.market_data_coverage").then((r) => r.rows[0]),
    getBrokerLiquidityDashboard().catch(() => null),
    getPortfolioIntelligenceDashboard().catch(() => null),
    safeQuery("SELECT symbol FROM market.market_data_symbols WHERE enabled = true ORDER BY symbol").then((r) => r.rows.map((row) => row.symbol))
  ]);

  const rows = [
    {
      moduleKey: "market_environment", module: "Market Environment", scoreType: "Market Bias",
      currentScore: env ? Number(env.environment_score) - 50 : null, health: env ? Number(env.confidence) : null,
      confidence: env ? Number(env.confidence) : null, status: env ? "live" : "unavailable", lastUpdated: env?.calculated_at
    },
    {
      moduleKey: "macro", module: "Macro Intelligence", scoreType: "Macro Bias",
      currentScore: macro ? scoreFromText(macro.usd_macro_bias || macro.risk_tone) : null, health: macro ? Number(macro.macro_confidence) : null,
      confidence: macro ? Number(macro.macro_confidence) : null, status: macro ? "live" : "unavailable", lastUpdated: macro?.calculated_at
    },
    {
      moduleKey: "sentiment", module: "Sentiment Intelligence", scoreType: "Sentiment Bias",
      currentScore: sentiment ? Number(sentiment.overall_sentiment_score) : null, health: sentiment ? Number(sentiment.sentiment_confidence) : null,
      confidence: sentiment ? Number(sentiment.sentiment_confidence) : null, status: sentiment ? "live" : "unavailable", lastUpdated: sentiment?.calculated_at
    },
    {
      moduleKey: "institutional", module: "Institutional Intelligence", scoreType: "Institutional Bias",
      currentScore: institutional ? Number(institutional.institutional_score) : null, health: institutional ? Number(institutional.institutional_confidence) : null,
      confidence: institutional ? Number(institutional.institutional_confidence) : null, status: institutional ? "live" : "unavailable", lastUpdated: institutional?.calculated_at
    },
    {
      moduleKey: "broker_liquidity", module: "Broker Liquidity", scoreType: "Execution Safety",
      currentScore: broker?.summary?.overallLiquidityScore == null ? null : Number(broker.summary.overallLiquidityScore) - 50,
      health: broker?.summary?.overallLiquidityScore ?? null, confidence: broker?.summary?.liquidityConfidenceScore ?? broker?.summary?.overallLiquidityScore ?? null,
      status: broker?.summary?.status === "ready" ? "live" : "unavailable", lastUpdated: broker?.summary?.lastLiquidityCheck
    },
    {
      moduleKey: "portfolio", module: "Portfolio Intelligence", scoreType: "Portfolio Safety",
      currentScore: portfolio?.summary?.portfolioHealthScore == null ? null : Number(portfolio.summary.portfolioHealthScore) - 50,
      health: portfolio?.summary?.portfolioHealthScore ?? null, confidence: portfolio?.summary?.portfolioHealthScore ?? null,
      status: portfolio?.summary?.status === "ready" ? "live" : "unavailable", lastUpdated: portfolio?.summary?.lastPortfolioSync
    },
    {
      moduleKey: "source_health", module: "Source Health Review", scoreType: "Data Quality",
      currentScore: sourceHealth?.score == null ? null : Number(sourceHealth.score) - 50, health: sourceHealth?.score == null ? null : Number(sourceHealth.score),
      confidence: sourceHealth?.score == null ? null : Number(sourceHealth.score), status: sourceHealth?.score == null ? "unavailable" : "live", lastUpdated: sourceHealth?.observed_at
    },
    {
      moduleKey: "dependency_matrix", module: "Dependency Matrix", scoreType: "Dependency Risk",
      currentScore: dependency?.score == null ? null : Number(dependency.score) - 50, health: dependency?.score == null ? null : Number(dependency.score),
      confidence: dependency?.score == null ? null : Number(dependency.score), status: dependency?.score == null ? "unavailable" : "live", lastUpdated: dependency?.calculated_at
    },
    {
      moduleKey: "news_sentiment", module: "News Sentiment", scoreType: "News Sentiment",
      currentScore: null, health: null, confidence: null, status: "unavailable", lastUpdated: null
    },
    {
      moduleKey: "economic_calendar", module: "Economic Calendar", scoreType: "Event Risk",
      currentScore: null, health: null, confidence: null, status: "unavailable", lastUpdated: null
    },
    {
      moduleKey: "social_sentiment", module: "Social Sentiment", scoreType: "Social Sentiment",
      currentScore: social?.score == null ? null : Number(social.score), health: social?.confidence == null ? null : Number(social.confidence), confidence: social?.confidence == null ? null : Number(social.confidence), status: social?.score == null ? "unavailable" : "live", lastUpdated: social?.observed_at
    },
    {
      moduleKey: "cot_reports", module: "COT Reports", scoreType: "Institutional Positioning",
      currentScore: cot ? scoreFromText(cot.cot_bias) : null, health: cot ? 70 : null, confidence: cot ? 70 : null, status: cot ? "live" : "unavailable", lastUpdated: cot?.observed_at
    },
    {
      moduleKey: "historical_data", module: "Historical Data", scoreType: "Historical Context",
      currentScore: history?.score == null ? null : Number(history.score) - 50, health: history?.score == null ? null : Number(history.score), confidence: history?.score == null ? null : Number(history.score), status: history?.score == null ? "unavailable" : "live", lastUpdated: history?.observed_at
    },
    {
      moduleKey: "broker_data", module: "Broker Data", scoreType: "Broker Feed",
      currentScore: broker?.summary?.connectedBrokerFeeds ? 25 : null, health: broker?.summary?.connectedBrokerFeeds ? 85 : null,
      confidence: broker?.summary?.connectedBrokerFeeds ? 85 : null, status: broker?.summary?.connectedBrokerFeeds ? "live" : "unavailable", lastUpdated: broker?.summary?.lastLiquidityCheck
    },
    {
      moduleKey: "account_portfolio", module: "Account Portfolio", scoreType: "Account Risk",
      currentScore: portfolio?.summary?.activeAccounts ? 25 : null, health: portfolio?.summary?.portfolioHealthScore ?? null,
      confidence: portfolio?.summary?.portfolioHealthScore ?? null, status: portfolio?.summary?.activeAccounts ? "live" : "unavailable", lastUpdated: portfolio?.summary?.lastPortfolioSync
    },
    {
      moduleKey: "prop_firm_rules", module: "Prop Firm Rules", scoreType: "Compliance",
      currentScore: portfolio?.propCompliance?.length ? 100 - avg(portfolio.propCompliance.map((row) => Number(row.breachRisk || 0))) - 50 : null,
      health: portfolio?.propCompliance?.length ? 100 - avg(portfolio.propCompliance.map((row) => Number(row.breachRisk || 0))) : null,
      confidence: portfolio?.propCompliance?.length ? 100 - avg(portfolio.propCompliance.map((row) => Number(row.breachRisk || 0))) : null,
      status: portfolio?.propCompliance?.length ? "live" : "unavailable",
      lastUpdated: portfolio?.summary?.lastPortfolioSync
    }
  ];
  return { rows, symbols };
}

export class MarketIntelligenceScoringEngine {
  static calculate(inputs, weights) {
    const weightMap = new Map(weights.filter((w) => w.enabled).map((w) => [w.moduleKey, w]));
    const used = inputs.filter((input) => weightMap.has(input.moduleKey) && input.currentScore != null);
    const totalWeight = used.reduce((sum, input) => sum + Number(weightMap.get(input.moduleKey).weightPercent), 0);
    const finalMarketBiasScore = totalWeight ? used.reduce((sum, input) => sum + Number(input.currentScore) * Number(weightMap.get(input.moduleKey).weightPercent), 0) / totalWeight : null;
    const confidence = used.length ? avg(used.map((input) => input.confidence ?? input.health).filter((v) => v != null)) : null;
    const agreement = used.length ? Math.max(0, 100 - (Math.max(...used.map((i) => i.currentScore)) - Math.min(...used.map((i) => i.currentScore)))) : null;
    const riskSources = inputs.filter((i) => ["portfolio", "dependency_matrix"].includes(i.moduleKey) && i.health != null);
    const riskScore = riskSources.length ? avg(riskSources.map((i) => 100 - Number(i.health))) : null;
    const executionSafety = inputs.find((i) => i.moduleKey === "broker_liquidity")?.health ?? null;
    const portfolioSafety = inputs.find((i) => i.moduleKey === "portfolio")?.health ?? null;
    const dataQuality = inputs.find((i) => i.moduleKey === "source_health")?.health ?? null;
    return {
      finalMarketBiasScore: round(finalMarketBiasScore),
      finalConfidenceScore: round(confidence),
      tradingSuitabilityScore: round(avg([confidence, executionSafety, portfolioSafety, dataQuality].filter((v) => v != null))),
      riskScore: round(riskScore),
      signalAgreementScore: round(agreement),
      dataQualityScore: round(dataQuality),
      sourceReliabilityScore: round(dataQuality),
      marketOpportunityScore: round(finalMarketBiasScore == null ? null : Math.abs(finalMarketBiasScore)),
      executionSafetyScore: round(executionSafety),
      portfolioSafetyScore: round(portfolioSafety)
    };
  }
}

export class ScoringValidationService {
  static validate(model, weights, inputs) {
    const activeWeights = weights.filter((w) => w.enabled);
    const total = round(activeWeights.reduce((sum, row) => sum + row.weightPercent, 0));
    const checks = [
      { check: "Weights equal 100%", status: total === 100 ? "Passed" : "Failed", detail: `Active total is ${total}%` },
      { check: "Required inputs available", status: activeWeights.filter((w) => w.required).every((w) => inputs.find((i) => i.moduleKey === w.moduleKey && i.status === "live")) ? "Passed" : "Failed", detail: "Required live input availability" },
      { check: "Scores within valid range", status: inputs.every((i) => i.currentScore == null || (i.currentScore >= -100 && i.currentScore <= 100)) ? "Passed" : "Failed", detail: "Bias score bounds" },
      { check: "No stale critical input", status: "Warning", detail: "Freshness is monitored per input" },
      { check: "No failed critical source", status: inputs.some((i) => i.status === "failed") ? "Failed" : "Passed", detail: "Critical source status" },
      { check: "Approved active model", status: model?.version_status === "Active" ? "Passed" : "Blocked", detail: model?.model_version || "No active model" }
    ];
    const failed = checks.some((c) => ["Failed", "Blocked"].includes(c.status));
    const warning = checks.some((c) => c.status === "Warning");
    return { result: failed ? "Failed" : warning ? "Warning" : "Passed", checks };
  }
}

function buildBreakdown(inputs, weights, score) {
  const weightMap = new Map(weights.map((w) => [w.moduleKey, w]));
  return inputs.map((input) => {
    const weight = weightMap.get(input.moduleKey);
    return {
      scoreName: input.module,
      scoreCategory: weight?.scoreCategory || input.scoreType,
      currentValue: input.currentScore,
      label: biasLabel(input.currentScore),
      weight: weight?.weightPercent ?? 0,
      contribution: input.currentScore == null || !weight?.enabled ? null : round(input.currentScore * weight.weightPercent / 100),
      confidence: input.confidence,
      dataFreshness: freshness(input.lastUpdated),
      sourceHealth: input.health,
      lastCalculation: input.lastUpdated,
      status: input.status === "live" && input.currentScore != null ? "Calculated" : input.status === "live" ? "Insufficient Data" : "Insufficient Data",
      formula: "weighted_score = current_value * active_weight_percent / 100",
      missingInputs: input.status === "live" ? [] : ["Input unavailable. Final score confidence reduced."],
      previousScore: null,
      scoreChange: null,
      reasonForChange: "Latest production input snapshot"
    };
  });
}

function actionFor(score, confidence, risk) {
  if (score == null || confidence == null) return "Insufficient Data";
  if (confidence < 60) return "Wait";
  if (risk != null && risk > 60) return "Reduce Risk";
  if (score >= 25) return "Consider Buy";
  if (score <= -25) return "Consider Sell";
  return "Wait";
}

function instrumentRows(symbols, inputs, score) {
  const target = symbols.length ? symbols : [];
  const macro = inputs.find((i) => i.moduleKey === "macro")?.currentScore ?? null;
  const sentiment = inputs.find((i) => i.moduleKey === "sentiment")?.currentScore ?? null;
  const institutional = inputs.find((i) => i.moduleKey === "institutional")?.currentScore ?? null;
  const environment = inputs.find((i) => i.moduleKey === "market_environment")?.currentScore ?? null;
  const liquidity = inputs.find((i) => i.moduleKey === "broker_liquidity")?.health ?? null;
  const risk = score.riskScore;
  return target.map((instrument) => ({
    instrument,
    marketEnvironment: environment,
    macro,
    sentiment,
    institutional,
    liquidity,
    risk,
    finalScore: score.finalMarketBiasScore,
    confidence: score.finalConfidenceScore,
    tradingBias: biasLabel(score.finalMarketBiasScore),
    action: actionFor(score.finalMarketBiasScore, score.finalConfidenceScore, risk)
  }));
}

function agreementRows(instruments, inputs, score) {
  return instruments.map((row) => {
    const values = [row.macro, row.sentiment, row.institutional, row.marketEnvironment].filter((v) => v != null);
    const conflict = values.length > 1 && Math.max(...values) > 25 && Math.min(...values) < -25;
    const liquidityConflict = row.liquidity != null && row.liquidity < 50 && Math.abs(row.finalScore || 0) > 40;
    return {
      instrument: row.instrument,
      macro: biasLabel(row.macro),
      sentiment: biasLabel(row.sentiment),
      institutional: biasLabel(row.institutional),
      marketEnvironment: biasLabel(row.marketEnvironment),
      liquidity: row.liquidity == null ? "Insufficient Data" : confidenceLabel(row.liquidity),
      portfolioRisk: riskLabel(score.riskScore),
      agreementScore: score.signalAgreementScore,
      conflictType: conflict ? "Directional Conflict" : liquidityConflict ? "Execution Risk Warning" : "No Conflict",
      recommendation: conflict ? "Wait" : liquidityConflict ? "Reduce Position Size" : row.action
    };
  });
}

function normalizeDirectionalScore(value) {
  return value == null ? null : clamp(50 + Number(value) / 2);
}

function absoluteOpportunityScore(value) {
  return value == null ? null : clamp(Math.abs(Number(value)));
}

function label100(score) {
  if (score == null) return "Insufficient Data";
  if (score >= 85) return "Very Strong";
  if (score >= 70) return "Strong";
  if (score >= 45) return "Neutral";
  if (score >= 25) return "Weak";
  return "Very Weak";
}

function decisionRecommendation({ finalDecisionScore, directionalScore, riskScore, complianceScore, confidenceScore }) {
  if (finalDecisionScore == null) return "WAIT";
  if (riskScore != null && riskScore > 60) return "REDUCE RISK";
  if (complianceScore != null && complianceScore < TRADE_THRESHOLDS.complianceScore) return "AVOID";
  if (confidenceScore != null && confidenceScore < 45) return "WAIT";
  const bullish = Number(directionalScore || 0) >= 0;
  if (finalDecisionScore >= 85) return bullish ? "STRONG BUY" : "STRONG SELL";
  if (finalDecisionScore >= 70) return bullish ? "BUY" : "STRONG SELL";
  if (finalDecisionScore >= 55) return "WATCHLIST";
  if (finalDecisionScore >= 40) return "WAIT";
  return "AVOID";
}

async function activeDecisionModel() {
  const { rows } = await safeQuery(`
    SELECT m.id AS model_id, m.model_name, m.environment, m.status AS model_status, m.formula,
           v.id AS version_id, v.model_version, v.state AS version_status,
           v.created_by, v.created_at, v.approved_by, v.approved_at, v.activated_at, v.change_summary
    FROM market.intelligence_scoring_models m
    JOIN market.intelligence_model_versions v ON v.model_id = m.id AND v.state = 'Production'
    WHERE m.status = 'Production'
    ORDER BY v.activated_at DESC NULLS LAST
    LIMIT 1
  `);
  return rows[0] || null;
}

async function decisionWeights(modelVersionId) {
  const { rows } = await safeQuery(`
    SELECT id, layer_key, layer_label, weight_percent, minimum_score, maximum_score, enabled, last_changed_by, last_changed_at
    FROM market.intelligence_score_weights
    WHERE model_version_id = $1
    ORDER BY layer_key
  `, [modelVersionId]);
  return rows.map((row) => ({
    id: row.id,
    layerKey: row.layer_key,
    layerLabel: row.layer_label,
    weightPercent: Number(row.weight_percent),
    minimumScore: row.minimum_score == null ? null : Number(row.minimum_score),
    maximumScore: row.maximum_score == null ? null : Number(row.maximum_score),
    enabled: row.enabled,
    lastChangedBy: row.last_changed_by,
    lastChangedAt: row.last_changed_at
  }));
}

function buildDecisionLayers(inputs, score) {
  const byKey = Object.fromEntries(inputs.map((input) => [input.moduleKey, input]));
  const layerValues = {
    market_score: avg([
      normalizeDirectionalScore(byKey.market_environment?.currentScore),
      normalizeDirectionalScore(byKey.macro?.currentScore),
      normalizeDirectionalScore(byKey.sentiment?.currentScore),
      normalizeDirectionalScore(byKey.institutional?.currentScore),
      byKey.broker_liquidity?.health
    ]),
    opportunity_score: avg([
      absoluteOpportunityScore(byKey.market_environment?.currentScore),
      absoluteOpportunityScore(byKey.macro?.currentScore),
      absoluteOpportunityScore(byKey.sentiment?.currentScore),
      absoluteOpportunityScore(byKey.institutional?.currentScore),
      byKey.broker_liquidity?.health
    ]),
    risk_score: avg([
      score.riskScore,
      byKey.economic_calendar?.health == null ? null : 100 - byKey.economic_calendar.health,
      byKey.news_sentiment?.health == null ? null : 100 - byKey.news_sentiment.health,
      byKey.portfolio?.health == null ? null : 100 - byKey.portfolio.health,
      byKey.dependency_matrix?.health == null ? null : 100 - byKey.dependency_matrix.health
    ]),
    execution_score: avg([score.executionSafetyScore, byKey.broker_data?.health]),
    portfolio_score: avg([score.portfolioSafetyScore, byKey.account_portfolio?.health]),
    confidence_score: avg([score.finalConfidenceScore, score.dataQualityScore, byKey.source_health?.health]),
    compliance_score: byKey.prop_firm_rules?.health ?? null
  };
  return DECISION_LAYER_KEYS.map((key) => ({
    layerKey: key,
    layerLabel: key.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "),
    score: round(layerValues[key]),
    label: key === "risk_score" ? riskLabel(layerValues[key]) : label100(layerValues[key]),
    sourceModules: {
      market_score: ["Market Environment", "Macro Intelligence", "Sentiment Intelligence", "Institutional Intelligence", "Broker Liquidity"],
      opportunity_score: ["Trend Quality", "Market Structure", "Liquidity Location", "Institutional Bias", "Sentiment Confirmation", "COT Confirmation"],
      risk_score: ["News Risk", "Economic Calendar Risk", "Volatility Risk", "Spread Risk", "Correlation Risk", "Portfolio Risk", "Drawdown Risk", "Prop Firm Risk"],
      execution_score: ["Broker Liquidity", "Spread Stability", "Slippage", "Execution Quality", "Latency", "Market Session"],
      portfolio_score: ["Current Exposure", "Open Positions", "Margin Usage", "Drawdown", "Strategy Concentration", "Currency Concentration"],
      confidence_score: ["Data Freshness", "Source Health", "Signal Agreement", "Input Completeness", "AI Confidence"],
      compliance_score: ["Prop Firm Rules", "News Restrictions", "Maximum Drawdown", "Daily Drawdown", "Risk Limits", "Account Restrictions"]
    }[key]
  }));
}

function finalDecisionScore(layers, weights) {
  const weightMap = new Map(weights.filter((row) => row.enabled).map((row) => [row.layerKey, row.weightPercent]));
  const usable = layers.filter((layer) => layer.score != null && weightMap.has(layer.layerKey));
  const totalWeight = usable.reduce((sum, layer) => sum + weightMap.get(layer.layerKey), 0);
  if (!totalWeight) return null;
  return round(usable.reduce((sum, layer) => {
    const scoreForFormula = layer.layerKey === "risk_score" ? 100 - Number(layer.score) : Number(layer.score);
    return sum + scoreForFormula * weightMap.get(layer.layerKey);
  }, 0) / totalWeight);
}

function buildOpportunityRankings(instruments, layers, score, finalScore) {
  const layerMap = Object.fromEntries(layers.map((layer) => [layer.layerKey, layer.score]));
  return instruments
    .map((row) => {
      const instrumentAdjustment = avg([absoluteOpportunityScore(row.macro), absoluteOpportunityScore(row.sentiment), absoluteOpportunityScore(row.institutional), row.liquidity]);
      const opportunityScore = round(avg([layerMap.opportunity_score, instrumentAdjustment]));
      const decisionScore = round(avg([finalScore, opportunityScore, row.confidence]));
      return {
        instrument: row.instrument,
        marketScore: layerMap.market_score,
        opportunityScore,
        riskScore: layerMap.risk_score,
        executionScore: layerMap.execution_score,
        confidence: layerMap.confidence_score,
        finalScore: decisionScore,
        recommendation: decisionRecommendation({
          finalDecisionScore: decisionScore,
          directionalScore: score.finalMarketBiasScore,
          riskScore: layerMap.risk_score,
          complianceScore: layerMap.compliance_score,
          confidenceScore: layerMap.confidence_score
        })
      };
    })
    .filter((row) => row.finalScore != null)
    .sort((a, b) => Number(b.finalScore) - Number(a.finalScore) || a.instrument.localeCompare(b.instrument))
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function buildTradeQualifications(rankings, layers, weights) {
  const layerMap = Object.fromEntries(layers.map((layer) => [layer.layerKey, layer.score]));
  const weightMap = Object.fromEntries(weights.map((row) => [row.layerKey, row]));
  const thresholds = {
    marketScore: weightMap.market_score?.minimumScore ?? TRADE_THRESHOLDS.marketScore,
    opportunityScore: weightMap.opportunity_score?.minimumScore ?? TRADE_THRESHOLDS.opportunityScore,
    maxRiskScore: weightMap.risk_score?.maximumScore ?? TRADE_THRESHOLDS.maxRiskScore,
    confidenceScore: weightMap.confidence_score?.minimumScore ?? TRADE_THRESHOLDS.confidenceScore,
    complianceScore: weightMap.compliance_score?.minimumScore ?? TRADE_THRESHOLDS.complianceScore
  };
  return rankings.map((row) => {
    const checks = [
      ["Minimum Market Score", row.marketScore, ">=", thresholds.marketScore],
      ["Minimum Opportunity Score", row.opportunityScore, ">=", thresholds.opportunityScore],
      ["Maximum Risk Score", row.riskScore, "<=", thresholds.maxRiskScore],
      ["Minimum Confidence Score", row.confidence, ">=", thresholds.confidenceScore],
      ["Minimum Compliance Score", layerMap.compliance_score, ">=", thresholds.complianceScore]
    ];
    const failedRules = checks
      .filter(([, value, operator, limit]) => value == null || (operator === ">=" ? Number(value) < Number(limit) : Number(value) > Number(limit)))
      .map(([rule, value, operator, limit]) => ({ rule, value, operator, limit }));
    return {
      instrument: row.instrument,
      qualifies: failedRules.length === 0,
      marketScore: row.marketScore,
      opportunityScore: row.opportunityScore,
      riskScore: row.riskScore,
      confidenceScore: row.confidence,
      complianceScore: layerMap.compliance_score,
      failedRules,
      thresholds,
      recommendation: failedRules.length ? "WAIT" : row.recommendation
    };
  });
}

function buildSignalConflicts(agreement, score) {
  return agreement
    .filter((row) => row.conflictType !== "No Conflict")
    .map((row) => ({
      instrument: row.instrument,
      conflictType: row.conflictType,
      severity: row.conflictType === "Directional Conflict" ? "high" : "medium",
      resolutionRecommendation: row.recommendation,
      supportingSignals: [
        { source: "Macro", bias: row.macro },
        { source: "Institutional", bias: row.institutional }
      ].filter((item) => /bullish|bearish/i.test(item.bias)),
      opposingSignals: [
        { source: "Sentiment", bias: row.sentiment },
        { source: "Liquidity", bias: row.liquidity },
        { source: "News", bias: riskLabel(score.riskScore) }
      ].filter((item) => /bearish|risk|low|weak/i.test(item.bias))
    }));
}

function buildDecisionAnalysis({ rankings, qualifications, conflicts, layers, score }) {
  const top = rankings[0] || null;
  const qualification = top ? qualifications.find((row) => row.instrument === top.instrument) : null;
  const supporting = layers.filter((layer) => layer.score != null && (layer.layerKey === "risk_score" ? layer.score <= 30 : layer.score >= 70)).map((layer) => `${layer.layerLabel}: ${layer.score}`);
  const opposing = layers.filter((layer) => layer.score == null || (layer.layerKey === "risk_score" ? layer.score > 30 : layer.score < 60)).map((layer) => `${layer.layerLabel}: ${layer.score ?? "Insufficient Data"}`);
  const riskWarnings = [
    ...(conflicts.length ? [`${conflicts.length} signal conflict(s) detected`] : []),
    ...(score.riskScore != null && score.riskScore > 30 ? [`Risk score ${score.riskScore} exceeds qualification threshold`] : [])
  ];
  return {
    title: "AI Trading Decision Analysis",
    instrument: top?.instrument || null,
    qualifies: qualification?.qualifies ?? false,
    whyTradeQualifies: qualification?.qualifies ? `${top.instrument} passes all configured trade qualification gates.` : null,
    whyTradeFails: qualification && !qualification.qualifies ? qualification.failedRules.map((row) => `${row.rule} ${row.value ?? "Insufficient Data"} ${row.operator} ${row.limit}`).join("; ") : null,
    majorSupportingFactors: supporting,
    majorOpposingFactors: opposing,
    riskWarnings,
    recommendedPositionSize: qualification?.qualifies ? "Use execution engine risk model with current account equity and prop limits." : "No position until failed gates are resolved.",
    suggestedRiskPercent: qualification?.qualifies ? 0.5 : 0,
    suggestedSession: "Use live session liquidity from Broker Liquidity before execution.",
    suggestedHoldingPeriod: "Intraday only until score history confirms stability."
  };
}

async function buildScoreHistory(current = {}) {
  const { rows } = await safeQuery(`
    SELECT period, bucket_start, final_score, confidence_score, risk_score, opportunity_score, created_at
    FROM market.intelligence_score_history
    ORDER BY bucket_start DESC, created_at DESC
    LIMIT 90
  `);
  const history = rows.map((row) => ({
    period: row.period,
    bucketStart: row.bucket_start,
    finalScore: row.final_score == null ? null : Number(row.final_score),
    confidenceScore: row.confidence_score == null ? null : Number(row.confidence_score),
    riskScore: row.risk_score == null ? null : Number(row.risk_score),
    opportunityScore: row.opportunity_score == null ? null : Number(row.opportunity_score),
    createdAt: row.created_at
  }));
  if (current.finalDecisionScore != null) {
    history.unshift({
      period: "current",
      bucketStart: new Date().toISOString(),
      finalScore: current.finalDecisionScore,
      confidenceScore: current.confidenceScore,
      riskScore: current.riskScore,
      opportunityScore: current.opportunityScore,
      createdAt: new Date().toISOString()
    });
  }
  return history;
}

function buildExplainability(breakdown, layers) {
  return layers.map((layer) => ({
    layerKey: layer.layerKey,
    layer: layer.layerLabel,
    score: layer.score,
    label: layer.label,
    components: breakdown
      .filter((row) => layer.sourceModules.includes(row.scoreName) || layer.sourceModules.includes(row.scoreCategory) || row.scoreName === "Broker Liquidity")
      .map((row) => ({
        component: row.scoreName,
        value: row.currentValue,
        weight: row.weight,
        contribution: row.contribution,
        confidence: row.confidence,
        sourceHealth: row.sourceHealth,
        explanation: `${row.scoreName} contributed ${row.contribution ?? "no calculated"} points from ${row.status}.`
      }))
  }));
}

function buildDecisionCenter({ model, inputs, score, validation, breakdown, instruments, agreement, weights: scoringWeights }, decisionModel, layerWeights) {
  const layers = buildDecisionLayers(inputs, score);
  const finalDecision = finalDecisionScore(layers, layerWeights);
  const layerMap = Object.fromEntries(layers.map((layer) => [layer.layerKey, layer.score]));
  const recommendation = decisionRecommendation({
    finalDecisionScore: finalDecision,
    directionalScore: score.finalMarketBiasScore,
    riskScore: layerMap.risk_score,
    complianceScore: layerMap.compliance_score,
    confidenceScore: layerMap.confidence_score
  });
  const rankings = buildOpportunityRankings(instruments, layers, score, finalDecision);
  const qualifications = buildTradeQualifications(rankings, layers, layerWeights);
  const conflicts = buildSignalConflicts(agreement, score);
  const aiDecision = buildDecisionAnalysis({ rankings, qualifications, conflicts, layers, score });
  const signalMatrix = agreement.map((row) => ({
    instrument: row.instrument,
    macro: row.macro,
    sentiment: row.sentiment,
    institutional: row.institutional,
    environment: row.marketEnvironment,
    liquidity: row.liquidity,
    portfolio: row.portfolioRisk,
    agreementPercent: row.agreementScore
  }));
  return {
    decisionModel: decisionModel || model,
    layerWeights,
    layers,
    finalDecisionScore: finalDecision,
    recommendation,
    rankings,
    tradeQualifications: qualifications,
    conflicts,
    signalAgreementMatrix: signalMatrix,
    aiDecision,
    explainability: buildExplainability(breakdown, layers),
    qualificationThresholds: TRADE_THRESHOLDS,
    validation,
    scoringWeights
  };
}

function ai(score, breakdown, agreement) {
  if (score.finalMarketBiasScore == null) {
    return {
      status: "insufficient_data",
      narrative: "Scoring engine cannot calculate market intelligence scores yet. Connect required intelligence modules, configure scoring weights, and activate an approved scoring model to enable live scoring.",
      bullets: ["Current final bias: Insufficient Data", "Recommended posture: Complete required inputs and validate the active model."]
    };
  }
  const sorted = [...breakdown].filter((b) => b.contribution != null).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return {
    status: "ready",
    narrative: `Current final bias is ${biasLabel(score.finalMarketBiasScore)} with ${confidenceLabel(score.finalConfidenceScore)}. Strongest contributors are ${sorted.slice(0, 3).map((b) => b.scoreName).join(", ")}.`,
    bullets: [
      `Final bias: ${biasLabel(score.finalMarketBiasScore)}`,
      `Weakest confidence areas: ${breakdown.filter((b) => (b.confidence || 0) < 60).map((b) => b.scoreName).join(", ") || "None below threshold"}`,
      `Conflicting signals: ${agreement.filter((a) => a.conflictType !== "No Conflict").length}`,
      `Execution risk: ${confidenceLabel(score.executionSafetyScore)}`,
      `Portfolio risk: ${riskLabel(score.riskScore)}`,
      `Recommended trading posture: ${score.tradingSuitabilityScore >= 75 ? "Trade selectively" : "Wait or reduce risk"}`
    ]
  };
}

async function audit(action, payload = {}, actor = "api") {
  await safeQuery("INSERT INTO market.scoring_audit_logs (actor, action, payload) VALUES ($1,$2,$3::jsonb)", [actor, action, JSON.stringify(payload)]);
  await safeQuery("INSERT INTO market.intelligence_audit_logs (actor, action, entity_type, payload) VALUES ($1,$2,'scoring_engine',$3::jsonb)", [actor, action, JSON.stringify(payload)]);
}

async function persistDecisionCenter(dashboard, actor = "api") {
  const decisionModel = await activeDecisionModel();
  const layer = (key) => dashboard.decisionLayers.find((row) => row.layerKey === key)?.score ?? null;
  const { rows } = await safeQuery(
    `INSERT INTO market.intelligence_score_results (
      model_version_id, market_score, opportunity_score, risk_score, execution_score, portfolio_score,
      confidence_score, compliance_score, final_decision_score, recommendation, status, triggered_by, payload
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Calculated',$11,$12::jsonb) RETURNING id`,
    [
      decisionModel?.version_id || null,
      layer("market_score"),
      layer("opportunity_score"),
      layer("risk_score"),
      layer("execution_score"),
      layer("portfolio_score"),
      layer("confidence_score"),
      layer("compliance_score"),
      dashboard.finalDecisionScore,
      dashboard.finalRecommendation,
      actor,
      JSON.stringify({ sourceMode: "PRODUCTION_LIVE_ONLY", mockDataDisabled: true, summary: dashboard.summary })
    ]
  );
  const resultId = rows[0]?.id;
  if (!resultId) return null;

  for (const item of dashboard.explainability || []) {
    for (const component of item.components || []) {
      await safeQuery(
        `INSERT INTO market.intelligence_score_breakdowns (
          result_id, layer_key, component_name, component_score, contribution, explanation, source_module, source_status, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [resultId, item.layerKey, component.component, component.value, component.contribution, component.explanation, component.component, "Calculated", JSON.stringify(component)]
      );
    }
  }
  for (const row of dashboard.opportunityRankings || []) {
    await safeQuery(
      `INSERT INTO market.intelligence_opportunity_rankings (
        result_id, rank, instrument, market_score, opportunity_score, risk_score, execution_score, confidence_score, final_score, recommendation
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [resultId, row.rank, row.instrument, row.marketScore, row.opportunityScore, row.riskScore, row.executionScore, row.confidence, row.finalScore, row.recommendation]
    );
  }
  for (const row of dashboard.tradeQualifications || []) {
    await safeQuery(
      `INSERT INTO market.intelligence_trade_qualifications (
        result_id, instrument, qualifies, market_score, opportunity_score, risk_score, confidence_score, compliance_score,
        failed_rules, thresholds, recommendation
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [resultId, row.instrument, row.qualifies, row.marketScore, row.opportunityScore, row.riskScore, row.confidenceScore, row.complianceScore, JSON.stringify(row.failedRules), JSON.stringify(row.thresholds), row.recommendation]
    );
  }
  for (const row of dashboard.signalConflicts || []) {
    await safeQuery(
      `INSERT INTO market.intelligence_signal_conflicts (
        result_id, instrument, conflict_type, severity, resolution_recommendation, supporting_signals, opposing_signals
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [resultId, row.instrument, row.conflictType, row.severity, row.resolutionRecommendation, JSON.stringify(row.supportingSignals), JSON.stringify(row.opposingSignals)]
    );
  }
  for (const row of dashboard.signalAgreementMatrix || []) {
    await safeQuery(
      `INSERT INTO market.intelligence_signal_agreements (
        result_id, instrument, macro, sentiment, institutional, environment, liquidity, portfolio, agreement_percent
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [resultId, row.instrument, row.macro, row.sentiment, row.institutional, row.environment, row.liquidity, row.portfolio, row.agreementPercent]
    );
  }
  const bucketStart = new Date();
  bucketStart.setUTCHours(0, 0, 0, 0);
  for (const period of ["daily", "weekly", "monthly"]) {
    await safeQuery(
      `INSERT INTO market.intelligence_score_history (
        result_id, period, final_score, confidence_score, risk_score, opportunity_score, bucket_start
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        resultId,
        period,
        dashboard.finalDecisionScore,
        layer("confidence_score"),
        layer("risk_score"),
        layer("opportunity_score"),
        bucketStart.toISOString()
      ]
    );
  }
  if (dashboard.aiDecision) {
    await safeQuery(
      `INSERT INTO market.intelligence_ai_decisions (
        result_id, instrument, qualifies, why_trade_qualifies, why_trade_fails, supporting_factors, opposing_factors,
        risk_warnings, recommended_position_size, suggested_risk_percent, suggested_session, suggested_holding_period
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11,$12)`,
      [
        resultId,
        dashboard.aiDecision.instrument,
        dashboard.aiDecision.qualifies,
        dashboard.aiDecision.whyTradeQualifies,
        dashboard.aiDecision.whyTradeFails,
        JSON.stringify(dashboard.aiDecision.majorSupportingFactors || []),
        JSON.stringify(dashboard.aiDecision.majorOpposingFactors || []),
        JSON.stringify(dashboard.aiDecision.riskWarnings || []),
        dashboard.aiDecision.recommendedPositionSize,
        dashboard.aiDecision.suggestedRiskPercent,
        dashboard.aiDecision.suggestedSession,
        dashboard.aiDecision.suggestedHoldingPeriod
      ]
    );
  }
  await audit("decision_result_persisted", { resultId }, actor);
  return resultId;
}

async function computeDashboard() {
  const model = await activeModel();
  if (!model) return { noModel: true };
  const [modelWeights, { rows: inputs, symbols }, decisionModel] = await Promise.all([weights(model.version_id), moduleInputs(), activeDecisionModel()]);
  const layerWeights = decisionModel ? await decisionWeights(decisionModel.version_id) : [];
  const score = MarketIntelligenceScoringEngine.calculate(inputs, modelWeights);
  const validation = ScoringValidationService.validate(model, modelWeights, inputs);
  const breakdown = buildBreakdown(inputs, modelWeights, score);
  const instruments = instrumentRows(symbols, inputs, score);
  const agreement = agreementRows(instruments, inputs, score);
  const alerts = await safeQuery("SELECT * FROM market.scoring_alerts WHERE status = 'open' ORDER BY created_at DESC LIMIT 100").then((r) => r.rows.map((row) => ({
    id: row.id, severity: row.severity, title: row.title, message: row.message, createdAt: row.created_at
  })));
  const decisionCenter = buildDecisionCenter({ model, inputs, score, validation, breakdown, instruments, agreement, weights: modelWeights }, decisionModel, layerWeights);
  return { model, weights: modelWeights, inputs, score, validation, breakdown, instruments, agreement, alerts, decisionCenter };
}

export async function getScoringEngineDashboard() {
  const data = await computeDashboard();
  if (data.noModel) {
    return {
      page: "scoring-engine",
      title: "Intelligence Scoring & Decision Engine Center",
      summary: { status: "insufficient_data", overallMarketScore: null, overallConfidenceScore: null, modelVersion: "Insufficient Data" },
      inputs: [], weights: [], breakdown: [], agreement: [], instruments: [], models: [], audit: [], validation: { result: "Blocked", checks: [] }, alerts: [],
      decisionLayers: [],
      finalDecisionScore: null,
      finalRecommendation: "WAIT",
      opportunityRankings: [],
      tradeQualifications: [],
      signalConflicts: [],
      signalAgreementMatrix: [],
      scoreHistory: [],
      explainability: [],
      whatIfSimulation: { enabled: true, message: "Simulation requires an active production model." },
      governance: { states: ["Draft", "Testing", "Approved", "Production", "Archived"], activeModel: null },
      aiSummary: ai({}, [], []),
      aiDecision: {},
      emptyState: {
        title: "Scoring engine cannot calculate market intelligence scores yet.",
        message: "Connect required intelligence modules, configure scoring weights, and activate an approved scoring model to enable live scoring."
      }
    };
  }
  const { model, weights: w, inputs, score, validation, breakdown, instruments, agreement, alerts, decisionCenter } = data;
  const models = await safeQuery(`
    SELECT m.id, m.model_name, v.model_version, v.status, v.created_by, v.created_at, v.approved_by, v.approved_at, v.activated_at, v.change_summary
    FROM market.scoring_models m JOIN market.scoring_model_versions v ON v.model_id = m.id
    ORDER BY v.created_at DESC
  `).then((r) => r.rows.map((row) => ({
    id: row.id, modelName: row.model_name, modelVersion: row.model_version, status: row.status, createdBy: row.created_by, createdAt: row.created_at,
    approvedBy: row.approved_by, approvedAt: row.approved_at, activatedAt: row.activated_at, changeSummary: row.change_summary
  })));
  const auditRows = await safeQuery("SELECT * FROM market.scoring_audit_logs ORDER BY created_at DESC LIMIT 100").then((r) => r.rows.map((row) => ({ id: row.id, actor: row.actor, action: row.action, result: row.result, createdAt: row.created_at, payload: row.payload })));
  return {
    page: "scoring-engine",
    title: "Intelligence Scoring & Decision Engine Center",
    generatedAt: new Date().toISOString(),
    permissions: [
      "market_intelligence.scoring_engine.view", "market_intelligence.scoring_engine.recalculate", "market_intelligence.scoring_engine.configure_weights",
      "market_intelligence.scoring_engine.approve_model", "market_intelligence.scoring_engine.activate_model", "market_intelligence.scoring_engine.validate",
      "market_intelligence.scoring_engine.export", "market_intelligence.scoring_engine.create_alert"
    ],
    summary: {
      sourceMode: "PRODUCTION_LIVE_ONLY",
      mockDataDisabled: true,
      status: score.finalMarketBiasScore == null ? "insufficient_data" : "ready",
      lastScoreCalculation: breakdown.map((b) => b.lastCalculation).filter(Boolean).sort().at(-1) || null,
      modelVersion: model.model_version,
      overallConfidenceScore: score.finalConfidenceScore,
      overallMarketScore: score.finalMarketBiasScore,
      marketEnvironmentScore: inputs.find((i) => i.moduleKey === "market_environment")?.currentScore ?? null,
      macroScore: inputs.find((i) => i.moduleKey === "macro")?.currentScore ?? null,
      sentimentScore: inputs.find((i) => i.moduleKey === "sentiment")?.currentScore ?? null,
      institutionalScore: inputs.find((i) => i.moduleKey === "institutional")?.currentScore ?? null,
      liquidityScore: inputs.find((i) => i.moduleKey === "broker_liquidity")?.health ?? null,
      portfolioRiskScore: score.riskScore,
      dataConfidenceScore: score.dataQualityScore,
      sourceHealthScore: inputs.find((i) => i.moduleKey === "source_health")?.health ?? null,
      dependencyRiskScore: inputs.find((i) => i.moduleKey === "dependency_matrix")?.health == null ? null : 100 - inputs.find((i) => i.moduleKey === "dependency_matrix").health,
      signalAgreementScore: score.signalAgreementScore,
      lastRecalculationStatus: validation.result,
      label: biasLabel(score.finalMarketBiasScore),
      finalDecisionScore: decisionCenter.finalDecisionScore,
      finalRecommendation: decisionCenter.recommendation
    },
    inputs: inputs.map((input) => ({
      ...input,
      currentScore: input.currentScore,
      weight: w.find((row) => row.moduleKey === input.moduleKey)?.weightPercent ?? 0,
      freshness: freshness(input.lastUpdated),
      usedInFinalScore: w.find((row) => row.moduleKey === input.moduleKey)?.enabled && input.currentScore != null,
      missingMessage: input.status === "live" ? null : "Input unavailable. Final score confidence reduced."
    })),
    weights: w,
    breakdown,
    agreement,
    decisionLayers: decisionCenter.layers,
    layerWeights: decisionCenter.layerWeights,
    finalDecisionScore: decisionCenter.finalDecisionScore,
    finalRecommendation: decisionCenter.recommendation,
    opportunityRankings: decisionCenter.rankings,
    tradeQualifications: decisionCenter.tradeQualifications,
    signalConflicts: decisionCenter.conflicts,
    signalAgreementMatrix: decisionCenter.signalAgreementMatrix,
    scoreHistory: await buildScoreHistory({
      finalDecisionScore: decisionCenter.finalDecisionScore,
      confidenceScore: decisionCenter.layers.find((layer) => layer.layerKey === "confidence_score")?.score,
      riskScore: decisionCenter.layers.find((layer) => layer.layerKey === "risk_score")?.score,
      opportunityScore: decisionCenter.layers.find((layer) => layer.layerKey === "opportunity_score")?.score
    }),
    explainability: decisionCenter.explainability,
    whatIfSimulation: {
      enabled: true,
      supportedChanges: ["remove_news_risk", "increase_liquidity", "change_weight", "change_sentiment"],
      route: "/api/market-intelligence/scoring-engine/simulate"
    },
    governance: {
      states: ["Draft", "Testing", "Approved", "Production", "Archived"],
      activeModel: decisionCenter.decisionModel,
      approvalWorkflow: ["Draft", "Testing", "Approved", "Production", "Archived"]
    },
    instruments,
    models,
    audit: auditRows,
    validation,
    alerts,
    aiSummary: ai(score, breakdown, agreement),
    aiDecision: decisionCenter.aiDecision,
    emptyState: score.finalMarketBiasScore == null ? {
      title: "Scoring engine cannot calculate market intelligence scores yet.",
      message: "Connect required intelligence modules, configure scoring weights, and activate an approved scoring model to enable live scoring.",
      actions: ["Configure Weights", "Activate Scoring Model", "Open Dependency Matrix", "Run Source Health Review"]
    } : null
  };
}

export async function getScoringEngineSummary() {
  return { summary: (await getScoringEngineDashboard()).summary };
}

export async function validateScoringEngine(actor = "api") {
  const dashboard = await getScoringEngineDashboard();
  await audit("validation", dashboard.validation, actor);
  return { accepted: true, validation: dashboard.validation };
}

export async function recalculateScoringEngine(actor = "api", target = "all") {
  const started = Date.now();
  const dashboard = await getScoringEngineDashboard();
  const model = await activeModel();
  let resultId = null;
  if (model && dashboard.summary.status === "ready") {
    const { rows } = await safeQuery(
      `INSERT INTO market.scoring_results (
        model_version_id, final_market_bias_score, final_confidence_score, trading_suitability_score, risk_score,
        signal_agreement_score, data_quality_score, source_reliability_score, market_opportunity_score,
        execution_safety_score, portfolio_safety_score, status, triggered_by, duration_ms
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Calculated',$12,$13) RETURNING id`,
      [model.version_id, dashboard.summary.overallMarketScore, dashboard.summary.overallConfidenceScore, null, dashboard.summary.portfolioRiskScore, dashboard.summary.signalAgreementScore, dashboard.summary.dataConfidenceScore, dashboard.summary.sourceHealthScore, null, dashboard.summary.liquidityScore, null, actor, Date.now() - started]
    );
    resultId = rows[0]?.id;
  }
  const decisionResultId = dashboard.summary.status === "ready" ? await persistDecisionCenter(dashboard, actor) : null;
  await safeQuery("INSERT INTO market.scoring_recalculation_jobs (job_type, target, triggered_by, completed_at, result_id) VALUES ($1,$2,$3,now(),$4)", ["manual", target, actor, resultId]);
  await audit("manual_recalculation", { target, resultId, decisionResultId }, actor);
  return { accepted: true, type: "scoring_engine.recalculate.completed", resultId, decisionResultId, dashboard };
}

export async function createScoringAlert(input = {}, actor = "api") {
  const severity = ["info", "warning", "high_risk", "critical"].includes(input.severity) ? input.severity : "warning";
  const { rows } = await safeQuery("INSERT INTO market.scoring_alerts (severity,title,message,created_by) VALUES ($1,$2,$3,$4) RETURNING id", [severity, input.title || "Scoring alert", input.message || "Manual scoring alert", actor]);
  await audit("create_alert", { id: rows[0]?.id, severity }, actor);
  return { accepted: true, id: rows[0]?.id };
}

export async function updateScoringWeights(input = {}, actor = "api") {
  const model = await activeModel();
  if (!model) throw new Error("active_model_not_found");
  for (const item of input.weights || []) {
    await safeQuery(
      `UPDATE market.scoring_model_weights SET weight_percent = COALESCE($3, weight_percent), enabled = COALESCE($4, enabled),
       minimum_required_confidence = COALESCE($5, minimum_required_confidence), last_changed_by = $6, last_changed_at = now()
       WHERE model_version_id = $1 AND module_key = $2`,
      [model.version_id, item.moduleKey, item.weightPercent ?? null, item.enabled ?? null, item.minimumRequiredConfidence ?? null, actor]
    );
  }
  await audit("weight_changed", input, actor);
  return { accepted: true, weights: (await getScoringEngineDashboard()).weights };
}

export async function createScoringModel(input = {}, actor = "api") {
  const { rows } = await safeQuery("INSERT INTO market.scoring_models (model_name, environment, status, created_by, change_summary) VALUES ($1,'production','Draft',$2,$3) RETURNING id", [input.modelName || "Draft Scoring Model", actor, input.changeSummary || "Draft model"]);
  await audit("model_created", { id: rows[0]?.id }, actor);
  return { accepted: true, id: rows[0]?.id };
}

export async function transitionScoringModelVersion(id, action, actor = "api") {
  const status = action === "submit" ? "Pending Approval" : action === "approve" ? "Approved" : "Active";
  if (action === "activate") {
    await safeQuery("UPDATE market.scoring_model_versions SET status = 'Approved' WHERE status = 'Active'");
  }
  await safeQuery(`UPDATE market.scoring_model_versions SET status = $2, approved_by = CASE WHEN $2 IN ('Approved','Active') THEN $3 ELSE approved_by END, approved_at = CASE WHEN $2 IN ('Approved','Active') THEN now() ELSE approved_at END, activated_at = CASE WHEN $2 = 'Active' THEN now() ELSE activated_at END WHERE id = $1`, [id, status, actor]);
  await audit(`model_${action}`, { id, status }, actor);
  return { accepted: true, id, status };
}

export async function getScoringEngineRankings() {
  const dashboard = await getScoringEngineDashboard();
  return { rankings: dashboard.opportunityRankings, tradeQualifications: dashboard.tradeQualifications };
}

export async function getScoringEngineHistory() {
  const dashboard = await getScoringEngineDashboard();
  return {
    history: dashboard.scoreHistory,
    charts: {
      finalScoreTrend: dashboard.scoreHistory.map((row) => ({ at: row.bucketStart, value: row.finalScore })),
      confidenceTrend: dashboard.scoreHistory.map((row) => ({ at: row.bucketStart, value: row.confidenceScore })),
      riskTrend: dashboard.scoreHistory.map((row) => ({ at: row.bucketStart, value: row.riskScore })),
      opportunityTrend: dashboard.scoreHistory.map((row) => ({ at: row.bucketStart, value: row.opportunityScore }))
    }
  };
}

export async function getScoringEngineConflicts() {
  const dashboard = await getScoringEngineDashboard();
  return { conflicts: dashboard.signalConflicts };
}

export async function getScoringEngineAgreements() {
  const dashboard = await getScoringEngineDashboard();
  return { agreements: dashboard.signalAgreementMatrix };
}

export async function getScoringEngineModel() {
  const model = await activeDecisionModel();
  const layerWeights = model ? await decisionWeights(model.version_id) : [];
  if (!model) {
    return {
      model: null,
      layerWeights: [],
      scoringWeights: [],
      governance: { states: ["Draft", "Testing", "Approved", "Production", "Archived"], activeModel: null }
    };
  }
  return {
    model,
    layerWeights,
    scoringWeights: [],
    governance: {
      states: ["Draft", "Testing", "Approved", "Production", "Archived"],
      activeModel: model,
      approvalWorkflow: ["Draft", "Testing", "Approved", "Production", "Archived"]
    }
  };
}

export async function simulateScoringEngine(input = {}, actor = "api") {
  const data = await computeDashboard();
  if (data.noModel) return { accepted: false, error: "active_model_not_found" };
  const weights = data.decisionCenter.layerWeights.map((row) => ({ ...row }));
  const inputs = data.inputs.map((row) => ({ ...row }));
  const changes = input.changes || input || {};
  if (changes.removeNewsRisk) {
    const news = inputs.find((row) => row.moduleKey === "news_sentiment");
    const calendar = inputs.find((row) => row.moduleKey === "economic_calendar");
    if (news) news.health = 100;
    if (calendar) calendar.health = 100;
  }
  if (changes.increaseLiquidity != null) {
    const liquidity = inputs.find((row) => row.moduleKey === "broker_liquidity");
    if (liquidity) liquidity.health = clamp(Number(liquidity.health || 0) + Number(changes.increaseLiquidity));
  }
  if (changes.changeSentiment != null) {
    const sentiment = inputs.find((row) => row.moduleKey === "sentiment");
    if (sentiment) sentiment.currentScore = clamp(Number(changes.changeSentiment), -100, 100);
  }
  for (const change of changes.weights || []) {
    const weight = weights.find((row) => row.layerKey === change.layerKey);
    if (weight) weight.weightPercent = Number(change.weightPercent);
  }
  const score = MarketIntelligenceScoringEngine.calculate(inputs, data.weights);
  const layers = buildDecisionLayers(inputs, score);
  const finalDecision = finalDecisionScore(layers, weights);
  const layerMap = Object.fromEntries(layers.map((layer) => [layer.layerKey, layer.score]));
  const recommendation = decisionRecommendation({
    finalDecisionScore: finalDecision,
    directionalScore: score.finalMarketBiasScore,
    riskScore: layerMap.risk_score,
    complianceScore: layerMap.compliance_score,
    confidenceScore: layerMap.confidence_score
  });
  await audit("what_if_simulation", { changes }, actor);
  return {
    accepted: true,
    sourceMode: "PRODUCTION_LIVE_ONLY_WITH_OPERATOR_SIMULATION",
    baseline: {
      finalDecisionScore: data.decisionCenter.finalDecisionScore,
      recommendation: data.decisionCenter.recommendation,
      layers: data.decisionCenter.layers
    },
    simulation: {
      finalDecisionScore: finalDecision,
      recommendation,
      layers
    },
    delta: finalDecision == null || data.decisionCenter.finalDecisionScore == null ? null : round(finalDecision - data.decisionCenter.finalDecisionScore)
  };
}

export async function approveScoringEngineModel(input = {}, actor = "api") {
  const model = await activeDecisionModel();
  if (!model?.version_id) throw new Error("active_decision_model_not_found");
  await safeQuery(
    `UPDATE market.intelligence_model_versions
     SET state = 'Production', approved_by = $2, approved_at = now(), activated_at = now()
     WHERE id = $1`,
    [input.modelVersionId || model.version_id, actor]
  );
  await audit("decision_model_approved", { modelVersionId: input.modelVersionId || model.version_id }, actor);
  return { accepted: true, modelVersionId: input.modelVersionId || model.version_id, state: "Production" };
}

export async function exportScoringReport() {
  const dashboard = await getScoringEngineDashboard();
  return {
    exportedAt: new Date().toISOString(),
    sourceMode: "PRODUCTION_LIVE_ONLY",
    mockDataDisabled: true,
    summary: dashboard.summary,
    decisionLayers: dashboard.decisionLayers,
    finalDecisionScore: dashboard.finalDecisionScore,
    finalRecommendation: dashboard.finalRecommendation,
    opportunityRankings: dashboard.opportunityRankings,
    tradeQualifications: dashboard.tradeQualifications,
    signalConflicts: dashboard.signalConflicts,
    signalAgreementMatrix: dashboard.signalAgreementMatrix,
    explainability: dashboard.explainability,
    aiDecision: dashboard.aiDecision,
    breakdown: dashboard.breakdown,
    instruments: dashboard.instruments,
    validation: dashboard.validation
  };
}
