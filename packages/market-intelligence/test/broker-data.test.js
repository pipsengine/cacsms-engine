import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BROKER_DATA_SOURCES, BROKER_MARKET_DATA, BROKER_VALIDATION_ISSUES, getBrokerDataDashboard } from "../src/broker-data.js";

test("terminal broker data dashboard renders the complete broker intelligence center", () => {
  const page = readFileSync("apps/web/broker-data-page.js", "utf8");
  for (const section of ["Broker Filter Panel","Broker Feed Overview Table","Main Broker Data Chart","Broker Comparison Section","Data Quality Validation Panel","Broker Data Table","Broker Source Configuration","Empty, Loading & Error States","Broker Data Action Center"]) assert.match(page, new RegExp(section.replace(/[&]/g, "\\$&")));
  for (const source of ["MetaTrader Bridge","cTrader API","FIX API","REST API","CSV Upload","Manual Import"]) assert.match(page, new RegExp(source));
  for (const mode of ["Candlestick","Line","Bid/Ask","Spread Area","Tick Density","Execution Slippage"]) assert.match(page, new RegExp(mode.replace("/", "\\/")));
  assert.match(page, /data-bd-row/);
  assert.match(page, /bd-drawer/);
});

test("broker data package exposes sources records validation and dashboard summary", () => {
  const dashboard = getBrokerDataDashboard();
  assert.equal(BROKER_DATA_SOURCES.length, 4);
  assert.equal(BROKER_MARKET_DATA.length, 6);
  assert.equal(BROKER_VALIDATION_ISSUES.length, 4);
  assert.equal(dashboard.summary.connectedBrokers, 3);
  assert.equal(dashboard.summary.dataQualityScore, 95);
});

test("broker data API exposes ingestion comparison validation export and disconnect contracts", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of ["/api/market-intelligence/broker-data","/api/market-intelligence/broker-data/sources","/api/market-intelligence/broker-data/connect","/api/market-intelligence/broker-data/sync","/api/market-intelligence/broker-data/upload","/api/market-intelligence/broker-data/compare","/api/market-intelligence/broker-data/validation","/api/market-intelligence/broker-data/export","/api/market-intelligence/broker-data/sources/"]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(api, /DELETE/);
});

test("broker data migration defines persistence tables indexes and permissions", () => {
  const sql = readFileSync("database/migrations/011_broker_data.sql", "utf8");
  for (const table of ["broker_data_sources","broker_market_data","broker_data_validation_logs","broker_data_sync_logs","broker_comparison_metrics"]) assert.match(sql, new RegExp(`market\\.${table}`));
  for (const permission of ["view","connect","sync","upload","export","configure","disconnect"]) assert.match(sql, new RegExp(`market_intelligence\\.broker_data\\.${permission}`));
  assert.match(sql, /idx_broker_market_data_lookup/);
});
