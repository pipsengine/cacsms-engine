import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(new URL("../../../apps/web/market-intelligence-actions.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../../../apps/web/market-intelligence-page.js", import.meta.url), "utf8");

test("Market Intelligence installs a shared operator action dispatcher", () => {
  assert.match(page, /installMarketIntelligenceActions\(\)/);
  assert.match(actions, /document\.addEventListener\("click"/);
});
test("operator actions support API mutations exports uploads navigation and feedback", () => {
  for (const feature of ["fetch(`${API}${endpoint}`", "new Blob", 'input.type = "file"', 'location.assign("/workspace/market-intelligence/data-quality-gate")', "mi-action-toast"]) assert.ok(actions.includes(feature), feature);
});
test("operator actions cover every dedicated Market Intelligence backend family", () => {
  for (const route of ["news-sentiment", "economic-calendar", "social-sentiment", "historical-data", "broker-data", "account-portfolio", "prop-firm-rules", "data-quality-gate"]) assert.match(actions, new RegExp(route));
});
