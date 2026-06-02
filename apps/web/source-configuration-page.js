const API = "http://localhost:8080";
const AUTO_REFRESH_MS = 30000;
let sourceConfigRefreshTimer = null;

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function healthClass(health) {
  if (health === "HEALTHY") return "success";
  if (health === "FAILED") return "danger";
  if (health === "WARNING" || health === "STALE") return "warning";
  return "neutral";
}

function resultClass(result) {
  if (result === "PASS") return "success";
  if (result === "WARNING") return "warning";
  return "danger";
}

function table(headers, rows) {
  return `<div class="sc-table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

export function renderSourceConfigurationCenter(data) {
  const badges = [
    ["Connected Sources", data.header.connectedSources],
    ["Healthy Sources", data.header.healthySources],
    ["Failed Sources", data.header.failedSources],
    ["Last Validation", new Date(data.header.lastValidation).toLocaleString()],
    ["Environment", data.header.environment.toUpperCase()]
  ];
  const connectivity = [
    ["Total Sources", data.connectivity.totalSources],
    ["Configured", data.connectivity.configuredSources],
    ["Healthy", data.connectivity.healthySources],
    ["Failed", data.connectivity.failedSources],
    ["Readiness", data.connectivity.workflowReadiness],
    ["Health Score", `${data.connectivity.configurationHealthScore}%`]
  ];
  return `<section class="sc-dashboard">
    <header class="sc-header"><div><p class="eyebrow">MARKET INTELLIGENCE / MASTER CONNECTIVITY</p><h1>Source Configuration Center</h1><p class="subtitle">Centralized management with automatic connection testing and sync every 30 seconds.</p><div class="sc-badges">${badges.map(([label, value]) => `<span><small>${label}</small><strong>${esc(value)}</strong></span>`).join("")}</div></div><div class="sc-header-actions"><button class="sc-button secondary" data-action="add-provider">Add Provider</button><button class="sc-button primary" data-action="test-all">Test All Connections</button><button class="sc-button secondary" data-action="sync-all">Sync All Sources</button><button class="sc-button secondary" data-action="export-config">Export Configuration</button></div></header>
    <section class="sc-connectivity-banner">${connectivity.map(([label, value]) => `<article class="${label === "Readiness" && value === "RESTRICTED" ? "warning" : label === "Failed" && Number(value) > 0 ? "danger" : ""}"><small>${label}</small><strong>${esc(value)}</strong></article>`).join("")}</section>
    <section class="sc-summary-grid">${data.summaryCards.map((card) => `<article class="sc-summary-card ${healthClass(card.health)}"><small>${esc(card.label)}</small><strong>${esc(card.provider)}</strong><div class="sc-summary-meta"><span>Status <b>${esc(card.status)}</b></span><span>Health <b>${esc(card.health)}</b></span><span>Last Sync <b>${card.lastSync ? esc(new Date(card.lastSync).toLocaleString()) : "—"}</b></span><span>Latency <b>${esc(card.latency)}</b></span><span>Records <b>${esc(card.records)}</b></span></div></article>`).join("")}</section>
    <section class="sc-panel"><div class="sc-panel-head"><h2>Source Registry</h2><b>${data.registry.length} SOURCES</b></div>${table(["Source","Provider","Provider Type","Status","Health","Last Sync","Latency","Records","Authentication","Environment","Actions"], data.registry.map((row) => [esc(row.source), esc(row.provider), esc(row.providerType), `<b class="sc-state ${esc(row.status.toLowerCase())}">${esc(row.status)}</b>`, esc(row.health), row.lastSync ? esc(new Date(row.lastSync).toLocaleString()) : "—", row.latencyMs != null ? `${row.latencyMs} ms` : "—", esc(row.records), esc(row.authentication), esc(row.environment), `<span class="sc-actions"><button data-action="configure" data-id="${esc(row.id)}">Configure</button><button data-action="test" data-id="${esc(row.id)}">Test</button><button data-action="toggle" data-id="${esc(row.id)}" data-enabled="${row.enabled}">${row.enabled ? "Disable" : "Enable"}</button><button data-action="sync" data-id="${esc(row.id)}">Sync</button></span>`]))}</section>
    <section class="sc-panel"><div class="sc-panel-head"><h2>Connection Testing Center</h2><div class="sc-inline-actions"><button class="sc-button primary" data-action="test-all">Test All Sources</button><button class="sc-button secondary" data-action="run-validation">Run Validation</button></div></div>${table(["Source","Result","Latency","Details","Tested At"], data.testResults.length ? data.testResults.map((row) => [esc(row.source), `<b class="sc-result ${resultClass(row.result)}">${esc(row.result)}</b>`, row.latencyMs != null ? `${row.latencyMs} ms` : "—", esc(row.details), row.testedAt ? esc(new Date(row.testedAt).toLocaleString()) : "—"]) : [["—","—","—","No connection tests recorded yet.","—"]])}</section>
    <section class="sc-panel"><div class="sc-panel-head"><h2>Synchronization Center</h2><div class="sc-inline-actions"><button class="sc-button primary" data-action="sync-all">Sync Now</button><button class="sc-button secondary" data-action="force-refresh">Force Refresh</button></div></div>${table(["Source","Last Sync","Next Sync","Records Imported","Sync Duration","Status"], data.syncJobs.map((job) => [esc(job.sourceLabel), job.lastSyncAt ? esc(new Date(job.lastSyncAt).toLocaleString()) : "—", job.nextSyncAt ? esc(new Date(job.nextSyncAt).toLocaleString()) : esc(job.schedule), esc(job.recordsImported), job.syncDurationMs ? `${job.syncDurationMs} ms` : "—", esc(job.status)]))}</section>
    <section class="sc-panel sc-vault"><div class="sc-panel-head"><h2>Credential Vault Integration</h2><b>VAULT REFERENCES ONLY</b></div><p class="sc-vault-note">Secrets are never exposed in the UI. Only vault references are displayed.</p><div class="sc-vault-grid">${data.credentials.map((item) => `<article><small>${esc(item.sourceKey)}</small><strong>${esc(item.vaultRef)}</strong><span>Stored Securely</span></article>`).join("")}</div></section>
    <section class="sc-panel"><div class="sc-panel-head"><h2>Workflow Dependency Map</h2><b>DOWNSTREAM IMPACT</b></div><div class="sc-dependency-map">${data.workflowDependencies.map((item) => `<article><strong>${esc(item.source)}</strong><div>${item.targets.map((target) => `<span>${esc(target)}</span>`).join("")}</div></article>`).join("")}</div></section>
    <section class="sc-panel" id="sc-audit-logs"><div class="sc-panel-head"><h2>Audit & Activity Logs</h2><b>${data.auditLogs.length} EVENTS</b></div>${table(["Timestamp","Source","Event","Severity","User","Result"], data.auditLogs.map((log) => [esc(new Date(log.timestamp).toLocaleString()), esc(log.sourceKey), esc(log.event), esc(log.severity.toUpperCase()), esc(log.user), esc(log.result)]))}</section>
    <section class="sc-panel sc-action-center"><div class="sc-panel-head"><h2>Action Center</h2><b>OPERATOR CONTROLS</b></div><div class="sc-action-grid">${["Add Provider","Save Configuration","Test All","Sync All","Export Config","Import Config","Open Logs"].map((label) => `<button class="sc-button secondary" data-action="${label.toLowerCase().replaceAll(" ", "-")}">${label}</button>`).join("")}</div></section>
  </section>`;
}

async function loadDashboard() {
  const response = await fetch(`${API}/api/source-configuration`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Source configuration request failed (${response.status})`);
  return response.json();
}

