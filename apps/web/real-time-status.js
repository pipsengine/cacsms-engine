const API = "http://localhost:8080";
const TICK_REFRESH_MS = 1000;
const OFFLINE_RETRY_MS = 15000;
const STALE_AFTER_MS = 15000;
const NIGERIA_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Africa/Lagos"
});

function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number >= 100 ? number.toFixed(2) : number.toFixed(5);
}

function ensureTicker() {
  const statusbar = document.querySelector(".statusbar");
  if (!statusbar) return null;
  let ticker = document.querySelector("#live-tick-status");
  if (ticker) return ticker;
  ticker = document.createElement("div");
  ticker.id = "live-tick-status";
  ticker.className = "live-tick-status waiting";
  ticker.innerHTML = '<span class="dot"></span> TICK <strong>WAITING FOR MT5</strong>';
  const spacer = statusbar.querySelector(".status-spacer");
  statusbar.insertBefore(ticker, spacer || null);
  return ticker;
}

function updateClock() {
  const clock = document.querySelector("#utc-clock");
  if (clock) clock.textContent = `WAT ${NIGERIA_TIME_FORMAT.format(new Date())}`;
}

function renderTicks(payload) {
  const ticker = ensureTicker();
  if (!ticker) return;
  const ticks = Array.isArray(payload?.ticks) ? payload.ticks : [];
  if (!ticks.length) {
    ticker.className = "live-tick-status waiting";
    ticker.innerHTML = '<span class="dot"></span> TICK <strong>WAITING FOR MT5</strong>';
    return;
  }
  const latest = payload.observedAt ? new Date(payload.observedAt).getTime() : 0;
  const stale = !latest || Date.now() - latest > STALE_AFTER_MS;
  const quotes = ticks.slice(0, 4).map((tick) => `${tick.symbol} ${formatPrice(tick.bid)}/${formatPrice(tick.ask)}`).join("  ");
  ticker.className = `live-tick-status ${stale ? "stale" : "live"}`;
  ticker.innerHTML = `<span class="dot"></span> TICK <strong>${stale ? "STALE" : "LIVE"}</strong><span>${quotes}</span>`;
}

async function refreshTicks() {
  let delay = TICK_REFRESH_MS;
  try {
    const response = await fetch(`${API}/api/market-data/ticks/latest?limit=8`, { cache: "no-store" });
    if (!response.ok) throw new Error(`tick request failed (${response.status})`);
    renderTicks(await response.json());
  } catch {
    delay = OFFLINE_RETRY_MS;
    const ticker = ensureTicker();
    if (!ticker) return;
    ticker.className = "live-tick-status offline";
    ticker.innerHTML = '<span class="dot"></span> TICK <strong>OFFLINE</strong>';
  } finally {
    window.setTimeout(refreshTicks, delay);
  }
}

export function installRealTimeStatus() {
  if (window.__cacsmsRealTimeStatusInstalled) return;
  window.__cacsmsRealTimeStatusInstalled = true;
  updateClock();
  refreshTicks();
  setInterval(updateClock, 1000);
}

installRealTimeStatus();
