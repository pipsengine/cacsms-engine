import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PROP_FIRM_BREACH_ALERTS, PROP_FIRM_COMPARISON, PROP_FIRM_COMPLIANCE_ACCOUNTS, PROP_FIRM_RULES, getPropFirmRulesDashboard } from "../src/prop-firm-rules.js";

test("terminal prop firm rules dashboard renders the complete compliance center", () => {
  const page=readFileSync("apps/web/prop-firm-rules-page.js","utf8");
  for(const section of ["Filter Panel","Prop Firm Rules Table","Rule Comparison Matrix","Account Compliance Monitor","Breach Risk Panel","Empty, Loading & Error States","Prop Firm Rules Action Center"]) assert.match(page,new RegExp(section.replace(/[&]/g,"\\$&")));
  for(const alert of ["Daily loss close to limit","Max drawdown close to limit","Over-leverage warning","News trading restriction","Weekend holding warning","Consistency rule warning","Inactivity risk","Minimum trading day gap"]) assert.match(page,new RegExp(alert));
  assert.match(page,/data-pf-firm/);
  assert.match(page,/pf-drawer/);
});

test("prop firm rules package exposes rules comparison compliance alerts and summary", () => {
  const dashboard=getPropFirmRulesDashboard();
  assert.equal(PROP_FIRM_RULES.length,4);
  assert.equal(PROP_FIRM_COMPARISON.length,4);
  assert.equal(PROP_FIRM_COMPLIANCE_ACCOUNTS.length,3);
  assert.equal(PROP_FIRM_BREACH_ALERTS.length,6);
  assert.equal(dashboard.summary.accountsNearBreach,1);
  assert.equal(dashboard.summary.breachedAccounts,0);
});

test("prop firm rules API exposes catalog comparison compliance risk import sync create and export routes", () => {
  const api=readFileSync("apps/api/src/server.mjs","utf8");
  for(const route of ["/api/market-intelligence/prop-firm-rules","/api/market-intelligence/prop-firm-rules/comparison","/api/market-intelligence/prop-firm-rules/compliance","/api/market-intelligence/prop-firm-rules/breach-risk","/api/market-intelligence/prop-firm-rules/import","/api/market-intelligence/prop-firm-rules/sync","/api/market-intelligence/prop-firm-rules/export"]) assert.match(api,new RegExp(route.replaceAll("/","\\/")));
});

test("prop firm rules migration defines normalized tables indexes and permissions", () => {
  const sql=readFileSync("database/migrations/013_prop_firm_rules.sql","utf8");
  for(const table of ["prop_firms","prop_firm_rules","prop_firm_account_rules","prop_firm_compliance_accounts","prop_firm_breach_alerts","prop_firm_payout_policies","prop_firm_sync_logs"]) assert.match(sql,new RegExp(`market\\.${table}`));
  for(const permission of ["view","create","import","sync","export","monitor_compliance"]) assert.match(sql,new RegExp(`market_intelligence\\.prop_firm_rules\\.${permission}`));
  assert.match(sql,/idx_prop_compliance_risk/);
});