async function post(path, body = {}) {
  const response = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Source action failed (${response.status})`);
  return response.json();
}

async function put(path, body = {}) {
  const response = await fetch(`${API}${path}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Provider update failed (${response.status})`);
  return response.json();
}

export function bindSourceConfigurationCenter() {
  const root = document.querySelector("#intelligence-content");
  const refresh = async () => {
    root.innerHTML = renderSourceConfigurationCenter(await loadDashboard());
    bindSourceConfigurationCenter();
  };

  if (sourceConfigRefreshTimer) clearInterval(sourceConfigRefreshTimer);
  sourceConfigRefreshTimer = setInterval(() => {
    if (!document.hidden) refresh();
  }, AUTO_REFRESH_MS);

  root.querySelector('[data-action="test-all"]')?.addEventListener("click", () => post("/api/source-configuration/test-all").then(refresh));
  root.querySelector('[data-action="sync-all"]')?.addEventListener("click", () => post("/api/source-configuration/sync-all").then(refresh));
  root.querySelector('[data-action="run-validation"]')?.addEventListener("click", () => post("/api/market-intelligence/data-quality-gate/run").then(refresh));
  root.querySelector('[data-action="force-refresh"]')?.addEventListener("click", () => post("/api/market-intelligence/data-sources/sync").then(refresh));
  root.querySelector('[data-action="export-config"]')?.addEventListener("click", async () => {
    const payload = await fetch(`${API}/api/source-configuration/export`).then((response) => response.json());
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "source-configuration-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });
  root.querySelector('[data-action="add-provider"]')?.addEventListener("click", () => fetch(`${API}/api/source-configuration/provider`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceKey: "market-data", providerName: "Custom Feed" }) }).then(refresh));
  root.querySelector('[data-action="open-logs"]')?.addEventListener("click", () => document.querySelector("#sc-audit-logs")?.scrollIntoView({ behavior: "smooth" }));
  root.querySelectorAll('[data-action="test"]').forEach((button) => button.addEventListener("click", () => post("/api/source-configuration/test", { providerId: button.dataset.id }).then(refresh)));
  root.querySelectorAll('[data-action="sync"]').forEach((button) => button.addEventListener("click", () => post("/api/source-configuration/sync", { providerId: button.dataset.id }).then(refresh)));
  root.querySelectorAll('[data-action="toggle"]').forEach((button) => button.addEventListener("click", () => put(`/api/source-configuration/provider/${button.dataset.id}`, { enabled: button.dataset.enabled !== "true" }).then(refresh)));
}

export async function mountSourceConfigurationCenter() {
  const root = document.querySelector("#intelligence-content");
  try {
    root.innerHTML = renderSourceConfigurationCenter(await loadDashboard());
    bindSourceConfigurationCenter();
  } catch (reason) {
    root.innerHTML = `<section class="sc-dashboard sc-panel"><h1>Source Configuration Center</h1><p>${esc(reason.message)}</p><button class="sc-button primary" id="sc-retry">Retry</button></section>`;
    document.querySelector("#sc-retry")?.addEventListener("click", mountSourceConfigurationCenter);
  }
}
