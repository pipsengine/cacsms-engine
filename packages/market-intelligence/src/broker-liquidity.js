import { query } from "./db.js";

const EXPECTED_INPUTS = Object.freeze([
  ["broker_data", "Broker Data", 1],
  ["mt5_feed", "MT5 Feed", 1],
  ["mt4_feed", "MT4 Feed", 0.75],
  ["ctrader_feed", "cTrader Feed", 0.75],
  ["fix_api", "FIX API", 0.85],
  ["rest_api", "REST API", 0.65],
  ["tick_data", "Tick Data", 1],
  ["bid_ask_data", "Bid/Ask Data", 1],
  ["spread_history", "Spread History", 1],
  ["execution_logs", "Execution Logs", 1],
  ["slippage_logs", "Slippage Logs", 0.9],
  ["economic_calendar", "Economic Calendar", 0.8],
  ["news_sentiment", "News Sentiment", 0.7],
  ["market_environment", "Market Environment", 0.7]
]);

const SESSIONS = Object.freeze(["Sydney", "Tokyo", "London", "New York", "London/New York Overlap", "Rollover", "Weekend Close", "Market Open"]);

function round(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

function avg(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function latestBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key) || new Date(row.observedAt) > new Date(map.get(key).observedAt)) map.set(key, row);
  }
  return [...map.values()];
}

function labelForScore(score) {
  if (score == null) return "Insufficient Data";
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Normal";
  if (score >= 40) return "Weak";
  if (score >= 20) return "Poor";
  return "Critical";
}

function tradeabilityFor(score, newsRisk, spreadRisk, slippageRisk) {
  if (score == null) return "Insufficient Data";
  if (newsRisk >= 70) return "News Risk";
  if (score < 20) return "Avoid Trading";
  if (spreadRisk >= 70 || slippageRisk >= 70) return "Low Liquidity";
  if (score < 60) return "Trade with Caution";
  return "Safe to Trade";
}

function scoreFromMetric(value, excellent, critical) {
  if (value == null) return null;
  if (value <= excellent) return 100;
  if (value >= critical) return 0;
  return Math.max(0, Math.min(100, 100 - ((value - excellent) / (critical - excellent)) * 100));
}

