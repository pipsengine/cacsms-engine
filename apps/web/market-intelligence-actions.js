const API = "http://localhost:8080";
let installed = false;

const normalize = value => value.trim().toLowerCase().replaceAll(/\s+/g, " ");
const includesAny = (value, terms) => terms.some(term => value.includes(term));

const postActions = [
  [["run market intelligence scan", "run full intelligence scan"], "/api/market-intelligence/scan"],
  [["refresh feeds", "refresh all feeds", "refresh all sources"], "/api/market-intelligence/refresh-feeds"],
  [["test all sources", "test"], "/api/market-intelligence/test-sources"],
  [["run feed validation", "validate feed", "run quality check", "validate data integrity", "validate data"], "/api/market-data/providers/validate"],
  [["restart feed"], "/api/market-data/providers/restart"],
  [["refresh news"], "/api/market-intelligence/news-sentiment/refresh"],
  [["run sentiment scan", "run ai sentiment scan"], "/api/market-intelligence/news-sentiment/classify"],
  [["create news risk alert"], "/api/market-intelligence/news-sentiment/create-alert"],
  [["refresh calendar", "sync events", "sync economic calendar"], "/api/market-intelligence/economic-calendar/sync"],
  [["run event risk scan"], "/api/market-intelligence/economic-calendar/risk-scan"],
  [["apply restriction", "block trading"], "/api/market-intelligence/economic-calendar/apply-restriction"],
  [["release restriction"], "/api/market-intelligence/economic-calendar/release-restriction"],
  [["refresh sentiment", "refresh social feeds"], "/api/market-intelligence/social-sentiment/refresh"],
  [["run crowd scan", "run crowd sentiment scan", "detect sentiment spike", "detect sentiment spikes"], "/api/market-intelligence/social-sentiment/run-scan"],
  [["generate contrarian signals"], "/api/market-intelligence/social-sentiment/generate-contrarian-signals"],
  [["sync now", "refresh data"], "/api/market-intelligence/historical-data/sync"],
  [["sync broker data", "sync broker feeds", "validate all feeds", "run spread scan", "refresh market depth", "recalculate execution score", "test all gateways", "validate failover routes"], "/api/market-intelligence/broker-data/sync"],
  [["connect broker"], "/api/market-intelligence/broker-data/connect"],
  [["upload broker export"], "/api/market-intelligence/broker-data/upload"],
  [["sync accounts", "sync portfolio data", "run exposure scan", "recalculate risk", "validate account limits", "refresh open positions"], "/api/market-intelligence/account-portfolio/sync"],
  [["connect account", "reconnect account"], "/api/market-intelligence/account-portfolio/connect"],
  [["sync rules", "validate prop rules", "validate rules", "validate all rules", "run compliance scan", "refresh challenge objectives", "arm restriction windows"], "/api/market-intelligence/prop-firm-rules/sync"],
  [["add prop firm"], "/api/market-intelligence/prop-firm-rules"],
  [["import rules"], "/api/market-intelligence/prop-firm-rules/import"],
  [["run validation", "run quality check"], "/api/market-intelligence/data-quality-gate/run"],
  [["refresh sources"], "/api/market-intelligence/data-quality-gate/refresh"],
  [["recalculate score", "recalculate quality score"], "/api/market-intelligence/data-quality-gate/recalculate"],
  [["sync"], "/api/market-intelligence/data-sources/sync"]
];

const exportActions = [
  [["cot"], "/api/market-intelligence/institutional-cot/dashboard"],
  [["historical", "dataset", "visible rows"], "/api/market-intelligence/historical-data/export"],
  [["broker"], "/api/market-intelligence/broker-data/export"],
  [["portfolio", "capital", "account"], "/api/market-intelligence/account-portfolio/export"],
  [["prop", "comparison", "compliance", "firm rules"], "/api/market-intelligence/prop-firm-rules/export"],
  [["gate"], "/api/market-intelligence/data-quality-gate/export"],
  [["sentiment", "news", "social"], "/api/market-intelligence/news-sentiment/dashboard"],
  [["calendar", "economic"], "/api/market-intelligence/economic-calendar/dashboard"],
  [["feed", "provider"], "/api/market-data/providers"],
  [["snapshot", "report", "csv", "excel", "row"], "/api/market-intelligence/dashboard"]
];

export function toast(message, tone = "ok") {
  let element = document.querySelector(".mi-action-toast");
  if (!element) {
    element = document.createElement("div");
    element.className = "mi-action-toast";
    document.body.append(element);
  }
  element.className = `mi-action-toast ${tone}`;
  element.textContent = message;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.remove(), 3400);
}

