import { isDatabaseConfigured, query, withTransaction } from "./db.js";

export const TARGET_ASSETS = Object.freeze([
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD",
  "EURJPY", "GBPJPY", "AUDJPY", "CADJPY", "EURGBP", "EURAUD", "EURCAD",
  "XAUUSD", "NAS100", "US30", "SPX500", "GER40", "USOIL"
]);

export const PROVIDER_TYPES = Object.freeze([
  "MT5", "Broker Price Feed", "TwelveData", "Polygon", "Finnhub",
  "AlphaVantage", "TradingView", "Custom Feed"
]);

export const CONNECTION_METHODS = Object.freeze([
  "REST", "WebSocket", "MT5 Bridge", "FIX", "Manual Upload", "Hybrid"
]);

export const AUTH_TYPES = Object.freeze([
  "None", "API Key", "Bearer Token", "OAuth", "Vault Secret"
]);

const PROVIDER_COLUMNS = `
  id, provider_key, name, provider_type, connection_method, base_url, websocket_url,
  auth_type, vault_secret_ref, status, enabled, environment, archived, notes,
  supported_asset_classes, phase, api_url, config, last_sync_at, created_at, updated_at
`;

function mapProvider(row) {
  if (!row) return null;
  return {
    id: row.id,
    providerKey: row.provider_key,
    name: row.name,
    providerType: row.provider_type,
    type: row.provider_type,
    connectionMethod: row.connection_method,
    baseUrl: row.base_url || row.api_url || "",
    websocketUrl: row.websocket_url || "",
    authType: row.auth_type || "None",
    vaultSecretRef: row.vault_secret_ref || "",
    status: row.status,
    enabled: row.enabled,
    environment: row.environment,
    archived: row.archived,
    notes: row.notes || "",
    supportedAssetClasses: row.supported_asset_classes || [],
    phase: row.phase,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function slugify(name) {
  return String(name || "provider")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "provider";
}

export async function listProviders({ includeArchived = false } = {}) {
  if (!isDatabaseConfigured()) return [];
  const archivedClause = includeArchived ? "" : "AND archived = false";
  const { rows } = await query(
    `SELECT ${PROVIDER_COLUMNS} FROM market.market_data_providers WHERE 1=1 ${archivedClause} ORDER BY created_at ASC`
  );
  return rows.map(mapProvider);
}

export async function getProviderById(id) {
  if (!isDatabaseConfigured()) return null;
  const { rows } = await query(
    `SELECT ${PROVIDER_COLUMNS} FROM market.market_data_providers WHERE id = $1 AND archived = false`,
    [id]
  );
  return mapProvider(rows[0]);
}

export async function createProvider(input) {
  const providerKey = `${slugify(input.name)}-${Date.now().toString(36)}`;
  const { rows } = await query(
    `INSERT INTO market.market_data_providers (
      provider_key, name, provider_type, connection_method, base_url, websocket_url,
      auth_type, vault_secret_ref, status, enabled, environment, notes,
      supported_asset_classes, api_url, config
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$5,$14::jsonb)
    RETURNING ${PROVIDER_COLUMNS}`,
    [
      providerKey,
      input.name,
      input.providerType,
      input.connectionMethod,
      input.baseUrl || null,
      input.websocketUrl || null,
      normalizeAuthType(input.authType),
      input.vaultSecretRef || null,
      input.enabled === false ? "DISABLED" : "NOT_CONFIGURED",
      input.enabled !== false,
      input.environment,
      input.notes || null,
      JSON.stringify(input.supportedAssetClasses || []),
      JSON.stringify({ notes: input.notes || "" })
    ]
  );
  return mapProvider(rows[0]);
}

export async function updateProvider(id, input) {
  const existing = await getProviderById(id);
  if (!existing) throw new Error("provider_not_found");

  const { rows } = await query(
    `UPDATE market.market_data_providers SET
      name = COALESCE($2, name),
      provider_type = COALESCE($3, provider_type),
      connection_method = COALESCE($4, connection_method),
      base_url = COALESCE($5, base_url),
      websocket_url = COALESCE($6, websocket_url),
      auth_type = COALESCE($7, auth_type),
      vault_secret_ref = COALESCE($8, vault_secret_ref),
      enabled = COALESCE($9, enabled),
      environment = COALESCE($10, environment),
      notes = COALESCE($11, notes),
      supported_asset_classes = COALESCE($12::jsonb, supported_asset_classes),
      api_url = COALESCE($5, api_url),
      status = CASE WHEN $9 = false THEN 'DISABLED' WHEN enabled = false AND $9 = true THEN 'NOT_CONFIGURED' ELSE status END,
      updated_at = now()
    WHERE id = $1 AND archived = false
    RETURNING ${PROVIDER_COLUMNS}`,
    [
      id,
      input.name ?? null,
      input.providerType ?? null,
      input.connectionMethod ?? null,
      input.baseUrl ?? null,
      input.websocketUrl ?? null,
      input.authType != null ? normalizeAuthType(input.authType) : null,
      input.vaultSecretRef ?? null,
      input.enabled ?? null,
      input.environment ?? null,
      input.notes ?? null,
      input.supportedAssetClasses != null ? JSON.stringify(input.supportedAssetClasses) : null
    ]
  );
  return mapProvider(rows[0]);
}

export async function archiveProvider(id) {
  const { rows } = await query(
    `UPDATE market.market_data_providers SET archived = true, enabled = false, status = 'ARCHIVED', updated_at = now()
     WHERE id = $1 AND archived = false RETURNING id, name`,
    [id]
  );
  if (!rows[0]) throw new Error("provider_not_found");
  return rows[0];
}

export async function setProviderEnabled(id, enabled) {
  const { rows } = await query(
    `UPDATE market.market_data_providers SET enabled = $2,
      status = CASE WHEN $2 = false THEN 'DISABLED' ELSE 'NOT_CONFIGURED' END,
      updated_at = now()
     WHERE id = $1 AND archived = false RETURNING ${PROVIDER_COLUMNS}`,
    [id, enabled]
  );
  if (!rows[0]) throw new Error("provider_not_found");
  return mapProvider(rows[0]);
}

export async function appendLog({ providerId = null, providerName = "system", event, severity = "info", message }) {
  const { rows } = await query(
    `INSERT INTO market.market_data_logs (provider_id, provider_name, event, severity, message)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, provider_id, provider_name, event, severity, message, created_at`,
    [providerId, providerName, event, severity, message]
  );
  return rows[0];
}

export async function listLogs(limit = 100) {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT id, provider_id, provider_name, event, severity, message, created_at
     FROM market.market_data_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({
    id: row.id,
    providerId: row.provider_id,
    provider: row.provider_name || "system",
    event: row.event,
    severity: row.severity,
    message: row.message,
    timestamp: row.created_at,
    time: new Date(row.created_at).toISOString().slice(11, 19)
  }));
}

export async function insertHealth({ providerId, status, health, freshness, tickRate = null }) {
  await query(
    `INSERT INTO market.market_data_health (provider_id, status, health, freshness, tick_rate)
     VALUES ($1, $2, $3, $4, $5)`,
    [providerId, status, health, freshness, tickRate]
  );
}

export async function insertLatency({ providerId, latencyMs, latencyClass }) {
  await query(
    `INSERT INTO market.market_data_latency (provider_id, latency_ms, latency_class)
     VALUES ($1, $2, $3)`,
    [providerId, latencyMs, latencyClass]
  );
}

export async function insertIntegrity({ integrityScore, checks }) {
  await query(
    `INSERT INTO market.market_data_integrity (integrity_score, checks) VALUES ($1, $2::jsonb)`,
    [integrityScore, JSON.stringify(checks)]
  );
}

export async function insertConfidence({ confidenceScore, integrityScore, workflowPermission, factors }) {
  await query(
    `INSERT INTO market.market_data_confidence (confidence_score, integrity_score, workflow_permission, factors)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [confidenceScore, integrityScore, workflowPermission, JSON.stringify(factors)]
  );
}

export async function getLatestHealthByProvider() {
  if (!isDatabaseConfigured()) return new Map();
  const { rows } = await query(
    `SELECT DISTINCT ON (h.provider_id)
      h.provider_id, h.status, h.health, h.freshness, h.tick_rate, h.observed_at,
      (
        SELECT l.latency_ms FROM market.market_data_latency l
        WHERE l.provider_id = h.provider_id
        ORDER BY l.observed_at DESC
        LIMIT 1
      ) AS latency_ms
     FROM market.market_data_health h
     ORDER BY h.provider_id, h.observed_at DESC`
  );
  return new Map(rows.map((row) => [row.provider_id, row]));
}

export async function getLatestIntegrity() {
  if (!isDatabaseConfigured()) return null;
  const { rows } = await query(
    `SELECT integrity_score, checks, observed_at FROM market.market_data_integrity ORDER BY observed_at DESC LIMIT 1`
  );
  return rows[0] || null;
}

export async function getLatestConfidence() {
  if (!isDatabaseConfigured()) return null;
  const { rows } = await query(
    `SELECT confidence_score, integrity_score, workflow_permission, factors, observed_at
     FROM market.market_data_confidence ORDER BY observed_at DESC LIMIT 1`
  );
  return rows[0] || null;
}

export async function listSymbols() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT symbol, asset_class, enabled FROM market.market_data_symbols WHERE enabled = true ORDER BY symbol ASC`
  );
  return rows;
}

export async function listCoverageRows() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT c.provider_id, p.name AS provider_name, c.symbol, c.price_feed, c.tick_feed,
      c.spread_feed, c.volume_feed, c.coverage, c.status
     FROM market.market_data_coverage c
     JOIN market.market_data_providers p ON p.id = c.provider_id
     WHERE p.archived = false
     ORDER BY c.symbol ASC, p.name ASC`
  );
  return rows;
}

export async function getLatestTicks(limit = 40) {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT DISTINCT ON (symbol) symbol, bid, ask, spread, observed_at, provider_id
     FROM market.market_data_ticks ORDER BY symbol, observed_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getLatencyTrend(limit = 12) {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT latency_ms, observed_at FROM market.market_data_latency ORDER BY observed_at DESC LIMIT $1`,
    [limit]
  );
  return rows.reverse();
}