function freshnessLabel(seconds) {
  if (seconds == null) return "No live timestamp";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function normalizeRow(row) {
  const liquidityScore = round(row.liquidity_score);
  const spreadRisk = round(row.spread_widening_risk);
  const slippageRisk = round(row.slippage_risk);
  const newsRisk = round(row.news_liquidity_risk);
  return {
    id: row.id,
    broker: row.broker_name,
    platform: row.platform,
    server: row.server_name,
    accountType: row.account_type,
    instrument: row.instrument,
    bid: row.bid == null ? null : Number(row.bid),
    ask: row.ask == null ? null : Number(row.ask),
    spread: row.spread == null ? null : Number(row.spread),
    averageSpread: row.average_spread == null ? null : Number(row.average_spread),
    spreadChange: row.spread_change_percent == null ? null : Number(row.spread_change_percent),
    slippageAvg: row.slippage_avg == null ? null : Number(row.slippage_avg),
    executionSpeedMs: row.execution_speed_ms,
    orderRejectionPercent: row.order_rejection_percent == null ? null : Number(row.order_rejection_percent),
    liquidityScore,
    liquidityLabel: labelForScore(liquidityScore),
    spreadStability: round(row.spread_stability_score),
    spreadWideningRisk: spreadRisk,
    slippageRisk,
    executionQuality: round(row.execution_quality_score),
    orderRejectionRisk: round(row.order_rejection_risk),
    depthAvailability: round(row.depth_score),
    sessionLiquidity: round(row.session_liquidity_score),
    newsLiquidityRisk: newsRisk,
    brokerTradeabilityScore: round(row.broker_tradeability_score),
    tradeability: row.tradeability || tradeabilityFor(liquidityScore, newsRisk, spreadRisk, slippageRisk),
    lastUpdated: row.observed_at,
    observedAt: row.observed_at
  };
}

function normalizeInput(row) {
  return {
    id: row.id,
    input: row.input_label,
    inputKey: row.input_key,
    provider: row.provider_name || row.broker_name || "Input unavailable",
    server: row.server_name || "Unavailable",
    status: row.status,
    freshness: freshnessLabel(row.freshness_seconds),
    health: row.health_score == null ? "Insufficient Data" : labelForScore(Number(row.health_score)),
    healthScore: row.health_score == null ? null : Number(row.health_score),
    weight: Number(row.weight),
    lastUpdated: row.last_updated_at,
    usedInLiquidityScore: row.used_in_liquidity_score,
    missingMessage: row.status === "unavailable" ? "Input unavailable. Broker liquidity confidence score reduced." : null
  };
}

function normalizeDerivedInput(row) {
  return {
    id: row.input_key,
    input: row.input_label,
    inputKey: row.input_key,
    provider: row.provider_name || "Input unavailable",
    server: row.server_name || "Unavailable",
    status: row.status,
    freshness: row.last_updated_at ? freshnessLabel(Number(row.freshness_seconds || 0)) : "No live timestamp",
    health: row.health_score == null ? "Insufficient Data" : labelForScore(Number(row.health_score)),
    healthScore: row.health_score == null ? null : Number(row.health_score),
    weight: Number(row.weight),
    lastUpdated: row.last_updated_at,
    usedInLiquidityScore: row.used_in_liquidity_score,
    missingMessage: row.status === "unavailable" ? "Input unavailable. Broker liquidity confidence score reduced." : null
  };
}

function emptyInputRows() {
  return EXPECTED_INPUTS.map(([inputKey, input, weight]) => ({
    id: inputKey,
    inputKey,
    input,
    provider: "Input unavailable",
    server: "Unavailable",
    status: "unavailable",
    freshness: "No live timestamp",
    health: "Insufficient Data",
    healthScore: null,
    weight,
    lastUpdated: null,
    usedInLiquidityScore: true,
    missingMessage: "Input unavailable. Broker liquidity confidence score reduced."
  }));
}

function buildSummary(rows, inputs, alerts, sessions, newsRisks) {
  const scores = rows.map((row) => row.liquidityScore).filter((value) => value != null);
  const overall = avg(scores);
  const ordered = [...rows].filter((row) => row.liquidityScore != null).sort((a, b) => b.liquidityScore - a.liquidityScore);
  const connectedFeeds = new Set(rows.map((row) => `${row.broker}|${row.server}`)).size;
  const rejected = rows.reduce((sum, row) => sum + Number(row.orderRejectionPercent || 0), 0);
  const confidenceInputs = inputs.filter((input) => input.status !== "unavailable" && input.usedInLiquidityScore);
  const confidence = inputs.length ? (confidenceInputs.reduce((sum, input) => sum + Number(input.healthScore || 0) * Number(input.weight || 1), 0) / inputs.reduce((sum, input) => sum + Number(input.weight || 1), 0)) : null;
  return {
    sourceMode: "PRODUCTION_LIVE_ONLY",
    mockDataDisabled: true,
    status: rows.length ? "ready" : "insufficient_data",
    lastLiquidityCheck: rows[0]?.lastUpdated || null,
    liquidityConfidenceScore: round(confidence),
    overallLiquidityScore: overall == null ? null : round(overall),
    overallLiquidity: labelForScore(overall),
    bestBrokerLiquidity: ordered[0] ? `${ordered[0].broker} / ${ordered[0].server}` : "Insufficient Data",
    worstBrokerLiquidity: ordered.at(-1) ? `${ordered.at(-1).broker} / ${ordered.at(-1).server}` : "Insufficient Data",
    averageSpread: round(avg(rows.map((row) => row.spread))),
    spreadWideningAlerts: alerts.filter((alert) => /spread/i.test(alert.title) || /spread/i.test(alert.message)).length,
    averageSlippage: round(avg(rows.map((row) => row.slippageAvg))),
    executionQuality: labelForScore(avg(rows.map((row) => row.executionQuality))),
    rejectedOrders: round(rejected),
    highRiskInstruments: new Set(rows.filter((row) => ["Avoid Trading", "News Risk", "Low Liquidity"].includes(row.tradeability)).map((row) => row.instrument)).size,
    newsLiquidityRisk: newsRisks.some((row) => ["critical", "high", "high_risk"].includes(String(row.liquidityRisk).toLowerCase())) ? "High Risk" : newsRisks.length ? "Normal" : "Insufficient Data",
    sessionLiquidityRisk: sessions.some((row) => ["weak", "poor", "critical"].includes(String(row.liquidityCondition).toLowerCase())) ? "Elevated" : sessions.length ? "Normal" : "Insufficient Data",
    connectedBrokerFeeds: connectedFeeds
  };
}

function buildComparison(rows, executionRows) {
  const byBroker = new Map();
  for (const row of rows) {
    const key = `${row.broker}|${row.platform}|${row.server}`;
    if (!byBroker.has(key)) byBroker.set(key, []);
    byBroker.get(key).push(row);
  }
  return [...byBroker.entries()].map(([key, group]) => {
    const [broker, platform, server] = key.split("|");
    const exec = executionRows.find((row) => row.broker_name === broker && row.server_name === server);
    return {
      broker,
      platform,
      server,
      spread: round(avg(group.map((row) => row.spread))),
      slippage: round(avg(group.map((row) => row.slippageAvg))),
      executionSpeedMs: round(avg(group.map((row) => row.executionSpeedMs))),
      rejectRate: round(avg(group.map((row) => row.orderRejectionPercent))),
      latencyMs: exec?.latency_ms ?? round(avg(group.map((row) => row.executionSpeedMs))),
      depthAvailability: exec?.depth_availability == null ? round(avg(group.map((row) => row.depthAvailability))) : Number(exec.depth_availability),
      newsPerformance: exec?.news_performance == null ? labelForScore(100 - avg(group.map((row) => row.newsLiquidityRisk).filter((value) => value != null))) : labelForScore(Number(exec.news_performance)),
      sessionStability: exec?.session_stability == null ? labelForScore(avg(group.map((row) => row.sessionLiquidity))) : labelForScore(Number(exec.session_stability)),
      overallLiquidityScore: round(avg(group.map((row) => row.liquidityScore))),
      overallLiquidity: labelForScore(avg(group.map((row) => row.liquidityScore)))
    };
  }).sort((left, right) => Number(right.overallLiquidityScore || 0) - Number(left.overallLiquidityScore || 0));
}

function buildAiSummary(summary, brokers, alerts) {
  if (summary.status === "insufficient_data") {
    return {
      status: "insufficient_data",
      title: "AI Broker Liquidity Interpretation",
      generatedAt: null,
      narrative: "Broker liquidity cannot be calculated yet. Connect broker data, MT5/MT4 feeds, tick data, spread history, and execution logs to enable live broker liquidity intelligence.",
      bullets: [
        "Current liquidity condition: Insufficient Data",
        "Best broker/server for execution: Insufficient Data",
        "Worst liquidity instruments: Insufficient Data",
        "Spread, slippage, news, session, and prop firm caution require live production records."
      ]
    };
  }
  const caution = brokers.filter((row) => row.tradeability !== "Safe to Trade").slice(0, 5);
  return {
    status: "ready",
    title: "AI Broker Liquidity Interpretation",
    generatedAt: new Date().toISOString(),
    narrative: `Current broker liquidity is ${summary.overallLiquidity}. Best execution candidate is ${summary.bestBrokerLiquidity}. Monitor ${alerts.length} active liquidity alert(s) before placing trades.`,
    bullets: [
      `Current liquidity condition: ${summary.overallLiquidity}`,
      `Best broker/server for execution: ${summary.bestBrokerLiquidity}`,
      `Worst liquidity instruments: ${caution.map((row) => row.instrument).join(", ") || "None flagged"}`,
      `Spread risk: ${summary.spreadWideningAlerts ? "Elevated" : "Normal"}`,
      `Slippage risk: ${summary.averageSlippage == null ? "Insufficient Data" : summary.averageSlippage}`,
      `News execution risk: ${summary.newsLiquidityRisk}`,
      `Session-based caution: ${summary.sessionLiquidityRisk}`,
      "Prop firm trading caution: apply active restriction windows before execution."
    ]
  };
}

async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    if (error.code === "42P01" || error.code === "42703") return { rows: [] };
    throw error;
  }
}

