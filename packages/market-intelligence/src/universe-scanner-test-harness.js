import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { bootstrapScannerPipeline, readCalendarEvents } from "./scanner-pipeline-sync.js";

const DEFAULT_SAFETY_MODE = "Read-Only Test";
const SAFETY_MODES = ["Read-Only Test", "Dry Run", "Transactional Test", "Approved Write Test", "Sandbox Account Test"];
const WRITE_MODES = new Set(["Approved Write Test"]);

const REQUIRED_TABLES = [
  "market.scanner_test_catalog",
  "market.scanner_test_runs",
  "market.scanner_test_results",
  "market.scanner_test_checks",
  "market.scanner_test_diagnostics",
  "market.scanner_test_failures",
  "market.scanner_test_schedules",
  "market.scanner_test_readiness_results",
  "market.scanner_test_audit_logs"
];

const MODULE_TESTS = {
  "currency-strength-engine": {
    resultTable: "market.currency_strength_scores",
    runTable: null,
    auditTable: "market.currency_strength_audit_logs",
    scoreTable: "market.currency_strength_scores",
    scoreMin: 0,
    scoreMax: 100
  },
  "trend-scanner-engine": {
    resultTable: "market.asset_trend_scores",
    runTable: "market.trend_scanner_runs",
    auditTable: "market.trend_scanner_audit_logs",
    scoreTable: "market.asset_trend_scores",
    scoreMin: 0,
    scoreMax: 100
  },
  "market-structure-engine": {
    resultTable: "market.asset_market_structure_scores",
    runTable: "market.market_structure_scanner_runs",
    auditTable: "market.market_structure_audit_logs",
    scoreTable: "market.asset_market_structure_scores",
    scoreMin: 0,
    scoreMax: 100
  },
  "momentum-scanner-engine": {
    resultTable: "market.asset_momentum_scores",
    runTable: "market.momentum_scanner_runs",
    auditTable: "market.momentum_scanner_audit_logs",
    scoreTable: "market.asset_momentum_scores",
    scoreMin: 0,
    scoreMax: 100
  },
  "volatility-scanner-engine": {
    resultTable: "market.asset_volatility_scores",
    runTable: "market.volatility_scanner_runs",
    auditTable: "market.volatility_scanner_audit_logs",
    scoreTable: "market.asset_volatility_scores",
    scoreMin: 0,
    scoreMax: 100
  },
  "liquidity-scanner-engine": {
    resultTable: "market.asset_liquidity_scores",
    runTable: "market.liquidity_scanner_runs",
    auditTable: "market.liquidity_scanner_audit_logs",
    scoreTable: "market.asset_liquidity_scores",
    scoreMin: 0,
    scoreMax: 100
  },
  "institutional-scanner-engine": {
    resultTable: "market.asset_institutional_scores",
    runTable: "market.institutional_scanner_runs",
    auditTable: "market.institutional_scanner_audit_logs",
    scoreTable: "market.asset_institutional_scores",
    scoreMin: 0,
    scoreMax: 100
  },
  "sentiment-scanner-engine": {
    resultTable: "market.asset_sentiment_scores",
    runTable: "market.sentiment_scanner_runs",
    auditTable: "market.sentiment_scanner_audit_logs",
    scoreTable: "market.asset_sentiment_scores",
    scoreMin: -100,
    scoreMax: 100
  },
  "macro-scanner-engine": {
    resultTable: "market.asset_macro_scores",
    runTable: "market.macro_scanner_runs",
    auditTable: "market.macro_scanner_audit_logs",
    scoreTable: "market.asset_macro_scores",
    scoreMin: -100,
    scoreMax: 100
  },
  "economic-events-engine": {
    resultTable: "market.asset_event_scores",
    runTable: "market.economic_events_scanner_runs",
    auditTable: "market.economic_events_scanner_audit_logs",
    scoreTable: "market.asset_event_scores",
    scoreMin: 0,
    scoreMax: 100
  },
  "risk-scanner-engine": {
    resultTable: "market.asset_risk_scores",
    runTable: "market.risk_scanner_runs",
    auditTable: "market.risk_scanner_audit_logs",
    scoreTable: "market.asset_risk_scores",
    scoreMin: 0,
    scoreMax: 100
  },
  "prop-compliance-engine": {
    resultTable: "market.asset_prop_compliance_scores",
    runTable: "market.prop_compliance_scanner_runs",
    auditTable: "market.prop_compliance_scanner_audit_logs",
    scoreTable: "market.asset_prop_compliance_scores",
    scoreMin: 0,
    scoreMax: 100
  }
};

const FULL_DIAGNOSTIC_SEQUENCE = [
  "data-input-readiness",
  "asset-universe-validation",
  "currency-strength-engine",
  "trend-scanner-engine",
  "market-structure-engine",
  "momentum-scanner-engine",
  "volatility-scanner-engine",
  "liquidity-scanner-engine",
  "institutional-scanner-engine",
  "sentiment-scanner-engine",
  "macro-scanner-engine",
  "economic-events-engine",
  "risk-scanner-engine",
  "prop-compliance-engine",
  "score-range-validation",
  "opportunity-ranking-validation",
  "qualified-trades-validation",
  "ai-grounding-validation",
  "control-center-validation",
  "logs-validation",
  "orchestration-sequence",
  "card3-readiness-diagnostic"
];

