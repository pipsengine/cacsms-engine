import { initEnterpriseSidebar } from "./enterprise-sidebar.js";

const API = "http://localhost:8080";
const dashboardRoute = "/api/universe-scanner/dashboard";
const slug = location.pathname.split("/").filter(Boolean).at(-1) || "dashboard";
let state = { loading: true, error: "", data: null, action: "" };

const sectionTitles = {
  universe: "Asset Universe Registry",
  "currency-strength": "Currency Strength Engine",
  "trend-scanner": "Trend Scanner",
  "market-structure": "Market Structure Scanner",
  momentum: "Momentum Scanner",
  volatility: "Volatility Scanner",
  liquidity: "Liquidity Scanner",
  institutional: "Institutional Scanner",
  sentiment: "Sentiment Scanner",
  macro: "Macro Scanner",
  "economic-events": "Economic Event Scanner",
  risk: "Risk Scanner",
  "prop-compliance": "Prop Firm Compliance Scanner",
  opportunities: "Opportunity Ranking Engine",
  "qualified-trades": "Qualified Trades Center",
  "ai-insights": "AI Opportunity Discovery",
  "control-center": "Scanner Control Center",
  logs: "Scanner Logs & Diagnostics",
  "test-harness": "Scanner Test Harness"
};

const summaryCards = [
  ["assetsScanned", "Assets Scanned"],
  ["activeAssets", "Active Assets"],
  ["qualifiedOpportunities", "Qualified Opportunities"],
  ["watchlistOpportunities", "Watchlist Opportunities"],
  ["rejectedAssets", "Rejected Assets"],
  ["blockedAssets", "Blocked Assets"],
  ["eliteOpportunities", "Elite Opportunities"],
  ["highRiskAssets", "High Risk Assets"],
  ["averageOpportunityScore", "Average Opportunity Score"],
  ["averageConfidenceScore", "Average Confidence Score"],
  ["scannerHealthScore", "Scanner Health Score"],
  ["card3ReadinessScore", "Card 3 Readiness Score"]
];

const fmt = value => value === null || value === undefined || value === "" ? "No record" : value;
const pct = value => value === null || value === undefined || value === "" ? "No record" : `${value}%`;
const dt = value => value ? new Date(value).toLocaleString() : "No record";
const duration = value => value === null || value === undefined ? "No record" : value >= 1000 ? `${Math.round(value / 1000)}s` : `${value}ms`;
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const badgeClass = value => String(value || "").toLowerCase().replaceAll(/\s+/g, "-");

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function actionButton(label, action, extraClass = "") {
  return `<button class="${extraClass}" type="button" data-dashboard-action="${action}">${label}</button>`;
}

function table(headers, rows, emptyText) {
  if (!rows?.length) return `<div class="scanner-empty-inline">${emptyText}</div>`;
  return `<div class="scanner-table-wrap"><table class="scanner-table"><thead><tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function renderHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div>
      <p class="scanner-eyebrow">Card 03 / Executive Overview</p>
      <h1>20-Asset Universe Scanner Dashboard</h1>
      <p>Monitor live opportunity discovery, asset ranking, scanner health, confidence scores, and trade qualification across the selected asset universe.</p>
    </div>
    <aside class="scanner-badge-panel">
      <span>Production Live</span>
      <span>Mock Data Disabled</span>
      <span>Live Assets Only</span>
      <strong>Last Scan: ${dt(badges.lastScan)}</strong>
      <strong>Scanner Status: ${fmt(badges.scannerStatus)}</strong>
      <strong>Card 3 Readiness: ${fmt(badges.card3Readiness)}</strong>
    </aside>
    <div class="scanner-action-bar">
      ${actionButton("Run Universe Scan", "run-scan", "primary")}
      ${actionButton("Refresh Dashboard", "refresh")}
      <a href="/workspace/universe-scanner/control-center">Open Control Center</a>
      <a href="/workspace/universe-scanner/opportunities">Open Opportunity Ranking</a>
      <a href="${API}${dashboardRoute}/export" target="_blank" rel="noreferrer">Export Scanner Report</a>
    </div>
  </section>`;
}

function renderSummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${summaryCards.map(([key, label]) => `
    <article class="scanner-kpi">
      <span>${label}</span>
      <strong>${fmt(summary[key])}</strong>
      <small>${key.includes("Score") ? "Production score" : "Production records only"}</small>
    </article>`).join("")}</section>`;
}

function renderPipeline(data) {
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Scanner Pipeline Status</h2><span>${data.pipeline?.length || 0} modules</span></div>
    <div class="scanner-pipeline-status">${(data.pipeline || []).map(item => `
      <article>
        <strong>${esc(item.moduleName)}</strong>
        <span class="scanner-status ${badgeClass(item.status)}">${esc(item.status)}</span>
        <small>Last Run: ${dt(item.lastRun)}</small>
        <small>Records: ${fmt(item.recordsProcessed)}</small>
        <small>Duration: ${duration(item.durationMs)}</small>
        <small>Health: ${fmt(item.health)}</small>
      </article>`).join("")}</div></section>`;
}

