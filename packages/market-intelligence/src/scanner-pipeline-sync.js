import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";
import { getCurrencyStrengthEngine } from "./currency-strength-engine.js";
import { getTrendScannerEngine } from "./trend-scanner-engine.js";
import { getMarketStructureScannerEngine } from "./market-structure-scanner-engine.js";
import { getMomentumScannerEngine } from "./momentum-scanner-engine.js";
import { getVolatilityScannerEngine } from "./volatility-scanner-engine.js";
import { getLiquidityScannerEngine } from "./liquidity-scanner-engine.js";
import { getInstitutionalScannerEngine } from "./institutional-scanner-engine.js";
import { getSentimentScannerEngine } from "./sentiment-scanner-engine.js";
import { getMacroScannerEngine } from "./macro-scanner-engine.js";
import { getEconomicEventsScannerEngine } from "./economic-events-scanner-engine.js";
import { getRiskScannerEngine } from "./risk-scanner-engine.js";
import { getPropComplianceScannerEngine } from "./prop-compliance-scanner-engine.js";

const CALENDAR_STORE = fileURLToPath(new URL("../../../apps/web/public/data/economic-calendar-intelligence.json", import.meta.url));

async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    if (["42P01", "42703", "42883"].includes(error.code)) return { rows: [] };
    throw error;
  }
}

async function scalar(sql, params = []) {
  const { rows } = await safeQuery(sql, params);
  return Number(rows[0]?.value || 0);
}

export function readCalendarEvents() {
  if (!existsSync(CALENDAR_STORE)) return [];
  try {
    const store = JSON.parse(readFileSync(CALENDAR_STORE, "utf8").replace(/^\uFEFF/, ""));
    return Array.isArray(store.events) ? store.events : [];
  } catch {
    return [];
  }
}

export async function syncBrokerMappingsFromMarketData(actor = "scanner-pipeline-sync") {
  await syncAssetUniverseFromLiveSources(actor);
  const { rows } = await safeQuery(`
    SELECT DISTINCT s.symbol, COALESCE(s.asset_class, 'Forex') AS asset_class
    FROM market.market_data_symbols s
    WHERE s.enabled = true
  `);
  let mappings = 0;
  for (const row of rows) {
    const asset = String(row.symbol || "").trim().toUpperCase();
    if (!asset) continue;
    const universe = await safeQuery(
      `INSERT INTO market.asset_universe (asset, asset_code, display_name, asset_class, status, active, scanner_enabled, broker_symbol)
       VALUES ($1,$1,$1,$2,'Active',true,true,$1)
       ON CONFLICT (asset_code) DO UPDATE SET active = true, scanner_enabled = true, status = 'Active', broker_symbol = COALESCE(market.asset_universe.broker_symbol, EXCLUDED.broker_symbol), updated_at = now()
       RETURNING id, asset`,
      [asset, row.asset_class]
    );
    const assetId = universe.rows[0]?.id;
    if (!assetId) continue;
    await safeQuery(
      `INSERT INTO market.broker_symbol_mappings (asset_id, asset, broker, platform, broker_symbol, is_active, verification_status)
       SELECT $1,$2,'MT5','MetaTrader 5',$2,true,'Verified'
       WHERE NOT EXISTS (
         SELECT 1 FROM market.broker_symbol_mappings WHERE asset_id = $1 AND broker_symbol = $2 AND is_active = true
       )`,
      [assetId, asset]
    );
    const mapped = await safeQuery(
      `UPDATE market.asset_universe SET broker_symbol = $2, scanner_enabled = true, active = true, updated_at = now() WHERE id = $1`,
      [assetId, asset]
    );
    if (mapped.rowCount) mappings += 1;
  }
  await safeQuery(`UPDATE market.asset_universe SET scanner_enabled = true, active = true WHERE active = true OR lower(status) = 'active'`);
  return mappings;
}

