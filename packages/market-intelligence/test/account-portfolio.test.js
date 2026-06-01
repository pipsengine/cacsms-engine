import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PORTFOLIO_CLOSED_TRADES, PORTFOLIO_POSITIONS, PORTFOLIO_RISK_METRICS, TRADING_ACCOUNTS, getAccountPortfolioDashboard } from "../src/account-portfolio.js";

test("terminal account portfolio dashboard renders the complete intelligence center", () => {
  const page = readFileSync("apps/web/account-portfolio-page.js", "utf8");
  for (const section of ["Portfolio Filter Panel","Portfolio Equity Chart","Account Allocation Section","Open Positions Table","Closed Trades Table","Risk & Drawdown Panel","Account Health Table","Empty, Loading & Error States","Account Portfolio Action Center"]) assert.match(page,new RegExp(section.replace(/[&]/g,"\\$&")));
  for (const mode of ["Balance","Equity","Drawdown","Daily Return","Cumulative Return","Compare Accounts","Fullscreen"]) assert.match(page,new RegExp(mode));
  assert.match(page,/data-ap-account/);
  assert.match(page,/ap-drawer/);
});

test("account portfolio package exposes accounts positions trades risk and computed summary", () => {
  const dashboard=getAccountPortfolioDashboard();
  assert.equal(TRADING_ACCOUNTS.length,3);
  assert.equal(PORTFOLIO_POSITIONS.length,4);
  assert.equal(PORTFOLIO_CLOSED_TRADES.length,3);
  assert.equal(PORTFOLIO_RISK_METRICS.length,10);
  assert.equal(dashboard.summary.totalBalance,124860);
  assert.equal(dashboard.summary.totalEquity,126412);
});

test("account portfolio API exposes dashboard account trade risk equity sync connect and export routes", () => {
  const api=readFileSync("apps/api/src/server.mjs","utf8");
  for(const route of ["/api/market-intelligence/account-portfolio","/api/market-intelligence/account-portfolio/accounts","/api/market-intelligence/account-portfolio/positions/open","/api/market-intelligence/account-portfolio/trades/closed","/api/market-intelligence/account-portfolio/risk","/api/market-intelligence/account-portfolio/equity-curve","/api/market-intelligence/account-portfolio/sync","/api/market-intelligence/account-portfolio/connect","/api/market-intelligence/account-portfolio/export"]) assert.match(api,new RegExp(route.replaceAll("/","\\/")));
});

test("account portfolio migration defines normalized tables indexes and permissions", () => {
  const sql=readFileSync("database/migrations/012_account_portfolio.sql","utf8");
  for(const table of ["trading_accounts","portfolio_positions","portfolio_closed_trades","portfolio_equity_snapshots","portfolio_risk_metrics","portfolio_sync_logs","portfolio_strategy_allocation"]) assert.match(sql,new RegExp(`market\\.${table}`));
  for(const permission of ["view","connect","sync","export","view_risk","manage_notes"]) assert.match(sql,new RegExp(`market_intelligence\\.account_portfolio\\.${permission}`));
  assert.match(sql,/idx_portfolio_positions_account_status/);
});
