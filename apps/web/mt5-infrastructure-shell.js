import { initEnterpriseSidebar } from "./enterprise-sidebar.js";
import { mountEaDeploymentsPage } from "./ea-deployments-page.js";

const API = "http://localhost:8080";
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const table = (headers, rows) => `<div class="mdoc-table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No records</td></tr>`}</tbody></table></div>`;

async function request(path) {
  const response = await fetch(`${API}${path}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ? String(payload.error).replaceAll("_", " ") : `Request failed (${response.status})`);
  return payload;
}

function renderAgentDownloads() {
  return `<section class="mdoc-dashboard">
    <header class="mdoc-header"><div><p class="eyebrow">MT5 INFRASTRUCTURE / AGENT DOWNLOADS</p><h1>MT5 Agent Download Center</h1><p class="subtitle">Install the Windows agent, EA, and connector package to connect MT5 terminals.</p></div></header>
    <section class="mdoc-panel mdoc-setup-cta"><div class="mdoc-panel-head"><h2>Automatic Deployment</h2><b>RECOMMENDED</b></div><p>Use the EA Deployment Center to sync files into MT5 automatically. Manual copying is no longer required.</p><a class="mdoc-button primary" href="/workspace/mt5-infrastructure/ea-deployments">Open EA Deployment Center</a></section>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Downloads</h2><b>INSTALL PACKAGES</b></div><div class="mdoc-action-grid">
      <article class="mdoc-download-card"><h3>Windows Agent</h3><p>CACSMS machine agent for terminal discovery and heartbeat relay.</p><button class="mdoc-button secondary" disabled>Download v1.0.0</button></article>
      <article class="mdoc-download-card"><h3>MT5 EA</h3><p>CACSMS Expert Advisor for live price streaming and registration.</p><button class="mdoc-button secondary" disabled>Download v1.0.0</button></article>
      <article class="mdoc-download-card"><h3>MT5 Connector Package</h3><p>Combined agent, EA, and configuration templates.</p><button class="mdoc-button secondary" disabled>Download Bundle</button></article>
    </div></section>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Configuration Templates</h2></div><ul class="mdoc-list"><li>agent.config.json — machine registration</li><li>ea-registration.template.ini — token and server settings</li><li>market-watch.symbols.txt — default 20-asset universe</li></ul></section>
    <section class="mdoc-panel"><div class="mdoc-panel-head"><h2>Installation Guides</h2></div><ol class="mdoc-onboarding"><li>Install Windows Agent on the trading VPS</li><li>Copy CACSMS EA into MT5 Experts folder</li><li>Generate registration token from Market Data Providers</li><li>Attach EA to chart and enter token</li><li>Verify heartbeat in Connection Monitor</li></ol></section>
  </section>`;
}

async function renderEaDeployments() {
  await mountEaDeploymentsPage();
}

async function renderConnectionMonitor() {
  const payload = await request("/api/mt5/connection-monitor");
  const rows = (payload.connections || []).map((row) => [
    esc(row.terminal),
    `<b class="mdoc-state ${esc(String(row.connectionState).toLowerCase())}">${esc(row.connectionState)}</b>`,
    row.latency != null ? `${row.latency} ms` : "—",
    row.heartbeat ? esc(new Date(row.heartbeat).toLocaleString()) : "—",
    row.packetLoss != null ? esc(row.packetLoss) : "—",
    `<b class="mdoc-state ${esc(String(row.status).toLowerCase())}">${esc(row.status)}</b>`
  ]);
  return `<section class="mdoc-dashboard">
    <header class="mdoc-header"><div><p class="eyebrow">MT5 INFRASTRUCTURE / CONNECTION MONITOR</p><h1>Connection Monitor</h1><p class="subtitle">Real-time terminal connectivity, latency, and packet loss.</p></div><div class="mdoc-header-actions"><button class="mdoc-button secondary" id="mt5-refresh">Refresh</button></div></header>
    <section class="mdoc-panel">${table(["Terminal","Connection State","Latency","Heartbeat","Packet Loss","Status"], rows)}</section>
  </section>`;
}

export async function mountMt5InfrastructurePage(slug) {
  const root = document.querySelector("#intelligence-content");
  try {
    if (slug === "agent-downloads") root.innerHTML = renderAgentDownloads();
    else if (slug === "ea-deployments") await renderEaDeployments();
    else if (slug === "connection-monitor") root.innerHTML = await renderConnectionMonitor();
    else root.innerHTML = `<section class="mdoc-panel"><h1>MT5 Infrastructure</h1><p>Select a page from the sidebar.</p></section>`;
    document.querySelector("#mt5-refresh")?.addEventListener("click", () => mountMt5InfrastructurePage(slug));
  } catch (reason) {
    root.innerHTML = `<section class="mdoc-panel"><h1>MT5 Infrastructure</h1><p>${esc(reason.message)}</p></section>`;
  }
}

const parts = location.pathname.split("/").filter(Boolean);
const slug = parts[0] === "workspace" && parts[1] === "mt5-infrastructure" ? parts[2] : "agent-downloads";
initEnterpriseSidebar("market-nav");
document.querySelector(".intelligence-header")?.remove();
mountMt5InfrastructurePage(slug);
setInterval(() => document.querySelector("#utc-clock") && (document.querySelector("#utc-clock").textContent = `UTC ${new Date().toISOString().slice(11, 19)}`), 1000);
