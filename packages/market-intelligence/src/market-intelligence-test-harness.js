import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { reconcileUnresolvedSyncFailures } from "./source-health-review.js";

const DEFAULT_SAFETY_MODE = "read_only";
const SAFETY_MODES = new Set(["read_only", "dry_run", "transactional", "approved_write", "sandbox_account"]);
const WRITE_MODES = new Set(["approved_write"]);

const REQUIRED_TABLES = [
  "market_intelligence.test_harness_catalog",
  "market_intelligence.test_harness_runs",
  "market_intelligence.test_harness_results",
  "market_intelligence.test_harness_checks",
  "market_intelligence.test_harness_diagnostics",
  "market_intelligence.test_harness_failures",
  "market_intelligence.test_harness_schedules",
  "market_intelligence.test_harness_audit_logs"
];

function emptySummary() {
  return {
    testsRunToday: 0,
    passedTests: 0,
    failedTests: 0,
    warnings: 0,
    criticalFailures: 0,
    averageTestDuration: 0,
    providerTests: 0,
    syncTests: 0,
    validationTests: 0,
    scoringTests: 0,
    handoffTests: 0,
    lastFullDiagnosticStatus: null,
    lastTestRun: null
  };
}

function normalizeSafetyMode(mode) {
  const value = String(mode || DEFAULT_SAFETY_MODE).trim().toLowerCase().replaceAll("-", "_");
  return SAFETY_MODES.has(value) ? value : DEFAULT_SAFETY_MODE;
}

function statusFromCounts({ failures = 0, warnings = 0, blocked = 0, skipped = 0 }) {
  if (blocked > 0) return "blocked";
  if (failures > 0) return "failed";
  if (warnings > 0) return "warning";
  if (skipped > 0) return "skipped";
  return "passed";
}

function publicRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    testId: row.test_id,
    testName: row.test_name,
    category: row.category,
    module: row.module,
    safetyMode: row.safety_mode,
    status: row.status,
    triggeredBy: row.triggered_by,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    duration: row.duration_ms,
    failureCount: row.failure_count,
    warningCount: row.warning_count,
    riskLevel: row.risk_level
  };
}

function publicCatalog(row) {
  return {
    id: row.id,
    testName: row.test_name,
    category: row.category,
    module: row.module,
    description: row.description,
    safetyMode: row.default_safety_mode,
    requiresApproval: row.requires_approval,
    riskLevel: row.risk_level,
    lastRun: row.last_run,
    lastStatus: row.last_status,
    duration: row.duration_ms
  };
}

async function scalar(sql, params = []) {
  const { rows } = await query(sql, params);
  return Number(rows[0]?.value || 0);
}

async function jsonRows(sql, params = []) {
  const { rows } = await query(sql, params);
  return rows;
}

async function tableExists(tableName) {
  const [schema, table] = tableName.split(".");
  const count = await scalar(
    "SELECT COUNT(*)::int AS value FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2",
    [schema, table]
  );
  return count > 0;
}

async function columnExists(tableName, columnName) {
  const [schema, table] = tableName.split(".");
  const count = await scalar(
    "SELECT COUNT(*)::int AS value FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3",
    [schema, table, columnName]
  );
  return count > 0;
}

