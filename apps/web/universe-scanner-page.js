import { initEnterpriseSidebar } from "./enterprise-sidebar.js";

const API = "http://localhost:8080";
const dashboardRoute = "/api/universe-scanner/dashboard";
const universeRoute = "/api/universe-scanner/universe";
const currencyStrengthRoute = "/api/universe-scanner/currency-strength";
const trendScannerRoute = "/api/universe-scanner/trend-scanner";
const marketStructureRoute = "/api/universe-scanner/market-structure";
const momentumRoute = "/api/universe-scanner/momentum";
const volatilityRoute = "/api/universe-scanner/volatility";
const liquidityRoute = "/api/universe-scanner/liquidity";
const institutionalRoute = "/api/universe-scanner/institutional";
const macroRoute = "/api/universe-scanner/macro";
const economicEventsRoute = "/api/universe-scanner/economic-events";
const sentimentRoute = "/api/universe-scanner/sentiment";
const riskRoute = "/api/universe-scanner/risk";
const propComplianceRoute = "/api/universe-scanner/prop-compliance";
const opportunitiesRoute = "/api/universe-scanner/opportunities";
const qualifiedTradesRoute = "/api/universe-scanner/qualified-trades";
const aiInsightsRoute = "/api/universe-scanner/ai-insights";
const controlCenterRoute = "/api/universe-scanner/control-center";
const logsRoute = "/api/universe-scanner/logs";
const testHarnessRoute = "/api/universe-scanner/test-harness";
const slug = location.pathname.split("/").filter(Boolean).at(-1) || "dashboard";
let state = { loading: true, error: "", data: null, registry: null, action: "", drawer: null, detail: null };

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

const registrySummaryCards = [
  ["totalAssets", "Total Assets"],
  ["activeAssets", "Active Assets"],
  ["inactiveAssets", "Inactive Assets"],
  ["scanEnabled", "Scan Enabled"],
  ["scanDisabled", "Scan Disabled"],
  ["mappedBrokerSymbols", "Mapped Broker Symbols"],
  ["unmappedAssets", "Unmapped Assets"],
  ["assetsMissingPriceFeed", "Assets Missing Price Feed"],
  ["assetsMissingHistoricalData", "Assets Missing Historical Data"],
  ["blockedAssets", "Blocked Assets"],
  ["lastSyncStatus", "Last Sync Status"],
  ["registryHealthScore", "Registry Health Score"]
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

function renderAiInsightSummary(data) {
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

function renderCurrencyHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Currency Strength</p><h1>Currency Strength Engine</h1><p>Analyze live currency strength, weakness, rotation, correlation, and forex opportunity bias across major currencies.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live FX Data Only</span><strong>Last Calculation: ${dt(badges.lastCalculation)}</strong><strong>Strength Confidence Score: ${pct(badges.strengthConfidenceScore)}</strong></aside>
    <div class="scanner-action-bar">${actionButton("Refresh Strength", "currency-reload", "primary")}${actionButton("Recalculate Strength", "currency-recalculate")}${actionButton("Sync Price Feeds", "sync-price-feeds")}<a href="${API}${currencyStrengthRoute}/export" target="_blank" rel="noreferrer">Export Report</a><a href="/workspace/universe-scanner/opportunities">Open Opportunity Ranking</a></div>
  </section>`;
}

function renderCurrencySummary(data) {
  const s = data.summary || {};
  const cards = [["strongestCurrency", "Strongest Currency"], ["weakestCurrency", "Weakest Currency"], ["mostImprovedCurrency", "Most Improved Currency"], ["mostWeakenedCurrency", "Most Weakened Currency"], ["bestBullishPair", "Best Bullish Pair"], ["bestBearishPair", "Best Bearish Pair"], ["highestRotationSignal", "Highest Rotation Signal"], ["highestDivergenceSignal", "Highest Divergence Signal"], ["averageStrengthConfidence", "Average Strength Confidence"], ["fxScanHealth", "FX Scan Health"]];
  return `<section class="scanner-kpis">${cards.map(([key, label]) => `<article class="scanner-kpi"><span>${label}</span><strong>${key.includes("Confidence") ? pct(s[key]) : fmt(s[key])}</strong><small>Live calculated records only</small></article>`).join("")}</section>`;
}

function renderCurrencyMatrix(data) {
  const rows = (data.matrix || []).map(row => `<tr><td>${esc(row.currency)}</td><td>${fmt(row.currentStrength)}</td><td>${fmt(row.previousStrength)}</td><td>${fmt(row.strengthChange)}</td><td>${fmt(row.momentum)}</td><td>${esc(row.trendDirection)}</td><td>${fmt(row.volatility)}</td><td>${pct(row.confidence)}</td><td>${dt(row.lastUpdated)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Currency Strength Matrix</h2><span>${data.matrix?.length || 0} currencies</span></div>${table(["Currency","Current Strength","Previous Strength","Strength Change","Momentum","Trend Direction","Volatility","Confidence","Last Updated"], rows, "No live currency strength records are available.")}</section>`;
}

function renderCurrencyPairs(data) {
  const rows = (data.pairs || []).map(row => `<tr><td>${row.rank}</td><td>${esc(row.pair)}</td><td>${esc(row.baseCurrency)}</td><td>${esc(row.quoteCurrency)}</td><td>${fmt(row.baseStrength)}</td><td>${fmt(row.quoteStrength)}</td><td>${fmt(row.strengthSpread)}</td><td>${esc(row.directionBias)}</td><td>${esc(row.trendAlignment)}</td><td>${esc(row.momentumAlignment)}</td><td>${esc(row.volatilityCondition)}</td><td>${fmt(row.opportunityScore)}</td><td>${pct(row.confidence)}</td><td><span class="scanner-status ${badgeClass(row.qualification)}">${esc(row.qualification)}</span></td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Currency Pair Ranking Table</h2><span>Strength Spread Engine</span></div>${table(["Rank","Pair","Base","Quote","Base Strength","Quote Strength","Strength Spread","Direction Bias","Trend Alignment","Momentum Alignment","Volatility","Opportunity","Confidence","Qualification"], rows, "No currency pair strength rankings have been calculated.")}</section>`;
}

function renderRotation(data) {
  const rows = (data.rotation || []).map(row => `<tr><td>${esc(row.currency)}</td><td>${fmt(row.previousRank)}</td><td>${fmt(row.currentRank)}</td><td>${fmt(row.rankChange)}</td><td>${esc(row.rotationType)}</td><td>${fmt(row.momentum)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Currency Rotation Panel</h2><span>${data.rotation?.length || 0} records</span></div>${table(["Currency","Previous Rank","Current Rank","Rank Change","Rotation Type","Momentum","Confidence"], rows, "No currency rotation records are available.")}</section>`;
}

function renderHeatmap(data) {
  const rows = (data.heatmap || []).map(row => `<tr><td>${esc(row.currency)}</td><td>${esc(row.timeframe)}</td><td>${fmt(row.strengthScore)}</td><td>${esc(row.direction)}</td><td>${pct(row.confidence)}</td><td><span class="scanner-status ${badgeClass(row.state)}">${esc(row.state)}</span></td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Strength Heatmap</h2><span>${data.heatmap?.length || 0} cells</span></div>${table(["Currency","Timeframe","Strength Score","Direction","Confidence","State"], rows, "No heatmap records exist for live FX data.")}</section>`;
}

function renderDivergence(data) {
  const rows = (data.divergence || []).map(row => `<tr><td>${esc(row.pair)}</td><td>${esc(row.currencyStrengthBias)}</td><td>${esc(row.priceDirection)}</td><td>${esc(row.divergenceType)}</td><td>${esc(row.severity)}</td><td>${esc(row.tradingInterpretation)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Correlation and Divergence Panel</h2><span>${data.divergence?.length || 0} divergences</span></div>${table(["Pair","Currency Strength Bias","Price Direction","Divergence Type","Severity","Trading Interpretation","Recommended Action"], rows, "No currency strength divergence records are available.")}</section>`;
}

function renderFxOpportunities(data) {
  const groups = data.opportunities || {};
  const list = (title, rows = []) => opportunityList(title, rows.map(row => ({ rank: row.rank, asset: row.pair, direction: row.direction, opportunityScore: row.opportunityScore, confidence: row.confidenceScore, riskScore: row.riskScore, mainReason: row.reason })));
  return `<section class="scanner-grid scanner-grid-opportunities">${list("Top Buy Forex Pairs", groups.topBuyForexPairs)}${list("Top Sell Forex Pairs", groups.topSellForexPairs)}${list("Neutral Pairs", groups.neutralPairs)}${list("Rejected Pairs", groups.rejectedPairs)}${list("Blocked Pairs", groups.blockedPairs)}</section>`;
}

function renderWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Currency Strength Calculation Weights</h2><span>Database configurable</span></div>${table(["Component","Weight","State","Updated"], rows, "No calculation weights are configured.")}</section>`;
}

function renderCurrencyAi(data) {
  const ai = data.aiSummary;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Currency Strength Interpretation</h2><span>${ai ? dt(ai.generatedAt) : "No record"}</span></div>
    ${ai ? `<div class="scanner-ai-grid"><article><span>Strongest Currencies</span><strong>${esc(ai.strongestCurrencies)}</strong></article><article><span>Weakest Currencies</span><strong>${esc(ai.weakestCurrencies)}</strong></article><article><span>Best Pair Combinations</span><strong>${esc(ai.bestPairCombinations)}</strong></article><article><span>Currency Rotation</span><strong>${esc(ai.currencyRotation)}</strong></article><article><span>Divergence Risks</span><strong>${esc(ai.divergenceRisks)}</strong></article><article><span>Opportunity Candidates</span><strong>${esc(ai.opportunityCandidates)}</strong></article><article><span>Pairs To Avoid</span><strong>${esc(ai.pairsToAvoid)}</strong></article><article><span>Scanner Readiness</span><strong>${esc(ai.scannerReadiness)}</strong></article><p>${esc(ai.summary)}</p></div>` : `<div class="scanner-empty-inline">No production AI currency strength interpretation has been generated.</div>`}
    <div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "currency-regenerate-summary")}${actionButton("Save to Logs", "currency-save-summary")}${actionButton("Create Alert", "currency-create-alert")}${actionButton("Export Brief", "currency-export")}</div></section>`;
}

function renderCurrencyAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.currency)}</td><td>${esc(row.pair)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Currency Strength Alerts</h2><span>${data.alerts?.length || 0} alerts</span></div>${table(["Type","Title","Severity","Currency","Pair","Status","Created"], rows, "No currency strength alerts are recorded.")}</section>`;
}

function renderCurrencyEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Currency strength cannot be calculated yet.")}</h2><p>${esc(empty.message || "Register FX assets, map broker symbols, sync live price feeds, and load historical data before running the Currency Strength Engine.")}</p><div class="scanner-action-bar"><a href="/workspace/universe-scanner/universe">Open Asset Universe Registry</a>${actionButton("Sync Broker Symbols", "currency-sync-broker")}<a href="/workspace/data-sources-validation/historical-data">Open Historical Data</a><a href="/workspace/universe-scanner/universe">Run Readiness Check</a></div></section>`;
}

function renderCurrencyStrength() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-violet"><section class="scanner-empty-state"><h2>Loading Currency Strength Engine</h2><p>Reading production FX strength records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderCurrencyHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Currency Strength Engine</h2><p>${esc(state.error)}</p>${actionButton("Retry", "currency-reload", "primary")}</section></main>`;
    bindActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-violet scanner-dashboard">
    ${renderCurrencyHeader(data)}
    ${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}
    ${renderCurrencySummary(data)}
    ${data.status === "EMPTY" ? renderCurrencyEmpty(data) : ""}
    ${renderCurrencyMatrix(data)}
    ${renderCurrencyPairs(data)}
    <section class="scanner-grid scanner-grid-2">${renderRotation(data)}${renderHeatmap(data)}</section>
    ${renderDivergence(data)}
    ${renderFxOpportunities(data)}
    <section class="scanner-grid scanner-grid-2">${renderWeights(data)}${renderCurrencyAlerts(data)}</section>
    ${renderCurrencyAi(data)}
  </main>`;
  bindActions();
}

async function loadCurrencyStrength() {
  state = { ...state, loading: true, error: "" };
  renderCurrencyStrength();
  try {
    state.data = await fetchJson(currencyStrengthRoute);
  } catch (reason) {
    state.error = reason.message || "Unable to load Currency Strength Engine.";
  } finally {
    state.loading = false;
    renderCurrencyStrength();
  }
}

function renderTrendHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Trend Scanner</p><h1>Trend Scanner Engine</h1><p>Scan live multi-timeframe trend direction, strength, alignment, continuation probability, and exhaustion risk across the active asset universe.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Assets Only</span><strong>Last Trend Scan: ${dt(badges.lastTrendScan)}</strong><strong>Trend Scanner Health: ${fmt(badges.trendScannerHealth)}</strong></aside>
    <div class="scanner-action-bar">${actionButton("Run Trend Scan", "trend-run-scan", "primary")}${actionButton("Refresh Trends", "trend-reload")}${actionButton("Recalculate Scores", "trend-recalculate")}${actionButton("Configure Trend Rules", "trend-configure")}<a href="${API}${trendScannerRoute}/export" target="_blank" rel="noreferrer">Export Report</a></div>
  </section>`;
}

function renderTrendSummary(data) {
  const s = data.summary || {};
  const cards = [["assetsScanned","Assets Scanned"],["strongUptrends","Strong Uptrends"],["weakUptrends","Weak Uptrends"],["strongDowntrends","Strong Downtrends"],["weakDowntrends","Weak Downtrends"],["rangeBoundAssets","Range-Bound Assets"],["breakoutCandidates","Breakout Candidates"],["breakdownCandidates","Breakdown Candidates"],["exhaustionRisks","Exhaustion Risks"],["averageTrendScore","Average Trend Score"],["averageTrendConfidence","Average Trend Confidence"],["trendScannerHealth","Trend Scanner Health"]];
  return `<section class="scanner-kpis">${cards.map(([key,label])=>`<article class="scanner-kpi"><span>${label}</span><strong>${key.includes("Confidence") ? pct(s[key]) : fmt(s[key])}</strong><small>Production trend records only</small></article>`).join("")}</section>`;
}

function tfCell(value) {
  return value ? `${esc(value.trendDirection)} / ${fmt(value.trendStrength)} / ${pct(value.confidence)}` : "No Data";
}

function renderTrendMatrix(data) {
  const frames = ["MN","W1","D1","H4","H1","M15"];
  const rows = (data.matrix || []).map(row => `<tr><td>${esc(row.asset)}</td>${frames.map(frame => `<td>${tfCell(row.timeframes?.[frame])}</td>`).join("")}<td>${esc(row.overallTrend)}</td><td>${fmt(row.trendAlignment)}</td><td>${fmt(row.trendScore)}</td><td>${pct(row.confidence)}</td><td>${dt(row.lastUpdated)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Multi-Timeframe Trend Matrix</h2><span>${data.matrix?.length || 0} assets</span></div>${table(["Asset",...frames,"Overall Trend","Trend Alignment","Trend Score","Confidence","Last Updated"], rows, "No multi-timeframe trend records are available.")}</section>`;
}

function renderTrendRankings(data) {
  const rows = (data.rankings || []).map(row => `<tr><td>${fmt(row.rank)}</td><td>${esc(row.asset)}</td><td>${esc(row.assetClass)}</td><td>${esc(row.overallTrend)}</td><td>${fmt(row.trendScore)}</td><td>${fmt(row.trendAlignment)}</td><td>${pct(row.continuationProbability)}</td><td>${pct(row.exhaustionRisk)}</td><td>${esc(row.breakoutBreakdownSignal)}</td><td>${pct(row.trendConfidence)}</td><td>${esc(row.opportunityImpact)}</td><td><span class="scanner-status ${badgeClass(row.qualification)}">${esc(row.qualification)}</span></td><td>${dt(row.lastScanned)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Trend Ranking Table</h2><span>${data.rankings?.length || 0} rankings</span></div>${table(["Rank","Asset","Asset Class","Overall Trend","Trend Score","Trend Alignment","Continuation","Exhaustion Risk","Breakout / Breakdown","Trend Confidence","Opportunity Impact","Qualification","Last Scanned"], rows, "No trend rankings have been calculated.")}</section>`;
}

function renderContinuation(data) {
  const rows = (data.continuation || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.direction)}</td><td>${fmt(row.trendScore)}</td><td>${esc(row.momentumSupport)}</td><td>${esc(row.volatilitySupport)}</td><td>${esc(row.structureSupport)}</td><td>${pct(row.continuationProbability)}</td><td>${pct(row.confidence)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Trend Continuation Panel</h2><span>${data.continuation?.length || 0} signals</span></div>${table(["Asset","Direction","Trend Score","Momentum Support","Volatility Support","Structure Support","Continuation","Confidence","Recommended Action"], rows, "No trend continuation signals are available.")}</section>`;
}

function renderExhaustion(data) {
  const rows = (data.exhaustion || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.direction)}</td><td>${esc(row.trendAge)}</td><td>${fmt(row.exhaustionScore)}</td><td>${esc(row.momentumDivergence)}</td><td>${esc(row.volatilityCompression)}</td><td>${esc(row.liquiditySweepRisk)}</td><td>${esc(row.reversalWarning)}</td><td>${esc(row.riskLevel)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Trend Exhaustion Panel</h2><span>${data.exhaustion?.length || 0} risks</span></div>${table(["Asset","Direction","Trend Age","Exhaustion Score","Momentum Divergence","Volatility Compression","Liquidity Sweep Risk","Reversal Warning","Risk Level"], rows, "No trend exhaustion records are available.")}</section>`;
}

function renderBreakouts(data) {
  const rows = (data.breakouts || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.signalType)}</td><td>${esc(row.direction)}</td><td>${fmt(row.breakLevel)}</td><td>${esc(row.confirmationStatus)}</td><td>${esc(row.falseBreakRisk)}</td><td>${fmt(row.opportunityScore)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Breakout / Breakdown Scanner</h2><span>${data.breakouts?.length || 0} signals</span></div>${table(["Asset","Signal Type","Direction","Break Level","Confirmation Status","False Break Risk","Opportunity Score","Confidence"], rows, "No breakout or breakdown signals are available.")}</section>`;
}

function renderTrendWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Trend Score Engine Weights</h2><span>Database configurable</span></div>${table(["Component","Weight","State","Updated"], rows, "No trend scanner weights are configured.")}</section>`;
}

function renderTrendAi(data) {
  const ai = data.aiSummary;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Trend Scanner Interpretation</h2><span>${ai ? dt(ai.generatedAt) : "No record"}</span></div>
    ${ai ? `<div class="scanner-ai-grid"><article><span>Strongest Trend Assets</span><strong>${esc(ai.strongestTrendAssets)}</strong></article><article><span>Weakest Trend Assets</span><strong>${esc(ai.weakestTrendAssets)}</strong></article><article><span>Best Continuation</span><strong>${esc(ai.bestContinuationOpportunities)}</strong></article><article><span>Exhaustion Risks</span><strong>${esc(ai.exhaustionRisks)}</strong></article><article><span>Breakout Candidates</span><strong>${esc(ai.breakoutCandidates)}</strong></article><article><span>Assets To Avoid</span><strong>${esc(ai.assetsToAvoid)}</strong></article><article><span>Scanner Confidence</span><strong>${pct(ai.scannerConfidence)}</strong></article><article><span>Recommended Next Step</span><strong>${esc(ai.recommendedNextStep)}</strong></article><p>${esc(ai.summary)}</p></div>` : `<div class="scanner-empty-inline">No production AI trend interpretation has been generated.</div>`}
    <div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "trend-regenerate-summary")}${actionButton("Save to Logs", "trend-save-summary")}${actionButton("Create Alert", "trend-create-alert")}${actionButton("Export Brief", "trend-export")}</div></section>`;
}

function renderTrendAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Trend Scanner Alerts</h2><span>${data.alerts?.length || 0} alerts</span></div>${table(["Type","Title","Severity","Asset","Status","Created"], rows, "No trend scanner alerts are recorded.")}</section>`;
}

function renderTrendEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Trend scanner cannot calculate trends yet.")}</h2><p>${esc(empty.message || "Register active assets, map broker symbols, sync historical candles, and run a live trend scan before viewing trend results.")}</p><div class="scanner-action-bar"><a href="/workspace/universe-scanner/universe">Open Asset Universe Registry</a><a href="/workspace/data-sources-validation/historical-data">Sync Historical Data</a>${actionButton("Run Trend Scan", "trend-run-scan", "primary")}<a href="/workspace/universe-scanner/control-center">Open Control Center</a></div></section>`;
}

function renderTrendScanner() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-blue"><section class="scanner-empty-state"><h2>Loading Trend Scanner Engine</h2><p>Reading production trend records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderTrendHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Trend Scanner Engine</h2><p>${esc(state.error)}</p>${actionButton("Retry", "trend-reload", "primary")}</section></main>`;
    bindActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-blue scanner-dashboard">
    ${renderTrendHeader(data)}
    ${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}
    ${renderTrendSummary(data)}
    ${data.status === "EMPTY" ? renderTrendEmpty(data) : ""}
    ${renderTrendMatrix(data)}
    ${renderTrendRankings(data)}
    <section class="scanner-grid scanner-grid-2">${renderContinuation(data)}${renderExhaustion(data)}</section>
    ${renderBreakouts(data)}
    <section class="scanner-grid scanner-grid-2">${renderTrendWeights(data)}${renderTrendAlerts(data)}</section>
    ${renderTrendAi(data)}
  </main>`;
  bindActions();
}

async function loadTrendScanner() {
  state = { ...state, loading: true, error: "" };
  renderTrendScanner();
  try {
    state.data = await fetchJson(trendScannerRoute);
  } catch (reason) {
    state.error = reason.message || "Unable to load Trend Scanner Engine.";
  } finally {
    state.loading = false;
    renderTrendScanner();
  }
}

function renderStructureHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Market Structure</p><h1>Market Structure Scanner Engine</h1><p>Scan live swing structure, break of structure, change of character, liquidity breaks, and structural shifts across the active asset universe.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Assets Only</span><strong>Last Structure Scan: ${dt(badges.lastStructureScan)}</strong><strong>Structure Scanner Health: ${fmt(badges.structureScannerHealth)}</strong></aside>
    <div class="scanner-action-bar">${actionButton("Run Structure Scan", "structure-run-scan", "primary")}${actionButton("Refresh Structure", "structure-reload")}${actionButton("Recalculate Scores", "structure-recalculate")}${actionButton("Configure Structure Rules", "structure-configure")}<a href="${API}${marketStructureRoute}/export" target="_blank" rel="noreferrer">Export Report</a></div>
  </section>`;
}

function renderStructureSummary(data) {
  const s = data.summary || {};
  const cards = [["assetsScanned","Assets Scanned"],["bullishStructures","Bullish Structures"],["bearishStructures","Bearish Structures"],["neutralStructures","Neutral Structures"],["rangeStructures","Range Structures"],["breakOfStructureSignals","Break of Structure Signals"],["changeOfCharacterSignals","Change of Character Signals"],["structureShiftAlerts","Structure Shift Alerts"],["liquidityBreakSignals","Liquidity Break Signals"],["structureQualifiedAssets","Structure Qualified Assets"],["averageStructureScore","Average Structure Score"],["averageStructureConfidence","Average Structure Confidence"],["scannerHealth","Scanner Health"]];
  return `<section class="scanner-kpis">${cards.map(([key,label])=>`<article class="scanner-kpi"><span>${label}</span><strong>${key.includes("Confidence") ? pct(s[key]) : fmt(s[key])}</strong><small>Production structure records only</small></article>`).join("")}</section>`;
}

function structureTfCell(value) {
  return value ? `${esc(value.structureDirection)} / ${esc(value.lastSwingStatus)} / ${esc(value.bosChochStatus)} / ${pct(value.confidence)}` : "No Data";
}

function renderStructureMatrix(data) {
  const frames = ["MN","W1","D1","H4","H1","M15"];
  const rows = (data.matrix || []).map(row => `<tr><td>${esc(row.asset)}</td>${frames.map(frame => `<td>${structureTfCell(row.timeframes?.[frame])}</td>`).join("")}<td>${esc(row.overallStructure)}</td><td>${fmt(row.structureAlignment)}</td><td>${fmt(row.structureScore)}</td><td>${pct(row.confidence)}</td><td>${dt(row.lastUpdated)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Multi-Timeframe Structure Matrix</h2><span>${data.matrix?.length || 0} assets</span></div>${table(["Asset",...frames,"Overall Structure","Structure Alignment","Structure Score","Confidence","Last Updated"], rows, "No multi-timeframe market structure records are available.")}</section>`;
}

function renderStructureRankings(data) {
  const rows = (data.rankings || []).map(row => `<tr><td>${fmt(row.rank)}</td><td>${esc(row.asset)}</td><td>${esc(row.assetClass)}</td><td>${esc(row.overallStructure)}</td><td>${esc(row.lastSwingPattern)}</td><td>${esc(row.latestSignal)}</td><td>${esc(row.signalDirection)}</td><td>${fmt(row.structureScore)}</td><td>${fmt(row.alignmentScore)}</td><td>${pct(row.confidence)}</td><td>${esc(row.opportunityImpact)}</td><td><span class="scanner-status ${badgeClass(row.qualification)}">${esc(row.qualification)}</span></td><td>${dt(row.lastScanned)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Structure Ranking Table</h2><span>${data.rankings?.length || 0} rankings</span></div>${table(["Rank","Asset","Asset Class","Overall Structure","Last Swing Pattern","Latest Signal","Signal Direction","Structure Score","Alignment Score","Confidence","Opportunity Impact","Qualification","Last Scanned"], rows, "No market structure rankings have been calculated.")}</section>`;
}

function renderBos(data) {
  const rows = (data.bos || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.timeframe)}</td><td>${esc(row.direction)}</td><td>${fmt(row.brokenLevel)}</td><td>${esc(row.breakType)}</td><td>${esc(row.confirmationType)}</td><td>${fmt(row.candleClose)}</td><td>${esc(row.retestStatus)}</td><td>${pct(row.confidence)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Break of Structure Panel</h2><span>${data.bos?.length || 0} signals</span></div>${table(["Asset","Timeframe","Direction","Broken Level","Break Type","Confirmation Type","Candle Close","Retest Status","Confidence","Recommended Action"], rows, "No BOS records are available.")}</section>`;
}

function renderChoch(data) {
  const rows = (data.choch || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.timeframe)}</td><td>${esc(row.previousStructure)}</td><td>${esc(row.newStructure)}</td><td>${fmt(row.chochLevel)}</td><td>${esc(row.confirmation)}</td><td>${pct(row.reversalProbability)}</td><td>${esc(row.riskLevel)}</td><td>${pct(row.confidence)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Change of Character Panel</h2><span>${data.choch?.length || 0} signals</span></div>${table(["Asset","Timeframe","Previous Structure","New Structure","CHOCH Level","Confirmation","Reversal Probability","Risk Level","Confidence","Recommended Action"], rows, "No CHOCH records are available.")}</section>`;
}

function renderSwingPoints(data) {
  const rows = (data.swingPoints || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.timeframe)}</td><td>${fmt(row.swingHigh)}</td><td>${dt(row.swingHighTime)}</td><td>${fmt(row.swingLow)}</td><td>${dt(row.swingLowTime)}</td><td>${fmt(row.currentPrice)}</td><td>${fmt(row.distanceToHigh)}</td><td>${fmt(row.distanceToLow)}</td><td>${esc(row.structureContext)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Swing Point Map</h2><span>${data.swingPoints?.length || 0} swing records</span></div>${table(["Asset","Timeframe","Swing High","Swing High Time","Swing Low","Swing Low Time","Current Price","Distance to High","Distance to Low","Structure Context"], rows, "No swing point records are available.")}</section>`;
}

function renderStructureWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Market Structure Engine Weights</h2><span>Database configurable</span></div>${table(["Component","Weight","State","Updated"], rows, "No structure scanner weights are configured.")}</section>`;
}

function renderStructureAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Market Structure Alerts</h2><span>${data.alerts?.length || 0} alerts</span></div>${table(["Type","Title","Severity","Asset","Status","Created"], rows, "No market structure alerts are recorded.")}</section>`;
}

function renderStructureAi(data) {
  const ai = data.aiSummary;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Market Structure Interpretation</h2><span>${ai ? dt(ai.generatedAt) : "No record"}</span></div>
    ${ai ? `<div class="scanner-ai-grid"><article><span>Strongest Bullish</span><strong>${esc(ai.strongestBullishStructures)}</strong></article><article><span>Strongest Bearish</span><strong>${esc(ai.strongestBearishStructures)}</strong></article><article><span>Recent BOS</span><strong>${esc(ai.recentBosSignals)}</strong></article><article><span>Recent CHOCH</span><strong>${esc(ai.recentChochSignals)}</strong></article><article><span>Potential Reversals</span><strong>${esc(ai.potentialReversals)}</strong></article><article><span>False Break Risks</span><strong>${esc(ai.falseBreakRisks)}</strong></article><article><span>Assets To Monitor</span><strong>${esc(ai.assetsToMonitor)}</strong></article><article><span>Assets To Avoid</span><strong>${esc(ai.assetsToAvoid)}</strong></article><article><span>Recommended Next Step</span><strong>${esc(ai.recommendedNextStep)}</strong></article><p>${esc(ai.summary)}</p></div>` : `<div class="scanner-empty-inline">No production AI market structure interpretation has been generated.</div>`}
    <div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "structure-regenerate-summary")}${actionButton("Save to Logs", "structure-save-summary")}${actionButton("Create Alert", "structure-create-alert")}${actionButton("Export Brief", "structure-export")}</div></section>`;
}

function renderStructureEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Market structure scanner cannot calculate structure yet.")}</h2><p>${esc(empty.message || "Register active assets, map broker symbols, sync historical candles, and run a live structure scan before viewing market structure results.")}</p><div class="scanner-action-bar"><a href="/workspace/universe-scanner/universe">Open Asset Universe Registry</a><a href="/workspace/data-sources-validation/historical-data">Sync Historical Data</a>${actionButton("Run Structure Scan", "structure-run-scan", "primary")}<a href="/workspace/universe-scanner/control-center">Open Control Center</a></div></section>`;
}

function renderMarketStructure() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-slate"><section class="scanner-empty-state"><h2>Loading Market Structure Scanner</h2><p>Reading production structure records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderStructureHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Market Structure Scanner</h2><p>${esc(state.error)}</p>${actionButton("Retry", "structure-reload", "primary")}</section></main>`;
    bindActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-slate scanner-dashboard">
    ${renderStructureHeader(data)}
    ${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}
    ${renderStructureSummary(data)}
    ${data.status === "EMPTY" ? renderStructureEmpty(data) : ""}
    ${renderStructureMatrix(data)}
    ${renderStructureRankings(data)}
    <section class="scanner-grid scanner-grid-2">${renderBos(data)}${renderChoch(data)}</section>
    ${renderSwingPoints(data)}
    <section class="scanner-grid scanner-grid-2">${renderStructureWeights(data)}${renderStructureAlerts(data)}</section>
    ${renderStructureAi(data)}
  </main>`;
  bindActions();
}

async function loadMarketStructure() {
  state = { ...state, loading: true, error: "" };
  renderMarketStructure();
  try {
    state.data = await fetchJson(marketStructureRoute);
  } catch (reason) {
    state.error = reason.message || "Unable to load Market Structure Scanner.";
  } finally {
    state.loading = false;
    renderMarketStructure();
  }
}

function renderMomentumHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Momentum</p><h1>Momentum Scanner Engine</h1><p>Scan live momentum strength, acceleration, deceleration, divergence, and exhaustion across the active asset universe.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Assets Only</span><strong>Last Momentum Scan: ${dt(badges.lastMomentumScan)}</strong><strong>Momentum Scanner Health: ${fmt(badges.momentumScannerHealth)}</strong></aside>
    <div class="scanner-action-bar">${actionButton("Run Momentum Scan", "momentum-run-scan", "primary")}${actionButton("Refresh Momentum", "momentum-reload")}${actionButton("Recalculate Scores", "momentum-recalculate")}${actionButton("Configure Momentum Rules", "momentum-configure")}<a href="${API}${momentumRoute}/export" target="_blank" rel="noreferrer">Export Report</a></div>
  </section>`;
}

function renderMomentumSummary(data) {
  const s = data.summary || {};
  const cards = [["assetsScanned","Assets Scanned"],["bullishMomentumAssets","Bullish Momentum Assets"],["bearishMomentumAssets","Bearish Momentum Assets"],["momentumAcceleration","Momentum Acceleration"],["momentumDeceleration","Momentum Deceleration"],["bullishDivergenceSignals","Bullish Divergence Signals"],["bearishDivergenceSignals","Bearish Divergence Signals"],["momentumExhaustionRisks","Momentum Exhaustion Risks"],["momentumConfirmedTrends","Momentum Confirmed Trends"],["momentumRejectedAssets","Momentum Rejected Assets"],["averageMomentumScore","Average Momentum Score"],["averageMomentumConfidence","Average Momentum Confidence"],["scannerHealth","Scanner Health"]];
  return `<section class="scanner-kpis">${cards.map(([key,label])=>`<article class="scanner-kpi"><span>${label}</span><strong>${key.includes("Confidence") ? pct(s[key]) : fmt(s[key])}</strong><small>Production momentum records only</small></article>`).join("")}</section>`;
}

function momentumTfCell(value) {
  return value ? `${esc(value.momentumDirection)} / ${fmt(value.momentumStrength)} / ${esc(value.accelerationState)} / ${pct(value.confidence)}` : "No Data";
}

