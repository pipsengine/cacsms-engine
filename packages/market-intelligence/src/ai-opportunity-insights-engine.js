import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { getOpportunityRankingEngine } from "./opportunity-ranking-engine.js";
import { getPropComplianceScannerEngine } from "./prop-compliance-scanner-engine.js";
import { getQualifiedTradesCenter } from "./qualified-trades-engine.js";
import { getRiskScannerEngine } from "./risk-scanner-engine.js";

export const AI_INSIGHTS_TABLES = Object.freeze([
  "market.scanner_ai_insights",
  "market.scanner_ai_insight_inputs",
  "market.scanner_ai_insight_grounding_checks",
  "market.scanner_ai_opportunity_narratives",
  "market.scanner_ai_risk_narratives",
  "market.scanner_ai_compliance_narratives",
  "market.scanner_ai_conflict_narratives",
  "market.scanner_ai_review_suggestions",
  "market.scanner_ai_generation_logs",
  "market.scanner_ai_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.ai_insights.view",
  generate: "universe_scanner.ai_insights.generate",
  regenerate: "universe_scanner.ai_insights.regenerate",
  review: "universe_scanner.ai_insights.review",
  archive: "universe_scanner.ai_insights.archive",
  createAlert: "universe_scanner.ai_insights.create_alert",
  export: "universe_scanner.ai_insights.export"
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
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [AI_INSIGHTS_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "AIOpportunityInsightsEngine",
    sourceMode: "LIVE_SCANNER_OUTPUTS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveScannerOutputsOnly: true, lastAiGeneration: null, aiConfidenceScore: null },
    summary: {
      aiInsightsGenerated: 0, topOpportunitiesExplained: 0, rejectedAssetsExplained: 0, riskNarrativesGenerated: 0,
      conflictSummariesGenerated: 0, qualifiedCandidateSummaries: 0, humanReviewSuggestions: 0, aiConfidenceAverage: null,
      groundingCompleteness: null, ungroundedOutputBlocks: 0, latestInsightStatus: "Insufficient Data", aiEngineHealth: "Insufficient Data"
    },
    universeSummary: null, topOpportunities: [], rejectedBlocked: [], agreement: [], conflicts: [],
    riskNarratives: [], complianceNarratives: [], reviewSuggestions: [], insights: [], alerts: [], audit: [],
    emptyState: {
      title: "AI opportunity insights cannot be generated yet.",
      message: "Run the Universe Scanner, Opportunity Ranking Engine, Risk Scanner, and Qualified Trades validation before generating AI insights.",
      actions: ["Open Opportunity Ranking", "Open Qualified Trades", "Run Scanner Dashboard", "Run AI Insight Generation"]
    }
  };
}

function normalize(value) {
  return String(value || "").toUpperCase().replaceAll("/", "").replaceAll("-", "").replaceAll("_", "").replace(/\s+/g, "");
}

function missingDisclosure(items) {
  return items?.length ? ` This insight is limited because required scanner outputs are missing or stale: ${items.join(", ")}.` : "";
}

function buildLiveInsights(context) {
  const rankings = context.opportunities.rankings || [];
  const blocked = context.opportunities.blocked || [];
  const agreement = context.opportunities.agreement || [];
  const riskRows = context.risk.rankings || [];
  const complianceRows = context.compliance.rankings || [];
  const qualified = context.qualified.candidates || [];
  const missing = [];
  if (!qualified.length) missing.push("qualified_trade_candidates");
  if (context.compliance.status === "EMPTY") missing.push("asset_prop_compliance_scores");
  if (!rankings.length) missing.push("asset_opportunity_scores");
  const top = rankings.slice(0, 8);
  const universeSummary = {
    insightId: "live-universe-summary",
    insightType: "Universe Summary",
    title: "AI Universe Scanner Interpretation",
    summary: `${rankings.length} assets are available from the Opportunity Ranking Engine. Best buy candidates: ${context.opportunities.buy?.slice(0, 5).map(row => row.asset).join(", ") || "none"}. Best sell candidates: ${context.opportunities.sell?.slice(0, 5).map(row => row.asset).join(", ") || "none"}. Rejected or blocked assets: ${blocked.slice(0, 8).map(row => row.asset).join(", ") || "none"}. Main next step: validate qualified candidates before scoring.${missingDisclosure(missing)}`,
    confidenceScore: avg([context.opportunities.summary?.averageConfidenceScore, context.risk.summary?.averageRiskConfidence]),
    groundingStatus: rankings.length ? "Grounding Passed" : "Grounding Failed",
    missingInputs: missing.join(", "),
    sourceFreshness: context.opportunities.badges?.lastRankingRun || context.risk.badges?.lastRiskScan || null
  };
  const topOpportunities = top.map(row => ({
    insightId: `live-opportunity-${row.asset}`,
    asset: row.asset, direction: row.direction, opportunityScore: row.opportunityScore, confidenceScore: row.confidenceScore,
    riskScore: row.riskScore, complianceScore: row.complianceScore,
    whyRankedHigh: `${row.asset} is ranked ${row.rank} because ${row.mainReason}.`,
    supportingFactors: `Structure ${row.structureScore ?? "missing"}, liquidity ${row.liquidityScore ?? "missing"}, event score ${row.eventScore ?? "missing"}.`,
    opposingFactors: `Risk ${row.riskScore ?? "missing"}, compliance ${row.complianceScore ?? "missing"}, weakest input ${row.weakestComponent || "not recorded"}.`,
    riskWarnings: row.riskScore >= 60 ? "Risk scanner is elevated." : "No elevated risk score in the ranking row.",
    recommendedNextStep: row.qualification === "Blocked" ? "Do not send to scoring until blockers clear." : "Review readiness and package if eligible.",
    groundingStatus: row.opportunityScore === null ? "Grounding Failed" : "Grounding Passed"
  }));
  const rejectedBlocked = blocked.map(row => ({
    asset: row.asset, status: row.status, blockingReason: row.blockingReason, weakestScannerComponent: row.blockingScanner,
    riskDriver: row.riskScore, complianceDriver: row.complianceScore, missingData: row.complianceScore === null ? "Compliance" : "",
    recommendedFix: row.recommendedAction, canRetry: row.canRetryAfter ? "After retry window" : "After scanner state improves"
  }));
  const conflicts = agreement.filter(row => ["High", "Critical"].includes(row.conflictLevel)).map(row => ({
    asset: row.asset, conflictType: row.conflictLevel, modulesInvolved: "Trend, Momentum, Sentiment, Macro, Risk, Compliance",
    severity: row.conflictLevel, aiExplanation: row.interpretation, recommendedResolution: "Review conflicting scanner modules before handoff."
  }));
  const riskNarratives = riskRows.slice().sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0)).slice(0, 12).map(row => ({
    asset: row.asset, narrative: `${row.asset} risk is ${row.overallRisk} with ${row.mainRiskDriver} as the main driver.`, riskDriver: row.mainRiskDriver, riskScore: row.riskScore, recommendedControl: row.qualification === "Risk Qualified" ? "Monitor risk before trade." : "Block until risk improves."
  }));
  const complianceNarratives = complianceRows.length ? complianceRows.slice(0, 12).map(row => ({
    asset: row.asset, narrative: `${row.asset} compliance status is ${row.tradeEligibility} with ${row.primaryConstraint} as the primary constraint.`, complianceScore: row.complianceScore, complianceWarning: row.primaryConstraint, recommendedAction: row.tradeEligibility === "Allowed" ? "Eligible for handoff." : "Resolve compliance constraint."
  })) : [{
    asset: "All Assets", narrative: "Prop firm compliance cannot be confirmed because live prop firm account/rule records are missing.", complianceScore: null, complianceWarning: "Missing compliance source", recommendedAction: "Connect prop firm account and rules before scoring."
  }];
  const reviewSuggestions = [...blocked.slice(0, 10), ...rankings.filter(row => row.confidenceScore < 70).slice(0, 5)].map(row => ({
    asset: row.asset, reasonForReview: row.blockingReason || "Low Confidence", severity: row.status === "Blocked" || row.qualification === "Blocked" ? "High Risk" : "Warning",
    reviewerRole: row.complianceScore === null ? "Compliance Reviewer" : row.riskScore >= 60 ? "Risk Manager" : "Trader",
    recommendedAction: row.recommendedAction || "Review before next workflow step."
  }));
  return { universeSummary, topOpportunities, rejectedBlocked, agreement, conflicts, riskNarratives, complianceNarratives, reviewSuggestions };
}

