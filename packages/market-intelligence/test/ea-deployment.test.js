import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildManifestChecksums, EA_DEPLOY_STATUSES } from "../src/ea-deployment.js";

test("EA deployment manifest includes required bridge files", () => {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("../../../mt5/deploy-manifest.json", import.meta.url)), "utf8"));
  const sources = manifest.files.map((row) => row.source);
  assert.ok(sources.includes("experts/CACSMS_Engine_Bridge.mq5"));
  assert.ok(sources.includes("include/HeartbeatManager.mqh"));
  assert.ok(sources.includes("scripts/CACSMS_TestConnection.mq5"));
  assert.ok(sources.includes("presets/CACSMS_Bridge_Settings.set"));
});

test("manifest checksum builder resolves repository files", () => {
  const rows = buildManifestChecksums();
  assert.ok(rows.length >= 10);
  assert.ok(rows.every((row) => row.sourceChecksum));
});

test("EA deployment statuses include lifecycle states", () => {
  for (const status of ["PENDING", "DEPLOYING", "DEPLOYED", "VERIFIED", "FAILED", "ROLLBACK_REQUIRED"]) {
    assert.ok(EA_DEPLOY_STATUSES.includes(status));
  }
});

test("machine agent compiles the executable bridge and verifies EX5 freshness", () => {
  const manager = readFileSync(fileURLToPath(new URL("../../../apps/machine-agent/agent/deployment_manager.py", import.meta.url)), "utf8");
  const repository = readFileSync(fileURLToPath(new URL("../src/ea-deployment.js", import.meta.url)), "utf8");
  assert.match(manager, /def compile_bridge/);
  assert.match(manager, /MetaEditor64\.exe/);
  assert.match(manager, /binary\.stat\(\)\.st_mtime >= source\.stat\(\)\.st_mtime/);
  assert.match(repository, /statSync\(binaryPath\)\.mtimeMs >= statSync\(sourcePath\)\.mtimeMs/);
});
