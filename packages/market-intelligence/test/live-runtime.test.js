import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const api = readFileSync(new URL("../../../apps/api/src/server.mjs", import.meta.url), "utf8");
const html = readFileSync(new URL("../../../apps/web/market-intelligence.html", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../../apps/web/market-intelligence-live-shell.js", import.meta.url), "utf8");

test("Market Intelligence browser startup uses the live-only shell", () => {
  assert.match(html, /market-intelligence-live-shell\.js/);
  assert.doesNotMatch(html, /src="\/market-intelligence-page\.js"/);
  assert.match(shell, /renderLiveMarketIntelligencePage/);
});
test("live adapter API reports honest unavailable states and official CFTC adapter support", () => {
  assert.match(api, /LIVE_ADAPTERS_ONLY/);
  assert.match(api, /NOT_CONFIGURED/);
  assert.match(api, /official_cftc_cache/);
  assert.match(api, /CFTC Historical Compressed \/ Futures Only/);
});
test("Card 1 API exposes live verification only", () => {
  assert.match(api, /workflow\/cards\/1\/test-live/);
  assert.doesNotMatch(api, /workflow\/cards\/1\/test-pass|workflow\/cards\/1\/test-warning|workflow\/cards\/1\/test-reject|workflow\/cards\/1\/test-missing/);
});