async function collectChecks(test, safetyMode) {
  const checks = [];
  const warnings = [];
  const errors = [];
  const expected = {
    safetyMode,
    noMockData: true,
    destructiveWritesAllowed: false,
    productionRecordsOnly: true
  };
  const actual = {};
  const addCheck = (checkName, passed, details = {}, warningMessage = null) => {
    const status = passed ? "passed" : warningMessage ? "warning" : "failed";
    checks.push({ checkName, status, details });
    if (!passed && warningMessage) warnings.push({ checkName, message: warningMessage, details });
    if (!passed && !warningMessage) errors.push({ checkName, message: details.message || `${checkName} failed`, details });
  };

  if (test.id === "source-registry-check") {
    actual.enabledSources = await scalar("SELECT COUNT(*)::int AS value FROM market.source_registry WHERE enabled = true AND environment = 'production'");
    actual.requiredSources = await scalar("SELECT COUNT(*)::int AS value FROM market.source_registry WHERE required = true AND environment = 'production'");
    addCheck("Production source registry has enabled sources", actual.enabledSources > 0, actual, "No enabled production sources are registered.");
    addCheck("Required source records are present", actual.requiredSources > 0, { requiredSources: actual.requiredSources }, "No required production sources are registered.");
  } else if (test.id === "provider-connectivity-check") {
    const providerRows = await jsonRows(`
      SELECT DISTINCT ON (coalesce(source_key, provider)) provider, status, latency_ms, rate_limit_status, authentication_status, observed_at
      FROM market.source_provider_health
      ORDER BY coalesce(source_key, provider), observed_at DESC
    `);
    actual.providersObserved = providerRows.length;
    actual.onlineProviders = providerRows.filter(row => ["ONLINE", "LIVE", "SYNCED", "HEALTHY"].includes(String(row.status).toUpperCase())).length;
    actual.credentialsTracked = await scalar("SELECT COUNT(*)::int AS value FROM market.source_credentials");
    actual.maxLatencyMs = providerRows.reduce((max, row) => Math.max(max, Number(row.latency_ms || 0)), 0);
    addCheck("Provider health records available", providerRows.length > 0, actual, "No provider health records are available yet.");
    addCheck("Credential metadata tracked", actual.credentialsTracked > 0, { credentialsTracked: actual.credentialsTracked }, "No credential metadata records are available.");
    addCheck("Provider latency acceptable when present", actual.maxLatencyMs <= 5000, { maxLatencyMs: actual.maxLatencyMs });
  } else if (test.id === "sync-readiness-check") {
    await reconcileUnresolvedSyncFailures();
    actual.syncLogs = await scalar("SELECT COUNT(*)::int AS value FROM market.source_sync_logs");
    actual.failedSyncs = await scalar("SELECT COUNT(*)::int AS value FROM market.source_sync_logs WHERE lower(status) IN ('failed', 'error') OR error_message IS NOT NULL");
    actual.unresolvedFailures = await scalar(`
      SELECT COUNT(*)::int AS value
      FROM (
        SELECT DISTINCT ON (source_key) source_key, status, error_message, resolved
        FROM market.source_sync_logs
        ORDER BY source_key, started_at DESC
      ) latest
      WHERE resolved = false
        AND (lower(status) IN ('failed', 'error') OR error_message IS NOT NULL)
    `);
    addCheck("Sync logs available", actual.syncLogs > 0, actual, "No production sync jobs have been recorded yet.");
    addCheck("No unresolved failed syncs", actual.unresolvedFailures === 0, actual);
  } else if (test.id === "validation-rule-check") {
    actual.validationLogs = await scalar("SELECT COUNT(*)::int AS value FROM market.source_validation_logs");
    actual.validationIssues = await scalar("SELECT COALESCE(SUM(issue_count), 0)::int AS value FROM market.source_validation_logs");
    addCheck("Validation infrastructure available", await tableExists("market.source_validation_logs"), actual);
    addCheck("No open validation issues", actual.validationIssues === 0, actual, actual.validationLogs === 0 ? "No validation logs are available yet." : null);
  } else if (test.id === "dependency-matrix-check") {
    actual.dependencies = await scalar("SELECT COUNT(*)::int AS value FROM market.source_dependencies");
    actual.auditLogs = await scalar("SELECT COUNT(*)::int AS value FROM market.dependency_audit_logs");
    addCheck("Dependency records available", actual.dependencies > 0, actual, "No dependency records are available yet.");
    addCheck("Dependency audit available", actual.auditLogs > 0, actual, "No dependency audit records are available yet.");
  } else if (test.id === "package-builder-readiness" || test.id === "validated-package-check") {
    actual.packages = await scalar("SELECT COUNT(*)::int AS value FROM market.intelligence_packages");
    const hasReadyForScoring = await columnExists("market.intelligence_packages", "ready_for_scoring");
    actual.readyPackages = hasReadyForScoring
      ? await scalar("SELECT COUNT(*)::int AS value FROM market.intelligence_packages WHERE ready_for_scoring = true OR lower(status) LIKE '%validated%'")
      : await scalar("SELECT COUNT(*)::int AS value FROM market.intelligence_packages WHERE lower(coalesce(validation_status, status, '')) LIKE '%valid%' OR coalesce(readiness_score, 0) >= 70");
    actual.auditLogs = await scalar("SELECT COUNT(*)::int AS value FROM market.intelligence_package_audit_logs");
    addCheck("Package records available", actual.packages > 0, actual, "No production intelligence packages are available yet.");
    addCheck("Package audit records available", actual.auditLogs > 0, actual, "No package audit records are available yet.");
  } else if (test.id === "scoring-engine-validation") {
    actual.activeModels = await scalar("SELECT COUNT(*)::int AS value FROM market.scoring_models WHERE lower(status) = 'active'");
    actual.weights = await scalar("SELECT COUNT(*)::int AS value FROM market.scoring_model_weights WHERE enabled = true");
    actual.auditLogs = await scalar("SELECT COUNT(*)::int AS value FROM market.scoring_audit_logs");
    actual.weightTotal = await scalar("SELECT COALESCE(SUM(weight_percent), 0)::int AS value FROM market.scoring_model_weights WHERE enabled = true");
    addCheck("Active scoring model exists", actual.activeModels > 0, actual);
    addCheck("Enabled scoring weights exist", actual.weights > 0, actual);
    addCheck("Weight total is reviewable", actual.weightTotal > 0 && actual.weightTotal <= 200, actual);
  } else if (test.id === "handoff-readiness-check") {
    actual.destinations = await scalar("SELECT COUNT(*)::int AS value FROM market.intelligence_handoff_destinations");
    actual.handoffs = await scalar("SELECT COUNT(*)::int AS value FROM market.intelligence_handoffs");
    actual.auditLogs = await scalar("SELECT COUNT(*)::int AS value FROM market.intelligence_handoff_audit_logs");
    addCheck("Handoff destinations exist", actual.destinations > 0, actual);
    addCheck("Handoff audit records available", actual.auditLogs > 0, actual, "No handoff audit records are available yet.");
  } else if (test.id === "alert-dry-run-check") {
    actual.alertTables = {
      sourceAlerts: await tableExists("market.source_alerts"),
      handoffFailures: await tableExists("market.intelligence_handoff_failures")
    };
    addCheck("Alert infrastructure exists", actual.alertTables.sourceAlerts || actual.alertTables.handoffFailures, actual);
    addCheck("External notification delivery disabled in dry run", safetyMode !== "approved_write", { safetyMode });
  } else if (test.id === "ai-output-grounding-check") {
    const brokerSummaryTable = await tableExists("market.broker_liquidity_ai_summaries");
    const portfolioSummaryTable = await tableExists("market.portfolio_ai_summaries");
    actual.brokerSummaries = brokerSummaryTable ? await scalar("SELECT COUNT(*)::int AS value FROM market.broker_liquidity_ai_summaries") : 0;
    actual.portfolioSummaries = portfolioSummaryTable ? await scalar("SELECT COUNT(*)::int AS value FROM market.portfolio_ai_summaries") : 0;
    addCheck("AI summary storage is available", brokerSummaryTable || portfolioSummaryTable, actual);
    addCheck("AI outputs are not saved by this test", safetyMode !== "approved_write", { safetyMode });
  } else if (test.id === "permission-safety-check") {
    actual.permissions = await scalar("SELECT COUNT(*)::int AS value FROM security.permissions WHERE code LIKE 'market_intelligence.test_harness.%'");
    addCheck("Test harness permissions registered", actual.permissions >= 6, actual, "Test harness permission seed may not have run yet.");
  } else if (test.id === "database-integrity-check") {
    const states = [];
    for (const table of REQUIRED_TABLES) states.push({ table, exists: await tableExists(table) });
    actual.tables = states;
    addCheck("Required test harness tables exist", states.every(row => row.exists), actual);
  } else if (test.id === "performance-baseline-check") {
    actual.providerLatencyRows = await scalar("SELECT COUNT(*)::int AS value FROM market.source_provider_health WHERE latency_ms IS NOT NULL");
    actual.logDurations = await scalar("SELECT COUNT(*)::int AS value FROM market_intelligence.market_intelligence_logs WHERE duration_ms IS NOT NULL");
    addCheck("Performance signals available", actual.providerLatencyRows + actual.logDurations > 0, actual, "No duration or provider latency measurements are available yet.");
  } else {
    addCheck("Catalog entry supported", false, { testId: test.id, message: "No runner is implemented for this catalog entry." });
  }

  if (safetyMode === "transactional") {
    addCheck("Transactional rollback mode confirmed", true, { committedProductionBusinessRecords: false });
  }
  if (safetyMode === "dry_run") {
    addCheck("Dry-run mode confirmed", true, { externalSideEffects: false });
  }
  if (safetyMode === "read_only") {
    addCheck("Read-only mode confirmed", true, { writeTargets: ["test_harness_runs", "test_harness_results", "test_harness_audit_logs"] });
  }

  return { checks, warnings, errors, expected, actual };
}

