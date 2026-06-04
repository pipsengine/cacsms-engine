import { randomUUID } from "node:crypto";
import { isDatabaseConfigured, query } from "./db.js";
import { ensurePropFirmSchema, isPropFirmSchemaReady } from "./prop-firm-rules-schema.js";
import { fetchLivePortfolioRecords } from "./portfolio-live-data.js";

const VALID_PHASES = new Set(["Phase 1", "Phase 2", "Verification", "Funded", "Instant Funding", "Evaluation", "Challenge"]);
const VALID_ACCOUNT_TYPES = new Set(["Challenge", "Evaluation", "Funded", "Instant Funding"]);

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickMeta(row) {
  const meta = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return meta;
}

export function validatePropFirmInput(body = {}) {
  const errors = [];
  const firmName = String(body.firmName || body.firm_name || "").trim();
  const programName = String(body.programName || body.program_name || "").trim();
  const accountSize = num(body.accountSize ?? body.account_size);
  const profitTarget = num(body.profitTargetPercent ?? body.profit_target_percent) ?? 0;
  const dailyLoss = num(body.dailyLossLimitPercent ?? body.daily_loss_limit_percent);
  const maxDrawdown = num(body.maxDrawdownPercent ?? body.max_drawdown_percent);
  const payoutSplit = body.payoutSplitPercent ?? body.payout_split_percent;
  const minDays = num(body.minTradingDays ?? body.min_trading_days);
  const maxDays = num(body.maxTradingDays ?? body.max_trading_days);
  const phase = String(body.phase || "").trim();

  if (!firmName) errors.push("firm_name_required");
  if (!programName && body.activate) errors.push("program_name_required");
  if (accountSize != null && accountSize <= 0) errors.push("account_size_must_be_positive");
  if (profitTarget < 0) errors.push("profit_target_invalid");
  if (dailyLoss != null && maxDrawdown != null && dailyLoss > maxDrawdown) {
    errors.push("daily_loss_cannot_exceed_max_drawdown");
  }
  if (payoutSplit != null) {
    const split = num(payoutSplit);
    if (split == null || split < 0 || split > 100) errors.push("payout_split_out_of_range");
  }
  if (minDays != null && maxDays != null && maxDays > 0 && minDays > maxDays) {
    errors.push("min_trading_days_exceeds_max");
  }
  if (phase && !VALID_PHASES.has(phase)) errors.push("invalid_phase");

  return { valid: errors.length === 0, errors, firmName, programName };
}

async function writeAuditLog(client, entry) {
  const q = client?.query ? client.query.bind(client) : query;
  await q(
    `INSERT INTO market.prop_firm_audit_logs
      (id, user_id, user_label, action, entity_type, entity_id, before_value, after_value, ip_address, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      randomUUID(),
      entry.userId || null,
      entry.userLabel || "system",
      entry.action,
      entry.entityType,
      entry.entityId || null,
      entry.beforeValue ? JSON.stringify(entry.beforeValue) : null,
      entry.afterValue ? JSON.stringify(entry.afterValue) : null,
      entry.ipAddress || null,
      entry.reason || null
    ]
  );
}

function mapFirmRow(row) {
  const meta = pickMeta(row);
  return {
    id: row.id,
    firmName: row.firm_name,
    website: row.website,
    country: row.country,
    region: row.region,
    supportedPlatforms: row.supported_platforms,
    status: row.status,
    metadata: meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRuleRow(row) {
  const meta = pickMeta(row);
  return {
    id: row.id,
    propFirmId: row.prop_firm_id,
    firmName: row.firm_name,
    programName: row.program_name,
    accountSize: Number(row.account_size),
    currency: row.currency || "USD",
    accountType: row.account_type,
    phase: row.phase,
    profitTargetPercent: row.profit_target_percent != null ? Number(row.profit_target_percent) : null,
    dailyLossLimitPercent: Number(row.daily_loss_limit_percent),
    maxDrawdownPercent: Number(row.max_drawdown_percent),
    drawdownType: row.drawdown_type,
    minTradingDays: row.min_trading_days,
    maxTradingDays: row.max_trading_days,
    newsTradingAllowed: row.news_trading_allowed,
    weekendHoldingAllowed: row.weekend_holding_allowed,
    eaAllowed: row.ea_allowed,
    copyTradingAllowed: row.copy_trading_allowed,
    payoutSplitPercent: row.payout_split_percent != null ? Number(row.payout_split_percent) : null,
    payoutCycle: row.payout_cycle,
    consistencyRule: row.consistency_rule,
    leverage: row.leverage,
    challengeFee: row.challenge_fee != null ? Number(row.challenge_fee) : null,
    status: row.status,
    metadata: meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadRulesFromDb() {
  if (!isDatabaseConfigured()) return [];
  if (!(await isPropFirmSchemaReady())) {
    try {
      await ensurePropFirmSchema();
    } catch {
      return [];
    }
  }
  const { rows } = await query(
    `SELECT r.*, f.firm_name
     FROM market.prop_firm_rules r
     INNER JOIN market.prop_firms f ON f.id = r.prop_firm_id
     ORDER BY f.firm_name, r.program_name NULLS LAST, r.account_size DESC`
  );
  return rows.map(mapRuleRow);
}

async function loadFirmsFromDb() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(`SELECT * FROM market.prop_firms ORDER BY firm_name`);
  return rows.map(mapFirmRow);
}

async function loadPayoutPolicies() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT p.*, f.firm_name
     FROM market.prop_firm_payout_policies p
     INNER JOIN market.prop_firms f ON f.id = p.prop_firm_id`
  ).catch(() => ({ rows: [] }));
  return rows;
}

