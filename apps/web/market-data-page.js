import {
  buildWizardPayload,
  createWizardState,
  loadBrokerServersForState,
  readWizardForm,
  renderProviderWizardModal
} from "./market-data-provider-wizard.js";

const API = "http://localhost:8080";
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const table = (headers, rows) => `<div class="mdoc-table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

function renderMt5Sections(data) {
  const mt5 = data.mt5 || { terminals: [], machines: [], heartbeats: [], health: {}, readiness: {} };
  const providers = data.providers || [];
  const pendingProviders = providers.filter((provider) => !provider.mt5TerminalId && (provider.connectionMethod === "MT5 Bridge" || String(provider.providerType || provider.type || "").includes("MT5")));
  const onboarding = (mt5.onboarding || [])[0];
  const steps = onboarding?.steps || [];
  const formatAge = (value) => {
    if (!value) return "—";
    const sec = Math.round((Date.now() - new Date(value).getTime()) / 1000);
    if (sec < 60) return `${sec} sec ago`;
    return `${Math.round(sec / 60)} min ago`;
  };

  const mt5Kpis = `<section class="mdoc-kpi-grid mdoc-mt5-kpis">
    ${[["Connected Terminals", mt5.health?.connectedTerminals ?? 0], ["Disconnected Terminals", mt5.health?.disconnectedTerminals ?? 0], ["Online Accounts", mt5.health?.onlineAccounts ?? 0], ["Offline Accounts", mt5.health?.offlineAccounts ?? 0], ["Live Symbols", mt5.health?.liveSymbols ?? 0], ["Avg Tick Delay", mt5.health?.averageTickDelayMs ? `${mt5.health.averageTickDelayMs}ms` : "—"], ["Avg Spread", mt5.health?.averageSpread ?? "—"], ["Avg Latency", mt5.health?.averageLatencyMs ? `${mt5.health.averageLatencyMs}ms` : "—"], ["MT5 Health Score", mt5.health?.mt5HealthScore ? `${mt5.health.mt5HealthScore}%` : "—"]].map(([label, value]) => `<article class="mdoc-kpi"><small>${esc(label)}</small><strong>${esc(value)}</strong></article>`).join("")}
  </section>`;

  const onboardingHtml = steps.length
    ? `<section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Terminal Onboarding Status</h2><b>${esc(onboarding?.providerName || "PROVIDER")}</b></div><ol class="mdoc-onboarding">${steps.map((step) => `<li class="mdoc-onboarding-step ${esc(String(step.status).toLowerCase())}"><span>${esc(step.order)}</span><div><strong>${esc(step.label)}</strong><small>${esc(String(step.status).replaceAll("_", " "))}</small></div></li>`).join("")}</ol></section>`
    : "";

  const terminalsHtml = `<section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Registered MT5 Terminals</h2><b>${mt5.terminals.length} TERMINALS</b></div>${table(["Terminal","Machine","Broker","Account","Server","Environment","EA Status","Connection","Last Heartbeat","Latency","Symbols","Actions"], mt5.terminals.map((row) => [esc(row.terminalName), esc(row.machineName), esc(row.brokerName), esc(row.accountNumber || "—"), esc(row.serverName || "—"), esc(row.environment), `<b class="mdoc-state ${esc(String(row.eaStatus).toLowerCase())}">${esc(row.eaStatus)}</b>`, `<b class="mdoc-state ${esc(String(row.connectionStatus).toLowerCase())}">${esc(row.connectionStatus)}</b>`, formatAge(row.lastHeartbeat), row.latencyMs != null ? `${row.latencyMs} ms` : "—", esc(row.liveSymbolCount || 0), `<span class="mdoc-actions"><button data-action="generate-token" data-provider-id="${esc(row.providerId)}" data-terminal-id="${esc(row.id)}">Copy Token</button><button data-action="import-market-watch" data-terminal-id="${esc(row.id)}">Import</button><button data-action="provider-details" data-provider-id="${esc(row.providerId)}">Details</button></span>`]))}</section>`;

  const machinesHtml = `<section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Connected Machines</h2><b>${mt5.machines.length} MACHINES</b></div>${table(["Machine","Hostname","OS","Agent","Public IP","Private IP","MT5 Count","Status","Last Seen"], mt5.machines.map((row) => [esc(row.name), esc(row.hostname || "—"), esc(row.operatingSystem || "—"), esc(row.agentVersion || "—"), esc(row.publicIp || "—"), esc(row.privateIp || "—"), esc(row.mt5Count ?? 0), `<b class="mdoc-state ${esc(String(row.status).toLowerCase())}">${esc(row.status)}</b>`, row.lastSeen ? esc(new Date(row.lastSeen).toLocaleString()) : "—"]))}</section>`;

  const heartbeatsHtml = `<section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Heartbeat Monitor</h2><b>10s EXPECTED</b></div>${table(["Terminal","Last Heartbeat","Status","Latency"], mt5.heartbeats.map((row) => [esc(row.terminal), formatAge(row.lastHeartbeat), `<b class="mdoc-state ${esc(String(row.status).toLowerCase())}">${esc(row.status)}</b>`, row.latencyMs != null ? `${row.latencyMs} ms` : "—"]))}</section>`;

  const readiness = mt5.readiness || {};
  const setupCta = pendingProviders.length
    ? `<section class="mdoc-panel mdoc-setup-cta" id="mdoc-register-terminal">
        <div class="mdoc-panel-head"><h2>MT5 Setup Required</h2><b>STEP 2</b></div>
        <p>Your provider is saved, but no MT5 terminal is linked yet. Register a terminal to generate tokens, connect the EA, and import market watch symbols.</p>
        <div class="mdoc-header-actions">${pendingProviders.map((provider) => `<button class="mdoc-button primary" data-action="register-terminal" data-provider-id="${esc(provider.id)}">Register Terminal — ${esc(provider.name)}</button>`).join("")}<a class="mdoc-button secondary" href="/workspace/mt5-infrastructure/ea-deployments">Deploy EA</a></div>
      </section>`
    : "";
  const readinessHtml = `<section class="mdoc-panel mdoc-readiness"><div class="mdoc-panel-head"><h2>Workflow Readiness</h2><b>${esc(readiness.permission || "STOP")}</b></div><p>${esc(readiness.message || "Complete MT5 onboarding to enable workflow.")}</p>${readiness.reason ? `<small>Blocker: ${esc(readiness.reason)}</small>` : ""}</section>`;

  return `${setupCta}${mt5Kpis}${readinessHtml}${onboardingHtml}${terminalsHtml}${machinesHtml}${heartbeatsHtml}`;
}

function renderProviderDetailsDrawer(details) {
  const provider = details.provider || {};
  const terminal = details.terminal;
  const checks = (details.liveValidation?.checks || []).map((row) => `<li class="${esc(String(row.status).toLowerCase())}">${esc(row.label)} — ${esc(row.status)}</li>`).join("");
  return `<aside class="mdoc-drawer" id="mdoc-provider-drawer"><div class="mdoc-drawer-head"><h2>Provider Details</h2><button type="button" data-action="close-drawer">Close</button></div>
    <section><h3>Provider Information</h3><p><span>Broker</span><strong>${esc(terminal?.brokerName || provider.name)}</strong></p><p><span>Server</span><strong>${esc(terminal?.serverName || "—")}</strong></p><p><span>Account</span><strong>${esc(terminal?.accountNumber || "—")}</strong></p><p><span>Machine</span><strong>${esc(terminal?.machineName || "—")}</strong></p><p><span>Terminal</span><strong>${esc(terminal?.terminalName || "—")}</strong></p><p><span>Status</span><strong>${esc(provider.status)}</strong></p></section>
    <section><h3>Live Price Verification</h3><ul class="mdoc-checks">${checks || "<li>No checks available</li>"}</ul><p>Result: <strong>${esc(details.liveValidation?.result || "FAIL")}</strong></p></section>
    <section><h3>Onboarding</h3><ol class="mdoc-onboarding">${(details.onboarding?.steps || []).map((step) => `<li class="mdoc-onboarding-step ${esc(String(step.status).toLowerCase())}"><span>${esc(step.order)}</span><div><strong>${esc(step.label)}</strong><small>${esc(String(step.status))}</small></div></li>`).join("")}</ol></section>
  </aside>`;
}

function renderEmptyState() {
  return `<section class="mdoc-panel mdoc-empty"><h2>No Market Data Providers Configured</h2><p>Connect live pricing gateways through PostgreSQL-backed provider records.</p><div class="mdoc-header-actions"><button class="mdoc-button primary mdoc-add-provider-btn" data-action="add-provider">Add Provider</button><button class="mdoc-button secondary" data-action="open-source-config">Open Source Configuration Center</button></div></section>`;
}

function renderSuccessToast(notification) {
  if (!notification) return "";
  return `<aside class="mdoc-success-toast" id="mdoc-success-toast"><strong>${esc(notification.title)}</strong><p><span>Provider:</span> ${esc(notification.providerName)}${notification.providerCode ? ` (${esc(notification.providerCode)})` : ""}</p><p><span>Status:</span> ${esc(notification.status)}</p><p><span>Workflow Impact:</span> ${esc(notification.workflowImpact)}</p><button type="button" class="mdoc-button secondary" data-action="dismiss-toast">Dismiss</button></aside>`;
}

function renderTokenModal({ token, expiresAt, created = true }) {
  const value = typeof token === "string" ? token : token?.token || "";
  const expiry = expiresAt ? new Date(expiresAt).toLocaleString() : "—";
  return `<div class="mdoc-modal-backdrop" id="mdoc-token-modal">
    <section class="mdoc-modal mdoc-token-modal">
      <header class="mdoc-modal-head"><h2>Registration Token</h2><button type="button" class="mdoc-button secondary" data-action="close-token-modal">Close</button></header>
      <p class="mdoc-help">${created ? "New token generated." : "Active pending token retrieved."} Paste this into the CACSMS EA on your MT5 chart.</p>
      <label class="mdoc-token-field">Token<input id="mdoc-token-value" type="text" readonly value="${esc(value)}" /></label>
      <p class="mdoc-token-meta"><span>Expires</span><strong>${esc(expiry)}</strong></p>
      <div class="mdoc-header-actions">
        <button type="button" class="mdoc-button primary" data-action="copy-token">Copy Token</button>
        <button type="button" class="mdoc-button secondary" data-action="regenerate-token">Generate New Token</button>
      </div>
      <p class="mdoc-copy-status" id="mdoc-copy-status" hidden></p>
    </section>
  </div>`;
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function showTokenModal(meta, { providerId, terminalId, refresh }) {
  document.querySelector("#mdoc-token-modal")?.remove();
  const row = meta.token || meta;
  document.body.insertAdjacentHTML("beforeend", renderTokenModal({
    token: row.token || row,
    expiresAt: row.expires_at || row.expiresAt,
    created: meta.created !== false
  }));

  const modal = document.querySelector("#mdoc-token-modal");
  const input = modal.querySelector("#mdoc-token-value");
  const status = modal.querySelector("#mdoc-copy-status");
  const close = () => modal.remove();

  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  modal.querySelector('[data-action="close-token-modal"]')?.addEventListener("click", close);
  input?.addEventListener("click", () => input.select());

  modal.querySelector('[data-action="copy-token"]')?.addEventListener("click", async () => {
    try {
      await copyToClipboard(input.value);
      status.hidden = false;
      status.textContent = "Token copied to clipboard.";
      status.className = "mdoc-copy-status success";
    } catch (reason) {
      status.hidden = false;
      status.textContent = "Copy failed — select the token and press Ctrl+C.";
      status.className = "mdoc-copy-status error";
    }
  });

  modal.querySelector('[data-action="regenerate-token"]')?.addEventListener("click", async () => {
    try {
      const payload = await post(`/api/market-data/providers/${providerId}/generate-token`, { terminalId, forceNew: true });
      close();
      showTokenModal(payload, { providerId, terminalId, refresh });
      await refresh?.();
    } catch (reason) {
      status.hidden = false;
      status.textContent = reason.message;
      status.className = "mdoc-copy-status error";
    }
  });
}

async function openRegistrationToken(providerId, terminalId, refresh) {
  const payload = await post(`/api/market-data/providers/${providerId}/generate-token`, { terminalId });
  showTokenModal(payload, { providerId, terminalId, refresh });
  await refresh?.();
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
    ${renderMt5Sections(data)}
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Provider Registry</h2><b>${data.providers.length} PROVIDERS</b></div>${table(["Provider","Type","Status","Health","Freshness","Latency","Tick Rate","Coverage","Last Sync","Workflow Impact","Actions"], data.providers.map((row) => [esc(row.name), esc(row.type || row.providerType), `<b class="mdoc-state ${esc(String(row.status).toLowerCase())}">${esc(row.status)}</b>`, esc(row.health), esc(row.freshness || "—"), row.latencyMs != null ? `${row.latencyMs} ms` : "—", esc(row.tickRate || 0), esc(row.coverage), row.lastSync ? esc(new Date(row.lastSync).toLocaleString()) : "—", esc(row.workflowImpact || "—"), `<span class="mdoc-actions"><button data-action="test" data-id="${esc(row.id)}">Test</button>${row.mt5TerminalId ? `<button data-action="generate-token" data-provider-id="${esc(row.id)}" data-terminal-id="${esc(row.mt5TerminalId)}">Copy Token</button><button data-action="import-market-watch" data-terminal-id="${esc(row.mt5TerminalId)}">Import</button>` : `<button data-action="register-terminal" data-provider-id="${esc(row.id)}">Register Terminal</button>`}<button data-action="provider-details" data-provider-id="${esc(row.id)}">Details</button></span>`]))}</section>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Live Feed Monitor</h2><b>1s REFRESH</b></div>${table(["Symbol","Bid","Ask","Spread","Last Tick","Provider","Status","Reason","Expected Action","Workflow Impact"], data.liveFeed.map((row) => [esc(row.symbol), row.bid ?? "—", row.ask ?? "—", row.spread ?? "—", row.lastTick ? esc(new Date(row.lastTick).toLocaleTimeString()) : "—", esc(row.provider), esc(row.status), esc(row.reason || "—"), esc(row.expectedAction || "—"), esc(row.workflowImpact || "—")]))}</section>
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

async function rerenderWizardAsync(modal, state, catalog, refresh) {
  modal.outerHTML = renderProviderWizardModal(state, catalog);
  await bindProviderWizard(refresh, state, catalog);
}

function validateMt5Step(state) {
  if (!String(state.brokerName || "").trim()) return "Broker is required.";
  if (state.brokerName === "Custom Broker" && !String(state.customBrokerName || "").trim()) return "Custom broker name is required.";
  if (state.customServer) {
    if (!String(state.customServerName || state.serverName || "").trim()) return "Custom server name is required.";
    return state.serverVerificationStatus === "UNVERIFIED" ? "warning:custom_server" : null;
  }
  if (!String(state.serverName || "").trim()) return "Server is required. Select a verified server or use Enter Custom Server.";
  return state.serverVerificationStatus === "UNVERIFIED" ? "warning:custom_server" : null;
}

async function bindProviderWizard(refresh, state, catalog) {
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

  modal.querySelectorAll("[data-provider-id]").forEach((card) => card.addEventListener("click", async () => {
    state = readWizardForm(modal, state);
    state.providerTemplateId = card.dataset.providerId;
    state.providerName = card.dataset.name;
    state.vendorKey = card.dataset.vendorKey || card.dataset.name?.replace(/\s+/g, "");
    state.name = state.name || card.dataset.name;
    if (state.category === "mt5_terminal") {
      state.brokerName = card.dataset.broker || state.brokerName;
      state.brokerSearchName = card.dataset.brokerSearch || state.brokerSearchName;
      state.serverName = "";
      state.selectedServer = null;
      state.customServer = false;
      await loadBrokerServersForState(state, request);
    }
    state.step = 3;
    await rerenderWizardAsync(modal, state, catalog, refresh);
  }));

  const brokerInput = modal.querySelector('input[name="brokerName"]');
  brokerInput?.addEventListener("change", async () => {
    state = readWizardForm(modal, state);
    const match = (state.brokers || []).find((item) => item.brokerName.toLowerCase() === state.brokerName.toLowerCase());
    state.brokerSearchName = match?.brokerSearchName || state.brokerSearchName;
    state.serverName = "";
    state.selectedServer = null;
    state.serverVerificationStatus = "";
    state.serverSource = "";
    state.customServer = false;
    await loadBrokerServersForState(state, request);
    await rerenderWizardAsync(modal, state, catalog, refresh);
  });

  modal.querySelector('input[name="customServer"]')?.addEventListener("change", async (event) => {
    state = readWizardForm(modal, state);
    state.customServer = event.target.checked;
    if (state.customServer) {
      state.serverName = "";
      state.selectedServer = null;
      state.serverVerificationStatus = "UNVERIFIED";
      state.serverSource = "custom_user_entry";
    }
    await rerenderWizardAsync(modal, state, catalog, refresh);
  });

  modal.querySelector('select[name="serverName"]')?.addEventListener("change", () => {
    state = readWizardForm(modal, state);
    rerenderWizard(modal, state, catalog, refresh);
  });

  modal.querySelector('[data-action="wizard-back"]')?.addEventListener("click", () => {
    state = readWizardForm(modal, state);
    if (state.step === 3 && state.category === "custom_provider") state.step = 1;
    else if (state.step === 3) state.step = 2;
    else state.step = Math.max(1, state.step - 1);
    rerenderWizard(modal, state, catalog, refresh);
  });

  modal.querySelector('[data-action="wizard-next"]')?.addEventListener("click", async () => {
    state = readWizardForm(modal, state);
    hideModalError(modal);
    if (state.step === 1) {
      if (!state.category) return showModalError(modal, "Select a source category to continue.");
      state.step = state.category === "custom_provider" ? 3 : 2;
      await rerenderWizardAsync(modal, state, catalog, refresh);
      return;
    }
    if (state.step === 2 && !state.providerTemplateId) {
      return showModalError(modal, "Select a provider to continue.");
    }
    if (state.step === 3 && state.category === "mt5_terminal") {
      const validation = validateMt5Step(state);
      if (validation && !validation.startsWith("warning:")) return showModalError(modal, validation);
      if (validation === "warning:custom_server") {
        showModalBanner(modal, "<strong>Unverified server</strong><span>This server is not verified. Connection tests may fail if the server name is incorrect.</span>", "");
      }
    }
    if (state.step === 5 && !state.testPassed) return showModalError(modal, "Run Test Connection and receive PASS or WARNING before continuing.");
    state.step = Math.min(6, state.step + 1);
    await rerenderWizardAsync(modal, state, catalog, refresh);
  });

  modal.querySelector('[data-action="detect-servers"]')?.addEventListener("click", async () => {
    state = readWizardForm(modal, state);
    hideModalError(modal);
    if (!state.brokerName) return showModalError(modal, "Select a broker before detecting servers.");
    try {
      state.serversLoading = true;
      rerenderWizard(modal, state, catalog, refresh);
      modal = document.querySelector("#mdoc-add-modal");
      const payload = await post("/api/mt5/brokers/detect-servers", buildWizardPayload(state));
      state.brokerServers = payload.servers || [];
      state.serverListMessage = payload.message;
      state.serversLoading = false;
      showModalBanner(modal, `<strong>Server detection complete</strong><span>${esc(payload.message)}</span>`, payload.discoveredCount ? "success" : "");
      await rerenderWizardAsync(modal, state, catalog, refresh);
    } catch (reason) {
      state.serversLoading = false;
      showModalError(modal, reason.message);
    }
  });

  modal.querySelector('[data-action="refresh-servers"]')?.addEventListener("click", async () => {
    state = readWizardForm(modal, state);
    hideModalError(modal);
    if (!state.brokerName) return showModalError(modal, "Select a broker before refreshing servers.");
    try {
      state.serverName = "";
      state.selectedServer = null;
      await loadBrokerServersForState(state, request);
      await rerenderWizardAsync(modal, state, catalog, refresh);
    } catch (reason) {
      showModalError(modal, reason.message);
    }
  });

  modal.querySelector('[data-action="detect-terminals"]')?.addEventListener("click", async () => {
    hideModalError(modal);
    try {
      const payload = await request("/api/market-data/providers/detect-mt5-terminals");
      const panel = modal.querySelector("#mdoc-terminal-results");
      panel.hidden = false;
      panel.innerHTML = (payload.terminals.length ? payload.terminals : []).map((terminal) => `<button type="button" class="mdoc-terminal-card" data-terminal-id="${esc(terminal.id)}"><strong>${esc(terminal.broker)}</strong><span>${esc(terminal.account || "No account")} · ${esc(terminal.terminalName)}</span><small>${esc(terminal.dataPath)} · Build ${esc(terminal.buildVersion)}</small></button>`).join("") || "<p class=\"mdoc-help\">No MT5 terminals detected on this machine.</p>";
      panel.querySelectorAll(".mdoc-terminal-card").forEach((button) => button.addEventListener("click", async () => {
        const match = payload.terminals.find((item) => item.id === button.dataset.terminalId);
        if (!match) return;
        state = readWizardForm(modal, state);
        state.terminalId = match.id;
        state.brokerName = match.broker || state.brokerName;
        state.accountNumber = match.account;
        state.terminalName = match.terminalName;
        state.dataPath = match.dataPath;
        state.terminalLocation = match.dataPath;
        state.buildVersion = match.buildVersion;
        state.name = state.name || `${match.broker || "MT5"} Terminal`;
        await loadBrokerServersForState(state, request);
        await rerenderWizardAsync(modal, state, catalog, refresh);
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
    const validation = state.category === "mt5_terminal" ? validateMt5Step(state) : null;
    if (validation && !validation.startsWith("warning:")) return showModalError(modal, validation);
    try {
      if (state.customServer && state.customServerName) {
        await post("/api/mt5/brokers/custom-server", buildWizardPayload(state));
      }
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
  const [catalog, brokersPayload] = await Promise.all([
    request("/api/market-data/providers/catalog"),
    request("/api/mt5/brokers")
  ]);
  const state = createWizardState();
  state.brokers = brokersPayload.brokers || [];
  document.body.insertAdjacentHTML("beforeend", renderProviderWizardModal(state, catalog));
  await bindProviderWizard(refresh, state, catalog);
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

  root.querySelectorAll('[data-action="register-terminal"]').forEach((button) => button.addEventListener("click", async () => {
    try {
      await post("/api/mt5/terminals/register", { providerId: button.dataset.providerId });
      await refresh();
    } catch (reason) {
      alert(reason.message);
    }
  }));

  root.querySelectorAll('[data-action="generate-token"]').forEach((button) => button.addEventListener("click", async () => {
    try {
      await openRegistrationToken(button.dataset.providerId, button.dataset.terminalId, refresh);
    } catch (reason) {
      alert(reason.message);
    }
  }));

  root.querySelectorAll('[data-action="import-market-watch"]').forEach((button) => button.addEventListener("click", async () => {
    try {
      await post("/api/mt5/terminals/import-market-watch", { terminalId: button.dataset.terminalId });
      await refresh();
    } catch (reason) {
      alert(reason.message);
    }
  }));

  root.querySelectorAll('[data-action="provider-details"]').forEach((button) => button.addEventListener("click", async () => {
    try {
      document.querySelector("#mdoc-provider-drawer")?.remove();
      const details = await request(`/api/market-data/providers/${button.dataset.providerId}/mt5-details`);
      document.body.insertAdjacentHTML("beforeend", renderProviderDetailsDrawer(details));
      document.querySelector('[data-action="close-drawer"]')?.addEventListener("click", () => document.querySelector("#mdoc-provider-drawer")?.remove());
    } catch (reason) {
      alert(reason.message);
    }
  }));
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
