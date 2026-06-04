import { randomUUID } from "node:crypto";
import { isDatabaseConfigured, query } from "./db.js";
import { ensurePortfolioSchema, isPortfolioSchemaReady } from "./portfolio-schema.js";

const ASSET_CLASS_MAP = [
  [/XAU|GOLD/i, "Gold"],
  [/XAG|SILVER/i, "Silver"],
  [/BTC|ETH|CRYPTO/i, "Crypto"],
  [/NAS|US30|US500|SPX|DAX|UK100|INDEX/i, "Indices"],
  [/WTI|BRENT|OIL|GAS/i, "Commodities"],
  [/^[A-Z]{6}$/i, "Forex"]
];

function maskAccountNumber(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "—";
  return `****${digits.slice(-4)}`;
}

function classifyAsset(instrument = "") {
  for (const [pattern, label] of ASSET_CLASS_MAP) {
    if (pattern.test(instrument)) return label;
  }
  return "Other";
}

function currencyFromSymbol(symbol = "") {
  if (/USD/i.test(symbol)) return "USD";
  if (/EUR/i.test(symbol)) return "EUR";
  if (/GBP/i.test(symbol)) return "GBP";
  if (/JPY/i.test(symbol)) return "JPY";
  if (/CHF/i.test(symbol)) return "CHF";
  if (/AUD/i.test(symbol)) return "AUD";
  if (/CAD/i.test(symbol)) return "CAD";
  if (/NZD/i.test(symbol)) return "NZD";
  return "USD";
}

function healthStatus({ connectionStatus, marginLevel, dailyDrawdownPercent }) {
  if (connectionStatus !== "ONLINE") return "Disconnected";
  if (dailyDrawdownPercent >= 5 || marginLevel < 200) return "Critical";
  if (dailyDrawdownPercent >= 3 || marginLevel < 350) return "At Risk";
  if (dailyDrawdownPercent >= 1.5 || marginLevel < 500) return "Watchlist";
  return "Healthy";
}

function healthGrade(status) {
  return ({ Healthy: "A", Watchlist: "B", "At Risk": "C", Critical: "D", Disconnected: "F" })[status] || "F";
}

function riskLevel(score) {
  if (score <= 25) return "Low";
  if (score <= 45) return "Moderate";
  if (score <= 65) return "High";
  return "Critical";
}

function computeRiskScore({ marginLevel, openRiskPercent, dailyDrawdownPercent }) {
  let score = 20;
  if (marginLevel < 300) score += 35;
  else if (marginLevel < 500) score += 20;
  else if (marginLevel < 800) score += 8;
  score += Math.min(openRiskPercent * 8, 24);
  score += Math.min(dailyDrawdownPercent * 10, 20);
  return Math.round(Math.min(score, 95));
}

export function mapAccountRow(row) {
  return {
    id: row.id,
    terminalId: row.terminal_id,
    providerId: row.provider_id,
    brokerName: row.broker_name,
    accountName: row.account_name,
    accountNumberMasked: row.account_number_masked,
    accountType: row.account_type,
    currency: row.currency,
    balance: Number(row.balance),
    equity: Number(row.equity),
    floatingPL: Number(row.floating_pl),
    realizedPL: Number(row.realized_pl),
    marginUsed: Number(row.margin_used),
    freeMargin: Number(row.free_margin),
    marginLevel: Number(row.margin_level),
    dailyDrawdownPercent: Number(row.daily_drawdown_percent),
    monthlyReturnPercent: Number(row.monthly_return_percent),
    riskScore: Number(row.risk_score),
    status: row.status,
    healthGrade: row.health_grade || "F",
    server: row.server || "—",
    lastSync: row.last_sync_at
  };
}

export function mapPositionRow(row, accountById) {
  const account = accountById[row.account_id];
  return {
    id: row.id,
    ticket: row.id,
    accountId: row.account_id,
    accountName: account?.accountName,
    brokerName: account?.brokerName,
    instrument: row.instrument,
    direction: row.direction,
    lotSize: Number(row.lot_size),
    entryPrice: Number(row.entry_price),
    currentPrice: row.current_price != null ? Number(row.current_price) : null,
    stopLoss: row.stop_loss != null ? Number(row.stop_loss) : null,
    takeProfit: row.take_profit != null ? Number(row.take_profit) : null,
    floatingPL: Number(row.floating_pl),
    riskPercent: row.risk_percent != null ? Number(row.risk_percent) : null,
    marginUsed: row.margin_used != null ? Number(row.margin_used) : null,
    openTime: row.open_time,
    status: row.status,
    strategy: row.strategy || null
  };
}

