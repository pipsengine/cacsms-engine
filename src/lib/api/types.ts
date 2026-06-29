export type TradingStyle = "IntradayAndSwing" | "ScalpOnly" | 0 | 1;

export type TradingSymbol = {
  code: string;
  allowedStyle: TradingStyle;
};

export type HybridDecisionRequest = {
  symbol: string;
  tradingMode: "Institutional" | "Retail" | "Hybrid";
  timeframe: string;
  session: string;
  marketRegime: string;
  higherTimeframeBias: string;
  entryTimeframeBias: string;
  multiTimeframeAlignmentScore: number;
  higherTimeframeConflictScore: number;
  executionTimeframeConfirmationScore: number;
  spreadPoints: number;
  slippagePoints: number;
  riskReward: number;
  newsRisk: boolean;
  liquiditySweep: boolean;
  displacement: boolean;
  fairValueGap: boolean;
  orderBlockRetest: boolean;
  breakOfStructure: boolean;
  retailTrendAligned: boolean;
  supportResistanceConfirmation: boolean;
  pullbackConfirmation: boolean;
  macroBiasScore: number;
  interestRateDifferentialScore: number;
  cotPositioningScore: number;
  currencyStrengthScore: number;
  macroRiskScore: number;
  regimeModelScore: number;
  historicalSimilarityScore: number;
  candleIntelligenceScore: number;
  h8D1ProjectionScore: number;
  ensemblePredictionScore: number;
  bayesianConfidenceScore: number;
  probabilityCalibrationScore: number;
  anomalyScore: number;
  executionQualityScore: number;
  volatilityScore: number;
  strategyHealthScore: number;
  accountDrawdownPercent: number;
  dailyLossPercent: number;
  consecutiveLosses: number;
  requestedRiskPercent: number;
};

export type HybridDecisionResponse = {
  symbol: string;
  tradingMode: string;
  recommendation: string;
  direction: string;
  confidenceScore: number;
  topDownBiasScore: number;
  macroScore: number;
  advancedAlgorithmScore: number;
  marketMemoryScore: number;
  institutionalScore: number;
  retailScore: number;
  hybridScore: number;
  approvedRiskPercent: number;
  approvedStrategy: string;
  liquidityTarget: string;
  invalidationLevel: string;
  expiresInMinutes: number;
  noTradeReasons: string[];
  evidence: string[];
};

export type HealthResponse = {
  status: string;
  service: string;
};

export type EngineRuntimeStatus = {
  state: string;
  isOnline: boolean;
  isTradingEnabled: boolean;
  updatedAt: string;
  source: string;
  reason: string;
};

export type RuntimeConfig = {
  tradingMode: string;
  autonomyLevel: string;
  riskProfile: string;
  maxRiskPerTradePercent: number;
  dailyDrawdownLimitPercent: number;
  demoExecutionEnabled: boolean;
  liveExecutionEnabled: boolean;
  propFirmModeEnabled: boolean;
  loadedAt: string;
  source: string;
};

export type DataSourceStatus = {
  code: string;
  name: string;
  status: string;
  isHealthy: boolean;
  checkedAt: string;
  detail: string;
};

export type DataSourcesOverview = {
  checkedAt: string;
  healthy: number;
  degraded: number;
  offline: number;
  sources: DataSourceStatus[];
};

export type SymbolSelectionRule = {
  code: string;
  name: string;
  description: string;
  status: string;
};

export type SymbolSelectionCandidate = {
  symbol: string;
  direction: string;
  score: number;
  status: string;
  evidence: string[];
};

export type SymbolSelectionRulesOverview = {
  evaluatedAt: string;
  status: string;
  rules: SymbolSelectionRule[];
  candidates: SymbolSelectionCandidate[];
};

export type BridgeSettingsOverview = {
  checkedAt: string;
  bridgeUrl: string;
  bridgeMode: string;
  marketDataEaName: string;
  marketDataEaSourcePath: string;
  marketDataEaCompiledPath: string;
  marketDataEaSourceExists: boolean;
  marketDataEaCompiledExists: boolean;
  marketDataEaCompiledAt: string | null;
  activeTerminalId: string;
  activeEaName: string;
  activeBridgeKind: string;
  activeHeartbeatHasTimeframeTelemetry: boolean;
  dedicatedMarketDataEaActive: boolean;
  mt5HeartbeatStatus: string;
  lastHeartbeatAt: string | null;
  heartbeatAgeSeconds: number | null;
  databaseStatus: string;
  currencyStrengthStatus: string;
  terminals: Mt5TerminalBridge[];
  dependencies: DataSourceStatus[];
};

export type Mt5TerminalBridge = {
  terminalKey: string;
  terminalPath: string;
  expertsPath: string;
  marketDataEaSourcePath: string;
  marketDataEaCompiledPath: string;
  marketDataEaSourceExists: boolean;
  marketDataEaCompiledExists: boolean;
  marketDataEaCompiledAt: string | null;
  isActiveTerminal: boolean;
};

export type PersistedHybridDecisionResponse = {
  decisionId: string;
  createdAt: string;
  decision: HybridDecisionResponse;
};

export type DecisionHistoryItem = {
  decisionId: string;
  createdAt: string;
  symbol: string;
  tradingMode: string;
  recommendation: string;
  direction: string;
  confidenceScore: number;
};

export type CurrencyStrengthSnapshot = {
  engine: string;
  source: string;
  updatedAt: string;
  strongest: string;
  weakest: string;
  bestOpportunity: string;
  tradeBias: "BUY" | "SELL" | "NO TRADE";
  confidence: number;
  strengthDifferential: number;
  divergence: number;
  htfAlignment: string;
  signalQuality: string;
  xauUsdFilter: string;
  rejectionReasons: string;
  focusSymbol: string;
  timeframes: string[];
  currencies: Record<string, number>;
  timeframeMatrix: Record<string, Record<string, number>>;
};

export type CurrencyStrengthEnrichment = {
  currencyStrengthScore: number;
  tradeBias: string;
  confidence: number;
  strongest: string;
  weakest: string;
  htfAlignment: string;
  signalQuality: string;
  evidence: string[];
  rejectionReasons: string[];
};