function renderAssets(data) {
  const rows = (data.assets || []).map(row => `<tr>
    <td>${esc(row.asset)}</td><td>${esc(row.assetClass)}</td><td>${esc(row.brokerSymbol)}</td><td>${esc(row.status)}</td>
    <td>${fmt(row.lastPrice)}</td><td>${fmt(row.spread)}</td>
    <td>${fmt(row.trendScore)}</td><td>${fmt(row.momentumScore)}</td><td>${fmt(row.volatilityScore)}</td><td>${fmt(row.liquidityScore)}</td>
    <td>${fmt(row.institutionalScore)}</td><td>${fmt(row.sentimentScore)}</td><td>${fmt(row.macroScore)}</td><td>${fmt(row.riskScore)}</td>
    <td>${fmt(row.complianceScore)}</td><td>${fmt(row.confidenceScore)}</td><td>${fmt(row.opportunityScore)}</td>
    <td><span class="scanner-status ${badgeClass(row.qualification)}">${esc(row.qualification)}</span></td><td>${dt(row.lastScanned)}</td>
  </tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Asset Universe Overview</h2><span>${data.assets?.length || 0} assets</span></div>
    ${table(["Asset","Asset Class","Broker Symbol","Status","Last Price","Spread","Trend","Momentum","Volatility","Liquidity","Institutional","Sentiment","Macro","Risk","Compliance","Confidence","Opportunity","Qualification","Last Scanned"], rows, "No production asset scan records are available.")}</section>`;
}

function opportunityList(title, rows) {
  return `<article class="scanner-panel"><h2>${title}</h2>${table(["Rank","Asset","Direction","Opportunity","Confidence","Risk","Main Reason"], (rows || []).map(row => `<tr><td>${row.rank}</td><td>${esc(row.asset)}</td><td>${esc(row.direction)}</td><td>${fmt(row.opportunityScore)}</td><td>${fmt(row.confidence)}</td><td>${fmt(row.riskScore)}</td><td>${esc(row.mainReason || "No record")}</td></tr>`), "No production candidates in this category.")}</article>`;
}

function renderTopOpportunities(data) {
  const top = data.topOpportunities || {};
  return `<section class="scanner-grid scanner-grid-opportunities">
    ${opportunityList("Top Buy Candidates", top.topBuyCandidates)}
    ${opportunityList("Top Sell Candidates", top.topSellCandidates)}
    ${opportunityList("Top Institutional Setups", top.topInstitutionalSetups)}
    ${opportunityList("Top Prop-Safe Opportunities", top.topPropSafeOpportunities)}
    ${opportunityList("Top High-Confidence Assets", top.topHighConfidenceAssets)}
  </section>`;
}

function renderRejected(data) {
  const rows = (data.rejected || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.reason || "No record")}</td><td>${esc(row.blockingModule || "No record")}</td><td>${esc(row.severity || "No record")}</td><td>${fmt(row.riskScore)}</td><td>${fmt(row.complianceScore)}</td><td>${esc(row.recommendedAction || "No record")}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Rejected / Blocked Assets</h2><span>${data.rejected?.length || 0} records</span></div>
    ${table(["Asset","Reason","Blocking Module","Severity","Risk Score","Compliance Score","Recommended Action"], rows, "No rejected or blocked production assets are recorded.")}</section>`;
}

function renderHealth(data) {
  const health = data.health;
  const items = health ? [
    ["Scanner Status", health.scannerStatus],
    ["Worker Status", health.workerStatus],
    ["Queue Status", health.queueStatus],
    ["Last Full Scan", dt(health.lastFullScan)],
    ["Average Scan Duration", duration(health.averageScanDurationMs)],
    ["Failed Scan Jobs", health.failedScanJobs],
    ["Retry Count", health.retryCount],
    ["Data Freshness", health.dataFreshness],
    ["Source Health", health.sourceHealth],
    ["Dependency Health", health.dependencyHealth]
  ] : [];
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Scanner Health</h2><span>${health ? pct(health.healthScore) : "No record"}</span></div>
    ${items.length ? `<div class="scanner-health-grid">${items.map(([label, value]) => `<div><span>${label}</span><strong>${fmt(value)}</strong></div>`).join("")}</div>` : `<div class="scanner-empty-inline">No production scanner health metrics are available.</div>`}</section>`;
}

function renderDistribution(data) {
  const rows = data.distribution || [];
  const max = Math.max(...rows.map(row => Number(row.count || 0)), 0);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Opportunity Score Distribution</h2><span>Production records</span></div>
    ${max === 0 ? `<div class="scanner-empty-inline">No distribution can be drawn because no scan results exist.</div>` : `<div class="scanner-distribution">${rows.map(row => `<div><span>${esc(row.qualification)}</span><strong>${row.count}</strong><i style="width:${Math.round((row.count / max) * 100)}%"></i></div>`).join("")}</div>`}</section>`;
}

function renderReadiness(data) {
  const readiness = data.readiness || {};
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Card 3 Output Readiness</h2><span>${fmt(readiness.status)} / ${pct(readiness.score)}</span></div>
    <div class="scanner-readiness">${(readiness.checks || []).map(check => `<article><span class="scanner-status ${badgeClass(check.status)}">${esc(check.status)}</span><strong>${esc(check.name)}</strong></article>`).join("")}</div>
    <div class="scanner-output-state"><strong>Output:</strong> ${fmt(readiness.status === "Ready" ? "Ready For Next Card" : readiness.status)}</div></section>`;
}

