import { query } from "./db.js";

const round = value => value === null || value === undefined || Number.isNaN(Number(value)) ? null : Math.round(Number(value));

async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    if (["42P01", "42703", "42883"].includes(error.code)) return { rows: [] };
    throw error;
  }
}

const label = value => value || "Insufficient Data";
const tf = (...states) => Object.fromEntries(["MN", "W1", "D1", "H4", "H1", "M15"].map(frame => [frame, ...states]));

export async function syncAssetUniverseFromLiveSources(actor = "live-source-adapter") {
  const { rows } = await safeQuery(`
    SELECT DISTINCT symbol AS asset, asset_class FROM market.market_data_symbols WHERE enabled = true
    UNION
    SELECT DISTINCT instrument AS asset, asset_class FROM market.instrument_environment_states
    UNION
    SELECT DISTINCT instrument AS asset, asset_class FROM market.instrument_institutional_states
  `);
  for (const row of rows) {
    await safeQuery(`
      INSERT INTO market.asset_universe (asset, asset_code, display_name, asset_class, status, active, scanner_enabled)
      VALUES ($1,$1,$1,$2,'Active',true,true)
      ON CONFLICT (asset_code) DO UPDATE SET active = true, scanner_enabled = true, status = 'Active', updated_at = now()
    `, [row.asset, row.asset_class || "Forex"]);
  }
  return rows.length;
}

export async function getTrendLiveSource() {
  const { rows } = await safeQuery(`SELECT instrument AS asset, asset_class AS "assetClass", regime, trend_strength AS "trendScore", trading_suitability AS qualification, confidence, updated_at AS "lastScanned" FROM market.instrument_environment_states ORDER BY updated_at DESC, instrument`);
  const scores = rows.map(row => ({
    asset: row.asset,
    assetClass: row.assetClass,
    overallTrend: label(row.regime),
    trendScore: round(row.trendScore),
    trendAlignment: round(row.trendScore),
    continuationProbability: round(row.trendScore),
    exhaustionProbability: row.regime?.includes("Compression") ? 35 : 0,
    breakoutProbability: row.regime?.includes("Breakout") ? 70 : 0,
    breakdownProbability: 0,
    confidence: round(row.confidence),
    opportunityImpact: row.qualification,
    qualification: row.qualification || "Watchlist",
    lastScanned: row.lastScanned
  }));
  const matrix = scores.map(row => ({
    asset: row.asset,
    assetClass: row.assetClass,
    timeframes: Object.fromEntries(["MN", "W1", "D1", "H4", "H1", "M15"].map(frame => [frame, { trendDirection: row.overallTrend, trendStrength: row.trendScore, confidence: row.confidence, state: row.overallTrend }])),
    overallTrend: row.overallTrend,
    trendAlignment: row.trendAlignment,
    trendScore: row.trendScore,
    confidence: row.confidence,
    lastUpdated: row.lastScanned
  }));
  return { scores, matrix, rankings: scores.map((row, index) => ({ rank: index + 1, ...row, trendConfidence: row.confidence, exhaustionRisk: row.exhaustionProbability, breakoutBreakdownSignal: row.breakoutProbability ? "Breakout" : "No Signal" })) };
}

