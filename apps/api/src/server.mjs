import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

function loadEnvFile() {
  const envPath = fileURLToPath(new URL("../../../.env", import.meta.url));
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    process.env[key] = value;
  }
}

loadEnvFile();
import { ASSET_SCORES, ASSET_UNIVERSE, MOCK_WORKFLOW, WORKFLOW_EVENTS } from "../../../packages/workflow/src/mock-data.js";
import { createCardOneTestReport } from "../../../packages/workflow/src/card-one.js";
import { WORKFLOW_CARD_QUEUE } from "../../../packages/workflow/src/index.js";
import { evaluateDataQualityGate } from "../../../packages/market-intelligence/src/data-sources.js";
import { getCardTwoDashboard, runCardTwoAction } from "../../../packages/market-intelligence/src/card-two-dashboard.js";
import { getValidatedPackageDashboard, persistValidatedPackageFromCardOne } from "../../../packages/market-intelligence/src/validated-package.js";
import { getSourceHealthReviewDashboard, getSourceHealthReviewSlice, runSourceHealthReviewAction } from "../../../packages/market-intelligence/src/source-health-review.js";
import { getDependencyMatrixDashboard, getDependencyMatrixSlice, runDependencyMatrixAction } from "../../../packages/market-intelligence/src/dependency-matrix.js";
import { getMarketEnvironmentDashboard, getMarketEnvironmentSlice, runMarketEnvironmentAction } from "../../../packages/market-intelligence/src/market-environment.js";
import { DATA_QUALITY_GATE_RULES, getDataQualityGateDashboard } from "../../../packages/market-intelligence/src/data-quality-gate.js";
import { buildAccountPortfolioLiveSourceSnapshot } from "../../../packages/market-intelligence/src/account-portfolio-source-validation.js";
import { buildPropFirmRulesLiveSourceSnapshot } from "../../../packages/market-intelligence/src/prop-firm-rules-source-validation.js";
import { buildMarketDataLiveSourceSnapshot, probeMarketDataBridge } from "../../../packages/market-intelligence/src/market-data-source-validation.js";
import { getLastRuntimeSyncResult, runMarketDataRuntimeSync, startMarketDataRuntimeSyncLoop } from "../../../packages/market-intelligence/src/runtime-sync.js";
import { createCotSyncStatus, evaluateInstitutionalCot, getCotComparison, getInstitutionalCotDashboard } from "../../../packages/market-intelligence/src/institutional-cot.js";
import {
  createSourceProvider,
  deleteSourceProvider,
  exportSourceConfiguration,
  getSourceConfigurationDashboard,
  getSourceHealth,
  getSourceLogs,
  getSourceProviders,
  syncAllSourceProviders,
  syncSourceProvider,
  testAllSourceProviders,
  testSourceProvider,
  updateSourceProvider
} from "../../../packages/market-intelligence/src/source-configuration.js";
import {
  detectBrokerServers,
  listBrokerServers,
  listMt5Brokers,
  saveCustomBrokerServer
} from "../../../packages/market-intelligence/src/mt5-broker-servers.js";
import { getDatabaseConfig, testDatabaseConnection } from "../../../packages/market-intelligence/src/db.js";
import { getLatestTicks } from "../../../packages/market-intelligence/src/market-data-repository.js";
import {
  connectNewsProvider,
  getNewsAssetImpact,
  getNewsDashboard,
  getNewsLiveSourceSnapshot,
  listNewsAlerts,
  listNewsArticles,
  listNewsSources,
  listNewsSyncLogs,
  startNewsIntelligenceSyncLoop,
  syncNewsIntelligence,
  testNewsProvider
} from "../../../packages/market-intelligence/src/news-intelligence.js";
import {
  connectEconomicSource,
  createEconomicAlert,
  getCentralBankEvents,
  getEconomicAssetImpact,
  getEconomicCalendarDashboard,
  getEconomicCalendarLiveSourceSnapshot,
  getEconomicEvent,
  getEconomicEventCorrelation,
  getEconomicEventHistory,
  getEconomicRestrictions,
  ingestEconomicActualRelease,
  listEconomicAlerts,
  listEconomicEvents,
  listEconomicReleaseUpdates,
  listEconomicSources,
  listEconomicSyncLogs,
  startEconomicCalendarSyncLoop,
  syncEconomicCalendar,
  syncEconomicActualReleases,
  testEconomicSource
} from "../../../packages/market-intelligence/src/economic-calendar-intelligence.js";
import {
  createMarketDataProvider,
  deleteMarketDataProvider,
  disableMarketDataProvider,
  enableMarketDataProvider,
  exportMarketDataStatus,
  exportMarketDataStatusCsv,
  getMarketDataConfidenceDashboard,
  getMarketDataHealthDashboard,
  getMarketDataLatencyDashboard,
  getMarketDataLogsDashboard,
  getMarketDataOperationsDashboard,
  getMarketDataProviderById,
  getMarketDataSymbolsDashboard,
  detectMt5Terminals,
  detectSymbols,
  getWizardCatalog,
  loadMarketWatch,
  previewProviderCoverage,
  syncAllMarketDataProviderSymbols,
  syncMarketDataProviderSymbols,
  syncMarketDataSymbols,
  testAllMarketDataProviders,
  testMarketDataProvider,
  testProviderConfiguration,
  updateMarketDataProvider,
  validateProviderConfiguration,
  listMt5Terminals,
  listMt5Machines,
  listMt5Heartbeats,
  getMt5TerminalHealthDashboard,
  registerTerminalForProvider,
  generateRegistrationToken,
  getLatestRegistrationToken,
  getOrCreateRegistrationToken,
  recordHeartbeat,
  importMarketWatch,
  triggerTerminalHeartbeat,
  getProviderMt5Details,
  listEaDeployments,
  listConnectionMonitor
} from "../../../packages/market-intelligence/src/market-data-providers.js";
import {
  deployEa,
  updateEa,
  verifyEa,
  rollbackEa,
  getEaDeploymentDashboard,
  listEaDeploymentLogs,
  syncDiscoveredTerminalPaths,
  ensureEaVersionCatalog
} from "../../../packages/market-intelligence/src/ea-deployment.js";
import {
  analyzeSocialSentiment,
  getSocialFearGreed,
  getSocialSentimentAlerts,
  getSocialSentimentCorrelations,
  getSocialSentimentDashboard,
  getSocialSentimentExport,
  getSocialSentimentFeed,
  getSocialSentimentHeatmap,
  getSocialSentimentSources,
  getSocialSentimentSummary,
  getSocialSentimentTopics,
  syncSocialSentiment
} from "../../../packages/market-intelligence/src/social-sentiment.js";
import {
  generatePortfolioReport,
  getAccountPortfolioDashboard,
  getAiPortfolioInsights,
  getPortfolioAccounts,
  getPortfolioCorrelations,
  getPortfolioDrawdowns,
  getPortfolioPositions,
  getPortfolioRisk,
  getPortfolioStrategies,
  getPortfolioTrades,
  getPropCompliance,
  getPortfolioEquity,
  getPortfolioAlerts,
  importPortfolioStatement,
  syncPortfolioAccounts
} from "../../../packages/market-intelligence/src/account-portfolio.js";
import {
  approvePropFirmImport,
  createPropFirmRule,
  createPropFirmSource,
  deletePropFirmRule,
  getPropFirmAuditLogs,
  getPropFirmBreachAlerts,
  getPropFirmCompliance,
  getPropFirmRuleById,
  getPropFirmRulesDashboard,
  getPropFirmRulesSummary,
  importPropFirmRules,
  listPropFirmSources,
  syncPropFirmSources,
  updatePropFirmRule,
  validatePropFirmInput
} from "../../../packages/market-intelligence/src/prop-firm-rules.js";

const port = Number(process.env.API_PORT || 8080);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const cotCachePath = fileURLToPath(new URL("../../web/public/data/institutional-cot.json", import.meta.url));
const cotSyncScriptPath = fileURLToPath(new URL("../../../scripts/sync-cftc-cot.ps1", import.meta.url));
let workflow = { ...MOCK_WORKFLOW };
let cardOneReport;
const sourceProbeLog = [];
const eventLog = WORKFLOW_EVENTS.slice(0, 9).map((type, index) => ({
  id: index + 1, type, workflowId: workflow.workflowId, timestamp: new Date(Date.now() - (9 - index) * 60000).toISOString()
}));

function json(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(body));
}

function mt5EaError(response, reason) {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (message === "database_not_configured") return json(response, 503, { error: message });
  if (message === "terminal_not_found" || message === "rollback_snapshot_not_found" || message === "ea_version_not_found") {
    return json(response, 404, { error: message });
  }
  if (message === "machine_not_linked" || message === "mt5_terminal_paths_not_found") return json(response, 400, { error: message });
  return json(response, 400, { error: message });
}

function auditFromRequest(request) {
  return {
    userLabel: request.headers["x-user-label"] || request.headers["x-user-id"] || "api",
    ipAddress: request.socket?.remoteAddress || null
  };
}

function propFirmError(response, reason) {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (message === "validation_failed") {
    return json(response, 400, { error: message, details: reason.details || [] });
  }
  if (message === "rule_not_found" || message === "import_not_found") {
    return json(response, 404, { error: message });
  }
  if (message === "program_name_exists") {
    return json(response, 409, { error: message });
  }
  return json(response, 400, { error: message });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (reason) {
        reject(reason);
      }
    });
    request.on("error", reject);
  });
}

function record(type, payload = {}) {
  const event = { id: eventLog.length + 1, type, workflowId: workflow.workflowId, payload, timestamp: new Date().toISOString() };
  eventLog.push(event);
  return event;
}

function readCotCache() {
  return JSON.parse(readFileSync(cotCachePath, "utf8").replace(/^\uFEFF/, ""));
}