function renderAiSummary(data) {
  const ai = data.aiSummary;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Universe Scanner Interpretation</h2><span>${ai ? `Generated ${dt(ai.generatedAt)}` : "No record"}</span></div>
    ${ai ? `<div class="scanner-ai-grid">
      <article><span>Best Opportunities</span><strong>${esc(ai.bestOpportunities || "No record")}</strong></article>
      <article><span>Weakest Assets</span><strong>${esc(ai.weakestAssets || "No record")}</strong></article>
      <article><span>Main Market Theme</span><strong>${esc(ai.mainMarketTheme || "No record")}</strong></article>
      <article><span>Risk Warnings</span><strong>${esc(ai.riskWarnings || "No record")}</strong></article>
      <article><span>Scanner Confidence</span><strong>${pct(ai.scannerConfidence)}</strong></article>
      <article><span>Readiness For Next Card</span><strong>${esc(ai.readinessForNextCard || "No record")}</strong></article>
      <article><span>Recommended Next Action</span><strong>${esc(ai.recommendedNextAction || "No record")}</strong></article>
      <p>${esc(ai.summary || "")}</p>
    </div>` : `<div class="scanner-empty-inline">No production AI scanner summary has been generated.</div>`}
    <div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "regenerate-summary")}${actionButton("Save to Logs", "save-summary")}${actionButton("Create Alert", "create-alert")}${actionButton("Export Brief", "export")}</div>
  </section>`;
}

function renderEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "No universe scan has been completed yet.")}</h2><p>${esc(empty.message || "Run a live universe scan to evaluate assets, rank opportunities, and generate qualified trade candidates.")}</p>
    <div class="scanner-action-bar">${actionButton("Run Universe Scan", "run-scan", "primary")}<a href="/workspace/universe-scanner/universe">Open Universe Registry</a><a href="/workspace/universe-scanner/control-center">Open Control Center</a><a href="/workspace/universe-scanner/test-harness">Run Test Harness</a></div></section>`;
}

function renderDashboard() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-blue"><section class="scanner-empty-state"><h2>Loading Universe Scanner Dashboard</h2><p>Reading production scanner records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load scanner dashboard</h2><p>${esc(state.error)}</p>${actionButton("Retry", "reload", "primary")}</section></main>`;
    bindActions();
    return;
  }
  const isEmpty = data.status === "EMPTY" || !data.assets?.length;
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-blue scanner-dashboard">
    ${renderHeader(data)}
    ${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}
    ${renderSummary(data)}
    ${isEmpty ? renderEmpty(data) : ""}
    ${renderPipeline(data)}
    ${renderAssets(data)}
    ${renderTopOpportunities(data)}
    <section class="scanner-grid scanner-grid-2">${renderHealth(data)}${renderDistribution(data)}</section>
    ${renderRejected(data)}
    ${renderReadiness(data)}
    ${renderAiSummary(data)}
  </main>`;
  bindActions();
}

function renderSectionPlaceholder() {
  const title = sectionTitles[slug] || "20-Asset Universe Scanner";
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-slate"><section class="scanner-hero"><div><p class="scanner-eyebrow">Card 03 / Sub-function</p><h1>${title}</h1><p>This sub-function will be implemented from its detailed page specification. The dashboard is now production-data wired.</p></div><aside><span>Route</span><strong>/workspace/universe-scanner/${slug}</strong><small>Awaiting detailed implementation prompt</small></aside></section></main>`;
}

async function loadDashboard() {
  state = { ...state, loading: true, error: "", action: "" };
  renderDashboard();
  try {
    state.data = await fetchJson(dashboardRoute);
  } catch (reason) {
    state.error = reason.message || "Unable to load scanner dashboard.";
  } finally {
    state.loading = false;
    renderDashboard();
  }
}

async function runAction(action) {
  if (action === "reload") return loadDashboard();
  if (action === "export") return window.open(`${API}${dashboardRoute}/export`, "_blank", "noopener,noreferrer");
  const endpoint = action === "regenerate-summary" || action === "save-summary" ? action : action;
  state.action = action;
  try {
    await fetchJson(`${dashboardRoute}/${endpoint}`, { method: "POST", body: JSON.stringify({ title: "Universe scanner dashboard alert" }) });
    await loadDashboard();
  } catch (reason) {
    state.error = reason.message || `Unable to run ${action}.`;
    renderDashboard();
  }
}

function bindActions() {
  document.querySelectorAll("[data-dashboard-action]").forEach(button => {
    button.addEventListener("click", () => runAction(button.dataset.dashboardAction));
  });
}

initEnterpriseSidebar("universe-nav");
if (slug === "dashboard") loadDashboard(); else renderSectionPlaceholder();

const nigeriaTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
setInterval(() => document.querySelector("#utc-clock").textContent = `WAT ${nigeriaTime.format(new Date())}`, 1000);
