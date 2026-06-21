import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CandlestickChart,
  ChartCandlestick,
  CircleGauge,
  ClipboardList,
  Database,
  FileBarChart,
  Gauge,
  Landmark,
  LineChart,
  LockKeyhole,
  MonitorCog,
  PlayCircle,
  RadioTower,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export type Role =
  | "Super Administrator"
  | "Administrator"
  | "Risk Manager"
  | "Compliance Officer"
  | "Portfolio Manager"
  | "Trader"
  | "Analyst"
  | "Viewer";

export type Submodule = {
  title: string;
  path: string;
};

export type Module = {
  title: string;
  path: string;
  description: string;
  icon: LucideIcon;
  color: string;
  roles: Role[];
  submodules: Submodule[];
  linkedModules: string[];
  requiredFeatures: string[];
};

export type NavigationSection = {
  title: string;
  description: string;
  moduleTitles: string[];
};

export type ResolvedPage = {
  module: Module;
  submodule?: Submodule;
  path: string;
};

const allRoles: Role[] = [
  "Super Administrator",
  "Administrator",
  "Risk Manager",
  "Compliance Officer",
  "Portfolio Manager",
  "Trader",
  "Analyst",
  "Viewer",
];

const operatorRoles: Role[] = [
  "Super Administrator",
  "Administrator",
  "Portfolio Manager",
  "Trader",
  "Analyst",
];

export const activeRole: Role = "Super Administrator";

