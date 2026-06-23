import { apiFetch } from "@/lib/api/client";
import type { CurrencyStrengthEnrichment, CurrencyStrengthSnapshot, HybridDecisionRequest, HybridDecisionResponse } from "@/lib/api/types";

export async function getLatestCurrencyStrength() {
  return apiFetch<CurrencyStrengthSnapshot>("/api/intelligence/currency-strength/latest");
}

export async function enrichCurrencyStrength(symbol: string) {
  return apiFetch<CurrencyStrengthEnrichment>(`/api/intelligence/currency-strength/enrich/${encodeURIComponent(symbol)}`);
}

export async function evaluateHybridDecisionWithLiveCurrencyStrength(payload: HybridDecisionRequest) {
  return apiFetch<HybridDecisionResponse>("/api/decisioning/hybrid-evaluate/live-currency-strength", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
