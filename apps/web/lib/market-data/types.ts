export type MarketDataOutput = {
  source: string;
  status: string;
  health: number;
  latency: number;
  coverage: number;
  integrity_score: number;
  confidence_score: number;
  symbols: number;
  workflow_permission: string;
};

export type MarketDataProvider = {
  id: string;
  name: string;
  providerType: string;
  type: string;
  connectionMethod: string;
  baseUrl: string;
  websocketUrl: string;
  authType: string;
  vaultSecretRef: string;
  status: string;
  enabled: boolean;
  environment: string;
  notes: string;
  supportedAssetClasses: string[];
  health: number;
  latencyMs: number | null;
  freshness: string;
  tickRate: number;
  coverage: string;
  coveragePct?: number;
  lastSync?: string | null;
  workflowImpact?: string;
};

export type MarketDataDashboard = MarketDataOutput & {
  updatedAt: string;
  empty?: boolean;
  reason?: string;
  header: {
    connectedProviders: number;
    healthyProviders: number;
    liveSymbols: string;
    workflowStatus: string;
    dataConfidence: string;
  };
  banner: Record<string, string>;
  kpis: [string, string | number][];
  providers: MarketDataProvider[];
  liveFeed: Array<Record<string, unknown>>;
  coverage: Array<Record<string, unknown>>;
  tickQuality: Record<string, unknown>;
  spreadQuality: Array<Record<string, unknown>>;
  latencyMonitor: Record<string, unknown>;
  integrity: { score: number; checks: Record<string, number> };
  symbolAvailability: Array<Record<string, unknown>>;
  comparison: Array<Record<string, unknown>>;
  workflowImpacts: Array<{ stage: string; target: string; impact: string }>;
  logs: Array<Record<string, unknown>>;
  output: MarketDataOutput;
};

export type ProviderFormValues = {
  name: string;
  providerType: string;
  connectionMethod: string;
  baseUrl: string;
  websocketUrl: string;
  authType: string;
  vaultSecretRef: string;
  environment: string;
  enabled: boolean;
  supportedAssetClasses: string[];
  notes: string;
};

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return response.json();
}

export const marketDataKeys = {
  all: ["market-data"] as const,
  providers: () => [...marketDataKeys.all, "providers"] as const,
  health: () => [...marketDataKeys.all, "health"] as const,
  coverage: () => [...marketDataKeys.all, "coverage"] as const,
  latency: () => [...marketDataKeys.all, "latency"] as const,
  logs: () => [...marketDataKeys.all, "logs"] as const,
  confidence: () => [...marketDataKeys.all, "confidence"] as const,
  provider: (id: string) => [...marketDataKeys.all, "provider", id] as const
};

export function fetchMarketDataProviders() {
  return request<MarketDataDashboard>("/api/market-data/providers");
}

export function fetchMarketDataHealth() {
  return request<{ observedAt: string; providers: Array<Record<string, unknown>> }>("/api/market-data/providers/health");
}

export function fetchMarketDataCoverage() {
  return request<{ symbolsOnline: number; assets: Array<Record<string, unknown>> }>("/api/market-data/providers/coverage");
}

export function fetchMarketDataLatency() {
  return request<Record<string, unknown>>("/api/market-data/providers/latency");
}

export function fetchMarketDataLogs() {
  return request<{ logs: Array<Record<string, unknown>> }>("/api/market-data/providers/logs");
}

export function fetchMarketDataConfidence() {
  return request<Record<string, unknown>>("/api/market-data/providers/confidence");
}

export function fetchMarketDataProvider(id: string) {
  return request<{ provider: MarketDataProvider; coverage: Array<Record<string, unknown>>; logs: Array<Record<string, unknown>> }>(`/api/market-data/providers/${id}`);
}

export function createMarketDataProvider(body: ProviderFormValues) {
  return request<{ provider: MarketDataProvider }>("/api/market-data/providers", { method: "POST", body: JSON.stringify(body) });
}

export function updateMarketDataProvider(id: string, body: Partial<ProviderFormValues>) {
  return request<{ provider: MarketDataProvider }>(`/api/market-data/providers/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

export function deleteMarketDataProvider(id: string) {
  return request<{ id: string; archived: boolean }>(`/api/market-data/providers/${id}`, { method: "DELETE" });
}

export function testMarketDataProvider(id: string) {
  return request(`/api/market-data/providers/${id}/test`, { method: "POST", body: "{}" });
}

export function testAllMarketDataProviders() {
  return request("/api/market-data/providers/test-all", { method: "POST", body: "{}" });
}

export function syncMarketDataProviderSymbols(id: string) {
  return request(`/api/market-data/providers/${id}/sync-symbols`, { method: "POST", body: "{}" });
}

export function syncAllMarketDataSymbols() {
  return request("/api/market-data/providers/sync-all-symbols", { method: "POST", body: "{}" });
}

export function enableMarketDataProvider(id: string) {
  return request(`/api/market-data/providers/${id}/enable`, { method: "POST", body: "{}" });
}

export function disableMarketDataProvider(id: string) {
  return request(`/api/market-data/providers/${id}/disable`, { method: "POST", body: "{}" });
}

export async function exportMarketDataStatusCsv() {
  const payload = await request<{ csv: string }>("/api/market-data/providers/export");
  return payload.csv;
}

/** @deprecated use fetchMarketDataProviders */
export async function fetchMarketDataDashboard(): Promise<MarketDataDashboard> {
  return fetchMarketDataProviders();
}

/** @deprecated use typed API helpers */
export async function postMarketDataAction(path: string, body: Record<string, unknown> = {}) {
  return request(path, { method: "POST", body: JSON.stringify(body) });
}
