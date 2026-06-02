import {
  buildWizardPayload,
  createWizardState,
  readWizardForm,
  renderProviderWizardModal
} from "./market-data-provider-wizard.js";

const API = "http://localhost:8080";
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const table = (headers, rows) => `<div class="mdoc-table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

function renderEmptyState() {
  return `<section class="mdoc-panel mdoc-empty"><h2>No Market Data Providers Configured</h2><p>Connect live pricing gateways through PostgreSQL-backed provider records.</p><div class="mdoc-header-actions"><button class="mdoc-button primary mdoc-add-provider-btn" data-action="add-provider">Add Provider</button><button class="mdoc-button secondary" data-action="open-source-config">Open Source Configuration Center</button></div></section>`;
}

function renderSuccessToast(notification) {
  if (!notification) return "";
  return `<aside class="mdoc-success-toast" id="mdoc-success-toast"><strong>${esc(notification.title)}</strong><p><span>Provider:</span> ${esc(notification.providerName)}${notification.providerCode ? ` (${esc(notification.providerCode)})` : ""}</p><p><span>Status:</span> ${esc(notification.status)}</p><p><span>Workflow Impact:</span> ${esc(notification.workflowImpact)}</p><button type="button" class="mdoc-button secondary" data-action="dismiss-toast">Dismiss</button></aside>`;
}

export function renderMarketDataOperationsCenter(data, notification = null) {
  const header = `<header class="mdoc-header"><div><p class="eyebrow">MARKET INTELLIGENCE / MARKET DATA OPERATIONS</p><h1>Market Data Providers</h1><p class="subtitle">Manage, validate and monitor all market data providers powering CACSMS Engine.</p><div class="mdoc-badges">${[["Connected Providers", data.header.connectedProviders], ["Healthy Providers", data.header.healthyProviders], ["Live Symbols", data.header.liveSymbols], ["Workflow Status", data.header.workflowStatus], ["Data Confidence", data.header.dataConfidence]].map(([label, value]) => `<span><small>${label}</small><strong>${esc(value)}</strong></span>`).join("")}</div></div><div class="mdoc-header-actions"><button class="mdoc-button primary mdoc-add-provider-btn" data-action="add-provider">Add Provider</button><button class="mdoc-button secondary" data-action="test-all">Test Providers</button><button class="mdoc-button secondary" data-action="sync">Sync Symbols</button><button class="mdoc-button secondary" data-action="refresh">Refresh</button><button class="mdoc-button secondary" data-action="export">Export Status</button></div></header>`;

  if (data.empty) {
    return `<section class="mdoc-dashboard">${header}${renderEmptyState()}${renderSuccessToast(notification)}</section>`;
  }

  return `<section class="mdoc-dashboard">
    ${header}
    ${renderSuccessToast(notification)}
    <section class="mdoc-banner">${Object.entries(data.banner).map(([label, value]) => `<article><small>${label.replace(/([A-Z])/g, " $1").trim()}</small><strong>${esc(value)}</strong></article>`).join("")}</section>
    <section class="mdoc-kpi-grid">${data.kpis.map(([label, value]) => `<article class="mdoc-kpi"><small>${esc(label)}</small><strong>${esc(value)}</strong></article>`).join("")}</section>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Provider Registry</h2><b>${data.providers.length} PROVIDERS</b></div>${table(["Provider","Type","Status","Health","Freshness","Latency","Tick Rate","Coverage","Last Sync","Workflow Impact","Actions"], data.providers.map((row) => [esc(row.name), esc(row.type || row.providerType), `<b class="mdoc-state ${esc(String(row.status).toLowerCase())}">${esc(row.status)}</b>`, esc(row.health), esc(row.freshness || "—"), row.latencyMs != null ? `${row.latencyMs} ms` : "—", esc(row.tickRate || 0), esc(row.coverage), row.lastSync ? esc(new Date(row.lastSync).toLocaleString()) : "—", esc(row.workflowImpact || "—"), `<span class="mdoc-actions"><button data-action="test" data-id="${esc(row.id)}">Test</button></span>`]))}</section>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Live Feed Monitor</h2><b>1s REFRESH</b></div>${table(["Symbol","Bid","Ask","Spread","Last Tick","Provider","Status"], data.liveFeed.map((row) => [esc(row.symbol), row.bid ?? "—", row.ask ?? "—", row.spread ?? "—", row.lastTick ? esc(new Date(row.lastTick).toLocaleTimeString()) : "—", esc(row.provider), esc(row.status)]))}</section>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Asset Coverage Matrix</h2><b>20 ASSETS</b></div>${table(["Symbol","Price Feed","Tick Feed","Spread Feed","Volume Feed","Provider","Coverage","Status"], (data.coverage || []).map((row) => [esc(row.symbol), row.priceFeed ? "Available" : "Unavailable", row.tickFeed ? "Available" : "Unavailable", row.spreadFeed ? "Available" : "Unavailable", row.volumeFeed ? "Available" : "Unavailable", esc(row.provider), `${esc(row.coverage)}%`, esc(row.status)]))}</section>
    <div class="mdoc-grid-2"><section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Tick Quality Monitor</h2><b>${esc(data.tickQuality?.tickStability || "—")}</b></div><div class="mdoc-metrics"><span>Tick Frequency<strong>${esc(data.tickQuality?.tickFrequency || "—")}</strong></span><span>Missing Ticks<strong>${esc(data.tickQuality?.missingTicks ?? "—")}</strong></span></div><div class="mdoc-bars">${(data.tickQuality?.ticksPerMinute || []).map((height) => `<i style="height:${height}%"></i>`).join("")}</div></section><section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Spread Quality Center</h2><b>EXECUTION IMPACT</b></div>${table(["Symbol","Current Spread","Average Spread","Quality","Risk Impact"], (data.spreadQuality || []).map((row) => [esc(row.symbol), esc(row.currentSpread), esc(row.averageSpread), esc(row.quality), esc(row.riskImpact)]))}</section></div>
    <div class="mdoc-grid-2"><section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Latency Monitor</h2><b>${data.latencyMonitor?.averageLatencyMs != null ? `${data.latencyMonitor.averageLatencyMs}ms AVG` : "NO PROBE"}</b></div><div class="mdoc-bars">${(data.latencyMonitor?.trend || []).map((height) => `<i style="height:${Math.max(height, 4)}%"></i>`).join("")}</div></section><section class="mdoc-panel mdoc-integrity"><div class="mdoc-panel-head"><h2>Data Integrity Engine</h2><b>${data.integrity?.score ?? 0}%</b></div><strong class="mdoc-score">${data.integrity?.score ?? 0}</strong></section></div>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Provider Comparison Center</h2><b>BEST PROVIDER SELECTION</b></div>${table(["Provider","Latency","Spread","Coverage","Quality","Availability"], (data.comparison || []).map((row) => [esc(row.provider), row.latencyMs != null ? `${row.latencyMs} ms` : "—", esc(row.spread), esc(row.coverage), esc(row.quality), esc(row.availability)]))}</section>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Workflow Impact Panel</h2><b>STOP WORKFLOW ON FAILURE</b></div><div class="mdoc-workflow">${(data.workflowImpacts || []).map((item) => `<article><strong>Market Data</strong><span>${esc(item.target)}</span><small>${esc(item.impact)}</small></article>`).join("")}</div></section>
    <section class="mdoc-panel" id="mdoc-logs"><div class="mdoc-panel-head"><h2>Market Data Logs</h2><b>${data.logs.length} EVENTS</b></div>${table(["Timestamp","Provider","Event","Severity","Message"], data.logs.map((log) => [esc(new Date(log.timestamp).toLocaleString()), esc(log.provider), esc(log.event), esc(String(log.severity).toUpperCase()), esc(log.message)]))}</section>
    <section class="mdoc-panel mdoc-action-center"><div class="mdoc-panel-head"><h2>Action Center</h2><b>DESK CONTROLS</b></div><div class="mdoc-action-grid"><button class="mdoc-button secondary" data-action="add-provider">Add Provider</button><button class="mdoc-button secondary" data-action="test-all">Test All</button><button class="mdoc-button secondary" data-action="sync">Sync Symbols</button><button class="mdoc-button secondary" data-action="refresh-feeds">Refresh Feeds</button><button class="mdoc-button secondary" data-action="export">Export Status</button><button class="mdoc-button secondary" data-action="open-logs">Open Logs</button></div></section>
  </section>`;
}

async function loadDashboard() {
  const response = await fetch(`${API}/api/market-data/providers`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Market data request failed (${response.status})`);
  return response.json();
}

