import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { HEALTHY_STATUSES } from "./data-sources.js";

const storePath = fileURLToPath(new URL("../../../apps/web/public/data/source-configuration.json", import.meta.url));

export const SOURCE_ENVIRONMENT = process.env.CACSMS_ENVIRONMENT || "foundation";

export const SOURCE_CATEGORIES = Object.freeze([
  ["market-data", "Market Data", "market_data", ["MT5", "TwelveData", "Polygon", "Finnhub", "AlphaVantage", "TradingView", "Custom Feed"], true],
  ["news-sentiment", "News & Sentiment", "news_sentiment", ["NewsAPI", "Finnhub News", "RSS Aggregator", "Financial Modeling Prep", "Custom AI News"], true],
  ["economic-calendar", "Economic Calendar", "economic_calendar", ["Trading Economics", "Financial Modeling Prep", "Custom Calendar Feed"], true],
  ["social-sentiment", "Social Sentiment", "social_sentiment", ["Twitter/X", "Reddit", "Telegram", "Discord", "Custom Sentiment Feed"], false],
  ["institutional-cot", "Institutional COT", "institutional_cot", ["CFTC Futures Only Reports"], false],
  ["historical-data", "Historical Data", "historical_data", ["MT5 History", "Broker History", "Polygon", "TwelveData", "Uploaded Archive"], true],
  ["broker-data", "Broker Data", "broker_data", ["MT5", "cTrader", "FIX", "Broker API"], true],
  ["account-portfolio", "Portfolio Data", "account_portfolio", ["MT5 Account", "Portfolio Service"], true],
  ["prop-firm-rules", "Prop Rules", "prop_firm_rules", ["Internal Rule Database"], true]
].map(([id, label, category, supportedProviders, required]) => Object.freeze({ id, label, category, supportedProviders, required })));

export const WORKFLOW_DEPENDENCIES = Object.freeze([
  ["market-data", "Card 1 Validation", "Market Intelligence", "Asset Scanner"],
  ["news-sentiment", "Market Intelligence", "AI Decision"],
  ["economic-calendar", "Risk Intelligence"],
  ["broker-data", "Execution Center"],
  ["account-portfolio", "Risk Intelligence"],
  ["historical-data", "Asset Ranking", "Market Analysis"],
  ["prop-firm-rules", "Risk Validation", "Compliance"]
].map(([source, ...targets]) => Object.freeze({ source, targets })));

const LIVE_ID_MAP = Object.freeze({
  "market-data": "market-data",
  "news-sentiment": "news-sentiment",
  "economic-calendar": "economic-calendar",
  "social-sentiment": "social-sentiment",
  "institutional-cot": "institutional-cot-data",
  "historical-data": "historical-data",
  "broker-data": "broker-data",
  "account-portfolio": "account-portfolio-data",
  "prop-firm-rules": "prop-firm-rules"
});

const DEFAULT_PROVIDERS = SOURCE_CATEGORIES.map(({ id, label, category, supportedProviders, required }, index) => ({
  id: `src-${id}`,
  sourceKey: id,
  sourceLabel: label,
  category,
  providerName: supportedProviders[0],
  providerType: id === "institutional-cot" ? "Official Archive" : id === "prop-firm-rules" ? "Internal Database" : "API",
  apiUrl: id === "institutional-cot" ? "https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm" : "",
  websocketUrl: "",
  authenticationType: id === "institutional-cot" || id === "prop-firm-rules" ? "none" : "api_key",
  credentialRef: id === "institutional-cot" || id === "prop-firm-rules" ? null : `${category.toUpperCase()}_API_KEY`,
  enabled: true,
  required,
  environment: SOURCE_ENVIRONMENT,
  config: id === "institutional-cot"
    ? { reportType: "FUTURES_ONLY", syncSchedule: "Saturday 12:00am", currencyMapping: "CFTC Legacy" }
    : id === "prop-firm-rules"
      ? { supportedFirms: ["FTMO", "FundedNext", "5ers", "E8", "Custom"] }
      : {}
}));

const DEFAULT_CREDENTIALS = SOURCE_CATEGORIES
  .filter(({ id }) => !["institutional-cot", "prop-firm-rules"].includes(id))
  .map(({ id, category }) => ({
    id: `cred-${id}`,
    vaultRef: `${category.toUpperCase()}_API_KEY`,
    sourceKey: id,
    status: "stored_securely",
    lastRotatedAt: null
  }));

