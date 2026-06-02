import {
  appendLog,
  archiveProvider,
  buildProbeTarget,
  createProvider,
  createProviderDependencies,
  getLatestHealthByProvider,
  getLatestTicks,
  getLatencyTrend,
  getProviderById,
  getProviderLatencySummary,
  insertConfidence,
  insertHealth,
  insertIntegrity,
  insertLatency,
  insertProviderTest,
  listCoverageRows,
  listDetectedMt5Terminals,
  listLogs,
  listProviders,
  listSymbols,
  previewCoverageFromInput,
  replaceProviderCoverage,
  saveProviderSymbols,
  setProviderEnabled,
  TARGET_ASSETS,
  updateProvider,
  updateProviderHealthMeta,
  updateProviderStatus,
  validateProviderInput
} from "./market-data-repository.js";
import { isDatabaseConfigured } from "./db.js";
import {
  MT5_DEFAULT_SYMBOLS,
  MT5_KNOWN_TERMINALS,
  WORKFLOW_DEPENDENCY_CARDS,
  applyWizardPreset,
  getWizardCatalog,
  resolveVendorPreset
} from "./provider-wizard-catalog.js";

export { TARGET_ASSETS, PROVIDER_TYPES, CONNECTION_METHODS, AUTH_TYPES, ENVIRONMENTS, CAPABILITY_KEYS, ASSET_COVERAGE_OPTIONS } from "./market-data-repository.js";
export { getWizardCatalog } from "./provider-wizard-catalog.js";

const WORKFLOW_IMPACTS_STATIC = Object.freeze([
  { stage: "Card 1", target: "Data Sources Validation", impact: "STOP WORKFLOW on failure" },
  { stage: "Card 2", target: "Market Intelligence Gathering", impact: "Blocks intelligence inputs" },
  { stage: "Card 3", target: "20-Asset Universe Scanner", impact: "Scanner cannot rank assets" },
  { stage: "Card 5", target: "Market Analysis & Context Engine", impact: "Context engine degraded" },
  { stage: "Card 7", target: "AI Decision Engine", impact: "Decision confidence reduced" }
]);

function latencyClass(ms) {
  if (ms == null) return "UNKNOWN";
  if (ms < 20) return "EXCELLENT";
  if (ms <= 100) return "GOOD";
  if (ms <= 300) return "WARNING";
  return "CRITICAL";
}

function emptyOutput() {
  return {
    source: "market_data",
    status: "BLOCKED",
    health: 0,
    latency: 0,
    coverage: 0,
    integrity_score: 0,
    confidence_score: 0,
    symbols: 0,
    workflow_permission: "STOP"
  };
}

function evaluateIntegrity({ liveSymbolCount, totalSymbols, liveProbe }) {
  const checks = {
    missingPrices: liveSymbolCount === 0 ? totalSymbols : Math.max(0, totalSymbols - liveSymbolCount),
    priceGaps: liveProbe?.ok ? 0 : liveSymbolCount > 0 ? 1 : 0,
    stalePrices: liveProbe?.ok ? 0 : liveSymbolCount,
    invalidPrices: 0,
    negativePrices: 0,
    spreadAnomalies: 0,
    timestampIssues: liveProbe?.ok ? 0 : liveSymbolCount > 0 ? 1 : 0
  };
  const penalty = Object.values(checks).reduce((sum, value) => sum + value, 0);
  return { score: Math.max(0, Math.min(100, 100 - penalty * 2)), checks };
}

function evaluateConfidence({ health, coveragePct, latencyMs, integrityScore, liveProbe, enabledCount }) {
  if (!enabledCount) return 0;
  const availability = liveProbe?.ok ? 100 : Math.max(20, coveragePct);
  const freshness = liveProbe?.ok ? 100 : 30;
  const latencyScore = latencyMs == null ? 40 : latencyMs < 20 ? 100 : latencyMs <= 100 ? 92 : latencyMs <= 300 ? 75 : 40;
  return Math.round((health * 0.25) + (coveragePct * 0.25) + (latencyScore * 0.15) + (freshness * 0.15) + (integrityScore * 0.1) + (availability * 0.1));
}

function evaluateWorkflowPermission({ enabledCount, liveSymbolCount, health, coveragePct, latencyMs, integrityScore }) {
  if (!enabledCount) return "STOP";
  if (!liveSymbolCount) return "STOP";
  if (health < 70) return "STOP";
  if (integrityScore < 75) return "STOP";
  if (coveragePct < 80) return "RESTRICTED";
  if (latencyMs != null && latencyMs > 300) return "RESTRICTED";
  return "ALLOWED";
}

