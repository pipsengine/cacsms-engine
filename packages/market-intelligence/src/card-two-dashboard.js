import { isDatabaseConfigured, query, withTransaction } from "./db.js";

const REQUIRED_TABLES = [
  "workflow.card_inputs",
  "workflow.card_outputs",
  "workflow.card_handoffs",
  "market.market_intelligence",
  "market.intelligence_scores",
  "market.intelligence_packages",
  "market.intelligence_logs"
];

const PIPELINE = [
  ["card_1", "Card 1"],
  ["validated_package", "Validated Intelligence Package"],
  ["market_environment", "Market Environment Intelligence"],
  ["macro", "Macro Intelligence"],
  ["sentiment", "Sentiment Intelligence"],
  ["institutional", "Institutional Intelligence"],
  ["broker", "Broker Intelligence"],
  ["portfolio", "Portfolio Intelligence"],
  ["scoring", "Scoring Engine"],
  ["market_package", "Market Intelligence Package"],
  ["card_3", "Card 3"]
];

const SCORE_LABELS = {
  market_intelligence: "Market Intelligence Score",
  macro_risk: "Macro Risk Score",
  sentiment: "Sentiment Score",
  institutional: "Institutional Score",
  liquidity: "Liquidity Score",
  portfolio_risk: "Portfolio Risk Score",
  confidence: "Confidence Score",
  readiness: "Overall Readiness Score"
};

const SOURCE_LABELS = [
  ["market-data", "Market Data"],
  ["news-sentiment", "News Sources"],
  ["economic-calendar", "Economic Calendar"],
  ["social-sentiment", "Social Sentiment"],
  ["institutional-cot", "Institutional COT"],
  ["historical-data", "Historical Data"],
  ["broker-data", "Broker Data"],
  ["account-portfolio", "Portfolio Data"],
  ["prop-firm-rules", "Prop Firm Rules"]
];

const asNumber = value => value === null || value === undefined ? null : Number(value);
const pct = value => value === null || value === undefined ? null : Math.round(Number(value));
const latest = rows => rows[0] || null;
const j = value => value && typeof value === "object" ? value : {};
const arr = value => Array.isArray(value) ? value : [];

