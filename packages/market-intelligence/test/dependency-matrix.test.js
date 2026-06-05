import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("packages/market-intelligence/src/dependency-matrix.js", "utf8");
const page = readFileSync("apps/web/live-market-intelligence-page.js", "utf8");
const api = readFileSync("apps/api/src/server.mjs", "utf8");
const migration = readFileSync("database/migrations/033_dependency_matrix.sql", "utf8");

test("Dependency Matrix service reads the requested production dependency tables", () => {
  for (const table of [
    "market.source_registry",
    "market.source_dependencies",
    "market.source_health_metrics",
    "market.source_sync_logs",
    "market.source_alerts",
    "market.module_registry",
    "market.service_registry",
    "market.api_registry",
    "market.database_table_registry",
    "market.dependency_graph_nodes",
    "market.dependency_graph_edges",
    "market.dependency_health_scores",
    "market.dependency_recommendations",
    "market.dependency_simulation_logs",
    "market.dependency_audit_logs"
  ]) assert.match(service, new RegExp(table.replace(".", "\\.")));
  assert.doesNotMatch(service, /MOCK_|sample dependency|placeholder row/i);
});

test("Dependency Matrix migration creates graph registry and audit tables", () => {
  for (const table of [
    "module_registry",
    "service_registry",
    "api_registry",
    "database_table_registry",
    "dependency_graph_nodes",
    "dependency_graph_edges",
    "dependency_health_scores",
    "dependency_recommendations",
    "dependency_simulation_logs",
    "dependency_audit_logs"
  ]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS market\\.${table}`));
});

test("API exposes Dependency Matrix routes and actions", () => {
  for (const route of [
    "/api/market-intelligence/dependency-matrix",
    "/api/market-intelligence/dependency-matrix/summary",
    "/api/market-intelligence/dependency-matrix/graph",
    "/api/market-intelligence/dependency-matrix/modules",
    "/api/market-intelligence/dependency-matrix/sources",
    "/api/market-intelligence/dependency-matrix/services",
    "/api/market-intelligence/dependency-matrix/database",
    "/api/market-intelligence/dependency-matrix/recommendations",
    "/api/market-intelligence/dependency-matrix/export"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(api, /runDependencyMatrixAction\(action/);
});

test("Dependency Matrix page renders requested production sections", () => {
  for (const text of [
    "Dependency Matrix Center",
    "Refresh Matrix",
    "Recalculate Dependencies",
    "Export Matrix",
    "MAIN DEPENDENCY MATRIX",
    "VISUAL DEPENDENCY GRAPH",
    "MODULE IMPACT REVIEW",
    "SOURCE TO MODULE MAPPING",
    "SERVICE DEPENDENCY REVIEW",
    "DATABASE TABLE DEPENDENCY REVIEW",
    "FAILURE IMPACT SIMULATOR",
    "DETAIL DRAWER",
    "RECOMMENDED ACTIONS"
  ]) assert.match(page, new RegExp(text));
});
