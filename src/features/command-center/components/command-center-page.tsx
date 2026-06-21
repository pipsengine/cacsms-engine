"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  AlertCircle,
  Archive,
  Bell,
  BookOpen,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Filter,
  Gauge,
  History,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  Menu,
  Network,
  MoreHorizontal,
  Pause,
  Play,
  Power,
  Printer,
  RadioTower,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Target,
  User,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  activeRole,
  findModuleByTitle,
  modules,
  platformIntegrations,
  type Module,
  type ResolvedPage,
  type Role,
  visibleModules,
  visibleNavigationSections,
  findPageByPath,
} from "@/features/command-center/config/navigation";

type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

const metrics = [
  { label: "Total Equity", value: "$248,920", delta: "+2.8%", tone: "success" as const },
  { label: "Balance", value: "$241,300", delta: "Synced", tone: "info" as const },
  { label: "Floating P/L", value: "+$7,620", delta: "12 open", tone: "success" as const },
  { label: "Daily P/L", value: "+$1,840", delta: "0.74%", tone: "success" as const },
  { label: "Open Trades", value: "12", delta: "4 symbols", tone: "warning" as const },
  { label: "AI Confidence", value: "86%", delta: "Hybrid mode", tone: "info" as const },
];

type LinkedRecord = {
  id: string;
  symbol: string;
  status: string;
  owner: string;
  risk: string;
  link: string;
};

const records: LinkedRecord[] = [
  { id: "tradeId TRD-1048", symbol: "XAUUSD", status: "Protected", owner: "AI Hybrid", risk: "0.8%", link: "/trade-management/open-trades" },
  { id: "decisionId DEC-8841", symbol: "EURUSD", status: "Awaiting Execution", owner: "AI Decision Engine", risk: "0.5%", link: "/ai-decision-engine/recommendations" },
  { id: "alertId ALT-3317", symbol: "GBPJPY", status: "News Risk", owner: "Risk Engine", risk: "High", link: "/alerts/news" },
  { id: "accountId ACC-2201", symbol: "FTMO-100K", status: "Compliant", owner: "Prop Account", risk: "3.1% DD", link: "/risk-management/prop-firm-rules" },
];

const timeline = [
  { title: "AI decision DEC-8841 approved", detail: "Institutional and retail confluence aligned on EURUSD.", time: "09:42" },
  { title: "MT5 bridge heartbeat received", detail: "C# WebSocket bridge acknowledged order routing channel.", time: "09:41" },
  { title: "Risk policy evaluated", detail: "Prop firm daily loss and correlation exposure passed.", time: "09:39" },
  { title: "Audit event AUD-9173 created", detail: "User action signed through ASP.NET Identity with MFA context.", time: "09:38" },
];

const workflowLinks = [
  { label: "Market opportunity", href: "/market-intelligence/watchlist" },
  { label: "AI validation", href: "/ai-decision-engine/entry-validation" },
  { label: "Execute order", href: "/trade-execution/order-setup" },
  { label: "Manage trade", href: "/trade-management/open-trades" },
  { label: "Risk review", href: "/risk-management/dashboard" },
  { label: "Report outcome", href: "/reports/daily" },
  { label: "Learning note", href: "/learning-center/trade-journal" },
];

const lifecycleStages = [
  { number: "01", name: "Market Intelligence", module: "Market Intelligence", submodules: 9, pages: 9, outputs: ["Market Bias", "Session Analysis", "Symbol Opportunities"], pageDetails: ["Market Overview", "Symbol Watchlist", "Multi-Timeframe", "Session Analysis", "Volatility", "Correlation", "News Impact", "Sentiment", "Fundamental"], status: "Designed", completion: 100, tone: "green", icon: Network },
  { number: "02", name: "Opportunity Detection", module: "AI Decision Engine", submodules: 2, pages: 2, outputs: ["AI Scanned Setups", "Opportunity Ranking"], pageDetails: ["Opportunity Scanner", "AI Recommendations"], status: "Designed", completion: 100, tone: "green", icon: Target },
  { number: "03", name: "AI Decision Engine", module: "AI Decision Engine", submodules: 8, pages: 8, outputs: ["Trade Recommendation", "Confidence Score", "Risk Assessment"], pageDetails: ["Opportunity Scanner", "Entry Validation", "Mode Selection", "Confidence Score", "Trade Reasoning", "Avoided Trades", "Recommendations", "Decision History"], status: "Designed", completion: 100, tone: "green", icon: Brain },
  { number: "04", name: "Trade Execution", module: "Trade Execution", submodules: 8, pages: 8, outputs: ["Orders", "Positions", "Broker Confirmation"], pageDetails: ["Symbol Selection", "Order Setup", "Market Orders", "Pending Orders", "Order Validation", "MT5 Routing", "Broker Logs", "Slippage & Spread"], status: "Designed", completion: 100, tone: "green", icon: RadioTower },
  { number: "05", name: "Trade Management", module: "Trade Management", submodules: 9, pages: 9, outputs: ["Open Trades", "Basket Monitoring", "Position Control"], pageDetails: ["Open Trades", "Basket Trades", "Position Monitoring", "Profit Lock", "Break-Even", "Trailing Stop", "Partial Close", "Exit Manager", "Closed Trades"], status: "Designed", completion: 100, tone: "green", icon: BriefcaseBusiness },
  { number: "06", name: "Risk Management", module: "Risk Management", submodules: 10, pages: 10, outputs: ["Exposure Monitoring", "Drawdown Control", "Compliance"], pageDetails: ["Risk Dashboard", "Daily Loss", "Weekly Loss", "Monthly Loss", "Drawdown", "Equity Protection", "Margin Protection", "Position Limits", "Correlation Exposure", "Prop Firm Rules"], status: "Designed", completion: 100, tone: "green", icon: ShieldCheck },
  { number: "07", name: "Profit Lock Engine", module: "Trade Management", submodules: 1, pages: 1, outputs: ["Locked Profit", "Dynamic Protection"], pageDetails: ["Profit Lock Manager"], status: "Designed", completion: 100, tone: "green", icon: Lock },
  { number: "08", name: "Exit Manager", module: "Trade Management", submodules: 2, pages: 2, outputs: ["Closed Trades", "Exit Decisions"], pageDetails: ["Exit Manager", "Closed Trades"], status: "Designed", completion: 100, tone: "green", icon: CheckCircle2 },
  { number: "09", name: "Performance Analytics", module: "Performance Analytics", submodules: 10, pages: 10, outputs: ["KPIs", "Performance Metrics"], pageDetails: ["Profit & Loss", "Win/Loss", "Drawdown", "Symbols", "Strategies", "Sessions", "Trade Duration", "Risk Reward", "Equity Curve", "Monthly Returns"], status: "Designed", completion: 100, tone: "green", icon: Gauge },
  { number: "10", name: "Reporting Engine", module: "Reports", submodules: 9, pages: 9, outputs: ["Reports", "Exports"], pageDetails: ["Daily Report", "Weekly Report", "Monthly Report", "Trade History", "Risk Report", "Broker Report", "User Activity", "AI Decisions", "Export Center"], status: "Designed", completion: 100, tone: "green", icon: FileSpreadsheet },
  { number: "11", name: "Alert Engine", module: "Alerts & Notifications", submodules: 8, pages: 8, outputs: ["Notifications", "Risk Alerts"], pageDetails: ["Trade Alerts", "Risk Alerts", "Profit Lock", "Connection", "News", "Drawdown", "Channel Settings", "Alert History"], status: "Designed", completion: 100, tone: "green", icon: Bell },
  { number: "12", name: "Learning Center", module: "Learning Center", submodules: 9, pages: 9, outputs: ["Trade Lessons", "AI Explanations"], pageDetails: ["Trade Journal", "Case Studies", "Winning Trades", "Losing Trades", "Market Replay", "Strategy Lessons", "AI Decisions", "Knowledge Base", "Training Materials"], status: "Testing", completion: 70, tone: "orange", icon: BookOpen },
  { number: "13", name: "Audit Trail", module: "Administration / Security", submodules: 4, pages: 4, outputs: ["Audit Records", "Compliance Logs"], pageDetails: ["Admin Audit Logs", "Security Logs", "Security Audit Trail", "Compliance Rules"], status: "Blocked", completion: 10, tone: "red", icon: ClipboardCheck },
];

