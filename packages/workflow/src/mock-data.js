export const WORKFLOW_EVENTS = Object.freeze([
  "workflow.started", "workflow.stage.started", "workflow.stage.completed",
  "workflow.stage.failed", "workflow.stage.blocked", "workflow.assets.scanned",
  "workflow.assets.ranked", "workflow.top10.selected", "workflow.top5.selected",
  "workflow.top3.selected", "workflow.trade.executed", "workflow.position.updated",
  "workflow.completed"
]);

export const ASSET_UNIVERSE = Object.freeze([
  ["XAUUSD", "Gold / US Dollar", "commodity", "tier_1", 1, "london_new_york"],
  ["EURUSD", "Euro / US Dollar", "forex", "tier_1", 2, "london_new_york"],
  ["GBPUSD", "British Pound / US Dollar", "forex", "tier_1", 3, "london_new_york"],
  ["USDJPY", "US Dollar / Japanese Yen", "forex", "tier_1", 4, "tokyo_london"],
  ["AUDUSD", "Australian Dollar / US Dollar", "forex", "tier_1", 5, "sydney_tokyo"],
  ["USDCAD", "US Dollar / Canadian Dollar", "forex", "tier_1", 6, "new_york"],
  ["USDCHF", "US Dollar / Swiss Franc", "forex", "tier_1", 7, "london_new_york"],
  ["NZDUSD", "New Zealand Dollar / US Dollar", "forex", "tier_1", 8, "sydney_tokyo"],
  ["NAS100", "Nasdaq 100", "index", "tier_1", 9, "new_york"],
  ["US30", "Dow Jones Industrial Average", "index", "tier_1", 10, "new_york"],
  ["EURJPY", "Euro / Japanese Yen", "forex", "tier_2", 11, "tokyo_london"],
  ["GBPJPY", "British Pound / Japanese Yen", "forex", "tier_2", 12, "tokyo_london"],
  ["AUDJPY", "Australian Dollar / Japanese Yen", "forex", "tier_2", 13, "sydney_tokyo"],
  ["CADJPY", "Canadian Dollar / Japanese Yen", "forex", "tier_2", 14, "tokyo"],
  ["EURGBP", "Euro / British Pound", "forex", "tier_2", 15, "london"],
  ["EURAUD", "Euro / Australian Dollar", "forex", "tier_2", 16, "london"],
  ["EURCAD", "Euro / Canadian Dollar", "forex", "tier_2", 17, "london_new_york"],
  ["SPX500", "S&P 500", "index", "tier_2", 18, "new_york"],
  ["GER40", "German DAX 40", "index", "tier_2", 19, "london"],
  ["USOIL", "WTI Crude Oil", "commodity", "tier_2", 20, "new_york"]
].map(([symbol, displayName, assetClass, tier, priority, sessionPreference]) => Object.freeze({
  symbol, displayName, assetClass, tier, enabled: true, priority,
  defaultTimeframes: ["M15", "H1", "H4"],
  riskCategory: ["XAUUSD", "NAS100", "US30", "SPX500", "GER40", "USOIL"].includes(symbol) ? "elevated" : "standard",
  spreadCategory: ["GBPJPY", "EURAUD", "EURCAD", "USOIL"].includes(symbol) ? "wide" : "standard",
  sessionPreference
})));

export const ASSET_SCORES = Object.freeze([
  ["XAUUSD", 95], ["EURUSD", 89], ["GBPUSD", 86], ["NAS100", 82], ["US30", 80],
  ["USDJPY", 77], ["AUDUSD", 74], ["USDCAD", 72], ["EURJPY", 70], ["GBPJPY", 69]
].map(([symbol, score], index) => Object.freeze({ rank: index + 1, symbol, score })));

export const MOCK_WORKFLOW = Object.freeze({
  workflowId: "WF-2026-0531-0847",
  currentStage: 9,
  status: "running",
  startedAt: "2026-05-31T10:16:00.000Z",
  completedAt: null,
  durationMs: 522000,
  selectedAssets: ASSET_UNIVERSE.map(({ symbol }) => symbol),
  top10Assets: ASSET_SCORES.map(({ symbol }) => symbol),
  top5Assets: ["XAUUSD", "EURUSD", "GBPUSD", "NAS100", "US30"],
  top3Assets: ["XAUUSD", "EURUSD", "GBPUSD"],
  executionCandidates: ["XAUUSD", "EURUSD"],
  finalTrades: [],
  errorCount: 0,
  retryCount: 0
});
