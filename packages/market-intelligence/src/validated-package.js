import { isDatabaseConfigured, query, withTransaction } from "./db.js";

const REQUIRED_TABLES = [
  "workflow.card_outputs",
  "workflow.card_inputs",
  "workflow.card_handoffs",
  "market.validated_intelligence_packages",
  "market.source_validation_results",
  "market.source_evidence",
  "market.validation_audit_logs"
];

const DEPENDENCIES = [
  ["Market Data", "Market Environment Intelligence", "CRITICAL"],
  ["News & Sentiment", "Sentiment Intelligence", "CRITICAL"],
  ["Economic Calendar", "Macro Intelligence", "CRITICAL"],
  ["Social Sentiment", "Sentiment Intelligence", "OPTIONAL"],
  ["Institutional / COT", "Institutional Intelligence", "CRITICAL"],
  ["Historical Data", "Market Environment Intelligence", "CRITICAL"],
  ["Broker Data", "Liquidity Intelligence", "CRITICAL"],
  ["Account Portfolio", "Portfolio Intelligence", "CRITICAL"],
  ["Prop Firm Rules", "Risk Validation", "CRITICAL"]
];

const SOURCE_LABELS = {
  "market-data": "Market Data",
  "news-sentiment": "News & Sentiment",
  "economic-calendar": "Economic Calendar",
  "social-sentiment": "Social Sentiment",
  "institutional-cot-data": "Institutional / COT",
  "institutional-cot": "Institutional / COT",
  "historical-data": "Historical Data",
  "broker-data": "Broker Data",
  "account-portfolio-data": "Account Portfolio",
  "account-portfolio": "Account Portfolio",
  "prop-firm-rules": "Prop Firm Rules"
};

const arr = value => Array.isArray(value) ? value : [];
const j = value => value && typeof value === "object" ? value : {};
const pct = value => value === null || value === undefined || value === "" ? null : Math.round(Number(value));
const healthyStatuses = new Set(["ONLINE", "LIVE", "SYNCED", "READY", "PASSED", "VALIDATED"]);