export async function syncAssetScanResultsFromTicks(actor = "scanner-pipeline-sync") {
  const { rows } = await safeQuery(`
    SELECT DISTINCT ON (symbol)
      symbol AS asset,
      ((bid + ask) / 2.0) AS last_price,
      spread,
      observed_at
    FROM market.market_data_ticks
    ORDER BY symbol, observed_at DESC
  `);
  if (!rows.length) return 0;
  const runKey = `SCAN-${Date.now()}`;
  let inserted = 0;
  await withTransaction(async (client) => {
    const run = await client.query(
      `INSERT INTO market.asset_scan_runs (run_key, status, completed_at, assets_requested, assets_scanned, triggered_by, readiness_status)
       VALUES ($1,'Completed',now(),$2,$2,$3,'Ready') RETURNING id`,
      [runKey, rows.length, actor]
    );
    const runId = run.rows[0].id;
    for (const row of rows) {
      const assetRow = await client.query(
        `SELECT id FROM market.asset_universe WHERE asset = $1 OR asset_code = $1 LIMIT 1`,
        [row.asset]
      );
      await client.query(
        `INSERT INTO market.asset_scan_results (run_id, asset_id, asset, asset_class, broker_symbol, status, last_price, spread, qualification, last_scanned, payload)
         VALUES ($1,$2,$3,'Forex',$3,'Scanned',$4,$5,'Watchlist',$6,$7::jsonb)`,
        [runId, assetRow.rows[0]?.id || null, row.asset, row.last_price, row.spread, row.observed_at, JSON.stringify({ source: "market_data_ticks" })]
      );
      inserted += 1;
    }
  });
  return inserted;
}

export async function syncHistoricalMarketDataFromTicks(actor = "scanner-pipeline-sync") {
  const { rows } = await safeQuery(`
    SELECT symbol AS instrument,
           date_trunc('hour', observed_at) AS bucket,
           avg((bid + ask) / 2.0) AS close_price,
           min((bid + ask) / 2.0) AS low_price,
           max((bid + ask) / 2.0) AS high_price,
           count(*)::int AS samples
    FROM market.market_data_ticks
    GROUP BY symbol, date_trunc('hour', observed_at)
    HAVING count(*) >= 1
    ORDER BY bucket DESC
    LIMIT 5000
  `);
  let inserted = 0;
  for (const row of rows) {
    const close = Number(row.close_price || 0);
    const high = Number(row.high_price || close);
    const low = Number(row.low_price || close);
    const change = high - low;
    const bucket = new Date(row.bucket);
    const result = await safeQuery(
      `INSERT INTO market.historical_market_data
       (instrument, asset_class, timeframe, price_date, price_time, open_price, high_price, low_price, close_price, volume, change_value, change_percent, price_range, volatility, trend_bias, source)
       VALUES ($1,'Forex','H1',$2::date,$3::time,$4,$5,$6,$4,$7,$8,$9,$10,$11,'Neutral',$12)
       ON CONFLICT (instrument, timeframe, price_date, price_time, source) DO NOTHING`,
      [
        row.instrument,
        bucket.toISOString().slice(0, 10),
        bucket.toISOString().slice(11, 19),
        close,
        high,
        low,
        row.samples,
        change,
        close ? (change / close) * 100 : 0,
        Math.abs(change),
        Math.abs(change),
        actor
      ]
    );
    inserted += result.rowCount || 0;
  }
  return inserted;
}

export async function syncEconomicEventsFromCalendarStore(actor = "scanner-pipeline-sync") {
  const events = readCalendarEvents();
  if (!events.length) return 0;
  const source = await safeQuery(
    `INSERT INTO market.economic_calendar_sources (source_key, name, status, config)
     VALUES ('economic-calendar-intelligence','Economic Calendar Intelligence','ONLINE',$1::jsonb)
     ON CONFLICT (source_key) DO UPDATE SET status = 'ONLINE', config = EXCLUDED.config
     RETURNING id`,
    [JSON.stringify({ store: "economic-calendar-intelligence.json" })]
  );
  const sourceId = source.rows[0]?.id;
  if (!sourceId) return 0;
  let inserted = 0;
  for (const event of events.slice(0, 500)) {
    const result = await safeQuery(
      `INSERT INTO market.economic_events (source_id, currency, event_name, impact, scheduled_at, status)
       SELECT $1,$2,$3,$4,$5,$6
       WHERE NOT EXISTS (
         SELECT 1 FROM market.economic_events
         WHERE currency = $2 AND event_name = $3 AND scheduled_at = $5
       )`,
      [
        sourceId,
        event.currency || "USD",
        event.event || event.eventName || "Economic Event",
        event.importance || "MEDIUM",
        event.scheduledAt || new Date().toISOString(),
        event.status || "SCHEDULED"
      ]
    );
    inserted += result.rowCount || 0;
  }
  return inserted;
}

