import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getMarketIntelligenceDashboard } from "../src/dashboard-mock.js";

test("dashboard mock exposes institutional readiness defaults", () => {
  const dashboard = getMarketIntelligenceDashboard();
  assert.equal(dashboard.status, "OPERATIONAL");
  assert.equal(dashboard.proceedStatus, "ALLOWED");
  assert.equal(dashboard.dataQualityScore, 98);
  assert.equal(dashboard.sources.length, 9);
  assert.equal(dashboard.economicEvents.filter(({ impact }) => impact === "HIGH").length, 3);
  assert.equal(dashboard.sentiment.score, 62);
  assert.equal(dashboard.brokerHealth, 97);
});

test("terminal dashboard renders every required operations panel", () => {
  const page = readFileSync("apps/web/market-intelligence-page.js", "utf8");
  for (const panel of [
    "Market Intelligence Dashboard", "Data Source Health Matrix", "Market Session & Trading Window",
    "Economic Risk", "News & Sentiment", "Broker & Account Feed", "Data Quality Gate",
    "Intelligence Feed Timeline", "Workflow Impact", "Action Center"
  ]) assert.match(page, new RegExp(panel.replace(/[&]/g, "\\$&")));
});

test("API server exposes the dashboard contract routes", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of [
    "/api/market-intelligence/dashboard", "/api/market-intelligence/data-sources/health",
    "/api/market-intelligence/economic-events", "/api/market-intelligence/news-sentiment",
    "/api/market-intelligence/broker-feeds", "/api/market-intelligence/data-quality-gate",
    "/api/market-intelligence/scan", "/api/market-intelligence/refresh-feeds",
    "/api/market-intelligence/test-sources"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
});