export const modules: Module[] = [
  {
    title: "Dashboard",
    path: "/dashboard",
    description: "Executive operating picture for equity, exposure, engine health, AI confidence, alerts, and market activity.",
    icon: Gauge,
    color: "blue",
    roles: allRoles,
    submodules: [
      ["Executive Overview", "executive"],
      ["Live Trading Dashboard", "live-trading"],
      ["Account Performance", "account-performance"],
      ["Risk Overview", "risk-overview"],
      ["AI Decision Summary", "ai-decisions"],
      ["Market Watch", "market-watch"],
      ["Today's Opportunities", "opportunities"],
      ["System Health", "system-health"],
      ["Trade Lifecycle Design Status", "trade-lifecycle-status"],
      ["AI Decision Status Workflow", "ai-decision-status-workflow"],
    ].map(toSubmodule("/dashboard")),
    linkedModules: ["AI Decision Engine", "Trade Execution", "Trade Management", "Risk Management", "Performance Analytics", "Alerts & Notifications", "Reports", "System Monitoring"],
    requiredFeatures: ["Total equity", "Balance", "Floating P/L", "Daily P/L", "Weekly P/L", "Monthly P/L", "Open trades", "Closed trades", "Active symbols", "Active strategies", "Current trading mode", "Risk status", "MT5 bridge status", "Broker connection status", "AI confidence summary", "Latest decisions", "Latest alerts"],
  },
  {
    title: "Trading Control Center",
    path: "/trading-control",
    description: "Control engine state, trading mode, account mode, manual intervention, and emergency shutdown workflows.",
    icon: PlayCircle,
    color: "green",
    roles: ["Super Administrator", "Administrator", "Risk Manager", "Portfolio Manager", "Trader"],
    submodules: [
      ["Engine Start/Stop", "engine"],
      ["Trading Mode Control", "modes"],
      ["Demo/Live/Prop Mode", "account-mode"],
      ["Manual Override", "manual-override"],
      ["Emergency Shutdown", "emergency-shutdown"],
      ["Engine Status Logs", "status-logs"],
    ].map(toSubmodule("/trading-control")),
    linkedModules: ["Accounts & Brokers", "Risk Management", "AI Decision Engine", "Trade Execution", "System Monitoring", "Administration"],
    requiredFeatures: ["Start engine", "Stop engine", "Pause trading", "Resume trading", "Switch institutional/retail/hybrid mode", "Enable demo trading", "Enable live trading", "Enable prop firm trading", "Trigger emergency shutdown", "View reason for engine status"],
  },
  {
    title: "Market Intelligence",
    path: "/market-intelligence",
    description: "Live symbol, session, volatility, correlation, news, sentiment, and fundamental intelligence.",
    icon: CandlestickChart,
    color: "cyan",
    roles: allRoles,
    submodules: [
      ["Market Overview", "overview"],
      ["Symbol Watchlist", "watchlist"],
      ["Multi-Timeframe Analysis", "multi-timeframe"],
      ["Session Analysis", "sessions"],
      ["Volatility Analysis", "volatility"],
      ["Correlation Analysis", "correlation"],
      ["News Impact Monitor", "news"],
      ["Sentiment Analysis", "sentiment"],
      ["Fundamental Analysis", "fundamental"],
    ].map(toSubmodule("/market-intelligence")),
    linkedModules: ["Institutional Engine", "Retail Engine", "AI Decision Engine", "Trade Execution", "Risk Management", "Learning Center"],
    requiredFeatures: ["Symbol cards", "Session status", "Market bias", "Volatility score", "Trend direction", "Sentiment score", "Fundamental impact score", "News risk warning", "Opportunity button", "Symbol drill-down"],
  },
  {
    title: "Institutional Engine",
    path: "/institutional-engine",
    description: "Smart money workflow for liquidity, order blocks, fair value gaps, structure, stop hunts, and bias.",
    icon: Landmark,
    color: "violet",
    roles: operatorRoles,
    submodules: [
      ["Liquidity Analysis", "liquidity"],
      ["Order Blocks", "order-blocks"],
      ["Fair Value Gaps", "fair-value-gaps"],
      ["Market Structure", "market-structure"],
      ["Stop Hunt Detection", "stop-hunts"],
      ["Smart Money Concepts", "smc"],
      ["Volume Profile", "volume-profile"],
      ["Institutional Bias", "bias"],
      ["Accumulation/Distribution", "accumulation-distribution"],
    ].map(toSubmodule("/institutional-engine")),
    linkedModules: ["Market Intelligence", "AI Decision Engine", "Trade Execution", "Risk Management", "Learning Center", "Reports"],
    requiredFeatures: ["Institutional setup cards", "Liquidity zones", "Order block list", "Bias summary", "Confidence score", "Send to AI Decision Engine", "View related trades", "Document lesson"],
  },
  {
    title: "Retail Engine",
    path: "/retail-engine",
    description: "Retail technical-analysis workflow for top-down analysis, support/resistance, candles, pullbacks, breakouts, and indicators.",
    icon: ChartCandlestick,
    color: "amber",
    roles: operatorRoles,
    submodules: [
      ["Top-Down Analysis", "top-down"],
      ["Support & Resistance", "support-resistance"],
      ["Trend Analysis", "trend"],
      ["Candlestick Analysis", "candlesticks"],
      ["Chart Patterns", "chart-patterns"],
      ["Pullback Detection", "pullbacks"],
      ["Breakout Detection", "breakouts"],
      ["Indicator Confluence", "indicators"],
      ["Retail Bias", "bias"],
    ].map(toSubmodule("/retail-engine")),
    linkedModules: ["Market Intelligence", "AI Decision Engine", "Trade Execution", "Trade Management", "Learning Center"],
    requiredFeatures: ["Multi-timeframe bias cards", "MN/W1/D1/H8/H4/H1/M30/M15/M5/M1 analysis", "Support/resistance zones", "Candle direction detection", "Pullback confirmation", "Entry timing status", "Send to AI Decision Engine"],
  },
  {
    title: "AI Decision Engine",
    path: "/ai-decision-engine",
    description: "Unified opportunity scoring, entry validation, mode selection, confidence, reasoning, and decision history.",
    icon: BrainCircuit,
    color: "indigo",
    roles: allRoles,
    submodules: [
      ["Opportunity Scanner", "opportunities"],
      ["Entry Validation", "entry-validation"],
      ["Mode Selection Logic", "mode-selection"],
      ["Confidence Score", "confidence"],
      ["Trade Reasoning", "reasoning"],
      ["Avoided Trade Reasons", "avoided-trades"],
      ["AI Recommendations", "recommendations"],
      ["Decision History", "history"],
    ].map(toSubmodule("/ai-decision-engine")),
    linkedModules: ["Market Intelligence", "Institutional Engine", "Retail Engine", "Trade Execution", "Risk Management", "Learning Center", "Reports", "Administration"],
    requiredFeatures: ["Decision cards", "Buy/sell/no-trade recommendation", "Institutional reason", "Retail reason", "Hybrid reason", "Confidence score", "Risk score", "Entry score", "News risk score", "Execute Trade", "Reject Trade", "Send to Learning Center"],
  },
  {
    title: "Trade Execution",
    path: "/trade-execution",
    description: "Order setup, validation, routing, execution confirmation, spread/slippage checks, and MT5 bridge handoff.",
    icon: RadioTower,
    color: "teal",
    roles: ["Super Administrator", "Administrator", "Portfolio Manager", "Trader"],
    submodules: [
      ["Symbol Selection", "symbol-selection"],
      ["Order Setup", "order-setup"],
      ["Market Orders", "market-orders"],
      ["Pending Orders", "pending-orders"],
      ["Order Validation", "order-validation"],
      ["MT5 Order Routing", "mt5-routing"],
      ["Broker Execution Logs", "broker-logs"],
      ["Slippage & Spread Monitor", "slippage-spread"],
    ].map(toSubmodule("/trade-execution")),
    linkedModules: ["AI Decision Engine", "Trade Management", "Risk Management", "Accounts & Brokers", "System Monitoring", "Reports", "Alerts & Notifications"],
    requiredFeatures: ["Order preview", "Entry price", "Stop loss", "Take profit", "Lot size", "Risk percentage", "Spread status", "Slippage warning", "Broker connection status", "MT5 terminal status", "Execution confirmation", "Post-execution link"],
  },
  {
    title: "Trade Management",
    path: "/trade-management",
    description: "Lifecycle management for open, basket, protected, adjusted, partially closed, and closed positions.",
    icon: BriefcaseBusiness,
    color: "emerald",
    roles: operatorRoles,
    submodules: [
      ["Open Trades", "open-trades"],
      ["Basket Trades", "basket-trades"],
      ["Position Monitoring", "position-monitoring"],
      ["Profit Lock Manager", "profit-lock"],
      ["Break-Even Manager", "break-even"],
      ["Trailing Stop Manager", "trailing-stop"],
      ["Partial Close Manager", "partial-close"],
      ["Exit Manager", "exit-manager"],
      ["Closed Trades", "closed-trades"],
    ].map(toSubmodule("/trade-management")),
    linkedModules: ["Trade Execution", "Risk Management", "Performance Analytics", "Reports", "Alerts & Notifications", "Learning Center", "Administration"],
    requiredFeatures: ["Real-time floating P/L", "Profit lock status", "Basket profit", "Per-position profit", "Stop loss movement", "Trailing stop activity", "Partial close actions", "Exit reason", "Trade timeline", "View AI reason", "View risk logs", "Generate learning note"],
  },
  {
    title: "Risk Management",
    path: "/risk-management",
    description: "Drawdown, exposure, margin, position, basket, and prop firm risk governance with shutdown linkage.",
    icon: ShieldCheck,
    color: "red",
    roles: ["Super Administrator", "Administrator", "Risk Manager", "Compliance Officer", "Portfolio Manager"],
    submodules: [
      ["Risk Dashboard", "dashboard"],
      ["Daily Loss Limit", "daily-loss"],
      ["Weekly Loss Limit", "weekly-loss"],
      ["Monthly Loss Limit", "monthly-loss"],
      ["Drawdown Control", "drawdown"],
      ["Equity Protection", "equity-protection"],
      ["Margin Protection", "margin-protection"],
      ["Position Limit Control", "position-limits"],
      ["Correlation Exposure", "correlation-exposure"],
      ["Prop Firm Rules", "prop-firm-rules"],
    ].map(toSubmodule("/risk-management")),
    linkedModules: ["Trading Control Center", "AI Decision Engine", "Trade Execution", "Trade Management", "Accounts & Brokers", "Alerts & Notifications", "Reports"],
    requiredFeatures: ["Risk status cards", "Account exposure", "Symbol exposure", "Daily drawdown", "Max drawdown", "Risk per trade", "Risk per basket", "Prop firm compliance", "Automatic stop trading trigger", "Emergency shutdown linkage"],
  },
  {
    title: "Accounts & Brokers",
    path: "/accounts-brokers",
    description: "Trading accounts, MT5 terminals, broker sessions, prop accounts, bridge settings, and sync health.",
    icon: Building2,
    color: "slate",
    roles: ["Super Administrator", "Administrator", "Portfolio Manager", "Trader"],
    submodules: [
      ["Trading Accounts", "trading-accounts"],
      ["MT5 Terminals", "mt5-terminals"],
      ["Broker Connections", "broker-connections"],
      ["Prop Firm Accounts", "prop-firm-accounts"],
      ["Account Sync Status", "sync-status"],
      ["Server Connection Logs", "server-logs"],
      ["API/Bridge Settings", "api-bridge"],
    ].map(toSubmodule("/accounts-brokers")),
    linkedModules: ["Trading Control Center", "Trade Execution", "Trade Management", "Risk Management", "System Monitoring", "User Management"],
    requiredFeatures: ["Add trading account", "Connect MT5 terminal", "Assign account to user", "View broker status", "View bridge heartbeat", "View account equity/balance/margin", "Validate demo/live/prop account"],
  },
  {
    title: "Strategy Management",
    path: "/strategy-management",
    description: "Strategy library, conditions, enablement, risk profile, symbol/timeframe mapping, and performance.",
    icon: SlidersHorizontal,
    color: "orange",
    roles: ["Super Administrator", "Administrator", "Portfolio Manager", "Analyst"],
    submodules: [
      ["Strategy Library", "library"],
      ["Scalping Strategies", "scalping"],
      ["Intraday Strategies", "intraday"],
      ["Swing Strategies", "swing"],
      ["Position Trading Strategies", "position-trading"],
      ["XAUUSD Priority Strategy", "xauusd-priority"],
      ["Strategy Conditions", "conditions"],
      ["Strategy Performance", "performance"],
      ["Strategy Enable/Disable", "enable-disable"],
    ].map(toSubmodule("/strategy-management")),
    linkedModules: ["AI Decision Engine", "Backtesting & Simulation", "Trade Execution", "Performance Analytics", "Reports", "Learning Center"],
    requiredFeatures: ["Strategy cards", "Enable/disable toggle", "Risk profile", "Symbol mapping", "Timeframe mapping", "Trading session mapping", "Strategy confidence score", "Performance score", "Backtest link", "Live trade link"],
  },
  {
    title: "Backtesting & Simulation",
    path: "/backtesting",
    description: "Historical validation, replay, forward testing, demo simulation, optimization, and test reports.",
    icon: Database,
    color: "pink",
    roles: ["Super Administrator", "Administrator", "Portfolio Manager", "Analyst"],
    submodules: [
      ["Backtest Dashboard", "dashboard"],
      ["Historical Data Manager", "historical-data"],
      ["Strategy Backtesting", "strategy"],
      ["Market Replay", "market-replay"],
      ["Forward Testing", "forward-testing"],
      ["Demo Simulation", "demo-simulation"],
      ["Optimization Results", "optimization"],
      ["Test Reports", "reports"],
    ].map(toSubmodule("/backtesting")),
    linkedModules: ["Strategy Management", "AI Decision Engine", "Performance Analytics", "Reports", "Learning Center"],
    requiredFeatures: ["Backtest result cards", "Equity curve", "Win rate", "Drawdown", "Symbol filter", "Timeframe filter", "Strategy filter", "Export report", "Push successful strategy to live validation"],
  },
  {
    title: "Performance Analytics",
    path: "/performance-analytics",
    description: "P/L, win rate, drawdown, symbol, strategy, session, trade duration, risk/reward, and equity analytics.",
    icon: LineChart,
    color: "blue",
    roles: allRoles,
    submodules: [
      ["Profit & Loss", "profit-loss"],
      ["Win/Loss Ratio", "win-loss"],
      ["Drawdown Analysis", "drawdown"],
      ["Symbol Performance", "symbols"],
      ["Strategy Performance", "strategies"],
      ["Session Performance", "sessions"],
      ["Trade Duration Analysis", "trade-duration"],
      ["Risk Reward Analysis", "risk-reward"],
      ["Equity Curve", "equity-curve"],
      ["Monthly Returns", "monthly-returns"],
    ].map(toSubmodule("/performance-analytics")),
    linkedModules: ["Trade Management", "Risk Management", "Strategy Management", "Reports", "Learning Center"],
    requiredFeatures: ["Charts", "KPIs", "Tables", "Filters", "Drill-down to trade", "Drill-down to strategy", "Drill-down to symbol", "Export analytics"],
  },
  {
    title: "Reports",
    path: "/reports",
    description: "Daily, weekly, monthly, trade, risk, broker, user activity, AI decision, and export reporting.",
    icon: FileBarChart,
    color: "lime",
    roles: allRoles,
    submodules: [
      ["Daily Trading Report", "daily"],
      ["Weekly Trading Report", "weekly"],
      ["Monthly Trading Report", "monthly"],
      ["Trade History Report", "trade-history"],
      ["Risk Report", "risk"],
      ["Broker Report", "broker"],
      ["User Activity Report", "user-activity"],
      ["AI Decision Report", "ai-decisions"],
      ["Export Center", "export-center"],
    ].map(toSubmodule("/reports")),
    linkedModules: ["Dashboard", "Trade Management", "Risk Management", "AI Decision Engine", "Accounts & Brokers", "Performance Analytics", "User Management"],
    requiredFeatures: ["PDF export", "Excel export", "CSV export", "Date filters", "Symbol filters", "User filters", "Account filters", "Strategy filters", "Print option", "Scheduled report option"],
  },
  {
    title: "Alerts & Notifications",
    path: "/alerts",
    description: "Trade, risk, profit lock, connection, news, drawdown, channel settings, and alert history.",
    icon: Bell,
    color: "rose",
    roles: allRoles,
    submodules: [
      ["Trade Alerts", "trade"],
      ["Risk Alerts", "risk"],
      ["Profit Lock Alerts", "profit-lock"],
      ["Connection Alerts", "connection"],
      ["News Alerts", "news"],
      ["Drawdown Alerts", "drawdown"],
      ["Email/SMS/Telegram Settings", "settings"],
      ["Alert History", "history"],
    ].map(toSubmodule("/alerts")),
    linkedModules: ["Trade Management", "Risk Management", "Market Intelligence", "Accounts & Brokers", "System Monitoring", "User Management"],
    requiredFeatures: ["Alert cards", "Severity labels", "Read/unread status", "Notification channels", "Escalation rules", "Alert timeline", "Link alert to source record"],
  },
  {
    title: "Learning Center",
    path: "/learning-center",
    description: "Trade journals, case studies, win/loss reviews, replay lessons, strategy lessons, AI explanations, and knowledge base.",
    icon: BookOpen,
    color: "purple",
    roles: allRoles,
    submodules: [
      ["AI Trade Journal", "trade-journal"],
      ["Trade Case Studies", "case-studies"],
      ["Winning Trade Reviews", "winning-trades"],
      ["Losing Trade Reviews", "losing-trades"],
      ["Market Replay Lessons", "market-replay"],
      ["Strategy Lessons", "strategy-lessons"],
      ["AI Decision Lessons", "ai-decisions"],
      ["Knowledge Base", "knowledge-base"],
      ["Training Materials", "training-materials"],
    ].map(toSubmodule("/learning-center")),
    linkedModules: ["AI Decision Engine", "Trade Management", "Backtesting & Simulation", "Strategy Management", "Performance Analytics"],
    requiredFeatures: ["Separate learning layout option", "Nested sidebar", "Trade lessons", "AI decision explanations", "Screenshot/chart attachment area", "Searchable knowledge base", "Tagging system", "Lesson categories", "Performance improvement recommendations"],
  },
  {
    title: "User Management",
    path: "/user-management",
    description: "Users, profiles, roles, permissions, account assignment, MT5 assignment, access matrix, and sessions.",
    icon: UserCog,
    color: "sky",
    roles: ["Super Administrator", "Administrator", "Compliance Officer"],
    submodules: [
      ["Users", "users"],
      ["User Profiles", "profiles"],
      ["Roles", "roles"],
      ["Permissions", "permissions"],
      ["Access Control Matrix", "access-matrix"],
      ["Account Assignment", "account-assignment"],
      ["MT5 Account Assignment", "mt5-assignment"],
      ["Login Sessions", "login-sessions"],
    ].map(toSubmodule("/user-management")),
    linkedModules: ["Accounts & Brokers", "Administration", "Security & Compliance", "Reports", "Administration"],
    requiredFeatures: ["Create user", "Edit user", "Disable user", "Assign role", "Assign account", "Assign MT5 terminal", "View user activity", "View login session", "Manage permissions"],
  },
  {
    title: "Administration",
    path: "/administration",
    description: "Global configuration, trading settings, risk settings, symbols, brokers, AI models, audit logs, security logs, and backup.",
    icon: MonitorCog,
    color: "zinc",
    roles: ["Super Administrator", "Administrator"],
    submodules: [
      ["System Settings", "system-settings"],
      ["Trading Settings", "trading-settings"],
      ["Risk Settings", "risk-settings"],
      ["Symbol Settings", "symbol-settings"],
      ["Broker Settings", "broker-settings"],
      ["AI Model Settings", "ai-model-settings"],
      ["Audit Logs", "audit-logs"],
      ["Security Logs", "security-logs"],
      ["Backup & Restore", "backup-restore"],
    ].map(toSubmodule("/administration")),
    linkedModules: ["Security & Compliance", "System Monitoring", "User Management"],
    requiredFeatures: ["Global configuration", "Module configuration", "Trading limits", "Risk settings", "Symbol enable/disable", "AI model settings", "Audit trail", "Backup and restore"],
  },
  {
    title: "Security & Compliance",
    path: "/security-compliance",
    description: "Authentication, password policy, MFA, RBAC, audit trail, compliance rules, prop firm checks, and data protection.",
    icon: LockKeyhole,
    color: "red",
    roles: ["Super Administrator", "Administrator", "Compliance Officer", "Risk Manager"],
    submodules: [
      ["Authentication Settings", "authentication"],
      ["Password Policy", "password-policy"],
      ["Two-Factor Authentication", "2fa"],
      ["Role-Based Access Control", "rbac"],
      ["Audit Trail", "audit-trail"],
      ["Compliance Rules", "rules"],
      ["Prop Firm Compliance", "prop-firm"],
      ["Data Protection", "data-protection"],
    ].map(toSubmodule("/security-compliance")),
    linkedModules: ["User Management", "Administration", "Risk Management", "Reports", "System Monitoring"],
    requiredFeatures: ["RBAC", "Permission checks", "Password rules", "Login activity", "Security logs", "Prop firm rule monitoring", "Compliance breach alerts"],
  },
  {
    title: "System Monitoring",
    path: "/system-monitoring",
    description: "Engine health, MT5 bridge, server health, latency, error logs, API logs, services, and uptime.",
    icon: Activity,
    color: "cyan",
    roles: ["Super Administrator", "Administrator", "Risk Manager", "Compliance Officer", "Portfolio Manager"],
    submodules: [
      ["Engine Health", "engine-health"],
      ["MT5 Bridge Health", "mt5-bridge"],
      ["Server Health", "server-health"],
      ["Latency Monitor", "latency"],
      ["Error Logs", "error-logs"],
      ["API Logs", "api-logs"],
      ["Background Services", "background-services"],
      ["Uptime Monitor", "uptime"],
    ].map(toSubmodule("/system-monitoring")),
    linkedModules: ["Trading Control Center", "Accounts & Brokers", "Trade Execution", "Alerts & Notifications", "Administration"],
    requiredFeatures: ["Health cards", "Real-time service status", "MT5 heartbeat", "API latency", "Error log table", "Service restart action", "Failure alert links"],
  },
];

