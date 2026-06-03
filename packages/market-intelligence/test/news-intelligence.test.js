import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getNewsAssetImpact,
  getNewsDashboard,
  getNewsLiveSourceSnapshot,
  listNewsArticles,
  listNewsSources
} from "../src/news-intelligence.js";

test("news intelligence exposes only persisted live-provider records", () => {
  const dashboard = getNewsDashboard();
  const articles = listNewsArticles({ limit: 5 });
  const sources = listNewsSources();
  assert.equal(dashboard.sourceMode, "LIVE_PROVIDERS_ONLY");
  assert.equal(articles.sourceMode, "LIVE_PROVIDERS_ONLY");
  assert.equal(sources.sourceMode, "LIVE_PROVIDERS_ONLY");
  assert.ok(Array.isArray(articles.articles));
  assert.ok(Array.isArray(sources.sources));
});

test("news intelligence source snapshot reflects provider health and stored records", () => {
  const dashboard = getNewsDashboard();
  const snapshot = getNewsLiveSourceSnapshot();
  assert.equal(snapshot.adapter, "news_intelligence_engine");
  assert.equal(snapshot.records, dashboard.articleCount);
  assert.equal(snapshot.checks.configured, true);
});

test("news intelligence asset impact is derived from stored articles", () => {
  const impact = getNewsAssetImpact();
  assert.equal(impact.sourceMode, "LIVE_PROVIDERS_ONLY");
  assert.ok(Array.isArray(impact.assets));
});

test("API exposes enterprise news intelligence endpoints", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of [
    "/api/news/live",
    "/api/news/latest",
    "/api/news/breaking",
    "/api/news/sentiment",
    "/api/news/impact",
    "/api/news/economic-calendar",
    "/api/news/alerts",
    "/api/news/sync",
    "/api/news/provider/test",
    "/api/news/provider/connect",
    "/api/news/provider/health",
    "/api/news/provider/logs"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
});
