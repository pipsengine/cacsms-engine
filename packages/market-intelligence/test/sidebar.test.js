import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Market Intelligence sidebar defines the required intelligence pages", () => {
  const navigation = readFileSync("apps/web/lib/navigation/sidebar-config.ts", "utf8");
  for (const page of [
    "Intelligence Gathering Dashboard", "Data Sources Validation", "Source Configuration Center", "Market Data Providers",
    "News & Sentiment Sources", "Economic Calendar", "Social & Community Sentiment", "Institutional / COT Data", "Historical Data", "Broker Data",
    "Account Portfolio", "Prop Firm Rules", "Data Quality Gate"
  ]) assert.match(navigation, new RegExp(page.replace(/[&/]/g, "\\$&")));
  assert.doesNotMatch(navigation, /id: "data-sources-validation"/);
});

test("enterprise sidebar keeps functions as expand-only buttons and children as links", () => {
  const sidebar = readFileSync("apps/web/enterprise-sidebar.js", "utf8");
  assert.match(sidebar, /class="enterprise-sidebar-parent" type="button"/);
  assert.match(sidebar, /class="enterprise-sidebar-child\$\{route === current \? " active" : ""\}" href="\$\{route\}"/);
  assert.doesNotMatch(sidebar, /href="\/workspace\/market-intelligence">Market Intelligence Center/);
  assert.doesNotMatch(sidebar, /function-number/);
  assert.doesNotMatch(sidebar, /\["01"/);
  assert.doesNotMatch(sidebar, /data-sources-validation/);
  for (const icon of ["LayoutDashboard", "Workflow", "Radar", "ScanSearch", "LineChart", "Camera", "Brain", "MessagesSquare", "Target", "ShieldAlert", "PlayCircle", "Briefcase", "DatabaseZap", "Server", "MonitorSmartphone", "Activity", "FileBarChart", "ShieldCheck", "Settings"]) assert.match(sidebar, new RegExp(icon));
});

test("Market Intelligence Center owns gathering, configuration and source pages", () => {
  const navigation = readFileSync("apps/web/lib/navigation/sidebar-config.ts", "utf8");
  const intelligence = navigation.slice(navigation.indexOf('id: "market-intelligence"'), navigation.indexOf('id: "asset-scanner"'));
  for (const page of ["Market Data Providers", "News & Sentiment Sources", "Economic Calendar", "Social & Community Sentiment", "Institutional / COT Data", "Historical Data", "Broker Data", "Account Portfolio", "Prop Firm Rules", "Data Quality Gate"]) assert.match(intelligence, new RegExp(page.replace(/[&/]/g, "\\$&")));
  assert.match(intelligence, /Intelligence Gathering Dashboard/);
  assert.match(intelligence, /Data Sources Validation/);
  assert.match(intelligence, /Source Configuration Center/);
  assert.doesNotMatch(intelligence, /Data Sources & Feed Health/);
});

test("Market Intelligence workspace routes match the enterprise navigation contract", () => {
  const sidebar = readFileSync("apps/web/lib/navigation/sidebar-config.ts", "utf8");
  for (const route of [
    "/workspace/market-intelligence/dashboard", "/workspace/market-intelligence/data-sources", "/workspace/market-intelligence/source-configuration",
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
