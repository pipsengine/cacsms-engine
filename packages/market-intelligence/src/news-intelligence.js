import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDatabaseConfigured, query } from "./db.js";

const STORE_PATH = fileURLToPath(new URL("../../../apps/web/public/data/news-intelligence.json", import.meta.url));
const DEFAULT_SYNC_MS = 60000;
const MAX_ARTICLES = Number(process.env.NEWS_INTELLIGENCE_MAX_ARTICLES || 10000);

const DEFAULT_SOURCES = Object.freeze([
  {
    id: "federal-reserve-press",
    name: "Federal Reserve Press Releases",
    type: "RSS",
    tier: "Tier 3 Economic",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    enabled: true,
    scheduleMs: 60000,
    reputation: 100
  },
  {
    id: "bls-latest-releases",
    name: "U.S. Bureau of Labor Statistics",
    type: "RSS",
    tier: "Tier 3 Economic",
    url: "https://www.bls.gov/feed/bls_latest.rss",
    enabled: true,
    scheduleMs: 60000,
    reputation: 100
  },
  {
    id: "sec-press-releases",
    name: "U.S. SEC Press Releases",
    type: "RSS",
    tier: "Tier 3 Economic",
    url: "https://www.sec.gov/news/pressreleases.rss",
    enabled: true,
    scheduleMs: 300000,
    reputation: 100
  }
]);

const CATEGORY_RULES = [
  ["Central Banks", /\b(federal reserve|fed|ecb|boe|boj|central bank|monetary policy|rate decision)\b/i],
  ["Inflation", /\b(inflation|cpi|consumer price|ppi|prices)\b/i],
  ["Employment", /\b(employment|jobs|payroll|unemployment|labor market|jobless)\b/i],
  ["GDP", /\b(gdp|gross domestic product|economic growth)\b/i],
  ["Commodities", /\b(gold|oil|crude|commodity|natural gas|copper)\b/i],
  ["Corporate Earnings", /\b(earnings|revenue|profit|guidance|quarterly results)\b/i],
  ["Geopolitics", /\b(war|conflict|sanction|geopolit|election|tariff|trade war)\b/i],
  ["Banking", /\b(bank|banking|credit|financial stability|liquidity)\b/i],
  ["Economic Data", /\b(economy|economic|manufacturing|consumer|housing|retail sales)\b/i]
];

const ASSET_RULES = [
  ["USD", /\b(usd|dollar|u\.s\.|united states|federal reserve|fed|bls|sec)\b/i],
  ["EURUSD", /\b(euro|ecb|eurozone|usd|dollar)\b/i],
  ["GBPUSD", /\b(pound|sterling|boe|uk|britain|usd|dollar)\b/i],
  ["USDJPY", /\b(yen|boj|japan|usd|dollar)\b/i],
  ["XAUUSD", /\b(gold|inflation|rates?|yield|dollar|geopolit)\b/i],
  ["USOIL", /\b(oil|crude|opec|energy)\b/i],
  ["NAS100", /\b(technology|nasdaq|stocks?|equities|fed|rates?|sec)\b/i],
  ["US30", /\b(dow|stocks?|equities|fed|rates?|sec)\b/i]
];

const POSITIVE = /\b(rise|rises|rising|gain|gains|growth|strong|stronger|improve|improves|beat|beats|surge|surges|expand|expands|optimism|easing)\b/gi;
const NEGATIVE = /\b(fall|falls|falling|decline|declines|weak|weaker|miss|misses|drop|drops|recession|risk|risks|crisis|war|conflict|sanction|tightening)\b/gi;
const HIGH_IMPACT = /\b(federal reserve|fed|rate decision|interest rate|cpi|inflation|payroll|unemployment|gdp|emergency|war|conflict|sanction)\b/i;
const EXTREME_IMPACT = /\b(emergency|unexpected|surprise|crisis|war|attack|default|collapse)\b/i;