async function loadScalingPlans() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await query(
    `SELECT s.*, f.firm_name FROM market.prop_firm_scaling_plans s
     INNER JOIN market.prop_firms f ON f.id = s.prop_firm_id`
  ).catch(() => ({ rows: [] }));
  return rows;
}

function buildComparisonMatrix(rules, payouts, scaling) {
  const payoutByFirm = Object.fromEntries(payouts.map((p) => [p.prop_firm_id || p.prop_firm_id, p]));
  const scaleByFirm = Object.fromEntries(scaling.map((s) => [s.prop_firm_id, s]));
  const byFirm = {};
  for (const rule of rules) {
    if (!byFirm[rule.propFirmId]) byFirm[rule.propFirmId] = rule;
  }
  return Object.values(byFirm).map((rule) => {
    const payout = payoutByFirm[rule.propFirmId];
    const scale = scaleByFirm[rule.propFirmId];
    const meta = rule.metadata || {};
    return [
      rule.firmName,
      rule.challengeFee != null ? `${rule.currency} ${rule.challengeFee}` : meta.challengeFee || "—",
      rule.profitTargetPercent != null ? `${rule.profitTargetPercent}%` : "—",
      `${rule.dailyLossLimitPercent}%`,
      `${rule.maxDrawdownPercent}%`,
      scale?.max_allocation || meta.scalingPlan || "—",
      rule.payoutSplitPercent != null ? `${rule.payoutSplitPercent}%` : payout?.payout_split_percent != null ? `${payout.payout_split_percent}%` : "—",
      payout?.refund_policy || meta.refundPolicy || "—",
      rule.newsTradingAllowed ? "Allowed" : "Restricted",
      rule.weekendHoldingAllowed ? "Allowed" : "Restricted",
      rule.consistencyRule || "None",
      rule.leverage || "—",
      meta.allowedInstruments || "—"
    ];
  });
}

