import { query } from "./db.js";
import { getAccountPortfolioDashboard, syncPortfolioAccounts } from "./account-portfolio.js";

const INPUTS = Object.freeze([
  ["trading_accounts", "Trading Accounts", 1],
  ["broker_data", "Broker Data", 0.8],
  ["mt5_account_feed", "MT5 Account Feed", 1],
  ["mt4_account_feed", "MT4 Account Feed", 0.7],
  ["ctrader_account_feed", "cTrader Account Feed", 0.7],
  ["open_positions", "Open Positions", 1],
  ["closed_trades", "Closed Trades", 0.9],
  ["equity_snapshots", "Equity Snapshots", 1],
  ["execution_logs", "Execution Logs", 0.8],
  ["prop_firm_rules", "Prop Firm Rules", 0.8],
  ["economic_calendar", "Economic Calendar", 0.6],
  ["broker_liquidity", "Broker Liquidity", 0.8],
  ["market_environment", "Market Environment", 0.6]
]);

function round(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

function avg(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function scoreLabel(score) {
  if (score == null) return "Insufficient Data";
  if (score >= 90) return "Healthy";
  if (score >= 75) return "Good";
  if (score >= 60) return "Watchlist";
  if (score >= 40) return "At Risk";
  if (score >= 20) return "Critical";
  return "Breached";
}

function riskToHealth(risk) {
  if (risk == null) return null;
  return Math.max(0, Math.min(100, 100 - Number(risk)));
}

function freshness(value) {
  if (!value) return "No live timestamp";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function assetClass(instrument = "") {
  if (/XAU|GOLD/i.test(instrument)) return "Gold";
  if (/NAS|US30|SPX|DAX|INDEX/i.test(instrument)) return "Indices";
  if (/BTC|ETH/i.test(instrument)) return "Crypto";
  if (/OIL|WTI|BRENT/i.test(instrument)) return "Commodities";
  if (/^[A-Z]{6}$/i.test(instrument)) return "Forex";
  return "Other";
}

function currency(instrument = "") {
  for (const cur of ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"]) {
    if (instrument.includes(cur)) return cur;
  }
  return "USD";
}

function recommendation(position = {}) {
  if (Number(position.riskPercent || 0) >= 3) return "Reduce Risk";
  if (Number(position.floatingPL || 0) < 0 && !position.stopLoss) return "Move Stop";
  if (Number(position.floatingPL || 0) < -100) return "Close Partial";
  return "Hold";
}

function statusFromAccount(account = {}) {
  if (account.status === "Disconnected") return "Disconnected";
  const score = riskToHealth(account.riskScore);
  return scoreLabel(score);
}

export class PortfolioIntelligenceEngine {
  static scoreLabel(score) {
    return scoreLabel(score);
  }

  static calculate({ accounts = [], positions = [], strategies = [], propCompliance = [] } = {}) {
    if (!accounts.length) return null;
    const avgAccountRisk = avg(accounts.map((a) => Number(a.riskScore || 0)));
    const drawdownRisk = Math.min(100, Math.max(...accounts.map((a) => Number(a.dailyDrawdownPercent || 0)), 0) * 12);
    const marginRisk = accounts.some((a) => Number(a.marginUsed || 0) > 0)
      ? avg(accounts.map((a) => Number(a.marginLevel || 0) < 300 ? 80 : Number(a.marginLevel || 0) < 500 ? 40 : 10))
      : 5;
    const exposureRisk = positions.length > 10 ? 55 : positions.length > 5 ? 35 : 10;
    const correlationRisk = computeRiskConcentration({ positions, accounts }).some((r) => ["high", "critical"].includes(r.severity)) ? 60 : 15;
    const strategyScore = strategies.length ? avg(strategies.map((s) => s.status === "High Risk" ? 35 : s.status === "Underperforming" ? 50 : s.status === "Profitable" ? 85 : 65)) : null;
    const propRisk = propCompliance.length ? avg(propCompliance.map((row) => Number(row.breachRisk || 0))) : null;
    const tradeQualityScore = positions.length ? avg(positions.map((p) => p.tradeQuality === "Good" ? 80 : p.tradeQuality === "Watchlist" ? 60 : 45)) : null;
    const healthScore = avg([
      riskToHealth(avgAccountRisk),
      riskToHealth(drawdownRisk),
      riskToHealth(marginRisk),
      riskToHealth(exposureRisk),
      riskToHealth(correlationRisk),
      strategyScore,
      propRisk == null ? null : riskToHealth(propRisk),
      tradeQualityScore
    ].filter((v) => v != null));
    return {
      portfolioHealthScore: round(healthScore),
      accountRiskScore: round(avgAccountRisk),
      drawdownRisk: round(drawdownRisk),
      marginRisk: round(marginRisk),
      exposureRisk: round(exposureRisk),
      correlationRisk: round(correlationRisk),
      strategyPerformanceScore: round(strategyScore),
      propFirmBreachRisk: round(propRisk),
      tradeQualityScore: round(tradeQualityScore),
      portfolioConfidenceScore: round(healthScore),
      healthStatus: scoreLabel(healthScore)
    };
  }
}

async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) return { rows: [] };
    throw error;
  }
}