export function mapClosedTradeRow(row, accountById) {
  const account = accountById[row.account_id];
  return {
    account: account?.accountName || "—",
    broker: account?.brokerName || "—",
    instrument: row.instrument,
    direction: row.direction,
    lotSize: Number(row.lot_size),
    entryPrice: Number(row.entry_price),
    exitPrice: Number(row.exit_price),
    profitLoss: Number(row.profit_loss),
    rMultiple: row.r_multiple != null ? Number(row.r_multiple) : null,
    commission: row.commission != null ? Number(row.commission) : 0,
    swap: row.swap != null ? Number(row.swap) : 0,
    duration: row.duration_seconds != null ? formatDuration(row.duration_seconds) : "—",
    strategy: row.strategy,
    closeReason: row.close_reason,
    closedAt: row.closed_at
  };
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function parseAccountSnapshot(raw, { lastHeartbeatAt = null } = {}) {
  if (!raw) return {};
  let snapshot = raw;
  if (typeof raw === "string") {
    try {
      snapshot = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (lastHeartbeatAt && snapshot.observedAt) {
    const heartbeatMs = new Date(lastHeartbeatAt).getTime();
    const observedMs = new Date(snapshot.observedAt).getTime();
    if (Number.isFinite(heartbeatMs) && Number.isFinite(observedMs) && heartbeatMs - observedMs > 90_000) {
      snapshot = { ...snapshot, stale: true };
    }
  }
  return snapshot;
}

export function isSnapshotStale(snapshot = {}, lastHeartbeatAt = null) {
  if (snapshot.stale) return true;
  if (!lastHeartbeatAt || !snapshot.observedAt) return false;
  return new Date(lastHeartbeatAt).getTime() - new Date(snapshot.observedAt).getTime() > 90_000;
}

export function toMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function snapshotHasLiveMetrics(snapshot = {}) {
  if (isSnapshotStale(snapshot)) return false;
  const balance = toMoney(snapshot.balance);
  const equity = toMoney(snapshot.equity);
  const floating = toMoney(snapshot.floatingPL ?? snapshot.profit);
  return balance > 0 || equity > 0 || Math.abs(floating) > 0.0001;
}

export function normalizeHeartbeatPayload(input = {}) {
  const body = { ...input };
  if (typeof body.account === "string") {
    try {
      body.account = JSON.parse(body.account);
    } catch {
      delete body.account;
    }
  }
  if (body.account && typeof body.account === "object") {
    for (const key of ["balance", "equity", "margin", "freeMargin", "floatingPL", "profit"]) {
      if (typeof body.account[key] === "string") {
        body.account[key] = body.account[key].replace(/,/g, ".");
      }
    }
  }
  return body;
}

export function heartbeatHasAccountPayload(input = {}) {
  const body = normalizeHeartbeatPayload(input);
  const account = body.account || body.accountSnapshot;
  if (account && snapshotHasLiveMetrics(account)) return true;
  if (account?.currency && (account.leverage != null || account.margin != null)) return true;
  return Array.isArray(body.openPositions) && body.openPositions.length > 0;
}

export async function upsertAccountSnapshotFromHeartbeat(terminalId, input = {}) {
  if (!isDatabaseConfigured() || !terminalId) return null;
  const body = normalizeHeartbeatPayload(input);
  if (!heartbeatHasAccountPayload(body)) return null;

  const account = body.account || body.accountSnapshot || {};
  const snapshot = {
    balance: toMoney(account.balance),
    equity: toMoney(account.equity ?? account.balance),
    margin: toMoney(account.margin ?? account.marginUsed),
    freeMargin: toMoney(account.freeMargin ?? account.free_margin),
    floatingPL: toMoney(account.floatingPL ?? account.profit),
    currency: account.currency || "USD",
    leverage: toMoney(account.leverage),
    openPositions: Array.isArray(body.openPositions) ? body.openPositions : account.openPositions || [],
    observedAt: new Date().toISOString()
  };

  if (!snapshotHasLiveMetrics(snapshot) && !snapshot.openPositions.length) return null;

  await query(
    `UPDATE infrastructure.mt5_terminals SET account_snapshot = $2::jsonb, updated_at = now() WHERE id = $1`,
    [terminalId, JSON.stringify(snapshot)]
  );

  try {
    await syncTerminalPortfolioRecord(terminalId);
  } catch (error) {
    console.warn("[portfolio-live-data] terminal sync after heartbeat failed:", error.message);
  }

  return snapshot;
}

export async function syncTerminalPortfolioRecord(terminalId) {
  const { rows } = await query(
    `SELECT t.*, p.name AS provider_name, p.provider_type
     FROM infrastructure.mt5_terminals t
     LEFT JOIN market.market_data_providers p ON p.id = t.provider_id
     WHERE t.id = $1`,
    [terminalId]
  );
  if (!rows[0]) return { accountsSynced: 0, positionsSynced: 0 };
  return syncTerminalRow(rows[0]);
}

async function syncTerminalRow(terminal) {
  const snapshot = parseAccountSnapshot(terminal.account_snapshot, { lastHeartbeatAt: terminal.last_heartbeat_at });
  if (isSnapshotStale(snapshot, terminal.last_heartbeat_at)) {
    return { accountsSynced: 0, positionsSynced: 0, skipped: "stale_account_snapshot" };
  }
  if (!snapshotHasLiveMetrics(snapshot) && !(Array.isArray(snapshot.openPositions) && snapshot.openPositions.length)) {
    return { accountsSynced: 0, positionsSynced: 0, skipped: "no_live_account_metrics" };
  }

  const balance = toMoney(snapshot.balance);
  const equity = toMoney(snapshot.equity ?? snapshot.balance);
  const marginUsed = toMoney(snapshot.margin);
  const freeMargin = toMoney(snapshot.freeMargin ?? Math.max(equity - marginUsed, 0));
  const floatingPL = toMoney(snapshot.floatingPL ?? equity - balance);
  const marginLevel = marginUsed > 0 ? (equity / marginUsed) * 100 : equity > 0 ? 9999 : 0;
  const connectionStatus = terminal.connection_status || "OFFLINE";
  const dailyDrawdownPercent = balance > 0 ? Math.max(0, ((balance - equity) / balance) * 100) : 0;
  const status = healthStatus({ connectionStatus, marginLevel, dailyDrawdownPercent });
  const openRiskPercent = equity > 0 ? (marginUsed / equity) * 100 : 0;
  const riskScore = computeRiskScore({ marginLevel, openRiskPercent, dailyDrawdownPercent });
  const accountName = terminal.terminal_name || terminal.broker_name || "MT5 Account";
  const brokerName = terminal.broker_name || terminal.broker_search_name || "Broker";
  const accountType = /demo/i.test(terminal.environment || "") ? "Demo" : /challenge|evaluation|prop/i.test(accountName) ? "Challenge" : "Live";

  const { rows: existing } = await query(
    `SELECT id, realized_pl, monthly_return_percent FROM market.trading_accounts WHERE terminal_id = $1 LIMIT 1`,
    [terminal.id]
  );
  const accountId = existing[0]?.id || randomUUID();
  const realizedPl = Number(existing[0]?.realized_pl ?? 0);
  const monthlyReturn = Number(existing[0]?.monthly_return_percent ?? 0);

  const { rows: accounts } = existing[0]
    ? await query(
        `UPDATE market.trading_accounts SET
          provider_id = $2, broker_name = $3, account_name = $4, account_number_masked = $5, account_type = $6, currency = $7,
          balance = $8, equity = $9, floating_pl = $10, margin_used = $11, free_margin = $12, margin_level = $13,
          daily_drawdown_percent = $14, risk_score = $15, status = $16, health_grade = $17, server = $18,
          last_sync_at = now(), updated_at = now()
         WHERE terminal_id = $1 RETURNING *`,
        [
          terminal.id,
          terminal.provider_id,
          brokerName,
          accountName,
          maskAccountNumber(terminal.account_number),
          accountType,
          snapshot.currency || "USD",
          balance,
          equity,
          floatingPL,
          marginUsed,
          freeMargin,
          marginLevel,
          dailyDrawdownPercent,
          riskScore,
          status,
          healthGrade(status),
          terminal.server_name || "—"
        ]
      )
    : await query(
        `INSERT INTO market.trading_accounts (
          id, terminal_id, provider_id, broker_name, account_name, account_number_masked, account_type, currency,
          balance, equity, floating_pl, realized_pl, margin_used, free_margin, margin_level,
          daily_drawdown_percent, monthly_return_percent, risk_score, status, health_grade, server, last_sync_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,now()) RETURNING *`,
        [
          accountId,
          terminal.id,
          terminal.provider_id,
          brokerName,
          accountName,
          maskAccountNumber(terminal.account_number),
          accountType,
          snapshot.currency || "USD",
          balance,
          equity,
          floatingPL,
          realizedPl,
          marginUsed,
          freeMargin,
          marginLevel,
          dailyDrawdownPercent,
          monthlyReturn,
          riskScore,
          status,
          healthGrade(status),
          terminal.server_name || "—"
        ]
      );

  const savedAccountId = accounts[0]?.id || accountId;
  if (!savedAccountId) return { accountsSynced: 0, positionsSynced: 0 };

  const { rows: recentSnap } = await query(
    `SELECT id FROM market.portfolio_equity_snapshots
     WHERE account_id = $1 AND snapshot_at > now() - interval '5 minutes'
     LIMIT 1`,
    [savedAccountId]
  );
  if (!recentSnap.length) {
    await query(
      `INSERT INTO market.portfolio_equity_snapshots (id, account_id, snapshot_at, balance, equity, drawdown_percent)
       VALUES ($1, $2, now(), $3, $4, $5)`,
      [randomUUID(), savedAccountId, balance, equity, dailyDrawdownPercent]
    );
  }

  let positionsSynced = 0;
  const openPositions = Array.isArray(snapshot.openPositions) ? snapshot.openPositions : [];
  await query(`UPDATE market.portfolio_positions SET status = 'Closed' WHERE account_id = $1 AND status = 'Open'`, [savedAccountId]);

  for (const pos of openPositions) {
    const instrument = pos.symbol || pos.instrument;
    if (!instrument) continue;
    const lotSize = Number(pos.volume ?? pos.lotSize ?? 0);
    const entryPrice = Number(pos.entryPrice ?? pos.price_open ?? 0);
    const currentPrice = Number(pos.currentPrice ?? pos.price_current ?? entryPrice);
    const floating = Number(pos.profit ?? pos.floatingPL ?? 0);
    const direction = String(pos.direction || pos.type || "").toLowerCase().includes("sell") ? "Sell" : "Buy";
    const riskPercent = equity > 0 ? Math.abs(floating) / equity * 100 : 0;

    await query(
      `INSERT INTO market.portfolio_positions (
        id, account_id, instrument, direction, lot_size, entry_price, current_price, stop_loss, take_profit,
        floating_pl, risk_percent, margin_used, open_time, status, strategy, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        COALESCE($12::timestamptz, now()), 'Open', $13, now()
      )`,
      [
        savedAccountId,
        instrument,
        direction,
        lotSize,
        entryPrice,
        currentPrice,
        pos.stopLoss ?? pos.sl ?? null,
        pos.takeProfit ?? pos.tp ?? null,
        floating,
        riskPercent,
        pos.margin ?? null,
        pos.openTime ?? pos.opened_at ?? null,
        pos.strategy || null
      ]
    );
    positionsSynced += 1;
  }

  return { accountsSynced: 1, positionsSynced };
}

export async function purgeLegacyMockPortfolioRows() {
  if (!isDatabaseConfigured()) return { removedAccounts: 0 };
  const orphan = await query(`SELECT id FROM market.trading_accounts WHERE terminal_id IS NULL`);
  if (!orphan.rows.length) return { removedAccounts: 0 };
  const ids = orphan.rows.map((r) => r.id);
  await query(`DELETE FROM market.portfolio_positions WHERE account_id = ANY($1::uuid[])`, [ids]);
  await query(`DELETE FROM market.portfolio_closed_trades WHERE account_id = ANY($1::uuid[])`, [ids]);
  await query(`DELETE FROM market.portfolio_equity_snapshots WHERE account_id = ANY($1::uuid[])`, [ids]);
  await query(`DELETE FROM market.trading_accounts WHERE terminal_id IS NULL`);
  return { removedAccounts: ids.length };
}

export async function syncPortfolioFromLiveSources() {
  if (!isDatabaseConfigured()) {
    return { status: "DATABASE_NOT_CONFIGURED", accountsSynced: 0, positionsSynced: 0 };
  }

  try {
    await ensurePortfolioSchema();
  } catch (error) {
    return {
      status: "SCHEMA_SETUP_FAILED",
      accountsSynced: 0,
      positionsSynced: 0,
      error: error?.message || String(error),
      hint: "Run: npm run db:bootstrap:portfolio"
    };
  }

  const purged = await purgeLegacyMockPortfolioRows();

  const { rows: terminals } = await query(
    `SELECT t.*, p.name AS provider_name, p.provider_type
     FROM infrastructure.mt5_terminals t
     LEFT JOIN market.market_data_providers p ON p.id = t.provider_id
     ORDER BY t.updated_at DESC`
  );

  let accountsSynced = 0;
  let positionsSynced = 0;
  const startedAt = new Date().toISOString();

  for (const terminal of terminals) {
    const result = await syncTerminalRow(terminal);
    accountsSynced += result.accountsSynced || 0;
    positionsSynced += result.positionsSynced || 0;
  }

  const jobId = randomUUID();
  try {
    await query(
      `INSERT INTO market.portfolio_sync_logs (id, status, records_imported, started_at, completed_at)
       VALUES ($1, 'COMPLETED', $2, $3, now())`,
      [jobId, accountsSynced + positionsSynced, startedAt]
    );
  } catch {
    /* optional */
  }

  return {
    status: "COMPLETED",
    jobId,
    accountsSynced,
    positionsSynced,
    terminalsProcessed: terminals.length,
    legacyRowsRemoved: purged.removedAccounts,
    startedAt,
    completedAt: new Date().toISOString()
  };
}

export async function fetchLivePortfolioRecords() {
  const empty = { accounts: [], openPositions: [], closedTrades: [], equitySnapshots: [], riskRows: [], alerts: [], propCompliance: [] };
  if (!isDatabaseConfigured()) return empty;
  if (!(await isPortfolioSchemaReady())) {
    try {
      await ensurePortfolioSchema();
    } catch {
      return { ...empty, schemaReady: false };
    }
  }

  try {
  const [accountsRes, positionsRes, tradesRes, equityRes, riskRes, alertsRes, propRes] = await Promise.all([
    query(
      `SELECT ta.*
       FROM market.trading_accounts ta
       INNER JOIN infrastructure.mt5_terminals t ON t.id = ta.terminal_id
       ORDER BY ta.equity DESC NULLS LAST`
    ),
    query(
      `SELECT p.*
       FROM market.portfolio_positions p
       INNER JOIN market.trading_accounts ta ON ta.id = p.account_id
       INNER JOIN infrastructure.mt5_terminals t ON t.id = ta.terminal_id
       WHERE p.status = 'Open'
       ORDER BY p.open_time DESC`
    ),
    query(
      `SELECT ct.*
       FROM market.portfolio_closed_trades ct
       INNER JOIN market.trading_accounts ta ON ta.id = ct.account_id
       INNER JOIN infrastructure.mt5_terminals t ON t.id = ta.terminal_id
       ORDER BY ct.closed_at DESC
       LIMIT 500`
    ),
    query(
      `SELECT s.snapshot_at, s.balance, s.equity, s.drawdown_percent
       FROM market.portfolio_equity_snapshots s
       INNER JOIN market.trading_accounts ta ON ta.id = s.account_id
       INNER JOIN infrastructure.mt5_terminals t ON t.id = ta.terminal_id
       ORDER BY s.snapshot_at ASC
       LIMIT 500`
    ),
    query(
      `SELECT DISTINCT ON (metric_name) metric_name, current_value, limit_value, status, measured_at
       FROM market.portfolio_risk_metrics
       ORDER BY metric_name, measured_at DESC`
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT * FROM market.portfolio_alerts WHERE is_resolved = false ORDER BY created_at DESC LIMIT 50`
    ).catch(() => ({ rows: [] })),
    query(`SELECT * FROM market.portfolio_prop_compliance ORDER BY updated_at DESC`).catch(() => ({ rows: [] }))
  ]);

  const accounts = accountsRes.rows.map(mapAccountRow);
  const accountById = Object.fromEntries(accounts.map((a) => [a.id, a]));

  return {
    accounts,
    openPositions: positionsRes.rows.map((row) => mapPositionRow(row, accountById)),
    closedTrades: tradesRes.rows.map((row) => mapClosedTradeRow(row, accountById)),
    equitySnapshots: equityRes.rows,
    riskRows: riskRes.rows,
    alerts: alertsRes.rows,
    propCompliance: propRes.rows
  };
  } catch (error) {
    console.warn("[portfolio-live-data] fetch failed:", error.message);
    return { ...empty, schemaReady: false, fetchError: error.message };
  }
}

export async function countRegisteredMt5Terminals() {
  if (!isDatabaseConfigured()) return 0;
  try {
    const { rows } = await query(`SELECT COUNT(*)::int AS count FROM infrastructure.mt5_terminals`);
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function countTerminalsAwaitingAccountMetrics() {
  if (!isDatabaseConfigured()) return 0;
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count
       FROM infrastructure.mt5_terminals
       WHERE connection_status = 'ONLINE'
         AND COALESCE((account_snapshot->>'balance')::numeric, 0) = 0
         AND COALESCE((account_snapshot->>'equity')::numeric, 0) = 0`
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export function buildExecutiveSummary(accounts) {
  if (!accounts.length) {
    return {
      portfolioValue: 0,
      totalEquity: 0,
      totalBalance: 0,
      floatingPL: 0,
      realizedPL: 0,
      dailyReturnPercent: 0,
      weeklyReturnPercent: 0,
      monthlyReturnPercent: 0,
      ytdReturnPercent: 0,
      maxDrawdownPercent: 0,
      currentDrawdownPercent: 0,
      portfolioRiskScore: "—",
      portfolioRiskLevel: "—",
      marginUsed: 0,
      freeMargin: 0,
      marginLevel: 0,
      openPositions: 0,
      connectedAccounts: 0,
      hasAccounts: false
    };
  }

  const balance = accounts.reduce((s, a) => s + a.balance, 0);
  const equity = accounts.reduce((s, a) => s + a.equity, 0);
  const floatingPL = accounts.reduce((s, a) => s + a.floatingPL, 0);
  const realizedPL = accounts.reduce((s, a) => s + a.realizedPL, 0);
  const marginUsed = accounts.reduce((s, a) => s + a.marginUsed, 0);
  const avgRisk = accounts.reduce((s, a) => s + a.riskScore, 0) / accounts.length;
  const currentDrawdown = accounts.reduce((s, a) => s + a.dailyDrawdownPercent, 0) / accounts.length;
  const level = riskLevel(avgRisk);

  return {
    portfolioValue: equity,
    totalEquity: equity,
    totalBalance: balance,
    floatingPL,
    realizedPL,
    dailyReturnPercent: balance > 0 ? ((equity - balance) / balance) * 100 : 0,
    weeklyReturnPercent: null,
    monthlyReturnPercent: null,
    ytdReturnPercent: null,
    maxDrawdownPercent: Math.max(...accounts.map((a) => a.dailyDrawdownPercent), 0),
    currentDrawdownPercent: currentDrawdown,
    portfolioRiskScore: level,
    portfolioRiskLevel: level,
    marginUsed,
    freeMargin: equity - marginUsed,
    marginLevel: marginUsed > 0 ? (equity / marginUsed) * 100 : 0,
    openPositions: 0,
    connectedAccounts: accounts.filter((a) => a.status !== "Disconnected").length,
    hasAccounts: true
  };
}

function bucketPercent(items, total) {
  if (!total) return items.map((label) => ({ label, percent: 0 }));
  const counts = {};
  for (const label of items) counts[label] = (counts[label] || 0) + 1;
  return Object.entries(counts).map(([label, count]) => ({
    label,
    percent: Math.round((count / total) * 1000) / 10
  }));
}

export function computeAllocations(accounts, positions) {
  const equityTotal = accounts.reduce((s, a) => s + a.equity, 0) || 1;
  const assetWeights = {};
  const currencyWeights = {};
  const brokerWeights = {};
  const strategyWeights = {};

  for (const pos of positions) {
    const notional = Math.abs(pos.floatingPL) + Math.abs(pos.entryPrice * pos.lotSize * 100000) * 0.0001;
    const weight = notional / equityTotal;
    const asset = classifyAsset(pos.instrument);
    assetWeights[asset] = (assetWeights[asset] || 0) + weight;
    currencyWeights[currencyFromSymbol(pos.instrument)] = (currencyWeights[currencyFromSymbol(pos.instrument)] || 0) + weight;
    brokerWeights[pos.brokerName || "Unknown"] = (brokerWeights[pos.brokerName || "Unknown"] || 0) + weight;
    strategyWeights[pos.strategy || "Unassigned"] = (strategyWeights[pos.strategy || "Unassigned"] || 0) + weight;
  }

  for (const account of accounts) {
    brokerWeights[account.brokerName] = (brokerWeights[account.brokerName] || 0) + account.equity / equityTotal;
  }

  const toList = (obj) =>
    Object.entries(obj)
      .map(([label, value]) => ({ label, percent: Math.round(value * 1000) / 10 }))
      .sort((a, b) => b.percent - a.percent);

  return {
    assetClass: toList(assetWeights),
    currency: toList(currencyWeights),
    broker: toList(brokerWeights),
    strategy: toList(strategyWeights)
  };
}

export function computeRiskMetrics(summary, positions) {
  const openRisk = summary.totalEquity > 0 ? (summary.marginUsed / summary.totalEquity) * 100 : 0;
  return [
    { metric: "Current Drawdown", current: `${summary.currentDrawdownPercent.toFixed(2)}%`, limit: "8.00%", level: riskLevel(summary.currentDrawdownPercent * 8) },
    { metric: "Maximum Drawdown", current: `${summary.maxDrawdownPercent.toFixed(2)}%`, limit: "8.00%", level: riskLevel(summary.maxDrawdownPercent * 8) },
    { metric: "Open Risk", current: `${openRisk.toFixed(2)}%`, limit: "5.00%", level: riskLevel(openRisk * 2) },
    { metric: "Portfolio Exposure", current: `${Math.min(openRisk * 2.2, 100).toFixed(1)}%`, limit: "60.00%", level: riskLevel(openRisk * 2) },
    { metric: "Margin Level", current: `${summary.marginLevel.toFixed(0)}%`, limit: "300% min", level: summary.marginLevel >= 300 ? "Low" : "High" },
    { metric: "Open Positions", current: String(positions.length), limit: "—", level: positions.length > 20 ? "High" : "Low" }
  ];
}

export function computeClosedTradeStats(trades) {
  if (!trades.length) {
    return { totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, averageWin: 0, averageLoss: 0, profitFactor: 0, expectancy: 0, sharpeRatio: 0, recoveryFactor: 0 };
  }
  const wins = trades.filter((t) => t.profitLoss > 0);
  const losses = trades.filter((t) => t.profitLoss <= 0);
  const grossWin = wins.reduce((s, t) => s + t.profitLoss, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profitLoss, 0));
  return {
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: (wins.length / trades.length) * 100,
    averageWin: wins.length ? grossWin / wins.length : 0,
    averageLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0,
    expectancy: trades.reduce((s, t) => s + t.profitLoss, 0) / trades.length,
    sharpeRatio: 0,
    recoveryFactor: 0
  };
}

export function computeStrategyPerformance(trades) {
  const byStrategy = {};
  for (const trade of trades) {
    const key = trade.strategy || "Unassigned";
    if (!byStrategy[key]) byStrategy[key] = { strategy: key, trades: 0, wins: 0, netProfit: 0, grossLoss: 0 };
    byStrategy[key].trades += 1;
    if (trade.profitLoss > 0) byStrategy[key].wins += 1;
    if (trade.profitLoss > 0) byStrategy[key].netProfit += trade.profitLoss;
    else byStrategy[key].grossLoss += Math.abs(trade.profitLoss);
  }
  return Object.values(byStrategy).map((s) => ({
    strategy: s.strategy,
    trades: s.trades,
    winRate: s.trades ? Math.round((s.wins / s.trades) * 1000) / 10 : 0,
    profitFactor: s.grossLoss > 0 ? Math.round((s.netProfit / s.grossLoss) * 100) / 100 : s.netProfit > 0 ? 99 : 0,
    netProfit: Math.round(s.netProfit * 100) / 100,
    drawdown: 0,
    riskScore: 30,
    status: "Active"
  }));
}

export function computeDrawdowns(equitySnapshots) {
  if (!equitySnapshots.length) {
    return { current: 0, maximum: 0, longestRecoveryDays: 0, drawdownFrequency: 0, recoverySpeed: 0, timeline: [] };
  }
  let peak = 0;
  let maxDd = 0;
  let currentDd = 0;
  const timeline = [];
  for (const row of equitySnapshots) {
    const equity = Number(row.equity);
    peak = Math.max(peak, equity);
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    maxDd = Math.max(maxDd, dd);
    currentDd = dd;
    timeline.push(Math.round(dd * 100) / 100);
  }
  return {
    current: Math.round(currentDd * 100) / 100,
    maximum: Math.round(maxDd * 100) / 100,
    longestRecoveryDays: 0,
    drawdownFrequency: 0,
    recoverySpeed: 0,
    timeline
  };
}

export function computeCorrelations(positions) {
  const symbols = [...new Set(positions.map((p) => p.instrument))].slice(0, 6);
  if (symbols.length < 2) {
    return { labels: [], values: [], pairs: [] };
  }
  const values = symbols.map((a, i) =>
    symbols.map((b, j) => {
      if (i === j) return 1;
      const sameClass = classifyAsset(a) === classifyAsset(b);
      const sameCurrency = currencyFromSymbol(a) === currencyFromSymbol(b);
      if (a.slice(0, 3) === b.slice(0, 3) || a.slice(3) === b.slice(3)) return 0.75;
      if (sameClass) return 0.45;
      if (sameCurrency) return 0.35;
      return 0.1;
    })
  );
  const pairs = [];
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const coefficient = values[i][j];
      pairs.push({
        pair: `${symbols[i]} vs ${symbols[j]}`,
        coefficient: Math.round(coefficient * 100) / 100,
        type: coefficient >= 0.5 ? "Positive" : coefficient <= -0.2 ? "Negative" : "Neutral"
      });
    }
  }
  return { labels: symbols, values, pairs };
}

export function computeAccountHealth(accounts, positions) {
  return accounts.map((account) => {
    const accountPositions = positions.filter((p) => p.accountId === account.id);
    const openRisk = account.equity > 0 ? account.marginUsed / account.equity * 100 : 0;
    const concentration = accountPositions.length
      ? accountPositions.reduce((s, p) => s + Math.abs(p.floatingPL), 0) / account.equity * 100
      : 0;
    return {
      accountId: account.id,
      marginLevel: account.marginLevel,
      freeMargin: account.freeMargin,
      openRisk: Math.round(openRisk * 100) / 100,
      leverageUsage: account.marginUsed > 0 ? Math.round((account.equity / account.marginUsed) * 10) / 10 : 0,
      tradeConcentration: Math.round(concentration * 100) / 100,
      brokerConnection: account.status === "Disconnected" ? "Offline" : "Healthy",
      syncHealth: account.lastSync ? "Current" : "Stale",
      grade: account.healthGrade
    };
  });
}

export function buildLiveAlerts(summary, accounts) {
  const alerts = [];
  if (!accounts.length) return alerts;
  if (summary.currentDrawdownPercent >= 3) {
    alerts.push({ severity: "Warning", type: "High Drawdown", message: `Portfolio drawdown at ${summary.currentDrawdownPercent.toFixed(2)}%.`, createdAt: new Date().toISOString() });
  }
  if (summary.marginLevel > 0 && summary.marginLevel < 300) {
    alerts.push({ severity: "Critical", type: "Margin Call Risk", message: `Portfolio margin level ${summary.marginLevel.toFixed(0)}% below policy threshold.`, createdAt: new Date().toISOString() });
  }
  for (const account of accounts.filter((a) => a.status === "Disconnected")) {
    alerts.push({ severity: "Emergency", type: "Broker Disconnection", message: `${account.accountName} is disconnected from live sync.`, createdAt: new Date().toISOString() });
  }
  return alerts;
}

export function buildAiInsights(summary, allocations, alerts) {
  if (!summary.hasAccounts) {
    return [{ insight_type: "Connect Accounts", content: "No live trading accounts are synchronized. Connect MT5 via Market Data Providers and ensure EA heartbeats include account snapshots." }];
  }
  const topCurrency = allocations.currency[0];
  const insights = [
    {
      insight_type: "Portfolio Health Summary",
      content: `Portfolio equity ${summary.totalEquity.toFixed(2)} across ${summary.connectedAccounts} connected account(s). Floating P/L ${summary.floatingPL >= 0 ? "+" : ""}${summary.floatingPL.toFixed(2)}.`
    },
    {
      insight_type: "Risk Summary",
      content: `Portfolio risk level ${summary.portfolioRiskLevel}. Current drawdown ${summary.currentDrawdownPercent.toFixed(2)}%, margin level ${summary.marginLevel.toFixed(0)}%.`
    }
  ];
  if (topCurrency && topCurrency.percent >= 50) {
    insights.push({
      insight_type: "Exposure Warning",
      content: `Exposure concentration in ${topCurrency.label} (${topCurrency.percent}%). Consider diversification to reduce correlation risk.`
    });
  }
  if (alerts.length) {
    insights.push({
      insight_type: "Active Alerts",
      content: `${alerts.length} live alert(s): ${alerts.map((a) => a.type).join(", ")}.`
    });
  }
  return insights;
}

export function mapPropComplianceRows(rows, accounts) {
  return rows.map((row) => ({
    accountId: row.account_id,
    firm: row.prop_firm,
    remainingDailyLoss: Number(row.remaining_daily_loss ?? 0),
    remainingMaxDrawdown: Number(row.remaining_max_loss ?? 0),
    profitTargetProgress: Number(row.compliance_score ?? 0),
    minTradingDays: row.rules_status?.minTradingDays || "—",
    complianceScore: Number(row.compliance_score ?? 0),
    rules: row.rules_status || {}
  }));
}

function enrichSummaryFromEquityHistory(summary, equitySnapshots) {
  if (!equitySnapshots.length) return summary;
  const first = Number(equitySnapshots[0]?.equity ?? 0);
  const last = Number(equitySnapshots[equitySnapshots.length - 1]?.equity ?? 0);
  if (first > 0) {
    const totalReturn = ((last - first) / first) * 100;
    summary.monthlyReturnPercent = totalReturn;
    summary.ytdReturnPercent = totalReturn;
  }
  const weekAgo = equitySnapshots.length >= 7 ? Number(equitySnapshots[equitySnapshots.length - 7]?.equity ?? first) : first;
  if (weekAgo > 0) summary.weeklyReturnPercent = ((last - weekAgo) / weekAgo) * 100;
  return summary;
}

export function buildPortfolioDashboard(records, { sync, integrations } = {}) {
  const { accounts, openPositions, closedTrades, equitySnapshots, alerts: storedAlerts, propCompliance } = records;
  const summary = enrichSummaryFromEquityHistory(buildExecutiveSummary(accounts), equitySnapshots);
  summary.openPositions = openPositions.length;
  const allocations = computeAllocations(accounts, openPositions);
  const risk = records.riskRows?.length
    ? records.riskRows.map((r) => ({ metric: r.metric_name, current: r.current_value, limit: r.limit_value, level: r.status }))
    : computeRiskMetrics(summary, openPositions);
  const balanceCurve = equitySnapshots.map((r) => Number(r.balance));
  const equityCurve = equitySnapshots.map((r) => Number(r.equity));
  const drawdowns = computeDrawdowns(equitySnapshots);
  const liveAlerts = [...buildLiveAlerts(summary, accounts), ...storedAlerts.map((a) => ({
    severity: a.severity,
    type: a.alert_type,
    message: a.message,
    createdAt: a.created_at
  }))];

  const header = {
    accountsConnected: accounts.length,
    liveSyncActive: accounts.some((a) => a.status !== "Disconnected"),
    portfolioHealth: summary.currentDrawdownPercent < 5 && accounts.length ? "Healthy" : accounts.length ? "Watchlist" : "No Data",
    riskStatus: summary.portfolioRiskLevel,
    lastSync: accounts.map((a) => a.lastSync).filter(Boolean).sort().reverse()[0] || sync?.lastSync || null
  };

  return {
    title: "Account Portfolio Intelligence Center",
    accounts,
    openPositions,
    closedTrades,
    equityCurve,
    balanceCurve,
    drawdownCurve: drawdowns.timeline,
    growthCurve: equityCurve,
    profitCurve: [],
    risk,
    allocations,
    strategies: computeStrategyPerformance(closedTrades),
    correlations: computeCorrelations(openPositions),
    drawdowns,
    accountHealth: computeAccountHealth(accounts, openPositions),
    propCompliance: mapPropComplianceRows(propCompliance, accounts),
    alerts: liveAlerts,
    closedTradeStats: computeClosedTradeStats(closedTrades),
    integrations,
    sync,
    header,
    reports: [
      { type: "Daily Report", sections: ["Performance", "Risk", "Open Positions", "Exposure", "Alerts"], formats: ["PDF", "Excel", "CSV", "JSON"] },
      { type: "Weekly Report", sections: ["Portfolio Summary", "Trade Analysis", "Risk Analysis", "Strategy Analysis"], formats: ["PDF", "Excel", "CSV", "JSON"] },
      { type: "Monthly Report", sections: ["Return Analysis", "Drawdown Analysis", "Risk Analysis", "Benchmark Comparison"], formats: ["PDF", "Excel", "CSV", "JSON"] }
    ],
    aiInsights: buildAiInsights(summary, allocations, liveAlerts),
    summary,
    emptyState: !accounts.length,
    placeholderMode: false,
    dataSource: "live"
  };
}
