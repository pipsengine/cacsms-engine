import { initEnterpriseSidebar } from "./enterprise-sidebar.js";

const API = "http://localhost:8080";
let report;
let loading = false;
let error = "";

const scenarioTone = status => status === "PASSED" || status === "COMPLETED" || status === "CONTINUE" ? "ok" : status === "FAILED" || status === "REJECTED" || status === "STOP" ? "bad" : "warn";
const badge = value => `<span class="ct-badge ${scenarioTone(value)}">${value}</span>`;
const table = (headers, rows) => `<div class="ct-table"><table><thead><tr>${headers.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(x => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

function pipeline() {
  const cards = [
    ["01", "Market Intelligence Gathering", "Data sources / normalization / quality gate"],
    ["02", "20-Asset Universe Scanner", "Next test target after Card 1 approval"],
    ["03", "Asset Ranking & Pair Selection", "Pending"],
    ["04", "Market Analysis & Context Engine", "Pending"],
    ["05", "Computer Vision & Chart Analysis", "Pending"],
    ["06", "AI Decision Engine", "Pending"],
    ["07", "AI Debate & Consensus Engine", "Pending"],
    ["08", "Strategy Intelligence Center", "Pending"],
    ["09", "Risk Intelligence & Capital Protection", "Pending"],
    ["10", "Execution Preparation", "Pending"],
    ["11", "Trade Execution & Order Management", "Pending"],
    ["12", "Post-Trade Analytics & Learning", "Pending"]
  ];
  return cards.map(([number, title, note], index) => `<article class="${index === 0 ? "active" : index === 1 && report?.workflowPermission === "CONTINUE" ? "next" : ""}"><b>${number}</b><div><strong>${title}</strong><span>${note}</span></div>${index === 0 ? badge(report?.status || "PENDING") : index === 1 && report?.workflowPermission === "CONTINUE" ? badge("READY") : badge("LOCKED")}</article>`).join("");
}

function render() {
  if (loading) return `<article class="ct-card"><h1>Workflow Dashboard</h1><p>Running Card 1 Market Intelligence completion test...</p></article>`;
  if (error) return `<article class="ct-card"><h1>Workflow Dashboard</h1><p>${error}</p><button data-ct-scenario="pass">Retry Production Baseline</button></article>`;
  if (!report) return "";
  const sourceRows = report.sources.map(source => [source.name, source.provider, source.required ? "REQUIRED" : "OPTIONAL", badge(source.status), `${source.healthScore}%`, source.freshness, `${source.latencyMs || 0} ms`, source.failureAction]);
  const checkRows = report.checks.map(check => [check.name, check.severity, check.policy, badge(check.status)]);
  const rejectRows = [["Data feed failure", "Reject Card 1 and stop workflow"], ["Critical data missing", "Reject Card 1 and stop workflow"], ["Low data quality", "Reject when aggregate quality falls below 85%"], ["Economic calendar stale", "Continue with restricted trading mode"], ["Optional source unavailable", "Continue with reduced confidence"]];
  return `<section class="ct-dashboard">
    <header class="ct-header"><div><small>EXECUTIVE COMMAND CENTER / WORKFLOW DASHBOARD</small><h1>Workflow Card Completion Test Harness</h1><p>Validate each card before the autonomous workflow is allowed to proceed. Card 1 is connected to the completed Market Intelligence Center and its Data Quality Gate.</p></div><aside>${badge(`CARD 1 ${report.status}`)}<b>REFERENCE WORKFLOW / 12 CARDS</b><b>ACTIVE TEST / MARKET INTELLIGENCE GATHERING</b><span>RUN ID / ${report.testRunId}</span></aside></header>
    <section class="ct-toolbar"><div><strong>Card 1 Scenario Runner</strong><span>Use controlled test scenarios to prove success, warning, and reject behavior.</span></div><div><button data-ct-scenario="pass">Run Production Baseline</button><button data-ct-scenario="warning">Test Calendar Stale</button><button data-ct-scenario="reject">Test Market Feed Failure</button><button data-ct-scenario="missing">Test Critical Feed Missing</button><button data-ct-export>Export Test Evidence</button></div></section>
    <section class="ct-kpis">${[["Card Under Test","01"],["Completion Status",report.status],["Workflow Permission",report.workflowPermission],["Acceptance Score",`${report.acceptanceScore}%`],["Data Quality Score",`${report.dataQualityScore}%`],["Required Sources",`${report.requiredHealthyCount} / ${report.requiredSourceCount}`],["Optional Sources",`${report.optionalHealthyCount} / ${report.optionalSourceCount}`],["Next Card",report.nextCard ? "02 READY" : "LOCKED"]].map(([a,b])=>`<article><small>${a}</small><strong>${b}</strong></article>`).join("")}</section>
    <div class="ct-layout"><aside class="ct-card"><div class="ct-title"><h2>WORKFLOW CARD TEST QUEUE</h2><span>Incremental verification plan</span></div><div class="ct-pipeline">${pipeline()}</div></aside>
    <div class="ct-main">
      <article class="ct-card ct-decision"><div class="ct-title"><div><h2>CARD 1 / MARKET INTELLIGENCE GATHERING</h2><span>Collect, normalize, validate and package intelligence before the scanner receives any input.</span></div>${badge(report.workflowPermission)}</div><div class="ct-decision-grid"><span>Input Sources<b>${report.sources.length}</b></span><span>Output Package<b>${report.output || "WITHHELD"}</b></span><span>Handoff Target<b>${report.nextCard?.cardTitle || "WORKFLOW STOPPED"}</b></span></div><p>${report.workflowPermission === "CONTINUE" ? "Card 1 completion is verified. The normalized Market Intelligence Package may be handed to Card 2 for scanner testing." : "Card 1 failed admission control. No intelligence package may be handed to Card 2."}</p></article>
      <article class="ct-card"><div class="ct-title"><div><h2>ACCEPTANCE CHECK MATRIX</h2><span>Every Card 1 requirement is recorded with an explicit policy outcome.</span></div></div>${table(["Acceptance Check","Severity","Policy","Result"],checkRows)}</article>
      <article class="ct-card"><div class="ct-title"><div><h2>SOURCE EVIDENCE MATRIX</h2><span>Evidence from the completed Market Intelligence Center source model.</span></div><a href="/workspace/market-intelligence/data-quality-gate">Open Data Quality Gate</a></div>${table(["Source","Provider","Requirement","Status","Health","Freshness","Latency","Failure Action"],sourceRows)}</article>
      <div class="ct-grid"><article class="ct-card"><div class="ct-title"><div><h2>REJECT / STOP CONDITIONS</h2><span>Reference-image Card 1 stop policies.</span></div></div>${table(["Condition","Workflow Action"],rejectRows)}</article>
      <article class="ct-card"><div class="ct-title"><div><h2>TEST AUDIT TRAIL</h2><span>Evidence emitted by the latest scenario run.</span></div></div>${table(["Event","Detail","Status","Timestamp"],report.audit.map(item=>[item.event,item.detail,badge(item.status),new Date(item.timestamp).toLocaleString()]))}</article></div>
      <article class="ct-card ct-handoff"><div><h2>CARD 2 HANDOFF READINESS</h2><p>The next implementation cycle can reuse this pattern: card contract, acceptance checks, controlled scenarios, evidence, reject policy, audit and explicit permission.</p></div>${badge(report.nextCard ? "READY FOR CARD 2 TESTING" : "LOCKED UNTIL CARD 1 PASSES")}</article>
    </div></div></section>`;
}

async function run(scenario = "pass") {
  loading = true;
  error = "";
  draw();
  try {
    const response = await fetch(`${API}/api/workflow/cards/1/test-${scenario}`, { method: "POST" });
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
  document.querySelectorAll("[data-ct-scenario]").forEach(button => button.addEventListener("click", () => run(button.dataset.ctScenario)));
  document.querySelector("[data-ct-export]")?.addEventListener("click", () => {
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    anchor.download = `${report.testRunId}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  });
}

initEnterpriseSidebar("workflow-test-nav");
run("pass");
setInterval(() => document.querySelector("#utc-clock").textContent = `UTC ${new Date().toISOString().slice(11,19)}`, 1000);

