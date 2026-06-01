import { DATA_SOURCES, evaluateDataQualityGate, HEALTHY_STATUSES } from "./data-sources.js";

export const DATA_QUALITY_GATE_RULES = Object.freeze([
  ["dq-rule-01", "Market data feed available", "Critical", "market-data", "Stage 1 cannot proceed without an active pricing feed."],
  ["dq-rule-02", "Minimum aggregate quality score", "Critical", "all-sources", "Aggregate quality must remain at or above 85%."],
  ["dq-rule-03", "Economic calendar current", "High", "economic-calendar", "A stale calendar places the engine in restricted trading mode."],
  ["dq-rule-04", "Broker feed available", "High", "broker-data", "Execution-related stages require a healthy broker feed."],
  ["dq-rule-05", "Portfolio ledger available", "High", "account-portfolio-data", "Risk validation requires account and portfolio state."],
  ["dq-rule-06", "Prop firm rules available", "High", "prop-firm-rules", "Prop account risk validation requires current compliance rules."],
  ["dq-rule-07", "Historical store available", "Medium", "historical-data", "Historical comparison is disabled when archived candles are unavailable."],
  ["dq-rule-08", "Optional sentiment feeds monitored", "Advisory", "optional-sources", "Missing optional feeds reduce confidence without blocking Stage 1."]
].map(([id, name, severity, sourceId, description]) => Object.freeze({ id, name, severity, sourceId, description })));

export const DATA_QUALITY_GATE_EVENTS = Object.freeze([
  ["DQG-20260601-004", "2026-06-01T08:32:18.000Z", "Scheduled validation", "PASSED", 98, "system.scheduler", "All required sources validated."],
  ["DQG-20260601-003", "2026-06-01T08:00:00.000Z", "Source refresh", "PASSED", 98, "system.scheduler", "Broker and portfolio ledgers refreshed."],
  ["DQG-20260531-002", "2026-05-31T12:04:21.000Z", "Manual validation", "WARNING", 96, "risk.operator", "Institutional COT feed awaiting weekly refresh."],
  ["DQG-20260531-001", "2026-05-31T08:30:00.000Z", "Scheduled validation", "PASSED", 97, "system.scheduler", "Stage 1 permission issued."]
].map(([id, timestamp, trigger, status, score, actor, note]) => Object.freeze({ id, timestamp, trigger, status, score, actor, note })));

export const DATA_QUALITY_WORKFLOW_IMPACTS = Object.freeze([
  ["Stage 1", "Market Intelligence", "ALLOWED", "Validated sources may enter market intelligence gathering."],
  ["Stage 3", "Asset Ranking", "READY", "Source quality score acts as a ranking confidence modifier."],
  ["Stage 4", "Context Engine", "READY", "Freshness and calendar checks constrain market context."],
  ["Stage 6", "AI Decision", "READY", "The decision engine receives quality warnings and restrictions."],
  ["Stage 7", "AI Debate", "READY", "Agents can challenge decisions using source-level diagnostics."],
  ["Stage 9", "Risk Validation", "READY", "Broker, portfolio and prop firm readiness protect execution."]
].map(([stage, name, status, description]) => Object.freeze({ stage, name, status, description })));

function classifyFreshness(source) {
  if (source.status === "STALE") return "STALE";
  if (source.status === "SCHEDULED") return "SCHEDULED";
  if (source.freshnessSeconds <= 60) return "LIVE";
  if (source.freshnessSeconds <= 900) return "CURRENT";
  return "ARCHIVED";
}

function evaluateRule(rule, sources, gate) {
  if (rule.sourceId === "all-sources") {
    return gate.dataQualityScore >= 85 ? "PASSED" : "FAILED";
  }
  if (rule.sourceId === "optional-sources") {
    return sources.filter((source) => !source.required).every((source) => HEALTHY_STATUSES.has(source.status)) ? "PASSED" : "WARNING";
  }
  const source = sources.find((item) => item.id === rule.sourceId);
  if (!source || !HEALTHY_STATUSES.has(source.status)) return rule.severity === "Critical" ? "FAILED" : "WARNING";
  return "PASSED";
}

export function getDataQualityGateDashboard(sources = DATA_SOURCES) {
  const gate = evaluateDataQualityGate(sources);
  const sourceSnapshots = sources.map((source) => ({
    ...source,
    freshness: classifyFreshness(source),
    validation: HEALTHY_STATUSES.has(source.status) ? "PASSED" : source.required ? "FAILED" : "WARNING"
  }));
  const rules = DATA_QUALITY_GATE_RULES.map((rule) => ({ ...rule, status: evaluateRule(rule, sources, gate) }));
  const requiredSources = sources.filter((source) => source.required);
  const optionalSources = sources.filter((source) => !source.required);

  return {
    ...gate,
    gateStatus: gate.proceedToStageOne ? (gate.warnings.length ? "WARNING" : "PASSED") : "BLOCKED",
    workflowPermission: gate.proceedToStageOne ? "ALLOWED" : "RESTRICTED",
    lastValidatedAt: "2026-06-01T08:32:18.000Z",
    nextValidationAt: "2026-06-01T08:37:18.000Z",
    requiredSourceCount: requiredSources.length,
    requiredHealthyCount: requiredSources.filter((source) => HEALTHY_STATUSES.has(source.status)).length,
    optionalSourceCount: optionalSources.length,
    optionalHealthyCount: optionalSources.filter((source) => HEALTHY_STATUSES.has(source.status)).length,
    blockingIssues: gate.rejectReasons.length,
    warningCount: gate.warnings.length,
    sources: sourceSnapshots,
    rules,
    events: DATA_QUALITY_GATE_EVENTS,
    workflowImpacts: DATA_QUALITY_WORKFLOW_IMPACTS
  };
}