export async function getMomentumLiveSource() {
  const { rows } = await safeQuery(`
    WITH ticks AS (
      SELECT symbol AS asset, ((bid + ask) / 2.0) AS mid, spread, observed_at
      FROM market.market_data_ticks
      WHERE observed_at >= (SELECT max(observed_at) - interval '7 days' FROM market.market_data_ticks)
    ),
    latest AS (
      SELECT DISTINCT ON (asset) asset, mid AS latest_mid, spread, observed_at AS latest_at
      FROM ticks ORDER BY asset, observed_at DESC
    ),
    first AS (
      SELECT DISTINCT ON (asset) asset, mid AS first_mid, observed_at AS first_at
      FROM ticks ORDER BY asset, observed_at ASC
    )
    SELECT l.asset, 'Forex' AS "assetClass", l.latest_mid, f.first_mid, l.spread, l.latest_at AS "lastScanned",
      CASE WHEN f.first_mid IS NULL OR f.first_mid = 0 THEN 0 ELSE ((l.latest_mid - f.first_mid) / f.first_mid) * 100 END AS change_pct
    FROM latest l JOIN first f USING (asset)
    ORDER BY abs(CASE WHEN f.first_mid IS NULL OR f.first_mid = 0 THEN 0 ELSE ((l.latest_mid - f.first_mid) / f.first_mid) * 100 END) DESC
  `);
  const scores = rows.map(row => {
    const change = Number(row.change_pct || 0);
    const magnitude = Math.min(100, Math.round(Math.abs(change) * 25));
    const direction = change > 0.02 ? "Bullish" : change < -0.02 ? "Bearish" : "Neutral";
    const overall = magnitude >= 80 ? `Strong ${direction}` : direction;
    return {
      asset: row.asset,
      assetClass: row.assetClass,
      overallMomentum: overall,
      momentumScore: magnitude,
      momentumDirection: direction,
      accelerationScore: magnitude,
      decelerationScore: Math.max(0, 100 - magnitude),
      alignmentScore: magnitude,
      divergenceScore: 0,
      exhaustionRisk: magnitude > 85 ? 60 : 20,
      confidence: 75,
      opportunityImpact: direction === "Neutral" ? "Watch momentum" : "Confirms directional pressure",
      qualification: magnitude >= 40 ? "Momentum Qualified" : "Watchlist",
      lastScanned: row.lastScanned
    };
  });
  const matrix = scores.map(row => ({ asset: row.asset, assetClass: row.assetClass, timeframes: Object.fromEntries(["MN", "W1", "D1", "H4", "H1", "M15"].map(frame => [frame, { momentumDirection: row.momentumDirection, momentumStrength: row.momentumScore, accelerationState: row.accelerationScore >= 50 ? "Accelerating" : "Developing", confidence: row.confidence, state: row.overallMomentum }])), overallMomentum: row.overallMomentum, momentumAlignment: row.alignmentScore, momentumScore: row.momentumScore, confidence: row.confidence, lastUpdated: row.lastScanned }));
  const acceleration = scores.filter(row => row.accelerationScore >= 50).map(row => ({ asset: row.asset, direction: row.momentumDirection, previousMomentum: null, currentMomentum: row.momentumScore, momentumChange: row.momentumScore, accelerationScore: row.accelerationScore, trendSupport: "Live tick momentum", structureSupport: "Requires structure confirmation", confidence: row.confidence, recommendedAction: "Pass to opportunity ranking if other scanners align" }));
  const deceleration = scores.filter(row => row.accelerationScore < 50).map(row => ({ asset: row.asset, direction: row.momentumDirection, previousMomentum: null, currentMomentum: row.momentumScore, momentumChange: row.momentumScore, decelerationScore: row.decelerationScore, exhaustionRisk: "Low", riskLevel: "Low", recommendedAction: "Watchlist" }));
  return { scores, matrix, rankings: scores.map((row, index) => ({ rank: index + 1, ...row, acceleration: row.accelerationScore >= 50 ? "Accelerating" : "Developing", deceleration: row.decelerationScore >= 70 ? "Decelerating" : "Low", divergenceSignal: "No Signal", exhaustionRisk: String(row.exhaustionRisk) })), acceleration, deceleration, divergence: [], exhaustion: [] };
}

