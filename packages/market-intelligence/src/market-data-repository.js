import { assertDatabaseReady, isDatabaseConfigured, query, withTransaction } from "./db.js";
import { applyWizardPreset } from "./provider-wizard-catalog.js";

export const TARGET_ASSETS = Object.freeze([
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD",
  "EURJPY", "GBPJPY", "AUDJPY", "CADJPY", "EURGBP", "EURAUD", "EURCAD",
  "XAUUSD", "NAS100", "US30", "SPX500", "GER40", "USOIL"
]);

export const PROVIDER_TYPES = Object.freeze([
  "MT5", "Broker Feed", "TwelveData", "Polygon", "Finnhub",
  "AlphaVantage", "TradingView", "DXFeed", "Bloomberg", "Refinitiv", "Custom Feed"
]);

export const CONNECTION_METHODS = Object.freeze([
  "REST API", "WebSocket", "MT5 Bridge", "FIX", "Database", "Manual Upload", "Hybrid"
]);

export const AUTH_TYPES = Object.freeze([
  "None", "API Key", "Bearer Token", "OAuth", "Vault Secret"
]);

export const ENVIRONMENTS = Object.freeze([
  "Development", "Testing", "Staging", "Production"
]);

export const CAPABILITY_KEYS = Object.freeze([
  "realTimePrices", "historicalData", "tickData", "spreadData", "volumeData",
  "depthOfMarket", "newsData", "sentimentData", "economicData", "cotData"
]);

export const ASSET_COVERAGE_OPTIONS = Object.freeze([
  "Forex", "Indices", "Metals", "Commodities", "Crypto", "Bonds", "Equities"
]);

const PROVIDER_CODE_PREFIX = Object.freeze({
  MT5: "MT5",
  "Broker Feed": "BROKER",
  "TwelveData": "TWELVEDATA",
  Polygon: "POLYGON",
  Finnhub: "FINNHUB",
  AlphaVantage: "ALPHAVANTAGE",
  TradingView: "TRADINGVIEW",
  DXFeed: "DXFEED",
  Bloomberg: "BLOOMBERG",
  Refinitiv: "REFINITIV",
  "Custom Feed": "CUSTOM"
});

const PROVIDER_COLUMNS = `
  id, provider_key, provider_code, name, provider_type, connection_method, base_url, websocket_url,
  port, auth_type, vault_secret_ref, status, enabled, environment, archived, description,
  vendor_website, contact_info, notes, supported_asset_classes, asset_coverage, supported_symbols,
  capabilities, health_score, last_tested_at, created_by, phase, api_url, config, last_sync_at,
  created_at, updated_at
`;

function mapProvider(row) {
  if (!row) return null;
  return {
    id: row.id,
    providerKey: row.provider_key,
    providerCode: row.provider_code || row.provider_key,
    name: row.name,
    providerType: row.provider_type,
    type: row.provider_type,
    connectionMethod: row.connection_method,
    baseUrl: row.base_url || row.api_url || "",
    websocketUrl: row.websocket_url || "",
    port: row.port,
    authType: formatAuthType(row.auth_type),
    vaultSecretRef: row.vault_secret_ref || "",
    status: row.status,
    enabled: row.enabled,
    environment: row.environment,
    archived: row.archived,
    description: row.description || "",
    vendorWebsite: row.vendor_website || "",
    contactInfo: row.contact_info || "",
    notes: row.notes || "",
    supportedAssetClasses: row.asset_coverage || row.supported_asset_classes || [],
    supportedSymbols: row.supported_symbols || [],
    capabilities: row.capabilities || {},
    healthScore: row.health_score != null ? Number(row.health_score) : null,
    lastTestedAt: row.last_tested_at,
    createdBy: row.created_by || "system.admin",
    phase: row.phase,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    config: row.config || {}
  };
}

function formatAuthType(value) {
  const map = {
    none: "None",
    api_key: "API Key",
    bearer_token: "Bearer Token",
    oauth: "OAuth",
    vault_secret: "Vault Secret"
  };
  return map[String(value || "none").toLowerCase()] || "None";
}

function normalizeAuthType(value) {
  const normalized = String(value || "None").toLowerCase().replace(/\s+/g, "_");
  if (normalized === "api_key") return "api_key";
  if (normalized === "bearer_token") return "bearer_token";
  if (normalized === "oauth") return "oauth";
  if (normalized === "vault_secret") return "vault_secret";
  return "none";
}

