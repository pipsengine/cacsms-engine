import { initEnterpriseSidebar } from "./enterprise-sidebar.js";

const API = "http://localhost:8080";
const FETCH_TIMEOUT_MS = 120000;
let cardOneReport;
let cardTwoReport;
let loading = "";
let error = "";

async function fetchJson(path, { method = "GET", timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API}${path}`, { method, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  } catch (reason) {
    if (reason?.name === "AbortError") throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    throw reason;
  } finally {
    clearTimeout(timer);
  }
}

const CARD_QUEUE = [
  ["01", "Data Sources Validation", "Live Source Adapter Snapshots", "Validated Intelligence Package", "Market Intelligence Gathering"],
  ["02", "Market Intelligence Gathering", "Validated Intelligence Package", "Market Intelligence Package", "20-Asset Universe Scanner"],
  ["03", "20-Asset Universe Scanner", "Market Intelligence Package", "Asset Opportunity Scores", "Asset Ranking & Pair Selection"],
  ["04", "Asset Ranking & Pair Selection", "Asset Opportunity Scores", "Ranked Asset Selection", "Market Analysis & Context Engine"],
  ["05", "Market Analysis & Context Engine", "Ranked Asset Selection", "Market Context Package", "Computer Vision & Chart Analysis"],
  ["06", "Computer Vision & Chart Analysis", "Market Context Package", "Visual Confirmation Package", "AI Decision Engine"],
  ["07", "AI Decision Engine", "Visual Confirmation Package", "Trade Decision Proposal", "AI Debate & Consensus Engine"],
  ["08", "AI Debate & Consensus Engine", "Trade Decision Proposal", "Consensus Decision Package", "Strategy Intelligence Center"],
  ["09", "Strategy Intelligence Center", "Consensus Decision Package", "Selected Strategy Package", "Risk Intelligence & Capital Protection"],
  ["10", "Risk Intelligence & Capital Protection", "Selected Strategy Package", "Risk Approval Package", "Execution Preparation"],
  ["11", "Execution Preparation", "Risk Approval Package", "Signed Execution Package", "Trade Execution & Order Management"],
  ["12", "Trade Execution & Order Management", "Signed Execution Package", "Execution Result", "Position Management"],
  ["13", "Position Management", "Execution Result", "Managed Position State", "Post-Trade Analytics & Learning"],
  ["14", "Post-Trade Analytics & Learning", "Managed Position State", "Learning Record", "Workflow Complete"]
];

const tone = status => ["PASSED", "COMPLETED", "CONTINUE", "READY", "PASS"].includes(status) ? "ok" : ["FAILED", "REJECTED", "STOP", "LOCKED", "FAIL"].includes(status) ? "bad" : "warn";
const badge = value => `<span class="ct-badge ${tone(value)}">${value}</span>`;
const table = (headers, rows) => `<div class="ct-table"><table><thead><tr>${headers.map(value => `<th>${value}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

function cardStatus(index) {
  if (index === 0) return cardOneReport?.status || "PENDING";
  if (index === 1) {
    if (cardTwoReport?.status) return cardTwoReport.status;
    if (cardOneReport?.workflowPermission === "CONTINUE") return "READY";
    return "LOCKED";
  }
  if (index === 2) return cardTwoReport?.workflowPermission === "CONTINUE" ? "READY" : "LOCKED";
  return "LOCKED";
}

function pipeline() {
  return CARD_QUEUE.map(([number, title, input, output, next], index) => {
    const status = cardStatus(index);
    const acceptance = index === 0
      ? `${cardOneReport?.acceptanceScore ?? 0}%`
      : index === 1
        ? cardTwoReport ? `${cardTwoReport.acceptanceScore ?? 0}%` : status === "READY" ? "TEST REQUIRED" : "LOCKED"
        : "LOCKED";
    const quality = index === 0
      ? `${cardOneReport?.dataQualityScore ?? 0}%`
      : index === 1
        ? cardTwoReport ? `${cardTwoReport.dataQualityScore ?? 0}%` : status === "READY" ? "TEST REQUIRED" : "LOCKED"
        : "LOCKED";
    const permission = index === 0
      ? cardOneReport?.workflowPermission || "TEST_REQUIRED"
      : index === 1
        ? status === "LOCKED" ? "LOCKED" : cardTwoReport?.workflowPermission || "TEST_REQUIRED"
        : status === "READY" ? "TEST_REQUIRED" : "LOCKED";
    const active = index === 0 || (index === 1 && cardOneReport?.workflowPermission === "CONTINUE" && !cardTwoReport);
    const nextClass = index === 1 && cardOneReport?.workflowPermission === "CONTINUE" && !cardTwoReport ? "next" : index === 2 && cardTwoReport?.workflowPermission === "CONTINUE" ? "next" : "";
    const actions = index === 0
      ? `<div class="ct-pipeline-actions"><button type="button" data-ct-card1>Run Card 1 Test</button></div>`
      : index === 1 && status !== "LOCKED"
        ? `<div class="ct-pipeline-actions"><button type="button" data-ct-card2>Run Card 2 Test</button><a href="/workspace/market-intelligence/test-harness">Open Test Harness</a></div>`
        : "";
    return `<article class="${index === 0 ? "active" : active ? "" : nextClass}">
      <b>${number}</b><div><strong>${title}</strong><span>Input: ${input}</span><span>Output: ${output}</span><span>Acceptance: ${acceptance} / Quality: ${quality}</span><span>Permission: ${permission}</span><span>Next: ${next}</span></div>${badge(status === "READY" ? "READY" : status)}${actions}
    </article>`;
  }).join("");
}

function cardOneSection() {
  if (!cardOneReport) return "";
  const sourceRows = cardOneReport.sources.map(source => [source.name, source.provider, source.required ? "REQUIRED" : "OPTIONAL", badge(source.status), `${source.healthScore}%`, source.freshness, `${source.latencyMs || 0} ms`, source.failureAction]);
  const checkRows = cardOneReport.checks.map(check => [check.name, check.severity, check.policy, badge(check.status)]);
  const rejectRows = [["Data feed failure", "Reject Card 1 and stop workflow"], ["Critical data missing", "Reject Card 1 and stop workflow"], ["Low data quality", "Reject when aggregate quality falls below 85%"], ["Economic calendar stale", "Continue with restricted trading mode"], ["Optional source unavailable", "Continue with reduced confidence"]];
  return `
    <section class="ct-toolbar"><div><strong>Card 1 Live Validation Runner</strong><span>Probe configured adapters only. Missing connectors remain unavailable and cannot be replaced by sample data.</span></div><div><button data-ct-card1>Run Live Card 1 Test</button><button data-ct-export-card1>Export Live Evidence</button></div></section>
    <section class="ct-kpis">${[["Card Under Test","01"],["Completion Status",cardOneReport.status],["Workflow Permission",cardOneReport.workflowPermission],["Acceptance Score",`${cardOneReport.acceptanceScore}%`],["Data Quality Score",`${cardOneReport.dataQualityScore}%`],["Required Sources",`${cardOneReport.requiredHealthyCount} / ${cardOneReport.requiredSourceCount}`],["Optional Sources",`${cardOneReport.optionalHealthyCount} / ${cardOneReport.optionalSourceCount}`],["Next Card",cardOneReport.nextCard ? "02 READY" : "LOCKED"]].map(([label,value])=>`<article><small>${label}</small><strong>${value}</strong></article>`).join("")}</section>
    <article class="ct-card ct-decision"><div class="ct-title"><div><h2>CARD 1 / DATA SOURCES VALIDATION</h2><span>Verify all required intelligence feeds before workflow admission.</span></div>${badge(cardOneReport.workflowPermission)}</div><div class="ct-decision-grid"><span>Input Package<b>${cardOneReport.inputPackage}</b></span><span>Output Package<b>${cardOneReport.output || "WITHHELD"}</b></span><span>Next Card<b>${cardOneReport.nextCard?.cardTitle || "WORKFLOW STOPPED"}</b></span></div><p>${cardOneReport.workflowPermission === "CONTINUE" ? "Card 1 source validation passed. The Validated Intelligence Package may be handed to Card 2 for intelligence gathering." : "Card 1 failed source admission control. Card 2 cannot gather intelligence until required live feeds are healthy."}</p></article>
    <article class="ct-card"><div class="ct-title"><div><h2>ACCEPTANCE CHECK MATRIX</h2><span>Every Card 1 source-validation requirement has an explicit policy outcome.</span></div></div>${table(["Acceptance Check","Severity","Policy","Result"],checkRows)}</article>
    <article class="ct-card"><div class="ct-title"><div><h2>SOURCE EVIDENCE MATRIX</h2><span>Live adapter evidence used by Data Sources Validation.</span></div><a href="/workspace/market-intelligence/data-quality-gate">Open Data Quality Gate</a></div>${table(["Source","Provider","Requirement","Status","Health","Freshness","Latency","Failure Action"],sourceRows)}</article>
    <div class="ct-grid"><article class="ct-card"><div class="ct-title"><div><h2>REJECT / STOP CONDITIONS</h2><span>Card 1 workflow admission policies.</span></div></div>${table(["Condition","Workflow Action"],rejectRows)}</article>
    <article class="ct-card"><div class="ct-title"><div><h2>TEST AUDIT TRAIL</h2><span>Evidence emitted by the latest live validation run.</span></div></div>${table(["Event","Detail","Status","Timestamp"],cardOneReport.audit.map(item=>[item.event,item.detail,badge(item.status),new Date(item.timestamp).toLocaleString()]))}</article></div>`;
}

function cardTwoSection() {
  const unlocked = cardOneReport?.workflowPermission === "CONTINUE";
  if (!unlocked) {
    return `<article class="ct-card ct-handoff"><div><h2>CARD 2 / MARKET INTELLIGENCE GATHERING</h2><p>Collect, normalize, enrich and package intelligence for asset scanning. This card remains locked until Card 1 emits a Validated Intelligence Package.</p></div>${badge("LOCKED UNTIL CARD 1 PASSES")}</article>`;
  }
  if (!cardTwoReport) {
    return `
      <article class="ct-card ct-handoff"><div><h2>CARD 2 / MARKET INTELLIGENCE GATHERING</h2><p>Card 1 passed. Run the Card 2 live test to gather intelligence modules, score the package, and emit the Market Intelligence Package for Card 3.</p></div>${badge("READY FOR CARD 2 TESTING")}</article>
      <section class="ct-toolbar"><div><strong>Card 2 Live Intelligence Test Runner</strong><span>Reads validated Card 1 input, evaluates live intelligence modules from the database, and generates the Market Intelligence Package.</span></div><div><button data-ct-card2>Run Live Card 2 Test</button><a class="ct-link-button" href="/workspace/market-intelligence/test-harness">Open Test Harness</a><a class="ct-link-button" href="/workspace/market-intelligence/dashboard">Open Card 2 Dashboard</a></div></section>`;
  }
  const checkRows = cardTwoReport.checks.map(check => [check.name, check.severity, check.policy, badge(check.status)]);
  const scoreRows = (cardTwoReport.scores || []).filter(score => score.value != null).map(score => [score.label, `${score.value}%`, badge(score.status)]);
  const pipelineRows = (cardTwoReport.pipeline || []).map(stage => [stage.name, badge(stage.status), stage.progress == null ? "—" : `${stage.progress}%`, stage.confidence == null ? "—" : `${stage.confidence}%`]);
  return `
    <section class="ct-toolbar"><div><strong>Card 2 Live Intelligence Test Runner</strong><span>Database-backed intelligence gathering using validated Card 1 inputs and live module scores.</span></div><div><button data-ct-card2>Run Live Card 2 Test</button><button data-ct-export-card2>Export Card 2 Evidence</button><a class="ct-link-button" href="/workspace/market-intelligence/dashboard">Open Card 2 Dashboard</a></div></section>
    <section class="ct-kpis">${[["Card Under Test","02"],["Completion Status",cardTwoReport.status],["Workflow Permission",cardTwoReport.workflowPermission],["Acceptance Score",`${cardTwoReport.acceptanceScore}%`],["Market Intelligence Score",`${cardTwoReport.marketIntelligenceScore ?? cardTwoReport.dataQualityScore}%`],["Confidence Score",`${cardTwoReport.intelligenceConfidenceScore ?? "—"}%`],["Modules Completed",cardTwoReport.modulesCompleted],["Next Card",cardTwoReport.nextCard ? "03 READY" : "LOCKED"]].map(([label,value])=>`<article><small>${label}</small><strong>${value}</strong></article>`).join("")}</section>
    <article class="ct-card ct-decision"><div class="ct-title"><div><h2>CARD 2 / MARKET INTELLIGENCE GATHERING</h2><span>Transform validated source evidence into a scored Market Intelligence Package.</span></div>${badge(cardTwoReport.workflowPermission)}</div><div class="ct-decision-grid"><span>Input Package<b>${cardTwoReport.inputPackage}</b></span><span>Output Package<b>${cardTwoReport.output || "WITHHELD"}</b></span><span>Next Card<b>${cardTwoReport.nextCard?.cardTitle || "WORKFLOW STOPPED"}</b></span></div><p>${cardTwoReport.workflowPermission === "CONTINUE" ? "Card 2 intelligence gathering passed. The Market Intelligence Package may be handed to Card 3 for asset universe scanning." : "Card 2 failed intelligence packaging. Card 3 cannot scan assets until required intelligence modules and output package checks pass."}</p></article>
    <article class="ct-card"><div class="ct-title"><div><h2>CARD 2 ACCEPTANCE CHECK MATRIX</h2><span>Every Card 2 intelligence-packaging requirement has an explicit policy outcome.</span></div></div>${table(["Acceptance Check","Severity","Policy","Result"],checkRows)}</article>
    <div class="ct-grid"><article class="ct-card"><div class="ct-title"><div><h2>INTELLIGENCE SCORES</h2><span>Scores calculated during the latest Card 2 live test.</span></div></div>${scoreRows.length ? table(["Score","Value","Status"],scoreRows) : "<p>No intelligence scores were calculated.</p>"}</article>
    <article class="ct-card"><div class="ct-title"><div><h2>INTELLIGENCE PIPELINE</h2><span>Card 2 module progression during the latest live test.</span></div></div>${pipelineRows.length ? table(["Stage","Status","Progress","Confidence"],pipelineRows) : "<p>No pipeline stages recorded.</p>"}</article></div>
    <article class="ct-card"><div class="ct-title"><div><h2>TEST AUDIT TRAIL</h2><span>Evidence emitted by the latest Card 2 live test.</span></div></div>${table(["Event","Detail","Status","Timestamp"],cardTwoReport.audit.map(item=>[item.event,item.detail,badge(item.status),new Date(item.timestamp).toLocaleString()]))}</article>
    <article class="ct-card ct-handoff"><div><h2>CARD 3 / 20-ASSET UNIVERSE SCANNER</h2><p>Scan the tradable universe using the Market Intelligence Package. This card unlocks when Card 2 emits a passing output package.</p></div>${badge(cardTwoReport.nextCard ? "READY FOR CARD 3 TESTING" : "LOCKED UNTIL CARD 2 PASSES")}</article>`;
}

function render() {
  if (loading === "boot") return `<article class="ct-card"><h1>Workflow Dashboard</h1><p>Loading workflow dashboard...</p></article>`;
  if (loading === "card1") return `<article class="ct-card"><h1>Workflow Dashboard</h1><p>Running Card 1 live validation test. This probes all configured adapters and may take up to 2 minutes.</p></article>`;
  if (loading === "card2") return `<article class="ct-card"><h1>Workflow Dashboard</h1><p>Running Card 2 intelligence gathering test. This evaluates live modules and may take up to 2 minutes.</p></article>`;
  if (error) return `<article class="ct-card"><h1>Workflow Dashboard</h1><p>${error}</p><button data-ct-card1>Retry Live Card 1 Test</button>${cardOneReport?.workflowPermission === "CONTINUE" ? `<button data-ct-card2>Retry Live Card 2 Test</button>` : ""}</article>`;
  if (!cardOneReport) return "";
  const activeLabel = cardTwoReport ? "CARD 2 MARKET INTELLIGENCE GATHERING" : cardOneReport.nextCard ? "CARD 2 READY FOR TESTING" : "DATA SOURCES VALIDATION";
  const runId = cardTwoReport?.testRunId || cardOneReport.testRunId;
  return `<section class="ct-dashboard">
    <header class="ct-header"><div><small>EXECUTIVE COMMAND CENTER / WORKFLOW DASHBOARD</small><h1>Workflow Card Completion Test Harness</h1><p>Validate each workflow card independently before autonomous handoff. Card 1 verifies source availability. Card 2 gathers and packages intelligence from validated inputs. Neither card ranks assets or places trades.</p></div><aside>${badge(cardTwoReport ? `CARD 2 ${cardTwoReport.status}` : `CARD 1 ${cardOneReport.status}`)}<b>REFERENCE WORKFLOW / 14 CARDS</b><b>ACTIVE TEST / ${activeLabel}</b><span>RUN ID / ${runId}</span></aside></header>
    <div class="ct-layout"><aside class="ct-card"><div class="ct-title"><h2>WORKFLOW CARD TEST QUEUE</h2><span>Sequential independent verification</span></div><div class="ct-pipeline">${pipeline()}</div></aside>
    <div class="ct-main">${cardOneSection()}${cardTwoSection()}</div></div></section>`;
}

async function loadDashboard() {
  loading = "boot";
  error = "";
  draw();
  try {
    cardOneReport = await fetchJson("/api/workflow/cards/1", { timeoutMs: 30000 });
    if (cardOneReport.workflowPermission === "CONTINUE") {
      try {
        cardTwoReport = await fetchJson("/api/workflow/cards/2", { timeoutMs: 30000 });
      } catch {
        cardTwoReport = null;
      }
    } else {
      cardTwoReport = null;
    }
  } catch (reason) {
    error = reason.message || "Unable to load workflow dashboard.";
  } finally {
    loading = "";
    draw();
  }
}

async function runCardOne() {
  loading = "card1";
  error = "";
  draw();
  try {
    const payload = await fetchJson("/api/workflow/cards/1/test-live", { method: "POST" });
    cardOneReport = payload.event.report;
    if (cardOneReport.workflowPermission !== "CONTINUE") cardTwoReport = null;
  } catch (reason) {
    error = reason.message || "Card 1 live test failed.";
  } finally {
    loading = "";
    draw();
  }
}

async function runCardTwo() {
  if (cardOneReport?.workflowPermission !== "CONTINUE") {
    error = "Card 2 is locked until Card 1 passes source validation.";
    draw();
    return;
  }
  loading = "card2";
  error = "";
  draw();
  try {
    const payload = await fetchJson("/api/workflow/cards/2/test-live", { method: "POST" });
    cardTwoReport = payload.event.report;
  } catch (reason) {
    error = reason.message || "Card 2 live test failed.";
  } finally {
    loading = "";
    draw();
  }
}

function exportReport(report, prefix) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  anchor.download = `${report.testRunId || prefix}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function draw() {
  document.querySelector("#card-one-dashboard").innerHTML = render();
  document.querySelectorAll("[data-ct-card1]").forEach(button => button.addEventListener("click", runCardOne));
  document.querySelectorAll("[data-ct-card2]").forEach(button => button.addEventListener("click", runCardTwo));
  document.querySelector("[data-ct-export-card1]")?.addEventListener("click", () => exportReport(cardOneReport, "card-1"));
  document.querySelector("[data-ct-export-card2]")?.addEventListener("click", () => exportReport(cardTwoReport, "card-2"));
}

initEnterpriseSidebar("workflow-test-nav");
loadDashboard();
const nigeriaTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
setInterval(() => document.querySelector("#utc-clock").textContent = `WAT ${nigeriaTime.format(new Date())}`, 1000);
