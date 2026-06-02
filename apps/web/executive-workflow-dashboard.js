import { initEnterpriseSidebar } from "./enterprise-sidebar.js";

const API = "http://localhost:8080";
let report;
let loading = false;
let error = "";

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

const tone = status => ["PASSED", "COMPLETED", "CONTINUE", "READY"].includes(status) ? "ok" : ["FAILED", "REJECTED", "STOP", "LOCKED"].includes(status) ? "bad" : "warn";
const badge = value => `<span class="ct-badge ${tone(value)}">${value}</span>`;
const table = (headers, rows) => `<div class="ct-table"><table><thead><tr>${headers.map(value => `<th>${value}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

function pipeline() {
  return CARD_QUEUE.map(([number, title, input, output, next], index) => {
    const status = index === 0 ? report?.status || "PENDING" : index === 1 && report?.workflowPermission === "CONTINUE" ? "READY" : "LOCKED";
    const acceptance = index === 0 ? `${report?.acceptanceScore ?? 0}%` : "PENDING";
    const quality = index === 0 ? `${report?.dataQualityScore ?? 0}%` : "PENDING";
    const permission = index === 0 ? report?.workflowPermission || "TEST_REQUIRED" : status === "READY" ? "TEST_REQUIRED" : "LOCKED";
    return `<article class="${index === 0 ? "active" : index === 1 && status === "READY" ? "next" : ""}">
      <b>${number}</b><div><strong>${title}</strong><span>Input: ${input}</span><span>Output: ${output}</span><span>Acceptance: ${acceptance} / Quality: ${quality}</span><span>Permission: ${permission}</span><span>Next: ${next}</span></div>${badge(status)}
    </article>`;
  }).join("");
}