function emptyDashboard(status, message) {
  return {
    sourceMode: "DATABASE_ONLY",
    status,
    message,
    schemaReady: false,
    workflow: {
      runId: null,
      cardNumber: "02",
      cardName: "Market Intelligence Gathering",
      inputSource: "Card 1",
      outputTarget: "Card 3",
      currentState: status
    },
    kpis: [],
    inputPackage: { status: "WAITING_FOR_INPUT", sources: [] },
    pipeline: PIPELINE.map(([id, name]) => ({ id, name, status: "WAITING", progress: null, duration: null, confidence: null })),
    summaries: {},
    scores: [],
    outputPackage: null,
    acceptance: [],
    auditEvents: []
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
  const { rows } = await query(`
    SELECT r.id, r.run_key, r.workflow_id, r.status, r.current_stage, r.created_at, r.updated_at,
           s.id AS stage_id, s.status AS stage_status, s.started_at AS stage_started_at,
           s.completed_at AS stage_completed_at, s.confidence_score, s.duration_ms, s.input_payload, s.output_payload
    FROM workflow.workflow_runs r
    LEFT JOIN workflow.workflow_stages s
      ON s.run_id = r.id AND (s.stage_order = 2 OR s.stage_key IN ('market_intelligence_gathering', 'market-intelligence-gathering'))
    ORDER BY r.created_at DESC
    LIMIT 1
  `);
  return latest(rows);
}

async function latestCardInput(runId) {
  const params = [];
  let where = "card_number = 2";
  if (runId) {
    params.push(runId);
    where += " AND run_id = $1";
  }
  const { rows } = await query(`SELECT * FROM workflow.card_inputs WHERE ${where} ORDER BY created_at DESC LIMIT 1`, params);
  return latest(rows);
}

async function latestCardOutput(runId) {
  const params = [];
  let where = "card_number = 2";
  if (runId) {
    params.push(runId);
    where += " AND run_id = $1";
  }
  const { rows } = await query(`SELECT * FROM workflow.card_outputs WHERE ${where} ORDER BY created_at DESC LIMIT 1`, params);
  return latest(rows);
}

async function latestPackage(runId) {
  const params = [];
  let where = "TRUE";
  if (runId) {
    params.push(runId);
    where += " AND run_id = $1";
  }
  const { rows } = await query(`SELECT * FROM market.intelligence_packages WHERE ${where} ORDER BY created_at DESC LIMIT 1`, params);
  return latest(rows);
}

async function scoreRows(runId) {
  if (!runId) return [];
  const { rows } = await query(`
    SELECT DISTINCT ON (score_key) score_key, score_label, score_value, status, payload, calculated_at
    FROM market.intelligence_scores
    WHERE run_id = $1
    ORDER BY score_key, calculated_at DESC
  `, [runId]);
  return rows;
}

async function intelligenceRows(runId) {
  if (!runId) return [];
  const { rows } = await query(`
    SELECT source, sentiment, confidence, payload, created_at
    FROM market.market_intelligence
    WHERE run_id = $1
    ORDER BY created_at DESC
    LIMIT 100
  `, [runId]);
  return rows;
}

async function logRows(runId) {
  if (!runId) return [];
  const { rows } = await query(`
    SELECT created_at AS timestamp, event, source, severity, status, payload
    FROM market.intelligence_logs
    WHERE run_id = $1
    ORDER BY created_at DESC
    LIMIT 30
  `, [runId]);
  return rows;
}

function sourceRows(input) {
  const payload = j(input?.payload);
  const sources = arr(payload.sources);
  if (sources.length) {
    return sources.map(source => ({
      id: source.id || source.routeSlug || source.source,
      source: source.name || source.source || source.id || "Unknown Source",
      status: source.status || "UNKNOWN",
      freshness: source.freshness || source.freshnessStatus || "UNKNOWN",
      health: pct(source.healthScore ?? source.health),
      coverage: source.coverage ?? source.records ?? null,
      confidence: pct(source.confidence ?? source.confidenceScore ?? source.healthScore)
    }));
  }
  return SOURCE_LABELS.map(([id, source]) => ({ id, source, status: "NO_DATABASE_RECORD", freshness: null, health: null, coverage: null, confidence: null }));
}

function scoreMap(scores) {
  return Object.fromEntries(scores.map(score => [score.score_key, asNumber(score.score_value)]));
}

function scoreCards(scores) {
  const byKey = new Map(scores.map(score => [score.score_key, score]));
  return Object.entries(SCORE_LABELS).map(([key, label]) => {
    const score = byKey.get(key);
    return {
      key,
      label: score?.score_label || label,
      value: pct(score?.score_value),
      status: score?.status || "PENDING",
      calculatedAt: score?.calculated_at || null
    };
  });
}

function pipelineRows(stage, intelligence, scores, outputPackage) {
  const scoreByKey = scoreMap(scores);
  const sourceStatus = Object.fromEntries(intelligence.map(row => [row.source, row]));
  return PIPELINE.map(([id, name], index) => {
    const stored = sourceStatus[id] || sourceStatus[name] || null;
    const isOutput = id === "market_package";
    const isInput = id === "validated_package" || id === "card_1";
    const confidence = pct(stored?.confidence ?? scoreByKey[id] ?? (id === "scoring" ? scoreByKey.confidence : null));
    return {
      id,
      name,
      status: isOutput && outputPackage ? outputPackage.status : stored?.payload?.status || (isInput && stage ? "INPUT_RECEIVED" : "WAITING"),
      progress: stored?.payload?.progress ?? (isOutput && outputPackage ? 100 : null),
      duration: stored?.payload?.duration || (index === 0 ? stage?.duration_ms : null),
      confidence
    };
  });
}

function summaryValue(rows, source, key) {
  const row = rows.find(item => item.source === source || item.payload?.module === source);
  return row?.payload?.[key] ?? null;
}

function summaries(rows) {
  return {
    marketEnvironment: {
      currentSession: summaryValue(rows, "market_environment", "currentSession"),
      sessionOverlap: summaryValue(rows, "market_environment", "sessionOverlap"),
      volatilityState: summaryValue(rows, "market_environment", "volatilityState"),
      trendState: summaryValue(rows, "market_environment", "trendState"),
      marketRegime: summaryValue(rows, "market_environment", "marketRegime"),
      correlationState: summaryValue(rows, "market_environment", "correlationState"),
      riskEnvironment: summaryValue(rows, "market_environment", "riskEnvironment")
    },
    macro: {
      highImpactEventsToday: summaryValue(rows, "macro", "highImpactEventsToday"),
      upcomingEvents: summaryValue(rows, "macro", "upcomingEvents"),
      centralBankEvents: summaryValue(rows, "macro", "centralBankEvents"),
      interestRateContext: summaryValue(rows, "macro", "interestRateContext"),
      inflationContext: summaryValue(rows, "macro", "inflationContext"),
      riskLevel: summaryValue(rows, "macro", "riskLevel")
    },
    sentiment: {
      newsSentiment: summaryValue(rows, "sentiment", "newsSentiment"),
      socialSentiment: summaryValue(rows, "sentiment", "socialSentiment"),
      riskTone: summaryValue(rows, "sentiment", "riskTone"),
      currencyMatrix: summaryValue(rows, "sentiment", "currencyMatrix"),
      overallMood: summaryValue(rows, "sentiment", "overallMood")
    },
    institutional: {
      cotBias: summaryValue(rows, "institutional", "cotBias"),
      positioning: summaryValue(rows, "institutional", "positioning"),
      smartMoneyBias: summaryValue(rows, "institutional", "smartMoneyBias"),
      largeSpeculatorActivity: summaryValue(rows, "institutional", "largeSpeculatorActivity"),
      direction: summaryValue(rows, "institutional", "direction")
    },
    brokerLiquidity: {
      averageSpread: summaryValue(rows, "broker", "averageSpread"),
      executionQuality: summaryValue(rows, "broker", "executionQuality"),
      liquidityQuality: summaryValue(rows, "broker", "liquidityQuality"),
      brokerHealth: summaryValue(rows, "broker", "brokerHealth"),
      marketAccessReadiness: summaryValue(rows, "broker", "marketAccessReadiness")
    },
    portfolio: {
      accountStatus: summaryValue(rows, "portfolio", "accountStatus"),
      exposureLevel: summaryValue(rows, "portfolio", "exposureLevel"),
      marginUsage: summaryValue(rows, "portfolio", "marginUsage"),
      riskLevel: summaryValue(rows, "portfolio", "riskLevel"),
      portfolioReadiness: summaryValue(rows, "portfolio", "portfolioReadiness")
    }
  };
}

function acceptance(inputSources, scores, outputPackage) {
  const scoreByKey = scoreMap(scores);
  const sourceFailures = inputSources.filter(source => !["ONLINE", "LIVE", "SYNCED", "PASSED", "RECEIVED", "READY"].includes(String(source.status).toUpperCase()));
  const checks = [
    ["required_sources", "All required intelligence sources available", sourceFailures.length ? "FAIL" : "PASS"],
    ["market_score", "Market Intelligence Score > 80", asNumber(scoreByKey.market_intelligence) > 80 ? "PASS" : "WARNING"],
    ["confidence", "Confidence Score > 85", asNumber(scoreByKey.confidence) > 85 ? "PASS" : "WARNING"],
    ["freshness", "Data Freshness Acceptable", inputSources.some(source => String(source.freshness || "").toUpperCase().includes("STALE")) ? "WARNING" : "PASS"],
    ["macro", "Macro Context Available", scoreByKey.macro_risk !== undefined ? "PASS" : "WARNING"],
    ["institutional", "Institutional Context Available", scoreByKey.institutional !== undefined ? "PASS" : "WARNING"],
    ["sentiment", "Sentiment Context Available", scoreByKey.sentiment !== undefined ? "PASS" : "WARNING"],
    ["output", "Output Package Generated", outputPackage ? "PASS" : "FAIL"]
  ];
  return checks.map(([id, requirement, status]) => ({ id, requirement, status }));
}

function stateFrom(stage, input, outputPackage) {
  if (outputPackage?.status === "PASSED") return "PASSED";
  if (outputPackage?.status === "FAILED") return "FAILED";
  if (stage?.stage_status === "running") return "PROCESSING";
  if (outputPackage?.status === "VALIDATING") return "VALIDATING";
  if (input?.status && input.status !== "WAITING_FOR_INPUT") return "INPUT_RECEIVED";
  return "WAITING_FOR_INPUT";
}

export async function getCardTwoDashboard() {
  if (!isDatabaseConfigured()) return emptyDashboard("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured. Card 2 dashboard only reads persisted workflow and market intelligence records.");

  const readiness = await tableReadiness();
  if (!readiness.ready) {
    return { ...emptyDashboard("SCHEMA_NOT_READY", `Missing tables: ${readiness.missing.join(", ")}`), missingTables: readiness.missing };
  }

  const run = await latestRun();
  const runId = run?.id || null;
  const [input, output, pkg, scores, intelligence, logs] = await Promise.all([
    latestCardInput(runId),
    latestCardOutput(runId),
    latestPackage(runId),
    scoreRows(runId),
    intelligenceRows(runId),
    logRows(runId)
  ]);
  const inputSources = sourceRows(input);
  const scoreCardsRows = scoreCards(scores);
  const packageRecord = pkg || output;
  const currentState = stateFrom(run, input, packageRecord);
  const completedModules = intelligence.filter(row => ["PASSED", "COMPLETED", "READY"].includes(String(row.payload?.status || "").toUpperCase())).length;

  return {
    sourceMode: "DATABASE_ONLY",
    status: "READY",
    schemaReady: true,
    workflow: {
      runId: run?.workflow_id || run?.run_key || run?.id || null,
      databaseRunId: runId,
      cardNumber: "02",
      cardName: "Market Intelligence Gathering",
      inputSource: "Card 1",
      outputTarget: "Card 3",
      currentState,
      startedAt: run?.stage_started_at || run?.created_at || null,
      updatedAt: run?.updated_at || null
    },
    kpis: [
      ["Input Package Status", input?.status || "WAITING_FOR_INPUT"],
      ["Input Sources Available", `${inputSources.filter(source => !String(source.status).includes("NO_DATABASE")).length}/${inputSources.length}`],
      ["Intelligence Modules Completed", `${completedModules}/${PIPELINE.length - 3}`],
      ["Intelligence Confidence Score", scoreCardsRows.find(score => score.key === "confidence")?.value],
      ["Market Intelligence Score", scoreCardsRows.find(score => score.key === "market_intelligence")?.value],
      ["Data Freshness Score", scoreCardsRows.find(score => score.key === "readiness")?.value],
      ["Workflow Readiness", currentState === "PASSED" ? "READY" : currentState],
      ["Output Package Status", packageRecord?.status || "PENDING"]
    ],
    inputPackage: {
      id: input?.package_id || null,
      status: input?.status || "WAITING_FOR_INPUT",
      receivedAt: input?.received_at || input?.created_at || null,
      sources: inputSources
    },
    pipeline: pipelineRows(run, intelligence, scores, packageRecord),
    summaries: summaries(intelligence),
    scores: scoreCardsRows,
    outputPackage: packageRecord ? {
      packageId: packageRecord.package_id,
      generatedAt: packageRecord.generated_at || packageRecord.created_at,
      version: packageRecord.version || j(packageRecord.payload).version || null,
      confidence: pct(packageRecord.confidence ?? j(packageRecord.payload).confidence),
      status: packageRecord.status,
      payload: packageRecord.payload
    } : null,
    acceptance: acceptance(inputSources, scores, packageRecord),
    auditEvents: logs.map(row => ({
      timestamp: row.timestamp,
      event: row.event,
      source: row.source,
      severity: row.severity,
      status: row.status
    }))
  };
}

export async function runCardTwoAction(action) {
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
  const run = await latestRun();
  if (!run?.id) {
    const error = new Error("workflow_run_not_found");
    error.status = 404;
    throw error;
  }
  const packageId = `MI-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
  return withTransaction(async client => {
    if (action === "generate-package") {
      const { rows } = await client.query(`
        INSERT INTO market.intelligence_packages (run_id, package_id, status, payload, generated_at)
        VALUES ($1, $2, 'PENDING', jsonb_build_object('source', 'card_2_dashboard'), now())
        ON CONFLICT (package_id) DO UPDATE SET generated_at = excluded.generated_at
        RETURNING package_id, status, generated_at
      `, [run.id, packageId]);
      await client.query("INSERT INTO workflow.card_outputs (run_id, card_number, package_id, status, payload, generated_at) VALUES ($1, 2, $2, 'PENDING', $3::jsonb, now())", [run.id, rows[0].package_id, JSON.stringify({ packageId: rows[0].package_id })]);
      await client.query("INSERT INTO market.intelligence_logs (run_id, event, source, severity, status) VALUES ($1, 'Package Generated', 'card_2', 'info', 'RECORDED')", [run.id]);
      return { action, package: rows[0] };
    }
    if (action === "send-to-card-3") {
      const pkg = await latestPackage(run.id);
      if (!pkg) {
        const error = new Error("output_package_not_found");
        error.status = 409;
        throw error;
      }
      const { rows } = await client.query(`
        INSERT INTO workflow.card_handoffs (run_id, from_card_number, to_card_number, package_id, status, payload, handed_off_at)
        VALUES ($1, 2, 3, $2, 'SENT', $3, now())
        RETURNING id, package_id, status, handed_off_at
      `, [run.id, pkg.package_id, JSON.stringify({ unlocks: "20-Asset Universe Scanner" })]);
      await client.query("UPDATE workflow.workflow_stages SET status = 'completed', completed_at = coalesce(completed_at, now()) WHERE run_id = $1 AND stage_order = 2", [run.id]);
      await client.query("UPDATE workflow.workflow_stages SET status = 'pending' WHERE run_id = $1 AND stage_order = 3 AND status = 'blocked'", [run.id]);
      await client.query("INSERT INTO market.intelligence_logs (run_id, event, source, severity, status) VALUES ($1, 'Package Sent To Card 3', 'card_2', 'info', 'SENT')", [run.id]);
      return { action, handoff: rows[0] };
    }
    await client.query("INSERT INTO market.intelligence_logs (run_id, event, source, severity, status, payload) VALUES ($1, $2, 'card_2', 'info', 'RECORDED', $3::jsonb)", [run.id, action, JSON.stringify({ action })]);
    return { action, status: "RECORDED" };
  });
}
