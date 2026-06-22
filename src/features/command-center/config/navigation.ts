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
      ["Autonomous Trading Foundation", "autonomous-foundation"],
      ["Profit Target Governance", "profit-target-governance"],
      ["Prediction Accuracy Governance", "prediction-accuracy-governance"],
      ["Trade Lifecycle Design Status", "trade-lifecycle-status"],
      ["AI Decision Status Workflow", "ai-decision-status-workflow"],
    ].map(toSubmodule("/dashboard")),
    linkedModules: ["Macro Intelligence", "AI Decision Engine", "Trade Execution", "Trade Management", "Risk Management", "Performance Analytics", "Alerts & Notifications", "Reports", "System Monitoring"],
    requiredFeatures: ["Total equity", "Balance", "Floating P/L", "Daily P/L", "Weekly P/L", "Monthly P/L", "Open trades", "Closed trades", "Active symbols", "Active strategies", "Current trading mode", "Autonomous foundation status", "30% equity growth target tracking", "85% prediction accuracy governance", "Risk status", "MT5 bridge status", "Broker connection status", "AI confidence summary", "Latest decisions", "Latest alerts"],
  },
  {
    title: "Trading Control Center",
    path: "/trading-control",
    description: "Control engine state, the three trading modes, account environment, autonomy level, manual intervention, and emergency shutdown workflows.",
    icon: PlayCircle,
    color: "green",
    roles: ["Super Administrator", "Administrator", "Risk Manager", "Portfolio Manager", "Trader"],
    submodules: [
      ["Engine Start/Stop", "engine"],
      ["Trading Mode Control", "modes"],
      ["Hybrid Default Profit Mode", "hybrid-default-profit-mode"],
      ["Account Environment", "account-environment"],
      ["Autonomy Level Control", "autonomy-level"],
      ["Demo Auto-Execution Control", "demo-auto-execution"],
      ["Small Live Execution Control", "small-live-execution"],
      ["Risk-Capped Automation Control", "risk-capped-automation"],
      ["Prop Firm Automation Control", "prop-firm-automation"],
      ["Manual Override", "manual-override"],
      ["Emergency Shutdown", "emergency-shutdown"],
      ["Kill Switch Rules", "kill-switch-rules"],
      ["Engine Status Logs", "status-logs"],
    ].map(toSubmodule("/trading-control")),
    linkedModules: ["Accounts & Brokers", "Risk Management", "AI Decision Engine", "Trade Execution", "System Monitoring", "Administration"],
    requiredFeatures: ["Start engine", "Stop engine", "Pause trading", "Resume trading", "Select Institutional mode", "Select Retail mode", "Select Hybrid mode", "Default Hybrid profit mode", "Institutional mode mimics institutional order-flow behavior", "Retail mode mimics retail technical behavior", "Hybrid mode merges institutional and retail confluence", "Enable demo environment", "Enable live environment", "Enable prop firm environment", "Manual review autonomy level", "AI recommendation autonomy level", "Demo auto-execution control", "Small live execution control", "Risk-capped automation control", "Prop firm automation control", "Trigger emergency shutdown", "Hard kill switch", "View reason for engine status"],
  },
  {
    title: "Market Intelligence",
    path: "/market-intelligence",
    description: "Live symbol, session, volatility, correlation, news, sentiment, and technical market intelligence.",
    icon: CandlestickChart,
    color: "cyan",
    roles: allRoles,
    submodules: [
      ["Market Overview", "overview"],
      ["Symbol Watchlist", "watchlist"],
      ["Multi-Timeframe Analysis", "multi-timeframe"],
      ["Multi-Timeframe Bias Engine", "multi-timeframe-bias-engine"],
      ["Timeframe Candle Direction", "timeframe-candle-direction"],
      ["Structure Alignment Engine", "structure-alignment-engine"],
      ["Higher-Timeframe Conflict Detector", "higher-timeframe-conflict-detector"],
      ["Execution Timeframe Confirmation", "execution-timeframe-confirmation"],
      ["Bias Alignment Gate", "bias-alignment-gate"],
      ["H8 Session Candle Analysis", "h8-session-candle-analysis"],
      ["D1 Candle Formation Predictor", "d1-candle-formation-predictor"],
      ["Session Analysis", "sessions"],
      ["Volatility Analysis", "volatility"],
      ["Correlation Analysis", "correlation"],
      ["News Impact Monitor", "news"],
      ["Sentiment Analysis", "sentiment"],
      ["Fundamental Analysis", "fundamental"],
      ["Market Regime Detection", "regime-detection"],
      ["Trending Regime", "trending-regime"],
      ["Ranging Regime", "ranging-regime"],
      ["High Volatility Regime", "high-volatility-regime"],
      ["Low Volatility Regime", "low-volatility-regime"],
      ["News-Risk Regime", "news-risk-regime"],
      ["Liquidity Sweep Regime", "liquidity-sweep-regime"],
      ["Session Transition Regime", "session-transition-regime"],
      ["No-Trade Market Conditions", "no-trade-conditions"],
      ["Historical Pattern Similarity", "historical-pattern-similarity"],
    ].map(toSubmodule("/market-intelligence")),
    linkedModules: ["Macro Intelligence", "Advanced Algorithms", "Institutional Engine", "Retail Engine", "AI Decision Engine", "Trade Execution", "Risk Management", "Learning Center"],
    requiredFeatures: ["Symbol cards", "Session status", "Market bias", "Multi-timeframe bias stack", "MN/W1/D1/H8/H4/H1/M15 candle direction", "Structure alignment", "Higher-timeframe conflict detection", "Execution timeframe confirmation", "Bias alignment gate", "Volatility score", "Trend direction", "Candle intelligence", "H8-to-D1 projection", "Historical similarity", "Sentiment score", "News risk warning", "Regime classification", "Trending/ranging detection", "High/low volatility detection", "Session transition warning", "No-trade condition detection", "Opportunity button", "Symbol drill-down"],
  },
  {
    title: "Macro Intelligence",
    path: "/macro-intelligence",
    description: "COT positioning, interest-rate differentials, central-bank bias, currency strength, and strong-vs-weak pair selection.",
    icon: BarChart3,
    color: "blue",
    roles: allRoles,
    submodules: [
      ["Macro Overview", "overview"],
      ["COT Positioning", "cot-positioning"],
      ["COT Extremes & Crowding", "cot-extremes-crowding"],
      ["Interest Rate Differential", "interest-rate-differential"],
      ["Central Bank Bias", "central-bank-bias"],
      ["Yield Spread Monitor", "yield-spread-monitor"],
      ["Currency Strength Matrix", "currency-strength-matrix"],
      ["Strong-vs-Weak Pair Selector", "strong-vs-weak-selector"],
      ["Macro Risk Calendar", "macro-risk-calendar"],
      ["Macro Bias Score", "macro-bias-score"],
      ["Macro + Technical Confluence", "macro-technical-confluence"],
      ["Data Source Health", "data-source-health"],
    ].map(toSubmodule("/macro-intelligence")),
    linkedModules: ["Market Intelligence", "AI Decision Engine", "Institutional Engine", "Retail Engine", "Strategy Management", "Risk Management", "Reports", "Learning Center"],
    requiredFeatures: ["COT bias score", "Commercial and non-commercial positioning", "Crowded-position warning", "Central bank policy bias", "Interest-rate differential score", "Yield spread direction", "Currency strength matrix", "Strongest vs weakest currency ranking", "Pair selection recommendation", "Macro risk calendar", "Macro no-trade warning", "Macro plus technical confluence score", "Data freshness checks", "Source attribution"],
  },
  {
    title: "Advanced Algorithms",
    path: "/advanced-algorithms",
    description: "Regime classification, ensemble prediction, Bayesian confidence, calibration, anomaly detection, execution quality, and research-grade optimization.",
    icon: Bot,
    color: "violet",
    roles: allRoles,
    submodules: [
      ["Algorithm Overview", "overview"],
      ["Market Regime Classifier", "market-regime-classifier"],
      ["Feature Engineering Engine", "feature-engineering"],
      ["Multi-Timeframe Bias Model", "multi-timeframe-bias-model"],
      ["Historical Pattern Memory", "historical-pattern-memory"],
      ["Candle Intelligence Engine", "candle-intelligence"],
      ["H8-to-D1 Direction Predictor", "h8-d1-direction-predictor"],
      ["Ensemble Prediction Engine", "ensemble-prediction"],
      ["Bayesian Confidence Engine", "bayesian-confidence"],
      ["Probability Calibration", "probability-calibration"],
      ["Walk-Forward Validation", "walk-forward-validation"],
      ["Anomaly Detection Engine", "anomaly-detection"],
      ["Execution Quality Scorer", "execution-quality-scorer"],
      ["Strategy Decay Detector", "strategy-decay-detector"],
      ["Reinforcement Learning Trade Manager", "rl-trade-manager"],
      ["Quantum-Inspired Optimizer", "quantum-inspired-optimizer"],
      ["Model Governance", "model-governance"],
    ].map(toSubmodule("/advanced-algorithms")),
    linkedModules: ["Market Intelligence", "Macro Intelligence", "AI Decision Engine", "Strategy Management", "Backtesting & Simulation", "Performance Analytics", "Risk Management", "Learning Center"],
    requiredFeatures: ["Regime classifier", "Feature vector builder", "Multi-timeframe bias model", "Historical setup similarity", "Candle pressure classifier", "H8-to-D1 projection", "Ensemble score", "Bayesian confidence update", "Calibrated probability", "Walk-forward validation status", "Anomaly score", "Execution quality score", "Strategy decay warning", "RL exit-management recommendations", "Quantum-inspired optimizer research track", "Model promotion gate", "Model rollback gate", "Audit-ready model reasoning"],
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
    linkedModules: ["Macro Intelligence", "Advanced Algorithms", "Market Intelligence", "AI Decision Engine", "Trade Execution", "Risk Management", "Learning Center", "Reports"],
    requiredFeatures: ["Institutional setup cards", "Liquidity zones", "Order block list", "Macro-aligned bias summary", "Confidence score", "Send to AI Decision Engine", "View related trades", "Document lesson"],
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
      ["Multi-Timeframe Bias Stack", "multi-timeframe-bias-stack"],
      ["Higher-Timeframe Conflict", "higher-timeframe-conflict"],
      ["Support & Resistance", "support-resistance"],
      ["Trend Analysis", "trend"],
      ["Candlestick Analysis", "candlesticks"],
      ["Candle Intelligence", "candle-intelligence"],
      ["Chart Patterns", "chart-patterns"],
      ["Pullback Detection", "pullbacks"],
      ["Breakout Detection", "breakouts"],
      ["Indicator Confluence", "indicators"],
      ["Retail Bias", "bias"],
    ].map(toSubmodule("/retail-engine")),
    linkedModules: ["Macro Intelligence", "Advanced Algorithms", "Market Intelligence", "AI Decision Engine", "Trade Execution", "Trade Management", "Learning Center"],
    requiredFeatures: ["Multi-timeframe bias cards", "MN/W1/D1/H8/H4/H1/M30/M15/M5/M1 analysis", "Weighted top-down bias", "Higher-timeframe conflict label", "Execution timeframe confirmation", "Support/resistance zones", "Candle direction detection", "Candle pressure and rejection classification", "Pullback confirmation", "Currency strength confirmation", "Entry timing status", "Send to AI Decision Engine"],
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
      ["Decision Workbench", "decision-workbench"],
      ["Mode Selection Logic", "mode-selection"],
      ["Confidence Score", "confidence"],
      ["Multi-Timeframe Bias Gate", "multi-timeframe-bias-gate"],
      ["Higher-Timeframe Conflict Gate", "higher-timeframe-conflict-gate"],
      ["Macro Bias Gate", "macro-bias-gate"],
      ["Currency Strength Gate", "currency-strength-gate"],
      ["Interest Rate Differential Gate", "interest-rate-differential-gate"],
      ["COT Positioning Gate", "cot-positioning-gate"],
      ["Advanced Algorithm Gate", "advanced-algorithm-gate"],
      ["Historical Similarity Gate", "historical-similarity-gate"],
      ["Candle Intelligence Gate", "candle-intelligence-gate"],
      ["H8-to-D1 Projection Gate", "h8-d1-projection-gate"],
      ["Ensemble Prediction Gate", "ensemble-prediction-gate"],
      ["Bayesian Confidence Gate", "bayesian-confidence-gate"],
      ["Probability Calibration Gate", "probability-calibration-gate"],
      ["Anomaly Detection Gate", "anomaly-detection-gate"],
      ["Execution Quality Gate", "execution-quality-gate"],
      ["Institutional Movement Prediction", "institutional-movement-prediction"],
      ["Probability Forecast Engine", "probability-forecast"],
      ["85% Execution Confidence Gate", "execution-confidence-85"],
      ["Confidence Decay Rules", "confidence-decay"],
      ["Liquidity Target Prediction", "liquidity-target-prediction"],
      ["Prediction Outcome Tracking", "prediction-outcome-tracking"],
      ["Strategy Selection Gate", "strategy-selection-gate"],
      ["Market Regime Gate", "market-regime-gate"],
      ["Risk Gate", "risk-gate"],
      ["News Gate", "news-gate"],
      ["Broker Readiness Gate", "broker-readiness-gate"],
      ["AI Confidence Gate", "ai-confidence-gate"],
      ["Trade Reasoning", "reasoning"],
      ["Avoided Trade Reasons", "avoided-trades"],
      ["No-Trade Decision Engine", "no-trade-engine"],
      ["AI Recommendations", "recommendations"],
      ["Decision History", "history"],
    ].map(toSubmodule("/ai-decision-engine")),
    linkedModules: ["Macro Intelligence", "Advanced Algorithms", "Market Intelligence", "Institutional Engine", "Retail Engine", "Trade Execution", "Risk Management", "Learning Center", "Reports", "Administration"],
    requiredFeatures: ["Decision cards", "Buy/sell/no-trade recommendation", "Multi-timeframe bias gate", "Higher-timeframe conflict gate", "Macro bias gate", "Currency strength gate", "Interest-rate differential gate", "COT positioning gate", "Advanced algorithm gate", "Historical similarity gate", "Candle intelligence gate", "H8-to-D1 projection gate", "Ensemble prediction gate", "Bayesian confidence gate", "Probability calibration gate", "Anomaly detection gate", "Execution quality gate", "Institutional movement prediction", "Probability forecast", "85% execution confidence gate", "Confidence decay", "Liquidity target prediction", "Prediction outcome tracking", "Approved strategy selection", "Market regime gate", "Risk gate", "News gate", "Broker readiness gate", "AI confidence gate", "Institutional reason", "Retail reason", "Hybrid reason", "Confidence score", "Risk score", "Entry score", "News risk score", "Execute Trade", "Reject Trade", "Send to Learning Center"],
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
      ["Execution Approval", "execution-approval"],
      ["Spread Gate", "spread-gate"],
      ["Slippage Gate", "slippage-gate"],
      ["Broker Readiness Check", "broker-readiness"],
      ["MT5 Order Routing", "mt5-routing"],
      ["Broker Execution Logs", "broker-logs"],
      ["Slippage & Spread Monitor", "slippage-spread"],
    ].map(toSubmodule("/trade-execution")),
    linkedModules: ["AI Decision Engine", "Trade Management", "Risk Management", "Accounts & Brokers", "System Monitoring", "Reports", "Alerts & Notifications"],
    requiredFeatures: ["Order preview", "Entry price", "Stop loss", "Take profit", "Lot size", "Risk percentage", "Execution approval", "Spread status", "Slippage warning", "Broker readiness", "Broker connection status", "MT5 terminal status", "Execution confirmation", "Post-execution link"],
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
      ["Basket Profit Protection", "basket-profit-protection"],
      ["Equity Protection Manager", "equity-protection"],
      ["Session Close Exits", "session-close-exits"],
      ["AI Exit Signal Validation", "ai-exit-validation"],
      ["Exit Manager", "exit-manager"],
      ["Closed Trades", "closed-trades"],
    ].map(toSubmodule("/trade-management")),
    linkedModules: ["Trade Execution", "Risk Management", "Performance Analytics", "Reports", "Alerts & Notifications", "Learning Center", "Administration"],
    requiredFeatures: ["Real-time floating P/L", "Profit lock status", "Break-even rules", "Basket profit", "Basket profit protection", "Per-position profit", "Equity protection", "Stop loss movement", "Trailing stop activity", "Partial close actions", "Session close exit", "AI exit validation", "Exit reason", "Trade timeline", "View AI reason", "View risk logs", "Generate learning note"],
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
      ["Risk-Off Engine", "risk-off-engine"],
      ["No-Trade Rules", "no-trade-rules"],
      ["Equity Growth Guardrails", "equity-growth-guardrails"],
      ["Compounding Control", "compounding-control"],
      ["Daily Profit Lockdown", "daily-profit-lockdown"],
      ["XAUUSD Risk Limits", "xauusd-risk-limits"],
      ["Consecutive Loss Guard", "consecutive-loss-guard"],
      ["Strategy Auto-Disable Rules", "strategy-auto-disable"],
      ["Expectancy Protection", "expectancy-protection"],
      ["Exposure Reduction Rules", "exposure-reduction"],
    ].map(toSubmodule("/risk-management")),
    linkedModules: ["Trading Control Center", "AI Decision Engine", "Trade Execution", "Trade Management", "Accounts & Brokers", "Alerts & Notifications", "Reports"],
    requiredFeatures: ["Risk status cards", "Account exposure", "Symbol exposure", "Daily drawdown", "Max drawdown", "Risk per trade", "Risk per basket", "Equity growth guardrails", "Compounding control", "Daily profit lockdown", "XAUUSD risk limits", "Prop firm compliance", "Risk-off gate", "No-trade rules", "Consecutive loss guard", "Strategy auto-disable", "Expectancy protection", "Automatic stop trading trigger", "Emergency shutdown linkage"],
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
      ["XAUUSD Session Rules", "xauusd-session-rules"],
      ["XAUUSD Spread & Volatility Controls", "xauusd-spread-volatility"],
      ["Trend Continuation", "trend-continuation"],
      ["Pullback Continuation", "pullback-continuation"],
      ["Breakout & Retest", "breakout-retest"],
      ["Liquidity Sweep Reversal", "liquidity-sweep-reversal"],
      ["Order Block Mitigation", "order-block-mitigation"],
      ["Fair Value Gap Continuation", "fair-value-gap-continuation"],
      ["Support/Resistance Rejection", "support-resistance-rejection"],
      ["Multi-Timeframe Confluence", "multi-timeframe-confluence"],
      ["Session-Based Strategies", "session-based"],
      ["News Avoidance Strategy", "news-avoidance"],
      ["Risk-Off / No-Trade Strategy", "risk-off-no-trade"],
      ["Strategy Conditions", "conditions"],
      ["Strategy Health Score", "health-score"],
      ["Strategy Decay Detection", "decay-detection"],
      ["Automatic Strategy Disablement", "automatic-disablement"],
      ["Risk-Adjusted Strategy Ranking", "risk-adjusted-ranking"],
      ["Live Shadow Strategy Validation", "live-shadow-validation"],
      ["A-Grade Setup Qualification", "a-grade-setup-qualification"],
      ["Strategy Performance", "performance"],
      ["Strategy Enable/Disable", "enable-disable"],
    ].map(toSubmodule("/strategy-management")),
    linkedModules: ["Macro Intelligence", "Advanced Algorithms", "AI Decision Engine", "Backtesting & Simulation", "Trade Execution", "Performance Analytics", "Reports", "Learning Center"],
    requiredFeatures: ["Strategy cards", "Enable/disable toggle", "Risk profile", "Symbol mapping", "Timeframe mapping", "Trading session mapping", "XAUUSD session rules", "XAUUSD spread/volatility controls", "A-grade setup qualification", "Strategy confidence score", "Performance score", "Backtest link", "Live trade link", "Institutional strategy rules", "Retail strategy rules", "Hybrid confluence scoring", "Macro confluence scoring", "Currency strength pair selection", "News avoidance rules", "Risk-off/no-trade logic", "Walk-forward validation", "Strategy ranking", "Strategy allocation"],
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
      ["Walk-Forward Testing", "walk-forward"],
      ["Live Shadow Testing", "live-shadow"],
      ["Small Capital Validation", "small-capital-validation"],
      ["Strategy Promotion Gate", "strategy-promotion-gate"],
      ["Optimization Results", "optimization"],
      ["Test Reports", "reports"],
    ].map(toSubmodule("/backtesting")),
    linkedModules: ["Strategy Management", "Advanced Algorithms", "AI Decision Engine", "Performance Analytics", "Reports", "Learning Center"],
    requiredFeatures: ["Backtest result cards", "Equity curve", "Win rate", "Drawdown", "Symbol filter", "Timeframe filter", "Strategy filter", "Walk-forward validation", "Demo forward testing", "Live shadow testing", "Small capital validation", "Strategy promotion gate", "Export report", "Push successful strategy to live validation"],
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
      ["Expectancy Analytics", "expectancy"],
      ["Profit Factor", "profit-factor"],
      ["Recovery Factor", "recovery-factor"],
      ["Consecutive Loss Analysis", "consecutive-losses"],
      ["Strategy Decay Analytics", "strategy-decay"],
      ["Risk-Adjusted Performance", "risk-adjusted-performance"],
      ["30% Equity Growth Tracking", "equity-growth-30"],
      ["Rolling 60% Win Rate Monitor", "rolling-win-rate-60"],
      ["Rolling 85% Prediction Accuracy", "rolling-prediction-accuracy-85"],
      ["Equity Curve", "equity-curve"],
      ["Monthly Returns", "monthly-returns"],
    ].map(toSubmodule("/performance-analytics")),
    linkedModules: ["Trade Management", "Risk Management", "Strategy Management", "Advanced Algorithms", "Reports", "Learning Center"],
    requiredFeatures: ["Charts", "KPIs", "Tables", "Filters", "Win rate", "Rolling 60% win rate", "Rolling 85% prediction accuracy", "30% equity growth tracking", "Average win/loss", "Risk/reward", "Expectancy", "Max drawdown", "Profit factor", "Recovery factor", "Consecutive losses", "Strategy decay", "Drill-down to trade", "Drill-down to strategy", "Drill-down to symbol", "Export analytics"],
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
      ["Trade Explanation Records", "trade-explanations"],
      ["Market Snapshot Archive", "market-snapshots"],
      ["Historical Pattern Library", "historical-pattern-library"],
      ["Candle Outcome Library", "candle-outcome-library"],
      ["H8-to-D1 Outcome Review", "h8-d1-outcome-review"],
      ["Entry/Exit Reason Review", "entry-exit-review"],
      ["Strategy Outcome Review", "strategy-outcome-review"],
      ["Risk Decision Review", "risk-decision-review"],
      ["Trade Case Studies", "case-studies"],
      ["Winning Trade Reviews", "winning-trades"],
      ["Losing Trade Reviews", "losing-trades"],
      ["Market Replay Lessons", "market-replay"],
      ["Strategy Lessons", "strategy-lessons"],
      ["AI Decision Lessons", "ai-decisions"],
      ["Model Improvement Queue", "model-improvement-queue"],
      ["Knowledge Base", "knowledge-base"],
      ["Training Materials", "training-materials"],
    ].map(toSubmodule("/learning-center")),
    linkedModules: ["AI Decision Engine", "Advanced Algorithms", "Trade Management", "Backtesting & Simulation", "Strategy Management", "Performance Analytics"],
    requiredFeatures: ["Separate learning layout option", "Nested sidebar", "Trade lessons", "AI decision explanations", "Trade explanation records", "Market snapshot archive", "Historical pattern library", "Candle outcome library", "H8-to-D1 outcome review", "Entry reason review", "Exit reason review", "Risk decision review", "Strategy outcome review", "Screenshot/chart attachment area", "Searchable knowledge base", "Tagging system", "Lesson categories", "Model improvement queue", "Performance improvement recommendations"],
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
    moduleTitles: ["Market Intelligence", "Macro Intelligence", "Advanced Algorithms", "Institutional Engine", "Retail Engine", "AI Decision Engine"],
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