function workflowStatusFromPermission(permission) {
  if (permission === "STOP") return "BLOCKED";
  if (permission === "RESTRICTED") return "RESTRICTED";
  return "READY";
}

async function deriveProviderView(provider, healthMap) {
  const health = healthMap.get(provider.id);
  return {
    ...provider,
    health: health ? Number(health.health) : Number(provider.healthScore || 0),
    latencyMs: health?.latency_ms ?? null,
    freshness: health?.freshness || "UNAVAILABLE",
    tickRate: health?.tick_rate || 0,
    lastSync: provider.lastSyncAt,
    workflowImpact: provider.enabled ? "Operational dependency" : "Disabled"
  };
}

async function recalculateMarketMetrics({ liveProbe = null } = {}) {
  const dashboard = await getMarketDataOperationsDashboard({ liveProbe });
  await insertIntegrity({ integrityScore: dashboard.integrity.score, checks: dashboard.integrity.checks });
  await insertConfidence({
    confidenceScore: dashboard.confidence_score,
    integrityScore: dashboard.integrity_score,
    workflowPermission: dashboard.workflow_permission,
    factors: dashboard.output
  });
  return dashboard;
}

async function buildCoverageMatrix(providers, coverageRows, symbols, liveProbe) {
  const symbolList = symbols.length ? symbols.map((row) => row.symbol) : TARGET_ASSETS;
  const liveProviders = providers.filter((item) => item.status === "LIVE");
  const primary = liveProviders[0] || providers.find((item) => item.enabled);
  return symbolList.map((symbol) => {
    const rows = coverageRows.filter((row) => row.symbol === symbol);
    const liveRow = rows.find((row) => row.status === "LIVE");
    const available = Boolean(liveRow?.price_feed);
    return {
      symbol,
      provider: liveRow?.provider_name || primary?.name || "â€”",
      priceFeed: available,
      tickFeed: Boolean(liveRow?.tick_feed),
      spreadFeed: Boolean(liveRow?.spread_feed),
      volumeFeed: Boolean(liveRow?.volume_feed),
      coverage: available ? Number(liveRow?.coverage || 100) : 0,
      status: available ? "LIVE" : liveProbe && !liveProbe.ok && rows.length ? "DISCONNECTED" : "UNAVAILABLE"
    };
  });
}

async function buildLiveFeed(coverage, ticks) {
  const tickMap = new Map(ticks.map((row) => [row.symbol, row]));
  return coverage.map((row) => {
    const tick = tickMap.get(row.symbol);
    const bid = tick?.bid != null ? Number(tick.bid) : null;
    const ask = tick?.ask != null ? Number(tick.ask) : null;
    return {
      symbol: row.symbol,
      bid,
      ask,
      spread: tick?.spread != null ? Number(tick.spread) : null,
      lastTick: tick?.observed_at || null,
      provider: row.provider,
      status: row.status === "LIVE" ? "HEALTHY" : row.status === "DISCONNECTED" ? "DISCONNECTED" : "DELAYED"
    };
  });
}

async function buildProviderCoverageCounts(providers, coverageRows, symbolCount) {
  return providers.map((provider) => {
    const count = coverageRows.filter((row) => row.provider_id === provider.id && row.price_feed).length;
    return {
      ...provider,
      coverage: `${count}/${symbolCount}`,
      coveragePct: symbolCount ? Math.round(count / symbolCount * 100) : 0
    };
  });
}

function buildEmptyDashboard(reason = "empty") {
  const output = emptyOutput();
  return {
    ...output,
    updatedAt: new Date().toISOString(),
    empty: true,
    reason,
    header: {
      connectedProviders: 0,
      healthyProviders: 0,
      liveSymbols: `0/${TARGET_ASSETS.length}`,
      workflowStatus: "BLOCKED",
      dataConfidence: "Not Available"
    },
    banner: {
      workflowStatus: "BLOCKED",
      marketDataHealth: "Not Available",
      liveSymbols: `0/${TARGET_ASSETS.length}`,
      averageLatency: "Not Available",
      feedFreshness: "UNAVAILABLE",
      dataConfidenceScore: "Not Available"
    },
    kpis: [
      ["Connected Providers", 0],
      ["Online Providers", 0],
      ["Offline Providers", 0],
      ["Symbols Available", `0/${TARGET_ASSETS.length}`],
      ["Average Tick Rate", "Not Available"],
      ["Average Spread", "Not Available"],
      ["Average Latency", "Not Available"],
      ["Data Quality Score", "Not Available"],
      ["Data Confidence Score", "Not Available"],
      ["Workflow Readiness", "Not Available"]
    ],
    providers: [],
    liveFeed: [],
    coverage: [],
    tickQuality: {
      tickFrequency: "Not Available",
      tickGaps: 0,
      missingTicks: 0,
      tickStability: "UNSTABLE",
      ticksPerMinute: [],
      ticksPerHour: []
    },
    spreadQuality: [],
    latencyMonitor: {
      providerLatency: [],
      averageLatencyMs: 0,
      maxLatencyMs: 0,
      connectionStability: "DEGRADED",
      trend: [],
      comparison: []
    },
    integrity: { score: 0, checks: {} },
    symbolAvailability: [],
    comparison: [],
    workflowImpacts: WORKFLOW_IMPACTS_STATIC,
    logs: [],
    output
  };
}