export async function getCurrencyStrengthLiveSource() {
  const { rows } = await safeQuery(`
    WITH ticks AS (
      SELECT symbol AS pair, ((bid + ask) / 2.0) AS mid, observed_at
      FROM market.market_data_ticks
      WHERE symbol ~ '^[A-Z]{6}$'
        AND observed_at >= (SELECT max(observed_at) - interval '7 days' FROM market.market_data_ticks)
    ),
    latest AS (
      SELECT DISTINCT ON (pair) pair, mid AS latest_mid, observed_at AS latest_at
      FROM ticks ORDER BY pair, observed_at DESC
    ),
    first AS (
      SELECT DISTINCT ON (pair) pair, mid AS first_mid
      FROM ticks ORDER BY pair, observed_at ASC
    )
    SELECT l.pair, substring(l.pair from 1 for 3) AS base, substring(l.pair from 4 for 3) AS quote,
      CASE WHEN f.first_mid IS NULL OR f.first_mid = 0 THEN 0 ELSE ((l.latest_mid - f.first_mid) / f.first_mid) * 100 END AS change_pct,
      l.latest_at AS "calculatedAt"
    FROM latest l JOIN first f USING (pair)
  `);
  const strength = new Map();
  for (const row of rows) {
    const change = Number(row.change_pct || 0);
    strength.set(row.base, (strength.get(row.base) || 0) + change);
    strength.set(row.quote, (strength.get(row.quote) || 0) - change);
  }
  const values = [...strength.values()];
  const maxAbs = Math.max(0.0001, ...values.map(value => Math.abs(value)));
  const matrix = [...strength.entries()].map(([currency, value]) => {
    const score = Math.round(50 + (value / maxAbs) * 50);
    return {
      currency,
      currentStrength: Math.max(0, Math.min(100, score)),
      previousStrength: 50,
      strengthChange: Math.round(value * 100) / 100,
      momentum: Math.abs(Math.round(value * 100)),
      trendDirection: value > 0 ? "Strengthening" : value < 0 ? "Weakening" : "Neutral",
      volatility: null,
      confidence: 75,
      strengthLabel: score >= 70 ? "Strong" : score <= 30 ? "Weak" : "Neutral",
      lastUpdated: rows.map(row => row.calculatedAt).filter(Boolean).sort().at(-1) || null
    };
  }).sort((a, b) => b.currentStrength - a.currentStrength);
  const byCurrency = new Map(matrix.map(row => [row.currency, row]));
  const pairs = rows.map(row => {
    const base = byCurrency.get(row.base)?.currentStrength ?? 50;
    const quote = byCurrency.get(row.quote)?.currentStrength ?? 50;
    const spread = base - quote;
    return {
      pair: row.pair,
      baseCurrency: row.base,
      quoteCurrency: row.quote,
      baseStrength: base,
      quoteStrength: quote,
      strengthSpread: Math.abs(spread),
      directionBias: spread > 5 ? "Buy" : spread < -5 ? "Sell" : "Neutral",
      trendAlignment: "Live tick aligned",
      momentumAlignment: "Live tick momentum",
      volatilityCondition: "Requires volatility scanner",
      opportunityScore: Math.min(100, Math.round(Math.abs(spread))),
      confidence: 75,
      qualification: Math.abs(spread) >= 10 ? "Qualified" : "Watchlist",
      calculatedAt: row.calculatedAt
    };
  }).sort((a, b) => b.opportunityScore - a.opportunityScore).map((row, index) => ({ rank: index + 1, ...row }));
  const rotation = matrix.map((row, index) => ({ currency: row.currency, previousRank: null, currentRank: index + 1, rankChange: null, rotationType: row.trendDirection, momentum: row.momentum, confidence: row.confidence, observedAt: row.lastUpdated }));
  const heatmap = matrix.flatMap(row => ["MN", "W1", "D1", "H4", "H1", "M15"].map(timeframe => ({ currency: row.currency, timeframe, strengthScore: row.currentStrength, direction: row.trendDirection, confidence: row.confidence, state: row.strengthLabel, observedAt: row.lastUpdated })));
  const opportunities = {
    topBuyForexPairs: pairs.filter(row => row.directionBias === "Buy").slice(0, 10),
    topSellForexPairs: pairs.filter(row => row.directionBias === "Sell").slice(0, 10),
    neutralPairs: pairs.filter(row => row.directionBias === "Neutral").slice(0, 10),
    rejectedPairs: [],
    blockedPairs: []
  };
  return { matrix, pairs, rotation, heatmap, divergence: [], opportunities };
}

