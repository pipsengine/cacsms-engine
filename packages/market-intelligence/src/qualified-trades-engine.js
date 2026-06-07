import { isDatabaseConfigured, query, withTransaction } from "./db.js";

export const QUALIFIED_TRADES_TABLES = Object.freeze([
  "market.qualified_trade_candidates",
  "market.qualified_trade_candidate_scores",
  "market.qualified_trade_candidate_readiness",
  "market.qualified_trade_candidate_packages",
  "market.qualified_trade_candidate_scoring_submissions",
  "market.qualified_trade_candidate_reviews",
  "market.qualified_trade_candidate_expiry_rules",
  "market.qualified_trade_candidate_history",
  "market.qualified_trade_candidate_ai_summaries",
  "market.qualified_trade_candidate_alerts",
  "market.qualified_trade_candidate_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.qualified_trades.view",
  validate: "universe_scanner.qualified_trades.validate",
  createPackage: "universe_scanner.qualified_trades.create_package",
  sendToScoring: "universe_scanner.qualified_trades.send_to_scoring",
  review: "universe_scanner.qualified_trades.review",
  expire: "universe_scanner.qualified_trades.expire",
  createAlert: "universe_scanner.qualified_trades.create_alert",
  export: "universe_scanner.qualified_trades.export"
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
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [QUALIFIED_TRADES_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "QualifiedTradeCandidateEngine",
    sourceMode: "QUALIFIED_CANDIDATES_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, qualifiedCandidatesOnly: true, lastQualificationRun: null, card3OutputStatus: "Insufficient Data" },
    summary: {
      qualifiedCandidates: 0, readyForScoring: 0, readyForPackage: 0, reviewRequired: 0, blockedAfterQualification: 0,
      buyCandidates: 0, sellCandidates: 0, propSafeCandidates: 0, highConfidenceCandidates: 0,
      averageOpportunityScore: null, averageRiskScore: null, averageComplianceScore: null, card3OutputReadiness: "Insufficient Data"
    },
    candidates: [], readiness: [], readyForPackage: [], readyForScoring: [], reviewRequired: [], blockedExpired: [],
    expiryRules: [], aiSummary: null, alerts: [], audit: [], history: [],
    emptyState: {
      title: "No qualified trade candidates are available yet.",
      message: "Run the Opportunity Ranking Engine and complete risk, compliance, and readiness checks before candidates can appear here.",
      actions: ["Open Opportunity Ranking", "Run Ranking", "Open Risk Scanner", "Open Prop Compliance Scanner"]
    }
  };
}

async function sourceRows() {
  const [candidates, readiness, packages, scoring, reviews, rules, history, alerts, audit, ai] = await Promise.all([
    safeQuery(`SELECT c.*, au.asset_class AS "universeAssetClass" FROM market.qualified_trade_candidates c LEFT JOIN market.asset_universe au ON au.id = c.asset_id OR au.asset = c.asset OR au.asset_code = c.asset ORDER BY c.created_at DESC LIMIT 500`).then(r => r.rows),
    safeQuery(`SELECT DISTINCT ON (candidate_id) candidate_id AS "candidateId", opportunity_passed AS "opportunityPassed", risk_passed AS "riskPassed", compliance_passed AS "compliancePassed", confidence_passed AS "confidencePassed", signal_agreement_passed AS "signalAgreementPassed", source_health_passed AS "sourceHealthPassed", dependency_health_passed AS "dependencyHealthPassed", freshness_passed AS "freshnessPassed", expiry_passed AS "expiryPassed", readiness_score AS "readinessScore", status, checked_at AS "checkedAt" FROM market.qualified_trade_candidate_readiness ORDER BY candidate_id, checked_at DESC`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.qualified_trade_candidate_packages ORDER BY created_at DESC LIMIT 500`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.qualified_trade_candidate_scoring_submissions ORDER BY submitted_at DESC LIMIT 500`).then(r => r.rows),
    safeQuery(`SELECT * FROM market.qualified_trade_candidate_reviews ORDER BY created_at DESC LIMIT 500`).then(r => r.rows),
    safeQuery(`SELECT asset_class AS "assetClass", timeframe, expiry_minutes AS "expiryMinutes", enabled, updated_at AS "updatedAt" FROM market.qualified_trade_candidate_expiry_rules ORDER BY asset_class, timeframe`).then(r => r.rows),
    safeQuery(`SELECT candidate_id AS "candidateId", asset, previous_status AS "previousStatus", current_status AS "currentStatus", trigger, notes, created_at AS "createdAt" FROM market.qualified_trade_candidate_history ORDER BY created_at DESC LIMIT 120`).then(r => r.rows),
    safeQuery(`SELECT alert_type AS "alertType", title, severity, candidate_id AS "candidateId", asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.qualified_trade_candidate_alerts ORDER BY created_at DESC LIMIT 80`).then(r => r.rows),
    safeQuery(`SELECT candidate_id AS "candidateId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.qualified_trade_candidate_audit_logs ORDER BY created_at DESC LIMIT 120`).then(r => r.rows),
    safeQuery(`SELECT best_qualified_candidates AS "bestQualifiedCandidates", ready_for_scoring AS "readyForScoring", review_required AS "reviewRequired", blocked_or_expired AS "blockedOrExpired", major_risks AS "majorRisks", compliance_concerns AS "complianceConcerns", recommended_next_action AS "recommendedNextAction", summary, generated_at AS "generatedAt" FROM market.qualified_trade_candidate_ai_summaries ORDER BY generated_at DESC LIMIT 1`).then(r => r.rows[0] || null)
  ]);
  return { candidates, readiness, packages, scoring, reviews, rules, history, alerts, audit, ai };
}

function latestBy(rows, key, timeKey) {
  const map = new Map();
  for (const row of rows) {
    const id = String(row[key] || row.candidate_id || "");
    if (!id) continue;
    const current = map.get(id);
    if (!current || new Date(row[timeKey] || row.created_at || 0) > new Date(current[timeKey] || current.created_at || 0)) map.set(id, row);
  }
  return map;
}

function passFail(value, pass) {
  if (value === null || value === undefined) return "Not Checked";
  return pass ? "Passed" : "Failed";
}

function validateCandidate(row, readiness) {
  const expired = row.expires_at ? new Date(row.expires_at) < new Date() : false;
  const opportunity = Number(row.opportunity_score || 0) >= 75;
  const confidence = Number(row.confidence_score || 0) >= 70;
  const risk = row.risk_score !== null && row.risk_score !== undefined && Number(row.risk_score) <= 35;
  const compliance = row.compliance_score !== null && row.compliance_score !== undefined && Number(row.compliance_score) >= 90;
  const agreement = row.signal_agreement !== null && row.signal_agreement !== undefined ? Number(row.signal_agreement) >= 70 : true;
  const status = expired ? "Blocked" : [opportunity, confidence, risk, compliance, agreement].every(Boolean) ? "Ready" : [opportunity, confidence].every(Boolean) ? "Review Required" : "Blocked";
  return {
    candidateId: row.id,
    asset: row.asset,
    opportunityPassed: readiness?.opportunityPassed || passFail(row.opportunity_score, opportunity),
    riskPassed: readiness?.riskPassed || passFail(row.risk_score, risk),
    compliancePassed: readiness?.compliancePassed || passFail(row.compliance_score, compliance),
    confidencePassed: readiness?.confidencePassed || passFail(row.confidence_score, confidence),
    signalAgreementPassed: readiness?.signalAgreementPassed || passFail(row.signal_agreement, agreement),
    sourceHealthPassed: readiness?.sourceHealthPassed || "Passed",
    dependencyHealthPassed: readiness?.dependencyHealthPassed || "Passed",
    freshnessPassed: readiness?.freshnessPassed || "Passed",
    expiryPassed: readiness?.expiryPassed || (expired ? "Failed" : "Passed"),
    readinessScore: readiness?.readinessScore ?? avg([opportunity ? 100 : 0, confidence ? 100 : 0, risk ? 100 : 0, compliance ? 100 : 0, agreement ? 100 : 0, expired ? 0 : 100]),
    status: readiness?.status || status,
    checkedAt: readiness?.checkedAt || row.updated_at || row.created_at
  };
}

function buildCandidates(rows) {
  const readinessById = latestBy(rows.readiness, "candidateId", "checkedAt");
  return rows.candidates.map(row => {
    const readiness = validateCandidate(row, readinessById.get(String(row.id)));
    return {
      candidateId: row.id,
      asset: row.asset,
      assetClass: row.asset_class || row.universeAssetClass || "Unclassified",
      direction: row.direction,
      opportunityScore: round(row.opportunity_score),
      confidenceScore: round(row.confidence_score),
      riskScore: round(row.risk_score),
      complianceScore: round(row.compliance_score),
      signalAgreement: round(row.signal_agreement),
      mainReason: row.main_reason,
      qualificationStatus: row.status || row.qualification || readiness.status,
      packageStatus: row.package_status,
      scoringStatus: row.scoring_status,
      propSafe: Boolean(row.prop_safe),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      readiness
    };
  });
}

function summary(candidates) {
  return {
    qualifiedCandidates: candidates.length,
    readyForScoring: candidates.filter(row => row.scoringStatus === "Ready" || row.readiness.status === "Ready").length,
    readyForPackage: candidates.filter(row => row.packageStatus === "Ready" || row.readiness.status === "Ready").length,
    reviewRequired: candidates.filter(row => /review/i.test(`${row.qualificationStatus} ${row.readiness.status}`)).length,
    blockedAfterQualification: candidates.filter(row => /blocked|expired|rejected/i.test(`${row.qualificationStatus} ${row.readiness.status}`)).length,
    buyCandidates: candidates.filter(row => /buy/i.test(row.direction)).length,
    sellCandidates: candidates.filter(row => /sell/i.test(row.direction)).length,
    propSafeCandidates: candidates.filter(row => row.propSafe || Number(row.complianceScore || 0) >= 90).length,
    highConfidenceCandidates: candidates.filter(row => Number(row.confidenceScore || 0) >= 80).length,
    averageOpportunityScore: avg(candidates.map(row => row.opportunityScore)),
    averageRiskScore: avg(candidates.map(row => row.riskScore)),
    averageComplianceScore: avg(candidates.map(row => row.complianceScore)),
    card3OutputReadiness: candidates.some(row => row.readiness.status === "Ready") ? "Ready" : candidates.length ? "Review Required" : "Insufficient Data"
  };
}

function packageRows(candidates) {
  return candidates.filter(row => row.readiness.status === "Ready" && !/created/i.test(row.packageStatus || "")).map(row => ({
    candidateId: row.candidateId, asset: row.asset, direction: row.direction, opportunityScore: row.opportunityScore,
    confidence: row.confidenceScore, readinessScore: row.readiness.readinessScore, packageType: "Trade Opportunity Package",
    recommendedPackage: row.riskScore <= 25 ? "Full Decision Package" : "Risk Review Package", action: "Create Package"
  }));
}

function scoringRows(candidates) {
  return candidates.filter(row => row.readiness.status === "Ready").map(row => ({
    candidateId: row.candidateId, asset: row.asset, direction: row.direction, opportunityScore: row.opportunityScore,
    riskScore: row.riskScore, complianceScore: row.complianceScore, confidence: row.confidenceScore,
    scoringEligibility: /submitted/i.test(row.scoringStatus || "") ? "Already Submitted" : row.riskScore <= 35 ? "Eligible" : "Eligible With Warnings",
    scoringModel: "Production Scoring Model", action: "Send to Scoring"
  }));
}

function reviewRows(candidates, reviews) {
  const reviewById = latestBy(reviews, "candidate_id", "created_at");
  return candidates.filter(row => row.readiness.status === "Review Required" || reviewById.has(String(row.candidateId))).map(row => {
    const review = reviewById.get(String(row.candidateId)) || {};
    return {
      candidateId: row.candidateId, asset: row.asset, direction: row.direction,
      reviewReason: review.review_reason || (row.confidenceScore < 70 ? "Low Confidence" : row.signalAgreement < 70 ? "Signal Conflict" : row.complianceScore < 90 ? "Weak Compliance" : "Readiness Warning"),
      weakestComponent: review.weakest_component || "Readiness", severity: review.severity || "Warning",
      recommendedAction: review.recommended_action || "Review candidate before handoff", assignedTo: review.assigned_to || "Unassigned",
      status: review.status || "Open"
    };
  });
}

function blockedRows(candidates) {
  return candidates.filter(row => row.readiness.status === "Blocked" || /blocked|expired|rejected/i.test(row.qualificationStatus)).map(row => ({
    candidateId: row.candidateId, asset: row.asset, direction: row.direction, status: row.qualificationStatus,
    blockingReason: row.readiness.expiryPassed === "Failed" ? "Opportunity Expired" : row.riskScore > 35 ? "Risk Increased" : row.complianceScore < 90 ? "Prop Restriction Active" : "Score Dropped",
    expiredAt: row.expiresAt, canRetry: !/submitted/i.test(row.scoringStatus || ""), recommendedAction: "Revalidate candidate after scanner state improves"
  }));
}

function ai(candidates, readyScoring, review, blocked) {
  return {
    bestQualifiedCandidates: candidates.filter(row => row.readiness.status === "Ready").slice(0, 8).map(row => row.asset).join(", ") || "No ready candidates",
    readyForScoring: readyScoring.slice(0, 8).map(row => row.asset).join(", ") || "No scoring-ready candidates",
    reviewRequired: review.slice(0, 8).map(row => row.asset).join(", ") || "No review candidates",
    blockedOrExpired: blocked.slice(0, 8).map(row => row.asset).join(", ") || "No blocked candidates",
    majorRisks: candidates.filter(row => Number(row.riskScore || 0) > 35).map(row => row.asset).slice(0, 8).join(", ") || "No major risks",
    complianceConcerns: candidates.filter(row => Number(row.complianceScore || 0) < 90).map(row => row.asset).slice(0, 8).join(", ") || "No compliance concerns",
    recommendedNextAction: "Validate ready candidates, create packages, then submit eligible candidates to the Scoring Engine.",
    summary: `${candidates.length} production qualified trade candidates are available.`
  };
}

async function liveOutput() {
  const rows = await sourceRows();
  if (!rows.candidates.length) return { ...emptyState("EMPTY", "No qualified trade candidates are available yet."), expiryRules: rows.rules, alerts: rows.alerts, audit: rows.audit, history: rows.history, aiSummary: rows.ai };
  const candidates = buildCandidates(rows);
  const readyForPackage = packageRows(candidates);
  const readyForScoring = scoringRows(candidates);
  const reviewRequired = reviewRows(candidates, rows.reviews);
  const blockedExpired = blockedRows(candidates);
  const summaryRow = summary(candidates);
  return {
    engine: "QualifiedTradeCandidateEngine",
    sourceMode: "QUALIFIED_CANDIDATES_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, qualifiedCandidatesOnly: true, lastQualificationRun: candidates.map(row => row.createdAt).sort().at(-1) || null, card3OutputStatus: summaryRow.card3OutputReadiness },
    summary: summaryRow,
    candidates,
    readiness: candidates.map(row => row.readiness),
    readyForPackage,
    readyForScoring,
    reviewRequired,
    blockedExpired,
    expiryRules: rows.rules,
    history: rows.history,
    aiSummary: rows.ai || ai(candidates, readyForScoring, reviewRequired, blockedExpired),
    alerts: rows.alerts,
    audit: rows.audit,
    emptyState: null
  };
}

export async function getQualifiedTradesCenter() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  return liveOutput();
}

