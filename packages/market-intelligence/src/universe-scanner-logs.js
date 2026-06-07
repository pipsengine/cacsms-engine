import { isDatabaseConfigured, query, withTransaction } from "./db.js";

export const UNIVERSE_SCANNER_LOG_TABLES = Object.freeze([
  "market.scanner_logs",
  "market.scanner_audit_logs",
  "market.scanner_job_logs",
  "market.scanner_worker_logs",
  "market.scanner_queue_logs",
  "market.scanner_error_logs",
  "market.scanner_module_logs",
  "market.scanner_incidents",
  "market.scanner_log_timeline",
  "market.scanner_log_metrics",
  "market.scanner_log_exports",
  "market.scanner_log_retention"
]);

const permissions = () => ({
  view: "universe_scanner.logs.view",
  viewSensitive: "universe_scanner.logs.view_sensitive",
  export: "universe_scanner.logs.export",
  acknowledge: "universe_scanner.logs.acknowledge",
  resolve: "universe_scanner.logs.resolve",
  createIncident: "universe_scanner.logs.create_incident",
  archive: "universe_scanner.logs.archive",
  viewAudit: "universe_scanner.logs.view_audit"
});

async function safeQuery(sql, params = []) {
  try { return await query(sql, params); }
  catch (error) {
    if (["42P01", "42703", "42883"].includes(error.code)) return { rows: [] };
    throw error;
  }
}

async function tableReadiness() {
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [UNIVERSE_SCANNER_LOG_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "UniverseScannerLogsEngine",
    sourceMode: "PRODUCTION_LOGS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, auditLoggingActive: true, lastLogReceived: null, criticalErrorsToday: 0 },
    summary: {
      totalLogsToday: 0, successfulEvents: 0, warnings: 0, errors: 0, criticalErrors: 0, scanEvents: 0,
      workerEvents: 0, queueEvents: 0, opportunityEvents: 0, qualificationEvents: 0, aiGenerationEvents: 0,
      userActions: 0, unresolvedIssues: 0
    },
    categories: [], logs: [], errors: [], scanRuns: [], workerQueue: [], audit: [], timeline: [], metrics: [],
    retention: [], incidents: [],
    emptyState: {
      title: "No Universe Scanner logs found.",
      message: "Production logs will appear here after scanner runs, module executions, job processing, opportunity ranking, qualification, AI generation, or user actions occur.",
      actions: ["Run Full Scan", "Open Control Center", "Open Test Harness", "Open Scanner Dashboard"]
    }
  };
}

function logRow(row) {
  return {
    logId: String(row.logId || row.id),
    timestamp: row.timestamp || row.createdAt || row.queuedAt || row.startedAt,
    severity: row.severity || (/fail|error/i.test(row.status || row.action || "") ? "Error" : "Info"),
    status: row.status || "Completed",
    module: row.module || row.moduleName || row.moduleKey || "Universe Scanner",
    category: row.category || "System Logs",
    action: row.action || row.jobType || row.alertType || "recorded",
    message: row.message || row.title || row.errorMessage || row.reason || `${row.action || row.status || "Event"} recorded`,
    asset: row.asset || null,
    candidateId: row.candidateId || null,
    jobId: row.jobId || null,
    runId: row.runId || null,
    worker: row.workerName || row.workerId || null,
    user: row.userName || row.triggeredBy || row.createdBy || null,
    correlationId: row.correlationId || row.jobId || row.runId || row.candidateId || row.id || null,
    duration: row.duration || row.durationMs || null,
    environment: row.environment || "production",
    errorCode: row.errorCode || null,
    stackTrace: row.stackTrace || null,
    inputSnapshot: row.inputSnapshot || null,
    outputSnapshot: row.outputSnapshot || null,
    beforeValue: row.beforeValue || null,
    afterValue: row.afterValue || null,
    recommendedFix: row.recommendedFix || null,
    resolutionStatus: row.resolutionStatus || row.status || "Open"
  };
}

