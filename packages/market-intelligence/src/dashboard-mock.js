import { DATA_SOURCES, evaluateDataQualityGate } from "./data-sources.js";

export const ECONOMIC_EVENTS = Object.freeze([
  ["14:30", "USD", "CPI", "HIGH", "3.2%", "3.1%", "-", "HIGH", "Block before event"],
  ["18:00", "USD", "FOMC Minutes", "HIGH", "-", "-", "-", "HIGH", "Reduce risk"],
  ["09:15", "GBP", "BOE Speech", "MEDIUM", "-", "-", "-", "MEDIUM", "Restrict"],
  ["11:00", "EUR", "ECB President Speech", "MEDIUM", "-", "-", "-", "MEDIUM", "Allow"],
  ["23:50", "JPY", "BOJ Rate Statement", "HIGH", "0.10%", "0.10%", "-", "HIGH", "Block after event"]
].map(([time, currency, event, impact, previous, forecast, actual, riskLevel, tradingAction]) => ({ time, currency, event, impact, previous, forecast, actual, riskLevel, tradingAction })));

export const NEWS_SENTIMENT = Object.freeze([
  { title: "Gold strengthens as dollar weakens", source: "Reuters", time: "8m", impact: "HIGH", assets: ["XAUUSD", "EURUSD"], sentiment: "RISK-ON" },
  { title: "Fed officials signal caution on rate path", source: "Bloomberg", time: "21m", impact: "MEDIUM", assets: ["USDJPY", "NAS100"], sentiment: "CAUTION" },
  { title: "Oil rises on renewed supply concerns", source: "MarketWire", time: "34m", impact: "MEDIUM", assets: ["USOIL"], sentiment: "RISK-ON" }
]);

export const BROKER_FEEDS = Object.freeze([
  ["IC Markets", "ONLINE", 18, "Excellent", "Deep", "READY"],
  ["Pepperstone", "ONLINE", 24, "Excellent", "Deep", "READY"],
  ["Exness", "ONLINE", 31, "Good", "Good", "READY"],
  ["FTMO", "ONLINE", 38, "Good", "Good", "READY"],
  ["FundedNext", "ONLINE", 42, "Good", "Good", "READY"]
].map(([broker, status, latencyMs, spreadQuality, liquidity, executionReadiness]) => ({ broker, status, latencyMs, spreadQuality, liquidity, executionReadiness })));

export const TIMELINE_EVENTS = Object.freeze([
  ["12:00:00", "Data quality gate passed", "Validation Engine", "INFO", "Stage 1 allowed"],
  ["11:59:42", "Prop firm rules validated", "Compliance Rules", "INFO", "Risk validation ready"],
  ["11:59:18", "Portfolio data synced", "Portfolio Ledger", "INFO", "Exposure model updated"],
  ["11:58:54", "Sentiment changed to Risk-On", "News Hub", "INFO", "AI confidence updated"],
  ["11:58:12", "High impact event detected", "Economic Calendar", "WARNING", "Risk controls armed"],
  ["11:57:39", "Broker spread feed refreshed", "Broker Gateway", "INFO", "Execution intelligence live"],
  ["11:57:03", "Economic calendar updated", "Calendar Service", "INFO", "Macro risk current"],
  ["11:56:45", "Market feed synchronized", "Market Feed", "INFO", "Scanner inputs ready"]
].map(([time, event, source, severity, workflowImpact]) => ({ time, event, source, severity, workflowImpact })));

export function getMarketIntelligenceDashboard() {
  const gate = evaluateDataQualityGate();
  return {
    status: "OPERATIONAL",
    proceedStatus: gate.proceedToStageOne ? "ALLOWED" : "BLOCKED",
    environment: "Production",
    lastUpdated: new Date().toISOString(),
    dataQualityScore: 98,
    criticalSources: { online: 7, total: 7 },
    optionalSources: { online: 2, total: 2 },
    feedFreshness: "LIVE",
    sentiment: { score: 62, mode: "Risk-On", risk: "Moderate", theme: "USD weakness / Gold strength" },
    brokerHealth: 97,
    portfolioSync: "Live",
    sources: DATA_SOURCES,
    economicEvents: ECONOMIC_EVENTS,
    newsSentiment: NEWS_SENTIMENT,
    brokerFeeds: BROKER_FEEDS,
    timeline: TIMELINE_EVENTS,
    gate
  };
}