let syncInFlight = null;
let syncLoopStarted = false;

function emptyStore() {
  return {
    version: 1,
    updatedAt: null,
    sources: DEFAULT_SOURCES.map((source) => ({
      ...source,
      status: "PENDING",
      lastSyncAt: null,
      lastSuccessAt: null,
      latencyMs: null,
      imported: 0,
      error: null,
      etag: null,
      lastModified: null
    })),
    articles: [],
    alerts: [],
    syncLogs: []
  };
}

function readStore() {
  if (!existsSync(STORE_PATH)) return emptyStore();
  try {
    const store = JSON.parse(readFileSync(STORE_PATH, "utf8").replace(/^\uFEFF/, ""));
    return { ...emptyStore(), ...store };
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  store.updatedAt = new Date().toISOString();
  writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  return store;
}

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return decodeXml(match[1]);
  }
  return "";
}

function linkFromBlock(block) {
  const text = tag(block, ["link", "guid", "id"]);
  if (/^https?:\/\//i.test(text)) return text;
  const href = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
  return href || text;
}

function parseFeed(xml) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) || [];
  return blocks.map((block) => ({
    title: tag(block, ["title"]),
    summary: tag(block, ["description", "summary", "content", "content:encoded"]),
    url: linkFromBlock(block),
    publishedAt: tag(block, ["pubDate", "published", "updated", "dc:date"])
  })).filter((item) => item.title && item.url);
}

function stableHash(...values) {
  return createHash("sha256").update(values.join("|")).digest("hex");
}

function scoreSentiment(text) {
  const positive = (text.match(POSITIVE) || []).length;
  const negative = (text.match(NEGATIVE) || []).length;
  const score = Math.max(-100, Math.min(100, (positive - negative) * 20));
  const direction = score >= 50 ? "Strong Bullish" : score > 0 ? "Bullish" : score <= -50 ? "Strong Bearish" : score < 0 ? "Bearish" : "Neutral";
  return { score, direction, confidence: Math.min(95, 55 + (positive + negative) * 5) };
}

function enrichArticle(item, source) {
  const text = `${item.title} ${item.summary}`;
  const sentiment = scoreSentiment(text);
  const category = CATEGORY_RULES.find(([, pattern]) => pattern.test(text))?.[0] || "General Market News";
  const affectedAssets = ASSET_RULES.filter(([, pattern]) => pattern.test(text)).map(([asset]) => asset);
  const impact = EXTREME_IMPACT.test(text) ? "EXTREME" : HIGH_IMPACT.test(text) ? "HIGH" : affectedAssets.length ? "MEDIUM" : "LOW";
  const impactScore = impact === "EXTREME" ? 95 : impact === "HIGH" ? 80 : impact === "MEDIUM" ? 55 : 25;
  const publishedAt = Number.isNaN(Date.parse(item.publishedAt)) ? new Date().toISOString() : new Date(item.publishedAt).toISOString();
  const hash = stableHash(source.id, item.url, item.title);
  return {
    id: hash.slice(0, 24),
    hash,
    sourceId: source.id,
    source: source.name,
    sourceTier: source.tier,
    headline: item.title,
    summary: item.summary,
    url: item.url,
    publishedAt,
    discoveredAt: new Date().toISOString(),
    category,
    sentimentScore: sentiment.score,
    sentiment: sentiment.direction,
    confidence: sentiment.confidence,
    impact,
    impactScore: Math.round((impactScore + source.reputation) / 2),
    affectedAssets,
    action: impact === "EXTREME" || impact === "HIGH" ? "Review Risk" : "Monitor"
  };
}

