const API = "http://localhost:8080";
let state = { loading: true, error: "", source: null, headlines: [], sources: [] };

const badge = value => `<span class="nsi-badge ${String(value).toLowerCase().replaceAll(" ","-").replaceAll("/","-")}">${value}</span>`;
const table = (headers, rows) => `<div class="nsi-table-wrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const title = (heading, copy, action) => `<div class="nsi-section-title"><div><h2>${heading}</h2><p>${copy}</p></div><b>${action}</b></div>`;

export function renderNewsSentimentCenter() {
  if (state.loading) return `<section class="nsi-dashboard"><section class="nsi-state"><div class="nsi-spinner"></div><h2>Loading live news sentiment intelligence...</h2><p>Reading configured headline adapters only.</p></section></section>`;
  if (state.error) return `<section class="nsi-dashboard"><section class="nsi-state"><h2>News sentiment data could not be loaded.</h2><p>${state.error}</p><div><button data-nsi-refresh>Retry</button><button data-nsi-configure>Configure Sources</button></div></section></section>`;
  const source = state.source;
  const healthy = ["ONLINE","LIVE","SYNCED"].includes(source?.status);
  const headlines = state.headlines;
  const connectedSources = state.sources;
  return `<section class="nsi-dashboard">
    <header class="nsi-header"><div><p class="nsi-eyebrow">WORKSPACE / MARKET INTELLIGENCE / NEWS SENTIMENT</p><h1>News Sentiment</h1><span>Live market-moving headline and sentiment intelligence from configured providers only.</span></div><div class="nsi-header-side"><div class="nsi-live-badges">${badge(source?.status || "NOT_CONFIGURED")}<b>Source Mode: Live Adapters Only</b><b class="ai">Fabricated Rows: 0</b></div><div class="nsi-actions"><button data-nsi-refresh>Refresh News</button><button data-nsi-configure>Configure Sources</button><button class="primary" data-nsi-export ${headlines.length ? "" : "disabled"}>Export Live Report</button></div></div></header>
    <section class="nsi-summary">${[["Provider",source?.provider || "Provider Not Connected"],["Status",source?.status || "NOT_CONFIGURED"],["Freshness",source?.freshness || "UNAVAILABLE"],["Records",source?.records || 0],["Adapter",source?.adapter || "none"],["HTTP Status",source?.httpStatus || "-"]].map(([a,b])=>`<article class="${healthy?"green":"red"}"><small>${a}</small><strong>${b}</strong><span>Live validation</span></article>`).join("")}</section>
    ${!healthy ? `<section class="nsi-state"><h2>No live news sentiment adapter is configured.</h2><p>${source?.configuration || "Configure a licensed headline provider to begin real-time sentiment ingestion."}</p><div><button data-nsi-configure>Open Source Configuration</button><button data-nsi-refresh>Retry Live Probe</button></div></section>` : ""}
    ${healthy && !headlines.length ? `<section class="nsi-state"><h2>No live news sentiment records are available.</h2><p>The adapter is reachable, but it has not returned normalized headlines yet. No sample records are rendered.</p><div><button data-nsi-refresh>Refresh News</button><button data-nsi-configure>Review Adapter</button></div></section>` : ""}
    ${headlines.length ? `<section class="nsi-panel">${title("Main News Sentiment Feed","Normalized live headlines returned by the configured adapter.",`${headlines.length} LIVE ITEMS`)}${table(["Time","Source","Headline","Category","Sentiment","Impact","Affected Assets","Action"],headlines.map(item=>[item.time||"-",item.source||"-",item.headline||"-",item.category||"-",badge(item.sentiment||"UNCLASSIFIED"),badge(item.impact||"UNKNOWN"),Array.isArray(item.affectedAssets)?item.affectedAssets.join(", "):"-",item.action||"-"]))}</section>` : ""}
    ${connectedSources.length ? `<section class="nsi-panel">${title("Live News Sources","Provider records returned by the configured adapter.",`${connectedSources.length} SOURCES`)}${table(["Source","Type","Status","Latency","Last Sync","Headlines","Accuracy","Health"],connectedSources.map(item=>[item.name||"-",item.type||"-",badge(item.status||"UNKNOWN"),item.latencyMs!=null?`${item.latencyMs} ms`:"-",item.lastSync||"-",item.headlinesToday||0,item.classificationAccuracy!=null?`${item.classificationAccuracy}%`:"-",item.healthScore!=null?`${item.healthScore}%`:"-"]))}</section>` : ""}
  </section>`;
}

async function load() {
  state = { ...state, loading: true, error: "" };
  const [liveResponse, headlinesResponse, sourcesResponse] = await Promise.all([
    fetch(`${API}/api/market-intelligence/live/dashboard`, { cache:"no-store" }),
    fetch(`${API}/api/market-intelligence/news-sentiment/headlines`, { cache:"no-store" }),
    fetch(`${API}/api/market-intelligence/news-sentiment/sources`, { cache:"no-store" })
  ]);
  if (!liveResponse.ok || !headlinesResponse.ok || !sourcesResponse.ok) throw new Error("Live news sentiment request failed.");
  const live = await liveResponse.json();
  state = {
    loading: false,
    error: "",
    source: live.sources?.find(item=>item.id==="news-sentiment") || null,
    headlines: (await headlinesResponse.json()).headlines || [],
    sources: (await sourcesResponse.json()).sources || []
  };
}

export function bindNewsSentimentCenter() {
  document.querySelectorAll("[data-nsi-refresh]").forEach(button=>button.addEventListener("click",mountNewsSentimentCenter));
  document.querySelectorAll("[data-nsi-configure]").forEach(button=>button.addEventListener("click",()=>location.assign("/workspace/market-intelligence/source-configuration")));
  document.querySelector("[data-nsi-export]")?.addEventListener("click",()=>{const blob=new Blob([JSON.stringify({ exportedAt:new Date().toISOString(), headlines:state.headlines, sources:state.sources },null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="live-news-sentiment-report.json";a.click();URL.revokeObjectURL(a.href);});
}

export async function mountNewsSentimentCenter() {
  const root = document.querySelector("#intelligence-content");
  root.innerHTML = renderNewsSentimentCenter();
  try { await load(); } catch (reason) { state = { ...state, loading:false, error:reason.message }; }
  if (!location.pathname.endsWith("/news-sentiment")) return;
  root.innerHTML = renderNewsSentimentCenter();
  bindNewsSentimentCenter();
}