async function getDerivedInputsFromMarketData() {
  const { rows } = await safeQuery(`
    WITH provider_stats AS (
      SELECT
        p.id,
        p.name,
        p.provider_type,
        p.connection_method,
        p.status,
        p.enabled,
        p.config,
        p.capabilities,
        COALESCE(p.config->'mt5'->>'brokerName', p.name) AS broker_name,
        COALESCE(p.config->'mt5'->>'serverName', p.provider_code, p.name) AS server_name,
        p.updated_at,
        h.health,
        h.status AS health_status,
        h.observed_at AS health_observed_at,
        l.latency_ms,
        l.observed_at AS latency_observed_at,
        t.tick_count,
        t.last_tick_at,
        c.coverage_count
      FROM market.market_data_providers p
      LEFT JOIN LATERAL (
        SELECT health, status, observed_at
        FROM market.market_data_health h
        WHERE h.provider_id = p.id
        ORDER BY observed_at DESC
        LIMIT 1
      ) h ON true
      LEFT JOIN LATERAL (
        SELECT latency_ms, observed_at
        FROM market.market_data_latency l
        WHERE l.provider_id = p.id
        ORDER BY observed_at DESC
        LIMIT 1
      ) l ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS tick_count, max(observed_at) AS last_tick_at
        FROM market.market_data_ticks t
        WHERE t.provider_id = p.id
      ) t ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS coverage_count
        FROM market.market_data_coverage c
        WHERE c.provider_id = p.id AND (c.price_feed OR c.tick_feed OR c.spread_feed)
      ) c ON true
      WHERE p.archived = false AND p.enabled = true
    )
    SELECT *
    FROM provider_stats
    ORDER BY name
  `);
  if (!rows.length) return emptyInputRows();

  const primary = rows[0];
  const tickCount = rows.reduce((sum, row) => sum + Number(row.tick_count || 0), 0);
  const coverageCount = rows.reduce((sum, row) => sum + Number(row.coverage_count || 0), 0);
  const bestUpdated = rows.map((row) => row.last_tick_at || row.health_observed_at || row.latency_observed_at || row.updated_at).filter(Boolean).sort().at(-1);
  const avgHealth = avg(rows.map((row) => Number(row.health ?? row.enabled ? 80 : 0)));
  const hasCapability = (key) => rows.some((row) => row.capabilities?.[key] === true);
  const providerFor = (key) => rows.find((row) => {
    if (key === "mt5_feed") return row.provider_type === "MT5" || row.connection_method === "MT5 Bridge";
    if (key === "rest_api") return row.connection_method === "REST API";
    if (key === "fix_api") return row.connection_method === "FIX";
    if (key === "tick_data") return Number(row.tick_count || 0) > 0 || hasCapability("tickData");
    if (key === "bid_ask_data") return Number(row.tick_count || 0) > 0 || hasCapability("realTimePrices");
    if (key === "spread_history") return Number(row.tick_count || 0) > 0 || hasCapability("spreadData");
    if (key === "broker_data") return true;
    return null;
  });

  return EXPECTED_INPUTS.map(([inputKey, input, weight]) => {
    const provider = providerFor(inputKey);
    const available = Boolean(provider) || (["tick_data", "bid_ask_data", "spread_history"].includes(inputKey) && tickCount > 0);
    const providerName = provider?.broker_name || primary.broker_name;
    const serverName = provider?.server_name || primary.server_name;
    const updatedAt = provider?.last_tick_at || provider?.health_observed_at || bestUpdated;
    const healthScore = available
      ? inputKey === "execution_logs" || inputKey === "slippage_logs"
        ? null
        : inputKey === "broker_data"
          ? avgHealth
          : 85
      : null;
    return normalizeDerivedInput({
      input_key: inputKey,
      input_label: input,
      provider_name: available ? providerName : null,
      server_name: available ? serverName : null,
      status: available ? "live" : "unavailable",
      health_score: healthScore,
      weight,
      last_updated_at: available ? updatedAt : null,
      freshness_seconds: updatedAt ? Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 1000)) : null,
      used_in_liquidity_score: true
    });
  });
}

