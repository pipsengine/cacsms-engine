import { apiFetch } from "@/lib/api/client";
import type { TradingSymbol } from "@/lib/api/types";

export async function getApprovedSymbols() {
  return apiFetch<TradingSymbol[]>("/api/trading-universe/symbols");
}
