import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getEconomicCalendarDashboard,
  getEconomicCalendarLiveSourceSnapshot,
  getEconomicRestrictions,
  listEconomicEvents,
  listEconomicSources
} from "../src/economic-calendar-intelligence.js";

test("economic calendar intelligence exposes persisted live-provider records", () => {
  const dashboard = getEconomicCalendarDashboard();
  const events = listEconomicEvents({ range: "week" });
  const sources = listEconomicSources();
  assert.equal(dashboard.sourceMode, "LIVE_PROVIDERS_ONLY");
  assert.equal(events.sourceMode, "LIVE_PROVIDERS_ONLY");
  assert.equal(sources.sourceMode, "LIVE_PROVIDERS_ONLY");
  assert.ok(Array.isArray(events.events));
  assert.ok(Array.isArray(sources.sources));
});

test("economic calendar source snapshot reflects synchronized records", () => {
  const dashboard = getEconomicCalendarDashboard();
  const snapshot = getEconomicCalendarLiveSourceSnapshot();
  assert.equal(snapshot.adapter, "economic_calendar_intelligence_engine");
  assert.equal(snapshot.records, dashboard.totalEvents);
  assert.equal(snapshot.checks.configured, true);
});

test("economic calendar restrictions are derived from high-impact live events", () => {
  const restrictions = getEconomicRestrictions();
  assert.equal(restrictions.sourceMode, "LIVE_PROVIDERS_ONLY");
  assert.ok(Array.isArray(restrictions.restrictions));
});

test("API exposes economic calendar intelligence endpoints", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of [
    "/api/economic-calendar",
    "/api/economic-calendar/upcoming",
    "/api/economic-calendar/today",
    "/api/economic-calendar/high-impact",
    "/api/economic-calendar/history",
    "/api/economic-calendar/sources",
    "/api/economic-calendar/alerts",
    "/api/economic-calendar/sync",
    "/api/economic-calendar/releases",
    "/api/economic-calendar/release-updates"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
});
