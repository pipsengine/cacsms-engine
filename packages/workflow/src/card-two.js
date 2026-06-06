export const CARD_TWO_ACCEPTANCE_CHECKS = Object.freeze([
  ["card2-check-01", "Validated intelligence package received", "Critical", "Reject Card 2 when Card 1 has not handed off a validated package."],
  ["card2-check-02", "All required intelligence sources available", "Critical", "Reject when required validated sources are missing or unhealthy."],
  ["card2-check-03", "Market Intelligence Score above 80", "Critical", "Reject low-confidence intelligence packages before asset scanning."],
  ["card2-check-04", "Confidence Score above 85", "High", "Reduce readiness without blocking when confidence is degraded."],
  ["card2-check-05", "Data freshness acceptable", "High", "Restrict trading mode when intelligence freshness is stale."],
  ["card2-check-06", "Macro context available", "High", "Record missing macro context before Stage 3 handoff."],
  ["card2-check-07", "Institutional context available", "High", "Record missing institutional positioning before Stage 3 handoff."],
  ["card2-check-08", "Sentiment context available", "High", "Record missing sentiment context before Stage 3 handoff."],
  ["card2-check-09", "Market Intelligence Package generated", "Critical", "Create the output package required by Card 3."]
].map(([id, name, severity, policy]) => Object.freeze({ id, name, severity, policy })));

const CHECK_IDS = {
  required_sources: "card2-check-02",
  market_score: "card2-check-03",
  confidence: "card2-check-04",
  freshness: "card2-check-05",
  macro: "card2-check-06",
  institutional: "card2-check-07",
  sentiment: "card2-check-08",
  output: "card2-check-09"
};

function mapAcceptanceStatus(status) {
  if (status === "PASS") return "PASSED";
  if (status === "FAIL") return "FAILED";
  return "WARNING";
}

export function createCardTwoTestReport(dashboard, timestamp = new Date().toISOString()) {
  if (!dashboard || typeof dashboard !== "object") throw new Error("Card 2 dashboard payload is required");

  const acceptance = Array.isArray(dashboard.acceptance) ? dashboard.acceptance : [];
  const acceptanceById = Object.fromEntries(acceptance.map(item => [item.id, item.status]));
  const inputReceived = ["RECEIVED", "READY", "PASSED"].includes(String(dashboard.inputPackage?.status || "").toUpperCase());
  const checks = CARD_TWO_ACCEPTANCE_CHECKS.map(check => {
    if (check.id === "card2-check-01") {
      return { ...check, status: inputReceived ? "PASSED" : "FAILED" };
    }
    const mapped = mapAcceptanceStatus(acceptanceById[Object.entries(CHECK_IDS).find(([, value]) => value === check.id)?.[0]]);
    return { ...check, status: mapped || "WARNING" };
  });

  const outputFailed = ["FAILED", "REJECTED"].includes(String(dashboard.outputPackage?.status || "").toUpperCase());
  const failed = outputFailed || checks.some(check => check.severity === "Critical" && check.status === "FAILED");
  const warning = !failed && (checks.some(check => check.status === "WARNING") || String(dashboard.outputPackage?.status || "").toUpperCase() === "PASSED_WITH_WARNING");
  const scores = Array.isArray(dashboard.scores) ? dashboard.scores : [];
  const scoreByKey = Object.fromEntries(scores.map(score => [score.key, score.value]));
  const passedChecks = checks.filter(check => check.status === "PASSED").length;
  const marketScore = scoreByKey.market_intelligence ?? scoreByKey.readiness ?? null;
  const confidenceScore = scoreByKey.confidence ?? null;

  return {
    testRunId: `CARD2-${timestamp.replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`,
    cardNumber: 2,
    cardKey: "market-intelligence-gathering",
    cardTitle: "Market Intelligence Gathering",
    sourceMode: dashboard.sourceMode || "DATABASE_ONLY",
    executedAt: timestamp,
    status: failed ? "REJECTED" : warning ? "PASSED_WITH_WARNING" : "PASSED",
    workflowPermission: failed ? "STOP" : "CONTINUE",
    nextCard: failed ? null : { cardNumber: 3, cardTitle: "20-Asset Universe Scanner", status: "READY_FOR_TESTING" },
    inputPackage: dashboard.inputPackage?.id || "Validated Intelligence Package",
    output: failed ? null : "Market Intelligence Package",
    outputPackage: dashboard.outputPackage ? {
      packageId: dashboard.outputPackage.packageId,
      status: dashboard.outputPackage.status,
      confidence: dashboard.outputPackage.confidence,
      generatedAt: dashboard.outputPackage.generatedAt,
      version: dashboard.outputPackage.version
    } : null,
    acceptanceScore: Math.round(passedChecks / checks.length * 100),
    dataQualityScore: marketScore ?? confidenceScore ?? 0,
    intelligenceConfidenceScore: confidenceScore,
    marketIntelligenceScore: marketScore,
    modulesCompleted: dashboard.kpis?.find(([label]) => label === "Intelligence Modules Completed")?.[1] || "0/8",
    outputPackageStatus: dashboard.outputPackage?.status || "PENDING",
    workflowState: dashboard.workflow?.currentState || "WAITING_FOR_INPUT",
    checks,
    acceptance,
    scores,
    pipeline: dashboard.pipeline || [],
    audit: [
      ["Input package loaded", dashboard.inputPackage?.id || "No package", inputReceived ? "COMPLETED" : "FAILED"],
      ["Intelligence modules evaluated", dashboard.kpis?.find(([label]) => label === "Intelligence Modules Completed")?.[1] || "0/8", failed ? "REJECTED" : "COMPLETED"],
      ["Output package assessed", dashboard.outputPackage?.packageId || "Not generated", dashboard.outputPackage ? "COMPLETED" : "FAILED"],
      ["Admission decision emitted", failed ? "Workflow stopped before Card 3" : "Card 3 handoff package ready", failed ? "REJECTED" : "COMPLETED"]
    ].map(([event, detail, status]) => ({ event, detail, status, timestamp }))
  };
}
