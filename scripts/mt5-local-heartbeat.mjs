/**
 * Local MT5 heartbeat relay — use when MT5 WebRequest URL list is full or blocked.
 * Sends heartbeats to CACSMS Engine on behalf of the attached EA.
 *
 * Usage:
 *   node scripts/mt5-local-heartbeat.mjs --token CACSMS-MT5-REG-XXXXXXXX
 *   node scripts/mt5-local-heartbeat.mjs --token-file .mt5-token
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const apiBase = process.env.CACSMS_API_URL || process.env.API_URL || "http://127.0.0.1:8080";
const intervalSec = Number(process.env.HEARTBEAT_SECONDS || 10);

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

let token = readArg("--token");
const tokenFile = readArg("--token-file") || ".mt5-token";
if (!token && existsSync(tokenFile)) {
  token = readFileSync(tokenFile, "utf8").trim();
}

if (!token) {
  console.error("Token required. Use --token CACSMS-MT5-REG-XXXXXXXX or save token to .mt5-token");
  process.exit(1);
}

async function sendHeartbeat() {
  const response = await fetch(`${apiBase}/api/mt5/terminals/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, eaVersion: "1.0.1-local-relay", latencyMs: 12 })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ? String(payload.error).replaceAll("_", " ") : `HTTP ${response.status}`);
  }
  return payload;
}

console.log(`CACSMS local heartbeat relay → ${apiBase} every ${intervalSec}s`);

async function tick() {
  try {
    const result = await sendHeartbeat();
    console.log(`[${new Date().toISOString()}] heartbeat ${result.status || "OK"} terminal=${result.terminalId || "—"}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] heartbeat failed:`, error.message);
  }
}

await tick();
setInterval(tick, intervalSec * 1000);
