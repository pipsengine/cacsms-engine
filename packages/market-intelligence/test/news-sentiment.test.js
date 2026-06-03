import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  NEWS_ASSET_IMPACT,
  NEWS_HEADLINES,
  NEWS_SOURCES,
  evaluateNewsSentiment
} from "../src/news-sentiment.js";

test("news sentiment defaults to an honest live-adapter empty state", () => {
  const output = evaluateNewsSentiment();
  assert.equal(output.status, "NOT_CONFIGURED");
  assert.equal(output.sentiment_score, null);
  assert.equal(output.sentiment_mode, "UNAVAILABLE");
  assert.equal(output.news_risk_mode, "UNAVAILABLE");
  assert.equal(output.high_impact_headlines, 0);
  assert.equal(output.workflow_permission, "RESTRICTED");
  assert.equal(NEWS_SOURCES.length, 0);
  assert.equal(NEWS_HEADLINES.length, 0);
  assert.equal(NEWS_ASSET_IMPACT.length, 0);
});

test("news sentiment blocks workflow for explicitly supplied critical live headlines", () => {
  const output = evaluateNewsSentiment({
    sources: [{ status: "LIVE" }],
    headlines: [{ impact: "CRITICAL", affectedAssets: ["XAUUSD"] }]
  });
  assert.equal(output.workflow_permission, "BLOCKED");
  assert.equal(output.blocks.length, 1);
});

test("API exposes news sentiment contract", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of [
    "/api/market-intelligence/news-sentiment/dashboard",
    "/api/market-intelligence/news-sentiment/headlines",
    "/api/market-intelligence/news-sentiment/sources",
    "/api/market-intelligence/news-sentiment/asset-impact",
    "/api/market-intelligence/news-sentiment/risk-panel",
    "/api/market-intelligence/news-sentiment/refresh",
    "/api/market-intelligence/news-sentiment/classify",
    "/api/market-intelligence/news-sentiment/create-alert"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
});

test("news migration defines all persistence tables", () => {
  const sql = readFileSync("database/migrations/006_news_sentiment_sources.sql", "utf8");
  for (const table of [
    "news_sources",
    "news_headlines",
    "news_sentiment_scores",
    "news_asset_impact",
    "news_risk_events",
    "news_classification_logs",
    "sentiment_snapshots",
    "sentiment_source_health"
  ]) assert.match(sql, new RegExp(`market\\.${table}`));
});
