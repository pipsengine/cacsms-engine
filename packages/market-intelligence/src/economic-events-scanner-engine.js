import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDatabaseConfigured, query, withTransaction } from "./db.js";
import { getEconomicEvent, syncEconomicCalendar } from "./economic-calendar-intelligence.js";
import { syncAssetUniverseFromLiveSources } from "./universe-live-source-adapter.js";

const STORE_PATH = fileURLToPath(new URL("../../../apps/web/public/data/economic-calendar-intelligence.json", import.meta.url));

export const ECONOMIC_EVENTS_SCANNER_TABLES = Object.freeze([
  "market.asset_event_scores",
  "market.asset_event_exposures",
  "market.asset_event_risk_rankings",
  "market.asset_event_opportunities",
  "market.asset_event_blocks",
  "market.asset_event_prop_restrictions",
  "market.asset_event_volatility_liquidity_risks",
  "market.economic_events_scanner_weights",
  "market.economic_events_scanner_runs",
  "market.economic_events_scanner_ai_summaries",
  "market.economic_events_scanner_alerts",
  "market.economic_events_scanner_audit_logs"
]);

const permissions = () => ({
  view: "universe_scanner.economic_events.view",
  runScan: "universe_scanner.economic_events.run_scan",
  recalculate: "universe_scanner.economic_events.recalculate",
  configureRules: "universe_scanner.economic_events.configure_rules",
  createAlert: "universe_scanner.economic_events.create_alert",
  export: "universe_scanner.economic_events.export"
});

const round = value => value === null || value === undefined || Number.isNaN(Number(value)) ? null : Math.round(Number(value));
const avg = values => {
  const valid = values.filter(value => value !== null && value !== undefined && !Number.isNaN(Number(value))).map(Number);
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
};

async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    if (["42P01", "42703", "42883"].includes(error.code)) return { rows: [] };
    throw error;
  }
}

async function tableReadiness() {
  const { rows } = await query("SELECT table_name, to_regclass(table_name) IS NOT NULL AS exists FROM unnest($1::text[]) AS table_name", [ECONOMIC_EVENTS_SCANNER_TABLES]);
  return { ready: rows.every(row => row.exists), missing: rows.filter(row => !row.exists).map(row => row.table_name) };
}

function emptyState(status, message, missingTables = []) {
  return {
    engine: "EconomicEventsScannerEngine",
    sourceMode: "LIVE_CALENDAR_INPUTS_ONLY",
    mockDataDisabled: true,
    status,
    message,
    schemaReady: status !== "SCHEMA_NOT_READY",
    missingTables,
    permissions: permissions(),
    badges: { productionLive: true, mockDataDisabled: true, liveCalendarInputsOnly: true, lastEventScan: null, eventScannerHealth: "Insufficient Data" },
    summary: {
      eventsToday: 0,
      upcomingHighImpactEvents: 0,
      extremeImpactEvents: 0,
      assetsExposed: 0,
      assetsBlockedByNewsRisk: 0,
      propRestrictedEvents: 0,
      deviationAlerts: 0,
      volatilityRiskEvents: 0,
      liquidityRiskEvents: 0,
      eventQualifiedAssets: 0,
      averageEventRiskScore: null,
      averageEventConfidence: null,
      scannerHealth: "Insufficient Data"
    },
    exposureMatrix: [],
    rankings: [],
    upcoming: [],
    deviations: [],
    opportunities: [],
    blocked: [],
    propRestrictions: [],
    volatilityLiquidity: [],
    heatmap: [],
    weights: [],
    aiSummary: null,
    alerts: [],
    audit: [],
    emptyState: {
      title: "Economic events scanner cannot calculate event exposure yet.",
      message: "Connect economic calendar sources, sync live events, register active assets, and run an event scan before viewing event risk and opportunity results.",
      actions: ["Open Economic Calendar", "Sync Economic Events", "Open Source Registry", "Run Event Scan"]
    }
  };
}

function normalize(value) {
  return String(value || "").toUpperCase().replaceAll("/", "").replaceAll("-", "").replaceAll("_", "").replace(/\s+/g, "");
}

