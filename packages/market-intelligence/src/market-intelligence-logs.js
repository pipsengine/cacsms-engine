import { isDatabaseConfigured, query } from "./db.js";

const OPERATIONAL_LOGS_QUERY = `
  SELECT
    id::text,
    timestamp,
    severity,
    status,
    module,
    category,
    action,
    message,
    detailed_description,
    entity_type,
    entity_id::text,
    user_id::text,
    user_name,
    ip_address,
    source,
    provider,
    request_id,
    correlation_id,
    duration_ms,
    environment,
    error_code,
    stack_trace,
    payload_snapshot,
    before_value,
    after_value,
    recommended_action,
    resolution_status,
    resolved_at,
    resolved_by::text,
    created_at,
    updated_at,
    0 as retry_count,
    resolution_status = 'resolved' as resolved
  FROM market_intelligence.market_intelligence_logs
  UNION ALL
  SELECT
    'source_sync:' || id::text,
    started_at,
    lower(coalesce(severity, 'info')),
    CASE
      WHEN lower(coalesce(status, '')) IN ('completed', 'success', 'successful', 'synced') THEN 'completed'
      WHEN lower(coalesce(status, '')) IN ('failed', 'error') THEN 'failed'
      WHEN completed_at IS NULL THEN 'started'
      ELSE lower(coalesce(status, 'completed'))
    END,
    'source-sync',
    'source_sync',
    coalesce(job_type, 'source_sync'),
    coalesce(error_message, 'Source sync ' || lower(coalesce(status, 'recorded'))),
    coalesce(error_message, 'Production source sync activity recorded.'),
    'source_sync_job',
    id::text,
    null,
    null,
    null,
    source_key,
    provider,
    null,
    id::text,
    CASE WHEN completed_at IS NOT NULL THEN greatest(0, extract(epoch from completed_at - started_at) * 1000)::int ELSE null END,
    'production',
    failure_type,
    null,
    payload,
    null,
    null,
    CASE WHEN error_message IS NOT NULL THEN 'Review source health and provider connectivity.' ELSE null END,
    CASE WHEN resolved THEN 'resolved' WHEN lower(coalesce(status, '')) IN ('failed', 'error') THEN 'pending' ELSE null END,
    CASE WHEN resolved THEN completed_at ELSE null END,
    null,
    started_at,
    coalesce(completed_at, started_at),
    retry_count,
    resolved
  FROM market.source_sync_logs
  UNION ALL
  SELECT
    'source_health:' || id::text,
    created_at,
    CASE WHEN lower(status) LIKE '%fail%' THEN 'error' ELSE 'info' END,
    CASE WHEN lower(status) LIKE '%fail%' THEN 'failed' ELSE 'completed' END,
    'source-health',
    'source_health',
    review_type,
    'Source health review ' || lower(status),
    'Production source health review activity recorded.',
    'source_health_review',
    id::text,
    null,
    null,
    null,
    null,
    null,
    null,
    id::text,
    null,
    'production',
    null,
    null,
    summary,
    null,
    null,
    null,
    null,
    null,
    null,
    created_at,
    created_at,
    0,
    lower(status) NOT LIKE '%fail%'
  FROM market.source_health_reviews
  UNION ALL
  SELECT
    'source_validation:' || id::text,
    detected_at,
    lower(coalesce(severity, 'info')),
    CASE WHEN lower(coalesce(status, '')) LIKE '%fail%' OR issue_count > 0 THEN 'failed' ELSE 'completed' END,
    'validation',
    'validation',
    validation_rule,
    'Source validation recorded for ' || coalesce(source_key, 'unknown source'),
    recommended_fix,
    'source_validation',
    id::text,
    null,
    null,
    null,
    source_key,
    null,
    null,
    id::text,
    null,
    'production',
    null,
    null,
    payload,
    null,
    null,
    recommended_fix,
    CASE WHEN issue_count > 0 THEN 'pending' ELSE null END,
    null,
    null,
    detected_at,
    detected_at,
    0,
    issue_count = 0
  FROM market.source_validation_logs
  UNION ALL
  SELECT
    'dependency_audit:' || id::text,
    created_at,
    CASE WHEN lower(status) LIKE '%fail%' THEN 'error' ELSE 'info' END,
    CASE WHEN lower(status) LIKE '%fail%' THEN 'failed' ELSE 'completed' END,
    'dependency-matrix',
    'dependency_matrix',
    action,
    action,
    'Dependency matrix audit activity recorded.',
    'dependency_audit',
    id::text,
    actor,
    actor,
    null,
    source,
    null,
    null,
    id::text,
    null,
    'production',
    null,
    null,
    payload,
    null,
    null,
    null,
    null,
    null,
    null,
    created_at,
    created_at,
    0,
    lower(status) NOT LIKE '%fail%'
  FROM market.dependency_audit_logs
  UNION ALL
  SELECT
    'package_audit:' || id::text,
    created_at,
    CASE WHEN lower(result) LIKE '%fail%' THEN 'error' ELSE 'success' END,
    CASE WHEN lower(result) LIKE '%fail%' THEN 'failed' ELSE 'completed' END,
    'package-builder',
    'package_builder',
    action,
    action || ' for package ' || coalesce(package_id, 'unknown'),
    'Intelligence package audit activity recorded.',
    'package',
    package_id,
    actor,
    actor,
    null,
    null,
    null,
    null,
    id::text,
    null,
    'production',
    null,
    null,
    payload,
    null,
    null,
    null,
    null,
    null,
    null,
    created_at,
    created_at,
    0,
    lower(result) NOT LIKE '%fail%'
  FROM market.intelligence_package_audit_logs
  UNION ALL
  SELECT
    'handoff_audit:' || id::text,
    created_at,
    CASE WHEN lower(result) LIKE '%fail%' THEN 'error' ELSE 'success' END,
    CASE WHEN lower(result) LIKE '%fail%' THEN 'failed' ELSE 'completed' END,
    'handoff',
    'handoff',
    action,
    action || ' for handoff ' || coalesce(handoff_id, 'unknown'),
    'Intelligence handoff audit activity recorded.',
    'handoff',
    handoff_id,
    actor,
    actor,
    null,
    null,
    null,
    null,
    id::text,
    null,
    'production',
    null,
    null,
    payload,
    null,
    null,
    null,
    null,
    null,
    null,
    created_at,
    created_at,
    0,
    lower(result) NOT LIKE '%fail%'
  FROM market.intelligence_handoff_audit_logs
  UNION ALL
  SELECT
    'scoring_audit:' || id::text,
    created_at,
    CASE WHEN lower(result) LIKE '%fail%' THEN 'error' ELSE 'success' END,
    CASE WHEN lower(result) LIKE '%fail%' THEN 'failed' ELSE 'completed' END,
    'scoring-engine',
    'scoring',
    action,
    action,
    'Scoring engine audit activity recorded.',
    'scoring_audit',
    id::text,
    actor,
    actor,
    null,
    null,
    null,
    null,
    id::text,
    null,
    'production',
    null,
    null,
    payload,
    null,
    null,
    null,
    null,
    null,
    null,
    created_at,
    created_at,
    0,
    lower(result) NOT LIKE '%fail%'
  FROM market.scoring_audit_logs
  UNION ALL
  SELECT
    'broker_liquidity_audit:' || id::text,
    created_at,
    CASE WHEN lower(result) LIKE '%fail%' THEN 'error' ELSE 'success' END,
    CASE WHEN lower(result) LIKE '%fail%' THEN 'failed' ELSE 'completed' END,
    'broker-liquidity',
    'broker_liquidity',
    action,
    action,
    'Broker liquidity audit activity recorded.',
    'broker_liquidity_audit',
    id::text,
    actor,
    actor,
    null,
    null,
    null,
    null,
    id::text,
    null,
    'production',
    null,
    null,
    payload,
    null,
    null,
    null,
    null,
    null,
    null,
    created_at,
    created_at,
    0,
    lower(result) NOT LIKE '%fail%'
  FROM market.broker_liquidity_audit_logs
  UNION ALL
  SELECT
    'portfolio_audit:' || id::text,
    created_at,
    CASE WHEN lower(result) LIKE '%fail%' THEN 'error' ELSE 'success' END,
    CASE WHEN lower(result) LIKE '%fail%' THEN 'failed' ELSE 'completed' END,
    'portfolio-intelligence',
    'portfolio_intelligence',
    action,
    action,
    'Portfolio intelligence audit activity recorded.',
    'portfolio_audit',
    id::text,
    actor,
    actor,
    null,
    null,
    null,
    null,
    id::text,
    null,
    'production',
    null,
    null,
    payload,
    null,
    null,
    null,
    null,
    null,
    null,
    created_at,
    created_at,
    0,
    lower(result) NOT LIKE '%fail%'
  FROM market.portfolio_audit_logs
  UNION ALL
  SELECT
    'prop_firm_audit:' || id::text,
    created_at::timestamptz,
    'info',
    'completed',
    'prop-firm-rules',
    'prop_firm_rules',
    action,
    action || ' for ' || entity_type,
    reason,
    entity_type,
    entity_id::text,
    user_id,
    user_label,
    ip_address,
    null,
    null,
    null,
    id::text,
    null,
    'production',
    null,
    null,
    null,
    before_value,
    after_value,
    reason,
    null,
    null,
    null,
    created_at::timestamptz,
    created_at::timestamptz,
    0,
    true
  FROM market.prop_firm_audit_logs
`;

