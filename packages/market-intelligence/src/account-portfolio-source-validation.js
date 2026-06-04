import { isDatabaseConfigured } from "./db.js";
import { fetchLivePortfolioRecords } from "./portfolio-live-data.js";
import { ensurePortfolioSchema } from "./portfolio-schema.js";
import { getMt5InfrastructureDashboard } from "./mt5-infrastructure.js";

function failedChecks(message) {
  return {
    configured: false,
    availability: false,
    apiValidation: false,
    latency: "NOT TESTED",
    freshness: "UNAVAILABLE",
    quality: "FAILED",
    message
  };
}

function passedChecks(latencyMs, freshnessLabel = "LIVE") {
  return {
    configured: true,
    availability: true,
    apiValidation: true,
    latency: latencyMs != null ? `${latencyMs} ms` : "NOT TESTED",
    freshness: freshnessLabel,
    quality: "PASSED"
  };
}

export async function buildAccountPortfolioLiveSourceSnapshot() {
  const base = {
    id: "account-portfolio-data",
    routeSlug: "account-portfolio",
    name: "Account & Portfolio Data",
    category: "account-portfolio-data",
    subtitle: "Balance, equity, margin, exposure, and open positions from MT5-linked portfolio ledger.",
    required: true,
    feedsStage: "Card 1",
    failureAction: "block_card_1",
    configuration: "Connect MT5 in Market Data Providers, deploy the EA, and sync Account Portfolio Intelligence.",
    connectionLabel: "MT5 Portfolio Ledger",
    adapter: "mt5_portfolio_ledger",
    envKey: "ACCOUNT_PORTFOLIO_LIVE_URL",
    httpStatus: null,
    probeError: null
  };

  if (!isDatabaseConfigured()) {
    return {
      ...base,
      provider: "Provider Not Connected",
      status: "NOT_CONFIGURED",
      lastSyncAt: null,
      freshnessSeconds: 0,
      freshness: "UNAVAILABLE",
      healthScore: 0,
      latencyMs: 0,
      errorCount: 1,
      records: 0,
      checks: failedChecks("Database not configured")
    };
  }

  try {
    await ensurePortfolioSchema();
  } catch (error) {
    return {
      ...base,
      provider: "Portfolio Ledger",
      status: "FAILED",
      lastSyncAt: null,
      freshnessSeconds: 0,
      freshness: "UNAVAILABLE",
      healthScore: 0,
      latencyMs: 0,
      errorCount: 1,
      records: 0,
      probeError: error.message,
      checks: failedChecks("Run npm run db:bootstrap:portfolio")
    };
  }

  const records = await fetchLivePortfolioRecords();
  const fundedAccounts = records.accounts.filter((row) => Number(row.balance) > 0 || Number(row.equity) > 0);
  const lastSync = fundedAccounts.map((row) => row.lastSync).filter(Boolean).sort().reverse()[0] || null;
  const freshnessSeconds = lastSync
    ? Math.max(0, Math.round((Date.now() - new Date(lastSync).getTime()) / 1000))
    : 0;

  if (fundedAccounts.length) {
    const primary = fundedAccounts[0];
    const checks = passedChecks(0, freshnessSeconds < 120 ? "LIVE" : "SYNCED");
    return {
      ...base,
      provider: `${primary.brokerName} · ${primary.accountName}`,
      status: freshnessSeconds < 300 ? "LIVE" : "SYNCED",
      lastSyncAt: lastSync,
      freshnessSeconds,
      freshness: freshnessSeconds < 120 ? "REAL-TIME" : `${freshnessSeconds}s since portfolio sync`,
      healthScore: 98,
      latencyMs: 0,
      errorCount: 0,
      records: fundedAccounts.length + records.openPositions.length,
      configuration: "MT5 account metrics synchronized to production portfolio ledger.",
      checks
    };
  }

  const mt5 = await getMt5InfrastructureDashboard();
  const terminal = mt5.terminals[0];
  if (terminal) {
    if (terminal.accountMetricsReceived) {
      const checks = passedChecks(terminal.latencyMs, "EA HEARTBEAT");
      return {
        ...base,
        provider: terminal.brokerName || terminal.terminalName,
        status: "ONLINE",
        lastSyncAt: terminal.lastHeartbeat,
        freshnessSeconds: terminal.lastHeartbeatAgeSec || 0,
        freshness: "EA account metrics received — run Sync Accounts on portfolio page",
        healthScore: 85,
        latencyMs: terminal.latencyMs || 0,
        errorCount: 0,
        records: 1,
        configuration: "Account metrics in MT5 terminal snapshot. Open Account Portfolio and click Sync Accounts.",
        checks
      };
    }
    if (terminal.connectionStatus === "ONLINE") {
      return {
        ...base,
        provider: terminal.brokerName || terminal.terminalName,
        status: "FAILED",
        lastSyncAt: terminal.lastHeartbeat,
        freshnessSeconds: terminal.lastHeartbeatAgeSec || 0,
        freshness: "UNAVAILABLE",
        healthScore: 0,
        latencyMs: terminal.latencyMs || 10,
        errorCount: 1,
        records: 0,
        configuration: "MT5 is online but balance/equity are missing from EA heartbeats. Recompile CACSMS Engine Bridge v1.0.3 and re-attach.",
        checks: failedChecks("EA heartbeat missing account metrics")
      };
    }
  }

  return {
    ...base,
    provider: "Provider Not Connected",
    status: "NOT_CONFIGURED",
    lastSyncAt: null,
    freshnessSeconds: 0,
    freshness: "UNAVAILABLE",
    healthScore: 0,
    latencyMs: 0,
    errorCount: 1,
    records: 0,
    checks: failedChecks("Register MT5 terminal and sync portfolio accounts")
  };
}
