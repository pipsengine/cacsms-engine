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
    id: "market-intelligence", icon: "Radar", title: "Market Intelligence Center", status: "READY", defaultExpanded: true,
    children: [
      page("intelligence-dashboard", "Intelligence Gathering Dashboard", "/workspace/market-intelligence/dashboard", "market-intelligence:view"),
      page("data-sources-validation", "Data Sources Validation", "/workspace/market-intelligence/data-sources", "market-intelligence:view"),
      page("source-configuration", "Source Configuration Center", "/workspace/market-intelligence/source-configuration", "market-intelligence:admin"),
      page("market-data-mi", "Market Data Providers", "/workspace/market-intelligence/market-data", "market-intelligence:view"),
      page("news-sentiment-mi", "News Sentiment", "/workspace/market-intelligence/news-sentiment", "market-intelligence:view"),
      page("economic-calendar-mi", "Economic Calendar", "/workspace/market-intelligence/economic-calendar", "market-intelligence:view"),
      page("social-sentiment-mi", "Social & Community Sentiment", "/workspace/market-intelligence/social-sentiment", "market-intelligence:view"),
      page("institutional-cot-mi", "Institutional / COT Data", "/workspace/market-intelligence/institutional-cot", "market-intelligence:view"),
      page("historical-data-mi", "Historical Data", "/workspace/market-intelligence/historical-data", "market_intelligence.historical_data.view"),
      page("broker-data-mi", "Broker Data", "/workspace/market-intelligence/broker-data", "market-intelligence:view"),
      page("account-portfolio-mi", "Account Portfolio", "/workspace/market-intelligence/account-portfolio", "market_intelligence.account_portfolio.view"),
      page("prop-firm-rules-mi", "Prop Firm Rules", "/workspace/market-intelligence/prop-firm-rules", "market_intelligence.prop_firm_rules.view"),
      page("data-quality-gate-mi", "Data Quality Gate", "/workspace/market-intelligence/data-quality-gate", "market_intelligence.data_quality_gate.view")
    ]
  },
  { id: "asset-scanner", icon: "ScanSearch", title: "20-Asset Universe Scanner", children: [page("scanner-dashboard", "Scanner Dashboard", "/workspace/asset-scanner/dashboard")] },
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
