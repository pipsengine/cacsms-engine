import { isDatabaseConfigured, query } from "./db.js";
import { listDetectedMt5Terminals } from "./market-data-repository.js";

export const MT5_BROKER_OPTIONS = Object.freeze([
  { brokerName: "IC Markets", brokerSearchName: "Raw Trading Ltd", isCustom: false },
  { brokerName: "Exness", brokerSearchName: "Exness", isCustom: false },
  { brokerName: "Pepperstone", brokerSearchName: "Pepperstone", isCustom: false },
  { brokerName: "FP Markets", brokerSearchName: "FP Markets", isCustom: false },
  { brokerName: "Eightcap", brokerSearchName: "Eightcap", isCustom: false },
  { brokerName: "Tickmill", brokerSearchName: "Tickmill", isCustom: false },
  { brokerName: "HFM", brokerSearchName: "HFM", isCustom: false },
  { brokerName: "XM", brokerSearchName: "XM", isCustom: false },
  { brokerName: "OANDA", brokerSearchName: "OANDA", isCustom: false },
  { brokerName: "FXCM", brokerSearchName: "FXCM", isCustom: false },
  { brokerName: "Custom Broker", brokerSearchName: "", isCustom: true }
]);

const FALLBACK_VERIFIED_SERVERS = Object.freeze([
  {
    id: "fallback-ic-markets-mt5-6",
    brokerName: "IC Markets",
    brokerSearchName: "Raw Trading Ltd",
    serverName: "ICMarketsSC-MT5-6",
    platform: "MT5",
    environment: "Production",
    serverType: "Live",
    verificationStatus: "VERIFIED",
    source: "official_reference",
    isDefault: true,
    isActive: true,
    lastVerifiedAt: "2026-01-01T00:00:00.000Z"
  }
]);

function mapServerRow(row) {
  return {
    id: row.id,
    brokerName: row.broker_name,
    brokerSearchName: row.broker_search_name,
    serverName: row.server_name,
    platform: row.platform,
    environment: row.environment,
    serverType: row.server_type,
    verificationStatus: row.verification_status,
    source: row.source,
    isDefault: row.is_default,
    isActive: row.is_active,
    lastVerifiedAt: row.last_verified_at
  };
}

export function resolveBrokerOption(brokerName) {
  const match = MT5_BROKER_OPTIONS.find((item) => item.brokerName.toLowerCase() === String(brokerName || "").toLowerCase());
  return match || null;
}

export async function listMt5Brokers() {
  return { brokers: MT5_BROKER_OPTIONS };
}

async function queryCatalogServers(brokerName) {
  if (!isDatabaseConfigured()) {
    return FALLBACK_VERIFIED_SERVERS.filter((item) => item.brokerName.toLowerCase() === String(brokerName || "").toLowerCase());
  }
  try {
    const { rows } = await query(
      `SELECT id, broker_name, broker_search_name, server_name, platform, environment, server_type,
              verification_status, source, is_default, is_active, last_verified_at
       FROM infrastructure.broker_server_catalog
       WHERE is_active = true AND lower(broker_name) = lower($1)
         AND verification_status IN ('VERIFIED', 'DISCOVERED', 'ADMIN_DEFINED')
       ORDER BY is_default DESC, verification_status ASC, server_name ASC`,
      [brokerName]
    );
    return rows.map(mapServerRow);
  } catch {
    return FALLBACK_VERIFIED_SERVERS.filter((item) => item.brokerName.toLowerCase() === String(brokerName || "").toLowerCase());
  }
}