function computeSummary(rules, compliance, breachAlerts) {
  const firms = new Set(rules.map((r) => r.propFirmId));
  const dailyLimits = rules.map((r) => r.dailyLossLimitPercent).filter((n) => Number.isFinite(n));
  const drawdowns = rules.map((r) => r.maxDrawdownPercent).filter((n) => Number.isFinite(n));
  const minDays = rules.map((r) => r.minTradingDays).filter((n) => n != null && n > 0);
  const nearBreach = compliance.filter((c) => ["Medium", "High"].includes(c.breachRisk)).length;
  const breached = compliance.filter((c) => c.status === "Breached").length;
  return {
    totalPropFirms: firms.size,
    activeAccounts: compliance.filter((c) => c.status !== "Disconnected").length,
    accountsNearBreach: nearBreach,
    breachedAccounts: breached,
    averageDailyLossLimit: dailyLimits.length
      ? Math.round((dailyLimits.reduce((a, b) => a + b, 0) / dailyLimits.length) * 10) / 10
      : null,
    averageMaxDrawdown: drawdowns.length
      ? Math.round((drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length) * 10) / 10
      : null,
    minimumTradingDays: minDays.length ? Math.min(...minDays) : null,
    nextPayoutDue: null,
    openBreachAlerts: breachAlerts.length
  };
}

function riskFromUtilization(util) {
  if (util == null || Number.isNaN(util)) return "Unknown";
  if (util >= 90) return "High";
  if (util >= 65) return "Medium";
  if (util >= 40) return "Low";
  return "Low";
}

function statusFromRisk(risk) {
  if (risk === "High") return "At Risk";
  if (risk === "Medium") return "Watchlist";
  if (risk === "Low") return "Compliant";
  return "Unknown";
}

export function computeComplianceFromAccount(account, rule) {
  if (!account || !rule) {
    return {
      computable: false,
      reason: "account_or_rule_incomplete"
    };
  }

  const balance = Number(account.balance || 0);
  const equity = Number(account.equity || 0);
  const dailyLossLimit = Number(rule.dailyLossLimitPercent || 0);
  const maxDrawdown = Number(rule.maxDrawdownPercent || 0);
  const profitTarget = Number(rule.profitTargetPercent || 0);

  const dailyDrawdownPct = account.dailyDrawdownPercent != null
    ? Number(account.dailyDrawdownPercent)
    : balance > 0
      ? Math.max(0, ((balance - equity) / balance) * 100)
      : 0;

  const dailyLossUsed = dailyLossLimit > 0 ? (dailyDrawdownPct / dailyLossLimit) * 100 : null;
  const maxDrawdownUsed = maxDrawdown > 0 ? (dailyDrawdownPct / maxDrawdown) * 100 : null;

  let profitProgress = null;
  if (profitTarget > 0 && rule.accountSize > 0) {
    const targetAmount = (rule.accountSize * profitTarget) / 100;
    const gain = equity - rule.accountSize;
    profitProgress = targetAmount > 0 ? Math.min(100, Math.max(0, (gain / targetAmount) * 100)) : 0;
  }

  const util = Math.max(dailyLossUsed || 0, maxDrawdownUsed || 0);
  const breachRisk = riskFromUtilization(util);

  return {
    computable: true,
    balance,
    equity,
    dailyLossUsedPercent: dailyLossUsed != null ? Math.round(dailyLossUsed * 10) / 10 : null,
    maxDrawdownUsedPercent: maxDrawdownUsed != null ? Math.round(maxDrawdownUsed * 10) / 10 : null,
    profitTargetProgressPercent: profitProgress != null ? Math.round(profitProgress * 10) / 10 : null,
    minimumDaysCompleted: account.metadata?.tradingDaysCompleted ?? null,
    breachRisk,
    status: statusFromRisk(breachRisk)
  };
}

export function computeBreachAlerts(complianceRows, rulesById) {
  const alerts = [];
  for (const row of complianceRows) {
    if (!row.computable) continue;
    const rule = rulesById[row.propFirmRuleId];
    if (!rule) continue;
    if (row.dailyLossUsedPercent != null && row.dailyLossUsedPercent >= 65) {
      alerts.push({
        alertType: "Daily loss utilization elevated",
        severity: row.dailyLossUsedPercent >= 85 ? "High" : "Medium",
        accountName: row.accountName,
        currentState: `${row.dailyLossUsedPercent}% of daily limit`,
        requiredAction: "Reduce exposure and review open correlated positions"
      });
    }
    if (row.maxDrawdownUsedPercent != null && row.maxDrawdownUsedPercent >= 65) {
      alerts.push({
        alertType: "Max drawdown utilization elevated",
        severity: row.maxDrawdownUsedPercent >= 85 ? "High" : "Medium",
        accountName: row.accountName,
        currentState: `${row.maxDrawdownUsedPercent}% of max drawdown`,
        requiredAction: "Pause new risk until compliance review completes"
      });
    }
  }
  return alerts;
}

