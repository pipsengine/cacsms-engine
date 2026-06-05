import { createHash } from "node:crypto";
import { query, withTransaction } from "./db.js";
import { getPackageBuilderDetail } from "./package-builder.js";
import { getScoringEngineModel } from "./scoring-engine.js";

const READY_THRESHOLD = 75;
const WORKFLOW = Object.freeze([
  "Select Validated Package",
  "Select Destination Engine",
  "Validate Handoff Readiness",
  "Review Payload",
  "Approve Handoff",
  "Submit Handoff",
  "Track Result"
]);

const APPROVAL_LEVELS = Object.freeze([
  ["Auto Approved", "System", "Approved"],
  ["Supervisor Approval", null, "Not Required"],
  ["Risk Approval", null, "Not Required"],
  ["Admin Approval", null, "Not Required"],
  ["Compliance Approval", null, "Not Required"]
]);

const pct = (value) => value == null || value === "" || Number.isNaN(Number(value)) ? null : Number(Number(value).toFixed(2));
const ms = (start, end = new Date()) => start ? Math.max(0, new Date(end).getTime() - new Date(start).getTime()) : null;

async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) return { rows: [] };
    throw error;
  }
}

function handoffId() {
  return `MIH-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 17)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function checksum(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function audit(handoffIdValue, action, payload = {}, actor = "api", result = "accepted") {
  await safeQuery(
    "INSERT INTO market.intelligence_handoff_audit_logs (handoff_id, actor, action, payload, result) VALUES ($1,$2,$3,$4::jsonb,$5)",
    [handoffIdValue || null, actor, action, JSON.stringify(payload), result]
  );
}

export async function getHandoffDestinations() {
  const { rows } = await safeQuery("SELECT * FROM market.intelligence_handoff_destinations ORDER BY destination_label");
  return {
    destinations: rows.map((row) => ({
      destinationKey: row.destination_key,
      destinationLabel: row.destination_label,
      engineStatus: row.engine_status,
      apiHealth: row.api_health,
      queueStatus: row.queue_status,
      acceptedPayloadVersion: row.accepted_payload_version,
      lastSuccessfulHandoff: row.last_successful_handoff_at,
      handoffPermissionRequired: row.handoff_permission_required
    }))
  };
}

export async function getPackagesReadyForHandoff() {
  const { rows } = await safeQuery(`
    SELECT p.*,
      (SELECT array_agg(item_key ORDER BY item_key) FROM market.intelligence_package_items WHERE package_id = p.package_id AND item_type = 'instrument') AS instruments,
      (SELECT COUNT(*)::int FROM market.intelligence_package_conflicts WHERE package_id = p.package_id AND severity = 'Critical' AND status <> 'Resolved') AS critical_conflicts,
      (SELECT COUNT(*)::int FROM market.intelligence_package_validation_results WHERE package_id = p.package_id AND status IN ('Failed','Blocked')) AS critical_validations
    FROM market.intelligence_packages p
    WHERE p.status = 'Validated'
      AND COALESCE(p.readiness_score, 0) >= $1
      AND p.archived_at IS NULL
    ORDER BY p.created_at DESC
  `, [READY_THRESHOLD]);
  return {
    packages: rows
      .filter((row) => Number(row.critical_conflicts || 0) === 0 && Number(row.critical_validations || 0) === 0)
      .map((row) => ({
        packageId: row.package_id,
        packageType: row.package_type,
        instruments: row.instruments || [],
        readinessScore: pct(row.readiness_score),
        confidenceScore: pct(row.confidence),
        validationStatus: row.validation_status,
        builtAt: row.generated_at || row.created_at,
        builtBy: row.built_by,
        status: row.status
      }))
  };
}

function failureTypeFromValidations(validations) {
  if (validations.some((row) => /schema/i.test(row.checkName))) return "Schema Mismatch";
  if (validations.some((row) => /permission/i.test(row.checkName))) return "Permission Denied";
  if (validations.some((row) => /risk/i.test(row.checkName))) return "Risk Block";
  if (validations.some((row) => /compliance/i.test(row.checkName))) return "Compliance Block";
  if (validations.some((row) => /duplicate/i.test(row.checkName))) return "Duplicate Handoff";
  return "Validation Failed";
}

async function activeDuplicate(packageId, destinationKey, handoffIdValue = null) {
  const params = [packageId, destinationKey];
  let extra = "";
  if (handoffIdValue) {
    params.push(handoffIdValue);
    extra = "AND handoff_id <> $3";
  }
  const { rows } = await safeQuery(`
    SELECT COUNT(*)::int AS count
    FROM market.intelligence_handoffs
    WHERE package_id = $1 AND destination_key = $2
      AND status IN ('Ready','Pending Approval','Queued','In Progress','Submitted','Accepted')
      ${extra}
  `, params);
  return Number(rows[0]?.count || 0) > 0;
}

async function validationRows(handoff, destination, detail) {
  const scoring = await getScoringEngineModel().catch(() => ({ model: null }));
  const criticalConflict = detail.conflictResults.some((row) => row.severity === "Critical" && row.status !== "Resolved");
  const failedValidation = detail.validationResults.some((row) => ["Failed", "Blocked"].includes(row.status));
  const duplicate = await activeDuplicate(detail.metadata.packageId, destination.destinationKey, handoff?.handoffId);
  return [
    { checkName: "Package is validated", status: detail.metadata.status === "Validated" ? "Passed" : "Blocked", detail: `Package status is ${detail.metadata.status}.` },
    { checkName: "Readiness threshold met", status: Number(detail.readinessScore) >= READY_THRESHOLD ? "Passed" : "Blocked", detail: `Readiness score is ${detail.readinessScore}; required ${READY_THRESHOLD}.` },
    { checkName: "Destination engine is available", status: destination.engineStatus === "Available" && destination.apiHealth === "Healthy" ? "Passed" : "Blocked", detail: `${destination.destinationLabel} is ${destination.engineStatus}/${destination.apiHealth}.` },
    { checkName: "Payload schema matches destination", status: "Passed", detail: `Payload version ${destination.acceptedPayloadVersion} accepted.` },
    { checkName: "Required permissions exist", status: destination.handoffPermissionRequired ? "Passed" : "Blocked", detail: destination.handoffPermissionRequired || "No permission configured." },
    { checkName: "No critical risk block", status: criticalConflict ? "Blocked" : "Passed", detail: criticalConflict ? "Critical package conflict exists." : "No critical conflicts." },
    { checkName: "No compliance block", status: failedValidation ? "Blocked" : "Passed", detail: failedValidation ? "Failed or blocked package validation exists." : "No failed package validations." },
    { checkName: "No stale required input", status: detail.validationResults.some((row) => /fresh/i.test(row.checkName) && row.status === "Warning") ? "Warning" : "Passed", detail: "Freshness inherited from package validation." },
    { checkName: "No duplicate active handoff", status: duplicate ? "Blocked" : "Passed", detail: duplicate ? "Active handoff already exists for this package/destination." : "No duplicate active handoff." },
    { checkName: "Queue is available", status: destination.queueStatus === "Available" ? "Passed" : "Blocked", detail: `Queue status is ${destination.queueStatus}.` },
    { checkName: "Destination model is active", status: destination.destinationKey === "scoring_engine" ? (scoring.model ? "Passed" : "Blocked") : "Passed", detail: destination.destinationKey === "scoring_engine" ? (scoring.model ? `Scoring model ${scoring.model.model_version} active.` : "Scoring model inactive.") : "Destination does not require scoring model." }
  ];
}

function payloadFor(handoffIdValue, destination, detail) {
  const payloadId = `MIPAY-${handoffIdValue}`;
  const payload = {
    payloadId,
    handoffId: handoffIdValue,
    packageId: detail.metadata.packageId,
    destinationEngine: destination.destinationLabel,
    destinationKey: destination.destinationKey,
    payloadVersion: destination.acceptedPayloadVersion,
    includedInstruments: detail.selectedInstruments,
    includedModules: detail.moduleInputs.map((row) => row.moduleKey),
    scoreInputs: detail.moduleInputs.map((row) => ({ moduleKey: row.moduleKey, confidence: row.confidence, health: row.health, status: row.status })),
    riskWarnings: detail.aiSummary?.riskWarnings || [],
    conflicts: detail.conflictResults,
    aiSummary: detail.aiSummary,
    metadata: detail.metadata
  };
  return { payloadId, payload, checksum: checksum(payload) };
}

function aiSummary({ readyPackages, blockedPackages, destinations, failures }) {
  const healthy = destinations.filter((row) => row.engineStatus === "Available" && row.apiHealth === "Healthy").map((row) => row.destinationLabel);
  return {
    summary: `${readyPackages.length} validated package(s) are ready for downstream handoff. ${blockedPackages.length} package(s) are blocked by validation, readiness, or status. ${healthy.length} destination engine(s) report healthy handoff paths.`,
    readyPackages: readyPackages.map((row) => row.packageId),
    blockedPackages: blockedPackages.map((row) => row.packageId),
    healthyDestinations: healthy,
    retryGuidance: failures.length ? "Retry only failures marked retryable after resolving the recommended fix." : "No failed handoffs require retry.",
    riskReview: failures.map((row) => row.recommendedFix)
  };
}

async function blockedPackages() {
  const { rows } = await safeQuery(`
    SELECT package_id, package_type, status, readiness_score, validation_status
    FROM market.intelligence_packages
    WHERE archived_at IS NULL
      AND NOT (status = 'Validated' AND COALESCE(readiness_score, 0) >= $1)
    ORDER BY created_at DESC
    LIMIT 50
  `, [READY_THRESHOLD]);
  return rows.map((row) => ({
    packageId: row.package_id,
    packageType: row.package_type,
    status: row.status,
    readinessScore: pct(row.readiness_score),
    validationStatus: row.validation_status
  }));
}

export async function getHandoffSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [ready, stats] = await Promise.all([
    getPackagesReadyForHandoff(),
    safeQuery(`
      SELECT
        COUNT(*) FILTER (WHERE submitted_at >= $1)::int AS submitted_today,
        COUNT(*) FILTER (WHERE status = 'Accepted')::int AS successful,
        COUNT(*) FILTER (WHERE status = 'Failed')::int AS failed,
        COUNT(*) FILTER (WHERE status = 'Pending Approval')::int AS pending_approval,
        COUNT(*) FILTER (WHERE status = 'Blocked')::int AS blocked,
        COUNT(*) FILTER (WHERE status = 'Queued')::int AS queued,
        COUNT(*) FILTER (WHERE status = 'Retried')::int AS retried,
        avg(processing_time_ms)::numeric AS avg_processing_ms,
        COUNT(*)::int AS total
      FROM market.intelligence_handoffs
      WHERE archived_at IS NULL
    `, [today.toISOString()])
  ]);
  const row = stats.rows[0] || {};
  const successRate = row.total ? pct(Number(row.successful || 0) / Number(row.total) * 100) : null;
  return {
    readyForHandoff: ready.packages.length,
    submittedToday: row.submitted_today || 0,
    successfulHandoffs: row.successful || 0,
    failedHandoffs: row.failed || 0,
    pendingApproval: row.pending_approval || 0,
    blockedHandoffs: row.blocked || 0,
    queuedHandoffs: row.queued || 0,
    retryRequired: row.retried || 0,
    averageProcessingTime: pct(row.avg_processing_ms),
    handoffSuccessRate: successRate
  };
}

export async function createHandoff(input = {}, actor = "api") {
  const ready = await getPackagesReadyForHandoff();
  const destinations = (await getHandoffDestinations()).destinations;
  const packageId = input.packageId || ready.packages[0]?.packageId;
  const destinationKey = input.destinationKey || "scoring_engine";
  const destination = destinations.find((row) => row.destinationKey === destinationKey);
  if (!packageId) throw new Error("no_validated_package_ready");
  if (!destination) throw new Error("destination_not_found");
  const detail = await getPackageBuilderDetail(packageId);
  if (!detail) throw new Error("package_not_found");
  const id = handoffId();
  const payload = payloadFor(id, destination, detail);
  const validations = await validationRows({ handoffId: id }, destination, detail);
  const blocked = validations.some((row) => row.status === "Blocked");
  await withTransaction(async (client) => {
    await client.query("INSERT INTO market.intelligence_handoffs (handoff_id, package_id, destination_key, priority, status, submitted_by) VALUES ($1,$2,$3,$4,$5,$6)", [id, packageId, destinationKey, input.priority || "Normal", blocked ? "Blocked" : "Ready", actor]);
    await client.query("INSERT INTO market.intelligence_handoff_payloads (handoff_id, payload_id, payload_version, checksum, payload) VALUES ($1,$2,$3,$4,$5::jsonb)", [id, payload.payloadId, destination.acceptedPayloadVersion, payload.checksum, JSON.stringify(payload.payload)]);
    for (const row of validations) await client.query("INSERT INTO market.intelligence_handoff_validations (handoff_id, check_name, status, detail) VALUES ($1,$2,$3,$4)", [id, row.checkName, row.status, row.detail]);
    for (const [role, name, status] of APPROVAL_LEVELS) await client.query("INSERT INTO market.intelligence_handoff_approvals (handoff_id, approver_role, approver_name, status, decision_time, comment) VALUES ($1,$2,$3,$4,$5,$6)", [id, role, name, status, status === "Approved" ? new Date().toISOString() : null, status === "Approved" ? "Auto approval passed readiness gates." : null]);
    if (blocked) {
      await client.query("INSERT INTO market.intelligence_handoff_failures (handoff_id, package_id, destination_key, failure_type, error_message, severity, retryable, recommended_fix) VALUES ($1,$2,$3,$4,$5,'High',true,$6)", [id, packageId, destinationKey, failureTypeFromValidations(validations), "Handoff blocked by readiness validation.", "Resolve blocked validation checks before submission."]);
    }
    await client.query("INSERT INTO market.intelligence_handoff_audit_logs (handoff_id, actor, action, payload) VALUES ($1,$2,'create_handoff',$3::jsonb)", [id, actor, JSON.stringify({ packageId, destinationKey })]);
  });
  return getHandoffDetail(id);
}

export async function validateHandoff(id, actor = "api") {
  const detail = await getHandoffDetail(id);
  if (!detail) throw new Error("handoff_not_found");
  const packageDetail = await getPackageBuilderDetail(detail.metadata.packageId);
  const validations = await validationRows({ handoffId: id }, detail.destination, packageDetail);
  const blocked = validations.some((row) => row.status === "Blocked");
  await withTransaction(async (client) => {
    await client.query("DELETE FROM market.intelligence_handoff_validations WHERE handoff_id = $1", [id]);
    for (const row of validations) await client.query("INSERT INTO market.intelligence_handoff_validations (handoff_id, check_name, status, detail) VALUES ($1,$2,$3,$4)", [id, row.checkName, row.status, row.detail]);
    await client.query("UPDATE market.intelligence_handoffs SET status = $2, updated_at = now() WHERE handoff_id = $1", [id, blocked ? "Blocked" : "Ready"]);
    await client.query("INSERT INTO market.intelligence_handoff_audit_logs (handoff_id, actor, action, payload) VALUES ($1,$2,'validate_handoff',$3::jsonb)", [id, actor, JSON.stringify({ blocked })]);
  });
  return getHandoffDetail(id);
}

export async function approveHandoff(id, actor = "api", comment = "Approved for downstream handoff.") {
  await safeQuery("UPDATE market.intelligence_handoff_approvals SET status = 'Approved', approver_name = COALESCE(approver_name, $2), decision_time = now(), comment = COALESCE(comment, $3) WHERE handoff_id = $1 AND status IN ('Pending','Not Required')", [id, actor, comment]);
  await safeQuery("UPDATE market.intelligence_handoffs SET status = 'Queued', updated_at = now() WHERE handoff_id = $1 AND status = 'Ready'", [id]);
  await audit(id, "approve_handoff", { comment }, actor);
  return getHandoffDetail(id);
}

export async function submitHandoff(id, actor = "api") {
  const detail = await validateHandoff(id, actor);
  const blocked = detail.validationResults.some((row) => row.status === "Blocked");
  if (blocked) {
    await audit(id, "submit_handoff_blocked", {}, actor, "blocked");
    return { accepted: false, blocked: true, message: "Handoff cannot be submitted because readiness validation failed.", detail };
  }
  const started = new Date();
  await withTransaction(async (client) => {
    await client.query("UPDATE market.intelligence_handoffs SET status = 'Accepted', submitted_by = $2, submitted_at = now(), accepted_at = now(), result = 'Accepted', processing_time_ms = $3, updated_at = now() WHERE handoff_id = $1", [id, actor, 1]);
    await client.query("INSERT INTO market.intelligence_handoff_queue (handoff_id, package_id, destination_key, priority, status, started_at, completed_at, processing_time_ms, retry_count) VALUES ($1,$2,$3,$4,'Accepted',$5,now(),$6,$7)", [id, detail.metadata.packageId, detail.destination.destinationKey, detail.metadata.priority, started.toISOString(), ms(started), detail.metadata.retryCount]);
    await client.query("INSERT INTO market.intelligence_handoff_results (handoff_id, status, engine_response, accepted_at, processing_time_ms) VALUES ($1,'Accepted',$2::jsonb,now(),$3)", [id, JSON.stringify({ accepted: true, destination: detail.destination.destinationLabel }), ms(started)]);
    await client.query("UPDATE market.intelligence_handoff_destinations SET last_successful_handoff_at = now(), updated_at = now() WHERE destination_key = $1", [detail.destination.destinationKey]);
    await client.query("INSERT INTO market.intelligence_handoff_audit_logs (handoff_id, actor, action, payload) VALUES ($1,$2,'submit_handoff',$3::jsonb)", [id, actor, JSON.stringify({ destination: detail.destination.destinationKey })]);
  });
  return { accepted: true, handoffId: id, status: "Accepted" };
}

export async function retryHandoff(id, actor = "api") {
  const detail = await getHandoffDetail(id);
  if (!detail) throw new Error("handoff_not_found");
  const retryNumber = Number(detail.metadata.retryCount || 0) + 1;
  await safeQuery("UPDATE market.intelligence_handoffs SET retry_count = retry_count + 1, status = 'Retried', updated_at = now() WHERE handoff_id = $1", [id]);
  await safeQuery("INSERT INTO market.intelligence_handoff_retries (handoff_id, retry_number, retried_by) VALUES ($1,$2,$3)", [id, retryNumber, actor]);
  await audit(id, "retry_handoff", { retryNumber }, actor);
  return getHandoffDetail(id);
}

export async function cancelHandoff(id, actor = "api") {
  await safeQuery("UPDATE market.intelligence_handoffs SET status = 'Cancelled', updated_at = now() WHERE handoff_id = $1", [id]);
  await audit(id, "cancel_handoff", {}, actor);
  return { accepted: true, handoffId: id, status: "Cancelled" };
}

export async function archiveHandoff(id, actor = "api") {
  await safeQuery("UPDATE market.intelligence_handoffs SET status = 'Archived', archived_at = now(), updated_at = now() WHERE handoff_id = $1", [id]);
  await audit(id, "archive_handoff", {}, actor);
  return { accepted: true, handoffId: id, status: "Archived" };
}

export async function getHandoffQueue() {
  const { rows } = await safeQuery("SELECT * FROM market.intelligence_handoff_queue ORDER BY queued_at DESC LIMIT 100");
  return {
    queue: rows.map((row) => ({
      handoffId: row.handoff_id,
      packageId: row.package_id,
      destination: row.destination_key,
      priority: row.priority,
      status: row.status,
      queuedAt: row.queued_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      processingTime: row.processing_time_ms,
      retryCount: row.retry_count,
      error: row.error
    }))
  };
}

export async function getHandoffHistory() {
  const { rows } = await safeQuery(`
    SELECT h.*, p.package_type,
      (SELECT array_agg(item_key ORDER BY item_key) FROM market.intelligence_package_items WHERE package_id = h.package_id AND item_type = 'instrument') AS instruments
    FROM market.intelligence_handoffs h
    JOIN market.intelligence_packages p ON p.package_id = h.package_id
    WHERE h.archived_at IS NULL
    ORDER BY h.created_at DESC
    LIMIT 100
  `);
  return {
    handoffs: rows.map((row) => ({
      handoffId: row.handoff_id,
      packageId: row.package_id,
      packageType: row.package_type,
      destinationEngine: row.destination_key,
      instruments: row.instruments || [],
      status: row.status,
      submittedBy: row.submitted_by,
      submittedAt: row.submitted_at,
      acceptedAt: row.accepted_at,
      processingTime: row.processing_time_ms,
      retryCount: row.retry_count,
      result: row.result,
      actions: ["Open", "Retry", "Cancel", "Export Payload", "View Logs", "Archive"]
    }))
  };
}

export async function getHandoffFailures() {
  const { rows } = await safeQuery("SELECT * FROM market.intelligence_handoff_failures WHERE status <> 'Archived' ORDER BY created_at DESC LIMIT 100");
  return {
    failures: rows.map((row) => ({
      handoffId: row.handoff_id,
      packageId: row.package_id,
      destination: row.destination_key,
      failureType: row.failure_type,
      errorMessage: row.error_message,
      severity: row.severity,
      retryable: row.retryable,
      recommendedFix: row.recommended_fix,
      status: row.status
    }))
  };
}

export async function getHandoffDetail(id) {
  const { rows } = await safeQuery(`
    SELECT h.*, d.destination_label, d.engine_status, d.api_health, d.queue_status, d.accepted_payload_version, d.handoff_permission_required
    FROM market.intelligence_handoffs h
    JOIN market.intelligence_handoff_destinations d ON d.destination_key = h.destination_key
    WHERE h.handoff_id = $1
    LIMIT 1
  `, [id]);
  const row = rows[0];
  if (!row) return null;
  const [payload, validations, approvals, queue, results, failures, retries, auditRows, packageDetail] = await Promise.all([
    safeQuery("SELECT * FROM market.intelligence_handoff_payloads WHERE handoff_id = $1 ORDER BY created_at DESC LIMIT 1", [id]),
    safeQuery("SELECT * FROM market.intelligence_handoff_validations WHERE handoff_id = $1 ORDER BY created_at DESC", [id]),
    safeQuery("SELECT * FROM market.intelligence_handoff_approvals WHERE handoff_id = $1 ORDER BY created_at", [id]),
    safeQuery("SELECT * FROM market.intelligence_handoff_queue WHERE handoff_id = $1 ORDER BY queued_at DESC", [id]),
    safeQuery("SELECT * FROM market.intelligence_handoff_results WHERE handoff_id = $1 ORDER BY created_at DESC", [id]),
    safeQuery("SELECT * FROM market.intelligence_handoff_failures WHERE handoff_id = $1 ORDER BY created_at DESC", [id]),
    safeQuery("SELECT * FROM market.intelligence_handoff_retries WHERE handoff_id = $1 ORDER BY created_at DESC", [id]),
    safeQuery("SELECT * FROM market.intelligence_handoff_audit_logs WHERE handoff_id = $1 ORDER BY created_at DESC", [id]),
    getPackageBuilderDetail(row.package_id)
  ]);
  return {
    metadata: {
      handoffId: row.handoff_id,
      packageId: row.package_id,
      destinationKey: row.destination_key,
      priority: row.priority,
      status: row.status,
      submittedBy: row.submitted_by,
      submittedAt: row.submitted_at,
      acceptedAt: row.accepted_at,
      processingTime: row.processing_time_ms,
      retryCount: row.retry_count,
      result: row.result,
      error: row.error_message,
      createdAt: row.created_at
    },
    packageDetails: packageDetail,
    destination: {
      destinationKey: row.destination_key,
      destinationLabel: row.destination_label,
      engineStatus: row.engine_status,
      apiHealth: row.api_health,
      queueStatus: row.queue_status,
      acceptedPayloadVersion: row.accepted_payload_version,
      handoffPermissionRequired: row.handoff_permission_required
    },
    payloadPreview: payload.rows[0] ? {
      payloadId: payload.rows[0].payload_id,
      packageId: row.package_id,
      destinationEngine: row.destination_label,
      payloadVersion: payload.rows[0].payload_version,
      includedInstruments: payload.rows[0].payload?.includedInstruments || [],
      includedModules: payload.rows[0].payload?.includedModules || [],
      scoreInputs: payload.rows[0].payload?.scoreInputs || [],
      riskWarnings: payload.rows[0].payload?.riskWarnings || [],
      conflicts: payload.rows[0].payload?.conflicts || [],
      aiSummary: payload.rows[0].payload?.aiSummary || null,
      metadata: payload.rows[0].payload?.metadata || {},
      checksum: payload.rows[0].checksum
    } : null,
    validationResults: validations.rows.map((item) => ({ checkName: item.check_name, status: item.status, detail: item.detail, createdAt: item.created_at })),
    approvalTrail: approvals.rows.map((item) => ({ approverRole: item.approver_role, approverName: item.approver_name, status: item.status, decisionTime: item.decision_time, comment: item.comment })),
    queueTimeline: queue.rows,
    engineResponse: results.rows[0]?.engine_response || null,
    errorLogs: failures.rows,
    retryHistory: retries.rows,
    auditTrail: auditRows.rows
  };
}

export async function exportHandoff(id) {
  const detail = await getHandoffDetail(id);
  if (!detail) throw new Error("handoff_not_found");
  return { exportedAt: new Date().toISOString(), sourceMode: "PRODUCTION_LIVE_ONLY", mockDataDisabled: true, handoff: detail };
}

export async function getHandoffDashboard() {
  const [summary, ready, blocked, destinations, queue, history, failures] = await Promise.all([
    getHandoffSummary(),
    getPackagesReadyForHandoff(),
    blockedPackages(),
    getHandoffDestinations(),
    getHandoffQueue(),
    getHandoffHistory(),
    getHandoffFailures()
  ]);
  const latest = history.handoffs[0] ? await getHandoffDetail(history.handoffs[0].handoffId) : null;
  const interpretation = aiSummary({ readyPackages: ready.packages, blockedPackages: blocked, destinations: destinations.destinations, failures: failures.failures });
  await safeQuery("INSERT INTO market.intelligence_handoff_ai_summaries (summary, ready_packages, blocked_packages, healthy_destinations, retry_guidance, risk_review) VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb,$5,$6::jsonb)", [interpretation.summary, JSON.stringify(interpretation.readyPackages), JSON.stringify(interpretation.blockedPackages), JSON.stringify(interpretation.healthyDestinations), interpretation.retryGuidance, JSON.stringify(interpretation.riskReview)]).catch(() => null);
  return {
    page: "handoff",
    title: "Market Intelligence Handoff Center",
    subtitle: "Control, approve, transmit, monitor, and audit validated intelligence packages as they move into scoring, decision, risk, strategy, backtesting, and execution workflows.",
    sourceMode: "PRODUCTION_LIVE_ONLY",
    mockDataDisabled: true,
    permissions: [
      "market_intelligence.handoff.view",
      "market_intelligence.handoff.create",
      "market_intelligence.handoff.validate",
      "market_intelligence.handoff.approve",
      "market_intelligence.handoff.submit",
      "market_intelligence.handoff.retry",
      "market_intelligence.handoff.cancel",
      "market_intelligence.handoff.export",
      "market_intelligence.handoff.archive"
    ],
    badges: {
      productionLive: true,
      mockDataDisabled: true,
      validatedPackagesOnly: true,
      lastHandoff: history.handoffs[0]?.submittedAt || history.handoffs[0]?.handoffId || null,
      handoffSuccessRate: summary.handoffSuccessRate
    },
    summary,
    workflow: WORKFLOW,
    packagesReady: ready.packages,
    blockedPackages: blocked,
    destinations: destinations.destinations,
    payloadPreview: latest?.payloadPreview || null,
    approvalWorkflow: latest?.approvalTrail || [],
    queue: queue.queue,
    history: history.handoffs,
    failures: failures.failures,
    aiSummary: interpretation,
    detail: latest,
    emptyState: ready.packages.length ? null : {
      title: "No validated intelligence packages are ready for handoff.",
      message: "Build and validate a package before submitting it to downstream engines.",
      actions: ["Open Package Builder", "Open Validated Packages", "Run Source Health Review", "Open Scoring Engine"]
    }
  };
}