export async function ensureMinimalPropRules(actor = "scanner-pipeline-sync") {
  const existing = await scalar("SELECT COUNT(*)::int AS value FROM market.prop_firm_rules");
  if (existing > 0) return existing;
  const firmId = randomUUID();
  const ruleId = randomUUID();
  await safeQuery(
    `INSERT INTO market.prop_firms (id, firm_name, country, website, status)
     VALUES ($1,'CACSMS Evaluation','United Kingdom','https://cacsms.io','Active')
     ON CONFLICT (firm_name) DO NOTHING`,
    [firmId]
  );
  const firm = await safeQuery(`SELECT id FROM market.prop_firms WHERE firm_name = 'CACSMS Evaluation' LIMIT 1`);
  const propFirmId = firm.rows[0]?.id;
  if (!propFirmId) return 0;
  await safeQuery(
    `INSERT INTO market.prop_firm_rules
     (id, prop_firm_id, account_size, account_type, phase, profit_target_percent, daily_loss_limit_percent, max_drawdown_percent, min_trading_days, max_trading_days, news_trading_allowed, weekend_holding_allowed, ea_allowed, copy_trading_allowed, payout_split_percent, payout_cycle, consistency_rule, leverage, status)
     VALUES ($1,$2,100000,'Evaluation','Phase 1',10,5,10,5,30,true,false,true,false,80,'Monthly','Standard consistency','1:100','Active')`,
    [ruleId, propFirmId]
  );
  await safeQuery(
    `INSERT INTO market.prop_firm_account_rules (id, prop_firm_rule_id, rule_category, rule_name, rule_value, enforcement)
     VALUES ($1,$2,'Risk','Daily Loss Limit','5%','Hard')`,
    [randomUUID(), ruleId]
  );
  return 1;
}

async function createCompletedRun(client, table, prefix, actor, assetsScanned, health = "Healthy") {
  const runKey = `${prefix}-${Date.now()}`;
  const { rows } = await client.query(
    `INSERT INTO ${table} (run_key, status, completed_at, assets_scanned, triggered_by, health)
     VALUES ($1,'Completed',now(),$2,$3,$4) RETURNING id`,
    [runKey, assetsScanned, actor, health]
  );
  return rows[0].id;
}

async function assetIdFor(client, asset) {
  const { rows } = await client.query(`SELECT id FROM market.asset_universe WHERE asset = $1 OR asset_code = $1 LIMIT 1`, [asset]);
  return rows[0]?.id || null;
}

async function persistTrendScores(client, runId, rows, actor) {
  for (const row of rows) {
    await client.query(
      `INSERT INTO market.asset_trend_scores
       (run_id, asset_id, asset, asset_class, overall_trend, trend_score, trend_alignment, continuation_probability, exhaustion_probability, breakout_probability, breakdown_probability, confidence, opportunity_impact, qualification, last_scanned, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)`,
      [
        runId,
        await assetIdFor(client, row.asset),
        row.asset,
        row.assetClass || "Forex",
        row.overallTrend || "Insufficient Data",
        row.trendScore,
        row.trendAlignment,
        row.continuationProbability,
        row.exhaustionProbability || row.exhaustionRisk,
        row.breakoutProbability,
        row.breakdownProbability,
        row.confidence || row.trendConfidence,
        row.opportunityImpact,
        row.qualification || "Watchlist",
        row.lastScanned || new Date().toISOString(),
        JSON.stringify({ source: "scanner-pipeline-sync", actor })
      ]
    );
  }
  await client.query(
    `INSERT INTO market.trend_scanner_audit_logs (run_id, user_name, action, after_value) VALUES ($1,$2,'pipeline_sync',$3::jsonb)`,
    [runId, actor, JSON.stringify({ rows: rows.length })]
  );
}

