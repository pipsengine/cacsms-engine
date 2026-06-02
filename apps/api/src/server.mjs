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
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();
import { ASSET_SCORES, ASSET_UNIVERSE, MOCK_WORKFLOW, WORKFLOW_EVENTS } from "../../../packages/workflow/src/mock-data.js";
import { createCardOneTestReport } from "../../../packages/workflow/src/card-one.js";
import { WORKFLOW_CARD_QUEUE } from "../../../packages/workflow/src/index.js";
import { evaluateDataQualityGate } from "../../../packages/market-intelligence/src/data-sources.js";
import { DATA_QUALITY_GATE_RULES, getDataQualityGateDashboard } from "../../../packages/market-intelligence/src/data-quality-gate.js";
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
  validateProviderConfiguration
} from "../../../packages/market-intelligence/src/market-data-providers.js";

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
  ["market-data", "market-data", "Market Data Providers", "MARKET_DATA_LIVE_URL", true, "Configure MARKET_DATA_LIVE_URL for the pricing gateway."],
  ["news-sentiment", "news-sentiment", "News & Sentiment Sources", "NEWS_SENTIMENT_LIVE_URL", true, "Configure NEWS_SENTIMENT_LIVE_URL for a licensed headline provider."],
  ["economic-calendar", "economic-calendar", "Economic Calendar", "ECONOMIC_CALENDAR_LIVE_URL", true, "Configure ECONOMIC_CALENDAR_LIVE_URL for live macro-event ingestion."],
  ["social-sentiment", "social-sentiment", "Social Media & Community", "SOCIAL_SENTIMENT_LIVE_URL", false, "Configure SOCIAL_SENTIMENT_LIVE_URL for optional community intelligence."],
  ["institutional-cot-data", "institutional-cot", "Institutional / COT Data", "COT_SOURCE_URL", false, "Official CFTC Futures Only archive synchronized by cot_weekly_sync_job."],
  ["historical-data", "historical-data", "Historical Data", "HISTORICAL_DATA_LIVE_URL", true, "Configure HISTORICAL_DATA_LIVE_URL or upload an OHLCV archive."],
  ["broker-data", "broker-data", "Broker Data", "BROKER_DATA_LIVE_URL", true, "Configure BROKER_DATA_LIVE_URL for an MT5, cTrader, FIX or broker API bridge."],
  ["account-portfolio-data", "account-portfolio", "Account & Portfolio Data", "ACCOUNT_PORTFOLIO_LIVE_URL", true, "Configure ACCOUNT_PORTFOLIO_LIVE_URL or connect a broker account."],
  ["prop-firm-rules", "prop-firm-rules", "Prop Firm Rules & Limits", "PROP_FIRM_RULES_LIVE_URL", true, "Configure PROP_FIRM_RULES_LIVE_URL or import a validated rule catalog."]
];

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
    return { ok: response.ok, httpStatus: response.status, latencyMs: Math.round(performance.now() - started), error: response.ok ? null : `HTTP ${response.status}` };
  } catch (reason) {
    return { ok: false, httpStatus: null, latencyMs: Math.round(performance.now() - started), error: reason.message };
  }
}

async function getMarketDataLiveProbe() {
  const url = process.env.MARKET_DATA_LIVE_URL;
  return url ? probeConfiguredUrl(url) : null;
}