function readCalendarEvents() {
  if (!existsSync(STORE_PATH)) return [];
  try {
    const store = JSON.parse(readFileSync(STORE_PATH, "utf8").replace(/^\uFEFF/, ""));
    return (store.events || []).map(event => ({
      ...event,
      status: event.status || (event.actual ? "RELEASED" : new Date(event.scheduledAt).getTime() >= Date.now() ? "UPCOMING" : "COMPLETED")
    }));
  } catch {
    return [];
  }
}

function classifyAsset(symbol) {
  const value = normalize(symbol);
  if (value.includes("XAU")) return "Metals";
  if (value.includes("OIL")) return "Commodities";
  if (value.includes("BTC") || value.includes("ETH")) return "Crypto";
  if (/NAS|SPX|US30|GER|DAX|DJ|USTEC|US500/.test(value)) return "Indices";
  return "Forex";
}

async function activeAssets() {
  await syncAssetUniverseFromLiveSources();
  const { rows } = await safeQuery(`
    SELECT id, COALESCE(asset_code, asset, broker_symbol) AS asset, asset_class AS "assetClass",
      base_asset AS "baseAsset", quote_asset AS "quoteAsset", updated_at AS "updatedAt"
    FROM market.asset_universe
    WHERE active AND scanner_enabled
    ORDER BY asset
  `);
  return rows.map(row => ({ ...row, assetClass: row.assetClass || classifyAsset(row.asset) }));
}

function eventTimeText(event) {
  const delta = new Date(event.scheduledAt).getTime() - Date.now();
  const abs = Math.abs(delta);
  const hours = Math.round(abs / 36e5);
  if (delta >= 0) return hours < 1 ? "Within 1 hour" : `${hours}h`;
  return hours < 1 ? "Released recently" : `${hours}h ago`;
}

function isToday(value) {
  const date = new Date(value);
  const now = new Date();
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth() && date.getUTCDate() === now.getUTCDate();
}

function riskWindow(event) {
  const before = Number(event.propFirmRestriction?.beforeMinutes || (["HIGH", "EXTREME"].includes(event.importance) ? 30 : 10));
  const after = Number(event.propFirmRestriction?.afterMinutes || (["HIGH", "EXTREME"].includes(event.importance) ? 30 : 10));
  return `${before}m before / ${after}m after`;
}

function recommendation(event, riskScore) {
  if (event.propFirmRestriction?.restricted) return "Blocked by Prop Rule";
  if (riskScore >= 81) return "Avoid During Event";
  if (riskScore >= 61) return "Avoid Before Event";
  if (riskScore >= 41) return "Trade With Caution";
  return "Trade Allowed";
}

function impactRisk(event) {
  if (event.riskScore != null) return round(event.riskScore);
  if (event.importance === "EXTREME") return 95;
  if (event.importance === "HIGH") return 80;
  if (event.importance === "MEDIUM") return 55;
  return 25;
}

function eventAffectsAsset(event, asset) {
  const eventAssets = (event.affectedAssets || []).map(normalize);
  const symbol = normalize(asset.asset);
  if (eventAssets.includes(symbol)) return true;
  if (event.currency && symbol.includes(String(event.currency).toUpperCase())) return true;
  return false;
}

function exposedEvents(events, asset) {
  return events.filter(event => eventAffectsAsset(event, asset)).sort((a, b) => {
    const now = Date.now();
    const da = Math.abs(new Date(a.scheduledAt).getTime() - now);
    const db = Math.abs(new Date(b.scheduledAt).getTime() - now);
    return da - db;
  });
}

function confidenceFor(event) {
  const source = event.provider ? 20 : 0;
  const impact = event.importance ? 25 : 0;
  const time = event.scheduledAt ? 25 : 0;
  const assets = event.affectedAssets?.length ? 20 : 0;
  const values = event.actual || event.forecast || event.previous ? 10 : 0;
  return source + impact + time + assets + values;
}

