export type SourceHealth = "HEALTHY" | "UNCONFIGURED" | "FAILED" | "STALE" | "WARNING";
export type TestResult = "PASS" | "WARNING" | "FAIL";

export type SourceConfigurationDashboard = {
  environment: string;
  updatedAt: string;
  header: {
    connectedSources: number;
    healthySources: number;
    failedSources: number;
    lastValidation: string;
    environment: string;
  };
  connectivity: {
    totalSources: number;
    configuredSources: number;
    healthySources: number;
    failedSources: number;
    workflowReadiness: string;
    configurationHealthScore: number;
  };
  summaryCards: Array<{
    sourceKey: string;
    label: string;
    status: string;
    provider: string;
    health: SourceHealth;
    lastSync: string | null;
    latency: string;
    records: number;
  }>;
  registry: Array<{
    id: string;
    source: string;
    sourceKey: string;
    provider: string;
    providerType: string;
    status: string;
    health: SourceHealth;
    lastSync: string | null;
    latencyMs: number | null;
    records: number;
    authentication: string;
    environment: string;
    enabled: boolean;
    required: boolean;
    credentialRef: string | null;
    apiUrl: string;
    websocketUrl: string;
    config: Record<string, unknown>;
  }>;
  providers: Array<Record<string, unknown>>;
  credentials: Array<{ vaultRef: string; sourceKey: string; display: string; status: string }>;
  syncJobs: Array<{
    id: string;
    sourceKey: string;
    sourceLabel: string;
    schedule: string;
    lastSyncAt: string | null;
    nextSyncAt: string | null;
    recordsImported: number;
    syncDurationMs: number;
    status: string;
  }>;
  testResults: Array<{
    sourceKey: string;
    source: string;
    result: TestResult;
    latencyMs: number | null;
    details: string;
    testedAt?: string;
    providerId?: string;
  }>;
  auditLogs: Array<{
    id: string;
    timestamp: string;
    sourceKey: string;
    event: string;
    severity: string;
    user: string;
    result: string;
  }>;
  workflowDependencies: Array<{ source: string; targets: string[] }>;
  categories: Array<{
    id: string;
    label: string;
    category: string;
    supportedProviders: string[];
    required: boolean;
  }>;
};

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function fetchSourceConfiguration(): Promise<SourceConfigurationDashboard> {
  const response = await fetch(`${API_BASE}/api/source-configuration`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Source configuration request failed (${response.status})`);
  return response.json();
}

export async function postSourceAction(path: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Source action failed (${response.status})`);
  return response.json();
}
