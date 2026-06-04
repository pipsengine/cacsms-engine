import { toast } from "./market-intelligence-actions.js";

const API = `${location.protocol}//${location.hostname}:8080`;
let pfState = { data: null, loading: true };
let pfRefreshTimer = null;
let pfClickBound = false;
const PF_REFRESH_MS = 30000;

const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

function t(heads, rows) {
  return `<div class="pf-table"><table><thead><tr>${heads.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function flag(level) {
  const cls = String(level || "")
    .toLowerCase()
    .replace(/\s+/g, "-");
  return `<b class="pf-flag ${cls}">${esc(level)}</b>`;
}

function fmtMoney(n) {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fmtPct(n) {
  if (n == null) return "—";
  return `${Number(n).toFixed(1)}%`;
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.error || res.statusText);
  return body;
}

function productionBanner(meta = {}) {
  const lastSync = meta.lastSync
    ? new Date(meta.lastSync).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) + " WAT"
    : "—";
  return `<section class="pf-status-strip">
    <article><small>Data Mode</small><strong>Production Live</strong></article>
    <article><small>Mock Data</small><strong>Disabled</strong></article>
    <article><small>Database Status</small><strong>${esc(meta.databaseStatus || "—")}</strong></article>
    <article><small>Last Sync</small><strong>${esc(lastSync)}</strong></article>
    <article><small>Records Loaded</small><strong>${esc(meta.recordsLoaded ?? 0)}</strong></article>
  </section>`;
}

function emptyState() {
  return `<section class="pf-card pf-empty-main">
    <h2>No prop firm rules configured yet.</h2>
    <p>Add a prop firm manually, import official rule documents, or connect an approved rule source to begin monitoring compliance.</p>
    <div class="pf-actions">
      <button type="button" class="primary" data-pf-action="add-firm">Add Prop Firm</button>
      <button type="button" data-pf-action="import-rules">Import Rule Document</button>
      <button type="button" data-pf-action="configure-source">Configure Rule Source</button>
      <button type="button" data-pf-action="setup-guide">View Setup Guide</button>
    </div>
  </section>`;
}

function summaryCards(summary = {}) {
  const items = [
    ["Total Prop Firms", summary.totalPropFirms ?? 0, "in catalog", "blue"],
    ["Active Accounts", summary.activeAccounts ?? 0, "linked compliance", "green"],
    ["Accounts Near Breach", summary.accountsNearBreach ?? 0, "elevated utilization", "amber"],
    ["Breached Accounts", summary.breachedAccounts ?? 0, "hard violations", summary.breachedAccounts ? "amber" : "green"],
    ["Avg Daily Loss Limit", summary.averageDailyLossLimit != null ? `${summary.averageDailyLossLimit}%` : "—", "policy average", "blue"],
    ["Avg Max Drawdown", summary.averageMaxDrawdown != null ? `${summary.averageMaxDrawdown}%` : "—", "policy average", "blue"],
    ["Min Trading Days", summary.minimumTradingDays ?? "—", "typical requirement", "purple"],
    ["Open Alerts", summary.openBreachAlerts ?? 0, "breach panel", "purple"]
  ];
  return `<section class="pf-metrics">${items.map(([a, b, c, d]) => `<article class="${d}"><small>${esc(a)}</small><strong>${esc(b)}</strong><span>${esc(c)}</span></article>`).join("")}</section>`;
}

function rulesTable(rules = []) {
  if (!rules.length) return "";
  const rows = rules.map((r, i) => [
    esc(r.firmName),
    fmtMoney(r.accountSize),
    esc(r.phase),
    r.profitTargetPercent != null ? fmtPct(r.profitTargetPercent) : "—",
    fmtPct(r.dailyLossLimitPercent),
    fmtPct(r.maxDrawdownPercent),
    esc(r.minTradingDays ?? "—"),
    esc(r.maxTradingDays ?? "—"),
    r.newsTradingAllowed ? "Allowed" : "Restricted",
    r.weekendHoldingAllowed ? "Allowed" : "Restricted",
    r.eaAllowed ? "Yes" : "No",
    r.copyTradingAllowed ? "Yes" : "No",
    r.payoutSplitPercent != null ? fmtPct(r.payoutSplitPercent) : "—",
    esc(r.payoutCycle || "—"),
    esc(r.status),
    `<button type="button" data-pf-rule="${i}">View Details</button>`
  ]);
  return `<section class="pf-card"><div class="pf-title"><div><h2>Prop Firm Rules Table</h2><p>Program-specific challenge, drawdown, trading and payout requirements from production storage.</p></div><b>${rules.length} RULE SETS</b></div>${t(["Prop Firm", "Account Size", "Phase", "Profit Target", "Daily Loss", "Max Drawdown", "Min Days", "Max Days", "News", "Weekend", "EA", "Copy", "Payout Split", "Cycle", "Status", "Details"], rows)}</section>`;
}

function comparisonSection(matrix = []) {
  if (!matrix.length) return "";
  return `<section class="pf-card"><div class="pf-title"><div><h2>Rule Comparison Matrix</h2><p>Side-by-side analytics from stored firm programs.</p></div><b>LIVE DATA</b></div>${t(["Firm", "Challenge Fee", "Profit Target", "Daily Drawdown", "Overall Drawdown", "Scaling", "Payout Split", "Refund", "News", "Weekend", "Consistency", "Leverage", "Instruments"], matrix.map((row) => row.map((c) => esc(c))))}</section>`;
}

function complianceSection(accounts = [], message) {
  if (message) {
    return `<section class="pf-card pf-empty-panel"><div class="pf-title"><div><h2>Account Compliance Monitor</h2><p>${esc(message)}</p></div></div></section>`;
  }
  if (!accounts.length) {
    return `<section class="pf-card pf-empty-panel"><div class="pf-title"><div><h2>Account Compliance Monitor</h2><p>No prop firm account connected. Connect an account to begin real-time rule compliance monitoring.</p></div><b>0 ACCOUNTS</b></div></section>`;
  }
  const rows = accounts.map((a) => [
    esc(a.accountName),
    esc(a.firmName),
    fmtMoney(a.balance),
    fmtMoney(a.equity),
    a.dailyLossUsedPercent != null ? fmtPct(a.dailyLossUsedPercent) : "—",
    a.maxDrawdownUsedPercent != null ? fmtPct(a.maxDrawdownUsedPercent) : "—",
    a.profitTargetProgressPercent != null ? fmtPct(a.profitTargetProgressPercent) : "—",
    esc(a.minimumDaysCompleted ?? "—"),
    flag(a.breachRisk),
    flag(a.status)
  ]);
  const atRisk = accounts.filter((a) => a.status === "At Risk").length;
  return `<section class="pf-card"><div class="pf-title"><div><h2>Account Compliance Monitor</h2><p>Connected accounts with utilization from live MT5 snapshots and stored rule limits.</p></div><b>${atRisk ? `${atRisk} AT RISK` : `${accounts.length} MONITORED`}</b></div>${t(["Account", "Firm", "Balance", "Equity", "Daily Loss Used", "Max DD Used", "Profit Progress", "Min Days", "Breach Risk", "Status"], rows)}</section>`;
}

function breachSection(alerts = [], message) {
  if (message) {
    return `<section class="pf-card pf-empty-panel"><div class="pf-title"><div><h2>Breach Risk Panel</h2><p>${esc(message)}</p></div></div></section>`;
  }
  if (!alerts.length) {
    return `<section class="pf-card pf-empty-panel"><div class="pf-title"><div><h2>Breach Risk Panel</h2><p>No active breach alerts from connected accounts.</p></div><b>CLEAR</b></div></section>`;
  }
  const rows = alerts.map((row) => {
    const [alert, severity, account, state, action] = row;
    return [esc(alert), flag(severity), esc(account), esc(state), esc(action)];
  });
  return `<section class="pf-card"><div class="pf-title"><div><h2>Breach Risk Panel</h2><p>Alerts derived from live account utilization and stored rule thresholds.</p></div><b>${alerts.length} ALERTS</b></div>${t(["Alert", "Severity", "Account", "Current State", "Required Action"], rows)}</section>`;
}

function sourcesSection(sources = []) {
  if (!sources.length) {
    return `<section class="pf-card pf-empty-panel"><div class="pf-title"><div><h2>Source Configuration</h2><p>No rule sources configured. Add an official website, document URL, or partner API endpoint.</p></div></div><div class="pf-actions"><button type="button" class="primary" data-pf-action="configure-source">Configure Rule Source</button></div></section>`;
  }
  const rows = sources.map((s) => [
    esc(s.sourceName),
    esc(s.sourceType),
    esc(s.endpointUrl || "—"),
    esc(s.authenticationType || "—"),
    esc(s.syncFrequency || "—"),
    s.lastSync ? esc(new Date(s.lastSync).toLocaleString()) : "—",
    flag(s.healthStatus),
    s.approvalRequired ? "Yes" : "No"
  ]);
  return `<section class="pf-card"><div class="pf-title"><div><h2>Source Configuration</h2><p>Approved ingestion endpoints and sync health.</p></div><b>${sources.length} SOURCES</b></div>${t(["Source", "Type", "URL / Endpoint", "Auth", "Sync Frequency", "Last Sync", "Health", "Approval Required"], rows)}</section>`;
}

function auditSection(logs = []) {
  if (!logs.length) {
    return `<section class="pf-card pf-empty-panel"><div class="pf-title"><div><h2>Audit Logs</h2><p>Changes to firms, rules, imports, and sync operations are recorded here.</p></div></div></section>`;
  }
  const rows = logs.slice(0, 15).map((l) => [
    esc(l.user),
    l.timestamp ? esc(new Date(l.timestamp).toLocaleString()) : "—",
    esc(l.action),
    esc(l.entity),
    esc(l.reason || "—")
  ]);
  return `<section class="pf-card"><div class="pf-title"><div><h2>Audit Logs</h2><p>Production change history.</p></div><b>${logs.length} ENTRIES</b></div>${t(["User", "Timestamp", "Action", "Entity", "Reason"], rows)}</section>`;
}

function addFirmModal() {
  return `<dialog id="pf-add-firm-modal" class="pf-modal">
    <form method="dialog" id="pf-add-firm-form">
      <header><h2>Add Prop Firm</h2><button type="button" data-pf-close-modal>×</button></header>
      <fieldset><legend>Basic Information</legend>
        <label>Firm Name<input name="firmName" required /></label>
        <label>Website<input name="website" type="url" /></label>
        <label>Country / Region<input name="country" /></label>
        <label>Supported Platforms<input name="supportedPlatforms" /></label>
        <label>Status<select name="firmStatus"><option>Draft</option><option>Active</option></select></label>
      </fieldset>
      <fieldset><legend>Account Program</legend>
        <label>Program Name<input name="programName" required /></label>
        <label>Account Size<input name="accountSize" type="number" min="1" required /></label>
        <label>Currency<input name="currency" value="USD" /></label>
        <label>Phase<select name="phase"><option>Phase 1</option><option>Phase 2</option><option>Verification</option><option>Funded</option><option>Evaluation</option><option>Challenge</option></select></label>
        <label>Account Type<select name="accountType"><option>Challenge</option><option>Evaluation</option><option>Funded</option></select></label>
        <label>Challenge Fee<input name="challengeFee" type="number" min="0" step="0.01" /></label>
      </fieldset>
      <fieldset><legend>Trading Rules</legend>
        <label>Profit Target %<input name="profitTargetPercent" type="number" min="0" step="0.1" /></label>
        <label>Daily Loss Limit %<input name="dailyLossLimitPercent" type="number" min="0" step="0.1" required /></label>
        <label>Max Drawdown %<input name="maxDrawdownPercent" type="number" min="0" step="0.1" required /></label>
        <label>Drawdown Type<input name="drawdownType" placeholder="Balance / Equity" /></label>
        <label>Minimum Trading Days<input name="minTradingDays" type="number" min="0" /></label>
        <label>Maximum Trading Days<input name="maxTradingDays" type="number" min="0" /></label>
        <label>Leverage<input name="leverage" placeholder="1:100" /></label>
      </fieldset>
      <fieldset><legend>Payout Rules</legend>
        <label>Payout Split %<input name="payoutSplitPercent" type="number" min="0" max="100" /></label>
        <label>Payout Cycle<input name="payoutCycle" placeholder="14 days" /></label>
      </fieldset>
      <footer class="pf-actions">
        <button type="button" data-pf-save="draft">Save Draft</button>
        <button type="button" data-pf-save="validate">Validate Rules</button>
        <button type="submit" class="primary" data-pf-save="activate">Save and Activate</button>
        <button type="button" data-pf-close-modal>Cancel</button>
      </footer>
    </form>
  </dialog>`;
}

function importModal() {
  return `<dialog id="pf-import-modal" class="pf-modal">
    <form method="dialog" id="pf-import-form">
      <header><h2>Import Rule Document</h2><button type="button" data-pf-close-modal>×</button></header>
      <p>Imports are stored as <strong>Pending Review</strong> until approved.</p>
      <label>Source Type<select name="sourceType"><option>pdf</option><option>docx</option><option>csv</option><option>xlsx</option><option>url</option><option>manual</option></select></label>
      <label>File / URL / Paste<textarea name="sourceLabel" rows="4" placeholder="Paste rules or enter document URL"></textarea></label>
      <footer class="pf-actions">
        <button type="submit" class="primary">Submit Import</button>
        <button type="button" data-pf-close-modal>Cancel</button>
      </footer>
    </form>
  </dialog>`;
}

function sourceModal() {
  return `<dialog id="pf-source-modal" class="pf-modal">
    <form method="dialog" id="pf-source-form">
      <header><h2>Configure Rule Source</h2><button type="button" data-pf-close-modal>×</button></header>
      <label>Source Name<input name="sourceName" required /></label>
      <label>Source Type<select name="sourceType"><option>official_website</option><option>rule_document_url</option><option>admin_database</option><option>manual_database</option><option>partner_api</option><option>webhook</option></select></label>
      <label>URL / Endpoint<input name="endpointUrl" type="url" /></label>
      <label>Authentication Type<select name="authenticationType"><option>none</option><option>api_key</option><option>bearer</option><option>basic</option></select></label>
      <label>Sync Frequency<select name="syncFrequency"><option>manual</option><option>hourly</option><option>daily</option><option>weekly</option></select></label>
      <footer class="pf-actions">
        <button type="submit" class="primary">Save Source</button>
        <button type="button" data-pf-close-modal>Cancel</button>
      </footer>
    </form>
  </dialog>`;
}

export function renderPropFirmRulesCenter() {
  const d = pfState.data;
  if (pfState.loading && !d) {
    return `<section class="pf-dashboard"><header class="pf-header"><div><p>03 / MARKET INTELLIGENCE / PROP FIRM RULES</p><h1>Prop Firm Rules</h1><span>Loading production rule catalog…</span></div></header><section class="pf-card"><p>Loading prop firm rules and compliance status…</p></section></section>`;
  }

  const meta = d?.meta || {};
  const empty = d?.empty;
  const body = empty
    ? emptyState()
    : `${summaryCards(d.summary)}${rulesTable(d.rules)}${comparisonSection(d.comparison)}${complianceSection(d.compliance, d.complianceMessage)}${breachSection(d.breachAlerts, d.breachMessage)}${sourcesSection(d.sources)}${auditSection(d.auditLogs)}`;

  return `<section class="pf-dashboard" id="pf-root">
    <header class="pf-header">
      <div><p>03 / MARKET INTELLIGENCE / PROP FIRM RULES</p><h1>Prop Firm Rules</h1><span>Production rule catalog, compliance monitoring, and breach alerts — no mock data.</span></div>
      <aside><b>DATA / PRODUCTION LIVE</b><b>MOCK / DISABLED</b><b>RECORDS / ${esc(meta.recordsLoaded ?? 0)}</b><small>DB / ${esc(meta.databaseStatus || "—")}</small></aside>
    </header>
    ${productionBanner(meta)}
    <div class="pf-actions">
      <button type="button" class="primary" data-pf-action="add-firm">Add Prop Firm</button>
      <button type="button" data-pf-action="import-rules">Import Rule Document</button>
      <button type="button" data-pf-action="sync-rules">Sync Rules</button>
      <button type="button" data-pf-action="refresh">Refresh</button>
    </div>
    ${body}
    ${addFirmModal()}${importModal()}${sourceModal()}
  </section>`;
}

function readForm(form) {
  const fd = new FormData(form);
  const o = {};
  for (const [k, v] of fd.entries()) {
    if (v === "") continue;
    const n = Number(v);
    o[k] = v !== "" && !Number.isNaN(n) && form.elements[k]?.type === "number" ? n : v;
  }
  return o;
}

async function loadDashboard() {
  pfState.loading = true;
  paint();
  try {
    const data = await api("/api/market-intelligence/prop-firm-rules");
    pfState.data = data;
    pfState.loading = false;
  } catch (error) {
    pfState.loading = false;
    pfState.data = {
      empty: true,
      meta: { databaseStatus: "Error", recordsLoaded: 0 },
      error: error.message
    };
    toast(`Prop firm rules: ${error.message}`, "error");
  }
  paint();
}

function paint() {
  const root = document.querySelector("#intelligence-content");
  if (!root) return;
  root.innerHTML = renderPropFirmRulesCenter();
  bindPropFirmRulesCenter();
}

function openModal(id) {
  document.getElementById(id)?.showModal?.();
}

function closeModals() {
  document.querySelectorAll(".pf-modal").forEach((m) => m.close());
}

async function handleImportSubmit(e) {
  e.preventDefault();
  const payload = readForm(e.target);
  try {
    await api("/api/market-intelligence/prop-firm-rules/import", {
      method: "POST",
      body: JSON.stringify({
        sourceType: payload.sourceType,
        sourceLabel: payload.sourceLabel,
        extracted: { rawText: payload.sourceLabel }
      })
    });
    closeModals();
    toast("Import queued — Pending Review");
    await loadDashboard();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function handleSourceSubmit(e) {
  e.preventDefault();
  const payload = readForm(e.target);
  try {
    await api("/api/market-intelligence/prop-firm-rules/sources", { method: "POST", body: JSON.stringify(payload) });
    closeModals();
    toast("Source configured");
    await loadDashboard();
  } catch (err) {
    toast(err.message, "error");
  }
}

export function bindPropFirmRulesCenter() {
  if (pfClickBound) return;
  pfClickBound = true;

  document.addEventListener("submit", (event) => {
    if (!location.pathname.includes("prop-firm-rules")) return;
    if (event.target.id === "pf-import-form") handleImportSubmit(event);
    if (event.target.id === "pf-source-form") handleSourceSubmit(event);
  });

  document.addEventListener("click", async (event) => {
    if (!location.pathname.includes("prop-firm-rules")) return;
    const btn = event.target.closest("[data-pf-action],[data-pf-save],[data-pf-close-modal],[data-pf-rule]");
    if (!btn) return;

    if (btn.dataset.pfCloseModal != null) {
      closeModals();
      return;
    }

    const action = btn.dataset.pfAction;
    if (action === "add-firm" || action === "setup-guide") {
      if (action === "setup-guide") {
        window.dispatchEvent(new CustomEvent("mi:navigate", { detail: { route: "/workspace/market-intelligence/source-configuration" } }));
        return;
      }
      openModal("pf-add-firm-modal");
      return;
    }
    if (action === "import-rules") {
      openModal("pf-import-modal");
      return;
    }
    if (action === "configure-source") {
      openModal("pf-source-modal");
      return;
    }
    if (action === "sync-rules" || action === "refresh") {
      try {
        if (action === "sync-rules") await api("/api/market-intelligence/prop-firm-rules/sync", { method: "POST" });
        await loadDashboard();
        toast(action === "sync-rules" ? "Rule sources synced" : "Dashboard refreshed");
      } catch (e) {
        toast(e.message, "error");
      }
      return;
    }

    if (btn.dataset.pfSave) {
      event.preventDefault();
      const form = document.getElementById("pf-add-firm-form");
      const payload = readForm(form);
      if (btn.dataset.pfSave === "validate") {
        try {
          const v = await api("/api/market-intelligence/prop-firm-rules/validate", {
            method: "POST",
            body: JSON.stringify({ ...payload, activate: true })
          });
          toast(v.valid ? "Validation passed" : `Validation failed: ${(v.errors || []).join(", ")}`, v.valid ? "ok" : "error");
        } catch (e) {
          toast(e.message, "error");
        }
        return;
      }
      payload.activate = btn.dataset.pfSave === "activate";
      payload.status = payload.activate ? "Active" : "Draft";
      try {
        await api("/api/market-intelligence/prop-firm-rules", { method: "POST", body: JSON.stringify(payload) });
        closeModals();
        await loadDashboard();
        toast(payload.activate ? "Firm rule activated" : "Draft saved");
      } catch (e) {
        toast(e.message, "error");
      }
      return;
    }

    if (btn.dataset.pfRule != null) {
      const rule = pfState.data?.rules?.[Number(btn.dataset.pfRule)];
      if (!rule) return;
      toast(`${rule.firmName} — ${rule.programName} (${rule.status})`);
    }
  });
}

export function mountPropFirmRulesCenter() {
  document.querySelector(".intelligence-header")?.remove();
  pfClickBound = false;
  loadDashboard();
  if (pfRefreshTimer) clearInterval(pfRefreshTimer);
  pfRefreshTimer = setInterval(() => {
    if (location.pathname.includes("prop-firm-rules")) loadDashboard();
  }, PF_REFRESH_MS);
}

export function unmountPropFirmRulesCenter() {
  if (pfRefreshTimer) {
    clearInterval(pfRefreshTimer);
    pfRefreshTimer = null;
  }
}
