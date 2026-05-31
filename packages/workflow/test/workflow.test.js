import assert from "node:assert/strict";
import test from "node:test";
import { WORKFLOW_STAGES, WORKFLOW_STATUSES, assertRiskApproval, canTransition, createWorkflowRun, nextPendingStage, transition } from "../src/index.js";
import { ASSET_SCORES, ASSET_UNIVERSE, MOCK_WORKFLOW, WORKFLOW_EVENTS } from "../src/mock-data.js";

test("defines the complete 14-stage orchestration pipeline in order", () => {
  assert.equal(WORKFLOW_STAGES.length, 14);
  assert.equal(WORKFLOW_STAGES[0].name, "Market Intelligence Gathering");
  assert.equal(WORKFLOW_STAGES[13].name, "Post-Trade Analytics & Learning");
  assert.deepEqual(WORKFLOW_STAGES.map(({ order }) => order), Array.from({ length: 14 }, (_, index) => index + 1));
});

test("defines every supported workflow status", () => {
  assert.deepEqual(WORKFLOW_STATUSES, ["pending", "running", "completed", "failed", "blocked", "retrying", "skipped", "escalated", "stopped"]);
});

test("supports an operator stop terminal state", () => {
  const stopped = transition({ status: "running", attempt: 1 }, "stopped", "2026-05-31T12:02:00.000Z");
  assert.equal(stopped.status, "stopped");
  assert.equal(stopped.completedAt, "2026-05-31T12:02:00.000Z");
});

test("enforces the risk engine absolute veto", () => {
  assert.equal(assertRiskApproval({ approved: true }), true);
  assert.throws(() => assertRiskApproval({ approved: false }), /Risk Engine veto/);
});

test("provides the production-shaped scanner funnel and event catalog", () => {
  assert.equal(ASSET_UNIVERSE.length, 20);
  assert.equal(ASSET_SCORES.length, 10);
  assert.equal(MOCK_WORKFLOW.top5Assets.length, 5);
  assert.equal(MOCK_WORKFLOW.top3Assets.length, 3);
  assert.deepEqual(MOCK_WORKFLOW.executionCandidates, ["XAUUSD", "EURUSD"]);
  assert.equal(WORKFLOW_EVENTS.length, 13);
});

test("creates a run and advances a pending stage", () => {
  const run = createWorkflowRun("WF-001", { source: "test" });
  const first = nextPendingStage(run);
  const active = transition(first, "running", "2026-05-31T12:00:00.000Z");
  const completed = transition(active, "completed", "2026-05-31T12:01:00.000Z");
  assert.equal(completed.status, "completed");
  assert.equal(completed.attempt, 1);
  assert.equal(completed.completedAt, "2026-05-31T12:01:00.000Z");
});

test("prevents illegal transitions", () => {
  assert.equal(canTransition("failed", "retrying"), true);
  assert.equal(canTransition("completed", "running"), false);
  assert.throws(() => transition({ status: "completed", attempt: 1 }, "running"), /Illegal workflow transition/);
});