async function persistArticleToDatabase(article, source) {
  if (!isDatabaseConfigured()) return;
  try {
    const sourceResult = await query(
      `INSERT INTO market.news_sources(source_key,name,source_type,status,config)
       VALUES($1,$2,$3,'ONLINE',$4::jsonb)
       ON CONFLICT(source_key) DO UPDATE SET name=EXCLUDED.name,status='ONLINE',config=EXCLUDED.config
       RETURNING id`,
      [source.id, source.name, source.type, JSON.stringify({ url: source.url, tier: source.tier })]
    );
    await query(
      `INSERT INTO market.news_headlines(source_id,headline,category,sentiment,impact,published_at,metadata)
       SELECT $1,$2,$3,$4,$5,$6,$7::jsonb
       WHERE NOT EXISTS (SELECT 1 FROM market.news_headlines WHERE metadata->>'hash'=$8)`,
      [sourceResult.rows[0].id, article.headline, article.category, article.sentiment, article.impact, article.publishedAt, JSON.stringify(article), article.hash]
    );
  } catch (error) {
    console.warn("[news-intelligence] database persistence failed:", error.message);
  }
}

async function syncSource(source, store) {
  const started = performance.now();
  const headers = { "User-Agent": "CACSMS-News-Intelligence/1.0 (+http://localhost)" };
  if (source.etag) headers["If-None-Match"] = source.etag;
  if (source.lastModified) headers["If-Modified-Since"] = source.lastModified;
  try {
    const response = await fetch(source.url, { headers, signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (response.status === 304) {
      return { ...source, status: "ONLINE", lastSyncAt: new Date().toISOString(), latencyMs: Math.round(performance.now() - started), error: null, imported: 0 };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = parseFeed(await response.text());
    const known = new Set(store.articles.map((article) => article.hash));
    const imported = [];
    for (const item of items) {
      const article = enrichArticle(item, source);
      if (known.has(article.hash)) continue;
      known.add(article.hash);
      imported.push(article);
      await persistArticleToDatabase(article, source);
    }
    store.articles.unshift(...imported);
    for (const article of imported.filter((item) => ["HIGH", "EXTREME"].includes(item.impact))) {
      store.alerts.unshift({
        id: randomUUID(),
        articleId: article.id,
        createdAt: new Date().toISOString(),
        level: article.impact,
        headline: article.headline,
        affectedAssets: article.affectedAssets,
        acknowledged: false
      });
    }
    return {
      ...source,
      status: "ONLINE",
      lastSyncAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - started),
      error: null,
      imported: imported.length,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified")
    };
  } catch (error) {
    return {
      ...source,
      status: "FAILED",
      lastSyncAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - started),
      error: error.message,
      imported: 0
    };
  }
}

export async function syncNewsIntelligence({ force = false, sourceId = null } = {}) {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    const store = readStore();
    const now = Date.now();
    const selected = store.sources.filter((source) => source.enabled && (!sourceId || source.id === sourceId) && (
      force || !source.lastSyncAt || now - new Date(source.lastSyncAt).getTime() >= Number(source.scheduleMs || DEFAULT_SYNC_MS)
    ));
    const updates = await Promise.all(selected.map((source) => syncSource(source, store)));
    const byId = new Map(updates.map((source) => [source.id, source]));
    store.sources = store.sources.map((source) => byId.get(source.id) || source);
    store.articles = store.articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, MAX_ARTICLES);
    store.alerts = store.alerts.slice(0, 1000);
    store.syncLogs.unshift({
      id: randomUUID(),
      syncedAt: new Date().toISOString(),
      sourcesChecked: selected.length,
      articlesImported: updates.reduce((sum, source) => sum + Number(source.imported || 0), 0),
      failures: updates.filter((source) => source.status === "FAILED").length
    });
    store.syncLogs = store.syncLogs.slice(0, 500);
    writeStore(store);
    return getNewsDashboard();
  })().finally(() => { syncInFlight = null; });
  return syncInFlight;
}

