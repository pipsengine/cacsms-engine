const marketIntelligenceChildren = [
  ["Intelligence Dashboard", "/workspace/market-intelligence/dashboard"],
  ["Data Sources & Feed Health", "/workspace/market-intelligence/data-sources"],
  ["Market Data Providers", "/workspace/market-intelligence/market-data"],
  ["News & Sentiment Sources", "/workspace/market-intelligence/news-sentiment"],
  ["Economic Calendar", "/workspace/market-intelligence/economic-calendar"],
  ["Social & Community Sentiment", "/workspace/market-intelligence/social-sentiment"],
  ["Institutional / COT Data", "/workspace/market-intelligence/institutional-cot"],
  ["Historical Data", "/workspace/market-intelligence/historical-data"],
  ["Broker Data", "/workspace/market-intelligence/broker-data"],
  ["Account & Portfolio Data", "/workspace/market-intelligence/account-portfolio"],
  ["Prop Firm Rules & Limits", "/workspace/market-intelligence/prop-firm-rules"],
  ["Data Quality Gate", "/workspace/market-intelligence/data-quality-gate"]
];

export const sidebarFunctions = [
  ["01", "CMD", "Executive Command Center", "LIVE", [["Executive Dashboard", "/"]]],
  ["02", "FLOW", "End-to-End Workflow", "LIVE", [["Workflow Dashboard", "/workflow/end-to-end"]]],
  ["03", "RAD", "Market Intelligence Center", "READY", marketIntelligenceChildren, true],
  ["04", "SCAN", "20-Asset Universe Scanner", "", [["Scanner Dashboard", "/workspace/asset-scanner/dashboard"]]],
  ["05", "ANL", "Market Analysis", "", [["Analysis Dashboard", "/workspace/market-analysis/dashboard"]]],
  ["06", "VIS", "Computer Vision", "BETA", [["Vision Dashboard", "/workspace/computer-vision/dashboard"]]],
  ["07", "AI", "AI Decision", "", [["Decision Dashboard", "/workspace/ai-decision/dashboard"]]],
  ["08", "VOTE", "AI Debate & Consensus", "", [["Consensus Dashboard", "/workspace/ai-consensus/dashboard"]]],
  ["09", "STR", "Strategy Intelligence", "", [["Strategy Dashboard", "/workspace/strategy/dashboard"]]],
  ["10", "RSK", "Risk Intelligence", "", [["Risk Dashboard", "/workspace/risk/dashboard"]]],
  ["11", "EXE", "Execution Center", "", [["Execution Dashboard", "/workspace/execution/dashboard"]]],
  ["12", "POS", "Position Management", "", [["Position Dashboard", "/workspace/position/dashboard"]]],
  ["13", "LRN", "Learning & Memory", "", [["Learning Dashboard", "/workspace/learning/dashboard"]]],
  ["14", "MT5", "MT5 Infrastructure", "", [["MT5 Dashboard", "/workspace/mt5/dashboard"]]],
  ["15", "MCH", "Machine Registry", "", [["Machine Dashboard", "/workspace/machines/dashboard"]]],
  ["16", "MON", "Monitoring & Self-Healing", "", [["Monitoring Dashboard", "/workspace/monitoring/dashboard"]]],
  ["17", "RPT", "Reports & Audit", "", [["Reports Dashboard", "/workspace/reports/dashboard"]]],
  ["18", "SEC", "Security & Governance", "", [["Security Dashboard", "/workspace/security/dashboard"]]],
  ["19", "ADM", "Administration", "", [["Administration Dashboard", "/workspace/administration/dashboard"]]]
];

const legacyRoutes = {
  "/market-intelligence": "/workspace/market-intelligence/dashboard",
  "/market-intelligence/data-sources-feed-health": "/workspace/market-intelligence/data-sources",
  "/market-intelligence/institutional-cot-data": "/workspace/market-intelligence/institutional-cot",
  "/market-intelligence/account-portfolio-data": "/workspace/market-intelligence/account-portfolio"
};

function activeRoute() {
  return legacyRoutes[location.pathname] || location.pathname;
}

function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function initEnterpriseSidebar(navId) {
  const nav = document.querySelector(`#${navId}`);
  const shell = document.querySelector(".app-shell");
  const collapse = document.querySelector("#collapse-sidebar");
  const expanded = new Set(sidebarFunctions.filter(([, , , , , open]) => open).map(([number]) => number));
  const current = activeRoute();

  function render(query = "") {
    const normalizedQuery = query.trim().toLowerCase();
    const visible = sidebarFunctions.filter(([, , title, , children]) => `${title} ${children.map(([child]) => child).join(" ")}`.toLowerCase().includes(normalizedQuery));
    nav.innerHTML = `<label class="enterprise-sidebar-search"><span>SRCH</span><input type="search" placeholder="Search functions..." value="${escapeAttribute(query)}"></label><div class="enterprise-navigation">${visible.map(([number, icon, title, status, children]) => {
      const isExpanded = expanded.has(number);
      const isActive = children.some(([, route]) => route === current);
      return `<section class="enterprise-sidebar-function${isActive ? " active" : ""}">
        <button class="enterprise-sidebar-parent" type="button" data-function="${number}" aria-expanded="${isExpanded}">
          <span class="function-number">${number}</span><span class="function-icon">${icon}</span><strong>${title}</strong>${status ? `<b>${status}</b>` : ""}<i>${isExpanded ? "v" : ">"}</i>
        </button>
        ${isExpanded ? `<div class="enterprise-sidebar-children">${children.map(([child, route]) => `<a class="enterprise-sidebar-child${route === current ? " active" : ""}" href="${route}">${child}</a>`).join("")}</div>` : ""}
      </section>`;
    }).join("")}</div>`;
    nav.querySelector("input").addEventListener("input", (event) => render(event.target.value));
    nav.querySelectorAll(".enterprise-sidebar-parent").forEach((button) => button.addEventListener("click", () => {
      const number = button.dataset.function;
      expanded.has(number) ? expanded.delete(number) : expanded.add(number);
      render(query);
    }));
  }

  collapse.addEventListener("click", () => shell.classList.toggle("sidebar-collapsed"));
  render();
}
