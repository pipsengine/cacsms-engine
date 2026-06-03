import { initEnterpriseSidebar } from "./enterprise-sidebar.js";
import { bindInstitutionalCotCenter, renderInstitutionalCotCenter } from "./institutional-cot-page.js";
import { bindLiveMarketIntelligencePage, renderLiveMarketIntelligencePage, unmountLiveMarketIntelligencePage } from "./live-market-intelligence-page.js";
import { mountMarketDataOperationsCenter, unmountMarketDataOperationsCenter } from "./market-data-page.js";
import { mountSourceConfigurationCenter, unmountSourceConfigurationCenter } from "./source-configuration-page.js";
import { mountNewsSentimentCenter } from "./news-sentiment-page.js";
import { mountEconomicCalendarCenter } from "./economic-calendar-page.js";

const marketIntelligencePrefix = "/workspace/market-intelligence/";

function slugForPath(pathname = location.pathname) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "workspace" ? parts[2] : parts[1] || "dashboard";
}

function isMarketIntelligenceRoute(route) {
  return route.startsWith(marketIntelligencePrefix) || route === "/market-intelligence" || route.startsWith("/market-intelligence/");
}

function unmountCurrentPage() {
  unmountLiveMarketIntelligencePage();
  unmountSourceConfigurationCenter();
  unmountMarketDataOperationsCenter();
}

function renderCurrentPage() {
  const slug = slugForPath();
  unmountCurrentPage();
  sidebar.render();
  if (slug === "institutional-cot") {
    document.querySelector("#intelligence-content").innerHTML = renderInstitutionalCotCenter();
    bindInstitutionalCotCenter();
  } else if (slug === "source-configuration") {
    mountSourceConfigurationCenter();
  } else if (slug === "market-data") {
    mountMarketDataOperationsCenter();
  } else if (slug === "news-sentiment") {
    mountNewsSentimentCenter();
  } else if (slug === "economic-calendar") {
    mountEconomicCalendarCenter();
  } else {
    document.querySelector("#intelligence-content").innerHTML = renderLiveMarketIntelligencePage(slug);
    bindLiveMarketIntelligencePage(slug);
  }
}

const sidebar = initEnterpriseSidebar("market-nav", {
  onNavigate(route) {
    if (!isMarketIntelligenceRoute(route)) return false;
    history.pushState({}, "", route);
    renderCurrentPage();
    return true;
  }
});

document.querySelector(".intelligence-header")?.remove();
window.addEventListener("popstate", renderCurrentPage);
renderCurrentPage();

const nigeriaTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
setInterval(() => document.querySelector("#utc-clock").textContent = `WAT ${nigeriaTime.format(new Date())}`, 1000);