const traceabilityRecords = ["Trade ID", "Decision ID", "Order ID", "Position ID", "Close ID", "Report ID", "Lesson ID", "Audit ID"];

const supportServices = [
  { name: "Accounts & Brokers", count: 7, completion: 100, items: ["Trading Accounts", "MT5 Terminals", "Broker Connections"], tone: "slate" },
  { name: "Strategy Management", count: 9, completion: 100, items: ["Strategy Library", "Strategy Conditions", "Performance"], tone: "orange" },
  { name: "Backtesting & Simulation", count: 8, completion: 90, items: ["Backtest Dashboard", "Market Replay", "Optimization"], tone: "pink" },
  { name: "User Management", count: 8, completion: 95, items: ["Users", "Roles", "Permissions"], tone: "sky" },
  { name: "Administration", count: 9, completion: 85, items: ["System Settings", "Trading Settings"], tone: "zinc" },
  { name: "Security & Compliance", count: 8, completion: 80, items: ["Authentication", "RBAC", "Audit Controls"], tone: "red" },
  { name: "System Monitoring", count: 8, completion: 90, items: ["MT5 Bridge Health", "API Monitoring", "Logs"], tone: "cyan" },
  { name: "Data Management", count: 4, completion: 75, items: ["SQL Server", "Redis", "Backup", "Synchronization"], tone: "blue" },
];

const designPrinciples = [
  { title: "Full Traceability", detail: "Every lifecycle record remains linked end to end.", icon: Network },
  { title: "Data Integrity", detail: "Shared identifiers keep records consistent.", icon: Archive },
  { title: "Real-Time Visibility", detail: "SignalR-ready status surfaces update live.", icon: RefreshCw },
  { title: "Risk Controlled", detail: "Risk checks are embedded before execution.", icon: ShieldAlert },
  { title: "Audit Ready", detail: "Actions produce reviewable compliance history.", icon: ClipboardCheck },
  { title: "Learning Driven", detail: "Outcomes feed lessons and AI explanations.", icon: BookOpen },
  { title: "Performance Focused", detail: "KPIs and analytics close the feedback loop.", icon: Sparkles },
  { title: "Modular & Scalable", detail: "Services can evolve independently.", icon: SlidersHorizontal },
];

type DecisionStatus = "Not Started" | "Pending" | "In Progress" | "Completed";

type DecisionStage = {
  number: string;
  title: string;
  route: string;
  module: string;
  description: string;
  actionsLabel: string;
  actions: string[];
  output: string;
  status: DecisionStatus;
  progress: number;
};

type DecisionPhase = {
  title: string;
  goal: string;
  input?: string;
  output: string;
  stages: DecisionStage[];
};

const approvedTradingSymbols = ["GBPUSD", "EURUSD", "AUDUSD", "USDJPY", "GBPJPY", "EURJPY", "USDCAD", "XAUUSD", "US30", "SP500", "NASDAQ100"];

