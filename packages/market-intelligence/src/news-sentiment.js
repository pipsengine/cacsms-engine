export const NEWS_SOURCES = Object.freeze([]);
export const NEWS_HEADLINES = Object.freeze([]);
export const NEWS_ASSET_IMPACT = Object.freeze([]);
export const NEWS_RISK_EVENTS = Object.freeze([]);
export const AI_HEADLINE_CLASSIFICATION = null;

export function evaluateNewsSentiment({
  sources = NEWS_SOURCES,
  headlines = NEWS_HEADLINES,
  riskEvents = NEWS_RISK_EVENTS
} = {}) {
  const configured = sources.length > 0;
  const sourceFailed = sources.some(({ status }) => status === "FAILED");
  const critical = headlines.some(({ impact }) => impact === "CRITICAL");
  const highImpactHeadlines = headlines.filter(({ impact }) => impact === "HIGH").length;
  const blocked = sourceFailed || critical;
  const restricted = !blocked && configured && (highImpactHeadlines > 0 || riskEvents.length > 0);
  const affectedAssets = [...new Set(headlines.flatMap(({ affectedAssets = [] }) => affectedAssets))];

  return {
    source: "news_sentiment",
    status: configured ? (sourceFailed ? "FAILED" : "LIVE") : "NOT_CONFIGURED",
    sentiment_score: null,
    sentiment_mode: "UNAVAILABLE",
    news_risk_mode: blocked ? "BLOCKED" : restricted ? "MODERATE" : "UNAVAILABLE",
    high_impact_headlines: highImpactHeadlines,
    affected_assets: affectedAssets,
    workflow_permission: blocked ? "BLOCKED" : configured ? "RESTRICTED" : "RESTRICTED",
    risk_recommendation: configured
      ? "Use live normalized headlines and provider risk signals."
      : "Configure a live news sentiment adapter.",
    warnings: configured ? [] : ["No live news sentiment adapter is configured."],
    blocks: blocked ? ["Critical news risk or source failure during active window."] : []
  };
}

export function getNewsSentimentDashboard() {
  return {
    ...evaluateNewsSentiment(),
    sources: NEWS_SOURCES,
    headlines: NEWS_HEADLINES,
    assetImpact: NEWS_ASSET_IMPACT,
    riskEvents: NEWS_RISK_EVENTS,
    classification: AI_HEADLINE_CLASSIFICATION,
    activeHeadlines: 0,
    sourceHealth: null,
    riskOffAlerts: 0,
    aiClassified: 0,
    source_mode: "LIVE_ADAPTERS_ONLY"
  };
}
