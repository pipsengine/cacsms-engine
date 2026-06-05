import { isDatabaseConfigured, query, withTransaction } from "./db.js";

export const DEPENDENCY_MATRIX_TABLES = Object.freeze([
  "market.source_registry",
  "market.source_dependencies",
  "market.source_health_metrics",
  "market.source_sync_logs",
  "market.source_alerts",
  "market.module_registry",
  "market.service_registry",
  "market.api_registry",
  "market.database_table_registry",
  "market.dependency_graph_nodes",
  "market.dependency_graph_edges",
  "market.dependency_health_scores",
  "market.dependency_recommendations",
  "market.dependency_simulation_logs",
  "market.dependency_audit_logs"
]);

const n = value => value === null || value === undefined ? null : Number(value);
const pct = value => value === null || value === undefined ? null : Math.round(Number(value));
const avg = values => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value), 0) / values.length) : null;

function permissions() {
  return {
    view: "market_intelligence.dependency_matrix.view",
    recalculate: "market_intelligence.dependency_matrix.recalculate",
    export: "market_intelligence.dependency_matrix.export",
    simulateFailure: "market_intelligence.dependency_matrix.simulate_failure",
    createAlert: "market_intelligence.dependency_matrix.create_alert",
    manageMapping: "market_intelligence.dependency_matrix.manage_mapping"
  };
}

function emptyState(status, message, missingTables = []) {
  return {
    sourceMode: "DATABASE_ONLY",
    status,
    message,
    schemaReady: false,
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveDependencyGraph: true, lastRecalculated: null, criticalDependencies: 0 },
    summary: [],
    matrix: [],
    graph: { nodes: [], edges: [] },
    moduleImpact: [],
    sourceMapping: [],
    services: [],
    database: [],
    recommendations: [],
    simulations: [],
    audit: []
  };
}

