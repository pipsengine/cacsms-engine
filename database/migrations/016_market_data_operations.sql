BEGIN;

CREATE TABLE market.market_data_providers (
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

CREATE TABLE market.market_data_health (
  observed_at timestamptz NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES market.market_data_providers(id) ON DELETE CASCADE,
  status text NOT NULL,
  health numeric(7, 4) NOT NULL,
  freshness text NOT NULL,
  tick_rate integer,
  PRIMARY KEY (observed_at, id)
);
SELECT create_hypertable('market.market_data_health', by_range('observed_at'), if_not_exists => TRUE);

CREATE TABLE market.market_data_latency (
  observed_at timestamptz NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES market.market_data_providers(id) ON DELETE CASCADE,
  latency_ms integer NOT NULL,
  latency_class text NOT NULL,
  PRIMARY KEY (observed_at, id)
);
SELECT create_hypertable('market.market_data_latency', by_range('observed_at'), if_not_exists => TRUE);

CREATE TABLE market.market_data_integrity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_at timestamptz NOT NULL DEFAULT now(),
  integrity_score numeric(7, 4) NOT NULL,
  checks jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE market.market_data_ticks (
  observed_at timestamptz NOT NULL DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL,
  bid numeric(18, 8),
  ask numeric(18, 8),
  spread numeric(18, 8),
  PRIMARY KEY (observed_at, id)
);
SELECT create_hypertable('market.market_data_ticks', by_range('observed_at'), if_not_exists => TRUE);

CREATE TABLE market.market_data_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  asset_class text NOT NULL,
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE market.market_data_coverage (
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

CREATE TABLE market.market_data_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES market.market_data_providers(id) ON DELETE SET NULL,
  event text NOT NULL,
  severity text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market.market_data_confidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_at timestamptz NOT NULL DEFAULT now(),
  confidence_score numeric(7, 4) NOT NULL,
  integrity_score numeric(7, 4) NOT NULL,
  workflow_permission text NOT NULL,
  factors jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMIT;
