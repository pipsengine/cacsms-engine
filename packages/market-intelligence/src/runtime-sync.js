import { isDatabaseConfigured } from "./db.js";
import { ensureTerminalPathLinks } from "./ea-deployment.js";
import {
  evaluateAndActivateProvider,
  getMt5InfrastructureDashboard,
  importMarketWatch,
  registerTerminalForProvider
} from "./mt5-infrastructure.js";
import { listProviders } from "./market-data-repository.js";

const DEFAULT_INTERVAL_MS = 30000;
let lastSyncAt = 0;
let lastSyncResult = null;
let syncInFlight = null;

function isMt5Provider(provider) {
  return provider.connectionMethod === "MT5 Bridge" || provider.providerType === "MT5";
}

export async function runMarketDataRuntimeSync({
  force = false,
  skipThrottle = false,
  liveProbe = null
} = {}) {
  if (!isDatabaseConfigured()) {
    return { syncedAt: null, skipped: true, reason: "database_not_configured" };
  }

  const intervalMs = Number(process.env.CACSMS_AUTO_SYNC_MS || DEFAULT_INTERVAL_MS);
  const now = Date.now();
  if (!force && !skipThrottle && lastSyncResult && now - lastSyncAt < intervalMs) {
    return { ...lastSyncResult, skipped: true, reason: "throttled" };
  }
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const actions = [];
    try {
      const linked = await ensureTerminalPathLinks();
      if (linked.synced) actions.push(`linked_${linked.synced}_terminal_paths`);

      await getMt5InfrastructureDashboard();
      let providers = (await listProviders()).filter((item) => item.enabled);
      const mt5Providers = providers.filter(isMt5Provider);
      let mt5 = await getMt5InfrastructureDashboard();

      for (const provider of mt5Providers) {
        const terminal = mt5.terminals.find((item) => item.providerId === provider.id);
        if (!terminal) {
          await registerTerminalForProvider(provider.id);
          actions.push(`registered_terminal:${provider.name}`);
        }
      }

      mt5 = await getMt5InfrastructureDashboard();
      for (const terminal of mt5.terminals) {
        const connected = terminal.eaStatus === "CONNECTED" && terminal.connectionStatus === "ONLINE";
        const symbols = Number(terminal.liveSymbolCount || 0);
        if (connected && symbols === 0) {
          await importMarketWatch(terminal.id);
          actions.push(`imported_market_watch:${terminal.terminalName}`);
        }
      }

      for (const provider of mt5Providers) {
        const activation = await evaluateAndActivateProvider(provider.id);
        if (activation.activated) actions.push(`activated:${provider.name}`);
      }

      const mt5After = await getMt5InfrastructureDashboard();
      const activeProvider = mt5Providers.find((item) => ["ACTIVE", "LIVE"].includes(item.status));
      const terminal = mt5After.terminals.find((item) => item.providerId === activeProvider?.id) || mt5After.terminals[0];
      const bridgeOnline = Boolean(
        activeProvider
        && terminal?.connectionStatus === "ONLINE"
        && terminal?.eaStatus === "CONNECTED"
        && Number(terminal?.liveSymbolCount || 0) > 0
      );
      if (bridgeOnline) actions.push("mt5_bridge_online");

      lastSyncAt = Date.now();
      lastSyncResult = {
        syncedAt: new Date(lastSyncAt).toISOString(),
        actions,
        mt5BridgeOnline: bridgeOnline,
        terminals: mt5.terminals.length,
        providers: mt5Providers.length,
        skipped: false
      };
      return lastSyncResult;
    } catch (error) {
      lastSyncAt = Date.now();
      lastSyncResult = {
        syncedAt: new Date(lastSyncAt).toISOString(),
        actions,
        error: error instanceof Error ? error.message : String(error),
        skipped: false
      };
      return lastSyncResult;
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

export function getLastRuntimeSyncResult() {
  return lastSyncResult;
}

export function startMarketDataRuntimeSyncLoop({ intervalMs = Number(process.env.CACSMS_AUTO_SYNC_MS || DEFAULT_INTERVAL_MS), onSync = null } = {}) {
  if (intervalMs <= 0 || startMarketDataRuntimeSyncLoop.started) return;
  startMarketDataRuntimeSyncLoop.started = true;

  const tick = async () => {
    try {
      const result = await runMarketDataRuntimeSync({ force: true });
      if (onSync) await onSync(result);
    } catch (error) {
      console.error("[runtime-sync]", error instanceof Error ? error.message : error);
    }
  };

  setTimeout(tick, 3000);
  setInterval(tick, intervalMs);
}
