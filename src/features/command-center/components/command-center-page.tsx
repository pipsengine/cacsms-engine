"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  Bot,
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
import { DecisionWorkbenchBoard } from "@/features/decision-workbench/components/decision-workbench-board";
import { CurrencyStrengthMatrixBoard } from "@/features/currency-strength-matrix/components/currency-strength-matrix-board";
import { CotPositioningBoard } from "@/features/cot-positioning/components/cot-positioning-board";
import {
  getDataSourcesStatus,
  getBridgeSettings,
  getEngineStatus,
  getRuntimeConfig,
  getSymbolSelectionRules,
  reloadRuntimeConfig,
  startEngine,
  stopEngine,
} from "@/lib/api/operations";
import type {
  DataSourcesOverview,
  BridgeSettingsOverview,
  EngineRuntimeStatus,
  RuntimeConfig,
  SymbolSelectionRulesOverview,
} from "@/lib/api/types";

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

type ProcessWorkflowStage = {
  number: string;
  name: string;
  owner: string;
  status: "Completed" | "In Progress" | "Pending" | "Not Started" | "Blocked";
  progress: number;
  note: string;
  icon: LucideIcon;
  accent: "green" | "blue" | "amber" | "red" | "purple";
};

type ProcessWorkflowColumn = {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: "green" | "blue" | "amber" | "purple";
  stages: ProcessWorkflowStage[];
};

const processWorkflowColumns: ProcessWorkflowColumn[] = [
  {
    title: "Currency-First Selection",
    description: "Build market opportunity from currency strength flow",
    icon: Network,
    accent: "green",
    stages: [
      { number: "01", name: "Start Engine", owner: "Runtime Control", status: "Completed", progress: 100, note: "Runtime active", icon: Play, accent: "green" },
      { number: "02", name: "Load Runtime + Risk Config", owner: "Runtime Control", status: "Completed", progress: 100, note: "Trading limits loaded", icon: Settings, accent: "green" },
      { number: "03", name: "Verify Data Sources", owner: "Observability", status: "Completed", progress: 100, note: "Feeds connected", icon: Archive, accent: "green" },
      { number: "04", name: "Currency Strength Matrix", owner: "8 Major Currencies", status: "Completed", progress: 100, note: "GBP - EUR - USD - JPY - AUD - CAD - CHF - NZD", icon: BarChart3, accent: "green" },
      { number: "05", name: "Rank Strong / Weak Currencies", owner: "Currency Strength Engine", status: "Completed", progress: 100, note: "Bullish, bearish, neutral, mixed", icon: Gauge, accent: "green" },
      { number: "06", name: "Strong-vs-Weak Pair Selector", owner: "Symbol Selection Engine", status: "In Progress", progress: 75, note: "Generate candidate FX pairs", icon: Target, accent: "amber" },
      { number: "07", name: "Approved Symbol Filter", owner: "Trading Universe", status: "Completed", progress: 100, note: "Trade only approved symbols", icon: CheckCircle2, accent: "green" },
      { number: "08", name: "Directional Bias Assigned", owner: "Symbol Selection Engine", status: "In Progress", progress: 70, note: "Buy, sell, no trade, manual review", icon: SlidersHorizontal, accent: "amber" },
    ],
  },
  {
    title: "Analysis",
    description: "Validate opportunity and market condition",
    icon: BarChart3,
    accent: "blue",
    stages: [
      { number: "09", name: "Market Structure Analysis", owner: "Market Intelligence", status: "In Progress", progress: 65, note: "Trend - BOS/CHOCH - Structure - Zones", icon: SlidersHorizontal, accent: "blue" },
      { number: "10", name: "Macro + COT Analysis", owner: "Macro Intelligence", status: "In Progress", progress: 60, note: "News - COT - Macro - Sentiment - Yields", icon: Network, accent: "blue" },
      { number: "11", name: "Opportunity Confirmed", owner: "AI Decision Engine", status: "Pending", progress: 20, note: "Candidate awaiting final confirmation", icon: Target, accent: "blue" },
    ],
  },
  {
    title: "Decision Engine",
    description: "AI decision and institutional validation",
    icon: Brain,
    accent: "amber",
    stages: [
      { number: "12", name: "Hybrid AI Decision", owner: "Decision Engine", status: "In Progress", progress: 70, note: "Score gates and pattern recognition", icon: Brain, accent: "amber" },
      { number: "13", name: "Currency Strength Gate", owner: "Decision Engine", status: "In Progress", progress: 75, note: "Symbol bias must agree", icon: ShieldCheck, accent: "amber" },
      { number: "14", name: "Confidence Gate 85%", owner: "Decision Engine", status: "In Progress", progress: 70, note: "Minimum confidence required", icon: ShieldCheck, accent: "amber" },
      { number: "15", name: "Risk Approval", owner: "Risk & Compliance", status: "In Progress", progress: 60, note: "Drawdown and exposure check", icon: ShieldAlert, accent: "amber" },
      { number: "16", name: "Final Trade Approval", owner: "Decision Engine", status: "Pending", progress: 10, note: "Execute or no trade", icon: Check, accent: "blue" },
    ],
  },
  {
    title: "Execution Engine",
    description: "Execute trade with precision",
    icon: Zap,
    accent: "green",
    stages: [
      { number: "17", name: "Execution Approval", owner: "Execution Layer", status: "In Progress", progress: 50, note: "Manual/auto permission", icon: User, accent: "green" },
      { number: "18", name: "MT5 Order Routing", owner: "Execution Layer", status: "Pending", progress: 10, note: "Send order to broker", icon: RadioTower, accent: "blue" },
      { number: "19", name: "Order Execution", owner: "External Broker", status: "Pending", progress: 10, note: "Confirm fill and position open", icon: Archive, accent: "blue" },
    ],
  },
  {
    title: "Post-Trade Engine",
    description: "Manage trade to completion",
    icon: BriefcaseBusiness,
    accent: "purple",
    stages: [
      { number: "20", name: "Live Trade Monitoring", owner: "Trade Management", status: "Completed", progress: 100, note: "Monitor open position", icon: Gauge, accent: "green" },
      { number: "21", name: "Profit Lock + Risk Control", owner: "Trade Management", status: "In Progress", progress: 60, note: "Protect gains and manage risk", icon: Lock, accent: "purple" },
      { number: "22", name: "Exit Decision", owner: "Exit Management", status: "In Progress", progress: 40, note: "Hold, trail, or close", icon: RefreshCw, accent: "purple" },
      { number: "23", name: "Trade Closure", owner: "Exit Management", status: "Pending", progress: 15, note: "Close position", icon: CheckCircle2, accent: "blue" },
      { number: "24", name: "Persist Outcome + Reports + Learning", owner: "Data / Reports / Learning", status: "In Progress", progress: 45, note: "Save trade record and improve future selection", icon: BookOpen, accent: "purple" },
    ],
  },
];

const xauPriorityStages: ProcessWorkflowStage[] = [
  { number: "X1", name: "USD Strength Filter", owner: "XAUUSD Scalping Engine", status: "Completed", progress: 100, note: "Read USD M5/M15/M30/H1", icon: Gauge, accent: "green" },
  { number: "X2", name: "Invert USD Bias for XAU", owner: "XAUUSD Scalping Engine", status: "In Progress", progress: 80, note: "USD weak = XAU buy; USD strong = XAU sell", icon: RefreshCw, accent: "amber" },
  { number: "X3", name: "XAU Scalping Gate", owner: "Execution Filter", status: "In Progress", progress: 65, note: "Session, spread, volatility, news", icon: ShieldCheck, accent: "amber" },
  { number: "X4", name: "XAUUSD Priority Candidate", owner: "Trading Universe", status: "Pending", progress: 25, note: "Validate entry on M1/M5/M15", icon: Target, accent: "blue" },
];

const processBranches = [
  { title: "No Trade", detail: "Conditions not aligned", action: "Logged", tone: "red", icon: X },
  { title: "Manual Review", detail: "Requires human expert assessment", action: "Review Queue", tone: "amber", icon: User },
  { title: "Blocked", detail: "Risk, compliance, or system block", action: "Not Approved", tone: "red", icon: ShieldAlert },
  { title: "Emergency Stop", detail: "Kill switch or critical system alert", action: "Engine Halted", tone: "red", icon: Power },
  { title: "Execute Path", detail: "All gates passed, execute trade", action: "Proceed to Execution", tone: "green", icon: CheckCircle2 },
];

const processSnapshot = [
  ["Top FX Candidate", "GBPJPY Buy"],
  ["XAUUSD Priority", "BUY Scalp"],
  ["Strongest Currency", "GBP"],
  ["Weakest Currency", "JPY"],
  ["USD Strength Score", "23"],
  ["XAU vs USD Differential", "+68"],
  ["Opportunity Score", "95 / 100"],
  ["AI Confidence", "97%"],
  ["Market Regime", "TRENDING"],
  ["Current Session", "LONDON"],
  ["Spread", "OK"],
  ["Risk Status", "APPROVED"],
];

const processSelectionRules = [
  "FX pairs use strongest vs weakest currency",
  "XAUUSD uses inverse USD strength",
  "Mixed strength = No Trade or Manual Review",
];

const processSummary = [
  ["Completed", "8", "green"],
  ["In Progress", "11", "amber"],
  ["Pending", "5", "blue"],
  ["Not Started", "0", "slate"],
  ["Blocked", "0", "red"],
];

const processEngineInfo = [
  ["Trading Mode", "HYBRID PORTFOLIO"],
  ["Symbol Selection", "CURRENCY-FIRST"],
  ["XAU Mode", "PRIORITY SCALP"],
  ["Autonomy Level", "HIGH"],
  ["Risk Profile", "MODERATE"],
  ["Daily Drawdown", "1.2%"],
  ["Open Position", "1"],
  ["Active Strategies", "3"],
];

const processInputs: Array<[string, string, LucideIcon]> = [
  ["Currency Strength", "8 major currencies", Network],
  ["Strong-vs-Weak Selector", "Pair ranking", Target],
  ["Gold Intelligence", "XAU priority", Sparkles],
  ["USD Intelligence", "DXY, yields, Fed", Gauge],
  ["COT & Sentiment", "Institutional position", ClipboardCheck],
  ["Market Structure", "Trend, BOS, liquidity", SlidersHorizontal],
  ["Macro & News", "Economic calendar", BookOpen],
  ["Session & Liquidity", "Time and volatility", Clock],
];

const processWorkflowImageSrc = "/Stages%20Status%20Workflow%20II.png";
const processWorkflowStaticLiveTime = "Live: 2 Jun 2026, 10:45:32 AM";
type ProcessEngineRuntimeStatus = "RUNNING" | "OFFLINE";

type ProcessWorkflowOverviewResponse = {
  overallCompletion?: number;
  OverallCompletion?: number;
};

type ProcessStageLiveStatus = {
  code: "01" | "02" | "03" | "04";
  status: string;
  progress: number;
  note: string;
  tone: "green" | "amber" | "red" | "slate";
};

type ProcessCurrencyStrengthStatusResponse = {
  source?: string;
  Source?: string;
  confidence?: number;
  Confidence?: number;
};

const initialProcessStageStatuses: ProcessStageLiveStatus[] = [
  { code: "01", status: "Offline", progress: 0, note: "Engine API unavailable", tone: "red" },
  { code: "02", status: "Offline", progress: 0, note: "Runtime config unavailable", tone: "red" },
  { code: "03", status: "Offline", progress: 0, note: "Data-source API unavailable", tone: "red" },
  { code: "04", status: "Offline", progress: 0, note: "Currency feed unavailable", tone: "red" },
];