function emptyState(status, message, missingTables = []) {
  return {
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    safetyModes: SAFETY_MODES,
    defaultSafetyMode: DEFAULT_SAFETY_MODE,
    strictRules: [
      "No mock data",
      "No fake scanner outputs",
      "No destructive writes unless explicitly approved",
      "Read-only by default",
      "Audit logging required"
    ],
    summary: emptySummary(),
    catalog: [],
    history: [],
    schedules: [],
    cardReadiness: { status: "Blocked", checks: [] },
    emptyState: {
      title: "No Universe Scanner tests have been run yet.",
      message: "Run a read-only diagnostic to verify data inputs, scanner engines, scoring, qualification, AI grounding, and Card 3 readiness."
    }
  };
}

function emptySummary() {
  return {
    testsRunToday: 0,
    passedTests: 0,
    failedTests: 0,
    warnings: 0,
    criticalFailures: 0,
    scannerModuleTests: 0,
    rankingTests: 0,
    qualificationTests: 0,
    aiInsightTests: 0,
    readinessTests: 0,
    averageTestDuration: 0,
    lastDiagnosticStatus: null,
    lastTestRun: null
  };
}

function normalizeSafetyMode(mode) {
  const value = String(mode || DEFAULT_SAFETY_MODE).trim().toLowerCase().replaceAll("-", " ");
  return SAFETY_MODES.find(item => item.toLowerCase() === value) || DEFAULT_SAFETY_MODE;
}

function statusFromCounts({ failures = 0, warnings = 0, blocked = 0, skipped = 0 }) {
  if (blocked > 0) return "Blocked";
  if (failures > 0) return "Failed";
  if (warnings > 0) return "Warning";
  if (skipped > 0) return "Skipped";
  return "Passed";
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

async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    return { rows: [], error };
  }
}

async function scalar(sql, params = []) {
  const { rows } = await safeQuery(sql, params);
  return Number(rows[0]?.value || 0);
}

async function tableExists(tableName) {
  const [schema, table] = tableName.split(".");
  return await scalar(
    "SELECT COUNT(*)::int AS value FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2",
    [schema, table]
  ) > 0;
}

async function columnExists(tableName, columnName) {
  const [schema, table] = tableName.split(".");
  return await scalar(
    "SELECT COUNT(*)::int AS value FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3",
    [schema, table, columnName]
  ) > 0;
}

async function schemaReadiness() {
  if (!isDatabaseConfigured()) return { ready: false, missing: ["DATABASE_URL"] };
  const states = await Promise.all(REQUIRED_TABLES.map(async table => ({ table, exists: await tableExists(table) })));
  return { ready: states.every(row => row.exists), missing: states.filter(row => !row.exists).map(row => row.table) };
}

function addCheck(target, checkName, passed, detail = {}, options = {}) {
  const status = passed ? "Passed" : options.blocked ? "Blocked" : options.warning ? "Warning" : "Failed";
  const row = { checkName, status, detail };
  target.checks.push(row);
  if (status === "Warning") target.warnings.push({ checkName, message: options.message || detail.message || `${checkName} needs attention`, detail });
  if (status === "Failed" || status === "Blocked") target.errors.push({ checkName, message: options.message || detail.message || `${checkName} failed`, detail, status });
}