export async function getProviderLatencySummary() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT DISTINCT ON (l.provider_id)
      l.provider_id, p.name, l.latency_ms, l.latency_class
     FROM market.market_data_latency l
     JOIN market.market_data_providers p ON p.id = l.provider_id
     WHERE p.archived = false
     ORDER BY l.provider_id, l.observed_at DESC`
  );
  return rows;
}

export async function replaceProviderCoverage(providerId, rows) {
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM market.market_data_coverage WHERE provider_id = $1`, [providerId]);
    for (const row of rows) {
      await client.query(
        `INSERT INTO market.market_data_coverage
          (provider_id, symbol, price_feed, tick_feed, spread_feed, volume_feed, coverage, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (provider_id, symbol) DO UPDATE SET
          price_feed = EXCLUDED.price_feed, tick_feed = EXCLUDED.tick_feed,
          spread_feed = EXCLUDED.spread_feed, volume_feed = EXCLUDED.volume_feed,
          coverage = EXCLUDED.coverage, status = EXCLUDED.status`,
        [
          providerId, row.symbol, row.priceFeed, row.tickFeed,
          row.spreadFeed, row.volumeFeed, row.coverage, row.status
        ]
      );
    }
    await client.query(
      `UPDATE market.market_data_providers SET last_sync_at = now(), updated_at = now() WHERE id = $1`,
      [providerId]
    );
  });
}

