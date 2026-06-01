import { DataQualityGate } from "../../../../components/market-intelligence/DataQualityGate";
import { DataSourceHealthTable } from "../../../../components/market-intelligence/DataSourceHealthTable";
import { MarketDataProvidersPage } from "../../../../components/market-intelligence/MarketDataProvidersPage";
import { NewsSentimentPage } from "../../../../components/market-intelligence/news-sentiment/NewsSentimentPage";
import { EconomicCalendarPage } from "../../../../components/market-intelligence/economic-calendar/EconomicCalendarPage";
import { SocialSentimentPage } from "../../../../components/market-intelligence/social-sentiment/SocialSentimentPage";
import { InstitutionalCotPage } from "../../../../components/market-intelligence/institutional-cot/InstitutionalCotPage";
import { HistoricalDataPage } from "../../../../components/market-intelligence/historical-data/HistoricalDataPage";
import { BrokerDataPage } from "../../../../components/market-intelligence/broker-data/BrokerDataPage";
import { AccountPortfolioPage } from "../../../../components/market-intelligence/account-portfolio/AccountPortfolioPage";
import { PropFirmRulesPage } from "../../../../components/market-intelligence/prop-firm-rules/PropFirmRulesPage";

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
  "account-portfolio": "Account Portfolio",
  "prop-firm-rules": "Prop Firm Rules",
  "data-quality-gate": "Data Quality Gate"
};

export default async function MarketIntelligenceWorkspacePage({ params }: { params: Promise<{ source: string }> }) {
  const { source } = await params;
  if (source === "market-data") return <MarketDataProvidersPage />;
  if (source === "news-sentiment") return <NewsSentimentPage />;
  if (source === "economic-calendar") return <EconomicCalendarPage />;
  if (source === "social-sentiment") return <SocialSentimentPage />;
  if (source === "institutional-cot") return <InstitutionalCotPage />;
  if (source === "historical-data") return <HistoricalDataPage />;
  if (source === "broker-data") return <BrokerDataPage />;
  if (source === "account-portfolio") return <AccountPortfolioPage />;
  if (source === "prop-firm-rules") return <PropFirmRulesPage />;
  return <main><h1>{titles[source] || "Market Intelligence Center"}</h1>{source === "data-quality-gate" ? <DataQualityGate /> : null}{source === "data-sources" ? <><DataQualityGate /><DataSourceHealthTable /></> : null}</main>;
}
