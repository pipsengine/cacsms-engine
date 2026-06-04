import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASSET_CROWD_SENTIMENT,
  SOCIAL_SOURCE_CATALOG,
  SOCIAL_SENTIMENT_ITEMS,
  SOCIAL_SOURCE_HEALTH,
  evaluateSocialSentiment
} from "../src/social-sentiment.js";

test("social sentiment module does not ship mock production records", () => {
  const output = evaluateSocialSentiment();
  assert.equal(output.status, "PRODUCTION_DATA_REQUIRED");
  assert.equal(output.sentiment_score, 0);
  assert.equal(output.mention_volume, 0);
  assert.equal(output.workflow_permission, "PENDING_LIVE_DATA");
  assert.equal(SOCIAL_SENTIMENT_ITEMS.length, 0);
  assert.equal(ASSET_CROWD_SENTIMENT.length, 0);
  assert.equal(SOCIAL_SOURCE_HEALTH.length, 0);
});

test("social sentiment severe manipulation restricts but cannot block alone", () => {
  assert.equal(evaluateSocialSentiment({ severeManipulation: true }).workflow_permission, "RESTRICTED");
});

test("social sentiment source catalog defines six production connectors in detail", () => {
  assert.equal(SOCIAL_SOURCE_CATALOG.length, 6);
  assert.deepEqual(SOCIAL_SOURCE_CATALOG.map((source) => source.sourceKey), ["x-twitter", "youtube-comments", "reddit", "stocktwits", "telegram", "discord"]);
  for (const source of SOCIAL_SOURCE_CATALOG) {
    assert.ok(source.connectionType);
    assert.ok(source.accountType);
    assert.ok(source.rateLimitPolicy);
    assert.ok(source.nextAction);
    assert.ok(source.requiredPermissions.length);
    assert.ok(source.dataCaptured.length);
    assert.ok(source.healthChecks.length);
  }
});

test("social sentiment blocks only when manipulation is confirmed by risk", () => {
  assert.equal(evaluateSocialSentiment({ severeManipulation: true, confirmedByRisk: true }).workflow_permission, "BLOCKED");
});

test("social sentiment page exposes production empty state and core panels", () => {
  const page = readFileSync("apps/web/social-sentiment-page.js", "utf8");
  for (const section of [
    "Social Sentiment Intelligence Center",
    "No social sentiment source connected.",
    "Live Social Feed",
    "AI Crowd Interpretation",
    "Sentiment Heatmap",
    "Trending Topics Panel",
    "Fear & Greed / Crowd Risk",
    "Social Sentiment Sources",
    "Credential Requirements",
    "Required Permissions",
    "Rate Limit Policy",
    "Production Only",
    "No demo or mock social posts are displayed"
  ]) assert.match(page, new RegExp(section.replace(/[&/]/g, "\\$&")));
});

test("API exposes production social sentiment contract", () => {
  const api = readFileSync("apps/api/src/server.mjs", "utf8");
  for (const route of [
    "/api/market-intelligence/social-sentiment",
    "/api/market-intelligence/social-sentiment/summary",
    "/api/market-intelligence/social-sentiment/feed",
    "/api/market-intelligence/social-sentiment/heatmap",
    "/api/market-intelligence/social-sentiment/topics",
    "/api/market-intelligence/social-sentiment/fear-greed",
    "/api/market-intelligence/social-sentiment/sources",
    "/api/market-intelligence/social-sentiment/alerts",
    "/api/market-intelligence/social-sentiment/sync",
    "/api/market-intelligence/social-sentiment/analyze",
    "/api/market-intelligence/social-sentiment/export"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
});

test("social sentiment migrations define legacy and production persistence tables", () => {
  const legacy = readFileSync("database/migrations/008_social_sentiment.sql", "utf8");
  for (const table of ["social_sentiment_sources", "social_sentiment_items", "social_sentiment_scores", "social_asset_sentiment", "retail_positioning", "sentiment_spikes", "contrarian_signals", "social_source_health", "social_sentiment_audit_logs"]) {
    assert.match(legacy, new RegExp(`market\\.${table}`));
  }
  const production = readFileSync("database/migrations/025_social_sentiment_intelligence_center.sql", "utf8");
  for (const table of ["social_sources", "social_source_configs", "social_posts", "social_sentiment_scores", "social_topics", "social_topic_mentions", "social_instrument_mentions", "social_alerts", "social_sync_logs", "social_provider_health", "social_ai_summaries", "social_correlation_results"]) {
    assert.match(production, new RegExp(`market\\.${table}`));
  }
});
