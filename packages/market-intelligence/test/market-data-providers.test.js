import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  TARGET_ASSETS,
  evaluateMarketDataQuality,
  exportMarketDataStatusCsv,
  getMarketDataOperationsDashboard
} from "../src/market-data-providers.js";

test("market data quality blocks workflow when no enabled providers exist", () => {
  const output = evaluateMarketDataQuality([], []);
  assert.equal(output.workflow_ready, false);
  assert.equal(output.market_data_status, "BLOCKED");
  assert.equal(output.reject_reason, "No enabled providers");
});

test("market data quality blocks workflow when a provider fails", () => {
  const providers = [{ enabled: true, health: 95, latencyMs: 20, status: "LIVE" }, { enabled: true, health: 10, latencyMs: 20, status: "FAILED" }];
  const coverage = TARGET_ASSETS.map((symbol) => ({ symbol, status: "LIVE", priceFeed: true }));
  const output = evaluateMarketDataQuality(providers, coverage);
  assert.equal(output.workflow_ready, false);
});

test("operations dashboard exposes output contract without mock providers", async () => {
  const dashboard = await getMarketDataOperationsDashboard({ liveProbe: null });
  assert.equal(dashboard.source, "market_data");
  assert.ok("confidence_score" in dashboard);
  assert.ok("integrity_score" in dashboard);
  assert.equal(Array.isArray(dashboard.providers), true);
  assert.ok(dashboard.mt5);
  assert.ok(dashboard.mt5.readiness);
  if (dashboard.empty) {
    assert.equal(dashboard.workflow_permission, "STOP");
    assert.equal(dashboard.providers.length, 0);
  } else {
    assert.ok(["STOP", "RESTRICTED", "ALLOWED"].includes(dashboard.workflow_permission));
    assert.ok(dashboard.providers.length > 0);
  }
  assert.ok(dashboard.output);
});

test("export status csv includes readiness fields", () => {
  const csv = exportMarketDataStatusCsv({
    dashboard: {
      status: "BLOCKED",
      health: 0,
      latency: 0,
      coverage: 0,
      integrity_score: 0,
      confidence_score: 0,
      symbols: 0,
      workflow_permission: "STOP",
      providers: []
    }
  });
  assert.match(csv, /readiness,workflow_permission,STOP/);
});

test("terminal page renders the market data operations center sections", () => {
  const page = readFileSync("apps/web/market-data-page.js", "utf8");
  for (const section of [
    "Market Data Providers", "Provider Registry", "Live Feed Monitor", "Asset Coverage Matrix",
    "Tick Quality Monitor", "Spread Quality Center", "Latency Monitor", "Data Integrity Engine",
    "Provider Comparison Center", "Workflow Impact Panel", "Market Data Logs", "Action Center"
  ]) assert.match(page, new RegExp(section.replace(/[&]/g, "\\$&")));
});

test("API server exposes market data provider contract", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of [
    "/api/market-data/providers", "/api/market-data/providers/health", "/api/market-data/providers/latency",
    "/api/market-data/providers/symbols", "/api/market-data/providers/logs", "/api/market-data/providers/confidence",
    "/api/market-data/providers/test-all", "/api/market-data/providers/sync-all-symbols",
    "/api/market-data/providers/coverage", "/api/market-data/providers/export"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
});

test("API exposes recorded MT5 ticks for real-time browser updates", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  const mt5 = readFileSync("packages/market-intelligence/src/mt5-infrastructure.js", "utf8");
  const ea = readFileSync("mt5/experts/CACSMS_Engine_Bridge.mq5", "utf8");
  const serializer = readFileSync("mt5/include/MessageSerializer.mqh", "utf8");
  assert.match(api, /GET \/api\/market-data\/ticks\/latest/);
  assert.match(api, /getLatestTicks\(limit\)/);
  assert.match(mt5, /input\.ticks \|\| input\.prices/);
  assert.match(mt5, /INSERT INTO market\.market_data_ticks/);
  assert.match(ea, /void OnTick\(\)[\s\S]*SendHeartbeat\(\)/);
  assert.match(serializer, /CacsmsBuildLiveTicksJson/);
  assert.match(serializer, /\\"ticks\\":%s/);
});

test("migration defines all market feed operations tables", () => {
  const migration = readFileSync("database/migrations/005_market_data_providers.sql", "utf8");
  for (const table of ["feed_providers", "feed_health", "feed_latency", "feed_events", "feed_quality", "feed_coverage", "feed_statistics"]) assert.match(migration, new RegExp(`market\\.${table}`));
  const ops = readFileSync("database/migrations/016_market_data_operations.sql", "utf8");
  for (const table of ["market_data_providers", "market_data_health", "market_data_latency", "market_data_integrity", "market_data_ticks", "market_data_symbols", "market_data_coverage", "market_data_logs", "market_data_confidence"]) assert.match(ops, new RegExp(`market\\.${table}`));
  const fields = readFileSync("database/migrations/017_market_data_provider_fields.sql", "utf8");
  assert.match(fields, /connection_method/);
  assert.match(fields, /vault_secret_ref/);
});

