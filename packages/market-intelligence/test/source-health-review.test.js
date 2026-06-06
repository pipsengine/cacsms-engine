import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("packages/market-intelligence/src/source-health-review.js", "utf8");
const page = readFileSync("apps/web/live-market-intelligence-page.js", "utf8");
const api = readFileSync("apps/api/src/server.mjs", "utf8");
const migration = readFileSync("database/migrations/032_source_health_review.sql", "utf8");

test("Source Health Review service reads only production health tables", () => {
  for (const table of [
    "market.source_registry",
    "market.source_health_metrics",
    "market.source_sync_logs",
    "market.source_validation_logs",
    "market.source_alerts",
    "market.source_provider_health",
    "market.source_dependencies",
    "market.source_rate_limits",
    "market.source_credentials",
    "market.source_health_reviews",
    "market.source_health_recommendations",
    "market.source_audit_logs"
  ]) assert.match(service, new RegExp(table.replace(".", "\\.")));
  assert.doesNotMatch(service, /source-configuration|loadStore|DEFAULT_PROVIDERS|MOCK_|sample data/i);
  assert.match(service, /reconcileUnresolvedSyncFailures/);
  assert.match(service, /isSourceOperational/);
});

test("Source Health Review migration creates the requested persistence tables", () => {
  for (const table of [
    "source_registry",
    "source_health_metrics",
    "source_provider_health",
    "source_sync_logs",
    "source_validation_logs",
    "source_alerts",
    "source_dependencies",
    "source_rate_limits",
    "source_credentials",
    "source_health_reviews",
    "source_health_recommendations",
    "source_audit_logs"
  ]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS market\\.${table}`));
});

test("API exposes Source Health Review routes and actions", () => {
  for (const route of [
    "/api/market-intelligence/source-health-review",
    "/api/market-intelligence/source-health-review/summary",
    "/api/market-intelligence/source-health-review/freshness",
    "/api/market-intelligence/source-health-review/failures",
    "/api/market-intelligence/source-health-review/quality",
    "/api/market-intelligence/source-health-review/dependencies",
    "/api/market-intelligence/source-health-review/rate-limits",
    "/api/market-intelligence/source-health-review/security",
    "/api/market-intelligence/source-health-review/export"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(api, /runSourceHealthReviewAction\(action/);
});

test("Source Health Review page renders all required production sections", () => {
  for (const text of [
    "Source Health Review Center",
    "Refresh Health",
    "Run Health Check",
    "Sync Failed Sources",
    "Export Health Report",
    "SOURCE HEALTH TABLE",
    "HEALTH REVIEW FILTERS",
    "DATA FRESHNESS REVIEW",
    "SYNC FAILURE REVIEW",
    "API RELIABILITY PANEL",
    "DATA QUALITY REVIEW",
    "DEPENDENCY IMPACT REVIEW",
    "API USAGE AND RATE LIMIT REVIEW",
    "AUTHENTICATION AND CREDENTIAL HEALTH",
    "DETAIL DRAWER"
  ]) assert.match(page, new RegExp(text));
});