function buildOperationalLogWhere(filters = {}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  const add = (condition, value) => {
    if (value === undefined || value === null || value === "") return;
    conditions.push(condition.replace("?", `$${paramIndex}`));
    params.push(value);
    paramIndex++;
  };

  add("timestamp >= ?", filters.dateFrom);
  add("timestamp <= ?", filters.dateTo);
  add("module = ?", filters.module);
  add("category = ?", filters.category);
  add("severity = ?", filters.severity);
  add("status = ?", filters.status);
  add("user_id = ?", filters.userId);
  add("source = ?", filters.source);
  add("provider = ?", filters.provider);
  add("action = ?", filters.action);
  add("entity_type = ?", filters.entityType);
  add("entity_id = ?", filters.entityId);
  add("correlation_id = ?", filters.correlationId);
  add("environment = ?", filters.environment || "production");

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
    nextParamIndex: paramIndex
  };
}

export async function getMarketIntelligenceLogs(filters = {}) {
  if (!isDatabaseConfigured()) {
    return { logs: [], total: 0, page: 1, pageSize: 50 };
  }

  const page = Number(filters.page || 1);
  const pageSize = Number(filters.pageSize || 50);
  const offset = (page - 1) * pageSize;
  const { whereClause, params, nextParamIndex } = buildOperationalLogWhere(filters);

  const { rows } = await query(
    `SELECT * FROM (${OPERATIONAL_LOGS_QUERY}) logs
     ${whereClause}
     ORDER BY timestamp DESC
     LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
    [...params, pageSize, offset]
  );

  const { rows: countRows } = await query(
    `SELECT COUNT(*) as total FROM (${OPERATIONAL_LOGS_QUERY}) logs
     ${whereClause}`,
    params
  );

  return {
    logs: rows,
    total: parseInt(countRows[0].total),
    page,
    pageSize
  };
}

export async function getLogsSummary(filters = {}) {
  if (!isDatabaseConfigured()) {
    return {
      totalLogsToday: 0,
      successfulEvents: 0,
      failedEvents: 0,
      warnings: 0,
      criticalErrors: 0,
      syncEvents: 0,
      validationEvents: 0,
      scoringEvents: 0,
      handoffEvents: 0,
      userActions: 0,
      providerErrors: 0,
      unresolvedIssues: 0,
      lastLogReceived: null,
      criticalErrorsToday: 0
    };
  }

  const { dateFrom, dateTo, environment = "production" } = filters;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const conditions = [`environment = $1`];
  const params = [environment];
  let paramIndex = 2;

  if (dateFrom) {
    conditions.push(`timestamp >= $${paramIndex}`);
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    conditions.push(`timestamp <= $${paramIndex}`);
    params.push(dateTo);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

  const { rows } = await query(
    `SELECT
      COUNT(*) FILTER (WHERE timestamp >= $${paramIndex}) as total_logs_today,
      COUNT(*) FILTER (WHERE timestamp >= $${paramIndex} AND status = 'completed') as successful_events,
      COUNT(*) FILTER (WHERE timestamp >= $${paramIndex} AND status = 'failed') as failed_events,
      COUNT(*) FILTER (WHERE timestamp >= $${paramIndex} AND severity = 'warning') as warnings,
      COUNT(*) FILTER (WHERE timestamp >= $${paramIndex} AND severity IN ('critical', 'emergency')) as critical_errors,
      COUNT(*) FILTER (WHERE timestamp >= $${paramIndex} AND category = 'source_sync') as sync_events,
      COUNT(*) FILTER (WHERE timestamp >= $${paramIndex} AND category = 'validation') as validation_events,
      COUNT(*) FILTER (WHERE timestamp >= $${paramIndex} AND category = 'scoring') as scoring_events,
      COUNT(*) FILTER (WHERE timestamp >= $${paramIndex} AND category = 'handoff') as handoff_events,
      COUNT(*) FILTER (WHERE timestamp >= $${paramIndex} AND user_id IS NOT NULL) as user_actions,
      COUNT(*) FILTER (WHERE timestamp >= $${paramIndex} AND category = 'provider_error') as provider_errors,
      COUNT(*) FILTER (WHERE timestamp >= $${paramIndex} AND resolution_status = 'pending') as unresolved_issues,
      MAX(timestamp) as last_log_received
     FROM (${OPERATIONAL_LOGS_QUERY}) logs
     WHERE ${whereClause}`,
    [...params, today]
  );

  const row = rows[0];

  return {
    totalLogsToday: parseInt(row.total_logs_today || 0),
    successfulEvents: parseInt(row.successful_events || 0),
    failedEvents: parseInt(row.failed_events || 0),
    warnings: parseInt(row.warnings || 0),
    criticalErrors: parseInt(row.critical_errors || 0),
    syncEvents: parseInt(row.sync_events || 0),
    validationEvents: parseInt(row.validation_events || 0),
    scoringEvents: parseInt(row.scoring_events || 0),
    handoffEvents: parseInt(row.handoff_events || 0),
    userActions: parseInt(row.user_actions || 0),
    providerErrors: parseInt(row.provider_errors || 0),
    unresolvedIssues: parseInt(row.unresolved_issues || 0),
    lastLogReceived: row.last_log_received,
    criticalErrorsToday: parseInt(row.critical_errors || 0)
  };
}

export async function getLogCategories() {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const { rows } = await query(
    `SELECT DISTINCT category
     FROM (${OPERATIONAL_LOGS_QUERY}) logs
     ORDER BY category`
  );

  return rows.map(row => row.category);
}

export async function getCriticalErrors(filters = {}) {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const { limit = 50, environment = "production" } = filters;

  const { rows } = await query(
    `SELECT
      timestamp,
      module,
      category,
      error_code,
      message,
      entity_type as affected_entity_type,
      entity_id as affected_entity_id,
      severity,
      retry_count,
      resolved,
      recommended_action
     FROM (
       SELECT
        timestamp,
        module,
        category,
        error_code,
        message,
        affected_entity_type as entity_type,
        affected_entity_id::text as entity_id,
        severity,
        retry_count,
        resolved,
        recommended_action,
        environment
       FROM market_intelligence.market_intelligence_error_logs
       UNION ALL
       SELECT
        timestamp,
        module,
        category,
        error_code,
        message,
        entity_type,
        entity_id,
        severity,
        retry_count,
        resolved,
        recommended_action,
        environment
       FROM (${OPERATIONAL_LOGS_QUERY}) logs
       WHERE status = 'failed' OR severity IN ('error', 'critical', 'emergency')
     ) errors
     WHERE severity IN ('error', 'critical', 'emergency')
       AND environment = $1
     ORDER BY timestamp DESC
     LIMIT $2`,
    [environment, limit]
  );

  return rows;
}

export async function getAuditLogs(filters = {}) {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const {
    page = 1,
    pageSize = 50,
    userId,
    entityType,
    entityId,
    environment = "production"
  } = filters;

  const offset = (page - 1) * pageSize;
  const conditions = ["environment = $1"];
  const params = [environment];
  let paramIndex = 2;

  if (userId) {
    conditions.push(`user_id = $${paramIndex}`);
    params.push(userId);
    paramIndex++;
  }

  if (entityType) {
    conditions.push(`entity_type = $${paramIndex}`);
    params.push(entityType);
    paramIndex++;
  }

  if (entityId) {
    conditions.push(`entity_id = $${paramIndex}`);
    params.push(entityId);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

  const { rows } = await query(
    `SELECT * FROM market_intelligence.market_intelligence_audit_logs
     WHERE ${whereClause}
     ORDER BY timestamp DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, pageSize, offset]
  );

  return rows;
}