export const platformIntegrations = [
  { label: ".NET 9 API", value: "Healthy", icon: Bot },
  { label: "SignalR", value: "Streaming", icon: Activity },
  { label: "SQL Server 2022", value: "14 ms", icon: Database },
  { label: "Redis Cache", value: "Ready", icon: CircleGauge },
  { label: "MT5 WebSocket", value: "Connected", icon: RadioTower },
  { label: "OpenTelemetry", value: "Tracing", icon: BarChart3 },
  { label: "QuestPDF", value: "Queued", icon: ClipboardList },
  { label: "MFA / Identity", value: "Enforced", icon: Scale },
];

export const navigationSections: NavigationSection[] = [
  {
    title: "Command",
    description: "Executive visibility and engine control",
    moduleTitles: ["Dashboard", "Trading Control Center"],
  },
  {
    title: "Market & AI Intelligence",
    description: "Signal discovery, institutional/retail analysis, and AI decisions",
    moduleTitles: ["Market Intelligence", "Institutional Engine", "Retail Engine", "AI Decision Engine"],
  },
  {
    title: "Trading Operations",
    description: "Execution, lifecycle management, risk, brokers, and strategies",
    moduleTitles: ["Trade Execution", "Trade Management", "Risk Management", "Accounts & Brokers", "Strategy Management"],
  },
  {
    title: "Research & Analytics",
    description: "Testing, analytics, reporting, alerts, and learning records",
    moduleTitles: ["Backtesting & Simulation", "Performance Analytics", "Reports", "Alerts & Notifications", "Learning Center"],
  },
  {
    title: "Platform Governance",
    description: "Users, administration, security, compliance, and monitoring",
    moduleTitles: ["User Management", "Administration", "Security & Compliance", "System Monitoring"],
  },
];

