import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moduleSource = readFileSync("packages/market-intelligence/src/workflow-run.js", "utf8");
const validatedPackage = readFileSync("packages/market-intelligence/src/validated-package.js", "utf8");
const cardTwo = readFileSync("packages/market-intelligence/src/card-two-dashboard.js", "utf8");

test("workflow run helper seeds workflow_runs and backfills orphan card records", () => {
  assert.match(moduleSource, /ensureActiveWorkflowRun/);
  assert.match(moduleSource, /workflow\.workflow_runs/);
  assert.match(moduleSource, /workflow\.workflow_stages/);
  assert.match(moduleSource, /workflow\.card_inputs/);
  assert.match(moduleSource, /SET run_id = \$1 WHERE run_id IS NULL/);
  assert.match(validatedPackage, /ensureActiveWorkflowRun\(client/);
  assert.match(cardTwo, /ensureActiveWorkflowRun\(client/);
});