function buildExposureRows(assets, events) {
  return assets.map(asset => {
    const event = exposedEvents(events, asset)[0];
    if (!event) {
      return {
        assetId: asset.id,
        asset: asset.asset,
        assetClass: asset.assetClass,
        nextEventId: null,
        nextEvent: "No Data",
        currency: "No Data",
        country: "No Data",
        impact: "No Data",
        timeToEvent: "No Data",
        riskWindow: "No Data",
        affectedDirection: "Insufficient Data",
        volatilityRisk: "No Data",
        liquidityRisk: "No Data",
        propRestriction: "No Data",
        eventScore: null,
        confidence: null,
        recommendation: "Insufficient Data",
        lastUpdated: asset.updatedAt
      };
    }
    const riskScore = impactRisk(event);
    return {
      assetId: asset.id,
      asset: asset.asset,
      assetClass: asset.assetClass,
      nextEventId: event.id,
      nextEvent: event.event,
      currency: event.currency,
      country: event.country,
      impact: event.importance,
      timeToEvent: eventTimeText(event),
      riskWindow: riskWindow(event),
      affectedDirection: event.sentimentImpact || "Pending release",
      volatilityRisk: event.expectedVolatility || (riskScore >= 61 ? "HIGH" : "LOW"),
      liquidityRisk: riskScore >= 81 ? "Extreme" : riskScore >= 61 ? "High" : riskScore >= 41 ? "Elevated" : "Low",
      propRestriction: event.propFirmRestriction?.restricted ? event.propFirmRestriction.action : "No restriction",
      eventScore: riskScore,
      confidence: confidenceFor(event),
      recommendation: recommendation(event, riskScore),
      lastUpdated: event.updatedAt || event.scheduledAt,
      event
    };
  });
}

function rankRows(rows) {
  return rows.slice().sort((a, b) => Number(b.eventScore || -1) - Number(a.eventScore || -1)).map((row, index) => ({
    rank: index + 1,
    assetId: row.assetId,
    asset: row.asset,
    assetClass: row.assetClass,
    nextEventId: row.nextEventId,
    nextEvent: row.nextEvent,
    currency: row.currency,
    impact: row.impact,
    timeToEvent: row.timeToEvent,
    eventRiskScore: row.eventScore,
    volatilityRisk: row.volatilityRisk,
    liquidityRisk: row.liquidityRisk,
    propRestriction: row.propRestriction,
    opportunityScore: row.recommendation === "Trade Allowed" || row.recommendation === "Trade With Caution" ? Math.max(0, 100 - Number(row.eventScore || 100)) : 0,
    recommendation: row.recommendation === "Trade Allowed" ? "Watchlist" : row.recommendation === "Trade With Caution" ? "Trade With Caution" : row.recommendation === "Blocked by Prop Rule" ? "Blocked" : "Avoid Trading",
    confidence: row.confidence,
    lastScanned: row.lastUpdated
  }));
}

function upcomingRows(events, exposureRows) {
  return events.filter(event => new Date(event.scheduledAt).getTime() >= Date.now() && ["HIGH", "EXTREME"].includes(event.importance)).map(event => ({
    eventId: event.id,
    eventTime: event.scheduledAt,
    country: event.country,
    currency: event.currency,
    eventName: event.event,
    category: event.category,
    previous: event.previous,
    forecast: event.forecast,
    actual: event.actual,
    impact: event.importance,
    affectedAssets: exposureRows.filter(row => row.nextEventId === event.id).map(row => row.asset).join(", "),
    riskWindow: riskWindow(event),
    tradingRecommendation: recommendation(event, impactRisk(event))
  }));
}

function deviationRows(events, exposureRows) {
  return events.filter(event => event.actual || event.deviation !== null && event.deviation !== undefined).map(event => ({
    eventId: event.id,
    releasedAt: event.releasedAt || event.actualUpdatedAt || event.scheduledAt,
    event: event.event,
    currency: event.currency,
    actual: event.actual,
    forecast: event.forecast,
    previous: event.previous,
    deviation: event.deviation,
    surpriseDirection: event.deviation == null ? "No Data" : Number(event.deviation) > 0 ? "Positive Surprise" : Number(event.deviation) < 0 ? "Negative Surprise" : "Neutral",
    sentimentImpact: event.sentimentImpact,
    affectedAssets: exposureRows.filter(row => row.nextEventId === event.id).map(row => row.asset).join(", "),
    observedVolatility: event.expectedVolatility,
    observedPriceReaction: event.aiAnalysis?.tradingConsiderations || "No Data"
  }));
}

