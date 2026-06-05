const API = "http://localhost:8080";
let brokerLiquidityRefreshTimer = null;

function ownsCurrentRoute() {
  return location.pathname.endsWith("/broker-liquidity");
}

export function unmountBrokerLiquidityCenter() {
  if (brokerLiquidityRefreshTimer) {
    clearInterval(brokerLiquidityRefreshTimer);
    brokerLiquidityRefreshTimer = null;
  }
  document.querySelector(".bl-drawer")?.remove();
}

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function fmt(value, suffix = "") {
  if (value == null || value === "") return "Insufficient Data";
  return `${esc(value)}${suffix}`;
}

function time(value) {
  return value ? new Date(value).toLocaleString() : "Insufficient Data";
}

function stateClass(value) {
  const normalized = String(value || "").toLowerCase().replaceAll(" ", "-").replaceAll("_", "-");
  if (/excellent|good|safe|healthy|live|ready|normal/.test(normalized)) return "good";
  if (/weak|caution|warning|elevated|low/.test(normalized)) return "warn";
  if (/poor|critical|avoid|risk|failed/.test(normalized)) return "bad";
  return "neutral";
}

function table(headers, rows, emptyMessage) {
  const body = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${headers.length}" class="bl-empty-cell">${esc(emptyMessage || "No live production records available.")}</td></tr>`;
  return `<div class="bl-table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function pill(value) {
  return `<b class="bl-pill ${stateClass(value)}">${esc(value || "Insufficient Data")}</b>`;
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
  const summary = data.summary;
  const badges = [
    ["Production Live", "Enabled"],
    ["Mock Data Disabled", summary.mockDataDisabled ? "Yes" : "No"],
    ["Live Broker Feeds Only", summary.sourceMode],
    ["Last Liquidity Check", time(summary.lastLiquidityCheck)],
    ["Liquidity Confidence Score", summary.liquidityConfidenceScore == null ? "Insufficient Data" : `${summary.liquidityConfidenceScore}%`]
  ];
  return `<header class="bl-header">
    <div>
      <p class="bl-eyebrow">MARKET INTELLIGENCE / BROKER LIQUIDITY</p>
      <h1>Broker Liquidity Intelligence Center</h1>
      <p>Monitor broker-side liquidity, spreads, slippage, execution quality, depth, and tradeability conditions across connected accounts and broker feeds.</p>
      <div class="bl-badges">${badges.map(([label, value]) => `<span><small>${label}</small><strong>${esc(value)}</strong></span>`).join("")}</div>
    </div>
    <div class="bl-actions">
      <button class="primary" data-action="refresh">Refresh Liquidity</button>
      <button data-action="sync">Sync Broker Feeds</button>
      <button data-action="run-check">Run Liquidity Check</button>
      <button data-action="configure">Configure Brokers</button>
      <button data-action="export">Export Report</button>
    </div>
  </header>`;
}

function summaryCards(summary) {
  const cards = [
    ["Overall Liquidity Score", summary.overallLiquidityScore == null ? summary.overallLiquidity : `${summary.overallLiquidityScore}%`, summary.overallLiquidity],
    ["Best Broker Liquidity", summary.bestBrokerLiquidity, "Connected brokers only"],
    ["Worst Broker Liquidity", summary.worstBrokerLiquidity, "Connected brokers only"],
    ["Average Spread", summary.averageSpread, "Live bid/ask records"],
    ["Spread Widening Alerts", summary.spreadWideningAlerts, "Open alerts"],
    ["Average Slippage", summary.averageSlippage, "Execution records"],
    ["Execution Quality", summary.executionQuality, "Fill and speed score"],
    ["Rejected Orders", summary.rejectedOrders, "Reject percentage total"],
    ["High-Risk Instruments", summary.highRiskInstruments, "Avoid/caution/news risk"],
    ["News Liquidity Risk", summary.newsLiquidityRisk, "Calendar and sentiment"],
    ["Session Liquidity Risk", summary.sessionLiquidityRisk, "Current session records"],
    ["Connected Broker Feeds", summary.connectedBrokerFeeds, "Live feed count"]
  ];
  return `<section class="bl-summary">${cards.map(([label, value, note]) => `<article class="${stateClass(value)}"><small>${esc(label)}</small><strong>${fmt(value)}</strong><span>${esc(note)}</span></article>`).join("")}</section>`;
}

function emptyState(data) {
  if (!data.emptyState) return "";
  const actions = [
    ["Open Broker Data", "/workspace/data-sources-validation/broker-data"],
    ["Configure Broker Feeds", "/workspace/data-sources-validation/source-configuration"],
    ["Open Source Registry", "/workspace/data-sources-validation/source-configuration"],
    ["Run Source Health Review", "/workspace/market-intelligence/source-health-review"]
  ];
  return `<section class="bl-panel bl-empty-state"><h2>${esc(data.emptyState.title)}</h2><p>${esc(data.emptyState.message)}</p><div class="bl-actions">${actions.map(([label, route], index) => `<button class="${index === 0 ? "primary" : ""}" data-route="${route}">${label}</button>`).join("")}</div></section>`;
}

function inputPanel(inputs) {
  return `<section class="bl-panel"><div class="bl-panel-head"><div><h2>Input Dependency Panel</h2><p>Each unavailable input reduces the broker liquidity confidence score.</p></div><b>LIVE INPUTS</b></div>${table(["Input","Provider / Broker","Server","Status","Freshness","Health","Weight","Last Updated","Used In Liquidity Score"], inputs.map((row) => [esc(row.input), esc(row.provider), esc(row.server), pill(row.status), esc(row.freshness), pill(row.health), esc(row.weight), time(row.lastUpdated), row.usedInLiquidityScore ? "Yes" : "No"]), "Input unavailable. Broker liquidity confidence score reduced.")}</section>`;
}

function brokerTable(rows) {
  return `<section class="bl-panel"><div class="bl-panel-head"><div><h2>Broker Liquidity Table</h2><p>Connected production broker feeds only. Rows open a detail drawer.</p></div><b>${rows.length} ROWS</b></div>${table(["Broker","Platform","Server","Account Type","Instrument","Bid","Ask","Spread","Average Spread","Spread Change","Slippage Avg","Execution Speed","Order Rejection %","Liquidity Score","Tradeability","Last Updated"], rows.map((row, index) => [`<button class="bl-link" data-row="${index}">${esc(row.broker)}</button>`, esc(row.platform), esc(row.server), esc(row.accountType), esc(row.instrument), fmt(row.bid), fmt(row.ask), fmt(row.spread), fmt(row.averageSpread), fmt(row.spreadChange, "%"), fmt(row.slippageAvg), fmt(row.executionSpeedMs, " ms"), fmt(row.orderRejectionPercent, "%"), pill(row.liquidityLabel), pill(row.tradeability), time(row.lastUpdated)]), "No connected live broker liquidity rows are available.")}</section>`;
}

function spreadPanel(rows) {
  return `<section class="bl-panel"><div class="bl-panel-head"><div><h2>Spread Intelligence Panel</h2><p>Current, historical and news-window spread behaviour by broker and instrument.</p></div><b>${rows.length} RECORDS</b></div>${table(["Broker","Instrument","Account Type","Session","News Window","Current Spread","Average Spread","Minimum","Maximum","Percentile","Widening %","Stability","Alert Status"], rows.map((row) => [esc(row.broker), esc(row.instrument), esc(row.accountType), esc(row.session), esc(row.newsWindow), fmt(row.currentSpread), fmt(row.averageSpread), fmt(row.minimumSpread), fmt(row.maximumSpread), fmt(row.spreadPercentile, "%"), fmt(row.spreadWideningPercent, "%"), pill(row.spreadStability), pill(row.alertStatus)]), "No live spread history has been recorded.")}</section>`;
}

function executionPanel(rows) {
  return `<section class="bl-panel"><div class="bl-panel-head"><div><h2>Slippage & Execution Quality Panel</h2><p>Slippage, speed, rejection, partial fill, timeout, requote and modification-failure quality.</p></div><b>${rows.length} RECORDS</b></div>${table(["Broker","Instrument","Order Type","Avg Slippage","Execution Time","Reject Rate","Positive","Negative","Partial Fills","Timeouts","Requotes","Mod Failures","Fill Quality","Risk Level"], rows.map((row) => [esc(row.broker), esc(row.instrument), esc(row.orderType), fmt(row.averageSlippage), fmt(row.executionTimeMs, " ms"), fmt(row.rejectRate, "%"), fmt(row.positiveSlippage), fmt(row.negativeSlippage), fmt(row.partialFills), fmt(row.timeouts), fmt(row.requotes), fmt(row.modificationFailures), pill(row.fillQuality), pill(row.riskLevel)]), "No live execution or slippage logs have been recorded.")}</section>`;
}

function comparisonPanel(rows) {
  return `<section class="bl-panel"><div class="bl-panel-head"><div><h2>Broker Comparison Matrix</h2><p>Connected brokers only, ranked by normalized broker liquidity score.</p></div><b>${rows.length} BROKERS</b></div>${table(["Broker","Spread","Slippage","Execution Speed","Reject Rate","Latency","Depth Availability","News Performance","Session Stability","Overall Liquidity Score"], rows.map((row) => [esc(row.broker), fmt(row.spread), fmt(row.slippage), fmt(row.executionSpeedMs, " ms"), fmt(row.rejectRate, "%"), fmt(row.latencyMs, " ms"), fmt(row.depthAvailability, "%"), pill(row.newsPerformance), pill(row.sessionStability), pill(row.overallLiquidity)]), "No connected brokers are available for comparison.")}</section>`;
}

function sessionPanel(rows) {
  return `<section class="bl-panel"><div class="bl-panel-head"><div><h2>Session Liquidity Panel</h2><p>Sydney, Tokyo, London, New York, overlap, rollover, weekend close and market open conditions.</p></div><b>SESSION MODEL</b></div>${table(["Session","Broker","Instrument","Average Spread","Liquidity Condition","Slippage Risk","Execution Quality","Volatility Risk","Recommended Action"], rows.map((row) => [esc(row.session), esc(row.broker), esc(row.instrument), fmt(row.averageSpread), pill(row.liquidityCondition), pill(row.slippageRisk), pill(row.executionQuality), pill(row.volatilityRisk), esc(row.recommendedAction)]), "No live session liquidity records have been recorded.")}</section>`;
}

function newsPanel(rows) {
  return `<section class="bl-panel"><div class="bl-panel-head"><div><h2>News Liquidity Risk Panel</h2><p>High-impact news windows, spread widening, liquidity drops, rejection risk and prop firm restrictions.</p></div><b>${rows.length} EVENTS</b></div>${table(["Event / News","Currency","Affected Instruments","Time","Risk Window","Liquidity Risk","Trading Recommendation","Prop Restriction"], rows.map((row) => [esc(row.event), esc(row.currency), esc((row.affectedInstruments || []).join(", ")), time(row.time), esc(row.riskWindow), pill(row.liquidityRisk), esc(row.tradingRecommendation), row.propFirmRestriction ? "Yes" : "No"]), "No live economic-calendar or news-liquidity risk records have been recorded.")}</section>`;
}

function alertsPanel(rows) {
  return `<section class="bl-panel"><div class="bl-panel-head"><div><h2>Liquidity Alerts</h2><p>Info, warning, high-risk and critical broker liquidity alerts.</p></div><button data-action="create-alert">Create Alert</button></div>${table(["Severity","Broker","Instrument","Title","Message","Created"], rows.map((row) => [pill(row.severity), esc(row.broker), esc(row.instrument), esc(row.title), esc(row.message), time(row.createdAt)]), "No live broker liquidity alerts are open.")}</section>`;
}

function aiPanel(summary) {
  return `<section class="bl-panel bl-ai"><div class="bl-panel-head"><div><h2>AI Broker Liquidity Interpretation</h2><p>Operational interpretation derived only from live broker liquidity records.</p></div><div class="bl-actions"><button data-action="ai-summary">Regenerate Summary</button><button data-action="journal">Save to Journal</button><button data-action="export">Export Brief</button><button data-action="create-alert">Create Alert</button></div></div><p>${esc(summary.narrative)}</p><ul>${summary.bullets.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>`;
}

function drawer(row) {
  const breakdown = [
    ["Liquidity Score", row.liquidityLabel],
    ["Spread Stability", row.spreadStability],
    ["Spread Widening Risk", row.spreadWideningRisk],
    ["Slippage Risk", row.slippageRisk],
    ["Execution Quality", row.executionQuality],
    ["Order Rejection Risk", row.orderRejectionRisk],
    ["Depth Availability", row.depthAvailability],
    ["Session Risk", row.sessionLiquidity],
    ["News Risk", row.newsLiquidityRisk],
    ["Tradeability Score", row.brokerTradeabilityScore]
  ];
  return `<aside class="bl-drawer"><button class="bl-drawer-close" data-action="close-drawer">x</button><p>BROKER / INSTRUMENT DETAIL</p><h2>${esc(row.broker)} / ${esc(row.instrument)}</h2><div class="bl-drawer-grid">${[
    ["Broker Profile", row.broker],
    ["Platform", row.platform],
    ["Server", row.server],
    ["Account Type", row.accountType],
    ["Current Bid/Ask", `${row.bid ?? "Insufficient Data"} / ${row.ask ?? "Insufficient Data"}`],
    ["Current Spread", row.spread],
    ["Historical Spread Trend", row.averageSpread == null ? "Insufficient Data" : `Average ${row.averageSpread}`],
    ["Slippage History", row.slippageAvg],
    ["Execution Logs", row.executionSpeedMs == null ? "Insufficient Data" : `${row.executionSpeedMs} ms`],
    ["Rejected Orders", row.orderRejectionPercent == null ? "Insufficient Data" : `${row.orderRejectionPercent}%`],
    ["Latency History", row.executionSpeedMs == null ? "Insufficient Data" : `${row.executionSpeedMs} ms`],
    ["News Risk", row.newsLiquidityRisk],
    ["Session Risk", row.sessionLiquidity]
  ].map(([label, value]) => `<span><small>${label}</small><strong>${fmt(value)}</strong></span>`).join("")}</div><h3>Liquidity Score Breakdown</h3><div class="bl-breakdown">${breakdown.map(([label, value]) => `<span><small>${label}</small>${pill(value)}</span>`).join("")}</div><h3>Recommended Actions</h3><p>${row.tradeability === "Safe to Trade" ? "Broker liquidity is currently acceptable based on available live records." : "Review spread, slippage, news and session risk before routing execution to this broker."}</p><div class="bl-actions"><button data-action="run-check">Run Liquidity Check</button><button data-route="/workspace/data-sources-validation/broker-data">Open Broker Data</button><button data-route="/workspace/market-intelligence/source-health-review">Open Source Health</button><button data-action="create-alert">Create Alert</button><button data-action="export">Export Broker Report</button></div></aside>`;
}

export function renderBrokerLiquidityCenter(data) {
  return `<section class="bl-dashboard">
    ${header(data)}
    ${summaryCards(data.summary)}
    ${emptyState(data)}
    ${inputPanel(data.inputs)}
    ${brokerTable(data.brokers)}
    <div class="bl-grid">${spreadPanel(data.spreads)}${executionPanel(data.execution)}</div>
    ${comparisonPanel(data.comparison)}
    <div class="bl-grid">${sessionPanel(data.sessions)}${newsPanel(data.newsRisk)}</div>
    ${alertsPanel(data.alerts)}
    ${aiPanel(data.aiSummary)}
  </section>`;
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function bindBrokerLiquidityCenter(data) {
  const root = document.querySelector("#intelligence-content");
  const refresh = () => mountBrokerLiquidityCenter();
  root.querySelector('[data-action="refresh"]')?.addEventListener("click", refresh);
  root.querySelector('[data-action="sync"]')?.addEventListener("click", () => post("/api/market-intelligence/broker-data/sync").then(refresh));
  root.querySelector('[data-action="run-check"]')?.addEventListener("click", () => post("/api/market-intelligence/broker-liquidity/run-check").then(refresh));
  root.querySelector('[data-action="ai-summary"]')?.addEventListener("click", () => post("/api/market-intelligence/broker-liquidity/recalculate").then(refresh));
  root.querySelector('[data-action="journal"]')?.addEventListener("click", () => post("/api/market-intelligence/broker-liquidity/recalculate").then(refresh));
  root.querySelectorAll('[data-action="create-alert"]').forEach((button) => button.addEventListener("click", () => post("/api/market-intelligence/broker-liquidity/alerts", { title: "Operator broker liquidity alert", message: "Manual alert created from Broker Liquidity Intelligence Center", severity: "warning" }).then(refresh)));
  root.querySelectorAll('[data-action="export"]').forEach((button) => button.addEventListener("click", async () => downloadJson("broker-liquidity-report.json", await request("/api/market-intelligence/broker-liquidity/export"))));
  root.querySelector('[data-action="configure"]')?.addEventListener("click", () => window.dispatchEvent(new CustomEvent("mi:navigate", { detail: { route: "/workspace/data-sources-validation/source-configuration" } })));
  root.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => window.dispatchEvent(new CustomEvent("mi:navigate", { detail: { route: button.dataset.route } }))));
  root.querySelectorAll("[data-row]").forEach((button) => button.addEventListener("click", () => {
    document.querySelector(".bl-drawer")?.remove();
    document.body.insertAdjacentHTML("beforeend", drawer(data.brokers[Number(button.dataset.row)]));
    document.querySelector(".bl-drawer").querySelectorAll("[data-route]").forEach((routeButton) => routeButton.addEventListener("click", () => window.dispatchEvent(new CustomEvent("mi:navigate", { detail: { route: routeButton.dataset.route } }))));
    document.querySelector(".bl-drawer").querySelectorAll('[data-action="run-check"]').forEach((runButton) => runButton.addEventListener("click", () => post("/api/market-intelligence/broker-liquidity/run-check").then(refresh)));
    document.querySelector(".bl-drawer").querySelectorAll('[data-action="create-alert"]').forEach((alertButton) => alertButton.addEventListener("click", () => post("/api/market-intelligence/broker-liquidity/alerts", { broker: data.brokers[Number(button.dataset.row)].broker, instrument: data.brokers[Number(button.dataset.row)].instrument, title: "Broker instrument liquidity review", message: "Review broker liquidity conditions before execution.", severity: "warning" }).then(refresh)));
    document.querySelector(".bl-drawer").querySelectorAll('[data-action="export"]').forEach((exportButton) => exportButton.addEventListener("click", () => downloadJson("broker-liquidity-row.json", data.brokers[Number(button.dataset.row)])));
    document.querySelector('[data-action="close-drawer"]').addEventListener("click", () => document.querySelector(".bl-drawer")?.remove());
  }));
}

export async function mountBrokerLiquidityCenter() {
  const root = document.querySelector("#intelligence-content");
  try {
    root.innerHTML = `<section class="bl-dashboard"><section class="bl-panel"><h1>Broker Liquidity Intelligence Center</h1><p>Loading live broker liquidity records...</p></section></section>`;
    const dashboard = await request("/api/market-intelligence/broker-liquidity");
    if (!ownsCurrentRoute()) return;
    root.innerHTML = renderBrokerLiquidityCenter(dashboard);
    bindBrokerLiquidityCenter(dashboard);
    if (brokerLiquidityRefreshTimer) clearInterval(brokerLiquidityRefreshTimer);
    brokerLiquidityRefreshTimer = setInterval(() => {
      if (!document.hidden && ownsCurrentRoute()) mountBrokerLiquidityCenter();
    }, 30000);
  } catch (reason) {
    root.innerHTML = `<section class="bl-dashboard"><section class="bl-panel bl-error"><h1>Broker Liquidity Intelligence Center</h1><p>${esc(reason.message)}</p><button class="primary" id="bl-retry">Retry</button></section></section>`;
    document.querySelector("#bl-retry")?.addEventListener("click", mountBrokerLiquidityCenter);
  }
}