export function normalizeConnectionMethod(value) {
  const map = {
    rest: "REST API",
    "rest api": "REST API",
    websocket: "WebSocket",
    "mt5 bridge": "MT5 Bridge",
    fix: "FIX",
    database: "Database",
    "manual upload": "Manual Upload",
    hybrid: "Hybrid"
  };
  return map[String(value || "").toLowerCase()] || value;
}

export function parseSymbols(input) {
  if (Array.isArray(input)) return input.map((item) => String(item).trim().toUpperCase()).filter(Boolean);
  return String(input || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

export async function generateProviderCode(providerType) {
  const prefix = PROVIDER_CODE_PREFIX[providerType] || "CUSTOM";
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM market.market_data_providers
     WHERE provider_type = $1 AND archived = false`,
    [providerType]
  );
  return `${prefix}_${String(rows[0].count + 1).padStart(3, "0")}`;
}

export async function assertNoDuplicateName(name, excludeId = null) {
  const { rows } = await query(
    `SELECT id FROM market.market_data_providers
     WHERE lower(name) = lower($1) AND archived = false
     ${excludeId ? "AND id <> $2" : ""}
     LIMIT 1`,
    excludeId ? [name, excludeId] : [name]
  );
  if (rows[0]) throw new Error("duplicate_provider_name");
}

export async function assertNoDuplicateUrl(baseUrl, websocketUrl, excludeId = null) {
  const urls = [baseUrl, websocketUrl].map((item) => String(item || "").trim()).filter(Boolean);
  for (const url of urls) {
    const params = excludeId ? [url, excludeId] : [url];
    const { rows } = await query(
      `SELECT id FROM market.market_data_providers
       WHERE archived = false AND (base_url = $1 OR websocket_url = $1 OR api_url = $1)
       ${excludeId ? "AND id <> $2" : ""}
       LIMIT 1`,
      params
    );
    if (rows[0]) throw new Error("duplicate_provider_url");
  }
}

export function extractMt5Identity(input) {
  const normalized = applyWizardPreset(input);
  const method = normalizeConnectionMethod(normalized.connectionMethod);
  const isMt5 = method === "MT5 Bridge"
    || normalized.wizardCategory === "mt5_terminal"
    || normalized.category === "mt5_terminal"
    || normalized.providerType === "MT5";
  if (!isMt5) return null;

  const brokerName = String(normalized.brokerName || normalized.customBrokerName || normalized.name || "").trim();
  const serverName = String(
    normalized.customServer
      ? (normalized.customServerName || normalized.serverName || "")
      : (normalized.serverName || "")
  ).trim();
  const environment = String(normalized.environment || "Production").trim();
  if (!brokerName) return null;
  return { brokerName, serverName, environment };
}

export async function findDuplicateMt5Provider(identity, excludeId = null) {
  if (!identity?.brokerName || !isDatabaseConfigured()) return null;
  const params = [
    identity.brokerName.toLowerCase(),
    identity.serverName.toLowerCase(),
    identity.environment.toLowerCase()
  ];
  const excludeClause = excludeId ? "AND id <> $4" : "";
  if (excludeId) params.push(excludeId);
  const { rows } = await query(
    `SELECT id, name, provider_code
     FROM market.market_data_providers
     WHERE archived = false
       AND connection_method = 'MT5 Bridge'
       AND lower(environment) = $3
       AND lower(coalesce(config->'mt5'->>'brokerName', name)) = $1
       AND lower(coalesce(config->'mt5'->>'serverName', '')) = $2
       ${excludeClause}
     ORDER BY created_at ASC
     LIMIT 1`,
    params
  );
  return rows[0] || null;
}

export async function assertNoDuplicateMt5TerminalProvider(input, excludeId = null) {
  const identity = extractMt5Identity(input);
  if (!identity) return identity;
  const duplicate = await findDuplicateMt5Provider(identity, excludeId);
  if (!duplicate) return identity;
  const error = new Error("duplicate_mt5_terminal_provider");
  error.details = {
    existingId: duplicate.id,
    existingName: duplicate.name,
    existingCode: duplicate.provider_code,
    brokerName: identity.brokerName,
    serverName: identity.serverName,
    environment: identity.environment
  };
  throw error;
}

export function validateProviderInput(input, { partial = false, draft = false, wizard = false } = {}) {
  const errors = [];
  const normalized = applyWizardPreset(input);
  const method = normalizeConnectionMethod(normalized.connectionMethod);
  const auth = String(normalized.authType || "None");
  const category = normalized.wizardCategory || normalized.category;

  if (!partial || normalized.name != null) {
    if (!String(normalized.name || "").trim()) errors.push("name_required");
  }
  if (!partial || normalized.providerType != null) {
    if (!PROVIDER_TYPES.includes(normalized.providerType)) errors.push("provider_type_invalid");
  }
  if (!partial || normalized.connectionMethod != null) {
    if (!CONNECTION_METHODS.includes(method)) errors.push("connection_method_invalid");
  }
  if (!partial || normalized.environment != null) {
    if (!ENVIRONMENTS.includes(normalized.environment) && !String(normalized.environment || "").trim()) {
      errors.push("environment_required");
    }
  }

  if (!draft && wizard) {
    if (category === "mt5_terminal") {
      const brokerName = String(normalized.brokerName || "").trim();
      const isCustomBroker = brokerName.toLowerCase() === "custom broker";
      if (!brokerName) errors.push("broker_name_required");
      if (isCustomBroker && !String(normalized.customBrokerName || "").trim()) errors.push("custom_broker_name_required");
      if (normalized.customServer) {
        if (!String(normalized.customServerName || normalized.serverName || "").trim()) errors.push("custom_server_name_required");
      } else if (!String(normalized.serverName || "").trim()) {
        errors.push("server_name_required");
      }
    }
    if (category === "external_vendor" && !normalized.vendorKey?.includes("custom")) {
      if (!String(normalized.apiKey || normalized.vaultSecretRef || "").trim()) errors.push("api_key_required");
    }
  }

  if (!draft && !wizard) {
    if (method === "REST API" && !String(normalized.baseUrl || "").trim()) errors.push("base_url_required");
    if (method === "WebSocket" && !String(normalized.websocketUrl || "").trim()) errors.push("websocket_url_required");
    if (method === "Hybrid" && !String(normalized.baseUrl || "").trim() && !String(normalized.websocketUrl || "").trim()) {
      errors.push("url_required");
    }
    if (auth !== "None" && !String(normalized.vaultSecretRef || "").trim()) errors.push("vault_secret_ref_required");
  }

  if (!draft && category === "custom_provider") {
    if (method === "REST API" && !String(normalized.baseUrl || "").trim()) errors.push("base_url_required");
    if (auth !== "None" && !String(normalized.vaultSecretRef || "").trim() && !String(normalized.apiKey || "").trim()) {
      errors.push("vault_secret_ref_required");
    }
  }

  if (errors.length) throw new Error(errors[0]);
  return { ...normalized, connectionMethod: method };
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

function buildProviderConfig(normalized) {
  return {
    internalNotes: normalized.notes || "",
    wizardCategory: normalized.wizardCategory || normalized.category || null,
    providerTemplateId: normalized.providerTemplateId || null,
    vendorKey: normalized.vendorKey || null,
    mt5: normalized.wizardCategory === "mt5_terminal" || normalized.category === "mt5_terminal" ? {
      brokerName: normalized.brokerName || normalized.customBrokerName || "",
      brokerSearchName: normalized.brokerSearchName || "",
      terminalName: normalized.terminalName || "",
      accountNumber: normalized.accountNumber || "",
      serverName: normalized.customServer ? (normalized.customServerName || normalized.serverName || "") : (normalized.serverName || ""),
      serverVerificationStatus: normalized.serverVerificationStatus || (normalized.customServer ? "UNVERIFIED" : ""),
      serverSource: normalized.serverSource || (normalized.customServer ? "custom_user_entry" : ""),
      serverCatalogId: normalized.serverCatalogId || null,
      customServer: Boolean(normalized.customServer),
      terminalLocation: normalized.terminalLocation || "",
      terminalId: normalized.terminalId || null,
      machineId: normalized.machineId || null,
      dataPath: normalized.dataPath || "",
      buildVersion: normalized.buildVersion || ""
    } : null,
    advanced: normalized.advanced || null
  };
}

async function updateProviderFromWizard(id, normalized, { createdBy, draft = false }) {
  const config = buildProviderConfig(normalized);
  const supportedSymbols = parseSymbols(normalized.supportedSymbols);
  const assetCoverage = normalized.assetCoverage || normalized.supportedAssetClasses || [];
  const capabilities = normalized.capabilities || {};
  const status = draft ? "DRAFT" : normalized.enabled === false ? "DISABLED" : "NOT_CONFIGURED";
  const { rows } = await query(
    `UPDATE market.market_data_providers SET
      name = $2,
      provider_type = $3,
      connection_method = $4,
      base_url = $5,
      websocket_url = $6,
      port = $7,
      auth_type = $8,
      vault_secret_ref = $9,
      enabled = $10,
      environment = $11,
      description = $12,
      vendor_website = $13,
      contact_info = $14,
      notes = $15,
      asset_coverage = $16::jsonb,
      supported_asset_classes = $16::jsonb,
      supported_symbols = $17::jsonb,
      capabilities = $18::jsonb,
      api_url = $5,
      config = $19::jsonb,
      status = $20,
      updated_at = now()
    WHERE id = $1 AND archived = false
    RETURNING ${PROVIDER_COLUMNS}`,
    [
      id,
      normalized.name.trim(),
      normalized.providerType,
      normalized.connectionMethod,
      normalized.baseUrl || null,
      normalized.websocketUrl || null,
      normalized.port ? Number(normalized.port) : null,
      normalizeAuthType(normalized.authType),
      normalized.vaultSecretRef || null,
      draft ? false : normalized.enabled !== false,
      normalized.environment,
      normalized.description || null,
      normalized.vendorWebsite || null,
      normalized.contactInfo || null,
      normalized.notes || null,
      JSON.stringify(assetCoverage),
      JSON.stringify(supportedSymbols),
      JSON.stringify(capabilities),
      JSON.stringify(config),
      status
    ]
  );
  if (!rows[0]) throw new Error("provider_not_found");
  return mapProvider(rows[0]);
}

export async function createProvider(input, { createdBy = "system.admin", draft = false, wizard = false } = {}) {
  await assertDatabaseReady();
  const normalized = validateProviderInput(input, { draft, wizard });
  const mt5Identity = extractMt5Identity(normalized);
  const existingMt5 = mt5Identity ? await findDuplicateMt5Provider(mt5Identity) : null;

  if (existingMt5) {
    const existing = await getProviderById(existingMt5.id);
    if (existing) {
      if (draft || existing.status === "DRAFT") {
        await assertNoDuplicateName(normalized.name, existing.id);
        return updateProviderFromWizard(existing.id, normalized, { createdBy, draft });
      }
      if (!draft) {
        await assertNoDuplicateMt5TerminalProvider(normalized);
      }
    }
  }

  await assertNoDuplicateName(normalized.name);
  if (normalized.wizardCategory !== "mt5_terminal" && normalized.category !== "mt5_terminal") {
    await assertNoDuplicateUrl(normalized.baseUrl, normalized.websocketUrl);
  } else if (!draft) {
    await assertNoDuplicateMt5TerminalProvider(normalized);
  }

  const providerCode = await generateProviderCode(normalized.providerType);
  const supportedSymbols = parseSymbols(normalized.supportedSymbols);
  const assetCoverage = normalized.assetCoverage || normalized.supportedAssetClasses || [];
  const capabilities = normalized.capabilities || {};
  const status = draft ? "DRAFT" : normalized.enabled === false ? "DISABLED" : "NOT_CONFIGURED";

  const config = buildProviderConfig(normalized);

  const vaultRef = normalized.vaultSecretRef
    || (normalized.apiKey ? normalized.vaultSecretRef || `MARKETDATA_${String(normalized.vendorKey || normalized.providerType).toUpperCase()}_API_KEY` : null);

  const { rows } = await query(
    `INSERT INTO market.market_data_providers (
      provider_key, provider_code, name, provider_type, connection_method, base_url, websocket_url, port,
      auth_type, vault_secret_ref, status, enabled, environment, description, vendor_website, contact_info,
      notes, supported_asset_classes, asset_coverage, supported_symbols, capabilities, created_by, api_url, config
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$6,$23::jsonb)
    RETURNING ${PROVIDER_COLUMNS}`,
    [
      providerCode,
      providerCode,
      normalized.name.trim(),
      normalized.providerType,
      normalized.connectionMethod,
      normalized.baseUrl || null,
      normalized.websocketUrl || null,
      normalized.port ? Number(normalized.port) : null,
      normalizeAuthType(normalized.authType),
      vaultRef || null,
      status,
      draft ? false : normalized.enabled !== false,
      normalized.environment,
      normalized.description || null,
      normalized.vendorWebsite || null,
      normalized.contactInfo || null,
      normalized.notes || null,
      JSON.stringify(assetCoverage),
      JSON.stringify(assetCoverage),
      JSON.stringify(supportedSymbols),
      JSON.stringify(capabilities),
      createdBy,
      JSON.stringify(config)
    ]
  );
  return mapProvider(rows[0]);
}

export async function updateProvider(id, input) {
  const existing = await getProviderById(id);
  if (!existing) throw new Error("provider_not_found");
  if (input.name) await assertNoDuplicateName(input.name, id);
  await assertNoDuplicateUrl(input.baseUrl ?? existing.baseUrl, input.websocketUrl ?? existing.websocketUrl, id);

  const { rows } = await query(
    `UPDATE market.market_data_providers SET
      name = COALESCE($2, name),
      provider_type = COALESCE($3, provider_type),
      connection_method = COALESCE($4, connection_method),
      base_url = COALESCE($5, base_url),
      websocket_url = COALESCE($6, websocket_url),
      port = COALESCE($7, port),
      auth_type = COALESCE($8, auth_type),
      vault_secret_ref = COALESCE($9, vault_secret_ref),
      enabled = COALESCE($10, enabled),
      environment = COALESCE($11, environment),
      description = COALESCE($12, description),
      vendor_website = COALESCE($13, vendor_website),
      contact_info = COALESCE($14, contact_info),
      notes = COALESCE($15, notes),
      asset_coverage = COALESCE($16::jsonb, asset_coverage),
      supported_asset_classes = COALESCE($16::jsonb, supported_asset_classes),
      supported_symbols = COALESCE($17::jsonb, supported_symbols),
      capabilities = COALESCE($18::jsonb, capabilities),
      api_url = COALESCE($5, api_url),
      status = CASE WHEN $10 = false THEN 'DISABLED' WHEN status = 'DRAFT' AND $10 = true THEN 'NOT_CONFIGURED' ELSE status END,
      updated_at = now()
    WHERE id = $1 AND archived = false
    RETURNING ${PROVIDER_COLUMNS}`,
    [
      id,
      input.name ?? null,
      input.providerType ?? null,
      input.connectionMethod ? normalizeConnectionMethod(input.connectionMethod) : null,
      input.baseUrl ?? null,
      input.websocketUrl ?? null,
      input.port != null ? Number(input.port) : null,
      input.authType != null ? normalizeAuthType(input.authType) : null,
      input.vaultSecretRef ?? null,
      input.enabled ?? null,
      input.environment ?? null,
      input.description ?? null,
      input.vendorWebsite ?? null,
      input.contactInfo ?? null,
      input.notes ?? null,
      input.assetCoverage != null ? JSON.stringify(input.assetCoverage) : null,
      input.supportedSymbols != null ? JSON.stringify(parseSymbols(input.supportedSymbols)) : null,
      input.capabilities != null ? JSON.stringify(input.capabilities) : null
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

export async function appendLog({
  providerId = null,
  providerName = "system",
  event,
  action = null,
  actor = "system.admin",
  result = "SUCCESS",
  severity = "info",
  message
}) {
  if (!isDatabaseConfigured()) return null;
  const { rows } = await query(
    `INSERT INTO market.market_data_logs (provider_id, provider_name, event, action, actor, result, severity, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, provider_id, provider_name, event, action, actor, result, severity, message, created_at`,
    [providerId, providerName, event, action || event, actor, result, severity, message]
  );
  return rows[0];
}

export async function updateProviderHealthMeta(providerId, { healthScore, status, lastTestedAt = new Date().toISOString() }) {
  await query(
    `UPDATE market.market_data_providers
     SET health_score = $2, status = $3, last_tested_at = $4, updated_at = now()
     WHERE id = $1`,
    [providerId, healthScore, status, lastTestedAt]
  );
}

export async function listLogs(limit = 100) {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT id, provider_id, provider_name, event, action, actor, result, severity, message, created_at
     FROM market.market_data_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({
    id: row.id,
    providerId: row.provider_id,
    provider: row.provider_name || "system",
    event: row.event,
    action: row.action,
    actor: row.actor,
    result: row.result,
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
    `WITH latest_health AS (
       SELECT DISTINCT ON (provider_id)
        provider_id, status, health, freshness, tick_rate, observed_at
       FROM market.market_data_health
       ORDER BY provider_id, observed_at DESC
     )
     SELECT h.provider_id, h.status, h.health, h.freshness, h.tick_rate, h.observed_at,
      l.latency_ms
     FROM latest_health h
     LEFT JOIN LATERAL (
       SELECT latency_ms
       FROM market.market_data_latency l
       WHERE l.provider_id = h.provider_id
       ORDER BY l.observed_at DESC
       LIMIT 1
     ) l ON true`
  );
  return new Map(rows.map((row) => [row.provider_id, row]));
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

export async function updateProviderStatus(providerId, status) {
  await query(
    `UPDATE market.market_data_providers SET status = $2, updated_at = now() WHERE id = $1`,
    [providerId, status]
  );
}

export function previewCoverageFromInput(input) {
  const symbols = parseSymbols(input.supportedSymbols);
  const universe = symbols.length ? symbols : TARGET_ASSETS;
  const assetCoverage = input.assetCoverage || [];
  return {
    assetCoverage,
    symbols: universe,
    estimatedCoverage: universe.length,
    coveragePct: Math.round((universe.length / TARGET_ASSETS.length) * 100)
  };
}

export function buildProbeTarget(input) {
  const normalized = applyWizardPreset(input);
  const method = normalizeConnectionMethod(normalized.connectionMethod);
  if (method === "WebSocket") return normalized.websocketUrl || normalized.baseUrl;
  if (method === "MT5 Bridge") {
    return normalized.baseUrl || process.env.MARKET_DATA_LIVE_URL || "";
  }
  return normalized.baseUrl || normalized.websocketUrl || "";
}

export async function insertProviderTest({ providerId = null, testType, result, latencyMs = null, diagnostics = {}, actor = "system.admin" }) {
  if (!isDatabaseConfigured()) return null;
  const { rows } = await query(
    `INSERT INTO market.market_data_provider_tests (provider_id, test_type, result, latency_ms, diagnostics, actor)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING id, provider_id, test_type, result, latency_ms, diagnostics, created_at`,
    [providerId, testType, result, latencyMs, JSON.stringify(diagnostics), actor]
  );
  return rows[0];
}

export async function saveProviderSymbols(providerId, symbols, { source = "detected" } = {}) {
  if (!isDatabaseConfigured() || !symbols?.length) return [];
  const saved = [];
  await withTransaction(async (client) => {
    for (const symbol of symbols) {
      const value = String(symbol).trim().toUpperCase();
      if (!value) continue;
      const { rows } = await client.query(
        `INSERT INTO market.market_data_provider_symbols (provider_id, symbol, source)
         VALUES ($1, $2, $3)
         ON CONFLICT (provider_id, symbol) DO UPDATE SET enabled = true, source = EXCLUDED.source
         RETURNING symbol`,
        [providerId, value, source]
      );
      if (rows[0]) saved.push(rows[0].symbol);
    }
  });
  return saved;
}

export async function createProviderDependencies(providerId, cards) {
  if (!isDatabaseConfigured()) return [];
  const rows = [];
  for (const item of cards) {
    const { rows: inserted } = await query(
      `INSERT INTO market.market_data_provider_dependencies (provider_id, workflow_card, target, impact)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider_id, workflow_card) DO UPDATE SET target = EXCLUDED.target, impact = EXCLUDED.impact
       RETURNING workflow_card, target, impact`,
      [providerId, item.card, item.target, item.impact]
    );
    if (inserted[0]) rows.push(inserted[0]);
  }
  return rows;
}

export async function listDetectedMt5Terminals() {
  if (!isDatabaseConfigured()) return [];
  try {
    const { rows } = await query(
      `SELECT t.id, t.terminal_key, t.installation_path, t.mt5_build, t.status,
              b.name AS broker_name, a.account_number
       FROM infrastructure.mt5_terminals t
       LEFT JOIN infrastructure.mt5_accounts a ON a.terminal_id = t.id
       LEFT JOIN infrastructure.brokers b ON b.id = a.broker_id
       ORDER BY t.created_at DESC
       LIMIT 20`
    );
    return rows.map((row) => ({
      id: row.id,
      broker: row.broker_name || "Unknown Broker",
      account: row.account_number || "",
      buildVersion: row.mt5_build || "",
      dataPath: row.installation_path,
      terminalName: row.terminal_key,
      status: row.status
    }));
  } catch {
    return [];
  }
}
