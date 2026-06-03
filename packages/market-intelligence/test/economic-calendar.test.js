import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CENTRAL_BANK_WATCH,
  CURRENCY_ASSET_IMPACT,
  ECONOMIC_CALENDAR_EVENTS,
  evaluateEconomicCalendar
} from "../src/economic-calendar.js";

test("economic calendar defaults to an honest live-adapter empty state", () => {
  const output = evaluateEconomicCalendar();
  assert.equal(output.status, "NOT_CONFIGURED");
  assert.equal(output.event_risk_mode, "UNAVAILABLE");
  assert.equal(output.events_today, 0);
  assert.equal(output.high_impact_events, 0);
  assert.equal(output.countdown_minutes, null);
  assert.equal(output.workflow_permission, "RESTRICTED");
  assert.equal(ECONOMIC_CALENDAR_EVENTS.length, 0);
  assert.equal(CURRENCY_ASSET_IMPACT.length, 0);
  assert.equal(CENTRAL_BANK_WATCH.length, 0);
});

test("economic calendar blocks explicitly supplied protected windows", () => {
  assert.equal(evaluateEconomicCalendar({ strictPropWindow: true }).workflow_permission, "BLOCKED");
});

test("economic calendar restricts at minimum when a configured source fails", () => {
  const output = evaluateEconomicCalendar({ sourceStatus: "FAILED" });
  assert.equal(output.workflow_permission, "RESTRICTED");
  assert.equal(output.status, "FAILED");
});

test("API exposes economic calendar contract", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of [
    "/api/market-intelligence/economic-calendar/dashboard",
    "/api/market-intelligence/economic-calendar/events",
    "/api/market-intelligence/economic-calendar/high-impact",
    "/api/market-intelligence/economic-calendar/restrictions",
    "/api/market-intelligence/economic-calendar/asset-impact",
    "/api/market-intelligence/economic-calendar/central-banks",
    "/api/market-intelligence/economic-calendar/sync",
    "/api/market-intelligence/economic-calendar/risk-scan",
    "/api/market-intelligence/economic-calendar/apply-restriction",
    "/api/market-intelligence/economic-calendar/release-restriction"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
});

test("economic calendar migration defines all persistence tables", () => {
  const sql = readFileSync("database/migrations/007_economic_calendar.sql", "utf8");
  for (const table of [
    "economic_calendar_sources",
    "economic_events",
    "economic_event_releases",
    "economic_event_impacts",
    "economic_restriction_windows",
    "central_bank_events",
    "central_bank_bias",
    "economic_event_asset_impact",
    "economic_event_audit_logs"
  ]) assert.match(sql, new RegExp(`market\\.${table}`));
});
