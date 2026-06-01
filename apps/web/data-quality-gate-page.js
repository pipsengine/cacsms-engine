const sources = [
  ["Market Data Providers", "CACSMS Market Feed", true, "ONLINE", 100, "18 sec", "22 ms", 0, "Block Stage 1"],
  ["News & Sentiment Sources", "CACSMS News Hub", true, "ONLINE", 100, "22 sec", "38 ms", 0, "Restrict high-impact trades"],
  ["Economic Calendar", "CACSMS Calendar", true, "SYNCED", 98, "45 sec", "42 ms", 0, "Restricted trading mode"],
  ["Social Media & Community", "CACSMS Social Pulse", false, "OPTIONAL", 92, "75 sec", "96 ms", 0, "Reduce confidence"],
  ["Institutional / COT Data", "CACSMS Institutional Feed", false, "SCHEDULED", 94, "30 min", "n/a", 0, "Reduce confidence"],
  ["Historical Data", "CACSMS Historical Store", true, "ONLINE", 100, "2 min", "12 ms", 0, "Disable historical comparison"],
  ["Broker Data", "CACSMS Broker Gateway", true, "LIVE", 100, "12 sec", "18 ms", 0, "Block execution"],
  ["Account & Portfolio Data", "CACSMS Portfolio Ledger", true, "LIVE", 100, "15 sec", "16 ms", 0, "Block risk validation"],
  ["Prop Firm Rules & Limits", "CACSMS Compliance Rules", true, "ONLINE", 100, "5 min", "n/a", 0, "Block prop risk validation"]
];

const rules = [
  ["Market data feed available", "Critical", "Market Data Providers", "PASSED"],
  ["Minimum aggregate quality score", "Critical", "All sources >= 85%", "PASSED"],
  ["Economic calendar current", "High", "Economic Calendar", "PASSED"],
  ["Broker feed available", "High", "Broker Data", "PASSED"],
  ["Portfolio ledger available", "High", "Account & Portfolio Data", "PASSED"],
  ["Prop firm rules available", "High", "Prop Firm Rules & Limits", "PASSED"],
  ["Historical store available", "Medium", "Historical Data", "PASSED"],
  ["Optional sentiment feeds monitored", "Advisory", "Optional sources", "PASSED"]
];

const impacts = [
  ["Stage 1", "Market Intelligence", "ALLOWED", "Validated source inputs may proceed into intelligence gathering."],
  ["Stage 3", "Asset Ranking", "READY", "Quality score modifies ranking confidence."],
  ["Stage 4", "Context Engine", "READY", "Freshness and calendar checks constrain context."],
  ["Stage 6", "AI Decision", "READY", "Warnings and restrictions become decision modifiers."],
  ["Stage 7", "AI Debate", "READY", "Agents receive source-level diagnostics."],
  ["Stage 9", "Risk Validation", "READY", "Portfolio, broker and compliance readiness protect execution."]
];

const events = [
  ["DQG-20260601-004", "01 Jun 2026, 09:32", "Scheduled validation", "PASSED", "98%", "system.scheduler"],
  ["DQG-20260601-003", "01 Jun 2026, 09:00", "Source refresh", "PASSED", "98%", "system.scheduler"],
  ["DQG-20260531-002", "31 May 2026, 13:04", "Manual validation", "WARNING", "96%", "risk.operator"],
  ["DQG-20260531-001", "31 May 2026, 09:30", "Scheduled validation", "PASSED", "97%", "system.scheduler"]
];

function scenario() {
  return new URLSearchParams(location.search).get("scenario") || "normal";
}

function profile() {
  if (scenario() === "stale") return { status: "WARNING", permission: "ALLOWED WITH WARNING", score: 91, fresh: "STALE", blocks: 0, warnings: 2, mode: "RESTRICTED", note: "Economic calendar freshness exceeded the preferred tolerance. Stage 1 remains available with restricted trading mode." };
  if (scenario() === "blocked") return { status: "BLOCKED", permission: "RESTRICTED", score: 72, fresh: "DEGRADED", blocks: 2, warnings: 3, mode: "HALTED", note: "Primary market data is unavailable and aggregate quality is below threshold. Stage 1 permission has been withheld." };
  return { status: "PASSED", permission: "ALLOWED", score: 98, fresh: "LIVE", blocks: 0, warnings: 0, mode: "NORMAL", note: "All critical source checks passed. CACSMS Engine may proceed to Stage 1 Market Intelligence Gathering." };
}