function renderMomentumMatrix(data) {
  const frames = ["MN","W1","D1","H4","H1","M15"];
  const rows = (data.matrix || []).map(row => `<tr><td>${esc(row.asset)}</td>${frames.map(frame => `<td>${momentumTfCell(row.timeframes?.[frame])}</td>`).join("")}<td>${esc(row.overallMomentum)}</td><td>${fmt(row.momentumAlignment)}</td><td>${fmt(row.momentumScore)}</td><td>${pct(row.confidence)}</td><td>${dt(row.lastUpdated)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Multi-Timeframe Momentum Matrix</h2><span>${data.matrix?.length || 0} assets</span></div>${table(["Asset",...frames,"Overall Momentum","Momentum Alignment","Momentum Score","Confidence","Last Updated"], rows, "No multi-timeframe momentum records are available.")}</section>`;
}

function renderMomentumRankings(data) {
  const rows = (data.rankings || []).map(row => `<tr><td>${fmt(row.rank)}</td><td><button class="link-button" type="button" data-momentum-open="${esc(row.assetId || row.asset)}">${esc(row.asset)}</button></td><td>${esc(row.assetClass)}</td><td>${esc(row.overallMomentum)}</td><td>${fmt(row.momentumScore)}</td><td>${esc(row.momentumDirection)}</td><td>${esc(row.acceleration)}</td><td>${esc(row.deceleration)}</td><td>${esc(row.divergenceSignal)}</td><td>${esc(row.exhaustionRisk)}</td><td>${pct(row.confidence)}</td><td>${esc(row.opportunityImpact)}</td><td><span class="scanner-status ${badgeClass(row.qualification)}">${esc(row.qualification)}</span></td><td>${dt(row.lastScanned)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Momentum Ranking Table</h2><span>${data.rankings?.length || 0} rankings</span></div>${table(["Rank","Asset","Asset Class","Overall Momentum","Momentum Score","Momentum Direction","Acceleration","Deceleration","Divergence Signal","Exhaustion Risk","Confidence","Opportunity Impact","Qualification","Last Scanned"], rows, "No momentum rankings have been calculated.")}</section>`;
}

function renderMomentumAcceleration(data) {
  const rows = (data.acceleration || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.direction)}</td><td>${fmt(row.previousMomentum)}</td><td>${fmt(row.currentMomentum)}</td><td>${fmt(row.momentumChange)}</td><td>${fmt(row.accelerationScore)}</td><td>${esc(row.trendSupport)}</td><td>${esc(row.structureSupport)}</td><td>${pct(row.confidence)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Momentum Acceleration Panel</h2><span>${data.acceleration?.length || 0} signals</span></div>${table(["Asset","Direction","Previous Momentum","Current Momentum","Momentum Change","Acceleration Score","Trend Support","Structure Support","Confidence","Recommended Action"], rows, "No momentum acceleration signals are available.")}</section>`;
}

function renderMomentumDeceleration(data) {
  const rows = (data.deceleration || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.direction)}</td><td>${fmt(row.previousMomentum)}</td><td>${fmt(row.currentMomentum)}</td><td>${fmt(row.momentumChange)}</td><td>${fmt(row.decelerationScore)}</td><td>${esc(row.exhaustionRisk)}</td><td>${esc(row.riskLevel)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Momentum Deceleration Panel</h2><span>${data.deceleration?.length || 0} signals</span></div>${table(["Asset","Direction","Previous Momentum","Current Momentum","Momentum Change","Deceleration Score","Exhaustion Risk","Risk Level","Recommended Action"], rows, "No momentum deceleration signals are available.")}</section>`;
}

function renderMomentumDivergence(data) {
  const rows = (data.divergence || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.timeframe)}</td><td>${esc(row.divergenceType)}</td><td>${esc(row.pricePattern)}</td><td>${esc(row.indicatorPattern)}</td><td>${fmt(row.signalStrength)}</td><td>${esc(row.confirmationStatus)}</td><td>${esc(row.riskLevel)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Divergence Detection Panel</h2><span>${data.divergence?.length || 0} signals</span></div>${table(["Asset","Timeframe","Divergence Type","Price Pattern","Indicator Pattern","Signal Strength","Confirmation Status","Risk Level","Confidence"], rows, "No momentum divergence records are available.")}</section>`;
}

function renderMomentumExhaustion(data) {
  const rows = (data.exhaustion || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.direction)}</td><td>${esc(row.exhaustionType)}</td><td>${fmt(row.exhaustionScore)}</td><td>${esc(row.trendAge)}</td><td>${row.divergencePresent ? "Yes" : "No"}</td><td>${esc(row.liquidityRisk)}</td><td>${esc(row.reversalWarning)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Momentum Exhaustion Panel</h2><span>${data.exhaustion?.length || 0} risks</span></div>${table(["Asset","Direction","Exhaustion Type","Exhaustion Score","Trend Age","Divergence Present","Liquidity Risk","Reversal Warning","Confidence"], rows, "No momentum exhaustion records are available.")}</section>`;
}

function renderMomentumWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Momentum Engine Weights</h2><span>Database configurable</span></div>${table(["Component","Weight","State","Updated"], rows, "No momentum scanner weights are configured.")}</section>`;
}

function renderMomentumAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Momentum Alerts</h2><span>${data.alerts?.length || 0} alerts</span></div>${table(["Type","Title","Severity","Asset","Status","Created"], rows, "No momentum alerts are recorded.")}</section>`;
}

function renderMomentumAi(data) {
  const ai = data.aiSummary;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Momentum Scanner Interpretation</h2><span>${ai ? dt(ai.generatedAt) : "No record"}</span></div>
    ${ai ? `<div class="scanner-ai-grid"><article><span>Strongest Momentum Assets</span><strong>${esc(ai.strongestMomentumAssets)}</strong></article><article><span>Weakest Momentum Assets</span><strong>${esc(ai.weakestMomentumAssets)}</strong></article><article><span>Best Acceleration Opportunities</span><strong>${esc(ai.bestAccelerationOpportunities)}</strong></article><article><span>Deceleration Risks</span><strong>${esc(ai.decelerationRisks)}</strong></article><article><span>Divergence Warnings</span><strong>${esc(ai.divergenceWarnings)}</strong></article><article><span>Exhaustion Risks</span><strong>${esc(ai.exhaustionRisks)}</strong></article><article><span>Assets To Monitor</span><strong>${esc(ai.assetsToMonitor)}</strong></article><article><span>Assets To Avoid</span><strong>${esc(ai.assetsToAvoid)}</strong></article><article><span>Recommended Next Step</span><strong>${esc(ai.recommendedNextStep)}</strong></article><p>${esc(ai.summary)}</p></div>` : `<div class="scanner-empty-inline">No production AI momentum interpretation has been generated.</div>`}
    <div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "momentum-regenerate-summary")}${actionButton("Save to Logs", "momentum-save-summary")}${actionButton("Create Alert", "momentum-create-alert")}${actionButton("Export Brief", "momentum-export")}</div></section>`;
}

function renderMomentumDetailDrawer() {
  const detail = state.detail;
  if (!detail || slug !== "momentum") return "";
  const asset = detail.asset || {};
  const frames = Object.entries(detail.timeframeBreakdown || {});
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(asset.asset)} Momentum Detail</h2><button type="button" data-close-momentum-detail>Close</button></div>
    <section class="scanner-detail-grid">
      <article><span>Asset Profile</span><strong>${esc(asset.asset)}</strong><small>${esc(asset.assetClass)}</small></article>
      <article><span>Momentum Score Breakdown</span><strong>${fmt(asset.momentumScore)}</strong><small>Confidence ${pct(asset.confidence)}</small></article>
      <article><span>Momentum Direction</span><strong>${esc(asset.momentumDirection || asset.overallMomentum)}</strong></article>
      <article><span>Acceleration / Deceleration</span><strong>${esc(asset.acceleration)} / ${esc(asset.deceleration)}</strong></article>
      <article><span>Divergence / Exhaustion</span><strong>${esc(asset.divergenceSignal)} / ${esc(asset.exhaustionRisk)}</strong></article>
      <article><span>Qualification</span><strong>${esc(asset.qualification)}</strong></article>
    </section>
    ${table(["Timeframe","Direction","Strength","Acceleration","Confidence"], frames.map(([frame, row]) => `<tr><td>${esc(frame)}</td><td>${esc(row.momentumDirection)}</td><td>${fmt(row.momentumStrength)}</td><td>${esc(row.accelerationState)}</td><td>${pct(row.confidence)}</td></tr>`), "No timeframe momentum breakdown is available.")}
    <div class="scanner-action-bar compact"><button data-dashboard-action="momentum-recalculate">Recalculate Asset Momentum</button><a href="/workspace/universe-scanner/trend-scanner">Open Trend Scanner</a><a href="/workspace/universe-scanner/market-structure">Open Market Structure</a><a href="/workspace/universe-scanner/volatility">Open Volatility Scanner</a><a href="/workspace/universe-scanner/opportunities">Open Opportunity Ranking</a><button data-dashboard-action="momentum-create-alert">Create Alert</button><a href="${API}${momentumRoute}/export" target="_blank" rel="noreferrer">Export Detail</a></div>
  </aside><div class="scanner-drawer-backdrop" data-close-momentum-detail></div>`;
}

function renderMomentumEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Momentum scanner cannot calculate momentum yet.")}</h2><p>${esc(empty.message || "Register active assets, map broker symbols, sync historical candles, and run a live momentum scan before viewing momentum results.")}</p><div class="scanner-action-bar"><a href="/workspace/universe-scanner/universe">Open Asset Universe Registry</a><a href="/workspace/data-sources-validation/historical-data">Sync Historical Data</a>${actionButton("Run Momentum Scan", "momentum-run-scan", "primary")}<a href="/workspace/universe-scanner/control-center">Open Control Center</a></div></section>`;
}

function renderMomentum() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-green"><section class="scanner-empty-state"><h2>Loading Momentum Scanner</h2><p>Reading production momentum records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderMomentumHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Momentum Scanner</h2><p>${esc(state.error)}</p>${actionButton("Retry", "momentum-reload", "primary")}</section></main>`;
    bindMomentumActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-green scanner-dashboard">
    ${renderMomentumHeader(data)}
    ${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}
    ${renderMomentumSummary(data)}
    ${data.status === "EMPTY" ? renderMomentumEmpty(data) : ""}
    ${renderMomentumMatrix(data)}
    ${renderMomentumRankings(data)}
    <section class="scanner-grid scanner-grid-2">${renderMomentumAcceleration(data)}${renderMomentumDeceleration(data)}</section>
    ${renderMomentumDivergence(data)}
    ${renderMomentumExhaustion(data)}
    <section class="scanner-grid scanner-grid-2">${renderMomentumWeights(data)}${renderMomentumAlerts(data)}</section>
    ${renderMomentumAi(data)}
    ${renderMomentumDetailDrawer()}
  </main>`;
  bindMomentumActions();
}

async function openMomentumDetail(id) {
  try {
    state.detail = await fetchJson(`${momentumRoute}/${id}`);
    renderMomentum();
  } catch (reason) {
    state.error = reason.message || "Unable to open momentum detail.";
    renderMomentum();
  }
}

function bindMomentumActions() {
  bindActions();
  document.querySelectorAll("[data-momentum-open]").forEach(item => item.addEventListener("click", () => openMomentumDetail(item.dataset.momentumOpen)));
  document.querySelectorAll("[data-close-momentum-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderMomentum(); }));
}

async function loadMomentum() {
  state = { ...state, loading: true, error: "", detail: null };
  renderMomentum();
  try {
    state.data = await fetchJson(momentumRoute);
  } catch (reason) {
    state.error = reason.message || "Unable to load Momentum Scanner.";
  } finally {
    state.loading = false;
    renderMomentum();
  }
}

function renderVolatilityHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Volatility</p><h1>Volatility Scanner Engine</h1><p>Scan live volatility, ATR, ADR, expansion, compression, breakout readiness, and volatility risk across the active asset universe.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Assets Only</span><strong>Last Volatility Scan: ${dt(badges.lastVolatilityScan)}</strong><strong>Volatility Scanner Health: ${fmt(badges.volatilityScannerHealth)}</strong></aside>
    <div class="scanner-action-bar">${actionButton("Run Volatility Scan", "volatility-run-scan", "primary")}${actionButton("Refresh Volatility", "volatility-reload")}${actionButton("Recalculate Scores", "volatility-recalculate")}${actionButton("Configure Volatility Rules", "volatility-configure")}<a href="${API}${volatilityRoute}/export" target="_blank" rel="noreferrer">Export Report</a></div>
  </section>`;
}

function renderVolatilitySummary(data) {
  const s = data.summary || {};
  const cards = [["assetsScanned","Assets Scanned"],["highVolatilityAssets","High Volatility Assets"],["normalVolatilityAssets","Normal Volatility Assets"],["lowVolatilityAssets","Low Volatility Assets"],["volatilityExpansionAssets","Volatility Expansion Assets"],["volatilityCompressionAssets","Volatility Compression Assets"],["breakoutReadyAssets","Breakout-Ready Assets"],["abnormalVolatilityAlerts","Abnormal Volatility Alerts"],["tooVolatileAssets","Too Volatile Assets"],["averageVolatilityScore","Average Volatility Score"],["averageVolatilityConfidence","Average Volatility Confidence"],["scannerHealth","Scanner Health"]];
  return `<section class="scanner-kpis">${cards.map(([key,label])=>`<article class="scanner-kpi"><span>${label}</span><strong>${key.includes("Confidence") ? pct(s[key]) : fmt(s[key])}</strong><small>Production volatility records only</small></article>`).join("")}</section>`;
}

function volatilityTfCell(value) {
  return value ? `${fmt(value.atr)} / ${esc(value.volatilityState)} / ${esc(value.expansionCompressionState)} / ${pct(value.confidence)}` : "No Data";
}

function renderVolatilityMatrix(data) {
  const frames = ["MN","W1","D1","H4","H1","M15"];
  const rows = (data.matrix || []).map(row => `<tr><td>${esc(row.asset)}</td>${frames.map(frame => `<td>${volatilityTfCell(row.timeframes?.[frame])}</td>`).join("")}<td>${esc(row.overallVolatility)}</td><td>${esc(row.volatilityCondition)}</td><td>${fmt(row.volatilityScore)}</td><td>${pct(row.confidence)}</td><td>${dt(row.lastUpdated)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Multi-Timeframe Volatility Matrix</h2><span>${data.matrix?.length || 0} assets</span></div>${table(["Asset",...frames,"Overall Volatility","Volatility Condition","Volatility Score","Confidence","Last Updated"], rows, "No multi-timeframe volatility records are available.")}</section>`;
}

function renderVolatilityRankings(data) {
  const rows = (data.rankings || []).map(row => `<tr><td>${fmt(row.rank)}</td><td><button class="link-button" type="button" data-volatility-open="${esc(row.assetId || row.asset)}">${esc(row.asset)}</button></td><td>${esc(row.assetClass)}</td><td>${fmt(row.atr)}</td><td>${fmt(row.adr)}</td><td>${fmt(row.realizedVolatility)}</td><td>${fmt(row.volatilityRank)}</td><td>${fmt(row.volatilityPercentile)}</td><td>${fmt(row.expansionScore)}</td><td>${fmt(row.compressionScore)}</td><td>${esc(row.breakoutReadiness)}</td><td>${esc(row.abnormalRisk)}</td><td>${fmt(row.volatilityScore)}</td><td>${pct(row.confidence)}</td><td><span class="scanner-status ${badgeClass(row.qualification)}">${esc(row.qualification)}</span></td><td>${dt(row.lastScanned)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Volatility Ranking Table</h2><span>${data.rankings?.length || 0} rankings</span></div>${table(["Rank","Asset","Asset Class","ATR","ADR","Realized Volatility","Volatility Rank","Volatility Percentile","Expansion Score","Compression Score","Breakout Readiness","Abnormal Risk","Volatility Score","Confidence","Qualification","Last Scanned"], rows, "No volatility rankings have been calculated.")}</section>`;
}

function renderVolatilityExpansion(data) {
  const rows = (data.expansion || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.timeframe)}</td><td>${fmt(row.previousVolatility)}</td><td>${fmt(row.currentVolatility)}</td><td>${pct(row.expansionPercent)}</td><td>${fmt(row.expansionScore)}</td><td>${esc(row.trendSupport)}</td><td>${esc(row.momentumSupport)}</td><td>${esc(row.riskLevel)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Volatility Expansion Panel</h2><span>${data.expansion?.length || 0} signals</span></div>${table(["Asset","Timeframe","Previous Volatility","Current Volatility","Expansion %","Expansion Score","Trend Support","Momentum Support","Risk Level","Recommended Action"], rows, "No volatility expansion signals are available.")}</section>`;
}

function renderVolatilityCompression(data) {
  const rows = (data.compression || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.timeframe)}</td><td>${esc(row.compressionDuration)}</td><td>${fmt(row.currentRange)}</td><td>${fmt(row.averageRange)}</td><td>${pct(row.compressionPercent)}</td><td>${fmt(row.breakoutReadiness)}</td><td>${esc(row.liquidityContext)}</td><td>${pct(row.confidence)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Volatility Compression Panel</h2><span>${data.compression?.length || 0} signals</span></div>${table(["Asset","Timeframe","Compression Duration","Current Range","Average Range","Compression %","Breakout Readiness","Liquidity Context","Confidence","Recommended Action"], rows, "No volatility compression signals are available.")}</section>`;
}

function renderBreakoutReadiness(data) {
  const rows = (data.breakoutReadiness || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.setupType)}</td><td>${esc(row.timeframe)}</td><td>${fmt(row.compressionScore)}</td><td>${esc(row.liquiditySupport)}</td><td>${esc(row.momentumSupport)}</td><td>${esc(row.structureSupport)}</td><td>${fmt(row.breakoutReadinessScore)}</td><td>${esc(row.directionBias)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Breakout Readiness Panel</h2><span>${data.breakoutReadiness?.length || 0} setups</span></div>${table(["Asset","Setup Type","Timeframe","Compression Score","Liquidity Support","Momentum Support","Structure Support","Breakout Readiness Score","Direction Bias","Confidence"], rows, "No breakout readiness records are available.")}</section>`;
}

function renderAbnormalVolatilityRisk(data) {
  const rows = (data.abnormalRisk || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.riskType)}</td><td>${esc(row.timeframe)}</td><td>${fmt(row.currentVolatility)}</td><td>${fmt(row.normalVolatility)}</td><td>${fmt(row.deviation)}</td><td>${esc(row.severity)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Abnormal Volatility Risk Panel</h2><span>${data.abnormalRisk?.length || 0} alerts</span></div>${table(["Asset","Risk Type","Timeframe","Current Volatility","Normal Volatility","Deviation","Severity","Recommended Action"], rows, "No abnormal volatility risk records are available.")}</section>`;
}

function renderVolatilityWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Volatility Engine Weights</h2><span>Database configurable</span></div>${table(["Component","Weight","State","Updated"], rows, "No volatility scanner weights are configured.")}</section>`;
}

function renderVolatilityAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Volatility Alerts</h2><span>${data.alerts?.length || 0} alerts</span></div>${table(["Type","Title","Severity","Asset","Status","Created"], rows, "No volatility alerts are recorded.")}</section>`;
}

function renderVolatilityAi(data) {
  const ai = data.aiSummary;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Volatility Scanner Interpretation</h2><span>${ai ? dt(ai.generatedAt) : "No record"}</span></div>
    ${ai ? `<div class="scanner-ai-grid"><article><span>Most Volatile Assets</span><strong>${esc(ai.mostVolatileAssets)}</strong></article><article><span>Calmest Assets</span><strong>${esc(ai.calmestAssets)}</strong></article><article><span>Best Breakout-Ready Assets</span><strong>${esc(ai.bestBreakoutReadyAssets)}</strong></article><article><span>Too Volatile To Trade</span><strong>${esc(ai.assetsTooVolatileToTrade)}</strong></article><article><span>Compression Opportunities</span><strong>${esc(ai.compressionOpportunities)}</strong></article><article><span>Abnormal Volatility Risks</span><strong>${esc(ai.abnormalVolatilityRisks)}</strong></article><article><span>Assets To Monitor</span><strong>${esc(ai.assetsToMonitor)}</strong></article><article><span>Assets To Avoid</span><strong>${esc(ai.assetsToAvoid)}</strong></article><article><span>Recommended Next Step</span><strong>${esc(ai.recommendedNextStep)}</strong></article><p>${esc(ai.summary)}</p></div>` : `<div class="scanner-empty-inline">No production AI volatility interpretation has been generated.</div>`}
    <div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "volatility-regenerate-summary")}${actionButton("Save to Logs", "volatility-save-summary")}${actionButton("Create Alert", "volatility-create-alert")}${actionButton("Export Brief", "volatility-export")}</div></section>`;
}

function renderVolatilityDetailDrawer() {
  const detail = state.detail;
  if (!detail || slug !== "volatility") return "";
  const asset = detail.asset || {};
  const frames = Object.entries(detail.timeframeBreakdown || {});
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(asset.asset)} Volatility Detail</h2><button type="button" data-close-volatility-detail>Close</button></div>
    <section class="scanner-detail-grid">
      <article><span>Asset Profile</span><strong>${esc(asset.asset)}</strong><small>${esc(asset.assetClass)}</small></article>
      <article><span>ATR / ADR Snapshot</span><strong>${fmt(asset.atr)} / ${fmt(asset.adr)}</strong></article>
      <article><span>Realized Volatility</span><strong>${fmt(asset.realizedVolatility)}</strong></article>
      <article><span>Historical Volatility Percentile</span><strong>${fmt(asset.volatilityPercentile)}</strong></article>
      <article><span>Breakout Readiness</span><strong>${esc(asset.breakoutReadiness || asset.overallVolatility)}</strong></article>
      <article><span>Risk Warnings</span><strong>${esc(asset.abnormalRisk || asset.qualification)}</strong></article>
    </section>
    ${table(["Timeframe","ATR","Volatility State","Expansion / Compression","Confidence"], frames.map(([frame, row]) => `<tr><td>${esc(frame)}</td><td>${fmt(row.atr)}</td><td>${esc(row.volatilityState)}</td><td>${esc(row.expansionCompressionState)}</td><td>${pct(row.confidence)}</td></tr>`), "No timeframe volatility breakdown is available.")}
    <div class="scanner-action-bar compact"><button data-dashboard-action="volatility-recalculate">Recalculate Asset Volatility</button><a href="/workspace/universe-scanner/trend-scanner">Open Trend Scanner</a><a href="/workspace/universe-scanner/momentum">Open Momentum Scanner</a><a href="/workspace/universe-scanner/liquidity">Open Liquidity Scanner</a><a href="/workspace/universe-scanner/risk">Open Risk Scanner</a><a href="/workspace/universe-scanner/opportunities">Open Opportunity Ranking</a><button data-dashboard-action="volatility-create-alert">Create Alert</button><a href="${API}${volatilityRoute}/export" target="_blank" rel="noreferrer">Export Detail</a></div>
  </aside><div class="scanner-drawer-backdrop" data-close-volatility-detail></div>`;
}

function renderVolatilityEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Volatility scanner cannot calculate volatility yet.")}</h2><p>${esc(empty.message || "Register active assets, map broker symbols, sync historical candles, and run a live volatility scan before viewing volatility results.")}</p><div class="scanner-action-bar"><a href="/workspace/universe-scanner/universe">Open Asset Universe Registry</a><a href="/workspace/data-sources-validation/historical-data">Sync Historical Data</a>${actionButton("Run Volatility Scan", "volatility-run-scan", "primary")}<a href="/workspace/universe-scanner/control-center">Open Control Center</a></div></section>`;
}

function renderVolatility() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-amber"><section class="scanner-empty-state"><h2>Loading Volatility Scanner</h2><p>Reading production volatility records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderVolatilityHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Volatility Scanner</h2><p>${esc(state.error)}</p>${actionButton("Retry", "volatility-reload", "primary")}</section></main>`;
    bindVolatilityActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-amber scanner-dashboard">
    ${renderVolatilityHeader(data)}
    ${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}
    ${renderVolatilitySummary(data)}
    ${data.status === "EMPTY" ? renderVolatilityEmpty(data) : ""}
    ${renderVolatilityMatrix(data)}
    ${renderVolatilityRankings(data)}
    <section class="scanner-grid scanner-grid-2">${renderVolatilityExpansion(data)}${renderVolatilityCompression(data)}</section>
    ${renderBreakoutReadiness(data)}
    ${renderAbnormalVolatilityRisk(data)}
    <section class="scanner-grid scanner-grid-2">${renderVolatilityWeights(data)}${renderVolatilityAlerts(data)}</section>
    ${renderVolatilityAi(data)}
    ${renderVolatilityDetailDrawer()}
  </main>`;
  bindVolatilityActions();
}

async function openVolatilityDetail(id) {
  try {
    state.detail = await fetchJson(`${volatilityRoute}/${id}`);
    renderVolatility();
  } catch (reason) {
    state.error = reason.message || "Unable to open volatility detail.";
    renderVolatility();
  }
}

function bindVolatilityActions() {
  bindActions();
  document.querySelectorAll("[data-volatility-open]").forEach(item => item.addEventListener("click", () => openVolatilityDetail(item.dataset.volatilityOpen)));
  document.querySelectorAll("[data-close-volatility-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderVolatility(); }));
}

async function loadVolatility() {
  state = { ...state, loading: true, error: "", detail: null };
  renderVolatility();
  try {
    state.data = await fetchJson(volatilityRoute);
  } catch (reason) {
    state.error = reason.message || "Unable to load Volatility Scanner.";
  } finally {
    state.loading = false;
    renderVolatility();
  }
}

function renderLiquidityHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Liquidity</p><h1>Liquidity Scanner Engine</h1><p>Scan live buy-side and sell-side liquidity, stop clusters, liquidity sweeps, liquidity voids, equal highs/lows, spread risk, and execution liquidity across the active asset universe.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Assets Only</span><strong>Last Liquidity Scan: ${dt(badges.lastLiquidityScan)}</strong><strong>Liquidity Scanner Health: ${fmt(badges.liquidityScannerHealth)}</strong></aside>
    <div class="scanner-action-bar">${actionButton("Run Liquidity Scan", "liquidity-run-scan", "primary")}${actionButton("Refresh Liquidity", "liquidity-reload")}${actionButton("Recalculate Scores", "liquidity-recalculate")}${actionButton("Configure Liquidity Rules", "liquidity-configure")}<a href="${API}${liquidityRoute}/export" target="_blank" rel="noreferrer">Export Report</a></div>
  </section>`;
}

function renderLiquiditySummary(data) {
  const s = data.summary || {};
  const cards = [["assetsScanned","Assets Scanned"],["buySideLiquidityZones","Buy-Side Liquidity Zones"],["sellSideLiquidityZones","Sell-Side Liquidity Zones"],["equalHighZones","Equal High Zones"],["equalLowZones","Equal Low Zones"],["recentLiquiditySweeps","Recent Liquidity Sweeps"],["liquidityVoidAlerts","Liquidity Void Alerts"],["stopClusterAlerts","Stop Cluster Alerts"],["poorBrokerLiquidityAssets","Poor Broker Liquidity Assets"],["spreadRiskAssets","Spread Risk Assets"],["averageLiquidityScore","Average Liquidity Score"],["averageLiquidityConfidence","Average Liquidity Confidence"],["scannerHealth","Scanner Health"]];
  return `<section class="scanner-kpis">${cards.map(([key,label])=>`<article class="scanner-kpi"><span>${label}</span><strong>${key.includes("Confidence") ? pct(s[key]) : fmt(s[key])}</strong><small>Production liquidity records only</small></article>`).join("")}</section>`;
}

function liquidityTfCell(value) {
  return value ? `${esc(value.buySideStatus)} / ${esc(value.sellSideStatus)} / ${esc(value.sweepStatus)} / ${pct(value.confidence)}` : "No Data";
}

function renderLiquidityMatrix(data) {
  const frames = ["MN","W1","D1","H4","H1","M15"];
  const rows = (data.matrix || []).map(row => `<tr><td>${esc(row.asset)}</td>${frames.map(frame => `<td>${liquidityTfCell(row.timeframes?.[frame])}</td>`).join("")}<td>${esc(row.overallLiquidity)}</td><td>${fmt(row.liquidityScore)}</td><td>${esc(row.sweepRisk)}</td><td>${esc(row.executionRisk)}</td><td>${pct(row.confidence)}</td><td>${dt(row.lastUpdated)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Multi-Timeframe Liquidity Matrix</h2><span>${data.matrix?.length || 0} assets</span></div>${table(["Asset",...frames,"Overall Liquidity","Liquidity Score","Sweep Risk","Execution Risk","Confidence","Last Updated"], rows, "No multi-timeframe liquidity records are available.")}</section>`;
}

function renderLiquidityRankings(data) {
  const rows = (data.rankings || []).map(row => `<tr><td>${fmt(row.rank)}</td><td><button class="link-button" type="button" data-liquidity-open="${esc(row.assetId || row.asset)}">${esc(row.asset)}</button></td><td>${esc(row.assetClass)}</td><td>${fmt(row.nearestBuySideLiquidity)}</td><td>${fmt(row.nearestSellSideLiquidity)}</td><td>${esc(row.liquidityBias)}</td><td>${fmt(row.liquidityScore)}</td><td>${esc(row.sweepRisk)}</td><td>${esc(row.voidRisk)}</td><td>${esc(row.stopClusterRisk)}</td><td>${esc(row.brokerLiquidity)}</td><td>${esc(row.spreadRisk)}</td><td>${esc(row.executionRisk)}</td><td>${pct(row.confidence)}</td><td><span class="scanner-status ${badgeClass(row.qualification)}">${esc(row.qualification)}</span></td><td>${dt(row.lastScanned)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Liquidity Ranking Table</h2><span>${data.rankings?.length || 0} rankings</span></div>${table(["Rank","Asset","Asset Class","Nearest Buy-Side Liquidity","Nearest Sell-Side Liquidity","Liquidity Bias","Liquidity Score","Sweep Risk","Void Risk","Stop Cluster Risk","Broker Liquidity","Spread Risk","Execution Risk","Confidence","Qualification","Last Scanned"], rows, "No liquidity rankings have been calculated.")}</section>`;
}

function renderLiquidityZones(title, rows, empty) {
  const mapped = (rows || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.timeframe)}</td><td>${fmt(row.currentPrice)}</td><td>${fmt(row.liquidityLevel)}</td><td>${esc(row.liquidityType)}</td><td>${fmt(row.distance)}</td><td>${esc(row.strength)}</td><td>${pct(row.sweepProbability)}</td><td>${esc(row.trendContext)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>${title}</h2><span>${rows?.length || 0} zones</span></div>${table(["Asset","Timeframe","Current Price","Liquidity Level","Liquidity Type","Distance","Strength","Sweep Probability","Trend Context","Recommended Action"], mapped, empty)}</section>`;
}

function renderLiquiditySweeps(data) {
  const rows = (data.sweeps || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.timeframe)}</td><td>${esc(row.sweepType)}</td><td>${fmt(row.sweptLevel)}</td><td>${dt(row.sweepTime)}</td><td>${esc(row.confirmation)}</td><td>${pct(row.reversalProbability)}</td><td>${pct(row.continuationProbability)}</td><td>${pct(row.confidence)}</td><td>${esc(row.riskLevel)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Liquidity Sweep Panel</h2><span>${data.sweeps?.length || 0} sweeps</span></div>${table(["Asset","Timeframe","Sweep Type","Swept Level","Sweep Time","Confirmation","Reversal Probability","Continuation Probability","Confidence","Risk Level"], rows, "No liquidity sweep records are available.")}</section>`;
}

function renderLiquidityVoids(data) {
  const rows = (data.voids || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.timeframe)}</td><td>${esc(row.voidType)}</td><td>${esc(row.priceZone)}</td><td>${fmt(row.gapSize)}</td><td>${pct(row.fillProbability)}</td><td>${esc(row.direction)}</td><td>${esc(row.status)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Liquidity Void / Fair Value Gap Panel</h2><span>${data.voids?.length || 0} zones</span></div>${table(["Asset","Timeframe","Void Type","Price Zone","Gap Size","Fill Probability","Direction","Status","Confidence"], rows, "No liquidity void or FVG records are available.")}</section>`;
}

function renderStopClusters(data) {
  const rows = (data.stopClusters || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.clusterLocation)}</td><td>${fmt(row.priceLevel)}</td><td>${esc(row.clusterType)}</td><td>${fmt(row.distanceFromPrice)}</td><td>${esc(row.sweepRisk)}</td><td>${esc(row.riskLevel)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Stop Cluster Risk Panel</h2><span>${data.stopClusters?.length || 0} clusters</span></div>${table(["Asset","Cluster Location","Price Level","Cluster Type","Distance From Price","Sweep Risk","Risk Level","Recommended Action"], rows, "No stop cluster risk records are available.")}</section>`;
}

function renderBrokerLiquidityRisk(data) {
  const rows = (data.brokerRisk || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.broker)}</td><td>${esc(row.server)}</td><td>${fmt(row.currentSpread)}</td><td>${fmt(row.averageSpread)}</td><td>${pct(row.spreadWideningPercent)}</td><td>${fmt(row.brokerLiquidityScore)}</td><td>${esc(row.executionQuality)}</td><td>${esc(row.slippageRisk)}</td><td>${esc(row.tradeability)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Broker Liquidity / Spread Risk Panel</h2><span>${data.brokerRisk?.length || 0} broker records</span></div>${table(["Asset","Broker","Server","Current Spread","Average Spread","Spread Widening %","Broker Liquidity Score","Execution Quality","Slippage Risk","Tradeability"], rows, "No broker liquidity or spread risk records are available.")}</section>`;
}

function renderLiquidityWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Liquidity Engine Weights</h2><span>Database configurable</span></div>${table(["Component","Weight","State","Updated"], rows, "No liquidity scanner weights are configured.")}</section>`;
}

function renderLiquidityAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Liquidity Alerts</h2><span>${data.alerts?.length || 0} alerts</span></div>${table(["Type","Title","Severity","Asset","Status","Created"], rows, "No liquidity alerts are recorded.")}</section>`;
}

function renderLiquidityAi(data) {
  const ai = data.aiSummary;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Liquidity Scanner Interpretation</h2><span>${ai ? dt(ai.generatedAt) : "No record"}</span></div>
    ${ai ? `<div class="scanner-ai-grid"><article><span>Most Attractive Liquidity Targets</span><strong>${esc(ai.mostAttractiveLiquidityTargets)}</strong></article><article><span>Recent Liquidity Sweeps</span><strong>${esc(ai.recentLiquiditySweeps)}</strong></article><article><span>Potential Stop-Hunt Setups</span><strong>${esc(ai.potentialStopHuntSetups)}</strong></article><article><span>Voids Likely To Fill</span><strong>${esc(ai.liquidityVoidsLikelyToFill)}</strong></article><article><span>Poor Broker Liquidity</span><strong>${esc(ai.poorBrokerLiquidityAssets)}</strong></article><article><span>High Spread Risk</span><strong>${esc(ai.highSpreadRiskAssets)}</strong></article><article><span>Best Liquidity Opportunities</span><strong>${esc(ai.bestLiquidityOpportunities)}</strong></article><article><span>Assets To Avoid</span><strong>${esc(ai.assetsToAvoid)}</strong></article><article><span>Recommended Next Step</span><strong>${esc(ai.recommendedNextStep)}</strong></article><p>${esc(ai.summary)}</p></div>` : `<div class="scanner-empty-inline">No production AI liquidity interpretation has been generated.</div>`}
    <div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "liquidity-regenerate-summary")}${actionButton("Save to Logs", "liquidity-save-summary")}${actionButton("Create Alert", "liquidity-create-alert")}${actionButton("Export Brief", "liquidity-export")}</div></section>`;
}

function renderLiquidityDetailDrawer() {
  const detail = state.detail;
  if (!detail || slug !== "liquidity") return "";
  const asset = detail.asset || {};
  const frames = Object.entries(detail.timeframeBreakdown || {});
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(asset.asset)} Liquidity Detail</h2><button type="button" data-close-liquidity-detail>Close</button></div>
    <section class="scanner-detail-grid">
      <article><span>Asset Profile</span><strong>${esc(asset.asset)}</strong><small>${esc(asset.assetClass)}</small></article>
      <article><span>Liquidity Bias</span><strong>${esc(asset.liquidityBias || asset.overallLiquidity)}</strong></article>
      <article><span>Buy/Sell Liquidity</span><strong>${fmt(asset.nearestBuySideLiquidity)} / ${fmt(asset.nearestSellSideLiquidity)}</strong></article>
      <article><span>Risk Warnings</span><strong>${esc(asset.sweepRisk)} / ${esc(asset.executionRisk)}</strong></article>
      <article><span>Broker / Spread Risk</span><strong>${esc(asset.brokerLiquidity)} / ${esc(asset.spreadRisk)}</strong></article>
      <article><span>Qualification</span><strong>${esc(asset.qualification)}</strong></article>
    </section>
    ${table(["Timeframe","Buy-Side","Sell-Side","Sweep","Confidence"], frames.map(([frame, row]) => `<tr><td>${esc(frame)}</td><td>${esc(row.buySideStatus)}</td><td>${esc(row.sellSideStatus)}</td><td>${esc(row.sweepStatus)}</td><td>${pct(row.confidence)}</td></tr>`), "No timeframe liquidity breakdown is available.")}
    <div class="scanner-action-bar compact"><button data-dashboard-action="liquidity-recalculate">Recalculate Asset Liquidity</button><a href="/workspace/universe-scanner/institutional">Open Institutional Scanner</a><a href="/workspace/universe-scanner/risk">Open Risk Scanner</a><a href="/workspace/market-intelligence/broker-liquidity">Open Broker Liquidity</a><a href="/workspace/universe-scanner/opportunities">Open Opportunity Ranking</a><button data-dashboard-action="liquidity-create-alert">Create Alert</button><a href="${API}${liquidityRoute}/export" target="_blank" rel="noreferrer">Export Detail</a></div>
  </aside><div class="scanner-drawer-backdrop" data-close-liquidity-detail></div>`;
}

function renderLiquidityEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Liquidity scanner cannot calculate liquidity yet.")}</h2><p>${esc(empty.message || "Register active assets, map broker symbols, sync historical candles, connect broker liquidity data, and run a live liquidity scan before viewing liquidity results.")}</p><div class="scanner-action-bar"><a href="/workspace/universe-scanner/universe">Open Asset Universe Registry</a><a href="/workspace/data-sources-validation/historical-data">Sync Historical Data</a><a href="/workspace/market-intelligence/broker-liquidity">Open Broker Liquidity</a>${actionButton("Run Liquidity Scan", "liquidity-run-scan", "primary")}</div></section>`;
}

