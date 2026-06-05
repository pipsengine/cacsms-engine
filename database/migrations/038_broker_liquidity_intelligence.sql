BEGIN;

CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS security.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.broker_liquidity_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input_key text NOT NULL,
  input_label text NOT NULL,
  provider_name text,
  broker_name text,
  server_name text,
  status text NOT NULL DEFAULT 'unavailable',
  freshness_seconds integer,
  health_score numeric(7, 4),
  weight numeric(7, 4) NOT NULL DEFAULT 1,
  last_updated_at timestamptz,
  used_in_liquidity_score boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broker_liquidity_inputs_key_provider
  ON market.broker_liquidity_inputs (input_key, COALESCE(provider_name, ''), COALESCE(broker_name, ''), COALESCE(server_name, ''));

CREATE TABLE IF NOT EXISTS market.broker_liquidity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name text NOT NULL,
  platform text NOT NULL,
  server_name text NOT NULL,
  account_type text,
  instrument text NOT NULL,
  bid numeric(20, 8),
  ask numeric(20, 8),
  spread numeric(20, 8),
  average_spread numeric(20, 8),
  spread_change_percent numeric(9, 4),
  slippage_avg numeric(20, 8),
  execution_speed_ms integer,
  order_rejection_percent numeric(9, 4),
  depth_available boolean,
  depth_score numeric(7, 4),
  liquidity_score numeric(7, 4),
  spread_stability_score numeric(7, 4),
  spread_widening_risk numeric(7, 4),
  slippage_risk numeric(7, 4),
  execution_quality_score numeric(7, 4),
  order_rejection_risk numeric(7, 4),
  session_liquidity_score numeric(7, 4),
  news_liquidity_risk numeric(7, 4),
  broker_tradeability_score numeric(7, 4),
  tradeability text,
  source_record_id text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_liquidity_scores_latest
  ON market.broker_liquidity_scores (observed_at DESC, broker_name, instrument);

CREATE TABLE IF NOT EXISTS market.broker_spread_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name text NOT NULL,
  platform text,
  server_name text,
  account_type text,
  instrument text NOT NULL,
  session_name text,
  news_window text,
  current_spread numeric(20, 8),
  average_spread numeric(20, 8),
  minimum_spread numeric(20, 8),
  maximum_spread numeric(20, 8),
  spread_percentile numeric(7, 4),
  spread_widening_percent numeric(9, 4),
  spread_stability text,
  alert_status text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_spread_metrics_latest
  ON market.broker_spread_metrics (observed_at DESC, broker_name, instrument);

CREATE TABLE IF NOT EXISTS market.broker_slippage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name text NOT NULL,
  platform text,
  server_name text,
  account_type text,
  instrument text NOT NULL,
  order_type text,
  average_slippage numeric(20, 8),
  positive_slippage numeric(20, 8),
  negative_slippage numeric(20, 8),
  execution_time_ms integer,
  rejected_orders integer NOT NULL DEFAULT 0,
  partial_fills integer NOT NULL DEFAULT 0,
  timeouts integer NOT NULL DEFAULT 0,
  requotes integer NOT NULL DEFAULT 0,
  modification_failures integer NOT NULL DEFAULT 0,
  reject_rate numeric(9, 4),
  fill_quality text,
  risk_level text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_slippage_metrics_latest
  ON market.broker_slippage_metrics (observed_at DESC, broker_name, instrument);

CREATE TABLE IF NOT EXISTS market.broker_execution_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name text NOT NULL,
  platform text,
  server_name text,
  instrument text,
  latency_ms integer,
  execution_speed_ms integer,
  reject_rate numeric(9, 4),
  fill_quality text,
  depth_availability numeric(7, 4),
  news_performance numeric(7, 4),
  session_stability numeric(7, 4),
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.broker_liquidity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name text NOT NULL,
  broker_name text,
  instrument text,
  average_spread numeric(20, 8),
  liquidity_condition text,
  slippage_risk text,
  execution_quality text,
  volatility_risk text,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.broker_liquidity_news_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  currency text,
  affected_instruments text[] NOT NULL DEFAULT '{}',
  event_time timestamptz,
  risk_window text,
  liquidity_risk text,
  trading_recommendation text,
  prop_firm_restriction boolean NOT NULL DEFAULT false,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.broker_liquidity_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name text,
  instrument text,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'high_risk', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  source text NOT NULL DEFAULT 'broker_liquidity_engine',
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS market.broker_liquidity_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary text NOT NULL,
  confidence_score numeric(7, 4),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.broker_liquidity_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL DEFAULT 'system',
  permission text,
  action text NOT NULL,
  result text NOT NULL DEFAULT 'accepted',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('market_intelligence.broker_liquidity.view', 'market_intelligence.broker_liquidity', 'view', 'View broker liquidity intelligence'),
  ('market_intelligence.broker_liquidity.recalculate', 'market_intelligence.broker_liquidity', 'recalculate', 'Recalculate broker liquidity scores'),
  ('market_intelligence.broker_liquidity.run_check', 'market_intelligence.broker_liquidity', 'run_check', 'Run broker liquidity check'),
  ('market_intelligence.broker_liquidity.configure_brokers', 'market_intelligence.broker_liquidity', 'configure_brokers', 'Configure broker liquidity inputs'),
  ('market_intelligence.broker_liquidity.export', 'market_intelligence.broker_liquidity', 'export', 'Export broker liquidity reports'),
  ('market_intelligence.broker_liquidity.create_alert', 'market_intelligence.broker_liquidity', 'create_alert', 'Create broker liquidity alerts')
ON CONFLICT (code) DO NOTHING;

COMMIT;
