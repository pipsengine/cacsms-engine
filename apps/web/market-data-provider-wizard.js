const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const WIZARD_STEPS = [
  { id: 1, label: "Source Category" },
  { id: 2, label: "Provider" },
  { id: 3, label: "Configuration" },
  { id: 4, label: "Asset Coverage" },
  { id: 5, label: "Connection Test" },
  { id: 6, label: "Register" }
];

export function createWizardState() {
  return {
    step: 1,
    category: null,
    providerTemplateId: null,
    providerName: "",
    vendorKey: "",
    name: "",
    brokerName: "",
    terminalName: "",
    accountNumber: "",
    serverName: "",
    environment: "Production",
    terminalLocation: "",
    terminalId: null,
    dataPath: "",
    buildVersion: "",
    apiKey: "",
    enabled: true,
    assetCoverage: [],
    supportedSymbols: [],
    detectedSymbols: [],
    advancedOpen: false,
    baseUrl: "",
    websocketUrl: "",
    port: "",
    authType: "None",
    vaultSecretRef: "",
    testResult: null,
    testPassed: false
  };
}

function renderStepIndicator(step) {
  return `<nav class="mdoc-wizard-steps">${WIZARD_STEPS.map((item) => `<span class="mdoc-wizard-step${item.id === step ? " active" : item.id < step ? " done" : ""}"><i>${item.id}</i>${item.label}</span>`).join("")}</nav>`;
}

function renderCategoryCards(catalog) {
  return `<div class="mdoc-wizard-cards">${catalog.categories.map((cat) => `<button type="button" class="mdoc-wizard-card" data-category="${esc(cat.id)}"><strong>${esc(cat.title)}</strong><p>${esc(cat.description)}</p><small>${esc(cat.examples.join(" · "))}</small></button>`).join("")}</div>`;
}

function renderProviderCards(category, catalog) {
  const list = catalog.providers[category] || [];
  return `<div class="mdoc-wizard-cards compact">${list.map((item) => `<button type="button" class="mdoc-wizard-card" data-provider-id="${esc(item.id)}" data-vendor-key="${esc(item.vendorKey || "")}" data-name="${esc(item.name)}" data-broker="${esc(item.brokerName || item.name)}" data-server="${esc(item.serverName || "")}"><strong>${esc(item.name)}</strong>${item.custom ? "<small>Advanced manual setup</small>" : ""}</button>`).join("")}</div>`;
}

function renderMt5Form(state) {
  return `<div class="mdoc-form-grid">
    <label>Provider Name<input name="name" value="${esc(state.name)}" placeholder="IC Markets Production Terminal" /></label>
    <label>Broker Name<input name="brokerName" value="${esc(state.brokerName)}" required /></label>
    <label>Terminal Name<input name="terminalName" value="${esc(state.terminalName)}" placeholder="IC Markets MT5" /></label>
    <label>Account Number<input name="accountNumber" value="${esc(state.accountNumber)}" /></label>
    <label>Server Name<input name="serverName" value="${esc(state.serverName)}" required /></label>
    <label>Environment<select name="environment"><option${state.environment === "Production" ? " selected" : ""}>Production</option><option${state.environment === "Demo" ? " selected" : ""}>Demo</option><option${state.environment === "Testing" ? " selected" : ""}>Testing</option></select></label>
    <label class="mdoc-span-2">Terminal Location<input name="terminalLocation" value="${esc(state.terminalLocation || state.dataPath)}" placeholder="Auto-detected path" readonly /></label>
  </div>
  <div class="mdoc-wizard-actions">
    <button type="button" class="mdoc-button secondary" data-action="detect-terminals">Detect Installed MT5 Terminals</button>
    <button type="button" class="mdoc-button secondary" data-action="load-market-watch">Load Market Watch</button>
    <button type="button" class="mdoc-button secondary" data-action="detect-symbols">Detect Symbols</button>
    <button type="button" class="mdoc-button secondary" data-action="test-terminal">Test Terminal</button>
  </div>
  <div id="mdoc-terminal-results" class="mdoc-terminal-results" hidden></div>`;
}

function renderVendorForm(state) {
  return `<div class="mdoc-form-grid">
    <label>Provider Name<input name="name" value="${esc(state.name)}" required /></label>
    <label>API Key<input name="apiKey" type="password" value="${esc(state.apiKey)}" placeholder="Enter vendor API key" /></label>
    <label>Environment<select name="environment"><option${state.environment === "Production" ? " selected" : ""}>Production</option><option${state.environment === "Staging" ? " selected" : ""}>Staging</option><option${state.environment === "Testing" ? " selected" : ""}>Testing</option><option${state.environment === "Development" ? " selected" : ""}>Development</option></select></label>
    <label class="mdoc-checkbox"><input type="checkbox" name="enabled"${state.enabled ? " checked" : ""} /> Enable Provider</label>
  </div>
  <p class="mdoc-help">Connection endpoints and authentication are configured automatically for this vendor. You do not need to enter URLs.</p>`;
}