export function visibleModules(role: Role = activeRole) {
  return modules.filter((module) => module.roles.includes(role));
}

export function visibleNavigationSections(role: Role = activeRole) {
  const visible = visibleModules(role);

  return navigationSections
    .map((section) => ({
      ...section,
      modules: section.moduleTitles
        .map((title) => visible.find((module) => module.title === title))
        .filter((module): module is Module => Boolean(module)),
    }))
    .filter((section) => section.modules.length > 0);
}

export function findModuleByTitle(title: string) {
  return modules.find((module) => module.title === title || module.title.replace(" & Notifications", "") === title);
}

export function findPageByPath(path: string): ResolvedPage | undefined {
  const normalizedPath = path.replace(/\/$/, "") || "/dashboard";
  const module = modules.find((item) => item.path === normalizedPath || item.submodules.some((submodule) => submodule.path === normalizedPath));
  if (!module && normalizedPath.startsWith("/decision-workflow/")) {
    const decisionModule = modules.find((item) => item.title === "AI Decision Engine");
    if (!decisionModule) return undefined;

    return {
      module: decisionModule,
      submodule: {
        title: titleFromPath(normalizedPath),
        path: normalizedPath,
      },
      path: normalizedPath,
    };
  }

  if (!module) return undefined;

  return {
    module,
    submodule: module.submodules.find((submodule) => submodule.path === normalizedPath),
    path: normalizedPath,
  };
}

function toSubmodule(basePath: string) {
  return ([title, slug]: string[]): Submodule => ({
    title,
    path: `${basePath}/${slug}`,
  });
}

function titleFromPath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") ?? "Decision Workflow Detail";
}