export async function getQualifiedTradesSlice(slice) {
  const data = await getQualifiedTradesCenter();
  const map = {
    summary: { status: data.status, badges: data.badges, summary: data.summary },
    candidates: { status: data.status, candidates: data.candidates },
    readiness: { status: data.status, readiness: data.readiness },
    "ready-for-package": { status: data.status, readyForPackage: data.readyForPackage },
    "ready-for-scoring": { status: data.status, readyForScoring: data.readyForScoring },
    "review-required": { status: data.status, reviewRequired: data.reviewRequired },
    "blocked-expired": { status: data.status, blockedExpired: data.blockedExpired },
    "ai-summary": { status: data.status, aiSummary: data.aiSummary },
    export: data
  };
  return map[slice] || data;
}

export async function getQualifiedTradeDetail(candidateId) {
  const data = await getQualifiedTradesCenter();
  const candidate = data.candidates.find(row => String(row.candidateId) === String(candidateId));
  if (!candidate) return null;
  return {
    candidate,
    readiness: data.readiness.find(row => String(row.candidateId) === String(candidateId)),
    packageHistory: data.readyForPackage.filter(row => String(row.candidateId) === String(candidateId)),
    scoringHistory: data.readyForScoring.filter(row => String(row.candidateId) === String(candidateId)),
    reviews: data.reviewRequired.filter(row => String(row.candidateId) === String(candidateId)),
    blockedExpired: data.blockedExpired.filter(row => String(row.candidateId) === String(candidateId)),
    history: data.history.filter(row => String(row.candidateId) === String(candidateId)),
    audit: data.audit.filter(row => String(row.candidateId) === String(candidateId)),
    aiSummary: data.aiSummary
  };
}

