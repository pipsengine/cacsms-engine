const API = "http://localhost:8080";
let portfolioIntelligenceTimer = null;

function ownsRoute() {
  return location.pathname.endsWith("/portfolio-intelligence");
}

export function unmountPortfolioIntelligenceCenter() {
  if (portfolioIntelligenceTimer) clearInterval(portfolioIntelligenceTimer);
  portfolioIntelligenceTimer = null;
  document.querySelector(".pi-drawer")?.remove();
}

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function money(value) {
  if (value == null) return "Insufficient Data";
  return `$${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fmt(value, suffix = "") {
  if (value == null || value === "") return "Insufficient Data";
  return `${esc(value)}${suffix}`;
}

function time(value) {
  return value ? new Date(value).toLocaleString() : "Insufficient Data";
}

function cls(value) {
  const text = String(value || "").toLowerCase().replaceAll("_", "-");
  if (/healthy|good|profitable|live|low|hold|normal/.test(text)) return "good";
  if (/watchlist|warning|medium|monitor|reduce|move|partial|at risk/.test(text)) return "warn";
  if (/critical|breached|high|close|disconnected|stop/.test(text)) return "bad";
  return "neutral";
}

function pill(value) {
  return `<b class="pi-pill ${cls(value)}">${esc(value || "Insufficient Data")}</b>`;
}

function table(headers, rows, empty) {
  const body = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")
    : `<tr><td class="pi-empty-cell" colspan="${headers.length}">${esc(empty)}</td></tr>`;
  return `<div class="pi-table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

async function request(path, options) {
  const response = await fetch(`${API}${path}`, { cache: "no-store", ...options });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

async function post(path, body = {}) {
  return request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function header(data) {
  const badges = [
    ["Production Live", "Enabled"],
    ["Mock Data Disabled", data.summary.mockDataDisabled ? "Yes" : "No"],
    ["Live Accounts Only", data.summary.sourceMode],
    ["Last Portfolio Sync", time(data.summary.lastPortfolioSync)],
    ["Portfolio Health Score", data.summary.portfolioHealthScore == null ? "Insufficient Data" : `${data.summary.portfolioHealthScore}%`]
  ];
  return `<header class="pi-header"><div><p>MARKET INTELLIGENCE / PORTFOLIO</p><h1>Portfolio Intelligence Center</h1><span>Analyze live account performance, portfolio exposure, drawdown risk, trade quality, strategy allocation, and prop-firm compliance across connected trading accounts.</span><div class="pi-badges">${badges.map(([a,b]) => `<label><small>${a}</small><strong>${esc(b)}</strong></label>`).join("")}</div></div><div class="pi-actions"><button class="primary" data-action="refresh">Refresh Portfolio</button><button data-action="sync">Sync Accounts</button><button data-action="recalculate">Recalculate Risk</button><button data-action="configure">Configure Accounts</button><button data-action="export">Export Report</button></div></header>`;
}

function summaryCards(s) {
  const cards = [
    ["Total Balance", money(s.totalBalance), "settled capital"],
    ["Total Equity", money(s.totalEquity), "live equity"],
    ["Floating P/L", money(s.floatingPL), "open trades"],
    ["Realized P/L", money(s.realizedPL), "closed trades"],
    ["Open Positions", s.openPositions, "active tickets"],
    ["Active Accounts", s.activeAccounts, "live accounts"],
    ["Margin Used", money(s.marginUsed), "current margin"],
    ["Free Margin", money(s.freeMargin), "available margin"],
    ["Margin Level", s.marginLevel == null ? "Insufficient Data" : `${s.marginLevel}%`, "margin safety"],
    ["Current Drawdown", s.currentDrawdown == null ? "Insufficient Data" : `${s.currentDrawdown}%`, "current DD"],
    ["Max Drawdown", s.maxDrawdown == null ? "Insufficient Data" : `${s.maxDrawdown}%`, "history peak"],
    ["Portfolio Risk Score", s.portfolioRiskScore == null ? "Insufficient Data" : s.portfolioRiskScore, "risk model"],
    ["Portfolio Health", s.portfolioHealth, "composite"],
    ["Prop Firm Breach Risk", s.propFirmBreachRisk, "compliance"]
  ];
  return `<section class="pi-summary">${cards.map(([a,b,c]) => `<article class="${cls(b)}"><small>${a}</small><strong>${fmt(b)}</strong><span>${c}</span></article>`).join("")}</section>`;
}

function emptyState(data) {
  if (!data.emptyState) return "";
  const actions = [
    ["Connect Trading Account", "/workspace/data-sources-validation/account-portfolio"],
    ["Open Broker Data", "/workspace/data-sources-validation/broker-data"],
    ["Configure Account Sources", "/workspace/data-sources-validation/source-configuration"],
    ["Run Source Health Review", "/workspace/market-intelligence/source-health-review"]
  ];
  return `<section class="pi-panel pi-empty"><h2>${esc(data.emptyState.title)}</h2><p>${esc(data.emptyState.message)}</p><div class="pi-actions">${actions.map(([label, route], index) => `<button class="${index === 0 ? "primary" : ""}" data-route="${route}">${label}</button>`).join("")}</div></section>`;
}

function inputs(rows) {
  return `<section class="pi-panel"><div class="pi-panel-head"><div><h2>Input Dependency Panel</h2><p>Unavailable inputs reduce the portfolio health confidence score.</p></div><b>LIVE INPUTS</b></div>${table(["Input","Provider / Broker","Account","Status","Freshness","Health","Weight","Last Updated","Used In Portfolio Score"], rows.map((r) => [esc(r.input), esc(r.provider), esc(r.account), pill(r.status), esc(r.freshness), pill(r.health), esc(r.weight), time(r.lastUpdated), r.usedInPortfolioScore ? "Yes" : "No"]), "Input unavailable. Portfolio health confidence score reduced.")}</section>`;
}

function accounts(rows) {
  return `<section class="pi-panel"><div class="pi-panel-head"><div><h2>Account Health Table</h2><p>Live account balances, drawdown, margin and risk status.</p></div><b>${rows.length} ACCOUNTS</b></div>${table(["Account","Broker","Server","Account Type","Currency","Balance","Equity","Floating P/L","Realized P/L","Margin Used","Free Margin","Margin Level","Drawdown","Open Trades","Risk Score","Health Status","Last Sync"], rows.map((r, i) => [`<button class="pi-link" data-account="${i}">${esc(r.account)}</button>`, esc(r.broker), esc(r.server), esc(r.accountType), esc(r.currency), money(r.balance), money(r.equity), money(r.floatingPL), money(r.realizedPL), money(r.marginUsed), money(r.freeMargin), fmt(r.marginLevel, "%"), fmt(r.drawdown, "%"), esc(r.openTrades), esc(r.riskScore), pill(r.healthStatus), time(r.lastSync)]), "No live trading accounts are connected.")}</section>`;
}

function positions(rows) {
  return `<section class="pi-panel"><div class="pi-panel-head"><div><h2>Open Positions Intelligence</h2><p>Risk, protection, correlation and action recommendation for live open positions.</p></div><b>${rows.length} OPEN</b></div>${table(["Account","Broker","Instrument","Direction","Lot Size","Entry Price","Current Price","Stop Loss","Take Profit","Floating P/L","Risk %","Margin Used","Correlation Group","Strategy","Open Time","Trade Quality","Action Recommendation"], rows.map((r) => [esc(r.account), esc(r.broker), esc(r.instrument), esc(r.direction), esc(r.lotSize), esc(r.entryPrice), fmt(r.currentPrice), fmt(r.stopLoss), fmt(r.takeProfit), money(r.floatingPL), fmt(r.riskPercent, "%"), money(r.marginUsed), esc(r.correlationGroup), esc(r.strategy), time(r.openTime), pill(r.tradeQuality), pill(r.actionRecommendation)]), "No live open positions are currently synced.")}</section>`;
}

function exposure(rows) {
  return `<section class="pi-panel"><div class="pi-panel-head"><div><h2>Portfolio Exposure Analysis</h2><p>Exposure by instrument, currency, asset class, broker, account, strategy, direction, correlation group and session.</p></div><b>${rows.length} BUCKETS</b></div>${table(["Type","Key","Long Exposure","Short Exposure","Net Exposure","Exposure %","Risk %","Margin Contribution"], rows.map((r) => [esc(r.type), esc(r.key), money(r.longExposure), money(r.shortExposure), money(r.netExposure), fmt(r.exposurePercent, "%"), fmt(r.riskPercent, "%"), money(r.marginContribution)]), "No exposure rows exist because there are no live open positions.")}</section>`;
}

function equity(draw) {
  const rows = draw.equityCurve || [];
  return `<section class="pi-panel"><div class="pi-panel-head"><div><h2>Drawdown & Equity Intelligence</h2><p>Balance curve, equity curve, drawdown, recovery factor, volatility and cash-flow markers.</p></div><b>${draw.hasHistory ? "LIVE HISTORY" : "NO HISTORY"}</b></div>${draw.hasHistory ? `<div class="pi-chart">${rows.map((point, index) => `<span style="height:${Math.max(6, Math.min(100, Number(point.value || 0) / Math.max(...rows.map((p) => Number(p.value || 1))) * 100))}%" title="${time(point.time)} / ${money(point.value)}"></span>`).join("")}</div><div class="pi-mini-grid">${[["Max Drawdown", fmt(draw.maxDrawdown, "%")],["Recovery Factor", fmt(draw.recoveryFactor)],["Equity Volatility", money(draw.equityVolatility)],["Markers", draw.markers.length]].map(([a,b]) => `<article><small>${a}</small><strong>${b}</strong></article>`).join("")}</div>` : `<p class="pi-muted">${esc(draw.message)}</p>`}</section>`;
}

function strategies(rows) {
  return `<section class="pi-panel"><div class="pi-panel-head"><div><h2>Strategy Performance Panel</h2><p>Trade quality and profitability by strategy from production closed trades.</p></div><b>${rows.length} STRATEGIES</b></div>${table(["Strategy Name","Trades","Win Rate","Profit Factor","Average R","Expectancy","Drawdown","Net Profit","Risk Contribution","Status"], rows.map((r) => [esc(r.strategyName), esc(r.trades), fmt(r.winRate, "%"), esc(r.profitFactor), esc(r.averageR), esc(r.expectancy), fmt(r.drawdown, "%"), money(r.netProfit), esc(r.riskContribution), pill(r.status)]), "Strategy metrics require synced or imported closed trades.")}</section>`;
}

function risk(rows) {
  return `<section class="pi-panel"><div class="pi-panel-head"><div><h2>Risk Concentration Panel</h2><p>Currency, instrument, lot size, margin, drawdown and prop-firm breach concentration.</p></div><b>${rows.length} RISKS</b></div>${table(["Severity","Type","Subject","Message","Recommended Action"], rows.map((r) => [pill(r.severity), esc(r.type), esc(r.subject), esc(r.message), esc(r.recommendedAction)]), "No high concentration risk detected from current live portfolio records.")}</section>`;
}

function prop(rows) {
  return `<section class="pi-panel"><div class="pi-panel-head"><div><h2>Prop Firm Compliance Integration</h2><p>Live prop firm account rules, drawdown usage, profit target and breach risk.</p></div><b>${rows.length} ACCOUNTS</b></div>${rows.length ? table(["Firm","Account","Phase","Daily Loss Used","Max Drawdown Used","Profit Target Progress","Minimum Trading Days","News Restriction Risk","Breach Risk","Compliance Status"], rows.map((r) => [esc(r.firm), esc(r.account), esc(r.phase), fmt(r.dailyLossUsed), fmt(r.maxDrawdownUsed), fmt(r.profitTargetProgress, "%"), esc(r.minimumTradingDays), esc(r.newsRestrictionRisk), fmt(r.breachRisk, "%"), pill(r.complianceStatus)]), "") : `<div class="pi-empty-inline"><h3>No prop firm account connected.</h3><p>Connect a prop firm account or assign rules to an account to enable compliance monitoring.</p><button data-route="/workspace/data-sources-validation/prop-firm-rules">Open Prop Firm Rules</button></div>`}</section>`;
}

function alerts(rows) {
  return `<section class="pi-panel"><div class="pi-panel-head"><div><h2>Alerts</h2><p>Portfolio drawdown, margin, exposure, correlation, prop-firm and account sync alerts.</p></div><button data-action="create-alert">Create Alert</button></div>${table(["Severity","Title","Message","Created"], rows.map((r) => [pill(r.severity), esc(r.title), esc(r.message), time(r.createdAt)]), "No active portfolio intelligence alerts.")}</section>`;
}

function ai(ai) {
  return `<section class="pi-panel pi-ai"><div class="pi-panel-head"><div><h2>AI Portfolio Interpretation</h2><p>Production-data explanation of health, exposure, drawdown, strategies and recommended actions.</p></div><div class="pi-actions"><button data-action="recalculate">Regenerate Summary</button><button data-action="journal">Save to Journal</button><button data-action="export">Export Brief</button><button data-action="create-alert">Create Alert</button></div></div><p>${esc(ai.narrative)}</p><ul>${ai.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></section>`;
}

function drawer(account) {
  return `<aside class="pi-drawer"><button data-action="close-drawer">x</button><p>ACCOUNT DETAIL</p><h2>${esc(account.account)}</h2><div class="pi-drawer-grid">${[["Broker Details", account.broker],["Server", account.server],["Equity Snapshot", money(account.equity)],["Balance", money(account.balance)],["Open Positions", account.openTrades],["Risk Breakdown", account.riskScore],["Exposure Breakdown", account.marginUsed ? money(account.marginUsed) : "No open margin"],["Drawdown History", `${account.drawdown}%`],["Strategy Attribution", "Production closed trades only"],["Prop Firm Rule Status", "Use Prop Firm panel"],["Recent Sync Logs", time(account.lastSync)],["Audit History", "Audit logs enabled"]].map(([a,b]) => `<span><small>${a}</small><strong>${fmt(b)}</strong></span>`).join("")}</div><h3>Recommended Actions</h3><p>${account.healthStatus === "Healthy" || account.healthStatus === "Good" ? "Account is currently within normal portfolio risk limits." : "Review drawdown, margin and account sync health before continuing trading."}</p><div class="pi-actions"><button data-action="sync">Sync Account</button><button data-route="/workspace/data-sources-validation/broker-data">Open Broker Data</button><button data-route="/workspace/data-sources-validation/prop-firm-rules">Open Prop Firm Rules</button><button data-action="create-alert">Create Alert</button><button data-action="export">Export Account Report</button></div></aside>`;
}

export function renderPortfolioIntelligenceCenter(data) {
  return `<section class="pi-dashboard">${header(data)}${summaryCards(data.summary)}${emptyState(data)}${inputs(data.inputs)}${accounts(data.accounts)}${positions(data.openPositions)}<div class="pi-grid">${exposure(data.exposure)}${equity(data.equityDrawdown)}</div><div class="pi-grid">${strategies(data.strategies)}${risk(data.riskConcentration)}</div>${prop(data.propCompliance)}${alerts(data.alerts)}${ai(data.aiSummary)}</section>`;
}

function downloadJson(name, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function bindPortfolioIntelligenceCenter(data) {
  const root = document.querySelector("#intelligence-content");
  const refresh = () => mountPortfolioIntelligenceCenter();
  root.querySelector('[data-action="refresh"]')?.addEventListener("click", refresh);
  root.querySelectorAll('[data-action="sync"]').forEach((button) => button.addEventListener("click", () => post("/api/market-intelligence/portfolio-intelligence/sync-accounts").then(refresh)));
  root.querySelectorAll('[data-action="recalculate"],[data-action="journal"]').forEach((button) => button.addEventListener("click", () => post("/api/market-intelligence/portfolio-intelligence/recalculate").then(refresh)));
  root.querySelectorAll('[data-action="create-alert"]').forEach((button) => button.addEventListener("click", () => post("/api/market-intelligence/portfolio-intelligence/alerts", { title: "Operator portfolio alert", message: "Manual portfolio alert created from Portfolio Intelligence Center", severity: "warning" }).then(refresh)));
  root.querySelectorAll('[data-action="export"]').forEach((button) => button.addEventListener("click", async () => downloadJson("portfolio-intelligence-report.json", await request("/api/market-intelligence/portfolio-intelligence/export"))));
  root.querySelector('[data-action="configure"]')?.addEventListener("click", () => window.dispatchEvent(new CustomEvent("mi:navigate", { detail: { route: "/workspace/data-sources-validation/account-portfolio" } })));
  root.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => window.dispatchEvent(new CustomEvent("mi:navigate", { detail: { route: button.dataset.route } }))));
  root.querySelectorAll("[data-account]").forEach((button) => button.addEventListener("click", () => {
    document.querySelector(".pi-drawer")?.remove();
    document.body.insertAdjacentHTML("beforeend", drawer(data.accounts[Number(button.dataset.account)]));
    document.querySelector(".pi-drawer").querySelector('[data-action="close-drawer"]').addEventListener("click", () => document.querySelector(".pi-drawer")?.remove());
    document.querySelector(".pi-drawer").querySelectorAll("[data-route]").forEach((routeButton) => routeButton.addEventListener("click", () => window.dispatchEvent(new CustomEvent("mi:navigate", { detail: { route: routeButton.dataset.route } }))));
    document.querySelector(".pi-drawer").querySelectorAll('[data-action="sync"]').forEach((syncButton) => syncButton.addEventListener("click", () => post("/api/market-intelligence/portfolio-intelligence/sync-accounts").then(refresh)));
    document.querySelector(".pi-drawer").querySelectorAll('[data-action="create-alert"]').forEach((alertButton) => alertButton.addEventListener("click", () => post("/api/market-intelligence/portfolio-intelligence/alerts", { accountId: data.accounts[Number(button.dataset.account)].id, title: "Account risk review", message: "Review account portfolio risk.", severity: "warning" }).then(refresh)));
    document.querySelector(".pi-drawer").querySelectorAll('[data-action="export"]').forEach((exportButton) => exportButton.addEventListener("click", () => downloadJson("portfolio-account-report.json", data.accounts[Number(button.dataset.account)])));
  }));
}

export async function mountPortfolioIntelligenceCenter() {
  const root = document.querySelector("#intelligence-content");
  try {
    root.innerHTML = `<section class="pi-dashboard"><section class="pi-panel"><h1>Portfolio Intelligence Center</h1><p>Loading live portfolio intelligence...</p></section></section>`;
    const data = await request("/api/market-intelligence/portfolio-intelligence");
    if (!ownsRoute()) return;
    root.innerHTML = renderPortfolioIntelligenceCenter(data);
    bindPortfolioIntelligenceCenter(data);
    if (portfolioIntelligenceTimer) clearInterval(portfolioIntelligenceTimer);
    portfolioIntelligenceTimer = setInterval(() => {
      if (!document.hidden && ownsRoute()) mountPortfolioIntelligenceCenter();
    }, 30000);
  } catch (reason) {
    root.innerHTML = `<section class="pi-dashboard"><section class="pi-panel pi-error"><h1>Portfolio Intelligence Center</h1><p>${esc(reason.message)}</p><button class="primary" id="pi-retry">Retry</button></section></section>`;
    document.querySelector("#pi-retry")?.addEventListener("click", mountPortfolioIntelligenceCenter);
  }
}