function defaultStore() {
  return {
    version: 1,
    environment: SOURCE_ENVIRONMENT,
    updatedAt: new Date().toISOString(),
    providers: DEFAULT_PROVIDERS,
    credentials: DEFAULT_CREDENTIALS,
    syncJobs: SOURCE_CATEGORIES.map(({ id, label }) => ({
      id: `sync-${id}`,
      sourceKey: id,
      sourceLabel: label,
      schedule: id === "institutional-cot" ? "0 0 * * 6" : "0 */15 * * *",
      lastSyncAt: null,
      nextSyncAt: null,
      recordsImported: 0,
      syncDurationMs: 0,
      status: "IDLE"
    })),
    testResults: [],
    auditLogs: [{
      id: "AUD-INIT-001",
      timestamp: new Date().toISOString(),
      sourceKey: "system",
      event: "Source Configuration Center initialized",
      severity: "info",
      user: "system.bootstrap",
      result: "SUCCESS"
    }]
  };
}

function ensureStoreFile() {
  if (!existsSync(storePath)) {
    mkdirSync(dirname(storePath), { recursive: true });
    writeFileSync(storePath, `${JSON.stringify(defaultStore(), null, 2)}\n`, "utf8");
  }
}

export function loadStore() {
  ensureStoreFile();
  return JSON.parse(readFileSync(storePath, "utf8").replace(/^\uFEFF/, ""));
}

export function saveStore(store) {
  store.updatedAt = new Date().toISOString();
  writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  return store;
}

function appendAudit(store, entry) {
  const log = {
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    sourceKey: entry.sourceKey || "system",
    event: entry.event,
    severity: entry.severity || "info",
    user: entry.user || "operator",
    result: entry.result || "SUCCESS"
  };
  store.auditLogs.unshift(log);
  store.auditLogs.splice(200);
  return log;
}

function liveSnapshotForSource(sourceKey, liveSnapshots = []) {
  const liveId = LIVE_ID_MAP[sourceKey];
  return liveSnapshots.find((item) => item.id === liveId || item.routeSlug === sourceKey) || null;
}

function deriveHealth(status) {
  if (["ONLINE", "LIVE", "SYNCED"].includes(status)) return "HEALTHY";
  if (status === "NOT_CONFIGURED") return "UNCONFIGURED";
  if (status === "FAILED") return "FAILED";
  if (status === "STALE") return "STALE";
  return "WARNING";
}

function mergeRegistryEntry(provider, liveSnapshots) {
  const live = liveSnapshotForSource(provider.sourceKey, liveSnapshots);
  const configured = Boolean(provider.apiUrl || provider.enabled);
  const status = live?.status || (configured ? "NOT_CONFIGURED" : "DISABLED");
  const health = deriveHealth(status);
  return {
    id: provider.id,
    source: provider.sourceLabel,
    sourceKey: provider.sourceKey,
    provider: provider.providerName,
    providerType: provider.providerType,
    status,
    health,
    lastSync: live?.lastSyncAt || provider.lastSyncAt || null,
    latencyMs: live?.latencyMs ?? provider.latencyMs ?? null,
    records: live?.records ?? provider.records ?? 0,
    authentication: provider.authenticationType,
    environment: provider.environment,
    enabled: provider.enabled,
    required: provider.required,
    credentialRef: provider.credentialRef,
    apiUrl: provider.apiUrl,
    websocketUrl: provider.websocketUrl,
    config: provider.config
  };
}

function computeSummary(registry) {
  const rowsBySource = new Map();
  for (const row of registry) {
    const current = rowsBySource.get(row.sourceKey);
    if (!current || row.health === "HEALTHY" || current.health === "UNCONFIGURED") rowsBySource.set(row.sourceKey, row);
  }
  const sources = [...rowsBySource.values()];
  const total = sources.length;
  const configured = sources.filter((row) => row.enabled && (row.apiUrl || row.health === "HEALTHY")).length;
  const healthy = sources.filter((row) => row.health === "HEALTHY").length;
  const failed = sources.filter((row) => row.health === "FAILED").length;
  const healthScore = total ? Math.round(sources.reduce((sum, row) => sum + (row.health === "HEALTHY" ? 100 : row.health === "UNCONFIGURED" ? 40 : row.health === "WARNING" ? 70 : 0), 0) / total) : 0;
  const requiredFailures = sources.filter((row) => row.required && row.health !== "HEALTHY").length;
  return {
    totalSources: total,
    configuredSources: configured,
    healthySources: healthy,
    failedSources: failed,
    workflowReadiness: requiredFailures ? "RESTRICTED" : healthScore >= 85 ? "READY" : "CAUTION",
    configurationHealthScore: healthScore
  };
}