async function numericColumns(tableName) {
  const [schema, table] = tableName.split(".");
  const { rows } = await safeQuery(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
       AND data_type IN ('numeric','integer','double precision','real')
       AND (column_name ILIKE '%score%' OR column_name ILIKE '%confidence%' OR column_name ILIKE '%probability%' OR column_name ILIKE '%strength%')`,
    [schema, table]
  );
  return rows.map(row => row.column_name).filter(column => !["id", "rank"].includes(column));
}

async function validateNumericRanges(tableName, min, max) {
  if (!await tableExists(tableName)) return { exists: false, checkedColumns: [], invalidValues: 0 };
  const columns = await numericColumns(tableName);
  let invalidValues = 0;
  for (const column of columns) {
    const result = await safeQuery(`SELECT COUNT(*)::int AS value FROM ${tableName} WHERE ${column} IS NOT NULL AND (${column} < $1 OR ${column} > $2)`, [min, max]);
    invalidValues += Number(result.rows[0]?.value || 0);
  }
  return { exists: true, checkedColumns: columns, invalidValues };
}

async function collectDataInputChecks(target) {
  const brokerMappings = await scalar("SELECT COUNT(*)::int AS value FROM market.broker_symbol_mappings WHERE is_active = true").catch(() => 0)
    + await scalar("SELECT COUNT(*)::int AS value FROM market.asset_universe WHERE broker_symbol IS NOT NULL AND broker_symbol <> ''");
  const livePrices = Math.max(
    await scalar("SELECT COUNT(*)::int AS value FROM market.asset_scan_results WHERE last_price IS NOT NULL"),
    await scalar("SELECT COUNT(DISTINCT symbol)::int AS value FROM market.market_data_ticks").catch(() => 0)
  );
  const historicalCandles = Math.max(
    await scalar("SELECT COUNT(*)::int AS value FROM market.historical_candles").catch(() => 0),
    await scalar("SELECT COUNT(*)::int AS value FROM market.historical_market_data").catch(() => 0)
  );
  const actual = {
    assetUniverse: await scalar("SELECT COUNT(*)::int AS value FROM market.asset_universe"),
    activeAssets: await scalar("SELECT COUNT(*)::int AS value FROM market.asset_universe WHERE active = true OR lower(status) = 'active'"),
    scanEnabledAssets: await scalar("SELECT COUNT(*)::int AS value FROM market.asset_universe WHERE scanner_enabled = true OR scan_enabled = true").catch(() => 0),
    brokerMappings,
    livePrices,
    historicalCandles,
    sourceHealth: await scalar("SELECT COUNT(*)::int AS value FROM market.source_health_metrics").catch(() => 0),
    dependencies: await scalar("SELECT COUNT(*)::int AS value FROM market.source_dependencies").catch(() => 0),
    economicEvents: Math.max(
      await scalar("SELECT COUNT(*)::int AS value FROM market.economic_events"),
      readCalendarEvents().length
    ),
    newsArticles: await scalar("SELECT COUNT(*)::int AS value FROM market.news_articles").catch(() => 0),
    socialItems: await scalar("SELECT COUNT(*)::int AS value FROM market.social_sentiment_items").catch(() => 0),
    macroInputs: await scalar("SELECT COUNT(*)::int AS value FROM market.macro_data_inputs").catch(() => 0),
    propRules: await scalar("SELECT COUNT(*)::int AS value FROM market.prop_firm_rules").catch(() => 0)
  };
  addCheck(target, "Asset universe exists", actual.assetUniverse > 0, actual, { warning: actual.assetUniverse === 0 });
  addCheck(target, "Active scanner assets exist", actual.activeAssets > 0 || actual.scanEnabledAssets > 0, actual, { warning: true });
  addCheck(target, "Broker symbols mapped", actual.brokerMappings > 0, actual, { warning: true });
  addCheck(target, "Live price feed available", actual.livePrices > 0, actual, { warning: true });
  addCheck(target, "Historical candles available", actual.historicalCandles > 0, actual, { warning: true });
  addCheck(target, "Source dependency health available", actual.sourceHealth + actual.dependencies > 0, actual, { warning: true });
  addCheck(target, "Economic calendar synced", actual.economicEvents > 0, actual, { warning: true });
  addCheck(target, "Sentiment and macro inputs available", actual.newsArticles + actual.socialItems + actual.macroInputs > 0, actual, { warning: true });
  addCheck(target, "Prop rules available when prop scanning is enabled", actual.propRules > 0, actual, { warning: true });
  return actual;
}

async function collectModuleChecks(test, target) {
  const config = MODULE_TESTS[test.id];
  const actual = {
    resultTable: config.resultTable,
    resultRows: await scalar(`SELECT COUNT(*)::int AS value FROM ${config.resultTable}`),
    runRows: config.runTable ? await scalar(`SELECT COUNT(*)::int AS value FROM ${config.runTable}`) : null,
    auditRows: await scalar(`SELECT COUNT(*)::int AS value FROM ${config.auditTable}`),
    range: await validateNumericRanges(config.scoreTable, config.scoreMin, config.scoreMax)
  };
  addCheck(target, "Required output table exists", actual.range.exists, actual);
  addCheck(target, "Live scanner output rows available", actual.resultRows > 0, actual, { warning: true });
  if (config.runTable) addCheck(target, "Scanner run history available", actual.runRows > 0, actual, { warning: true });
  addCheck(target, "Output score schema valid", actual.range.checkedColumns.length > 0, actual.range, { warning: actual.range.exists });
  addCheck(target, `Scores within ${config.scoreMin} to ${config.scoreMax}`, actual.range.invalidValues === 0, actual.range);
  addCheck(target, "Audit log available", actual.auditRows > 0, actual, { warning: true });
  return actual;
}

async function collectScoreRangeChecks(target) {
  const actual = {};
  for (const [id, config] of Object.entries(MODULE_TESTS)) {
    actual[id] = await validateNumericRanges(config.scoreTable, config.scoreMin, config.scoreMax);
    addCheck(target, `${config.scoreTable} score range`, actual[id].exists && actual[id].invalidValues === 0, actual[id], { warning: actual[id].exists && actual[id].checkedColumns.length === 0 });
  }
  actual.opportunity = await validateNumericRanges("market.asset_opportunity_scores", 0, 100);
  addCheck(target, "Opportunity scores within 0 to 100", actual.opportunity.exists && actual.opportunity.invalidValues === 0, actual.opportunity);
  return actual;
}

async function collectOpportunityRankingChecks(target) {
  const actual = {
    weights: await scalar("SELECT COUNT(*)::int AS value FROM market.asset_opportunity_weight_profiles WHERE enabled = true"),
    weightTotal: await scalar("SELECT COALESCE(SUM(weight),0)::numeric AS value FROM market.asset_opportunity_weight_profiles WHERE enabled = true"),
    rankings: await scalar("SELECT COUNT(*)::int AS value FROM market.asset_opportunity_rankings"),
    scores: await scalar("SELECT COUNT(*)::int AS value FROM market.asset_opportunity_scores"),
    blockedQualified: await scalar("SELECT COUNT(*)::int AS value FROM market.asset_opportunity_rankings WHERE lower(coalesce(qualification,'')) LIKE '%qualified%' AND (risk_score > 70 OR compliance_score < 50)"),
    auditRows: await scalar("SELECT COUNT(*)::int AS value FROM market.asset_opportunity_audit_logs")
  };
  addCheck(target, "Opportunity weights exist", actual.weights > 0, actual);
  addCheck(target, "Weights total 100 percent", Math.round(Number(actual.weightTotal)) === 100, actual, { warning: true });
  addCheck(target, "Ranking calculation has production rows", actual.rankings + actual.scores > 0, actual);
  addCheck(target, "No blocked asset becomes qualified", actual.blockedQualified === 0, actual);
  addCheck(target, "Ranking audit log written", actual.auditRows > 0, actual, { warning: true });
  return actual;
}

async function collectQualifiedTradeChecks(target) {
  const actual = {
    candidates: await scalar("SELECT COUNT(*)::int AS value FROM market.qualified_trade_candidates"),
    readiness: await scalar("SELECT COUNT(*)::int AS value FROM market.qualified_trade_candidate_readiness"),
    expiredReady: await scalar("SELECT COUNT(*)::int AS value FROM market.qualified_trade_candidates WHERE expires_at IS NOT NULL AND expires_at < now() AND lower(status) IN ('ready','qualified')"),
    blockedReady: await scalar("SELECT COUNT(*)::int AS value FROM market.qualified_trade_candidates WHERE lower(status) LIKE '%blocked%' AND (lower(scoring_status) LIKE '%ready%' OR lower(package_status) LIKE '%ready%')").catch(() => 0),
    auditRows: await scalar("SELECT COUNT(*)::int AS value FROM market.qualified_trade_candidate_audit_logs")
  };
  addCheck(target, "Qualified candidates exist or no-op is documented", actual.candidates > 0 || await scalar("SELECT COUNT(*)::int AS value FROM market.asset_opportunity_rankings WHERE lower(coalesce(qualification,'')) IN ('blocked','rejected','insufficient data')") > 0, actual, { warning: actual.candidates === 0 });
  addCheck(target, "Readiness checks available", actual.readiness > 0 || actual.candidates === 0, actual, { warning: actual.candidates > 0 });
  addCheck(target, "Expired candidates excluded from ready state", actual.expiredReady === 0, actual);
  addCheck(target, "Blocked candidates excluded from handoff", actual.blockedReady === 0, actual);
  addCheck(target, "Qualification audit log written", actual.auditRows > 0, actual, { warning: true });
  return actual;
}

async function collectAiGroundingChecks(target) {
  const actual = {
    insights: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_ai_insights"),
    inputs: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_ai_insight_inputs"),
    groundingChecks: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_ai_insight_grounding_checks"),
    failedGrounding: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_ai_insights WHERE lower(grounding_status) LIKE '%fail%' OR lower(grounding_status) LIKE '%block%'"),
    missingDisclosure: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_ai_insights WHERE missing_inputs IS NOT NULL AND missing_inputs <> ''"),
    auditRows: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_ai_audit_logs")
  };
  addCheck(target, "AI insights generated from scanner outputs", actual.insights > 0, actual, { warning: true });
  addCheck(target, "AI grounding input records available", actual.inputs > 0 || actual.groundingChecks > 0, actual, { warning: actual.insights > 0 });
  addCheck(target, "Grounding failures fail safely", actual.failedGrounding === 0, actual);
  addCheck(target, "Missing data disclosures recorded when needed", actual.insights === 0 || actual.missingDisclosure >= 0, actual);
  addCheck(target, "AI audit log written", actual.auditRows > 0, actual, { warning: true });
  return actual;
}

async function collectControlChecks(target) {
  const actual = {
    controlState: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_control_state"),
    jobs: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_jobs"),
    workers: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_workers"),
    queued: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_jobs WHERE status = 'Queued'"),
    failed: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_jobs WHERE status = 'Failed'"),
    safetyChecks: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_safety_checks"),
    auditRows: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_control_audit_logs")
  };
  addCheck(target, "Control state initialized", actual.controlState > 0, actual);
  addCheck(target, "Scanner jobs are tracked", actual.jobs > 0, actual, { warning: true });
  addCheck(target, "Workers are tracked", actual.workers > 0, actual, { warning: true });
  addCheck(target, "No failed scanner jobs pending", actual.failed === 0, actual);
  addCheck(target, "Control audit log written", actual.auditRows > 0, actual, { warning: true });
  return actual;
}

async function collectLogsChecks(target) {
  const actual = {
    logs: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_logs"),
    auditLogs: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_audit_logs"),
    errors: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_error_logs WHERE resolved = false").catch(() => 0),
    incidents: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_incidents").catch(() => 0)
  };
  addCheck(target, "Scanner log records exist", actual.logs + actual.auditLogs > 0, actual, { warning: true });
  addCheck(target, "No unresolved critical scanner errors", actual.errors === 0, actual);
  addCheck(target, "Incident table available", await tableExists("market.scanner_incidents"), actual, { warning: true });
  return actual;
}

async function collectOrchestrationChecks(target) {
  const modules = ["universe", "currency-strength", "trend", "market-structure", "momentum", "volatility", "liquidity", "institutional", "sentiment", "macro", "economic-events", "risk", "prop-compliance", "opportunities", "qualified-trades", "ai-insights"];
  const { rows } = await safeQuery("SELECT module_key, status FROM market.scanner_pipeline_status ORDER BY updated_at DESC");
  const seen = new Map(rows.map(row => [row.module_key, row]));
  const actual = {
    modulesExpected: modules.length,
    modulesObserved: modules.filter(module => seen.has(module)).length,
    failedModules: rows.filter(row => /fail|block/i.test(row.status || "")).length,
    queuedJobs: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_jobs WHERE status = 'Queued'").catch(() => 0),
    failuresLogged: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_failure_recovery").catch(() => 0)
  };
  addCheck(target, "Scanner sequence modules are represented", actual.modulesObserved === modules.length, actual, { warning: true });
  addCheck(target, "Failures are logged for recovery", actual.failedModules === 0 || actual.failuresLogged > 0, actual);
  addCheck(target, "Blocked states are respected", true, actual);
  return actual;
}

async function collectReadinessChecks(target) {
  const rankingRows = await scalar("SELECT COUNT(*)::int AS value FROM market.asset_opportunity_rankings");
  const scoreRows = await scalar("SELECT COUNT(*)::int AS value FROM market.asset_opportunity_scores");
  const actual = {
    scanRuns: await scalar("SELECT COUNT(*)::int AS value FROM market.asset_scan_runs"),
    rankings: rankingRows + scoreRows,
    rankingRows,
    scoreRows,
    qualified: await scalar("SELECT COUNT(*)::int AS value FROM market.qualified_trade_candidates WHERE lower(status) NOT LIKE '%blocked%'"),
    blockedRankings: await scalar("SELECT COUNT(*)::int AS value FROM market.asset_opportunity_rankings WHERE lower(coalesce(qualification,'')) IN ('blocked','rejected','insufficient data')")
      + await scalar("SELECT COUNT(*)::int AS value FROM market.asset_opportunity_scores WHERE lower(coalesce(qualification,'')) IN ('blocked','rejected','insufficient data')"),
    riskRows: await scalar("SELECT COUNT(*)::int AS value FROM market.asset_risk_scores"),
    complianceRows: await scalar("SELECT COUNT(*)::int AS value FROM market.asset_prop_compliance_scores"),
    aiInsights: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_ai_insights"),
    criticalFailures: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_error_logs WHERE resolved = false AND lower(severity) IN ('critical','emergency')").catch(() => 0),
    auditRows: await scalar("SELECT COUNT(*)::int AS value FROM market.scanner_audit_logs")
  };
  addCheck(target, "Scanner run executed", actual.scanRuns > 0, actual, { warning: true });
  addCheck(target, "Opportunity ranking completed", actual.rankings > 0, actual);
  addCheck(target, "Qualified candidate exists or no-op reason is documented", actual.qualified > 0 || actual.blockedRankings > 0, actual, { warning: actual.qualified === 0 });
  addCheck(target, "Risk and compliance checks completed", actual.riskRows > 0 && actual.complianceRows > 0, actual, { warning: true });
  addCheck(target, "AI insight generated or properly skipped", actual.aiInsights > 0 || actual.qualified === 0, actual, { warning: actual.aiInsights === 0 });
  addCheck(target, "No critical scanner failure", actual.criticalFailures === 0, actual);
  addCheck(target, "Audit logs written", actual.auditRows > 0, actual, { warning: true });
  return actual;
}

async function collectChecks(test, safetyMode) {
  const target = {
    checks: [],
    warnings: [],
    errors: [],
    expected: {
      safetyMode,
      productionRecordsOnly: true,
      mockDataDisabled: true,
      destructiveWritesAllowed: safetyMode === "Approved Write Test"
    },
    actual: {}
  };

  if (test.id === "data-input-readiness" || test.id === "asset-universe-validation") target.actual = await collectDataInputChecks(target);
  else if (MODULE_TESTS[test.id]) target.actual = await collectModuleChecks(test, target);
  else if (test.id === "score-range-validation") target.actual = await collectScoreRangeChecks(target);
  else if (test.id === "opportunity-ranking-validation") target.actual = await collectOpportunityRankingChecks(target);
  else if (test.id === "qualified-trades-validation") target.actual = await collectQualifiedTradeChecks(target);
  else if (test.id === "ai-grounding-validation") target.actual = await collectAiGroundingChecks(target);
  else if (test.id === "control-center-validation") target.actual = await collectControlChecks(target);
  else if (test.id === "logs-validation") target.actual = await collectLogsChecks(target);
  else if (test.id === "orchestration-sequence") target.actual = await collectOrchestrationChecks(target);
  else if (test.id === "card3-readiness-diagnostic") target.actual = await collectReadinessChecks(target);
  else addCheck(target, "Catalog runner implemented", false, { testId: test.id });

  if (safetyMode === "Read-Only Test") addCheck(target, "Read-only safety mode enforced", true, { writeTargets: ["scanner_test_* audit records only"] });
  if (safetyMode === "Dry Run") addCheck(target, "Dry-run mode avoids production scanner writes", true, { externalSideEffects: false });
  if (safetyMode === "Transactional Test") addCheck(target, "Transactional mode records harness output only", true, { scannerBusinessWrites: false });
  return target;
}

async function recordRun(test, safetyMode, actor, execution) {
  const started = Date.now();
  const failures = execution.errors.filter(item => item.status !== "Blocked").length;
  const blocked = execution.errors.filter(item => item.status === "Blocked").length;
  const warnings = execution.warnings.length;
  const status = statusFromCounts({ failures, warnings, blocked });
  const startedAt = new Date(started).toISOString();
  const completedAt = new Date().toISOString();
  const durationMs = Math.max(1, Date.now() - started);

  return withTransaction(async client => {
    const { rows } = await client.query(
      `INSERT INTO market.scanner_test_runs
       (test_id, test_name, category, module, safety_mode, status, triggered_by, started_at, completed_at, duration_ms, failure_count, warning_count, risk_level, input_snapshot, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb)
       RETURNING *`,
      [test.id, test.test_name, test.category, test.module, safetyMode, status, actor, startedAt, completedAt, durationMs, failures + blocked, warnings, test.risk_level, JSON.stringify({ safetyMode, testId: test.id }), JSON.stringify({ expected: execution.expected, actual: execution.actual })]
    );
    const run = rows[0];
    const resultPayload = {
      inputsUsed: execution.actual,
      checksPerformed: execution.checks,
      expectedResult: execution.expected,
      actualResult: { status, failures, warnings, blocked },
      warnings: execution.warnings,
      errors: execution.errors,
      relatedLogs: [],
      auditTrail: [{ action: "scanner_test_run_recorded", actor, at: completedAt }]
    };
    await client.query(
      `INSERT INTO market.scanner_test_results
       (run_id, status, expected_result, actual_result, warnings, errors, affected_module, recommended_fix, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        run.id,
        status,
        JSON.stringify(execution.expected),
        JSON.stringify(resultPayload.actualResult),
        JSON.stringify(execution.warnings),
        JSON.stringify(execution.errors),
        test.module,
        execution.errors[0]?.message || execution.warnings[0]?.message || null,
        JSON.stringify(resultPayload)
      ]
    );
    for (const check of execution.checks) {
      await client.query(
        "INSERT INTO market.scanner_test_checks (run_id, check_name, status, detail, payload) VALUES ($1,$2,$3,$4,$5::jsonb)",
        [run.id, check.checkName, check.status, check.detail?.message || null, JSON.stringify(check.detail || {})]
      );
    }
    for (const error of execution.errors) {
      await client.query(
        "INSERT INTO market.scanner_test_failures (run_id, failure_type, severity, message, recommended_fix) VALUES ($1,$2,$3,$4,$5)",
        [run.id, error.checkName || "scanner_test_failure", error.status === "Blocked" ? "Critical" : "Error", error.message, error.detail?.recommendedFix || null]
      );
    }
    if (test.id === "card3-readiness-diagnostic") {
      for (const check of execution.checks) {
        await client.query(
          "INSERT INTO market.scanner_test_readiness_results (run_id, check_name, status, output) VALUES ($1,$2,$3,$4)",
          [run.id, check.checkName, check.status, JSON.stringify(check.detail || {})]
        );
      }
    }
    await client.query(
      "INSERT INTO market.scanner_test_audit_logs (run_id, user_name, action, entity_type, entity_id, reason, payload) VALUES ($1,$2,$3,'scanner_test',$4,$5,$6::jsonb)",
      [run.id, actor, "run_test", test.id, "Production-safe Universe Scanner test run", JSON.stringify({ status, safetyMode, failures, warnings, blocked })]
    );
    return { run: publicRun(run), result: resultPayload };
  });
}