async function storedRows() {
  const [insights, alerts, audit] = await Promise.all([
    safeQuery(`SELECT id AS "insightId", insight_type AS "insightType", asset, title, summary, confidence_score AS "confidenceScore", grounding_status AS "groundingStatus", status, missing_inputs AS "missingInputs", source_freshness AS "sourceFreshness", review_status AS "reviewStatus", generated_at AS "generatedAt" FROM market.scanner_ai_insights ORDER BY generated_at DESC LIMIT 120`).then(r => r.rows),
    safeQuery(`SELECT insight_id AS "insightId", alert_type AS "alertType", title, severity, asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.scanner_ai_alerts ORDER BY created_at DESC LIMIT 80`).then(r => r.rows),
    safeQuery(`SELECT insight_id AS "insightId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.scanner_ai_audit_logs ORDER BY created_at DESC LIMIT 120`).then(r => r.rows)
  ]);
  return { insights, alerts, audit };
}

function summary(live, stored) {
  const insights = [live.universeSummary, ...live.topOpportunities, ...live.riskNarratives, ...live.complianceNarratives, ...live.conflicts, ...live.reviewSuggestions];
  const groundingPassed = insights.filter(row => row.groundingStatus !== "Grounding Failed").length;
  return {
    aiInsightsGenerated: insights.length + stored.insights.length,
    topOpportunitiesExplained: live.topOpportunities.length,
    rejectedAssetsExplained: live.rejectedBlocked.length,
    riskNarrativesGenerated: live.riskNarratives.length,
    conflictSummariesGenerated: live.conflicts.length,
    qualifiedCandidateSummaries: 0,
    humanReviewSuggestions: live.reviewSuggestions.length,
    aiConfidenceAverage: avg([live.universeSummary.confidenceScore, ...live.topOpportunities.map(row => row.confidenceScore)]),
    groundingCompleteness: insights.length ? round(100 * groundingPassed / insights.length) : null,
    ungroundedOutputBlocks: insights.filter(row => row.groundingStatus === "Grounding Failed").length,
    latestInsightStatus: insights.length ? "Generated" : "Insufficient Data",
    aiEngineHealth: insights.length ? "Healthy" : "Insufficient Data"
  };
}

