import { MarketDataPage } from "../market-data/MarketDataPage";
import { MarketDataQueryProvider } from "../market-data/QueryProvider";

export function MarketDataProvidersPage() {
  return (
    <MarketDataQueryProvider>
      <MarketDataPage />
    </MarketDataQueryProvider>
  );
}