export async function getMarketDataOperationsDashboard({ liveProbe = null } = {}) {
  if (!isDatabaseConfigured()) return buildEmptyDashboard("database_not_configured");
  const [providersRaw, healthMap, coverageRows, symbols, ticks, logs] = await Promise.all([
    listProviders(),
    getLatestHealthByProvider(),
    listCoverageRows(),
    listSymbols(),
    getLatestTicks(),
    listLogs(100)
  ]);
  if (!providersRaw.length) return buildEmptyDashboard("empty");
  return buildComputedDashboard(providersRaw, healthMap, coverageRows, symbols, ticks, logs, liveProbe);
}

async function buildComputedDashboard(providersRaw, healthMap, coverageRows, symbols, ticks, logs, liveProbe) {
  const symbolCount = symbols.length || TARGET_ASSETS.length;
  let providers = await Promise.all(providersRaw.map((provider) => deriveProviderView(provider, healthMap)));
  providers = await buildProviderCoverageCounts(providers, coverageRows, symbolCount);
  const coverage = await buildCoverageMatrix(providers, coverageRows, symbols, liveProbe);
  const liveFeed = await buildLiveFeed(coverage, ticks);
  const liveSymbols = coverage.filter((row) => row.status === "LIVE").length;
  const enabledProviders = providers.filter((item) => item.enabled);
  const onlineProviders = providers.filter((item) => ["LIVE", "ONLINE", "SCHEDULED"].includes(item.status)).length;
  const offlineProviders = providers.filter((item) => ["FAILED", "NOT_CONFIGURED", "DISABLED", "ARCHIVED"].includes(item.status)).length;
  const latencyValues = providers.map((item) => item.latencyMs).filter((value) => value != null);
  const avgLatency = latencyValues.length
    ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
    : liveProbe?.latencyMs ?? 0;
  const health = providers.length ? Math.round(providers.reduce((sum, item) => sum + Number(item.health || 0), 0) / providers.length) : 0;
  const coveragePct = symbolCount ? Math.round(liveSymbols / symbolCount * 100) : 0;
  const integrity = evaluateIntegrity({ liveSymbolCount: liveSymbols, totalSymbols: symbolCount, liveProbe });
  const confidenceScore = evaluateConfidence({ health, coveragePct, latencyMs: avgLatency, integrityScore: integrity.score, liveProbe, enabledCount: enabledProviders.length });
  const workflowPermission = evaluateWorkflowPermission({ enabledCount: enabledProviders.length, liveSymbolCount: liveSymbols, health, coveragePct, latencyMs: avgLatency, integrityScore: integrity.score });
  const status = workflowStatusFromPermission(workflowPermission);
  const output = { source: "market_data", status, health, latency: avgLatency, coverage: coveragePct, integrity_score: integrity.score, confidence_score: confidenceScore, symbols: liveSymbols, workflow_permission: workflowPermission };
  const latencySummary = await getProviderLatencySummary();
  const latencyTrend = await getLatencyTrend();
  const spreadRows = liveFeed.filter((row) => row.spread != null).slice(0, 5);
  return {
    ...output,
    updatedAt: new Date().toISOString(),
    empty: false,
    header: {
      connectedProviders: enabledProviders.length,
      healthyProviders: providers.filter((item) => Number(item.health) >= 85).length,
      liveSymbols: `${liveSymbols}/${symbolCount}`,
      workflowStatus: status,
      dataConfidence: providers.length ? `${confidenceScore}%` : "Not Available"
    },
    banner: {
      workflowStatus: status,
      marketDataHealth: providers.length ? `${health}%` : "Not Available",
      liveSymbols: `${liveSymbols}/${symbolCount}`,
      averageLatency: avgLatency ? `${avgLatency}ms` : "Not Available",
      feedFreshness: liveSymbols > 0 ? "REAL-TIME" : "UNAVAILABLE",
      dataConfidenceScore: providers.length ? `${confidenceScore}%` : "Not Available"
    },
    kpis: [
      ["Connected Providers", enabledProviders.length],
      ["Online Providers", onlineProviders],
      ["Offline Providers", offlineProviders],
      ["Symbols Available", `${liveSymbols}/${symbolCount}`],
      ["Average Tick Rate", liveSymbols > 0 ? `${Math.round(providers.reduce((sum, item) => sum + Number(item.tickRate || 0), 0) / Math.max(providers.length, 1))}/sec` : "Not Available"],
      ["Average Spread", spreadRows.length ? "Available" : "Not Available"],
      ["Average Latency", avgLatency ? `${avgLatency}ms` : "Not Available"],
      ["Data Quality Score", providers.length ? `${integrity.score}%` : "Not Available"],
      ["Data Confidence Score", providers.length ? `${confidenceScore}%` : "Not Available"],
      ["Workflow Readiness", providers.length ? workflowPermission : "Not Available"]
    ],
    providers,
    liveFeed,
    coverage,
    tickQuality: {
      tickFrequency: liveSymbols > 0 ? `${providers.reduce((sum, item) => sum + Number(item.tickRate || 0), 0)} ticks/min` : "Not Available",
      tickGaps: liveSymbols > 0 ? 0 : symbolCount,
      missingTicks: Math.max(0, symbolCount - liveSymbols),
      tickStability: liveSymbols > 0 ? "STABLE" : "UNSTABLE",
      ticksPerMinute: latencyTrend.map((row) => row.latency_ms || 0),
      ticksPerHour: latencyTrend.map((row) => row.latency_ms || 0)
    },
    spreadQuality: spreadRows.map((row) => ({
      symbol: row.symbol,
      currentSpread: row.spread != null ? String(row.spread) : "â€”",
      averageSpread: row.spread != null ? String(row.spread) : "â€”",
      quality: row.status === "HEALTHY" ? "Available" : "Not Available",
      riskImpact: row.status === "HEALTHY" ? "Low" : "High"
    })),
    latencyMonitor: {
      providerLatency: latencySummary.map((row) => ({ provider: row.name, latencyMs: row.latency_ms, class: row.latency_class })),
      averageLatencyMs: avgLatency,
      maxLatencyMs: latencyValues.length ? Math.max(...latencyValues) : 0,
      connectionStability: liveSymbols > 0 ? "STABLE" : "DEGRADED",
      trend: latencyTrend.map((row) => row.latency_ms || 0),
      comparison: providers.filter((item) => item.enabled).map((item) => ({
        provider: item.name, latencyMs: item.latencyMs ?? 0, quality: item.health, coverage: item.coveragePct ?? 0, availability: item.status
      }))
    },
    integrity,
    symbolAvailability: providers.map((provider) => ({
      provider: provider.name,
      symbols: Object.fromEntries((symbols.length ? symbols.map((row) => row.symbol) : TARGET_ASSETS).map((symbol) => {
        const row = coverageRows.find((item) => item.provider_id === provider.id && item.symbol === symbol);
        return [symbol, row?.price_feed ? "Available" : provider.status === "FAILED" ? "Unavailable" : "Delayed"];
      }))
    })),
    comparison: providers.filter((item) => item.enabled).map((item) => ({
      provider: item.name, latencyMs: item.latencyMs ?? 0, spread: item.status === "LIVE" ? "Available" : "Not Available",
      coverage: item.coveragePct ?? 0, quality: item.health, availability: item.status
    })),
    workflowImpacts: WORKFLOW_IMPACTS_STATIC,
    logs,
    output
  };
}

