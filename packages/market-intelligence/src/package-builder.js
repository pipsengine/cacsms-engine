import { query, withTransaction } from "./db.js";
import { getBrokerLiquidityDashboard } from "./broker-liquidity.js";
import { getPortfolioIntelligenceDashboard } from "./portfolio-intelligence.js";
import { getScoringEngineModel } from "./scoring-engine.js";

const PACKAGE_TYPES = Object.freeze([
  "Market Overview Package",
  "Instrument Analysis Package",
  "Trade Opportunity Package",
  "News Impact Package",
  "Macro Bias Package",
  "Sentiment Bias Package",
  "Institutional Bias Package",
  "Broker Liquidity Package",
  "Portfolio Risk Package",
  "Prop Firm Compliance Package",
  "Full Decision Package"
]);

const MODULES = Object.freeze([
  ["market_environment", "Market Environment", true],
  ["macro", "Macro Intelligence", true],
  ["sentiment", "Sentiment Intelligence", true],
  ["institutional", "Institutional Intelligence", true],
  ["broker_liquidity", "Broker Liquidity", true],
  ["portfolio", "Portfolio Intelligence", true],
  ["economic_calendar", "Economic Calendar", false],
  ["news_sentiment", "News Sentiment", false],
  ["social_sentiment", "Social Sentiment", false],
  ["historical_data", "Historical Data", true],
  ["broker_data", "Broker Data", true],
  ["account_portfolio", "Account Portfolio", true],
  ["prop_firm_rules", "Prop Firm Rules", false],
  ["cot_reports", "COT Reports", false],
  ["source_health", "Source Health Review", true],
  ["dependency_matrix", "Dependency Matrix", true],
  ["scoring_engine_inputs", "Scoring Engine Inputs", true]
]);

const STATUSES = Object.freeze(["Draft", "Building", "Validation Pending", "Validated", "Failed Validation", "Submitted to Scoring", "Rejected", "Archived"]);

const pct = (value) => value == null || value === "" || Number.isNaN(Number(value)) ? null : Math.max(0, Math.min(100, Number(Number(value).toFixed(2))));
const avg = (values) => {
  const clean = values.map(Number).filter(Number.isFinite);
  return clean.length ? pct(clean.reduce((sum, value) => sum + value, 0) / clean.length) : null;
};

function freshness(value) {
  if (!value) return { label: "Insufficient Data", score: null };
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds <= 3600) return { label: `${Math.round(seconds / 60)}m`, score: 100 };
  if (seconds <= 86400) return { label: `${Math.round(seconds / 3600)}h`, score: 80 };
  if (seconds <= 604800) return { label: `${Math.round(seconds / 86400)}d`, score: 50 };
  return { label: `${Math.round(seconds / 86400)}d stale`, score: 20 };
}

function textScore(value) {
  const text = String(value || "").toLowerCase();
  if (/strong bullish|healthy|tradeable|excellent|passed|validated|online|ready/.test(text)) return 85;
  if (/bullish|good|active|normal/.test(text)) return 70;
  if (/neutral|mixed|watch|pending/.test(text)) return 50;
  if (/bearish|weak|poor|degraded|warning/.test(text)) return 30;
  if (/critical|failed|blocked|avoid|offline/.test(text)) return 10;
  return null;
}

