export const WORKFLOW_STATUSES = Object.freeze([
  "pending", "running", "completed", "failed", "blocked", "retrying", "skipped", "escalated", "stopped"
]);

export const WORKFLOW_CARD_QUEUE = Object.freeze([
  ["data-sources-validation", "Data Sources Validation", "Live Source Adapter Snapshots", "Validated Intelligence Package"],
  ["market-intelligence", "Market Intelligence Gathering", "Validated Intelligence Package", "Market Intelligence Package"],
  ["asset-universe-scan", "20-Asset Universe Scan", "Market Intelligence Package", "Asset Opportunity Scores"],
  ["asset-ranking", "Asset Ranking & Pair Selection", "Asset Opportunity Scores", "Ranked Asset Selection"],
  ["market-analysis", "Market Analysis & Context Engine", "Ranked Asset Selection", "Market Context Package"],
  ["computer-vision", "Computer Vision & Chart Analysis", "Market Context Package", "Visual Confirmation Package"],
  ["ai-decision", "AI Decision Engine", "Visual Confirmation Package", "Trade Decision Proposal"],
  ["ai-debate", "AI Debate & Consensus Engine", "Trade Decision Proposal", "Consensus Decision Package"],
  ["strategy-selection", "Strategy Intelligence Center", "Consensus Decision Package", "Selected Strategy Package"],
  ["risk-validation", "Risk Intelligence & Capital Protection", "Selected Strategy Package", "Risk Approval Package"],
  ["execution-preparation", "Execution Preparation", "Risk Approval Package", "Signed Execution Package"],
  ["trade-execution", "Trade Execution & Order Management", "Signed Execution Package", "Execution Result"],
  ["position-management", "Position Management", "Execution Result", "Managed Position State"],
  ["learning-engine", "Post-Trade Analytics & Learning", "Managed Position State", "Learning Record"]
].map(([key, title, inputPackage, outputPackage], index, cards) => Object.freeze({
  cardNumber: index + 1, key, title, inputPackage, outputPackage,
  nextCard: cards[index + 1]?.[1] || "Workflow Complete",
  status: index === 0 ? "READY_FOR_TESTING" : "LOCKED",
  acceptanceScore: null, dataQualityScore: null, workflowPermission: index === 0 ? "TEST_REQUIRED" : "LOCKED"
})));

export const WORKFLOW_STAGES = Object.freeze(WORKFLOW_CARD_QUEUE.map(({ key, title }, index) => Object.freeze({ key, name: title, order: index + 1 })));

const allowedTransitions = Object.freeze({
  pending: new Set(["running", "skipped", "blocked", "stopped"]),
  running: new Set(["completed", "failed", "blocked", "escalated", "stopped"]),
  failed: new Set(["retrying", "escalated", "stopped"]),
  blocked: new Set(["running", "escalated", "skipped", "stopped"]),
  retrying: new Set(["running", "failed", "escalated", "stopped"]),
  escalated: new Set(["running", "failed", "skipped", "stopped"]),
  completed: new Set(),
  skipped: new Set(),
  stopped: new Set()
});

export function canTransition(from, to) {
  assertStatus(from);
  assertStatus(to);
  return allowedTransitions[from].has(to);
}

export function transition(stage, status, timestamp = new Date().toISOString()) {
  if (!canTransition(stage.status, status)) {
    throw new Error(`Illegal workflow transition: ${stage.status} -> ${status}`);
  }

  return {
    ...stage,
    status,
    attempt: status === "running" ? stage.attempt + 1 : stage.attempt,
    startedAt: status === "running" ? timestamp : stage.startedAt,
    completedAt: ["completed", "skipped", "stopped"].includes(status) ? timestamp : undefined
  };
}

export function createWorkflowRun(runKey, context = {}) {
  if (!runKey || typeof runKey !== "string") throw new Error("runKey is required");
  return {
    runKey,
    status: "pending",
    currentStage: 1,
    selectedAssets: [],
    top10Assets: [],
    top5Assets: [],
    top3Assets: [],
    executionCandidates: [],
    finalTrades: [],
    errorCount: 0,
    retryCount: 0,
    context,
    stages: WORKFLOW_STAGES.map((stage) => ({ ...stage, status: "pending", attempt: 0 }))
  };
}

export function nextPendingStage(run) {
  const unfinished = run.stages.find((stage) => !["completed", "skipped"].includes(stage.status));
  return unfinished?.status === "pending" ? unfinished : undefined;
}

export function assertRiskApproval(assessment) {
  if (assessment?.approved !== true) {
    throw new Error("Risk Engine veto: rejected trades cannot proceed to execution");
  }
  return true;
}

function assertStatus(status) {
  if (!WORKFLOW_STATUSES.includes(status)) throw new Error(`Unknown workflow status: ${status}`);
}
