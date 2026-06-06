import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CARD_TWO_ACCEPTANCE_CHECKS, createCardTwoTestReport } from "../src/card-two.js";

const api = readFileSync(new URL("../../../apps/api/src/server.mjs", import.meta.url), "utf8");
const page = readFileSync(new URL("../../../apps/web/executive-workflow-dashboard.js", import.meta.url), "utf8");

const passingDashboard = {
  sourceMode: "DATABASE_ONLY",
  inputPackage: { id: "VIP-20260606053756", status: "RECEIVED" },
  outputPackage: { packageId: "MI-20260606054306", status: "PASSED", confidence: 92, generatedAt: "2026-06-06T05:43:06.149Z" },
  workflow: { currentState: "INPUT_RECEIVED" },
  acceptance: [
    { id: "required_sources", requirement: "All required intelligence sources available", status: "PASS" },
    { id: "market_score", requirement: "Market Intelligence Score > 80", status: "PASS" },
    { id: "confidence", requirement: "Confidence Score > 85", status: "PASS" },
    { id: "freshness", requirement: "Data Freshness Acceptable", status: "PASS" },
    { id: "macro", requirement: "Macro Context Available", status: "PASS" },
    { id: "institutional", requirement: "Institutional Context Available", status: "PASS" },
    { id: "sentiment", requirement: "Sentiment Context Available", status: "PASS" },
    { id: "output", requirement: "Output Package Generated", status: "PASS" }
  ],
  scores: [
    { key: "market_intelligence", label: "Market Intelligence Score", value: 92, status: "PASSED" },
    { key: "confidence", label: "Confidence Score", value: 90, status: "PASSED" }
  ],
  pipeline: [{ name: "Market Environment Intelligence", status: "COMPLETED", progress: 100, confidence: 90 }],
  kpis: [["Intelligence Modules Completed", "6/8"]]
};

test("Card 2 completes when intelligence package checks pass", () => {
  const report = createCardTwoTestReport(passingDashboard, "2026-06-06T05:43:06.149Z");
  assert.equal(report.status, "PASSED");
  assert.equal(report.workflowPermission, "CONTINUE");
  assert.equal(report.cardTitle, "Market Intelligence Gathering");
  assert.equal(report.output, "Market Intelligence Package");
  assert.equal(report.nextCard.cardNumber, 3);
  assert.equal(report.nextCard.cardTitle, "20-Asset Universe Scanner");
  assert.equal(report.checks.length, CARD_TWO_ACCEPTANCE_CHECKS.length);
});

test("Card 2 rejects handoff when output package is missing", () => {
  const report = createCardTwoTestReport({
    ...passingDashboard,
    outputPackage: null,
    acceptance: passingDashboard.acceptance.map(item => item.id === "output" ? { ...item, status: "FAIL" } : item)
  });
  assert.equal(report.status, "REJECTED");
  assert.equal(report.workflowPermission, "STOP");
  assert.equal(report.nextCard, null);
});

test("Executive workflow dashboard exposes Card 2 live test controls", () => {
  assert.match(api, /\/api\/workflow\/cards\/2\/test-live/);
  assert.match(api, /runCardTwoLiveTest/);
  assert.match(page, /Run Live Card 2 Test/);
  assert.match(page, /CARD 2 ACCEPTANCE CHECK MATRIX/);
  assert.match(page, /CARD 3 \/ 20-ASSET UNIVERSE SCANNER/);
});