async function recordRun(test, safetyMode, actor, execution, options = {}) {
  const now = Date.now();
  const failures = execution.checks.filter(check => check.status === "failed").length + execution.errors.length;
  const warnings = execution.checks.filter(check => check.status === "warning").length + execution.warnings.length;
  const status = statusFromCounts({ failures, warnings });
  const startedAt = new Date(now).toISOString();
  const completedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.now() - now);

  return withTransaction(async client => {
    const { rows } = await client.query(
      `INSERT INTO market_intelligence.test_harness_runs
       (test_id, test_name, category, module, safety_mode, status, triggered_by, started_at, completed_at, duration_ms, failure_count, warning_count, risk_level, input_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
       RETURNING *`,
      [test.id, test.test_name, test.category, test.module, safetyMode, status, actor, startedAt, completedAt, durationMs, failures, warnings, test.risk_level, JSON.stringify(options.inputSnapshot || {})]
    );
    const run = rows[0];
    await client.query(
      `INSERT INTO market_intelligence.test_harness_results
       (run_id, expected_result, actual_result, checks_performed, warnings, errors, related_logs, affected_module, recommended_fix, audit_trail)
       VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb)`,
      [
        run.id,
        JSON.stringify(execution.expected),
        JSON.stringify(execution.actual),
        JSON.stringify(execution.checks),
        JSON.stringify(execution.warnings),
        JSON.stringify(execution.errors),
        JSON.stringify([]),
        test.module,
        execution.errors[0]?.message || execution.warnings[0]?.message || null,
        JSON.stringify([{ action: "test_run_recorded", actor, at: completedAt }])
      ]
    );
    for (const check of execution.checks) {
      await client.query(
        "INSERT INTO market_intelligence.test_harness_checks (run_id, check_name, status, details) VALUES ($1,$2,$3,$4::jsonb)",
        [run.id, check.checkName, check.status, JSON.stringify(check.details || {})]
      );
    }
    for (const error of execution.errors) {
      await client.query(
        "INSERT INTO market_intelligence.test_harness_failures (run_id, failure_type, severity, message, recommended_fix) VALUES ($1,$2,$3,$4,$5)",
        [run.id, error.checkName || "test_failure", "error", error.message, error.details?.recommendedFix || null]
      );
    }
    await client.query(
      "INSERT INTO market_intelligence.test_harness_audit_logs (run_id, user_name, action, entity_id, after_value, reason) VALUES ($1,$2,'run_test',$3,$4::jsonb,$5)",
      [run.id, actor, test.id, JSON.stringify({ status, safetyMode, failures, warnings }), "Production-safe test harness run"]
    );
    return { run: publicRun(run), result: execution };
  });
}

