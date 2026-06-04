import { initEnterpriseSidebar } from "./enterprise-sidebar.js";
import { bindInstitutionalCotCenter, renderInstitutionalCotCenter } from "./institutional-cot-page.js";
import { bindLiveMarketIntelligencePage, renderLiveMarketIntelligencePage, unmountLiveMarketIntelligencePage } from "./live-market-intelligence-page.js";
import { mountMarketDataOperationsCenter, unmountMarketDataOperationsCenter } from "./market-data-page.js";
import { mountSourceConfigurationCenter, unmountSourceConfigurationCenter } from "./source-configuration-page.js";
import { mountNewsSentimentCenter } from "./news-sentiment-page.js";
import { mountEconomicCalendarCenter } from "./economic-calendar-page.js";
import { mountSocialSentimentCenter, unmountSocialSentimentCenter } from "./social-sentiment-page.js";
import { mountAccountPortfolioCenter, unmountAccountPortfolioCenter } from "./account-portfolio-page.js";
import { mountPropFirmRulesCenter, unmountPropFirmRulesCenter } from "./prop-firm-rules-page.js";

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
  unmountSocialSentimentCenter();
  unmountAccountPortfolioCenter();
  unmountPropFirmRulesCenter();
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
  } else if (slug === "social-sentiment") {
    mountSocialSentimentCenter();
  } else if (slug === "account-portfolio") {
    mountAccountPortfolioCenter();
  } else if (slug === "prop-firm-rules") {
    mountPropFirmRulesCenter();
  } else {
    document.querySelector("#intelligence-content").innerHTML = renderLiveMarketIntelligencePage(slug);
    bindLiveMarketIntelligencePage(slug);
  }
}

export function navigateMarketIntelligence(route) {
  if (!isMarketIntelligenceRoute(route)) {
    location.href = route;
    return;
  }
  history.pushState({}, "", route);
  renderCurrentPage();
}

const sidebar = initEnterpriseSidebar("market-nav", {
  onNavigate(route) {
    if (!isMarketIntelligenceRoute(route)) return false;
    navigateMarketIntelligence(route);
    return true;
  }
});

document.querySelector(".intelligence-header")?.remove();
window.addEventListener("popstate", renderCurrentPage);
window.addEventListener("mi:navigate", (event) => {
  const route = event.detail?.route;
  if (route) navigateMarketIntelligence(route);
});
renderCurrentPage();

const nigeriaTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
setInterval(() => document.querySelector("#utc-clock").textContent = `WAT ${nigeriaTime.format(new Date())}`, 1000);