test("react page uses tanstack query hooks and add provider modal", () => {
  const page = readFileSync("apps/web/components/market-data/MarketDataPage.tsx", "utf8");
  assert.match(page, /useMarketDataProviders/);
  assert.match(page, /AddMarketDataProviderModal/);
  assert.match(page, /useCreateMarketDataProvider/);
  assert.doesNotMatch(page, /mock-data/);
});

test("add provider modal uses react hook form and zod", () => {
  const modal = readFileSync("apps/web/components/market-data/AddMarketDataProviderModal.tsx", "utf8");
  assert.match(modal, /useForm/);
  assert.match(modal, /zodResolver/);
  assert.match(modal, /Add Market Data Provider/);
});

test("API server exposes provider onboarding routes", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of [
    "/api/market-data/providers/validate",
    "/api/market-data/providers/preview-coverage",
    "/api/market-data/providers/catalog",
    "/api/market-data/providers/detect-mt5-terminals",
    "/api/market-data/providers/market-watch",
    "/api/market-data/providers/detect-symbols"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
});

test("legacy add provider uses guided onboarding wizard", () => {
  const wizard = readFileSync("apps/web/market-data-provider-wizard.js", "utf8");
  const page = readFileSync("apps/web/market-data-page.js", "utf8");
  for (const text of [
    "Source Category", "Detect Installed MT5 Terminals", "Detect Servers", "Refresh Servers",
    "Enter Custom Server", "Register Provider", "MARKET DATA ONBOARDING WIZARD", "buildWizardPayload"
  ]) {
    assert.match(wizard + page, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("wizard catalog exposes provider categories and vendor presets", async () => {
  const { getWizardCatalog, resolveVendorPreset, WIZARD_PROVIDERS } = await import("../src/provider-wizard-catalog.js");
  const catalog = getWizardCatalog();
  assert.equal(catalog.categories.length, 4);
  assert.ok(catalog.providers.mt5_terminal.length >= 5);
  assert.ok(resolveVendorPreset("TwelveData")?.baseUrl);
  for (const provider of WIZARD_PROVIDERS.mt5_terminal) {
    assert.equal("serverName" in provider, false);
  }
});

test("extractMt5Identity normalizes broker server and environment", async () => {
  const { extractMt5Identity } = await import("../src/market-data-repository.js");
  assert.deepEqual(extractMt5Identity({
    wizardCategory: "mt5_terminal",
    connectionMethod: "MT5 Bridge",
    brokerName: "IC Markets",
    serverName: "ICMarketsSC-Demo",
    environment: "Demo"
  }), {
    brokerName: "IC Markets",
    serverName: "ICMarketsSC-Demo",
    environment: "Demo"
  });
  assert.equal(extractMt5Identity({ connectionMethod: "REST API", baseUrl: "https://example.com" }), null);
});

test("API rejects duplicate MT5 terminal provider errors with 409", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  assert.match(api, /duplicate_mt5_terminal_provider/);
});

test("runtime sync module exports automatic sync helpers", async () => {
  const runtime = await import("../src/runtime-sync.js");
  assert.equal(typeof runtime.runMarketDataRuntimeSync, "function");
  assert.equal(typeof runtime.startMarketDataRuntimeSyncLoop, "function");
});

test("market data Card 1 snapshot uses MT5 bridge instead of env URL", async () => {
  const { buildMarketDataLiveSourceSnapshot } = await import("../src/market-data-source-validation.js");
  const snapshot = await buildMarketDataLiveSourceSnapshot();
  assert.equal(snapshot.id, "market-data");
  assert.equal(snapshot.envKey, null);
  assert.equal(snapshot.connectionLabel, "MT5 Bridge");
  assert.match(snapshot.configuration, /Market Data Providers|MT5 terminal connected/i);
  if (snapshot.status === "LIVE" || snapshot.status === "ONLINE") {
    assert.equal(snapshot.checks.quality, "PASSED");
    assert.ok(snapshot.records > 0);
  }
});

test("broker server catalog exposes verified IC Markets MT5 servers", async () => {
  const { listBrokerServers, listMt5Brokers } = await import("../src/mt5-broker-servers.js");
  const brokers = await listMt5Brokers();
  assert.ok(brokers.brokers.some((item) => item.brokerName === "IC Markets" && item.brokerSearchName === "Raw Trading Ltd"));
  const servers = await listBrokerServers("IC Markets");
  const expected = [
    "ICMarketsSC-Demo",
    "ICMarketsSC-MT5",
    "ICMarketsSC-MT5-2",
    "ICMarketsSC-MT5-3",
    "ICMarketsSC-MT5-4",
    "ICMarketsSC-MT5-6"
  ];
  assert.equal(servers.servers.length, expected.length);
  assert.deepEqual(servers.servers.map((item) => item.serverName).sort(), [...expected].sort());
  assert.equal(servers.servers.find((item) => item.isDefault)?.serverName, "ICMarketsSC-MT5-6");
  assert.ok(servers.servers.every((item) => item.verificationStatus === "VERIFIED"));
  assert.doesNotMatch(JSON.stringify(servers.servers), /Live26|Live01|Live02/);
});

test("API exposes MT5 broker server endpoints", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of [
    "/api/mt5/brokers",
    "/api/mt5/brokers/detect-servers",
    "/api/mt5/brokers/custom-server"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
});