function renderLiquidity() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-blue"><section class="scanner-empty-state"><h2>Loading Liquidity Scanner</h2><p>Reading production liquidity records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderLiquidityHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Liquidity Scanner</h2><p>${esc(state.error)}</p>${actionButton("Retry", "liquidity-reload", "primary")}</section></main>`;
    bindLiquidityActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-blue scanner-dashboard">
    ${renderLiquidityHeader(data)}
    ${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}
    ${renderLiquiditySummary(data)}
    ${data.status === "EMPTY" ? renderLiquidityEmpty(data) : ""}
    ${renderLiquidityMatrix(data)}
    ${renderLiquidityRankings(data)}
    <section class="scanner-grid scanner-grid-2">${renderLiquidityZones("Buy-Side Liquidity Panel", data.buySide, "No buy-side liquidity zones are available.")}${renderLiquidityZones("Sell-Side Liquidity Panel", data.sellSide, "No sell-side liquidity zones are available.")}</section>
    ${renderLiquiditySweeps(data)}
    ${renderLiquidityVoids(data)}
    ${renderStopClusters(data)}
    ${renderBrokerLiquidityRisk(data)}
    <section class="scanner-grid scanner-grid-2">${renderLiquidityWeights(data)}${renderLiquidityAlerts(data)}</section>
    ${renderLiquidityAi(data)}
    ${renderLiquidityDetailDrawer()}
  </main>`;
  bindLiquidityActions();
}

async function openLiquidityDetail(id) {
  try {
    state.detail = await fetchJson(`${liquidityRoute}/${id}`);
    renderLiquidity();
  } catch (reason) {
    state.error = reason.message || "Unable to open liquidity detail.";
    renderLiquidity();
  }
}

function bindLiquidityActions() {
  bindActions();
  document.querySelectorAll("[data-liquidity-open]").forEach(item => item.addEventListener("click", () => openLiquidityDetail(item.dataset.liquidityOpen)));
  document.querySelectorAll("[data-close-liquidity-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderLiquidity(); }));
}

async function loadLiquidity() {
  state = { ...state, loading: true, error: "", detail: null };
  renderLiquidity();
  try {
    state.data = await fetchJson(liquidityRoute);
  } catch (reason) {
    state.error = reason.message || "Unable to load Liquidity Scanner.";
  } finally {
    state.loading = false;
    renderLiquidity();
  }
}

function renderInstitutionalHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Institutional</p><h1>Institutional Scanner Engine</h1><p>Scan live institutional positioning, COT bias, smart money behaviour, accumulation/distribution, order blocks, fair value gaps, and liquidity sweep confirmation across the active asset universe.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Institutional Inputs Only</span><strong>Last Institutional Scan: ${dt(badges.lastInstitutionalScan)}</strong><strong>Institutional Scanner Health: ${fmt(badges.institutionalScannerHealth)}</strong></aside>
    <div class="scanner-action-bar">${actionButton("Run Institutional Scan", "institutional-run-scan", "primary")}${actionButton("Refresh Institutional Data", "institutional-reload")}${actionButton("Recalculate Scores", "institutional-recalculate")}${actionButton("Configure Institutional Rules", "institutional-configure")}<a href="${API}${institutionalRoute}/export" target="_blank" rel="noreferrer">Export Report</a></div>
  </section>`;
}

function renderInstitutionalSummary(data) {
  const s = data.summary || {};
  const cards = [["assetsScanned","Assets Scanned"],["institutionalBullishAssets","Institutional Bullish Assets"],["institutionalBearishAssets","Institutional Bearish Assets"],["accumulationSignals","Accumulation Signals"],["distributionSignals","Distribution Signals"],["cotAlignedAssets","COT Aligned Assets"],["cotDivergenceAssets","COT Divergence Assets"],["orderBlockSignals","Order Block Signals"],["fairValueGapSignals","Fair Value Gap Signals"],["liquiditySweepConfirmations","Liquidity Sweep Confirmations"],["institutionalQualifiedAssets","Institutional Qualified Assets"],["averageInstitutionalScore","Average Institutional Score"],["averageInstitutionalConfidence","Average Institutional Confidence"],["scannerHealth","Scanner Health"]];
  return `<section class="scanner-kpis">${cards.map(([key,label])=>`<article class="scanner-kpi"><span>${label}</span><strong>${key.includes("Confidence") ? pct(s[key]) : fmt(s[key])}</strong><small>Production institutional records only</small></article>`).join("")}</section>`;
}

function institutionalTfCell(value) {
  return value ? `${esc(value.institutionalBias)} / ${esc(value.smcSignal)} / ${esc(value.liquidityConfirmation)} / ${pct(value.confidence)}` : "No Data";
}

function renderInstitutionalMatrix(data) {
  const frames = ["MN","W1","D1","H4","H1","M15"];
  const rows = (data.matrix || []).map(row => `<tr><td>${esc(row.asset)}</td>${frames.map(frame => `<td>${institutionalTfCell(row.timeframes?.[frame])}</td>`).join("")}<td>${esc(row.cotBias)}</td><td>${esc(row.smartMoneyBias)}</td><td>${fmt(row.institutionalScore)}</td><td>${pct(row.confidence)}</td><td>${dt(row.lastUpdated)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Multi-Timeframe Institutional Matrix</h2><span>${data.matrix?.length || 0} assets</span></div>${table(["Asset",...frames,"COT Bias","Smart Money Bias","Institutional Score","Confidence","Last Updated"], rows, "No multi-timeframe institutional records are available.")}</section>`;
}

function renderInstitutionalRankings(data) {
  const rows = (data.rankings || []).map(row => `<tr><td>${fmt(row.rank)}</td><td><button class="link-button" type="button" data-institutional-open="${esc(row.assetId || row.asset)}">${esc(row.asset)}</button></td><td>${esc(row.assetClass)}</td><td>${esc(row.institutionalBias)}</td><td>${esc(row.cotBias)}</td><td>${esc(row.smartMoneyBias)}</td><td>${esc(row.accumulationDistribution)}</td><td>${esc(row.liquidityConfirmation)}</td><td>${esc(row.orderBlockSignal)}</td><td>${esc(row.fvgSignal)}</td><td>${fmt(row.institutionalScore)}</td><td>${pct(row.confidence)}</td><td><span class="scanner-status ${badgeClass(row.qualification)}">${esc(row.qualification)}</span></td><td>${dt(row.lastScanned)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Institutional Ranking Table</h2><span>${data.rankings?.length || 0} rankings</span></div>${table(["Rank","Asset","Asset Class","Institutional Bias","COT Bias","Smart Money Bias","Accumulation / Distribution","Liquidity Confirmation","Order Block Signal","FVG Signal","Institutional Score","Confidence","Qualification","Last Scanned"], rows, "No institutional rankings have been calculated.")}</section>`;
}

function renderCotAlignment(data) {
  const rows = (data.cotAlignment || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.cotMarket)}</td><td>${fmt(row.commercialNet)}</td><td>${fmt(row.largeSpecNet)}</td><td>${fmt(row.smallSpecNet)}</td><td>${fmt(row.openInterest)}</td><td>${fmt(row.weeklyChange)}</td><td>${esc(row.cotBias)}</td><td>${esc(row.cotAlignment)}</td><td>${esc(row.extremePositioning)}</td><td>${dt(row.lastReportDate)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>COT Alignment Panel</h2><span>${data.cotAlignment?.length || 0} records</span></div>${table(["Asset","COT Market","Commercial Net","Large Spec Net","Small Spec Net","Open Interest","Weekly Change","COT Bias","COT Alignment","Extreme Positioning","Last Report Date"], rows, "No COT alignment records are available.")}</section>`;
}

function renderAccumulationDistribution(data) {
  const rows = (data.accumulationDistribution || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.timeframe)}</td><td>${esc(row.state)}</td><td>${esc(row.evidence)}</td><td>${esc(row.structureContext)}</td><td>${esc(row.volumeTickContext)}</td><td>${esc(row.liquidityContext)}</td><td>${pct(row.confidence)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Accumulation / Distribution Panel</h2><span>${data.accumulationDistribution?.length || 0} signals</span></div>${table(["Asset","Timeframe","State","Evidence","Structure Context","Volume / Tick Context","Liquidity Context","Confidence","Recommended Action"], rows, "No accumulation or distribution records are available.")}</section>`;
}

function renderSmc(data) {
  const rows = (data.smc || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.smcSignal)}</td><td>${esc(row.direction)}</td><td>${esc(row.timeframe)}</td><td>${esc(row.priceZone)}</td><td>${esc(row.strength)}</td><td>${esc(row.confirmation)}</td><td>${fmt(row.invalidationLevel)}</td><td>${esc(row.status)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Smart Money Concepts Panel</h2><span>${data.smc?.length || 0} signals</span></div>${table(["Asset","SMC Signal","Direction","Timeframe","Price Zone","Strength","Confirmation","Invalidation Level","Status"], rows, "No smart money concept records are available.")}</section>`;
}

function renderInstitutionalLiquidityConfirmation(data) {
  const rows = (data.liquidityConfirmation || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.sweepType)}</td><td>${fmt(row.sweptLevel)}</td><td>${dt(row.sweepTime)}</td><td>${esc(row.structureReaction)}</td><td>${esc(row.institutionalConfirmation)}</td><td>${pct(row.reversalProbability)}</td><td>${pct(row.continuationProbability)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Liquidity Sweep Confirmation Panel</h2><span>${data.liquidityConfirmation?.length || 0} confirmations</span></div>${table(["Asset","Sweep Type","Swept Level","Sweep Time","Structure Reaction","Institutional Confirmation","Reversal Probability","Continuation Probability","Confidence"], rows, "No institutional liquidity confirmations are available.")}</section>`;
}

function renderOrderBlocksFvg(data) {
  const rows = (data.orderBlocksFvg || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.signalType)}</td><td>${esc(row.direction)}</td><td>${esc(row.timeframe)}</td><td>${esc(row.priceZone)}</td><td>${dt(row.createdAt)}</td><td>${esc(row.mitigationStatus)}</td><td>${esc(row.strength)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Order Block / FVG Panel</h2><span>${data.orderBlocksFvg?.length || 0} signals</span></div>${table(["Asset","Signal Type","Direction","Timeframe","Price Zone","Created At","Mitigation Status","Strength","Confidence"], rows, "No order block or FVG records are available.")}</section>`;
}

function renderInstitutionalWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Institutional Engine Weights</h2><span>Database configurable</span></div>${table(["Component","Weight","State","Updated"], rows, "No institutional scanner weights are configured.")}</section>`;
}

function renderInstitutionalAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Institutional Alerts</h2><span>${data.alerts?.length || 0} alerts</span></div>${table(["Type","Title","Severity","Asset","Status","Created"], rows, "No institutional alerts are recorded.")}</section>`;
}

function renderInstitutionalAi(data) {
  const ai = data.aiSummary;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Institutional Scanner Interpretation</h2><span>${ai ? dt(ai.generatedAt) : "No record"}</span></div>
    ${ai ? `<div class="scanner-ai-grid"><article><span>Strongest Buy Assets</span><strong>${esc(ai.strongestInstitutionalBuyAssets)}</strong></article><article><span>Strongest Sell Assets</span><strong>${esc(ai.strongestInstitutionalSellAssets)}</strong></article><article><span>COT-Aligned Opportunities</span><strong>${esc(ai.cotAlignedOpportunities)}</strong></article><article><span>COT-Divergent Warnings</span><strong>${esc(ai.cotDivergentWarnings)}</strong></article><article><span>Accumulation Zones</span><strong>${esc(ai.accumulationZones)}</strong></article><article><span>Distribution Zones</span><strong>${esc(ai.distributionZones)}</strong></article><article><span>Smart Money Setups</span><strong>${esc(ai.smartMoneySetups)}</strong></article><article><span>Liquidity Sweep Confirmations</span><strong>${esc(ai.liquiditySweepConfirmations)}</strong></article><article><span>Opportunities To Monitor</span><strong>${esc(ai.institutionalOpportunitiesToMonitor)}</strong></article><article><span>Assets To Avoid</span><strong>${esc(ai.assetsToAvoid)}</strong></article><article><span>Recommended Next Step</span><strong>${esc(ai.recommendedNextStep)}</strong></article><p>${esc(ai.summary)}</p></div>` : `<div class="scanner-empty-inline">No production AI institutional interpretation has been generated.</div>`}
    <div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "institutional-regenerate-summary")}${actionButton("Save to Logs", "institutional-save-summary")}${actionButton("Create Alert", "institutional-create-alert")}${actionButton("Export Brief", "institutional-export")}</div></section>`;
}

function renderInstitutionalDetailDrawer() {
  const detail = state.detail;
  if (!detail || slug !== "institutional") return "";
  const asset = detail.asset || {};
  const frames = Object.entries(detail.timeframeBreakdown || {});
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(asset.asset)} Institutional Detail</h2><button type="button" data-close-institutional-detail>Close</button></div>
    <section class="scanner-detail-grid">
      <article><span>Asset Profile</span><strong>${esc(asset.asset)}</strong><small>${esc(asset.assetClass)}</small></article>
      <article><span>Institutional Bias</span><strong>${esc(asset.institutionalBias)}</strong></article>
      <article><span>COT / Smart Money</span><strong>${esc(asset.cotBias)} / ${esc(asset.smartMoneyBias)}</strong></article>
      <article><span>Accumulation / Distribution</span><strong>${esc(asset.accumulationDistribution)}</strong></article>
      <article><span>OB / FVG</span><strong>${esc(asset.orderBlockSignal)} / ${esc(asset.fvgSignal)}</strong></article>
      <article><span>Score / Confidence</span><strong>${fmt(asset.institutionalScore)} / ${pct(asset.confidence)}</strong></article>
    </section>
    ${table(["Timeframe","Institutional Bias","SMC Signal","Liquidity Confirmation","Confidence"], frames.map(([frame, row]) => `<tr><td>${esc(frame)}</td><td>${esc(row.institutionalBias)}</td><td>${esc(row.smcSignal)}</td><td>${esc(row.liquidityConfirmation)}</td><td>${pct(row.confidence)}</td></tr>`), "No timeframe institutional breakdown is available.")}
    <div class="scanner-action-bar compact"><button data-dashboard-action="institutional-recalculate">Recalculate Asset Institutional Score</button><a href="/workspace/universe-scanner/liquidity">Open Liquidity Scanner</a><a href="/workspace/universe-scanner/market-structure">Open Market Structure</a><a href="/workspace/universe-scanner/macro">Open Macro Scanner</a><a href="/workspace/universe-scanner/sentiment">Open Sentiment Scanner</a><a href="/workspace/universe-scanner/opportunities">Open Opportunity Ranking</a><button data-dashboard-action="institutional-create-alert">Create Alert</button><a href="${API}${institutionalRoute}/export" target="_blank" rel="noreferrer">Export Detail</a></div>
  </aside><div class="scanner-drawer-backdrop" data-close-institutional-detail></div>`;
}

function renderInstitutionalEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Institutional scanner cannot calculate institutional bias yet.")}</h2><p>${esc(empty.message || "Register active assets, sync COT reports, connect institutional intelligence inputs, sync historical data, and run an institutional scan before viewing results.")}</p><div class="scanner-action-bar"><a href="/workspace/universe-scanner/universe">Open Asset Universe Registry</a><a href="/workspace/market-intelligence/institutional-intelligence">Open Institutional Intelligence</a><a href="/workspace/data-sources-validation/institutional-cot">Sync COT Reports</a>${actionButton("Run Institutional Scan", "institutional-run-scan", "primary")}</div></section>`;
}

function renderInstitutional() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-violet"><section class="scanner-empty-state"><h2>Loading Institutional Scanner</h2><p>Reading production institutional records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderInstitutionalHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Institutional Scanner</h2><p>${esc(state.error)}</p>${actionButton("Retry", "institutional-reload", "primary")}</section></main>`;
    bindInstitutionalActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-violet scanner-dashboard">
    ${renderInstitutionalHeader(data)}
    ${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}
    ${renderInstitutionalSummary(data)}
    ${data.status === "EMPTY" ? renderInstitutionalEmpty(data) : ""}
    ${renderInstitutionalMatrix(data)}
    ${renderInstitutionalRankings(data)}
    ${renderCotAlignment(data)}
    <section class="scanner-grid scanner-grid-2">${renderAccumulationDistribution(data)}${renderSmc(data)}</section>
    ${renderInstitutionalLiquidityConfirmation(data)}
    ${renderOrderBlocksFvg(data)}
    <section class="scanner-grid scanner-grid-2">${renderInstitutionalWeights(data)}${renderInstitutionalAlerts(data)}</section>
    ${renderInstitutionalAi(data)}
    ${renderInstitutionalDetailDrawer()}
  </main>`;
  bindInstitutionalActions();
}

async function openInstitutionalDetail(id) {
  try {
    state.detail = await fetchJson(`${institutionalRoute}/${id}`);
    renderInstitutional();
  } catch (reason) {
    state.error = reason.message || "Unable to open institutional detail.";
    renderInstitutional();
  }
}

function bindInstitutionalActions() {
  bindActions();
  document.querySelectorAll("[data-institutional-open]").forEach(item => item.addEventListener("click", () => openInstitutionalDetail(item.dataset.institutionalOpen)));
  document.querySelectorAll("[data-close-institutional-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderInstitutional(); }));
}

async function loadInstitutional() {
  state = { ...state, loading: true, error: "", detail: null };
  renderInstitutional();
  try {
    state.data = await fetchJson(institutionalRoute);
  } catch (reason) {
    state.error = reason.message || "Unable to load Institutional Scanner.";
  } finally {
    state.loading = false;
    renderInstitutional();
  }
}

const macroSummaryCards = [
  ["assetsScanned", "Assets Scanned"],
  ["macroBullishAssets", "Macro Bullish Assets"],
  ["macroBearishAssets", "Macro Bearish Assets"],
  ["neutralMacroAssets", "Neutral Macro Assets"],
  ["centralBankAlignedAssets", "Central Bank Aligned Assets"],
  ["yieldSupportedAssets", "Yield Supported Assets"],
  ["inflationSensitiveAssets", "Inflation Sensitive Assets"],
  ["growthSensitiveAssets", "Growth Sensitive Assets"],
  ["commodityMacroAssets", "Commodity Macro Assets"],
  ["macroDivergenceAssets", "Macro Divergence Assets"],
  ["macroQualifiedAssets", "Macro Qualified Assets"],
  ["averageMacroScore", "Average Macro Score"],
  ["averageMacroConfidence", "Average Macro Confidence"],
  ["scannerHealth", "Scanner Health"]
];

function macroCell(item) {
  if (!item || typeof item !== "object") return `<span class="scanner-status no-data">No Data</span>`;
  return `<div class="scanner-cell-stack"><span class="scanner-status ${badgeClass(item.label)}">${esc(item.label)}</span><small>${fmt(item.score)} / ${pct(item.confidence)}</small><small>${esc(item.freshness || "No record")}</small></div>`;
}

function renderMacroHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Sub-function</p><h1>Macro Scanner Engine</h1><p>Scan live macroeconomic bias, central bank tone, yield direction, inflation pressure, growth momentum, commodity drivers, and macro opportunity alignment across the active asset universe.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Macro Inputs Only</span><strong>Last Macro Scan: ${dt(badges.lastMacroScan)}</strong><strong>Macro Scanner Health: ${esc(badges.macroScannerHealth)}</strong></aside>
    <div class="scanner-action-bar">
      ${actionButton("Run Macro Scan", "macro-run-scan", "primary")}
      ${actionButton("Refresh Macro Inputs", "macro-reload")}
      ${actionButton("Recalculate Scores", "macro-recalculate")}
      ${actionButton("Configure Macro Rules", "macro-configure")}
      <a href="${API}${macroRoute}/export" target="_blank" rel="noreferrer">Export Report</a>
    </div>
  </section>`;
}

function renderMacroSummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${macroSummaryCards.map(([key, label]) => `
    <article class="scanner-kpi"><span>${label}</span><strong>${fmt(summary[key])}</strong><small>Production macro records only</small></article>`).join("")}</section>`;
}

function renderMacroMatrix(data) {
  const rows = (data.matrix || []).map(row => `<tr>
    <td>${esc(row.asset)}</td>
    <td>${macroCell(row.macroBias)}</td>
    <td>${macroCell(row.currencyBias)}</td>
    <td>${macroCell(row.centralBankBias)}</td>
    <td>${macroCell(row.interestRateBias)}</td>
    <td>${macroCell(row.inflationBias)}</td>
    <td>${macroCell(row.growthBias)}</td>
    <td>${macroCell(row.yieldBias)}</td>
    <td>${macroCell(row.commodityBias)}</td>
    <td>${macroCell(row.riskTone)}</td>
    <td>${fmt(row.macroScore)}</td>
    <td>${pct(row.confidence)}</td>
    <td>${dt(row.lastUpdated)}</td>
  </tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Macro Matrix</h2><span>${data.matrix?.length || 0} active assets</span></div>${table(["Asset","Macro Bias","Currency Bias","Central Bank","Interest Rate","Inflation","Growth","Yield","Commodity","Risk Tone","Macro Score","Confidence","Last Updated"], rows, "No production macro matrix rows are available.")}</section>`;
}

function renderMacroRankings(data) {
  const rows = (data.rankings || []).map(row => `<tr>
    <td>${fmt(row.rank)}</td><td><button class="link-button" type="button" data-macro-open="${esc(row.assetId || row.asset)}">${esc(row.asset)}</button></td><td>${esc(row.assetClass)}</td>
    <td>${esc(row.macroBias)}</td><td>${esc(row.currencyBias)}</td><td>${esc(row.centralBankBias)}</td><td>${esc(row.rateDifferential)}</td><td>${esc(row.inflationImpact)}</td>
    <td>${esc(row.growthImpact)}</td><td>${esc(row.yieldImpact)}</td><td>${esc(row.riskToneImpact)}</td><td>${esc(row.commodityImpact)}</td>
    <td>${fmt(row.macroScore)}</td><td>${pct(row.confidence)}</td><td><span class="scanner-status ${badgeClass(row.qualification)}">${esc(row.qualification)}</span></td><td>${dt(row.lastScanned)}</td>
  </tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Macro Ranking Table</h2><span>${data.rankings?.length || 0} rankings</span></div>${table(["Rank","Asset","Asset Class","Macro Bias","Currency Bias","Central Bank Bias","Rate Differential","Inflation Impact","Growth Impact","Yield Impact","Risk Tone Impact","Commodity Impact","Macro Score","Confidence","Qualification","Last Scanned"], rows, "No macro rankings have been calculated.")}</section>`;
}

function renderCurrencyMacroBias(data) {
  const rows = (data.currencyBias || []).map(row => `<tr><td>${esc(row.currency)}</td><td>${esc(row.economy)}</td><td>${esc(row.inflationTrend)}</td><td>${esc(row.growthMomentum)}</td><td>${esc(row.centralBankTone)}</td><td>${esc(row.rateDirection)}</td><td>${esc(row.yieldSupport)}</td><td>${esc(row.employmentStrength)}</td><td>${esc(row.riskSensitivity)}</td><td>${esc(row.macroBias)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Currency Macro Bias</h2><span>${data.currencyBias?.length || 0} currencies</span></div>${table(["Currency","Economy","Inflation Trend","Growth Momentum","Central Bank Tone","Rate Direction","Yield Support","Employment Strength","Risk Sensitivity","Macro Bias","Confidence"], rows, "No production currency macro bias records are available.")}</section>`;
}

function renderCentralBanks(data) {
  const rows = (data.centralBanks || []).map(row => `<tr><td>${esc(row.centralBank)}</td><td>${esc(row.currency)}</td><td>${fmt(row.currentRate)}</td><td>${esc(row.latestDecision)}</td><td>${esc(row.policyTone)}</td><td>${esc(row.ratePathBias)}</td><td>${esc(row.inflationConcern)}</td><td>${esc(row.growthConcern)}</td><td>${dt(row.nextMeeting)}</td><td>${esc(row.currencyImpact)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Central Bank Alignment</h2><span>${data.centralBanks?.length || 0} policy states</span></div>${table(["Central Bank","Currency","Current Rate","Latest Decision","Policy Tone","Rate Path Bias","Inflation Concern","Growth Concern","Next Meeting","Currency Impact","Confidence"], rows, "No central bank policy states are available.")}</section>`;
}

function renderYieldsRates(data) {
  const rows = (data.yieldsRates || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.baseCurrencyRateBias)}</td><td>${esc(row.quoteCurrencyRateBias)}</td><td>${esc(row.rateDifferentialBias)}</td><td>${esc(row.yieldDirection)}</td><td>${esc(row.realYieldImpact)}</td><td>${esc(row.carryTradeBias)}</td><td>${esc(row.macroInterpretation)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Yield / Rate Differential</h2><span>${data.yieldsRates?.length || 0} records</span></div>${table(["Asset","Base Currency Rate Bias","Quote Currency Rate Bias","Rate Differential Bias","Yield Direction","Real Yield Impact","Carry Trade Bias","Macro Interpretation","Confidence"], rows, "No production yield/rate differential records are available.")}</section>`;
}

function renderInflationGrowth(data) {
  const rows = (data.inflationGrowth || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.currencyEconomy)}</td><td>${esc(row.inflationTrend)}</td><td>${esc(row.coreInflation)}</td><td>${esc(row.growthMomentum)}</td><td>${esc(row.pmiDirection)}</td><td>${esc(row.employmentDirection)}</td><td>${esc(row.economicSurprise)}</td><td>${esc(row.assetImpact)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Inflation / Growth Impact</h2><span>${data.inflationGrowth?.length || 0} records</span></div>${table(["Asset","Currency / Economy","Inflation Trend","Core Inflation","Growth Momentum","PMI Direction","Employment Direction","Economic Surprise","Asset Impact","Confidence"], rows, "No production inflation/growth impact records are available.")}</section>`;
}

function renderCommodityDrivers(data) {
  const rows = (data.commodityDrivers || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.driver)}</td><td>${esc(row.driverDirection)}</td><td>${esc(row.affectedCurrency)}</td><td>${esc(row.macroImpact)}</td><td>${esc(row.riskLevel)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Commodity Macro Drivers</h2><span>${data.commodityDrivers?.length || 0} drivers</span></div>${table(["Asset","Driver","Driver Direction","Affected Currency","Macro Impact","Risk Level","Confidence"], rows, "No production commodity macro driver records are available.")}</section>`;
}

function renderMacroDivergence(data) {
  const rows = (data.divergence || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.divergenceType)}</td><td>${esc(row.macroBias)}</td><td>${esc(row.technicalBias)}</td><td>${esc(row.sentimentBias)}</td><td>${esc(row.institutionalBias)}</td><td>${esc(row.severity)}</td><td>${esc(row.tradingInterpretation)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Macro Divergence</h2><span>${data.divergence?.length || 0} conflicts</span></div>${table(["Asset","Divergence Type","Macro Bias","Technical Bias","Sentiment Bias","Institutional Bias","Severity","Trading Interpretation","Recommended Action"], rows, "No production macro divergences are recorded.")}</section>`;
}

function renderMacroHeatmap(data) {
  const rows = (data.heatmap || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.component)}</td><td><span class="scanner-status ${badgeClass(row.state)}">${esc(row.state)}</span></td><td>${fmt(row.score)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Macro Heatmap</h2><span>${data.heatmap?.length || 0} cells</span></div>${table(["Asset","Component","State","Score","Confidence"], rows, "No production macro heatmap cells are available.")}</section>`;
}

function renderMacroAi(data) {
  const ai = data.aiSummary;
  if (!ai) return `<section class="scanner-panel"><div class="scanner-section-head"><h2>AI Macro Scanner Interpretation</h2><span>No record</span></div><div class="scanner-empty-inline">No AI macro scanner interpretation has been generated from production records.</div></section>`;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Macro Scanner Interpretation</h2><span>${dt(ai.generatedAt)}</span></div>
    <p class="scanner-ai-summary">${esc(ai.summary)}</p>
    <div class="scanner-detail-grid">
      <article><span>Strongest Bullish</span><strong>${esc(ai.strongestMacroBullishAssets)}</strong></article>
      <article><span>Strongest Bearish</span><strong>${esc(ai.strongestMacroBearishAssets)}</strong></article>
      <article><span>Currency Opportunities</span><strong>${esc(ai.bestCurrencyMacroOpportunities)}</strong></article>
      <article><span>Central Bank Divergence</span><strong>${esc(ai.centralBankDivergenceOpportunities)}</strong></article>
      <article><span>Yield Supported</span><strong>${esc(ai.yieldSupportedOpportunities)}</strong></article>
      <article><span>Commodity Themes</span><strong>${esc(ai.commodityMacroThemes)}</strong></article>
      <article><span>Assets To Monitor</span><strong>${esc(ai.assetsToMonitor)}</strong></article>
      <article><span>Recommended Next Step</span><strong>${esc(ai.recommendedNextStep)}</strong></article>
    </div>
    <div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "macro-regenerate-summary")}${actionButton("Save to Logs", "macro-save-summary")}${actionButton("Create Alert", "macro-create-alert")}<a href="${API}${macroRoute}/export" target="_blank" rel="noreferrer">Export Brief</a></div></section>`;
}

function renderMacroWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Macro Scanner Weights</h2><span>Database configurable</span></div>${table(["Component","Weight","Enabled","Updated"], rows, "No macro scanner weights are configured.")}</section>`;
}

function renderMacroAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Macro Alerts</h2><span>${data.alerts?.length || 0} records</span></div>${table(["Type","Title","Severity","Asset","Status","Created"], rows, "No macro scanner alerts are recorded.")}</section>`;
}

function renderMacroEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Macro scanner cannot calculate macro bias yet.")}</h2><p>${esc(empty.message || "Connect macro intelligence, economic calendar, interest rate, central bank, yield, inflation, growth, and sentiment sources before running a macro scan.")}</p><div class="scanner-action-bar"><a href="/workspace/market-intelligence/macro-intelligence">Open Macro Intelligence</a><a href="/workspace/market-intelligence/economic-calendar">Open Economic Calendar</a><a href="/workspace/market-intelligence/source-configuration">Open Source Registry</a>${actionButton("Run Macro Scan", "macro-run-scan", "primary")}</div></section>`;
}

function renderMacroDetailDrawer() {
  const detail = state.detail;
  if (!detail) return "";
  const asset = detail.asset || {};
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(asset.asset)} Macro Detail</h2><button type="button" data-close-macro-detail>Close</button></div>
    <section class="scanner-detail-grid">
      <article><span>Macro Bias</span><strong>${esc(asset.macroBias)}</strong><small>${fmt(asset.macroScore)} / ${pct(asset.confidence)}</small></article>
      <article><span>Currency Bias</span><strong>${esc(asset.currencyBias)}</strong></article>
      <article><span>Central Bank</span><strong>${esc(asset.centralBankBias)}</strong></article>
      <article><span>Yield Impact</span><strong>${esc(asset.yieldImpact)}</strong></article>
      <article><span>Commodity Driver</span><strong>${esc(asset.commodityImpact)}</strong></article>
      <article><span>Qualification</span><strong>${esc(asset.qualification)}</strong></article>
    </section>
    ${renderMacroHeatmap({ heatmap: detail.scoreBreakdown || [] })}
    ${renderCurrencyMacroBias({ currencyBias: detail.currencyBias || [] })}
    ${renderCentralBanks({ centralBanks: detail.centralBanks || [] })}
    ${renderYieldsRates({ yieldsRates: detail.yieldsRates || [] })}
    ${renderInflationGrowth({ inflationGrowth: detail.inflationGrowth || [] })}
    ${renderCommodityDrivers({ commodityDrivers: detail.commodityDrivers || [] })}
    ${renderMacroDivergence({ divergence: detail.divergence || [] })}
    <div class="scanner-action-bar compact"><button data-dashboard-action="macro-recalculate">Recalculate Asset Macro Score</button><a href="/workspace/market-intelligence/macro-intelligence">Open Macro Intelligence</a><a href="/workspace/market-intelligence/economic-calendar">Open Economic Calendar</a><a href="/workspace/universe-scanner/sentiment">Open Sentiment Scanner</a><a href="/workspace/universe-scanner/opportunities">Open Opportunity Ranking</a><button data-dashboard-action="macro-create-alert">Create Alert</button><a href="${API}${macroRoute}/export" target="_blank" rel="noreferrer">Export Detail</a></div>
  </aside><div class="scanner-drawer-backdrop" data-close-macro-detail></div>`;
}

function renderMacro() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-amber"><section class="scanner-empty-state"><h2>Loading Macro Scanner Engine</h2><p>Reading production macro records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderMacroHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Macro Scanner Engine</h2><p>${esc(state.error)}</p>${actionButton("Retry", "macro-reload", "primary")}</section></main>`;
    bindMacroActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-amber scanner-dashboard">
    ${renderMacroHeader(data)}
    ${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}
    ${renderMacroSummary(data)}
    ${data.status === "EMPTY" ? renderMacroEmpty(data) : ""}
    ${renderMacroMatrix(data)}
    ${renderMacroRankings(data)}
    ${renderCurrencyMacroBias(data)}
    ${renderCentralBanks(data)}
    ${renderYieldsRates(data)}
    ${renderInflationGrowth(data)}
    ${renderCommodityDrivers(data)}
    ${renderMacroDivergence(data)}
    ${renderMacroHeatmap(data)}
    <section class="scanner-grid scanner-grid-2">${renderMacroWeights(data)}${renderMacroAlerts(data)}</section>
    ${renderMacroAi(data)}
    ${renderMacroDetailDrawer()}
  </main>`;
  bindMacroActions();
}

async function openMacroDetail(id) {
  try {
    state.detail = await fetchJson(`${macroRoute}/${id}`);
    renderMacro();
  } catch (reason) {
    state.error = reason.message || "Unable to open macro detail.";
    renderMacro();
  }
}

function bindMacroActions() {
  bindActions();
  document.querySelectorAll("[data-macro-open]").forEach(item => item.addEventListener("click", () => openMacroDetail(item.dataset.macroOpen)));
  document.querySelectorAll("[data-close-macro-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderMacro(); }));
}

async function loadMacro() {
  state = { ...state, loading: true, error: "", detail: null };
  renderMacro();
  try {
    state.data = await fetchJson(macroRoute);
  } catch (reason) {
    state.error = reason.message || "Unable to load Macro Scanner Engine.";
  } finally {
    state.loading = false;
    renderMacro();
  }
}

const eventSummaryCards = [
  ["eventsToday", "Events Today"],
  ["upcomingHighImpactEvents", "Upcoming High Impact Events"],
  ["extremeImpactEvents", "Extreme Impact Events"],
  ["assetsExposed", "Assets Exposed"],
  ["assetsBlockedByNewsRisk", "Assets Blocked by News Risk"],
  ["propRestrictedEvents", "Prop Restricted Events"],
  ["deviationAlerts", "Deviation Alerts"],
  ["volatilityRiskEvents", "Volatility Risk Events"],
  ["liquidityRiskEvents", "Liquidity Risk Events"],
  ["eventQualifiedAssets", "Event Qualified Assets"],
  ["averageEventRiskScore", "Average Event Risk Score"],
  ["averageEventConfidence", "Average Event Confidence"],
  ["scannerHealth", "Scanner Health"]
];

function renderEventsHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Sub-function</p><h1>Economic Events Scanner Engine</h1><p>Scan live economic releases, central bank events, news-risk windows, actual-vs-forecast deviations, event volatility, and prop-firm restrictions across the active asset universe.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Calendar Inputs Only</span><strong>Last Event Scan: ${dt(badges.lastEventScan)}</strong><strong>Event Scanner Health: ${esc(badges.eventScannerHealth)}</strong></aside>
    <div class="scanner-action-bar">
      ${actionButton("Run Event Scan", "events-run-scan", "primary")}
      ${actionButton("Refresh Events", "events-reload")}
      ${actionButton("Sync Economic Calendar", "events-sync")}
      ${actionButton("Recalculate Event Risk", "events-recalculate")}
      ${actionButton("Configure Event Rules", "events-configure")}
      <a href="${API}${economicEventsRoute}/export" target="_blank" rel="noreferrer">Export Report</a>
    </div>
  </section>`;
}

function renderEventsSummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${eventSummaryCards.map(([key, label]) => `<article class="scanner-kpi"><span>${label}</span><strong>${fmt(summary[key])}</strong><small>Production calendar records only</small></article>`).join("")}</section>`;
}

function renderExposureMatrix(data) {
  const rows = (data.exposureMatrix || []).map(row => `<tr><td>${esc(row.asset)}</td><td><button class="link-button" type="button" data-event-open="${esc(row.nextEventId || "")}" ${row.nextEventId ? "" : "disabled"}>${esc(row.nextEvent)}</button></td><td>${esc(row.currency)} / ${esc(row.country)}</td><td>${esc(row.impact)}</td><td>${esc(row.timeToEvent)}</td><td>${esc(row.riskWindow)}</td><td>${esc(row.affectedDirection)}</td><td>${esc(row.volatilityRisk)}</td><td>${esc(row.liquidityRisk)}</td><td>${esc(row.propRestriction)}</td><td>${fmt(row.eventScore)}</td><td>${pct(row.confidence)}</td><td><span class="scanner-status ${badgeClass(row.recommendation)}">${esc(row.recommendation)}</span></td><td>${dt(row.lastUpdated)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Event Exposure Matrix</h2><span>${data.exposureMatrix?.length || 0} active assets</span></div>${table(["Asset","Next Event","Currency / Country","Impact","Time To Event","Risk Window","Affected Direction","Volatility Risk","Liquidity Risk","Prop Restriction","Event Score","Confidence","Recommendation","Last Updated"], rows, "No production event exposure rows are available.")}</section>`;
}

function renderEventRankings(data) {
  const rows = (data.rankings || []).map(row => `<tr><td>${fmt(row.rank)}</td><td>${esc(row.asset)}</td><td>${esc(row.assetClass)}</td><td><button class="link-button" type="button" data-event-open="${esc(row.nextEventId || "")}" ${row.nextEventId ? "" : "disabled"}>${esc(row.nextEvent)}</button></td><td>${esc(row.currency)}</td><td>${esc(row.impact)}</td><td>${esc(row.timeToEvent)}</td><td>${fmt(row.eventRiskScore)}</td><td>${esc(row.volatilityRisk)}</td><td>${esc(row.liquidityRisk)}</td><td>${esc(row.propRestriction)}</td><td>${fmt(row.opportunityScore)}</td><td><span class="scanner-status ${badgeClass(row.recommendation)}">${esc(row.recommendation)}</span></td><td>${pct(row.confidence)}</td><td>${dt(row.lastScanned)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Event Risk Ranking Table</h2><span>${data.rankings?.length || 0} rankings</span></div>${table(["Rank","Asset","Asset Class","Next Event","Currency","Impact","Time To Event","Event Risk Score","Volatility Risk","Liquidity Risk","Prop Restriction","Opportunity Score","Recommendation","Confidence","Last Scanned"], rows, "No event risk rankings have been calculated.")}</section>`;
}

function renderUpcomingEvents(data) {
  const rows = (data.upcoming || []).map(row => `<tr><td>${dt(row.eventTime)}</td><td>${esc(row.country)}</td><td>${esc(row.currency)}</td><td><button class="link-button" type="button" data-event-open="${esc(row.eventId)}">${esc(row.eventName)}</button></td><td>${esc(row.category)}</td><td>${esc(row.previous)}</td><td>${esc(row.forecast)}</td><td>${esc(row.actual)}</td><td>${esc(row.impact)}</td><td>${esc(row.affectedAssets)}</td><td>${esc(row.riskWindow)}</td><td>${esc(row.tradingRecommendation)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Upcoming High-Impact Events</h2><span>${data.upcoming?.length || 0} events</span></div>${table(["Event Time","Country","Currency","Event Name","Category","Previous","Forecast","Actual","Impact","Affected Assets","Risk Window","Trading Recommendation"], rows, "No upcoming high-impact production events are available.")}</section>`;
}

function renderEventDeviations(data) {
  const rows = (data.deviations || []).map(row => `<tr><td>${dt(row.releasedAt)}</td><td><button class="link-button" type="button" data-event-open="${esc(row.eventId)}">${esc(row.event)}</button></td><td>${esc(row.currency)}</td><td>${esc(row.actual)}</td><td>${esc(row.forecast)}</td><td>${esc(row.previous)}</td><td>${fmt(row.deviation)}</td><td>${esc(row.surpriseDirection)}</td><td>${esc(row.sentimentImpact)}</td><td>${esc(row.affectedAssets)}</td><td>${esc(row.observedVolatility)}</td><td>${esc(row.observedPriceReaction)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Released Event Deviation</h2><span>${data.deviations?.length || 0} releases</span></div>${table(["Released At","Event","Currency","Actual","Forecast","Previous","Deviation","Surprise Direction","Sentiment Impact","Affected Assets","Observed Volatility","Observed Price Reaction"], rows, "No released production event deviations are available.")}</section>`;
}

function renderEventOpportunities(data) {
  const rows = (data.opportunities || []).map(row => `<tr><td>${esc(row.asset)}</td><td><button class="link-button" type="button" data-event-open="${esc(row.eventId)}">${esc(row.event)}</button></td><td>${esc(row.currency)}</td><td>${esc(row.eventDirection)}</td><td>${esc(row.macroAlignment)}</td><td>${esc(row.sentimentAlignment)}</td><td>${esc(row.trendAlignment)}</td><td>${esc(row.liquidityCondition)}</td><td>${fmt(row.opportunityScore)}</td><td>${pct(row.confidence)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Event Opportunity</h2><span>${data.opportunities?.length || 0} opportunities</span></div>${table(["Asset","Event","Currency","Event Direction","Macro Alignment","Sentiment Alignment","Trend Alignment","Liquidity Condition","Opportunity Score","Confidence","Recommended Action"], rows, "No event opportunity records are available.")}</section>`;
}

function renderEventBlocked(data) {
  const rows = (data.blocked || []).map(row => `<tr><td>${esc(row.asset)}</td><td><button class="link-button" type="button" data-event-open="${esc(row.eventId)}">${esc(row.event)}</button></td><td>${esc(row.reason)}</td><td>${esc(row.riskWindow)}</td><td>${esc(row.propFirmRule)}</td><td>${esc(row.volatilityRisk)}</td><td>${esc(row.liquidityRisk)}</td><td>${esc(row.severity)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Event Avoidance / Blocked</h2><span>${data.blocked?.length || 0} blocked</span></div>${table(["Asset","Event","Reason","Risk Window","Prop Firm Rule","Volatility Risk","Liquidity Risk","Severity","Recommended Action"], rows, "No event avoidance or blocked records are available.")}</section>`;
}

function renderPropRestrictions(data) {
  const rows = (data.propRestrictions || []).map(row => `<tr><td>${esc(row.firm)}</td><td>${esc(row.account)}</td><td><button class="link-button" type="button" data-event-open="${esc(row.eventId)}">${esc(row.event)}</button></td><td>${esc(row.currency)}</td><td>${esc(row.restrictionWindow)}</td><td>${esc(row.ruleType)}</td><td>${esc(row.accountStatus)}</td><td>${esc(row.complianceRisk)}</td><td>${esc(row.actionRequired)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Prop Firm News Restriction</h2><span>${data.propRestrictions?.length || 0} restrictions</span></div>${rows.length ? table(["Firm","Account","Event","Currency","Restriction Window","Rule Type","Account Status","Compliance Risk","Action Required"], rows, "") : `<div class="scanner-empty-inline">${esc(data.propRestrictionMessage || "No prop firm news restrictions configured for connected accounts.")}</div>`}</section>`;
}

function renderEventVolLiquidity(data) {
  const rows = (data.volatilityLiquidity || []).map(row => `<tr><td><button class="link-button" type="button" data-event-open="${esc(row.eventId)}">${esc(row.event)}</button></td><td>${esc(row.asset)}</td><td>${esc(row.historicalAvgMove)}</td><td>${esc(row.expectedVolatility)}</td><td>${esc(row.spreadWideningRisk)}</td><td>${esc(row.slippageRisk)}</td><td>${esc(row.liquidityDropRisk)}</td><td>${esc(row.tradeability)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Event Volatility and Liquidity</h2><span>${data.volatilityLiquidity?.length || 0} rows</span></div>${table(["Event","Asset","Historical Avg Move","Expected Volatility","Spread Widening Risk","Slippage Risk","Liquidity Drop Risk","Tradeability"], rows, "No production event volatility/liquidity risk rows are available.")}</section>`;
}

function renderEventHeatmap(data) {
  const rows = (data.heatmap || []).map(row => `<tr><td>${esc(row.asset)}</td><td><button class="link-button" type="button" data-event-open="${esc(row.eventId)}">${esc(row.event)}</button></td><td>${esc(row.component)}</td><td><span class="scanner-status ${badgeClass(row.state)}">${esc(row.state)}</span></td><td>${fmt(row.score)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Event Heatmap</h2><span>${data.heatmap?.length || 0} cells</span></div>${table(["Asset","Event","Component","State","Score","Confidence"], rows, "No event heatmap records are available.")}</section>`;
}

function renderEventAi(data) {
  const ai = data.aiSummary;
  if (!ai) return `<section class="scanner-panel"><div class="scanner-section-head"><h2>AI Economic Events Interpretation</h2><span>No record</span></div><div class="scanner-empty-inline">No AI economic events interpretation has been generated.</div></section>`;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Economic Events Interpretation</h2><span>${dt(ai.generatedAt)}</span></div><p class="scanner-ai-summary">${esc(ai.summary)}</p>
    <div class="scanner-detail-grid">
      <article><span>Most Important Upcoming</span><strong>${esc(ai.mostImportantUpcomingEvents)}</strong></article>
      <article><span>Assets Most Exposed</span><strong>${esc(ai.assetsMostExposed)}</strong></article>
      <article><span>Opportunities</span><strong>${esc(ai.eventsCreatingOpportunities)}</strong></article>
      <article><span>Avoidance</span><strong>${esc(ai.eventsRequiringAvoidance)}</strong></article>
      <article><span>Volatility Windows</span><strong>${esc(ai.likelyVolatilityWindows)}</strong></article>
      <article><span>Next Step</span><strong>${esc(ai.recommendedNextStep)}</strong></article>
    </div><div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "events-regenerate-summary")}${actionButton("Save to Logs", "events-save-summary")}${actionButton("Create Alert", "events-create-alert")}<a href="${API}${economicEventsRoute}/export" target="_blank" rel="noreferrer">Export Brief</a></div></section>`;
}

function renderEventWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Event Scanner Weights</h2><span>Database configurable</span></div>${table(["Component","Weight","Enabled","Updated"], rows, "No event scanner weights are configured.")}</section>`;
}

function renderEventAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.eventId)}</td><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Event Alerts</h2><span>${data.alerts?.length || 0} alerts</span></div>${table(["Type","Title","Severity","Event","Asset","Status","Created"], rows, "No economic events scanner alerts are recorded.")}</section>`;
}

function renderEventsEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Economic events scanner cannot calculate event exposure yet.")}</h2><p>${esc(empty.message || "Connect economic calendar sources, sync live events, register active assets, and run an event scan before viewing event risk and opportunity results.")}</p><div class="scanner-action-bar"><a href="/workspace/market-intelligence/economic-calendar">Open Economic Calendar</a>${actionButton("Sync Economic Events", "events-sync", "primary")}<a href="/workspace/market-intelligence/source-configuration">Open Source Registry</a>${actionButton("Run Event Scan", "events-run-scan")}</div></section>`;
}

function renderEventDetailDrawer() {
  const detail = state.detail;
  if (!detail) return "";
  const event = detail.event || {};
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(event.event)} Detail</h2><button type="button" data-close-event-detail>Close</button></div>
    <section class="scanner-detail-grid">
      <article><span>Event Profile</span><strong>${esc(event.event)}</strong><small>${esc(event.category)} / ${esc(event.importance)}</small></article>
      <article><span>Country / Currency</span><strong>${esc(event.country)} / ${esc(event.currency)}</strong></article>
      <article><span>Previous / Forecast / Actual</span><strong>${esc(event.previous)} / ${esc(event.forecast)} / ${esc(event.actual)}</strong></article>
      <article><span>Deviation</span><strong>${fmt(event.deviation)}</strong></article>
      <article><span>Risk Window</span><strong>${esc(event.propFirmRestriction?.action || "No restriction")}</strong></article>
      <article><span>AI Interpretation</span><strong>${esc(event.aiAnalysis?.summary || "No record")}</strong></article>
    </section>
    ${renderExposureMatrix({ exposureMatrix: detail.exposures || [] })}
    ${renderEventOpportunities({ opportunities: detail.opportunities || [] })}
    ${renderEventBlocked({ blocked: detail.blocked || [] })}
    ${renderEventVolLiquidity({ volatilityLiquidity: detail.volatilityLiquidity || [] })}
    ${renderEventHeatmap({ heatmap: detail.heatmap || [] })}
    <div class="scanner-action-bar compact"><button data-dashboard-action="events-recalculate">Recalculate Event Exposure</button><a href="/workspace/market-intelligence/economic-calendar">Open Economic Calendar</a><a href="/workspace/universe-scanner/macro">Open Macro Scanner</a><a href="/workspace/universe-scanner/sentiment">Open Sentiment Scanner</a><a href="/workspace/universe-scanner/risk">Open Risk Scanner</a><button data-dashboard-action="events-create-alert">Create Alert</button><a href="${API}${economicEventsRoute}/export" target="_blank" rel="noreferrer">Export Detail</a></div>
  </aside><div class="scanner-drawer-backdrop" data-close-event-detail></div>`;
}

function renderEconomicEvents() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-blue"><section class="scanner-empty-state"><h2>Loading Economic Events Scanner</h2><p>Reading live calendar records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderEventsHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Economic Events Scanner</h2><p>${esc(state.error)}</p>${actionButton("Retry", "events-reload", "primary")}</section></main>`;
    bindEconomicEventsActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-blue scanner-dashboard">
    ${renderEventsHeader(data)}
    ${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}
    ${renderEventsSummary(data)}
    ${data.status === "EMPTY" ? renderEventsEmpty(data) : ""}
    ${renderExposureMatrix(data)}
    ${renderEventRankings(data)}
    ${renderUpcomingEvents(data)}
    ${renderEventDeviations(data)}
    ${renderEventOpportunities(data)}
    ${renderEventBlocked(data)}
    ${renderPropRestrictions(data)}
    ${renderEventVolLiquidity(data)}
    ${renderEventHeatmap(data)}
    <section class="scanner-grid scanner-grid-2">${renderEventWeights(data)}${renderEventAlerts(data)}</section>
    ${renderEventAi(data)}
    ${renderEventDetailDrawer()}
  </main>`;
  bindEconomicEventsActions();
}

async function openEventDetail(id) {
  if (!id) return;
  try {
    state.detail = await fetchJson(`${economicEventsRoute}/${id}`);
    renderEconomicEvents();
  } catch (reason) {
    state.error = reason.message || "Unable to open event detail.";
    renderEconomicEvents();
  }
}

function bindEconomicEventsActions() {
  bindActions();
  document.querySelectorAll("[data-event-open]").forEach(item => item.addEventListener("click", () => openEventDetail(item.dataset.eventOpen)));
  document.querySelectorAll("[data-close-event-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderEconomicEvents(); }));
}

async function loadEconomicEvents() {
  state = { ...state, loading: true, error: "", detail: null };
  renderEconomicEvents();
  try {
    state.data = await fetchJson(economicEventsRoute);
  } catch (reason) {
    state.error = reason.message || "Unable to load Economic Events Scanner.";
  } finally {
    state.loading = false;
    renderEconomicEvents();
  }
}

const sentimentSummaryCards = [
  ["assetsScanned", "Assets Scanned"],
  ["sentimentBullishAssets", "Sentiment Bullish Assets"],
  ["sentimentBearishAssets", "Sentiment Bearish Assets"],
  ["mixedSentimentAssets", "Mixed Sentiment Assets"],
  ["newsAlignedAssets", "News-Aligned Assets"],
  ["socialAlignedAssets", "Social-Aligned Assets"],
  ["divergenceSignals", "Divergence Signals"],
  ["extremeSentimentAlerts", "Extreme Sentiment Alerts"],
  ["contrarianRiskAssets", "Contrarian Risk Assets"],
  ["crowdOvercrowdingAlerts", "Crowd Overcrowding Alerts"],
  ["sentimentQualifiedAssets", "Sentiment Qualified Assets"],
  ["averageSentimentScore", "Average Sentiment Score"],
  ["averageSentimentConfidence", "Average Sentiment Confidence"],
  ["scannerHealth", "Scanner Health"]
];

function sentimentCell(item) {
  if (!item || typeof item !== "object") return `<span class="scanner-status no-data">No Data</span>`;
  return `<div class="scanner-cell-stack"><span class="scanner-status ${badgeClass(item.label)}">${esc(item.label)}</span><small>${fmt(item.score)} / ${pct(item.confidence)}</small><small>${esc(item.freshness || "No record")}</small></div>`;
}

function renderSentimentHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Sub-function</p><h1>Sentiment Scanner Engine</h1><p>Scan live news sentiment, social sentiment, crowd bias, sentiment alignment, divergence, and contrarian risk across the active asset universe.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Sentiment Inputs Only</span><strong>Last Sentiment Scan: ${dt(badges.lastSentimentScan)}</strong><strong>Sentiment Scanner Health: ${esc(badges.sentimentScannerHealth)}</strong></aside>
    <div class="scanner-action-bar">
      ${actionButton("Run Sentiment Scan", "sentiment-run-scan", "primary")}
      ${actionButton("Refresh Sentiment", "sentiment-reload")}
      ${actionButton("Recalculate Scores", "sentiment-recalculate")}
      ${actionButton("Configure Sentiment Rules", "sentiment-configure")}
      <a href="${API}${sentimentRoute}/export" target="_blank" rel="noreferrer">Export Report</a>
    </div>
  </section>`;
}

function renderSentimentSummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${sentimentSummaryCards.map(([key, label]) => `<article class="scanner-kpi"><span>${label}</span><strong>${fmt(summary[key])}</strong><small>Production sentiment records only</small></article>`).join("")}</section>`;
}

function renderSentimentMatrix(data) {
  const rows = (data.matrix || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${sentimentCell(row.newsSentiment)}</td><td>${sentimentCell(row.socialSentiment)}</td><td>${sentimentCell(row.unifiedSentiment)}</td><td>${sentimentCell(row.macroSentiment)}</td><td>${sentimentCell(row.crowdBias)}</td><td>${sentimentCell(row.contrarianRisk)}</td><td>${sentimentCell(row.sentimentAlignment)}</td><td>${fmt(row.sentimentScore)}</td><td>${pct(row.confidence)}</td><td>${dt(row.lastUpdated)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Multi-Source Sentiment Matrix</h2><span>${data.matrix?.length || 0} active assets</span></div>${table(["Asset","News Sentiment","Social Sentiment","Unified Sentiment","Macro Sentiment","Crowd Bias","Contrarian Risk","Sentiment Alignment","Sentiment Score","Confidence","Last Updated"], rows, "No production sentiment matrix rows are available.")}</section>`;
}

function renderSentimentRankings(data) {
  const rows = (data.rankings || []).map(row => `<tr><td>${fmt(row.rank)}</td><td><button class="link-button" type="button" data-sentiment-open="${esc(row.assetId || row.asset)}">${esc(row.asset)}</button></td><td>${esc(row.assetClass)}</td><td>${esc(row.newsSentiment)}</td><td>${esc(row.socialSentiment)}</td><td>${esc(row.unifiedSentiment)}</td><td>${esc(row.crowdBias)}</td><td>${esc(row.contrarianRisk)}</td><td>${fmt(row.alignmentScore)}</td><td>${fmt(row.divergenceScore)}</td><td>${fmt(row.sentimentScore)}</td><td>${pct(row.confidence)}</td><td><span class="scanner-status ${badgeClass(row.qualification)}">${esc(row.qualification)}</span></td><td>${dt(row.lastScanned)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Sentiment Ranking Table</h2><span>${data.rankings?.length || 0} rankings</span></div>${table(["Rank","Asset","Asset Class","News Sentiment","Social Sentiment","Unified Sentiment","Crowd Bias","Contrarian Risk","Alignment Score","Divergence Score","Sentiment Score","Confidence","Qualification","Last Scanned"], rows, "No sentiment rankings have been calculated.")}</section>`;
}

function renderNewsAlignment(data) {
  const rows = (data.newsAlignment || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.newsSentiment)}</td><td>${esc(row.mainNewsDriver)}</td><td>${esc(row.impactLevel)}</td><td>${esc(row.affectedCurrency)}</td><td>${esc(row.affectedInstrument)}</td><td>${dt(row.newsFreshness)}</td><td>${esc(row.alignmentStatus)}</td><td>${pct(row.confidence)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>News Sentiment Alignment</h2><span>${data.newsAlignment?.length || 0} assets</span></div>${table(["Asset","News Sentiment","Main News Driver","Impact Level","Affected Currency","Affected Instrument","News Freshness","Alignment Status","Confidence","Recommended Action"], rows, "No production news sentiment alignment records are available.")}</section>`;
}

function renderSocialAlignment(data) {
  const rows = (data.socialAlignment || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.socialSentiment)}</td><td>${fmt(row.mentionVolume)}</td><td>${pct(row.bullishMentionsPercent)}</td><td>${pct(row.bearishMentionsPercent)}</td><td>${fmt(row.viralityScore)}</td><td>${fmt(row.influencerWeight)}</td><td>${esc(row.crowdBias)}</td><td>${esc(row.alignmentStatus)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Social Sentiment Alignment</h2><span>${data.socialAlignment?.length || 0} assets</span></div>${table(["Asset","Social Sentiment","Mention Volume","Bullish Mentions %","Bearish Mentions %","Virality Score","Influencer Weight","Crowd Bias","Alignment Status","Confidence"], rows, "No production social sentiment alignment records are available.")}</section>`;
}

function renderSentimentDivergence(data) {
  const rows = (data.divergence || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.divergenceType)}</td><td>${esc(row.news)}</td><td>${esc(row.social)}</td><td>${esc(row.price)}</td><td>${esc(row.macro)}</td><td>${esc(row.institutional)}</td><td>${esc(row.severity)}</td><td>${esc(row.tradingInterpretation)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Sentiment Divergence</h2><span>${data.divergence?.length || 0} signals</span></div>${table(["Asset","Divergence Type","News","Social","Price","Macro","Institutional","Severity","Trading Interpretation","Recommended Action"], rows, "No production sentiment divergences are recorded.")}</section>`;
}

function renderExtremeSentiment(data) {
  const rows = (data.extremeRisk || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.extremeSentimentType)}</td><td>${esc(row.crowdDirection)}</td><td>${fmt(row.mentionVolume)}</td><td>${fmt(row.contrarianRiskScore)}</td><td>${esc(row.reversalRisk)}</td><td>${pct(row.confidence)}</td><td>${esc(row.recommendedAction)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Extreme Sentiment / Contrarian Risk</h2><span>${data.extremeRisk?.length || 0} risks</span></div>${table(["Asset","Extreme Sentiment Type","Crowd Direction","Mention Volume","Contrarian Risk Score","Reversal Risk","Confidence","Recommended Action"], rows, "No extreme sentiment or contrarian risk records are available.")}</section>`;
}

function renderSentimentMomentum(data) {
  const rows = (data.momentum || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.previousSentiment)}</td><td>${esc(row.currentSentiment)}</td><td>${esc(row.sentimentChange)}</td><td>${esc(row.momentumDirection)}</td><td>${esc(row.trigger)}</td><td>${pct(row.confidence)}</td><td>${dt(row.lastUpdated)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Sentiment Momentum</h2><span>${data.momentum?.length || 0} rows</span></div>${table(["Asset","Previous Sentiment","Current Sentiment","Sentiment Change","Momentum Direction","Trigger","Confidence","Last Updated"], rows, "No production sentiment momentum records are available.")}</section>`;
}

function renderSentimentHeatmap(data) {
  const rows = (data.heatmap || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.source)}</td><td><span class="scanner-status ${badgeClass(row.state)}">${esc(row.state)}</span></td><td>${fmt(row.score)}</td><td>${pct(row.confidence)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Sentiment Heatmap</h2><span>${data.heatmap?.length || 0} cells</span></div>${table(["Asset","Source","State","Score","Confidence"], rows, "No sentiment heatmap cells are available.")}</section>`;
}

function renderSentimentAi(data) {
  const ai = data.aiSummary;
  if (!ai) return `<section class="scanner-panel"><div class="scanner-section-head"><h2>AI Sentiment Scanner Interpretation</h2><span>No record</span></div><div class="scanner-empty-inline">No AI sentiment scanner interpretation has been generated.</div></section>`;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Sentiment Scanner Interpretation</h2><span>${dt(ai.generatedAt)}</span></div><p class="scanner-ai-summary">${esc(ai.summary)}</p>
    <div class="scanner-detail-grid">
      <article><span>Strongest Bullish</span><strong>${esc(ai.strongestSentimentBullishAssets)}</strong></article>
      <article><span>Strongest Bearish</span><strong>${esc(ai.strongestSentimentBearishAssets)}</strong></article>
      <article><span>News Supported</span><strong>${esc(ai.newsSupportedOpportunities)}</strong></article>
      <article><span>Social Supported</span><strong>${esc(ai.socialSupportedOpportunities)}</strong></article>
      <article><span>Mixed Sentiment Risks</span><strong>${esc(ai.mixedSentimentRisks)}</strong></article>
      <article><span>Contrarian Warnings</span><strong>${esc(ai.contrarianWarnings)}</strong></article>
      <article><span>Assets To Monitor</span><strong>${esc(ai.assetsToMonitor)}</strong></article>
      <article><span>Recommended Next Step</span><strong>${esc(ai.recommendedNextStep)}</strong></article>
    </div><div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "sentiment-regenerate-summary")}${actionButton("Save to Logs", "sentiment-save-summary")}${actionButton("Create Alert", "sentiment-create-alert")}<a href="${API}${sentimentRoute}/export" target="_blank" rel="noreferrer">Export Brief</a></div></section>`;
}

function renderSentimentWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Sentiment Scanner Weights</h2><span>Database configurable</span></div>${table(["Component","Weight","Enabled","Updated"], rows, "No sentiment scanner weights are configured.")}</section>`;
}

function renderSentimentAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Sentiment Alerts</h2><span>${data.alerts?.length || 0} alerts</span></div>${table(["Type","Title","Severity","Asset","Status","Created"], rows, "No sentiment scanner alerts are recorded.")}</section>`;
}

function renderSentimentEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Sentiment scanner cannot calculate sentiment yet.")}</h2><p>${esc(empty.message || "Connect news sentiment, social sentiment, unified sentiment intelligence, and live asset mappings before running a sentiment scan.")}</p><div class="scanner-action-bar"><a href="/workspace/market-intelligence/news-sentiment">Open News Sentiment</a><a href="/workspace/market-intelligence/social-sentiment">Open Social Sentiment</a><a href="/workspace/market-intelligence/sentiment-intelligence">Open Sentiment Intelligence</a>${actionButton("Run Sentiment Scan", "sentiment-run-scan", "primary")}</div></section>`;
}

function renderSentimentDetailDrawer() {
  const detail = state.detail;
  if (!detail) return "";
  const asset = detail.asset || {};
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(asset.asset)} Sentiment Detail</h2><button type="button" data-close-sentiment-detail>Close</button></div>
    <section class="scanner-detail-grid">
      <article><span>Unified Sentiment</span><strong>${esc(asset.unifiedSentiment)}</strong><small>${fmt(asset.sentimentScore)} / ${pct(asset.confidence)}</small></article>
      <article><span>News Sentiment</span><strong>${esc(asset.newsSentiment)}</strong></article>
      <article><span>Social Sentiment</span><strong>${esc(asset.socialSentiment)}</strong></article>
      <article><span>Crowd Bias</span><strong>${esc(asset.crowdBias)}</strong></article>
      <article><span>Contrarian Risk</span><strong>${esc(asset.contrarianRisk)}</strong></article>
      <article><span>Qualification</span><strong>${esc(asset.qualification)}</strong></article>
    </section>
    ${renderNewsAlignment({ newsAlignment: detail.newsAlignment || [] })}
    ${renderSocialAlignment({ socialAlignment: detail.socialAlignment || [] })}
    ${renderSentimentDivergence({ divergence: detail.divergence || [] })}
    ${renderExtremeSentiment({ extremeRisk: detail.extremeRisk || [] })}
    ${renderSentimentMomentum({ momentum: detail.momentum || [] })}
    ${renderSentimentHeatmap({ heatmap: detail.heatmap || [] })}
    <div class="scanner-action-bar compact"><button data-dashboard-action="sentiment-recalculate">Recalculate Asset Sentiment</button><a href="/workspace/market-intelligence/news-sentiment">Open News Sentiment</a><a href="/workspace/market-intelligence/social-sentiment">Open Social Sentiment</a><a href="/workspace/market-intelligence/sentiment-intelligence">Open Sentiment Intelligence</a><a href="/workspace/universe-scanner/opportunities">Open Opportunity Ranking</a><button data-dashboard-action="sentiment-create-alert">Create Alert</button><a href="${API}${sentimentRoute}/export" target="_blank" rel="noreferrer">Export Detail</a></div>
  </aside><div class="scanner-drawer-backdrop" data-close-sentiment-detail></div>`;
}

function renderSentiment() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-violet"><section class="scanner-empty-state"><h2>Loading Sentiment Scanner</h2><p>Reading production sentiment records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderSentimentHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Sentiment Scanner</h2><p>${esc(state.error)}</p>${actionButton("Retry", "sentiment-reload", "primary")}</section></main>`;
    bindSentimentActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-violet scanner-dashboard">
    ${renderSentimentHeader(data)}
    ${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}
    ${renderSentimentSummary(data)}
    ${data.status === "EMPTY" ? renderSentimentEmpty(data) : ""}
    ${renderSentimentMatrix(data)}
    ${renderSentimentRankings(data)}
    ${renderNewsAlignment(data)}
    ${renderSocialAlignment(data)}
    ${renderSentimentDivergence(data)}
    ${renderExtremeSentiment(data)}
    ${renderSentimentMomentum(data)}
    ${renderSentimentHeatmap(data)}
    <section class="scanner-grid scanner-grid-2">${renderSentimentWeights(data)}${renderSentimentAlerts(data)}</section>
    ${renderSentimentAi(data)}
    ${renderSentimentDetailDrawer()}
  </main>`;
  bindSentimentActions();
}

async function openSentimentDetail(id) {
  try {
    state.detail = await fetchJson(`${sentimentRoute}/${id}`);
    renderSentiment();
  } catch (reason) {
    state.error = reason.message || "Unable to open sentiment detail.";
    renderSentiment();
  }
}

function bindSentimentActions() {
  bindActions();
  document.querySelectorAll("[data-sentiment-open]").forEach(item => item.addEventListener("click", () => openSentimentDetail(item.dataset.sentimentOpen)));
  document.querySelectorAll("[data-close-sentiment-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderSentiment(); }));
}

async function loadSentiment() {
  state = { ...state, loading: true, error: "", detail: null };
  renderSentiment();
  try {
    state.data = await fetchJson(sentimentRoute);
  } catch (reason) {
    state.error = reason.message || "Unable to load Sentiment Scanner.";
  } finally {
    state.loading = false;
    renderSentiment();
  }
}

const riskSummaryCards = [
  ["assetsScanned", "Assets Scanned"], ["lowRiskAssets", "Low Risk Assets"], ["mediumRiskAssets", "Medium Risk Assets"],
  ["highRiskAssets", "High Risk Assets"], ["criticalRiskAssets", "Critical Risk Assets"], ["blockedAssets", "Blocked Assets"],
  ["newsRiskAssets", "News Risk Assets"], ["spreadRiskAssets", "Spread Risk Assets"], ["slippageRiskAssets", "Slippage Risk Assets"],
  ["liquidityRiskAssets", "Liquidity Risk Assets"], ["portfolioRiskAssets", "Portfolio Risk Assets"], ["propFirmRiskAssets", "Prop Firm Risk Assets"],
  ["averageRiskScore", "Average Risk Score"], ["averageRiskConfidence", "Average Risk Confidence"], ["scannerHealth", "Scanner Health"]
];

function riskCell(item) {
  if (!item || typeof item !== "object") return `<span class="scanner-status no-data">No Data</span>`;
  return `<div class="scanner-cell-stack"><span class="scanner-status ${badgeClass(item.label)}">${esc(item.label)}</span><small>${fmt(item.score)} / ${pct(item.confidence)}</small><small>${esc(item.freshness || "No record")}</small></div>`;
}

function renderRiskHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Sub-function</p><h1>Risk Scanner Engine</h1><p>Scan live volatility, liquidity, spread, slippage, news, macro, correlation, portfolio, broker, and prop-firm risk across the active asset universe.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Risk Inputs Only</span><strong>Last Risk Scan: ${dt(badges.lastRiskScan)}</strong><strong>Risk Scanner Health: ${esc(badges.riskScannerHealth)}</strong></aside>
    <div class="scanner-action-bar">${actionButton("Run Risk Scan", "risk-run-scan", "primary")}${actionButton("Refresh Risk", "risk-reload")}${actionButton("Recalculate Risk Scores", "risk-recalculate")}${actionButton("Configure Risk Rules", "risk-configure")}<a href="${API}${riskRoute}/export" target="_blank" rel="noreferrer">Export Risk Report</a></div>
  </section>`;
}

function renderRiskSummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${riskSummaryCards.map(([key, label]) => `<article class="scanner-kpi"><span>${label}</span><strong>${fmt(summary[key])}</strong><small>Production risk records only</small></article>`).join("")}</section>`;
}

function renderRiskMatrix(data) {
  const rows = (data.matrix || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${riskCell(row.volatilityRisk)}</td><td>${riskCell(row.liquidityRisk)}</td><td>${riskCell(row.spreadRisk)}</td><td>${riskCell(row.slippageRisk)}</td><td>${riskCell(row.newsRisk)}</td><td>${riskCell(row.macroRisk)}</td><td>${riskCell(row.correlationRisk)}</td><td>${riskCell(row.portfolioRisk)}</td><td>${riskCell(row.brokerExecutionRisk)}</td><td>${riskCell(row.propFirmRisk)}</td><td>${riskCell(row.overallRisk)}</td><td>${pct(row.confidence)}</td><td>${dt(row.lastUpdated)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Risk Matrix</h2><span>${data.matrix?.length || 0} active assets</span></div>${table(["Asset","Volatility","Liquidity","Spread","Slippage","News","Macro","Correlation","Portfolio","Broker Execution","Prop Firm","Overall","Confidence","Last Updated"], rows, "No production risk matrix rows are available.")}</section>`;
}

