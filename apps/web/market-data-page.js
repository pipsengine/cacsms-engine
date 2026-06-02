const API = "http://localhost:8080";
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const table = (headers, rows) => `<div class="mdoc-table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

export function renderMarketDataOperationsCenter(data) {
  return `<section class="mdoc-dashboard">
    <header class="mdoc-header"><div><p class="eyebrow">MARKET INTELLIGENCE / MARKET DATA OPERATIONS</p><h1>Market Data Providers</h1><p class="subtitle">Manage, validate and monitor all market data providers powering CACSMS Engine.</p><div class="mdoc-badges">${[["Connected Providers", data.header.connectedProviders], ["Healthy Providers", data.header.healthyProviders], ["Live Symbols", data.header.liveSymbols], ["Workflow Status", data.header.workflowStatus], ["Data Confidence", data.header.dataConfidence]].map(([label, value]) => `<span><small>${label}</small><strong>${esc(value)}</strong></span>`).join("")}</div></div><div class="mdoc-header-actions"><button class="mdoc-button secondary" data-action="add-provider">Add Provider</button><button class="mdoc-button primary" data-action="test-all">Test Providers</button><button class="mdoc-button secondary" data-action="sync">Sync Symbols</button><button class="mdoc-button secondary" data-action="export">Export Status</button></div></header>
    <section class="mdoc-banner">${Object.entries(data.banner).map(([label, value]) => `<article><small>${label.replace(/([A-Z])/g, " $1").trim()}</small><strong>${esc(value)}</strong></article>`).join("")}</section>
    <section class="mdoc-kpi-grid">${data.kpis.map(([label, value]) => `<article class="mdoc-kpi"><small>${esc(label)}</small><strong>${esc(value)}</strong></article>`).join("")}</section>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Provider Registry</h2><b>${data.providers.length} PROVIDERS</b></div>${table(["Provider","Type","Status","Health","Freshness","Latency","Tick Rate","Coverage","Last Sync","Workflow Impact","Actions"], data.providers.map((row) => [esc(row.name), esc(row.type), `<b class="mdoc-state ${esc(String(row.status).toLowerCase())}">${esc(row.status)}</b>`, esc(row.health), esc(row.freshness || "—"), row.latencyMs != null ? `${row.latencyMs} ms` : "—", esc(row.tickRate || 0), esc(row.coverage), row.lastSync ? esc(new Date(row.lastSync).toLocaleString()) : "—", esc(row.workflowImpact), `<span class="mdoc-actions"><button data-action="test" data-id="${esc(row.id)}">Test</button></span>`]))}</section>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Live Feed Monitor</h2><b>1s REFRESH</b></div>${table(["Symbol","Bid","Ask","Spread","Last Tick","Provider","Status"], data.liveFeed.map((row) => [esc(row.symbol), row.bid ?? "—", row.ask ?? "—", row.spread ?? "—", row.lastTick ? esc(new Date(row.lastTick).toLocaleTimeString()) : "—", esc(row.provider), esc(row.status)]))}</section>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Asset Coverage Matrix</h2><b>20 ASSETS</b></div>${table(["Symbol","Price Feed","Tick Feed","Spread Feed","Volume Feed","Provider","Coverage","Status"], data.coverage.map((row) => [esc(row.symbol), row.priceFeed ? "Available" : "Unavailable", row.tickFeed ? "Available" : "Unavailable", row.spreadFeed ? "Available" : "Unavailable", row.volumeFeed ? "Available" : "Unavailable", esc(row.provider), `${esc(row.coverage)}%`, esc(row.status)]))}</section>
    <div class="mdoc-grid-2"><section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Tick Quality Monitor</h2><b>${esc(data.tickQuality.tickStability)}</b></div><div class="mdoc-metrics"><span>Tick Frequency<strong>${esc(data.tickQuality.tickFrequency)}</strong></span><span>Missing Ticks<strong>${esc(data.tickQuality.missingTicks)}</strong></span></div><div class="mdoc-bars">${(data.tickQuality.ticksPerMinute || []).map((height) => `<i style="height:${height}%"></i>`).join("")}</div></section><section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Spread Quality Center</h2><b>EXECUTION IMPACT</b></div>${table(["Symbol","Current Spread","Average Spread","Quality","Risk Impact"], data.spreadQuality.map((row) => [esc(row.symbol), esc(row.currentSpread), esc(row.averageSpread), esc(row.quality), esc(row.riskImpact)]))}</section></div>
    <div class="mdoc-grid-2"><section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Latency Monitor</h2><b>${data.latencyMonitor.averageLatencyMs != null ? `${data.latencyMonitor.averageLatencyMs}ms AVG` : "NO PROBE"}</b></div><div class="mdoc-bars">${(data.latencyMonitor.trend || []).map((height) => `<i style="height:${Math.max(height, 4)}%"></i>`).join("")}</div></section><section class="mdoc-panel mdoc-integrity"><div class="mdoc-panel-head"><h2>Data Integrity Engine</h2><b>${data.integrity.score}%</b></div><strong class="mdoc-score">${data.integrity.score}</strong></section></div>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Provider Comparison Center</h2><b>BEST PROVIDER SELECTION</b></div>${table(["Provider","Latency","Spread","Coverage","Quality","Availability"], data.comparison.map((row) => [esc(row.provider), row.latencyMs != null ? `${row.latencyMs} ms` : "—", esc(row.spread), esc(row.coverage), esc(row.quality), esc(row.availability)]))}</section>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Workflow Impact Panel</h2><b>STOP WORKFLOW ON FAILURE</b></div><div class="mdoc-workflow">${data.workflowImpacts.map((item) => `<article><strong>Market Data</strong><span>${esc(item.target)}</span><small>${esc(item.impact)}</small></article>`).join("")}</div></section>
    <section class="mdoc-panel" id="mdoc-logs"><div class="mdoc-panel-head"><h2>Market Data Logs</h2><b>${data.logs.length} EVENTS</b></div>${table(["Timestamp","Provider","Event","Severity","Message"], data.logs.map((log) => [esc(new Date(log.timestamp).toLocaleString()), esc(log.provider), esc(log.event), esc(String(log.severity).toUpperCase()), esc(log.message)]))}</section>
    <section class="mdoc-panel mdoc-action-center"><div class="mdoc-panel-head"><h2>Action Center</h2><b>DESK CONTROLS</b></div><div class="mdoc-action-grid">${["Add Provider","Test Provider","Test All","Sync Symbols","Refresh Feeds","Export Status","Open Logs"].map((label) => `<button class="mdoc-button secondary" data-action="${label.toLowerCase().replaceAll(" ", "-")}">${label}</button>`).join("")}</div></section>
  </section>`;
}

async function loadDashboard() {
  const response = await fetch(`${API}/api/market-data/providers`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Market data request failed (${response.status})`);
  return response.json();
}

