import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Data Sources Validation sidebar defines the required Card 1 pages", () => {
  const navigation = readFileSync("apps/web/lib/navigation/sidebar-config.ts", "utf8");
  for (const page of [
    "Data Sources & Feed Health", "Source Configuration Center", "Market Data Providers", "News & Sentiment Sources",
    "Economic Calendar", "Social & Community Sentiment", "Institutional / COT Data", "Historical Data", "Broker Data",
    "Account Portfolio", "Prop Firm Rules", "Data Quality Gate", "Source Validation Logs", "Card 1 Test Harness"
  ]) assert.match(navigation, new RegExp(page.replace(/[&/]/g, "\\$&")));
  assert.match(navigation, /id: "data-sources-validation"/);
});

test("Market Intelligence sidebar defines the required Card 2 pages", () => {
  const navigation = readFileSync("apps/web/lib/navigation/sidebar-config.ts", "utf8");
  const intelligence = navigation.slice(navigation.indexOf('id: "market-intelligence"'), navigation.indexOf('id: "asset-scanner"'));
  for (const page of [
    "Intelligence Gathering Dashboard", "Validated Intelligence Package", "Source Health Review", "Intelligence Dependency Matrix",
    "Market Environment Intelligence", "Macro Intelligence", "Sentiment Intelligence", "Institutional Intelligence",
    "Broker & Liquidity Intelligence", "Portfolio & Account Intelligence", "Intelligence Scoring Engine",
    "Market Intelligence Package Builder", "Intelligence Handoff to Asset Scanner", "Intelligence Audit & Logs", "Card 2 Test Harness"
  ]) assert.match(intelligence, new RegExp(page.replace(/[&/]/g, "\\$&")));
  for (const page of ["Source Configuration Center", "Market Data Providers", "Data Quality Gate"]) assert.doesNotMatch(intelligence, new RegExp(page.replace(/[&/]/g, "\\$&")));
});

