-- Card 03 / Asset Universe Registry
-- Production registry, broker mappings, scan rules, readiness, imports, and audit.

BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.asset_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_key text NOT NULL UNIQUE,
  class_name text NOT NULL,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.symbol_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code text NOT NULL UNIQUE,
  display_name text,
  asset_class text,
  base_asset text,
  quote_asset text,
  status text NOT NULL DEFAULT 'Active',
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE market.asset_universe
  ADD COLUMN IF NOT EXISTS asset_code text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS base_asset text,
  ADD COLUMN IF NOT EXISTS quote_asset text,
  ADD COLUMN IF NOT EXISTS default_timezone text,
  ADD COLUMN IF NOT EXISTS default_session text,
  ADD COLUMN IF NOT EXISTS tick_size numeric,
  ADD COLUMN IF NOT EXISTS pip_size numeric,
  ADD COLUMN IF NOT EXISTS contract_size numeric,
  ADD COLUMN IF NOT EXISTS minimum_lot numeric,
  ADD COLUMN IF NOT EXISTS maximum_lot numeric,
  ADD COLUMN IF NOT EXISTS pending_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE market.asset_universe SET asset_code = COALESCE(asset_code, asset);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_universe_asset_code ON market.asset_universe(asset_code);

CREATE TABLE IF NOT EXISTS market.broker_symbol_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE CASCADE,
  asset text NOT NULL,
  broker text,
  platform text,
  server text,
  broker_symbol text NOT NULL,
  symbol_suffix text,
  symbol_prefix text,
  digits integer,
  tick_size numeric,
  contract_size numeric,
  is_active boolean NOT NULL DEFAULT true,
  last_verified timestamptz,
  verification_status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_scan_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE CASCADE,
  include_universe_scan boolean NOT NULL DEFAULT false,
  include_forex_scanner boolean NOT NULL DEFAULT false,
  include_trend_scanner boolean NOT NULL DEFAULT false,
  include_volatility_scanner boolean NOT NULL DEFAULT false,
  include_liquidity_scanner boolean NOT NULL DEFAULT false,
  include_institutional_scanner boolean NOT NULL DEFAULT false,
  include_sentiment_scanner boolean NOT NULL DEFAULT false,
  include_macro_scanner boolean NOT NULL DEFAULT false,
  include_risk_scanner boolean NOT NULL DEFAULT false,
  include_prop_compliance_scanner boolean NOT NULL DEFAULT false,
  minimum_data_freshness_seconds integer,
  minimum_source_health numeric,
  minimum_liquidity_score numeric,
  maximum_spread_allowed numeric,
  maximum_risk_score numeric,
  required_broker_mapping boolean NOT NULL DEFAULT true,
  required_historical_data boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset_id)
);

CREATE TABLE IF NOT EXISTS market.asset_readiness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE CASCADE,
  readiness text NOT NULL,
  readiness_score numeric NOT NULL DEFAULT 0,
  active_status_score numeric NOT NULL DEFAULT 0,
  scan_enabled_score numeric NOT NULL DEFAULT 0,
  broker_mapping_score numeric NOT NULL DEFAULT 0,
  live_price_feed_score numeric NOT NULL DEFAULT 0,
  historical_data_score numeric NOT NULL DEFAULT 0,
  source_health_score numeric NOT NULL DEFAULT 0,
  liquidity_score numeric NOT NULL DEFAULT 0,
  compliance_score numeric NOT NULL DEFAULT 0,
  rules_score numeric NOT NULL DEFAULT 0,
  blocking_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_source text NOT NULL,
  file_name text,
  status text NOT NULL DEFAULT 'Pending Review',
  total_rows integer NOT NULL DEFAULT 0,
  accepted_rows integer NOT NULL DEFAULT 0,
  rejected_rows integer NOT NULL DEFAULT 0,
  created_by text NOT NULL DEFAULT 'api',
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES market.asset_import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  asset_code text,
  display_name text,
  asset_class text,
  broker_symbol text,
  status text NOT NULL DEFAULT 'Pending Review',
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_universe_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'asset_universe',
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_universe_status ON market.asset_universe(status, scanner_enabled, active);
CREATE INDEX IF NOT EXISTS idx_broker_symbol_mappings_asset ON market.broker_symbol_mappings(asset_id, is_active);
CREATE INDEX IF NOT EXISTS idx_asset_readiness_latest ON market.asset_readiness_scores(asset_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_import_batches_created ON market.asset_import_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_universe_audit_time ON market.asset_universe_audit_logs(created_at DESC);

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('universe_scanner.universe.view', 'universe_scanner.universe', 'view', 'View Asset Universe Registry'),
  ('universe_scanner.universe.create', 'universe_scanner.universe', 'create', 'Create registry assets'),
  ('universe_scanner.universe.update', 'universe_scanner.universe', 'update', 'Update registry assets'),
  ('universe_scanner.universe.delete', 'universe_scanner.universe', 'delete', 'Archive registry assets'),
  ('universe_scanner.universe.import', 'universe_scanner.universe', 'import', 'Import verified asset lists'),
  ('universe_scanner.universe.sync_broker_symbols', 'universe_scanner.universe', 'sync_broker_symbols', 'Sync broker symbols into pending review'),
  ('universe_scanner.universe.map_symbol', 'universe_scanner.universe', 'map_symbol', 'Map broker symbols to assets'),
  ('universe_scanner.universe.enable_scan', 'universe_scanner.universe', 'enable_scan', 'Enable asset scanning'),
  ('universe_scanner.universe.disable_scan', 'universe_scanner.universe', 'disable_scan', 'Disable asset scanning'),
  ('universe_scanner.universe.export', 'universe_scanner.universe', 'export', 'Export Asset Universe Registry')
ON CONFLICT (code) DO NOTHING;

COMMIT;
