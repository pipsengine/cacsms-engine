let cache;
let loadError;
let loading;

const workflow = [
  ["STAGE 1", "Market Intelligence", "Institutional market context"],
  ["STAGE 3", "Asset Ranking", "Improves relative currency ranking"],
  ["STAGE 4", "Market Analysis", "Validates directional bias"],
  ["STAGE 6", "AI Decision", "Modifies decision confidence"],
  ["STAGE 7", "AI Debate", "Adds positioning evidence"],
  ["STAGE 8", "Strategy Intelligence", "Guides strategy suitability"],
  ["STAGE 9", "Risk Validation", "Flags crowded-position risk"],
];
const fmt = value => `${Number(value) >= 0 ? "+" : ""}${Number(value).toLocaleString()}`;
const tone = bias => String(bias || "neutral").toLowerCase().replaceAll(" ", "-");
const selectedCode = () => new URLSearchParams(location.search).get("currency") || "EUR";
const mappingFor = code => cache?.mappings.find(item => item.code === code);
const rowsFor = code => cache?.history[code] || [];
const button = (label, action = "") => `<button${action ? ` data-cot-action="${action}"` : ""}>${label}</button>`;
const table = (heads, rows, cls = "") => `<div class="cot-table-wrap ${cls}"><table><thead><tr>${heads.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(x => `<td>${x}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${heads.length}">No official CFTC Futures Only records are available for this mapping.</td></tr>`}</tbody></table></div>`;
const path = (values, w = 560, h = 120) => {
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  return values.map((value, index) => `${index ? "L" : "M"}${(index / Math.max(values.length - 1, 1) * w).toFixed(1)},${(h - (value - min) / span * (h - 18) - 9).toFixed(1)}`).join(" ");
};
const chart = (title, detail, series) => `<section class="cot-card cot-chart"><div class="cot-title"><div><h2>${title}</h2><p>${detail}</p></div><div class="cot-ranges"><b>3M</b><span>6M</span><span>1Y</span><span>ALL</span></div></div><svg viewBox="0 0 560 145" preserveAspectRatio="none"><line x1="0" y1="124" x2="560" y2="124"/><line x1="0" y1="70" x2="560" y2="70"/><line x1="0" y1="16" x2="560" y2="16"/>${series.map(([name, values, color], index) => `<path class="cot-chart-line" d="${path(values.slice().reverse())}" style="stroke:${color}"/><text x="${12 + index * 150}" y="141" fill="${color}">${name}</text>`).join("")}</svg></section>`;

function rerender() {
  if (!location.pathname.endsWith("/institutional-cot")) return;
  document.querySelector("#intelligence-content").innerHTML = renderInstitutionalCotCenter();
  bindInstitutionalCotCenter();
}