test("enterprise sidebar keeps functions as expand-only buttons and children as links", () => {
  const sidebar = readFileSync("apps/web/enterprise-sidebar.js", "utf8");
  assert.match(sidebar, /class="enterprise-sidebar-parent" type="button"/);
  assert.match(sidebar, /class="enterprise-sidebar-child\$\{route === current \? " active" : ""\}" href="\$\{route\}"/);
  assert.doesNotMatch(sidebar, /href="\/workspace\/market-intelligence">Market Intelligence Center/);
  assert.match(sidebar, /"\/workspace\/data-sources-validation\/market-data-providers"/);
  assert.match(sidebar, /"\/workspace\/market-intelligence\/market-data": "\/workspace\/data-sources-validation\/market-data-providers"/);
  assert.doesNotMatch(sidebar, /function-number/);
  assert.doesNotMatch(sidebar, /\["01"/);
  assert.match(sidebar, /data-sources-validation/);
  for (const icon of ["LayoutDashboard", "Workflow", "ClipboardCheck", "Radar", "ScanSearch", "LineChart", "Camera", "Brain", "MessagesSquare", "Target", "ShieldAlert", "PlayCircle", "Briefcase", "DatabaseZap", "Server", "MonitorSmartphone", "Activity", "FileBarChart", "ShieldCheck", "Settings"]) assert.match(sidebar, new RegExp(icon));
});

test("enterprise sidebar restores its navigation position across page loads", () => {
  const sidebar = readFileSync("apps/web/enterprise-sidebar.js", "utf8");
  assert.match(sidebar, /sessionStorage\.getItem\(sidebarStateKey\)/);
  assert.match(sidebar, /navigation\.scrollTop = previousScrollTop/);
  assert.match(sidebar, /writeSidebarState\(\{ collapsed: shell\.classList\.contains\("sidebar-collapsed"\), expanded: \[\.\.\.expanded\], scrollTop \}\)/);
});

test("Market Intelligence sidebar navigation renders requested pages without document reloads", () => {
  const sidebar = readFileSync("apps/web/enterprise-sidebar.js", "utf8");
  const shell = readFileSync("apps/web/market-intelligence-live-shell.js", "utf8");
  assert.match(sidebar, /onNavigate\(route, event\)/);
  assert.match(sidebar, /event\.preventDefault\(\)/);
  assert.match(shell, /history\.pushState\(\{\}, "", route\)/);
  assert.match(shell, /window\.addEventListener\("popstate", renderCurrentPage\)/);
  assert.match(shell, /unmountCurrentPage\(\)/);
});

test("dashboard shells load the system readability override after page styles", () => {
  for (const page of ["market-intelligence.html", "mt5-infrastructure.html", "workflow.html", "executive-workflow-dashboard.html"]) {
    const html = readFileSync(`apps/web/${page}`, "utf8");
    assert.ok(html.lastIndexOf("readability.css") > html.lastIndexOf("styles.css"), `${page} loads readability.css last`);
  }
  const globals = readFileSync("apps/web/app/globals.css", "utf8");
  assert.ok(globals.lastIndexOf('readability.css') > globals.lastIndexOf('market-data.css'));
});

test("dashboard shells install the shared real-time tick and UTC clock runtime", () => {
  for (const page of ["index.html", "market-intelligence.html", "mt5-infrastructure.html", "workflow.html", "executive-workflow-dashboard.html"]) {
    assert.match(readFileSync(`apps/web/${page}`, "utf8"), /real-time-status\.js/, page);
  }
  const runtime = readFileSync("apps/web/real-time-status.js", "utf8");
  assert.match(runtime, /setInterval\(updateClock, 1000\)/);
  assert.match(runtime, /window\.setTimeout\(refreshTicks, delay\)/);
  assert.match(runtime, /\/api\/market-data\/ticks\/latest\?limit=8/);
  assert.match(runtime, /WAITING FOR MT5/);
});

test("Data Sources Validation owns source configuration and validation pages", () => {
  const navigation = readFileSync("apps/web/lib/navigation/sidebar-config.ts", "utf8");
  const validation = navigation.slice(navigation.indexOf('id: "data-sources-validation"'), navigation.indexOf('id: "market-intelligence"'));
  for (const page of ["Source Configuration Center", "Market Data Providers", "News & Sentiment Sources", "Economic Calendar", "Social & Community Sentiment", "Institutional / COT Data", "Historical Data", "Broker Data", "Account Portfolio", "Prop Firm Rules", "Data Quality Gate"]) assert.match(validation, new RegExp(page.replace(/[&/]/g, "\\$&")));
  assert.match(validation, /Data Sources & Feed Health/);
  assert.doesNotMatch(validation, /Market Intelligence Package Builder/);
});

test("Market Intelligence Center owns intelligence production pages only", () => {
  const navigation = readFileSync("apps/web/lib/navigation/sidebar-config.ts", "utf8");
  const intelligence = navigation.slice(navigation.indexOf('id: "market-intelligence"'), navigation.indexOf('id: "asset-scanner"'));
  assert.match(intelligence, /Intelligence Gathering Dashboard/);
  assert.match(intelligence, /Market Intelligence Package Builder/);
  assert.match(intelligence, /Intelligence Handoff to Asset Scanner/);
  assert.doesNotMatch(intelligence, /Data Sources & Feed Health/);
  assert.doesNotMatch(intelligence, /Source Configuration Center/);
  assert.doesNotMatch(intelligence, /Market Data Providers/);
});

test("Market Intelligence workspace routes match the enterprise navigation contract", () => {
  const sidebar = readFileSync("apps/web/lib/navigation/sidebar-config.ts", "utf8");
  for (const route of [
    "/workspace/data-sources-validation/dashboard", "/workspace/data-sources-validation/source-configuration",
    "/workspace/data-sources-validation/market-data-providers", "/workspace/data-sources-validation/news-sources",
    "/workspace/data-sources-validation/economic-calendar", "/workspace/data-sources-validation/institutional-cot",
    "/workspace/data-sources-validation/historical-data", "/workspace/data-sources-validation/broker-data",
    "/workspace/data-sources-validation/account-portfolio", "/workspace/data-sources-validation/prop-firm-rules",
    "/workspace/data-sources-validation/data-quality-gate", "/workspace/data-sources-validation/logs",
    "/workspace/data-sources-validation/test-harness", "/workspace/market-intelligence/dashboard",
    "/workspace/market-intelligence/validated-package", "/workspace/market-intelligence/source-health-review",
    "/workspace/market-intelligence/dependency-matrix", "/workspace/market-intelligence/market-environment",
    "/workspace/market-intelligence/macro-intelligence", "/workspace/market-intelligence/sentiment-intelligence",
    "/workspace/market-intelligence/institutional-intelligence", "/workspace/market-intelligence/broker-liquidity",
    "/workspace/market-intelligence/portfolio-intelligence", "/workspace/market-intelligence/scoring-engine",
    "/workspace/market-intelligence/package-builder", "/workspace/market-intelligence/handoff",
    "/workspace/market-intelligence/logs", "/workspace/market-intelligence/test-harness"
  ]) assert.match(sidebar, new RegExp(route.replaceAll("/", "\\/")));
});

test("workflow Card 1 keeps the reference-image white background and blue header", () => {
  const css = readFileSync("apps/web/workflow.css", "utf8");
  assert.match(css, /\.workflow-data-sources-card\{[^}]*background:#fff/);
  assert.match(css, /\.workflow-data-sources-card>h2\{[^}]*background:#0054d6/);
});
