import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Market Intelligence sidebar defines the required workspace sub-function pages", () => {
  const navigation = readFileSync("apps/web/lib/navigation/sidebar-config.ts", "utf8");
  for (const page of [
    "Intelligence Dashboard", "Data Sources & Feed Health", "Market Data Providers",
    "News & Sentiment Sources", "Economic Calendar", "Social & Community Sentiment", "Institutional / COT Data", "Historical Data", "Broker Data",
    "Account & Portfolio Data", "Prop Firm Rules & Limits", "Data Quality Gate"
  ]) assert.match(navigation, new RegExp(page.replace(/[&/]/g, "\\$&")));
});

test("enterprise sidebar keeps functions as expand-only buttons and children as links", () => {
  const sidebar = readFileSync("apps/web/enterprise-sidebar.js", "utf8");
  assert.match(sidebar, /class="enterprise-sidebar-parent" type="button"/);
  assert.match(sidebar, /class="enterprise-sidebar-child\$\{route === current \? " active" : ""\}" href="\$\{route\}"/);
  assert.doesNotMatch(sidebar, /href="\/workspace\/market-intelligence">Market Intelligence Center/);
});

test("Market Intelligence workspace routes match the enterprise navigation contract", () => {
  const sidebar = readFileSync("apps/web/lib/navigation/sidebar-config.ts", "utf8");
  for (const route of [
    "/workspace/market-intelligence/dashboard", "/workspace/market-intelligence/data-sources",
    "/workspace/market-intelligence/market-data", "/workspace/market-intelligence/news-sentiment",
    "/workspace/market-intelligence/economic-calendar", "/workspace/market-intelligence/institutional-cot",
    "/workspace/market-intelligence/historical-data", "/workspace/market-intelligence/broker-data",
    "/workspace/market-intelligence/account-portfolio", "/workspace/market-intelligence/prop-firm-rules",
    "/workspace/market-intelligence/data-quality-gate"
  ]) assert.match(sidebar, new RegExp(route.replaceAll("/", "\\/")));
});

test("workflow Card 1 keeps the reference-image white background and blue header", () => {
  const css = readFileSync("apps/web/workflow.css", "utf8");
  assert.match(css, /\.workflow-data-sources-card\{[^}]*background:#fff/);
  assert.match(css, /\.workflow-data-sources-card>h2\{[^}]*background:#0054d6/);
});
