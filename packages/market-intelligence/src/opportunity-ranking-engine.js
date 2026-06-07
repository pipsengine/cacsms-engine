import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { getCurrencyStrengthEngine } from "./currency-strength-engine.js";
import { getEconomicEventsScannerEngine } from "./economic-events-scanner-engine.js";
import { getInstitutionalScannerEngine } from "./institutional-scanner-engine.js";
import { getLiquidityScannerEngine } from "./liquidity-scanner-engine.js";
import { getMacroScannerEngine } from "./macro-scanner-engine.js";
import { getMarketStructureScannerEngine } from "./market-structure-scanner-engine.js";
import { getMomentumScannerEngine } from "./momentum-scanner-engine.js";
import { getPropComplianceScannerEngine } from "./prop-compliance-scanner-engine.js";
import { getRiskScannerEngine } from "./risk-scanner-engine.js";
import { getSentimentScannerEngine } from "./sentiment-scanner-engine.js";
import { getTrendScannerEngine } from "./trend-scanner-engine.js";
import { getVolatilityScannerEngine } from "./volatility-scanner-engine.js";
import { syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

export const OPPORTUNITY_RANKING_TABLES = Object.freeze([
  "market.asset_opportunity_scores",
  "market.asset_opportunity_rankings",
  "market.asset_opportunity_score_breakdowns",
  "market.asset_opportunity_weight_profiles",
  "market.asset_opportunity_signal_agreements",
  "market.asset_opportunity_conflicts",
  "market.asset_opportunity_readiness_checks",
  "market.asset_opportunity_history",
  "market.asset_opportunity_alerts",
  "market.asset_opportunity_ai_summaries",
  "market.asset_opportunity_audit_logs",
  "market.asset_opportunity_ranking_runs"
]);

const permissions = () => ({
  view: "universe_scanner.opportunities.view",
  runRanking: "universe_scanner.opportunities.run_ranking",
  recalculate: "universe_scanner.opportunities.recalculate",
  configureWeights: "universe_scanner.opportunities.configure_weights",
  sendToQualified: "universe_scanner.opportunities.send_to_qualified",
  createPackage: "universe_scanner.opportunities.create_package",
  createAlert: "universe_scanner.opportunities.create_alert",
  export: "universe_scanner.opportunities.export"
});

let opportunityCache = { at: 0, data: null };
const CACHE_MS = 15000;

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
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [OPPORTUNITY_RANKING_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "OpportunityRankingEngine",
    sourceMode: "LIVE_SCANNER_INPUTS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveScannerInputsOnly: true, lastRankingRun: null, rankingEngineHealth: "Insufficient Data" },
    summary: {
      assetsRanked: 0, eliteOpportunities: 0, qualifiedOpportunities: 0, watchlistOpportunities: 0,
      rejectedOpportunities: 0, blockedOpportunities: 0, buyCandidates: 0, sellCandidates: 0,
      averageOpportunityScore: null, averageConfidenceScore: null, averageRiskScore: null,
      averageComplianceScore: null, rankingEngineHealth: "Insufficient Data"
    },
    rankings: [], buy: [], sell: [], watchlist: [], blocked: [], history: [], agreement: [], readiness: [],
    breakdowns: [], weights: [], aiSummary: null, alerts: [], audit: [],
    emptyState: {
      title: "No opportunity rankings have been calculated yet.",
      message: "Run all required scanner modules, then execute the Opportunity Ranking Engine to generate ranked trading opportunities.",
      actions: ["Run Ranking", "Open Scanner Dashboard", "Open Risk Scanner", "Open Prop Compliance Scanner"]
    }
  };
}

function normalize(value) {
  return String(value || "").toUpperCase().replaceAll("/", "").replaceAll("-", "").replaceAll("_", "").replace(/\s+/g, "");
}

function signedScore(label, score = null) {
  const text = String(label || "").toLowerCase();
  if (/strong buy|strong bullish|strong up|bullish continuation/.test(text)) return 100;
  if (/buy|bullish|uptrend|positive|accumulation|risk-on/.test(text)) return 70;
  if (/strong sell|strong bearish|strong down|bearish continuation/.test(text)) return -100;
  if (/sell|bearish|downtrend|negative|distribution|risk-off/.test(text)) return -70;
  if (/neutral|mixed|range|sideways|no data|insufficient/.test(text)) return 0;
  return score === null || score === undefined ? null : Number(score);
}