function opportunityRows(rankings) {
  return rankings.filter(row => row.opportunityScore >= 21 && !["Blocked", "Avoid Trading"].includes(row.recommendation)).map(row => ({
    asset: row.asset,
    eventId: row.nextEventId,
    event: row.nextEvent,
    currency: row.currency,
    eventDirection: row.impact,
    macroAlignment: "Use Macro Scanner",
    sentimentAlignment: "Use Sentiment Scanner",
    trendAlignment: "Use Trend Scanner",
    liquidityCondition: row.liquidityRisk,
    opportunityScore: row.opportunityScore,
    confidence: row.confidence,
    recommendedAction: row.opportunityScore >= 61 ? "Send to Opportunity Ranking" : "Create Alert"
  }));
}

function blockedRows(exposureRows) {
  return exposureRows.filter(row => ["Avoid Before Event", "Avoid During Event", "Blocked by Prop Rule"].includes(row.recommendation)).map(row => ({
    asset: row.asset,
    eventId: row.nextEventId,
    event: row.nextEvent,
    reason: row.recommendation === "Blocked by Prop Rule" ? "Prop Firm News Restriction" : row.eventScore >= 81 ? "Extreme Event" : "High Impact News",
    riskWindow: row.riskWindow,
    propFirmRule: row.propRestriction,
    volatilityRisk: row.volatilityRisk,
    liquidityRisk: row.liquidityRisk,
    severity: row.eventScore >= 81 ? "Critical" : row.eventScore >= 61 ? "High" : "Medium",
    recommendedAction: row.recommendation
  }));
}

function propRestrictionRows(events) {
  return events.filter(event => event.propFirmRestriction?.restricted).map(event => ({
    firm: "Connected Prop Firm",
    account: "Configured Account",
    eventId: event.id,
    event: event.event,
    currency: event.currency,
    restrictionWindow: riskWindow(event),
    ruleType: event.propFirmRestriction.action,
    accountStatus: "Review Required",
    complianceRisk: event.importance === "EXTREME" ? "Critical" : "High",
    actionRequired: "Avoid restricted news window"
  }));
}

function volatilityLiquidityRows(exposureRows) {
  return exposureRows.filter(row => row.nextEventId).map(row => ({
    eventId: row.nextEventId,
    event: row.nextEvent,
    asset: row.asset,
    historicalAvgMove: "No production historical event reaction record",
    expectedVolatility: row.volatilityRisk,
    spreadWideningRisk: row.liquidityRisk,
    slippageRisk: row.eventScore >= 61 ? "High" : "Low",
    liquidityDropRisk: row.liquidityRisk,
    tradeability: row.recommendation === "Blocked by Prop Rule" ? "Blocked" : /Avoid/.test(row.recommendation) ? "Avoid" : row.recommendation === "Trade With Caution" ? "Caution" : "Safe"
  }));
}

function heatmapRows(exposureRows) {
  return exposureRows.filter(row => row.nextEventId).flatMap(row => [
    { asset: row.asset, eventId: row.nextEventId, event: row.nextEvent, component: "Impact", state: row.impact, score: row.eventScore, confidence: row.confidence },
    { asset: row.asset, eventId: row.nextEventId, event: row.nextEvent, component: "Volatility", state: row.volatilityRisk, score: row.eventScore, confidence: row.confidence },
    { asset: row.asset, eventId: row.nextEventId, event: row.nextEvent, component: "Liquidity", state: row.liquidityRisk, score: row.eventScore, confidence: row.confidence },
    { asset: row.asset, eventId: row.nextEventId, event: row.nextEvent, component: "Restriction", state: row.propRestriction, score: row.eventScore, confidence: row.confidence },
    { asset: row.asset, eventId: row.nextEventId, event: row.nextEvent, component: "Recommendation", state: row.recommendation, score: row.eventScore, confidence: row.confidence }
  ]);
}

async function latestRun() {
  const { rows } = await safeQuery(`SELECT id, run_key AS "runKey", status, started_at AS "startedAt", completed_at AS "completedAt", duration_ms AS "durationMs", events_scanned AS "eventsScanned", assets_scanned AS "assetsScanned", health FROM market.economic_events_scanner_runs ORDER BY started_at DESC LIMIT 1`);
  return rows[0] || null;
}

async function weights() {
  const { rows } = await safeQuery(`SELECT component_key AS "componentKey", component_name AS "componentName", weight, enabled, updated_at AS "updatedAt" FROM market.economic_events_scanner_weights ORDER BY component_name`);
  return rows.map(row => ({ ...row, weight: round(row.weight) }));
}

