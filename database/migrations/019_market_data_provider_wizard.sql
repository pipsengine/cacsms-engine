BEGIN;

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

CREATE INDEX IF NOT EXISTS idx_market_data_provider_tests_provider
  ON market.market_data_provider_tests (provider_id, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_market_data_provider_symbols_provider
  ON market.market_data_provider_symbols (provider_id);

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

CREATE INDEX IF NOT EXISTS idx_market_data_provider_dependencies_provider
  ON market.market_data_provider_dependencies (provider_id);

COMMIT;
