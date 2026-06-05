import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("packages/market-intelligence/src/macro-intelligence.js", "utf8");
const page = readFileSync("apps/web/live-market-intelligence-page.js", "utf8");
const api = readFileSync("apps/api/src/server.mjs", "utf8");
const migration = readFileSync("database/migrations/035_macro_intelligence.sql", "utf8");

test("Macro Intelligence service reads the requested production tables", () => {
  for (const table of [
    "market.macro_intelligence_scores",
    "market.macro_data_inputs",
    "market.currency_macro_bias",
    "market.central_bank_policy_states",
    "market.inflation_growth_metrics",
    "market.yield_rate_metrics",
    "market.cross_asset_macro_impacts",
    "market.macro_regime_history",
    "market.macro_ai_summaries",
    "market.macro_alerts",
    "market.macro_audit_logs"
  ]) assert.match(service, new RegExp(table.replace(".", "\\.")));
  assert.match(service, /MacroIntelligenceEngine/);
  assert.doesNotMatch(service, /MOCK_|demo macro|sample macro|placeholder row/i);
});

test("Macro Intelligence migration creates dashboard storage tables", () => {
  for (const table of [
    "macro_intelligence_scores",
    "macro_data_inputs",
    "currency_macro_bias",
    "central_bank_policy_states",
    "inflation_growth_metrics",
    "yield_rate_metrics",
    "cross_asset_macro_impacts",
    "macro_regime_history",
    "macro_ai_summaries",
    "macro_alerts",
    "macro_audit_logs"
  ]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS market\\.${table}`));
});

test("API exposes Macro Intelligence routes and actions", () => {
  for (const route of [
    "/api/market-intelligence/macro-intelligence",
    "/api/market-intelligence/macro-intelligence/summary",
    "/api/market-intelligence/macro-intelligence/inputs",
    "/api/market-intelligence/macro-intelligence/currency-bias",
    "/api/market-intelligence/macro-intelligence/central-banks",
    "/api/market-intelligence/macro-intelligence/inflation-growth",
    "/api/market-intelligence/macro-intelligence/yields-rates",
    "/api/market-intelligence/macro-intelligence/cross-asset",
    "/api/market-intelligence/macro-intelligence/regime-timeline",
    "/api/market-intelligence/macro-intelligence/export"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(api, /runMacroIntelligenceAction\(action/);
});

test("Macro Intelligence page renders requested production sections", () => {
  for (const text of [
    "Macro Intelligence Center",
    "Refresh Macro Data",
    "Sync Macro Sources",
    "Recalculate Macro Bias",
    "Configure Sources",
    "Export Macro Report",
    "MACRO DATA INPUTS PANEL",
    "MACRO BIAS ENGINE",
    "CURRENCY MACRO BIAS TABLE",
    "CENTRAL BANK INTELLIGENCE PANEL",
    "INFLATION & GROWTH DASHBOARD",
    "YIELD & RATES DASHBOARD",
    "CROSS-ASSET MACRO IMPACT",
    "MACRO REGIME TIMELINE",
    "AI MACRO INTERPRETATION",
    "Macro intelligence cannot be calculated yet"
  ]) assert.match(page, new RegExp(text));
});

test("Macro Intelligence permissions are explicit", () => {
  for (const permission of [
    "market_intelligence.macro_intelligence.view",
    "market_intelligence.macro_intelligence.recalculate",
    "market_intelligence.macro_intelligence.configure_sources",
    "market_intelligence.macro_intelligence.export",
    "market_intelligence.macro_intelligence.create_alert"
  ]) assert.match(service, new RegExp(permission.replaceAll(".", "\\.")));
});
