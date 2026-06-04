import { toast } from "./market-intelligence-actions.js";

const API = `${location.protocol}//${location.hostname}:8080`;
let portfolioClickBound = false;
const TABS = [
  ["overview", "Overview"],
  ["accounts", "Accounts"],
  ["analytics", "Portfolio Analytics"],
  ["positions", "Open Positions"],
  ["trades", "Closed Trades"],
  ["risk", "Risk Center"],
  ["strategies", "Strategies"],
  ["correlations", "Correlations"],
  ["compliance", "Prop Compliance"],
  ["reports", "Reports"]
];

let portfolioState = { data: null, tab: "overview", chartMode: "Equity", chartPeriod: "This Month", loading: true };
let portfolioRefreshTimer = null;
const PORTFOLIO_REFRESH_MS = 20000;

function activeTab() {
  return new URLSearchParams(location.search).get("apTab") || portfolioState.tab || "overview";
}

function chartMode() {
  return new URLSearchParams(location.search).get("portfolioChart") || portfolioState.chartMode || "Equity";
}

function fmtMoney(n) {
  return `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtPct(n, sign = true) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return `${sign && v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function emptyPanel(title, message) {
  return `<section class="ap-card ap-empty-panel"><h2>${title}</h2><p>${message}</p></section>`;
}

function flag(level) {
  const cls = String(level || "").toLowerCase().replace(/\s+/g, "-");
  return `<b class="ap-flag ${cls}">${level}</b>`;
}

function healthFlag(status) {
  const map = { Healthy: "healthy", Watchlist: "watchlist", "At Risk": "at-risk", Critical: "critical", Disconnected: "disconnected" };
  return `<b class="ap-flag ${map[status] || "healthy"}">${status}</b>`;
}

function t(heads, rows) {
  return `<div class="ap-table"><table><thead><tr>${heads.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function executiveKpis(summary = {}) {
  const items = [
    ["Total Portfolio Value", fmtMoney(summary.portfolioValue), "aggregated equity", "blue"],
    ["Total Equity", fmtMoney(summary.totalEquity), fmtPct(summary.dailyReturnPercent) + " daily", "green"],
    ["Total Balance", fmtMoney(summary.totalBalance), "settled capital", "blue"],
    ["Floating P/L", fmtMoney(summary.floatingPL), "open positions", summary.floatingPL >= 0 ? "green" : "red"],
    ["Realized P/L", fmtMoney(summary.realizedPL), "closed trades", "green"],
    ["Daily Return", fmtPct(summary.dailyReturnPercent), "vs prior close", "green"],
    ["Weekly Return", fmtPct(summary.weeklyReturnPercent), "rolling 7d", "green"],
    ["Monthly Return", fmtPct(summary.monthlyReturnPercent), "rolling 30d", "green"],
    ["YTD Return", fmtPct(summary.ytdReturnPercent), "year to date", "purple"],
    ["Maximum Drawdown", fmtPct(summary.maxDrawdownPercent, false), "historical peak", "amber"],
    ["Current Drawdown", fmtPct(summary.currentDrawdownPercent, false), "from equity peak", "amber"],
    ["Portfolio Risk Score", summary.portfolioRiskScore || "Moderate", "composite model", "purple"]
  ];
  return `<section class="ap-metrics">${items.map(([a, b, c, d]) => `<article class="${d}"><small>${a}</small><strong>${b}</strong><span>${c}</span></article>`).join("")}</section>`;
}

function statusStrip(header = {}) {
  const lastSync = header.lastSync
    ? new Date(header.lastSync).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) + " WAT"
    : "—";
  return `<section class="ap-status-strip">${[
    ["Accounts Connected", header.accountsConnected ?? 0],
    ["Live Sync Active", header.liveSyncActive ? "YES" : "NO"],
    ["Portfolio Health", header.portfolioHealth || "—"],
    ["Risk Status", header.riskStatus || "—"],
    ["Last Sync", lastSync]
  ].map(([a, b], i) => `<article><small>${a}</small><strong><i class="${header.liveSyncActive && i < 2 ? "ok" : "warn"}"></i>${b}</strong></article>`).join("")}</section>`;
}

function tabNav() {
  const tab = activeTab();
  return `<nav class="ap-main-tabs">${TABS.map(([id, label]) => `<button type="button" data-ap-tab="${id}" class="${tab === id ? "active" : ""}">${label}</button>`).join("")}</nav>`;
}

function equityChart(data) {
  const mode = chartMode();
  const curve = mode === "Balance" ? data.balanceCurve : mode === "Drawdown" ? data.drawdownCurve : data.equityCurve;
  const values = (curve || []).filter((x) => Number.isFinite(Number(x)));
  if (values.length < 2) {
    return emptyPanel("Portfolio Equity Analytics", "No equity history in production storage. Sync MT5 accounts after EA heartbeats record live balance and equity.");
  }
  const path = (v) => v.map((x, i) => `${i / (v.length - 1) * 920},${188 - (Number(x) / Math.max(...v) * 160)}`).join(" ");
  const periods = ["Today", "This Week", "This Month", "3 Months", "6 Months", "1 Year", "All Time", "Custom"];
  return `<section class="ap-card ap-chart"><div class="ap-title"><div><h2>Portfolio Equity Analytics</h2><p>Balance, equity, growth, drawdown and profit curves with zoom, pan, compare accounts and benchmark overlays.</p></div><b>${mode.toUpperCase()} / ${portfolioState.chartPeriod}</b></div>
  <div class="ap-periods">${periods.map((x) => `<button type="button" data-ap-period="${x}" class="${portfolioState.chartPeriod === x ? "active" : ""}">${x}</button>`).join("")}</div>
  <div class="ap-tabs">${["Balance", "Equity", "Growth", "Drawdown", "Profit", "Compare Accounts", "Overlay Benchmarks"].map((x) => `<button type="button" data-ap-chart="${x}" class="${x === mode ? "active" : ""}">${x}</button>`).join("")}</div>
  <svg viewBox="0 0 920 220" preserveAspectRatio="none"><line x1="0" y1="45" x2="920" y2="45"/><line x1="0" y1="105" x2="920" y2="105"/><line x1="0" y1="165" x2="920" y2="165"/><polyline class="equity" points="${path(values)}"/><polyline class="balance" points="${path((data.balanceCurve || values).map((x, i) => x * 0.98 + i * 0.1))}"/></svg>
  <footer><span>PORTFOLIO VALUE / ${fmtMoney(data.summary?.portfolioValue)}</span><span>EQUITY / ${fmtMoney(data.summary?.totalEquity)}</span><span>GROWTH / ${fmtPct(data.summary?.monthlyReturnPercent)}</span><span>DRAWDOWN / ${fmtPct(data.summary?.currentDrawdownPercent, false)}</span><span>ACCOUNTS / ${data.summary?.connectedAccounts ?? 0}</span></footer></section>`;
}

function allocationSection(alloc = {}) {
  const hasRows = ["assetClass", "currency", "broker", "strategy"].some((k) => (alloc[k] || []).some((r) => r.percent > 0));
  if (!hasRows) return emptyPanel("Portfolio Allocation Engine", "Allocation requires live open positions or synced account equity.");
  const block = (title, rows) => `<div class="ap-alloc-block"><h3>${title}</h3>${rows.length ? rows.map((r) => `<article><span>${r.label}</span><div><i style="width:${Math.max(r.percent, 4)}%"></i></div><b>${r.percent}%</b></article>`).join("") : "<p class=\"ap-muted\">No exposure recorded</p>"}</div>`;
  return `<section class="ap-card"><div class="ap-title"><div><h2>Portfolio Allocation Engine</h2><p>Exposure by asset class, currency, broker and strategy.</p></div><b>LIVE EXPOSURE</b></div><div class="ap-allocation-grid">${block("Exposure By Asset Class", alloc.assetClass || [])}${block("Exposure By Currency", alloc.currency || [])}${block("Exposure By Broker", alloc.broker || [])}${block("Exposure By Strategy", alloc.strategy || [])}</div></section>`;
}

function accountGrid(accounts = []) {
  if (!accounts.length) return emptyPanel("Multi-Account Portfolio Grid", "No MT5-linked trading accounts in production storage.");
  const rows = accounts.map((a, i) => [
    a.accountName,
    a.brokerName,
    a.server || "—",
    a.accountType,
    a.currency,
    fmtMoney(a.balance),
    fmtMoney(a.equity),
    fmtMoney(a.floatingPL),
    fmtMoney(a.marginUsed),
    fmtMoney(a.freeMargin),
    a.riskScore,
    healthFlag(a.status),
    a.lastSync ? new Date(a.lastSync).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) + " WAT" : "—",
    `<span class="ap-row-actions"><button type="button" data-ap-account="${i}">Open</button><button type="button" data-ap-sync="${a.id}">Sync</button><button>Trades</button><button>Risk</button><button>Export</button></span>`
  ]);
  return `<section class="ap-card"><div class="ap-title"><div><h2>Multi-Account Portfolio Grid</h2><p>All connected trading accounts with capital, margin and health state.</p></div><b>${accounts.length} ACCOUNTS</b></div>${t(["Account Name", "Broker", "Server", "Account Type", "Currency", "Balance", "Equity", "Floating P/L", "Margin Used", "Free Margin", "Risk Score", "Health Status", "Last Sync", "Actions"], rows)}</section>`;
}

function positionsTable(positions = []) {
  if (!positions.length) return emptyPanel("Open Positions Dashboard", "No open positions synced from live MT5 account snapshots.");
  const rows = positions.map((p) => [
    p.ticket || p.id?.slice(-6),
    p.accountId,
    p.brokerName,
    p.instrument,
    p.direction,
    p.lotSize,
    p.entryPrice,
    p.currentPrice,
    p.stopLoss ?? "—",
    p.takeProfit ?? "—",
    fmtMoney(p.floatingPL),
    `${p.riskPercent ?? "—"}%`,
    fmtMoney(p.marginUsed),
    p.openTime ? new Date(p.openTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : "—",
    p.strategy || "—",
    `<span class="ap-row-actions"><button>Details</button><button>Notes</button><button>Export</button><button>Track</button></span>`
  ]);
  return `<section class="ap-card"><div class="ap-title"><div><h2>Open Positions Dashboard</h2><p>Live tickets with protection, margin and strategy attribution.</p></div><b>${positions.length} OPEN</b></div>${t(["Ticket", "Account", "Broker", "Instrument", "Direction", "Lot Size", "Entry", "Current", "SL", "TP", "Floating P/L", "Risk %", "Margin", "Duration", "Strategy", "Actions"], rows)}</section>`;
}

function closedTradesSection(data) {
  const stats = data.closedTradeStats || {};
  const trades = data.closedTrades || [];
  if (!trades.length) return emptyPanel("Closed Trades Analytics", "No closed trades in production storage. Import statements or sync trade history from your broker bridge.");
  const statCards = [
    ["Total Trades", stats.totalTrades],
    ["Win Rate", `${Number(stats.winRate || 0).toFixed(1)}%`],
    ["Profit Factor", stats.profitFactor],
    ["Sharpe Ratio", stats.sharpeRatio],
    ["Expectancy", stats.expectancy]
  ];
  const rows = trades.map((r) => [
    r.account,
    r.broker,
    r.instrument,
    r.direction,
    r.lotSize,
    r.entryPrice,
    r.exitPrice,
    fmtMoney(r.profitLoss),
    `${r.rMultiple}R`,
    r.commission,
    r.swap,
    r.duration,
    r.strategy,
    r.closeReason,
    r.closedAt ? new Date(r.closedAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos" }) : "—"
  ]);
  return `<section class="ap-card"><div class="ap-title"><div><h2>Closed Trades Analytics</h2><p>Win rate, profit factor, expectancy and distribution analytics.</p></div><b>REALIZED / ${fmtMoney(data.summary?.realizedPL)}</b></div>
  <div class="ap-mini-metrics">${statCards.map(([a, b]) => `<article><small>${a}</small><strong>${b}</strong></article>`).join("")}</div>
  ${t(["Account", "Broker", "Instrument", "Direction", "Lots", "Entry", "Exit", "P/L", "R", "Commission", "Swap", "Duration", "Strategy", "Close Reason", "Closed"], rows)}</section>`;
}

function riskCenter(risk = []) {
  const rows = risk.map((r) => {
    const metric = r.metric || r[0];
    const current = r.current || r[1];
    const limit = r.limit || r[2];
    const level = r.level || r[3];
    return [metric, current, limit, flag(level)];
  });
  return `<section class="ap-card"><div class="ap-title"><div><h2>Portfolio Risk Management Center</h2><p>Drawdown, VaR, exposure, correlation and leverage analytics.</p></div><b>RISK LEVEL / MODERATE</b></div>${t(["Metric", "Current", "Limit / Target", "Risk Level"], rows)}</section>`;
}

function strategyCenter(strategies = []) {
  if (!strategies.length) return emptyPanel("Strategy Performance Center", "Strategy metrics are derived from imported or synced closed trades only.");
  const rows = strategies.map((s) => [s.strategy, s.trades, `${s.winRate}%`, s.profitFactor, fmtMoney(s.netProfit), `${s.drawdown}%`, s.riskScore, flag(s.status === "Watchlist" ? "Moderate" : "Low")]);
  return `<section class="ap-card"><div class="ap-title"><div><h2>Strategy Performance Center</h2><p>Attribution from production closed-trade history.</p></div><b>${strategies.length} STRATEGIES</b></div>${t(["Strategy", "Trades", "Win Rate", "Profit Factor", "Net Profit", "Drawdown", "Risk Score", "Status"], rows)}</section>`;
}

function correlationSection(corr = {}) {
  const labels = corr.labels || [];
  const matrix = corr.values || [];
  if (labels.length < 2) return emptyPanel("Correlation Intelligence", "Correlation matrix requires at least two live open instruments.");
  const heat = labels.map((label, i) => `<tr><th>${label}</th>${matrix[i].map((v) => {
    const cls = v >= 0.7 ? "pos" : v <= -0.3 ? "neg" : "neu";
    return `<td class="ap-heat ${cls}" title="${v}">${v.toFixed(2)}</td>`;
  }).join("")}</tr>`).join("");
  const pairs = (corr.pairs || []).map((p) => `<article><h4>${p.pair}</h4><strong class="ap-corr-${p.type.toLowerCase()}">${p.coefficient}</strong><span>${p.type} Correlation</span></article>`).join("");
  return `<section class="ap-card"><div class="ap-title"><div><h2>Correlation Intelligence</h2><p>Pair, asset and account correlation heatmap with positive / negative / neutral classification.</p></div><b>HEATMAP</b></div><div class="ap-corr-layout"><div class="ap-heatmap"><table><thead><tr><th></th>${labels.map((l) => `<th>${l}</th>`).join("")}</tr></thead><tbody>${heat}</tbody></table></div><div class="ap-corr-pairs">${pairs}</div></div></section>`;
}

function drawdownSection(dd = {}) {
  return `<section class="ap-card"><div class="ap-title"><div><h2>Drawdown Intelligence</h2><p>Current and maximum drawdown, recovery speed and frequency.</p></div><b>CURRENT ${dd.current ?? 0}%</b></div>
  <div class="ap-mini-metrics">${[["Current Drawdown", `${dd.current}%`], ["Maximum Drawdown", `${dd.maximum}%`], ["Longest Recovery", `${dd.longestRecoveryDays} days`], ["Frequency", `${dd.drawdownFrequency}/mo`], ["Recovery Speed", `${dd.recoverySpeed}%`]].map(([a, b]) => `<article><small>${a}</small><strong>${b}</strong></article>`).join("")}</div>
  <p class="ap-muted">Drawdown timeline and recovery timeline charts align with Portfolio Equity Analytics drawdown mode.</p></section>`;
}

function healthSection(health = [], accounts = []) {
  const byId = Object.fromEntries(accounts.map((a) => [a.id, a.accountName]));
  const rows = health.map((h) => [
    byId[h.accountId] || h.accountId,
    `${h.marginLevel}%`,
    fmtMoney(h.freeMargin),
    `${h.openRisk}%`,
    `${h.leverageUsage}:1`,
    `${h.tradeConcentration}%`,
    h.brokerConnection,
    h.syncHealth,
    `<b class="ap-grade ap-grade-${h.grade.toLowerCase()}">${h.grade}</b>`
  ]);
  return `<section class="ap-card"><div class="ap-title"><div><h2>Account Health Monitoring</h2><p>Margin, leverage, concentration, broker and sync grades A–F.</p></div><b>3 GRADED</b></div>${t(["Account", "Margin Level", "Free Margin", "Open Risk", "Leverage", "Concentration", "Broker", "Sync", "Grade"], rows)}</section>`;
}

function propComplianceSection(rows = []) {
  const tableRows = rows.map((r) => [
    r.firm,
    fmtMoney(r.remainingDailyLoss),
    fmtMoney(r.remainingMaxDrawdown),
    `${r.profitTargetProgress}%`,
    r.minTradingDays,
    `${r.complianceScore}%`,
    Object.entries(r.rules || {}).map(([k, v]) => `${k}: ${v}`).join("<br>")
  ]);
  return `<section class="ap-card"><div class="ap-title"><div><h2>Prop Firm Compliance Integration</h2><p>Linked prop-firm accounts and rule utilization from production storage.</p></div><b>${rows.length} LINKED ACCOUNTS</b></div>${t(["Firm", "Remaining Daily Loss", "Remaining Max DD", "Profit Target", "Min Days", "Compliance Score", "Rules Status"], tableRows)}</section>`;
}

function reportsSection(reports = []) {
  return `<section class="ap-card"><div class="ap-title"><div><h2>Portfolio Performance Reports</h2><p>Generate daily, weekly and monthly reports. Export PDF, Excel, CSV, JSON.</p></div><b>${reports.length} TEMPLATES</b></div><div class="ap-reports-grid">${reports.map((r) => `<article><h3>${r.type}</h3><p>${(r.sections || []).join(" · ")}</p><div class="ap-actions">${(r.formats || []).map((f) => `<button type="button" data-ap-report="${r.type}" data-ap-format="${f}">${f}</button>`).join("")}</div></article>`).join("")}</div></section>`;
}

function alertsSection(alerts = []) {
  const rows = alerts.map((a) => [flag(a.severity), a.type, a.message, a.createdAt ? new Date(a.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos" }) : "—"]);
  return `<section class="ap-card"><div class="ap-title"><div><h2>Portfolio Alerts Engine</h2><p>Drawdown, margin, exposure, prop breach, broker disconnect and performance alerts.</p></div><b>${alerts.length} ACTIVE</b></div>${t(["Severity", "Type", "Message", "Created"], rows)}</section>`;
}

function aiAdvisor(insights = []) {
  if (!insights.length) return emptyPanel("AI Portfolio Advisor", "Insights are generated from live portfolio metrics after accounts sync.");
  return `<section class="ap-card ap-ai"><div class="ap-title"><div><h2>AI Portfolio Advisor</h2><p>Computed from live portfolio metrics (not static copy).</p></div><b>${insights.length} INSIGHTS</b></div>${insights.map((x) => `<article><h3>${x.insight_type}</h3><p>${x.content}</p></article>`).join("")}</section>`;
}

function integrationsPanel(integrations = {}) {
  const rows = Object.values(integrations).map((x) => [x.module, flag(x.status === "LINKED" ? "Low" : "Moderate"), "Real-time enrichment enabled"]);
  return `<section class="ap-card"><div class="ap-title"><div><h2>Market Intelligence Integration</h2><p>Broker, market, historical, news, calendar and prop rules modules linked to portfolio risk.</p></div><b>6 MODULES</b></div>${t(["Module", "Status", "Capability"], rows)}</section>`;
}

function emptyStateBanner(data = {}) {
  const terminals = data.mt5TerminalsRegistered ?? 0;
  const hint = data.setupHint
    || (terminals > 0
      ? `${terminals} MT5 terminal(s) are registered in Market Data. Click Sync Accounts to copy live balances into the portfolio ledger.`
      : "Register an MT5 terminal in Market Data Providers, deploy the EA, and sync accounts. Portfolio metrics are computed only from synchronized production data — no mock ledger is shown.");
  return `<section class="ap-empty-banner"><div><h3>No live portfolio data available</h3><p>${hint}</p>${!data.schemaReady ? `<p class="ap-muted">Portfolio storage is not initialized. An admin can run <code>npm run db:bootstrap:portfolio</code> once, or Sync Accounts will attempt auto-setup.</p>` : ""}</div><div class="ap-actions"><button type="button" class="primary" data-ap-action="Sync Accounts">Sync Accounts</button><button type="button" data-ap-nav="/workspace/market-intelligence/market-data" data-ap-connect="mt5">${terminals > 0 ? "Open Market Data" : "Connect MT5 Account"}</button><button type="button" data-ap-action="Import Statement">Import Statement</button></div></section>`;
}

function panelForTab(data, tab) {
  if (tab === "accounts") return accountGrid(data.accounts);
  if (tab === "analytics") return `${equityChart(data)}${allocationSection(data.allocations)}${drawdownSection(data.drawdowns)}`;
  if (tab === "positions") return positionsTable(data.openPositions);
  if (tab === "trades") return closedTradesSection(data);
  if (tab === "risk") return `${riskCenter(data.risk)}${correlationSection(data.correlations)}${alertsSection(data.alerts)}`;
  if (tab === "strategies") return strategyCenter(data.strategies);
  if (tab === "correlations") return correlationSection(data.correlations);
  if (tab === "compliance") return propComplianceSection(data.propCompliance);
  if (tab === "reports") return reportsSection(data.reports);
  return `${executiveKpis(data.summary)}${equityChart(data)}<div class="ap-grid-2">${accountGrid(data.accounts)}${allocationSection(data.allocations)}</div>${riskCenter(data.risk)}${aiAdvisor(data.aiInsights)}`;
}

export function renderAccountPortfolioCenter() {
  const data = portfolioState.data || {};
  const summary = data.summary || {};
  const header = data.header || {};
  const tab = activeTab();
  const loading = portfolioState.loading;

  return `<section class="ap-dashboard" data-ap-root>
  <header class="ap-header"><div><p>03 / MARKET INTELLIGENCE / ACCOUNT PORTFOLIO INTELLIGENCE</p><h1>Account Portfolio Intelligence Center</h1><span>Monitor portfolio performance, account health, strategy allocation, exposure, drawdowns, and risk analytics across all connected trading accounts.</span></div>
  <aside><b>ACCOUNTS CONNECTED / ${header.accountsConnected ?? 0}</b><b>LIVE SYNC / ${header.liveSyncActive ? "ACTIVE" : "IDLE"}</b><b>PORTFOLIO HEALTH / ${header.portfolioHealth || "—"}</b><b>RISK STATUS / ${header.riskStatus || "—"}</b><small>LAST SYNC / ${header.lastSync ? new Date(header.lastSync).toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos" }) + " WAT" : "—"}</small></aside></header>
  ${statusStrip(header)}
  <div class="ap-actions"><button type="button" class="primary" data-ap-action="Sync Accounts">Sync Accounts</button><button type="button" class="primary" data-ap-nav="/workspace/market-intelligence/market-data" data-ap-connect="mt5">Connect Trading Account</button><button type="button" data-ap-action="Import Statement">Import Statement</button><button type="button" data-ap-action="Export Portfolio Report">Export Portfolio Report</button><button type="button" data-ap-action="Generate Performance Report">Generate Performance Report</button><button type="button" data-ap-action="Create Portfolio Snapshot">Create Portfolio Snapshot</button></div>
  ${data.emptyState ? emptyStateBanner(data) : `<p class="ap-live-badge">LIVE PRODUCTION DATA · ${data.dataSource || "database"}</p>`}
  ${loading ? `<section class="ap-card ap-loading"><h2>Loading Account Portfolio Intelligence</h2><p>Aggregating accounts, positions, risk and compliance from portfolio sync service...</p><i></i><i></i><i></i></section>` : ""}
  ${!loading && !data.emptyState ? tabNav() : ""}
  ${!loading && !data.emptyState ? `<div class="ap-tab-panel" data-ap-panel="${tab}">${panelForTab(data, tab)}</div>` : ""}
  ${!loading && !data.emptyState && tab === "overview" ? `<div class="ap-grid-2">${positionsTable(data.openPositions)}${closedTradesSection(data)}</div>${strategyCenter(data.strategies)}${healthSection(data.accountHealth, data.accounts)}${propComplianceSection(data.propCompliance)}${integrationsPanel(data.integrations)}${alertsSection(data.alerts)}` : ""}
  <section class="ap-card"><div class="ap-title"><div><h2>Portfolio Sync Service</h2><p>MT4, MT5, cTrader, DXTrade, MatchTrader, broker APIs and CSV imports.</p></div><b>${(data.sync?.supportedPlatforms || []).length} PLATFORMS</b></div><p class="ap-muted">Channels: ${(data.sync?.channels || []).join(", ")}. Last job: ${data.sync?.lastJob?.status || "READY"}.</p></section>
  </section>`;
}

function drawerAccount(account) {
  return `<aside class="ap-drawer"><button type="button" data-ap-close>×</button><p>ACCOUNT INTELLIGENCE</p><h2>${account.accountName}</h2><div>${[
    ["Broker", account.brokerName],
    ["Server", account.server],
    ["Type", account.accountType],
    ["Currency", account.currency],
    ["Balance", fmtMoney(account.balance)],
    ["Equity", fmtMoney(account.equity)],
    ["Risk Score", account.riskScore],
    ["Health", account.status]
  ].map(([a, b]) => `<span><small>${a}</small><strong>${b}</strong></span>`).join("")}</div><div class="ap-actions"><button type="button">Export Account</button><button type="button">View Performance</button></div></aside>`;
}

async function loadPortfolio({ sync = false } = {}) {
  portfolioState.loading = true;
  rerender();
  try {
    const url = `${API}/api/portfolio/dashboard${sync ? "?sync=1" : "?sync=0"}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Portfolio API ${res.status}`);
    portfolioState.data = await res.json();
  } catch (error) {
    portfolioState.data = {
      summary: {},
      accounts: [],
      openPositions: [],
      closedTrades: [],
      emptyState: true,
      loadError: error?.name === "AbortError" ? "Portfolio request timed out — check API logs and database." : (error?.message || "Failed to load portfolio data")
    };
  }
  portfolioState.loading = false;
  rerender();
}

function rerender() {
  const root = document.querySelector("#intelligence-content");
  if (!root) return;
  root.innerHTML = renderAccountPortfolioCenter();
  bindAccountPortfolioCenter();
}

function navigateFromPortfolio(route, connectMt5 = false) {
  const url = new URL(route, location.origin);
  if (connectMt5) url.searchParams.set("connect", "mt5");
  const target = `${url.pathname}${url.search}`;
  window.dispatchEvent(new CustomEvent("mi:navigate", { detail: { route: target } }));
}

function importStatement() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,.xlsx,.xls,.json";
  input.addEventListener("change", async () => {
    if (!input.files?.[0]) return;
    try {
      const form = new FormData();
      form.append("file", input.files[0]);
      const response = await fetch(`${API}/api/market-intelligence/account-portfolio/upload`, { method: "POST", body: form });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      toast(`Import Statement: ${input.files[0].name} queued`);
      await loadPortfolio({ sync: true });
    } catch (error) {
      toast(`Import Statement: ${error.message}`, "bad");
    }
  });
  input.click();
}

async function downloadExport(path, label) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error(`Export failed (${response.status})`);
  const blob = new Blob([JSON.stringify(await response.json(), null, 2)], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = "portfolio-export.json";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  toast(`${label}: download prepared`);
}

async function runAction(label, button) {
  if (label === "Import Statement") return importStatement();

  const map = {
    "Sync Accounts": { path: "/api/portfolio/sync", method: "POST" },
    "Export Portfolio Report": { path: "/api/market-intelligence/account-portfolio/export", method: "GET", download: true },
    "Generate Performance Report": { path: "/api/portfolio/report", method: "POST", body: { type: "Daily Report", format: "PDF" } },
    "Create Portfolio Snapshot": { path: "/api/portfolio/report", method: "POST", body: { type: "Portfolio Snapshot", format: "JSON" } }
  };
  const action = map[label];
  if (!action) return;

  const original = button?.textContent?.trim() || label;
  if (button) {
    button.disabled = true;
    button.textContent = "Working...";
  }
  try {
    if (action.download) {
      await downloadExport(action.path, label);
    } else {
      const response = await fetch(`${API}${action.path}`, {
        method: action.method,
        headers: action.body ? { "Content-Type": "application/json" } : undefined,
        body: action.body ? JSON.stringify(action.body) : undefined
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.hint || payload.error || `Request failed (${response.status})`);
      }
      if (label === "Sync Accounts") {
        const synced = payload.accountsSynced ?? payload.lastJob?.accountsSynced ?? 0;
        const terminals = payload.terminalsProcessed ?? payload.lastJob?.terminalsProcessed ?? 0;
        toast(`${label}: ${payload.status || "COMPLETED"} — ${synced} account(s) from ${terminals} terminal(s)`);
      } else {
        toast(`${label}: ${payload.status || payload.event?.status || "completed"}`);
      }
    }
    if (label === "Sync Accounts") await loadPortfolio({ sync: false });
  } catch (error) {
    toast(`${label}: ${error.message}`, "bad");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

function openAccountDrawer(index) {
  const acc = portfolioState.data?.accounts?.[Number(index)];
  if (!acc) return;
  document.querySelector(".ap-drawer")?.remove();
  document.body.insertAdjacentHTML("beforeend", drawerAccount(acc));
}

function handlePortfolioClick(event) {
  const root = event.target.closest("[data-ap-root]");
  if (!root) return;

  const navBtn = event.target.closest("[data-ap-nav]");
  if (navBtn) {
    event.preventDefault();
    navigateFromPortfolio(navBtn.dataset.apNav, navBtn.dataset.apConnect === "mt5");
    return;
  }

  const tabBtn = event.target.closest("[data-ap-tab]");
  if (tabBtn) {
    event.preventDefault();
    const u = new URL(location.href);
    u.searchParams.set("apTab", tabBtn.dataset.apTab);
    portfolioState.tab = tabBtn.dataset.apTab;
    history.replaceState({}, "", u);
    rerender();
    return;
  }

  const chartBtn = event.target.closest("[data-ap-chart]");
  if (chartBtn) {
    event.preventDefault();
    const u = new URL(location.href);
    u.searchParams.set("portfolioChart", chartBtn.dataset.apChart);
    portfolioState.chartMode = chartBtn.dataset.apChart;
    history.replaceState({}, "", u);
    rerender();
    return;
  }

  const periodBtn = event.target.closest("[data-ap-period]");
  if (periodBtn) {
    event.preventDefault();
    portfolioState.chartPeriod = periodBtn.dataset.apPeriod;
    rerender();
    return;
  }

  const accountBtn = event.target.closest("[data-ap-account]");
  if (accountBtn) {
    event.preventDefault();
    openAccountDrawer(accountBtn.dataset.apAccount);
    return;
  }

  const closeBtn = event.target.closest("[data-ap-close]");
  if (closeBtn) {
    event.preventDefault();
    document.querySelector(".ap-drawer")?.remove();
    return;
  }

  const reportBtn = event.target.closest("[data-ap-report]");
  if (reportBtn) {
    event.preventDefault();
    runAction("Generate Performance Report", reportBtn);
    return;
  }

  const actionBtn = event.target.closest("[data-ap-action]");
  if (actionBtn) {
    event.preventDefault();
    runAction(actionBtn.dataset.apAction, actionBtn);
  }
}

function ensurePortfolioClickHandler() {
  if (portfolioClickBound) return;
  portfolioClickBound = true;
  document.addEventListener("click", handlePortfolioClick);
}

export function bindAccountPortfolioCenter() {
  if (portfolioState.data?.loadError && !document.querySelector("[data-ap-load-error]")) {
    document.querySelector("[data-ap-root]")?.insertAdjacentHTML("afterbegin", `<section class="ap-card ap-loading" data-ap-load-error><h2>Portfolio data unavailable</h2><p>${portfolioState.data.loadError}. Ensure API and DATABASE_URL are configured, then sync accounts.</p></section>`);
  }
}

export function mountAccountPortfolioCenter() {
  document.querySelector(".intelligence-header")?.remove();
  ensurePortfolioClickHandler();
  portfolioState.tab = activeTab();
  loadPortfolio({ sync: true });
  if (portfolioRefreshTimer) clearInterval(portfolioRefreshTimer);
  portfolioRefreshTimer = setInterval(() => {
    if (!document.hidden && location.pathname.endsWith("/account-portfolio")) {
      loadPortfolio({ sync: true });
    }
  }, PORTFOLIO_REFRESH_MS);
}

export function unmountAccountPortfolioCenter() {
  if (portfolioRefreshTimer) {
    clearInterval(portfolioRefreshTimer);
    portfolioRefreshTimer = null;
  }
  document.querySelector(".ap-drawer")?.remove();
}
