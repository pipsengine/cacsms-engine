import { isDatabaseConfigured, query, withTransaction } from "./db.js";

export const SCANNER_CONTROL_TABLES = Object.freeze([
  "market.scanner_control_state",
  "market.scanner_jobs",
  "market.scanner_job_queue",
  "market.scanner_workers",
  "market.scanner_worker_heartbeats",
  "market.scanner_schedules",
  "market.scanner_safety_checks",
  "market.scanner_failure_recovery",
  "market.scanner_pipeline_status",
  "market.scanner_health_metrics",
  "market.scanner_control_alerts",
  "market.scanner_control_ai_summaries",
  "market.scanner_control_audit_logs"
]);

const MODULES = [
  ["asset-universe", "Asset Universe Readiness", "/workspace/universe-scanner/universe"],
  ["currency-strength", "Currency Strength", "/workspace/universe-scanner/currency-strength"],
  ["trend-scanner", "Trend Scanner", "/workspace/universe-scanner/trend-scanner"],
  ["market-structure", "Market Structure", "/workspace/universe-scanner/market-structure"],
  ["momentum", "Momentum", "/workspace/universe-scanner/momentum"],
  ["volatility", "Volatility", "/workspace/universe-scanner/volatility"],
  ["liquidity", "Liquidity", "/workspace/universe-scanner/liquidity"],
  ["institutional", "Institutional", "/workspace/universe-scanner/institutional"],
  ["sentiment", "Sentiment", "/workspace/universe-scanner/sentiment"],
  ["macro", "Macro", "/workspace/universe-scanner/macro"],
  ["economic-events", "Economic Events", "/workspace/universe-scanner/economic-events"],
  ["risk", "Risk", "/workspace/universe-scanner/risk"],
  ["prop-compliance", "Prop Compliance", "/workspace/universe-scanner/prop-compliance"],
  ["opportunities", "Opportunity Ranking", "/workspace/universe-scanner/opportunities"],
  ["qualified-trades", "Qualified Trades", "/workspace/universe-scanner/qualified-trades"],
  ["ai-insights", "AI Insights", "/workspace/universe-scanner/ai-insights"]
];

const permissions = () => ({
  view: "universe_scanner.control_center.view",
  runFullScan: "universe_scanner.control_center.run_full_scan",
  runModule: "universe_scanner.control_center.run_module",
  pause: "universe_scanner.control_center.pause",
  resume: "universe_scanner.control_center.resume",
  stop: "universe_scanner.control_center.stop",
  emergencyStop: "universe_scanner.control_center.emergency_stop",
  changeMode: "universe_scanner.control_center.change_mode",
  manageWorkers: "universe_scanner.control_center.manage_workers",
  manageSchedules: "universe_scanner.control_center.manage_schedules",
  export: "universe_scanner.control_center.export"
});

async function safeQuery(sql, params = []) {
  try { return await query(sql, params); }
  catch (error) {
    if (["42P01", "42703", "42883"].includes(error.code)) return { rows: [] };
    throw error;
  }
}

async function tableReadiness() {
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [SCANNER_CONTROL_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "UniverseScannerOrchestrator",
    sourceMode: "LIVE_JOBS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveJobsOnly: true, scannerMode: "Insufficient Data", lastFullScan: null, nextScheduledScan: null },
    summary: {
      scannerStatus: "Insufficient Data", runningJobs: 0, queuedJobs: 0, completedJobsToday: 0, failedJobsToday: 0,
      retryRequired: 0, activeWorkers: 0, offlineWorkers: 0, averageScanDuration: null,
      lastFullScanStatus: "Insufficient Data", nextScheduledScan: null, card3Readiness: "Insufficient Data"
    },
    controlState: null, modules: [], jobs: [], workers: [], schedules: [], safetyChecks: [], failures: [],
    readiness: [], audit: [], aiSummary: null, alerts: [],
    emptyState: {
      title: "Scanner Control Center has not been initialized yet.",
      message: "Initialize scanner control state, configure workers, and create schedules before running live universe scans.",
      actions: ["Initialize Control Center", "Create Worker", "Create Schedule", "Open Test Harness"]
    }
  };
}

const round = value => value === null || value === undefined || Number.isNaN(Number(value)) ? null : Math.round(Number(value));

