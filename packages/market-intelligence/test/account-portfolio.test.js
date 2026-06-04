import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getAccountPortfolioDashboard } from "../src/account-portfolio.js";
import {
  buildExecutiveSummary,
  buildPortfolioDashboard,
  computeClosedTradeStats,
  heartbeatHasAccountPayload,
  snapshotHasLiveMetrics,
  syncPortfolioFromLiveSources
} from "../src/portfolio-live-data.js";
import { PortfolioSyncService, PORTFOLIO_SYNC_PLATFORMS } from "../src/portfolio-sync-service.js";

test("account portfolio page uses live API only without demo portfolio", () => {
  const page = readFileSync("apps/web/account-portfolio-page.js", "utf8");
  assert.match(page, /api\/portfolio\/dashboard/);
  assert.match(page, /LIVE PRODUCTION DATA/);
  assert.doesNotMatch(page, /Use Demo Portfolio|FTMO Challenge|acc-live-01/);
});

test("live portfolio dashboard returns empty production payload without database", async () => {
  const dashboard = await getAccountPortfolioDashboard({ sync: false });
  assert.equal(dashboard.emptyState, true);
  assert.equal(dashboard.placeholderMode, false);
  assert.equal(dashboard.dataSource, "live");
  assert.equal(dashboard.accounts.length, 0);
  assert.equal(dashboard.summary.totalBalance, 0);
});

test("heartbeat ignores relay-only payloads without account metrics", () => {
  assert.equal(heartbeatHasAccountPayload({ token: "x", openPositions: [] }), false);
  assert.equal(heartbeatHasAccountPayload({ account: null, openPositions: [] }), false);
  assert.equal(heartbeatHasAccountPayload({ account: { balance: 10000, equity: 10050 } }), true);
  assert.equal(snapshotHasLiveMetrics({ balance: "10,250.50", equity: "10,300.00" }), true);
});

test("executive summary and trade stats compute from real rows only", () => {
  const accounts = [
    { balance: 10000, equity: 10100, floatingPL: 100, realizedPL: 500, marginUsed: 200, riskScore: 20, dailyDrawdownPercent: 0.5, monthlyReturnPercent: 2, status: "Healthy" }
  ];
  const summary = buildExecutiveSummary(accounts);
  assert.equal(summary.totalBalance, 10000);
  assert.equal(summary.totalEquity, 10100);
  const stats = computeClosedTradeStats([
    { profitLoss: 120 },
    { profitLoss: -40 }
  ]);
  assert.equal(stats.totalTrades, 2);
  assert.equal(stats.winningTrades, 1);
});

test("portfolio sync service reports not configured without database", async () => {
  const svc = new PortfolioSyncService();
  const result = await svc.syncAll();
  assert.equal(result.status, "DATABASE_NOT_CONFIGURED");
  assert.ok(PORTFOLIO_SYNC_PLATFORMS.includes("MT5"));
});

test("account portfolio API exposes live portfolio routes", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of [
    "/api/portfolio/dashboard",
    "/api/portfolio/sync",
    "/api/portfolio/import",
    "/api/market-intelligence/account-portfolio"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
});

test("live shell mounts dedicated account portfolio center", () => {
  const shell = readFileSync("apps/web/market-intelligence-live-shell.js", "utf8");
  assert.match(shell, /mountAccountPortfolioCenter/);
});

test("portfolio migrations include live account snapshot bridge", () => {
  const sql = readFileSync("database/migrations/028_portfolio_live_account_snapshot.sql", "utf8");
  assert.match(sql, /account_snapshot/);
  assert.match(sql, /terminal_id/);
});

test("buildPortfolioDashboard marks non-placeholder analytics", () => {
  const dash = buildPortfolioDashboard(
    { accounts: [], openPositions: [], closedTrades: [], equitySnapshots: [], riskRows: [], alerts: [], propCompliance: [] },
    { sync: { liveSyncActive: false }, integrations: {} }
  );
  assert.equal(dash.placeholderMode, false);
  assert.equal(typeof syncPortfolioFromLiveSources, "function");
});
