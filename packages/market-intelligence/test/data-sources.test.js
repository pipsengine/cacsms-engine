import assert from "node:assert/strict";
import test from "node:test";
import { DATA_SOURCES, evaluateDataQualityGate } from "../src/data-sources.js";

const withStatus = (id, status) => DATA_SOURCES.map((source) => source.id === id ? { ...source, status } : source);

test("defines all nine Data Sources card rows", () => assert.equal(DATA_SOURCES.length, 9));
test("allows Stage 1 when all required sources are healthy", () => assert.equal(evaluateDataQualityGate().proceedToStageOne, true));
test("blocks Stage 1 when market data fails", () => assert.equal(evaluateDataQualityGate(withStatus("market-data", "FAILED")).proceedToStageOne, false));
test("uses restricted trading mode when the economic calendar is stale", () => assert.equal(evaluateDataQualityGate(withStatus("economic-calendar", "STALE")).tradingMode, "RESTRICTED"));
test("warns without blocking when optional social data fails", () => {
  const result = evaluateDataQualityGate(withStatus("social-sentiment", "FAILED"));
  assert.equal(result.proceedToStageOne, true);
  assert.match(result.warnings.join(" "), /confidence reduced/);
});
test("returns the production-structured Card 1 output", () => {
  const result = evaluateDataQualityGate();
  assert.equal(result.card, "data_sources");
  assert.equal(result.workflowStage, "market_intelligence_gathering");
  assert.equal(result.totalSources, 9);
  assert.equal(result.dataQualityScore, 98);
});
test("defines every requested data-source model field", () => {
  for (const field of ["id","name","category","subtitle","provider","status","required","lastSyncAt","freshnessSeconds","healthScore","latencyMs","errorCount","feedsStage","failureAction"]) assert.ok(field in DATA_SOURCES[0], field);
});