async function alerts() {
  const { rows } = await safeQuery(`SELECT alert_type AS "alertType", title, severity, event_id AS "eventId", asset, status, created_by AS "createdBy", created_at AS "createdAt" FROM market.economic_events_scanner_alerts ORDER BY created_at DESC LIMIT 80`);
  return rows;
}

async function audit(eventId = null) {
  const { rows } = await safeQuery(`SELECT event_id AS "eventId", asset_id AS "assetId", user_name AS "userName", action, entity_type AS "entityType", entity_id AS "entityId", reason, created_at AS "createdAt" FROM market.economic_events_scanner_audit_logs ${eventId ? "WHERE event_id = $1" : ""} ORDER BY created_at DESC LIMIT 80`, eventId ? [eventId] : []);
  return rows;
}

async function persistedAiSummary() {
  const { rows } = await safeQuery(`SELECT most_important_upcoming_events AS "mostImportantUpcomingEvents", assets_most_exposed AS "assetsMostExposed", events_creating_opportunities AS "eventsCreatingOpportunities", events_requiring_avoidance AS "eventsRequiringAvoidance", prop_firm_restriction_risks AS "propFirmRestrictionRisks", likely_volatility_windows AS "likelyVolatilityWindows", macro_sentiment_alignment AS "macroSentimentAlignment", assets_to_monitor AS "assetsToMonitor", assets_to_avoid AS "assetsToAvoid", recommended_next_step AS "recommendedNextStep", summary, generated_at AS "generatedAt" FROM market.economic_events_scanner_ai_summaries ORDER BY generated_at DESC LIMIT 1`);
  return rows[0] || null;
}

function summary(events, exposureRows, rankings, blocked, propRestrictions, deviations, volatilityLiquidity) {
  return {
    eventsToday: events.filter(event => isToday(event.scheduledAt)).length,
    upcomingHighImpactEvents: events.filter(event => new Date(event.scheduledAt).getTime() >= Date.now() && event.importance === "HIGH").length,
    extremeImpactEvents: events.filter(event => event.importance === "EXTREME").length,
    assetsExposed: exposureRows.filter(row => row.nextEventId).length,
    assetsBlockedByNewsRisk: blocked.length,
    propRestrictedEvents: propRestrictions.length,
    deviationAlerts: deviations.length,
    volatilityRiskEvents: events.filter(event => ["HIGH", "EXTREME"].includes(event.importance) || event.expectedVolatility === "HIGH").length,
    liquidityRiskEvents: volatilityLiquidity.filter(row => ["High", "Extreme"].includes(row.liquidityDropRisk)).length,
    eventQualifiedAssets: rankings.filter(row => row.opportunityScore >= 41).length,
    averageEventRiskScore: avg(exposureRows.map(row => row.eventScore)),
    averageEventConfidence: avg(exposureRows.map(row => row.confidence)),
    scannerHealth: events.length && exposureRows.length ? "Healthy" : "Insufficient Data"
  };
}

function aiSummary(events, exposureRows, opportunities, blocked) {
  const upcoming = events.filter(event => new Date(event.scheduledAt).getTime() >= Date.now()).slice(0, 5).map(event => `${event.currency} ${event.event}`).join(", ") || "Insufficient Data";
  return {
    mostImportantUpcomingEvents: upcoming,
    assetsMostExposed: exposureRows.filter(row => row.nextEventId).slice(0, 8).map(row => row.asset).join(", ") || "Insufficient Data",
    eventsCreatingOpportunities: opportunities.slice(0, 8).map(row => `${row.asset}: ${row.event}`).join(", ") || "Insufficient Data",
    eventsRequiringAvoidance: blocked.slice(0, 8).map(row => `${row.asset}: ${row.reason}`).join(", ") || "Insufficient Data",
    propFirmRestrictionRisks: "See Prop Firm News Restriction panel.",
    likelyVolatilityWindows: events.filter(event => ["HIGH", "EXTREME"].includes(event.importance)).slice(0, 8).map(event => `${event.currency} ${event.event}`).join(", ") || "Insufficient Data",
    macroSentimentAlignment: "Confirm event direction against Macro and Sentiment scanners before ranking.",
    assetsToMonitor: opportunities.slice(0, 8).map(row => row.asset).join(", ") || "Insufficient Data",
    assetsToAvoid: blocked.slice(0, 8).map(row => row.asset).join(", ") || "Insufficient Data",
    recommendedNextStep: "Review high-impact windows before Opportunity Ranking and Qualified Trades.",
    summary: `${events.length} live economic calendar events evaluated across ${exposureRows.length} active universe assets.`
  };
}