const processHotspots = [
  { label: "01 Start Engine", href: "/trading-control/engine", x: 1.8, y: 12.5, w: 16.8, h: 5.5 },
  { label: "02 Load Runtime + Risk Config", href: "/trading-control/runtime-config", x: 1.8, y: 19.2, w: 16.8, h: 5.5 },
  { label: "03 Verify Data Sources", href: "/system-monitoring/data-sources", x: 1.8, y: 25.9, w: 16.8, h: 5.5 },
  { label: "04 Currency Strength Matrix", href: "/macro-intelligence/currency-strength-matrix", x: 1.8, y: 35.1, w: 16.8, h: 5.5 },
  { label: "Selection Rule", href: "/market-intelligence/symbol-selection-rules", x: 19.3, y: 13.2, w: 5.9, h: 20.1 },
  { label: "05 Rank Strong / Weak Currencies", href: "/macro-intelligence/currency-strength-matrix", x: 2.4, y: 48.3, w: 17.2, h: 5.2 },
  { label: "06 Strong-vs-Weak Pair Selector", href: "/market-intelligence/watchlist", x: 2.4, y: 56.9, w: 17.2, h: 5.2 },
  { label: "07 Approved Symbol Filter", href: "/market-intelligence/watchlist", x: 2.4, y: 65.5, w: 17.2, h: 5.2 },
  { label: "08 Directional Bias Assigned", href: "/ai-decision-engine/recommendations", x: 2.4, y: 74.1, w: 17.2, h: 5.2 },
  { label: "XAUUSD Priority Scalping Path", href: "/dashboard/process-status-workflow", x: 2.1, y: 82.1, w: 18, h: 13.6 },
  { label: "09 Market Structure Analysis", href: "/market-intelligence/market-structure", x: 26.8, y: 13.2, w: 14.3, h: 8.2 },
  { label: "10 Macro + COT Analysis", href: "/macro-intelligence/cot-positioning", x: 26.8, y: 25.2, w: 14.3, h: 8.2 },
  { label: "11 Opportunity Confirmed", href: "/ai-decision-engine/entry-validation", x: 26.8, y: 37.0, w: 14.3, h: 8.2 },
  { label: "Institutional Validation", href: "/risk-management/pre-trade-checks", x: 26.8, y: 49.2, w: 14.3, h: 13.2 },
  { label: "12 Hybrid AI Decision", href: "/ai-decision-engine/recommendations", x: 43.1, y: 13.2, w: 13.9, h: 8.2 },
  { label: "13 Currency Strength Gate", href: "/macro-intelligence/currency-strength-matrix", x: 43.1, y: 25.2, w: 13.9, h: 8.2 },
  { label: "14 Confidence Gate 85%", href: "/ai-decision-engine/entry-validation", x: 43.1, y: 37.0, w: 13.9, h: 8.2 },
  { label: "15 Risk Approval", href: "/risk-management/dashboard", x: 43.1, y: 48.9, w: 13.9, h: 8.2 },
  { label: "16 Final Trade Approval", href: "/ai-decision-engine/approval-queue", x: 43.1, y: 60.8, w: 13.9, h: 8.2 },
  { label: "17 Execution Approval", href: "/trade-execution/order-setup", x: 59.1, y: 13.2, w: 13.5, h: 8.2 },
  { label: "18 MT5 Order Routing", href: "/trade-execution/mt5-bridge", x: 59.1, y: 25.2, w: 13.5, h: 8.2 },
  { label: "19 Order Execution", href: "/trade-execution/order-history", x: 59.1, y: 37.0, w: 13.5, h: 8.2 },
  { label: "20 Live Trade Monitoring", href: "/trade-management/open-trades", x: 75.1, y: 13.2, w: 13.2, h: 8.2 },
  { label: "21 Profit Lock + Risk Control", href: "/trade-management/risk-controls", x: 75.1, y: 25.2, w: 13.2, h: 8.2 },
  { label: "22 Exit Decision", href: "/trade-management/exit-management", x: 75.1, y: 37.0, w: 13.2, h: 8.2 },
  { label: "23 Trade Closure", href: "/trade-management/closed-trades", x: 75.1, y: 48.9, w: 13.2, h: 8.2 },
  { label: "24 Persist Outcome + Reports + Learning", href: "/reports/daily", x: 75.1, y: 60.8, w: 13.2, h: 8.2 },
  { label: "Live Market Snapshot", href: "/market-intelligence/watchlist", x: 89.0, y: 11.9, w: 9.3, h: 21.0 },
  { label: "Workflow Summary", href: "/dashboard/process-status-workflow", x: 89.0, y: 34.1, w: 9.3, h: 15.6 },
  { label: "Engine Information", href: "/system-monitoring/engine-health", x: 89.0, y: 51.0, w: 9.3, h: 19.2 },
  { label: "Branch Outputs", href: "/ai-decision-engine/approval-queue", x: 25.7, y: 77.0, w: 62.2, h: 8.3 },
  { label: "Key Intelligence Inputs", href: "/macro-intelligence/currency-strength-matrix", x: 0.9, y: 89.0, w: 73.4, h: 8.4 },
  { label: "Trading Focus", href: "/dashboard/process-status-workflow", x: 74.9, y: 89.0, w: 24.0, h: 8.4 },
];

const unimplementedPageStatus = { status: "Not Implemented", completion: 0, tone: "red" } as const;

const lifecycleStages = [
  { number: "01", name: "Market Intelligence", module: "Market Intelligence", submodules: 27, pages: 27, outputs: ["Market Bias", "Top-Down Bias", "Session Analysis", "Symbol Opportunities"], pageDetails: ["Market Overview", "Symbol Watchlist", "Multi-Timeframe", "Multi-Timeframe Bias", "Candle Direction", "Structure Alignment", "HTF Conflict Detector", "Execution Timeframe Confirmation", "Bias Alignment Gate", "H8 Session Candles", "D1 Candle Predictor", "Session Analysis", "Volatility", "Correlation", "News Impact", "Sentiment", "Market Regimes", "Historical Similarity", "No-Trade Conditions"], ...unimplementedPageStatus, icon: Network },
  { number: "02", name: "Macro Intelligence", module: "Macro Intelligence", submodules: 12, pages: 12, outputs: ["Macro Bias", "Rate Differential", "Currency Strength Ranking"], pageDetails: ["Macro Overview", "COT Positioning", "COT Crowding", "Interest Rate Differential", "Central Bank Bias", "Yield Spread Monitor", "Currency Strength Matrix", "Strong-vs-Weak Selector", "Macro Risk Calendar", "Macro Bias Score", "Macro + Technical Confluence", "Data Source Health"], ...unimplementedPageStatus, icon: BarChart3 },
  { number: "03", name: "Advanced Algorithms", module: "Advanced Algorithms", submodules: 17, pages: 17, outputs: ["Top-Down Bias", "Historical Similarity", "Candle Intelligence", "D1 Projection", "Ensemble Prediction"], pageDetails: ["Algorithm Overview", "Market Regime Classifier", "Feature Engineering", "Multi-Timeframe Bias Model", "Historical Pattern Memory", "Candle Intelligence", "H8-to-D1 Predictor", "Ensemble Prediction", "Bayesian Confidence", "Probability Calibration", "Walk-Forward Validation", "Anomaly Detection", "Execution Quality", "Strategy Decay", "RL Trade Manager", "Quantum-Inspired Optimizer", "Model Governance"], ...unimplementedPageStatus, icon: Bot },
  { number: "04", name: "Opportunity Detection", module: "AI Decision Engine", submodules: 2, pages: 2, outputs: ["AI Scanned Setups", "Opportunity Ranking"], pageDetails: ["Opportunity Scanner", "AI Recommendations"], ...unimplementedPageStatus, icon: Target },
  { number: "05", name: "AI Decision Engine", module: "AI Decision Engine", submodules: 36, pages: 36, outputs: ["Trade Recommendation", "Confidence Score", "Risk Assessment"], pageDetails: ["Opportunity Scanner", "Entry Validation", "Mode Selection", "Confidence Score", "MTF Bias Gate", "HTF Conflict Gate", "Macro Bias Gate", "Historical Similarity Gate", "Candle Intelligence Gate", "H8-to-D1 Gate", "Currency Strength Gate", "Rate Differential Gate", "COT Gate", "Advanced Algorithm Gate", "Ensemble Prediction Gate", "Bayesian Gate", "Calibration Gate", "Anomaly Gate", "Execution Quality Gate", "Institutional Prediction", "Probability Forecast", "85% Gate", "Confidence Decay", "Liquidity Target", "Prediction Tracking", "Strategy Gate", "Market Regime Gate", "Risk Gate", "News Gate", "Broker Gate", "AI Confidence Gate", "No-Trade Engine", "Recommendations", "Decision History"], ...unimplementedPageStatus, icon: Brain },
  { number: "06", name: "Trade Execution", module: "Trade Execution", submodules: 12, pages: 12, outputs: ["Orders", "Positions", "Broker Confirmation"], pageDetails: ["Symbol Selection", "Order Setup", "Market Orders", "Pending Orders", "Order Validation", "Execution Approval", "Spread Gate", "Slippage Gate", "Broker Readiness", "MT5 Routing", "Broker Logs", "Slippage & Spread"], ...unimplementedPageStatus, icon: RadioTower },
  { number: "07", name: "Trade Management", module: "Trade Management", submodules: 13, pages: 13, outputs: ["Open Trades", "Basket Monitoring", "Position Control"], pageDetails: ["Open Trades", "Basket Trades", "Position Monitoring", "Profit Lock", "Break-Even", "Trailing Stop", "Partial Close", "Basket Profit Protection", "Equity Protection", "Session Close Exits", "AI Exit Validation", "Exit Manager", "Closed Trades"], ...unimplementedPageStatus, icon: BriefcaseBusiness },
  { number: "08", name: "Risk Management", module: "Risk Management", submodules: 20, pages: 20, outputs: ["Exposure Monitoring", "Drawdown Control", "Compliance"], pageDetails: ["Risk Dashboard", "Daily Loss", "Weekly Loss", "Monthly Loss", "Drawdown", "Equity Protection", "Margin Protection", "Position Limits", "Correlation Exposure", "Prop Firm Rules", "Risk-Off Engine", "No-Trade Rules", "Equity Growth Guardrails", "Compounding Control", "Daily Profit Lockdown", "XAUUSD Risk Limits", "Loss Guard", "Auto-Disable", "Expectancy Protection", "Exposure Reduction"], ...unimplementedPageStatus, icon: ShieldCheck },
  { number: "09", name: "Profit Lock Engine", module: "Trade Management", submodules: 1, pages: 1, outputs: ["Locked Profit", "Dynamic Protection"], pageDetails: ["Profit Lock Manager"], ...unimplementedPageStatus, icon: Lock },
  { number: "10", name: "Exit Manager", module: "Trade Management", submodules: 2, pages: 2, outputs: ["Closed Trades", "Exit Decisions"], pageDetails: ["Exit Manager", "Closed Trades"], ...unimplementedPageStatus, icon: CheckCircle2 },
  { number: "11", name: "Performance Analytics", module: "Performance Analytics", submodules: 19, pages: 19, outputs: ["KPIs", "Performance Metrics"], pageDetails: ["Profit & Loss", "Win/Loss", "Drawdown", "Symbols", "Strategies", "Sessions", "Trade Duration", "Risk Reward", "Expectancy", "Profit Factor", "Recovery Factor", "Consecutive Losses", "Strategy Decay", "Risk-Adjusted Performance", "30% Growth Tracking", "60% Win Rate", "85% Prediction Accuracy", "Equity Curve", "Monthly Returns"], ...unimplementedPageStatus, icon: Gauge },
  { number: "12", name: "Reporting Engine", module: "Reports", submodules: 9, pages: 9, outputs: ["Reports", "Exports"], pageDetails: ["Daily Report", "Weekly Report", "Monthly Report", "Trade History", "Risk Report", "Broker Report", "User Activity", "AI Decisions", "Export Center"], ...unimplementedPageStatus, icon: FileSpreadsheet },
  { number: "13", name: "Alert Engine", module: "Alerts & Notifications", submodules: 8, pages: 8, outputs: ["Notifications", "Risk Alerts"], pageDetails: ["Trade Alerts", "Risk Alerts", "Profit Lock", "Connection", "News", "Drawdown", "Channel Settings", "Alert History"], ...unimplementedPageStatus, icon: Bell },
  { number: "14", name: "Learning Center", module: "Learning Center", submodules: 15, pages: 15, outputs: ["Trade Lessons", "AI Explanations"], pageDetails: ["Trade Journal", "Trade Explanations", "Market Snapshots", "Entry/Exit Review", "Strategy Outcome Review", "Risk Decision Review", "Case Studies", "Winning Trades", "Losing Trades", "Market Replay", "Strategy Lessons", "AI Decisions", "Model Improvement Queue", "Knowledge Base", "Training Materials"], ...unimplementedPageStatus, icon: BookOpen },
  { number: "15", name: "Audit Trail", module: "Administration / Security", submodules: 4, pages: 4, outputs: ["Audit Records", "Compliance Logs"], pageDetails: ["Admin Audit Logs", "Security Logs", "Security Audit Trail", "Compliance Rules"], ...unimplementedPageStatus, icon: ClipboardCheck },
];

const traceabilityRecords = ["Trade ID", "Decision ID", "Order ID", "Position ID", "Close ID", "Report ID", "Lesson ID", "Audit ID"];

