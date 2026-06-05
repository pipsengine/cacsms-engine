import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("packages/market-intelligence/src/validated-package.js", "utf8");
const page = readFileSync("apps/web/live-market-intelligence-page.js", "utf8");
const api = readFileSync("apps/api/src/server.mjs", "utf8");
const migration = readFileSync("database/migrations/031_validated_intelligence_package.sql", "utf8");

test("Validated Intelligence Package service reads the requested database sources", () => {
  for (const table of [
    "workflow.card_outputs",
    "workflow.card_inputs",
    "workflow.card_handoffs",
    "market.validated_intelligence_packages",
    "market.source_validation_results",
    "market.source_evidence",
    "market.validation_audit_logs"
  ]) assert.match(service, new RegExp(table.replace(".", "\\.")));
  assert.doesNotMatch(service, /MOCK_WORKFLOW|MOCK_|sample data/i);
});

test("Validated Intelligence Package migration creates official package inspection tables", () => {
  for (const table of [
    "market.validated_intelligence_packages",
    "market.source_validation_results",
    "market.source_evidence",
    "market.validation_audit_logs"
  ]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table.replace(".", "\\.")}`));
});

test("API exposes and persists the Card 1 validated package handoff", () => {
  assert.match(api, /GET \/api\/market-intelligence\/card-2\/validated-package/);
  assert.match(api, /persistValidatedPackageFromCardOne\(cardOneReport\)/);
});

test("Validated package page renders the requested read-only inspection sections", () => {
  for (const text of [
    "Validated Intelligence Package",
    "PACKAGE CONTENT OVERVIEW",
    "SOURCE DETAIL MATRIX",
    "ADMISSION DECISION",
    "DEPENDENCY MATRIX",
    "RAW PACKAGE PAYLOAD",
    "SOURCE EVIDENCE VIEWER",
    "VALIDATION CHECKS",
    "WORKFLOW LINEAGE",
    "PACKAGE HISTORY",
    "WORKFLOW CONTROLS",
    "AUDIT LOG",
    "Proceed To Intelligence Gathering"
  ]) assert.match(page, new RegExp(text));
});