async function request(path, init = {}) {
  const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ? String(payload.error).replaceAll("_", " ") : `Request failed (${response.status})`);
  return payload;
}

async function post(path, body = {}) {
  return request(path, { method: "POST", body: JSON.stringify(body) });
}

function showModalBanner(modal, message, type = "") {
  const banner = modal.querySelector("#mdoc-modal-banner");
  banner.hidden = false;
  banner.className = `mdoc-test-banner${type ? ` ${type}` : ""}`;
  banner.innerHTML = message;
}

function showModalError(modal, message) {
  const error = modal.querySelector("#mdoc-modal-error");
  error.hidden = false;
  error.textContent = message;
}

function hideModalError(modal) {
  const error = modal.querySelector("#mdoc-modal-error");
  error.hidden = true;
}

function rerenderWizard(modal, state, catalog, refresh) {
  modal.outerHTML = renderProviderWizardModal(state, catalog);
  bindProviderWizard(refresh, state, catalog);
}

function bindProviderWizard(refresh, state, catalog) {
  const modal = document.querySelector("#mdoc-add-modal");
  if (!modal) return;

  const close = () => modal.remove();
  modal.querySelectorAll('[data-action="close-modal"]').forEach((button) => button.addEventListener("click", close));
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });

  modal.querySelectorAll(".mdoc-chip").forEach((chip) => chip.addEventListener("click", () => chip.classList.toggle("active")));

  modal.querySelectorAll("[data-category]").forEach((card) => card.addEventListener("click", () => {
    state = readWizardForm(modal, state);
    state.category = card.dataset.category;
    state.step = state.category === "custom_provider" ? 3 : 2;
    rerenderWizard(modal, state, catalog, refresh);
  }));

  modal.querySelectorAll("[data-provider-id]").forEach((card) => card.addEventListener("click", () => {
    state = readWizardForm(modal, state);
    state.providerTemplateId = card.dataset.providerId;
    state.providerName = card.dataset.name;
    state.vendorKey = card.dataset.vendorKey || card.dataset.name?.replace(/\s+/g, "");
    state.name = state.name || card.dataset.name;
    if (state.category === "mt5_terminal") {
      state.brokerName = card.dataset.broker || state.brokerName;
      state.serverName = card.dataset.server || state.serverName;
    }
    state.step = 3;
    rerenderWizard(modal, state, catalog, refresh);
  }));

  modal.querySelector('[data-action="wizard-back"]')?.addEventListener("click", () => {
    state = readWizardForm(modal, state);
    if (state.step === 3 && state.category === "custom_provider") state.step = 1;
    else if (state.step === 3) state.step = 2;
    else state.step = Math.max(1, state.step - 1);
    rerenderWizard(modal, state, catalog, refresh);
  });

  modal.querySelector('[data-action="wizard-next"]')?.addEventListener("click", () => {
    state = readWizardForm(modal, state);
    hideModalError(modal);
    if (state.step === 1) {
      if (!state.category) return showModalError(modal, "Select a source category to continue.");
      state.step = state.category === "custom_provider" ? 3 : 2;
      rerenderWizard(modal, state, catalog, refresh);
      return;
    }
    if (state.step === 2 && !state.providerTemplateId) {
      return showModalError(modal, "Select a provider to continue.");
    }
    if (state.step === 5 && !state.testPassed) return showModalError(modal, "Run Test Connection and receive PASS or WARNING before continuing.");
    state.step = Math.min(6, state.step + 1);
    rerenderWizard(modal, state, catalog, refresh);
  });

  modal.querySelector('[data-action="detect-terminals"]')?.addEventListener("click", async () => {
    hideModalError(modal);
    try {
      const payload = await request("/api/market-data/providers/detect-mt5-terminals");
      const panel = modal.querySelector("#mdoc-terminal-results");
      panel.hidden = false;
      panel.innerHTML = payload.terminals.map((terminal) => `<button type="button" class="mdoc-terminal-card" data-terminal-id="${esc(terminal.id)}"><strong>${esc(terminal.broker)}</strong><span>${esc(terminal.server)} · ${esc(terminal.account)}</span><small>${esc(terminal.dataPath)} · Build ${esc(terminal.buildVersion)}</small></button>`).join("");
      panel.querySelectorAll(".mdoc-terminal-card").forEach((button) => button.addEventListener("click", () => {
        const match = payload.terminals.find((item) => item.id === button.dataset.terminalId);
        if (!match) return;
        state = readWizardForm(modal, state);
        state.terminalId = match.id;
        state.brokerName = match.broker;
        state.serverName = match.server;
        state.accountNumber = match.account;
        state.terminalName = match.terminalName;
        state.dataPath = match.dataPath;
        state.terminalLocation = match.dataPath;
        state.buildVersion = match.buildVersion;
        state.detectedSymbols = match.marketWatchSymbols || [];
        state.name = state.name || `${match.broker} MT5 Terminal`;
        rerenderWizard(modal, state, catalog, refresh);
      }));
    } catch (reason) {
      showModalError(modal, reason.message);
    }
  });

  modal.querySelector('[data-action="load-market-watch"]')?.addEventListener("click", async () => {
    state = readWizardForm(modal, state);
    hideModalError(modal);
    try {
      const payload = await post("/api/market-data/providers/market-watch", buildWizardPayload(state));
      state.detectedSymbols = payload.symbols;
      state.supportedSymbols = payload.symbols;
      rerenderWizard(modal, state, catalog, refresh);
    } catch (reason) {
      showModalError(modal, reason.message);
    }
  });

  modal.querySelector('[data-action="detect-symbols"]')?.addEventListener("click", async () => {
    state = readWizardForm(modal, state);
    hideModalError(modal);
    try {
      const payload = await post("/api/market-data/providers/detect-symbols", buildWizardPayload(state));
      state.detectedSymbols = payload.symbols;
      state.supportedSymbols = payload.symbols;
      state.assetCoverage = payload.assetCoverage || state.assetCoverage;
      rerenderWizard(modal, state, catalog, refresh);
    } catch (reason) {
      showModalError(modal, reason.message);
    }
  });

  modal.querySelector('[data-action="test-terminal"]')?.addEventListener("click", async () => {
    state = readWizardForm(modal, state);
    hideModalError(modal);
    try {
      state.testResult = await post("/api/market-data/providers/test", buildWizardPayload(state));
      state.testPassed = state.testResult.result === "PASS" || state.testResult.result === "WARNING" || state.testResult.status === "SUCCESS";
      rerenderWizard(modal, state, catalog, refresh);
    } catch (reason) {
      showModalError(modal, reason.message);
    }
  });

  modal.querySelector('[data-action="test-connection"]')?.addEventListener("click", async () => {
    state = readWizardForm(modal, state);
    hideModalError(modal);
    try {
      state.testResult = await post("/api/market-data/providers/test", buildWizardPayload(state));
      state.testPassed = state.testResult.result === "PASS" || state.testResult.result === "WARNING" || state.testResult.status === "SUCCESS" || state.testResult.status === "WARNING";
      rerenderWizard(modal, state, catalog, refresh);
    } catch (reason) {
      showModalError(modal, reason.message);
    }
  });

  modal.querySelector('[data-action="validate-config"]')?.addEventListener("click", async () => {
    state = readWizardForm(modal, state);
    hideModalError(modal);
    try {
      const result = await post("/api/market-data/providers/validate", buildWizardPayload(state));
      showModalBanner(modal, `<strong>Configuration validated</strong><span>${esc(result.message)}</span>`, "success");
    } catch (reason) {
      showModalError(modal, reason.message);
    }
  });

  modal.querySelector('[data-action="preview-coverage"]')?.addEventListener("click", async () => {
    state = readWizardForm(modal, state);
    hideModalError(modal);
    try {
      const result = await post("/api/market-data/providers/preview-coverage", buildWizardPayload(state));
      showModalBanner(modal, `<strong>Coverage preview</strong><span>${result.estimatedCoverage} symbols · ${result.coveragePct}% of universe</span>`);
    } catch (reason) {
      showModalError(modal, reason.message);
    }
  });

  modal.querySelector('[data-action="save-draft"]')?.addEventListener("click", async () => {
    state = readWizardForm(modal, state);
    hideModalError(modal);
    try {
      await post("/api/market-data/providers", { ...buildWizardPayload(state), draft: true });
      close();
      await refresh();
    } catch (reason) {
      showModalError(modal, reason.message);
    }
  });

  modal.querySelector('[data-action="register-provider"]')?.addEventListener("click", async () => {
    state = readWizardForm(modal, state);
    hideModalError(modal);
    if (!state.testPassed) return showModalError(modal, "Complete connection testing before registering the provider.");
    try {
      const payload = await post("/api/market-data/providers", buildWizardPayload(state));
      close();
      await refresh(payload.notification);
    } catch (reason) {
      showModalError(modal, reason.message);
    }
  });
}