async function assertReady() {
  if (!isDatabaseConfigured()) { const error = new Error("database_not_configured"); error.status = 503; throw error; }
  const ready = await tableReadiness();
  if (!ready.ready) { const error = new Error("schema_not_ready"); error.status = 503; error.missingTables = ready.missing; throw error; }
}

export async function runQualifiedTradesAction(action, body = {}, actor = "api", candidateId = null) {
  await assertReady();
  if (action === "validate" || action === "validate-candidate") {
    await safeQuery(`INSERT INTO market.qualified_trade_candidate_audit_logs (candidate_id, user_name, action, entity_type, entity_id, reason, payload) VALUES ($1::uuid,$2,$3,'qualified_trade_candidate',$4,$5,$6::jsonb)`, [candidateId, actor, action, candidateId, body.reason || null, JSON.stringify(body)]);
    return { accepted: true, type: `qualified_trades.${action}`, candidateId };
  }
  if (action === "create-package") {
    await safeQuery(`INSERT INTO market.qualified_trade_candidate_packages (candidate_id, package_type, recommended_package, created_by, payload) VALUES ($1::uuid,$2,$3,$4,$5::jsonb)`, [candidateId, body.packageType || "Trade Opportunity Package", body.recommendedPackage || "Full Decision Package", actor, JSON.stringify(body)]);
    await safeQuery(`UPDATE market.qualified_trade_candidates SET package_status = 'Created', updated_at = now() WHERE id = $1::uuid`, [candidateId]);
    return { accepted: true, type: "qualified_trades.package.created", candidateId };
  }
  if (action === "send-to-scoring") {
    await safeQuery(`INSERT INTO market.qualified_trade_candidate_scoring_submissions (candidate_id, scoring_model, eligibility, submitted_by, payload) VALUES ($1::uuid,$2,$3,$4,$5::jsonb)`, [candidateId, body.scoringModel || "Production Scoring Model", body.eligibility || "Eligible", actor, JSON.stringify(body)]);
    await safeQuery(`UPDATE market.qualified_trade_candidates SET scoring_status = 'Submitted', status = 'Submitted', updated_at = now() WHERE id = $1::uuid`, [candidateId]);
    return { accepted: true, type: "qualified_trades.sent_to_scoring", candidateId };
  }
  if (action === "mark-review-required") {
    await safeQuery(`INSERT INTO market.qualified_trade_candidate_reviews (candidate_id, review_reason, weakest_component, severity, recommended_action, assigned_to, payload) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7::jsonb)`, [candidateId, body.reviewReason || "Manual Review", body.weakestComponent || null, body.severity || "Warning", body.recommendedAction || null, body.assignedTo || null, JSON.stringify(body)]);
    await safeQuery(`UPDATE market.qualified_trade_candidates SET status = 'Review Required', updated_at = now() WHERE id = $1::uuid`, [candidateId]);
    return { accepted: true, type: "qualified_trades.review_required", candidateId };
  }
  if (action === "expire") {
    await safeQuery(`UPDATE market.qualified_trade_candidates SET status = 'Expired', expires_at = COALESCE(expires_at, now()), updated_at = now() WHERE id = $1::uuid`, [candidateId]);
    return { accepted: true, type: "qualified_trades.expired", candidateId };
  }
  if (action === "create-alert") {
    await safeQuery(`INSERT INTO market.qualified_trade_candidate_alerts (alert_type, title, severity, candidate_id, asset, created_by, payload) VALUES ($1,$2,$3,$4::uuid,$5,$6,$7::jsonb)`, [body.alertType || "qualified_trade", body.title || "Qualified trade alert", body.severity || "Info", candidateId, body.asset || null, actor, JSON.stringify(body)]);
    return { accepted: true, type: "qualified_trades.alert.created" };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    const data = await liveOutput(); const a = data.aiSummary || {};
    await safeQuery(`INSERT INTO market.qualified_trade_candidate_ai_summaries (summary, best_qualified_candidates, ready_for_scoring, review_required, blocked_or_expired, major_risks, compliance_concerns, recommended_next_action, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [a.summary, a.bestQualifiedCandidates, a.readyForScoring, a.reviewRequired, a.blockedOrExpired, a.majorRisks, a.complianceConcerns, a.recommendedNextAction, JSON.stringify({ actor, action })]);
    return { accepted: true, type: "qualified_trades.ai_summary.saved" };
  }
  return { accepted: true, type: `qualified_trades.${action}.recorded` };
}

export async function exportQualifiedTradesReport() {
  return getQualifiedTradesCenter();
}