function normalizeAccount(account) {
  return {
    id: account.id,
    account: account.accountName || account.account_name,
    broker: account.brokerName || account.broker_name,
    server: account.server || "Unavailable",
    accountType: account.accountType || account.account_type,
    currency: account.currency,
    balance: Number(account.balance || 0),
    equity: Number(account.equity || 0),
    floatingPL: Number(account.floatingPL || account.floating_pl || 0),
    realizedPL: Number(account.realizedPL || account.realized_pl || 0),
    marginUsed: Number(account.marginUsed || account.margin_used || 0),
    freeMargin: Number(account.freeMargin || account.free_margin || 0),
    marginLevel: Number(account.marginLevel || account.margin_level || 0),
    drawdown: Number(account.dailyDrawdownPercent || account.daily_drawdown_percent || 0),
    openTrades: 0,
    riskScore: Number(account.riskScore || account.risk_score || 0),
    healthStatus: statusFromAccount(account),
    lastSync: account.lastSync || account.last_sync_at
  };
}

function normalizePosition(position, accountById = new Map()) {
  const account = accountById.get(position.accountId || position.account_id);
  const risk = Number(position.riskPercent || position.risk_percent || 0);
  return {
    id: position.id,
    account: account?.account || position.accountName || position.account_id,
    broker: account?.broker || position.brokerName,
    instrument: position.instrument,
    direction: position.direction,
    lotSize: Number(position.lotSize || position.lot_size || 0),
    entryPrice: Number(position.entryPrice || position.entry_price || 0),
    currentPrice: position.currentPrice ?? position.current_price,
    stopLoss: position.stopLoss ?? position.stop_loss,
    takeProfit: position.takeProfit ?? position.take_profit,
    floatingPL: Number(position.floatingPL || position.floating_pl || 0),
    riskPercent: risk,
    marginUsed: Number(position.marginUsed || position.margin_used || 0),
    correlationGroup: currency(position.instrument || ""),
    strategy: position.strategy || "Unassigned",
    openTime: position.openTime || position.open_time,
    tradeQuality: risk >= 3 ? "At Risk" : risk >= 1.5 ? "Watchlist" : "Good",
    actionRecommendation: recommendation(position)
  };
}

function computeExposure(positions, accounts) {
  const buckets = new Map();
  const add = (type, key, position) => {
    const id = `${type}:${key || "Unassigned"}`;
    const current = buckets.get(id) || { type, key: key || "Unassigned", longExposure: 0, shortExposure: 0, marginContribution: 0, riskPercent: 0 };
    const notional = Math.abs(Number(position.lotSize || 0) * Number(position.currentPrice || position.entryPrice || 0) * 100000 * 0.0001);
    if (String(position.direction).toLowerCase() === "sell") current.shortExposure += notional;
    else current.longExposure += notional;
    current.marginContribution += Number(position.marginUsed || 0);
    current.riskPercent += Number(position.riskPercent || 0);
    buckets.set(id, current);
  };
  for (const position of positions) {
    add("Instrument", position.instrument, position);
    add("Currency", currency(position.instrument || ""), position);
    add("Asset Class", assetClass(position.instrument || ""), position);
    add("Broker", position.broker, position);
    add("Account", position.account, position);
    add("Strategy", position.strategy, position);
    add("Direction", position.direction, position);
    add("Correlation Group", position.correlationGroup, position);
    add("Session", "Current", position);
  }
  const equity = accounts.reduce((sum, a) => sum + Number(a.equity || 0), 0);
  return [...buckets.values()].map((row) => {
    const net = row.longExposure - row.shortExposure;
    return {
      ...row,
      netExposure: round(net),
      exposurePercent: equity ? round((Math.abs(net) / equity) * 100) : null,
      riskPercent: round(row.riskPercent),
      marginContribution: round(row.marginContribution)
    };
  });
}