async function loadCotData() {
  if (loading) return;
  loading = true;
  loadError = undefined;
  try {
    const response = await fetch("/data/institutional-cot.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`CFTC cache request failed (${response.status})`);
    cache = await response.json();
  } catch (error) {
    loadError = error;
  } finally {
    loading = false;
    rerender();
  }
}

function renderLoading() {
  return `<section class="cot-dashboard"><section class="cot-card"><h1>Institutional / COT Data</h1><p>Loading official CFTC Futures Only positioning data...</p></section></section>`;
}

function renderError() {
  return `<section class="cot-dashboard"><section class="cot-card"><h1>Institutional / COT Data</h1><h2>Official CFTC data could not be loaded.</h2><p>${loadError?.message || "The generated CFTC cache is unavailable."}</p>${button("Retry Official Data Load", "retry")}</section></section>`;
}

export function renderInstitutionalCotCenter() {
  if (!cache) return loadError ? renderError() : renderLoading();
  const requested = selectedCode();
  const code = requested === "ALL" || mappingFor(requested) ? requested : "EUR";
  if (code === "ALL") return renderAllCurrencies();
  const mapping = mappingFor(code);
  const history = rowsFor(code);
  if (!history.length) return renderUnavailable(code, mapping);
  const latest = history[0], previous = history[1] || latest;
  const total = Object.values(cache.history).reduce((sum, rows) => sum + rows.length, 0);
  const comparison = cache.mappings.map(item => {
    const row = rowsFor(item.code)[0];
    return row ? [item.code, item.name, row.date, row.long.toLocaleString(), row.short.toLocaleString(), fmt(row.net), fmt(row.changeLong - row.changeShort), `<b class="cot-bias ${tone(row.bias)}">${row.bias}</b>`, `${row.confidence}%`, "Context modifier"] : [item.code, item.name, "No records", "-", "-", "-", "-", `<b class="cot-bias neutral">Unavailable</b>`, "-", "Mapping requires source review"];
  });
  const historyRows = history.map(row => [row.date, row.code, row.long.toLocaleString(), row.short.toLocaleString(), fmt(row.changeLong), fmt(row.changeShort), `${fmt(row.percent)}%`, fmt(row.net), row.oi.toLocaleString(), `${row.longPct}%`, `${row.shortPct}%`, `${row.netPct}%`, row.commercialLong.toLocaleString(), row.commercialShort.toLocaleString(), row.spreading.toLocaleString(), `<b class="cot-bias ${tone(row.bias)}">${row.bias}</b>`]);
  return `<section class="cot-dashboard">
  <header class="cot-header"><div><p>03 / MARKET INTELLIGENCE CENTER / CFTC FUTURES ONLY</p><h1>Institutional / COT Data</h1><span>Official CFTC Futures Only Commitments of Traders positioning, converted into institutional bias intelligence.</span></div><aside><b>SOURCE / CFTC HISTORICAL COMPRESSED</b><b>SCHEDULE / SATURDAY 12:00AM</b><b>LATEST / ${cache.latestReportDate}</b><b class="ok">SYNCED</b><small>WORKFLOW INPUT / STAGE 1</small></aside></header>
  <div class="cot-header-actions">${button("Sync Now", "sync-now")}${button("Validate Latest Report", "validate")}${button("Export COT Report", "export")}</div>
  <section class="cot-card cot-sync"><div class="cot-title"><div><small>OFFICIAL SOURCE CONTROL</small><h2>COT DATA SYNC CENTER</h2><p>Automated weekly CFTC Historical Compressed Futures Only Reports synchronization.</p></div><b class="cot-bias bullish">SYNCED</b></div><div class="cot-sync-grid">${[["Data Source", cache.source], ["Report Type", cache.reportType], ["Schedule", "Saturday / 12:00am"], ["Cron", "0 0 * * 6"], ["Cache Generated", new Date(cache.syncedAt).toLocaleString()], ["Latest Report", cache.latestReportDate], ["Official Rows Imported", total.toLocaleString()], ["Source Year", cache.year], ["Archive", `deacot${cache.year}.zip`], ["Retry Policy", "3 attempts"]].map(([a, b]) => `<span><small>${a}</small><strong>${b}</strong></span>`).join("")}</div><div class="cot-inline-actions">${button("Sync Now", "sync-now")}${button("Validate Latest Report", "validate")}<a href="${cache.archiveUrl}">Download Raw CFTC Archive</a><a href="${cache.sourceUrl}">Open CFTC Source</a></div></section>
  ${renderSelector(code)}
  <section class="cot-status">${[["Selected Currency", code], ["Latest Bias", latest.bias], ["Net Position", fmt(latest.net)], ["Long", latest.long.toLocaleString()], ["Short", latest.short.toLocaleString()], ["Change Long", fmt(latest.changeLong)], ["Change Short", fmt(latest.changeShort)], ["% Change", `${fmt(latest.percent)}%`], ["Report Date", latest.date], ["Bias Confidence", `${latest.confidence}%`]].map(([a, b], index) => `<article><small>${a}</small><strong class="${index === 1 ? `tone-${tone(latest.bias)}` : ""}">${b}</strong></article>`).join("")}</section>
  <section class="cot-kpis">${[["Latest Long Positions", latest.long, previous.long], ["Latest Short Positions", latest.short, previous.short], ["Net Positions", latest.net, previous.net], ["Change Long", latest.changeLong, previous.changeLong], ["Change Short", latest.changeShort, previous.changeShort], ["% Change", `${fmt(latest.percent)}%`, `${fmt(previous.percent)}%`], ["Bias", latest.bias, previous.bias], ["Bias Confidence", `${latest.confidence}%`, `${previous.confidence}%`], ["Open Interest", latest.oi, previous.oi], ["Report Date", latest.date, previous.date]].map(([a, b, c]) => `<article><small>${a}</small><strong>${typeof b === "number" ? fmt(b) : b}</strong><span>PREVIOUS / ${typeof c === "number" ? fmt(c) : c}</span></article>`).join("")}</section>
  <section class="cot-card cot-history"><div class="cot-title"><div><h2>${code} SELECTED CURRENCY COT HISTORY</h2><p>Official Futures Only records sorted by report date descending.</p></div>${button("Export CSV", "export")}</div>${table(["Date", "CCY", "Long", "Short", "Change Long", "Change Short", "% Change", "Net", "Open Interest", "Long %", "Short %", "Net % OI", "Comm Long", "Comm Short", "Spreading", "Bias"], historyRows, "cot-history-table")}</section>
  <div class="cot-grid-3">${chart("Long vs Short Position Chart", `${code} non-commercial positions`, [["LONG", history.map(x => x.long), "#16A34A"], ["SHORT", history.map(x => x.short), "#DC2626"]])}${chart("Net Position Trend Chart", `Latest ${fmt(latest.net)} contracts`, [["NET POSITION", history.map(x => x.net), latest.net >= 0 ? "#0F766E" : "#DC2626"]])}${chart("Change Long / Change Short Chart", "Weekly positioning shifts", [["CHANGE LONG", history.map(x => x.changeLong), "#2563EB"], ["CHANGE SHORT", history.map(x => x.changeShort), "#F59E0B"]])}</div>
  <section class="cot-card cot-interpretation"><div class="cot-title"><div><h2>BIAS INTERPRETATION PANEL</h2><p>Official weekly positioning translated for downstream agents.</p></div><b class="cot-bias ${tone(latest.bias)}">${latest.bias}</b></div><p><b>Reason:</b> Non-commercial longs changed by ${fmt(latest.changeLong)} and shorts changed by ${fmt(latest.changeShort)}. Net positioning is ${fmt(latest.net)} contracts.</p><p><b>Trading interpretation:</b> Use ${code} positioning as institutional context when structure, liquidity and risk conditions align.</p><p><b>Warning:</b> COT is weekly and lagging; do not use it for intraday execution alone.</p></section>
  <section class="cot-card"><div class="cot-title"><div><h2>COT CURRENCY COMPARISON MATRIX</h2><p>Source-honest comparison across configured mappings.</p></div><b>${cache.mappings.length} CONFIGURED MARKETS</b></div>${table(["CCY", "Currency", "Latest Date", "Long", "Short", "Net", "Weekly Change", "Bias", "Confidence", "Workflow Impact"], comparison)}</section>
  <section class="cot-card"><div class="cot-title"><div><h2>COT SYNC HISTORY & LOGS</h2><p>Current generated-cache audit record.</p></div><b>OFFICIAL ARCHIVE</b></div>${table(["Sync ID", "Completed", "Status", "Source", "Year", "Imported", "Latest Report"], [[`cot-${cache.year}-${cache.latestReportDate}`, new Date(cache.syncedAt).toLocaleString(), "SYNCED", `<a href="${cache.sourceUrl}">CFTC Historical Compressed</a>`, cache.year, total.toLocaleString(), cache.latestReportDate]])}</section>
  <section class="cot-card cot-workflow"><div class="cot-title"><div><h2>WORKFLOW IMPACT PANEL</h2><p>COT modifies context and confidence. It never executes trades alone.</p></div><b>7 CONNECTED STAGES</b></div><div>${workflow.map(([a, b, c]) => `<article><small>${a}</small><strong>${b}</strong><span>${c}</span></article>`).join("")}</div></section>
  <section class="cot-card cot-actions"><div class="cot-title"><div><h2>COT ACTION CENTER</h2><p>Synchronization, validation and export controls.</p></div></div><div>${button("Sync Now", "sync-now")}${button("Validate Latest Report", "validate")}${button("Export Selected Currency", "export")}${button("Open Sync Logs", "logs")}</div></section></section>`;
}

function renderSelector(code) {
  return `<section class="cot-card cot-selector"><div class="cot-title"><div><h2>COT CURRENCY SELECTOR</h2><p>Select a currency with records in the official archive or toggle the full comparison view.</p></div><span>URL FILTER / ?currency=${code}</span></div><div><button data-cot-currency="ALL" class="${code === "ALL" ? "active" : ""}"><b>ALL</b><span>All Currencies</span><small>Comparison matrix / ${cache.mappings.length} mappings</small></button>${cache.mappings.map(item => {
    const records = rowsFor(item.code), row = records[0], available = records.length > 0;
    return `<button data-cot-currency="${item.code}" class="${item.code === code ? "active" : ""}" ${available ? "" : "disabled"}><b>${item.code}</b><span>${item.name}</span><small>${available ? `Bias: ${row.bias} / Records: ${records.length}` : "No official source records"}</small></button>`;
  }).join("")}</div></section>`;
}

function renderAllCurrencies() {
  const total = Object.values(cache.history).reduce((sum, rows) => sum + rows.length, 0);
  const available = cache.mappings.filter(item => rowsFor(item.code).length).length;
  const combined = cache.mappings.flatMap(item => rowsFor(item.code)).sort((left, right) => right.date.localeCompare(left.date) || left.code.localeCompare(right.code));
  const history = combined.map(row => [row.date, row.code, row.name, row.long.toLocaleString(), row.short.toLocaleString(), fmt(row.changeLong), fmt(row.changeShort), `${fmt(row.percent)}%`, fmt(row.net), row.oi.toLocaleString(), `${row.netPct}%`, `<b class="cot-bias ${tone(row.bias)}">${row.bias}</b>`, `${row.confidence}%`]);
  return `<section class="cot-dashboard"><header class="cot-header"><div><p>03 / MARKET INTELLIGENCE CENTER / CFTC FUTURES ONLY</p><h1>Institutional / COT Data</h1><span>All-currency history mode using official CFTC Futures Only positioning.</span></div><aside><b>SOURCE / CFTC HISTORICAL COMPRESSED</b><b>LATEST / ${cache.latestReportDate}</b><b class="ok">ALL CURRENCIES</b></aside></header>${renderSelector("ALL")}<section class="cot-status">${[["View", "All Currency History"], ["Available Mappings", `${available} / ${cache.mappings.length}`], ["Official Rows", total.toLocaleString()], ["Latest Report", cache.latestReportDate], ["Source Year", cache.year], ["Sort Order", "Newest First"]].map(([a, b]) => `<article><small>${a}</small><strong>${b}</strong></article>`).join("")}</section><section class="cot-card cot-history"><div class="cot-title"><div><h2>ALL CURRENCIES COT HISTORY</h2><p>Every available official CFTC Futures Only currency record merged and sorted newest first.</p></div>${button("Export COT Report", "export")}</div>${table(["Date", "CCY", "Currency", "Long", "Short", "Change Long", "Change Short", "% Change", "Net", "Open Interest", "Net % OI", "Bias", "Confidence"], history, "cot-history-table")}</section><section class="cot-card cot-workflow"><div class="cot-title"><div><h2>WORKFLOW IMPACT PANEL</h2><p>All-currency mode supports relative ranking and cross-market institutional context.</p></div><b>7 CONNECTED STAGES</b></div><div>${workflow.map(([a, b, c]) => `<article><small>${a}</small><strong>${b}</strong><span>${c}</span></article>`).join("")}</div></section></section>`;
}

function renderUnavailable(code, mapping) {
  return `<section class="cot-dashboard"><header class="cot-header"><div><h1>Institutional / COT Data</h1><span>Official CFTC Futures Only Commitments of Traders positioning.</span></div></header>${renderSelector(code)}<section class="cot-card"><h2>${code} has no official CFTC Futures Only records in the ${cache.year} Legacy archive.</h2><p>${mapping?.market || "This mapping"} remains configured but no values are fabricated. Select an available market or review the mapping.</p>${button("Sync Now", "sync-now")}</section></section>`;
}

export function bindInstitutionalCotCenter() {
  if (!cache && !loading && !loadError) loadCotData();
  document.querySelectorAll("[data-cot-currency]").forEach(element => element.addEventListener("click", () => {
    const url = new URL(location.href);
    url.searchParams.set("currency", element.dataset.cotCurrency);
    history.replaceState({}, "", url);
    rerender();
  }));
  document.querySelectorAll("[data-cot-action]").forEach(element => element.addEventListener("click", async () => {
    const action = element.dataset.cotAction;
    if (action === "retry") return loadCotData();
    if (action === "export") return window.open("/data/institutional-cot.json", "_blank");
    if (action === "logs") return document.querySelector(".cot-actions")?.scrollIntoView({ behavior: "smooth" });
    const endpoint = action === "validate" ? "validate-latest" : "sync-now";
    element.disabled = true;
    element.textContent = action === "validate" ? "Validating..." : "Sync Requested...";
    try {
      await fetch(`http://localhost:8080/api/market-intelligence/institutional-cot/${endpoint}`, { method: "POST" });
      if (action === "sync-now") setTimeout(loadCotData, 1800);
    } finally {
      setTimeout(rerender, 800);
    }
  }));
}
