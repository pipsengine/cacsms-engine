export const BROKER_DATA_SOURCES = Object.freeze([
  { id:"icm-mt5",brokerName:"IC Markets",platform:"MT5",accountType:"Raw Spread",serverName:"ICMarketsSC-Live33",status:"Connected",instruments:["EURUSD","GBPUSD","XAUUSD","USDJPY"],lastSync:"2026-06-01T10:58:42Z",recordsImported:2845092,missingRecords:0,averageSpread:.7,latencyMs:18,qualityScore:99 },
  { id:"pep-ctrader",brokerName:"Pepperstone",platform:"cTrader",accountType:"ECN",serverName:"Pepperstone-Live",status:"Connected",instruments:["EURUSD","GBPUSD","XAUUSD","NAS100"],lastSync:"2026-06-01T10:58:39Z",recordsImported:1938420,missingRecords:3,averageSpread:.8,latencyMs:24,qualityScore:97 },
  { id:"exness-rest",brokerName:"Exness",platform:"REST API",accountType:"Standard",serverName:"Exness-Real12",status:"Connected",instruments:["EURUSD","XAUUSD","USOIL"],lastSync:"2026-06-01T10:58:33Z",recordsImported:904118,missingRecords:12,averageSpread:1.1,latencyMs:31,qualityScore:94 },
  { id:"ftmo-mt5",brokerName:"FTMO",platform:"MT5",accountType:"Prop Firm",serverName:"FTMO-Demo",status:"Pending",instruments:["EURUSD","GBPUSD","XAUUSD"],lastSync:"2026-06-01T10:52:11Z",recordsImported:482190,missingRecords:18,averageSpread:1.3,latencyMs:38,qualityScore:91 },
]);
export const BROKER_MARKET_DATA = Object.freeze([
  ["bd-001","icm-mt5","IC Markets","MT5","EURUSD","1H","2026-06-01T10:00:00Z",1.08421,1.08428,.7,1.08384,1.08472,1.08362,1.08425,18450,912,18,"MetaTrader Bridge","Clean"],
  ["bd-002","pep-ctrader","Pepperstone","cTrader","EURUSD","1H","2026-06-01T10:00:00Z",1.08420,1.08429,.9,1.08382,1.08474,1.08360,1.08424,18112,887,24,"cTrader API","Clean"],
  ["bd-003","exness-rest","Exness","REST API","XAUUSD","1H","2026-06-01T10:00:00Z",2327.42,2327.64,22,2322.18,2329.81,2320.44,2327.51,32410,1102,31,"REST API","Warning"],
  ["bd-004","icm-mt5","IC Markets","MT5","GBPUSD","1H","2026-06-01T09:00:00Z",1.27318,1.27329,1.1,1.27180,1.27412,1.27145,1.27324,15772,744,19,"MetaTrader Bridge","Clean"],
  ["bd-005","pep-ctrader","Pepperstone","cTrader","NAS100","1H","2026-06-01T09:00:00Z",19244.1,19245.9,1.8,19202.4,19272.8,19194.2,19244.8,26702,1294,26,"cTrader API","Clean"],
  ["bd-006","ftmo-mt5","FTMO","MT5","EURUSD","1H","2026-06-01T08:00:00Z",1.08291,1.08305,1.4,1.08192,1.08338,1.08166,1.08298,13220,602,38,"MetaTrader Bridge","Warning"],
].map(([id,brokerId,brokerName,platform,instrument,timeframe,timestamp,bid,ask,spread,open,high,low,close,volume,tickCount,latencyMs,source,qualityFlag])=>({id,brokerId,brokerName,platform,instrument,timeframe,timestamp,bid,ask,spread,open,high,low,close,volume,tickCount,latencyMs,source,qualityFlag})));
export const BROKER_VALIDATION_ISSUES=Object.freeze([
  ["Timestamp gaps","Warning","FTMO","EURUSD","18 missing candles","Backfill from MT5 bridge and revalidate"],
  ["Excessive spread","Warning","Exness","XAUUSD","Spread exceeded 20 points","Review session threshold and liquidity"],
  ["Duplicate candles","Info","Pepperstone","GBPUSD","3 duplicates quarantined","Keep normalized record and archive duplicates"],
  ["Bid/ask inversion","Error","Exness","USOIL","1 invalid tick rejected","Reject tick and inspect upstream quote"],
].map(([rule,severity,broker,instrument,detail,recommendedFix])=>({rule,severity,broker,instrument,detail,recommendedFix})));
export const BROKER_COMPARISON=Object.freeze([
  ["IC Markets","0.7","1.1","18","0.12","18ms","100%","99","Raw spreads / FX"],
  ["Pepperstone","0.8","1.2","20","0.16","24ms","99.9%","97","Cross-platform execution"],
  ["Exness","1.1","1.5","22","0.24","31ms","99.4%","94","Metals / REST fallback"],
  ["FTMO","1.3","1.7","24","0.31","38ms","98.8%","91","Prop-firm validation"],
]);
export function getBrokerDataDashboard(){return{sources:BROKER_DATA_SOURCES,records:BROKER_MARKET_DATA,validation:BROKER_VALIDATION_ISSUES,comparison:BROKER_COMPARISON,summary:{connectedBrokers:3,activeFeeds:3,dataQualityScore:95,averageSpread:.98,feedLatencyMs:28,missingCandles:33,rejectedRecords:1}}}