const decisionPhases: DecisionPhase[] = [
  {
    title: "Phase 1: Market Intelligence & Analysis",
    goal: "Identify high-probability opportunities across the selected trading universe.",
    output: "Potential Trade Setup Identified",
    stages: [
      { number: "01", title: "Trading Mode Selection", route: "/decision-workflow/trading-mode-selection", module: "Trading Control Center", description: "Select and validate the active trading mode before analysis begins.", actionsLabel: "Modes / Actions", actions: ["Institutional Mode", "Retail Mode", "Hybrid Mode", "Auto Mode", "Validate enabled mode", "Confirm permission", "Log mode selection"], output: "Active Trading Mode", status: "Completed", progress: 100 },
      { number: "02", title: "Symbol Selection", route: "/decision-workflow/symbol-selection", module: "Symbol Selection Engine", description: "Scan the approved symbol universe and select the candidate symbol.", actionsLabel: "Actions", actions: ["Scan approved 11 symbols", "Filter eligible candidates", "Prioritize XAUUSD", "Select candidate symbol"], output: "Candidate Symbol", status: "Completed", progress: 100 },
      { number: "03", title: "Symbol Eligibility Check", route: "/decision-workflow/symbol-eligibility", module: "Symbol Eligibility Engine", description: "Confirm the candidate symbol can be traded under live account constraints.", actionsLabel: "Checks", actions: ["Market open", "Spread acceptable", "Volatility acceptable", "News restriction", "Daily symbol limit", "Basket exposure", "Prop firm restriction", "Risk permission"], output: "Eligible or Not Eligible", status: "Completed", progress: 100 },
      { number: "04", title: "Symbol Classification", route: "/decision-workflow/symbol-classification", module: "Symbol Classification Engine", description: "Classify symbol type and apply trading-style restrictions.", actionsLabel: "Classification / Rules", actions: ["Forex", "Commodity", "Index", "XAUUSD scalping-enabled", "Indices: US30, SP500, NASDAQ100", "Others: Forex"], output: "Symbol Category and Trading Rule", status: "Completed", progress: 100 },
      { number: "05", title: "Analysis Path Selection", route: "/decision-workflow/analysis-path-selection", module: "Analysis Router", description: "Route the opportunity through institutional, retail, hybrid, or auto analysis.", actionsLabel: "Paths / Rules", actions: ["Institutional Path", "Retail Path", "Hybrid Path", "Auto selects dynamically", "Hybrid uses confluence"], output: "Selected Analysis Framework", status: "Completed", progress: 100 },
      { number: "06A", title: "Institutional Analysis", route: "/decision-workflow/institutional-analysis", module: "Institutional Engine", description: "Run smart-money and institutional setup checks.", actionsLabel: "Checks", actions: ["Liquidity analysis", "Order blocks", "Fair value gaps", "Stop hunts", "Market structure", "Smart money concepts", "Institutional bias"], output: "Institutional Setup", status: "Completed", progress: 100 },
      { number: "06B", title: "Retail Analysis", route: "/decision-workflow/retail-analysis", module: "Retail Engine", description: "Run retail technical-analysis and timing checks.", actionsLabel: "Checks", actions: ["Top-down analysis", "Support and resistance", "Trend direction", "Candlestick confirmation", "Pullback detection", "Multi-timeframe bias", "Entry timing"], output: "Retail Setup", status: "Completed", progress: 100 },
      { number: "06C", title: "Hybrid Confluence", route: "/decision-workflow/hybrid-confluence", module: "Hybrid Confluence Engine", description: "Merge institutional and retail evidence into a single confluence score.", actionsLabel: "Checks", actions: ["Institutional bias", "Retail bias", "Multi-timeframe confluence", "Entry timing", "Risk/reward check", "Session alignment"], output: "Hybrid Setup", status: "In Progress", progress: 65 },
      { number: "07", title: "Opportunity Detection", route: "/decision-workflow/opportunity-detection", module: "Opportunity Scanner", description: "Detect, rank, and pass a potential setup into validation.", actionsLabel: "Detection / Actions", actions: ["Buy opportunity", "Sell opportunity", "Watchlist setup", "Detect valid setup", "Rank opportunity", "Assign confidence", "Pass to validation"], output: "Potential Trade Setup", status: "Pending", progress: 20 },
    ],
  },
  {
    title: "Phase 2: Decision Intelligence",
    goal: "Validate opportunity, assess risk, and generate AI trading decision.",
    input: "Potential Trade Setup Identified",
    output: "Open Position or No-Trade Log",
    stages: [
      { number: "08", title: "Opportunity Validation", route: "/decision-workflow/opportunity-validation", module: "Opportunity Validation Engine", description: "Validate market structure, timing, and event risk before decisioning.", actionsLabel: "Checks", actions: ["Market structure", "Pullback or retracement", "Candle confirmation", "Volume confirmation", "Session timing", "Spread check", "News impact", "Entry timing"], output: "Valid Setup or Rejected Setup", status: "Completed", progress: 100 },
      { number: "09", title: "Risk Assessment", route: "/decision-workflow/risk-assessment", module: "Risk Engine", description: "Score the setup against position, drawdown, margin, and exposure rules.", actionsLabel: "Checks", actions: ["Position size", "Risk percentage", "Drawdown impact", "Margin impact", "Correlation exposure", "Basket exposure", "Account exposure"], output: "Risk Score", status: "Completed", progress: 100 },
      { number: "10", title: "AI Decision Engine", route: "/decision-workflow/ai-decision-engine", module: "AI Decision Engine", description: "Generate the formal AI decision record and trade intent.", actionsLabel: "Decision Record", actions: ["BUY / SELL / WAIT", "NO TRADE / REJECTED", "Selected mode", "Selected symbol", "Trading style", "Confidence score", "Risk score", "Direction", "Reason", "Holding time", "Strategy used", "Entry timing reason"], output: "AI Decision", status: "In Progress", progress: 70 },
      { number: "11", title: "Risk Approval", route: "/decision-workflow/risk-approval", module: "Risk Approval Engine", description: "Approve or block the decision using account and prop-firm guardrails.", actionsLabel: "Checks", actions: ["Daily loss limit", "Weekly loss limit", "Monthly loss limit", "Drawdown limit", "Account exposure", "Margin level", "Basket limit", "Prop firm rules"], output: "Approved or Blocked", status: "In Progress", progress: 60 },
      { number: "12", title: "Execution Approval", route: "/decision-workflow/execution-approval", module: "Execution Approval Engine", description: "Confirm broker, MT5, spread, order, and account readiness.", actionsLabel: "Checks", actions: ["MT5 connection", "Broker status", "Spread condition", "Slippage tolerance", "Order type", "Lot size", "Stop loss", "Take profit", "Account mode"], output: "Ready, Wait, or Cancel", status: "In Progress", progress: 50 },
      { number: "13", title: "Trade Execution / No-Trade Log", route: "/decision-workflow/trade-execution", module: "Trade Execution Engine", description: "Execute approved orders or preserve rejected decisions for learning and audit.", actionsLabel: "If Approved / Not Approved", actions: ["Place market, limit, or stop order", "Route order to MT5", "Confirm broker response", "Generate order ID", "Generate position ID", "Log no-trade reason", "Save rejected decision", "Send to learning and audit"], output: "Order Executed or No-Trade Logged", status: "Pending", progress: 10 },
    ],
  },
  {
    title: "Phase 3: Trade Management",
    goal: "Manage open positions, protect capital and lock profits.",
    input: "Open Position",
    output: "Protected Position / Closed Trade",
    stages: [
      { number: "14", title: "Trade Monitoring", route: "/decision-workflow/trade-monitoring", module: "Trade Management Engine", description: "Track live position health and market context after execution.", actionsLabel: "Tracks", actions: ["Floating profit/loss", "Price movement", "Candle direction", "Basket exposure", "Spread change", "News impact", "Position health"], output: "Live Position Status", status: "Completed", progress: 100 },
      { number: "15", title: "Profit Lock Engine", route: "/decision-workflow/profit-lock", module: "Profit Protection Engine", description: "Protect profitable trades with configurable and dynamic profit locks.", actionsLabel: "Actions / Examples", actions: ["Break-even protection", "Profit lock levels", "Dynamic trailing stop", "Partial close", "Basket profit lock", "Equity protection", "+10", "+20", "+50", "+100", "Dynamic lock"], output: "Locked Profit", status: "Completed", progress: 100 },
      { number: "16", title: "Risk Control", route: "/decision-workflow/risk-control", module: "Risk Control Engine", description: "Reduce exposure and protect the account when risk conditions change.", actionsLabel: "Actions", actions: ["Exposure reduction", "Partial close", "Basket control", "Drawdown protection", "Emergency exit", "Risk-based position reduction"], output: "Risk Protected", status: "In Progress", progress: 60 },
      { number: "17", title: "Exit Decision", route: "/decision-workflow/exit-decision", module: "Exit Manager", description: "Determine whether position closure is required by profit, risk, or market logic.", actionsLabel: "Exit Triggers", actions: ["Take profit hit", "Stop loss hit", "AI exit signal", "Profit lock exit", "Risk rule exit", "Session close", "Reversal signal"], output: "Exit Decision", status: "In Progress", progress: 40 },
      { number: "18", title: "Trade Closure", route: "/decision-workflow/trade-closure", module: "Trade Closure Engine", description: "Close the position and update trade/account records.", actionsLabel: "Actions", actions: ["Close position", "Confirm broker closure", "Update records", "Calculate profit/loss", "Update account equity"], output: "Closed Trade", status: "Pending", progress: 15 },
    ],
  },
  {
    title: "Phase 4: Knowledge & Governance",
    goal: "Analyze performance, generate reports, document learning, and ensure traceability.",
    input: "Closed Trade",
    output: "Insights, Reports, Learning Records, and Audit Records",
    stages: [
      { number: "19", title: "Performance Analytics", route: "/decision-workflow/performance-analytics", module: "Performance Analytics Engine", description: "Measure trade, strategy, symbol, and session performance after closure.", actionsLabel: "Analytics", actions: ["Trade metrics", "Win/loss analysis", "Equity curve", "Strategy performance", "Symbol performance", "Session performance"], output: "Performance Report", status: "In Progress", progress: 45 },
      { number: "20", title: "Learning Center", route: "/decision-workflow/learning-center", module: "Learning Center", description: "Document AI explanations, decisions, outcomes, and lessons learned.", actionsLabel: "Documents", actions: ["Why trade was taken", "Why trade was rejected", "Why profit was locked", "Why trade was closed", "Lessons learned", "AI explanations"], output: "Trade Lessons", status: "In Progress", progress: 35 },
      { number: "21", title: "Report Generation", route: "/decision-workflow/report-generation", module: "Reporting Engine", description: "Generate scheduled and ad hoc reports with export formats.", actionsLabel: "Reports / Exports", actions: ["Daily report", "Weekly report", "Monthly report", "Custom report", "Export data", "PDF", "Excel", "CSV"], output: "Reports and Exports", status: "Pending", progress: 20 },
      { number: "22", title: "Audit Trail", route: "/decision-workflow/audit-trail", module: "Audit Engine", description: "Record the complete evidence chain for compliance and accountability.", actionsLabel: "Logs", actions: ["Mode and symbol", "AI decisions", "Risk approvals", "Executions", "User/system actions", "Timestamps", "Compliance logs", "Account records", "Broker response"], output: "Audit Records", status: "Not Started", progress: 0 },
    ],
  },
];