export async function getLogTimeline(correlationId) {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const { rows } = await query(
    `SELECT * FROM market_intelligence.market_intelligence_log_timeline
     WHERE correlation_id = $1
     ORDER BY sequence ASC`,
    [correlationId]
  );

  return rows;
}

export async function getLogsMetrics(filters = {}) {
  if (!isDatabaseConfigured()) {
    return {
      logsOverTime: [],
      errorsOverTime: [],
      syncFailuresOverTime: [],
      validationFailuresOverTime: [],
      scoringRunsOverTime: [],
      handoffSuccessRate: 0,
      averageProcessingDuration: 0,
      topFailingSources: [],
      topErrorCategories: []
    };
  }

  const { dateFrom, dateTo, environment = "production" } = filters;

  const conditions = ["environment = $1"];
  const params = [environment];
  let paramIndex = 2;

  if (dateFrom) {
    conditions.push(`timestamp >= $${paramIndex}`);
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    conditions.push(`timestamp <= $${paramIndex}`);
    params.push(dateTo);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

  // Logs over time (hourly for last 24 hours)
  const { rows: logsOverTime } = await query(
    `SELECT
      date_trunc('hour', timestamp) as hour,
      COUNT(*) as count
     FROM (${OPERATIONAL_LOGS_QUERY}) logs
     WHERE ${whereClause}
       AND timestamp >= NOW() - INTERVAL '24 hours'
     GROUP BY date_trunc('hour', timestamp)
     ORDER BY hour ASC`,
    params
  );

  // Errors over time
  const { rows: errorsOverTime } = await query(
    `SELECT
      date_trunc('hour', timestamp) as hour,
      COUNT(*) as count
     FROM (${OPERATIONAL_LOGS_QUERY}) logs
     WHERE ${whereClause}
       AND severity IN ('error', 'critical', 'emergency')
       AND timestamp >= NOW() - INTERVAL '24 hours'
     GROUP BY date_trunc('hour', timestamp)
     ORDER BY hour ASC`,
    params
  );

  // Top failing sources
  const { rows: topFailingSources } = await query(
    `SELECT
      source,
      COUNT(*) FILTER (WHERE status = 'failed') as failure_count
     FROM (${OPERATIONAL_LOGS_QUERY}) logs
     WHERE ${whereClause}
       AND source IS NOT NULL
     GROUP BY source
     ORDER BY failure_count DESC
     LIMIT 10`,
    params
  );

  // Top error categories
  const { rows: topErrorCategories } = await query(
    `SELECT
      category,
      COUNT(*) FILTER (WHERE status = 'failed') as failure_count
     FROM (${OPERATIONAL_LOGS_QUERY}) logs
     WHERE ${whereClause}
     GROUP BY category
     ORDER BY failure_count DESC
     LIMIT 10`,
    params
  );

  // Average processing duration
  const { rows: avgDuration } = await query(
    `SELECT AVG(duration_ms) as avg_duration
     FROM (${OPERATIONAL_LOGS_QUERY}) logs
     WHERE ${whereClause}
       AND duration_ms IS NOT NULL`,
    params
  );

  // Handoff success rate
  const { rows: handoffStats } = await query(
    `SELECT
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) as total
     FROM (${OPERATIONAL_LOGS_QUERY}) logs
     WHERE ${whereClause}
       AND category = 'handoff'`,
    params
  );

  const handoffSuccessRate = handoffStats[0]?.total > 0
    ? (handoffStats[0].completed / handoffStats[0].total) * 100
    : 0;

  return {
    logsOverTime,
    errorsOverTime,
    syncFailuresOverTime: [],
    validationFailuresOverTime: [],
    scoringRunsOverTime: [],
    handoffSuccessRate,
    averageProcessingDuration: avgDuration[0]?.avg_duration || 0,
    topFailingSources,
    topErrorCategories
  };
}

function maskSensitiveLogFields(log) {
  if (!log) return log;
  return {
    ...log,
    ip_address: log.ip_address ? "[requires market_intelligence.logs.view_sensitive]" : log.ip_address,
    stack_trace: log.stack_trace ? "[requires market_intelligence.logs.view_sensitive]" : log.stack_trace,
    payload_snapshot: log.payload_snapshot ? { restricted: "requires market_intelligence.logs.view_sensitive" } : log.payload_snapshot,
    before_value: log.before_value ? { restricted: "requires market_intelligence.logs.view_sensitive" } : log.before_value,
    after_value: log.after_value ? { restricted: "requires market_intelligence.logs.view_sensitive" } : log.after_value
  };
}

export async function getLogById(logId, options = {}) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (String(logId).includes(":")) {
    const { rows } = await query(
      `SELECT * FROM (${OPERATIONAL_LOGS_QUERY}) logs
       WHERE id = $1`,
      [logId]
    );
    const log = rows[0] || null;
    return options.includeSensitive ? log : maskSensitiveLogFields(log);
  }

  const { rows } = await query(
    `SELECT * FROM market_intelligence.market_intelligence_logs
     WHERE id = $1`,
    [logId]
  );

  const log = rows[0] || null;
  return options.includeSensitive ? log : maskSensitiveLogFields(log);
}