export async function getPropFirmCompliance() {
  const rules = await loadRulesFromDb();
  const rulesById = Object.fromEntries(rules.map((r) => [r.id, r]));
  const rulesByFirm = Object.fromEntries(rules.map((r) => [r.propFirmId, r]));

  if (!isDatabaseConfigured() || !(await isPropFirmSchemaReady())) {
    return { accounts: [], message: "No prop firm account connected. Connect an account to begin real-time rule compliance monitoring.", connected: false };
  }

  const portfolio = await fetchLivePortfolioRecords();
  const linkedRes = await query(
    `SELECT a.*, f.firm_name
     FROM market.prop_firm_accounts a
     INNER JOIN market.prop_firms f ON f.id = a.prop_firm_id
     ORDER BY a.updated_at DESC`
  ).catch(() => ({ rows: [] }));

  const linked = linkedRes.rows;
  if (!linked.length) {
    return {
      accounts: [],
      message: "No prop firm account connected. Connect an account to begin real-time rule compliance monitoring.",
      connected: false,
      tradingAccountsAvailable: portfolio.accounts.length
    };
  }

  const accountByTradingId = Object.fromEntries(
    portfolio.accounts.map((a) => [a.id, a])
  );

  const accounts = [];
  for (const link of linked) {
    const live = link.trading_account_id ? accountByTradingId[link.trading_account_id] : null;
    const rule = link.prop_firm_rule_id
      ? rulesById[link.prop_firm_rule_id]
      : rulesByFirm[link.prop_firm_id];

    if (!live) {
      accounts.push({
        id: link.id,
        accountName: link.account_name,
        firmName: link.firm_name,
        phase: link.phase,
        balance: null,
        equity: null,
        dailyLossUsedPercent: null,
        maxDrawdownUsedPercent: null,
        profitTargetProgressPercent: null,
        minimumDaysCompleted: null,
        breachRisk: "Unknown",
        status: "Disconnected",
        message: "Trading account not linked to live MT5 snapshot"
      });
      continue;
    }

    const computed = computeComplianceFromAccount(live, rule);
    accounts.push({
      id: link.id,
      accountName: link.account_name || live.accountName,
      firmName: link.firm_name,
      phase: link.phase || rule?.phase,
      balance: computed.balance,
      equity: computed.equity,
      dailyLossUsedPercent: computed.dailyLossUsedPercent,
      maxDrawdownUsedPercent: computed.maxDrawdownUsedPercent,
      profitTargetProgressPercent: computed.profitTargetProgressPercent,
      minimumDaysCompleted: computed.minimumDaysCompleted,
      breachRisk: computed.breachRisk,
      status: computed.status,
      computable: computed.computable,
      propFirmRuleId: rule?.id
    });
  }

  return { accounts, connected: accounts.some((a) => a.computable), message: null };
}

export async function getPropFirmBreachAlerts() {
  const { accounts, connected } = await getPropFirmCompliance();
  if (!connected) {
    return {
      alerts: [],
      message: "Breach risk cannot be calculated because account or rule data is incomplete."
    };
  }

  const rules = await loadRulesFromDb();
  const rulesById = Object.fromEntries(rules.map((r) => [r.id, r]));
  const rows = accounts.map((a) => ({ ...a, ...computeComplianceFromAccount(
    { balance: a.balance, equity: a.equity, dailyDrawdownPercent: a.dailyLossUsedPercent },
    rulesById[a.propFirmRuleId]
  ), propFirmRuleId: a.propFirmRuleId, accountName: a.accountName }));

  const stored = await query(
    `SELECT ba.alert_type, ba.severity, ca.account_name, ba.current_state, ba.required_action
     FROM market.prop_firm_breach_alerts ba
     LEFT JOIN market.prop_firm_compliance_accounts ca ON ca.id = ba.compliance_account_id
     WHERE ba.status = 'Open'
     ORDER BY ba.created_at DESC
     LIMIT 50`
  ).catch(() => ({ rows: [] }));

  const computed = computeBreachAlerts(
    accounts.filter((a) => a.computable),
    rulesById
  ).map((a) => [a.alertType, a.severity, a.accountName, a.currentState, a.requiredAction]);

  const dbAlerts = stored.rows.map((r) => [
    r.alert_type,
    r.severity,
    r.account_name || "—",
    r.current_state,
    r.required_action
  ]);

  return { alerts: [...computed, ...dbAlerts], message: null };
}