const decisionSupportingServices = [
  { name: "Accounts & Brokers", route: "/accounts-brokers", submodules: ["Trading Accounts", "MT5 Terminals", "Broker Connections", "Account Sync"], status: "Completed" as DecisionStatus, progress: 100 },
  { name: "Strategy Management", route: "/strategy-management", submodules: ["Strategy Library", "Strategy Conditions", "Performance Tracking", "Strategy Allocation"], status: "In Progress" as DecisionStatus, progress: 90 },
  { name: "Backtesting & Simulation", route: "/backtesting", submodules: ["Backtest Dashboard", "Market Replay", "Optimization", "Walk-Forward Testing"], status: "In Progress" as DecisionStatus, progress: 70 },
  { name: "User Management", route: "/user-management", submodules: ["Users & Profiles", "Roles & Permissions", "Account Assignment", "Login Sessions"], status: "Completed" as DecisionStatus, progress: 100 },
  { name: "Administration", route: "/administration", submodules: ["System Settings", "Trading Settings", "Risk Settings", "Global Controls"], status: "In Progress" as DecisionStatus, progress: 80 },
  { name: "Security & Compliance", route: "/security-compliance", submodules: ["Authentication & MFA", "RBAC & Permissions", "Compliance Rules", "Audit Trail"], status: "In Progress" as DecisionStatus, progress: 75 },
  { name: "System Monitoring", route: "/system-monitoring", submodules: ["MT5 Bridge Health", "API Monitoring", "Latency & Errors", "System Logs"], status: "In Progress" as DecisionStatus, progress: 85 },
  { name: "Data Management", route: "/data-management", submodules: ["SQL Server", "Redis Cache", "Backup & Restore", "Data Synchronization"], status: "In Progress" as DecisionStatus, progress: 60 },
];

const sharedDecisionIdentifiers = ["modeId", "symbolId", "setupId", "decisionId", "riskAssessmentId", "approvalId", "orderId", "positionId", "closeId", "reportId", "lessonId", "auditId", "accountId", "userId", "strategyId"];
const learningLoop = ["Audit Trail", "Learning Center", "AI Model Improvement", "Strategy Optimization", "Knowledge Feedback", "Market Intelligence"];

const projectStatusSummary = [
  { label: "Total Stages", count: 22, percent: 100, description: "All Workflow Stages", status: "Total", icon: Archive },
  { label: "Completed", count: 12, percent: 54.5, description: "Stages fully completed and verified", status: "Completed", icon: CheckCircle2 },
  { label: "In Progress", count: 6, percent: 27.3, description: "Stages currently under development", status: "In Progress", icon: RefreshCw },
  { label: "Pending", count: 3, percent: 13.6, description: "Awaiting implementation", status: "Pending", icon: Clock },
  { label: "Not Started", count: 1, percent: 4.6, description: "No development activity yet", status: "Not Started", icon: Play },
];

const projectStatusLegend = [
  { label: "Completed", rule: "100%", description: "Stage completed and verified", status: "Completed", icon: CheckCircle2 },
  { label: "In Progress", rule: "25%-99%", description: "Work actively progressing", status: "In Progress", icon: RefreshCw },
  { label: "Pending", rule: "1%-24%", description: "Awaiting action or dependency", status: "Pending", icon: Clock },
  { label: "Not Started", rule: "0%", description: "No work initiated", status: "Not Started", icon: Play },
];

const progressTrendPoints = [42, 48, 53, 58, 63, 68, 72];

export function CommandCenterPage({ path }: { path: string }) {
  const page = findPageByPath(path);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [engineRunning, setEngineRunning] = useState(true);
  const [activeTab, setActiveTab] = useState("Operations");

  if (!page) {
    return null;
  }

  const title = page.submodule?.title ?? page.module.title;
  const description = page.submodule
    ? `${page.module.description} This workspace focuses on ${page.submodule.title.toLowerCase()} and links related records across the command center.`
    : page.module.description;

  const linkedModules = page.module.linkedModules
    .map(findModuleByTitle)
    .filter((module): module is Module => Boolean(module));

  const pageRecords = useMemo(() => {
    return records.map((record, index) => ({
      ...record,
      status: index === 1 && page.module.title === "AI Decision Engine" ? "Ready to Execute" : record.status,
    }));
  }, [page.module.title]);

  const isLifecycleStatusPage = page.path === "/dashboard/trade-lifecycle-status";
  const isDecisionStatusWorkflowPage = page.path === "/dashboard/ai-decision-status-workflow";

  return (
    <AppLayout
      collapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
      topbar={<Topbar engineRunning={engineRunning} onToggleEngine={() => setEngineRunning((value) => !value)} onOpenDrawer={() => setDrawerOpen(true)} />}
      sidebar={<Sidebar collapsed={sidebarCollapsed} currentPath={page.path} onToggle={() => setSidebarCollapsed((value) => !value)} />}
    >
      {isLifecycleStatusPage ? (
        <LifecycleStatusBoard page={page} />
      ) : isDecisionStatusWorkflowPage ? (
        <DecisionStatusWorkflowBoard page={page} />
      ) : (
        <>
          <Breadcrumbs page={page} />
          <PageHeader
            module={page.module}
            title={title}
            description={description}
            onOpenDrawer={() => setDrawerOpen(true)}
            onConfirm={() => setConfirmOpen(true)}
          />

          <section className="status-strip" aria-label="Platform integrations">
            {platformIntegrations.map((integration) => (
              <StatusPill key={integration.label} icon={integration.icon} label={integration.label} value={integration.value} />
            ))}
          </section>

          <section className="metric-grid">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </section>

          <section className="content-grid">
            <div className="main-stack">
              <FilterPanel />
              <Tabs activeTab={activeTab} onChange={setActiveTab} tabs={["Operations", "Records", "Analytics", "Audit Trail"]} />
              {activeTab === "Operations" && <OperationsPanel module={page.module} />}
              {activeTab === "Records" && <DataTable records={pageRecords} />}
              {activeTab === "Analytics" && <ChartPanel module={page.module} />}
              {activeTab === "Audit Trail" && <Timeline />}
            </div>

            <aside className="side-stack">
              <LinkedRecordPanel modules={linkedModules} fallback={page.module} />
              <QuickActions module={page.module} onOpenDrawer={() => setDrawerOpen(true)} onConfirm={() => setConfirmOpen(true)} />
              <StatePanels />
            </aside>
          </section>
        </>
      )}

      <DetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} module={page.module} title={title} />
      <ConfirmModal open={confirmOpen} onClose={() => setConfirmOpen(false)} module={page.module} />
    </AppLayout>
  );
}

