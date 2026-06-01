import { InstitutionalCotPage } from "../../../../components/market-intelligence/institutional-cot/InstitutionalCotPage";
import { LiveMarketIntelligencePage } from "../../../../components/market-intelligence/LiveMarketIntelligencePage";

export default async function MarketIntelligenceWorkspacePage({ params }: { params: Promise<{ source: string }> }) {
  const { source } = await params;
  if (source === "institutional-cot") return <InstitutionalCotPage />;
  return <LiveMarketIntelligencePage source={source} />;
}
