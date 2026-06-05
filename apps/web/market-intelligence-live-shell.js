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
import { mountBrokerLiquidityCenter, unmountBrokerLiquidityCenter } from "./broker-liquidity-page.js";
import { mountPortfolioIntelligenceCenter, unmountPortfolioIntelligenceCenter } from "./portfolio-intelligence-page.js";
import { mountScoringEngineCenter, unmountScoringEngineCenter } from "./scoring-engine-page.js";
import { mountPackageBuilderCenter, unmountPackageBuilderCenter } from "./package-builder-page.js";
import { mountHandoffCenter, unmountHandoffCenter } from "./handoff-page.js";

const dataSourcesValidationPrefix = "/workspace/data-sources-validation/";
const marketIntelligencePrefix = "/workspace/market-intelligence/";

const legacyRouteAliases = {
  "/market-intelligence": "/workspace/market-intelligence/dashboard",
  "/market-intelligence/data-sources-feed-health": "/workspace/data-sources-validation/dashboard",
  "/market-intelligence/institutional-cot-data": "/workspace/data-sources-validation/institutional-cot",
  "/market-intelligence/account-portfolio-data": "/workspace/data-sources-validation/account-portfolio",
  "/workspace/market-intelligence/data-sources": "/workspace/data-sources-validation/dashboard",
  "/workspace/market-intelligence/source-configuration": "/workspace/data-sources-validation/source-configuration",
  "/workspace/market-intelligence/market-data": "/workspace/data-sources-validation/market-data-providers",
  "/workspace/market-intelligence/news-sentiment": "/workspace/data-sources-validation/news-sources",
  "/workspace/market-intelligence/economic-calendar": "/workspace/data-sources-validation/economic-calendar",
  "/workspace/market-intelligence/social-sentiment": "/workspace/data-sources-validation/social-sentiment",
  "/workspace/market-intelligence/institutional-cot": "/workspace/data-sources-validation/institutional-cot",
  "/workspace/market-intelligence/historical-data": "/workspace/data-sources-validation/historical-data",
  "/workspace/market-intelligence/broker-data": "/workspace/data-sources-validation/broker-data",
  "/workspace/market-intelligence/account-portfolio": "/workspace/data-sources-validation/account-portfolio",
  "/workspace/market-intelligence/prop-firm-rules": "/workspace/data-sources-validation/prop-firm-rules",
  "/workspace/market-intelligence/data-quality-gate": "/workspace/data-sources-validation/data-quality-gate"
};

const moduleSlugAliases = {
  "market-data-providers": "market-data",
  "news-sources": "news-sentiment"
};

function normalizeRoute(route = location.pathname) {
  return legacyRouteAliases[route] || route;
}

function slugForPath(pathname = location.pathname) {
  pathname = normalizeRoute(pathname);
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "workspace" ? parts[2] : parts[1] || "dashboard";
}

function routeOwner(pathname = location.pathname) {
  const normalized = normalizeRoute(pathname);
  return normalized.startsWith(dataSourcesValidationPrefix) ? "card-1" : "card-2";
}

function moduleSlugFor(slug) {
  return moduleSlugAliases[slug] || slug;
}

function isWorkspaceRoute(route) {
  return route.startsWith(dataSourcesValidationPrefix) || route.startsWith(marketIntelligencePrefix) || route === "/market-intelligence" || route.startsWith("/market-intelligence/");
}

function unmountCurrentPage() {
  unmountLiveMarketIntelligencePage();
  unmountSourceConfigurationCenter();
  unmountMarketDataOperationsCenter();
  unmountSocialSentimentCenter();
  unmountAccountPortfolioCenter();
  unmountPropFirmRulesCenter();
  unmountBrokerLiquidityCenter();
  unmountPortfolioIntelligenceCenter();
  unmountScoringEngineCenter();
  unmountPackageBuilderCenter();
  unmountHandoffCenter();
}

function renderCurrentPage() {
  const slug = slugForPath();
  const moduleSlug = moduleSlugFor(slug);
  const owner = routeOwner();
  unmountCurrentPage();
  sidebar.render();
  if (moduleSlug === "institutional-cot" && owner === "card-1") {
    document.querySelector("#intelligence-content").innerHTML = renderInstitutionalCotCenter();
    bindInstitutionalCotCenter();
  } else if (moduleSlug === "source-configuration" && owner === "card-1") {
    mountSourceConfigurationCenter();
  } else if (moduleSlug === "market-data" && owner === "card-1") {
    mountMarketDataOperationsCenter();
  } else if (moduleSlug === "news-sentiment" && owner === "card-1") {
    mountNewsSentimentCenter();
  } else if (moduleSlug === "economic-calendar" && owner === "card-1") {
    mountEconomicCalendarCenter();
  } else if (moduleSlug === "social-sentiment" && owner === "card-1") {
    mountSocialSentimentCenter();
  } else if (moduleSlug === "account-portfolio" && owner === "card-1") {
    mountAccountPortfolioCenter();
  } else if (moduleSlug === "prop-firm-rules" && owner === "card-1") {
    mountPropFirmRulesCenter();
  } else if (moduleSlug === "broker-liquidity" && owner === "card-2") {
    mountBrokerLiquidityCenter();
  } else if (moduleSlug === "portfolio-intelligence" && owner === "card-2") {
    mountPortfolioIntelligenceCenter();
  } else if (moduleSlug === "scoring-engine" && owner === "card-2") {
    mountScoringEngineCenter();
  } else if (moduleSlug === "package-builder" && owner === "card-2") {
    mountPackageBuilderCenter();
  } else if (moduleSlug === "handoff" && owner === "card-2") {
    mountHandoffCenter();
  } else {
    document.querySelector("#intelligence-content").innerHTML = renderLiveMarketIntelligencePage(slug, { owner });
    bindLiveMarketIntelligencePage(slug, { owner });
  }
}

export function navigateMarketIntelligence(route) {
  if (!isWorkspaceRoute(route)) {
    location.href = route;
    return;
  }
  history.pushState({}, "", route);
  renderCurrentPage();
}

const sidebar = initEnterpriseSidebar("market-nav", {
  onNavigate(route) {
    if (!isWorkspaceRoute(route)) return false;
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