function renderRiskRankings(data) {
  const rows = (data.rankings || []).map(row => `<tr><td>${fmt(row.rank)}</td><td><button class="link-button" type="button" data-risk-open="${esc(row.assetId || row.asset)}">${esc(row.asset)}</button></td><td>${esc(row.assetClass)}</td><td>${esc(row.overallRisk)}</td><td>${fmt(row.riskScore)}</td><td>${esc(row.mainRiskDriver)}</td><td>${esc(row.volatilityRisk)}</td><td>${esc(row.liquidityRisk)}</td><td>${esc(row.spreadRisk)}</td><td>${esc(row.slippageRisk)}</td><td>${esc(row.newsRisk)}</td><td>${esc(row.portfolioRisk)}</td><td>${esc(row.propFirmRisk)}</td><td>${pct(row.riskConfidence)}</td><td><span class="scanner-status ${badgeClass(row.qualification)}">${esc(row.qualification)}</span></td><td>${dt(row.lastScanned)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Risk Ranking Table</h2><span>${data.rankings?.length || 0} rankings</span></div>${table(["Rank","Asset","Asset Class","Overall Risk","Risk Score","Main Risk Driver","Volatility","Liquidity","Spread","Slippage","News","Portfolio","Prop Firm","Confidence","Qualification","Last Scanned"], rows, "No risk rankings have been calculated.")}</section>`;
}

function simpleRiskTable(title, rows, headers, mapRow, emptyText) {
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>${title}</h2><span>${rows?.length || 0} rows</span></div>${table(headers, (rows || []).map(mapRow), emptyText)}</section>`;
}

function renderRiskCritical(data) {
  return simpleRiskTable("Critical Risk", data.critical, ["Asset","Type","Score","Module","Reason","Severity","Recommended Action"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.criticalRiskType)}</td><td>${fmt(row.riskScore)}</td><td>${esc(row.blockingModule)}</td><td>${esc(row.reason)}</td><td>${esc(row.severity)}</td><td>${esc(row.recommendedAction)}</td></tr>`, "No critical risk blocks are recorded.");
}
function renderRiskNewsEvents(data) {
  return simpleRiskTable("News & Event Risk", data.newsEvents, ["Asset","Event / News","Currency","Impact","Risk Window","News Risk Score","Volatility Risk","Trading Recommendation"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.eventNews)}</td><td>${esc(row.currency)}</td><td>${esc(row.impact)}</td><td>${esc(row.riskWindow)}</td><td>${fmt(row.newsRiskScore)}</td><td>${esc(row.volatilityRisk)}</td><td>${esc(row.tradingRecommendation)}</td></tr>`, "No news or event risk rows are available.");
}
function renderRiskBroker(data) {
  return simpleRiskTable("Broker Execution Risk", data.brokerExecution, ["Asset","Broker","Server","Current Spread","Average Spread","Spread Deviation","Slippage Risk","Execution Speed","Reject Rate","Execution Risk","Tradeability"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.broker)}</td><td>${esc(row.server)}</td><td>${fmt(row.currentSpread)}</td><td>${fmt(row.averageSpread)}</td><td>${fmt(row.spreadDeviation)}</td><td>${esc(row.slippageRisk)}</td><td>${fmt(row.executionSpeed)}</td><td>${fmt(row.rejectRate)}</td><td>${esc(row.executionRisk)}</td><td>${esc(row.tradeability)}</td></tr>`, "No broker execution risk records are available.");
}
function renderRiskPortfolio(data) {
  return simpleRiskTable("Correlation and Portfolio Risk", data.correlationPortfolio, ["Asset","Correlation Group","Existing Exposure","New Trade Impact","Portfolio Risk","Correlation Risk","Recommended Action"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.correlationGroup)}</td><td>${esc(row.existingExposure)}</td><td>${esc(row.newTradeImpact)}</td><td>${esc(row.portfolioRisk)}</td><td>${esc(row.correlationRisk)}</td><td>${esc(row.recommendedAction)}</td></tr>`, "No correlation or portfolio risk records are available.");
}
function renderRiskProp(data) {
  return simpleRiskTable("Prop Firm Risk", data.propFirm, ["Asset","Firm","Account","Rule Type","Restriction Status","Daily Drawdown","Max Drawdown","News Restriction","Consistency","Recommendation"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.firm)}</td><td>${esc(row.account)}</td><td>${esc(row.ruleType)}</td><td>${esc(row.restrictionStatus)}</td><td>${esc(row.dailyDrawdownRisk)}</td><td>${esc(row.maxDrawdownRisk)}</td><td>${esc(row.newsRestriction)}</td><td>${esc(row.consistencyRisk)}</td><td>${esc(row.complianceRecommendation)}</td></tr>`, "No prop firm risk records are available.");
}
function renderRiskRecommendations(data) {
  return simpleRiskTable("Risk Reduction Recommendations", data.recommendations, ["Asset","Risk Driver","Recommendation","Expected Reduction","Priority"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.riskDriver)}</td><td>${esc(row.recommendation)}</td><td>${esc(row.expectedRiskReduction)}</td><td>${esc(row.priority)}</td></tr>`, "No risk recommendations are available.");
}
function renderRiskHeatmap(data) {
  return simpleRiskTable("Risk Heatmap", data.heatmap, ["Asset","Risk Type","State","Score","Confidence"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.riskType)}</td><td><span class="scanner-status ${badgeClass(row.state)}">${esc(row.state)}</span></td><td>${fmt(row.score)}</td><td>${pct(row.confidence)}</td></tr>`, "No risk heatmap cells are available.");
}

function renderRiskAi(data) {
  const ai = data.aiSummary;
  if (!ai) return `<section class="scanner-panel"><div class="scanner-section-head"><h2>AI Risk Scanner Interpretation</h2><span>No record</span></div><div class="scanner-empty-inline">No AI risk interpretation has been generated.</div></section>`;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Risk Scanner Interpretation</h2><span>${dt(ai.generatedAt)}</span></div><p class="scanner-ai-summary">${esc(ai.summary)}</p><div class="scanner-detail-grid"><article><span>Lowest Risk</span><strong>${esc(ai.lowestRiskAssets)}</strong></article><article><span>Highest Risk</span><strong>${esc(ai.highestRiskAssets)}</strong></article><article><span>Blocked</span><strong>${esc(ai.blockedAssets)}</strong></article><article><span>Main Drivers</span><strong>${esc(ai.mainRiskDrivers)}</strong></article><article><span>Safe For Ranking</span><strong>${esc(ai.assetsSafeForRanking)}</strong></article><article><span>Assets To Avoid</span><strong>${esc(ai.assetsToAvoid)}</strong></article></div><div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "risk-regenerate-summary")}${actionButton("Save to Logs", "risk-save-summary")}${actionButton("Create Alert", "risk-create-alert")}<a href="${API}${riskRoute}/export" target="_blank" rel="noreferrer">Export Brief</a></div></section>`;
}

function renderRiskWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Risk Scanner Weights</h2><span>Database configurable</span></div>${table(["Component","Weight","Enabled","Updated"], rows, "No risk scanner weights are configured.")}</section>`;
}
function renderRiskAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Risk Alerts</h2><span>${data.alerts?.length || 0} alerts</span></div>${table(["Type","Title","Severity","Asset","Status","Created"], rows, "No risk scanner alerts are recorded.")}</section>`;
}

function renderRiskEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Risk scanner cannot calculate asset risk yet.")}</h2><p>${esc(empty.message || "Connect live market data, broker liquidity, economic events, portfolio intelligence, prop firm rules, and source health data before running a risk scan.")}</p><div class="scanner-action-bar"><a href="/workspace/universe-scanner/universe">Open Asset Universe Registry</a><a href="/workspace/market-intelligence/broker-liquidity">Open Broker Liquidity</a><a href="/workspace/universe-scanner/economic-events">Open Economic Events</a>${actionButton("Run Risk Scan", "risk-run-scan", "primary")}</div></section>`;
}

function renderRiskDetailDrawer() {
  const detail = state.detail;
  if (!detail) return "";
  const asset = detail.asset || {};
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(asset.asset)} Risk Detail</h2><button type="button" data-close-risk-detail>Close</button></div><section class="scanner-detail-grid"><article><span>Overall Risk</span><strong>${esc(asset.overallRisk)}</strong><small>${fmt(asset.riskScore)} / ${pct(asset.riskConfidence)}</small></article><article><span>Main Driver</span><strong>${esc(asset.mainRiskDriver)}</strong></article><article><span>Qualification</span><strong>${esc(asset.qualification)}</strong></article></section>${renderRiskMatrix({ matrix: detail.matrix ? [detail.matrix] : [] })}${renderRiskCritical({ critical: detail.critical || [] })}${renderRiskNewsEvents({ newsEvents: detail.newsEvents || [] })}${renderRiskBroker({ brokerExecution: detail.brokerExecution || [] })}${renderRiskPortfolio({ correlationPortfolio: detail.correlationPortfolio || [] })}${renderRiskProp({ propFirm: detail.propFirm || [] })}${renderRiskRecommendations({ recommendations: detail.recommendations || [] })}${renderRiskHeatmap({ heatmap: detail.heatmap || [] })}<div class="scanner-action-bar compact"><button data-dashboard-action="risk-recalculate">Recalculate Asset Risk</button><a href="/workspace/universe-scanner/economic-events">Open Economic Events Scanner</a><a href="/workspace/market-intelligence/broker-liquidity">Open Broker Liquidity</a><a href="/workspace/market-intelligence/portfolio-intelligence">Open Portfolio Intelligence</a><a href="/workspace/universe-scanner/opportunities">Open Opportunity Ranking</a><button data-dashboard-action="risk-create-alert">Create Alert</button><a href="${API}${riskRoute}/export" target="_blank" rel="noreferrer">Export Detail</a></div></aside><div class="scanner-drawer-backdrop" data-close-risk-detail></div>`;
}

function renderRisk() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red"><section class="scanner-empty-state"><h2>Loading Risk Scanner</h2><p>Reading live risk inputs from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderRiskHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Risk Scanner</h2><p>${esc(state.error)}</p>${actionButton("Retry", "risk-reload", "primary")}</section></main>`;
    bindRiskActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red scanner-dashboard">${renderRiskHeader(data)}${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}${renderRiskSummary(data)}${data.status === "EMPTY" ? renderRiskEmpty(data) : ""}${renderRiskMatrix(data)}${renderRiskRankings(data)}${renderRiskCritical(data)}${renderRiskNewsEvents(data)}${renderRiskBroker(data)}${renderRiskPortfolio(data)}${renderRiskProp(data)}${renderRiskRecommendations(data)}${renderRiskHeatmap(data)}<section class="scanner-grid scanner-grid-2">${renderRiskWeights(data)}${renderRiskAlerts(data)}</section>${renderRiskAi(data)}${renderRiskDetailDrawer()}</main>`;
  bindRiskActions();
}

async function openRiskDetail(id) {
  try { state.detail = await fetchJson(`${riskRoute}/${id}`); renderRisk(); }
  catch (reason) { state.error = reason.message || "Unable to open risk detail."; renderRisk(); }
}
function bindRiskActions() {
  bindActions();
  document.querySelectorAll("[data-risk-open]").forEach(item => item.addEventListener("click", () => openRiskDetail(item.dataset.riskOpen)));
  document.querySelectorAll("[data-close-risk-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderRisk(); }));
}
async function loadRisk() {
  state = { ...state, loading: true, error: "", detail: null };
  renderRisk();
  try { state.data = await fetchJson(riskRoute); }
  catch (reason) { state.error = reason.message || "Unable to load Risk Scanner."; }
  finally { state.loading = false; renderRisk(); }
}

const propSummaryCards = [
  ["assetsScanned", "Assets Scanned"], ["eligibleAssets", "Eligible Assets"], ["cautionAssets", "Caution Assets"],
  ["restrictedAssets", "Restricted Assets"], ["blockedAssets", "Blocked Assets"], ["connectedAccounts", "Connected Accounts"],
  ["activePropRules", "Active Prop Rules"], ["newsRestrictedAssets", "News Restricted"], ["drawdownRiskAssets", "Drawdown Risk"],
  ["consistencyRiskAssets", "Consistency Risk"], ["instrumentRestrictedAssets", "Instrument Restricted"],
  ["averageComplianceScore", "Average Compliance"], ["averageComplianceConfidence", "Average Confidence"], ["scannerHealth", "Scanner Health"]
];

function complianceCell(item) {
  if (!item || typeof item !== "object") return `<span class="scanner-status no-data">No Data</span>`;
  return `<div class="scanner-cell-stack"><span class="scanner-status ${badgeClass(item.label)}">${esc(item.label)}</span><small>${fmt(item.score)} / ${pct(item.confidence)}</small><small>${esc(item.freshness || "No record")}</small></div>`;
}

function renderPropHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Sub-function</p><h1>Prop Firm Compliance Scanner Engine</h1><p>Scan live prop firm rules, connected accounts, drawdown limits, news restrictions, consistency rules, and trade eligibility across the active asset universe.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Prop Rules Only</span><strong>Last Compliance Scan: ${dt(badges.lastComplianceScan)}</strong><strong>Compliance Scanner Health: ${esc(badges.complianceScannerHealth)}</strong></aside>
    <div class="scanner-action-bar">${actionButton("Run Compliance Scan", "prop-run-scan", "primary")}${actionButton("Refresh Compliance", "prop-reload")}${actionButton("Sync Prop Rules", "prop-sync-rules")}${actionButton("Recalculate Compliance", "prop-recalculate")}${actionButton("Configure Compliance Rules", "prop-configure")}<a href="${API}${propComplianceRoute}/export" target="_blank" rel="noreferrer">Export Report</a></div>
  </section>`;
}

function renderPropSummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${propSummaryCards.map(([key, label]) => `<article class="scanner-kpi"><span>${label}</span><strong>${fmt(summary[key])}</strong><small>Live prop compliance only</small></article>`).join("")}</section>`;
}

function renderPropMatrix(data) {
  const rows = (data.matrix || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.firm)}</td><td>${esc(row.account)}</td><td>${complianceCell(row.dailyDrawdown)}</td><td>${complianceCell(row.maxDrawdown)}</td><td>${complianceCell(row.newsRestriction)}</td><td>${complianceCell(row.consistency)}</td><td>${complianceCell(row.instrumentRestriction)}</td><td>${complianceCell(row.portfolioExposure)}</td><td>${complianceCell(row.overallCompliance)}</td><td>${pct(row.confidence)}</td><td>${dt(row.lastUpdated)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Prop Compliance Matrix</h2><span>${data.matrix?.length || 0} active assets</span></div>${table(["Asset","Firm","Account","Daily Drawdown","Max Drawdown","News","Consistency","Instrument","Exposure","Overall","Confidence","Last Updated"], rows, "No live prop compliance matrix rows are available.")}</section>`;
}

function renderPropRankings(data) {
  const rows = (data.rankings || []).map(row => `<tr><td>${fmt(row.rank)}</td><td><button class="link-button" type="button" data-prop-open="${esc(row.assetId || row.asset)}">${esc(row.asset)}</button></td><td>${esc(row.assetClass)}</td><td>${esc(row.firm)}</td><td>${esc(row.account)}</td><td>${fmt(row.complianceScore)}</td><td><span class="scanner-status ${badgeClass(row.tradeEligibility)}">${esc(row.tradeEligibility)}</span></td><td>${esc(row.primaryConstraint)}</td><td>${esc(row.dailyDrawdownStatus)}</td><td>${esc(row.maxDrawdownStatus)}</td><td>${esc(row.newsStatus)}</td><td>${esc(row.consistencyStatus)}</td><td>${esc(row.instrumentStatus)}</td><td>${pct(row.confidence)}</td><td>${dt(row.lastScanned)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Trade Eligibility Ranking</h2><span>${data.rankings?.length || 0} rankings</span></div>${table(["Rank","Asset","Asset Class","Firm","Account","Score","Eligibility","Primary Constraint","Daily DD","Max DD","News","Consistency","Instrument","Confidence","Last Scanned"], rows, "No prop compliance rankings have been calculated.")}</section>`;
}

function propTable(title, rows, headers, mapRow, emptyText) {
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>${title}</h2><span>${rows?.length || 0} rows</span></div>${table(headers, (rows || []).map(mapRow), emptyText)}</section>`;
}

function renderPropAccounts(data) {
  return propTable("Connected Prop Accounts", data.accounts, ["Firm","Account","Program","Phase","Status","Daily Used","Max Used","Target Progress","Breach Risk","Measured"], row => `<tr><td>${esc(row.firm)}</td><td>${esc(row.account)}</td><td>${esc(row.program)}</td><td>${esc(row.phase)}</td><td>${esc(row.status)}</td><td>${pct(row.dailyLossUsed)}</td><td>${pct(row.maxDrawdownUsed)}</td><td>${pct(row.profitTargetProgress)}</td><td>${esc(row.breachRisk)}</td><td>${dt(row.measuredAt)}</td></tr>`, "No live prop firm accounts are connected.");
}
function renderPropNews(data) {
  return propTable("News Restrictions", data.newsRestrictions, ["Asset","Firm","Account","Event","Currency","Impact","Window","Rule Status","Trade Action"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.firm)}</td><td>${esc(row.account)}</td><td>${esc(row.eventName)}</td><td>${esc(row.currency)}</td><td>${esc(row.impact)}</td><td>${esc(row.restrictionWindow)}</td><td>${esc(row.ruleStatus)}</td><td>${esc(row.tradeAction)}</td></tr>`, "No prop news restrictions are active.");
}
function renderPropDrawdown(data) {
  return propTable("Drawdown Risk", data.drawdownRisk, ["Asset","Firm","Account","Daily Used","Max Used","Daily Limit","Max Limit","Daily Buffer","Max Buffer","Status","Action"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.firm)}</td><td>${esc(row.account)}</td><td>${pct(row.dailyLossUsedPercent)}</td><td>${pct(row.maxDrawdownUsedPercent)}</td><td>${pct(row.dailyLimitPercent)}</td><td>${pct(row.maxLimitPercent)}</td><td>${esc(row.remainingDailyBuffer)}</td><td>${esc(row.remainingMaxBuffer)}</td><td>${esc(row.drawdownStatus)}</td><td>${esc(row.recommendedAction)}</td></tr>`, "No drawdown compliance rows are available.");
}
function renderPropConsistency(data) {
  return propTable("Consistency Risk", data.consistency, ["Asset","Firm","Account","Rule","Largest Trade Share","Distribution","Status","Recommendation"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.firm)}</td><td>${esc(row.account)}</td><td>${esc(row.consistencyRule)}</td><td>${pct(row.largestTradeShare)}</td><td>${esc(row.profitDistribution)}</td><td>${esc(row.status)}</td><td>${esc(row.recommendation)}</td></tr>`, "No consistency rule rows are available.");
}
function renderPropInstrument(data) {
  return propTable("Instrument Restrictions", data.instrumentRestrictions, ["Asset","Firm","Rule Type","Allowed","Reason","Weekend Holding","EA","Copy Trading","Status"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.firm)}</td><td>${esc(row.ruleType)}</td><td>${row.allowed ? "Yes" : "No"}</td><td>${esc(row.restrictionReason)}</td><td>${fmt(row.weekendHoldingAllowed)}</td><td>${fmt(row.eaAllowed)}</td><td>${fmt(row.copyTradingAllowed)}</td><td>${esc(row.status)}</td></tr>`, "No instrument restriction rows are available.");
}
function renderPropBlocked(data) {
  return propTable("Blocked Assets", data.blockedAssets, ["Asset","Firm","Account","Reason","Severity","Expires","Action"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.firm)}</td><td>${esc(row.account)}</td><td>${esc(row.blockReason)}</td><td>${esc(row.severity)}</td><td>${dt(row.expiresAt)}</td><td>${esc(row.recommendedAction)}</td></tr>`, "No prop compliance blocks are active.");
}
function renderPropRecommendations(data) {
  return propTable("Compliance Recommendations", data.recommendations, ["Asset","Firm","Account","Driver","Recommendation","Priority","Expected Effect"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.firm)}</td><td>${esc(row.account)}</td><td>${esc(row.complianceDriver)}</td><td>${esc(row.recommendation)}</td><td>${esc(row.priority)}</td><td>${esc(row.expectedEffect)}</td></tr>`, "No compliance recommendations are available.");
}
function renderPropHeatmap(data) {
  return propTable("Compliance Heatmap", data.heatmap, ["Asset","Compliance Type","State","Score","Confidence"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.complianceType)}</td><td><span class="scanner-status ${badgeClass(row.state)}">${esc(row.state)}</span></td><td>${fmt(row.score)}</td><td>${pct(row.confidence)}</td></tr>`, "No compliance heatmap cells are available.");
}

function renderPropWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Compliance Weights</h2><span>Database configurable</span></div>${table(["Component","Weight","Enabled","Updated"], rows, "No compliance scanner weights are configured.")}</section>`;
}
function renderPropAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.asset)}</td><td>${esc(row.account)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Compliance Alerts</h2><span>${data.alerts?.length || 0} alerts</span></div>${table(["Type","Title","Severity","Asset","Account","Status","Created"], rows, "No prop compliance alerts are recorded.")}</section>`;
}
function renderPropAi(data) {
  const ai = data.aiSummary;
  if (!ai) return `<section class="scanner-panel"><div class="scanner-section-head"><h2>AI Compliance Interpretation</h2><span>No record</span></div><div class="scanner-empty-inline">No AI prop compliance interpretation has been generated.</div></section>`;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Compliance Interpretation</h2><span>${dt(ai.generatedAt)}</span></div><p class="scanner-ai-summary">${esc(ai.summary)}</p><div class="scanner-detail-grid"><article><span>Safest Assets</span><strong>${esc(ai.safestAssets)}</strong></article><article><span>Restricted</span><strong>${esc(ai.restrictedAssets)}</strong></article><article><span>Blocked</span><strong>${esc(ai.blockedAssets)}</strong></article><article><span>Drawdown Risks</span><strong>${esc(ai.drawdownRisks)}</strong></article><article><span>News Restrictions</span><strong>${esc(ai.newsRestrictions)}</strong></article><article><span>Next Step</span><strong>${esc(ai.recommendedNextStep)}</strong></article></div><div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "prop-regenerate-summary")}${actionButton("Save to Logs", "prop-save-summary")}${actionButton("Create Alert", "prop-create-alert")}<a href="${API}${propComplianceRoute}/export" target="_blank" rel="noreferrer">Export Brief</a></div></section>`;
}
function renderPropEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Prop firm compliance cannot be calculated yet.")}</h2><p>${esc(empty.message || "Connect a prop firm account, assign verified prop firm rules, and sync portfolio/account data before running a compliance scan.")}</p><div class="scanner-action-bar"><a href="/workspace/market-intelligence/prop-firm-rules">Open Prop Firm Rules</a><a href="/workspace/portfolio/accounts">Open Portfolio Accounts</a>${actionButton("Sync Prop Rules", "prop-sync-rules")}${actionButton("Run Compliance Scan", "prop-run-scan", "primary")}</div></section>`;
}
function renderPropDetailDrawer() {
  const detail = state.detail;
  if (!detail) return "";
  const asset = detail.asset || {};
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(asset.asset)} Prop Compliance Detail</h2><button type="button" data-close-prop-detail>Close</button></div><section class="scanner-detail-grid"><article><span>Eligibility</span><strong>${esc(asset.tradeEligibility)}</strong><small>${fmt(asset.complianceScore)} / ${pct(asset.confidence)}</small></article><article><span>Firm</span><strong>${esc(asset.firm)}</strong></article><article><span>Account</span><strong>${esc(asset.account)}</strong></article><article><span>Primary Constraint</span><strong>${esc(asset.primaryConstraint)}</strong></article></section>${renderPropMatrix({ matrix: detail.matrix ? [detail.matrix] : [] })}${renderPropNews({ newsRestrictions: detail.newsRestrictions || [] })}${renderPropDrawdown({ drawdownRisk: detail.drawdownRisk || [] })}${renderPropConsistency({ consistency: detail.consistency || [] })}${renderPropInstrument({ instrumentRestrictions: detail.instrumentRestrictions || [] })}${renderPropBlocked({ blockedAssets: detail.blockedAssets || [] })}${renderPropRecommendations({ recommendations: detail.recommendations || [] })}${renderPropHeatmap({ heatmap: detail.heatmap || [] })}<div class="scanner-action-bar compact"><button data-dashboard-action="prop-recalculate">Recalculate Compliance</button><button data-dashboard-action="prop-create-alert">Create Alert</button><a href="${API}${propComplianceRoute}/export" target="_blank" rel="noreferrer">Export Detail</a></div></aside><div class="scanner-drawer-backdrop" data-close-prop-detail></div>`;
}

function renderPropCompliance() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red"><section class="scanner-empty-state"><h2>Loading Prop Firm Compliance Scanner</h2><p>Reading live prop firm rules, accounts, and portfolio compliance records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderPropHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Prop Firm Compliance Scanner</h2><p>${esc(state.error)}</p>${actionButton("Retry", "prop-reload", "primary")}</section></main>`;
    bindPropActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red scanner-dashboard">${renderPropHeader(data)}${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}${renderPropSummary(data)}${data.status === "EMPTY" ? renderPropEmpty(data) : ""}${renderPropMatrix(data)}${renderPropRankings(data)}${renderPropAccounts(data)}${renderPropNews(data)}${renderPropDrawdown(data)}${renderPropConsistency(data)}${renderPropInstrument(data)}${renderPropBlocked(data)}${renderPropRecommendations(data)}${renderPropHeatmap(data)}<section class="scanner-grid scanner-grid-2">${renderPropWeights(data)}${renderPropAlerts(data)}</section>${renderPropAi(data)}${renderPropDetailDrawer()}</main>`;
  bindPropActions();
}

async function openPropDetail(id) {
  try { state.detail = await fetchJson(`${propComplianceRoute}/${id}`); renderPropCompliance(); }
  catch (reason) { state.error = reason.message || "Unable to open prop compliance detail."; renderPropCompliance(); }
}
function bindPropActions() {
  bindActions();
  document.querySelectorAll("[data-prop-open]").forEach(item => item.addEventListener("click", () => openPropDetail(item.dataset.propOpen)));
  document.querySelectorAll("[data-close-prop-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderPropCompliance(); }));
}
async function loadPropCompliance() {
  state = { ...state, loading: true, error: "", detail: null };
  renderPropCompliance();
  try { state.data = await fetchJson(propComplianceRoute); }
  catch (reason) { state.error = reason.message || "Unable to load Prop Firm Compliance Scanner."; }
  finally { state.loading = false; renderPropCompliance(); }
}

const opportunitySummaryCards = [
  ["assetsRanked", "Assets Ranked"], ["eliteOpportunities", "Elite Opportunities"], ["qualifiedOpportunities", "Qualified Opportunities"],
  ["watchlistOpportunities", "Watchlist Opportunities"], ["rejectedOpportunities", "Rejected Opportunities"], ["blockedOpportunities", "Blocked Opportunities"],
  ["buyCandidates", "Buy Candidates"], ["sellCandidates", "Sell Candidates"], ["averageOpportunityScore", "Average Opportunity Score"],
  ["averageConfidenceScore", "Average Confidence Score"], ["averageRiskScore", "Average Risk Score"], ["averageComplianceScore", "Average Compliance Score"],
  ["rankingEngineHealth", "Ranking Engine Health"]
];

function renderOpportunityHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Decision Output</p><h1>Opportunity Ranking Engine</h1><p>Rank live trading opportunities using scanner scores, confidence, risk, compliance, institutional alignment, sentiment, macro bias, and market structure confirmation.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Scanner Inputs Only</span><strong>Last Ranking Run: ${dt(badges.lastRankingRun)}</strong><strong>Ranking Engine Health: ${esc(badges.rankingEngineHealth)}</strong></aside>
    <div class="scanner-action-bar">${actionButton("Run Ranking", "opportunity-run-ranking", "primary")}${actionButton("Refresh Rankings", "opportunity-reload")}${actionButton("Recalculate Scores", "opportunity-recalculate")}${actionButton("Configure Weights", "opportunity-configure")}<a href="${API}${opportunitiesRoute}/export" target="_blank" rel="noreferrer">Export Ranking Report</a>${actionButton("Send Qualified to Trades", "opportunity-send-qualified")}</div>
  </section>`;
}

function renderOpportunitySummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${opportunitySummaryCards.map(([key, label]) => `<article class="scanner-kpi"><span>${label}</span><strong>${fmt(summary[key])}</strong><small>Production scanner records only</small></article>`).join("")}</section>`;
}

