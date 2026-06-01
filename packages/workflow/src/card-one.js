import { DATA_SOURCES } from "../../market-intelligence/src/data-sources.js";
import { getDataQualityGateDashboard } from "../../market-intelligence/src/data-quality-gate.js";

export const CARD_ONE_SCENARIOS = Object.freeze({
  pass: "Production baseline",
  warning: "Economic calendar stale",
  reject: "Primary market feed failed",
  missing: "Critical market feed missing"
});

export const CARD_ONE_ACCEPTANCE_CHECKS = Object.freeze([
  ["card1-check-01", "Primary market feed is available", "Critical", "Reject workflow when real-time pricing is unavailable."],
  ["card1-check-02", "All required intelligence sources are online", "Critical", "Record degraded dependencies before Stage 2 handoff."],
  ["card1-check-03", "Aggregate source quality is at least 85%", "Critical", "Reject low-quality intelligence packages."],
  ["card1-check-04", "Economic calendar freshness is acceptable", "High", "Restrict trading mode when macro-event context is stale."],
  ["card1-check-05", "Optional intelligence feeds are monitored", "Advisory", "Reduce confidence without blocking the workflow."],
  ["card1-check-06", "Market Intelligence package is emitted", "Critical", "Create the normalized Stage 1 output package for Stage 2."]
].map(([id, name, severity, policy]) => Object.freeze({ id, name, severity, policy })));

function sourcesForScenario(scenario) {
  if (scenario === "warning") return DATA_SOURCES.map(source => source.id === "economic-calendar" ? { ...source, status: "STALE" } : source);
  if (scenario === "reject") return DATA_SOURCES.map(source => source.id === "market-data" ? { ...source, status: "FAILED", healthScore: 42, errorCount: 3 } : source);
  if (scenario === "missing") return DATA_SOURCES.filter(source => source.id !== "market-data");
  return DATA_SOURCES;
}

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

export function createCardOneTestReport(scenario = "pass", timestamp = new Date().toISOString()) {
  if (!CARD_ONE_SCENARIOS[scenario]) throw new Error(`Unknown Card 1 test scenario: ${scenario}`);
  const sources = sourcesForScenario(scenario);
  const gate = getDataQualityGateDashboard(sources);
  const statuses = evaluateChecks(gate, sources);
  const checks = CARD_ONE_ACCEPTANCE_CHECKS.map((check, index) => ({ ...check, status: statuses[index] }));
  const rejected = !gate.proceedToStageOne;
  const warning = !rejected && checks.some(check => check.status === "WARNING");

  return {
    testRunId: `CARD1-${timestamp.replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`,
    cardNumber: 1,
    cardKey: "market-intelligence-gathering",
    cardTitle: "Market Intelligence Gathering",
    scenario,
    scenarioLabel: CARD_ONE_SCENARIOS[scenario],
    executedAt: timestamp,
    status: rejected ? "REJECTED" : warning ? "PASSED_WITH_WARNING" : "PASSED",
    workflowPermission: rejected ? "STOP" : "CONTINUE",
    nextCard: rejected ? null : { cardNumber: 2, cardTitle: "20-Asset Universe Scanner", status: "READY_FOR_TESTING" },
    output: rejected ? null : "Market Intelligence Package",
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

