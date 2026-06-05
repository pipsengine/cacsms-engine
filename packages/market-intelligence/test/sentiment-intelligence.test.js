import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("packages/market-intelligence/src/sentiment-intelligence.js", "utf8");
const page = readFileSync("apps/web/live-market-intelligence-page.js", "utf8");
const api = readFileSync("apps/api/src/server.mjs", "utf8");
const migration = readFileSync("database/migrations/036_sentiment_intelligence.sql", "utf8");

test("Sentiment Intelligence service reads the requested production tables", () => {
  for (const table of [
    "market.sentiment_intelligence_scores",
    "market.sentiment_intelligence_inputs",
    "market.instrument_sentiment_states",
    "market.currency_sentiment_matrix",
    "market.sentiment_divergence_events",
    "market.sentiment_extreme_risks",
    "market.sentiment_timeline_events",
    "market.sentiment_ai_summaries",
    "market.sentiment_alerts",
    "market.sentiment_audit_logs"
  ]) assert.match(service, new RegExp(table.replace(".", "\\.")));
  assert.match(service, /SentimentIntelligenceEngine/);
  assert.doesNotMatch(service, /MOCK_|demo sentiment|sample sentiment|placeholder row/i);
});

test("Sentiment Intelligence migration creates dashboard storage tables", () => {
  for (const table of [
    "sentiment_intelligence_scores",
    "sentiment_intelligence_inputs",
    "instrument_sentiment_states",
    "currency_sentiment_matrix",
    "sentiment_divergence_events",
    "sentiment_extreme_risks",
    "sentiment_timeline_events",
    "sentiment_ai_summaries",
    "sentiment_alerts",
    "sentiment_audit_logs"
  ]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS market\\.${table}`));
});

test("API exposes Sentiment Intelligence routes and actions", () => {
  for (const route of [
    "/api/market-intelligence/sentiment-intelligence",
    "/api/market-intelligence/sentiment-intelligence/summary",
    "/api/market-intelligence/sentiment-intelligence/inputs",
    "/api/market-intelligence/sentiment-intelligence/instruments",
    "/api/market-intelligence/sentiment-intelligence/currency-matrix",
    "/api/market-intelligence/sentiment-intelligence/divergence",
    "/api/market-intelligence/sentiment-intelligence/extreme-risk",
    "/api/market-intelligence/sentiment-intelligence/timeline",
    "/api/market-intelligence/sentiment-intelligence/export"
  ]) assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(api, /runSentimentIntelligenceAction\(action/);
});

test("Sentiment Intelligence page renders requested production sections", () => {
  for (const text of [
    "Sentiment Intelligence Center",
    "Refresh Sentiment",
    "Recalculate Sentiment",
    "Configure Inputs",
    "Create Alert",
    "Export Report",
    "UNIFIED SENTIMENT ENGINE",
    "INPUT DEPENDENCY PANEL",
    "INSTRUMENT SENTIMENT TABLE",
    "CURRENCY SENTIMENT MATRIX",
    "SENTIMENT AGREEMENT / DIVERGENCE PANEL",
    "EXTREME SENTIMENT & CONTRARIAN RISK",
    "SENTIMENT TIMELINE",
    "AI SENTIMENT INTERPRETATION",
    "Sentiment intelligence cannot be calculated yet"
  ]) assert.match(page, new RegExp(text));
});

test("Sentiment Intelligence permissions are explicit", () => {
  for (const permission of [
    "market_intelligence.sentiment_intelligence.view",
    "market_intelligence.sentiment_intelligence.recalculate",
    "market_intelligence.sentiment_intelligence.configure_inputs",
    "market_intelligence.sentiment_intelligence.export",
    "market_intelligence.sentiment_intelligence.create_alert"
  ]) assert.match(service, new RegExp(permission.replaceAll(".", "\\.")));
});