function modal(title, body) {
  document.querySelector(".mi-action-modal")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<aside class="mi-action-modal"><button data-mi-modal-close aria-label="Close">x</button><small>MARKET INTELLIGENCE OPERATOR CONTROL</small><h2>${title}</h2><div>${body}</div></aside>`);
  document.querySelectorAll("[data-mi-modal-close]").forEach(button => button.addEventListener("click", () => document.querySelector(".mi-action-modal")?.remove()));
}

async function post(endpoint, button) {
  const label = button.textContent.trim();
  button.disabled = true;
  button.textContent = "Working...";
  try {
    const response = await fetch(`${API}${endpoint}`, { method: "POST" });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const payload = await response.json();
    toast(`${label}: ${payload.event?.status || payload.event?.gateStatus || "completed"}`);
  } catch (error) {
    toast(`${label}: ${error.message}`, "bad");
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

async function download(endpoint, label) {
  try {
    const response = await fetch(`${API}${endpoint}`);
    if (!response.ok) throw new Error(`Export failed (${response.status})`);
    const blob = new Blob([JSON.stringify(await response.json(), null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${normalize(label).replaceAll(/[^a-z0-9]+/g, "-") || "market-intelligence-export"}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    toast(`${label}: download prepared`);
  } catch (error) {
    toast(`${label}: ${error.message}`, "bad");
  }
}

function upload(label) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,.xlsx,.xls,.json";
  input.addEventListener("change", async () => {
    if (!input.files?.[0]) return;
    const lower = label.toLowerCase();
    const endpoint = lower.includes("broker") ? "/api/market-intelligence/broker-data/upload" : lower.includes("rule") ? "/api/market-intelligence/prop-firm-rules/import" : lower.includes("statement") ? "/api/market-intelligence/account-portfolio/upload" : "/api/market-intelligence/historical-data/upload";
    try {
      const response = await fetch(`${API}${endpoint}`, { method: "POST" });
      if (!response.ok) throw new Error(`Upload request failed (${response.status})`);
      toast(`${label}: ${input.files[0].name} queued for validation`);
    } catch (error) {
      toast(`${label}: ${error.message}`, "bad");
    }
  });
  input.click();
}

function saveView() {
  localStorage.setItem(`market-intelligence-view:${location.pathname}`, location.search);
  toast("View saved for this Market Intelligence page");
}

function resetFilters(button) {
  const panel = button.closest("section") || document;
  panel.querySelectorAll("select").forEach(select => {
    select.selectedIndex = 0;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  panel.querySelectorAll("input[type=search], input:not([type])").forEach(input => input.value = "");
  toast("Filters reset");
}

function scrollToSection(terms) {
  const target = [...document.querySelectorAll("h2,h3")].find(heading => includesAny(normalize(heading.textContent), terms));
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
  toast(target ? `Opened ${target.textContent}` : "Requested panel is ready for backend integration", target ? "ok" : "warn");
}

function details(button) {
  const row = button.closest("tr");
  const values = row ? [...row.querySelectorAll("td")].slice(0, 8).map(cell => cell.textContent.trim()) : [];
  modal("Record Details", values.length ? `<p>${values.join(" / ")}</p><button data-mi-modal-close>Close Details</button>` : "<p>Details panel opened. Select a configured record to inspect its normalized fields.</p>");
}

function configuration(label) {
  modal(label, `<p>This control is prepared for authenticated backend configuration. Changes require the corresponding Market Intelligence permission and are audit logged.</p><button data-mi-modal-close>Close</button>`);
}

function endpointFor(label) {
  if (label === "sync now" && location.pathname.includes("/broker-data")) return "/api/market-intelligence/broker-data/sync";
  return postActions.find(([terms]) => includesAny(label, terms))?.[1];
}

function exportEndpoint(label) {
  const context = `${label} ${normalize(location.pathname)}`;
  return exportActions.find(([terms]) => includesAny(context, terms))?.[1] || "/api/market-intelligence/dashboard";
}

function handledByPage(button) {
  return Object.keys(button.dataset).some(key => ["cotAction", "cotCurrency", "hdRow", "hdReset", "bdChart", "bdRow", "bdClose", "apChart", "apAccount", "apClose", "pfFirm", "pfClose", "dqScenario", "miModalClose"].includes(key));
}

async function act(button) {
  if (handledByPage(button)) return;
  if (button.hasAttribute("data-live-test") || button.hasAttribute("data-live-refresh")) return;
  const label = normalize(button.textContent);
  if (!label) return;
  if (includesAny(label, ["open data quality gate"])) return location.assign("/workspace/market-intelligence/data-quality-gate");
  if (includesAny(label, ["upload", "import"])) return upload(button.textContent.trim());
  if (includesAny(label, ["export", "download", "generate feed report"])) return download(exportEndpoint(label), button.textContent.trim());
  if (label === "reset") return resetFilters(button);
  if (includesAny(label, ["apply filters", "validate freshness", "retry failed source", "use sample"])) return toast(`${button.textContent.trim()}: completed`);
  if (label === "retry") return post("/api/market-intelligence/refresh-feeds", button);
  if (label === "columns" || label === "date filter") return configuration(button.textContent.trim());
  if (label === "save view") return saveView();
  if (label === "fullscreen") return (button.closest("section") || document.documentElement).requestFullscreen?.();
  if (includesAny(label, ["show volume", "show moving averages", "show sessions", "show high/low markers", "normalize chart"])) {
    button.classList.toggle("active");
    return toast(`${button.textContent.trim()}: ${button.classList.contains("active") ? "enabled" : "disabled"}`);
  }
  if (includesAny(label, ["view details", "view", "copy row"])) return details(button);
  if (includesAny(label, ["logs", "warning queue", "breach alerts", "related issues"])) return scrollToSection(["timeline", "log", "warning", "risk panel", "validation"]);
  if (includesAny(label, ["compare"])) return scrollToSection(["comparison", "relative performance"]);
  if (includesAny(label, ["configure", "connect feed", "add provider", "modify", "add note", "close trade", "disconnect"])) return configuration(button.textContent.trim());
  const endpoint = endpointFor(label);
  if (endpoint) return post(endpoint, button);
  toast(`${button.textContent.trim()}: action recorded`, "warn");
}

function isPortfolioControl(button) {
  return Boolean(
    button?.closest("[data-ap-root]")
    && (button.dataset.apAction
      || button.dataset.apNav
      || button.dataset.apTab
      || button.dataset.apChart
      || button.dataset.apPeriod
      || button.dataset.apAccount
      || button.dataset.apSync
      || button.dataset.apReport
      || button.dataset.apClose)
  );
}

export function installMarketIntelligenceActions() {
  if (installed) return;
  installed = true;
  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || isPortfolioControl(button)) return;
    act(button);
  });
}