async function liveOutput() {
  const [assets, run, weightRows, alertRows, auditRows, persistedAi] = await Promise.all([activeAssets(), latestRun(), weights(), alerts(), audit(), persistedAiSummary()]);
  const events = readCalendarEvents().filter(event => event?.id);
  if (!events.length || !assets.length) {
    return { ...emptyState("EMPTY", "Economic events scanner cannot calculate event exposure yet."), schemaReady: true, weights: weightRows, alerts: alertRows, audit: auditRows };
  }
  const exposureMatrix = buildExposureRows(assets, events);
  const rankings = rankRows(exposureMatrix);
  const upcoming = upcomingRows(events, exposureMatrix);
  const deviations = deviationRows(events, exposureMatrix);
  const opportunities = opportunityRows(rankings);
  const blocked = blockedRows(exposureMatrix);
  const propRestrictions = propRestrictionRows(events);
  const volatilityLiquidity = volatilityLiquidityRows(exposureMatrix);
  const heatmap = heatmapRows(exposureMatrix);
  const summaryRow = summary(events, exposureMatrix, rankings, blocked, propRestrictions, deviations, volatilityLiquidity);
  return {
    engine: "EconomicEventsScannerEngine",
    sourceMode: "LIVE_CALENDAR_INPUTS_ONLY",
    mockDataDisabled: true,
    status: "READY",
    schemaReady: true,
    permissions: permissions(),
    badges: {
      productionLive: true,
      mockDataDisabled: true,
      liveCalendarInputsOnly: true,
      lastEventScan: exposureMatrix.map(row => row.lastUpdated).filter(Boolean).sort().at(-1) || run?.completedAt || null,
      eventScannerHealth: summaryRow.scannerHealth
    },
    latestRun: run,
    summary: summaryRow,
    exposureMatrix,
    rankings,
    upcoming,
    deviations,
    opportunities,
    blocked,
    propRestrictions,
    propRestrictionMessage: propRestrictions.length ? null : "No prop firm news restrictions configured for connected accounts.",
    volatilityLiquidity,
    heatmap,
    weights: weightRows,
    aiSummary: persistedAi || aiSummary(events, exposureMatrix, opportunities, blocked),
    alerts: alertRows,
    audit: auditRows,
    emptyState: null
  };
}

export async function getEconomicEventsScannerEngine() {
  if (!isDatabaseConfigured()) return emptyState("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured.");
  const ready = await tableReadiness();
  if (!ready.ready) return emptyState("SCHEMA_NOT_READY", `Missing tables: ${ready.missing.join(", ")}`, ready.missing);
  return liveOutput();
}

export async function getEconomicEventsScannerSlice(slice) {
  const data = await getEconomicEventsScannerEngine();
  const map = {
    summary: { status: data.status, badges: data.badges, summary: data.summary },
    "exposure-matrix": { status: data.status, exposureMatrix: data.exposureMatrix },
    rankings: { status: data.status, rankings: data.rankings },
    upcoming: { status: data.status, upcoming: data.upcoming },
    deviations: { status: data.status, deviations: data.deviations },
    opportunities: { status: data.status, opportunities: data.opportunities },
    blocked: { status: data.status, blocked: data.blocked },
    "prop-restrictions": { status: data.status, propRestrictions: data.propRestrictions, message: data.propRestrictionMessage },
    "volatility-liquidity": { status: data.status, volatilityLiquidity: data.volatilityLiquidity },
    heatmap: { status: data.status, heatmap: data.heatmap },
    "ai-summary": { status: data.status, aiSummary: data.aiSummary },
    export: data
  };
  return map[slice] || data;
}

