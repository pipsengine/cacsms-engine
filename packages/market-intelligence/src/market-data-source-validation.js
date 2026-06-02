import { isDatabaseConfigured } from "./db.js";
import { listProviders, TARGET_ASSETS } from "./market-data-repository.js";
import { evaluateMt5WorkflowReadiness, getMt5InfrastructureDashboard } from "./mt5-infrastructure.js";

function failedChecks(message) {
  return {
    configured: false,
    availability: false,
    apiValidation: false,
    latency: "NOT TESTED",
    freshness: "UNAVAILABLE",
    quality: "FAILED",
    message
  };
}

function passedChecks(latencyMs, freshnessLabel = "LIVE") {
  return {
    configured: true,
    availability: true,
    apiValidation: true,
    latency: latencyMs != null ? `${latencyMs} ms` : "NOT TESTED",
    freshness: freshnessLabel,
    quality: "PASSED"
  };
}

export async function buildMarketDataLiveSourceSnapshot() {
  const base = {
    id: "market-data",
    routeSlug: "market-data",
    name: "Market Data Providers",
    category: "market-data",
    subtitle: "Real-time prices, ticks, depth and spread data from configured MT5 or vendor feeds.",
    required: true,
    feedsStage: "Card 1",
    failureAction: "block_card_1",
    configuration: "Open Market Data Providers to register an MT5 terminal and complete onboarding.",
    connectionLabel: "MT5 Bridge",
    adapter: "mt5_bridge",
    envKey: null,
    httpStatus: null,
    probeError: null
  };

  if (!isDatabaseConfigured()) {
    return {
      ...base,
      provider: "Provider Not Connected",
      status: "NOT_CONFIGURED",
      lastSyncAt: null,
      freshnessSeconds: 0,
      freshness: "UNAVAILABLE",
      healthScore: 0,
      latencyMs: 0,
      errorCount: 1,
      records: 0,
      checks: failedChecks("Database not configured")
    };
  }

  const providers = await listProviders();
  const mt5Providers = providers.filter(
    (item) => item.connectionMethod === "MT5 Bridge" || item.providerType === "MT5"
  );

  if (!mt5Providers.length) {
    return {
      ...base,
      provider: "Provider Not Connected",
      status: "NOT_CONFIGURED",
      lastSyncAt: null,
      freshnessSeconds: 0,
      freshness: "UNAVAILABLE",
      healthScore: 0,
      latencyMs: 0,
      errorCount: 1,
      records: 0,
      checks: failedChecks("Configure a market data provider")
    };
  }

  const activeProvider = mt5Providers.find((item) => ["ACTIVE", "LIVE"].includes(item.status))
    || mt5Providers.find((item) => item.status === "PARTIALLY_CONFIGURED")
    || mt5Providers[0];
  const mt5 = await getMt5InfrastructureDashboard();
  const terminal = mt5.terminals.find((item) => item.providerId === activeProvider.id) || mt5.terminals[0];
  const liveSymbols = Number(terminal?.liveSymbolCount || 0);
  const symbolCount = TARGET_ASSETS.length;
  const readiness = evaluateMt5WorkflowReadiness({
    terminals: mt5.terminals,
    providers: mt5Providers,
    liveSymbols,
    symbolCount,
    avgLatency: terminal?.latencyMs || 0
  });

  if (
    ["ACTIVE", "LIVE"].includes(activeProvider.status)
    && terminal?.connectionStatus === "ONLINE"
    && terminal?.eaStatus === "CONNECTED"
    && liveSymbols > 0
  ) {
    const checks = passedChecks(terminal.latencyMs, "REAL-TIME");
    return {
      ...base,
      provider: activeProvider.name,
      status: readiness.permission === "ALLOWED" ? "LIVE" : "ONLINE",
      lastSyncAt: terminal.lastHeartbeat || new Date().toISOString(),
      freshnessSeconds: terminal.lastHeartbeatAgeSec || 0,
      freshness: "REAL-TIME",
      healthScore: Number(activeProvider.healthScore || 98),
      latencyMs: terminal.latencyMs || 0,
      errorCount: 0,
      records: liveSymbols,
      configuration: "MT5 terminal connected through CACSMS Engine.",
      checks
    };
  }

  const blocker = readiness.message || "Complete MT5 onboarding in Market Data Providers.";
  const partialChecks = {
    ...failedChecks(blocker),
    configured: true,
    availability: terminal?.connectionStatus === "ONLINE",
    apiValidation: terminal?.eaStatus === "CONNECTED"
  };

  return {
    ...base,
    provider: activeProvider.name,
    status: "FAILED",
    lastSyncAt: terminal?.lastHeartbeat || null,
    freshnessSeconds: terminal?.lastHeartbeatAgeSec || 0,
    freshness: terminal?.lastHeartbeat ? "STALE" : "UNAVAILABLE",
    healthScore: Number(activeProvider.healthScore || 0),
    latencyMs: terminal?.latencyMs || 0,
    errorCount: 1,
    records: liveSymbols,
    configuration: blocker,
    probeError: readiness.reason || null,
    checks: partialChecks
  };
}

export async function probeMarketDataBridge() {
  const snapshot = await buildMarketDataLiveSourceSnapshot();
  if (["LIVE", "ONLINE"].includes(snapshot.status)) {
    return {
      ok: true,
      latencyMs: snapshot.latencyMs || null,
      source: "mt5_bridge",
      provider: snapshot.provider
    };
  }
  return {
    ok: false,
    latencyMs: snapshot.latencyMs || null,
    reason: snapshot.probeError || snapshot.checks?.message || "mt5_bridge_not_connected",
    source: "mt5_bridge"
  };
}