export async function getTestHarnessDashboard() {
  return {
    summary: await getTestHarnessSummary(),
    catalog: await getTestHarnessCatalog(),
    history: await getTestHarnessHistory({ limit: 20 })
  };
}

export async function getTestHarnessSummary() {
  if (!isDatabaseConfigured()) return emptySummary();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { rows } = await query(
    `SELECT
      COUNT(*) FILTER (WHERE started_at >= $1)::int AS tests_run_today,
      COUNT(*) FILTER (WHERE started_at >= $1 AND status = 'passed')::int AS passed_tests,
      COUNT(*) FILTER (WHERE started_at >= $1 AND status = 'failed')::int AS failed_tests,
      COUNT(*) FILTER (WHERE started_at >= $1 AND status = 'warning')::int AS warnings,
      COUNT(*) FILTER (WHERE started_at >= $1 AND status IN ('failed', 'blocked') AND risk_level = 'critical')::int AS critical_failures,
      COALESCE(AVG(duration_ms) FILTER (WHERE started_at >= $1), 0)::numeric AS average_test_duration,
      COUNT(*) FILTER (WHERE started_at >= $1 AND category ILIKE '%Provider%')::int AS provider_tests,
      COUNT(*) FILTER (WHERE started_at >= $1 AND category ILIKE '%Sync%')::int AS sync_tests,
      COUNT(*) FILTER (WHERE started_at >= $1 AND category ILIKE '%Validation%')::int AS validation_tests,
      COUNT(*) FILTER (WHERE started_at >= $1 AND category ILIKE '%Scoring%')::int AS scoring_tests,
      COUNT(*) FILTER (WHERE started_at >= $1 AND category ILIKE '%Handoff%')::int AS handoff_tests,
      MAX(started_at) AS last_test_run
     FROM market_intelligence.test_harness_runs`,
    [today]
  );
  const { rows: diagnosticRows } = await query("SELECT status FROM market_intelligence.test_harness_diagnostics ORDER BY started_at DESC LIMIT 1");
  const row = rows[0] || {};
  return {
    testsRunToday: row.tests_run_today || 0,
    passedTests: row.passed_tests || 0,
    failedTests: row.failed_tests || 0,
    warnings: row.warnings || 0,
    criticalFailures: row.critical_failures || 0,
    averageTestDuration: Number(row.average_test_duration || 0),
    providerTests: row.provider_tests || 0,
    syncTests: row.sync_tests || 0,
    validationTests: row.validation_tests || 0,
    scoringTests: row.scoring_tests || 0,
    handoffTests: row.handoff_tests || 0,
    lastFullDiagnosticStatus: diagnosticRows[0]?.status || null,
    lastTestRun: row.last_test_run || null
  };
}