async function persistMomentumScores(client, runId, rows, actor) {
  for (const row of rows) {
    await client.query(
      `INSERT INTO market.asset_momentum_scores
       (run_id, asset_id, asset, asset_class, overall_momentum, momentum_score, momentum_direction, acceleration_score, deceleration_score, alignment_score, divergence_score, exhaustion_risk, confidence, opportunity_impact, qualification, last_scanned, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)`,
      [
        runId,
        await assetIdFor(client, row.asset),
        row.asset,
        row.assetClass || "Forex",
        row.overallMomentum || "Neutral",
        row.momentumScore,
        row.momentumDirection,
        row.accelerationScore,
        row.decelerationScore,
        row.alignmentScore,
        row.divergenceScore,
        row.exhaustionRisk,
        row.confidence,
        row.opportunityImpact,
        row.qualification || "Watchlist",
        row.lastScanned || new Date().toISOString(),
        JSON.stringify({ source: "scanner-pipeline-sync", actor })
      ]
    );
  }
  await client.query(
    `INSERT INTO market.momentum_scanner_audit_logs (run_id, user_name, action, after_value) VALUES ($1,$2,'pipeline_sync',$3::jsonb)`,
    [runId, actor, JSON.stringify({ rows: rows.length })]
  );
}

async function writeAuditLog(client, auditTable, runId, actor, rows) {
  if (!auditTable) return;
  try {
    await client.query(
      `INSERT INTO ${auditTable} (run_id, user_name, action, after_value) VALUES ($1,$2,'pipeline_sync',$3::jsonb)`,
      [runId, actor, JSON.stringify({ rows: rows.length })]
    );
  } catch {
    try {
      await client.query(
        `INSERT INTO ${auditTable} (user_name, action, payload) VALUES ($1,'pipeline_sync',$2::jsonb)`,
        [actor, JSON.stringify({ rows: rows.length, runId })]
      );
    } catch {
      await client.query(
        `INSERT INTO ${auditTable} (user_name, action, after_value) VALUES ($1,'pipeline_sync',$2::jsonb)`,
        [actor, JSON.stringify({ rows: rows.length, runId })]
      );
    }
  }
}