async function sourceRows() {
  const [state, jobs, queue, workers, schedules, safetyChecks, failures, pipeline, health, alerts, audit, ai] = await Promise.all([
    safeQuery(`SELECT scanner_mode AS "scannerMode", scanner_status AS "scannerStatus", emergency_stop AS "emergencyStop", last_full_scan_at AS "lastFullScanAt", last_full_scan_status AS "lastFullScanStatus", next_scheduled_scan_at AS "nextScheduledScanAt", card3_readiness AS "card3Readiness", updated_at AS "updatedAt" FROM market.scanner_control_state ORDER BY updated_at DESC LIMIT 1`).then(r => r.rows[0] || null),
    safeQuery(`SELECT id AS "jobId", module_key AS "moduleKey", module_name AS "module", job_type AS "jobType", priority, status, queued_at AS "queuedAt", started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "duration", retry_count AS "retryCount", max_retries AS "maxRetries", triggered_by AS "triggeredBy", worker_id AS "workerId", error_message AS "errorMessage" FROM market.scanner_jobs ORDER BY queued_at DESC LIMIT 300`).then(r => r.rows),
    safeQuery(`SELECT job_id AS "jobId", module_key AS "moduleKey", priority, status, queued_at AS "queuedAt", locked_at AS "lockedAt" FROM market.scanner_job_queue ORDER BY queued_at DESC LIMIT 300`).then(r => r.rows),
    safeQuery(`SELECT w.id AS "workerId", w.worker_name AS "workerName", w.assigned_module AS "assignedModule", w.status, w.current_job_id AS "currentJob", COALESCE(h.heartbeat_at, w.updated_at) AS "heartbeat", COALESCE(h.cpu_usage,w.cpu_usage) AS "cpuUsage", COALESCE(h.memory_usage,w.memory_usage) AS "memoryUsage", w.jobs_processed_today AS "jobsProcessedToday", w.failed_jobs AS "failedJobs", w.last_error AS "lastError" FROM market.scanner_workers w LEFT JOIN LATERAL (SELECT * FROM market.scanner_worker_heartbeats h WHERE h.worker_id = w.id ORDER BY heartbeat_at DESC LIMIT 1) h ON true ORDER BY w.updated_at DESC LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT id AS "scheduleId", schedule_name AS "scheduleName", module_key AS "module", frequency, enabled, last_run_at AS "lastRun", next_run_at AS "nextRun", timezone, created_by AS "createdBy", updated_at AS "updatedAt" FROM market.scanner_schedules ORDER BY next_run_at NULLS LAST, updated_at DESC LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT check_key AS "checkKey", check_name AS "checkName", status, severity, detail, checked_at AS "checkedAt" FROM market.scanner_safety_checks ORDER BY checked_at DESC LIMIT 80`).then(r => r.rows),
    safeQuery(`SELECT job_id AS "jobId", module_key AS "module", failure_type AS "failureType", error_message AS "errorMessage", retry_count AS "retryCount", max_retries AS "maxRetries", retryable, recommended_fix AS "recommendedFix", status, created_at AS "createdAt" FROM market.scanner_failure_recovery ORDER BY created_at DESC LIMIT 120`).then(r => r.rows),
    safeQuery(`SELECT module_key AS "moduleKey", module_name AS "moduleName", status, records_processed AS "recordsProcessed", duration_ms AS "durationMs", health, last_run_at AS "lastRunAt" FROM market.scanner_pipeline_status ORDER BY last_run_at DESC NULLS LAST LIMIT 200`).then(r => r.rows),
    safeQuery(`SELECT metric_key AS "metricKey", metric_name AS "metricName", metric_value AS "metricValue", status, detail, observed_at AS "observedAt" FROM market.scanner_health_metrics ORDER BY observed_at DESC LIMIT 120`).then(r => r.rows),
    safeQuery(`SELECT alert_type AS "alertType", title, severity, module_key AS "moduleKey", job_id AS "jobId", worker_id AS "workerId", status, created_by AS "createdBy", created_at AS "createdAt" FROM market.scanner_control_alerts ORDER BY created_at DESC LIMIT 80`).then(r => r.rows),
    safeQuery(`SELECT user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, ip_address AS "ipAddress", environment, created_at AS "createdAt" FROM market.scanner_control_audit_logs ORDER BY created_at DESC LIMIT 120`).then(r => r.rows),
    safeQuery(`SELECT scanner_operational_health AS "scannerOperationalHealth", modules_failing_or_delayed AS "modulesFailingOrDelayed", queue_pressure AS "queuePressure", worker_issues AS "workerIssues", full_scan_readiness AS "fullScanReadiness", next_card_readiness AS "nextCardReadiness", recommended_operational_actions AS "recommendedOperationalActions", summary, generated_at AS "generatedAt" FROM market.scanner_control_ai_summaries ORDER BY generated_at DESC LIMIT 1`).then(r => r.rows[0] || null)
  ]);
  return { state, jobs, queue, workers, schedules, safetyChecks, failures, pipeline, health, alerts, audit, ai };
}