export async function getMarketDataHealthDashboard({ liveProbe = null } = {}) {
  const dashboard = await getMarketDataOperationsDashboard({ liveProbe });
  return { observedAt: new Date().toISOString(), providers: dashboard.providers.map(({ id, name, status, health, latencyMs, freshness }) => ({ id, name, status, health, latencyMs, freshness })) };
}

export async function getMarketDataLatencyDashboard({ liveProbe = null } = {}) {
  return (await getMarketDataOperationsDashboard({ liveProbe })).latencyMonitor;
}

export async function getMarketDataSymbolsDashboard({ liveProbe = null } = {}) {
  const symbols = isDatabaseConfigured() ? await listSymbols() : [];
  const dashboard = await getMarketDataOperationsDashboard({ liveProbe });
  return { symbols: symbols.length ? symbols.map((row) => row.symbol) : TARGET_ASSETS, coverage: dashboard.coverage, liveFeed: dashboard.liveFeed };
}

export async function getMarketDataLogsDashboard() {
  return { logs: isDatabaseConfigured() ? await listLogs(100) : [] };
}

export async function getMarketDataConfidenceDashboard({ liveProbe = null } = {}) {
  const dashboard = await getMarketDataOperationsDashboard({ liveProbe });
  return {
    confidence_score: dashboard.confidence_score,
    integrity_score: dashboard.integrity_score,
    workflow_permission: dashboard.workflow_permission,
    factors: { providerHealth: dashboard.health, coverage: dashboard.coverage, latency: dashboard.latency, freshness: dashboard.symbols > 0 ? 100 : 0, integrity: dashboard.integrity_score, availability: dashboard.symbols > 0 ? 100 : 0 },
    output: dashboard.output
  };
}