function AppLayout({
  children,
  sidebar,
  topbar,
  collapsed,
  onToggleSidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  collapsed: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <div className={clsx("app-shell", collapsed && "sidebar-collapsed")}>
      {sidebar}
      <div className="workspace">
        <div className="mobile-toggle">
          <button className="icon-button" onClick={onToggleSidebar} aria-label="Toggle sidebar">
            <Menu size={18} />
          </button>
        </div>
        {topbar}
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ collapsed, currentPath, onToggle }: { collapsed: boolean; currentPath: string; onToggle: () => void }) {
  const sections = visibleNavigationSections(activeRole);

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">CE</div>
        {!collapsed && (
          <div>
            <strong>Cacsms Engine</strong>
            <span>Trading Command Center</span>
          </div>
        )}
        <button className="sidebar-collapse-button" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronDown className="collapse-left-icon" size={17} />}
        </button>
      </div>
      <nav className="sidebar-nav" aria-label="Primary modules">
        {sections.map((section) => (
          <SidebarSection key={section.title} section={section} currentPath={currentPath} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
}

function SidebarSection({
  section,
  currentPath,
  collapsed,
}: {
  section: ReturnType<typeof visibleNavigationSections>[number];
  currentPath: string;
  collapsed: boolean;
}) {
  const active = section.modules.some((module) => currentPath === module.path || currentPath.startsWith(`${module.path}/`));
  const [open, setOpen] = useState(active || section.title === "Command");
  const pageCount = section.modules.reduce((sum, module) => sum + module.submodules.length, 0);

  if (collapsed) {
    return (
      <div className="sidebar-section collapsed-section">
        {section.modules.map((module) => (
          <SidebarGroup key={module.path} module={module} currentPath={currentPath} collapsed={collapsed} />
        ))}
      </div>
    );
  }

  return (
    <section className={clsx("sidebar-section", active && "active")}>
      <button className="section-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>
          <strong>{section.title}</strong>
          <small>{section.description}</small>
        </span>
        <em>{section.modules.length}/{pageCount}</em>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {open && (
        <div className="section-branches">
          {section.modules.map((module) => (
            <SidebarGroup key={module.path} module={module} currentPath={currentPath} collapsed={collapsed} />
          ))}
        </div>
      )}
    </section>
  );
}

function SidebarGroup({ module, currentPath, collapsed }: { module: Module; currentPath: string; collapsed: boolean }) {
  const [open, setOpen] = useState(currentPath.startsWith(module.path));
  const Icon = module.icon;
  const active = currentPath === module.path || currentPath.startsWith(`${module.path}/`);

  return (
    <div className="sidebar-group">
      <div className={clsx("sidebar-row", active && "active")}>
        <Link href={module.path} className="sidebar-link" title={module.title}>
          <span className={clsx("tree-node-icon", `node-${module.color}`)}>
            <Icon size={16} />
          </span>
          {!collapsed && (
            <span className="tree-node-label">
              <span>{module.title}</span>
              <small>{module.submodules.length} pages</small>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button className="sidebar-expander" onClick={() => setOpen((value) => !value)} aria-label={`Toggle ${module.title}`}>
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        )}
      </div>
      {!collapsed && open && (
        <div className="sidebar-subitems">
          {module.submodules.map((submodule, index) => (
            <Link key={submodule.path} className={clsx("sidebar-subitem", currentPath === submodule.path && "active")} href={submodule.path}>
              <span>{index + 1}</span>
              <strong>{submodule.title}</strong>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Topbar({
  engineRunning,
  onToggleEngine,
  onOpenDrawer,
}: {
  engineRunning: boolean;
  onToggleEngine: () => void;
  onOpenDrawer: () => void;
}) {
  return (
    <header className="topbar">
      <SearchInput />
      <div className="topbar-actions">
        <EngineHeaderControl running={engineRunning} onToggle={onToggleEngine} />
        <StatusBadge tone={engineRunning ? "success" : "warning"}>{engineRunning ? "System Online" : "Engine Paused"}</StatusBadge>
        <StatusBadge tone="success">MT5 Connected</StatusBadge>
        <StatusBadge tone="info">Prop Account</StatusBadge>
        <button className="icon-button" aria-label="Notifications" onClick={onOpenDrawer}>
          <Bell size={18} />
          <span className="notification-dot" />
        </button>
        <button className="profile-button" aria-label="User profile">
          <User size={18} />
          <span>Super Admin</span>
          <ChevronDown size={15} />
        </button>
      </div>
    </header>
  );
}

function EngineHeaderControl({ running, onToggle }: { running: boolean; onToggle: () => void }) {
  return (
    <div className={clsx("engine-header-control", running ? "running" : "stopped")} aria-label="Trading engine control">
      <span>
        <strong>Trading Engine</strong>
        <small>{running ? "Live automation active" : "Automation stopped"}</small>
      </span>
      <button className={clsx("button", running ? "button-danger" : "button-primary")} onClick={onToggle}>
        {running ? <Pause size={16} /> : <Play size={16} />}
        {running ? "Stop" : "Start"}
      </button>
    </div>
  );
}

function SearchInput() {
  return (
    <label className="search-input">
      <Search size={18} />
      <input placeholder="Search tradeId, decisionId, symbolId, accountId, alertId..." />
    </label>
  );
}

function Breadcrumbs({ page }: { page: ResolvedPage }) {
  return (
    <div className="breadcrumbs">
      <Link href="/dashboard">Dashboard</Link>
      <ChevronRight size={14} />
      <Link href={page.module.path}>{page.module.title}</Link>
      {page.submodule && (
        <>
          <ChevronRight size={14} />
          <span>{page.submodule.title}</span>
        </>
      )}
    </div>
  );
}

function PageHeader({
  module,
  title,
  description,
  onOpenDrawer,
  onConfirm,
}: {
  module: Module;
  title: string;
  description: string;
  onOpenDrawer: () => void;
  onConfirm: () => void;
}) {
  const Icon = module.icon;
  return (
    <section className="page-header">
      <div className={clsx("module-icon", `tone-${module.color}`)}>
        <Icon size={24} />
      </div>
      <div className="page-title-block">
        <p className="eyebrow">Cacsms Engine</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="header-actions">
        <ExportButton />
        <ActionButton icon={Eye} label="Open Context" onClick={onOpenDrawer} variant="secondary" />
        <ActionButton icon={ShieldAlert} label="Emergency Review" onClick={onConfirm} variant="danger" />
      </div>
    </section>
  );
}

function LifecycleStatusBoard({ page }: { page: ResolvedPage }) {
  const statusSummary = [
    { label: "Total Stages", value: lifecycleStages.length, tone: "neutral" as StatusTone },
    { label: "Designed", value: lifecycleStages.filter((stage) => stage.status === "Designed").length, tone: "success" as StatusTone },
    { label: "In Development", value: 0, tone: "info" as StatusTone },
    { label: "Testing", value: lifecycleStages.filter((stage) => stage.status === "Testing").length, tone: "warning" as StatusTone },
    { label: "Pending", value: 0, tone: "neutral" as StatusTone },
    { label: "Blocked", value: lifecycleStages.filter((stage) => stage.status === "Blocked").length, tone: "danger" as StatusTone },
  ];

  return (
    <div className="lifecycle-board">
      <Breadcrumbs page={page} />
      <section className="lifecycle-hero">
        <div>
          <p className="eyebrow">Cacsms Engine</p>
          <h1>END-TO-END TRADE LIFECYCLE TRACEABILITY</h1>
          <p>
            Track every trade from Market Intelligence to Audit Trail with complete transparency, traceability, accountability, and lifecycle monitoring.
          </p>
        </div>
        <div className="design-summary-grid">
          {statusSummary.map((item) => (
            <article key={item.label} className="design-summary-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
            </article>
          ))}
        </div>
      </section>

      <section className="architecture-panel">
        <div className="architecture-heading">
          <div>
            <h2>Design Status Workflow</h2>
            <p>Horizontal lifecycle architecture spanning market signal, execution, monitoring, reporting, learning, and audit readiness.</p>
          </div>
          <StatusBadge tone="success">Enterprise Architecture Board</StatusBadge>
        </div>
        <div className="lifecycle-stage-scroll">
          <div className="lifecycle-stage-lane">
            {lifecycleStages.map((stage, index) => (
              <LifecycleStageCard key={stage.number} stage={stage} showArrow={index < lifecycleStages.length - 1} />
            ))}
          </div>
        </div>
      </section>

      <section className="traceability-strip">
        <div className="architecture-heading">
          <div>
            <h2>Traceability Layer</h2>
            <p>Shared identifiers connect every lifecycle event into one reviewable evidence chain.</p>
          </div>
        </div>
        <div className="traceability-chain">
          {traceabilityRecords.map((record, index) => (
            <div className="traceability-node-wrap" key={record}>
              <div className="traceability-node">
                <span>{index + 1}</span>
                <strong>{record}</strong>
              </div>
              {index < traceabilityRecords.length - 1 && <ChevronRight size={18} />}
            </div>
          ))}
        </div>
      </section>

      <section className="architecture-panel">
        <div className="architecture-heading">
          <div>
            <h2>Supporting Services Layer</h2>
            <p>Platform services run horizontally across all stages and keep execution governed, observable, and recoverable.</p>
          </div>
        </div>
        <div className="service-card-grid">
          {supportServices.map((service) => (
            <SupportServiceCard key={service.name} service={service} />
          ))}
        </div>
      </section>

      <section className="principles-grid">
        {designPrinciples.map((principle) => (
          <article key={principle.title} className="principle-card">
            <principle.icon size={20} />
            <strong>{principle.title}</strong>
            <span>{principle.detail}</span>
          </article>
        ))}
      </section>
    </div>
  );
}

function DecisionStatusWorkflowBoard({ page }: { page: ResolvedPage }) {
  return (
    <div className="decision-workflow-board">
      <Breadcrumbs page={page} />
      <OverallProjectStatusDashboard />

      <section className="decision-universe-panel">
        <div>
          <h2>Trading Universe</h2>
          <p>Only approved trading symbols are eligible. XAUUSD is the only symbol allowed for scalping; all others are intraday and swing only.</p>
        </div>
        <div className="symbol-chip-grid">
          {approvedTradingSymbols.map((symbol) => (
            <span key={symbol} className={symbol === "XAUUSD" ? "scalp-symbol" : undefined}>
              {symbol}
              {symbol === "XAUUSD" && <strong>SCALP ONLY</strong>}
            </span>
          ))}
        </div>
      </section>

      <section className="decision-phase-flow" id="workflow">
        {decisionPhases.map((phase, index) => (
          <div className="decision-phase-wrap" key={phase.title}>
            <DecisionPhasePanel phase={phase} index={index} />
            {index < decisionPhases.length - 1 && (
              <div className="phase-output-bar">
                <span>{phase.title.split(":")[0]} output</span>
                <strong>{phase.output}</strong>
                <ChevronRight size={18} />
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="learning-loop-panel">
        <div>
          <h2>Continuous Learning Loop</h2>
          <p>Improves future decisions, model behavior, strategy ranking, risk protection, symbol selection, and entry timing.</p>
        </div>
        <div className="learning-loop-chain">
          {learningLoop.map((item, index) => (
            <div key={item} className="learning-loop-item">
              <span>{item}</span>
              {index < learningLoop.length - 1 && <ChevronRight size={18} />}
            </div>
          ))}
        </div>
      </section>

      <section className="decision-services-panel">
        <div className="architecture-heading">
          <div>
            <h2>Supporting Services</h2>
            <p>Parallel platform modules running across all decision workflow phases.</p>
          </div>
        </div>
        <div className="decision-services-grid">
          {decisionSupportingServices.map((service) => (
            <Link key={service.name} href={service.route} className={clsx("decision-service-card", statusClass(service.status))}>
              <div>
                <h3>{service.name}</h3>
                <StatusBadge tone={statusToneFromDecision(service.status)}>{service.status.toUpperCase()}</StatusBadge>
              </div>
              <div className="decision-service-submodules">
                {service.submodules.map((submodule) => (
                  <span key={submodule}>{submodule}</span>
                ))}
              </div>
              <ProgressLine status={service.status} progress={service.progress} />
            </Link>
          ))}
        </div>
      </section>

      <section className="identifier-panel">
        <h2>Shared Identifiers</h2>
        <div>
          {sharedDecisionIdentifiers.map((identifier) => (
            <span key={identifier}>{identifier}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function OverallProjectStatusDashboard() {
  const stageRows = decisionPhases.flatMap((phase) =>
    phase.stages.map((stage) => ({
      ...stage,
      phase: phase.title.replace(/^Phase \d+:\s*/, ""),
      owner: stage.module,
      lastUpdated: stage.status === "Completed" ? "21 Jun 2026" : stage.status === "Not Started" ? "Pending" : "In Review",
    })),
  );

  return (
    <section className="project-status-dashboard">
      <div className="project-status-header">
        <div>
          <h1>OVERALL PROJECT STATUS</h1>
          <p>AI TRADING SYSTEM - DECISION STATUS WORKFLOW</p>
        </div>
        <div className="project-status-actions">
          <span><CalendarDays size={17} /> Last Updated: <strong>21 June 2026 08:30 AM</strong></span>
          <button className="button button-secondary"><RefreshCw size={16} /> Refresh</button>
          <button className="button button-secondary"><Download size={16} /> Export PDF</button>
          <button className="button button-secondary"><Printer size={16} /> Print</button>
        </div>
      </div>

      <div className="project-summary-grid">
        {projectStatusSummary.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={clsx("project-summary-card", statusClass(item.status))}>
              <Icon size={44} />
              <div>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
                <small>{item.percent}% of Total</small>
                <p>{item.description}</p>
              </div>
            </article>
          );
        })}
      </div>

      <section className="overall-completion-panel">
        <h2>OVERALL COMPLETION</h2>
        <strong>72%</strong>
        <div className="segmented-progress" aria-label="Overall project segmented progress">
          <span className="segment-completed" style={{ width: "54.5%" }}>54.5%</span>
          <span className="segment-progress" style={{ width: "27.3%" }}>27.3%</span>
          <span className="segment-pending" style={{ width: "13.6%" }}>13.6%</span>
          <span className="segment-not-started" style={{ width: "4.6%" }}>4.6%</span>
        </div>
        <p>Overall project completion across all 22 workflow stages.</p>

        <div className="project-legend-grid">
          {projectStatusLegend.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className={clsx("project-legend-card", statusClass(item.status))}>
                <Icon size={38} />
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.rule}</span>
                  <p>{item.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="project-insight-grid">
        <section className="project-info-card">
          <h2><AlertCircle size={18} /> Progress Calculation</h2>
          <p>Overall Completion = Sum of all stage progress percentages / Total number of stages.</p>
          <strong>Formula-backed project progress with stage-level accountability.</strong>
        </section>

        <section className="project-health-card">
          <h2>Project Health</h2>
          <strong>Good</strong>
          <p>72% overall completion with active development across remaining stages.</p>
        </section>

        <section className="donut-card">
          <h2>Status Distribution</h2>
          <div className="status-donut" />
          <div>
            <span>Completed 54.5%</span>
            <span>In Progress 27.3%</span>
            <span>Pending 13.6%</span>
            <span>Not Started 4.6%</span>
          </div>
        </section>

        <section className="trend-card">
          <h2>Project Progress Over Time</h2>
          <div className="trend-line">
            {progressTrendPoints.map((point, index) => (
              <span key={index} style={{ height: `${point}%` }} />
            ))}
          </div>
          <div className="trend-metrics">
            <span>Completed: 72%</span>
            <span>Remaining: 28%</span>
            <span>Velocity: +6% weekly</span>
          </div>
        </section>
      </div>

      <section className="forecast-grid">
        <article><span>Current Completion</span><strong>72%</strong></article>
        <article><span>Remaining</span><strong>28%</strong></article>
        <article><span>Estimated Completion Date</span><strong>July 18, 2026</strong></article>
        <article><span>Development Velocity</span><strong>Good</strong></article>
        <article><span>Projected Completion Trend</span><strong>On Track</strong></article>
      </section>

      <details className="stage-breakdown" open>
        <summary>Stage Status Breakdown</summary>
        <div className="stage-breakdown-table">
          <table>
            <thead>
              <tr>
                <th>Stage</th>
                <th>Phase</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Owner</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {stageRows.map((stage) => (
                <tr key={stage.route}>
                  <td>{stage.title}</td>
                  <td>{stage.phase}</td>
                  <td><StatusBadge tone={statusToneFromDecision(stage.status)}>{stage.status}</StatusBadge></td>
                  <td>{stage.progress}%</td>
                  <td>{stage.owner}</td>
                  <td>{stage.lastUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="project-action-strip">
        <strong><BarChart3 size={18} /> View Detailed Breakdown</strong>
        <Link href="#workflow">View Workflow</Link>
        <Link href="#workflow">View Stage Progress</Link>
        <Link href="#workflow">View Phase Progress</Link>
        <button className="button button-secondary"><FileSpreadsheet size={16} /> Export Excel</button>
      </div>
    </section>
  );
}

function DecisionPhasePanel({ phase, index }: { phase: DecisionPhase; index: number }) {
  return (
    <section className="decision-phase-panel">
      <aside className={clsx("decision-phase-card", `phase-card-${index + 1}`)}>
        <strong>PHASE {index + 1}</strong>
        <span>{phase.title.replace(/^Phase \d+:\s*/, "")}</span>
        {index === 0 && <RadioTower size={34} />}
        {index === 1 && <Brain size={34} />}
        {index === 2 && <Settings size={34} />}
        {index === 3 && <FileSpreadsheet size={34} />}
        <p>Goal: {phase.goal}</p>
      </aside>
      <div className="decision-phase-body">
        <div className="decision-phase-header">
        <div>
          <span>Phase {index + 1}</span>
          <h2>{phase.title}</h2>
          <p>{phase.goal}</p>
        </div>
        <div className="phase-io">
          {phase.input && <span>Input: {phase.input}</span>}
          <strong>Output: {phase.output}</strong>
        </div>
      </div>
        <div className="decision-stage-grid">
          {phase.stages.map((stage, stageIndex) => (
            <DecisionStageCard key={stage.route} stage={stage} showArrow={stageIndex < phase.stages.length - 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DecisionStageCard({ stage, showArrow }: { stage: DecisionStage; showArrow: boolean }) {
  return (
    <div className="decision-stage-wrap">
      <Link href={stage.route} className={clsx("decision-stage-card", statusClass(stage.status))}>
        <div className="decision-card-top">
          <span>{stage.number}</span>
          <StatusBadge tone={statusToneFromDecision(stage.status)}>{stage.status.toUpperCase()}</StatusBadge>
        </div>
        <h3>{stage.title}</h3>
        <p>{stage.module}</p>
        <span className="decision-description">{stage.description}</span>
        <div className="decision-actions-list">
          <strong>{stage.actionsLabel}</strong>
          <div>
            {stage.actions.map((action) => (
              <span key={action}>{action}</span>
            ))}
          </div>
        </div>
        <div className="decision-output">
          <span>Output</span>
          <strong>{stage.output}</strong>
        </div>
        <ProgressLine status={stage.status} progress={stage.progress} />
        <div className="stage-action-links">
          <span>View Details</span>
          <span>Related Records</span>
          <span>Logs</span>
          <span>Status History</span>
          <span>Dependencies</span>
        </div>
      </Link>
      {showArrow && <ChevronRight className="decision-stage-arrow" size={22} />}
    </div>
  );
}

function ProgressLine({ status, progress }: { status: DecisionStatus; progress: number }) {
  return (
    <div className="decision-progress">
      <div>
        <span>Progress</span>
        <strong>{progress}%</strong>
      </div>
      <div>
        <span className={statusClass(status)} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function LifecycleStageCard({ stage, showArrow }: { stage: (typeof lifecycleStages)[number]; showArrow: boolean }) {
  const Icon = stage.icon;

  return (
    <div className="lifecycle-stage-wrap">
      <article className={clsx("lifecycle-stage-card", `stage-${stage.tone}`)}>
        <div className="stage-card-top">
          <span>{stage.number}</span>
          <StatusBadge tone={statusToneFromStage(stage.status)}>{stage.status}</StatusBadge>
        </div>
        <Icon size={28} />
        <h3>{stage.name}</h3>
        <p>{stage.module}</p>
        <div className="stage-card-meta">
          <span>{stage.submodules} submodules</span>
          <span>{stage.pages} pages</span>
        </div>
        <div className="stage-output-list">
          {stage.outputs.map((output) => (
            <span key={output}>{output}</span>
          ))}
        </div>
        <div className="stage-page-detail">
          <strong>Pages</strong>
          <div>
            {stage.pageDetails.map((pageName) => (
              <span key={pageName}>{pageName}</span>
            ))}
          </div>
        </div>
        <div className="completion-block">
          <div>
            <span>Completion</span>
            <strong>{stage.completion}%</strong>
          </div>
          <div className="completion-track">
            <span style={{ width: `${stage.completion}%` }} />
          </div>
        </div>
      </article>
      {showArrow && <ChevronRight className="stage-arrow" size={24} />}
    </div>
  );
}

function SupportServiceCard({ service }: { service: (typeof supportServices)[number] }) {
  return (
    <article className={clsx("support-service-card", `service-${service.tone}`)}>
      <div>
        <h3>{service.name}</h3>
        <StatusBadge tone={service.completion >= 90 ? "success" : service.completion >= 80 ? "warning" : "info"}>{service.completion}%</StatusBadge>
      </div>
      <p>{service.count} submodules</p>
      <div>
        {service.items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </article>
  );
}

function statusToneFromStage(status: string): StatusTone {
  if (status === "Designed") return "success";
  if (status === "Testing") return "warning";
  if (status === "Blocked") return "danger";
  if (status === "In Development") return "info";
  return "neutral";
}

function statusToneFromDecision(status: DecisionStatus): StatusTone {
  if (status === "Completed") return "success";
  if (status === "In Progress") return "warning";
  if (status === "Pending") return "danger";
  return "neutral";
}

function statusClass(status: string) {
  return `decision-${status.toLowerCase().replace(/\s+/g, "-")}`;
}

function MetricCard({ label, value, delta, tone }: { label: string; value: string; delta: string; tone: StatusTone }) {
  return (
    <article className={clsx("metric-card", `metric-${tone}`)}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <StatusBadge tone={tone}>{delta}</StatusBadge>
    </article>
  );
}

function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: StatusTone }) {
  return <span className={clsx("status-badge", `status-${tone}`)}>{children}</span>;
}

function StatusPill({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="status-pill">
      <Icon size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FilterPanel() {
  return (
    <section className="panel filter-panel">
      <div>
        <h2>Control Filters</h2>
        <p>Shared filters persist across dashboards, records, reports, and audit views.</p>
      </div>
      <div className="filter-controls">
        <button><Filter size={16} /> Symbol: XAUUSD</button>
        <button><SlidersHorizontal size={16} /> Strategy: Hybrid</button>
        <button><CircleDollarSign size={16} /> Account: Prop</button>
        <button><History size={16} /> Today</button>
      </div>
    </section>
  );
}

function Tabs({ tabs, activeTab, onChange }: { tabs: string[]; activeTab: string; onChange: (tab: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab} className={clsx(activeTab === tab && "active")} onClick={() => onChange(tab)}>
          {tab}
        </button>
      ))}
    </div>
  );
}

function OperationsPanel({ module }: { module: Module }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>{module.title} Workspace</h2>
          <p>Operational actions, linked workflows, and module-specific requirements.</p>
        </div>
        <ActionButton icon={Zap} label="Run Workflow" variant="primary" />
      </div>
      <div className="feature-grid">
        {module.requiredFeatures.map((feature, index) => (
          <SummaryCard key={feature} feature={feature} index={index} />
        ))}
      </div>
      <div className="workflow-rail">
        {workflowLinks.map((item, index) => (
          <Link key={item.href} href={item.href}>
            <span>{index + 1}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({ feature, index }: { feature: string; index: number }) {
  const tones = ["blue", "green", "amber", "violet", "cyan", "rose"];
  return (
    <article className={clsx("summary-card", `accent-${tones[index % tones.length]}`)}>
      <CheckCircle2 size={18} />
      <strong>{feature}</strong>
      <span>Connected to shared records, reports, alerts, and auditId traceability.</span>
    </article>
  );
}

function DataTable({ records }: { records: LinkedRecord[] }) {
  return (
    <section className="panel data-panel">
      <div className="section-heading">
        <div>
          <h2>Linked Records</h2>
          <p>Every record keeps deep links across AI decisions, trades, risk, reports, and audit trails.</p>
        </div>
        <ExportButton />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Record ID</th>
              <th>Symbol / Account</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Risk</th>
              <th>Drill-down</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.symbol}</td>
                <td><StatusBadge tone={record.status.includes("Risk") ? "danger" : "success"}>{record.status}</StatusBadge></td>
                <td>{record.owner}</td>
                <td>{record.risk}</td>
                <td>
                  <Link className="table-link" href={record.link}>
                    Open <ExternalLink size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChartPanel({ module }: { module: Module }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Performance Signal</h2>
          <p>Prepared for SignalR-fed charts and OpenTelemetry-backed operational metrics.</p>
        </div>
        <StatusBadge tone="success">Live-ready</StatusBadge>
      </div>
      <div className="chart-panel" aria-label={`${module.title} chart panel`}>
        {[68, 74, 59, 86, 78, 92, 81, 95, 88, 97, 91, 99].map((height, index) => (
          <span key={index} style={{ height: `${height}%` }} />
        ))}
      </div>
    </section>
  );
}

function Timeline() {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Activity & Audit Timeline</h2>
          <p>Trace userId, sessionId, auditId, decisionId, tradeId, alertId, and reportId changes.</p>
        </div>
      </div>
      <div className="timeline">
        {timeline.map((item) => (
          <article key={item.title}>
            <span>{item.time}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LinkedRecordPanel({ modules: linkedModules, fallback }: { modules: Module[]; fallback: Module }) {
  const links = linkedModules.length ? linkedModules : modules.filter((module) => module.path !== fallback.path).slice(0, 6);
  return (
    <section className="panel linked-panel">
      <h2>Related Modules</h2>
      <p>Contextual navigation prevents dead-end workflows.</p>
      <div>
        {links.map((module) => (
          <Link key={module.path} href={module.path}>
            <module.icon size={17} />
            <span>{module.title}</span>
            <ChevronRight size={15} />
          </Link>
        ))}
      </div>
    </section>
  );
}

function QuickActions({ module, onOpenDrawer, onConfirm }: { module: Module; onOpenDrawer: () => void; onConfirm: () => void }) {
  return (
    <section className="panel quick-actions">
      <h2>Related Actions</h2>
      <ActionButton icon={Play} label={`Start ${module.title}`} variant="primary" />
      <ActionButton icon={Pause} label="Pause Trading" variant="secondary" />
      <ActionButton icon={BookOpen} label="Send to Learning" variant="secondary" onClick={onOpenDrawer} />
      <ActionButton icon={Power} label="Emergency Shutdown" variant="danger" onClick={onConfirm} />
    </section>
  );
}

function StatePanels() {
  return (
    <section className="state-stack">
      <EmptyState />
      <LoadingState />
      <ErrorState />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="state-card">
      <LifeBuoy size={18} />
      <strong>Empty state</strong>
      <span>No filtered records for this symbol set.</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="state-card">
      <MoreHorizontal size={18} />
      <strong>Loading state</strong>
      <span>Streaming updates from SignalR hub.</span>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="state-card error-state">
      <AlertCircle size={18} />
      <strong>Error state</strong>
      <span>Bridge failures link to monitoring and alerts.</span>
    </div>
  );
}

function AlertCard() {
  return (
    <article className="alert-card">
      <AlertCircle size={18} />
      <div>
        <strong>News risk warning</strong>
        <p>alertId ALT-3317 links to source record and escalation rule.</p>
      </div>
    </article>
  );
}

function DetailDrawer({ open, onClose, module, title }: { open: boolean; onClose: () => void; module: Module; title: string }) {
  return (
    <div className={clsx("drawer-layer", open && "open")} aria-hidden={!open}>
      <button className="drawer-backdrop" onClick={onClose} aria-label="Close drawer" />
      <aside className="detail-drawer">
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Contextual Drawer</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close context drawer"><X size={18} /></button>
        </div>
        <AlertCard />
        <TradeCard />
        <RiskCard />
        <StrategyCard />
        <AccountCard />
        <Timeline />
        <p className="drawer-note">
          Integration contract: Next.js calls ASP.NET Core (.NET 9) APIs, consumes SignalR updates, and routes MT5 commands through the C# bridge WebSocket with shared identifiers.
        </p>
      </aside>
    </div>
  );
}

function TradeCard() {
  return (
    <article className="record-card">
      <strong>TradeCard</strong>
      <span>tradeId TRD-1048 - XAUUSD protected, profit lock enabled.</span>
      <Link href="/trade-management/open-trades">View trade</Link>
    </article>
  );
}

function RiskCard() {
  return (
    <article className="record-card">
      <strong>RiskCard</strong>
      <span>Daily drawdown 1.4% of 5.0%; prop firm compliant.</span>
      <Link href="/risk-management/dashboard">View risk logs</Link>
    </article>
  );
}

function StrategyCard() {
  return (
    <article className="record-card">
      <strong>StrategyCard</strong>
      <span>Hybrid XAUUSD priority strategy confidence 86%.</span>
      <Link href="/strategy-management/xauusd-priority">View strategy</Link>
    </article>
  );
}

function AccountCard() {
  return (
    <article className="record-card">
      <strong>AccountCard</strong>
      <span>accountId ACC-2201 connected through Broker-Prime / MT5-02.</span>
      <Link href="/accounts-brokers/trading-accounts">View account</Link>
    </article>
  );
}

function ConfirmModal({ open, onClose, module }: { open: boolean; onClose: () => void; module: Module }) {
  if (!open) return null;

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="confirm-modal">
        <div className="modal-icon"><Lock size={22} /></div>
        <h2 id="confirm-title">Confirm protected action</h2>
        <p>
          This action will create an auditId, notify Risk Management, and link {module.title} to Alerts, Reports, and Emergency Shutdown workflows.
        </p>
        <div className="modal-actions">
          <button className="button button-secondary" onClick={onClose}>Cancel</button>
          <button className="button button-danger" onClick={onClose}>Confirm action</button>
        </div>
      </div>
    </div>
  );
}

function ExportButton() {
  return (
    <button className="button button-secondary">
      <Download size={16} />
      Export
    </button>
  );
}

function ActionButton({
  icon: Icon,
  label,
  variant = "secondary",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  onClick?: () => void;
}) {
  return (
    <button className={clsx("button", `button-${variant}`)} onClick={onClick}>
      <Icon size={16} />
      {label}
    </button>
  );
}
