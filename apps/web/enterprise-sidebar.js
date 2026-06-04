const marketIntelligenceChildren = [
  ["Intelligence Gathering Dashboard", "/workspace/market-intelligence/dashboard"],
  ["Data Sources Validation", "/workspace/market-intelligence/data-sources"],
  ["Source Configuration Center", "/workspace/market-intelligence/source-configuration"],
  ["Market Data Providers", "/workspace/market-intelligence/market-data"],
  ["News & Sentiment Sources", "/workspace/market-intelligence/news-sentiment"],
  ["Economic Calendar", "/workspace/market-intelligence/economic-calendar"],
  ["Social & Community Sentiment", "/workspace/market-intelligence/social-sentiment"],
  ["Institutional / COT Data", "/workspace/market-intelligence/institutional-cot"],
  ["Historical Data", "/workspace/market-intelligence/historical-data"],
  ["Broker Data", "/workspace/market-intelligence/broker-data"],
  ["Account Portfolio", "/workspace/market-intelligence/account-portfolio"],
  ["Prop Firm Rules", "/workspace/market-intelligence/prop-firm-rules"],
  ["Data Quality Gate", "/workspace/market-intelligence/data-quality-gate"]
];

const iconPaths = {
  LayoutDashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  Workflow: '<rect x="3" y="3" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/><path d="M9 6h4a4 4 0 0 1 4 4v5M15 18h-4a4 4 0 0 1-4-4V9"/>',
  ClipboardCheck: '<path d="M9 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  Radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 6-6M12 3v2M21 12h-2M12 21v-2M3 12h2"/>',
  ScanSearch: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="11" cy="11" r="3"/><path d="m13.5 13.5 3 3"/>',
  LineChart: '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
  Camera: '<path d="M14.5 4 16 6h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1.5-2z"/><circle cx="12" cy="12" r="3"/>',
  Brain: '<path d="M9.5 4A3.5 3.5 0 0 0 6 7.5c0 .3 0 .6.1.8A3.5 3.5 0 0 0 4 11.5c0 1.4.8 2.7 2 3.2A3.5 3.5 0 0 0 9.5 20H12V4zM14.5 4A3.5 3.5 0 0 1 18 7.5c0 .3 0 .6-.1.8a3.5 3.5 0 0 1 .1 6.4A3.5 3.5 0 0 1 14.5 20H12V4z"/>',
  MessagesSquare: '<path d="M7 18H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1M7 18l-3 3v-5"/><path d="M10 9h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1l2 2M14 13h3"/>',
  Target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  ShieldAlert: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4M12 16h.01"/>',
  PlayCircle: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
  Briefcase: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 12h18M10 12v2h4v-2"/>',
  DatabaseZap: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3M4 11v6c0 1.7 3.6 3 8 3M20 5v4M16 14l-2 3h3l-1 4 4-5h-3l1-2z"/>',
  Server: '<rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><path d="M7 7h.01M7 17h.01"/>',
  MonitorSmartphone: '<rect x="2" y="3" width="14" height="11" rx="1"/><path d="M7 18h2M12 18h2M9 14v4"/><rect x="17" y="8" width="5" height="11" rx="1"/>',
  Activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  FileBarChart: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 17v-3M12 17v-6M16 17v-2"/>',
  ShieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  Settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1 1.6v.2h-4V21a1.8 1.8 0 0 0-1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1-2.8-2.8.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 3 14H2.8v-4H3a1.8 1.8 0 0 0 1.6-1 1.8 1.8 0 0 0-.4-2l-.1-.1L6.9 4l.1.1a1.8 1.8 0 0 0 2 .4A1.8 1.8 0 0 0 10 3V2.8h4V3a1.8 1.8 0 0 0 1 1.6 1.8 1.8 0 0 0 2-.4l.1-.1 2.8 2.8-.1.1a1.8 1.8 0 0 0-.4 2A1.8 1.8 0 0 0 21 10h.2v4H21a1.8 1.8 0 0 0-1.6 1z"/>'
};

export const sidebarFunctions = [
  ["executive", "LayoutDashboard", "Executive Command Center", "LIVE", [["Executive Dashboard", "/"], ["Workflow Dashboard", "/executive-command-center/workflow-dashboard"]], true],
  ["workflow", "Workflow", "End-to-End Workflow", "LIVE", [["Workflow Dashboard", "/workflow/end-to-end"]]],
  ["market-intelligence", "Radar", "Market Intelligence Center", "READY", marketIntelligenceChildren, true],
  ["asset-scanner", "ScanSearch", "20-Asset Universe Scanner", "", [["Scanner Dashboard", "/workspace/asset-scanner/dashboard"]]],
  ["market-analysis", "LineChart", "Market Analysis", "", [["Analysis Dashboard", "/workspace/market-analysis/dashboard"]]],
  ["computer-vision", "Camera", "Computer Vision", "BETA", [["Vision Dashboard", "/workspace/computer-vision/dashboard"]]],
  ["ai-decision", "Brain", "AI Decision", "", [["Decision Dashboard", "/workspace/ai-decision/dashboard"]]],
  ["ai-consensus", "MessagesSquare", "AI Debate & Consensus", "", [["Consensus Dashboard", "/workspace/ai-consensus/dashboard"]]],
  ["strategy", "Target", "Strategy Intelligence", "", [["Strategy Dashboard", "/workspace/strategy/dashboard"]]],
  ["risk", "ShieldAlert", "Risk Intelligence", "", [["Risk Dashboard", "/workspace/risk/dashboard"]]],
  ["execution", "PlayCircle", "Execution Center", "", [["Execution Dashboard", "/workspace/execution/dashboard"]]],
  ["position", "Briefcase", "Position Management", "", [["Position Dashboard", "/workspace/position/dashboard"]]],
  ["learning", "DatabaseZap", "Learning & Memory", "", [["Learning Dashboard", "/workspace/learning/dashboard"]]],
  ["mt5", "Server", "MT5 Infrastructure", "", [
    ["Agent Downloads", "/workspace/mt5-infrastructure/agent-downloads"],
    ["EA Deployments", "/workspace/mt5-infrastructure/ea-deployments"],
    ["Connection Monitor", "/workspace/mt5-infrastructure/connection-monitor"]
  ]],
  ["machines", "MonitorSmartphone", "Machine Registry", "", [["Machine Dashboard", "/workspace/machines/dashboard"]]],
  ["monitoring", "Activity", "Monitoring & Self-Healing", "", [["Monitoring Dashboard", "/workspace/monitoring/dashboard"]]],
  ["reports", "FileBarChart", "Reports & Audit", "", [["Reports Dashboard", "/workspace/reports/dashboard"]]],
  ["security", "ShieldCheck", "Security & Governance", "", [["Security Dashboard", "/workspace/security/dashboard"]]],
  ["administration", "Settings", "Administration", "", [["Administration Dashboard", "/workspace/administration/dashboard"]]]
];