const liveSourceDefinitions = [
  ["market-data", "market-data", "Market Data Providers", null, true, "Connect an MT5 terminal through Market Data Providers."],
  ["news-sentiment", "news-sentiment", "News & Sentiment Sources", "NEWS_SENTIMENT_LIVE_URL", true, "Configure a licensed headline provider in Source Configuration."],
  ["economic-calendar", "economic-calendar", "Economic Calendar", "ECONOMIC_CALENDAR_LIVE_URL", true, "Configure live macro-event ingestion in Source Configuration."],
  ["social-sentiment", "social-sentiment", "Social Media & Community", "SOCIAL_SENTIMENT_LIVE_URL", false, "Configure optional community intelligence in Source Configuration."],
  ["institutional-cot-data", "institutional-cot", "Institutional / COT Data", "COT_SOURCE_URL", false, "Official CFTC Futures Only archive synchronized by cot_weekly_sync_job."],
  ["historical-data", "historical-data", "Historical Data", "HISTORICAL_DATA_LIVE_URL", true, "Configure an OHLCV archive adapter or upload historical data."],
  ["broker-data", "broker-data", "Broker Data", "BROKER_DATA_LIVE_URL", true, "Configure an MT5, cTrader, FIX or broker API bridge."],
  ["account-portfolio-data", "account-portfolio", "Account & Portfolio Data", "ACCOUNT_PORTFOLIO_LIVE_URL", true, "Connect a broker account or portfolio ledger adapter."],
  ["prop-firm-rules", "prop-firm-rules", "Prop Firm Rules & Limits", null, true, "Production rule catalog from market.prop_firms (no external URL probe)."]
];

const HEALTHY_LIVE_SOURCE_STATUSES = new Set(["ONLINE", "LIVE", "SYNCED"]);

function configuredSourceUrl(routeSlug, envKey) {
  if (envKey && process.env[envKey]) return process.env[envKey];
  const sourceKey = routeSlug === "account-portfolio" ? "account-portfolio" : routeSlug;
  const provider = getSourceProviders().providers.find(item => item.sourceKey === sourceKey && item.enabled && item.apiUrl);
  return provider?.apiUrl || null;
}

function configuredSourceProvider(configuredUrl, routeSlug) {
  if (!configuredUrl) return "Provider Not Connected";
  const provider = getSourceProviders().providers.find(item => item.sourceKey === routeSlug && item.enabled && item.apiUrl === configuredUrl);
  if (provider?.providerName) return provider.providerName;
  try { return new URL(configuredUrl).host; } catch { return "Configured Adapter"; }
}

function latestRecordedTickEvidence(ticks) {
  const observedAt = ticks.reduce((latest, tick) => {
    const value = tick.observed_at ? new Date(tick.observed_at).toISOString() : null;
    return value && (!latest || value > latest) ? value : latest;
  }, null);
  return {
    ticks,
    observedAt,
    freshnessSeconds: observedAt ? Math.max(0, Math.round((Date.now() - new Date(observedAt).getTime()) / 1000)) : 0
  };
}

function buildLocalSnapshot({ id, routeSlug, name, required, configuration, provider, status, adapter, ticks, observedAt, freshnessSeconds, latencyMs = 0 }) {
  const healthy = HEALTHY_LIVE_SOURCE_STATUSES.has(status);
  return {
    id, routeSlug, name, category: id, subtitle: configuration,
    provider, status, required, lastSyncAt: observedAt, freshnessSeconds,
    freshness: observedAt ? `${freshnessSeconds}s since recorded MT5 tick` : "UNAVAILABLE",
    healthScore: healthy ? 100 : 0, latencyMs, errorCount: healthy ? 0 : 1,
    feedsStage: "Card 1", failureAction: required ? "block_card_1" : "reduce_confidence",
    records: ticks.length, adapter, configuration, connectionLabel: "Repository Adapter", envKey: null,
    httpStatus: null, probeError: healthy ? null : configuration,
    checks: {
      configured: healthy, availability: healthy, apiValidation: healthy,
      latency: latencyMs ? `${latencyMs} ms` : "LOCAL REPOSITORY",
      freshness: observedAt ? `${freshnessSeconds}s since recorded MT5 tick` : "UNAVAILABLE",
      quality: healthy ? "PASSED" : "FAILED"
    }
  };
}

function recordSourceProbe(sources, probedAt) {
  sourceProbeLog.unshift({
    id: `PROBE-${probedAt.replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`,
    probedAt,
    live: sources.filter(source => ["ONLINE", "LIVE", "SYNCED"].includes(source.status)).length,
    unavailable: sources.filter(source => !["ONLINE", "LIVE", "SYNCED"].includes(source.status)).length,
    qualityScore: getDataQualityGateDashboard(sources).dataQualityScore
  });
  sourceProbeLog.splice(20);
}

async function probeConfiguredUrl(url) {
  const started = performance.now();
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000), headers: { "User-Agent": "CACSMS-Data-Sources-Validation/1.0" } });
    let metadata = {};
    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) metadata = await response.json();
    } catch {}
    return { ...metadata, ok: response.ok, httpStatus: response.status, latencyMs: Math.round(performance.now() - started), error: response.ok ? null : `HTTP ${response.status}` };
  } catch (reason) {
    return { ok: false, httpStatus: null, latencyMs: Math.round(performance.now() - started), error: reason.message };
  }
}

async function getMarketDataLiveProbe() {
  const url = process.env.MARKET_DATA_LIVE_URL;
  if (url) return probeConfiguredUrl(url);
  return probeMarketDataBridge();
}

async function getLiveSourceSnapshots({ skipRuntimeSync = false } = {}) {
  loadEnvFile();
  if (!skipRuntimeSync) await runMarketDataRuntimeSync();
  let cot;
  try { cot = readCotCache(); } catch {}
  const marketDataSnapshot = await buildMarketDataLiveSourceSnapshot();
  let recordedTicks = [];
  try { recordedTicks = await getLatestTicks(40); } catch {}
  const tickEvidence = latestRecordedTickEvidence(recordedTicks);
  const snapshots = await Promise.all(liveSourceDefinitions.map(async ([id, routeSlug, name, envKey, required, configuration]) => {
    if (id === "market-data") return marketDataSnapshot;
    if (id === "news-sentiment") return getNewsLiveSourceSnapshot();
    if (id === "economic-calendar") return getEconomicCalendarLiveSourceSnapshot();
    if (id === "social-sentiment") {
      const social = await getSocialSentimentDashboard();
      const sources = social.sources || [];
      const checks = social.empty
        ? {
            configured: false,
            availability: false,
            apiValidation: false,
            latency: "NOT TESTED",
            freshness: "UNAVAILABLE",
            quality: "FAILED",
            message: "No production social sentiment source is connected."
          }
        : {
            configured: true,
            availability: true,
            apiValidation: true,
            latency: "DATABASE",
            freshness: social.updatedAt ? "LIVE STORAGE" : "UNAVAILABLE",
            quality: "PASSED"
          };
      return {
        id,
        routeSlug,
        name,
        category: id,
        subtitle: configuration,
        provider: sources.length ? sources.map((source) => source.source).join(", ") : "Provider Not Connected",
        status: social.empty ? "NOT_CONFIGURED" : "SYNCED",
        required,
        lastSyncAt: social.updatedAt,
        freshnessSeconds: 0,
        freshness: social.empty ? "UNAVAILABLE" : "LIVE STORAGE",
        healthScore: social.empty ? 0 : Number(social.trust_score || 0),
        latencyMs: 0,
        errorCount: social.empty ? 1 : 0,
        feedsStage: "Card 1",
        failureAction: required ? "block_card_1" : "reduce_confidence",
        records: social.feed?.length || 0,
        adapter: "production_social_sentiment_repository",
        configuration: social.empty
          ? "Connect a production social feed or import production social data. Mock social sentiment data is disabled."
          : "Production social sentiment records are available.",
        connectionLabel: "Production Repository",
        envKey: null,
        httpStatus: null,
        probeError: social.empty ? "production_social_source_not_connected" : null,
        checks
      };
    }
    if (id === "historical-data" && tickEvidence.ticks.length) {
      return buildLocalSnapshot({
        id, routeSlug, name, required, configuration,
        provider: "CACSMS MT5 Tick Archive", status: "SYNCED", adapter: "local_mt5_tick_archive",
        ...tickEvidence
      });
    }
    if (id === "broker-data" && HEALTHY_LIVE_SOURCE_STATUSES.has(marketDataSnapshot.status)) {
      return buildLocalSnapshot({
        id, routeSlug, name, required, configuration,
        provider: "CACSMS MT5 Broker Bridge", status: "LIVE", adapter: "mt5_broker_bridge",
        latencyMs: marketDataSnapshot.latencyMs, ...tickEvidence
      });
    }
    if (id === "account-portfolio-data") {
      return buildAccountPortfolioLiveSourceSnapshot();
    }
    if (id === "prop-firm-rules") {
      return buildPropFirmRulesLiveSourceSnapshot();
    }
    const isCot = id === "institutional-cot-data";
    const configuredUrl = configuredSourceUrl(routeSlug, envKey);
    const cotReady = isCot && cot?.latestReportDate && existsSync(cotCachePath);
    const configured = Boolean(configuredUrl || cotReady);
    const modified = cotReady ? statSync(cotCachePath).mtime.toISOString() : null;
    const probe = configuredUrl && !isCot ? await probeConfiguredUrl(configuredUrl) : null;
    const status = cotReady ? "SYNCED" : probe?.ok ? "ONLINE" : configured ? "FAILED" : "NOT_CONFIGURED";
    return {
      id, routeSlug, name, category: id, subtitle: configuration,
      provider: cotReady ? "CFTC Historical Compressed / Futures Only" : configuredSourceProvider(configuredUrl, routeSlug),
      status,
      required, lastSyncAt: modified || (probe?.ok ? new Date().toISOString() : null), freshnessSeconds: cotReady ? Math.max(0, Math.round((Date.now() - statSync(cotCachePath).mtimeMs) / 1000)) : 0,
      freshness: cotReady ? `Official report ${cot.latestReportDate}` : probe?.ok ? "LIVE PROBE" : "UNAVAILABLE",
      healthScore: cotReady || probe?.ok ? 100 : 0, latencyMs: probe?.latencyMs || 0, errorCount: cotReady || probe?.ok ? 0 : 1,
      feedsStage: "Card 1", failureAction: required ? "block_card_1" : "reduce_confidence",
      records: cotReady ? Object.values(cot.history || {}).reduce((sum, rows) => sum + rows.length, 0) : Number(probe?.records || 0),
      adapter: cotReady ? "official_cftc_cache" : probe?.ok ? probe.adapter || "live_http_probe" : configured ? "configured_url_failed_probe" : "none",
      configuration, connectionLabel: envKey ? "External Adapter" : "Official Archive", envKey: null,
      httpStatus: probe?.httpStatus || null, probeError: probe?.error || null,
      checks: {
        configured, availability: cotReady || Boolean(probe?.ok), apiValidation: cotReady || Boolean(probe?.ok),
        latency: probe ? `${probe.latencyMs} ms` : cotReady ? "ARCHIVE CACHE" : "NOT TESTED",
        freshness: cotReady ? `Official report ${cot.latestReportDate}` : probe?.ok ? "LIVE" : "UNAVAILABLE",
        quality: cotReady || probe?.ok ? "PASSED" : "FAILED"
      }
    };
  }));
  return snapshots;
}