function renderAdvancedForm(state, catalog) {
  return `<details class="mdoc-advanced"${state.advancedOpen || state.category === "custom_provider" ? " open" : ""}>
    <summary>Advanced Configuration</summary>
    <div class="mdoc-form-grid">
      <label>Base URL<input name="baseUrl" value="${esc(state.baseUrl)}" /></label>
      <label>WebSocket URL<input name="websocketUrl" value="${esc(state.websocketUrl)}" /></label>
      <label>Port<input name="port" value="${esc(state.port)}" /></label>
      <label>Authentication Type<select name="authType">${["None", "API Key", "Bearer Token", "OAuth", "Vault Secret"].map((item) => `<option${state.authType === item ? " selected" : ""}>${item}</option>`).join("")}</select></label>
      <label class="mdoc-span-2">Vault Secret Reference<input name="vaultSecretRef" value="${esc(state.vaultSecretRef)}" placeholder="MARKETDATA_CUSTOM_API_KEY" /></label>
    </div>
  </details>`;
}

function renderCoverageStep(state, catalog) {
  const symbols = state.detectedSymbols.length ? state.detectedSymbols : state.supportedSymbols;
  return `<section class="mdoc-form-section"><h3>Supported Asset Classes</h3>
    <div class="mdoc-chip-row" id="mdoc-asset-chips">${catalog.assetOptions.map((item) => `<button type="button" class="mdoc-chip${state.assetCoverage.includes(item) ? " active" : ""}" data-asset="${item}">${item}</button>`).join("")}</div>
  </section>
  <section class="mdoc-form-section"><h3>Detected Symbols</h3>
    <div class="mdoc-symbol-list">${symbols.length ? symbols.map((symbol) => `<span>${esc(symbol)}</span>`).join("") : "<em>No symbols detected yet. Use Detect Symbols on the configuration step.</em>"}</div>
    <label class="mdoc-span-2">Supported Symbols<textarea name="supportedSymbols">${esc(symbols.join(", "))}</textarea></label>
  </section>
  <div class="mdoc-wizard-actions"><button type="button" class="mdoc-button secondary" data-action="preview-coverage">Preview Coverage</button></div>`;
}

function renderTestStep(state) {
  const result = state.testResult;
  const diagnostics = result?.diagnostics?.checks || [];
  return `<section class="mdoc-form-section"><h3>Connection Testing</h3>
    <p class="mdoc-help">Run a connection test before registering the provider. MT5 terminals are validated for account, server, symbols, and live pricing.</p>
    <div class="mdoc-wizard-actions">
      <button type="button" class="mdoc-button secondary" data-action="validate-config">Validate Configuration</button>
      <button type="button" class="mdoc-button primary" data-action="test-connection">Test Connection</button>
    </div>
    ${result ? `<div class="mdoc-test-banner ${result.result === "PASS" ? "success" : result.result === "WARNING" ? "" : "danger"}">
      <strong>${esc(result.result || result.status)} — ${esc(result.message)}</strong>
      <span>Latency ${result.latency_ms ?? 0}ms · Health ${result.provider_health ?? 0}% · Symbols ${result.symbols_found ?? 0}</span>
      ${diagnostics.length ? `<ul class="mdoc-diagnostics">${diagnostics.map((item) => `<li class="${esc(item.status.toLowerCase())}">${esc(item.label)}: ${esc(item.status)}</li>`).join("")}</ul>` : ""}
    </div>` : ""}
  </section>`;
}

function renderRegisterStep(state, catalog) {
  return `<section class="mdoc-review">
    <h3>Review &amp; Register</h3>
    <dl>
      <div><dt>Category</dt><dd>${esc(state.category?.replaceAll("_", " ") || "—")}</dd></div>
      <div><dt>Provider</dt><dd>${esc(state.name || state.providerName || "—")}</dd></div>
      <div><dt>Environment</dt><dd>${esc(state.environment)}</dd></div>
      <div><dt>Symbols</dt><dd>${esc(String(state.supportedSymbols?.length || state.detectedSymbols?.length || 0))} configured</dd></div>
      <div><dt>Connection Test</dt><dd>${state.testPassed ? "Passed" : "Not completed"}</dd></div>
    </dl>
    <section class="mdoc-form-section"><h3>Workflow Integration</h3>
      <div class="mdoc-workflow compact">${catalog.workflowCards.map((item) => `<article><strong>${esc(item.card)}</strong><span>${esc(item.target)}</span></article>`).join("")}</div>
    </section>
  </section>`;
}