function badge(value) {
  const tone = /PASSED|ONLINE|LIVE|READY|ALLOWED|SYNCED|OPTIONAL|NORMAL/.test(value) ? "ok" : /BLOCKED|FAILED|HALTED|RESTRICTED/.test(value) ? "bad" : "warn";
  return `<span class="dq-badge ${tone}">${value}</span>`;
}

function sourceRows(p) {
  return sources.map((source, index) => {
    const row = [...source];
    if (scenario() === "stale" && index === 2) row[3] = "STALE";
    if (scenario() === "blocked" && index === 0) row[3] = "FAILED";
    return `<tr><td><strong>${row[0]}</strong><small>${row[1]}</small></td><td>${row[2] ? badge("REQUIRED") : badge("OPTIONAL")}</td><td>${badge(row[3])}</td><td><b>${scenario() === "blocked" && index === 0 ? 42 : row[4]}%</b></td><td>${row[5]}</td><td>${row[6]}</td><td>${row[7]}</td><td>${row[8]}</td></tr>`;
  }).join("");
}

function ruleRows(p) {
  return rules.map((rule, index) => {
    const state = scenario() === "blocked" && index < 2 ? "FAILED" : scenario() === "stale" && index === 2 ? "WARNING" : rule[3];
    return `<tr><td><strong>${rule[0]}</strong></td><td>${rule[1]}</td><td>${rule[2]}</td><td>${badge(state)}</td></tr>`;
  }).join("");
}