async function getDerivedBrokerRowsFromMarketData() {
  const { rows } = await safeQuery(`
    WITH latest_ticks AS (
      SELECT DISTINCT ON (t.provider_id, t.symbol)
        t.provider_id, t.symbol, t.bid, t.ask, t.spread, t.observed_at, t.id AS source_record_id
      FROM market.market_data_ticks t
      ORDER BY t.provider_id, t.symbol, t.observed_at DESC
    ),
    spread_stats AS (
      SELECT
        provider_id,
        symbol,
        avg(spread) AS average_spread,
        min(spread) AS minimum_spread,
        max(spread) AS maximum_spread
      FROM market.market_data_ticks
      WHERE observed_at >= now() - interval '7 days'
      GROUP BY provider_id, symbol
    )
    SELECT
      lt.source_record_id::text AS id,
      COALESCE(p.config->'mt5'->>'brokerName', p.name) AS broker_name,
      COALESCE(p.provider_type, p.connection_method, 'Broker Feed') AS platform,
      COALESCE(p.config->'mt5'->>'serverName', p.provider_code, p.name) AS server_name,
      COALESCE(NULLIF(p.environment, ''), 'Production') AS account_type,
      lt.symbol AS instrument,
      lt.bid,
      lt.ask,
      lt.spread,
      ss.average_spread,
      CASE WHEN ss.average_spread IS NULL OR ss.average_spread = 0 THEN NULL
        ELSE ((lt.spread - ss.average_spread) / ss.average_spread) * 100 END AS spread_change_percent,
      NULL::numeric AS slippage_avg,
      l.latency_ms AS execution_speed_ms,
      NULL::numeric AS order_rejection_percent,
      COALESCE((p.capabilities->>'depthOfMarket')::boolean, false) AS depth_available,
      CASE WHEN COALESCE((p.capabilities->>'depthOfMarket')::boolean, false) THEN 85 ELSE 45 END AS depth_score,
      lt.observed_at
    FROM latest_ticks lt
    JOIN market.market_data_providers p ON p.id = lt.provider_id
    LEFT JOIN spread_stats ss ON ss.provider_id = lt.provider_id AND ss.symbol = lt.symbol
    LEFT JOIN LATERAL (
      SELECT latency_ms
      FROM market.market_data_latency l
      WHERE l.provider_id = p.id
      ORDER BY l.observed_at DESC
      LIMIT 1
    ) l ON true
    WHERE p.archived = false AND p.enabled = true
    ORDER BY lt.observed_at DESC, broker_name, lt.symbol
    LIMIT 500
  `);

  return rows.map((row) => {
    const calculated = BrokerLiquidityEngine.calculate({
      spread: row.spread == null ? null : Number(row.spread),
      averageSpread: row.average_spread == null ? null : Number(row.average_spread),
      slippageAvg: null,
      executionSpeedMs: row.execution_speed_ms,
      orderRejectionPercent: null,
      depthAvailable: row.depth_available,
      depthScore: Number(row.depth_score)
    });
    return {
      id: row.id,
      broker: row.broker_name,
      platform: row.platform,
      server: row.server_name,
      accountType: row.account_type,
      instrument: row.instrument,
      bid: row.bid == null ? null : Number(row.bid),
      ask: row.ask == null ? null : Number(row.ask),
      spread: row.spread == null ? null : Number(row.spread),
      averageSpread: row.average_spread == null ? null : Number(row.average_spread),
      spreadChange: row.spread_change_percent == null ? null : Number(row.spread_change_percent),
      slippageAvg: null,
      executionSpeedMs: row.execution_speed_ms,
      orderRejectionPercent: null,
      liquidityScore: calculated.liquidityScore,
      liquidityLabel: labelForScore(calculated.liquidityScore),
      spreadStability: calculated.spreadStability,
      spreadWideningRisk: calculated.spreadWideningRisk,
      slippageRisk: calculated.slippageRisk,
      executionQuality: calculated.executionQuality,
      orderRejectionRisk: calculated.orderRejectionRisk,
      depthAvailability: calculated.depthAvailability,
      sessionLiquidity: null,
      newsLiquidityRisk: null,
      brokerTradeabilityScore: calculated.brokerTradeabilityScore,
      tradeability: calculated.tradeability,
      lastUpdated: row.observed_at,
      observedAt: row.observed_at
    };
  });
}