async function post(path, body = {}) {
  const response = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Market data action failed (${response.status})`);
  return response.json();
}

export function bindMarketDataOperationsCenter() {
  const root = document.querySelector("#intelligence-content");
  const refresh = async () => {
    root.innerHTML = renderMarketDataOperationsCenter(await loadDashboard());
    bindMarketDataOperationsCenter();
  };
  root.querySelector('[data-action="test-all"]')?.addEventListener("click", () => post("/api/market-data/providers/test-all").then(refresh));
  root.querySelector('[data-action="sync"]')?.addEventListener("click", () => post("/api/market-data/providers/sync").then(refresh));
  root.querySelectorAll('[data-action="test"]').forEach((button) => button.addEventListener("click", () => post("/api/market-data/providers/test", { providerId: button.dataset.id }).then(refresh)));
  root.querySelector('[data-action="export"]')?.addEventListener("click", async () => {
    const payload = await loadDashboard();
    const blob = new Blob([JSON.stringify(payload.output ?? payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "market-data-status.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });
  root.querySelector('[data-action="open-logs"]')?.addEventListener("click", () => document.querySelector("#mdoc-logs")?.scrollIntoView({ behavior: "smooth" }));
}

export async function mountMarketDataOperationsCenter() {
  const root = document.querySelector("#intelligence-content");
  try {
    root.innerHTML = renderMarketDataOperationsCenter(await loadDashboard());
    bindMarketDataOperationsCenter();
  } catch (reason) {
    root.innerHTML = `<section class="mdoc-dashboard mdoc-panel"><h1>Market Data Providers</h1><p>${esc(reason.message)}</p><button class="mdoc-button primary" id="mdoc-retry">Retry</button></section>`;
    document.querySelector("#mdoc-retry")?.addEventListener("click", mountMarketDataOperationsCenter);
  }
}