export function getSourceConfigurationDashboard(liveSnapshots = []) {
  const store = loadStore();
  const registry = store.providers.map((provider) => mergeRegistryEntry(provider, liveSnapshots));
  const summary = computeSummary(registry);
  const connectedSources = summary.healthySources;
  const lastValidation = store.testResults[0]?.testedAt || store.updatedAt;
  return {
    environment: store.environment,
    updatedAt: store.updatedAt,
    header: {
      connectedSources,
      healthySources: summary.healthySources,
      failedSources: summary.failedSources,
      lastValidation,
      environment: store.environment
    },
    connectivity: summary,
    summaryCards: SOURCE_CATEGORIES.map(({ id }) => registry.find((row) => row.sourceKey === id && row.health === "HEALTHY") || registry.find((row) => row.sourceKey === id)).filter(Boolean).map(({ sourceKey, source, provider, health, lastSync, latencyMs, records, status }) => ({
      sourceKey,
      label: source,
      status,
      provider,
      health,
      lastSync,
      latency: latencyMs != null ? `${latencyMs} ms` : "—",
      records
    })),
    registry,
    providers: store.providers,
    credentials: store.credentials.map(({ vaultRef, sourceKey, status }) => ({ vaultRef, sourceKey, display: `${vaultRef} — Stored Securely`, status })),
    syncJobs: store.syncJobs.map((job) => {
      const live = liveSnapshotForSource(job.sourceKey, liveSnapshots);
      return {
        ...job,
        lastSyncAt: live?.lastSyncAt || job.lastSyncAt,
        recordsImported: live?.records ?? job.recordsImported,
        status: live?.status === "SYNCED" || live?.status === "ONLINE" ? "COMPLETED" : job.status
      };
    }),
    testResults: store.testResults.slice(0, 50),
    auditLogs: store.auditLogs.slice(0, 100),
    workflowDependencies: WORKFLOW_DEPENDENCIES,
    categories: SOURCE_CATEGORIES
  };
}

export function getSourceProviders() {
  const store = loadStore();
  return { providers: store.providers, categories: SOURCE_CATEGORIES };
}

export function getSourceHealth(liveSnapshots = []) {
  const store = loadStore();
  return {
    observedAt: new Date().toISOString(),
    sources: store.providers.map((provider) => {
      const row = mergeRegistryEntry(provider, liveSnapshots);
      return {
        sourceKey: row.sourceKey,
        source: row.source,
        health: row.health,
        freshness: row.lastSync ? "CURRENT" : "UNAVAILABLE",
        latencyMs: row.latencyMs,
        availability: row.health === "HEALTHY" ? "AVAILABLE" : "DEGRADED"
      };
    })
  };
}

export function getSourceLogs() {
  return { auditLogs: loadStore().auditLogs.slice(0, 100), testResults: loadStore().testResults.slice(0, 50) };
}

export function createSourceProvider(body = {}) {
  const store = loadStore();
  const category = SOURCE_CATEGORIES.find((item) => item.id === body.sourceKey);
  if (!category) throw new Error("invalid_source_key");
  const provider = {
    id: `src-${body.sourceKey}-${Date.now()}`,
    sourceKey: body.sourceKey,
    sourceLabel: category.label,
    category: category.category,
    providerName: body.providerName || category.supportedProviders[0],
    providerType: body.providerType || "API",
    apiUrl: body.apiUrl || "",
    websocketUrl: body.websocketUrl || "",
    authenticationType: body.authenticationType || "api_key",
    credentialRef: body.credentialRef || `${category.category.toUpperCase()}_API_KEY`,
    enabled: body.enabled !== false,
    required: category.required,
    environment: body.environment || store.environment,
    config: body.config || {}
  };
  store.providers.push(provider);
  appendAudit(store, { sourceKey: body.sourceKey, event: "Provider Added", user: body.user, result: "SUCCESS" });
  saveStore(store);
  return provider;
}

export function updateSourceProvider(id, body = {}) {
  const store = loadStore();
  const index = store.providers.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("provider_not_found");
  store.providers[index] = { ...store.providers[index], ...body, id };
  appendAudit(store, { sourceKey: store.providers[index].sourceKey, event: "Configuration Updated", user: body.user, result: "SUCCESS" });
  saveStore(store);
  return store.providers[index];
}

