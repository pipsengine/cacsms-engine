import { DataQualityGate } from "../../../../components/market-intelligence/DataQualityGate";
import { DataSourceHealthTable } from "../../../../components/market-intelligence/DataSourceHealthTable";

const titles: Record<string, string> = {
  dashboard: "Intelligence Dashboard",
  "data-sources": "Data Sources & Feed Health",
  "market-data": "Market Data Providers",
  "news-sentiment": "News & Sentiment Sources",
  "economic-calendar": "Economic Calendar",
  "social-sentiment": "Social & Community Sentiment",
  "institutional-cot": "Institutional / COT Data",
  "historical-data": "Historical Data",
  "broker-data": "Broker Data",
  "account-portfolio": "Account & Portfolio Data",
  "prop-firm-rules": "Prop Firm Rules & Limits",
  "data-quality-gate": "Data Quality Gate"
};

export default async function MarketIntelligenceWorkspacePage({ params }: { params: Promise<{ source: string }> }) {
  const { source } = await params;
  return <main><h1>{titles[source] || "Market Intelligence Center"}</h1>{source === "data-quality-gate" ? <DataQualityGate /> : null}{source === "data-sources" ? <><DataQualityGate /><DataSourceHealthTable /></> : null}</main>;
}