const supportServices = [
  { name: "Accounts & Brokers", count: 7, completion: 0, items: ["Trading Accounts", "MT5 Terminals", "Broker Connections"], tone: "red" },
  { name: "Macro Intelligence", count: 12, completion: 0, items: ["COT Positioning", "Interest Rates", "Currency Strength"], tone: "red" },
  { name: "Advanced Algorithms", count: 16, completion: 0, items: ["Historical Memory", "Candle Intelligence", "H8-to-D1 Predictor"], tone: "red" },
  { name: "Strategy Management", count: 28, completion: 0, items: ["Strategy Library", "Best Strategy Set", "A-Grade Setups"], tone: "red" },
  { name: "Backtesting & Simulation", count: 12, completion: 0, items: ["Backtest Dashboard", "Walk-Forward", "Live Shadow"], tone: "red" },
  { name: "User Management", count: 8, completion: 0, items: ["Users", "Roles", "Permissions"], tone: "red" },
  { name: "Administration", count: 9, completion: 0, items: ["System Settings", "Trading Settings"], tone: "red" },
  { name: "Security & Compliance", count: 8, completion: 0, items: ["Authentication", "RBAC", "Audit Controls"], tone: "red" },
  { name: "System Monitoring", count: 8, completion: 0, items: ["MT5 Bridge Health", "API Monitoring", "Logs"], tone: "red" },
  { name: "Data Management", count: 4, completion: 0, items: ["SQL Server", "Redis", "Backup", "Synchronization"], tone: "red" },
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

type DecisionStatus = "Not Implemented" | "Not Started" | "Pending" | "In Progress" | "Completed";

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
const unimplementedDecisionStatus = { status: "Not Implemented", progress: 0 } as const;

const decisionPhases: DecisionPhase[] = [
  {
    title: "Phase 1: Market Intelligence & Analysis",
    goal: "Identify high-probability opportunities across the selected trading universe.",
    output: "Potential Trade Setup Identified",
    stages: [
      { number: "01", title: "Trading Mode Selection", route: "/decision-workflow/trading-mode-selection", module: "Trading Control Center", description: "Select and validate one of the three trading modes before analysis begins.", actionsLabel: "Modes / Actions", actions: ["Institutional Mode", "Retail Mode", "Hybrid Mode", "Validate selected mode", "Confirm permission", "Log mode selection"], output: "Active Trading Mode", ...unimplementedDecisionStatus },
      { number: "02", title: "Symbol Selection", route: "/decision-workflow/symbol-selection", module: "Symbol Selection Engine", description: "Scan the approved symbol universe and select the candidate symbol.", actionsLabel: "Actions", actions: ["Scan approved 11 symbols", "Filter eligible candidates", "Prioritize XAUUSD", "Select candidate symbol"], output: "Candidate Symbol", ...unimplementedDecisionStatus },
      { number: "03", title: "Symbol Eligibility Check", route: "/decision-workflow/symbol-eligibility", module: "Symbol Eligibility Engine", description: "Confirm the candidate symbol can be traded under live account constraints.", actionsLabel: "Checks", actions: ["Market open", "Spread acceptable", "Volatility acceptable", "News restriction", "Daily symbol limit", "Basket exposure", "Prop firm restriction", "Risk permission"], output: "Eligible or Not Eligible", ...unimplementedDecisionStatus },
      { number: "04", title: "Symbol Classification", route: "/decision-workflow/symbol-classification", module: "Symbol Classification Engine", description: "Classify symbol type and apply trading-style restrictions.", actionsLabel: "Classification / Rules", actions: ["Forex", "Commodity", "Index", "XAUUSD scalping-enabled", "Indices: US30, SP500, NASDAQ100", "Others: Forex"], output: "Symbol Category and Trading Rule", ...unimplementedDecisionStatus },
      { number: "05", title: "Macro Data Intake", route: "/decision-workflow/macro-data-intake", module: "Macro Intelligence", description: "Load the slow-bias data package before technical analysis starts.", actionsLabel: "Data / Sources", actions: ["COT positioning", "Interest-rate data", "Central bank bias", "Yield spread direction", "Macro calendar", "Data freshness check"], output: "Macro Data Snapshot", ...unimplementedDecisionStatus },
      { number: "06", title: "Currency Strength Matrix", route: "/decision-workflow/currency-strength-matrix", module: "Macro Intelligence", description: "Rank base and quote currencies to prioritize strong-vs-weak opportunities.", actionsLabel: "Matrix Checks", actions: ["Rank USD, EUR, GBP, JPY, CHF, CAD, AUD, NZD", "Strongest currency", "Weakest currency", "Pair strength spread", "Avoid strong-vs-strong", "Avoid weak-vs-weak"], output: "Currency Strength Ranking", ...unimplementedDecisionStatus },
      { number: "07", title: "Macro Confluence Gate", route: "/decision-workflow/macro-confluence-gate", module: "Macro Intelligence", description: "Convert COT, rates, central-bank bias, and currency strength into a macro approval score.", actionsLabel: "Gates", actions: ["COT bias score", "Rate differential score", "Central bank score", "Currency strength score", "Macro risk filter", "Approve, penalize, or block"], output: "Macro Bias Score", ...unimplementedDecisionStatus },
      { number: "08", title: "Analysis Path Selection", route: "/decision-workflow/analysis-path-selection", module: "Analysis Router", description: "Route the opportunity through institutional, retail, or hybrid analysis after macro bias is known.", actionsLabel: "Paths / Rules", actions: ["Institutional Path", "Retail Path", "Hybrid Path", "Institutional mimics institutional order flow", "Retail mimics retail technical behavior", "Hybrid requires macro, institutional, and retail confluence"], output: "Selected Analysis Framework", ...unimplementedDecisionStatus },
      { number: "09", title: "Top-Down Bias Analysis", route: "/decision-workflow/top-down-bias-analysis", module: "Multi-Timeframe Bias Engine", description: "Score MN, W1, D1, H8, H4, H1, and M15 candle/structure direction into a final directional bias.", actionsLabel: "Timeframe Stack", actions: ["MN macro direction", "W1 institutional swing", "D1 daily intent", "H8 session-cycle direction", "H4 structure", "H1 intraday bias", "M15 execution confirmation", "HTF conflict detection"], output: "Directional Bias and Trade Permission", ...unimplementedDecisionStatus },
      { number: "10A", title: "Institutional Analysis", route: "/decision-workflow/institutional-analysis", module: "Institutional Engine", description: "Run smart-money and institutional setup checks.", actionsLabel: "Checks", actions: ["Liquidity analysis", "Order blocks", "Fair value gaps", "Stop hunts", "Market structure", "Smart money concepts", "Institutional bias"], output: "Institutional Setup", ...unimplementedDecisionStatus },
      { number: "10B", title: "Retail Analysis", route: "/decision-workflow/retail-analysis", module: "Retail Engine", description: "Run retail technical-analysis and timing checks.", actionsLabel: "Checks", actions: ["Top-down analysis", "Support and resistance", "Trend direction", "Candlestick confirmation", "Pullback detection", "Multi-timeframe bias", "Entry timing"], output: "Retail Setup", ...unimplementedDecisionStatus },
      { number: "09C", title: "Hybrid Confluence", route: "/decision-workflow/hybrid-confluence", module: "Hybrid Confluence Engine", description: "Merge macro, institutional, and retail evidence into a single confluence score.", actionsLabel: "Checks", actions: ["Macro bias", "Currency strength", "Institutional bias", "Retail bias", "Multi-timeframe confluence", "Entry timing", "Risk/reward check", "Session alignment"], output: "Hybrid Setup", ...unimplementedDecisionStatus },
      { number: "10", title: "Historical Pattern Memory", route: "/decision-workflow/historical-pattern-memory", module: "Advanced Algorithms", description: "Compare the current setup against similar historical contexts and outcomes.", actionsLabel: "Similarity Checks", actions: ["Symbol context", "Session context", "Regime match", "Macro match", "Candle structure match", "Liquidity behavior match", "Outcome distribution"], output: "Historical Similarity Score", ...unimplementedDecisionStatus },
      { number: "11", title: "Candle Intelligence", route: "/decision-workflow/candle-intelligence", module: "Advanced Algorithms", description: "Classify candle pressure, rejection, absorption, continuation, exhaustion, and displacement.", actionsLabel: "Candle Features", actions: ["Body size", "Wick ratios", "Close location", "Sequence direction", "Displacement", "Rejection", "Indecision", "Liquidity grab"], output: "Candle Intelligence Score", ...unimplementedDecisionStatus },
      { number: "12", title: "H8-to-D1 Direction Predictor", route: "/decision-workflow/h8-d1-direction-predictor", module: "Advanced Algorithms", description: "Use Asian, London, and New York H8 session candles to project the developing D1 candle direction.", actionsLabel: "H8 Session Logic", actions: ["Asian range", "London expansion", "New York continuation", "Session high/low sweep", "D1 body projection", "D1 wick risk"], output: "Projected D1 Direction", ...unimplementedDecisionStatus },
      { number: "13", title: "Advanced Feature Engineering", route: "/decision-workflow/advanced-feature-engineering", module: "Advanced Algorithms", description: "Build the decision feature vector from macro, market, institutional, retail, candle, history, risk, and execution inputs.", actionsLabel: "Feature Inputs", actions: ["Regime features", "Macro features", "Historical features", "Candle features", "H8/D1 features", "Institutional features", "Retail features", "Risk features"], output: "Decision Feature Vector", ...unimplementedDecisionStatus },
      { number: "14", title: "Ensemble Prediction", route: "/decision-workflow/ensemble-prediction", module: "Advanced Algorithms", description: "Combine rule-based, statistical, historical, candle, and model-driven predictors into one ensemble probability.", actionsLabel: "Models / Checks", actions: ["Rules model", "Statistical model", "Historical memory model", "Candle model", "Regime model", "Macro model", "Weighted ensemble"], output: "Ensemble Prediction Score", ...unimplementedDecisionStatus },
      { number: "15", title: "Bayesian Confidence Update", route: "/decision-workflow/bayesian-confidence-update", module: "Advanced Algorithms", description: "Update trade confidence as new evidence confirms or weakens the setup.", actionsLabel: "Evidence Updates", actions: ["Prior probability", "Historical evidence", "Candle evidence", "H8/D1 evidence", "Macro evidence", "Institutional evidence", "Retail evidence", "Posterior confidence"], output: "Bayesian Confidence Score", ...unimplementedDecisionStatus },
      { number: "16", title: "Probability Calibration", route: "/decision-workflow/probability-calibration", module: "Advanced Algorithms", description: "Validate that stated confidence matches historical out-of-sample outcomes.", actionsLabel: "Calibration Checks", actions: ["Historical hit rate", "Prediction bucket accuracy", "Walk-forward result", "Brier score", "Calibration penalty", "Confidence cap"], output: "Calibrated Probability", ...unimplementedDecisionStatus },
      { number: "17", title: "Opportunity Detection", route: "/decision-workflow/opportunity-detection", module: "Opportunity Scanner", description: "Detect, rank, and pass a potential setup into validation.", actionsLabel: "Detection / Actions", actions: ["Buy opportunity", "Sell opportunity", "Watchlist setup", "Detect valid setup", "Rank opportunity", "Assign confidence", "Pass to validation"], output: "Potential Trade Setup", ...unimplementedDecisionStatus },
    ],
  },
  {
    title: "Phase 2: Decision Intelligence",
    goal: "Validate opportunity, assess risk, and generate AI trading decision.",
    input: "Potential Trade Setup Identified",
    output: "Open Position or No-Trade Log",
    stages: [
      { number: "18", title: "Opportunity Validation", route: "/decision-workflow/opportunity-validation", module: "Opportunity Validation Engine", description: "Validate market structure, macro alignment, historical/candle confidence, timing, and event risk before decisioning.", actionsLabel: "Checks", actions: ["Macro alignment", "Currency strength alignment", "Historical similarity", "Candle intelligence", "H8/D1 projection", "Ensemble prediction", "Bayesian confidence", "Calibration check", "Entry timing"], output: "Valid Setup or Rejected Setup", ...unimplementedDecisionStatus },
      { number: "19", title: "Anomaly Detection", route: "/decision-workflow/anomaly-detection", module: "Advanced Algorithms", description: "Block trades when spread, volatility, broker, price action, or data behavior becomes abnormal.", actionsLabel: "Anomaly Checks", actions: ["Spread anomaly", "Volatility shock", "Latency anomaly", "Data gap", "Broker rejection risk", "News shock", "Candle expansion anomaly"], output: "Normal or Blocked", ...unimplementedDecisionStatus },
      { number: "20", title: "Risk Assessment", route: "/decision-workflow/risk-assessment", module: "Risk Engine", description: "Score the setup against position, drawdown, margin, and exposure rules.", actionsLabel: "Checks", actions: ["Position size", "Risk percentage", "Drawdown impact", "Margin impact", "Correlation exposure", "Basket exposure", "Account exposure"], output: "Risk Score", ...unimplementedDecisionStatus },
      { number: "21", title: "Execution Quality Scoring", route: "/decision-workflow/execution-quality-scoring", module: "Advanced Algorithms", description: "Score broker, spread, slippage, latency, and fill quality before allowing autonomous execution.", actionsLabel: "Execution Checks", actions: ["Spread quality", "Slippage quality", "Latency quality", "Fill reliability", "Broker readiness", "Reject if poor quality"], output: "Execution Quality Score", ...unimplementedDecisionStatus },
      { number: "22", title: "AI Decision Engine", route: "/decision-workflow/ai-decision-engine", module: "AI Decision Engine", description: "Generate the formal AI decision record and trade intent.", actionsLabel: "Decision Record", actions: ["BUY / SELL / WAIT", "NO TRADE / REJECTED", "Selected mode", "Selected symbol", "Historical similarity", "Candle score", "H8/D1 projection", "Macro bias score", "Ensemble score", "Bayesian score", "Calibrated probability", "Execution quality", "Confidence score", "Risk score"], output: "AI Decision", ...unimplementedDecisionStatus },
      { number: "23", title: "Risk Approval", route: "/decision-workflow/risk-approval", module: "Risk Approval Engine", description: "Approve or block the decision using account and prop-firm guardrails.", actionsLabel: "Checks", actions: ["Daily loss limit", "Weekly loss limit", "Monthly loss limit", "Drawdown limit", "Account exposure", "Margin level", "Basket limit", "Prop firm rules"], output: "Approved or Blocked", ...unimplementedDecisionStatus },
      { number: "24", title: "Execution Approval", route: "/decision-workflow/execution-approval", module: "Execution Approval Engine", description: "Confirm broker, MT5, spread, order, and account readiness.", actionsLabel: "Checks", actions: ["MT5 connection", "Broker status", "Spread condition", "Slippage tolerance", "Order type", "Lot size", "Stop loss", "Take profit", "Account environment"], output: "Ready, Wait, or Cancel", ...unimplementedDecisionStatus },
      { number: "25", title: "Trade Execution / No-Trade Log", route: "/decision-workflow/trade-execution", module: "Trade Execution Engine", description: "Execute approved orders or preserve rejected decisions for learning and audit.", actionsLabel: "If Approved / Not Approved", actions: ["Place market, limit, or stop order", "Route order to MT5", "Confirm broker response", "Generate order ID", "Generate position ID", "Log no-trade reason", "Save rejected decision", "Send to learning and audit"], output: "Order Executed or No-Trade Logged", ...unimplementedDecisionStatus },
    ],
  },
  {
    title: "Phase 3: Trade Management",
    goal: "Manage open positions, protect capital and lock profits.",
    input: "Open Position",
    output: "Protected Position / Closed Trade",
    stages: [
      { number: "14", title: "Trade Monitoring", route: "/decision-workflow/trade-monitoring", module: "Trade Management Engine", description: "Track live position health and market context after execution.", actionsLabel: "Tracks", actions: ["Floating profit/loss", "Price movement", "Candle direction", "Basket exposure", "Spread change", "News impact", "Position health"], output: "Live Position Status", ...unimplementedDecisionStatus },
      { number: "15", title: "Profit Lock Engine", route: "/decision-workflow/profit-lock", module: "Profit Protection Engine", description: "Protect profitable trades with configurable and dynamic profit locks.", actionsLabel: "Actions / Examples", actions: ["Break-even protection", "Profit lock levels", "Dynamic trailing stop", "Partial close", "Basket profit lock", "Equity protection", "+10", "+20", "+50", "+100", "Dynamic lock"], output: "Locked Profit", ...unimplementedDecisionStatus },
      { number: "16", title: "Risk Control", route: "/decision-workflow/risk-control", module: "Risk Control Engine", description: "Reduce exposure and protect the account when risk conditions change.", actionsLabel: "Actions", actions: ["Exposure reduction", "Partial close", "Basket control", "Drawdown protection", "Emergency exit", "Risk-based position reduction"], output: "Risk Protected", ...unimplementedDecisionStatus },
      { number: "17", title: "Exit Decision", route: "/decision-workflow/exit-decision", module: "Exit Manager", description: "Determine whether position closure is required by profit, risk, or market logic.", actionsLabel: "Exit Triggers", actions: ["Take profit hit", "Stop loss hit", "AI exit signal", "Profit lock exit", "Risk rule exit", "Session close", "Reversal signal"], output: "Exit Decision", ...unimplementedDecisionStatus },
      { number: "18", title: "Trade Closure", route: "/decision-workflow/trade-closure", module: "Trade Closure Engine", description: "Close the position and update trade/account records.", actionsLabel: "Actions", actions: ["Close position", "Confirm broker closure", "Update records", "Calculate profit/loss", "Update account equity"], output: "Closed Trade", ...unimplementedDecisionStatus },
    ],
  },
  {
    title: "Phase 4: Knowledge & Governance",
    goal: "Analyze performance, generate reports, document learning, and ensure traceability.",
    input: "Closed Trade",
    output: "Insights, Reports, Learning Records, and Audit Records",
    stages: [
      { number: "19", title: "Performance Analytics", route: "/decision-workflow/performance-analytics", module: "Performance Analytics Engine", description: "Measure trade, strategy, symbol, and session performance after closure.", actionsLabel: "Analytics", actions: ["Trade metrics", "Win/loss analysis", "Equity curve", "Strategy performance", "Symbol performance", "Session performance"], output: "Performance Report", ...unimplementedDecisionStatus },
      { number: "20", title: "Learning Center", route: "/decision-workflow/learning-center", module: "Learning Center", description: "Document AI explanations, decisions, outcomes, and lessons learned.", actionsLabel: "Documents", actions: ["Why trade was taken", "Why trade was rejected", "Why profit was locked", "Why trade was closed", "Lessons learned", "AI explanations"], output: "Trade Lessons", ...unimplementedDecisionStatus },
      { number: "21", title: "Report Generation", route: "/decision-workflow/report-generation", module: "Reporting Engine", description: "Generate scheduled and ad hoc reports with export formats.", actionsLabel: "Reports / Exports", actions: ["Daily report", "Weekly report", "Monthly report", "Custom report", "Export data", "PDF", "Excel", "CSV"], output: "Reports and Exports", ...unimplementedDecisionStatus },
      { number: "22", title: "Audit Trail", route: "/decision-workflow/audit-trail", module: "Audit Engine", description: "Record the complete evidence chain for compliance and accountability.", actionsLabel: "Logs", actions: ["Mode and symbol", "AI decisions", "Risk approvals", "Executions", "User/system actions", "Timestamps", "Compliance logs", "Account records", "Broker response"], output: "Audit Records", ...unimplementedDecisionStatus },
    ],
  },
];

const decisionSupportingServices = [
  { name: "Accounts & Brokers", route: "/accounts-brokers", submodules: ["Trading Accounts", "MT5 Terminals", "Broker Connections", "Account Sync"], ...unimplementedDecisionStatus },
  { name: "Strategy Management", route: "/strategy-management", submodules: ["Best Strategy Set", "A-Grade Setups", "Performance Tracking", "Strategy Allocation"], ...unimplementedDecisionStatus },
  { name: "Backtesting & Simulation", route: "/backtesting", submodules: ["Backtest Dashboard", "Market Replay", "Optimization", "Walk-Forward Testing"], ...unimplementedDecisionStatus },
  { name: "User Management", route: "/user-management", submodules: ["Users & Profiles", "Roles & Permissions", "Account Assignment", "Login Sessions"], ...unimplementedDecisionStatus },
  { name: "Administration", route: "/administration", submodules: ["System Settings", "Trading Settings", "Risk Settings", "Global Controls"], ...unimplementedDecisionStatus },
  { name: "Security & Compliance", route: "/security-compliance", submodules: ["Authentication & MFA", "RBAC & Permissions", "Compliance Rules", "Audit Trail"], ...unimplementedDecisionStatus },
  { name: "System Monitoring", route: "/system-monitoring", submodules: ["MT5 Bridge Health", "API Monitoring", "Latency & Errors", "System Logs"], ...unimplementedDecisionStatus },
  { name: "Data Management", route: "/data-management", submodules: ["SQL Server", "Redis Cache", "Prediction History", "Market Snapshots"], ...unimplementedDecisionStatus },
];

const sharedDecisionIdentifiers = ["modeId", "symbolId", "setupId", "decisionId", "riskAssessmentId", "approvalId", "orderId", "positionId", "closeId", "reportId", "lessonId", "auditId", "accountId", "userId", "strategyId"];
const learningLoop = ["Audit Trail", "Learning Center", "AI Model Improvement", "Strategy Optimization", "Knowledge Feedback", "Market Intelligence"];

const projectStatusSummary = [
  { label: "Total Stages", count: 22, percent: 100, description: "All Workflow Stages", status: "Total", icon: Archive },
  { label: "Implemented", count: 0, percent: 0, description: "Dedicated pages completed and verified", status: "Completed", icon: CheckCircle2 },
  { label: "In Development", count: 0, percent: 0, description: "Dedicated pages currently being built", status: "In Progress", icon: RefreshCw },
  { label: "Pending", count: 0, percent: 0, description: "Queued for implementation", status: "Pending", icon: Clock },
  { label: "Not Implemented", count: 22, percent: 100, description: "Linked workflow pages do not have dedicated implementations yet", status: "Not Implemented", icon: AlertCircle },
];

const projectStatusLegend = [
  { label: "Implemented", rule: "100%", description: "Dedicated page exists and has been verified", status: "Completed", icon: CheckCircle2 },
  { label: "In Development", rule: "1%-99%", description: "Dedicated page implementation has started", status: "In Progress", icon: RefreshCw },
  { label: "Pending", rule: "Queued", description: "Ready to implement after dependencies", status: "Pending", icon: Clock },
  { label: "Not Implemented", rule: "0%", description: "Only linked through the workflow shell for now", status: "Not Implemented", icon: AlertCircle },
];

const progressTrendPoints = [0, 0, 0, 0, 0, 0, 0];

const engineControlMetrics = [
  { label: "Engine State", value: "Running", delta: "Autonomous guard active", tone: "success" as const },
  { label: "Trading Permission", value: "Paused", delta: "Manual approval required", tone: "warning" as const },
  { label: "Mode", value: "Hybrid", delta: "Default profit mode", tone: "info" as const },
  { label: "Environment", value: "Demo", delta: "Live locked", tone: "success" as const },
  { label: "Risk Envelope", value: "0.8%", delta: "Max per trade", tone: "info" as const },
  { label: "Last Heartbeat", value: "4s", delta: "MT5 bridge online", tone: "success" as const },
];

const engineReadinessChecks = [
  { name: "Backend API", status: "Healthy", detail: "REST and SignalR contracts reachable", tone: "success" as const },
  { name: "MT5 Bridge", status: "Connected", detail: "Heartbeat accepted from terminal MT5-02", tone: "success" as const },
  { name: "Risk Service", status: "Guarding", detail: "Daily loss, exposure, and position limits enforced", tone: "success" as const },
  { name: "Broker Session", status: "Demo Only", detail: "Live execution remains locked by policy", tone: "warning" as const },
  { name: "AI Decision Gate", status: "Review", detail: "Trades require human confirmation before routing", tone: "warning" as const },
  { name: "Audit Stream", status: "Ready", detail: "Every state transition writes an auditId", tone: "success" as const },
];

const engineControlActions = [
  { title: "Start Engine", detail: "Boot orchestration, reconnect market streams, and enable readiness checks.", icon: Play, variant: "primary" as const },
  { title: "Pause Trading", detail: "Keep analytics running while blocking new order routing.", icon: Pause, variant: "secondary" as const },
  { title: "Resume Trading", detail: "Restore trade permission after all readiness gates pass.", icon: RefreshCw, variant: "secondary" as const },
  { title: "Emergency Stop", detail: "Halt automation, cancel pending routes, and notify risk owners.", icon: Power, variant: "danger" as const },
];

const enginePolicyRows = [
  { rule: "Execution scope", value: "Demo auto-execution allowed; live requires approval", owner: "Trading Control", status: "Enforced", tone: "success" as const },
  { rule: "Autonomy level", value: "AI recommendation with manual execution approval", owner: "Risk Manager", status: "Review", tone: "warning" as const },
  { rule: "Kill switch", value: "Daily loss, bridge failure, news risk, and prop breach triggers", owner: "Risk Engine", status: "Armed", tone: "success" as const },
  { rule: "Audit requirement", value: "startId, stopId, userId, accountId, and reason required", owner: "Compliance", status: "Required", tone: "info" as const },
];

const engineStatusTimeline = [
  { time: "09:48:12", event: "Engine heartbeat accepted", detail: "SignalR hub published EngineRunning with bridge latency 31 ms.", tone: "success" as const },
  { time: "09:46:30", event: "Trading permission paused", detail: "Operator changed routing state to manual approval for live accounts.", tone: "warning" as const },
  { time: "09:44:05", event: "Risk envelope refreshed", detail: "Daily drawdown 1.4% of 5.0%, correlation exposure within limit.", tone: "success" as const },
  { time: "09:41:22", event: "MT5 bridge connected", detail: "Terminal MT5-02 registered account ACC-2201 and broker heartbeat.", tone: "success" as const },
];

const engineLinkedRecords = [
  { label: "engineSessionId", value: "ENG-2026-0622-0948", href: "/system-monitoring/engine-health" },
  { label: "accountId", value: "ACC-2201", href: "/accounts-brokers/trading-accounts" },
  { label: "riskPolicyId", value: "RISK-HYB-008", href: "/risk-management/dashboard" },
  { label: "auditId", value: "AUD-9173", href: "/administration/audit-logs" },
];

export function CommandCenterPage({ path }: { path: string }) {
  const page = findPageByPath(path);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [engineRunning, setEngineRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("Operations");

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("cacsms.sidebar.collapsed") === "true");
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((value) => {
      const nextValue = !value;
      window.localStorage.setItem("cacsms.sidebar.collapsed", String(nextValue));
      return nextValue;
    });
  };

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
  const isDashboardPage = page.path === "/dashboard";
  const isProcessStatusWorkflowPage = page.path === "/dashboard/process-status-workflow";
  const isDecisionStatusWorkflowPage = page.path === "/dashboard/ai-decision-status-workflow";
  const isDecisionWorkbenchPage =
    page.path === "/ai-decision-engine/decision-workbench" || page.path === "/ai-decision-engine/history";
  const isCurrencyStrengthMatrixPage = page.path === "/macro-intelligence/currency-strength-matrix";
  const isCotPositioningPage = page.path === "/macro-intelligence/cot-positioning";
  const isTradingEnginePage = page.path === "/trading-control/engine";
  const isRuntimeConfigPage = page.path === "/trading-control/runtime-config";
  const isDataSourcesPage = page.path === "/system-monitoring/data-sources";
  const isSymbolSelectionRulesPage = page.path === "/market-intelligence/symbol-selection-rules";
  const isBridgeSettingsPage = page.path === "/accounts-brokers/api-bridge";
  const topbarSubtitle = isDashboardPage
    ? "Welcome back, Alex! Here's what's happening with your trading engine today."
    : isCotPositioningPage
      ? "Commitment of Traders report analysis and institutional positioning"
      : description;

  return (
    <AppLayout
      collapsed={sidebarCollapsed}
      onToggleSidebar={toggleSidebar}
      topbar={
        isProcessStatusWorkflowPage ? null : (
          <Topbar title={title} subtitle={topbarSubtitle} engineRunning={engineRunning} onToggleEngine={() => setEngineRunning((value) => !value)} onOpenDrawer={() => setDrawerOpen(true)} />
        )
      }
      sidebar={<Sidebar collapsed={sidebarCollapsed} currentPath={page.path} onToggle={toggleSidebar} />}
      pageChrome={isProcessStatusWorkflowPage ? "figma" : "standard"}
    >
      {isDashboardPage ? (
        <DashboardReplicaPage />
      ) : isProcessStatusWorkflowPage ? (
        <ProcessStatusWorkflowBoard />
      ) : isLifecycleStatusPage ? (
        <LifecycleStatusBoard page={page} />
      ) : isDecisionStatusWorkflowPage ? (
        <DecisionStatusWorkflowBoard page={page} />
      ) : isDecisionWorkbenchPage ? (
        <DecisionWorkbenchBoard page={page} Breadcrumbs={Breadcrumbs} />
      ) : isCurrencyStrengthMatrixPage ? (
        <CurrencyStrengthMatrixBoard page={page} Breadcrumbs={Breadcrumbs} />
      ) : isCotPositioningPage ? (
        <CotPositioningBoard />
      ) : isTradingEnginePage ? (
        <TradingEngineControlPage
          page={page}
          engineRunning={engineRunning}
          onToggleEngine={() => setEngineRunning((value) => !value)}
          onOpenDrawer={() => setDrawerOpen(true)}
          onConfirm={() => setConfirmOpen(true)}
        />
      ) : isRuntimeConfigPage ? (
        <RuntimeConfigPage page={page} />
      ) : isDataSourcesPage ? (
        <DataSourcesStatusPage page={page} />
      ) : isSymbolSelectionRulesPage ? (
        <SymbolSelectionRulesPage page={page} />
      ) : isBridgeSettingsPage ? (
        <BridgeSettingsPage page={page} />
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
  pageChrome = "standard",
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  collapsed: boolean;
  onToggleSidebar: () => void;
  pageChrome?: "standard" | "figma";
}) {
  return (
    <div className={clsx("app-shell", collapsed && "sidebar-collapsed", pageChrome === "figma" && "figma-page-shell")}>
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
  const sidebarRef = useRef<HTMLElement>(null);
  const [openModulePath, setOpenModulePath] = useState<string | null>(null);

  useLayoutEffect(() => {
    setOpenModulePath(window.sessionStorage.getItem("cacsms.sidebar.openModulePath"));

    const clearOpenModuleOnRefresh = () => {
      window.sessionStorage.removeItem("cacsms.sidebar.openModulePath");
    };

    window.addEventListener("beforeunload", clearOpenModuleOnRefresh);
    return () => window.removeEventListener("beforeunload", clearOpenModuleOnRefresh);
  }, []);

  useLayoutEffect(() => {
    const savedScrollTop = window.sessionStorage.getItem("cacsms.sidebar.scrollTop");

    if (savedScrollTop && sidebarRef.current) {
      sidebarRef.current.scrollTop = Number(savedScrollTop);
    }
  }, [currentPath]);

  const rememberSidebarPosition = () => {
    if (sidebarRef.current) {
      window.sessionStorage.setItem("cacsms.sidebar.scrollTop", String(sidebarRef.current.scrollTop));
    }
  };

  const toggleModule = (modulePath: string) => {
    setOpenModulePath((currentPath) => {
      const nextPath = currentPath === modulePath ? null : modulePath;

      if (nextPath) {
        window.sessionStorage.setItem("cacsms.sidebar.openModulePath", nextPath);
      } else {
        window.sessionStorage.removeItem("cacsms.sidebar.openModulePath");
      }

      return nextPath;
    });
  };

  const handleNavigate = (modulePath: string) => {
    rememberSidebarPosition();
    setOpenModulePath(modulePath);
    window.sessionStorage.setItem("cacsms.sidebar.openModulePath", modulePath);
  };

  return (
    <aside className="sidebar" ref={sidebarRef} data-collapsed={collapsed}>
      <div className="brand-block">
        <div className="brand-mark">CE</div>
        {!collapsed && (
          <div>
            <strong>Cacsms Engine</strong>
            <span>Trading Command Center</span>
          </div>
        )}
        <button className="sidebar-collapse-button" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronRight className="collapse-left-icon" size={17} />}
        </button>
      </div>
      <nav className="sidebar-nav" aria-label="Primary modules">
        {sections.map((section) => (
          <SidebarSection
            key={section.title}
            section={section}
            currentPath={currentPath}
            collapsed={collapsed}
            openModulePath={openModulePath}
            onToggleModule={toggleModule}
            onNavigate={handleNavigate}
          />
        ))}
      </nav>
    </aside>
  );
}

function SidebarSection({
  section,
  currentPath,
  collapsed,
  openModulePath,
  onToggleModule,
  onNavigate,
}: {
  section: ReturnType<typeof visibleNavigationSections>[number];
  currentPath: string;
  collapsed: boolean;
  openModulePath: string | null;
  onToggleModule: (modulePath: string) => void;
  onNavigate: (modulePath: string) => void;
}) {
  const active = section.modules.some((module) => currentPath === module.path || currentPath.startsWith(`${module.path}/`));
  const pageCount = section.modules.reduce((sum, module) => sum + module.submodules.length, 0);

  if (collapsed) {
    return (
      <div className="sidebar-section collapsed-section">
        {section.modules.map((module) => (
          <SidebarGroup
            key={module.path}
            module={module}
            currentPath={currentPath}
            collapsed={collapsed}
            expanded={false}
            onToggle={() => onToggleModule(module.path)}
            onNavigate={() => onNavigate(module.path)}
          />
        ))}
      </div>
    );
  }

  return (
    <section className={clsx("sidebar-section", active && "active")}>
      <div className="section-toggle" aria-label={section.title}>
        <span>
          <strong>{section.title}</strong>
          <small>{section.description}</small>
        </span>
        <em>{section.modules.length}/{pageCount}</em>
      </div>
      <div className="section-branches">
        {section.modules.map((module) => (
          <SidebarGroup
            key={module.path}
            module={module}
            currentPath={currentPath}
            collapsed={collapsed}
            expanded={openModulePath === module.path}
            onToggle={() => onToggleModule(module.path)}
            onNavigate={() => onNavigate(module.path)}
          />
        ))}
      </div>
    </section>
  );
}

function SidebarGroup({
  module,
  currentPath,
  collapsed,
  expanded,
  onToggle,
  onNavigate,
}: {
  module: Module;
  currentPath: string;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const Icon = module.icon;
  const active = currentPath === module.path || currentPath.startsWith(`${module.path}/`);

  return (
    <div className="sidebar-group">
      <div className={clsx("sidebar-row", active && "active")}>
        <Link href={module.path} className="sidebar-link" title={module.title} onClick={onNavigate}>
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
          <button className="sidebar-expander" onClick={onToggle} aria-label={`Toggle ${module.title}`} aria-expanded={expanded}>
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        )}
      </div>
      {!collapsed && expanded && (
        <div className="sidebar-subitems">
          {module.submodules.map((submodule, index) => (
            <Link key={submodule.path} className={clsx("sidebar-subitem", currentPath === submodule.path && "active")} href={submodule.path} onClick={onNavigate}>
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
  title,
  subtitle,
  engineRunning,
  onToggleEngine,
  onOpenDrawer,
}: {
  title: string;
  subtitle: string;
  engineRunning: boolean;
  onToggleEngine: () => void;
  onOpenDrawer: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-title-block">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <SearchInput />
      <div className="topbar-actions">
        <EngineHeaderControl
          running={engineRunning}
          onToggle={onToggleEngine}
          label={title === "COT Positioning" ? "London Server" : "London Session"}
          status={title === "COT Positioning" ? "Connected" : engineRunning ? "Open" : "Closed"}
        />
        <NigeriaClock />
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

function EngineHeaderControl({
  running,
  onToggle,
  label,
  status,
}: {
  running: boolean;
  onToggle: () => void;
  label: string;
  status: string;
}) {
  return (
    <div className={clsx("engine-header-control", running ? "running" : "stopped")} aria-label="Trading engine control">
      <span>
        <strong>{label}</strong>
        <small>{status}</small>
      </span>
      <button className={clsx("button", running ? "button-danger" : "button-primary")} onClick={onToggle}>
        <ChevronDown size={16} />
        Session
      </button>
    </div>
  );
}

function NigeriaClock() {
  const [time, setTime] = useState("00:00:00");

  useEffect(() => {
    const formatTime = () => {
      setTime(new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Africa/Lagos",
      }).format(new Date()));
    };

    formatTime();
    const timer = window.setInterval(formatTime, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="nigeria-clock" aria-label="Nigeria local time">
      <strong>{time}</strong>
      <small>WAT UTC+1</small>
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

function ProcessStatusWorkflowBoard() {
  return (
    <section className="process-figma-replica" aria-label="Process Status Workflow exact Figma replica">
      <div className="process-figma-frame">
        <img src={processWorkflowImageSrc} alt="CACSMS Engine - Currency-First Stage Workflow" draggable={false} />
        <ProcessWorkflowOverallCompletion />
        <ProcessWorkflowLiveStatus />
        <ProcessWorkflowFoundationStatus />
        <nav className="process-figma-hotspots" aria-label="Workflow stage links">
          {processHotspots.map((hotspot) => (
            <Link
              key={hotspot.label}
              href={hotspot.href}
              className="process-figma-hotspot"
              style={{
                left: `${hotspot.x}%`,
                top: `${hotspot.y}%`,
                width: `${hotspot.w}%`,
                height: `${hotspot.h}%`,
              }}
              title={hotspot.label}
              aria-label={hotspot.label}
            />
          ))}
        </nav>
      </div>
    </section>
  );
}

function ProcessWorkflowOverallCompletion() {
  const [completion, setCompletion] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCompletion = async () => {
      try {
        const response = await fetch("/api/workflow/status", { cache: "no-store" });

        if (!response.ok) {
          if (!cancelled) setCompletion(null);
          return;
        }

        const overview = (await response.json()) as ProcessWorkflowOverviewResponse;
        const nextCompletion = Number(overview.overallCompletion ?? overview.OverallCompletion);

        if (!cancelled && Number.isFinite(nextCompletion)) {
          setCompletion(Math.max(0, Math.min(100, Math.round(nextCompletion))));
        }
      } catch {
        if (!cancelled) setCompletion(null);
      }
    };

    void loadCompletion();
    const timer = window.setInterval(loadCompletion, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const displayCompletion = completion === null ? "--" : `${completion}%`;
  const barCompletion = completion ?? 0;

  return (
    <div className={clsx("process-figma-completion", completion === null && "unavailable")} aria-label={completion === null ? "Overall completion unavailable" : `Overall completion ${completion}%`}>
      <span>Overall Completion</span>
      <strong>{displayCompletion}</strong>
      <div><i style={{ width: `${barCompletion}%` }} /></div>
    </div>
  );
}

function ProcessWorkflowFoundationStatus() {
  const [statuses, setStatuses] = useState<ProcessStageLiveStatus[]>(initialProcessStageStatuses);

  useEffect(() => {
    let cancelled = false;

    const loadStatuses = async () => {
      const nextStatuses = await Promise.all([
        resolveEngineStageStatus(),
        resolveRuntimeConfigStageStatus(),
        resolveDataSourcesStageStatus(),
        resolveCurrencyStrengthStageStatus(),
      ]);

      if (!cancelled) {
        setStatuses(nextStatuses);
      }
    };

    void loadStatuses();
    const timer = window.setInterval(loadStatuses, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="process-figma-stage-overlays" aria-label="Live foundation stage statuses">
      {statuses.map((stage) => (
        <div key={stage.code} className={clsx("process-figma-stage-status", `stage-${stage.code}`, `tone-${stage.tone}`)}>
          <span>{stage.status}</span>
          <div><i style={{ width: `${stage.progress}%` }} /></div>
          <strong>{stage.progress}%</strong>
          <em>{stage.note}</em>
        </div>
      ))}
    </div>
  );
}

async function resolveEngineStageStatus(): Promise<ProcessStageLiveStatus> {
  try {
    const response = await fetch("/api/engine/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Engine API unavailable");
    const status = (await response.json()) as EngineRuntimeStatus;
    const running = status.state === "RUNNING";

    return {
      code: "01",
      status: running ? "Completed" : "Stopped",
      progress: running ? 100 : 0,
      note: status.reason || (running ? "Engine running" : "Engine stopped"),
      tone: running ? "green" : "slate",
    };
  } catch {
    return { code: "01", status: "Offline", progress: 0, note: "Engine API unavailable", tone: "red" };
  }
}

async function resolveRuntimeConfigStageStatus(): Promise<ProcessStageLiveStatus> {
  try {
    const response = await fetch("/api/runtime/config", { cache: "no-store" });
    if (!response.ok) throw new Error("Runtime config unavailable");
    const config = (await response.json()) as RuntimeConfig;
    const configured = config.riskProfile !== "NotConfigured"
      && config.maxRiskPerTradePercent > 0
      && config.dailyDrawdownLimitPercent > 0;

    return {
      code: "02",
      status: configured ? "Completed" : "Pending Data",
      progress: configured ? 100 : 25,
      note: configured ? "Runtime limits loaded" : "Risk config incomplete",
      tone: configured ? "green" : "amber",
    };
  } catch {
    return { code: "02", status: "Offline", progress: 0, note: "Runtime API unavailable", tone: "red" };
  }
}

async function resolveDataSourcesStageStatus(): Promise<ProcessStageLiveStatus> {
  try {
    const response = await fetch("/api/system/data-sources/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Data-source API unavailable");
    const overview = (await response.json()) as DataSourcesOverview;
    const total = overview.sources.length;
    const progress = total > 0 ? Math.round((overview.healthy / total) * 100) : 0;
    const blocked = overview.offline > 0;

    return {
      code: "03",
      status: progress === 100 ? "Completed" : blocked ? "Blocked" : "In Progress",
      progress,
      note: `${overview.healthy} healthy, ${overview.offline} offline`,
      tone: progress === 100 ? "green" : blocked ? "red" : "amber",
    };
  } catch {
    return { code: "03", status: "Offline", progress: 0, note: "Source API unavailable", tone: "red" };
  }
}

async function resolveCurrencyStrengthStageStatus(): Promise<ProcessStageLiveStatus> {
  try {
    const response = await fetch("/api/intelligence/currency-strength/latest", { cache: "no-store" });
    if (!response.ok) throw new Error("Currency strength unavailable");
    const snapshot = (await response.json()) as ProcessCurrencyStrengthStatusResponse;
    const source = String(snapshot.source ?? snapshot.Source ?? "unavailable");
    const hasLiveFeed = source.toLowerCase() !== "unavailable";

    return {
      code: "04",
      status: hasLiveFeed ? "Completed" : "Pending Data",
      progress: hasLiveFeed ? 100 : 0,
      note: hasLiveFeed ? `${source.toUpperCase()} strength matrix live` : "Awaiting live strength feed",
      tone: hasLiveFeed ? "green" : "amber",
    };
  } catch {
    return { code: "04", status: "Offline", progress: 0, note: "Strength API unavailable", tone: "red" };
  }
}

function ProcessWorkflowLiveStatus() {
  const [liveTime, setLiveTime] = useState(processWorkflowStaticLiveTime);
  const [engineStatus, setEngineStatus] = useState<ProcessEngineRuntimeStatus>("OFFLINE");
  const [engineCommanding, setEngineCommanding] = useState(false);

  useEffect(() => {
    const formatLiveTime = () => {
      const now = new Date();
      const dateParts = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Lagos",
      }).format(now);
      const timeParts = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Africa/Lagos",
      }).format(now);

      setLiveTime(`Live: ${dateParts}, ${timeParts}`);
    };

    formatLiveTime();
    const timer = window.setInterval(formatLiveTime, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadEngineStatus = async () => {
      try {
        const response = await fetch("/api/engine/status", { cache: "no-store" });
        if (!response.ok) throw new Error("Engine API offline");
        const status = (await response.json()) as EngineRuntimeStatus;
        if (!cancelled) setEngineStatus(status.state === "RUNNING" ? "RUNNING" : "OFFLINE");
      } catch {
        if (!cancelled) setEngineStatus("OFFLINE");
      }
    };

    void loadEngineStatus();
    const timer = window.setInterval(loadEngineStatus, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const toggleEngineStatus = async () => {
    setEngineCommanding(true);

    try {
      const endpoint = engineStatus === "RUNNING" ? "/api/engine/stop" : "/api/engine/start";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Workflow header engine-status toggle." }),
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Engine command failed");
      const status = (await response.json()) as EngineRuntimeStatus;
      setEngineStatus(status.state === "RUNNING" ? "RUNNING" : "OFFLINE");
    } catch {
      setEngineStatus("OFFLINE");
    } finally {
      setEngineCommanding(false);
    }
  };

  return (
    <>
      <div className="process-figma-live-clock" aria-label="Live Nigeria time">{liveTime}</div>
      <div className="process-figma-engine-line">
        <span>Engine Status:</span>
        <button
          type="button"
          className={clsx("process-figma-engine-status", engineStatus.toLowerCase())}
          disabled={engineCommanding}
          onClick={() => void toggleEngineStatus()}
          aria-label={`Engine status ${engineStatus}. Click to switch to ${engineStatus === "RUNNING" ? "OFFLINE" : "RUNNING"}.`}
          title={`Click to switch engine status to ${engineStatus === "RUNNING" ? "OFFLINE" : "RUNNING"}`}
        >
          <strong>{engineStatus}</strong>
          <i />
        </button>
      </div>
    </>
  );
}

function WorkflowColumnHeader({ column }: { column: ProcessWorkflowColumn }) {
  const Icon = column.icon;
  return (
    <div className={clsx("process-column-header", `process-column-header-${column.accent}`)}>
      <Icon size={24} />
      <div>
        <h2>{column.title}</h2>
        <p>{column.description}</p>
      </div>
    </div>
  );
}

function ProcessStageCard({ stage, compact = false }: { stage: ProcessWorkflowStage; compact?: boolean }) {
  const Icon = stage.icon;
  return (
    <article className={clsx("process-stage-card", compact && "compact", `process-stage-${stage.accent}`)}>
      <div className="process-stage-number">{stage.number}</div>
      <div className="process-stage-body">
        <div className="process-stage-topline">
          <div>
            <h3>{stage.name}</h3>
            <p>{stage.owner}</p>
          </div>
          <Icon size={compact ? 16 : 20} />
        </div>
        <div className="process-stage-meta">
          <span className={clsx("process-status-chip", processStatusClass(stage.status))}>{stage.status}</span>
          <em>{stage.progress}%</em>
        </div>
        <div className="process-progress-track">
          <i style={{ width: `${stage.progress}%` }} />
        </div>
        <small>{stage.note}</small>
      </div>
    </article>
  );
}

function InstitutionalValidationPanel() {
  const checks = ["Liquidity OK", "Trading Session OK", "Spread Check OK", "News Filter OK", "Volatility Check OK", "Trading Window OK", "Risk Budget OK"];

  return (
    <section className="process-validation-panel">
      <h3>Institutional Validation</h3>
      <div>
        {checks.map((check) => (
          <span key={check}><CheckCircle2 size={14} />{check}</span>
        ))}
      </div>
      <strong><CheckCircle2 size={16} />All Conditions Valid</strong>
    </section>
  );
}

function ProcessInfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="process-info-panel">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function processStatusClass(status: string) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function RuntimeConfigPage({ page }: { page: ResolvedPage }) {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const loadConfig = useCallback(async (reload = false) => {
    setState("loading");
    setError("");

    try {
      const nextConfig = reload ? await reloadRuntimeConfig() : await getRuntimeConfig();
      setConfig(nextConfig);
      setState("ready");
    } catch (requestError) {
      setConfig(null);
      setState("error");
      setError(requestError instanceof Error ? requestError.message : "Runtime configuration is unavailable.");
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  return (
    <OperationsPageFrame
      page={page}
      eyebrow="Stage 02"
      title="Load Runtime + Risk Config"
      description="Load trading mode, autonomy, risk limits, and environment permissions from production configuration."
      action={<button className="button button-secondary" onClick={() => void loadConfig(true)}><RefreshCw size={16} /> Reload Config</button>}
    >
      <LiveStateBanner state={state} error={error} />
      <section className="ops-grid">
        {config ? (
          <>
            <OpsFact label="Trading Mode" value={config.tradingMode} />
            <OpsFact label="Autonomy Level" value={config.autonomyLevel} />
            <OpsFact label="Risk Profile" value={config.riskProfile} />
            <OpsFact label="Max Risk / Trade" value={`${config.maxRiskPerTradePercent}%`} />
            <OpsFact label="Daily Drawdown Limit" value={`${config.dailyDrawdownLimitPercent}%`} />
            <OpsFact label="Demo Execution" value={config.demoExecutionEnabled ? "Enabled" : "Disabled"} tone={config.demoExecutionEnabled ? "success" : "neutral"} />
            <OpsFact label="Live Execution" value={config.liveExecutionEnabled ? "Enabled" : "Disabled"} tone={config.liveExecutionEnabled ? "danger" : "neutral"} />
            <OpsFact label="Prop Firm Mode" value={config.propFirmModeEnabled ? "Enabled" : "Disabled"} tone={config.propFirmModeEnabled ? "warning" : "neutral"} />
          </>
        ) : (
          <EmptyOpsState message="Runtime configuration has not been loaded from the API." />
        )}
      </section>
      {config && <p className="ops-footnote">Loaded from {config.source} at {formatDateTime(config.loadedAt)}.</p>}
    </OperationsPageFrame>
  );
}

function DataSourcesStatusPage({ page }: { page: ResolvedPage }) {
  const [overview, setOverview] = useState<DataSourcesOverview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const loadSources = useCallback(async () => {
    setState("loading");
    setError("");

    try {
      const nextOverview = await getDataSourcesStatus();
      setOverview(nextOverview);
      setState("ready");
    } catch (requestError) {
      setOverview(null);
      setState("error");
      setError(requestError instanceof Error ? requestError.message : "Data-source status is unavailable.");
    }
  }, []);

  useEffect(() => {
    void loadSources();
    const timer = window.setInterval(() => void loadSources(), 15000);
    return () => window.clearInterval(timer);
  }, [loadSources]);

  return (
    <OperationsPageFrame
      page={page}
      eyebrow="Stage 03"
      title="Verify Data Sources"
      description="Confirm production connectivity for engine runtime, SQL Server, currency strength, MT5 bridge, and macro/news feeds."
      action={<button className="button button-secondary" onClick={() => void loadSources()}><RefreshCw size={16} /> Refresh</button>}
    >
      <LiveStateBanner state={state} error={error} />
      {overview ? (
        <>
          <section className="ops-grid compact">
            <OpsFact label="Healthy" value={overview.healthy} tone="success" />
            <OpsFact label="Degraded" value={overview.degraded} tone="warning" />
            <OpsFact label="Offline" value={overview.offline} tone={overview.offline > 0 ? "danger" : "success"} />
            <OpsFact label="Checked" value={formatDateTime(overview.checkedAt)} />
          </section>
          <section className="ops-list">
            {overview.sources.map((source) => (
              <article key={source.code}>
                <div>
                  <strong>{source.name}</strong>
                  <p>{source.detail}</p>
                </div>
                <StatusBadge tone={source.isHealthy ? "success" : source.status === "UNAVAILABLE" ? "warning" : "danger"}>{source.status}</StatusBadge>
              </article>
            ))}
          </section>
        </>
      ) : (
        <EmptyOpsState message="No data-source status has been returned by the API." />
      )}
    </OperationsPageFrame>
  );
}

function SymbolSelectionRulesPage({ page }: { page: ResolvedPage }) {
  const [overview, setOverview] = useState<SymbolSelectionRulesOverview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const loadRules = useCallback(async () => {
    setState("loading");
    setError("");

    try {
      const nextOverview = await getSymbolSelectionRules();
      setOverview(nextOverview);
      setState("ready");
    } catch (requestError) {
      setOverview(null);
      setState("error");
      setError(requestError instanceof Error ? requestError.message : "Symbol selection rules are unavailable.");
    }
  }, []);

  useEffect(() => {
    void loadRules();
    const timer = window.setInterval(() => void loadRules(), 15000);
    return () => window.clearInterval(timer);
  }, [loadRules]);

  return (
    <OperationsPageFrame
      page={page}
      eyebrow="Selection Rule"
      title="Currency-First Symbol Selection Rules"
      description="Institutional symbol selection using strong-vs-weak currency flow, inverse USD logic for XAUUSD, and mixed-strength no-trade safety gates."
      action={<button className="button button-secondary" onClick={() => void loadRules()}><RefreshCw size={16} /> Re-evaluate</button>}
    >
      <LiveStateBanner state={state} error={error} />
      {overview ? (
        <>
          <section className="ops-list">
            {overview.rules.map((rule) => (
              <article key={rule.code}>
                <div>
                  <strong>{rule.name}</strong>
                  <p>{rule.description}</p>
                </div>
                <StatusBadge tone={rule.status === "ACTIVE" ? "success" : "warning"}>{rule.status}</StatusBadge>
              </article>
            ))}
          </section>
          <section className="ops-table-card">
            <h2>Current Candidates</h2>
            {overview.candidates.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Symbol</th><th>Direction</th><th>Score</th><th>Status</th><th>Evidence</th></tr></thead>
                  <tbody>
                    {overview.candidates.map((candidate) => (
                      <tr key={candidate.symbol}>
                        <td>{candidate.symbol}</td>
                        <td>{candidate.direction}</td>
                        <td>{candidate.score.toFixed(1)}</td>
                        <td><StatusBadge tone={candidate.status === "ELIGIBLE" ? "success" : candidate.status === "BLOCKED" ? "danger" : "warning"}>{candidate.status}</StatusBadge></td>
                        <td>{candidate.evidence.join(" ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyOpsState message="No candidate can be produced until production currency-strength data is ingested." />
            )}
          </section>
        </>
      ) : (
        <EmptyOpsState message="No symbol-selection rule result has been returned by the API." />
      )}
    </OperationsPageFrame>
  );
}

function BridgeSettingsPage({ page }: { page: ResolvedPage }) {
  const [overview, setOverview] = useState<BridgeSettingsOverview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const loadBridge = useCallback(async () => {
    setState("loading");
    setError("");

    try {
      const nextOverview = await getBridgeSettings();
      setOverview(nextOverview);
      setState("ready");
    } catch (requestError) {
      setOverview(null);
      setState("error");
      setError(requestError instanceof Error ? requestError.message : "Bridge settings are unavailable.");
    }
  }, []);

  useEffect(() => {
    void loadBridge();
    const timer = window.setInterval(() => void loadBridge(), 10000);
    return () => window.clearInterval(timer);
  }, [loadBridge]);

  return (
    <OperationsPageFrame
      page={page}
      eyebrow="Accounts & Brokers"
      title="API/Bridge Settings"
      description="Dedicated market-data bridge settings for MT5 terminal telemetry, currency-strength feed health, and CACSMS EA installation status."
      action={<button className="button button-secondary" onClick={() => void loadBridge()}><RefreshCw size={16} /> Refresh bridge</button>}
    >
      <LiveStateBanner state={state} error={error} />
      {overview ? (
        <>
          <section className="ops-grid">
            <OpsFact label="Bridge URL" value={overview.bridgeUrl} tone="neutral" />
            <OpsFact label="Bridge Mode" value={overview.bridgeMode} tone="success" />
            <OpsFact label="MT5 Heartbeat" value={overview.mt5HeartbeatStatus} tone={overview.mt5HeartbeatStatus === "ONLINE" ? "success" : overview.mt5HeartbeatStatus === "DEGRADED" ? "warning" : "danger"} />
            <OpsFact label="Heartbeat Age" value={overview.heartbeatAgeSeconds === null ? "No heartbeat" : `${overview.heartbeatAgeSeconds}s`} tone={overview.heartbeatAgeSeconds !== null && overview.heartbeatAgeSeconds <= 30 ? "success" : "warning"} />
            <OpsFact label="Active EA" value={overview.activeEaName || "No active EA"} tone={overview.dedicatedMarketDataEaActive ? "success" : "warning"} />
            <OpsFact label="Timeframe Feed" value={overview.activeHeartbeatHasTimeframeTelemetry ? "Active" : "Awaiting EA reload"} tone={overview.activeHeartbeatHasTimeframeTelemetry ? "success" : "warning"} />
            <OpsFact label="SQL Server" value={overview.databaseStatus} tone={overview.databaseStatus === "HEALTHY" ? "success" : "danger"} />
            <OpsFact label="Currency Strength" value={overview.currencyStrengthStatus} tone={overview.currencyStrengthStatus === "ONLINE" ? "success" : "warning"} />
          </section>

          <section className="ops-table-card">
            <h2>Dedicated Market Data EA</h2>
            <div className="ops-list">
              <article>
                <div>
                  <strong>{overview.marketDataEaName}</strong>
                  <p>Telemetry-only EA for market data. It does not place, modify, or close trades.</p>
                  <p>Active terminal: {overview.activeTerminalId || "No terminal heartbeat yet"} / {overview.activeBridgeKind || "unknown bridge kind"}</p>
                </div>
                <StatusBadge tone={overview.dedicatedMarketDataEaActive ? "success" : overview.marketDataEaCompiledExists ? "warning" : "danger"}>{overview.dedicatedMarketDataEaActive ? "ACTIVE" : overview.marketDataEaCompiledExists ? "READY" : "MISSING"}</StatusBadge>
              </article>
              <article>
                <div>
                  <strong>Source location</strong>
                  <p className="bridge-path">{overview.marketDataEaSourcePath || "MT5 terminal path not discovered."}</p>
                </div>
                <StatusBadge tone={overview.marketDataEaSourceExists ? "success" : "danger"}>{overview.marketDataEaSourceExists ? "FOUND" : "MISSING"}</StatusBadge>
              </article>
              <article>
                <div>
                  <strong>Compiled location</strong>
                  <p className="bridge-path">{overview.marketDataEaCompiledPath || "Compiled EA path not discovered."}</p>
                  <p>{overview.marketDataEaCompiledAt ? `Compiled ${formatDateTime(overview.marketDataEaCompiledAt)}` : "No compiled timestamp available."}</p>
                </div>
                <StatusBadge tone={overview.marketDataEaCompiledExists ? "success" : "danger"}>{overview.marketDataEaCompiledExists ? "READY" : "NOT READY"}</StatusBadge>
              </article>
            </div>
          </section>

          <section className="ops-table-card">
            <h2>Discovered MT5 Terminals</h2>
            {overview.terminals.length > 0 ? (
              <div className="bridge-terminal-list">
                {overview.terminals.map((terminal) => (
                  <article className="bridge-terminal-card" key={terminal.terminalKey}>
                    <header className="bridge-terminal-header">
                      <div>
                        <strong>{terminal.terminalKey}</strong>
                        <p className="bridge-path">{terminal.terminalPath}</p>
                      </div>
                      <StatusBadge tone={terminal.isActiveTerminal ? "success" : "neutral"}>{terminal.isActiveTerminal ? "ACTIVE" : "IDLE"}</StatusBadge>
                    </header>

                    <dl className="bridge-terminal-grid">
                      <div>
                        <dt>EA Source</dt>
                        <dd>
                          <StatusBadge tone={terminal.marketDataEaSourceExists ? "success" : "warning"}>{terminal.marketDataEaSourceExists ? "FOUND" : "INSTALL NEEDED"}</StatusBadge>
                          <span className="bridge-path">{terminal.marketDataEaSourcePath}</span>
                        </dd>
                      </div>
                      <div>
                        <dt>Compiled EA</dt>
                        <dd>
                          <StatusBadge tone={terminal.marketDataEaCompiledExists ? "success" : "danger"}>{terminal.marketDataEaCompiledExists ? "COMPILED" : "MISSING"}</StatusBadge>
                          <span className="bridge-path">{terminal.marketDataEaCompiledAt ? formatDateTime(terminal.marketDataEaCompiledAt) : terminal.marketDataEaCompiledPath}</span>
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyOpsState message="No local MT5 terminal data folders were discovered for this Windows user." />
            )}
          </section>

          <section className="ops-list">
            {overview.dependencies.map((dependency) => (
              <article key={dependency.code}>
                <div>
                  <strong>{dependency.name}</strong>
                  <p>{dependency.detail}</p>
                </div>
                <StatusBadge tone={dependency.isHealthy ? "success" : dependency.status === "UNAVAILABLE" ? "warning" : "danger"}>{dependency.status}</StatusBadge>
              </article>
            ))}
          </section>
        </>
      ) : (
        <EmptyOpsState message="No bridge settings have been returned by the API." />
      )}
    </OperationsPageFrame>
  );
}

function OperationsPageFrame({
  page,
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  page: ResolvedPage;
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <Breadcrumbs page={page} />
      <section className="ops-page">
        <header className="ops-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {action}
        </header>
        {children}
      </section>
    </>
  );
}

function LiveStateBanner({ state, error }: { state: "loading" | "ready" | "error"; error: string }) {
  if (state === "ready") {
    return <div className="ops-state-banner ready"><CheckCircle2 size={16} /> Live API data loaded.</div>;
  }

  if (state === "error") {
    return <div className="ops-state-banner error"><AlertCircle size={16} /> {error}</div>;
  }

  return <div className="ops-state-banner loading"><RefreshCw size={16} /> Loading live API data...</div>;
}

function OpsFact({ label, value, tone = "neutral" }: { label: string; value: React.ReactNode; tone?: "success" | "warning" | "danger" | "neutral" }) {
  return (
    <article className={clsx("ops-fact", `ops-fact-${tone}`)}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyOpsState({ message }: { message: string }) {
  return (
    <div className="ops-empty">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function LifecycleStatusBoard({ page }: { page: ResolvedPage }) {
  const statusSummary = [
    { label: "Total Stages", value: lifecycleStages.length, tone: "neutral" as StatusTone },
    { label: "Implemented", value: 0, tone: "success" as StatusTone },
    { label: "In Development", value: 0, tone: "info" as StatusTone },
    { label: "Testing", value: 0, tone: "warning" as StatusTone },
    { label: "Pending", value: 0, tone: "neutral" as StatusTone },
    { label: "Not Implemented", value: lifecycleStages.filter((stage) => stage.status === "Not Implemented").length, tone: "danger" as StatusTone },
  ];

  return (
    <div className="lifecycle-board">
      <Breadcrumbs page={page} />
      <section className="lifecycle-hero">
        <div>
          <p className="eyebrow">Cacsms Engine</p>
          <h1>END-TO-END TRADE LIFECYCLE TRACEABILITY</h1>
          <p>
            Track linked system pages from Market Intelligence to Audit Trail and show whether each page has a dedicated implementation.
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
            <h2>Implementation Status Workflow</h2>
            <p>Horizontal lifecycle architecture spanning market signal, execution, monitoring, reporting, learning, and audit readiness.</p>
          </div>
          <StatusBadge tone="danger">Linked Pages Not Implemented</StatusBadge>
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
            <p>Linked support pages run horizontally across all stages and are tracked here until their dedicated implementations exist.</p>
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
      lastUpdated: "Pending implementation",
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
        <strong>0%</strong>
        <div className="segmented-progress" aria-label="Overall project segmented progress">
          <span className="segment-not-started" style={{ width: "100%" }}>Not Implemented 100%</span>
        </div>
        <p>Dedicated implementation completion across all 22 workflow stages.</p>

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
          <strong>All linked workflow stages are currently recorded at 0% implementation.</strong>
        </section>

        <section className="project-health-card">
          <h2>Project Health</h2>
          <strong>Not Implemented</strong>
          <p>No dedicated workflow pages have been implemented yet.</p>
        </section>

        <section className="donut-card">
          <h2>Status Distribution</h2>
          <div className="status-donut" />
          <div>
            <span>Implemented 0%</span>
            <span>In Development 0%</span>
            <span>Pending 0%</span>
            <span>Not Implemented 100%</span>
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
            <span>Implemented: 0%</span>
            <span>Remaining: 100%</span>
            <span>Velocity: Not started</span>
          </div>
        </section>
      </div>

      <section className="forecast-grid">
        <article><span>Current Completion</span><strong>0%</strong></article>
        <article><span>Remaining</span><strong>100%</strong></article>
        <article><span>Estimated Completion Date</span><strong>Not scheduled</strong></article>
        <article><span>Development Velocity</span><strong>Not started</strong></article>
        <article><span>Projected Completion Trend</span><strong>Awaiting implementation</strong></article>
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
      {showArrow && (
        <div className="decision-stage-connector" aria-hidden="true">
          <span />
          <ChevronDown size={22} />
        </div>
      )}
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
        <StatusBadge tone={service.completion === 0 ? "danger" : service.completion >= 90 ? "success" : service.completion >= 80 ? "warning" : "info"}>
          {service.completion === 0 ? "Not Implemented" : `${service.completion}%`}
        </StatusBadge>
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
  if (status === "Not Implemented") return "danger";
  if (status === "Designed") return "success";
  if (status === "Testing") return "warning";
  if (status === "Blocked") return "danger";
  if (status === "In Development") return "info";
  return "neutral";
}

function statusToneFromDecision(status: DecisionStatus): StatusTone {
  if (status === "Not Implemented") return "danger";
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

const dashboardKpis = [
  { label: "Account Equity", value: "$128,847.32", delta: "2.35%", tone: "blue" as const, icon: Gauge, spark: "M2 34 L12 30 L20 23 L29 25 L38 17 L47 19 L55 12 L64 16 L73 9 L82 14 L92 8" },
  { label: "Balance", value: "$107,932.21", delta: "1.12%", tone: "green" as const, icon: CircleDollarSign, spark: "M2 36 L11 31 L19 33 L28 22 L36 25 L45 16 L54 19 L63 11 L72 17 L83 12 L92 8" },
  { label: "Daily P/L", value: "$2,847.32", delta: "2.35%", tone: "green" as const, icon: BarChart3, spark: "M2 36 L10 34 L18 26 L28 28 L36 18 L45 21 L53 13 L62 18 L71 10 L80 14 L92 8" },
  { label: "Floating P/L", value: "$1,204.75", delta: "0.98%", tone: "green" as const, icon: LineChartIcon, spark: "M2 35 L11 31 L19 25 L28 21 L36 15 L45 18 L54 12 L63 17 L72 15 L82 18 L92 10" },
];

const statusCards = [
  { label: "MT5 Connection", value: "Connected", icon: RadioTower },
  { label: "VPS Status", value: "Healthy", icon: Network },
  { label: "Bridge Status", value: "Connected", icon: Bot },
  { label: "Data Feed", value: "Live", icon: FileSpreadsheet },
  { label: "AI Engine", value: "Active", icon: Brain },
  { label: "Last Update", value: "10:24:35", icon: Clock, refresh: true },
];

const openPositions = [
  ["XAUUSD", "Buy", "0.50", "2,325.45", "$542.35"],
  ["EURUSD", "Buy", "1.00", "1.08532", "$265.12"],
  ["GBPUSD", "Sell", "0.80", "1.27015", "-$112.45"],
  ["USDJPY", "Buy", "0.70", "155.325", "$325.75"],
  ["AUDUSD", "Buy", "0.60", "0.66412", "$98.45"],
  ["USDCAD", "Sell", "0.50", "1.36215", "-$45.32"],
  ["XAGUSD", "Buy", "0.40", "27.452", "$130.85"],
];

const recentTrades = [
  ["10:21:35", "XAUUSD", "Buy", "0.50", "2,328.15", "2,334.45", "$315.00", "Won"],
  ["10:15:22", "EURUSD", "Buy", "1.00", "1.08321", "1.08532", "$211.00", "Won"],
  ["10:02:11", "GBPUSD", "Sell", "0.80", "1.27145", "1.27015", "$104.00", "Won"],
  ["09:47:05", "USDJPY", "Buy", "0.70", "154.985", "155.325", "$153.64", "Won"],
  ["09:30:45", "AUDUSD", "Buy", "0.60", "0.66215", "0.66412", "$118.20", "Won"],
];

const newsItems = [
  ["10:00", "UK CPI (YoY)", "High Volatility Expected", "High"],
  ["09:45", "ECB President Speech", "Medium Volatility", "Medium"],
  ["09:30", "US Retail Sales (MoM)", "High Volatility Expected", "High"],
  ["08:15", "FOMC Member Williams Speech", "Low Volatility", "Low"],
];

const aiModules = ["AI Market Analyzer", "Liquidity Finder", "Sentiment Analyzer", "Smart Money Detector", "Volatility Predictor"];

function DashboardReplicaPage() {
  return (
    <div className="dashboard-replica">
      <section className="replica-kpi-grid" aria-label="Trading KPIs">
        {dashboardKpis.map((metric) => (
          <KpiReplicaCard key={metric.label} {...metric} />
        ))}
        <ProgressKpiCard label="Margin Level" value="632.14%" percent="82%" tone="purple" />
        <ProgressKpiCard label="Used Margin" value="$20,351.11" percent="23.32%" tone="blue" />
      </section>

      <section className="replica-overview-grid">
        <DashboardPanel title="Open Positions" action="View all">
          <div className="positions-summary">
            <div>
              <strong>7</strong>
              <span><i className="dot green" /> Profit <b>5</b></span>
              <span><i className="dot red" /> Loss <b>2</b></span>
            </div>
            <DonutChart value="72" center="$1,204.75" label="Floating P/L" />
          </div>
        </DashboardPanel>
        <DashboardPanel title="Today's Trades" action="View all">
          <div className="positions-summary">
            <div>
              <strong>14</strong>
              <span><i className="dot green" /> Won <b>10</b></span>
              <span><i className="dot red" /> Lost <b>4</b></span>
            </div>
            <DonutChart value="71" center="71.43%" label="Win Rate" accent="blue" />
          </div>
        </DashboardPanel>
        <DashboardPanel title="Performance" action="View report">
          <div className="performance-triplet">
            <span>Win Rate <strong>71.43%</strong></span>
            <span>Profit Factor <strong>2.35</strong></span>
            <span>Expectancy <strong>$203.38</strong></span>
          </div>
          <div className="replica-center-icon"><Bot size={22} /></div>
        </DashboardPanel>
        <DashboardPanel title="AI Confidence">
          <DonutChart value="86" center="86%" label="High Confidence" accent="green" large />
        </DashboardPanel>
        <DashboardPanel title="Risk Level">
          <div className="risk-card-body">
            <span className="risk-shield"><ShieldCheck size={28} /></span>
            <div>
              <strong>Low</strong>
              <p>Well within limits</p>
            </div>
          </div>
          <MiniLineChart color="green" />
        </DashboardPanel>
      </section>

      <section className="replica-status-grid">
        {statusCards.map(({ icon: Icon, ...item }) => (
          <article key={item.label} className="replica-status-card">
            <span className="replica-icon"><Icon size={18} /></span>
            <div>
              <p>{item.label}</p>
              <strong>{item.value} <i className="dot green" /></strong>
            </div>
            {item.refresh && <RefreshCw size={16} />}
          </article>
        ))}
      </section>

      <section className="replica-main-grid">
        <DashboardPanel title="Equity Curve" action="This Week" className="wide-chart">
          <EquityCurveChart />
        </DashboardPanel>
        <DashboardPanel title="Performance Overview" action="This Month" className="wide-chart">
          <div className="overview-metrics">
            <span>Net Profit <strong className="profit">$12,847.32</strong><em>12.35%</em></span>
            <span>Total Trades <strong>156</strong></span>
            <span>Win Rate <strong>72.44%</strong></span>
          </div>
          <BarChart />
        </DashboardPanel>
        <DashboardPanel title="Open Positions" action="View all" className="table-panel">
          <PositionsTable />
        </DashboardPanel>
      </section>

      <section className="replica-bottom-grid">
        <DashboardPanel title="Recent Trades" action="View all" className="table-panel recent-panel">
          <RecentTradesTable />
        </DashboardPanel>
        <DashboardPanel title="News Impact" action="View all" className="news-panel">
          <NewsList />
        </DashboardPanel>
        <div className="right-stack">
          <DashboardPanel title="Quick Actions">
            <div className="quick-action-grid">
              <ReplicaAction icon={Bot} label="New Trade" tone="blue" />
              <ReplicaAction icon={AlertCircle} label="Close All" tone="red" />
              <ReplicaAction icon={Pause} label="Pause Engine" tone="amber" />
              <ReplicaAction icon={ShieldCheck} label="Risk Settings" tone="purple" />
              <ReplicaAction icon={Search} label="Go to Scanner" tone="blue" />
              <ReplicaAction icon={FileSpreadsheet} label="Reports" tone="green" />
            </div>
          </DashboardPanel>
          <DashboardPanel title="Active AI Modules" action="View all">
            <div className="ai-module-grid">
              {aiModules.map((item) => (
                <span key={item}><Bot size={13} /> {item} <i className="dot green" /> <b>Active</b></span>
              ))}
            </div>
          </DashboardPanel>
        </div>
      </section>

      <footer className="replica-footer">
        <span>© 2025 Cacsms Engine. All rights reserved.</span>
        <div>
          <span>Server: New York (NY4)</span>
          <span>Version: 2.4.1</span>
          <span>Latency: <b>18ms</b> <i className="dot green" /></span>
        </div>
      </footer>
    </div>
  );
}

function KpiReplicaCard({ label, value, delta, tone, icon: Icon, spark }: (typeof dashboardKpis)[number]) {
  return (
    <article className="replica-kpi-card">
      <div className="replica-card-head">
        <span>{label}</span>
        <em className={clsx("replica-icon", `replica-${tone}`)}><Icon size={16} /></em>
      </div>
      <strong className={tone === "green" ? "profit" : undefined}>{value}</strong>
      <div className="spark-row">
        <span className="profit">↑ {delta}</span>
        <svg viewBox="0 0 94 44" aria-hidden="true">
          <path d={spark} />
        </svg>
      </div>
    </article>
  );
}

function ProgressKpiCard({ label, value, percent, tone }: { label: string; value: string; percent: string; tone: "blue" | "purple" }) {
  return (
    <article className="replica-kpi-card progress-kpi">
      <div className="replica-card-head">
        <span>{label}</span>
        <em className={clsx("replica-icon", `replica-${tone}`)}><ShieldCheck size={16} /></em>
      </div>
      <strong>{value}</strong>
      <div className="progress-line"><span style={{ width: percent }} /></div>
      <small>{percent}</small>
    </article>
  );
}

function DashboardPanel({ title, action, children, className }: { title: string; action?: string; children: React.ReactNode; className?: string }) {
  return (
    <article className={clsx("replica-panel", className)}>
      <div className="replica-panel-head">
        <h2>{title}</h2>
        {action && <button>{action} <ChevronRight size={14} /></button>}
      </div>
      {children}
    </article>
  );
}

function DonutChart({ value, center, label, accent = "green", large }: { value: string; center: string; label: string; accent?: "green" | "blue"; large?: boolean }) {
  return (
    <div className={clsx("donut-replica", large && "large", `donut-${accent}`)} style={{ "--value": `${value}%` } as React.CSSProperties}>
      <div>
        <strong>{center}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function MiniLineChart({ color = "blue" }: { color?: "blue" | "green" }) {
  return (
    <svg className={clsx("mini-line-chart", `line-${color}`)} viewBox="0 0 250 70" aria-hidden="true">
      <path d="M2 55 L18 48 L30 50 L43 38 L55 41 L69 32 L83 35 L96 30 L112 45 L130 42 L145 50 L160 30 L176 28 L191 34 L205 52 L219 48 L236 56 L248 50" />
    </svg>
  );
}

function EquityCurveChart() {
  return (
    <div className="equity-chart">
      <div className="chart-y"><span>$135K</span><span>$130K</span><span>$125K</span><span>$120K</span><span>$115K</span><span>$110K</span><span>$105K</span></div>
      <svg viewBox="0 0 560 245" aria-hidden="true">
        <defs>
          <linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#2563eb" stopOpacity=".22" />
            <stop offset="1" stopColor="#2563eb" stopOpacity=".03" />
          </linearGradient>
        </defs>
        <path className="fill" d="M0 215 L0 190 L25 170 L48 156 L70 137 L95 150 L118 113 L140 120 L162 92 L188 84 L214 78 L238 86 L262 62 L288 63 L312 41 L338 36 L362 47 L388 70 L414 44 L438 65 L462 58 L486 28 L510 18 L536 14 L560 0 L560 215 Z" />
        <path className="line" d="M0 190 L25 170 L48 156 L70 137 L95 150 L118 113 L140 120 L162 92 L188 84 L214 78 L238 86 L262 62 L288 63 L312 41 L338 36 L362 47 L388 70 L414 44 L438 65 L462 58 L486 28 L510 18 L536 14 L560 0" />
      </svg>
      <div className="chart-x"><span>May 12</span><span>May 13</span><span>May 14</span><span>May 15</span><span>May 16</span><span>May 17</span><span>May 18</span></div>
    </div>
  );
}

function BarChart() {
  const bars = [42, -31, 18, 37, 55, -22, 68, 29, 77, -16, 35, 50, 91, 64, -28, 45, 34, 79, -47, 52, 23, -18, 41, 60, -24, 36, 72, 61, 33, -26];
  return (
    <div className="bar-chart">
      <div className="bar-grid"><span>2K</span><span>1K</span><span>0</span><span>-1K</span><span>-2K</span></div>
      <div className="bars">
        {bars.map((bar, index) => <span key={`${bar}-${index}`} className={bar < 0 ? "negative" : undefined} style={{ height: `${Math.abs(bar)}px` }} />)}
      </div>
      <div className="bar-x"><span>May 1</span><span>May 6</span><span>May 11</span><span>May 16</span><span>May 21</span><span>May 26</span><span>May 31</span></div>
    </div>
  );
}

function PositionsTable() {
  return (
    <table className="replica-table">
      <thead><tr><th>Symbol</th><th>Type</th><th>Volume</th><th>Entry Price</th><th>P/L (USD)</th></tr></thead>
      <tbody>{openPositions.map(([symbol, type, volume, entry, pnl]) => (
        <tr key={symbol}><td>{symbol}</td><td className={type === "Sell" ? "loss" : "blue-text"}>{type}</td><td>{volume}</td><td>{entry}</td><td className={pnl.startsWith("-") ? "loss" : "profit"}>{pnl}</td></tr>
      ))}</tbody>
    </table>
  );
}

function RecentTradesTable() {
  return (
    <table className="replica-table">
      <thead><tr><th>Time</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Entry Price</th><th>Exit Price</th><th>P/L (USD)</th><th>Result</th></tr></thead>
      <tbody>{recentTrades.map((row) => (
        <tr key={`${row[0]}-${row[1]}`}>{row.map((cell, index) => <td key={index} className={cell === "Sell" ? "loss" : cell === "Buy" ? "blue-text" : cell.startsWith("$") || cell === "Won" ? "profit" : undefined}>{cell}</td>)}</tr>
      ))}</tbody>
    </table>
  );
}

function NewsList() {
  return (
    <div className="news-list">
      {newsItems.map(([time, title, detail, level]) => (
        <article key={title}>
          <span>{time}</span>
          <div><strong>{title}</strong><p>Impact: {detail}</p></div>
          <em className={`impact-${level.toLowerCase()}`}>{level}</em>
        </article>
      ))}
    </div>
  );
}

function ReplicaAction({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: string }) {
  return <button className={clsx("replica-action", `action-${tone}`)}><Icon size={18} /> {label}</button>;
}

function LineChartIcon({ size = 16 }: { size?: number }) {
  return <BarChart3 size={size} />;
}

function TradingEngineControlPage({
  page,
  onOpenDrawer,
  onConfirm,
}: {
  page: ResolvedPage;
  engineRunning: boolean;
  onToggleEngine: () => void;
  onOpenDrawer: () => void;
  onConfirm: () => void;
}) {
  const [runtime, setRuntime] = useState<EngineRuntimeStatus | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [commanding, setCommanding] = useState(false);
  const [error, setError] = useState("");

  const loadRuntime = useCallback(async () => {
    setLoadState("loading");
    setError("");

    try {
      const status = await getEngineStatus();
      setRuntime(status);
      setLoadState("ready");
    } catch (requestError) {
      setRuntime(null);
      setLoadState("error");
      setError(requestError instanceof Error ? requestError.message : "Engine status could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void loadRuntime();
    const timer = window.setInterval(() => void loadRuntime(), 10000);
    return () => window.clearInterval(timer);
  }, [loadRuntime]);

  const runtimeRunning = runtime?.state === "RUNNING";

  const executeRuntimeCommand = async (command: "start" | "stop") => {
    setCommanding(true);
    setError("");

    try {
      const nextStatus = command === "start"
        ? await startEngine("Operator requested engine start from Trading Control Center.")
        : await stopEngine("Operator requested engine stop from Trading Control Center.");
      setRuntime(nextStatus);
      setLoadState("ready");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Engine command failed.");
    } finally {
      setCommanding(false);
    }
  };

  return (
    <>
      <Breadcrumbs page={page} />
      <section className="engine-control-hero">
        <div className="engine-hero-copy">
          <p className="eyebrow">Trading Control Center</p>
          <h1>Engine Start/Stop</h1>
          <p>
            Govern the runtime state of the trading engine, execution permission, safety gates, and emergency shutdown path from a single operator surface.
          </p>
          <div className="engine-hero-actions">
            <button className={clsx("button", runtimeRunning ? "button-secondary" : "button-primary")} disabled={commanding} onClick={() => void executeRuntimeCommand(runtimeRunning ? "stop" : "start")}>
              {runtimeRunning ? <Pause size={16} /> : <Play size={16} />}
              {runtimeRunning ? "Stop Engine" : "Start Engine"}
            </button>
            <button className="button button-danger" disabled={commanding} onClick={() => void executeRuntimeCommand("stop")}>
              <Power size={16} />
              Emergency Stop
            </button>
            <button className="button button-secondary" onClick={onOpenDrawer}>
              <Eye size={16} />
              Inspect Context
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className={clsx("engine-state-console", runtimeRunning ? "is-running" : "is-paused")}>
          <div>
            <span>Runtime State</span>
            <strong>{loadState === "error" ? "OFFLINE" : runtime?.state ?? "LOADING"}</strong>
          </div>
          <StatusBadge tone={runtimeRunning ? "success" : loadState === "error" ? "danger" : "warning"}>{runtimeRunning ? "Trading Enabled" : loadState === "error" ? "API Offline" : "Stopped"}</StatusBadge>
          <dl>
            <div>
              <dt>Updated</dt>
              <dd>{runtime ? formatDateTime(runtime.updatedAt) : "Unavailable"}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{runtime?.source ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>{runtime?.reason ?? "No engine response."}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="engine-metric-grid">
        {engineControlMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="engine-dashboard-grid">
        <div className="main-stack">
          <section className="panel engine-actions-panel">
            <div className="section-heading">
              <div>
                <h2>Protected Runtime Actions</h2>
                <p>Actions are prepared for API commands, permission checks, and audit logging before a state transition is accepted.</p>
              </div>
              <StatusBadge tone="info">Command guarded</StatusBadge>
            </div>
            <div className="engine-action-grid">
              {engineControlActions.map((action) => {
                const Icon = action.icon;
                return (
                  <article key={action.title} className={clsx("engine-action-card", `engine-action-${action.variant}`)}>
                    <Icon size={22} />
                    <div>
                      <h3>{action.title}</h3>
                      <p>{action.detail}</p>
                    </div>
                    <button className={clsx("button", `button-${action.variant}`)} onClick={action.variant === "danger" ? onConfirm : undefined}>
                      {action.title}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel engine-readiness-panel">
            <div className="section-heading">
              <div>
                <h2>Readiness Gates</h2>
                <p>Every gate must be healthy before automated execution can be resumed.</p>
              </div>
              <button className="button button-secondary"><RefreshCw size={16} /> Refresh</button>
            </div>
            <div className="engine-readiness-grid">
              {engineReadinessChecks.map((check) => (
                <article key={check.name}>
                  <div>
                    <CheckCircle2 size={18} />
                    <StatusBadge tone={check.tone}>{check.status}</StatusBadge>
                  </div>
                  <strong>{check.name}</strong>
                  <p>{check.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel engine-policy-panel">
            <div className="section-heading">
              <div>
                <h2>Control Policies</h2>
                <p>Execution scope, autonomy, kill switch, and compliance requirements applied to this engine session.</p>
              </div>
              <ExportButton />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Value</th>
                    <th>Owner</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enginePolicyRows.map((row) => (
                    <tr key={row.rule}>
                      <td>{row.rule}</td>
                      <td>{row.value}</td>
                      <td>{row.owner}</td>
                      <td><StatusBadge tone={row.tone}>{row.status}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="side-stack">
          <section className="panel engine-mode-panel">
            <h2>Current Mode</h2>
            <div className="engine-mode-card">
              <Brain size={24} />
              <strong>Hybrid Default Profit Mode</strong>
              <p>Institutional order-flow checks and retail confirmation must agree before the AI engine can recommend execution.</p>
              <div>
                <span>Institutional</span>
                <span>Retail</span>
                <span>Macro</span>
                <span>Risk</span>
              </div>
            </div>
          </section>

          <section className="panel engine-linked-panel">
            <h2>Linked Records</h2>
            <div>
              {engineLinkedRecords.map((record) => (
                <Link key={record.label} href={record.href}>
                  <span>{record.label}</span>
                  <strong>{record.value}</strong>
                  <ChevronRight size={15} />
                </Link>
              ))}
            </div>
          </section>

          <section className="panel engine-log-panel">
            <div className="section-heading">
              <div>
                <h2>Status Logs</h2>
                <p>Latest engine state transitions and guard decisions.</p>
              </div>
            </div>
            <div className="engine-log-list">
              {engineStatusTimeline.map((item) => (
                <article key={`${item.time}-${item.event}`}>
                  <StatusBadge tone={item.tone}>{item.time}</StatusBadge>
                  <div>
                    <strong>{item.event}</strong>
                    <p>{item.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </>
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
