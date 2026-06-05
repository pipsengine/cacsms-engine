const API = "http://localhost:8080";
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const display = value => value === null || value === undefined || value === "" ? "—" : esc(value);
const percent = value => value === null || value === undefined || value === "" ? "—" : `${Math.round(Number(value))}%`;
const labels = {
  dashboard: ["Market Intelligence Gathering Dashboard", "Card 2 intelligence packaging readiness after source validation."],
  "validated-package": ["Validated Intelligence Package", "Read-only Card 1 output consumed by Market Intelligence Gathering."],
  "source-health-review": ["Source Health Review", "Review validated readiness, freshness and confidence before intelligence production."],
  "dependency-matrix": ["Intelligence Dependency Matrix", "Map dependencies between market data, news, calendar, COT, broker and portfolio inputs."],
  "market-environment": ["Market Environment Intelligence", "Build session, volatility, trend and correlation intelligence."],
  "macro-intelligence": ["Macro Intelligence", "Build economic, central bank, rate and inflation context."],
  "sentiment-intelligence": ["Sentiment Intelligence", "Build news sentiment, social sentiment and risk-on/risk-off context."],
  "institutional-intelligence": ["Institutional Intelligence", "Build COT bias, institutional positioning and positioning analysis."],
  "broker-liquidity": ["Broker & Liquidity Intelligence", "Build liquidity, spread and execution readiness intelligence."],
  "portfolio-intelligence": ["Portfolio & Account Intelligence", "Build account, exposure and risk context."],
  "scoring-engine": ["Intelligence Scoring Engine", "Generate market, macro, sentiment, institutional, liquidity and confidence scores."],
  "package-builder": ["Market Intelligence Package Builder", "Generate the Card 2 Market Intelligence Package."],
  handoff: ["Intelligence Handoff to Asset Scanner", "Prepare the Card 3 input package for the 20-Asset Universe Scanner."],
  logs: ["Intelligence Audit & Logs", "Processing history for Card 2 intelligence production."],
  "test-harness": ["Card 2 Test Harness", "Acceptance testing for Market Intelligence Gathering."],
  "data-sources": ["Data Sources & Feed Health", "Live adapter status, freshness and configuration readiness."],
  "market-data-providers": ["Market Data Providers", "Live pricing feed connectors for ticks, OHLCV, depth and spread data."],
  "market-data": ["Market Data Providers", "Live pricing feed connectors for ticks, OHLCV, depth and spread data."],
  "news-sources": ["News & Sentiment Sources", "Live configured headline and sentiment providers."],
  "news-sentiment": ["News & Sentiment Sources", "Live configured headline and sentiment providers."],
  "economic-calendar": ["Economic Calendar", "Live configured economic-event ingestion and freshness."],
  "social-sentiment": ["Social & Community Sentiment", "Optional live community sentiment connectors."],
  "historical-data": ["Historical Data", "Live OHLCV archive connectors and imported datasets."],
  "broker-data": ["Broker Data", "Live broker bridges, pricing feeds and execution telemetry."],
  "account-portfolio": ["Account Portfolio Intelligence Center", "Institutional portfolio analytics, multi-account risk, prop compliance and AI advisor."],
  "prop-firm-rules": ["Prop Firm Rules", "Live imported rule catalogs and connected account compliance state."],
  "data-quality-gate": ["Data Quality Gate", "Source-honest Card 1 workflow admission control using live adapter status only."]
};
const card1SlugAliases = {
  dashboard: "data-sources",
  "market-data-providers": "market-data",
  "news-sources": "news-sentiment"
};
const card2Pages = {
  dashboard: [["Input Package", "Validated Intelligence Package"], ["Processing Status", "READY"], ["Output Package", "Market Intelligence Package"], ["Readiness Score", "98%"]],
  "validated-package": [["Mode", "READ ONLY"], ["Owner", "Card 1"], ["Editable", "NO"], ["Consumer", "Card 2"]],
  "source-health-review": [["Source readiness", "REVIEWED"], ["Freshness", "CURRENT"], ["Confidence", "HIGH"], ["Gate", "PASSED"]],
  "dependency-matrix": [["Market Data", "CONNECTED"], ["News", "CONNECTED"], ["Calendar", "CONNECTED"], ["COT", "SYNCED"]],
  "market-environment": [["Session", "BUILD"], ["Volatility", "BUILD"], ["Trend", "BUILD"], ["Correlation", "BUILD"]],
  "macro-intelligence": [["Economic Context", "BUILD"], ["Central Banks", "BUILD"], ["Interest Rates", "BUILD"], ["Inflation", "BUILD"]],
  "sentiment-intelligence": [["News Sentiment", "BUILD"], ["Social Sentiment", "BUILD"], ["Risk Tone", "BUILD"], ["Consensus", "PENDING"]],
  "institutional-intelligence": [["COT Intelligence", "BUILD"], ["Institutional Bias", "BUILD"], ["Positioning", "BUILD"], ["Confidence", "PENDING"]],
  "broker-liquidity": [["Liquidity Score", "BUILD"], ["Spread Score", "BUILD"], ["Execution Readiness", "BUILD"], ["Slippage Risk", "REVIEW"]],
  "portfolio-intelligence": [["Account Context", "BUILD"], ["Exposure Context", "BUILD"], ["Risk Context", "BUILD"], ["Constraints", "REVIEW"]],
  "scoring-engine": [["Market Score", "GENERATE"], ["Macro Risk", "GENERATE"], ["Sentiment", "GENERATE"], ["Confidence", "GENERATE"]],
  "package-builder": [["Package", "Market Intelligence Package"], ["Inputs", "VALIDATED"], ["Builder", "READY"], ["Output", "PENDING"]],
  handoff: [["Card 3 Input", "Asset Scanner Input Package"], ["Source Package", "Market Intelligence Package"], ["Handoff", "READY"], ["Next", "20-Asset Universe Scanner"]],
  logs: [["Audit Trail", "ENABLED"], ["Processing History", "READY"], ["Card", "2"], ["Mode", "INTELLIGENCE PRODUCTION"]],
  "test-harness": [["Acceptance", "PENDING"], ["Input", "Validated Intelligence Package"], ["Output", "Market Intelligence Package"], ["Permission", "TEST_REQUIRED"]]
};
const badge = value => `<b class="live-badge ${["ONLINE","LIVE","SYNCED","PASSED","ALLOWED","READY","VALIDATED","CONTINUE","APPROVED"].includes(value) ? "ok" : value === "OPTIONAL" ? "warn" : "bad"}">${value}</b>`;
const statusBadge = value => {
  const normalized = String(value || "").toUpperCase();
  return `<b class="live-badge ${["ONLINE","LIVE","SYNCED","PASSED","ALLOWED","READY","RECEIVED","INPUT_RECEIVED","SENT","COMPLETED","VALIDATED","CONTINUE","APPROVED","HEALTHY","NORMAL","VALID","FRESH"].includes(normalized) ? "ok" : ["PENDING","WAITING","WAITING_FOR_INPUT","PROCESSING","VALIDATING","WARNING","SCHEMA_NOT_READY","DATABASE_NOT_CONFIGURED","PACKAGE_NOT_AVAILABLE","EMPTY","UNKNOWN","UNCONFIGURED","NEAR_STALE"].includes(normalized) ? "warn" : "bad"}">${display(value)}</b>`;
};
const sourceRequirementLabel = (source) => {
  if (source.connectionLabel) return `${source.required ? "REQUIRED" : "OPTIONAL"} / ${source.connectionLabel}`;
  return source.required ? "REQUIRED" : "OPTIONAL";
};
const table = (headers, rows) => `<div class="live-table"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const formatTime = value => value ? new Date(value).toLocaleString() : "Never";
const AUTO_REFRESH_MS = 30000;
let data;
let error = "";
let refreshTimer = null;
let activeSlug = "data-sources";

function isCurrentSlug(slug) {
  const parts = location.pathname.split("/").filter(Boolean);
  const current = parts[0] === "workspace" ? parts[2] : parts[1] || "dashboard";
  return current === slug || card1SlugAliases[current] === card1SlugAliases[slug];
}

function parseLiveDashboardPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload.sources) && payload.gate) return payload;
  if (payload.event && Array.isArray(payload.event.sources)) return payload.event;
  return null;
}

function showLiveStatus(message, tone = "ok") {
  let element = document.querySelector(".live-status-toast");
  if (!element) {
    element = document.createElement("div");
    element.className = "live-status-toast";
    document.body.append(element);
  }
  element.className = `live-status-toast ${tone}`;
  element.textContent = message;
  clearTimeout(showLiveStatus.timer);
  showLiveStatus.timer = setTimeout(() => element.remove(), 3200);
}

function setLiveButtonsBusy(busy, label = "Working...") {
  document.querySelectorAll("[data-live-test], [data-live-refresh], [data-card2-action], [data-source-health-action], [data-dependency-action], [data-market-env-action]").forEach((button) => {
    if (busy) {
      button.dataset.liveLabel = button.dataset.liveLabel || button.textContent;
      button.disabled = true;
      button.textContent = label;
    } else {
      button.disabled = false;
      if (button.dataset.liveLabel) button.textContent = button.dataset.liveLabel;
    }
  });
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

export function unmountLiveMarketIntelligencePage() {
  stopAutoRefresh();
}

function startAutoRefresh(slug, owner = "card-2") {
  stopAutoRefresh();
  activeSlug = slug;
  if (owner !== "card-1" && slug !== "dashboard") return;
  if (owner === "card-1" && !["data-sources", "dashboard", "data-quality-gate", "logs", "test-harness"].includes(slug)) return;
  refreshTimer = setInterval(() => {
    if (document.hidden) return;
    load(slug, { silent: true, owner });
  }, AUTO_REFRESH_MS);
}

function renderDataSourcesValidation() {
  const sources = data.sources;
  const gate = data.gate;
  const sourceCards = sources.map(source => `<article class="live-source-card ${source.status.toLowerCase().replaceAll("_","-")}">
    <div><small>${sourceRequirementLabel(source)}</small>${badge(source.status)}</div>
    <h2>${source.name}</h2><p>${source.provider}</p>
    <dl><div><dt>Availability</dt><dd>${source.checks.availability ? "PASSED" : "FAILED"}</dd></div><div><dt>API Validation</dt><dd>${source.checks.apiValidation ? "PASSED" : "FAILED"}</dd></div><div><dt>Latency</dt><dd>${source.checks.latency}</dd></div><div><dt>Freshness</dt><dd>${source.checks.freshness}</dd></div><div><dt>Records</dt><dd>${source.records}</dd></div><div><dt>Quality</dt><dd>${source.checks.quality}</dd></div></dl>
    ${source.probeError ? `<p class="live-source-error">${source.configuration || source.probeError}</p>` : ""}
  </article>`).join("");
  const evidence = sources.map(source => [source.name,source.provider,source.required?"REQUIRED":"OPTIONAL",badge(source.status),source.httpStatus||"-",source.latencyMs?`${source.latencyMs} ms`:"-",source.freshness,source.records,source.adapter,source.failureAction]);
  const logs = data.probeLog?.length ? table(["Probe ID","Checked At","Live Sources","Unavailable","Quality"],data.probeLog.map(item=>[item.id,formatTime(item.probedAt),item.live,item.unavailable,`${item.qualityScore}%`])) : "<p>No manual live validation runs recorded yet. Run the probe to create audit evidence.</p>";
  return `<section class="live-page">
    <header class="live-header"><div><small>DATA SOURCES VALIDATION / CARD 1 / LIVE ADAPTERS</small><h1>Data Sources & Feed Health</h1><p>Verify availability, API connectivity, latency, freshness and data quality before workflow admission. This page displays runtime probe evidence only. Status refreshes automatically every 30 seconds.</p></div><aside>${badge(gate.workflowPermission)}<span>MODE / LIVE ADAPTERS ONLY</span><span>LAST PROBE / ${formatTime(data.probedAt)}</span></aside></header>
    <div class="live-actions"><button type="button" data-live-test>Run Validation Now</button><button type="button" data-live-refresh>Refresh Now</button><a href="/workspace/data-sources-validation/test-harness">Open Card 1 Test Harness</a><a href="/workspace/data-sources-validation/institutional-cot">Open Official CFTC COT</a></div>
    <section class="live-kpis">${[["Card 1 Permission",gate.workflowPermission],["Validation Status",gate.validationStatus],["Required Healthy",`${gate.requiredHealthyCount} / ${gate.requiredSourceCount}`],["Optional Healthy",`${gate.optionalHealthyCount} / ${gate.optionalSourceCount}`],["Quality Score",`${gate.dataQualityScore}%`],["Live Adapters",data.summary.live],["Unavailable",data.summary.unavailable],["Fabricated Rows","0"]].map(([a,b])=>`<article><small>${a}</small><strong>${b}</strong></article>`).join("")}</section>
    <article class="live-card"><div class="live-title"><div><h2>LIVE SOURCE VALIDATION GRID</h2><p>Every card is derived from a live HTTP probe, validated official archive, or an explicit unconfigured state.</p></div></div><div class="live-source-grid">${sourceCards}</div></article>
    <article class="live-card"><div class="live-title"><div><h2>VALIDATION EVIDENCE MATRIX</h2><p>HTTP status and latency appear when a configured remote connector is probed.</p></div></div>${table(["Source","Provider","Requirement","Status","HTTP","Latency","Freshness","Records","Adapter","Failure Action"],evidence)}</article>
    <div class="live-split"><article class="live-card live-gate"><div class="live-title"><div><h2>CARD 1 WORKFLOW ADMISSION</h2><p>Card 2 stays locked until required source validation passes.</p></div>${badge(gate.workflowPermission)}</div><p><strong>${gate.validationStatus}</strong> / ${gate.dataQualityScore}% source quality.</p>${gate.rejectReasons.concat(gate.warnings).map(item=>`<p>${item}</p>`).join("")||"<p>All required live source checks passed.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>LIVE PROBE AUDIT LOG</h2><p>Recent manual validation evidence retained in this API process.</p></div></div>${logs}</article></div>
  </section>`;
}

function renderCard1Utility(slug) {
  const [title, subtitle] = labels[slug] || labels["data-sources"];
  const gate = data.gate;
  if (slug === "logs") {
    const logs = data.probeLog?.length ? table(["Probe ID","Checked At","Live Sources","Unavailable","Quality"],data.probeLog.map(item=>[item.id,formatTime(item.probedAt),item.live,item.unavailable,`${item.qualityScore}%`])) : "<p>No manual source validation runs recorded yet.</p>";
    return `<section class="live-page"><header class="live-header"><div><small>DATA SOURCES VALIDATION / CARD 1 / AUDIT</small><h1>${title}</h1><p>Audit trail for source validation probes and workflow admission decisions.</p></div><aside>${badge(gate.workflowPermission)}<span>OUTPUT / VALIDATED INTELLIGENCE PACKAGE</span></aside></header><article class="live-card">${logs}</article></section>`;
  }
  return `<section class="live-page"><header class="live-header"><div><small>DATA SOURCES VALIDATION / CARD 1 / ACCEPTANCE</small><h1>${title}</h1><p>${subtitle}</p></div><aside>${badge(gate.workflowPermission)}<span>INPUT / LIVE SOURCE ADAPTER SNAPSHOTS</span><span>OUTPUT / VALIDATED INTELLIGENCE PACKAGE</span></aside></header><section class="live-kpis">${[["Card Under Test","01"],["Completion Status",gate.validationStatus],["Workflow Permission",gate.workflowPermission],["Data Quality Score",`${gate.dataQualityScore}%`],["Required Sources",`${gate.requiredHealthyCount} / ${gate.requiredSourceCount}`],["Optional Sources",`${gate.optionalHealthyCount} / ${gate.optionalSourceCount}`]].map(([a,b])=>`<article><small>${a}</small><strong>${b}</strong></article>`).join("")}</section><article class="live-card live-gate"><h2>Card 1 Acceptance Test</h2><p>Card 1 validates source availability, freshness, latency, coverage and workflow admission readiness. It does not generate market intelligence.</p><div class="live-actions"><a href="/executive-command-center/workflow-dashboard">Open Workflow Card Test Queue</a><button type="button" data-live-test>Run Validation Now</button></div></article></section>`;
}

function renderCard2(slug) {
  if (slug === "dashboard") return renderCard2Dashboard();
  if (slug === "validated-package") return renderValidatedPackagePage();
  if (slug === "source-health-review") return renderSourceHealthReviewPage();
  if (slug === "dependency-matrix") return renderDependencyMatrixPage();
  if (slug === "market-environment") return renderMarketEnvironmentPage();
  const [title, subtitle] = labels[slug] || labels.dashboard;
  const rows = card2Pages[slug] || card2Pages.dashboard;
  const sourceRows = (data.sources || []).map(item => [item.name, item.required ? "REQUIRED" : "OPTIONAL", badge(item.status), item.freshness, item.records, item.adapter]);
  return `<section class="live-page">
    <header class="live-header"><div><small>MARKET INTELLIGENCE CENTER / CARD 2 / INTELLIGENCE PRODUCTION</small><h1>${title}</h1><p>${subtitle}</p></div><aside>${badge(data.gate.workflowPermission)}<span>INPUT / VALIDATED INTELLIGENCE PACKAGE</span><span>OUTPUT / MARKET INTELLIGENCE PACKAGE</span></aside></header>
    <section class="live-kpis">${rows.map(([a,b])=>`<article><small>${a}</small><strong>${b}</strong></article>`).join("")}</section>
    <article class="live-card"><div class="live-title"><div><h2>VALIDATED INTELLIGENCE PACKAGE INPUT</h2><p>Card 2 consumes Card 1 output in read-only mode. Source configuration remains owned by Data Sources Validation.</p></div></div>${table(["Source","Requirement","Status","Freshness","Records","Adapter"],sourceRows)}</article>
    <div class="live-split"><article class="live-card"><h2>INTELLIGENCE PRODUCTION SCOPE</h2><p>This card transforms validated inputs into market, macro, sentiment, institutional, liquidity and account intelligence.</p><p>Configuration and connector management are intentionally excluded from Card 2.</p></article><article class="live-card live-gate"><h2>HANDOFF STATUS</h2><p><strong>${slug === "handoff" ? "Asset Scanner Input Package" : "Market Intelligence Package"}</strong></p><p>Next workflow card: 20-Asset Universe Scanner.</p><div class="live-actions"><a href="/workspace/data-sources-validation/dashboard">Review Card 1 Output</a><a href="/workspace/asset-scanner/dashboard">Open Card 3</a></div></article></div>
  </section>`;
}

function summaryValue(label, value) {
  return ["Validation Score", "Acceptance Score", "Data Confidence Score", "Freshness Score"].includes(label)
    ? percent(value)
    : display(value);
}

function renderJsonPayload(payload) {
  return `<pre class="vip-json" data-vip-json>${esc(JSON.stringify(payload || {}, null, 2))}</pre>`;
}

function renderSelectFilter(label, values) {
  return `<label><span>${esc(label)}</span><select><option>All</option>${(values || []).map(value => `<option>${display(value)}</option>`).join("")}</select></label>`;
}

function renderTrend(title, rows, suffix = "%") {
  if (!rows?.length) return `<article><h3>${esc(title)}</h3><p>No production trend records available.</p></article>`;
  const max = Math.max(...rows.map(row => Number(row.value || 0)), 1);
  return `<article><h3>${esc(title)}</h3>${rows.map(row => `<p><span>${display(row.label)}</span><strong>${display(row.value)}${suffix}</strong><i style="--w:${Math.max(3, Math.round(Number(row.value || 0) / max * 100))}%"></i></p>`).join("")}</article>`;
}

function renderSourceDrawer(source) {
  const details = [
    ["Source Profile", source.source],
    ["Provider Details", `${source.provider || "Unknown"} / ${source.providerType || "Unknown"}`],
    ["Current Status", source.status],
    ["Health Score", percent(source.healthScore)],
    ["Last Sync", formatTime(source.lastSync)],
    ["Last Success", formatTime(source.lastSuccess)],
    ["Last Failure", formatTime(source.lastFailure)],
    ["Latency History", source.latencyMs === null || source.latencyMs === undefined ? null : `${source.latencyMs} ms`],
    ["Availability History", percent(source.availabilityPct)],
    ["Recent Errors", source.lastFailure ? "Review sync failure records" : "No recorded failure"],
    ["Validation Issues", source.recordsRejected ? `${source.recordsRejected} rejected records` : "No recorded issue"],
    ["Rate Limit Usage", source.rateLimit],
    ["Credential Status", source.authentication],
    ["Affected Modules", source.module],
    ["Recommended Actions", source.recommendedAction],
    ["Audit History", "Open audit log below"]
  ];
  return `<details class="shr-drawer"><summary><span>${display(source.source)}</span>${statusBadge(source.health)}</summary><div class="shr-drawer-grid">${details.map(([label,value]) => `<p><span>${esc(label)}</span><strong>${display(value)}</strong></p>`).join("")}</div><div class="live-actions"><button type="button" data-source-health-action="run-check">Run Health Check</button><button type="button" data-source-health-action="sync-failed">Sync Now</button><a href="/workspace/data-sources-validation/source-configuration">Open Source Registry</a><button type="button" data-source-health-view="logs">View Logs</button><button type="button" data-source-health-action="export">Export Source Report</button></div></details>`;
}

function renderSourceHealthReviewPage() {
  const d = data || {};
  if (["DATABASE_NOT_CONFIGURED", "SCHEMA_NOT_READY"].includes(d.status)) {
    return `<section class="live-page shr-page"><header class="live-header"><div><small>MARKET INTELLIGENCE CENTER / SOURCE HEALTH</small><h1>Source Health Review Center</h1><p>Review live provider health, synchronization performance, API reliability, latency, data quality, and operational risks across all market intelligence sources.</p></div><aside>${statusBadge(d.status)}<span>PRODUCTION LIVE</span><span>MOCK DATA DISABLED</span><span>LIVE PROVIDERS ONLY</span></aside></header><article class="live-card live-empty"><h2>${display(d.status)}</h2><p>${display(d.message)}</p></article></section>`;
  }
  if (d.status === "EMPTY") {
    return `<section class="live-page shr-page"><header class="live-header"><div><small>MARKET INTELLIGENCE CENTER / SOURCE HEALTH</small><h1>Source Health Review Center</h1><p>${display(d.header?.subtitle)}</p></div><aside>${statusBadge("PRODUCTION LIVE")}<span>MOCK DATA DISABLED</span><span>LIVE PROVIDERS ONLY</span><span>LAST HEALTH CHECK / ${formatTime(d.badges?.lastHealthCheck)}</span></aside></header><article class="live-card live-empty"><h2>No production data sources registered yet.</h2><p>Register a source in the Data Source Intelligence Center to begin health monitoring.</p><div class="live-actions"><a href="/workspace/data-sources-validation/source-configuration">Open Source Registry</a><a href="/workspace/data-sources-validation/source-configuration">Add Data Source</a><a href="/workspace/data-sources-validation/dashboard">View Setup Guide</a></div></article></section>`;
  }
  const filters = d.filters || {};
  const sourceRows = (d.sources || []).map(source => [
    `<button type="button" class="shr-source-link" data-source-id="${esc(source.id)}">${display(source.source)}</button>`,
    source.module,
    source.provider,
    source.providerType,
    statusBadge(source.status),
    statusBadge(source.health),
    source.priority,
    formatTime(source.lastSync),
    formatTime(source.lastSuccess),
    formatTime(source.lastFailure),
    source.latencyMs === null || source.latencyMs === undefined ? "-" : `${source.latencyMs} ms`,
    percent(source.availabilityPct),
    percent(source.successRatePct),
    percent(source.failureRatePct),
    source.recordsImported,
    source.recordsRejected,
    source.dataFreshness,
    statusBadge(source.rateLimit),
    statusBadge(source.authentication),
    source.environment,
    `<button type="button" data-source-health-action="run-check">Run Check</button> <button type="button" data-source-health-action="sync-failed">Sync Now</button> <button type="button" data-source-health-view="logs">View Logs</button> <a href="/workspace/data-sources-validation/source-configuration">Open Registry</a>`
  ]);
  const drawer = (d.sources || []).map(renderSourceDrawer).join("");
  return `<section class="live-page shr-page">
    <header class="live-header"><div><small>MARKET INTELLIGENCE CENTER / SOURCE HEALTH REVIEW</small><h1>Source Health Review Center</h1><p>Review live provider health, synchronization performance, API reliability, latency, data quality, and operational risks across all market intelligence sources.</p></div><aside>${statusBadge("PRODUCTION LIVE")}<span>MOCK DATA DISABLED</span><span>LIVE PROVIDERS ONLY</span><span>LAST HEALTH CHECK / ${formatTime(d.badges?.lastHealthCheck)}</span><span>SYSTEM HEALTH / ${percent(d.badges?.systemHealthScore)}</span></aside></header>
    <div class="live-actions"><button type="button" data-source-health-action="refresh">Refresh Health</button><button type="button" data-source-health-action="run-check">Run Health Check</button><button type="button" data-source-health-action="sync-failed">Sync Failed Sources</button><button type="button" data-source-health-action="export">Export Health Report</button><a href="/workspace/data-sources-validation/source-configuration">Open Source Registry</a></div>
    <section class="live-kpis shr-kpis">${(d.summary || []).map(([label,value,tone]) => `<article class="${esc(tone || "info")}"><small>${display(label)}</small><strong>${typeof value === "number" && String(label).includes("Score") ? percent(value) : display(value)}</strong></article>`).join("")}</section>
    <article class="live-card shr-filters"><div class="live-title"><div><h2>HEALTH REVIEW FILTERS</h2><p>Client-side filter controls for production records.</p></div></div><div>${renderSelectFilter("Module", filters.modules)}${renderSelectFilter("Source Category", filters.sourceCategories)}${renderSelectFilter("Provider", filters.providers)}${renderSelectFilter("Status", filters.statuses)}${renderSelectFilter("Health", filters.health)}${renderSelectFilter("Priority", filters.priorities)}${renderSelectFilter("Environment", filters.environments)}${renderSelectFilter("Authentication Type", filters.authenticationTypes)}${renderSelectFilter("Date Range", filters.dateRanges)}${renderSelectFilter("Failure Type", filters.failureTypes)}${renderSelectFilter("Rate Limit Status", filters.rateLimitStatuses)}</div></article>
    <article class="live-card"><div class="live-title"><div><h2>SOURCE HEALTH TABLE</h2><p>Production provider status, reliability, latency, sync and quality health.</p></div></div>${table(["Source","Module","Provider","Provider Type","Status","Health","Priority","Last Sync","Last Success","Last Failure","Latency","Availability %","Success Rate %","Failure Rate %","Records Imported","Records Rejected","Data Freshness","Rate Limit","Authentication","Environment","Actions"], sourceRows)}</article>
    <article class="live-card"><div class="live-title"><div><h2>DETAIL DRAWER</h2><p>Open a source for profile, provider, latency, errors, validation, rate limit, credential, dependency and audit context.</p></div></div>${drawer}</article>
    <article class="live-card"><div class="live-title"><div><h2>DATA FRESHNESS REVIEW</h2><p>Fresh, near-stale, stale, expired and never-synced production feeds.</p></div></div>${table(["Source","Expected Refresh Interval","Last Successful Sync","Age Of Data","Freshness Status","Affected Module","Recommended Action"], (d.freshness || []).map(row => [row.source,row.expectedRefreshInterval,formatTime(row.lastSuccessfulSync),row.ageOfData,statusBadge(row.freshnessStatus),row.affectedModule,row.recommendedAction]))}</article>
    <article class="live-card"><div class="live-title"><div><h2>SYNC FAILURE REVIEW</h2><p>Failed production sync jobs and unresolved operational risks.</p></div></div>${(d.failures || []).length ? table(["Time","Source","Provider","Job Type","Failure Type","Error Message","Retry Count","Resolved","Affected Records","Severity","Action"], d.failures.map(row => [formatTime(row.time),row.source,row.provider,row.jobType,row.failureType,row.errorMessage,row.retryCount,row.resolved ? "YES" : "NO",row.affectedRecords,statusBadge(row.severity),row.action])) : "<p>No production sync failure records available.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>API RELIABILITY PANEL</h2><p>Charts only render when production trend records exist.</p></div></div><div class="shr-trends">${renderTrend("Availability Trend", d.reliability?.availabilityTrend)}${renderTrend("Latency Trend", d.reliability?.latencyTrend, " ms")}${renderTrend("Success Rate Trend", d.reliability?.successRateTrend)}${renderTrend("Failure Rate Trend", d.reliability?.failureRateTrend)}${renderTrend("Rate Limit Usage", d.reliability?.rateLimitUsage)}${renderTrend("Records Imported Trend", d.reliability?.recordsImportedTrend, "")}</div></article>
    <article class="live-card"><div class="live-title"><div><h2>DATA QUALITY REVIEW</h2><p>Validation and data quality issues from production validation logs.</p></div></div><section class="live-kpis shr-quality">${(d.quality?.metrics || []).map(([label,value]) => `<article><small>${display(label)}</small><strong>${String(label).includes("%") ? percent(value) : display(value)}</strong></article>`).join("")}</section>${(d.quality?.rows || []).length ? table(["Source","Validation Rule","Issue Count","Severity","Last Detected","Status","Recommended Fix"], d.quality.rows.map(row => [row.source,row.validationRule,row.issueCount,statusBadge(row.severity),formatTime(row.lastDetected),statusBadge(row.status),row.recommendedFix])) : "<p>No production validation issue records available.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>DEPENDENCY IMPACT REVIEW</h2><p>Modules and pages affected by source failure.</p></div></div>${(d.dependencies || []).length ? table(["Source","Affected Modules","Affected Pages","Business Impact","Risk Level","Fallback Available","Recommended Action"], d.dependencies.map(row => [row.source,row.affectedModules,row.affectedPages,row.businessImpact,statusBadge(row.riskLevel),row.fallbackAvailable === null || row.fallbackAvailable === undefined ? "UNKNOWN" : row.fallbackAvailable ? "YES" : "NO",row.recommendedAction])) : "<p>No production dependency impact records available.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>API USAGE AND RATE LIMIT REVIEW</h2><p>Provider quota usage from production rate-limit records.</p></div></div>${(d.rateLimits || []).length ? table(["Provider","Plan","API Calls Used","API Calls Remaining","Reset Time","Usage %","Rate Limit Status","Recommended Action"], d.rateLimits.map(row => [row.provider,row.plan,row.apiCallsUsed,row.apiCallsRemaining,formatTime(row.resetTime),percent(row.usagePct),statusBadge(row.status),row.recommendedAction])) : "<p>No production rate-limit records available.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>AUTHENTICATION AND CREDENTIAL HEALTH</h2><p>Credential status, rotation, encryption and access-scope risks.</p></div></div>${(d.security || []).length ? table(["Source","Authentication Type","Credential Status","Credential Expiry","Last Rotation","Encryption Status","Access Scope","Security Risk"], d.security.map(row => [row.source,row.authenticationType,statusBadge(row.credentialStatus),formatTime(row.credentialExpiry),formatTime(row.lastRotation),row.encryptionStatus,row.accessScope,row.securityRisk])) : "<p>No production credential health records available.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>AUDIT LOG</h2><p>Source health review actions and operational events.</p></div></div>${(d.audit || []).length ? table(["Timestamp","Action","Source","Severity","Actor","Status"], d.audit.map(row => [formatTime(row.timestamp),row.action,row.source,statusBadge(row.severity),row.actor,statusBadge(row.status)])) : "<p>No source health audit records available.</p>"}</article>
  </section>`;
}

function renderDependencyDrawer(row) {
  const details = [
    ["Dependency Profile", `${row.source} -> ${row.module}`],
    ["Source Details", row.source],
    ["Provider Details", `${row.provider || "Unknown"} / ${row.providerType || "Unknown"}`],
    ["Module Relationship", row.module],
    ["Service Relationship", row.apiService],
    ["Database Relationship", row.databaseTables],
    ["AI Relationship", row.aiEngine],
    ["Health Metrics", `${row.healthStatus} / ${percent(row.score)}`],
    ["Recent Sync Logs", formatTime(row.lastSync)],
    ["Recent Failures", row.failureImpact],
    ["Affected Pages", row.page],
    ["Failure Impact", row.businessImpact],
    ["Backup Availability", row.backupSource || "None recorded"],
    ["Recommended Actions", row.recommendedAction],
    ["Audit Trail", "Open audit section below"]
  ];
  return `<details class="dmx-drawer"><summary><span>${display(row.source)} -> ${display(row.module)}</span>${statusBadge(row.healthStatus)}</summary><div class="shr-drawer-grid">${details.map(([label,value]) => `<p><span>${esc(label)}</span><strong>${display(value)}</strong></p>`).join("")}</div><div class="live-actions"><a href="/workspace/data-sources-validation/source-configuration">Open Source Registry</a><a href="/workspace/market-intelligence/source-health-review">Open Health Review</a><button type="button" data-dependency-action="recalculate">Run Health Check</button><button type="button" data-dependency-action="recalculate">Recalculate Dependency</button><button type="button" data-dependency-action="export">Export Dependency</button><button type="button" data-dependency-action="create-alert">Create Alert</button></div></details>`;
}

function renderDependencyMatrixPage() {
  const d = data || {};
  if (["DATABASE_NOT_CONFIGURED", "SCHEMA_NOT_READY"].includes(d.status)) {
    return `<section class="live-page dmx-page"><header class="live-header"><div><small>MARKET INTELLIGENCE CENTER / DEPENDENCY MATRIX</small><h1>Dependency Matrix Center</h1><p>Map live data-source dependencies, service relationships, module impact, and operational risk across the Market Intelligence platform.</p></div><aside>${statusBadge(d.status)}<span>PRODUCTION LIVE</span><span>MOCK DATA DISABLED</span><span>LIVE DEPENDENCY GRAPH</span></aside></header><article class="live-card live-empty"><h2>${display(d.status)}</h2><p>${display(d.message)}</p></article></section>`;
  }
  if (d.status === "EMPTY") {
    return `<section class="live-page dmx-page"><header class="live-header"><div><small>MARKET INTELLIGENCE CENTER / DEPENDENCY MATRIX</small><h1>Dependency Matrix Center</h1><p>Map live data-source dependencies, service relationships, module impact, and operational risk across the Market Intelligence platform.</p></div><aside>${statusBadge("PRODUCTION LIVE")}<span>MOCK DATA DISABLED</span><span>LIVE DEPENDENCY GRAPH</span><span>CRITICAL DEPENDENCIES / 0</span></aside></header><article class="live-card live-empty"><h2>No dependency mappings found.</h2><p>Map your production data sources, services, database tables, and modules to enable dependency monitoring.</p><div class="live-actions"><button type="button" data-dependency-action="recalculate">Auto-Discover Dependencies</button><a href="/workspace/data-sources-validation/source-configuration">Add Dependency Mapping</a><a href="/workspace/data-sources-validation/source-configuration">Open Source Registry</a><a href="/workspace/market-intelligence/source-health-review">View Setup Guide</a></div></article></section>`;
  }
  const matrixRows = (d.matrix || []).map(row => [
    row.module,
    row.primarySource,
    row.backupSource,
    row.apiService,
    row.syncJob,
    row.databaseTables,
    row.aiEngine,
    statusBadge(row.healthStatus),
    row.dependencyLevel,
    row.failureImpact,
    formatTime(row.lastSync),
    row.recommendedAction
  ]);
  const graphNodes = (d.graph?.nodes || []).map(node => `<article class="${String(node.status || "").toLowerCase()}"><small>${display(node.type)}</small><strong>${display(node.label)}</strong>${statusBadge(node.status)}</article>`).join("");
  const graphEdges = (d.graph?.edges || []).map(edge => `<p><span>${display(edge.from)}</span><strong>${display(edge.dependencyLevel)} / ${display(edge.failureImpact)}</strong><span>${display(edge.to)}</span></p>`).join("");
  return `<section class="live-page dmx-page">
    <header class="live-header"><div><small>MARKET INTELLIGENCE CENTER / DEPENDENCY MATRIX</small><h1>Dependency Matrix Center</h1><p>Map live data-source dependencies, service relationships, module impact, and operational risk across the Market Intelligence platform.</p></div><aside>${statusBadge("PRODUCTION LIVE")}<span>MOCK DATA DISABLED</span><span>LIVE DEPENDENCY GRAPH</span><span>LAST RECALCULATED / ${formatTime(d.badges?.lastRecalculated)}</span><span>CRITICAL DEPENDENCIES / ${display(d.badges?.criticalDependencies)}</span></aside></header>
    <div class="live-actions"><button type="button" data-dependency-action="refresh">Refresh Matrix</button><button type="button" data-dependency-action="recalculate">Recalculate Dependencies</button><button type="button" data-dependency-action="export">Export Matrix</button><a href="/workspace/data-sources-validation/source-configuration">Open Source Registry</a><a href="/workspace/market-intelligence/source-health-review">Open Health Review</a></div>
    <section class="live-kpis shr-kpis">${(d.summary || []).map(([label,value,tone]) => `<article class="${esc(tone || "info")}"><small>${display(label)}</small><strong>${String(label).includes("Score") && typeof value === "number" ? percent(value) : display(value)}</strong></article>`).join("")}</section>
    <article class="live-card"><div class="live-title"><div><h2>MAIN DEPENDENCY MATRIX</h2><p>Only mapped production dependency records are shown.</p></div></div>${table(["Row","Primary Source","Backup Source","API Service","Sync Job","Database Tables","AI Engine","Health Status","Dependency Level","Failure Impact","Last Sync","Recommended Action"], matrixRows)}</article>
    <article class="live-card"><div class="live-title"><div><h2>VISUAL DEPENDENCY GRAPH</h2><p>Data Sources -> Sync Jobs -> Database Tables -> Services -> Modules -> Pages -> Alerts. Use browser zoom and scroll to inspect dense graphs.</p></div><div class="live-actions"><button type="button">Zoom</button><button type="button">Pan</button><button type="button">Highlight Critical Path</button></div></div><div class="dmx-graph"><section>${graphNodes || "<p>No production graph nodes available.</p>"}</section><section>${graphEdges || "<p>No production graph edges available.</p>"}</section></div></article>
    <article class="live-card"><div class="live-title"><div><h2>MODULE IMPACT REVIEW</h2><p>Modules impacted by required, optional, healthy, failed and missing dependencies.</p></div></div>${table(["Module","Required Sources","Optional Sources","Healthy Dependencies","Failed Dependencies","Missing Dependencies","Affected Pages","Business Impact","Risk Level"], (d.moduleImpact || []).map(row => [row.module,row.requiredSources,row.optionalSources,row.healthyDependencies,row.failedDependencies,row.missingDependencies,row.affectedPages,row.businessImpact,statusBadge(row.riskLevel)]))}</article>
    <article class="live-card"><div class="live-title"><div><h2>SOURCE TO MODULE MAPPING</h2><p>Actual database relationships between providers, sources, modules and pages.</p></div></div>${table(["Source","Provider","Used By Modules","Used By Pages","Dependency Type","Priority","Health","Last Sync","Failure Impact"], (d.sourceMapping || []).map(row => [row.source,row.provider,row.usedByModules,row.usedByPages,row.dependencyType,row.priority,statusBadge(row.health),formatTime(row.lastSync),row.failureImpact]))}</article>
    <article class="live-card"><div class="live-title"><div><h2>SERVICE DEPENDENCY REVIEW</h2><p>Production service registry rows only.</p></div></div>${(d.services || []).length ? table(["Service Name","Depends On","Consumed By","Health Status","Last Run","Queue Status","Failure Count","Risk Level"], d.services.map(row => [row.serviceName,row.dependsOn,row.consumedBy,statusBadge(row.healthStatus),formatTime(row.lastRun),row.queueStatus,row.failureCount,statusBadge(row.riskLevel)])) : "<p>No production service dependency records available.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>DATABASE TABLE DEPENDENCY REVIEW</h2><p>Production database table registry rows only.</p></div></div>${(d.database || []).length ? table(["Table Name","Used By Services","Used By Pages","Record Count","Last Updated","Data Freshness","Validation Status","Risk Level"], d.database.map(row => [row.tableName,row.usedByServices,row.usedByPages,row.recordCount,formatTime(row.lastUpdated),row.dataFreshness,statusBadge(row.validationStatus),statusBadge(row.riskLevel)])) : "<p>No production database table dependency records available.</p>"}</article>
    <article class="live-card dmx-simulator"><div class="live-title"><div><h2>FAILURE IMPACT SIMULATOR</h2><p>Simulation only. This does not disable providers, sources, services, tables or modules.</p></div></div><div class="live-actions"><input data-dependency-sim-target placeholder="Provider, source, service, table, or module"><button type="button" data-dependency-action="simulate-failure">Simulate Failure</button></div></article>
    <article class="live-card"><div class="live-title"><div><h2>DETAIL DRAWER</h2><p>Open mapped dependencies for source, provider, module, service, database, AI, health, sync and audit context.</p></div></div>${(d.matrix || []).map(renderDependencyDrawer).join("")}</article>
    <article class="live-card"><div class="live-title"><div><h2>RECOMMENDED ACTIONS</h2><p>Generated from production dependency and health records.</p></div></div>${(d.recommendations || []).length ? table(["Dependency","Source","Recommendation","Severity","Status","Created"], d.recommendations.map(row => [row.dependencyKey,row.sourceKey,row.recommendation,statusBadge(row.severity),statusBadge(row.status),formatTime(row.createdAt)])) : "<p>No dependency recommendations recorded yet. Run Recalculate Dependencies to generate current recommendations.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>AUDIT LOG</h2><p>Dependency matrix recalculation, simulation and alert actions.</p></div></div>${(d.audit || []).length ? table(["Timestamp","Action","Source","Actor","Status"], d.audit.map(row => [formatTime(row.created_at),row.action,row.source,row.actor,statusBadge(row.status)])) : "<p>No dependency matrix audit events recorded yet.</p>"}</article>
  </section>`;
}

function renderMarketEnvironmentPage() {
  const d = data || {};
  const header = `<header class="live-header"><div><small>MARKET INTELLIGENCE CENTER / MARKET ENVIRONMENT</small><h1>Market Environment Intelligence Center</h1><p>Analyze live market conditions, volatility regime, risk tone, liquidity behaviour, and trading environment across major instruments.</p></div><aside>${statusBadge(d.status || "PRODUCTION LIVE")}<span>PRODUCTION LIVE</span><span>MOCK DATA DISABLED</span><span>LIVE INPUTS ONLY</span><span>LAST CALCULATION / ${formatTime(d.badges?.lastCalculation)}</span><span>ENVIRONMENT SCORE / ${d.badges?.environmentScore === null || d.badges?.environmentScore === undefined ? "Unavailable" : percent(d.badges.environmentScore)}</span></aside></header>`;
  if (["DATABASE_NOT_CONFIGURED", "SCHEMA_NOT_READY"].includes(d.status)) {
    return `<section class="live-page menv-page">${header}<article class="live-card live-empty"><h2>${display(d.status)}</h2><p>${display(d.message)}</p></article></section>`;
  }
  if (d.status === "EMPTY") {
    return `<section class="live-page menv-page">${header}<article class="live-card live-empty"><h2>Market environment cannot be calculated yet.</h2><p>Connect market data, historical data, economic calendar, and sentiment sources to enable live environment classification.</p><div class="live-actions"><a href="/workspace/data-sources-validation/source-configuration">Open Source Registry</a><a href="/workspace/market-intelligence/dependency-matrix">Open Dependency Matrix</a><button type="button" data-market-env-action="recalculate">Configure Inputs</button><a href="/workspace/market-intelligence/source-health-review">Run Health Review</a></div></article></section>`;
  }
  const score = d.score || {};
  const inputRows = (d.inputs || []).map(row => [
    row.input,
    row.source,
    statusBadge(row.status),
    row.freshness || "Input unavailable. Market environment confidence reduced.",
    percent(row.health),
    row.weight,
    formatTime(row.lastUpdated),
    row.usedInScore ? row.usedIn || "Environment score" : "Input unavailable. Market environment confidence reduced."
  ]);
  const instrumentRows = (d.instruments || []).map(row => [
    row.instrument,
    row.assetClass,
    row.regime,
    percent(row.trendStrength),
    statusBadge(row.volatility),
    row.liquidity,
    row.spreadCondition,
    row.newsRisk,
    row.sessionBias,
    percent(row.environmentScore),
    row.tradingSuitability,
    percent(row.confidence),
    formatTime(row.lastUpdated)
  ]);
  const volatilityRows = (d.volatility || []).map(row => [
    row.instrument,
    display(row.atr),
    display(row.averageDailyRange),
    display(row.realizedVolatility),
    display(row.impliedVolatility),
    percent(row.volatilityRank),
    percent(row.volatilityPercentile),
    row.expansionSignal,
    statusBadge(row.status),
    formatTime(row.observedAt)
  ]);
  const risk = d.riskTone || {};
  const riskRows = [["Equity Indices", risk.equityBias], ["Gold", risk.goldBias], ["JPY", risk.jpyBias], ["CHF", risk.chfBias], ["USD", risk.usdBias], ["Oil", risk.oilBias], ["Crypto", risk.cryptoBias], ["Bond Yields", risk.bondYieldBias], ["News Sentiment", risk.newsSentiment], ["Economic Surprise", risk.economicSurprise]].map(([input,value]) => [input, value || "Input unavailable. Market environment confidence reduced."]);
  const sessionRows = (d.sessions || []).map(row => [row.sessionName,statusBadge(row.sessionVolatility),row.sessionDirection,row.sessionLiquidity,row.sessionSpreadBehaviour,row.breakoutRisk,row.reversalRisk,formatTime(row.observedAt)]);
  const eventRows = (d.events || []).map(row => [formatTime(row.createdAt),row.title,row.alertType,statusBadge(row.severity),row.payload?.affectedInstruments || "Input unavailable",row.payload?.riskWindow || "Input unavailable",row.payload?.recommendation || row.status]);
  const ai = d.aiSummary || {};
  return `<section class="live-page menv-page">
    ${header}
    <div class="live-actions"><button type="button" data-market-env-action="refresh">Refresh Environment</button><button type="button" data-market-env-action="recalculate">Recalculate Regime</button><a href="/workspace/data-sources-validation/source-configuration">Configure Inputs</a><button type="button" data-market-env-action="export">Export Report</button><button type="button" data-market-env-action="alerts">Create Alert</button></div>
    <section class="live-kpis shr-kpis menv-kpis">${(d.summary || []).map(([label,value,tone]) => `<article class="${esc(tone || "info")}"><small>${display(label)}</small><strong>${typeof value === "number" && !String(label).includes("Classified") && !String(label).includes("Used") ? percent(value) : display(value)}</strong></article>`).join("")}</section>
    <article class="live-card menv-score"><div class="live-title"><div><h2>ENVIRONMENT SCORE MODEL</h2><p>Trend, volatility, liquidity, spread, news risk, session, correlation and confidence scoring.</p></div>${statusBadge(score.tradingSuitability)}</div><div class="menv-score-grid">${[["Regime",score.regime],["Risk Tone",score.riskTone],["Volatility",score.volatilityRegime],["Liquidity",score.liquidityCondition],["Trend",percent(score.trendStrength)],["Range",percent(score.rangeProbability)],["Stress",score.marketStressLevel],["Confidence",percent(score.confidence)]].map(([label,value]) => `<p><span>${label}</span><strong>${display(value)}</strong></p>`).join("")}</div></article>
    <article class="live-card"><div class="live-title"><div><h2>INPUT DEPENDENCY PANEL</h2><p>Missing inputs reduce confidence instead of being replaced by fabricated rows.</p></div></div>${inputRows.length ? table(["Input","Source","Status","Freshness","Health","Weight","Last Updated","Used In Score"], inputRows) : "<p>Input unavailable. Market environment confidence reduced.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>INSTRUMENT ENVIRONMENT TABLE</h2><p>Classified from recorded production ticks and connected live input health.</p></div></div>${instrumentRows.length ? table(["Instrument","Asset Class","Regime","Trend Strength","Volatility","Liquidity","Spread Condition","News Risk","Session Bias","Environment Score","Trading Suitability","Confidence","Last Updated"], instrumentRows) : "<p>No production instrument ticks are available for classification.</p>"}</article>
    <div class="live-split"><article class="live-card"><div class="live-title"><div><h2>VOLATILITY REGIME PANEL</h2><p>ATR, range, realized volatility, rank, percentile and expansion signal.</p></div></div>${volatilityRows.length ? table(["Instrument","ATR","Average Daily Range","Realized Volatility","Implied Volatility","Volatility Rank","Volatility Percentile","Expansion Signal","Status","Observed"], volatilityRows) : "<p>No production volatility metrics are available.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>RISK-ON / RISK-OFF PANEL</h2><p>Risk tone from connected market, sentiment, economic and cross-asset inputs.</p></div>${statusBadge(risk.riskTone || score.riskTone)}</div>${table(["Input","Bias"], riskRows)}</article></div>
    <article class="live-card"><div class="live-title"><div><h2>SESSION ENVIRONMENT</h2><p>Sydney, Tokyo, London, New York and overlap conditions when live ticks are present.</p></div></div>${sessionRows.length ? table(["Session","Volatility","Direction","Liquidity","Spread Behaviour","Breakout Risk","Reversal Risk","Observed"], sessionRows) : "<p>No session environment metrics are available.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>NEWS / EVENT RISK PANEL</h2><p>Economic calendar, central-bank, geopolitical, sentiment and prop-firm event risk records.</p></div></div>${eventRows.length ? table(["Time","Event / News","Currency","Impact","Affected Instruments","Risk Window","Trading Recommendation"], eventRows) : "<p>No production news or event risk alerts recorded yet.</p>"}</article>
    <article class="live-card menv-ai"><div class="live-title"><div><h2>AI MARKET ENVIRONMENT SUMMARY</h2><p>Operational summary generated from persisted production metrics.</p></div><div class="live-actions"><button type="button" data-market-env-action="regenerate-summary">Regenerate Summary</button><button type="button" data-market-env-action="alerts">Save to Journal</button><button type="button" data-market-env-action="export">Export Brief</button><button type="button" data-market-env-action="alerts">Create Alert</button></div></div><p>${display(ai.summary)}</p><div class="shr-drawer-grid">${[["Best Instruments",ai.bestInstruments],["Worst Instruments",ai.worstInstruments],["Style Suitability",ai.tradingStyleSuitability],["News/Event Risk",ai.newsEventRisk],["Volatility Warning",ai.volatilityWarning],["Liquidity Warning",ai.liquidityWarning],["Prop Firm Caution",ai.propFirmCaution]].map(([label,value]) => `<p><span>${label}</span><strong>${display(value)}</strong></p>`).join("")}</div></article>
    <article class="live-card"><div class="live-title"><div><h2>AUDIT LOG</h2><p>Market environment recalculation, summary and alert actions.</p></div></div>${(d.audit || []).length ? table(["Timestamp","Action","Source","Actor","Status"], d.audit.map(row => [formatTime(row.created_at),row.action,row.source,row.actor,statusBadge(row.status)])) : "<p>No market environment audit events recorded yet.</p>"}</article>
  </section>`;
}

function renderValidatedPackagePage() {
  const d = data || {};
  const meta = d.metadata || {};
  if (d.status === "DATABASE_NOT_CONFIGURED" || d.status === "SCHEMA_NOT_READY" || d.status === "PACKAGE_NOT_AVAILABLE") {
    return `<section class="live-page vip-page"><header class="live-header"><div><small>MARKET INTELLIGENCE CENTER / CARD 2 / VALIDATED PACKAGE</small><h1>Validated Intelligence Package</h1><p>Official input package received from Data Sources Validation.</p></div><aside>${statusBadge(d.status)}<span>MODE / DATABASE ONLY</span><span>SOURCE / CARD 1</span><span>TARGET / CARD 2</span></aside></header><article class="live-card live-empty"><h2>${display(d.status)}</h2><p>${display(d.message)}</p><p>This page is read-only and only displays persisted Card 1 package records.</p></article></section>`;
  }
  const sources = d.sources || [];
  const admission = d.admission || {};
  const sourceCards = sources.map(source => `<article class="vip-source-card">
    <div><small>${source.required ? "REQUIRED" : "OPTIONAL"}</small>${statusBadge(source.validation)}</div>
    <h2>${display(source.sourceName)}</h2>
    <dl><div><dt>Status</dt><dd>${display(source.status)}</dd></div><div><dt>Health</dt><dd>${percent(source.health)}</dd></div><div><dt>Freshness</dt><dd>${display(source.freshness)}</dd></div><div><dt>Coverage</dt><dd>${display(source.coverage)}</dd></div><div><dt>Confidence</dt><dd>${percent(source.confidence)}</dd></div><div><dt>Records</dt><dd>${display(source.records)}</dd></div></dl>
  </article>`).join("");
  const sourceRows = sources.map(source => [
    source.sourceName,
    source.provider,
    statusBadge(source.status),
    percent(source.health),
    source.freshness,
    source.coverage,
    source.records,
    statusBadge(source.validation),
    formatTime(source.lastSyncAt),
    source.latencyMs === null || source.latencyMs === undefined ? "-" : `${source.latencyMs} ms`
  ]);
  const evidenceBlocks = (d.evidence || []).map(item => `<details class="vip-evidence"><summary><span>${display(item.title)}</span>${statusBadge(item.status)}</summary>${renderJsonPayload(item.payload)}</details>`).join("");
  const checks = (d.checks || []).length
    ? table(["Check", "Severity", "Status", "Policy"], d.checks.map(check => [check.name, check.severity, statusBadge(check.status), check.policy]))
    : "<p>No Card 1 validation checks are stored for this package.</p>";
  const payload = renderJsonPayload(d.payload);
  return `<section class="live-page vip-page">
    <header class="live-header"><div><small>MARKET INTELLIGENCE CENTER / CARD 2 / VALIDATED PACKAGE</small><h1>Validated Intelligence Package</h1><p>Official input package received from Data Sources Validation.</p></div><aside>${statusBadge(meta.packageStatus || d.status)}<span>PACKAGE / ${display(meta.packageId)}</span><span>WORKFLOW RUN / ${display(meta.workflowRunId)}</span><span>SOURCE / ${display(meta.sourceCard)}</span><span>TARGET / ${display(meta.targetCard)}</span></aside></header>
    <section class="vip-meta-grid">${[["Package ID", meta.packageId], ["Workflow Run ID", meta.workflowRunId], ["Source Card", meta.sourceCard], ["Target Card", meta.targetCard], ["Package Version", meta.version], ["Created Date", formatTime(meta.createdAt)], ["Created By", meta.createdBy], ["Validation Status", meta.validationStatus], ["Package Status", meta.packageStatus]].map(([label,value]) => `<article><small>${esc(label)}</small><strong>${display(value)}</strong></article>`).join("")}</section>
    <section class="live-kpis">${(d.summary || []).map(([label, value]) => `<article><small>${esc(label)}</small><strong>${summaryValue(label, value)}</strong></article>`).join("")}</section>
    <article class="live-card"><div class="live-title"><div><h2>PACKAGE CONTENT OVERVIEW</h2><p>Validated source evidence approved by Card 1 before Card 2 begins intelligence gathering.</p></div></div><div class="vip-source-grid">${sourceCards}</div></article>
    <article class="live-card"><div class="live-title"><div><h2>SOURCE DETAIL MATRIX</h2><p>Provider, freshness, coverage, validation and latency for every source in the package.</p></div></div>${table(["Source","Provider","Status","Health","Freshness","Coverage","Records","Validation","Last Sync","Latency"], sourceRows)}</article>
    <section class="live-split"><article class="live-card live-gate"><h2>ADMISSION DECISION</h2>${[["Required Sources", admission.requiredSources], ["Optional Sources", admission.optionalSources], ["Passed Sources", admission.passedSources], ["Failed Sources", admission.failedSources], ["Warnings", admission.warnings], ["Admission Status", admission.admissionStatus]].map(([label,value]) => `<p><span>${esc(label)}</span><strong>${display(value)}</strong></p>`).join("")}</article><article class="live-card"><h2>WORKFLOW LINEAGE</h2><div class="vip-lineage"><strong>Card 1</strong><span>Validated Intelligence Package</span><strong>Card 2</strong></div>${[["Created By", d.lineage?.createdBy], ["Created At", formatTime(d.lineage?.createdAt)], ["Version", d.lineage?.version], ["Source Run ID", d.lineage?.sourceRunId], ["Workflow Run ID", d.lineage?.workflowRunId]].map(([label,value]) => `<p class="vip-pair"><span>${esc(label)}</span><strong>${display(value)}</strong></p>`).join("")}</article></section>
    <article class="live-card"><div class="live-title"><div><h2>DEPENDENCY MATRIX</h2><p>How each approved source feeds Card 2 intelligence modules.</p></div></div>${table(["Source","Required By","Dependency Type","Status"], (d.dependencies || []).map(item => [item.source, item.requiredBy, item.dependencyType, statusBadge(item.status)]))}</article>
    <article class="live-card"><div class="live-title"><div><h2>RAW PACKAGE PAYLOAD</h2><p>Searchable browser text, expandable by section through source evidence below, and read-only.</p></div><div class="live-actions"><button type="button" data-card2-action="copy-vip-payload">Copy Payload</button><button type="button" data-card2-action="download-vip-json">Download JSON</button><button type="button" data-card2-action="export-vip-package">Export Package</button></div></div>${payload}</article>
    <article class="live-card" id="vip-source-evidence"><div class="live-title"><div><h2>SOURCE EVIDENCE VIEWER</h2><p>Runtime evidence collected by Card 1 for each package source.</p></div></div>${evidenceBlocks || "<p>No source evidence records are stored for this package.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>VALIDATION CHECKS</h2><p>Card 1 acceptance checks attached to this package.</p></div></div>${checks}</article>
    <article class="live-card"><div class="live-title"><div><h2>PACKAGE HISTORY</h2><p>Previous persisted package versions.</p></div></div>${table(["Version","Date","Status","Score","Created By","Actions"], (d.history || []).map(item => [item.version, formatTime(item.date), statusBadge(item.status), percent(item.score), item.createdBy, "View / Compare / Export"]))}</article>
    <article class="live-card"><div class="live-title"><div><h2>WORKFLOW CONTROLS</h2><p>Read-only package controls. Source modification and synchronization remain owned by Card 1.</p></div></div><div class="live-actions vip-controls"><button type="button" data-card2-action="refresh-vip-package">Refresh Package</button><button type="button" data-card2-action="validate-vip-integrity">Validate Package Integrity</button><button type="button" data-card2-action="view-vip-evidence">View Source Evidence</button><button type="button" data-card2-action="export-vip-package">Export JSON</button><button type="button" data-card2-action="print-vip-package">Export PDF</button><button type="button" data-card2-action="proceed-card-2">Proceed To Intelligence Gathering</button></div></article>
    <article class="live-card"><div class="live-title"><div><h2>AUDIT LOG</h2><p>Package creation, storage, review and approval audit trail.</p></div></div>${table(["Timestamp","Action","Source","Status"], (d.audit || []).map(item => [formatTime(item.timestamp), item.action, item.source, statusBadge(item.status)]))}</article>
  </section>`;
}

function renderSummaryCard(title, rows) {
  return `<article class="live-card mi2-summary"><h2>${title}</h2>${rows.map(([label, value]) => `<p><span>${esc(label)}</span><strong>${display(value)}</strong></p>`).join("")}</article>`;
}

function renderCard2Dashboard() {
  const d = data || {};
  const workflow = d.workflow || {};
  if (d.status === "DATABASE_NOT_CONFIGURED" || d.status === "SCHEMA_NOT_READY") {
    return `<section class="live-page mi2-page"><header class="live-header"><div><small>MARKET INTELLIGENCE CENTER / CARD 2</small><h1>Market Intelligence Center</h1><p>Transform validated market data into actionable market intelligence.</p></div><aside>${statusBadge(d.status)}<span>MODE / DATABASE ONLY</span><span>CARD / 02</span></aside></header><article class="live-card live-empty"><h2>${display(d.status)}</h2><p>${display(d.message)}</p><p>Run the Card 2 migration and create workflow/card records to populate this operational dashboard.</p></article></section>`;
  }
  const kpis = (d.kpis || []).map(([label, value]) => `<article><small>${esc(label)}</small><strong>${typeof value === "number" ? percent(value) : display(value)}</strong></article>`).join("");
  const sources = d.inputPackage?.sources || [];
  const pipelineRows = d.pipeline || [];
  const scores = d.scores || [];
  const output = d.outputPackage;
  const acceptance = d.acceptance || [];
  const auditEvents = d.auditEvents || [];
  return `<section class="live-page mi2-page">
    <header class="live-header"><div><small>CARD 2 / MARKET INTELLIGENCE GATHERING</small><h1>Market Intelligence Center</h1><p>Transform validated market data into actionable market intelligence.</p></div><aside>${statusBadge(workflow.currentState)}<span>WORKFLOW RUN / ${display(workflow.runId)}</span><span>CARD / ${display(workflow.cardNumber)} · ${display(workflow.cardName)}</span><span>INPUT / ${display(workflow.inputSource)}</span><span>OUTPUT / ${display(workflow.outputTarget)}</span></aside></header>
    <section class="live-kpis">${kpis}</section>
    <article class="live-card"><div class="live-title"><div><h2>VALIDATED INTELLIGENCE PACKAGE</h2><p>Card 1 output received by Card 2. Source configuration and validation remain owned by Data Sources Validation.</p></div><div class="live-actions"><button type="button" data-card2-action="view-package">View Package</button><a href="/workspace/data-sources-validation/dashboard">Open Source</a><button type="button" data-card2-action="refresh-validation">Refresh Validation</button></div></div>${table(["Source","Status","Freshness","Health","Coverage","Confidence"], sources.map(source => [source.source, statusBadge(source.status), display(source.freshness), percent(source.health), display(source.coverage), percent(source.confidence)]))}</article>
    <article class="live-card"><div class="live-title"><div><h2>INTELLIGENCE PIPELINE STATUS</h2><p>Card 2 transforms the validated package into the Market Intelligence Package consumed by Card 3.</p></div></div><div class="mi2-pipeline">${pipelineRows.map(stage => `<article><small>${display(stage.name)}</small>${statusBadge(stage.status)}<p><span>Progress</span><strong>${stage.progress === null || stage.progress === undefined ? "—" : percent(stage.progress)}</strong></p><p><span>Duration</span><strong>${display(stage.duration)}</strong></p><p><span>Confidence</span><strong>${percent(stage.confidence)}</strong></p></article>`).join("")}</div></article>
    <section class="mi2-summary-grid">
      ${renderSummaryCard("Market Environment Summary", [["Current Session", d.summaries?.marketEnvironment?.currentSession], ["Session Overlap", d.summaries?.marketEnvironment?.sessionOverlap], ["Volatility State", d.summaries?.marketEnvironment?.volatilityState], ["Trend State", d.summaries?.marketEnvironment?.trendState], ["Market Regime", d.summaries?.marketEnvironment?.marketRegime], ["Correlation State", d.summaries?.marketEnvironment?.correlationState], ["Risk Environment", d.summaries?.marketEnvironment?.riskEnvironment]])}
      ${renderSummaryCard("Macro Intelligence Summary", [["High Impact Events Today", d.summaries?.macro?.highImpactEventsToday], ["Upcoming Events", d.summaries?.macro?.upcomingEvents], ["Central Bank Events", d.summaries?.macro?.centralBankEvents], ["Interest Rate Context", d.summaries?.macro?.interestRateContext], ["Inflation Context", d.summaries?.macro?.inflationContext], ["Risk Level", d.summaries?.macro?.riskLevel]])}
      ${renderSummaryCard("Sentiment Intelligence Summary", [["News Sentiment", d.summaries?.sentiment?.newsSentiment], ["Social Sentiment", d.summaries?.sentiment?.socialSentiment], ["Risk-On / Risk-Off", d.summaries?.sentiment?.riskTone], ["Currency Sentiment Matrix", d.summaries?.sentiment?.currencyMatrix], ["Overall Market Mood", d.summaries?.sentiment?.overallMood]])}
      ${renderSummaryCard("Institutional Intelligence Summary", [["COT Bias", d.summaries?.institutional?.cotBias], ["Institutional Positioning", d.summaries?.institutional?.positioning], ["Smart Money Bias", d.summaries?.institutional?.smartMoneyBias], ["Large Speculator Activity", d.summaries?.institutional?.largeSpeculatorActivity], ["Institutional Direction", d.summaries?.institutional?.direction]])}
      ${renderSummaryCard("Broker & Liquidity Summary", [["Average Spread", d.summaries?.brokerLiquidity?.averageSpread], ["Execution Quality", d.summaries?.brokerLiquidity?.executionQuality], ["Liquidity Quality", d.summaries?.brokerLiquidity?.liquidityQuality], ["Broker Health", d.summaries?.brokerLiquidity?.brokerHealth], ["Market Access Readiness", d.summaries?.brokerLiquidity?.marketAccessReadiness]])}
      ${renderSummaryCard("Portfolio Intelligence Summary", [["Account Status", d.summaries?.portfolio?.accountStatus], ["Exposure Level", d.summaries?.portfolio?.exposureLevel], ["Margin Usage", d.summaries?.portfolio?.marginUsage], ["Risk Level", d.summaries?.portfolio?.riskLevel], ["Portfolio Readiness", d.summaries?.portfolio?.portfolioReadiness]])}
    </section>
    <article class="live-card"><div class="live-title"><div><h2>INTELLIGENCE SCORING CENTER</h2><p>Scores are read from market.intelligence_scores.</p></div></div><div class="mi2-score-grid">${scores.map(score => `<article><small>${display(score.label)}</small><strong>${percent(score.value)}</strong>${statusBadge(score.status)}</article>`).join("")}</div></article>
    <article class="live-card"><div class="live-title"><div><h2>MARKET INTELLIGENCE PACKAGE</h2><p>Generated Card 2 output package for handoff to Card 3.</p></div><div class="live-actions"><button type="button" data-card2-action="view-package">View Package</button><button type="button" data-card2-action="validate-package">Validate Package</button><button type="button" data-card2-action="export-package">Export Package</button><button type="button" data-card2-action="send-to-card-3">Send To Card 3</button></div></div><section class="live-kpis mi2-package-kpis">${[["Package ID", output?.packageId], ["Generated At", output?.generatedAt], ["Package Version", output?.version], ["Confidence", output?.confidence], ["Status", output?.status]].map(([label,value]) => `<article><small>${esc(label)}</small><strong>${label === "Confidence" ? percent(value) : display(value)}</strong></article>`).join("")}</section></article>
    <article class="live-card"><div class="live-title"><div><h2>WORKFLOW CONTROL CENTER</h2><p>Controls write Card 2 events, packages, outputs and handoff records when the database is ready.</p></div></div><div class="live-actions mi2-controls">${[["run-intelligence-gathering","Run Intelligence Gathering"],["validate-package","Validate Intelligence Package"],["generate-package","Generate Output Package"],["run-card-2-test","Run Card 2 Test"],["approve-card-2","Approve Card 2"],["reject-card-2","Reject Card 2"],["send-to-card-3","Send To Card 3"]].map(([action,label]) => `<button type="button" data-card2-action="${action}">${label}</button>`).join("")}</div></article>
    <article class="live-card"><div class="live-title"><div><h2>CARD 2 ACCEPTANCE MATRIX</h2><p>Acceptance rules determine whether Card 2 can produce and hand off the Market Intelligence Package.</p></div></div>${table(["Requirement","Status"], acceptance.map(item => [item.requirement, statusBadge(item.status)]))}</article>
    <article class="live-card"><div class="live-title"><div><h2>AUDIT & EVENTS</h2><p>Processing history read from market.intelligence_logs.</p></div></div>${auditEvents.length ? table(["Timestamp","Event","Source","Severity","Status"], auditEvents.map(item => [display(item.timestamp), item.event, item.source, item.severity, statusBadge(item.status)])) : "<p>No Card 2 audit events are stored yet.</p>"}</article>
  </section>`;
}

function render(slug, owner = "card-2") {
  const [title, subtitle] = labels[slug] || labels.dashboard;
  if (error) return `<section class="live-page"><article class="live-card"><h1>${title}</h1><p>${error}</p><button data-live-refresh>Retry Live Probe</button></article></section>`;
  if (!data) return `<section class="live-page"><article class="live-card"><h1>${title}</h1><p>Probing configured live adapters...</p></article></section>`;
  if (owner === "card-2") return renderCard2(slug);
  const sourceSlug = card1SlugAliases[slug] || slug;
  if (sourceSlug === "data-sources") return renderDataSourcesValidation();
  if (sourceSlug === "logs" || sourceSlug === "test-harness") return renderCard1Utility(sourceSlug);
  const source = data.sources.find(item => item.routeSlug === sourceSlug);
  const sources = sourceSlug === "dashboard" || sourceSlug === "data-sources" || sourceSlug === "data-quality-gate" ? data.sources : source ? [source] : [];
  return `<section class="live-page">
    <header class="live-header"><div><small>DATA SOURCES VALIDATION / CARD 1 / LIVE ADAPTERS</small><h1>${title}</h1><p>${subtitle}</p></div><aside>${badge(data.gate.workflowPermission)}<span>MODE / LIVE ADAPTERS ONLY</span><span>LAST PROBE / ${new Date(data.probedAt).toLocaleString()}</span></aside></header>
    <div class="live-actions"><button data-live-refresh>Refresh Live Probe</button><a href="/workspace/data-sources-validation/source-configuration">Configure Sources</a><a href="/workspace/data-sources-validation/test-harness">Run Card 1 Completion Test</a><a href="/workspace/data-sources-validation/institutional-cot">Open Official CFTC COT</a></div>
    <section class="live-kpis">${[["Card 1 Permission",data.gate.workflowPermission],["Required Sources",`${data.gate.requiredHealthyCount} / ${data.gate.requiredSourceCount}`],["Optional Sources",`${data.gate.optionalHealthyCount} / ${data.gate.optionalSourceCount}`],["Quality Score",`${data.gate.dataQualityScore}%`],["Live Adapters",data.summary.live],["Not Configured",data.summary.notConfigured],["Unavailable",data.summary.unavailable],["Fabricated Rows","0"]].map(([a,b])=>`<article><small>${a}</small><strong>${b}</strong></article>`).join("")}</section>
    <article class="live-card"><div class="live-title"><div><h2>LIVE SOURCE READINESS</h2><p>No sample records are rendered. Each row reflects a configured runtime adapter or an honest unavailable state.</p></div></div>${table(["Source","Provider","Requirement","Status","Freshness","Records","Adapter","Configuration"],sources.map(item=>[item.name,item.provider,item.required?"REQUIRED":"OPTIONAL",badge(item.status),item.freshness,item.records,item.adapter,item.configuration]))}</article>
    ${source && !["ONLINE","LIVE","SYNCED"].includes(source.status) ? `<article class="live-card live-empty"><h2>${source.status === "NOT_CONFIGURED" ? "No live adapter is configured." : "The configured adapter is unavailable."}</h2><p>${source.configuration}</p><p>The previous illustrative dataset has been removed. Configure or repair a supported connector and refresh the probe to populate this page.</p><div class="live-actions"><a href="/workspace/market-intelligence/source-configuration">Open Source Configuration</a></div></article>` : ""}
    ${sourceSlug === "data-quality-gate" ? `<article class="live-card"><h2>LIVE GATE WARNINGS</h2>${data.gate.rejectReasons.concat(data.gate.warnings).map(x=>`<p>${x}</p>`).join("") || "<p>No active warnings.</p>"}</article>` : ""}
  </section>`;
}

export function renderLiveMarketIntelligencePage(slug, { owner = "card-2" } = {}) {
  stopAutoRefresh();
  queueMicrotask(() => load(slug, { owner }));
  return render(slug, owner);
}

async function load(slug, { silent = false, owner = "card-2" } = {}) {
  if (!silent) setLiveButtonsBusy(true, "Refreshing...");
  try {
    const endpoint = owner === "card-2" && slug === "dashboard"
      ? "/api/market-intelligence/card-2/dashboard"
      : owner === "card-2" && slug === "validated-package"
        ? "/api/market-intelligence/card-2/validated-package"
        : owner === "card-2" && slug === "source-health-review"
          ? "/api/market-intelligence/source-health-review"
          : owner === "card-2" && slug === "dependency-matrix"
            ? "/api/market-intelligence/dependency-matrix"
            : owner === "card-2" && slug === "market-environment"
              ? "/api/market-intelligence/market-environment"
        : "/api/market-intelligence/live/dashboard";
    const response = await fetch(`${API}${endpoint}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Live adapter probe failed (${response.status})`);
    const rawPayload = await response.json();
    const payload = owner === "card-2" && ["dashboard", "validated-package", "source-health-review", "dependency-matrix", "market-environment"].includes(slug) ? rawPayload : parseLiveDashboardPayload(rawPayload);
    if (!payload) throw new Error("Live dashboard response was invalid");
    data = payload;
    error = "";
    startAutoRefresh(slug, owner);
    if (!silent) showLiveStatus(`Dashboard updated at ${formatTime(data.probedAt)}`);
  } catch (reason) {
    error = reason.message;
    if (!silent) showLiveStatus(reason.message, "bad");
  } finally {
    setLiveButtonsBusy(false);
  }
  if (isCurrentSlug(slug)) {
    document.querySelector("#intelligence-content").innerHTML = render(slug, owner);
    bindLiveMarketIntelligencePage(slug, { owner });
  }
}

export function bindLiveMarketIntelligencePage(slug, { owner = "card-2" } = {}) {
  document.querySelectorAll("[data-market-env-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      runMarketEnvironmentAction(button.dataset.marketEnvAction, slug);
    });
  });
  document.querySelectorAll("[data-dependency-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      runDependencyAction(button.dataset.dependencyAction, slug);
    });
  });
  document.querySelectorAll("[data-source-health-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      runSourceHealthAction(button.dataset.sourceHealthAction, slug);
    });
  });
  document.querySelectorAll("[data-card2-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      runCard2Action(button.dataset.card2Action, slug);
    });
  });
  document.querySelectorAll("[data-live-refresh]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      load(slug, { owner });
    });
  });
  document.querySelectorAll("[data-live-test]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      runLiveValidation(slug, { owner });
    });
  });
}

async function runLiveValidation(slug, { owner = "card-2" } = {}) {
  setLiveButtonsBusy(true, "Validating...");
  try {
    const response = await fetch(`${API}/api/market-intelligence/data-sources/test`, { method: "POST" });
    if (!response.ok) throw new Error(`Live validation failed (${response.status})`);
    const payload = parseLiveDashboardPayload(await response.json());
    if (!payload) throw new Error("Live validation response was invalid");
    data = payload;
    error = "";
    startAutoRefresh(slug, owner);
    const marketData = data.sources?.find((source) => source.id === "market-data");
    showLiveStatus(
      marketData
        ? `Validation complete — ${marketData.name}: ${marketData.status}`
        : `Validation complete at ${formatTime(data.probedAt)}`
    );
  } catch (reason) {
    error = reason.message;
    showLiveStatus(reason.message, "bad");
  } finally {
    setLiveButtonsBusy(false);
  }
  if (isCurrentSlug(slug)) {
    document.querySelector("#intelligence-content").innerHTML = render(slug, owner);
    bindLiveMarketIntelligencePage(slug, { owner });
  }
}

async function runCard2Action(action, slug) {
  if (slug === "validated-package") return runValidatedPackageAction(action, slug);
  if (action === "export-package") {
    const payload = JSON.stringify(data?.outputPackage || {}, null, 2);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    anchor.download = `${data?.outputPackage?.packageId || "market-intelligence-package"}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    return showLiveStatus("Market Intelligence Package export prepared");
  }
  setLiveButtonsBusy(true, "Working...");
  try {
    const response = await fetch(`${API}/api/market-intelligence/card-2/${action}`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Card 2 action failed (${response.status})`);
    showLiveStatus(`${action}: recorded`);
    await load(slug, { owner: "card-2" });
  } catch (reason) {
    showLiveStatus(reason.message, "bad");
  } finally {
    setLiveButtonsBusy(false);
  }
}

async function runSourceHealthAction(action, slug) {
  if (action === "refresh") return load(slug, { owner: "card-2" });
  if (action === "export") {
    const payload = JSON.stringify(data || {}, null, 2);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    anchor.download = `source-health-review-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    return showLiveStatus("Source health report export prepared");
  }
  setLiveButtonsBusy(true, "Working...");
  try {
    const endpoint = action === "sync-failed" ? "sync-failed" : "run-check";
    const response = await fetch(`${API}/api/market-intelligence/source-health-review/${endpoint}`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Source health action failed (${response.status})`);
    showLiveStatus(`${endpoint}: recorded`);
    await load(slug, { owner: "card-2" });
  } catch (reason) {
    showLiveStatus(reason.message, "bad");
  } finally {
    setLiveButtonsBusy(false);
  }
}

async function runDependencyAction(action, slug) {
  if (action === "refresh") return load(slug, { owner: "card-2" });
  if (action === "export") {
    const payload = JSON.stringify(data || {}, null, 2);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    anchor.download = `dependency-matrix-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    return showLiveStatus("Dependency matrix export prepared");
  }
  const body = action === "simulate-failure"
    ? { target: document.querySelector("[data-dependency-sim-target]")?.value || "" }
    : {};
  setLiveButtonsBusy(true, "Working...");
  try {
    const response = await fetch(`${API}/api/market-intelligence/dependency-matrix/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Dependency matrix action failed (${response.status})`);
    showLiveStatus(`${action}: recorded`);
    await load(slug, { owner: "card-2" });
  } catch (reason) {
    showLiveStatus(reason.message, "bad");
  } finally {
    setLiveButtonsBusy(false);
  }
}

async function runMarketEnvironmentAction(action, slug) {
  if (action === "refresh") return load(slug, { owner: "card-2" });
  if (action === "export") {
    const payload = JSON.stringify(data || {}, null, 2);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    anchor.download = `market-environment-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    return showLiveStatus("Market environment report export prepared");
  }
  const body = action === "alerts"
    ? { title: "Market environment operator alert", severity: "info", alertType: "operator_alert" }
    : {};
  const endpoint = action === "alerts" ? "alerts" : action;
  setLiveButtonsBusy(true, "Working...");
  try {
    const response = await fetch(`${API}/api/market-intelligence/market-environment/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `Market environment action failed (${response.status})`);
    showLiveStatus(`${endpoint}: recorded`);
    await load(slug, { owner: "card-2" });
  } catch (reason) {
    showLiveStatus(reason.message, "bad");
  } finally {
    setLiveButtonsBusy(false);
  }
}

async function runValidatedPackageAction(action, slug) {
  if (action === "refresh-vip-package") return load(slug, { owner: "card-2" });
  if (action === "view-vip-evidence") {
    document.querySelector("#vip-source-evidence")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return showLiveStatus("Source evidence opened");
  }
  if (action === "validate-vip-integrity") {
    const ok = data?.metadata?.validationStatus === "PASSED" && data?.metadata?.packageStatus === "READY";
    return showLiveStatus(ok ? "Package integrity passed" : "Package integrity requires review", ok ? "ok" : "warn");
  }
  if (action === "proceed-card-2") {
    location.href = "/workspace/market-intelligence/dashboard";
    return;
  }
  if (action === "print-vip-package") {
    window.print();
    return showLiveStatus("Print view opened");
  }
  if (action === "copy-vip-payload") {
    await navigator.clipboard.writeText(JSON.stringify(data?.payload || {}, null, 2));
    return showLiveStatus("Validated package payload copied");
  }
  if (action === "download-vip-json" || action === "export-vip-package") {
    const payload = JSON.stringify(data?.payload || {}, null, 2);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    anchor.download = `${data?.metadata?.packageId || "validated-intelligence-package"}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    return showLiveStatus("Validated package export prepared");
  }
  return showLiveStatus(`${action}: read-only page`, "warn");
}
