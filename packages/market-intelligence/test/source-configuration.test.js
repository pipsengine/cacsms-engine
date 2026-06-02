import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createSourceProvider,
  deleteSourceProvider,
  getSourceConfigurationDashboard,
  getSourceProviders,
  loadStore,
  SOURCE_CATEGORIES,
  testAllSourceProviders,
  WORKFLOW_DEPENDENCIES
} from "../src/source-configuration.js";

test("defines nine source configuration categories", () => assert.equal(SOURCE_CATEGORIES.length, 9));
test("defines workflow dependency map entries", () => assert.ok(WORKFLOW_DEPENDENCIES.length >= 5));
test("builds source configuration dashboard with registry and connectivity summary", () => {
  const dashboard = getSourceConfigurationDashboard([]);
  const providerCount = loadStore().providers.length;
  assert.equal(dashboard.registry.length, providerCount);
  assert.ok("totalSources" in dashboard.connectivity);
  assert.ok("configurationHealthScore" in dashboard.connectivity);
  assert.equal(dashboard.summaryCards.length, SOURCE_CATEGORIES.length);
  assert.ok(dashboard.credentials.every((item) => item.display.includes("Stored Securely")));
});
test("creates providers and persists them to the configuration store", () => {
  const before = getSourceProviders().providers.length;
  const provider = createSourceProvider({ sourceKey: "market-data", providerName: "Polygon" });
  assert.equal(getSourceProviders().providers.length, before + 1);
  const store = loadStore();
  assert.ok(store.auditLogs.some((log) => log.event === "Provider Added"));
  deleteSourceProvider(provider.id);
  assert.equal(getSourceProviders().providers.length, before);
});
test("API server exposes source configuration administration routes", () => {
  const server = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of [
    "/api/source-configuration",
    "/api/source-configuration/providers",
    "/api/source-configuration/health",
    "/api/source-configuration/logs",
    "/api/source-configuration/provider",
    "/api/source-configuration/test",
    "/api/source-configuration/test-all",
    "/api/source-configuration/sync",
    "/api/source-configuration/sync-all"
  ]) assert.match(server, new RegExp(route.replaceAll("/", "\\/")));
});
test("runs test-all and records audit activity", async () => {
  const count = loadStore().providers.length;
  const result = await testAllSourceProviders({ liveSnapshots: [], probeFn: async () => ({ ok: true, latencyMs: 42 }) });
  assert.equal(result.results.length, count);
  assert.ok(loadStore().auditLogs.some((log) => log.event === "Test All Connections"));
});