export async function acknowledgeLog(logId, userId) {
  if (!isDatabaseConfigured()) {
    throw new Error("database_not_configured");
  }

  const { rows } = await query(
    `UPDATE market_intelligence.market_intelligence_logs
     SET resolution_status = 'acknowledged',
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [logId]
  );

  // Record audit log
  await query(
    `INSERT INTO market_intelligence.market_intelligence_audit_logs
     (user_id, action, entity_type, entity_id, environment)
     VALUES ($1, 'acknowledge', 'log', $2, 'production')`,
    [userId, logId]
  );

  return rows[0];
}

export async function resolveLog(logId, userId) {
  if (!isDatabaseConfigured()) {
    throw new Error("database_not_configured");
  }

  const { rows } = await query(
    `UPDATE market_intelligence.market_intelligence_logs
     SET resolution_status = 'resolved',
         resolved_at = NOW(),
         resolved_by = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [userId, logId]
  );

  // Record audit log
  await query(
    `INSERT INTO market_intelligence.market_intelligence_audit_logs
     (user_id, action, entity_type, entity_id, environment)
     VALUES ($1, 'resolve', 'log', $2, 'production')`,
    [userId, logId]
  );

  return rows[0];
}

export async function createIncident(logId, incidentData) {
  if (!isDatabaseConfigured()) {
    throw new Error("database_not_configured");
  }

  const {
    title,
    severity,
    affectedModule,
    affectedSource,
    description,
    assignedTo,
    assignedToName,
    dueDate
  } = incidentData;

  const { rows } = await query(
    `INSERT INTO market_intelligence.market_intelligence_incidents
     (title, severity, affected_module, affected_source, description,
      assigned_to, assigned_to_name, due_date, status, related_log_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9)
     RETURNING *`,
    [title, severity, affectedModule, affectedSource, description,
     assignedTo, assignedToName, dueDate, logId]
  );

  // Update log to reference the incident
  await query(
    `UPDATE market_intelligence.market_intelligence_logs
     SET resolution_status = 'acknowledged',
         updated_at = NOW()
     WHERE id = $1`,
    [logId]
  );

  return rows[0];
}

