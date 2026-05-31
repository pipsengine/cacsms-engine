import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MARKET_DATA_COVERAGE, MARKET_DATA_PROVIDERS, evaluateMarketDataQuality } from "../src/market-data-providers.js";

test("market data providers output is ready for workflow stages 1 through 4", () => {
  const output = evaluateMarketDataQuality();
  assert.deepEqual(output, { market_data_status:"READY", feed_quality_score:98, latency_ms:41, coverage:100, symbols_online:20, workflow_ready:true, reject_reason:null });
  assert.equal(MARKET_DATA_PROVIDERS.length, 8);
  assert.equal(MARKET_DATA_COVERAGE.length, 20);
});

test("market data quality blocks workflow when a provider fails", () => {
  const providers = MARKET_DATA_PROVIDERS.map((provider) => provider.id === "mt5-feed" ? { ...provider, status:"FAILED" } : provider);
  const output = evaluateMarketDataQuality(providers);
  assert.equal(output.workflow_ready, false);
  assert.equal(output.reject_reason, "Market data quality insufficient");
});

test("terminal page renders the market data operations center sections", () => {
  const page = readFileSync("apps/web/market-intelligence-page.js", "utf8");
  for (const section of ["Market Data Providers","Provider Health Grid","Asset Feed Coverage Matrix","Tick & Latency Monitor","Spread Quality Monitor","Feed Quality Engine","Feed Event Timeline","Workflow Dependency Panel","Feed Operations Center"]) assert.match(page,new RegExp(section.replace(/[&]/g,"\\$&")));
});

test("API server exposes market data provider contract", () => {
  const api=readFileSync("apps/api/src/server.mjs","utf8");
  for(const route of ["/api/market-data/providers","/api/market-data/providers/health","/api/market-data/providers/latency","/api/market-data/providers/coverage","/api/market-data/providers/events","/api/market-data/providers/quality","/api/market-data/providers/validate","/api/market-data/providers/restart"]) assert.match(api,new RegExp(route.replaceAll("/","\\/")));
});

test("migration defines all market feed operations tables", () => {
  const migration=readFileSync("database/migrations/005_market_data_providers.sql","utf8");
  for(const table of ["feed_providers","feed_health","feed_latency","feed_events","feed_quality","feed_coverage","feed_statistics"]) assert.match(migration,new RegExp(`market\\.${table}`));
});
