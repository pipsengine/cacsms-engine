import { DataSourceItem } from "./DataSourceItem";

const sources = [
  ["ACT", "Market Data Providers", "Real-time Prices, Ticks, Depth"],
  ["NEWS", "News & Sentiment Sources", "News, RSS, AI Sentiment"],
  ["CAL", "Economic Calendar", "Events, Indicators, Central Banks"],
  ["SOC", "Social Media & Community", "Twitter, Reddit, Telegram"],
  ["COT", "On-Chain & Institutional Data", "Whale Flow, COT, Volatility Index"],
  ["HIST", "Historical Data", "OHLCV, Tick, Fundamentals"],
  ["BRK", "Broker Data", "Spread, Depth, Liquidity"],
  ["ACC", "Account & Portfolio Data", "Balance, Equity, Positions, Risk"],
  ["RULE", "Prop Firm Rules & Limits", "Drawdown, Daily Loss, Targets"]
] as const;

export function DataSourcesCard() {
  return <article id="data-sources-card" className="workflow-data-sources-card"><h2>DATA SOURCES</h2><div>{sources.map(([icon, name, subtitle]) => <DataSourceItem icon={icon} name={name} subtitle={subtitle} key={name} />)}</div></article>;
}