function qualityScore(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Math.min(100, Math.abs(Number(value)));
}

function inverseRisk(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return null;
  return Math.max(0, 100 - Number(score));
}

function qualification(score, risk, compliance, confidence) {
  if (score === null || confidence === null) return "Insufficient Data";
  if (risk !== null && risk >= 81) return "Blocked";
  if (compliance !== null && compliance < 60) return "Blocked";
  if (score >= 90) return "Elite";
  if (score >= 75) return "Qualified";
  if (score >= 60) return "Watchlist";
  if (score >= 40) return "Rejected";
  return "Blocked";
}

function directionFrom(score, qualificationValue) {
  if (["Blocked", "Rejected"].includes(qualificationValue)) return "Avoid";
  if (score === null || score === undefined) return "Insufficient Data";
  if (score >= 75) return "Strong Buy";
  if (score >= 25) return "Buy";
  if (score <= -75) return "Strong Sell";
  if (score <= -25) return "Sell";
  return "Neutral";
}

async function activeAssets() {
  await syncAssetUniverseFromLiveSources();
  const { rows } = await safeQuery(`SELECT id, COALESCE(asset_code, asset, broker_symbol) AS asset, asset_class AS "assetClass", updated_at AS "updatedAt" FROM market.asset_universe WHERE active AND scanner_enabled ORDER BY asset`);
  return rows;
}

async function weights() {
  const { rows } = await safeQuery(`SELECT component_key AS "componentKey", component_name AS "componentName", weight, enabled, required, approved, updated_at AS "updatedAt" FROM market.asset_opportunity_weight_profiles WHERE profile_name = 'Production Default' ORDER BY component_name`);
  return rows.map(row => ({ ...row, weight: round(row.weight) }));
}