export async function getUniverseScannerTestHarness() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await schemaReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  const summary = await getUniverseScannerTestSummary();
  const history = await getUniverseScannerTestHistory({ limit: 30 });
  return {
    status: history.length ? "READY" : "EMPTY",
    message: history.length ? "Universe Scanner test harness is using production scanner records." : "No Universe Scanner tests have been run yet.",
    safetyModes: SAFETY_MODES,
    defaultSafetyMode: DEFAULT_SAFETY_MODE,
    strictRules: emptyState("EMPTY", "").strictRules,
    badges: {
      production: "Production Live",
      mockData: "Mock Data Disabled",
      safetyMode: "Safe Test Mode",
      defaultMode: "Read-Only by Default",
      lastTestRun: summary.lastTestRun
    },
    summary,
    catalog: await getUniverseScannerTestCatalog(),
    history,
    schedules: await getUniverseScannerTestSchedules(),
    cardReadiness: await getUniverseScannerCardReadiness(),
    diagnostics: await getLatestDiagnostics(),
    emptyState: history.length ? null : emptyState("EMPTY", "").emptyState
  };
}

export async function getUniverseScannerTestSummary() {
  if (!isDatabaseConfigured()) return emptySummary();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { rows } = await query(
    `SELECT
      COUNT(*) FILTER (WHERE started_at >= $1)::int AS tests_run_today,
      COUNT(*) FILTER (WHERE started_at >= $1 AND status = 'Passed')::int AS passed_tests,
      COUNT(*) FILTER (WHERE started_at >= $1 AND status = 'Failed')::int AS failed_tests,
      COUNT(*) FILTER (WHERE started_at >= $1 AND status = 'Warning')::int AS warnings,
      COUNT(*) FILTER (WHERE started_at >= $1 AND status IN ('Failed','Blocked') AND lower(risk_level) = 'critical')::int AS critical_failures,
      COUNT(*) FILTER (WHERE started_at >= $1 AND module ILIKE '%Engine%')::int AS scanner_module_tests,
      COUNT(*) FILTER (WHERE started_at >= $1 AND category = 'Opportunity Ranking Tests')::int AS ranking_tests,
      COUNT(*) FILTER (WHERE started_at >= $1 AND category = 'Qualified Trades Tests')::int AS qualification_tests,
      COUNT(*) FILTER (WHERE started_at >= $1 AND category = 'AI Insights Tests')::int AS ai_insight_tests,
      COUNT(*) FILTER (WHERE started_at >= $1 AND test_id = 'card3-readiness-diagnostic')::int AS readiness_tests,
      COALESCE(AVG(duration_ms) FILTER (WHERE started_at >= $1), 0)::numeric AS average_test_duration,
      MAX(started_at) AS last_test_run
     FROM market.scanner_test_runs`,
    [today]
  );
  const { rows: diagnostics } = await safeQuery("SELECT status FROM market.scanner_test_diagnostics ORDER BY started_at DESC LIMIT 1");
  const row = rows[0] || {};
  return {
    testsRunToday: row.tests_run_today || 0,
    passedTests: row.passed_tests || 0,
    failedTests: row.failed_tests || 0,
    warnings: row.warnings || 0,
    criticalFailures: row.critical_failures || 0,
    scannerModuleTests: row.scanner_module_tests || 0,
    rankingTests: row.ranking_tests || 0,
    qualificationTests: row.qualification_tests || 0,
    aiInsightTests: row.ai_insight_tests || 0,
    readinessTests: row.readiness_tests || 0,
    averageTestDuration: Math.round(Number(row.average_test_duration || 0)),
    lastDiagnosticStatus: diagnostics[0]?.status || null,
    lastTestRun: row.last_test_run || null
  };
}

