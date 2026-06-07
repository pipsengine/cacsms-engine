import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { getEconomicEventsScannerEngine } from "./economic-events-scanner-engine.js";
import { getLiquidityScannerEngine } from "./liquidity-scanner-engine.js";
import { getMacroScannerEngine } from "./macro-scanner-engine.js";
import { getSentimentScannerEngine } from "./sentiment-scanner-engine.js";
import { getVolatilityScannerEngine } from "./volatility-scanner-engine.js";
import { syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

export const RISK_SCANNER_TABLES = Object.freeze([
  "market.asset_risk_scores",
  "market.asset_risk_component_scores",
  "market.asset_risk_rankings",
  "market.asset_critical_risk_blocks",
  "market.asset_news_event_risks",
  "market.asset_broker_execution_risks",
  "market.asset_correlation_portfolio_risks",
  "market.asset_prop_firm_risks",
  "market.asset_risk_recommendations",
  "market.risk_scanner_weights",
  "market.risk_scanner_runs",
  "market.risk_scanner_ai_summaries",
  "market.risk_scanner_alerts",
  "market.risk_scanner_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.risk.view",
  runScan: "universe_scanner.risk.run_scan",
  recalculate: "universe_scanner.risk.recalculate",
  configureRules: "universe_scanner.risk.configure_rules",
  createAlert: "universe_scanner.risk.create_alert",
  export: "universe_scanner.risk.export"
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
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [RISK_SCANNER_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "RiskScannerEngine",
    sourceMode: "LIVE_RISK_INPUTS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveRiskInputsOnly: true, lastRiskScan: null, riskScannerHealth: "Insufficient Data" },
    summary: {
      assetsScanned: 0, lowRiskAssets: 0, mediumRiskAssets: 0, highRiskAssets: 0, criticalRiskAssets: 0,
      blockedAssets: 0, newsRiskAssets: 0, spreadRiskAssets: 0, slippageRiskAssets: 0, liquidityRiskAssets: 0,
      portfolioRiskAssets: 0, propFirmRiskAssets: 0, averageRiskScore: null, averageRiskConfidence: null,
      scannerHealth: "Insufficient Data"
    },
    matrix: [], rankings: [], critical: [], newsEvents: [], brokerExecution: [], correlationPortfolio: [],
    propFirm: [], recommendations: [], heatmap: [], weights: [], aiSummary: null, alerts: [], audit: [],
    emptyState: {
      title: "Risk scanner cannot calculate asset risk yet.",
      message: "Connect live market data, broker liquidity, economic events, portfolio intelligence, prop firm rules, and source health data before running a risk scan.",
      actions: ["Open Asset Universe Registry", "Open Broker Liquidity", "Open Economic Events", "Run Risk Scan"]
    }
  };
}

function normalize(value) {
  return String(value || "").toUpperCase().replaceAll("/", "").replaceAll("-", "").replaceAll("_", "").replace(/\s+/g, "");
}

function riskLabel(score) {
  if (score === null || score === undefined) return "No Data";
  if (score >= 81) return "Critical";
  if (score >= 61) return "High";
  if (score >= 41) return "Elevated";
  if (score >= 21) return "Medium";
  return "Low";
}

function riskScore(labelOrScore) {
  if (typeof labelOrScore === "number") return round(labelOrScore);
  const value = String(labelOrScore || "").toLowerCase();
  if (!value || /no data|insufficient|unknown/.test(value)) return null;
  if (/critical|blocked|extreme|avoid/.test(value)) return 90;
  if (/high|too volatile|poor/.test(value)) return 70;
  if (/elevated|medium|caution|watch/.test(value)) return 50;
  if (/normal|safe|low|qualified|allowed|healthy/.test(value)) return 15;
  return null;
}

function confidence(...values) {
  return avg(values.flat().filter(value => value !== null && value !== undefined));
}

function cell(score, label, confidenceValue, freshness) {
  return { score: round(score), label: label || riskLabel(score), confidence: round(confidenceValue), freshness: freshness || "No record" };
}

async function activeAssets() {
  await syncAssetUniverseFromLiveSources();
  const { rows } = await safeQuery(`SELECT id, COALESCE(asset_code, asset, broker_symbol) AS asset, asset_class AS "assetClass", base_asset AS "baseAsset", quote_asset AS "quoteAsset", updated_at AS "updatedAt" FROM market.asset_universe WHERE active AND scanner_enabled ORDER BY asset`);
  return rows;
}

function byAsset(rows, key = "asset") {
  const map = new Map();
  for (const row of rows || []) map.set(normalize(row[key]), row);
  return map;
}

function mainDriver(components) {
  const entries = Object.entries(components).filter(([, value]) => value.score !== null && value.score !== undefined);
  if (!entries.length) return "Insufficient Data";
  return entries.sort((a, b) => Number(b[1].score) - Number(a[1].score))[0][1].name;
}

async function sourceHealthRisk() {
  const { rows } = await safeQuery(`SELECT source_key AS "sourceKey", health, health_score AS "healthScore", freshness_status AS "freshnessStatus", observed_at AS "observedAt" FROM market.source_health_metrics ORDER BY observed_at DESC LIMIT 100`);
  if (!rows.length) return null;
  const score = avg(rows.map(row => row.healthScore == null ? null : 100 - Number(row.healthScore)));
  return score;
}

async function portfolioRows() {
  const [scores, concentration, propRules, propStatus, broker] = await Promise.all([
    safeQuery(`SELECT * FROM market.portfolio_intelligence_scores ORDER BY observed_at DESC LIMIT 20`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.portfolio_risk_concentration ORDER BY observed_at DESC LIMIT 80`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.prop_firm_rules ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 80`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.prop_firm_compliance_status ORDER BY measured_at DESC LIMIT 80`).then(r => r.rows),
    safeQuery(`SELECT broker_name AS "broker", server_name AS "server", instrument AS asset, spread AS "currentSpread", average_spread AS "averageSpread", spread_change_percent AS "spreadDeviation", slippage_risk AS "slippageRisk", execution_speed_ms AS "executionSpeed", order_rejection_percent AS "rejectRate", news_liquidity_risk AS "newsLiquidityRisk", tradeability, observed_at AS "observedAt" FROM market.broker_liquidity_scores ORDER BY observed_at DESC LIMIT 200`).then(r => r.rows)
  ]);
  return { scores, concentration, propRules, propStatus, broker };
}

function deriveRows(assets, inputs, auxiliary) {
  const vol = byAsset(inputs.volatility.rankings || []);
  const liq = byAsset(inputs.liquidity.rankings || []);
  const ev = byAsset(inputs.events.rankings || []);
  const macro = byAsset(inputs.macro.rankings || []);
  const sent = byAsset(inputs.sentiment.rankings || []);
  const broker = byAsset(auxiliary.broker || []);
  return assets.map(asset => {
    const key = normalize(asset.asset);
    const v = vol.get(key);
    const l = liq.get(key);
    const e = ev.get(key);
    const m = macro.get(key);
    const s = sent.get(key);
    const b = broker.get(key);
    const volatilityScore = riskScore(v?.abnormalRisk) ?? riskScore(v?.overallVolatility) ?? (v?.volatilityScore == null ? null : Math.min(100, Math.abs(Number(v.volatilityScore))));
    const liquidityScore = riskScore(l?.executionRisk) ?? riskScore(l?.sweepRisk) ?? (l?.liquidityScore == null ? null : Math.max(0, 100 - Number(l.liquidityScore)));
    const spreadScore = riskScore(l?.spreadRisk) ?? riskScore(b?.tradeability) ?? round(b?.spreadDeviation);
    const slippageScore = riskScore(b?.slippageRisk);
    const newsScore = e?.eventRiskScore ?? null;
    const macroScore = m?.macroScore == null ? null : Math.min(100, Math.abs(Number(m.macroScore)));
    const sentimentConflict = s?.divergenceScore == null ? null : Number(s.divergenceScore);
    const correlationScore = auxiliary.concentration.length ? 50 : null;
    const portfolioScore = auxiliary.scores[0]?.account_risk_score ?? auxiliary.scores[0]?.portfolio_risk_score ?? null;
    const brokerScore = riskScore(b?.tradeability) ?? round(b?.rejectRate);
    const propScore = e?.recommendation === "Blocked" || /blocked|restriction/i.test(e?.propRestriction || "") ? 90 : auxiliary.propRules.length ? 30 : null;
    const scores = [volatilityScore, liquidityScore, spreadScore, slippageScore, newsScore, macroScore, sentimentConflict, correlationScore, portfolioScore, brokerScore, propScore, auxiliary.sourceRisk];
    const overall = avg(scores);
    const conf = confidence(v?.confidence, l?.confidence, e?.confidence, m?.confidence, s?.confidence, b ? 70 : null, auxiliary.sourceRisk == null ? null : 70);
    const components = {
      volatility: { name: "Volatility Risk", score: volatilityScore },
      liquidity: { name: "Liquidity Risk", score: liquidityScore },
      spread: { name: "Spread Risk", score: spreadScore },
      slippage: { name: "Slippage Risk", score: slippageScore },
      news: { name: "News / Event Risk", score: newsScore },
      macro: { name: "Macro Risk", score: macroScore },
      correlation: { name: "Correlation Risk", score: correlationScore },
      portfolio: { name: "Portfolio Risk", score: portfolioScore },
      broker: { name: "Broker Execution Risk", score: brokerScore },
      prop: { name: "Prop Firm Risk", score: propScore }
    };
    const driver = mainDriver(components);
    const qualification = overall == null ? "Insufficient Data" : overall >= 81 ? "Blocked" : overall >= 61 ? "Rejected" : overall >= 41 ? "Trade With Caution" : "Risk Qualified";
    return {
      assetId: asset.id, asset: asset.asset, assetClass: asset.assetClass || v?.assetClass || l?.assetClass || "Unclassified",
      volatilityScore, liquidityScore, spreadScore, slippageScore, newsScore, macroScore, correlationScore, portfolioScore, brokerScore, propScore,
      overallRisk: overall, confidence: conf, mainRiskDriver: driver, qualification,
      lastScanned: [v?.lastScanned, l?.lastScanned, e?.lastScanned, m?.lastScanned, s?.lastScanned, b?.observedAt, asset.updatedAt].filter(Boolean).sort().at(-1),
      source: { v, l, e, m, s, b, components }
    };
  });
}

function matrix(rows) {
  return rows.map(row => ({
    assetId: row.assetId, asset: row.asset, assetClass: row.assetClass,
    volatilityRisk: cell(row.volatilityScore, null, row.confidence, row.lastScanned),
    liquidityRisk: cell(row.liquidityScore, null, row.confidence, row.lastScanned),
    spreadRisk: cell(row.spreadScore, null, row.confidence, row.lastScanned),
    slippageRisk: cell(row.slippageScore, null, row.confidence, row.lastScanned),
    newsRisk: cell(row.newsScore, null, row.confidence, row.lastScanned),
    macroRisk: cell(row.macroScore, null, row.confidence, row.lastScanned),
    correlationRisk: cell(row.correlationScore, null, row.confidence, row.lastScanned),
    portfolioRisk: cell(row.portfolioScore, null, row.confidence, row.lastScanned),
    brokerExecutionRisk: cell(row.brokerScore, null, row.confidence, row.lastScanned),
    propFirmRisk: cell(row.propScore, null, row.confidence, row.lastScanned),
    overallRisk: cell(row.overallRisk, null, row.confidence, row.lastScanned),
    confidence: row.confidence,
    lastUpdated: row.lastScanned
  }));
}

function rankings(rows) {
  return rows.slice().sort((a, b) => Number(b.overallRisk || -1) - Number(a.overallRisk || -1)).map((row, index) => ({
    rank: index + 1, assetId: row.assetId, asset: row.asset, assetClass: row.assetClass, overallRisk: riskLabel(row.overallRisk),
    riskScore: row.overallRisk, mainRiskDriver: row.mainRiskDriver, volatilityRisk: riskLabel(row.volatilityScore),
    liquidityRisk: riskLabel(row.liquidityScore), spreadRisk: riskLabel(row.spreadScore), slippageRisk: riskLabel(row.slippageScore),
    newsRisk: riskLabel(row.newsScore), portfolioRisk: riskLabel(row.portfolioScore), propFirmRisk: riskLabel(row.propScore),
    riskConfidence: row.confidence, qualification: row.qualification, lastScanned: row.lastScanned
  }));
}

function critical(rows) {
  return rows.filter(row => row.overallRisk >= 81 || row.qualification === "Blocked").map(row => ({
    asset: row.asset, criticalRiskType: row.mainRiskDriver, riskScore: row.overallRisk, blockingModule: "Risk Scanner",
    reason: `${row.mainRiskDriver} is ${riskLabel(row.overallRisk)}`, severity: "Critical", recommendedAction: "Avoid trade"
  }));
}

function newsEvents(rows) {
  return rows.filter(row => row.source.e).map(row => ({
    asset: row.asset, eventNews: row.source.e.nextEvent, currency: row.source.e.currency, impact: row.source.e.impact,
    riskWindow: row.source.e.timeToEvent, newsRiskScore: row.newsScore, volatilityRisk: row.source.e.volatilityRisk,
    tradingRecommendation: row.source.e.recommendation
  }));
}

function brokerExecution(rows) {
  return rows.filter(row => row.source.b).map(row => ({
    asset: row.asset, broker: row.source.b.broker, server: row.source.b.server, currentSpread: row.source.b.currentSpread,
    averageSpread: row.source.b.averageSpread, spreadDeviation: row.source.b.spreadDeviation, slippageRisk: row.source.b.slippageRisk,
    executionSpeed: row.source.b.executionSpeed, rejectRate: row.source.b.rejectRate, executionRisk: riskLabel(row.brokerScore),
    tradeability: row.source.b.tradeability
  }));
}

function correlationPortfolio(rows, auxiliary) {
  const concentration = auxiliary.concentration;
  if (concentration.length) {
    return rows.map(row => ({
      asset: row.asset, correlationGroup: concentration[0]?.subject || row.assetClass, existingExposure: concentration[0]?.message || "Portfolio concentration record",
      newTradeImpact: "Review before adding exposure", portfolioRisk: riskLabel(row.portfolioScore), correlationRisk: riskLabel(row.correlationScore),
      recommendedAction: concentration[0]?.recommended_action || "Check portfolio concentration"
    }));
  }
  return rows.map(row => ({
    asset: row.asset, correlationGroup: row.assetClass, existingExposure: "No production portfolio exposure record", newTradeImpact: "No Data",
    portfolioRisk: riskLabel(row.portfolioScore), correlationRisk: riskLabel(row.correlationScore), recommendedAction: "Connect Portfolio Intelligence"
  }));
}

function propFirm(rows, auxiliary) {
  if (!auxiliary.propRules.length && !auxiliary.propStatus.length) {
    return rows.map(row => ({ asset: row.asset, firm: "No Rule Assigned", account: "No Rule Assigned", ruleType: "No Rule Assigned", restrictionStatus: "No Rule Assigned", dailyDrawdownRisk: "No Data", maxDrawdownRisk: "No Data", newsRestriction: riskLabel(row.propScore), consistencyRisk: "No Data", complianceRecommendation: "Connect Prop Firm Rules" }));
  }
  return rows.map(row => ({ asset: row.asset, firm: "Connected Prop Firm", account: "Configured Account", ruleType: "Risk Rule", restrictionStatus: riskLabel(row.propScore), dailyDrawdownRisk: "Review", maxDrawdownRisk: "Review", newsRestriction: riskLabel(row.propScore), consistencyRisk: "Review", complianceRecommendation: row.propScore >= 81 ? "Blocked" : "Review" }));
}

function recommendations(rows) {
  return rows.filter(row => row.overallRisk !== null).map(row => ({
    asset: row.asset, riskDriver: row.mainRiskDriver,
    recommendation: row.overallRisk >= 81 ? "Avoid trade" : row.overallRisk >= 61 ? "Wait until risk normalizes" : row.overallRisk >= 41 ? "Reduce position size" : "Trade risk acceptable",
    expectedRiskReduction: row.overallRisk >= 61 ? "High" : row.overallRisk >= 41 ? "Medium" : "Low",
    priority: row.overallRisk >= 81 ? "Critical" : row.overallRisk >= 61 ? "High" : row.overallRisk >= 41 ? "Medium" : "Low"
  }));
}

function heatmap(rows) {
  return rows.flatMap(row => [
    ["Volatility", row.volatilityScore], ["Liquidity", row.liquidityScore], ["Spread", row.spreadScore], ["Slippage", row.slippageScore],
    ["News", row.newsScore], ["Macro", row.macroScore], ["Correlation", row.correlationScore], ["Portfolio", row.portfolioScore],
    ["Prop Firm", row.propScore], ["Overall", row.overallRisk]
  ].map(([riskType, score]) => ({ asset: row.asset, riskType, state: riskLabel(score), score: round(score), confidence: row.confidence })));
}

function summary(rows) {
  return {
    assetsScanned: rows.length,
    lowRiskAssets: rows.filter(row => row.overallRisk !== null && row.overallRisk <= 20).length,
    mediumRiskAssets: rows.filter(row => row.overallRisk >= 21 && row.overallRisk <= 40).length,
    highRiskAssets: rows.filter(row => row.overallRisk >= 61 && row.overallRisk <= 80).length,
    criticalRiskAssets: rows.filter(row => row.overallRisk >= 81).length,
    blockedAssets: rows.filter(row => row.qualification === "Blocked").length,
    newsRiskAssets: rows.filter(row => row.newsScore >= 41).length,
    spreadRiskAssets: rows.filter(row => row.spreadScore >= 41).length,
    slippageRiskAssets: rows.filter(row => row.slippageScore >= 41).length,
    liquidityRiskAssets: rows.filter(row => row.liquidityScore >= 41).length,
    portfolioRiskAssets: rows.filter(row => row.portfolioScore >= 41).length,
    propFirmRiskAssets: rows.filter(row => row.propScore >= 41).length,
    averageRiskScore: avg(rows.map(row => row.overallRisk)),
    averageRiskConfidence: avg(rows.map(row => row.confidence)),
    scannerHealth: rows.length ? "Healthy" : "Insufficient Data"
  };
}

async function weights() {
  const { rows } = await safeQuery(`SELECT component_key AS "componentKey", component_name AS "componentName", weight, enabled, updated_at AS "updatedAt" FROM market.risk_scanner_weights ORDER BY component_name`);
  return rows.map(row => ({ ...row, weight: round(row.weight) }));
}

async function latestRun() {
  const { rows } = await safeQuery(`SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "durationMs", assets_scanned AS "assetsScanned", health FROM market.risk_scanner_runs ORDER BY started_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function alerts() {
  const { rows } = await safeQuery(`SELECT alert_type AS "alertType", title, severity, asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.risk_scanner_alerts ORDER BY created_at DESC LIMIT 80`);
  return rows;
}

async function audit(assetId = null) {
  const { rows } = await safeQuery(`SELECT asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.risk_scanner_audit_logs ${assetId ? "WHERE asset_id = $1" : ""} ORDER BY created_at DESC LIMIT 80`, assetId ? [assetId] : []);
  return rows;
}

async function persistedAi() {
  const { rows } = await safeQuery(`SELECT lowest_risk_assets AS "lowestRiskAssets", highest_risk_assets AS "highestRiskAssets", blocked_assets AS "blockedAssets", main_risk_drivers AS "mainRiskDrivers", news_event_risks AS "newsEventRisks", broker_execution_risks AS "brokerExecutionRisks", portfolio_concentration_risks AS "portfolioConcentrationRisks", prop_firm_risks AS "propFirmRisks", assets_safe_for_ranking AS "assetsSafeForRanking", assets_to_avoid AS "assetsToAvoid", recommended_next_step AS "recommendedNextStep", summary, generated_at AS "generatedAt" FROM market.risk_scanner_ai_summaries ORDER BY generated_at DESC LIMIT 1`);
  return rows[0] || null;
}

function ai(rows, crit) {
  const sorted = rows.slice().sort((a, b) => Number(a.overallRisk ?? 999) - Number(b.overallRisk ?? 999));
  return {
    lowestRiskAssets: sorted.slice(0, 8).map(row => row.asset).join(", ") || "Insufficient Data",
    highestRiskAssets: sorted.slice(-8).map(row => row.asset).join(", ") || "Insufficient Data",
    blockedAssets: crit.map(row => row.asset).join(", ") || "No blocked assets",
    mainRiskDrivers: [...new Set(rows.map(row => row.mainRiskDriver).filter(Boolean))].slice(0, 8).join(", ") || "Insufficient Data",
    newsEventRisks: rows.filter(row => row.newsScore >= 41).map(row => row.asset).slice(0, 8).join(", ") || "Insufficient Data",
    brokerExecutionRisks: rows.filter(row => row.brokerScore >= 41).map(row => row.asset).slice(0, 8).join(", ") || "No broker execution rows",
    portfolioConcentrationRisks: rows.filter(row => row.portfolioScore >= 41).map(row => row.asset).slice(0, 8).join(", ") || "No portfolio concentration rows",
    propFirmRisks: rows.filter(row => row.propScore >= 41).map(row => row.asset).slice(0, 8).join(", ") || "No prop firm risk rows",
    assetsSafeForRanking: rows.filter(row => row.qualification === "Risk Qualified").slice(0, 8).map(row => row.asset).join(", ") || "Insufficient Data",
    assetsToAvoid: rows.filter(row => ["Blocked", "Rejected"].includes(row.qualification)).slice(0, 8).map(row => row.asset).join(", ") || "Insufficient Data",
    recommendedNextStep: "Send risk-qualified assets to Opportunity Ranking and reject blocked assets.",
    summary: `${rows.length} active assets scanned from live risk inputs.`
  };
}

async function liveOutput() {
  const [assets, volatility, liquidity, events, macro, sentiment, auxiliary, sourceRisk, run, weightRows, alertRows, auditRows, savedAi] = await Promise.all([
    activeAssets(), getVolatilityScannerEngine(), getLiquidityScannerEngine(), getEconomicEventsScannerEngine(),
    getMacroScannerEngine(), getSentimentScannerEngine(), portfolioRows(), sourceHealthRisk(), latestRun(), weights(), alerts(), audit(), persistedAi()
  ]);
  if (!assets.length) return { ...emptyState("EMPTY", "Risk scanner cannot calculate asset risk yet."), schemaReady: true, weights: weightRows, alerts: alertRows, audit: auditRows };
  auxiliary.sourceRisk = sourceRisk;
  const rows = deriveRows(assets, { volatility, liquidity, events, macro, sentiment }, auxiliary);
  const crit = critical(rows);
  const summaryRow = summary(rows);
  return {
    engine: "RiskScannerEngine",
    sourceMode: "LIVE_RISK_INPUTS_ONLY",
    mockDataDisabled: true,
    status: rows.some(row => row.overallRisk !== null) ? "READY" : "EMPTY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveRiskInputsOnly: true, lastRiskScan: rows.map(row => row.lastScanned).filter(Boolean).sort().at(-1) || run?.completedAt || null, riskScannerHealth: summaryRow.scannerHealth },
    latestRun: run,
    summary: summaryRow,
    matrix: matrix(rows),
    rankings: rankings(rows),
    critical: crit,
    newsEvents: newsEvents(rows),
    brokerExecution: brokerExecution(rows),
    correlationPortfolio: correlationPortfolio(rows, auxiliary),
    propFirm: propFirm(rows, auxiliary),
    recommendations: recommendations(rows),
    heatmap: heatmap(rows),
    weights: weightRows,
    aiSummary: savedAi || ai(rows, crit),
    alerts: alertRows,
    audit: auditRows,
    emptyState: rows.some(row => row.overallRisk !== null) ? null : emptyState("EMPTY", "Risk scanner cannot calculate asset risk yet.").emptyState
  };
}

export async function getRiskScannerEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  return liveOutput();
}

export async function getRiskScannerSlice(slice) {
  const data = await getRiskScannerEngine();
  const map = {
    summary: { status: data.status, badges: data.badges, summary: data.summary },
    matrix: { status: data.status, matrix: data.matrix },
    rankings: { status: data.status, rankings: data.rankings },
    critical: { status: data.status, critical: data.critical },
    "news-events": { status: data.status, newsEvents: data.newsEvents },
    "broker-execution": { status: data.status, brokerExecution: data.brokerExecution },
    "correlation-portfolio": { status: data.status, correlationPortfolio: data.correlationPortfolio },
    "prop-firm": { status: data.status, propFirm: data.propFirm },
    recommendations: { status: data.status, recommendations: data.recommendations },
    heatmap: { status: data.status, heatmap: data.heatmap },
    "ai-summary": { status: data.status, aiSummary: data.aiSummary },
    export: data
  };
  return map[slice] || data;
}

export async function getRiskScannerAssetDetail(assetId) {
  const data = await getRiskScannerEngine();
  const id = normalize(assetId);
  const row = data.rankings.find(item => normalize(item.assetId || item.asset) === id || normalize(item.asset) === id);
  if (!row) return null;
  return {
    asset: row,
    matrix: data.matrix.find(item => normalize(item.asset) === normalize(row.asset)),
    critical: data.critical.filter(item => normalize(item.asset) === normalize(row.asset)),
    newsEvents: data.newsEvents.filter(item => normalize(item.asset) === normalize(row.asset)),
    brokerExecution: data.brokerExecution.filter(item => normalize(item.asset) === normalize(row.asset)),
    correlationPortfolio: data.correlationPortfolio.filter(item => normalize(item.asset) === normalize(row.asset)),
    propFirm: data.propFirm.filter(item => normalize(item.asset) === normalize(row.asset)),
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

export async function runRiskScannerAction(action, body = {}, actor = "api", assetId = null) {
  await assertReady();
  if (action === "run-scan" || action === "recalculate") {
    const data = await liveOutput();
    await withTransaction(async client => {
      const runKey = `RISK-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
      await client.query(`INSERT INTO market.risk_scanner_runs (run_key, status, completed_at, assets_scanned, health, triggered_by, payload) VALUES ($1,'Completed',now(),$2,$3,$4,$5::jsonb)`, [runKey, data.summary.assetsScanned, data.summary.scannerHealth, actor, JSON.stringify({ action })]);
      await client.query(`INSERT INTO market.risk_scanner_audit_logs (user_name, action, entity_type, reason, payload) VALUES ($1,$2,'risk_scanner',$3,$4::jsonb)`, [actor, action, body.reason || null, JSON.stringify({ assetsScanned: data.summary.assetsScanned })]);
    });
    return { accepted: true, type: `risk_scanner.${action}`, status: data.status, assetsScanned: data.summary.assetsScanned };
  }
  if (action === "recalculate-asset") {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(assetId || "")) ? assetId : null;
    await safeQuery(`INSERT INTO market.risk_scanner_audit_logs (asset_id, user_name, action, entity_type, entity_id, reason, payload) VALUES ($1::uuid,$2,'recalculate_asset','asset_risk_score',$3,$4,$5::jsonb)`, [uuid, actor, assetId, body.reason || null, JSON.stringify({ assetId })]);
    return { accepted: true, type: "risk_scanner.asset.recalculated", assetId };
  }
  if (action === "create-alert") {
    await safeQuery(`INSERT INTO market.risk_scanner_alerts (alert_type, title, severity, asset, created_by, payload) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [body.alertType || "risk_scanner", body.title || "Risk scanner alert", body.severity || "Info", body.asset || null, actor, JSON.stringify(body)]);
    return { accepted: true, type: "risk_scanner.alert.created" };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    const data = await liveOutput(); const a = data.aiSummary || {};
    await safeQuery(`INSERT INTO market.risk_scanner_ai_summaries (summary, lowest_risk_assets, highest_risk_assets, blocked_assets, main_risk_drivers, news_event_risks, broker_execution_risks, portfolio_concentration_risks, prop_firm_risks, assets_safe_for_ranking, assets_to_avoid, recommended_next_step, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`, [a.summary, a.lowestRiskAssets, a.highestRiskAssets, a.blockedAssets, a.mainRiskDrivers, a.newsEventRisks, a.brokerExecutionRisks, a.portfolioConcentrationRisks, a.propFirmRisks, a.assetsSafeForRanking, a.assetsToAvoid, a.recommendedNextStep, JSON.stringify({ actor, action })]);
    return { accepted: true, type: "risk_scanner.ai_summary.saved" };
  }
  return { accepted: true, type: `risk_scanner.${action}.recorded` };
}

export async function exportRiskScannerReport() {
  return getRiskScannerEngine();
}
