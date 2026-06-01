export interface TradingAccount {
  id: string;
  brokerName: string;
  accountName: string;
  accountNumberMasked: string;
  accountType: "Demo" | "Live" | "Prop Firm" | "Funded" | "Challenge" | "Evaluation";
  currency: "USD" | "GBP" | "EUR" | "NGN";
  balance: number;
  equity: number;
  floatingPL: number;
  realizedPL: number;
  marginUsed: number;
  freeMargin: number;
  marginLevel: number;
  dailyDrawdownPercent: number;
  monthlyReturnPercent: number;
  riskScore: number;
  status: "Healthy" | "Watchlist" | "At Risk" | "Breached" | "Disconnected";
  lastSync?: string;
}
export interface PortfolioPosition {
  id: string;
  accountId: string;
  brokerName: string;
  instrument: string;
  direction: "Buy" | "Sell";
  lotSize: number;
  entryPrice: number;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  floatingPL: number;
  riskPercent?: number;
  marginUsed?: number;
  openTime: string;
  status: "Open" | "Closed" | "Pending" | "Cancelled";
  strategy?: string;
}