async function getLiveMarketIntelligenceDashboard({ log = false } = {}) {
  const sources = await getLiveSourceSnapshots();
  const gate = getDataQualityGateDashboard(sources);
  const probedAt = new Date().toISOString();
  if (log) recordSourceProbe(sources, probedAt);
  return {
    probedAt, sourceMode: "LIVE_ADAPTERS_ONLY", sources, gate, probeLog: sourceProbeLog,
    summary: {
      live: sources.filter(source => ["ONLINE", "LIVE", "SYNCED"].includes(source.status)).length,
      notConfigured: sources.filter(source => source.status === "NOT_CONFIGURED").length,
      unavailable: sources.filter(source => !["ONLINE", "LIVE", "SYNCED"].includes(source.status)).length
    }
  };
}

async function liveSourcePayload(id) {
  const source = (await getLiveSourceSnapshots()).find(item => item.id === id);
  const records = ["historical-data", "broker-data"].includes(id) ? await getLatestTicks(40) : [];
  return { sourceMode: "LIVE_ADAPTERS_ONLY", status: source?.status || "NOT_CONFIGURED", source, records, warnings: HEALTHY_LIVE_SOURCE_STATUSES.has(source?.status) ? [] : [source?.configuration || "Live adapter is not configured"] };
}

async function liveAction(type, id) {
  const source = (await getLiveSourceSnapshots()).find(item => item.id === id);
  return { type, status: source?.status === "SYNCED" ? "completed" : "NOT_CONFIGURED", source };
}

function startCotSync() {
  const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", cotSyncScriptPath], { cwd: root, stdio: "ignore", windowsHide: true });
  child.unref();
  return { type: "institutional_cot.sync.accepted", status: "SYNCING", job: "cot_weekly_sync_job" };
}

