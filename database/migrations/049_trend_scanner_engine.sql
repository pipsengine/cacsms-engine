-- Card 03 / Trend Scanner Engine
-- Production-only trend scores, MTF matrix, rankings, continuation, exhaustion, breakouts, AI summaries, alerts, and audit.

BEGIN;

CREATE SCHEMA IF NOT EXISTS market;

CREATE TABLE IF NOT EXISTS market.trend_scanner_runs (
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

CREATE TABLE IF NOT EXISTS market.asset_trend_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.trend_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  overall_trend text NOT NULL DEFAULT 'Insufficient Data',
  trend_score numeric,
  trend_alignment numeric,
  continuation_probability numeric,
  exhaustion_probability numeric,
  breakout_probability numeric,
  breakdown_probability numeric,
  confidence numeric,
  opportunity_impact text,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_trend_timeframe_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.trend_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  timeframe text NOT NULL,
  trend_direction text NOT NULL DEFAULT 'No Data',
  trend_strength numeric,
  confidence numeric,
  state text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_trend_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.trend_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  asset_class text,
  rank integer,
  overall_trend text,
  trend_score numeric,
  trend_alignment numeric,
  continuation_probability numeric,
  exhaustion_risk numeric,
  breakout_breakdown_signal text,
  trend_confidence numeric,
  opportunity_impact text,
  qualification text NOT NULL DEFAULT 'Insufficient Data',
  last_scanned timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_trend_continuation_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.trend_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  direction text,
  trend_score numeric,
  momentum_support text,
  volatility_support text,
  structure_support text,
  continuation_probability numeric,
  confidence numeric,
  recommended_action text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_trend_exhaustion_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.trend_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  direction text,
  trend_age text,
  exhaustion_score numeric,
  momentum_divergence text,
  volatility_compression text,
  liquidity_sweep_risk text,
  reversal_warning text,
  risk_level text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.asset_breakout_breakdown_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.trend_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  asset text NOT NULL,
  signal_type text,
  direction text,
  break_level numeric,
  confirmation_status text,
  false_break_risk text,
  opportunity_score numeric,
  confidence numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.trend_scanner_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_key text NOT NULL UNIQUE,
  component_name text NOT NULL,
  weight numeric NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by text NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market.trend_scanner_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strongest_trend_assets text,
  weakest_trend_assets text,
  best_continuation_opportunities text,
  exhaustion_risks text,
  breakout_candidates text,
  assets_to_avoid text,
  scanner_confidence numeric,
  recommended_next_step text,
  summary text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market.trend_scanner_alerts (
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

CREATE TABLE IF NOT EXISTS market.trend_scanner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES market.trend_scanner_runs(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES market.asset_universe(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'trend_scanner',
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  ip_address text,
  environment text NOT NULL DEFAULT 'production',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO market.trend_scanner_weights (component_key, component_name, weight)
VALUES
  ('price_structure', 'Price Structure', 25),
  ('moving_average_alignment', 'Moving Average Alignment', 20),
  ('adx_trend_strength', 'ADX / Trend Strength', 15),
  ('multi_timeframe_alignment', 'Multi-Timeframe Alignment', 15),
  ('volatility_expansion', 'Volatility Expansion', 10),
  ('momentum_confirmation', 'Momentum Confirmation', 10),
  ('volume_tick_confirmation', 'Volume / Tick Confirmation', 5)
ON CONFLICT (component_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_asset_trend_scores_latest ON market.asset_trend_scores(asset, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_asset_trend_tf_latest ON market.asset_trend_timeframe_scores(asset, timeframe, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_trend_rankings_latest ON market.asset_trend_rankings(rank, last_scanned DESC);
CREATE INDEX IF NOT EXISTS idx_trend_scanner_runs_started ON market.trend_scanner_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_scanner_alerts_time ON market.trend_scanner_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_scanner_audit_time ON market.trend_scanner_audit_logs(created_at DESC);

INSERT INTO security.permissions (code, resource, action, description)
VALUES
  ('universe_scanner.trend_scanner.view', 'universe_scanner.trend_scanner', 'view', 'View Trend Scanner'),
  ('universe_scanner.trend_scanner.run_scan', 'universe_scanner.trend_scanner', 'run_scan', 'Run live trend scans'),
  ('universe_scanner.trend_scanner.recalculate', 'universe_scanner.trend_scanner', 'recalculate', 'Recalculate trend scores'),
  ('universe_scanner.trend_scanner.configure_rules', 'universe_scanner.trend_scanner', 'configure_rules', 'Configure trend scanner rules'),
  ('universe_scanner.trend_scanner.create_alert', 'universe_scanner.trend_scanner', 'create_alert', 'Create trend scanner alerts'),
  ('universe_scanner.trend_scanner.export', 'universe_scanner.trend_scanner', 'export', 'Export trend scanner report')
ON CONFLICT (code) DO NOTHING;

COMMIT;