export async function getPropFirmRulesSummary() {
  const dashboard = await getPropFirmRulesDashboard();
  return {
    summary: dashboard.summary,
    meta: dashboard.meta
  };
}

export async function getPropFirmRulesDashboard() {
  const schemaReady = await isPropFirmSchemaReady();
  const dbConfigured = isDatabaseConfigured();
  let lastSync = null;

  if (dbConfigured && schemaReady) {
    const syncRes = await query(
      `SELECT completed_at FROM market.prop_firm_sync_logs
       WHERE status = 'COMPLETED' ORDER BY completed_at DESC NULLS LAST LIMIT 1`
    ).catch(() => ({ rows: [] }));
    lastSync = syncRes.rows[0]?.completed_at || null;
  }

  const rules = await loadRulesFromDb();
  const firms = await loadFirmsFromDb();
  const payouts = await loadPayoutPolicies();
  const scaling = await loadScalingPlans();
  const comparison = buildComparisonMatrix(rules, payouts, scaling);
  const complianceResult = await getPropFirmCompliance();
  const breachResult = await getPropFirmBreachAlerts();
  const sources = await listPropFirmSources();
  const auditLogs = await getPropFirmAuditLogs({ limit: 20 });

  const summary = computeSummary(rules, complianceResult.accounts, breachResult.alerts || []);

  return {
    rules,
    firms,
    comparison,
    compliance: complianceResult.accounts,
    complianceMessage: complianceResult.message,
    breachAlerts: breachResult.alerts,
    breachMessage: breachResult.message,
    payoutPolicies: payouts,
    scalingPlans: scaling,
    sources: sources.sources,
    auditLogs: auditLogs.logs,
    summary,
    meta: {
      dataMode: "Production Live",
      mockData: false,
      databaseConfigured: dbConfigured,
      databaseStatus: dbConfigured ? (schemaReady ? "Connected" : "Schema Pending") : "Not Configured",
      schemaReady,
      lastSync,
      recordsLoaded: rules.length
    },
    empty: rules.length === 0
  };
}

export async function getPropFirmRuleById(id) {
  const { rows } = await query(
    `SELECT r.*, f.firm_name FROM market.prop_firm_rules r
     INNER JOIN market.prop_firms f ON f.id = r.prop_firm_id WHERE r.id = $1`,
    [id]
  );
  if (!rows.length) throw new Error("rule_not_found");
  const firm = await query(`SELECT * FROM market.prop_firms WHERE id = $1`, [rows[0].prop_firm_id]);
  return { rule: mapRuleRow(rows[0]), firm: firm.rows[0] ? mapFirmRow(firm.rows[0]) : null };
}

