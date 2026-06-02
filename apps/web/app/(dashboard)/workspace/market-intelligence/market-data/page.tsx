import { MarketDataPage } from "../../../../components/market-data/MarketDataPage";
import { MarketDataQueryProvider } from "../../../../components/market-data/QueryProvider";

export default function MarketDataRoutePage() {
  return (
    <MarketDataQueryProvider>
      <MarketDataPage />
    </MarketDataQueryProvider>
  );
}
