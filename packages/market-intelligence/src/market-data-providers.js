export const MARKET_DATA_PROVIDERS = Object.freeze([
  ["mt5-feed","MT5 Feed","Terminal Native","LIVE",18,210,100,"12:00:00 UTC","20/20","Primary price stream"],
  ["broker-native","Broker Native Feed","Broker API","ONLINE",24,145,99,"11:59:58 UTC","20/20","Execution price validation"],
  ["tradingview","TradingView Feed","Market Aggregator","ONLINE",36,92,98,"11:59:57 UTC","20/20","Chart confirmation"],
  ["dxfeed","DXFeed","Institutional Vendor","ONLINE",39,74,98,"11:59:55 UTC","20/20","Cross-provider validation"],
  ["polygon","Polygon","Market Data API","ONLINE",46,51,97,"11:59:52 UTC","18/20","Backup equity/index feed"],
  ["alphavantage","AlphaVantage","Market Data API","ONLINE",62,28,95,"11:59:48 UTC","16/20","Macro fallback"],
  ["twelvedata","TwelveData","Market Data API","ONLINE",58,31,96,"11:59:49 UTC","18/20","Fallback FX feed"],
  ["custom-feed","Custom Feed","CACSMS Internal","ONLINE",41,19,98,"11:59:51 UTC","20/20","Internal enrichment"]
].map(([id,name,type,status,latencyMs,tickRate,qualityScore,lastSync,coverage,workflowImpact]) => ({ id,name,type,status,latencyMs,tickRate,qualityScore,lastSync,coverage,workflowImpact })));

const symbols = ["XAUUSD","EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD","NAS100","US30","EURJPY","GBPJPY","AUDJPY","CADJPY","EURGBP","EURAUD","EURCAD","SPX500","GER40","USOIL"];
export const MARKET_DATA_COVERAGE = Object.freeze(symbols.map((symbol,index) => ({ symbol,provider:index<10?"MT5 Feed":"Broker Native Feed",priceFeed:true,tickFeed:true,volumeFeed:true,spreadFeed:true,status:"LIVE",coverage:100 })));
export const MARKET_DATA_EVENTS = Object.freeze([
  ["12:00:00","Coverage Updated","MT5 Feed","INFO","20/20 assets online"],["11:59:42","Feed Connected","Broker Native Feed","INFO","Execution validation ready"],["11:58:51","Latency Spike","TwelveData","WARNING","Fallback latency monitored"],["11:57:33","Price Gap Detected","TradingView Feed","WARNING","Cross-provider check passed"],["11:56:12","Feed Reconnected","DXFeed","INFO","Institutional stream restored"]
].map(([time,event,provider,severity,impact]) => ({ time,event,provider,severity,impact })));
export const SPREAD_QUALITY = Object.freeze([["XAUUSD","18","20","Excellent","Low"],["EURUSD","0.7","0.8","Excellent","Low"],["GBPUSD","1.1","1.2","Good","Low"],["NAS100","1.8","2.1","Good","Medium"],["USOIL","2.2","2.4","Good","Medium"]].map(([symbol,currentSpread,averageSpread,quality,riskImpact])=>({symbol,currentSpread,averageSpread,quality,riskImpact})));

export function evaluateMarketDataQuality(providers = MARKET_DATA_PROVIDERS, coverage = MARKET_DATA_COVERAGE) {
  const quality = Math.round(providers.reduce((sum, provider) => sum + provider.qualityScore, 0) / providers.length);
  const latency = Math.round(providers.reduce((sum, provider) => sum + provider.latencyMs, 0) / providers.length);
  const symbolsOnline = coverage.filter(({ status }) => status === "LIVE").length;
  const workflowReady = quality >= 85 && symbolsOnline === 20 && providers.every(({ status }) => status !== "FAILED");
  return { market_data_status: workflowReady ? "READY" : "BLOCKED", feed_quality_score: quality, latency_ms: latency, coverage: Math.round(symbolsOnline / 20 * 100), symbols_online: symbolsOnline, workflow_ready: workflowReady, reject_reason: workflowReady ? null : "Market data quality insufficient" };
}

export function getMarketDataProvidersDashboard() {
  return { ...evaluateMarketDataQuality(), providers:MARKET_DATA_PROVIDERS, coverage:MARKET_DATA_COVERAGE, events:MARKET_DATA_EVENTS, spreadQuality:SPREAD_QUALITY, tickRate:650, packetLoss:0.02, reconnects:1, session:"London / New York" };
}
