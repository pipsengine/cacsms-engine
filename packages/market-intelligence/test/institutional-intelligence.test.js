import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("packages/market-intelligence/src/institutional-intelligence.js", "utf8");
const page = readFileSync("apps/web/live-market-intelligence-page.js", "utf8");
const api = readFileSync("apps/api/src/server.mjs", "utf8");
const migration = readFileSync("database/migrations/037_institutional_intelligence.sql", "utf8");

test("Institutional Intelligence service reads the requested production tables", () => {
  for (const table of [
    "market.institutional_intelligence_scores",
    "market.institutional_intelligence_inputs",
    "market.instrument_institutional_states",
    "market.liquidity_zones",
    "market.cot_positioning_metrics",
    "market.accumulation_distribution_states",
    "market.smart_money_concept_signals",
    "market.retail_trap_risks",
    "market.institutional_ai_summaries",
    "market.institutional_alerts",
    "market.institutional_audit_logs"
  ]) assert.match(service, new RegExp(table.replace(".", "\\.")));
  assert.match(service, /InstitutionalIntelligenceEngine/);
  assert.doesNotMatch(service, /MOCK_|demo institutional|sample institutional|placeholder row/i);
});

test("Institutional Intelligence migration creates dashboard storage tables", () => {
  for (const table of [
    "institutional_intelligence_scores",
    "institutional_intelligence_inputs",
    "instrument_institutional_states",
    "liquidity_zones",
    "cot_positioning_metrics",
    "accumulation_distribution_states",
    "smart_money_concept_signals",
    "retail_trap_risks",
    "institutional_ai_summaries",
    "institutional_alerts",
    "institutional_audit_logs"
  ]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS market\\.${table}`));
});

test("API exposes Institutional Intelligence routes and actions", () => {
  for (const route of [
    "/api/market-intelligence/institutional-intelligence",
    "/api/market-intelligence/institutional-intelligence/summary",
    "/api/market-intelligence/institutional-intelligence/inputs",
    "/api/market-intelligence/institutional-intelligence/instruments",
    "/api/market-intelligence/institutional-intelligence/liquidity",
    "/api/market-intelligence/institutional-intelligence/cot-positioning",
    "/api/market-intelligence/institutional-intelligence/accumulation-distribution",
    "/api/market-intelligence/institutional-intelligence/smc",
    "/api/market-intelligence/institutional-intelligence/retail-traps",
    "/api/market-intelligence/institutional-intelligence/export"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(api, /runInstitutionalIntelligenceAction\(action/);
});

test("Institutional Intelligence page renders requested production sections", () => {
  for (const text of [
    "Institutional Intelligence Center",
    "Refresh Intelligence",
    "Recalculate Institutional Bias",
    "Configure Inputs",
    "Create Alert",
    "Export Report",
    "INSTITUTIONAL INTELLIGENCE ENGINE",
    "INPUT DEPENDENCY PANEL",
    "INSTRUMENT INSTITUTIONAL BIAS TABLE",
    "LIQUIDITY INTELLIGENCE PANEL",
    "COT INSTITUTIONAL POSITIONING PANEL",
    "ACCUMULATION / DISTRIBUTION PANEL",
    "SMART MONEY CONCEPTS PANEL",
    "RETAIL TRAP & STOP HUNT RISK",
    "AI INSTITUTIONAL INTERPRETATION",
    "Institutional intelligence cannot be calculated yet"
  ]) assert.match(page, new RegExp(text));
});

test("Institutional Intelligence permissions are explicit", () => {
  for (const permission of [
    "market_intelligence.institutional_intelligence.view",
    "market_intelligence.institutional_intelligence.recalculate",
    "market_intelligence.institutional_intelligence.configure_inputs",
    "market_intelligence.institutional_intelligence.export",
    "market_intelligence.institutional_intelligence.create_alert"
  ]) assert.match(service, new RegExp(permission.replaceAll(".", "\\.")));
});