const routes = {
  "GET /health": () => ({ service: "cacsms-api", status: "healthy", timestamp: new Date().toISOString() }),
  "GET /api/system/health": async () => {
    const database = await testDatabaseConnection();
    const dbConfig = getDatabaseConfig();
    return {
      status: database.connected ? "healthy" : database.configured ? "degraded" : "healthy",
      environment: "foundation",
      services: {
        api: "online",
        database: database.connected ? "ready" : database.configured ? "error" : "not_configured",
        websocket: "online",
        redis: "ready",
        rabbitmq: "ready"
      },
      database: { ...dbConfig, ...database },
      runtimeSync: getLastRuntimeSyncResult()
    };
  },
  "GET /api/system/runtime-sync": async () => ({
    ...(getLastRuntimeSyncResult() || { syncedAt: null, skipped: true, reason: "not_run_yet" }),
    autoSyncMs: Number(process.env.CACSMS_AUTO_SYNC_MS || 30000)
  }),
  "GET /api/system/database": async () => ({
    ...(await testDatabaseConnection()),
    config: getDatabaseConfig()
  }),
  "GET /api/workflow/current": () => workflow,
  "GET /api/workflow/events": () => ({ events: eventLog }),
  "GET /api/workflow/cards/1": async () => cardOneReport || createCardOneTestReport(await getLiveSourceSnapshots()),
  "GET /api/workflow/cards": () => ({ cards: WORKFLOW_CARD_QUEUE }),
  "GET /api/assets/universe": () => ({ count: ASSET_UNIVERSE.length, assets: ASSET_UNIVERSE }),
  "GET /api/assets/scores": () => ({ workflowId: workflow.workflowId, scores: ASSET_SCORES }),
  "GET /api/infrastructure/status": () => ({
    status: "healthy", machines: 1248, mt5Terminals: 5672, accounts: 18420, averageLatencyMs: 42
  }),
  "GET /api/market-intelligence/live/dashboard": () => getLiveMarketIntelligenceDashboard(),
  "GET /api/market-intelligence/data-sources": async () => ({ sourceMode: "LIVE_ADAPTERS_ONLY", sources: await getLiveSourceSnapshots() }),
  "GET /api/market-intelligence/dashboard": () => getCardTwoDashboard(),
  "GET /api/market-intelligence/card-2/dashboard": () => getCardTwoDashboard(),
  "GET /api/market-intelligence/card-2/validated-package": () => getValidatedPackageDashboard(),
  "GET /api/market-intelligence/source-health-review": () => getSourceHealthReviewDashboard(),
  "GET /api/market-intelligence/source-health-review/summary": () => getSourceHealthReviewSlice("summary"),
  "GET /api/market-intelligence/source-health-review/freshness": () => getSourceHealthReviewSlice("freshness"),
  "GET /api/market-intelligence/source-health-review/failures": () => getSourceHealthReviewSlice("failures"),
  "GET /api/market-intelligence/source-health-review/quality": () => getSourceHealthReviewSlice("quality"),
  "GET /api/market-intelligence/source-health-review/dependencies": () => getSourceHealthReviewSlice("dependencies"),
  "GET /api/market-intelligence/source-health-review/rate-limits": () => getSourceHealthReviewSlice("rate-limits"),
  "GET /api/market-intelligence/source-health-review/security": () => getSourceHealthReviewSlice("security"),
  "GET /api/market-intelligence/source-health-review/export": () => getSourceHealthReviewSlice("export"),
  "GET /api/market-intelligence/dependency-matrix": () => getDependencyMatrixDashboard(),
  "GET /api/market-intelligence/dependency-matrix/summary": () => getDependencyMatrixSlice("summary"),
  "GET /api/market-intelligence/dependency-matrix/graph": () => getDependencyMatrixSlice("graph"),
  "GET /api/market-intelligence/dependency-matrix/modules": () => getDependencyMatrixSlice("modules"),
  "GET /api/market-intelligence/dependency-matrix/sources": () => getDependencyMatrixSlice("sources"),
  "GET /api/market-intelligence/dependency-matrix/services": () => getDependencyMatrixSlice("services"),
  "GET /api/market-intelligence/dependency-matrix/database": () => getDependencyMatrixSlice("database"),
  "GET /api/market-intelligence/dependency-matrix/recommendations": () => getDependencyMatrixSlice("recommendations"),
  "GET /api/market-intelligence/dependency-matrix/export": () => getDependencyMatrixSlice("export"),
  "GET /api/market-intelligence/market-environment": () => getMarketEnvironmentDashboard(),
  "GET /api/market-intelligence/market-environment/summary": () => getMarketEnvironmentSlice("summary"),
  "GET /api/market-intelligence/market-environment/instruments": () => getMarketEnvironmentSlice("instruments"),
  "GET /api/market-intelligence/market-environment/inputs": () => getMarketEnvironmentSlice("inputs"),
  "GET /api/market-intelligence/market-environment/volatility": () => getMarketEnvironmentSlice("volatility"),
  "GET /api/market-intelligence/market-environment/risk-tone": () => getMarketEnvironmentSlice("risk-tone"),
  "GET /api/market-intelligence/market-environment/session": () => getMarketEnvironmentSlice("session"),
  "GET /api/market-intelligence/market-environment/events": () => getMarketEnvironmentSlice("events"),
  "GET /api/market-intelligence/market-environment/export": () => getMarketEnvironmentSlice("export"),
  "GET /api/market-intelligence/data-sources/health": async () => ({ sourceMode: "LIVE_ADAPTERS_ONLY", sources: await getLiveSourceSnapshots() }),
  "GET /api/market-intelligence/economic-events": () => ({ events: [], status: "NOT_CONFIGURED" }),
  "GET /api/market-intelligence/news-sentiment": () => getNewsDashboard(),
  "GET /api/market-intelligence/broker-feeds": () => ({ feeds: [], status: "NOT_CONFIGURED" }),
  "GET /api/market-intelligence/data-quality-gate": async () => getDataQualityGateDashboard(await getLiveSourceSnapshots()),
  "GET /api/market-intelligence/data-quality-gate/sources": async () => ({ sources: getDataQualityGateDashboard(await getLiveSourceSnapshots()).sources }),
  "GET /api/market-intelligence/data-quality-gate/validations": async () => ({ rules: getDataQualityGateDashboard(await getLiveSourceSnapshots()).rules }),
  "GET /api/market-intelligence/data-quality-gate/events": () => ({ events: [], source_mode: "LIVE_ADAPTERS_ONLY" }),
  "GET /api/market-intelligence/data-quality-gate/export": () => ({ status: "ready", format: "csv", rules: DATA_QUALITY_GATE_RULES.length }),
  "GET /api/market-intelligence/feed-events": () => ({ events: [] })
  ,"GET /api/market-data/providers": async () => getMarketDataOperationsDashboard({ liveProbe: await getMarketDataLiveProbe() })
  ,"GET /api/market-data/providers/health": async () => getMarketDataHealthDashboard({ liveProbe: await getMarketDataLiveProbe() })
  ,"GET /api/market-data/providers/latency": async () => getMarketDataLatencyDashboard({ liveProbe: await getMarketDataLiveProbe() })
  ,"GET /api/market-data/providers/symbols": async () => getMarketDataSymbolsDashboard({ liveProbe: await getMarketDataLiveProbe() })
  ,"GET /api/market-data/providers/logs": () => getMarketDataLogsDashboard()
  ,"GET /api/market-data/providers/confidence": async () => getMarketDataConfidenceDashboard({ liveProbe: await getMarketDataLiveProbe() })
  ,"GET /api/market-data/providers/coverage": async () => {
    const dashboard = await getMarketDataOperationsDashboard({ liveProbe: await getMarketDataLiveProbe() });
    return { symbolsOnline: dashboard.symbols, assets: dashboard.coverage };
  }
  ,"GET /api/market-data/providers/events": () => getMarketDataLogsDashboard()
  ,"GET /api/market-data/ticks/latest": async url => {
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 8), 1), 40);
    const ticks = await getLatestTicks(limit);
    const observedAt = ticks.reduce((latest, tick) => {
      const value = tick.observed_at ? new Date(tick.observed_at).toISOString() : null;
      return value && (!latest || value > latest) ? value : latest;
    }, null);
    return { source: "recorded_mt5_ticks", observedAt, ticks };
  }
  ,"GET /api/market-data/providers/export": async () => {
    const payload = await exportMarketDataStatus({ liveProbe: await getMarketDataLiveProbe() });
    return { format: "csv", csv: exportMarketDataStatusCsv(payload), ...payload };
  }
  ,"GET /api/market-data/providers/catalog": () => getWizardCatalog()
  ,"GET /api/market-data/providers/detect-mt5-terminals": () => detectMt5Terminals()
  ,"GET /api/mt5/brokers": () => listMt5Brokers()
  ,"GET /api/market-intelligence/news-sentiment/dashboard": () => getNewsDashboard()
  ,"GET /api/market-intelligence/news-sentiment/headlines": url => {
    const result = listNewsArticles(Object.fromEntries(url.searchParams));
    return { headlines: result.articles, total: result.total, source_mode: result.sourceMode };
  }
  ,"GET /api/market-intelligence/news-sentiment/sources": () => listNewsSources()
  ,"GET /api/market-intelligence/news-sentiment/asset-impact": () => getNewsAssetImpact()
  ,"GET /api/market-intelligence/news-sentiment/risk-panel": () => listNewsAlerts()
  ,"GET /api/news/live": url => listNewsArticles({ ...Object.fromEntries(url.searchParams), limit: url.searchParams.get("limit") || 100 })
  ,"GET /api/news/latest": url => listNewsArticles({ ...Object.fromEntries(url.searchParams), limit: url.searchParams.get("limit") || 50 })
  ,"GET /api/news/breaking": url => listNewsArticles({ ...Object.fromEntries(url.searchParams), breaking: true })
  ,"GET /api/news/sentiment": () => getNewsDashboard()
  ,"GET /api/news/impact": () => getNewsAssetImpact()
  ,"GET /api/news/economic-calendar": url => listEconomicEvents(Object.fromEntries(url.searchParams))
  ,"GET /api/news/alerts": () => listNewsAlerts()
  ,"GET /api/news/provider/health": () => listNewsSources()
  ,"GET /api/news/provider/logs": () => listNewsSyncLogs()
  ,"GET /api/market-intelligence/economic-calendar/dashboard": () => getEconomicCalendarDashboard()
  ,"GET /api/market-intelligence/economic-calendar/events": url => listEconomicEvents(Object.fromEntries(url.searchParams))
  ,"GET /api/market-intelligence/economic-calendar/high-impact": () => ({ event: getEconomicCalendarDashboard().nextHighImpact, source_mode: "LIVE_PROVIDERS_ONLY" })
  ,"GET /api/market-intelligence/economic-calendar/restrictions": () => getEconomicRestrictions()
  ,"GET /api/market-intelligence/economic-calendar/asset-impact": () => getEconomicAssetImpact()
  ,"GET /api/market-intelligence/economic-calendar/central-banks": () => getCentralBankEvents()
  ,"GET /api/economic-calendar": url => listEconomicEvents(Object.fromEntries(url.searchParams))
  ,"GET /api/economic-calendar/upcoming": url => listEconomicEvents({ ...Object.fromEntries(url.searchParams), range:"upcoming" })
  ,"GET /api/economic-calendar/today": url => listEconomicEvents({ ...Object.fromEntries(url.searchParams), range:"today" })
  ,"GET /api/economic-calendar/high-impact": url => listEconomicEvents({ ...Object.fromEntries(url.searchParams), impact:"HIGH" })
  ,"GET /api/economic-calendar/history": url => listEconomicEvents({ ...Object.fromEntries(url.searchParams), range:"week" })
  ,"GET /api/economic-calendar/sources": () => listEconomicSources()
  ,"GET /api/economic-calendar/alerts": () => listEconomicAlerts()
  ,"GET /api/economic-calendar/logs": () => listEconomicSyncLogs()
  ,"GET /api/economic-calendar/release-updates": url => listEconomicReleaseUpdates({ since:url.searchParams.get("since") })
  ,"GET /api/market-intelligence/social-sentiment": () => getSocialSentimentDashboard()
  ,"GET /api/market-intelligence/social-sentiment/dashboard": () => getSocialSentimentDashboard()
  ,"GET /api/market-intelligence/social-sentiment/summary": () => getSocialSentimentSummary()
  ,"GET /api/market-intelligence/social-sentiment/feed": () => getSocialSentimentFeed()
  ,"GET /api/market-intelligence/social-sentiment/heatmap": () => getSocialSentimentHeatmap()
  ,"GET /api/market-intelligence/social-sentiment/topics": () => getSocialSentimentTopics()
  ,"GET /api/market-intelligence/social-sentiment/fear-greed": () => getSocialFearGreed()
  ,"GET /api/market-intelligence/social-sentiment/sources": () => getSocialSentimentSources()
  ,"GET /api/market-intelligence/social-sentiment/alerts": () => getSocialSentimentAlerts()
  ,"GET /api/market-intelligence/social-sentiment/correlations": () => getSocialSentimentCorrelations()
  ,"GET /api/market-intelligence/social-sentiment/export": () => getSocialSentimentExport()
  ,"GET /api/market-intelligence/social-sentiment/asset-matrix": () => getSocialSentimentHeatmap()
  ,"GET /api/market-intelligence/social-sentiment/retail-positioning": async () => ({ positioning: (await getSocialSentimentDashboard()).retailPositioning })
  ,"GET /api/market-intelligence/social-sentiment/spikes": async () => ({ spikes: (await getSocialSentimentDashboard()).spikes })
  ,"GET /api/market-intelligence/social-sentiment/contrarian": async () => ({ signals: (await getSocialSentimentDashboard()).contrarian })
  ,"GET /api/market-intelligence/social-sentiment/source-health": () => getSocialSentimentSources()
  ,"GET /api/market-intelligence/institutional-cot/dashboard": url => getInstitutionalCotDashboard(readCotCache(), url.searchParams.get("currency") || "EUR")
  ,"GET /api/market-intelligence/institutional-cot/currencies": () => ({ currencies: getCotComparison(readCotCache()) })
  ,"GET /api/market-intelligence/institutional-cot/history": url => ({ currency: url.searchParams.get("currency") || "EUR", range: url.searchParams.get("range") || "1Y", history: readCotCache().history[url.searchParams.get("currency") || "EUR"] || [] })
  ,"GET /api/market-intelligence/institutional-cot/latest": url => evaluateInstitutionalCot(readCotCache(), { currency: url.searchParams.get("currency") || "EUR" })
  ,"GET /api/market-intelligence/institutional-cot/comparison": () => ({ comparison: getCotComparison(readCotCache()) })
  ,"GET /api/market-intelligence/institutional-cot/sync/status": () => createCotSyncStatus(readCotCache())
  ,"GET /api/market-intelligence/institutional-cot/sync/logs": () => ({ logs: getInstitutionalCotDashboard(readCotCache()).syncLogs })
  ,"GET /api/market-intelligence/historical-data": () => liveSourcePayload("historical-data")
  ,"GET /api/market-intelligence/historical-data/export": url => ({ status: "unavailable", format: url.searchParams.get("format") || "csv", records: 0 })
  ,"GET /api/market-intelligence/historical-data/summary": () => ({ summary: null })
  ,"GET /api/market-intelligence/historical-data/comparison": () => ({ comparison: [] })
  ,"GET /api/market-intelligence/broker-data": () => liveSourcePayload("broker-data")
  ,"GET /api/market-intelligence/broker-data/sources": () => ({ sources: [] })
  ,"GET /api/market-intelligence/broker-data/compare": () => ({ comparison: [] })
  ,"GET /api/market-intelligence/broker-data/validation": () => ({ issues: [] })
  ,"GET /api/market-intelligence/broker-data/export": () => ({ status: "unavailable", format: "csv", records: 0 })
  ,"GET /api/market-intelligence/account-portfolio": async () => getAccountPortfolioDashboard()
  ,"GET /api/market-intelligence/account-portfolio/accounts": async () => getPortfolioAccounts()
  ,"GET /api/market-intelligence/account-portfolio/positions/open": async () => getPortfolioPositions()
  ,"GET /api/market-intelligence/account-portfolio/trades/closed": async () => getPortfolioTrades()
  ,"GET /api/market-intelligence/account-portfolio/risk": async () => getPortfolioRisk()
  ,"GET /api/market-intelligence/account-portfolio/equity-curve": async () => getPortfolioEquity()
  ,"GET /api/market-intelligence/account-portfolio/export": async () => ({ status: "ready", format: "csv", accounts: (await getPortfolioAccounts()).accounts.length })
  ,"GET /api/market-intelligence/prop-firm-rules": async () => getPropFirmRulesDashboard()
  ,"GET /api/market-intelligence/prop-firm-rules/summary": async () => getPropFirmRulesSummary()
  ,"GET /api/market-intelligence/prop-firm-rules/comparison": async () => {
    const d = await getPropFirmRulesDashboard();
    return { comparison: d.comparison };
  }
  ,"GET /api/market-intelligence/prop-firm-rules/compliance": async () => getPropFirmCompliance()
  ,"GET /api/market-intelligence/prop-firm-rules/breach-alerts": async () => getPropFirmBreachAlerts()
  ,"GET /api/market-intelligence/prop-firm-rules/breach-risk": async () => getPropFirmBreachAlerts()
  ,"GET /api/market-intelligence/prop-firm-rules/sources": async () => listPropFirmSources()
  ,"GET /api/market-intelligence/prop-firm-rules/audit-logs": async () => getPropFirmAuditLogs()
  ,"GET /api/market-intelligence/prop-firm-rules/export": async () => {
    const d = await getPropFirmRulesDashboard();
    return { status: d.rules.length ? "ready" : "empty", format: "csv", rules: d.rules.length };
  }
  ,"GET /api/source-configuration": async () => getSourceConfigurationDashboard(await getLiveSourceSnapshots())
  ,"GET /api/source-configuration/providers": () => getSourceProviders()
  ,"GET /api/source-configuration/health": async () => getSourceHealth(await getLiveSourceSnapshots())
  ,"GET /api/source-configuration/logs": () => getSourceLogs()
  ,"GET /api/source-configuration/export": () => exportSourceConfiguration()
};

