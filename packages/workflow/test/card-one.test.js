import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CARD_ONE_ACCEPTANCE_CHECKS, createCardOneTestReport } from "../src/card-one.js";
import { DATA_SOURCES } from "../../market-intelligence/src/data-sources.js";

const api = readFileSync(new URL("../../../apps/api/src/server.mjs", import.meta.url), "utf8");
const nav = readFileSync(new URL("../../../apps/web/enterprise-sidebar.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../../../apps/web/executive-workflow-dashboard.js", import.meta.url), "utf8");

test("Card 1 completes only when supplied live snapshots satisfy admission", () => {
  const report = createCardOneTestReport(DATA_SOURCES, "2026-06-01T12:00:00.000Z");
  assert.equal(report.status, "PASSED");
  assert.equal(report.workflowPermission, "CONTINUE");
  assert.equal(report.cardTitle, "Data Sources Validation");
  assert.equal(report.output, "Validated Intelligence Package");
  assert.equal(report.outputPackage.status, "PASSED");
  assert.equal(report.nextCard.cardNumber, 2);
  assert.equal(report.nextCard.cardTitle, "Market Intelligence Gathering");
  assert.equal(report.checks.length, CARD_ONE_ACCEPTANCE_CHECKS.length);
});
test("Card 1 rejects handoff when a required calendar adapter is stale", () => {
  const report = createCardOneTestReport(DATA_SOURCES.map(source => source.id === "economic-calendar" ? { ...source, status: "STALE" } : source));
  assert.equal(report.status, "REJECTED");
  assert.equal(report.workflowPermission, "STOP");
  assert.match(report.warnings.join(" "), /Economic Calendar/);
});
test("Card 1 market feed failure and missing feed scenarios stop workflow handoff", () => {
  const snapshots = [
    DATA_SOURCES.map(source => source.id === "market-data" ? { ...source, status: "FAILED" } : source),
    DATA_SOURCES.filter(source => source.id !== "market-data")
  ];
  for (const sources of snapshots) {
    const report = createCardOneTestReport(sources);
    assert.equal(report.status, "REJECTED");
    assert.equal(report.workflowPermission, "STOP");
    assert.equal(report.nextCard, null);
  }
});
test("Executive Command Center exposes the Card 1 workflow dashboard and API test routes", () => {
  assert.match(nav, /Executive Command Center.+Workflow Dashboard/);
  assert.match(nav, /executive-command-center\/workflow-dashboard/);
  assert.match(api, /test-live/);
  assert.doesNotMatch(api, /test-pass|test-warning|test-reject|test-missing/);
  for (const section of ["ACCEPTANCE CHECK MATRIX", "SOURCE EVIDENCE MATRIX", "REJECT / STOP CONDITIONS", "TEST AUDIT TRAIL", "CARD 2 / MARKET INTELLIGENCE GATHERING"]) assert.match(page, new RegExp(section));
  for (const card of ["Data Sources Validation", "Market Intelligence Gathering", "20-Asset Universe Scanner", "Post-Trade Analytics & Learning"]) assert.match(page, new RegExp(card));
});