function renderOpportunityRankings(data) {
  const rows = (data.rankings || []).map(row => `<tr>
    <td>${fmt(row.rank)}</td><td><button class="link-button" type="button" data-opportunity-open="${esc(row.assetId || row.asset)}">${esc(row.asset)}</button></td><td>${esc(row.assetClass)}</td><td>${esc(row.direction)}</td>
    <td>${fmt(row.opportunityScore)}</td><td>${fmt(row.confidenceScore)}</td><td>${fmt(row.riskScore)}</td><td>${fmt(row.complianceScore)}</td>
    <td>${fmt(row.trendScore)}</td><td>${fmt(row.structureScore)}</td><td>${fmt(row.momentumScore)}</td><td>${fmt(row.volatilityScore)}</td><td>${fmt(row.liquidityScore)}</td>
    <td>${fmt(row.institutionalScore)}</td><td>${fmt(row.sentimentScore)}</td><td>${fmt(row.macroScore)}</td><td>${fmt(row.eventScore)}</td>
    <td>${esc(row.mainReason)}</td><td><span class="scanner-status ${badgeClass(row.qualification)}">${esc(row.qualification)}</span></td><td>${dt(row.lastRanked)}</td>
    <td><div class="scanner-row-actions"><button data-opportunity-open="${esc(row.assetId || row.asset)}">Open Detail</button><button data-dashboard-action="opportunity-recalculate">Recalculate</button><button data-dashboard-action="opportunity-send-qualified">Send to Qualified Trades</button><button data-dashboard-action="opportunity-create-package">Create Package</button><button data-dashboard-action="opportunity-create-alert">Create Alert</button><a href="${API}${opportunitiesRoute}/${esc(row.assetId || row.asset)}" target="_blank" rel="noreferrer">Export Row</a></div></td>
  </tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Main Opportunity Ranking Table</h2><span>${data.rankings?.length || 0} live rankings</span></div>${table(["Rank","Asset","Asset Class","Direction","Opportunity","Confidence","Risk","Compliance","Trend","Structure","Momentum","Volatility","Liquidity","Institutional","Sentiment","Macro","Event","Main Reason","Qualification","Last Ranked","Actions"], rows, "No opportunity rankings have been calculated yet.")}</section>`;
}

function oppPanel(title, rows, headers, mapRow, emptyText) {
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>${title}</h2><span>${rows?.length || 0} rows</span></div>${table(headers, (rows || []).map(mapRow), emptyText)}</section>`;
}

function renderOpportunityBuy(data) {
  return oppPanel("Buy Opportunity Panel", data.buy, ["Rank","Asset","Buy Strength","Supporting Scores","Risk","Compliance","Confidence","Reason","Qualification"], row => `<tr><td>${fmt(row.rank)}</td><td>${esc(row.asset)}</td><td>${esc(row.buyStrength)}</td><td>${esc(row.supportingScores)}</td><td>${fmt(row.riskScore)}</td><td>${fmt(row.complianceScore)}</td><td>${fmt(row.confidence)}</td><td>${esc(row.reason)}</td><td>${esc(row.qualification)}</td></tr>`, "No live buy opportunities are calculated.");
}
function renderOpportunitySell(data) {
  return oppPanel("Sell Opportunity Panel", data.sell, ["Rank","Asset","Sell Strength","Supporting Scores","Risk","Compliance","Confidence","Reason","Qualification"], row => `<tr><td>${fmt(row.rank)}</td><td>${esc(row.asset)}</td><td>${esc(row.sellStrength)}</td><td>${esc(row.supportingScores)}</td><td>${fmt(row.riskScore)}</td><td>${fmt(row.complianceScore)}</td><td>${fmt(row.confidence)}</td><td>${esc(row.reason)}</td><td>${esc(row.qualification)}</td></tr>`, "No live sell opportunities are calculated.");
}
function renderOpportunityWatchlist(data) {
  return oppPanel("Watchlist Panel", data.watchlist, ["Asset","Current Score","Missing Requirement","Weakest Component","Required Improvement","Recommended Action"], row => `<tr><td>${esc(row.asset)}</td><td>${fmt(row.currentScore)}</td><td>${esc(row.missingRequirement)}</td><td>${esc(row.weakestComponent)}</td><td>${esc(row.requiredImprovement)}</td><td>${esc(row.recommendedAction)}</td></tr>`, "No watchlist opportunities are available.");
}
function renderOpportunityBlocked(data) {
  return oppPanel("Rejected / Blocked Panel", data.blocked, ["Asset","Status","Blocking Reason","Blocking Scanner","Risk","Compliance","Confidence","Retry After","Recommended Action"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${esc(row.blockingReason)}</td><td>${esc(row.blockingScanner)}</td><td>${fmt(row.riskScore)}</td><td>${fmt(row.complianceScore)}</td><td>${fmt(row.confidence)}</td><td>${dt(row.canRetryAfter)}</td><td>${esc(row.recommendedAction)}</td></tr>`, "No rejected or blocked opportunities are recorded.");
}
function renderOpportunityHistory(data) {
  return oppPanel("Ranking History", data.history, ["Time","Asset","Previous Rank","Current Rank","Rank Change","Previous Score","Current Score","Score Change","Trigger"], row => `<tr><td>${dt(row.time)}</td><td>${esc(row.asset)}</td><td>${fmt(row.previousRank)}</td><td>${fmt(row.currentRank)}</td><td>${fmt(row.rankChange)}</td><td>${fmt(row.previousScore)}</td><td>${fmt(row.currentScore)}</td><td>${fmt(row.scoreChange)}</td><td>${esc(row.trigger)}</td></tr>`, "No ranking history is recorded yet.");
}
function renderOpportunityAgreement(data) {
  return oppPanel("Signal Agreement Panel", data.agreement, ["Asset","Trend","Structure","Momentum","Liquidity","Institutional","Sentiment","Macro","Risk","Compliance","Agreement","Conflict","Interpretation"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.trend)}</td><td>${esc(row.structure)}</td><td>${esc(row.momentum)}</td><td>${esc(row.liquidity)}</td><td>${esc(row.institutional)}</td><td>${esc(row.sentiment)}</td><td>${esc(row.macro)}</td><td>${esc(row.risk)}</td><td>${esc(row.compliance)}</td><td>${fmt(row.agreementScore)}</td><td><span class="scanner-status ${badgeClass(row.conflictLevel)}">${esc(row.conflictLevel)}</span></td><td>${esc(row.interpretation)}</td></tr>`, "No signal agreement rows are available.");
}
function renderOpportunityReadiness(data) {
  return oppPanel("Opportunity Readiness Panel", data.readiness, ["Asset","Status","Score","Confidence","Risk","Compliance","Blocker Clear","Conflict Clear","Freshness","Source Health","Recommendation"], row => `<tr><td>${esc(row.asset)}</td><td><span class="scanner-status ${badgeClass(row.status)}">${esc(row.status)}</span></td><td>${row.opportunityThresholdPassed ? "Pass" : "Fail"}</td><td>${row.confidenceThresholdPassed ? "Pass" : "Fail"}</td><td>${row.riskThresholdPassed ? "Pass" : "Fail"}</td><td>${row.complianceThresholdPassed ? "Pass" : "Fail"}</td><td>${row.criticalBlockerClear ? "Pass" : "Fail"}</td><td>${row.conflictClear ? "Pass" : "Fail"}</td><td>${row.freshnessPassed ? "Pass" : "Fail"}</td><td>${row.sourceHealthPassed ? "Pass" : "Fail"}</td><td>${esc(row.recommendation)}</td></tr>`, "No opportunity readiness checks are available.");
}
function renderOpportunityWeights(data) {
  const rows = (data.weights || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.weight)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${row.required ? "Required" : "Optional"}</td><td>${row.approved ? "Approved" : "Unapproved"}</td><td>${dt(row.updatedAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Weight Configuration</h2><span>Database profile</span></div>${table(["Component","Weight","Enabled","Required","Approved","Updated"], rows, "No opportunity weights are configured.")}</section>`;
}
function renderOpportunityAlerts(data) {
  const rows = (data.alerts || []).map(row => `<tr><td>${esc(row.alertType)}</td><td>${esc(row.title)}</td><td>${esc(row.severity)}</td><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Alerts</h2><span>${data.alerts?.length || 0} alerts</span></div>${table(["Type","Title","Severity","Asset","Status","Created"], rows, "No opportunity alerts are recorded.")}</section>`;
}
function renderOpportunityAi(data) {
  const ai = data.aiSummary;
  if (!ai) return `<section class="scanner-panel"><div class="scanner-section-head"><h2>AI Opportunity Ranking Interpretation</h2><span>No record</span></div><div class="scanner-empty-inline">No AI opportunity interpretation has been generated.</div></section>`;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Opportunity Ranking Interpretation</h2><span>${dt(ai.generatedAt)}</span></div><p class="scanner-ai-summary">${esc(ai.summary)}</p><div class="scanner-detail-grid"><article><span>Top Ranked</span><strong>${esc(ai.topRankedOpportunities)}</strong></article><article><span>Best Buys</span><strong>${esc(ai.bestBuyCandidates)}</strong></article><article><span>Best Sells</span><strong>${esc(ai.bestSellCandidates)}</strong></article><article><span>Rejected</span><strong>${esc(ai.rejectedAssets)}</strong></article><article><span>Main Risks</span><strong>${esc(ai.mainRisks)}</strong></article><article><span>Next Action</span><strong>${esc(ai.recommendedNextAction)}</strong></article></div><div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "opportunity-regenerate-summary")}${actionButton("Save to Logs", "opportunity-save-summary")}${actionButton("Create Alert", "opportunity-create-alert")}<a href="${API}${opportunitiesRoute}/export" target="_blank" rel="noreferrer">Export Brief</a></div></section>`;
}
function renderOpportunityEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "No opportunity rankings have been calculated yet.")}</h2><p>${esc(empty.message || "Run all required scanner modules, then execute the Opportunity Ranking Engine to generate ranked trading opportunities.")}</p><div class="scanner-action-bar">${actionButton("Run Ranking", "opportunity-run-ranking", "primary")}<a href="/workspace/universe-scanner/dashboard">Open Scanner Dashboard</a><a href="/workspace/universe-scanner/risk">Open Risk Scanner</a><a href="/workspace/universe-scanner/prop-compliance">Open Prop Compliance Scanner</a></div></section>`;
}
function renderOpportunityDetailDrawer() {
  const detail = state.detail;
  if (!detail) return "";
  const asset = detail.asset || {};
  const breakdownRows = (detail.breakdown || []).map(row => `<tr><td>${esc(row.componentName)}</td><td>${fmt(row.rawScore)}</td><td>${fmt(row.normalizedScore)}</td><td>${fmt(row.weight)}</td><td>${fmt(row.weightedContribution)}</td><td>${fmt(row.confidence)}</td><td>${esc(row.sourceStatus)}</td></tr>`);
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(asset.asset)} Opportunity Detail</h2><button type="button" data-close-opportunity-detail>Close</button></div><section class="scanner-detail-grid"><article><span>Final Opportunity Score</span><strong>${fmt(asset.opportunityScore)}</strong></article><article><span>Direction</span><strong>${esc(asset.direction)}</strong></article><article><span>Qualification</span><strong>${esc(asset.qualification)}</strong></article><article><span>Main Ranking Reason</span><strong>${esc(asset.mainReason)}</strong></article><article><span>Missing Inputs</span><strong>${esc((detail.missingInputs || []).join(", ") || "None")}</strong></article><article><span>Confidence</span><strong>${fmt(asset.confidenceScore)}</strong></article></section><section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Score Breakdown</h2><span>Weight contribution</span></div>${table(["Component","Raw","Normalized","Weight","Contribution","Confidence","Source"], breakdownRows, "No score breakdown rows are available.")}</section>${renderOpportunityAgreement({ agreement: detail.agreement ? [detail.agreement] : [] })}${renderOpportunityReadiness({ readiness: detail.readiness ? [detail.readiness] : [] })}${renderOpportunityHistory({ history: detail.history || [] })}<div class="scanner-action-bar compact"><button data-dashboard-action="opportunity-recalculate">Recalculate Opportunity</button><button data-dashboard-action="opportunity-send-qualified">Send to Qualified Trades</button><button data-dashboard-action="opportunity-create-package">Create Intelligence Package</button><a href="/workspace/universe-scanner/dashboard">Open Scanner Details</a><button data-dashboard-action="opportunity-create-alert">Create Alert</button><a href="${API}${opportunitiesRoute}/export" target="_blank" rel="noreferrer">Export Detail</a></div></aside><div class="scanner-drawer-backdrop" data-close-opportunity-detail></div>`;
}

function renderOpportunities() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-green"><section class="scanner-empty-state"><h2>Loading Opportunity Ranking Engine</h2><p>Reading live scanner outputs and production opportunity weights.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderOpportunityHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Opportunity Ranking Engine</h2><p>${esc(state.error)}</p>${actionButton("Retry", "opportunity-reload", "primary")}</section></main>`;
    bindOpportunityActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-green scanner-dashboard">${renderOpportunityHeader(data)}${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}${renderOpportunitySummary(data)}${data.status === "EMPTY" ? renderOpportunityEmpty(data) : ""}${renderOpportunityRankings(data)}${renderOpportunityBuy(data)}${renderOpportunitySell(data)}${renderOpportunityWatchlist(data)}${renderOpportunityBlocked(data)}${renderOpportunityHistory(data)}${renderOpportunityAgreement(data)}${renderOpportunityReadiness(data)}<section class="scanner-grid scanner-grid-2">${renderOpportunityWeights(data)}${renderOpportunityAlerts(data)}</section>${renderOpportunityAi(data)}${renderOpportunityDetailDrawer()}</main>`;
  bindOpportunityActions();
}

async function openOpportunityDetail(id) {
  try { state.detail = await fetchJson(`${opportunitiesRoute}/${id}`); renderOpportunities(); }
  catch (reason) { state.error = reason.message || "Unable to open opportunity detail."; renderOpportunities(); }
}
function bindOpportunityActions() {
  bindActions();
  document.querySelectorAll("[data-opportunity-open]").forEach(item => item.addEventListener("click", () => openOpportunityDetail(item.dataset.opportunityOpen)));
  document.querySelectorAll("[data-close-opportunity-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderOpportunities(); }));
}
async function loadOpportunities() {
  state = { ...state, loading: true, error: "", detail: null };
  renderOpportunities();
  try { state.data = await fetchJson(opportunitiesRoute); }
  catch (reason) { state.error = reason.message || "Unable to load Opportunity Ranking Engine."; }
  finally { state.loading = false; renderOpportunities(); }
}

const qualifiedSummaryCards = [
  ["qualifiedCandidates", "Qualified Candidates"], ["readyForScoring", "Ready for Scoring"], ["readyForPackage", "Ready for Package"],
  ["reviewRequired", "Review Required"], ["blockedAfterQualification", "Blocked After Qualification"], ["buyCandidates", "Buy Candidates"],
  ["sellCandidates", "Sell Candidates"], ["propSafeCandidates", "Prop-Safe Candidates"], ["highConfidenceCandidates", "High Confidence Candidates"],
  ["averageOpportunityScore", "Average Opportunity Score"], ["averageRiskScore", "Average Risk Score"], ["averageComplianceScore", "Average Compliance Score"],
  ["card3OutputReadiness", "Card 3 Output Readiness"]
];

function renderQualifiedHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Final Output</p><h1>Qualified Trades Center</h1><p>Review live trade candidates that passed opportunity ranking, risk filtering, compliance checks, confidence thresholds, and scanner readiness validation.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Qualified Candidates Only</span><strong>Last Qualification Run: ${dt(badges.lastQualificationRun)}</strong><strong>Card 3 Output Status: ${esc(badges.card3OutputStatus)}</strong></aside>
    <div class="scanner-action-bar">${actionButton("Refresh Candidates", "qualified-reload", "primary")}${actionButton("Validate Selected", "qualified-validate")}${actionButton("Create Intelligence Package", "qualified-create-package")}${actionButton("Send to Scoring Engine", "qualified-send-scoring")}<a href="${API}${qualifiedTradesRoute}/export" target="_blank" rel="noreferrer">Export Qualified Trades</a></div>
  </section>`;
}

function renderQualifiedSummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${qualifiedSummaryCards.map(([key, label]) => `<article class="scanner-kpi"><span>${label}</span><strong>${fmt(summary[key])}</strong><small>Production candidates only</small></article>`).join("")}</section>`;
}

function renderQualifiedCandidates(data) {
  const rows = (data.candidates || []).map(row => `<tr><td>${esc(row.candidateId)}</td><td><button class="link-button" type="button" data-qualified-open="${esc(row.candidateId)}">${esc(row.asset)}</button></td><td>${esc(row.assetClass)}</td><td>${esc(row.direction)}</td><td>${fmt(row.opportunityScore)}</td><td>${fmt(row.confidenceScore)}</td><td>${fmt(row.riskScore)}</td><td>${fmt(row.complianceScore)}</td><td>${fmt(row.signalAgreement)}</td><td>${esc(row.mainReason)}</td><td><span class="scanner-status ${badgeClass(row.qualificationStatus)}">${esc(row.qualificationStatus)}</span></td><td>${esc(row.packageStatus)}</td><td>${esc(row.scoringStatus)}</td><td>${dt(row.createdAt)}</td><td>${dt(row.expiresAt)}</td><td><div class="scanner-row-actions"><button data-qualified-open="${esc(row.candidateId)}">Open Detail</button><button data-dashboard-action="qualified-validate">Validate Candidate</button><button data-dashboard-action="qualified-create-package">Create Package</button><button data-dashboard-action="qualified-send-scoring">Send to Scoring</button><button data-dashboard-action="qualified-review">Mark Review Required</button><button data-dashboard-action="qualified-expire">Expire Candidate</button><button data-dashboard-action="qualified-create-alert">Create Alert</button><a href="${API}${qualifiedTradesRoute}/${esc(row.candidateId)}" target="_blank" rel="noreferrer">Export Row</a></div></td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Qualified Trades Table</h2><span>${data.candidates?.length || 0} candidates</span></div>${table(["Candidate ID","Asset","Asset Class","Direction","Opportunity","Confidence","Risk","Compliance","Signal Agreement","Main Reason","Qualification Status","Package Status","Scoring Status","Created","Expires","Actions"], rows, "No qualified trade candidates are available yet.")}</section>`;
}

function qPanel(title, rows, headers, mapRow, emptyText) {
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>${title}</h2><span>${rows?.length || 0} rows</span></div>${table(headers, (rows || []).map(mapRow), emptyText)}</section>`;
}
function renderQualifiedReadiness(data) {
  return qPanel("Candidate Readiness Panel", data.readiness, ["Candidate","Asset","Opportunity","Risk","Compliance","Confidence","Agreement","Source","Dependency","Freshness","Expiry","Score","Status"], row => `<tr><td>${esc(row.candidateId)}</td><td>${esc(row.asset)}</td><td>${esc(row.opportunityPassed)}</td><td>${esc(row.riskPassed)}</td><td>${esc(row.compliancePassed)}</td><td>${esc(row.confidencePassed)}</td><td>${esc(row.signalAgreementPassed)}</td><td>${esc(row.sourceHealthPassed)}</td><td>${esc(row.dependencyHealthPassed)}</td><td>${esc(row.freshnessPassed)}</td><td>${esc(row.expiryPassed)}</td><td>${fmt(row.readinessScore)}</td><td><span class="scanner-status ${badgeClass(row.status)}">${esc(row.status)}</span></td></tr>`, "No readiness checks are available.");
}
function renderReadyForPackage(data) {
  return qPanel("Ready for Package Panel", data.readyForPackage, ["Candidate","Asset","Direction","Opportunity","Confidence","Readiness","Package Type","Recommended Package","Action"], row => `<tr><td>${esc(row.candidateId)}</td><td>${esc(row.asset)}</td><td>${esc(row.direction)}</td><td>${fmt(row.opportunityScore)}</td><td>${fmt(row.confidence)}</td><td>${fmt(row.readinessScore)}</td><td>${esc(row.packageType)}</td><td>${esc(row.recommendedPackage)}</td><td>${esc(row.action)}</td></tr>`, "No candidates are ready for package creation.");
}
function renderReadyForScoring(data) {
  return qPanel("Ready for Scoring Panel", data.readyForScoring, ["Candidate","Asset","Direction","Opportunity","Risk","Compliance","Confidence","Eligibility","Scoring Model","Action"], row => `<tr><td>${esc(row.candidateId)}</td><td>${esc(row.asset)}</td><td>${esc(row.direction)}</td><td>${fmt(row.opportunityScore)}</td><td>${fmt(row.riskScore)}</td><td>${fmt(row.complianceScore)}</td><td>${fmt(row.confidence)}</td><td>${esc(row.scoringEligibility)}</td><td>${esc(row.scoringModel)}</td><td>${esc(row.action)}</td></tr>`, "No candidates are ready for scoring.");
}
function renderReviewRequired(data) {
  return qPanel("Review Required Panel", data.reviewRequired, ["Candidate","Asset","Direction","Reason","Weakest Component","Severity","Recommended Action","Assigned To","Status"], row => `<tr><td>${esc(row.candidateId)}</td><td>${esc(row.asset)}</td><td>${esc(row.direction)}</td><td>${esc(row.reviewReason)}</td><td>${esc(row.weakestComponent)}</td><td>${esc(row.severity)}</td><td>${esc(row.recommendedAction)}</td><td>${esc(row.assignedTo)}</td><td>${esc(row.status)}</td></tr>`, "No candidates require review.");
}
function renderBlockedExpired(data) {
  return qPanel("Blocked / Expired Panel", data.blockedExpired, ["Candidate","Asset","Direction","Status","Blocking Reason","Expired At","Can Retry","Recommended Action"], row => `<tr><td>${esc(row.candidateId)}</td><td>${esc(row.asset)}</td><td>${esc(row.direction)}</td><td>${esc(row.status)}</td><td>${esc(row.blockingReason)}</td><td>${dt(row.expiredAt)}</td><td>${row.canRetry ? "Yes" : "No"}</td><td>${esc(row.recommendedAction)}</td></tr>`, "No blocked or expired candidates are recorded.");
}
function renderQualifiedAi(data) {
  const ai = data.aiSummary;
  if (!ai) return `<section class="scanner-panel"><div class="scanner-section-head"><h2>AI Qualified Trades Interpretation</h2><span>No record</span></div><div class="scanner-empty-inline">No AI qualified trade interpretation has been generated.</div></section>`;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Qualified Trades Interpretation</h2><span>${dt(ai.generatedAt)}</span></div><p class="scanner-ai-summary">${esc(ai.summary)}</p><div class="scanner-detail-grid"><article><span>Best Qualified</span><strong>${esc(ai.bestQualifiedCandidates)}</strong></article><article><span>Ready for Scoring</span><strong>${esc(ai.readyForScoring)}</strong></article><article><span>Review Required</span><strong>${esc(ai.reviewRequired)}</strong></article><article><span>Blocked / Expired</span><strong>${esc(ai.blockedOrExpired)}</strong></article><article><span>Major Risks</span><strong>${esc(ai.majorRisks)}</strong></article><article><span>Next Action</span><strong>${esc(ai.recommendedNextAction)}</strong></article></div><div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "qualified-regenerate-summary")}${actionButton("Save to Logs", "qualified-save-summary")}${actionButton("Create Alert", "qualified-create-alert")}<a href="${API}${qualifiedTradesRoute}/export" target="_blank" rel="noreferrer">Export Brief</a></div></section>`;
}
function renderQualifiedEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "No qualified trade candidates are available yet.")}</h2><p>${esc(empty.message || "Run the Opportunity Ranking Engine and complete risk, compliance, and readiness checks before candidates can appear here.")}</p><div class="scanner-action-bar"><a href="/workspace/universe-scanner/opportunities">Open Opportunity Ranking</a><a href="/workspace/universe-scanner/opportunities">Run Ranking</a><a href="/workspace/universe-scanner/risk">Open Risk Scanner</a><a href="/workspace/universe-scanner/prop-compliance">Open Prop Compliance Scanner</a></div></section>`;
}
function renderQualifiedDetailDrawer() {
  const detail = state.detail;
  if (!detail) return "";
  const candidate = detail.candidate || {};
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(candidate.asset)} Candidate Detail</h2><button type="button" data-close-qualified-detail>Close</button></div><section class="scanner-detail-grid"><article><span>Candidate ID</span><strong>${esc(candidate.candidateId)}</strong></article><article><span>Direction</span><strong>${esc(candidate.direction)}</strong></article><article><span>Opportunity</span><strong>${fmt(candidate.opportunityScore)}</strong></article><article><span>Risk</span><strong>${fmt(candidate.riskScore)}</strong></article><article><span>Compliance</span><strong>${fmt(candidate.complianceScore)}</strong></article><article><span>Status</span><strong>${esc(candidate.qualificationStatus)}</strong></article></section>${renderQualifiedReadiness({ readiness: detail.readiness ? [detail.readiness] : [] })}${renderReadyForPackage({ readyForPackage: detail.packageHistory || [] })}${renderReadyForScoring({ readyForScoring: detail.scoringHistory || [] })}${renderReviewRequired({ reviewRequired: detail.reviews || [] })}${renderBlockedExpired({ blockedExpired: detail.blockedExpired || [] })}<div class="scanner-action-bar compact"><button data-dashboard-action="qualified-validate">Validate Candidate</button><button data-dashboard-action="qualified-create-package">Create Package</button><button data-dashboard-action="qualified-send-scoring">Send to Scoring Engine</button><a href="/workspace/universe-scanner/opportunities">Open Opportunity Ranking</a><a href="/workspace/universe-scanner/risk">Open Risk Scanner</a><a href="/workspace/universe-scanner/prop-compliance">Open Prop Compliance</a><button data-dashboard-action="qualified-create-alert">Create Alert</button><a href="${API}${qualifiedTradesRoute}/export" target="_blank" rel="noreferrer">Export Candidate</a></div></aside><div class="scanner-drawer-backdrop" data-close-qualified-detail></div>`;
}

function renderQualifiedTrades() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-green"><section class="scanner-empty-state"><h2>Loading Qualified Trades Center</h2><p>Reading production qualified trade candidates.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderQualifiedHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Qualified Trades Center</h2><p>${esc(state.error)}</p>${actionButton("Retry", "qualified-reload", "primary")}</section></main>`;
    bindQualifiedActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-green scanner-dashboard">${renderQualifiedHeader(data)}${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}${renderQualifiedSummary(data)}${data.status === "EMPTY" ? renderQualifiedEmpty(data) : ""}${renderQualifiedCandidates(data)}${renderQualifiedReadiness(data)}${renderReadyForPackage(data)}${renderReadyForScoring(data)}${renderReviewRequired(data)}${renderBlockedExpired(data)}${renderQualifiedAi(data)}${renderQualifiedDetailDrawer()}</main>`;
  bindQualifiedActions();
}
async function openQualifiedDetail(id) {
  try { state.detail = await fetchJson(`${qualifiedTradesRoute}/${id}`); renderQualifiedTrades(); }
  catch (reason) { state.error = reason.message || "Unable to open qualified trade detail."; renderQualifiedTrades(); }
}
function bindQualifiedActions() {
  bindActions();
  document.querySelectorAll("[data-qualified-open]").forEach(item => item.addEventListener("click", () => openQualifiedDetail(item.dataset.qualifiedOpen)));
  document.querySelectorAll("[data-close-qualified-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderQualifiedTrades(); }));
}
async function loadQualifiedTrades() {
  state = { ...state, loading: true, error: "", detail: null };
  renderQualifiedTrades();
  try { state.data = await fetchJson(qualifiedTradesRoute); }
  catch (reason) { state.error = reason.message || "Unable to load Qualified Trades Center."; }
  finally { state.loading = false; renderQualifiedTrades(); }
}

const aiSummaryCards = [
  ["aiInsightsGenerated", "AI Insights Generated"], ["topOpportunitiesExplained", "Top Opportunities Explained"], ["rejectedAssetsExplained", "Rejected Assets Explained"],
  ["riskNarrativesGenerated", "Risk Narratives Generated"], ["conflictSummariesGenerated", "Conflict Summaries Generated"], ["qualifiedCandidateSummaries", "Qualified Candidate Summaries"],
  ["humanReviewSuggestions", "Human Review Suggestions"], ["aiConfidenceAverage", "AI Confidence Average"], ["groundingCompleteness", "Grounding Completeness"],
  ["ungroundedOutputBlocks", "Ungrounded Output Blocks"], ["latestInsightStatus", "Latest Insight Status"], ["aiEngineHealth", "AI Engine Health"]
];

function renderAiHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header"><div><p class="scanner-eyebrow">Card 03 / AI Interpretation</p><h1>AI Opportunity Insights Center</h1><p>Generate AI explanations, opportunity narratives, risk summaries, scanner interpretations, and decision-support insights from live universe scanner outputs.</p></div><aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Scanner Outputs Only</span><strong>Last AI Generation: ${dt(badges.lastAiGeneration)}</strong><strong>AI Confidence Score: ${fmt(badges.aiConfidenceScore)}</strong></aside><div class="scanner-action-bar">${actionButton("Generate Insights", "ai-generate", "primary")}${actionButton("Refresh Insights", "ai-reload")}${actionButton("Regenerate AI Summary", "ai-regenerate")}${actionButton("Save to Logs", "ai-generate")}<a href="${API}${aiInsightsRoute}/export" target="_blank" rel="noreferrer">Export AI Brief</a></div></section>`;
}
function renderAiSummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${aiSummaryCards.map(([key, label]) => `<article class="scanner-kpi"><span>${label}</span><strong>${fmt(summary[key])}</strong><small>Grounded scanner output</small></article>`).join("")}</section>`;
}
function renderUniverseAi(data) {
  const ai = data.universeSummary;
  if (!ai) return `<section class="scanner-panel"><div class="scanner-section-head"><h2>AI Universe Scanner Interpretation</h2><span>No record</span></div><div class="scanner-empty-inline">No grounded AI universe summary is available.</div></section>`;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Universe Scanner Interpretation</h2><span>${esc(ai.groundingStatus)} / ${fmt(ai.confidenceScore)}</span></div><p class="scanner-ai-summary">${esc(ai.summary)}</p><div class="scanner-detail-grid"><article><span>Missing Inputs</span><strong>${esc(ai.missingInputs || "None")}</strong></article><article><span>Freshness</span><strong>${dt(ai.sourceFreshness)}</strong></article><article><span>Grounding</span><strong>${esc(ai.groundingStatus)}</strong></article></div></section>`;
}
function aiTable(title, rows, headers, mapRow, emptyText) {
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>${title}</h2><span>${rows?.length || 0} rows</span></div>${table(headers, (rows || []).map(mapRow), emptyText)}</section>`;
}
function renderTopNarratives(data) {
  return aiTable("Top Opportunity Narratives", data.topOpportunities, ["Asset","Direction","Opportunity","Confidence","Risk","Compliance","Why Ranked High","Supporting","Opposing","Risk Warnings","Next Step"], row => `<tr><td><button class="link-button" data-ai-open="${esc(row.insightId)}">${esc(row.asset)}</button></td><td>${esc(row.direction)}</td><td>${fmt(row.opportunityScore)}</td><td>${fmt(row.confidenceScore)}</td><td>${fmt(row.riskScore)}</td><td>${fmt(row.complianceScore)}</td><td>${esc(row.whyRankedHigh)}</td><td>${esc(row.supportingFactors)}</td><td>${esc(row.opposingFactors)}</td><td>${esc(row.riskWarnings)}</td><td>${esc(row.recommendedNextStep)}</td></tr>`, "No top opportunity narratives are available.");
}
function renderRejectedNarratives(data) {
  return aiTable("Rejected / Blocked Asset Narratives", data.rejectedBlocked, ["Asset","Status","Reason","Weakest Component","Risk Driver","Compliance Driver","Missing Data","Recommended Fix","Can Retry"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${esc(row.blockingReason)}</td><td>${esc(row.weakestScannerComponent)}</td><td>${fmt(row.riskDriver)}</td><td>${fmt(row.complianceDriver)}</td><td>${esc(row.missingData)}</td><td>${esc(row.recommendedFix)}</td><td>${esc(row.canRetry)}</td></tr>`, "No rejected or blocked narratives are available.");
}
function renderAgreementAi(data) {
  return aiTable("Scanner Agreement Interpretation", data.agreement, ["Asset","Trend","Structure","Momentum","Liquidity","Institutional","Sentiment","Macro","Risk","Compliance","Agreement","Conflict","Interpretation"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.trend)}</td><td>${esc(row.structure)}</td><td>${esc(row.momentum)}</td><td>${esc(row.liquidity)}</td><td>${esc(row.institutional)}</td><td>${esc(row.sentiment)}</td><td>${esc(row.macro)}</td><td>${esc(row.risk)}</td><td>${esc(row.compliance)}</td><td>${fmt(row.agreementScore)}</td><td>${esc(row.conflictLevel)}</td><td>${esc(row.interpretation)}</td></tr>`, "No scanner agreement interpretation is available.");
}
function renderConflictAi(data) {
  return aiTable("Conflict Explanation Panel", data.conflicts, ["Asset","Conflict Type","Modules","Severity","AI Explanation","Resolution"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.conflictType)}</td><td>${esc(row.modulesInvolved)}</td><td>${esc(row.severity)}</td><td>${esc(row.aiExplanation)}</td><td>${esc(row.recommendedResolution)}</td></tr>`, "No high-conflict scanner explanations are available.");
}
function renderRiskAiPanel(data) {
  return aiTable("Risk Narrative Panel", data.riskNarratives, ["Asset","Narrative","Risk Driver","Risk Score","Recommended Control"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.narrative)}</td><td>${esc(row.riskDriver)}</td><td>${fmt(row.riskScore)}</td><td>${esc(row.recommendedControl)}</td></tr>`, "No risk narratives are available.");
}
function renderComplianceAiPanel(data) {
  return aiTable("Compliance Narrative Panel", data.complianceNarratives, ["Asset","Narrative","Compliance Score","Warning","Recommended Action"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.narrative)}</td><td>${fmt(row.complianceScore)}</td><td>${esc(row.complianceWarning)}</td><td>${esc(row.recommendedAction)}</td></tr>`, "No compliance narratives are available.");
}
function renderReviewAi(data) {
  return aiTable("Human Review Suggestions", data.reviewSuggestions, ["Asset","Reason","Severity","Reviewer Role","Recommended Action"], row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.reasonForReview)}</td><td>${esc(row.severity)}</td><td>${esc(row.reviewerRole)}</td><td>${esc(row.recommendedAction)}</td></tr>`, "No human review suggestions are available.");
}
function renderAiEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "AI opportunity insights cannot be generated yet.")}</h2><p>${esc(empty.message || "Run the Universe Scanner, Opportunity Ranking Engine, Risk Scanner, and Qualified Trades validation before generating AI insights.")}</p><div class="scanner-action-bar"><a href="/workspace/universe-scanner/opportunities">Open Opportunity Ranking</a><a href="/workspace/universe-scanner/qualified-trades">Open Qualified Trades</a><a href="/workspace/universe-scanner/dashboard">Run Scanner Dashboard</a>${actionButton("Run AI Insight Generation", "ai-generate", "primary")}</div></section>`;
}
function renderAiDetailDrawer() {
  const detail = state.detail;
  if (!detail) return "";
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(detail.title || detail.asset || "AI Insight Detail")}</h2><button type="button" data-close-ai-detail>Close</button></div><section class="scanner-detail-grid"><article><span>Insight ID</span><strong>${esc(detail.insightId || detail.id)}</strong></article><article><span>Type</span><strong>${esc(detail.insightType || "Narrative")}</strong></article><article><span>Asset</span><strong>${esc(detail.asset)}</strong></article><article><span>Confidence</span><strong>${fmt(detail.confidenceScore)}</strong></article><article><span>Grounding</span><strong>${esc(detail.groundingStatus)}</strong></article><article><span>Missing Inputs</span><strong>${esc(detail.missingInputs || "None")}</strong></article></section><section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Generated Summary</h2><span>${dt(detail.generatedAt)}</span></div><p class="scanner-ai-summary">${esc(detail.summary || detail.whyRankedHigh || detail.narrative || detail.aiExplanation || detail.reasonForReview)}</p></section><div class="scanner-action-bar compact"><button data-dashboard-action="ai-regenerate">Regenerate Insight</button><button data-dashboard-action="ai-mark-reviewed">Mark Reviewed</button><button data-dashboard-action="ai-create-alert">Create Alert</button><a href="${API}${aiInsightsRoute}/export" target="_blank" rel="noreferrer">Export Insight</a><a href="/workspace/universe-scanner/opportunities">Open Related Opportunity</a></div></aside><div class="scanner-drawer-backdrop" data-close-ai-detail></div>`;
}
function renderAiInsights() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-violet"><section class="scanner-empty-state"><h2>Loading AI Opportunity Insights</h2><p>Reading grounded scanner outputs.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderAiHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load AI Opportunity Insights</h2><p>${esc(state.error)}</p>${actionButton("Retry", "ai-reload", "primary")}</section></main>`;
    bindAiActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-violet scanner-dashboard">${renderAiHeader(data)}${renderAiInsightSummary(data)}${data.status === "EMPTY" ? renderAiEmpty(data) : ""}${renderUniverseAi(data)}${renderTopNarratives(data)}${renderRejectedNarratives(data)}${renderAgreementAi(data)}${renderConflictAi(data)}${renderRiskAiPanel(data)}${renderComplianceAiPanel(data)}${renderReviewAi(data)}${renderAiDetailDrawer()}</main>`;
  bindAiActions();
}
async function openAiDetail(id) {
  try { state.detail = await fetchJson(`${aiInsightsRoute}/${id}`); renderAiInsights(); }
  catch (reason) { state.error = reason.message || "Unable to open AI insight detail."; renderAiInsights(); }
}
function bindAiActions() {
  bindActions();
  document.querySelectorAll("[data-ai-open]").forEach(item => item.addEventListener("click", () => openAiDetail(item.dataset.aiOpen)));
  document.querySelectorAll("[data-close-ai-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderAiInsights(); }));
}
async function loadAiInsights() {
  state = { ...state, loading: true, error: "", detail: null };
  renderAiInsights();
  try { state.data = await fetchJson(aiInsightsRoute); }
  catch (reason) { state.error = reason.message || "Unable to load AI Opportunity Insights."; }
  finally { state.loading = false; renderAiInsights(); }
}

const controlSummaryCards = [
  ["scannerStatus", "Scanner Status"], ["runningJobs", "Running Jobs"], ["queuedJobs", "Queued Jobs"],
  ["completedJobsToday", "Completed Today"], ["failedJobsToday", "Failed Today"], ["retryRequired", "Retry Required"],
  ["activeWorkers", "Active Workers"], ["offlineWorkers", "Offline Workers"], ["averageScanDuration", "Average Scan Duration"],
  ["lastFullScanStatus", "Last Full Scan Status"], ["nextScheduledScan", "Next Scheduled Scan"], ["card3Readiness", "Card 3 Readiness"]
];

function renderControlHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header"><div><p class="scanner-eyebrow">Card 03 / Operations</p><h1>Scanner Control Center</h1><p>Control live universe scan execution, scheduling, workers, queues, retries, orchestration, safety checks, and Card 3 operational readiness.</p></div><aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Live Jobs Only</span><strong>Scanner Mode: ${esc(badges.scannerMode)}</strong><strong>Last Full Scan: ${dt(badges.lastFullScan)}</strong><strong>Next Scheduled Scan: ${dt(badges.nextScheduledScan)}</strong></aside><div class="scanner-action-bar">${actionButton("Run Full Scan", "control-run-full-scan", "primary")}${actionButton("Pause Scanner", "control-pause")}${actionButton("Resume Scanner", "control-resume")}${actionButton("Stop Scanner", "control-stop")}<a href="/workspace/universe-scanner/test-harness">Open Test Harness</a><a href="${API}${controlCenterRoute}/export" target="_blank" rel="noreferrer">Export Control Report</a></div></section>`;
}
function renderControlSummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${controlSummaryCards.map(([key, label]) => `<article class="scanner-kpi"><span>${label}</span><strong>${key.includes("Scan") || key.includes("Scheduled") ? dt(summary[key]) : fmt(summary[key])}</strong><small>Live control records only</small></article>`).join("")}</section>`;
}
function controlPanel(title, rows, headers, mapRow, emptyText) {
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>${title}</h2><span>${rows?.length || 0} rows</span></div>${table(headers, (rows || []).map(mapRow), emptyText)}</section>`;
}
function renderScannerMode(data) {
  const stateRow = data.controlState;
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Scanner Mode Control</h2><span>${esc(stateRow?.scannerMode || "No record")}</span></div><div class="scanner-detail-grid"><article><span>Status</span><strong>${esc(stateRow?.scannerStatus || "No record")}</strong></article><article><span>Emergency Stop</span><strong>${stateRow?.emergencyStop ? "Active" : "Inactive"}</strong></article><article><span>Updated</span><strong>${dt(stateRow?.updatedAt)}</strong></article></div><div class="scanner-action-bar compact">${actionButton("Manual", "control-mode-manual")}${actionButton("Scheduled", "control-mode-scheduled")}${actionButton("Continuous", "control-mode-continuous")}${actionButton("Safe Mode", "control-mode-safe")}${actionButton("Maintenance", "control-mode-maintenance")}${actionButton("Emergency Stop", "control-emergency-stop")}</div></section>`;
}
function renderControlModules(data) {
  return controlPanel("Module Control Table", data.modules, ["Module","Status","Dependency","Last Run","Next Run","Queued","Running","Completed Today","Failed Today","Average Duration","Health","Actions"], row => `<tr><td>${esc(row.module)}</td><td><span class="scanner-status ${badgeClass(row.status)}">${esc(row.status)}</span></td><td>${esc(row.dependencyStatus)}</td><td>${dt(row.lastRun)}</td><td>${dt(row.nextRun)}</td><td>${fmt(row.queuedJobs)}</td><td>${fmt(row.runningJobs)}</td><td>${fmt(row.completedToday)}</td><td>${fmt(row.failedToday)}</td><td>${duration(row.averageDuration)}</td><td>${esc(row.health)}</td><td><div class="scanner-row-actions"><button data-dashboard-action="control-run-module">Run</button><button data-dashboard-action="control-pause">Pause</button><button data-dashboard-action="control-resume">Resume</button><button data-dashboard-action="control-retry-failed">Retry Failed</button><a href="${esc(row.moduleUrl)}">Open Module</a></div></td></tr>`, "No production module control records are available.");
}
function renderControlJobs(data) {
  return controlPanel("Job Queue Monitor", data.jobs, ["Job ID","Module","Type","Priority","Status","Queued","Started","Completed","Duration","Retry","Triggered By","Actions"], row => `<tr><td>${esc(row.jobId)}</td><td>${esc(row.module)}</td><td>${esc(row.jobType)}</td><td>${fmt(row.priority)}</td><td>${esc(row.status)}</td><td>${dt(row.queuedAt)}</td><td>${dt(row.startedAt)}</td><td>${dt(row.completedAt)}</td><td>${duration(row.duration)}</td><td>${fmt(row.retryCount)}</td><td>${esc(row.triggeredBy)}</td><td><div class="scanner-row-actions"><button data-control-job="${esc(row.jobId)}">Open</button><button data-dashboard-action="control-retry-job">Retry</button><button data-dashboard-action="control-cancel-job">Cancel</button><button data-dashboard-action="control-prioritize">Prioritize</button></div></td></tr>`, "No scanner jobs are recorded.");
}
function renderControlWorkers(data) {
  return controlPanel("Worker Health Panel", data.workers, ["Worker ID","Worker","Module","Status","Current Job","Heartbeat","CPU","Memory","Processed Today","Failed","Last Error","Actions"], row => `<tr><td>${esc(row.workerId)}</td><td>${esc(row.workerName)}</td><td>${esc(row.assignedModule)}</td><td>${esc(row.status)}</td><td>${esc(row.currentJob)}</td><td>${dt(row.heartbeat)}</td><td>${fmt(row.cpuUsage)}</td><td>${fmt(row.memoryUsage)}</td><td>${fmt(row.jobsProcessedToday)}</td><td>${fmt(row.failedJobs)}</td><td>${esc(row.lastError)}</td><td><div class="scanner-row-actions"><button data-control-worker="${esc(row.workerId)}">Open</button><button data-dashboard-action="control-restart-worker">Restart Worker</button><button data-dashboard-action="control-disable-worker">Disable Worker</button></div></td></tr>`, "No scanner worker records are configured.");
}
function renderControlSchedules(data) {
  return controlPanel("Scan Schedule Manager", data.schedules, ["Schedule","Module","Frequency","Enabled","Last Run","Next Run","Timezone","Created By","Actions"], row => `<tr><td>${esc(row.scheduleName)}</td><td>${esc(row.module)}</td><td>${esc(row.frequency)}</td><td>${row.enabled ? "Yes" : "No"}</td><td>${dt(row.lastRun)}</td><td>${dt(row.nextRun)}</td><td>${esc(row.timezone)}</td><td>${esc(row.createdBy)}</td><td><div class="scanner-row-actions"><button data-dashboard-action="control-create-schedule">Create Schedule</button><button>Edit</button><button>Pause</button><button>Resume</button><button>Run Now</button></div></td></tr>`, "No scanner schedules are configured.");
}
function renderSafetyChecks(data) {
  return controlPanel("Safety Checks Before Full Scan", data.safetyChecks, ["Check","Status","Severity","Detail","Checked"], row => `<tr><td>${esc(row.checkName)}</td><td><span class="scanner-status ${badgeClass(row.status)}">${esc(row.status)}</span></td><td>${esc(row.severity)}</td><td>${esc(row.detail)}</td><td>${dt(row.checkedAt)}</td></tr>`, "No safety checks have been recorded.");
}
function renderFailureRecovery(data) {
  return controlPanel("Retry & Failure Recovery Panel", data.failures, ["Job ID","Module","Failure Type","Error","Retry","Max","Retryable","Recommended Fix","Status"], row => `<tr><td>${esc(row.jobId)}</td><td>${esc(row.module)}</td><td>${esc(row.failureType)}</td><td>${esc(row.errorMessage)}</td><td>${fmt(row.retryCount)}</td><td>${fmt(row.maxRetries)}</td><td>${row.retryable ? "Yes" : "No"}</td><td>${esc(row.recommendedFix)}</td><td>${esc(row.status)}</td></tr>`, "No failed scanner jobs require recovery.");
}
function renderControlReadiness(data) {
  return controlPanel("Card 3 Readiness Monitor", data.readiness, ["Check","Status","Output"], row => `<tr><td>${esc(row.checkName)}</td><td><span class="scanner-status ${badgeClass(row.status)}">${esc(row.status)}</span></td><td>${esc(row.output)}</td></tr>`, "No Card 3 readiness checks are available.");
}
function renderControlAudit(data) {
  return controlPanel("Control Actions Audit Trail", data.audit, ["User","Action","Entity","Reason","IP","Environment","Time"], row => `<tr><td>${esc(row.userName)}</td><td>${esc(row.action)}</td><td>${esc(row.entityType)}</td><td>${esc(row.reason)}</td><td>${esc(row.ipAddress)}</td><td>${esc(row.environment)}</td><td>${dt(row.createdAt)}</td></tr>`, "No control actions are audited.");
}
function renderControlAi(data) {
  const ai = data.aiSummary;
  if (!ai) return `<section class="scanner-panel"><div class="scanner-section-head"><h2>AI Scanner Operations Interpretation</h2><span>No record</span></div><div class="scanner-empty-inline">No scanner operations interpretation is available.</div></section>`;
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>AI Scanner Operations Interpretation</h2><span>${dt(ai.generatedAt)}</span></div><p class="scanner-ai-summary">${esc(ai.summary)}</p><div class="scanner-detail-grid"><article><span>Operational Health</span><strong>${esc(ai.scannerOperationalHealth)}</strong></article><article><span>Failing Modules</span><strong>${esc(ai.modulesFailingOrDelayed)}</strong></article><article><span>Queue Pressure</span><strong>${esc(ai.queuePressure)}</strong></article><article><span>Worker Issues</span><strong>${esc(ai.workerIssues)}</strong></article><article><span>Full Scan Readiness</span><strong>${esc(ai.fullScanReadiness)}</strong></article><article><span>Next Card</span><strong>${esc(ai.nextCardReadiness)}</strong></article></div><div class="scanner-action-bar compact">${actionButton("Regenerate Summary", "control-regenerate-summary")}${actionButton("Save to Logs", "control-save-summary")}<a href="${API}${controlCenterRoute}/export" target="_blank" rel="noreferrer">Export Brief</a></div></section>`;
}
function renderControlEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "Scanner Control Center has not been initialized yet.")}</h2><p>${esc(empty.message || "Initialize scanner control state, configure workers, and create schedules before running live universe scans.")}</p><div class="scanner-action-bar">${actionButton("Initialize Control Center", "control-initialize", "primary")}${actionButton("Create Worker", "control-create-worker")} ${actionButton("Create Schedule", "control-create-schedule")}<a href="/workspace/universe-scanner/test-harness">Open Test Harness</a></div></section>`;
}
function renderControlCenter() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-blue"><section class="scanner-empty-state"><h2>Loading Scanner Control Center</h2><p>Reading live scanner jobs, workers, schedules, and control state.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderControlHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Scanner Control Center</h2><p>${esc(state.error)}</p>${actionButton("Retry", "control-reload", "primary")}</section></main>`;
    bindControlActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-blue scanner-dashboard">${renderControlHeader(data)}${renderControlSummary(data)}${data.status === "EMPTY" ? renderControlEmpty(data) : ""}<section class="scanner-grid scanner-grid-2">${renderScannerMode(data)}${renderControlAi(data)}</section>${renderControlModules(data)}${renderControlJobs(data)}${renderControlWorkers(data)}${renderControlSchedules(data)}${renderSafetyChecks(data)}${renderFailureRecovery(data)}${renderControlReadiness(data)}${renderControlAudit(data)}</main>`;
  bindControlActions();
}
function bindControlActions() { bindActions(); }
async function loadControlCenter() {
  state = { ...state, loading: true, error: "", detail: null };
  renderControlCenter();
  try { state.data = await fetchJson(controlCenterRoute); }
  catch (reason) { state.error = reason.message || "Unable to load Scanner Control Center."; }
  finally { state.loading = false; renderControlCenter(); }
}