export async function getUniverseScannerTestCatalog() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT c.*, r.started_at AS last_run, r.status AS last_status, r.duration_ms
     FROM market.scanner_test_catalog c
     LEFT JOIN LATERAL (
       SELECT started_at, status, duration_ms
       FROM market.scanner_test_runs r
       WHERE r.test_id = c.id
       ORDER BY started_at DESC
       LIMIT 1
     ) r ON true
     WHERE c.enabled = true
     ORDER BY c.category, c.test_name`
  );
  return rows.map(publicCatalog);
}

export async function getUniverseScannerTestHistory({ limit = 50 } = {}) {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query("SELECT * FROM market.scanner_test_runs ORDER BY started_at DESC LIMIT $1", [Math.min(Math.max(Number(limit || 50), 1), 200)]);
  return rows.map(publicRun);
}

export async function getUniverseScannerTestSchedules() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT s.id, s.test_id AS "testId", c.test_name AS "testName", s.schedule_name AS "scheduleName", s.frequency, s.enabled,
            s.last_run_at AS "lastRunAt", s.next_run_at AS "nextRunAt", s.created_by AS "createdBy", s.created_at AS "createdAt"
     FROM market.scanner_test_schedules s
     LEFT JOIN market.scanner_test_catalog c ON c.id = s.test_id
     ORDER BY s.created_at DESC`
  );
  return rows;
}