export function getNewsDashboard() {
  const store = readStore();
  const articles = store.articles;
  const sourcesOnline = store.sources.filter((source) => source.status === "ONLINE").length;
  const score = articles.length ? Math.round(articles.slice(0, 100).reduce((sum, article) => sum + article.sentimentScore, 0) / Math.min(articles.length, 100)) : 0;
  const highImpact = articles.filter((article) => ["HIGH", "EXTREME"].includes(article.impact)).length;
  return {
    sourceMode: "LIVE_PROVIDERS_ONLY",
    updatedAt: store.updatedAt,
    status: sourcesOnline ? "LIVE" : "FAILED",
    sourcesOnline,
    sourcesTotal: store.sources.length,
    articleCount: articles.length,
    highImpact,
    sentimentScore: score,
    sentimentDirection: score > 10 ? "Bullish" : score < -10 ? "Bearish" : "Neutral",
    unacknowledgedAlerts: store.alerts.filter((alert) => !alert.acknowledged).length
  };
}

export function listNewsArticles(filters = {}) {
  const store = readStore();
  let articles = store.articles;
  if (filters.breaking) articles = articles.filter((article) => ["HIGH", "EXTREME"].includes(article.impact));
  if (filters.category) articles = articles.filter((article) => article.category.toLowerCase() === String(filters.category).toLowerCase());
  if (filters.source) articles = articles.filter((article) => article.sourceId === filters.source);
  if (filters.impact) articles = articles.filter((article) => article.impact === String(filters.impact).toUpperCase());
  if (filters.asset) articles = articles.filter((article) => article.affectedAssets.includes(String(filters.asset).toUpperCase()));
  if (filters.q) {
    const queryText = String(filters.q).toLowerCase();
    articles = articles.filter((article) => `${article.headline} ${article.summary}`.toLowerCase().includes(queryText));
  }
  const limit = Math.min(Math.max(Number(filters.limit || 100), 1), 500);
  return { articles: articles.slice(0, limit), total: articles.length, sourceMode: "LIVE_PROVIDERS_ONLY" };
}

export function listNewsSources() {
  const store = readStore();
  return { sources: store.sources, sourceMode: "LIVE_PROVIDERS_ONLY" };
}

export function listNewsAlerts() {
  const store = readStore();
  return { alerts: store.alerts, sourceMode: "LIVE_PROVIDERS_ONLY" };
}

export function listNewsSyncLogs() {
  return { logs: readStore().syncLogs, sourceMode: "LIVE_PROVIDERS_ONLY" };
}

export async function testNewsProvider(sourceId) {
  const store = readStore();
  const source = store.sources.find((item) => item.id === sourceId);
  if (!source) throw new Error("news_provider_not_found");
  const probeStore = { ...store, articles: [...store.articles], alerts: [...store.alerts] };
  const result = await syncSource(source, probeStore);
  return {
    sourceId,
    status: result.status,
    latencyMs: result.latencyMs,
    error: result.error,
    reachable: result.status === "ONLINE"
  };
}

export function connectNewsProvider(input = {}) {
  const url = String(input.url || "").trim();
  const name = String(input.name || "").trim();
  if (!url || !name) throw new Error("news_provider_name_and_url_required");
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("news_provider_url_invalid");
  const store = readStore();
  const id = String(input.id || stableHash(name, url).slice(0, 20));
  const existing = store.sources.find((source) => source.id === id || source.url === url);
  const source = {
    ...(existing || {}),
    id,
    name,
    type: String(input.type || "RSS"),
    tier: String(input.tier || "Configured Provider"),
    url,
    enabled: input.enabled !== false,
    scheduleMs: Math.max(60000, Number(input.scheduleMs || DEFAULT_SYNC_MS)),
    reputation: Math.max(0, Math.min(100, Number(input.reputation || 80))),
    status: existing?.status || "PENDING",
    lastSyncAt: existing?.lastSyncAt || null,
    lastSuccessAt: existing?.lastSuccessAt || null,
    latencyMs: existing?.latencyMs || null,
    imported: 0,
    error: null,
    etag: existing?.etag || null,
    lastModified: existing?.lastModified || null
  };
  store.sources = existing
    ? store.sources.map((item) => item.id === existing.id ? source : item)
    : [...store.sources, source];
  writeStore(store);
  return source;
}