export async function getMarketStructureLiveSource() {
  const states = await safeQuery(`SELECT instrument AS asset, asset_class AS "assetClass", market_structure AS "overallStructure", institutional_bias AS "signalDirection", confidence, updated_at AS "lastScanned" FROM market.instrument_institutional_states ORDER BY updated_at DESC`);
  const smc = await safeQuery(`SELECT instrument AS asset, smc_signal AS "latestSignal", direction, timeframe, price_zone AS "priceZone", confirmation, status, observed_at AS "observedAt" FROM market.smart_money_concept_signals ORDER BY observed_at DESC`);
  const scores = states.rows.map(row => ({ asset: row.asset, assetClass: row.assetClass, overallStructure: label(row.overallStructure), lastSwingPattern: row.overallStructure, latestSignal: smc.rows.find(s => s.asset === row.asset)?.latestSignal || "No Signal", signalDirection: row.signalDirection, structureScore: round(row.confidence), alignmentScore: round(row.confidence), confidence: round(row.confidence), opportunityImpact: "Live institutional structure source", qualification: round(row.confidence) >= 70 ? "Structure Qualified" : "Watchlist", lastScanned: row.lastScanned }));
  const matrix = scores.map(row => ({ asset: row.asset, assetClass: row.assetClass, timeframes: Object.fromEntries(["MN", "W1", "D1", "H4", "H1", "M15"].map(frame => [frame, { structureDirection: row.overallStructure, lastSwingStatus: row.lastSwingPattern, bosChochStatus: row.latestSignal, confidence: row.confidence, state: row.overallStructure }])), overallStructure: row.overallStructure, structureAlignment: row.alignmentScore, structureScore: row.structureScore, confidence: row.confidence, lastUpdated: row.lastScanned }));
  const bos = smc.rows.filter(row => /break of structure/i.test(row.latestSignal || "")).map(row => ({ asset: row.asset, timeframe: row.timeframe, direction: row.direction, brokenLevel: Number(row.priceZone) || null, breakType: row.latestSignal, confirmationType: row.confirmation, candleClose: null, retestStatus: row.status, confidence: 70, recommendedAction: "Review BOS confirmation" }));
  const choch = smc.rows.filter(row => /change of character/i.test(row.latestSignal || "")).map(row => ({ asset: row.asset, timeframe: row.timeframe, previousStructure: "Previous", newStructure: row.direction, chochLevel: Number(row.priceZone) || null, confirmation: row.confirmation, reversalProbability: 50, riskLevel: "Medium", confidence: 70, recommendedAction: "Review reversal risk" }));
  return { scores, matrix, rankings: scores.map((row, index) => ({ rank: index + 1, ...row })), bos, choch, swingPoints: [], shifts: [] };
}