async function persistGenericScores(client, table, auditTable, runId, rows, actor, mapRow) {
  let inserted = 0;
  for (const row of rows) {
    try {
      const mapped = mapRow(row);
      const columns = Object.keys(mapped);
      const values = Object.values(mapped);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(",");
      await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`, values);
      inserted += 1;
    } catch (error) {
      console.warn(`[scanner-pipeline-sync] skipped ${table} row for ${row.asset}:`, error.message);
    }
  }
  if (inserted > 0) await writeAuditLog(client, auditTable, runId, actor, rows);
  return inserted;
}

async function persistModuleSafely(name, fn) {
  try {
    const value = await fn();
    return { name, ok: true, ...value };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}

export async function persistScannerModuleOutputs(actor = "scanner-pipeline-sync") {
  const outputs = [];
  outputs.push(await persistModuleSafely("trend", async () => {
    const trend = await getTrendScannerEngine();
    const trendRows = trend.rankings?.length ? trend.rankings : trend.matrix || [];
    if (!trendRows.length) return { rows: 0 };
    await withTransaction(async (client) => {
      const runId = await createCompletedRun(client, "market.trend_scanner_runs", "TRD", actor, trendRows.length, trend.summary?.trendScannerHealth || "Healthy");
      await persistTrendScores(client, runId, trendRows, actor);
    });
    return { rows: trendRows.length };
  }));

  outputs.push(await persistModuleSafely("momentum", async () => {
    const momentum = await getMomentumScannerEngine();
    const momentumRows = momentum.rankings?.length ? momentum.rankings : momentum.scores || [];
    if (!momentumRows.length) return { rows: 0 };
    await withTransaction(async (client) => {
      const runId = await createCompletedRun(client, "market.momentum_scanner_runs", "MOM", actor, momentumRows.length, momentum.summary?.momentumScannerHealth || "Healthy");
      await persistMomentumScores(client, runId, momentumRows, actor);
    });
    return { rows: momentumRows.length };
  }));

  const modules = [
    [getMarketStructureScannerEngine, "market.market_structure_scanner_runs", "market.asset_market_structure_scores", "market.market_structure_audit_logs", "STR", row => ({
      run_id: null, asset: row.asset, asset_class: row.assetClass || "Forex", overall_structure: row.structureState || row.overallStructure || "Range",
      structure_score: row.structureScore ?? row.marketStructureScore, confidence: row.confidence, qualification: row.qualification || "Watchlist",
      last_scanned: row.lastScanned || new Date().toISOString(), payload: JSON.stringify({ source: "scanner-pipeline-sync" })
    })],
    [getVolatilityScannerEngine, "market.volatility_scanner_runs", "market.asset_volatility_scores", "market.volatility_scanner_audit_logs", "VOL", row => ({
      run_id: null, asset: row.asset, asset_class: row.assetClass || "Forex", overall_volatility: row.volatilityState || row.overallVolatility || "Normal",
      volatility_score: row.volatilityScore, confidence: row.confidence, qualification: row.qualification || "Watchlist",
      last_scanned: row.lastScanned || new Date().toISOString(), payload: JSON.stringify({ source: "scanner-pipeline-sync" })
    })],
    [getLiquidityScannerEngine, "market.liquidity_scanner_runs", "market.asset_liquidity_scores", "market.liquidity_scanner_audit_logs", "LIQ", row => ({
      run_id: null, asset: row.asset, asset_class: row.assetClass || "Forex", liquidity_bias: row.liquidityBias || "Neutral",
      liquidity_score: row.liquidityScore, confidence: row.confidence, qualification: row.qualification || "Watchlist",
      last_scanned: row.lastScanned || new Date().toISOString(), payload: JSON.stringify({ source: "scanner-pipeline-sync" })
    })],
    [getInstitutionalScannerEngine, "market.institutional_scanner_runs", "market.asset_institutional_scores", "market.institutional_scanner_audit_logs", "INS", row => ({
      run_id: null, asset: row.asset, asset_class: row.assetClass || "Forex", institutional_bias: row.institutionalBias || "Neutral",
      institutional_score: row.institutionalScore, confidence: row.confidence, qualification: row.qualification || "Watchlist",
      last_scanned: row.lastScanned || new Date().toISOString(), payload: JSON.stringify({ source: "scanner-pipeline-sync" })
    })],
    [getSentimentScannerEngine, "market.sentiment_scanner_runs", "market.asset_sentiment_scores", "market.sentiment_scanner_audit_logs", "SEN", row => ({
      run_id: null, asset: row.asset, asset_class: row.assetClass || "Forex", unified_sentiment: row.unifiedSentiment || row.overallSentiment || "Neutral",
      sentiment_score: row.sentimentScore ?? 0, confidence: row.confidence ?? 50, qualification: row.qualification || "Watchlist",
      last_scanned: row.lastScanned || new Date().toISOString(), payload: JSON.stringify({ source: "scanner-pipeline-sync" })
    })],
    [getMacroScannerEngine, "market.macro_scanner_runs", "market.asset_macro_scores", "market.macro_scanner_audit_logs", "MAC", row => ({
      run_id: null, asset: row.asset, asset_class: row.assetClass || "Forex", macro_bias: row.macroBias || "Neutral",
      macro_score: row.macroScore, confidence: row.confidence, qualification: row.qualification || "Watchlist",
      last_scanned: row.lastScanned || new Date().toISOString(), payload: JSON.stringify({ source: "scanner-pipeline-sync" })
    })],
    [getEconomicEventsScannerEngine, "market.economic_events_scanner_runs", "market.asset_event_scores", "market.economic_events_scanner_audit_logs", "EVT", row => ({
      run_id: null, asset: row.asset, asset_class: row.assetClass || "Forex", event_score: row.eventRiskScore,
      confidence: row.confidence, recommendation: row.recommendation || row.qualification || "Monitor",
      last_scanned: row.lastScanned || new Date().toISOString(), payload: JSON.stringify({ source: "scanner-pipeline-sync" })
    })]
  ];

  for (const [getEngine, runTable, scoreTable, auditTable, prefix, mapRow] of modules) {
    outputs.push(await persistModuleSafely(prefix, async () => {
      const data = await getEngine();
      const rows = data.rankings?.length ? data.rankings : data.scores || [];
      if (!rows.length) return { rows: 0 };
      await withTransaction(async (client) => {
        const runId = await createCompletedRun(client, runTable, prefix, actor, rows.length);
        await persistGenericScores(client, scoreTable, auditTable, runId, rows, actor, row => ({ ...mapRow(row), run_id: runId }));
      });
      return { rows: rows.length };
    }));
  }

  outputs.push(await persistModuleSafely("risk", async () => {
    const risk = await getRiskScannerEngine();
    const riskRows = risk.rankings?.length ? risk.rankings : risk.scores || [];
    if (!riskRows.length) return { rows: 0 };
    await withTransaction(async (client) => {
      const runId = await createCompletedRun(client, "market.risk_scanner_runs", "RSK", actor, riskRows.length, risk.summary?.riskScannerHealth || "Healthy");
      for (const row of riskRows) {
        await client.query(
          `INSERT INTO market.asset_risk_scores
           (run_id, asset_id, asset, asset_class, overall_risk, confidence, qualification, main_risk_driver, last_scanned, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [
            runId,
            await assetIdFor(client, row.asset),
            row.asset,
            row.assetClass || "Forex",
            Number(row.riskScore ?? row.overallRisk) || 50,
            row.riskConfidence ?? row.confidence,
            row.qualification || "Watchlist",
            row.mainRiskDriver || "Market Risk",
            row.lastScanned || new Date().toISOString(),
            JSON.stringify({ source: "scanner-pipeline-sync", actor })
          ]
        );
      }
      await writeAuditLog(client, "market.risk_scanner_audit_logs", runId, actor, riskRows);
    });
    return { rows: riskRows.length };
  }));

  outputs.push(await persistModuleSafely("compliance", async () => {
    const compliance = await getPropComplianceScannerEngine();
    const complianceRows = compliance.rankings?.length ? compliance.rankings : compliance.scores || [];
    if (!complianceRows.length) return { rows: 0 };
    await withTransaction(async (client) => {
      const runId = await createCompletedRun(client, "market.prop_compliance_scanner_runs", "CMP", actor, complianceRows.length, compliance.summary?.complianceScannerHealth || "Healthy");
      for (const row of complianceRows) {
        await client.query(
          `INSERT INTO market.asset_prop_compliance_scores
           (run_id, asset_id, asset, asset_class, compliance_score, trade_eligibility, primary_constraint, confidence, last_scanned, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [
            runId,
            await assetIdFor(client, row.asset),
            row.asset,
            row.assetClass || "Forex",
            row.complianceScore,
            row.tradeEligibility || row.qualification || "Review",
            row.primaryConstraint || row.mainConstraint || "Prop Rules",
            row.confidence,
            row.lastScanned || new Date().toISOString(),
            JSON.stringify({ source: "scanner-pipeline-sync", actor })
          ]
        );
      }
      await writeAuditLog(client, "market.prop_compliance_scanner_audit_logs", runId, actor, complianceRows);
    });
    return { rows: complianceRows.length };
  }));

  outputs.push(await persistModuleSafely("currency", async () => {
    const currency = await getCurrencyStrengthEngine();
    const currencyRows = currency.rankings?.length ? currency.rankings : currency.scores || [];
    if (!currencyRows.length) return { rows: 0 };
    for (const row of currencyRows) {
      await safeQuery(
        `INSERT INTO market.currency_strength_scores (currency, current_strength, confidence, calculated_at, payload)
         VALUES ($1,$2,$3,now(),$4::jsonb)`,
        [row.currency || row.asset, row.strengthScore ?? row.score ?? row.currentStrength, row.confidence, JSON.stringify({ source: "scanner-pipeline-sync", actor })]
      );
    }
    await safeQuery(
      `INSERT INTO market.currency_strength_audit_logs (user_name, action, after_value) VALUES ($1,'pipeline_sync',$2::jsonb)`,
      [actor, JSON.stringify({ rows: currencyRows.length })]
    );
    return { rows: currencyRows.length };
  }));

  return outputs;
}

export async function persistOpportunityRankings(actor = "scanner-pipeline-sync") {
  const { getOpportunityRankingEngine } = await import("./opportunity-ranking-engine.js");
  const data = await getOpportunityRankingEngine();
  const rows = data.rankings || [];
  if (!rows.length) return { inserted: 0 };
  let inserted = 0;
  await withTransaction(async (client) => {
    const runKey = `OPP-${Date.now()}`;
    const run = await client.query(
      `INSERT INTO market.asset_opportunity_ranking_runs (run_key, status, completed_at, assets_ranked, health, triggered_by, payload)
       VALUES ($1,'Completed',now(),$2,$3,$4,$5::jsonb) RETURNING id`,
      [runKey, rows.length, data.summary?.rankingEngineHealth || "Healthy", actor, JSON.stringify({ source: "scanner-pipeline-sync" })]
    );
    const runId = run.rows[0].id;
    const scanRun = await client.query(`SELECT id FROM market.asset_scan_runs ORDER BY started_at DESC LIMIT 1`);
    const scanRunId = scanRun.rows[0]?.id || null;
    for (const row of rows) {
      const assetId = await assetIdFor(client, row.asset);
      await client.query(
        `INSERT INTO market.asset_opportunity_rankings
         (run_id, rank, asset_id, asset, asset_class, direction, opportunity_score, confidence_score, risk_score, compliance_score, trend_score, structure_score, momentum_score, volatility_score, liquidity_score, institutional_score, sentiment_score, macro_score, event_score, main_reason, qualification, payload, last_ranked)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,now())`,
        [
          runId, row.rank, assetId, row.asset, row.assetClass || "Forex", row.direction,
          row.opportunityScore, row.confidenceScore, row.riskScore, row.complianceScore,
          row.trendScore, row.structureScore, row.momentumScore, row.volatilityScore, row.liquidityScore,
          row.institutionalScore, row.sentimentScore, row.macroScore, row.eventScore,
          row.mainReason, row.qualification || "Insufficient Data", JSON.stringify({ source: "scanner-pipeline-sync" })
        ]
      );
      await client.query(
        `INSERT INTO market.asset_opportunity_scores
         (run_id, asset, direction, trend_score, momentum_score, volatility_score, liquidity_score, institutional_score, sentiment_score, macro_score, risk_score, compliance_score, confidence_score, opportunity_score, main_reason, payload, calculated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,now())`,
        [
          scanRunId, row.asset, row.direction, row.trendScore, row.momentumScore, row.volatilityScore,
          row.liquidityScore, row.institutionalScore, row.sentimentScore, row.macroScore,
          row.riskScore, row.complianceScore, row.confidenceScore, row.opportunityScore,
          row.mainReason || row.qualification || "Insufficient Data",
          JSON.stringify({ source: "scanner-pipeline-sync", assetClass: row.assetClass, qualification: row.qualification })
        ]
      );
      inserted += 1;
    }
    await client.query(
      `INSERT INTO market.asset_opportunity_audit_logs (user_name, action, entity_type, reason, payload)
       VALUES ($1,'pipeline_sync','opportunity_ranking',$2,$3::jsonb)`,
      [actor, "Persisted live opportunity rankings", JSON.stringify({ rows: inserted })]
    );
  });
  return { inserted, assetsRanked: rows.length, status: data.status };
}

async function runStep(name, fn) {
  try {
    return { name, ok: true, value: await fn() };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}

export async function bootstrapScannerPipeline({ actor = "scanner-pipeline-sync" } = {}) {
  if (!isDatabaseConfigured()) {
    const error = new Error("database_not_configured");
    error.status = 503;
    throw error;
  }
  const steps = await Promise.all([
    runStep("brokerMappings", () => syncBrokerMappingsFromMarketData(actor)),
    runStep("scanResults", () => syncAssetScanResultsFromTicks(actor)),
    runStep("historicalRows", () => syncHistoricalMarketDataFromTicks(actor)),
    runStep("economicEvents", () => syncEconomicEventsFromCalendarStore(actor)),
    runStep("propRules", () => ensureMinimalPropRules(actor)),
    runStep("moduleOutputs", () => persistScannerModuleOutputs(actor)),
    runStep("opportunityRankings", () => persistOpportunityRankings(actor))
  ]);
  const failed = steps.filter(step => !step.ok);
  if (failed.length === steps.length) {
    const error = new Error(failed[0]?.error || "scanner_pipeline_bootstrap_failed");
    error.status = 500;
    throw error;
  }
  return {
    status: failed.length ? "Partial" : "Completed",
    steps,
    failed: failed.map(step => ({ name: step.name, error: step.error }))
  };
}