function dedupeServers(servers) {
  const seen = new Set();
  return servers.filter((item) => {
    const key = item.serverName.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function listBrokerServers(brokerName) {
  const broker = resolveBrokerOption(brokerName);
  if (!broker && brokerName !== "Custom Broker") {
    return { brokerName, brokerSearchName: "", servers: [], message: "Unknown broker." };
  }
  const servers = await queryCatalogServers(brokerName);
  return {
    brokerName,
    brokerSearchName: broker?.brokerSearchName || "",
    servers: dedupeServers(servers),
    message: servers.length ? null : "No verified servers found. Use Detect Servers or Enter Custom Server."
  };
}

function brokerMatchesTerminal(brokerName, brokerSearchName, terminal) {
  const haystack = [terminal.broker, terminal.dataPath, terminal.terminalName].join(" ").toLowerCase();
  const names = [brokerName, brokerSearchName].filter(Boolean).map((item) => item.toLowerCase());
  return names.some((name) => haystack.includes(name));
}

async function discoverServersFromTerminals({ brokerName, brokerSearchName, terminalId }) {
  const terminals = await listDetectedMt5Terminals();
  const relevant = terminals.filter((terminal) => {
    if (terminalId && terminal.id !== terminalId) return false;
    return brokerMatchesTerminal(brokerName, brokerSearchName, terminal);
  });

  const discovered = [];
  for (const terminal of relevant) {
    const catalogDiscovered = await queryDiscoveredServersForTerminal(brokerName, terminal.id);
    discovered.push(...catalogDiscovered);
  }
  return dedupeServers(discovered);
}

async function queryDiscoveredServersForTerminal(brokerName, terminalId) {
  if (!isDatabaseConfigured()) return [];
  try {
    const { rows } = await query(
      `SELECT id, broker_name, broker_search_name, server_name, platform, environment, server_type,
              verification_status, source, is_default, is_active, last_verified_at
       FROM infrastructure.broker_server_catalog
       WHERE is_active = true AND lower(broker_name) = lower($1)
         AND verification_status = 'DISCOVERED' AND source = 'mt5_discovery'`,
      [brokerName]
    );
    return rows.map(mapServerRow);
  } catch {
    return [];
  }
}

export async function detectBrokerServers(input, { actor = "system.admin" } = {}) {
  const brokerName = String(input.broker_name || input.brokerName || "").trim();
  const broker = resolveBrokerOption(brokerName);
  const brokerSearchName = String(input.broker_search_name || input.brokerSearchName || broker?.brokerSearchName || "").trim();

  if (!brokerName) throw new Error("broker_name_required");

  const catalogServers = await queryCatalogServers(brokerName);
  const discovered = await discoverServersFromTerminals({
    brokerName,
    brokerSearchName,
    terminalId: input.terminal_id || input.terminalId || null
  });

  const servers = dedupeServers([...catalogServers, ...discovered]);
  const discoveredOnly = discovered.filter((item) => item.verificationStatus === "DISCOVERED");
  const searchLabel = brokerSearchName || brokerName;

  return {
    brokerName,
    brokerSearchName: searchLabel,
    servers,
    discoveredCount: discoveredOnly.length,
    message: discoveredOnly.length
      ? `${discoveredOnly.length} server(s) detected for ${searchLabel}.`
      : servers.length
        ? `${servers.length} verified catalog server(s) available for ${searchLabel}. No new terminal servers detected.`
        : `No servers detected. You may select a verified catalog server or enter a custom server manually.`
  };
}

export async function refreshBrokerServers(brokerName) {
  return listBrokerServers(brokerName);
}

export async function saveCustomBrokerServer(input, { actor = "system.admin" } = {}) {
  const brokerName = String(input.broker_name || input.brokerName || "").trim();
  const brokerSearchName = String(input.broker_search_name || input.brokerSearchName || "").trim();
  const serverName = String(input.server_name || input.serverName || "").trim();

  if (!brokerName) throw new Error("broker_name_required");
  if (!serverName) throw new Error("server_name_required");

  const record = {
    brokerName,
    brokerSearchName,
    serverName,
    platform: "MT5",
    environment: input.environment || "Production",
    serverType: input.server_type || input.serverType || "Unknown",
    verificationStatus: "UNVERIFIED",
    source: "custom_user_entry",
    isDefault: false,
    isActive: true,
    lastVerifiedAt: null
  };

  if (!isDatabaseConfigured()) {
    return { saved: false, server: record, message: "Custom server recorded for this session. Database not configured." };
  }

  const { rows } = await query(
    `INSERT INTO infrastructure.broker_server_catalog (
      broker_name, broker_search_name, server_name, platform, environment, server_type,
      verification_status, source, is_default, is_active, last_verified_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,true,NULL)
    ON CONFLICT (broker_name, server_name) DO UPDATE SET
      broker_search_name = EXCLUDED.broker_search_name,
      verification_status = EXCLUDED.verification_status,
      source = EXCLUDED.source,
      is_active = true,
      updated_at = now()
    RETURNING id, broker_name, broker_search_name, server_name, platform, environment, server_type,
              verification_status, source, is_default, is_active, last_verified_at`,
    [
      brokerName, brokerSearchName || brokerName, serverName, record.platform, record.environment,
      record.serverType, record.verificationStatus, record.source
    ]
  );

  return { saved: true, server: mapServerRow(rows[0]), message: "Custom server saved as UNVERIFIED." };
}
