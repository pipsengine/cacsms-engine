import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

export const PROP_COMPLIANCE_SCANNER_TABLES = Object.freeze([
  "market.asset_prop_compliance_scores",
  "market.asset_prop_compliance_component_scores",
  "market.asset_prop_compliance_rankings",
  "market.asset_prop_news_restrictions",
  "market.asset_prop_drawdown_risks",
  "market.asset_prop_consistency_risks",
  "market.asset_prop_instrument_restrictions",
  "market.asset_prop_blocked_assets",
  "market.asset_prop_compliance_recommendations",
  "market.prop_compliance_scanner_weights",
  "market.prop_compliance_scanner_runs",
  "market.prop_compliance_scanner_ai_summaries",
  "market.prop_compliance_scanner_alerts",
  "market.prop_compliance_scanner_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.prop_compliance.view",
  runScan: "universe_scanner.prop_compliance.run_scan",
  recalculate: "universe_scanner.prop_compliance.recalculate",
  syncRules: "universe_scanner.prop_compliance.sync_rules",
  configureRules: "universe_scanner.prop_compliance.configure_rules",
  createAlert: "universe_scanner.prop_compliance.create_alert",
  export: "universe_scanner.prop_compliance.export"
});

const round = value => value === null || value === undefined || Number.isNaN(Number(value)) ? null : Math.round(Number(value));
const avg = values => {
  const valid = values.filter(value => value !== null && value !== undefined && !Number.isNaN(Number(value))).map(Number);
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
};

async function safeQuery(sql, params = []) {
  try { return await query(sql, params); }
  catch (error) {
    if (["42P01", "42703", "42883"].includes(error.code)) return { rows: [] };
    throw error;
  }
}

async function tableReadiness() {
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [PROP_COMPLIANCE_SCANNER_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "PropComplianceScannerEngine",
    sourceMode: "LIVE_PROP_RULES_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, livePropRulesOnly: true, lastComplianceScan: null, complianceScannerHealth: "Insufficient Data" },
    summary: {
      assetsScanned: 0,
      eligibleAssets: 0,
      cautionAssets: 0,
      restrictedAssets: 0,
      blockedAssets: 0,
      connectedAccounts: 0,
      activePropRules: 0,
      newsRestrictedAssets: 0,
      drawdownRiskAssets: 0,
      consistencyRiskAssets: 0,
      instrumentRestrictedAssets: 0,
      averageComplianceScore: null,
      averageComplianceConfidence: null,
      scannerHealth: "Insufficient Data"
    },
    matrix: [],
    rankings: [],
    accounts: [],
    newsRestrictions: [],
    drawdownRisk: [],
    consistency: [],
    instrumentRestrictions: [],
    blockedAssets: [],
    recommendations: [],
    heatmap: [],
    weights: [],
    aiSummary: null,
    alerts: [],
    audit: [],
    emptyState: {
      title: "Prop firm compliance cannot be calculated yet.",
      message: "Connect a prop firm account, assign verified prop firm rules, and sync portfolio/account data before running a compliance scan.",
      actions: ["Connect Prop Firm Account", "Sync Prop Rules", "Sync Portfolio Data", "Run Compliance Scan"]
    }
  };
}

function normalize(value) {
  return String(value || "").toUpperCase().replaceAll("/", "").replaceAll("-", "").replaceAll("_", "").replace(/\s+/g, "");
}

function statusFromScore(score) {
  if (score === null || score === undefined) return "No Data";
  if (score >= 90) return "Allowed";
  if (score >= 75) return "Allowed With Caution";
  if (score >= 60) return "Restricted";
  if (score > 0) return "Blocked";
  return "Breached";
}

function riskToScore(label, fallback = null) {
  const value = String(label || "").toLowerCase();
  if (!value || /unknown|no data|insufficient/.test(value)) return fallback;
  if (/breach|critical|blocked/.test(value)) return 10;
  if (/high|danger/.test(value)) return 35;
  if (/medium|warning|elevated|caution/.test(value)) return 65;
  if (/low|healthy|active|compliant|safe/.test(value)) return 90;
  return fallback;
}