async function getDerivedSpreadMetricsFromMarketData() {
  const { rows } = await safeQuery(`
    WITH stats AS (
      SELECT
        t.provider_id,
        t.symbol,
        avg(t.spread) AS average_spread,
        min(t.spread) AS minimum_spread,
        max(t.spread) AS maximum_spread,
        max(t.observed_at) AS observed_at
      FROM market.market_data_ticks t
      WHERE t.observed_at >= now() - interval '7 days'
      GROUP BY t.provider_id, t.symbol
    ),
    latest AS (
      SELECT DISTINCT ON (provider_id, symbol) provider_id, symbol, spread AS current_spread
      FROM market.market_data_ticks
      ORDER BY provider_id, symbol, observed_at DESC
    )
    SELECT
      COALESCE(p.config->'mt5'->>'brokerName', p.name) AS broker_name,
      COALESCE(p.provider_type, p.connection_method, 'Broker Feed') AS platform,
      COALESCE(p.config->'mt5'->>'serverName', p.provider_code, p.name) AS server_name,
      COALESCE(NULLIF(p.environment, ''), 'Production') AS account_type,
      s.symbol AS instrument,
      l.current_spread,
      s.average_spread,
      s.minimum_spread,
      s.maximum_spread,
      CASE WHEN s.maximum_spread = s.minimum_spread THEN 50
        ELSE ((l.current_spread - s.minimum_spread) / NULLIF(s.maximum_spread - s.minimum_spread, 0)) * 100 END AS spread_percentile,
      CASE WHEN s.average_spread IS NULL OR s.average_spread = 0 THEN NULL
        ELSE ((l.current_spread - s.average_spread) / s.average_spread) * 100 END AS spread_widening_percent,
      s.observed_at
    FROM stats s
    JOIN latest l ON l.provider_id = s.provider_id AND l.symbol = s.symbol
    JOIN market.market_data_providers p ON p.id = s.provider_id
    WHERE p.archived = false AND p.enabled = true
    ORDER BY s.observed_at DESC
    LIMIT 500
  `);

  return rows.map((row) => {
    const widening = row.spread_widening_percent == null ? null : Number(row.spread_widening_percent);
    const stability = widening == null ? "Insufficient Data" : widening > 100 ? "Critical" : widening > 50 ? "Weak" : widening > 20 ? "Normal" : "Good";
    return {
      id: `${row.broker_name}-${row.instrument}`,
      broker: row.broker_name,
      platform: row.platform,
      server: row.server_name,
      accountType: row.account_type,
      instrument: row.instrument,
      session: "Current Live Feed",
      newsWindow: "No linked news window",
      currentSpread: row.current_spread == null ? null : Number(row.current_spread),
      averageSpread: row.average_spread == null ? null : Number(row.average_spread),
      minimumSpread: row.minimum_spread == null ? null : Number(row.minimum_spread),
      maximumSpread: row.maximum_spread == null ? null : Number(row.maximum_spread),
      spreadPercentile: row.spread_percentile == null ? null : Number(row.spread_percentile),
      spreadWideningPercent: widening,
      spreadStability: stability,
      alertStatus: widening != null && widening > 50 ? "Warning" : "Normal",
      observedAt: row.observed_at
    };
  });
}

