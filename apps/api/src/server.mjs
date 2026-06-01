import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { ASSET_SCORES, ASSET_UNIVERSE, MOCK_WORKFLOW, WORKFLOW_EVENTS } from "../../../packages/workflow/src/mock-data.js";
import { CARD_ONE_SCENARIOS, createCardOneTestReport } from "../../../packages/workflow/src/card-one.js";
import { DATA_SOURCES, evaluateDataQualityGate } from "../../../packages/market-intelligence/src/data-sources.js";
import { DATA_QUALITY_GATE_EVENTS, DATA_QUALITY_GATE_RULES, getDataQualityGateDashboard } from "../../../packages/market-intelligence/src/data-quality-gate.js";
import { BROKER_FEEDS, ECONOMIC_EVENTS, NEWS_SENTIMENT, TIMELINE_EVENTS, getMarketIntelligenceDashboard } from "../../../packages/market-intelligence/src/dashboard-mock.js";
import { MARKET_DATA_COVERAGE, MARKET_DATA_EVENTS, MARKET_DATA_PROVIDERS, evaluateMarketDataQuality, getMarketDataProvidersDashboard } from "../../../packages/market-intelligence/src/market-data-providers.js";
import { AI_HEADLINE_CLASSIFICATION, NEWS_ASSET_IMPACT, NEWS_HEADLINES, NEWS_RISK_EVENTS, NEWS_SOURCES, evaluateNewsSentiment, getNewsSentimentDashboard } from "../../../packages/market-intelligence/src/news-sentiment.js";
import { CENTRAL_BANK_WATCH, CURRENCY_ASSET_IMPACT, ECONOMIC_CALENDAR_EVENTS, ECONOMIC_RESTRICTION_WINDOWS, evaluateEconomicCalendar, getEconomicCalendarDashboard } from "../../../packages/market-intelligence/src/economic-calendar.js";
import { ASSET_CROWD_SENTIMENT, CONTRARIAN_SIGNALS, RETAIL_POSITIONING, SENTIMENT_SPIKES, SOCIAL_SENTIMENT_ITEMS, SOCIAL_SOURCE_HEALTH, evaluateSocialSentiment, getSocialSentimentDashboard } from "../../../packages/market-intelligence/src/social-sentiment.js";
import { createCotSyncStatus, evaluateInstitutionalCot, getCotComparison, getInstitutionalCotDashboard } from "../../../packages/market-intelligence/src/institutional-cot.js";
import { HISTORICAL_DATA, HISTORICAL_SOURCES, getHistoricalComparison, getHistoricalDashboard, getHistoricalSummary } from "../../../packages/market-intelligence/src/historical-data.js";
import { BROKER_COMPARISON, BROKER_DATA_SOURCES, BROKER_MARKET_DATA, BROKER_VALIDATION_ISSUES, getBrokerDataDashboard } from "../../../packages/market-intelligence/src/broker-data.js";
import { PORTFOLIO_CLOSED_TRADES, PORTFOLIO_EQUITY_CURVE, PORTFOLIO_POSITIONS, PORTFOLIO_RISK_METRICS, TRADING_ACCOUNTS, getAccountPortfolioDashboard } from "../../../packages/market-intelligence/src/account-portfolio.js";
import { PROP_FIRM_BREACH_ALERTS, PROP_FIRM_COMPARISON, PROP_FIRM_COMPLIANCE_ACCOUNTS, PROP_FIRM_RULES, getPropFirmRulesDashboard } from "../../../packages/market-intelligence/src/prop-firm-rules.js";

const port = Number(process.env.API_PORT || 8080);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const cotCachePath = fileURLToPath(new URL("../../web/public/data/institutional-cot.json", import.meta.url));
const cotSyncScriptPath = fileURLToPath(new URL("../../../scripts/sync-cftc-cot.ps1", import.meta.url));
let workflow = { ...MOCK_WORKFLOW };
let cardOneReport = createCardOneTestReport("pass");
const eventLog = WORKFLOW_EVENTS.slice(0, 9).map((type, index) => ({
  id: index + 1, type, workflowId: workflow.workflowId, timestamp: new Date(Date.now() - (9 - index) * 60000).toISOString()
}));

function json(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(body));
}

