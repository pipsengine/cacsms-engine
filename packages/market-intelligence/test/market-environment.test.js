import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("packages/market-intelligence/src/market-environment.js", "utf8");
const page = readFileSync("apps/web/live-market-intelligence-page.js", "utf8");
const api = readFileSync("apps/api/src/server.mjs", "utf8");
const migration = readFileSync("database/migrations/034_market_environment.sql", "utf8");

test("Market Environment service reads the requested production tables", () => {
  for (const table of [
    "market.market_environment_scores",
    "market.market_environment_inputs",
    "market.market_regime_history",
    "market.instrument_environment_states",
    "market.volatility_regime_metrics",
    "market.risk_tone_metrics",
    "market.session_environment_metrics",
    "market.market_environment_alerts",
    "market.market_environment_ai_summaries",
    "market.market_environment_audit_logs"
  ]) assert.match(service, new RegExp(table.replace(".", "\\.")));
  assert.doesNotMatch(service, /MOCK_|sample environment|placeholder row|fabricated/i);
});

test("Market Environment migration creates dashboard storage tables", () => {
  for (const table of [
    "market_environment_scores",
    "market_environment_inputs",
    "market_regime_history",
    "instrument_environment_states",
    "volatility_regime_metrics",
    "risk_tone_metrics",
    "session_environment_metrics",
    "market_environment_alerts",
    "market_environment_ai_summaries",
    "market_environment_audit_logs"
  ]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS market\\.${table}`));
});

test("API exposes Market Environment routes and actions", () => {
  for (const route of [
    "/api/market-intelligence/market-environment",
    "/api/market-intelligence/market-environment/summary",
    "/api/market-intelligence/market-environment/instruments",
    "/api/market-intelligence/market-environment/inputs",
    "/api/market-intelligence/market-environment/volatility",
    "/api/market-intelligence/market-environment/risk-tone",
    "/api/market-intelligence/market-environment/session",
    "/api/market-intelligence/market-environment/events",
    "/api/market-intelligence/market-environment/export"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(api, /runMarketEnvironmentAction\(action/);
});

test("Market Environment page renders requested production sections", () => {
  for (const text of [
    "Market Environment Intelligence Center",
    "Refresh Environment",
    "Recalculate Regime",
    "Configure Inputs",
    "Export Report",
    "Create Alert",
    "INPUT DEPENDENCY PANEL",
    "INSTRUMENT ENVIRONMENT TABLE",
    "VOLATILITY REGIME PANEL",
    "RISK-ON / RISK-OFF PANEL",
    "SESSION ENVIRONMENT",
    "NEWS / EVENT RISK PANEL",
    "AI MARKET ENVIRONMENT SUMMARY",
    "Market environment cannot be calculated yet"
  ]) assert.match(page, new RegExp(text));
});

test("Market Environment permissions are explicit", () => {
  for (const permission of [
    "market_intelligence.market_environment.view",
    "market_intelligence.market_environment.recalculate",
    "market_intelligence.market_environment.configure_inputs",
    "market_intelligence.market_environment.export",
    "market_intelligence.market_environment.create_alert"
  ]) assert.match(service, new RegExp(permission.replaceAll(".", "\\.")));
});