const logsSummaryCards = [
  ["totalLogsToday", "Total Logs Today"], ["successfulEvents", "Successful Events"], ["warnings", "Warnings"], ["errors", "Errors"],
  ["criticalErrors", "Critical Errors"], ["scanEvents", "Scan Events"], ["workerEvents", "Worker Events"], ["queueEvents", "Queue Events"],
  ["opportunityEvents", "Opportunity Events"], ["qualificationEvents", "Qualification Events"], ["aiGenerationEvents", "AI Generation Events"],
  ["userActions", "User Actions"], ["unresolvedIssues", "Unresolved Issues"]
];

function renderLogsHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header"><div><p class="scanner-eyebrow">Card 03 / Diagnostics</p><h1>Universe Scanner Logs & Diagnostics Center</h1><p>Review production scan logs, worker logs, queue history, module diagnostics, audit trails, errors, warnings, and operational events across the 20-Asset Universe Scanner.</p></div><aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Audit Logging Active</span><strong>Last Log Received: ${dt(badges.lastLogReceived)}</strong><strong>Critical Errors Today: ${fmt(badges.criticalErrorsToday)}</strong></aside><div class="scanner-action-bar">${actionButton("Refresh Logs", "logs-reload", "primary")}<a href="${API}${logsRoute}/export" target="_blank" rel="noreferrer">Export Logs</a>${actionButton("Clear Filters", "logs-clear-filters")}<a href="/workspace/universe-scanner/control-center">Open Control Center</a><a href="/workspace/universe-scanner/test-harness">Open Test Harness</a></div></section>`;
}
function renderLogsSummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${logsSummaryCards.map(([key, label]) => `<article class="scanner-kpi"><span>${label}</span><strong>${fmt(summary[key])}</strong><small>Production logs only</small></article>`).join("")}</section>`;
}
function renderLogFilters(data) {
  const categories = (data.categories || []).map(row => row.category);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Advanced Filters</h2><span>Client-side filter controls</span></div><div class="scanner-detail-grid"><article><span>Date Range</span><strong>Use export/API filters</strong></article><article><span>Category</span><strong>${esc(categories.slice(0, 4).join(", ") || "No categories")}</strong></article><article><span>Severity</span><strong>Info / Success / Warning / Error / Critical</strong></article><article><span>Status</span><strong>Started / Completed / Failed / Resolved</strong></article></div></section>`;
}
function renderMainLogs(data) {
  const rows = (data.logs || []).map(row => `<tr><td>${dt(row.timestamp)}</td><td>${esc(row.severity)}</td><td>${esc(row.status)}</td><td>${esc(row.module)}</td><td>${esc(row.category)}</td><td>${esc(row.action)}</td><td>${esc(row.message)}</td><td>${esc(row.asset)}</td><td>${esc(row.jobId)}</td><td>${esc(row.runId)}</td><td>${esc(row.worker)}</td><td>${esc(row.user)}</td><td>${esc(row.correlationId)}</td><td>${duration(row.duration)}</td><td>${esc(row.environment)}</td><td><div class="scanner-row-actions"><button data-log-open="${esc(row.logId)}">Open Detail</button><button data-dashboard-action="logs-acknowledge">Acknowledge</button><button data-dashboard-action="logs-resolve">Mark Resolved</button><button data-dashboard-action="logs-create-incident">Create Incident</button></div></td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Main Logs Table</h2><span>${data.logs?.length || 0} logs</span></div>${table(["Timestamp","Severity","Status","Module","Category","Action","Message","Asset","Job ID","Run ID","Worker","User","Correlation ID","Duration","Environment","Actions"], rows, "No Universe Scanner logs found.")}</section>`;
}
function logsPanel(title, rows, headers, mapRow, emptyText) {
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>${title}</h2><span>${rows?.length || 0} rows</span></div>${table(headers, (rows || []).map(mapRow), emptyText)}</section>`;
}
function renderErrorDiagnostics(data) {
  return logsPanel("Error Diagnostics Panel", data.errors, ["Time","Module","Asset","Job ID","Worker","Error Code","Error Message","Severity","Resolved","Recommended Fix"], row => `<tr><td>${dt(row.timestamp)}</td><td>${esc(row.module)}</td><td>${esc(row.asset)}</td><td>${esc(row.jobId)}</td><td>${esc(row.worker)}</td><td>${esc(row.errorCode)}</td><td>${esc(row.message)}</td><td>${esc(row.severity)}</td><td>${esc(row.resolutionStatus)}</td><td>${esc(row.recommendedFix)}</td></tr>`, "No active or recent failures are logged.");
}
function renderScanRuns(data) {
  return logsPanel("Scan Run History Panel", data.scanRuns, ["Run ID","Run Type","Triggered By","Started","Completed","Duration","Assets","Modules","Status"], row => `<tr><td>${esc(row.runId)}</td><td>${esc(row.jobType)}</td><td>${esc(row.triggeredBy)}</td><td>${dt(row.timestamp)}</td><td>${dt(row.completedAt)}</td><td>${duration(row.duration)}</td><td>${fmt(row.assetsProcessed)}</td><td>${fmt(row.modulesProcessed)}</td><td>${esc(row.status)}</td></tr>`, "No scan run history is available.");
}
function renderWorkerQueue(data) {
  return logsPanel("Worker / Queue Diagnostics Panel", data.workerQueue, ["Worker / Queue","Status","Current Job","Last Heartbeat","Failed / Message","Recommended Action"], row => `<tr><td>${esc(row.worker || row.module)}</td><td>${esc(row.status)}</td><td>${esc(row.jobId)}</td><td>${dt(row.timestamp)}</td><td>${esc(row.message)}</td><td>${/failed|offline/i.test(`${row.status} ${row.message}`) ? "Review worker or retry job" : "Monitor"}</td></tr>`, "No worker or queue diagnostics are available.");
}
function renderLogAudit(data) {
  return logsPanel("Audit Trail Panel", data.audit, ["Timestamp","User","Action","Entity","Reason","IP","Environment"], row => `<tr><td>${dt(row.timestamp)}</td><td>${esc(row.user)}</td><td>${esc(row.action)}</td><td>${esc(row.module)}</td><td>${esc(row.message)}</td><td>${esc(row.ipAddress)}</td><td>${esc(row.environment)}</td></tr>`, "No scanner audit logs are recorded.");
}
function renderLogMetrics(data) {
  const metrics = data.metrics || {};
  return `<section class="scanner-grid scanner-grid-2">${logsPanel("Top Error Categories", metrics.topCategories || [], ["Category","Count"], row => `<tr><td>${esc(row.category)}</td><td>${fmt(row.count)}</td></tr>`, "No metric category data is available.")}${logsPanel("Top Failing Modules", metrics.topFailingModules || [], ["Module","Count"], row => `<tr><td>${esc(row.category)}</td><td>${fmt(row.count)}</td></tr>`, "No failing module metric data is available.")}</section>`;
}
function renderLogsEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "No Universe Scanner logs found.")}</h2><p>${esc(empty.message || "Production logs will appear here after scanner runs, module executions, job processing, opportunity ranking, qualification, AI generation, or user actions occur.")}</p><div class="scanner-action-bar"><a href="/workspace/universe-scanner/control-center">Run Full Scan</a><a href="/workspace/universe-scanner/control-center">Open Control Center</a><a href="/workspace/universe-scanner/test-harness">Open Test Harness</a><a href="/workspace/universe-scanner/dashboard">Open Scanner Dashboard</a></div></section>`;
}
function renderLogDetailDrawer() {
  const detail = state.detail;
  if (!detail) return "";
  const log = detail.log || {};
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(log.module)} Log Detail</h2><button type="button" data-close-log-detail>Close</button></div><section class="scanner-detail-grid"><article><span>Log ID</span><strong>${esc(log.logId)}</strong></article><article><span>Timestamp</span><strong>${dt(log.timestamp)}</strong></article><article><span>Severity</span><strong>${esc(log.severity)}</strong></article><article><span>Status</span><strong>${esc(log.status)}</strong></article><article><span>Category</span><strong>${esc(log.category)}</strong></article><article><span>Correlation ID</span><strong>${esc(log.correlationId)}</strong></article></section><section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Message</h2><span>Sensitive snapshots require elevated permission</span></div><p class="scanner-ai-summary">${esc(log.message)}</p><div class="scanner-detail-grid"><article><span>Asset</span><strong>${esc(log.asset)}</strong></article><article><span>Job</span><strong>${esc(log.jobId)}</strong></article><article><span>Run</span><strong>${esc(log.runId)}</strong></article><article><span>Worker</span><strong>${esc(log.worker)}</strong></article><article><span>User</span><strong>${esc(log.user)}</strong></article><article><span>Recommended Fix</span><strong>${esc(log.recommendedFix)}</strong></article></div></section>${logsPanel("Related Logs Timeline", detail.relatedLogs || [], ["Time","Event","Module","Asset","Status","Message"], row => `<tr><td>${dt(row.time)}</td><td>${esc(row.event)}</td><td>${esc(row.module)}</td><td>${esc(row.asset)}</td><td>${esc(row.status)}</td><td>${esc(row.message)}</td></tr>`, "No related logs are available.")}<div class="scanner-action-bar compact"><button data-dashboard-action="logs-acknowledge">Acknowledge</button><button data-dashboard-action="logs-resolve">Mark Resolved</button><button data-dashboard-action="logs-create-incident">Create Incident</button><a href="${API}${logsRoute}/export" target="_blank" rel="noreferrer">Export Log</a></div></aside><div class="scanner-drawer-backdrop" data-close-log-detail></div>`;
}
function renderLogsCenter() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-slate"><section class="scanner-empty-state"><h2>Loading Universe Scanner Logs</h2><p>Reading production diagnostics and audit records.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderLogsHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Universe Scanner Logs</h2><p>${esc(state.error)}</p>${actionButton("Retry", "logs-reload", "primary")}</section></main>`;
    bindLogsActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-slate scanner-dashboard">${renderLogsHeader(data)}${renderLogsSummary(data)}${data.status === "EMPTY" ? renderLogsEmpty(data) : ""}${renderLogFilters(data)}${renderMainLogs(data)}${renderErrorDiagnostics(data)}${renderScanRuns(data)}${renderWorkerQueue(data)}${renderLogAudit(data)}${renderLogMetrics(data)}${renderLogDetailDrawer()}</main>`;
  bindLogsActions();
}
async function openLogDetail(id) {
  try { state.detail = await fetchJson(`${logsRoute}/${id}`); renderLogsCenter(); }
  catch (reason) { state.error = reason.message || "Unable to open log detail."; renderLogsCenter(); }
}
function bindLogsActions() {
  bindActions();
  document.querySelectorAll("[data-log-open]").forEach(item => item.addEventListener("click", () => openLogDetail(item.dataset.logOpen)));
  document.querySelectorAll("[data-close-log-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderLogsCenter(); }));
}
async function loadLogsCenter() {
  state = { ...state, loading: true, error: "", detail: null };
  renderLogsCenter();
  try { state.data = await fetchJson(logsRoute); }
  catch (reason) { state.error = reason.message || "Unable to load Universe Scanner Logs."; }
  finally { state.loading = false; renderLogsCenter(); }
}

const harnessSummaryCards = [
  ["testsRunToday", "Tests Run Today"], ["passedTests", "Passed Tests"], ["failedTests", "Failed Tests"], ["warnings", "Warnings"],
  ["criticalFailures", "Critical Failures"], ["scannerModuleTests", "Scanner Module Tests"], ["rankingTests", "Ranking Tests"],
  ["qualificationTests", "Qualification Tests"], ["aiInsightTests", "AI Insight Tests"], ["readinessTests", "Readiness Tests"],
  ["averageTestDuration", "Average Test Duration"], ["lastDiagnosticStatus", "Last Diagnostic Status"]
];

function selectedHarnessMode() {
  return state.safetyMode || state.data?.defaultSafetyMode || "Read-Only Test";
}

function renderHarnessHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Test Harness</p><h1>Universe Scanner Test Harness Center</h1><p>Safely test live scanner modules, score engines, opportunity ranking, qualified trades, AI insights, orchestration, readiness checks, and Card 3 workflow output.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Safe Test Mode</span><span>Read-Only by Default</span><strong>Last Test Run: ${dt(badges.lastTestRun)}</strong></aside>
    <div class="scanner-action-bar">${actionButton("Run Test", "harness-run", "primary")}${actionButton("Bootstrap Pipeline", "harness-bootstrap")}${actionButton("Run Selected Tests", "harness-run-selected")}${actionButton("Run Full Scanner Diagnostic", "harness-run-full")}<a href="${API}${testHarnessRoute}/export" target="_blank" rel="noreferrer">Export Test Report</a><a href="/workspace/universe-scanner/logs">Open Logs</a></div>
  </section>`;
}

function renderHarnessSafety(data) {
  const modes = data.safetyModes || ["Read-Only Test", "Dry Run", "Transactional Test", "Approved Write Test", "Sandbox Account Test"];
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Safety Mode</h2><span>${esc(selectedHarnessMode())}</span></div>
    <div class="scanner-toolbar"><label>Mode<select data-harness-mode>${modes.map(mode => `<option ${mode === selectedHarnessMode() ? "selected" : ""}>${esc(mode)}</option>`).join("")}</select></label><div class="scanner-action-bar compact">${actionButton("Run Data Input Tests", "harness-run-data")}${actionButton("Run Readiness Test", "harness-run-readiness")}${actionButton("Run AI Grounding Test", "harness-run-ai")}</div></div>
    <div class="scanner-detail-grid">${(data.strictRules || []).map(rule => `<article><span>Production Rule</span><strong>${esc(rule)}</strong></article>`).join("")}</div>
  </section>`;
}

function renderHarnessSummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${harnessSummaryCards.map(([key, label]) => `<article class="scanner-kpi"><span>${label}</span><strong>${key === "averageTestDuration" ? duration(summary[key]) : fmt(summary[key])}</strong><small>Production test records only</small></article>`).join("")}</section>`;
}

function renderHarnessEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "No Universe Scanner tests have been run yet.")}</h2><p>${esc(empty.message || "Run a read-only diagnostic to verify data inputs, scanner engines, scoring, qualification, AI grounding, and Card 3 readiness.")}</p><div class="scanner-action-bar">${actionButton("Run Full Scanner Diagnostic", "harness-run-full", "primary")}${actionButton("Run Data Input Tests", "harness-run-data")}<a href="/workspace/universe-scanner/control-center">Open Control Center</a><a href="/workspace/universe-scanner/logs">Open Logs</a></div></section>`;
}

