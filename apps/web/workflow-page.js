const navItems = [
  ["01", "Executive Command Center", "/"], ["02", "End-to-End Workflow", "/workflow/end-to-end", true],
  ["03", "Market Intelligence"], ["04", "20-Asset Universe Scanner"], ["05", "Market Analysis"],
  ["06", "Computer Vision"], ["07", "AI Decision"], ["08", "AI Debate & Consensus"],
  ["09", "Strategy Intelligence"], ["10", "Risk Intelligence"], ["11", "Execution Center"],
  ["12", "Position Management"], ["13", "Learning & Memory"], ["14", "MT5 Infrastructure"],
  ["15", "Machine Registry"], ["16", "Monitoring & Self-Healing"], ["17", "Reports & Audit"],
  ["18", "Security & Governance"], ["19", "Administration"]
];
const dataSources = [
  ["Market Data Providers", "Real-time prices, ticks, depth"], ["News & Sentiment Sources", "News, RSS, AI sentiment"],
  ["Economic Calendar", "Events, indicators, central banks"], ["Social Media & Community", "Twitter, Reddit, Telegram"],
  ["On-Chain & Institutional Data", "Whale flow, COT, volatility index"], ["Historical Data", "OHLCV, tick, fundamentals"],
  ["Broker Data", "Spread, depth, liquidity, slippage"], ["Account & Portfolio Data", "Balance, equity, positions, risk"],
  ["Prop Firm Rules & Limits", "Drawdown, daily loss, targets"]
];
const infrastructure = [
  ["Multiple Machines", "Local, VPS, Cloud"], ["MT5 Terminals", "Per machine"], ["EA Bridge", "MQL5 Expert Advisor Bridge"],
  ["Secure Connection", "WSS, gRPC, ZeroMQ"], ["Smart Routing", "Best execution node"], ["Failover & Recovery", "Self-healing system"]
];
const stages = [
  ["MARKET INTELLIGENCE GATHERING", "Sources normalized | Quality scored", "Market Intelligence Package", "DATA OK"],
  ["20-ASSET UNIVERSE SCANNER", "20 instruments | Multi-session scan", "Asset Opportunity Scores", "SCAN OK"],
  ["ASSET RANKING & PAIR SELECTION", "Rank scores | Liquidity filter", "Top 10 Assets Selected", "SELECTION OK"],
  ["MARKET ANALYSIS & CONTEXT ENGINE (TOP 10)", "Structure | Regime | Momentum", "Market Analysis Report Top 10", "ANALYSIS OK"],
  ["COMPUTER VISION & CHART ANALYSIS (TOP 5)", "Pattern vision | Setup quality", "Visual Confirmation Report Top 5", "SETUP VALID"],
  ["AI DECISION ENGINE (TOP 5)", "Model ensemble | Explainability", "Trade Decision Proposal Top 5", "DECISION OK"],
  ["AI DEBATE & CONSENSUS ENGINE (TOP 3)", "Agent challenge | Consensus vote", "Consensus Decision Top 3", "CONSENSUS OK"],
  ["STRATEGY INTELLIGENCE CENTER (TOP 3)", "Strategy fit | Validation", "Selected Strategy Package", "STRATEGY OK"],
  ["RISK INTELLIGENCE & CAPITAL PROTECTION (TOP 3)", "Exposure | Position size | Veto authority", "Risk Approval & Position Size", "RISK APPROVED", true],
  ["EXECUTION PREPARATION (TOP 3)", "Node selection | Signed token", "Signed Execution Package", "PREPARED"],
  ["TRADE EXECUTION & ORDER MANAGEMENT (BEST 1-2)", "Broker route | Fill validation", "Order Ticket / Execution Result", "EXECUTED"],
  ["POSITION MANAGEMENT ENGINE", "SL/TP | Trailing stop | Health", "Managed Position State", "POSITION ACTIVE"],
  ["EXIT MANAGEMENT ENGINE", "Exit signal | Close validation", "Closed Trade Result", "POSITION CLOSED"],
  ["POST-TRADE ANALYTICS & LEARNING", "Outcome store | Feedback loop", "Learning Record Updated", "RECORD STORED"]
];
const rejects = [
  "Data feed failure | Critical data missing | Low data quality", "Scanner error | All assets low score | System unavailable",
  "No assets meet threshold | Liquidity too low | Market not tradable", "Analysis error | High uncertainty | Market closed",
  "No valid setup | Low visual confidence | Structure unclear", "Low AI confidence | Model conflict | Invalid signals",
  "Consensus below threshold | Major agent rejection | Unresolved conflict", "Strategy not suitable | Poor performance | Blocked strategy",
  "Risk limit breach | High exposure | Compliance violation", "Execution node down | Token generation fail | Invalid order parameters",
  "Order rejected | Execution timeout | Broker connection fail", "Extreme drawdown | Volatility spike | Risk emergency",
  "Exit failed | Order error | Position mismatch", "Data save failed | Analytics error | Sync failed"
];
const tier1 = ["XAUUSD","EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD","NAS100","US30"];
const tier2 = ["EURJPY","GBPJPY","AUDJPY","CADJPY","EURGBP","EURAUD","EURCAD","SPX500","GER40","USOIL"];
const list = (items) => items.map(([title, detail]) => `<div class="source-item"><i></i><div><strong>${title}</strong><small>${detail}</small></div></div>`).join("");

