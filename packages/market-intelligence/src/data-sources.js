export const HEALTHY_STATUSES = new Set(["ONLINE", "LIVE", "SYNCED", "SCHEDULED", "OPTIONAL"]);

export const DATA_SOURCES = Object.freeze([
  ["market-data","Market Data Providers","market_data","Real-time Prices, Ticks, Depth","CACSMS Market Feed","ONLINE",true,18,100,22,0,"Card 1","block_card_1"],
  ["news-sentiment","News & Sentiment Sources","news_sentiment","News, RSS, AI Sentiment","CACSMS News Hub","ONLINE",true,22,100,38,0,"Card 1","restrict_high_impact_trades"],
  ["economic-calendar","Economic Calendar","economic_calendar","Events, Indicators, Central Banks","CACSMS Calendar","SYNCED",true,45,98,42,0,"Card 1","restricted_trading_mode"],
  ["social-sentiment","Social Media & Community","social_sentiment","Twitter, Reddit, Telegram","CACSMS Social Pulse","OPTIONAL",false,75,92,96,0,"Card 1","reduce_confidence"],
  ["institutional-cot-data","On-Chain & Institutional Data","institutional_data","Whale Flow, COT, Volatility Index","CACSMS Institutional Feed","SCHEDULED",false,1800,94,0,0,"Card 1","reduce_confidence"],
  ["historical-data","Historical Data","historical_data","OHLCV, Tick, Fundamentals","CACSMS Historical Store","ONLINE",true,120,100,12,0,"Card 1","disable_historical_comparison"],
  ["broker-data","Broker Data","broker_data","Spread, Depth, Liquidity","CACSMS Broker Gateway","LIVE",true,12,100,18,0,"Card 1","block_execution"],
  ["account-portfolio-data","Account & Portfolio Data","portfolio_data","Balance, Equity, Positions, Risk","CACSMS Portfolio Ledger","LIVE",true,15,100,16,0,"Card 1","block_risk_validation"],
  ["prop-firm-rules","Prop Firm Rules & Limits","prop_rules","Drawdown, Daily Loss, Targets","CACSMS Compliance Rules","ONLINE",true,300,100,0,0,"Card 1","block_prop_risk_validation"]
].map(([id,name,category,subtitle,provider,status,required,freshnessSeconds,healthScore,latencyMs,errorCount,feedsStage,failureAction]) => Object.freeze({
  id, name, category, subtitle, provider, status, required,
  lastSyncAt: "2026-05-31T12:00:00.000Z", freshnessSeconds, healthScore,
  latencyMs, errorCount, feedsStage, failureAction
})));

export function evaluateDataQualityGate(sources = DATA_SOURCES) {
  const byId = Object.fromEntries(sources.map((source) => [source.id, source]));
  const required = sources.filter((source) => source.required);
  const requiredFailures = required.filter((source) => !HEALTHY_STATUSES.has(source.status));
  const warnings = [];
  const rejectReasons = [];
  let tradingMode = "NORMAL";

  if (!HEALTHY_STATUSES.has(byId["market-data"]?.status)) rejectReasons.push("Market Data Providers unavailable");
  if (!HEALTHY_STATUSES.has(byId["broker-data"]?.status)) warnings.push("Broker Data unavailable: execution-related stages blocked");
  if (!HEALTHY_STATUSES.has(byId["account-portfolio-data"]?.status)) warnings.push("Account & Portfolio Data unavailable: Risk Validation blocked");
  if (!HEALTHY_STATUSES.has(byId["prop-firm-rules"]?.status)) warnings.push("Prop Firm Rules unavailable: prop-account Risk Validation blocked");
  if (!HEALTHY_STATUSES.has(byId["economic-calendar"]?.status)) {
    tradingMode = "RESTRICTED";
    warnings.push("Economic Calendar unavailable or stale: restricted trading mode");
  }
  for (const id of ["social-sentiment", "institutional-cot-data"]) {
    if (!HEALTHY_STATUSES.has(byId[id]?.status)) warnings.push(`${byId[id]?.name} unavailable: confidence reduced`);
  }

  const scoringSources = sources.filter((source) => source.required || Number(source.healthScore) > 0);
  const healthScore = Math.round(
    scoringSources.reduce((sum, source) => sum + source.healthScore, 0) / Math.max(scoringSources.length, 1)
  );
  if (healthScore < 85) rejectReasons.push("Data quality below minimum threshold");
  const proceedToStageOne = !rejectReasons.length && !requiredFailures.some((source) => source.id === "market-data");

  return {
    card: "data_sources",
    workflowStage: "market_intelligence_gathering",
    totalSources: sources.length,
    requiredSourcesOnline: requiredFailures.length === 0,
    dataQualityScore: healthScore,
    freshnessStatus: sources.some((source) => source.status === "STALE") ? "STALE" : "LIVE",
    validationStatus: proceedToStageOne ? (warnings.length ? "WARNING" : "PASSED") : "FAILED",
    proceedToStageOne,
    tradingMode,
    warnings,
    rejectReasons
  };
}
