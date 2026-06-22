import { apiFetch } from "@/lib/api/client";
import type {
  DecisionHistoryItem,
  HealthResponse,
  HybridDecisionRequest,
  HybridDecisionResponse,
  PersistedHybridDecisionResponse,
} from "@/lib/api/types";

export async function getApiHealth() {
  return apiFetch<HealthResponse>("/health");
}

export async function evaluateHybridDecision(payload: HybridDecisionRequest) {
  return apiFetch<HybridDecisionResponse>("/api/decisioning/hybrid-evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function evaluateHybridDecisionPersisted(payload: HybridDecisionRequest) {
  return apiFetch<PersistedHybridDecisionResponse>("/api/decisioning/hybrid-evaluate/persisted", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDecisionHistory(limit = 50) {
  return apiFetch<DecisionHistoryItem[]>(`/api/decisions?limit=${limit}`);
}

export function createDefaultHybridDecision(symbol = "XAUUSD"): HybridDecisionRequest {
  return {
    symbol,
    tradingMode: "Hybrid",
    timeframe: "M15",
    session: "London",
    marketRegime: "Trending",
    higherTimeframeBias: "Bullish",
    entryTimeframeBias: "Bullish",
    multiTimeframeAlignmentScore: 78,
    higherTimeframeConflictScore: 86,
    executionTimeframeConfirmationScore: 74,
    spreadPoints: symbol === "XAUUSD" ? 18 : 12,
    slippagePoints: 1,
    riskReward: 2.4,
    newsRisk: false,
    liquiditySweep: true,
    displacement: true,
    fairValueGap: true,
    orderBlockRetest: false,
    breakOfStructure: true,
    retailTrendAligned: true,
    supportResistanceConfirmation: true,
    pullbackConfirmation: false,
    macroBiasScore: 70,
    interestRateDifferentialScore: 68,
    cotPositioningScore: 60,
    currencyStrengthScore: 72,
    macroRiskScore: 62,
    regimeModelScore: 71,
    historicalSimilarityScore: 69,
    candleIntelligenceScore: 73,
    h8D1ProjectionScore: 67,
    ensemblePredictionScore: 76,
    bayesianConfidenceScore: 74,
    probabilityCalibrationScore: 70,
    anomalyScore: 90,
    executionQualityScore: 80,
    volatilityScore: 58,
    strategyHealthScore: 75,
    accountDrawdownPercent: 1.2,
    dailyLossPercent: 0.3,
    consecutiveLosses: 0,
    requestedRiskPercent: 0.1,
  };
}
