import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLiveFeedDiagnostics,
  buildOnboardingView,
  evaluateMt5WorkflowReadiness
} from "../src/mt5-infrastructure.js";

test("onboarding view includes nine lifecycle steps", () => {
  const steps = buildOnboardingView({ provider_registered: "completed" });
  assert.equal(steps.length, 9);
  assert.equal(steps[0].status, "completed");
  assert.equal(steps[1].status, "pending");
});

test("workflow readiness stops when no terminal is registered", () => {
  const readiness = evaluateMt5WorkflowReadiness({ terminals: [], providers: [{ status: "NOT_CONFIGURED" }], liveSymbols: 0 });
  assert.equal(readiness.permission, "STOP");
  assert.equal(readiness.reason, "No Terminal");
});

test("workflow readiness allows when terminal is active with coverage", () => {
  const readiness = evaluateMt5WorkflowReadiness({
    terminals: [{ connectionStatus: "ONLINE", eaStatus: "CONNECTED", lastHeartbeatAgeSec: 5 }],
    providers: [{ status: "ACTIVE" }],
    liveSymbols: 18,
    symbolCount: 20,
    avgLatency: 12
  });
  assert.equal(readiness.permission, "ALLOWED");
});

test("live feed diagnostics explain blocked workflow for disconnected terminal", () => {
  const diagnostics = buildLiveFeedDiagnostics(
    { status: "DELAYED" },
    { permission: "STOP", reason: "No EA", message: "Install CACSMS EA" }
  );
  assert.equal(diagnostics.workflowImpact, "BLOCKED");
  assert.match(diagnostics.expectedAction, /EA/i);
});