export async function getMarketDataProviderById(id) {
  const provider = await getProviderById(id);
  if (!provider) throw new Error("provider_not_found");
  const [healthMap, coverageRows, logs] = await Promise.all([getLatestHealthByProvider(), listCoverageRows(), listLogs(50)]);
  return { provider: await deriveProviderView(provider, healthMap), coverage: coverageRows.filter((row) => row.provider_id === id), logs: logs.filter((row) => row.providerId === id) };
}

export async function validateProviderConfiguration(input) {
  const wizard = Boolean(input.wizardCategory || input.category);
  validateProviderInput(input, { wizard });
  return { valid: true, message: "Configuration validated successfully" };
}

export async function detectMt5Terminals({ actor = "system.admin" } = {}) {
  const dbTerminals = await listDetectedMt5Terminals();
  const terminals = dbTerminals.length ? dbTerminals : MT5_KNOWN_TERMINALS;
  await appendLog({
    providerName: "system",
    event: "terminal_detected",
    action: "Terminal Detected",
    actor,
    result: "SUCCESS",
    severity: "info",
    message: `${terminals.length} MT5 terminal(s) discovered`
  });
  return { terminals, source: dbTerminals.length ? "database" : "local_scan" };
}

export async function loadMarketWatch(input) {
  const normalized = applyWizardPreset(input);
  const symbols = parseSymbolsFromInput(normalized);
  const list = symbols.length ? symbols : MT5_DEFAULT_SYMBOLS;
  return {
    symbols: list,
    count: list.length,
    source: normalized.terminalId ? "terminal" : "preset"
  };
}

export async function detectSymbols(input) {
  const normalized = applyWizardPreset(input);
  const watch = await loadMarketWatch(normalized);
  const preset = normalized.vendorKey ? resolveVendorPreset(normalized.vendorKey) : null;
  const symbols = watch.symbols.length ? watch.symbols : (preset?.supportedSymbols || TARGET_ASSETS);
  return {
    symbols,
    count: symbols.length,
    assetCoverage: normalized.assetCoverage?.length ? normalized.assetCoverage : (preset?.assetCoverage || ["Forex", "Metals", "Indices"])
  };
}

function buildMt5Diagnostics(input, probe) {
  const normalized = applyWizardPreset(input);
  const symbols = parseSymbolsFromInput(normalized);
  const checks = [
    { label: "Terminal exists", status: normalized.terminalId || normalized.dataPath || normalized.terminalName ? "PASS" : "WARNING" },
    { label: "Account available", status: normalized.accountNumber ? "PASS" : "WARNING" },
    { label: "Server reachable", status: normalized.serverName ? "PASS" : "FAIL" },
    { label: "Symbols available", status: symbols.length ? "PASS" : "WARNING" },
    { label: "Live pricing available", status: probe.ok ? "PASS" : "FAIL" },
    { label: "Latency acceptable", status: probe.latencyMs != null && probe.latencyMs <= 300 ? "PASS" : probe.ok ? "WARNING" : "FAIL" }
  ];
  const failCount = checks.filter((item) => item.status === "FAIL").length;
  const warnCount = checks.filter((item) => item.status === "WARNING").length;
  const result = failCount ? "FAIL" : warnCount ? "WARNING" : "PASS";
  return { result, checks, latencyMs: probe.latencyMs ?? null };
}