const actions = {
  "/api/workflow/start": () => {
    workflow = { ...MOCK_WORKFLOW, status: "running", startedAt: new Date().toISOString() };
    return record("workflow.started");
  },
  "/api/workflow/pause": () => {
    workflow = { ...workflow, status: "blocked" };
    return record("workflow.stage.blocked", { reason: "operator_pause" });
  },
  "/api/workflow/resume": () => {
    workflow = { ...workflow, status: "running" };
    return record("workflow.stage.started", { stage: workflow.currentStage });
  },
  "/api/workflow/stop": () => {
    workflow = { ...workflow, status: "stopped", completedAt: new Date().toISOString() };
    return record("workflow.completed", { status: "stopped" });
  },
  "/api/workflow/retry-stage": () => {
    workflow = { ...workflow, status: "retrying", retryCount: workflow.retryCount + 1 };
    return record("workflow.stage.started", { stage: workflow.currentStage, retry: workflow.retryCount });
  },
  "/api/workflow/cards/1/test-live": async () => {
    cardOneReport = createCardOneTestReport(await getLiveSourceSnapshots());
    const packageRecord = await persistValidatedPackageFromCardOne(cardOneReport);
    return { type: "workflow.card1.live_test.completed", report: cardOneReport, package: packageRecord };
  },
  "/api/market-intelligence/data-sources/test": async () => ({ type: "market_intelligence.sources.live_probe.completed", ...await getLiveMarketIntelligenceDashboard({ log: true }) }),
  "/api/market-intelligence/data-sources/sync": async () => ({ type: "market_intelligence.sources.live_probe.completed", ...await getLiveMarketIntelligenceDashboard({ log: true }) }),
  "/api/market-intelligence/scan": async () => ({ type: "market_intelligence.scan.rejected", status: "NOT_READY", gate: getDataQualityGateDashboard(await getLiveSourceSnapshots()) }),
  "/api/market-intelligence/refresh-feeds": async () => ({ type: "market_intelligence.sources.live_probe.completed", ...await getLiveMarketIntelligenceDashboard({ log: true }) }),
  "/api/market-intelligence/test-sources": async () => ({ type: "market_intelligence.sources.live_probe.completed", ...await getLiveMarketIntelligenceDashboard({ log: true }) })
  ,"/api/market-data/providers/validate": () => liveAction("market_data.providers.live_probe.completed", "market-data")
  ,"/api/market-data/providers/restart": () => liveAction("restart", "market-data")
  ,"/api/market-intelligence/news-sentiment/refresh": async () => ({ type: "news_sentiment.sync.completed", ...await syncNewsIntelligence({ force: true }) })
  ,"/api/market-intelligence/news-sentiment/classify": () => ({ type: "news_sentiment.classification.completed", ...getNewsDashboard() })
  ,"/api/market-intelligence/news-sentiment/create-alert": () => ({ type: "news_sentiment.alerts.current", ...listNewsAlerts() })
  ,"/api/news/sync": async () => ({ type: "news.sync.completed", ...await syncNewsIntelligence({ force: true }) })
  ,"/api/market-intelligence/economic-calendar/sync": async () => ({ type:"economic_calendar.sync.completed", ...await syncEconomicCalendar({ force:true }) })
  ,"/api/market-intelligence/economic-calendar/risk-scan": () => ({ type:"economic_calendar.risk_scan.completed", ...getEconomicCalendarDashboard() })
  ,"/api/market-intelligence/economic-calendar/apply-restriction": () => ({ type:"economic_calendar.restrictions.current", ...getEconomicRestrictions() })
  ,"/api/market-intelligence/economic-calendar/release-restriction": () => ({ type:"economic_calendar.restrictions.current", ...getEconomicRestrictions() })
  ,"/api/economic-calendar/sync": async () => ({ type:"economic_calendar.sync.completed", ...await syncEconomicCalendar({ force:true }) })
  ,"/api/economic-calendar/releases/sync": async () => ({ type:"economic_calendar.release_sync.completed", ...await syncEconomicActualReleases({ force:true }) })
  ,"/api/market-intelligence/social-sentiment/sync": async () => ({ type: "social_sentiment.sync.completed", ...await syncSocialSentiment() })
  ,"/api/market-intelligence/social-sentiment/sources": async () => ({ type: "social_sentiment.source.accepted", accepted: true, ...await getSocialSentimentSources() })
  ,"/api/market-intelligence/social-sentiment/alerts": async () => ({ type: "social_sentiment.alert.accepted", accepted: true, ...await getSocialSentimentAlerts() })
  ,"/api/market-intelligence/social-sentiment/analyze": async () => ({ type: "social_sentiment.analysis.completed", ...await analyzeSocialSentiment() })
  ,"/api/market-intelligence/social-sentiment/refresh": async () => ({ type: "social_sentiment.sync.completed", ...await syncSocialSentiment() })
  ,"/api/market-intelligence/social-sentiment/run-scan": async () => ({ type: "social_sentiment.scan.completed", ...await analyzeSocialSentiment() })
  ,"/api/market-intelligence/social-sentiment/generate-contrarian-signals": async () => ({ type: "social_sentiment.contrarian.completed", signals: (await getSocialSentimentDashboard()).contrarian })
  ,"/api/market-intelligence/institutional-cot/sync-now": () => startCotSync()
  ,"/api/market-intelligence/institutional-cot/sync-year": () => startCotSync()
  ,"/api/market-intelligence/institutional-cot/sync-all": () => startCotSync()
  ,"/api/market-intelligence/institutional-cot/recalculate-bias": () => ({ type: "institutional_cot.bias.recalculated", status: "completed", currencies: readCotCache().mappings.length })
  ,"/api/market-intelligence/institutional-cot/validate-latest": () => ({ type: "institutional_cot.latest.validated", status: "completed", latest_report_date: readCotCache().latestReportDate })
  ,"/api/market-intelligence/historical-data/sync": () => liveAction("historical_data.live_probe.completed", "historical-data")
  ,"/api/market-intelligence/historical-data/upload": () => ({ type: "historical_data.upload.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/broker-data/connect": () => ({ type: "broker_data.connect.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/broker-data/sync": () => liveAction("broker_data.live_probe.completed", "broker-data")
  ,"/api/market-intelligence/broker-data/upload": () => ({ type: "broker_data.upload.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/account-portfolio/sync": async () => ({ type: "account_portfolio.sync.completed", ...(await syncPortfolioAccounts()) })
  ,"/api/market-intelligence/account-portfolio/connect": () => ({ type: "account_portfolio.connect.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/account-portfolio/upload": () => ({ type: "account_portfolio.statement_upload.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/prop-firm-rules/import": () => ({ type: "prop_firm_rules.import.accepted", status: "use_post_handler" })
  ,"/api/market-intelligence/prop-firm-rules/sync": () => ({ type: "prop_firm_rules.sync.accepted", status: "use_post_handler" })
  ,"/api/market-intelligence/data-quality-gate/run": async () => ({ type: "data_quality_gate.live_run.completed", ...getDataQualityGateDashboard(await getLiveSourceSnapshots()) })
  ,"/api/market-intelligence/data-quality-gate/refresh": async () => ({ type: "data_quality_gate.sources.live_probe.completed", ...await getLiveMarketIntelligenceDashboard({ log: true }) })
  ,"/api/market-intelligence/data-quality-gate/recalculate": async () => ({ type: "data_quality_gate.score.live_recalculated", ...evaluateDataQualityGate(await getLiveSourceSnapshots()) })
};

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") return json(response, 204, {});
  const url = new URL(request.url, `http://${request.headers.host}`);
  const route = routes[`${request.method} ${url.pathname}`];
  if (route) {
    try {
      return json(response, 200, await route(url));
    } catch (error) {
      console.error(`[api] ${request.method} ${url.pathname}:`, error.message);
      return json(response, 503, { error: "service_unavailable", message: error.message });
    }
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/market-intelligence/data-sources/")) {
    const source = (await getLiveSourceSnapshots()).find(({ id }) => id === url.pathname.split("/").at(-1));
    return source ? json(response, 200, source) : json(response, 404, { error: "source_not_found" });
  }
  if (url.pathname.startsWith("/api/market-intelligence/social-sentiment/") && ["PATCH", "DELETE"].includes(request.method)) {
    const id = url.pathname.split("/").at(-1);
    if (request.method === "PATCH") return json(response, 200, { accepted: true, id, updated: await readBody(request), dashboard: await getSocialSentimentDashboard() });
    return json(response, 200, { accepted: true, id, deleted: true });
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/market-intelligence/historical-data/")) {
    const id = url.pathname.split("/").at(-1);
    return json(response, 404, { error: "historical_record_not_found", detail: "No live historical archive adapter is configured", id });
  }
  if (request.method === "DELETE" && url.pathname.startsWith("/api/market-intelligence/broker-data/sources/")) {
    const id = url.pathname.split("/").at(-1);
    return json(response, 200, { type: "broker_data.source.disconnect.accepted", status: "DISCONNECTING", source_id: id });
  }
  if (url.pathname.startsWith("/api/source-configuration/provider")) {
    const providerId = url.pathname.split("/").at(-1);
    const liveSnapshots = await getLiveSourceSnapshots();
    const probeContext = { liveSnapshots, probeFn: probeConfiguredUrl };
    try {
      if (request.method === "POST" && url.pathname === "/api/source-configuration/provider") {
        const body = await readBody(request);
        return json(response, 201, { accepted: true, provider: createSourceProvider(body) });
      }
      if (request.method === "PUT" && providerId && providerId !== "provider") {
        const body = await readBody(request);
        return json(response, 200, { accepted: true, provider: updateSourceProvider(providerId, body) });
      }
      if (request.method === "DELETE" && providerId && providerId !== "provider") {
        return json(response, 200, { accepted: true, ...deleteSourceProvider(providerId) });
      }
    } catch (reason) {
      return json(response, reason.message === "provider_not_found" ? 404 : 400, { error: reason.message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/source-configuration/test") {
    const body = await readBody(request);
    const liveSnapshots = await getLiveSourceSnapshots();
    try {
      return json(response, 200, { accepted: true, result: await testSourceProvider(body.providerId, { liveSnapshots, probeFn: probeConfiguredUrl }) });
    } catch (reason) {
      return json(response, reason.message === "provider_not_found" ? 404 : 400, { error: reason.message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/source-configuration/test-all") {
    return json(response, 200, { accepted: true, ...(await testAllSourceProviders({ liveSnapshots: await getLiveSourceSnapshots(), probeFn: probeConfiguredUrl })) });
  }
  if (request.method === "POST" && url.pathname === "/api/source-configuration/sync") {
    const body = await readBody(request);
    try {
      return json(response, 200, { accepted: true, sync: await syncSourceProvider(body.providerId, { liveSnapshots: await getLiveSourceSnapshots() }) });
    } catch (reason) {
      return json(response, reason.message === "provider_not_found" ? 404 : 400, { error: reason.message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/source-configuration/sync-all") {
    return json(response, 200, { accepted: true, ...(await syncAllSourceProviders({ liveSnapshots: await getLiveSourceSnapshots() })) });
  }
  if (request.method === "POST" && url.pathname === "/api/news/provider/connect") {
    try {
      const provider = connectNewsProvider(await readBody(request));
      return json(response, 201, { accepted: true, provider });
    } catch (reason) {
      return json(response, 400, { error: reason.message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/news/provider/test") {
    try {
      const body = await readBody(request);
      return json(response, 200, { accepted: true, result: await testNewsProvider(body.sourceId) });
    } catch (reason) {
      return json(response, reason.message === "news_provider_not_found" ? 404 : 400, { error: reason.message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/economic-calendar/alerts") {
    try {
      return json(response, 201, { accepted:true, alert:createEconomicAlert(await readBody(request)) });
    } catch (reason) {
      return json(response, reason.message === "economic_event_not_found" ? 404 : 400, { error:reason.message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/economic-calendar/releases") {
    try {
      return json(response,200,{accepted:true,event:ingestEconomicActualRelease(await readBody(request))});
    } catch(reason) {
      return json(response,reason.message==="economic_event_not_found"?404:400,{error:reason.message});
    }
  }
  if (request.method === "POST" && url.pathname === "/api/economic-calendar/sources") {
    try {
      return json(response,201,{accepted:true,source:connectEconomicSource(await readBody(request))});
    } catch(reason) {
      return json(response,400,{error:reason.message});
    }
  }
  if (request.method === "POST" && url.pathname === "/api/economic-calendar/sources/test") {
    try {
      const body=await readBody(request);
      return json(response,200,{accepted:true,result:await testEconomicSource(body.sourceId)});
    } catch(reason) {
      return json(response,reason.message==="economic_source_not_found"?404:400,{error:reason.message});
    }
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/economic-calendar/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[2];
    if (id && !["upcoming","today","high-impact","history","sources","alerts","logs"].includes(id)) {
      const event = getEconomicEvent(id);
      if (!event) return json(response,404,{error:"economic_event_not_found"});
      if (parts[3] === "history") return json(response,200,getEconomicEventHistory(id));
      if (parts[3] === "correlation") return json(response,200,getEconomicEventCorrelation(id));
      return json(response,200,{event,sourceMode:"LIVE_PROVIDERS_ONLY"});
    }
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/mt5/brokers/") && url.pathname.endsWith("/servers")) {
    const brokerName = decodeURIComponent(url.pathname.split("/")[4] || "");
    try {
      return json(response, 200, await listBrokerServers(brokerName));
    } catch (reason) {
      return json(response, 400, { error: reason instanceof Error ? reason.message : String(reason) });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/mt5/brokers/detect-servers") {
    const body = await readBody(request);
    try {
      return json(response, 200, await detectBrokerServers(body));
    } catch (reason) {
      return json(response, 400, { error: reason instanceof Error ? reason.message : String(reason) });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/mt5/brokers/custom-server") {
    const body = await readBody(request);
    try {
      return json(response, 200, await saveCustomBrokerServer(body));
    } catch (reason) {
      return json(response, 400, { error: reason instanceof Error ? reason.message : String(reason) });
    }
  }
  if (request.method === "GET" && url.pathname === "/api/mt5/terminals") {
    return json(response, 200, { terminals: await listMt5Terminals() });
  }
  if (request.method === "GET" && url.pathname === "/api/mt5/machines") {
    return json(response, 200, { machines: await listMt5Machines() });
  }
  if (request.method === "GET" && url.pathname === "/api/mt5/heartbeats") {
    return json(response, 200, { heartbeats: await listMt5Heartbeats() });
  }
  if (request.method === "GET" && url.pathname === "/api/mt5/terminal-health") {
    return json(response, 200, { health: await getMt5TerminalHealthDashboard() });
  }
  if (request.method === "GET" && url.pathname === "/api/mt5/ea-deployments") {
    return json(response, 200, await getEaDeploymentDashboard());
  }
  if (request.method === "GET" && url.pathname === "/api/mt5/ea/deployments") {
    return json(response, 200, { deployments: await listEaDeployments() });
  }
  if (request.method === "GET" && url.pathname === "/api/mt5/ea/logs") {
    const deploymentId = url.searchParams.get("deploymentId");
    return json(response, 200, { logs: await listEaDeploymentLogs(deploymentId) });
  }
  if (request.method === "POST" && url.pathname === "/api/mt5/ea/deploy") {
    const body = await readBody(request);
    try {
      return json(response, 200, { accepted: true, ...(await deployEa(body)) });
    } catch (reason) {
      return mt5EaError(response, reason);
    }
  }
  if (request.method === "POST" && url.pathname === "/api/mt5/ea/update") {
    const body = await readBody(request);
    try {
      return json(response, 200, { accepted: true, ...(await updateEa(body)) });
    } catch (reason) {
      return mt5EaError(response, reason);
    }
  }
  if (request.method === "POST" && url.pathname === "/api/mt5/ea/verify") {
    const body = await readBody(request);
    try {
      return json(response, 200, { accepted: true, ...(await verifyEa(body)) });
    } catch (reason) {
      return mt5EaError(response, reason);
    }
  }
  if (request.method === "POST" && url.pathname === "/api/mt5/ea/rollback") {
    const body = await readBody(request);
    try {
      return json(response, 200, { accepted: true, ...(await rollbackEa(body)) });
    } catch (reason) {
      return mt5EaError(response, reason);
    }
  }
  if (request.method === "POST" && url.pathname === "/api/mt5/ea/discover") {
    const body = await readBody(request);
    try {
      await ensureEaVersionCatalog();
      return json(response, 200, { accepted: true, ...(await syncDiscoveredTerminalPaths(body)) });
    } catch (reason) {
      return mt5EaError(response, reason);
    }
  }
  if (request.method === "GET" && url.pathname === "/api/mt5/connection-monitor") {
    return json(response, 200, { connections: await listConnectionMonitor() });
  }
  if (request.method === "POST" && url.pathname === "/api/mt5/terminals/register") {
    const body = await readBody(request);
    try {
      const terminal = await registerTerminalForProvider(body.providerId, body);
      return json(response, 201, { accepted: true, terminal });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (message === "database_not_configured") return json(response, 503, { error: message });
      if (message === "provider_not_found") return json(response, 404, { error: message });
      if (message === "duplicate_mt5_terminal_provider") {
        return json(response, 409, {
          error: message,
          existingProvider: reason?.details?.existingName || null,
          hint: reason?.details?.existingName
            ? `Terminal already covered by ${reason.details.existingName}. Use that provider instead.`
            : "An MT5 provider already exists for this broker, server, and environment."
        });
      }
      if (message === "terminal_already_registered") return json(response, 409, { error: message, hint: "This provider already has a registered terminal." });
      return json(response, 400, { error: message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/mt5/terminals/generate-token") {
    const body = await readBody(request);
    try {
      const token = await generateRegistrationToken(body.providerId, body.terminalId);
      return json(response, 201, { accepted: true, token });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (message === "database_not_configured") return json(response, 503, { error: message });
      return json(response, 400, { error: message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/mt5/terminals/heartbeat") {
    const body = await readBody(request);
    try {
      return json(response, 200, { accepted: true, ...(await recordHeartbeat(body)) });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (message === "database_not_configured") return json(response, 503, { error: message });
      if (message === "invalid_or_expired_token" || message === "terminal_not_found") return json(response, 404, { error: message });
      return json(response, 400, { error: message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/mt5/terminals/trigger-heartbeat") {
    const body = await readBody(request);
    try {
      return json(response, 200, { accepted: true, ...(await triggerTerminalHeartbeat(body.terminalId)) });
    } catch (reason) {
      return mt5EaError(response, reason);
    }
  }
  if (request.method === "POST" && url.pathname === "/api/mt5/terminals/import-market-watch") {
    const body = await readBody(request);
    try {
      const result = await importMarketWatch(body.terminalId, { symbols: body.symbols });
      return json(response, 200, { accepted: true, ...result, dashboard: await getMarketDataOperationsDashboard({ liveProbe: await getMarketDataLiveProbe(), sync: true }) });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (message === "database_not_configured") return json(response, 503, { error: message });
      if (message === "terminal_not_found") return json(response, 404, { error: message });
      return json(response, 400, { error: message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/market-data/providers/test") {
    const body = await readBody(request);
    const probeContext = { liveProbe: await getMarketDataLiveProbe(), probeFn: probeConfiguredUrl };
    try {
      if (body.providerId) {
        return json(response, 200, { accepted: true, result: await testMarketDataProvider(body.providerId, probeContext) });
      }
      return json(response, 200, await testProviderConfiguration(body, probeContext));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (message === "provider_not_found") return json(response, 404, { error: message });
      if (message === "database_not_configured") return json(response, 503, { error: message });
      return json(response, 400, { error: message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/market-data/providers/validate") {
    const body = await readBody(request);
    try {
      return json(response, 200, await validateProviderConfiguration(body));
    } catch (reason) {
      return json(response, 400, { error: reason instanceof Error ? reason.message : String(reason) });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/market-data/providers/preview-coverage") {
    const body = await readBody(request);
    try {
      return json(response, 200, await previewProviderCoverage(body));
    } catch (reason) {
      return json(response, 400, { error: reason instanceof Error ? reason.message : String(reason) });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/market-data/providers/market-watch") {
    const body = await readBody(request);
    try {
      return json(response, 200, await loadMarketWatch(body));
    } catch (reason) {
      return json(response, 400, { error: reason instanceof Error ? reason.message : String(reason) });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/market-data/providers/detect-symbols") {
    const body = await readBody(request);
    try {
      return json(response, 200, await detectSymbols(body));
    } catch (reason) {
      return json(response, 400, { error: reason instanceof Error ? reason.message : String(reason) });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/market-data/providers/sync") {
    return json(response, 200, { accepted: true, sync: await syncMarketDataSymbols({ liveProbe: await getMarketDataLiveProbe(), probeFn: probeConfiguredUrl }) });
  }
  if (request.method === "POST" && url.pathname === "/api/market-data/providers") {
    try {
      const body = await readBody(request);
      const payload = await createMarketDataProvider(body, {
        liveProbe: await getMarketDataLiveProbe(),
        probeFn: probeConfiguredUrl,
        createdBy: body.createdBy || "system.admin",
        draft: Boolean(body.draft),
        testOnSave: body.testOnSave !== false
      });
      return json(response, body.draft ? 200 : 201, { accepted: true, ...payload });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      const details = reason?.details;
      if (message === "database_not_configured") {
        return json(response, 503, {
          error: message,
          hint: details?.message || "Copy .env.example to .env, run npm run db:setup, then restart npm run dev."
        });
      }
      if (message === "database_connection_failed") {
        return json(response, 503, {
          error: message,
          hint: details?.hint || details?.message || "PostgreSQL connection failed."
        });
      }
      if (message === "duplicate_provider_name") return json(response, 409, { error: message });
      if (message === "duplicate_provider_url") return json(response, 409, { error: message });
      if (message === "duplicate_mt5_terminal_provider") {
        return json(response, 409, {
          error: message,
          existingProvider: reason?.details?.existingName || null,
          existingCode: reason?.details?.existingCode || null,
          hint: reason?.details?.existingName
            ? `An MT5 provider already exists for this broker, server, and environment (${reason.details.existingName}). Use the existing provider instead of creating a duplicate.`
            : "An MT5 provider already exists for this broker, server, and environment."
        });
      }
      return json(response, 400, { error: message });
    }
  }
  if (url.pathname.startsWith("/api/market-data/providers/")) {
    const segments = url.pathname.split("/");
    const providerId = segments[4];
    const action = segments[5];
    const reserved = new Set(["health", "latency", "symbols", "logs", "confidence", "coverage", "events", "quality", "export", "test", "test-all", "sync", "sync-all-symbols", "validate", "preview-coverage", "catalog", "detect-mt5-terminals", "market-watch", "detect-symbols"]);
    if (reserved.has(providerId)) {
      // fall through to 404 below unless handled earlier via routes map
    } else {
      const liveProbe = await getMarketDataLiveProbe();
      const probeContext = { liveProbe, probeFn: probeConfiguredUrl };
      try {
        if (request.method === "GET" && providerId && !action) {
          return json(response, 200, await getMarketDataProviderById(providerId));
        }
        if (request.method === "PUT" && providerId && !action) {
          const body = await readBody(request);
          return json(response, 200, { accepted: true, provider: await updateMarketDataProvider(providerId, body) });
        }
        if (request.method === "DELETE" && providerId && !action) {
          return json(response, 200, { accepted: true, ...(await deleteMarketDataProvider(providerId)) });
        }
        if (request.method === "POST" && providerId && action === "test") {
          return json(response, 200, { accepted: true, result: await testMarketDataProvider(providerId, probeContext) });
        }
        if (request.method === "POST" && providerId && action === "sync-symbols") {
          return json(response, 200, { accepted: true, sync: await syncMarketDataProviderSymbols(providerId, probeContext) });
        }
        if (request.method === "POST" && providerId && action === "enable") {
          return json(response, 200, { accepted: true, provider: await enableMarketDataProvider(providerId) });
        }
        if (request.method === "POST" && providerId && action === "disable") {
          return json(response, 200, { accepted: true, provider: await disableMarketDataProvider(providerId) });
        }
        if (request.method === "GET" && providerId && action === "mt5-details") {
          return json(response, 200, await getProviderMt5Details(providerId));
        }
        if (request.method === "GET" && providerId && action === "registration-token") {
          const terminalId = url.searchParams.get("terminalId");
          if (!terminalId) return json(response, 400, { error: "terminal_id_required" });
          const token = await getLatestRegistrationToken(providerId, terminalId);
          return json(response, 200, { token, available: Boolean(token) });
        }
        if (request.method === "POST" && providerId && action === "generate-token") {
          const body = await readBody(request);
          if (!body.terminalId) return json(response, 400, { error: "terminal_id_required" });
          const result = body.forceNew
            ? { token: await generateRegistrationToken(providerId, body.terminalId), created: true }
            : await getOrCreateRegistrationToken(providerId, body.terminalId);
          return json(response, result.created ? 201 : 200, { accepted: true, ...result });
        }
        if (request.method === "POST" && providerId && action === "import-market-watch") {
          const body = await readBody(request);
          const result = await importMarketWatch(body.terminalId, { symbols: body.symbols });
          return json(response, 200, { accepted: true, ...result, dashboard: await getMarketDataOperationsDashboard({ liveProbe, sync: true }) });
        }
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        if (message === "database_not_configured") return json(response, 503, { error: message });
        if (message === "provider_not_found") return json(response, 404, { error: message });
        return json(response, 400, { error: message });
      }
    }
  }
  if (request.method === "POST" && url.pathname === "/api/market-data/providers/test-all") {
    return json(response, 200, { accepted: true, ...(await testAllMarketDataProviders({ liveProbe: await getMarketDataLiveProbe(), probeFn: probeConfiguredUrl })) });
  }
  if (request.method === "POST" && url.pathname === "/api/market-data/providers/sync-all-symbols") {
    return json(response, 200, { accepted: true, ...(await syncAllMarketDataProviderSymbols({ liveProbe: await getMarketDataLiveProbe(), probeFn: probeConfiguredUrl })) });
  }
  if (request.method === "POST" && url.pathname === "/api/workflow/cards/1/test-live") {
    return json(response, 200, { accepted: true, event: await actions[url.pathname]() });
  }
  if (request.method === "POST" && url.pathname.startsWith("/api/market-intelligence/source-health-review/")) {
    const action = url.pathname.split("/").pop();
    const body = await readBody(request).catch(() => ({}));
    try {
      const context = action === "run-check"
        ? { providers: getSourceProviders().providers, liveSnapshots: await getLiveSourceSnapshots() }
        : {};
      return json(response, 200, { accepted: true, event: await runSourceHealthReviewAction(action, body, auditFromRequest(request).userLabel, context) });
    } catch (reason) {
      return json(response, reason?.status || 400, {
        error: reason instanceof Error ? reason.message : String(reason),
        missingTables: reason?.missingTables || undefined
      });
    }
  }
  if (request.method === "POST" && url.pathname.startsWith("/api/market-intelligence/dependency-matrix/")) {
    const action = url.pathname.split("/").pop();
    const body = await readBody(request).catch(() => ({}));
    try {
      return json(response, 200, { accepted: true, event: await runDependencyMatrixAction(action, body, auditFromRequest(request).userLabel) });
    } catch (reason) {
      return json(response, reason?.status || 400, {
        error: reason instanceof Error ? reason.message : String(reason),
        missingTables: reason?.missingTables || undefined
      });
    }
  }
  if (request.method === "POST" && url.pathname.startsWith("/api/market-intelligence/market-environment/")) {
    const action = url.pathname.split("/").pop();
    const body = await readBody(request).catch(() => ({}));
    try {
      const context = action === "recalculate" || action === "regenerate-summary"
        ? { liveSnapshots: await getLiveSourceSnapshots(), ticks: await getLatestTicks(40) }
        : {};
      return json(response, 200, { accepted: true, event: await runMarketEnvironmentAction(action, body, auditFromRequest(request).userLabel, context) });
    } catch (reason) {
      return json(response, reason?.status || 400, {
        error: reason instanceof Error ? reason.message : String(reason),
        missingTables: reason?.missingTables || undefined
      });
    }
  }
  if (request.method === "POST" && url.pathname.startsWith("/api/market-intelligence/card-2/")) {
    const action = url.pathname.split("/").pop();
    try {
      return json(response, 200, { accepted: true, event: await runCardTwoAction(action) });
    } catch (reason) {
      return json(response, reason?.status || 400, {
        error: reason instanceof Error ? reason.message : String(reason),
        missingTables: reason?.missingTables || undefined
      });
    }
  }

  // Portfolio Intelligence Center Endpoints
  if (request.method === "GET" && url.pathname === "/api/portfolio/dashboard") {
    const sync = url.searchParams.get("sync") === "1" || url.searchParams.get("sync") === "true";
    return json(response, 200, await getAccountPortfolioDashboard({ sync }));
  }
  if (request.method === "GET" && url.pathname === "/api/portfolio/accounts") {
    return json(response, 200, await getPortfolioAccounts());
  }
  if (request.method === "GET" && url.pathname === "/api/portfolio/positions") {
    return json(response, 200, await getPortfolioPositions());
  }
  if (request.method === "GET" && url.pathname === "/api/portfolio/trades") {
    return json(response, 200, await getPortfolioTrades());
  }
  if (request.method === "GET" && url.pathname === "/api/portfolio/risk") {
    return json(response, 200, await getPortfolioRisk());
  }
  if (request.method === "GET" && url.pathname === "/api/portfolio/drawdowns") {
    return json(response, 200, await getPortfolioDrawdowns());
  }
  if (request.method === "GET" && url.pathname === "/api/portfolio/correlations") {
    return json(response, 200, await getPortfolioCorrelations());
  }
  if (request.method === "GET" && url.pathname === "/api/portfolio/strategies") {
    return json(response, 200, await getPortfolioStrategies());
  }
  if (request.method === "GET" && url.pathname === "/api/portfolio/insights") {
    return json(response, 200, await getAiPortfolioInsights());
  }
  if (request.method === "GET" && url.pathname === "/api/portfolio/equity") {
    return json(response, 200, await getPortfolioEquity());
  }
  if (request.method === "GET" && url.pathname === "/api/portfolio/alerts") {
    return json(response, 200, await getPortfolioAlerts());
  }
  if (request.method === "POST" && url.pathname === "/api/portfolio/import") {
    const body = await readBody(request);
    return json(response, 200, await importPortfolioStatement(body));
  }
  if (request.method === "POST" && url.pathname === "/api/portfolio/sync") {
    try {
      const result = await syncPortfolioAccounts();
      const status = result.status === "SCHEMA_SETUP_FAILED" || result.status === "FAILED" ? 503 : 200;
      return json(response, status, result);
    } catch (reason) {
      return json(response, 503, {
        status: "FAILED",
        error: reason instanceof Error ? reason.message : String(reason),
        hint: "Run npm run db:bootstrap:portfolio then retry Sync Accounts."
      });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/portfolio/report") {
    const body = await readBody(request);
    return json(response, 200, await generatePortfolioReport(body.type, body.format));
  }
  if (url.pathname.startsWith("/api/market-intelligence/prop-firm-rules")) {
    const audit = auditFromRequest(request);
    const segments = url.pathname.split("/").filter(Boolean);
    const tail = segments[4];
    const sub = segments[5];
    try {
      if (request.method === "GET" && url.pathname === "/api/market-intelligence/prop-firm-rules") {
        return json(response, 200, await getPropFirmRulesDashboard());
      }
      if (request.method === "GET" && url.pathname === "/api/market-intelligence/prop-firm-rules/summary") {
        return json(response, 200, await getPropFirmRulesSummary());
      }
      if (request.method === "GET" && url.pathname === "/api/market-intelligence/prop-firm-rules/comparison") {
        const d = await getPropFirmRulesDashboard();
        return json(response, 200, { comparison: d.comparison });
      }
      if (request.method === "GET" && url.pathname === "/api/market-intelligence/prop-firm-rules/compliance") {
        return json(response, 200, await getPropFirmCompliance());
      }
      if (request.method === "GET" && (url.pathname === "/api/market-intelligence/prop-firm-rules/breach-alerts" || url.pathname === "/api/market-intelligence/prop-firm-rules/breach-risk")) {
        return json(response, 200, await getPropFirmBreachAlerts());
      }
      if (request.method === "GET" && url.pathname === "/api/market-intelligence/prop-firm-rules/sources") {
        return json(response, 200, await listPropFirmSources());
      }
      if (request.method === "GET" && url.pathname === "/api/market-intelligence/prop-firm-rules/audit-logs") {
        return json(response, 200, await getPropFirmAuditLogs());
      }
      if (request.method === "GET" && url.pathname === "/api/market-intelligence/prop-firm-rules/export") {
        const d = await getPropFirmRulesDashboard();
        return json(response, 200, { status: d.rules.length ? "ready" : "empty", format: "csv", rules: d.rules.length });
      }
      if (request.method === "POST" && url.pathname === "/api/market-intelligence/prop-firm-rules") {
        const body = await readBody(request);
        const created = await createPropFirmRule(body, audit);
        return json(response, 201, { accepted: true, type: "prop_firm_rules.created", ...created });
      }
      if (request.method === "POST" && url.pathname === "/api/market-intelligence/prop-firm-rules/validate") {
        const body = await readBody(request);
        return json(response, 200, validatePropFirmInput(body));
      }
      if (request.method === "POST" && url.pathname === "/api/market-intelligence/prop-firm-rules/import") {
        const body = await readBody(request);
        return json(response, 202, { accepted: true, type: "prop_firm_rules.import.accepted", ...(await importPropFirmRules(body, audit)) });
      }
      if (request.method === "POST" && url.pathname === "/api/market-intelligence/prop-firm-rules/sync") {
        return json(response, 200, { accepted: true, type: "prop_firm_rules.sync.completed", ...(await syncPropFirmSources(audit)) });
      }
      if (request.method === "POST" && url.pathname === "/api/market-intelligence/prop-firm-rules/sources") {
        const body = await readBody(request);
        return json(response, 201, { accepted: true, type: "prop_firm_rules.source.created", ...(await createPropFirmSource(body, audit)) });
      }
      if (request.method === "POST" && tail === "imports" && sub && url.pathname.endsWith("/approve")) {
        const importId = segments[5];
        const approved = await approvePropFirmImport(importId, audit);
        return json(response, 200, { accepted: true, type: "prop_firm_rules.import.approved", ...approved });
      }
      if (request.method === "GET" && tail && !sub && tail !== "summary" && tail !== "comparison" && tail !== "compliance" && tail !== "breach-alerts" && tail !== "breach-risk" && tail !== "sources" && tail !== "audit-logs" && tail !== "export" && tail !== "validate" && tail !== "import" && tail !== "sync") {
        return json(response, 200, await getPropFirmRuleById(tail));
      }
      if (request.method === "PATCH" && tail && !sub) {
        const body = await readBody(request);
        const updated = await updatePropFirmRule(tail, body, audit);
        return json(response, 200, { accepted: true, type: "prop_firm_rules.updated", ...updated });
      }
      if (request.method === "DELETE" && tail && !sub) {
        return json(response, 200, { accepted: true, type: "prop_firm_rules.deleted", ...(await deletePropFirmRule(tail, audit)) });
      }
    } catch (reason) {
      return propFirmError(response, reason);
    }
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/portfolio/")) {
    const segments = url.pathname.split("/");
    const accountId = segments[3];
    const action = segments[4];
    if (accountId && !action) {
      const accounts = await getPortfolioAccounts();
      const account = accounts.accounts.find(a => a.id === accountId);
      return account ? json(response, 200, account) : json(response, 404, { error: "account_not_found" });
    }
    if (accountId && action === "compliance") {
      return json(response, 200, await getPropCompliance(accountId));
    }
  }

  if (request.method === "POST" && actions[url.pathname]) return json(response, 200, { accepted: true, event: await actions[url.pathname](), workflow });
  return json(response, 404, { error: "not_found" });
});

server.on("upgrade", (request, socket) => {
  if (request.url !== "/ws/workflow" || !request.headers["sec-websocket-key"]) return socket.destroy();
  const accept = createHash("sha1")
    .update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`, "\r\n"
  ].join("\r\n"));
  const payload = JSON.stringify({ type: "workflow.connected", workflow });
  const length = Buffer.byteLength(payload);
  const header = length < 126
    ? Buffer.from([0x81, length])
    : Buffer.from([0x81, 126, length >> 8, length & 255]);
  socket.write(Buffer.concat([header, Buffer.from(payload)]));
});

process.on("unhandledRejection", (reason) => {
  console.error("[api] unhandled rejection:", reason instanceof Error ? reason.message : reason);
});

server.listen(port, async () => {
  console.log(`CACSMS API listening on http://localhost:${port}`);
  const database = await testDatabaseConnection();
  if (database.connected) {
    console.log(`[database] connected as ${database.user}@${database.database}`);
  } else if (database.configured) {
    console.warn(`[database] ${database.message}${database.hint ? ` — ${database.hint}` : ""}`);
  } else {
    console.warn("[database] DATABASE_URL not set — provider registration and persistence are disabled.");
  }
  startMarketDataRuntimeSyncLoop({
    onSync: async () => {
      const sources = await getLiveSourceSnapshots({ skipRuntimeSync: true });
      recordSourceProbe(sources, new Date().toISOString());
    }
  });
  console.log(`[runtime-sync] automatic MT5 sync every ${Number(process.env.CACSMS_AUTO_SYNC_MS || 30000)}ms`);
  startNewsIntelligenceSyncLoop();
  console.log(`[news-intelligence] automatic provider sync every ${Number(process.env.NEWS_INTELLIGENCE_SYNC_MS || 60000)}ms`);
  startEconomicCalendarSyncLoop();
  console.log(`[economic-calendar] automatic provider sync every ${Number(process.env.ECONOMIC_CALENDAR_SYNC_MS || 60000)}ms`);
});
