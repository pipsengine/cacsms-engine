import { initEnterpriseSidebar } from "./enterprise-sidebar.js";
const dataSources = [
  ["market-data","ACT","Market Data Providers","Real-time prices, ticks, OHLCV, volume, spread and volatility feeds.","ONLINE",true,"#2563EB",["Stage 1","Stage 2","Stage 3","Stage 4"],"Workflow cannot proceed."],
  ["news-sentiment","NEWS","News & Sentiment Sources","Market-moving news, financial headlines, AI sentiment and risk tone.","ONLINE",true,"#7C3AED",["Stage 1","Stage 4","Stage 6","Stage 7","Stage 9"],"Restrict or block high-impact trades."],
  ["economic-calendar","CAL","Economic Calendar","CPI, NFP, FOMC, interest rates, central bank speeches and macro releases.","SYNCED",true,"#F59E0B",["Stage 1","Stage 4","Stage 6","Stage 7","Stage 9"],"Restrict trading around unknown news events."],
  ["social-sentiment","SOC","Social & Community Sentiment","Retail positioning, crowd bias, community trend and public sentiment.","OPTIONAL",false,"#0EA5E9",["Stage 1","Stage 6","Stage 7"],"Reduce sentiment confidence only."],
  ["institutional-data","COT","Institutional / COT Data","Commitment of Traders, institutional positioning, macro flow and smart money bias.","SCHEDULED",false,"#0F766E",["Stage 1","Stage 4","Stage 6","Stage 7"],"Reduce institutional confidence score."],
  ["historical-data","HIST","Historical Market Data","OHLCV, tick history, volatility history, pattern history and strategy history.","AVAILABLE",true,"#9333EA",["Stage 3","Stage 4","Stage 6","Stage 8","Stage 14"],"Historical comparison and learning become unavailable."],
  ["broker-data","BRK","Broker Data","Spread, slippage, liquidity, execution latency, symbol availability and server health.","LIVE",true,"#DC2626",["Stage 2","Stage 3","Stage 9","Stage 10","Stage 11"],"No execution allowed if broker data is unavailable."],
  ["portfolio-data","ACC","Account & Portfolio Data","Balance, equity, margin, exposure, open positions, drawdown and account limits.","LIVE",true,"#16A34A",["Stage 7","Stage 9","Stage 12","Stage 13","Stage 14"],"Risk validation cannot proceed."],
  ["prop-rules","RULE","Prop Firm Rules & Limits","Daily loss, maximum drawdown, minimum days, trading restrictions and account rules.","ACTIVE",true,"#EA580C",["Card 10","Audit / Compliance"],"Prop account trading must be blocked."]
];
const infrastructure = [
  ["Multiple Machines", "Local, VPS, Cloud"], ["MT5 Terminals", "Per machine"], ["EA Bridge", "MQL5 Expert Advisor Bridge"],
  ["Secure Connection", "WSS, gRPC, ZeroMQ"], ["Smart Routing", "Best execution node"], ["Failover & Recovery", "Self-healing system"]
];
const stages = [
  ["DATA SOURCES VALIDATION", "Availability | API | latency | freshness | quality", "Validated Intelligence Package", "DATA VALID"],
  ["MARKET INTELLIGENCE GATHERING", "Aggregate | normalize | enrich | context", "Market Intelligence Package", "INTELLIGENCE READY"],
  ["20-ASSET UNIVERSE SCANNER", "20 instruments | Multi-session scan", "Asset Opportunity Scores", "SCAN OK"],
  ["ASSET RANKING & PAIR SELECTION", "Rank scores | Liquidity filter", "Ranked Asset Selection", "SELECTION OK"],
  ["MARKET ANALYSIS & CONTEXT ENGINE", "Structure | Regime | Momentum", "Market Context Package", "ANALYSIS OK"],
  ["COMPUTER VISION & CHART ANALYSIS", "Pattern vision | Setup quality", "Visual Confirmation Package", "SETUP VALID"],
  ["AI DECISION ENGINE", "Model ensemble | Explainability", "Trade Decision Proposal", "DECISION OK"],
  ["AI DEBATE & CONSENSUS ENGINE", "Agent challenge | Consensus vote", "Consensus Decision Package", "CONSENSUS OK"],
  ["STRATEGY INTELLIGENCE CENTER", "Strategy fit | Validation", "Selected Strategy Package", "STRATEGY OK"],
  ["RISK INTELLIGENCE & CAPITAL PROTECTION", "Exposure | Position size | Veto authority", "Risk Approval Package", "RISK APPROVED", true],
  ["EXECUTION PREPARATION", "Node selection | Signed token", "Signed Execution Package", "PREPARED"],
  ["TRADE EXECUTION & ORDER MANAGEMENT", "Broker route | Fill validation", "Execution Result", "EXECUTED"],
  ["POSITION MANAGEMENT", "SL/TP | trailing stop | exit state", "Managed Position State", "POSITION ACTIVE"],
  ["POST-TRADE ANALYTICS & LEARNING", "Outcome store | Feedback loop", "Learning Record Updated", "RECORD STORED"]
];
const rejects = [
  "Data feed failure | Critical data missing | Low data quality", "Aggregation failed | Normalization error | Context incomplete",
  "Scanner error | All assets low score | System unavailable", "No assets meet threshold | Liquidity too low | Market not tradable",
  "Analysis error | High uncertainty | Market closed", "No valid setup | Low visual confidence | Structure unclear",
  "Low AI confidence | Model conflict | Invalid signals", "Consensus below threshold | Major agent rejection | Unresolved conflict",
  "Strategy not suitable | Poor performance | Blocked strategy", "Risk limit breach | High exposure | Compliance violation",
  "Execution node down | Token generation fail | Invalid order parameters", "Order rejected | Execution timeout | Broker connection fail",
  "Extreme drawdown | Volatility spike | Risk emergency", "Data save failed | Analytics error | Sync failed"
];
const tier1 = ["XAUUSD","EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD","NAS100","US30"];
const tier2 = ["EURJPY","GBPJPY","AUDJPY","CADJPY","EURGBP","EURAUD","EURCAD","SPX500","GER40","USOIL"];
const list = (items) => items.map(([title, detail]) => `<div class="source-item"><i></i><div><strong>${title}</strong><small>${detail}</small></div></div>`).join("");
const compactSourceIcons = ["ACT","NEWS","CAL","SOC","COT","HIST","BRK","ACC","RULE"];

