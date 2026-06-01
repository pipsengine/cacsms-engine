import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CARD_ONE_ACCEPTANCE_CHECKS, createCardOneTestReport } from "../src/card-one.js";

const api = readFileSync(new URL("../../../apps/api/src/server.mjs", import.meta.url), "utf8");
const nav = readFileSync(new URL("../../../apps/web/enterprise-sidebar.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../../../apps/web/executive-workflow-dashboard.js", import.meta.url), "utf8");

test("Card 1 production baseline completes and unlocks Card 2 testing", () => {
  const report = createCardOneTestReport("pass", "2026-06-01T12:00:00.000Z");
  assert.equal(report.status, "PASSED");
  assert.equal(report.workflowPermission, "CONTINUE");
  assert.equal(report.output, "Market Intelligence Package");
  assert.equal(report.nextCard.cardNumber, 2);
  assert.equal(report.checks.length, CARD_ONE_ACCEPTANCE_CHECKS.length);
});
test("Card 1 stale calendar scenario continues with a warning", () => {
  const report = createCardOneTestReport("warning");
  assert.equal(report.status, "PASSED_WITH_WARNING");
  assert.equal(report.workflowPermission, "CONTINUE");
  assert.match(report.warnings.join(" "), /Economic Calendar/);
});
test("Card 1 market feed failure and missing feed scenarios stop workflow handoff", () => {
  for (const scenario of ["reject", "missing"]) {
    const report = createCardOneTestReport(scenario);
    assert.equal(report.status, "REJECTED");
    assert.equal(report.workflowPermission, "STOP");
    assert.equal(report.nextCard, null);
  }
});
test("Executive Command Center exposes the Card 1 workflow dashboard and API test routes", () => {
  assert.match(nav, /Executive Command Center.+Workflow Dashboard/);
  assert.match(nav, /executive-command-center\/workflow-dashboard/);
  for (const route of ["test-pass", "test-warning", "test-reject", "test-missing"]) assert.match(api, new RegExp(route));
  for (const section of ["ACCEPTANCE CHECK MATRIX", "SOURCE EVIDENCE MATRIX", "REJECT / STOP CONDITIONS", "TEST AUDIT TRAIL", "CARD 2 HANDOFF READINESS"]) assert.match(page, new RegExp(section));
});