function complianceCell(score, label, confidence, freshness) {
  return { score: round(score), label: label || statusFromScore(score), confidence: round(confidence), freshness: freshness || "No record" };
}

async function activeAssets() {
  await syncAssetUniverseFromLiveSources();
  const { rows } = await safeQuery(`
    SELECT id, COALESCE(asset_code, asset, broker_symbol) AS asset, asset_class AS "assetClass",
      base_asset AS "baseAsset", quote_asset AS "quoteAsset", updated_at AS "updatedAt"
    FROM market.asset_universe
    WHERE active AND scanner_enabled
    ORDER BY asset
  `);
  return rows;
}

async function sourceContext() {
  const [assets, firms, rules, accounts, status, breaches, payouts, scaling, trading, positions, closed, equity, drawdowns, scores, events, news] = await Promise.all([
    activeAssets(),
    safeQuery(`SELECT * FROM market.prop_firms ORDER BY firm_name LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT r.*, f.firm_name FROM market.prop_firm_rules r LEFT JOIN market.prop_firms f ON f.id = r.prop_firm_id WHERE COALESCE(r.status,'Active') <> 'Archived' ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC LIMIT 500`).then(r => r.rows),
    safeQuery(`SELECT a.*, f.firm_name, r.program_name AS rule_program_name, r.account_size, r.account_type, r.daily_loss_limit_percent, r.max_drawdown_percent, r.news_trading_allowed, r.weekend_holding_allowed, r.ea_allowed, r.copy_trading_allowed, r.consistency_rule, r.drawdown_type FROM market.prop_firm_accounts a LEFT JOIN market.prop_firms f ON f.id = a.prop_firm_id LEFT JOIN market.prop_firm_rules r ON r.id = a.prop_firm_rule_id WHERE COALESCE(a.status,'Active') <> 'Archived' ORDER BY a.updated_at DESC NULLS LAST LIMIT 300`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.prop_firm_compliance_status ORDER BY measured_at DESC LIMIT 500`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.prop_firm_breach_alerts ORDER BY created_at DESC LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.prop_firm_payout_policies ORDER BY created_at DESC LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.prop_firm_scaling_plans ORDER BY created_at DESC LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.trading_accounts ORDER BY last_sync_at DESC NULLS LAST LIMIT 300`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.portfolio_positions WHERE COALESCE(status,'Open') = 'Open' ORDER BY created_at DESC LIMIT 1000`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.portfolio_closed_trades ORDER BY closed_at DESC LIMIT 1000`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.portfolio_equity_snapshots ORDER BY snapshot_at DESC LIMIT 1000`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.portfolio_drawdown_metrics ORDER BY measured_at DESC LIMIT 500`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.portfolio_intelligence_scores ORDER BY observed_at DESC LIMIT 300`).then(r => r.rows),
    safeQuery(`SELECT asset, event_name AS "eventName", currency, impact, prop_firm_rule AS "propFirmRule", trading_recommendation AS "tradingRecommendation", event_time AS "eventTime", risk_window AS "riskWindow", event_risk_score AS "eventRiskScore", confidence, last_scanned AS "lastScanned" FROM market.asset_event_scores ORDER BY last_scanned DESC LIMIT 800`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.news_sentiment_items ORDER BY published_at DESC LIMIT 300`).then(r => r.rows)
  ]);
  return { assets, firms, rules, accounts, status, breaches, payouts, scaling, trading, positions, closed, equity, drawdowns, scores, events, news };
}