function moduleRows(rows) {
  const jobsByModule = new Map();
  for (const job of rows.jobs) {
    if (!jobsByModule.has(job.moduleKey)) jobsByModule.set(job.moduleKey, []);
    jobsByModule.get(job.moduleKey).push(job);
  }
  const pipelineByModule = new Map(rows.pipeline.map(row => [row.moduleKey, row]));
  return MODULES.map(([key, name, url]) => {
    const jobs = jobsByModule.get(key) || [];
    const pipe = pipelineByModule.get(key);
    const completed = jobs.filter(job => job.status === "Completed" && sameDay(job.completedAt)).length;
    const failed = jobs.filter(job => job.status === "Failed" && sameDay(job.completedAt || job.queuedAt)).length;
    const avgDuration = jobs.length ? round(jobs.reduce((sum, job) => sum + Number(job.duration || 0), 0) / jobs.length) : null;
    return {
      moduleKey: key, module: name, status: pipe?.status || (jobs.some(job => job.status === "Running") ? "Running" : "Not Configured"),
      dependencyStatus: pipe?.health || "No record", lastRun: pipe?.lastRunAt || jobs[0]?.completedAt || jobs[0]?.queuedAt || null,
      nextRun: rows.schedules.find(schedule => schedule.module === key)?.nextRun || null,
      queuedJobs: jobs.filter(job => job.status === "Queued").length,
      runningJobs: jobs.filter(job => job.status === "Running").length,
      completedToday: completed, failedToday: failed, averageDuration: avgDuration,
      health: pipe?.health || (failed ? "Failed" : "Insufficient Data"), moduleUrl: url
    };
  });
}

function sameDay(value) {
  if (!value) return false;
  return new Date(value).toDateString() === new Date().toDateString();
}

function summary(rows, modules) {
  return {
    scannerStatus: rows.state?.scannerStatus || "Insufficient Data",
    runningJobs: rows.jobs.filter(job => job.status === "Running").length,
    queuedJobs: rows.jobs.filter(job => job.status === "Queued").length,
    completedJobsToday: rows.jobs.filter(job => job.status === "Completed" && sameDay(job.completedAt)).length,
    failedJobsToday: rows.jobs.filter(job => job.status === "Failed" && sameDay(job.completedAt || job.queuedAt)).length,
    retryRequired: rows.failures.filter(row => row.status !== "Resolved" && row.retryable).length,
    activeWorkers: rows.workers.filter(row => ["Online", "Busy", "Idle"].includes(row.status)).length,
    offlineWorkers: rows.workers.filter(row => ["Offline", "Failed"].includes(row.status)).length,
    averageScanDuration: round(rows.jobs.filter(job => job.duration !== null).reduce((sum, job, _, arr) => sum + Number(job.duration || 0) / arr.length, 0)),
    lastFullScanStatus: rows.state?.lastFullScanStatus || "Insufficient Data",
    nextScheduledScan: rows.state?.nextScheduledScanAt || rows.schedules.find(row => row.enabled)?.nextRun || null,
    card3Readiness: rows.state?.card3Readiness || (modules.some(row => row.status === "Failed") ? "Blocked" : "Insufficient Data")
  };
}

function safetyRows(rows) {
  if (rows.safetyChecks.length) return rows.safetyChecks;
  return [];
}

function readinessRows(rows) {
  const checks = [
    ["Full scan completed", rows.state?.lastFullScanStatus === "Completed"],
    ["Opportunity ranking completed", rows.pipeline.some(row => row.moduleKey === "opportunities" && row.status === "Completed")],
    ["Qualified trades generated", rows.pipeline.some(row => row.moduleKey === "qualified-trades" && row.status === "Completed")],
    ["Risk scanner passed", rows.pipeline.some(row => row.moduleKey === "risk" && ["Completed", "Passed"].includes(row.status))],
    ["Prop compliance passed", rows.pipeline.some(row => row.moduleKey === "prop-compliance" && ["Completed", "Passed"].includes(row.status))],
    ["AI insights generated", rows.pipeline.some(row => row.moduleKey === "ai-insights" && ["Completed", "Passed"].includes(row.status))],
    ["No critical scanner failure", !rows.jobs.some(job => job.status === "Failed")],
    ["Audit logs written", rows.audit.length > 0]
  ];
  return checks.map(([checkName, passed]) => ({ checkName, status: passed ? "Passed" : "Blocked", output: passed ? "Ready for Next Card" : "Blocked" }));
}