function renderStepContent(state, catalog) {
  if (state.step === 1) return `<h3>What type of market data source are you adding?</h3>${renderCategoryCards(catalog)}`;
  if (state.step === 2) {
    if (state.category === "custom_provider") return `<p>Proceeding to advanced configuration.</p>`;
    return `<h3>Select your provider</h3>${renderProviderCards(state.category, catalog)}`;
  }
  if (state.step === 3) {
    let form = "";
    if (state.category === "mt5_terminal") form = renderMt5Form(state);
    else if (state.category === "external_vendor" || state.category === "broker_feed") form = renderVendorForm(state);
    else form = `<div class="mdoc-form-grid"><label>Provider Name<input name="name" value="${esc(state.name)}" required /></label><label>Environment<select name="environment"><option>Production</option><option>Testing</option></select></label></div>`;
    if (state.category === "custom_provider" || state.providerTemplateId?.includes("custom")) form += renderAdvancedForm(state, catalog);
    return `<h3>Provider configuration</h3>${form}`;
  }
  if (state.step === 4) return renderCoverageStep(state, catalog);
  if (state.step === 5) return renderTestStep(state);
  if (state.step === 6) return renderRegisterStep(state, catalog);
  return "";
}

export function renderProviderWizardModal(state, catalog) {
  const showBack = state.step > 1;
  const isLast = state.step === 6;
  const nextLabel = state.step === 1 ? "Continue" : state.step === 5 ? "Review" : state.step === 6 ? "Register Provider" : "Next";
  return `<div class="mdoc-modal-backdrop" id="mdoc-add-modal">
    <section class="mdoc-modal mdoc-add-provider-modal mdoc-wizard-modal">
      <header class="mdoc-modal-header"><div><p class="eyebrow">MARKET DATA ONBOARDING WIZARD</p><h2>Add Market Data Provider</h2><p class="subtitle">Guided onboarding for MT5 terminals, broker feeds, and market data vendors.</p></div><button type="button" class="mdoc-icon-button" data-action="close-modal">×</button></header>
      ${renderStepIndicator(state.step)}
      <p class="mdoc-error" id="mdoc-modal-error" hidden></p>
      <div class="mdoc-test-banner" id="mdoc-modal-banner" hidden></div>
      <form id="mdoc-add-form" class="mdoc-add-provider-form mdoc-wizard-body">${renderStepContent(state, catalog)}</form>
      <footer class="mdoc-modal-footer mdoc-wizard-footer">
        <button type="button" class="mdoc-button secondary" data-action="close-modal">Cancel</button>
        ${showBack ? `<button type="button" class="mdoc-button secondary" data-action="wizard-back">Back</button>` : ""}
        <button type="button" class="mdoc-button secondary" data-action="save-draft">Save Draft</button>
        <button type="button" class="mdoc-button primary mdoc-add-provider-btn" data-action="${isLast ? "register-provider" : "wizard-next"}">${nextLabel}</button>
      </footer>
    </section>
  </div>`;
}

export function readWizardForm(modal, state) {
  const form = modal.querySelector("#mdoc-add-form");
  if (!form) return state;
  const data = new FormData(form);
  const next = { ...state };
  for (const key of ["name", "brokerName", "terminalName", "accountNumber", "serverName", "environment", "terminalLocation", "apiKey", "baseUrl", "websocketUrl", "port", "authType", "vaultSecretRef"]) {
    const value = data.get(key);
    if (value != null) next[key] = String(value);
  }
  next.enabled = form.querySelector('[name="enabled"]')?.checked !== false;
  next.assetCoverage = [...form.querySelectorAll(".mdoc-chip.active")].map((chip) => chip.dataset.asset);
  next.supportedSymbols = String(data.get("supportedSymbols") || "").split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
  return next;
}

export function buildWizardPayload(state) {
  return {
    wizardCategory: state.category,
    category: state.category,
    providerTemplateId: state.providerTemplateId,
    vendorKey: state.vendorKey,
    name: state.name || state.providerName,
    brokerName: state.brokerName,
    terminalName: state.terminalName,
    accountNumber: state.accountNumber,
    serverName: state.serverName,
    environment: state.environment,
    terminalLocation: state.terminalLocation,
    terminalId: state.terminalId,
    dataPath: state.dataPath,
    buildVersion: state.buildVersion,
    apiKey: state.apiKey,
    enabled: state.enabled,
    assetCoverage: state.assetCoverage,
    supportedSymbols: state.supportedSymbols.length ? state.supportedSymbols : state.detectedSymbols,
    baseUrl: state.baseUrl,
    websocketUrl: state.websocketUrl,
    port: state.port,
    authType: state.authType,
    vaultSecretRef: state.vaultSecretRef
  };
}
