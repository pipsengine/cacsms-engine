import { initEnterpriseSidebar } from "./enterprise-sidebar.js";

const kpis = [
  ["PORTFOLIO VALUE", "$1,284,920", "+8.42%", "positive", "◈"],
  ["DAILY P&L", "+$12,842", "+1.01%", "positive", "↗"],
  ["ACTIVE POSITIONS", "04", "2 long / 2 short", "neutral", "⇆"],
  ["WIN RATE", "68.4%", "+4.2% vs 30D", "positive", "◎"],
  ["RISK SCORE", "28 / 100", "LOW EXPOSURE", "safe", "⬡"],
  ["AI CONFIDENCE", "87.4%", "HIGH CONVICTION", "ai", "✦"]
];

const workflowStages = [
  "Market Intelligence", "Asset Universe Scan", "Asset Ranking", "Market Analysis",
  "Computer Vision", "AI Decision", "AI Debate", "Strategy Selection",
  "Risk Validation", "Execution Preparation", "Trade Execution", "Position Management",
  "Exit Management", "Learning Engine"
];

const opportunities = [
  ["01", "XAUUSD", "Gold / US Dollar", "BUY", "94.8", "+2.34%", "Tier 1"],
  ["02", "NAS100", "Nasdaq 100", "BUY", "91.2", "+1.87%", "Tier 1"],
  ["03", "EURJPY", "Euro / Yen", "SELL", "86.7", "-0.82%", "Tier 2"],
  ["04", "USOIL", "WTI Crude Oil", "BUY", "82.4", "+1.12%", "Tier 2"]
];

const positions = [
  ["XAUUSD", "BUY", "+$4,280", "+1.82%"],
  ["NAS100", "BUY", "+$2,840", "+1.14%"],
  ["EURJPY", "SELL", "+$1,260", "+0.68%"],
  ["GBPUSD", "SELL", "-$420", "-0.24%"]
];

const alerts = [
  ["warning", "Latency threshold exceeded", "MT5-EU-042 · 8m ago"],
  ["danger", "Risk limit approaching", "NAS100 exposure · 14m ago"],
  ["info", "Workflow retry completed", "Computer Vision · 22m ago"]
];

initEnterpriseSidebar("main-nav");

document.querySelector("#kpi-grid").innerHTML = kpis.map(([label, value, note, type, icon]) => `
  <article class="kpi-card ${type}">
    <div><small>${label}</small><strong>${value}</strong><span>${note}</span></div>
    <i>${icon}</i>
  </article>`).join("");

document.querySelector("#workflow-stages").innerHTML = workflowStages.map((stage, index) => {
  const number = index + 1;
  const state = number < 9 ? "completed" : number === 9 ? "active" : "pending";
  return `<div class="workflow-stage ${state}"><span>${number < 10 ? `0${number}` : number}</span><strong>${stage}</strong><i>${state === "completed" ? "✓" : state === "active" ? "↻" : "·"}</i></div>`;
}).join("");

document.querySelector("#opportunities").innerHTML = opportunities.map(([rank, symbol, name, signal, score, change, tier]) => `
  <div class="opportunity-row">
    <span class="rank">${rank}</span><div class="asset"><strong>${symbol}</strong><small>${name}</small></div>
    <span class="signal ${signal.toLowerCase()}">${signal}</span>
    <div class="score"><strong>${score}</strong><small>AI SCORE</small></div>
    <div class="change"><strong>${change}</strong><small>${tier}</small></div>
  </div>`).join("");

document.querySelector("#positions").innerHTML = positions.map(([symbol, side, pnl, move]) => `
  <div class="position-row"><strong>${symbol}</strong><span class="signal ${side.toLowerCase()}">${side}</span><div><strong class="${pnl.startsWith("-") ? "loss" : "gain"}">${pnl}</strong><small>${move}</small></div></div>`).join("");

document.querySelector("#alerts").innerHTML = alerts.map(([type, title, detail]) => `
  <div class="alert-row"><span class="alert-icon ${type}">!</span><div><strong>${title}</strong><small>${detail}</small></div></div>`).join("");

function updateClock() {
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC"
  }).format(new Date());
  document.querySelector("#utc-clock").textContent = `UTC ${time}`;
  document.querySelector("#last-sync").textContent = `${time} UTC`;
}

updateClock();
setInterval(updateClock, 1000);
