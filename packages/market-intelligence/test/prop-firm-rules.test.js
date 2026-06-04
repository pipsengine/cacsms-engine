import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  computeComplianceFromAccount,
  computeBreachAlerts,
  validatePropFirmInput,
  getPropFirmRulesDashboard
} from "../src/prop-firm-rules.js";

test("prop firm rules page has no hardcoded demo firm rows", () => {
  const page = readFileSync("apps/web/prop-firm-rules-page.js", "utf8");
  for (const firm of ["FTMO", "FundedNext", "The5ers", "E8 Markets", "Funding Pips", "PROP-FTMO"]) {
    assert.doesNotMatch(page, new RegExp(firm));
  }
  assert.match(page, /Production Live/);
  assert.match(page, /No prop firm rules configured yet/);
  assert.match(page, /data-pf-action/);
});

test("validatePropFirmInput enforces production rule constraints", () => {
  const bad = validatePropFirmInput({
    firmName: "",
    dailyLossLimitPercent: 8,
    maxDrawdownPercent: 5,
    payoutSplitPercent: 120,
    minTradingDays: 10,
    maxTradingDays: 5,
    phase: "Invalid"
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.includes("firm_name_required"));
  assert.ok(bad.errors.includes("daily_loss_cannot_exceed_max_drawdown"));
  assert.ok(bad.errors.includes("payout_split_out_of_range"));
  assert.ok(bad.errors.includes("min_trading_days_exceeds_max"));
  assert.ok(bad.errors.includes("invalid_phase"));

  const good = validatePropFirmInput({
    firmName: "Acme Funding",
    programName: "100K Challenge",
    accountSize: 100000,
    profitTargetPercent: 10,
    dailyLossLimitPercent: 5,
    maxDrawdownPercent: 10,
    payoutSplitPercent: 80,
    phase: "Phase 1"
  });
  assert.equal(good.valid, true);
});

test("compliance and breach risk require account and rule data", () => {
  const incomplete = computeComplianceFromAccount({ balance: 1000, equity: 990 }, null);
  assert.equal(incomplete.computable, false);

  const computed = computeComplianceFromAccount(
    { balance: 100000, equity: 97000, dailyDrawdownPercent: 3 },
    { dailyLossLimitPercent: 5, maxDrawdownPercent: 10, profitTargetPercent: 10, accountSize: 100000 }
  );
  assert.equal(computed.computable, true);
  assert.ok(computed.dailyLossUsedPercent > 0);

  const alerts = computeBreachAlerts(
    [{ computable: true, dailyLossUsedPercent: 88, maxDrawdownUsedPercent: 40, accountName: "LIVE-1", propFirmRuleId: "r1" }],
    { r1: { dailyLossLimitPercent: 5, maxDrawdownPercent: 10 } }
  );
  assert.ok(alerts.some((a) => a.severity === "High"));
});

test("prop firm rules dashboard exposes production meta without mock arrays", async () => {
  const dashboard = await getPropFirmRulesDashboard();
  assert.equal(dashboard.meta.mockData, false);
  assert.equal(dashboard.meta.dataMode, "Production Live");
  assert.ok(Array.isArray(dashboard.rules));
  assert.ok(Array.isArray(dashboard.comparison));
  assert.ok(Array.isArray(dashboard.compliance));
});

test("prop firm rules API exposes production routes", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of [
    "/api/market-intelligence/prop-firm-rules",
    "/api/market-intelligence/prop-firm-rules/summary",
    "/api/market-intelligence/prop-firm-rules/compliance",
    "/api/market-intelligence/prop-firm-rules/breach-alerts",
    "/api/market-intelligence/prop-firm-rules/sources",
    "/api/market-intelligence/prop-firm-rules/import",
    "/api/market-intelligence/prop-firm-rules/sync",
    "/api/market-intelligence/prop-firm-rules/audit-logs",
    "getPropFirmRulesDashboard"
  ]) {
    assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
  }
});

test("prop firm rules migrations define production tables", () => {
  const sql = [
    readFileSync("database/migrations/013_prop_firm_rules.sql", "utf8"),
    readFileSync("database/migrations/029_prop_firm_rules_production.sql", "utf8")
  ].join("\n");
  for (const table of [
    "prop_firms",
    "prop_firm_rules",
    "prop_firm_accounts",
    "prop_firm_rule_categories",
    "prop_firm_compliance_status",
    "prop_firm_breach_alerts",
    "prop_firm_payout_policies",
    "prop_firm_scaling_plans",
    "prop_firm_source_configs",
    "prop_firm_sync_logs",
    "prop_firm_audit_logs"
  ]) {
    assert.match(sql, new RegExp(`market\\.${table}`));
  }
  for (const permission of ["view", "create", "import", "sync", "export", "monitor_compliance", "update", "delete", "approve"]) {
    assert.match(sql, new RegExp(`market_intelligence\\.prop_firm_rules\\.${permission}`));
  }
});
