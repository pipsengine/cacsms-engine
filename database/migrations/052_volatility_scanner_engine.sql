-- Card 03 / Volatility Scanner Engine
-- Production-only volatility scores, MTF matrix, expansion, compression, breakout readiness, abnormal risk, AI summaries, alerts, and audit.

BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.volatility_scanner_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'Queued',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  assets_scanned integer NOT NULL DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'system',
  health text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.asset_volatility_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.volatility_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  atr numeric,
  adr numeric,
  historical_volatility numeric,
  realized_volatility numeric,
  volatility_rank numeric,
  volatility_percentile numeric,
  expansion_score numeric,
  compression_score numeric,
  breakout_readiness_score numeric,
  abnormal_volatility_risk numeric,
  overall_volatility text NOT NULL DEFAULT 'Insufficient Data',
  volatility_condition text,
  volatility_score numeric,
  confidence numeric,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_volatility_timeframe_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.volatility_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text NOT NULL,
  atr numeric,
  volatility_state text NOT NULL DEFAULT 'No Data',
  expansion_compression_state text,
  confidence numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_volatility_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.volatility_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  rank integer,
  atr numeric,
  adr numeric,
  realized_volatility numeric,
  volatility_rank numeric,
  volatility_percentile numeric,
  expansion_score numeric,
  compression_score numeric,
  breakout_readiness text,
  abnormal_risk text,
  volatility_score numeric,
  confidence numeric,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_volatility_expansion_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.volatility_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text,
  previous_volatility numeric,
  current_volatility numeric,
  expansion_percent numeric,
  expansion_score numeric,
  trend_support text,
  momentum_support text,
  risk_level text,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_volatility_compression_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.volatility_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text,
  compression_duration text,
  current_range numeric,
  average_range numeric,
  compression_percent numeric,
  breakout_readiness numeric,
  liquidity_context text,
  confidence numeric,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_breakout_readiness_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.volatility_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  setup_type text,
  timeframe text,
  compression_score numeric,
  liquidity_support text,
  momentum_support text,
  structure_support text,
  breakout_readiness_score numeric,
  direction_bias text,
  confidence numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_abnormal_volatility_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.volatility_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  risk_type text,
  timeframe text,
  current_volatility numeric,
  normal_volatility numeric,
  deviation numeric,
  severity text NOT NULL DEFAULT 'Info',
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.volatility_scanner_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  weight numeric NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.volatility_scanner_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  most_volatile_assets text,
  calmest_assets text,
  best_breakout_ready_assets text,
  assets_too_volatile_to_trade text,
  compression_opportunities text,
  abnormal_volatility_risks text,
  assets_to_monitor text,
  assets_to_avoid text,
  recommended_next_step text,
  summary text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.volatility_scanner_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'Info',
  asset text,
  status text NOT NULL DEFAULT 'Open',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.volatility_scanner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.volatility_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'volatility_scanner',
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO market.volatility_scanner_weights (component_key, component_name, weight)
VALUES
  ('atr_true_range', 'ATR / True Range', 25),
  ('adr_comparison', 'ADR Comparison', 15),
  ('realized_volatility', 'Realized Volatility', 15),
  ('historical_volatility_percentile', 'Historical Volatility Percentile', 15),
  ('range_expansion_compression', 'Range Expansion / Compression', 15),
  ('session_volatility', 'Session Volatility', 10),
  ('news_event_adjustment', 'News/Event Adjustment', 5)
ON CONFLICT (component_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_volatility_scores_latest ON market.asset_volatility_scores(asset, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_volatility_tf_latest ON market.asset_volatility_timeframe_scores(asset, timeframe, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_volatility_rankings_latest ON market.asset_volatility_rankings(rank, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_volatility_expansion_time ON market.asset_volatility_expansion_signals(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_volatility_compression_time ON market.asset_volatility_compression_signals(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_breakout_readiness_time ON market.asset_breakout_readiness_signals(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_abnormal_volatility_time ON market.asset_abnormal_volatility_alerts(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_volatility_runs_started ON market.volatility_scanner_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_volatility_alerts_time ON market.volatility_scanner_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_volatility_audit_time ON market.volatility_scanner_audit_logs(created_at DESC);

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('universe_scanner.volatility.view', 'universe_scanner.volatility', 'view', 'View Volatility Scanner'),
  ('universe_scanner.volatility.run_scan', 'universe_scanner.volatility', 'run_scan', 'Run volatility scans'),
  ('universe_scanner.volatility.recalculate', 'universe_scanner.volatility', 'recalculate', 'Recalculate volatility scores'),
  ('universe_scanner.volatility.configure_rules', 'universe_scanner.volatility', 'configure_rules', 'Configure volatility rules'),
  ('universe_scanner.volatility.create_alert', 'universe_scanner.volatility', 'create_alert', 'Create volatility alerts'),
  ('universe_scanner.volatility.export', 'universe_scanner.volatility', 'export', 'Export volatility report')
ON CONFLICT (code) DO NOTHING;

COMMIT;
