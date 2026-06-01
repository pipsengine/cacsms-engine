export type SidebarStatus = "LIVE" | "READY" | "BETA" | "WARNING";

export type SidebarSubFunction = {
  id: string;
  title: string;
  route: string;
  permission?: string;
};

export type SidebarFunction = {
  id: string;
  number: string;
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
  { id: "executive", number: "01", icon: "CMD", title: "Executive Command Center", status: "LIVE", defaultExpanded: true, children: [page("executive-dashboard", "Executive Dashboard", "/"), page("executive-workflow-dashboard", "Workflow Dashboard", "/executive-command-center/workflow-dashboard", "workflow.cards.test")] },
  { id: "workflow", number: "02", icon: "FLOW", title: "End-to-End Workflow", status: "LIVE", children: [page("workflow-dashboard", "Workflow Dashboard", "/workflow/end-to-end")] },
  {
    id: "market-intelligence", number: "03", icon: "RAD", title: "Market Intelligence Center", status: "READY", defaultExpanded: true,
    children: [
      page("intelligence-dashboard", "Intelligence Dashboard", "/workspace/market-intelligence/dashboard", "market-intelligence:view"),
      page("data-sources", "Data Sources & Feed Health", "/workspace/market-intelligence/data-sources", "market-intelligence:view"),
      page("market-data", "Market Data Providers", "/workspace/market-intelligence/market-data", "market-intelligence:view"),
      page("news-sentiment", "News & Sentiment Sources", "/workspace/market-intelligence/news-sentiment", "market-intelligence:view"),
      page("economic-calendar", "Economic Calendar", "/workspace/market-intelligence/economic-calendar", "market-intelligence:view"),
      page("social-sentiment", "Social & Community Sentiment", "/workspace/market-intelligence/social-sentiment", "market-intelligence:view"),
      page("institutional-cot", "Institutional / COT Data", "/workspace/market-intelligence/institutional-cot", "market-intelligence:view"),
      page("historical-data", "Historical Data", "/workspace/market-intelligence/historical-data", "market_intelligence.historical_data.view"),
      page("broker-data", "Broker Data", "/workspace/market-intelligence/broker-data", "market-intelligence:view"),
      page("account-portfolio", "Account Portfolio", "/workspace/market-intelligence/account-portfolio", "market_intelligence.account_portfolio.view"),
      page("prop-firm-rules", "Prop Firm Rules", "/workspace/market-intelligence/prop-firm-rules", "market_intelligence.prop_firm_rules.view"),
      page("data-quality-gate", "Data Quality Gate", "/workspace/market-intelligence/data-quality-gate", "market_intelligence.data_quality_gate.view")
    ]
  },
  { id: "asset-scanner", number: "04", icon: "SCAN", title: "20-Asset Universe Scanner", children: [page("scanner-dashboard", "Scanner Dashboard", "/workspace/asset-scanner/dashboard")] },
  { id: "market-analysis", number: "05", icon: "ANL", title: "Market Analysis", children: [page("analysis-dashboard", "Analysis Dashboard", "/workspace/market-analysis/dashboard")] },
  { id: "computer-vision", number: "06", icon: "VIS", title: "Computer Vision", status: "BETA", children: [page("vision-dashboard", "Vision Dashboard", "/workspace/computer-vision/dashboard")] },
  { id: "ai-decision", number: "07", icon: "AI", title: "AI Decision", children: [page("decision-dashboard", "Decision Dashboard", "/workspace/ai-decision/dashboard")] },
  { id: "ai-consensus", number: "08", icon: "VOTE", title: "AI Debate & Consensus", children: [page("consensus-dashboard", "Consensus Dashboard", "/workspace/ai-consensus/dashboard")] },
  { id: "strategy", number: "09", icon: "STR", title: "Strategy Intelligence", children: [page("strategy-dashboard", "Strategy Dashboard", "/workspace/strategy/dashboard")] },
  { id: "risk", number: "10", icon: "RSK", title: "Risk Intelligence", children: [page("risk-dashboard", "Risk Dashboard", "/workspace/risk/dashboard")] },
  { id: "execution", number: "11", icon: "EXE", title: "Execution Center", children: [page("execution-dashboard", "Execution Dashboard", "/workspace/execution/dashboard")] },
  { id: "position", number: "12", icon: "POS", title: "Position Management", children: [page("position-dashboard", "Position Dashboard", "/workspace/position/dashboard")] },
  { id: "learning", number: "13", icon: "LRN", title: "Learning & Memory", children: [page("learning-dashboard", "Learning Dashboard", "/workspace/learning/dashboard")] },
  { id: "mt5", number: "14", icon: "MT5", title: "MT5 Infrastructure", children: [page("mt5-dashboard", "MT5 Dashboard", "/workspace/mt5/dashboard")] },
  { id: "machines", number: "15", icon: "MCH", title: "Machine Registry", children: [page("machines-dashboard", "Machine Dashboard", "/workspace/machines/dashboard")] },
  { id: "monitoring", number: "16", icon: "MON", title: "Monitoring & Self-Healing", children: [page("monitoring-dashboard", "Monitoring Dashboard", "/workspace/monitoring/dashboard")] },
  { id: "reports", number: "17", icon: "RPT", title: "Reports & Audit", children: [page("reports-dashboard", "Reports Dashboard", "/workspace/reports/dashboard")] },
  { id: "security", number: "18", icon: "SEC", title: "Security & Governance", children: [page("security-dashboard", "Security Dashboard", "/workspace/security/dashboard")] },
  { id: "administration", number: "19", icon: "ADM", title: "Administration", children: [page("administration-dashboard", "Administration Dashboard", "/workspace/administration/dashboard")] }
];
