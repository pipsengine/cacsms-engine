const API = "http://localhost:8080";
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const table = (headers, rows) => `<div class="mdoc-table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No records</td></tr>`}</tbody></table></div>`;

let dashboardState = null;

async function request(path, init = {}) {
  const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, cache: "no-store", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ? String(payload.error).replaceAll("_", " ") : `Request failed (${response.status})`);
  return payload;
}

async function loadDashboard() {
  return request("/api/mt5/ea-deployments");
}

function renderPage(data) {
  const machines = data.machines || [];
  const terminals = data.terminals || [];
  const discovered = data.discovered || [];
  const machineOptions = machines.map((row) => `<option value="${esc(row.id)}">${esc(row.name)} (${esc(row.status)})</option>`).join("");
  const terminalOptions = terminals.map((row) => `<option value="${esc(row.id)}" data-machine-id="${esc(row.machineId || "")}">${esc(row.terminalName)}${row.eaVersion ? ` — v${esc(row.eaVersion)}` : ""}</option>`).join("");
  const discoveredHtml = discovered.length
    ? `<ul class="mdoc-list">${discovered.map((row) => `<li><strong>${esc(row.terminalInstallId)}</strong> — ${esc(row.dataPath)}</li>`).join("")}</ul>`
    : `<p class="mdoc-help">No local MT5 terminals detected. Install MT5 on this machine or run the machine agent on the trading VPS.</p>`;

  return `<section class="mdoc-dashboard" id="ea-deploy-root">
    <header class="mdoc-header"><div><p class="eyebrow">MT5 INFRASTRUCTURE / EA DEPLOYMENTS</p><h1>EA Deployment Center</h1><p class="subtitle">Deploy, verify, update, and rollback the CACSMS EA automatically — no manual folder copying required.</p><div class="mdoc-badges"><span><small>Active EA Version</small><strong>${esc(data.activeVersion || "1.0.0")}</strong></span><span><small>Discovered Terminals</small><strong>${discovered.length}</strong></span><span><small>Deployments</small><strong>${(data.deployments || []).length}</strong></span></div></div><div class="mdoc-header-actions"><button class="mdoc-button secondary" data-action="refresh">Refresh</button><a class="mdoc-button secondary" href="/workspace/market-intelligence/market-data">Market Data Providers</a></div></header>

    <section class="mdoc-panel mdoc-setup-cta"><div class="mdoc-panel-head"><h2>Automatic EA Deployment</h2><b>ONE CLICK</b></div>
      <p>The machine agent detects MT5 data folders, syncs EA files, verifies checksums, and reports deployment status back to CACSMS Engine.</p>
      <div class="mdoc-form-grid">
        <label>Machine<select id="ea-machine">${machineOptions || `<option value="">No machines registered</option>`}</select></label>
        <label>MT5 Terminal<select id="ea-terminal">${terminalOptions || `<option value="">Register a terminal first</option>`}</select></label>
      </div>
      <div class="mdoc-header-actions">
        <button class="mdoc-button primary" data-action="deploy-ea">Deploy EA</button>
        <button class="mdoc-button secondary" data-action="update-ea">Update EA</button>
        <button class="mdoc-button secondary" data-action="verify-ea">Verify EA</button>
        <button class="mdoc-button secondary" data-action="rollback-ea">Rollback EA</button>
        <button class="mdoc-button secondary" data-action="discover-paths">Detect MT5 Paths</button>
      </div>
    </section>

    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Detected MT5 Data Folders</h2><b>${discovered.length} FOUND</b></div>${discoveredHtml}</section>

    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Deployment History</h2><b>${(data.deployments || []).length} RECORDS</b></div>
      ${table(["Terminal","Machine","Version","Status","Navigator","Checksum","Started","Completed","Error"], (data.deployments || []).map((row) => [
        esc(row.terminalName || "—"),
        esc(row.machineName || "—"),
        esc(row.eaVersion || "—"),
        `<b class="mdoc-state ${esc(String(row.status).toLowerCase())}">${esc(row.status)}</b>`,
        row.navigatorVerified ? "Yes" : "No",
        row.checksumVerified ? "Yes" : "No",
        row.startedAt ? esc(new Date(row.startedAt).toLocaleString()) : "—",
        row.completedAt ? esc(new Date(row.completedAt).toLocaleString()) : "—",
        esc(row.errorMessage || "—")
      ]))}
    </section>

    <section class="mdoc-panel" id="ea-deploy-logs"><div class="mdoc-panel-head"><h2>Deployment Logs</h2><b>${(data.logs || []).length} EVENTS</b></div>
      ${table(["Time","Terminal","Level","Message"], (data.logs || []).map((row) => [
        row.createdAt ? esc(new Date(row.createdAt).toLocaleString()) : "—",
        esc(row.terminalName || "—"),
        esc(String(row.level || "info").toUpperCase()),
        esc(row.message)
      ]))}
    </section>
  </section>`;
}

function selectedContext() {
  const machineSelect = document.querySelector("#ea-machine");
  const terminalSelect = document.querySelector("#ea-terminal");
  const terminalId = terminalSelect?.value;
  const machineId = machineSelect?.value || terminalSelect?.selectedOptions?.[0]?.dataset?.machineId || "";
  if (!terminalId) throw new Error("Select an MT5 terminal first.");
  return { terminalId, machineId };
}

async function runAction(action) {
  const body = selectedContext();
  const payload = await request(`/api/mt5/ea/${action}`, { method: "POST", body: JSON.stringify(body) });
  const status = payload.deployment?.status || payload.status || "completed";
  alert(`EA ${action} finished with status: ${status}`);
  await mountEaDeploymentsPage();
}

function bindPage() {
  document.querySelector('[data-action="refresh"]')?.addEventListener("click", mountEaDeploymentsPage);
  document.querySelector('[data-action="deploy-ea"]')?.addEventListener("click", () => runAction("deploy").catch((error) => alert(error.message)));
  document.querySelector('[data-action="update-ea"]')?.addEventListener("click", () => runAction("update").catch((error) => alert(error.message)));
  document.querySelector('[data-action="verify-ea"]')?.addEventListener("click", () => runAction("verify").catch((error) => alert(error.message)));
  document.querySelector('[data-action="rollback-ea"]')?.addEventListener("click", () => runAction("rollback").catch((error) => alert(error.message)));
  document.querySelector('[data-action="discover-paths"]')?.addEventListener("click", async () => {
    try {
      const body = selectedContext();
      await request("/api/mt5/ea/discover", { method: "POST", body: JSON.stringify(body) });
      await mountEaDeploymentsPage();
    } catch (error) {
      alert(error.message);
    }
  });

  const machineSelect = document.querySelector("#ea-machine");
  const terminalSelect = document.querySelector("#ea-terminal");
  terminalSelect?.addEventListener("change", () => {
    const machineId = terminalSelect.selectedOptions?.[0]?.dataset?.machineId;
    if (machineId && machineSelect) machineSelect.value = machineId;
  });
}

export async function mountEaDeploymentsPage() {
  const root = document.querySelector("#intelligence-content");
  try {
    dashboardState = await loadDashboard();
    root.innerHTML = renderPage(dashboardState);
    bindPage();
  } catch (error) {
    root.innerHTML = `<section class="mdoc-panel"><h1>EA Deployment Center</h1><p>${esc(error.message)}</p><button class="mdoc-button primary" id="ea-retry">Retry</button></section>`;
    document.querySelector("#ea-retry")?.addEventListener("click", mountEaDeploymentsPage);
  }
}
