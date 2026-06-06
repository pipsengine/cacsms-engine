import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moduleSource = readFileSync("packages/market-intelligence/src/card-two-dashboard.js", "utf8");
const page = readFileSync("apps/web/live-market-intelligence-page.js", "utf8");
const api = readFileSync("apps/api/src/server.mjs", "utf8");
const migration = readFileSync("database/migrations/030_card_two_market_intelligence_dashboard.sql", "utf8");

test("Card 2 dashboard reads the required workflow and market tables", () => {
  for (const table of [
    "workflow.card_inputs",
    "workflow.card_outputs",
    "workflow.card_handoffs",
    "market.market_intelligence",
    "market.intelligence_scores",
    "market.intelligence_packages",
    "market.intelligence_logs"
  ]) assert.match(moduleSource, new RegExp(table.replace(".", "\\.")));
  assert.doesNotMatch(moduleSource, /MOCK_WORKFLOW|MOCK_|mock data/i);
});

test("Card 2 dashboard migration creates the required persistence tables", () => {
  for (const table of [
    "workflow.card_inputs",
    "workflow.card_outputs",
    "workflow.card_handoffs",
    "market.intelligence_scores",
    "market.intelligence_packages",
    "market.intelligence_logs"
  ]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table.replace(".", "\\.")}`));
});

test("API exposes Card 2 dashboard and workflow control endpoints", () => {
  assert.match(api, /GET \/api\/market-intelligence\/card-2\/dashboard/);
  assert.match(api, /runCardTwoAction\(action\)/);
  assert.match(api, /runCardTwoLiveTest/);
  assert.match(api, /\/api\/workflow\/cards\/2\/test-live/);
  assert.match(api, /\/api\/market-intelligence\/card-2\//);
});

test("Card 2 dashboard renders the complete operational command center", () => {
  for (const text of [
    "Market Intelligence Center",
    "Validated Intelligence Package",
    "INTELLIGENCE PIPELINE STATUS",
    "Market Environment Summary",
    "Macro Intelligence Summary",
    "Sentiment Intelligence Summary",
    "Institutional Intelligence Summary",
    "Broker & Liquidity Summary",
    "Portfolio Intelligence Summary",
    "INTELLIGENCE SCORING CENTER",
    "MARKET INTELLIGENCE PACKAGE",
    "WORKFLOW CONTROL CENTER",
    "CARD 2 ACCEPTANCE MATRIX",
    "AUDIT & EVENTS"
  ]) assert.match(page, new RegExp(text.replace(/[&]/g, "\\$&")));
  for (const action of ["run-intelligence-gathering", "validate-package", "generate-package", "run-card-2-test", "approve-card-2", "reject-card-2", "send-to-card-3"]) assert.match(page, new RegExp(action));
});