export async function getVolatilityLiveSource() {
  const { rows } = await safeQuery(`SELECT instrument AS asset, atr, average_daily_range AS adr, realized_volatility AS "realizedVolatility", volatility_rank AS "volatilityRank", volatility_percentile AS "volatilityPercentile", expansion_signal AS "expansionSignal", status, observed_at AS "lastScanned" FROM market.volatility_regime_metrics ORDER BY observed_at DESC, instrument`);
  const scores = rows.map(row => {
    const score = round(row.volatilityPercentile ?? row.volatilityRank ?? row.realizedVolatility);
    return {
      asset: row.asset,
      assetClass: "Forex",
      atr: round(row.atr),
      adr: round(row.adr),
      realizedVolatility: round(row.realizedVolatility),
      volatilityRank: round(row.volatilityRank),
      volatilityPercentile: round(row.volatilityPercentile),
      expansionScore: row.expansionSignal === "Expansion" ? score : 0,
      compressionScore: row.expansionSignal === "Compression" ? 100 - (score || 0) : 0,
      breakoutReadinessScore: row.expansionSignal === "Compression" ? 60 : 30,
      abnormalVolatilityRisk: row.status === "Extreme" ? 90 : 0,
      overallVolatility: label(row.status),
      volatilityCondition: label(row.expansionSignal),
      volatilityScore: score,
      confidence: 92,
      qualification: row.status === "Extreme" ? "Too Volatile" : row.status === "Low" ? "Too Quiet" : "Volatility Qualified",
      lastScanned: row.lastScanned
    };
  });
  const matrix = scores.map(row => ({
    asset: row.asset,
    assetClass: row.assetClass,
    timeframes: Object.fromEntries(["MN", "W1", "D1", "H4", "H1", "M15"].map(frame => [frame, { atr: row.atr, volatilityState: row.overallVolatility, expansionCompressionState: row.volatilityCondition, confidence: row.confidence }])),
    overallVolatility: row.overallVolatility,
    volatilityCondition: row.volatilityCondition,
    volatilityScore: row.volatilityScore,
    confidence: row.confidence,
    lastUpdated: row.lastScanned
  }));
  const compression = scores.filter(row => row.volatilityCondition === "Compression").map(row => ({ asset: row.asset, timeframe: "Latest", compressionDuration: "Live source", currentRange: row.realizedVolatility, averageRange: row.adr, compressionPercent: row.compressionScore, breakoutReadiness: row.breakoutReadinessScore, liquidityContext: "Live market environment", confidence: row.confidence, recommendedAction: "Monitor breakout readiness", observedAt: row.lastScanned }));
  const expansion = scores.filter(row => row.volatilityCondition === "Expansion").map(row => ({ asset: row.asset, timeframe: "Latest", previousVolatility: null, currentVolatility: row.realizedVolatility, expansionPercent: row.expansionScore, expansionScore: row.expansionScore, trendSupport: "Live market environment", momentumSupport: "Requires momentum scan", riskLevel: row.overallVolatility, recommendedAction: "Review risk before entry", observedAt: row.lastScanned }));
  return { scores, matrix, rankings: scores.map((row, index) => ({ rank: index + 1, ...row, breakoutReadiness: String(row.breakoutReadinessScore ?? "No record"), abnormalRisk: String(row.abnormalVolatilityRisk ?? "No record") })), expansion, compression, breakoutReadiness: compression, abnormalRisk: scores.filter(row => row.abnormalVolatilityRisk > 0).map(row => ({ asset: row.asset, riskType: "Abnormal Volatility", timeframe: "Latest", currentVolatility: row.realizedVolatility, normalVolatility: row.adr, deviation: row.abnormalVolatilityRisk, severity: "High Risk", recommendedAction: "Avoid trading until volatility normalizes" })) };
}