async function getDerivedExecutionMetricsFromMarketData() {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (p.id)
      p.id,
      COALESCE(p.config->'mt5'->>'brokerName', p.name) AS broker_name,
      COALESCE(p.provider_type, p.connection_method, 'Broker Feed') AS platform,
      COALESCE(p.config->'mt5'->>'serverName', p.provider_code, p.name) AS server_name,
      COALESCE(NULLIF(p.environment, ''), 'Production') AS account_type,
      l.latency_ms,
      l.latency_class,
      l.observed_at
    FROM market.market_data_providers p
    JOIN market.market_data_latency l ON l.provider_id = p.id
    WHERE p.archived = false AND p.enabled = true
    ORDER BY p.id, l.observed_at DESC
  `);
  return rows.map((row) => ({
    id: row.id,
    broker: row.broker_name,
    platform: row.platform,
    server: row.server_name,
    accountType: row.account_type,
    instrument: "All Live Symbols",
    orderType: "Market",
    averageSlippage: null,
    positiveSlippage: null,
    negativeSlippage: null,
    executionTimeMs: row.latency_ms,
    rejectedOrders: 0,
    partialFills: 0,
    timeouts: 0,
    requotes: 0,
    modificationFailures: 0,
    rejectRate: null,
    fillQuality: row.latency_class || "Insufficient Data",
    riskLevel: row.latency_ms == null ? "Insufficient Data" : row.latency_ms <= 50 ? "Good" : row.latency_ms <= 250 ? "Normal" : "Weak",
    observedAt: row.observed_at
  }));
}

export class BrokerLiquidityEngine {
  static scoreLabel(score) {
    return labelForScore(score);
  }

  static calculate(record = {}) {
    const spreadScore = scoreFromMetric(record.spread, record.averageSpread || record.spread || 0, (record.averageSpread || record.spread || 1) * 3);
    const slippageScore = scoreFromMetric(Math.abs(Number(record.slippageAvg ?? 0)), 0.1, 3);
    const executionScore = scoreFromMetric(record.executionSpeedMs, 50, 1000);
    const rejectionScore = scoreFromMetric(record.orderRejectionPercent, 0.5, 15);
    const depthScore = record.depthAvailable === false ? 30 : record.depthScore ?? 70;
    const liquidityScore = avg([spreadScore, slippageScore, executionScore, rejectionScore, depthScore]);
    const spreadWideningRisk = record.averageSpread ? Math.max(0, ((record.spread || 0) - record.averageSpread) / record.averageSpread * 100) : null;
    const slippageRisk = slippageScore == null ? null : 100 - slippageScore;
    const orderRejectionRisk = rejectionScore == null ? null : 100 - rejectionScore;
    return {
      liquidityScore: round(liquidityScore),
      spreadStability: round(spreadScore),
      spreadWideningRisk: round(spreadWideningRisk),
      slippageRisk: round(slippageRisk),
      executionQuality: round(executionScore),
      orderRejectionRisk: round(orderRejectionRisk),
      depthAvailability: round(depthScore),
      sessionLiquidity: record.sessionLiquidityScore ?? null,
      newsLiquidityRisk: record.newsLiquidityRisk ?? null,
      brokerTradeabilityScore: round(liquidityScore),
      tradeability: tradeabilityFor(liquidityScore, record.newsLiquidityRisk, spreadWideningRisk, slippageRisk)
    };
  }
}

export async function getBrokerLiquidityInputs() {
  const { rows } = await safeQuery(`
    SELECT *, EXTRACT(EPOCH FROM (now() - last_updated_at))::int AS freshness_seconds
    FROM market.broker_liquidity_inputs
    ORDER BY input_label, provider_name NULLS LAST
  `);
  if (!rows.length) {
    const inputs = await getDerivedInputsFromMarketData();
    return { inputs, missingInputs: inputs.filter((row) => row.status === "unavailable").length };
  }
  const seen = new Set(rows.map((row) => row.input_key));
  const missing = EXPECTED_INPUTS.filter(([key]) => !seen.has(key)).map(([inputKey, input, weight]) => ({
    id: inputKey,
    inputKey,
    input,
    provider: "Input unavailable",
    server: "Unavailable",
    status: "unavailable",
    freshness: "No live timestamp",
    health: "Insufficient Data",
    healthScore: null,
    weight,
    lastUpdated: null,
    usedInLiquidityScore: true,
    missingMessage: "Input unavailable. Broker liquidity confidence score reduced."
  }));
  const inputs = [...rows.map(normalizeInput), ...missing];
  return { inputs, missingInputs: inputs.filter((row) => row.status === "unavailable").length };
}

export async function getBrokerLiquidityRows() {
  const { rows } = await safeQuery("SELECT * FROM market.broker_liquidity_scores ORDER BY observed_at DESC LIMIT 500");
  if (!rows.length) return { brokers: await getDerivedBrokerRowsFromMarketData() };
  return { brokers: latestBy(rows.map(normalizeRow), (row) => `${row.broker}|${row.server}|${row.instrument}`) };
}

export async function getBrokerSpreadMetrics() {
  const { rows } = await safeQuery("SELECT * FROM market.broker_spread_metrics ORDER BY observed_at DESC LIMIT 500");
  if (!rows.length) return { spreads: await getDerivedSpreadMetricsFromMarketData() };
  return {
    spreads: latestBy(rows.map((row) => ({
      id: row.id,
      broker: row.broker_name,
      platform: row.platform,
      server: row.server_name,
      accountType: row.account_type,
      instrument: row.instrument,
      session: row.session_name,
      newsWindow: row.news_window,
      currentSpread: row.current_spread == null ? null : Number(row.current_spread),
      averageSpread: row.average_spread == null ? null : Number(row.average_spread),
      minimumSpread: row.minimum_spread == null ? null : Number(row.minimum_spread),
      maximumSpread: row.maximum_spread == null ? null : Number(row.maximum_spread),
      spreadPercentile: row.spread_percentile == null ? null : Number(row.spread_percentile),
      spreadWideningPercent: row.spread_widening_percent == null ? null : Number(row.spread_widening_percent),
      spreadStability: row.spread_stability || "Insufficient Data",
      alertStatus: row.alert_status || "Insufficient Data",
      observedAt: row.observed_at
    })), (row) => `${row.broker}|${row.server}|${row.instrument}|${row.session || ""}|${row.newsWindow || ""}`)
  };
}

export async function getBrokerExecutionMetrics() {
  const { rows } = await safeQuery("SELECT * FROM market.broker_slippage_metrics ORDER BY observed_at DESC LIMIT 500");
  if (!rows.length) return { execution: await getDerivedExecutionMetricsFromMarketData() };
  return {
    execution: latestBy(rows.map((row) => ({
      id: row.id,
      broker: row.broker_name,
      platform: row.platform,
      server: row.server_name,
      accountType: row.account_type,
      instrument: row.instrument,
      orderType: row.order_type,
      averageSlippage: row.average_slippage == null ? null : Number(row.average_slippage),
      positiveSlippage: row.positive_slippage == null ? null : Number(row.positive_slippage),
      negativeSlippage: row.negative_slippage == null ? null : Number(row.negative_slippage),
      executionTimeMs: row.execution_time_ms,
      rejectedOrders: row.rejected_orders,
      partialFills: row.partial_fills,
      timeouts: row.timeouts,
      requotes: row.requotes,
      modificationFailures: row.modification_failures,
      rejectRate: row.reject_rate == null ? null : Number(row.reject_rate),
      fillQuality: row.fill_quality || "Insufficient Data",
      riskLevel: row.risk_level || "Insufficient Data",
      observedAt: row.observed_at
    })), (row) => `${row.broker}|${row.server}|${row.instrument}|${row.orderType || ""}`)
  };
}

export async function getBrokerSessionLiquidity() {
  const { rows } = await safeQuery("SELECT * FROM market.broker_liquidity_sessions ORDER BY observed_at DESC LIMIT 500");
  const live = latestBy(rows.map((row) => ({
    id: row.id,
    session: row.session_name,
    broker: row.broker_name,
    instrument: row.instrument,
    averageSpread: row.average_spread == null ? null : Number(row.average_spread),
    liquidityCondition: row.liquidity_condition || "Insufficient Data",
    slippageRisk: row.slippage_risk || "Insufficient Data",
    executionQuality: row.execution_quality || "Insufficient Data",
    volatilityRisk: row.volatility_risk || "Insufficient Data",
    recommendedAction: row.recommended_action || "Connect live session records",
    observedAt: row.observed_at
  })), (row) => `${row.session}|${row.broker || ""}|${row.instrument || ""}`);
  const seen = new Set(live.map((row) => row.session));
  return {
    sessions: [
      ...live,
      ...SESSIONS.filter((session) => !seen.has(session)).map((session) => ({
        id: session,
        session,
        broker: null,
        instrument: null,
        averageSpread: null,
        liquidityCondition: "Insufficient Data",
        slippageRisk: "Insufficient Data",
        executionQuality: "Insufficient Data",
        volatilityRisk: "Insufficient Data",
        recommendedAction: "Connect live broker/session records",
        observedAt: null
      }))
    ]
  };
}

export async function getBrokerNewsLiquidityRisk() {
  const { rows } = await safeQuery("SELECT * FROM market.broker_liquidity_news_risks ORDER BY COALESCE(event_time, observed_at) DESC LIMIT 200");
  return {
    newsRisk: rows.map((row) => ({
      id: row.id,
      event: row.event_name,
      currency: row.currency,
      affectedInstruments: row.affected_instruments || [],
      time: row.event_time,
      riskWindow: row.risk_window || "Insufficient Data",
      liquidityRisk: row.liquidity_risk || "Insufficient Data",
      tradingRecommendation: row.trading_recommendation || "Connect economic calendar and news sentiment inputs",
      propFirmRestriction: row.prop_firm_restriction,
      observedAt: row.observed_at
    }))
  };
}

export async function getBrokerLiquidityAlerts() {
  const { rows } = await safeQuery("SELECT * FROM market.broker_liquidity_alerts WHERE status = 'open' ORDER BY created_at DESC LIMIT 200");
  return {
    alerts: rows.map((row) => ({
      id: row.id,
      broker: row.broker_name,
      instrument: row.instrument,
      severity: row.severity,
      title: row.title,
      message: row.message,
      status: row.status,
      source: row.source,
      createdAt: row.created_at
    }))
  };
}

export async function getBrokerComparisonMatrix() {
  const [{ brokers }, executionRows] = await Promise.all([
    getBrokerLiquidityRows(),
    safeQuery("SELECT * FROM market.broker_execution_metrics ORDER BY observed_at DESC LIMIT 200").then((result) => result.rows)
  ]);
  return { comparison: buildComparison(brokers, executionRows) };
}

export async function getBrokerLiquidityDashboard() {
  const [{ brokers }, { inputs }, { spreads }, { execution }, { comparison }, { sessions }, { newsRisk }, { alerts }] = await Promise.all([
    getBrokerLiquidityRows(),
    getBrokerLiquidityInputs(),
    getBrokerSpreadMetrics(),
    getBrokerExecutionMetrics(),
    getBrokerComparisonMatrix(),
    getBrokerSessionLiquidity(),
    getBrokerNewsLiquidityRisk(),
    getBrokerLiquidityAlerts()
  ]);
  const summary = buildSummary(brokers, inputs, alerts, sessions, newsRisk);
  return {
    page: "broker-liquidity",
    title: "Broker Liquidity Intelligence Center",
    generatedAt: new Date().toISOString(),
    permissions: [
      "market_intelligence.broker_liquidity.view",
      "market_intelligence.broker_liquidity.recalculate",
      "market_intelligence.broker_liquidity.run_check",
      "market_intelligence.broker_liquidity.configure_brokers",
      "market_intelligence.broker_liquidity.export",
      "market_intelligence.broker_liquidity.create_alert"
    ],
    summary,
    inputs,
    brokers,
    spreads,
    execution,
    comparison,
    sessions,
    newsRisk,
    alerts,
    aiSummary: buildAiSummary(summary, brokers, alerts),
    emptyState: brokers.length ? null : {
      title: "Broker liquidity cannot be calculated yet.",
      message: "Connect broker data, MT5/MT4 feeds, tick data, spread history, and execution logs to enable live broker liquidity intelligence.",
      actions: ["Open Broker Data", "Configure Broker Feeds", "Open Source Registry", "Run Source Health Review"]
    }
  };
}

export async function getBrokerLiquiditySummary() {
  const dashboard = await getBrokerLiquidityDashboard();
  return { summary: dashboard.summary };
}

async function audit(action, payload = {}, actor = "api") {
  await safeQuery(
    "INSERT INTO market.broker_liquidity_audit_logs (actor, permission, action, payload) VALUES ($1, $2, $3, $4::jsonb)",
    [actor, `market_intelligence.broker_liquidity.${action}`, action, JSON.stringify(payload)]
  );
}

export async function recalculateBrokerLiquidity(actor = "api") {
  await audit("recalculate", { sourceMode: "PRODUCTION_LIVE_ONLY" }, actor);
  return { type: "broker_liquidity.recalculate.accepted", status: "accepted", sourceMode: "PRODUCTION_LIVE_ONLY" };
}

export async function runBrokerLiquidityCheck(actor = "api") {
  await audit("run_check", { sourceMode: "PRODUCTION_LIVE_ONLY" }, actor);
  return { type: "broker_liquidity.run_check.accepted", status: "accepted", dashboard: await getBrokerLiquidityDashboard() };
}

export async function createBrokerLiquidityAlert(input = {}, actor = "api") {
  const title = String(input.title || "Broker liquidity alert");
  const message = String(input.message || "Operator-created broker liquidity alert");
  const severity = ["info", "warning", "high_risk", "critical"].includes(input.severity) ? input.severity : "warning";
  const { rows } = await safeQuery(
    `INSERT INTO market.broker_liquidity_alerts (broker_name, instrument, severity, title, message, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [input.broker || null, input.instrument || null, severity, title, message, actor]
  );
  await audit("create_alert", { id: rows[0]?.id, severity, title }, actor);
  return { type: "broker_liquidity.alert.created", id: rows[0]?.id, accepted: true };
}

export async function exportBrokerLiquidityReport() {
  const dashboard = await getBrokerLiquidityDashboard();
  return {
    exportedAt: new Date().toISOString(),
    sourceMode: "PRODUCTION_LIVE_ONLY",
    mockDataDisabled: true,
    summary: dashboard.summary,
    brokers: dashboard.brokers,
    alerts: dashboard.alerts
  };
}
