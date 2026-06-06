export type ScannerTone = "blue" | "green" | "amber" | "red" | "violet" | "slate";

export type ScannerPageDefinition = {
  order: number;
  slug: string;
  title: string;
  route: string;
  purpose: string;
  tone: ScannerTone;
  functions: string[];
  outputs: string[];
  categories?: string[];
  currencies?: string[];
  timeframes?: string[];
  scores?: string[];
  integrates?: string[];
  generate?: string[];
};

const scannerBaseRoute = "/workspace/universe-scanner";

const route = (slug: string) => `${scannerBaseRoute}/${slug}`;

export const scannerPages: ScannerPageDefinition[] = [
  {
    order: 1,
    slug: "dashboard",
    title: "Universe Dashboard",
    route: route("dashboard"),
    purpose: "Executive overview of all scanned assets.",
    tone: "blue",
    functions: [
      "Assets Scanned",
      "Qualified Opportunities",
      "Rejected Opportunities",
      "Elite Opportunities",
      "High Risk Opportunities",
      "Institutional Setups",
      "Prop Safe Opportunities",
      "Scanner Health",
      "Scanner Throughput",
      "Average Opportunity Score",
      "Average Confidence Score"
    ],
    outputs: ["Top Buy Candidates", "Top Sell Candidates", "Highest Confidence Assets", "Highest Risk Assets"]
  },
  {
    order: 2,
    slug: "universe",
    title: "Asset Universe Registry",
    route: route("universe"),
    purpose: "Manage all tradable instruments.",
    tone: "green",
    functions: [
      "Asset Registry",
      "Asset Activation",
      "Asset Deactivation",
      "Broker Symbol Mapping",
      "Asset Classification",
      "Watchlists",
      "Groups",
      "Favorites",
      "Scanner Inclusion Rules"
    ],
    categories: ["Forex", "Metals", "Indices", "Commodities", "Crypto", "Synthetic Assets"],
    outputs: ["Tradable Universe", "Active Scanner Coverage", "Broker Symbol Map"]
  },
  {
    order: 3,
    slug: "currency-strength",
    title: "Currency Strength Engine",
    route: route("currency-strength"),
    purpose: "Determine strongest and weakest currencies.",
    tone: "violet",
    functions: ["Strength Matrix", "Weakness Matrix", "Currency Rotation", "Relative Strength", "Correlation Analysis", "Divergence Analysis"],
    currencies: ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"],
    outputs: ["Strongest Currency", "Weakest Currency", "Best Currency Pair", "Worst Currency Pair"]
  },
  {
    order: 4,
    slug: "trend-scanner",
    title: "Trend Scanner",
    route: route("trend-scanner"),
    purpose: "Scan trend quality across all assets.",
    tone: "blue",
    functions: ["Multi-Timeframe Trend", "Trend Strength", "Trend Continuation", "Trend Exhaustion", "Trend Alignment", "Trend Confidence"],
    timeframes: ["MN", "W1", "D1", "H4", "H1", "M15"],
    outputs: ["Trend Score", "Trend Direction", "Trend Confidence"]
  },
  {
    order: 5,
    slug: "market-structure",
    title: "Market Structure Scanner",
    route: route("market-structure"),
    purpose: "Detect institutional market structure.",
    tone: "slate",
    functions: ["Higher High", "Higher Low", "Lower High", "Lower Low", "Break of Structure", "Change of Character", "Market Structure Shift"],
    outputs: ["Bullish Structure", "Bearish Structure", "Neutral Structure"]
  },
  {
    order: 6,
    slug: "momentum",
    title: "Momentum Scanner",
    route: route("momentum"),
    purpose: "Measure acceleration, deceleration, and directional force across the asset universe.",
    tone: "green",
    functions: ["Momentum Score", "Bullish Momentum", "Bearish Momentum", "Acceleration", "Deceleration", "Divergence Detection"],
    outputs: ["Momentum Strength", "Momentum Direction", "Momentum Confidence"]
  },
  {
    order: 7,
    slug: "volatility",
    title: "Volatility Scanner",
    route: route("volatility"),
    purpose: "Classify volatility conditions and expansion or compression regimes.",
    tone: "amber",
    functions: ["ATR Analysis", "ADR Analysis", "Historical Volatility", "Realized Volatility", "Volatility Rank", "Volatility Percentile", "Expansion", "Compression"],
    outputs: ["Volatility Score", "Volatility Condition"]
  },
  {
    order: 8,
    slug: "liquidity",
    title: "Liquidity Scanner",
    route: route("liquidity"),
    purpose: "Map liquidity pools, stop clusters, voids, and sweep opportunities.",
    tone: "blue",
    functions: ["Buy Side Liquidity", "Sell Side Liquidity", "Liquidity Pools", "Equal Highs", "Equal Lows", "Liquidity Sweeps", "Liquidity Voids", "Stop Clusters"],
    outputs: ["Liquidity Score", "Liquidity Opportunity"]
  },
  {
    order: 9,
    slug: "institutional",
    title: "Institutional Scanner",
    route: route("institutional"),
    purpose: "Surface institutional positioning, smart money bias, and premium setup zones.",
    tone: "violet",
    functions: ["COT Analysis", "Smart Money Bias", "Accumulation", "Distribution", "Order Blocks", "Fair Value Gaps", "Mitigation Blocks", "Breaker Blocks"],
    outputs: ["Institutional Score", "Institutional Direction"]
  },
  {
    order: 10,
    slug: "sentiment",
    title: "Sentiment Scanner",
    route: route("sentiment"),
    purpose: "Align news, social, and sentiment intelligence with asset-level opportunities.",
    tone: "green",
    integrates: ["News Sentiment", "Social Sentiment", "Sentiment Intelligence"],
    functions: ["Bullish Sentiment", "Bearish Sentiment", "Contrarian Signals", "Sentiment Alignment", "Fear & Greed"],
    outputs: ["Sentiment Score", "Sentiment Bias"]
  },
  {
    order: 11,
    slug: "macro",
    title: "Macro Scanner",
    route: route("macro"),
    purpose: "Convert macro intelligence into currency, yield, growth, and central bank bias.",
    tone: "slate",
    integrates: ["Macro Intelligence", "Economic Calendar", "Interest Rates", "Inflation", "GDP", "Central Banks"],
    functions: ["Currency Bias", "Yield Bias", "Growth Bias", "Macro Bias"],
    outputs: ["Macro Score", "Macro Direction"]
  },
  {
    order: 12,
    slug: "economic-events",
    title: "Economic Event Scanner",
    route: route("economic-events"),
    purpose: "Classify upcoming event risk and event-driven opportunity windows.",
    tone: "amber",
    functions: ["Upcoming Events", "High Impact Events", "News Restrictions", "Event Risk", "Event Opportunity"],
    outputs: ["Event Score", "Event Risk Rating"]
  },
  {
    order: 13,
    slug: "risk",
    title: "Risk Scanner",
    route: route("risk"),
    purpose: "Score execution and market risks before an opportunity can advance.",
    tone: "red",
    functions: ["Spread Risk", "Slippage Risk", "Gap Risk", "Volatility Risk", "Liquidity Risk", "News Risk", "Correlation Risk"],
    outputs: ["Risk Score", "Risk Classification"]
  },
  {
    order: 14,
    slug: "prop-compliance",
    title: "Prop Firm Compliance Scanner",
    route: route("prop-compliance"),
    purpose: "Gate opportunities against prop firm and account-level rule constraints.",
    tone: "red",
    functions: ["News Restrictions", "Consistency Rules", "Drawdown Rules", "Account Rules", "Daily Loss Limits"],
    outputs: ["Compliance Score", "Safe / Warning / Blocked"]
  },
  {
    order: 15,
    slug: "opportunities",
    title: "Opportunity Ranking Engine",
    route: route("opportunities"),
    purpose: "Rank all qualified buy, sell, institutional, risk, and confidence opportunities.",
    tone: "violet",
    functions: ["Asset Ranking", "Opportunity Ranking", "Buy Ranking", "Sell Ranking", "Institutional Ranking", "Risk Ranking", "Confidence Ranking"],
    scores: ["Trend", "Momentum", "Volatility", "Liquidity", "Institutional", "Sentiment", "Macro", "Risk", "Compliance", "Confidence"],
    outputs: ["Final Opportunity Score"]
  },
  {
    order: 16,
    slug: "qualified-trades",
    title: "Qualified Trades Center",
    route: route("qualified-trades"),
    purpose: "Separate qualified, watchlist, rejected, and blocked opportunities for downstream workflows.",
    tone: "green",
    functions: ["Qualified Opportunities", "Watchlist Opportunities", "Rejected Opportunities", "Blocked Opportunities"],
    outputs: ["Ready For Scoring Engine", "Ready For Package Builder", "Ready For AI Decision Engine"]
  },
  {
    order: 17,
    slug: "ai-insights",
    title: "AI Opportunity Discovery",
    route: route("ai-insights"),
    purpose: "Explain opportunity quality, risks, and contextual trade guidance.",
    tone: "blue",
    functions: ["Top Opportunities", "Top Risks", "Top Institutional Setups", "Top Sentiment Plays", "Top Macro Plays", "Prop Safe Opportunities"],
    generate: ["Why Ranked High", "Supporting Factors", "Opposing Factors", "Risk Warnings", "Suggested Risk %", "Suggested Session", "Suggested Holding Period"],
    outputs: ["AI Opportunity Brief", "Risk Warnings", "Suggested Trade Context"]
  },
  {
    order: 18,
    slug: "control-center",
    title: "Scanner Control Center",
    route: route("control-center"),
    purpose: "Operate scan runs, worker queues, schedules, and health checks.",
    tone: "slate",
    functions: ["Start Scan", "Stop Scan", "Pause Scan", "Rescan Asset", "Rescan Universe", "Scan Schedule", "Scanner Health", "Worker Health", "Queue Monitoring"],
    outputs: ["Scan Operations State", "Worker Health", "Queue Monitoring"]
  },
  {
    order: 19,
    slug: "logs",
    title: "Scanner Logs & Diagnostics",
    route: route("logs"),
    purpose: "Audit scan execution, warnings, errors, performance, and diagnostics.",
    tone: "amber",
    functions: ["Scan Logs", "Errors", "Warnings", "Performance Metrics", "Execution History", "Audit Logs"],
    outputs: ["Execution History", "Audit Logs", "Diagnostic Findings"]
  },
  {
    order: 20,
    slug: "test-harness",
    title: "Scanner Test Harness",
    route: route("test-harness"),
    purpose: "Validate scanner engines and the full Card 03 diagnostic path.",
    tone: "blue",
    functions: ["Trend Test", "Momentum Test", "Liquidity Test", "Institutional Test", "Sentiment Test", "Macro Test", "Opportunity Ranking Test", "Qualification Test", "Full Scanner Diagnostic"],
    outputs: ["Diagnostic Pass Rate", "Engine Coverage", "Qualification Readiness"]
  }
];

export const scannerPageMap = new Map(scannerPages.map((page) => [page.slug, page]));
export const scannerBuildOrder = scannerPages.map((page) => `${page.order}. ${page.title}`);