async function sourceRows() {
  const [base, audit, jobs, queue, workers, errors, modules, controlAudit, controlAlerts, opportunity, qualified, aiLogs, scanRuns, scanResults, retention, incidents] = await Promise.all([
    safeQuery(`SELECT id AS "logId", timestamp, severity, status, module_key AS "moduleKey", module_name AS "module", category, action, message, detailed_description AS "detailedDescription", asset, candidate_id AS "candidateId", job_id AS "jobId", run_id AS "runId", worker_id AS "workerId", user_name AS "userName", ip_address AS "ipAddress", correlation_id AS "correlationId", duration_ms AS "duration", environment, error_code AS "errorCode", stack_trace AS "stackTrace", input_snapshot AS "inputSnapshot", output_snapshot AS "outputSnapshot", before_value AS "beforeValue", after_value AS "afterValue", recommended_fix AS "recommendedFix", resolution_status AS "resolutionStatus" FROM market.scanner_logs ORDER BY timestamp DESC LIMIT 500`).then(r => r.rows),
    safeQuery(`SELECT id AS "logId", timestamp, user_name AS "userName", action, entity_type AS "module", entity_id AS "correlationId", before_value AS "beforeValue", after_value AS "afterValue", reason AS message, ip_address AS "ipAddress", environment, correlation_id AS "correlationId", 'Audit Logs' AS category, 'Info' AS severity, 'Completed' AS status FROM market.scanner_audit_logs ORDER BY timestamp DESC LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT id AS "logId", id AS "jobId", module_key AS "moduleKey", module_name AS "module", job_type AS "jobType", status, queued_at AS "timestamp", started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "duration", retry_count AS "retryCount", triggered_by AS "triggeredBy", worker_id AS "workerId", error_message AS "errorMessage", 'Scan Execution Logs' AS category FROM market.scanner_jobs ORDER BY queued_at DESC LIMIT 300`).then(r => r.rows),
    safeQuery(`SELECT id AS "logId", job_id AS "jobId", module_key AS "moduleKey", status, queued_at AS "timestamp", 'Queue Logs' AS category, 'Queue event' AS message FROM market.scanner_job_queue ORDER BY queued_at DESC LIMIT 300`).then(r => r.rows),
    safeQuery(`SELECT id AS "logId", id AS "workerId", worker_name AS "workerName", assigned_module AS "moduleKey", status, updated_at AS "timestamp", current_job_id AS "jobId", last_error AS "errorMessage", 'Worker Logs' AS category, 'Worker status' AS message FROM market.scanner_workers ORDER BY updated_at DESC LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT id AS "logId", module_key AS "moduleKey", asset, job_id AS "jobId", worker_id AS "workerId", error_code AS "errorCode", error_message AS "errorMessage", severity, retry_count AS "retryCount", resolved, recommended_fix AS "recommendedFix", created_at AS "timestamp", 'Error Logs' AS category, CASE WHEN resolved THEN 'Resolved' ELSE 'Failed' END AS status FROM market.scanner_error_logs ORDER BY created_at DESC LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT id AS "logId", module_key AS "moduleKey", module_name AS "module", action, status, message, duration_ms AS "duration", created_at AS "timestamp", 'Module Logs' AS category FROM market.scanner_module_logs ORDER BY created_at DESC LIMIT 300`).then(r => r.rows),
    safeQuery(`SELECT id AS "logId", user_name AS "userName", action, entity_type AS "module", entity_id AS "correlationId", reason AS message, ip_address AS "ipAddress", environment, created_at AS "timestamp", before_state AS "beforeValue", after_state AS "afterValue", 'Control Action Logs' AS category, 'Info' AS severity, 'Completed' AS status FROM market.scanner_control_audit_logs ORDER BY created_at DESC LIMIT 300`).then(r => r.rows),
    safeQuery(`SELECT id AS "logId", alert_type AS "action", title AS message, severity, module_key AS "moduleKey", job_id AS "jobId", worker_id AS "workerId", status, created_by AS "createdBy", created_at AS "timestamp", 'Error Logs' AS category FROM market.scanner_control_alerts ORDER BY created_at DESC LIMIT 100`).then(r => r.rows),
    safeQuery(`SELECT id AS "logId", asset, previous_status AS "beforeValue", current_status AS "afterValue", trigger AS action, notes AS message, created_at AS "timestamp", candidate_id AS "candidateId", 'Opportunity Ranking Logs' AS category, 'Info' AS severity, current_status AS status FROM market.asset_opportunity_history ORDER BY created_at DESC LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT id AS "logId", candidate_id AS "candidateId", asset, previous_status AS "beforeValue", current_status AS "afterValue", trigger AS action, notes AS message, created_at AS "timestamp", 'Qualified Trade Logs' AS category, 'Info' AS severity, current_status AS status FROM market.qualified_trade_candidate_history ORDER BY created_at DESC LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT id AS "logId", status, insights_generated AS "duration", grounding_blocks AS "retryCount", triggered_by AS "triggeredBy", started_at AS "timestamp", completed_at AS "completedAt", 'AI Insight Logs' AS category, 'AI generation' AS action, 'AI insight generation completed' AS message, CASE WHEN status='Completed' THEN 'Success' ELSE 'Error' END AS severity FROM market.scanner_ai_generation_logs ORDER BY started_at DESC LIMIT 120`).then(r => r.rows),
    safeQuery(`SELECT id AS "runId", id AS "logId", run_type AS "jobType", triggered_by AS "triggeredBy", started_at AS "timestamp", completed_at AS "completedAt", duration_ms AS "duration", assets_processed AS "assetsProcessed", modules_processed AS "modulesProcessed", status, 'Scan Execution Logs' AS category, 'Scan run' AS action, 'Scan run recorded' AS message FROM market.asset_scan_runs ORDER BY started_at DESC LIMIT 120`).then(r => r.rows),
    safeQuery(`SELECT id AS "logId", asset, qualification AS status, main_reason AS message, calculated_at AS "timestamp", 'Asset Scan Logs' AS category, 'Asset scan result' AS action, 'Success' AS severity FROM market.asset_scan_results ORDER BY calculated_at DESC LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT retention_period_days AS "retentionPeriod", archive_status AS "archiveStatus", legal_hold AS "legalHold", deleted_at AS "deletedAt", updated_at AS "updatedAt" FROM market.scanner_log_retention ORDER BY updated_at DESC LIMIT 20`).then(r => r.rows),
    safeQuery(`SELECT id AS "incidentId", incident_title AS "incidentTitle", severity, affected_module AS "affectedModule", affected_asset AS "affectedAsset", affected_job AS "affectedJob", status, created_by AS "createdBy", created_at AS "createdAt" FROM market.scanner_incidents ORDER BY created_at DESC LIMIT 80`).then(r => r.rows)
  ]);
  const logs = [...base, ...audit, ...jobs, ...queue, ...workers, ...errors, ...modules, ...controlAudit, ...controlAlerts, ...opportunity, ...qualified, ...aiLogs, ...scanRuns, ...scanResults].map(logRow).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  return { logs, errors: errors.map(logRow), scanRuns, workers, queue, audit: [...audit, ...controlAudit].map(logRow), retention, incidents };
}