async function liveOutput() {
  const [opportunities, qualified, risk, compliance, stored] = await Promise.all([
    getOpportunityRankingEngine(), getQualifiedTradesCenter(), getRiskScannerEngine(), getPropComplianceScannerEngine(), storedRows()
  ]);
  if (opportunities.status === "EMPTY" && risk.status === "EMPTY") return { ...emptyState("EMPTY", "AI opportunity insights cannot be generated yet."), ...stored };
  const live = buildLiveInsights({ opportunities, qualified, risk, compliance });
  return {
    engine: "AIOpportunityInsightsEngine",
    sourceMode: "LIVE_SCANNER_OUTPUTS_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveScannerOutputsOnly: true, lastAiGeneration: stored.insights[0]?.generatedAt || live.universeSummary.sourceFreshness, aiConfidenceScore: live.universeSummary.confidenceScore },
    summary: summary(live, stored),
    universeSummary: live.universeSummary,
    topOpportunities: live.topOpportunities,
    rejectedBlocked: live.rejectedBlocked,
    agreement: live.agreement,
    conflicts: live.conflicts,
    riskNarratives: live.riskNarratives,
    complianceNarratives: live.complianceNarratives,
    reviewSuggestions: live.reviewSuggestions,
    insights: stored.insights,
    alerts: stored.alerts,
    audit: stored.audit,
    emptyState: null
  };
}

export async function getAiOpportunityInsightsCenter() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  return liveOutput();
}