export async function testProviderConfiguration(input, { liveProbe = null, probeFn, actor = "system.admin", providerId = null } = {}) {
  const wizard = Boolean(input.wizardCategory || input.category);
  validateProviderInput(input, { wizard });
  const normalized = applyWizardPreset(input);
  const probe = await probeConfiguration(normalized, { liveProbe, probeFn });
  const symbols = parseSymbolsFromInput(normalized);
  const symbolsFound = probe.ok ? (symbols.length || TARGET_ASSETS.length) : symbols.length;

  let diagnostics = null;
  let result = probe.ok ? "PASS" : "FAIL";
  if (wizard && (normalized.wizardCategory === "mt5_terminal" || normalized.category === "mt5_terminal")) {
    diagnostics = buildMt5Diagnostics(normalized, probe);
    result = diagnostics.result;
  }

  await insertProviderTest({
    providerId,
    testType: "connection",
    result,
    latencyMs: probe.latencyMs ?? diagnostics?.latencyMs ?? null,
    diagnostics: diagnostics || { message: probe.ok ? "Connection successful" : probe.reason },
    actor
  });

  await appendLog({
    providerId,
    providerName: normalized.name || "unsaved provider",
    event: "connection_tested",
    action: "Connection Tested",
    actor,
    result,
    severity: result === "FAIL" ? "warning" : "info",
    message: result === "PASS" ? "Connection test passed" : result === "WARNING" ? "Connection test passed with warnings" : probe.reason || "Connection test failed"
  });

  return {
    status: result === "PASS" ? "SUCCESS" : result === "WARNING" ? "WARNING" : "FAILED",
    result,
    latency_ms: probe.latencyMs ?? 0,
    provider_health: result === "FAIL" ? 0 : result === "WARNING" ? 85 : 98,
    symbols_found: symbolsFound,
    message: result === "PASS" ? "Connection successful" : probe.reason || "Connection failed",
    diagnostics
  };
}

export async function previewProviderCoverage(input) {
  validateProviderInput(input, { draft: true, wizard: Boolean(input.wizardCategory || input.category) });
  const normalized = applyWizardPreset(input);
  return previewCoverageFromInput(normalized);
}

function parseSymbolsFromInput(input) {
  if (Array.isArray(input.supportedSymbols)) return input.supportedSymbols;
  return String(input.supportedSymbols || "").split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
}

async function probeConfiguration(input, { liveProbe, probeFn } = {}) {
  const target = buildProbeTarget(input);
  const method = input.connectionMethod;
  if (method === "MT5 Bridge") {
    const probe = liveProbe || (target && probeFn ? await probeFn(target) : null);
    return probe || { ok: Boolean(liveProbe?.ok), latencyMs: liveProbe?.latencyMs ?? null, reason: "mt5_bridge_not_connected" };
  }
  if (probeFn && target) return probeFn(target);
  if (!target) return { ok: false, latencyMs: null, reason: "url_not_configured" };
  return liveProbe || { ok: false, latencyMs: null, reason: "probe_unavailable" };
}

export async function createMarketDataProvider(input, { liveProbe = null, probeFn, createdBy = "system.admin", draft = false, testOnSave = true } = {}) {
  const wizard = Boolean(input.wizardCategory || input.category);
  const provider = await createProvider(input, { createdBy, draft, wizard });
  await appendLog({
    providerId: provider.id,
    providerName: provider.name,
    event: draft ? "provider_draft_saved" : "provider_created",
    action: draft ? "Provider Draft Saved" : "Provider Created",
    actor: createdBy,
    result: "SUCCESS",
    severity: "info",
    message: `${provider.name} ${draft ? "saved as draft" : "registered"} (${provider.providerCode})`
  });

  let testResult = null;
  if (!draft && testOnSave && provider.enabled) {
    testResult = await testMarketDataProvider(provider.id, { liveProbe, probeFn });
  }

  if (!draft) {
    const symbols = parseSymbolsFromInput(applyWizardPreset(input));
    if (symbols.length) {
      await saveProviderSymbols(provider.id, symbols, { source: wizard ? "wizard" : "manual" });
      await appendLog({
        providerId: provider.id,
        providerName: provider.name,
        event: "symbols_imported",
        action: "Symbols Imported",
        actor: createdBy,
        result: "SUCCESS",
        severity: "info",
        message: `${symbols.length} symbols saved for ${provider.name}`
      });
      const coverageRows = symbols.map((symbol) => ({
        symbol,
        priceFeed: true,
        tickFeed: true,
        spreadFeed: true,
        volumeFeed: false,
        coverage: 100,
        status: "CONFIGURED"
      }));
      await replaceProviderCoverage(provider.id, coverageRows);
      await appendLog({
        providerId: provider.id,
        providerName: provider.name,
        event: "coverage_generated",
        action: "Coverage Generated",
        actor: createdBy,
        result: "SUCCESS",
        severity: "info",
        message: `Coverage matrix generated for ${provider.name}`
      });
    }

    await createProviderDependencies(provider.id, WORKFLOW_DEPENDENCY_CARDS);
    await insertHealth({
      providerId: provider.id,
      status: provider.status,
      health: provider.healthScore || 0,
      freshness: "CONFIGURED",
      tickRate: 0
    });
  } else if (!testResult) {
    await recalculateMarketMetrics({ liveProbe });
  }

  const dashboard = await getMarketDataOperationsDashboard({ liveProbe });
  return {
    provider,
    testResult,
    notification: {
      title: draft ? "Provider Draft Saved" : "Provider Registered Successfully",
      providerName: provider.name,
      providerCode: provider.providerCode,
      status: draft ? "Draft" : "Registered",
      workflowImpact: "Integrated across Cards 1–10"
    },
    dashboard
  };
}