export function getNewsAssetImpact() {
  const store = readStore();
  const assets = {};
  for (const article of store.articles.slice(0, 500)) {
    for (const symbol of article.affectedAssets) {
      const row = assets[symbol] || { symbol, articles: 0, highImpact: 0, sentimentTotal: 0 };
      row.articles += 1;
      row.highImpact += ["HIGH", "EXTREME"].includes(article.impact) ? 1 : 0;
      row.sentimentTotal += article.sentimentScore;
      assets[symbol] = row;
    }
  }
  return {
    assets: Object.values(assets).map((row) => ({
      symbol: row.symbol,
      articles: row.articles,
      highImpact: row.highImpact,
      sentimentScore: Math.round(row.sentimentTotal / row.articles),
      sentiment: row.sentimentTotal > 10 ? "Bullish" : row.sentimentTotal < -10 ? "Bearish" : "Neutral"
    })),
    sourceMode: "LIVE_PROVIDERS_ONLY"
  };
}

export function getNewsLiveSourceSnapshot() {
  const dashboard = getNewsDashboard();
  const store = readStore();
  const latest = store.articles[0]?.publishedAt || store.updatedAt;
  const freshnessSeconds = latest ? Math.max(0, Math.round((Date.now() - new Date(latest).getTime()) / 1000)) : 0;
  const healthy = dashboard.sourcesOnline > 0;
  return {
    id: "news-sentiment",
    routeSlug: "news-sentiment",
    name: "News & Sentiment Sources",
    category: "news-sentiment",
    subtitle: "Automated official-feed news intelligence synchronization.",
    provider: healthy ? `${dashboard.sourcesOnline} live news provider${dashboard.sourcesOnline === 1 ? "" : "s"}` : "No reachable news provider",
    status: healthy ? "LIVE" : "FAILED",
    required: true,
    lastSyncAt: store.updatedAt,
    freshnessSeconds,
    freshness: latest ? `${freshnessSeconds}s since latest article` : "UNAVAILABLE",
    healthScore: store.sources.length ? Math.round((dashboard.sourcesOnline / store.sources.length) * 100) : 0,
    latencyMs: Math.round(store.sources.filter((source) => source.latencyMs != null).reduce((sum, source) => sum + source.latencyMs, 0) / Math.max(1, store.sources.filter((source) => source.latencyMs != null).length)),
    errorCount: store.sources.filter((source) => source.status === "FAILED").length,
    feedsStage: "Card 1",
    failureAction: "block_card_1",
    records: dashboard.articleCount,
    adapter: "news_intelligence_engine",
    configuration: "Official RSS feeds and configured licensed-provider adapters.",
    connectionLabel: "News Intelligence Engine",
    envKey: null,
    httpStatus: null,
    probeError: healthy ? null : "No news providers are currently reachable.",
    checks: {
      configured: store.sources.some((source) => source.enabled),
      availability: healthy,
      apiValidation: healthy,
      latency: healthy ? "LIVE SYNC" : "UNAVAILABLE",
      freshness: latest ? `${freshnessSeconds}s since latest article` : "UNAVAILABLE",
      quality: healthy ? "PASSED" : "FAILED"
    }
  };
}

export function startNewsIntelligenceSyncLoop({ intervalMs = Number(process.env.NEWS_INTELLIGENCE_SYNC_MS || DEFAULT_SYNC_MS) } = {}) {
  if (syncLoopStarted || intervalMs <= 0) return;
  syncLoopStarted = true;
  setTimeout(() => syncNewsIntelligence({ force: true }).catch((error) => console.error("[news-intelligence]", error.message)), 1000);
  setInterval(() => syncNewsIntelligence().catch((error) => console.error("[news-intelligence]", error.message)), intervalMs);
}