const legacyRoutes = {
  "/market-intelligence": "/workspace/market-intelligence/dashboard",
  "/market-intelligence/data-sources-feed-health": "/workspace/market-intelligence/data-sources",
  "/market-intelligence/institutional-cot-data": "/workspace/market-intelligence/institutional-cot",
  "/market-intelligence/account-portfolio-data": "/workspace/market-intelligence/account-portfolio"
};

const sidebarStateKey = "cacsms-enterprise-sidebar";

function activeRoute() {
  return legacyRoutes[location.pathname] || location.pathname;
}

function readSidebarState() {
  try {
    return JSON.parse(sessionStorage.getItem(sidebarStateKey) || "{}");
  } catch {
    return {};
  }
}

function writeSidebarState(state) {
  sessionStorage.setItem(sidebarStateKey, JSON.stringify(state));
}

function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function icon(name) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${iconPaths[name]}</svg>`;
}

export function initEnterpriseSidebar(navId, { onNavigate } = {}) {
  const nav = document.querySelector(`#${navId}`);
  const shell = document.querySelector(".app-shell");
  const collapse = document.querySelector("#collapse-sidebar");
  const savedState = readSidebarState();
  const defaultExpanded = sidebarFunctions.filter(([, , , , , open]) => open).map(([id]) => id);
  const expanded = new Set(Array.isArray(savedState.expanded) ? savedState.expanded : defaultExpanded);

  if (savedState.collapsed) shell.classList.add("sidebar-collapsed");

  function saveState(scrollTop = nav.querySelector(".enterprise-navigation")?.scrollTop || 0) {
    writeSidebarState({ collapsed: shell.classList.contains("sidebar-collapsed"), expanded: [...expanded], scrollTop });
  }

  function render(query = "") {
    const previousScrollTop = nav.querySelector(".enterprise-navigation")?.scrollTop ?? savedState.scrollTop ?? 0;
    const current = activeRoute();
    const normalizedQuery = query.trim().toLowerCase();
    const visible = sidebarFunctions.filter(([, , title, , children]) => `${title} ${children.map(([child]) => child).join(" ")}`.toLowerCase().includes(normalizedQuery));
    nav.innerHTML = `<label class="enterprise-sidebar-search"><span>SRCH</span><input type="search" placeholder="Search functions..." value="${escapeAttribute(query)}"></label><div class="enterprise-navigation">${visible.map(([id, iconName, title, status, children]) => {
      const isExpanded = expanded.has(id);
      const isActive = children.some(([, route]) => route === current);
      return `<section class="enterprise-sidebar-function${isActive ? " active" : ""}">
        <button class="enterprise-sidebar-parent" type="button" data-function="${id}" aria-expanded="${isExpanded}">
          <span class="function-icon">${icon(iconName)}</span><strong>${title}</strong>${status ? `<b>${status}</b>` : ""}<i>${isExpanded ? "v" : ">"}</i>
        </button>
        ${isExpanded ? `<div class="enterprise-sidebar-children">${children.map(([child, route]) => `<a class="enterprise-sidebar-child${route === current ? " active" : ""}" href="${route}">${child}</a>`).join("")}</div>` : ""}
      </section>`;
    }).join("")}</div>`;
    const navigation = nav.querySelector(".enterprise-navigation");
    navigation.scrollTop = previousScrollTop;
    navigation.addEventListener("scroll", () => saveState(navigation.scrollTop), { passive: true });
    nav.querySelectorAll(".enterprise-sidebar-child").forEach(link => link.addEventListener("click", event => {
      saveState(navigation.scrollTop);
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !onNavigate) return;
      const route = link.getAttribute("href");
      if (onNavigate(route, event) === false) return;
      event.preventDefault();
      render(query);
    }));
    nav.querySelector("input").addEventListener("input", event => render(event.target.value));
    nav.querySelectorAll(".enterprise-sidebar-parent").forEach(button => button.addEventListener("click", () => {
      const id = button.dataset.function;
      expanded.has(id) ? expanded.delete(id) : expanded.add(id);
      saveState(navigation.scrollTop);
      render(query);
    }));
  }

  collapse.addEventListener("click", () => {
    shell.classList.toggle("sidebar-collapsed");
    saveState();
  });
  render();
  return { render };
}
