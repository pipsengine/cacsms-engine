const API = "http://localhost:8080";
const labels = {
  dashboard: ["Market Intelligence Gathering Dashboard", "Card 2 intelligence packaging readiness after source validation."],
  "data-sources": ["Data Sources & Feed Health", "Live adapter status, freshness and configuration readiness."],
  "market-data": ["Market Data Providers", "Live pricing feed connectors for ticks, OHLCV, depth and spread data."],
  "news-sentiment": ["News & Sentiment Sources", "Live configured headline and sentiment providers."],
  "economic-calendar": ["Economic Calendar", "Live configured economic-event ingestion and freshness."],
  "social-sentiment": ["Social & Community Sentiment", "Optional live community sentiment connectors."],
  "historical-data": ["Historical Data", "Live OHLCV archive connectors and imported datasets."],
  "broker-data": ["Broker Data", "Live broker bridges, pricing feeds and execution telemetry."],
  "account-portfolio": ["Account Portfolio", "Live connected account balances, equity, positions and risk state."],
  "prop-firm-rules": ["Prop Firm Rules", "Live imported rule catalogs and connected account compliance state."],
  "data-quality-gate": ["Data Quality Gate", "Source-honest Card 1 workflow admission control using live adapter status only."]
};
const badge = value => `<b class="live-badge ${["ONLINE","LIVE","SYNCED","PASSED","ALLOWED"].includes(value) ? "ok" : value === "OPTIONAL" ? "warn" : "bad"}">${value}</b>`;
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
  return (parts[0] === "workspace" ? parts[2] : parts[1] || "dashboard") === slug;
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
  document.querySelectorAll("[data-live-test], [data-live-refresh]").forEach((button) => {
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

function startAutoRefresh(slug) {
  stopAutoRefresh();
  activeSlug = slug;
  if (!["data-sources", "dashboard", "data-quality-gate"].includes(slug)) return;
  refreshTimer = setInterval(() => {
    if (document.hidden) return;
    load(slug, { silent: true });
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
    <div class="live-actions"><button type="button" data-live-test>Run Validation Now</button><button type="button" data-live-refresh>Refresh Now</button><a href="/executive-command-center/workflow-dashboard">Open Card 1 Test Harness</a><a href="/workspace/market-intelligence/institutional-cot">Open Official CFTC COT</a></div>
    <section class="live-kpis">${[["Card 1 Permission",gate.workflowPermission],["Validation Status",gate.validationStatus],["Required Healthy",`${gate.requiredHealthyCount} / ${gate.requiredSourceCount}`],["Optional Healthy",`${gate.optionalHealthyCount} / ${gate.optionalSourceCount}`],["Quality Score",`${gate.dataQualityScore}%`],["Live Adapters",data.summary.live],["Unavailable",data.summary.unavailable],["Fabricated Rows","0"]].map(([a,b])=>`<article><small>${a}</small><strong>${b}</strong></article>`).join("")}</section>
    <article class="live-card"><div class="live-title"><div><h2>LIVE SOURCE VALIDATION GRID</h2><p>Every card is derived from a live HTTP probe, validated official archive, or an explicit unconfigured state.</p></div></div><div class="live-source-grid">${sourceCards}</div></article>
    <article class="live-card"><div class="live-title"><div><h2>VALIDATION EVIDENCE MATRIX</h2><p>HTTP status and latency appear when a configured remote connector is probed.</p></div></div>${table(["Source","Provider","Requirement","Status","HTTP","Latency","Freshness","Records","Adapter","Failure Action"],evidence)}</article>
    <div class="live-split"><article class="live-card live-gate"><div class="live-title"><div><h2>CARD 1 WORKFLOW ADMISSION</h2><p>Card 2 stays locked until required source validation passes.</p></div>${badge(gate.workflowPermission)}</div><p><strong>${gate.validationStatus}</strong> / ${gate.dataQualityScore}% source quality.</p>${gate.rejectReasons.concat(gate.warnings).map(item=>`<p>${item}</p>`).join("")||"<p>All required live source checks passed.</p>"}</article>
    <article class="live-card"><div class="live-title"><div><h2>LIVE PROBE AUDIT LOG</h2><p>Recent manual validation evidence retained in this API process.</p></div></div>${logs}</article></div>
  </section>`;
}

function render(slug) {
  const [title, subtitle] = labels[slug] || labels.dashboard;
  if (error) return `<section class="live-page"><article class="live-card"><h1>${title}</h1><p>${error}</p><button data-live-refresh>Retry Live Probe</button></article></section>`;
  if (!data) return `<section class="live-page"><article class="live-card"><h1>${title}</h1><p>Probing configured live adapters...</p></article></section>`;
  if (slug === "data-sources") return renderDataSourcesValidation();
  const source = data.sources.find(item => item.routeSlug === slug);
  const sources = slug === "dashboard" || slug === "data-sources" || slug === "data-quality-gate" ? data.sources : source ? [source] : [];
  return `<section class="live-page">
    <header class="live-header"><div><small>${slug === "dashboard" ? "MARKET INTELLIGENCE CENTER / CARD 2" : "DATA SOURCES VALIDATION / CARD 1"} / LIVE ADAPTERS</small><h1>${title}</h1><p>${subtitle}</p></div><aside>${badge(data.gate.workflowPermission)}<span>MODE / LIVE ADAPTERS ONLY</span><span>LAST PROBE / ${new Date(data.probedAt).toLocaleString()}</span></aside></header>
    <div class="live-actions"><button data-live-refresh>Refresh Live Probe</button><a href="/workspace/market-intelligence/source-configuration">Configure Sources</a><a href="/executive-command-center/workflow-dashboard">Run Card 1 Completion Test</a><a href="/workspace/market-intelligence/institutional-cot">Open Official CFTC COT</a></div>
    <section class="live-kpis">${[["Card 1 Permission",data.gate.workflowPermission],["Required Sources",`${data.gate.requiredHealthyCount} / ${data.gate.requiredSourceCount}`],["Optional Sources",`${data.gate.optionalHealthyCount} / ${data.gate.optionalSourceCount}`],["Quality Score",`${data.gate.dataQualityScore}%`],["Live Adapters",data.summary.live],["Not Configured",data.summary.notConfigured],["Unavailable",data.summary.unavailable],["Fabricated Rows","0"]].map(([a,b])=>`<article><small>${a}</small><strong>${b}</strong></article>`).join("")}</section>
    <article class="live-card"><div class="live-title"><div><h2>LIVE SOURCE READINESS</h2><p>No sample records are rendered. Each row reflects a configured runtime adapter or an honest unavailable state.</p></div></div>${table(["Source","Provider","Requirement","Status","Freshness","Records","Adapter","Configuration"],sources.map(item=>[item.name,item.provider,item.required?"REQUIRED":"OPTIONAL",badge(item.status),item.freshness,item.records,item.adapter,item.configuration]))}</article>
    ${source && !["ONLINE","LIVE","SYNCED"].includes(source.status) ? `<article class="live-card live-empty"><h2>${source.status === "NOT_CONFIGURED" ? "No live adapter is configured." : "The configured adapter is unavailable."}</h2><p>${source.configuration}</p><p>The previous illustrative dataset has been removed. Configure or repair a supported connector and refresh the probe to populate this page.</p><div class="live-actions"><a href="/workspace/market-intelligence/source-configuration">Open Source Configuration</a></div></article>` : ""}
    ${slug === "data-quality-gate" ? `<article class="live-card"><h2>LIVE GATE WARNINGS</h2>${data.gate.rejectReasons.concat(data.gate.warnings).map(x=>`<p>${x}</p>`).join("") || "<p>No active warnings.</p>"}</article>` : ""}
  </section>`;
}

export function renderLiveMarketIntelligencePage(slug) {
  stopAutoRefresh();
  queueMicrotask(() => load(slug));
  return render(slug);
}

async function load(slug, { silent = false } = {}) {
  if (!silent) setLiveButtonsBusy(true, "Refreshing...");
  try {
    const response = await fetch(`${API}/api/market-intelligence/live/dashboard`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Live adapter probe failed (${response.status})`);
    const payload = parseLiveDashboardPayload(await response.json());
    if (!payload) throw new Error("Live dashboard response was invalid");
    data = payload;
    error = "";
    startAutoRefresh(slug);
    if (!silent) showLiveStatus(`Dashboard updated at ${formatTime(data.probedAt)}`);
  } catch (reason) {
    error = reason.message;
    if (!silent) showLiveStatus(reason.message, "bad");
  } finally {
    setLiveButtonsBusy(false);
  }
  if (isCurrentSlug(slug)) {
    document.querySelector("#intelligence-content").innerHTML = render(slug);
    bindLiveMarketIntelligencePage(slug);
  }
}

export function bindLiveMarketIntelligencePage(slug) {
  document.querySelectorAll("[data-live-refresh]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      load(slug);
    });
  });
  document.querySelectorAll("[data-live-test]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      runLiveValidation(slug);
    });
  });
}

async function runLiveValidation(slug) {
  setLiveButtonsBusy(true, "Validating...");
  try {
    const response = await fetch(`${API}/api/market-intelligence/data-sources/test`, { method: "POST" });
    if (!response.ok) throw new Error(`Live validation failed (${response.status})`);
    const payload = parseLiveDashboardPayload(await response.json());
    if (!payload) throw new Error("Live validation response was invalid");
    data = payload;
    error = "";
    startAutoRefresh(slug);
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
    document.querySelector("#intelligence-content").innerHTML = render(slug);
    bindLiveMarketIntelligencePage(slug);
  }
}