function today(log) {
  return log.timestamp && new Date(log.timestamp).toDateString() === new Date().toDateString();
}

function summary(logs) {
  const todayLogs = logs.filter(today);
  return {
    totalLogsToday: todayLogs.length,
    successfulEvents: logs.filter(row => /success|completed|resolved/i.test(`${row.severity} ${row.status}`)).length,
    warnings: logs.filter(row => /warning/i.test(row.severity)).length,
    errors: logs.filter(row => /error/i.test(row.severity)).length,
    criticalErrors: logs.filter(row => /critical|emergency/i.test(row.severity)).length,
    scanEvents: logs.filter(row => /scan/i.test(row.category)).length,
    workerEvents: logs.filter(row => /worker/i.test(row.category)).length,
    queueEvents: logs.filter(row => /queue/i.test(row.category)).length,
    opportunityEvents: logs.filter(row => /opportunity/i.test(row.category)).length,
    qualificationEvents: logs.filter(row => /qualified|qualification/i.test(row.category)).length,
    aiGenerationEvents: logs.filter(row => /ai/i.test(row.category)).length,
    userActions: logs.filter(row => row.user).length,
    unresolvedIssues: logs.filter(row => /error|critical|failed/i.test(`${row.severity} ${row.status}`) && !/resolved|acknowledged|archived/i.test(row.resolutionStatus)).length
  };
}