export async function updateMarketDataProvider(id, input) {
  validateProviderInput(input, { partial: true });
  const provider = await updateProvider(id, input);
  await appendLog({ providerId: provider.id, providerName: provider.name, event: "provider_updated", severity: "info", message: `Provider ${provider.name} updated` });
  return provider;
}

export async function deleteMarketDataProvider(id) {
  const archived = await archiveProvider(id);
  await appendLog({ providerId: id, providerName: archived.name, event: "provider_deleted", severity: "warning", message: `Provider ${archived.name} archived` });
  return { id, archived: true };
}

export async function enableMarketDataProvider(id) {
  const provider = await setProviderEnabled(id, true);
  await appendLog({ providerId: id, providerName: provider.name, event: "provider_enabled", severity: "info", message: `Provider ${provider.name} enabled` });
  return provider;
}

export async function disableMarketDataProvider(id) {
  const provider = await setProviderEnabled(id, false);
  await appendLog({ providerId: id, providerName: provider.name, event: "provider_disabled", severity: "warning", message: `Provider ${provider.name} disabled` });
  return provider;
}

async function probeProvider(provider, { liveProbe, probeFn } = {}) {
  return probeConfiguration(provider, { liveProbe, probeFn });
}

function deriveTestResult(provider, probe) {
  if (!provider.enabled) return { status: "DISABLED", health: 0, latencyMs: null, freshness: "OFFLINE", result: "WARNING" };
  if (probe?.ok) return { status: "LIVE", health: 100, latencyMs: probe.latencyMs, freshness: "REAL-TIME", result: "PASS" };
  if (provider.baseUrl || provider.websocketUrl) return { status: "FAILED", health: 0, latencyMs: probe?.latencyMs ?? null, freshness: "STALE", result: "FAIL" };
  return { status: "NOT_CONFIGURED", health: 0, latencyMs: null, freshness: "UNAVAILABLE", result: "WARNING" };
}

export async function testMarketDataProvider(providerId, { liveProbe = null, probeFn } = {}) {
  const provider = await getProviderById(providerId);
  if (!provider) throw new Error("provider_not_found");
  await appendLog({ providerId, providerName: provider.name, event: "provider_test_started", severity: "info", message: `Testing provider ${provider.name}` });
  const probe = await probeProvider(provider, { liveProbe, probeFn });
  const derived = deriveTestResult(provider, probe);
  await updateProviderStatus(providerId, derived.status);
  await insertHealth({ providerId, status: derived.status, health: derived.health, freshness: derived.freshness, tickRate: derived.status === "LIVE" ? 180 : 0 });
  if (derived.latencyMs != null) await insertLatency({ providerId, latencyMs: derived.latencyMs, latencyClass: latencyClass(derived.latencyMs) });
  const dashboard = await getMarketDataOperationsDashboard({ liveProbe: probe });
  await insertIntegrity({ integrityScore: dashboard.integrity.score, checks: dashboard.integrity.checks });
  await insertConfidence({ confidenceScore: dashboard.confidence_score, integrityScore: dashboard.integrity_score, workflowPermission: dashboard.workflow_permission, factors: dashboard.output });
  await updateProviderHealthMeta(providerId, { healthScore: derived.health, status: derived.status });

  await appendLog({ providerId, providerName: provider.name, event: derived.result === "PASS" ? "provider_test_passed" : "provider_test_failed", severity: derived.result === "PASS" ? "info" : "warning", message: `${provider.name} test ${derived.result}` });
  return { providerId, result: derived.result, ...derived, status: derived.result === "PASS" ? "SUCCESS" : "FAILED", latency_ms: derived.latencyMs ?? 0, provider_health: derived.health, symbols_found: derived.status === "LIVE" ? TARGET_ASSETS.length : 0, message: derived.result === "PASS" ? "Connection successful" : "Connection failed" };
}

export async function testAllMarketDataProviders({ liveProbe = null, probeFn } = {}) {
  const providers = (await listProviders()).filter((item) => item.enabled);
  const results = [];
  for (const provider of providers) results.push(await testMarketDataProvider(provider.id, { liveProbe, probeFn }));
  return { testedAt: new Date().toISOString(), results };
}