export async function getLiquidityLiveSource() {
  const zones = await safeQuery(`SELECT instrument AS asset, liquidity_zone AS "liquidityZone", zone_type AS "liquidityType", price_level AS "liquidityLevel", timeframe, strength, distance_from_price AS distance, sweep_status AS "sweepStatus", risk_level AS "riskLevel", observed_at AS "observedAt" FROM market.liquidity_zones ORDER BY observed_at DESC`);
  const env = await safeQuery(`SELECT instrument AS asset, asset_class AS "assetClass", liquidity, spread_condition AS "spreadRisk", trading_suitability AS qualification, confidence, updated_at AS "lastScanned" FROM market.instrument_environment_states ORDER BY updated_at DESC`);
  const byAsset = new Map(env.rows.map(row => [row.asset, row]));
  const buySide = zones.rows.filter(row => /buy/i.test(row.liquidityZone || "")).map(row => ({ ...row, currentPrice: null, sweepProbability: row.sweepStatus === "Recently Swept" ? 100 : 35, trendContext: "Live liquidity zone", recommendedAction: row.sweepStatus === "Unswept" ? "Monitor sweep" : "Review reaction" }));
  const sellSide = zones.rows.filter(row => /sell/i.test(row.liquidityZone || "")).map(row => ({ ...row, currentPrice: null, sweepProbability: row.sweepStatus === "Recently Swept" ? 100 : 35, trendContext: "Live liquidity zone", recommendedAction: row.sweepStatus === "Unswept" ? "Monitor sweep" : "Review reaction" }));
  const assets = [...new Set([...zones.rows.map(row => row.asset), ...env.rows.map(row => row.asset)])];
  const scores = assets.map(asset => {
    const source = byAsset.get(asset) || {};
    const assetZones = zones.rows.filter(row => row.asset === asset);
    return { asset, assetClass: source.assetClass || "Forex", liquidityBias: source.liquidity || "Two-Sided Liquidity", liquidityScore: assetZones.length ? 70 : 0, sweepRisk: assetZones.some(row => /swept/i.test(row.sweepStatus || "")) ? "Liquidity Sweep" : "Low", voidRisk: "Insufficient Data", stopClusterRisk: "Low", brokerLiquidity: "No broker risk record", spreadRisk: source.spreadRisk || "Unknown", executionRisk: source.qualification || "Insufficient Data", confidence: round(source.confidence) || 92, qualification: assetZones.length ? "Liquidity Qualified" : "Insufficient Data", lastScanned: source.lastScanned || assetZones[0]?.observedAt };
  });
  const matrix = scores.map(row => ({ asset: row.asset, assetClass: row.assetClass, timeframes: Object.fromEntries(["MN", "W1", "D1", "H4", "H1", "M15"].map(frame => [frame, { buySideStatus: buySide.some(z => z.asset === row.asset) ? "Buy-Side Liquidity" : "No Clear Liquidity", sellSideStatus: sellSide.some(z => z.asset === row.asset) ? "Sell-Side Liquidity" : "No Clear Liquidity", sweepStatus: row.sweepRisk, liquidityState: row.liquidityBias, confidence: row.confidence }])), overallLiquidity: row.liquidityBias, liquidityScore: row.liquidityScore, sweepRisk: row.sweepRisk, executionRisk: row.executionRisk, confidence: row.confidence, lastUpdated: row.lastScanned }));
  const sweeps = zones.rows.filter(row => /swept/i.test(row.sweepStatus || "")).map(row => ({ asset: row.asset, timeframe: row.timeframe, sweepType: row.liquidityZone, sweptLevel: row.liquidityLevel, sweepTime: row.observedAt, confirmation: row.sweepStatus, reversalProbability: 50, continuationProbability: 50, confidence: 70, riskLevel: row.riskLevel }));
  const stops = zones.rows.filter(row => /stop/i.test(row.liquidityType || "")).map(row => ({ asset: row.asset, clusterLocation: row.liquidityZone, priceLevel: row.liquidityLevel, clusterType: row.liquidityType, distanceFromPrice: row.distance, sweepRisk: row.sweepStatus, riskLevel: row.riskLevel, recommendedAction: "Monitor stop cluster" }));
  return { scores, matrix, rankings: scores.map((row, index) => ({ rank: index + 1, ...row, nearestBuySideLiquidity: buySide.find(z => z.asset === row.asset)?.liquidityLevel, nearestSellSideLiquidity: sellSide.find(z => z.asset === row.asset)?.liquidityLevel })), buySide, sellSide, sweeps, voids: [], stopClusters: stops, brokerRisk: [] };
}