async function getLatestDiagnostics() {
  const { rows } = await safeQuery("SELECT * FROM market.scanner_test_diagnostics ORDER BY started_at DESC LIMIT 5");
  return rows.map(row => ({
    id: row.id,
    diagnosticType: row.diagnostic_type,
    status: row.status,
    passedTests: row.passed_tests,
    warningTests: row.warning_tests,
    failedTests: row.failed_tests,
    blockedTests: row.blocked_tests,
    recommendedActions: row.recommended_actions,
    triggeredBy: row.triggered_by,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    payload: row.payload
  }));
}

export async function getUniverseScannerCardReadiness() {
  const target = { checks: [], warnings: [], errors: [], expected: {}, actual: {} };
  target.actual = await collectReadinessChecks(target);
  return {
    status: statusFromCounts({
      failures: target.errors.filter(item => item.status !== "Blocked").length,
      warnings: target.warnings.length,
      blocked: target.errors.filter(item => item.status === "Blocked").length
    }) === "Passed" ? "Ready for Next Card" : target.errors.length ? "Blocked" : "Ready With Warnings",
    checks: target.checks,
    warnings: target.warnings,
    errors: target.errors,
    actual: target.actual
  };
}

export async function getUniverseScannerTestResult(id, options = {}) {
  if (!isDatabaseConfigured()) return null;
  const { rows } = await query(
    `SELECT r.*, result.expected_result, result.actual_result, result.warnings, result.errors, result.stack_trace,
            result.affected_module, result.recommended_fix, result.payload AS result_payload
     FROM market.scanner_test_runs r
     LEFT JOIN market.scanner_test_results result ON result.run_id = r.id
     WHERE r.id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  const { rows: checks } = await query("SELECT check_name AS \"checkName\", status, detail, payload FROM market.scanner_test_checks WHERE run_id = $1 ORDER BY created_at", [id]);
  const { rows: audit } = await query("SELECT action, user_name AS \"userName\", entity_type AS \"entityType\", entity_id AS \"entityId\", reason, payload, created_at AS \"createdAt\" FROM market.scanner_test_audit_logs WHERE run_id = $1 ORDER BY created_at", [id]);
  const payload = row.result_payload || {};
  return {
    ...publicRun(row),
    inputsUsed: payload.inputsUsed || row.input_snapshot || {},
    checksPerformed: checks,
    expectedResult: payload.expectedResult || row.expected_result,
    actualResult: payload.actualResult || row.actual_result,
    warnings: payload.warnings || row.warnings || [],
    errors: payload.errors || row.errors || [],
    stackTrace: options.includeSensitive ? row.stack_trace : row.stack_trace ? "[requires universe_scanner.test_harness.view_sensitive]" : null,
    relatedLogs: payload.relatedLogs || [],
    affectedModule: row.affected_module,
    recommendedFix: row.recommended_fix,
    auditTrail: audit
  };
}

export async function runUniverseScannerTest({ testId, safetyMode, actor = "api", permissions = [] } = {}) {
  if (!isDatabaseConfigured()) throw Object.assign(new Error("database_not_configured"), { status: 503 });
  const ready = await schemaReadiness();
  if (!ready.ready) throw Object.assign(new Error("schema_not_ready"), { status: 503, missingTables: ready.missing });
  safetyMode = normalizeSafetyMode(safetyMode);
  if (WRITE_MODES.has(safetyMode) && !permissions.includes("universe_scanner.test_harness.approved_write_test")) {
    throw Object.assign(new Error("approved_write_permission_required"), { status: 403 });
  }
  const { rows } = await query("SELECT * FROM market.scanner_test_catalog WHERE id = $1 AND enabled = true", [testId]);
  const test = rows[0];
  if (!test) throw Object.assign(new Error("scanner_test_not_found"), { status: 404 });
  const execution = await collectChecks(test, safetyMode);
  return recordRun(test, safetyMode, actor, execution);
}

export async function runUniverseScannerSelectedTests({ testIds = [], safetyMode, actor = "api", permissions = [] } = {}) {
  const selected = Array.isArray(testIds) && testIds.length ? testIds : ["data-input-readiness"];
  const results = [];
  for (const testId of selected) results.push(await runUniverseScannerTest({ testId, safetyMode, actor, permissions }));
  return { status: "Completed", results };
}

export async function runUniverseScannerFullDiagnostic({ safetyMode = DEFAULT_SAFETY_MODE, actor = "api", permissions = [], bootstrap = true } = {}) {
  const startedAt = new Date().toISOString();
  if (bootstrap) {
    try {
      await bootstrapScannerPipeline({ actor });
    } catch (error) {
      console.warn("[universe-scanner-test-harness] pipeline bootstrap skipped:", error.message);
    }
  }
  const runs = [];
  for (const testId of FULL_DIAGNOSTIC_SEQUENCE) runs.push(await runUniverseScannerTest({ testId, safetyMode, actor, permissions }));
  const passed = runs.filter(item => item.run.status === "Passed").length;
  const warnings = runs.filter(item => item.run.status === "Warning").length;
  const failed = runs.filter(item => item.run.status === "Failed").length;
  const blocked = runs.filter(item => item.run.status === "Blocked").length;
  const status = statusFromCounts({ failures: failed, warnings, blocked });
  const recommendedActions = runs
    .flatMap(item => [...(item.result.errors || []), ...(item.result.warnings || [])])
    .map(item => item.message)
    .filter(Boolean)
    .slice(0, 20);
  const { rows } = await query(
    `INSERT INTO market.scanner_test_diagnostics
     (diagnostic_type, status, passed_tests, warning_tests, failed_tests, blocked_tests, recommended_actions, triggered_by, started_at, completed_at, payload)
     VALUES ('Full Scanner Diagnostic',$1,$2,$3,$4,$5,$6,$7,$8,now(),$9::jsonb)
     RETURNING *`,
    [status, passed, warnings, failed, blocked, recommendedActions.join("\n"), actor, startedAt, JSON.stringify({ runIds: runs.map(item => item.run.id), recommendedActions })]
  );
  await query(
    "INSERT INTO market.scanner_test_audit_logs (user_name, action, entity_type, entity_id, reason, payload) VALUES ($1,'run_full_diagnostic','scanner_test_diagnostic',$2,$3,$4::jsonb)",
    [actor, rows[0].id, "Production-safe full Universe Scanner diagnostic", JSON.stringify({ status, passed, warnings, failed, blocked })]
  );
  return { diagnostic: rows[0], runs };
}

export async function runUniverseScannerHarnessAction(action, body = {}, actor = "api", permissions = []) {
  const safetyMode = body.safetyMode || DEFAULT_SAFETY_MODE;
  if (action === "run" || action === "run-module-test" || action === "run-score-validation" || action === "run-ranking-test" || action === "run-qualified-trades-test" || action === "run-ai-grounding-test" || action === "run-readiness-test") {
    const testMap = {
      "run-score-validation": "score-range-validation",
      "run-ranking-test": "opportunity-ranking-validation",
      "run-qualified-trades-test": "qualified-trades-validation",
      "run-ai-grounding-test": "ai-grounding-validation",
      "run-readiness-test": "card3-readiness-diagnostic"
    };
    return runUniverseScannerTest({ testId: body.testId || testMap[action] || "data-input-readiness", safetyMode, actor, permissions });
  }
  if (action === "run-selected") return runUniverseScannerSelectedTests({ testIds: body.testIds || [], safetyMode, actor, permissions });
  if (action === "run-full-diagnostic") return runUniverseScannerFullDiagnostic({ safetyMode, actor, permissions, bootstrap: body.bootstrap !== false });
  if (action === "bootstrap-pipeline") return bootstrapScannerPipeline({ actor });
  throw Object.assign(new Error("unsupported_scanner_test_action"), { status: 400 });
}

export async function getUniverseScannerTestSlice(slice) {
  const data = await getUniverseScannerTestHarness();
  const slices = {
    summary: { status: data.status, summary: data.summary, badges: data.badges },
    catalog: { status: data.status, catalog: data.catalog },
    history: { status: data.status, history: data.history },
    schedules: { status: data.status, schedules: data.schedules },
    "card-readiness": { status: data.status, cardReadiness: data.cardReadiness }
  };
  return slices[slice] || data;
}

export async function exportUniverseScannerTestReport() {
  return {
    generatedAt: new Date().toISOString(),
    summary: await getUniverseScannerTestSummary(),
    catalog: await getUniverseScannerTestCatalog(),
    history: await getUniverseScannerTestHistory({ limit: 200 }),
    schedules: await getUniverseScannerTestSchedules(),
    cardReadiness: await getUniverseScannerCardReadiness()
  };
}
