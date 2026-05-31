export const WORKFLOW_STATUSES = Object.freeze([
  "pending", "running", "completed", "failed", "blocked", "retrying", "skipped", "escalated", "stopped"
]);

export const WORKFLOW_STAGES = Object.freeze([
  ["market-intelligence", "Market Intelligence Gathering"],
  ["asset-universe-scan", "20-Asset Universe Scan"],
  ["asset-ranking", "Asset Ranking & Pair Selection"],
  ["market-analysis", "Market Analysis & Context Engine"],
  ["computer-vision", "Computer Vision & Chart Analysis"],
  ["ai-decision", "AI Decision Engine"],
  ["ai-debate", "AI Debate & Consensus Engine"],
  ["strategy-selection", "Strategy Intelligence Center"],
  ["risk-validation", "Risk Intelligence & Capital Protection"],
  ["execution-preparation", "Execution Preparation"],
  ["trade-execution", "Trade Execution & Order Management"],
  ["position-management", "Position Management Engine"],
  ["exit-management", "Exit Management Engine"],
  ["learning-engine", "Post-Trade Analytics & Learning"]
].map(([key, name], index) => Object.freeze({ key, name, order: index + 1 })));

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