export async function createPropFirmRule(body, audit = {}) {
  const validation = validatePropFirmInput(body);
  if (!validation.valid) {
    const err = new Error("validation_failed");
    err.details = validation.errors;
    throw err;
  }

  await ensurePropFirmSchema();

  const firmName = validation.firmName;
  const existingFirm = await query(`SELECT id FROM market.prop_firms WHERE firm_name = $1`, [firmName]);
  let firmId = existingFirm.rows[0]?.id;
  if (!firmId) {
    firmId = randomUUID();
    await query(
      `INSERT INTO market.prop_firms (id, firm_name, country, website, region, supported_platforms, status, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        firmId,
        firmName,
        body.country || null,
        body.website || null,
        body.region || null,
        body.supportedPlatforms || body.supported_platforms || null,
        body.firmStatus || body.status || "Draft",
        JSON.stringify(body.firmMetadata || {})
      ]
    );
    await writeAuditLog(null, {
      action: "created_firm",
      entityType: "prop_firm",
      entityId: firmId,
      afterValue: { firmName },
      userLabel: audit.userLabel,
      ipAddress: audit.ipAddress,
      reason: audit.reason
    });
  }

  const programName = validation.programName || body.programName || `${firmName} Program`;
  const dup = await query(
    `SELECT id FROM market.prop_firm_rules WHERE prop_firm_id = $1 AND program_name = $2`,
    [firmId, programName]
  );
  if (dup.rows.length) {
    const err = new Error("program_name_exists");
    throw err;
  }

  const ruleId = randomUUID();
  const status = body.activate ? "Active" : body.status || "Draft";
  if (body.activate) {
    const v = validatePropFirmInput({ ...body, activate: true });
    if (!v.valid) {
      const err = new Error("validation_failed");
      err.details = v.errors;
      throw err;
    }
  }

  await query(
    `INSERT INTO market.prop_firm_rules
      (id, prop_firm_id, program_name, account_size, currency, account_type, phase,
       profit_target_percent, daily_loss_limit_percent, max_drawdown_percent, drawdown_type,
       min_trading_days, max_trading_days, news_trading_allowed, weekend_holding_allowed,
       ea_allowed, copy_trading_allowed, payout_split_percent, payout_cycle, consistency_rule,
       leverage, challenge_fee, status, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
    [
      ruleId,
      firmId,
      programName,
      num(body.accountSize ?? body.account_size) || 0,
      body.currency || "USD",
      body.accountType || body.account_type || "Challenge",
      body.phase || "Phase 1",
      num(body.profitTargetPercent ?? body.profit_target_percent),
      num(body.dailyLossLimitPercent ?? body.daily_loss_limit_percent) ?? 0,
      num(body.maxDrawdownPercent ?? body.max_drawdown_percent) ?? 0,
      body.drawdownType || body.drawdown_type || null,
      num(body.minTradingDays ?? body.min_trading_days),
      num(body.maxTradingDays ?? body.max_trading_days),
      Boolean(body.newsTradingAllowed ?? body.news_trading_allowed ?? true),
      Boolean(body.weekendHoldingAllowed ?? body.weekend_holding_allowed ?? true),
      Boolean(body.eaAllowed ?? body.ea_allowed ?? true),
      Boolean(body.copyTradingAllowed ?? body.copy_trading_allowed ?? false),
      num(body.payoutSplitPercent ?? body.payout_split_percent),
      body.payoutCycle || body.payout_cycle || null,
      body.consistencyRule || body.consistency_rule || null,
      body.leverage || null,
      num(body.challengeFee ?? body.challenge_fee),
      status,
      JSON.stringify(body.ruleMetadata || body.metadata || {})
    ]
  );

  if (body.payoutSplitPercent != null || body.payoutCycle) {
    await query(
      `INSERT INTO market.prop_firm_payout_policies (id, prop_firm_id, payout_split_percent, payout_cycle, refund_policy, scaling_plan)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        randomUUID(),
        firmId,
        num(body.payoutSplitPercent ?? body.payout_split_percent),
        body.payoutCycle || body.payout_cycle,
        body.refundPolicy || null,
        body.scalingEligibility || null
      ]
    ).catch(() => {});
  }

  await writeAuditLog(null, {
    action: "created_rule",
    entityType: "prop_firm_rule",
    entityId: ruleId,
    afterValue: { firmName, programName, status },
    userLabel: audit.userLabel,
    ipAddress: audit.ipAddress
  });

  return getPropFirmRuleById(ruleId);
}

export async function updatePropFirmRule(id, body, audit = {}) {
  const before = await getPropFirmRuleById(id);
  const validation = validatePropFirmInput({ ...before.rule, ...body, firmName: before.rule.firmName });
  if (body.activate && !validation.valid) {
    const err = new Error("validation_failed");
    err.details = validation.errors;
    throw err;
  }

  const status = body.activate ? "Active" : body.status || before.rule.status;
  await query(
    `UPDATE market.prop_firm_rules SET
      program_name = COALESCE($2, program_name),
      account_size = COALESCE($3, account_size),
      account_type = COALESCE($4, account_type),
      phase = COALESCE($5, phase),
      profit_target_percent = COALESCE($6, profit_target_percent),
      daily_loss_limit_percent = COALESCE($7, daily_loss_limit_percent),
      max_drawdown_percent = COALESCE($8, max_drawdown_percent),
      min_trading_days = COALESCE($9, min_trading_days),
      max_trading_days = COALESCE($10, max_trading_days),
      payout_split_percent = COALESCE($11, payout_split_percent),
      status = $12,
      metadata = COALESCE($13, metadata),
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [
      id,
      body.programName || null,
      num(body.accountSize),
      body.accountType || null,
      body.phase || null,
      num(body.profitTargetPercent),
      num(body.dailyLossLimitPercent),
      num(body.maxDrawdownPercent),
      num(body.minTradingDays),
      num(body.maxTradingDays),
      num(body.payoutSplitPercent),
      status,
      body.metadata ? JSON.stringify(body.metadata) : null
    ]
  );

  await writeAuditLog(null, {
    action: "updated_rule",
    entityType: "prop_firm_rule",
    entityId: id,
    beforeValue: before.rule,
    afterValue: body,
    userLabel: audit.userLabel,
    ipAddress: audit.ipAddress,
    reason: audit.reason
  });

  return getPropFirmRuleById(id);
}

export async function deletePropFirmRule(id, audit = {}) {
  const before = await getPropFirmRuleById(id);
  await query(`DELETE FROM market.prop_firm_rules WHERE id = $1`, [id]);
  await writeAuditLog(null, {
    action: "deleted_rule",
    entityType: "prop_firm_rule",
    entityId: id,
    beforeValue: before.rule,
    userLabel: audit.userLabel,
    ipAddress: audit.ipAddress,
    reason: audit.reason
  });
  return { deleted: true, id };
}

export async function importPropFirmRules(body, audit = {}) {
  await ensurePropFirmSchema();
  const importId = randomUUID();
  await query(
    `INSERT INTO market.prop_firm_rule_imports
      (id, prop_firm_id, source_type, source_label, status, extracted_payload, created_by)
     VALUES ($1,$2,$3,$4,'Pending Review',$5,$6)`,
    [
      importId,
      body.propFirmId || null,
      body.sourceType || "manual",
      body.sourceLabel || body.fileName || body.url || "import",
      JSON.stringify(body.extracted || body.payload || {}),
      audit.userLabel || "operator"
    ]
  );
  await writeAuditLog(null, {
    action: "imported_document",
    entityType: "prop_firm_rule_import",
    entityId: importId,
    afterValue: { status: "Pending Review" },
    userLabel: audit.userLabel,
    ipAddress: audit.ipAddress
  });
  return { importId, status: "Pending Review" };
}

export async function approvePropFirmImport(importId, audit = {}) {
  const { rows } = await query(`SELECT * FROM market.prop_firm_rule_imports WHERE id = $1`, [importId]);
  if (!rows.length) throw new Error("import_not_found");
  const row = rows[0];
  const payload = row.extracted_payload || {};
  const created = await createPropFirmRule(
    { ...payload, activate: true, firmName: payload.firmName || payload.firm_name },
    audit
  );
  await query(
    `UPDATE market.prop_firm_rule_imports SET status = 'Approved', reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [importId, audit.userLabel || "operator"]
  );
  await writeAuditLog(null, {
    action: "approved_imported_rule",
    entityType: "prop_firm_rule_import",
    entityId: importId,
    afterValue: { ruleId: created.rule.id },
    userLabel: audit.userLabel
  });
  return created;
}

export async function syncPropFirmSources(audit = {}) {
  await ensurePropFirmSchema();
  const startedAt = new Date();
  const logId = randomUUID();
  let rulesImported = 0;
  let status = "COMPLETED";
  let errorMessage = null;

  try {
    const { rows: sources } = await query(
      `SELECT * FROM market.prop_firm_source_configs WHERE health_status <> 'Disabled'`
    );
    for (const source of sources) {
      await query(
        `UPDATE market.prop_firm_source_configs SET last_sync = CURRENT_TIMESTAMP, health_status = 'Healthy', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [source.id]
      );
    }
    rulesImported = (await loadRulesFromDb()).length;
  } catch (error) {
    status = "FAILED";
    errorMessage = error.message;
  }

  await query(
    `INSERT INTO market.prop_firm_sync_logs (id, status, rules_imported, started_at, completed_at, error_message)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [logId, status, rulesImported, startedAt, new Date(), errorMessage]
  );

  await writeAuditLog(null, {
    action: "synced_source",
    entityType: "prop_firm_sync",
    entityId: logId,
    afterValue: { status, rulesImported },
    userLabel: audit.userLabel
  });

  return { status, rulesImported, logId, errorMessage };
}

export async function listPropFirmSources() {
  if (!isDatabaseConfigured() || !(await isPropFirmSchemaReady())) {
    return { sources: [] };
  }
  const { rows } = await query(
    `SELECT * FROM market.prop_firm_source_configs ORDER BY source_name`
  ).catch(() => ({ rows: [] }));
  return {
    sources: rows.map((r) => ({
      id: r.id,
      sourceName: r.source_name,
      sourceType: r.source_type,
      endpointUrl: r.endpoint_url,
      authenticationType: r.authentication_type,
      syncFrequency: r.sync_frequency,
      lastSync: r.last_sync,
      healthStatus: r.health_status,
      approvalRequired: r.approval_required
    }))
  };
}

export async function createPropFirmSource(body, audit = {}) {
  await ensurePropFirmSchema();
  const id = randomUUID();
  await query(
    `INSERT INTO market.prop_firm_source_configs
      (id, source_name, source_type, endpoint_url, authentication_type, sync_frequency, health_status, approval_required, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      body.sourceName,
      body.sourceType,
      body.endpointUrl || body.url || null,
      body.authenticationType || "none",
      body.syncFrequency || "manual",
      body.healthStatus || "Unknown",
      body.approvalRequired !== false,
      JSON.stringify(body.metadata || {})
    ]
  );
  await writeAuditLog(null, {
    action: "created_source",
    entityType: "prop_firm_source",
    entityId: id,
    afterValue: body,
    userLabel: audit.userLabel
  });
  return { id, ...(await listPropFirmSources()).sources.find((s) => s.id === id) };
}

export async function getPropFirmAuditLogs({ limit = 50 } = {}) {
  if (!isDatabaseConfigured() || !(await isPropFirmSchemaReady())) {
    return { logs: [] };
  }
  const { rows } = await query(
    `SELECT * FROM market.prop_firm_audit_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  ).catch(() => ({ rows: [] }));
  return {
    logs: rows.map((r) => ({
      id: r.id,
      user: r.user_label || r.user_id,
      timestamp: r.created_at,
      action: r.action,
      entity: r.entity_type,
      entityId: r.entity_id,
      beforeValue: r.before_value,
      afterValue: r.after_value,
      ipAddress: r.ip_address,
      reason: r.reason
    }))
  };
}

export async function linkPropFirmAccount(body, audit = {}) {
  await ensurePropFirmSchema();
  const id = randomUUID();
  await query(
    `INSERT INTO market.prop_firm_accounts
      (id, prop_firm_id, prop_firm_rule_id, trading_account_id, account_name, program_name, phase, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      body.propFirmId,
      body.propFirmRuleId || null,
      body.tradingAccountId || null,
      body.accountName,
      body.programName || null,
      body.phase || null,
      body.status || "Active"
    ]
  );
  await writeAuditLog(null, {
    action: "linked_account",
    entityType: "prop_firm_account",
    entityId: id,
    afterValue: body,
    userLabel: audit.userLabel
  });
  return { id };
}

/** @deprecated — production uses getPropFirmRulesDashboard() only */
export function getPropFirmRulesDashboardLegacy() {
  return getPropFirmRulesDashboard();
}