function record(type, payload = {}) {
  const event = { id: eventLog.length + 1, type, workflowId: workflow.workflowId, payload, timestamp: new Date().toISOString() };
  eventLog.push(event);
  return event;
}

function readCotCache() {
  return JSON.parse(readFileSync(cotCachePath, "utf8").replace(/^\uFEFF/, ""));
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
  "GET /api/workflow/cards/1": () => cardOneReport,
  "GET /api/workflow/cards/1/scenarios": () => ({ scenarios: CARD_ONE_SCENARIOS }),
  "GET /api/assets/universe": () => ({ count: ASSET_UNIVERSE.length, assets: ASSET_UNIVERSE }),
  "GET /api/assets/scores": () => ({ workflowId: workflow.workflowId, scores: ASSET_SCORES }),
  "GET /api/infrastructure/status": () => ({
    status: "healthy", machines: 1248, mt5Terminals: 5672, accounts: 18420, averageLatencyMs: 42
  }),
  "GET /api/market-intelligence/data-sources": () => ({ sources: DATA_SOURCES }),
  "GET /api/market-intelligence/dashboard": () => getMarketIntelligenceDashboard(),
  "GET /api/market-intelligence/data-sources/health": () => ({ sources: DATA_SOURCES.map(({ id, name, status, freshnessSeconds, healthScore, latencyMs, errorCount }) => ({ id, name, status, freshnessSeconds, healthScore, latencyMs, errorCount })) }),
  "GET /api/market-intelligence/economic-events": () => ({ events: ECONOMIC_EVENTS }),
  "GET /api/market-intelligence/news-sentiment": () => ({ sentimentScore: 62, mode: "Risk-On", items: NEWS_SENTIMENT }),
  "GET /api/market-intelligence/broker-feeds": () => ({ brokerHealth: 97, portfolioSync: "Live", feeds: BROKER_FEEDS }),
  "GET /api/market-intelligence/data-quality-gate": () => getDataQualityGateDashboard(),
  "GET /api/market-intelligence/data-quality-gate/sources": () => ({ sources: getDataQualityGateDashboard().sources }),
  "GET /api/market-intelligence/data-quality-gate/validations": () => ({ rules: getDataQualityGateDashboard().rules }),
  "GET /api/market-intelligence/data-quality-gate/events": () => ({ events: DATA_QUALITY_GATE_EVENTS }),
  "GET /api/market-intelligence/data-quality-gate/export": () => ({ status: "ready", format: "csv", rules: DATA_QUALITY_GATE_RULES.length }),
  "GET /api/market-intelligence/feed-events": () => ({ events: TIMELINE_EVENTS })
  ,"GET /api/market-data/providers": () => getMarketDataProvidersDashboard()
  ,"GET /api/market-data/providers/health": () => ({ providers: MARKET_DATA_PROVIDERS })
  ,"GET /api/market-data/providers/latency": () => ({ averageLatencyMs: evaluateMarketDataQuality().latency_ms, providers: MARKET_DATA_PROVIDERS.map(({ id, name, latencyMs }) => ({ id, name, latencyMs })) })
  ,"GET /api/market-data/providers/coverage": () => ({ symbolsOnline: MARKET_DATA_COVERAGE.length, assets: MARKET_DATA_COVERAGE })
  ,"GET /api/market-data/providers/events": () => ({ events: MARKET_DATA_EVENTS })
  ,"GET /api/market-data/providers/quality": () => evaluateMarketDataQuality()
  ,"GET /api/market-intelligence/news-sentiment/dashboard": () => getNewsSentimentDashboard()
  ,"GET /api/market-intelligence/news-sentiment/headlines": () => ({ headlines: NEWS_HEADLINES })
  ,"GET /api/market-intelligence/news-sentiment/sources": () => ({ sources: NEWS_SOURCES })
  ,"GET /api/market-intelligence/news-sentiment/asset-impact": () => ({ assets: NEWS_ASSET_IMPACT })
  ,"GET /api/market-intelligence/news-sentiment/risk-panel": () => ({ ...evaluateNewsSentiment(), events: NEWS_RISK_EVENTS })
  ,"GET /api/market-intelligence/economic-calendar/dashboard": () => getEconomicCalendarDashboard()
  ,"GET /api/market-intelligence/economic-calendar/events": () => ({ events: ECONOMIC_CALENDAR_EVENTS })
  ,"GET /api/market-intelligence/economic-calendar/high-impact": () => ({ event: ECONOMIC_CALENDAR_EVENTS[0], ...evaluateEconomicCalendar() })
  ,"GET /api/market-intelligence/economic-calendar/restrictions": () => ({ restrictions: ECONOMIC_RESTRICTION_WINDOWS })
  ,"GET /api/market-intelligence/economic-calendar/asset-impact": () => ({ assets: CURRENCY_ASSET_IMPACT })
  ,"GET /api/market-intelligence/economic-calendar/central-banks": () => ({ centralBanks: CENTRAL_BANK_WATCH })
  ,"GET /api/market-intelligence/social-sentiment/dashboard": () => getSocialSentimentDashboard()
  ,"GET /api/market-intelligence/social-sentiment/feed": () => ({ items: SOCIAL_SENTIMENT_ITEMS })
  ,"GET /api/market-intelligence/social-sentiment/asset-matrix": () => ({ assets: ASSET_CROWD_SENTIMENT })
  ,"GET /api/market-intelligence/social-sentiment/retail-positioning": () => ({ positioning: RETAIL_POSITIONING })
  ,"GET /api/market-intelligence/social-sentiment/spikes": () => ({ spikes: SENTIMENT_SPIKES })
  ,"GET /api/market-intelligence/social-sentiment/contrarian": () => ({ signals: CONTRARIAN_SIGNALS })
  ,"GET /api/market-intelligence/social-sentiment/source-health": () => ({ sources: SOCIAL_SOURCE_HEALTH })
  ,"GET /api/market-intelligence/institutional-cot/dashboard": url => getInstitutionalCotDashboard(readCotCache(), url.searchParams.get("currency") || "EUR")
  ,"GET /api/market-intelligence/institutional-cot/currencies": () => ({ currencies: getCotComparison(readCotCache()) })
  ,"GET /api/market-intelligence/institutional-cot/history": url => ({ currency: url.searchParams.get("currency") || "EUR", range: url.searchParams.get("range") || "1Y", history: readCotCache().history[url.searchParams.get("currency") || "EUR"] || [] })
  ,"GET /api/market-intelligence/institutional-cot/latest": url => evaluateInstitutionalCot(readCotCache(), { currency: url.searchParams.get("currency") || "EUR" })
  ,"GET /api/market-intelligence/institutional-cot/comparison": () => ({ comparison: getCotComparison(readCotCache()) })
  ,"GET /api/market-intelligence/institutional-cot/sync/status": () => createCotSyncStatus(readCotCache())
  ,"GET /api/market-intelligence/institutional-cot/sync/logs": () => ({ logs: getInstitutionalCotDashboard(readCotCache()).syncLogs })
  ,"GET /api/market-intelligence/historical-data": url => getHistoricalDashboard({ instrument: url.searchParams.get("instrument") || "EURUSD" })
  ,"GET /api/market-intelligence/historical-data/export": url => ({ status: "ready", format: url.searchParams.get("format") || "csv", instrument: url.searchParams.get("instrument") || "EURUSD" })
  ,"GET /api/market-intelligence/historical-data/summary": url => getHistoricalSummary(url.searchParams.get("instrument") || "EURUSD")
  ,"GET /api/market-intelligence/historical-data/comparison": url => ({ comparison: getHistoricalComparison((url.searchParams.get("instruments") || "EURUSD,GBPUSD,XAUUSD").split(",")) })
  ,"GET /api/market-intelligence/broker-data": () => getBrokerDataDashboard()
  ,"GET /api/market-intelligence/broker-data/sources": () => ({ sources: BROKER_DATA_SOURCES })
  ,"GET /api/market-intelligence/broker-data/compare": () => ({ comparison: BROKER_COMPARISON })
  ,"GET /api/market-intelligence/broker-data/validation": () => ({ issues: BROKER_VALIDATION_ISSUES })
  ,"GET /api/market-intelligence/broker-data/export": () => ({ status: "ready", format: "csv", records: BROKER_MARKET_DATA.length })
  ,"GET /api/market-intelligence/account-portfolio": () => getAccountPortfolioDashboard()
  ,"GET /api/market-intelligence/account-portfolio/accounts": () => ({ accounts: TRADING_ACCOUNTS })
  ,"GET /api/market-intelligence/account-portfolio/positions/open": () => ({ positions: PORTFOLIO_POSITIONS })
  ,"GET /api/market-intelligence/account-portfolio/trades/closed": () => ({ trades: PORTFOLIO_CLOSED_TRADES })
  ,"GET /api/market-intelligence/account-portfolio/risk": () => ({ risk: PORTFOLIO_RISK_METRICS })
  ,"GET /api/market-intelligence/account-portfolio/equity-curve": () => ({ curve: PORTFOLIO_EQUITY_CURVE })
  ,"GET /api/market-intelligence/account-portfolio/export": () => ({ status: "ready", format: "csv", accounts: TRADING_ACCOUNTS.length })
  ,"GET /api/market-intelligence/prop-firm-rules": () => getPropFirmRulesDashboard()
  ,"GET /api/market-intelligence/prop-firm-rules/comparison": () => ({ comparison: PROP_FIRM_COMPARISON })
  ,"GET /api/market-intelligence/prop-firm-rules/compliance": () => ({ accounts: PROP_FIRM_COMPLIANCE_ACCOUNTS })
  ,"GET /api/market-intelligence/prop-firm-rules/breach-risk": () => ({ alerts: PROP_FIRM_BREACH_ALERTS })
  ,"GET /api/market-intelligence/prop-firm-rules/export": () => ({ status: "ready", format: "csv", rules: PROP_FIRM_RULES.length })
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
  "/api/workflow/cards/1/test-pass": () => ({ type: "workflow.card1.test.completed", report: cardOneReport = createCardOneTestReport("pass") }),
  "/api/workflow/cards/1/test-warning": () => ({ type: "workflow.card1.test.completed", report: cardOneReport = createCardOneTestReport("warning") }),
  "/api/workflow/cards/1/test-reject": () => ({ type: "workflow.card1.test.completed", report: cardOneReport = createCardOneTestReport("reject") }),
  "/api/workflow/cards/1/test-missing": () => ({ type: "workflow.card1.test.completed", report: cardOneReport = createCardOneTestReport("missing") }),
  "/api/market-intelligence/data-sources/test": () => ({ type: "market_intelligence.sources.tested", testedSources: DATA_SOURCES.length, status: "passed" }),
  "/api/market-intelligence/data-sources/sync": () => ({ type: "market_intelligence.sources.synced", syncedSources: DATA_SOURCES.length, status: "completed" }),
  "/api/market-intelligence/scan": () => ({ type: "market_intelligence.scan.completed", scannedSources: DATA_SOURCES.length, status: "completed" }),
  "/api/market-intelligence/refresh-feeds": () => ({ type: "market_intelligence.feeds.refreshed", refreshedSources: DATA_SOURCES.length, status: "completed" }),
  "/api/market-intelligence/test-sources": () => ({ type: "market_intelligence.sources.tested", testedSources: DATA_SOURCES.length, status: "passed" })
  ,"/api/market-data/providers/validate": () => ({ type: "market_data.providers.validated", status: "passed", providers: MARKET_DATA_PROVIDERS.length, ...evaluateMarketDataQuality() })
  ,"/api/market-data/providers/restart": () => ({ type: "market_data.provider.restarted", status: "completed" })
  ,"/api/market-intelligence/news-sentiment/refresh": () => ({ type: "news_sentiment.refreshed", status: "completed", headlines: 128 })
  ,"/api/market-intelligence/news-sentiment/classify": () => ({ type: "news_sentiment.headline.classified", status: "completed", classification: AI_HEADLINE_CLASSIFICATION })
  ,"/api/market-intelligence/news-sentiment/create-alert": () => ({ type: "news_sentiment.risk_alert.created", status: "completed", permission: evaluateNewsSentiment().workflow_permission })
  ,"/api/market-intelligence/economic-calendar/sync": () => ({ type: "economic_calendar.synced", status: "completed", events: 18 })
  ,"/api/market-intelligence/economic-calendar/risk-scan": () => ({ type: "economic_calendar.risk_scan.completed", ...evaluateEconomicCalendar(), action_status: "completed" })
  ,"/api/market-intelligence/economic-calendar/apply-restriction": () => ({ type: "economic_calendar.restriction.applied", status: "completed", permission: "RESTRICTED" })
  ,"/api/market-intelligence/economic-calendar/release-restriction": () => ({ type: "economic_calendar.restriction.released", status: "completed" })
  ,"/api/market-intelligence/social-sentiment/refresh": () => ({ type: "social_sentiment.refreshed", status: "completed", mentions: 12480 })
  ,"/api/market-intelligence/social-sentiment/run-scan": () => ({ type: "social_sentiment.scan.completed", ...evaluateSocialSentiment(), action_status: "completed" })
  ,"/api/market-intelligence/social-sentiment/generate-contrarian-signals": () => ({ type: "social_sentiment.contrarian.generated", status: "completed", signals: CONTRARIAN_SIGNALS })
  ,"/api/market-intelligence/institutional-cot/sync-now": () => startCotSync()
  ,"/api/market-intelligence/institutional-cot/sync-year": () => startCotSync()
  ,"/api/market-intelligence/institutional-cot/sync-all": () => startCotSync()
  ,"/api/market-intelligence/institutional-cot/recalculate-bias": () => ({ type: "institutional_cot.bias.recalculated", status: "completed", currencies: readCotCache().mappings.length })
  ,"/api/market-intelligence/institutional-cot/validate-latest": () => ({ type: "institutional_cot.latest.validated", status: "completed", latest_report_date: readCotCache().latestReportDate })
  ,"/api/market-intelligence/historical-data/sync": () => ({ type: "historical_data.sync.accepted", status: "SYNCING", sources: HISTORICAL_SOURCES.length })
  ,"/api/market-intelligence/historical-data/upload": () => ({ type: "historical_data.upload.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/broker-data/connect": () => ({ type: "broker_data.connect.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/broker-data/sync": () => ({ type: "broker_data.sync.accepted", status: "SYNCING", sources: BROKER_DATA_SOURCES.length })
  ,"/api/market-intelligence/broker-data/upload": () => ({ type: "broker_data.upload.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/account-portfolio/sync": () => ({ type: "account_portfolio.sync.accepted", status: "SYNCING", accounts: TRADING_ACCOUNTS.length })
  ,"/api/market-intelligence/account-portfolio/connect": () => ({ type: "account_portfolio.connect.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/account-portfolio/upload": () => ({ type: "account_portfolio.statement_upload.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/prop-firm-rules": () => ({ type: "prop_firm_rules.create.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/prop-firm-rules/import": () => ({ type: "prop_firm_rules.import.accepted", status: "PENDING_VALIDATION" })
  ,"/api/market-intelligence/prop-firm-rules/sync": () => ({ type: "prop_firm_rules.sync.accepted", status: "SYNCING", rules: PROP_FIRM_RULES.length })
  ,"/api/market-intelligence/data-quality-gate/run": () => ({ type: "data_quality_gate.run.completed", ...getDataQualityGateDashboard() })
  ,"/api/market-intelligence/data-quality-gate/refresh": () => ({ type: "data_quality_gate.sources.refreshed", status: "completed", sources: DATA_SOURCES.length })
  ,"/api/market-intelligence/data-quality-gate/recalculate": () => ({ type: "data_quality_gate.score.recalculated", ...evaluateDataQualityGate() })
};

const server = createServer((request, response) => {
  if (request.method === "OPTIONS") return json(response, 204, {});
  const url = new URL(request.url, `http://${request.headers.host}`);
  const route = routes[`${request.method} ${url.pathname}`];
  if (route) return json(response, 200, route(url));
  if (request.method === "GET" && url.pathname.startsWith("/api/market-intelligence/data-sources/")) {
    const source = DATA_SOURCES.find(({ id }) => id === url.pathname.split("/").at(-1));
    return source ? json(response, 200, source) : json(response, 404, { error: "source_not_found" });
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/market-intelligence/historical-data/")) {
    const id = url.pathname.split("/").at(-1);
    const record = Object.values(HISTORICAL_DATA).flat().find(item => item.id === id);
    return record ? json(response, 200, record) : json(response, 404, { error: "historical_record_not_found" });
  }
  if (request.method === "DELETE" && url.pathname.startsWith("/api/market-intelligence/broker-data/sources/")) {
    const id = url.pathname.split("/").at(-1);
    return json(response, 200, { type: "broker_data.source.disconnect.accepted", status: "DISCONNECTING", source_id: id });
  }
  if (request.method === "POST" && actions[url.pathname]) return json(response, 200, { accepted: true, event: actions[url.pathname](), workflow });
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
