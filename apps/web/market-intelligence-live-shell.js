import { initEnterpriseSidebar } from "./enterprise-sidebar.js";
import { bindInstitutionalCotCenter, renderInstitutionalCotCenter } from "./institutional-cot-page.js";
import { bindLiveMarketIntelligencePage, renderLiveMarketIntelligencePage } from "./live-market-intelligence-page.js";

const parts = location.pathname.split("/").filter(Boolean);
const slug = parts[0] === "workspace" ? parts[2] : parts[1] || "dashboard";

initEnterpriseSidebar("market-nav");
document.querySelector(".intelligence-header")?.remove();
if (slug === "institutional-cot") {
  document.querySelector("#intelligence-content").innerHTML = renderInstitutionalCotCenter();
  bindInstitutionalCotCenter();
} else {
  document.querySelector("#intelligence-content").innerHTML = renderLiveMarketIntelligencePage(slug);
  bindLiveMarketIntelligencePage(slug);
}

setInterval(() => document.querySelector("#utc-clock").textContent = `UTC ${new Date().toISOString().slice(11,19)}`, 1000);