function aiSummary(rows, modules, readiness) {
  if (rows.ai) return rows.ai;
  const failing = modules.filter(row => ["Failed", "Blocked"].includes(row.status));
  const offline = rows.workers.filter(row => ["Offline", "Failed"].includes(row.status));
  return {
    scannerOperationalHealth: rows.state?.scannerStatus || "Insufficient Data",
    modulesFailingOrDelayed: failing.map(row => row.module).join(", ") || "No failing module records",
    queuePressure: rows.queue.length ? `${rows.queue.length} queued records` : "No queue pressure records",
    workerIssues: offline.map(row => row.workerName).join(", ") || "No worker issue records",
    fullScanReadiness: rows.safetyChecks.some(row => row.status === "Blocked") ? "Blocked" : "Insufficient Data",
    nextCardReadiness: readiness.every(row => row.status === "Passed") ? "Ready for Next Card" : "Blocked",
    recommendedOperationalActions: rows.state ? "Review blockers, workers, and failed jobs before full scan." : "Initialize scanner control state and workers.",
    summary: rows.state ? "Scanner control data is available from production control tables." : "Scanner Control Center has not been initialized yet.",
    generatedAt: null
  };
}

async function liveOutput() {
  const rows = await sourceRows();
  const hasRecords = Boolean(rows.state) || rows.jobs.length || rows.workers.length || rows.schedules.length || rows.pipeline.length || rows.health.length;
  if (!hasRecords) return { ...emptyState("EMPTY", "Scanner Control Center has not been initialized yet."), audit: rows.audit, alerts: rows.alerts };
  const modules = moduleRows(rows);
  const readiness = readinessRows(rows);
  const summaryRow = summary(rows, modules);
  return {
    engine: "UniverseScannerOrchestrator",
    sourceMode: "LIVE_JOBS_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveJobsOnly: true, scannerMode: rows.state?.scannerMode || "Insufficient Data", lastFullScan: rows.state?.lastFullScanAt, nextScheduledScan: summaryRow.nextScheduledScan },
    summary: summaryRow,
    controlState: rows.state,
    modules,
    jobs: rows.jobs,
    workers: rows.workers,
    schedules: rows.schedules,
    safetyChecks: safetyRows(rows),
    failures: rows.failures,
    readiness,
    audit: rows.audit,
    alerts: rows.alerts,
    aiSummary: aiSummary(rows, modules, readiness),
    emptyState: null
  };
}

export async function getScannerControlCenter() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  return liveOutput();
}

export async function getScannerControlSlice(slice) {
  const data = await getScannerControlCenter();
  const map = {
    summary: { status: data.status, badges: data.badges, summary: data.summary },
    modules: { status: data.status, modules: data.modules },
    jobs: { status: data.status, jobs: data.jobs },
    workers: { status: data.status, workers: data.workers },
    schedules: { status: data.status, schedules: data.schedules },
    "safety-checks": { status: data.status, safetyChecks: data.safetyChecks },
    failures: { status: data.status, failures: data.failures },
    readiness: { status: data.status, readiness: data.readiness },
    audit: { status: data.status, audit: data.audit },
    "ai-summary": { status: data.status, aiSummary: data.aiSummary },
    export: data
  };
  return map[slice] || data;
}

async function assertReady() {
  if (!isDatabaseConfigured()) { const error = new Error("database_not_configured"); error.status = 503; throw error; }
  const ready = await tableReadiness();
  if (!ready.ready) { const error = new Error("schema_not_ready"); error.status = 503; error.missingTables = ready.missing; throw error; }
}

async function auditAction(client, actor, action, entityType, entityId, beforeState, afterState, body) {
  await client.query(`INSERT INTO market.scanner_control_audit_logs (user_name, action, entity_type, entity_id, before_state, after_state, reason, payload) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::jsonb)`, [actor, action, entityType, entityId, JSON.stringify(beforeState || null), JSON.stringify(afterState || null), body.reason || null, JSON.stringify(body)]);
}

