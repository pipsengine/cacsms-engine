export type SourceStatus =
  | "ONLINE" | "LIVE" | "SYNCED" | "AVAILABLE" | "SCHEDULED"
  | "OPTIONAL" | "ACTIVE" | "WARNING" | "FAILED" | "STALE";

export type DataSourceItem = {
  id: string;
  title: string;
  description: string;
  status: SourceStatus;
  required: boolean;
  color: string;
  icon: string;
  feedsInto: string[];
  failureImpact: string;
};

export const marketIntelligenceSources: DataSourceItem[] = [
  { id: "market-data", title: "Market Data Providers", description: "Real-time prices, ticks, OHLCV, volume, spread and volatility feeds.", status: "ONLINE", required: true, color: "#2563EB", icon: "ACT", feedsInto: ["Stage 1", "Stage 2", "Stage 3", "Stage 4"], failureImpact: "Workflow cannot proceed." },
  { id: "news-sentiment", title: "News & Sentiment Sources", description: "Market-moving news, financial headlines, AI sentiment and risk tone.", status: "ONLINE", required: true, color: "#7C3AED", icon: "NEWS", feedsInto: ["Stage 1", "Stage 4", "Stage 6", "Stage 7", "Stage 9"], failureImpact: "Restrict or block high-impact trades." },
  { id: "economic-calendar", title: "Economic Calendar", description: "CPI, NFP, FOMC, interest rates, central bank speeches and macro releases.", status: "SYNCED", required: true, color: "#F59E0B", icon: "CAL", feedsInto: ["Stage 1", "Stage 4", "Stage 6", "Stage 7", "Stage 9"], failureImpact: "Restrict trading around unknown news events." },
  { id: "social-sentiment", title: "Social & Community Sentiment", description: "Retail positioning, crowd bias, community trend and public sentiment.", status: "OPTIONAL", required: false, color: "#0EA5E9", icon: "SOC", feedsInto: ["Stage 1", "Stage 6", "Stage 7"], failureImpact: "Reduce sentiment confidence only." },
  { id: "institutional-data", title: "Institutional / COT Data", description: "Commitment of Traders, institutional positioning, macro flow and smart money bias.", status: "SCHEDULED", required: false, color: "#0F766E", icon: "COT", feedsInto: ["Stage 1", "Stage 4", "Stage 6", "Stage 7"], failureImpact: "Reduce institutional confidence score." },
  { id: "historical-data", title: "Historical Market Data", description: "OHLCV, tick history, volatility history, pattern history and strategy history.", status: "AVAILABLE", required: true, color: "#9333EA", icon: "HIST", feedsInto: ["Stage 3", "Stage 4", "Stage 6", "Stage 8", "Stage 14"], failureImpact: "Historical comparison and learning become unavailable." },
  { id: "broker-data", title: "Broker Data", description: "Spread, slippage, liquidity, execution latency, symbol availability and server health.", status: "LIVE", required: true, color: "#DC2626", icon: "BRK", feedsInto: ["Stage 2", "Stage 3", "Stage 9", "Stage 10", "Stage 11"], failureImpact: "No execution allowed if broker data is unavailable." },
  { id: "portfolio-data", title: "Account & Portfolio Data", description: "Balance, equity, margin, exposure, open positions, drawdown and account limits.", status: "LIVE", required: true, color: "#16A34A", icon: "ACC", feedsInto: ["Stage 7", "Stage 9", "Stage 12", "Stage 13", "Stage 14"], failureImpact: "Risk validation cannot proceed." },
  { id: "prop-rules", title: "Prop Firm Rules & Limits", description: "Daily loss, maximum drawdown, minimum days, trading restrictions and account rules.", status: "ACTIVE", required: true, color: "#EA580C", icon: "RULE", feedsInto: ["Card 10", "Audit / Compliance"], failureImpact: "Prop account trading must be blocked." }
];

export const healthySourceStatuses = new Set<SourceStatus>(["ONLINE", "LIVE", "SYNCED", "AVAILABLE", "SCHEDULED", "OPTIONAL", "ACTIVE"]);
