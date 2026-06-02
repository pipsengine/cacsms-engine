BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS market;
CREATE SCHEMA IF NOT EXISTS infrastructure;

CREATE TABLE IF NOT EXISTS market.market_data_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  name text NOT NULL,
  provider_type text NOT NULL,
  phase integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  api_url text,
  status text NOT NULL DEFAULT 'NOT_CONFIGURED',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.market_data_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_at timestamptz NOT NULL DEFAULT now(),
  provider_id uuid NOT NULL REFERENCES market.market_data_providers(id) ON DELETE CASCADE,
  status text NOT NULL,
  health numeric(7, 4) NOT NULL,
  freshness text NOT NULL,
  tick_rate integer
);

CREATE TABLE IF NOT EXISTS market.market_data_latency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_at timestamptz NOT NULL DEFAULT now(),
  provider_id uuid NOT NULL REFERENCES market.market_data_providers(id) ON DELETE CASCADE,
  latency_ms integer NOT NULL,
  latency_class text NOT NULL
);

CREATE TABLE IF NOT EXISTS market.market_data_integrity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_at timestamptz NOT NULL DEFAULT now(),
  integrity_score numeric(7, 4) NOT NULL,
  checks jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.market_data_ticks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_at timestamptz NOT NULL DEFAULT now(),
  symbol text NOT NULL,
  provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL,
  bid numeric(18, 8),
  ask numeric(18, 8),
  spread numeric(18, 8)
);

CREATE TABLE IF NOT EXISTS market.market_data_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  asset_class text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.market_data_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES market.market_data_providers(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  price_feed boolean NOT NULL DEFAULT false,
  tick_feed boolean NOT NULL DEFAULT false,
  spread_feed boolean NOT NULL DEFAULT false,
  volume_feed boolean NOT NULL DEFAULT false,
  coverage numeric(7, 4) NOT NULL DEFAULT 0,
  status text NOT NULL,
  UNIQUE (provider_id, symbol)
);

CREATE TABLE IF NOT EXISTS market.market_data_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL,
  provider_name text,
  event text NOT NULL,
  action text,
  actor text,
  result text,
  severity text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.market_data_confidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_at timestamptz NOT NULL DEFAULT now(),
  confidence_score numeric(7, 4) NOT NULL,
  integrity_score numeric(7, 4) NOT NULL,
  workflow_permission text NOT NULL,
  factors jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE market.market_data_providers
  ADD COLUMN IF NOT EXISTS connection_method text,
  ADD COLUMN IF NOT EXISTS base_url text,
  ADD COLUMN IF NOT EXISTS websocket_url text,
  ADD COLUMN IF NOT EXISTS auth_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS vault_secret_ref text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'Production',
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS supported_asset_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS vendor_website text,
  ADD COLUMN IF NOT EXISTS contact_info text,
  ADD COLUMN IF NOT EXISTS port integer,
  ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS asset_coverage jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supported_symbols jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS health_score numeric(7, 4),
  ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by text;

CREATE UNIQUE INDEX IF NOT EXISTS market_data_providers_provider_code_uq
  ON market.market_data_providers (provider_code)
  WHERE provider_code IS NOT NULL AND archived = false;

CREATE UNIQUE INDEX IF NOT EXISTS market_data_providers_name_uq
  ON market.market_data_providers (lower(name))
  WHERE archived = false;

INSERT INTO market.market_data_symbols (symbol, asset_class)
VALUES
  ('EURUSD', 'forex'), ('GBPUSD', 'forex'), ('USDJPY', 'forex'), ('AUDUSD', 'forex'),
  ('USDCAD', 'forex'), ('USDCHF', 'forex'), ('NZDUSD', 'forex'), ('EURJPY', 'forex'),
  ('GBPJPY', 'forex'), ('AUDJPY', 'forex'), ('CADJPY', 'forex'), ('EURGBP', 'forex'),
  ('EURAUD', 'forex'), ('EURCAD', 'forex'), ('XAUUSD', 'metals'), ('NAS100', 'indices'),
  ('US30', 'indices'), ('SPX500', 'indices'), ('GER40', 'indices'), ('USOIL', 'commodities')
ON CONFLICT (symbol) DO NOTHING;

CREATE TABLE IF NOT EXISTS market.market_data_provider_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE CASCADE,
  test_type text NOT NULL,
  result text NOT NULL CHECK (result IN ('PASS', 'WARNING', 'FAIL')),
  latency_ms integer,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text NOT NULL DEFAULT 'system.admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.market_data_provider_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES market.market_data_providers(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  asset_class text,
  source text NOT NULL DEFAULT 'detected',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, symbol)
);

CREATE TABLE IF NOT EXISTS market.market_data_provider_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES market.market_data_providers(id) ON DELETE CASCADE,
  workflow_card text NOT NULL,
  target text NOT NULL,
  impact text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, workflow_card)
);

CREATE TABLE IF NOT EXISTS infrastructure.broker_server_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name text NOT NULL,
  broker_search_name text NOT NULL DEFAULT '',
  server_name text NOT NULL,
  platform text NOT NULL DEFAULT 'MT5',
  environment text NOT NULL DEFAULT 'Production',
  server_type text NOT NULL DEFAULT 'Unknown',
  verification_status text NOT NULL CHECK (verification_status IN ('VERIFIED', 'DISCOVERED', 'ADMIN_DEFINED', 'UNVERIFIED')),
  source text NOT NULL CHECK (source IN ('official_reference', 'mt5_discovery', 'admin_created', 'custom_user_entry')),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_name, server_name)
);

INSERT INTO infrastructure.broker_server_catalog (
  broker_name, broker_search_name, server_name, platform, environment, server_type,
  verification_status, source, is_default, is_active, last_verified_at
) VALUES
  ('IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-Demo', 'MT5', 'Demo', 'Demo', 'VERIFIED', 'official_reference', false, true, now()),
  ('IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-MT5', 'MT5', 'Production', 'Live', 'VERIFIED', 'official_reference', false, true, now()),
  ('IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-MT5-2', 'MT5', 'Production', 'Live', 'VERIFIED', 'official_reference', false, true, now()),
  ('IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-MT5-3', 'MT5', 'Production', 'Live', 'VERIFIED', 'official_reference', false, true, now()),
  ('IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-MT5-4', 'MT5', 'Production', 'Live', 'VERIFIED', 'official_reference', false, true, now()),
  ('IC Markets', 'Raw Trading Ltd', 'ICMarketsSC-MT5-6', 'MT5', 'Production', 'Live', 'VERIFIED', 'official_reference', true, true, now())
ON CONFLICT (broker_name, server_name) DO UPDATE SET
  broker_search_name = EXCLUDED.broker_search_name,
  verification_status = EXCLUDED.verification_status,
  source = EXCLUDED.source,
  is_default = EXCLUDED.is_default,
  is_active = EXCLUDED.is_active,
  last_verified_at = EXCLUDED.last_verified_at,
  updated_at = now();

COMMIT;