function renderHarnessCatalog(data) {
  const rows = (data.catalog || []).map(row => `<tr><td><input type="checkbox" data-harness-select="${esc(row.id)}"></td><td>${esc(row.testName)}</td><td>${esc(row.category)}</td><td>${esc(row.module)}</td><td>${esc(row.description)}</td><td>${esc(row.safetyMode)}</td><td>${row.requiresApproval ? "Yes" : "No"}</td><td>${dt(row.lastRun)}</td><td><span class="scanner-status ${badgeClass(row.lastStatus)}">${esc(row.lastStatus || "Not Run")}</span></td><td>${duration(row.duration)}</td><td>${esc(row.riskLevel)}</td><td><div class="scanner-row-actions"><button data-harness-run="${esc(row.id)}">Run</button><button data-harness-run-dry="${esc(row.id)}">Run Dry</button>${row.lastRun ? `<button data-harness-open-latest="${esc(row.id)}">View Result</button>` : ""}<a href="/workspace/universe-scanner/logs">View Logs</a><button data-dashboard-action="harness-schedule">Schedule Test</button></div></td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Test Catalog</h2><span>${data.catalog?.length || 0} production tests</span></div>${table(["","Test Name","Category","Module","Description","Safety Mode","Requires Approval","Last Run","Last Status","Duration","Risk Level","Actions"], rows, "No scanner test catalog entries are available.")}</section>`;
}

function renderHarnessReadiness(data) {
  const readiness = data.cardReadiness || {};
  const rows = (readiness.checks || []).map(row => `<tr><td>${esc(row.checkName)}</td><td><span class="scanner-status ${badgeClass(row.status)}">${esc(row.status)}</span></td><td>${esc(JSON.stringify(row.detail || {}))}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Card 3 Readiness Diagnostic</h2><span>${esc(readiness.status || "No record")}</span></div>${table(["Check","Status","Output"], rows, "No Card 3 readiness checks have been recorded.")}</section>`;
}

function renderHarnessDiagnostics(data) {
  const rows = (data.diagnostics || []).map(row => `<tr><td>${esc(row.id)}</td><td>${esc(row.diagnosticType)}</td><td><span class="scanner-status ${badgeClass(row.status)}">${esc(row.status)}</span></td><td>${fmt(row.passedTests)}</td><td>${fmt(row.warningTests)}</td><td>${fmt(row.failedTests)}</td><td>${fmt(row.blockedTests)}</td><td>${dt(row.startedAt)}</td><td>${dt(row.completedAt)}</td><td>${esc(row.recommendedActions)}</td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Full Diagnostic Runner</h2><span>${data.diagnostics?.length || 0} diagnostics</span></div>${table(["Diagnostic ID","Type","Status","Passed","Warnings","Failures","Blocked","Started","Completed","Recommended Actions"], rows, "No full scanner diagnostics are recorded yet.")}</section>`;
}

function renderHarnessHistory(data) {
  const rows = (data.history || []).map(row => `<tr><td><button class="link-button" type="button" data-harness-open="${esc(row.id)}">${esc(row.id)}</button></td><td>${esc(row.testName)}</td><td>${esc(row.category)}</td><td>${esc(row.module)}</td><td>${esc(row.safetyMode)}</td><td><span class="scanner-status ${badgeClass(row.status)}">${esc(row.status)}</span></td><td>${esc(row.triggeredBy)}</td><td>${dt(row.startedAt)}</td><td>${dt(row.completedAt)}</td><td>${duration(row.duration)}</td><td>${fmt(row.failureCount)}</td><td>${fmt(row.warningCount)}</td><td><div class="scanner-row-actions"><button data-harness-open="${esc(row.id)}">Open Result</button><button data-harness-rerun="${esc(row.testId)}">Rerun Test</button></div></td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Test History</h2><span>${data.history?.length || 0} runs</span></div>${table(["Test Run ID","Test Name","Category","Module","Safety Mode","Status","Triggered By","Started At","Completed At","Duration","Failure Count","Warning Count","Actions"], rows, "No test history is available.")}</section>`;
}

function renderHarnessSchedules(data) {
  const rows = (data.schedules || []).map(row => `<tr><td>${esc(row.scheduleName)}</td><td>${esc(row.testName)}</td><td>${esc(row.frequency)}</td><td>${row.enabled ? "Enabled" : "Disabled"}</td><td>${dt(row.lastRunAt)}</td><td>${dt(row.nextRunAt)}</td><td>${esc(row.createdBy)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Scheduled Tests</h2><span>${data.schedules?.length || 0} schedules</span></div>${table(["Schedule","Test","Frequency","Status","Last Run","Next Run","Created By"], rows, "No scheduled diagnostics are configured.")}</section>`;
}

function renderHarnessResultDrawer() {
  const detail = state.detail;
  if (!detail) return "";
  const checks = detail.checksPerformed || [];
  const warnings = detail.warnings || [];
  const errors = detail.errors || [];
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(detail.testName)} Result</h2><button type="button" data-close-harness-detail>Close</button></div>
    <section class="scanner-detail-grid"><article><span>Test ID</span><strong>${esc(detail.testId)}</strong></article><article><span>Run ID</span><strong>${esc(detail.id)}</strong></article><article><span>Category</span><strong>${esc(detail.category)}</strong></article><article><span>Module</span><strong>${esc(detail.module)}</strong></article><article><span>Safety Mode</span><strong>${esc(detail.safetyMode)}</strong></article><article><span>Status</span><strong>${esc(detail.status)}</strong></article><article><span>Triggered By</span><strong>${esc(detail.triggeredBy)}</strong></article><article><span>Duration</span><strong>${duration(detail.duration)}</strong></article></section>
    <section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Checks Performed</h2><span>${checks.length} checks</span></div>${table(["Check","Status","Detail"], checks.map(row => `<tr><td>${esc(row.checkName)}</td><td><span class="scanner-status ${badgeClass(row.status)}">${esc(row.status)}</span></td><td>${esc(JSON.stringify(row.payload || row.detail || {}))}</td></tr>`), "No checks are attached to this result.")}</section>
    <section class="scanner-grid scanner-grid-2"><article class="scanner-panel"><div class="scanner-section-head"><h2>Warnings</h2><span>${warnings.length}</span></div><div class="scanner-cell-stack">${warnings.map(row => `<span>${esc(row.message || row.checkName)}</span>`).join("") || "No warnings"}</div></article><article class="scanner-panel"><div class="scanner-section-head"><h2>Errors</h2><span>${errors.length}</span></div><div class="scanner-cell-stack">${errors.map(row => `<span>${esc(row.message || row.checkName)}</span>`).join("") || "No errors"}</div></article></section>
    <section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Inputs Used</h2><span>Sensitive data protected</span></div><p class="scanner-ai-summary">${esc(JSON.stringify(detail.inputsUsed || {}, null, 2))}</p></section>
    <div class="scanner-action-bar compact"><button data-copy-harness-id="${esc(detail.id)}">Copy Test ID</button><a href="/workspace/universe-scanner/logs">View Logs</a><a href="/workspace/universe-scanner/${esc((detail.testId || "").replace("-engine", "").replace("economic-events", "economic-events"))}">Open Related Module</a><button data-harness-rerun="${esc(detail.testId)}">Rerun Test</button><a href="${API}${testHarnessRoute}/export" target="_blank" rel="noreferrer">Export Result</a><button data-dashboard-action="harness-create-incident">Create Incident</button></div>
  </aside><div class="scanner-drawer-backdrop" data-close-harness-detail></div>`;
}

function renderHarnessCenter() {
  const data = state.data;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-blue"><section class="scanner-empty-state"><h2>Loading Universe Scanner Test Harness</h2><p>Reading production scanner test records and live diagnostic inputs.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderHarnessHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Universe Scanner Test Harness</h2><p>${esc(state.error)}</p>${actionButton("Retry", "harness-reload", "primary")}</section></main>`;
    bindHarnessActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-blue scanner-dashboard">${renderHarnessHeader(data)}${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}${renderHarnessSafety(data)}${renderHarnessSummary(data)}${data.status === "EMPTY" ? renderHarnessEmpty(data) : ""}${renderHarnessCatalog(data)}${renderHarnessReadiness(data)}${renderHarnessDiagnostics(data)}<section class="scanner-grid scanner-grid-2">${renderHarnessSchedules(data)}</section>${renderHarnessHistory(data)}${renderHarnessResultDrawer()}</main>`;
  bindHarnessActions();
}

async function loadTestHarness() {
  state = { ...state, loading: true, error: "", detail: null, safetyMode: state.safetyMode || "Read-Only Test" };
  renderHarnessCenter();
  try { state.data = await fetchJson(testHarnessRoute); }
  catch (reason) { state.error = reason.message || "Unable to load Universe Scanner Test Harness."; }
  finally { state.loading = false; renderHarnessCenter(); }
}

async function openHarnessResult(id) {
  try { state.detail = await fetchJson(`${testHarnessRoute}/results/${id}`); renderHarnessCenter(); }
  catch (reason) { state.error = reason.message || "Unable to open test result."; renderHarnessCenter(); }
}

function bindHarnessActions() {
  bindActions();
  document.querySelector("[data-harness-mode]")?.addEventListener("change", event => { state.safetyMode = event.target.value; renderHarnessCenter(); });
  document.querySelectorAll("[data-harness-run]").forEach(item => item.addEventListener("click", () => runHarnessTest(item.dataset.harnessRun)));
  document.querySelectorAll("[data-harness-run-dry]").forEach(item => item.addEventListener("click", () => runHarnessTest(item.dataset.harnessRunDry, "Dry Run")));
  document.querySelectorAll("[data-harness-rerun]").forEach(item => item.addEventListener("click", () => runHarnessTest(item.dataset.harnessRerun)));
  document.querySelectorAll("[data-harness-open]").forEach(item => item.addEventListener("click", () => openHarnessResult(item.dataset.harnessOpen)));
  document.querySelectorAll("[data-harness-open-latest]").forEach(item => item.addEventListener("click", () => {
    const latest = (state.data?.history || []).find(row => row.testId === item.dataset.harnessOpenLatest);
    if (latest) openHarnessResult(latest.id);
  }));
  document.querySelectorAll("[data-close-harness-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderHarnessCenter(); }));
  document.querySelectorAll("[data-copy-harness-id]").forEach(item => item.addEventListener("click", () => navigator.clipboard?.writeText(item.dataset.copyHarnessId)));
}

async function runHarnessTest(testId, safetyMode = selectedHarnessMode()) {
  try {
    const result = await fetchJson(`${testHarnessRoute}/run`, { method: "POST", body: JSON.stringify({ testId, safetyMode }) });
    await loadTestHarness();
    if (result.run?.id) {
      state.detail = await fetchJson(`${testHarnessRoute}/results/${result.run.id}`);
      renderHarnessCenter();
    }
  } catch (reason) {
    state.error = reason.message || "Unable to run scanner test.";
    renderHarnessCenter();
  }
}

function renderRegistryHeader(data) {
  const badges = data?.badges || {};
  return `<section class="scanner-dashboard-header">
    <div><p class="scanner-eyebrow">Card 03 / Asset Universe</p><h1>Asset Universe Registry</h1><p>Manage live tradable assets, broker symbol mappings, asset classes, scan inclusion rules, and readiness status for the 20-Asset Universe Scanner.</p></div>
    <aside class="scanner-badge-panel"><span>Production Live</span><span>Mock Data Disabled</span><span>Database Assets Only</span><strong>Last Symbol Sync: ${dt(badges.lastSymbolSync)}</strong><strong>Active Assets: ${fmt(badges.activeAssets)}</strong></aside>
    <div class="scanner-action-bar">
      ${actionButton("Refresh Assets", "registry-reload", "primary")}
      ${actionButton("Sync Broker Symbols", "sync-broker-symbols")}
      ${actionButton("Add Asset", "open-add-asset")}
      ${actionButton("Import Asset List", "open-import")}
      <a href="${API}${universeRoute}/export" target="_blank" rel="noreferrer">Export Registry</a>
    </div>
  </section>`;
}

function renderRegistrySummary(data) {
  const summary = data.summary || {};
  return `<section class="scanner-kpis">${registrySummaryCards.map(([key, label]) => `
    <article class="scanner-kpi"><span>${label}</span><strong>${fmt(summary[key])}</strong><small>${key.includes("Score") ? "Production readiness" : "Database records only"}</small></article>`).join("")}</section>`;
}

function renderAssetClasses(data) {
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Asset Classes</h2><span>${data.assetClasses?.length || 0} database classes</span></div>
    ${data.assetClasses?.length ? `<div class="scanner-badges">${data.assetClasses.map(item => `<span>${esc(item.className)}</span>`).join("")}</div>` : `<div class="scanner-empty-inline">No asset classes exist in asset_classes or symbol_registry.</div>`}</section>`;
}

function renderRegistryAssets(data) {
  const rows = (data.assets || []).map(row => `<tr>
    <td>${esc(row.assetCode)}</td><td>${esc(row.displayName)}</td><td>${esc(row.assetClass)}</td><td>${esc(row.baseAsset)}</td><td>${esc(row.quoteAsset)}</td>
    <td>${esc(row.brokerSymbol || "Unmapped")}</td><td>${esc(row.broker || "No record")}</td><td>${esc(row.platform || "No record")}</td>
    <td>${esc(row.status)}</td><td>${row.scanEnabled ? "Yes" : "No"}</td><td>${esc(row.dataFeedStatus)}</td><td>${esc(row.historicalDataStatus)}</td>
    <td>${esc(row.liquidityStatus)}</td><td>${esc(row.complianceStatus)}</td><td><span class="scanner-status ${badgeClass(row.readiness)}">${esc(row.readiness)}</span></td>
    <td>${fmt(row.lastPrice)}</td><td>${fmt(row.spread)}</td><td>${dt(row.lastUpdated)}</td>
    <td><div class="scanner-row-actions"><button data-asset-open="${row.id}">Open</button><button data-asset-edit="${row.id}">Edit</button><button data-asset-scan="${row.id}" data-enabled="${row.scanEnabled ? "1" : "0"}">${row.scanEnabled ? "Disable Scan" : "Enable Scan"}</button><button data-asset-map="${row.id}">Map Symbol</button><button data-asset-ready="${row.id}">Sync Symbol</button><button data-asset-archive="${row.id}">Archive</button></div></td>
  </tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Asset Universe Table</h2><span>${data.assets?.length || 0} assets</span></div>
    ${table(["Asset","Display Name","Asset Class","Base Asset","Quote Asset","Broker Symbol","Broker","Platform","Status","Scan Enabled","Data Feed","Historical Data","Liquidity","Compliance","Readiness","Last Price","Spread","Last Updated","Actions"], rows, "No database-backed assets are registered.")}</section>`;
}

function renderMappings(data) {
  const rows = (data.mappings || []).map(row => `<tr><td>${esc(row.asset)}</td><td>${esc(row.broker)}</td><td>${esc(row.platform)}</td><td>${esc(row.server)}</td><td>${esc(row.brokerSymbol)}</td><td>${esc(row.symbolSuffix)}</td><td>${esc(row.symbolPrefix)}</td><td>${fmt(row.digits)}</td><td>${fmt(row.tickSize)}</td><td>${fmt(row.contractSize)}</td><td>${row.isActive ? "Yes" : "No"}</td><td>${dt(row.lastVerified)}</td><td><button data-map-test="${row.id}">Test Mapping</button></td></tr>`);
  return `<section class="scanner-panel scanner-wide"><div class="scanner-section-head"><h2>Broker Symbol Mapping</h2><span>${data.mappings?.length || 0} mappings</span></div>
    ${table(["Asset","Broker","Platform","Server","Broker Symbol","Suffix","Prefix","Digits","Tick Size","Contract Size","Is Active","Last Verified","Actions"], rows, "No broker symbol mappings are recorded.")}</section>`;
}

function renderReadinessList(data) {
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Asset Readiness Engine</h2><span>${data.readiness?.length || 0} scores</span></div>
    ${data.readiness?.length ? `<div class="scanner-readiness">${data.readiness.map(row => `<article><span class="scanner-status ${badgeClass(row.readiness)}">${esc(row.readiness)}</span><strong>${esc(row.asset)}</strong><small>${pct(row.readinessScore)}</small></article>`).join("")}</div>` : `<div class="scanner-empty-inline">No readiness scores exist. Run readiness checks after assets are registered.</div>`}</section>`;
}

function renderImportHistory(data) {
  const rows = (data.imports || []).map(row => `<tr><td>${esc(row.importSource)}</td><td>${esc(row.fileName)}</td><td>${esc(row.status)}</td><td>${fmt(row.totalRows)}</td><td>${fmt(row.acceptedRows)}</td><td>${fmt(row.rejectedRows)}</td><td>${esc(row.createdBy)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Import Asset List</h2><span>Pending review required</span></div>
    ${table(["Source","File","Status","Rows","Accepted","Rejected","Created By","Created At"], rows, "No asset import batches are recorded.")}</section>`;
}

function renderAudit(data) {
  const rows = (data.audit || []).map(row => `<tr><td>${esc(row.action)}</td><td>${esc(row.userName)}</td><td>${esc(row.entityType)}</td><td>${esc(row.reason)}</td><td>${dt(row.createdAt)}</td></tr>`);
  return `<section class="scanner-panel"><div class="scanner-section-head"><h2>Recent Sync Logs & Audit History</h2><span>${data.audit?.length || 0} events</span></div>${table(["Action","User","Entity","Reason","Created At"], rows, "No registry audit events are recorded.")}</section>`;
}

function optionList(items, selected) {
  return (items || []).map(item => `<option value="${esc(item.className)}" ${item.className === selected ? "selected" : ""}>${esc(item.className)}</option>`).join("");
}

function assetForm(data, asset = {}) {
  return `<form class="scanner-drawer-form" data-registry-form="${asset.id ? "edit" : "create"}" data-asset-id="${asset.id || ""}">
    <label>Asset Code<input name="assetCode" value="${esc(asset.assetCode)}" ${asset.id ? "disabled" : ""} required></label>
    <label>Display Name<input name="displayName" value="${esc(asset.displayName)}"></label>
    <label>Asset Class<select name="assetClass" required><option value="">Select class</option>${optionList(data.assetClasses, asset.assetClass)}</select></label>
    <label>Base Asset<input name="baseAsset" value="${esc(asset.baseAsset)}"></label>
    <label>Quote Asset<input name="quoteAsset" value="${esc(asset.quoteAsset)}"></label>
    <label>Default Timezone<input name="defaultTimezone" value="${esc(asset.defaultTimezone)}"></label>
    <label>Default Session<input name="defaultSession" value="${esc(asset.defaultSession)}"></label>
    <label>Tick Size<input name="tickSize" type="number" step="any" value="${esc(asset.tickSize)}"></label>
    <label>Pip Size<input name="pipSize" type="number" step="any" value="${esc(asset.pipSize)}"></label>
    <label>Contract Size<input name="contractSize" type="number" step="any" value="${esc(asset.contractSize)}"></label>
    <label>Minimum Lot<input name="minimumLot" type="number" step="any" value="${esc(asset.minimumLot)}"></label>
    <label>Maximum Lot<input name="maximumLot" type="number" step="any" value="${esc(asset.maximumLot)}"></label>
    <label>Status<select name="status"><option ${asset.status === "Inactive" ? "selected" : ""}>Inactive</option><option ${asset.status === "Active" ? "selected" : ""}>Active</option><option ${asset.status === "Suspended" ? "selected" : ""}>Suspended</option><option ${asset.status === "Archived" ? "selected" : ""}>Archived</option></select></label>
    <label class="scanner-checkbox"><input name="scanEnabled" type="checkbox" ${asset.scanEnabled ? "checked" : ""}> Scan Enabled</label>
    <div class="scanner-action-bar compact"><button class="primary" type="submit">${asset.id ? "Save Asset" : "Add Asset"}</button><button type="button" data-close-drawer>Cancel</button></div>
  </form>`;
}

function mapForm(assetId) {
  return `<form class="scanner-drawer-form" data-map-form data-asset-id="${assetId}">
    <label>Broker<input name="broker"></label><label>Platform<input name="platform"></label><label>Server<input name="server"></label>
    <label>Broker Symbol<input name="brokerSymbol" required></label><label>Symbol Suffix<input name="symbolSuffix"></label><label>Symbol Prefix<input name="symbolPrefix"></label>
    <label>Digits<input name="digits" type="number"></label><label>Tick Size<input name="tickSize" type="number" step="any"></label><label>Contract Size<input name="contractSize" type="number" step="any"></label>
    <div class="scanner-action-bar compact"><button class="primary" type="submit">Manual Map</button><button type="button" data-close-drawer>Cancel</button></div>
  </form>`;
}

function importForm() {
  return `<form class="scanner-drawer-form" data-import-form>
    <label>Import Source<select name="importSource"><option>CSV</option><option>Excel</option><option>Broker Symbol Sync</option><option>MT5 Symbol List</option><option>MT4 Symbol List</option><option>cTrader Symbol List</option></select></label>
    <label>File Name<input name="fileName"></label>
    <label>Rows JSON<textarea name="rows" rows="8" placeholder='[{"assetCode":"...","displayName":"...","assetClass":"...","brokerSymbol":"..."}]'></textarea></label>
    <p class="scanner-form-note">Imported assets are recorded as Pending Review and are not scan-enabled automatically.</p>
    <div class="scanner-action-bar compact"><button class="primary" type="submit">Import Asset List</button><button type="button" data-close-drawer>Cancel</button></div>
  </form>`;
}

function renderDrawer(data) {
  if (!state.drawer) return "";
  let title = "Asset Registry";
  let body = "";
  if (state.drawer.type === "add") { title = "Add Asset"; body = assetForm(data); }
  if (state.drawer.type === "edit") { title = "Edit Asset"; body = assetForm(data, data.assets.find(row => String(row.id) === String(state.drawer.id)) || {}); }
  if (state.drawer.type === "map") { title = "Map Broker Symbol"; body = mapForm(state.drawer.id); }
  if (state.drawer.type === "import") { title = "Import Asset List"; body = importForm(); }
  return `<aside class="scanner-drawer"><div class="scanner-drawer-head"><h2>${title}</h2><button type="button" data-close-drawer>Close</button></div>${body}</aside><div class="scanner-drawer-backdrop" data-close-drawer></div>`;
}

function renderDetailDrawer() {
  const detail = state.detail;
  if (!detail) return "";
  const asset = detail.asset || {};
  return `<aside class="scanner-drawer wide"><div class="scanner-drawer-head"><h2>${esc(asset.assetCode)} Detail</h2><button type="button" data-close-detail>Close</button></div>
    <section class="scanner-detail-grid">
      <article><span>Asset Profile</span><strong>${esc(asset.displayName)}</strong><small>${esc(asset.assetClass)} / ${esc(asset.baseAsset)} ${esc(asset.quoteAsset)}</small></article>
      <article><span>Data Feed Status</span><strong>${esc(asset.dataFeedStatus)}</strong><small>Last price ${fmt(asset.lastPrice)}</small></article>
      <article><span>Historical Data Coverage</span><strong>${esc(asset.historicalDataStatus)}</strong></article>
      <article><span>Liquidity Snapshot</span><strong>${esc(asset.liquidityStatus)}</strong><small>Spread ${fmt(asset.spread)}</small></article>
      <article><span>Compliance Status</span><strong>${esc(asset.complianceStatus)}</strong></article>
      <article><span>Readiness Score Breakdown</span><strong>${esc(asset.readiness)} / ${pct(asset.readinessScore)}</strong></article>
    </section>
    ${renderMappings({ mappings: detail.mappings || [] })}
    ${renderAudit({ audit: detail.audit || [] })}
    <div class="scanner-action-bar compact"><button data-asset-ready="${asset.id}">Run Readiness Check</button><a href="/workspace/data-sources-validation/historical-data">Open Historical Data</a><a href="/workspace/data-sources-validation/broker-data">Open Broker Data</a><a href="/workspace/universe-scanner/liquidity">Open Liquidity Scanner</a><button data-asset-edit="${asset.id}">Edit Asset</button></div>
  </aside><div class="scanner-drawer-backdrop" data-close-detail></div>`;
}

function renderRegistryEmpty(data) {
  const empty = data.emptyState || {};
  return `<section class="scanner-empty-state"><h2>${esc(empty.title || "No assets have been registered yet.")}</h2><p>${esc(empty.message || "Add assets manually, import a verified asset list, or sync symbols from a connected broker before running the universe scanner.")}</p>
    <div class="scanner-action-bar">${actionButton("Add Asset", "open-add-asset", "primary")}${actionButton("Import Asset List", "open-import")}${actionButton("Sync Broker Symbols", "sync-broker-symbols")}<a href="/workspace/data-sources-validation/broker-data">Open Broker Data</a></div></section>`;
}

function renderRegistry() {
  const data = state.registry;
  if (state.loading) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-green"><section class="scanner-empty-state"><h2>Loading Asset Universe Registry</h2><p>Reading production asset records from the API.</p></section></main>`;
    return;
  }
  if (state.error) {
    document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-red">${renderRegistryHeader(data || {})}<section class="scanner-empty-state"><h2>Unable to load Asset Universe Registry</h2><p>${esc(state.error)}</p>${actionButton("Retry", "registry-reload", "primary")}</section></main>`;
    bindRegistryActions();
    return;
  }
  document.querySelector("#universe-scanner-content").innerHTML = `<main class="universe-scanner scanner-tone-green scanner-dashboard">
    ${renderRegistryHeader(data)}
    ${data.message ? `<section class="scanner-system-message">${esc(data.message)}</section>` : ""}
    ${renderRegistrySummary(data)}
    ${data.status === "EMPTY" ? renderRegistryEmpty(data) : ""}
    <section class="scanner-grid scanner-grid-2">${renderAssetClasses(data)}${renderReadinessList(data)}</section>
    ${renderRegistryAssets(data)}
    ${renderMappings(data)}
    <section class="scanner-grid scanner-grid-2">${renderImportHistory(data)}${renderAudit(data)}</section>
    ${renderDrawer(data)}
    ${renderDetailDrawer()}
  </main>`;
  bindRegistryActions();
}

function formPayload(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  if (form.querySelector('[name="scanEnabled"]')) data.scanEnabled = form.querySelector('[name="scanEnabled"]').checked;
  for (const key of ["tickSize", "pipSize", "contractSize", "minimumLot", "maximumLot", "digits"]) {
    if (data[key] === "") delete data[key];
  }
  return data;
}

async function loadRegistry() {
  state = { ...state, loading: true, error: "", drawer: null, detail: null };
  renderRegistry();
  try {
    state.registry = await fetchJson(universeRoute);
  } catch (reason) {
    state.error = reason.message || "Unable to load Asset Universe Registry.";
  } finally {
    state.loading = false;
    renderRegistry();
  }
}

async function registryAction(action, id = null, extra = {}) {
  try {
    if (action === "registry-reload") return loadRegistry();
    if (action === "open-add-asset") { state.drawer = { type: "add" }; renderRegistry(); return; }
    if (action === "open-import") { state.drawer = { type: "import" }; renderRegistry(); return; }
    if (action === "sync-broker-symbols") await fetchJson(`${universeRoute}/sync-broker-symbols`, { method: "POST", body: JSON.stringify({}) });
    if (action === "toggle-scan") await fetchJson(`${universeRoute}/${id}/${extra.enabled ? "disable-scan" : "enable-scan"}`, { method: "POST", body: JSON.stringify({}) });
    if (action === "run-readiness") await fetchJson(`${universeRoute}/${id}/run-readiness-check`, { method: "POST", body: JSON.stringify({}) });
    if (action === "archive") await fetchJson(`${universeRoute}/${id}`, { method: "DELETE", body: JSON.stringify({}) });
    await loadRegistry();
  } catch (reason) {
    state.error = reason.message || `Unable to run ${action}.`;
    renderRegistry();
  }
}

async function openAssetDetail(id) {
  try {
    state.detail = await fetchJson(`${universeRoute}/${id}`);
    renderRegistry();
  } catch (reason) {
    state.error = reason.message || "Unable to open asset.";
    renderRegistry();
  }
}

function bindRegistryActions() {
  bindActions();
  document.querySelectorAll("[data-close-drawer]").forEach(item => item.addEventListener("click", () => { state.drawer = null; renderRegistry(); }));
  document.querySelectorAll("[data-close-detail]").forEach(item => item.addEventListener("click", () => { state.detail = null; renderRegistry(); }));
  document.querySelectorAll("[data-asset-open]").forEach(item => item.addEventListener("click", () => openAssetDetail(item.dataset.assetOpen)));
  document.querySelectorAll("[data-asset-edit]").forEach(item => item.addEventListener("click", () => { state.drawer = { type: "edit", id: item.dataset.assetEdit }; renderRegistry(); }));
  document.querySelectorAll("[data-asset-map]").forEach(item => item.addEventListener("click", () => { state.drawer = { type: "map", id: item.dataset.assetMap }; renderRegistry(); }));
  document.querySelectorAll("[data-asset-scan]").forEach(item => item.addEventListener("click", () => registryAction("toggle-scan", item.dataset.assetScan, { enabled: item.dataset.enabled === "1" })));
  document.querySelectorAll("[data-asset-ready]").forEach(item => item.addEventListener("click", () => registryAction("run-readiness", item.dataset.assetReady)));
  document.querySelectorAll("[data-asset-archive]").forEach(item => item.addEventListener("click", () => registryAction("archive", item.dataset.assetArchive)));
  document.querySelector("[data-registry-form]")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = formPayload(form);
    const id = form.dataset.assetId;
    try {
      if (form.dataset.registryForm === "edit") await fetchJson(`${universeRoute}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await fetchJson(`${universeRoute}/assets`, { method: "POST", body: JSON.stringify(payload) });
      await loadRegistry();
    } catch (reason) {
      state.error = reason.message || "Unable to save asset.";
      renderRegistry();
    }
  });
  document.querySelector("[data-map-form]")?.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await fetchJson(`${universeRoute}/${event.currentTarget.dataset.assetId}/map-symbol`, { method: "POST", body: JSON.stringify(formPayload(event.currentTarget)) });
      await loadRegistry();
    } catch (reason) {
      state.error = reason.message || "Unable to map symbol.";
      renderRegistry();
    }
  });
  document.querySelector("[data-import-form]")?.addEventListener("submit", async event => {
    event.preventDefault();
    const payload = formPayload(event.currentTarget);
    try {
      payload.rows = payload.rows ? JSON.parse(payload.rows) : [];
      await fetchJson(`${universeRoute}/import`, { method: "POST", body: JSON.stringify(payload) });
      await loadRegistry();
    } catch (reason) {
      state.error = reason.message || "Unable to import asset list.";
      renderRegistry();
    }
  });
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
  if (slug === "universe" && ["registry-reload", "open-add-asset", "open-import", "sync-broker-symbols"].includes(action)) {
    return registryAction(action);
  }
  if (slug === "currency-strength") {
    if (action === "currency-reload") return loadCurrencyStrength();
    if (action === "currency-export") return window.open(`${API}${currencyStrengthRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "currency-recalculate": "recalculate",
      "currency-create-alert": "create-alert",
      "currency-regenerate-summary": "regenerate-summary",
      "currency-save-summary": "save-summary",
      "sync-price-feeds": "recalculate",
      "currency-sync-broker": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${currencyStrengthRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Currency strength alert" }) });
        return loadCurrencyStrength();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderCurrencyStrength();
      }
    }
  }
  if (slug === "trend-scanner") {
    if (action === "trend-reload") return loadTrendScanner();
    if (action === "trend-export") return window.open(`${API}${trendScannerRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "trend-run-scan": "run-scan",
      "trend-recalculate": "recalculate",
      "trend-create-alert": "create-alert",
      "trend-regenerate-summary": "regenerate-summary",
      "trend-save-summary": "save-summary",
      "trend-configure": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${trendScannerRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Trend scanner alert" }) });
        return loadTrendScanner();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderTrendScanner();
      }
    }
  }
  if (slug === "market-structure") {
    if (action === "structure-reload") return loadMarketStructure();
    if (action === "structure-export") return window.open(`${API}${marketStructureRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "structure-run-scan": "run-scan",
      "structure-recalculate": "recalculate",
      "structure-create-alert": "create-alert",
      "structure-regenerate-summary": "regenerate-summary",
      "structure-save-summary": "save-summary",
      "structure-configure": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${marketStructureRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Market structure alert" }) });
        return loadMarketStructure();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderMarketStructure();
      }
    }
  }
  if (slug === "momentum") {
    if (action === "momentum-reload") return loadMomentum();
    if (action === "momentum-export") return window.open(`${API}${momentumRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "momentum-run-scan": "run-scan",
      "momentum-recalculate": "recalculate",
      "momentum-create-alert": "create-alert",
      "momentum-regenerate-summary": "regenerate-summary",
      "momentum-save-summary": "save-summary",
      "momentum-configure": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${momentumRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Momentum scanner alert" }) });
        return loadMomentum();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderMomentum();
      }
    }
  }
  if (slug === "volatility") {
    if (action === "volatility-reload") return loadVolatility();
    if (action === "volatility-export") return window.open(`${API}${volatilityRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "volatility-run-scan": "run-scan",
      "volatility-recalculate": "recalculate",
      "volatility-create-alert": "create-alert",
      "volatility-regenerate-summary": "regenerate-summary",
      "volatility-save-summary": "save-summary",
      "volatility-configure": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${volatilityRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Volatility scanner alert" }) });
        return loadVolatility();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderVolatility();
      }
    }
  }
  if (slug === "liquidity") {
    if (action === "liquidity-reload") return loadLiquidity();
    if (action === "liquidity-export") return window.open(`${API}${liquidityRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "liquidity-run-scan": "run-scan",
      "liquidity-recalculate": "recalculate",
      "liquidity-create-alert": "create-alert",
      "liquidity-regenerate-summary": "regenerate-summary",
      "liquidity-save-summary": "save-summary",
      "liquidity-configure": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${liquidityRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Liquidity scanner alert" }) });
        return loadLiquidity();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderLiquidity();
      }
    }
  }
  if (slug === "institutional") {
    if (action === "institutional-reload") return loadInstitutional();
    if (action === "institutional-export") return window.open(`${API}${institutionalRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "institutional-run-scan": "run-scan",
      "institutional-recalculate": "recalculate",
      "institutional-create-alert": "create-alert",
      "institutional-regenerate-summary": "regenerate-summary",
      "institutional-save-summary": "save-summary",
      "institutional-configure": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${institutionalRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Institutional scanner alert" }) });
        return loadInstitutional();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderInstitutional();
      }
    }
  }
  if (slug === "macro") {
    if (action === "macro-reload") return loadMacro();
    if (action === "macro-export") return window.open(`${API}${macroRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "macro-run-scan": "run-scan",
      "macro-recalculate": "recalculate",
      "macro-create-alert": "create-alert",
      "macro-regenerate-summary": "regenerate-summary",
      "macro-save-summary": "save-summary",
      "macro-configure": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${macroRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Macro scanner alert" }) });
        return loadMacro();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderMacro();
      }
    }
  }
  if (slug === "economic-events") {
    if (action === "events-reload") return loadEconomicEvents();
    if (action === "events-export") return window.open(`${API}${economicEventsRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "events-run-scan": "run-scan",
      "events-recalculate": "recalculate",
      "events-sync": "sync-events",
      "events-create-alert": "create-alert",
      "events-regenerate-summary": "regenerate-summary",
      "events-save-summary": "save-summary",
      "events-configure": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${economicEventsRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Economic events scanner alert" }) });
        return loadEconomicEvents();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderEconomicEvents();
      }
    }
  }
  if (slug === "sentiment") {
    if (action === "sentiment-reload") return loadSentiment();
    if (action === "sentiment-export") return window.open(`${API}${sentimentRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "sentiment-run-scan": "run-scan",
      "sentiment-recalculate": "recalculate",
      "sentiment-create-alert": "create-alert",
      "sentiment-regenerate-summary": "regenerate-summary",
      "sentiment-save-summary": "save-summary",
      "sentiment-configure": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${sentimentRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Sentiment scanner alert" }) });
        return loadSentiment();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderSentiment();
      }
    }
  }
  if (slug === "risk") {
    if (action === "risk-reload") return loadRisk();
    if (action === "risk-export") return window.open(`${API}${riskRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "risk-run-scan": "run-scan",
      "risk-recalculate": "recalculate",
      "risk-create-alert": "create-alert",
      "risk-regenerate-summary": "regenerate-summary",
      "risk-save-summary": "save-summary",
      "risk-configure": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${riskRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Risk scanner alert" }) });
        return loadRisk();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderRisk();
      }
    }
  }
  if (slug === "prop-compliance") {
    if (action === "prop-reload") return loadPropCompliance();
    if (action === "prop-export") return window.open(`${API}${propComplianceRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "prop-run-scan": "run-scan",
      "prop-recalculate": "recalculate",
      "prop-sync-rules": "sync-rules",
      "prop-create-alert": "create-alert",
      "prop-regenerate-summary": "regenerate-summary",
      "prop-save-summary": "save-summary",
      "prop-configure": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${propComplianceRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Prop compliance scanner alert" }) });
        return loadPropCompliance();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderPropCompliance();
      }
    }
  }
  if (slug === "opportunities") {
    if (action === "opportunity-reload") return loadOpportunities();
    if (action === "opportunity-export") return window.open(`${API}${opportunitiesRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "opportunity-run-ranking": "run-ranking",
      "opportunity-recalculate": "recalculate",
      "opportunity-create-alert": "create-alert",
      "opportunity-regenerate-summary": "regenerate-summary",
      "opportunity-save-summary": "save-summary",
      "opportunity-configure": "recalculate",
      "opportunity-send-qualified": "recalculate",
      "opportunity-create-package": "recalculate"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${opportunitiesRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Opportunity ranking alert" }) });
        return loadOpportunities();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderOpportunities();
      }
    }
  }
  if (slug === "qualified-trades") {
    if (action === "qualified-reload") return loadQualifiedTrades();
    if (action === "qualified-export") return window.open(`${API}${qualifiedTradesRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = {
      "qualified-validate": "validate",
      "qualified-create-alert": "create-alert",
      "qualified-regenerate-summary": "regenerate-summary",
      "qualified-save-summary": "save-summary"
    };
    if (actionMap[action]) {
      try {
        await fetchJson(`${qualifiedTradesRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "Qualified trade alert" }) });
        return loadQualifiedTrades();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderQualifiedTrades();
      }
    }
    if (["qualified-create-package", "qualified-send-scoring", "qualified-review", "qualified-expire"].includes(action)) {
      const candidateId = state.detail?.candidate?.candidateId || state.data?.candidates?.[0]?.candidateId;
      if (!candidateId) return loadQualifiedTrades();
      const endpoint = action === "qualified-create-package" ? "create-package" : action === "qualified-send-scoring" ? "send-to-scoring" : action === "qualified-review" ? "mark-review-required" : "expire";
      try {
        await fetchJson(`${qualifiedTradesRoute}/${candidateId}/${endpoint}`, { method: "POST", body: JSON.stringify({ title: "Qualified trade action" }) });
        return loadQualifiedTrades();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderQualifiedTrades();
      }
    }
  }
  if (slug === "ai-insights") {
    if (action === "ai-reload") return loadAiInsights();
    if (action === "ai-export") return window.open(`${API}${aiInsightsRoute}/export`, "_blank", "noopener,noreferrer");
    const actionMap = { "ai-generate": "generate", "ai-regenerate": "regenerate" };
    if (actionMap[action]) {
      try {
        await fetchJson(`${aiInsightsRoute}/${actionMap[action]}`, { method: "POST", body: JSON.stringify({ title: "AI opportunity insight" }) });
        return loadAiInsights();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderAiInsights();
      }
    }
    if (["ai-mark-reviewed", "ai-create-alert"].includes(action)) {
      const insightId = state.detail?.insightId || state.detail?.id;
      if (!insightId) return loadAiInsights();
      const endpoint = action === "ai-mark-reviewed" ? "mark-reviewed" : "create-alert";
      try {
        await fetchJson(`${aiInsightsRoute}/${insightId}/${endpoint}`, { method: "POST", body: JSON.stringify({ title: "AI insight alert" }) });
        return loadAiInsights();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderAiInsights();
      }
    }
  }
  if (slug === "control-center") {
    if (action === "control-reload") return loadControlCenter();
    const map = {
      "control-initialize": "initialize",
      "control-run-full-scan": "run-full-scan",
      "control-run-module": "run-module",
      "control-pause": "pause",
      "control-resume": "resume",
      "control-stop": "stop",
      "control-emergency-stop": "emergency-stop",
      "control-mode-manual": "change-mode",
      "control-mode-scheduled": "change-mode",
      "control-mode-continuous": "change-mode",
      "control-mode-safe": "change-mode",
      "control-mode-maintenance": "change-mode",
      "control-create-schedule": "schedules"
    };
    if (map[action]) {
      const mode = action.includes("scheduled") ? "Scheduled" : action.includes("continuous") ? "Continuous" : action.includes("safe") ? "Safe Mode" : action.includes("maintenance") ? "Maintenance Mode" : "Manual";
      try {
        await fetchJson(`${controlCenterRoute}/${map[action]}`, { method: "POST", body: JSON.stringify({ scannerMode: mode, title: "Scanner control action" }) });
        return loadControlCenter();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderControlCenter();
      }
    }
  }
  if (slug === "logs") {
    if (action === "logs-reload" || action === "logs-clear-filters") return loadLogsCenter();
    if (["logs-acknowledge", "logs-resolve", "logs-create-incident"].includes(action)) {
      const logId = state.detail?.log?.logId || state.data?.logs?.[0]?.logId;
      if (!logId) return loadLogsCenter();
      const endpoint = action === "logs-acknowledge" ? "acknowledge" : action === "logs-resolve" ? "resolve" : "create-incident";
      try {
        await fetchJson(`${logsRoute}/${logId}/${endpoint}`, { method: "POST", body: JSON.stringify({ incidentTitle: "Scanner incident", title: "Scanner log action" }) });
        return loadLogsCenter();
      } catch (reason) {
        state.error = reason.message || `Unable to run ${action}.`;
        return renderLogsCenter();
      }
    }
  }
  if (slug === "test-harness") {
    if (action === "harness-reload") return loadTestHarness();
    if (action === "harness-run") {
      const first = state.data?.catalog?.[0]?.id || "data-input-readiness";
      return runHarnessTest(first);
    }
    if (action === "harness-run-data") return runHarnessTest("data-input-readiness");
    if (action === "harness-run-readiness") return runHarnessTest("card3-readiness-diagnostic");
    if (action === "harness-run-ai") return runHarnessTest("ai-grounding-validation");
    if (action === "harness-run-selected") {
      const testIds = Array.from(document.querySelectorAll("[data-harness-select]:checked")).map(item => item.dataset.harnessSelect);
      try {
        await fetchJson(`${testHarnessRoute}/run-selected`, { method: "POST", body: JSON.stringify({ testIds, safetyMode: selectedHarnessMode() }) });
        return loadTestHarness();
      } catch (reason) {
        state.error = reason.message || "Unable to run selected scanner tests.";
        return renderHarnessCenter();
      }
    }
    if (action === "harness-bootstrap") {
      try {
        await fetchJson(`${testHarnessRoute}/bootstrap-pipeline`, { method: "POST", body: JSON.stringify({}) });
        return loadTestHarness();
      } catch (reason) {
        state.error = reason.message || "Unable to bootstrap scanner pipeline.";
        return renderHarnessCenter();
      }
    }
    if (action === "harness-run-full") {
      try {
        await fetchJson(`${testHarnessRoute}/run-full-diagnostic`, { method: "POST", body: JSON.stringify({ safetyMode: selectedHarnessMode() }) });
        return loadTestHarness();
      } catch (reason) {
        state.error = reason.message || "Unable to run full scanner diagnostic.";
        return renderHarnessCenter();
      }
    }
    if (["harness-schedule", "harness-create-incident"].includes(action)) return loadTestHarness();
  }
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
if (slug === "dashboard") loadDashboard(); else if (slug === "universe") loadRegistry(); else if (slug === "currency-strength") loadCurrencyStrength(); else if (slug === "trend-scanner") loadTrendScanner(); else if (slug === "market-structure") loadMarketStructure(); else if (slug === "momentum") loadMomentum(); else if (slug === "volatility") loadVolatility(); else if (slug === "liquidity") loadLiquidity(); else if (slug === "institutional") loadInstitutional(); else if (slug === "macro") loadMacro(); else if (slug === "economic-events") loadEconomicEvents(); else if (slug === "sentiment") loadSentiment(); else if (slug === "risk") loadRisk(); else if (slug === "prop-compliance") loadPropCompliance(); else if (slug === "opportunities") loadOpportunities(); else if (slug === "qualified-trades") loadQualifiedTrades(); else if (slug === "ai-insights") loadAiInsights(); else if (slug === "control-center") loadControlCenter(); else if (slug === "logs") loadLogsCenter(); else if (slug === "test-harness") loadTestHarness(); else renderSectionPlaceholder();

const nigeriaTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
setInterval(() => document.querySelector("#utc-clock").textContent = `WAT ${nigeriaTime.format(new Date())}`, 1000);
