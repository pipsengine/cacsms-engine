export type SidebarStatus = "LIVE" | "READY" | "BETA" | "WARNING";

export type SidebarSubFunction = {
  id: string;
  title: string;
  route: string;
  permission?: string;
};

export type SidebarFunction = {
  id: string;
  title: string;
  icon: string;
  status?: SidebarStatus;
  defaultExpanded?: boolean;
  children: SidebarSubFunction[];
};

const page = (id: string, title: string, route: string, permission = "workspace:view"): SidebarSubFunction => ({
  id, title, route, permission
});

export const sidebarFunctions: SidebarFunction[] = [
  { id: "executive", icon: "LayoutDashboard", title: "Executive Command Center", status: "LIVE", defaultExpanded: true, children: [page("executive-dashboard", "Executive Dashboard", "/"), page("executive-workflow-dashboard", "Workflow Dashboard", "/executive-command-center/workflow-dashboard", "workflow.cards.test")] },
  { id: "workflow", icon: "Workflow", title: "End-to-End Workflow", status: "LIVE", children: [page("workflow-dashboard", "Workflow Dashboard", "/workflow/end-to-end")] },
  {
    id: "data-sources-validation", icon: "ClipboardCheck", title: "Data Sources Validation", status: "READY", defaultExpanded: true,
    children: [
      page("data-sources-feed-health", "Data Sources & Feed Health", "/workspace/data-sources-validation/dashboard", "data-sources-validation:view"),
      page("source-configuration", "Source Configuration Center", "/workspace/data-sources-validation/source-configuration", "data-sources-validation:admin"),
      page("market-data-providers", "Market Data Providers", "/workspace/data-sources-validation/market-data-providers", "data-sources-validation:view"),
      page("news-sources", "News & Sentiment Sources", "/workspace/data-sources-validation/news-sources", "data-sources-validation:view"),
      page("economic-calendar", "Economic Calendar", "/workspace/data-sources-validation/economic-calendar", "data-sources-validation:view"),
      page("social-sentiment", "Social & Community Sentiment", "/workspace/data-sources-validation/social-sentiment", "data-sources-validation:view"),
      page("institutional-cot", "Institutional / COT Data", "/workspace/data-sources-validation/institutional-cot", "data-sources-validation:view"),
      page("historical-data", "Historical Data", "/workspace/data-sources-validation/historical-data", "market_intelligence.historical_data.view"),
      page("broker-data", "Broker Data", "/workspace/data-sources-validation/broker-data", "data-sources-validation:view"),
      page("account-portfolio", "Account Portfolio", "/workspace/data-sources-validation/account-portfolio", "market_intelligence.account_portfolio.view"),
      page("prop-firm-rules", "Prop Firm Rules", "/workspace/data-sources-validation/prop-firm-rules", "market_intelligence.prop_firm_rules.view"),
      page("data-quality-gate", "Data Quality Gate", "/workspace/data-sources-validation/data-quality-gate", "market_intelligence.data_quality_gate.view"),
      page("source-validation-logs", "Source Validation Logs", "/workspace/data-sources-validation/logs", "data-sources-validation:audit"),
      page("card-1-test-harness", "Card 1 Test Harness", "/workspace/data-sources-validation/test-harness", "workflow.cards.test")
    ]
  },
  {
    id: "market-intelligence", icon: "Radar", title: "Market Intelligence Center", status: "READY", defaultExpanded: true,
    children: [
      page("intelligence-dashboard", "Intelligence Gathering Dashboard", "/workspace/market-intelligence/dashboard", "market-intelligence:view"),
      page("validated-package", "Validated Intelligence Package", "/workspace/market-intelligence/validated-package", "market-intelligence:view"),
      page("source-health-review", "Source Health Review", "/workspace/market-intelligence/source-health-review", "market-intelligence:view"),
      page("dependency-matrix", "Intelligence Dependency Matrix", "/workspace/market-intelligence/dependency-matrix", "market-intelligence:view"),
      page("market-environment", "Market Environment Intelligence", "/workspace/market-intelligence/market-environment", "market-intelligence:view"),
      page("macro-intelligence", "Macro Intelligence", "/workspace/market-intelligence/macro-intelligence", "market-intelligence:view"),
      page("sentiment-intelligence", "Sentiment Intelligence", "/workspace/market-intelligence/sentiment-intelligence", "market-intelligence:view"),
      page("institutional-intelligence", "Institutional Intelligence", "/workspace/market-intelligence/institutional-intelligence", "market-intelligence:view"),
      page("broker-liquidity", "Broker & Liquidity Intelligence", "/workspace/market-intelligence/broker-liquidity", "market-intelligence:view"),
      page("portfolio-intelligence", "Portfolio & Account Intelligence", "/workspace/market-intelligence/portfolio-intelligence", "market-intelligence:view"),
      page("scoring-engine", "Intelligence Scoring Engine", "/workspace/market-intelligence/scoring-engine", "market-intelligence:view"),
      page("package-builder", "Market Intelligence Package Builder", "/workspace/market-intelligence/package-builder", "market-intelligence:build"),
      page("handoff", "Intelligence Handoff to Asset Scanner", "/workspace/market-intelligence/handoff", "market-intelligence:handoff"),
      page("intelligence-logs", "Intelligence Audit & Logs", "/workspace/market-intelligence/logs", "market-intelligence:audit"),
      page("card-2-test-harness", "Card 2 Test Harness", "/workspace/market-intelligence/test-harness", "workflow.cards.test")
    ]
  },
  {
    id: "asset-scanner", icon: "ScanSearch", title: "20-Asset Universe Scanner", status: "READY", defaultExpanded: true,
    children: [
      page("universe-dashboard", "Universe Dashboard", "/workspace/universe-scanner/dashboard", "universe-scanner:view"),
      page("asset-universe-registry", "Asset Universe Registry", "/workspace/universe-scanner/universe", "universe-scanner:view"),
      page("currency-strength", "Currency Strength Engine", "/workspace/universe-scanner/currency-strength", "universe-scanner:view"),
      page("trend-scanner", "Trend Scanner", "/workspace/universe-scanner/trend-scanner", "universe-scanner:view"),
      page("market-structure", "Market Structure Scanner", "/workspace/universe-scanner/market-structure", "universe-scanner:view"),
      page("momentum-scanner", "Momentum Scanner", "/workspace/universe-scanner/momentum", "universe-scanner:view"),
      page("volatility-scanner", "Volatility Scanner", "/workspace/universe-scanner/volatility", "universe-scanner:view"),
      page("liquidity-scanner", "Liquidity Scanner", "/workspace/universe-scanner/liquidity", "universe-scanner:view"),
      page("institutional-scanner", "Institutional Scanner", "/workspace/universe-scanner/institutional", "universe-scanner:view"),
      page("sentiment-scanner", "Sentiment Scanner", "/workspace/universe-scanner/sentiment", "universe-scanner:view"),
      page("macro-scanner", "Macro Scanner", "/workspace/universe-scanner/macro", "universe-scanner:view"),
      page("economic-event-scanner", "Economic Event Scanner", "/workspace/universe-scanner/economic-events", "universe-scanner:view"),
      page("risk-scanner", "Risk Scanner", "/workspace/universe-scanner/risk", "universe-scanner:view"),
      page("prop-compliance-scanner", "Prop Firm Compliance Scanner", "/workspace/universe-scanner/prop-compliance", "universe-scanner:view"),
      page("opportunity-ranking", "Opportunity Ranking Engine", "/workspace/universe-scanner/opportunities", "universe-scanner:view"),
      page("qualified-trades", "Qualified Trades Center", "/workspace/universe-scanner/qualified-trades", "universe-scanner:view"),
      page("ai-opportunity-discovery", "AI Opportunity Discovery", "/workspace/universe-scanner/ai-insights", "universe-scanner:view"),
      page("scanner-control-center", "Scanner Control Center", "/workspace/universe-scanner/control-center", "universe-scanner:operate"),
      page("scanner-logs", "Scanner Logs & Diagnostics", "/workspace/universe-scanner/logs", "universe-scanner:audit"),
      page("card-3-test-harness", "Scanner Test Harness", "/workspace/universe-scanner/test-harness", "workflow.cards.test")
    ]
  },
  { id: "market-analysis", icon: "LineChart", title: "Market Analysis", children: [page("analysis-dashboard", "Analysis Dashboard", "/workspace/market-analysis/dashboard")] },
  { id: "computer-vision", icon: "Camera", title: "Computer Vision", status: "BETA", children: [page("vision-dashboard", "Vision Dashboard", "/workspace/computer-vision/dashboard")] },
  { id: "ai-decision", icon: "Brain", title: "AI Decision", children: [page("decision-dashboard", "Decision Dashboard", "/workspace/ai-decision/dashboard")] },
  { id: "ai-consensus", icon: "MessagesSquare", title: "AI Debate & Consensus", children: [page("consensus-dashboard", "Consensus Dashboard", "/workspace/ai-consensus/dashboard")] },
  { id: "strategy", icon: "Target", title: "Strategy Intelligence", children: [page("strategy-dashboard", "Strategy Dashboard", "/workspace/strategy/dashboard")] },
  { id: "risk", icon: "ShieldAlert", title: "Risk Intelligence", children: [page("risk-dashboard", "Risk Dashboard", "/workspace/risk/dashboard")] },
  { id: "execution", icon: "PlayCircle", title: "Execution Center", children: [page("execution-dashboard", "Execution Dashboard", "/workspace/execution/dashboard")] },
  { id: "position", icon: "Briefcase", title: "Position Management", children: [page("position-dashboard", "Position Dashboard", "/workspace/position/dashboard")] },
  { id: "learning", icon: "DatabaseZap", title: "Learning & Memory", children: [page("learning-dashboard", "Learning Dashboard", "/workspace/learning/dashboard")] },
  { id: "mt5", icon: "Server", title: "MT5 Infrastructure", children: [page("mt5-dashboard", "MT5 Dashboard", "/workspace/mt5/dashboard")] },
  { id: "machines", icon: "MonitorSmartphone", title: "Machine Registry", children: [page("machines-dashboard", "Machine Dashboard", "/workspace/machines/dashboard")] },
  { id: "monitoring", icon: "Activity", title: "Monitoring & Self-Healing", children: [page("monitoring-dashboard", "Monitoring Dashboard", "/workspace/monitoring/dashboard")] },
  { id: "reports", icon: "FileBarChart", title: "Reports & Audit", children: [page("reports-dashboard", "Reports Dashboard", "/workspace/reports/dashboard")] },
  { id: "security", icon: "ShieldCheck", title: "Security & Governance", children: [page("security-dashboard", "Security Dashboard", "/workspace/security/dashboard")] },
  { id: "administration", icon: "Settings", title: "Administration", children: [page("administration-dashboard", "Administration Dashboard", "/workspace/administration/dashboard")] }
];