function categories(logs) {
  const map = new Map();
  for (const row of logs) map.set(row.category, (map.get(row.category) || 0) + 1);
  return [...map.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

function timeline(logs, correlationId) {
  const filtered = correlationId ? logs.filter(row => String(row.correlationId) === String(correlationId) || String(row.jobId) === String(correlationId) || String(row.runId) === String(correlationId)) : logs.slice(0, 80);
  return filtered.map(row => ({ time: row.timestamp, event: row.action, module: row.module, asset: row.asset, status: row.status, message: row.message, correlationId: row.correlationId }));
}

function metrics(logs) {
  const byCategory = categories(logs).slice(0, 12);
  const failingModules = categories(logs.filter(row => /error|failed|critical/i.test(`${row.severity} ${row.status}`)).map(row => ({ ...row, category: row.module }))).slice(0, 12);
  const byHour = new Map();
  for (const row of logs) {
    const key = row.timestamp ? new Date(row.timestamp).toISOString().slice(0, 13) + ":00" : "No time";
    byHour.set(key, (byHour.get(key) || 0) + 1);
  }
  return { logsOverTime: [...byHour.entries()].map(([time, count]) => ({ time, count })), topCategories: byCategory, topFailingModules: failingModules };
}

async function liveOutput() {
  const rows = await sourceRows();
  if (!rows.logs.length) return { ...emptyState("EMPTY", "No Universe Scanner logs found."), retention: rows.retention, incidents: rows.incidents };
  const summaryRow = summary(rows.logs);
  return {
    engine: "UniverseScannerLogsEngine",
    sourceMode: "PRODUCTION_LOGS_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, auditLoggingActive: true, lastLogReceived: rows.logs[0]?.timestamp || null, criticalErrorsToday: rows.logs.filter(row => today(row) && /critical|emergency/i.test(row.severity)).length },
    summary: summaryRow,
    categories: categories(rows.logs),
    logs: rows.logs.slice(0, 500),
    errors: rows.logs.filter(row => /error|critical|emergency|failed/i.test(`${row.severity} ${row.status}`)).slice(0, 120),
    scanRuns: rows.scanRuns,
    workerQueue: [...rows.workers.map(row => logRow(row)), ...rows.queue.map(row => logRow(row))],
    audit: rows.audit,
    timeline: timeline(rows.logs),
    metrics: metrics(rows.logs),
    retention: rows.retention,
    incidents: rows.incidents,
    emptyState: null
  };
}

export async function getUniverseScannerLogsCenter() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  return liveOutput();
}

export async function getUniverseScannerLogsSlice(slice, params = {}) {
  const data = await getUniverseScannerLogsCenter();
  const map = {
    summary: { status: data.status, badges: data.badges, summary: data.summary },
    categories: { status: data.status, categories: data.categories },
    errors: { status: data.status, errors: data.errors },
    "scan-runs": { status: data.status, scanRuns: data.scanRuns },
    "worker-queue": { status: data.status, workerQueue: data.workerQueue },
    audit: { status: data.status, audit: data.audit },
    timeline: { status: data.status, timeline: timeline(data.logs || [], params.correlationId) },
    metrics: { status: data.status, metrics: data.metrics },
    export: data
  };
  return map[slice] || data;
}

export async function getUniverseScannerLogDetail(logId) {
  const data = await getUniverseScannerLogsCenter();
  const log = data.logs.find(row => String(row.logId) === String(logId));
  if (!log) return null;
  return { log, relatedLogs: timeline(data.logs, log.correlationId), audit: data.audit.filter(row => row.correlationId === log.correlationId) };
}

async function assertReady() {
  if (!isDatabaseConfigured()) { const error = new Error("database_not_configured"); error.status = 503; throw error; }
  const ready = await tableReadiness();
  if (!ready.ready) { const error = new Error("schema_not_ready"); error.status = 503; error.missingTables = ready.missing; throw error; }
}

export async function runUniverseScannerLogAction(action, body = {}, actor = "api", logId = null) {
  await assertReady();
  return withTransaction(async client => {
    if (action === "acknowledge" || action === "resolve") {
      const status = action === "acknowledge" ? "Acknowledged" : "Resolved";
      await client.query(`UPDATE market.scanner_logs SET resolution_status=$2, status=$2 WHERE id=$1::uuid`, [logId, status]).catch(() => null);
      await client.query(`INSERT INTO market.scanner_audit_logs (user_name, action, entity_type, entity_id, reason, payload) VALUES ($1,$2,'scanner_log',$3,$4,$5::jsonb)`, [actor, action, logId, body.reason || null, JSON.stringify(body)]);
      return { accepted: true, type: `scanner_logs.${action}`, logId };
    }
    if (action === "create-incident") {
      const affectedJob = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.affectedJob || "")) ? body.affectedJob : null;
      const result = await client.query(`INSERT INTO market.scanner_incidents (incident_title, severity, affected_module, affected_asset, affected_job, description, assigned_to, due_date, source_log_id, created_by) VALUES ($1,$2,$3,$4,$5::uuid,$6,$7,$8,$9,$10) RETURNING id`, [body.incidentTitle || "Scanner incident", body.severity || "Warning", body.affectedModule || null, body.affectedAsset || null, affectedJob, body.description || null, body.assignedTo || null, body.dueDate || null, String(logId || ""), actor]);
      await client.query(`INSERT INTO market.scanner_audit_logs (user_name, action, entity_type, entity_id, payload) VALUES ($1,'create_incident','scanner_incident',$2,$3::jsonb)`, [actor, result.rows[0].id, JSON.stringify(body)]);
      return { accepted: true, type: "scanner_logs.incident.created", incidentId: result.rows[0].id };
    }
    if (action === "archive") {
      await client.query(`INSERT INTO market.scanner_log_exports (export_type, filters, status, created_by) VALUES ('archive',$1::jsonb,'Created',$2)`, [JSON.stringify(body.filters || {}), actor]);
      await client.query(`INSERT INTO market.scanner_audit_logs (user_name, action, entity_type, payload) VALUES ($1,'archive_logs','scanner_logs',$2::jsonb)`, [actor, JSON.stringify(body)]);
      return { accepted: true, type: "scanner_logs.archive.created" };
    }
    return { accepted: true, type: `scanner_logs.${action}.recorded` };
  });
}

export async function exportUniverseScannerLogsReport() {
  return getUniverseScannerLogsCenter();
}