export function renderDataQualityGateCenter() {
  const p = profile();
  return `
    <section class="dq-page">
      <header class="dq-header">
        <div><span class="dq-kicker">03 MARKET INTELLIGENCE CENTER</span><h1>Data Quality Gate</h1><p>Validate source readiness, freshness, completeness and blockers before CACSMS Engine proceeds to Stage 1.</p><div class="dq-header-badges">${badge(`GATE ${p.status}`)}${badge(`MODE ${p.mode}`)}${badge("WORKFLOW INPUT: STAGE 1")}<span class="dq-muted">Last validation: 01 Jun 2026, 09:32</span></div></div>
        <div class="dq-actions"><button>Run Validation</button><button>Refresh Sources</button><button>Recalculate Score</button><button>Export Gate Report</button></div>
      </header>
      <div class="dq-scenario"><strong>Gate Simulation</strong><span>Inspect workflow behavior:</span><button data-dq-scenario="normal">Normal</button><button data-dq-scenario="stale">Calendar Stale</button><button data-dq-scenario="blocked">Market Feed Failed</button></div>
      <div class="dq-metrics">
        ${[["Gate Status", p.status],["Workflow Permission",p.permission],["Quality Score",`${p.score}%`],["Required Sources","7 / 7"],["Optional Sources","2 / 2"],["Freshness",p.fresh],["Blocking Issues",p.blocks],["Warnings",p.warnings]].map(([label,value])=>`<article><small>${label}</small><strong>${value}</strong></article>`).join("")}
      </div>
      <div class="dq-grid">
        <article class="dq-card dq-decision"><div class="dq-title"><div><h2>GATE DECISION</h2><p>Stage 1 admission control and operational permission.</p></div>${badge(p.status)}</div><div class="dq-score"><strong>${p.score}</strong><span>/ 100</span></div><p>${p.note}</p><div class="dq-decision-grid"><span>Proceed to Stage 1<b>${p.status === "BLOCKED" ? "FALSE" : "TRUE"}</b></span><span>Trading Mode<b>${p.mode}</b></span><span>Next Validation<b>09:37 AM</b></span></div></article>
        <article class="dq-card"><div class="dq-title"><div><h2>BLOCKING & RESTRICTION PANEL</h2><p>Policy outcomes emitted to downstream stages.</p></div></div>
          <div class="dq-alert ${p.blocks ? "danger" : "success"}"><b>${p.blocks ? `${p.blocks} BLOCKING ISSUES` : "NO ACTIVE BLOCKERS"}</b><span>${p.blocks ? "Market Data Providers unavailable; score is below the 85% admission threshold." : "Required sources are online and Stage 1 admission is available."}</span></div>
          <div class="dq-alert ${p.warnings ? "warning" : "success"}"><b>${p.warnings ? `${p.warnings} ACTIVE WARNINGS` : "NO ACTIVE WARNINGS"}</b><span>${p.warnings ? "Review source diagnostics before allowing unrestricted trading." : "No source restrictions require operator action."}</span></div>
        </article>
      </div>
      <article class="dq-card"><div class="dq-title"><div><h2>SOURCE READINESS MATRIX</h2><p>Required and optional intelligence inputs with freshness, latency and failure policy.</p></div><button>Configure Sources</button></div><div class="dq-table-wrap"><table><thead><tr><th>Source</th><th>Requirement</th><th>Status</th><th>Health</th><th>Freshness</th><th>Latency</th><th>Errors</th><th>Failure Action</th></tr></thead><tbody>${sourceRows(p)}</tbody></table></div></article>
      <div class="dq-grid">
        <article class="dq-card"><div class="dq-title"><div><h2>VALIDATION RULE MATRIX</h2><p>Governed readiness checks evaluated on every run.</p></div></div><div class="dq-table-wrap"><table><thead><tr><th>Rule</th><th>Severity</th><th>Scope</th><th>Result</th></tr></thead><tbody>${ruleRows(p)}</tbody></table></div></article>
        <article class="dq-card"><div class="dq-title"><div><h2>FRESHNESS & LATENCY DIAGNOSTICS</h2><p>Current source telemetry against expected operating windows.</p></div></div><div class="dq-bars">${sources.slice(0,7).map((s,i)=>`<div><span>${s[0]}</span><i><b style="width:${scenario()==="blocked"&&i===0?42:s[4]}%"></b></i><em>${scenario()==="blocked"&&i===0?"42":s[4]}%</em></div>`).join("")}</div></article>
      </div>
      <article class="dq-card"><div class="dq-title"><div><h2>WORKFLOW IMPACT MAP</h2><p>How gate telemetry influences analysis, decision and risk stages.</p></div></div><div class="dq-impact">${impacts.map(([stage,name,status,description])=>`<div><b>${stage}</b><strong>${name}</strong>${badge(p.status==="BLOCKED"&&stage==="Stage 1"?"RESTRICTED":status)}<span>${description}</span></div>`).join("")}</div></article>
      <article class="dq-card"><div class="dq-title"><div><h2>GATE AUDIT TIMELINE</h2><p>Immutable validation history for operations and governance review.</p></div><button>Open Audit Log</button></div><div class="dq-table-wrap"><table><thead><tr><th>Run ID</th><th>Validated At</th><th>Trigger</th><th>Status</th><th>Score</th><th>Actor</th></tr></thead><tbody>${events.map(e=>`<tr><td><strong>${e[0]}</strong></td><td>${e[1]}</td><td>${e[2]}</td><td>${badge(e[3])}</td><td>${e[4]}</td><td>${e[5]}</td></tr>`).join("")}</tbody></table></div></article>
      <article class="dq-card dq-action-center"><div><h2>ACTION CENTER</h2><p>Operate the gate, investigate telemetry and manage readiness policy.</p></div><div>${["Run Validation","Refresh All Sources","Retry Failed Source","Recalculate Quality Score","Validate Freshness","Open Gate Logs","Export Gate Report","Configure Gate Rules"].map(action=>`<button>${action}</button>`).join("")}</div></article>
      <section class="dq-states"><article><h3>EMPTY STATE</h3><p>No source telemetry is available yet. Connect intelligence sources or run a refresh.</p></article><article><h3>LOADING STATE</h3><p>Validating market intelligence source readiness...</p></article><article><h3>ERROR STATE</h3><p>Data quality validation could not be completed. Retry the gate run or open logs.</p></article></section>
    </section>`;
}

export function bindDataQualityGateCenter() {
  document.querySelectorAll("[data-dq-scenario]").forEach((button) => button.addEventListener("click", () => {
    const params = new URLSearchParams(location.search);
    params.set("scenario", button.dataset.dqScenario);
    history.replaceState({}, "", `${location.pathname}?${params}`);
    document.querySelector("#intelligence-content").innerHTML = renderDataQualityGateCenter();
    bindDataQualityGateCenter();
  }));
}