export async function runScannerControlAction(action, body = {}, actor = "api", targetId = null) {
  await assertReady();
  return withTransaction(async client => {
    const before = await client.query(`SELECT * FROM market.scanner_control_state ORDER BY updated_at DESC LIMIT 1`);
    if (action === "initialize") {
      const result = await client.query(`INSERT INTO market.scanner_control_state (scanner_mode, scanner_status, card3_readiness, updated_by) VALUES ('Manual','Idle','Insufficient Data',$1) RETURNING *`, [actor]);
      await auditAction(client, actor, action, "scanner_control_state", result.rows[0].id, before.rows[0] || null, result.rows[0], body);
      return { accepted: true, type: "scanner_control.initialized" };
    }
    if (["pause", "resume", "stop", "emergency-stop", "change-mode"].includes(action)) {
      const status = action === "pause" ? "Paused" : action === "resume" ? "Idle" : action === "stop" ? "Stopped" : action === "emergency-stop" ? "Stopped" : before.rows[0]?.scanner_status || "Idle";
      const mode = action === "change-mode" ? body.scannerMode || body.mode || "Manual" : before.rows[0]?.scanner_mode || "Manual";
      const emergency = action === "emergency-stop" ? true : before.rows[0]?.emergency_stop || false;
      const result = await client.query(`INSERT INTO market.scanner_control_state (scanner_mode, scanner_status, emergency_stop, last_full_scan_at, last_full_scan_status, next_scheduled_scan_at, card3_readiness, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [mode, status, emergency, before.rows[0]?.last_full_scan_at || null, before.rows[0]?.last_full_scan_status || null, before.rows[0]?.next_scheduled_scan_at || null, before.rows[0]?.card3_readiness || null, actor]);
      await auditAction(client, actor, action, "scanner_control_state", result.rows[0].id, before.rows[0] || null, result.rows[0], body);
      return { accepted: true, type: `scanner_control.${action}` };
    }
    if (action === "run-full-scan" || action === "run-module") {
      const moduleKey = body.moduleKey || "full-scan";
      const moduleName = body.moduleName || (action === "run-full-scan" ? "Full Universe Scan" : moduleKey);
      const job = await client.query(`INSERT INTO market.scanner_jobs (module_key, module_name, job_type, priority, status, triggered_by, input_snapshot) VALUES ($1,$2,$3,$4,'Queued',$5,$6::jsonb) RETURNING id`, [moduleKey, moduleName, action === "run-full-scan" ? "Full Scan" : "Module Scan", body.priority || 5, actor, JSON.stringify(body)]);
      await client.query(`INSERT INTO market.scanner_job_queue (job_id, module_key, priority, status) VALUES ($1,$2,$3,'Queued')`, [job.rows[0].id, moduleKey, body.priority || 5]);
      await auditAction(client, actor, action, "scanner_job", job.rows[0].id, null, { jobId: job.rows[0].id, status: "Queued" }, body);
      return { accepted: true, type: `scanner_control.${action}`, jobId: job.rows[0].id };
    }
    if (action === "retry-job" || action === "cancel-job") {
      const status = action === "retry-job" ? "Retrying" : "Cancelled";
      await client.query(`UPDATE market.scanner_jobs SET status=$2, retry_count = retry_count + CASE WHEN $2='Retrying' THEN 1 ELSE 0 END WHERE id=$1::uuid`, [targetId, status]);
      await auditAction(client, actor, action, "scanner_job", targetId, null, { status }, body);
      return { accepted: true, type: `scanner_control.${action}`, jobId: targetId };
    }
    if (action === "restart-worker") {
      await client.query(`UPDATE market.scanner_workers SET status='Restarting', updated_at=now() WHERE id=$1::uuid`, [targetId]);
      await auditAction(client, actor, action, "scanner_worker", targetId, null, { status: "Restarting" }, body);
      return { accepted: true, type: "scanner_control.worker.restart", workerId: targetId };
    }
    if (action === "create-schedule") {
      const schedule = await client.query(`INSERT INTO market.scanner_schedules (schedule_name, module_key, frequency, cron_expression, timezone, created_by, payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`, [body.scheduleName || "Scanner Schedule", body.moduleKey || "full-scan", body.frequency || "Custom Cron", body.cronExpression || null, body.timezone || "Africa/Lagos", actor, JSON.stringify(body)]);
      await auditAction(client, actor, action, "scanner_schedule", schedule.rows[0].id, null, body, body);
      return { accepted: true, type: "scanner_control.schedule.created", scheduleId: schedule.rows[0].id };
    }
    await auditAction(client, actor, action, "scanner_control", targetId, null, body, body);
    return { accepted: true, type: `scanner_control.${action}` };
  });
}

export async function exportScannerControlReport() {
  return getScannerControlCenter();
}