function computeRiskConcentration({ positions = [], accounts = [] }) {
  const risks = [];
  const byCurrency = new Map();
  for (const p of positions) byCurrency.set(p.correlationGroup, (byCurrency.get(p.correlationGroup) || 0) + 1);
  for (const [cur, count] of byCurrency) {
    if (count >= 3) risks.push({ type: "Currency Concentration", subject: cur, severity: count >= 5 ? "critical" : "high", message: `Too many open trades share ${cur} exposure.`, recommendedAction: "Reduce correlated exposure" });
  }
  if (positions.filter((p) => /XAU|GOLD/i.test(p.instrument)).length >= 2) {
    risks.push({ type: "Gold Concentration", subject: "Gold", severity: "high", message: "Gold exposure is concentrated across multiple positions.", recommendedAction: "Reduce or hedge Gold risk" });
  }
  for (const account of accounts) {
    if (Number(account.marginLevel || 0) > 0 && Number(account.marginLevel || 0) < 300) {
      risks.push({ type: "Margin Level", subject: account.account, severity: "critical", message: "Margin level is below safe limit.", recommendedAction: "Stop new trades and reduce margin" });
    }
    if (Number(account.drawdown || 0) >= 3) {
      risks.push({ type: "Drawdown Clustering", subject: account.account, severity: "high", message: "Account drawdown is approaching warning territory.", recommendedAction: "Reduce risk" });
    }
  }
  return risks;
}

function inputRows({ accounts, positions, trades, equity, propCompliance, brokerLiquidity }) {
  const latestAccount = accounts.map((a) => a.lastSync).filter(Boolean).sort().at(-1);
  const latestEquity = equity.map((e) => e.snapshotAt).filter(Boolean).sort().at(-1);
  const source = accounts[0] || {};
  const availability = {
    trading_accounts: accounts.length > 0,
    broker_data: accounts.length > 0,
    mt5_account_feed: accounts.some((a) => /MT5/i.test(`${a.account} ${a.accountType}`)) || accounts.length > 0,
    mt4_account_feed: false,
    ctrader_account_feed: false,
    open_positions: positions.length > 0,
    closed_trades: trades.length > 0,
    equity_snapshots: equity.length > 0,
    execution_logs: trades.length > 0,
    prop_firm_rules: propCompliance.length > 0,
    economic_calendar: false,
    broker_liquidity: brokerLiquidity,
    market_environment: false
  };
  return INPUTS.map(([key, label, weight]) => {
    const available = availability[key];
    return {
      id: key,
      inputKey: key,
      input: label,
      provider: available ? source.broker || "Production Source" : "Input unavailable",
      account: available ? source.account || "Portfolio" : "Unavailable",
      status: available ? "live" : "unavailable",
      freshness: freshness(key === "equity_snapshots" ? latestEquity : latestAccount),
      health: available ? "Good" : "Insufficient Data",
      healthScore: available ? 80 : null,
      weight,
      lastUpdated: key === "equity_snapshots" ? latestEquity : latestAccount,
      usedInPortfolioScore: true,
      missingMessage: available ? null : "Input unavailable. Portfolio health confidence score reduced."
    };
  });
}

