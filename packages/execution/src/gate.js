export const MACHINE_AGENT_CAPABILITIES = Object.freeze([
  "register_machine",
  "send_heartbeat",
  "discover_mt5_terminals",
  "launch_mt5",
  "restart_mt5",
  "deploy_ea",
  "update_ea",
  "capture_screenshots",
  "monitor_resources",
  "forward_execution_commands",
  "report_broker_account_health",
  "recover_failed_terminals"
]);

export const EA_BRIDGE_COMMANDS = Object.freeze([
  "open",
  "modify",
  "close",
  "partial_close",
  "move_sl_tp",
  "breakeven",
  "trailing_stop"
]);

export const EA_BRIDGE_EVENTS = Object.freeze([
  "position_update",
  "account_update",
  "heartbeat",
  "execution_result"
]);

const requiredExecutionApprovals = Object.freeze([
  ["aiDecisionApproved", "AI Decision Approval"],
  ["aiDebateApproved", "AI Debate Approval"],
  ["strategyValidated", "Strategy Validation"],
  ["riskApproved", "Risk Approval"],
  ["signedExecutionToken", "Signed Execution Token"],
  ["auditLogCreated", "Audit Log Created"]
]);

export function getExecutionGateFailures(context) {
  return requiredExecutionApprovals
    .filter(([key]) => context?.[key] !== true)
    .map(([, label]) => label);
}

export function assertExecutionAuthorized(context) {
  const failures = getExecutionGateFailures(context);
  if (failures.length) {
    throw new Error(`Execution blocked: missing ${failures.join(", ")}`);
  }
  return true;
}

export function createExecutionCommand({ type, correlationId, token, payload = {} }) {
  if (!EA_BRIDGE_COMMANDS.includes(type)) throw new Error(`Unsupported EA bridge command: ${type}`);
  if (!correlationId) throw new Error("correlationId is required");
  if (!token) throw new Error("signed execution token is required");
  return Object.freeze({ type, correlationId, token, payload });
}