async function tableReadiness() {
  const { rows } = await query(
    "SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name",
    [DEPENDENCY_MATRIX_TABLES]
  );
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function dependencyScore(row) {
  if (!row.source_key || !row.affected_module) return null;
  const health = n(row.health_score);
  const success = n(row.success_rate_pct);
  const validation = n(row.validation_pass_rate_pct);
  const freshness = ["FRESH", "LIVE", "CURRENT"].includes(String(row.freshness_status || "").toUpperCase()) ? 100 : String(row.freshness_status || "").toUpperCase() === "NEAR_STALE" ? 75 : null;
  const impactPenalty = String(row.risk_level || "").toUpperCase() === "CRITICAL" ? 10 : String(row.risk_level || "").toUpperCase() === "HIGH" ? 5 : 0;
  const values = [health, success, validation, freshness].filter(value => value !== null);
  if (!values.length) return null;
  return Math.max(0, avg(values) - impactPenalty);
}

function scoreStatus(score) {
  if (score === null || score === undefined) return "UNMAPPED";
  if (score >= 90) return "HEALTHY";
  if (score >= 70) return "WARNING";
  if (score >= 40) return "DEGRADED";
  return "CRITICAL";
}

function failureImpact(riskLevel) {
  const risk = String(riskLevel || "").toUpperCase();
  if (risk === "CRITICAL") return "System Critical";
  if (risk === "HIGH") return "Major";
  if (risk === "MEDIUM") return "Moderate";
  if (risk === "LOW") return "Minor";
  return "Moderate";
}

function dependencyLevel(riskLevel) {
  const risk = String(riskLevel || "").toUpperCase();
  if (risk === "CRITICAL") return "Critical";
  if (risk === "HIGH") return "High";
  if (risk === "MEDIUM") return "Medium";
  if (risk === "LOW") return "Low";
  return "Optional";
}

function recommendationFor(row, score) {
  if (!row.backup_source) return "Configure backup source";
  if (String(row.health || "").toUpperCase() === "CRITICAL") return "Reconnect provider";
  if (String(row.freshness_status || "").toUpperCase().includes("STALE")) return "Resolve stale data";
  if (score !== null && score < 70) return "Repair failed sync job";
  return "Continue monitoring dependency path";
}

async function dependencyRows() {
  const { rows } = await query(`
    SELECT d.id, d.source_key, coalesce(r.name, d.source_key) AS source, d.affected_module,
           d.affected_page, d.business_impact, d.risk_level, d.fallback_available, d.recommended_action,
           r.category, r.priority, r.environment,
           ph.provider, ph.provider_type, ph.status AS provider_status, ph.success_rate_pct,
           hm.health, hm.health_score, hm.freshness_status, hm.validation_pass_rate_pct,
           sl.started_at AS last_sync, sl.job_type, sl.status AS sync_status
    FROM market.source_dependencies d
    LEFT JOIN market.source_registry r ON r.id = d.registry_id OR r.source_key = d.source_key
    LEFT JOIN LATERAL (
      SELECT * FROM market.source_provider_health ph
      WHERE ph.registry_id = r.id OR ph.source_key = d.source_key
      ORDER BY observed_at DESC LIMIT 1
    ) ph ON true
    LEFT JOIN LATERAL (
      SELECT * FROM market.source_health_metrics hm
      WHERE hm.registry_id = r.id OR hm.source_key = d.source_key
      ORDER BY observed_at DESC LIMIT 1
    ) hm ON true
    LEFT JOIN LATERAL (
      SELECT * FROM market.source_sync_logs sl
      WHERE sl.registry_id = r.id OR sl.source_key = d.source_key
      ORDER BY started_at DESC LIMIT 1
    ) sl ON true
    ORDER BY coalesce(r.name, d.source_key), d.affected_module
  `);
  return rows.map(row => {
    const score = dependencyScore(row);
    return {
      id: row.id,
      sourceKey: row.source_key,
      source: row.source,
      primarySource: row.provider || row.source,
      backupSource: row.fallback_available ? "Available" : null,
      apiService: row.provider_type || null,
      syncJob: row.job_type || null,
      databaseTables: null,
      aiEngine: null,
      module: row.affected_module,
      page: row.affected_page,
      healthStatus: scoreStatus(score),
      health: row.health,
      dependencyLevel: dependencyLevel(row.risk_level),
      failureImpact: failureImpact(row.risk_level),
      lastSync: row.last_sync,
      recommendedAction: row.recommended_action || recommendationFor(row, score),
      businessImpact: row.business_impact,
      riskLevel: row.risk_level || "UNKNOWN",
      provider: row.provider,
      providerType: row.provider_type,
      priority: row.priority,
      score
    };
  });
}

function graphFromDependencies(rows, graphRows) {
  if (graphRows.nodes.length || graphRows.edges.length) return graphRows;
  const nodes = new Map();
  const edges = [];
  for (const row of rows) {
    const sourceKey = `source:${row.sourceKey}`;
    const moduleKey = `module:${row.module}`;
    nodes.set(sourceKey, { key: sourceKey, type: "Data Source", label: row.source, status: row.healthStatus, riskLevel: row.riskLevel });
    nodes.set(moduleKey, { key: moduleKey, type: "Module", label: row.module, status: row.healthStatus, riskLevel: row.riskLevel });
    edges.push({ from: sourceKey, to: moduleKey, dependencyLevel: row.dependencyLevel, failureImpact: row.failureImpact, status: row.healthStatus });
    if (row.page) {
      const pageKey = `page:${row.page}`;
      nodes.set(pageKey, { key: pageKey, type: "Page", label: row.page, status: row.healthStatus, riskLevel: row.riskLevel });
      edges.push({ from: moduleKey, to: pageKey, dependencyLevel: row.dependencyLevel, failureImpact: row.failureImpact, status: row.healthStatus });
    }
  }
  return { nodes: [...nodes.values()], edges };
}

async function storedGraph() {
  const [nodes, edges] = await Promise.all([
    query("SELECT node_key AS key, node_type AS type, label, status, risk_level AS \"riskLevel\", payload FROM market.dependency_graph_nodes ORDER BY node_type, label"),
    query("SELECT from_node_key AS \"from\", to_node_key AS \"to\", dependency_level AS \"dependencyLevel\", failure_impact AS \"failureImpact\", status, payload FROM market.dependency_graph_edges ORDER BY from_node_key, to_node_key")
  ]);
  return { nodes: nodes.rows, edges: edges.rows };
}

function summaryCards(rows, sourceCount, audit) {
  const scores = rows.map(row => row.score).filter(value => value !== null && value !== undefined);
  const critical = rows.filter(row => row.dependencyLevel === "Critical").length;
  return [
    ["Total Dependencies", rows.length, "info"],
    ["Critical Dependencies", critical, critical ? "bad" : "ok"],
    ["Degraded Dependencies", rows.filter(row => row.healthStatus === "DEGRADED" || row.healthStatus === "WARNING").length, "warn"],
    ["Missing Dependencies", rows.filter(row => row.healthStatus === "UNMAPPED").length, "bad"],
    ["Affected Modules", new Set(rows.map(row => row.module)).size, "info"],
    ["Healthy Sources", new Set(rows.filter(row => row.healthStatus === "HEALTHY").map(row => row.sourceKey)).size, "ok"],
    ["Failed Sources", new Set(rows.filter(row => ["CRITICAL", "DEGRADED"].includes(row.healthStatus)).map(row => row.sourceKey)).size, "bad"],
    ["Unmapped Sources", Math.max(0, sourceCount - new Set(rows.map(row => row.sourceKey)).size), "warn"],
    ["System Risk Score", scores.length ? Math.max(0, 100 - avg(scores)) : null, "quality"],
    ["Last Matrix Recalculation", audit?.created_at || null, "info"]
  ];
}

function moduleImpact(rows) {
  const modules = new Map();
  for (const row of rows) {
    const entry = modules.get(row.module) || { module: row.module, requiredSources: new Set(), optionalSources: new Set(), healthyDependencies: 0, failedDependencies: 0, missingDependencies: 0, affectedPages: new Set(), businessImpact: new Set(), riskLevel: "Low" };
    (row.dependencyLevel === "Optional" ? entry.optionalSources : entry.requiredSources).add(row.source);
    if (row.healthStatus === "HEALTHY") entry.healthyDependencies += 1;
    else if (row.healthStatus === "UNMAPPED") entry.missingDependencies += 1;
    else entry.failedDependencies += 1;
    if (row.page) entry.affectedPages.add(row.page);
    if (row.businessImpact) entry.businessImpact.add(row.businessImpact);
    if (["CRITICAL", "HIGH"].includes(String(row.riskLevel).toUpperCase())) entry.riskLevel = String(row.riskLevel).toUpperCase() === "CRITICAL" ? "Critical" : "High";
    modules.set(row.module, entry);
  }
  return [...modules.values()].map(row => ({
    ...row,
    requiredSources: [...row.requiredSources].join(", "),
    optionalSources: [...row.optionalSources].join(", "),
    affectedPages: [...row.affectedPages].join(", "),
    businessImpact: [...row.businessImpact].join("; ")
  }));
}

function sourceMapping(rows) {
  const sources = new Map();
  for (const row of rows) {
    const entry = sources.get(row.sourceKey) || { source: row.source, provider: row.provider, usedByModules: new Set(), usedByPages: new Set(), dependencyType: row.dependencyLevel, priority: row.priority, health: row.healthStatus, lastSync: row.lastSync, failureImpact: row.failureImpact };
    entry.usedByModules.add(row.module);
    if (row.page) entry.usedByPages.add(row.page);
    sources.set(row.sourceKey, entry);
  }
  return [...sources.values()].map(row => ({ ...row, usedByModules: [...row.usedByModules].join(", "), usedByPages: [...row.usedByPages].join(", ") }));
}

async function serviceRows() {
  const { rows } = await query("SELECT service_name AS \"serviceName\", depends_on AS \"dependsOn\", consumed_by AS \"consumedBy\", health_status AS \"healthStatus\", last_run_at AS \"lastRun\", queue_status AS \"queueStatus\", failure_count AS \"failureCount\", risk_level AS \"riskLevel\" FROM market.service_registry ORDER BY service_name");
  return rows;
}

async function databaseRows() {
  const { rows } = await query("SELECT table_name AS \"tableName\", used_by_services AS \"usedByServices\", used_by_pages AS \"usedByPages\", record_count AS \"recordCount\", last_updated AS \"lastUpdated\", data_freshness AS \"dataFreshness\", validation_status AS \"validationStatus\", risk_level AS \"riskLevel\" FROM market.database_table_registry ORDER BY table_name");
  return rows;
}

async function recommendationRows() {
  const { rows } = await query("SELECT dependency_key AS \"dependencyKey\", source_key AS \"sourceKey\", recommendation, severity, status, created_at AS \"createdAt\" FROM market.dependency_recommendations ORDER BY created_at DESC LIMIT 100");
  return rows;
}

async function auditRows() {
  const { rows } = await query("SELECT action, source, status, actor, created_at, payload FROM market.dependency_audit_logs ORDER BY created_at DESC LIMIT 50");
  return rows;
}

async function latestAudit(action = "Dependency Matrix Recalculated") {
  const { rows } = await query("SELECT created_at FROM market.dependency_audit_logs WHERE action = $1 ORDER BY created_at DESC LIMIT 1", [action]);
  return rows[0] || null;
}

async function sourceCount() {
  const { rows } = await query("SELECT count(*)::int AS count FROM market.source_registry");
  return rows[0]?.count || 0;
}

export class DependencyMatrixService {
  static async dashboard() {
    if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured. Dependency Matrix reads production dependency records only.");
    const readiness = await tableReadiness();
    if (!readiness.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${readiness.missing.join(", ")}`, readiness.missing);
    const [rows, graph, services, database, recommendations, audit, sourceTotal, lastRecalc] = await Promise.all([
      dependencyRows(), storedGraph(), serviceRows(), databaseRows(), recommendationRows(), auditRows(), sourceCount(), latestAudit()
    ]);
    if (!rows.length) {
      return { ...emptyState("EMPTY", "No dependency mappings found. Map your production data sources, services, database tables, and modules to enable dependency monitoring."), schemaReady: true, status: "EMPTY" };
    }
    const graphData = graphFromDependencies(rows, graph);
    const critical = rows.filter(row => row.dependencyLevel === "Critical").length;
    return {
      sourceMode: "DATABASE_ONLY",
      status: "READY",
      schemaReady: true,
      permissions: permissions(),
      badges: { productionLive: true, mockDataDisabled: true, liveDependencyGraph: true, lastRecalculated: lastRecalc?.created_at || null, criticalDependencies: critical },
      summary: summaryCards(rows, sourceTotal, lastRecalc),
      matrix: rows,
      graph: graphData,
      moduleImpact: moduleImpact(rows),
      sourceMapping: sourceMapping(rows),
      services,
      database,
      recommendations,
      audit
    };
  }

  static async recalculate(actor = "api") {
    const rows = await dependencyRows();
    const graph = graphFromDependencies(rows, { nodes: [], edges: [] });
    return withTransaction(async client => {
      for (const node of graph.nodes) {
        await client.query(`
          INSERT INTO market.dependency_graph_nodes (node_key, node_type, label, status, risk_level, updated_at)
          VALUES ($1, $2, $3, $4, $5, now())
          ON CONFLICT (node_key) DO UPDATE SET node_type = excluded.node_type, label = excluded.label, status = excluded.status, risk_level = excluded.risk_level, updated_at = now()
        `, [node.key, node.type, node.label, node.status, node.riskLevel]);
      }
      for (const edge of graph.edges) {
        await client.query(`
          INSERT INTO market.dependency_graph_edges (from_node_key, to_node_key, dependency_level, failure_impact, status)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (from_node_key, to_node_key) DO UPDATE SET dependency_level = excluded.dependency_level, failure_impact = excluded.failure_impact, status = excluded.status
        `, [edge.from, edge.to, edge.dependencyLevel, edge.failureImpact, edge.status]);
      }
      for (const row of rows) {
        await client.query("INSERT INTO market.dependency_health_scores (dependency_key, score, status, payload) VALUES ($1, $2, $3, $4::jsonb)", [`${row.sourceKey}:${row.module}`, row.score, row.healthStatus, JSON.stringify({ source: row.source, module: row.module })]);
        if (row.recommendedAction) {
          await client.query(`
            INSERT INTO market.dependency_recommendations (dependency_key, source_key, recommendation, severity, status)
            VALUES ($1, $2, $3, $4, 'OPEN')
          `, [`${row.sourceKey}:${row.module}`, row.sourceKey, row.recommendedAction, row.healthStatus === "HEALTHY" ? "info" : "warning"]);
        }
      }
      await client.query("INSERT INTO market.dependency_audit_logs (action, source, status, actor, payload) VALUES ('Dependency Matrix Recalculated', 'dependency_matrix', 'COMPLETED', $1, $2::jsonb)", [actor, JSON.stringify({ dependencies: rows.length, nodes: graph.nodes.length, edges: graph.edges.length })]);
      return { action: "recalculate", status: "COMPLETED", dependencies: rows.length, nodes: graph.nodes.length, edges: graph.edges.length };
    });
  }

  static async simulateFailure(body = {}, actor = "api") {
    const target = body.provider || body.source || body.service || body.databaseTable || body.module || body.target || "";
    const rows = await dependencyRows();
    const affected = rows.filter(row => [row.provider, row.source, row.sourceKey, row.module, row.page].some(value => String(value || "").toLowerCase().includes(String(target).toLowerCase())));
    const result = {
      target,
      affectedModules: [...new Set(affected.map(row => row.module))],
      affectedPages: [...new Set(affected.map(row => row.page).filter(Boolean))],
      brokenFeatures: [...new Set(affected.map(row => row.businessImpact).filter(Boolean))],
      alertRisk: affected.some(row => ["Critical", "High"].includes(row.dependencyLevel)) ? "HIGH" : affected.length ? "MEDIUM" : "LOW",
      businessImpact: affected.map(row => row.failureImpact).join(", "),
      suggestedRecoverySteps: [...new Set(affected.map(row => row.recommendedAction).filter(Boolean))]
    };
    await query("INSERT INTO market.dependency_simulation_logs (simulation_type, target_key, result, actor) VALUES ('failure_impact', $1, $2::jsonb, $3)", [target, JSON.stringify(result), actor]);
    await query("INSERT INTO market.dependency_audit_logs (action, source, status, actor, payload) VALUES ('Failure Simulation Run', 'dependency_matrix', 'RECORDED', $1, $2::jsonb)", [actor, JSON.stringify(result)]);
    return { action: "simulate-failure", status: "RECORDED", result };
  }

  static async createAlert(body = {}, actor = "api") {
    await query("INSERT INTO market.dependency_audit_logs (action, source, status, actor, payload) VALUES ('Dependency Alert Created', 'dependency_matrix', 'RECORDED', $1, $2::jsonb)", [actor, JSON.stringify(body)]);
    return { action: "create-alert", status: "RECORDED" };
  }
}

export async function getDependencyMatrixDashboard() {
  return DependencyMatrixService.dashboard();
}

export async function getDependencyMatrixSlice(slice) {
  const dashboard = await DependencyMatrixService.dashboard();
  if (slice === "summary") return { status: dashboard.status, summary: dashboard.summary, badges: dashboard.badges };
  if (slice === "graph") return { status: dashboard.status, graph: dashboard.graph };
  if (slice === "modules") return { status: dashboard.status, modules: dashboard.moduleImpact };
  if (slice === "sources") return { status: dashboard.status, sources: dashboard.sourceMapping };
  if (slice === "services") return { status: dashboard.status, services: dashboard.services };
  if (slice === "database") return { status: dashboard.status, database: dashboard.database };
  if (slice === "recommendations") return { status: dashboard.status, recommendations: dashboard.recommendations };
  if (slice === "export") return { exportedAt: new Date().toISOString(), dashboard };
  return dashboard;
}

export async function runDependencyMatrixAction(action, body = {}, actor = "api") {
  if (!isDatabaseConfigured()) {
    const error = new Error("database_not_configured");
    error.status = 503;
    throw error;
  }
  const readiness = await tableReadiness();
  if (!readiness.ready) {
    const error = new Error("schema_not_ready");
    error.status = 503;
    error.missingTables = readiness.missing;
    throw error;
  }
  if (action === "recalculate") return DependencyMatrixService.recalculate(actor);
  if (action === "simulate-failure") return DependencyMatrixService.simulateFailure(body, actor);
  if (action === "create-alert") return DependencyMatrixService.createAlert(body, actor);
  const error = new Error("unsupported_dependency_matrix_action");
  error.status = 404;
  throw error;
}
