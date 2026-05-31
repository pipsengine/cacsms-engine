import { create } from "zustand";
import { healthySourceStatuses, marketIntelligenceSources, type DataSourceItem } from "../lib/workflow/market-intelligence-sources";

export type MarketIntelligenceHealth = {
  stage: "market_intelligence_gathering";
  dataQualityScore: number;
  freshness: "LIVE" | "RECENT" | "STALE";
  validationStatus: "PASSED" | "WARNING" | "FAILED";
  criticalSourcesOnline: number;
  criticalSourcesTotal: number;
  optionalSourcesOnline: number;
  optionalSourcesTotal: number;
  proceedStatus: "ALLOWED" | "RESTRICTED" | "BLOCKED";
  confidenceImpact: number;
  rejectReasons: string[];
  warnings: string[];
};

const buildHealth = (sources: DataSourceItem[], dataQualityScore: number, freshness: MarketIntelligenceHealth["freshness"]): MarketIntelligenceHealth => {
  const critical = sources.filter((source) => source.required);
  const optional = sources.filter((source) => !source.required);
  const criticalOnline = critical.filter((source) => healthySourceStatuses.has(source.status));
  const optionalOnline = optional.filter((source) => healthySourceStatuses.has(source.status));
  const rejectReasons = critical.filter((source) => !healthySourceStatuses.has(source.status)).map((source) => `${source.title} unavailable`);
  const warnings = optional.filter((source) => !healthySourceStatuses.has(source.status)).map((source) => `${source.title} unavailable; confidence reduced`);
  if (dataQualityScore < 85) rejectReasons.push("Data quality below minimum threshold");
  if (freshness === "STALE") rejectReasons.push("Market intelligence freshness is stale");
  const blocked = rejectReasons.length > 0;
  return {
    stage: "market_intelligence_gathering", dataQualityScore, freshness,
    validationStatus: blocked ? "FAILED" : "PASSED",
    criticalSourcesOnline: criticalOnline.length, criticalSourcesTotal: critical.length,
    optionalSourcesOnline: optionalOnline.length, optionalSourcesTotal: optional.length,
    proceedStatus: blocked ? "BLOCKED" : "ALLOWED", confidenceImpact: optional.length - optionalOnline.length,
    rejectReasons, warnings
  };
};

const initialHealth = buildHealth(marketIntelligenceSources, 98, "LIVE");

export const useMarketIntelligenceStore = create<{
  marketIntelligenceHealth: MarketIntelligenceHealth;
  dataSources: DataSourceItem[];
  dataQualityScore: number;
  proceedStatus: MarketIntelligenceHealth["proceedStatus"];
  rejectReasons: string[];
  warnings: string[];
  canProceedToStageOne: () => boolean;
}>(() => ({
  marketIntelligenceHealth: initialHealth,
  dataSources: marketIntelligenceSources,
  dataQualityScore: initialHealth.dataQualityScore,
  proceedStatus: initialHealth.proceedStatus,
  rejectReasons: initialHealth.rejectReasons,
  warnings: initialHealth.warnings,
  canProceedToStageOne: () => initialHealth.proceedStatus === "ALLOWED"
}));
