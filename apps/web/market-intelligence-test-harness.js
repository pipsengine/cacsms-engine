import { initEnterpriseSidebar } from "./enterprise-sidebar.js";

const API = `${location.protocol}//${location.hostname}:8080`;
let catalog = [];
let historyRows = [];
let selectedTestId = null;

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json();
}

function fmtDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function fmtDuration(value) {
  return value === null || value === undefined ? "-" : `${Math.round(Number(value))}ms`;
}

function safetyLabel(value) {
  return String(value || "read_only").replaceAll("_", " ");
}

function statusPill(status) {
  return `<span class="th-status ${status || "skipped"}">${status || "-"}</span>`;
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function selectedSafetyMode() {
  return document.getElementById("safety-mode").value || "read_only";
}

function renderSummary(summary) {
  const cards = [
    ["Tests Run Today", summary.testsRunToday],
    ["Passed Tests", summary.passedTests],
    ["Failed Tests", summary.failedTests],
    ["Warnings", summary.warnings],
    ["Critical Failures", summary.criticalFailures],
    ["Average Test Duration", fmtDuration(summary.averageTestDuration)],
    ["Provider Tests", summary.providerTests],
    ["Sync Tests", summary.syncTests],
    ["Validation Tests", summary.validationTests],
    ["Scoring Tests", summary.scoringTests],
    ["Handoff Tests", summary.handoffTests],
    ["Last Full Diagnostic Status", summary.lastFullDiagnosticStatus || "-"]
  ];
  document.getElementById("summary-grid").innerHTML = cards.map(([label, value]) => `<article><small>${label}</small><strong>${value}</strong></article>`).join("");
  document.getElementById("last-test-run").textContent = `Last Test Run: ${fmtDate(summary.lastTestRun)}`;
}

function renderCatalog(rows = catalog) {
  const body = document.getElementById("catalog-body");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="12">No test catalog records found.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(test => `
    <tr data-test-id="${test.id}">
      <td><input type="checkbox" class="test-select" value="${test.id}"></td>
      <td><strong>${test.testName}</strong></td>
      <td>${test.category}</td>
      <td>${test.module}</td>
      <td>${test.description}</td>
      <td>${safetyLabel(test.safetyMode)}</td>
      <td>${test.requiresApproval ? "Yes" : "No"}</td>
      <td>${fmtDate(test.lastRun)}</td>
      <td>${test.lastStatus ? statusPill(test.lastStatus) : "-"}</td>
      <td>${fmtDuration(test.duration)}</td>
      <td>${test.riskLevel}</td>
      <td class="th-row-actions">
        <button data-action="run">Run</button>
        <button data-action="run-dry">Run Dry</button>
        <button data-action="view-result" ${test.lastRun ? "" : "disabled"}>View Result</button>
        <button data-action="view-logs">View Logs</button>
        <button data-action="schedule">Schedule</button>
      </td>
    </tr>
  `).join("");
}

function categoryCards(containerId, names) {
  const container = document.getElementById(containerId);
  container.innerHTML = names.map(name => {
    const test = catalog.find(item => item.testName === name || item.category.includes(name) || item.module.includes(name.toLowerCase().split(" ")[0]));
    return `<article class="th-card"><h3>${name}</h3><p>Runs against current production records using ${safetyLabel(selectedSafetyMode())}. No fabricated results are generated.</p><div class="th-card-actions"><button data-panel-run="${test?.id || ""}" ${test ? "" : "disabled"}>Run</button></div></article>`;
  }).join("");
}

function renderPanels() {
  categoryCards("provider-tests", ["Market Data Providers", "News Providers", "Economic Calendar Providers", "Social Sentiment Providers", "Broker Feeds", "Prop Firm Rule Sources", "Macro Sources", "COT Sources"]);
  categoryCards("sync-tests", ["MarketDataSyncJob", "HistoricalDataSyncJob", "BrokerDataSyncJob", "NewsSyncJob", "EconomicCalendarSyncJob", "SocialSentimentSyncJob", "COTSyncJob", "PropFirmRuleSyncJob", "SourceHealthReviewJob", "DependencyRecalculationJob"]);
  categoryCards("validation-tests", ["Duplicate detection", "Missing record detection", "Schema validation", "Timestamp validation", "OHLC validation", "Spread validation", "Package validation"]);
  categoryCards("scoring-tests", ["Input completeness", "Weight totals", "Model version status", "Score calculation range", "Conflict detection", "Opportunity ranking"]);
  categoryCards("handoff-tests", ["Package build readiness", "Package validation", "Readiness score", "Destination engine availability", "Queue availability", "Payload checksum"]);
  categoryCards("alert-tests", ["Rule evaluation", "Trigger condition", "Severity mapping", "Duplicate suppression", "Market summary", "Scoring explanation", "Handoff interpretation"]);
}

function renderHistory() {
  const body = document.getElementById("history-body");
  const empty = document.getElementById("empty-state");
  empty.classList.toggle("hidden", historyRows.length > 0);
  if (!historyRows.length) {
    body.innerHTML = `<tr><td colspan="13">No Market Intelligence tests have been run yet.</td></tr>`;
    return;
  }
  body.innerHTML = historyRows.map(row => `
    <tr>
      <td>${row.id}</td>
      <td>${row.testName}</td>
      <td>${row.category}</td>
      <td>${row.module}</td>
      <td>${safetyLabel(row.safetyMode)}</td>
      <td>${statusPill(row.status)}</td>
      <td>${row.triggeredBy || "-"}</td>
      <td>${fmtDate(row.startedAt)}</td>
      <td>${fmtDate(row.completedAt)}</td>
      <td>${fmtDuration(row.duration)}</td>
      <td>${row.failureCount}</td>
      <td>${row.warningCount}</td>
      <td class="th-row-actions"><button data-result-id="${row.id}">View Result</button><a href="/workspace/market-intelligence/logs">Logs</a></td>
    </tr>
  `).join("");
}

async function loadAll() {
  const data = await fetchJSON(`${API}/api/market-intelligence/test-harness`);
  catalog = data.catalog || [];
  historyRows = data.history || [];
  selectedTestId = selectedTestId || catalog[0]?.id || null;
  renderSummary(data.summary || {});
  renderCatalog();
  renderPanels();
  renderHistory();
}

async function runTest(testId = selectedTestId, safetyMode = selectedSafetyMode()) {
  if (!testId) return alert("Select a test first.");
  const result = await fetchJSON(`${API}/api/market-intelligence/test-harness/run`, {
    method: "POST",
    body: JSON.stringify({ testId, safetyMode })
  });
  await loadAll();
  if (result.run?.id) await openResult(result.run.id);
}

async function runSelected() {
  const testIds = [...document.querySelectorAll(".test-select:checked")].map(input => input.value);
  if (!testIds.length) return alert("Select one or more tests.");
  await fetchJSON(`${API}/api/market-intelligence/test-harness/run-selected`, {
    method: "POST",
    body: JSON.stringify({ testIds, safetyMode: selectedSafetyMode() })
  });
  await loadAll();
}

async function runDiagnostic() {
  await fetchJSON(`${API}/api/market-intelligence/test-harness/run-full-diagnostic`, {
    method: "POST",
    body: JSON.stringify({ safetyMode: selectedSafetyMode() })
  });
  await loadAll();
}

async function openResult(id) {
  const result = await fetchJSON(`${API}/api/market-intelligence/test-harness/results/${id}`);
  document.getElementById("result-content").innerHTML = `
    <div class="th-detail-grid">
      <div><small>Test ID</small><strong>${result.testId || "-"}</strong></div>
      <div><small>Test Name</small><strong>${result.testName}</strong></div>
      <div><small>Category</small><strong>${result.category}</strong></div>
      <div><small>Module</small><strong>${result.module}</strong></div>
      <div><small>Safety Mode</small><strong>${safetyLabel(result.safetyMode)}</strong></div>
      <div><small>Triggered By</small><strong>${result.triggeredBy || "-"}</strong></div>
      <div><small>Started At</small><strong>${fmtDate(result.startedAt)}</strong></div>
      <div><small>Completed At</small><strong>${fmtDate(result.completedAt)}</strong></div>
      <div><small>Duration</small><strong>${fmtDuration(result.duration)}</strong></div>
      <div><small>Status</small><strong>${result.status}</strong></div>
      <div><small>Affected Module</small><strong>${result.affectedModule || result.module}</strong></div>
      <div><small>Recommended Fix</small><strong>${result.recommendedFix || "-"}</strong></div>
    </div>
    <h3>Checks Performed</h3>
    ${(result.checksPerformed || []).map(check => `<div class="th-check">${statusPill(check.status)}<div><strong>${check.checkName}</strong><pre class="th-json">${JSON.stringify(check.details || {}, null, 2)}</pre></div></div>`).join("")}
    <h3>Expected Result</h3><pre class="th-json">${JSON.stringify(result.expectedResult || {}, null, 2)}</pre>
    <h3>Actual Result</h3><pre class="th-json">${JSON.stringify(result.actualResult || {}, null, 2)}</pre>
    <h3>Warnings</h3><pre class="th-json">${JSON.stringify(result.warnings || [], null, 2)}</pre>
    <h3>Errors</h3><pre class="th-json">${JSON.stringify(result.errors || [], null, 2)}</pre>
    <div class="th-card-actions"><button id="copy-result-id">Copy Test ID</button><a class="secondary-button" href="/workspace/market-intelligence/logs">View Logs</a><button id="rerun-result">Rerun Test</button><button id="export-result">Export Result</button></div>
  `;
  document.getElementById("copy-result-id").onclick = () => navigator.clipboard.writeText(result.id);
  document.getElementById("rerun-result").onclick = () => runTest(result.testId, result.safetyMode);
  document.getElementById("export-result").onclick = () => downloadJSON(`test-result-${result.id}.json`, result);
  document.getElementById("result-drawer").classList.add("open");
}

function bindEvents() {
  initEnterpriseSidebar("market-nav");
  document.getElementById("run-test").addEventListener("click", () => runTest());
  document.getElementById("run-selected").addEventListener("click", runSelected);
  document.getElementById("run-diagnostic").addEventListener("click", runDiagnostic);
  document.getElementById("empty-run-diagnostic").addEventListener("click", runDiagnostic);
  document.getElementById("empty-run-source").addEventListener("click", () => runTest("source-registry-check", selectedSafetyMode()));
  document.getElementById("refresh-history").addEventListener("click", loadAll);
  document.getElementById("close-drawer").addEventListener("click", () => document.getElementById("result-drawer").classList.remove("open"));
  document.getElementById("export-report").addEventListener("click", async () => downloadJSON("market-intelligence-test-report.json", await fetchJSON(`${API}/api/market-intelligence/test-harness/export`)));
  document.getElementById("catalog-search").addEventListener("input", event => {
    const query = event.target.value.toLowerCase();
    renderCatalog(catalog.filter(test => `${test.testName} ${test.category} ${test.module} ${test.description}`.toLowerCase().includes(query)));
  });
  document.querySelector(".th-tabs").addEventListener("click", event => {
    const button = event.target.closest("button[data-tab]");
    if (!button) return;
    document.querySelectorAll(".th-tabs button").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".th-panel").forEach(panel => panel.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");
  });
  document.body.addEventListener("click", event => {
    const rowButton = event.target.closest("button[data-action]");
    if (rowButton) {
      const row = rowButton.closest("tr");
      selectedTestId = row?.dataset.testId || selectedTestId;
      if (rowButton.dataset.action === "run") runTest(selectedTestId);
      if (rowButton.dataset.action === "run-dry") runTest(selectedTestId, "dry_run");
      if (rowButton.dataset.action === "view-result") {
        const item = historyRows.find(history => history.testId === selectedTestId);
        if (item) openResult(item.id);
      }
      if (rowButton.dataset.action === "view-logs") location.href = "/workspace/market-intelligence/logs";
      if (rowButton.dataset.action === "schedule") alert("Scheduling metadata is stored by API, but scheduler activation is disabled by default.");
    }
    const historyButton = event.target.closest("button[data-result-id]");
    if (historyButton) openResult(historyButton.dataset.resultId);
    const panelButton = event.target.closest("button[data-panel-run]");
    if (panelButton?.dataset.panelRun) runTest(panelButton.dataset.panelRun);
  });
}

bindEvents();
loadAll().catch(error => {
  console.error("[test-harness] load failed", error);
  document.getElementById("catalog-body").innerHTML = `<tr><td colspan="12">Failed to load test harness data.</td></tr>`;
});

const nigeriaTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
setInterval(() => document.querySelector("#utc-clock").textContent = `WAT ${nigeriaTime.format(new Date())}`, 1000);