function packageIdFromDate(date = new Date()) {
  return `VIP-${date.toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
}

function emptyPackage(status, message, missingTables = []) {
  return {
    sourceMode: "DATABASE_ONLY",
    status,
    message,
    schemaReady: false,
    missingTables,
    metadata: {
      packageId: null,
      workflowRunId: null,
      sourceCard: "Card 1",
      targetCard: "Card 2",
      version: null,
      createdAt: null,
      createdBy: null,
      validationStatus: status,
      packageStatus: status
    },
    summary: [],
    sources: [],
    admission: {},
    dependencies: DEPENDENCIES.map(([source, requiredBy, dependencyType]) => ({ source, requiredBy, dependencyType, status: "WAITING" })),
    payload: {},
    evidence: [],
    checks: [],
    lineage: {},
    history: [],
    audit: []
  };
}

async function tableReadiness() {
  const { rows } = await query(
    "SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name",
    [REQUIRED_TABLES]
  );
  return {
    ready: rows.every(row => row.exists),
    missing: rows.filter(row => !row.exists).map(row => row.table_name)
  };
}

async function latestRun() {
  const { rows } = await query("SELECT id, run_key, workflow_id, status, created_at FROM workflow.workflow_runs ORDER BY created_at DESC LIMIT 1");
  return rows[0] || null;
}

async function latestWorkflowRecord(table, cardNumber, runId) {
  const params = [cardNumber];
  let where = "card_number = $1";
  if (runId) {
    params.push(runId);
    where += " AND run_id = $2";
  }
  const { rows } = await query(`SELECT * FROM ${table} WHERE ${where} ORDER BY created_at DESC LIMIT 1`, params);
  return rows[0] || null;
}

async function latestHandoff(runId) {
  const params = [];
  let where = "from_card_number = 1 AND to_card_number = 2";
  if (runId) {
    params.push(runId);
    where += " AND run_id = $1";
  }
  const { rows } = await query(`SELECT * FROM workflow.card_handoffs WHERE ${where} ORDER BY created_at DESC LIMIT 1`, params);
  return rows[0] || null;
}

function sourceDisplayName(source) {
  return SOURCE_LABELS[source.id] || SOURCE_LABELS[source.routeSlug] || source.name || source.source || source.id || "Unknown Source";
}

function sourceValidation(source) {
  return source.validation || source.checks?.quality || (healthyStatuses.has(String(source.status).toUpperCase()) ? "PASSED" : "FAILED");
}

function sourceCoverage(source) {
  if (source.coverage) return String(source.coverage);
  if (source.records !== null && source.records !== undefined) return `${source.records} records`;
  return null;
}

function normalizeSource(source) {
  const status = String(source.status || "UNKNOWN").toUpperCase();
  return {
    sourceId: source.id || source.routeSlug || source.source || sourceDisplayName(source),
    sourceName: sourceDisplayName(source),
    provider: source.provider || null,
    required: Boolean(source.required),
    status: healthyStatuses.has(status) ? "READY" : status,
    health: pct(source.healthScore ?? source.health),
    freshness: source.freshness || source.freshnessStatus || null,
    coverage: sourceCoverage(source),
    confidence: pct(source.confidence ?? source.confidenceScore ?? source.healthScore),
    records: Number.isFinite(Number(source.records)) ? Number(source.records) : null,
    validation: sourceValidation(source),
    lastSyncAt: source.lastSyncAt || source.last_sync_at || null,
    latencyMs: Number.isFinite(Number(source.latencyMs ?? source.latency_ms)) ? Number(source.latencyMs ?? source.latency_ms) : null,
    evidence: {
      adapter: source.adapter || null,
      checks: source.checks || {},
      configuration: source.configuration || null,
      probeError: source.probeError || null,
      httpStatus: source.httpStatus || null
    }
  };
}

function sourceFromRow(row) {
  return {
    sourceId: row.source_id,
    sourceName: row.source_name,
    provider: row.provider,
    required: row.required,
    status: row.status,
    health: pct(row.health),
    freshness: row.freshness,
    coverage: row.coverage,
    confidence: pct(row.confidence),
    records: row.records,
    validation: row.validation,
    lastSyncAt: row.last_sync_at,
    latencyMs: row.latency_ms,
    evidence: row.evidence || {}
  };
}

function checksFromPayload(payload) {
  return arr(payload.checks).map(check => ({
    id: check.id,
    name: check.name,
    status: check.status,
    severity: check.severity || null,
    policy: check.policy || null
  }));
}

function admissionFrom(packageRow, sources, payload) {
  const passed = sources.filter(source => String(source.validation).toUpperCase() === "PASSED").length;
  const failed = sources.filter(source => String(source.validation).toUpperCase() === "FAILED").length;
  return {
    requiredSources: sources.filter(source => source.required).length,
    optionalSources: sources.filter(source => !source.required).length,
    passedSources: passed,
    failedSources: failed,
    warnings: arr(payload.warnings).length,
    admissionStatus: packageRow.workflow_permission === "CONTINUE" && failed === 0 ? "APPROVED" : "RESTRICTED"
  };
}

function dependencyRows(sources) {
  const byName = new Map(sources.map(source => [source.sourceName, source]));
  return DEPENDENCIES.map(([source, requiredBy, dependencyType]) => {
    const result = byName.get(source);
    return {
      source,
      requiredBy,
      dependencyType,
      status: result ? result.status : "WAITING"
    };
  });
}

function evidenceFromSource(source) {
  return {
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    title: `${source.sourceName} Evidence`,
    status: source.validation || "RECORDED",
    collectedAt: source.lastSyncAt || null,
    payload: source.evidence || {}
  };
}

export async function getValidatedPackageDashboard() {
  if (!isDatabaseConfigured()) return emptyPackage("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured. Validated package inspection reads persisted Card 1 output only.");

  const readiness = await tableReadiness();
  if (!readiness.ready) {
    return emptyPackage("SCHEMA_NOT_READY", `Missing tables: ${readiness.missing.join(", ")}`, readiness.missing);
  }

  const run = await latestRun();
  const runId = run?.id || null;
  const { rows: packageRows } = await query("SELECT * FROM market.validated_intelligence_packages ORDER BY created_at DESC LIMIT 1");
  const packageRow = packageRows[0] || null;
  if (!packageRow) {
    return emptyPackage("PACKAGE_NOT_AVAILABLE", "No persisted Validated Intelligence Package has been emitted by Card 1 yet.");
  }

  const packageId = packageRow.package_id;
  const [output, input, handoff, sourceRows, evidenceRows, historyRows, auditRows] = await Promise.all([
    latestWorkflowRecord("workflow.card_outputs", 1, packageRow.run_id || runId),
    latestWorkflowRecord("workflow.card_inputs", 2, packageRow.run_id || runId),
    latestHandoff(packageRow.run_id || runId),
    query("SELECT * FROM market.source_validation_results WHERE package_id = $1 ORDER BY required DESC, source_name", [packageId]),
    query("SELECT * FROM market.source_evidence WHERE package_id = $1 ORDER BY collected_at DESC, source_id", [packageId]),
    query("SELECT version, created_at, status, validation_score, created_by, package_id FROM market.validated_intelligence_packages ORDER BY created_at DESC LIMIT 12"),
    query("SELECT created_at AS timestamp, action, source, status, payload FROM market.validation_audit_logs WHERE package_id = $1 ORDER BY created_at DESC LIMIT 30", [packageId])
  ]);
  const payload = j(packageRow.payload);
  const sources = sourceRows.rows.length ? sourceRows.rows.map(sourceFromRow) : arr(payload.sources).map(normalizeSource);
  const evidence = evidenceRows.rows.length ? evidenceRows.rows.map(row => ({
    sourceId: row.source_id,
    sourceName: SOURCE_LABELS[row.source_id] || row.title,
    title: row.title,
    status: row.status,
    collectedAt: row.collected_at,
    payload: row.payload || {}
  })) : sources.map(evidenceFromSource);

  return {
    sourceMode: "DATABASE_ONLY",
    status: "READY",
    schemaReady: true,
    metadata: {
      packageId,
      workflowRunId: packageRow.workflow_run_id || run?.workflow_id || run?.run_key || null,
      sourceCard: `Card ${packageRow.source_card_number}`,
      targetCard: `Card ${packageRow.target_card_number}`,
      version: packageRow.version,
      createdAt: packageRow.created_at,
      createdBy: packageRow.created_by,
      validationStatus: packageRow.validation_status,
      packageStatus: packageRow.package_status,
      workflowPermission: packageRow.workflow_permission,
      workflowOutputStatus: output?.status || null,
      workflowInputStatus: input?.status || null,
      handoffStatus: handoff?.status || null
    },
    summary: [
      ["Package Status", packageRow.status],
      ["Validation Score", pct(packageRow.validation_score)],
      ["Acceptance Score", pct(packageRow.acceptance_score)],
      ["Data Confidence Score", pct(packageRow.data_confidence_score)],
      ["Source Coverage", packageRow.source_coverage || `${sources.filter(source => String(source.validation).toUpperCase() === "PASSED").length}/${sources.length}`],
      ["Freshness Score", pct(packageRow.freshness_score)],
      ["Workflow Permission", packageRow.workflow_permission],
      ["Package Readiness", packageRow.package_status]
    ],
    sources,
    admission: admissionFrom(packageRow, sources, payload),
    dependencies: dependencyRows(sources),
    payload: {
      package_id: packageId,
      workflow_run_id: packageRow.workflow_run_id,
      sources,
      scores: {
        validation: pct(packageRow.validation_score),
        acceptance: pct(packageRow.acceptance_score),
        confidence: pct(packageRow.data_confidence_score),
        freshness: pct(packageRow.freshness_score)
      },
      validation: {
        status: packageRow.validation_status,
        checks: checksFromPayload(payload)
      },
      original: payload
    },
    evidence,
    checks: checksFromPayload(payload),
    lineage: {
      createdBy: packageRow.created_by,
      createdAt: packageRow.created_at,
      version: packageRow.version,
      sourceRunId: payload.testRunId || null,
      workflowRunId: packageRow.workflow_run_id || run?.workflow_id || run?.run_key || null,
      path: ["Card 1", "Validated Intelligence Package", "Card 2"]
    },
    history: historyRows.rows.map(row => ({
      version: row.version,
      date: row.created_at,
      status: row.status,
      score: pct(row.validation_score),
      createdBy: row.created_by,
      packageId: row.package_id
    })),
    audit: auditRows.rows.map(row => ({
      timestamp: row.timestamp,
      action: row.action,
      source: row.source,
      status: row.status,
      payload: row.payload
    }))
  };
}

export async function persistValidatedPackageFromCardOne(report) {
  if (!isDatabaseConfigured() || !report || report.workflowPermission !== "CONTINUE") return null;
  const readiness = await tableReadiness();
  if (!readiness.ready) return null;

  const run = await latestRun();
  const runId = run?.id || null;
  const packageId = packageIdFromDate(new Date(report.executedAt || Date.now()));
  const sources = arr(report.sources).map(normalizeSource);
  const passedSources = sources.filter(source => String(source.validation).toUpperCase() === "PASSED").length;
  const coverage = `${passedSources}/${sources.length}`;
  const confidenceSources = sources.filter(source => source.required || Number(source.confidence) > 0);
  const confidence = confidenceSources.length
    ? Math.round(confidenceSources.reduce((sum, source) => sum + Number(source.confidence || 0), 0) / confidenceSources.length)
    : pct(report.dataQualityScore);
  const freshness = sources.length
    ? Math.round(sources.filter(source => ["LIVE", "READY", "SYNCED"].some(value => String(source.freshness || source.status).toUpperCase().includes(value))).length / sources.length * 100)
    : null;
  const payload = {
    ...report,
    package_id: packageId,
    source_card: "Card 1",
    target_card: "Card 2",
    scores: {
      validation: pct(report.dataQualityScore),
      acceptance: pct(report.acceptanceScore),
      confidence,
      freshness
    }
  };

  return withTransaction(async client => {
    await client.query(`
      INSERT INTO market.validated_intelligence_packages (
        run_id, package_id, workflow_run_id, status, validation_status, package_status,
        workflow_permission, validation_score, acceptance_score, data_confidence_score,
        freshness_score, source_coverage, payload, created_at
      )
      VALUES ($1, $2, $3, 'VALIDATED', 'PASSED', 'READY', $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
      ON CONFLICT (package_id) DO UPDATE SET
        workflow_permission = excluded.workflow_permission,
        validation_score = excluded.validation_score,
        acceptance_score = excluded.acceptance_score,
        data_confidence_score = excluded.data_confidence_score,
        freshness_score = excluded.freshness_score,
        source_coverage = excluded.source_coverage,
        payload = excluded.payload
    `, [
      runId,
      packageId,
      report.testRunId || run?.workflow_id || run?.run_key || null,
      report.workflowPermission,
      pct(report.dataQualityScore),
      pct(report.acceptanceScore),
      confidence,
      freshness,
      coverage,
      JSON.stringify(payload),
      report.executedAt || new Date().toISOString()
    ]);

    await client.query("DELETE FROM market.source_validation_results WHERE package_id = $1", [packageId]);
    await client.query("DELETE FROM market.source_evidence WHERE package_id = $1", [packageId]);

    for (const source of sources) {
      await client.query(`
        INSERT INTO market.source_validation_results (
          package_id, source_id, source_name, provider, required, status, health, freshness,
          coverage, confidence, records, validation, last_sync_at, latency_ms, evidence
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
      `, [
        packageId,
        source.sourceId,
        source.sourceName,
        source.provider,
        source.required,
        source.status,
        source.health,
        source.freshness,
        source.coverage,
        source.confidence,
        source.records,
        source.validation,
        source.lastSyncAt,
        source.latencyMs,
        JSON.stringify(source.evidence)
      ]);
      await client.query(`
        INSERT INTO market.source_evidence (package_id, source_id, evidence_type, title, status, payload, collected_at)
        VALUES ($1, $2, 'runtime_probe', $3, $4, $5::jsonb, coalesce($6::timestamptz, now()))
      `, [
        packageId,
        source.sourceId,
        `${source.sourceName} Evidence`,
        source.validation,
        JSON.stringify(source.evidence),
        source.lastSyncAt
      ]);
    }

    await client.query(`
      INSERT INTO workflow.card_outputs (run_id, card_number, package_id, status, payload, generated_at, validated_at)
      VALUES ($1, 1, $2, 'VALIDATED', $3::jsonb, $4, $4)
    `, [runId, packageId, JSON.stringify(payload), report.executedAt || new Date().toISOString()]);
    await client.query(`
      INSERT INTO workflow.card_inputs (run_id, card_number, source_card_number, package_id, status, payload, received_at)
      VALUES ($1, 2, 1, $2, 'RECEIVED', $3::jsonb, $4)
    `, [runId, packageId, JSON.stringify(payload), report.executedAt || new Date().toISOString()]);
    await client.query(`
      INSERT INTO workflow.card_handoffs (run_id, from_card_number, to_card_number, package_id, status, payload, handed_off_at)
      VALUES ($1, 1, 2, $2, 'SENT', $3::jsonb, $4)
    `, [runId, packageId, JSON.stringify({ source: "Card 1", target: "Card 2", workflowPermission: report.workflowPermission }), report.executedAt || new Date().toISOString()]);

    for (const [action, source, status] of [
      ["Package Created", "card_1", "COMPLETED"],
      ["Validation Passed", "card_1", "PASSED"],
      ["Package Stored", "database", "COMPLETED"],
      ["Package Loaded", "card_2", "READY"],
      ["Package Approved", "workflow", "APPROVED"]
    ]) {
      await client.query(
        "INSERT INTO market.validation_audit_logs (package_id, action, source, status, payload) VALUES ($1, $2, $3, $4, $5::jsonb)",
        [packageId, action, source, status, JSON.stringify({ workflowRunId: report.testRunId || null })]
      );
    }

    return { packageId, sources: sources.length, status: "VALIDATED" };
  });
}