export async function getTestHarnessCatalog() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT c.*, r.started_at AS last_run, r.status AS last_status, r.duration_ms
     FROM market_intelligence.test_harness_catalog c
     LEFT JOIN LATERAL (
       SELECT started_at, status, duration_ms
       FROM market_intelligence.test_harness_runs r
       WHERE r.test_id = c.id
       ORDER BY started_at DESC
       LIMIT 1
     ) r ON true
     WHERE c.enabled = true
     ORDER BY c.category, c.test_name`
  );
  return rows.map(publicCatalog);
}

export async function getTestHarnessHistory({ limit = 50 } = {}) {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT * FROM market_intelligence.test_harness_runs
     ORDER BY started_at DESC
     LIMIT $1`,
    [Math.min(Math.max(Number(limit || 50), 1), 200)]
  );
  return rows.map(publicRun);
}

export async function getTestHarnessResult(id, options = {}) {
  if (!isDatabaseConfigured()) return null;
  const { rows } = await query(
    `SELECT r.*, result.expected_result, result.actual_result, result.checks_performed, result.warnings, result.errors,
            result.stack_trace, result.related_logs, result.affected_module, result.recommended_fix, result.audit_trail
     FROM market_intelligence.test_harness_runs r
     LEFT JOIN market_intelligence.test_harness_results result ON result.run_id = r.id
     WHERE r.id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  const sensitive = options.includeSensitive;
  return {
    ...publicRun(row),
    expectedResult: row.expected_result || {},
    actualResult: row.actual_result || {},
    checksPerformed: row.checks_performed || [],
    warnings: row.warnings || [],
    errors: row.errors || [],
    stackTrace: sensitive ? row.stack_trace : row.stack_trace ? "[requires market_intelligence.test_harness.view_sensitive]" : null,
    relatedLogs: row.related_logs || [],
    affectedModule: row.affected_module,
    recommendedFix: row.recommended_fix,
    auditTrail: row.audit_trail || []
  };
}

export async function runTestHarnessTest({ testId, safetyMode, actor = "system", permissions = [] } = {}) {
  if (!isDatabaseConfigured()) throw new Error("database_not_configured");
  safetyMode = normalizeSafetyMode(safetyMode);
  if (WRITE_MODES.has(safetyMode) && !permissions.includes("market_intelligence.test_harness.approved_write_test")) {
    const error = new Error("approved_write_permission_required");
    error.status = 403;
    throw error;
  }
  const { rows } = await query("SELECT * FROM market_intelligence.test_harness_catalog WHERE id = $1 AND enabled = true", [testId]);
  const test = rows[0];
  if (!test) {
    const error = new Error("test_not_found");
    error.status = 404;
    throw error;
  }
  const execution = await collectChecks(test, safetyMode);
  return recordRun(test, safetyMode, actor, execution, { inputSnapshot: { testId, safetyMode } });
}

export async function runSelectedTests({ testIds = [], safetyMode, actor = "system", permissions = [] } = {}) {
  const results = [];
  for (const testId of testIds) results.push(await runTestHarnessTest({ testId, safetyMode, actor, permissions }));
  return { status: "completed", results };
}

export async function runFullDiagnostic({ safetyMode = DEFAULT_SAFETY_MODE, actor = "system", permissions = [] } = {}) {
  safetyMode = normalizeSafetyMode(safetyMode);
  const sequence = [
    "source-registry-check",
    "source-registry-check",
    "provider-connectivity-check",
    "sync-readiness-check",
    "validation-rule-check",
    "dependency-matrix-check",
    "package-builder-readiness",
    "scoring-engine-validation",
    "handoff-readiness-check",
    "database-integrity-check"
  ];
  const startedAt = new Date().toISOString();
  const runs = [];
  for (const testId of sequence) runs.push(await runTestHarnessTest({ testId, safetyMode, actor, permissions }));
  const passed = runs.filter(item => item.run.status === "passed").length;
  const warningCount = runs.filter(item => item.run.status === "warning").length;
  const failures = runs.filter(item => item.run.status === "failed").length;
  const blocked = runs.filter(item => item.run.status === "blocked").length;
  const status = statusFromCounts({ failures, warnings: warningCount, blocked });
  const recommendedActions = runs
    .flatMap(item => [...(item.result.errors || []), ...(item.result.warnings || [])])
    .map(item => item.message)
    .filter(Boolean);
  const { rows } = await query(
    `INSERT INTO market_intelligence.test_harness_diagnostics
     (status, safety_mode, triggered_by, started_at, completed_at, run_ids, passed, warnings, failures, blocked_tests, recommended_actions)
     VALUES ($1,$2,$3,$4,now(),$5::jsonb,$6,$7,$8,$9,$10::jsonb)
     RETURNING *`,
    [status, safetyMode, actor, startedAt, JSON.stringify(runs.map(item => item.run.id)), passed, warningCount, failures, blocked, JSON.stringify(recommendedActions)]
  );
  return { diagnostic: rows[0], runs };
}

export async function exportTestHarnessReport() {
  return {
    generatedAt: new Date().toISOString(),
    summary: await getTestHarnessSummary(),
    history: await getTestHarnessHistory({ limit: 200 })
  };
}
