import assert from "node:assert/strict";
import test from "node:test";
import { DATA_SOURCES } from "../src/data-sources.js";
import { DATA_QUALITY_GATE_RULES, getDataQualityGateDashboard } from "../src/data-quality-gate.js";

const withStatus = (id, status) => DATA_SOURCES.map((source) => source.id === id ? { ...source, status } : source);

test("returns a production data quality gate dashboard", () => {
  const dashboard = getDataQualityGateDashboard();
  assert.equal(dashboard.gateStatus, "PASSED");
  assert.equal(dashboard.workflowPermission, "ALLOWED");
  assert.equal(dashboard.sources.length, 9);
  assert.equal(dashboard.rules.length, DATA_QUALITY_GATE_RULES.length);
});
test("blocks permission when primary market data fails", () => {
  const dashboard = getDataQualityGateDashboard(withStatus("market-data", "FAILED"));
  assert.equal(dashboard.gateStatus, "BLOCKED");
  assert.equal(dashboard.workflowPermission, "RESTRICTED");
  assert.ok(dashboard.blockingIssues > 0);
});
test("converts stale calendar data into a visible warning", () => {
  const dashboard = getDataQualityGateDashboard(withStatus("economic-calendar", "STALE"));
  assert.equal(dashboard.tradingMode, "RESTRICTED");
  assert.equal(dashboard.rules.find((rule) => rule.sourceId === "economic-calendar").status, "WARNING");
});