export async function getAiOpportunityInsightsSlice(slice) {
  const data = await getAiOpportunityInsightsCenter();
  const map = {
    summary: { status: data.status, badges: data.badges, summary: data.summary },
    "universe-summary": { status: data.status, universeSummary: data.universeSummary },
    "top-opportunities": { status: data.status, topOpportunities: data.topOpportunities },
    "rejected-blocked": { status: data.status, rejectedBlocked: data.rejectedBlocked },
    agreement: { status: data.status, agreement: data.agreement },
    conflicts: { status: data.status, conflicts: data.conflicts },
    "risk-narratives": { status: data.status, riskNarratives: data.riskNarratives },
    "compliance-narratives": { status: data.status, complianceNarratives: data.complianceNarratives },
    "review-suggestions": { status: data.status, reviewSuggestions: data.reviewSuggestions },
    export: data
  };
  return map[slice] || data;
}

export async function getAiOpportunityInsightDetail(insightId) {
  const data = await getAiOpportunityInsightsCenter();
  const all = [data.universeSummary, ...data.topOpportunities, ...data.riskNarratives, ...data.complianceNarratives, ...data.conflicts, ...data.reviewSuggestions, ...data.insights];
  return all.find(row => String(row.insightId || row.id || `${row.asset}-${row.insightType}`) === String(insightId)) || null;
}

async function assertReady() {
  if (!isDatabaseConfigured()) { const error = new Error("database_not_configured"); error.status = 503; throw error; }
  const ready = await tableReadiness();
  if (!ready.ready) { const error = new Error("schema_not_ready"); error.status = 503; error.missingTables = ready.missing; throw error; }
}

export async function runAiOpportunityInsightsAction(action, body = {}, actor = "api", insightId = null) {
  await assertReady();
  if (action === "generate" || action === "regenerate") {
    const data = await liveOutput();
    await withTransaction(async client => {
      const summaryRow = data.universeSummary || {};
      const result = await client.query(`INSERT INTO market.scanner_ai_insights (insight_type, title, summary, confidence_score, grounding_status, status, missing_inputs, source_freshness, payload) VALUES ('Universe Summary',$1,$2,$3,$4,'Generated',$5,$6,$7::jsonb) RETURNING id`, [summaryRow.title || "AI Universe Scanner Interpretation", summaryRow.summary || data.message, summaryRow.confidenceScore, summaryRow.groundingStatus || "Grounding Passed", summaryRow.missingInputs || null, summaryRow.sourceFreshness || null, JSON.stringify(summaryRow)]);
      await client.query(`INSERT INTO market.scanner_ai_generation_logs (status, insights_generated, grounding_blocks, triggered_by, payload, completed_at) VALUES ('Completed',$1,$2,$3,$4::jsonb,now())`, [data.summary.aiInsightsGenerated, data.summary.ungroundedOutputBlocks, actor, JSON.stringify({ action })]);
      await client.query(`INSERT INTO market.scanner_ai_audit_logs (insight_id, user_name, action, entity_type, entity_id, payload) VALUES ($1,$2,$3,'scanner_ai_insight',$4,$5::jsonb)`, [result.rows[0].id, actor, action, result.rows[0].id, JSON.stringify(body)]);
    });
    return { accepted: true, type: `ai_insights.${action}`, status: data.status, insightsGenerated: data.summary.aiInsightsGenerated };
  }
  if (action === "mark-reviewed" || action === "archive") {
    const status = action === "archive" ? "Archived" : "Reviewed";
    await safeQuery(`UPDATE market.scanner_ai_insights SET review_status = $2, status = $2, updated_at = now() WHERE id = $1::uuid`, [insightId, status]);
    await safeQuery(`INSERT INTO market.scanner_ai_audit_logs (insight_id, user_name, action, entity_type, entity_id, reason, payload) VALUES ($1::uuid,$2,$3,'scanner_ai_insight',$4,$5,$6::jsonb)`, [insightId, actor, action, insightId, body.reason || null, JSON.stringify(body)]);
    return { accepted: true, type: `ai_insights.${action}`, insightId };
  }
  if (action === "create-alert") {
    await safeQuery(`INSERT INTO market.scanner_ai_alerts (insight_id, alert_type, title, severity, asset, created_by, payload) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7::jsonb)`, [insightId, body.alertType || "ai_insight", body.title || "AI insight alert", body.severity || "Info", body.asset || null, actor, JSON.stringify(body)]);
    return { accepted: true, type: "ai_insights.alert.created", insightId };
  }
  return { accepted: true, type: `ai_insights.${action}.recorded` };
}

export async function exportAiOpportunityInsightsReport() {
  return getAiOpportunityInsightsCenter();
}
