import { isDatabaseConfigured, query, withTransaction } from "./db.js";

export const ASSET_UNIVERSE_REGISTRY_TABLES = Object.freeze([
  "market.asset_universe",
  "market.asset_classes",
  "market.symbol_registry",
  "market.broker_symbol_mappings",
  "market.asset_scan_rules",
  "market.asset_readiness_scores",
  "market.asset_import_batches",
  "market.asset_import_rows",
  "market.asset_universe_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.universe.view",
  create: "universe_scanner.universe.create",
  update: "universe_scanner.universe.update",
  delete: "universe_scanner.universe.delete",
  import: "universe_scanner.universe.import",
  syncBrokerSymbols: "universe_scanner.universe.sync_broker_symbols",
  mapSymbol: "universe_scanner.universe.map_symbol",
  enableScan: "universe_scanner.universe.enable_scan",
  disableScan: "universe_scanner.universe.disable_scan",
  export: "universe_scanner.universe.export"
});

const n = value => value === null || value === undefined || value === "" ? null : Number(value);
const round = value => value === null || value === undefined || Number.isNaN(Number(value)) ? null : Math.round(Number(value));

async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    if (["42P01", "42703", "42883"].includes(error.code)) return { rows: [] };
    throw error;
  }
}

async function tableReadiness() {
  const { rows } = await query(
    "SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name",
    [ASSET_UNIVERSE_REGISTRY_TABLES]
  );
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyRegistry(status, message, missingTables = []) {
  return {
    sourceMode: "DATABASE_ASSETS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, databaseAssetsOnly: true, lastSymbolSync: null, activeAssets: 0 },
    summary: {
      totalAssets: 0,
      activeAssets: 0,
      inactiveAssets: 0,
      scanEnabled: 0,
      scanDisabled: 0,
      mappedBrokerSymbols: 0,
      unmappedAssets: 0,
      assetsMissingPriceFeed: 0,
      assetsMissingHistoricalData: 0,
      blockedAssets: 0,
      lastSyncStatus: "No Data",
      registryHealthScore: null,
      status: "No Data"
    },
    assetClasses: [],
    assets: [],
    mappings: [],
    readiness: [],
    imports: [],
    audit: [],
    emptyState: {
      title: "No assets have been registered yet.",
      message: "Add assets manually, import a verified asset list, or sync symbols from a connected broker before running the universe scanner.",
      actions: ["Add Asset", "Import Asset List", "Sync Broker Symbols", "Open Broker Data"]
    }
  };
}

function readinessLabel(score) {
  if (!score) return "No Data";
  if (score >= 90) return "Ready";
  if (score >= 75) return "Ready With Warnings";
  if (score >= 60) return "Incomplete";
  return "Blocked";
}

function registryStatus(score, total) {
  if (!total) return "No Data";
  if (score >= 85) return "Healthy";
  if (score >= 70) return "Warning";
  if (score >= 50) return "Incomplete";
  return "Blocked";
}

function validateAssetInput(input = {}, existingAsset = null) {
  const errors = [];
  const assetCode = String(input.assetCode || input.asset || existingAsset?.asset_code || "").trim().toUpperCase();
  if (!assetCode) errors.push("Asset code is required");
  if (!String(input.assetClass || existingAsset?.asset_class || "").trim()) errors.push("Asset class is required");
  const tickSize = n(input.tickSize ?? existingAsset?.tick_size);
  const pipSize = n(input.pipSize ?? existingAsset?.pip_size);
  const minimumLot = n(input.minimumLot ?? existingAsset?.minimum_lot);
  const maximumLot = n(input.maximumLot ?? existingAsset?.maximum_lot);
  if (tickSize !== null && tickSize <= 0) errors.push("Tick size must be greater than zero");
  if (pipSize !== null && pipSize <= 0) errors.push("Pip size must be greater than zero");
  if (minimumLot !== null && maximumLot !== null && minimumLot > maximumLot) errors.push("Minimum lot cannot exceed maximum lot");
  if (errors.length) {
    const error = new Error("validation_failed");
    error.status = 400;
    error.details = errors;
    throw error;
  }
  return { assetCode, tickSize, pipSize, minimumLot, maximumLot };
}

async function latestReadinessRows() {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (asset_id) asset_id, readiness, readiness_score AS "readinessScore",
      active_status_score AS "activeStatusScore", scan_enabled_score AS "scanEnabledScore",
      broker_mapping_score AS "brokerMappingScore", live_price_feed_score AS "livePriceFeedScore",
      historical_data_score AS "historicalDataScore", source_health_score AS "sourceHealthScore",
      liquidity_score AS "liquidityScore", compliance_score AS "complianceScore", rules_score AS "rulesScore",
      blocking_reasons AS "blockingReasons", calculated_at AS "calculatedAt"
    FROM market.asset_readiness_scores
    ORDER BY asset_id, calculated_at DESC
  `);
  return new Map(rows.map(row => [String(row.asset_id), row]));
}

async function assetRows() {
  const readinessMap = await latestReadinessRows();
  const { rows } = await safeQuery(`
    SELECT a.id, COALESCE(a.asset_code, a.asset) AS "assetCode", COALESCE(a.display_name, sr.display_name, a.asset) AS "displayName",
      COALESCE(a.asset_class, sr.asset_class) AS "assetClass", COALESCE(a.base_asset, sr.base_asset) AS "baseAsset",
      COALESCE(a.quote_asset, sr.quote_asset) AS "quoteAsset", a.status, a.active, a.scanner_enabled AS "scanEnabled",
      a.default_timezone AS "defaultTimezone", a.default_session AS "defaultSession", a.tick_size AS "tickSize",
      a.pip_size AS "pipSize", a.contract_size AS "contractSize", a.minimum_lot AS "minimumLot", a.maximum_lot AS "maximumLot",
      m.broker_symbol AS "brokerSymbol", m.broker, m.platform,
      p.last_price AS "lastPrice", p.spread, p.last_scanned AS "lastUpdated",
      CASE WHEN p.last_price IS NULL THEN 'Missing' ELSE 'Live' END AS "dataFeedStatus",
      CASE WHEN hd.asset IS NULL THEN 'Missing' ELSE 'Available' END AS "historicalDataStatus",
      COALESCE(liq.status, 'No Data') AS "liquidityStatus",
      COALESCE(comp.status, 'No Data') AS "complianceStatus"
    FROM market.asset_universe a
    LEFT JOIN market.symbol_registry sr ON sr.asset_code = COALESCE(a.asset_code, a.asset)
    LEFT JOIN LATERAL (
      SELECT broker_symbol, broker, platform FROM market.broker_symbol_mappings
      WHERE asset_id = a.id AND is_active
      ORDER BY last_verified DESC NULLS LAST, updated_at DESC LIMIT 1
    ) m ON true
    LEFT JOIN LATERAL (
      SELECT last_price, spread, last_scanned FROM market.asset_scan_results
      WHERE asset_id = a.id OR asset = COALESCE(a.asset_code, a.asset)
      ORDER BY last_scanned DESC LIMIT 1
    ) p ON true
    LEFT JOIN LATERAL (
      SELECT asset FROM market.asset_scan_results
      WHERE (asset_id = a.id OR asset = COALESCE(a.asset_code, a.asset)) AND payload ? 'historicalData'
      LIMIT 1
    ) hd ON true
    LEFT JOIN LATERAL (
      SELECT status FROM market.asset_scan_results
      WHERE (asset_id = a.id OR asset = COALESCE(a.asset_code, a.asset)) AND payload ? 'liquidityStatus'
      ORDER BY last_scanned DESC LIMIT 1
    ) liq ON true
    LEFT JOIN LATERAL (
      SELECT status FROM market.asset_scan_results
      WHERE (asset_id = a.id OR asset = COALESCE(a.asset_code, a.asset)) AND payload ? 'complianceStatus'
      ORDER BY last_scanned DESC LIMIT 1
    ) comp ON true
    WHERE a.archived_at IS NULL
    ORDER BY a.asset_class, COALESCE(a.asset_code, a.asset)
  `);
  return rows.map(row => {
    const readiness = readinessMap.get(String(row.id));
    return {
      ...row,
      scanEnabled: Boolean(row.scanEnabled),
      readiness: readiness?.readiness || "No Data",
      readinessScore: round(readiness?.readinessScore),
      tickSize: n(row.tickSize),
      pipSize: n(row.pipSize),
      contractSize: n(row.contractSize),
      minimumLot: n(row.minimumLot),
      maximumLot: n(row.maximumLot)
    };
  });
}

async function mappings() {
  const { rows } = await safeQuery(`
    SELECT id, asset_id AS "assetId", asset, broker, platform, server, broker_symbol AS "brokerSymbol",
      symbol_suffix AS "symbolSuffix", symbol_prefix AS "symbolPrefix", digits, tick_size AS "tickSize",
      contract_size AS "contractSize", is_active AS "isActive", last_verified AS "lastVerified", verification_status AS "verificationStatus"
    FROM market.broker_symbol_mappings
    ORDER BY asset, broker, platform, broker_symbol
  `);
  return rows.map(row => ({ ...row, isActive: Boolean(row.isActive) }));
}

async function assetClasses() {
  const { rows } = await safeQuery(`
    SELECT class_key AS "classKey", class_name AS "className", status
    FROM market.asset_classes
    UNION
    SELECT DISTINCT lower(asset_class) AS "classKey", asset_class AS "className", 'Active' AS status
    FROM market.symbol_registry
    WHERE asset_class IS NOT NULL AND asset_class <> ''
    ORDER BY "className"
  `);
  return rows;
}

async function summary(assets, mappingRows) {
  const total = assets.length;
  const active = assets.filter(row => row.status === "Active" || row.active).length;
  const scanEnabled = assets.filter(row => row.scanEnabled).length;
  const mappedAssetIds = new Set(mappingRows.filter(row => row.isActive).map(row => String(row.assetId)));
  const mapped = mappedAssetIds.size;
  const blocked = assets.filter(row => row.readiness === "Blocked").length;
  const missingPrice = assets.filter(row => row.dataFeedStatus === "Missing").length;
  const missingHistory = assets.filter(row => row.historicalDataStatus === "Missing").length;
  const health = total ? round(assets.reduce((sum, row) => sum + Number(row.readinessScore || 0), 0) / total) : null;
  const lastSync = await safeQuery("SELECT status, created_at FROM market.asset_import_batches ORDER BY created_at DESC LIMIT 1");
  return {
    totalAssets: total,
    activeAssets: active,
    inactiveAssets: Math.max(0, total - active),
    scanEnabled,
    scanDisabled: Math.max(0, total - scanEnabled),
    mappedBrokerSymbols: mappingRows.filter(row => row.isActive).length,
    unmappedAssets: Math.max(0, total - mapped),
    assetsMissingPriceFeed: missingPrice,
    assetsMissingHistoricalData: missingHistory,
    blockedAssets: blocked,
    lastSyncStatus: lastSync.rows[0]?.status || "No Data",
    registryHealthScore: health,
    status: registryStatus(health, total)
  };
}

async function auditRows(assetId = null) {
  const params = assetId ? [assetId] : [];
  const { rows } = await safeQuery(`
    SELECT asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType",
      entity_id AS "entityId", before_value AS "beforeValue", after_value AS "afterValue", reason, created_at AS "createdAt"
    FROM market.asset_universe_audit_logs
    ${assetId ? "WHERE asset_id = $1" : ""}
    ORDER BY created_at DESC LIMIT 80
  `, params);
  return rows;
}

async function imports() {
  const { rows } = await safeQuery(`
    SELECT id, import_source AS "importSource", file_name AS "fileName", status, total_rows AS "totalRows",
      accepted_rows AS "acceptedRows", rejected_rows AS "rejectedRows", created_by AS "createdBy", created_at AS "createdAt"
    FROM market.asset_import_batches
    ORDER BY created_at DESC LIMIT 30
  `);
  return rows;
}

export async function getAssetUniverseRegistry() {
  if (!isDatabaseConfigured()) return emptyRegistry("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const readiness = await tableReadiness();
  if (!readiness.ready) return emptyRegistry("SCHEMA_NOT_READY", `Missing tables: ${readiness.missing.join(", ")}`, readiness.missing);
  const [assets, mappingRows, classRows, importRows, audit] = await Promise.all([assetRows(), mappings(), assetClasses(), imports(), auditRows()]);
  return {
    sourceMode: "DATABASE_ASSETS_ONLY",
    mockDataDisabled: true,
    status: assets.length ? "READY" : "EMPTY",
    schemaReady: true,
    permissions: permissions(),
    badges: {
      productionLive: true,
      mockDataDisabled: true,
      databaseAssetsOnly: true,
      lastSymbolSync: importRows[0]?.createdAt || null,
      activeAssets: assets.filter(row => row.status === "Active" || row.active).length
    },
    summary: await summary(assets, mappingRows),
    assetClasses: classRows,
    assets,
    mappings: mappingRows,
    readiness: assets.map(row => ({ assetId: row.id, asset: row.assetCode, readiness: row.readiness, readinessScore: row.readinessScore })),
    imports: importRows,
    audit,
    emptyState: assets.length ? null : emptyRegistry("EMPTY", "No assets have been registered yet.").emptyState
  };
}

export async function getAssetUniverseRegistrySlice(slice) {
  const registry = await getAssetUniverseRegistry();
  const map = {
    summary: { status: registry.status, summary: registry.summary, badges: registry.badges },
    assets: { status: registry.status, assets: registry.assets },
    "asset-classes": { status: registry.status, assetClasses: registry.assetClasses },
    mappings: { status: registry.status, mappings: registry.mappings },
    readiness: { status: registry.status, readiness: registry.readiness },
    export: registry
  };
  return map[slice] || registry;
}

async function assertReady() {
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
}

async function getAsset(id) {
  const { rows } = await safeQuery("SELECT * FROM market.asset_universe WHERE id = $1 AND archived_at IS NULL LIMIT 1", [id]);
  return rows[0] || null;
}

export async function getAssetUniverseDetail(id) {
  await assertReady();
  const asset = await getAsset(id);
  if (!asset) return null;
  const registry = await getAssetUniverseRegistry();
  return {
    asset: registry.assets.find(row => String(row.id) === String(id)) || asset,
    mappings: registry.mappings.filter(row => String(row.assetId) === String(id)),
    readiness: registry.readiness.find(row => String(row.assetId) === String(id)) || null,
    audit: await auditRows(id)
  };
}

export async function calculateAssetReadiness(id, actor = "api") {
  await assertReady();
  const asset = await getAsset(id);
  if (!asset) throw new Error("asset_not_found");
  const mapping = await safeQuery("SELECT COUNT(*)::int AS count FROM market.broker_symbol_mappings WHERE asset_id = $1 AND is_active", [id]);
  const latest = await safeQuery("SELECT last_price, payload FROM market.asset_scan_results WHERE asset_id = $1 OR asset = $2 ORDER BY last_scanned DESC LIMIT 1", [id, asset.asset_code || asset.asset]);
  const rules = await safeQuery("SELECT * FROM market.asset_scan_rules WHERE asset_id = $1 LIMIT 1", [id]);
  const mapped = Number(mapping.rows[0]?.count || 0) > 0;
  const hasPrice = latest.rows[0]?.last_price !== null && latest.rows[0]?.last_price !== undefined;
  const hasHistory = Boolean(latest.rows[0]?.payload?.historicalData);
  const rule = rules.rows[0];
  const parts = {
    activeStatusScore: asset.status === "Active" && asset.active ? 15 : 0,
    scanEnabledScore: asset.scanner_enabled ? 15 : 0,
    brokerMappingScore: mapped ? 15 : 0,
    livePriceFeedScore: hasPrice ? 15 : 0,
    historicalDataScore: hasHistory || !rule?.required_historical_data ? 10 : 0,
    sourceHealthScore: 10,
    liquidityScore: latest.rows[0]?.payload?.liquidityStatus ? 10 : 0,
    complianceScore: latest.rows[0]?.payload?.complianceStatus ? 5 : 0,
    rulesScore: rule ? 5 : 0
  };
  const score = Object.values(parts).reduce((sum, value) => sum + value, 0);
  const blockingReasons = [];
  if (asset.status !== "Active" || !asset.active) blockingReasons.push("Asset inactive");
  if (!asset.scanner_enabled) blockingReasons.push("Scan disabled");
  if (!mapped) blockingReasons.push("Broker symbol not mapped");
  if (!hasPrice) blockingReasons.push("Live price feed missing");
  if (rule?.required_historical_data && !hasHistory) blockingReasons.push("Historical data missing");
  await withTransaction(async client => {
    await client.query(
      `INSERT INTO market.asset_readiness_scores (asset_id, readiness, readiness_score, active_status_score, scan_enabled_score, broker_mapping_score, live_price_feed_score, historical_data_score, source_health_score, liquidity_score, compliance_score, rules_score, blocking_reasons)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
      [id, readinessLabel(score), score, parts.activeStatusScore, parts.scanEnabledScore, parts.brokerMappingScore, parts.livePriceFeedScore, parts.historicalDataScore, parts.sourceHealthScore, parts.liquidityScore, parts.complianceScore, parts.rulesScore, JSON.stringify(blockingReasons)]
    );
    await client.query("INSERT INTO market.asset_universe_audit_logs (asset_id, user_name, action, after_value) VALUES ($1,$2,'run_readiness_check',$3::jsonb)", [id, actor, JSON.stringify({ score, readiness: readinessLabel(score), blockingReasons })]);
  });
  return { assetId: id, readiness: readinessLabel(score), readinessScore: score, blockingReasons };
}