export async function getEconomicEventsScannerDetail(eventId) {
  const data = await getEconomicEventsScannerEngine();
  const event = getEconomicEvent(eventId) || readCalendarEvents().find(item => item.id === eventId);
  if (!event) return null;
  return {
    event,
    exposures: data.exposureMatrix.filter(row => row.nextEventId === eventId),
    rankings: data.rankings.filter(row => row.nextEventId === eventId),
    opportunities: data.opportunities.filter(row => row.eventId === eventId),
    blocked: data.blocked.filter(row => row.eventId === eventId),
    propRestrictions: data.propRestrictions.filter(row => row.eventId === eventId),
    volatilityLiquidity: data.volatilityLiquidity.filter(row => row.eventId === eventId),
    heatmap: data.heatmap.filter(row => row.eventId === eventId),
    aiSummary: data.aiSummary,
    alerts: data.alerts.filter(row => row.eventId === eventId),
    audit: await audit(eventId)
  };
}

async function assertReady() {
  if (!isDatabaseConfigured()) {
    const error = new Error("database_not_configured");
    error.status = 503;
    throw error;
  }
  const ready = await tableReadiness();
  if (!ready.ready) {
    const error = new Error("schema_not_ready");
    error.status = 503;
    error.missingTables = ready.missing;
    throw error;
  }
}

export async function runEconomicEventsScannerAction(action, body = {}, actor = "api", eventId = null) {
  await assertReady();
  if (action === "run-scan" || action === "recalculate") {
    if (body.syncFirst) await syncEconomicCalendar({ force: true }).catch(() => null);
    const data = await liveOutput();
    await withTransaction(async client => {
      const runKey = `EVENTS-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
      await client.query(`INSERT INTO market.economic_events_scanner_runs (run_key, status, completed_at, events_scanned, assets_scanned, health, triggered_by, payload) VALUES ($1,'Completed',now(),$2,$3,$4,$5,$6::jsonb)`, [runKey, data.upcoming.length + data.deviations.length, data.summary.assetsExposed, data.summary.scannerHealth, actor, JSON.stringify({ action })]);
      await client.query(`INSERT INTO market.economic_events_scanner_audit_logs (user_name, action, entity_type, reason, payload) VALUES ($1,$2,'economic_events_scanner',$3,$4::jsonb)`, [actor, action, body.reason || null, JSON.stringify({ assetsExposed: data.summary.assetsExposed })]);
    });
    return { accepted: true, type: `economic_events_scanner.${action}`, status: data.status, assetsExposed: data.summary.assetsExposed };
  }
  if (action === "sync-events") {
    return { accepted: true, type: "economic_events.sync.completed", result: await syncEconomicCalendar({ force: true }) };
  }
  if (action === "recalculate-event") {
    await safeQuery(`INSERT INTO market.economic_events_scanner_audit_logs (event_id, user_name, action, entity_type, entity_id, reason, payload) VALUES ($1,$2,'recalculate_event','economic_event',$3,$4,$5::jsonb)`, [eventId, actor, eventId, body.reason || null, JSON.stringify({ eventId })]);
    return { accepted: true, type: "economic_events_scanner.event.recalculated", eventId };
  }
  if (action === "create-alert") {
    await safeQuery(`INSERT INTO market.economic_events_scanner_alerts (alert_type, title, severity, event_id, asset, created_by, payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`, [body.alertType || "economic_event", body.title || "Economic events scanner alert", body.severity || "Info", body.eventId || eventId || null, body.asset || null, actor, JSON.stringify(body)]);
    return { accepted: true, type: "economic_events_scanner.alert.created" };
  }
  if (action === "regenerate-summary" || action === "save-summary") {
    const data = await liveOutput();
    const ai = data.aiSummary || {};
    await safeQuery(`INSERT INTO market.economic_events_scanner_ai_summaries (summary, most_important_upcoming_events, assets_most_exposed, events_creating_opportunities, events_requiring_avoidance, prop_firm_restriction_risks, likely_volatility_windows, macro_sentiment_alignment, assets_to_monitor, assets_to_avoid, recommended_next_step, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`, [ai.summary, ai.mostImportantUpcomingEvents, ai.assetsMostExposed, ai.eventsCreatingOpportunities, ai.eventsRequiringAvoidance, ai.propFirmRestrictionRisks, ai.likelyVolatilityWindows, ai.macroSentimentAlignment, ai.assetsToMonitor, ai.assetsToAvoid, ai.recommendedNextStep, JSON.stringify({ actor, action })]);
    return { accepted: true, type: "economic_events_scanner.ai_summary.saved" };
  }
  return { accepted: true, type: `economic_events_scanner.${action}.recorded` };
}

export async function exportEconomicEventsScannerReport() {
  return getEconomicEventsScannerEngine();
}
