const API = "http://localhost:8080";
const REFRESH_MS = 30000;
let refreshTimer;
let state = { loading: true, syncing: false, error: "", dashboard: null, selected: null, filters: { assetClass: "All", instrument: "All", source: "All", sentiment: "All", riskLevel: "All", q: "" } };

const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const badge = value => `<span class="ssx-badge ${String(value).toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}">${esc(value)}</span>`;
const table = (headers, rows) => `<div class="ssx-table-wrap"><table><thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No social intelligence records match the current view.</td></tr>`}</tbody></table></div>`;
const title = (heading, meta) => `<div class="ssx-section-title"><div><h2>${esc(heading)}</h2></div><b>${esc(meta)}</b></div>`;

function data() { return state.dashboard || {}; }
function summaryEntries() {
  const s = data().summary || {};
  return [
    ["Overall Crowd Sentiment", s.overallCrowdSentiment || "Mixed"], ["Bullish Mentions", s.bullishMentions || 0], ["Bearish Mentions", s.bearishMentions || 0], ["Neutral Mentions", s.neutralMentions || 0],
    ["Trending Instruments", s.trendingInstruments || "-"], ["Viral Topics", s.viralTopics || 0], ["Sentiment Shift", s.sentimentShift || "-"], ["Retail Risk Level", s.retailRiskLevel || "-"],
    ["Fear & Greed Score", s.fearGreedScore || 0], ["Contrarian Signal", s.contrarianSignal || "-"], ["High Activity Sources", s.highActivitySources || 0], ["Active Alerts", s.activeAlerts || 0]
  ];
}
function filteredFeed() {
  const filters = state.filters, q = filters.q.trim().toLowerCase();
  return (data().feed || []).filter(item =>
    (filters.instrument === "All" || item.instrument === filters.instrument) &&
    (filters.source === "All" || item.source === filters.source) &&
    (filters.sentiment === "All" || item.sentiment === filters.sentiment) &&
    (!q || `${item.preview} ${item.source} ${item.author} ${item.instrument}`.toLowerCase().includes(q))
  );
}
function optionList(values, selected) {
  return values.map(value => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(value)}</option>`).join("");
}
function renderFilters() {
  const feed = data().feed || [];
  const instruments = ["All", ...new Set(feed.map(item => item.instrument))];
  const sources = ["All", "X / Twitter", "Reddit", "StockTwits", "TradingView Ideas", "Telegram Channels", "Discord Communities", "YouTube Comments", "Forex Factory Forum", "BabyPips Forum", "Investing.com Comments", "Prop Firm Communities", "Manual Import", "RSS Feed"];
  return `<section class="ssx-panel ssx-filters">${title("Filters", "LIVE QUERY CONTROLS")}<div class="ssx-filter-grid">
    <label>Asset Class<select data-ssx-filter="assetClass">${optionList(["All","Forex","Metals","Indices","Commodities","Crypto","Prop Firm"], state.filters.assetClass)}</select></label>
    <label>Instrument<select data-ssx-filter="instrument">${optionList(instruments, state.filters.instrument)}</select></label>
    <label>Currency<select data-ssx-filter="currency">${optionList(["All","USD","EUR","GBP","JPY","AUD","CAD","CHF","NZD"], state.filters.currency || "All")}</select></label>
    <label>Source<select data-ssx-filter="source">${optionList(sources, state.filters.source)}</select></label>
    <label>Community<select data-ssx-filter="community">${optionList(["All","Retail FX","Crypto","Prop Firm","Macro","Index Traders"], state.filters.community || "All")}</select></label>
    <label>Sentiment<select data-ssx-filter="sentiment">${optionList(["All","Strong Bullish","Bullish","Neutral","Bearish","Strong Bearish","Mixed"], state.filters.sentiment)}</select></label>
    <label>Mention Volume<select data-ssx-filter="mentionVolume">${optionList(["All","High","Medium","Low"], state.filters.mentionVolume || "All")}</select></label>
    <label>Influencer Weight<select data-ssx-filter="influencerWeight">${optionList(["All","High","Medium","Low"], state.filters.influencerWeight || "All")}</select></label>
    <label>Language<select data-ssx-filter="language">${optionList(["All","English","Spanish","Arabic","French","Portuguese"], state.filters.language || "All")}</select></label>
    <label>Date Range<select data-ssx-filter="dateRange">${optionList(["Today","24H","7D","30D","Custom"], state.filters.dateRange || "Today")}</select></label>
    <label>Region<select data-ssx-filter="region">${optionList(["All","Global","US","Europe","Asia","Africa"], state.filters.region || "All")}</select></label>
    <label>Risk Level<select data-ssx-filter="riskLevel">${optionList(["All","Low","Medium","High","Extreme"], state.filters.riskLevel)}</select></label>
    <label class="ssx-search">Keyword<input data-ssx-filter="q" value="${esc(state.filters.q)}" placeholder="Search discussions..." /></label>
  </div></section>`;
}
function renderDrawer() {
  const item = state.selected;
  if (!item) return "";
  return `<div class="ssx-drawer-backdrop" data-ssx-close><aside class="ssx-drawer" onclick="event.stopPropagation()"><header><div><p>${esc(item.source)} / ${esc(item.instrument)}</p><h2>${esc(item.preview)}</h2></div><button data-ssx-close>Close</button></header>
    <section class="ssx-drawer-grid">${[["Author", item.author], ["Published", new Date(item.published).toLocaleString()], ["Sentiment Score", item.sentimentScore], ["AI Confidence", `${item.aiConfidence}%`], ["Engagement", item.engagement], ["Virality", item.viralityScore], ["Influence", item.influenceScore], ["Currency", item.instrument?.split("/")[1] || "USD"]].map(([a,b]) => `<span><small>${esc(a)}</small><strong>${esc(b)}</strong></span>`).join("")}</section>
    <section><h3>Full Content</h3><p>${esc(item.preview)}</p></section><section><h3>Related Topics</h3><p>${esc((item.relatedTopics || []).join(", "))}</p></section><section><h3>Related News</h3><p>${esc((item.relatedNews || []).join(" | ") || "No direct related news stored.")}</p></section><section><h3>Price Reaction Snapshot</h3><p>${esc(item.priceReactionSnapshot)}</p></section><section><h3>Trading Notes</h3><p>${esc(item.tradingNotes)}</p></section>
    <footer><button>Open Source</button><button>Save to Watchlist</button><button>Create Alert</button><button>Add Journal Note</button><button data-ssx-close>Mark Reviewed</button></footer></aside></div>`;
}
function renderChecklist(items = [], empty = "None required") {
  return items.length ? items.map(item => {
    const label = typeof item === "string" ? item : item.key;
    const configured = typeof item === "string" ? true : item.configured;
    return `<span class="ssx-check ${configured ? "ready" : "missing"}"><b>${esc(configured ? "CONFIGURED" : "MISSING")}</b>${esc(label)}</span>`;
  }).join("") : `<span class="ssx-muted">${esc(empty)}</span>`;
}
function renderPills(items = [], empty = "Not specified") {
  return items.length ? items.map(item => `<span class="ssx-pill">${esc(item)}</span>`).join("") : `<span class="ssx-muted">${esc(empty)}</span>`;
}
function formatLastSync(value) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Never" : date.toLocaleString();
}
function renderSourceCards(sources = []) {
  return `<div class="ssx-source-grid">${sources.map(source => `<article class="ssx-source-card">
    <header><div><p>${esc(source.connectionType)}</p><h3>${esc(source.source)}</h3><span>${esc(source.accountType)}</span></div><div>${badge(source.status)}${badge(source.setupStatus || "UNKNOWN")}</div></header>
    <section class="ssx-source-metrics">
      <span><small>Last Sync</small><strong>${esc(formatLastSync(source.lastSync))}</strong></span>
      <span><small>Posts Imported</small><strong>${esc(source.postsImported)}</strong></span>
      <span><small>Errors</small><strong>${esc(source.errorCount)}</strong></span>
      <span><small>Trust</small><strong>${esc(source.trustScore)}</strong></span>
    </section>
    <section><h4>Credential Requirements</h4><div class="ssx-check-list">${renderChecklist(source.credentials, "No required secret; configure symbols/channels as needed.")}</div></section>
    <section><h4>Optional Configuration</h4><div class="ssx-check-list">${renderChecklist(source.optionalConfig, "No optional keys")}</div></section>
    <section><h4>Required Permissions</h4><div class="ssx-pill-list">${renderPills(source.requiredPermissions)}</div></section>
    <section><h4>Data Captured</h4><div class="ssx-pill-list">${renderPills(source.dataCaptured)}</div></section>
    <section><h4>Health Checks</h4><div class="ssx-pill-list">${renderPills(source.healthChecks)}</div></section>
    <section class="ssx-source-policy"><h4>Rate Limit Policy</h4><p>${esc(source.rateLimitPolicy || source.rateLimitStatus)}</p><h4>Next Action</h4><p>${esc(source.nextAction)}</p><b>Production Only: ${source.productionOnly ? "YES" : "NO"} / Mock Data: ${source.mockData ? "YES" : "NO"}</b></section>
    <footer><button data-ssx-sync>${state.syncing ? "Syncing..." : "Sync Now"}</button><button>Test Connection</button><button data-ssx-configure>Configure</button><button>View Logs</button></footer>
  </article>`).join("")}</div>`;
}
export function renderSocialSentimentCenter() {
  if (state.loading) return `<section class="ssx-dashboard"><section class="ssx-panel ssx-state"><h1>Social Sentiment Intelligence Center</h1><p>Synchronizing crowd mood and source health...</p></section></section>`;
  if (state.error) return `<section class="ssx-dashboard"><section class="ssx-panel ssx-state"><h1>Social Sentiment Intelligence Center</h1><p>${esc(state.error)}</p><button data-ssx-refresh>Retry</button></section></section>`;
  const d = data(), status = d.statusBadges || {}, ai = d.aiInterpretation || {}, fear = d.fearGreed || {};
  const feed = filteredFeed();
  return `<section class="ssx-dashboard">
    <header class="ssx-header"><div><p>WORKSPACE / MARKET INTELLIGENCE / SOCIAL SENTIMENT</p><h1>Social Sentiment Intelligence Center</h1><span>Track crowd mood, trader discussions, viral market narratives, and social trading sentiment across global financial communities.</span></div><aside><b>Social Feed: ${esc(status.socialFeed || "Active")}</b><b>AI Sentiment Engine: ${esc(status.aiSentimentEngine || "Online")}</b><b>Last Sync: ${esc(status.lastSync || "Today")}</b><b>Sources Connected: ${esc(status.sourcesConnected || "0")}</b><div><button data-ssx-refresh>Refresh Sentiment</button><button data-ssx-sync>${state.syncing ? "Syncing..." : "Sync Social Feeds"}</button><button data-ssx-configure>Configure Sources</button><button data-ssx-alert>Create Alert</button><button data-ssx-export>Export Report</button></div></aside></header>
    <section class="ssx-summary">${summaryEntries().map(([label, value]) => `<article><small>${esc(label)}</small><strong>${esc(value)}</strong></article>`).join("")}</section>
    ${d.empty ? `<section class="ssx-panel ssx-empty"><h2>No social sentiment source connected.</h2><p>Connect a social feed or import production social data to begin crowd sentiment analysis. No demo or mock social posts are displayed.</p><div><button data-ssx-configure>Configure Sources</button><button data-ssx-import>Import Social Data</button></div></section>` : ""}
    ${renderFilters()}
    <section class="ssx-panel">${title("Live Social Feed", `${feed.length} POSTS`)}${table(["Post / Comment","Source","Author","Published","Instrument","Sentiment","Engagement","Influence Score","Virality Score","Status"], feed.map(item => [`<button class="ssx-post" data-ssx-detail="${esc(item.id)}">${esc(item.preview)}<small>AI confidence ${esc(item.aiConfidence)}%</small></button>`, esc(item.source), esc(item.author), esc(new Date(item.published).toLocaleString()), `<span class="ssx-tags">${esc(item.instrument)}</span>`, badge(item.sentiment), esc(item.engagement), esc(item.influenceScore), esc(item.viralityScore), `${badge(item.status)}<div class="ssx-row-actions"><button>Add to watchlist</button><button>Create alert</button></div>`]))}</section>
    <section class="ssx-panel ssx-ai">${title("AI Crowd Interpretation", "CROWD ANALYSIS")}<p>${esc(ai.dominantNarrative)}</p><div class="ssx-ai-grid"><article><h3>Bullish Crowd Arguments</h3><p>${esc((ai.bullishArguments || []).join(" | "))}</p></article><article><h3>Bearish Crowd Arguments</h3><p>${esc((ai.bearishArguments || []).join(" | "))}</p></article><article><h3>Overcrowded Trade Risks</h3><p>${esc((ai.overcrowdedTradeRisks || []).join(", "))}</p></article><article><h3>Contrarian Warning</h3><p>${esc(ai.contrarianWarning)}</p></article><article><h3>Sentiment Shift</h3><p>${esc(ai.sentimentShiftExplanation)}</p></article><article><h3>Risk Mood</h3><p>${esc(ai.riskMood)}</p></article></div><footer><button>Regenerate Summary</button><button>Save Analysis</button><button>Export Brief</button><button>Send to Journal</button></footer></section>
    <section class="ssx-panel">${title("Sentiment Heatmap", `${(d.heatmap || []).length} INSTRUMENTS`)}${table(["Instrument","Mentions","Bullish %","Bearish %","Neutral %","Sentiment Score","Virality","Contrarian Risk"], (d.heatmap || []).map(row => [esc(row.symbol), esc(row.mentions), `${esc(row.bullish)}%`, `${esc(row.bearish)}%`, `${esc(row.neutral)}%`, esc(row.sentimentScore), esc(row.virality), badge(row.contrarianRisk)]))}</section>
    <div class="ssx-grid"><section class="ssx-panel">${title("Trending Topics Panel", `${(d.topics || []).length} TOPICS`)}${table(["Topic","Related Instrument","Mention Volume","Sentiment","Virality Score","Source Count","First Detected","Status"], (d.topics || []).map(row => [esc(row.topic), esc(row.instrument), esc(row.mentionVolume), badge(row.sentiment), esc(row.viralityScore), esc(row.sourceCount), esc(row.firstDetected), badge(row.status)]))}</section><section class="ssx-panel">${title("Fear & Greed / Crowd Risk", `SCORE ${fear.score || 0}`)}<div class="ssx-risk-list">${[["Fear & Greed Score", fear.score],["Crowd Leverage Risk", fear.crowdLeverageRisk],["Overcrowded Longs", fear.overcrowdedLongs],["Overcrowded Shorts", fear.overcrowdedShorts],["Contrarian Setup", fear.contrarianSetup],["Retail Panic Signal", fear.retailPanicSignal],["FOMO Signal", fear.fomoSignal]].map(([a,b]) => `<article><small>${esc(a)}</small><strong>${esc(b)}</strong></article>`).join("")}</div></section></div>
    <section class="ssx-panel">${title("Social Sentiment Sources", `${(d.sources || []).length} SOURCES`)}${renderSourceCards(d.sources || [])}</section>
    <div class="ssx-grid"><section class="ssx-panel">${title("Alerts", `${(d.alerts || []).length} ACTIVE`)}${table(["Alert","Instrument","Risk","Delivery","Status"], (d.alerts || []).map(alert => [esc(alert.alert), esc(alert.instrument), badge(alert.riskLevel), esc(alert.delivery), badge(alert.status)]))}</section><section class="ssx-panel">${title("Correlation With Other Modules", `${(d.correlations || []).length} SIGNALS`)}${table(["Instrument","Social","News","COT","Calendar","Technical","Interpretation"], (d.correlations || []).map(row => [esc(row.instrument), esc(row.social), esc(row.news), esc(row.cot), esc(row.economicCalendar), esc(row.technicalSignals), esc(row.interpretation)]))}</section></div>
    ${renderDrawer()}
  </section>`;
}
async function request(path, options) { const response = await fetch(`${API}${path}`, { cache: "no-store", ...options }); if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`); return response.json(); }
async function load({ sync = false } = {}) { if (sync) { state.syncing = true; render(); await request("/api/market-intelligence/social-sentiment/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); } state = { ...state, loading: false, syncing: false, error: "", dashboard: await request("/api/market-intelligence/social-sentiment") }; }
function render() { const root = document.querySelector("#intelligence-content"); if (!root || !location.pathname.endsWith("/social-sentiment")) return; root.innerHTML = renderSocialSentimentCenter(); bindSocialSentimentCenter(); }
export function bindSocialSentimentCenter() {
  document.querySelectorAll("[data-ssx-refresh]").forEach(button => button.addEventListener("click", async () => { try { await load(); } catch (reason) { state = { ...state, loading: false, syncing: false, error: reason.message }; } render(); }));
  document.querySelectorAll("[data-ssx-sync]").forEach(button => button.addEventListener("click", async () => { try { await load({ sync: true }); } catch (reason) { state = { ...state, loading: false, syncing: false, error: reason.message }; } render(); }));
  document.querySelectorAll("[data-ssx-configure]").forEach(button => button.addEventListener("click", () => location.assign("/workspace/market-intelligence/source-configuration")));
  document.querySelectorAll("[data-ssx-import]").forEach(button => button.addEventListener("click", () => location.assign("/workspace/market-intelligence/source-configuration")));
  document.querySelectorAll("[data-ssx-filter]").forEach(input => input.addEventListener("change", event => { state.filters[event.target.dataset.ssxFilter] = event.target.value; render(); }));
  document.querySelectorAll("[data-ssx-detail]").forEach(button => button.addEventListener("click", () => { state.selected = (data().feed || []).find(item => item.id === button.dataset.ssxDetail); render(); }));
  document.querySelectorAll("[data-ssx-close]").forEach(button => button.addEventListener("click", () => { state.selected = null; render(); }));
  document.querySelector("[data-ssx-export]")?.addEventListener("click", () => { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), dashboard: data() }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "social-sentiment-report.json"; a.click(); URL.revokeObjectURL(a.href); });
  document.querySelector("[data-ssx-alert]")?.addEventListener("click", () => alert("Alert workflow ready. Connect notification providers to enable delivery."));
}
export async function mountSocialSentimentCenter() { clearInterval(refreshTimer); render(); try { await load(); } catch (reason) { state = { ...state, loading: false, syncing: false, error: reason.message }; } render(); refreshTimer = setInterval(async () => { if (!location.pathname.endsWith("/social-sentiment")) return clearInterval(refreshTimer); try { await load(); render(); } catch {} }, REFRESH_MS); }
export function unmountSocialSentimentCenter() { clearInterval(refreshTimer); }