async function getLiveSourceSnapshots() {
  let cot;
  try { cot = readCotCache(); } catch {}
  const snapshots = await Promise.all(liveSourceDefinitions.map(async ([id, routeSlug, name, envKey, required, configuration]) => {
    const isCot = id === "institutional-cot-data";
    const configuredUrl = process.env[envKey];
    const cotReady = isCot && cot?.latestReportDate && existsSync(cotCachePath);
    const configured = Boolean(configuredUrl || cotReady);
    const modified = cotReady ? statSync(cotCachePath).mtime.toISOString() : null;
    const probe = configuredUrl && !isCot ? await probeConfiguredUrl(configuredUrl) : null;
    const status = cotReady ? "SYNCED" : probe?.ok ? "ONLINE" : configured ? "FAILED" : "NOT_CONFIGURED";
    return {
      id, routeSlug, name, category: id, subtitle: configuration,
      provider: cotReady ? "CFTC Historical Compressed / Futures Only" : configuredUrl ? new URL(configuredUrl).host : "Not configured",
      status,
      required, lastSyncAt: modified || (probe?.ok ? new Date().toISOString() : null), freshnessSeconds: cotReady ? Math.max(0, Math.round((Date.now() - statSync(cotCachePath).mtimeMs) / 1000)) : 0,
      freshness: cotReady ? `Official report ${cot.latestReportDate}` : probe?.ok ? "LIVE PROBE" : "UNAVAILABLE",
      healthScore: cotReady || probe?.ok ? 100 : 0, latencyMs: probe?.latencyMs || 0, errorCount: cotReady || probe?.ok ? 0 : 1,
      feedsStage: "Card 1", failureAction: required ? "block_card_1" : "reduce_confidence",
      records: cotReady ? Object.values(cot.history || {}).reduce((sum, rows) => sum + rows.length, 0) : 0,
      adapter: cotReady ? "official_cftc_cache" : probe?.ok ? "live_http_probe" : configured ? "configured_url_failed_probe" : "none",
      configuration, envKey, httpStatus: probe?.httpStatus || null, probeError: probe?.error || null,
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
  return { sourceMode: "LIVE_ADAPTERS_ONLY", status: source?.status || "NOT_CONFIGURED", source, records: [], warnings: source?.status === "SYNCED" ? [] : [source?.configuration || "Live adapter is not configured"] };
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
  "GET /api/system/health": () => ({
    status: "healthy", environment: "foundation", services: {
      api: "online", database: "ready", websocket: "online", redis: "ready", rabbitmq: "ready"
    }
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
  "GET /api/market-intelligence/dashboard": () => getLiveMarketIntelligenceDashboard(),
  "GET /api/market-intelligence/data-sources/health": async () => ({ sourceMode: "LIVE_ADAPTERS_ONLY", sources: await getLiveSourceSnapshots() }),
  "GET /api/market-intelligence/economic-events": () => ({ events: [], status: "NOT_CONFIGURED" }),
  "GET /api/market-intelligence/news-sentiment": () => liveSourcePayload("news-sentiment"),
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
  ,"GET /api/market-data/providers/export": async () => {
    const payload = await exportMarketDataStatus({ liveProbe: await getMarketDataLiveProbe() });
    return { format: "csv", csv: exportMarketDataStatusCsv(payload), ...payload };
  }
  ,"GET /api/market-data/providers/catalog": () => getWizardCatalog()
  ,"GET /api/market-data/providers/detect-mt5-terminals": () => detectMt5Terminals()
  ,"GET /api/market-intelligence/news-sentiment/dashboard": () => liveSourcePayload("news-sentiment")
  ,"GET /api/market-intelligence/news-sentiment/headlines": () => ({ headlines: [] })
  ,"GET /api/market-intelligence/news-sentiment/sources": () => ({ sources: [] })
  ,"GET /api/market-intelligence/news-sentiment/asset-impact": () => ({ assets: [] })
  ,"GET /api/market-intelligence/news-sentiment/risk-panel": () => liveSourcePayload("news-sentiment")
  ,"GET /api/market-intelligence/economic-calendar/dashboard": () => liveSourcePayload("economic-calendar")
  ,"GET /api/market-intelligence/economic-calendar/events": () => ({ events: [] })
  ,"GET /api/market-intelligence/economic-calendar/high-impact": () => ({ event: null, status: "NOT_CONFIGURED" })
  ,"GET /api/market-intelligence/economic-calendar/restrictions": () => ({ restrictions: [] })
  ,"GET /api/market-intelligence/economic-calendar/asset-impact": () => ({ assets: [] })
  ,"GET /api/market-intelligence/economic-calendar/central-banks": () => ({ centralBanks: [] })
  ,"GET /api/market-intelligence/social-sentiment/dashboard": () => liveSourcePayload("social-sentiment")
  ,"GET /api/market-intelligence/social-sentiment/feed": () => ({ items: [] })
  ,"GET /api/market-intelligence/social-sentiment/asset-matrix": () => ({ assets: [] })
  ,"GET /api/market-intelligence/social-sentiment/retail-positioning": () => ({ positioning: [] })
  ,"GET /api/market-intelligence/social-sentiment/spikes": () => ({ spikes: [] })
  ,"GET /api/market-intelligence/social-sentiment/contrarian": () => ({ signals: [] })
  ,"GET /api/market-intelligence/social-sentiment/source-health": () => ({ sources: [] })
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
  ,"GET /api/market-intelligence/account-portfolio": () => liveSourcePayload("account-portfolio-data")
  ,"GET /api/market-intelligence/account-portfolio/accounts": () => ({ accounts: [] })
  ,"GET /api/market-intelligence/account-portfolio/positions/open": () => ({ positions: [] })
  ,"GET /api/market-intelligence/account-portfolio/trades/closed": () => ({ trades: [] })
  ,"GET /api/market-intelligence/account-portfolio/risk": () => ({ risk: [] })
  ,"GET /api/market-intelligence/account-portfolio/equity-curve": () => ({ curve: [] })
  ,"GET /api/market-intelligence/account-portfolio/export": () => ({ status: "unavailable", format: "csv", accounts: 0 })
  ,"GET /api/market-intelligence/prop-firm-rules": () => liveSourcePayload("prop-firm-rules")
  ,"GET /api/market-intelligence/prop-firm-rules/comparison": () => ({ comparison: [] })
  ,"GET /api/market-intelligence/prop-firm-rules/compliance": () => ({ accounts: [] })
  ,"GET /api/market-intelligence/prop-firm-rules/breach-risk": () => ({ alerts: [] })
  ,"GET /api/market-intelligence/prop-firm-rules/export": () => ({ status: "unavailable", format: "csv", rules: 0 })
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
  "/api/workflow/cards/1/test-live": async () => ({ type: "workflow.card1.live_test.completed", report: cardOneReport = createCardOneTestReport(await getLiveSourceSnapshots()) }),
  "/api/market-intelligence/data-sources/test": async () => ({ type: "market_intelligence.sources.live_probe.completed", ...await getLiveMarketIntelligenceDashboard({ log: true }) }),
  "/api/market-intelligence/data-sources/sync": async () => ({ type: "market_intelligence.sources.live_probe.completed", ...await getLiveMarketIntelligenceDashboard({ log: true }) }),
  "/api/market-intelligence/scan": async () => ({ type: "market_intelligence.scan.rejected", status: "NOT_READY", gate: getDataQualityGateDashboard(await getLiveSourceSnapshots()) }),
  "/api/market-intelligence/refresh-feeds": async () => ({ type: "market_intelligence.sources.live_probe.completed", ...await getLiveMarketIntelligenceDashboard({ log: true }) }),
  "/api/market-intelligence/test-sources": async () => ({ type: "market_intelligence.sources.live_probe.completed", ...await getLiveMarketIntelligenceDashboard({ log: true }) })
  ,"/api/market-data/providers/validate": () => liveAction("market_data.providers.live_probe.completed", "market-data")
  ,"/api/market-data/providers/restart": () => liveAction("restart", "market-data")
  ,"/api/market-intelligence/news-sentiment/refresh": () => liveAction("news_sentiment.live_probe.completed", "news-sentiment")
  ,"/api/market-intelligence/news-sentiment/classify": () => liveAction("news_sentiment.classification.unavailable", "news-sentiment")
  ,"/api/market-intelligence/news-sentiment/create-alert": () => liveAction("news_sentiment.risk_alert.unavailable", "news-sentiment")
  ,"/api/market-intelligence/economic-calendar/sync": () => liveAction("economic_calendar.live_probe.completed", "economic-calendar")
  ,"/api/market-intelligence/economic-calendar/risk-scan": () => liveAction("economic_calendar.risk_scan.unavailable", "economic-calendar")
  ,"/api/market-intelligence/economic-calendar/apply-restriction": () => liveAction("apply_restriction", "economic-calendar")
  ,"/api/market-intelligence/economic-calendar/release-restriction": () => liveAction("release_restriction", "economic-calendar")
  ,"/api/market-intelligence/social-sentiment/refresh": () => liveAction("social_sentiment.live_probe.completed", "social-sentiment")
  ,"/api/market-intelligence/social-sentiment/run-scan": () => liveAction("social_sentiment.scan.unavailable", "social-sentiment")
  ,"/api/market-intelligence/social-sentiment/generate-contrarian-signals": () => liveAction("social_sentiment.contrarian.unavailable", "social-sentiment")
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
  ,"/api/market-intelligence/account-portfolio/sync": () => liveAction("account_portfolio.live_probe.completed", "account-portfolio-data")
  ,"/api/market-intelligence/account-portfolio/connect": () => ({ type: "account_portfolio.connect.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/account-portfolio/upload": () => ({ type: "account_portfolio.statement_upload.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/prop-firm-rules": () => ({ type: "prop_firm_rules.create.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/prop-firm-rules/import": () => ({ type: "prop_firm_rules.import.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/prop-firm-rules/sync": () => liveAction("prop_firm_rules.live_probe.completed", "prop-firm-rules")
  ,"/api/market-intelligence/data-quality-gate/run": async () => ({ type: "data_quality_gate.live_run.completed", ...getDataQualityGateDashboard(await getLiveSourceSnapshots()) })
  ,"/api/market-intelligence/data-quality-gate/refresh": async () => ({ type: "data_quality_gate.sources.live_probe.completed", ...await getLiveMarketIntelligenceDashboard({ log: true }) })
  ,"/api/market-intelligence/data-quality-gate/recalculate": async () => ({ type: "data_quality_gate.score.live_recalculated", ...evaluateDataQualityGate(await getLiveSourceSnapshots()) })
};

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") return json(response, 204, {});
  const url = new URL(request.url, `http://${request.headers.host}`);
  const route = routes[`${request.method} ${url.pathname}`];
  if (route) return json(response, 200, await route(url));
  if (request.method === "GET" && url.pathname.startsWith("/api/market-intelligence/data-sources/")) {
    const source = (await getLiveSourceSnapshots()).find(({ id }) => id === url.pathname.split("/").at(-1));
    return source ? json(response, 200, source) : json(response, 404, { error: "source_not_found" });
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
      if (message === "database_not_configured") return json(response, 503, { error: message });
      if (message === "duplicate_provider_name") return json(response, 409, { error: message });
      if (message === "duplicate_provider_url") return json(response, 409, { error: message });
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

server.listen(port, () => console.log(`CACSMS API listening on http://localhost:${port}`));