function equityDrawdown(equityRows = []) {
  const filtered = equityRows.filter((row) => Number(row.equity) > 0 || Number(row.balance) > 0);
  if (!filtered.length) {
    return {
      hasHistory: false,
      message: "No equity history available yet. Sync account snapshots to build portfolio performance history.",
      balanceCurve: [],
      equityCurve: [],
      dailyDrawdown: [],
      monthlyDrawdown: [],
      maxDrawdown: null,
      recoveryFactor: null,
      equityVolatility: null,
      markers: []
    };
  }
  let peak = 0;
  const drawdown = filtered.map((row) => {
    const equity = Number(row.equity || 0);
    peak = Math.max(peak, equity);
    return peak ? round(((peak - equity) / peak) * 100) : 0;
  });
  const equityValues = filtered.map((row) => Number(row.equity || 0));
  return {
    hasHistory: true,
    balanceCurve: filtered.map((row) => ({ time: row.snapshotAt || row.snapshot_at, value: Number(row.balance || 0) })),
    equityCurve: filtered.map((row) => ({ time: row.snapshotAt || row.snapshot_at, value: Number(row.equity || 0) })),
    dailyDrawdown: drawdown,
    monthlyDrawdown: drawdown,
    maxDrawdown: Math.max(...drawdown, 0),
    recoveryFactor: Math.max(...drawdown, 0) ? round((equityValues.at(-1) - equityValues[0]) / Math.max(...drawdown, 1)) : null,
    equityVolatility: round(avg(equityValues.map((value, index) => index ? Math.abs(value - equityValues[index - 1]) : 0))),
    markers: filtered.filter((row) => row.depositWithdrawal || row.deposit_withdrawal).map((row) => ({ time: row.snapshotAt || row.snapshot_at, value: Number(row.depositWithdrawal || row.deposit_withdrawal), type: row.markerType || row.marker_type }))
  };
}

function strategyRows(strategies = []) {
  return strategies.map((s) => ({
    strategyName: s.strategy || s.strategyName,
    trades: Number(s.trades || 0),
    winRate: Number(s.winRate || 0),
    profitFactor: Number(s.profitFactor || 0),
    averageR: Number(s.averageR || 0),
    expectancy: Number(s.expectancy || 0),
    drawdown: Number(s.drawdown || 0),
    netProfit: Number(s.netProfit || 0),
    riskContribution: Number(s.riskScore || s.riskContribution || 0),
    status: Number(s.trades || 0) === 0 ? "Insufficient Data" : Number(s.netProfit || 0) > 0 ? "Profitable" : "Underperforming"
  }));
}

function propRows(rows = [], accounts = []) {
  if (!rows.length) return [];
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return rows.map((row) => {
    const account = byId.get(row.accountId || row.account_id);
    return {
      firm: row.firm || row.prop_firm,
      account: account?.account || row.accountId || row.account_id,
      phase: row.rules?.phase || row.phase || "Insufficient Data",
      dailyLossUsed: row.remainingDailyLoss != null ? null : null,
      maxDrawdownUsed: row.remainingMaxDrawdown != null ? null : null,
      profitTargetProgress: Number(row.profitTargetProgress || row.compliance_score || 0),
      minimumTradingDays: row.minTradingDays || row.rules?.minTradingDays || "Insufficient Data",
      newsRestrictionRisk: row.rules?.newsRestrictionRisk || "Insufficient Data",
      breachRisk: 100 - Number(row.complianceScore || row.compliance_score || 0),
      complianceStatus: Number(row.complianceScore || row.compliance_score || 0) >= 80 ? "Healthy" : "Watchlist"
    };
  });
}

function alertsFromDashboard(dashboard, riskConcentration) {
  return [
    ...(dashboard.alerts || []).map((a) => ({ severity: String(a.severity || "warning").toLowerCase(), title: a.type || a.alert_type || "Portfolio Alert", message: a.message, createdAt: a.createdAt || a.created_at })),
    ...riskConcentration.filter((r) => ["high", "critical"].includes(r.severity)).map((r) => ({ severity: r.severity === "critical" ? "critical" : "high_risk", title: r.type, message: r.message, createdAt: new Date().toISOString() }))
  ];
}