function packageId() {
  return `MIP-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 17)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) return { rows: [] };
    throw error;
  }
}

async function audit(packageIdValue, action, payload = {}, actor = "api", result = "accepted") {
  await safeQuery(
    "INSERT INTO market.intelligence_package_audit_logs (package_id, actor, action, payload, result) VALUES ($1,$2,$3,$4::jsonb,$5)",
    [packageIdValue || null, actor, action, JSON.stringify(payload), result]
  );
}

export async function getPackageBuilderInstruments() {
  const sources = await Promise.all([
    safeQuery("SELECT symbol AS key, symbol AS label, asset_class, true AS enabled FROM market.market_data_symbols WHERE enabled = true ORDER BY symbol"),
    safeQuery("SELECT symbol AS key, symbol AS label, asset_class, true AS enabled FROM market.market_instruments WHERE enabled = true ORDER BY symbol"),
    safeQuery("SELECT broker_symbol AS key, broker_symbol AS label, asset_class, true AS enabled FROM market.broker_supported_symbols WHERE enabled = true ORDER BY broker_symbol")
  ]);
  const byKey = new Map();
  for (const result of sources) {
    for (const row of result.rows) {
      const key = String(row.key || "").trim();
      if (key && !byKey.has(key)) byKey.set(key, { key, label: row.label || key, assetClass: row.asset_class || null });
    }
  }
  return { instruments: [...byKey.values()] };
}

export async function getPackageBuilderModules() {
  const [env, macro, sentiment, institutional, sourceHealth, dependency, social, cot, coverage, broker, portfolio, scoring] = await Promise.all([
    safeQuery("SELECT environment_score, confidence, calculated_at FROM market.market_environment_scores ORDER BY calculated_at DESC LIMIT 1").then((r) => r.rows[0]),
    safeQuery("SELECT macro_confidence, risk_tone, calculated_at FROM market.macro_intelligence_scores ORDER BY calculated_at DESC LIMIT 1").then((r) => r.rows[0]),
    safeQuery("SELECT overall_sentiment_score, sentiment_confidence, calculated_at FROM market.sentiment_intelligence_scores ORDER BY calculated_at DESC LIMIT 1").then((r) => r.rows[0]),
    safeQuery("SELECT institutional_score, institutional_confidence, calculated_at FROM market.institutional_intelligence_scores ORDER BY calculated_at DESC LIMIT 1").then((r) => r.rows[0]),
    safeQuery("SELECT avg(health_score)::numeric AS score, max(observed_at) AS observed_at FROM market.source_health_metrics").then((r) => r.rows[0]),
    safeQuery("SELECT avg(score)::numeric AS score, max(calculated_at) AS calculated_at FROM market.dependency_health_scores").then((r) => r.rows[0]),
    safeQuery("SELECT avg(sentiment_score)::numeric AS score, avg(ai_confidence)::numeric AS confidence, max(observed_at) AS observed_at FROM market.social_sentiment_scores").then((r) => r.rows[0]),
    safeQuery("SELECT cot_bias, max(observed_at) AS observed_at FROM market.cot_positioning_metrics GROUP BY cot_bias ORDER BY max(observed_at) DESC LIMIT 1").then((r) => r.rows[0]),
    safeQuery("SELECT avg(coverage)::numeric AS score FROM market.market_data_coverage").then((r) => r.rows[0]),
    getBrokerLiquidityDashboard().catch(() => null),
    getPortfolioIntelligenceDashboard().catch(() => null),
    getScoringEngineModel().catch(() => null)
  ]);
  const moduleData = {
    market_environment: { score: env?.environment_score, confidence: env?.confidence, health: env?.confidence, at: env?.calculated_at },
    macro: { score: textScore(macro?.risk_tone), confidence: macro?.macro_confidence, health: macro?.macro_confidence, at: macro?.calculated_at },
    sentiment: { score: sentiment?.overall_sentiment_score, confidence: sentiment?.sentiment_confidence, health: sentiment?.sentiment_confidence, at: sentiment?.calculated_at },
    institutional: { score: institutional?.institutional_score, confidence: institutional?.institutional_confidence, health: institutional?.institutional_confidence, at: institutional?.calculated_at },
    broker_liquidity: { score: broker?.summary?.overallLiquidityScore, confidence: broker?.summary?.liquidityConfidenceScore ?? broker?.summary?.overallLiquidityScore, health: broker?.summary?.overallLiquidityScore, at: broker?.summary?.lastLiquidityCheck },
    portfolio: { score: portfolio?.summary?.portfolioHealthScore, confidence: portfolio?.summary?.portfolioHealthScore, health: portfolio?.summary?.portfolioHealthScore, at: portfolio?.summary?.lastPortfolioSync },
    economic_calendar: { score: null, confidence: null, health: null, at: null },
    news_sentiment: { score: null, confidence: null, health: null, at: null },
    social_sentiment: { score: social?.score, confidence: social?.confidence, health: social?.confidence, at: social?.observed_at },
    historical_data: { score: coverage?.score, confidence: coverage?.score, health: coverage?.score, at: null },
    broker_data: { score: broker?.summary?.connectedBrokerFeeds ? 85 : null, confidence: broker?.summary?.connectedBrokerFeeds ? 85 : null, health: broker?.summary?.connectedBrokerFeeds ? 85 : null, at: broker?.summary?.lastLiquidityCheck },
    account_portfolio: { score: portfolio?.summary?.activeAccounts ? portfolio?.summary?.portfolioHealthScore : null, confidence: portfolio?.summary?.portfolioHealthScore, health: portfolio?.summary?.portfolioHealthScore, at: portfolio?.summary?.lastPortfolioSync },
    prop_firm_rules: { score: portfolio?.propCompliance?.length ? avg(portfolio.propCompliance.map((row) => 100 - Number(row.breachRisk || 0))) : null, confidence: null, health: null, at: portfolio?.summary?.lastPortfolioSync },
    cot_reports: { score: cot ? textScore(cot.cot_bias) : null, confidence: cot ? 70 : null, health: cot ? 70 : null, at: cot?.observed_at },
    source_health: { score: sourceHealth?.score, confidence: sourceHealth?.score, health: sourceHealth?.score, at: sourceHealth?.observed_at },
    dependency_matrix: { score: dependency?.score, confidence: dependency?.score, health: dependency?.score, at: dependency?.calculated_at },
    scoring_engine_inputs: { score: scoring?.model ? 100 : null, confidence: scoring?.model ? 100 : null, health: scoring?.model ? 100 : null, at: scoring?.model?.activated_at }
  };
  return {
    modules: MODULES.map(([moduleKey, moduleLabel, required]) => {
      const data = moduleData[moduleKey] || {};
      const fresh = freshness(data.at);
      const complete = data.score == null ? null : 100;
      return {
        moduleKey,
        moduleLabel,
        status: data.score == null ? "Insufficient Data" : "Passed",
        freshness: fresh.label,
        freshnessScore: fresh.score,
        confidence: pct(data.confidence),
        completeness: complete,
        health: pct(data.health),
        required,
        sourceTimestamp: data.at || null,
        payload: { score: pct(data.score) }
      };
    })
  };
}

export async function getPackageBuilderSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { rows } = await safeQuery(`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= $1)::int AS built_today,
      COUNT(*) FILTER (WHERE status = 'Draft')::int AS drafts,
      COUNT(*) FILTER (WHERE status = 'Validated')::int AS validated,
      COUNT(*) FILTER (WHERE status = 'Failed Validation')::int AS failed,
      COUNT(*) FILTER (WHERE scoring_status = 'Pending Scoring')::int AS pending_scoring,
      COUNT(*) FILTER (WHERE status = 'Submitted to Scoring')::int AS submitted,
      avg(completeness_score)::numeric AS avg_completeness,
      avg(confidence)::numeric AS avg_confidence,
      (SELECT status FROM market.intelligence_packages ORDER BY created_at DESC LIMIT 1) AS latest_status
    FROM market.intelligence_packages
  `, [today.toISOString()]);
  const modules = await getPackageBuilderModules();
  const missing = modules.modules.filter((row) => row.required && row.status !== "Passed").length;
  const row = rows[0] || {};
  return {
    packagesBuiltToday: row.built_today || 0,
    draftPackages: row.drafts || 0,
    validatedPackages: row.validated || 0,
    failedValidations: row.failed || 0,
    pendingScoring: row.pending_scoring || 0,
    submittedToScoring: row.submitted || 0,
    averageCompleteness: pct(row.avg_completeness),
    averageConfidence: pct(row.avg_confidence),
    latestPackageStatus: row.latest_status || "No Packages",
    requiredInputsMissing: missing
  };
}

function readinessLabel(score) {
  if (score == null) return "Insufficient Data";
  if (score >= 90) return "Ready for Scoring";
  if (score >= 75) return "Ready with Warnings";
  if (score >= 60) return "Review Required";
  if (score >= 40) return "Incomplete";
  return "Blocked";
}

function validatePackage({ modules, instruments, packageType }) {
  const included = modules.filter((row) => row.included !== false);
  const required = included.filter((row) => row.required);
  const checks = [
    { checkName: "Package type selected", status: PACKAGE_TYPES.includes(packageType) ? "Passed" : "Blocked", severity: "High", detail: packageType || "No package type selected." },
    { checkName: "Production instruments selected", status: instruments.length ? "Passed" : "Blocked", severity: "High", detail: `${instruments.length} instrument(s) selected.` },
    { checkName: "Required modules available", status: required.every((row) => row.status === "Passed") ? "Passed" : "Failed", severity: "High", detail: `${required.filter((row) => row.status !== "Passed").length} required module(s) missing.` },
    { checkName: "Data freshness acceptable", status: required.every((row) => row.freshnessScore == null || row.freshnessScore >= 50) ? "Passed" : "Warning", severity: "Medium", detail: "Freshness is evaluated per included module." },
    { checkName: "Source health acceptable", status: required.every((row) => row.health == null || row.health >= 60) ? "Passed" : "Warning", severity: "Medium", detail: "Required input source health threshold is 60%." },
    { checkName: "No critical dependency failure", status: included.some((row) => row.moduleKey === "dependency_matrix" && row.health != null && row.health < 50) ? "Failed" : "Passed", severity: "High", detail: "Dependency Matrix checked." },
    { checkName: "Broker source connected", status: included.some((row) => row.moduleKey === "broker_liquidity" && row.status === "Passed") ? "Passed" : "Warning", severity: "Medium", detail: "Broker Liquidity checked." },
    { checkName: "Portfolio input complete", status: included.some((row) => row.moduleKey === "account_portfolio" && row.status === "Passed") ? "Passed" : "Warning", severity: "Medium", detail: "Account Portfolio checked." },
    { checkName: "Prop firm compliance valid", status: included.some((row) => row.moduleKey === "prop_firm_rules") ? (included.find((row) => row.moduleKey === "prop_firm_rules")?.status === "Passed" ? "Passed" : "Insufficient Data") : "Passed", severity: "Medium", detail: "Prop firm rules are optional unless selected." }
  ];
  const completenessScore = avg(included.map((row) => row.completeness));
  const confidenceScore = avg(included.map((row) => row.confidence));
  const freshnessScore = avg(included.map((row) => row.freshnessScore));
  const sourceHealthScore = avg(included.map((row) => row.health));
  const dependencyRiskScore = included.find((row) => row.moduleKey === "dependency_matrix")?.health == null ? null : pct(100 - included.find((row) => row.moduleKey === "dependency_matrix").health);
  const conflicts = detectConflicts(included, instruments, packageType);
  const conflictScore = conflicts.length ? pct(Math.max(0, 100 - conflicts.reduce((sum, row) => sum + { Low: 5, Medium: 15, High: 30, Critical: 50 }[row.severity], 0))) : 100;
  const readinessScore = avg([completenessScore, confidenceScore, freshnessScore, sourceHealthScore, dependencyRiskScore == null ? null : 100 - dependencyRiskScore, conflictScore]);
  const blocked = checks.some((row) => ["Blocked", "Failed"].includes(row.status)) || conflicts.some((row) => row.severity === "Critical");
  return {
    checks,
    conflicts,
    scores: { completenessScore, confidenceScore, freshnessScore, sourceHealthScore, dependencyRiskScore, conflictScore, readinessScore },
    validationStatus: blocked ? "Failed Validation" : readinessScore >= 75 ? "Validated" : "Validation Pending",
    readinessLabel: readinessLabel(readinessScore)
  };
}

function detectConflicts(modules, instruments, packageType) {
  const byKey = Object.fromEntries(modules.map((row) => [row.moduleKey, row]));
  const conflicts = [];
  if ((byKey.macro?.payload?.score || 50) >= 70 && (byKey.sentiment?.payload?.score || 50) <= 30) {
    conflicts.push({ conflictType: "Macro bullish but sentiment bearish", affectedInstrument: instruments[0] || null, modulesInvolved: ["Macro Intelligence", "Sentiment Intelligence"], severity: "High", description: "Macro conditions and sentiment alignment disagree.", resolutionRecommendation: "Wait for sentiment confirmation or reduce package readiness.", status: "Open" });
  }
  if ((byKey.institutional?.payload?.score || 50) >= 70 && (byKey.broker_liquidity?.health || 100) < 50) {
    conflicts.push({ conflictType: "Institutional bullish but broker liquidity poor", affectedInstrument: instruments[0] || null, modulesInvolved: ["Institutional Intelligence", "Broker Liquidity"], severity: "High", description: "Institutional bias is positive but execution quality is weak.", resolutionRecommendation: "Do not submit active trade package until liquidity improves.", status: "Open" });
  }
  if ((byKey.market_environment?.payload?.score || 50) >= 70 && (byKey.portfolio?.health || 100) < 50) {
    conflicts.push({ conflictType: "Tradeable environment but portfolio risk high", affectedInstrument: instruments[0] || null, modulesInvolved: ["Market Environment", "Portfolio Intelligence"], severity: "Critical", description: "The market may be tradeable, but portfolio risk is elevated.", resolutionRecommendation: "Reduce risk or rebalance before scoring.", status: "Open" });
  }
  if (/Opportunity|Full Decision/i.test(packageType) && byKey.news_sentiment?.status !== "Passed") {
    conflicts.push({ conflictType: "Active trading requested without current news risk", affectedInstrument: instruments[0] || null, modulesInvolved: ["News Sentiment"], severity: "Medium", description: "News risk input is missing for an active trading package.", resolutionRecommendation: "Connect news sentiment or validate manually before scoring.", status: "Open" });
  }
  if (byKey.source_health?.health != null && byKey.source_health.health < 60) {
    conflicts.push({ conflictType: "Source health degraded for required input", affectedInstrument: null, modulesInvolved: ["Source Health Review"], severity: "High", description: "Required source health is degraded.", resolutionRecommendation: "Run Source Health Review and resolve degraded adapters.", status: "Open" });
  }
  return conflicts;
}

function aiSummary({ packageType, instruments, modules, validation }) {
  const missing = modules.filter((row) => row.required && row.status !== "Passed").map((row) => row.moduleLabel);
  const bullish = modules.filter((row) => Number(row.payload?.score) >= 70).map((row) => row.moduleLabel);
  const bearish = modules.filter((row) => Number(row.payload?.score) <= 30).map((row) => row.moduleLabel);
  const risks = validation.conflicts.map((row) => row.description);
  return {
    summary: `${packageType} contains ${instruments.length} production instrument(s) and ${modules.length} included intelligence module(s). Readiness is ${validation.readinessLabel}.`,
    bullishFactors: bullish,
    bearishFactors: bearish,
    missingInputs: missing,
    riskWarnings: risks,
    readyForScoring: validation.validationStatus === "Validated" && Number(validation.scores.readinessScore) >= 75 && !validation.conflicts.some((row) => row.severity === "Critical")
  };
}

function normalizeBuildInput(input, modules, instruments) {
  const selectedModules = new Set(Array.isArray(input.modules) && input.modules.length ? input.modules : modules.modules.map((row) => row.moduleKey));
  const selectedInstruments = Array.isArray(input.instruments) && input.instruments.length ? input.instruments : instruments.instruments.slice(0, 20).map((row) => row.key);
  return {
    packageType: PACKAGE_TYPES.includes(input.packageType) ? input.packageType : "Full Decision Package",
    instruments: selectedInstruments.filter((key) => instruments.instruments.some((row) => row.key === key)),
    modules: modules.modules.filter((row) => selectedModules.has(row.moduleKey)).map((row) => ({ ...row, included: true }))
  };
}

export async function buildIntelligencePackage(input = {}, actor = "api") {
  const [modules, instruments] = await Promise.all([getPackageBuilderModules(), getPackageBuilderInstruments()]);
  const normalized = normalizeBuildInput(input, modules, instruments);
  const validation = validatePackage(normalized);
  const summary = aiSummary({ ...normalized, validation });
  const id = packageId();
  const packageStatus = STATUSES.includes(input.status) && input.status === "Draft" ? "Draft" : validation.validationStatus;
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO market.intelligence_packages (
        package_id, package_type, status, confidence, completeness_score, freshness_score, source_health_score,
        dependency_risk_score, conflict_score, readiness_score, validation_status, payload, generated_at, built_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,now(),$13)`,
      [id, normalized.packageType, packageStatus, validation.scores.confidenceScore, validation.scores.completenessScore, validation.scores.freshnessScore, validation.scores.sourceHealthScore, validation.scores.dependencyRiskScore, validation.scores.conflictScore, validation.scores.readinessScore, validation.validationStatus, JSON.stringify({ instruments: normalized.instruments, modules: normalized.modules.map((row) => row.moduleKey), scores: validation.scores }), actor]
    );
    for (const instrument of normalized.instruments) {
      await client.query("INSERT INTO market.intelligence_package_items (package_id, item_type, item_key, item_label) VALUES ($1,'instrument',$2,$2)", [id, instrument]);
    }
    for (const row of normalized.modules) {
      await client.query(
        `INSERT INTO market.intelligence_package_modules (
          package_id, module_key, module_label, status, freshness, confidence, completeness, health, required, source_timestamp, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [id, row.moduleKey, row.moduleLabel, row.status, row.freshness, row.confidence, row.completeness, row.health, row.required, row.sourceTimestamp, JSON.stringify(row.payload || {})]
      );
      await client.query("INSERT INTO market.intelligence_package_input_snapshots (package_id, module_key, snapshot) VALUES ($1,$2,$3::jsonb)", [id, row.moduleKey, JSON.stringify(row)]);
    }
    for (const row of validation.checks) {
      await client.query("INSERT INTO market.intelligence_package_validation_results (package_id, check_name, status, severity, detail, payload) VALUES ($1,$2,$3,$4,$5,$6::jsonb)", [id, row.checkName, row.status, row.severity, row.detail, JSON.stringify(row)]);
    }
    for (const row of validation.conflicts) {
      await client.query("INSERT INTO market.intelligence_package_conflicts (package_id, conflict_type, affected_instrument, modules_involved, severity, description, resolution_recommendation, status) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)", [id, row.conflictType, row.affectedInstrument, JSON.stringify(row.modulesInvolved), row.severity, row.description, row.resolutionRecommendation, row.status]);
    }
    await client.query("INSERT INTO market.intelligence_package_ai_summaries (package_id, summary, bullish_factors, bearish_factors, missing_inputs, risk_warnings, ready_for_scoring, created_by) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8)", [id, summary.summary, JSON.stringify(summary.bullishFactors), JSON.stringify(summary.bearishFactors), JSON.stringify(summary.missingInputs), JSON.stringify(summary.riskWarnings), summary.readyForScoring, actor]);
    await client.query("INSERT INTO market.intelligence_package_audit_logs (package_id, actor, action, payload) VALUES ($1,$2,'build_package',$3::jsonb)", [id, actor, JSON.stringify({ packageType: normalized.packageType })]);
  });
  return getPackageBuilderDetail(id);
}

async function packageRows(limit = 50) {
  const { rows } = await safeQuery(`
    SELECT p.*,
      (SELECT array_agg(item_key ORDER BY item_key) FROM market.intelligence_package_items WHERE package_id = p.package_id AND item_type = 'instrument') AS instruments,
      (SELECT array_agg(module_label ORDER BY module_label) FROM market.intelligence_package_modules WHERE package_id = p.package_id) AS modules
    FROM market.intelligence_packages p
    WHERE p.archived_at IS NULL
    ORDER BY p.created_at DESC
    LIMIT $1
  `, [limit]);
  return rows.map((row) => ({
    id: row.package_id,
    packageId: row.package_id,
    packageType: row.package_type,
    instruments: row.instruments || [],
    includedModules: row.modules || [],
    completeness: pct(row.completeness_score),
    confidence: pct(row.confidence),
    readiness: pct(row.readiness_score),
    status: row.status,
    builtBy: row.built_by,
    builtAt: row.generated_at || row.created_at,
    submittedAt: row.submitted_at,
    scoringStatus: row.scoring_status,
    actions: ["Open", "Validate", "Clone", "Submit to Scoring", "Export", "Archive"]
  }));
}

export async function getPackageBuilderHistory() {
  return { packages: await packageRows() };
}

export async function getPackageBuilderDetail(id) {
  const { rows } = await safeQuery("SELECT * FROM market.intelligence_packages WHERE package_id = $1 LIMIT 1", [id]);
  const row = rows[0];
  if (!row) return null;
  const [items, modules, snapshots, validations, conflicts, summaries, submissions, auditRows] = await Promise.all([
    safeQuery("SELECT * FROM market.intelligence_package_items WHERE package_id = $1 ORDER BY item_type, item_label", [id]),
    safeQuery("SELECT * FROM market.intelligence_package_modules WHERE package_id = $1 ORDER BY required DESC, module_label", [id]),
    safeQuery("SELECT * FROM market.intelligence_package_input_snapshots WHERE package_id = $1 ORDER BY captured_at DESC", [id]),
    safeQuery("SELECT * FROM market.intelligence_package_validation_results WHERE package_id = $1 ORDER BY created_at DESC", [id]),
    safeQuery("SELECT * FROM market.intelligence_package_conflicts WHERE package_id = $1 ORDER BY severity DESC, created_at DESC", [id]),
    safeQuery("SELECT * FROM market.intelligence_package_ai_summaries WHERE package_id = $1 ORDER BY created_at DESC LIMIT 1", [id]),
    safeQuery("SELECT * FROM market.intelligence_package_scoring_submissions WHERE package_id = $1 ORDER BY submitted_at DESC", [id]),
    safeQuery("SELECT * FROM market.intelligence_package_audit_logs WHERE package_id = $1 ORDER BY created_at DESC", [id])
  ]);
  return {
    metadata: {
      packageId: row.package_id,
      packageType: row.package_type,
      status: row.status,
      version: row.version,
      builtBy: row.built_by,
      builtAt: row.generated_at || row.created_at,
      validatedAt: row.validated_at,
      submittedAt: row.submitted_at,
      scoringStatus: row.scoring_status
    },
    selectedInstruments: items.rows.filter((item) => item.item_type === "instrument").map((item) => item.item_key),
    moduleInputs: modules.rows.map((item) => ({
      moduleKey: item.module_key,
      moduleLabel: item.module_label,
      status: item.status,
      freshness: item.freshness,
      confidence: pct(item.confidence),
      completeness: pct(item.completeness),
      health: pct(item.health),
      required: item.required,
      sourceTimestamp: item.source_timestamp
    })),
    inputSnapshots: snapshots.rows.map((item) => ({ moduleKey: item.module_key, capturedAt: item.captured_at, snapshot: item.snapshot })),
    validationResults: validations.rows.map((item) => ({ checkName: item.check_name, status: item.status, severity: item.severity, detail: item.detail, createdAt: item.created_at })),
    conflictResults: conflicts.rows.map((item) => ({ conflictType: item.conflict_type, affectedInstrument: item.affected_instrument, modulesInvolved: item.modules_involved, severity: item.severity, description: item.description, resolutionRecommendation: item.resolution_recommendation, status: item.status })),
    aiSummary: summaries.rows[0] ? {
      summary: summaries.rows[0].summary,
      bullishFactors: summaries.rows[0].bullish_factors,
      bearishFactors: summaries.rows[0].bearish_factors,
      missingInputs: summaries.rows[0].missing_inputs,
      riskWarnings: summaries.rows[0].risk_warnings,
      readyForScoring: summaries.rows[0].ready_for_scoring
    } : null,
    readinessScore: pct(row.readiness_score),
    scoringSubmissionStatus: row.scoring_status,
    scoringSubmissions: submissions.rows,
    auditTrail: auditRows.rows,
    payload: row.payload
  };
}

export async function validateIntelligencePackage(input = {}, actor = "api") {
  if (input.packageId) return revalidateIntelligencePackage(input.packageId, actor);
  return buildIntelligencePackage({ ...input, status: "Validation Pending" }, actor);
}

export async function revalidateIntelligencePackage(id, actor = "api") {
  const detail = await getPackageBuilderDetail(id);
  if (!detail) throw new Error("package_not_found");
  const modules = { modules: (await getPackageBuilderModules()).modules.filter((row) => detail.moduleInputs.some((item) => item.moduleKey === row.moduleKey)) };
  const instruments = { instruments: (await getPackageBuilderInstruments()).instruments };
  const normalized = normalizeBuildInput({ packageType: detail.metadata.packageType, instruments: detail.selectedInstruments, modules: detail.moduleInputs.map((row) => row.moduleKey) }, modules, instruments);
  const validation = validatePackage(normalized);
  await withTransaction(async (client) => {
    await client.query("DELETE FROM market.intelligence_package_validation_results WHERE package_id = $1", [id]);
    await client.query("DELETE FROM market.intelligence_package_conflicts WHERE package_id = $1", [id]);
    for (const row of validation.checks) {
      await client.query("INSERT INTO market.intelligence_package_validation_results (package_id, check_name, status, severity, detail, payload) VALUES ($1,$2,$3,$4,$5,$6::jsonb)", [id, row.checkName, row.status, row.severity, row.detail, JSON.stringify(row)]);
    }
    for (const row of validation.conflicts) {
      await client.query("INSERT INTO market.intelligence_package_conflicts (package_id, conflict_type, affected_instrument, modules_involved, severity, description, resolution_recommendation, status) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)", [id, row.conflictType, row.affectedInstrument, JSON.stringify(row.modulesInvolved), row.severity, row.description, row.resolutionRecommendation, row.status]);
    }
    await client.query(`UPDATE market.intelligence_packages SET status = $2, validation_status = $2, validated_at = now(), completeness_score = $3, confidence = $4, freshness_score = $5, source_health_score = $6, dependency_risk_score = $7, conflict_score = $8, readiness_score = $9 WHERE package_id = $1`, [id, validation.validationStatus, validation.scores.completenessScore, validation.scores.confidenceScore, validation.scores.freshnessScore, validation.scores.sourceHealthScore, validation.scores.dependencyRiskScore, validation.scores.conflictScore, validation.scores.readinessScore]);
    await client.query("INSERT INTO market.intelligence_package_audit_logs (package_id, actor, action, payload) VALUES ($1,$2,'revalidate_package',$3::jsonb)", [id, actor, JSON.stringify(validation.scores)]);
  });
  return getPackageBuilderDetail(id);
}

export async function submitPackageToScoring(id, actor = "api") {
  const detail = await getPackageBuilderDetail(id);
  if (!detail) throw new Error("package_not_found");
  const scoring = await getScoringEngineModel();
  const critical = detail.conflictResults.some((row) => row.severity === "Critical" && row.status !== "Resolved");
  const failed = detail.validationResults.some((row) => ["Failed", "Blocked"].includes(row.status));
  const ready = detail.metadata.status === "Validated" && Number(detail.readinessScore) >= 75 && !critical && !failed && scoring.model;
  if (!ready) {
    await audit(id, "submit_to_scoring_blocked", { status: detail.metadata.status, readinessScore: detail.readinessScore, critical, failed, scoringModelActive: Boolean(scoring.model) }, actor, "blocked");
    return { accepted: false, blocked: true, message: "Package cannot be submitted to scoring because required validation checks failed.", detail };
  }
  await withTransaction(async (client) => {
    await client.query("INSERT INTO market.intelligence_package_scoring_submissions (package_id, scoring_model_id, status, submitted_by, response) VALUES ($1,$2,'Pending Scoring',$3,$4::jsonb)", [id, scoring.model?.version_id || null, actor, JSON.stringify({ route: "/api/market-intelligence/scoring-engine" })]);
    await client.query("UPDATE market.intelligence_packages SET status = 'Submitted to Scoring', scoring_status = 'Pending Scoring', submitted_at = now() WHERE package_id = $1", [id]);
    await client.query("INSERT INTO market.intelligence_package_audit_logs (package_id, actor, action, payload) VALUES ($1,$2,'submit_to_scoring',$3::jsonb)", [id, actor, JSON.stringify({ scoringModel: scoring.model?.model_version })]);
  });
  return { accepted: true, packageId: id, scoringStatus: "Pending Scoring" };
}

export async function cloneIntelligencePackage(id, actor = "api") {
  const detail = await getPackageBuilderDetail(id);
  if (!detail) throw new Error("package_not_found");
  return buildIntelligencePackage({ packageType: detail.metadata.packageType, instruments: detail.selectedInstruments, modules: detail.moduleInputs.map((row) => row.moduleKey) }, actor);
}

export async function archiveIntelligencePackage(id, actor = "api") {
  await safeQuery("UPDATE market.intelligence_packages SET status = 'Archived', archived_at = now() WHERE package_id = $1", [id]);
  await audit(id, "archive_package", {}, actor);
  return { accepted: true, packageId: id, status: "Archived" };
}

export async function exportIntelligencePackage(id) {
  const detail = await getPackageBuilderDetail(id);
  if (!detail) throw new Error("package_not_found");
  return { exportedAt: new Date().toISOString(), sourceMode: "PRODUCTION_LIVE_ONLY", mockDataDisabled: true, package: detail };
}

export async function getPackageBuilderDashboard() {
  const [summary, types, instruments, modules, history] = await Promise.all([
    getPackageBuilderSummary(),
    Promise.resolve({ packageTypes: PACKAGE_TYPES }),
    getPackageBuilderInstruments(),
    getPackageBuilderModules(),
    getPackageBuilderHistory()
  ]);
  const latest = history.packages[0] ? await getPackageBuilderDetail(history.packages[0].packageId) : null;
  return {
    page: "package-builder",
    title: "Market Intelligence Package Builder",
    subtitle: "Assemble, validate, enrich, and package live intelligence data into structured decision-ready packages for scoring, analysis, and trading workflows.",
    sourceMode: "PRODUCTION_LIVE_ONLY",
    mockDataDisabled: true,
    permissions: [
      "market_intelligence.package_builder.view",
      "market_intelligence.package_builder.build",
      "market_intelligence.package_builder.validate",
      "market_intelligence.package_builder.submit_to_scoring",
      "market_intelligence.package_builder.export",
      "market_intelligence.package_builder.archive",
      "market_intelligence.package_builder.configure"
    ],
    badges: {
      productionLive: true,
      mockDataDisabled: true,
      liveInputsOnly: true,
      lastPackageBuild: history.packages[0]?.builtAt || null,
      packageValidationStatus: history.packages[0]?.status || "No Packages"
    },
    summary,
    workflow: ["Select Package Type", "Select Instruments", "Select Intelligence Modules", "Validate Inputs", "Review Conflicts", "Build Package", "Submit to Scoring Engine"],
    packageTypes: types.packageTypes,
    instruments: instruments.instruments,
    modules: modules.modules,
    validationPanel: latest?.validationResults || [],
    conflictReview: latest?.conflictResults || [],
    packagePreview: latest,
    aiSummary: latest?.aiSummary || null,
    history: history.packages,
    emptyState: history.packages.length ? null : {
      title: "No intelligence packages have been built yet.",
      message: "Create a package using live market intelligence inputs and validate it before submitting to the scoring engine.",
      actions: ["Build New Package", "Open Scoring Engine", "Open Dependency Matrix", "Run Source Health Review"]
    },
    statuses: STATUSES
  };
}
