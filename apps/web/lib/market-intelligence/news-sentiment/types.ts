export type SentimentLabel =
  | "Strong Bullish"
  | "Bullish"
  | "Neutral"
  | "Bearish"
  | "Strong Bearish"
  | "Mixed";

export type ImpactLevel = "Low" | "Medium" | "High" | "Extreme";

export interface NewsSentimentItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  publishedAt: string;
  category:
    | "Economic Data"
    | "Central Bank"
    | "Inflation"
    | "Employment"
    | "GDP"
    | "Interest Rates"
    | "Geopolitics"
    | "Energy"
    | "Risk Sentiment"
    | "Crypto Regulation"
    | "Broker / Prop Firm News"
    | "Other";
  assetClass: string[];
  affectedInstruments: string[];
  affectedCurrencies: string[];
  sentiment: SentimentLabel;
  impactLevel: ImpactLevel;
  sentimentScore: number;
  aiConfidence: number;
  marketReaction?: string;
  volatilityRisk?: ImpactLevel;
  status: "New" | "Reviewed" | "Archived";
  createdAt: string;
  updatedAt: string;
}

export interface SentimentHeatmapRow {
  symbol: string;
  oneHourSentiment: SentimentLabel;
  fourHourSentiment: SentimentLabel;
  dailySentiment: SentimentLabel;
  weeklySentiment: SentimentLabel;
  newsImpact: ImpactLevel;
  volatilityRisk: ImpactLevel;
}

export interface NewsSource {
  id: string;
  sourceName: string;
  category: string;
  connectionType: "API" | "RSS" | "Webhook" | "Manual Upload" | "Scraper";
  status: "Active" | "Inactive" | "Error" | "Pending";
  lastSync?: string;
  articlesImported: number;
  errorCount: number;
  trustScore: number;
}

export interface EconomicTimelineEvent {
  time: string;
  event: string;
  currency: string;
  actual: string;
  forecast: string;
  previous: string;
  deviation: string;
  sentiment: SentimentLabel;
  impact: ImpactLevel;
}

export interface NewsAlert {
  id: string;
  title: string;
  detail: string;
  severity: "Info" | "Warning" | "High Risk" | "Critical";
  time: string;
}