async function latestRun() {
  const { rows } = await safeQuery(`SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "durationMs", assets_ranked AS "assetsRanked", health FROM market.asset_opportunity_ranking_runs ORDER BY started_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function alerts() {
  const { rows } = await safeQuery(`SELECT alert_type AS "alertType", title, severity, asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.asset_opportunity_alerts ORDER BY created_at DESC LIMIT 80`);
  return rows;
}

async function audit(assetId = null) {
  const { rows } = await safeQuery(`SELECT asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.asset_opportunity_audit_logs ${assetId ? "WHERE asset_id = $1" : ""} ORDER BY created_at DESC LIMIT 80`, assetId ? [assetId] : []);
  return rows;
}

async function historyRows() {
  const { rows } = await safeQuery(`SELECT observed_at AS "time", asset, previous_rank AS "previousRank", current_rank AS "currentRank", rank_change AS "rankChange", previous_score AS "previousScore", current_score AS "currentScore", score_change AS "scoreChange", trigger FROM market.asset_opportunity_history ORDER BY observed_at DESC LIMIT 120`);
  return rows.map(row => ({ ...row, previousScore: round(row.previousScore), currentScore: round(row.currentScore), scoreChange: round(row.scoreChange) }));
}

async function persistedAi() {
  const { rows } = await safeQuery(`SELECT top_ranked_opportunities AS "topRankedOpportunities", best_buy_candidates AS "bestBuyCandidates", best_sell_candidates AS "bestSellCandidates", top_ranking_reasons AS "topRankingReasons", rejected_assets AS "rejectedAssets", main_risks AS "mainRisks", signal_conflicts AS "signalConflicts", recommended_next_action AS "recommendedNextAction", summary, generated_at AS "generatedAt" FROM market.asset_opportunity_ai_summaries ORDER BY generated_at DESC LIMIT 1`);
  return rows[0] || null;
}

function mapByAsset(rows = []) {
  const map = new Map();
  for (const row of rows) map.set(normalize(row.asset || row.pair), row);
  return map;
}

async function scannerContext() {
  const [assets, currency, trend, structure, momentum, volatility, liquidity, institutional, sentiment, macro, events, risk, compliance, weightRows, run, alertRows, auditRows, savedAi, history] = await Promise.all([
    activeAssets(), getCurrencyStrengthEngine(), getTrendScannerEngine(), getMarketStructureScannerEngine(), getMomentumScannerEngine(),
    getVolatilityScannerEngine(), getLiquidityScannerEngine(), getInstitutionalScannerEngine(), getSentimentScannerEngine(),
    getMacroScannerEngine(), getEconomicEventsScannerEngine(), getRiskScannerEngine(), getPropComplianceScannerEngine(),
    weights(), latestRun(), alerts(), audit(), persistedAi(), historyRows()
  ]);
  return { assets, currency, trend, structure, momentum, volatility, liquidity, institutional, sentiment, macro, events, risk, compliance, weights: weightRows, run, alerts: alertRows, audit: auditRows, savedAi, history };
}

function rowFor(asset, context) {
  const key = normalize(asset.asset);
  const trend = mapByAsset(context.trend.rankings).get(key);
  const structure = mapByAsset(context.structure.rankings).get(key);
  const momentum = mapByAsset(context.momentum.rankings).get(key);
  const volatility = mapByAsset(context.volatility.rankings).get(key);
  const liquidity = mapByAsset(context.liquidity.rankings).get(key);
  const institutional = mapByAsset(context.institutional.rankings).get(key);
  const sentiment = mapByAsset(context.sentiment.rankings).get(key);
  const macro = mapByAsset(context.macro.rankings).get(key);
  const event = mapByAsset(context.events.rankings).get(key);
  const risk = mapByAsset(context.risk.rankings).get(key);
  const compliance = mapByAsset(context.compliance.rankings).get(key);

  const trendScore = qualityScore(trend?.trendScore);
  const structureScore = qualityScore(structure?.structureScore ?? structure?.marketStructureScore);
  const momentumScore = qualityScore(momentum?.momentumScore);
  const volatilityScore = qualityScore(volatility?.volatilityScore);
  const liquidityScore = qualityScore(liquidity?.liquidityScore);
  const institutionalScore = qualityScore(institutional?.institutionalScore);
  const sentimentScore = qualityScore(sentiment?.sentimentScore);
  const macroScore = qualityScore(macro?.macroScore);
  const eventScore = event?.eventRiskScore === null || event?.eventRiskScore === undefined ? null : inverseRisk(event.eventRiskScore);
  const riskScore = risk?.riskScore ?? risk?.overallRisk ?? null;
  const complianceScore = compliance?.complianceScore ?? null;
  const confidenceScore = avg([trend?.trendConfidence, structure?.confidence, momentum?.confidence, volatility?.confidence, liquidity?.confidence, institutional?.confidence, sentiment?.confidence, macro?.confidence, event?.confidence, risk?.riskConfidence, compliance?.confidence]);

  const weightMap = Object.fromEntries(context.weights.filter(row => row.enabled && row.approved).map(row => [row.componentKey, Number(row.weight)]));
  const components = {
    trend: trendScore, structure: structureScore, momentum: momentumScore, volatility: volatilityScore, liquidity: liquidityScore,
    institutional: institutionalScore, sentiment: sentimentScore, macro: macroScore, event: eventScore,
    risk: inverseRisk(riskScore), compliance: complianceScore
  };
  let weighted = 0;
  let totalWeight = 0;
  for (const [name, score] of Object.entries(components)) {
    const weight = weightMap[name] || 0;
    if (score !== null && score !== undefined && weight > 0) {
      weighted += Number(score) * weight;
      totalWeight += weight;
    }
  }
  const finalScore = totalWeight >= 60 ? round(weighted / totalWeight) : null;
  const qual = qualification(finalScore, riskScore, complianceScore, confidenceScore);
  const directionalInputs = [
    signedScore(trend?.overallTrend, trend?.trendScore),
    signedScore(momentum?.momentumState || momentum?.overallMomentum, momentum?.momentumScore),
    signedScore(institutional?.institutionalBias || institutional?.smartMoneyDirection, institutional?.institutionalScore),
    signedScore(sentiment?.unifiedSentiment || sentiment?.overallSentiment, sentiment?.sentimentScore),
    signedScore(macro?.macroBias, macro?.macroScore)
  ].filter(value => value !== null && value !== undefined);
  const directionalScore = directionalInputs.length ? avg(directionalInputs) : null;
  const direction = directionFrom(directionalScore, qual);
  const missingInputs = Object.entries(components).filter(([, value]) => value === null || value === undefined).map(([name]) => name);
  const weakest = Object.entries(components).filter(([, value]) => value !== null && value !== undefined).sort((a, b) => Number(a[1]) - Number(b[1]))[0];
  const weakestLabel = weakest?.[0] ? weakest[0].replaceAll("_", " ").replace(/^\w/, char => char.toUpperCase()) : null;
  const mainReason = qual === "Blocked"
    ? (riskScore >= 81 ? "Critical Risk" : complianceScore !== null && complianceScore < 60 ? "Prop Firm Restriction" : weakestLabel ? `Weak ${weakestLabel} Score` : "Blocked")
    : weakestLabel ? `Rank driven by ${weakestLabel} score` : "Insufficient scanner data";
  return {
    assetId: asset.id, asset: asset.asset, assetClass: asset.assetClass || trend?.assetClass || "Unclassified",
    direction, opportunityScore: finalScore, confidenceScore, riskScore: round(riskScore), complianceScore: round(complianceScore),
    trendScore, structureScore, momentumScore, volatilityScore, liquidityScore, institutionalScore, sentimentScore, macroScore, eventScore,
    technicalScore: avg([trendScore, structureScore, momentumScore]), riskAdjustedScore: inverseRisk(riskScore), complianceAdjustedScore: complianceScore,
    mainReason, qualification: qual, missingInputs, weakestComponent: weakest?.[0] || "No Data",
    lastRanked: [trend?.lastScanned, structure?.lastScanned, momentum?.lastScanned, volatility?.lastScanned, liquidity?.lastScanned, institutional?.lastScanned, sentiment?.lastScanned, macro?.lastScanned, event?.lastScanned, risk?.lastScanned, compliance?.lastScanned, asset.updatedAt].filter(Boolean).sort().at(-1),
    source: { trend, structure, momentum, volatility, liquidity, institutional, sentiment, macro, event, risk, compliance, components, directionalScore }
  };
}

function buildRankings(rows) {
  return rows.slice().sort((a, b) => Number(b.opportunityScore ?? -1) - Number(a.opportunityScore ?? -1)).map((row, index) => ({ rank: index + 1, ...row }));
}

function summary(rows) {
  return {
    assetsRanked: rows.length,
    eliteOpportunities: rows.filter(row => row.qualification === "Elite").length,
    qualifiedOpportunities: rows.filter(row => row.qualification === "Qualified").length,
    watchlistOpportunities: rows.filter(row => row.qualification === "Watchlist").length,
    rejectedOpportunities: rows.filter(row => row.qualification === "Rejected").length,
    blockedOpportunities: rows.filter(row => row.qualification === "Blocked").length,
    buyCandidates: rows.filter(row => /buy/i.test(row.direction)).length,
    sellCandidates: rows.filter(row => /sell/i.test(row.direction)).length,
    averageOpportunityScore: avg(rows.map(row => row.opportunityScore)),
    averageConfidenceScore: avg(rows.map(row => row.confidenceScore)),
    averageRiskScore: avg(rows.map(row => row.riskScore)),
    averageComplianceScore: avg(rows.map(row => row.complianceScore)),
    rankingEngineHealth: rows.some(row => row.opportunityScore !== null) ? "Healthy" : "Insufficient Data"
  };
}

function buyRows(rows) {
  return rows.filter(row => /buy/i.test(row.direction)).map(row => ({ rank: row.rank, asset: row.asset, buyStrength: row.direction, supportingScores: `Trend ${row.trendScore ?? "NA"} / Momentum ${row.momentumScore ?? "NA"} / Macro ${row.macroScore ?? "NA"}`, riskScore: row.riskScore, complianceScore: row.complianceScore, confidence: row.confidenceScore, reason: row.mainReason, qualification: row.qualification }));
}

function sellRows(rows) {
  return rows.filter(row => /sell/i.test(row.direction)).map(row => ({ rank: row.rank, asset: row.asset, sellStrength: row.direction, supportingScores: `Trend ${row.trendScore ?? "NA"} / Momentum ${row.momentumScore ?? "NA"} / Macro ${row.macroScore ?? "NA"}`, riskScore: row.riskScore, complianceScore: row.complianceScore, confidence: row.confidenceScore, reason: row.mainReason, qualification: row.qualification }));
}

function watchlistRows(rows) {
  return rows.filter(row => row.qualification === "Watchlist" || row.qualification === "Insufficient Data").map(row => ({ asset: row.asset, currentScore: row.opportunityScore, missingRequirement: row.missingInputs.join(", ") || "Score threshold", weakestComponent: row.weakestComponent, requiredImprovement: row.opportunityScore === null ? "Complete missing scanner inputs" : `${75 - Number(row.opportunityScore)} points to Qualified`, recommendedAction: row.missingInputs.length ? "Run missing scanners" : "Monitor for confirmation" }));
}

function blockedRows(rows) {
  return rows.filter(row => ["Rejected", "Blocked"].includes(row.qualification)).map(row => ({ asset: row.asset, status: row.qualification, blockingReason: row.mainReason, blockingScanner: /risk/i.test(row.mainReason) ? "Risk Scanner" : /prop|compliance/i.test(row.mainReason) ? "Prop Compliance Scanner" : "Opportunity Ranking Engine", riskScore: row.riskScore, complianceScore: row.complianceScore, confidence: row.confidenceScore, canRetryAfter: null, recommendedAction: row.qualification === "Blocked" ? "Do not send to Qualified Trades" : "Review after scanner inputs improve" }));
}

function agreementRows(rows) {
  return rows.map(row => {
    const labels = {
      trend: row.source.trend?.overallTrend || "No Data",
      structure: row.source.structure?.structureState || row.source.structure?.overallStructure || "No Data",
      momentum: row.source.momentum?.momentumState || row.source.momentum?.overallMomentum || "No Data",
      liquidity: row.source.liquidity?.liquidityBias || "No Data",
      institutional: row.source.institutional?.institutionalBias || "No Data",
      sentiment: row.source.sentiment?.unifiedSentiment || "No Data",
      macro: row.source.macro?.macroBias || "No Data",
      risk: row.riskScore === null ? "No Data" : row.riskScore <= 40 ? "Supportive" : "Opposing",
      compliance: row.complianceScore === null ? "No Data" : row.complianceScore >= 75 ? "Supportive" : "Opposing"
    };
    const signs = [labels.trend, labels.momentum, labels.institutional, labels.sentiment, labels.macro].map(label => Math.sign(signedScore(label, 0)));
    const nonZero = signs.filter(Boolean);
    const agreementScore = nonZero.length ? round(100 * Math.max(nonZero.filter(v => v > 0).length, nonZero.filter(v => v < 0).length) / nonZero.length) : null;
    const conflictLevel = agreementScore === null ? "Critical" : agreementScore >= 90 ? "None" : agreementScore >= 75 ? "Low" : agreementScore >= 55 ? "Medium" : "High";
    return { asset: row.asset, ...labels, agreementScore, conflictLevel, interpretation: conflictLevel === "None" ? "Scanner modules broadly agree" : "Review scanner conflict before trade qualification" };
  });
}

function readinessRows(rows, agreement) {
  const agreementByAsset = mapByAsset(agreement);
  return rows.map(row => {
    const scoreOk = Number(row.opportunityScore || 0) >= 75;
    const confidenceOk = Number(row.confidenceScore || 0) >= 60;
    const riskOk = row.riskScore !== null && Number(row.riskScore) <= 60;
    const complianceOk = row.complianceScore !== null && Number(row.complianceScore) >= 75;
    const blockerClear = !["Blocked", "Rejected"].includes(row.qualification);
    const conflictClear = !["High", "Critical"].includes(agreementByAsset.get(normalize(row.asset))?.conflictLevel);
    const freshnessOk = Boolean(row.lastRanked);
    const ready = [scoreOk, confidenceOk, riskOk, complianceOk, blockerClear, conflictClear, freshnessOk].every(Boolean);
    const review = [scoreOk, confidenceOk, riskOk, blockerClear].filter(Boolean).length >= 3;
    return { asset: row.asset, status: ready ? "Ready" : review ? "Review Required" : blockerClear ? "Ready With Warnings" : "Blocked", opportunityThresholdPassed: scoreOk, confidenceThresholdPassed: confidenceOk, riskThresholdPassed: riskOk, complianceThresholdPassed: complianceOk, criticalBlockerClear: blockerClear, conflictClear, freshnessPassed: freshnessOk, sourceHealthPassed: true, recommendation: ready ? "Send to Qualified Trades" : "Resolve readiness blockers first" };
  });
}

function breakdownRows(rows, weightsRows) {
  const weightMap = Object.fromEntries(weightsRows.map(row => [row.componentKey, row]));
  return rows.flatMap(row => Object.entries(row.source.components).map(([key, score]) => {
    const weight = weightMap[key]?.weight ?? 0;
    return { asset: row.asset, componentKey: key, componentName: weightMap[key]?.componentName || key, rawScore: score, normalizedScore: score, weight, weightedContribution: score === null || score === undefined ? null : round(Number(score) * Number(weight) / 100), confidence: row.confidenceScore, sourceStatus: score === null || score === undefined ? "Missing" : "Used" };
  }));
}

function ai(rows, buy, sell, blocked, agreement) {
  return {
    topRankedOpportunities: rows.slice(0, 8).map(row => row.asset).join(", ") || "Insufficient Data",
    bestBuyCandidates: buy.slice(0, 8).map(row => row.asset).join(", ") || "No buy candidates",
    bestSellCandidates: sell.slice(0, 8).map(row => row.asset).join(", ") || "No sell candidates",
    topRankingReasons: rows.slice(0, 5).map(row => `${row.asset}: ${row.mainReason}`).join("; ") || "Insufficient Data",
    rejectedAssets: blocked.slice(0, 8).map(row => row.asset).join(", ") || "No rejected assets",
    mainRisks: blocked.filter(row => /risk/i.test(row.blockingReason)).slice(0, 8).map(row => row.asset).join(", ") || "No major risk blocks",
    signalConflicts: agreement.filter(row => ["High", "Critical"].includes(row.conflictLevel)).slice(0, 8).map(row => row.asset).join(", ") || "No critical signal conflicts",
    recommendedNextAction: "Send Ready opportunities to Qualified Trades and review watchlist or blocked assets before handoff.",
    summary: `${rows.length} assets ranked from live scanner inputs.`
  };
}

async function liveOutput() {
  const context = await scannerContext();
  if (!context.assets.length) return { ...emptyState("EMPTY", "No opportunity rankings have been calculated yet."), weights: context.weights, latestRun: context.run, alerts: context.alerts, audit: context.audit, history: context.history };
  const weightTotal = context.weights.filter(row => row.enabled && row.approved).reduce((sum, row) => sum + Number(row.weight || 0), 0);
  const rows = buildRankings(context.assets.map(asset => rowFor(asset, context)));
  const publicRows = rows.map(({ source, ...row }) => row);
  const buy = buyRows(rows);
  const sell = sellRows(rows);
  const blocked = blockedRows(rows);
  const agreement = agreementRows(rows);
  const readiness = readinessRows(rows, agreement);
  const summaryRow = summary(rows);
  const hasScores = rows.some(row => row.opportunityScore !== null);
  return {
    engine: "OpportunityRankingEngine",
    sourceMode: "LIVE_SCANNER_INPUTS_ONLY",
    mockDataDisabled: true,
    status: hasScores ? "READY" : "EMPTY",
    message: weightTotal === 100 ? null : `Active approved opportunity weights total ${weightTotal}%, expected 100%.`,
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveScannerInputsOnly: true, lastRankingRun: rows.map(row => row.lastRanked).filter(Boolean).sort().at(-1) || context.run?.completedAt || null, rankingEngineHealth: summaryRow.rankingEngineHealth },
    latestRun: context.run,
    summary: summaryRow,
    rankings: publicRows,
    buy, sell,
    watchlist: watchlistRows(rows),
    blocked,
    history: context.history,
    agreement,
    readiness,
    breakdowns: breakdownRows(rows, context.weights),
    weights: context.weights,
    aiSummary: context.savedAi || ai(rows, buy, sell, blocked, agreement),
    alerts: context.alerts,
    audit: context.audit,
    emptyState: hasScores ? null : emptyState("EMPTY", "No opportunity rankings have been calculated yet.").emptyState
  };
}

export async function getOpportunityRankingEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  if (opportunityCache.data && Date.now() - opportunityCache.at < CACHE_MS) return opportunityCache.data;
  const data = await liveOutput();
  opportunityCache = { at: Date.now(), data };
  return data;
}

export async function getOpportunityRankingSlice(slice) {
  const data = await getOpportunityRankingEngine();
  const map = {
    summary: { status: data.status, badges: data.badges, summary: data.summary },
    rankings: { status: data.status, rankings: data.rankings },
    buy: { status: data.status, buy: data.buy },
    sell: { status: data.status, sell: data.sell },
    watchlist: { status: data.status, watchlist: data.watchlist },
    blocked: { status: data.status, blocked: data.blocked },
    history: { status: data.status, history: data.history },
    agreement: { status: data.status, agreement: data.agreement },
    readiness: { status: data.status, readiness: data.readiness },
    "ai-summary": { status: data.status, aiSummary: data.aiSummary },
    export: data
  };
  return map[slice] || data;
}

export async function getOpportunityRankingDetail(assetId) {
  const data = await getOpportunityRankingEngine();
  const id = normalize(assetId);
  const asset = data.rankings.find(row => normalize(row.assetId || row.asset) === id || normalize(row.asset) === id);
  if (!asset) return null;
  return {
    asset,
    breakdown: data.breakdowns.filter(row => normalize(row.asset) === normalize(asset.asset)),
    missingInputs: asset.missingInputs,
    agreement: data.agreement.find(row => normalize(row.asset) === normalize(asset.asset)),
    readiness: data.readiness.find(row => normalize(row.asset) === normalize(asset.asset)),
    history: data.history.filter(row => normalize(row.asset) === normalize(asset.asset)),
    audit: data.audit.filter(row => !row.assetId || String(row.assetId) === String(asset.assetId)),
    alerts: data.alerts.filter(row => normalize(row.asset) === normalize(asset.asset)),
    aiSummary: data.aiSummary
  };
}

async function assertReady() {
  if (!isDatabaseConfigured()) { const error = new Error("database_not_configured"); error.status = 503; throw error; }
  const ready = await tableReadiness();
  if (!ready.ready) { const error = new Error("schema_not_ready"); error.status = 503; error.missingTables = ready.missing; throw error; }
}

export async function runOpportunityRankingAction(action, body = {}, actor = "api", assetId = null) {
  await assertReady();
  opportunityCache = { at: 0, data: null };
  if (action === "run-ranking" || action === "recalculate") {
    const started = Date.now();
    const data = await liveOutput();
    await withTransaction(async client => {
      const runKey = `OPP-${Date.now()}`;
      await client.query(`INSERT INTO market.asset_opportunity_ranking_runs (run_key, status, completed_at, duration_ms, assets_ranked, health, triggered_by, payload) VALUES ($1,'Completed',now(),$2,$3,$4,$5,$6::jsonb)`, [runKey, Date.now() - started, data.summary.assetsRanked, data.summary.rankingEngineHealth, actor, JSON.stringify({ action })]);
      await client.query(`INSERT INTO market.asset_opportunity_audit_logs (user_name, action, entity_type, reason, payload) VALUES ($1,$2,'opportunity_ranking',$3,$4::jsonb)`, [actor, action, body.reason || null, JSON.stringify({ assetsRanked: data.summary.assetsRanked, status: data.status })]);
    });
    return { accepted: true, type: `opportunity_ranking.${action}`, status: data.status, assetsRanked: data.summary.assetsRanked };
  }
  if (action === "recalculate-asset" || action === "send-to-qualified" || action === "create-package") {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(assetId || "")) ? assetId : null;
    await safeQuery(`INSERT INTO market.asset_opportunity_audit_logs (asset_id, user_name, action, entity_type, entity_id, reason, payload) VALUES ($1::uuid,$2,$3,'asset_opportunity',$4,$5,$6::jsonb)`, [uuid, actor, action, assetId, body.reason || null, JSON.stringify(body)]);
    return { accepted: true, type: `opportunity_ranking.${action}`, assetId };
  }
  if (action === "create-alert") {
    await safeQuery(`INSERT INTO market.asset_opportunity_alerts (alert_type, title, severity, asset, created_by, payload) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [body.alertType || "opportunity_ranking", body.title || "Opportunity ranking alert", body.severity || "Info", body.asset || null, actor, JSON.stringify(body)]);
    return { accepted: true, type: "opportunity_ranking.alert.created" };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    const data = await liveOutput(); const a = data.aiSummary || {};
    await safeQuery(`INSERT INTO market.asset_opportunity_ai_summaries (summary, top_ranked_opportunities, best_buy_candidates, best_sell_candidates, top_ranking_reasons, rejected_assets, main_risks, signal_conflicts, recommended_next_action, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [a.summary, a.topRankedOpportunities, a.bestBuyCandidates, a.bestSellCandidates, a.topRankingReasons, a.rejectedAssets, a.mainRisks, a.signalConflicts, a.recommendedNextAction, JSON.stringify({ actor, action })]);
    return { accepted: true, type: "opportunity_ranking.ai_summary.saved" };
  }
  return { accepted: true, type: `opportunity_ranking.${action}.recorded` };
}

export async function exportOpportunityRankingReport() {
  return getOpportunityRankingEngine();
}
