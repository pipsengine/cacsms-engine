import { getDataQualityGateDashboard } from "../../market-intelligence/src/data-quality-gate.js";

export const CARD_ONE_ACCEPTANCE_CHECKS = Object.freeze([
  ["card1-check-01", "Primary market feed is available", "Critical", "Reject workflow when real-time pricing is unavailable."],
  ["card1-check-02", "All required intelligence sources are online", "Critical", "Record degraded dependencies before Stage 2 handoff."],
  ["card1-check-03", "Aggregate source quality is at least 85%", "Critical", "Reject low-quality intelligence packages."],
  ["card1-check-04", "Economic calendar freshness is acceptable", "High", "Restrict trading mode when macro-event context is stale."],
  ["card1-check-05", "Optional intelligence feeds are monitored", "Advisory", "Reduce confidence without blocking the workflow."],
  ["card1-check-06", "Validated intelligence package is emitted", "Critical", "Create the source validation package required by Card 2."]
].map(([id, name, severity, policy]) => Object.freeze({ id, name, severity, policy })));

function evaluateChecks(gate, sources) {
  const marketData = sources.find(source => source.id === "market-data");
  const optionalHealthy = sources.filter(source => !source.required).every(source => ["ONLINE", "LIVE", "SYNCED", "SCHEDULED", "OPTIONAL"].includes(source.status));
  return [
    marketData && ["ONLINE", "LIVE", "SYNCED"].includes(marketData.status) ? "PASSED" : "FAILED",
    gate.requiredSourcesOnline ? "PASSED" : "WARNING",
    gate.dataQualityScore >= 85 ? "PASSED" : "FAILED",
    gate.tradingMode === "NORMAL" ? "PASSED" : "WARNING",
    optionalHealthy ? "PASSED" : "WARNING",
    gate.proceedToStageOne ? "PASSED" : "FAILED"
  ];
}

export function createCardOneTestReport(sources, timestamp = new Date().toISOString()) {
  if (!Array.isArray(sources)) throw new Error("Live source snapshots are required");
  const gate = getDataQualityGateDashboard(sources);
  const statuses = evaluateChecks(gate, sources);
  const checks = CARD_ONE_ACCEPTANCE_CHECKS.map((check, index) => ({ ...check, status: statuses[index] }));
  const rejected = !gate.proceedToStageOne || !gate.requiredSourcesOnline;
  const warning = !rejected && checks.some(check => check.status === "WARNING");
  const validatedIntelligencePackage = rejected ? null : {
    market_data: statuses[0] === "PASSED",
    news_sentiment: sourceHealthy(sources, "news-sentiment"),
    economic_calendar: sourceHealthy(sources, "economic-calendar"),
    social_sentiment: sourceHealthy(sources, "social-sentiment"),
    institutional_cot: sourceHealthy(sources, "institutional-cot-data"),
    historical_data: sourceHealthy(sources, "historical-data"),
    broker_data: sourceHealthy(sources, "broker-data"),
    portfolio_data: sourceHealthy(sources, "account-portfolio-data"),
    prop_firm_rules: sourceHealthy(sources, "prop-firm-rules"),
    quality_score: gate.dataQualityScore,
    status: warning ? "PASSED_WITH_WARNING" : "PASSED"
  };

  return {
    testRunId: `CARD1-${timestamp.replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`,
    cardNumber: 1,
    cardKey: "data-sources-validation",
    cardTitle: "Data Sources Validation",
    sourceMode: "LIVE_ADAPTERS_ONLY",
    executedAt: timestamp,
    status: rejected ? "REJECTED" : warning ? "PASSED_WITH_WARNING" : "PASSED",
    workflowPermission: rejected ? "STOP" : "CONTINUE",
    nextCard: rejected ? null : { cardNumber: 2, cardTitle: "Market Intelligence Gathering", status: "READY_FOR_TESTING" },
    inputPackage: "Live Source Adapter Snapshots",
    output: rejected ? null : "Validated Intelligence Package",
    outputPackage: validatedIntelligencePackage,
    acceptanceScore: Math.round(checks.filter(check => check.status === "PASSED").length / checks.length * 100),
    dataQualityScore: gate.dataQualityScore,
    requiredHealthyCount: gate.requiredHealthyCount,
    requiredSourceCount: gate.requiredSourceCount,
    optionalHealthyCount: gate.optionalHealthyCount,
    optionalSourceCount: gate.optionalSourceCount,
    warnings: gate.warnings,
    rejectReasons: gate.rejectReasons,
    checks,
    sources: gate.sources,
    audit: [
      ["Source inventory loaded", `${sources.length} source records evaluated`, "COMPLETED"],
      ["Quality gate executed", `${gate.dataQualityScore}% aggregate quality`, gate.validationStatus],
      ["Admission decision emitted", rejected ? "Workflow stopped before Card 2" : "Card 2 handoff package ready", rejected ? "REJECTED" : "COMPLETED"]
    ].map(([event, detail, status]) => ({ event, detail, status, timestamp }))
  };
}

function sourceHealthy(sources, id) {
  return ["ONLINE", "LIVE", "SYNCED", "SCHEDULED", "OPTIONAL"].includes(sources.find(source => source.id === id)?.status);
}