async function openAddProviderModal(refresh) {
  if (document.querySelector("#mdoc-add-modal")) return;
  const catalog = await request("/api/market-data/providers/catalog");
  const state = createWizardState();
  document.body.insertAdjacentHTML("beforeend", renderProviderWizardModal(state, catalog));
  bindProviderWizard(refresh, state, catalog);
}

export function bindMarketDataOperationsCenter() {
  const root = document.querySelector("#intelligence-content");
  const refresh = async (notification = null) => {
    root.innerHTML = renderMarketDataOperationsCenter(await loadDashboard(), notification);
    bindMarketDataOperationsCenter();
  };

  root.querySelectorAll('[data-action="add-provider"]').forEach((button) => {
    button.addEventListener("click", () => openAddProviderModal(refresh));
  });

  root.querySelector('[data-action="open-source-config"]')?.addEventListener("click", () => {
    location.href = "/workspace/market-intelligence/source-configuration";
  });

  root.querySelector('[data-action="dismiss-toast"]')?.addEventListener("click", () => {
    document.querySelector("#mdoc-success-toast")?.remove();
  });

  root.querySelector('[data-action="test-all"]')?.addEventListener("click", () => post("/api/market-data/providers/test-all").then(() => refresh()));
  root.querySelector('[data-action="sync"]')?.addEventListener("click", () => post("/api/market-data/providers/sync-all-symbols").then(() => refresh()));
  root.querySelector('[data-action="refresh"]')?.addEventListener("click", () => refresh());
  root.querySelector('[data-action="refresh-feeds"]')?.addEventListener("click", () => refresh());
  root.querySelectorAll('[data-action="test"]').forEach((button) => button.addEventListener("click", () => post("/api/market-data/providers/test", { providerId: button.dataset.id }).then(() => refresh())));
  root.querySelector('[data-action="export"]')?.addEventListener("click", async () => {
    const csv = await request("/api/market-data/providers/export").then((payload) => payload.csv);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "market-data-status.csv";
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