export async function runAssetUniverseAction(action, body = {}, actor = "api", id = null) {
  await assertReady();
  if (action === "create-asset") {
    const valid = validateAssetInput(body);
    const duplicate = await safeQuery("SELECT id FROM market.asset_universe WHERE asset_code = $1 OR asset = $1 LIMIT 1", [valid.assetCode]);
    if (duplicate.rows.length) {
      const error = new Error("asset_code_must_be_unique");
      error.status = 409;
      throw error;
    }
    const created = await withTransaction(async client => {
      const result = await client.query(
        `INSERT INTO market.asset_universe (asset, asset_code, display_name, asset_class, base_asset, quote_asset, default_timezone, default_session, tick_size, pip_size, contract_size, minimum_lot, maximum_lot, scanner_enabled, status, active)
         VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [valid.assetCode, body.displayName || valid.assetCode, body.assetClass, body.baseAsset || null, body.quoteAsset || null, body.defaultTimezone || null, body.defaultSession || null, valid.tickSize, valid.pipSize, n(body.contractSize), valid.minimumLot, valid.maximumLot, Boolean(body.scanEnabled), body.status || "Inactive", body.status === "Active"]
      );
      await client.query("INSERT INTO market.asset_scan_rules (asset_id, include_universe_scan) VALUES ($1,$2) ON CONFLICT (asset_id) DO NOTHING", [result.rows[0].id, Boolean(body.scanEnabled)]);
      await client.query("INSERT INTO market.asset_universe_audit_logs (asset_id, user_name, action, after_value) VALUES ($1,$2,'asset_created',$3::jsonb)", [result.rows[0].id, actor, JSON.stringify(body)]);
      return result.rows[0];
    });
    return { accepted: true, assetId: created.id };
  }
  if (action === "update-asset") {
    const existing = await getAsset(id);
    if (!existing) throw new Error("asset_not_found");
    const valid = validateAssetInput(body, existing);
    await withTransaction(async client => {
      await client.query(
        `UPDATE market.asset_universe SET display_name=$2, asset_class=$3, base_asset=$4, quote_asset=$5, default_timezone=$6, default_session=$7,
          tick_size=$8, pip_size=$9, contract_size=$10, minimum_lot=$11, maximum_lot=$12, scanner_enabled=$13, status=$14, active=$15, updated_at=now()
         WHERE id=$1`,
        [id, body.displayName ?? existing.display_name, body.assetClass ?? existing.asset_class, body.baseAsset ?? existing.base_asset, body.quoteAsset ?? existing.quote_asset, body.defaultTimezone ?? existing.default_timezone, body.defaultSession ?? existing.default_session, valid.tickSize, valid.pipSize, n(body.contractSize ?? existing.contract_size), valid.minimumLot, valid.maximumLot, body.scanEnabled ?? existing.scanner_enabled, body.status ?? existing.status, (body.status ?? existing.status) === "Active"]
      );
      await client.query("INSERT INTO market.asset_universe_audit_logs (asset_id, user_name, action, before_value, after_value) VALUES ($1,$2,'asset_updated',$3::jsonb,$4::jsonb)", [id, actor, JSON.stringify(existing), JSON.stringify(body)]);
    });
    return { accepted: true, assetId: id };
  }
  if (action === "enable-scan" || action === "disable-scan") {
    const enabled = action === "enable-scan";
    await safeQuery("UPDATE market.asset_universe SET scanner_enabled = $2, updated_at = now() WHERE id = $1", [id, enabled]);
    await safeQuery("INSERT INTO market.asset_universe_audit_logs (asset_id, user_name, action, after_value) VALUES ($1,$2,$3,$4::jsonb)", [id, actor, action, JSON.stringify({ scannerEnabled: enabled })]);
    return { accepted: true, assetId: id, scannerEnabled: enabled };
  }
  if (action === "delete-asset") {
    await safeQuery("UPDATE market.asset_universe SET status = 'Archived', active = false, scanner_enabled = false, archived_at = now() WHERE id = $1", [id]);
    await safeQuery("INSERT INTO market.asset_universe_audit_logs (asset_id, user_name, action) VALUES ($1,$2,'asset_archived')", [id, actor]);
    return { accepted: true, assetId: id, archived: true };
  }
  if (action === "map-symbol") {
    const asset = await getAsset(id);
    if (!asset) throw new Error("asset_not_found");
    if (!body.brokerSymbol) throw new Error("broker_symbol_required");
    await safeQuery(
      `INSERT INTO market.broker_symbol_mappings (asset_id, asset, broker, platform, server, broker_symbol, symbol_suffix, symbol_prefix, digits, tick_size, contract_size, is_active, last_verified, verification_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,now(),'Manual')`,
      [id, asset.asset_code || asset.asset, body.broker || null, body.platform || null, body.server || null, body.brokerSymbol, body.symbolSuffix || null, body.symbolPrefix || null, body.digits || null, n(body.tickSize), n(body.contractSize)]
    );
    await safeQuery("INSERT INTO market.asset_universe_audit_logs (asset_id, user_name, action, after_value) VALUES ($1,$2,'symbol_mapped',$3::jsonb)", [id, actor, JSON.stringify(body)]);
    return { accepted: true, assetId: id };
  }
  if (action === "run-readiness-check") return calculateAssetReadiness(id, actor);
  if (action === "import") {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const batch = await withTransaction(async client => {
      const result = await client.query(
        "INSERT INTO market.asset_import_batches (import_source, file_name, status, total_rows, created_by, payload) VALUES ($1,$2,'Pending Review',$3,$4,$5::jsonb) RETURNING id",
        [body.importSource || "Manual Upload", body.fileName || null, rows.length, actor, JSON.stringify({ importType: body.importType || null })]
      );
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index] || {};
        await client.query(
          "INSERT INTO market.asset_import_rows (batch_id, row_number, asset_code, display_name, asset_class, broker_symbol, status, payload) VALUES ($1,$2,$3,$4,$5,$6,'Pending Review',$7::jsonb)",
          [result.rows[0].id, index + 1, row.assetCode || null, row.displayName || null, row.assetClass || null, row.brokerSymbol || null, JSON.stringify(row)]
        );
      }
      await client.query("INSERT INTO market.asset_universe_audit_logs (user_name, action, after_value) VALUES ($1,'asset_import_created',$2::jsonb)", [actor, JSON.stringify({ batchId: result.rows[0].id, rows: rows.length })]);
      return result.rows[0];
    });
    return { accepted: true, batchId: batch.id, status: "Pending Review" };
  }
  if (action === "sync-broker-symbols") {
    const batch = await safeQuery(
      "INSERT INTO market.asset_import_batches (import_source, status, total_rows, created_by, payload) VALUES ('Broker Symbol Sync','Pending Review',0,$1,$2::jsonb) RETURNING id",
      [actor, JSON.stringify({ source: "connected_broker_symbols", note: "No automatic scan enabling. Pending review required." })]
    );
    await safeQuery("INSERT INTO market.asset_universe_audit_logs (user_name, action, after_value) VALUES ($1,'broker_symbol_sync_requested',$2::jsonb)", [actor, JSON.stringify({ batchId: batch.rows[0].id })]);
    return { accepted: true, batchId: batch.rows[0].id, status: "Pending Review" };
  }
  throw new Error("unsupported_asset_universe_action");
}

export async function exportAssetUniverseRegistry() {
  return { exportedAt: new Date().toISOString(), registry: await getAssetUniverseRegistry() };
}
