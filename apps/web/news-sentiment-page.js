const API = "http://localhost:8080";
const REFRESH_MS = 10000;
let refreshTimer;
let state = { loading: true, syncing: false, error: "", dashboard: null, headlines: [], sources: [], assets: [], alerts: [], query: "" };

const esc = value => String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const badge = value => `<span class="nsi-badge ${String(value).toLowerCase().replaceAll(" ","-").replaceAll("/","-")}">${esc(value)}</span>`;
const title = (heading, copy, action) => `<div class="nsi-section-title"><div><h2>${heading}</h2><p>${copy}</p></div><b>${esc(action)}</b></div>`;
const table = (headers, rows) => `<div class="nsi-table-wrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No live records match the current view.</td></tr>`}</tbody></table></div>`;
const time = value => value ? new Date(value).toLocaleString() : "-";
const assets = value => Array.isArray(value) && value.length ? value.map(item=>`<i>${esc(item)}</i>`).join("") : "-";

function filteredHeadlines() {
  const query = state.query.trim().toLowerCase();
  if (!query) return state.headlines;
  return state.headlines.filter(item => `${item.headline} ${item.summary} ${item.source} ${item.category} ${(item.affectedAssets || []).join(" ")}`.toLowerCase().includes(query));
}

export function renderNewsSentimentCenter() {
  if (state.loading) return `<section class="nsi-dashboard"><section class="nsi-state"><div class="nsi-spinner"></div><h2>Synchronizing live news intelligence...</h2><p>Collecting actual articles from enabled providers.</p></section></section>`;
  if (state.error) return `<section class="nsi-dashboard"><section class="nsi-state"><h2>News intelligence could not be loaded.</h2><p>${esc(state.error)}</p><div><button data-nsi-refresh>Retry</button><button data-nsi-configure>Configure Sources</button></div></section></section>`;

  const dashboard = state.dashboard || {};
  const rows = filteredHeadlines();
  const online = state.sources.filter(source=>source.status==="ONLINE").length;
  return `<section class="nsi-dashboard">
    <header class="nsi-header"><div><p class="nsi-eyebrow">WORKSPACE / MARKET INTELLIGENCE / NEWS INTELLIGENCE ENGINE</p><h1>News Sentiment</h1><span>Automated real-time collection, validation, enrichment, sentiment analysis, market impact detection, alerting, and historical storage.</span></div><div class="nsi-header-side"><div class="nsi-live-badges">${badge(dashboard.status || "STARTING")}<b>Source Mode: Live Providers Only</b><b class="ai">Auto Sync: 1 Minute</b></div><div class="nsi-actions"><button data-nsi-refresh>${state.syncing ? "Synchronizing..." : "Sync News Now"}</button><button data-nsi-configure>Configure Sources</button><button class="primary" data-nsi-export ${state.headlines.length ? "" : "disabled"}>Export Live Report</button></div></div></header>
    <section class="nsi-summary">${[
      ["Live Providers",`${online} / ${state.sources.length}`,"green"],
      ["Stored Articles",dashboard.articleCount || 0,"blue"],
      ["High Impact",dashboard.highImpact || 0,"amber"],
      ["Sentiment Score",dashboard.sentimentScore ?? 0,"purple"],
      ["Market Bias",dashboard.sentimentDirection || "Neutral","purple"],
      ["Active Alerts",dashboard.unacknowledgedAlerts || 0,"red"]
    ].map(([a,b,c])=>`<article class="${c}"><small>${a}</small><strong>${esc(b)}</strong><span>Live intelligence</span></article>`).join("")}</section>
    <section class="nsi-filter-panel"><div class="nsi-filter-title"><div><strong>Live News Search</strong><span>Search stored real provider articles by headline, category, source, or asset.</span></div></div><div class="nsi-filter-grid"><label>Keyword<div class="nsi-search"><input data-nsi-query value="${esc(state.query)}" placeholder="Search live news..." /></div></label></div></section>
    ${!online ? `<section class="nsi-state"><h2>No enabled news provider is currently reachable.</h2><p>The engine will keep retrying automatically. Review provider health below; no sample articles are rendered.</p><div><button data-nsi-refresh>Retry Sync</button><button data-nsi-configure>Configure Sources</button></div></section>` : ""}
    <section class="nsi-panel">${title("Live News Intelligence Feed","Normalized articles collected from real enabled providers.",`${rows.length} ARTICLES`)}${table(["Published","Source","Headline","Category","Sentiment","Impact","Affected Assets","Action"],rows.map(item=>[
      esc(time(item.publishedAt)),
      esc(item.source),
      `<div class="nsi-headline"><strong><a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.headline)}</a></strong><span>${esc(item.summary || "")}</span></div>`,
      esc(item.category),
      `${badge(item.sentiment)}<span class="nsi-confidence">${esc(item.sentimentScore)} / ${esc(item.confidence)}%</span>`,
      `${badge(item.impact)}<span>${esc(item.impactScore)} / 100</span>`,
      `<div class="nsi-tags">${assets(item.affectedAssets)}</div>`,
      esc(item.action)
    ]))}</section>
    <div class="nsi-grid nsi-grid-main">
      <section class="nsi-panel">${title("Provider Health","Every source remains isolated so one failure cannot break the page.",`${online} ONLINE`)}${table(["Provider","Tier","Status","Latency","Last Success","Imported","Error"],state.sources.map(item=>[
        esc(item.name),esc(item.tier),badge(item.status),item.latencyMs!=null?`${esc(item.latencyMs)} ms`:"-",esc(time(item.lastSuccessAt)),esc(item.imported || 0),esc(item.error || "-")
      ]))}</section>
      <section class="nsi-panel">${title("Real-Time Alerts","High and extreme impact articles detected by the enrichment engine.",`${state.alerts.length} ALERTS`)}<div class="nsi-alert-list">${state.alerts.length ? state.alerts.slice(0,12).map(item=>`<article><span class="nsi-alert-icon ${String(item.level).toLowerCase()}">!</span><div><strong>${esc(item.headline)}</strong><p>${esc((item.affectedAssets || []).join(", ") || "Market-wide")}</p><small>${esc(time(item.createdAt))}</small></div><aside>${badge(item.level)}</aside></article>`).join("") : "<p>No high-impact live alerts have been generated.</p>"}</div></section>
    </div>
    <section class="nsi-panel">${title("Asset Impact Intelligence","Aggregated sentiment and impact from stored live articles.",`${state.assets.length} ASSETS`)}${table(["Asset","Articles","High Impact","Sentiment Score","Direction"],state.assets.map(item=>[esc(item.symbol),esc(item.articles),esc(item.highImpact),esc(item.sentimentScore),badge(item.sentiment)]))}</section>
  </section>`;
}

async function request(path, options) {
  const response = await fetch(`${API}${path}`, { cache:"no-store", ...options });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

async function load({ sync = false } = {}) {
  if (sync) {
    state.syncing = true;
    render();
    await request("/api/news/sync", { method:"POST", headers:{ "Content-Type":"application/json" }, body:"{}" });
  }
  const [dashboard, headlines, sources, impact, alerts] = await Promise.all([
    request("/api/news/sentiment"),
    request("/api/news/latest?limit=200"),
    request("/api/news/provider/health"),
    request("/api/news/impact"),
    request("/api/news/alerts")
  ]);
  state = { ...state, loading:false, syncing:false, error:"", dashboard, headlines:headlines.articles || [], sources:sources.sources || [], assets:impact.assets || [], alerts:alerts.alerts || [] };
}

function render() {
  const root = document.querySelector("#intelligence-content");
  if (!root || !location.pathname.endsWith("/news-sentiment")) return;
  root.innerHTML = renderNewsSentimentCenter();
  bindNewsSentimentCenter();
}

export function bindNewsSentimentCenter() {
  document.querySelectorAll("[data-nsi-refresh]").forEach(button=>button.addEventListener("click",async()=>{try{await load({ sync:true });}catch(reason){state={...state,loading:false,syncing:false,error:reason.message};}render();}));
  document.querySelectorAll("[data-nsi-configure]").forEach(button=>button.addEventListener("click",()=>location.assign("/workspace/market-intelligence/source-configuration")));
  document.querySelector("[data-nsi-query]")?.addEventListener("input",event=>{state.query=event.target.value;render();document.querySelector("[data-nsi-query]")?.focus();});
  document.querySelector("[data-nsi-export]")?.addEventListener("click",()=>{const blob=new Blob([JSON.stringify({ exportedAt:new Date().toISOString(), dashboard:state.dashboard, headlines:state.headlines, sources:state.sources, assets:state.assets, alerts:state.alerts },null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="live-news-intelligence-report.json";a.click();URL.revokeObjectURL(a.href);});
}

export async function mountNewsSentimentCenter() {
  clearInterval(refreshTimer);
  render();
  try { await load(); } catch (reason) { state = { ...state, loading:false, syncing:false, error:reason.message }; }
  render();
  refreshTimer = setInterval(async()=>{if(!location.pathname.endsWith("/news-sentiment")) return clearInterval(refreshTimer);try{await load();render();}catch{}},REFRESH_MS);
}