export async function getInstitutionalLiveSource() {
  const states = await safeQuery(`SELECT instrument AS asset, asset_class AS "assetClass", cot_bias AS "cotBias", smart_money_bias AS "smartMoneyBias", liquidity_bias AS "liquidityConfirmation", market_structure AS "marketStructure", accumulation_distribution AS "accumulationDistribution", institutional_bias AS "institutionalBias", confidence, payload, updated_at AS "lastScanned" FROM market.instrument_institutional_states ORDER BY updated_at DESC`);
  const acc = await safeQuery(`SELECT instrument AS asset, 'Latest' AS timeframe, state, concat_ws(' / ', volume_behaviour, range_compression, breakout_failure) AS evidence, market_structure_shift AS "structureContext", volume_behaviour AS "volumeTickContext", liquidity_sweeps AS "liquidityContext", confidence, 'Review institutional context' AS "recommendedAction", observed_at AS "observedAt" FROM market.accumulation_distribution_states ORDER BY observed_at DESC`);
  const smc = await safeQuery(`SELECT instrument AS asset, smc_signal AS "smcSignal", direction, timeframe, price_zone AS "priceZone", strength, confirmation, invalidation_level AS "invalidationLevel", status, observed_at AS "observedAt" FROM market.smart_money_concept_signals ORDER BY observed_at DESC`);
  const cot = await safeQuery(`SELECT market AS asset, market AS "cotMarket", commercial_net AS "commercialNet", large_spec_net AS "largeSpecNet", small_spec_net AS "smallSpecNet", open_interest AS "openInterest", weekly_change AS "weeklyChange", cot_bias AS "cotBias", cot_bias AS "cotAlignment", extreme_positioning AS "extremePositioning", last_report_date AS "lastReportDate", observed_at AS "observedAt" FROM market.cot_positioning_metrics ORDER BY observed_at DESC`);
  const scores = states.rows.map(row => ({ ...row, orderBlockSignal: smc.rows.find(s => s.asset === row.asset && /order block/i.test(s.smcSignal || ""))?.smcSignal || "No Signal", fvgSignal: smc.rows.find(s => s.asset === row.asset && /fair value|fvg/i.test(s.smcSignal || ""))?.smcSignal || "No Signal", institutionalScore: round(row.payload?.score), qualification: round(row.confidence) >= 70 ? "Institutional Qualified" : "Watchlist" }));
  const matrix = scores.map(row => ({ asset: row.asset, assetClass: row.assetClass, timeframes: Object.fromEntries(["MN", "W1", "D1", "H4", "H1", "M15"].map(frame => [frame, { institutionalBias: row.institutionalBias, smcSignal: smc.rows.find(s => s.asset === row.asset)?.smcSignal || "No Signal", liquidityConfirmation: row.liquidityConfirmation, confidence: round(row.confidence) }])), cotBias: row.cotBias, smartMoneyBias: row.smartMoneyBias, institutionalScore: row.institutionalScore, confidence: round(row.confidence), lastUpdated: row.lastScanned }));
  const liquidityConfirmation = smc.rows.filter(row => /liquidity sweep/i.test(row.smcSignal || "")).map(row => ({ asset: row.asset, sweepType: "Liquidity Sweep", sweptLevel: Number(row.priceZone) || null, sweepTime: row.observedAt, structureReaction: row.confirmation, institutionalConfirmation: row.status, reversalProbability: 50, continuationProbability: 50, confidence: 70 }));
  return { scores, matrix, rankings: scores.map((row, index) => ({ rank: index + 1, ...row })), cotAlignment: cot.rows, accumulationDistribution: acc.rows, smc: smc.rows, liquidityConfirmation, orderBlocksFvg: smc.rows.filter(row => /order block|fair value|fvg|breaker|mitigation/i.test(row.smcSignal || "")).map(row => ({ asset: row.asset, signalType: row.smcSignal, direction: row.direction, timeframe: row.timeframe, priceZone: row.priceZone, createdAt: row.observedAt, mitigationStatus: row.status, strength: row.strength, confidence: 70 })) };
}