document.querySelector("#workflow-nav").innerHTML = navItems.map(([code, label, href = "#", active]) => `<a href="${href}" class="nav-item${active ? " active" : ""}"><span>${code}</span><em>${label}</em></a>`).join("");
document.querySelector("#data-sources").innerHTML = list(dataSources);
document.querySelector("#infrastructure-layer").innerHTML = list(infrastructure);
document.querySelector("#workflow-pipeline").innerHTML = stages.map(([title, bullets, output, status, veto], index) => `
  <article class="pipeline-stage${index === 8 ? " current" : ""}">
    <div class="stage-number">${String(index + 1).padStart(2, "0")}</div>
    <div class="stage-body"><h2>${title}</h2><p>${bullets}</p><div class="stage-output"><small>OUTPUT</small><strong>${output}</strong></div>${veto ? '<b class="veto-note">RISK ENGINE HAS ABSOLUTE VETO AUTHORITY</b>' : ""}</div>
    <div class="stage-state"><span>${status}</span><small>${index < 9 ? "COMPLETED" : "STANDBY"}</small></div>
  </article>${index < 13 ? '<div class="continue-arrow">CONTINUE</div>' : ""}`).join("");
document.querySelector("#reject-conditions").innerHTML = rejects.map((text, index) => `<div class="reject-item"><b>${String(index + 1).padStart(2, "0")}</b><span>${text}</span></div>`).join("");
document.querySelector("#asset-universe").innerHTML = `<div class="asset-tier"><strong>TIER 1 - CORE ASSETS</strong><div>${tier1.map(x => `<span>${x}</span>`).join("")}</div></div><div class="asset-tier"><strong>TIER 2 - OPPORTUNITY ASSETS</strong><div>${tier2.map(x => `<span>${x}</span>`).join("")}</div></div>`;
document.querySelector("#audit-items").innerHTML = ["Decision Logs","Risk Logs","Execution Logs","Position Logs","System Logs","Compliance Logs","Notifications"].map(x => `<span>${x}</span>`).join("");
document.querySelector("#final-outcome").innerHTML = ["Trade Completed","Profit / Loss Realized","All Records Stored","System Learning Updated"].map(x => `<span>${x}</span>`).join("");
document.querySelector("#key-points").innerHTML = ["Risk Engine Has Absolute Veto","Every Step Is Logged","Multi-Agent Governance","End-to-End Encryption","Self-Healing Infrastructure","100% Audit Traceable"].map(x => `<span>${x}</span>`).join("");
document.querySelector("#collapse-sidebar").addEventListener("click", () => document.querySelector(".app-shell").classList.toggle("sidebar-collapsed"));
setInterval(() => document.querySelector("#utc-clock").textContent = `UTC ${new Date().toISOString().slice(11,19)}`, 1000);