export async function insertTicks(ticks) {
  if (!ticks.length) return;
  for (const tick of ticks) {
    await query(
      `INSERT INTO market.market_data_ticks (symbol, provider_id, bid, ask, spread) VALUES ($1,$2,$3,$4,$5)`,
      [tick.symbol, tick.providerId, tick.bid, tick.ask, tick.spread]
    );
  }
}

export async function updateProviderStatus(providerId, status) {
  await query(
    `UPDATE market.market_data_providers SET status = $2, updated_at = now() WHERE id = $1`,
    [providerId, status]
  );
}

function normalizeAuthType(value) {
  const normalized = String(value || "None").toLowerCase().replace(/\s+/g, "_");
  if (normalized === "api_key") return "api_key";
  if (normalized === "bearer_token") return "bearer_token";
  if (normalized === "oauth") return "oauth";
  if (normalized === "vault_secret") return "vault_secret";
  return "none";
}

export function validateProviderInput(input, { partial = false } = {}) {
  const errors = [];
  if (!partial || input.name != null) {
    if (!String(input.name || "").trim()) errors.push("name_required");
  }
  if (!partial || input.providerType != null) {
    if (!PROVIDER_TYPES.includes(input.providerType)) errors.push("provider_type_invalid");
  }
  if (!partial || input.connectionMethod != null) {
    if (!CONNECTION_METHODS.includes(input.connectionMethod)) errors.push("connection_method_invalid");
  }
  if (!partial || input.environment != null) {
    if (!String(input.environment || "").trim()) errors.push("environment_required");
  }
  const method = input.connectionMethod;
  if (["REST", "WebSocket", "Hybrid"].includes(method)) {
    if (!String(input.baseUrl || "").trim() && !String(input.websocketUrl || "").trim()) {
      errors.push("url_required");
    }
  }
  const auth = String(input.authType || "None");
  if (auth !== "None" && !String(input.vaultSecretRef || "").trim()) {
    errors.push("vault_secret_ref_required");
  }
  if (errors.length) throw new Error(errors[0]);
}