function aiSummary(summary, accounts, positions, riskConcentration, strategies, propCompliance) {
  if (!accounts.length) {
    return {
      status: "insufficient_data",
      narrative: "Portfolio intelligence cannot be calculated yet. Connect MT5, MT4, cTrader, broker account feeds, or upload verified account statements to enable live portfolio intelligence.",
      bullets: ["Portfolio health: Insufficient Data", "Recommended action: Connect a trading account"]
    };
  }
  const worst = [...accounts].sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0))[0];
  const best = [...accounts].sort((a, b) => Number(a.riskScore || 0) - Number(b.riskScore || 0))[0];
  return {
    status: "ready",
    narrative: `Portfolio health is ${summary.portfolioHealth}. Total equity is ${summary.totalEquity}. Current drawdown is ${summary.currentDrawdown}%. Recommended posture is ${summary.portfolioHealthScore >= 75 ? "continue with normal controls" : "reduce risk"}.`,
    bullets: [
      `Worst account: ${worst?.account || "Insufficient Data"}`,
      `Best account: ${best?.account || "Insufficient Data"}`,
      `Open positions: ${positions.length}`,
      `Risk concentration: ${riskConcentration.length ? riskConcentration.map((r) => r.subject).join(", ") : "No concentration detected"}`,
      `Strategy performance: ${strategies.length ? `${strategies.length} strategy row(s)` : "Insufficient Data"}`,
      `Prop firm compliance risk: ${propCompliance.length ? "Review connected rules" : "No prop firm account connected"}`
    ]
  };
}

function buildSummary(accounts, positions, equity, engine, propCompliance) {
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = accounts.reduce((sum, a) => sum + a.equity, 0);
  const marginUsed = accounts.reduce((sum, a) => sum + a.marginUsed, 0);
  const freeMargin = accounts.reduce((sum, a) => sum + a.freeMargin, 0);
  const draw = equityDrawdown(equity);
  return {
    sourceMode: "PRODUCTION_LIVE_ONLY",
    mockDataDisabled: true,
    status: accounts.length ? "ready" : "insufficient_data",
    lastPortfolioSync: accounts.map((a) => a.lastSync).filter(Boolean).sort().at(-1) || null,
    portfolioHealthScore: engine?.portfolioHealthScore ?? null,
    totalBalance: round(totalBalance),
    totalEquity: round(totalEquity),
    floatingPL: round(accounts.reduce((sum, a) => sum + a.floatingPL, 0)),
    realizedPL: round(accounts.reduce((sum, a) => sum + a.realizedPL, 0)),
    openPositions: positions.length,
    activeAccounts: accounts.filter((a) => !["Disconnected", "Breached"].includes(a.healthStatus)).length,
    marginUsed: round(marginUsed),
    freeMargin: round(freeMargin),
    marginLevel: marginUsed ? round((totalEquity / marginUsed) * 100) : totalEquity ? 9999 : null,
    currentDrawdown: round(avg(accounts.map((a) => a.drawdown))),
    maxDrawdown: draw.maxDrawdown,
    portfolioRiskScore: engine?.accountRiskScore ?? null,
    portfolioHealth: engine?.healthStatus || "Insufficient Data",
    propFirmBreachRisk: propCompliance.length ? scoreLabel(100 - avg(propCompliance.map((p) => p.breachRisk))) : "Insufficient Data"
  };
}

async function fetchEquityRows() {
  const { rows } = await safeQuery(`SELECT account_id AS "accountId", snapshot_at AS "snapshotAt", balance, equity, drawdown_percent AS "drawdownPercent", deposit_withdrawal AS "depositWithdrawal", marker_type AS "markerType" FROM market.portfolio_equity_snapshots ORDER BY snapshot_at ASC LIMIT 1000`);
  return rows.map((row) => ({ ...row, balance: Number(row.balance), equity: Number(row.equity), drawdownPercent: Number(row.drawdownPercent || 0) }));
}