function render() {
  if (loading) return `<article class="ct-card"><h1>Workflow Dashboard</h1><p>Running Card 1 Data Sources Validation test...</p></article>`;
  if (error) return `<article class="ct-card"><h1>Workflow Dashboard</h1><p>${error}</p><button data-ct-live>Retry Live Card 1 Test</button></article>`;
  if (!report) return "";
  const sourceRows = report.sources.map(source => [source.name, source.provider, source.required ? "REQUIRED" : "OPTIONAL", badge(source.status), `${source.healthScore}%`, source.freshness, `${source.latencyMs || 0} ms`, source.failureAction]);
  const checkRows = report.checks.map(check => [check.name, check.severity, check.policy, badge(check.status)]);
  const rejectRows = [["Data feed failure", "Reject Card 1 and stop workflow"], ["Critical data missing", "Reject Card 1 and stop workflow"], ["Low data quality", "Reject when aggregate quality falls below 85%"], ["Economic calendar stale", "Continue with restricted trading mode"], ["Optional source unavailable", "Continue with reduced confidence"]];
  return `<section class="ct-dashboard">
    <header class="ct-header"><div><small>EXECUTIVE COMMAND CENTER / WORKFLOW DASHBOARD</small><h1>Workflow Card Completion Test Harness</h1><p>Validate each workflow card independently before autonomous handoff. Card 1 only verifies source availability, freshness, latency and quality. It does not analyze markets, generate bias or rank assets.</p></div><aside>${badge(`CARD 1 ${report.status}`)}<b>REFERENCE WORKFLOW / 14 CARDS</b><b>ACTIVE TEST / DATA SOURCES VALIDATION</b><span>RUN ID / ${report.testRunId}</span></aside></header>
    <section class="ct-toolbar"><div><strong>Card 1 Live Validation Runner</strong><span>Probe configured adapters only. Missing connectors remain unavailable and cannot be replaced by sample data.</span></div><div><button data-ct-live>Run Live Card 1 Test</button><button data-ct-export>Export Live Evidence</button></div></section>
    <section class="ct-kpis">${[["Card Under Test","01"],["Completion Status",report.status],["Workflow Permission",report.workflowPermission],["Acceptance Score",`${report.acceptanceScore}%`],["Data Quality Score",`${report.dataQualityScore}%`],["Required Sources",`${report.requiredHealthyCount} / ${report.requiredSourceCount}`],["Optional Sources",`${report.optionalHealthyCount} / ${report.optionalSourceCount}`],["Next Card",report.nextCard ? "02 READY" : "LOCKED"]].map(([label,value])=>`<article><small>${label}</small><strong>${value}</strong></article>`).join("")}</section>
    <div class="ct-layout"><aside class="ct-card"><div class="ct-title"><h2>WORKFLOW CARD TEST QUEUE</h2><span>Sequential independent verification</span></div><div class="ct-pipeline">${pipeline()}</div></aside>
    <div class="ct-main">
      <article class="ct-card ct-decision"><div class="ct-title"><div><h2>CARD 1 / DATA SOURCES VALIDATION</h2><span>Verify all required intelligence feeds before workflow admission.</span></div>${badge(report.workflowPermission)}</div><div class="ct-decision-grid"><span>Input Package<b>${report.inputPackage}</b></span><span>Output Package<b>${report.output || "WITHHELD"}</b></span><span>Next Card<b>${report.nextCard?.cardTitle || "WORKFLOW STOPPED"}</b></span></div><p>${report.workflowPermission === "CONTINUE" ? "Card 1 source validation passed. The Validated Intelligence Package may be handed to Card 2 for intelligence gathering." : "Card 1 failed source admission control. Card 2 cannot gather intelligence until required live feeds are healthy."}</p></article>
      <article class="ct-card"><div class="ct-title"><div><h2>ACCEPTANCE CHECK MATRIX</h2><span>Every Card 1 source-validation requirement has an explicit policy outcome.</span></div></div>${table(["Acceptance Check","Severity","Policy","Result"],checkRows)}</article>
      <article class="ct-card"><div class="ct-title"><div><h2>SOURCE EVIDENCE MATRIX</h2><span>Live adapter evidence used by Data Sources Validation.</span></div><a href="/workspace/market-intelligence/data-quality-gate">Open Data Quality Gate</a></div>${table(["Source","Provider","Requirement","Status","Health","Freshness","Latency","Failure Action"],sourceRows)}</article>
      <div class="ct-grid"><article class="ct-card"><div class="ct-title"><div><h2>REJECT / STOP CONDITIONS</h2><span>Card 1 workflow admission policies.</span></div></div>${table(["Condition","Workflow Action"],rejectRows)}</article>
      <article class="ct-card"><div class="ct-title"><div><h2>TEST AUDIT TRAIL</h2><span>Evidence emitted by the latest live validation run.</span></div></div>${table(["Event","Detail","Status","Timestamp"],report.audit.map(item=>[item.event,item.detail,badge(item.status),new Date(item.timestamp).toLocaleString()]))}</article></div>
      <article class="ct-card ct-handoff"><div><h2>CARD 2 / MARKET INTELLIGENCE GATHERING</h2><p>Collect, normalize, enrich and package intelligence for asset scanning. This card remains locked until Card 1 emits a Validated Intelligence Package.</p></div>${badge(report.nextCard ? "READY FOR CARD 2 TESTING" : "LOCKED UNTIL CARD 1 PASSES")}</article>
    </div></div></section>`;
}

async function run() {
  loading = true;
  error = "";
  draw();
  try {
    const response = await fetch(`${API}/api/workflow/cards/1/test-live`, { method: "POST" });
    if (!response.ok) throw new Error(`Card 1 test failed (${response.status})`);
    report = (await response.json()).event.report;
  } catch (reason) {
    error = reason.message;
  } finally {
    loading = false;
    draw();
  }
}

function draw() {
  document.querySelector("#card-one-dashboard").innerHTML = render();
  document.querySelectorAll("[data-ct-live]").forEach(button => button.addEventListener("click", run));
  document.querySelector("[data-ct-export]")?.addEventListener("click", () => {
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    anchor.download = `${report.testRunId}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  });
}

initEnterpriseSidebar("workflow-test-nav");
run();
const nigeriaTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
setInterval(() => document.querySelector("#utc-clock").textContent = `WAT ${nigeriaTime.format(new Date())}`, 1000);
