import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { ASSET_SCORES, ASSET_UNIVERSE, MOCK_WORKFLOW, WORKFLOW_EVENTS } from "../../../packages/workflow/src/mock-data.js";
import { DATA_SOURCES, evaluateDataQualityGate } from "../../../packages/market-intelligence/src/data-sources.js";
import { BROKER_FEEDS, ECONOMIC_EVENTS, NEWS_SENTIMENT, TIMELINE_EVENTS, getMarketIntelligenceDashboard } from "../../../packages/market-intelligence/src/dashboard-mock.js";

const port = Number(process.env.API_PORT || 8080);
let workflow = { ...MOCK_WORKFLOW };
const eventLog = WORKFLOW_EVENTS.slice(0, 9).map((type, index) => ({
  id: index + 1, type, workflowId: workflow.workflowId, timestamp: new Date(Date.now() - (9 - index) * 60000).toISOString()
}));

function json(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(body));
}

function record(type, payload = {}) {
  const event = { id: eventLog.length + 1, type, workflowId: workflow.workflowId, payload, timestamp: new Date().toISOString() };
  eventLog.push(event);
  return event;
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
  "GET /api/market-intelligence/data-quality-gate": () => evaluateDataQualityGate(),
  "GET /api/market-intelligence/feed-events": () => ({ events: TIMELINE_EVENTS })
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
  "/api/market-intelligence/data-sources/test": () => ({ type: "market_intelligence.sources.tested", testedSources: DATA_SOURCES.length, status: "passed" }),
  "/api/market-intelligence/data-sources/sync": () => ({ type: "market_intelligence.sources.synced", syncedSources: DATA_SOURCES.length, status: "completed" }),
  "/api/market-intelligence/scan": () => ({ type: "market_intelligence.scan.completed", scannedSources: DATA_SOURCES.length, status: "completed" }),
  "/api/market-intelligence/refresh-feeds": () => ({ type: "market_intelligence.feeds.refreshed", refreshedSources: DATA_SOURCES.length, status: "completed" }),
  "/api/market-intelligence/test-sources": () => ({ type: "market_intelligence.sources.tested", testedSources: DATA_SOURCES.length, status: "passed" })
};

const server = createServer((request, response) => {
  if (request.method === "OPTIONS") return json(response, 204, {});
  const url = new URL(request.url, `http://${request.headers.host}`);
  const route = routes[`${request.method} ${url.pathname}`];
  if (route) return json(response, 200, route());
  if (request.method === "GET" && url.pathname.startsWith("/api/market-intelligence/data-sources/")) {
    const source = DATA_SOURCES.find(({ id }) => id === url.pathname.split("/").at(-1));
    return source ? json(response, 200, source) : json(response, 404, { error: "source_not_found" });
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
