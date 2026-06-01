import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COT_CURRENCY_MAPPINGS, COT_SYNC_CRON, createCotSyncStatus, evaluateInstitutionalCot, getCotComparison } from "../src/institutional-cot.js";

const cache = JSON.parse(readFileSync("apps/web/public/data/institutional-cot.json", "utf8").replace(/^\uFEFF/, ""));

test("terminal institutional COT dashboard renders official intelligence desk sections", () => {
  const page = readFileSync("apps/web/institutional-cot-page.js", "utf8");
  for (const section of ["COT DATA SYNC CENTER", "COT CURRENCY SELECTOR", "SELECTED CURRENCY COT HISTORY", "Long vs Short Position Chart", "Net Position Trend Chart", "Change Long / Change Short Chart", "BIAS INTERPRETATION PANEL", "COT CURRENCY COMPARISON MATRIX", "COT SYNC HISTORY & LOGS", "WORKFLOW IMPACT PANEL", "COT ACTION CENTER"]) assert.match(page, new RegExp(section.replace(/[&]/g, "\\$&")));
  assert.match(page, /\/data\/institutional-cot\.json/);
  assert.match(page, /data-cot-currency="ALL"/);
  assert.match(page, /renderAllCurrencies/);
  assert.match(page, /ALL CURRENCIES COT HISTORY/);
  assert.match(page, /right\.date\.localeCompare\(left\.date\)/);
  assert.doesNotMatch(page, /const seeds|mock/i);
});

test("official CFTC cache contains current Futures Only records without fabricated unavailable mappings", () => {
  assert.equal(cache.latestReportDate, "2026-05-26");
  assert.equal(cache.history.EUR[0].long, 223055);
  assert.equal(cache.history.EUR[0].short, 193629);
  assert.equal(cache.history.EUR[0].net, 29426);
  assert.equal(cache.history.XAU.length, 21);
  assert.equal(cache.history.NZD.length, 0);
  assert.equal(cache.history.USD.length, 0);
});

test("institutional COT evaluates official workflow output without standalone hard blocks", () => {
  const output = evaluateInstitutionalCot(cache);
  assert.equal(output.source, "institutional_cot_data");
  assert.equal(output.report_type, "FUTURES_ONLY");
  assert.equal(output.selected_currency, "EUR");
  assert.equal(output.long, 223055);
  assert.equal(output.short, 193629);
  assert.equal(output.net_positions, 29426);
  assert.equal(output.workflow_permission, "ALLOWED");
  assert.deepEqual(output.blocks, []);
});

test("institutional COT maps nine currencies and weekly Saturday sync", () => {
  const status = createCotSyncStatus(cache);
  assert.equal(COT_CURRENCY_MAPPINGS.length, 9);
  assert.equal(cache.mappings.length, 9);
  assert.equal(COT_SYNC_CRON, "0 0 * * 6");
  assert.equal(status.job, "cot_weekly_sync_job");
  assert.equal(getCotComparison(cache).length, 9);
});

test("institutional COT API exposes dashboard sync and analysis routes", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of ["/api/market-intelligence/institutional-cot/dashboard", "/api/market-intelligence/institutional-cot/currencies", "/api/market-intelligence/institutional-cot/history", "/api/market-intelligence/institutional-cot/latest", "/api/market-intelligence/institutional-cot/comparison", "/api/market-intelligence/institutional-cot/sync/status", "/api/market-intelligence/institutional-cot/sync/logs", "/api/market-intelligence/institutional-cot/sync-now", "/api/market-intelligence/institutional-cot/sync-year", "/api/market-intelligence/institutional-cot/sync-all", "/api/market-intelligence/institutional-cot/recalculate-bias", "/api/market-intelligence/institutional-cot/validate-latest"]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(api, /scripts\/sync-cftc-cot\.ps1/);
});

test("institutional COT migration and scheduler define durable weekly sync", () => {
  const sql = readFileSync("database/migrations/009_institutional_cot.sql", "utf8");
  for (const table of ["cot_currency_mappings", "cot_reports", "cot_positions", "cot_position_changes", "cot_bias_scores", "cot_sync_jobs", "cot_sync_logs", "cot_raw_files", "cot_import_batches", "cot_workflow_impacts"]) assert.match(sql, new RegExp(`market\\.${table}`));
  assert.match(sql, /UNIQUE\(report_date,currency_code,report_type\)/);
  const scheduler = readFileSync("services/market-intelligence/cot_scheduler.py", "utf8");
  assert.match(scheduler, /cot_weekly_sync_job/);
  assert.match(scheduler, /day_of_week="sat"/);
  assert.match(scheduler, /COT_SYNC_RETRIES = 3/);
});
