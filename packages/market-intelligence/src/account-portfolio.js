import { randomUUID } from "node:crypto";
import { isDatabaseConfigured, query } from "./db.js";
import {
  buildPortfolioDashboard,
  countRegisteredMt5Terminals,
  countTerminalsAwaitingAccountMetrics,
  fetchLivePortfolioRecords,
  syncPortfolioFromLiveSources,
  upsertAccountSnapshotFromHeartbeat
} from "./portfolio-live-data.js";
import { isPortfolioSchemaReady } from "./portfolio-schema.js";
import { portfolioSyncService, PortfolioSyncService } from "./portfolio-sync-service.js";

export { PortfolioSyncService, portfolioSyncService, upsertAccountSnapshotFromHeartbeat };

async function loadIntegrationStatus() {
  if (!isDatabaseConfigured()) {
    return {
      brokerData: { status: "UNAVAILABLE", module: "Broker Data Module" },
      marketData: { status: "UNAVAILABLE", module: "Market Data Module" },
      historicalData: { status: "UNAVAILABLE", module: "Historical Data Module" },
      newsSentiment: { status: "UNAVAILABLE", module: "News Sentiment Module" },
      economicCalendar: { status: "UNAVAILABLE", module: "Economic Calendar Module" },
      propFirmRules: { status: "UNAVAILABLE", module: "Prop Firm Rules Module" }
    };
  }

  const status = (count) => (Number(count) > 0 ? "LINKED" : "NOT_CONFIGURED");
  try {
    const [{ rows: providers }, { rows: terminals }, { rows: prop }] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM market.market_data_providers WHERE enabled = true`),
      query(`SELECT COUNT(*)::int AS count FROM infrastructure.mt5_terminals`),
      query(`SELECT COUNT(*)::int AS count FROM market.prop_firms`).catch(() => ({ rows: [{ count: 0 }] }))
    ]);
    const linked = status(providers[0]?.count);
    return {
      brokerData: { status: linked, module: "Broker Data Module" },
      marketData: { status: status(terminals[0]?.count), module: "Market Data Module" },
      historicalData: { status: "LINKED", module: "Historical Data Module" },
      newsSentiment: { status: "LINKED", module: "News Sentiment Module" },
      economicCalendar: { status: "LINKED", module: "Economic Calendar Module" },
      propFirmRules: { status: status(prop[0]?.count), module: "Prop Firm Rules Module" }
    };
  } catch {
    return {
      brokerData: { status: "DEGRADED", module: "Broker Data Module" },
      marketData: { status: "DEGRADED", module: "Market Data Module" },
      historicalData: { status: "DEGRADED", module: "Historical Data Module" },
      newsSentiment: { status: "DEGRADED", module: "News Sentiment Module" },
      economicCalendar: { status: "DEGRADED", module: "Economic Calendar Module" },
      propFirmRules: { status: "DEGRADED", module: "Prop Firm Rules Module" }
    };
  }
}

export async function getAccountPortfolioDashboard({ sync = false } = {}) {
  if (!isDatabaseConfigured()) {
    return buildPortfolioDashboard(
      { accounts: [], openPositions: [], closedTrades: [], equitySnapshots: [], riskRows: [], alerts: [], propCompliance: [] },
      { sync: { liveSyncActive: false, lastSync: null, supportedPlatforms: portfolioSyncService.getStatus().supportedPlatforms }, integrations: await loadIntegrationStatus() }
    );
  }

  let syncResult = null;
  if (sync) {
    try {
      syncResult = await syncPortfolioFromLiveSources();
    } catch (error) {
      console.warn("[account-portfolio] live sync failed:", error.message);
    }
  }

  const records = await fetchLivePortfolioRecords();
  const schemaReady = await isPortfolioSchemaReady();
  const mt5TerminalsRegistered = await countRegisteredMt5Terminals();
  const terminalsAwaitingMetrics = await countTerminalsAwaitingAccountMetrics();
  const syncStatus = {
    ...portfolioSyncService.getStatus(),
    liveSyncActive: records.accounts.some((a) => a.status !== "Disconnected"),
    lastSync: records.accounts.map((a) => a.lastSync).filter(Boolean).sort().reverse()[0] || syncResult?.completedAt || null,
    lastJob: syncResult,
    schemaReady,
    mt5TerminalsRegistered,
    setupHint: !schemaReady
      ? "Portfolio database tables are missing. Run npm run db:bootstrap:portfolio, then Sync Accounts."
      : terminalsAwaitingMetrics > 0
        ? "MT5 is connected but balance/equity in the portfolio ledger are stale or missing. Recompile CACSMS Engine Bridge v1.0.3 in MetaEditor, re-attach to the chart, and wait for the next EA heartbeat (must include live account metrics from MT5)."
      : !records.accounts.length && mt5TerminalsRegistered > 0
        ? `${mt5TerminalsRegistered} MT5 terminal(s) registered. Click Sync Accounts after the EA sends account metrics.`
        : null
  };
  portfolioSyncService.lastJob = syncResult;

  const dashboard = buildPortfolioDashboard(records, {
    sync: syncStatus,
    integrations: await loadIntegrationStatus()
  });
  dashboard.schemaReady = schemaReady;
  dashboard.mt5TerminalsRegistered = mt5TerminalsRegistered;
  dashboard.terminalsAwaitingMetrics = terminalsAwaitingMetrics;
  dashboard.setupHint = syncStatus.setupHint;
  if (records.fetchError) dashboard.loadError = records.fetchError;
  return dashboard;
}

export async function getPortfolioAccounts() {
  const dash = await getAccountPortfolioDashboard({ sync: false });
  return { accounts: dash.accounts };
}

export async function getPortfolioPositions() {
  const dash = await getAccountPortfolioDashboard({ sync: false });
  return { positions: dash.openPositions };
}

export async function getPortfolioTrades() {
  const dash = await getAccountPortfolioDashboard({ sync: false });
  return { trades: dash.closedTrades };
}

export async function getPortfolioEquity() {
  const dash = await getAccountPortfolioDashboard({ sync: false });
  return {
    equity: dash.equityCurve,
    balance: dash.balanceCurve,
    drawdown: dash.drawdownCurve,
    growth: dash.growthCurve,
    profit: dash.profitCurve
  };
}

export async function getPortfolioRisk() {
  const dash = await getAccountPortfolioDashboard({ sync: false });
  return { riskMetrics: dash.risk };
}

export async function getPortfolioDrawdowns() {
  const dash = await getAccountPortfolioDashboard({ sync: false });
  return { drawdowns: dash.drawdowns };
}

export async function getPortfolioCorrelations() {
  const dash = await getAccountPortfolioDashboard({ sync: false });
  return { correlations: dash.correlations };
}

export async function getPortfolioStrategies() {
  const dash = await getAccountPortfolioDashboard({ sync: false });
  return { strategies: dash.strategies };
}

export async function getPortfolioAlerts() {
  const dash = await getAccountPortfolioDashboard({ sync: false });
  return { alerts: dash.alerts };
}

export async function getPropCompliance(accountId) {
  if (!isDatabaseConfigured()) return null;
  try {
    const res = await query("SELECT * FROM market.portfolio_prop_compliance WHERE account_id = $1", [accountId]);
    return res.rows[0] || null;
  } catch {
    return null;
  }
}

export async function getAiPortfolioInsights() {
  const dash = await getAccountPortfolioDashboard({ sync: false });
  return { insights: dash.aiInsights };
}

export async function generatePortfolioReport(type, format) {
  const reportId = randomUUID();
  if (isDatabaseConfigured()) {
    try {
      await query(
        `INSERT INTO market.portfolio_reports (id, report_type, format, generated_by, metadata)
         VALUES ($1, $2, $3, 'portfolio-api', $4::jsonb)`,
        [reportId, type || "Daily Report", format || "PDF", JSON.stringify({ status: "COMPLETED" })]
      );
    } catch {
      /* table optional */
    }
  }
  return {
    id: reportId,
    type: type || "Daily Report",
    format: format || "PDF",
    generatedAt: new Date().toISOString(),
    status: "COMPLETED",
    downloadUrl: `/api/portfolio/reports/${reportId}/download`
  };
}

export async function syncPortfolioAccounts(options = {}) {
  portfolioSyncService.queryFn = isDatabaseConfigured() ? query : null;
  try {
    const result = await syncPortfolioFromLiveSources();
    portfolioSyncService.lastJob = result;
    return result;
  } catch (error) {
    const failed = {
      status: "FAILED",
      accountsSynced: 0,
      positionsSynced: 0,
      error: error?.message || String(error),
      hint: "Run npm run db:bootstrap:portfolio if trading_accounts table is missing."
    };
    portfolioSyncService.lastJob = failed;
    return failed;
  }
}

export async function importPortfolioStatement(body = {}) {
  return portfolioSyncService.importStatement(body);
}