function latestStatusByAccount(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = String(row.prop_firm_account_id || "");
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

function eventsByAsset(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = normalize(row.asset);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function accountLabel(account) {
  return account?.account_name || account?.accountName || account?.account_number_masked || account?.id || "Connected Account";
}

function deriveAssets(context) {
  const statusByAccount = latestStatusByAccount(context.status);
  const eventMap = eventsByAsset(context.events);
  const defaultAccount = context.accounts[0] || null;
  const defaultRule = context.rules[0] || null;
  const accountRule = account => context.rules.find(rule => String(rule.id) === String(account?.prop_firm_rule_id)) || defaultRule || account;
  return context.assets.map(asset => {
    const account = defaultAccount;
    const rule = accountRule(account);
    const compliance = statusByAccount.get(String(account?.id || "")) || {};
    const relatedEvents = eventMap.get(normalize(asset.asset)) || [];
    const restrictedEvent = relatedEvents.find(row => /blocked|restrict|avoid|caution/i.test(`${row.propFirmRule || ""} ${row.tradingRecommendation || ""}`));
    const positions = context.positions.filter(row => normalize(row.instrument) === normalize(asset.asset));
    const closed = context.closed.filter(row => normalize(row.instrument) === normalize(asset.asset));
    const dailyUsed = Number(compliance.daily_loss_used_percent ?? account?.metadata?.dailyLossUsedPercent ?? 0);
    const maxUsed = Number(compliance.max_drawdown_used_percent ?? account?.metadata?.maxDrawdownUsedPercent ?? 0);
    const dailyLimit = Number(rule?.daily_loss_limit_percent ?? account?.daily_loss_limit_percent ?? 0);
    const maxLimit = Number(rule?.max_drawdown_percent ?? account?.max_drawdown_percent ?? 0);
    const drawdownDailyScore = dailyLimit ? Math.max(0, 100 - Math.min(100, (dailyUsed / dailyLimit) * 100)) : riskToScore(compliance.breach_risk, null);
    const drawdownMaxScore = maxLimit ? Math.max(0, 100 - Math.min(100, (maxUsed / maxLimit) * 100)) : riskToScore(compliance.breach_risk, null);
    const newsAllowed = rule?.news_trading_allowed;
    const newsScore = restrictedEvent && newsAllowed === false ? 20 : restrictedEvent ? 55 : newsAllowed === false ? 75 : 95;
    const consistencyRule = rule?.consistency_rule || rule?.metadata?.consistencyRule || "";
    const largestTrade = closed.length ? Math.max(...closed.map(row => Math.abs(Number(row.profit_loss || 0)))) : 0;
    const totalProfit = closed.reduce((sum, row) => sum + Math.max(0, Number(row.profit_loss || 0)), 0);
    const largestShare = totalProfit ? Math.round((largestTrade / totalProfit) * 100) : null;
    const consistencyScore = consistencyRule && largestShare !== null && largestShare > 35 ? 55 : consistencyRule ? 85 : 90;
    const instrumentAllowed = !/restricted|blocked/i.test(String(rule?.metadata?.instrumentRestrictions?.[asset.asset] || ""));
    const instrumentScore = instrumentAllowed ? 95 : 15;
    const exposureRisk = positions.reduce((sum, row) => sum + Number(row.risk_percent || 0), 0);
    const exposureScore = exposureRisk ? Math.max(0, 100 - Math.min(100, exposureRisk * 20)) : 90;
    const score = avg([drawdownDailyScore, drawdownMaxScore, newsScore, consistencyScore, instrumentScore, exposureScore]);
    const confidence = avg([account ? 90 : null, rule ? 85 : null, compliance.id ? 90 : 55, relatedEvents.length ? 75 : 55, positions.length ? 75 : 55]);
    const primaryConstraint = [
      ["Daily Drawdown", drawdownDailyScore],
      ["Max Drawdown", drawdownMaxScore],
      ["News Restriction", newsScore],
      ["Consistency Rule", consistencyScore],
      ["Instrument Restriction", instrumentScore],
      ["Portfolio Exposure", exposureScore]
    ].filter(([, value]) => value !== null && value !== undefined).sort((a, b) => a[1] - b[1])[0]?.[0] || "Insufficient Data";
    return {
      assetId: asset.id,
      asset: asset.asset,
      assetClass: asset.assetClass || "Unclassified",
      firm: account?.firm_name || rule?.firm_name || context.firms[0]?.firm_name || "Connected Prop Firm",
      account: accountLabel(account),
      accountId: account?.id || null,
      ruleId: rule?.id || null,
      rule,
      compliance,
      dailyDrawdownScore: round(drawdownDailyScore),
      maxDrawdownScore: round(drawdownMaxScore),
      newsRestrictionScore: round(newsScore),
      consistencyScore: round(consistencyScore),
      instrumentRestrictionScore: round(instrumentScore),
      portfolioExposureScore: round(exposureScore),
      complianceScore: round(score),
      tradeEligibility: statusFromScore(score),
      primaryConstraint,
      confidence,
      dailyUsed: Number.isFinite(dailyUsed) ? dailyUsed : null,
      maxUsed: Number.isFinite(maxUsed) ? maxUsed : null,
      dailyLimit: Number.isFinite(dailyLimit) ? dailyLimit : null,
      maxLimit: Number.isFinite(maxLimit) ? maxLimit : null,
      restrictedEvent,
      consistencyRule,
      largestShare,
      positions,
      relatedEvents,
      lastScanned: [compliance.measured_at, account?.updated_at, rule?.updated_at, restrictedEvent?.lastScanned, asset.updatedAt].filter(Boolean).sort().at(-1)
    };
  });
}

function matrix(rows) {
  return rows.map(row => ({
    assetId: row.assetId,
    asset: row.asset,
    assetClass: row.assetClass,
    firm: row.firm,
    account: row.account,
    dailyDrawdown: complianceCell(row.dailyDrawdownScore, null, row.confidence, row.lastScanned),
    maxDrawdown: complianceCell(row.maxDrawdownScore, null, row.confidence, row.lastScanned),
    newsRestriction: complianceCell(row.newsRestrictionScore, null, row.confidence, row.lastScanned),
    consistency: complianceCell(row.consistencyScore, null, row.confidence, row.lastScanned),
    instrumentRestriction: complianceCell(row.instrumentRestrictionScore, null, row.confidence, row.lastScanned),
    portfolioExposure: complianceCell(row.portfolioExposureScore, null, row.confidence, row.lastScanned),
    overallCompliance: complianceCell(row.complianceScore, row.tradeEligibility, row.confidence, row.lastScanned),
    confidence: row.confidence,
    lastUpdated: row.lastScanned
  }));
}

function rankings(rows) {
  return rows.slice().sort((a, b) => Number(b.complianceScore || -1) - Number(a.complianceScore || -1)).map((row, index) => ({
    rank: index + 1,
    assetId: row.assetId,
    asset: row.asset,
    assetClass: row.assetClass,
    firm: row.firm,
    account: row.account,
    complianceScore: row.complianceScore,
    tradeEligibility: row.tradeEligibility,
    primaryConstraint: row.primaryConstraint,
    dailyDrawdownStatus: statusFromScore(row.dailyDrawdownScore),
    maxDrawdownStatus: statusFromScore(row.maxDrawdownScore),
    newsStatus: statusFromScore(row.newsRestrictionScore),
    consistencyStatus: statusFromScore(row.consistencyScore),
    instrumentStatus: statusFromScore(row.instrumentRestrictionScore),
    confidence: row.confidence,
    lastScanned: row.lastScanned
  }));
}

function accountRows(context) {
  const statusByAccount = latestStatusByAccount(context.status);
  return context.accounts.map(row => {
    const compliance = statusByAccount.get(String(row.id)) || {};
    return {
      id: row.id,
      firm: row.firm_name || "No firm name",
      account: accountLabel(row),
      program: row.program_name || row.rule_program_name,
      phase: row.phase,
      status: row.status,
      dailyLossUsed: compliance.daily_loss_used_percent,
      maxDrawdownUsed: compliance.max_drawdown_used_percent,
      profitTargetProgress: compliance.profit_target_progress_percent,
      breachRisk: compliance.breach_risk,
      measuredAt: compliance.measured_at || row.updated_at
    };
  });
}

function newsRestrictions(rows) {
  return rows.filter(row => row.restrictedEvent || row.rule?.news_trading_allowed === false).map(row => ({
    asset: row.asset,
    firm: row.firm,
    account: row.account,
    eventName: row.restrictedEvent?.eventName || "News trading disabled by rule",
    currency: row.restrictedEvent?.currency,
    impact: row.restrictedEvent?.impact || "Rule",
    restrictionWindow: row.restrictedEvent?.riskWindow || "Configured prop rule",
    ruleStatus: row.rule?.news_trading_allowed === false ? "News Trading Disabled" : "Event Restriction",
    tradeAction: row.newsRestrictionScore < 60 ? "Block trade during window" : "Trade with caution"
  }));
}

function drawdownRisk(rows) {
  return rows.map(row => ({
    asset: row.asset,
    firm: row.firm,
    account: row.account,
    dailyLossUsedPercent: row.dailyUsed,
    maxDrawdownUsedPercent: row.maxUsed,
    dailyLimitPercent: row.dailyLimit,
    maxLimitPercent: row.maxLimit,
    remainingDailyBuffer: row.dailyLimit ? `${Math.max(0, row.dailyLimit - row.dailyUsed).toFixed(2)}%` : "No record",
    remainingMaxBuffer: row.maxLimit ? `${Math.max(0, row.maxLimit - row.maxUsed).toFixed(2)}%` : "No record",
    drawdownStatus: statusFromScore(avg([row.dailyDrawdownScore, row.maxDrawdownScore])),
    recommendedAction: avg([row.dailyDrawdownScore, row.maxDrawdownScore]) < 60 ? "Block or reduce trade size" : "Within prop drawdown buffers"
  }));
}

function consistency(rows) {
  return rows.filter(row => row.consistencyRule || row.largestShare !== null).map(row => ({
    asset: row.asset,
    firm: row.firm,
    account: row.account,
    consistencyRule: row.consistencyRule || "No explicit consistency rule",
    largestTradeShare: row.largestShare,
    profitDistribution: row.largestShare === null ? "No closed trade distribution" : `${row.largestShare}% largest winning trade share`,
    status: statusFromScore(row.consistencyScore),
    recommendation: row.consistencyScore < 75 ? "Reduce concentration in single winning trades" : "Consistency acceptable"
  }));
}

function instrumentRestrictions(rows) {
  return rows.map(row => ({
    asset: row.asset,
    firm: row.firm,
    ruleType: row.rule?.account_type || row.rule?.program_name || "Prop Rule",
    allowed: row.instrumentRestrictionScore >= 60,
    restrictionReason: row.instrumentRestrictionScore >= 60 ? "No live instrument block found" : "Instrument is restricted by prop metadata",
    weekendHoldingAllowed: row.rule?.weekend_holding_allowed,
    eaAllowed: row.rule?.ea_allowed,
    copyTradingAllowed: row.rule?.copy_trading_allowed,
    status: statusFromScore(row.instrumentRestrictionScore)
  }));
}

function blockedAssets(rows) {
  return rows.filter(row => row.complianceScore < 60).map(row => ({
    asset: row.asset,
    firm: row.firm,
    account: row.account,
    blockReason: row.primaryConstraint,
    severity: row.complianceScore < 40 ? "Critical" : "High",
    expiresAt: null,
    recommendedAction: "Do not pass this asset to opportunity ranking until compliance clears"
  }));
}

function recommendations(rows) {
  return rows.map(row => ({
    asset: row.asset,
    firm: row.firm,
    account: row.account,
    complianceDriver: row.primaryConstraint,
    recommendation: row.complianceScore >= 90 ? "Eligible for normal ranking" : row.complianceScore >= 75 ? "Allow with reduced size and monitoring" : row.complianceScore >= 60 ? "Restrict until constraint improves" : "Block asset for this prop account",
    priority: row.complianceScore < 60 ? "High" : row.complianceScore < 75 ? "Medium" : "Low",
    expectedEffect: row.complianceScore < 75 ? "Protect prop account from rule breach" : "Maintain compliance posture"
  }));
}

function heatmap(rows) {
  return rows.flatMap(row => [
    ["Daily Drawdown", row.dailyDrawdownScore],
    ["Max Drawdown", row.maxDrawdownScore],
    ["News Restriction", row.newsRestrictionScore],
    ["Consistency", row.consistencyScore],
    ["Instrument Restriction", row.instrumentRestrictionScore],
    ["Portfolio Exposure", row.portfolioExposureScore],
    ["Overall", row.complianceScore]
  ].map(([complianceType, score]) => ({ asset: row.asset, complianceType, state: statusFromScore(score), score: round(score), confidence: row.confidence })));
}

function summary(rows, context) {
  return {
    assetsScanned: rows.length,
    eligibleAssets: rows.filter(row => row.complianceScore >= 90).length,
    cautionAssets: rows.filter(row => row.complianceScore >= 75 && row.complianceScore < 90).length,
    restrictedAssets: rows.filter(row => row.complianceScore >= 60 && row.complianceScore < 75).length,
    blockedAssets: rows.filter(row => row.complianceScore < 60).length,
    connectedAccounts: context.accounts.length,
    activePropRules: context.rules.length,
    newsRestrictedAssets: rows.filter(row => row.newsRestrictionScore < 75).length,
    drawdownRiskAssets: rows.filter(row => avg([row.dailyDrawdownScore, row.maxDrawdownScore]) < 75).length,
    consistencyRiskAssets: rows.filter(row => row.consistencyScore < 75).length,
    instrumentRestrictedAssets: rows.filter(row => row.instrumentRestrictionScore < 75).length,
    averageComplianceScore: avg(rows.map(row => row.complianceScore)),
    averageComplianceConfidence: avg(rows.map(row => row.confidence)),
    scannerHealth: rows.length ? "Healthy" : "Insufficient Data"
  };
}

async function weights() {
  const { rows } = await safeQuery(`SELECT component_key AS "componentKey", component_name AS "componentName", weight, enabled, updated_at AS "updatedAt" FROM market.prop_compliance_scanner_weights ORDER BY component_name`);
  return rows.map(row => ({ ...row, weight: round(row.weight) }));
}

async function latestRun() {
  const { rows } = await safeQuery(`SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "durationMs", assets_scanned AS "assetsScanned", health FROM market.prop_compliance_scanner_runs ORDER BY started_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function alerts() {
  const { rows } = await safeQuery(`SELECT alert_type AS "alertType", title, severity, asset, account, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.prop_compliance_scanner_alerts ORDER BY created_at DESC LIMIT 80`);
  return rows;
}

async function audit(assetId = null) {
  const { rows } = await safeQuery(`SELECT asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.prop_compliance_scanner_audit_logs ${assetId ? "WHERE asset_id = $1" : ""} ORDER BY created_at DESC LIMIT 80`, assetId ? [assetId] : []);
  return rows;
}

async function persistedAi() {
  const { rows } = await safeQuery(`SELECT safest_assets AS "safestAssets", restricted_assets AS "restrictedAssets", blocked_assets AS "blockedAssets", drawdown_risks AS "drawdownRisks", news_restrictions AS "newsRestrictions", consistency_risks AS "consistencyRisks", recommended_next_step AS "recommendedNextStep", summary, generated_at AS "generatedAt" FROM market.prop_compliance_scanner_ai_summaries ORDER BY generated_at DESC LIMIT 1`);
  return rows[0] || null;
}

function ai(rows, blocked) {
  const sorted = rows.slice().sort((a, b) => Number(b.complianceScore || -1) - Number(a.complianceScore || -1));
  return {
    safestAssets: sorted.filter(row => row.complianceScore >= 90).slice(0, 8).map(row => row.asset).join(", ") || "No fully eligible assets",
    restrictedAssets: rows.filter(row => row.tradeEligibility === "Restricted").slice(0, 8).map(row => row.asset).join(", ") || "No restricted assets",
    blockedAssets: blocked.map(row => row.asset).join(", ") || "No blocked assets",
    drawdownRisks: rows.filter(row => avg([row.dailyDrawdownScore, row.maxDrawdownScore]) < 75).slice(0, 8).map(row => row.asset).join(", ") || "No drawdown risk assets",
    newsRestrictions: rows.filter(row => row.newsRestrictionScore < 75).slice(0, 8).map(row => row.asset).join(", ") || "No news restrictions",
    consistencyRisks: rows.filter(row => row.consistencyScore < 75).slice(0, 8).map(row => row.asset).join(", ") || "No consistency risks",
    recommendedNextStep: "Only send eligible or caution assets to opportunity ranking; block assets with active prop constraints.",
    summary: `${rows.length} active assets evaluated against live prop account rules.`
  };
}

async function liveOutput() {
  const [context, run, weightRows, alertRows, auditRows, savedAi] = await Promise.all([sourceContext(), latestRun(), weights(), alerts(), audit(), persistedAi()]);
  const hasLivePropRules = context.rules.length > 0;
  const hasLivePropAccounts = context.accounts.length > 0;
  const hasPortfolioAccounts = context.trading.length > 0;
  if (!context.assets.length || !hasLivePropRules || !hasLivePropAccounts || !hasPortfolioAccounts) {
    return { ...emptyState("EMPTY", "Prop firm compliance cannot be calculated yet."), schemaReady: true, weights: weightRows, latestRun: run, alerts: alertRows, audit: auditRows };
  }
  const rows = deriveAssets(context);
  const blocked = blockedAssets(rows);
  const summaryRow = summary(rows, context);
  return {
    engine: "PropComplianceScannerEngine",
    sourceMode: "LIVE_PROP_RULES_ONLY",
    mockDataDisabled: true,
    status: rows.length ? "READY" : "EMPTY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, livePropRulesOnly: true, lastComplianceScan: rows.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || run?.completedAt || null, complianceScannerHealth: summaryRow.scannerHealth },
    latestRun: run,
    summary: summaryRow,
    matrix: matrix(rows),
    rankings: rankings(rows),
    accounts: accountRows(context),
    newsRestrictions: newsRestrictions(rows),
    drawdownRisk: drawdownRisk(rows),
    consistency: consistency(rows),
    instrumentRestrictions: instrumentRestrictions(rows),
    blockedAssets: blocked,
    recommendations: recommendations(rows),
    heatmap: heatmap(rows),
    weights: weightRows,
    aiSummary: savedAi || ai(rows, blocked),
    alerts: alertRows,
    audit: auditRows,
    emptyState: null
  };
}

export async function getPropComplianceScannerEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  return liveOutput();
}

export async function getPropComplianceScannerSlice(slice) {
  const data = await getPropComplianceScannerEngine();
  const map = {
    summary: { status: data.status, badges: data.badges, summary: data.summary },
    matrix: { status: data.status, matrix: data.matrix },
    rankings: { status: data.status, rankings: data.rankings },
    accounts: { status: data.status, accounts: data.accounts },
    "news-restrictions": { status: data.status, newsRestrictions: data.newsRestrictions },
    "drawdown-risk": { status: data.status, drawdownRisk: data.drawdownRisk },
    consistency: { status: data.status, consistency: data.consistency },
    "instrument-restrictions": { status: data.status, instrumentRestrictions: data.instrumentRestrictions },
    "blocked-assets": { status: data.status, blockedAssets: data.blockedAssets },
    recommendations: { status: data.status, recommendations: data.recommendations },
    heatmap: { status: data.status, heatmap: data.heatmap },
    "ai-summary": { status: data.status, aiSummary: data.aiSummary },
    export: data
  };
  return map[slice] || data;
}

export async function getPropComplianceScannerDetail(assetId) {
  const data = await getPropComplianceScannerEngine();
  const id = normalize(assetId);
  const row = data.rankings.find(item => normalize(item.assetId || item.asset) === id || normalize(item.asset) === id);
  if (!row) return null;
  return {
    asset: row,
    matrix: data.matrix.find(item => normalize(item.asset) === normalize(row.asset)),
    newsRestrictions: data.newsRestrictions.filter(item => normalize(item.asset) === normalize(row.asset)),
    drawdownRisk: data.drawdownRisk.filter(item => normalize(item.asset) === normalize(row.asset)),
    consistency: data.consistency.filter(item => normalize(item.asset) === normalize(row.asset)),
    instrumentRestrictions: data.instrumentRestrictions.filter(item => normalize(item.asset) === normalize(row.asset)),
    blockedAssets: data.blockedAssets.filter(item => normalize(item.asset) === normalize(row.asset)),
    recommendations: data.recommendations.filter(item => normalize(item.asset) === normalize(row.asset)),
    heatmap: data.heatmap.filter(item => normalize(item.asset) === normalize(row.asset)),
    aiSummary: data.aiSummary,
    alerts: data.alerts.filter(item => normalize(item.asset) === normalize(row.asset)),
    audit: data.audit.filter(item => !item.assetId || String(item.assetId) === String(row.assetId))
  };
}

async function assertReady() {
  if (!isDatabaseConfigured()) {
    const error = new Error("database_not_configured"); error.status = 503; throw error;
  }
  const ready = await tableReadiness();
  if (!ready.ready) {
    const error = new Error("schema_not_ready"); error.status = 503; error.missingTables = ready.missing; throw error;
  }
}

export async function runPropComplianceScannerAction(action, body = {}, actor = "api", assetId = null) {
  await assertReady();
  if (action === "run-scan" || action === "recalculate" || action === "sync-rules") {
    const data = await liveOutput();
    await withTransaction(async client => {
      const runKey = `PROP-COMPLIANCE-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
      await client.query(`INSERT INTO market.prop_compliance_scanner_runs (run_key, status, completed_at, assets_scanned, health, triggered_by, payload) VALUES ($1,'Completed',now(),$2,$3,$4,$5::jsonb)`, [runKey, data.summary.assetsScanned, data.summary.scannerHealth, actor, JSON.stringify({ action, sourceMode: data.sourceMode })]);
      await client.query(`INSERT INTO market.prop_compliance_scanner_audit_logs (user_name, action, entity_type, reason, payload) VALUES ($1,$2,'prop_compliance_scanner',$3,$4::jsonb)`, [actor, action, body.reason || null, JSON.stringify({ status: data.status, assetsScanned: data.summary.assetsScanned })]);
    });
    return { accepted: true, type: `prop_compliance_scanner.${action}`, status: data.status, assetsScanned: data.summary.assetsScanned };
  }
  if (action === "recalculate-asset") {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(assetId || "")) ? assetId : null;
    await safeQuery(`INSERT INTO market.prop_compliance_scanner_audit_logs (asset_id, user_name, action, entity_type, entity_id, reason, payload) VALUES ($1::uuid,$2,'recalculate_asset','asset_prop_compliance_score',$3,$4,$5::jsonb)`, [uuid, actor, assetId, body.reason || null, JSON.stringify({ assetId })]);
    return { accepted: true, type: "prop_compliance_scanner.asset.recalculated", assetId };
  }
  if (action === "create-alert") {
    await safeQuery(`INSERT INTO market.prop_compliance_scanner_alerts (alert_type, title, severity, asset, account, created_by, payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`, [body.alertType || "prop_compliance", body.title || "Prop compliance scanner alert", body.severity || "Info", body.asset || null, body.account || null, actor, JSON.stringify(body)]);
    return { accepted: true, type: "prop_compliance_scanner.alert.created" };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    const data = await liveOutput(); const a = data.aiSummary || {};
    await safeQuery(`INSERT INTO market.prop_compliance_scanner_ai_summaries (summary, safest_assets, restricted_assets, blocked_assets, drawdown_risks, news_restrictions, consistency_risks, recommended_next_step, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [a.summary, a.safestAssets, a.restrictedAssets, a.blockedAssets, a.drawdownRisks, a.newsRestrictions, a.consistencyRisks, a.recommendedNextStep, JSON.stringify({ actor, action })]);
    return { accepted: true, type: "prop_compliance_scanner.ai_summary.saved" };
  }
  return { accepted: true, type: `prop_compliance_scanner.${action}.recorded` };
}

export async function exportPropComplianceScannerReport() {
  return getPropComplianceScannerEngine();
}