export function deleteSourceProvider(id) {
  const store = loadStore();
  const provider = store.providers.find((item) => item.id === id);
  if (!provider) throw new Error("provider_not_found");
  store.providers = store.providers.filter((item) => item.id !== id);
  appendAudit(store, { sourceKey: provider.sourceKey, event: "Provider Removed", result: "SUCCESS" });
  saveStore(store);
  return { id, status: "deleted" };
}

function evaluateTest(provider, liveSnapshots, probeResult) {
  const live = liveSnapshotForSource(provider.sourceKey, liveSnapshots);
  const ok = probeResult?.ok || live && HEALTHY_STATUSES.has(live.status);
  const latencyMs = probeResult?.latencyMs ?? live?.latencyMs ?? null;
  let result = "FAIL";
  if (ok) result = latencyMs != null && latencyMs > 2000 ? "WARNING" : "PASS";
  else if (provider.enabled && provider.apiUrl) result = "FAIL";
  else if (!provider.enabled) result = "WARNING";
  return {
    sourceKey: provider.sourceKey,
    source: provider.sourceLabel,
    result,
    latencyMs,
    details: probeResult?.error || live?.probeError || (ok ? "Connection validated" : provider.apiUrl ? "Probe failed" : "Provider not configured")
  };
}

export async function testSourceProvider(id, { liveSnapshots = [], probeFn } = {}) {
  const store = loadStore();
  const provider = store.providers.find((item) => item.id === id);
  if (!provider) throw new Error("provider_not_found");
  let probeResult = null;
  if (provider.apiUrl && probeFn) probeResult = await probeFn(provider.apiUrl);
  const test = { ...evaluateTest(provider, liveSnapshots, probeResult), testedAt: new Date().toISOString(), providerId: id };
  store.testResults.unshift(test);
  store.testResults.splice(100);
  appendAudit(store, { sourceKey: provider.sourceKey, event: "Connection Tested", result: test.result });
  saveStore(store);
  return test;
}

export async function testAllSourceProviders({ liveSnapshots = [], probeFn } = {}) {
  const store = loadStore();
  const results = [];
  for (const provider of store.providers) {
    let probeResult = null;
    if (provider.apiUrl && probeFn) probeResult = await probeFn(provider.apiUrl);
    results.push({ ...evaluateTest(provider, liveSnapshots, probeResult), testedAt: new Date().toISOString(), providerId: provider.id });
  }
  store.testResults = [...results, ...store.testResults].slice(0, 100);
  appendAudit(store, { sourceKey: "all", event: "Test All Connections", result: results.every((row) => row.result === "PASS") ? "PASS" : "PARTIAL" });
  saveStore(store);
  return { testedAt: new Date().toISOString(), results };
}

export async function syncSourceProvider(id, { liveSnapshots = [] } = {}) {
  const store = loadStore();
  const provider = store.providers.find((item) => item.id === id);
  if (!provider) throw new Error("provider_not_found");
  const live = liveSnapshotForSource(provider.sourceKey, liveSnapshots);
  const started = Date.now();
  const job = store.syncJobs.find((item) => item.sourceKey === provider.sourceKey);
  const recordsImported = live?.records ?? job?.recordsImported ?? 0;
  const sync = {
    sourceKey: provider.sourceKey,
    source: provider.sourceLabel,
    status: live && HEALTHY_STATUSES.has(live.status) ? "COMPLETED" : provider.apiUrl ? "FAILED" : "SKIPPED",
    recordsImported,
    syncDurationMs: Date.now() - started,
    lastSyncAt: new Date().toISOString()
  };
  if (job) {
    job.lastSyncAt = sync.lastSyncAt;
    job.recordsImported = recordsImported;
    job.syncDurationMs = sync.syncDurationMs;
    job.status = sync.status;
  }
  appendAudit(store, { sourceKey: provider.sourceKey, event: sync.status === "COMPLETED" ? "Sync Completed" : "Sync Started", result: sync.status });
  saveStore(store);
  return sync;
}

export async function syncAllSourceProviders({ liveSnapshots = [] } = {}) {
  const store = loadStore();
  const results = [];
  for (const provider of store.providers) {
    results.push(await syncSourceProvider(provider.id, { liveSnapshots }));
  }
  appendAudit(store, { sourceKey: "all", event: "Sync All Sources", result: "COMPLETED" });
  saveStore(store);
  return { syncedAt: new Date().toISOString(), results };
}

export function exportSourceConfiguration() {
  const store = loadStore();
  return {
    exportedAt: new Date().toISOString(),
    environment: store.environment,
    providers: store.providers.map(({ credentialRef, ...provider }) => provider),
    syncJobs: store.syncJobs
  };
}
