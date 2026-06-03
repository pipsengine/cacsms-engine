const API = "http://localhost:8080";
let state = { loading:true, error:"", source:null, events:[], restrictions:[], assets:[], centralBanks:[] };

const badge = value => `<span class="ecx-badge ${String(value).toLowerCase().replaceAll(" ","-")}">${value}</span>`;
const table = (headers, rows) => `<div class="ecx-table-wrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const title = (heading, copy, action) => `<div class="ecx-title"><div><h2>${heading}</h2><p>${copy}</p></div><b>${action}</b></div>`;

export function renderEconomicCalendarCenter() {
  if (state.loading) return `<section class="ecx-dashboard"><article class="ecx-panel ecx-state"><h1>Economic Calendar</h1><p>Loading live economic event intelligence...</p></article></section>`;
  if (state.error) return `<section class="ecx-dashboard"><article class="ecx-panel ecx-state"><h1>Economic Calendar</h1><p>${state.error}</p><button data-ecx-refresh>Retry</button></article></section>`;
  const source = state.source;
  const healthy = ["ONLINE","LIVE","SYNCED"].includes(source?.status);
  return `<section class="ecx-dashboard">
    <header class="ecx-header"><div><p>WORKSPACE / MARKET INTELLIGENCE / ECONOMIC CALENDAR</p><h1>Economic Calendar</h1><span>Real-time macroeconomic releases and central-bank events from configured adapters only.</span></div><aside>${badge(source?.status||"NOT_CONFIGURED")}<b>Source Mode: Live Adapters Only</b><b class="warning">Fabricated Rows: 0</b><div><button data-ecx-refresh>Refresh Calendar</button><button data-ecx-configure>Configure Sources</button><button data-ecx-export ${state.events.length?"":"disabled"}>Export Live Report</button></div></aside></header>
    <section class="ecx-stats">${[["Provider",source?.provider||"Provider Not Connected"],["Status",source?.status||"NOT_CONFIGURED"],["Freshness",source?.freshness||"UNAVAILABLE"],["Records",source?.records||0],["Adapter",source?.adapter||"none"]].map(([a,b])=>`<article><small>${a}</small><strong>${b}</strong><span>Live validation</span></article>`).join("")}</section>
    ${!healthy ? `<article class="ecx-panel ecx-state"><h2>No live economic calendar adapter is configured.</h2><p>${source?.configuration||"Configure a live economic-event provider to begin real-time ingestion."}</p><div><button data-ecx-configure>Open Source Configuration</button><button data-ecx-refresh>Retry Live Probe</button></div></article>` : ""}
    ${healthy && !state.events.length ? `<article class="ecx-panel ecx-state"><h2>No live economic events are available.</h2><p>The adapter is reachable, but it has not returned normalized event records yet. No sample events are rendered.</p><div><button data-ecx-refresh>Refresh Calendar</button><button data-ecx-configure>Review Adapter</button></div></article>` : ""}
    ${state.events.length ? `<section class="ecx-panel">${title("Today's Economic Event Table","Normalized live events returned by the configured adapter.",`${state.events.length} LIVE EVENTS`)}${table(["Time","Currency","Event","Impact","Previous","Forecast","Actual","Deviation","Affected Assets","Trading Action","Status"],state.events.map(item=>[item.time||"-",item.currency||"-",item.event||"-",badge(item.impact||"UNKNOWN"),item.previous||"-",item.forecast||"-",item.actual||"-",item.deviation||"-",item.affectedAssets||"-",item.tradingAction||"-",badge(item.status||"UNKNOWN")]))}</section>` : ""}
    ${state.restrictions.length ? `<section class="ecx-panel">${title("Trading Restriction Windows","Live event-protection windows returned by the adapter.",`${state.restrictions.length} WINDOWS`)}${table(["Event","Before","After","Assets","Action","Enforcement"],state.restrictions.map(item=>[item.event,`${item.before_minutes} min`,`${item.after_minutes} min`,item.assets?.join(", ")||"-",item.action||"-",badge(item.enforcement||"UNKNOWN")]))}</section>` : ""}
    ${state.centralBanks.length ? `<section class="ecx-panel">${title("Central Bank Watch Panel","Live central-bank records returned by the adapter.",`${state.centralBanks.length} BANKS`)}${table(["Bank","Next Event","Policy Bias","Last Rate","Expected Rate","Currency","Risk"],state.centralBanks.map(item=>[item.bank,item.nextEvent,badge(item.policyBias),item.lastRate,item.expectedRate,item.currencyImpact,badge(item.riskLevel)]))}</section>` : ""}
  </section>`;
}

async function load() {
  state = { ...state, loading:true, error:"" };
  const responses = await Promise.all([
    fetch(`${API}/api/market-intelligence/live/dashboard`,{cache:"no-store"}),
    fetch(`${API}/api/market-intelligence/economic-calendar/events`,{cache:"no-store"}),
    fetch(`${API}/api/market-intelligence/economic-calendar/restrictions`,{cache:"no-store"}),
    fetch(`${API}/api/market-intelligence/economic-calendar/asset-impact`,{cache:"no-store"}),
    fetch(`${API}/api/market-intelligence/economic-calendar/central-banks`,{cache:"no-store"})
  ]);
  if (responses.some(response=>!response.ok)) throw new Error("Live economic calendar request failed.");
  const [live,events,restrictions,assets,centralBanks] = await Promise.all(responses.map(response=>response.json()));
  state = { loading:false,error:"",source:live.sources?.find(item=>item.id==="economic-calendar")||null,events:events.events||[],restrictions:restrictions.restrictions||[],assets:assets.assets||[],centralBanks:centralBanks.centralBanks||[] };
}

export function bindEconomicCalendarCenter() {
  document.querySelectorAll("[data-ecx-refresh]").forEach(button=>button.addEventListener("click",mountEconomicCalendarCenter));
  document.querySelectorAll("[data-ecx-configure]").forEach(button=>button.addEventListener("click",()=>location.assign("/workspace/market-intelligence/source-configuration")));
  document.querySelector("[data-ecx-export]")?.addEventListener("click",()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),events:state.events,restrictions:state.restrictions,assets:state.assets,centralBanks:state.centralBanks},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="live-economic-calendar-report.json";a.click();URL.revokeObjectURL(a.href);});
}

export async function mountEconomicCalendarCenter() {
  const root = document.querySelector("#intelligence-content");
  root.innerHTML = renderEconomicCalendarCenter();
  try { await load(); } catch (reason) { state = { ...state,loading:false,error:reason.message }; }
  if (!location.pathname.endsWith("/economic-calendar")) return;
  root.innerHTML = renderEconomicCalendarCenter();
  bindEconomicCalendarCenter();
}
