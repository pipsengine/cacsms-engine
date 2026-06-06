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

ALTER TABLE infrastructure.machines
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS operating_system text,
  ADD COLUMN IF NOT EXISTS agent_version text,
  ADD COLUMN IF NOT EXISTS public_ip text,
  ADD COLUMN IF NOT EXISTS private_ip text,
  ADD COLUMN IF NOT EXISTS mt5_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'infrastructure' AND table_name = 'machines' AND column_name = 'machine_key'
  ) THEN
    ALTER TABLE infrastructure.machines
      ALTER COLUMN machine_key SET DEFAULT ('machine-' || gen_random_uuid()::text);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'infrastructure' AND table_name = 'machines' AND column_name = 'region'
  ) THEN
    ALTER TABLE infrastructure.machines
      ALTER COLUMN region SET DEFAULT 'local';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS machines_name_key ON infrastructure.machines (name);

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

ALTER TABLE infrastructure.mt5_terminals
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS terminal_name text,
  ADD COLUMN IF NOT EXISTS broker_name text,
  ADD COLUMN IF NOT EXISTS broker_search_name text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS server_name text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'Production',
  ADD COLUMN IF NOT EXISTS ea_status text NOT NULL DEFAULT 'DISCONNECTED',
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'OFFLINE',
  ADD COLUMN IF NOT EXISTS ea_version text,
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS live_symbol_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE infrastructure.mt5_terminals
SET terminal_name = COALESCE(terminal_name, 'MT5 Terminal'),
    environment = COALESCE(environment, 'Production'),
    ea_status = COALESCE(ea_status, 'DISCONNECTED'),
    connection_status = COALESCE(connection_status, 'OFFLINE'),
    live_symbol_count = COALESCE(live_symbol_count, 0),
    onboarding = COALESCE(onboarding, '{}'::jsonb),
    updated_at = COALESCE(updated_at, now());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'infrastructure' AND table_name = 'mt5_terminals' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE infrastructure.mt5_terminals ALTER COLUMN agent_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'infrastructure' AND table_name = 'mt5_terminals' AND column_name = 'terminal_key'
  ) THEN
    ALTER TABLE infrastructure.mt5_terminals ALTER COLUMN terminal_key DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'infrastructure' AND table_name = 'mt5_terminals' AND column_name = 'installation_path'
  ) THEN
    ALTER TABLE infrastructure.mt5_terminals ALTER COLUMN installation_path DROP NOT NULL;
  END IF;

  ALTER TABLE infrastructure.mt5_terminals ALTER COLUMN terminal_name SET NOT NULL;
END $$;

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

ALTER TABLE infrastructure.ea_connections
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_update_at timestamptz,
  ALTER COLUMN status TYPE text USING status::text,
  ALTER COLUMN status SET DEFAULT 'DISCONNECTED';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'infrastructure' AND table_name = 'ea_connections' AND column_name = 'certificate_fingerprint'
  ) THEN
    ALTER TABLE infrastructure.ea_connections ALTER COLUMN certificate_fingerprint DROP NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ea_connections_terminal_id_key ON infrastructure.ea_connections (terminal_id);

COMMIT;