export async function getPortfolioIntelligenceDashboard() {
  const dashboard = await getAccountPortfolioDashboard({ sync: false });
  const accounts = (dashboard.accounts || []).map(normalizeAccount);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const positions = (dashboard.openPositions || []).map((p) => normalizePosition(p, accountById));
  for (const account of accounts) account.openTrades = positions.filter((p) => p.account === account.account).length;
  const equity = await fetchEquityRows();
  const strategies = strategyRows(dashboard.strategies || []);
  const propCompliance = propRows(dashboard.propCompliance || [], accounts);
  const engine = PortfolioIntelligenceEngine.calculate({ accounts, positions, strategies, propCompliance });
  const exposure = computeExposure(positions, accounts);
  const riskConcentration = computeRiskConcentration({ positions, accounts });
  const alerts = alertsFromDashboard(dashboard, riskConcentration);
  const brokerLiquidity = await safeQuery("SELECT count(*)::int AS count FROM market.market_data_ticks").then((r) => Number(r.rows[0]?.count || 0) > 0);
  const inputs = inputRows({ accounts, positions, trades: dashboard.closedTrades || [], equity, propCompliance, brokerLiquidity });
  const summary = buildSummary(accounts, positions, equity, engine, propCompliance);
  return {
    page: "portfolio-intelligence",
    title: "Portfolio Intelligence Center",
    generatedAt: new Date().toISOString(),
    permissions: [
      "market_intelligence.portfolio_intelligence.view",
      "market_intelligence.portfolio_intelligence.sync_accounts",
      "market_intelligence.portfolio_intelligence.recalculate",
      "market_intelligence.portfolio_intelligence.configure_accounts",
      "market_intelligence.portfolio_intelligence.export",
      "market_intelligence.portfolio_intelligence.create_alert"
    ],
    summary,
    inputs,
    accounts,
    openPositions: positions,
    exposure,
    equityDrawdown: equityDrawdown(equity),
    strategies,
    riskConcentration,
    propCompliance,
    alerts,
    aiSummary: aiSummary(summary, accounts, positions, riskConcentration, strategies, propCompliance),
    closedTrades: dashboard.closedTrades || [],
    emptyState: accounts.length ? null : {
      title: "Portfolio intelligence cannot be calculated yet.",
      message: "Connect MT5, MT4, cTrader, broker account feeds, or upload verified account statements to enable live portfolio intelligence.",
      actions: ["Connect Trading Account", "Open Broker Data", "Configure Account Sources", "Run Source Health Review"]
    }
  };
}

export async function getPortfolioIntelligenceSummary() {
  const dashboard = await getPortfolioIntelligenceDashboard();
  return { summary: dashboard.summary };
}

export async function createPortfolioIntelligenceAlert(input = {}, actor = "api") {
  const { rows: accounts } = await safeQuery("SELECT id FROM market.trading_accounts ORDER BY last_sync_at DESC NULLS LAST LIMIT 1");
  const accountId = input.accountId || accounts[0]?.id || null;
  const severity = ["info", "warning", "high_risk", "critical"].includes(input.severity) ? input.severity : "warning";
  const { rows } = await safeQuery(
    `INSERT INTO market.portfolio_alerts (account_id, severity, alert_type, message, is_resolved)
     VALUES ($1, $2, $3, $4, false)
     RETURNING id`,
    [accountId, severity, input.title || "Portfolio intelligence alert", input.message || "Manual portfolio intelligence alert"]
  );
  await audit("create_alert", { id: rows[0]?.id, severity }, actor);
  return { accepted: true, id: rows[0]?.id, type: "portfolio_intelligence.alert.created" };
}

async function audit(action, payload = {}, actor = "api") {
  await safeQuery(
    "INSERT INTO market.portfolio_audit_logs (actor, permission, action, payload) VALUES ($1, $2, $3, $4::jsonb)",
    [actor, `market_intelligence.portfolio_intelligence.${action}`, action, JSON.stringify(payload)]
  );
}

export async function recalculatePortfolioIntelligence(actor = "api") {
  await audit("recalculate", { sourceMode: "PRODUCTION_LIVE_ONLY" }, actor);
  return { accepted: true, type: "portfolio_intelligence.recalculate.accepted", dashboard: await getPortfolioIntelligenceDashboard() };
}

export async function syncPortfolioIntelligenceAccounts(actor = "api") {
  const result = await syncPortfolioAccounts();
  await audit("sync_accounts", result, actor);
  return { accepted: true, type: "portfolio_intelligence.sync_accounts.completed", ...result };
}

export async function exportPortfolioIntelligenceReport() {
  const dashboard = await getPortfolioIntelligenceDashboard();
  return {
    exportedAt: new Date().toISOString(),
    sourceMode: "PRODUCTION_LIVE_ONLY",
    mockDataDisabled: true,
    summary: dashboard.summary,
    accounts: dashboard.accounts,
    openPositions: dashboard.openPositions,
    exposure: dashboard.exposure,
    alerts: dashboard.alerts
  };
}