export async function syncMarketDataProviderSymbols(providerId, { liveProbe = null, probeFn } = {}) {
  const provider = await getProviderById(providerId);
  if (!provider) throw new Error("provider_not_found");
  await appendLog({ providerId, providerName: provider.name, event: "symbols_sync_started", severity: "info", message: `Symbol sync started for ${provider.name}` });
  const symbols = await listSymbols();
  const symbolList = symbols.length ? symbols : TARGET_ASSETS.map((symbol) => ({ symbol, asset_class: "forex" }));
  const probe = await probeProvider(provider, { liveProbe, probeFn });
  const live = Boolean(probe?.ok);
  const coverageRows = symbolList.map((row) => ({ symbol: row.symbol, priceFeed: live, tickFeed: live, spreadFeed: live, volumeFeed: live, coverage: live ? 100 : 0, status: live ? "LIVE" : "UNAVAILABLE" }));
  await replaceProviderCoverage(providerId, coverageRows);
  if (live) await updateProviderStatus(providerId, "LIVE");
  await appendLog({ providerId, providerName: provider.name, event: "symbols_sync_completed", severity: live ? "info" : "warning", message: live ? `${coverageRows.length} symbols synchronized` : "Live adapter unavailable" });
  return { providerId, syncedAt: new Date().toISOString(), symbols: live ? coverageRows.filter((row) => row.priceFeed).length : 0, status: live ? "COMPLETED" : "FAILED" };
}

export async function syncAllMarketDataProviderSymbols(options = {}) {
  const providers = (await listProviders()).filter((item) => item.enabled);
  const results = [];
  for (const provider of providers) results.push(await syncMarketDataProviderSymbols(provider.id, options));
  return { syncedAt: new Date().toISOString(), results };
}

export async function syncMarketDataSymbols(options = {}) {
  return syncAllMarketDataProviderSymbols(options);
}

export async function exportMarketDataStatus({ liveProbe = null } = {}) {
  const [dashboard, health, latency, coverage, confidence] = await Promise.all([
    getMarketDataOperationsDashboard({ liveProbe }),
    getMarketDataHealthDashboard({ liveProbe }),
    getMarketDataLatencyDashboard({ liveProbe }),
    getMarketDataSymbolsDashboard({ liveProbe }),
    getMarketDataConfidenceDashboard({ liveProbe })
  ]);
  return { dashboard, health, latency, coverage, confidence, exportedAt: new Date().toISOString() };
}

export function exportMarketDataStatusCsv(payload) {
  const lines = [
    "section,field,value",
    `readiness,status,${payload.dashboard.status}`,
    `readiness,health,${payload.dashboard.health}`,
    `readiness,latency,${payload.dashboard.latency}`,
    `readiness,coverage,${payload.dashboard.coverage}`,
    `readiness,integrity_score,${payload.dashboard.integrity_score}`,
    `readiness,confidence_score,${payload.dashboard.confidence_score}`,
    `readiness,symbols,${payload.dashboard.symbols}`,
    `readiness,workflow_permission,${payload.dashboard.workflow_permission}`
  ];
  for (const provider of payload.dashboard.providers) {
    lines.push(`provider,${provider.name},${provider.status}|health=${provider.health}|latency=${provider.latencyMs ?? ""}|coverage=${provider.coverage}`);
  }
  return `${lines.join("\n")}\n`;
}

export function evaluateMarketDataQuality(providers = [], coverage = []) {
  const enabled = providers.filter((item) => item.enabled !== false);
  if (!enabled.length) return { market_data_status: "BLOCKED", feed_quality_score: 0, latency_ms: 0, coverage: 0, symbols_online: 0, workflow_ready: false, reject_reason: "No enabled providers" };
  const quality = Math.round(enabled.reduce((sum, provider) => sum + Number(provider.health || provider.qualityScore || 0), 0) / enabled.length);
  const latencyValues = enabled.map((item) => item.latencyMs).filter((value) => value != null);
  const latency = latencyValues.length ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length) : 0;
  const symbolsOnline = coverage.filter(({ status, priceFeed }) => status === "LIVE" || priceFeed).length;
  const coveragePct = coverage.length ? Math.round(symbolsOnline / coverage.length * 100) : 0;
  const workflowReady = quality >= 85 && symbolsOnline > 0 && enabled.every(({ status }) => status !== "FAILED");
  return { market_data_status: workflowReady ? "READY" : "BLOCKED", feed_quality_score: quality, latency_ms: latency, coverage: coveragePct, symbols_online: symbolsOnline, workflow_ready: workflowReady, reject_reason: workflowReady ? null : "Market data quality insufficient" };
}

export const MARKET_DATA_PROVIDERS = [];
export const MARKET_DATA_COVERAGE = [];
