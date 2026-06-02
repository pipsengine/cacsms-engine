BEGIN;

CREATE SCHEMA IF NOT EXISTS infrastructure;
CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS infrastructure.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  hostname text,
  operating_system text,
  agent_version text,
  public_ip text,
  private_ip text,
  mt5_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'OFFLINE',
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS infrastructure.mt5_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid REFERENCES infrastructure.machines(id) ON DELETE CASCADE,
  agent_key text NOT NULL UNIQUE,
  version text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL DEFAULT 'OFFLINE',
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS infrastructure.mt5_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL,
  machine_id uuid REFERENCES infrastructure.machines(id) ON DELETE SET NULL,
  terminal_name text NOT NULL,
  broker_name text,
  broker_search_name text,
  account_number text,
  server_name text,
  environment text NOT NULL DEFAULT 'Production',
  ea_status text NOT NULL DEFAULT 'DISCONNECTED',
  connection_status text NOT NULL DEFAULT 'OFFLINE',
  ea_version text,
  last_heartbeat_at timestamptz,
  latency_ms integer,
  live_symbol_count integer NOT NULL DEFAULT 0,
  onboarding jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS infrastructure.mt5_registration_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE CASCADE,
  terminal_id uuid REFERENCES infrastructure.mt5_terminals(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'USED', 'EXPIRED', 'REVOKED')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS infrastructure.mt5_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL REFERENCES infrastructure.mt5_terminals(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL,
  latency_ms integer,
  packet_loss numeric(7, 4),
  status text NOT NULL DEFAULT 'ONLINE',
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mt5_heartbeats_terminal ON infrastructure.mt5_heartbeats (terminal_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS infrastructure.mt5_market_watch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL REFERENCES infrastructure.mt5_terminals(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL,
  symbol text NOT NULL,
  asset_class text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (terminal_id, symbol)
);

CREATE TABLE IF NOT EXISTS infrastructure.mt5_live_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL REFERENCES infrastructure.mt5_terminals(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL,
  symbol text NOT NULL,
  bid numeric(18, 8),
  ask numeric(18, 8),
  spread numeric(18, 8),
  tick_active boolean NOT NULL DEFAULT true,
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (terminal_id, symbol)
);

CREATE TABLE IF NOT EXISTS infrastructure.mt5_terminal_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL REFERENCES infrastructure.mt5_terminals(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL,
  health_score numeric(7, 4) NOT NULL DEFAULT 0,
  connected_terminals integer NOT NULL DEFAULT 0,
  disconnected_terminals integer NOT NULL DEFAULT 0,
  live_symbols integer NOT NULL DEFAULT 0,
  average_latency_ms integer,
  average_spread numeric(18, 8),
  average_tick_delay_ms integer,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS infrastructure.ea_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL UNIQUE REFERENCES infrastructure.mt5_terminals(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL,
  ea_version text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL DEFAULT 'DISCONNECTED',
  installed_at timestamptz,
  last_update_at timestamptz,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