initEnterpriseSidebar("workflow-nav");
document.querySelector("#data-sources").innerHTML = dataSources.map(([, , title, , , , , , ], index) => `<div class="workflow-data-source-item"><span>${compactSourceIcons[index]}</span><div><strong>${title.replace("Social & Community Sentiment","Social Media & Community").replace("Institutional / COT Data","On-Chain & Institutional Data").replace("Historical Market Data","Historical Data")}</strong><small>${["Real-time Prices, Ticks, Depth","News, RSS, AI Sentiment","Events, Indicators, Central Banks","Twitter, Reddit, Telegram","Whale Flow, COT, Volatility Index","OHLCV, Tick, Fundamentals","Spread, Depth, Liquidity","Balance, Equity, Positions, Risk","Drawdown, Daily Loss, Targets"][index]}</small></div></div>`).join("");
document.querySelector("#infrastructure-layer").innerHTML = list(infrastructure);
document.querySelector("#workflow-pipeline").innerHTML = stages.map(([title, bullets, output, status, veto], index) => `
  <article class="pipeline-stage${index === 0 ? " current" : ""}">
    <div class="stage-number">${String(index + 1).padStart(2, "0")}</div>
    <div class="stage-body"><h2>${title}</h2><p>${bullets}</p><div class="stage-output"><small>OUTPUT</small><strong>${output}</strong></div>${veto ? '<b class="veto-note">RISK ENGINE HAS ABSOLUTE VETO AUTHORITY</b>' : ""}</div>
    <div class="stage-state"><span>${status}</span><small>${index === 0 ? "VALIDATING" : "STANDBY"}</small></div>
  </article>${index < 13 ? '<div class="continue-arrow">CONTINUE</div>' : ""}`).join("");
document.querySelector("#reject-conditions").innerHTML = rejects.map((text, index) => `<div class="reject-item"><b>${String(index + 1).padStart(2, "0")}</b><span>${text}</span></div>`).join("");
document.querySelector("#asset-universe").innerHTML = `<div class="asset-tier"><strong>TIER 1 - CORE ASSETS</strong><div>${tier1.map(x => `<span>${x}</span>`).join("")}</div></div><div class="asset-tier"><strong>TIER 2 - OPPORTUNITY ASSETS</strong><div>${tier2.map(x => `<span>${x}</span>`).join("")}</div></div>`;
document.querySelector("#audit-items").innerHTML = ["Decision Logs","Risk Logs","Execution Logs","Position Logs","System Logs","Compliance Logs","Notifications"].map(x => `<span>${x}</span>`).join("");
document.querySelector("#final-outcome").innerHTML = ["Trade Completed","Profit / Loss Realized","All Records Stored","System Learning Updated"].map(x => `<span>${x}</span>`).join("");
document.querySelector("#key-points").innerHTML = ["Risk Engine Has Absolute Veto","Every Step Is Logged","Multi-Agent Governance","End-to-End Encryption","Self-Healing Infrastructure","100% Audit Traceable"].map(x => `<span>${x}</span>`).join("");
function updateWorkflowClock() {
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Lagos" }).format(new Date());
  document.querySelector("#utc-clock").textContent = `WAT ${time}`;
  document.querySelector("#workflow-last-updated").textContent = `${time} WAT`;
}
updateWorkflowClock();
setInterval(updateWorkflowClock, 1000);
