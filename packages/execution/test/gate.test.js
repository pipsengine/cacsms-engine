import assert from "node:assert/strict";
import test from "node:test";
import {
  EA_BRIDGE_COMMANDS,
  EA_BRIDGE_EVENTS,
  MACHINE_AGENT_CAPABILITIES,
  assertExecutionAuthorized,
  createExecutionCommand,
  getExecutionGateFailures
} from "../src/gate.js";

const completeApproval = {
  aiDecisionApproved: true,
  aiDebateApproved: true,
  strategyValidated: true,
  riskApproved: true,
  signedExecutionToken: true,
  auditLogCreated: true
};

test("lists every machine-agent responsibility", () => {
  assert.equal(MACHINE_AGENT_CAPABILITIES.length, 12);
  assert.ok(MACHINE_AGENT_CAPABILITIES.includes("recover_failed_terminals"));
});

test("lists every EA bridge command and outbound event", () => {
  assert.deepEqual(EA_BRIDGE_COMMANDS, ["open", "modify", "close", "partial_close", "move_sl_tp", "breakeven", "trailing_stop"]);
  assert.deepEqual(EA_BRIDGE_EVENTS, ["position_update", "account_update", "heartbeat", "execution_result"]);
});

test("blocks execution until all mandatory approvals exist", () => {
  assert.deepEqual(getExecutionGateFailures({}), [
    "AI Decision Approval", "AI Debate Approval", "Strategy Validation",
    "Risk Approval", "Signed Execution Token", "Audit Log Created"
  ]);
  assert.throws(() => assertExecutionAuthorized({ ...completeApproval, riskApproved: false }), /Risk Approval/);
  assert.equal(assertExecutionAuthorized(completeApproval), true);
});

test("creates only supported, signed EA bridge commands", () => {
  assert.deepEqual(createExecutionCommand({
    type: "open", correlationId: "EXEC-001", token: "signed-token", payload: { symbol: "XAUUSD" }
  }), { type: "open", correlationId: "EXEC-001", token: "signed-token", payload: { symbol: "XAUUSD" } });
  assert.throws(() => createExecutionCommand({ type: "launch", correlationId: "EXEC-002", token: "token" }), /Unsupported/);
  assert.throws(() => createExecutionCommand({ type: "close", correlationId: "EXEC-003" }), /signed execution token/);
});
