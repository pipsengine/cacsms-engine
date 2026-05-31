import type { MarketIntelligenceDashboard } from "./types";

export const marketIntelligenceDashboardMock = {
  status: "OPERATIONAL", proceedStatus: "ALLOWED", environment: "Production", lastUpdated: "2026-05-31T12:00:00Z", dataQualityScore: 98, feedFreshness: "LIVE",
  criticalSources: { online: 7, total: 7 }, optionalSources: { online: 2, total: 2 },
  sentiment: { score: 62, mode: "Risk-On", risk: "Moderate", theme: "USD weakness / Gold strength" }, brokerHealth: 97, portfolioSync: "Live",
  sources: [], economicEvents: [], newsSentiment: [], brokerFeeds: [], timeline: [],
  gate: { proceedToStageOne: true, dataQualityScore: 98, freshnessStatus: "LIVE", validationStatus: "PASSED", tradingMode: "NORMAL", warnings: [], rejectReasons: [] }
} satisfies MarketIntelligenceDashboard;