export async function exportLogs(filters, exportType) {
  if (!isDatabaseConfigured()) {
    throw new Error("database_not_configured");
  }

  const logs = await getMarketIntelligenceLogs({ ...filters, pageSize: 10000 });

  // Create export record
  const { rows } = await query(
    `INSERT INTO market_intelligence.market_intelligence_log_exports
     (export_type, filters, status, row_count, created_by_name)
     VALUES ($1, $2, 'completed', $3, 'system')
     RETURNING *`,
    [exportType, JSON.stringify(filters), logs.logs.length]
  );

  return {
    exportId: rows[0].id,
    logs: logs.logs,
    total: logs.total
  };
}

export async function createLog(logData) {
  if (!isDatabaseConfigured()) {
    throw new Error("database_not_configured");
  }

  const {
    severity,
    status,
    module,
    category,
    action,
    message,
    detailedDescription,
    entityType,
    entityId,
    userId,
    userName,
    ipAddress,
    source,
    provider,
    requestId,
    correlationId,
    durationMs,
    environment,
    errorCode,
    stackTrace,
    payloadSnapshot,
    beforeValue,
    afterValue,
    recommendedAction
  } = logData;

  const { rows } = await query(
    `INSERT INTO market_intelligence.market_intelligence_logs
     (severity, status, module, category, action, message, detailed_description,
      entity_type, entity_id, user_id, user_name, ip_address, source, provider,
      request_id, correlation_id, duration_ms, environment, error_code, stack_trace,
      payload_snapshot, before_value, after_value, recommended_action)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
     RETURNING *`,
    [severity, status, module, category, action, message, detailedDescription,
     entityType, entityId, userId, userName, ipAddress, source, provider,
     requestId, correlationId, durationMs, environment, errorCode, stackTrace,
     JSON.stringify(payloadSnapshot || {}), JSON.stringify(beforeValue || {}),
     JSON.stringify(afterValue || {}), recommendedAction]
  );

  return rows[0];
}
